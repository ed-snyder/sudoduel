// Script to validate Sudoku puzzle solutions from the database seeds
/// <reference types="node" />

import * as fs from 'fs';
import * as path from 'path';

export {}; // Make this a module to avoid global scope conflicts

interface Puzzle {
  initial: string;
  solution: string;
  difficulty: string;
}

// Parse puzzles from SQL file
function parsePuzzlesFromSQL(sqlFilePath: string): Puzzle[] {
  const content = fs.readFileSync(sqlFilePath, 'utf-8');
  const puzzles: Puzzle[] = [];
  
  // Match INSERT VALUES pattern: (1, 'initial', 'solution', 'DIFFICULTY')
  const regex = /\(1,\s*'([^']+)',\s*'([^']+)',\s*'([^']+)'\)/g;
  let match;
  
  while ((match = regex.exec(content)) !== null) {
    puzzles.push({
      initial: match[1],
      solution: match[2],
      difficulty: match[3]
    });
  }
  
  return puzzles;
}

// Convert string to 9x9 grid
function stringToGrid(s: string): number[][] {
  if (s.length !== 81) {
    throw new Error(`Invalid length: ${s.length}, expected 81`);
  }
  const grid: number[][] = [];
  for (let i = 0; i < 9; i++) {
    grid[i] = [];
    for (let j = 0; j < 9; j++) {
      const char = s[i * 9 + j];
      const num = parseInt(char, 10);
      if (isNaN(num) || num < 0 || num > 9) {
        throw new Error(`Invalid character at position ${i * 9 + j}: ${char}`);
      }
      grid[i][j] = num;
    }
  }
  return grid;
}

// Validate a Sudoku solution
function validateSolution(grid: number[][]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check all cells are filled (1-9)
  for (let i = 0; i < 9; i++) {
    for (let j = 0; j < 9; j++) {
      if (grid[i][j] < 1 || grid[i][j] > 9) {
        errors.push(`Cell [${i},${j}] has invalid value: ${grid[i][j]}`);
      }
    }
  }

  // Check rows
  for (let i = 0; i < 9; i++) {
    const seen = new Set<number>();
    for (let j = 0; j < 9; j++) {
      const val = grid[i][j];
      if (seen.has(val)) {
        errors.push(`Row ${i} has duplicate value ${val}`);
      }
      seen.add(val);
    }
    if (seen.size !== 9) {
      errors.push(`Row ${i} doesn't contain all digits 1-9`);
    }
  }

  // Check columns
  for (let j = 0; j < 9; j++) {
    const seen = new Set<number>();
    for (let i = 0; i < 9; i++) {
      const val = grid[i][j];
      if (seen.has(val)) {
        errors.push(`Column ${j} has duplicate value ${val}`);
      }
      seen.add(val);
    }
    if (seen.size !== 9) {
      errors.push(`Column ${j} doesn't contain all digits 1-9`);
    }
  }

  // Check 3x3 boxes
  for (let boxRow = 0; boxRow < 3; boxRow++) {
    for (let boxCol = 0; boxCol < 3; boxCol++) {
      const seen = new Set<number>();
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          const row = boxRow * 3 + i;
          const col = boxCol * 3 + j;
          const val = grid[row][col];
          if (seen.has(val)) {
            errors.push(`Box [${boxRow},${boxCol}] has duplicate value ${val} at [${row},${col}]`);
          }
          seen.add(val);
        }
      }
      if (seen.size !== 9) {
        errors.push(`Box [${boxRow},${boxCol}] doesn't contain all digits 1-9`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

// Check if initial grid matches solution
function validateInitialMatchesSolution(initial: string, solution: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const initialGrid = stringToGrid(initial);
  const solutionGrid = stringToGrid(solution);

  for (let i = 0; i < 9; i++) {
    for (let j = 0; j < 9; j++) {
      const initialVal = initialGrid[i][j];
      const solutionVal = solutionGrid[i][j];
      if (initialVal !== 0 && initialVal !== solutionVal) {
        errors.push(`Initial clue at [${i},${j}] is ${initialVal} but solution has ${solutionVal}`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

// Main validation
const sqlFilePath = path.join(__dirname, '../../database/seeds/puzzles-500-easy.sql');

console.log(`🔍 Reading puzzles from: ${sqlFilePath}\n`);

const puzzles = parsePuzzlesFromSQL(sqlFilePath);
console.log(`📊 Found ${puzzles.length} puzzles to validate\n`);

let allValid = true;
let validCount = 0;
let invalidCount = 0;

puzzles.forEach((puzzle, index) => {
  try {
    const solutionGrid = stringToGrid(puzzle.solution);
    const solutionCheck = validateSolution(solutionGrid);
    const initialCheck = validateInitialMatchesSolution(puzzle.initial, puzzle.solution);
    
    if (!solutionCheck.valid || !initialCheck.valid) {
      console.log(`\n❌ Puzzle ${index + 1} (${puzzle.difficulty}):`);
      if (!solutionCheck.valid) {
        console.log('  Solution errors:');
        solutionCheck.errors.forEach(err => console.log(`     - ${err}`));
      }
      if (!initialCheck.valid) {
        console.log('  Initial/Solution mismatch:');
        initialCheck.errors.forEach(err => console.log(`     - ${err}`));
      }
      allValid = false;
      invalidCount++;
    } else {
      validCount++;
    }
  } catch (error: any) {
    console.log(`\n❌ Puzzle ${index + 1}: Error - ${error.message}`);
    allValid = false;
    invalidCount++;
  }
});

console.log('\n' + '='.repeat(50));
console.log(`📊 Results: ${validCount} valid, ${invalidCount} invalid out of ${puzzles.length} puzzles`);

if (allValid) {
  console.log('✨ All puzzles are valid!');
  process.exit(0);
} else {
  console.log('❌ Some puzzles have errors. Please fix them.');
  process.exit(1);
}
