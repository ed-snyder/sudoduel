interface ForfeitModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ForfeitModal({ isOpen, onConfirm, onCancel }: ForfeitModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 max-w-xs w-full mx-4 shadow-xl">
        <h2 className="text-xl font-bold text-gray-800 text-center mb-4">
          Forfeit Match?
        </h2>
        <p className="text-gray-600 text-center text-sm mb-6">
          You will lose this match and your rating will decrease.
        </p>
        <div className="flex flex-col gap-3">
          <button
            onClick={onConfirm}
            className="w-full py-3 bg-red-500 text-white font-semibold rounded-lg hover:bg-red-600"
          >
            Yes
          </button>
          <button
            onClick={onCancel}
            className="w-full py-3 bg-gray-100 text-gray-700 font-semibold rounded-lg hover:bg-gray-200"
          >
            Back to Game
          </button>
        </div>
      </div>
    </div>
  );
}


