export default function PremiumBadge() {
  return (
    <div 
      className="premium-badge flex-1 py-3 px-4 rounded-xl flex items-center justify-center relative overflow-hidden"
      style={{
        border: '2px solid #00FFFF',
        background: 'rgba(0, 255, 255, 0.05)',
      }}
    >
      <span 
        className="premium-badge-text font-heading font-bold text-base"
        style={{
          background: 'linear-gradient(180deg, #FFFFFF 0%, #C0C0C0 25%, #FFFFFF 50%, #A0A0A0 75%, #FFFFFF 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}
      >
        ✦ Sudoduel+ ✦
      </span>
      <style>{`
        @keyframes sheen {
          0%, 100% { left: -100%; }
          50% { left: 150%; }
        }
        .premium-badge::after {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 50%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
          animation: sheen 3s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
