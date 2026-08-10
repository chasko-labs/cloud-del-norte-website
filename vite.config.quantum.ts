import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
	root: resolve(__dirname, "src/sites/quantum"),
	publicDir: resolve(__dirname, "src/sites/quantum/public"),
	plugins: [react()],
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
