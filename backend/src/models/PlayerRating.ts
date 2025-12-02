import { query } from '../config/database';

export interface PlayerRating {
  id: number;
  player_id: number;
  ladder_id: number;
  rating: number;
  rd: number;
  volatility: number;
  games_played: number;
  last_update_at: Date;
}

export const PlayerRatingModel = {
  // Initialize rating for a new player on a ladder
  async create(playerId: number, ladderId: number): Promise<PlayerRating> {
    const result = await query(
      `INSERT INTO player_ratings (player_id, ladder_id, rating, rd, volatility)
       VALUES ($1, $2, 1500, 350, 0.06)
       RETURNING *`,
      [playerId, ladderId]
    );
    return result.rows[0];
  },

  // Get rating for player on specific ladder
  async findByPlayerAndLadder(playerId: number, ladderId: number): Promise<PlayerRating | null> {
    const result = await query(
      'SELECT * FROM player_ratings WHERE player_id = $1 AND ladder_id = $2',
      [playerId, ladderId]
    );
    return result.rows[0] || null;
  },

  // Update rating after a match
  async update(
    id: number,
    rating: number,
    rd: number,
    volatility: number
  ): Promise<void> {
    const result = await query(
      `UPDATE player_ratings
       SET rating = $1, rd = $2, volatility = $3, games_played = games_played + 1, last_update_at = NOW()
       WHERE id = $4
       RETURNING rating, rd, volatility, games_played`,
      [rating, rd, volatility, id]
    );
    
    if (result.rows.length === 0) {
      console.error(`❌ Rating update failed: no row found with id=${id}`);
    } else {
      console.log(`✅ Rating updated in DB: id=${id} rating=${result.rows[0].rating} rd=${result.rows[0].rd} games_played=${result.rows[0].games_played}`);
    }
  },
};
