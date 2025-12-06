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
    <div className="fixed inset-0 bg-void/90 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
      <div 
        className="bg-surface border-2 border-opponent rounded-xl w-full max-w-md shadow-2xl max-h-[90vh] flex flex-col animate-scale-in"
        style={{ 
          boxShadow: '0 0 20px rgba(255, 0, 255, 0.4), 0 0 40px rgba(255, 0, 255, 0.2), 0 0 60px rgba(255, 0, 255, 0.1)'
        }}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-grid-line flex items-center justify-between">
          <div>
            <h2 className="text-xl font-display font-black text-primary tracking-wide">MATCH HISTORY</h2>
            <p className="text-sm text-muted font-display mt-1">
              {playerName} • <span className="text-player font-display">{Math.round(currentRating)}</span>
            </p>
          </div>
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
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-10 h-10 border-4 border-surface border-t-player rounded-full animate-spin" 
                style={{ boxShadow: '0 0 15px rgba(0,255,255,0.3)' }} />
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-error font-body">{error}</p>
            </div>
          ) : matches.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted font-display">No matches yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {matches.map((match) => (
                <div
                  key={match.match_id}
                  className="flex items-center gap-3 p-3 rounded-lg bg-elevated/50 border border-grid-line/50 hover:border-player/30 transition-all"
                >
                  {/* Result badge */}
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center font-display font-black text-sm flex-shrink-0 ${
                      match.result === 'WIN'
                        ? 'bg-success/20 text-success border border-success/50'
                        : match.result === 'LOSS'
                        ? 'bg-error/20 text-error border border-error/50'
                        : 'bg-muted/20 text-muted border border-muted/50'
                    }`}
                  >
                    {match.result[0]}
                  </div>

                  {/* Match info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-display font-black text-primary">vs {match.opponent_name}</span>
                      <span className="text-xs text-muted font-display">{formatDate(match.date)}</span>
                    </div>
                    <div className="text-xs text-muted font-display mt-1">
                      {match.cells_completed} cells • {match.mistakes} mistakes
                    </div>
                  </div>

                  {/* Rating change */}
                  <div
                    className={`text-sm font-display font-black flex-shrink-0 ${
                      match.rating_change > 0
                        ? 'text-success'
                        : match.rating_change < 0
                        ? 'text-error'
                        : 'text-muted'
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
