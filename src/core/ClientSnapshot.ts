import type { IClientSnapshot } from "../types/index.js"

/**
 * Represents a client's current rate limiting state
 * Immutable by design - create new instances for updates
 */
export class ClientSnapshot implements IClientSnapshot {
  readonly clientId: string
  readonly timestamp: number = 0;
  hits: number
  readonly maxHits: number

  constructor(clientId: string, maxHits: number, hits: number = 1) {
    this.timestamp = Date.now()
    this.clientId = clientId
    this.hits = hits
    this.maxHits = maxHits
  }

  /**
   * just increment the hits on the existing snapshot
   */
  incrementHits(): void {
    this.hits += 1
  }

  /**
   * Check if the time window has expired
   * @param windowInMinutes Time window duration in minutes
   * @returns true if the window has expired
   */
  isWindowExpired(windowInMinutes: number): boolean {
    const windowInMs = windowInMinutes * 60 * 1000
    const timeSinceSnapshot = Date.now() - this.timestamp
    return timeSinceSnapshot >= windowInMs
  }

  /**
   * Check if this client has exceeded the rate limit
   */
  isRateLimited(): boolean {
    return this.hits > this.maxHits
  }

  /**
   * Get remaining requests before hitting the limit
   */
  getRemainingRequests(): number {
    return Math.max(0, this.maxHits - this.hits)
  }

  /**
   * Get the timestamp when the current window expires
   */
  getWindowExpiryTime(windowInMinutes: number): number {
    return this.timestamp + windowInMinutes * 60 * 1000
  }
}
