import { useState, useEffect } from 'react';
import { playerAPI } from '../services/api';

interface PlayerStats {
  current_rating: number;
  games_played: number;
  total_matches: number;
  wins: number;
  losses: number;
  draws: number;
  win_rate: number;
  accuracy: number;
  rating_change_1d: number | null;
  rating_change_30d: number | null;
  rating_change_90d: number | null;
  rating_change_all_time: number | null;
}

interface StatsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function StatsModal({ isOpen, onClose }: StatsModalProps) {
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadStats();
    }
  }, [isOpen]);

  const loadStats = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await playerAPI.getStats() as PlayerStats;
      setStats(response);
    } catch (err: any) {
      setError(err.message || 'Failed to load statistics');
    } finally {
      setLoading(false);
    }
  };

  const formatRatingChange = (change: number | null): string => {
    if (change === null) return '—';
    return change > 0 ? `+${Math.round(change)}` : `${Math.round(change)}`;
  };

  const getRatingChangeColor = (change: number | null): string => {
    if (change === null) return 'text-gray-600';
    if (change > 0) return 'text-green-600';
    if (change < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-md shadow-xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-4 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-800">Statistics</h2>
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
          ) : stats ? (
            <div className="space-y-6">
              {/* Overview */}
              <div>
                <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">Overview</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <div className="text-2xl font-bold text-gray-800">{stats.total_matches}</div>
                    <div className="text-xs text-gray-500 mt-1">Matches</div>
                  </div>
                  <div className="text-center p-3 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">{stats.wins}</div>
                    <div className="text-xs text-gray-500 mt-1">Wins</div>
                  </div>
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <div className="text-2xl font-bold text-gray-800">{stats.win_rate.toFixed(1)}%</div>
                    <div className="text-xs text-gray-500 mt-1">Win Rate</div>
                  </div>
                </div>
              </div>

              {/* Accuracy */}
              <div>
                <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">Accuracy</h3>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="text-3xl font-bold text-gray-800 mb-2">{stats.accuracy.toFixed(1)}%</div>
                  <div className="text-sm text-gray-600">Cell Accuracy</div>
                  <div className="text-xs text-gray-500 mt-2">
                    {stats.total_matches > 0 ? (
                      <>
                        {Math.round((stats.accuracy / 100) * (stats.total_matches * 81))} cells completed •{' '}
                        {Math.round(((100 - stats.accuracy) / 100) * (stats.total_matches * 81))} mistakes
                      </>
                    ) : (
                      'No matches played'
                    )}
                  </div>
                </div>
              </div>

              {/* Rating Changes */}
              <div>
                <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">Rating Changes</h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-gray-700">Last 24 hours</span>
                    <span className={`font-mono font-semibold ${getRatingChangeColor(stats.rating_change_1d)}`}>
                      {formatRatingChange(stats.rating_change_1d)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-gray-700">Last 30 days</span>
                    <span className={`font-mono font-semibold ${getRatingChangeColor(stats.rating_change_30d)}`}>
                      {formatRatingChange(stats.rating_change_30d)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-gray-700">Last 90 days</span>
                    <span className={`font-mono font-semibold ${getRatingChangeColor(stats.rating_change_90d)}`}>
                      {formatRatingChange(stats.rating_change_90d)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-gray-700">All time</span>
                    <span className={`font-mono font-semibold ${getRatingChangeColor(stats.rating_change_all_time)}`}>
                      {formatRatingChange(stats.rating_change_all_time)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

