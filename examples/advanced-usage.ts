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

  // Custom key extractor
  getClientId: (req: Request) => {
    return (
      crypto.randomUUID()
    )
  },

  // Skip rate limiting for health checks and internal endpoints
  skip: (req: Request) => {
    return req.path === "/health" || req.path === "/metrics"
  },

  // Cleanup expired records every 10 minutes -- default is 90
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
