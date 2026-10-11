'use strict'

import Koa from 'koa'
import Router from '@koa/router'
import protectInit from '../../index.js'

const router = new Router()
const app = new Koa()
const protect = protectInit('koa')

app.use(protect)

router.get('/', async function (ctx) {
  ctx.body = 'content'
})

app.use(router.routes())

export default app
