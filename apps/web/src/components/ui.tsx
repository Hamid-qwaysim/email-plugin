import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

export function PageHeader({ title, sub, actions }: { title: string; sub?: string; actions?: ReactNode }) {
  return (
    <div className="main__head">
      <div>
        <h1>{title}</h1>
        {sub && <div className="sub">{sub}</div>}
      </div>
      {actions && <div className="row">{actions}</div>}
    </div>
  );
}

export function Stat({ label, value, sub, icon, trend }: { label: string; value: ReactNode; sub?: string; icon?: string; trend?: { dir: 'up' | 'down'; text: string } }) {
  return (
    <div className="card">
      <div className="stat__top">
        <div className="stat__label">{label}</div>
        {icon ? <div className="stat__icon">{icon}</div> : trend ? <span className={`trend trend--${trend.dir}`}>{trend.dir === 'up' ? '▲' : '▼'} {trend.text}</span> : null}
      </div>
      <div className="stat__value">{value}</div>
      {sub && <div className="stat__sub">{sub}</div>}
    </div>
  );
}

export function Badge({ tone, children }: { tone: 'ok' | 'warn' | 'off'; children: ReactNode }) {
  return <span className={`badge badge--${tone} badge--dot`}>{children}</span>;
}

export function EmptyState({ title, hint, icon = '✨', action }: { title: string; hint?: string; icon?: string; action?: ReactNode }) {
  return (
    <div className="card center" style={{ padding: 44 }}>
      <div style={{ fontSize: 34, marginBottom: 10 }}>{icon}</div>
      <p style={{ fontWeight: 650, margin: 0, fontSize: 16 }}>{title}</p>
      {hint && <p className="muted" style={{ marginTop: 8, maxWidth: 440, marginInline: 'auto' }}>{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Skeleton({ height = 16, width = '100%', style }: { height?: number; width?: number | string; style?: React.CSSProperties }) {
  return <div className="skel" style={{ height, width, ...style }} />;
}

export function CardSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="card">
      <Skeleton height={14} width="40%" />
      <div className="mt-4" style={{ display: 'grid', gap: 12 }}>
        {Array.from({ length: rows }).map((_, i) => <Skeleton key={i} height={12} width={`${90 - i * 12}%`} />)}
      </div>
    </div>
  );
}

export function StatGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid--4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card"><Skeleton height={12} width="50%" /><div className="mt-2"><Skeleton height={28} width="70%" /></div></div>
      ))}
    </div>
  );
}

export function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="card">
      <div className="card__head"><h3>{title}</h3>{action}</div>
      {children}
    </div>
  );
}

/* ----------------------------- Toasts ----------------------------- */
interface Toast { id: number; message: string; tone: 'ok' | 'error' | 'info' }
const ToastCtx = createContext<{ push: (message: string, tone?: Toast['tone']) => void } | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((message: string, tone: Toast['tone'] = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);
  return (
    <ToastCtx.Provider value={{ push }}>
      {children}
      <div className="toast-wrap">
        {toasts.map((t) => <div key={t.id} className={`toast toast--${t.tone === 'info' ? '' : t.tone}`}>{t.message}</div>)}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastCtx);
  return ctx ?? { push: () => {} };
}

export function Spinner() {
  return <StatGridSkeleton />;
}
