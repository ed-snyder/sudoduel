// Solve easy puzzle initial grids to get correct solutions

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

function isValid(grid: number[][], row: number, col: number, num: number): boolean {
  // Check row
  for (let j = 0; j < 9; j++) {
    if (grid[row][j] === num) return false;
  }
  
  // Check column
  for (let i = 0; i < 9; i++) {
    if (grid[i][col] === num) return false;
  }
  
  // Check box
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
  for (let i = 0; i < 9; i++) {
    for (let j = 0; j < 9; j++) {
      if (grid[i][j] === 0) {
        for (let num = 1; num <= 9; num++) {
          if (isValid(grid, i, j, num)) {
            grid[i][j] = num;
            if (solve(grid)) {
              return true;
            }
            grid[i][j] = 0;
          }
        }
        return false;
      }
    }
  }
  return true;
}

// Easy puzzle initial grids (lots of clues)
const easyInitials = [
  '800000070006010053040603000010000026080000040350000010000506090160020400020000007',
  '600120384008459072000000005000006030000080040070000000005000000810607020023804600',
  '090300001000080046000000800405060000003000100000020508008000000640050000200007090',
];

easyInitials.forEach((initial, idx) => {
  console.log(`\nSolving Puzzle ${idx + 1}:`);
  const grid = stringToGrid(initial);
  const clues = initial.split('').filter(c => c !== '0').length;
  console.log(`  Clues: ${clues} (${Math.round(clues/81*100)}%)`);
  
  if (solve(grid)) {
    console.log(`  Solution: ${gridToString(grid)}`);
  } else {
    console.log('  ❌ No solution found');
  }
});

