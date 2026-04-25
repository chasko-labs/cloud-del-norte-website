// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly VITE_LIORA_SCRIPT_URL: string | undefined;
	readonly VITE_LIORA_ASSET_BASE: string | undefined;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
