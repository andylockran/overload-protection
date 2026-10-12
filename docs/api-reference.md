# API & Configuration Reference

Comprehensive guide to all exports, configuration options, error formats, and framework integrations in `overload-protection`.

---

## 1. Native Express Middleware: `nativeOverloadProtection`

Direct, zero-overhead Express/Connect middleware powered by `perf_hooks.monitorEventLoopDelay`.

### Import
```javascript
import { nativeOverloadProtection } from '@andylockran/overload-protection'
// or CommonJS:
// const { nativeOverloadProtection } = require('@andylockran/overload-protection')
```

### Usage Modes

#### A. Zero-Configuration Middleware
Mount directly using built-in defaults (`42ms` limit, `Retry-After: 5s`):
```javascript
app.use(nativeOverloadProtection)
```

#### B. Configured Middleware Factory
Pass custom configuration:
```javascript
app.use(nativeOverloadProtection({
  production: process.env.NODE_ENV === 'production',
  clientRetrySecs: 5,        // Tell clients to wait 5 seconds before retrying
  maxEventLoopDelayMs: 42,   // Maximum p99 loop lag threshold in ms
  errorPropagationMode: false // false = return 503 immediately, true = pass to next(err)
}))
```

### Response Behavior (When Overloaded)
- **Status Code**: `HTTP 503 Service Unavailable`
- **Header**: `Retry-After: <clientRetrySecs>` (omitted if `clientRetrySecs: 0`)
- **Body**: Standard JSON error payload:
  ```json
  {
    "error": "Service Unavailable",
    "message": "Server is currently overloaded, please try again later.",
    "lagMs": "54.12"
  }
  ```
  *(Note: `lagMs` is automatically omitted when `production: true`)*.

---

## 2. Multi-Framework Adapter: `protect(framework, options)`

Unified interface for Express, Koa, and Node.js core `http`.

```javascript
import protect from '@andylockran/overload-protection'

// Express
const expressMiddleware = protect('express', options)
app.use(expressMiddleware)

// Koa
const koaMiddleware = protect('koa', options)
app.use(koaMiddleware)

// Core HTTP
const httpGuard = protect('http', options)
http.createServer((req, res) => {
  if (httpGuard(req, res)) return // Returns true if 503 was sent
  res.end('Hello World')
})
```

---

## 3. Configuration Options

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `production` | `boolean` | `process.env.NODE_ENV === 'production'` | When `true`, raw diagnostic metrics (such as `lagMs`) are suppressed from client responses. |
| `clientRetrySecs` | `number` | `5` | Value of the `Retry-After` response header in seconds. Set to `0` to disable the header completely. |
| `maxEventLoopDelayMs` | `number` | `42` | Threshold for maximum acceptable event loop lag (in milliseconds). Set to `0` to disable loop lag checks. |
| `maxEventLoopDelay` | `number` | `42` | Backward-compatible alias for `maxEventLoopDelayMs`. |
| `resolution` | `number` | `5` | Granularity (in milliseconds) for the native `monitorEventLoopDelay` sampling histogram. |
| `sampleInterval` | `number` | `5` | Backward-compatible alias for `resolution`. |
| `maxHeapUsedBytes` | `number` | `0` (disabled) | V8 heap used threshold in bytes (`process.memoryUsage().heapUsed`). |
| `maxRssBytes` | `number` | `0` (disabled) | Resident Set Size threshold in bytes (`process.memoryUsage().rss()`). |
| `errorPropagationMode` | `boolean` | `false` | When `false`, returns HTTP 503 directly. When `true`, passes an Error object to `next(err)` or throws in Koa. |
| `json` | `boolean` | `false` | When `true`, always formats 503 responses as JSON (automatically enabled if request includes `Accept: application/json` or when using `nativeOverloadProtection`). |
| `logging` | `string \| function \| false` | `false` | String level for log4j-style request logger (e.g. `'warn'`), or custom logging callback function. |
| `logStatsOnReq` | `boolean` | `false` | Logs profiled stats on every single request (requires `logging` to be configured). |

---

## 4. Error Propagation Mode (`errorPropagationMode: true`)

When `errorPropagationMode: true`, `overload-protection` defers response handling to your framework's centralized error handler:

```javascript
app.use(nativeOverloadProtection({ errorPropagationMode: true }))

// Standard Express error middleware
app.use((err, req, res, next) => {
  console.error('Overload detected:', err.details)
  res.status(err.status || 503).json(err.details)
})
```

### Generated Error Object Properties
- `err.message`: `'Server Overloaded'`
- `err.status`: `503`
- `err.statusCode`: `503`
- `err.expose`: `!production` (`true` in development, `false` in production)
- `err.details`:
  ```javascript
  {
    error: 'Service Unavailable',
    message: 'Server is currently overloaded, please try again later.',
    lagMs: '58.40' // in dev mode only
  }
  ```

---

## 5. Lifecycle & Clean Shutdown

When shutting down or running unit tests, invoke `.stop()` on the middleware instance to disable the native histogram and clear any active timers:

```javascript
const protect = nativeOverloadProtection({ maxEventLoopDelayMs: 42 })

// During graceful shutdown:
process.on('SIGTERM', () => {
  protect.stop()
  server.close()
})
```
