// Verify the solved solutions

const solutions = [
  '483921657967345821251876493548132976729564138136798245372689514814253769695417382',
  '245981376169273584837564219976125438513498627482736951391657842728349165654812793',
  '462831957795426183381795426173984265659312748248567319926178534834259671517643892',
  '137256849928314567465897312673542981819673254542189736256731498391428675784965123',
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

function validateSolution(grid: number[][]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

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
            errors.push(`Box [${boxRow},${boxCol}] has duplicate value ${val}`);
          }
          seen.add(val);
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

solutions.forEach((sol, idx) => {
  const grid = stringToGrid(sol);
  const result = validateSolution(grid);
  console.log(`Solution ${idx + 1}: ${result.valid ? '✅ Valid' : '❌ Invalid'}`);
  if (!result.valid) {
    result.errors.forEach(e => console.log(`  - ${e}`));
  }
});

