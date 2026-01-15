import express from 'express'
import protect from '../../index.js'

const app = express()

app.use(protect('express'))

app.get('/', function (req, res) {
  res.send('content')
})

export default app
