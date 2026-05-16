// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly VITE_FIONA_SCRIPT_URL: string | undefined;
	readonly VITE_FIONA_ASSET_BASE: string | undefined;
	/** Override the origin used to resolve fiona-embed assets.
	 *  Required on subdomains where fiona-embed is not deployed.
	 *  Example: https://clouddelnorte.org */
	readonly VITE_FIONA_ORIGIN: string | undefined;
	/** Lambda Function URL for bug/wish feedback submissions */
	readonly VITE_FEEDBACK_API_URL: string | undefined;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
