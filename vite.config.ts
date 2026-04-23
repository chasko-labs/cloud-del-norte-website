// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { resolve } from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  root: resolve(__dirname, 'src/pages'),
  publicDir: resolve(__dirname, 'public'),
  plugins: [react()],
  server: {
    port: 8080,
  },
  build: {
    outDir: resolve(__dirname, './lib'),
    rollupOptions: {
      input: {
        home: resolve(__dirname, './src/pages/home/index.html'),
        roadmap: resolve(__dirname, './src/pages/roadmap/index.html'),
        meetings: resolve(__dirname, './src/pages/meetings/index.html'),
        'create-meeting': resolve(__dirname, './src/pages/create-meeting/index.html'),
        'learning/api': resolve(__dirname, './src/pages/learning/api/index.html'),
        'maintenance-calendar': resolve(__dirname, './src/pages/maintenance-calendar/index.html'),
        theme: resolve(__dirname, './src/pages/theme/index.html'),
        'auth/callback': resolve(__dirname, './src/pages/auth/callback/index.html'),
      },
    },
  },
});
