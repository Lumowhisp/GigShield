import React, { useState, useEffect } from 'react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import { fetchDashboardStats } from '../api';

const COLORS = {
  aqua: '#00E5FF', orange: '#F59E0B', success: '#10B981',
  danger: '#EF4444', purple: '#8B5CF6', rose: '#F43F5E',
};

const PIE_COLORS = ['#00E5FF', '#F59E0B', '#8B5CF6'];
const TRUST_COLORS = ['#10B981', '#00E5FF', '#F59E0B', '#EF4444'];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: '#1a1f2e', border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 8, padding: '10px 14px', fontSize: 12,
      boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
    }}>
      <div style={{ color: '#94A3B8', marginBottom: 4 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>
          {p.name}: ₹{p.value?.toLocaleString?.() || p.value}
        </div>
      ))}
    </div>
  );
};

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchDashboardStats()
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="page-container">
      <div className="loading-container">
        <div className="spinner" />
        <div className="loading-text">Loading platform analytics...</div>
      </div>
    </div>
  );

  if (error) return (
    <div className="page-container">
      <div className="loading-container">
        <div style={{ fontSize: 48 }}>⚠️</div>
        <div className="loading-text">{error}</div>
        <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>Ensure the backend is deployed with the latest admin endpoints.</div>
      </div>
    </div>
  );

  const tierData = data.tier_distribution ? [
    { name: 'Basic', value: data.tier_distribution.basic, fill: COLORS.aqua },
    { name: 'Standard', value: data.tier_distribution.standard, fill: COLORS.orange },
    { name: 'Premium', value: data.tier_distribution.premium, fill: COLORS.purple },
  ] : [];

  const trustData = data.trust_distribution ? [
    { name: 'Veteran', value: data.trust_distribution.veteran },
    { name: 'Trusted', value: data.trust_distribution.trusted },
    { name: 'Neutral', value: data.trust_distribution.neutral },
    { name: 'Suspicious', value: data.trust_distribution.suspicious },
  ] : [];

  const lossRatioPct = (data.loss_ratio * 100).toFixed(1);
  const isHealthy = data.loss_ratio < 0.7;

  // Merge daily premiums and payouts for area chart
  const revenueData = (() => {
    const dateMap = {};
    (data.daily_premiums || []).forEach(d => {
      dateMap[d.date] = { ...(dateMap[d.date] || {}), date: d.date.slice(5), premium: d.amount };
    });
    (data.daily_payouts || []).forEach(d => {
      dateMap[d.date] = { ...(dateMap[d.date] || {}), date: d.date.slice(5), payout: d.amount };
    });
    return Object.values(dateMap).map(d => ({
      date: d.date,
      premium: d.premium || 0,
      payout: d.payout || 0,
    }));
  })();

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header animate-in">
        <div className="page-header-row">
          <div>
            <h1>📊 Operations Dashboard</h1>
            <p>Real-time platform analytics for GigGuard Parametric Insurance</p>
          </div>
          <div className="header-badge">
            <span className="dot" />
            {data.circuit_breaker_active ? '🔴 CIRCUIT BREAKER ACTIVE' : 'System Operational'}
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid">
        <div className="kpi-card aqua animate-in delay-1">
          <div className="kpi-icon">👥</div>
          <div className="kpi-value">{data.total_users}</div>
          <div className="kpi-label">Total Users</div>
        </div>
        <div className="kpi-card orange animate-in delay-2">
          <div className="kpi-icon">🛡️</div>
          <div className="kpi-value">{data.active_policies}</div>
          <div className="kpi-label">Active Policies</div>
        </div>
        <div className="kpi-card success animate-in delay-3">
          <div className="kpi-icon">💰</div>
          <div className="kpi-value">₹{data.total_premium_collected?.toLocaleString()}</div>
          <div className="kpi-label">Premium Collected</div>
        </div>
        <div className="kpi-card purple animate-in delay-4">
          <div className="kpi-icon">💸</div>
          <div className="kpi-value">₹{data.total_payouts_settled?.toLocaleString()}</div>
          <div className="kpi-label">Payouts Settled</div>
        </div>
        <div className={`kpi-card ${isHealthy ? 'success' : 'danger'} animate-in delay-5`}>
          <div className="kpi-icon">📈</div>
          <div className="kpi-value">{lossRatioPct}%</div>
          <div className="kpi-label">Loss Ratio (BCR)</div>
        </div>
        <div className="kpi-card rose animate-in delay-6">
          <div className="kpi-icon">🧠</div>
          <div className="kpi-value">{data.model_r2?.toFixed(4)}</div>
          <div className="kpi-label">Model R² Score</div>
        </div>
      </div>

      {/* Charts Row 1 */}
      <div className="charts-grid">
        {/* Revenue vs Payouts */}
        <div className="chart-card animate-in delay-3">
          <div className="chart-title"><span className="chart-title-icon">💹</span> Premium vs Payouts Over Time</div>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={revenueData}>
              <defs>
                <linearGradient id="gradPremium" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.aqua} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={COLORS.aqua} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradPayout" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.orange} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={COLORS.orange} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#475569' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#475569' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="premium" name="Premium ₹" stroke={COLORS.aqua} fill="url(#gradPremium)" strokeWidth={2} />
              <Area type="monotone" dataKey="payout" name="Payout ₹" stroke={COLORS.orange} fill="url(#gradPayout)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Policy Distribution */}
        <div className="chart-card animate-in delay-4">
          <div className="chart-title"><span className="chart-title-icon">🎯</span> Policy Tier Distribution</div>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={tierData}
                cx="50%" cy="50%"
                innerRadius={70} outerRadius={110}
                paddingAngle={4}
                dataKey="value"
                strokeWidth={0}
              >
                {tierData.map((entry, idx) => (
                  <Cell key={idx} fill={PIE_COLORS[idx]} />
                ))}
              </Pie>
              <Tooltip formatter={(val) => [val, 'Policies']} contentStyle={{
                background: '#1a1f2e', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8, fontSize: 12,
              }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="charts-grid">
        {/* Trust Distribution */}
        <div className="chart-card animate-in delay-5">
          <div className="chart-title"><span className="chart-title-icon">🏆</span> Trust Score Distribution</div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={trustData} barSize={40}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#475569' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#475569' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{
                background: '#1a1f2e', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8, fontSize: 12,
              }} />
              <Bar dataKey="value" name="Users" radius={[6, 6, 0, 0]}>
                {trustData.map((entry, idx) => (
                  <Cell key={idx} fill={TRUST_COLORS[idx]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Trigger Frequency */}
        <div className="chart-card animate-in delay-6">
          <div className="chart-title"><span className="chart-title-icon">⚡</span> Disruption Trigger Frequency</div>
          {data.trigger_frequency?.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data.trigger_frequency} layout="vertical" barSize={18}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#475569' }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="trigger" width={160} tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{
                  background: '#1a1f2e', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 8, fontSize: 12,
                }} />
                <Bar dataKey="count" name="Triggers" fill={COLORS.rose} radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="loading-container" style={{ height: 280 }}>
              <div style={{ fontSize: 40 }}>🌤️</div>
              <div className="loading-text">No disruption claims registered yet</div>
            </div>
          )}
        </div>
      </div>

      {/* Recent Payouts Feed */}
      <div className="chart-card animate-in delay-6">
        <div className="chart-title"><span className="chart-title-icon">🧾</span> Recent Settlements</div>
        <div className="activity-feed">
          {data.recent_payouts?.length > 0 ? data.recent_payouts.map((p, i) => (
            <div className="activity-item" key={i}>
              <div className={`activity-icon ${p.fraud_score > 30 ? 'fraud' : 'payout'}`}>
                {p.autopay ? '🤖' : '💸'}
              </div>
              <div className="activity-details">
                <div className="activity-title">{p.trigger_name}</div>
                <div className="activity-sub">
                  {p.user_email} · {p.status} · {p.autopay ? 'Autopay' : 'Manual'}
                  {p.fraud_score > 0 && <span style={{ color: COLORS.danger }}> · Fraud: {p.fraud_score}</span>}
                </div>
              </div>
              <div className="activity-amount">+₹{p.amount}</div>
            </div>
          )) : (
            <div className="loading-container" style={{ height: 200 }}>
              <div style={{ fontSize: 40 }}>📭</div>
              <div className="loading-text">No settlements yet — payouts will appear here when claims are processed</div>
            </div>
          )}
        </div>
      </div>

      <div style={{ height: 40 }} />
    </div>
  );
}
