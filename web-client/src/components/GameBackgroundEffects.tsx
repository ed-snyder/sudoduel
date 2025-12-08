import { useEffect, useState, memo } from 'react';



interface GameBackgroundEffectsProps {

  playerScored?: boolean;

  opponentScored?: boolean;

  mistakeMade?: boolean;

  timeRemaining?: number;

  criticalTime?: number;

}



const GameBackgroundEffects = memo(function GameBackgroundEffects({ 

  playerScored, 

  opponentScored, 

  mistakeMade,

  timeRemaining = 999,

  criticalTime = 30 

}: GameBackgroundEffectsProps) {

  const [cyanPulse, setCyanPulse] = useState(false);

  const [magentaPulse, setMagentaPulse] = useState(false);

  const [dimmed, setDimmed] = useState(false);



  // Cyan pulse on player score

  useEffect(() => {

    if (playerScored) {

      setCyanPulse(true);

      const timer = setTimeout(() => setCyanPulse(false), 400);

      return () => clearTimeout(timer);

    }

  }, [playerScored]);



  // Magenta pulse on opponent score

  useEffect(() => {

    if (opponentScored) {

      setMagentaPulse(true);

      const timer = setTimeout(() => setMagentaPulse(false), 400);

      return () => clearTimeout(timer);

    }

  }, [opponentScored]);



  // Dim on mistake

  useEffect(() => {

    if (mistakeMade) {

      setDimmed(true);

      const timer = setTimeout(() => setDimmed(false), 300);

      return () => clearTimeout(timer);

    }

  }, [mistakeMade]);



  const isCritical = timeRemaining < criticalTime;

  const vignetteIntensity = isCritical ? 0.7 : timeRemaining < 60 ? 0.5 : 0.3;



  return (

    <div className="fixed inset-0 overflow-hidden pointer-events-none" style={{ zIndex: -1 }}>

      

      {/* Simplified soft blobs - NO blur filter, use pre-softened gradients */}

      <div className="absolute inset-0">

        {/* Cyan blob */}

        <div 

          className={`absolute transition-transform duration-300 ${cyanPulse ? 'scale-110' : ''} ${dimmed ? 'scale-95 opacity-60' : ''}`}

          style={{

            top: '15%',

            left: '-15%',

            width: '60vw',

            height: '60vw',

            maxWidth: 450,

            maxHeight: 450,

            background: 'radial-gradient(circle, rgba(0, 255, 255, 0.12) 0%, rgba(0, 255, 255, 0.04) 30%, transparent 60%)',

            borderRadius: '50%',

            animation: 'blobDrift1 25s ease-in-out infinite',

          }}

        />

        

        {/* Magenta blob */}

        <div 

          className={`absolute transition-transform duration-300 ${magentaPulse ? 'scale-110' : ''} ${dimmed ? 'scale-95 opacity-60' : ''}`}

          style={{

            bottom: '10%',

            right: '-20%',

            width: '70vw',

            height: '70vw',

            maxWidth: 500,

            maxHeight: 500,

            background: 'radial-gradient(circle, rgba(255, 0, 255, 0.1) 0%, rgba(255, 0, 255, 0.03) 30%, transparent 60%)',

            borderRadius: '50%',

            animation: 'blobDrift2 30s ease-in-out infinite',

          }}

        />

        

        {/* Purple blob */}

        <div 

          className={`absolute transition-transform duration-300 ${dimmed ? 'scale-95 opacity-60' : ''}`}

          style={{

            top: '55%',

            left: '25%',

            width: '45vw',

            height: '45vw',

            maxWidth: 350,

            maxHeight: 350,

            background: 'radial-gradient(circle, rgba(139, 0, 255, 0.12) 0%, rgba(139, 0, 255, 0.04) 30%, transparent 60%)',

            borderRadius: '50%',

            animation: 'blobDrift3 20s ease-in-out infinite',

          }}

        />

      </div>



      {/* Floating dust particles */}

      <FloatingDust count={75} />



      {/* Vignette overlay */}

      <div 

        className="absolute inset-0 transition-opacity duration-500"

        style={{

          background: `radial-gradient(circle at center, transparent 30%, rgba(0,0,0,${vignetteIntensity}) 100%)`,

        }}

      />



      {/* Critical time red edge glow */}

      {isCritical && (

        <div 

          className="absolute inset-0 animate-pulse"

          style={{

            background: 'radial-gradient(circle at center, transparent 60%, rgba(255,51,102,0.15) 100%)',

          }}

        />

      )}

    </div>

  );

});



// Lightweight floating dust particles

const FloatingDust = memo(function FloatingDust({ count }: { count: number }) {

  const [particles, setParticles] = useState<Array<{

    id: number;

    x: number;

    y: number;

    size: number;

    speed: number;

    opacity: number;

    drift: number;

    colorType: number;

  }>>([]);



  // Initialize particles once

  useEffect(() => {

    const initialParticles = Array.from({ length: count }, (_, i) => ({

      id: i,

      x: Math.random() * 100,

      y: Math.random() * 100,

      size: Math.random() * 2 + 0.5,

      speed: Math.random() * 0.3 + 0.1,

      opacity: Math.random() * 0.5 + 0.15,

      drift: (Math.random() - 0.5) * 0.2,

      colorType: i % 3,

    }));

    setParticles(initialParticles);

  }, [count]);



  // Animate particles at low frequency for performance (~16fps)

  useEffect(() => {

    if (particles.length === 0) return;

    

    const interval = setInterval(() => {

      setParticles(prev => prev.map(p => ({

        ...p,

        y: p.y <= 0 ? 100 : p.y - p.speed,

        x: ((p.x + p.drift) % 100 + 100) % 100,

      })));

    }, 60);

    

    return () => clearInterval(interval);

  }, [particles.length]);



  return (

    <div className="absolute inset-0 overflow-hidden">

      {particles.map(p => {

        const fadeOpacity = p.y < 15 ? p.opacity * (p.y / 15) : p.opacity;

        

        // Simple colors - no box-shadow for performance

        const colors = [

          `rgba(0, 255, 255, ${fadeOpacity})`,       // cyan

          `rgba(255, 0, 255, ${fadeOpacity * 0.9})`, // magenta

          `rgba(255, 255, 255, ${fadeOpacity * 0.5})`, // white

        ];

        

        return (

          <div

            key={p.id}

            className="absolute rounded-full"

            style={{

              left: `${p.x}%`,

              top: `${p.y}%`,

              width: p.size,

              height: p.size,

              backgroundColor: colors[p.colorType],

            }}

          />

        );

      })}

    </div>

  );

});



export default GameBackgroundEffects;
