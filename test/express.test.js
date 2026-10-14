import test from "node:test"
import assert from "node:assert"
import { once } from "node:events"
import { createRateLimiterMiddleware } from "../dist/index.js"
import express from "express";

test("end-to-end over HTTP: limits, headers and JSON error body", async (t) => {
  const app = express()
  // NOTE: without a custom getClientId each request gets its own uuid (per-request
  // client), so this test keys requests via the x-tenant header to exercise limits.
  const limiter = createRateLimiterMiddleware({
    maxRequests: 3,
    errorMessage: "too fast",
    getClientId: (req) => req.headers["x-tenant"] || "anonymous",
    skip: (req) => req.path === "/health",
  })

  app.get("/data", limiter, (req, res) => {
    res.json({ ok: true, rateLimit: req.rateLimit, infos: req.rateLimitInfos })
  })
  app.get("/health", limiter, (_req, res) => res.json({ status: "ok" }))

  const server = app.listen(0)
  await once(server, "listening")
  t.after(() => {
    server.close()
    server.closeAllConnections?.() // do not wait for keep-alive sockets
  })

  const base = `http://127.0.0.1:${server.address().port}`
  const tenantA = { headers: { "x-tenant": "a" } }

  const first = await fetch(`${base}/data`, tenantA)
  assert.equal(first.status, 200)
  assert.equal(first.headers.get("x-ratelimit-limit"), "3")
  assert.equal(first.headers.get("x-ratelimit-remaining"), "2")
  assert.ok(Number(first.headers.get("x-ratelimit-reset")) > Math.floor(Date.now() / 1000))
  const firstBody = await first.json()
  assert.equal(firstBody.ok, true)
  assert.equal(firstBody.rateLimit.remaining, 2)
  assert.deepEqual(firstBody.infos, { clientsCount: 1 })

  const second = await fetch(`${base}/data`, tenantA)
  assert.equal(second.status, 200)
  await second.body.cancel()

  const third = await fetch(`${base}/data`, tenantA)
  assert.equal(third.status, 200) // 3rd of 3 allowed requests now gets through
  const thirdBody = await third.json()
  assert.equal(thirdBody.rateLimit.remaining, 0)

  const fourth = await fetch(`${base}/data`, tenantA)
  assert.equal(fourth.status, 429)
  assert.equal(fourth.headers.get("x-ratelimit-remaining"), "0")
  const body = await fourth.json()
  assert.equal(body.error, "too fast")
  assert.ok(body.retryAfter >= 1)
  assert.ok(body.retryAfter <= 60)

  // skipped route never consumes quota
  for (let i = 0; i < 5; i++) {
    const health = await fetch(`${base}/health`)
    assert.equal(health.status, 200)
    await health.body.cancel()
  }
})
