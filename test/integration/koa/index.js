'use strict'

import http from 'http'
import Koa from 'koa'
import Router from '@koa/router'
import protection from '../../../index.js'

function block (n) {
  while (n--) { JSON.parse(JSON.stringify({ name: 'overload-protection' })) }
}

test('sends 503 when event loop is overloaded, per maxEventLoopDelay', async () => {
  return new Promise((resolve, reject) => {
    const protect = protection('koa', {
      maxEventLoopDelay: 1
    })

    const app = new Koa()

    app.use(protect)

    const server = app.listen(0, function () {
      const port = server.address().port
      const req = http.get('http://localhost:' + port)
      block(50000)
      req.on('response', function (res) {
        try {
          expect(res.statusCode).toBe(503)
          protect.stop()
          server.close()
          resolve()
        } catch (err) {
          reject(err)
        }
      }).on('error', reject).end()
    })
  })
})

test('sends 503 when heap used threshold is passed, as per maxHeapUsedBytes', async () => {
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
    const protect = protection('koa', {
      sampleInterval: 5,
      maxEventLoopDelay: 0,
      maxHeapUsedBytes: 40
    })

    const app = new Koa()
    app.use(protect)

    const server = app.listen(0, function () {
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
          } catch (err) {
            reject(err)
          }
        }).on('error', reject).end()
      }, 6)
    })
  })
})

test('sends 503 when rss threshold is passed, as per maxRssBytes', async () => {
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
    const protect = protection('koa', {
      sampleInterval: 5,
      maxEventLoopDelay: 0,
      maxRssBytes: 40
    })

    const app = new Koa()
    app.use(protect)

    const server = app.listen(0, function () {
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
          } catch (err) {
            reject(err)
          }
        }).on('error', reject).end()
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
    const protect = protection('koa', {
      sampleInterval: 5,
      maxEventLoopDelay: 0,
      maxRssBytes: 40,
      clientRetrySecs: 22
    })

    const app = new Koa()
    app.use(protect)

    const server = app.listen(0, function () {
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
    const protect = protection('koa', {
      sampleInterval: 5,
      maxEventLoopDelay: 0,
      maxRssBytes: 40,
      clientRetrySecs: 0
    })

    const app = new Koa()
    app.use(protect)

    const server = app.listen(0, function () {
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
          } catch (err) {
            reject(err)
          }
        }).on('error', reject).end()
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
    const protect = protection('koa', {
      sampleInterval: 5,
      maxEventLoopDelay: 0,
      maxRssBytes: 40,
      errorPropagationMode: false
    })

    const app = new Koa()
    app.use(protect)
    app.use(function (ctx, next) {
      reject(new Error('Should not reach next middleware'))
      return next()
    })

    const server = app.listen(0, function () {
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
          } catch (err) {
            reject(err)
          }
        }).on('error', reject).end()
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
    const protect = protection('koa', {
      sampleInterval: 5,
      maxEventLoopDelay: 0,
      maxRssBytes: 40,
      errorPropagationMode: true
    })

    const app = new Koa()
    app.on('error', function () {}) // silence error log output
    app.use(function (ctx, next) {
      return next().catch(function (err) {
        expect(err).toBeTruthy()
        expect(err.status).toBe(503)
        throw err
      })
    })

    app.use(protect)

    const server = app.listen(0, function () {
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
          } catch (err) {
            reject(err)
          }
        }).on('error', reject).end()
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
    const protect = protection('koa', {
      production: false,
      sampleInterval: 5,
      maxEventLoopDelay: 0,
      maxRssBytes: 40,
      errorPropagationMode: false
    })

    const app = new Koa()
    app.use(protect)

    const server = app.listen(0, function () {
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
              } catch (err) {
                reject(err)
              }
            })
          } catch (err) {
            reject(err)
          }
        }).on('error', reject).end()
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
    const protect = protection('koa', {
      production: true,
      sampleInterval: 5,
      maxEventLoopDelay: 0,
      maxRssBytes: 40,
      errorPropagationMode: false
    })

    const app = new Koa()
    app.use(protect)

    const server = app.listen(0, function () {
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
              } catch (err) {
                reject(err)
              }
            })
          } catch (err) {
            reject(err)
          }
        }).on('error', reject).end()
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
    const protect = protection('koa', {
      production: false,
      sampleInterval: 5,
      maxEventLoopDelay: 0,
      maxRssBytes: 40,
      errorPropagationMode: true
    })

    const app = new Koa()
    app.on('error', function () {}) // silence error log output
    app.use(function (ctx, next) {
      return next().catch(function (err) {
        expect(err).toBeTruthy()
        expect(err.expose).toBe(true)
        throw err
      })
    })

    app.use(protect)

    const server = app.listen(0, function () {
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
          } catch (err) {
            reject(err)
          }
        }).on('error', reject).end()
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
    const protect = protection('koa', {
      production: true,
      sampleInterval: 5,
      maxEventLoopDelay: 0,
      maxRssBytes: 40,
      errorPropagationMode: true
    })

    const app = new Koa()
    app.on('error', function () {}) // silence error log output
    app.use(function (ctx, next) {
      return next().catch(function (err) {
        expect(err).toBeTruthy()
        expect(err.expose).toBe(false)
        throw err
      })
    })
    app.use(protect)

    const server = app.listen(0, function () {
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
          } catch (err) {
            reject(err)
          }
        }).on('error', reject).end()
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
    const protect = protection('koa', {
      sampleInterval: 5,
      maxEventLoopDelay: 0,
      maxRssBytes: 40
    })

    const app = new Koa()
    const router = new Router()
    app.use(protect)
    router.get('/', function (ctx, next) {
      ctx.body = 'content'
      return next()
    })

    app.use(router.routes())

    const server = app.listen(0, function () {
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
                } catch (err) {
                  reject(err)
                }
              }).on('error', reject)
            }, 6)
          } catch (err) {
            reject(err)
          }
        }).on('error', reject).end()
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
    const protect = protection('koa', {
      sampleInterval: 5,
      maxEventLoopDelay: 0,
      maxRssBytes: 40,
      logging: 'warn'
    })

    const app = new Koa()
    app.use(function (ctx, next) {
      ctx.log = ctx.req.log = {
        warn: function (msg) {
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
      }
      return next()
    })
    app.use(protect)

    const server = app.listen(0, function () {
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
    const protect = protection('koa', {
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

    const app = new Koa()
    app.use(protect)

    const server = app.listen(0, function () {
      const port = server.address().port
      setTimeout(function () {
        http.get('http://localhost:' + port).end()
      }, 6)
    })
  })
})

test('if logStatsOnReq is true and if logging option is a string, writes log message using req.log as per level in string for every request', async () => {
  return new Promise((resolve, reject) => {
    const protect = protection('koa', {
      logging: 'info',
      logStatsOnReq: true
    })
    const app = new Koa()
    app.use(function (ctx, next) {
      ctx.log = ctx.req.log = {
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
      return next()
    })
    app.use(protect)

    const server = app.listen(0, function () {
      const port = server.address().port
      setTimeout(function () {
        http.get('http://localhost:' + port).end()
      }, 6)
    })
  })
})

test('if logStatsOnReq is true and logging option is a function, calls the function with stats on every request', async () => {
  return new Promise((resolve, reject) => {
    const protect = protection('koa', {
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

    const app = new Koa()
    app.use(protect)

    const server = app.listen(3001, function () {
      setTimeout(function () {
        http.get('http://localhost:3001').end()
      }, 6)
    })
  })
})
