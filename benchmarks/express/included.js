'use strict'

const app = require('express')()
const protect = require('../..')('express')

app.use(protect)

app.get('/', function (req, res) {
  res.send('content')
})

module.exports = app
