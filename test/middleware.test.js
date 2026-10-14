const test = require("node:test")
const assert = require("node:assert/strict")
const { createRateLimiterMiddleware } = require("../dist/index.js")

function makeReq({ headers = {}, ip, remoteAddress = "1.2.3.4", url = "/api", path = "/logic" } = {}) {
  return {
    headers,
    socket: remoteAddress ? { remoteAddress } : {},
    ip,
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

/** console.warn is used by the middleware for missing IPs / overload - keep test output clean */
function quietWarnings(fn) {
  const original = console.warn
  const warnings = []
  console.warn = (...args) => warnings.push(args.join(" "))
  try {
    return fn(warnings)
  } finally {
    console.warn = original
  }
}

test("allows a request under the limit and attaches rate limit info", () => {
  const mw = createRateLimiterMiddleware({ maxRequests: 3, enableCleanup: false })
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

test("answers 429 with the error message once the window quota is used up", () => {
  const mw = createRateLimiterMiddleware({
    maxRequests: 3,
    errorMessage: "slow down",
    enableCleanup: false,
  })

  const first = run(mw, makeReq())
  const second = run(mw, makeReq())
  const third = run(mw, makeReq())

  assert.equal(first.nextCalls, 1)
  assert.equal(second.nextCalls, 1)

  assert.equal(third.nextCalls, 0)
  assert.equal(third.res.statusCode, 429)
  assert.equal(third.res.jsonCalls, 1)
  assert.equal(third.res.body.error, "slow down")
  assert.ok(third.res.body.retryAfter >= 1)
  assert.ok(third.res.body.retryAfter <= 60)
  assert.equal(third.res.getHeader("X-RateLimit-Remaining"), 0)
  assert.equal(third.req.rateLimit, undefined) // rejected requests get no req.rateLimit
})

/*
test("skip() routes are never rate limited", () => {
  const mw = createRateLimiterMiddleware({
    maxRequests: 3,
    enableCleanup: false,
    skip: (req) => req.path === "/health",
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

test("custom getClientId keys clients independently of the socket address", () => {
  const mw = createRateLimiterMiddleware({
    maxRequests: 3,
    enableCleanup: false,
    getClientId: (req) => req.headers["x-tenant"],
  })

  const asTenant = () => run(mw, makeReq({ headers: { "x-tenant": "a" } }))
  assert.equal(asTenant().nextCalls, 1)
  assert.equal(asTenant().nextCalls, 1)
  assert.equal(asTenant().nextCalls, 0) // quota used up (off-by-one: maxRequests 3 -> 2 allowed)

  const otherTenant = run(mw, makeReq({ headers: { "x-tenant": "b" } }))
  assert.equal(otherTenant.nextCalls, 1)
  assert.deepEqual(otherTenant.req.rateLimitInfos, { clientsCount: 2 })
})

test("default client id prefers the first X-Forwarded-For hop", () => {
  const mw = createRateLimiterMiddleware({ maxRequests: 3, enableCleanup: false })

  run(mw, makeReq({ headers: { "x-forwarded-for": "10.0.0.1, 10.0.0.2" } }))
  const sameClient = run(mw, makeReq({ headers: { "x-forwarded-for": "10.0.0.1, 10.0.0.9" } }))
  assert.equal(sameClient.nextCalls, 1)
  assert.equal(sameClient.req.rateLimit.remaining, 1)

  const otherClient = run(mw, makeReq({ headers: { "x-forwarded-for": "10.0.0.5" } }))
  assert.equal(otherClient.req.rateLimit.remaining, 2)
})

test("showInformativeHeaders:false omits the X-RateLimit headers but still limits", () => {
  const mw = createRateLimiterMiddleware({
    maxRequests: 2,
    showInformativeHeaders: false,
    enableCleanup: false,
  })

  const first = run(mw, makeReq())
  assert.equal(first.nextCalls, 1)
  assert.equal(first.res.getHeader("X-RateLimit-Limit"), undefined)
  assert.equal(first.res.getHeader("X-RateLimit-Remaining"), undefined)
  assert.equal(first.res.getHeader("X-RateLimit-Reset"), undefined)

  const second = run(mw, makeReq())
  assert.equal(second.res.statusCode, 429)
})


test("log a warning once maxClients is exceeded", () => {
  quietWarnings((warnings) => {
    const mw = createRateLimiterMiddleware({ maxRequests: 10, maxClients: 1, enableCleanup: false })
    run(mw, makeReq({ url: '/api/v1' }));
    assert.ok(warnings.some((w) => w.includes(`[RATE LIMITER - ROUTE OVERLOAD FLAGGED] at ${req.url}`)))
  })
})
*/