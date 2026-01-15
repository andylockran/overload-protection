import autocannon from 'autocannon'
import included from './included.js'
import excluded from './excluded.js'

console.log('express with overload protection:')
const includedServer = included.listen(3000)
let instance = autocannon({
  url: 'http://localhost:3000',
  connections: 20,
  pipelining: 1,
  duration: 10
}, function () {
  instance.stop()
  includedServer.close()
  console.log('\nexpress without overload protection:')
  const excludedServer = excluded.listen(3000)
  instance = autocannon({
    url: 'http://localhost:3000',
    connections: 20,
    pipelining: 1,
    duration: 10
  }, function () {
    instance.stop()
    excludedServer.close()
  })
  autocannon.track(instance, { renderProgressBar: true, renderStatusCodes: true })
})

// just render results
autocannon.track(instance, { renderProgressBar: true, renderStatusCodes: true })
