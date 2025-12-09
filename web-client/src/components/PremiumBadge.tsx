export default function PremiumBadge() {
  return (
    <div 
      className="premium-badge flex-1 py-3 px-4 rounded-xl font-body font-semibold text-base flex items-center justify-center relative overflow-hidden"
      style={{
        background: 'rgba(10, 5, 20, 0.95)',
        border: '2px solid #00FFFF',
        boxShadow: '0 0 15px rgba(0, 255, 255, 0.2)',
      }}
    >
      <span className="premium-badge-text">
        ✦ Sudoduel+ ✦
      </span>
      <style>{`
        .premium-badge-text {
          background: linear-gradient(180deg, #FFFFFF 0%, #C0C0C0 25%, #FFFFFF 50%, #A0A0A0 75%, #FFFFFF 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          font-weight: 600;
        }
        @keyframes premium-sheen {
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
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
          animation: premium-sheen 3s ease-in-out infinite;
          pointer-events: none;
        }
      `}</style>
    </div>
  );
}
