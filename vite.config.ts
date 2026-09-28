import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative base so the build runs from any folder (Poki uploads a zip).
  base: './',
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
