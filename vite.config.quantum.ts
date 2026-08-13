import { cpSync } from "node:fs";
import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/**
 * Copies public/brand/quantum/ into the build output at brand/quantum/.
 * The quantum site's publicDir is scoped to src/sites/quantum/public (for
 * quantum-specific static assets), but brand assets live at the repo-root
 * public/brand/quantum/ as the single source of truth. Without this plugin
 * the --delete flag on deploy-manual.sh's s3 sync would orphan the brand
 * assets on the next deploy.
 */
function copyBrandAssets() {
	const src = resolve(__dirname, "public/brand/quantum");
	return {
		name: "copy-quantum-brand-assets",
		closeBundle() {
			const dest = resolve(__dirname, "lib-quantum/brand/quantum");
			cpSync(src, dest, { recursive: true });
		},
	};
}

export default defineConfig({
	root: resolve(__dirname, "src/sites/quantum"),
	publicDir: resolve(__dirname, "src/sites/quantum/public"),
	plugins: [react(), copyBrandAssets()],
	server: {
		port: 8083,
	},
	build: {
		outDir: resolve(__dirname, "./lib-quantum"),
		emptyOutDir: true,
		rollupOptions: {
			input: {
				landing: resolve(__dirname, "./src/sites/quantum/landing/index.html"),
				register: resolve(__dirname, "./src/sites/quantum/register/index.html"),
				dashboard: resolve(
					__dirname,
					"./src/sites/quantum/dashboard/index.html",
				),
				"auth-callback": resolve(
					__dirname,
					"./src/sites/quantum/auth-callback/index.html",
				),
			},
			output: {
				manualChunks(id) {
					if (id.includes("node_modules/react-dom")) return "vendor-react";
					if (id.includes("node_modules/react/")) return "vendor-react";
					if (
						id.includes(
							"node_modules/@cloudscape-design/components/app-layout",
						) ||
						id.includes(
							"node_modules/@cloudscape-design/components/top-navigation",
						)
					) {
						return "vendor-cloudscape-shell";
					}
					if (id.includes("node_modules/@cloudscape-design"))
						return "vendor-cloudscape";
					if (id.includes("/src/locales/es-MX.json")) return "locale-mx";
					if (id.includes("/src/locales/en-US.json")) return "locale-en";
				},
			},
		},
	},
});
