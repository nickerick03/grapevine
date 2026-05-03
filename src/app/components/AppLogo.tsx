export function AppLogo() {
  const bars = [
    { color: "#F59E0B", h: 12 },
    { color: "#EF4444", h: 16 },
    { color: "#10B981", h: 20 },
    { color: "#3B82F6", h: 14 },
    { color: "#8B5CF6", h: 16 },
  ];

  return (
    <div
      className="w-9 h-9 rounded-xl overflow-hidden shadow-sm flex items-center justify-center flex-none"
      style={{ background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)" }}
    >
      <div className="flex gap-[2px] items-end" style={{ height: 20 }}>
        {bars.map((b, i) => (
          <div
            key={i}
            className="w-[3px] rounded-full"
            style={{ background: b.color, height: b.h }}
          />
        ))}
      </div>
    </div>
  );
}
