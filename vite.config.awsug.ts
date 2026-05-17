// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
	root: resolve(__dirname, "src/sites/awsug"),
	publicDir: resolve(__dirname, "public"),
	plugins: [react()],
	server: {
		port: 8082,
	},
	build: {
		outDir: resolve(__dirname, "./lib-awsug"),
		emptyOutDir: true,
		rollupOptions: {
			input: {
				index: resolve(__dirname, "./src/sites/awsug/index.html"),
				"auth/redeem": resolve(
					__dirname,
					"./src/sites/awsug/auth/redeem/index.html",
				),
				"auth/callback": resolve(
					__dirname,
					"./src/sites/awsug/auth/callback/index.html",
				),
				meetings: resolve(__dirname, "./src/sites/awsug/meetings/index.html"),
				"create-meeting": resolve(
					__dirname,
					"./src/sites/awsug/create-meeting/index.html",
				),
				admin: resolve(__dirname, "./src/sites/awsug/admin/index.html"),
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
