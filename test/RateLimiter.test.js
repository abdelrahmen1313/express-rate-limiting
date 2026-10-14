

import test from "node:test"
import assert from "node:assert"
import { RateLimiter } from "../dist/index.js"

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const minutes = (ms) => ms / 60_000

test("first request from a new client is allowed and reports maxRequests-1 remaining", () => {
  const limiter = new RateLimiter({ windowInMinutes: 10, maxRequests: 3 })
  const { snapshot, status } = limiter.checkRateLimit("1.1.1.1")

  assert.equal(snapshot.hits, 1)
  assert.equal(status.allowed, true)
  assert.equal(status.remaining, 2)
  assert.ok(status.resetAt > Date.now())
  assert.equal(limiter.getClientCount(), 1)
})

test("clients are tracked independently", () => {
  const limiter = new RateLimiter({ windowInMinutes: 10, maxRequests: 3 })
  limiter.checkRateLimit("a")
  limiter.checkRateLimit("a")
  const { status } = limiter.checkRateLimit("b")

  assert.equal(status.allowed, true)
  assert.equal(status.remaining, 2) // b has its own quota, unaffected by a's traffic
  assert.equal(limiter.getClientCount(), 2)
})

test("a client is allowed exactly maxRequests requests per window", () => {
  // regression guard for the old off-by-one (isRateLimited used hits >= maxHits)
  const limiter = new RateLimiter({ windowInMinutes: 10, maxRequests: 3 })
  const results = []
  for (let i = 0; i < 5; i++) {
    results.push(limiter.checkRateLimit("a").status.allowed)
  }

  assert.deepEqual(results, [true, true, true, false, false])
})

test("getStatus returns null for unknown clients and never mutates state", () => {
  const limiter = new RateLimiter({ windowInMinutes: 10, maxRequests: 3 })

  assert.equal(limiter.getStatus("nope"), null)

  limiter.checkRateLimit("a")
  const first = limiter.getStatus("a")
  const second = limiter.getStatus("a")

  assert.equal(first.remaining, 2)
  assert.deepEqual(first, second)
  assert.equal(limiter.getClientCount(), 1) // peeking did not add hits
})

test("getStatus returns null once the window has expired", async () => {
  const limiter = new RateLimiter({
    maxRequests: 3,
    windowInMinutes: minutes(100),
  })

  limiter.checkRateLimit("a")
  assert.notEqual(limiter.getStatus("a"), null)

  await sleep(150)

  assert.equal(limiter.getStatus("a"), null)
  assert.equal(limiter.getClientCount(), 0) // cleanup runs on the same interval as the window
  assert.deepEqual(limiter.getActiveClients(), [])
})

test("an expired window grants a fresh quota", async () => {
  const limiter = new RateLimiter({
    maxRequests: 3,
    windowInMinutes: minutes(100),
  })

  for (let i = 0; i < 3; i++) {
    assert.equal(limiter.checkRateLimit("a").status.allowed, true)
  }
  assert.equal(limiter.checkRateLimit("a").status.allowed, false) // one over the limit

  await sleep(150)

  const { snapshot, status } = limiter.checkRateLimit("a")
  assert.equal(snapshot.hits, 1) // window restarted from scratch
  assert.equal(status.allowed, true)
  assert.equal(status.remaining, 2)
})

test("resetClient and resetAll clear state", () => {
  const limiter = new RateLimiter({ windowInMinutes: 10, maxRequests: 3 })
  limiter.checkRateLimit("a")
  limiter.checkRateLimit("b")

  limiter.resetClient("a")
  assert.equal(limiter.getClientCount(), 1)
  assert.equal(limiter.getStatus("a"), null)
  assert.equal(limiter.getStatus("b").remaining, 2) // b only spent one of its three slots

  limiter.resetAll()
  assert.equal(limiter.getClientCount(), 0)
  assert.equal(limiter.getStatus("b"), null)
})

test("cleanup removes expired entries ", async () => {
  const limiter = new RateLimiter({
    maxRequests: 3,
    windowInMinutes: minutes(100),
  })

  limiter.checkRateLimit("a")
  limiter.checkRateLimit("b")
  assert.equal(limiter.getClientCount(), 2)

  await sleep(150) // wait for the 100ms window and its cleanup interval

  assert.equal(limiter.getClientCount(), 0)
})



