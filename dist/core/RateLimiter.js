"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RateLimiter = void 0;
const ClientSnapshot_1 = require("./ClientSnapshot");
/**
 * Core rate limiter logic - storage-agnostic
 */
class RateLimiter {
    constructor(config) {
        var _a, _b, _c;
        this.cleanupInterval = null;
        this.maxRequests = config.maxRequests;
        this.windowInMinutes = (_a = config.windowInMinutes) !== null && _a !== void 0 ? _a : 1;
        this.clientSnapshots = new Map();
        if ((_b = config.enableCleanup) !== null && _b !== void 0 ? _b : true) {
            this.startCleanup((_c = config.cleanupIntervalMinutes) !== null && _c !== void 0 ? _c : 90);
        }
    }
    /**
     * Check rate limit status for a client IP
     * Returns the updated snapshot and status
     */
    checkRateLimit(clientIp) {
        const existingSnapshot = this.clientSnapshots.get(clientIp);
        let snapshot;
        if (!existingSnapshot) {
            // New client
            snapshot = new ClientSnapshot_1.ClientSnapshot(clientIp, this.maxRequests);
        }
        else if (existingSnapshot.isWindowExpired(this.windowInMinutes)) {
            // Window expired, reset
            snapshot = new ClientSnapshot_1.ClientSnapshot(clientIp, this.maxRequests);
        }
        else {
            // Window active, increment hits
            snapshot = existingSnapshot.incrementHits();
        }
        this.clientSnapshots.set(clientIp, snapshot);
        const status = {
            allowed: !snapshot.isRateLimited(),
            remaining: snapshot.getRemainingRequests(),
            resetAt: snapshot.getWindowExpiryTime(this.windowInMinutes),
        };
        return { snapshot, status };
    }
    /**
     * Get the current status without modifying the snapshot
     */
    getStatus(clientIp) {
        const snapshot = this.clientSnapshots.get(clientIp);
        if (!snapshot) {
            return null;
        }
        if (snapshot.isWindowExpired(this.windowInMinutes)) {
            return null; // Window expired
        }
        return {
            allowed: !snapshot.isRateLimited(),
            remaining: snapshot.getRemainingRequests(),
            resetAt: snapshot.getWindowExpiryTime(this.windowInMinutes),
        };
    }
    /**
     * Manually reset a client's rate limit
     */
    resetClient(clientIp) {
        this.clientSnapshots.delete(clientIp);
    }
    /**
     * Reset all clients
     */
    resetAll() {
        this.clientSnapshots.clear();
    }
    /**
     * Get all active clients (useful for monitoring)
     */
    getActiveClients() {
        return Array.from(this.clientSnapshots.values()).filter((snapshot) => !snapshot.isWindowExpired(this.windowInMinutes));
    }
    /**
   * Start periodic cleanup of expired entries
   */
    startCleanup(intervalMinutes) {
        this.cleanupInterval = setInterval(() => {
            this.cleanup();
        }, intervalMinutes * 60 * 1000);
        // Prevent process from hanging if this is the only timer
        if (this.cleanupInterval.unref) {
            this.cleanupInterval.unref();
        }
    }
    /**
     * Remove expired entries from the map
     */
    cleanup() {
        for (const [ip, snapshot] of this.clientSnapshots.entries()) {
            if (snapshot.isWindowExpired(this.windowInMinutes)) {
                this.clientSnapshots.delete(ip);
            }
        }
    }
    /**
     * Get the total number of tracked clients
     */
    getClientCount() {
        return this.clientSnapshots.size;
    }
}
exports.RateLimiter = RateLimiter;
//# sourceMappingURL=RateLimiter.js.map