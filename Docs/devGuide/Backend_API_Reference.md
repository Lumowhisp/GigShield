# 🌐 Backend API Reference

This document highlights the core FastAPI endpoints exposed in `GigGuard_v2_copy/main.py` which power the React Native experience.

## Base Configuration

*   **Host Default**: `https://gigshield-4u5z.onrender.com`
*   **CORS**: Completely handled via FastAPI Middleware allowing `*`
*   **Docs UI**: `https://gigshield-4u5z.onrender.com/docs` (Swagger)

---

## The AI Engine

### `POST /premium`
**The Core ML AI Pricing Route.** Fetches weather, runs the 39-feature XGBoost model, checks DB underwriting status, and returns the customized insurance plans.

**Request Payload:**
```json
{
  "latitude": 28.61,
  "longitude": 77.23,
  "daily_income": 1000.0,
  "target_date": "2026-04-04", 
  "no_claim_weeks": 2,
  "active_days_last_30_days": 20
}
```

**Response Overview (`PremiumResponse`):**
- `is_suspended` (boolean, circuit breaker flag)
- `disruption_risk` (string: low/moderate/high/extreme)
- `zone_profile` (Zone metrics and safety score)
- `forecast_risk` (7-day trigger forecast)
- `plans` (Dictionary defining `basic`, `standard`, and `premium` tiers, along with all calculated `adjustments` arrays)
- *(Fallback)*: If Open-Meteo drops connection, system falls back to a hardcoded data frame ensuring the presentation never crashes.

---

## User Authentication & Sync (`/auth`)

### `POST /auth/login` | `POST /auth/register`
MongoDB authentication systems storing `bcrypt` hashed passwords and creating standard JWT bearer tokens.

### `POST /auth/firebase-sync`
**Primary App Route.** Receives a verified Firebase Token from the frontend and syncs/upserts the profile into the MongoDB `users` collection, handling the Firebase-to-JWT bridge securely.

### `GET /auth/me` | `POST /auth/profile/update`
Requires Bearer JWT. Retrieves and updates the dynamic MongoDB user document. Converts `_id` to string safely.

---

## Policy & Fraud Prevention (`/policy`)

### `POST /policy/purchase`
Writes an active 7-day policy to the `users -> active_policy` mapping. 

### `POST /policy/payout/simulate`
Simulates a zero-touch parametric payout settlement with integrated fraud detection.
**Flow:**
1. Validates JWT and active policy timeline
2. **Fraud Check**: Scans `payout_history` array to verify no identical payout has settled for that trigger in the last 24 hours.
3. Performs a MongoDB atomicity `$push` rollback if any operation fails.
4. Simulates a 3-second instant UPI credit via the `status: "settled"` return token.

---

## Razorpay Payment Flow (`/policy/order`)

### `POST /policy/order`
Creates a Razorpay Sandbox order for premium collection. Returns `order_id`, `amount`, `key_id` for the mobile app to open checkout.

### `GET /policy/order/verify/{order_id}`
Verifies whether a Razorpay order has been paid after the user closes the checkout browser.

### `GET /razorpay/checkout`
Serves a minimal hosted HTML checkout page that loads the Razorpay JS SDK. Opened via expo-web-browser from the mobile app.

### `POST /policy/purchase`
Records a policy purchase and activates 7-day coverage. If Razorpay fields are provided, verifies the payment signature first.

---

## User Telemetry (`/user`)

### `POST /user/push-token`
Stores the Expo Push Token for push notifications on payout settlements.

### `POST /user/location`
Stores the user's latest GPS location for autopay trigger scanning. Awards +2 trust for consistent GPS (within 5km, max once per 24h).

---

## Admin Dashboard (`/admin`)

### `POST /admin/login`
Admin authentication with JWT token generation (role-based access control).

### `GET /admin/dashboard`
Aggregated platform stats: total users, active policies, total premiums, total payouts, loss ratio, tier/trust distribution, trigger frequency, daily charts, circuit breaker status.

### `GET /admin/users`
Paginated list of all registered users with policy summaries, trust scores, and location data.

### `GET /admin/risk-forecast`
7-day predictive risk forecast for admin analytics using Delhi NCR as reference. Returns loss ratios, active triggers, and compound severity per day.
