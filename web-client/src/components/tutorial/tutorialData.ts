// Fully solved grid for Sudoku rules explanation phases
export const SOLVED_DEMO_GRID: number[][] = [
  [5, 3, 4, 6, 7, 8, 9, 1, 2],
  [6, 7, 2, 1, 9, 5, 3, 4, 8],
  [1, 9, 8, 3, 4, 2, 5, 6, 7],
  [8, 5, 9, 7, 6, 1, 4, 2, 3],
  [4, 2, 6, 8, 5, 3, 7, 9, 1],
  [7, 1, 3, 9, 2, 4, 8, 5, 6],
  [9, 6, 1, 5, 3, 7, 2, 8, 4],
  [2, 8, 7, 4, 1, 9, 6, 3, 5],
  [3, 4, 5, 2, 8, 6, 1, 7, 9],
];

// Tutorial puzzle grid - nearly complete with strategic empty cells
export const TUTORIAL_GRID: number[][] = [
  [5, 3, 4, 6, 7, 8, 9, 1, 2],
  [6, 7, 2, 1, 9, 5, 3, 4, 8],
  [1, 9, 8, 3, 4, 2, 5, 6, 7],
  [8, 5, 9, 7, 6, 1, 0, 2, 3],  // Empty cell at [3][6] = 4
  [4, 2, 6, 8, 5, 3, 7, 9, 1],
  [7, 1, 3, 9, 2, 0, 8, 5, 6],  // Empty cell at [5][5] = 4 (for mistake demo)
  [9, 6, 1, 5, 3, 7, 2, 8, 4],
  [0, 8, 7, 4, 1, 9, 6, 3, 5],  // Empty cell at [7][0] = 2
  [3, 4, 5, 2, 8, 6, 1, 7, 0],  // Empty cell at [8][8] = 9
];

// Solution grid
export const TUTORIAL_SOLUTION: number[][] = [
  [5, 3, 4, 6, 7, 8, 9, 1, 2],
  [6, 7, 2, 1, 9, 5, 3, 4, 8],
  [1, 9, 8, 3, 4, 2, 5, 6, 7],
  [8, 5, 9, 7, 6, 1, 4, 2, 3],
  [4, 2, 6, 8, 5, 3, 7, 9, 1],
  [7, 1, 3, 9, 2, 4, 8, 5, 6],
  [9, 6, 1, 5, 3, 7, 2, 8, 4],
  [2, 8, 7, 4, 1, 9, 6, 3, 5],
  [3, 4, 5, 2, 8, 6, 1, 7, 9],
];

// Initial grid (what cells are pre-filled) - same as TUTORIAL_GRID
export const TUTORIAL_INITIAL_GRID: number[][] = TUTORIAL_GRID.map(row => [...row]);

// Specific cells for tutorial phases
export const TUTORIAL_CELLS = {
  firstCell: { row: 3, col: 6, answer: 4 },
  practiceCell1: { row: 7, col: 0, answer: 2 },
  practiceCell2: { row: 8, col: 8, answer: 9 },
  mistakeCell: { row: 5, col: 5, answer: 4, wrongAnswer: 7 },
};

// Tutorial phases in order
export type TutorialPhase =
  | 'intro'
  | 'sudoku-rules-grid'      // NEW - The goal
  | 'sudoku-rules-rows'      // NEW - Rows & columns
  | 'sudoku-rules-boxes'     // NEW - 3x3 boxes
  | 'sudoku-rules-practice'  // NEW - Transition to practice
  | 'tap-cell'
  | 'enter-number'
  | 'correct-feedback'
  | 'practice-more'
  | 'force-mistake'
  | 'mistake-feedback'
  | 'timer-explanation'
  | 'lockout-demo'
  | 'opponent-intro'
  | 'opponent-progress-demo'
  | 'win-conditions'
  | 'tools-emotes'
  | 'skill-selection'
  | 'ready';

// All phases in order for progress tracking
export const TUTORIAL_PHASES: TutorialPhase[] = [
  'intro',
  'sudoku-rules-grid',
  'sudoku-rules-rows',
  'sudoku-rules-boxes',
  'sudoku-rules-practice',
  'tap-cell',
  'enter-number',
  'correct-feedback',
  'practice-more',
  'force-mistake',
  'mistake-feedback',
  'timer-explanation',
  'lockout-demo',
  'opponent-intro',
  'opponent-progress-demo',
  'win-conditions',
  'tools-emotes',
  'skill-selection',
  'ready',
];

// Get phase index for progress calculation
export function getPhaseIndex(phase: TutorialPhase): number {
  return TUTORIAL_PHASES.indexOf(phase);
}

// Get total number of phases
export function getTotalPhases(): number {
  return TUTORIAL_PHASES.length;
}

