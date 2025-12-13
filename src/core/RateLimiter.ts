import { ClientSnapshot } from "./ClientSnapshot"
import type { RateLimiterConfig, RateLimitStatus } from "../types/index"

/**
 * Core rate limiter logic - storage-agnostic
 */
export class RateLimiter {
  private clientSnapshots: Map<string, ClientSnapshot>
  private readonly maxRequests: number
  private readonly windowInMinutes: number
  private cleanupInterval: ReturnType <typeof setInterval> | null = null

  private maxClients : number

  constructor(config: RateLimiterConfig) {
    this.maxRequests = config.maxRequests
    this.windowInMinutes = config.windowInMinutes ?? 1
    this.clientSnapshots = new Map()
    this.maxClients = config.maxClients ?? 9999
    if (config.enableCleanup ?? true) {
      this.startCleanup(config.cleanupIntervalMinutes ?? 5)
    }
 
  }

  /**
   * check if number of active users is above maxClients
   */
  flagUserOverload() {
    return this.getClientCount() > this.maxClients
  }

  /**
   * Check rate limit status for a client IP
   * Returns the updated snapshot and status
   */
  checkRateLimit(clientIp: string): {
    snapshot: ClientSnapshot
    status: RateLimitStatus
  } {
    const existingSnapshot = this.clientSnapshots.get(clientIp)

    let snapshot: ClientSnapshot

    if (!existingSnapshot) {
      // New client
      snapshot = new ClientSnapshot(clientIp, this.maxRequests)
    } else if (existingSnapshot.isWindowExpired(this.windowInMinutes)) {
      // Window expired, reset
      this.resetClient(clientIp)
      snapshot = new ClientSnapshot(clientIp, this.maxRequests)
    } else {
      // Window active, increment hits
      snapshot = existingSnapshot.incrementHits()
    }

    this.clientSnapshots.set(clientIp, snapshot)

    const status: RateLimitStatus = {
      allowed: !snapshot.isRateLimited(),
      remaining: snapshot.getRemainingRequests(),
      resetAt: snapshot.getWindowExpiryTime(this.windowInMinutes),
    }

    return { snapshot, status }
  }

  /**
   * Get the current status without modifying the snapshot
   */
  getStatus(clientIp: string): RateLimitStatus | null {
    const snapshot = this.clientSnapshots.get(clientIp)

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
  resetClient(clientIp: string): void {
    this.clientSnapshots.delete(clientIp)
  }

  /**
   * Reset all clients
   */
  resetAll(): void {
    this.clientSnapshots.clear()
  }

  /**
   * Get all active clients (useful for monitoring)
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
    this.cleanupInterval = setInterval(
      () => {
        this.cleanup()
      },
      intervalMinutes * 60 * 1000,
    )

    // Prevent process from hanging if this is the only timer
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref()
    }
  }
  

  /**
   * Remove expired entries from the map
   */
  private cleanup(): void {

    for (const [ip, snapshot] of this.clientSnapshots.entries()) {
      if (snapshot.isWindowExpired(this.windowInMinutes)) {
        this.clientSnapshots.delete(ip)
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
