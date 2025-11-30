interface PlayerGameState {
  playerId: number;
  slot: 1 | 2;
  grid: number[][];
  livesRemaining: number;
  cellsCompleted: number;
  mistakes: number;
  timeSpentSeconds: number;
  isLockedOut: boolean;
  isSolved: boolean;
  lastMoveTime: number;
}

interface GameState {
  matchId: number;
  puzzleId: number;
  solutionGrid: number[][];
  player1: PlayerGameState;
  player2: PlayerGameState;
  status: 'WAITING' | 'IN_PROGRESS' | 'COMPLETED';
  startedAt: number | null;
  timeLimit: number;
  timeoutTimer: NodeJS.Timeout | null;
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
      solutionGrid: solutionGridArray,
      player1: {
        playerId: player1Id,
        slot: 1,
        grid: JSON.parse(JSON.stringify(initialGridArray)),
        livesRemaining: 3,
        cellsCompleted: this.countInitialCells(initialGridArray),
        mistakes: 0,
        timeSpentSeconds: 0,
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
        isLockedOut: false,
        isSolved: false,
        lastMoveTime: Date.now(),
      },
      status: 'WAITING',
      startedAt: null,
      timeLimit,
      timeoutTimer: null,
    };

    gameStates.set(matchId, gameState);
    return gameState;
  },

  getGame(matchId: number): GameState | undefined {
    return gameStates.get(matchId);
  },

  startGame(matchId: number, onTimeout: (matchId: number) => void): void {
    const game = gameStates.get(matchId);
    if (!game) return;

    game.status = 'IN_PROGRESS';
    game.startedAt = Date.now();
    game.player1.lastMoveTime = Date.now();
    game.player2.lastMoveTime = Date.now();

    game.timeoutTimer = setTimeout(() => {
      onTimeout(matchId);
    }, game.timeLimit * 1000);
  },

  updatePlayerTime(matchId: number, playerId: number): void {
    const game = gameStates.get(matchId);
    if (!game || game.status !== 'IN_PROGRESS') return;

    const player = game.player1.playerId === playerId ? game.player1 : game.player2;
    const now = Date.now();
    const elapsedSeconds = Math.floor((now - player.lastMoveTime) / 1000);
    player.timeSpentSeconds += elapsedSeconds;
    player.lastMoveTime = now;
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

    if (player.isLockedOut) {
      return { success: false, player, gameEnded: false };
    }

    if (row < 0 || row >= 9 || col < 0 || col >= 9) {
      return { success: false, player, gameEnded: false };
    }

    if (player.grid[row] && player.grid[row][col] !== 0) {
      const initialCells = this.countInitialCells(player.grid);
      if (initialCells > 0) {
        return { success: false, player, gameEnded: false };
      }
    }

    const correct = game.solutionGrid[row] && game.solutionGrid[row][col] === value;

    if (correct) {
      const wasEmpty = player.grid[row] && player.grid[row][col] === 0;
      if (player.grid[row]) {
        player.grid[row][col] = value;
      }
      
      if (wasEmpty) {
        player.cellsCompleted++;
      }

      console.log(`✅ Correct move! Player ${playerId} cells: ${player.cellsCompleted}`);

      if (player.cellsCompleted === 81) {
        player.isSolved = true;
        game.status = 'COMPLETED';
        
        if (game.timeoutTimer) {
          clearTimeout(game.timeoutTimer);
        }
        
        console.log(`🎯 PUZZLE SOLVED by player ${playerId}!`);
        return { success: true, correct, player, gameEnded: true };
      }

      console.log(`🔍 Checking opponent lockout. Opponent locked: ${opponent.isLockedOut}`);
      if (opponent.isLockedOut) {
        game.status = 'COMPLETED';
        if (game.timeoutTimer) {
          clearTimeout(game.timeoutTimer);
        }
        console.log(`🏆 GAME ENDS! Player ${playerId} wins, opponent is locked out`);
        return { success: true, correct, player, gameEnded: true };
      }
    } else {
      player.mistakes++;
      player.livesRemaining--;
      player.timeSpentSeconds += 10;

      if (player.livesRemaining <= 0) {
        player.isLockedOut = true;
        
        if (opponent.isLockedOut || opponent.cellsCompleted > player.cellsCompleted) {
          game.status = 'COMPLETED';
          if (game.timeoutTimer) {
            clearTimeout(game.timeoutTimer);
          }
          return { success: true, correct: correct as boolean, player, gameEnded: true };
        }
      }
    }

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
    gameStates.delete(matchId);
  },
};
