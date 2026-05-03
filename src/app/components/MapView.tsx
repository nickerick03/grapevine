import { Pub } from "./vibe";

export function MapView({
  pubs,
  selected,
  onSelect,
  located = false,
}: {
  pubs: Pub[];
  selected?: string;
  onSelect: (id: string) => void;
  located?: boolean;
}) {
  const minLat = 47.488, maxLat = 47.508, minLng = 19.050, maxLng = 19.070;
  const pos = (p: Pub) => ({
    left: `${((p.lng - minLng) / (maxLng - minLng)) * 100}%`,
    top: `${(1 - (p.lat - minLat) / (maxLat - minLat)) * 100}%`,
  });

  // Fixed "user" position — centre of the map
  const userPos = { left: "50%", top: "50%" };

  return (
    <div className="absolute inset-0 overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 30% 20%, #fef3e9 0%, transparent 40%), radial-gradient(circle at 70% 60%, #eaf2fb 0%, transparent 50%), linear-gradient(180deg, #f5f1ea 0%, #ecf1ec 100%)",
        }}
      />
      <svg className="absolute inset-0 w-full h-full opacity-40" preserveAspectRatio="none" viewBox="0 0 100 100">
        {Array.from({ length: 12 }).map((_, i) => (
          <line key={`h${i}`} x1="0" y1={i * 8} x2="100" y2={i * 8} stroke="#d8d2c5" strokeWidth="0.15" />
        ))}
        {Array.from({ length: 12 }).map((_, i) => (
          <line key={`v${i}`} x1={i * 8} y1="0" x2={i * 8} y2="100" stroke="#d8d2c5" strokeWidth="0.15" />
        ))}
        <path d="M0,55 Q30,40 55,50 T100,45" stroke="#cfe0f5" strokeWidth="2.5" fill="none" />
        <path d="M20,0 Q25,30 35,55 T45,100" stroke="#dde6d3" strokeWidth="3" fill="none" opacity="0.6" />
      </svg>

      {/* User location dot — shown when located */}
      {located && (
        <div
          className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10"
          style={userPos}
        >
          {/* Outer pulse ring */}
          <div className="absolute inset-0 w-10 h-10 -translate-x-1/4 -translate-y-1/4 rounded-full bg-blue-400/20 animate-ping" />
          {/* Inner dot */}
          <div className="w-4 h-4 rounded-full bg-blue-500 border-2 border-white shadow-lg" />
        </div>
      )}

      {pubs.map((p) => {
        const isSel = selected === p.id;
        return (
          <button
            key={p.id}
            onClick={() => onSelect(p.id)}
            className="absolute -translate-x-1/2 -translate-y-full transition-all"
            style={pos(p)}
          >
            <div className={`relative ${isSel ? "scale-110" : ""} transition-transform`}>
              <div
                className={`px-2.5 py-1 rounded-full shadow-lg text-[11px] whitespace-nowrap ${
                  isSel ? "bg-gray-900 text-white" : "bg-white text-gray-800 border border-gray-200"
                }`}
              >
                {p.match}% · {p.name.split(" ")[0]}
              </div>
              <div
                className={`w-3 h-3 rotate-45 absolute left-1/2 -translate-x-1/2 -bottom-1 ${
                  isSel ? "bg-gray-900" : "bg-white border-r border-b border-gray-200"
                }`}
              />
            </div>
          </button>
        );
      })}
    </div>
  );
}
