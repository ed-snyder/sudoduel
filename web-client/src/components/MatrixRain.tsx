import { useEffect, useState } from 'react';

interface Drop {
  id: number;
  x: number;
  digit: number;
  duration: number;
  delay: number;
  size: number;
  opacity: number;
}

export default function MatrixRain() {
  const [drops, setDrops] = useState<Drop[]>([]);

  useEffect(() => {
    const generateDrops = () => {
      const newDrops: Drop[] = [];
      const count = 40; // Number of falling digits on screen
      
      for (let i = 0; i < count; i++) {
        newDrops.push({
          id: i,
          x: Math.random() * 100, // percentage across screen
          digit: Math.floor(Math.random() * 9) + 1, // 1-9
          duration: 8 + Math.random() * 12, // 8-20 seconds to fall
          delay: Math.random() * 10, // staggered start
          size: 10 + Math.random() * 14, // 10-24px
          opacity: 0.1 + Math.random() * 0.3, // 0.1-0.4 opacity
        });
      }
      setDrops(newDrops);
    };

    generateDrops();
  }, []);

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 0 }}>
      {drops.map((drop) => (
        <span
          key={drop.id}
          className="absolute font-display text-white animate-matrix-fall"
          style={{
            left: `${drop.x}%`,
            fontSize: `${drop.size}px`,
            opacity: drop.opacity,
            animationDuration: `${drop.duration}s`,
            animationDelay: `${drop.delay}s`,
            fontFamily: "'Industry', 'Orbitron', sans-serif",
            fontWeight: 900,
          }}
        >
          {drop.digit}
        </span>
      ))}
    </div>
  );
}
