import { query } from '../config/database';

export interface PlayerProfile {
  id: number;
  user_id: number;
  display_name: string;
  avatar_url: string | null;
  country_code: string | null;
  tutorial_completed?: boolean;
  tutorial_completed_at?: Date | null;
  is_premium?: boolean;
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
      `SELECT id, user_id, display_name, avatar_url, country_code, 
              tutorial_completed, tutorial_completed_at, is_premium, created_at, updated_at
       FROM player_profiles WHERE user_id = $1`,
      [userId]
    );
    return result.rows[0] || null;
  },

  // Get profile by player ID
  async findById(playerId: number): Promise<PlayerProfile | null> {
    const result = await query(
      `SELECT id, user_id, display_name, avatar_url, country_code, 
              tutorial_completed, tutorial_completed_at, is_premium, created_at, updated_at
       FROM player_profiles WHERE id = $1`,
      [playerId]
    );
    return result.rows[0] || null;
  },

  // Mark tutorial as complete
  async markTutorialComplete(playerId: number): Promise<void> {
    // Ensure tutorial columns exist (for existing databases)
    try {
      await query(`SELECT tutorial_completed FROM player_profiles LIMIT 1`);
    } catch (err: any) {
      if (err.message.includes('column "tutorial_completed" does not exist')) {
        await query(`
          ALTER TABLE player_profiles 
          ADD COLUMN IF NOT EXISTS tutorial_completed BOOLEAN NOT NULL DEFAULT FALSE,
          ADD COLUMN IF NOT EXISTS tutorial_completed_at TIMESTAMP NULL
        `);
        await query(`CREATE INDEX IF NOT EXISTS idx_player_profiles_tutorial ON player_profiles(tutorial_completed)`);
      } else {
        throw err;
      }
    }

    // Mark as complete (idempotent - safe to call multiple times)
    await query(
      `UPDATE player_profiles 
       SET tutorial_completed = TRUE, 
           tutorial_completed_at = COALESCE(tutorial_completed_at, NOW())
       WHERE id = $1`,
      [playerId]
    );
  },
};
