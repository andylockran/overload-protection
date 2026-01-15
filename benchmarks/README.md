# Overload Protection Benchmarks

This directory contains benchmarks demonstrating the effectiveness of overload protection under various load conditions.

## Overview

The benchmarks show how overload protection prevents cascade failures by:
- Monitoring event loop delay in real-time
- Automatically rejecting requests (503) when thresholds are exceeded
- Allowing the system to recover gracefully as load decreases

## Available Benchmarks

### 1. Interactive Demo (`npm run benchmark:demo`)

**Best for: Understanding how protection works**

This runs a progressive load test showing:
1. **Light load** (10 connections) - normal operation
2. **Heavy load** (100 connections) - triggers overload protection
3. **Recovery** (20 connections) - system recovers

Watch the real-time console output to see when overload is detected and when the system recovers.

```bash
npm run benchmark:demo
```

### 2. Side-by-Side Comparison (`npm run benchmark:compare`)

**Best for: Quantifying the benefits**

Runs identical heavy load tests against:
- Protected server (with overload-protection middleware)
- Unprotected server (without middleware)

Outputs a comparison table showing:
- Request acceptance/rejection rates
- Average and P99 latency
- Throughput
- Total requests processed

```bash
npm run benchmark:compare
```

### 3. All Framework Tests (`npm run benchmarks`)

**Best for: Framework-specific testing**

Runs the standard benchmark suite for all supported frameworks:
- Express
- Native HTTP
- Koa

Each test compares protected vs unprotected performance.

```bash
npm run benchmarks
```

## What to Look For

### Protected Server Behavior
- ✓ **Fast rejection**: 503 responses return immediately with low latency
- ✓ **Consistent P99**: Latency remains predictable even under heavy load
- ✓ **Graceful recovery**: System automatically accepts requests again when delay drops

### Unprotected Server Behavior
- ✗ **Request queueing**: All requests queue up, causing cascading delays
- ✗ **Latency spikes**: P99 latency can become extremely high
- ✗ **Potential failure**: System may become completely unresponsive

## CPU Work Simulation

Each request performs ~5ms of CPU-intensive work (nested loops with hash calculations) to simulate realistic server processing. This ensures the event loop actually gets blocked under load, triggering the protection mechanism.

## Understanding the Results

**High rejection rate (503s) is expected and desirable** - it means the protection is working! In production:
- Rejected requests can retry (using the `Retry-After` header)
- Load balancers can route to other instances
- The server remains responsive for requests it CAN handle
- Prevents total system collapse and cascade failures

## Configuration

The benchmarks use these protection thresholds:
- `maxEventLoopDelay`: 42ms (default)
- `sampleInterval`: 5ms
- Connections vary by test (10-100)
- Duration: 5-10 seconds per phase

You can modify these in the individual benchmark files to test different scenarios.
