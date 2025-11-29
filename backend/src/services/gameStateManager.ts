interface PlayerGameState {
  playerId: number;
  slot: 1 | 2;
  grid: number[][]; // Current state of their grid
  livesRemaining: number;
  cellsCompleted: number;
  mistakes: number;
  timeSpentSeconds: number;
  isLockedOut: boolean;
  isSolved: boolean;
}

interface GameState {
  matchId: number;
  puzzleId: number;
  solutionGrid: number[][];
  player1: PlayerGameState;
  player2: PlayerGameState;
  status: 'WAITING' | 'IN_PROGRESS' | 'COMPLETED';
  startedAt: number | null;
  timeLimit: number; // seconds
}

// In-memory game state storage
const gameStates = new Map<number, GameState>();

export const GameStateManager = {
  // Initialize a new game
  createGame(
    matchId: number,
    puzzleId: number,
    initialGrid: string,
    solutionGrid: string,
    player1Id: number,
    player2Id: number,
    timeLimit: number
  ): GameState {
    const initialGridArray = this.stringToGrid(initialGrid);
    const solutionGridArray = this.stringToGrid(solutionGrid);

    const gameState: GameState = {
      matchId,
      puzzleId,
      solutionGrid: solutionGridArray,
      player1: {
        playerId: player1Id,
        slot: 1,
        grid: JSON.parse(JSON.stringify(initialGridArray)), // Deep copy
        livesRemaining: 3,
        cellsCompleted: this.countInitialCells(initialGridArray),
        mistakes: 0,
        timeSpentSeconds: 0,
        isLockedOut: false,
        isSolved: false,
      },
      player2: {
        playerId: player2Id,
        slot: 2,
        grid: JSON.parse(JSON.stringify(initialGridArray)), // Deep copy
        livesRemaining: 3,
        cellsCompleted: this.countInitialCells(initialGridArray),
        mistakes: 0,
        timeSpentSeconds: 0,
        isLockedOut: false,
        isSolved: false,
      },
      status: 'WAITING',
      startedAt: null,
      timeLimit,
    };

    gameStates.set(matchId, gameState);
    return gameState;
  },

  // Get game state
  getGame(matchId: number): GameState | undefined {
    return gameStates.get(matchId);
  },

  // Start the game
  startGame(matchId: number): void {
    const game = gameStates.get(matchId);
    if (game) {
      game.status = 'IN_PROGRESS';
      game.startedAt = Date.now();
    }
  },

  // Validate and apply a move
  applyMove(
    matchId: number,
    playerId: number,
    row: number,
    col: number,
    value: number
  ): { success: boolean; correct?: boolean; player: PlayerGameState } {
    const game = gameStates.get(matchId);
    if (!game) {
      throw new Error('Game not found');
    }

    const player = game.player1.playerId === playerId ? game.player1 : game.player2;

    // Check if player is locked out
    if (player.isLockedOut) {
      return { success: false, player };
    }

    // Check if cell is editable (wasn't a given clue)
    const initialCells = this.countInitialCells(player.grid);
    if (player.grid[row][col] !== 0 && initialCells > 0) {
      // This was a given clue, can't change it
      return { success: false, player };
    }

    // Check if move is correct
    const correct = game.solutionGrid[row][col] === value;

    if (correct) {
      // Correct move
      const wasEmpty = player.grid[row][col] === 0;
      player.grid[row][col] = value;
      
      if (wasEmpty) {
        player.cellsCompleted++;
      }

      // Check if puzzle is solved
      if (player.cellsCompleted === 81) {
        player.isSolved = true;
        game.status = 'COMPLETED';
      }
    } else {
      // Incorrect move
      player.mistakes++;
      player.livesRemaining--;
      player.timeSpentSeconds += 10; // 10 second penalty

      // Check if locked out
      if (player.livesRemaining <= 0) {
        player.isLockedOut = true;
      }
    }

    return { success: true, correct, player };
  },

  // Convert grid string to 9x9 array
  stringToGrid(gridString: string): number[][] {
    const grid: number[][] = [];
    for (let i = 0; i < 9; i++) {
      grid[i] = [];
      for (let j = 0; j < 9; j++) {
        grid[i][j] = parseInt(gridString[i * 9 + j]);
      }
    }
    return grid;
  },

  // Count initial filled cells
  countInitialCells(grid: number[][]): number {
    let count = 0;
    for (let i = 0; i < 9; i++) {
      for (let j = 0; j < 9; j++) {
        if (grid[i][j] !== 0) count++;
      }
    }
    return count;
  },

  // Remove game from memory
  removeGame(matchId: number): void {
    gameStates.delete(matchId);
  },
};
