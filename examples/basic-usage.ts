import express from "express"
import { createRateLimiterMiddleware } from "../src/index"

const app = express()

/**
 * Basic setup: 100 requests per 15 minutes
 */
const rateLimiter = createRateLimiterMiddleware({
  maxRequests: 3,
  windowInMinutes: 2,
})

app.use(rateLimiter)

app.get("/", (req, res) => {

  res.json({
    message: "Hello!",
    rateLimit: req.rateLimit,
    infos : req.rateLimitInfos
  })
})

app.listen(3000, () => {
  console.log("Server running on port 3000")
})
