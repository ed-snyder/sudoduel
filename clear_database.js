// Script to clear all user data and matchmaking queue
const { Pool } = require('pg');
require('dotenv').config({ path: './backend/.env' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function clearDatabase() {
  const client = await pool.connect();
  
  try {
    console.log('🗑️  Clearing database...');
    
    // Delete in order to respect foreign key constraints
    await client.query('DELETE FROM matchmaking_queue');
    console.log('✅ Cleared matchmaking_queue');
    
    await client.query('DELETE FROM match_players');
    console.log('✅ Cleared match_players');
    
    await client.query('DELETE FROM matches');
    console.log('✅ Cleared matches');
    
    await client.query('DELETE FROM player_ratings');
    console.log('✅ Cleared player_ratings');
    
    await client.query('DELETE FROM player_profiles');
    console.log('✅ Cleared player_profiles');
    
    await client.query('DELETE FROM users');
    console.log('✅ Cleared users');
    
    // Reset sequences
    await client.query('ALTER SEQUENCE users_id_seq RESTART WITH 1');
    await client.query('ALTER SEQUENCE player_profiles_id_seq RESTART WITH 1');
    await client.query('ALTER SEQUENCE player_ratings_id_seq RESTART WITH 1');
    await client.query('ALTER SEQUENCE matches_id_seq RESTART WITH 1');
    await client.query('ALTER SEQUENCE match_players_id_seq RESTART WITH 1');
    await client.query('ALTER SEQUENCE matchmaking_queue_id_seq RESTART WITH 1');
    console.log('✅ Reset all sequences');
    
    // Verify
    const result = await client.query(`
      SELECT 'Users' as table_name, COUNT(*) as count FROM users
      UNION ALL
      SELECT 'Player profiles', COUNT(*) FROM player_profiles
      UNION ALL
      SELECT 'Matchmaking queue', COUNT(*) FROM matchmaking_queue
      UNION ALL
      SELECT 'Matches', COUNT(*) FROM matches
      UNION ALL
      SELECT 'Match players', COUNT(*) FROM match_players
      UNION ALL
      SELECT 'Player ratings', COUNT(*) FROM player_ratings
    `);
    
    console.log('\n📊 Verification:');
    result.rows.forEach(row => {
      console.log(`   ${row.table_name}: ${row.count}`);
    });
    
    console.log('\n✅ Database cleared successfully!');
    
  } catch (error) {
    console.error('❌ Error clearing database:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

clearDatabase();

