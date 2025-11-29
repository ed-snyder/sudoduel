-- =====================================================
-- SUDODUEL DATABASE SCHEMA
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
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
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
    server_region VARCHAR(50)
);

CREATE INDEX idx_matches_status ON matches(status);
CREATE INDEX idx_matches_ladder_id ON matches(ladder_id);
CREATE INDEX idx_matches_created_at ON matches(created_at DESC);

-- =====================================================
-- 7. MATCH PLAYERS TABLE
-- =====================================================
CREATE TABLE match_players (
    id BIGSERIAL PRIMARY KEY,
    match_id BIGINT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    player_id BIGINT NOT NULL REFERENCES player_profiles(id) ON DELETE CASCADE,
    slot SMALLINT NOT NULL CHECK (slot IN (1, 2)),
    
    -- Rating snapshot before match
    rating_before DOUBLE PRECISION NOT NULL,
    rd_before DOUBLE PRECISION NOT NULL,
    volatility_before DOUBLE PRECISION NOT NULL,
    
    -- Rating after match (nullable until completed)
    rating_after DOUBLE PRECISION,
    rd_after DOUBLE PRECISION,
    volatility_after DOUBLE PRECISION,
    
    -- Match performance stats
    cells_completed INTEGER DEFAULT 0,
    lives_used INTEGER DEFAULT 0,
    lives_remaining INTEGER DEFAULT 3,
    mistakes INTEGER DEFAULT 0,
    time_spent_seconds INTEGER DEFAULT 0,
    
    -- Final state
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
-- TRIGGERS FOR UPDATED_AT
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

-- =====================================================
-- INITIAL DATA: Default Ladder
-- =====================================================

INSERT INTO ladders (code, name, time_limit_seconds, lives, is_ranked)
VALUES ('9x9_5min_ranked', '9x9 • 5min Ranked', 300, 3, TRUE);

