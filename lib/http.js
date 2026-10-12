import explain from './explain.js'
import OverloadProtectionStats from './stats.js'

const SERVICE_UNAVAILABLE = 'Service Unavailable'

export default function http (opts, protect) {
  const clientRetrySecs = opts.clientRetrySecs
  const sendRetryHeader = clientRetrySecs > 0
  const retryHeaderValue = sendRetryHeader ? String(clientRetrySecs) : ''
  const logStatsOnReq = opts.logStatsOnReq
  const logging = opts.logging
  const loggingOn = typeof logging === 'string' || typeof logging === 'function'
  const log4jLogging = typeof logging === 'string'
  const errorPropagationMode = opts.errorPropagationMode
  const production = opts.production
  const expose = !production

  return overloadProtection

  function overloadProtection (req, res, next) {
    if (logStatsOnReq) {
      const stats = new OverloadProtectionStats(
        protect.overload,
        protect.eventLoopOverload,
        protect.heapUsedOverload,
        protect.rssOverload,
        protect.eventLoopDelay,
        protect.maxEventLoopDelay,
        protect.maxHeapUsedBytes,
        protect.maxRssBytes
      )
      if (log4jLogging) req.log && req.log[logging] && req.log[logging](stats)
      else logging(stats)
    }
    if (protect.overload === true) {
      res.statusCode = 503
      if (sendRetryHeader) res.setHeader('Retry-After', retryHeaderValue)
      if (loggingOn) {
        if (log4jLogging) req.log && req.log[logging] && req.log[logging](explain(protect))
        else logging(explain(protect))
      }
      const currentLagMs = protect.eventLoopDelay
      const errorDetails = {
        error: 'Service Unavailable',
        message: 'Server is currently overloaded, please try again later.',
        ...(production ? {} : { lagMs: typeof currentLagMs === 'number' ? currentLagMs.toFixed(2) : currentLagMs })
      }
      if (errorPropagationMode && typeof next === 'function') {
        const err = Error(explain(protect))
        err.expose = expose
        err.statusCode = 503
        err.status = 503
        err.details = errorDetails
        next(err)
        return
      }

      if (opts.json || (req.headers && req.headers.accept && req.headers.accept.includes('application/json'))) {
        if (typeof res.status === 'function' && typeof res.json === 'function') {
          return res.status(503).json(errorDetails)
        }
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify(errorDetails))
        if (arguments.length < 3) return true
        else return
      }

      res.end(production ? SERVICE_UNAVAILABLE : explain(protect))

      if (arguments.length < 3) return true
      else return
    }
    if (arguments.length >= 3 && typeof next === 'function') next()
    else return false
  }
}
