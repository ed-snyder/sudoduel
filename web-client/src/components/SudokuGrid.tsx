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
  opponentScoredCells?: Set<string>; // Set of "row-col" keys for cells opponent has scored
}

interface FloatingFeedback {
  id: string;
  row: number;
  col: number;
  text: string;
  correct: boolean;
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
    // Silently fail if Web Audio API is not available
    console.warn('Could not play error sound:', error);
  }
};

function SudokuGrid({
  grid,
  initialGrid,
  selectedCell,
  onCellClick,
  notes = new Map(),
  notesMode: _notesMode = false, // Reserved for future notes mode feature
  lockedOut = false,
  lastMoveResult = null,
  opponentScoredCells = new Set(),
}: SudokuGridProps) {
  const [floatingFeedbacks, setFloatingFeedbacks] = useState<FloatingFeedback[]>([]);
  const cellRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const gridRef = useRef<HTMLDivElement>(null);
  const isInitialCell = (row: number, col: number) => {
    return initialGrid[row][col] !== 0;
  };

  const isSelected = (row: number, col: number) => {
    return selectedCell?.row === row && selectedCell?.col === col;
  };

  // Get selected value once at the top level
  const selectedValue = selectedCell 
    ? (grid[selectedCell.row]?.[selectedCell.col] || null)
    : null;
  const hasSelectedValue = selectedValue !== null && selectedValue !== 0;

  const isSameBox = (row: number, col: number) => {
    if (!selectedCell || !hasSelectedValue) return false;
    // Don't highlight the selected cell itself
    if (row === selectedCell.row && col === selectedCell.col) return false;
    const boxRow = Math.floor(selectedCell.row / 3);
    const boxCol = Math.floor(selectedCell.col / 3);
    return Math.floor(row / 3) === boxRow && Math.floor(col / 3) === boxCol;
  };

  const isSameRowOrCol = (row: number, col: number) => {
    if (!selectedCell || !hasSelectedValue) return false;
    // Don't highlight the selected cell itself
    if (row === selectedCell.row && col === selectedCell.col) return false;
    return row === selectedCell.row || col === selectedCell.col;
  };

  const isSameNumberAsSelected = (row: number, col: number) => {
    if (!selectedCell || !hasSelectedValue) return false;
    // Don't highlight the selected cell itself
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
    const feedbackId = `${row}-${col}-${Date.now()}`;
    
    if (correct) {
      // Correct answer: show "+5s!" (bonus is 5 seconds)
      setFloatingFeedbacks((prev) => [
        ...prev,
        { id: feedbackId, row, col, text: '+5s!', correct: true },
      ]);
    } else {
      // Incorrect answer: show "-30s!" and play sound/vibration
      setFloatingFeedbacks((prev) => [
        ...prev,
        { id: feedbackId, row, col, text: '-30s!', correct: false },
      ]);
      
      // Play error sound
      playErrorSound();
      
      // Trigger vibration if available
      if ('vibrate' in navigator) {
        navigator.vibrate([100, 50, 100]);
      }
    }

    // Remove feedback after animation completes (~1 second)
    const timer = setTimeout(() => {
      setFloatingFeedbacks((prev) => prev.filter((f) => f.id !== feedbackId));
    }, 1000);

    return () => clearTimeout(timer);
  }, [lastMoveResult]);

  // Helper function to get cell position
  const getCellPosition = (row: number, col: number) => {
    const cellKey = `${row}-${col}`;
    const cellElement = cellRefs.current.get(cellKey);
    const gridElement = gridRef.current;
    
    if (!cellElement || !gridElement) {
      // Fallback to percentage-based positioning
      const cellWidthPercent = 100 / 9;
      const cellHeightPercent = 100 / 9;
      // Position slightly above the cell
      return {
        left: (col * cellWidthPercent) + (cellWidthPercent / 2),
        top: row * cellHeightPercent,
        usePercent: true,
        offsetTop: -10, // Offset in pixels for percentage-based positioning
      };
    }
    
    const cellRect = cellElement.getBoundingClientRect();
    const gridRect = gridElement.getBoundingClientRect();
    
    // Calculate position relative to grid
    const left = cellRect.left - gridRect.left + (cellRect.width / 2);
    // Position slightly above the cell (about 10px above the top)
    const top = cellRect.top - gridRect.top - 10;
    
    return { left, top, usePercent: false };
  };

  return (
    <div
      ref={gridRef}
      className={`
        relative grid grid-cols-9 gap-0 border-2 border-gray-700
        ${lockedOut ? 'bg-gray-100' : 'bg-white'}
        w-full
      `}
      style={{
        aspectRatio: '1 / 1',
        maxHeight: 'min(100%, calc(100vh - 280px))', // Reserved space for header + controls
        maxWidth: '100%',
        marginBottom: '0px',
        paddingBottom: '0px',
      }}
    >
      {grid.map((row, rowIndex) =>
        row.map((cell, colIndex) => {
          const isInitial = isInitialCell(rowIndex, colIndex);
          const selected = isSelected(rowIndex, colIndex);
          // Only highlight related cells if selected cell has a value, and exclude the selected cell itself
          const related =
            !selected &&
            hasSelectedValue &&
            (isSameRowOrCol(rowIndex, colIndex) ||
              isSameBox(rowIndex, colIndex) ||
              isSameNumberAsSelected(rowIndex, colIndex));

          // Border styling for 3x3 boxes
          const borderRight =
            (colIndex + 1) % 3 === 0 && colIndex < 8
              ? 'border-r-2 border-gray-700'
              : 'border-r border-gray-400';
          const borderBottom =
            (rowIndex + 1) % 3 === 0 && rowIndex < 8
              ? 'border-b-2 border-gray-700'
              : 'border-b border-gray-400';

          const cellKey = `${rowIndex}-${colIndex}`;
          const cellNotes = notes.get(cellKey) || [];
          const hasValue = cell !== 0;
          const showNotes = !hasValue && cellNotes.length > 0;
          
          // Check if opponent has scored this cell but player hasn't
          // Only show pink tint if player hasn't scored it yet and it's not an initial clue
          const opponentScored = opponentScoredCells.has(cellKey) && !hasValue && !isInitial;

          return (
            <button
              key={cellKey}
              ref={(el) => {
                if (el) {
                  cellRefs.current.set(cellKey, el);
                } else {
                  cellRefs.current.delete(cellKey);
                }
              }}
              onClick={() => !lockedOut && onCellClick(rowIndex, colIndex)}
              className={`
                relative flex items-center justify-center
                ${borderRight} ${borderBottom}
                w-full
                ${
                  lockedOut
                    ? 'bg-gray-100'
                    : isErrorFlash(rowIndex, colIndex)
                    ? 'bg-red-100'
                    : selected
                    ? 'bg-blue-300'
                    : related
                    ? 'bg-blue-100'
                    : opponentScored
                    ? 'opponent-scored'
                    : 'bg-white'
                }
                ${
                  !lockedOut
                    ? 'hover:bg-blue-50 active:bg-blue-100 cursor-pointer'
                    : 'cursor-default'
                }
                transition-colors duration-75 touch-manipulation
                style={{
                  aspectRatio: '1 / 1',
                  willChange: 'background-color', // GPU acceleration hint
                }}
              `}
              disabled={lockedOut}
            >
              {hasValue ? (
                <span
                  className={`
                    text-base sm:text-lg md:text-xl lg:text-2xl font-bold
                    ${isInitial ? 'text-gray-800' : 'text-blue-500'}
                  `}
                  style={{ fontSize: 'clamp(1.125rem, 5vw, 2rem)' }}
                >
                  {cell}
                </span>
              ) : showNotes ? (
                <div className="absolute inset-0 grid grid-cols-3 gap-0 p-1">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                    <span
                      key={num}
                      className={`w-full h-full text-[9px] sm:text-[11px] md:text-[13px] text-gray-500 flex items-center justify-center font-medium ${
                        cellNotes.includes(num) ? 'opacity-100' : 'opacity-0'
                      }`}
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
              left: position.usePercent ? `${position.left}%` : `${position.left}px`,
              top: position.usePercent 
                ? `calc(${position.top}% + ${(position as any).offsetTop || 0}px)` 
                : `${position.top}px`,
              pointerEvents: 'none',
              zIndex: 1000,
              textAlign: 'center',
              transformOrigin: 'center center',
            }}
          >
            <span
              className={`
                text-lg sm:text-xl md:text-2xl font-bold whitespace-nowrap block
                ${feedback.correct 
                  ? 'text-emerald-500' 
                  : 'text-red-500'
                }
              `}
              style={{
                textShadow: feedback.correct
                  ? '0 0 8px rgba(16, 185, 129, 0.6)'
                  : '0 0 8px rgba(239, 68, 68, 0.6)',
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
