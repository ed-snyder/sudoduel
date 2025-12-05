// Generate 500 easy Sudoku puzzles using transformations
// Easy puzzles have exactly 40 clues (out of 81)

// Multiple base easy puzzles with valid solutions
const BASE_PUZZLES = [
  { initial: '530070000600195000098000060800060003400803001700020006060000280000419005000080079', solution: '534678912672195348198342567859761423426853791713924856961537284287419635345286179' },
  { initial: '000260701680070090190004500820100040004602900050003028009300074040050036703018000', solution: '435269781682571493197834562826195347374682915951743628519326874248957136763418259' },
  { initial: '600120384008459072000000005000006030000080040070000000005000000810607020023804600', solution: '657123984138459672294768315482976531361582749579341268745239861816697423923814657' },
  { initial: '090300001000080046000000800405060000003000100000020508008000000640050000200007090', solution: '796342851352781946184596827425168379863974152971325468538219674647853291219467593' },
  { initial: '003020600900305001001806400008102900700000008006708200002609500800203009005010300', solution: '483921657967345821251876493548132976729564138136798245372689514814253769695417382' },
];

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
  return grid.flat().join('');
}

// Transformation: Swap two rows within the same band (rows 0-2, 3-5, or 6-8)
function swapRowsInBand(grid: number[][], band: number, row1: number, row2: number): number[][] {
  const newGrid = grid.map(row => [...row]);
  const baseRow = band * 3;
  [newGrid[baseRow + row1], newGrid[baseRow + row2]] = [newGrid[baseRow + row2], newGrid[baseRow + row1]];
  return newGrid;
}

// Transformation: Swap two columns within the same stack
function swapColumnsInStack(grid: number[][], stack: number, col1: number, col2: number): number[][] {
  const newGrid = grid.map(row => [...row]);
  const baseCol = stack * 3;
  for (let i = 0; i < 9; i++) {
    [newGrid[i][baseCol + col1], newGrid[i][baseCol + col2]] = [newGrid[i][baseCol + col2], newGrid[i][baseCol + col1]];
  }
  return newGrid;
}

// Transformation: Swap two bands (groups of 3 rows)
function swapBands(grid: number[][], band1: number, band2: number): number[][] {
  const newGrid = grid.map(row => [...row]);
  for (let i = 0; i < 3; i++) {
    [newGrid[band1 * 3 + i], newGrid[band2 * 3 + i]] = [newGrid[band2 * 3 + i], newGrid[band1 * 3 + i]];
  }
  return newGrid;
}

// Transformation: Swap two stacks (groups of 3 columns)
function swapStacks(grid: number[][], stack1: number, stack2: number): number[][] {
  const newGrid = grid.map(row => [...row]);
  for (let i = 0; i < 9; i++) {
    for (let j = 0; j < 3; j++) {
      [newGrid[i][stack1 * 3 + j], newGrid[i][stack2 * 3 + j]] = [newGrid[i][stack2 * 3 + j], newGrid[i][stack1 * 3 + j]];
    }
  }
  return newGrid;
}

// Transformation: Rotate 90 degrees clockwise
function rotate90(grid: number[][]): number[][] {
  const newGrid: number[][] = Array(9).fill(null).map(() => Array(9).fill(0));
  for (let i = 0; i < 9; i++) {
    for (let j = 0; j < 9; j++) {
      newGrid[j][8 - i] = grid[i][j];
    }
  }
  return newGrid;
}

// Transformation: Reflect horizontally
function reflectHorizontal(grid: number[][]): number[][] {
  return grid.map(row => [...row].reverse());
}

// Transformation: Relabel numbers (permutation)
function relabel(grid: number[][], mapping: number[]): number[][] {
  const newGrid = grid.map(row => row.map(val => val === 0 ? 0 : mapping[val - 1] + 1));
  return newGrid;
}

// Generate a random permutation of 1-9
function randomPermutation(): number[] {
  const arr = [0, 1, 2, 3, 4, 5, 6, 7, 8];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Apply random transformations to create unique puzzles
function transformPuzzle(initial: string, solution: string): { initial: string; solution: string } {
  let initialGrid = stringToGrid(initial);
  let solutionGrid = stringToGrid(solution);
  
  // Apply random transformations (same to both to keep them in sync)
  const transformations: Array<() => void> = [
    () => {
      const band = Math.floor(Math.random() * 3);
      const r1 = Math.floor(Math.random() * 3);
      const r2 = (r1 + 1 + Math.floor(Math.random() * 2)) % 3;
      initialGrid = swapRowsInBand(initialGrid, band, r1, r2);
      solutionGrid = swapRowsInBand(solutionGrid, band, r1, r2);
    },
    () => {
      const stack = Math.floor(Math.random() * 3);
      const c1 = Math.floor(Math.random() * 3);
      const c2 = (c1 + 1 + Math.floor(Math.random() * 2)) % 3;
      initialGrid = swapColumnsInStack(initialGrid, stack, c1, c2);
      solutionGrid = swapColumnsInStack(solutionGrid, stack, c1, c2);
    },
    () => {
      const b1 = Math.floor(Math.random() * 3);
      const b2 = (b1 + 1 + Math.floor(Math.random() * 2)) % 3;
      initialGrid = swapBands(initialGrid, b1, b2);
      solutionGrid = swapBands(solutionGrid, b1, b2);
    },
    () => {
      const s1 = Math.floor(Math.random() * 3);
      const s2 = (s1 + 1 + Math.floor(Math.random() * 2)) % 3;
      initialGrid = swapStacks(initialGrid, s1, s2);
      solutionGrid = swapStacks(solutionGrid, s1, s2);
    },
    () => {
      initialGrid = rotate90(initialGrid);
      solutionGrid = rotate90(solutionGrid);
    },
    () => {
      initialGrid = reflectHorizontal(initialGrid);
      solutionGrid = reflectHorizontal(solutionGrid);
    },
  ];
  
  // Apply 2-4 random transformations
  const numTransformations = 2 + Math.floor(Math.random() * 3);
  for (let i = 0; i < numTransformations; i++) {
    const transform = transformations[Math.floor(Math.random() * transformations.length)];
    transform();
  }
  
  // Apply relabeling (number permutation) - this creates truly unique puzzles
  const perm = randomPermutation();
  initialGrid = relabel(initialGrid, perm);
  solutionGrid = relabel(solutionGrid, perm);
  
  return {
    initial: gridToString(initialGrid),
    solution: gridToString(solutionGrid),
  };
}

// Count clues in initial grid
function countClues(initial: string): number {
  return initial.split('').filter(c => c !== '0').length;
}

// Adjust puzzle to have exactly 40 clues
function adjustToExactClues(initial: string, solution: string, targetClues: number = 40): string {
  let grid = initial.split('');
  const solutionArr = solution.split('');
  let currentClues = grid.filter(c => c !== '0').length;
  
  if (currentClues === targetClues) return initial;
  
  if (currentClues < targetClues) {
    // Need to ADD clues - fill in some empty cells from solution
    const emptyCells: number[] = [];
    for (let i = 0; i < 81; i++) {
      if (grid[i] === '0') emptyCells.push(i);
    }
    // Shuffle empty cells
    for (let i = emptyCells.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [emptyCells[i], emptyCells[j]] = [emptyCells[j], emptyCells[i]];
    }
    // Add clues until we reach target
    for (const idx of emptyCells) {
      if (currentClues >= targetClues) break;
      grid[idx] = solutionArr[idx];
      currentClues++;
    }
  } else {
    // Need to REMOVE clues - clear some filled cells
    const filledCells: number[] = [];
    for (let i = 0; i < 81; i++) {
      if (grid[i] !== '0') filledCells.push(i);
    }
    // Shuffle filled cells
    for (let i = filledCells.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [filledCells[i], filledCells[j]] = [filledCells[j], filledCells[i]];
    }
    // Remove clues until we reach target
    for (const idx of filledCells) {
      if (currentClues <= targetClues) break;
      grid[idx] = '0';
      currentClues--;
    }
  }
  
  return grid.join('');
}

// Generate 500 unique puzzles
const puzzles: Array<{ initial: string; solution: string; clues: number }> = [];
const seen = new Set<string>();

console.log('Generating 500 easy puzzles...\n');

let attempts = 0;
while (puzzles.length < 500 && attempts < 50000) {
  attempts++;
  const base = BASE_PUZZLES[Math.floor(Math.random() * BASE_PUZZLES.length)];
  const transformed = transformPuzzle(base.initial, base.solution);
  
  // Adjust to exactly 40 clues
  const adjustedInitial = adjustToExactClues(transformed.initial, transformed.solution, 40);
  const clues = countClues(adjustedInitial);
  
  if (clues === 40 && !seen.has(adjustedInitial)) {
    seen.add(adjustedInitial);
    puzzles.push({ initial: adjustedInitial, solution: transformed.solution, clues });
    
    if (puzzles.length % 50 === 0) {
      console.log(`Generated ${puzzles.length}/500 puzzles...`);
    }
  }
}

if (puzzles.length < 500) {
  console.error(`\n❌ Only generated ${puzzles.length} unique puzzles. Need 500.`);
  process.exit(1);
}

console.log(`\n✅ Generated ${puzzles.length} unique easy puzzles!\n`);

// Generate SQL file
const sqlLines: string[] = [];
sqlLines.push('-- 500 Easy Sudoku Puzzles (exactly 40 clues each)');
sqlLines.push('-- Generated using transformations on base valid sudoku');
sqlLines.push('');
sqlLines.push('DELETE FROM puzzles WHERE ladder_id = 1;');
sqlLines.push('');
sqlLines.push('INSERT INTO puzzles (ladder_id, initial_grid, solution_grid, difficulty) VALUES');

puzzles.forEach((puzzle, idx) => {
  const comma = idx < puzzles.length - 1 ? ',' : ';';
  sqlLines.push(`(1, '${puzzle.initial}', '${puzzle.solution}', 'EASY')${comma}`);
});

const sqlContent = sqlLines.join('\n');

// Write to file
import * as fs from 'fs';
import * as path from 'path';

const outputPath = path.join(__dirname, '../../database/seeds/puzzles-500-easy.sql');
fs.writeFileSync(outputPath, sqlContent, 'utf-8');

console.log(`✅ SQL file written to: ${outputPath}`);
console.log(`\nPuzzle statistics:`);
console.log(`  Min clues: ${Math.min(...puzzles.map(p => p.clues))}`);
console.log(`  Max clues: ${Math.max(...puzzles.map(p => p.clues))}`);
console.log(`  Avg clues: ${Math.round(puzzles.reduce((sum, p) => sum + p.clues, 0) / puzzles.length)}`);

