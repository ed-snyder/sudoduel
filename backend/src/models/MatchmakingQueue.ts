import { query } from '../config/database';

export interface QueueEntry {
  id: number;
  player_id: number;
  ladder_id: number;
  enqueued_at: Date;
  rating_snapshot: number;
  rd_snapshot: number;
  region: string | null;
}

export const MatchmakingQueueModel = {
  // Add player to queue
  async enqueue(
    playerId: number,
    ladderId: number,
    rating: number,
    rd: number
  ): Promise<QueueEntry> {
    const result = await query(
      `INSERT INTO matchmaking_queue (player_id, ladder_id, rating_snapshot, rd_snapshot)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (player_id, ladder_id) DO UPDATE
       SET enqueued_at = NOW(), rating_snapshot = $3, rd_snapshot = $4
       RETURNING *`,
      [playerId, ladderId, rating, rd]
    );
    return result.rows[0];
  },

  // Remove player from queue
  async dequeue(playerId: number, ladderId: number): Promise<void> {
    await query(
      'DELETE FROM matchmaking_queue WHERE player_id = $1 AND ladder_id = $2',
      [playerId, ladderId]
    );
  },

  // Find opponent within rating range (excluding blocked users)
  async findOpponent(
    playerId: number,
    ladderId: number,
    rating: number,
    ratingWindow: number,
    userId?: number // Optional: user_id to check blocked users
  ): Promise<QueueEntry | null> {
    // Build query with blocked users exclusion if userId is provided
    let blockedUsersClause = '';
    const queryParams: any[] = [ladderId, playerId, rating - ratingWindow, rating + ratingWindow];
    
    if (userId) {
      blockedUsersClause = `
        AND player_id NOT IN (
          SELECT blocked_user_id FROM blocked_users WHERE user_id = $5
        )
        AND $5 NOT IN (
          SELECT user_id FROM blocked_users 
          JOIN player_profiles ON player_profiles.user_id = blocked_users.user_id
          WHERE blocked_users.blocked_user_id = player_id
        )`;
      queryParams.push(userId);
    }
    
    const result = await query(
      `SELECT mq.* FROM matchmaking_queue mq
       WHERE mq.ladder_id = $1
       AND mq.player_id != $2
       AND mq.rating_snapshot BETWEEN $3 AND $4
       ${blockedUsersClause}
       ORDER BY mq.enqueued_at ASC
       LIMIT 1`,
      queryParams
    );
    return result.rows[0] || null;
  },

  // Check if player is in queue
  async isPlayerInQueue(playerId: number, ladderId: number): Promise<boolean> {
    const result = await query(
      'SELECT 1 FROM matchmaking_queue WHERE player_id = $1 AND ladder_id = $2',
      [playerId, ladderId]
    );
    return result.rows.length > 0;
  },
};
