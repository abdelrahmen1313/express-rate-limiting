import test from "node:test"
import assert from "node:assert/strict"
import { createRateLimiterMiddleware } from "../dist/index.js"

const defaultConfig = {
  maxRequests: 3,
  windowInMinutes: 1,
  getSnapshotId: (req) => req.socket.remoteAddress,
}

function makeReq({ headers = {}, remoteAddress = "1.2.3.4", url = "/api", path = "/api" } = {}) {
  return {
    headers,
    socket: remoteAddress ? { remoteAddress } : {},
    url,
    path,
  }
}

function makeRes() {
  return {
    statusCode: 200,
    headers: {},
    body: undefined,
    jsonCalls: 0,
    ended: false,
    status(code) {
      this.statusCode = code
      return this
    },
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value
      return this
    },
    getHeader(name) {
      return this.headers[name.toLowerCase()]
    },
    json(payload) {
      this.jsonCalls += 1
      this.body = payload
      this.ended = true
      return this
    },
    end() {
      this.ended = true
      return this
    },
  }
}

function run(mw, req) {
  const res = makeRes()
  let nextCalls = 0
  mw(req, res, (err) => {
    if (err) throw err
    nextCalls += 1
  })
  return { req, res, nextCalls }
}

test("allows a request under the limit and attaches rate limit info", () => {
  const mw = createRateLimiterMiddleware(defaultConfig)
  const { req, res, nextCalls } = run(mw, makeReq())

  assert.equal(nextCalls, 1)
  assert.equal(res.statusCode, 200)
  assert.equal(res.getHeader("X-RateLimit-Limit"), 3)
  assert.equal(res.getHeader("X-RateLimit-Remaining"), 2)
  assert.ok(res.getHeader("X-RateLimit-Reset") > Math.floor(Date.now() / 1000))
  assert.ok(req.rateLimit.resetAt > Date.now())
  assert.equal(req.rateLimit.remaining, 2)
  assert.deepEqual(req.rateLimitInfos, { clientsCount: 1 })
})

test("allows exactly maxRequests requests, then answers 429 (off-by-one regression guard)", () => {
  const mw = createRateLimiterMiddleware({
    maxRequests: 3,
    windowInMinutes: 1,
    errorMessage: "slow down",
    getSnapshotId: (req) => req.socket.remoteAddress,
  })

  const first = run(mw, makeReq())
  const second = run(mw, makeReq())
  const third = run(mw, makeReq())
  const fourth = run(mw, makeReq())

  assert.equal(first.nextCalls, 1)
  assert.equal(second.nextCalls, 1)
  assert.equal(third.nextCalls, 1)
  assert.equal(third.req.rateLimit.remaining, 0)

  assert.equal(fourth.nextCalls, 0)
  assert.equal(fourth.res.statusCode, 429)
  assert.equal(fourth.res.jsonCalls, 1)
  assert.equal(fourth.res.body.error, "slow down")
  assert.ok(fourth.res.body.retryAfter >= 1)
  assert.ok(fourth.res.body.retryAfter <= 60)
  assert.equal(fourth.res.getHeader("X-RateLimit-Remaining"), 0)
  assert.equal(fourth.req.rateLimit, undefined) // rejected requests get no req.rateLimit
})

test("answers 429 with the default message when none is configured", () => {
  const mw = createRateLimiterMiddleware({
    maxRequests: 1,
    windowInMinutes: 1,
    getSnapshotId: (req) => req.socket.remoteAddress,
  })

  assert.equal(run(mw, makeReq()).nextCalls, 1) // the single allowed slot

  const second = run(mw, makeReq())
  assert.equal(second.res.statusCode, 429)
  assert.equal(second.res.body.error, "Too many requests, please try again later")
  assert.ok(second.res.body.retryAfter >= 1)
})

test("skip() routes are never rate limited", () => {
  const mw = createRateLimiterMiddleware({
    maxRequests: 3,
    windowInMinutes: 1,
    skip: (req) => req.path === "/health",
    getSnapshotId: (req) => req.socket.remoteAddress,
  })

  for (let i = 0; i < 5; i++) {
    const { res, nextCalls } = run(mw, makeReq({ path: "/health", url: "/health" }))
    assert.equal(nextCalls, 1)
    assert.equal(res.getHeader("X-RateLimit-Limit"), undefined)
  }

  const real = run(mw, makeReq())
  assert.equal(real.nextCalls, 1)
  assert.deepEqual(real.req.rateLimitInfos, { clientsCount: 1 }) // skipped calls never created a client
})

test("getSnapshotId keys clients independently", () => {
  const mw = createRateLimiterMiddleware({
    maxRequests: 3,
    windowInMinutes: 1,
    getSnapshotId: (req) => req.headers["x-tenant"],
  })

  const asTenant = () => run(mw, makeReq({ headers: { "x-tenant": "a" } }))
  assert.equal(asTenant().nextCalls, 1)
  assert.equal(asTenant().nextCalls, 1)
  assert.equal(asTenant().nextCalls, 1)
  assert.equal(asTenant().nextCalls, 0) // quota used up on the 4th request

  const otherTenant = run(mw, makeReq({ headers: { "x-tenant": "b" } }))
  assert.equal(otherTenant.nextCalls, 1)
  assert.deepEqual(otherTenant.req.rateLimitInfos, { clientsCount: 2 })
})

test("showInformativeHeaders:false omits the X-RateLimit headers but still limits", () => {
  const mw = createRateLimiterMiddleware({
    maxRequests: 1,
    windowInMinutes: 1,
    showInformativeHeaders: false,
    getSnapshotId: (req) => req.socket.remoteAddress,
  })

  const first = run(mw, makeReq())
  assert.equal(first.nextCalls, 1)
  assert.equal(first.res.getHeader("X-RateLimit-Limit"), undefined)
  assert.equal(first.res.getHeader("X-RateLimit-Remaining"), undefined)
  assert.equal(first.res.getHeader("X-RateLimit-Reset"), undefined)

  const second = run(mw, makeReq())
  assert.equal(second.res.statusCode, 429)
})
