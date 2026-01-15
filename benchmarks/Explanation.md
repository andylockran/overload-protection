# Benchmark Explanation

This document explains the demo and comparison benchmarks for overload-protection, how they work, and how to interpret their results.

## Overview

These benchmarks demonstrate how overload protection prevents cascade failures in Node.js applications by monitoring event loop delay and automatically shedding load when the system becomes overloaded.

---

## Demo Benchmark (`npm run benchmark:demo`)

### Purpose

An interactive, educational demonstration showing overload protection in action with real-time feedback.

### How It Works

The demo runs three consecutive load phases against a protected server:

1. **Light Load (10 connections, 5s)**
   - Normal operating conditions
   - Event loop stays responsive (< 42ms delay)
   - All requests accepted with 200 OK

2. **Heavy Load (100 connections, 10s)**
   - Intentionally overwhelming the server
   - Event loop delay exceeds 42ms threshold
   - Protection kicks in, rejecting requests with 503

3. **Recovery (20 connections, 5s)**
   - Reduced load allows recovery
   - Event loop delay drops below threshold
   - System returns to accepting requests

### Real-Time Monitoring

The demo includes a monitoring loop that detects state changes:

```
🚨 OVERLOAD DETECTED - Event loop delay: 58.3ms (threshold: 42ms)
   → Now rejecting requests with 503...

✓ RECOVERED - Event loop delay: 35.2ms
   → Accepting requests again...
```

### Key Metrics Displayed

For each phase, you'll see:
- **Total Requests**: How many requests were made
- **Accepted (200)**: Successfully processed requests
- **Rejected (503)**: Load-shed requests
- **Throughput**: Requests per second
- **Latency avg**: Mean response time

### Expected Behavior

**Light Load:**
- 100% acceptance rate
- Low, consistent latency
- No overload detection

**Heavy Load:**
- High rejection rate (50-80% typical)
- Overload state: TRUE
- Fast 503 responses maintain low latency
- Protected requests still complete successfully

**Recovery:**
- Acceptance rate increases as delay drops
- System stabilizes
- No more overload warnings

### Why This Matters

This demonstrates the **fail-fast principle**: by quickly rejecting requests the server can't handle, the system:
- Maintains responsiveness for accepted requests
- Prevents request queue buildup
- Allows graceful recovery
- Avoids total collapse under sustained load

---

## Comparison Benchmark (`npm run benchmark:compare`)

### Purpose

A quantitative, side-by-side comparison showing the concrete benefits of overload protection.

### How It Works

Runs identical heavy load tests (50 connections, 10 seconds) against:

1. **Protected Server** - with overload-protection middleware
2. **Unprotected Server** - without middleware

Both servers have the same CPU-intensive work per request (~5ms).

### Comparison Table

The benchmark outputs a formatted comparison table:

```
┌─────────────────────┬──────────────┬────────────────┐
│ Metric              │ Protected    │ Unprotected    │
├─────────────────────┼──────────────┼────────────────┤
│ Total Requests      │ 8432         │ 8521           │
│ Successful (200)    │ 3201         │ 8521           │
│ Rejected (503)      │ 5231         │ 0              │
│ Avg Latency (ms)    │ 118.4        │ 292.7          │
│ P99 Latency (ms)    │ 156.2        │ 1843.5         │
│ Throughput (req/s)  │ 843          │ 852            │
└─────────────────────┴──────────────┴────────────────┘
```

### Understanding the Results

#### Total Requests
- Usually similar between both
- Shows both servers received comparable load

#### Successful vs Rejected
- **Protected**: Mix of 200s and 503s
  - 503s = load shedding working
  - Fast rejection prevents cascade failures
- **Unprotected**: All 200s (accepted everything)
  - Seems better, but actually a problem
  - All requests queued, causing delays

#### Latency (The Critical Metric)

**Average Latency:**
- Protected: Lower or comparable
- Rejected requests complete instantly (503)
- Accepted requests process normally

**P99 Latency:**
- Protected: Stays reasonable (2-3x average)
- Unprotected: Can spike dramatically (10-100x average)
- **This is the key difference!**

#### Why P99 Matters

The 99th percentile latency shows what users experience in the worst cases:

- **Protected P99**: 156ms
  - Predictable performance
  - Most requests still complete quickly
  - System remains responsive

- **Unprotected P99**: 1843ms
  - Some users wait nearly 2 seconds
  - Indicates request queue buildup
  - System struggling, could cascade to failure

### Real-World Impact

In production, the P99 latency difference means:

1. **User Experience**
   - Protected: Consistent, predictable response times
   - Unprotected: Some users experience extreme delays

2. **Cascade Failures**
   - Protected: Fails fast, other services stay healthy
   - Unprotected: Slow responses cause upstream timeouts, retry storms

3. **Recovery**
   - Protected: Immediate recovery when load decreases
   - Unprotected: Long recovery time as queued requests drain

### The Trade-off

Yes, protected servers reject some requests (503), but:
- Clients can retry (Retry-After header tells them when)
- Rejected requests complete in <1ms vs queueing for seconds
- Load balancers can route to other instances
- System maintains health for requests it CAN handle

**Better to reject 50% fast than accept 100% slowly!**

---

## CPU Work Simulation

Both benchmarks use realistic CPU-intensive work per request:

```javascript
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
```

This ~5ms of CPU work per request:
- Simulates real application processing (database queries, computations, etc.)
- Blocks the event loop, allowing delay to accumulate
- Creates realistic overload conditions
- Without this, tests wouldn't trigger protection reliably

---

## Configuration

### Protection Thresholds

```javascript
{
  maxEventLoopDelay: 42,     // milliseconds
  sampleInterval: 5,         // check every 5ms
  clientRetrySecs: 1         // tell clients to retry after 1 second
}
```

### Load Parameters

| Benchmark | Connections | Duration | Total Requests |
|-----------|-------------|----------|----------------|
| Demo - Light | 10 | 5s | ~2,000 |
| Demo - Heavy | 100 | 10s | ~8,000 |
| Demo - Recovery | 20 | 5s | ~2,000 |
| Compare | 50 | 10s | ~8,000 |

---

## Common Questions

### Why so many 503 errors?

This is **expected and desired**! The middleware is doing its job by shedding load. In production:
- Clients retry with the `Retry-After` header
- Load balancers route to other instances
- The server stays healthy instead of collapsing

### Why does protected server have lower throughput?

It doesn't necessarily - it depends on the metric:
- **Total throughput**: May be slightly lower (rejecting some requests)
- **Successful throughput**: Often higher (no queue buildup)
- **Sustained throughput**: Much higher (no collapse under load)

### Wouldn't horizontal scaling solve this?

Scaling helps, but:
- Protection is still needed per instance
- Traffic spikes can hit before scaling activates
- Cost-effective to handle bursts with protection
- Acts as a safety net during scaling delays

### What about legitimate traffic?

That's why we have the `Retry-After` header! Legitimate clients:
- See 503 + Retry-After: 1
- Wait 1 second and retry
- Get through once system recovers
- Better UX than hanging/timing out

---

## Interpreting Your Results

### Good Signs (Protection Working)
✓ P99 latency stays reasonable during heavy load  
✓ System recovers quickly when load decreases  
✓ Mix of 200s and 503s under heavy load  
✓ Overload detection messages during stress  

### Warning Signs (Tune Thresholds)
⚠ All requests accepted even under 100 connections (threshold too high)  
⚠ All requests rejected even under light load (threshold too low)  
⚠ Constant oscillation between overload/normal (tune sampleInterval)  

### System-Specific Factors

Results vary based on:
- **CPU**: Faster CPUs handle more load before overload
- **Node.js version**: V8 optimizations affect event loop
- **OS load**: Other processes impact event loop timing
- **Hardware**: Thermal throttling, resource contention

---

## Next Steps

After running these benchmarks:

1. **Understand the trade-offs**: Fast rejection vs slow acceptance
2. **Tune thresholds**: Adjust `maxEventLoopDelay` for your workload
3. **Test in staging**: Use real traffic patterns
4. **Monitor in production**: Track rejection rates and latency
5. **Set up retry logic**: Ensure clients respect Retry-After headers

Remember: **Overload protection is about graceful degradation, not preventing all failures.** It keeps your system responsive under stress, which is critical for production reliability.
