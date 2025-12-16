import { TIME_BONUS_CORRECT, TIME_PENALTY_INCORRECT, STARTING_TIME_SECONDS } from '../constants';

interface PlayerGameState {
  playerId: number;
  userId?: number;            // Added for forfeit race condition fix
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
  timeoutTimer: any | null;
  timerInterval: any | null; // Interval for per-player timer countdown
  forfeitWinnerId?: number | null; // Optional winner override for forfeits
  forfeitingPlayerId?: number | null; // Track which player forfeited (disconnect)
  // Disconnect tracking
  disconnectedPlayerId: number | null;
  disconnectTime: number | null;  // timestamp when disconnect occurred
  gracePeriodTimer: any | null;
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

      // If someone is disconnected, PAUSE BOTH TIMERS (game is effectively on hold)
      if (game.disconnectedPlayerId !== null) {
        // Don't decrement any timers during disconnect grace period
        // The disconnected player will auto-forfeit after 15 seconds via gracePeriodTimer
        return;
      }

      // Normal gameplay - decrement timers for non-locked, non-solved players
      // Legacy first-match bot: player2.playerId === -1
      // Queue-based bot: player2.playerId is a real ID but match is flagged as bot match
      const isLegacyBotMatch = Number(game.player2.playerId) === -1;
      const isQueueBasedBotMatch = Number(game.player1.playerId) === -1; // player1 could theoretically be bot
      const isBotMatch = isLegacyBotMatch || isQueueBasedBotMatch;
      
      if (!game.player1.isLocked && !game.player1.isSolved && game.player1.timeRemaining > 0) {
        game.player1.timeRemaining--;
        if (game.player1.timeRemaining <= 0) {
          // Legacy first-match bot: end game immediately when human runs out of time
          if (isLegacyBotMatch) {
            game.player1.isLocked = true;
            if (game.timerInterval) {
              clearInterval(game.timerInterval);
              game.timerInterval = null;
            }
            onTimeout(matchId);
            return;
          }
          // Queue-based bot: human can continue playing after timer expires
          // Regular match: lock the player
          if (!isBotMatch) {
            game.player1.isLocked = true;
          }
        }
      }
      if (!game.player2.isLocked && !game.player2.isSolved && game.player2.timeRemaining > 0) {
        game.player2.timeRemaining--;
        if (game.player2.timeRemaining <= 0) {
          game.player2.isLocked = true;
        }
      }

      // Special case: Queue-based bot matches – if BOTH timers have reached 0, auto-end as a human victory.
      // (Legacy bot matches end immediately when human timer hits 0, handled above)
      if (isBotMatch && !isLegacyBotMatch && game.player1.timeRemaining <= 0 && game.player2.timeRemaining <= 0) {
        // Let getFinalResults decide the winner (human) based on this state.
        if (game.timerInterval) {
          clearInterval(game.timerInterval);
          game.timerInterval = null;
        }
        onTimeout(matchId);
        return;
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
        // Don't set status here - let endGame handle it
        return { success: true, correct: true, player, gameEnded: true, winner: player.slot };
      }

      // Check if opponent is locked and we've surpassed their score
      if (opponent.isLocked && player.score > opponent.score) {
        // Don't set status here - let endGame handle it
        return { success: true, correct: true, player, gameEnded: true, winner: player.slot };
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
        // Distinguish between bot match types:
        // - Legacy first-match bot: player2.playerId === -1 → game ends immediately
        // - Queue-based bot: player2 has real playerId → human can continue
        const isLegacyBotMatch = Number(game.player2.playerId) === -1;
        const isHumanInQueueBotMatch = !isLegacyBotMatch && player.slot === 1 && 
          (Number(game.player1.playerId) === -1 || Number(game.player2.playerId) !== game.player1.playerId);
        
        // Legacy first-match bot: human gets locked, game ends immediately
        if (isLegacyBotMatch && player.slot === 1) {
          player.isLocked = true;
          return { success: true, correct: false, player, gameEnded: true, winner: player.score > opponent.score ? player.slot : opponent.slot };
        }
        
        if (!isHumanInQueueBotMatch) {
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
        // Human in queue-based bot match: timer stays at 0, they can keep playing
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
    
    // If a player disconnected and grace period expired, they should forfeit
    if (game.disconnectedPlayerId != null && game.disconnectTime != null) {
      const elapsed = Date.now() - game.disconnectTime;
      // If grace period expired (15 seconds), treat as forfeit
      if (elapsed >= 15000) {
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
      // CRITICAL: Coerce all IDs to numbers to avoid type mismatch
      const forfeitingId = Number(game.forfeitingPlayerId);
      const player1Id = Number(p1.playerId);
      const player2Id = Number(p2.playerId);
      
      // Determine winner: ALWAYS the opponent of the forfeiting player
      if (forfeitingId === player1Id) {
        winnerId = player2Id;
        resultCode = 2;
      } else if (forfeitingId === player2Id) {
        winnerId = player1Id;
        resultCode = 1;
      } else {
        // Fallback: forfeitingId doesn't match either player (shouldn't happen)
        winnerId = forfeitingId === player1Id ? player2Id : player1Id;
        resultCode = winnerId === player1Id ? 1 : 2;
      }
      
      // CRITICAL VALIDATION: Ensure winnerId is NEVER the forfeiting player
      if (winnerId === forfeitingId) {
        winnerId = forfeitingId === player1Id ? player2Id : player1Id;
        resultCode = winnerId === player1Id ? 1 : 2;
      }
      
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
    // CRITICAL: We CANNOT trust forfeitWinnerId alone - it might be incorrectly set
    // Instead, check if there's a disconnected player who exceeded grace period
    if (game.forfeitWinnerId != null && game.forfeitingPlayerId == null) {
      // Try to determine who forfeited from disconnect status
      if (game.disconnectedPlayerId != null && game.disconnectTime != null) {
        const elapsed = Date.now() - game.disconnectTime;
        if (elapsed >= 15000) {
          // Disconnected player exceeded grace period - they forfeited
          const forfeitingId = game.disconnectedPlayerId;
          game.forfeitingPlayerId = forfeitingId;
          // Determine winner: opponent of forfeiting player
          if (forfeitingId === p1.playerId) {
            winnerId = p2.playerId;
            resultCode = 2;
          } else {
            winnerId = p1.playerId;
            resultCode = 1;
          }
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
      }
      // If we can't determine who forfeited, DO NOT trust forfeitWinnerId
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
      const isBotMatch = Number(p1.playerId) === -1 || Number(p2.playerId) === -1;
      // Special case: Sudobot match where BOTH timers have reached 0 → human wins, even if scores are tied or behind.
      if (isBotMatch && p1.timeRemaining <= 0 && p2.timeRemaining <= 0) {
        const humanPlayer = Number(p1.playerId) === -1 ? p2 : p1;
        winnerId = humanPlayer.playerId;
        resultCode = humanPlayer === p1 ? 1 : 2;
      }
      // Win condition 1: Puzzle solved
      else if (p1.isSolved && !p2.isSolved) {
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
      // Forfeit occurred but wasn't caught above - force forfeit handling
      const forfeitingId = game.forfeitingPlayerId ?? (game.disconnectedPlayerId && game.disconnectTime && (Date.now() - game.disconnectTime >= 15000) ? game.disconnectedPlayerId : null);
      if (forfeitingId != null) {
        // We know who forfeited - opponent always wins
        winnerId = forfeitingId === p1.playerId ? p2.playerId : p1.playerId;
        resultCode = winnerId === p1.playerId ? 1 : 2;
      }
    }

    // ============================================================
    // FINAL ABSOLUTE SAFETY CHECK: FORFEITING PLAYER NEVER WINS
    // ============================================================
    // CRITICAL: This is the LAST check before returning results
    // It MUST ensure the forfeiting player NEVER wins, NO MATTER WHAT
    // Calculate forfeiting player ID from all possible sources
    let finalForfeitingId: number | null = null;
    
    // Source 1: Explicit forfeitingPlayerId (most reliable)
    if (game.forfeitingPlayerId != null) {
      finalForfeitingId = game.forfeitingPlayerId;
    }
    // Source 2: Disconnected player who exceeded grace period
    else if (game.disconnectedPlayerId != null && game.disconnectTime != null) {
      const elapsed = Date.now() - game.disconnectTime;
      if (elapsed >= 15000) {
        finalForfeitingId = game.disconnectedPlayerId;
        // Also set forfeitingPlayerId for consistency
        game.forfeitingPlayerId = finalForfeitingId;
      }
    }
    
    // CRITICAL: If ANY forfeit occurred, FORCE the forfeiting player to lose
    if (finalForfeitingId != null) {
      // ABSOLUTE RULE: Forfeiting player ALWAYS loses, opponent ALWAYS wins
      // Override ANY previous winner determination
      const correctWinnerId = finalForfeitingId === p1.playerId ? p2.playerId : p1.playerId;
      const correctResultCode = correctWinnerId === p1.playerId ? 1 : 2;
      
      // If current winnerId is wrong, force correction
      if (winnerId !== correctWinnerId) {
        winnerId = correctWinnerId;
        resultCode = correctResultCode;
      }
    
      // CRITICAL VALIDATION: Ensure forfeitWinnerId is correct (if set)
      if (game.forfeitWinnerId != null) {
        if (game.forfeitWinnerId === finalForfeitingId || game.forfeitWinnerId !== correctWinnerId) {
          game.forfeitWinnerId = correctWinnerId;
        }
      }
      
      // Final assertion: winnerId MUST be the opponent
      if (winnerId === finalForfeitingId) {
        winnerId = correctWinnerId;
        resultCode = correctResultCode;
      }
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
  // Mark a player as forfeiting the match (only called when disconnect grace period expires)
  // The opponent wins regardless of score.
  forfeit(matchId: number, forfeitingPlayerId: number): void {
    const game = gameStates.get(matchId);
    if (!game) {
      return;
    }

    const p1 = game.player1;
    const p2 = game.player2;
    
    // Validate forfeitingPlayerId
    if (forfeitingPlayerId !== p1.playerId && forfeitingPlayerId !== p2.playerId) {
      return;
    }
    
    // Stop the timer
    if (game.timerInterval) {
      clearInterval(game.timerInterval);
      game.timerInterval = null;
    }
    
    // Winner is ALWAYS the opponent
    const winnerId = forfeitingPlayerId === p1.playerId ? p2.playerId : p1.playerId;
    
    game.forfeitingPlayerId = forfeitingPlayerId;
    game.forfeitWinnerId = winnerId;

    // Mark forfeiting player as locked out
    const forfeiter = forfeitingPlayerId === p1.playerId ? p1 : p2;
    forfeiter.isLocked = true;
    forfeiter.timeRemaining = 0;
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
   * 
   * CRITICAL: If a forfeit has occurred, return false to prevent normal game end logic.
   * Forfeit handling must be done separately via getFinalResults().
   */
  checkVictoryConditions(game: GameState): boolean {
    // CRITICAL: If someone is disconnected, do NOT end game normally
    // Wait for grace period - disconnected player will forfeit
    if (game.disconnectedPlayerId !== null) {
      return false;
    }
    
    // CRITICAL: If forfeit has occurred, do NOT trigger normal game end
    // Forfeit must be handled separately to ensure forfeiting player always loses
    if (game.forfeitingPlayerId != null) {
      return false;
    }

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

    // Can't erase if locked or timer has expired
    // Note: Legacy first-match bot ends game immediately when timer hits 0
    // Queue-based bots allow human to continue (timer at 0 but not locked)
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
    
    // Both timers are now paused (handled in timer interval by checking disconnectedPlayerId)
    // No need for pausedPlayerId - we pause BOTH timers during disconnect

    // Start grace period timer (15 seconds)
    game.gracePeriodTimer = setTimeout(() => {
      this.handleGraceExpired(matchId, onGraceExpired);
    }, 15000);
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

    // Clear disconnect state - timers will resume automatically
    game.disconnectedPlayerId = null;
    game.disconnectTime = null;

    return true;
  },

  // Called when 15s grace period expires without reconnection
  handleGraceExpired(matchId: number, onGraceExpired: (matchId: number) => void): void {
    const game = gameStates.get(matchId);
    if (!game || !game.disconnectedPlayerId) return;

    const forfeitingPlayerId = game.disconnectedPlayerId;
    
    // CRITICAL: Set forfeit state DIRECTLY - do NOT rely on forfeit() which has status checks
    // The disconnected player ALWAYS loses, opponent ALWAYS wins - NO EXCEPTIONS
    const p1 = game.player1;
    const p2 = game.player2;
    
    // CRITICAL: Coerce to numbers to avoid type mismatch (string vs number)
    const forfeiterId = Number(forfeitingPlayerId);
    const player1Id = Number(p1.playerId);
    const player2Id = Number(p2.playerId);
    
    // Determine winner: ALWAYS the opponent of disconnected player
    const winnerId = forfeiterId === player1Id ? player2Id : player1Id;
    
    // Set forfeit state directly on game object (use coerced numbers)
    game.forfeitingPlayerId = forfeiterId;
    game.forfeitWinnerId = winnerId;
    
    // Mark forfeiting player as locked
    const forfeiter = forfeiterId === player1Id ? p1 : p2;
    forfeiter.isLocked = true;
    forfeiter.timeRemaining = 0;
    
    // Stop the timer to prevent any more ticks
    if (game.timerInterval) {
      clearInterval(game.timerInterval);
      game.timerInterval = null;
    }

    // Clear disconnect state AFTER setting forfeit state
    game.disconnectedPlayerId = null;
    game.disconnectTime = null;
    if (game.gracePeriodTimer) {
      clearTimeout(game.gracePeriodTimer);
      game.gracePeriodTimer = null;
    }

    // Trigger endGame - getFinalResults() will see forfeitingPlayerId and use it
    onGraceExpired(matchId);
  },
};
