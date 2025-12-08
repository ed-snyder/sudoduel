import { useState, useEffect } from 'react';
import { playerAPI } from '../services/api';
import PlayerActionModal from './PlayerActionModal';
import ReportModal from './ReportModal';
import { sendFriendRequest, reportUser } from '../services/socialService';
import { useAuth } from '../context/AuthContext';

interface MatchHistoryEntry {
  match_id: number;
  date: Date;
  opponent_id: number;
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
  const { token, user } = useAuth();
  const [matches, setMatches] = useState<MatchHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState<{ id: number; name: string } | null>(null);
  const [showPlayerModal, setShowPlayerModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportPlayerId, setReportPlayerId] = useState<number | null>(null);
  const [reportPlayerName, setReportPlayerName] = useState('');

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

  const handlePlayerClick = (playerId: number, playerName: string) => {
    // Don't allow clicking yourself
    if (playerId === user?.id) return;
    
    setSelectedPlayer({ id: playerId, name: playerName });
    setShowPlayerModal(true);
  };

  const handleAddFriend = async (playerId: number) => {
    if (!token) throw new Error('Not authenticated');
    await sendFriendRequest(token, playerId);
  };

  const handleOpenReport = (playerId: number) => {
    if (selectedPlayer) {
      setReportPlayerId(playerId);
      setReportPlayerName(selectedPlayer.name);
      setShowPlayerModal(false);
      setShowReportModal(true);
    }
  };

  const handleSubmitReport = async (playerId: number, reason: string, details?: string) => {
    if (!token) throw new Error('Not authenticated');
    await reportUser(token, playerId, reason, details);
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
                      <span className="font-display font-black text-primary">vs </span>
                      <button
                        onClick={() => handlePlayerClick(match.opponent_id, match.opponent_name)}
                        className="font-display font-black text-opponent hover:underline text-left truncate disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={match.opponent_id === user?.id}
                      >
                        {match.opponent_name}
                      </button>
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

      {/* Player Action Modal */}
      {selectedPlayer && (
        <PlayerActionModal
          isOpen={showPlayerModal}
          onClose={() => {
            setShowPlayerModal(false);
            setSelectedPlayer(null);
          }}
          playerName={selectedPlayer.name}
          playerId={selectedPlayer.id}
          onAddFriend={handleAddFriend}
          onReport={handleOpenReport}
        />
      )}

      {/* Report Modal */}
      <ReportModal
        isOpen={showReportModal}
        onClose={() => {
          setShowReportModal(false);
          setReportPlayerId(null);
          setReportPlayerName('');
        }}
        playerName={reportPlayerName}
        playerId={reportPlayerId || 0}
        onSubmitReport={handleSubmitReport}
      />
    </div>
  );
}
