/**
 * GigGuard API Service v2
 * Connects to GigShield_v2 FastAPI backend
 */

import Constants from 'expo-constants';

const BASE_URL = 'https://gigshield-4u5z.onrender.com'; // Production/Render
// const BASE_URL = 'http://10.150.223.37:8000'; // Local Testing

// ─── TYPES ──────────────────────────────────────────────────────────────────

export interface TriggerInfo {
  trigger_id: string;
  trigger_name: string;
  icon: string;
  active: boolean;
  severity: number;
  loss_multiplier: number;
  description: string;
}

export interface AdjustmentInfo {
  type: string;
  amount: number;
  reason: string;
}

export interface ActivePolicy {
  tier: string;
  premium_paid: number;
  activated_at: string;
  expires_at: string;
  status: 'active' | 'expired' | 'cancelled';
}

export interface Payout {
  payout_id: string;
  amount: number;
  trigger_name: string;
  paid_at: string;
  status: string;
}

export interface UserProfile {
  id: string;
  email: string;
  name?: string;
  gig_rider_id?: string;
  gig_id?: string;
  gig_verified?: boolean;
  trust_score?: number;
  created_at?: string;
  is_verified?: boolean;
  active_days_last_30_days?: number;
  coverage_start_hour?: number | null;
  active_policy?: ActivePolicy;
  policy_history?: ActivePolicy[];
  payout_history?: Payout[];
}

export interface PlanDetail {
  label: string;
  coverage_pct: number;
  description: string;
  coverage_hours_per_day: number;
  base_premium_inr: number;
  adjustments: AdjustmentInfo[];
  total_adjustment_inr: number;
  weekly_premium_inr: number;
  monthly_premium_inr: number;
  expected_weekly_payout_inr: number;
  max_weekly_payout_inr: number;
  is_eligible: boolean;
}

export interface ZoneProfile {
  elevation_m: number;
  distance_to_coast_km: number;
  is_coastal: boolean;
  waterlogging_risk: string;
  zone_safety_score: number;
  weekly_discount_inr: number;
}

export interface ForecastRisk {
  trigger_days_count: number;
  max_simultaneous_triggers: number;
  coverage_extended: boolean;
  forecast_summary: string;
  daily_risks: number[];
}

export interface PremiumResponse {
  latitude: number;
  longitude: number;
  daily_income_inr: number;
  date: string;

  // Zone Profile
  zone_profile: ZoneProfile;

  // Active triggers today
  all_triggers_today: TriggerInfo[];

  // Forecast risk summary
  forecast_risk: ForecastRisk;

  // Risk signal
  forecast_loss_ratio_7d: number;
  disruption_risk: 'low' | 'moderate' | 'high' | 'extreme';

  // Three-tier plans (with adjustments)
  plans: {
    basic: PlanDetail;
    standard: PlanDetail;
    premium: PlanDetail;
  };

  model_version: string;
  model_r2: number;
  is_suspended: boolean;
  today_weather?: any;
}

export interface HealthResponse {
  status: string;
  version: string;
  model_features: number;
  test_r2: number;
  test_mae: number;
  triggers: string[];
  note: string;
  db_status?: string;
}

import * as SecureStore from 'expo-secure-store';

export interface AuthResponse {
  status: string;
  user_id: string;
  message: string;
  access_token: string;
  token_type: string;
}

// ─── SECURE STORAGE UTILITIES ───────────────────────────────────────────────

export async function saveToken(token: string) {
  try {
    await SecureStore.setItemAsync('userToken', token);
  } catch (err) {
    console.error('Failed to save auth token', err);
  }
}

export async function getToken() {
  try {
    return await SecureStore.getItemAsync('userToken');
  } catch (err) {
    console.error('Failed to get auth token', err);
    return null;
  }
}

export async function clearToken() {
  try {
    await SecureStore.deleteItemAsync('userToken');
  } catch (err) {
    console.error('Failed to clear auth token', err);
  }
}

// ─── API FUNCTIONS ──────────────────────────────────────────────────────────

export async function fetchPremium(
  latitude: number,
  longitude: number,
  dailyIncome: number = 800,
  targetDate?: string,
  noClaimWeeks: number = 0,
): Promise<PremiumResponse> {
  const body: Record<string, any> = {
    latitude,
    longitude,
    daily_income: dailyIncome,
    no_claim_weeks: noClaimWeeks,
  };
  if (targetDate) body.target_date = targetDate;

  const response = await fetch(`${BASE_URL}/premium`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API Error ${response.status}: ${errorText}`);
  }

  return response.json();
}

export async function checkHealth(): Promise<HealthResponse> {
  const response = await fetch(`${BASE_URL}/health`);
  if (!response.ok) {
    throw new Error(`Health check failed: ${response.status}`);
  }
  return response.json();
}

export async function loginUser(email: string, password: string): Promise<AuthResponse> {
  const response = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Login failed. Please check your credentials.');
  }

  const data: AuthResponse = await response.json();
  if (data.access_token) {
    await saveToken(data.access_token);
  }
  return data;
}

export async function registerUser(email: string, password: string): Promise<AuthResponse> {
  const response = await fetch(`${BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Registration failed.');
  }

  const data: AuthResponse = await response.json();
  if (data.access_token) {
    await saveToken(data.access_token);
  }
  return data;
}

export async function syncFirebaseUser(email: string, uid: string, name?: string): Promise<AuthResponse> {
  const response = await fetch(`${BASE_URL}/auth/firebase-sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      firebase_token: uid,
      name
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Sync failed.');
  }

  const data: AuthResponse = await response.json();
  if (data.access_token) {
    await saveToken(data.access_token);
  }
  return data;
}

export async function fetchUserProfile(): Promise<any> {
  const token = await getToken();
  if (!token) throw new Error('Not authenticated');

  const response = await fetch(`${BASE_URL}/auth/me`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch profile: ${response.status}`);
  }

  return response.json();
}

export async function updateUserProfile(data: any): Promise<any> {
  const token = await getToken();
  if (!token) throw new Error('Not authenticated');

  const response = await fetch(`${BASE_URL}/auth/profile/update`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Update failed');
  }

  return response.json();
}

export async function purchasePolicy(
  tier: string,
  premium: number,
  latitude: number,
  longitude: number,
  razorpayOrderId?: string,
  razorpayPaymentId?: string,
  razorpaySignature?: string
): Promise<any> {
  const token = await getToken();
  if (!token) throw new Error('Not authenticated');

  const response = await fetch(`${BASE_URL}/policy/purchase`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      tier,
      premium_paid: premium,
      latitude,
      longitude,
      razorpay_order_id: razorpayOrderId,
      razorpay_payment_id: razorpayPaymentId,
      razorpay_signature: razorpaySignature,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Purchase failed');
  }

  return response.json();
}

/**
 * Create a Razorpay Sandbox order for premium payment
 */
export async function createRazorpayOrder(tier: string, amount: number): Promise<{
  order_id: string;
  amount: number;
  amount_paise: number;
  currency: string;
  key_id: string;
}> {
  const token = await getToken();
  if (!token) throw new Error('Not authenticated');

  const response = await fetch(`${BASE_URL}/policy/order`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ tier, amount }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Order creation failed');
  }

  return response.json();
}

/**
 * Simulate an automated payout for the demo
 */
export async function simulatePayout(amount: number, triggerName: string): Promise<any> {
  const token = await getToken();
  if (!token) throw new Error('Not authenticated');

  const response = await fetch(`${BASE_URL}/policy/payout/simulate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ amount, trigger_name: triggerName }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Payout simulation failed');
  }

  return response.json();
}

/**
 * Register Expo push token for autopay notifications
 */
export async function registerPushToken(expoPushToken: string): Promise<any> {
  const token = await getToken();
  if (!token) throw new Error('Not authenticated');

  const response = await fetch(`${BASE_URL}/user/push-token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ expo_push_token: expoPushToken }),
  });

  if (!response.ok) {
    console.warn('Push token registration failed');
  }
  return response.json();
}

/**
 * Update user's GPS location for autopay trigger scanning
 */
export async function updateUserLocation(latitude: number, longitude: number, altitude: number = 0): Promise<any> {
  const token = await getToken();
  if (!token) return;

  const response = await fetch(`${BASE_URL}/user/location`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ latitude, longitude, altitude }),
  });

  return response.json();
}

/**
 * Verify if a Razorpay order was actually paid
 */
export async function verifyRazorpayOrder(orderId: string): Promise<{
  paid: boolean;
  status: string;
  amount_paid: number;
}> {
  const token = await getToken();
  if (!token) throw new Error('Not authenticated');

  const response = await fetch(`${BASE_URL}/policy/order/verify/${orderId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Payment verification failed');
  }

  return response.json();
}

export { BASE_URL };
