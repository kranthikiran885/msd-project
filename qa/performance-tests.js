const axios = require('axios');

/**
 * PHASE 6: PERFORMANCE TESTING
 * Tests system under load and concurrent operations
 */

class PerformanceTests {
  constructor() {
    this.baseUrl = process.env.API_URL || 'http://localhost:3000';
    this.results = {
      loadTests: [],
      stressTests: [],
      passed: 0,
      failed: 0,
      metrics: {
        avgResponseTime: 0,
        minResponseTime: Infinity,
        maxResponseTime: 0,
        throughput: 0,
        errorRate: 0,
      },
    };
  }

  // Load Test 1: API Response Time
  async testAPIResponseTime() {
    console.log('[PERFORMANCE] Testing API Response Time...');
    
    const responseTimes = [];
    const iterations = 100;
    
    for (let i = 0; i < iterations; i++) {
      const startTime = Date.now();
      
      try {
        await axios.get(`${this.baseUrl}/api/health`);
        const duration = Date.now() - startTime;
        responseTimes.push(duration);
      } catch (error) {
        responseTimes.push(null);
      }
    }
    
    const validTimes = responseTimes.filter(t => t !== null);
    const avgTime = validTimes.reduce((a, b) => a + b, 0) / validTimes.length;
    const maxTime = Math.max(...validTimes);
    const minTime = Math.min(...validTimes);
    
    const passed = avgTime < 500; // Target: < 500ms average
    
    console.log(`  Response Time: Avg=${avgTime.toFixed(2)}ms, Min=${minTime}ms, Max=${maxTime}ms`);
    
    this.results.metrics.avgResponseTime = avgTime;
    this.results.metrics.minResponseTime = Math.min(this.results.metrics.minResponseTime, minTime);
    this.results.metrics.maxResponseTime = Math.max(this.results.metrics.maxResponseTime, maxTime);
    
    this.results.loadTests.push({
      name: 'API Response Time',
      passed,
      avgTime,
      minTime,
      maxTime,
      threshold: '< 500ms',
    });
    
    return passed;
  }

  // Load Test 2: Concurrent Requests
  async testConcurrentRequests() {
    console.log('[PERFORMANCE] Testing Concurrent Requests...');
    
    const concurrentCount = 50;
    const requests = [];
    const startTime = Date.now();
    
    for (let i = 0; i < concurrentCount; i++) {
      requests.push(axios.get(`${this.baseUrl}/api/health`).catch(() => null));
    }
    
    const results = await Promise.allSettled(requests);
    const duration = Date.now() - startTime;
    const successful = results.filter(r => r.status === 'fulfilled' && r.value?.status === 200).length;
    const successRate = (successful / concurrentCount) * 100;
    
    const passed = successRate >= 95; // 95%+ success rate
    
    console.log(`  Concurrent Requests: ${successful}/${concurrentCount} successful (${successRate.toFixed(1)}%) in ${duration}ms`);
    
    this.results.loadTests.push({
      name: 'Concurrent Requests',
      passed,
      successful,
      total: concurrentCount,
      successRate,
      duration,
    });
    
    return passed;
  }

  // Load Test 3: Database Query Performance
  async testDatabasePerformance() {
    console.log('[PERFORMANCE] Testing Database Query Performance...');
    
    const iterations = 50;
    const queryTimes = [];
    
    for (let i = 0; i < iterations; i++) {
      const startTime = Date.now();
      
      try {
        await axios.get(`${this.baseUrl}/api/projects`);
        const duration = Date.now() - startTime;
        queryTimes.push(duration);
      } catch (error) {
        queryTimes.push(null);
      }
    }
    
    const validTimes = queryTimes.filter(t => t !== null);
    const avgTime = validTimes.reduce((a, b) => a + b, 0) / validTimes.length;
    const maxTime = Math.max(...validTimes);
    
    const passed = avgTime < 200; // Target: < 200ms
    
    console.log(`  Database Query Time: Avg=${avgTime.toFixed(2)}ms, Max=${maxTime}ms`);
    
    this.results.loadTests.push({
      name: 'Database Query Performance',
      passed,
      avgTime,
      maxTime,
      threshold: '< 200ms',
    });
    
    return passed;
  }

  // Load Test 4: Memory Usage Under Load
  async testMemoryUsage() {
    console.log('[PERFORMANCE] Testing Memory Usage...');
    
    // This test simulates high memory usage scenario
    const requests = [];
    for (let i = 0; i < 100; i++) {
      requests.push(
        axios.post(`${this.baseUrl}/api/deployments`, {
          name: `load-test-${i}`,
          memory: 1024,
        }).catch(() => null)
      );
    }
    
    await Promise.allSettled(requests);
    
    // If system is still responsive, memory handling is good
    const health = await axios.get(`${this.baseUrl}/api/health`).catch(() => null);
    const passed = health?.status === 200;
    
    console.log(`  Memory Under Load: ${passed ? 'PASSED' : 'FAILED'}`);
    
    this.results.loadTests.push({
      name: 'Memory Usage Under Load',
      passed,
      description: 'System remained responsive under high memory load',
    });
    
    return passed;
  }

  // Stress Test 1: High Throughput
  async testHighThroughput() {
    console.log('[STRESS] Testing High Throughput...');
    
    const rps = 100; // Requests per second
    const duration = 10; // seconds
    const totalRequests = rps * duration;
    
    const startTime = Date.now();
    let completed = 0;
    let failed = 0;
    
    const makeRequests = async () => {
      for (let i = 0; i < rps; i++) {
        try {
          await axios.get(`${this.baseUrl}/api/health`);
          completed++;
        } catch (error) {
          failed++;
        }
      }
    };
    
    // Run for duration
    const intervals = [];
    for (let i = 0; i < duration; i++) {
      intervals.push(makeRequests());
      await this.sleep(1000);
    }
    
    await Promise.allSettled(intervals);
    const elapsedTime = (Date.now() - startTime) / 1000;
    const actualThroughput = completed / elapsedTime;
    const errorRate = (failed / (completed + failed)) * 100;
    
    const passed = actualThroughput >= rps * 0.8; // Allow 20% variance
    
    console.log(`  Throughput: ${actualThroughput.toFixed(2)} RPS (target: ${rps}), Error Rate: ${errorRate.toFixed(2)}%`);
    
    this.results.metrics.throughput = actualThroughput;
    this.results.metrics.errorRate = errorRate;
    
    this.results.stressTests.push({
      name: 'High Throughput',
      passed,
      actualThroughput,
      targetThroughput: rps,
      errorRate,
    });
    
    return passed;
  }

  // Stress Test 2: Sustained Load
  async testSustainedLoad() {
    console.log('[STRESS] Testing Sustained Load...');
    
    const duration = 30; // 30 seconds
    const requestsPerSecond = 20;
    
    const startTime = Date.now();
    let completed = 0;
    let failed = 0;
    const responseTimes = [];
    
    const sendRequest = async () => {
      const reqStart = Date.now();
      try {
        await axios.get(`${this.baseUrl}/api/health`);
        responseTimes.push(Date.now() - reqStart);
        completed++;
      } catch (error) {
        failed++;
      }
    };
    
    // Send requests continuously
    while ((Date.now() - startTime) < (duration * 1000)) {
      const requests = [];
      for (let i = 0; i < requestsPerSecond; i++) {
        requests.push(sendRequest());
      }
      await Promise.allSettled(requests);
      await this.sleep(1000);
    }
    
    const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    const errorRate = (failed / (completed + failed)) * 100;
    
    const passed = errorRate < 5 && avgResponseTime < 500;
    
    console.log(`  Sustained Load: ${completed} requests, Error Rate: ${errorRate.toFixed(2)}%, Avg Response: ${avgResponseTime.toFixed(2)}ms`);
    
    this.results.stressTests.push({
      name: 'Sustained Load',
      passed,
      totalRequests: completed,
      errorRate,
      avgResponseTime,
    });
    
    return passed;
  }

  // Stress Test 3: Recovery After Spike
  async testRecoveryAfterSpike() {
    console.log('[STRESS] Testing Recovery After Spike...');
    
    const normalLoad = 10; // Normal: 10 RPS
    const spikeLoad = 500; // Spike: 500 RPS
    const recoveryTime = 30; // Should recover in 30s
    
    // Normal load
    console.log('  Phase 1: Normal load...');
    let avgResponseTime1 = await this.measureResponseTime(normalLoad, 5);
    
    // Spike load
    console.log('  Phase 2: Spike load...');
    let avgResponseTime2 = await this.measureResponseTime(spikeLoad, 2);
    
    // Wait for recovery
    await this.sleep(recoveryTime * 1000);
    
    // Measure recovery
    console.log('  Phase 3: After recovery...');
    let avgResponseTime3 = await this.measureResponseTime(normalLoad, 5);
    
    const recovered = avgResponseTime3 <= avgResponseTime1 * 1.2; // Allow 20% variance
    
    console.log(`  Response times: Normal=${avgResponseTime1.toFixed(2)}ms → Spike=${avgResponseTime2.toFixed(2)}ms → Recovered=${avgResponseTime3.toFixed(2)}ms`);
    
    this.results.stressTests.push({
      name: 'Recovery After Spike',
      passed: recovered,
      normalLoad: avgResponseTime1,
      spikeLoad: avgResponseTime2,
      recoveredLoad: avgResponseTime3,
    });
    
    return recovered;
  }

  async measureResponseTime(rps, seconds) {
    const times = [];
    
    for (let s = 0; s < seconds; s++) {
      const requests = [];
      for (let i = 0; i < rps; i++) {
        const start = Date.now();
        requests.push(
          axios.get(`${this.baseUrl}/api/health`)
            .then(() => times.push(Date.now() - start))
            .catch(() => null)
        );
      }
      await Promise.allSettled(requests);
      await this.sleep(1000);
    }
    
    return times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async runAllTests() {
    console.log('\n╔════════════════════════════════════════════════════════╗');
    console.log('║          PHASE 6: PERFORMANCE TESTING IN PROGRESS      ║');
    console.log('╚════════════════════════════════════════════════════════╝\n');
    
    // Load Tests
    console.log('\n--- Load Tests ---');
    await this.testAPIResponseTime();
    await this.testConcurrentRequests();
    await this.testDatabasePerformance();
    await this.testMemoryUsage();
    
    // Stress Tests
    console.log('\n--- Stress Tests ---');
    await this.testHighThroughput();
    await this.testSustainedLoad();
    await this.testRecoveryAfterSpike();
    
    console.log(`\n✓ Performance Tests Complete`);
    console.log(`  Passed: ${this.results.passed}`);
    console.log(`  Failed: ${this.results.failed}`);
    console.log(`\n  Key Metrics:`);
    console.log(`  - Avg Response Time: ${this.results.metrics.avgResponseTime.toFixed(2)}ms`);
    console.log(`  - Throughput: ${this.results.metrics.throughput.toFixed(2)} RPS`);
    console.log(`  - Error Rate: ${this.results.metrics.errorRate.toFixed(2)}%`);
    
    return this.results;
  }
}

module.exports = PerformanceTests;
