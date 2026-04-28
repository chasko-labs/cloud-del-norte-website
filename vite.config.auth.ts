// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { resolve } from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: resolve(__dirname, 'src/sites/auth'),
  publicDir: resolve(__dirname, 'public'),
  plugins: [react()],
  server: {
    port: 8081,
  },
  build: {
    outDir: resolve(__dirname, './lib-auth'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        login: resolve(__dirname, './src/sites/auth/login/index.html'),
        signup: resolve(__dirname, './src/sites/auth/signup/index.html'),
        verify: resolve(__dirname, './src/sites/auth/verify/index.html'),
        'forgot-password': resolve(__dirname, './src/sites/auth/forgot-password/index.html'),
      },
    },
  },
});
