import React, { useState, useEffect, useLayoutEffect, useRef, useMemo, memo } from 'react';

interface TunnelBackgroundProps {
  timeRemaining?: number; // seconds remaining in game
}

const TunnelBackground: React.FC<TunnelBackgroundProps> = memo(({ timeRemaining }) => {
  // Initialize with actual window dimensions to avoid first-frame misalignment
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>(() => ({
    width: typeof window !== 'undefined' ? window.innerWidth : 400,
    height: typeof window !== 'undefined' ? window.innerHeight : 800,
  }));
  
  // Use refs for animation state to avoid re-renders
  const tunnelPhaseRef = useRef(0);
  const animationFrameRef = useRef<number | undefined>(undefined);
  const svgRef = useRef<SVGSVGElement>(null);
  
  // Speed increases when under 30 seconds
  const tunnelSpeed = (timeRemaining !== undefined && timeRemaining < 30) ? 0.5 : 0.3;
  
  const ringCount = 10;
  const sparkCount = 75;

  // Synchronous dimension measurement before first paint
  useLayoutEffect(() => {
    const updateDimensions = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight
      });
    };
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    window.addEventListener('orientationchange', updateDimensions);
    return () => {
      window.removeEventListener('resize', updateDimensions);
      window.removeEventListener('orientationchange', updateDimensions);
    };
  }, []);

  // Tunnel animation using requestAnimationFrame (no React state updates)
  useEffect(() => {
    const animate = () => {
      tunnelPhaseRef.current = (tunnelPhaseRef.current + 0.008 * tunnelSpeed) % 1;
      
      // Direct DOM manipulation for performance
      if (svgRef.current) {
        const rings = svgRef.current.querySelectorAll('[data-ring]');
        const { width, height } = dimensions;
        const centerX = width / 2;
        const centerY = height / 2;
        const maxExtent = Math.max(width, height) * 0.55;
        
        rings.forEach((ring, index) => {
          const baseT = index / ringCount;
          const animatedT = (baseT + tunnelPhaseRef.current) % 1;
          const perspectiveT = Math.pow(animatedT, 0.6);
          
          const rectHalfSize = perspectiveT * maxExtent;
          const left = centerX - rectHalfSize;
          const top = centerY - rectHalfSize;
          const size = rectHalfSize * 2;
          
          let opacity = perspectiveT * 0.55;
          if (animatedT < 0.1) opacity *= animatedT / 0.1;
          if (animatedT > 0.9) opacity *= (1 - animatedT) / 0.1;
          
          const rect = ring as SVGRectElement;
          rect.setAttribute('x', String(left));
          rect.setAttribute('y', String(top));
          rect.setAttribute('width', String(size));
          rect.setAttribute('height', String(size));
          rect.setAttribute('stroke-opacity', String(opacity));
          rect.setAttribute('stroke-width', perspectiveT > 0.7 ? '2' : '1.5');
        });
      }
      
      animationFrameRef.current = requestAnimationFrame(animate);
    };
    
    animationFrameRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [dimensions, tunnelSpeed]);

  // Memoized corner lines (static, don't need animation)
  const cornerLines = useMemo(() => {
    const { width, height } = dimensions;
    const centerX = width / 2;
    const centerY = height / 2;
    const ext = 50; // Extend past corners
    
    const corners = [
      { x: -ext, y: -ext },
      { x: width + ext, y: -ext },
      { x: -ext, y: height + ext },
      { x: width + ext, y: height + ext },
    ];
    
    return corners.map((corner, i) => (
      <line
        key={`corner-${i}`}
        x1={corner.x}
        y1={corner.y}
        x2={centerX}
        y2={centerY}
        stroke="rgba(0, 255, 255, 0.4)"
        strokeWidth={2}
      />
    ));
  }, [dimensions]);

  // Memoized ring elements (positions updated via ref)
  const ringElements = useMemo(() => {
    return Array.from({ length: ringCount }, (_, i) => (
      <rect
        key={`ring-${i}`}
        data-ring={i}
        fill="none"
        stroke="rgb(255, 0, 255)"
        strokeOpacity={0}
        rx={0}
        ry={0}
      />
    ));
  }, []);

  const { width, height } = dimensions;

  return (
    <div 
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
    >
      {/* Soft blobs layer */}
      <div className="absolute inset-0 overflow-hidden">
        <div 
          className="absolute rounded-full animate-blob-1"
          style={{
            top: '20%',
            left: '-10%',
            width: '50vw',
            height: '50vw',
            maxWidth: 400,
            maxHeight: 400,
            background: 'radial-gradient(circle, rgba(0, 255, 255, 0.12) 0%, transparent 70%)',
            filter: 'blur(40px)',
          }}
        />
        <div 
          className="absolute rounded-full animate-blob-2"
          style={{
            bottom: '10%',
            right: '-15%',
            width: '60vw',
            height: '60vw',
            maxWidth: 500,
            maxHeight: 500,
            background: 'radial-gradient(circle, rgba(255, 0, 255, 0.1) 0%, transparent 70%)',
            filter: 'blur(50px)',
          }}
        />
        <div 
          className="absolute rounded-full animate-blob-3"
          style={{
            top: '60%',
            left: '30%',
            width: '40vw',
            height: '40vw',
            maxWidth: 350,
            maxHeight: 350,
            background: 'radial-gradient(circle, rgba(139, 0, 255, 0.15) 0%, transparent 70%)',
            filter: 'blur(45px)',
          }}
        />
      </div>

      {/* Tunnel grid SVG */}
      <svg
        ref={svgRef}
        width={width}
        height={height}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          overflow: 'visible',
        }}
      >
        <defs>
          <filter id="tunnelGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur1" />
            <feGaussianBlur stdDeviation="6" result="blur2" />
            <feMerge>
              <feMergeNode in="blur2" />
              <feMergeNode in="blur1" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="cyanGlow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="blur" />
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        
        {/* Cyan corner lines (behind rings) */}
        <g filter="url(#cyanGlow)">
          {cornerLines}
        </g>
        
        {/* Magenta rings */}
        <g filter="url(#tunnelGlow)">
          {ringElements}
        </g>
      </svg>

      {/* Floating sparks */}
      <FloatingSparks count={sparkCount} />
    </div>
  );
});

TunnelBackground.displayName = 'TunnelBackground';

// Separate sparks component for isolation
const FloatingSparks: React.FC<{ count: number }> = memo(({ count }) => {
  const [sparks, setSparks] = useState<Array<{
    id: number;
    x: number;
    y: number;
    size: number;
    speed: number;
    opacity: number;
    drift: number;
    colorType: number;
  }>>([]);

  // Initialize sparks once
  useEffect(() => {
    const initialSparks = Array.from({ length: count }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 2.5 + 0.5,
      speed: Math.random() * 0.4 + 0.1,
      opacity: Math.random() * 0.6 + 0.2,
      drift: (Math.random() - 0.5) * 0.3,
      colorType: i % 3,
    }));
    setSparks(initialSparks);
  }, [count]);

  // Animate sparks
  useEffect(() => {
    if (sparks.length === 0) return;
    
    const interval = setInterval(() => {
      setSparks(prev => prev.map(spark => ({
        ...spark,
        y: spark.y <= 0 ? 100 : spark.y - spark.speed,
        x: ((spark.x + spark.drift) % 100 + 100) % 100,
      })));
    }, 50);
    
    return () => clearInterval(interval);
  }, [sparks.length]);

  return (
    <div className="absolute inset-0 overflow-hidden">
      {sparks.map(spark => {
        const fadeOpacity = spark.y < 15 ? spark.opacity * (spark.y / 15) : spark.opacity;
        
        let bgColor: string;
        let shadowColor: string;
        
        if (spark.colorType === 0) {
          bgColor = `rgba(0, 255, 255, ${fadeOpacity})`;
          shadowColor = `0 0 ${spark.size * 4}px rgba(0, 255, 255, ${fadeOpacity})`;
        } else if (spark.colorType === 1) {
          bgColor = `rgba(255, 0, 255, ${fadeOpacity * 0.9})`;
          shadowColor = `0 0 ${spark.size * 4}px rgba(255, 0, 255, ${fadeOpacity * 0.9})`;
        } else {
          bgColor = `rgba(255, 255, 255, ${fadeOpacity * 0.5})`;
          shadowColor = `0 0 ${spark.size * 2}px rgba(255, 255, 255, ${fadeOpacity * 0.4})`;
        }
        
        return (
          <div
            key={spark.id}
            className="absolute rounded-full"
            style={{
              left: `${spark.x}%`,
              top: `${spark.y}%`,
              width: spark.size,
              height: spark.size,
              backgroundColor: bgColor,
              boxShadow: shadowColor,
              willChange: 'transform',
            }}
          />
        );
      })}
    </div>
  );
});

FloatingSparks.displayName = 'FloatingSparks';

export default TunnelBackground;
