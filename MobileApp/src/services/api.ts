/**
 * GigGuard API Service v2
 * Connects to GigShield_v2 FastAPI backend
 */

const BASE_URL = __DEV__ 
  ? 'http://10.251.230.37:8000'
  : 'http://10.251.230.37:8000';

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
}

export interface PremiumResponse {
  latitude: number;
  longitude: number;
  daily_income_inr: number;
  date: string;

  // Zone Profile
  zone_profile: ZoneProfile;

  // Active triggers today
  active_triggers_today: TriggerInfo[];

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
}

export interface HealthResponse {
  status: string;
  version: string;
  model_features: number;
  test_r2: number;
  test_mae: number;
  triggers: string[];
  note: string;
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

export { BASE_URL };
