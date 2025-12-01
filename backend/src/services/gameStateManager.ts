interface PlayerGameState {
  playerId: number;
  slot: 1 | 2;
  grid: number[][];
  livesRemaining: number;
  cellsCompleted: number;
  mistakes: number;
  timeSpentSeconds: number;
  timeRemainingSeconds: number; // Per-player timer (starts at 300)
  isLockedOut: boolean;
  isSolved: boolean;
  lastMoveTime: number;
}

interface GameState {
  matchId: number;
  puzzleId: number;
  initialGrid: number[][]; // Store initial grid to check for initial clues
  solutionGrid: number[][];
  player1: PlayerGameState;
  player2: PlayerGameState;
  status: 'WAITING' | 'IN_PROGRESS' | 'COMPLETED';
  startedAt: number | null;
  timeLimit: number;
  timeoutTimer: NodeJS.Timeout | null;
  timerInterval: NodeJS.Timeout | null; // Interval for per-player timer countdown
}

const gameStates = new Map<number, GameState>();

export const GameStateManager = {
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
      initialGrid: initialGridArray, // Store initial grid
      solutionGrid: solutionGridArray,
      player1: {
        playerId: player1Id,
        slot: 1,
        grid: JSON.parse(JSON.stringify(initialGridArray)),
        livesRemaining: 3,
        cellsCompleted: this.countInitialCells(initialGridArray),
        mistakes: 0,
        timeSpentSeconds: 0,
        timeRemainingSeconds: timeLimit, // Initialize to time limit (300 seconds)
        isLockedOut: false,
        isSolved: false,
        lastMoveTime: Date.now(),
      },
      player2: {
        playerId: player2Id,
        slot: 2,
        grid: JSON.parse(JSON.stringify(initialGridArray)),
        livesRemaining: 3,
        cellsCompleted: this.countInitialCells(initialGridArray),
        mistakes: 0,
        timeSpentSeconds: 0,
        timeRemainingSeconds: timeLimit, // Initialize to time limit (300 seconds)
        isLockedOut: false,
        isSolved: false,
        lastMoveTime: Date.now(),
      },
      status: 'WAITING',
      startedAt: null,
      timeLimit,
      timeoutTimer: null,
      timerInterval: null,
    };

    gameStates.set(matchId, gameState);
    return gameState;
  },

  getGame(matchId: number): GameState | undefined {
    return gameStates.get(matchId);
  },

  startGame(matchId: number, onTimeout: (matchId: number) => void, onTimerUpdate?: (matchId: number) => void): void {
    const game = gameStates.get(matchId);
    if (!game) return;

    game.status = 'IN_PROGRESS';
    game.startedAt = Date.now();
    game.player1.lastMoveTime = Date.now();
    game.player2.lastMoveTime = Date.now();

    // Start per-player timer countdown (every 1 second)
    game.timerInterval = setInterval(() => {
      if (game.status !== 'IN_PROGRESS') {
        if (game.timerInterval) {
          clearInterval(game.timerInterval);
          game.timerInterval = null;
        }
        return;
      }

      // Decrement each non-locked, non-solved player's timer
      if (!game.player1.isLockedOut && !game.player1.isSolved && game.player1.timeRemainingSeconds > 0) {
        game.player1.timeRemainingSeconds--;
        if (game.player1.timeRemainingSeconds <= 0) {
          // Player 1 timed out – treat as lockout for gameplay purposes
          game.player1.isLockedOut = true;
        }
      }
      if (!game.player2.isLockedOut && !game.player2.isSolved && game.player2.timeRemainingSeconds > 0) {
        game.player2.timeRemainingSeconds--;
        if (game.player2.timeRemainingSeconds <= 0) {
          // Player 2 timed out – treat as lockout for gameplay purposes
          game.player2.isLockedOut = true;
        }
      }

      // If both players are now locked out (by lives or time), end by score
      if (game.player1.isLockedOut && game.player2.isLockedOut) {
        if (game.timerInterval) {
          clearInterval(game.timerInterval);
          game.timerInterval = null;
        }
        onTimeout(matchId);
        return;
      }

      // Call timer update callback if provided (for broadcasting)
      if (onTimerUpdate) {
        onTimerUpdate(matchId);
      }
    }, 1000);

    // We no longer use a single global timeout timer; per-player timers are authoritative
    game.timeoutTimer = null;
  },

  updatePlayerTime(matchId: number, playerId: number): void {
    const game = gameStates.get(matchId);
    if (!game || game.status !== 'IN_PROGRESS') return;

    const player = game.player1.playerId === playerId ? game.player1 : game.player2;
    const now = Date.now();
    const elapsedSeconds = Math.floor((now - player.lastMoveTime) / 1000);
    player.timeSpentSeconds += elapsedSeconds;
    player.lastMoveTime = now;
    // Note: timeRemainingSeconds is managed by the interval timer, not here
  },

  applyMove(
    matchId: number,
    playerId: number,
    row: number,
    col: number,
    value: number
  ): { success: boolean; correct?: boolean; player: PlayerGameState; gameEnded?: boolean } {
    const game = gameStates.get(matchId);
    
    if (!game || game.status !== 'IN_PROGRESS') {
      throw new Error('Game not in progress');
    }

    const player = game.player1.playerId === playerId ? game.player1 : game.player2;
    const opponent = game.player1.playerId === playerId ? game.player2 : game.player1;

    this.updatePlayerTime(matchId, playerId);

    // Check if player's time has run out
    if (player.timeRemainingSeconds <= 0) {
      // Time expired - game will end on next timer check
      return { success: false, player, gameEnded: false };
    }

    if (player.isLockedOut) {
      return { success: false, player, gameEnded: false };
    }

    if (row < 0 || row >= 9 || col < 0 || col >= 9) {
      return { success: false, player, gameEnded: false };
    }

    // Check if this cell is an initial clue (cannot be modified)
    const isInitialCell = game.initialGrid[row] && game.initialGrid[row][col] !== 0;
    if (isInitialCell) {
      console.log(`❌ Cannot modify initial clue at row=${row}, col=${col}`);
      return { success: false, player, gameEnded: false };
    }

    // Validate solution grid access and compare values
    const solutionValue = game.solutionGrid[row]?.[col];
    const correct = solutionValue !== undefined && Number(solutionValue) === Number(value);

    if (correct) {
      const wasEmpty = player.grid[row] && player.grid[row][col] === 0;
      if (player.grid[row]) {
        player.grid[row][col] = value;
      }
      
      if (wasEmpty) {
        player.cellsCompleted++;
      }

      if (player.cellsCompleted === 81) {
        // Puzzle solved by this player
        player.isSolved = true;
        return { success: true, correct, player, gameEnded: true };
      }

      // Check if this correct move satisfies any victory conditions (e.g., opponent locked and score surpassed)
      const ended = this.checkVictoryConditions(game);
      if (ended) {
        return { success: true, correct, player, gameEnded: true };
      }
    } else {
      // Incorrect move - update THIS player's stats
      player.mistakes++;
      player.livesRemaining--;
      player.timeSpentSeconds += 10;
      // Time penalty: reduce remaining time by 10 seconds
      player.timeRemainingSeconds = Math.max(0, player.timeRemainingSeconds - 10);

      if (player.livesRemaining <= 0) {
        // Life-based lockout – only this player is locked out
        player.isLockedOut = true;

        // After a lockout, re-check victory conditions
        const ended = this.checkVictoryConditions(game);
        if (ended) {
          return { success: true, correct: correct as boolean, player, gameEnded: true };
        }
        // Otherwise, opponent can continue playing
      }
    }

    // No terminal condition reached yet
    return { success: true, correct: correct as boolean, player, gameEnded: false };
  },

  getFinalResults(matchId: number): {
    player1: any;
    player2: any;
    winnerId: number | null;
    resultCode: number;
  } | null {
    const game = gameStates.get(matchId);
    if (!game) return null;

    const p1 = game.player1;
    const p2 = game.player2;

    let winnerId: number | null = null;
    let resultCode: number = 3;

    if (p1.isSolved && !p2.isSolved) {
      winnerId = p1.playerId;
      resultCode = 1;
    } else if (p2.isSolved && !p1.isSolved) {
      winnerId = p2.playerId;
      resultCode = 2;
    } else if (p1.cellsCompleted > p2.cellsCompleted) {
      winnerId = p1.playerId;
      resultCode = 1;
    } else if (p2.cellsCompleted > p1.cellsCompleted) {
      winnerId = p2.playerId;
      resultCode = 2;
    }

    return {
      player1: {
        playerId: p1.playerId,
        cellsCompleted: p1.cellsCompleted,
        livesRemaining: p1.livesRemaining,
        mistakes: p1.mistakes,
        timeSpentSeconds: p1.timeSpentSeconds,
        finalState: p1.isSolved ? 'SOLVED' : p1.isLockedOut ? 'LOCKED_OUT' : 'TIMEOUT',
        isWinner: winnerId === p1.playerId,
      },
      player2: {
        playerId: p2.playerId,
        cellsCompleted: p2.cellsCompleted,
        livesRemaining: p2.livesRemaining,
        mistakes: p2.mistakes,
        timeSpentSeconds: p2.timeSpentSeconds,
        finalState: p2.isSolved ? 'SOLVED' : p2.isLockedOut ? 'LOCKED_OUT' : 'TIMEOUT',
        isWinner: winnerId === p2.playerId,
      },
      winnerId,
      resultCode,
    };
  },

  /**
   * Check whether the current game state satisfies any terminal victory conditions.
   * This does NOT mutate match status or clear timers; it simply inspects state.
   *
   * Conditions:
   *  - Someone has solved the puzzle
   *  - One player is locked out and the other has strictly more completed cells
   *  - Both players are locked out (by lives or time) – winner by cells, or draw
   */
  checkVictoryConditions(game: GameState): boolean {
    const p1 = game.player1;
    const p2 = game.player2;

    // Condition A: one player has solved the puzzle
    if (p1.isSolved || p2.isSolved) {
      return true;
    }

    // Condition B: Opponent is locked out and active player has surpassed their score
    // (This is handled indirectly by callers: after a move or lockout, we check once)
    if (p1.isLockedOut && !p2.isLockedOut && p2.cellsCompleted > p1.cellsCompleted) {
      return true;
    }
    if (p2.isLockedOut && !p1.isLockedOut && p1.cellsCompleted > p2.cellsCompleted) {
      return true;
    }

    // Condition C/D: Both players are locked out (by lives or time)
    if (p1.isLockedOut && p2.isLockedOut) {
      return true;
    }

    // No terminal condition met yet
    return false;
  },

  stringToGrid(gridString: string): number[][] {
    const grid: number[][] = [];
    for (let i = 0; i < 9; i++) {
      grid[i] = [];
      for (let j = 0; j < 9; j++) {
        const char = gridString[i * 9 + j];
        grid[i][j] = char !== undefined ? parseInt(char) : 0;
      }
    }
    return grid;
  },

  countInitialCells(grid: number[][]): number {
    let count = 0;
    for (let i = 0; i < 9; i++) {
      if (grid[i]) {
        for (let j = 0; j < 9; j++) {
          if (grid[i] && grid[i][j] !== 0) count++;
        }
      }
    }
    return count;
  },

  removeGame(matchId: number): void {
    const game = gameStates.get(matchId);
    if (game?.timeoutTimer) {
      clearTimeout(game.timeoutTimer);
    }
    if (game?.timerInterval) {
      clearInterval(game.timerInterval);
    }
    gameStates.delete(matchId);
  },

  // Get current timer values for both players
  getTimerValues(matchId: number): { player1: number; player2: number } | null {
    const game = gameStates.get(matchId);
    if (!game) return null;
    return {
      player1: game.player1.timeRemainingSeconds,
      player2: game.player2.timeRemainingSeconds,
    };
  },

  // Erase a cell (only user-placed numbers, not initial clues or correct placements)
  eraseCell(
    matchId: number,
    playerId: number,
    row: number,
    col: number
  ): { success: boolean; player: PlayerGameState } {
    const game = gameStates.get(matchId);
    
    if (!game || game.status !== 'IN_PROGRESS') {
      throw new Error('Game not in progress');
    }

    const player = game.player1.playerId === playerId ? game.player1 : game.player2;

    if (player.isLockedOut || player.timeRemainingSeconds <= 0) {
      return { success: false, player };
    }

    if (row < 0 || row >= 9 || col < 0 || col >= 9) {
      return { success: false, player };
    }

    const currentValue = player.grid[row]?.[col] || 0;
    const initialValue = game.initialGrid[row]?.[col] || 0;
    const solutionValue = game.solutionGrid[row]?.[col] || 0;
    
    // Can't erase if:
    // 1. Cell is empty
    // 2. Cell is an initial clue (from puzzle)
    // 3. Cell value matches solution (correctly placed number)
    if (currentValue === 0) {
      return { success: false, player };
    }

    if (initialValue !== 0) {
      // This is an initial clue - can't erase
      return { success: false, player };
    }

    if (currentValue === solutionValue) {
      // This is a correctly placed number - can't erase
      return { success: false, player };
    }

    // Erase the cell (it's an incorrect user-placed number)
    if (player.grid[row]) {
      const wasFilled = player.grid[row][col] !== 0;
      player.grid[row][col] = 0;
      
      // If this cell was previously counted as completed, decrement
      if (wasFilled) {
        // We need to check if it was actually correct before
        // Since we're only erasing incorrect values, we don't need to adjust cellsCompleted
        // (incorrect values don't count toward completion anyway)
      }
    }

    return { success: true, player };
  },
};
