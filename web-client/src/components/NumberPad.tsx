interface NumberPadProps {
  onNumberClick: (num: number) => void;
  onErase: () => void;
  onToggleNotes?: () => void;
  notesMode?: boolean;
  disabled: boolean;
  digitCounts?: Record<number, number>;
}

export default function NumberPad({ 
  onNumberClick, 
  onErase, 
  onToggleNotes,
  notesMode = false,
  disabled,
  digitCounts = {},
}: NumberPadProps) {
  return (
    <div className="px-4 py-4 border-t border-gray-200 bg-white">
      {/* Number row 1–9 */}
      <div className="grid grid-cols-9 gap-2 mb-4 max-w-md mx-auto">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => {
          const count = digitCounts[num] || 0;
          const depleted = count >= 9;
          return (
            <button
              key={num}
              onClick={() => onNumberClick(num)}
              disabled={disabled || depleted}
              className={`
                w-full aspect-square rounded-lg transition-colors touch-manipulation text-2xl font-bold
                ${depleted
                  ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                  : disabled
                  ? 'bg-gray-50 text-gray-400 cursor-not-allowed'
                  : 'bg-blue-50 text-blue-500 hover:bg-blue-100 active:bg-blue-200'
                }
              `}
            >
              {num}
            </button>
          );
        })}
      </div>

      {/* Action toolbar: Undo, Erase, Notes */}
      <div className="flex items-center justify-around gap-2 max-w-md mx-auto">
        {/* Undo (placeholder, disabled for now) */}
        <button
          disabled
          className="flex flex-col items-center gap-1 py-2 px-4 rounded-lg bg-gray-50 text-gray-400 cursor-not-allowed"
        >
          <span className="text-xl">↺</span>
          <span className="text-xs">Undo</span>
        </button>

        {/* Erase */}
        <button
          onClick={onErase}
          disabled={disabled}
          className={`
            flex flex-col items-center gap-1 py-2 px-4 rounded-lg transition-colors
            ${disabled
              ? 'bg-gray-50 text-gray-400 cursor-not-allowed'
              : 'bg-gray-50 text-gray-700 hover:bg-gray-100 active:bg-gray-200'
            }
          `}
        >
          <span className="text-xl">⌫</span>
          <span className="text-xs">Erase</span>
        </button>

        {/* Notes */}
        {onToggleNotes && (
          <button
            onClick={onToggleNotes}
            disabled={disabled}
            className={`
              flex flex-col items-center gap-1 py-2 px-4 rounded-lg transition-colors relative
              ${disabled
                ? 'bg-gray-50 text-gray-400 cursor-not-allowed'
                : notesMode
                ? 'bg-blue-50 text-blue-500 hover:bg-blue-100'
                : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
              }
            `}
          >
            <span className="text-xl">✏️</span>
            <span className="text-xs flex items-center gap-1">
              Notes
              {notesMode && (
                <span className="text-xs px-1.5 py-0.5 bg-blue-500 text-white rounded font-semibold">ON</span>
              )}
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
