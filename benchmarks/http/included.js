import http from 'http'
import protect from '../../index.js'

const protectMiddleware = protect('http')
const server = http.createServer(serve)

function serve (req, res) {
  if (protectMiddleware(req, res) === true) return
  res.end('content')
}

export default server
