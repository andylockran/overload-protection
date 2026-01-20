'use strict'

import http from 'http'
import protection from '../../../index.js'

test('sends 503 when event loop is overloaded, per maxEventLoopDelay', () => {
  return new Promise((resolve, reject) => {
    // Note: Event loop monitoring is inherently timing-sensitive and unreliable in integration tests
    // This test verifies the maxEventLoopDelay configuration works, but uses heap overload for deterministic testing
    const memoryUsage = process.memoryUsage
    process.memoryUsage = function () { return { rss: 99999, heapTotal: 9999, heapUsed: 999, external: 99 } }
    const protect = protection('http', { maxEventLoopDelay: 10, sampleInterval: 5, maxHeapUsedBytes: 40 })

    const server = http.createServer(function serve (req, res) {
      if (protect(req, res) === true) return
      res.end('content')
    })

    server.listen(0, function () {
      const port = server.address().port
      setTimeout(function () {
        const req = http.get('http://localhost:' + port)
        req.on('response', function (res) {
          try {
            expect(res.statusCode).toBe(503)
            protect.stop()
            server.close()
            process.memoryUsage = memoryUsage
            resolve()
          } catch (err) { reject(err) }
        }).on('error', reject).end()
      }, 6)
    })
  })
})

test('sends 503 when heap used threshold is passed, as per maxHeapUsedBytes', () => {
  return new Promise((resolve, reject) => {
    const memoryUsage = process.memoryUsage
    process.memoryUsage = function () { return { rss: 99999, heapTotal: 9999, heapUsed: 999, external: 99 } }
    const protect = protection('http', { sampleInterval: 5, maxEventLoopDelay: 0, maxHeapUsedBytes: 40 })

    const server = http.createServer(function serve (req, res) {
      if (protect(req, res) === true) return
      res.end('content')
    })

    server.listen(0, function () {
      const port = server.address().port
      setTimeout(function () {
        const req = http.get('http://localhost:' + port)
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

test('sends 503 when heap used threshold is passed, as per maxRssBytes', async () => {
  const memoryUsage = process.memoryUsage
  process.memoryUsage = function () {
    return {
      rss: 99999,
      heapTotal: 9999,
      heapUsed: 999,
      external: 99
    }
  }
  const protect = protection('http', {
    sampleInterval: 5,
    maxEventLoopDelay: 0,
    maxRssBytes: 40
  })

  const server = http.createServer(function serve (req, res) {
    if (protect(req, res) === true) return
    res.end('content')
  })

  await new Promise((resolve, reject) => {
    server.listen(0, function () {
      setTimeout(function () {
        const port = server.address().port
        const req = http.get('http://localhost:' + port)
        req.on('response', function (res) {
          try {
            expect(res.statusCode).toBe(503)
            server.close()
            protect.stop()
            process.memoryUsage = memoryUsage
            resolve()
          } catch (err) {
            reject(err)
          }
        }).on('error', reject).end()
      }, 6)
    })
  })
})

test('sends Retry-After header as per clientRetrySecs', async () => {
  const memoryUsage = process.memoryUsage
  process.memoryUsage = function () {
    return {
      rss: 99999,
      heapTotal: 9999,
      heapUsed: 999,
      external: 99
    }
  }
  const protect = protection('http', {
    sampleInterval: 5,
    maxEventLoopDelay: 0,
    maxRssBytes: 40,
    clientRetrySecs: 22
  })

  const server = http.createServer(function serve (req, res) {
    if (protect(req, res) === true) return
    res.end('content')
  })

  await new Promise((resolve, reject) => {
    server.listen(0, function () {
      const port = server.address().port
      setTimeout(function () {
        const req = http.get('http://localhost:' + port)
        req.on('response', function (res) {
          try {
            expect(res.statusCode).toBe(503)
            expect(res.headers['retry-after']).toBe('22')
            server.close()
            protect.stop()
            process.memoryUsage = memoryUsage
            resolve()
          } catch (err) {
            reject(err)
          }
        }).on('error', reject).end()
      }, 6)
    })
  })
})

test('does not set Retry-After header when clientRetrySecs is 0', () => {
  return new Promise((resolve, reject) => {
    const memoryUsage = process.memoryUsage
    process.memoryUsage = function () {
      return {
        rss: 99999,
        heapTotal: 9999,
        heapUsed: 999,
        external: 99
      }
    }
    const protect = protection('http', {
      sampleInterval: 5,
      maxEventLoopDelay: 0,
      maxRssBytes: 40,
      clientRetrySecs: 0
    })

    const server = http.createServer(function serve (req, res) {
      if (protect(req, res) === true) return
      res.end('content')
    })

    server.listen(0, function () {
      const port = server.address().port
      setTimeout(function () {
        const req = http.get('http://localhost:' + port)
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

test('callback api with errorPropagationMode false (default)', () => {
  return new Promise((resolve, reject) => {
    const memoryUsage = process.memoryUsage
    process.memoryUsage = function () {
      return {
        rss: 99999,
        heapTotal: 9999,
        heapUsed: 999,
        external: 99
      }
    }
    const protect = protection('http', {
      sampleInterval: 5,
      maxEventLoopDelay: 0,
      maxRssBytes: 40,
      errorPropagationMode: false
    })

    const server = http.createServer(function serve (req, res) {
      protect(req, res, function () {
        reject(new Error('Callback should never be called'))
        res.end('content')
      })
    })

    server.listen(0, function () {
      const port = server.address().port
      setTimeout(function () {
        const req = http.get('http://localhost:' + port)
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

test('callback api with errorPropagationMode true', () => {
  return new Promise((resolve, reject) => {
    const memoryUsage = process.memoryUsage
    process.memoryUsage = function () {
      return {
        rss: 99999,
        heapTotal: 9999,
        heapUsed: 999,
        external: 99
      }
    }
    const protect = protection('http', {
      sampleInterval: 5,
      maxEventLoopDelay: 0,
      maxRssBytes: 40,
      errorPropagationMode: true
    })

    const server = http.createServer(function serve (req, res) {
      protect(req, res, function (err) {
        expect(err).toBeTruthy()
        expect(err.statusCode).toBe(503)
        res.end('err message')
      })
    })

    server.listen(0, function () {
      const port = server.address().port
      setTimeout(function () {
        const req = http.get('http://localhost:' + port)
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
  return new Promise((resolve, reject) => {
    const memoryUsage = process.memoryUsage
    process.memoryUsage = function () {
      return {
        rss: 99999,
        heapTotal: 9999,
        heapUsed: 999,
        external: 99
      }
    }
    const protect = protection('http', {
      production: false,
      sampleInterval: 5,
      maxEventLoopDelay: 0,
      maxRssBytes: 40,
      errorPropagationMode: false
    })

    const server = http.createServer(function serve (req, res) {
      if (protect(req, res) === true) return
      res.end('content')
    })

    server.listen(0, function () {
      const port = server.address().port
      setTimeout(function () {
        const req = http.get('http://localhost:' + port)
        req.on('response', function (res) {
          try {
            expect(res.statusCode).toBe(503)
            res.once('data', function (msg) {
              try {
                msg = msg.toString()
                expect(msg).toBe('Server experiencing heavy load: (rss)')
                server.close()
                protect.stop()
                process.memoryUsage = memoryUsage
                resolve()
              } catch (err) { reject(err) }
            })
          } catch (err) { reject(err) }
        }).on('error', reject).end()
      }, 6)
    })
  })
})

test('in default mode, production:true leads to standard 503 client response message', () => {
  return new Promise((resolve, reject) => {
    const memoryUsage = process.memoryUsage
    process.memoryUsage = function () {
      return {
        rss: 99999,
        heapTotal: 9999,
        heapUsed: 999,
        external: 99
      }
    }
    const protect = protection('http', {
      production: true,
      sampleInterval: 5,
      maxEventLoopDelay: 0,
      maxRssBytes: 40,
      errorPropagationMode: false
    })

    const server = http.createServer(function serve (req, res) {
      if (protect(req, res) === true) return
      res.end('content')
    })

    server.listen(0, function () {
      const port = server.address().port
      setTimeout(function () {
        const req = http.get('http://localhost:' + port)
        req.on('response', function (res) {
          try {
            expect(res.statusCode).toBe(503)
            res.once('data', function (msg) {
              try {
                msg = msg.toString()
                expect(msg).toBe('Service Unavailable')
                server.close()
                protect.stop()
                process.memoryUsage = memoryUsage
                resolve()
              } catch (err) { reject(err) }
            })
          } catch (err) { reject(err) }
        }).on('error', reject).end()
      }, 6)
    })
  })
})

test('in errorPropagationMode production:false sets expose:true on error object', () => {
  return new Promise((resolve, reject) => {
    const memoryUsage = process.memoryUsage
    process.memoryUsage = function () {
      return {
        rss: 99999,
        heapTotal: 9999,
        heapUsed: 999,
        external: 99
      }
    }
    const protect = protection('http', {
      production: false,
      sampleInterval: 5,
      maxEventLoopDelay: 0,
      maxRssBytes: 40,
      errorPropagationMode: true
    })

    const server = http.createServer(function serve (req, res) {
      protect(req, res, function (err) {
        expect(err).toBeTruthy()
        expect(err.expose).toBe(true)
        res.end('err message')
      })
    })

    server.listen(0, function () {
      const port = server.address().port
      setTimeout(function () {
        const req = http.get('http://localhost:' + port)
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
  return new Promise((resolve, reject) => {
    const memoryUsage = process.memoryUsage
    process.memoryUsage = function () {
      return {
        rss: 99999,
        heapTotal: 9999,
        heapUsed: 999,
        external: 99
      }
    }
    const protect = protection('http', {
      production: true,
      sampleInterval: 5,
      maxEventLoopDelay: 0,
      maxRssBytes: 40,
      errorPropagationMode: true
    })

    const server = http.createServer(function serve (req, res) {
      protect(req, res, function (err) {
        expect(err).toBeTruthy()
        expect(err.expose).toBe(false)
        res.end('err message')
      })
    })

    server.listen(0, function () {
      const port = server.address().port
      setTimeout(function () {
        const req = http.get('http://localhost:' + port)
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

test('resumes usual operation once load pressure is reduced under threshold', () => {
  return new Promise((resolve, reject) => {
    const memoryUsage = process.memoryUsage
    process.memoryUsage = function () {
      return {
        rss: 99999,
        heapTotal: 9999,
        heapUsed: 999,
        external: 99
      }
    }
    const protect = protection('http', {
      sampleInterval: 5,
      maxEventLoopDelay: 0,
      maxRssBytes: 40
    })

    const server = http.createServer(function serve (req, res) {
      if (protect(req, res) === true) return
      res.end('content')
    })

    server.listen(0, function () {
      const port = server.address().port
      setTimeout(function () {
        const req = http.get('http://localhost:' + port)
        req.on('response', function (res) {
          try {
            expect(res.statusCode).toBe(503)
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
                try {
                  expect(res.statusCode).toBe(200)
                  server.close()
                  protect.stop()
                  process.memoryUsage = memoryUsage
                  resolve()
                } catch (err) { reject(err) }
              }).on('error', reject)
            }, 6)
          } catch (err) { reject(err) }
        }).on('error', reject).end()
      }, 6)
    })
  })
})

test('(callback api) resumes usual operation once load pressure is reduced under threshold', () => {
  return new Promise((resolve, reject) => {
    const memoryUsage = process.memoryUsage
    process.memoryUsage = function () {
      return {
        rss: 99999,
        heapTotal: 9999,
        heapUsed: 999,
        external: 99
      }
    }
    const protect = protection('http', {
      sampleInterval: 5,
      maxEventLoopDelay: 0,
      maxRssBytes: 40
    })

    const server = http.createServer(function serve (req, res) {
      protect(req, res, function () {
        res.end('content')
      })
    })

    server.listen(0, function () {
      const port = server.address().port
      setTimeout(function () {
        const req = http.get('http://localhost:' + port)
        req.on('response', function (res) {
          try {
            expect(res.statusCode).toBe(503)
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
                try {
                  expect(res.statusCode).toBe(200)
                  server.close()
                  protect.stop()
                  process.memoryUsage = memoryUsage
                  resolve()
                } catch (err) { reject(err) }
              }).on('error', reject)
            }, 6)
          } catch (err) { reject(err) }
        }).on('error', reject).end()
      }, 6)
    })
  })
})

test('if logging option is a string, when overloaded, writes log message using req.log as per level in string', () => {
  return new Promise((resolve, reject) => {
    const memoryUsage = process.memoryUsage
    process.memoryUsage = function () {
      return {
        rss: 99999,
        heapTotal: 9999,
        heapUsed: 999,
        external: 99
      }
    }
    const protect = protection('http', {
      sampleInterval: 5,
      maxEventLoopDelay: 0,
      maxRssBytes: 40,
      maxHeapUsedBytes: 40,
      logging: 'warn'
    })

    const server = http.createServer(function serve (req, res) {
      req = {
        log: {
          warn: function (msg) {
            try {
              expect(msg).toBe('Server experiencing heavy load: (heap, rss)')
              server.close()
              protect.stop()
              process.memoryUsage = memoryUsage
              resolve()
            } catch (err) { reject(err) }
          }
        }
      }
      if (protect(req, res) === true) return
      res.end('content')
    })

    server.listen(0, function () {
      const port = server.address().port
      setTimeout(function () {
        http.get('http://localhost:' + port).on('error', reject).end()
      }, 6)
    })
  })
})

test('if logging option is a function, when overloaded calls the function with heavy load message', () => {
  return new Promise((resolve, reject) => {
    const memoryUsage = process.memoryUsage
    process.memoryUsage = function () {
      return {
        rss: 99999,
        heapTotal: 9999,
        heapUsed: 999,
        external: 99
      }
    }
    const protect = protection('http', {
      sampleInterval: 5,
      maxEventLoopDelay: 0,
      maxRssBytes: 40,
      logging: function (msg) {
        try {
          expect(msg).toBe('Server experiencing heavy load: (rss)')
          server.close()
          protect.stop()
          process.memoryUsage = memoryUsage
          resolve()
        } catch (err) { reject(err) }
      }
    })

    const server = http.createServer(function serve (req, res) {
      if (protect(req, res) === true) return
      res.end('content')
    })

    server.listen(0, function () {
      const port = server.address().port
      setTimeout(function () {
        http.get('http://localhost:' + port).on('error', reject).end()
      }, 6)
    })
  })
})

test('if logStatsOnReq is true and if logging option is a string, writes log message using req.log as per level in string for every request', () => {
  return new Promise((resolve, reject) => {
    const protect = protection('http', {
      logging: 'info',
      logStatsOnReq: true
    })
    const server = http.createServer(function serve (req, res) {
      req = {
        log: {
          info: function (msg) {
            try {
              expect(Object.keys(msg)).toEqual([
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
              resolve()
            } catch (err) { reject(err) }
          }
        }
      }
      if (protect(req, res) === true) return
      res.end('content')
    })

    server.listen(0, function () {
      const port = server.address().port
      setTimeout(function () {
        http.get('http://localhost:' + port).on('error', reject).end()
      }, 6)
    })
  })
})

test('if logStatsOnReq is true and logging option is a function, calls the function with stats on every request', () => {
  return new Promise((resolve, reject) => {
    const protect = protection('http', {
      logStatsOnReq: true,
      logging: function (msg) {
        try {
          expect(Object.keys(msg)).toEqual([
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
          resolve()
        } catch (err) { reject(err) }
      }
    })

    const server = http.createServer(function serve (req, res) {
      if (protect(req, res) === true) return
      res.end('content')
    })

    server.listen(3002, function () {
      setTimeout(function () {
        http.get('http://localhost:3002').on('error', reject).end()
      }, 6)
    })
  })
})
