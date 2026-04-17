/**
 * GigGuard Admin API Service
 * Connects to the FastAPI backend on Render
 */

export const BASE_URL = 'https://gigshield-4u5z.onrender.com'; // Production/Render
// export const BASE_URL = 'http://localhost:8000'; // Local Testing

// ─── Token Management ───────────────────────────────────────────────────────

export function saveAdminToken(token) {
  localStorage.setItem('adminToken', token);
}

export function getAdminToken() {
  return localStorage.getItem('adminToken');
}

export function clearAdminToken() {
  localStorage.removeItem('adminToken');
}

function authHeaders() {
  const token = getAdminToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

// ─── API Calls ──────────────────────────────────────────────────────────────

export async function adminLogin(email, password) {
  const res = await fetch(`${BASE_URL}/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Login failed');
  }
  const data = await res.json();
  if (data.access_token) saveAdminToken(data.access_token);
  return data;
}

export async function fetchDashboardStats() {
  const res = await fetch(`${BASE_URL}/admin/dashboard`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Dashboard fetch failed: ${res.status}`);
  return res.json();
}

export async function fetchUsers() {
  const res = await fetch(`${BASE_URL}/admin/users`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Users fetch failed: ${res.status}`);
  return res.json();
}

export async function fetchRiskForecast() {
  const res = await fetch(`${BASE_URL}/admin/risk-forecast`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Forecast fetch failed: ${res.status}`);
  return res.json();
}

export async function fetchHealth() {
  const res = await fetch(`${BASE_URL}/health`);
  if (!res.ok) throw new Error(`Health check failed: ${res.status}`);
  return res.json();
}
