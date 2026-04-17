import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { clearAdminToken } from '../api';

const NAV_ITEMS = [
  { path: '/', icon: '📊', label: 'Dashboard' },
  { path: '/users', icon: '👥', label: 'Users & Policies' },
  { path: '/fraud', icon: '🛡️', label: 'Fraud Monitor' },
  { path: '/analytics', icon: '🔮', label: 'Risk Analytics' },
];

export default function Sidebar({ onLogout }) {
  const navigate = useNavigate();

  const handleLogout = () => {
    clearAdminToken();
    onLogout?.();
    navigate('/login');
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-brand-icon">🛡️</div>
        <div className="sidebar-brand-text">
          <span className="sidebar-brand-name">GigGuard</span>
          <span className="sidebar-brand-sub">Admin Portal</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) =>
              `sidebar-link ${isActive ? 'active' : ''}`
            }
          >
            <span className="sidebar-link-icon">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div style={{ fontSize: 11, color: 'var(--text-muted)', padding: '0 16px', marginBottom: 12 }}>
          <div style={{ marginBottom: 4, fontWeight: 600 }}>🧠 ML Engine</div>
          <div>XGBoost v2 · R² 0.8773</div>
          <div>34 features · 6 triggers</div>
        </div>
        <button className="sidebar-logout" onClick={handleLogout}>
          <span>🚪</span> Sign Out
        </button>
      </div>
    </aside>
  );
}
