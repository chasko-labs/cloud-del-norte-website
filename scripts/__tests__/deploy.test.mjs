// @vitest-environment node
import { spawnSync } from "node:child_process";
import {
	chmodSync,
	copyFileSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEPLOY = resolve(__dirname, "../deploy.sh");
const REPO = resolve(__dirname, "../..");

const STUB_AWS = `#!/usr/bin/env bash
printf '%s\\n' "$*" >> "\${AWS_LOG:?}"
case " $* " in
  *" --dryrun "*)
    for ((i = 0; i < \${STUB_DELETES:-0}; i++)); do
      echo "(dryrun) delete: s3://clouddelnorte.org/old-\${i}.html"
    done
    ;;
  *" get-bucket-location "*) echo None ;;
  *" create-invalidation "*) echo I1TEST ;;
esac
exit 0
`;

const STUB_NPM = `#!/usr/bin/env bash
if [ "$1" = run ] && [ "$2" = build ]; then
  mkdir -p lib/assets lib-auth/assets lib-awsug/assets
  echo '<title>AWS UG Cloud del Norte</title>' > lib/index.html
  touch lib-auth/index.html lib-awsug/index.html
fi
exit 0
`;

const STUB_CURL = `#!/usr/bin/env bash
echo '<title>AWS UG Cloud del Norte</title>'
`;

const tempDirs = [];

afterEach(() => {
	for (const dir of tempDirs.splice(0)) {
		rmSync(dir, { recursive: true, force: true });
	}
});

function makeSandbox() {
	const root = mkdtempSync(join(tmpdir(), "cdn-deploy-"));
	tempDirs.push(root);
	const bin = join(root, "bin");
	mkdirSync(bin);
	for (const [name, body] of [
		["aws", STUB_AWS],
		["npm", STUB_NPM],
		["curl", STUB_CURL],
	]) {
		const file = join(bin, name);
		writeFileSync(file, body);
		chmodSync(file, 0o755);
	}
	const fixture = join(root, "repo");
	mkdirSync(join(fixture, "scripts"), { recursive: true });
	copyFileSync(DEPLOY, join(fixture, "scripts/deploy.sh"));
	chmodSync(join(fixture, "scripts/deploy.sh"), 0o755);
	return { root, bin, fixture, awsLog: join(root, "aws.log") };
}

// defaults to the sandbox copy so builds and .deploy.log never touch the repo
function runDeploy(args, opts) {
	const { sandbox, env = {}, script, cwd } = opts;
	const scriptPath = script ?? join(sandbox.fixture, "scripts/deploy.sh");
	return spawnSync("bash", [scriptPath, ...args], {
		cwd: cwd ?? sandbox.fixture,
		encoding: "utf8",
		env: {
			HOME: process.env.HOME,
			PATH: `${sandbox.bin}:${process.env.PATH}`,
			AWS_LOG: sandbox.awsLog,
			...env,
		},
	});
}

function awsCalls(sandbox) {
	if (!existsSync(sandbox.awsLog)) return [];
	return readFileSync(sandbox.awsLog, "utf8").split("\n").filter(Boolean);
}

describe("scripts/deploy.sh dry-run per bucket", () => {
	const rows = [
		["main", "clouddelnorte.org", "us-east-1"],
		["auth", "auth.clouddelnorte.org", "us-east-1"],
		["awsug", "awsug.clouddelnorte.org", "us-east-1"],
		["dev", "dev.clouddelnorte.org", "us-east-1"],
		["quantum", "quantum.clouddelnorte.org", "us-west-2"],
	];

	it.each(
		rows,
	)("%s targets s3://%s in %s with profile and region, no aws calls", (target, bucket, region) => {
		const sandbox = makeSandbox();
		const result = runDeploy([target], {
			script: DEPLOY,
			sandbox,
			cwd: REPO,
		});
		expect(result.status).toBe(0);
		expect(result.stdout).toContain(`s3://${bucket}/`);
		expect(result.stdout).toContain("--profile aerospaceug-admin");
		expect(result.stdout).toContain(`--region ${region}`);
		expect(result.stdout).toContain("nothing was uploaded");
		expect(awsCalls(sandbox)).toEqual([]);
	});
});

describe("scripts/deploy.sh integer check", () => {
	it.each([
		"abc",
		"-1",
		"1.5",
		"9999999999",
	])("rejects MAX_DELETES=%s with exit 2", (value) => {
		const sandbox = makeSandbox();
		const result = runDeploy(["main"], {
			script: DEPLOY,
			sandbox,
			cwd: REPO,
			env: { MAX_DELETES: value },
		});
		expect(result.status).toBe(2);
		expect(result.stderr).toContain(
			"MAX_DELETES must be a non-negative integer",
		);
	});

	it("accepts MAX_DELETES=0", () => {
		const sandbox = makeSandbox();
		const result = runDeploy(["main"], {
			script: DEPLOY,
			sandbox,
			cwd: REPO,
			env: { MAX_DELETES: "0" },
		});
		expect(result.status).toBe(0);
	});
});

describe("scripts/deploy.sh delete guard", () => {
	it("dry-run with --check-remote aborts above MAX_DELETES", () => {
		const sandbox = makeSandbox();
		const result = runDeploy(["main", "--check-remote"], {
			sandbox,
			env: { MAX_DELETES: "2", STUB_DELETES: "3" },
		});
		expect(result.status).toBe(1);
		expect(result.stderr).toContain("exceeds MAX_DELETES=2");
	});

	it("ALLOW_DELETES=1 overrides the limit", () => {
		const sandbox = makeSandbox();
		const result = runDeploy(["main", "--check-remote"], {
			sandbox,
			env: { MAX_DELETES: "2", STUB_DELETES: "3", ALLOW_DELETES: "1" },
		});
		expect(result.status).toBe(0);
	});

	it("apply aborts before any upload when the guard trips", () => {
		const sandbox = makeSandbox();
		const result = runDeploy(["main", "--apply"], {
			sandbox,
			env: { MAX_DELETES: "2", STUB_DELETES: "3" },
		});
		expect(result.status).toBe(1);
		const uploads = awsCalls(sandbox).filter(
			(line) => line.includes("s3 sync") && !line.includes("--dryrun"),
		);
		expect(uploads).toEqual([]);
		const invalidations = awsCalls(sandbox).filter((line) =>
			line.includes("create-invalidation"),
		);
		expect(invalidations).toEqual([]);
	});

	it("apply uploads with profile and region on every aws call", () => {
		const sandbox = makeSandbox();
		const result = runDeploy(["main", "--apply"], {
			sandbox,
			env: { MAX_DELETES: "25", STUB_DELETES: "2" },
		});
		expect(result.status).toBe(0);
		const calls = awsCalls(sandbox);
		expect(calls.length).toBeGreaterThan(0);
		for (const line of calls) {
			expect(line).toContain("--profile aerospaceug-admin");
			expect(line).toContain("--region us-east-1");
		}
		const uploaded = calls.some(
			(line) =>
				line.includes("s3 sync") &&
				!line.includes("--dryrun") &&
				line.includes("s3://clouddelnorte.org/"),
		);
		expect(uploaded).toBe(true);
	});
});
