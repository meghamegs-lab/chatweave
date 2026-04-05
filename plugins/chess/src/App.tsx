import { useState, useEffect, useCallback, useRef } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';

// Inline SDK bridge since we can't import from the SDK package in a separate Vite app
// We'll use the raw postMessage protocol instead

interface PluginConfig {
  sessionId: string;
  theme: 'light' | 'dark';
  locale: string;
}

let messageCounter = 0;
function generateMessageId(): string {
  return `msg_${Date.now()}_${++messageCounter}`;
}

function sendToParent(message: any): void {
  if (window.parent && window.parent !== window) {
    window.parent.postMessage(message, '*');
  }
}

type GameState = {
  game: Chess;
  playerColor: 'white' | 'black';
  difficulty: 'easy' | 'medium' | 'hard';
  gameOver: boolean;
  result: string | null;
  startTime: number;
};

export default function App() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [error, setError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const gameRef = useRef<GameState | null>(null);

  // Keep ref in sync
  useEffect(() => {
    gameRef.current = gameState;
  }, [gameState]);

  // Handle tool invocations
  const handleToolInvoke = useCallback((messageId: string, toolName: string, parameters: Record<string, any>) => {
    setError(null);

    switch (toolName) {
      case 'start_chess_game': {
        const game = new Chess();
        const playerColor = parameters.color || 'white';
        const difficulty = parameters.difficulty || 'medium';
        const newState: GameState = {
          game,
          playerColor,
          difficulty,
          gameOver: false,
          result: null,
          startTime: Date.now(),
        };
        setGameState(newState);
        gameRef.current = newState;

        // If player is black, make AI move first
        if (playerColor === 'black') {
          setTimeout(() => makeAIMove(newState), 500);
        }

        sendToParent({
          type: 'TOOL_RESULT',
          messageId,
          payload: {
            result: {
              status: 'game_started',
              playerColor,
              difficulty,
              fen: game.fen(),
              message: `Chess game started! You are playing as ${playerColor}. ${playerColor === 'white' ? "It's your move." : "AI is making the first move..."}`,
            },
          },
        });

        // Send state update
        sendToParent({
          type: 'STATE_UPDATE',
          messageId: generateMessageId(),
          payload: {
            state: { fen: game.fen(), moveCount: 0, playerColor },
            summary: `New chess game: playing as ${playerColor}`,
          },
        });
        break;
      }

      case 'get_board_state': {
        const gs = gameRef.current;
        if (!gs) {
          sendToParent({
            type: 'TOOL_RESULT',
            messageId,
            payload: { result: null, error: 'No active game. Start a game first.' },
          });
          return;
        }
        sendToParent({
          type: 'TOOL_RESULT',
          messageId,
          payload: {
            result: {
              fen: gs.game.fen(),
              turn: gs.game.turn() === 'w' ? 'white' : 'black',
              inCheck: gs.game.inCheck(),
              isCheckmate: gs.game.isCheckmate(),
              isStalemate: gs.game.isStalemate(),
              isDraw: gs.game.isDraw(),
              moveNumber: gs.game.moveNumber(),
              legalMoves: gs.game.moves(),
            },
          },
        });
        break;
      }

      case 'get_move_history': {
        const gs = gameRef.current;
        if (!gs) {
          sendToParent({
            type: 'TOOL_RESULT',
            messageId,
            payload: { result: null, error: 'No active game. Start a game first.' },
          });
          return;
        }
        sendToParent({
          type: 'TOOL_RESULT',
          messageId,
          payload: {
            result: {
              moves: gs.game.history({ verbose: true }),
              pgn: gs.game.pgn(),
              moveCount: gs.game.history().length,
            },
          },
        });
        break;
      }

      default:
        sendToParent({
          type: 'TOOL_RESULT',
          messageId,
          payload: { result: null, error: `Unknown tool: ${toolName}` },
        });
    }
  }, []);

  // Listen for messages from the platform
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const data = event.data;
      if (!data || typeof data.type !== 'string') return;

      switch (data.type) {
        case 'PLUGIN_INIT':
          setTheme(data.payload?.theme || 'light');
          document.body.className = data.payload?.theme || 'light';
          setInitialized(true);
          break;
        case 'TOOL_INVOKE':
          handleToolInvoke(data.messageId, data.payload.toolName, data.payload.parameters);
          break;
        case 'THEME_UPDATE':
          setTheme(data.payload?.theme || 'light');
          document.body.className = data.payload?.theme || 'light';
          break;
        case 'PLUGIN_DESTROY':
          setGameState(null);
          break;
      }
    };

    window.addEventListener('message', handler);

    // Send PLUGIN_READY
    sendToParent({
      type: 'PLUGIN_READY',
      messageId: generateMessageId(),
      payload: { version: '1.0.0' },
    });

    return () => window.removeEventListener('message', handler);
  }, [handleToolInvoke]);

  // AI move logic
  const makeAIMove = useCallback((gs: GameState) => {
    if (!gs || gs.gameOver || gs.game.isGameOver()) return;

    const moves = gs.game.moves();
    if (moves.length === 0) return;

    let selectedMove: string;

    if (gs.difficulty === 'easy') {
      // Random move
      selectedMove = moves[Math.floor(Math.random() * moves.length)];
    } else if (gs.difficulty === 'hard') {
      // Prioritize captures, checks, then center control
      const captures = moves.filter(m => m.includes('x'));
      const checks = moves.filter(m => m.includes('+'));
      if (checks.length > 0) {
        selectedMove = checks[Math.floor(Math.random() * checks.length)];
      } else if (captures.length > 0) {
        selectedMove = captures[Math.floor(Math.random() * captures.length)];
      } else {
        selectedMove = moves[Math.floor(Math.random() * moves.length)];
      }
    } else {
      // Medium: 50% chance of smart move
      if (Math.random() > 0.5) {
        const captures = moves.filter(m => m.includes('x'));
        selectedMove = captures.length > 0
          ? captures[Math.floor(Math.random() * captures.length)]
          : moves[Math.floor(Math.random() * moves.length)];
      } else {
        selectedMove = moves[Math.floor(Math.random() * moves.length)];
      }
    }

    gs.game.move(selectedMove);
    checkGameOver(gs);

    setGameState({ ...gs });

    // Send state update
    sendToParent({
      type: 'STATE_UPDATE',
      messageId: generateMessageId(),
      payload: {
        state: { fen: gs.game.fen(), moveCount: gs.game.history().length, lastMove: selectedMove },
        summary: `AI played ${selectedMove}`,
      },
    });
  }, []);

  const checkGameOver = useCallback((gs: GameState) => {
    if (gs.game.isGameOver()) {
      gs.gameOver = true;
      let result: string;
      let winner: string | null = null;

      if (gs.game.isCheckmate()) {
        winner = gs.game.turn() === 'w' ? 'black' : 'white';
        result = `Checkmate! ${winner === gs.playerColor ? 'You win!' : 'AI wins!'}`;
      } else if (gs.game.isStalemate()) {
        result = 'Stalemate! The game is a draw.';
      } else if (gs.game.isDraw()) {
        result = 'Draw!';
      } else {
        result = 'Game over!';
      }

      gs.result = result;

      // Send completion
      sendToParent({
        type: 'PLUGIN_COMPLETE',
        messageId: generateMessageId(),
        payload: {
          event: 'game_finished',
          data: {
            winner: winner || 'draw',
            moveCount: gs.game.history().length,
            pgn: gs.game.pgn(),
            duration: Math.round((Date.now() - gs.startTime) / 1000),
          },
          summary: result,
        },
      });
    }
  }, []);

  const onDrop = useCallback((sourceSquare: string, targetSquare: string) => {
    if (!gameState || gameState.gameOver) return false;

    const isPlayerTurn =
      (gameState.playerColor === 'white' && gameState.game.turn() === 'w') ||
      (gameState.playerColor === 'black' && gameState.game.turn() === 'b');

    if (!isPlayerTurn) return false;

    try {
      const move = gameState.game.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: 'q',
      });

      if (!move) {
        setError('Invalid move!');
        setTimeout(() => setError(null), 2000);
        return false;
      }

      setError(null);
      checkGameOver(gameState);
      setGameState({ ...gameState });

      // Send state update
      sendToParent({
        type: 'STATE_UPDATE',
        messageId: generateMessageId(),
        payload: {
          state: { fen: gameState.game.fen(), moveCount: gameState.game.history().length, lastMove: move.san },
          summary: `You played ${move.san}`,
        },
      });

      // AI responds after a short delay
      if (!gameState.gameOver) {
        setTimeout(() => makeAIMove(gameState), 500);
      }

      return true;
    } catch {
      setError('Invalid move!');
      setTimeout(() => setError(null), 2000);
      return false;
    }
  }, [gameState, makeAIMove, checkGameOver]);

  const isDark = theme === 'dark';

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '16px',
    gap: '12px',
    width: '100%',
    maxWidth: '500px',
    margin: '0 auto',
  };

  const statusStyle: React.CSSProperties = {
    fontSize: '14px',
    fontWeight: 600,
    color: isDark ? '#ccc' : '#555',
    textAlign: 'center',
  };

  if (!gameState) {
    return (
      <div style={containerStyle}>
        <p style={{ ...statusStyle, fontSize: '16px', marginTop: '40px' }}>
          Waiting for the AI to start a chess game...
        </p>
        <p style={{ ...statusStyle, fontSize: '13px', opacity: 0.7 }}>
          Ask the chatbot: "Let's play chess!"
        </p>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <div style={statusStyle}>
        {gameState.gameOver
          ? gameState.result
          : `Move ${gameState.game.moveNumber()} · ${
              gameState.game.turn() === 'w' ? "White's" : "Black's"
            } turn${gameState.game.inCheck() ? ' (Check!)' : ''}`}
      </div>

      {error && (
        <div style={{ color: '#e74c3c', fontSize: '13px', fontWeight: 500 }}>
          {error}
        </div>
      )}

      <Chessboard
        position={gameState.game.fen()}
        onPieceDrop={onDrop}
        boardOrientation={gameState.playerColor}
        boardWidth={400}
        customDarkSquareStyle={{ backgroundColor: '#779952' }}
        customLightSquareStyle={{ backgroundColor: '#edeed1' }}
      />

      <div style={{ fontSize: '12px', color: isDark ? '#888' : '#999' }}>
        Playing as {gameState.playerColor} · {gameState.difficulty} difficulty ·{' '}
        {gameState.game.history().length} moves
      </div>

      {gameState.gameOver && (
        <button
          onClick={() => {
            const game = new Chess();
            const newState: GameState = {
              game,
              playerColor: gameState.playerColor,
              difficulty: gameState.difficulty,
              gameOver: false,
              result: null,
              startTime: Date.now(),
            };
            setGameState(newState);
            gameRef.current = newState;
            if (gameState.playerColor === 'black') {
              setTimeout(() => makeAIMove(newState), 500);
            }
          }}
          style={{
            padding: '10px 24px',
            fontSize: '15px',
            fontWeight: 600,
            background: '#4263eb',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            marginTop: '4px',
          }}
        >
          Play Again
        </button>
      )}
    </div>
  );
}
