import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/useAuth';
import { useTheme } from '../../lib/useTheme';

const NAV = [
  { to: '/admin', label: 'Overview', ic: '📊', end: true },
  { to: '/admin/merchants', label: 'Merchants', ic: '🏬' },
  { to: '/admin/licenses', label: 'Licenses', ic: '🔑' },
  { to: '/admin/stores', label: 'Stores', ic: '🏪' },
  { to: '/admin/billing', label: 'Billing', ic: '💳' },
  { to: '/admin/ai-engine', label: 'AI Engine', ic: '🤖' },
  { to: '/admin/platform', label: 'Platform', ic: '🚩' },
  { to: '/admin/audit', label: 'Audit log', ic: '📜' },
];

export function AdminLayout() {
  const { logout } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const { theme, toggle } = useTheme();
  const [open, setOpen] = useState(false);
  useEffect(() => { setOpen(false); }, [loc.pathname]);

  return (
    <div className="shell">
      <div className="topbar">
        <button className="hamburger" onClick={() => setOpen(true)} aria-label="Menu">☰</button>
        <span className="topbar__brand">🛡️ Admin Console</span>
        <span style={{ width: 36 }} />
      </div>
      {open && <div className="scrim" onClick={() => setOpen(false)} />}
      <aside className={`sidebar${open ? ' open' : ''}`}>
        <div className="sidebar__brand">🛡️ Admin Console</div>
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => (isActive ? 'active' : '')}>
            <span className="ic">{n.ic}</span> {n.label}
          </NavLink>
        ))}
        <div className="sidebar__section">&nbsp;</div>
        <NavLink to="/app"><span className="ic">←</span> Merchant view</NavLink>
        <div className="sidebar__tools">
          <button className="theme-toggle" onClick={toggle}>{theme === 'dark' ? '☀️ Light mode' : '🌙 Dark mode'}</button>
        </div>
        <a href="#logout" onClick={(e) => { e.preventDefault(); logout(); nav('/login'); }}><span className="ic">↩︎</span> Log out</a>
      </aside>
      <main className="main"><Outlet /></main>
    </div>
  );
}
