import { useState, useEffect, useRef, forwardRef } from 'react';
import { leaderboardAPI } from '../services/api';
import type { LeaderboardEntry } from '../services/api';

interface LeaderboardScreenProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function LeaderboardScreen({ isOpen, onClose }: LeaderboardScreenProps) {
  const [top100, setTop100] = useState<LeaderboardEntry[]>([]);
  const [neighborhood, setNeighborhood] = useState<LeaderboardEntry[]>([]);
  const [yourRank, setYourRank] = useState<number>(0);
  const [totalPlayers, setTotalPlayers] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const yourRowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    console.log('[LeaderboardScreen] isOpen changed:', isOpen);
    if (isOpen) {
      console.log('[LeaderboardScreen] Loading leaderboard...');
      loadLeaderboard();
    } else {
      // Reset state when closed
      setTop100([]);
      setNeighborhood([]);
      setYourRank(0);
      setTotalPlayers(0);
      setError('');
    }
  }, [isOpen]);

  const loadLeaderboard = async () => {
    setLoading(true);
    setError('');
    try {
      console.log('[LeaderboardScreen] Fetching leaderboard data...');
      const data = await leaderboardAPI.getLeaderboard();
      console.log('[LeaderboardScreen] Leaderboard data received:', {
        top100Count: data.top100.length,
        neighborhoodCount: data.neighborhood.length,
        yourRank: data.your_rank,
        totalPlayers: data.total_players,
      });
      setTop100(data.top100);
      setNeighborhood(data.neighborhood);
      setYourRank(data.your_rank);
      setTotalPlayers(data.total_players);
    } catch (err: any) {
      console.error('[LeaderboardScreen] Error loading leaderboard:', err);
      setError(err.message || 'Failed to load leaderboard');
    } finally {
      setLoading(false);
    }
  };

  const scrollToYourRank = () => {
    yourRowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  if (!isOpen) {
    console.log('[LeaderboardScreen] Not rendering - isOpen is false');
    return null;
  }

  console.log('[LeaderboardScreen] Rendering leaderboard screen');

  return (
    <div 
      className="fixed inset-0 z-50 flex flex-col bg-void"
      style={{ 
        paddingTop: 'env(safe-area-inset-top)', 
        paddingBottom: 'env(safe-area-inset-bottom)',
        border: '2px solid rgba(255, 0, 255, 0.6)',
        boxShadow: '0 0 30px rgba(255, 0, 255, 0.3), inset 0 0 30px rgba(255, 0, 255, 0.1)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-grid-line bg-surface">
        <button
          onClick={onClose}
          className="text-muted hover:text-player transition-colors p-1"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="font-heading font-bold text-lg text-primary">Leaderboard</h1>
        <div className="w-8" /> {/* Spacer for centering */}
      </div>

      {/* Season Info Banner */}
      <div className="px-4 py-3 bg-surface/50 border-b border-grid-line">
        <div className="flex justify-between text-sm">
          <div>
            <span className="text-muted" style={{ fontFamily: "'Industry', 'Orbitron', sans-serif" }}>Season: </span>
            <span className="text-secondary italic" style={{ fontFamily: "'Industry', 'Orbitron', sans-serif" }}>Coming Soon</span>
          </div>
          <div>
            <span className="text-muted" style={{ fontFamily: "'Industry', 'Orbitron', sans-serif" }}>League: </span>
            <span className="text-secondary italic" style={{ fontFamily: "'Industry', 'Orbitron', sans-serif" }}>Coming Soon</span>
          </div>
        </div>
        <div className="text-sm mt-1">
          <span className="text-muted" style={{ fontFamily: "'Industry', 'Orbitron', sans-serif" }}>Time Remaining: </span>
          <span className="text-secondary italic" style={{ fontFamily: "'Industry', 'Orbitron', sans-serif" }}>N/A</span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div 
              className="w-10 h-10 border-4 border-surface border-t-player rounded-full animate-spin"
              style={{ boxShadow: '0 0 15px rgba(0,255,255,0.3)' }} 
            />
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-error font-display">{error}</p>
            <button 
              onClick={loadLeaderboard}
              className="mt-4 px-4 py-2 text-player border border-player rounded-lg hover:bg-player/10"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="pb-24"> {/* Padding for sticky footer */}
            {/* Top 100 */}
            <div className="px-4 py-2">
              {top100.map((entry) => (
                <LeaderboardRow 
                  key={entry.player_id} 
                  entry={entry} 
                  ref={entry.is_you ? yourRowRef : undefined}
                />
              ))}
            </div>

            {/* Neighborhood Section (if user rank > 100) */}
            {neighborhood.length > 0 && (
              <>
                <div className="px-4 py-3 bg-elevated/30 border-y border-grid-line/50">
                  <p className="text-xs font-display font-black text-muted uppercase tracking-wider text-center">
                    ─ ─ ─  Your Neighborhood  ─ ─ ─
                  </p>
                </div>
                <div className="px-4 py-2">
                  {neighborhood.map((entry) => (
                    <LeaderboardRow 
                      key={entry.player_id} 
                      entry={entry}
                      ref={entry.is_you ? yourRowRef : undefined}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Sticky Footer - Your Rank */}
      {!loading && !error && (
        <div 
          className="absolute bottom-0 left-0 right-0 px-4 py-3 bg-surface border-t"
          style={{ 
            paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)',
            borderColor: 'rgba(255, 0, 255, 0.5)',
            boxShadow: '0 -4px 20px rgba(255, 0, 255, 0.3), 0 -8px 40px rgba(255, 0, 255, 0.15)'
          }}
        >
          <button
            onClick={scrollToYourRank}
            className="w-full flex items-center justify-between hover:bg-player/5 rounded-lg p-2 transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="text-player font-mono font-bold text-lg">
                #{yourRank.toLocaleString()}
              </span>
              <span className="text-primary font-display font-bold">You</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted font-mono">
                of {totalPlayers.toLocaleString()}
              </span>
              <svg className="w-4 h-4 text-player" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}

// Leaderboard Row Component
interface LeaderboardRowProps {
  entry: LeaderboardEntry;
}

const LeaderboardRow = forwardRef<HTMLDivElement, LeaderboardRowProps>(
  ({ entry }, ref) => {
    const isTopThree = entry.rank <= 3;
    const rankColors: Record<number, string> = {
      1: 'text-yellow-400', // Gold
      2: 'text-gray-300',   // Silver
      3: 'text-amber-600',  // Bronze
    };

    return (
      <div
        ref={ref}
        className={`flex items-center justify-between py-3 px-2 rounded-lg mb-1 transition-colors ${
          entry.is_you 
            ? 'bg-player/20 border border-player/50' 
            : 'hover:bg-elevated/30'
        }`}
      >
        <div className="flex items-center gap-3">
          {/* Rank */}
          <span 
            className={`font-mono font-bold text-sm w-12 ${
              isTopThree ? rankColors[entry.rank] : 'text-muted'
            }`}
          >
            #{entry.rank}
          </span>
          
          {/* Name */}
          <span className={`font-display font-semibold ${
            entry.is_you ? 'text-player' : 'text-primary'
          }`}>
            {entry.display_name}
            {entry.is_you && (
              <span className="ml-2 text-xs text-player/70 font-normal">← YOU</span>
            )}
          </span>
        </div>

        {/* Rating */}
        <span className={`font-mono font-bold ${
          entry.is_you ? 'text-player' : 'text-secondary'
        }`}>
          {entry.rating.toLocaleString()}
        </span>
      </div>
    );
  }
);

LeaderboardRow.displayName = 'LeaderboardRow';
