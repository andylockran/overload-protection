import autocannon from 'autocannon'
import included from './included.js'
import excluded from './excluded.js'

console.log('\n=== OVERLOAD PROTECTION COMPARISON ===\n')
console.log('Testing the same heavy load against protected vs unprotected servers.')
console.log('Goal: Show how protection prevents cascade failures.\n')

async function runTest (name, server, connections, duration) {
  return new Promise((resolve) => {
    console.log(`Running ${name}...`)
    const instance = autocannon({
      url: 'http://localhost:3000',
      connections,
      pipelining: 1,
      duration
    }, function (err, result) {
      if (err) {
        console.error('Error during autocannon run:', err)
      }
      resolve(result)
    })
    autocannon.track(instance, { renderProgressBar: false })
  })
}

async function main () {
  // Test with protection
  console.log('\n📊 TEST 1: WITH OVERLOAD PROTECTION\n')
  const protectedServer = included.listen(3000)

  const protectedResult = await runTest('Heavy load (50 connections)', protectedServer, 50, 10)

  protectedServer.close()

  console.log('\nResults:')
  printResults(protectedResult, 'PROTECTED')

  // Wait a bit for port to be released
  await new Promise(resolve => setTimeout(resolve, 1000))

  // Test without protection
  console.log('\n\n📊 TEST 2: WITHOUT OVERLOAD PROTECTION\n')
  const unprotectedServer = excluded.listen(3000)

  const unprotectedResult = await runTest('Heavy load (50 connections)', unprotectedServer, 50, 10)

  unprotectedServer.close()

  console.log('\nResults:')
  printResults(unprotectedResult, 'UNPROTECTED')

  // Comparison
  console.log('\n\n=== COMPARISON ===\n')

  const protectedTotal = protectedResult['2xx'] + protectedResult['5xx'] + protectedResult.non2xx
  const unprotectedTotal = unprotectedResult['2xx'] + unprotectedResult['5xx'] + unprotectedResult.non2xx

  console.log('┌─────────────────────┬──────────────┬────────────────┐')
  console.log('│ Metric              │ Protected    │ Unprotected    │')
  console.log('├─────────────────────┼──────────────┼────────────────┤')
  console.log(`│ Total Requests      │ ${pad(protectedTotal)} │ ${pad(unprotectedTotal)} │`)
  console.log(`│ Successful (200)    │ ${pad(protectedResult['2xx'])} │ ${pad(unprotectedResult['2xx'])} │`)
  console.log(`│ Rejected (503)      │ ${pad(protectedResult['5xx'])} │ ${pad(unprotectedResult['5xx'])} │`)
  console.log(`│ Avg Latency (ms)    │ ${pad(protectedResult.latency.mean.toFixed(1))} │ ${pad(unprotectedResult.latency.mean.toFixed(1))} │`)
  console.log(`│ P99 Latency (ms)    │ ${pad(protectedResult.latency.p99.toFixed(1))} │ ${pad(unprotectedResult.latency.p99.toFixed(1))} │`)
  console.log(`│ Throughput (req/s)  │ ${pad(protectedResult.requests.mean.toFixed(0))} │ ${pad(unprotectedResult.requests.mean.toFixed(0))} │`)
  console.log('└─────────────────────┴──────────────┴────────────────┘')

  console.log('\n💡 Key Insights:')
  console.log('   • Protected server sheds load early (503s) to maintain responsiveness')
  console.log('   • Lower P99 latency means protected server stays responsive')
  console.log('   • Unprotected server may queue all requests, causing higher latency')
  console.log('   • In production, this prevents cascade failures across services\n')
}

function printResults (result, label) {
  const total = result['2xx'] + result['5xx'] + result.non2xx
  const accepted = result['2xx']
  const rejected = result['5xx']
  const acceptRate = ((accepted / total) * 100).toFixed(1)
  const rejectRate = ((rejected / total) * 100).toFixed(1)

  console.log(`[${label}]`)
  console.log(`  Requests:  ${total} total (${accepted} accepted, ${rejected} rejected)`)
  console.log(`  Accept Rate: ${acceptRate}% | Reject Rate: ${rejectRate}%`)
  console.log(`  Throughput:  ${result.requests.mean.toFixed(0)} req/sec`)
  console.log(`  Latency:     avg ${result.latency.mean.toFixed(1)}ms, p99 ${result.latency.p99.toFixed(1)}ms`)
}

function pad (val, width = 12) {
  const str = String(val)
  return str + ' '.repeat(Math.max(0, width - str.length))
}

main().catch(console.error)
