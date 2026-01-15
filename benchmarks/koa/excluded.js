'use strict'

const Koa = require('koa')
const Router = require('@koa/router')

const router = new Router()
const app = new Koa()

router.get('/', async function (ctx) {
  ctx.body = 'content'
})

app.use(router.routes())

module.exports = app
