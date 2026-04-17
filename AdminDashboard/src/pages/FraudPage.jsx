import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { fetchDashboardStats } from '../api';

const TRUST_COLORS = ['#10B981', '#00E5FF', '#F59E0B', '#EF4444'];

const FRAUD_LAYERS = [
  { id: 'A', name: 'Topographical 3D Trap', desc: 'Phone altitude vs terrain elevation mismatch (>150m)', icon: '🏔️' },
  { id: 'B', name: 'IP Datacenter Sentinel', desc: 'Detects VPN/proxy/datacenter IPs via ip-api.com', icon: '🌐' },
  { id: 'C', name: 'OSRM Kinematic Speed', desc: 'Real road-network speed analysis (>140 km/h = impossible)', icon: '🛣️' },
  { id: 'D', name: 'Temporal Ping Consistency', desc: 'Coefficient of Variation on location ping intervals', icon: '⏱️' },
  { id: 'E', name: 'Behavioral Claim Ratio', desc: 'Flags users with >85% claim-to-policy ratio', icon: '📊' },
  { id: 'F', name: 'API Fog of War Penalty', desc: 'Cautionary loading applied when ≥2 verification APIs fail', icon: '🌫️' },
  { id: 'G', name: 'Haversine Geofence (40km)', desc: 'Blocks payouts if rider teleports >40km from policy baseline', icon: '📍' },
];

export default function FraudPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardStats()
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="page-container">
      <div className="loading-container">
        <div className="spinner" />
        <div className="loading-text">Loading fraud intelligence...</div>
      </div>
    </div>
  );

  const trustData = data?.trust_distribution ? [
    { name: 'Veteran (80+)', value: data.trust_distribution.veteran },
    { name: 'Trusted (50-79)', value: data.trust_distribution.trusted },
    { name: 'Neutral (25-49)', value: data.trust_distribution.neutral },
    { name: 'Suspicious (<25)', value: data.trust_distribution.suspicious },
  ] : [];

  const circuitActive = data?.circuit_breaker_active || false;

  return (
    <div className="page-container">
      <div className="page-header animate-in">
        <h1>🛡️ Fraud Monitor</h1>
        <p>7-Layer Composite Fraud Engine & Unified Trust Score System</p>
      </div>

      {/* Circuit Breaker + Trust Pie */}
      <div className="status-panel animate-in delay-1">
        <div className="circuit-card">
          <div className={`circuit-indicator ${circuitActive ? 'tripped' : 'safe'}`}>
            {circuitActive ? '🚨' : '✅'}
          </div>
          <div className="circuit-title" style={{ color: circuitActive ? 'var(--danger)' : 'var(--success)' }}>
            {circuitActive ? 'CIRCUIT BREAKER TRIPPED' : 'System Nominal'}
          </div>
          <div className="circuit-sub">
            {circuitActive
              ? 'All autopay settlements suspended — aggregated payouts exceeded ₹50,000/5min'
              : 'Flash Crash Circuit Breaker: ₹50,000/5min velocity limit — NOT triggered'}
          </div>
          <div style={{
            marginTop: 16, padding: '10px 16px', borderRadius: 8,
            background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)',
            fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)',
          }}>
            MAX_PAYOUT_PER_5_MINS = ₹50,000<br />
            GLOBAL_PAYOUT_FREEZE = {String(circuitActive)}
          </div>
        </div>

        <div className="circuit-card">
          <div className="chart-title"><span className="chart-title-icon">🏆</span> Trust Score Distribution</div>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={trustData} cx="50%" cy="50%"
                innerRadius={60} outerRadius={100}
                paddingAngle={3} dataKey="value" strokeWidth={0}
              >
                {trustData.map((_, idx) => (
                  <Cell key={idx} fill={TRUST_COLORS[idx]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{
                background: '#1a1f2e', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8, fontSize: 12,
              }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 7-Layer Fraud Engine Visual */}
      <div className="chart-card animate-in delay-3">
        <div className="chart-title"><span className="chart-title-icon">🔬</span> 7-Layer Composite Fraud Engine Architecture</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
          {FRAUD_LAYERS.map((layer) => (
            <div key={layer.id} style={{
              display: 'flex', gap: 14, padding: '16px 18px',
              background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)',
              borderRadius: 12, alignItems: 'flex-start',
              transition: 'var(--transition)',
            }}>
              <div style={{
                width: 42, height: 42, borderRadius: 10,
                background: 'var(--aqua-dim)', border: '1px solid var(--border-accent)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 20, flexShrink: 0,
              }}>
                {layer.icon}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 3 }}>
                  <span style={{ color: 'var(--aqua)', fontFamily: 'var(--font-mono)', fontSize: 11, marginRight: 6 }}>
                    LAYER {layer.id}
                  </span>
                  {layer.name}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: '16px' }}>
                  {layer.desc}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Trust Score Mechanics */}
      <div className="chart-card animate-in delay-4" style={{ marginTop: 24 }}>
        <div className="chart-title"><span className="chart-title-icon">⚙️</span> Unified Trust Score Mechanics</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {[
            { tier: 'Veteran', range: '80-100', emoji: '🟢', color: '#10B981', vesting: '4h', check: 'Light' },
            { tier: 'Trusted', range: '50-79', emoji: '🔵', color: '#00E5FF', vesting: '12h', check: 'Full' },
            { tier: 'Neutral', range: '25-49', emoji: '🟡', color: '#F59E0B', vesting: '24h', check: 'Full + Flag' },
            { tier: 'Suspicious', range: '0-24', emoji: '🔴', color: '#EF4444', vesting: '48h', check: 'Full + Block' },
          ].map((t) => (
            <div key={t.tier} style={{
              background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)',
              borderRadius: 12, padding: 20, textAlign: 'center',
              borderTop: `3px solid ${t.color}`,
            }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>{t.emoji}</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: t.color, marginBottom: 2 }}>{t.tier}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginBottom: 12 }}>
                Score: {t.range}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: '18px' }}>
                <div>Vesting: <strong>{t.vesting}</strong></div>
                <div>Check: <strong>{t.check}</strong></div>
              </div>
            </div>
          ))}
        </div>
        <div style={{
          marginTop: 16, padding: '12px 16px', borderRadius: 8,
          background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.2)',
          fontSize: 12, color: 'var(--text-secondary)',
        }}>
          📐 <strong>Trust evolution:</strong> Clean payout → <span style={{color:'#10B981'}}>+3 pts</span> | 
          Fraud score ≥30 → <span style={{color:'#EF4444'}}>-10 pts</span> | 
          Fraud score ≥60 → <span style={{color:'#EF4444'}}>-25 pts (blocked)</span> | 
          Teleportation → <span style={{color:'#EF4444'}}>-25 pts (blocked)</span>
        </div>
      </div>

      <div style={{ height: 40 }} />
    </div>
  );
}
