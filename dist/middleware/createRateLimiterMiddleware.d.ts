import type { MiddlewareOptions, RateLimitMiddleware } from "../types/index";
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
export declare function createRateLimiterMiddleware(config: MiddlewareOptions): RateLimitMiddleware;
export default createRateLimiterMiddleware;
