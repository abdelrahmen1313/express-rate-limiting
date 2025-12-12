"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRateLimiterMiddleware = createRateLimiterMiddleware;
const RateLimiter_1 = require("../core/RateLimiter");
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
function createRateLimiterMiddleware(config) {
    var _a;
    const rateLimiter = new RateLimiter_1.RateLimiter(config);
    const defaultGetClientIp = (req) => {
        var _a, _b, _c;
        return ((_b = (_a = req.headers["x-forwarded-for"]) === null || _a === void 0 ? void 0 : _a.split(",")[0]) === null || _b === void 0 ? void 0 : _b.trim()) || ((_c = req.socket) === null || _c === void 0 ? void 0 : _c.remoteAddress) || req.ip;
    };
    const getClientIp = config.getClientIp || defaultGetClientIp;
    const errorMessage = config.errorMessage || "Too many requests, please try again later";
    const showInformativeHeaders = (_a = config.showInformativeHeaders) !== null && _a !== void 0 ? _a : true;
    return (req, res, next) => {
        // Check if this request should skip rate limiting
        if (config.skip && config.skip(req)) {
            return next();
        }
        const clientIp = getClientIp(req);
        if (!clientIp) {
            console.warn("[RateLimiter] Could not determine client IP");
            res.status(500).end();
            return;
        }
        const { status } = rateLimiter.checkRateLimit(clientIp);
        // Set rate limit headers for client awareness
        if (showInformativeHeaders) {
            res.setHeader("X-RateLimit-Limit", config.maxRequests);
            res.setHeader("X-RateLimit-Remaining", status.remaining);
            res.setHeader("X-RateLimit-Reset", Math.ceil(status.resetAt / 1000));
        }
        if (!status.allowed) {
            res.status(429).json({
                error: errorMessage,
                retryAfter: Math.ceil((status.resetAt - Date.now()) / 1000),
            });
            return;
        }
        // Attach rate limit info to request for downstream handlers
        ;
        req.rateLimit = {
            remaining: status.remaining,
            resetAt: status.resetAt,
        };
        next();
    };
}
exports.default = createRateLimiterMiddleware;
