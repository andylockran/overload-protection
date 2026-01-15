'use strict'

const Koa = require('koa')
const Router = require('@koa/router')
const protect = require('../..')('koa')

const router = new Router()
const app = new Koa()

app.use(protect)

router.get('/', async function (ctx) {
  ctx.body = 'content'
})

app.use(router.routes())
app.listen(3000, function () {
  const req = require('http').get('http://localhost:3000')

  req.on('response', function (res) {
    console.log('got status code', res.statusCode)
    console.log('retry after', res.headers['retry-after'])

    setTimeout(function () {
      console.log('protect.overload after load', protect.overload)
      const req = require('http').get('http://localhost:3000')

      req.on('response', function (res) {
        console.log('got status code', res.statusCode)

        protect.stop()
        process.exit()
      }).end()
    }, parseInt(res.headers['retry-after'], 10))
  }).end()

  setImmediate(function () {
    console.log('eventLoopDelay after active sleeping', protect.eventLoopDelay)
  })

  sleep(500)
})

function sleep (msec) {
  const start = Date.now()
  while (Date.now() - start < msec) {}
}
