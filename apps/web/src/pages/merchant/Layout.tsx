import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/useAuth';

const SECTIONS: { title: string; items: { to: string; label: string; ic: string; end?: boolean }[] }[] = [
  {
    title: 'Overview',
    items: [
      { to: '/app', label: 'Home', ic: '🏠', end: true },
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
      { to: '/app/deliverability', label: 'Deliverability', ic: '📬' },
    ],
  },
  {
    title: 'Account',
    items: [
      { to: '/app/reports', label: 'Reports', ic: '📊' },
      { to: '/app/agency', label: 'Agency', ic: '🏢' },
      { to: '/app/license', label: 'License', ic: '🔑' },
      { to: '/app/connect', label: 'Connect a store', ic: '🔌' },
    ],
  },
];

export function MerchantLayout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const isStaff = user && ['super_admin', 'support'].includes(user.role);

  return (
    <div className="shell">
      <aside className="sidebar">
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
