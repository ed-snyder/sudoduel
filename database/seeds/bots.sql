-- Seed 50 bot accounts for matchmaking
-- Bot distribution:
-- 1000-1200: 5 bots
-- 1200-1300: 8 bots
-- 1300-1400: 10 bots
-- 1400-1500: 10 bots
-- 1500-1600: 9 bots
-- 1600-1700: 5 bots
-- 1700-1800: 3 bots

-- Helper function to generate random alphanumeric string
DO $$
DECLARE
    bot_count INTEGER := 0;
    bot_id BIGINT;
    bot_user_id BIGINT;
    bot_profile_id BIGINT;
    bot_rating DOUBLE PRECISION;
    bot_username TEXT;
    bot_display_name TEXT;
    bot_email TEXT;
    rating_range RECORD;
BEGIN
    -- Rating ranges with counts
    FOR rating_range IN 
        SELECT 1000 AS min_rating, 1200 AS max_rating, 5 AS count
        UNION ALL SELECT 1200, 1300, 8
        UNION ALL SELECT 1300, 1400, 10
        UNION ALL SELECT 1400, 1500, 10
        UNION ALL SELECT 1500, 1600, 9
        UNION ALL SELECT 1600, 1700, 5
        UNION ALL SELECT 1700, 1800, 3
    LOOP
        FOR i IN 1..rating_range.count LOOP
            -- Generate random 6-character alphanumeric suffix
            bot_username := 'Guest_' || upper(substring(md5(random()::text) from 1 for 6));
            bot_display_name := bot_username;
            bot_email := 'bot_' || bot_count || '@sudoduel.internal';
            
            -- Generate random rating within range
            bot_rating := rating_range.min_rating + (random() * (rating_range.max_rating - rating_range.min_rating));
            
            -- Create user account (password_hash is NULL for bots)
            INSERT INTO users (email, username, password_hash)
            VALUES (bot_email, bot_username, NULL)
            RETURNING id INTO bot_user_id;
            
            -- Create player profile with is_bot = TRUE
            INSERT INTO player_profiles (user_id, display_name, is_bot)
            VALUES (bot_user_id, bot_display_name, TRUE)
            RETURNING id INTO bot_profile_id;
            
            -- Create rating entry (RD = 150, volatility = 0.06, ladder_id = 1)
            INSERT INTO player_ratings (player_id, ladder_id, rating, rd, volatility, games_played)
            VALUES (bot_profile_id, 1, bot_rating, 150, 0.06, 0);
            
            bot_count := bot_count + 1;
        END LOOP;
    END LOOP;
    
    RAISE NOTICE 'Created % bot accounts', bot_count;
END $$;
