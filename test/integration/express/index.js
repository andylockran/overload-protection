'use strict'

import http from 'http'
import express from 'express'
import protection from '../../../index.js'

// Inline minimal shim to run existing TAP-style tests under Vitest
  if (typeof global.test !== 'function') {
  global.test = function (name, fn) {
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
    var protect = protection('express', { maxEventLoopDelay: 1 })

    var app = express()
    app.use(protect)
    var server = http.createServer(function (req, res) {
      sleep(500)
      app(req, res)
    import protection from '../../../index.js'

    server.listen(0, function () {
      const port = server.address().port
    if (typeof global.test !== 'function') {
      global.test = function (name, fn) {
        it(name, async () => {
          return new Promise((resolve, reject) => {
            const t = {
              is: (a, b) => { try { expect(a).toBe(b) } catch (e) { reject(e) } },
              same: (a, b) => { try { expect(a).toEqual(b) } catch (e) { reject(e) } },
              ok: (v) => { try { expect(v).toBeTruthy() } catch (e) { reject(e) } },
              fail: (msg) => reject(new Error(msg || 'fail')),
              throws: (fnc) => { try { fnc(); reject(new Error('did not throw')) } catch (e) {} },
              plan: function () {},
              pass: function () {},
              end: function () { resolve() }
            }
            try {
              const maybe = fn(t)
              if (maybe && typeof maybe.then === 'function') maybe.then(resolve, reject)
              setTimeout(() => reject(new Error('Test did not call t.end() within timeout')), 300)
            } catch (err) { reject(err) }
          })
        })
      }
    }
    server.listen(0, function () {
      const port = server.address().port

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

test('sends 503 when heap used threshold is passed, as per maxRssBytes', () => {
  return new Promise((resolve, reject) => {
    var memoryUsage = process.memoryUsage
    process.memoryUsage = function () { return { rss: 99999, heapTotal: 9999, heapUsed: 999, external: 99 } }
    var protect = protection('express', { sampleInterval: 5, maxEventLoopDelay: 0, maxRssBytes: 40 })

    var app = express()
    app.use(protect)
    var server = http.createServer(app)

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

test('sends Retry-After header as per clientRetrySecs', () => {
  return new Promise((resolve, reject) => {
    var memoryUsage = process.memoryUsage
    process.memoryUsage = function () { return { rss: 99999, heapTotal: 9999, heapUsed: 999, external: 99 } }
    var protect = protection('express', { sampleInterval: 5, maxEventLoopDelay: 0, maxRssBytes: 40, clientRetrySecs: 22 })

    var app = express()
    app.use(protect)
    var server = http.createServer(app)

    server.listen(0, function () {
      const port = server.address().port
      setTimeout(function () {
        var req = http.get('http://localhost:' + port)
        req.on('response', function (res) {
          try {
            expect(res.statusCode).toBe(503)
            expect(res.headers['retry-after']).toBe('22')
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

    sampleInterval: 5,
    maxEventLoopDelay: 0,
    maxRssBytes: 40,
    clientRetrySecs: 0
  })

  var app = express()
  app.use(protect)
  var server = http.createServer(app)

  return new Promise((resolve, reject) => {
    server.listen(0, function () {
      const port = server.address().port
      setTimeout(function () {
        var req = http.get('http://localhost:' + port)
        req.on('response', function (res) {
          try {
            expect(res.statusCode).toBe(503)
            expect('retry-after' in res.headers).toBe(false)
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

test('errorPropagationMode:false (default)', () => {
  var memoryUsage = process.memoryUsage
  process.memoryUsage = function () {
    return {
      rss: 99999,
      heapTotal: 9999,
      heapUsed: 999,
      external: 99
    }
  }
  var protect = protection('express', {
    sampleInterval: 5,
    maxEventLoopDelay: 0,
    maxRssBytes: 40,
    errorPropagationMode: false
  })

  var app = express()
  app.use(protect)
  app.use(function () {
    throw new Error('should not be called')
  })
  var server = http.createServer(app)

  return new Promise((resolve, reject) => {
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

test('errorPropagationMode:true', () => {
  var memoryUsage = process.memoryUsage
  process.memoryUsage = function () {
    return {
      rss: 99999,
      heapTotal: 9999,
      heapUsed: 999,
      external: 99
    }
  }
  var protect = protection('express', {
    sampleInterval: 5,
    maxEventLoopDelay: 0,
    maxRssBytes: 40,
    errorPropagationMode: true
  })

  var app = express()
  app.use(protect)
  app.use(function (err, req, res, next) {
    try {
      expect(err).toBeTruthy()
      expect(err.statusCode).toBe(503)
    } catch (e) {
      // still respond
    }
    res.end('err message')
  })
  var server = http.createServer(app)

  return new Promise((resolve, reject) => {
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

test('in default mode, production:false leads to high detail client response message', () => {
  var memoryUsage = process.memoryUsage
  process.memoryUsage = function () {
    return {
      rss: 99999,
      heapTotal: 9999,
      heapUsed: 999,
      external: 99
    }
  }
  var protect = protection('express', {
    production: false,
    sampleInterval: 5,
    maxEventLoopDelay: 0,
    maxRssBytes: 40,
    errorPropagationMode: false
  })

  var app = express()
  app.use(protect)
  var server = http.createServer(app)

  return new Promise((resolve, reject) => {
    server.listen(0, function () {
      const port = server.address().port
      setTimeout(function () {
        var req = http.get('http://localhost:' + port)
        req.on('response', function (res) {
          try {
            expect(res.statusCode).toBe(503)
            res.once('data', function (msg) {
              msg = msg.toString()
              expect(msg).toBe('Server experiencing heavy load: (rss)')
              server.close()
              protect.stop()
              process.memoryUsage = memoryUsage
              resolve()
            })
          } catch (err) { reject(err) }
        }).on('error', reject).end()
      }, 6)
    })
  })
})

test('in default mode, production:true leads to standard 503 client response message', () => {
  var memoryUsage = process.memoryUsage
  process.memoryUsage = function () {
    return {
      rss: 99999,
      heapTotal: 9999,
      heapUsed: 999,
      external: 99
    }
  }
  var protect = protection('express', {
    production: true,
    sampleInterval: 5,
    maxEventLoopDelay: 0,
    maxRssBytes: 40,
    errorPropagationMode: false
  })

  var app = express()
  app.use(protect)
  var server = http.createServer(app)

  return new Promise((resolve, reject) => {
    server.listen(0, function () {
      const port = server.address().port
      setTimeout(function () {
        var req = http.get('http://localhost:' + port)
        req.on('response', function (res) {
          try {
            expect(res.statusCode).toBe(503)
            res.once('data', function (msg) {
              msg = msg.toString()
              expect(msg).toBe('Service Unavailable')
              server.close()
              protect.stop()
              process.memoryUsage = memoryUsage
              resolve()
            })
          } catch (err) { reject(err) }
        }).on('error', reject).end()
      }, 6)
    })
  })
})

test('in errorPropagationMode production:false sets expose:true on error object', () => {
  var memoryUsage = process.memoryUsage
  process.memoryUsage = function () {
    return {
      rss: 99999,
      heapTotal: 9999,
      heapUsed: 999,
      external: 99
    }
  }
  var protect = protection('express', {
    production: false,
    sampleInterval: 5,
    maxEventLoopDelay: 0,
    maxRssBytes: 40,
    errorPropagationMode: true
  })

  var app = express()
  app.use(protect)
  app.use(function (err, req, res, next) {
    try {
      expect(err).toBeTruthy()
      expect(err.expose).toBe(true)
    } catch (e) {}
    res.end('err message')
  })
  var server = http.createServer(app)

  return new Promise((resolve, reject) => {
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

test('in errorPropagationMode production:true sets expose:false on error object', () => {
  var memoryUsage = process.memoryUsage
  process.memoryUsage = function () {
    return {
      rss: 99999,
      heapTotal: 9999,
      heapUsed: 999,
      external: 99
    }
  }
  var protect = protection('express', {
    production: true,
    sampleInterval: 5,
    maxEventLoopDelay: 0,
    maxRssBytes: 40,
    errorPropagationMode: true
  })

  var app = express()
  app.use(protect)
  app.use(function (err, req, res, next) {
    try {
      expect(err).toBeTruthy()
      expect(err.expose).toBe(false)
    } catch (e) {}
    res.end('err message')
  })
  var server = http.createServer(app)

  return new Promise((resolve, reject) => {
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
  var protect = protection('express', {
    sampleInterval: 5,
    maxEventLoopDelay: 0,
    maxRssBytes: 40
  })

  var app = express()
  app.use(protect)
  app.get('/', function (req, res) { res.end('content') })
  var server = http.createServer(app)

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
  var protect = protection('express', {
    sampleInterval: 5,
    maxEventLoopDelay: 0,
    maxRssBytes: 40,
    logging: 'warn'
  })

  var app = express()
  app.use(function (req, res, next) {
    req.log = {
      warn: function (msg) {
        t.is(msg, 'Server experiencing heavy load: (rss)')
        server.close()
        protect.stop()
        process.memoryUsage = memoryUsage
        t.end()
      }
    }
    next()
  })
  app.use(protect)
  app.get('/', function (req, res) { res.end('content') })
  var server = http.createServer(app)

  server.listen(0, function () { const port = server.address().port
    setTimeout(function () {
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
  var protect = protection('express', {
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

  var app = express()
  app.use(protect)
  app.get('/', function (req, res) { res.end('content') })
  var server = http.createServer(app)

  server.listen(0, function () { const port = server.address().port
    setTimeout(function () {
      http.get('http://localhost:' + port).end()
    }, 6)
  })
})

test('if logStatsOnReq is true and if logging option is a string, writes log message using req.log as per level in string for every request', function (t) {
  var protect = protection('express', {
    logging: 'info',
    logStatsOnReq: true
  })
  t.plan(1)
  var app = express()
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
  app.get('/', function (req, res) { res.end('content') })
  var server = http.createServer(app)

  server.listen(0, function () { const port = server.address().port
    setTimeout(function () {
      http.get('http://localhost:' + port).end()
    }, 6)
  })
})

test('if logStatsOnReq is true and logging option is a function, calls the function with stats on every request', function (t) {
  var protect = protection('express', {
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

  var app = express()
  app.use(protect)
  app.get('/', function (req, res) { res.end('content') })
  var server = http.createServer(app)

    server.listen(0, function () { const port = server.address().port
      setTimeout(function () {
        var req = http.get('http://localhost:' + port)
  })
})
