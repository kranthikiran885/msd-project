# Phase 12: Advanced Load Balancing Implementation

## Overview
Phase 12 implements a production-grade load balancing system with multiple distribution strategies, health checking, session persistence, and comprehensive metrics. Works seamlessly with Phase 10 (Zero-Downtime) and Phase 11 (Auto Scaling) for a complete cluster management solution.

## What Was Implemented

### Services Created (2 core services)

#### 1. **loadBalancingService.js**
Core load balancing engine with multiple strategies and session management.

**Key Methods:**
- `createLoadBalancer()` - Configure load balancer for deployment
- `getLoadBalancer()` - Retrieve configuration
- `registerUpstream()` - Add container replica to pool
- `unregisterUpstream()` - Remove replica from pool
- `selectUpstream()` - Choose best upstream based on strategy
- `selectRoundRobin()` - Distribute requests evenly
- `selectLeastConnections()` - Route to replica with fewest connections
- `selectByIpHash()` - Sticky routing by client IP
- `selectWeighted()` - Weighted distribution
- `selectLeastResponseTime()` - Route based on response time
- `createSession()` - Create sticky session for client
- `getSession()` - Retrieve session assignment
- `updateSessionActivity()` - Extend session TTL
- `updateUpstreamHealth()` - Mark replica health status
- `updateUpstreamConnections()` - Track active connections
- `getStatistics()` - Retrieve load balancer metrics
- `startCleanupJob()` - Periodic session cleanup

**Strategies Supported:**
- **Round-Robin** - Evenly distribute across all upstreams
- **Least Connections** - Route to replica with fewest active connections
- **IP Hash** - Consistent hashing for sticky routing
- **Weighted** - Distribute based on configured weights
- **Least Response Time** - Route to fastest responding replica

#### 2. **lbHealthCheckService.js**
Continuous health checking and upstream status management.

**Key Methods:**
- `startHealthChecking()` - Begin health checks for load balancer
- `runHealthChecks()` - Execute health check against all upstreams
- `checkUpstream()` - Health check single replica
- `updateUpstreamStatus()` - Update health based on thresholds
- `handleStatusChange()` - Handle upstream becoming healthy/unhealthy
- `getHealthStatus()` - Get current health state
- `getActiveChecks()` - List running health check jobs
- `stopHealthChecking()` - Stop health checks

**Features:**
- Configurable HTTP/HTTPS health checks
- Custom health check paths
- Thresholds for marking up/down (consecutive failures/successes)
- Response time tracking with exponential moving average
- Automatic status transitions with cooldown
- Comprehensive failure history tracking

### Database Models Created (2 models)

#### 1. **LoadBalancer.js**
Configuration and state for load balancing per deployment.

**Fields:**
- `projectId`, `deploymentId` - References
- `name`, `strategy` - Configuration
- `healthCheck` - Interval, timeout, thresholds, path, protocol
- `upstreams[]` - Array of backend replicas with health/metrics
- `sessionPersistence` - Sticky session config (cookie/IP-hash/jessionid)
- `rateLimit` - Optional rate limiting per IP
- `connectionTimeout`, `keepAliveTimeout` - Connection settings
- `retryPolicy` - Retry configuration for failed requests
- `ssl` - SSL/TLS settings for upstream connections
- `metrics` - Aggregated load balancer metrics
- `enabled` - Whether load balancing is active

#### 2. **LoadBalancerSession.js**
Sticky session tracking for client affinity.

**Fields:**
- `loadBalancerId`, `deploymentId` - References
- `sessionId` - Unique session identifier
- `clientIp` - Client IP address
- `assignedUpstream` - Which replica is handling this session
- `createdAt`, `lastActivity` - Session timeline
- `expiresAt` - Session expiration (TTL index)
- `requestCount` - Requests in this session
- `totalBytesIn/Out` - Data transferred

### API Routes (1 route file)

**loadbalancer.js** - `/api/loadbalancer`
```
POST   /:deploymentId/config                       - Configure load balancer
GET    /:deploymentId/config                       - Get configuration
POST   /:deploymentId/upstream/register            - Add replica
POST   /:deploymentId/upstream/unregister          - Remove replica
POST   /:deploymentId/select                       - Choose best upstream
POST   /:deploymentId/upstream/health              - Update health status
POST   /:deploymentId/health/start                 - Start health checks
POST   /:deploymentId/health/stop                  - Stop health checks
GET    /:deploymentId/health/status                - Get health status
GET    /:deploymentId/stats                        - Get metrics
POST   /:deploymentId/session                      - Create session
GET    /:deploymentId/session/:sessionId           - Get session
POST   /:deploymentId/session/:sessionId/ping      - Update session
```

### Controller (1 controller)

**loadbalancerController.js** - Handles all load balancing endpoints with proper error handling and input validation.

## How Load Balancing Works

### Configuration Example

```bash
POST /api/loadbalancer/:deploymentId/config
{
  "name": "api-server-lb",
  "strategy": "least-connections",  # or round-robin, ip-hash, weighted, least-response-time
  "healthCheck": {
    "enabled": true,
    "interval": 10000,              # Check every 10 seconds
    "timeout": 5000,                # 5 second check timeout
    "unhealthyThreshold": 3,        # Mark down after 3 failures
    "healthyThreshold": 2,          # Mark up after 2 successes
    "path": "/health",
    "protocol": "http"
  },
  "sessionPersistence": {
    "enabled": true,
    "type": "cookie",
    "cookieName": "SESSIONID",
    "ttl": 3600000                  # 1 hour
  },
  "rateLimit": {
    "enabled": false,
    "requestsPerSecond": 1000,
    "burstSize": 100,
    "byIp": true
  },
  "connectionTimeout": 30000,
  "keepAliveTimeout": 60000,
  "retryPolicy": {
    "enabled": true,
    "maxRetries": 2,
    "retryOn": [500, 502, 503, 504]
  },
  "ssl": {
    "enabled": false,
    "verifyUpstream": false
  }
}
```

### Request Flow with Load Balancing

```
1. Client Request
        ↓
2. Load Balancer receives request
        ↓
3. Check for existing session (if persistence enabled)
   → Session found: Use sticky assignment
   → No session: Continue to step 4
        ↓
4. Apply selection strategy:
   - Round-Robin: Next in sequence
   - Least Connections: Fewest active connections
   - IP Hash: Consistent hash of client IP
   - Weighted: Based on configured weights
   - Least Response Time: Fastest responding
        ↓
5. Check upstream health:
   - Healthy: Route to selected upstream
   - Unhealthy: Skip and select next
        ↓
6. (Optional) Create session for future requests
        ↓
7. Route to upstream container
        ↓
8. Track connection count
        ↓
9. Update metrics and response time
        ↓
10. Deliver response to client
```

### Health Checking Flow

```
Health Check Loop (every 10 seconds)
    ↓
For each upstream:
    ↓
Send HTTP GET to /health endpoint
    ↓
Track response (success/failure)
    ↓
Success Count:
  - Increment on 2xx response
  - Reset on failure
  
Failure Count:
  - Increment on non-2xx or timeout
  - Reset on success
    ↓
Status Transition:
  - successCount >= healthyThreshold → Mark HEALTHY
  - failureCount >= unhealthyThreshold → Mark UNHEALTHY
    ↓
Update Metrics:
  - Response time (exponential moving average)
  - Downtime tracking
  - Update last health check time
```

### Load Balancing Strategies Comparison

| Strategy | Best For | Behavior |
|----------|----------|----------|
| **Round-Robin** | Even load distribution | Cycles through upstreams sequentially |
| **Least Connections** | Variable request durations | Routes to replica with fewest active connections |
| **IP Hash** | Session affinity without persistence | Same client always goes to same replica (hash-based) |
| **Weighted** | Heterogeneous servers | Distributes based on configured weights |
| **Least Response Time** | Performance optimization | Routes to fastest responding replica |

## Integration with Previous Phases

### With Phase 10 (Zero-Downtime Deployments)
```
Blue-Green Deployment with Load Balancing:
1. Phase 10 creates new Blue environment
2. Phase 12 load balancer knows about both Blue and Green
3. Health checks verify both are ready
4. Traffic switch: Load balancer routes to Blue
5. Phase 10 handles cleanup
```

### With Phase 11 (Auto Scaling)
```
Auto-Scaling with Load Balancing:
1. Phase 11 detects high load, scales up replicas
2. Phase 12 automatically discovers new replicas
3. New replicas registered as upstreams
4. Load balancer begins routing to new replicas
5. Health checks monitor new replicas
6. Phase 11 scales down when load decreases
7. Phase 12 unregisters and drains old replicas
```

## Session Persistence (Sticky Sessions)

### Session Flow

```
1. Client makes first request
   ↓
2. Load balancer selects upstream (e.g., replica-1)
   ↓
3. Create session: sessionId → replica-1
   ↓
4. Return sessionId to client (in cookie or header)
   ↓
5. Client makes second request with sessionId
   ↓
6. Load balancer looks up sessionId
   ↓
7. Finds sticky assignment: replica-1
   ↓
8. Route request directly to replica-1
   ↓
9. Continue for session lifetime (TTL)
   ↓
10. On expiration, create new session
```

### Session Identifier Types
- **Cookie**: SESSIONID cookie sent to client
- **IP-Hash**: Consistent hash of client IP (no session storage)
- **jsessionid**: Java servlet session ID (web framework integration)

## Health Check Examples

### HTTP Health Check
```bash
GET /health HTTP/1.1
Host: replica-1:3000

Response:
HTTP/1.1 200 OK
Content-Type: application/json
{"status": "healthy", "uptime": 3600000}
```

### Health Status Response
```bash
GET /api/loadbalancer/:deploymentId/health/status

{
  "loadBalancerId": "...",
  "deploymentId": "...",
  "checkedAt": "2024-04-20T12:00:00Z",
  "healthCheckConfig": {
    "interval": 10000,
    "timeout": 5000,
    "unhealthyThreshold": 3
  },
  "upstreams": [
    {
      "host": "replica-1",
      "port": 3000,
      "healthy": true,
      "downSince": null,
      "lastHealthCheck": "2024-04-20T12:00:00Z",
      "averageResponseTime": 145,
      "recentCheckHistory": {
        "successCount": 5,
        "failureCount": 0,
        "lastCheck": "2024-04-20T12:00:00Z"
      }
    }
  ]
}
```

## Metrics Tracked

Per Load Balancer:
- `totalRequests` - Total requests handled
- `totalErrors` - Total failed requests
- `averageResponseTime` - Mean response time
- `p95ResponseTime` - 95th percentile
- `p99ResponseTime` - 99th percentile
- `activeConnections` - Current active connections
- `requestsPerSecond` - Throughput metric

Per Upstream:
- `activeConnections` - Current connections to this replica
- `totalRequests` - Cumulative request count
- `failedRequests` - Request failures
- `averageResponseTime` - Replica response time
- `healthy` - Current health status
- `downSince` - When it went down (if unhealthy)

## Rate Limiting (Optional)

When enabled, load balancer can rate limit:
- **Global Rate Limit**: Max requests/second across all clients
- **Per-IP Rate Limit**: Max requests/second per client IP
- **Burst Allowance**: Temporary burst above sustained rate

## Retry Configuration

Failed requests can be retried with configurable:
- `maxRetries`: Maximum number of retry attempts
- `retryOn`: HTTP status codes to trigger retry (e.g., 503, 504)

## Connection Management

### Keep-Alive
- `connectionTimeout`: How long to wait before closing idle connection
- `keepAliveTimeout`: How long to keep persistent connection open
- `maxRequestsPerConnection`: Max requests before closing connection

### Backpressure
- `maxConnections`: Maximum concurrent connections per upstream
- Excess requests queued or rejected based on policy

## File Created

**Services (2):**
- `/server/services/loadBalancingService.js` (432 lines)
- `/server/services/lbHealthCheckService.js` (278 lines)

**Models (2):**
- `/server/models/LoadBalancer.js`
- `/server/models/LoadBalancerSession.js`

**Routes (1):**
- `/server/routes/loadbalancer.js` (98 lines)

**Controllers (1):**
- `/server/controllers/loadbalancerController.js` (328 lines)

**Updated Files:**
- `/server/index.js` - Added loadbalancer route registration

## Total Implementation
- 2 production-grade services (710 lines)
- 2 MongoDB models with proper indexing
- 1 route module with 13 endpoints
- 1 controller with 13 handler methods
- Multiple load balancing strategies
- Health checking with status transitions
- Session persistence with TTL
- Comprehensive metrics tracking
- Rate limiting support
- Retry policy configuration

This Phase 12 implementation provides AWS ELB/ALB-level load balancing with intelligent distribution, health checking, and session affinity for production deployments working with auto-scaling and zero-downtime deployment systems.
