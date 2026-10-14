import type { Request, Response, NextFunction } from "express"
import { RateLimiter } from "../core/RateLimiter.js"
import type { MiddlewareOptions, RateLimitMiddleware } from "../types/index.js"

/**
 * Factory function to create a rate limiter middleware for Express
 *
 * @param config Configuration options for the rate limiter
 * @returns Express middleware function
 */
export function createRateLimiterMiddleware(config: MiddlewareOptions): RateLimitMiddleware {
  const rateLimiter = new RateLimiter(config)


  const getSnapshotId = config.getSnapshotId
  const errorMessage = config.errorMessage || "Too many requests, please try again later"
  const showInformativeHeaders = config.showInformativeHeaders ?? true

  if (typeof getSnapshotId != "function") {
    throw new Error("Error: you must implement a getClientId function")
  }

  return (req: Request, res: Response, next: NextFunction): void => {
    // Check if this request should skip rate limiting
    if (config.skip && config.skip(req)) {
      return next()
    }

    const clientId = getSnapshotId(req)

    const { status } = rateLimiter.checkRateLimit(clientId)
    const ClientsCount = rateLimiter.getClientCount()

    // Set rate limit headers for client awareness
    if (showInformativeHeaders) {
      res.setHeader("X-RateLimit-Limit", config.maxRequests)
      res.setHeader("X-RateLimit-Remaining", status.remaining)
      res.setHeader("X-RateLimit-Reset", Math.ceil(status.resetAt / 1000))
    }

    if (!status.allowed) {
      res.status(429).json({
        error: errorMessage,
        retryAfter: Math.ceil((status.resetAt - Date.now()) / 1000),
      })
      return;
    }
    // Attach rate limit info to request for downstream handlers
    req.rateLimit = {
      remaining: status.remaining,
      resetAt: status.resetAt,
    };
    req.rateLimitInfos = {
      clientsCount: ClientsCount
    }

    next()
  }
}

export default createRateLimiterMiddleware
