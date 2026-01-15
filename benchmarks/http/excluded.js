import http from 'http'

const server = http.createServer(serve)

function serve (req, res) {
  res.end('content')
}

export default server
