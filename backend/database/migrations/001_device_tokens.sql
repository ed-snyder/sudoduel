-- Migration: Create device_tokens table for push notifications
-- Run this migration manually in your database

CREATE TABLE IF NOT EXISTS device_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  player_id INTEGER REFERENCES player_profiles(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform VARCHAR(10) NOT NULL CHECK (platform IN ('ios', 'android')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, token)
);

CREATE INDEX IF NOT EXISTS idx_device_tokens_user_id ON device_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_device_tokens_player_id ON device_tokens(player_id);

-- Add comment for documentation
COMMENT ON TABLE device_tokens IS 'Stores FCM device tokens for push notifications';

