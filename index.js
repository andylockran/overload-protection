'use strict'

import loopbench from 'loopbench'
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
  if (opts.maxRssBytes <= 0 && opts.maxHeapUsedBytes <= 0 && opts.eventLoopDelay <= 0) {
    throw Error('At least one threshold (eventLoopDelay, maxHeapUsedBytes, maxRssBytes) should be above 0')
  }
  if (opts.logStatsOnReq && opts.logging === false) {
    throw Error('logStatsOnReq cannot be enabled unless logging is also enabled')
  }
  let eventLoopProfiler
  const update = (opts.maxEventLoopDelay > 0)
    ? function update () {
      profiler.eventLoopOverload = eventLoopProfiler.overLimit
      profiler.eventLoopDelay = eventLoopProfiler.delay
      profiler.overload = profiler.eventLoopOverload ||
          profiler.heapUsedOverload ||
          profiler.rssOverload
    }
    : function update () {
      profiler.overload = profiler.heapUsedOverload || profiler.rssOverload
    }

  if (opts.maxEventLoopDelay > 0) {
    eventLoopProfiler = loopbench({
      sampleInterval: opts.sampleInterval,
      limit: opts.maxEventLoopDelay
    })

    eventLoopProfiler.on('load', update)
    eventLoopProfiler.on('unload', update)
  }

  const maxHeapUsedBytes = opts.maxHeapUsedBytes
  const maxRssBytes = opts.maxRssBytes

  let timer
  if (maxHeapUsedBytes > 0 || maxRssBytes > 0) {
    timer = setInterval(checkMemory, opts.sampleInterval)
    if (timer && typeof timer.unref === 'function') timer.unref()
  }

  const profiler = {
    overload: false,
    eventLoopOverload: false,
    heapUsedOverload: false,
    rssOverload: false,
    eventLoopDelay: 0,
    maxEventLoopDelay: opts.maxEventLoopDelay,
    maxHeapUsedBytes: opts.maxHeapUsedBytes,
    maxRssBytes: opts.maxRssBytes,
    stop: stop
  }

  const integrate = frameworks[framework](opts, profiler)
  if (Object.setPrototypeOf) {
    Object.setPrototypeOf(profiler, Function.prototype)
    Object.setPrototypeOf(integrate, profiler)
  } else {
    // eslint-disable-next-line
    profiler.__proto__ = Function.prototype
    // eslint-disable-next-line
    integrate.__proto__ = profiler
  }

  return integrate

  function checkMemory () {
    const mem = process.memoryUsage()
    const heapUsed = mem.heapUsed
    const rss = mem.rss
    profiler.heapUsedOverload = (maxHeapUsedBytes > 0 && heapUsed > maxHeapUsedBytes)
    profiler.rssOverload = (maxRssBytes > 0 && rss > maxRssBytes)
    update()
  }

  function stop () {
    if (eventLoopProfiler) eventLoopProfiler.stop()
    if (timer) clearInterval(timer)
  }
}
