import React, { useState, useEffect } from 'react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts';
import { fetchRiskForecast } from '../api';

const COLORS = {
  aqua: '#00E5FF', orange: '#F59E0B', success: '#10B981',
  danger: '#EF4444', purple: '#8B5CF6',
};

const TRIGGER_COLORS = {
  'Heavy Rain / Waterlogging': '#3B82F6',
  'Extreme Heat / Heat Stress': '#EF4444',
  'Storm / Cyclone': '#8B5CF6',
  'Flood Zone Risk': '#0EA5E9',
  'Poor Visibility / Smog': '#6B7280',
  'Severe Air Quality': '#F59E0B',
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
        <div style={{ fontSize: 48 }}>🔮</div>
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
    .map(([trigger, count]) => ({ trigger, count, fill: TRIGGER_COLORS[trigger] || COLORS.aqua }))
    .sort((a, b) => b.count - a.count);

  const avgRisk = forecast?.avg_loss_ratio || 0;
  const riskLevel = avgRisk > 0.25 ? 'HIGH' : avgRisk > 0.1 ? 'MODERATE' : 'LOW';
  const riskColor = avgRisk > 0.25 ? COLORS.danger : avgRisk > 0.1 ? COLORS.orange : COLORS.success;

  return (
    <div className="page-container">
      <div className="page-header animate-in">
        <div className="page-header-row">
          <div>
            <h1>🔮 Predictive Risk Analytics</h1>
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
          <div className="kpi-icon">📍</div>
          <div className="kpi-value" style={{ fontSize: 20 }}>{forecast?.location?.name}</div>
          <div className="kpi-label">Reference Zone</div>
        </div>
        <div className="kpi-card orange">
          <div className="kpi-icon">📈</div>
          <div className="kpi-value">{(avgRisk * 100).toFixed(1)}%</div>
          <div className="kpi-label">Avg Loss Ratio</div>
        </div>
        <div className="kpi-card success">
          <div className="kpi-icon">⛰️</div>
          <div className="kpi-value">{forecast?.elevation_m?.toFixed(0)}m</div>
          <div className="kpi-label">Elevation</div>
        </div>
        <div className="kpi-card purple">
          <div className="kpi-icon">🛡️</div>
          <div className="kpi-value">{forecast?.zone_safety?.zone_safety_score?.toFixed(2)}</div>
          <div className="kpi-label">Zone Safety Score</div>
        </div>
      </div>

      <div className="charts-grid">
        {/* 7-Day Forecast Chart */}
        <div className="chart-card full-width animate-in delay-2">
          <div className="chart-title"><span className="chart-title-icon">📉</span> 7-Day Loss Ratio Forecast (XGBoost Prediction)</div>
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={forecastData}>
              <defs>
                <linearGradient id="gradRisk" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.aqua} stopOpacity={0.4} />
                  <stop offset="95%" stopColor={COLORS.aqua} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="dateLabel" tick={{ fontSize: 12, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
              <YAxis
                tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                tick={{ fontSize: 11, fill: '#475569' }} axisLine={false} tickLine={false}
              />
              <Tooltip
                formatter={(val) => [`${(val * 100).toFixed(1)}%`, 'Loss Ratio']}
                contentStyle={{
                  background: '#1a1f2e', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 8, fontSize: 12,
                }}
              />
              <ReferenceLine y={0.15} stroke={COLORS.orange} strokeDasharray="5 5" label={{
                value: 'Moderate threshold', fill: COLORS.orange, fontSize: 10, position: 'insideTopRight',
              }} />
              <ReferenceLine y={0.35} stroke={COLORS.danger} strokeDasharray="5 5" label={{
                value: 'High risk threshold', fill: COLORS.danger, fontSize: 10, position: 'insideTopRight',
              }} />
              <Area
                type="monotone" dataKey="loss_ratio" name="Loss Ratio"
                stroke={COLORS.aqua} fill="url(#gradRisk)" strokeWidth={3}
                dot={{ r: 5, fill: COLORS.aqua, stroke: '#0a0e1a', strokeWidth: 2 }}
                activeDot={{ r: 7, fill: COLORS.orange }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="charts-grid">
        {/* Forecasted Triggers */}
        <div className="chart-card animate-in delay-3">
          <div className="chart-title"><span className="chart-title-icon">⚡</span> Forecasted Trigger Activity</div>
          {triggerChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={triggerChartData} layout="vertical" barSize={20}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#475569' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="trigger" width={180} tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{
                  background: '#1a1f2e', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 8, fontSize: 12,
                }} />
                <Bar dataKey="count" name="Days Active" radius={[0, 6, 6, 0]}>
                  {triggerChartData.map((d, i) => (
                    <Cell key={i} fill={d.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="loading-container" style={{ height: 280 }}>
              <div style={{ fontSize: 40 }}>🌤️</div>
              <div className="loading-text">Clear week — no triggers forecasted</div>
            </div>
          )}
        </div>

        {/* Daily Breakdown Table */}
        <div className="chart-card animate-in delay-4">
          <div className="chart-title"><span className="chart-title-icon">📅</span> Daily Risk Breakdown</div>
          <div style={{ overflowY: 'auto', maxHeight: 280 }}>
            {forecastData.map((d, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 0', borderBottom: '1px solid var(--border)',
              }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 10,
                  background: `${d.color}15`, border: `1px solid ${d.color}30`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-mono)',
                  color: d.color,
                }}>
                  D{i + 1}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{d.dateLabel}</div>
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
          display: 'flex', justifyContent: 'center', gap: 40,
          padding: '8px 0', fontSize: 12, color: 'var(--text-muted)',
          fontFamily: 'var(--font-mono)',
        }}>
          <span>MODEL: XGBoost v2</span>
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
