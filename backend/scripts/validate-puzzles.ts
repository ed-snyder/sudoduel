// Script to validate Sudoku puzzle solutions

interface Puzzle {
  initial: string;
  solution: string;
  difficulty: string;
}

const puzzles: Puzzle[] = [
  {
    initial: '530070000600195000098000060800060003400803001700020006060000280000419005000080079',
    solution: '534678912672195348198342567859761423426853791713924856961537284287419635345286179',
    difficulty: 'EASY'
  },
  {
    initial: '000260701680070090190004500820100040004602900050003028009300074040050036703018000',
    solution: '435269781682571493197834562826195347374682915951743628519326874248957136763418259',
    difficulty: 'EASY'
  },
  {
    initial: '800000070006010053040603000010000026080000040350000010000506090160020400020000007',
    solution: '831295674796418253245673981914837526687152349352964718473586192168729435529341867',
    difficulty: 'EASY'
  },
  {
    initial: '090300001000080046000000800405060000003000100000020508008000000640050000200007090',
    solution: '894376251157982346362415879485163927723598164916724538578639412649251783231847695',
    difficulty: 'EASY'
  },
  {
    initial: '003020600900305001001806400008102900700000008006708200002609500800203009005010300',
    solution: '483921657967345821251876493548132976729564138136798245372689514814253769695417382',
    difficulty: 'EASY'
  }
];

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
console.log('🔍 Validating Sudoku puzzle solutions...\n');

let allValid = true;

puzzles.forEach((puzzle, index) => {
  console.log(`\n📋 Puzzle ${index + 1} (${puzzle.difficulty}):`);
  
  try {
    const solutionGrid = stringToGrid(puzzle.solution);
    const solutionCheck = validateSolution(solutionGrid);
    
    if (!solutionCheck.valid) {
      console.log('  ❌ Solution is INVALID:');
      solutionCheck.errors.forEach(err => console.log(`     - ${err}`));
      allValid = false;
    } else {
      console.log('  ✅ Solution is valid');
    }

    const initialCheck = validateInitialMatchesSolution(puzzle.initial, puzzle.solution);
    if (!initialCheck.valid) {
      console.log('  ❌ Initial grid does not match solution:');
      initialCheck.errors.forEach(err => console.log(`     - ${err}`));
      allValid = false;
    } else {
      console.log('  ✅ Initial grid matches solution');
    }

  } catch (error: any) {
    console.log(`  ❌ Error: ${error.message}`);
    allValid = false;
  }
});

console.log('\n' + '='.repeat(50));
if (allValid) {
  console.log('✨ All puzzles are valid!');
  process.exit(0);
} else {
  console.log('❌ Some puzzles have errors. Please fix them.');
  process.exit(1);
}

