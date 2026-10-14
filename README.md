# Express Rate Limiter
Type-safe rate limiter middleware for Express.js applications built with TypeScript.


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
  getClientId: (req : Request) => {
      return req.id;
   }
});

// Apply globally
app.use(rateLimiter);

// Or apply to specific routes
app.use('/api', rateLimiter);

app.listen(3000);
```


### Basic Options

```yaml
  getClientId : () => {} : string  # Your client id ingestion method (required)
  maxRequests:             number; # Max requests per window (required)
  windowInMinutes?:        number; # Time window in minutes (default: 1)
  showInformativeHeaders?: boolean # Control if the api should send X-RATE-LIMIT HEADERS (default : true)
  errorMessage? :          string  # Show custom error message (instead of "Too many requests, please try again later")

```

### Basic Usage

```typescript
const rateLimiter = createRateLimiterMiddleware({
  maxRequests: 100,
  windowInMinutes: 15,
  // Constructor method, assuming the request object already have a tenant id.
   getClientId: (req : Request) => {
      return req.id;
    },
});

app.use(rateLimiter);
```

### Advanced Options

``` typescript
const rateLimiter = createRateLimiterMiddleware({
     windowInMinutes: 5, errorMessage: "slow down",

    // Custom key extractor, assuming the request object already have a tenant id.
    getClientId: (req : Request) => {
      return req.id;
    },

    // Skip rate limiting for some endpoints.
    skip: (req : Request) => {
        return req.path === "/health" || req.path === "/metrics"
    },

})
```


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


## Memory Management

The middleware automatically cleans up expired entries:
- Cleanup cycles runs asynchronously within the windowMs interval.
- Only expired snapshots are removed.


## Contributing

Contributions are welcome!
If you'd like to improve this utility, fix bugs (if found), or suggest a new feature :

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature-name`)
3. Commit your changes (`git commit -m "feat: add my feature"`)
4. Push to your branch (`git push origin feature/my-feature-name`)
5. Open a pull request

Please follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/)

Feedback and suggestions help shape the roadmap.

## License

MIT
