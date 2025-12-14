# Express Rate Limiter

A production-ready, type-safe rate limiter middleware for Express.js applications built with TypeScript.

## Features

- ✅ **Type - Safe**

 -Full TypeScript support with comprehensive types

- ✅ **Lightweight**

  -Minimal dependencies, only requires Express

- ✅ **Flexible**

  -Configurable time windows and request limits

- ✅ **Memory Efficient**

  -Automatic cleanup of expired entries

- ✅ **Proxy Support**

  -Handles `X-Forwarded-For` headers and custom IP extraction

- ✅ **Standards Compliant**

  -Returns standard rate limit headers(`X-RateLimit-*`)

- ✅ **Per - Route Control**

  -Apply to specific routes or globally

- ✅ **Observable**

  -Access rate limit status in downstream handlers

## Installation

```bash
npm install @edah/express-rate-limiting
```

## Quick Start

```typescript
import express from 'express';
import { createRateLimiterMiddleware } from '@edah/express-rate-limiting';

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

```yaml

  maxRequests: number;             # Max requests per window (required)
  windowInMinutes?: number;        # Time window in minutes (default: 1)
  enableCleanup?: boolean;         # Enable automatic cleanup (default: true)
  cleanupIntervalMinutes?: number  # Cleanup interval in minutes (default: 5)
  showInformativeHeaders?: boolean #  Control if the api should send X-RATE-LIMIT HEADERS (default : true)
  maxClients?: number              # Maximum clients allowed per route  (default : 9999) 

```

## Examples

### Basic Usage

```typescript
const rateLimiter = createRateLimiterMiddleware({
  maxRequests: 100,
  windowInMinutes: 15,
});

app.use(rateLimiter);
```

### Advanced Options

``` typescript
const rateLimiter = createRateLimiterMiddleware({
    maxRequests: 50, windowInMinutes: 5, errorMessage: "API rate limit exceeded. Please wait before making more requests.",

    // Custom IP extractor for cloud environments
    getClientIp: (req : Request) => {
        return ((req.headers["cf-connecting-ip"]as string) || // Cloudflare
                (req.headers["x-forwarded-for"]as string)
            ?.split(",")[0]
                ?.trim() || req.socket
                    ?.remoteAddress || req.ip)
    },

    // Skip rate limiting for health checks and internal endpoints
    skip: (req : Request) => {
        return req.path === "/health" || req.path === "/metrics"
    },

    // Cleanup expired records every 10 minutes -- default is 5
    cleanupIntervalMinutes: 10
})
```

### Per-Route Rate Limits

``` typescript
const apiLimiter = createRateLimiterMiddleware({maxRequests: 50, windowInMinutes: 5});

const authLimiter = createRateLimiterMiddleware({maxRequests: 5, windowInMinutes: 15});

const pastaServiceLimiter = createRateLimiterMiddleware({maxRequests: 5, windowInMinutes: 10, maxClients : 100});

app.use('/api', apiLimiter);
app.post('/auth/login', authLimiter, (req, res) => {
    // Handle login
});
```

## Response Behavior

### Allowed Request

Response includes rate limit headers:

```yaml
HTTP / 1.1 200 OK
X - RateLimit - Limit : 100
X - RateLimit - Remaining : 99
X - RateLimit - Reset : 1702123456
```

Request object includes rate limit info:

```typescript

req.rateLimit = {
    remaining: 99,
    resetAt: 1702123456000
};

req.rateLimitInfos = {
    
    "clientsCount": 1
}

```

### Rate Limited Request

``` yaml
HTTP / 1.1 429 Too Many Requests
X - RateLimit - Limit : 100
X - RateLimit - Remaining : 0
X - RateLimit - Reset : 1702123456

{
"error" : "Too many requests, please try again later",
"retryAfter" : 300
}
```

## How It Works

1. **Request arrives** - Middleware extracts client IP
2. **Check storage** - Looks up client's current snapshot
3. **Validate window** - If window expired, creates new snapshot; otherwise increments hits
4. **Check limit** - Compares hits against maxRequests
5. **Response** - Returns 429 if limited, otherwise adds headers and continues

## Memory Management

The middleware automatically cleans up expired entries:

- Cleanup runs every 5 minutes by default (configurable)
- Only expired snapshots are removed
- Can be disabled with ` enableCleanup : false ` if managing memory differently

## Monitoring

Get active clients number :

``` typescript
app
.get("/", (req, res) => {

res.json({message: "Hello!", rateLimit: req.rateLimit, infos: req.rateLimitInfos})
})
```

## Performance Considerations

- **O(1) lookups** - Client snapshots use Map for constant-time access
- **Minimal overhead** - Lightweight class instances, no external I/O
- **Automatic cleanup** - Prevents unbounded memory growth
- **No external dependencies** - Only requires Express
- **Overrideable Methods** - You can use the skip() decorator to skip rate limiting internal routes

- [ ] Choose appropriate ` maxRequests ` and ` windowInMinutes ` for your API
- [ ] Configure ` getClientIp ` for your infrastructure (cloud provider, proxy setup)
- [ ] Monitor active clients for spikes or anomalies
- [ ] Set up logging/monitoring for 429 responses
- [ ] Consider different limits for different endpoints

## License

MIT
