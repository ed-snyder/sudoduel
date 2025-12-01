interface SudokuGridProps {
  grid: number[][];
  initialGrid: number[][];
  selectedCell: { row: number; col: number } | null;
  onCellClick: (row: number, col: number) => void;
  notes?: Map<string, number[]>;
  notesMode?: boolean;
}

export default function SudokuGrid({
  grid,
  initialGrid,
  selectedCell,
  onCellClick,
  notes = new Map(),
  notesMode = false,
}: SudokuGridProps) {
  const isInitialCell = (row: number, col: number) => {
    return initialGrid[row][col] !== 0;
  };

  const isSelected = (row: number, col: number) => {
    return selectedCell?.row === row && selectedCell?.col === col;
  };

  const isSameBox = (row: number, col: number) => {
    if (!selectedCell) return false;
    const boxRow = Math.floor(selectedCell.row / 3);
    const boxCol = Math.floor(selectedCell.col / 3);
    return Math.floor(row / 3) === boxRow && Math.floor(col / 3) === boxCol;
  };

  const isSameRowOrCol = (row: number, col: number) => {
    if (!selectedCell) return false;
    return row === selectedCell.row || col === selectedCell.col;
  };

  return (
    <div className="grid grid-cols-9 gap-0 border-2 border-gray-600 bg-gray-800">
      {grid.map((row, rowIndex) =>
        row.map((cell, colIndex) => {
          const isInitial = isInitialCell(rowIndex, colIndex);
          const selected = isSelected(rowIndex, colIndex);
          const highlighted = isSameRowOrCol(rowIndex, colIndex) || isSameBox(rowIndex, colIndex);

          // Border styling for 3x3 boxes
          const borderRight = (colIndex + 1) % 3 === 0 && colIndex < 8 ? 'border-r-2 border-gray-600' : 'border-r border-gray-700';
          const borderBottom = (rowIndex + 1) % 3 === 0 && rowIndex < 8 ? 'border-b-2 border-gray-600' : 'border-b border-gray-700';

          const cellKey = `${rowIndex}-${colIndex}`;
          const cellNotes = notes.get(cellKey) || [];
          const hasValue = cell !== 0;
          const showNotes = !hasValue && cellNotes.length > 0;

          return (
            <button
              key={`${rowIndex}-${colIndex}`}
              onClick={() => !isInitial && onCellClick(rowIndex, colIndex)}
              className={`
                w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 relative flex items-center justify-center
                ${borderRight} ${borderBottom}
                ${selected ? 'bg-blue-600' : highlighted ? 'bg-gray-700' : 'bg-gray-800'}
                ${!isInitial && 'hover:bg-gray-600 active:bg-gray-500 cursor-pointer'}
                transition-colors touch-manipulation
              `}
              disabled={isInitial}
            >
              {hasValue ? (
                <span className={`text-sm sm:text-lg md:text-xl font-bold ${isInitial ? 'text-gray-300' : 'text-blue-400'}`}>
                  {cell}
                </span>
              ) : showNotes ? (
                <div className="grid grid-cols-3 gap-0 w-full h-full p-0.5">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                    <span
                      key={num}
                      className={`text-[6px] sm:text-[8px] md:text-[10px] text-gray-400 ${
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
