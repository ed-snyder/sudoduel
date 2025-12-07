import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Create PostgreSQL connection pool
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test connection
pool.on('connect', () => {
  console.log('✅ Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('❌ Unexpected database error:', err);
  // Don't exit process - let the application handle errors gracefully
  // Railway will restart the container if needed
});

// Helper function to run queries
export const query = (text: string, params?: any[]) => {
  return pool.query(text, params);
};

/**
 * Warm up database connections and query plan cache
 * Call this on server startup to eliminate cold-start latency
 */
export async function warmupDatabase(): Promise<void> {
  console.log('🔥 Warming up database connections...');
  
  const startTime = Date.now();

  const warmupQueries = [
    // Basic table existence checks
    'SELECT 1 FROM users LIMIT 1',
    'SELECT 1 FROM player_profiles LIMIT 1',
    'SELECT 1 FROM player_ratings LIMIT 1',
    'SELECT 1 FROM friendships LIMIT 1',
    'SELECT 1 FROM friend_requests LIMIT 1',
    'SELECT 1 FROM matches LIMIT 1',
    'SELECT 1 FROM match_players LIMIT 1',
    'SELECT 1 FROM puzzles LIMIT 1',
    'SELECT 1 FROM ladders LIMIT 1',
    'SELECT 1 FROM matchmaking_queue LIMIT 1',
    
    // Common JOIN patterns to cache plans
    `SELECT pp.id, pp.display_name 
     FROM player_profiles pp 
     LEFT JOIN player_ratings pr ON pr.player_id = pp.id 
     LIMIT 1`,
    
    `SELECT f.friend_id, pp.display_name
     FROM friendships f
     JOIN player_profiles pp ON pp.id = f.friend_id
     LEFT JOIN player_ratings pr ON pr.player_id = f.friend_id
     LIMIT 1`,
    
    `SELECT mp.*, m.status
     FROM match_players mp
     JOIN matches m ON mp.match_id = m.id
     LIMIT 1`,
    
    // Index warmup
    'SELECT id FROM player_profiles WHERE user_id = -1',
    'SELECT id FROM matches WHERE status = \'PENDING\' LIMIT 1',
    'SELECT id FROM puzzles WHERE ladder_id = 1 LIMIT 1',
  ];

  const warmupPromises = warmupQueries.map(async (sql, index) => {
    try {
      await pool.query(sql);
      return true;
    } catch (error) {
      console.warn(`[Warmup] Query ${index} skipped (table may not exist)`);
      return false;
    }
  });

  const results = await Promise.all(warmupPromises);
  const successful = results.filter(Boolean).length;
  
  const duration = Date.now() - startTime;
  console.log(`✅ Database warmup complete: ${successful}/${warmupQueries.length} queries, ${duration}ms`);
  console.log(`📊 Pool stats: total=${pool.totalCount}, idle=${pool.idleCount}, waiting=${pool.waitingCount}`);
}

export default pool;
