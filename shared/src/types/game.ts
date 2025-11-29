// =====================================================
// GAME LOGIC TYPES
// =====================================================

export type SudokuGrid = number[][]; // 9x9 array, 0 = empty

export interface CellPosition {
  row: number;
  col: number;
}

export interface MoveEvent {
  type: 'PLACE_NUMBER' | 'ERASE' | 'TOGGLE_NOTES';
  position: CellPosition;
  value?: number;
  notes?: number[];
}

export interface MoveResult {
  success: boolean;
  correct?: boolean;
  lives_remaining?: number;
  cells_completed?: number;
  error?: string;
}

export interface GameEndCondition {
  type: 'PUZZLE_SOLVED' | 'TIMEOUT' | 'LOCKED_OUT' | 'OPPONENT_DISCONNECTED';
  winner_slot: 1 | 2 | null; // null = draw
}
