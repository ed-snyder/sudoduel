-- Add bot match tracking fields to matches table
ALTER TABLE matches ADD COLUMN IF NOT EXISTS is_bot_match BOOLEAN DEFAULT false;

-- Add bot tracking fields to match_players table  
ALTER TABLE match_players ADD COLUMN IF NOT EXISTS is_bot BOOLEAN DEFAULT false;
ALTER TABLE match_players ADD COLUMN IF NOT EXISTS bot_id VARCHAR(255);

-- Index for quick first-match lookups (check if player has played any games)
CREATE INDEX IF NOT EXISTS idx_match_players_player_id ON match_players(player_id);

-- Index for finding bot matches
CREATE INDEX IF NOT EXISTS idx_matches_is_bot_match ON matches(is_bot_match) WHERE is_bot_match = true;
