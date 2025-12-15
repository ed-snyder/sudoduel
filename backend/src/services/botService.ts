/**
 * Bot Service - Manages bot opponents for matchmaking
 * 
 * Supports two types of bot matches:
 * 1. First-time player matches (legacy, simple bot)
 * 2. Queue-based bot matches (after 12s wait, rating-based bots)
 */

import { query } from '../config/database';
import { GameStateManager } from './gameStateManager';

// ============================================================
// LEGACY BOT CONFIG (for first-time player matches)
// ============================================================
const LEGACY_BOT_CONFIG = {
  name: 'SudoBot',
  displayRating: 800,
  moveInterval: 20000,
  mistakeTimeMin: 110000,
  mistakeTimeMax: 130000,
};

// ============================================================
// NEW BOT BEHAVIOR FORMULAS (for queue-based matches)
// ============================================================

/**
 * Calculate base time per move based on rating
 * Rating 1000 → 0.3s, Rating 1500 → 0.08s, Rating 1800 → 0.02s
 * Extremely fast for competitive gameplay - bots above 1000 are very fast
 */
function calculateBaseTime(rating: number): number {
  const r = Math.max(1000, Math.min(1800, rating));
  // Exponential formula: extremely fast at higher ratings
  // Base: 0.3s at 1000, scales down to 0.02s at 1800
  const normalized = (r - 1000) / 800; // 0 to 1
  const baseTime = 0.3 * Math.pow(1/15, normalized); // Exponential decay: 0.3 * (1/15)^normalized
  return Math.max(0.02, Math.round(baseTime * 100) / 100); // Round to 0.01s, min 0.02s
}

/**
 * Calculate mistake rate based on rating
 * Rating 1000 → 15%, Rating 1500 → 3%, Rating 1800 → 0.5%
 * Much lower mistake rates for smarter bots above 1000
 */
function calculateMistakeRate(rating: number): number {
  const r = Math.max(1000, Math.min(1800, rating));
  return Math.max(0.005, Math.min(0.15, 0.15 - (r - 1000) * 0.00018125));
}

/**
 * Calculate optimal cell selection chance based on rating
 * Rating 1000 → 60%, Rating 1500 → 90%, Rating 1800 → 99%
 * Much higher optimal selection - bots above 1000 are very intelligent
 */
function calculateOptimalChance(rating: number): number {
  const r = Math.max(1000, Math.min(1800, rating));
  return Math.max(0.60, Math.min(0.99, 0.60 + (r - 1000) * 0.0004875));
}

// ============================================================
// BOT STATE TRACKING
// ============================================================

interface BotMatchState {
  botPlayerId: number;
  botRating: number;
  mistakeMade: boolean;
  cellsCompleted: Set<string>;
  moveTimer: NodeJS.Timeout | null;
  streakState: {
    isHotStreak: boolean;
    isColdStreak: boolean;
    streakMovesRemaining: number;
  };
}

const activeBots = new Map<number, NodeJS.Timeout>(); // matchId → timeout handle
const botStreaks = new Map<number, BotMatchState['streakState']>(); // matchId → streak state
const botMatchStates = new Map<number, BotMatchState>(); // matchId → bot state

// ============================================================
// PUBLIC API
// ============================================================

export interface BotInfo {
  playerId: number;
  displayName: string;
  rating: number;
  rd: number;
  volatility: number;
}

/**
 * Find a bot within ±50 rating of target, fallback to closest
 */
export async function findBotNearRating(targetRating: number): Promise<BotInfo | null> {
  // First try: find bot within ±50 rating
  let result = await query(
    `SELECT pp.id as player_id, pp.display_name, pr.rating, pr.rd, pr.volatility
     FROM player_profiles pp
     JOIN player_ratings pr ON pr.player_id = pp.id
     WHERE pp.is_bot = TRUE
       AND pr.ladder_id = 1
       AND pr.rating BETWEEN $1 AND $2
     ORDER BY ABS(pr.rating - $3) ASC
     LIMIT 1`,
    [targetRating - 50, targetRating + 50, targetRating]
  );

  if (result.rows.length > 0) {
    const bot = result.rows[0];
    return {
      playerId: bot.player_id,
      displayName: bot.display_name,
      rating: bot.rating,
      rd: bot.rd,
      volatility: bot.volatility,
    };
  }

  // Fallback: find closest bot
  result = await query(
    `SELECT pp.id as player_id, pp.display_name, pr.rating, pr.rd, pr.volatility
     FROM player_profiles pp
     JOIN player_ratings pr ON pr.player_id = pp.id
     WHERE pp.is_bot = TRUE
       AND pr.ladder_id = 1
     ORDER BY ABS(pr.rating - $1) ASC
     LIMIT 1`,
    [targetRating]
  );

  if (result.rows.length > 0) {
    const bot = result.rows[0];
    return {
      playerId: bot.player_id,
      displayName: bot.display_name,
      rating: bot.rating,
      rd: bot.rd,
      volatility: bot.volatility,
    };
  }

  return null;
}

/**
 * Check if a player_id is a bot
 */
export async function isBot(playerId: number): Promise<boolean> {
  const result = await query(
    `SELECT is_bot FROM player_profiles WHERE id = $1`,
    [playerId]
  );
  return result.rows[0]?.is_bot === true;
}

/**
 * Start the bot's move loop for a match
 */
export function startBotLoop(
  matchId: number,
  botPlayerId: number,
  botRating: number,
  onBotMove: (matchId: number, botPlayerId: number, row: number, col: number, value: number) => void,
  onGameEnd: () => void
): void {
  const baseTime = calculateBaseTime(botRating);
  console.log(`🤖 Starting bot loop for match ${matchId}, bot ${botPlayerId} (rating: ${Math.round(botRating)}, baseTime: ${baseTime.toFixed(3)}s)`);

  // Initialize bot state
  botMatchStates.set(matchId, {
    botPlayerId,
    botRating,
    mistakeMade: false,
    cellsCompleted: new Set(),
    moveTimer: null,
    streakState: {
      isHotStreak: false,
      isColdStreak: false,
      streakMovesRemaining: 0,
    },
  });

  // Initialize streak state
  botStreaks.set(matchId, {
    isHotStreak: false,
    isColdStreak: false,
    streakMovesRemaining: 0,
  });

  // Start the move loop
  scheduleNextMove(matchId, onBotMove, onGameEnd);
}

/**
 * Stop the bot loop (cleanup)
 */
export function stopBotLoop(matchId: number): void {
  console.log(`🤖 Stopping bot loop for match ${matchId}`);
  
  const timeout = activeBots.get(matchId);
  if (timeout) {
    clearTimeout(timeout);
    activeBots.delete(matchId);
  }

  const state = botMatchStates.get(matchId);
  if (state?.moveTimer) {
    clearTimeout(state.moveTimer);
  }

  botMatchStates.delete(matchId);
  botStreaks.delete(matchId);
}

/**
 * Select which cell to fill and what value (correct or mistake)
 */
export function selectMove(
  initialGrid: number[][],
  solutionGrid: number[][],
  botGrid: number[][],
  mistakeRate: number,
  optimalChance: number
): { row: number; col: number; value: number } | null {
  // Find all empty cells (not initial clues, not already filled)
  const emptyCells: Array<{ row: number; col: number; candidates: number }> = [];

  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      // Skip initial clues
      if (initialGrid[row][col] !== 0) continue;
      
      // Skip already filled cells
      if (botGrid[row][col] !== 0) continue;

      // Count valid candidates for this cell
      const candidates = getCandidates(botGrid, initialGrid, row, col);
      emptyCells.push({ row, col, candidates: candidates.length });
    }
  }

  if (emptyCells.length === 0) return null;

  // ALWAYS prioritize forced moves (1 candidate) - highest intelligence move
  // Forced moves are ALWAYS correct (no mistakes on obvious moves)
  const forcedMoves = emptyCells.filter(c => c.candidates === 1);
  if (forcedMoves.length > 0) {
    // Always pick forced moves correctly if available (highest priority, regardless of optimalChance)
    const forcedCell = forcedMoves[Math.floor(Math.random() * forcedMoves.length)];
    return {
      row: forcedCell.row,
      col: forcedCell.col,
      value: solutionGrid[forcedCell.row][forcedCell.col] // Always correct for forced moves
    };
  }

  // Sort by candidate count (fewest first)
  emptyCells.sort((a, b) => a.candidates - b.candidates);
  const minCandidates = emptyCells[0].candidates;
  
  // Decide: optimal (fewest candidates) or random
  let selectedCell: { row: number; col: number };
  
  if (Math.random() < optimalChance) {
    // Optimal: pick from cells with fewest candidates
    const optimalCells = emptyCells.filter(c => c.candidates === minCandidates);
    selectedCell = optimalCells[Math.floor(Math.random() * optimalCells.length)];
  } else {
    // Random: pick any empty cell (only happens rarely for lower-rated bots)
    selectedCell = emptyCells[Math.floor(Math.random() * emptyCells.length)];
  }

  const { row, col } = selectedCell;
  const correctValue = solutionGrid[row][col];

  // Decide: mistake or correct (but never make mistakes on cells with 2 candidates for high-rated bots)
  const cellCandidates = emptyCells.find(c => c.row === row && c.col === col)?.candidates || 9;
  
  // High-rated bots (1500+) should never make mistakes on cells with 2 or fewer candidates
  const shouldMakeMistake = cellCandidates > 2 && Math.random() < mistakeRate;
  
  if (shouldMakeMistake) {
    // Make a mistake: pick wrong value (1-9, excluding correct)
    const wrongValues = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter(v => v !== correctValue);
    const wrongValue = wrongValues[Math.floor(Math.random() * wrongValues.length)];
    return { row, col, value: wrongValue };
  } else {
    // Correct move
    return { row, col, value: correctValue };
  }
}

/**
 * Get valid candidates for a cell (basic sudoku constraint checking)
 */
export function getCandidates(
  grid: number[][],
  initialGrid: number[][],
  row: number,
  col: number
): number[] {
  const candidates: number[] = [];
  const used = new Set<number>();

  // Check row
  for (let c = 0; c < 9; c++) {
    const val = grid[row][c] || initialGrid[row][c] || 0;
    if (val !== 0) used.add(val);
  }

  // Check column
  for (let r = 0; r < 9; r++) {
    const val = grid[r][col] || initialGrid[r][col] || 0;
    if (val !== 0) used.add(val);
  }

  // Check 3x3 box
  const boxRow = Math.floor(row / 3) * 3;
  const boxCol = Math.floor(col / 3) * 3;
  for (let r = boxRow; r < boxRow + 3; r++) {
    for (let c = boxCol; c < boxCol + 3; c++) {
      const val = grid[r][c] || initialGrid[r][c] || 0;
      if (val !== 0) used.add(val);
    }
  }

  // Return numbers 1-9 that aren't used
  for (let i = 1; i <= 9; i++) {
    if (!used.has(i)) {
      candidates.push(i);
    }
  }

  return candidates;
}

// ============================================================
// INTERNAL BOT LOOP LOGIC
// ============================================================

function scheduleNextMove(
  matchId: number,
  onBotMove: (matchId: number, botPlayerId: number, row: number, col: number, value: number) => void,
  onGameEnd: () => void
): void {
  const state = botMatchStates.get(matchId);
  if (!state) return;

  const game = GameStateManager.getGame(matchId);
  if (!game || game.status !== 'IN_PROGRESS') {
    stopBotLoop(matchId);
    return;
  }

  // Determine which player is the bot
  const botPlayer = game.player1.playerId === state.botPlayerId ? game.player1 : game.player2;
  
  // Don't make moves if bot is locked or solved
  if (botPlayer.isLocked || botPlayer.isSolved) {
    console.log(`🤖 Bot ${state.botPlayerId} is locked or solved, stopping loop`);
    stopBotLoop(matchId);
    return;
  }

  // Check if opponent has already won
  const opponent = botPlayer === game.player1 ? game.player2 : game.player1;
  if (opponent.isSolved) {
    console.log(`🤖 Opponent already won, stopping bot loop`);
    stopBotLoop(matchId);
    return;
  }

  // Calculate delay with streak modifiers and variance
  const baseTime = calculateBaseTime(state.botRating);
  let delaySeconds = baseTime;
  
  // Debug logging for timing issues
  if (state.botRating >= 1500) {
    console.log(`🤖 Bot timing: rating=${Math.round(state.botRating)}, baseTime=${baseTime.toFixed(2)}s`);
  }

  // Apply streak modifiers
  const streakState = botStreaks.get(matchId);
  if (streakState) {
      if (streakState.isHotStreak && streakState.streakMovesRemaining > 0) {
        delaySeconds = baseTime * 0.3; // 30% of base time (extremely fast hot streaks)
      streakState.streakMovesRemaining--;
      if (streakState.streakMovesRemaining === 0) {
        streakState.isHotStreak = false;
      }
    } else if (streakState.isColdStreak && streakState.streakMovesRemaining > 0) {
      delaySeconds = baseTime * 1.3; // 130% of base time (reduced from 1.5x)
      streakState.streakMovesRemaining--;
      if (streakState.streakMovesRemaining === 0) {
        streakState.isColdStreak = false;
      }
    } else {
      // Check for new streak
      if (Math.random() < 0.25) {
        // Hot streak: 25% chance (more frequent fast moves for competitive bots)
        streakState.isHotStreak = true;
        streakState.streakMovesRemaining = 3 + Math.floor(Math.random() * 3); // 3-5 moves
        delaySeconds = baseTime * 0.3; // 30% of base time (extremely fast hot streaks)
      } else if (Math.random() < 0.03) {
        // Cold streak: 3% chance (very rare - bots should be fast)
        streakState.isColdStreak = true;
        streakState.streakMovesRemaining = 2 + Math.floor(Math.random() * 2); // 2-3 moves
        delaySeconds = baseTime * 1.2; // Reduced from 1.3x
      }
    }
  }

  // Apply ±3% variance (extremely tight for consistent, fast gameplay)
  delaySeconds = delaySeconds * (0.97 + Math.random() * 0.06);
  const delayMs = Math.max(20, Math.round(delaySeconds * 1000)); // Minimum 0.02 seconds
  
  // Debug logging for high-rated bots
  if (state.botRating >= 1500) {
    console.log(`🤖 Bot delay: ${delayMs}ms (${(delayMs/1000).toFixed(2)}s) for rating ${Math.round(state.botRating)}`);
  }

  // Schedule the move
  console.log(`🤖 [MATCH ${matchId}] Scheduling bot move: delay=${delayMs}ms (${(delayMs/1000).toFixed(2)}s), rating=${Math.round(state.botRating)}, baseTime=${baseTime.toFixed(2)}s`);
  const timer = setTimeout(() => {
    console.log(`🤖 [MATCH ${matchId}] Bot move timer fired, executing move`);
    makeBotMove(matchId, onBotMove, onGameEnd);
  }, delayMs);

  activeBots.set(matchId, timer);
  if (state) {
    state.moveTimer = timer;
  }
}

function makeBotMove(
  matchId: number,
  onBotMove: (matchId: number, botPlayerId: number, row: number, col: number, value: number) => void,
  onGameEnd: () => void
): void {
  const startTime = Date.now();
  console.log(`🤖 [MATCH ${matchId}] makeBotMove called at ${startTime}`);
  const state = botMatchStates.get(matchId);
  if (!state) return;

  const game = GameStateManager.getGame(matchId);
  if (!game || game.status !== 'IN_PROGRESS') {
    stopBotLoop(matchId);
    return;
  }

  const botPlayer = game.player1.playerId === state.botPlayerId ? game.player1 : game.player2;
  
  if (botPlayer.isLocked || botPlayer.isSolved) {
    stopBotLoop(matchId);
    return;
  }

  // Calculate move parameters
  const mistakeRate = calculateMistakeRate(state.botRating);
  const optimalChance = calculateOptimalChance(state.botRating);

  // Select move
  const move = selectMove(
    game.initialGrid,
    game.solutionGrid,
    botPlayer.grid,
    mistakeRate,
    optimalChance
  );

  if (move) {
    const totalTime = Date.now() - startTime;
    console.log(`🤖 Bot making move in match ${matchId}: row=${move.row}, col=${move.col}, value=${move.value}, isMistake=${move.value !== game.solutionGrid[move.row][move.col]}, totalTime=${totalTime}ms`);
    onBotMove(matchId, state.botPlayerId, move.row, move.col, move.value);
    
    // Schedule next move
    scheduleNextMove(matchId, onBotMove, onGameEnd);
  } else {
    console.log(`🤖 [MATCH ${matchId}] No valid move found for bot`);
    stopBotLoop(matchId);
  }
}

// ============================================================
// LEGACY FUNCTIONS (for first-time player matches)
// ============================================================

export interface BotPlayer {
  id: string;
  displayName: string;
  rating: number;
  isPremium: boolean;
  isBot: true;
}

export function createBotPlayer(): BotPlayer {
  return {
    id: 'bot-' + crypto.randomUUID(),
    displayName: LEGACY_BOT_CONFIG.name,
    rating: LEGACY_BOT_CONFIG.displayRating,
    isPremium: false,
    isBot: true,
  };
}

export function initBotState(matchId: number): void {
  botMatchStates.set(matchId, {
    botPlayerId: -1, // Legacy bot uses -1
    botRating: LEGACY_BOT_CONFIG.displayRating,
    mistakeMade: false,
    cellsCompleted: new Set(),
    moveTimer: null,
    streakState: {
      isHotStreak: false,
      isColdStreak: false,
      streakMovesRemaining: 0,
    },
  });
}

export function cleanupBotState(matchId: number): void {
  stopBotLoop(matchId);
}

export function getBotState(matchId: number) {
  return botMatchStates.get(matchId);
}

export function calculateNextBotMove(
  matchId: number,
  solution: number[][],
  currentGrid: number[][],
  elapsedMs: number
): { row: number; col: number; value: number; isMistake: boolean } | null {
  const state = botMatchStates.get(matchId);
  if (!state) return null;

  // Find all empty cells
  const availableCells: { row: number; col: number }[] = [];
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      const key = `${row}-${col}`;
      if (currentGrid[row][col] === 0 && !state.cellsCompleted.has(key)) {
        availableCells.push({ row, col });
      }
    }
  }

  if (availableCells.length === 0) return null;

  const randomIndex = Math.floor(Math.random() * availableCells.length);
  const { row, col } = availableCells[randomIndex];

  // Check if bot should make a mistake (once, around 2 min mark)
  const shouldMakeMistake = !state.mistakeMade &&
    elapsedMs >= LEGACY_BOT_CONFIG.mistakeTimeMin &&
    elapsedMs < LEGACY_BOT_CONFIG.mistakeTimeMax;

  if (shouldMakeMistake) {
    state.mistakeMade = true;
    const correctValue = solution[row][col];
    const wrongValue = (correctValue % 9) + 1;
    return { row, col, value: wrongValue, isMistake: true };
  }

  state.cellsCompleted.add(`${row}-${col}`);
  return { row, col, value: solution[row][col], isMistake: false };
}

export function getBotMoveDelay(): number {
  return LEGACY_BOT_CONFIG.moveInterval;
}

export function setBotMoveTimer(matchId: number, timer: NodeJS.Timeout): void {
  const state = botMatchStates.get(matchId);
  if (state) {
    state.moveTimer = timer;
  }
}

export function getBotDisplayName(): string {
  return LEGACY_BOT_CONFIG.name;
}

export function getBotDisplayRating(): number {
  return LEGACY_BOT_CONFIG.displayRating;
}
