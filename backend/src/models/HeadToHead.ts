import { query } from '../config/database';

export const HeadToHeadModel = {
  /**
   * Update head-to-head stats after a match
   * @param player1Id - First player's profile ID
   * @param player2Id - Second player's profile ID  
   * @param winnerId - Winner's profile ID (null for draw)
   */
  async updateAfterMatch(
    player1Id: number, 
    player2Id: number, 
    winnerId: number | null
  ): Promise<void> {
    // Ensure consistent ordering (lower ID is always player1)
    const [lowerId, higherId] = player1Id < player2Id 
      ? [player1Id, player2Id] 
      : [player2Id, player1Id];
    
    const isDraw = winnerId === null;
    const player1Won = winnerId === lowerId;
    const player2Won = winnerId === higherId;

    // Ensure table exists
    try {
      await query(`SELECT 1 FROM head_to_head_stats LIMIT 1`);
    } catch (err: any) {
      if (err.message && err.message.includes('does not exist')) {
        console.log('[H2H] Creating head_to_head_stats table...');
        await query(`
          CREATE TABLE IF NOT EXISTS head_to_head_stats (
            id SERIAL PRIMARY KEY,
            player1_id INTEGER NOT NULL REFERENCES player_profiles(id),
            player2_id INTEGER NOT NULL REFERENCES player_profiles(id),
            player1_wins INTEGER DEFAULT 0,
            player2_wins INTEGER DEFAULT 0,
            draws INTEGER DEFAULT 0,
            last_match_at TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            UNIQUE(player1_id, player2_id),
            CHECK (player1_id < player2_id)
          )
        `);
        await query(`CREATE INDEX IF NOT EXISTS idx_h2h_player1 ON head_to_head_stats(player1_id)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_h2h_player2 ON head_to_head_stats(player2_id)`);
        console.log('[H2H] Table created successfully');
      } else {
        throw err;
      }
    }

    try {
      await query(
        `INSERT INTO head_to_head_stats (player1_id, player2_id, player1_wins, player2_wins, draws, last_match_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT (player1_id, player2_id) 
         DO UPDATE SET
           player1_wins = head_to_head_stats.player1_wins + $3,
           player2_wins = head_to_head_stats.player2_wins + $4,
           draws = head_to_head_stats.draws + $5,
           last_match_at = NOW(),
           updated_at = NOW()`,
        [
          lowerId, 
          higherId, 
          player1Won ? 1 : 0,
          player2Won ? 1 : 0,
          isDraw ? 1 : 0
        ]
      );
      
      console.log(`[H2H] Updated stats: ${lowerId} vs ${higherId}, winner: ${winnerId || 'draw'}`);
    } catch (error: any) {
      console.error('[H2H] Failed to update stats:', error);
      // Don't throw - H2H update failure shouldn't break match completion
    }
  },

  /**
   * Get head-to-head stats between two players
   */
  async getStats(playerId: number, opponentId: number): Promise<{
    wins: number;
    losses: number;
    draws: number;
    total_matches: number;
    last_match_at: string | null;
  }> {
    const [lowerId, higherId] = playerId < opponentId 
      ? [playerId, opponentId] 
      : [opponentId, playerId];
    
    const isPlayer1 = playerId < opponentId;

    const result = await query(
      `SELECT player1_wins, player2_wins, draws, last_match_at
       FROM head_to_head_stats 
       WHERE player1_id = $1 AND player2_id = $2`,
      [lowerId, higherId]
    );

    if (result.rows.length === 0) {
      return { wins: 0, losses: 0, draws: 0, total_matches: 0, last_match_at: null };
    }

    const row = result.rows[0];
    const wins = isPlayer1 ? (row.player1_wins || 0) : (row.player2_wins || 0);
    const losses = isPlayer1 ? (row.player2_wins || 0) : (row.player1_wins || 0);
    const draws = row.draws || 0;

    return {
      wins,
      losses,
      draws,
      total_matches: wins + losses + draws,
      last_match_at: row.last_match_at,
    };
  }
};
