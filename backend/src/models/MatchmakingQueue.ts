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

// Rating bands to search in order (closest first)
const RATING_BANDS = [50, 100, 200, 300, 500, 750, 1000];

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

  // Find opponent - searches in expanding rating bands (closest rating first)
  async findOpponent(
    playerId: number,
    ladderId: number,
    rating: number,
    maxRatingWindow: number, // Kept for backwards compatibility, but logic uses RATING_BANDS
    userId?: number // Optional: user_id to check blocked users
  ): Promise<QueueEntry | null> {
    // Build blocked users clause
    let blockedUsersClause = '';
    const baseParams: any[] = [ladderId, playerId];

    if (userId) {
      // Exclude players that userId has blocked
      // AND exclude players who have blocked userId
      blockedUsersClause = `
        AND mq.player_id NOT IN (
          SELECT bu.blocked_user_id FROM blocked_users bu WHERE bu.user_id = $5
        )
        AND mq.player_id NOT IN (
          SELECT pp.id FROM blocked_users bu
          JOIN player_profiles pp ON pp.user_id = bu.user_id
          WHERE bu.blocked_user_id = (
            SELECT id FROM player_profiles WHERE user_id = $5
          )
        )`;
    }

    // Search through rating bands, closest first
    for (const band of RATING_BANDS) {
      // Respect optional maxRatingWindow if it's set smaller than our band
      if (maxRatingWindow && band > maxRatingWindow) {
        continue;
      }

      const minRating = rating - band;
      const maxRating = rating + band;

      const queryParams = userId
        ? [...baseParams, minRating, maxRating, userId]
        : [...baseParams, minRating, maxRating];

      const result = await query(
        `SELECT mq.* FROM matchmaking_queue mq
         WHERE mq.ladder_id = $1
         AND mq.player_id != $2
         AND mq.rating_snapshot BETWEEN $3 AND $4
         ${blockedUsersClause}
         ORDER BY ABS(mq.rating_snapshot - ${rating}) ASC, mq.enqueued_at ASC
         LIMIT 1`,
        queryParams
      );

      if (result.rows[0]) {
        console.log(
          `🎯 Found opponent in ±${band} band: rating ${result.rows[0].rating_snapshot} (searching player: ${rating})`
        );
        return result.rows[0];
      }
    }

    // No opponent found in any band
    console.log(`❌ No opponent found for rating ${rating} in any band`);
    return null;
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
