import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/useAuth';

const NAV = [
  { to: '/app', label: 'Home', end: true },
  { to: '/app/store-doctor', label: 'Store Doctor' },
  { to: '/app/automations', label: 'Automations' },
  { to: '/app/campaigns', label: 'Campaigns' },
  { to: '/app/coupons', label: 'Coupons' },
  { to: '/app/segments', label: 'Segments' },
  { to: '/app/customers', label: 'Customers' },
  { to: '/app/email-designer', label: 'Email Designer' },
  { to: '/app/deliverability', label: 'Deliverability' },
  { to: '/app/reports', label: 'Reports' },
  { to: '/app/agency', label: 'Agency' },
  { to: '/app/license', label: 'License' },
  { to: '/app/connect', label: 'Connect a store' },
];

export function MerchantLayout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const isStaff = user && ['super_admin', 'support'].includes(user.role);

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar__brand">⚡ AI Revenue</div>
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => (isActive ? 'active' : '')}>
            {n.label}
          </NavLink>
        ))}
        {isStaff && (
          <NavLink to="/admin" style={{ marginTop: 16 }}>
            → Admin console
          </NavLink>
        )}
        <a
          href="#logout"
          style={{ marginTop: 24 }}
          onClick={(e) => {
            e.preventDefault();
            logout();
            nav('/login');
          }}
        >
          Log out
        </a>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
