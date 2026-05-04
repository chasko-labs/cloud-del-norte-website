// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import react from "@vitejs/plugin-react";
import { resolve } from "path";
import { defineConfig } from "vite";

// https://vitejs.dev/config/
export default defineConfig({
	root: resolve(__dirname, "src/pages"),
	envDir: resolve(__dirname, "."),
	publicDir: resolve(__dirname, "public"),
	plugins: [react()],
	server: {
		port: 8080,
	},
	build: {
		outDir: resolve(__dirname, "./lib"),
		// floor after manualChunks split:
		//   babylon-shaders ~599kB    GLSL source strings; cannot fragment further
		//   cloudscape-core ~560kB    DS primitives bundle; intentional cohesion
		//   babylon-animations ~450kB  monolithic engine module
		// 600kB accepts the floor; everything else lands well under.
		chunkSizeWarningLimit: 600,
		rollupOptions: {
			input: {
				feed: resolve(__dirname, "./src/pages/feed/index.html"),
				home: resolve(__dirname, "./src/pages/home/index.html"),
				roadmap: resolve(__dirname, "./src/pages/roadmap/index.html"),
				meetings: resolve(__dirname, "./src/pages/meetings/index.html"),
				"create-meeting": resolve(
					__dirname,
					"./src/pages/create-meeting/index.html",
				),
				"learning/api": resolve(
					__dirname,
					"./src/pages/learning/api/index.html",
				),
				"maintenance-calendar": resolve(
					__dirname,
					"./src/pages/maintenance-calendar/index.html",
				),
				theme: resolve(__dirname, "./src/pages/theme/index.html"),
				"auth/callback": resolve(
					__dirname,
					"./src/pages/auth/callback/index.html",
				),
				admin: resolve(__dirname, "./src/pages/admin/index.html"),
				"dune-test": resolve(
					__dirname,
					"./src/pages/dune-test/index.html",
				),
				plans: resolve(__dirname, "./src/pages/plans/index.html"),
			},
			output: {
				// split BabylonJS + Cloudscape into long-lived named chunks so
				// (a) the browser caches them across deploys when only app code
				// changes, and (b) no single chunk exceeds the warning limit.
				// Order matters: most specific match wins — Meshes / Materials
				// must come before the catch-all "babylon-core".
				manualChunks(id: string) {
					if (id.includes("node_modules/@babylonjs/core/Meshes"))
						return "babylon-meshes";
					if (
						id.includes("node_modules/@babylonjs/core/Materials") ||
						id.includes("node_modules/@babylonjs/materials")
					)
						return "babylon-materials";
					if (id.includes("node_modules/@babylonjs/core/Engines"))
						return "babylon-engine";
					if (id.includes("node_modules/@babylonjs/core/Shaders"))
						return "babylon-shaders";
					if (id.includes("node_modules/@babylonjs/core/Animations"))
						return "babylon-animations";
					if (id.includes("node_modules/@babylonjs/core/Maths"))
						return "babylon-maths";
					if (id.includes("node_modules/@babylonjs/core/Cameras"))
						return "babylon-cameras";
					if (id.includes("node_modules/@babylonjs/core/Lights"))
						return "babylon-lights";
					if (id.includes("node_modules/@babylonjs/core/Layers"))
						return "babylon-layers";
					if (id.includes("node_modules/@babylonjs/core/Particles"))
						return "babylon-particles";
					if (id.includes("node_modules/@babylonjs/core/PostProcesses"))
						return "babylon-postprocess";
					if (id.includes("node_modules/@babylonjs/core/Misc"))
						return "babylon-misc";
					if (id.includes("node_modules/@babylonjs/core"))
						return "babylon-core";
					// Cloudscape — split by component family. Components often grow
					// independently across releases; per-family chunks make cache
					// invalidation surgical.
					if (
						id.includes("node_modules/@cloudscape-design/components/table") ||
						id.includes("node_modules/@cloudscape-design/components/cards") ||
						id.includes(
							"node_modules/@cloudscape-design/collection-hooks",
						)
					)
						return "cloudscape-tables";
					if (
						id.includes("node_modules/@cloudscape-design/components/form") ||
						id.includes("node_modules/@cloudscape-design/components/input") ||
						id.includes("node_modules/@cloudscape-design/components/select") ||
						id.includes("node_modules/@cloudscape-design/components/textarea") ||
						id.includes("node_modules/@cloudscape-design/components/checkbox") ||
						id.includes(
							"node_modules/@cloudscape-design/components/radio-group",
						)
					)
						return "cloudscape-forms";
					if (
						id.includes("node_modules/@cloudscape-design/components/app-layout") ||
						id.includes(
							"node_modules/@cloudscape-design/components/content-layout",
						) ||
						id.includes(
							"node_modules/@cloudscape-design/components/top-navigation",
						) ||
						id.includes(
							"node_modules/@cloudscape-design/components/side-navigation",
						) ||
						id.includes(
							"node_modules/@cloudscape-design/components/breadcrumb-group",
						) ||
						id.includes("node_modules/@cloudscape-design/components/help-panel")
					)
						return "cloudscape-layout";
					if (id.includes("node_modules/@cloudscape-design"))
						return "cloudscape-core";
				},
			},
		},
	},
});
