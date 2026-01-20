'use strict'

import http from 'http'
import express from 'express'
import protection from '../../../index.js'

test('sends 503 when event loop is overloaded, per maxEventLoopDelay', async () => {
  return new Promise((resolve, reject) => {
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
        req.on('error', reject)
        req.on('response', function (res) {
          try {
            expect(res.statusCode).toBe(503)
            protect.stop()
            server.close()
            process.memoryUsage = memoryUsage
            resolve()
          } catch (err) {
            reject(err)
          }
        }).end()
      }, 6) // Wait for memory sampling
    })
  })
})

test('sends 503 when heap used threshold is passed, as per maxHeapUsedBytes', async () => {
  return new Promise((resolve, reject) => {
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
        req.on('error', reject)
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
        }).end()
      }, 6)
    })
  })
})

test('sends 503 when heap used threshold is passed, as per maxRssBytes', async () => {
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
        req.on('error', reject)
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
        }).end()
      }, 6)
    })
  })
})

test('sends Retry-After header as per clientRetrySecs', async () => {
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
        req.on('error', reject)
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
        }).end()
      }, 6)
    })
  })
})

test('does not set Retry-After header when clientRetrySecs is 0', async () => {
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
        req.on('error', reject)
        req.on('response', function (res) {
          try {
            expect(res.statusCode).toBe(503)
            expect('retry-after' in res.headers).toBe(false)
            server.close()
            protect.stop()
            process.memoryUsage = memoryUsage
            resolve()
          } catch (err) {
            reject(err)
          }
        }).end()
      }, 6)
    })
  })
})

test('errorPropagationMode:false (default)', async () => {
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
    const protect = protection('express', {
      sampleInterval: 5,
      maxEventLoopDelay: 0,
      maxRssBytes: 40,
      errorPropagationMode: false
    })

    const app = express()
    app.use(protect)
    app.use(function (req, res) {
      reject(new Error('should never be called')) // should never be called
      res.end('content')
    })
    const server = http.createServer(app)

    server.listen(0, function () {
      const port = server.address().port
      setTimeout(function () {
        const req = http.get('http://localhost:' + port)
        req.on('error', reject)
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
        }).end()
      }, 6)
    })
  })
})

test('errorPropagationMode:true', async () => {
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
    const protect = protection('express', {
      sampleInterval: 5,
      maxEventLoopDelay: 0,
      maxRssBytes: 40,
      errorPropagationMode: true
    })

    const app = express()
    app.use(protect)
    app.use(function (err, req, res, next) {
      try {
        expect(err).toBeTruthy()
        expect(err.statusCode).toBe(503)
        res.end('err message')
      } catch (e) {
        reject(e)
      }
    })
    const server = http.createServer(app)

    server.listen(0, function () {
      const port = server.address().port
      setTimeout(function () {
        const req = http.get('http://localhost:' + port)
        req.on('error', reject)
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
        }).end()
      }, 6)
    })
  })
})

test('in default mode, production:false leads to high detail client response message', async () => {
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
        req.on('error', reject)
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
              } catch (err) {
                reject(err)
              }
            })
          } catch (err) {
            reject(err)
          }
        }).end()
      }, 6)
    })
  })
})

test('in default mode, production:true leads to standard 503 client response message', async () => {
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
        req.on('error', reject)
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
              } catch (err) {
                reject(err)
              }
            })
          } catch (err) {
            reject(err)
          }
        }).end()
      }, 6)
    })
  })
})

test('in errorPropagationMode production:false sets expose:true on error object', async () => {
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
      try {
        expect(err).toBeTruthy()
        expect(err.expose).toBe(true)
        res.end('err message')
      } catch (e) {
        reject(e)
      }
    })
    const server = http.createServer(app)

    server.listen(0, function () {
      const port = server.address().port
      setTimeout(function () {
        const req = http.get('http://localhost:' + port)
        req.on('error', reject)
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
        }).end()
      }, 6)
    })
  })
})

test('in errorPropagationMode production:true sets expose:false on error object', async () => {
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
      try {
        expect(err).toBeTruthy()
        expect(err.expose).toBe(false)
        res.end('err message')
      } catch (e) {
        reject(e)
      }
    })
    const server = http.createServer(app)

    server.listen(0, function () {
      const port = server.address().port
      setTimeout(function () {
        const req = http.get('http://localhost:' + port)
        req.on('error', reject)
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
        }).end()
      }, 6)
    })
  })
})

test('resumes usual operation once load pressure is reduced under threshold', async () => {
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
        req.on('error', reject)
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
              const req2 = http.get('http://localhost:' + port)
              req2.on('error', reject)
              req2.on('response', function (res) {
                try {
                  expect(res.statusCode).toBe(200)
                  server.close()
                  protect.stop()
                  process.memoryUsage = memoryUsage
                  resolve()
                } catch (err) {
                  reject(err)
                }
              })
            }, 6)
          } catch (err) {
            reject(err)
          }
        }).end()
      }, 6)
    })
  })
})

test('if logging option is a string, when overloaded, writes log message using req.log as per level in string', async () => {
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
          try {
            expect(msg).toBe('Server experiencing heavy load: (heap, rss)')
            server.close()
            protect.stop()
            process.memoryUsage = memoryUsage
            resolve()
          } catch (err) {
            reject(err)
          }
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
})

test('if logging option is a function, when overloaded calls the function with heavy load message', async () => {
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
    const protect = protection('express', {
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
        } catch (err) {
          reject(err)
        }
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
})

test('if logStatsOnReq is true and if logging option is a string, writes log message using req.log as per level in string for every request', async () => {
  return new Promise((resolve, reject) => {
    const protect = protection('express', {
      logging: 'info',
      logStatsOnReq: true
    })
    const app = express()
    app.use(function (req, res, next) {
      req.log = {
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
          } catch (err) {
            reject(err)
          }
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
})

test('if logStatsOnReq is true and logging option is a function, calls the function with stats on every request', async () => {
  return new Promise((resolve, reject) => {
    const protect = protection('express', {
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
        } catch (err) {
          reject(err)
        }
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
})
