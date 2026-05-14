// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { defineConfig, devices } from "playwright/test";

export default defineConfig({
	testDir: "./tests/e2e",
	snapshotDir: "./tests/e2e/__screenshots__",
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	reporter: "list",
	use: {
		baseURL: process.env.BASE_URL ?? "https://clouddelnorte.org",
		trace: "on-first-retry",
	},
	projects: [
		{
			name: "chromium",
			use: { ...devices["Desktop Chrome"] },
		},
	],
});
