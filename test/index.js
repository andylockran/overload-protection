"use strict"
import protect from '../index.js'

const { test, expect } = global

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
    const delay = 50
    const instance = protect('http')
    const start = Date.now()
    while (Date.now() - start <= delay) { Buffer.alloc(1e9) }
    setImmediate(function () {
      expect(instance.eventLoopDelay).toBeGreaterThan(delay)
      instance.stop()
      resolve()
    })
  })
})

test('instance.eventLoopOverload is true when maxEventLoopDelay threshold is breached', () => {
  return new Promise((resolve) => {
    const delay = 50
    const instance = protect('http', { sampleInterval: 5, maxEventLoopDelay: 10 })
    const start = Date.now()
    while (Date.now() - start < delay) {}
    setImmediate(function () {
      expect(instance.eventLoopOverload).toBe(true)
      instance.stop()
      resolve()
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
      }, 10)
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

if (Object.setPrototypeOf) {
  test('Supports legacy JS (__proto__)', () => {
    const setPrototypeOf = Object.setPrototypeOf
    delete Object.setPrototypeOf
    const instance = protect('http')
    // overload wouldn't be in instance if __proto__ wasn't set
    expect('overload' in instance).toBe(true)
    Object.setPrototypeOf = setPrototypeOf
  })
}

if (!Object.setPrototypeOf) {
  test('Supports modern/future JS (Object.setPrototypeOf)', () => {
    Object.setPrototypeOf = function (o, proto) { o.__proto__ = proto }
    const instance = protect('http')
    // overload wouldn't be in instance if __proto__ wasn't set
    expect('overload' in instance).toBe(true)
    delete Object.setPrototypeOf
  })
}
