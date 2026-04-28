// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { resolve } from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: resolve(__dirname, 'src/sites/awsug'),
  publicDir: resolve(__dirname, 'public'),
  plugins: [react()],
  server: {
    port: 8082,
  },
  build: {
    outDir: resolve(__dirname, './lib-awsug'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: resolve(__dirname, './src/sites/awsug/index.html'),
        'auth/redeem': resolve(__dirname, './src/sites/awsug/auth/redeem/index.html'),
        meetings: resolve(__dirname, './src/sites/awsug/meetings/index.html'),
        'create-meeting': resolve(__dirname, './src/sites/awsug/create-meeting/index.html'),
        admin: resolve(__dirname, './src/sites/awsug/admin/index.html'),
      },
    },
  },
});
