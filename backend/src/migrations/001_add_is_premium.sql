-- Add is_premium column to player_profiles
ALTER TABLE player_profiles 
ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT FALSE;

-- Create index for premium lookups
CREATE INDEX IF NOT EXISTS idx_player_profiles_is_premium ON player_profiles(is_premium);
