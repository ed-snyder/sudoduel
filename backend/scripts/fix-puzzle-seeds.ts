// Script to validate and fix Sudoku puzzle seeds in database/seeds/puzzles.sql
// Run with: npx tsx backend/scripts/fix-puzzle-seeds.ts
// (or npx ts-node if you have ts-node installed)

import fs from 'fs';
import path from 'path';

interface PuzzleSeed {
  initial: string;
  solution: string;
  difficulty: string;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

const SEEDS_RELATIVE_PATH = '../../database/seeds/puzzles.sql';

function getSeedsPath() {
  // When executed from backend/, __dirname will be backend/scripts
  return path.resolve(__dirname, SEEDS_RELATIVE_PATH);
}

function stringToGrid(s: string): number[][] {
  if (s.length !== 81) {
    throw new Error(`Invalid grid length: ${s.length}, expected 81`);
  }
  const grid: number[][] = [];
  for (let i = 0; i < 9; i++) {
    const row: number[] = [];
    for (let j = 0; j < 9; j++) {
      const char = s[i * 9 + j];
      const num = parseInt(char, 10);
      if (Number.isNaN(num) || num < 0 || num > 9) {
        throw new Error(`Invalid character '${char}' at index ${i * 9 + j}`);
      }
      row.push(num);
    }
    grid.push(row);
  }
  return grid;
}

function gridToString(grid: number[][]): string {
  return grid.flat().join('');
}

function validatePuzzle(initial: string, solution: string): ValidationResult {
  const errors: string[] = [];
  for (let i = 0; i < 81; i++) {
    const row = Math.floor(i / 9);
    const col = i % 9;
    const initialVal = parseInt(initial[i], 10);
    const solutionVal = parseInt(solution[i], 10);

    if (initialVal !== 0 && initialVal !== solutionVal) {
      errors.push(`[${row},${col}]: initial=${initialVal}, solution=${solutionVal}`);
    }
  }
  return { valid: errors.length === 0, errors };
}

function isValidPlacement(grid: number[][], row: number, col: number, num: number): boolean {
  // Row
  for (let j = 0; j < 9; j++) {
    if (grid[row][j] === num) return false;
  }
  // Column
  for (let i = 0; i < 9; i++) {
    if (grid[i][col] === num) return false;
  }
  // 3x3 box
  const boxRow = Math.floor(row / 3) * 3;
  const boxCol = Math.floor(col / 3) * 3;
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      if (grid[boxRow + i][boxCol + j] === num) return false;
    }
  }
  return true;
}

function solveSudoku(grid: number[][]): boolean {
  for (let i = 0; i < 9; i++) {
    for (let j = 0; j < 9; j++) {
      if (grid[i][j] === 0) {
        for (let num = 1; num <= 9; num++) {
          if (isValidPlacement(grid, i, j, num)) {
            grid[i][j] = num;
            if (solveSudoku(grid)) return true;
            grid[i][j] = 0;
          }
        }
        return false;
      }
    }
  }
  return true;
}

function validateSolutionGrid(grid: number[][]): ValidationResult {
  const errors: string[] = [];

  // Rows
  for (let i = 0; i < 9; i++) {
    const seen = new Set<number>();
    for (let j = 0; j < 9; j++) {
      const val = grid[i][j];
      if (val < 1 || val > 9) {
        errors.push(`Row ${i} col ${j} has invalid value ${val}`);
      }
      if (seen.has(val)) {
        errors.push(`Row ${i} has duplicate value ${val}`);
      }
      seen.add(val);
    }
    if (seen.size !== 9) {
      errors.push(`Row ${i} does not contain all digits 1-9`);
    }
  }

  // Columns
  for (let j = 0; j < 9; j++) {
    const seen = new Set<number>();
    for (let i = 0; i < 9; i++) {
      const val = grid[i][j];
      if (val < 1 || val > 9) {
        errors.push(`Column ${j} row ${i} has invalid value ${val}`);
      }
      if (seen.has(val)) {
        errors.push(`Column ${j} has duplicate value ${val}`);
      }
      seen.add(val);
    }
    if (seen.size !== 9) {
      errors.push(`Column ${j} does not contain all digits 1-9`);
    }
  }

  // Boxes
  for (let boxRow = 0; boxRow < 3; boxRow++) {
    for (let boxCol = 0; boxCol < 3; boxCol++) {
      const seen = new Set<number>();
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          const row = boxRow * 3 + i;
          const col = boxCol * 3 + j;
          const val = grid[row][col];
          if (val < 1 || val > 9) {
            errors.push(`Box [${boxRow},${boxCol}] cell [${row},${col}] has invalid value ${val}`);
          }
          if (seen.has(val)) {
            errors.push(`Box [${boxRow},${boxCol}] has duplicate value ${val}`);
          }
          seen.add(val);
        }
      }
      if (seen.size !== 9) {
        errors.push(`Box [${boxRow},${boxCol}] does not contain all digits 1-9`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
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

function rebuildSql(originalSql: string, puzzles: PuzzleSeed[]): string {
  const insertHeaderIndex = originalSql.indexOf('INSERT INTO puzzles');
  if (insertHeaderIndex === -1) {
    throw new Error('Could not find INSERT INTO puzzles statement in seeds file');
  }

  // Keep everything before the INSERT statement
  const header = originalSql.slice(0, insertHeaderIndex);

  const insertHeaderLine =
    'INSERT INTO puzzles (ladder_id, initial_grid, solution_grid, difficulty) VALUES\n';

  const bodyLines = puzzles.map((p, idx) => {
    const comma = idx < puzzles.length - 1 ? ',' : ';';
    return `(1, \n '${p.initial}',\n '${p.solution}',\n '${p.difficulty}')${comma}`;
  });

  return header + insertHeaderLine + bodyLines.join('\n\n') + '\n';
}

async function main() {
  const seedsPath = getSeedsPath();
  console.log(`🔍 Reading seeds from: ${seedsPath}`);

  const sql = fs.readFileSync(seedsPath, 'utf8');
  const puzzles = parsePuzzlesFromSql(sql);

  if (puzzles.length === 0) {
    console.error('❌ No puzzles found in seeds file.');
    process.exit(1);
  }

  console.log(`Found ${puzzles.length} puzzles in seeds file.\n`);

  let anyFixed = false;

  puzzles.forEach((puzzle, index) => {
    console.log(`📋 Puzzle ${index + 1} (${puzzle.difficulty}):`);

    const validation = validatePuzzle(puzzle.initial, puzzle.solution);
    if (validation.valid) {
      console.log('  ✅ Initial clues match solution.');
    } else {
      console.log('  ❌ Initial clues do NOT match solution. Mismatches:');
      validation.errors.forEach((e) => console.log(`     - ${e}`));
    }

    // Validate solution grid structure
    const solutionGrid = stringToGrid(puzzle.solution);
    const solutionValidation = validateSolutionGrid(solutionGrid);
    if (solutionValidation.valid) {
      console.log('  ✅ Solution grid is structurally valid.');
    } else {
      console.log('  ❌ Solution grid is NOT structurally valid:');
      solutionValidation.errors.slice(0, 10).forEach((e) => console.log(`     - ${e}`));
      if (solutionValidation.errors.length > 10) {
        console.log(`     - ...and ${solutionValidation.errors.length - 10} more errors.`);
      }
    }

    const isBroken = !validation.valid || !solutionValidation.valid;

    if (isBroken) {
      console.log('  🛠 Fixing puzzle by solving from initial_grid...');
      const initialGrid = stringToGrid(puzzle.initial);
      const gridCopy = initialGrid.map((row) => [...row]);

      const solved = solveSudoku(gridCopy);
      if (!solved) {
        console.log('  ❌ Could not solve puzzle from initial_grid. Leaving as-is.');
      } else {
        const solvedValidation = validateSolutionGrid(gridCopy);
        if (!solvedValidation.valid) {
          console.log('  ❌ Solver produced an invalid solution. Leaving as-is.');
          solvedValidation.errors.slice(0, 10).forEach((e) => console.log(`     - ${e}`));
        } else {
          const newSolution = gridToString(gridCopy);
          console.log('  ✅ Replaced solution_grid with solved grid based on initial_grid.');
          puzzle.solution = newSolution;
          anyFixed = true;
        }
      }
    }

    console.log('');
  });

  if (anyFixed) {
    console.log('💾 Writing corrected seeds back to puzzles.sql ...');
    const newSql = rebuildSql(sql, puzzles);
    fs.writeFileSync(seedsPath, newSql, 'utf8');
    console.log('✅ puzzles.sql updated.');
  } else {
    console.log('✅ No changes needed. All puzzles are consistent and valid.');
  }

  // Final validation pass on (possibly) updated puzzles
  const finalSql = anyFixed ? fs.readFileSync(seedsPath, 'utf8') : sql;
  const finalPuzzles = parsePuzzlesFromSql(finalSql);

  console.log('\n🔁 Final validation of all puzzles:');
  let allValid = true;

  finalPuzzles.forEach((puzzle, idx) => {
    const v = validatePuzzle(puzzle.initial, puzzle.solution);
    const sg = stringToGrid(puzzle.solution);
    const sv = validateSolutionGrid(sg);

    if (v.valid && sv.valid) {
      console.log(`  ✅ Puzzle ${idx + 1} OK.`);
    } else {
      allValid = false;
      console.log(`  ❌ Puzzle ${idx + 1} has issues:`);
      if (!v.valid) {
        console.log('     - Initial vs solution mismatches:');
        v.errors.slice(0, 5).forEach((e) => console.log(`       * ${e}`));
        if (v.errors.length > 5) {
          console.log(`       * ...and ${v.errors.length - 5} more.`);
        }
      }
      if (!sv.valid) {
        console.log('     - Solution grid structural issues:');
        sv.errors.slice(0, 5).forEach((e) => console.log(`       * ${e}`));
        if (sv.errors.length > 5) {
          console.log(`       * ...and ${sv.errors.length - 5} more.`);
        }
      }
    }
  });

  if (!allValid) {
    console.log('\n❌ Some puzzles are still invalid. Please review the report above.');
    process.exit(1);
  } else {
    console.log('\n✨ All puzzles validate correctly:');
    console.log('   - Every initial clue matches its solution position');
    console.log('   - Every solution is a valid completed Sudoku (rows/cols/boxes have 1-9).');
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Unexpected error in fix-puzzle-seeds:', err);
  process.exit(1);
});


