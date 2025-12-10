import express, { type Request } from "express"
import { createRateLimiterMiddleware } from "../src/index"

const app = express()

/**
 * Advanced setup with custom options:
 * - Custom IP extraction (useful for proxies)
 * - Skip rate limiting for specific paths
 * - Custom error message
 */
const rateLimiter = createRateLimiterMiddleware({
  maxRequests: 50,
  windowInMinutes: 5,
  errorMessage: "API rate limit exceeded. Please wait before making more requests.",

  // Custom IP extractor for cloud environments
  getClientIp: (req: Request) => {
    return (
      (req.headers["cf-connecting-ip"] as string) || // Cloudflare
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
      req.socket?.remoteAddress || req.ip ||
      "unknown"
    )
  },

  // Skip rate limiting for health checks and internal endpoints
  skip: (req: Request) => {
    return req.path === "/health" || req.path === "/metrics"
  },

  // Cleanup expired records every 10 minutes
  cleanupIntervalMinutes: 10,
})

// Apply to specific routes
app.use("/api", rateLimiter)

app.get("/health", (req, res) => {
  res.json({ status: "ok" })
})

app.get("/api/data", (req, res) => {
  const rateLimit = (req as any).rateLimit
  res.json({
    data: "some data",
    remainingRequests: rateLimit.remaining,
  })
})

app.listen(3000, () => {
  console.log("Server running on port 3000")
})
