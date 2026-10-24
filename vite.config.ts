import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  base: './',
  server: { watch: { ignored: ['**/release/**', '**/dist/**'] } },
  build: { target: 'es2022' },
  test: { include: ['tests/**/*.test.ts'] },
});
