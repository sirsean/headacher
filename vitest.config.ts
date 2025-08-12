import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        'tests/',
        '**/*.d.ts',
        '**/*.config.*',
        'src/main.tsx',
        'src/vite-env.d.ts'
      ]
    },
    // Allow importing modules with .js extensions
    alias: {
      '@': new URL('./src', import.meta.url).pathname,
      '@worker': new URL('./worker', import.meta.url).pathname,
    }
  }
});
