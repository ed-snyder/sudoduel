import { useState, useEffect } from 'react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogout: () => void;
}

export default function SettingsModal({ isOpen, onClose, onLogout }: SettingsModalProps) {
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [hapticEnabled, setHapticEnabled] = useState(true);

  useEffect(() => {
    if (isOpen) {
      // Load settings from localStorage
      const sound = localStorage.getItem('soundEnabled');
      const haptic = localStorage.getItem('hapticEnabled');
      setSoundEnabled(sound !== 'false');
      setHapticEnabled(haptic !== 'false');
    }
  }, [isOpen]);

  const handleSoundToggle = (enabled: boolean) => {
    setSoundEnabled(enabled);
    localStorage.setItem('soundEnabled', enabled.toString());
  };

  const handleHapticToggle = (enabled: boolean) => {
    setHapticEnabled(enabled);
    localStorage.setItem('hapticEnabled', enabled.toString());
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-md shadow-xl">
        {/* Header */}
        <div className="px-4 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-800">Settings</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="px-4 py-4 space-y-6">
          {/* Toggles */}
          <div className="space-y-4">
            {/* Sound Effects */}
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-gray-800">Sound Effects</div>
                <div className="text-sm text-gray-500">Play sounds for moves</div>
              </div>
              <button
                onClick={() => handleSoundToggle(!soundEnabled)}
                className={`relative w-12 h-7 rounded-full transition-colors ${
                  soundEnabled ? 'bg-blue-500' : 'bg-gray-300'
                }`}
              >
                <div
                  className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full transition-transform ${
                    soundEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Haptic Feedback */}
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-gray-800">Haptic Feedback</div>
                <div className="text-sm text-gray-500">Vibrate on incorrect moves</div>
              </div>
              <button
                onClick={() => handleHapticToggle(!hapticEnabled)}
                className={`relative w-12 h-7 rounded-full transition-colors ${
                  hapticEnabled ? 'bg-blue-500' : 'bg-gray-300'
                }`}
              >
                <div
                  className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full transition-transform ${
                    hapticEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* About */}
          <div className="pt-4 border-t border-gray-200">
            <div className="text-sm text-gray-500">
              <div className="font-medium text-gray-700 mb-1">About</div>
              <div>Sudoduel v1.0.0</div>
            </div>
          </div>

          {/* Log Out */}
          <div className="pt-4">
            <button
              onClick={() => {
                onLogout();
                onClose();
              }}
              className="w-full py-3 bg-red-500 text-white font-semibold rounded-lg hover:bg-red-600 transition-colors"
            >
              Log Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

