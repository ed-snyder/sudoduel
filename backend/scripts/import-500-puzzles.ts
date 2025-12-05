// Script to import 500 easy puzzles into the database
import { query } from '../src/config/database';
import * as fs from 'fs';
import * as path from 'path';

async function importPuzzles() {
  try {
    console.log('📦 Importing 500 easy puzzles...\n');

    // Read the SQL file
    const sqlPath = path.join(__dirname, '../../database/seeds/puzzles-500-easy.sql');
    console.log(`📖 Reading puzzles from: ${sqlPath}`);
    
    if (!fs.existsSync(sqlPath)) {
      console.error(`❌ File not found: ${sqlPath}`);
      process.exit(1);
    }

    const sql = fs.readFileSync(sqlPath, 'utf-8');
    
    // Execute the SQL (it has DELETE and INSERT statements)
    console.log('🗑️  Deleting existing puzzles for ladder_id = 1...');
    await query('DELETE FROM puzzles WHERE ladder_id = 1');
    
    console.log('📥 Inserting 500 puzzles...');
    // Split by semicolon and execute each statement
    const statements = sql.split(';').filter(s => s.trim().length > 0);
    
    for (const statement of statements) {
      const trimmed = statement.trim();
      if (trimmed && !trimmed.startsWith('--')) {
        await query(trimmed);
      }
    }

    // Verify count
    const countResult = await query('SELECT COUNT(*) as count FROM puzzles WHERE ladder_id = 1');
    const count = parseInt(countResult.rows[0].count, 10);
    
    console.log(`\n✅ Successfully imported ${count} puzzles!`);
    
    if (count === 500) {
      console.log('✨ Perfect! All 500 puzzles are in the database.');
    } else {
      console.log(`⚠️  Expected 500 puzzles, but found ${count}`);
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error importing puzzles:', error);
    process.exit(1);
  }
}

importPuzzles();

