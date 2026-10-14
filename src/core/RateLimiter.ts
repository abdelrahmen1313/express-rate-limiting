import { ClientSnapshot } from "./ClientSnapshot.js"
import type { RateLimiterConfig, RateLimitStatus } from "../types/index.js"

/**
 * Core rate limiter logic - storage-agnostic
 */
export class RateLimiter {
  private clientSnapshots: Map<string, ClientSnapshot>
  private readonly maxRequests: number
  private readonly windowInMinutes: number

  constructor(config: RateLimiterConfig) {
    this.windowInMinutes = config.windowInMinutes || 1
    this.maxRequests = config.maxRequests
    this.clientSnapshots = new Map()
    this.startCleanup(this.windowInMinutes);
  }


  /**
   * Check rate limit status for a client
   * Returns the updated snapshot and status
   */
  checkRateLimit(clientId: string): {
    snapshot: ClientSnapshot
    status: RateLimitStatus
  } {
    let existingSnapshot = this.clientSnapshots.get(clientId)

    if (!existingSnapshot) {
      // New client
      existingSnapshot = new ClientSnapshot(clientId, this.maxRequests)
    } else if (existingSnapshot.isWindowExpired(this.windowInMinutes)) {
      // Window expired, reset
      this.resetClient(clientId)
      existingSnapshot = new ClientSnapshot(clientId, this.maxRequests)
    } else {
      // Window active, increment hits
      existingSnapshot.incrementHits()
    }

    this.clientSnapshots.set(clientId, existingSnapshot)

    const status: RateLimitStatus = {
      allowed: !existingSnapshot.isRateLimited(),
      remaining: existingSnapshot.getRemainingRequests(),
      resetAt: existingSnapshot.getWindowExpiryTime(this.windowInMinutes),
    }

    return { snapshot: existingSnapshot, status }
  }

  /**
   * Get the current status without modifying the snapshot
   */
  getStatus(clientId: string): RateLimitStatus | null {
    const snapshot = this.clientSnapshots.get(clientId)

    if (!snapshot) {
      return null
    }

    if (snapshot.isWindowExpired(this.windowInMinutes)) {
      return null // Window expired
    }

    return {
      allowed: !snapshot.isRateLimited(),
      remaining: snapshot.getRemainingRequests(),
      resetAt: snapshot.getWindowExpiryTime(this.windowInMinutes),
    }
  }

  /**
   * Manually reset a client's rate limit
   */
  resetClient(clientId: string): void {
    this.clientSnapshots.delete(clientId)
  }

  /**
   * Reset all clients
   */
  resetAll(): void {
    this.clientSnapshots.clear()
  }

  /**
   * Get all active clients
   */
  getActiveClients(): ClientSnapshot[] {
    return Array.from(this.clientSnapshots.values()).filter(
      (snapshot) => !snapshot.isWindowExpired(this.windowInMinutes),
    )
  }

  /**
 * Start periodic cleanup of expired entries
 */
  private startCleanup(intervalMinutes: number): void {
    const cleanupTimer = setInterval(
      () => {
        this.cleanup()
      },
      intervalMinutes * 60 * 1000,
    )

    cleanupTimer.unref?.()
  }


  /**
   * Remove expired entries from the map
   */
  private cleanup(): void {
    for (const [id, snapshot] of this.clientSnapshots.entries()) {
      if (snapshot.isWindowExpired(this.windowInMinutes)) {
        this.clientSnapshots.delete(id)
      }
    }
  }

  /**
   * Get the total number of tracked clients
   */
  getClientCount(): number {
    return this.clientSnapshots.size
  }


}
