import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { fetchDashboardStats } from '../api';
import {
  ShieldAlert, ShieldCheck, ShieldX, Activity, AlertTriangle,
  Mountain, Globe, Route, Timer, BarChart3, CloudFog, MapPin,
  Microscope, Settings,
} from 'lucide-react';

const TRUST_COLORS = ['#34d399', '#2dd4bf', '#fbbf24', '#ef4444'];

const FRAUD_LAYERS = [
  { id: 'A', name: 'Topographical 3D Trap', desc: 'Phone altitude vs terrain elevation mismatch (>150m)', Icon: Mountain },
  { id: 'B', name: 'IP Datacenter Sentinel', desc: 'Detects VPN/proxy/datacenter IPs via ip-api.com', Icon: Globe },
  { id: 'C', name: 'OSRM Kinematic Speed', desc: 'Real road-network speed analysis (>140 km/h = impossible)', Icon: Route },
  { id: 'D', name: 'Temporal Ping Consistency', desc: 'Coefficient of Variation on location ping intervals', Icon: Timer },
  { id: 'E', name: 'Behavioral Claim Ratio', desc: 'Flags users with >85% claim-to-policy ratio', Icon: BarChart3 },
  { id: 'F', name: 'API Fog of War Penalty', desc: 'Cautionary loading applied when ≥2 verification APIs fail', Icon: CloudFog },
  { id: 'G', name: 'Haversine Geofence (40km)', desc: 'Blocks payouts if rider teleports >40km from policy baseline', Icon: MapPin },
];

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
        let formattedVal = isPercentage ? `${val}%` : Number(val).toLocaleString();
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
        <h1>
          <ShieldAlert size={28} className="header-icon" />
          Fraud Monitor
        </h1>
        <p>7-Layer Composite Fraud Engine & Unified Trust Score System</p>
      </div>

      {/* Circuit Breaker + Trust Pie */}
      <div className="status-panel animate-in delay-1">
        <div className="circuit-card">
          <div className={`circuit-indicator ${circuitActive ? 'tripped' : 'safe'}`}>
            {circuitActive ? <ShieldX size={36} /> : <ShieldCheck size={36} />}
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
            marginTop: 16, padding: '10px 16px', borderRadius: 12,
            background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)',
            fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)',
          }}>
            MAX_PAYOUT_PER_5_MINS = ₹50,000<br />
            GLOBAL_PAYOUT_FREEZE = {String(circuitActive)}
          </div>
        </div>

        <div className="circuit-card">
          <div className="chart-title"><span className="chart-title-icon"><Activity size={14} /></span> Trust Score Distribution</div>
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
              <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11, fontFamily: "'Outfit', sans-serif" }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 7-Layer Fraud Engine Visual */}
      <div className="chart-card animate-in delay-3">
        <div className="chart-title"><span className="chart-title-icon"><Microscope size={14} /></span> 7-Layer Composite Fraud Engine Architecture</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          {FRAUD_LAYERS.map((layer) => {
            const LayerIcon = layer.Icon;
            return (
              <div key={layer.id} className="fraud-layer-card">
                <div className="fraud-layer-icon">
                  <LayerIcon size={20} />
                </div>
                <div>
                  <div className="fraud-layer-name">
                    <span className="fraud-layer-label">LAYER {layer.id}</span>
                    {layer.name}
                  </div>
                  <div className="fraud-layer-desc">{layer.desc}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Trust Score Mechanics */}
      <div className="chart-card animate-in delay-4" style={{ marginTop: 24 }}>
        <div className="chart-title"><span className="chart-title-icon"><Settings size={14} /></span> Unified Trust Score Mechanics</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
          {[
            { tier: 'Veteran', range: '80-100', color: '#34d399', vesting: '4h', check: 'Light' },
            { tier: 'Trusted', range: '50-79', color: '#2dd4bf', vesting: '12h', check: 'Full' },
            { tier: 'Neutral', range: '25-49', color: '#fbbf24', vesting: '24h', check: 'Full + Flag' },
            { tier: 'Suspicious', range: '0-24', color: '#ef4444', vesting: '48h', check: 'Full + Block' },
          ].map((t) => (
            <div key={t.tier} className="trust-tier-card" style={{ borderTop: `3px solid ${t.color}` }}>
              <div style={{
                width: 40, height: 40, borderRadius: 12,
                background: `${t.color}15`, border: `1px solid ${t.color}30`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 12px',
              }}>
                <ShieldCheck size={20} style={{ color: t.color }} />
              </div>
              <div style={{ fontFamily: 'var(--font-heading)', fontSize: 15, fontWeight: 800, color: t.color, marginBottom: 2 }}>{t.tier}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginBottom: 12, letterSpacing: '1px' }}>
                SCORE: {t.range}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: '18px' }}>
                <div>Vesting: <strong>{t.vesting}</strong></div>
                <div>Check: <strong>{t.check}</strong></div>
              </div>
            </div>
          ))}
        </div>
        <div style={{
          marginTop: 16, padding: '12px 16px', borderRadius: 12,
          background: 'rgba(52,211,153,0.05)', border: '1px solid rgba(52,211,153,0.2)',
          fontSize: 12, color: 'var(--text-secondary)',
        }}>
          <strong style={{ color: 'var(--aqua-light)' }}>Trust evolution:</strong> Clean payout → <span style={{color:'#34d399'}}>+3 pts</span> | 
          Fraud score ≥30 → <span style={{color:'#ef4444'}}>-10 pts</span> | 
          Fraud score ≥60 → <span style={{color:'#ef4444'}}>-25 pts (blocked)</span> | 
          Teleportation → <span style={{color:'#ef4444'}}>-25 pts (blocked)</span>
        </div>
      </div>

      <div style={{ height: 40 }} />
    </div>
  );
}
