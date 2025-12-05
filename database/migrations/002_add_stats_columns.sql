-- =====================================================
-- ADD STATS COLUMNS FOR PLAYER STATISTICS DASHBOARD
-- =====================================================

-- Add columns to match_players table
ALTER TABLE match_players 
  ADD COLUMN IF NOT EXISTS time_at_finish INTEGER, -- seconds remaining when game ended
  ADD COLUMN IF NOT EXISTS longest_cell_streak INTEGER DEFAULT 0; -- longest in-game cell streak

-- Add columns to player_profiles table
ALTER TABLE player_profiles 
  ADD COLUMN IF NOT EXISTS peak_rating DECIMAL(10,2) DEFAULT 1500,
  ADD COLUMN IF NOT EXISTS current_win_streak INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS best_win_streak INTEGER DEFAULT 0;

-- Update existing player_profiles to initialize peak_rating from current rating
UPDATE player_profiles pp
SET peak_rating = COALESCE(
  (SELECT rating FROM player_ratings pr WHERE pr.player_id = pp.id AND pr.ladder_id = 1 LIMIT 1),
  1500
)
WHERE peak_rating IS NULL OR peak_rating = 1500;

