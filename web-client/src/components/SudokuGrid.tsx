interface SudokuGridProps {
  grid: number[][];
  initialGrid: number[][];
  selectedCell: { row: number; col: number } | null;
  onCellClick: (row: number, col: number) => void;
  notes?: Map<string, number[]>;
  notesMode?: boolean;
  lockedOut?: boolean;
  lastMoveResult?: { row: number; col: number; correct: boolean } | null;
}

export default function SudokuGrid({
  grid,
  initialGrid,
  selectedCell,
  onCellClick,
  notes = new Map(),
  notesMode: _notesMode = false, // Reserved for future notes mode feature
  lockedOut = false,
  lastMoveResult = null,
}: SudokuGridProps) {
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

  return (
    <div
      className={`
        grid grid-cols-9 gap-0 border-2 border-gray-700 
        ${lockedOut ? 'bg-gray-100' : 'bg-white'}
        transition-colors
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

          return (
            <button
              key={`${rowIndex}-${colIndex}`}
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
                    : 'bg-white'
                }
                ${
                  !lockedOut
                    ? 'hover:bg-blue-50 active:bg-blue-100 cursor-pointer'
                    : 'cursor-default'
                }
                transition-colors duration-150 touch-manipulation
              `}
              style={{
                aspectRatio: '1 / 1',
              }}
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
                      className={`text-[9px] sm:text-[11px] md:text-[13px] text-gray-500 flex items-center justify-center font-medium ${
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
    </div>
  );
}
