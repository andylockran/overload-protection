import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['test/index.js', 'test/integration/**/index.js'],
    fileParallelism: false,
    testTimeout: 5000,
    coverage: {
      provider: 'v8',
      include: ['index.js', 'lib/**/*.js'],
      reporter: ['text', 'json-summary', 'html']
    }
  }
})
