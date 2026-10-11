import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['test/index.js', 'test/integration/**/index.js'],
    threads: false,
    maxThreads: 1,
    testTimeout: 3000,
    coverage: {
      provider: 'v8',
      include: ['index.js', 'lib/**/*.js'],
      reporter: ['text', 'json-summary', 'html']
    }
  }
})
