import type { ReactNode } from 'react';

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: string }) {
  return (
    <div className="card stat">
      <div className="stat__label">{label}</div>
      <div className="stat__value">{value}</div>
      {sub && <div className="stat__sub">{sub}</div>}
    </div>
  );
}

export function Badge({ tone, children }: { tone: 'ok' | 'warn' | 'off'; children: ReactNode }) {
  return <span className={`badge badge--${tone}`}>{children}</span>;
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="card center">
      <p style={{ fontWeight: 600, margin: 0 }}>{title}</p>
      {hint && <p className="muted" style={{ marginTop: 6 }}>{hint}</p>}
    </div>
  );
}

export function Spinner() {
  return <p className="muted">Loading…</p>;
}
