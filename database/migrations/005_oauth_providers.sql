-- =====================================================
-- OAUTH PROVIDERS AND GUEST ACCOUNTS MIGRATION
-- =====================================================
-- Adds support for Google, Apple OAuth and guest accounts

-- =====================================================
-- 1. ADD OAUTH ID COLUMNS
-- =====================================================
-- Google OAuth user ID
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) UNIQUE;

-- Apple OAuth user ID
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS apple_id VARCHAR(255) UNIQUE;

-- =====================================================
-- 2. ADD GUEST ACCOUNT FLAG
-- =====================================================
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS is_guest BOOLEAN DEFAULT FALSE;

-- =====================================================
-- 3. ADD AUTH PROVIDER COLUMN
-- =====================================================
-- First add the column without the constraint (for existing data)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(20) DEFAULT 'email';

-- Add CHECK constraint if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'users_auth_provider_check'
    ) THEN
        ALTER TABLE users 
        ADD CONSTRAINT users_auth_provider_check 
        CHECK (auth_provider IN ('email', 'google', 'apple', 'guest'));
    END IF;
END $$;

-- =====================================================
-- 4. CREATE INDEXES FOR OAUTH IDS
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id) WHERE google_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_apple_id ON users(apple_id) WHERE apple_id IS NOT NULL;

-- =====================================================
-- 5. UPDATE EXISTING USERS
-- =====================================================
-- Set auth_provider = 'email' for any existing users where it's NULL
UPDATE users 
SET auth_provider = 'email' 
WHERE auth_provider IS NULL;

-- =====================================================
-- 6. MODIFY EMAIL CONSTRAINT FOR GUEST/OAUTH USERS
-- =====================================================
-- Make email nullable for guest and OAuth users who may not have email
-- Note: This requires dropping and recreating the constraint
ALTER TABLE users 
ALTER COLUMN email DROP NOT NULL;
