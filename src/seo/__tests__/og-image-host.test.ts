import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "../../..");

const FORBIDDEN_HOST = "dev.clouddelnorte.org";
const IMAGE_KEYS = new Set(["og:image", "twitter:image"]);

// build output directory for each production host. an image meta on a page
// must reference the same host the page is built for
const BUILD_DIR_BY_HOST: Record<string, string> = {
	"clouddelnorte.org": "lib",
	"auth.clouddelnorte.org": "lib-auth",
	"awsug.clouddelnorte.org": "lib-awsug",
	"quantum.clouddelnorte.org": "lib-quantum",
};

// pre-push runs this file after `npm run build` with REQUIRE_BUILD_OUTPUT=1,
// so missing build output fails the gate instead of skipping silently
const buildRequired = process.env.REQUIRE_BUILD_OUTPUT === "1";

function walkHtml(dir: string): string[] {
	if (!existsSync(dir)) return [];
	return readdirSync(dir, { recursive: true })
		.map((entry) => join(dir, String(entry)))
		.filter((path) => path.endsWith(".html") && statSync(path).isFile());
}

function attr(tag: string, name: string): string | undefined {
	return new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1];
}

function imageMetas(html: string): { key: string; content: string }[] {
	const found: { key: string; content: string }[] = [];
	for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
		const key = attr(tag, "property") ?? attr(tag, "name");
		const content = attr(tag, "content");
		if (key && content !== undefined && IMAGE_KEYS.has(key)) {
			found.push({ key, content });
		}
	}
	return found;
}

describe("og:image and twitter:image in source html", () => {
	const sourceFiles = walkHtml(join(ROOT, "src"));

	it("finds html source files to scan", () => {
		expect(sourceFiles.length).toBeGreaterThan(0);
	});

	it("no source image meta points at the dev host", () => {
		const hits: string[] = [];
		for (const file of sourceFiles) {
			for (const meta of imageMetas(readFileSync(file, "utf8"))) {
				if (meta.content.includes(FORBIDDEN_HOST)) {
					hits.push(`${relative(ROOT, file)} ${meta.key} ${meta.content}`);
				}
			}
		}
		expect(hits).toEqual([]);
	});
});

// npm run build produces these three. lib-quantum comes from a separate vite
// build in scripts/deploy.sh, so it is checked only when present
const DEFAULT_BUILD_HOSTS = [
	"clouddelnorte.org",
	"auth.clouddelnorte.org",
	"awsug.clouddelnorte.org",
];
const builtDirs = Object.entries(BUILD_DIR_BY_HOST).filter(([, dir]) =>
	existsSync(join(ROOT, dir)),
);
const anyBuilt = builtDirs.length > 0;

describe.skipIf(!buildRequired && !anyBuilt)(
	"og:image and twitter:image in build output",
	() => {
		it("npm run build output exists for main, auth and awsug", () => {
			for (const host of DEFAULT_BUILD_HOSTS) {
				expect(existsSync(join(ROOT, BUILD_DIR_BY_HOST[host]))).toBe(true);
			}
		});

		it("no built image meta points at the dev host", () => {
			const hits: string[] = [];
			for (const [, dir] of builtDirs) {
				for (const file of walkHtml(join(ROOT, dir))) {
					for (const meta of imageMetas(readFileSync(file, "utf8"))) {
						if (meta.content.includes(FORBIDDEN_HOST)) {
							hits.push(`${relative(ROOT, file)} ${meta.key} ${meta.content}`);
						}
					}
				}
			}
			expect(hits).toEqual([]);
		});

		it("every built image meta is served by its own host and exists in that build", () => {
			const problems: string[] = [];
			for (const [host, dir] of builtDirs) {
				for (const file of walkHtml(join(ROOT, dir))) {
					for (const meta of imageMetas(readFileSync(file, "utf8"))) {
						const where = `${relative(ROOT, file)} ${meta.key} ${meta.content}`;
						let url: URL;
						try {
							url = new URL(meta.content);
						} catch {
							problems.push(`unparseable url: ${where}`);
							continue;
						}
						if (url.hostname !== host) {
							problems.push(`wrong host (expected ${host}): ${where}`);
							continue;
						}
						const asset = join(ROOT, dir, decodeURIComponent(url.pathname));
						if (!existsSync(asset)) {
							problems.push(`missing asset: ${where}`);
						}
					}
				}
			}
			expect(problems).toEqual([]);
		});
	},
);
