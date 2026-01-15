'use strict'

import http from 'http'
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

function sleep (msec) {
  var start = Date.now()
  while (Date.now() - start < msec) {}
}

test('sends 503 when event loop is overloaded, per maxEventLoopDelay', () => {
  return new Promise((resolve, reject) => {
    var protect = protection('http', { maxEventLoopDelay: 1 })

    var server = http.createServer(function serve (req, res) {
      sleep(500)
      if (protect(req, res) === true) return
      res.end('content')
    })

    server.listen(0, function () {
      const port = server.address().port
      var req = http.get('http://localhost:' + port)
      req.on('response', function (res) {
        try {
          expect(res.statusCode).toBe(503)
          protect.stop()
          server.close()
          resolve()
        } catch (err) { reject(err) }
      }).on('error', reject).end()
    })
  })
})

test('sends 503 when heap used threshold is passed, as per maxHeapUsedBytes', () => {
  return new Promise((resolve, reject) => {
    var memoryUsage = process.memoryUsage
    process.memoryUsage = function () { return { rss: 99999, heapTotal: 9999, heapUsed: 999, external: 99 } }
    var protect = protection('http', { sampleInterval: 5, maxEventLoopDelay: 0, maxHeapUsedBytes: 40 })

    var server = http.createServer(function serve (req, res) {
      if (protect(req, res) === true) return
      res.end('content')
    })

    server.listen(0, function () {
      const port = server.address().port
      setTimeout(function () {
        var req = http.get('http://localhost:' + port)
        req.on('response', function (res) {
          try {
            expect(res.statusCode).toBe(503)
            server.close()
            protect.stop()
            process.memoryUsage = memoryUsage
            resolve()
          } catch (err) { reject(err) }
        }).on('error', reject).end()
      }, 6)
    })
  })
})

test('sends 503 when heap used threshold is passed, as per maxRssBytes', function (t) {
  var memoryUsage = process.memoryUsage
  process.memoryUsage = function () {
    return {
      rss: 99999,
      heapTotal: 9999,
      heapUsed: 999,
      external: 99
    }
  }
  var protect = protection('http', {
    sampleInterval: 5,
    maxEventLoopDelay: 0,
    maxRssBytes: 40
  })

  var server = http.createServer(function serve (req, res) {
    if (protect(req, res) === true) return
    res.end('content')
  })

  server.listen(0, function () {
    setTimeout(function () {
      const port = server.address().port
      var req = http.get('http://localhost:' + port)
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
  var memoryUsage = process.memoryUsage
  process.memoryUsage = function () {
    return {
      rss: 99999,
      heapTotal: 9999,
      heapUsed: 999,
      external: 99
    }
  }
  var protect = protection('http', {
    sampleInterval: 5,
    maxEventLoopDelay: 0,
    maxRssBytes: 40,
    clientRetrySecs: 22
  })

  var server = http.createServer(function serve (req, res) {
    if (protect(req, res) === true) return
    res.end('content')
  })

  server.listen(0, function () { const port = server.address().port
    setTimeout(function () {
      var req = http.get('http://localhost:' + port)
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
  var memoryUsage = process.memoryUsage
  process.memoryUsage = function () {
    return {
      rss: 99999,
      heapTotal: 9999,
      heapUsed: 999,
      external: 99
    }
  }
  var protect = protection('http', {
    sampleInterval: 5,
    maxEventLoopDelay: 0,
    maxRssBytes: 40,
    clientRetrySecs: 0
  })

  var server = http.createServer(function serve (req, res) {
    if (protect(req, res) === true) return
    res.end('content')
  })

  server.listen(0, function () { const port = server.address().port
    setTimeout(function () {
      var req = http.get('http://localhost:' + port)
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

test('callback api with errorPropagationMode false (default)', function (t) {
  var memoryUsage = process.memoryUsage
  process.memoryUsage = function () {
    return {
      rss: 99999,
      heapTotal: 9999,
      heapUsed: 999,
      external: 99
    }
  }
  var protect = protection('http', {
    sampleInterval: 5,
    maxEventLoopDelay: 0,
    maxRssBytes: 40,
    errorPropagationMode: false
  })

  var server = http.createServer(function serve (req, res) {
    protect(req, res, function () {
      t.fail() // should never be called
      res.end('content')
    })
  })

  server.listen(0, function () { const port = server.address().port
    setTimeout(function () {
      var req = http.get('http://localhost:' + port)
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

test('callback api with errorPropagationMode true', function (t) {
  var memoryUsage = process.memoryUsage
  process.memoryUsage = function () {
    return {
      rss: 99999,
      heapTotal: 9999,
      heapUsed: 999,
      external: 99
    }
  }
  var protect = protection('http', {
    sampleInterval: 5,
    maxEventLoopDelay: 0,
    maxRssBytes: 40,
    errorPropagationMode: true
  })

  var server = http.createServer(function serve (req, res) {
    protect(req, res, function (err) {
      t.ok(err)
      t.is(err.statusCode, 503)
      res.end('err message')
    })
  })

  server.listen(0, function () { const port = server.address().port
    setTimeout(function () {
      var req = http.get('http://localhost:' + port)
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
  var memoryUsage = process.memoryUsage
  process.memoryUsage = function () {
    return {
      rss: 99999,
      heapTotal: 9999,
      heapUsed: 999,
      external: 99
    }
  }
  var protect = protection('http', {
    production: false,
    sampleInterval: 5,
    maxEventLoopDelay: 0,
    maxRssBytes: 40,
    errorPropagationMode: false
  })

  var server = http.createServer(function serve (req, res) {
    if (protect(req, res) === true) return
    res.end('content')
  })

  server.listen(0, function () { const port = server.address().port
    setTimeout(function () {
      var req = http.get('http://localhost:' + port)
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
  var memoryUsage = process.memoryUsage
  process.memoryUsage = function () {
    return {
      rss: 99999,
      heapTotal: 9999,
      heapUsed: 999,
      external: 99
    }
  }
  var protect = protection('http', {
    production: true,
    sampleInterval: 5,
    maxEventLoopDelay: 0,
    maxRssBytes: 40,
    errorPropagationMode: false
  })

  var server = http.createServer(function serve (req, res) {
    if (protect(req, res) === true) return
    res.end('content')
  })

  server.listen(0, function () { const port = server.address().port
    setTimeout(function () {
      var req = http.get('http://localhost:' + port)
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
  var memoryUsage = process.memoryUsage
  process.memoryUsage = function () {
    return {
      rss: 99999,
      heapTotal: 9999,
      heapUsed: 999,
      external: 99
    }
  }
  var protect = protection('http', {
    production: false,
    sampleInterval: 5,
    maxEventLoopDelay: 0,
    maxRssBytes: 40,
    errorPropagationMode: true
  })

  var server = http.createServer(function serve (req, res) {
    protect(req, res, function (err) {
      t.ok(err)
      t.is(err.expose, true)
      res.end('err message')
    })
  })

  server.listen(0, function () { const port = server.address().port
    setTimeout(function () {
      var req = http.get('http://localhost:' + port)
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
  var memoryUsage = process.memoryUsage
  process.memoryUsage = function () {
    return {
      rss: 99999,
      heapTotal: 9999,
      heapUsed: 999,
      external: 99
    }
  }
  var protect = protection('http', {
    production: true,
    sampleInterval: 5,
    maxEventLoopDelay: 0,
    maxRssBytes: 40,
    errorPropagationMode: true
  })

  var server = http.createServer(function serve (req, res) {
    protect(req, res, function (err) {
      t.ok(err)
      t.is(err.expose, false)
      res.end('err message')
    })
  })

  server.listen(0, function () { const port = server.address().port
    setTimeout(function () {
      var req = http.get('http://localhost:' + port)
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
  var memoryUsage = process.memoryUsage
  process.memoryUsage = function () {
    return {
      rss: 99999,
      heapTotal: 9999,
      heapUsed: 999,
      external: 99
    }
  }
  var protect = protection('http', {
    sampleInterval: 5,
    maxEventLoopDelay: 0,
    maxRssBytes: 40
  })

  var server = http.createServer(function serve (req, res) {
    if (protect(req, res) === true) return
    res.end('content')
  })

  server.listen(0, function () { const port = server.address().port
    setTimeout(function () {
      var req = http.get('http://localhost:' + port)
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

test('(callback api) resumes usual operation once load pressure is reduced under threshold', function (t) {
  var memoryUsage = process.memoryUsage
  process.memoryUsage = function () {
    return {
      rss: 99999,
      heapTotal: 9999,
      heapUsed: 999,
      external: 99
    }
  }
  var protect = protection('http', {
    sampleInterval: 5,
    maxEventLoopDelay: 0,
    maxRssBytes: 40
  })

  var server = http.createServer(function serve (req, res) {
    protect(req, res, function () {
      res.end('content')
    })
  })

  server.listen(3000, function () {
    setTimeout(function () {
      var req = http.get('http://localhost:3000')
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
          http.get('http://localhost:3000').on('response', function (res) {
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
  var memoryUsage = process.memoryUsage
  process.memoryUsage = function () {
    return {
      rss: 99999,
      heapTotal: 9999,
      heapUsed: 999,
      external: 99
    }
  }
  var protect = protection('http', {
    sampleInterval: 5,
    maxEventLoopDelay: 1,
    maxRssBytes: 40,
    maxHeapUsedBytes: 40,
    logging: 'warn'
  })

  var server = http.createServer(function serve (req, res) {
    req = {
      log: {
        warn: function (msg) {
          t.is(msg, 'Server experiencing heavy load: (event loop, heap, rss)')
          server.close()
          protect.stop()
          process.memoryUsage = memoryUsage
          t.end()
        }
      }
    }
    if (protect(req, res) === true) return
    res.end('content')
  })

  server.listen(0, function () { const port = server.address().port
    setTimeout(function () {
      sleep(500)
      http.get('http://localhost:' + port).end()
    }, 6)
  })
})

test('if logging option is a function, when overloaded calls the function with heavy load message', function (t) {
  var memoryUsage = process.memoryUsage
  process.memoryUsage = function () {
    return {
      rss: 99999,
      heapTotal: 9999,
      heapUsed: 999,
      external: 99
    }
  }
  var protect = protection('http', {
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

  var server = http.createServer(function serve (req, res) {
    if (protect(req, res) === true) return
    res.end('content')
  })

  server.listen(0, function () { const port = server.address().port
    setTimeout(function () {
      http.get('http://localhost:' + port).end()
    }, 6)
  })
})

test('if logStatsOnReq is true and if logging option is a string, writes log message using req.log as per level in string for every request', function (t) {
  var protect = protection('http', {
    logging: 'info',
    logStatsOnReq: true
  })
  t.plan(1)
  var server = http.createServer(function serve (req, res) {
    req = {
      log: {
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
    }
    if (protect(req, res) === true) return
    res.end('content')
  })

  server.listen(0, function () { const port = server.address().port
    setTimeout(function () {
      http.get('http://localhost:' + port).end()
    }, 6)
  })
})

test('if logStatsOnReq is true and logging option is a function, calls the function with stats on every request', function (t) {
  var protect = protection('http', {
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

  var server = http.createServer(function serve (req, res) {
    if (protect(req, res) === true) return
    res.end('content')
  })

  server.listen(3002, function () {
    setTimeout(function () {
      http.get('http://localhost:3002').end()
    }, 6)
  })
})
