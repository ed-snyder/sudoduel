-- Add 15 low-rating bot accounts for beginner matchmaking
-- These bots fill the gap below 1000 rating
-- Run this on production database to add bots without re-seeding

DO $$
DECLARE
    bot_count INTEGER := 0;
    existing_bot_count INTEGER;
    bot_user_id BIGINT;
    bot_profile_id BIGINT;
    bot_rating DOUBLE PRECISION;
    bot_username TEXT;
    bot_display_name TEXT;
    bot_email TEXT;
    rating_range RECORD;
BEGIN
    -- Check how many bots already exist
    SELECT COUNT(*) INTO existing_bot_count 
    FROM player_profiles WHERE is_bot = TRUE;
    
    RAISE NOTICE 'Existing bot count: %', existing_bot_count;
    
    -- Only add low-rating bots (400-1000 range)
    FOR rating_range IN 
        SELECT 400 AS min_rating, 600 AS max_rating, 5 AS count
        UNION ALL SELECT 600, 800, 5
        UNION ALL SELECT 800, 1000, 5
    LOOP
        FOR i IN 1..rating_range.count LOOP
            -- Generate random 6-character alphanumeric suffix
            bot_username := 'Guest_' || upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 6));
            bot_display_name := bot_username;
            bot_email := 'bot_low_' || existing_bot_count || '_' || bot_count || '@sudoduel.internal';
            
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
            
            RAISE NOTICE 'Created bot: % with rating %', bot_display_name, ROUND(bot_rating);
        END LOOP;
    END LOOP;
    
    RAISE NOTICE 'Created % new low-rating bot accounts', bot_count;
END $$;

-- Verify the new bots were created
SELECT pp.display_name, pr.rating 
FROM player_profiles pp
JOIN player_ratings pr ON pr.player_id = pp.id
WHERE pp.is_bot = TRUE AND pr.rating < 1000
ORDER BY pr.rating;

