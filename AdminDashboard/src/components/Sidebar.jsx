import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import logoFinal from '../assets/logoFinal.png';
import { clearAdminToken } from '../api';
import {
  LayoutDashboard,
  Users,
  ShieldAlert,
  Activity,
  LogOut,
  Shield,
  Cpu,
} from 'lucide-react';

const NAV_ITEMS = [
  { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/users', icon: Users, label: 'Users & Policies' },
  { path: '/fraud', icon: ShieldAlert, label: 'Fraud Monitor' },
  { path: '/analytics', icon: Activity, label: 'Risk Analytics' },
];

export default function Sidebar({ onLogout }) {
  const navigate = useNavigate();
  const location = useLocation(); // Track current URL exactly

  const handleLogout = () => {
    clearAdminToken();
    onLogout?.();
    navigate('/login');
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-brand-icon" style={{ background: 'transparent', boxShadow: 'none' }}>
          <img src={logoFinal} alt="GigGuard Logo" style={{ width: '42px', height: '42px', objectFit: 'contain' }} />
        </div>
        <div className="sidebar-brand-text">
          <span className="sidebar-brand-name">GigGuard</span>
          <span className="sidebar-brand-sub">Admin Portal</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path; // Exact pathname match

          return (
            <Link
              key={item.path}
              to={item.path}
              className={`sidebar-link ${isActive ? 'active' : ''}`}
            >
              <span className="sidebar-link-icon">
                <Icon size={18} />
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-ml-info">
          <div className="ml-title">
            <Cpu size={14} />
            ML Engine
          </div>
          <div>XGBoost v2 · R² 0.8773</div>
          <div>34 features · 6 triggers</div>
        </div>
        <button className="sidebar-logout" onClick={handleLogout}>
          <LogOut size={16} />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
