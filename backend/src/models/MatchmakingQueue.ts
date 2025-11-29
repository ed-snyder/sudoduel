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

  // Find opponent within rating range
  async findOpponent(
    playerId: number,
    ladderId: number,
    rating: number,
    ratingWindow: number
  ): Promise<QueueEntry | null> {
    const result = await query(
      `SELECT * FROM matchmaking_queue
       WHERE ladder_id = $1
       AND player_id != $2
       AND rating_snapshot BETWEEN $3 AND $4
       ORDER BY enqueued_at ASC
       LIMIT 1`,
      [ladderId, playerId, rating - ratingWindow, rating + ratingWindow]
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
