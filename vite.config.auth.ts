// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { copyFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/**
 * Copies the shared atmosphere og image into the auth build output. The auth
 * publicDir is scoped to src/sites/auth/public, so the root public/brand
 * tree never reaches this bucket without this step. Only the og file is
 * copied, so the auth bucket does not take the full brand set.
 */
function copyOgImage() {
	const src = resolve(
		__dirname,
		"public/brand/atmosphere/cdn-atmosphere-og-1200x630.png",
	);
	return {
		name: "copy-auth-og-image",
		closeBundle() {
			const destDir = resolve(__dirname, "lib-auth/brand/atmosphere");
			mkdirSync(destDir, { recursive: true });
			copyFileSync(src, resolve(destDir, "cdn-atmosphere-og-1200x630.png"));
		},
	};
}

export default defineConfig({
	root: resolve(__dirname, "src/sites/auth"),
	envDir: resolve(__dirname, "."),
	publicDir: resolve(__dirname, "src/sites/auth/public"),
	plugins: [react(), copyOgImage()],
	server: {
		port: 8081,
	},
	build: {
		outDir: resolve(__dirname, "./lib-auth"),
		emptyOutDir: true,
		rollupOptions: {
			input: {
				login: resolve(__dirname, "./src/sites/auth/login/index.html"),
				signup: resolve(__dirname, "./src/sites/auth/signup/index.html"),
				verify: resolve(__dirname, "./src/sites/auth/verify/index.html"),
				passkeys: resolve(__dirname, "./src/sites/auth/passkeys/index.html"),
				"forgot-password": resolve(
					__dirname,
					"./src/sites/auth/forgot-password/index.html",
				),
				"verification-setup": resolve(
					__dirname,
					"./src/sites/auth/verification-setup/index.html",
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
