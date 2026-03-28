import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/*.d.ts'],
      reporter: ['text', 'json-summary'],
      thresholds: {
        statements: 45,
        branches: 40,
        functions: 50,
        lines: 45,
      },
    },
  },
});
