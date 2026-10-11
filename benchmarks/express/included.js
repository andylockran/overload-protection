'use strict'

import express from 'express'
import protectInit from '../../index.js'

const app = express()
const protect = protectInit('express')

app.use(protect)

app.get('/', function (req, res) {
  res.send('content')
})

export default app
