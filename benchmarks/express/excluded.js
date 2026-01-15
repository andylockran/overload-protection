'use strict'

const app = require('express')()

app.get('/', function (req, res) {
  res.send('content')
})

module.exports = app
