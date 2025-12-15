-- Add is_bot column to player_profiles table
ALTER TABLE player_profiles ADD COLUMN IF NOT EXISTS is_bot BOOLEAN DEFAULT FALSE;

-- Create index on is_bot for efficient bot lookups
CREATE INDEX IF NOT EXISTS idx_player_profiles_is_bot ON player_profiles(is_bot) WHERE is_bot = TRUE;
