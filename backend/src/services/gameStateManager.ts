import { TIME_BONUS_CORRECT, TIME_PENALTY_INCORRECT, STARTING_TIME_SECONDS } from '../constants';

interface PlayerGameState {
  playerId: number;
  slot: 1 | 2;
  grid: number[][];
  timeRemaining: number;      // Time-as-resource timer (starts at STARTING_TIME_SECONDS, can go up/down)
  score: number;              // Cells completed by player (not including initial clues)
  cellsCompleted: number;     // Total cells filled (including initial clues)
  mistakes: number;           // Track for stats
  isLocked: boolean;          // true when timer hits 0
  isSolved: boolean;
  lastMoveTime: number;
  currentStreak: number;     // Current consecutive correct moves
  longestCellStreak: number; // Longest streak achieved in this game
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
  forfeitWinnerId?: number | null; // Optional winner override for forfeits
  forfeitingPlayerId?: number | null; // Track which player forfeited (for validation)
  // Disconnect tracking
  disconnectedPlayerId: number | null;
  disconnectTime: number | null;  // timestamp when disconnect occurred
  gracePeriodTimer: NodeJS.Timeout | null;
  pausedPlayerId: number | null;  // player whose timer is paused
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
        timeRemaining: STARTING_TIME_SECONDS,
        score: 0,                   // Cells solved by player (not including initial clues)
        cellsCompleted: this.countInitialCells(initialGridArray),
        mistakes: 0,
        isLocked: false,
        isSolved: false,
        lastMoveTime: Date.now(),
        currentStreak: 0,
        longestCellStreak: 0,
      },
      player2: {
        playerId: player2Id,
        slot: 2,
        grid: JSON.parse(JSON.stringify(initialGridArray)),
        timeRemaining: STARTING_TIME_SECONDS,
        score: 0,                   // Cells solved by player (not including initial clues)
        cellsCompleted: this.countInitialCells(initialGridArray),
        mistakes: 0,
        isLocked: false,
        isSolved: false,
        lastMoveTime: Date.now(),
        currentStreak: 0,
        longestCellStreak: 0,
      },
      status: 'WAITING',
      startedAt: null,
      timeLimit,
      timeoutTimer: null,
      timerInterval: null,
      forfeitWinnerId: null,
      forfeitingPlayerId: null,
      disconnectedPlayerId: null,
      disconnectTime: null,
      gracePeriodTimer: null,
      pausedPlayerId: null,
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
      // Only tick timers for non-paused players
      if (!game.player1.isLocked && !game.player1.isSolved && game.player1.timeRemaining > 0 && game.player1.playerId !== game.pausedPlayerId) {
        game.player1.timeRemaining--;
        if (game.player1.timeRemaining <= 0) {
          // Player 1 timed out – lock them out
          game.player1.isLocked = true;
        }
      }
      if (!game.player2.isLocked && !game.player2.isSolved && game.player2.timeRemaining > 0 && game.player2.playerId !== game.pausedPlayerId) {
        game.player2.timeRemaining--;
        if (game.player2.timeRemaining <= 0) {
          // Player 2 timed out – lock them out
          game.player2.isLocked = true;
        }
      }

      // Check if game should end (both locked or one solved)
      const ended = this.checkVictoryConditions(game);
      if (ended) {
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
    player.lastMoveTime = now;
    // Note: timeRemaining is managed by the interval timer and move bonuses/penalties
  },

  applyMove(
    matchId: number,
    playerId: number,
    row: number,
    col: number,
    value: number
  ): { success: boolean; correct?: boolean; player: PlayerGameState; gameEnded?: boolean; winner?: number | null } {
    const game = gameStates.get(matchId);
    
    if (!game || game.status !== 'IN_PROGRESS') {
      throw new Error('Game not in progress');
    }

    // Ensure both are numbers for comparison
    const p1Id = Number(game.player1.playerId);
    const p2Id = Number(game.player2.playerId);
    const searchId = Number(playerId);
    
    const player = p1Id === searchId ? game.player1 : game.player2;
    const opponent = p1Id === searchId ? game.player2 : game.player1;

    // Can't move if locked
    if (player.isLocked) {
      console.log(`[applyMove] Rejecting move: player ${playerId} (slot=${player.slot}) is locked. Opponent (slot=${opponent.slot}) locked=${opponent.isLocked}, opponent score=${opponent.score}, player score=${player.score}`);
      return { success: false, player, gameEnded: false };
    }

    // Can't edit initial clues
    if (row < 0 || row >= 9 || col < 0 || col >= 9) {
      return { success: false, player, gameEnded: false };
    }

    const initialValue = game.initialGrid[row]?.[col];
    if (initialValue !== 0) {
      return { success: false, player, gameEnded: false };
    }

    // Check if cell already has a correct value - prevent overwriting correct placements
    const currentValue = player.grid[row]?.[col] || 0;
    const solutionValue = game.solutionGrid[row]?.[col];
    if (currentValue !== 0 && currentValue === solutionValue) {
      // Cell already has the correct value - treat like a prefilled clue, cannot be changed
      return { success: false, player, gameEnded: false };
    }

    // Validate solution grid access and compare values
    const correct = solutionValue !== undefined && Number(solutionValue) === Number(value);

    if (correct) {
      const wasEmpty = player.grid[row] && player.grid[row][col] === 0;
      if (player.grid[row]) {
        player.grid[row][col] = value;
      }
      
      if (wasEmpty) {
        // Only count user-placed cells (not initial clues) toward score
        player.score++;
        player.cellsCompleted++;
        // Time bonus for correct answer
        player.timeRemaining += TIME_BONUS_CORRECT;
      }

      // Check for puzzle completion (all 81 cells filled)
      if (player.cellsCompleted === 81) {
        player.isSolved = true;
        console.log(`[applyMove] Player ${player.slot} solved the puzzle!`);
        // Don't set status here - let endGame handle it
        return { success: true, correct: true, player, gameEnded: true, winner: player.slot };
      }

      // Check if opponent is locked and we've surpassed their score
      if (opponent.isLocked && player.score > opponent.score) {
        console.log(`[applyMove] Victory condition: opponent (slot=${opponent.slot}) is locked, player (slot=${player.slot}) score=${player.score} > opponent score=${opponent.score}`);
        // Don't set status here - let endGame handle it
        return { success: true, correct: true, player, gameEnded: true, winner: player.slot };
      }
      
      // Log when opponent is locked but we haven't surpassed them yet
      if (opponent.isLocked && player.score <= opponent.score) {
        console.log(`[applyMove] Opponent (slot=${opponent.slot}) is locked, but player (slot=${player.slot}) score=${player.score} <= opponent score=${opponent.score}. Game continues.`);
      }
    } else {
      // Incorrect move
      player.mistakes++;
      // Reset streak on incorrect move
      player.currentStreak = 0;
      // Time penalty for mistake (can go to 0, not negative)
      player.timeRemaining = Math.max(0, player.timeRemaining - TIME_PENALTY_INCORRECT);
      
      // Revert cell to empty (player must try again)
      if (player.grid[row]) {
        player.grid[row][col] = 0;
      }
      
      // Check for lockout (timer hit 0)
      if (player.timeRemaining <= 0) {
        player.isLocked = true;
        
        // If both players locked, game ends
        if (opponent.isLocked) {
          // Don't set status here - let endGame handle it
          const winner = player.score > opponent.score ? player.slot :
                         opponent.score > player.score ? opponent.slot : null;
          return { success: true, correct: false, player, gameEnded: true, winner };
        }
        
        // Otherwise, opponent can continue playing
        // Check if opponent has already surpassed our score
        if (opponent.score > player.score) {
          // Don't set status here - let endGame handle it
          return { success: true, correct: false, player, gameEnded: true, winner: opponent.slot };
        }
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

    // ============================================================
    // ABSOLUTE PRIORITY: FORFEIT CHECK - MUST BE FIRST
    // ============================================================
    // If ANY forfeit occurred, the forfeiting player ALWAYS loses
    // This check MUST happen FIRST and MUST override EVERYTHING
    // NO EXCEPTIONS - FORFEITING PLAYER NEVER WINS
    // Also check disconnectedPlayerId as a safety net for disconnect forfeits
    
    // If a player disconnected and grace period expired, they should forfeit
    if (game.disconnectedPlayerId != null && game.disconnectTime != null) {
      const elapsed = Date.now() - game.disconnectTime;
      // If grace period expired (15 seconds), treat as forfeit
      if (elapsed >= 15000) {
        console.log(`[GameState] Disconnected player ${game.disconnectedPlayerId} exceeded grace period, treating as forfeit`);
        // Ensure forfeit is marked
        if (game.forfeitingPlayerId === null) {
          game.forfeitingPlayerId = game.disconnectedPlayerId;
          const winner = game.disconnectedPlayerId === p1.playerId ? p2 : p1;
          game.forfeitWinnerId = winner.playerId;
        }
      }
    }
    
    if (game.forfeitingPlayerId != null) {
      // The forfeiting player ALWAYS loses, opponent ALWAYS wins
      const forfeitingId = game.forfeitingPlayerId;
      
      // CRITICAL: IGNORE forfeitWinnerId if forfeitingPlayerId is set
      // Always determine winner based on forfeitingPlayerId to ensure correctness
      // Determine winner: ALWAYS the opponent of the forfeiting player
      if (forfeitingId === p1.playerId) {
        winnerId = p2.playerId;
        resultCode = 2;
      } else if (forfeitingId === p2.playerId) {
        winnerId = p1.playerId;
        resultCode = 1;
      } else {
        // Fallback: forfeitingId doesn't match either player (shouldn't happen)
        console.error(`[GameState] ERROR: forfeitingId ${forfeitingId} doesn't match either player!`);
        // Last resort: determine opponent by process of elimination
        winnerId = forfeitingId === p1.playerId ? p2.playerId : p1.playerId;
        resultCode = winnerId === p1.playerId ? 1 : 2;
      }
      
      // CRITICAL VALIDATION: Ensure winnerId is NEVER the forfeiting player
      if (winnerId === forfeitingId) {
        console.error(`[GameState] CRITICAL ERROR: winnerId matches forfeitingId! Forcing correction...`);
        winnerId = forfeitingId === p1.playerId ? p2.playerId : p1.playerId;
        resultCode = winnerId === p1.playerId ? 1 : 2;
      }
      
      // Additional validation: If forfeitWinnerId is set but doesn't match our determined winner, log warning
      if (game.forfeitWinnerId != null && game.forfeitWinnerId !== winnerId) {
        console.warn(`[GameState] WARNING: forfeitWinnerId (${game.forfeitWinnerId}) doesn't match determined winner (${winnerId}). Using determined winner.`);
      }
      
      console.log(`[GameState] FORFEIT RESULT: player ${forfeitingId} forfeited, player ${winnerId} wins (resultCode=${resultCode})`);
      
      // Return immediately - forfeit overrides EVERYTHING
      return {
        player1: {
          playerId: p1.playerId,
          score: p1.score,
          cellsCompleted: p1.cellsCompleted,
          mistakes: p1.mistakes,
          timeRemaining: p1.timeRemaining,
          longestCellStreak: p1.longestCellStreak,
          isWinner: winnerId === p1.playerId,
        },
        player2: {
          playerId: p2.playerId,
          score: p2.score,
          cellsCompleted: p2.cellsCompleted,
          mistakes: p2.mistakes,
          timeRemaining: p2.timeRemaining,
          longestCellStreak: p2.longestCellStreak,
          isWinner: winnerId === p2.playerId,
        },
        winnerId,
        resultCode,
      };
    }
    
    // Legacy check: if forfeitWinnerId is set but forfeitingPlayerId is null
    // This handles old forfeit logic - treat as forfeit
    // CRITICAL: Validate that forfeitWinnerId is correct (not the forfeiting player)
    if (game.forfeitWinnerId != null && game.forfeitingPlayerId == null) {
      // In legacy case, we don't know who forfeited, so we can't validate
      // But we should still use forfeitWinnerId as it was explicitly set
      winnerId = game.forfeitWinnerId;
      resultCode = winnerId === p1.playerId ? 1 : 2;
      console.log(`[GameState] Legacy forfeit: winner is ${winnerId} (resultCode=${resultCode})`);
      return {
        player1: {
          playerId: p1.playerId,
          score: p1.score,
          cellsCompleted: p1.cellsCompleted,
          mistakes: p1.mistakes,
          timeRemaining: p1.timeRemaining,
          longestCellStreak: p1.longestCellStreak,
          isWinner: winnerId === p1.playerId,
        },
        player2: {
          playerId: p2.playerId,
          score: p2.score,
          cellsCompleted: p2.cellsCompleted,
          mistakes: p2.mistakes,
          timeRemaining: p2.timeRemaining,
          longestCellStreak: p2.longestCellStreak,
          isWinner: winnerId === p2.playerId,
        },
        winnerId,
        resultCode,
      };
    }

    // ============================================================
    // NORMAL WIN CONDITIONS (only if NO forfeit occurred)
    // ============================================================
    // CRITICAL: Skip normal win conditions if ANY forfeit indicator is set
    // This prevents score-based winner determination when a forfeit occurred
    const hasAnyForfeit = game.forfeitingPlayerId != null || 
                          (game.forfeitWinnerId != null && game.forfeitingPlayerId == null) ||
                          (game.disconnectedPlayerId != null && game.disconnectTime != null && (Date.now() - game.disconnectTime >= 15000));
    
    if (!hasAnyForfeit) {
      // Win condition 1: Puzzle solved
      if (p1.isSolved && !p2.isSolved) {
        winnerId = p1.playerId;
        resultCode = 1;
      } else if (p2.isSolved && !p1.isSolved) {
        winnerId = p2.playerId;
        resultCode = 2;
      } 
      // Win condition 2-4: Score comparison (higher score wins, draw if equal)
      else if (p1.score > p2.score) {
        winnerId = p1.playerId;
        resultCode = 1;
      } else if (p2.score > p1.score) {
        winnerId = p2.playerId;
        resultCode = 2;
      } else {
        // Equal scores = draw
        resultCode = 3;
      }
    } else {
      // Forfeit occurred but wasn't caught above - this shouldn't happen, but handle it
      console.error(`[GameState] ERROR: Forfeit detected but not handled in early return! forfeitingPlayerId=${game.forfeitingPlayerId}, forfeitWinnerId=${game.forfeitWinnerId}`);
      // Force forfeit handling
      const forfeitingId = game.forfeitingPlayerId ?? (game.disconnectedPlayerId && game.disconnectTime && (Date.now() - game.disconnectTime >= 15000) ? game.disconnectedPlayerId : null);
      if (forfeitingId != null) {
        winnerId = forfeitingId === p1.playerId ? p2.playerId : p1.playerId;
        resultCode = winnerId === p1.playerId ? 1 : 2;
      } else if (game.forfeitWinnerId != null) {
        // Use forfeitWinnerId as last resort
        winnerId = game.forfeitWinnerId;
        resultCode = winnerId === p1.playerId ? 1 : 2;
      }
    }

    // ============================================================
    // FINAL ABSOLUTE SAFETY CHECK: FORFEITING PLAYER NEVER WINS
    // ============================================================
    // This is a final safeguard that runs AFTER normal win conditions
    // It ensures that even if forfeitingPlayerId was somehow missed above,
    // the forfeiting player CANNOT win
    // Also check disconnectedPlayerId as additional safety net
    const forfeitingId = game.forfeitingPlayerId ?? (game.disconnectedPlayerId && game.disconnectTime && (Date.now() - game.disconnectTime >= 15000) ? game.disconnectedPlayerId : null);
    
    if (forfeitingId != null) {
      // CRITICAL: If ANY forfeit occurred, the forfeiting player ALWAYS loses
      // Override winnerId regardless of score or other conditions
      console.error(`[GameState] FINAL SAFETY CHECK: Forfeit detected (forfeitingId=${forfeitingId}), FORCING opponent win regardless of current winnerId=${winnerId}`);
      // The forfeiting/disconnected player loses, opponent wins - NO EXCEPTIONS
      if (forfeitingId === p1.playerId) {
        winnerId = p2.playerId;
        resultCode = 2;
      } else if (forfeitingId === p2.playerId) {
        winnerId = p1.playerId;
        resultCode = 1;
      } else {
        // Last resort: determine opponent
        winnerId = forfeitingId === p1.playerId ? p2.playerId : p1.playerId;
        resultCode = winnerId === p1.playerId ? 1 : 2;
      }
    }
    
    // Additional safety: Check forfeitWinnerId if forfeitingPlayerId is somehow null
    // This should not happen if forfeit() was called correctly, but handle it as legacy case
    if (game.forfeitWinnerId != null && game.forfeitingPlayerId == null) {
      // Legacy forfeit case - use forfeitWinnerId but log warning
      console.warn(`[GameState] Legacy forfeit safety check: forfeitingPlayerId is null but forfeitWinnerId is set. Using forfeitWinnerId=${game.forfeitWinnerId}`);
      winnerId = game.forfeitWinnerId;
      resultCode = winnerId === p1.playerId ? 1 : 2;
      console.log(`[GameState] Legacy forfeit safety check: winner is ${winnerId} (resultCode=${resultCode})`);
    }
    
    // FINAL VALIDATION: Double-check that forfeiting player is not the winner
    if (game.forfeitingPlayerId != null && winnerId === game.forfeitingPlayerId) {
      console.error(`[GameState] CRITICAL: Final validation failed - forfeiting player is winner! FORCING correction`);
      winnerId = game.forfeitingPlayerId === p1.playerId ? p2.playerId : p1.playerId;
      resultCode = winnerId === p1.playerId ? 1 : 2;
    }

    return {
      player1: {
        playerId: p1.playerId,
        score: p1.score,
        cellsCompleted: p1.cellsCompleted,
        mistakes: p1.mistakes,
        timeRemaining: p1.timeRemaining,
        longestCellStreak: p1.longestCellStreak,
        finalState: p1.isSolved ? 'SOLVED' : p1.isLocked ? 'LOCKED_OUT' : 'TIMEOUT',
        isWinner: winnerId === p1.playerId,
      },
      player2: {
        playerId: p2.playerId,
        score: p2.score,
        cellsCompleted: p2.cellsCompleted,
        mistakes: p2.mistakes,
        timeRemaining: p2.timeRemaining,
        longestCellStreak: p2.longestCellStreak,
        finalState: p2.isSolved ? 'SOLVED' : p2.isLocked ? 'LOCKED_OUT' : 'TIMEOUT',
        isWinner: winnerId === p2.playerId,
      },
      winnerId,
      resultCode,
    };
  },

  // Mark a player as forfeiting the match. The opponent wins regardless of score.
  // CRITICAL: This function MUST ensure the forfeiting player NEVER wins.
  // ABSOLUTE RULE: FORFEITING PLAYER ALWAYS LOSES, NO EXCEPTIONS
  forfeit(matchId: number, forfeitingPlayerId: number): void {
    const game = gameStates.get(matchId);
    if (!game || game.status !== 'IN_PROGRESS') {
      console.log(`[GameState] Forfeit ignored: game not in progress or doesn't exist`);
      return;
    }

    const p1 = game.player1;
    const p2 = game.player2;
    
    // Determine which player is forfeiting
    const forfeiter = p1.playerId === forfeitingPlayerId ? p1 : p2;
    const winner = forfeiter === p1 ? p2 : p1;

    // CRITICAL: Track both the forfeiting player and the winner
    // The forfeiting player MUST be set, and the winner MUST be the opponent
    game.forfeitingPlayerId = forfeitingPlayerId;
    
    // ABSOLUTE RULE: Winner is ALWAYS the opponent of the forfeiting player
    // NO EXCEPTIONS - even if forfeiting player is ahead, they lose
    game.forfeitWinnerId = winner.playerId;

    // CRITICAL VALIDATION: Ensure forfeitWinnerId is NEVER the forfeiting player
    if (game.forfeitWinnerId === forfeitingPlayerId) {
      console.error(`[GameState] CRITICAL ERROR: forfeitWinnerId matches forfeitingPlayerId! FORCING correction...`);
      // Force winner to be the opponent
      game.forfeitWinnerId = winner.playerId;
    }
    
    // Double-check: Ensure we didn't somehow set the wrong winner
    if (game.forfeitWinnerId === forfeitingPlayerId) {
      console.error(`[GameState] CRITICAL ERROR: Double-check failed! Forcing opponent as winner...`);
      game.forfeitWinnerId = forfeitingPlayerId === p1.playerId ? p2.playerId : p1.playerId;
    }

    // Mark forfeiting player as effectively out of the game
    forfeiter.isLocked = true;
    forfeiter.timeRemaining = 0;
    
    // Final validation log
    console.log(`[GameState] Forfeit: player ${forfeitingPlayerId} forfeits, player ${game.forfeitWinnerId} wins (forfeitWinnerId=${game.forfeitWinnerId}, forfeitingPlayerId=${game.forfeitingPlayerId})`);
    
    // Final assertion: forfeiting player must NOT be the winner
    if (game.forfeitingPlayerId === game.forfeitWinnerId) {
      console.error(`[GameState] CRITICAL ASSERTION FAILED: Forfeiting player is set as winner! This should NEVER happen!`);
    }
  },

  /**
   * Check whether the current game state satisfies any terminal victory conditions.
   * This does NOT mutate match status or clear timers; it simply inspects state.
   *
   * Win Conditions (checked in order):
   *  1. Complete the board (all 81 cells) → Instant win
   *  2. Opponent locks out + your score > opponent's → Win
   *  3. Opponent locks out + you surpass their score before you lock → Win
   *  4. Both locked → Higher score wins (draw if equal)
   */
  checkVictoryConditions(game: GameState): boolean {
    const p1 = game.player1;
    const p2 = game.player2;

    // Condition 1: Someone has solved the puzzle
    if (p1.isSolved || p2.isSolved) {
      return true;
    }

    // Condition 2 & 3: One player is locked and the other has surpassed their score
    if (p1.isLocked && !p2.isLocked && p2.score > p1.score) {
      return true;
    }
    if (p2.isLocked && !p1.isLocked && p1.score > p2.score) {
      return true;
    }

    // Condition 4: Both players are locked out
    if (p1.isLocked && p2.isLocked) {
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
    if (game) {
      if (game.timeoutTimer) {
        clearTimeout(game.timeoutTimer);
      }
      if (game.timerInterval) {
        clearInterval(game.timerInterval);
      }
      if (game.gracePeriodTimer) {
        clearTimeout(game.gracePeriodTimer);
      }
      gameStates.delete(matchId);
    }
  },

  // Get current timer values for both players
  getTimerValues(matchId: number): { player1: number; player2: number } | null {
    const game = gameStates.get(matchId);
    if (!game) return null;
    return {
      player1: game.player1.timeRemaining,
      player2: game.player2.timeRemaining,
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

    if (player.isLocked || player.timeRemaining <= 0) {
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

  // Call when a player disconnects
  handleDisconnect(matchId: number, disconnectedPlayerId: number, onGraceExpired: (matchId: number) => void): void {
    const game = gameStates.get(matchId);
    if (!game || game.status !== 'IN_PROGRESS') return;

    // Don't handle disconnect if already disconnected (avoid double handling)
    if (game.disconnectedPlayerId !== null) return;

    game.disconnectedPlayerId = disconnectedPlayerId;
    game.disconnectTime = Date.now();

    // Pause the OTHER player's timer (the one still connected)
    const connectedPlayer = game.player1.playerId === disconnectedPlayerId 
      ? game.player2 
      : game.player1;
    game.pausedPlayerId = connectedPlayer.playerId;

    // Start grace period timer (15 seconds)
    game.gracePeriodTimer = setTimeout(() => {
      this.handleGraceExpired(matchId, onGraceExpired);
    }, 15000);

    console.log(`[GameState] Player ${disconnectedPlayerId} disconnected in match ${matchId}, grace period started`);
  },

  // Call when disconnected player reconnects
  handleReconnect(matchId: number, reconnectedPlayerId: number): boolean {
    const game = gameStates.get(matchId);
    if (!game || game.disconnectedPlayerId !== reconnectedPlayerId) return false;

    // Clear grace period
    if (game.gracePeriodTimer) {
      clearTimeout(game.gracePeriodTimer);
      game.gracePeriodTimer = null;
    }

    // Resume connected player's timer
    game.pausedPlayerId = null;
    game.disconnectedPlayerId = null;
    game.disconnectTime = null;

    console.log(`[GameState] Player ${reconnectedPlayerId} reconnected in match ${matchId}, game resumed`);
    return true;
  },

  // Called when 15s grace period expires without reconnection
  handleGraceExpired(matchId: number, onGraceExpired: (matchId: number) => void): void {
    const game = gameStates.get(matchId);
    if (!game || !game.disconnectedPlayerId) return;

    console.log(`[GameState] Grace period expired for match ${matchId}, forfeiting player ${game.disconnectedPlayerId}`);

    // Auto-forfeit the disconnected player
    this.forfeit(matchId, game.disconnectedPlayerId);
    
    // Clear disconnect state
    game.pausedPlayerId = null;
    game.disconnectTime = null;
    if (game.gracePeriodTimer) {
      clearTimeout(game.gracePeriodTimer);
      game.gracePeriodTimer = null;
    }

    // Trigger endGame via callback
    onGraceExpired(matchId);
  },
};
