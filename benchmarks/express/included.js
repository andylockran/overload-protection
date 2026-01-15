import express from 'express'
import protect from '../../index.js'

const app = express()

const protectMiddleware = protect('express', {
  maxEventLoopDelay: 42,
  sampleInterval: 5,
  logging: false
})

app.use(protectMiddleware)

function cpuWork (ms) {
  const start = Date.now()
  while (Date.now() - start < ms) {
    let hash = 0
    for (let i = 0; i < 10000; i++) {
      for (let j = 0; j < 10; j++) {
        hash = ((hash << 5) - hash) + i * j
        hash = hash & hash
      }
    }
  }
}

app.get('/', function (req, res) {
  cpuWork(5)
  res.send('content')
})

// Expose protection state for monitoring
app.overload = protectMiddleware.overload
app.eventLoopDelay = protectMiddleware.eventLoopDelay
app.maxEventLoopDelay = protectMiddleware.maxEventLoopDelay

// Make state accessible in real-time
Object.defineProperty(app, 'overload', {
  get: () => protectMiddleware.overload
})
Object.defineProperty(app, 'eventLoopDelay', {
  get: () => protectMiddleware.eventLoopDelay
})

export default app
