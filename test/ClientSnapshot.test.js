const test = require("node:test")
const assert = require("node:assert/strict")
const { ClientSnapshot } = require("../dist/index.js")

const MINUTE_MS = 60 * 1000

test("a fresh snapshot starts at 1 hit", () => {
  const before = Date.now()
  const snapshot = new ClientSnapshot("1.2.3.4", 10)

  assert.equal(snapshot.clientId, "1.2.3.4")
  assert.equal(snapshot.maxHits, 10)
  assert.equal(snapshot.hits, 1)
  assert.ok(snapshot.timestamp >= before)
  assert.ok(snapshot.timestamp <= Date.now())
})

test("incrementHits returns a new instance and leaves the original untouched", () => {
  const original = new ClientSnapshot("1.2.3.4", 10, 1234, 3)
  const incremented = original.incrementHits()

  assert.notEqual(incremented, original)
  assert.equal(original.hits, 3)
  assert.equal(incremented.hits, 4)
  // window start, identity and limit are carried over
  assert.equal(incremented.timestamp, original.timestamp)
  assert.equal(incremented.clientId, original.clientId)
  assert.equal(incremented.maxHits, original.maxHits)
})

test("isRateLimited flips once hits reach maxHits", () => {
  assert.equal(new ClientSnapshot("a", 3, Date.now(), 2).isRateLimited(), false)
  assert.equal(new ClientSnapshot("a", 3, Date.now(), 3).isRateLimited(), true)
  assert.equal(new ClientSnapshot("a", 3, Date.now(), 9).isRateLimited(), true)
})

test("getRemainingRequests never drops below zero", () => {
  assert.equal(new ClientSnapshot("a", 3, Date.now(), 1).getRemainingRequests(), 2)
  assert.equal(new ClientSnapshot("a", 3, Date.now(), 3).getRemainingRequests(), 0)
  assert.equal(new ClientSnapshot("a", 3, Date.now(), 5).getRemainingRequests(), 0)
})

test("isWindowExpired compares elapsed time against the window length", () => {
  const now = Date.now()

  assert.equal(new ClientSnapshot("a", 3, now).isWindowExpired(1), false)
  // 5 seconds of slack so the synchronous call cannot race the boundary
  assert.equal(new ClientSnapshot("a", 3, now - MINUTE_MS + 5000).isWindowExpired(1), false)
  // exactly at the boundary counts as expired
  assert.equal(new ClientSnapshot("a", 3, now - MINUTE_MS).isWindowExpired(1), true)
  assert.equal(new ClientSnapshot("a", 3, now - MINUTE_MS * 5).isWindowExpired(1), true)
})

test("getWindowExpiryTime is the window start plus the window length", () => {
  const snapshot = new ClientSnapshot("a", 3, 1_000_000, 1)

  assert.equal(snapshot.getWindowExpiryTime(1), 1_000_000 + MINUTE_MS)
  assert.equal(snapshot.getWindowExpiryTime(15), 1_000_000 + 15 * MINUTE_MS)
})
