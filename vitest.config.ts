import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    react(),
    {
      // Redirect releases.generated.json to seed data when the generated file is absent
      name: 'fallback-generated-json',
      enforce: 'pre',
      resolveId(id) {
        if (id.endsWith('releases.generated.json')) {
          return resolve(__dirname, 'src/data/releases.seed.json');
        }
      },
    },
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    exclude: [
      '**/node_modules/**',
      '.claude/worktrees/**',
    ],
  },
});
