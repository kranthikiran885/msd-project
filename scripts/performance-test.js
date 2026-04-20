#!/usr/bin/env node

/**
 * MSD Platform - Performance Testing Script
 * Load testing, latency analysis, and stress testing
 */

const axios = require('axios');
const { performance } = require('perf_hooks');

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5000';

class PerformanceTester {
  constructor() {
    this.results = {
      requests: [],
      summary: {},
      bottlenecks: [],
    };
  }

  /**
   * Run load test with specified concurrent requests
   */
  async loadTest(url, endpoint, concurrency, duration) {
    console.log(`\n📊 Load Test: ${endpoint}`);
    console.log(`   Concurrency: ${concurrency}`);
    console.log(`   Duration: ${duration}s`);
    console.log('   Running...');

    const startTime = performance.now();
    const results = [];
    const endTime = Date.now() + duration * 1000;

    while (Date.now() < endTime) {
      const promises = [];

      for (let i = 0; i < concurrency; i++) {
        promises.push(this.measureRequest(url + endpoint));
      }

      const responses = await Promise.allSettled(promises);
      results.push(...responses);
    }

    const elapsedTime = (performance.now() - startTime) / 1000;
    const successCount = results.filter(r => r.status === 'fulfilled').length;
    const failureCount = results.filter(r => r.status === 'rejected').length;
    const totalRequests = successCount + failureCount;
    const successRate = (successCount / totalRequests * 100).toFixed(2);
    const requestsPerSecond = (totalRequests / elapsedTime).toFixed(2);

    // Calculate latency statistics
    const latencies = results
      .filter(r => r.status === 'fulfilled')
      .map(r => r.value);

    const avgLatency = (latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(2);
    const minLatency = Math.min(...latencies).toFixed(2);
    const maxLatency = Math.max(...latencies).toFixed(2);
    const p95Latency = this.percentile(latencies, 95).toFixed(2);
    const p99Latency = this.percentile(latencies, 99).toFixed(2);

    this.results.summary[endpoint] = {
      endpoint,
      totalRequests,
      successCount,
      failureCount,
      successRate: parseFloat(successRate),
      requestsPerSecond: parseFloat(requestsPerSecond),
      avgLatency: parseFloat(avgLatency),
      minLatency: parseFloat(minLatency),
      maxLatency: parseFloat(maxLatency),
      p95Latency: parseFloat(p95Latency),
      p99Latency: parseFloat(p99Latency),
      elapsedTime: parseFloat(elapsedTime.toFixed(2)),
    };

    console.log(`   Total Requests: ${totalRequests}`);
    console.log(`   Success Rate: ${successRate}%`);
    console.log(`   RPS: ${requestsPerSecond}`);
    console.log(`   Avg Latency: ${avgLatency}ms`);
    console.log(`   P95 Latency: ${p95Latency}ms`);
    console.log(`   P99 Latency: ${p99Latency}ms`);

    if (parseFloat(successRate) < 99) {
      this.results.bottlenecks.push({
        endpoint,
        issue: 'Low success rate',
        value: successRate,
      });
    }

    if (parseFloat(avgLatency) > 500) {
      this.results.bottlenecks.push({
        endpoint,
        issue: 'High average latency',
        value: avgLatency,
      });
    }
  }

  /**
   * Measure individual request performance
   */
  async measureRequest(url) {
    const startTime = performance.now();
    try {
      const response = await axios.get(url, { timeout: 5000 });
      const endTime = performance.now();
      return endTime - startTime;
    } catch (error) {
      throw new Error(`Request failed: ${error.message}`);
    }
  }

  /**
   * Calculate percentile value
   */
  percentile(arr, p) {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  /**
   * Stress test - gradually increase load until failure
   */
  async stressTest(url, endpoint) {
    console.log(`\n💥 Stress Test: ${endpoint}`);
    console.log('   Gradually increasing load...\n');

    const maxConcurrency = 100;
    const step = 10;
    let currentConcurrency = step;

    while (currentConcurrency <= maxConcurrency) {
      console.log(`   Testing with ${currentConcurrency} concurrent requests...`);

      const results = await Promise.allSettled(
        Array(currentConcurrency).fill(null).map(() => this.measureRequest(url + endpoint))
      );

      const successRate = (
        results.filter(r => r.status === 'fulfilled').length / results.length * 100
      ).toFixed(2);

      console.log(`   Success Rate: ${successRate}%`);

      if (parseFloat(successRate) < 95) {
        console.log(`   ⚠️  System starting to degrade at ${currentConcurrency} concurrent requests`);
        this.results.bottlenecks.push({
          endpoint,
          issue: 'Stress limit reached',
          concurrency: currentConcurrency,
          successRate: parseFloat(successRate),
        });
        break;
      }

      currentConcurrency += step;
    }

    if (currentConcurrency > maxConcurrency) {
      console.log(`   ✅ System stable under ${maxConcurrency}+ concurrent requests`);
    }
  }

  /**
   * Test API response payload sizes
   */
  async payloadTest(url, endpoint) {
    console.log(`\n📦 Payload Test: ${endpoint}`);

    try {
      const response = await axios.get(url + endpoint);
      const payloadSize = JSON.stringify(response.data).length;
      const payloadSizeKB = (payloadSize / 1024).toFixed(2);

      console.log(`   Payload Size: ${payloadSizeKB}KB`);

      if (payloadSize > 1024 * 100) { // 100KB
        this.results.bottlenecks.push({
          endpoint,
          issue: 'Large payload',
          sizeKB: parseFloat(payloadSizeKB),
        });
      }
    } catch (error) {
      console.log(`   ❌ Failed to retrieve payload: ${error.message}`);
    }
  }

  /**
   * Generate performance report
   */
  generateReport() {
    console.log('\n\n╔════════════════════════════════════════════════════════════╗');
    console.log('║       MSD Platform - Performance Test Report               ║');
    console.log('║                 ' + new Date().toLocaleString() + '                        ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    console.log('📈 TEST RESULTS:\n');

    Object.values(this.results.summary).forEach(result => {
      console.log(`${result.endpoint}`);
      console.log(`  Total Requests:    ${result.totalRequests}`);
      console.log(`  Success Rate:      ${result.successRate}%`);
      console.log(`  RPS:               ${result.requestsPerSecond}`);
      console.log(`  Avg Latency:       ${result.avgLatency}ms`);
      console.log(`  P95 Latency:       ${result.p95Latency}ms`);
      console.log(`  P99 Latency:       ${result.p99Latency}ms`);
      console.log('');
    });

    if (this.results.bottlenecks.length > 0) {
      console.log('⚠️  BOTTLENECKS IDENTIFIED:\n');
      this.results.bottlenecks.forEach(bottleneck => {
        console.log(`  ${bottleneck.endpoint}`);
        console.log(`    Issue: ${bottleneck.issue}`);
        if (bottleneck.value) console.log(`    Value: ${bottleneck.value}`);
        if (bottleneck.concurrency) console.log(`    Concurrency: ${bottleneck.concurrency}`);
      });
    } else {
      console.log('✅ NO BOTTLENECKS IDENTIFIED\n');
    }

    console.log('═══════════════════════════════════════════════════════════════\n');
  }

  /**
   * Run all performance tests
   */
  async runAll() {
    console.log('\n🚀 Starting MSD Platform Performance Tests\n');

    // Test backend endpoints
    await this.loadTest(BACKEND_URL, '/api/health', 10, 10);
    await this.loadTest(BACKEND_URL, '/api/deployments', 10, 10);
    await this.loadTest(BACKEND_URL, '/api/projects', 10, 10);

    // Stress test
    await this.stressTest(BACKEND_URL, '/api/health');

    // Payload tests
    await this.payloadTest(BACKEND_URL, '/api/projects');

    // Generate report
    this.generateReport();

    // Return status code
    return this.results.bottlenecks.length === 0 ? 0 : 1;
  }
}

// Main execution
const tester = new PerformanceTester();
tester.runAll().then(exitCode => process.exit(exitCode));

module.exports = PerformanceTester;
