import explain from './explain.js'
import OverloadProtectionStats from './stats.js'

const SERVICE_UNAVAILABLE = 'Service Unavailable'

export default function koa (opts, protect) {
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

  function overloadProtection (ctx, next) {
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
      if (log4jLogging) ctx.log && ctx.log[logging] && ctx.log[logging](stats)
      else logging(stats)
    }
    if (protect.overload === true) {
      if (sendRetryHeader) ctx.set('Retry-After', retryHeaderValue)
      if (loggingOn) {
        if (log4jLogging) ctx.log && ctx.log[logging] && ctx.log[logging](explain(protect))
        else logging(explain(protect))
      }
      const currentLagMs = protect.eventLoopDelay
      const errorDetails = {
        error: 'Service Unavailable',
        message: 'Server is currently overloaded, please try again later.',
        ...(production ? {} : { lagMs: typeof currentLagMs === 'number' ? currentLagMs.toFixed(2) : currentLagMs })
      }
      if (errorPropagationMode) {
        const err = Error(explain(protect))
        err.status = 503
        err.statusCode = 503
        err.expose = expose
        err.details = errorDetails

        // if exposing to client in dev,
        // we also want to output
        // the error in console
        if (err.expose) {
          ctx.app.emit('error', Error(explain(protect)), ctx)
        }

        throw err
      }
      ctx.status = 503

      if (opts.json || (ctx.headers && ctx.headers.accept && ctx.headers.accept.includes('application/json'))) {
        ctx.body = errorDetails
        return
      }

      ctx.res.end(production ? SERVICE_UNAVAILABLE : explain(protect))
      return
    }
    return next()
  }
}
