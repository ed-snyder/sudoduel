import { useState, useEffect } from 'react';
import { playerAPI } from '../services/api';

interface PlayerStats {
  // Existing stats
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
  
  // New speed stats
  cpm: number;                    // Cells per minute
  avgTimeAtWin: number;           // Seconds remaining on wins
  fastestWin: number;             // Seconds remaining on fastest win
  
  // New competition stats
  upsetRate: number;              // Win % vs higher-rated opponents (0-100)
  peakRating: number;             // Highest rating achieved
  
  // New streak stats
  currentWinStreak: number;       // Current consecutive wins
  bestWinStreak: number;          // Best ever consecutive wins
  avgCellStreak: number;          // Average longest in-game streak
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

  const formatTime = (seconds: number): string => {
    if (seconds === 0) return '—';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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

              {/* Speed Stats */}
              <div>
                <h3 className="text-sm font-medium text-cyan-500 uppercase tracking-wide mb-3">Speed</h3>
                <div className="grid grid-cols-3 gap-3">
                  <StatCard 
                    label="CPM" 
                    value={stats.cpm.toFixed(1)} 
                    sublabel="cells/min"
                  />
                  <StatCard 
                    label="Avg Win Time" 
                    value={formatTime(stats.avgTimeAtWin)} 
                    sublabel="remaining"
                  />
                  <StatCard 
                    label="Fastest Win" 
                    value={formatTime(stats.fastestWin)} 
                    sublabel="remaining"
                  />
                </div>
              </div>

              {/* Competition Stats */}
              <div>
                <h3 className="text-sm font-medium text-pink-500 uppercase tracking-wide mb-3">Competition</h3>
                <div className="grid grid-cols-3 gap-3">
                  <StatCard 
                    label="Upset Rate" 
                    value={`${stats.upsetRate.toFixed(0)}%`} 
                    sublabel="vs higher rated"
                  />
                  <StatCard 
                    label="Peak Rating" 
                    value={Math.round(stats.peakRating).toString()} 
                    sublabel="all-time high"
                    highlight
                  />
                  <StatCard 
                    label="Win Rate" 
                    value={`${stats.win_rate.toFixed(0)}%`} 
                    sublabel={`${stats.total_matches} games`}
                  />
                </div>
              </div>

              {/* Streak Stats */}
              <div>
                <h3 className="text-sm font-medium text-orange-500 uppercase tracking-wide mb-3">Streaks</h3>
                <div className="grid grid-cols-3 gap-3">
                  <StatCard 
                    label="Win Streak" 
                    value={stats.currentWinStreak.toString()} 
                    sublabel="current"
                    fire={stats.currentWinStreak >= 3}
                  />
                  <StatCard 
                    label="Best Streak" 
                    value={stats.bestWinStreak.toString()} 
                    sublabel="all-time"
                  />
                  <StatCard 
                    label="Avg Cell Streak" 
                    value={stats.avgCellStreak.toFixed(1)} 
                    sublabel="in-game"
                  />
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

function StatCard({ 
  label, 
  value, 
  sublabel, 
  highlight = false,
  fire = false 
}: { 
  label: string; 
  value: string; 
  sublabel: string;
  highlight?: boolean;
  fire?: boolean;
}) {
  return (
    <div className={`
      bg-gray-800 rounded-lg p-3 text-center border
      ${highlight ? 'border-cyan-500 shadow-[0_0_10px_rgba(0,255,255,0.3)]' : 'border-gray-700'}
    `}>
      <div className="text-gray-400 text-xs mb-1">{label}</div>
      <div className={`
        text-xl font-bold font-mono
        ${highlight ? 'text-cyan-400' : 'text-white'}
      `}>
        {value}
        {fire && <span className="ml-1">🔥</span>}
      </div>
      <div className="text-gray-500 text-xs">{sublabel}</div>
    </div>
  );
}

