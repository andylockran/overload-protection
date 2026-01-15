import express from 'express'

const app = express()

app.get('/', function (req, res) {
  res.send('content')
})

export default app
