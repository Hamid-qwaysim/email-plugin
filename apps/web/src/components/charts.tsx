/** Dependency-free SVG charts tuned for the dashboard. */

export function Sparkline({ data, color = '#5b54f0', height = 40, width = 120 }: { data: number[]; color?: string; height?: number; width?: number }) {
  if (data.length < 2) return <svg width={width} height={height} />;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const step = width / (data.length - 1);
  const pts = data.map((d, i) => `${i * step},${height - ((d - min) / range) * (height - 4) - 2}`).join(' ');
  return (
    <svg width={width} height={height} aria-hidden>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export function Donut({ segments, size = 160 }: { segments: { label: string; value: number; color: string }[]; size?: number }) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const r = size / 2 - 12;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="row" style={{ gap: 20, alignItems: 'center' }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#eef1f8" strokeWidth={18} />
        {segments.map((s) => {
          const len = (s.value / total) * circ;
          const el = (
            <circle key={s.label} cx={cx} cy={cy} r={r} fill="none" stroke={s.color} strokeWidth={18}
              strokeDasharray={`${len} ${circ - len}`} strokeDashoffset={-offset} />
          );
          offset += len;
          return el;
        })}
      </svg>
      <div>
        {segments.map((s) => (
          <div key={s.label} className="row" style={{ marginBottom: 6, fontSize: 13 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: s.color, display: 'inline-block' }} />
            <span className="muted">{s.label}</span>
            <strong style={{ marginLeft: 'auto' }}>{s.value}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Gauge({ value, max = 100, label }: { value: number; max?: number; label?: string }) {
  const pct = Math.max(0, Math.min(1, value / max));
  const size = 150;
  const r = 60;
  const circ = Math.PI * r; // half circle
  const dash = pct * circ;
  const color = pct >= 0.8 ? '#0f9d58' : pct >= 0.6 ? '#b7791f' : '#d23b3b';
  return (
    <svg width={size} height={size / 1.7} viewBox="0 0 150 90">
      <path d="M15 80 A60 60 0 0 1 135 80" fill="none" stroke="#eef1f8" strokeWidth={14} strokeLinecap="round" />
      <path d="M15 80 A60 60 0 0 1 135 80" fill="none" stroke={color} strokeWidth={14} strokeLinecap="round"
        strokeDasharray={`${dash} ${circ}`} />
      <text x="75" y="66" textAnchor="middle" fontSize="26" fontWeight="700" fill="#141a2e">{Math.round(value)}</text>
      {label && <text x="75" y="82" textAnchor="middle" fontSize="11" fill="#6b7280">{label}</text>}
    </svg>
  );
}

export function BarRow({ label, value, max, suffix }: { label: string; value: number; max: number; suffix?: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div style={{ marginBottom: 12 }}>
      <div className="row between" style={{ fontSize: 13, marginBottom: 4 }}>
        <span>{label}</span>
        <strong>{value}{suffix ?? ''}</strong>
      </div>
      <div className="progress"><div className="progress__bar" style={{ width: `${pct}%` }} /></div>
    </div>
  );
}
