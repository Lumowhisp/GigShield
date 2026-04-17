import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import logoFinal from '../assets/logoFinal.png';
import { adminLogin } from '../api';
import { Lock, AlertTriangle, Loader } from 'lucide-react';

export default function LoginPage({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await adminLogin(email, password);
      onLogin?.();
      navigate('/');
    } catch (err) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card animate-in">
        <div className="login-brand">
          <div className="login-brand-icon" style={{ background: 'transparent', boxShadow: 'none' }}>
            <img src={logoFinal} alt="GigGuard Logo" style={{ width: '56px', height: '56px', objectFit: 'contain' }} />
          </div>
          <h1>GigGuard Admin</h1>
          <p>Insurer Operations & Analytics Console</p>
        </div>

        {error && (
          <div className="login-error">
            <AlertTriangle size={16} />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input
              className="form-input"
              type="email"
              placeholder="admin@gigguard.in"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              className="form-input"
              type="password"
              placeholder="••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button className="login-btn" type="submit" disabled={loading}>
            {loading ? (
              <>
                <Loader size={16} className="spin-icon" />
                Authenticating...
              </>
            ) : (
              <>
                <Lock size={16} />
                Sign In to Console
              </>
            )}
          </button>
        </form>

        <div className="login-hint">
          <p style={{ color: 'var(--text-muted)', fontSize: 11, marginBottom: 8 }}>Demo Credentials</p>
          <code>admin@gigguard.in</code>
          <br />
          <code>GigGuard@2026</code>
        </div>
      </div>
    </div>
  );
}
