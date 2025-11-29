import { query } from '../config/database';

export interface PlayerProfile {
  id: number;
  user_id: number;
  display_name: string;
  avatar_url: string | null;
  country_code: string | null;
  created_at: Date;
  updated_at: Date;
}

export const PlayerProfileModel = {
  // Create player profile
  async create(userId: number, displayName: string): Promise<PlayerProfile> {
    const result = await query(
      `INSERT INTO player_profiles (user_id, display_name)
       VALUES ($1, $2)
       RETURNING *`,
      [userId, displayName]
    );
    return result.rows[0];
  },

  // Get profile by user ID
  async findByUserId(userId: number): Promise<PlayerProfile | null> {
    const result = await query(
      'SELECT * FROM player_profiles WHERE user_id = $1',
      [userId]
    );
    return result.rows[0] || null;
  },

  // Get profile by player ID
  async findById(playerId: number): Promise<PlayerProfile | null> {
    const result = await query(
      'SELECT * FROM player_profiles WHERE id = $1',
      [playerId]
    );
    return result.rows[0] || null;
  },
};
