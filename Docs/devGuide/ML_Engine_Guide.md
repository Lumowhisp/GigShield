# 🧠 Machine Learning Engine & Actuarial Guide

This strictly documents the Machine Learning, Algorithmic Triggers, and Pricing logic driving GigShield. The engine lives mostly in `GigShield_v2_copy/main.py` and `disruption_triggers.py`.

## 1. Disruption Triggers (Heuristic Rules)

Before the ML model fires, the system evaluates deterministic triggers. These are safety nets guaranteeing payouts/warnings on highly specific conditions based on IMD/WHO guidelines.

*   `trigger_heavy_rain`: Evaluates `rolling_7d_rain_mm` and active `precipitation_mm`. Includes a coastal discount layer and river-basin detection logic.
*   `trigger_extreme_heat`: Analyzes `temp_max` vs `apparent_temp_max` (humidity index). Uses GPS-adaptive thresholds (e.g., 38°C coast, 42°C plains, 43°C desert).
*   `trigger_storm`: Calculates severe multi-day wind loading mapping to cyclone risk levels.
*   `trigger_flood_zone`: Activates in low-elevation zones (<30m) coupled with extreme 7-day rolling precipitation. Extremely sensitive in the Gangetic plain footprint.
*   `trigger_poor_visibility`: Uses solar radiation proxy (`shortwave_radiation_mj`) to detect heavy overcast/fog and Deccan plateau dust storms.
*   **`trigger_severe_aqi` (Hackathon Special)**: Restricts evaluation bounding box strictly to **Delhi/NCR**. Proxies an `AQI > 300` threshold by looking for intense temperature inversions combined with stagnant air (wind < 12kmh) and blocked solar radiation.

---

## 2. Dynamic Pricing Math (`compute_dynamic_premium`)

The AI calculates exactly what a rider should pay through sophisticated actuarial adjustments.

**Formula Steps:**
1.  **Expected Payout Calculation:**
    `expected_payout = daily_income * avg_forecasted_loss_ratio * plan_coverage_pct * 7_days`
2.  **Risk & Uncertainty Loading:**
    We calculate the forecast volatility (Standard Deviation `sigma` of the 7-day predictions). Highly chaotic weather introduces a "Sigma Risk Load" ensuring the company remains solvent if the model is slightly wrong.
3.  **Tail Modifier:**
    A multiplier applied if isolated severe days (e.g. 1 huge storm day) exist in the forecast.
4.  **Base Premium Extraction:**
    `pure_premium = (expected_payout + risk_load) * tail_modifier`
    `base_premium = pure_premium * (1 + ops_margin + dynamic_margin)`
5.  **Micro-Adjustments (Real-Time):**
    - **Zone Safety Discount**: Deduction (₹2–10) if the user's GPS is safely elevated away from waterlogging.
    - **Forecast Surge**: If 4+ severe days are predicted, coverage hours auto-extend, adding a 12% premium surcharge.
    - **Loyalty / No Claim Bonus**: Up to 15% deduction.
    - **Multi-Trigger Loading**: Compound surcharge if 3+ hazards trigger simultaneously.
    - **Seasonal Adjustment**: Monsoon months receive a 15% blanket surcharge.
6.  **Capping:**
    Regardless of AI pricing, hard affordability caps are applied to protect riders:
    - Basic (40%): `max 49 INR/week`
    - Standard (70%): `max 99 INR/week`
    - Premium (100%): Uncapped (dynamic)

---

## 3. Circuit Breakers & Underwriting

**Circuit Breaker Logic:**
If the `avg_loss_ratio` across the next 7 days exceeds `85%`, the backend flips an internal `is_suspended = True` flag. The API returns the data, but the mobile app intercepts this flag to kill sales, protecting the insurance pool from known catastrophic events (e.g. Mumbai 14-day Monsoons). Note that existing customers will receive payouts.

**Underwriting (Deliverable B):**
Users with fewer than **5 active delivery days in the last 30 days** are statistically riskier or not full-time. The ML payload (`PremiumRequest`) enforces this:
If `active_days_last_30_days < 5`, then `is_eligible = False` is broadcasted for Standard and Premium tiers, locking them with reduced opacity in the UI.
