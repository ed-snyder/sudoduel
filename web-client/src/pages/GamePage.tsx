import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import SudokuGrid from '../components/SudokuGrid';
import NumberPad from '../components/NumberPad';

interface GamePageProps {
  matchId: number;
  onGameEnd: () => void;
}

interface PlayerState {
  cells_completed: number;
  lives_remaining: number;
  is_locked_out: boolean;
  is_solved: boolean;
}

export default function GamePage({ matchId, onGameEnd }: GamePageProps) {
  const { token } = useAuth();
  const wsRef = useRef<WebSocket | null>(null);
  
  const [myGrid, setMyGrid] = useState<number[][]>([]);
  const [initialGrid, setInitialGrid] = useState<number[][]>([]);
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null);
  const [myState, setMyState] = useState<PlayerState>({ cells_completed: 0, lives_remaining: 3, is_locked_out: false, is_solved: false });
  const [opponentState, setOpponentState] = useState<PlayerState>({ cells_completed: 0, lives_remaining: 3, is_locked_out: false, is_solved: false });
  const [mySlot, setMySlot] = useState<number>(0);
  const [myPlayerId, setMyPlayerId] = useState<number>(0);
  const [gameStatus, setGameStatus] = useState<'connecting' | 'waiting' | 'playing' | 'ended'>('connecting');
  const [timeLeft, setTimeLeft] = useState(300);
  const [gameResult, setGameResult] = useState<any>(null);
  const [lastMoveResult, setLastMoveResult] = useState<{ correct: boolean; row: number; col: number } | null>(null);

  // Connect to WebSocket
  useEffect(() => {
    const ws = new WebSocket(
      `ws://localhost:3001/ws/game?match_id=${matchId}&token=${token}`
    );
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('Connected to game server');
      setGameStatus('waiting');
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      handleMessage(message);
    };

    ws.onclose = () => {
      console.log('Disconnected from game server');
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    return () => {
      ws.close();
    };
  }, [matchId, token]);

  // Timer countdown
  useEffect(() => {
    if (gameStatus !== 'playing') return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 0) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gameStatus]);

  // Clear last move result after animation
  useEffect(() => {
    if (lastMoveResult) {
      const timer = setTimeout(() => setLastMoveResult(null), 500);
      return () => clearTimeout(timer);
    }
  }, [lastMoveResult]);

  const handleMessage = (message: any) => {
    console.log('Received:', message);

    switch (message.type) {
      case 'GAME_STATE':
        setMySlot(message.data.your_slot);
        if (message.data.your_slot === 1) {
          setMyState(message.data.player1);
          setOpponentState(message.data.player2);
        } else {
          setMyState(message.data.player2);
          setOpponentState(message.data.player1);
        }
        break;

      case 'GAME_START':
        const grid = message.data.initial_grid;
        setMyGrid(grid.map((row: number[]) => [...row]));
        setInitialGrid(grid.map((row: number[]) => [...row]));
        setTimeLeft(message.data.time_limit);
        setGameStatus('playing');
        break;

      case 'MOVE_RESULT':
        const { player_id, row, col, value, correct, player_state } = message.data;
        
        // Determine if this move was made by me or opponent
        // player_id in MOVE_RESULT is the player_profile id
        const isMyMove = (mySlot === 1 && player_state.slot === 1) || 
                         (mySlot === 2 && player_state.slot === 2) ||
                         player_id === myPlayerId;

        console.log(`Move by player ${player_id}, isMyMove: ${isMyMove}, correct: ${correct}`);

        if (isMyMove) {
          // Update MY grid and state
          if (correct) {
            setMyGrid((prev) => {
              const newGrid = prev.map((r) => [...r]);
              newGrid[row][col] = value;
              return newGrid;
            });
          }
          setMyState(player_state);
          setLastMoveResult({ correct, row, col });
        } else {
          // Update opponent state only (not their grid - we can't see it!)
          setOpponentState(player_state);
        }
        break;

      case 'GAME_END':
        setGameStatus('ended');
        setGameResult(message.data);
        break;
    }
  };

  const handleCellClick = (row: number, col: number) => {
    if (gameStatus !== 'playing' || myState?.is_locked_out) return;
    setSelectedCell({ row, col });
  };

  const handleNumberClick = (num: number) => {
    if (!selectedCell || gameStatus !== 'playing' || myState?.is_locked_out) return;

    wsRef.current?.send(
      JSON.stringify({
        type: 'PLACE_NUMBER',
        data: {
          row: selectedCell.row,
          col: selectedCell.col,
          value: num,
        },
      })
    );
    
    setSelectedCell(null);
  };

  const handleErase = () => {
    // Not implemented
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Connecting screen
  if (gameStatus === 'connecting') {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Connecting to game...</div>
      </div>
    );
  }

  // Waiting for opponent
  if (gameStatus === 'waiting') {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl animate-pulse">
          Waiting for opponent to connect...
        </div>
      </div>
    );
  }

  // Game ended
  if (gameStatus === 'ended' && gameResult) {
    const myResult = mySlot === 1 ? gameResult.player1 : gameResult.player2;
    const opponentResult = mySlot === 1 ? gameResult.player2 : gameResult.player1;
    const didWin = myResult.isWinner;
    const isDraw = !gameResult.winner_id;

    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-gray-800 rounded-lg p-8 text-center max-w-md w-full">
          <h1 className={`text-4xl font-bold mb-4 ${
            isDraw ? 'text-yellow-400' : didWin ? 'text-green-400' : 'text-red-400'
          }`}>
            {isDraw ? '🤝 Draw!' : didWin ? '🎉 Victory!' : '😔 Defeat'}
          </h1>
          
          {/* Win reason */}
          <p className="text-gray-300 mb-4">
            {myResult.finalState === 'SOLVED' && 'You completed the puzzle!'}
            {myResult.finalState === 'LOCKED_OUT' && 'You ran out of lives'}
            {myResult.finalState === 'TIMEOUT' && 'Time ran out'}
            {opponentResult.finalState === 'LOCKED_OUT' && didWin && 'Opponent ran out of lives'}
            {opponentResult.finalState === 'SOLVED' && !didWin && 'Opponent completed the puzzle'}
          </p>

          {/* Stats comparison */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-gray-700 rounded-lg p-4">
              <p className="text-blue-400 font-bold mb-2">You</p>
              <p className="text-white">📊 {myResult.cellsCompleted} cells</p>
              <p className="text-white">❌ {myResult.mistakes} mistakes</p>
              <p className="text-white">❤️ {myResult.livesRemaining} lives left</p>
            </div>
            <div className="bg-gray-700 rounded-lg p-4">
              <p className="text-red-400 font-bold mb-2">Opponent</p>
              <p className="text-white">📊 {opponentResult.cellsCompleted} cells</p>
              <p className="text-white">❌ {opponentResult.mistakes} mistakes</p>
              <p className="text-white">❤️ {opponentResult.livesRemaining} lives left</p>
            </div>
          </div>

          {/* Rating change */}
          <div className="bg-gray-700 rounded-lg p-4 mb-6">
            <p className="text-gray-300 mb-2">Rating Change</p>
            <p className="text-2xl font-bold">
              <span className="text-white">{Math.round(myResult.rating_before)}</span>
              <span className="text-gray-400 mx-2">→</span>
              <span className="text-white">{Math.round(myResult.rating_after)}</span>
              <span className={`ml-2 ${myResult.rating_change > 0 ? 'text-green-400' : 'text-red-400'}`}>
                ({myResult.rating_change > 0 ? '+' : ''}{Math.round(myResult.rating_change)})
              </span>
            </p>
          </div>

          <button
            onClick={onGameEnd}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-lg transition w-full"
          >
            Back to Lobby
          </button>
        </div>
      </div>
    );
  }

  // Main game UI
  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-4">
      {/* Header */}
      <div className="flex justify-between items-center w-full max-w-lg mb-4">
        <div className="bg-blue-900/50 rounded-lg p-3">
          <p className="text-xs text-blue-300 uppercase">You</p>
          <p className="text-white font-bold">
            ❤️ {myState.lives_remaining} | 📊 {myState.cells_completed}/81
          </p>
          {myState.is_locked_out && (
            <p className="text-red-400 text-xs">LOCKED OUT</p>
          )}
        </div>
        
        <div className="text-center">
          <p className={`text-3xl font-bold font-mono ${timeLeft < 60 ? 'text-red-400' : 'text-white'}`}>
            {formatTime(timeLeft)}
          </p>
        </div>
        
        <div className="bg-red-900/50 rounded-lg p-3 text-right">
          <p className="text-xs text-red-300 uppercase">Opponent</p>
          <p className="text-white font-bold">
            ❤️ {opponentState.lives_remaining} | 📊 {opponentState.cells_completed}/81
          </p>
          {opponentState.is_locked_out && (
            <p className="text-green-400 text-xs">LOCKED OUT</p>
          )}
        </div>
      </div>

      {/* Status messages */}
      {myState.is_locked_out && (
        <div className="bg-red-500/20 border border-red-500 text-red-300 px-4 py-2 rounded mb-4">
          ⚠️ You're locked out! Waiting for timer or opponent...
        </div>
      )}
      
      {opponentState.is_locked_out && !myState.is_locked_out && (
        <div className="bg-green-500/20 border border-green-500 text-green-300 px-4 py-2 rounded mb-4">
          ✅ Opponent is locked out! Keep going to win!
        </div>
      )}

      {/* Sudoku Grid */}
      {myGrid.length > 0 && (
        <SudokuGrid
          grid={myGrid}
          initialGrid={initialGrid}
          selectedCell={selectedCell}
          onCellClick={handleCellClick}
        />
      )}

      {/* Last move feedback */}
      {lastMoveResult && (
        <div className={`mt-2 px-4 py-1 rounded ${lastMoveResult.correct ? 'bg-green-500/50 text-green-200' : 'bg-red-500/50 text-red-200'}`}>
          {lastMoveResult.correct ? '✓ Correct!' : '✗ Wrong! -1 life, +10s penalty'}
        </div>
      )}

      {/* Number Pad */}
      <NumberPad
        onNumberClick={handleNumberClick}
        onErase={handleErase}
        disabled={gameStatus !== 'playing' || myState.is_locked_out}
      />
    </div>
  );
}
