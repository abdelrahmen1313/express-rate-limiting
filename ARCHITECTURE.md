# Rate Limiter Architecture

## Overview

The module follows a layered architecture pattern for maximum flexibility and testability:

\`\`\`
Express Layer (Middleware)
       ↓
Logic Layer (RateLimiter)
       ↓
Data Layer (ClientSnapshot)
       ↓
Storage (Map)
\`\`\`

## Components

### ClientSnapshot

- **Purpose**: Immutable data model representing a client's rate limit state
- **Responsibility**: Store and compute client metrics
- **Key Methods**:
  - `isWindowExpired()` - Check if time window has elapsed
  - `incrementHits()` - Create new snapshot with incremented counter
  - `isRateLimited()` - Check if limit exceeded

### RateLimiter

- **Purpose**: Core rate limiting logic
- **Responsibility**: Manage client snapshots and enforce limits
- **Features**:
  - Automatic window expiration detection
  - Periodic cleanup of stale entries
  - In-memory storage (can be extended for Redis, etc.)

### Middleware Factory

- **Purpose**: Express integration point
- **Responsibility**: Extract IP, call RateLimiter, format responses
- **Features**:
  - Standard HTTP headers (`X-RateLimit-*`)
  - 429 status code for rate-limited requests
  - Attachable context on Request object

## Design Patterns

### Immutability

ClientSnapshot instances are immutable. Updates create new instances:

\`\`\`typescript
const snapshot = new ClientSnapshot(...);
const updated = snapshot.incrementHits(); // New instance
\`\`\`

### Factory Pattern

Middleware is created via factory function:

\`\`\`typescript
const middleware = createRateLimiterMiddleware(config);
\`\`\`

### Strategy Pattern

IP extraction is pluggable:

\`\`\`typescript
{
  getClientIp: (req) => customIpLogic(req)
}
\`\`\`

## Extension Points

### Custom IP Extraction

\`\`\`typescript
getClientIp: (req) => {
  // Custom logic
}
\`\`\`

### Conditional Skipping

\`\`\`typescript
skip: (req) => {
  // Determine if request should be skipped
}
\`\`\`

### Alternative Storage

Extend RateLimiter to use Redis:

\`\`\`typescript
class RedisRateLimiter extends RateLimiter {
  checkRateLimit(clientIp: string) {
    // Use Redis instead of Map
  }
}
\`\`\`

## Complexity Analysis

| Operation | Complexity | Notes |
|-----------|-----------|-------|
| Check limit | O(1) | Map lookup by IP |
| Store snapshot | O(1) | Map insertion |
| Cleanup | O(n) | Linear scan, runs on interval |
| Get active clients | O(n) | Filter expired entries |

## Memory Usage

For 100,000 concurrent clients tracking 100 requests each:

\`\`\`
ClientSnapshot: ~150 bytes
Map overhead: ~200 bytes per entry
Total: ~350 bytes per client

100,000 clients × 350 bytes = ~35 MB
\`\`\`

Actual usage will vary based on engine implementation.
