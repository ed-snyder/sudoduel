// Script to update puzzles in production database with fixed seeds
// Run with: DATABASE_URL=<railway_db_url> npx tsx backend/scripts/update-production-puzzles.ts

/// <reference types="node" />

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

async function updatePuzzles() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('❌ DATABASE_URL environment variable not set');
    console.error('   Usage: DATABASE_URL=<your_railway_db_url> npx tsx backend/scripts/update-production-puzzles.ts');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: dbUrl });

  try {
    // Read the fixed seeds file
    const seedsPath = path.resolve(process.cwd(), 'database/seeds/puzzles.sql');
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

    console.log(`✅ Found ${puzzles.length} puzzles in seeds file\n`);

    // Connect to database
    console.log('🔌 Connecting to database...');
    const client = await pool.connect();
    console.log('✅ Connected\n');

    // Get current ladder_id (should be 1)
    const ladderResult = await client.query('SELECT id FROM ladders WHERE code = $1', ['9x9_5min_ranked']);
    if (ladderResult.rows.length === 0) {
      console.error('❌ Ladder "9x9_5min_ranked" not found in database');
      client.release();
      await pool.end();
      process.exit(1);
    }
    const ladderId = ladderResult.rows[0].id;
    console.log(`📋 Using ladder_id: ${ladderId}\n`);

    // Delete existing puzzles for this ladder
    console.log('🗑️  Deleting existing puzzles...');
    const deleteResult = await client.query('DELETE FROM puzzles WHERE ladder_id = $1', [ladderId]);
    console.log(`   Deleted ${deleteResult.rowCount} existing puzzle(s)\n`);

    // Insert new puzzles
    console.log('📝 Inserting fixed puzzles...');
    for (let i = 0; i < puzzles.length; i++) {
      const puzzle = puzzles[i];
      await client.query(
        `INSERT INTO puzzles (ladder_id, initial_grid, solution_grid, difficulty) 
         VALUES ($1, $2, $3, $4)`,
        [ladderId, puzzle.initial, puzzle.solution, puzzle.difficulty]
      );
      console.log(`   ✅ Puzzle ${i + 1} (${puzzle.difficulty}) inserted`);
    }

    // Verify
    console.log('\n🔍 Verifying inserted puzzles...');
    const verifyResult = await client.query('SELECT id, difficulty FROM puzzles WHERE ladder_id = $1 ORDER BY id', [ladderId]);
    console.log(`   Found ${verifyResult.rows.length} puzzle(s) in database:`);
    verifyResult.rows.forEach((row, idx) => {
      console.log(`   - Puzzle ID ${row.id}: ${row.difficulty}`);
    });

    client.release();
    await pool.end();

    console.log('\n✨ Successfully updated puzzles in database!');
    console.log('   All puzzles now match the fixed seeds file.');
    console.log('\n⚠️  Note: Existing matches will continue to use old puzzles.');
    console.log('   New matches will use the corrected puzzles.');

  } catch (error: any) {
    console.error('❌ Error updating puzzles:', error.message);
    console.error(error);
    process.exit(1);
  }
}

updatePuzzles();

