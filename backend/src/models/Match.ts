import { query } from '../config/database';

export interface Match {
  id: number;
  ladder_id: number;
  puzzle_id: number;
  status: string;
  result_code: number | null;
  created_at: Date;
  started_at: Date | null;
  ended_at: Date | null;
  server_region: string | null;
  is_ranked: boolean;
}

export interface MatchPlayer {
  id: number;
  match_id: number;
  player_id: number;
  slot: number;
  rating_before: number;
  rd_before: number;
  volatility_before: number;
  rating_after: number | null;
  rd_after: number | null;
  volatility_after: number | null;
  cells_completed: number;
  lives_used: number;
  lives_remaining: number;
  mistakes: number;
  time_spent_seconds: number;
  final_state: string | null;
  is_winner: boolean | null;
}

export const MatchModel = {
  // Create a new match
  async create(ladderId: number, puzzleId: number, isRanked: boolean = true): Promise<Match> {
    const result = await query(
      `INSERT INTO matches (ladder_id, puzzle_id, status, is_ranked)
       VALUES ($1, $2, 'PENDING', $3)
       RETURNING *`,
      [ladderId, puzzleId, isRanked]
    );
    return result.rows[0];
  },

  // Add player to match
  async addPlayer(
    matchId: number,
    playerId: number,
    slot: number,
    rating: number,
    rd: number,
    volatility: number
  ): Promise<MatchPlayer> {
    const result = await query(
      `INSERT INTO match_players 
       (match_id, player_id, slot, rating_before, rd_before, volatility_before)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [matchId, playerId, slot, rating, rd, volatility]
    );
    return result.rows[0];
  },

  // Find match by ID
  async findById(matchId: number): Promise<Match | null> {
    const result = await query(
      'SELECT * FROM matches WHERE id = $1',
      [matchId]
    );
    return result.rows[0] || null;
  },

  // Get players in a match
  async getPlayers(matchId: number): Promise<MatchPlayer[]> {
    const result = await query(
      'SELECT * FROM match_players WHERE match_id = $1 ORDER BY slot',
      [matchId]
    );
    return result.rows;
  },

  // Update match status
  async updateStatus(matchId: number, status: string): Promise<void> {
    if (status === 'IN_PROGRESS') {
      await query(
        'UPDATE matches SET status = $1, started_at = NOW() WHERE id = $2',
        [status, matchId]
      );
    } else if (status === 'COMPLETED') {
      await query(
        'UPDATE matches SET status = $1, ended_at = NOW() WHERE id = $2',
        [status, matchId]
      );
    } else {
      await query(
        'UPDATE matches SET status = $1 WHERE id = $2',
        [status, matchId]
      );
    }
  },

  // Set match result
  async setResult(matchId: number, resultCode: number): Promise<void> {
    await query(
      'UPDATE matches SET result_code = $1 WHERE id = $2',
      [resultCode, matchId]
    );
  },

  // Check if match is ranked
  async isRanked(matchId: number): Promise<boolean> {
    const result = await query(
      'SELECT is_ranked FROM matches WHERE id = $1',
      [matchId]
    );
    return result.rows[0]?.is_ranked ?? true;
  },

  // Update match player final stats
  async updatePlayerStats(
    matchId: number,
    playerId: number,
    stats: {
      cellsCompleted: number;
      livesUsed: number;
      livesRemaining: number;
      mistakes: number;
      timeSpentSeconds: number;
      finalState: string;
      isWinner: boolean;
      ratingAfter: number;
      rdAfter: number;
      volatilityAfter: number;
      timeAtFinish?: number;
      longestCellStreak?: number;
    }
  ): Promise<void> {
    // Build the query dynamically based on what columns exist
    let updateQuery = `
      UPDATE match_players 
      SET cells_completed = $1,
          lives_used = $2,
          lives_remaining = $3,
          mistakes = $4,
          time_spent_seconds = $5,
          final_state = $6,
          is_winner = $7,
          rating_after = $8,
          rd_after = $9,
          volatility_after = $10
    `;
    
    const params: any[] = [
      stats.cellsCompleted,
      stats.livesUsed,
      stats.livesRemaining,
      stats.mistakes,
      stats.timeSpentSeconds,
      stats.finalState,
      stats.isWinner,
      stats.ratingAfter,
      stats.rdAfter,
      stats.volatilityAfter,
    ];
    
    let paramIndex = 11;
    
    // Add optional columns if provided
    if (stats.timeAtFinish !== undefined) {
      updateQuery += `, time_at_finish = $${paramIndex}`;
      params.push(stats.timeAtFinish);
      paramIndex++;
    }
    
    if (stats.longestCellStreak !== undefined) {
      updateQuery += `, longest_cell_streak = $${paramIndex}`;
      params.push(stats.longestCellStreak);
      paramIndex++;
    }
    
    updateQuery += ` WHERE match_id = $${paramIndex} AND player_id = $${paramIndex + 1}`;
    params.push(matchId, playerId);
    
    try {
      await query(updateQuery, params);
    } catch (error: any) {
      // If columns don't exist, fall back to basic update
      if (error.message && error.message.includes('column')) {
        await query(
          `UPDATE match_players 
           SET cells_completed = $1,
               lives_used = $2,
               lives_remaining = $3,
               mistakes = $4,
               time_spent_seconds = $5,
               final_state = $6,
               is_winner = $7,
               rating_after = $8,
               rd_after = $9,
               volatility_after = $10
           WHERE match_id = $11 AND player_id = $12`,
          [
            stats.cellsCompleted,
            stats.livesUsed,
            stats.livesRemaining,
            stats.mistakes,
            stats.timeSpentSeconds,
            stats.finalState,
            stats.isWinner,
            stats.ratingAfter,
            stats.rdAfter,
            stats.volatilityAfter,
            matchId,
            playerId,
          ]
        );
      } else {
        throw error;
      }
    }
  },

  // Get recent matches for a player (for match history)
  async getPlayerMatches(playerId: number, limit: number = 50): Promise<any[]> {
    const result = await query(
      `SELECT m.*, mp.is_winner, mp.rating_before, mp.rating_after
       FROM matches m
       JOIN match_players mp ON mp.match_id = m.id
       WHERE mp.player_id = $1 AND m.status = 'COMPLETED'
       ORDER BY m.ended_at DESC
       LIMIT $2`,
      [playerId, limit]
    );
    return result.rows;
  },
};
