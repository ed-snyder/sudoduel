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
  timeoutTimer: any | null;
  timerInterval: any | null; // Interval for per-player timer countdown
  forfeitWinnerId?: number | null; // Optional winner override for forfeits
  forfeitingPlayerId?: number | null; // Track which player forfeited (for validation)
  // Disconnect tracking
  disconnectedPlayerId: number | null;
  disconnectTime: number | null;  // timestamp when disconnect occurred
  gracePeriodTimer: any | null;
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
      // Bot matches: player2.playerId is -1 (null from DB becomes -1)
      const isBotMatch = Number(game.player2.playerId) === -1;
      if (!game.player1.isLocked && !game.player1.isSolved && game.player1.timeRemaining > 0 && game.player1.playerId !== game.pausedPlayerId) {
        game.player1.timeRemaining--;
        if (game.player1.timeRemaining <= 0) {
          // Bot matches: player 1 can continue playing after timer hits 0
          // Normal matches: lock them out
          if (isBotMatch) {
            console.log(`🤖 Bot match ${game.matchId}: Player 1 timer hit 0, NOT locking (bot match)`);
          } else {
            game.player1.isLocked = true;
          }
          // Timer stays at 0, doesn't go negative
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
        // Bot matches: player 1 (human) can continue playing after timer hits 0
        const isBotMatch = Number(game.player2.playerId) === -1;
        const isHumanInBotMatch = isBotMatch && player.slot === 1;
        
        if (!isHumanInBotMatch) {
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
        // Human in bot match: timer stays at 0, they can keep playing
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
          console.log(`[GameState] Legacy forfeit resolved: disconnected player ${forfeitingId} forfeited, player ${winnerId} wins`);
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
      // Log error and fall through to normal win conditions (but forfeit check will catch it)
      console.error(`[GameState] CRITICAL: forfeitWinnerId is set (${game.forfeitWinnerId}) but forfeitingPlayerId is null and no disconnected player found. Cannot safely determine winner.`);
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
      // Force forfeit handling - determine who forfeited
      const forfeitingId = game.forfeitingPlayerId ?? (game.disconnectedPlayerId && game.disconnectTime && (Date.now() - game.disconnectTime >= 15000) ? game.disconnectedPlayerId : null);
      if (forfeitingId != null) {
        // We know who forfeited - opponent always wins
        winnerId = forfeitingId === p1.playerId ? p2.playerId : p1.playerId;
        resultCode = winnerId === p1.playerId ? 1 : 2;
      } else {
        // CRITICAL: If we don't know who forfeited, DO NOT trust forfeitWinnerId
        // It might be incorrectly set. Log error and let final safety check handle it.
        console.error(`[GameState] CRITICAL: Cannot determine forfeiting player! forfeitWinnerId=${game.forfeitWinnerId} cannot be trusted.`);
        // Don't set winnerId here - let final safety check handle it
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
        console.error(`[GameState] CRITICAL: Forfeit detected (forfeitingId=${finalForfeitingId}), FORCING opponent win. Current winnerId=${winnerId} is WRONG. Correcting to ${correctWinnerId}`);
        winnerId = correctWinnerId;
        resultCode = correctResultCode;
    }
    
      // CRITICAL VALIDATION: Ensure forfeitWinnerId is correct (if set)
      if (game.forfeitWinnerId != null) {
        if (game.forfeitWinnerId === finalForfeitingId) {
          console.error(`[GameState] CRITICAL: forfeitWinnerId (${game.forfeitWinnerId}) matches forfeiting player! This is WRONG. Correcting...`);
          game.forfeitWinnerId = correctWinnerId;
        } else if (game.forfeitWinnerId !== correctWinnerId) {
          console.error(`[GameState] CRITICAL: forfeitWinnerId (${game.forfeitWinnerId}) doesn't match correct winner (${correctWinnerId}). Correcting...`);
          game.forfeitWinnerId = correctWinnerId;
        }
      }
      
      // Final assertion: winnerId MUST be the opponent
      if (winnerId === finalForfeitingId) {
        console.error(`[GameState] CRITICAL ASSERTION FAILED: winnerId (${winnerId}) matches forfeiting player! This should NEVER happen! FORCING correction...`);
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
  forfeit(matchId: number, forfeitingPlayerId: number): void {
    const game = gameStates.get(matchId);
    if (!game || game.status !== 'IN_PROGRESS') {
      console.log(`[GameState] Forfeit ignored: game not in progress or doesn't exist`);
      return;
    }

    const p1 = game.player1;
    const p2 = game.player2;
    
    // CRITICAL: Validate forfeitingPlayerId matches one of the players
    if (forfeitingPlayerId !== p1.playerId && forfeitingPlayerId !== p2.playerId) {
      console.error(`[GameState] CRITICAL ERROR: Invalid forfeitingPlayerId ${forfeitingPlayerId}. Must be either ${p1.playerId} or ${p2.playerId}`);
      return;
    }
    
    // CRITICAL: Stop the timer IMMEDIATELY to prevent checkVictoryConditions from running
    // This prevents a race condition where the timer tick might trigger normal game end
    if (game.timerInterval) {
      clearInterval(game.timerInterval);
      game.timerInterval = null;
      console.log(`[GameState] Stopped timer interval to prevent race condition`);
    }
    
    // ABSOLUTE RULE: Winner is ALWAYS the opponent of the forfeiting player
    // Calculate winner directly - NO EXCEPTIONS
    const correctWinnerId = forfeitingPlayerId === p1.playerId ? p2.playerId : p1.playerId;
    
    // CRITICAL: Set forfeiting player FIRST
    game.forfeitingPlayerId = forfeitingPlayerId;
    
    // CRITICAL: Set winner to ALWAYS be the opponent
    game.forfeitWinnerId = correctWinnerId;

    // CRITICAL VALIDATION: Ensure forfeitWinnerId is NEVER the forfeiting player
    if (game.forfeitWinnerId === forfeitingPlayerId) {
      console.error(`[GameState] CRITICAL ERROR: forfeitWinnerId (${game.forfeitWinnerId}) matches forfeitingPlayerId (${forfeitingPlayerId})! FORCING correction...`);
      game.forfeitWinnerId = correctWinnerId;
    }
    
    // Triple-check: Ensure we didn't somehow set the wrong winner
    if (game.forfeitWinnerId === forfeitingPlayerId) {
      console.error(`[GameState] CRITICAL ERROR: Triple-check failed! Forcing opponent as winner...`);
      game.forfeitWinnerId = correctWinnerId;
    }

    // Mark forfeiting player as effectively out of the game
    const forfeiter = forfeitingPlayerId === p1.playerId ? p1 : p2;
    forfeiter.isLocked = true;
    forfeiter.timeRemaining = 0;
    
    // Final validation log
    console.log(`[GameState] Forfeit: player ${forfeitingPlayerId} forfeits, player ${game.forfeitWinnerId} wins (forfeitWinnerId=${game.forfeitWinnerId}, forfeitingPlayerId=${game.forfeitingPlayerId})`);
    
    // Final assertion: forfeiting player must NOT be the winner
    if (game.forfeitingPlayerId === game.forfeitWinnerId) {
      console.error(`[GameState] CRITICAL ASSERTION FAILED: Forfeiting player (${game.forfeitingPlayerId}) is set as winner! This should NEVER happen! FORCING correction...`);
      game.forfeitWinnerId = correctWinnerId;
    }
    
    // Final absolute check before returning
    if (game.forfeitingPlayerId === game.forfeitWinnerId) {
      console.error(`[GameState] CRITICAL: Final check failed! Forfeiting player is winner! This is IMPOSSIBLE. Aborting forfeit.`);
      // Reset forfeit state - something is seriously wrong
      game.forfeitingPlayerId = null;
      game.forfeitWinnerId = null;
      return;
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
   * 
   * CRITICAL: If a forfeit has occurred, return false to prevent normal game end logic.
   * Forfeit handling must be done separately via getFinalResults().
   */
  checkVictoryConditions(game: GameState): boolean {
    // CRITICAL: If forfeit has occurred, do NOT trigger normal game end
    // Forfeit must be handled separately to ensure forfeiting player always loses
    if (game.forfeitingPlayerId != null) {
      console.log(`[GameState] checkVictoryConditions: Forfeit detected, returning false to prevent normal game end`);
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

    // Bot matches: player 1 (human) can continue erasing after timer hits 0
    const isBotMatch = Number(game.player2.playerId) === -1;
    const isHumanInBotMatch = isBotMatch && player.slot === 1;
    
    if (player.isLocked || (player.timeRemaining <= 0 && !isHumanInBotMatch)) {
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
