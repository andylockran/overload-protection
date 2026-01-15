import explain from './explain.js'
import OverloadProtectionStats from './stats.js'

export default function koa (opts, protect) {
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
      if (sendRetryHeader) ctx.set('Retry-After', clientRetrySecs)
      if (loggingOn) {
        if (log4jLogging) ctx.log && ctx.log[logging] && ctx.log[logging](explain(protect))
        else logging(explain(protect))
      }
      if (errorPropagationMode) {
        const err = Error(explain(protect))
        err.status = 503
        err.expose = expose

        // if exposing to client in dev,
        // we also want to output
        // the error in console
        if (err.expose) {
          ctx.app.emit('error', Error(explain(protect)), ctx)
        }

        throw err
      }
      ctx.status = 503

      ctx.res.end(production ? 'Service Unavailable' : explain(protect))
      return
    }
    return next()
  }
}
