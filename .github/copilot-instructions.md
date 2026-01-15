# Copilot Instructions for overload-protection

## Project Overview
A Node.js middleware library providing load-shedding capabilities for HTTP servers. Monitors event loop delay, heap usage, and RSS memory to send 503 responses when thresholds are crossed, preventing cascading failures under heavy load.

**Critical: This is a precision library** - it deals with low-level performance metrics and timing. Code changes require exactness in:
- Threshold checking logic (off-by-one errors have production impact)
- Memory measurement sampling (timing and interval precision matters)
- Framework adapter behavior (must match framework contracts exactly)
- Test timing and cleanup (prevent flaky tests and resource leaks)

## Architecture

### Core Components
- **[index.js](../index.js)**: Main entry point - factory function that accepts framework name (`'http'`, `'express'`, `'koa'`) and options, returns framework-specific middleware/protection function
- **[lib/](../lib/)**: Framework adapters follow consistent pattern:
  - Each adapter ([http.js](../lib/http.js), [express.js](../lib/express.js), [koa.js](../lib/koa.js)) wraps profiler state with framework-specific request handling
  - All share identical options handling and threshold checking logic
  - Differ only in response/error propagation (callbacks vs promises vs middleware chaining)
- **[lib/explain.js](../lib/explain.js)**: Generates human-readable error messages indicating which threshold(s) triggered overload
- **[lib/stats.js](../lib/stats.js)**: Simple constructor for stats objects passed to loggers

### Profiler Pattern
The `profiler` object (created in [index.js](../index.js#L73-L82)) is the state container:
- Properties: `overload`, `eventLoopOverload`, `heapUsedOverload`, `rssOverload`, plus threshold values
- Updated by `loopbench` library (event loop monitoring) and periodic `checkMemory()` calls
- The returned function/middleware has `profiler` in its prototype chain, exposing state as instance properties

### Two Operating Modes
1. **Default mode** (`errorPropagationMode: false`): Middleware immediately ends response with 503, preventing further processing
2. **Error propagation mode** (`errorPropagationMode: true`): Generates error object and delegates to framework's error handling (throwing in Koa, calling `next(err)` in Express)

## Development Workflow

### Testing
```bash
npm test                # Run all tests with Vitest
npm run cov             # Coverage report
npm run covr            # HTML coverage report
```

**Vitest Configuration** ([vitest.config.js](../vitest.config.js)):
- `threads: false`, `maxThreads: 1` - tests run sequentially to avoid timing conflicts
- `testTimeout: 3000` - fail fast; tests should complete quickly or fail
- `globals: true` - `test`, `expect`, `it` available without imports
- Includes both unit tests and integration tests in same run

**Key Test Patterns**:
- Tests are Vitest-based but [test/integration/](../test/integration/) files include TAP-compatible wrapper for legacy compatibility
- Unit tests in [test/index.js](../test/index.js) verify core options, state exposure, and validation
- Integration tests per framework in `test/integration/{framework}/index.js` verify actual HTTP behavior
- Tests mock `process.memoryUsage()` and use `sleep()` loops to trigger thresholds
- **Always call `instance.stop()`** in test cleanup to prevent timer leaks and hanging tests
- **Fail fast design**: Tests use short timeouts and immediate assertions; avoid long delays or polling
- Use Promises with early resolution/rejection to catch failures immediately

### Code Style
- Standard.js linting (`npm run lint`)
- **ES Modules (ESM)**: Project uses `"type": "module"` in package.json
  - All imports/exports use ES module syntax: `import`/`export` (not `require`/`module.exports`)
  - File extensions required in imports: `import http from './lib/http.js'` (not `./lib/http`)
  - Use `export default` for main exports, named exports when appropriate
- Pre-commit hooks run tests and linting

### Benchmarks
```bash
npm run benchmarks      # Compare protected vs unprotected overhead for all frameworks
```
Located in [benchmarks/](../benchmarks/) - each has `included.js` (with protection) and `excluded.js` (without)

## Project-Specific Conventions

### Options Handling
- All options have defaults defined in [index.js](../index.js#L15-L25)
- `Object.assign({}, defaults, opts)` pattern for option merging
- Disabled thresholds use `0` value (not `null`/`undefined`)
- Validation: at least one threshold must be enabled (> 0)

### Logging Patterns
Two styles supported:
1. **Log4j-style** (string): Expects `req.log[level]` or `ctx.log[level]` (works with pino, bunyan middleware)
2. **Function**: Direct logging function (e.g., `logging: console.warn`)

### Prototype Chain Manipulation
The returned middleware function has the profiler object in its prototype chain ([index.js](../index.js#L86-L94)):
```javascript
Object.setPrototypeOf(integrate, profiler)
```
This allows accessing state via `instance.overload`, `instance.eventLoopDelay`, etc.

### Memory Monitoring
Manual memory checks (not event-driven) via `setInterval` with `unref()` to prevent blocking process exit ([index.js](../index.js#L67-L71))

## Integration Points

### External Dependencies
- **loopbench**: Event loop delay monitoring library (main dependency)
- Framework packages (express, koa) are devDependencies for testing only

### Framework Adaptation Strategy
When adding framework support:
1. Study existing adapters - they're nearly identical in structure
2. Key differences: argument signature (req/res/next vs ctx/next) and error handling
3. Maintain consistent options validation and profiler interaction

## Current Branch Context
Working on `fix/vitest` branch - migrating from TAP to Vitest. Note the TAP compatibility wrapper in integration tests to support legacy test syntax during transition.
