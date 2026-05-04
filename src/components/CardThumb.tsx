type Props = { name: string; bank: string; network?: string; tier?: string; className?: string };

// Deterministic gradient seeded from bank+name
function paletteFor(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  const a = h % 360;
  return {
    a,
    b: (a + 35) % 360,
    c: (a + 200) % 360,
  };
}

function tierStyle(name: string) {
  const n = name.toLowerCase();
  if (/(infinia|reserve|magnus|burgundy|emerald|aura|century|private|metal|signature)/.test(n))
    return { label: "METAL", finish: "linear-gradient(135deg,#1a1a1a 0%,#2a2a2a 50%,#0a0a0a 100%)", text: "#f5f5f5", accent: "#d4af37" };
  if (/(platinum|prive|select|wealth|millennia|tata neu plus)/.test(n))
    return { label: "PLATINUM", finish: "linear-gradient(135deg,#3a3a45 0%,#5a5a65 100%)", text: "#fff", accent: "#e8e8ec" };
  return null;
}

export default function CardThumb({ name, bank, network = "VISA", tier, className = "" }: Props) {
  const p = paletteFor(bank + name);
  const lux = tierStyle(name);

  const bg = lux?.finish ?? `radial-gradient(at 20% 20%, hsl(${p.b} 80% 55%) 0%, transparent 55%), linear-gradient(135deg, hsl(${p.a} 75% 28%) 0%, hsl(${p.c} 70% 18%) 100%)`;
  const fg = lux?.text ?? "#ffffff";
  const accent = lux?.accent ?? "rgba(255,255,255,0.85)";

  return (
    <div
      className={`relative aspect-[1.586/1] w-full rounded-2xl overflow-hidden text-white shadow-elevated ${className}`}
      style={{ background: bg, color: fg }}
      aria-label={`${bank} ${name} card`}
    >
      {/* holographic shine */}
      <div className="absolute inset-0 opacity-50 pointer-events-none"
        style={{ background: "linear-gradient(115deg, transparent 35%, rgba(255,255,255,0.12) 50%, transparent 65%)" }} />
      {/* tier label */}
      {lux && (
        <span className="absolute top-2 right-3 text-[8px] tracking-[0.3em] font-semibold" style={{ color: accent }}>
          {lux.label}
        </span>
      )}
      <div className="relative h-full p-4 flex flex-col justify-between">
        <div className="flex items-start justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] opacity-90">{bank}</span>
        </div>
        {/* EMV chip */}
        <div className="absolute left-4 top-12">
          <div className="w-10 h-7 rounded-md" style={{
            background: "linear-gradient(135deg,#d4af37 0%,#f4e7a1 50%,#b8860b 100%)",
            boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.2)"
          }}>
            <div className="grid grid-cols-3 gap-px p-1 h-full opacity-40">
              {Array.from({ length: 9 }).map((_, i) => <div key={i} className="bg-black/30 rounded-[1px]" />)}
            </div>
          </div>
        </div>
        <div>
          <div className="font-semibold text-sm leading-tight pr-12" style={{ color: fg }}>{name}</div>
          <div className="flex items-end justify-between mt-2">
            <div className="text-[11px] tracking-[0.35em] opacity-75 font-mono">•••• 1947</div>
            <div className="text-[10px] font-bold tracking-widest opacity-90 italic">{network}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
