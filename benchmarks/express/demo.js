import autocannon from 'autocannon'
import included from './included.js'

console.log('\n=== OVERLOAD PROTECTION DEMO ===\n')
console.log('This demo shows real-time overload detection and load shedding.')
console.log('Watch for 503 responses when event loop delay exceeds threshold.\n')

const server = included.listen(3000)

// Monitor the protection state
let lastState = { overload: false, delay: 0, rejected: 0, accepted: 0 }
const monitor = setInterval(() => {
  const stats = {
    overload: included.overload || false,
    delay: included.eventLoopDelay || 0,
    rejected: 0,
    accepted: 0
  }
  
  if (stats.overload !== lastState.overload) {
    if (stats.overload) {
      console.log(`\n🚨 OVERLOAD DETECTED - Event loop delay: ${stats.delay.toFixed(1)}ms (threshold: ${included.maxEventLoopDelay}ms)`)
      console.log('   → Now rejecting requests with 503...')
    } else {
      console.log(`\n✓ RECOVERED - Event loop delay: ${stats.delay.toFixed(1)}ms`)
      console.log('   → Accepting requests again...')
    }
    lastState = stats
  }
}, 100)

console.log('Starting with LIGHT LOAD (10 connections)...\n')
let instance = autocannon({
  url: 'http://localhost:3000',
  connections: 10,
  pipelining: 1,
  duration: 5
}, function (err, result) {
  console.log('\n--- Light Load Results ---')
  printResults(result)
  
  console.log('\n\nNow increasing to HEAVY LOAD (100 connections)...')
  console.log('This should trigger overload protection!\n')
  
  instance = autocannon({
    url: 'http://localhost:3000',
    connections: 100,
    pipelining: 1,
    duration: 10
  }, function (err, result) {
    console.log('\n--- Heavy Load Results ---')
    printResults(result)
    
    console.log('\n\nDropping back to RECOVERY LOAD (20 connections)...')
    console.log('Watch the system recover!\n')
    
    instance = autocannon({
      url: 'http://localhost:3000',
      connections: 20,
      pipelining: 1,
      duration: 5
    }, function (err, result) {
      console.log('\n--- Recovery Load Results ---')
      printResults(result)
      
      clearInterval(monitor)
      server.close()
      
      console.log('\n=== DEMO COMPLETE ===\n')
      console.log('Summary: Overload protection automatically shed load during heavy')
      console.log('traffic by rejecting requests (503), preventing total system collapse.')
      console.log('The system recovered gracefully when load decreased.\n')
    })
    autocannon.track(instance, { renderProgressBar: false })
  })
  autocannon.track(instance, { renderProgressBar: false })
})
autocannon.track(instance, { renderProgressBar: false })

function printResults (result) {
  const total = result['2xx'] + result['5xx'] + result.non2xx
  const accepted = result['2xx']
  const rejected = result['5xx']
  const acceptRate = ((accepted / total) * 100).toFixed(1)
  const rejectRate = ((rejected / total) * 100).toFixed(1)
  
  console.log(`Total Requests: ${total}`)
  console.log(`✓ Accepted (200): ${accepted} (${acceptRate}%)`)
  console.log(`✗ Rejected (503): ${rejected} (${rejectRate}%)`)
  console.log(`Throughput: ${result.requests.mean.toFixed(0)} req/sec`)
  console.log(`Latency avg: ${result.latency.mean.toFixed(1)}ms`)
}
