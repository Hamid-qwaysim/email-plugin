import { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/useAuth';
import { useTheme } from '../../lib/useTheme';
import { useEffect } from 'react';

const SECTIONS: { title: string; items: { to: string; label: string; ic: string; end?: boolean }[] }[] = [
  {
    title: 'Overview',
    items: [
      { to: '/app', label: 'Home', ic: '🏠', end: true },
      { to: '/app/autopilot', label: 'AI Autopilot', ic: '🚀' },
      { to: '/app/store-doctor', label: 'Store Doctor', ic: '🩺' },
      { to: '/app/friction', label: 'Checkout Friction', ic: '🧭' },
    ],
  },
  {
    title: 'Grow',
    items: [
      { to: '/app/automations', label: 'Automations', ic: '⚡' },
      { to: '/app/campaigns', label: 'Campaigns', ic: '📣' },
      { to: '/app/coupons', label: 'Coupons', ic: '🎟️' },
      { to: '/app/ab-testing', label: 'A/B Testing', ic: '🧪' },
    ],
  },
  {
    title: 'Audience',
    items: [
      { to: '/app/segments', label: 'Segments', ic: '🎯' },
      { to: '/app/customers', label: 'Customers', ic: '👥' },
    ],
  },
  {
    title: 'Messaging',
    items: [
      { to: '/app/email-designer', label: 'Email Designer', ic: '✉️' },
      { to: '/app/popups', label: 'Popups & On-site', ic: '💬' },
      { to: '/app/deliverability', label: 'Deliverability', ic: '📬' },
    ],
  },
  {
    title: 'Account',
    items: [
      { to: '/app/reports', label: 'Reports', ic: '📊' },
      { to: '/app/agency', label: 'Agency', ic: '🏢' },
      { to: '/app/settings', label: 'Settings', ic: '⚙️' },
      { to: '/app/license', label: 'License', ic: '🔑' },
      { to: '/app/connect', label: 'Connect a store', ic: '🔌' },
    ],
  },
];

export function MerchantLayout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const { theme, toggle } = useTheme();
  const [open, setOpen] = useState(false);
  const isStaff = user && ['super_admin', 'support'].includes(user.role);

  // Close the mobile drawer on navigation.
  useEffect(() => { setOpen(false); }, [loc.pathname]);

  return (
    <div className="shell">
      <div className="topbar">
        <button className="hamburger" onClick={() => setOpen(true)} aria-label="Menu">☰</button>
        <span className="topbar__brand">⚡ AI Revenue</span>
        <span style={{ width: 36 }} />
      </div>
      {open && <div className="scrim" onClick={() => setOpen(false)} />}
      <aside className={`sidebar${open ? ' open' : ''}`}>
        <div className="sidebar__brand">⚡ AI Revenue</div>
        {SECTIONS.map((sec) => (
          <div key={sec.title}>
            <div className="sidebar__section">{sec.title}</div>
            {sec.items.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => (isActive ? 'active' : '')}>
                <span className="ic">{n.ic}</span> {n.label}
              </NavLink>
            ))}
          </div>
        ))}
        {isStaff && (
          <>
            <div className="sidebar__section">Staff</div>
            <NavLink to="/admin"><span className="ic">🛡️</span> Admin console</NavLink>
          </>
        )}
        <div className="sidebar__tools">
          <button className="theme-toggle" onClick={toggle}>{theme === 'dark' ? '☀️ Light mode' : '🌙 Dark mode'}</button>
        </div>
        <div className="sidebar__section">&nbsp;</div>
        <a href="#logout" onClick={(e) => { e.preventDefault(); logout(); nav('/login'); }}>
          <span className="ic">↩︎</span> Log out
        </a>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
