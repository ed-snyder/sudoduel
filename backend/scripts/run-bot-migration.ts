/**
 * Run bot migration and seed scripts
 * 
 * Usage:
 *   DATABASE_URL=<railway_db_url> npx tsx backend/scripts/run-bot-migration.ts
 * 
 * Or set DATABASE_URL in your environment:
 *   export DATABASE_URL=<railway_db_url>
 *   npx tsx backend/scripts/run-bot-migration.ts
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { Pool } from 'pg';

const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
  console.error('❌ DATABASE_URL environment variable not set');
  console.error('   Usage: DATABASE_URL=<your_railway_db_url> npx tsx backend/scripts/run-bot-migration.ts');
  console.error('');
  console.error('   To get your Railway DATABASE_URL:');
  console.error('   1. Go to Railway dashboard');
  console.error('   2. Select your PostgreSQL service');
  console.error('   3. Go to "Variables" tab');
  console.error('   4. Copy the DATABASE_URL value');
  process.exit(1);
}

const pool = new Pool({
  connectionString: dbUrl,
});

async function runMigration() {
  console.log('🔄 Running bot migration...');
  
  try {
    const migrationPath = join(__dirname, '../../database/migrations/002_add_bot_support.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');
    
    await pool.query(migrationSQL);
    console.log('✅ Migration completed successfully');
  } catch (error: any) {
    if (error.message && error.message.includes('already exists')) {
      console.log('⚠️  Migration already applied (column/index already exists)');
    } else {
      console.error('❌ Migration failed:', error.message);
      throw error;
    }
  }
}

async function seedBots() {
  console.log('🌱 Seeding bot accounts...');
  
  try {
    const seedPath = join(__dirname, '../../database/seeds/bots.sql');
    const seedSQL = readFileSync(seedPath, 'utf-8');
    
    await pool.query(seedSQL);
    console.log('✅ Bot seeding completed successfully');
  } catch (error: any) {
    console.error('❌ Bot seeding failed:', error.message);
    throw error;
  }
}

async function verifyBots() {
  console.log('🔍 Verifying bots were created...');
  
  try {
    const result = await pool.query(`
      SELECT pp.display_name, pp.is_bot, pr.rating 
      FROM player_profiles pp
      JOIN player_ratings pr ON pr.player_id = pp.id
      WHERE pp.is_bot = TRUE
      ORDER BY pr.rating
    `);
    
    console.log(`✅ Found ${result.rows.length} bot accounts:`);
    if (result.rows.length > 0) {
      console.log('');
      console.log('Sample bots:');
      result.rows.slice(0, 5).forEach((bot, i) => {
        console.log(`  ${i + 1}. ${bot.display_name} - Rating: ${Math.round(bot.rating)}`);
      });
      if (result.rows.length > 5) {
        console.log(`  ... and ${result.rows.length - 5} more`);
      }
    } else {
      console.log('⚠️  No bots found - seeding may have failed');
    }
  } catch (error: any) {
    console.error('❌ Verification failed:', error.message);
    throw error;
  }
}

async function main() {
  try {
    // Test connection
    await pool.query('SELECT 1');
    console.log('✅ Connected to database\n');
    
    // Run migration
    await runMigration();
    console.log('');
    
    // Seed bots
    await seedBots();
    console.log('');
    
    // Verify
    await verifyBots();
    console.log('');
    
    console.log('🎉 All done! Bot system is ready.');
  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
