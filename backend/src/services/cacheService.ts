/**
 * In-memory cache service for reducing database query latency
 * For production scale, consider replacing with Redis
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

class CacheService {
  private cache = new Map<string, CacheEntry<any>>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Periodic cleanup of expired entries every 60 seconds
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }

  /**
   * Set a value in cache with TTL
   */
  set<T>(key: string, data: T, ttlSeconds: number): void {
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  /**
   * Get a value from cache, returns null if expired or not found
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data as T;
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: string): boolean {
    return this.get(key) !== null;
  }

  /**
   * Delete a specific key
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Invalidate all keys matching a prefix pattern
   */
  invalidate(prefix: string): number {
    let count = 0;
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
        count++;
      }
    }
    return count;
  }

  /**
   * Get or set pattern - fetch from cache or execute function and cache result
   */
  async getOrSet<T>(
    key: string, 
    ttlSeconds: number, 
    fetchFn: () => Promise<T>
  ): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const data = await fetchFn();
    this.set(key, data, ttlSeconds);
    return data;
  }

  /**
   * Remove expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      console.log(`[Cache] Cleaned up ${cleaned} expired entries`);
    }
  }

  /**
   * Get cache statistics
   */
  stats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }

  /**
   * Clear entire cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Stop cleanup interval (call on shutdown)
   */
  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

// Singleton instance
export const cache = new CacheService();

// Cache key generators for consistency
export const CacheKeys = {
  friends: (playerId: number) => `friends:${playerId}`,
  friendCount: (playerId: number) => `friend_count:${playerId}`,
  playerProfile: (userId: number) => `profile:user:${userId}`,
  playerProfileById: (playerId: number) => `profile:player:${playerId}`,
  playerRating: (playerId: number, ladderId: number) => `rating:${playerId}:${ladderId}`,
  playerStats: (userId: number) => `stats:${userId}`,
  matchHistory: (userId: number, limit: number, offset: number) => `history:${userId}:${limit}:${offset}`,
  headToHead: (player1Id: number, player2Id: number) => `h2h:${Math.min(player1Id, player2Id)}:${Math.max(player1Id, player2Id)}`,
};

// TTL constants (in seconds)
export const CacheTTL = {
  FRIENDS: 30,           // Friends list - refresh every 30s
  FRIEND_COUNT: 60,      // Friend count - refresh every minute
  PROFILE: 60,           // Profile data - refresh every minute
  RATING: 30,            // Rating - refresh every 30s (can change with matches)
  STATS: 60,             // Player stats - refresh every minute
  MATCH_HISTORY: 30,     // Match history - refresh every 30s
  HEAD_TO_HEAD: 120,     // H2H stats - less volatile, cache 2 minutes
};
