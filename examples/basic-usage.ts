import express from "express"
import { createRateLimiterMiddleware } from "../src/index"

const app = express()

/**
 * Basic setup: 100 requests per 15 minutes
 */
const rateLimiter = createRateLimiterMiddleware({
  maxRequests: 100,
  windowInMinutes: 15,
})

app.use(rateLimiter)

app.get("/", (req, res) => {
  res.json({
    message: "Hello!",
    rateLimit: (req as any).rateLimit,
  })
})

app.listen(3000, () => {
  console.log("Server running on port 3000")
})
