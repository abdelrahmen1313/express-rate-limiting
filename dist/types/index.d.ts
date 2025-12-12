import type { Request, Response, NextFunction } from "express";
/**
 * Represents a snapshot of a client's rate limiting state
 */
export interface IClientSnapshot {
    clientIpAddress: string;
    timestamp: number;
    hits: number;
    maxHits: number;
}
/**
 * Configuration options for the rate limiter
 */
export interface RateLimiterConfig {
    /** Maximum number of requests allowed per time window */
    maxRequests: number;
    /** Time window in minutes (default: 1) */
    windowInMinutes?: number;
    /** Custom function to extract IP from request (default: uses req.ip) */
    getClientIp?: (req: Request) => string | undefined;
    /** Custom error message (default: "Too many requests, please try again later") */
    errorMessage?: string;
    /** Whether to clean up stale entries periodically (default: true) */
    enableCleanup?: boolean;
    /** Interval for cleanup in minutes (default: 5) */
    cleanupIntervalMinutes?: number;
    /** Control if the api should send X-RATE-LIMIT HEADERS (default : true) */
    showInformativeHeaders?: boolean;
}
/**
 * Status of the rate limiter check
 */
export interface RateLimitStatus {
    allowed: boolean;
    remaining: number;
    resetAt: number;
}
/**
 * Express middleware handler type
 */
export type RateLimitMiddleware = (req: Request, res: Response, next: NextFunction) => void | Promise<void>;
/**
 * Options for creating the middleware with optional skip predicate
 */
export interface MiddlewareOptions extends RateLimiterConfig {
    /** Function to determine if a request should skip rate limiting */
    skip?: (req: Request) => boolean;
}
declare global {
    namespace Express {
        interface Request {
            rateLimit?: {
                remaining: number;
                resetAt: number;
            };
        }
    }
}
//# sourceMappingURL=index.d.ts.map