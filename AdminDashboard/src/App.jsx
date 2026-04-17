import React, { useState, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { getAdminToken } from './api'
import Sidebar from './components/Sidebar'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import UsersPage from './pages/UsersPage'
import FraudPage from './pages/FraudPage'
import AnalyticsPage from './pages/AnalyticsPage'

function ProtectedRoute({ children }) {
  const token = getAdminToken();
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const [isAuth, setIsAuth] = useState(!!getAdminToken());

  useEffect(() => {
    const check = () => setIsAuth(!!getAdminToken());
    window.addEventListener('storage', check);
    return () => window.removeEventListener('storage', check);
  }, []);

  return (
    <Routes>
      <Route path="/login" element={<LoginPage onLogin={() => setIsAuth(true)} />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <div className="app-layout">
              <Sidebar onLogout={() => setIsAuth(false)} />
              <main className="main-content">
                <Routes>
                  <Route path="/" element={<DashboardPage />} />
                  <Route path="/users" element={<UsersPage />} />
                  <Route path="/fraud" element={<FraudPage />} />
                  <Route path="/analytics" element={<AnalyticsPage />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </main>
            </div>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
