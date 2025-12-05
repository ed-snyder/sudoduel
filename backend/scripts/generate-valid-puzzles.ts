// Generate 500 valid Sudoku puzzles with full validation
// Every puzzle has exactly 40 clues and a valid solution

function stringToGrid(s: string): number[][] {
  const grid: number[][] = [];
  for (let i = 0; i < 9; i++) {
    grid[i] = [];
    for (let j = 0; j < 9; j++) {
      grid[i][j] = parseInt(s[i * 9 + j], 10);
    }
  }
  return grid;
}

function gridToString(grid: number[][]): string {
  return grid.map(row => row.join('')).join('');
}

function generateSolvedGrid(): number[][] {
  const grid: number[][] = Array.from({ length: 9 }, () => Array(9).fill(0));
  
  function isValid(grid: number[][], row: number, col: number, num: number): boolean {
    // Check row
    for (let j = 0; j < 9; j++) {
      if (grid[row][j] === num) return false;
    }
    // Check column
    for (let i = 0; i < 9; i++) {
      if (grid[i][col] === num) return false;
    }
    // Check 3x3 box
    const boxRow = Math.floor(row / 3) * 3;
    const boxCol = Math.floor(col / 3) * 3;
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        if (grid[boxRow + i][boxCol + j] === num) return false;
      }
    }
    return true;
  }
  
  function solve(grid: number[][]): boolean {
    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 9; col++) {
        if (grid[row][col] === 0) {
          // Randomize number order for variety
          const nums = [1, 2, 3, 4, 5, 6, 7, 8, 9].sort(() => Math.random() - 0.5);
          for (const num of nums) {
            if (isValid(grid, row, col, num)) {
              grid[row][col] = num;
              if (solve(grid)) return true;
              grid[row][col] = 0;
            }
          }
          return false;
        }
      }
    }
    return true;
  }
  
  solve(grid);
  return grid;
}

function createInitialGrid(solution: number[][], targetClues: number = 40): number[][] {
  const initial = solution.map(row => [...row]);
  const positions: [number, number][] = [];
  
  // Collect all positions
  for (let i = 0; i < 9; i++) {
    for (let j = 0; j < 9; j++) {
      positions.push([i, j]);
    }
  }
  
  // Shuffle positions
  for (let i = positions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [positions[i], positions[j]] = [positions[j], positions[i]];
  }
  
  // Remove cells until we have exactly targetClues remaining
  let currentClues = 81;
  for (const [row, col] of positions) {
    if (currentClues <= targetClues) break;
    initial[row][col] = 0;
    currentClues--;
  }
  
  return initial;
}

function validateSolution(grid: number[][]): boolean {
  // Check all rows
  for (let i = 0; i < 9; i++) {
    const seen = new Set<number>();
    for (let j = 0; j < 9; j++) {
      const val = grid[i][j];
      if (val < 1 || val > 9 || seen.has(val)) return false;
      seen.add(val);
    }
  }
  // Check all columns
  for (let j = 0; j < 9; j++) {
    const seen = new Set<number>();
    for (let i = 0; i < 9; i++) {
      const val = grid[i][j];
      if (val < 1 || val > 9 || seen.has(val)) return false;
      seen.add(val);
    }
  }
  // Check all 3x3 boxes
  for (let boxRow = 0; boxRow < 3; boxRow++) {
    for (let boxCol = 0; boxCol < 3; boxCol++) {
      const seen = new Set<number>();
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          const val = grid[boxRow * 3 + i][boxCol * 3 + j];
          if (val < 1 || val > 9 || seen.has(val)) return false;
          seen.add(val);
        }
      }
    }
  }
  return true;
}

function validateInitialMatchesSolution(initial: number[][], solution: number[][]): boolean {
  for (let i = 0; i < 9; i++) {
    for (let j = 0; j < 9; j++) {
      if (initial[i][j] !== 0 && initial[i][j] !== solution[i][j]) {
        return false;
      }
    }
  }
  return true;
}

function countClues(grid: number[][]): number {
  let count = 0;
  for (let i = 0; i < 9; i++) {
    for (let j = 0; j < 9; j++) {
      if (grid[i][j] !== 0) count++;
    }
  }
  return count;
}

// Main generation loop
const puzzles: { initial: string; solution: string }[] = [];
const seenInitials = new Set<string>();

console.log('Generating 500 valid puzzles with exactly 40 clues each...\n');

let attempts = 0;
const maxAttempts = 100000;

while (puzzles.length < 500 && attempts < maxAttempts) {
  attempts++;
  
  // Generate fresh solved grid
  const solution = generateSolvedGrid();
  
  // Validate solution
  if (!validateSolution(solution)) {
    if (attempts % 1000 === 0) {
      console.log(`Attempt ${attempts}: Generated invalid solution, retrying...`);
    }
    continue;
  }
  
  // Create initial with exactly 40 clues
  const initial = createInitialGrid(solution, 40);
  
  // Validate clue count
  const clues = countClues(initial);
  if (clues !== 40) {
    if (attempts % 1000 === 0) {
      console.log(`Attempt ${attempts}: Wrong clue count: ${clues}, retrying...`);
    }
    continue;
  }
  
  // Validate initial matches solution
  if (!validateInitialMatchesSolution(initial, solution)) {
    if (attempts % 1000 === 0) {
      console.log(`Attempt ${attempts}: Initial does not match solution, retrying...`);
    }
    continue;
  }
  
  const initialStr = gridToString(initial);
  const solutionStr = gridToString(solution);
  
  // Ensure uniqueness
  if (seenInitials.has(initialStr)) {
    continue;
  }
  
  seenInitials.add(initialStr);
  puzzles.push({ initial: initialStr, solution: solutionStr });
  
  if (puzzles.length % 50 === 0) {
    console.log(`Generated ${puzzles.length}/500 puzzles...`);
  }
}

if (puzzles.length < 500) {
  console.error(`\n❌ Only generated ${puzzles.length} unique puzzles after ${attempts} attempts. Need 500.`);
  process.exit(1);
}

console.log(`\n✅ Generated ${puzzles.length} valid puzzles!\n`);

// Final validation pass
console.log('🔍 Running final validation pass...\n');

let allValid = true;
puzzles.forEach((puzzle, idx) => {
  const initial = stringToGrid(puzzle.initial);
  const solution = stringToGrid(puzzle.solution);
  
  const solutionValid = validateSolution(solution);
  const initialMatches = validateInitialMatchesSolution(initial, solution);
  const clueCount = countClues(initial);
  
  if (!solutionValid || !initialMatches || clueCount !== 40) {
    console.log(`❌ Puzzle ${idx + 1} failed validation:`);
    console.log(`   Solution valid: ${solutionValid}`);
    console.log(`   Initial matches: ${initialMatches}`);
    console.log(`   Clue count: ${clueCount}`);
    allValid = false;
  }
});

if (allValid) {
  console.log('✅ All 500 puzzles passed final validation!\n');
} else {
  console.log('❌ Some puzzles failed validation!');
  process.exit(1);
}

// Write SQL output file
import * as fs from 'fs';
import * as path from 'path';

const sqlLines: string[] = [];
sqlLines.push('-- 500 Valid Sudoku Puzzles (exactly 40 clues each)');
sqlLines.push('-- Generated with full validation');
sqlLines.push('');
sqlLines.push('DELETE FROM puzzles WHERE ladder_id = 1;');
sqlLines.push('');
sqlLines.push('INSERT INTO puzzles (ladder_id, initial_grid, solution_grid, difficulty) VALUES');

puzzles.forEach((puzzle, idx) => {
  const comma = idx < puzzles.length - 1 ? ',' : ';';
  sqlLines.push(`(1, '${puzzle.initial}', '${puzzle.solution}', 'EASY')${comma}`);
});

const outputPath = path.join(__dirname, '../../database/seeds/puzzles-500-easy.sql');
fs.writeFileSync(outputPath, sqlLines.join('\n'), 'utf-8');

console.log(`✅ SQL file written to: ${outputPath}`);
console.log(`\nPuzzle statistics:`);
console.log(`  Total puzzles: ${puzzles.length}`);
console.log(`  All have exactly 40 clues: ✅`);
console.log(`  All solutions valid: ✅`);
console.log(`  All initials match solutions: ✅`);

