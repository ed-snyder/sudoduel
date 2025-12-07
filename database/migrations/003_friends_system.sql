-- =====================================================
-- FRIENDS SYSTEM MIGRATION
-- =====================================================

-- =====================================================
-- 1. ADD UNIQUE CONSTRAINT ON DISPLAY_NAME
-- =====================================================
-- First, create a unique index on display_name (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS idx_player_profiles_display_name_lower 
ON player_profiles (LOWER(display_name));

-- =====================================================
-- 2. FRIENDSHIPS TABLE
-- =====================================================
-- Stores confirmed friendships between players
-- We store both directions (player1 -> player2 AND player2 -> player1) for easier querying
CREATE TABLE IF NOT EXISTS friendships (
    id BIGSERIAL PRIMARY KEY,
    player_id BIGINT NOT NULL REFERENCES player_profiles(id) ON DELETE CASCADE,
    friend_id BIGINT NOT NULL REFERENCES player_profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(player_id, friend_id),
    CHECK (player_id != friend_id)
);

CREATE INDEX idx_friendships_player_id ON friendships(player_id);
CREATE INDEX idx_friendships_friend_id ON friendships(friend_id);

-- =====================================================
-- 3. FRIEND REQUESTS TABLE
-- =====================================================
-- Stores pending friend requests
CREATE TABLE IF NOT EXISTS friend_requests (
    id BIGSERIAL PRIMARY KEY,
    from_player_id BIGINT NOT NULL REFERENCES player_profiles(id) ON DELETE CASCADE,
    to_player_id BIGINT NOT NULL REFERENCES player_profiles(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'REJECTED')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    responded_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(from_player_id, to_player_id),
    CHECK (from_player_id != to_player_id)
);

CREATE INDEX idx_friend_requests_from ON friend_requests(from_player_id);
CREATE INDEX idx_friend_requests_to ON friend_requests(to_player_id);
CREATE INDEX idx_friend_requests_status ON friend_requests(status);

-- =====================================================
-- 4. FRIEND MATCH REQUESTS TABLE
-- =====================================================
-- Stores pending match invitations from friends
CREATE TABLE IF NOT EXISTS friend_match_requests (
    id BIGSERIAL PRIMARY KEY,
    from_player_id BIGINT NOT NULL REFERENCES player_profiles(id) ON DELETE CASCADE,
    to_player_id BIGINT NOT NULL REFERENCES player_profiles(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED', 'EXPIRED')),
    match_id BIGINT REFERENCES matches(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    responded_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '30 seconds'),
    CHECK (from_player_id != to_player_id)
);

CREATE INDEX idx_friend_match_requests_from ON friend_match_requests(from_player_id);
CREATE INDEX idx_friend_match_requests_to ON friend_match_requests(to_player_id);
CREATE INDEX idx_friend_match_requests_status ON friend_match_requests(status);
CREATE INDEX idx_friend_match_requests_expires ON friend_match_requests(expires_at);

-- =====================================================
-- 5. HEAD-TO-HEAD STATS TABLE
-- =====================================================
-- Tracks match history between two specific players
CREATE TABLE IF NOT EXISTS head_to_head_stats (
    id BIGSERIAL PRIMARY KEY,
    player1_id BIGINT NOT NULL REFERENCES player_profiles(id) ON DELETE CASCADE,
    player2_id BIGINT NOT NULL REFERENCES player_profiles(id) ON DELETE CASCADE,
    player1_wins INTEGER DEFAULT 0,
    player2_wins INTEGER DEFAULT 0,
    draws INTEGER DEFAULT 0,
    last_match_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- Ensure player1_id < player2_id to avoid duplicates
    UNIQUE(player1_id, player2_id),
    CHECK (player1_id < player2_id)
);

CREATE INDEX idx_h2h_player1 ON head_to_head_stats(player1_id);
CREATE INDEX idx_h2h_player2 ON head_to_head_stats(player2_id);

-- =====================================================
-- 6. ADD IS_RANKED FLAG TO MATCHES
-- =====================================================
ALTER TABLE matches 
ADD COLUMN IF NOT EXISTS is_ranked BOOLEAN DEFAULT TRUE;

-- Add index for filtering ranked/unranked matches
CREATE INDEX IF NOT EXISTS idx_matches_is_ranked ON matches(is_ranked);

-- =====================================================
-- 7. TRIGGER FOR HEAD-TO-HEAD STATS UPDATED_AT
-- =====================================================
CREATE TRIGGER update_h2h_stats_updated_at 
BEFORE UPDATE ON head_to_head_stats
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 8. FUNCTION TO UPDATE HEAD-TO-HEAD STATS
-- =====================================================
CREATE OR REPLACE FUNCTION update_head_to_head_stats(
    p_player1_id BIGINT,
    p_player2_id BIGINT,
    p_winner_id BIGINT -- NULL for draw
)
RETURNS VOID AS $$
DECLARE
    v_lower_id BIGINT;
    v_higher_id BIGINT;
    v_player1_won BOOLEAN;
    v_player2_won BOOLEAN;
    v_is_draw BOOLEAN;
BEGIN
    -- Ensure consistent ordering (lower id first)
    IF p_player1_id < p_player2_id THEN
        v_lower_id := p_player1_id;
        v_higher_id := p_player2_id;
    ELSE
        v_lower_id := p_player2_id;
        v_higher_id := p_player1_id;
    END IF;
    
    -- Determine outcome
    v_is_draw := (p_winner_id IS NULL);
    v_player1_won := (p_winner_id = v_lower_id);
    v_player2_won := (p_winner_id = v_higher_id);
    
    -- Upsert the stats
    INSERT INTO head_to_head_stats (player1_id, player2_id, player1_wins, player2_wins, draws, last_match_at)
    VALUES (
        v_lower_id,
        v_higher_id,
        CASE WHEN v_player1_won THEN 1 ELSE 0 END,
        CASE WHEN v_player2_won THEN 1 ELSE 0 END,
        CASE WHEN v_is_draw THEN 1 ELSE 0 END,
        NOW()
    )
    ON CONFLICT (player1_id, player2_id) DO UPDATE SET
        player1_wins = head_to_head_stats.player1_wins + CASE WHEN v_player1_won THEN 1 ELSE 0 END,
        player2_wins = head_to_head_stats.player2_wins + CASE WHEN v_player2_won THEN 1 ELSE 0 END,
        draws = head_to_head_stats.draws + CASE WHEN v_is_draw THEN 1 ELSE 0 END,
        last_match_at = NOW();
END;
$$ LANGUAGE plpgsql;
