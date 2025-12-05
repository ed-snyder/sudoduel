import { useState, useEffect } from 'react';
import { playerAPI } from '../services/api';

interface MatchHistoryEntry {
  match_id: number;
  date: Date;
  opponent_name: string;
  result: 'WIN' | 'LOSS' | 'DRAW';
  cells_completed: number;
  opponent_cells_completed: number;
  mistakes: number;
  rating_before: number;
  rating_after: number | null;
  rating_change: number;
}

interface MatchHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  playerName: string;
  currentRating: number;
}

export default function MatchHistoryModal({ isOpen, onClose, playerName, currentRating }: MatchHistoryModalProps) {
  const [matches, setMatches] = useState<MatchHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadMatchHistory();
    }
  }, [isOpen]);

  const loadMatchHistory = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await playerAPI.getMatchHistory(50, 0) as {
        matches: MatchHistoryEntry[];
        total: number;
        limit: number;
        offset: number;
      };
      setMatches(response.matches);
    } catch (err: any) {
      setError(err.message || 'Failed to load match history');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-md shadow-xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-4 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-800">Match History</h2>
            <p className="text-sm text-gray-500 mt-1">
              {playerName} • Rating: {Math.round(currentRating)}
            </p>
          </div>
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
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin" />
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-red-600">{error}</p>
            </div>
          ) : matches.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">No matches yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {matches.map((match) => (
                <div
                  key={match.match_id}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  {/* Result circle */}
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white flex-shrink-0 ${
                      match.result === 'WIN'
                        ? 'bg-green-500'
                        : match.result === 'LOSS'
                        ? 'bg-red-500'
                        : 'bg-gray-400'
                    }`}
                  >
                    {match.result[0]}
                  </div>

                  {/* Match info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-800">vs {match.opponent_name}</span>
                      <span className="text-xs text-gray-400">{formatDate(match.date)}</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {match.cells_completed} cells • {match.mistakes} mistakes
                    </div>
                  </div>

                  {/* Rating change */}
                  <div
                    className={`text-sm font-mono font-semibold flex-shrink-0 ${
                      match.rating_change > 0
                        ? 'text-green-600'
                        : match.rating_change < 0
                        ? 'text-red-600'
                        : 'text-gray-600'
                    }`}
                  >
                    {match.rating_change > 0 ? '+' : ''}
                    {Math.round(match.rating_change)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

