import Koa from 'koa'
import Router from '@koa/router'

const router = new Router()
const app = new Koa()

router.get('/', async function (ctx) {
  ctx.body = 'content'
})

app.use(router.routes())

export default app
