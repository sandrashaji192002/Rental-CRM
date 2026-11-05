import { createContext, useContext } from 'react';
import { NavLink, Outlet, Link } from 'react-router-dom';
import { useAuth } from './auth';

const BaseCtx = createContext('/admin');
export const useBase = () => useContext(BaseCtx);

const ADMIN_NAV = [
  { to: '', label: 'Dashboard', icon: '🏠' },
  { to: 'rentals', label: 'Rentals', icon: '🧾' },
  { to: 'products', label: 'Products', icon: '📦' },
  { to: 'assets', label: 'Assets', icon: '🔧' },
  { to: 'customers', label: 'Customers', icon: '👥' },
  { to: 'maintenance', label: 'Maintenance', icon: '🔩' },
  { to: 'suppliers', label: 'Suppliers', icon: '🚚' },
  { to: 'reports', label: 'Reports', icon: '📊' },
  { to: 'staff', label: 'Staff', icon: '🛡️' },
];
const OPS_NAV = [
  { to: '', label: 'Rentals', icon: '🧾' },
  { to: 'rentals/new', label: 'New rental', icon: '➕' },
  { to: 'customers', label: 'Customers', icon: '👥' },
];
const path = (base, to) => (to ? `${base}/${to}` : base);

export function AdminLayout() {
  const { user, logout } = useAuth();
  return (
    <BaseCtx.Provider value="/admin">
      <div className="desktop">
        <aside className="sidebar">
          <div className="brand">🛠️ Rental CRM</div>
          {ADMIN_NAV.map(n => (
            <NavLink
              key={n.label}
              to={path('/admin', n.to)}
              end={n.to === ''}
              className="nav"
            >
              <span>{n.icon}</span> {n.label}
            </NavLink>
          ))}
          <div className="grow" />
          <Link className="nav" to="/ops">
            🧑‍💼 Front desk portal
          </Link>
          <Link className="nav" to="/m">
            📱 Mobile view
          </Link>
          <div className="who">
            {user.name}
            <small>{user.role}</small>
          </div>
          <button className="btn ghost" onClick={logout}>
            Logout
          </button>
        </aside>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </BaseCtx.Provider>
  );
}

export function OpsLayout() {
  const { user, logout } = useAuth();
  return (
    <BaseCtx.Provider value="/ops">
      <div className="ops">
        <header className="ops-top no-print">
          <b className="ops-brand">🛠️ Front Desk</b>
          <nav>
            {OPS_NAV.map(n => (
              <NavLink
                key={n.label}
                to={path('/ops', n.to)}
                end
                className="ops-link"
              >
                {n.icon} {n.label}
              </NavLink>
            ))}
          </nav>
          <span className="ops-right">
            {user.role === 'admin' && (
              <Link to="/admin" className="toplink">
                Admin portal
              </Link>
            )}
            <small>{user.name}</small>
            <button className="btn ghost" onClick={logout}>
              Logout
            </button>
          </span>
        </header>
        <main className="ops-content">
          <Outlet />
        </main>
      </div>
    </BaseCtx.Provider>
  );
}

export function MobileLayout() {
  const { logout } = useAuth();
  return (
    <BaseCtx.Provider value="/m">
      <div className="phone-wrap">
        <div className="phone mobile">
          <header className="topbar">
            <b>🛠️ Rental CRM</b>
            <span>
              <Link to="/admin" className="toplink">
                Desktop
              </Link>
              <button className="btn ghost" onClick={logout}>
                Logout
              </button>
            </span>
          </header>
          <main className="m-content">
            <Outlet />
          </main>
          <nav className="tabbar">
            {ADMIN_NAV.map(n => (
              <NavLink
                key={n.label}
                to={path('/m', n.to)}
                end={n.to === ''}
                className="tab"
              >
                <span>{n.icon}</span>
                {n.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </div>
    </BaseCtx.Provider>
  );
}
