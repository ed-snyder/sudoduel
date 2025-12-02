// Final list of validated easy puzzles

const easyPuzzles = [
  {
    initial: '530070000600195000098000060800060003400803001700020006060000280000419005000080079',
    solution: '534678912672195348198342567859761423426853791713924856961537284287419635345286179',
    clues: 30
  },
  {
    initial: '000260701680070090190004500820100040004602900050003028009300074040050036703018000',
    solution: '435269781682571493197834562826195347374682915951743628519326874248957136763418259',
    clues: 35
  },
  {
    initial: '800000070006010053040603000010000026080000040350000010000506090160020400020000007',
    solution: '831295674796418253245673981914837526687152349352964718473586192168729435529341867',
    clues: 26
  },
  {
    initial: '090300001000080046000000800405060000003000100000020508008000000640050000200007090',
    solution: '894376251157982346362415879485163927723598164916724538578639412649251783231847695',
    clues: 22
  },
  {
    initial: '003020600900305001001806400008102900700000008006708200002609500800203009005010300',
    solution: '483921657967345821251876493548132976729564138136798245372689514814253769695417382',
    clues: 29
  },
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

function validateSolution(grid: number[][]): boolean {
  // Check rows
  for (let i = 0; i < 9; i++) {
    const seen = new Set<number>();
    for (let j = 0; j < 9; j++) {
      if (seen.has(grid[i][j])) return false;
      seen.add(grid[i][j]);
    }
  }
  
  // Check columns
  for (let j = 0; j < 9; j++) {
    const seen = new Set<number>();
    for (let i = 0; i < 9; i++) {
      if (seen.has(grid[i][j])) return false;
      seen.add(grid[i][j]);
    }
  }
  
  // Check boxes
  for (let boxRow = 0; boxRow < 3; boxRow++) {
    for (let boxCol = 0; boxCol < 3; boxCol++) {
      const seen = new Set<number>();
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          const row = boxRow * 3 + i;
          const col = boxCol * 3 + j;
          if (seen.has(grid[row][col])) return false;
          seen.add(grid[row][col]);
        }
      }
    }
  }
  
  return true;
}

console.log('Validating Easy Puzzles:\n');
let allValid = true;

easyPuzzles.forEach((puzzle, idx) => {
  const solutionGrid = stringToGrid(puzzle.solution);
  const isValid = validateSolution(solutionGrid);
  const clues = puzzle.clues;
  const percent = Math.round(clues / 81 * 100);
  
  console.log(`Puzzle ${idx + 1}: ${clues} clues (${percent}% filled) - ${isValid ? '✅ Valid' : '❌ Invalid'}`);
  if (!isValid) allValid = false;
  
  // Check initial matches solution
  const initialGrid = stringToGrid(puzzle.initial);
  let matches = true;
  for (let i = 0; i < 9; i++) {
    for (let j = 0; j < 9; j++) {
      if (initialGrid[i][j] !== 0 && initialGrid[i][j] !== solutionGrid[i][j]) {
        matches = false;
        break;
      }
    }
    if (!matches) break;
  }
  console.log(`  Initial matches solution: ${matches ? '✅' : '❌'}\n`);
});

if (allValid) {
  console.log('✨ All puzzles are valid!\n');
  console.log('SQL INSERT statements:\n');
  console.log('INSERT INTO puzzles (ladder_id, initial_grid, solution_grid, difficulty) VALUES');
  easyPuzzles.forEach((puzzle, idx) => {
    const comma = idx < easyPuzzles.length - 1 ? ',' : ';';
    console.log(`(1, '${puzzle.initial}', '${puzzle.solution}', 'EASY')${comma}`);
  });
} else {
  console.log('❌ Some puzzles are invalid!');
  process.exit(1);
}

