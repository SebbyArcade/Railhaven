import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// One self-contained HTML file: it can be published as an artifact or opened from a phone's downloads.
export default defineConfig({
  plugins: [viteSingleFile()],
  build: { target: 'es2022', assetsInlineLimit: 100_000_000 },
  test: { include: ['tests/**/*.test.ts'], testTimeout: 30000 }, // tests that import a full old save can take over 5 s on a busy CI machine
});
