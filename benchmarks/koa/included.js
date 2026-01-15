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

module.exports = app
