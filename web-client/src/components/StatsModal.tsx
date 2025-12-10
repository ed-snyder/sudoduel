import { useState, useEffect } from 'react';
import { playerAPI } from '../services/api';
import { useSubscription } from '../context/SubscriptionContext';

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
  cpm: number;
  avgTimeAtWin: number;
  fastestWin: number;
  upsetRate: number;
  peakRating: number;
  currentWinStreak: number;
  bestWinStreak: number;
  avgCellStreak: number;
}

interface StatsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function StatCard({ label, value, sublabel, highlight, fire, color, locked }: { 
  label: string; 
  value: string; 
  sublabel?: string;
  highlight?: boolean;
  fire?: boolean;
  color?: 'cyan' | 'magenta' | 'gray';
  locked?: boolean;
}) {
  const textColorClass = locked ? 'text-muted/50'
    : color === 'cyan' ? 'text-player' 
    : color === 'magenta' ? 'text-opponent'
    : color === 'gray' ? 'text-muted'
    : highlight ? 'text-player' 
    : 'text-primary';

  return (
    <div className={`bg-elevated/50 rounded-lg p-3 border ${locked ? 'border-grid-line/30 opacity-50' : highlight ? 'border-player/50' : 'border-grid-line/50'}`}>
      <div className={`text-xl font-mono font-bold ${textColorClass}`}>
        {fire && !locked && <span className="mr-1">🔥</span>}
        {locked ? '🔒' : value}
      </div>
      <div className="text-xs text-muted font-body mt-1">{label}</div>
      {sublabel && <div className="text-xs text-muted/60 font-body">{sublabel}</div>}
    </div>
  );
}

export default function StatsModal({ isOpen, onClose }: StatsModalProps) {
  const { isPremium } = useSubscription();
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
    return change > 0 ? `+${Math.round(change)}` : Math.round(change).toString();
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-void/90 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
      <div 
        className="bg-surface border-2 border-opponent rounded-xl w-full max-w-md shadow-2xl max-h-[90vh] flex flex-col animate-scale-in"
        style={{ 
          boxShadow: '0 0 20px rgba(255, 0, 255, 0.4), 0 0 40px rgba(255, 0, 255, 0.2), 0 0 60px rgba(255, 0, 255, 0.1)'
        }}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-grid-line flex items-center justify-between">
          <h2 className="text-xl font-display font-black text-primary tracking-wide">STATISTICS</h2>
          <button
            onClick={onClose}
            className="text-muted hover:text-player transition-colors p-1"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-5">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-10 h-10 border-4 border-surface border-t-player rounded-full animate-spin"
                style={{ boxShadow: '0 0 15px rgba(0,255,255,0.3)' }} />
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-error font-display">{error}</p>
            </div>
          ) : stats ? (
            <div className="space-y-6">
              {/* Current Rating */}
              <div className="text-center py-4 bg-elevated/30 rounded-xl border border-player/30">
                <div className="text-4xl font-display font-black text-player" style={{ textShadow: '0 0 20px rgba(0,255,255,0.5)' }}>
                  {Math.round(stats.current_rating)}
                </div>
                <div className="text-sm text-muted font-display mt-1">Current Rating</div>
              </div>

              {/* W-L-D Record */}
              <div>
                <h3 className="text-sm font-display font-black text-primary uppercase tracking-wider mb-3">Record</h3>
                <div className="grid grid-cols-3 gap-2">
                  <StatCard label="Wins" value={stats.wins.toString()} color="cyan" />
                  <StatCard label="Losses" value={stats.losses.toString()} color="magenta" />
                  <StatCard label="Draws" value={stats.draws.toString()} color="gray" />
                </div>
              </div>

              {/* Speed Stats - PREMIUM */}
              <div>
                <h3 className="text-sm font-display font-black text-player uppercase tracking-wider mb-3 flex items-center gap-2">
                  Speed
                  {!isPremium && <span className="text-xs text-muted font-body normal-case">PREMIUM</span>}
                </h3>
                <div className="grid grid-cols-3 gap-2">
                  <StatCard label="CPM" value={stats.cpm.toFixed(1)} sublabel="cells/min" locked={!isPremium} />
                  <StatCard label="Avg Win" value={formatTime(stats.avgTimeAtWin)} sublabel="time left" locked={!isPremium} />
                  <StatCard label="Fastest" value={formatTime(stats.fastestWin)} sublabel="best win" highlight locked={!isPremium} />
                </div>
              </div>

              {/* Competition Stats - PREMIUM */}
              <div>
                <h3 className="text-sm font-display font-black text-opponent uppercase tracking-wider mb-3 flex items-center gap-2">
                  Competition
                  {!isPremium && <span className="text-xs text-muted font-body normal-case">PREMIUM</span>}
                </h3>
                <div className="grid grid-cols-3 gap-2">
                  <StatCard label="Upset Rate" value={`${stats.upsetRate.toFixed(0)}%`} sublabel="vs higher" locked={!isPremium} />
                  <StatCard label="Peak" value={Math.round(stats.peakRating).toString()} sublabel="all-time" highlight locked={!isPremium} />
                  <StatCard label="Win Rate" value={`${stats.win_rate.toFixed(0)}%`} sublabel={`${stats.total_matches} games`} locked={!isPremium} />
                </div>
              </div>

              {/* Streak Stats - PREMIUM */}
              <div>
                <h3 className="text-sm font-display font-black text-warning uppercase tracking-wider mb-3 flex items-center gap-2">
                  Streaks
                  {!isPremium && <span className="text-xs text-muted font-body normal-case">PREMIUM</span>}
                </h3>
                <div className="grid grid-cols-3 gap-2">
                  <StatCard label="Current" value={stats.currentWinStreak.toString()} sublabel="win streak" fire={stats.currentWinStreak >= 3} locked={!isPremium} />
                  <StatCard label="Best" value={stats.bestWinStreak.toString()} sublabel="all-time" locked={!isPremium} />
                  <StatCard label="Avg Cell" value={stats.avgCellStreak.toFixed(1)} sublabel="in-game" locked={!isPremium} />
                </div>
              </div>

              {/* Rating Changes */}
              <div>
                <h3 className="text-sm font-display font-black text-secondary uppercase tracking-wider mb-3">Rating History</h3>
                <div className="grid grid-cols-4 gap-2">
                  <div className="bg-elevated/50 rounded-lg p-2 border border-grid-line/50 text-center">
                    <div className={`text-sm font-display font-black ${(stats.rating_change_1d ?? 0) >= 0 ? 'text-success' : 'text-error'}`}>
                      {formatRatingChange(stats.rating_change_1d)}
                    </div>
                    <div className="text-xs text-muted font-display">24h</div>
                  </div>
                  <div className="bg-elevated/50 rounded-lg p-2 border border-grid-line/50 text-center">
                    <div className={`text-sm font-display font-black ${(stats.rating_change_30d ?? 0) >= 0 ? 'text-success' : 'text-error'}`}>
                      {formatRatingChange(stats.rating_change_30d)}
                    </div>
                    <div className="text-xs text-muted font-display">30d</div>
                  </div>
                  <div className="bg-elevated/50 rounded-lg p-2 border border-grid-line/50 text-center">
                    <div className={`text-sm font-display font-black ${(stats.rating_change_90d ?? 0) >= 0 ? 'text-success' : 'text-error'}`}>
                      {formatRatingChange(stats.rating_change_90d)}
                    </div>
                    <div className="text-xs text-muted font-display">90d</div>
                  </div>
                  <div className="bg-elevated/50 rounded-lg p-2 border border-grid-line/50 text-center">
                    <div className={`text-sm font-display font-black ${(stats.rating_change_all_time ?? 0) >= 0 ? 'text-success' : 'text-error'}`}>
                      {formatRatingChange(stats.rating_change_all_time)}
                    </div>
                    <div className="text-xs text-muted font-display">All</div>
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
