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

  const getCellPosition = (row: number, col: number) => {
    const cellPercent = 100 / 9;
    return {
      left: col * cellPercent + cellPercent / 2,
      top: row * cellPercent + cellPercent / 2,
    };
  };

  return (
    <div
      ref={gridRef}
      className="relative bg-white rounded-lg"
      style={{
        aspectRatio: '1 / 1',
        width: '100%',
        maxWidth: 'min(100vw - 16px, 400px)',
        border: '2px solid #333',
      }}
    >
      {/* 9x9 Grid */}
      <div className="absolute inset-0 grid grid-cols-9 grid-rows-9">
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

            // Cell background
            let cellBg = 'transparent';
            if (lockedOut) {
              cellBg = '#f0f0f0';
            } else if (isError) {
              cellBg = '#ffcccc';
            } else if (selected) {
              cellBg = '#cce5ff';
            } else if (related) {
              cellBg = '#e8f4ff';
            } else if (opponentScored) {
              cellBg = '#ffe8f5';
            }

            return (
              <button
                key={cellKey}
                onClick={() => !lockedOut && onCellClick(rowIndex, colIndex)}
                onTouchStart={(e) => {
                  if (!lockedOut) {
                    e.preventDefault();
                    onCellClick(rowIndex, colIndex);
                  }
                }}
                disabled={lockedOut}
                className={`
                  relative flex items-center justify-center
                  transition-colors duration-75 touch-manipulation
                  ${isCompleted ? 'completion-flash' : ''}
                  ${isAlmostComplete ? 'almost-complete-glow' : ''}
                  ${!lockedOut ? 'cursor-pointer' : 'cursor-default'}
                `}
                style={{
                  background: cellBg,
                }}
              >
                {hasValue ? (
                  <span
                    className={`font-bold ${isJustScored ? 'cell-score-pop' : ''}`}
                    style={{ 
                      fontSize: 'clamp(1.1rem, 5vw, 1.75rem)',
                      color: isInitial ? '#333' : '#0066cc',
                    }}
                  >
                    {cell}
                  </span>
                ) : showNotes ? (
                  <div className="absolute inset-0 grid grid-cols-3 gap-0 p-0.5">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                      <span
                        key={num}
                        className={`w-full h-full flex items-center justify-center font-medium ${
                          cellNotes.includes(num) ? 'opacity-100' : 'opacity-0'
                        }`}
                        style={{
                          fontSize: 'clamp(0.4rem, 1.5vw, 0.6rem)',
                          color: '#666',
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

      {/* Grid lines overlay */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Thin lines - every cell */}
        <svg className="absolute inset-0 w-full h-full">
          {[1, 2, 4, 5, 7, 8].map((i) => (
            <line
              key={`h-thin-${i}`}
              x1="0"
              y1={`${(i / 9) * 100}%`}
              x2="100%"
              y2={`${(i / 9) * 100}%`}
              stroke="#ccc"
              strokeWidth="1"
            />
          ))}
          {[1, 2, 4, 5, 7, 8].map((i) => (
            <line
              key={`v-thin-${i}`}
              x1={`${(i / 9) * 100}%`}
              y1="0"
              x2={`${(i / 9) * 100}%`}
              y2="100%"
              stroke="#ccc"
              strokeWidth="1"
            />
          ))}
        </svg>

        {/* Thick lines - 3x3 boxes */}
        <svg className="absolute inset-0 w-full h-full">
          {[3, 6].map((i) => (
            <line
              key={`h-thick-${i}`}
              x1="0"
              y1={`${(i / 9) * 100}%`}
              x2="100%"
              y2={`${(i / 9) * 100}%`}
              stroke="#333"
              strokeWidth="2"
            />
          ))}
          {[3, 6].map((i) => (
            <line
              key={`v-thick-${i}`}
              x1={`${(i / 9) * 100}%`}
              y1="0"
              x2={`${(i / 9) * 100}%`}
              y2="100%"
              stroke="#333"
              strokeWidth="2"
            />
          ))}
        </svg>
      </div>
      
      {/* Floating feedback elements */}
      {floatingFeedbacks.map((feedback) => {
        const position = getCellPosition(feedback.row, feedback.col);
        
        return (
          <div
            key={feedback.id}
            className="floating-feedback absolute pointer-events-none"
            style={{
              left: `${position.left}%`,
              top: `${position.top}%`,
              transform: 'translate(-50%, -50%)',
              zIndex: 100,
            }}
          >
            <span
              className="whitespace-nowrap block font-mono font-bold"
              style={{
                fontSize: feedback.correct 
                  ? (feedback.streak && feedback.streak >= 8 ? '1.5rem' : feedback.streak && feedback.streak >= 5 ? '1.25rem' : '1.1rem')
                  : '1.1rem',
                color: feedback.correct ? '#00FFFF' : '#FF3366',
                textShadow: feedback.correct
                  ? '0 0 15px rgba(0, 255, 255, 0.9), 0 0 30px rgba(0, 255, 255, 0.5)'
                  : '0 0 15px rgba(255, 51, 102, 0.9)',
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
