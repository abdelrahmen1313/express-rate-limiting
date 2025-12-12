import type { IClientSnapshot } from "../types/index";
/**
 * Represents a client's current rate limiting state
 * Immutable by design - create new instances for updates
 */
export declare class ClientSnapshot implements IClientSnapshot {
    readonly clientIpAddress: string;
    readonly timestamp: number;
    readonly hits: number;
    readonly maxHits: number;
    constructor(clientIpAddress: string, maxHits: number, timestamp?: number, hits?: number);
    /**
     * Create a new snapshot with incremented hits
     */
    incrementHits(): ClientSnapshot;
    /**
     * Check if the time window has expired
     * @param windowInMinutes Time window duration in minutes
     * @returns true if the window has expired
     */
    isWindowExpired(windowInMinutes: number): boolean;
    /**
     * Check if this client has exceeded the rate limit
     */
    isRateLimited(): boolean;
    /**
     * Get remaining requests before hitting the limit
     */
    getRemainingRequests(): number;
    /**
     * Get the timestamp when the current window expires
     */
    getWindowExpiryTime(windowInMinutes: number): number;
}
