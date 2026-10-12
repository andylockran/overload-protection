'use strict'

import { monitorEventLoopDelay } from 'node:perf_hooks'

export function createNativeOverloadProtection (options = {}) {
  const config = {
    production: process.env.NODE_ENV === 'production',
    clientRetrySecs: 5,
    maxEventLoopDelayMs: 42,
    errorPropagationMode: false,
    resolution: 5,
    ...options
  }

  if (typeof config.maxEventLoopDelay === 'number' && typeof options.maxEventLoopDelayMs !== 'number') {
    config.maxEventLoopDelayMs = config.maxEventLoopDelay
  }
  if (typeof config.sampleInterval === 'number' && typeof options.resolution !== 'number') {
    config.resolution = config.sampleInterval
  }

  const eventLoopMonitor = monitorEventLoopDelay({ resolution: config.resolution })
  eventLoopMonitor.enable()

  function middleware (req, res, next) {
    const currentLagMs = eventLoopMonitor.percentile(99) / 1e6

    if (currentLagMs > config.maxEventLoopDelayMs) {
      const errorDetails = {
        error: 'Service Unavailable',
        message: 'Server is currently overloaded, please try again later.',
        ...(config.production ? {} : { lagMs: currentLagMs.toFixed(2) })
      }

      if (config.errorPropagationMode) {
        const err = new Error('Server Overloaded')
        err.status = 503
        err.statusCode = 503
        err.details = errorDetails
        err.expose = !config.production
        return next(err)
      }

      if (config.clientRetrySecs > 0) {
        if (typeof res.set === 'function') {
          res.set('Retry-After', config.clientRetrySecs.toString())
        } else if (typeof res.setHeader === 'function') {
          res.setHeader('Retry-After', config.clientRetrySecs.toString())
        }
      }

      if (typeof res.status === 'function' && typeof res.json === 'function') {
        return res.status(503).json(errorDetails)
      }

      res.statusCode = 503
      if (typeof res.setHeader === 'function') {
        res.setHeader('Content-Type', 'application/json')
      }
      return res.end(JSON.stringify(errorDetails))
    }

    if (typeof next === 'function') {
      next()
    }
  }

  middleware.stop = function stop () {
    eventLoopMonitor.disable()
  }

  middleware.eventLoopMonitor = eventLoopMonitor
  middleware.maxEventLoopDelayMs = config.maxEventLoopDelayMs
  middleware.maxEventLoopDelay = config.maxEventLoopDelayMs
  middleware.clientRetrySecs = config.clientRetrySecs

  Object.defineProperty(middleware, 'eventLoopDelay', {
    get () {
      return eventLoopMonitor.percentile(99) / 1e6
    }
  })

  Object.defineProperty(middleware, 'overload', {
    get () {
      return (eventLoopMonitor.percentile(99) / 1e6) > config.maxEventLoopDelayMs
    }
  })

  Object.defineProperty(middleware, 'eventLoopOverload', {
    get () {
      return (eventLoopMonitor.percentile(99) / 1e6) > config.maxEventLoopDelayMs
    }
  })

  return middleware
}

let defaultInstance = null

export function nativeOverloadProtection (req, res, next) {
  if (req && res && typeof next === 'function') {
    if (!defaultInstance) {
      defaultInstance = createNativeOverloadProtection()
    }
    return defaultInstance(req, res, next)
  }
  return createNativeOverloadProtection(req || {})
}

nativeOverloadProtection.stop = function stop () {
  if (defaultInstance) defaultInstance.stop()
}

Object.defineProperty(nativeOverloadProtection, 'eventLoopMonitor', {
  get () {
    if (!defaultInstance) defaultInstance = createNativeOverloadProtection()
    return defaultInstance.eventLoopMonitor
  }
})

Object.defineProperty(nativeOverloadProtection, 'eventLoopDelay', {
  get () {
    if (!defaultInstance) defaultInstance = createNativeOverloadProtection()
    return defaultInstance.eventLoopDelay
  }
})

Object.defineProperty(nativeOverloadProtection, 'overload', {
  get () {
    if (!defaultInstance) defaultInstance = createNativeOverloadProtection()
    return defaultInstance.overload
  }
})

Object.defineProperty(nativeOverloadProtection, 'eventLoopOverload', {
  get () {
    if (!defaultInstance) defaultInstance = createNativeOverloadProtection()
    return defaultInstance.eventLoopOverload
  }
})

export default nativeOverloadProtection
