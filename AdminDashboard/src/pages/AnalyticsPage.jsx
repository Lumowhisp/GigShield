import React, { useState, useEffect } from 'react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts';
import { fetchRiskForecast } from '../api';
import {
  Activity, MapPin, TrendingUp, Mountain, Shield, Zap,
  Calendar, Cpu, CloudRain,
} from 'lucide-react';

const COLORS = {
  aqua: '#14b8a6', aquaLight: '#2dd4bf', orange: '#f97316',
  success: '#34d399', danger: '#ef4444', purple: '#8B5CF6',
  amber: '#fbbf24', cyan: '#06b6d4',
};

const TRIGGER_COLORS = {
  'Heavy Rain / Waterlogging': '#3B82F6',
  'Extreme Heat / Heat Stress': '#EF4444',
  'Storm / Cyclone': '#8B5CF6',
  'Flood Zone Risk': '#0EA5E9',
  'Poor Visibility / Smog': '#6B7280',
  'Severe Air Quality': '#F59E0B',
};

const CustomTooltip = ({ active, payload, label, isPercentage }) => {
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
        let formattedVal = isPercentage ? `${(val * (isPercentage === 'loss' ? 100 : 1)).toFixed(1)}%` : Number(val).toLocaleString();
        let color = p.color || '#14b8a6';
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

export default function AnalyticsPage() {
  const [forecast, setForecast] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchRiskForecast()
      .then(setForecast)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="page-container">
      <div className="loading-container">
        <div className="spinner" />
        <div className="loading-text">Running ML inference for 7-day predictive forecast...</div>
      </div>
    </div>
  );

  if (error) return (
    <div className="page-container">
      <div className="loading-container">
        <Activity size={48} style={{ color: 'var(--purple)' }} />
        <div className="loading-text">{error}</div>
        <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>Deploy latest backend with /admin/risk-forecast endpoint.</div>
      </div>
    </div>
  );

  const forecastData = forecast?.forecast?.map((d) => ({
    ...d,
    dateLabel: new Date(d.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' }),
    riskPct: (d.loss_ratio * 100).toFixed(1),
    color: d.loss_ratio > 0.25 ? COLORS.danger : d.loss_ratio > 0.1 ? COLORS.orange : COLORS.success,
  })) || [];

  // Aggregate trigger frequency across forecast days
  const triggerCounts = {};
  forecastData.forEach(d => {
    (d.active_triggers || []).forEach(t => {
      triggerCounts[t] = (triggerCounts[t] || 0) + 1;
    });
  });
  const triggerChartData = Object.entries(triggerCounts)
    .map(([trigger, count]) => ({ trigger, count, fill: TRIGGER_COLORS[trigger] || COLORS.aquaLight }))
    .sort((a, b) => b.count - a.count);

  const avgRisk = forecast?.avg_loss_ratio || 0;
  const riskLevel = avgRisk > 0.25 ? 'HIGH' : avgRisk > 0.1 ? 'MODERATE' : 'LOW';
  const riskColor = avgRisk > 0.25 ? COLORS.danger : avgRisk > 0.1 ? COLORS.orange : COLORS.success;

  return (
    <div className="page-container">
      <div className="page-header animate-in">
        <div className="page-header-row">
          <div>
            <h1>
              <Activity size={28} className="header-icon" />
              Predictive Risk Analytics
            </h1>
            <p>7-day AI forecast for {forecast?.location?.name || 'Delhi NCR'} — ML-powered claim prediction</p>
          </div>
          <div className="header-badge" style={{
            background: `${riskColor}15`, borderColor: `${riskColor}40`, color: riskColor,
          }}>
            <span className="dot" style={{ background: riskColor }} />
            {riskLevel} RISK WEEK — {(avgRisk * 100).toFixed(1)}% Avg Loss
          </div>
        </div>
      </div>

      {/* KPI Row */}
      <div className="kpi-grid animate-in delay-1">
        <div className="kpi-card aqua">
          <div className="kpi-icon aqua"><MapPin size={18} /></div>
          <div className="kpi-value" style={{ fontSize: 20 }}>{forecast?.location?.name}</div>
          <div className="kpi-label">Reference Zone</div>
        </div>
        <div className="kpi-card orange">
          <div className="kpi-icon orange"><TrendingUp size={18} /></div>
          <div className="kpi-value">{(avgRisk * 100).toFixed(1)}%</div>
          <div className="kpi-label">Avg Loss Ratio</div>
        </div>
        <div className="kpi-card success">
          <div className="kpi-icon success"><Mountain size={18} /></div>
          <div className="kpi-value">{forecast?.elevation_m?.toFixed(0)}m</div>
          <div className="kpi-label">Elevation</div>
        </div>
        <div className="kpi-card purple">
          <div className="kpi-icon purple"><Shield size={18} /></div>
          <div className="kpi-value">{forecast?.zone_safety?.zone_safety_score?.toFixed(2)}</div>
          <div className="kpi-label">Zone Safety Score</div>
        </div>
      </div>

      <div className="charts-grid">
        {/* 7-Day Forecast Chart */}
        <div className="chart-card full-width animate-in delay-2">
          <div className="chart-title"><span className="chart-title-icon"><TrendingUp size={14} /></span> 7-Day Loss Ratio Forecast (XGBoost Prediction)</div>
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={forecastData}>
              <defs>
                <linearGradient id="gradRisk" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.aquaLight} stopOpacity={0.4} />
                  <stop offset="95%" stopColor={COLORS.aquaLight} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="dateLabel" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis
                tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false}
              />
              <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} content={<CustomTooltip isPercentage="loss" />} />
              <ReferenceLine y={0.15} stroke={COLORS.orange} strokeDasharray="5 5" label={{
                value: 'Moderate threshold', fill: COLORS.orange, fontSize: 10, position: 'insideTopRight',
              }} />
              <ReferenceLine y={0.35} stroke={COLORS.danger} strokeDasharray="5 5" label={{
                value: 'High risk threshold', fill: COLORS.danger, fontSize: 10, position: 'insideTopRight',
              }} />
              <Area
                type="monotone" dataKey="loss_ratio" name="Loss Ratio"
                stroke={COLORS.aquaLight} fill="url(#gradRisk)" strokeWidth={3}
                dot={{ r: 5, fill: COLORS.aquaLight, stroke: '#0B0F19', strokeWidth: 2 }}
                activeDot={{ r: 7, fill: COLORS.orange }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="charts-grid">
        {/* Forecasted Triggers */}
        <div className="chart-card animate-in delay-3">
          <div className="chart-title"><span className="chart-title-icon"><Zap size={14} /></span> Forecasted Trigger Activity</div>
          {triggerChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={triggerChartData} layout="vertical" barSize={20}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="trigger" width={180} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} content={<CustomTooltip />} />
                <Bar dataKey="count" name="Days Active" radius={[0, 8, 8, 0]}>
                  {triggerChartData.map((d, i) => (
                    <Cell key={i} fill={d.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="loading-container" style={{ height: 280 }}>
              <CloudRain size={40} style={{ color: 'var(--aqua-light)' }} />
              <div className="loading-text">Clear week — no triggers forecasted</div>
            </div>
          )}
        </div>

        {/* Daily Breakdown Table */}
        <div className="chart-card animate-in delay-4">
          <div className="chart-title"><span className="chart-title-icon"><Calendar size={14} /></span> Daily Risk Breakdown</div>
          <div style={{ overflowY: 'auto', maxHeight: 280 }}>
            {forecastData.map((d, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 0', borderBottom: '1px solid var(--border-subtle)',
              }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 12,
                  background: `${d.color}15`, border: `1px solid ${d.color}30`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-mono)',
                  color: d.color,
                }}>
                  D{i + 1}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-heading)' }}>{d.dateLabel}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {d.active_triggers?.length > 0
                      ? d.active_triggers.join(', ')
                      : 'No disruptions expected'}
                  </div>
                </div>
                <div style={{
                  fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 14,
                  color: d.color,
                }}>
                  {d.riskPct}%
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Model Info Footer */}
      <div className="chart-card animate-in delay-5" style={{ marginTop: 24 }}>
        <div style={{
          display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 40,
          padding: '8px 0', fontSize: 11, color: 'var(--text-muted)',
          fontFamily: 'var(--font-mono)', letterSpacing: '1px', textTransform: 'uppercase',
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Cpu size={12} /> MODEL: XGBoost v2</span>
          <span>R² = 0.8773</span>
          <span>FEATURES: 34</span>
          <span>TRIGGERS: 6</span>
          <span>TRAINING: 2015-2025 IMD Data</span>
        </div>
      </div>

      <div style={{ height: 40 }} />
    </div>
  );
}
