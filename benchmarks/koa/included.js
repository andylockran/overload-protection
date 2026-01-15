import Koa from 'koa'
import Router from '@koa/router'
import protect from '../../index.js'

const protectMiddleware = protect('koa')
const router = new Router()
const app = new Koa()

function cpuWork (ms) {
  const start = Date.now()
  while (Date.now() - start < ms) {
    let hash = 0
    for (let i = 0; i < 10000; i++) {
      for (let j = 0; j < 10; j++) {
        hash = ((hash << 5) - hash) + i * j
        hash = hash & hash
      }
    }
  }
}

app.use(protectMiddleware)

router.get('/', async function (ctx) {
  cpuWork(5)
  ctx.body = 'content'
})

app.use(router.routes())

export default app
