import http from 'http'

const server = http.createServer(serve)

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

function serve (req, res) {
  cpuWork(5)
  res.end('content')
}

export default server
