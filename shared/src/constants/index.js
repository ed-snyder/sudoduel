"use strict";
// =====================================================
// SHARED CONSTANTS
// =====================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.MATCHMAKING_RATING_WINDOW = exports.TIME_PENALTY_PER_MISTAKE_SECONDS = exports.MAX_LIVES = exports.SUDOKU_BOX_SIZE = exports.SUDOKU_GRID_SIZE = exports.MATCH_RESULT_CODES = exports.GLICKO2_TAU = exports.DEFAULT_VOLATILITY = exports.DEFAULT_RD = exports.DEFAULT_RATING = void 0;
exports.DEFAULT_RATING = 1500;
exports.DEFAULT_RD = 350;
exports.DEFAULT_VOLATILITY = 0.06;
exports.GLICKO2_TAU = 0.5; // System constant
exports.MATCH_RESULT_CODES = {
    PLAYER1_WIN: 1,
    PLAYER2_WIN: 2,
    DRAW: 3,
    ABORTED_UNRATED: 4,
};
exports.SUDOKU_GRID_SIZE = 9;
exports.SUDOKU_BOX_SIZE = 3;
exports.MAX_LIVES = 3;
exports.TIME_PENALTY_PER_MISTAKE_SECONDS = 10;
exports.MATCHMAKING_RATING_WINDOW = 200; // ± rating difference for matching
//# sourceMappingURL=index.js.map