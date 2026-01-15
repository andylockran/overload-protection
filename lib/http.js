import explain from './explain.js'
import OverloadProtectionStats from './stats.js'

export default function http (opts, protect) {
  const clientRetrySecs = opts.clientRetrySecs
  const sendRetryHeader = clientRetrySecs > 0
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
      if (sendRetryHeader) res.setHeader('Retry-After', clientRetrySecs)
      if (loggingOn) {
        if (log4jLogging) req.log && req.log[logging] && req.log[logging](explain(protect))
        else logging(explain(protect))
      }
      if (errorPropagationMode && typeof next === 'function') {
        const err = Error(explain(protect))
        err.expose = expose
        err.statusCode = 503
        next(err)
        return
      }

      res.end(production ? 'Service Unavailable' : explain(protect))

      if (arguments.length < 3) return true
      else return
    }
    if (arguments.length >= 3 && typeof next === 'function') next()
    else return false
  }
}
