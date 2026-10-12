'use strict'

import http from 'http'
import express from 'express'
import protect, { nativeOverloadProtection, createNativeOverloadProtection } from '../../../index.js'

test('nativeOverloadProtection serves requests normally when healthy', async () => {
  const app = express()
  const mw = createNativeOverloadProtection({ maxEventLoopDelayMs: 500 })
  app.use(mw)
  app.get('/test', (req, res) => res.json({ status: 'ok' }))

  const server = http.createServer(app)
  await new Promise((resolve, reject) => {
    server.listen(0, () => {
      const port = server.address().port
      http.get(`http://localhost:${port}/test`, (res) => {
        try {
          expect(res.statusCode).toBe(200)
          let data = ''
          res.on('data', chunk => { data += chunk })
          res.on('end', () => {
            expect(JSON.parse(data)).toEqual({ status: 'ok' })
            mw.stop()
            server.close(resolve)
          })
        } catch (err) {
          mw.stop()
          server.close()
          reject(err)
        }
      }).on('error', (err) => {
        mw.stop()
        server.close()
        reject(err)
      })
    })
  })
})

test('nativeOverloadProtection returns 503 with JSON errorDetails and Retry-After when lag exceeds maxEventLoopDelayMs', async () => {
  const app = express()
  // Set threshold to 0ms to simulate overload condition
  const mw = createNativeOverloadProtection({
    maxEventLoopDelayMs: -1,
    clientRetrySecs: 5,
    production: false
  })
  app.use(mw)
  app.get('/test', (req, res) => res.json({ status: 'ok' }))

  const server = http.createServer(app)
  await new Promise((resolve, reject) => {
    server.listen(0, () => {
      const port = server.address().port
      http.get(`http://localhost:${port}/test`, (res) => {
        try {
          expect(res.statusCode).toBe(503)
          expect(res.headers['retry-after']).toBe('5')
          expect(res.headers['content-type']).toMatch(/json/)

          let data = ''
          res.on('data', chunk => { data += chunk })
          res.on('end', () => {
            const body = JSON.parse(data)
            expect(body.error).toBe('Service Unavailable')
            expect(body.message).toBe('Server is currently overloaded, please try again later.')
            expect(typeof body.lagMs).toBe('string') // Exposed in dev mode
            mw.stop()
            server.close(resolve)
          })
        } catch (err) {
          mw.stop()
          server.close()
          reject(err)
        }
      }).on('error', (err) => {
        mw.stop()
        server.close()
        reject(err)
      })
    })
  })
})

test('nativeOverloadProtection omits lagMs from errorDetails in production mode', async () => {
  const app = express()
  const mw = createNativeOverloadProtection({
    maxEventLoopDelayMs: -1,
    clientRetrySecs: 5,
    production: true
  })
  app.use(mw)

  const server = http.createServer(app)
  await new Promise((resolve, reject) => {
    server.listen(0, () => {
      const port = server.address().port
      http.get(`http://localhost:${port}/test`, (res) => {
        try {
          expect(res.statusCode).toBe(503)
          let data = ''
          res.on('data', chunk => { data += chunk })
          res.on('end', () => {
            const body = JSON.parse(data)
            expect(body.error).toBe('Service Unavailable')
            expect(body.message).toBe('Server is currently overloaded, please try again later.')
            expect(body.lagMs).toBeUndefined() // Hidden in production
            mw.stop()
            server.close(resolve)
          })
        } catch (err) {
          mw.stop()
          server.close()
          reject(err)
        }
      }).on('error', (err) => {
        mw.stop()
        server.close()
        reject(err)
      })
    })
  })
})

test('nativeOverloadProtection passes error to next(err) when errorPropagationMode is true', async () => {
  const app = express()
  const mw = createNativeOverloadProtection({
    maxEventLoopDelayMs: -1,
    errorPropagationMode: true,
    production: false
  })
  app.use(mw)

  // Express error handler
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    expect(err).toBeInstanceOf(Error)
    expect(err.message).toBe('Server Overloaded')
    expect(err.status).toBe(503)
    expect(err.statusCode).toBe(503)
    expect(err.details).toBeDefined()
    expect(err.details.error).toBe('Service Unavailable')
    expect(err.expose).toBe(true)
    res.status(503).json({ handled: true, details: err.details })
  })

  const server = http.createServer(app)
  await new Promise((resolve, reject) => {
    server.listen(0, () => {
      const port = server.address().port
      http.get(`http://localhost:${port}/test`, (res) => {
        try {
          expect(res.statusCode).toBe(503)
          let data = ''
          res.on('data', chunk => { data += chunk })
          res.on('end', () => {
            const body = JSON.parse(data)
            expect(body.handled).toBe(true)
            expect(body.details.message).toBe('Server is currently overloaded, please try again later.')
            mw.stop()
            server.close(resolve)
          })
        } catch (err) {
          mw.stop()
          server.close()
          reject(err)
        }
      }).on('error', (err) => {
        mw.stop()
        server.close()
        reject(err)
      })
    })
  })
})

test('nativeOverloadProtection does not set Retry-After when clientRetrySecs is 0', async () => {
  const app = express()
  const mw = createNativeOverloadProtection({
    maxEventLoopDelayMs: -1,
    clientRetrySecs: 0
  })
  app.use(mw)

  const server = http.createServer(app)
  await new Promise((resolve, reject) => {
    server.listen(0, () => {
      const port = server.address().port
      http.get(`http://localhost:${port}/test`, (res) => {
        try {
          expect(res.statusCode).toBe(503)
          expect(res.headers['retry-after']).toBeUndefined()
          mw.stop()
          server.close(resolve)
        } catch (err) {
          mw.stop()
          server.close()
          reject(err)
        }
      }).on('error', (err) => {
        mw.stop()
        server.close()
        reject(err)
      })
    })
  })
})

test('exposes native monitor properties and lifecycle methods', () => {
  const mw = createNativeOverloadProtection({ maxEventLoopDelayMs: 42, clientRetrySecs: 5 })
  expect(typeof mw.stop).toBe('function')
  expect(mw.eventLoopMonitor).toBeDefined()
  expect(typeof mw.eventLoopDelay).toBe('number')
  expect(typeof mw.overload).toBe('boolean')
  expect(typeof mw.eventLoopOverload).toBe('boolean')
  expect(mw.maxEventLoopDelayMs).toBe(42)
  expect(mw.clientRetrySecs).toBe(5)
  mw.stop()

  // Also test getters on the static function export
  expect(nativeOverloadProtection.eventLoopMonitor).toBeDefined()
  expect(typeof nativeOverloadProtection.eventLoopDelay).toBe('number')
  expect(typeof nativeOverloadProtection.overload).toBe('boolean')
  expect(typeof nativeOverloadProtection.eventLoopOverload).toBe('boolean')
  nativeOverloadProtection.stop()
})

test('can be mounted directly as zero-config middleware: app.use(nativeOverloadProtection)', async () => {
  const app = express()
  app.use(nativeOverloadProtection)
  app.get('/health', (req, res) => res.json({ healthy: true }))

  const server = http.createServer(app)
  await new Promise((resolve, reject) => {
    server.listen(0, () => {
      const port = server.address().port
      http.get(`http://localhost:${port}/health`, (res) => {
        try {
          expect(res.statusCode).toBe(200)
          let data = ''
          res.on('data', chunk => { data += chunk })
          res.on('end', () => {
            expect(JSON.parse(data)).toEqual({ healthy: true })
            nativeOverloadProtection.stop()
            server.close(resolve)
          })
        } catch (err) {
          nativeOverloadProtection.stop()
          server.close()
          reject(err)
        }
      }).on('error', (err) => {
        nativeOverloadProtection.stop()
        server.close()
        reject(err)
      })
    })
  })
})

test('handles raw http res without res.status or res.json helper functions', () => {
  const mw = createNativeOverloadProtection({ maxEventLoopDelayMs: -1, clientRetrySecs: 3 })
  let endPayload = ''
  const headers = {}

  const req = {}
  const res = {
    setHeader (k, v) { headers[k] = v },
    end (data) { endPayload = data }
  }

  mw(req, res, () => {})
  expect(res.statusCode).toBe(503)
  expect(headers['Retry-After']).toBe('3')
  expect(headers['Content-Type']).toBe('application/json')
  const parsed = JSON.parse(endPayload)
  expect(parsed.error).toBe('Service Unavailable')
  mw.stop()
})

test('protect defaults to native when called with options object or "native"', () => {
  const instance1 = protect({ maxEventLoopDelayMs: 42 })
  expect(instance1.maxEventLoopDelayMs).toBe(42)
  instance1.stop()

  const instance2 = protect('native', { maxEventLoopDelayMs: 25 })
  expect(instance2.maxEventLoopDelayMs).toBe(25)
  instance2.stop()

  expect(protect.nativeOverloadProtection).toBe(nativeOverloadProtection)
})
