interface NumberPadProps {
  onNumberClick: (num: number) => void;
  onErase: () => void;
  disabled: boolean;
}

export default function NumberPad({ onNumberClick, onErase, disabled }: NumberPadProps) {
  return (
    <div className="grid grid-cols-5 gap-2 mt-4">
      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
        <button
          key={num}
          onClick={() => onNumberClick(num)}
          disabled={disabled}
          className="w-12 h-12 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-600 text-white text-xl font-bold rounded-lg transition"
        >
          {num}
        </button>
      ))}
      <button
        onClick={onErase}
        disabled={disabled}
        className="w-12 h-12 bg-red-600 hover:bg-red-700 disabled:bg-gray-800 disabled:text-gray-600 text-white text-sm font-bold rounded-lg transition"
      >
        ✕
      </button>
    </div>
  );
}
