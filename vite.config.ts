import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const root = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        ...Object.fromEntries(
          readdirSync(root)
            .filter((file) => file.endsWith('.html'))
            .map((file) => [file.replace(/\.html$/, ''), resolve(root, file)]),
        ),
        ...Object.fromEntries(
          readdirSync(resolve(root, 'src/pages'))
            .filter((file) => file.endsWith('.html'))
            .map((file) => [`src/pages/${file.replace(/\.html$/, '')}`, resolve(root, 'src/pages', file)]),
        ),
      },
    },
  },
});