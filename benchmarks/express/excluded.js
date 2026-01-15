import express from 'express'

const app = express()

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

export default app
