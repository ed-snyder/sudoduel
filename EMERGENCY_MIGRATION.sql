-- =====================================================
-- EMERGENCY DATABASE RESTORE - RUN IN RAILWAY QUERY TAB
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. USERS TABLE
-- =====================================================
CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    username VARCHAR(50) UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);

-- =====================================================
-- 2. PLAYER PROFILES TABLE
-- =====================================================
CREATE TABLE player_profiles (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    display_name VARCHAR(100) NOT NULL,
    avatar_url VARCHAR(500),
    country_code CHAR(2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    peak_rating DECIMAL(10,2) DEFAULT 1500,
    current_win_streak INTEGER DEFAULT 0,
    best_win_streak INTEGER DEFAULT 0
);

CREATE INDEX idx_player_profiles_user_id ON player_profiles(user_id);

-- =====================================================
-- 3. LADDERS TABLE
-- =====================================================
CREATE TABLE ladders (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    time_limit_seconds INTEGER NOT NULL,
    lives INTEGER NOT NULL,
    is_ranked BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_ladders_code ON ladders(code);

-- =====================================================
-- 4. PLAYER RATINGS TABLE
-- =====================================================
CREATE TABLE player_ratings (
    id BIGSERIAL PRIMARY KEY,
    player_id BIGINT NOT NULL REFERENCES player_profiles(id) ON DELETE CASCADE,
    ladder_id INTEGER NOT NULL REFERENCES ladders(id) ON DELETE CASCADE,
    rating DOUBLE PRECISION DEFAULT 1500.0,
    rd DOUBLE PRECISION DEFAULT 350.0,
    volatility DOUBLE PRECISION DEFAULT 0.06,
    games_played INTEGER DEFAULT 0,
    last_update_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(player_id, ladder_id)
);

CREATE INDEX idx_player_ratings_player_ladder ON player_ratings(player_id, ladder_id);
CREATE INDEX idx_player_ratings_ladder_rating ON player_ratings(ladder_id, rating DESC);

-- =====================================================
-- 5. PUZZLES TABLE
-- =====================================================
CREATE TABLE puzzles (
    id BIGSERIAL PRIMARY KEY,
    ladder_id INTEGER NOT NULL REFERENCES ladders(id) ON DELETE CASCADE,
    initial_grid TEXT NOT NULL,
    solution_grid TEXT NOT NULL,
    difficulty VARCHAR(20) CHECK (difficulty IN ('EASY', 'MEDIUM', 'HARD', 'EXPERT')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB
);

CREATE INDEX idx_puzzles_ladder_id ON puzzles(ladder_id);
CREATE INDEX idx_puzzles_difficulty ON puzzles(difficulty);

-- =====================================================
-- 6. MATCHES TABLE
-- =====================================================
CREATE TABLE matches (
    id BIGSERIAL PRIMARY KEY,
    ladder_id INTEGER NOT NULL REFERENCES ladders(id) ON DELETE CASCADE,
    puzzle_id BIGINT NOT NULL REFERENCES puzzles(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'ABORTED')),
    result_code SMALLINT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    ended_at TIMESTAMP WITH TIME ZONE,
    server_region VARCHAR(50),
    is_ranked BOOLEAN DEFAULT TRUE
);

CREATE INDEX idx_matches_status ON matches(status);
CREATE INDEX idx_matches_ladder_id ON matches(ladder_id);
CREATE INDEX idx_matches_created_at ON matches(created_at DESC);
CREATE INDEX idx_matches_is_ranked ON matches(is_ranked);

-- =====================================================
-- 7. MATCH PLAYERS TABLE
-- =====================================================
CREATE TABLE match_players (
    id BIGSERIAL PRIMARY KEY,
    match_id BIGINT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    player_id BIGINT NOT NULL REFERENCES player_profiles(id) ON DELETE CASCADE,
    slot SMALLINT NOT NULL CHECK (slot IN (1, 2)),
    
    rating_before DOUBLE PRECISION NOT NULL,
    rd_before DOUBLE PRECISION NOT NULL,
    volatility_before DOUBLE PRECISION NOT NULL,
    
    rating_after DOUBLE PRECISION,
    rd_after DOUBLE PRECISION,
    volatility_after DOUBLE PRECISION,
    
    cells_completed INTEGER DEFAULT 0,
    lives_used INTEGER DEFAULT 0,
    lives_remaining INTEGER DEFAULT 3,
    mistakes INTEGER DEFAULT 0,
    time_spent_seconds INTEGER DEFAULT 0,
    time_at_finish INTEGER,
    longest_cell_streak INTEGER DEFAULT 0,
    
    final_state VARCHAR(20) CHECK (final_state IN ('SOLVED', 'LOCKED_OUT', 'TIMEOUT', 'DISCONNECTED')),
    is_winner BOOLEAN,
    
    UNIQUE(match_id, player_id),
    UNIQUE(match_id, slot)
);

CREATE INDEX idx_match_players_match_id ON match_players(match_id);
CREATE INDEX idx_match_players_player_id ON match_players(player_id);

-- =====================================================
-- 8. MATCHMAKING QUEUE TABLE
-- =====================================================
CREATE TABLE matchmaking_queue (
    id BIGSERIAL PRIMARY KEY,
    player_id BIGINT NOT NULL REFERENCES player_profiles(id) ON DELETE CASCADE,
    ladder_id INTEGER NOT NULL REFERENCES ladders(id) ON DELETE CASCADE,
    enqueued_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    rating_snapshot DOUBLE PRECISION NOT NULL,
    rd_snapshot DOUBLE PRECISION NOT NULL,
    region VARCHAR(50),
    UNIQUE(player_id, ladder_id)
);

CREATE INDEX idx_matchmaking_queue_ladder_id ON matchmaking_queue(ladder_id);
CREATE INDEX idx_matchmaking_queue_enqueued_at ON matchmaking_queue(enqueued_at);
CREATE INDEX idx_matchmaking_queue_rating ON matchmaking_queue(ladder_id, rating_snapshot);

-- =====================================================
-- 9. FRIENDSHIPS TABLE
-- =====================================================
CREATE TABLE friendships (
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
-- 10. FRIEND REQUESTS TABLE
-- =====================================================
CREATE TABLE friend_requests (
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
-- 11. FRIEND MATCH REQUESTS TABLE
-- =====================================================
CREATE TABLE friend_match_requests (
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
-- 12. HEAD-TO-HEAD STATS TABLE
-- =====================================================
CREATE TABLE head_to_head_stats (
    id BIGSERIAL PRIMARY KEY,
    player1_id BIGINT NOT NULL REFERENCES player_profiles(id) ON DELETE CASCADE,
    player2_id BIGINT NOT NULL REFERENCES player_profiles(id) ON DELETE CASCADE,
    player1_wins INTEGER DEFAULT 0,
    player2_wins INTEGER DEFAULT 0,
    draws INTEGER DEFAULT 0,
    last_match_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(player1_id, player2_id),
    CHECK (player1_id < player2_id)
);

CREATE INDEX idx_h2h_player1 ON head_to_head_stats(player1_id);
CREATE INDEX idx_h2h_player2 ON head_to_head_stats(player2_id);

-- =====================================================
-- UNIQUE INDEX FOR DISPLAY NAME
-- =====================================================
CREATE UNIQUE INDEX idx_player_profiles_display_name_lower 
ON player_profiles (LOWER(display_name));

-- =====================================================
-- TRIGGERS
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_player_profiles_updated_at BEFORE UPDATE ON player_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_h2h_stats_updated_at BEFORE UPDATE ON head_to_head_stats
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- HEAD-TO-HEAD UPDATE FUNCTION
-- =====================================================
CREATE OR REPLACE FUNCTION update_head_to_head_stats(
    p_player1_id BIGINT,
    p_player2_id BIGINT,
    p_winner_id BIGINT
)
RETURNS VOID AS $$
DECLARE
    v_lower_id BIGINT;
    v_higher_id BIGINT;
    v_player1_won BOOLEAN;
    v_player2_won BOOLEAN;
    v_is_draw BOOLEAN;
BEGIN
    IF p_player1_id < p_player2_id THEN
        v_lower_id := p_player1_id;
        v_higher_id := p_player2_id;
    ELSE
        v_lower_id := p_player2_id;
        v_higher_id := p_player1_id;
    END IF;
    
    v_is_draw := (p_winner_id IS NULL);
    v_player1_won := (p_winner_id = v_lower_id);
    v_player2_won := (p_winner_id = v_higher_id);
    
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

-- =====================================================
-- DEFAULT LADDER
-- =====================================================
INSERT INTO ladders (code, name, time_limit_seconds, lives, is_ranked)
VALUES ('9x9_5min_ranked', '9x9 • 5min Ranked', 300, 3, TRUE);

-- =====================================================
-- INITIAL PUZZLES
-- =====================================================
INSERT INTO puzzles (ladder_id, initial_grid, solution_grid, difficulty) VALUES
(1, '530070000600195000098000060800060003400803001700020006060000280000419005000080079', '534678912672195348198342567859761423426853791713924856961537284287419635345286179', 'EASY'),
(1, '000260701680070090190004500820100040004602900050003028009300074040050036703018000', '435269781682571493197834562826195347374682915951743628519326874248957136763418259', 'EASY'),
(1, '800000070006010053040603000010000026080000040350000010000506090160020400020000007', '831295674796418253245673981914837526687152349352964718473586192168729435529341867', 'EASY'),
(1, '090300001000080046000000800405060000003000100000020508008000000640050000200007090', '894376251157982346362415879485163927723598164916724538578639412649251783231847695', 'EASY'),
(1, '003020600900305001001806400008102900700000008006708200002609500800203009005010300', '483921657967345821251876493548132976729564138136798245372689514814253769695417382', 'EASY');

-- =====================================================
-- VERIFY
-- =====================================================
SELECT 'Tables created:' as status, count(*) as count FROM pg_tables WHERE schemaname = 'public';
