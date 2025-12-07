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
}

interface FloatingFeedback {
  id: string;
  row: number;
  col: number;
  text: string;
  correct: boolean;
  streak?: number;
}

const playErrorSound = () => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.setValueAtTime(150, audioContext.currentTime);
    oscillator.type = 'square';
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);
    
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.15);
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
}: SudokuGridProps) {
  const [floatingFeedbacks, setFloatingFeedbacks] = useState<FloatingFeedback[]>([]);
  const gridRef = useRef<HTMLDivElement>(null);
  const lastProcessedMoveRef = useRef<string | null>(null);
  
  // Breathing animation state (5 second cycle)
  const [breathPhase, setBreathPhase] = useState(0);
  
  // Shimmer animation state (8 second travel time)
  const [shimmerPosition, setShimmerPosition] = useState(-20);
  
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

    const { row, col, correct } = lastMoveResult;
    const moveId = `${row}-${col}-${correct}`;
    
    if (lastProcessedMoveRef.current === moveId) return;
    lastProcessedMoveRef.current = moveId;
    
    const feedbackId = `${row}-${col}-${Date.now()}`;
    
    if (correct) {
      setFloatingFeedbacks((prev) => [
        ...prev,
        { id: feedbackId, row, col, text: '+5s!', correct: true, streak: currentStreak },
      ]);
    } else {
      playErrorSound();
      if (navigator.vibrate) navigator.vibrate([50, 30, 50]);
      setFloatingFeedbacks((prev) => [
        ...prev,
        { id: feedbackId, row, col, text: '-30s!', correct: false },
      ]);
    }

    setTimeout(() => {
      setFloatingFeedbacks((prev) => prev.filter((f) => f.id !== feedbackId));
    }, 1000);
  }, [lastMoveResult, currentStreak]);

  // Breathing animation - 5 second cycle
  useEffect(() => {
    const interval = setInterval(() => {
      setBreathPhase((prev) => (prev + 0.015) % (Math.PI * 2));
    }, 25); // ~40fps, smooth animation
    return () => clearInterval(interval);
  }, []);

  // Shimmer animation - 8 second travel time
  useEffect(() => {
    const interval = setInterval(() => {
      setShimmerPosition((prev) => {
        const next = prev + 0.4;
        return next > 120 ? -20 : next;
      });
    }, 32); // ~30fps
    return () => clearInterval(interval);
  }, []);

  const getCellPosition = (row: number, col: number) => {
    const cellPercent = 100 / 9;
    return {
      left: col * cellPercent + cellPercent / 2,
      top: row * cellPercent + cellPercent / 2,
    };
  };

  // Calculate breath multipliers (creates 60% → 80% → 60% pulse)
  const breathMultiplier = 0.7 + Math.sin(breathPhase) * 0.1;
  const thickBreathMultiplier = 0.85 + Math.sin(breathPhase) * 0.1;
  const glowBreathMultiplier = 0.8 + Math.sin(breathPhase) * 0.2;

  return (
    <div
      ref={gridRef}
      className="relative select-none"
      style={{
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
            let cellBg = 'transparent';
            let cellShadow = 'none';
            
            if (lockedOut) {
              cellBg = 'rgba(100, 100, 100, 0.2)';
            } else if (isError) {
              cellBg = 'rgba(255, 51, 102, 0.4)';
              cellShadow = 'inset 0 0 20px rgba(255, 51, 102, 0.6)';
            } else if (selected) {
              const glowIntensity = 0.4 * glowBreathMultiplier;
              cellBg = 'rgba(0, 255, 255, 0.35)';
              cellShadow = `inset 0 0 20px rgba(0, 255, 255, ${0.5 * glowBreathMultiplier}), 0 0 15px rgba(0, 255, 255, ${glowIntensity})`;
            } else if (related) {
              const glowIntensity = 0.15 * glowBreathMultiplier;
              cellBg = 'rgba(0, 255, 255, 0.12)';
              cellShadow = `inset 0 0 10px rgba(0, 255, 255, ${glowIntensity})`;
            } else if (opponentScored) {
              cellBg = 'rgba(255, 0, 255, 0.15)';
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
                  ${!lockedOut ? 'cursor-pointer' : 'cursor-default'}
                `}
                style={{
                  background: cellBg,
                  boxShadow: cellShadow,
                  WebkitUserSelect: 'none',
                  userSelect: 'none',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                {hasValue ? (
                  <span
                    className={`font-heading font-bold ${isJustScored ? 'cell-score-pop' : ''}`}
                    style={{ 
                      fontSize: 'clamp(1.25rem, 5.5vw, 1.875rem)',
                      fontFamily: 'Industry, Orbitron, sans-serif',
                      color: isInitial ? 'rgba(255, 255, 255, 0.95)' : '#00FFFF',
                      textShadow: isInitial 
                        ? `0 0 ${8 + Math.sin(breathPhase) * 4}px rgba(255, 255, 255, ${0.3 + Math.sin(breathPhase) * 0.1}), 0 0 ${16 + Math.sin(breathPhase) * 4}px rgba(255, 255, 255, ${0.2 + Math.sin(breathPhase) * 0.05})`
                        : `0 0 ${12 + Math.sin(breathPhase) * 4}px rgba(0, 255, 255, ${0.6 + Math.sin(breathPhase) * 0.15})`,
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
      <div className="absolute inset-0 pointer-events-none">
        <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
          <defs>
            {/* Soft glow for thick lines and border */}
            <filter id="softGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2" result="blur"/>
              <feMerge>
                <feMergeNode in="blur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
            
            {/* Shimmer gradient - will be animated */}
            <linearGradient id="shimmerGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="white" stopOpacity="0" />
              <stop offset={`${Math.max(0, shimmerPosition - 10)}%`} stopColor="white" stopOpacity="0" />
              <stop offset={`${shimmerPosition}%`} stopColor="white" stopOpacity="0.8" />
              <stop offset={`${Math.min(100, shimmerPosition + 10)}%`} stopColor="white" stopOpacity="0" />
              <stop offset="100%" stopColor="white" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Outer border / perimeter */}
          <rect
            x="1"
            y="1"
            width="calc(100% - 2px)"
            height="calc(100% - 2px)"
            fill="none"
            stroke="rgba(255, 255, 255, 0.9)"
            strokeWidth="2"
            strokeOpacity={thickBreathMultiplier}
            rx="4"
            ry="4"
            filter="url(#softGlow)"
          />

          {/* Thin white lines - between regular cells */}
          {[1, 2, 4, 5, 7, 8].map((i) => (
            <line
              key={`h-thin-${i}`}
              x1="0"
              y1={`${(i / 9) * 100}%`}
              x2="100%"
              y2={`${(i / 9) * 100}%`}
              stroke="rgba(255, 255, 255, 0.25)"
              strokeWidth="1"
              strokeOpacity={breathMultiplier}
            />
          ))}
          {[1, 2, 4, 5, 7, 8].map((i) => (
            <line
              key={`v-thin-${i}`}
              x1={`${(i / 9) * 100}%`}
              y1="0"
              x2={`${(i / 9) * 100}%`}
              y2="100%"
              stroke="rgba(255, 255, 255, 0.25)"
              strokeWidth="1"
              strokeOpacity={breathMultiplier}
            />
          ))}

          {/* Thick white lines - 3x3 box boundaries */}
          {[3, 6].map((i) => (
            <line
              key={`h-thick-${i}`}
              x1="0"
              y1={`${(i / 9) * 100}%`}
              x2="100%"
              y2={`${(i / 9) * 100}%`}
              stroke="rgba(255, 255, 255, 0.9)"
              strokeWidth="2"
              strokeOpacity={thickBreathMultiplier}
              filter="url(#softGlow)"
            />
          ))}
          {[3, 6].map((i) => (
            <line
              key={`v-thick-${i}`}
              x1={`${(i / 9) * 100}%`}
              y1="0"
              x2={`${(i / 9) * 100}%`}
              y2="100%"
              stroke="rgba(255, 255, 255, 0.9)"
              strokeWidth="2"
              strokeOpacity={thickBreathMultiplier}
              filter="url(#softGlow)"
            />
          ))}

          {/* Shimmer overlay - renders on top of base lines */}
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <line
              key={`h-shimmer-${i}`}
              x1="0"
              y1={`${(i / 9) * 100}%`}
              x2="100%"
              y2={`${(i / 9) * 100}%`}
              stroke="url(#shimmerGradient)"
              strokeWidth={i === 3 || i === 6 ? 3 : 2}
            />
          ))}
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <line
              key={`v-shimmer-${i}`}
              x1={`${(i / 9) * 100}%`}
              y1="0"
              x2={`${(i / 9) * 100}%`}
              y2="100%"
              stroke="url(#shimmerGradient)"
              strokeWidth={i === 3 || i === 6 ? 3 : 2}
            />
          ))}
          {/* Border shimmer */}
          <rect
            x="1"
            y="1"
            width="calc(100% - 2px)"
            height="calc(100% - 2px)"
            fill="none"
            stroke="url(#shimmerGradient)"
            strokeWidth="3"
            rx="4"
            ry="4"
          />
        </svg>
      </div>

      {/* Floating feedback */}
      {floatingFeedbacks.map((feedback) => {
        const position = getCellPosition(feedback.row, feedback.col);
        
        return (
          <div
            key={feedback.id}
            className="floating-feedback absolute pointer-events-none"
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
