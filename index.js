'use strict'

import express from './lib/express.js'
import http from './lib/http.js'
import koa from './lib/koa.js'

const frameworks = {
  express,
  http,
  koa
}

const defaults = {
  production: process.env.NODE_ENV === 'production',
  errorPropagationMode: false,
  clientRetrySecs: 1,
  sampleInterval: 5,
  maxEventLoopDelay: 42,
  maxHeapUsedBytes: 0,
  maxRssBytes: 0,
  logging: false,
  logStatsOnReq: false
}

export default function protect (framework, opts) {
  opts = Object.assign({}, defaults, opts)
  if (typeof framework === 'undefined') {
    throw Error('Please specify a framework')
  }
  if (!(framework in frameworks)) {
    throw Error(opts.integrate + ' not supported.')
  }

  const loopDelayThreshold = typeof opts.eventLoopDelay === 'number'
    ? opts.eventLoopDelay
    : opts.maxEventLoopDelay

  if (opts.maxRssBytes <= 0 && opts.maxHeapUsedBytes <= 0 && loopDelayThreshold <= 0) {
    throw Error('At least one threshold (eventLoopDelay, maxHeapUsedBytes, maxRssBytes) should be above 0')
  }
  if (opts.logStatsOnReq && opts.logging === false) {
    throw Error('logStatsOnReq cannot be enabled unless logging is also enabled')
  }

  const maxEventLoopDelay = opts.maxEventLoopDelay
  const maxHeapUsedBytes = opts.maxHeapUsedBytes
  const maxRssBytes = opts.maxRssBytes
  const sampleInterval = opts.sampleInterval

  const profiler = {
    overload: false,
    eventLoopOverload: false,
    heapUsedOverload: false,
    rssOverload: false,
    eventLoopDelay: 0,
    maxEventLoopDelay,
    maxHeapUsedBytes,
    maxRssBytes,
    stop
  }

  let timer
  let last = process.hrtime.bigint()

  function check () {
    const now = process.hrtime.bigint()

    if (maxEventLoopDelay > 0) {
      const deltaMs = Number(now - last) / 1e6
      const delay = Math.max(0, Math.round(deltaMs - sampleInterval))
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
    if (timer) clearInterval(timer)
  }
}
