import React, { useState, useEffect } from 'react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import { fetchDashboardStats } from '../api';
import {
  LayoutDashboard, Users, Shield, Wallet, TrendingUp, Cpu,
  FileText, Zap, Activity, Receipt,
} from 'lucide-react';

const COLORS = {
  aqua: '#14b8a6', aquaLight: '#2dd4bf', orange: '#f97316',
  success: '#34d399', danger: '#ef4444', purple: '#8B5CF6',
  rose: '#F43F5E', amber: '#fbbf24', cyan: '#06b6d4',
};

const PIE_COLORS = ['#2dd4bf', '#f97316', '#8B5CF6'];
const TRUST_COLORS = ['#34d399', '#2dd4bf', '#fbbf24', '#ef4444'];

const CustomTooltip = ({ active, payload, label, isCurrency, isPercentage }) => {
  if (!active || !payload || !payload.length) return null;
  const displayLabel = label || payload[0]?.name;
  return (
    <div style={{
      background: 'rgba(15, 23, 42, 0.95)',
      backdropFilter: 'blur(16px)',
      border: '1px solid #334155',
      borderRadius: '0.5rem',
      padding: '12px 16px',
      boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    }}>
      {displayLabel && <div style={{ color: '#e2e8f0', marginBottom: 8, fontFamily: "'Outfit', sans-serif", fontWeight: 600, fontSize: 13 }}>{displayLabel}</div>}
      {payload.map((p, i) => {
        let val = p.value !== undefined ? p.value : (p.payload?.value || 0);
        let formattedVal = val;
        if (isCurrency) formattedVal = `₹${Number(val).toLocaleString()}`;
        else if (isPercentage) formattedVal = `${val}%`;
        else formattedVal = Number(val).toLocaleString();

        let color = p.color || '#14b8a6';
        // Force specific pie/bar colors if missing from payload root
        if (p.payload?.fill && !p.color) color = p.payload.fill;

        return (
          <div key={i} style={{ color, fontWeight: 700, fontFamily: "ui-monospace, monospace", fontSize: 13, display: 'flex', justifyContent: 'space-between', gap: 24, marginBottom: 4 }}>
            <span style={{ color: '#94a3b8', fontWeight: 500 }}>{p.name}:</span>
            <span>{formattedVal}</span>
          </div>
        );
      })}
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
        <Activity size={48} style={{ color: 'var(--amber)' }} />
        <div className="loading-text">{error}</div>
        <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>Ensure the backend is deployed with the latest admin endpoints.</div>
      </div>
    </div>
  );

  const tierData = data.tier_distribution ? [
    { name: 'Basic', value: data.tier_distribution.basic, fill: COLORS.aquaLight },
    { name: 'Standard', value: data.tier_distribution.standard, fill: COLORS.orange },
    { name: 'Premium', value: data.tier_distribution.premium, fill: COLORS.purple },
  ] : [];

  const trustData = data.trust_distribution ? [
    { name: 'Veteran', value: data.trust_distribution.veteran },
    { name: 'Trusted', value: data.trust_distribution.trusted },
    { name: 'Neutral', value: data.trust_distribution.neutral },
    { name: 'Suspicious', value: data.trust_distribution.suspicious },
  ] : [];

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
            <h1>
              <LayoutDashboard size={28} className="header-icon" />
              Operations Dashboard
            </h1>
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
          <div className="kpi-icon aqua"><Users size={18} /></div>
          <div className="kpi-value">{data.total_users}</div>
          <div className="kpi-label">Total Users</div>
        </div>
        <div className="kpi-card orange animate-in delay-2">
          <div className="kpi-icon orange"><Shield size={18} /></div>
          <div className="kpi-value">{data.active_policies}</div>
          <div className="kpi-label">Active Policies</div>
        </div>
        <div className="kpi-card success animate-in delay-3">
          <div className="kpi-icon success"><Wallet size={18} /></div>
          <div className="kpi-value">₹{data.total_premium_collected?.toLocaleString()}</div>
          <div className="kpi-label">Premium Collected</div>
        </div>
        <div className="kpi-card purple animate-in delay-4">
          <div className="kpi-icon purple"><FileText size={18} /></div>
          <div className="kpi-value">₹{data.total_payouts_settled?.toLocaleString()}</div>
          <div className="kpi-label">Payouts Settled</div>
        </div>

        <div className="kpi-card rose animate-in delay-6">
          <div className="kpi-icon rose"><Cpu size={18} /></div>
          <div className="kpi-value">{data.model_r2?.toFixed(4)}</div>
          <div className="kpi-label">Model R² Score</div>
        </div>
      </div>

      {/* Charts Row 1 */}
      <div className="charts-grid">
        {/* Revenue vs Payouts */}
        <div className="chart-card animate-in delay-3">
          <div className="chart-title"><span className="chart-title-icon"><TrendingUp size={14} /></span> Premium vs Payouts Over Time</div>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={revenueData}>
              <defs>
                <linearGradient id="gradPremium" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.aquaLight} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={COLORS.aquaLight} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradPayout" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.orange} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={COLORS.orange} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} content={<CustomTooltip isCurrency />} />
              <Legend wrapperStyle={{ fontSize: 12, fontFamily: "'Outfit', sans-serif" }} />
              <Area type="monotone" dataKey="premium" name="Premium ₹" stroke={COLORS.aquaLight} fill="url(#gradPremium)" strokeWidth={2} />
              <Area type="monotone" dataKey="payout" name="Payout ₹" stroke={COLORS.orange} fill="url(#gradPayout)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Policy Distribution */}
        <div className="chart-card animate-in delay-4">
          <div className="chart-title"><span className="chart-title-icon"><Shield size={14} /></span> Policy Tier Distribution</div>
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
              <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12, fontFamily: "'Outfit', sans-serif" }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="charts-grid">
        {/* Trust Distribution */}
        <div className="chart-card animate-in delay-5">
          <div className="chart-title"><span className="chart-title-icon"><Users size={14} /></span> Trust Score Distribution</div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={trustData} barSize={40}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} content={<CustomTooltip />} />
              <Bar dataKey="value" name="Users" radius={[8, 8, 0, 0]}>
                {trustData.map((entry, idx) => (
                  <Cell key={idx} fill={TRUST_COLORS[idx]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Trigger Frequency */}
        <div className="chart-card animate-in delay-6">
          <div className="chart-title"><span className="chart-title-icon"><Zap size={14} /></span> Disruption Trigger Frequency</div>
          {data.trigger_frequency?.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data.trigger_frequency} layout="vertical" barSize={18}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="trigger" width={160} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} content={<CustomTooltip />} />
                <Bar dataKey="count" name="Triggers" fill={COLORS.rose} radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="loading-container" style={{ height: 280 }}>
              <Activity size={40} style={{ color: 'var(--aqua-light)' }} />
              <div className="loading-text">No disruption claims registered yet</div>
            </div>
          )}
        </div>
      </div>

      {/* Recent Payouts Feed */}
      <div className="chart-card animate-in delay-6">
        <div className="chart-title"><span className="chart-title-icon"><Receipt size={14} /></span> Recent Settlements</div>
        <div className="activity-feed">
          {data.recent_payouts?.length > 0 ? data.recent_payouts.map((p, i) => (
            <div className="activity-item" key={i}>
              <div className={`activity-icon ${p.fraud_score > 30 ? 'fraud' : 'payout'}`}>
                {p.autopay ? <Cpu size={16} /> : <Wallet size={16} />}
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
              <FileText size={40} style={{ color: 'var(--text-muted)' }} />
              <div className="loading-text">No settlements yet — payouts will appear here when claims are processed</div>
            </div>
          )}
        </div>
      </div>

      <div style={{ height: 40 }} />
    </div>
  );
}
