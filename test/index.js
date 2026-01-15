/**
 * Test suite for overload-protection module functionality.
 *
 * This test file verifies the core behavior of the overload protection system including:
 * - Framework validation and configuration error handling
 * - Sampling interval management and cleanup
 * - Event loop delay monitoring and threshold detection
 * - Memory usage tracking (heap and RSS) with configurable thresholds
 * - Overload state detection across multiple metrics
 * - Backward compatibility with legacy JavaScript prototype mechanisms
 *
 * Common test failure causes:
 * - Timing-sensitive tests may fail on slow/busy systems due to setTimeout/setImmediate delays
 * - Event loop delay tests depend on actual CPU load and may be flaky in CI environments
 * - Memory mocking tests require process.memoryUsage to be properly restored after each test
 * - Tests using global.setInterval/clearInterval mocks must ensure proper cleanup
 * - Race conditions in async tests where instance.stop() is called before state updates
 *
 * To debug failures:
 * 1. Check if timing thresholds need adjustment for your environment
 * 2. Verify that mocked globals (setInterval, clearInterval, memoryUsage) are restored
 * 3. Increase setTimeout delays if tests are flaky
 * 4. Run tests in isolation to identify interdependencies
 * 5. Check for unhandled promise rejections or missing resolve/reject calls
 */
'use strict'
import protect from '../index.js'

test('throws if framework is unspecified', () => {
  expect(() => protect()).toThrow()
})

test('throws if framework is not supported', () => {
  expect(() => protect('not a thing')).toThrow()
})

test('throws if all thresholds are disabled (set to 0)', () => {
  expect(() => protect('http', {
    eventLoopDelay: 0,
    maxRssBytes: 0,
    maxHeapUsedBytes: 0
  })).toThrow()
})

test('throws if logStatsOnReq is true but logging is false', () => {
  expect(() => protect('http', { logStatsOnReq: true })).toThrow()
})

test('instance.stop ceases sampling', () => {
  return new Promise((resolve) => {
    const sI = global.setInterval
    const cI = global.clearInterval
    const mock = { unref: function () { return mock } }
    global.setInterval = function () { return mock }
    global.clearInterval = function (ref) {
      expect(ref).toBe(mock)
      global.setInterval = sI
      global.clearInterval = cI
      resolve()
    }
    const instance = protect('http')
    instance.stop()
  })
})

test('sampleInterval option sets the sample rate', () => {
  return new Promise((resolve) => {
    const sI = global.setInterval
    const cI = global.clearInterval
    const sampleRate = 88
    const mock = { unref: function () { return mock } }
    global.setInterval = function (fn, n) {
      expect(n).toBe(sampleRate)
      return mock
    }
    global.clearInterval = function (ref) {
      expect(ref).toBe(mock)
      global.setInterval = sI
      global.clearInterval = cI
      resolve()
    }
    const instance = protect('http', { sampleInterval: sampleRate })
    instance.stop()
  })
})

test('exposes maxEventLoopDelay option on instance', () => {
  const value = 9999
  const instance = protect('http', { maxEventLoopDelay: value })
  expect(instance.maxEventLoopDelay).toBe(value)
  instance.stop()
})

test('exposes maxHeapUsedBytes option on instance', () => {
  const value = 9999
  const instance = protect('http', { maxHeapUsedBytes: value })
  expect(instance.maxHeapUsedBytes).toBe(value)
  instance.stop()
})

test('exposes maxRssBytes option on instance', () => {
  const value = 9999
  const instance = protect('http', { maxRssBytes: value })
  expect(instance.maxRssBytes).toBe(value)
  instance.stop()
})

test('instance.eventLoopDelay indicates the delay between samples', () => {
  return new Promise((resolve) => {
    const busyMs = 150
    const instance = protect('http', { sampleInterval: 5 })
    const start = Date.now()
    // Heavy CPU work - nested loops with string operations to block event loop
    while (Date.now() - start <= busyMs) {
      let hash = 0
      for (let i = 0; i < 100000; i++) {
        for (let j = 0; j < 10; j++) {
          hash = ((hash << 5) - hash) + i * j
          hash = hash & hash
        }
      }
    }
    // Check on the very next event loop tick after busy-wait completes
    setImmediate(function () {
      setImmediate(function () {
        expect(instance.eventLoopDelay).toBeGreaterThan(10)
        instance.stop()
        resolve()
      })
    })
  })
})

test('instance.eventLoopOverload is true when maxEventLoopDelay threshold is breached', () => {
  return new Promise((resolve) => {
    const busyMs = 150
    const instance = protect('http', { sampleInterval: 5, maxEventLoopDelay: 10 })
    const start = Date.now()
    // Heavy CPU work - nested loops with string operations to block event loop
    while (Date.now() - start < busyMs) {
      let hash = 0
      for (let i = 0; i < 100000; i++) {
        for (let j = 0; j < 10; j++) {
          hash = ((hash << 5) - hash) + i * j
          hash = hash & hash
        }
      }
    }
    // Check on the very next event loop tick to catch the overload state
    setImmediate(function () {
      setImmediate(function () {
        expect(instance.eventLoopOverload).toBe(true)
        instance.stop()
        resolve()
      })
    })
  })
})

test('instance.eventLoopOverload is false when returning under maxEventLoopDelay threshold', () => {
  return new Promise((resolve) => {
    const delay = 50
    const instance = protect('http', { sampleInterval: 5, maxEventLoopDelay: 10 })
    const start = Date.now()
    while (Date.now() - start < delay) {}
    setImmediate(function () {
      setTimeout(function () {
        expect(instance.eventLoopOverload).toBe(false)
        instance.stop()
        resolve()
      }, 50)
    })
  })
})

test('instance.eventLoopOverload is always false when maxEventLoopDelay is 0 (maxHeapUsedBytes enabled)', () => {
  return new Promise((resolve) => {
    const delay = 50
    const instance = protect('http', { sampleInterval: 5, maxEventLoopDelay: 0, maxHeapUsedBytes: 10 })
    const start = Date.now()
    while (Date.now() - start < delay) {}
    setImmediate(function () {
      expect(instance.eventLoopOverload).toBe(false)
      instance.stop()
      resolve()
    })
  })
})

test('instance.eventLoopOverload is always false when maxEventLoopDelay is 0 (maxRssBytes enabled)', () => {
  return new Promise((resolve) => {
    const delay = 50
    const instance = protect('http', { sampleInterval: 5, maxEventLoopDelay: 0, maxRssBytes: 10 })
    const start = Date.now()
    while (Date.now() - start < delay) {}
    setImmediate(function () {
      expect(instance.eventLoopOverload).toBe(false)
      instance.stop()
      resolve()
    })
  })
})

test('instance.overload is true if instance.eventLoopOverload is true', () => {
  return new Promise((resolve) => {
    const delay = 50
    const instance = protect('http', { sampleInterval: 5, maxEventLoopDelay: 1 })
    const start = Date.now()
    while (Date.now() - start < delay) {}
    setImmediate(function () {
      expect(instance.eventLoopOverload).toBe(true)
      expect(instance.overload).toBe(instance.eventLoopOverload)
      instance.stop()
      resolve()
    })
  })
})

test('instance.heapUsedOverload is true when maxHeapUsedBytes threshold is breached', () => {
  return new Promise((resolve) => {
    const memoryUsage = process.memoryUsage
    process.memoryUsage = function () {
      return { rss: 99999, heapTotal: 9999, heapUsed: 999, external: 99 }
    }
    const instance = protect('http', { sampleInterval: 5, maxHeapUsedBytes: 10 })
    setTimeout(function () {
      expect(instance.heapUsedOverload).toBe(true)
      process.memoryUsage = memoryUsage
      instance.stop()
      resolve()
    }, 6)
  })
})

test('instance.heapUsedOverload is false when returning under maxHeapUsedBytes threshold', () => {
  return new Promise((resolve) => {
    const memoryUsage = process.memoryUsage
    process.memoryUsage = function () {
      return { rss: 99999, heapTotal: 9999, heapUsed: 999, external: 99 }
    }
    const instance = protect('http', { sampleInterval: 5, maxHeapUsedBytes: 10 })
    setTimeout(function () {
      process.memoryUsage = function () {
        return { rss: 99999, heapTotal: 9999, heapUsed: 2, external: 99 }
      }
      setTimeout(function () {
        expect(instance.heapUsedOverload).toBe(false)
        process.memoryUsage = memoryUsage
        instance.stop()
        resolve()
      }, 6)
    }, 6)
  })
})

test('instance.heapUsedOverload is always false when maxHeapUsedBytes is 0', () => {
  return new Promise((resolve) => {
    const memoryUsage = process.memoryUsage
    process.memoryUsage = function () {
      return { rss: 99999, heapTotal: 9999, heapUsed: 999, external: 99 }
    }
    const instance = protect('http', { sampleInterval: 5, maxHeapUsedBytes: 0 })
    setTimeout(function () {
      expect(instance.heapUsedOverload).toBe(false)
      process.memoryUsage = memoryUsage
      instance.stop()
      resolve()
    }, 6)
  })
})

test('instance.overload is true if instance.heapUsedOverload is true', () => {
  return new Promise((resolve) => {
    const memoryUsage = process.memoryUsage
    process.memoryUsage = function () {
      return { rss: 99999, heapTotal: 9999, heapUsed: 999, external: 99 }
    }
    const instance = protect('http', { sampleInterval: 5, maxHeapUsedBytes: 10 })
    setTimeout(function () {
      expect(instance.heapUsedOverload).toBe(true)
      expect(instance.overload).toBe(instance.heapUsedOverload)
      instance.stop()
      process.memoryUsage = memoryUsage
      resolve()
    }, 6)
  })
})

test('instance.rssOverload is true when maxRssBytes threshold is breached', () => {
  return new Promise((resolve) => {
    const memoryUsage = process.memoryUsage
    process.memoryUsage = function () {
      return { rss: 99999, heapTotal: 9999, heapUsed: 999, external: 99 }
    }
    const instance = protect('http', { sampleInterval: 5, maxRssBytes: 10 })
    setTimeout(function () {
      expect(instance.rssOverload).toBe(true)
      process.memoryUsage = memoryUsage
      instance.stop()
      resolve()
    }, 6)
  })
})

test('instance.rssOverload is false when returning under maxRssBytes threshold', () => {
  return new Promise((resolve) => {
    const memoryUsage = process.memoryUsage
    process.memoryUsage = function () {
      return { rss: 99999, heapTotal: 9999, heapUsed: 999, external: 99 }
    }
    const instance = protect('http', { sampleInterval: 5, maxHeapUsedBytes: 10 })
    setTimeout(function () {
      process.memoryUsage = function () { return { rss: 2, heapTotal: 9999, heapUsed: 2, external: 99 } }
      setTimeout(function () {
        expect(instance.rssOverload).toBe(false)
        instance.stop()
        process.memoryUsage = memoryUsage
        resolve()
      }, 6)
    }, 6)
  })
})

test('instance.rssOverload is always false when maxRssBytes is 0', () => {
  return new Promise((resolve) => {
    const memoryUsage = process.memoryUsage
    process.memoryUsage = function () { return { rss: 99999, heapTotal: 9999, heapUsed: 999, external: 99 } }
    const instance = protect('http', { sampleInterval: 5, maxRssBytes: 0 })
    setTimeout(function () {
      expect(instance.rssOverload).toBe(false)
      instance.stop()
      process.memoryUsage = memoryUsage
      resolve()
    }, 6)
  })
})

test('instance.overload is true if instance.rssOverload is true', () => {
  return new Promise((resolve) => {
    const memoryUsage = process.memoryUsage
    process.memoryUsage = function () { return { rss: 99999, heapTotal: 9999, heapUsed: 999, external: 99 } }
    const instance = protect('http', { sampleInterval: 5, maxRssBytes: 10 })
    setTimeout(function () {
      expect(instance.rssOverload).toBe(true)
      expect(instance.overload).toBe(instance.rssOverload)
      instance.stop()
      process.memoryUsage = memoryUsage
      resolve()
    }, 6)
  })
})

test('Exposes profiler state via prototype chain', () => {
  const instance = protect('http')
  // Verify prototype chain allows access to profiler properties
  expect('overload' in instance).toBe(true)
  expect('eventLoopOverload' in instance).toBe(true)
  expect('heapUsedOverload' in instance).toBe(true)
  expect('rssOverload' in instance).toBe(true)
  instance.stop()
})
