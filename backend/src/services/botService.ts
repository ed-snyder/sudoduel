/**
 * Bot Service - Manages bot behavior for first-time player matches
 * 
 * Bot Behavior:
 * - Answers one cell correctly every 20 seconds (fixed)
 * - Makes 1 intentional mistake around the 2-minute mark
 * - Maximum ~15 cells completed in a 5-minute game
 * - Any new player should win very comfortably
 */

// Bot configuration
const BOT_CONFIG = {
  name: 'SudoBot',
  displayRating: 800,
  moveInterval: 20000,     // Fixed 20 seconds between moves
  mistakeTimeMin: 110000,  // Make mistake between 110-130 seconds into game
  mistakeTimeMax: 130000,
};

// Track bot state per match (to handle mistake timing)
const botMatchStates = new Map<number, {
  mistakeMade: boolean;
  cellsCompleted: Set<string>;
  moveTimer: NodeJS.Timeout | null;
}>();

export interface BotPlayer {
  id: string;
  displayName: string;
  rating: number;
  isPremium: boolean;
  isBot: true;
}

/**
 * Create a bot player object
 */
export function createBotPlayer(): BotPlayer {
  return {
    id: 'bot-' + crypto.randomUUID(),
    displayName: BOT_CONFIG.name,
    rating: BOT_CONFIG.displayRating,
    isPremium: false,
    isBot: true,
  };
}

/**
 * Initialize bot state for a match
 */
export function initBotState(matchId: number): void {
  botMatchStates.set(matchId, {
    mistakeMade: false,
    cellsCompleted: new Set(),
    moveTimer: null,
  });
}

/**
 * Clean up bot state for a match
 */
export function cleanupBotState(matchId: number): void {
  const state = botMatchStates.get(matchId);
  if (state?.moveTimer) {
    clearTimeout(state.moveTimer);
  }
  botMatchStates.delete(matchId);
}

/**
 * Get bot state for a match
 */
export function getBotState(matchId: number) {
  return botMatchStates.get(matchId);
}

/**
 * Calculate the next bot move
 * Returns null if no valid moves available
 */
export function calculateNextBotMove(
  matchId: number,
  solution: number[][],
  currentGrid: number[][],
  elapsedMs: number
): { row: number; col: number; value: number; isMistake: boolean } | null {
  const state = botMatchStates.get(matchId);
  if (!state) return null;

  // Find all empty cells the bot hasn't filled
  const availableCells: { row: number; col: number }[] = [];
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      const key = `${row}-${col}`;
      // Check if cell is empty (0) and bot hasn't already placed there
      if (currentGrid[row][col] === 0 && !state.cellsCompleted.has(key)) {
        availableCells.push({ row, col });
      }
    }
  }

  if (availableCells.length === 0) return null;

  // Pick a random available cell
  const randomIndex = Math.floor(Math.random() * availableCells.length);
  const { row, col } = availableCells[randomIndex];

  // Check if bot should make a mistake (once, around 2 min mark)
  const shouldMakeMistake = !state.mistakeMade &&
    elapsedMs >= BOT_CONFIG.mistakeTimeMin &&
    elapsedMs < BOT_CONFIG.mistakeTimeMax;

  if (shouldMakeMistake) {
    state.mistakeMade = true;
    // Return wrong answer (correct + 1, wrap around 1-9)
    const correctValue = solution[row][col];
    const wrongValue = (correctValue % 9) + 1;
    return { row, col, value: wrongValue, isMistake: true };
  }

  // Mark cell as completed by bot
  state.cellsCompleted.add(`${row}-${col}`);

  // Return correct answer
  return { row, col, value: solution[row][col], isMistake: false };
}

/**
 * Get delay for next bot move (fixed 20 seconds)
 */
export function getBotMoveDelay(): number {
  return BOT_CONFIG.moveInterval;
}

/**
 * Store the move timer reference for a match
 */
export function setBotMoveTimer(matchId: number, timer: NodeJS.Timeout): void {
  const state = botMatchStates.get(matchId);
  if (state) {
    state.moveTimer = timer;
  }
}

/**
 * Get bot display name
 */
export function getBotDisplayName(): string {
  return BOT_CONFIG.name;
}

/**
 * Get bot display rating
 */
export function getBotDisplayRating(): number {
  return BOT_CONFIG.displayRating;
}
