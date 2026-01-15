'use strict'
const autocannon = require('autocannon')

const included = require('./included')
const excluded = require('./excluded')

console.log('http with overload protection:')
included.listen(3000)
let instance = autocannon({
  url: 'http://localhost:3000',
  connections: 10,
  pipelining: 1,
  duration: 10
}, function () {
  instance.stop()
  included.close()
  console.log('\nhttp without overload protection:')
  excluded.listen(3000)
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

// just render results
autocannon.track(instance, { renderProgressBar: true })
