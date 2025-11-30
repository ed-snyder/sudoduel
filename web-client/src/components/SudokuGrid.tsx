interface SudokuGridProps {
  grid: number[][];
  initialGrid: number[][];
  selectedCell: { row: number; col: number } | null;
  onCellClick: (row: number, col: number) => void;
}

export default function SudokuGrid({
  grid,
  initialGrid,
  selectedCell,
  onCellClick,
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

          return (
            <button
              key={`${rowIndex}-${colIndex}`}
              onClick={() => !isInitial && onCellClick(rowIndex, colIndex)}
              className={`
                w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center text-lg sm:text-xl font-bold
                ${borderRight} ${borderBottom}
                ${selected ? 'bg-blue-600' : highlighted ? 'bg-gray-700' : 'bg-gray-800'}
                ${isInitial ? 'text-gray-300' : 'text-blue-400'}
                ${!isInitial && 'hover:bg-gray-600 cursor-pointer'}
                transition-colors
              `}
              disabled={isInitial}
            >
              {cell !== 0 ? cell : ''}
            </button>
          );
        })
      )}
    </div>
  );
}
