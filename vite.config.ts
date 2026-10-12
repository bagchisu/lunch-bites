import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const root = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        index: resolve(root, 'index.html'),
        expensesTreemap: resolve(root, 'expenses_treemap.html'),
        cashFlow: resolve(root, 'cash_flow.html'),
      },
    },
  },
});