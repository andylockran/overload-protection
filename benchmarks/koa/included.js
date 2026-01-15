import Koa from 'koa'
import Router from '@koa/router'
import protect from '../../index.js'

const protectMiddleware = protect('koa')
const router = new Router()
const app = new Koa()

app.use(protectMiddleware)

router.get('/', async function (ctx) {
  ctx.body = 'content'
})

app.use(router.routes())

export default app
