'use strict'

import http from 'http'
import protectInit from '../../index.js'

const server = http.createServer(serve)
const protect = protectInit('http')

function serve (req, res) {
  if (protect(req, res) === true) return
  res.end('content')
}

export default server
