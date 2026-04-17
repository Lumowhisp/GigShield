import React, { useState, useEffect } from 'react';
import { fetchUsers } from '../api';
import { Users, Search, MapPin, CheckCircle2, XCircle } from 'lucide-react';

function getTrustTier(score) {
  if (score >= 80) return { label: 'Veteran', cls: 'veteran', icon: '●' };
  if (score >= 50) return { label: 'Trusted', cls: 'trusted', icon: '●' };
  if (score >= 25) return { label: 'Neutral', cls: 'neutral', icon: '●' };
  return { label: 'Suspicious', cls: 'suspicious', icon: '●' };
}

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState('trust_score');
  const [sortDir, setSortDir] = useState(-1);

  useEffect(() => {
    fetchUsers()
      .then((data) => setUsers(data.users || []))
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  }, []);

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d * -1);
    else { setSortKey(key); setSortDir(-1); }
  };

  const filtered = users
    .filter((u) => {
      const q = search.toLowerCase();
      return u.email?.toLowerCase().includes(q) ||
             u.name?.toLowerCase().includes(q) ||
             u.gig_rider_id?.toLowerCase().includes(q);
    })
    .sort((a, b) => {
      const av = a[sortKey] ?? 0;
      const bv = b[sortKey] ?? 0;
      if (typeof av === 'string') return av.localeCompare(bv) * sortDir;
      return (av - bv) * sortDir;
    });

  if (loading) return (
    <div className="page-container">
      <div className="loading-container">
        <div className="spinner" />
        <div className="loading-text">Loading user database...</div>
      </div>
    </div>
  );

  return (
    <div className="page-container">
      <div className="page-header animate-in">
        <h1>
          <Users size={28} className="header-icon" />
          Users & Policies
        </h1>
        <p>Manage all registered riders, trust scores, and policy statuses</p>
      </div>

      <div className="table-container animate-in delay-2">
        <div className="table-toolbar">
          <div className="search-wrapper">
            <Search size={14} className="search-icon" />
            <input
              className="search-input"
              type="text"
              placeholder="Search by email, name, or rider ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: 13, fontFamily: 'var(--font-mono)' }}>
            {filtered.length} of {users.length} users
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th onClick={() => handleSort('email')} style={{ cursor: 'pointer' }}>
                  Email {sortKey === 'email' ? (sortDir > 0 ? '↑' : '↓') : ''}
                </th>
                <th>Rider ID</th>
                <th onClick={() => handleSort('trust_score')} style={{ cursor: 'pointer' }}>
                  Trust {sortKey === 'trust_score' ? (sortDir > 0 ? '↑' : '↓') : ''}
                </th>
                <th>Policy</th>
                <th>Tier</th>
                <th onClick={() => handleSort('total_premium_paid')} style={{ cursor: 'pointer' }}>
                  Premium Paid {sortKey === 'total_premium_paid' ? (sortDir > 0 ? '↑' : '↓') : ''}
                </th>
                <th onClick={() => handleSort('total_payout_amount')} style={{ cursor: 'pointer' }}>
                  Payouts {sortKey === 'total_payout_amount' ? (sortDir > 0 ? '↑' : '↓') : ''}
                </th>
                <th>Verified</th>
                <th>Location</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => {
                const tier = getTrustTier(u.trust_score);
                return (
                  <tr key={u.id}>
                    <td>{u.email}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{u.gig_rider_id || '-'}</td>
                    <td>
                      <span className={`trust-badge ${tier.cls}`}>
                        {tier.icon} {u.trust_score?.toFixed(0)}/100
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${u.policy_status}`}>
                        {u.policy_status}
                      </span>
                    </td>
                    <td style={{ textTransform: 'capitalize' }}>{u.policy_tier}</td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>₹{u.total_premium_paid?.toFixed(0)}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', color: u.total_payout_amount > 0 ? 'var(--success)' : 'var(--text-muted)' }}>
                      ₹{u.total_payout_amount?.toFixed(0)}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {u.gig_verified
                        ? <CheckCircle2 size={16} style={{ color: 'var(--success)' }} />
                        : <XCircle size={16} style={{ color: 'var(--danger)' }} />
                      }
                    </td>
                    <td style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      {u.last_location ? (
                        <>
                          <MapPin size={12} />
                          {u.last_location.lat?.toFixed(2)}, {u.last_location.lon?.toFixed(2)}
                        </>
                      ) : '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ height: 40 }} />
    </div>
  );
}
