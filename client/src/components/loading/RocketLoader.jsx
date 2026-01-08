// client/src/components/loading/RocketLoader.jsx
export default function RocketLoader() {
  return (
    <div className="w-full min-h-[60vh] flex items-center justify-center bg-white overflow-hidden">
      <div className="relative flex items-center justify-center">
        {/* rocket */}
        <div className="rocket text-5xl select-none">Loading...🚀</div>

        {/* shadow */}
        <div className="absolute -bottom-3 w-10 h-2 bg-slate-200 rounded-full blur-sm animate-pulse" />

        <style>{`
          .rocket {
            animation:
              wiggle 1.6s ease-in-out infinite,
              spin 3.2s linear infinite;
          }

          @keyframes wiggle {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-12px); }
          }

          @keyframes spin {
            0% { rotate: 0deg; }
            100% { rotate: 360deg; }
          }
        `}</style>
      </div>
    </div>
  );
}

