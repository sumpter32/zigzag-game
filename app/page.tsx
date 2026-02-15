'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface Tile {
  x: number;
  y: number;
  gem?: boolean;
}

const TILE_SIZE = 40;
const BALL_SIZE = 24;

export default function Zigzag() {
  const [gameState, setGameState] = useState<'menu' | 'playing' | 'over'>('menu');
  const [ballPos, setBallPos] = useState({ x: 0, y: 0 });
  const [direction, setDirection] = useState<1 | -1>(1); // 1 = right-down, -1 = left-down
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  const [cameraY, setCameraY] = useState(0);
  const [gems, setGems] = useState(0);
  const audioRef = useRef<AudioContext | null>(null);

  const beep = useCallback((freq: number, dur = 0.08) => {
    try {
      if (!audioRef.current) audioRef.current = new AudioContext();
      const o = audioRef.current.createOscillator();
      const g = audioRef.current.createGain();
      o.connect(g); g.connect(audioRef.current.destination);
      o.frequency.value = freq;
      o.type = 'sine';
      g.gain.value = 0.1;
      o.start();
      g.gain.exponentialRampToValueAtTime(0.001, audioRef.current.currentTime + dur);
      o.stop(audioRef.current.currentTime + dur);
    } catch {}
  }, []);

  const generatePath = useCallback((startX: number, startY: number, length: number): Tile[] => {
    const path: Tile[] = [];
    let x = startX;
    let y = startY;
    let dir = 1;
    
    for (let i = 0; i < length; i++) {
      const hasGem = i > 5 && Math.random() < 0.15;
      path.push({ x, y, gem: hasGem });
      
      // Zigzag pattern - change direction occasionally
      if (Math.random() < 0.3 && i > 0) {
        dir *= -1;
      }
      
      x += dir * TILE_SIZE;
      y += TILE_SIZE;
    }
    
    return path;
  }, []);

  const start = useCallback(() => {
    const initialPath = generatePath(150, 100, 100);
    setTiles(initialPath);
    setBallPos({ x: initialPath[0].x + TILE_SIZE / 2, y: initialPath[0].y + TILE_SIZE / 2 });
    setDirection(1);
    setScore(0);
    setGems(0);
    setCameraY(0);
    setGameState('playing');
  }, [generatePath]);

  // Game loop
  useEffect(() => {
    if (gameState !== 'playing') return;

    const speed = 4;
    
    const loop = setInterval(() => {
      setBallPos(prev => {
        const newX = prev.x + direction * speed;
        const newY = prev.y + speed;
        
        // Update camera
        setCameraY(newY - 200);
        
        // Check if on a tile
        const onTile = tiles.some(tile => {
          const tileLeft = tile.x;
          const tileRight = tile.x + TILE_SIZE;
          const tileTop = tile.y;
          const tileBottom = tile.y + TILE_SIZE;
          
          return newX > tileLeft && newX < tileRight && 
                 newY > tileTop - 5 && newY < tileBottom + 10;
        });

        if (!onTile) {
          // Fell off!
          beep(150, 0.3);
          setGameState('over');
          setBestScore(b => Math.max(b, score));
          return prev;
        }

        // Check for gems
        tiles.forEach((tile, i) => {
          if (tile.gem && 
              Math.abs(newX - (tile.x + TILE_SIZE/2)) < 20 &&
              Math.abs(newY - (tile.y + TILE_SIZE/2)) < 20) {
            setTiles(prev => {
              const updated = [...prev];
              updated[i] = { ...updated[i], gem: false };
              return updated;
            });
            setGems(g => g + 1);
            setScore(s => s + 5);
            beep(880, 0.1);
          }
        });

        // Score based on distance
        const newScore = Math.floor(newY / TILE_SIZE);
        if (newScore > score) {
          setScore(newScore);
          if (newScore % 10 === 0) beep(440, 0.05);
        }

        return { x: newX, y: newY };
      });
    }, 20);

    return () => clearInterval(loop);
  }, [gameState, direction, tiles, score, beep]);

  // Extend path as needed
  useEffect(() => {
    if (gameState !== 'playing') return;
    
    const lastTile = tiles[tiles.length - 1];
    if (lastTile && ballPos.y > lastTile.y - 500) {
      const newTiles = generatePath(
        lastTile.x + (Math.random() > 0.5 ? TILE_SIZE : -TILE_SIZE),
        lastTile.y + TILE_SIZE,
        50
      );
      setTiles(prev => [...prev.slice(-100), ...newTiles]);
    }
  }, [ballPos.y, tiles, gameState, generatePath]);

  const tap = useCallback(() => {
    if (gameState === 'playing') {
      setDirection(d => (d === 1 ? -1 : 1) as 1 | -1);
      beep(600, 0.05);
    } else {
      start();
    }
  }, [gameState, start, beep]);

  // Input
  useEffect(() => {
    const handle = (e: Event) => { e.preventDefault(); tap(); };
    const keyHandle = (e: KeyboardEvent) => { if (e.code === 'Space') { e.preventDefault(); tap(); } };
    
    window.addEventListener('mousedown', handle);
    window.addEventListener('touchstart', handle);
    window.addEventListener('keydown', keyHandle);
    return () => {
      window.removeEventListener('mousedown', handle);
      window.removeEventListener('touchstart', handle);
      window.removeEventListener('keydown', keyHandle);
    };
  }, [tap]);

  return (
    <div className="h-screen flex flex-col items-center justify-center bg-gradient-to-b from-indigo-950 via-slate-900 to-slate-950">
      {/* Score */}
      <div className="absolute top-6 left-0 right-0 flex justify-center gap-8 z-10">
        <div className="text-center">
          <div className="text-4xl font-bold text-white">{score}</div>
          <div className="text-xs text-indigo-300">SCORE</div>
        </div>
        {gems > 0 && (
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-400">💎 {gems}</div>
          </div>
        )}
      </div>

      {/* Game area */}
      <div className="relative overflow-hidden rounded-2xl border-2 border-indigo-500/30 bg-slate-900/50"
           style={{ width: 320, height: 500 }}>
        
        {/* Tiles */}
        <div style={{ transform: `translateY(${-cameraY}px)` }}>
          {tiles.map((tile, i) => (
            <div key={i}>
              <div
                className="absolute"
                style={{
                  left: tile.x,
                  top: tile.y,
                  width: TILE_SIZE,
                  height: TILE_SIZE,
                  background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                  borderRadius: 4,
                  boxShadow: '0 4px 15px rgba(99, 102, 241, 0.3)',
                }}
              />
              {tile.gem && (
                <div
                  className="absolute text-xl animate-pulse"
                  style={{
                    left: tile.x + TILE_SIZE/2 - 10,
                    top: tile.y + TILE_SIZE/2 - 12,
                  }}
                >
                  💎
                </div>
              )}
            </div>
          ))}
          
          {/* Ball */}
          {gameState === 'playing' && (
            <div
              className="absolute rounded-full"
              style={{
                left: ballPos.x - BALL_SIZE / 2,
                top: ballPos.y - BALL_SIZE / 2,
                width: BALL_SIZE,
                height: BALL_SIZE,
                background: 'linear-gradient(135deg, #f472b6, #ec4899)',
                boxShadow: '0 0 20px #ec4899aa, 0 4px 10px rgba(0,0,0,0.3)',
              }}
            />
          )}
        </div>

        {/* Direction indicator */}
        {gameState === 'playing' && (
          <div className="absolute top-4 right-4 text-2xl">
            {direction === 1 ? '↘️' : '↙️'}
          </div>
        )}

        {/* Menu */}
        {gameState === 'menu' && (
          <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center">
            <div className="text-6xl mb-4">🔀</div>
            <h1 className="text-4xl font-bold text-white mb-2">ZIGZAG</h1>
            <p className="text-indigo-300 mb-6 text-center px-8">
              Tap to change direction!<br/>Stay on the path!
            </p>
            <div className="flex gap-4 text-3xl mb-4">
              <span>↙️</span>
              <span>TAP</span>
              <span>↘️</span>
            </div>
            <div className="bg-indigo-500 px-8 py-3 rounded-full text-white font-bold text-lg">
              TAP TO START
            </div>
          </div>
        )}

        {/* Game Over */}
        {gameState === 'over' && (
          <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center">
            <div className="text-5xl mb-2">💥</div>
            <h2 className="text-2xl font-bold text-white mb-2">GAME OVER</h2>
            <div className="text-5xl font-bold text-indigo-300 mb-1">{score}</div>
            {gems > 0 && <p className="text-yellow-400">💎 {gems} gems</p>}
            {score >= bestScore && score > 0 && (
              <p className="text-yellow-400 text-lg mt-2">🏆 NEW BEST!</p>
            )}
            <div className="bg-indigo-500 px-6 py-2 rounded-full text-white font-bold mt-4">
              TAP TO RETRY
            </div>
          </div>
        )}
      </div>

      <p className="mt-4 text-indigo-400 text-sm">Tap anywhere to zigzag!</p>
      {bestScore > 0 && <p className="text-indigo-500 text-xs mt-1">Best: {bestScore}</p>}
    </div>
  );
}
