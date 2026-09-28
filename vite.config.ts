import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vitest/config';

/** Dev-only endpoint: POST /__promo?name=file.png saves a rendered image into promo/ (thumbnails). */
function promoSaver(): Plugin {
  return {
    name: 'promo-saver',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__promo', (req, res) => {
        const url = new URL(req.url ?? '', 'http://x');
        const name = (url.searchParams.get('name') ?? 'shot.png').replace(/[^\w.-]/g, '_');
        const chunks: Buffer[] = [];
        req.on('data', (c: Buffer) => chunks.push(c));
        req.on('end', () => {
          const dir = resolve(process.cwd(), 'promo');
          mkdirSync(dir, { recursive: true });
          writeFileSync(resolve(dir, name), Buffer.concat(chunks));
          res.end('ok');
        });
      });
    },
  };
}

export default defineConfig({
  // Relative base so the build runs from any folder (Poki uploads a zip).
  base: './',
  plugins: [promoSaver()],
  build: {
    target: 'es2020',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 1500,
    reportCompressedSize: true,
  },
  server: { port: 5178, host: true },
  preview: { port: 5179 },
  test: {
    include: ['src/**/*.test.ts', 'tools/**/*.test.ts'],
    environment: 'node',
  },
});
