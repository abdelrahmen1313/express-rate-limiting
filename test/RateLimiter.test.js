const test = require("node:test")
const assert = require("node:assert/strict")
const { RateLimiter } = require("../dist/index.js")

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
/** express-style helper: express a duration in milliseconds as minutes */
const minutes = (ms) => ms / 60_000

test("first request from a new client is allowed and reports maxRequests-1 remaining", () => {
  const limiter = new RateLimiter({ maxRequests: 3, enableCleanup: false })
  const { snapshot, status } = limiter.checkRateLimit("1.1.1.1")

  assert.equal(snapshot.hits, 1)
  assert.equal(status.allowed, true)
  assert.equal(status.remaining, 2)
  assert.ok(status.resetAt > Date.now())
  assert.equal(limiter.getClientCount(), 1)
})

test("clients are tracked independently", () => {
  const limiter = new RateLimiter({ maxRequests: 3, enableCleanup: false })
  limiter.checkRateLimit("a")
  limiter.checkRateLimit("a")
  const { status } = limiter.checkRateLimit("b")

  assert.equal(status.allowed, true)
  assert.equal(status.remaining, 2) // b has its own quota, unaffected by a's traffic
  assert.equal(limiter.getClientCount(), 2)
})

test("current behaviour: a client is rejected at hit number maxRequests", () => {
  // NOTE: this documents a known off-by-one (see code review): with maxRequests: 3
  // only 2 requests get through, even though `remaining` promised one more.
  const limiter = new RateLimiter({ maxRequests: 3, enableCleanup: false })
  const results = []
  for (let i = 0; i < 5; i++) {
    results.push(limiter.checkRateLimit("a").status.allowed)
  }

  assert.deepEqual(results, [true, true, false, false, false])
})

test("intended: all maxRequests requests inside a window should be allowed", {
  skip: "known bug: isRateLimited() uses hits >= maxHits, so the last slot of every window is rejected",
}, () => {
  const limiter = new RateLimiter({ maxRequests: 3, enableCleanup: false })
  const results = []
  for (let i = 0; i < 4; i++) {
    results.push(limiter.checkRateLimit("a").status.allowed)
  }

  assert.deepEqual(results, [true, true, true, false])
})

test("getStatus returns null for unknown clients and never mutates state", () => {
  const limiter = new RateLimiter({ maxRequests: 3, enableCleanup: false })

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
    enableCleanup: false,
  })

  limiter.checkRateLimit("a")
  assert.notEqual(limiter.getStatus("a"), null)

  await sleep(250)

  assert.equal(limiter.getStatus("a"), null)
  assert.equal(limiter.getClientCount(), 1) // stale entry is kept until cleanup
  assert.deepEqual(limiter.getActiveClients(), [])
})

test("an expired window grants a fresh quota", async () => {
  const limiter = new RateLimiter({
    maxRequests: 3,
    windowInMinutes: minutes(100),
    enableCleanup: false,
  })

  assert.equal(limiter.checkRateLimit("a").status.allowed, true)
  assert.equal(limiter.checkRateLimit("a").status.allowed, true)
  assert.equal(limiter.checkRateLimit("a").status.allowed, false)

  await sleep(250)

  const { snapshot, status } = limiter.checkRateLimit("a")
  assert.equal(snapshot.hits, 1) // window restarted from scratch
  assert.equal(status.allowed, true)
  assert.equal(status.remaining, 2)
})

test("resetClient and resetAll clear state", () => {
  const limiter = new RateLimiter({ maxRequests: 3, enableCleanup: false })
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

test("cleanup removes expired entries when enabled", async () => {
  const limiter = new RateLimiter({
    maxRequests: 3,
    windowInMinutes: minutes(100),
    enableCleanup: true,
    cleanupIntervalMinutes: minutes(300),
  })

  limiter.checkRateLimit("a")
  limiter.checkRateLimit("b")
  assert.equal(limiter.getClientCount(), 2)

  await sleep(900) // window (100ms) expires long before the first cleanup tick (300ms)

  assert.equal(limiter.getClientCount(), 0)
})

test("enableCleanup:false keeps stale entries in memory", async () => {
  const limiter = new RateLimiter({
    maxRequests: 3,
    windowInMinutes: minutes(100),
    enableCleanup: false,
  })

  limiter.checkRateLimit("a")
  await sleep(250)

  assert.equal(limiter.getClientCount(), 1)
})

test("expired clients still count towards maxClients until cleanup runs", async () => {
  const limiter = new RateLimiter({
    maxRequests: 3,
    windowInMinutes: minutes(100),
    enableCleanup: false,
    maxClients: 1,
  })

  limiter.checkRateLimit("a")
  assert.equal(limiter.flagUserOverload(), false) // exactly maxClients -> not flagged

  limiter.checkRateLimit("b")
  assert.equal(limiter.flagUserOverload(), true)

  await sleep(250)

  assert.equal(limiter.getActiveClients().length, 0) // nobody is active...
  assert.equal(limiter.flagUserOverload(), true) // ...but the flag stays raised for everyone
})
