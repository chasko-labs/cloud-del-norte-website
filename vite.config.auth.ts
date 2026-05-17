// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
	root: resolve(__dirname, "src/sites/auth"),
	publicDir: resolve(__dirname, "src/sites/auth/public"),
	plugins: [react()],
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
