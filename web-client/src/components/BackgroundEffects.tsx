export default function BackgroundEffects() {

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 1 }}>
      
      {/* Drifting gradient blobs */}
      <div className="absolute inset-0">
        {/* Cyan blob */}
        <div 
          className="absolute w-[600px] h-[600px] animate-drift-1"
          style={{
            background: 'radial-gradient(circle, rgba(0,255,255,0.15) 0%, rgba(0,255,255,0.05) 40%, transparent 70%)',
            filter: 'blur(60px)',
            top: '-10%',
            left: '-10%',
          }}
        />
        
        {/* Magenta blob */}
        <div 
          className="absolute w-[500px] h-[500px] animate-drift-2"
          style={{
            background: 'radial-gradient(circle, rgba(255,0,255,0.12) 0%, rgba(255,0,255,0.04) 40%, transparent 70%)',
            filter: 'blur(70px)',
            top: '20%',
            right: '-15%',
          }}
        />
        
        {/* Purple blob */}
        <div 
          className="absolute w-[450px] h-[450px] animate-drift-3"
          style={{
            background: 'radial-gradient(circle, rgba(139,0,255,0.1) 0%, rgba(139,0,255,0.03) 40%, transparent 70%)',
            filter: 'blur(50px)',
            bottom: '10%',
            left: '20%',
          }}
        />
      </div>

    </div>
  );
}
