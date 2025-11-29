// =====================================================
// SHARED CONSTANTS
// =====================================================

export const DEFAULT_RATING = 1500;
export const DEFAULT_RD = 350;
export const DEFAULT_VOLATILITY = 0.06;

export const GLICKO2_TAU = 0.5; // System constant

export const MATCH_RESULT_CODES = {
  PLAYER1_WIN: 1,
  PLAYER2_WIN: 2,
  DRAW: 3,
  ABORTED_UNRATED: 4,
} as const;

export const SUDOKU_GRID_SIZE = 9;
export const SUDOKU_BOX_SIZE = 3;

export const MAX_LIVES = 3;
export const TIME_PENALTY_PER_MISTAKE_SECONDS = 10;

export const MATCHMAKING_RATING_WINDOW = 200; // ± rating difference for matching
