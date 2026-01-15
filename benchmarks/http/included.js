'use strict'

const http = require('http')
const server = http.createServer(serve)
const protect = require('../..')('http')

function serve (req, res) {
  if (protect(req, res) === true) return
  res.end('content')
}

module.exports = server
