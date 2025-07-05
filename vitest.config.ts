import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    exclude: ['node_modules', 'dist'],
    testTimeout: 10000, // 10 second timeout for individual tests
    hookTimeout: 10000, // 10 second timeout for hooks
    teardownTimeout: 10000, // 10 second timeout for teardown
    // Suppress expected React error boundary errors in tests
    silent: false,
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'json-summary'],
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: ['src/**/*.d.ts', 'src/**/*.stories.ts', 'src/**/*.stories.tsx'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80
      }
    },
    
    // Reporter
    reporter: ['default', 'junit'],
    outputFile: {
      junit: './test-results/junit.xml'
    }
  }
});