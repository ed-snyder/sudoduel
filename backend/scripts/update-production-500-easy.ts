// Script to UPDATE production puzzles with the correct 500-easy puzzles (25 missing cells)
// Run with: DATABASE_URL=<railway_db_url> npx tsx backend/scripts/update-production-500-easy.ts

import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

interface PuzzleSeed {
  initial: string;
  solution: string;
  difficulty: string;
}

function parsePuzzlesFromSql(sql: string): PuzzleSeed[] {
  const puzzles: PuzzleSeed[] = [];
  const regex =
    /\(\s*1\s*,\s*'([0-9]{81})'\s*,\s*'([0-9]{81})'\s*,\s*'(EASY|MEDIUM|HARD|EXPERT)'\s*\)\s*[,;]/g;

  let match: RegExpExecArray | null;
  while ((match = regex.exec(sql)) !== null) {
    const [, initial, solution, difficulty] = match;
    puzzles.push({ initial, solution, difficulty });
  }

  return puzzles;
}

function countMissingCells(grid: string): number {
  return (grid.match(/0/g) || []).length;
}

async function updatePuzzles() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('❌ DATABASE_URL environment variable not set');
    console.error('   Usage: DATABASE_URL=<your_railway_db_url> npx tsx backend/scripts/update-production-500-easy.ts');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: dbUrl });

  try {
    // Read the 500-easy seeds file
    // __dirname is backend/scripts, so go up two levels to project root
    const seedsPath = path.resolve(__dirname, '../../database/seeds/puzzles-500-easy.sql');
    console.log(`📖 Reading seeds from: ${seedsPath}`);
    
    if (!fs.existsSync(seedsPath)) {
      console.error(`❌ Seeds file not found at: ${seedsPath}`);
      process.exit(1);
    }

    const sql = fs.readFileSync(seedsPath, 'utf8');
    const puzzles = parsePuzzlesFromSql(sql);

    if (puzzles.length === 0) {
      console.error('❌ No puzzles found in seeds file');
      process.exit(1);
    }

    console.log(`✅ Found ${puzzles.length} puzzles in seeds file`);
    console.log(`   First puzzle has ${countMissingCells(puzzles[0].initial)} missing cells (should be 25)\n`);

    if (countMissingCells(puzzles[0].initial) !== 25) {
      console.error('❌ WARNING: First puzzle does not have 25 missing cells!');
      console.error('   The seeds file may be incorrect.');
      process.exit(1);
    }

    // Connect to database
    console.log('🔌 Connecting to database...');
    const client = await pool.connect();
    console.log('✅ Connected\n');

    // Check current state
    const currentState = await client.query(`
      SELECT MIN(id) as min_id, MAX(id) as max_id, COUNT(*) as count,
             AVG(LENGTH(initial_grid) - LENGTH(REPLACE(initial_grid, '0', ''))) as avg_missing
      FROM puzzles WHERE ladder_id = 1
    `);
    
    const { min_id, max_id, count, avg_missing } = currentState.rows[0];
    console.log(`📊 Current database state:`);
    console.log(`   Puzzle IDs: ${min_id} to ${max_id}`);
    console.log(`   Total puzzles: ${count}`);
    console.log(`   Avg missing cells: ${parseFloat(avg_missing).toFixed(1)}\n`);

    if (parseInt(count) !== 500 || parseInt(min_id) !== 1011 || parseInt(max_id) !== 1510) {
      console.error('❌ Unexpected puzzle ID range. Expected 1011-1510 with 500 puzzles.');
      console.error('   You may need to manually fix the database first.');
      client.release();
      await pool.end();
      process.exit(1);
    }

    // Update each puzzle
    console.log('📝 Updating puzzles with correct grids (25 missing cells)...');
    let updated = 0;
    
    for (let i = 0; i < puzzles.length; i++) {
      const puzzle = puzzles[i];
      const puzzleId = 1011 + i; // IDs are 1011-1510
      
      await client.query(
        `UPDATE puzzles 
         SET initial_grid = $1, solution_grid = $2, difficulty = $3
         WHERE id = $4`,
        [puzzle.initial, puzzle.solution, puzzle.difficulty, puzzleId]
      );
      
      updated++;
      if (updated % 100 === 0) {
        console.log(`   Updated ${updated}/${puzzles.length} puzzles...`);
      }
    }

    console.log(`   ✅ Updated all ${updated} puzzles\n`);

    // Verify
    console.log('🔍 Verifying updated puzzles...');
    const verifyResult = await client.query(`
      SELECT id, 
             LENGTH(initial_grid) - LENGTH(REPLACE(initial_grid, '0', '')) as missing_cells
      FROM puzzles 
      WHERE ladder_id = 1 
      ORDER BY id 
      LIMIT 5
    `);
    
    console.log('   Sample of updated puzzles:');
    verifyResult.rows.forEach(row => {
      const status = parseInt(row.missing_cells) === 25 ? '✅' : '❌';
      console.log(`   ${status} Puzzle ID ${row.id}: ${row.missing_cells} missing cells`);
    });

    // Final count
    const finalCheck = await client.query(`
      SELECT COUNT(*) as correct_count 
      FROM puzzles 
      WHERE ladder_id = 1 
      AND LENGTH(initial_grid) - LENGTH(REPLACE(initial_grid, '0', '')) = 25
    `);
    
    const correctCount = parseInt(finalCheck.rows[0].correct_count);
    console.log(`\n   ${correctCount}/500 puzzles now have exactly 25 missing cells`);

    client.release();
    await pool.end();

    if (correctCount === 500) {
      console.log('\n✨ Successfully updated all puzzles!');
      console.log('   All 500 puzzles now have 25 missing cells (56 clues).');
    } else {
      console.log('\n⚠️  Some puzzles may not have been updated correctly.');
    }

  } catch (error: any) {
    console.error('❌ Error updating puzzles:', error.message);
    console.error(error);
    process.exit(1);
  }
}

updatePuzzles();







