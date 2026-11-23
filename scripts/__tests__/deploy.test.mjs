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
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEPLOY = resolve(__dirname, "../deploy.sh");
const REPO = resolve(__dirname, "../..");
const scratchDir = join(REPO, ".scratch");

const STUB_AWS = `#!/usr/bin/env bash
printf '%s\\n' "$*" >> "\${AWS_LOG:?}"
case " $* " in
  *" --dryrun "*)
    if [ "\${STUB_FAIL_DRYRUN:-0}" = 1 ]; then
      echo "stub: dryrun failed" >&2
      exit 1
    fi
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

// mirrors the quantum brand list in scripts/deploy.sh
const QUANTUM_BRAND_ASSETS = [
	"quantum-hero-1920x600.webp",
	"quantum-hero-1920x600.png",
	"quantum-hero-mobile-1080x1920.webp",
	"quantum-hero-mobile-1080x1920.png",
	"quantum-card-origami-600x400.png",
	"quantum-card-lattices-600x400.png",
	"quantum-card-prism-600x400.png",
	"quantum-og-1200x630.png",
	"quantum-meetup-1200x675.png",
	"quantum-fb-event-1920x1005.png",
];

const BUILD_DIRS = {
	main: "lib",
	dev: "lib",
	auth: "lib-auth",
	awsug: "lib-awsug",
	quantum: "lib-quantum",
};

const sandboxes = [];

afterEach(() => {
	for (const dir of sandboxes.splice(0)) {
		rmSync(dir, { recursive: true, force: true });
	}
});

function makeSandbox() {
	mkdirSync(scratchDir, { recursive: true });
	const root = mkdtempSync(join(scratchDir, "cdn-deploy-"));
	sandboxes.push(root);
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

// writes a minimal build dir for one target inside the sandbox
function seedBuild(fixture, target) {
	const dir = join(fixture, BUILD_DIRS[target]);
	mkdirSync(dir, { recursive: true });
	writeFileSync(
		join(dir, "index.html"),
		"<title>AWS UG Cloud del Norte</title>",
	);
	if (target === "quantum") {
		const brand = join(dir, "brand/quantum");
		mkdirSync(brand, { recursive: true });
		for (const name of QUANTUM_BRAND_ASSETS) {
			writeFileSync(join(brand, name), "");
		}
	} else if (target !== "dev") {
		mkdirSync(join(dir, "assets"));
		writeFileSync(join(dir, "assets/app.js"), "");
	}
	return dir;
}

// always runs the sandbox copy of deploy.sh so builds and .deploy.log stay in the sandbox
function runDeploy(args, opts) {
	const { sandbox, env = {} } = opts;
	return spawnSync(
		"bash",
		[join(sandbox.fixture, "scripts/deploy.sh"), ...args],
		{
			cwd: sandbox.fixture,
			encoding: "utf8",
			env: {
				HOME: process.env.HOME,
				PATH: `${sandbox.bin}:${process.env.PATH}`,
				AWS_LOG: sandbox.awsLog,
				...env,
			},
		},
	);
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

	it.each(rows)(
		"%s targets s3://%s in %s with profile and region, no aws calls",
		(target, bucket, region) => {
			const sandbox = makeSandbox();
			seedBuild(sandbox.fixture, target);
			const result = runDeploy([target], { sandbox });
			expect(result.status).toBe(0);
			expect(result.stdout).toContain(`s3://${bucket}/`);
			expect(result.stdout).toContain("--profile aerospaceug-admin");
			expect(result.stdout).toContain(`--region ${region}`);
			expect(result.stdout).toContain("nothing was uploaded");
			expect(awsCalls(sandbox)).toEqual([]);
		},
	);

	it("pass 1 dry-run excludes the protected prefixes", () => {
		const sandbox = makeSandbox();
		seedBuild(sandbox.fixture, "main");
		const result = runDeploy(["main"], { sandbox });
		expect(result.status).toBe(0);
		const pass1 = result.stdout
			.split("\n")
			.find((line) => line.includes("--exclude assets/"));
		expect(pass1).toBeDefined();
		for (const prefix of ["liora", "screenshots", "quantum", "_previews"]) {
			expect(pass1).toContain(`--exclude ${prefix}/\\*`);
		}
	});
});

describe("scripts/deploy.sh build output checks", () => {
	it.each(["main", "auth", "awsug"])(
		"%s fails when assets/ is missing",
		(target) => {
			const sandbox = makeSandbox();
			const dir = seedBuild(sandbox.fixture, target);
			rmSync(join(dir, "assets"), { recursive: true, force: true });
			const result = runDeploy([target], { sandbox });
			expect(result.status).toBe(1);
			expect(result.stderr).toContain("assets missing or empty");
			expect(awsCalls(sandbox)).toEqual([]);
		},
	);

	it.each(["main", "auth", "awsug"])(
		"%s fails when assets/ is empty",
		(target) => {
			const sandbox = makeSandbox();
			const dir = seedBuild(sandbox.fixture, target);
			rmSync(join(dir, "assets/app.js"));
			const result = runDeploy([target], { sandbox });
			expect(result.status).toBe(1);
			expect(result.stderr).toContain("assets missing or empty");
		},
	);
});

describe("scripts/deploy.sh integer check", () => {
	it.each(["abc", "-1", "1.5", "9999999999"])(
		"rejects MAX_DELETES=%s with exit 2",
		(value) => {
			const sandbox = makeSandbox();
			const result = runDeploy(["main"], {
				sandbox,
				env: { MAX_DELETES: value },
			});
			expect(result.status).toBe(2);
			expect(result.stderr).toContain(
				"MAX_DELETES must be a non-negative integer",
			);
		},
	);

	it("accepts MAX_DELETES=0", () => {
		const sandbox = makeSandbox();
		const result = runDeploy(["main"], {
			sandbox,
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

	it("sums deletes across passes and aborts above MAX_DELETES", () => {
		const sandbox = makeSandbox();
		seedBuild(sandbox.fixture, "main");
		mkdirSync(join(sandbox.fixture, "lib/events"));
		// each pass alone is 2, under the limit of 3. the bucket total is 4
		const result = runDeploy(["main", "--check-remote"], {
			sandbox,
			env: { MAX_DELETES: "3", STUB_DELETES: "2" },
		});
		expect(result.status).toBe(1);
		expect(result.stdout).toContain(
			"delete guard: 4 delete(s) in clouddelnorte.org, limit 3",
		);
		expect(result.stderr).toContain("4 deletes exceeds MAX_DELETES=3");
	});

	it("passes when the summed deletes equal MAX_DELETES", () => {
		const sandbox = makeSandbox();
		seedBuild(sandbox.fixture, "main");
		mkdirSync(join(sandbox.fixture, "lib/events"));
		const result = runDeploy(["main", "--check-remote"], {
			sandbox,
			env: { MAX_DELETES: "4", STUB_DELETES: "2" },
		});
		expect(result.status).toBe(0);
	});

	it("a failing aws --dryrun exits 1", () => {
		const sandbox = makeSandbox();
		seedBuild(sandbox.fixture, "main");
		const result = runDeploy(["main", "--check-remote"], {
			sandbox,
			env: { STUB_FAIL_DRYRUN: "1" },
		});
		expect(result.status).toBe(1);
		expect(result.stderr).toContain(
			"aws s3 sync --dryrun failed for clouddelnorte.org",
		);
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

	it("apply aborts before any upload when the --dryrun preview fails", () => {
		const sandbox = makeSandbox();
		const result = runDeploy(["main", "--apply"], {
			sandbox,
			env: { STUB_FAIL_DRYRUN: "1" },
		});
		expect(result.status).toBe(1);
		const uploads = awsCalls(sandbox).filter(
			(line) => line.includes("s3 sync") && !line.includes("--dryrun"),
		);
		expect(uploads).toEqual([]);
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
