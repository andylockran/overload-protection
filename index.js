import { monitorEventLoopDelay } from 'node:perf_hooks'
import express from './lib/express.js'
import http from './lib/http.js'
import koa from './lib/koa.js'
import { nativeOverloadProtection, createNativeOverloadProtection } from './lib/native.js'

const frameworks = {
  express,
  http,
  koa,
  native: (opts) => createNativeOverloadProtection(opts)
}

const defaults = {
  production: process.env.NODE_ENV === 'production',
  errorPropagationMode: false,
  clientRetrySecs: 5,
  sampleInterval: 5,
  resolution: 5,
  maxEventLoopDelay: 42,
  maxEventLoopDelayMs: 42,
  maxHeapUsedBytes: 0,
  maxRssBytes: 0,
  logging: false,
  logStatsOnReq: false
}

export { nativeOverloadProtection, createNativeOverloadProtection }

export default function protect (framework, opts) {
  if (typeof framework === 'object' && framework !== null) {
    opts = framework
    framework = 'native'
  }
  if (typeof framework === 'undefined') {
    throw Error('Please specify a framework')
  }

  opts = Object.assign({}, defaults, opts)

  if (!(framework in frameworks)) {
    throw Error(opts.integrate + ' not supported.')
  }

  if (framework === 'native') {
    return frameworks.native(opts)
  }

  const loopDelayThreshold = typeof opts.eventLoopDelay === 'number'
    ? opts.eventLoopDelay
    : (typeof opts.maxEventLoopDelayMs === 'number' && opts.maxEventLoopDelayMs !== defaults.maxEventLoopDelayMs
        ? opts.maxEventLoopDelayMs
        : opts.maxEventLoopDelay)

  if (opts.maxRssBytes <= 0 && opts.maxHeapUsedBytes <= 0 && loopDelayThreshold <= 0) {
    throw Error('At least one threshold (eventLoopDelay, maxHeapUsedBytes, maxRssBytes) should be above 0')
  }
  if (opts.logStatsOnReq && opts.logging === false) {
    throw Error('logStatsOnReq cannot be enabled unless logging is also enabled')
  }

  const maxEventLoopDelay = loopDelayThreshold
  const maxHeapUsedBytes = opts.maxHeapUsedBytes
  const maxRssBytes = opts.maxRssBytes
  const sampleInterval = typeof opts.resolution === 'number' && opts.resolution !== defaults.resolution
    ? opts.resolution
    : opts.sampleInterval

  let eventLoopMonitor
  if (maxEventLoopDelay > 0 && typeof monitorEventLoopDelay === 'function') {
    const res = sampleInterval > 0 ? sampleInterval : 5
    eventLoopMonitor = monitorEventLoopDelay({ resolution: res })
    eventLoopMonitor.enable()
  }

  const profiler = {
    overload: false,
    eventLoopOverload: false,
    heapUsedOverload: false,
    rssOverload: false,
    eventLoopDelay: 0,
    maxEventLoopDelay,
    maxEventLoopDelayMs: maxEventLoopDelay,
    maxHeapUsedBytes,
    maxRssBytes,
    eventLoopMonitor,
    stop
  }

  let timer
  let last = process.hrtime.bigint()

  function check () {
    const now = process.hrtime.bigint()

    if (maxEventLoopDelay > 0) {
      const deltaMs = Number(now - last) / 1e6
      const timerDelay = Math.max(0, deltaMs - sampleInterval)
      let nativeLagMs = 0
      if (eventLoopMonitor) {
        nativeLagMs = eventLoopMonitor.percentile(99) / 1e6
      }
      const delay = Math.max(nativeLagMs, timerDelay)
      profiler.eventLoopDelay = delay
      profiler.eventLoopOverload = delay > maxEventLoopDelay
    }

    if (maxHeapUsedBytes > 0 || maxRssBytes > 0) {
      let heapUsed = 0
      let rss = 0
      if (maxHeapUsedBytes <= 0 && typeof process.memoryUsage.rss === 'function') {
        rss = process.memoryUsage.rss()
      } else {
        const mem = process.memoryUsage()
        heapUsed = mem.heapUsed
        rss = mem.rss
      }
      profiler.heapUsedOverload = maxHeapUsedBytes > 0 && heapUsed > maxHeapUsedBytes
      profiler.rssOverload = maxRssBytes > 0 && rss > maxRssBytes
    }

    profiler.overload = profiler.eventLoopOverload ||
      profiler.heapUsedOverload ||
      profiler.rssOverload

    last = now
  }

  if (sampleInterval > 0 && (maxEventLoopDelay > 0 || maxHeapUsedBytes > 0 || maxRssBytes > 0)) {
    timer = setInterval(check, sampleInterval)
    if (timer && typeof timer.unref === 'function') timer.unref()
  }

  const integrate = frameworks[framework](opts, profiler)
  Object.setPrototypeOf(profiler, Function.prototype)
  Object.setPrototypeOf(integrate, profiler)

  return integrate

  function stop () {
    if (eventLoopMonitor) eventLoopMonitor.disable()
    if (timer) clearInterval(timer)
  }
}
protect.nativeOverloadProtection = nativeOverloadProtection
protect.createNativeOverloadProtection = createNativeOverloadProtection
