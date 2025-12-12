"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClientSnapshot = void 0;
/**
 * Represents a client's current rate limiting state
 * Immutable by design - create new instances for updates
 */
class ClientSnapshot {
    constructor(clientIpAddress, maxHits, timestamp = Date.now(), hits = 1) {
        this.clientIpAddress = clientIpAddress;
        this.timestamp = timestamp;
        this.hits = hits;
        this.maxHits = maxHits;
    }
    /**
     * Create a new snapshot with incremented hits
     */
    incrementHits() {
        return new ClientSnapshot(this.clientIpAddress, this.maxHits, this.timestamp, this.hits + 1);
    }
    /**
     * Check if the time window has expired
     * @param windowInMinutes Time window duration in minutes
     * @returns true if the window has expired
     */
    isWindowExpired(windowInMinutes) {
        const windowInMs = windowInMinutes * 60 * 1000;
        const timeSinceSnapshot = Date.now() - this.timestamp;
        return timeSinceSnapshot >= windowInMs;
    }
    /**
     * Check if this client has exceeded the rate limit
     */
    isRateLimited() {
        return this.hits >= this.maxHits;
    }
    /**
     * Get remaining requests before hitting the limit
     */
    getRemainingRequests() {
        return Math.max(0, this.maxHits - this.hits);
    }
    /**
     * Get the timestamp when the current window expires
     */
    getWindowExpiryTime(windowInMinutes) {
        return this.timestamp + windowInMinutes * 60 * 1000;
    }
}
exports.ClientSnapshot = ClientSnapshot;
