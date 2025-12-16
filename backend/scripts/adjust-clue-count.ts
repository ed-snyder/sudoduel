/**
 * Adjust Clue Count Script
 * 
 * Reads existing puzzles from puzzles-500-easy.sql (51 clues each)
 * and reduces them to 46 clues (removes 5 random clues per puzzle).
 * 
 * Usage: npx ts-node scripts/adjust-clue-count.ts
 */

import * as fs from 'fs';
import * as path from 'path';

const INPUT_FILE = path.join(__dirname, '../../database/seeds/puzzles-500-easy.sql');
const OUTPUT_FILE = path.join(__dirname, '../../database/seeds/puzzles-46clues.sql');

const CLUES_TO_REMOVE = 5; // 51 - 5 = 46 clues
const TARGET_CLUE_COUNT = 46;

interface Puzzle {
  ladderId: number;
  initialGrid: string;
  solutionGrid: string;
  difficulty: string;
}

/**
 * Parse puzzles from the SQL file
 */
function parsePuzzles(sqlContent: string): Puzzle[] {
  const puzzles: Puzzle[] = [];
  
  // Match all puzzle value tuples: (1, 'initial_grid', 'solution_grid', 'EASY')
  const puzzleRegex = /\((\d+),\s*'([0-9]{81})',\s*'([0-9]{81})',\s*'(\w+)'\)/g;
  
  let match;
  while ((match = puzzleRegex.exec(sqlContent)) !== null) {
    puzzles.push({
      ladderId: parseInt(match[1], 10),
      initialGrid: match[2],
      solutionGrid: match[3],
      difficulty: match[4],
    });
  }
  
  return puzzles;
}

/**
 * Count clues (non-zero cells) in a grid
 */
function countClues(grid: string): number {
  let count = 0;
  for (const char of grid) {
    if (char !== '0') count++;
  }
  return count;
}

/**
 * Get indices of all clues in a grid
 */
function getClueIndices(grid: string): number[] {
  const indices: number[] = [];
  for (let i = 0; i < grid.length; i++) {
    if (grid[i] !== '0') {
      indices.push(i);
    }
  }
  return indices;
}

/**
 * Shuffle array using Fisher-Yates algorithm
 */
function shuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Remove random clues from a puzzle
 */
function removeClues(initialGrid: string, numToRemove: number): string {
  const clueIndices = getClueIndices(initialGrid);
  
  if (clueIndices.length < numToRemove) {
    console.error(`Error: Grid only has ${clueIndices.length} clues, cannot remove ${numToRemove}`);
    return initialGrid;
  }
  
  // Shuffle and pick first N indices to remove
  const shuffled = shuffle(clueIndices);
  const indicesToRemove = new Set(shuffled.slice(0, numToRemove));
  
  // Build new grid with removed clues
  let newGrid = '';
  for (let i = 0; i < initialGrid.length; i++) {
    if (indicesToRemove.has(i)) {
      newGrid += '0';
    } else {
      newGrid += initialGrid[i];
    }
  }
  
  return newGrid;
}

/**
 * Verify that a puzzle is still valid (solution matches remaining clues)
 */
function verifyPuzzle(initialGrid: string, solutionGrid: string): boolean {
  for (let i = 0; i < 81; i++) {
    if (initialGrid[i] !== '0' && initialGrid[i] !== solutionGrid[i]) {
      return false;
    }
  }
  return true;
}

/**
 * Main script
 */
async function main() {
  console.log('📖 Reading puzzles from:', INPUT_FILE);
  
  if (!fs.existsSync(INPUT_FILE)) {
    console.error('❌ Input file not found:', INPUT_FILE);
    process.exit(1);
  }
  
  const sqlContent = fs.readFileSync(INPUT_FILE, 'utf-8');
  const puzzles = parsePuzzles(sqlContent);
  
  console.log(`📊 Found ${puzzles.length} puzzles`);
  
  if (puzzles.length === 0) {
    console.error('❌ No puzzles found in input file');
    process.exit(1);
  }
  
  // Verify original clue count
  const firstPuzzleClues = countClues(puzzles[0].initialGrid);
  console.log(`📊 Original clue count: ${firstPuzzleClues}`);
  
  // Process puzzles
  const adjustedPuzzles: Puzzle[] = [];
  let successCount = 0;
  let errorCount = 0;
  
  for (let i = 0; i < puzzles.length; i++) {
    const puzzle = puzzles[i];
    const originalClues = countClues(puzzle.initialGrid);
    
    // Calculate how many to remove to get to target
    const toRemove = originalClues - TARGET_CLUE_COUNT;
    
    if (toRemove <= 0) {
      console.log(`⚠️ Puzzle ${i + 1} already has ${originalClues} clues (target: ${TARGET_CLUE_COUNT}), skipping`);
      adjustedPuzzles.push(puzzle);
      continue;
    }
    
    const newInitialGrid = removeClues(puzzle.initialGrid, toRemove);
    const newClueCount = countClues(newInitialGrid);
    
    // Verify
    if (newClueCount !== TARGET_CLUE_COUNT) {
      console.error(`❌ Puzzle ${i + 1}: Expected ${TARGET_CLUE_COUNT} clues, got ${newClueCount}`);
      errorCount++;
      continue;
    }
    
    if (!verifyPuzzle(newInitialGrid, puzzle.solutionGrid)) {
      console.error(`❌ Puzzle ${i + 1}: Verification failed - clues don't match solution`);
      errorCount++;
      continue;
    }
    
    adjustedPuzzles.push({
      ...puzzle,
      initialGrid: newInitialGrid,
    });
    successCount++;
  }
  
  console.log(`\n✅ Successfully adjusted ${successCount} puzzles`);
  if (errorCount > 0) {
    console.log(`❌ ${errorCount} puzzles had errors`);
  }
  
  // Generate output SQL
  const header = `-- 500 Easy Sudoku Puzzles (${TARGET_CLUE_COUNT} clues each, ${81 - TARGET_CLUE_COUNT} empty cells)
-- Adjusted from 51 clues to ${TARGET_CLUE_COUNT} clues

DELETE FROM puzzles WHERE ladder_id = 1;

INSERT INTO puzzles (ladder_id, initial_grid, solution_grid, difficulty) VALUES
`;

  const values = adjustedPuzzles.map((p, i) => {
    const comma = i < adjustedPuzzles.length - 1 ? ',' : ';';
    return `(${p.ladderId}, '${p.initialGrid}', '${p.solutionGrid}', '${p.difficulty}')${comma}`;
  }).join('\n');

  const output = header + values + '\n';
  
  fs.writeFileSync(OUTPUT_FILE, output, 'utf-8');
  console.log(`\n📝 Output written to: ${OUTPUT_FILE}`);
  
  // Verify a few puzzles
  console.log('\n🔍 Verifying first 5 puzzles:');
  for (let i = 0; i < Math.min(5, adjustedPuzzles.length); i++) {
    const p = adjustedPuzzles[i];
    const clues = countClues(p.initialGrid);
    const valid = verifyPuzzle(p.initialGrid, p.solutionGrid);
    console.log(`  Puzzle ${i + 1}: ${clues} clues, valid=${valid}`);
    console.log(`    Initial: ${p.initialGrid.substring(0, 27)}...`);
  }
  
  // Count clue distribution
  const clueDistribution = new Map<number, number>();
  for (const p of adjustedPuzzles) {
    const clues = countClues(p.initialGrid);
    clueDistribution.set(clues, (clueDistribution.get(clues) || 0) + 1);
  }
  
  console.log('\n📊 Clue count distribution:');
  for (const [clues, count] of Array.from(clueDistribution.entries()).sort((a, b) => a[0] - b[0])) {
    console.log(`  ${clues} clues: ${count} puzzles`);
  }
}

main().catch(console.error);

