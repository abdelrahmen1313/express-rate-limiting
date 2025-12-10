import type { Request, Response, NextFunction } from "express"
import { RateLimiter } from "../core/RateLimiter"
import type { MiddlewareOptions, RateLimitMiddleware } from "../types/index"

/**
 * Factory function to create a rate limiter middleware for Express
 *
 * @example
 * const rateLimiter = createRateLimiterMiddleware({
 *   maxRequests: 100,
 *   windowInMinutes: 15,
 * });
 *
 * app.use(rateLimiter);
 *
 * @example
 * // Skip rate limiting for specific paths
 * const rateLimiter = createRateLimiterMiddleware({
 *   maxRequests: 100,
 *   windowInMinutes: 15,
 *   skip: (req) => req.path === '/health',
 * });
 *
 * @param config Configuration options for the rate limiter
 * @returns Express middleware function
 */
export function createRateLimiterMiddleware(config: MiddlewareOptions): RateLimitMiddleware {
  const rateLimiter = new RateLimiter(config)

  const defaultGetClientIp = (req: Request): string => {
    return (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket?.remoteAddress || req.ip
  }

  const getClientIp = config.getClientIp || defaultGetClientIp
  const errorMessage = config.errorMessage || "Too many requests, please try again later"

  return (req: Request, res: Response, next: NextFunction): void => {
    // Check if this request should skip rate limiting
    if (config.skip && config.skip(req)) {
      return next()
    }

    const clientIp = getClientIp(req)

    if (!clientIp) {
      console.warn("[RateLimiter] Could not determine client IP")
      return next()
    }

    const { status } = rateLimiter.checkRateLimit(clientIp)

    // Set rate limit headers for client awareness
   // res.setHeader("X-RateLimit-Limit", config.maxRequests)
   // res.setHeader("X-RateLimit-Remaining", status.remaining)
   // res.setHeader("X-RateLimit-Reset", Math.ceil(status.resetAt / 1000))

    if (!status.allowed) {
      return res.status(429).json({
        error: errorMessage,
        retryAfter: Math.ceil((status.resetAt - Date.now()) / 1000),
      })
    }
    // Attach rate limit info to request for downstream handlers
    ;(req).rateLimit = {
      remaining: status.remaining,
      resetAt: status.resetAt,
    }

    next()
  }
}

export default createRateLimiterMiddleware
