'use strict'

import autocannon from 'autocannon'
import includedApp from './included.js'
import excludedApp from './excluded.js'

console.log('express with overload protection:')
const included = includedApp.listen(3000)
let instance = autocannon({
  url: 'http://localhost:3000',
  connections: 10,
  pipelining: 1,
  duration: 10
}, function () {
  instance.stop()
  included.close()
  console.log('\nexpress without overload protection:')
  const excluded = excludedApp.listen(3000)
  instance = autocannon({
    url: 'http://localhost:3000',
    connections: 10,
    pipelining: 1,
    duration: 10
  }, function () {
    instance.stop()
    excluded.close()
  })
  autocannon.track(instance, { renderProgressBar: true })
})

autocannon.track(instance, { renderProgressBar: true })
