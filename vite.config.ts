import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const root = fileURLToPath(new URL('.', import.meta.url));
const pagesRoot = resolve(root, 'src/pages');
const capabilityPageFiles = readdirSync(pagesRoot).filter((file) => file.endsWith('.html'));
const capabilityPageRoutes = new Map(
  capabilityPageFiles.map((file) => [`/${file}`, `/src/pages/${file}`]),
);

export default defineConfig({
  plugins: [
    {
      name: 'capability-page-routes',
      enforce: 'post',
      configureServer(server) {
        server.middlewares.use((request, _response, next) => {
          if (request.url) {
            const [pathname, query = ''] = request.url.split('?');
            const sourcePath = capabilityPageRoutes.get(pathname);
            if (sourcePath) {
              request.url = `${sourcePath}${query ? `?${query}` : ''}`;
            }
          }
          next();
        });
      },
      generateBundle(_options, bundle) {
        for (const file of capabilityPageFiles) {
          const nestedPath = `src/pages/${file}`;
          const pageAsset = bundle[nestedPath];
          if (pageAsset?.type === 'asset') {
            this.emitFile({
              type: 'asset',
              fileName: file,
              source: pageAsset.source,
            });
            delete bundle[nestedPath];
          }
        }
      },
    },
  ],
  build: {
    rollupOptions: {
      input: {
        ...Object.fromEntries(
          readdirSync(root)
            .filter((file) => file.endsWith('.html'))
            .map((file) => [file.replace(/\.html$/, ''), resolve(root, file)]),
        ),
        ...Object.fromEntries(
          capabilityPageFiles.map((file) => [file.replace(/\.html$/, ''), resolve(pagesRoot, file)]),
        ),
      },
    },
  },
});