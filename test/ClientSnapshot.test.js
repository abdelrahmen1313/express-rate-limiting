
import test from "node:test";
import assert from "node:assert";
import { ClientSnapshot } from "../dist/index.js";

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

test("incrementHits increment hits inside the clientSnapshot", () => {
  const shot = new ClientSnapshot("1.2.3.4", 10);
  const timestamp = shot.timestamp;
  shot.incrementHits();

  assert.equal(shot.hits, 2)
  // window start, identity and limit are carried over
  assert.equal(shot.timestamp, timestamp)
  assert.equal(shot.clientId, '1.2.3.4')
  assert.equal(shot.maxHits, 10)
})


test("isRateLimited flips strictly after maxHits", () => {
  assert.equal(new ClientSnapshot("a", 3, 2).isRateLimited(), false)
  assert.equal(new ClientSnapshot("a", 3, 3).isRateLimited(), false) // the maxHits-th request is allowed
  assert.equal(new ClientSnapshot("a", 3, 4).isRateLimited(), true)
})




test("getRemainingRequests never drops below zero", () => {
  assert.equal(new ClientSnapshot("a", 3, 1).getRemainingRequests(), 2)
  assert.equal(new ClientSnapshot("a", 3, 3).getRemainingRequests(), 0)
  assert.equal(new ClientSnapshot("a", 3, 5).getRemainingRequests(), 0)
})



test("isWindowExpired compares elapsed time against the window length", () => {

  assert.equal(new ClientSnapshot("a", 3).isWindowExpired(1), false)

  // handy test
  let snapshot = new ClientSnapshot("b", 3);
  snapshot.timestamp = Date.now() - 2 * 60 * 1000;
  assert.equal(snapshot.isWindowExpired(1), true)
})



test("getWindowExpiryTime is the window start plus the window length", () => {
  const snapshot = new ClientSnapshot("a", 3, 1)

  assert.equal(snapshot.getWindowExpiryTime(1), Date.now() + MINUTE_MS)
  assert.equal(snapshot.getWindowExpiryTime(15), Date.now() + 15 * MINUTE_MS)
})
