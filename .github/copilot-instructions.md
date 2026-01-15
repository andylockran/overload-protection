# Copilot instructions — overload-protection

Purpose: Help an AI coding agent make productive, safe changes in this repository.

- Big picture
  - This is a small Node.js library that provides load-shedding / overload-protection middleware for `http`, `express`, `koa`, and `restify`.
  - Entrypoint: `index.js` exports `protect(framework, opts)` which selects a framework integration from `lib/` and returns an "integration" function that is also a profiler object (has properties like `overload`, `eventLoopDelay`, and `stop()`).
  - Core logic lives in `index.js` (thresholds, loopbench), and the per-framework request handling lives in `lib/http.js` and `lib/koa.js`. `express` and `restify` re-export the HTTP implementation.

- Key files to inspect for changes
  - `index.js` — orchestration, default options, framework map
  - `lib/http.js` — shared middleware behavior, logging, Retry-After and error-propagation semantics
  - `lib/koa.js` — Koa-specific flow (async/throw vs callback)
  - `lib/explain.js`, `lib/stats.js` — human-readable explanation + stats formatting
  - `test/` — integration and unit tests (uses `tap`)
  - `benchmarks/` and `demos/` — runnable examples to validate behaviour and performance

- API & patterns to follow (concrete)
  - Usage pattern: require the library, initialise per-framework, then use as middleware or call in request handlers.
    - Example (http):
      const protect = require('./index')('http', { maxEventLoopDelay: 42, clientRetrySecs: 1 })
      // in server request handler:
      if (protect(req, res)) return // request handled (503) by protector
  - The returned `protect` function has profiler properties mixed onto the integration function via prototype (see `index.js`). Tests and logging read these properties directly (`protect.overload`, `protect.stop()`).
  - At least one of `maxEventLoopDelay`, `maxHeapUsedBytes`, or `maxRssBytes` must be > 0 — otherwise `protect()` throws. Preserve that guard when refactoring.

- Options you will see and should respect
  - `maxEventLoopDelay`, `sampleInterval`, `maxHeapUsedBytes`, `maxRssBytes`
  - `clientRetrySecs` (causes `Retry-After` header when >0)
  - `logStatsOnReq`, `logging` (string => `req.log[name]` style; function => call with stats)
  - `errorPropagationMode` (when enabled the middleware will pass/throw an error instead of ending the response)

- Testing & developer workflows
  - Scripts in `package.json`:
    - `npm test` runs `tap test`
    - `npm run cov` runs `tap --cov test`
    - `npm run lint` runs `standard`
    - `npm run benchmarks` runs each file under `benchmarks/`
  - Pre-commit hooks (via `pre-commit`) run `test` and `lint`.
  - When changing request behavior, update `test/integration/*` and add a demo in `demos/` if helpful.

- Conventions and gotchas
  - `express` and `restify` use the same codepath as `http` (they `require('./http')`). Changing `lib/http.js` affects both.
  - `koa` uses a different control flow (throws vs `next()`), so test Koa-specific behaviour in `test/integration/koa` and `demos/koa`.
  - Logging can be a string (treated as a log method name on `req.log`/`ctx.log`) or a function — preserve both code paths.
  - The integration function sometimes returns a boolean (for plain `http` handlers) or uses `next()`/`throw` for frameworks; match current patterns when adding framework support.

- When adding features
  - Add the new framework key to the `frameworks` map in `index.js`.
  - Keep `checkMemory` / `loopbench` usage in `index.js` — these are the core signal sources used by all integrations.
  - Update `lib/explain.js` and `lib/stats.js` for any changes to output shape so demos and tests continue to match expected strings/objects.

- Feedback: If any of these sections lack detail you'd like (for example, more usage examples, or a fuller list of scripted test cases), tell me which area to expand.
