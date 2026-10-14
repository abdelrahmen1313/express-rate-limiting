import type { Request, Response, NextFunction } from "express"

/**
 * Represents a snapshot of a client's rate limiting state
 */
export interface IClientSnapshot {
  clientId: string
  timestamp: number
  hits: number
  maxHits: number,
}

/**
 * Configuration options for the rate limiter
 */
export interface RateLimiterConfig {
  /** Maximum number of requests allowed per time window */
  maxRequests: number
  /** Time window in minutes (default: 1) */
  windowInMinutes: number
  /** Custom error message (default: "Too many requests, please try again later") */
  errorMessage?: string
  /** Control if the api should send X-RATE-LIMIT HEADERS (default : true) */
  showInformativeHeaders?: boolean
  /** custom method to assign a client key (id) */
  getSnapshotId: (req: Request) => string
}

/**
 * Status of the rate limiter check
 */
export interface RateLimitStatus {
  allowed: boolean
  remaining: number
  resetAt: number
}

/**
 * Express middleware handler type
 */
export type RateLimitMiddleware = (req: Request, res: Response, next: NextFunction) => void | Promise<void>

/**
 * Options for creating the middleware with optional skip predicate
 */
export interface MiddlewareOptions extends RateLimiterConfig {
  /** Function to determine if a request should skip rate limiting */
  skip?: (req: Request) => boolean,
}

declare global {
  namespace Express {
    interface Request {
      rateLimit?: {
        remaining: number;
        resetAt: number;
      },
      rateLimitInfos?: {
        clientsCount: number
      };
    }
  }
}