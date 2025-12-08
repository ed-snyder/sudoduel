import { useState, useEffect, useRef, memo } from 'react';

interface SudokuGridProps {
  grid: number[][];
  initialGrid: number[][];
  selectedCell: { row: number; col: number } | null;
  onCellClick: (row: number, col: number) => void;
  notes?: Map<string, number[]>;
  notesMode?: boolean;
  lockedOut?: boolean;
  lastMoveResult?: { row: number; col: number; correct: boolean } | null;
  opponentScoredCells?: Set<string>;
  lastScoredCell?: { row: number; col: number } | null;
  completedCells?: Set<string>;
  almostCompleteCells?: Set<string>;
  currentStreak?: number;
  erroredCells?: Set<string>;
}

interface FloatingFeedback {
  id: string;
  row: number;
  col: number;
  text: string;
  correct: boolean;
  streak?: number;
}

// Shared AudioContext for error sound - initialized on first user interaction
let errorAudioContext: AudioContext | null = null;
let errorAudioContextInitialized = false;

const initErrorAudioContext = () => {
  if (!errorAudioContextInitialized) {
    try {
      errorAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      errorAudioContextInitialized = true;
    } catch (error) {
      console.warn('Could not initialize error audio context:', error);
    }
  }
};

const playErrorSound = () => {
  try {
    if (!errorAudioContext) {
      initErrorAudioContext();
    }
    if (!errorAudioContext) return;
    
    // Resume if suspended
    if (errorAudioContext.state === 'suspended') {
      errorAudioContext.resume();
    }
    
    const oscillator = errorAudioContext.createOscillator();
    const gainNode = errorAudioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(errorAudioContext.destination);
    
    oscillator.frequency.setValueAtTime(150, errorAudioContext.currentTime);
    oscillator.type = 'square';
    
    gainNode.gain.setValueAtTime(0.3, errorAudioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, errorAudioContext.currentTime + 0.15);
    
    oscillator.start();
    oscillator.stop(errorAudioContext.currentTime + 0.15);
  } catch (error) {
    console.warn('Could not play error sound:', error);
  }
};

function SudokuGrid({
  grid,
  initialGrid,
  selectedCell,
  onCellClick,
  notes = new Map(),
  notesMode: _notesMode = false,
  lockedOut = false,
  lastMoveResult = null,
  opponentScoredCells = new Set(),
  lastScoredCell = null,
  completedCells = new Set(),
  almostCompleteCells = new Set(),
  currentStreak = 0,
  erroredCells = new Set(),
}: SudokuGridProps) {
  const renderStart = performance.now();
  console.log(`[PERF] SudokuGrid render START`);

  // Pre-initialize error audio context on first user interaction
  useEffect(() => {
    const initOnInteraction = () => {
      initErrorAudioContext();
      document.removeEventListener('touchstart', initOnInteraction);
      document.removeEventListener('click', initOnInteraction);
    };
    
    document.addEventListener('touchstart', initOnInteraction, { once: true });
    document.addEventListener('click', initOnInteraction, { once: true });
    
    return () => {
      document.removeEventListener('touchstart', initOnInteraction);
      document.removeEventListener('click', initOnInteraction);
    };
  }, []);
  const [floatingFeedbacks, setFloatingFeedbacks] = useState<FloatingFeedback[]>([]);
  const gridRef = useRef<HTMLDivElement>(null);
  const lastProcessedMoveRef = useRef<string | null>(null);
  
  const isInitialCell = (row: number, col: number) => initialGrid[row][col] !== 0;
  const isSelected = (row: number, col: number) => selectedCell?.row === row && selectedCell?.col === col;

  const selectedValue = selectedCell 
    ? (grid[selectedCell.row]?.[selectedCell.col] || null)
    : null;
  const hasSelectedValue = selectedValue !== null && selectedValue !== 0;

  const isSameBox = (row: number, col: number) => {
    if (!selectedCell || !hasSelectedValue) return false;
    if (row === selectedCell.row && col === selectedCell.col) return false;
    const boxRow = Math.floor(selectedCell.row / 3);
    const boxCol = Math.floor(selectedCell.col / 3);
    return Math.floor(row / 3) === boxRow && Math.floor(col / 3) === boxCol;
  };

  const isSameRowOrCol = (row: number, col: number) => {
    if (!selectedCell || !hasSelectedValue) return false;
    if (row === selectedCell.row && col === selectedCell.col) return false;
    return row === selectedCell.row || col === selectedCell.col;
  };

  const isSameNumberAsSelected = (row: number, col: number) => {
    if (!selectedCell || !hasSelectedValue) return false;
    if (row === selectedCell.row && col === selectedCell.col) return false;
    const cellValue = grid[row]?.[col];
    return cellValue === selectedValue;
  };

  const isErrorFlash = (row: number, col: number) => {
    return (
      lastMoveResult != null &&
      !lastMoveResult.correct &&
      lastMoveResult.row === row &&
      lastMoveResult.col === col
    );
  };

  useEffect(() => {
    if (!lastMoveResult) return;

    const effectStart = performance.now();
    console.log(`[PERF] useEffect lastMoveResult START: ${effectStart.toFixed(2)}ms`);

    const { row, col, correct } = lastMoveResult;
    
    // For correct moves, use moveId to prevent duplicates
    // For incorrect moves, always show feedback (use timestamp-based ID)
    const feedbackId = `${row}-${col}-${Date.now()}-${Math.random()}`;
    
    if (correct) {
      const moveId = `${row}-${col}-${correct}`;
      if (lastProcessedMoveRef.current === moveId) return;
      lastProcessedMoveRef.current = moveId;
    }
    // For incorrect moves, don't check lastProcessedMoveRef - always show feedback
    
    console.log(`[PERF] useEffect lastMoveResult - before feedback: ${(performance.now() - effectStart).toFixed(2)}ms`);
    
    if (correct) {
      setFloatingFeedbacks((prev) => [
        ...prev,
        { id: feedbackId, row, col, text: '+5s!', correct: true, streak: currentStreak },
      ]);
    } else {
      console.log(`[PERF] useEffect lastMoveResult - before playErrorSound: ${(performance.now() - effectStart).toFixed(2)}ms`);
      playErrorSound();
      console.log(`[PERF] useEffect lastMoveResult - after playErrorSound: ${(performance.now() - effectStart).toFixed(2)}ms`);
      if (navigator.vibrate) navigator.vibrate([50, 30, 50]);
      
      // Show "-30s" animation on EVERY incorrect guess
      setFloatingFeedbacks((prev) => [
        ...prev,
        { id: feedbackId, row, col, text: '-30s', correct: false },
      ]);
    }

    setTimeout(() => {
      setFloatingFeedbacks((prev) => prev.filter((f) => f.id !== feedbackId));
    }, 1000);
    
    console.log(`[PERF] useEffect lastMoveResult END: ${(performance.now() - effectStart).toFixed(2)}ms`);
  }, [lastMoveResult, currentStreak, erroredCells]);

  const getCellPosition = (row: number, col: number) => {
    const cellPercent = 100 / 9;
    return {
      left: col * cellPercent + cellPercent / 2,
      top: row * cellPercent + cellPercent / 2,
    };
  };

  const renderEnd = performance.now();
  const renderTime = renderEnd - renderStart;
  console.log(`[PERF] SudokuGrid render took: ${renderTime.toFixed(2)}ms`);
  
  // Track when grid changes (cell placement) actually commits to DOM
  const prevGridRef = useRef(grid);
  useEffect(() => {
    // Only track if grid actually changed (cell was placed)
    const gridChanged = prevGridRef.current !== grid;
    prevGridRef.current = grid;
    
    if (gridChanged) {
      const commitTime = performance.now();
      console.log(`[PERF] SudokuGrid GRID CHANGE COMMITTED to DOM: ${commitTime.toFixed(2)}ms (render started at ${renderStart.toFixed(2)}ms)`);
      
      // Measure paint time
      requestAnimationFrame(() => {
        const paintScheduled = performance.now();
        console.log(`[PERF] SudokuGrid GRID CHANGE paint SCHEDULED: ${paintScheduled.toFixed(2)}ms`);
        
        requestAnimationFrame(() => {
          const paintComplete = performance.now();
          console.log(`[PERF] SudokuGrid GRID CHANGE paint COMPLETE: ${paintComplete.toFixed(2)}ms (${(paintComplete - renderStart).toFixed(2)}ms from render start)`);
        });
      });
    }
  }, [grid, renderStart]);

  return (
    <div
      ref={gridRef}
      className="relative select-none"
      style={{
        zIndex: 10,
        aspectRatio: '1 / 1',
        width: '100%',
        maxWidth: 'min(100vw - 24px, 400px)',
        WebkitUserSelect: 'none',
        userSelect: 'none',
        WebkitTouchCallout: 'none',
      }}
    >
      {/* 9x9 Grid of cells - transparent backgrounds */}
      <div 
        className="absolute inset-0 grid grid-cols-9 grid-rows-9"
        style={{
          WebkitUserSelect: 'none',
          userSelect: 'none',
        }}
      >
        {grid.map((row, rowIndex) =>
          row.map((cell, colIndex) => {
            const isInitial = isInitialCell(rowIndex, colIndex);
            const selected = isSelected(rowIndex, colIndex);
            const related =
              !selected &&
              hasSelectedValue &&
              (isSameRowOrCol(rowIndex, colIndex) ||
                isSameBox(rowIndex, colIndex) ||
                isSameNumberAsSelected(rowIndex, colIndex));

            const cellKey = `${rowIndex}-${colIndex}`;
            const cellNotes = notes.get(cellKey) || [];
            const hasValue = cell !== 0;
            const showNotes = !hasValue && cellNotes.length > 0;
            const opponentScored = opponentScoredCells.has(cellKey) && !hasValue && !isInitial;
            const isJustScored = lastScoredCell?.row === rowIndex && lastScoredCell?.col === colIndex;
            const isCompleted = completedCells.has(cellKey);
            const isAlmostComplete = almostCompleteCells.has(cellKey);
            const isError = isErrorFlash(rowIndex, colIndex);

            // Cell background - transparent by default, bright cyan for selection
            // Priority: selected > almost-complete > highlighted > default
            let cellBg = 'transparent';
            let cellShadow = 'none';
            let cellClassName = '';
            let cellBorder = 'none';
            
            if (lockedOut) {
              cellBg = 'rgba(100, 100, 100, 0.2)';
            } else if (isError) {
              cellBg = 'rgba(255, 51, 102, 0.4)';
              cellShadow = 'inset 0 0 20px rgba(255, 51, 102, 0.6)';
            } else if (selected) {
              // Selected cell - highest priority
              cellBg = 'rgba(0, 255, 255, 0.35)';
              cellShadow = 'inset 0 0 20px rgba(0, 255, 255, 0.5), 0 0 15px rgba(0, 255, 255, 0.4)';
            } else if (isAlmostComplete && !hasValue) {
              // Almost complete - second priority (only for empty cells)
              // Fill cell completely with green background - higher opacity for more green
              cellBg = 'rgba(0, 255, 136, 0.5)';
              cellBorder = '2px solid #00FF88';
              cellClassName = 'almost-complete-glow';
            } else if (related) {
              // Enhanced highlighting for related cells (same row/col/box or matching number)
              // Uniform solid background - no gradient or inset shadows
              cellBg = 'rgba(0, 255, 255, 0.35)';
              cellClassName = 'selected-number-highlight';
            } else if (opponentScored) {
              // Bright magenta static effect for opponent-placed cells
              cellBg = 'rgba(255, 0, 255, 0.4)';
              cellClassName = 'opponent-scored-glow';
            }

            return (
              <button
                key={cellKey}
                onClick={() => {
                  if (!lockedOut) {
                    onCellClick(rowIndex, colIndex);
                  }
                }}
                disabled={lockedOut}
                className={`
                  relative flex items-center justify-center
                  transition-all duration-75 touch-manipulation
                  ${isCompleted ? 'completion-flash' : ''}
                  ${isAlmostComplete ? 'almost-complete-glow' : ''}
                  ${cellClassName}
                  ${!lockedOut ? 'cursor-pointer' : 'cursor-default'}
                `}
                style={{
                  background: cellBg,
                  boxShadow: cellShadow,
                  border: cellBorder,
                  zIndex: isAlmostComplete ? 20 : 1,
                  WebkitUserSelect: 'none',
                  userSelect: 'none',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                {hasValue ? (
                  <span
                    className={`font-heading font-bold ${isJustScored ? 'cell-score-pop' : ''} ${isInitial ? 'breathing-text' : 'breathing-cyan-text'}`}
                    style={{ 
                      fontSize: 'clamp(1.25rem, 5.5vw, 1.875rem)',
                      fontFamily: 'Industry, Orbitron, sans-serif',
                      color: isInitial ? 'rgba(255, 255, 255, 0.95)' : '#00FFFF',
                      WebkitUserSelect: 'none',
                      userSelect: 'none',
                      pointerEvents: 'none',
                    }}
                  >
                    {cell}
                  </span>
                ) : showNotes ? (
                  <div 
                    className="absolute inset-0 grid grid-cols-3 gap-0 p-0.5"
                    style={{ pointerEvents: 'none' }}
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                      <span
                        key={num}
                        className={`w-full h-full flex items-center justify-center font-heading font-medium ${
                          cellNotes.includes(num) ? 'opacity-100' : 'opacity-0'
                        }`}
                        style={{
                          fontSize: 'clamp(0.4rem, 1.5vw, 0.6rem)',
                          color: 'rgba(255, 255, 255, 0.7)',
                          WebkitUserSelect: 'none',
                          userSelect: 'none',
                        }}
                      >
                        {num}
                      </span>
                    ))}
                  </div>
                ) : null}
              </button>
            );
          })
        )}
      </div>

      {/* White wireframe grid lines overlay */}
      <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 10 }}>
        {/* Glow container - CSS glow with breathing animation */}
        <div className="absolute inset-0 rounded breathing-glow" />
        
        {/* Inner shadow for 3D recessed effect */}
        <div 
          className="absolute inset-0 rounded-lg pointer-events-none"
          style={{
            boxShadow: `
              inset 0 2px 10px rgba(0, 0, 0, 0.5),
              inset 0 -2px 6px rgba(0, 0, 0, 0.3),
              inset 3px 0 8px rgba(0, 0, 0, 0.25),
              inset -3px 0 8px rgba(0, 0, 0, 0.25)
            `,
          }}
        />
        
        <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
          {/* Outer border / perimeter */}
          <rect
            x="1"
            y="1"
            width="calc(100% - 2px)"
            height="calc(100% - 2px)"
            fill="none"
            stroke="rgb(255, 255, 255)"
            strokeWidth={2}
            rx="4"
            ry="4"
            className="breathing-line-thick"
          />

          {/* Thin horizontal lines - between cells (NOT at box boundaries) */}
          {[1, 2, 4, 5, 7, 8].map((i) => (
            <line
              key={`h-thin-${i}`}
              x1="0%"
              y1={`${(i / 9) * 100}%`}
              x2="100%"
              y2={`${(i / 9) * 100}%`}
              stroke="rgb(255, 255, 255)"
              strokeWidth={1}
              className="breathing-line"
            />
          ))}

          {/* Thin vertical lines - between cells (NOT at box boundaries) */}
          {[1, 2, 4, 5, 7, 8].map((i) => (
            <line
              key={`v-thin-${i}`}
              x1={`${(i / 9) * 100}%`}
              y1="0%"
              x2={`${(i / 9) * 100}%`}
              y2="100%"
              stroke="rgb(255, 255, 255)"
              strokeWidth={1}
              className="breathing-line"
            />
          ))}

          {/* Thick horizontal lines - 3x3 box boundaries */}
          {[3, 6].map((i) => (
            <line
              key={`h-thick-${i}`}
              x1="0%"
              y1={`${(i / 9) * 100}%`}
              x2="100%"
              y2={`${(i / 9) * 100}%`}
              stroke="rgb(255, 255, 255)"
              strokeWidth={2}
              className="breathing-line-thick"
            />
          ))}

          {/* Thick vertical lines - 3x3 box boundaries */}
          {[3, 6].map((i) => (
            <line
              key={`v-thick-${i}`}
              x1={`${(i / 9) * 100}%`}
              y1="0%"
              x2={`${(i / 9) * 100}%`}
              y2="100%"
              stroke="rgb(255, 255, 255)"
              strokeWidth={2}
              className="breathing-line-thick"
            />
          ))}
        </svg>
      </div>

      {/* Floating feedback */}
      {floatingFeedbacks.map((feedback) => {
        const position = getCellPosition(feedback.row, feedback.col);
        
        return (
          <div
            key={feedback.id}
            className={feedback.correct ? "floating-feedback-correct absolute pointer-events-none" : "floating-feedback absolute pointer-events-none"}
            style={{
              left: `${position.left}%`,
              top: `${position.top}%`,
              transform: 'translate(-50%, -100%)',
              zIndex: 100,
            }}
          >
            <span
              className="whitespace-nowrap block font-heading font-bold"
              style={{
                fontSize: feedback.correct 
                  ? (feedback.streak && feedback.streak >= 8 ? '1.4rem' : feedback.streak && feedback.streak >= 5 ? '1.2rem' : '1rem')
                  : '1rem',
                color: feedback.correct ? '#00FF88' : '#FF3366',
                textShadow: feedback.correct
                  ? '0 0 10px rgba(0, 255, 136, 0.8), 0 0 20px rgba(0, 255, 136, 0.5)'
                  : '0 0 10px rgba(255, 51, 102, 0.8)',
              }}
            >
              {feedback.text}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default memo(SudokuGrid);
