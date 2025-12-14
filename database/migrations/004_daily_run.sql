-- =====================================================
-- DAILY RUN SYSTEM
-- =====================================================

-- Daily run results table
CREATE TABLE IF NOT EXISTS daily_run_results (
  id BIGSERIAL PRIMARY KEY,
  player_id BIGINT NOT NULL REFERENCES player_profiles(id) ON DELETE CASCADE,
  run_date DATE NOT NULL,
  completion_time_ms INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(player_id, run_date)
);

-- Index for fast leaderboard queries (fastest times first)
CREATE INDEX IF NOT EXISTS idx_daily_run_date_time ON daily_run_results(run_date, completion_time_ms ASC);
CREATE INDEX IF NOT EXISTS idx_daily_run_player ON daily_run_results(player_id);
