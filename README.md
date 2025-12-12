# Express Rate Limiter

A production-ready, type-safe rate limiter middleware for Express.js applications built with TypeScript.

## Features

- ✅ **Type-Safe** - Full TypeScript support with comprehensive types
- ✅ **Lightweight** - Minimal dependencies, only requires Express
- ✅ **Flexible** - Configurable time windows and request limits
- ✅ **Memory Efficient** - Automatic cleanup of expired entries
- ✅ **Proxy Support** - Handles `X-Forwarded-For` headers and custom IP extraction
- ✅ **Standards Compliant** - Returns standard rate limit headers (`X-RateLimit-*`)
- ✅ **Per-Route Control** - Apply to specific routes or globally
- ✅ **Observable** - Access rate limit status in downstream handlers

## Installation

```bash
npm install @edah/express-rate-limiting
```

## Quick Start

```typescript
import express from 'express';
import { createRateLimiterMiddleware } from '@yourorg/express-rate-limiter';

const app = express();

const rateLimiter = createRateLimiterMiddleware({
  maxRequests: 100,
  windowInMinutes: 15,
});

// Apply globally
app.use(rateLimiter);

// Or apply to specific routes
app.use('/api', rateLimiter);

app.listen(3000);
```

## Configuration

### Basic Options

```typescript
interface RateLimiterConfig {
  maxRequests: number;           // Max requests per window (required)
  windowInMinutes?: number;      // Time window in minutes (default: 1)
  enableCleanup?: boolean;       // Enable automatic cleanup (default: true)
  cleanupIntervalMinutes?: number; // Cleanup interval (default: 90)
  showInformativeHeaders?: boolean  //  Control if the api should send X-RATE-LIMIT HEADERS (default : true) 

}
```

### Advanced Options

```typescript
interface MiddlewareOptions extends RateLimiterConfig {
  // Custom function to extract client IP
  getClientIp?: (req: Request) => string;
  
  // Custom error message
  errorMessage?: string;
  
  // Skip rate limiting for specific requests
  skip?: (req: Request) => boolean;
}
```

## Examples

### Basic Usage

```typescript
const rateLimiter = createRateLimiterMiddleware({
  maxRequests: 100,
  windowInMinutes: 15,
});

app.use(rateLimiter);
\```

### Custom IP Extraction

For applications behind proxies (Cloudflare, AWS ALB, etc.):

```typescript
const rateLimiter = createRateLimiterMiddleware({
  maxRequests: 100,
  windowInMinutes: 15,
  getClientIp: (req) => {
    return (
      req.headers['cf-connecting-ip'] || // Cloudflare
      req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      req.socket?.remoteAddress || req.ip
      
    );
  },
});
```

### Skip Specific Paths

```typescript
const rateLimiter = createRateLimiterMiddleware({
  maxRequests: 100,
  windowInMinutes: 15,
  skip: (req) => {
    return req.path === '/health' || req.path.startsWith('/admin');
  },
});
```

### Per-Route Rate Limits

```typescript
const apiLimiter = createRateLimiterMiddleware({
  maxRequests: 50,
  windowInMinutes: 5,
});

const authLimiter = createRateLimiterMiddleware({
  maxRequests: 5,
  windowInMinutes: 15,
});

app.use('/api', apiLimiter);
app.post('/auth/login', authLimiter, (req, res) => {
  // Handle login
});
```

## Response Behavior

### Allowed Request

Response includes rate limit headers:

```yaml
HTTP/1.1 200 OK
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 99
X-RateLimit-Reset: 1702123456
```

Request object includes rate limit info:

```typescript
req.rateLimit = {
  remaining: 99,
  resetAt: 1702123456000,
};
```

### Rate Limited Request

```yaml
HTTP/1.1 429 Too Many Requests
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1702123456

{
  "error": "Too many requests, please try again later",
  "retryAfter": 300
}
```

## How It Works

1. **Request arrives** - Middleware extracts client IP
2. **Check storage** - Looks up client's current snapshot
3. **Validate window** - If window expired, creates new snapshot; otherwise increments hits
4. **Check limit** - Compares hits against maxRequests
5. **Response** - Returns 429 if limited, otherwise adds headers and continues

### Window Behavior

- When a client first makes a request, a **time window starts**
- All requests within that window **share the same counter**
- Once the window expires (time elapsed ≥ windowInMinutes), **counter resets**
- The **exact time window** for each client is tracked individually

## Memory Management

The middleware automatically cleans up expired entries:

- Cleanup runs every 5 minutes by default (configurable)
- Only expired snapshots are removed
- Can be disabled with `enableCleanup: false` if managing memory differently

## Monitoring

Get active clients and statistics:

```bash
npm install @edah/express-rate-limiting
```

```typescript
import { RateLimiter } from '@edah/express-rate-limiting';

const limiter = new RateLimiter({
  maxRequests: 100,
  windowInMinutes: 15,
import { createRateLimiterMiddleware } from '@edah/express-rate-limiting';

const activeClients = limiter.getActiveClients();
const clientCount = limiter.getClientCount();

console.log(`Active clients: ${clientCount}`);
```

## Performance Considerations

- **O(1) lookups** - Client snapshots use Map for constant-time access
- **Minimal overhead** - Lightweight class instances, no external I/O
- **Automatic cleanup** - Prevents unbounded memory growth
- **No external dependencies** - Only requires Express

import { RateLimiter } from 'express-rate-limiting';

- [ ] Choose appropriate `maxRequests` and `windowInMinutes` for your API
- [ ] Configure `getClientIp` for your infrastructure (cloud provider, proxy setup)
- [ ] Set `skip` function for health checks and internal endpoints
- [ ] Monitor active clients for spikes or anomalies
- [ ] Set up logging/monitoring for 429 responses
- [ ] Consider different limits for different endpoints

## License

MIT
