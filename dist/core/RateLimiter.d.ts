import { ClientSnapshot } from "./ClientSnapshot";
import type { RateLimiterConfig, RateLimitStatus } from "../types/index";
/**
 * Core rate limiter logic - storage-agnostic
 */
export declare class RateLimiter {
    private clientSnapshots;
    private readonly maxRequests;
    private readonly windowInMinutes;
    private cleanupInterval;
    constructor(config: RateLimiterConfig);
    /**
     * Check rate limit status for a client IP
     * Returns the updated snapshot and status
     */
    checkRateLimit(clientIp: string): {
        snapshot: ClientSnapshot;
        status: RateLimitStatus;
    };
    /**
     * Get the current status without modifying the snapshot
     */
    getStatus(clientIp: string): RateLimitStatus | null;
    /**
     * Manually reset a client's rate limit
     */
    resetClient(clientIp: string): void;
    /**
     * Reset all clients
     */
    resetAll(): void;
    /**
     * Get all active clients (useful for monitoring)
     */
    getActiveClients(): ClientSnapshot[];
    /**
   * Start periodic cleanup of expired entries
   */
    private startCleanup;
    /**
     * Remove expired entries from the map
     */
    private cleanup;
    /**
     * Get the total number of tracked clients
     */
    getClientCount(): number;
}
