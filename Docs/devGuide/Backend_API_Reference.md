# 🌐 Backend API Reference

This document highlights the core FastAPI endpoints exposed in `GigShield_v2_copy/main.py`.

## Base Configuration

*   **Host Default**: `0.0.0.0:8000`
*   **Docs UI**: `http://localhost:8000/docs` (Swagger)

---

## `POST /premium`
**The Core ML AI Engine Route.** Fetches weather, runs the ML model, and returns the customized insurance plans.

**Request Payload:**
```json
{
  "latitude": 28.61,
  "longitude": 77.23,
  "daily_income": 1000.0,
  "target_date": "2024-04-10", 
  "no_claim_weeks": 2,
  "active_days_last_30_days": 20
}
```

**Response Overview:**
Returns a `PremiumResponse` object inclusive of:
- `is_suspended` (boolean, circuit breaker flag)
- `disruption_risk` (string: low/moderate/high/extreme)
- `zone_profile` (Zone metrics and safety score)
- `forecast_risk` (7-day trigger forecast)
- `plans` (Dictionary defining `basic`, `standard`, and `premium` tiers)

---

## Auth Endpoints

### `POST /auth/register` & `POST /auth/login`
Legacy MongoDB authentication system utilizing Email/Password combinations. JWT returns an `access_token` on success.

### `POST /auth/firebase-sync`
**Primary App Route.** Receives a verified Firebase Token from the frontend and syncs/upserts the profile into the MongoDB `users` collection.

**Request:**
```json
{
  "email": "rider@gudiewire.com",
  "firebase_token": "uid_xxxx",
  "name": "Alex"
}
```

---

## Error Handling & Fallbacks

- **Weather API Hard Fallback:** If `httpx` encounters a `ConnectError` connecting to Open-Meteo API (e.g. hackathon wifi drops), `/premium` falls back to a realistic set of hard-coded mocked arrays to prevent crashes.
