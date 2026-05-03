type Props = { name: string; bank: string; className?: string };

// Deterministic gradient from string
function gradFor(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  const a = h % 360;
  const b = (a + 40) % 360;
  return `linear-gradient(135deg, hsl(${a} 70% 35%) 0%, hsl(${b} 75% 50%) 100%)`;
}

export default function CardThumb({ name, bank, className = "" }: Props) {
  return (
    <div
      className={`relative aspect-[1.586/1] w-full rounded-xl overflow-hidden shadow-card text-white p-4 flex flex-col justify-between ${className}`}
      style={{ background: gradFor(bank + name) }}
    >
      <div className="flex justify-between items-start">
        <span className="text-xs font-medium opacity-90 uppercase tracking-wider">{bank}</span>
        <div className="w-8 h-6 rounded bg-white/20 backdrop-blur-sm" />
      </div>
      <div>
        <div className="text-sm font-semibold leading-tight">{name}</div>
        <div className="mt-2 text-[10px] tracking-[0.3em] opacity-70">•••• ••••</div>
      </div>
    </div>
  );
}
