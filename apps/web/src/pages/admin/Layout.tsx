import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/useAuth';

export function AdminLayout() {
  const { logout } = useAuth();
  const nav = useNavigate();
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar__brand">🛡️ Admin Console</div>
        <NavLink to="/admin" end className={({ isActive }) => (isActive ? 'active' : '')}>Overview</NavLink>
        <NavLink to="/admin/licenses" className={({ isActive }) => (isActive ? 'active' : '')}>Licenses</NavLink>
        <NavLink to="/app" style={{ marginTop: 16 }}>← Merchant view</NavLink>
        <a href="#logout" style={{ marginTop: 24 }} onClick={(e) => { e.preventDefault(); logout(); nav('/login'); }}>Log out</a>
      </aside>
      <main className="main"><Outlet /></main>
    </div>
  );
}
