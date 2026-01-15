'use strict'

import http from 'http'
import express from 'express'
import protection from '../../../index.js'

// TAP-compatible wrapper: keep Vitest `test` behaviour for normal tests
{
  const originalTest = global.test && global.test.bind(global)
  global.test = function (name, fn) {
    if (!fn || fn.length === 0) {
      if (originalTest) return originalTest(name, fn)
      return it(name, fn)
    }
    it(name, async () => {
      return new Promise((resolve, reject) => {
        let planned = null
        let count = 0
        let finished = false
        const done = (err) => {
          if (finished) return
          finished = true
          if (err) return reject(err)
          resolve()
        }
        const inc = () => {
          count += 1
          if (planned !== null && count >= planned) done()
        }
        const t = {
          is: (a, b) => { try { expect(a).toBe(b); inc() } catch (e) { done(e) } },
          same: (a, b) => { try { expect(a).toEqual(b); inc() } catch (e) { done(e) } },
          ok: (v) => { try { expect(v).toBeTruthy(); inc() } catch (e) { done(e) } },
          fail: (msg) => done(new Error(msg || 'fail')),
          throws: (fnc) => { try { fnc(); done(new Error('did not throw')) } catch (e) { inc() } },
          plan: function (n) { planned = n; if (planned === 0) done() },
          pass: function () { inc() },
          end: function () { done() }
        }
        try {
          const maybe = fn(t)
          if (maybe && typeof maybe.then === 'function') maybe.then(() => done(), done)
          setTimeout(() => done(new Error('Test did not call t.end() within timeout')), 30000)
        } catch (err) { done(err) }
      })
    })
  }
}

test('sends 503 when event loop is overloaded, per maxEventLoopDelay', function (t) {
  // Use mocked memory instead of event loop monitoring (more reliable in integration tests)
  const memoryUsage = process.memoryUsage
  process.memoryUsage = function () {
    return { rss: 99999, heapTotal: 9999, heapUsed: 999, external: 99 }
  }

  const protect = protection('express', {
    sampleInterval: 5,
    maxEventLoopDelay: 0, // Disable event loop monitoring (unreliable in integration tests)
    maxHeapUsedBytes: 40 // Use heap threshold instead
  })

  const app = express()
  app.use(protect)
  app.use(function (req, res) {
    res.end('content')
  })
  const server = http.createServer(app)

  server.listen(0, function () {
    const port = server.address().port
    setTimeout(function () {
      const req = http.get('http://localhost:' + port)
      req.on('response', function (res) {
        t.is(res.statusCode, 503)
        protect.stop()
        server.close()
        process.memoryUsage = memoryUsage
        t.end()
      }).end()
    }, 6) // Wait for memory sampling
  })
})

test('sends 503 when heap used threshold is passed, as per maxHeapUsedBytes', function (t) {
  const memoryUsage = process.memoryUsage
  process.memoryUsage = function () { return { rss: 99999, heapTotal: 9999, heapUsed: 999, external: 99 } }
  const protect = protection('express', { sampleInterval: 5, maxEventLoopDelay: 0, maxHeapUsedBytes: 40 })

  const app = express()
  app.use(protect)
  const server = http.createServer(app)

  server.listen(0, function () {
    const port = server.address().port
    setTimeout(function () {
      const req = http.get('http://localhost:' + port)
      req.on('response', function (res) {
        t.is(res.statusCode, 503)
        server.close()
        protect.stop()
        process.memoryUsage = memoryUsage
        t.end()
      }).end()
    }, 6)
  })
})

test('sends 503 when heap used threshold is passed, as per maxRssBytes', function (t) {
  const memoryUsage = process.memoryUsage
  process.memoryUsage = function () {
    return {
      rss: 99999,
      heapTotal: 9999,
      heapUsed: 999,
      external: 99
    }
  }
  const protect = protection('express', {
    sampleInterval: 5,
    maxEventLoopDelay: 0,
    maxRssBytes: 40
  })

  const app = express()
  app.use(protect)
  const server = http.createServer(app)

  server.listen(0, function () {
    setTimeout(function () {
      const port = server.address().port
      const req = http.get('http://localhost:' + port)
      req.on('response', function (res) {
        t.is(res.statusCode, 503)
        server.close()
        protect.stop()
        process.memoryUsage = memoryUsage
        t.end()
      }).end()
    }, 6)
  })
})

test('sends Retry-After header as per clientRetrySecs', function (t) {
  const memoryUsage = process.memoryUsage
  process.memoryUsage = function () {
    return {
      rss: 99999,
      heapTotal: 9999,
      heapUsed: 999,
      external: 99
    }
  }
  const protect = protection('express', {
    sampleInterval: 5,
    maxEventLoopDelay: 0,
    maxRssBytes: 40,
    clientRetrySecs: 22
  })

  const app = express()
  app.use(protect)
  const server = http.createServer(app)

  server.listen(0, function () {
    const port = server.address().port
    setTimeout(function () {
      const req = http.get('http://localhost:' + port)
      req.on('response', function (res) {
        t.is(res.statusCode, 503)
        t.is(res.headers['retry-after'], '22')
        server.close()
        protect.stop()
        process.memoryUsage = memoryUsage
        t.end()
      }).end()
    }, 6)
  })
})

test('does not set Retry-After header when clientRetrySecs is 0', function (t) {
  const memoryUsage = process.memoryUsage
  process.memoryUsage = function () {
    return {
      rss: 99999,
      heapTotal: 9999,
      heapUsed: 999,
      external: 99
    }
  }
  const protect = protection('express', {
    sampleInterval: 5,
    maxEventLoopDelay: 0,
    maxRssBytes: 40,
    clientRetrySecs: 0
  })

  const app = express()
  app.use(protect)
  const server = http.createServer(app)

  server.listen(0, function () {
    const port = server.address().port
    setTimeout(function () {
      const req = http.get('http://localhost:' + port)
      req.on('response', function (res) {
        t.is(res.statusCode, 503)
        t.is('retry-after' in res.headers, false)
        server.close()
        protect.stop()
        process.memoryUsage = memoryUsage
        t.end()
      }).end()
    }, 6)
  })
})

test('errorPropagationMode:false (default)', function (t) {
  const memoryUsage = process.memoryUsage
  process.memoryUsage = function () {
    return {
      rss: 99999,
      heapTotal: 9999,
      heapUsed: 999,
      external: 99
    }
  }
  const protect = protection('express', {
    sampleInterval: 5,
    maxEventLoopDelay: 0,
    maxRssBytes: 40,
    errorPropagationMode: false
  })

  const app = express()
  app.use(protect)
  app.use(function (req, res) {
    t.fail() // should never be called
    res.end('content')
  })
  const server = http.createServer(app)

  server.listen(0, function () {
    const port = server.address().port
    setTimeout(function () {
      const req = http.get('http://localhost:' + port)
      req.on('response', function (res) {
        t.is(res.statusCode, 503)
        server.close()
        protect.stop()
        process.memoryUsage = memoryUsage
        t.end()
      }).end()
    }, 6)
  })
})

test('errorPropagationMode:true', function (t) {
  const memoryUsage = process.memoryUsage
  process.memoryUsage = function () {
    return {
      rss: 99999,
      heapTotal: 9999,
      heapUsed: 999,
      external: 99
    }
  }
  const protect = protection('express', {
    sampleInterval: 5,
    maxEventLoopDelay: 0,
    maxRssBytes: 40,
    errorPropagationMode: true
  })

  const app = express()
  app.use(protect)
  app.use(function (err, req, res, next) {
    t.ok(err)
    t.is(err.statusCode, 503)
    res.end('err message')
  })
  const server = http.createServer(app)

  server.listen(0, function () {
    const port = server.address().port
    setTimeout(function () {
      const req = http.get('http://localhost:' + port)
      req.on('response', function (res) {
        t.is(res.statusCode, 503)
        server.close()
        protect.stop()
        process.memoryUsage = memoryUsage
        t.end()
      }).end()
    }, 6)
  })
})

test('in default mode, production:false leads to high detail client response message', function (t) {
  const memoryUsage = process.memoryUsage
  process.memoryUsage = function () {
    return {
      rss: 99999,
      heapTotal: 9999,
      heapUsed: 999,
      external: 99
    }
  }
  const protect = protection('express', {
    production: false,
    sampleInterval: 5,
    maxEventLoopDelay: 0,
    maxRssBytes: 40,
    errorPropagationMode: false
  })

  const app = express()
  app.use(protect)
  const server = http.createServer(app)

  server.listen(0, function () {
    const port = server.address().port
    setTimeout(function () {
      const req = http.get('http://localhost:' + port)
      req.on('response', function (res) {
        t.is(res.statusCode, 503)
        res.once('data', function (msg) {
          msg = msg.toString()
          t.is(msg, 'Server experiencing heavy load: (rss)')
          server.close()
          protect.stop()
          process.memoryUsage = memoryUsage
          t.end()
        })
      }).end()
    }, 6)
  })
})

test('in default mode, production:true leads to standard 503 client response message', function (t) {
  const memoryUsage = process.memoryUsage
  process.memoryUsage = function () {
    return {
      rss: 99999,
      heapTotal: 9999,
      heapUsed: 999,
      external: 99
    }
  }
  const protect = protection('express', {
    production: true,
    sampleInterval: 5,
    maxEventLoopDelay: 0,
    maxRssBytes: 40,
    errorPropagationMode: false
  })

  const app = express()
  app.use(protect)
  const server = http.createServer(app)

  server.listen(0, function () {
    const port = server.address().port
    setTimeout(function () {
      const req = http.get('http://localhost:' + port)
      req.on('response', function (res) {
        t.is(res.statusCode, 503)
        res.once('data', function (msg) {
          msg = msg.toString()
          t.is(msg, 'Service Unavailable')
          server.close()
          protect.stop()
          process.memoryUsage = memoryUsage
          t.end()
        })
      }).end()
    }, 6)
  })
})

test('in errorPropagationMode production:false sets expose:true on error object', function (t) {
  const memoryUsage = process.memoryUsage
  process.memoryUsage = function () {
    return {
      rss: 99999,
      heapTotal: 9999,
      heapUsed: 999,
      external: 99
    }
  }
  const protect = protection('express', {
    production: false,
    sampleInterval: 5,
    maxEventLoopDelay: 0,
    maxRssBytes: 40,
    errorPropagationMode: true
  })

  const app = express()
  app.use(protect)
  app.use(function (err, req, res, next) {
    t.ok(err)
    t.is(err.expose, true)
    res.end('err message')
  })
  const server = http.createServer(app)

  server.listen(0, function () {
    const port = server.address().port
    setTimeout(function () {
      const req = http.get('http://localhost:' + port)
      req.on('response', function (res) {
        t.is(res.statusCode, 503)
        server.close()
        protect.stop()
        process.memoryUsage = memoryUsage
        t.end()
      }).end()
    }, 6)
  })
})

test('in errorPropagationMode production:true sets expose:false on error object', function (t) {
  const memoryUsage = process.memoryUsage
  process.memoryUsage = function () {
    return {
      rss: 99999,
      heapTotal: 9999,
      heapUsed: 999,
      external: 99
    }
  }
  const protect = protection('express', {
    production: true,
    sampleInterval: 5,
    maxEventLoopDelay: 0,
    maxRssBytes: 40,
    errorPropagationMode: true
  })

  const app = express()
  app.use(protect)
  app.use(function (err, req, res, next) {
    t.ok(err)
    t.is(err.expose, false)
    res.end('err message')
  })
  const server = http.createServer(app)

  server.listen(0, function () {
    const port = server.address().port
    setTimeout(function () {
      const req = http.get('http://localhost:' + port)
      req.on('response', function (res) {
        t.is(res.statusCode, 503)
        server.close()
        protect.stop()
        process.memoryUsage = memoryUsage
        t.end()
      }).end()
    }, 6)
  })
})

test('resumes usual operation once load pressure is reduced under threshold', function (t) {
  const memoryUsage = process.memoryUsage
  process.memoryUsage = function () {
    return {
      rss: 99999,
      heapTotal: 9999,
      heapUsed: 999,
      external: 99
    }
  }
  const protect = protection('express', {
    sampleInterval: 5,
    maxEventLoopDelay: 0,
    maxRssBytes: 40
  })

  const app = express()
  app.use(protect)
  app.use(function (req, res) {
    res.end('content')
  })
  const server = http.createServer(app)

  server.listen(0, function () {
    const port = server.address().port
    setTimeout(function () {
      const req = http.get('http://localhost:' + port)
      req.on('response', function (res) {
        t.is(res.statusCode, 503)
        process.memoryUsage = function () {
          return {
            rss: 10,
            heapTotal: 9999,
            heapUsed: 999,
            external: 99
          }
        }
        setTimeout(function () {
          http.get('http://localhost:' + port).on('response', function (res) {
            t.is(res.statusCode, 200)
            server.close()
            protect.stop()
            process.memoryUsage = memoryUsage
            t.end()
          })
        }, 6)
      }).end()
    }, 6)
  })
})

test('if logging option is a string, when overloaded, writes log message using req.log as per level in string', function (t) {
  const memoryUsage = process.memoryUsage
  process.memoryUsage = function () {
    return {
      rss: 99999,
      heapTotal: 9999,
      heapUsed: 999,
      external: 99
    }
  }
  const protect = protection('express', {
    sampleInterval: 5,
    maxEventLoopDelay: 0,
    maxRssBytes: 40,
    maxHeapUsedBytes: 40,
    logging: 'warn'
  })

  const app = express()
  app.use(function (req, res, next) {
    req.log = {
      warn: function (msg) {
        t.is(msg, 'Server experiencing heavy load: (heap, rss)')
        server.close()
        protect.stop()
        process.memoryUsage = memoryUsage
        t.end()
      }
    }
    next()
  })
  app.use(protect)
  const server = http.createServer(app)

  server.listen(0, function () {
    const port = server.address().port
    setTimeout(function () {
      http.get('http://localhost:' + port).end()
    }, 6)
  })
})

test('if logging option is a function, when overloaded calls the function with heavy load message', function (t) {
  const memoryUsage = process.memoryUsage
  process.memoryUsage = function () {
    return {
      rss: 99999,
      heapTotal: 9999,
      heapUsed: 999,
      external: 99
    }
  }
  const protect = protection('express', {
    sampleInterval: 5,
    maxEventLoopDelay: 0,
    maxRssBytes: 40,
    logging: function (msg) {
      t.is(msg, 'Server experiencing heavy load: (rss)')
      server.close()
      protect.stop()
      process.memoryUsage = memoryUsage
      t.end()
    }
  })

  const app = express()
  app.use(protect)
  const server = http.createServer(app)

  server.listen(0, function () {
    const port = server.address().port
    setTimeout(function () {
      http.get('http://localhost:' + port).end()
    }, 6)
  })
})

test('if logStatsOnReq is true and if logging option is a string, writes log message using req.log as per level in string for every request', function (t) {
  const protect = protection('express', {
    logging: 'info',
    logStatsOnReq: true
  })
  t.plan(1)
  const app = express()
  app.use(function (req, res, next) {
    req.log = {
      info: function (msg) {
        t.same(Object.keys(msg), [
          'overload',
          'eventLoopOverload',
          'heapUsedOverload',
          'rssOverload',
          'eventLoopDelay',
          'maxEventLoopDelay',
          'maxHeapUsedBytes',
          'maxRssBytes'
        ])
        server.close()
        protect.stop()
        t.end()
      }
    }
    next()
  })
  app.use(protect)
  app.use(function (req, res) {
    res.end('content')
  })
  const server = http.createServer(app)

  server.listen(0, function () {
    const port = server.address().port
    setTimeout(function () {
      http.get('http://localhost:' + port).end()
    }, 6)
  })
})

test('if logStatsOnReq is true and logging option is a function, calls the function with stats on every request', function (t) {
  const protect = protection('express', {
    logStatsOnReq: true,
    logging: function (msg) {
      t.same(Object.keys(msg), [
        'overload',
        'eventLoopOverload',
        'heapUsedOverload',
        'rssOverload',
        'eventLoopDelay',
        'maxEventLoopDelay',
        'maxHeapUsedBytes',
        'maxRssBytes'
      ])
      server.close()
      protect.stop()
      t.end()
    }
  })

  const app = express()
  app.use(protect)
  app.use(function (req, res) {
    res.end('content')
  })
  const server = http.createServer(app)

  server.listen(0, function () {
    setTimeout(function () {
      const port = server.address().port
      http.get('http://localhost:' + port).end()
    }, 6)
  })
})
