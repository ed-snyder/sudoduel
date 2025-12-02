import { query } from '../src/config/database';

async function clearDatabase() {
  try {
    console.log('🧹 Starting database cleanup...');

    // Delete in order to respect foreign key constraints
    console.log('1. Deleting match_players...');
    const matchPlayersResult = await query('DELETE FROM match_players');
    console.log(`   ✅ Deleted ${matchPlayersResult.rowCount} match_players records`);

    console.log('2. Deleting matchmaking_queue...');
    const queueResult = await query('DELETE FROM matchmaking_queue');
    console.log(`   ✅ Deleted ${queueResult.rowCount} matchmaking_queue records`);

    console.log('3. Deleting matches...');
    const matchesResult = await query('DELETE FROM matches');
    console.log(`   ✅ Deleted ${matchesResult.rowCount} matches records`);

    console.log('4. Deleting player_ratings...');
    const ratingsResult = await query('DELETE FROM player_ratings');
    console.log(`   ✅ Deleted ${ratingsResult.rowCount} player_ratings records`);

    console.log('5. Deleting player_profiles...');
    const profilesResult = await query('DELETE FROM player_profiles');
    console.log(`   ✅ Deleted ${profilesResult.rowCount} player_profiles records`);

    console.log('6. Deleting users...');
    const usersResult = await query('DELETE FROM users');
    console.log(`   ✅ Deleted ${usersResult.rowCount} users records`);

    console.log('\n✨ Database cleanup complete!');
    console.log('   - All users removed');
    console.log('   - All match history removed');
    console.log('   - All ratings removed');
    console.log('   - Ladders and puzzles preserved (system data)');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error clearing database:', error);
    process.exit(1);
  }
}

clearDatabase();

