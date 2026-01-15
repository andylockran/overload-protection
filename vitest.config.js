import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['test/index.js', 'test/integration/**/index.js'],
    threads: false,
    maxThreads: 1,
    testTimeout: 120000
  }
})
