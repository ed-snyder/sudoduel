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

// Play error sound using Web Audio API
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
  const cellRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
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

  // Handle floating feedback when lastMoveResult changes
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
      usePercent: true,
      offsetTop: -15,
    };
  };

  return (
    <div
      ref={gridRef}
      className="grid grid-cols-9 relative"
      style={{
        aspectRatio: '1 / 1',
        maxHeight: 'min(100%, calc(100vh - 280px))',
        maxWidth: '100%',
        background: 'rgba(15, 10, 25, 0.9)',
        border: '3px solid',
        borderImage: 'linear-gradient(135deg, #00FFFF, #8B00FF, #FF00FF) 1',
        boxShadow: '0 0 30px rgba(139,0,255,0.3), inset 0 0 20px rgba(0,0,0,0.5)',
        borderRadius: '4px',
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

          // 3x3 box borders - thicker purple
          const isRightBoxEdge = (colIndex + 1) % 3 === 0 && colIndex < 8;
          const isBottomBoxEdge = (rowIndex + 1) % 3 === 0 && rowIndex < 8;
          
          const cellKey = `${rowIndex}-${colIndex}`;
          const cellNotes = notes.get(cellKey) || [];
          const hasValue = cell !== 0;
          const showNotes = !hasValue && cellNotes.length > 0;
          const opponentScored = opponentScoredCells.has(cellKey) && !hasValue && !isInitial;
          const isJustScored = lastScoredCell?.row === rowIndex && lastScoredCell?.col === colIndex;
          const isCompleted = completedCells.has(cellKey);
          const isAlmostComplete = almostCompleteCells.has(cellKey);

          // Determine cell background
          let cellBg = 'rgba(20, 12, 30, 0.8)'; // Default dark
          if (lockedOut) {
            cellBg = 'rgba(30, 20, 40, 0.5)';
          } else if (isErrorFlash(rowIndex, colIndex)) {
            cellBg = 'rgba(255, 51, 102, 0.4)';
          } else if (selected) {
            cellBg = 'rgba(0, 255, 255, 0.25)';
          } else if (related) {
            cellBg = 'rgba(0, 255, 255, 0.08)';
          } else if (opponentScored) {
            cellBg = 'rgba(255, 0, 255, 0.1)';
          }

          return (
            <button
              key={cellKey}
              ref={(el) => {
                if (el) cellRefs.current.set(cellKey, el);
                else cellRefs.current.delete(cellKey);
              }}
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
                aspectRatio: '1 / 1',
                background: cellBg,
                borderRight: isRightBoxEdge 
                  ? '2px solid rgba(139, 0, 255, 0.8)' 
                  : '1px solid rgba(139, 0, 255, 0.25)',
                borderBottom: isBottomBoxEdge 
                  ? '2px solid rgba(139, 0, 255, 0.8)' 
                  : '1px solid rgba(139, 0, 255, 0.25)',
                boxShadow: selected 
                  ? 'inset 0 0 15px rgba(0, 255, 255, 0.4), 0 0 10px rgba(0, 255, 255, 0.3)' 
                  : isErrorFlash(rowIndex, colIndex)
                  ? 'inset 0 0 15px rgba(255, 51, 102, 0.5)'
                  : 'none',
                willChange: 'background-color',
              }}
            >
              {hasValue ? (
                <span
                  className={`font-mono font-bold ${isJustScored ? 'cell-score-pop' : ''}`}
                  style={{ 
                    fontSize: 'clamp(1.125rem, 5vw, 2rem)',
                    color: isInitial ? 'rgba(255, 255, 255, 0.9)' : '#00FFFF',
                    textShadow: isInitial 
                      ? 'none' 
                      : '0 0 10px rgba(0, 255, 255, 0.6)',
                  }}
                >
                  {cell}
                </span>
              ) : showNotes ? (
                <div className="absolute inset-0 grid grid-cols-3 gap-0 p-0.5">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                    <span
                      key={num}
                      className={`w-full h-full flex items-center justify-center font-mono ${
                        cellNotes.includes(num) ? 'opacity-100' : 'opacity-0'
                      }`}
                      style={{
                        fontSize: 'clamp(0.5rem, 2vw, 0.75rem)',
                        color: 'rgba(0, 255, 255, 0.7)',
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
      
      {/* Floating feedback elements */}
      {floatingFeedbacks.map((feedback) => {
        const position = getCellPosition(feedback.row, feedback.col);
        
        return (
          <div
            key={feedback.id}
            className="floating-feedback absolute"
            style={{
              left: `${position.left}%`,
              top: `calc(${position.top}% + ${position.offsetTop}px)`,
              pointerEvents: 'none',
              zIndex: 1000,
              textAlign: 'center',
              transformOrigin: 'center center',
            }}
          >
            <span
              className="whitespace-nowrap block font-mono font-bold"
              style={{
                fontSize: feedback.correct 
                  ? (feedback.streak && feedback.streak >= 8 ? '1.5rem' : feedback.streak && feedback.streak >= 5 ? '1.25rem' : '1rem')
                  : '1rem',
                color: feedback.correct ? '#00FFFF' : '#FF3366',
                textShadow: feedback.correct
                  ? '0 0 15px rgba(0, 255, 255, 0.8), 0 0 30px rgba(0, 255, 255, 0.4)'
                  : '0 0 15px rgba(255, 51, 102, 0.8)',
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
