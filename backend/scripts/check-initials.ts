// Check if initial grids match the new solutions

const puzzles = [
  {
    initial: '003020600900305001001806400008102900700000008006708200002609500800203009005010300',
    solution: '483921657967345821251876493548132976729564138136798245372689514814253769695417382',
  },
  {
    initial: '200080300060070084030500209000105408000000000402706000301007040720040060004010003',
    solution: '245981376169273584837564219976125438513498627482736951391657842728349165654812793',
  },
  {
    initial: '000000907000420180000705026100904000050000040000507009920108000034059000507000000',
    solution: '462831957795426183381795426173984265659312748248567319926178534834259671517643892',
  },
  {
    initial: '030050040008010500460000012070502080000603000040109030250000098001020600080060020',
    solution: '137256849928314567465897312673542981819673254542189736256731498391428675784965123',
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

puzzles.forEach((puzzle, idx) => {
  const initialGrid = stringToGrid(puzzle.initial);
  const solutionGrid = stringToGrid(puzzle.solution);
  const errors: string[] = [];
  
  for (let i = 0; i < 9; i++) {
    for (let j = 0; j < 9; j++) {
      if (initialGrid[i][j] !== 0 && initialGrid[i][j] !== solutionGrid[i][j]) {
        errors.push(`[${i},${j}]: initial=${initialGrid[i][j]}, solution=${solutionGrid[i][j]}`);
      }
    }
  }
  
  console.log(`Puzzle ${idx + 1}: ${errors.length === 0 ? '✅ Matches' : '❌ Mismatches'}`);
  if (errors.length > 0) {
    errors.forEach(e => console.log(`  - ${e}`));
  }
});

