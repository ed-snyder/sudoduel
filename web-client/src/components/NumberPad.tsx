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
    <div className="mt-4 w-full max-w-lg">
      {/* Number row 1–9 */}
      <div className="grid grid-cols-9 gap-2 sm:gap-3 mb-3">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
          (() => {
            const count = digitCounts[num] || 0;
            const depleted = count >= 9;
            return (
              <button
                key={num}
                onClick={() => onNumberClick(num)}
                disabled={disabled}
                className={`
                  w-full aspect-square rounded-lg transition touch-manipulation text-2xl sm:text-3xl font-bold
                  ${depleted
                    ? 'bg-gray-200 text-gray-400'
                    : 'bg-blue-50 text-blue-500 hover:bg-blue-100 active:bg-blue-200'
                  }
                  ${disabled && 'opacity-60 cursor-not-allowed'}
                `}
              >
                {num}
              </button>
            );
          })()
        ))}
      </div>

      {/* Action toolbar: Undo, Erase, Notes */}
      <div className="flex items-center justify-between gap-2 sm:gap-4">
        {/* Undo (placeholder, disabled for now) */}
        <div className="flex flex-col items-center flex-1">
          <button
            disabled
            className="w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center rounded-full bg-gray-200 text-gray-400 cursor-not-allowed"
          >
            ↺
          </button>
          <span className="mt-1 text-xs text-gray-400">Undo</span>
        </div>

        {/* Erase */}
        <div className="flex flex-col items-center flex-1">
          <button
            onClick={onErase}
            disabled={disabled}
            className={`
              w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center rounded-full
              ${disabled
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-gray-100 text-gray-700 hover:bg-red-50 hover:text-red-600 active:bg-red-100'
              }
            `}
          >
            ◇
          </button>
          <span className="mt-1 text-xs text-gray-600">Erase</span>
        </div>

        {/* Notes */}
        {onToggleNotes && (
          <div className="flex flex-col items-center flex-1">
            <button
              onClick={onToggleNotes}
              disabled={disabled}
              className={`
                w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center rounded-full
                ${disabled
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : notesMode
                  ? 'bg-blue-500 text-white hover:bg-blue-600 active:bg-blue-700'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 active:bg-gray-300'
                }
              `}
            >
              📝
            </button>
            <span className="mt-1 text-xs text-gray-600">
              Notes {notesMode && <span className="text-blue-500 font-semibold">ON</span>}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
