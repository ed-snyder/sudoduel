interface NumberPadProps {
  onNumberClick: (num: number) => void;
  onErase: () => void;
  onToggleNotes?: () => void;
  notesMode?: boolean;
  disabled: boolean;
}

export default function NumberPad({ 
  onNumberClick, 
  onErase, 
  onToggleNotes,
  notesMode = false,
  disabled 
}: NumberPadProps) {
  return (
    <div className="mt-4 w-full max-w-lg">
      <div className="grid grid-cols-5 gap-2 sm:gap-3 mb-2">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
          <button
            key={num}
            onClick={() => onNumberClick(num)}
            disabled={disabled}
            className="w-full aspect-square bg-gray-700 hover:bg-gray-600 active:bg-gray-500 disabled:bg-gray-800 disabled:text-gray-600 text-white text-lg sm:text-xl font-bold rounded-lg transition touch-manipulation"
          >
            {num}
          </button>
        ))}
        <button
          onClick={onErase}
          disabled={disabled}
          className="w-full aspect-square bg-red-600 hover:bg-red-700 active:bg-red-800 disabled:bg-gray-800 disabled:text-gray-600 text-white text-sm sm:text-base font-bold rounded-lg transition touch-manipulation"
        >
          ✕
        </button>
      </div>
      {onToggleNotes && (
        <button
          onClick={onToggleNotes}
          disabled={disabled}
          className={`w-full py-3 sm:py-2 px-4 rounded-lg font-semibold text-sm sm:text-base transition touch-manipulation ${
            notesMode
              ? 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white'
              : 'bg-gray-700 hover:bg-gray-600 active:bg-gray-500 text-gray-300'
          } disabled:bg-gray-800 disabled:text-gray-600`}
        >
          {notesMode ? '📝 Notes Mode ON' : '📝 Notes Mode OFF'}
        </button>
      )}
    </div>
  );
}
