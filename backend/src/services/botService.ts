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
 * Uses a linear scale for human-like timing:
 * - Rating 1000 → 9 seconds (beginner, slow and methodical)
 * - Rating 1200 → 7.2 seconds
 * - Rating 1400 → 5.4 seconds  
 * - Rating 1500 → 4.5 seconds (average player)
 * - Rating 1600 → 3.6 seconds (good player)
 * - Rating 1800 → 2 seconds (expert, fast but still human-like)
 */
function calculateBaseTime(rating: number): number {
  const r = Math.max(1000, Math.min(1800, rating));
  // Linear formula: 9s at 1000, 2s at 1800
  // Decrease of 7s over 800 rating points = 0.00875s per rating point
  const baseTime = 9 - (r - 1000) * 0.00875;
  return Math.max(2, baseTime);
}

/**
 * Calculate mistake rate based on rating
 * - Rating 1000 → 25% (makes frequent mistakes)
 * - Rating 1200 → 19% 
 * - Rating 1400 → 13%
 * - Rating 1500 → 10% (occasional mistakes)
 * - Rating 1600 → 7%
 * - Rating 1800 → 3% (rarely makes mistakes)
 */
function calculateMistakeRate(rating: number): number {
  const r = Math.max(1000, Math.min(1800, rating));
  // Linear: 25% at 1000, 3% at 1800
  return Math.max(0.03, 0.25 - (r - 1000) * 0.000275);
}

/**
 * Calculate optimal cell selection chance based on rating
 * - Rating 1000 → 40% (often picks random cells)
 * - Rating 1200 → 51%
 * - Rating 1400 → 62%
 * - Rating 1500 → 68% (usually decent choices)
 * - Rating 1600 → 73%
 * - Rating 1800 → 85% (usually optimal)
 */
function calculateOptimalChance(rating: number): number {
  const r = Math.max(1000, Math.min(1800, rating));
  // Linear: 40% at 1000, 85% at 1800
  return Math.min(0.85, 0.40 + (r - 1000) * 0.0005625);
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
 * Find a bot within ±50 rating of target, fallback to wider search
 */
export async function findBotNearRating(targetRating: number): Promise<BotInfo | null> {
  console.log(`🤖 Finding bot near rating ${Math.round(targetRating)}...`);
  
  // First try: find bots within ±50 rating, then randomize selection
  let result = await query(
    `SELECT pp.id as player_id, pp.display_name, pr.rating, pr.rd, pr.volatility
     FROM player_profiles pp
     JOIN player_ratings pr ON pr.player_id = pp.id
     WHERE pp.is_bot = TRUE
       AND pr.ladder_id = 1
       AND pr.rating BETWEEN $1 AND $2
     ORDER BY RANDOM()`,
    [targetRating - 50, targetRating + 50]
  );

  if (result.rows.length > 0) {
    const bot = result.rows[0]; // Already randomized by ORDER BY RANDOM()
    console.log(`🤖 Selected bot from ${result.rows.length} available bots (rating range ${Math.round(targetRating - 50)}-${Math.round(targetRating + 50)}): bot ${bot.player_id} "${bot.display_name}" with rating ${Math.round(bot.rating)}`);
    return {
      playerId: bot.player_id,
      displayName: bot.display_name,
      rating: bot.rating,
      rd: bot.rd,
      volatility: bot.volatility,
    };
  }

  // Second try: widen to ±200 rating
  result = await query(
    `SELECT pp.id as player_id, pp.display_name, pr.rating, pr.rd, pr.volatility
     FROM player_profiles pp
     JOIN player_ratings pr ON pr.player_id = pp.id
     WHERE pp.is_bot = TRUE
       AND pr.ladder_id = 1
       AND pr.rating BETWEEN $1 AND $2
     ORDER BY RANDOM()`,
    [targetRating - 200, targetRating + 200]
  );

  if (result.rows.length > 0) {
    const bot = result.rows[0];
    console.log(`🤖 Selected bot from ${result.rows.length} bots (wider range ${Math.round(targetRating - 200)}-${Math.round(targetRating + 200)}): bot ${bot.player_id} "${bot.display_name}" with rating ${Math.round(bot.rating)}`);
    return {
      playerId: bot.player_id,
      displayName: bot.display_name,
      rating: bot.rating,
      rd: bot.rd,
      volatility: bot.volatility,
    };
  }

  // Fallback: find ANY bot, randomized
  result = await query(
    `SELECT pp.id as player_id, pp.display_name, pr.rating, pr.rd, pr.volatility
     FROM player_profiles pp
     JOIN player_ratings pr ON pr.player_id = pp.id
     WHERE pp.is_bot = TRUE
       AND pr.ladder_id = 1
     ORDER BY RANDOM()
     LIMIT 1`,
    []
  );

  if (result.rows.length > 0) {
    const bot = result.rows[0];
    console.log(`🤖 Selected random bot (fallback): bot ${bot.player_id} "${bot.display_name}" with rating ${Math.round(bot.rating)}`);
    return {
      playerId: bot.player_id,
      displayName: bot.display_name,
      rating: bot.rating,
      rd: bot.rd,
      volatility: bot.volatility,
    };
  }

  console.error(`❌ No bots found in database!`);
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

// Initial delay before bot starts making moves (3 seconds)
const BOT_INITIAL_DELAY = 3000;

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

  // Add initial delay before first move (3 seconds)
  // This prevents bot from scoring immediately when the game starts
  const initialDelay = BOT_INITIAL_DELAY;
  console.log(`🤖 Bot will start playing after ${(initialDelay/1000).toFixed(1)}s initial delay`);
  
  const initialTimer = setTimeout(() => {
    // Start the move loop after initial delay
    scheduleNextMove(matchId, onBotMove, onGameEnd);
  }, initialDelay);
  
  activeBots.set(matchId, initialTimer);
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
  
  // Debug logging
  console.log(`🤖 Bot timing: rating=${Math.round(state.botRating)}, baseTime=${baseTime.toFixed(2)}s`);

  // Apply streak modifiers for more human-like behavior
  const streakState = botStreaks.get(matchId);
  if (streakState) {
      if (streakState.isHotStreak && streakState.streakMovesRemaining > 0) {
        delaySeconds = baseTime * 0.6; // 60% of base time (noticeably faster)
      streakState.streakMovesRemaining--;
      if (streakState.streakMovesRemaining === 0) {
        streakState.isHotStreak = false;
      }
    } else if (streakState.isColdStreak && streakState.streakMovesRemaining > 0) {
      delaySeconds = baseTime * 1.5; // 150% of base time (thinking harder)
      streakState.streakMovesRemaining--;
      if (streakState.streakMovesRemaining === 0) {
        streakState.isColdStreak = false;
      }
    } else {
      // Check for new streak
      if (Math.random() < 0.12) {
        // Hot streak: 12% chance (occasional burst of quick moves)
        streakState.isHotStreak = true;
        streakState.streakMovesRemaining = 2 + Math.floor(Math.random() * 3); // 2-4 moves
        delaySeconds = baseTime * 0.6; // 60% of base time
      } else if (Math.random() < 0.10) {
        // Cold streak: 10% chance (pausing to think)
        streakState.isColdStreak = true;
        streakState.streakMovesRemaining = 2 + Math.floor(Math.random() * 2); // 2-3 moves
        delaySeconds = baseTime * 1.5; // 150% of base time
      }
    }
  }

  // Apply ±25% variance for natural human-like timing variation
  delaySeconds = delaySeconds * (0.75 + Math.random() * 0.50);
  const delayMs = Math.max(500, Math.round(delaySeconds * 1000)); // Minimum 0.5 seconds

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
    console.log(`🤖 [MATCH ${matchId}] Game not in progress, stopping bot`);
    stopBotLoop(matchId);
    return;
  }

  const botPlayer = game.player1.playerId === state.botPlayerId ? game.player1 : game.player2;
  const opponent = botPlayer === game.player1 ? game.player2 : game.player1;
  
  // CRITICAL: Check if opponent has already won (solved puzzle or surpassed score while bot locked)
  if (opponent.isSolved) {
    console.log(`🤖 [MATCH ${matchId}] Opponent already solved puzzle, stopping bot`);
    stopBotLoop(matchId);
    return;
  }
  
  if (botPlayer.isLocked || botPlayer.isSolved) {
    console.log(`🤖 [MATCH ${matchId}] Bot is locked or solved, stopping`);
    stopBotLoop(matchId);
    return;
  }
  
  // Also check if opponent has surpassed bot's score while bot is locked
  if (botPlayer.isLocked && opponent.score > botPlayer.score) {
    console.log(`🤖 [MATCH ${matchId}] Bot locked and opponent ahead, stopping`);
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
