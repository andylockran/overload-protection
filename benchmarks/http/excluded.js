'use strict'

const http = require('http')
const server = http.createServer(serve)

function serve (req, res) {
  res.end('content')
}

module.exports = server
