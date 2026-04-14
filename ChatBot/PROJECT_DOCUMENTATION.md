# 🛡️ GigShield Ultimate — Neural Ninjas

> **Parametric Micro-Insurance Platform for Gig-Economy Riders**
>
> Zero-touch, data-driven insurance that auto-detects weather, pollution, traffic, & platform disruptions — and pays riders instantly.

---

## 📑 Table of Contents

1. [Problem Statement](#-problem-statement)
2. [Solution Overview](#-solution-overview)
3. [Tech Stack](#-tech-stack)
4. [Project Structure](#-project-structure)
5. [Database Architecture](#-database-architecture)
6. [Business Rules & Underwriting](#-business-rules--underwriting)
7. [Actuarial Payout Formula](#-actuarial-payout-formula)
8. [ML Premium Engine](#-ml-premium-engine)
9. [Application Workflow](#-application-workflow)
10. [API Reference](#-api-reference)
11. [External API Integrations](#-external-api-integrations)
12. [Security Architecture](#-security-architecture)
13. [Setup & Run](#-setup--run)
14. [Team](#-team)

---

## 🎯 Problem Statement

Gig-economy delivery riders face **daily income loss** due to:
- 🌧️ Heavy rainfall making roads unsafe
- 💨 Severe air pollution (AQI > 300)
- 🚗 Traffic gridlocks halting deliveries
- 📰 Strikes and protests disrupting operations
- 🖥️ Platform server outages cutting off orders

Traditional insurance is **too slow, too expensive, and too complex** for gig workers earning ₹300-800/day.

---

## 💡 Solution Overview

**GigShield** is a **parametric micro-insurance** platform that:

| Feature | Description |
|---|---|
| **Instant Verification** | Live API data from weather, AQI, traffic, and news sources |
| **Zero-Touch Payouts** | Admin triggers city-wide auto-payouts when thresholds breach |
| **Dynamic ML Pricing** | 14-day forecast-based risk scoring with dynamic premium plans |
| **Actuarial Payout Model** | Payouts calculated by formula with 40% company margin |
| **AI Rider Assistant** | GigBot floating chatbot powered by Groq `llama-3.1-8b-instant` |
| **Fraud Detection** | Strike-based penalty system with progressive bans |
| **Underwriting Gate** | Minimum 5 active delivery days required for eligibility |
| **Firebase Auth Bridge** | Mobile app integration via Firebase token sync |
| **Circuit Breaker** | Auto-suspends underwriting during extreme weather forecasts |
| **Full Audit Trail** | Every ₹ movement logged as an immutable transaction |

---

## 🧰 Tech Stack

| Layer | Technology | Why |
|---|---|---|
| **Backend Framework** | FastAPI (Python) | Async-first, auto-generated docs, type-safe |
| **Database** | MongoDB Atlas | Flexible document model, cloud-hosted |
| **Async DB Driver** | Motor | Non-blocking MongoDB operations |
| **Schema Validation** | Pydantic V2 | Strict typing with enum enforcement |
| **Authentication** | Bcrypt + PyJWT (HS256) | Industry-standard password hashing + stateless tokens |
| **Mobile Auth** | Firebase Auth Bridge | Seamless React Native integration |
| **HTTP Client** | httpx | Async parallel requests to external APIs + ML forecast |
| **Configuration** | pydantic-settings | Type-safe `.env` loading |
| **Server** | Uvicorn (ASGI) | Production-grade async server |
| **Frontend** | Vanilla HTML/CSS/JS | Single-page app served by FastAPI |

---

## 📁 Project Structure

```
GigShield_Backend/
│
├── main.py                    # App entrypoint — lifespan, seeding, migrations
├── config.py                  # Centralized .env configuration (pydantic-settings)
├── database.py                # MongoDB connection, collections, index creation
├── auth.py                    # Password hashing, JWT token management, FastAPI deps
├── models.py                  # All Pydantic V2 schemas (DB models + API schemas)
│
├── routes/
│   ├── auth_routes.py         # Registration, Login, Firebase Sync, Forgot/Reset Password
│   ├── claims_routes.py       # Claim filing, Policy purchase, ML Premium pricing, Policy status
│   └── admin_routes.py        # Ban management, Platform toggle, Zero-touch payouts, Rider Data Sheet
│
├── services/
│   └── verification.py        # Parallel external API verification engine
│
├── templates/
│   ├── index.html             # Rider App UI (Public SPA)
│   └── admin.html             # Admin Portal UI (Isolated, secret route)
│
├── uploads/                   # Server-side claim image proof storage
├── requirements.txt           # Python dependencies
├── .env                       # Environment secrets (not committed)
└── .gitignore
```

---

## 🗃️ Database Architecture

### Collections & Models

GigShield uses **4 MongoDB collections** with strict separation of concerns:

| Collection | Pydantic Model | Purpose |
|---|---|---|
| `riders` | `RiderProfile` | Rider accounts, wallets, policy state, ban history |
| `transactions` | `TransactionLog` | Immutable financial ledger (all money movements) |
| `admin_metrics` | `AdminDashboardMetrics` | Pre-aggregated KPIs for admin dashboard |
| `app_state` | — | Platform status toggle (outage simulation) |

### RiderProfile Schema (Collection: `riders`)

```
┌─────────────────────────────────────────────────────────┐
│                      RiderProfile                       │
├─────────────────────────────────────────────────────────┤
│  Identity                                               │
│  ├── rider_id          (str, unique, "GIG-XXXXX")       │
│  ├── name              (str)                            │
│  ├── phone             (str)                            │
│  ├── email             (EmailStr, unique)               │
│  ├── age               (int, ≥ 18)                      │
│  ├── city              (str)                            │
│  ├── avg_daily_income  (float, ≥ 0)                     │
│  └── password          (str, bcrypt hash)               │
│                                                         │
│  Underwriting                                           │
│  └── active_delivery_days  (int, default 0)             │
│                                                         │
│  Financial State                                        │
│  └── balance           (float, default 0.0)             │
│                                                         │
│  Policy State                                           │
│  ├── has_active_policy   (bool)                         │
│  ├── active_policy_type  (PolicyType enum)              │
│  ├── premium_paid        (float)                        │
│  └── policy_expiry       (datetime, UTC)                │
│                                                         │
│  Ban Management                                         │
│  ├── current_ban_status  (BanType enum)                 │
│  └── ban_history[]       (BanRecord array)              │
│                                                         │
│  OTP / Password Reset                                   │
│  ├── reset_otp           (str, nullable)                │
│  └── otp_expiry          (datetime, nullable)           │
│                                                         │
│  Firebase Integration                                   │
│  └── firebase_uid        (str, nullable)                │
│                                                         │
│  Timestamps                                             │
│  ├── created_at          (datetime, UTC)                │
│  └── updated_at          (datetime, UTC)                │
└─────────────────────────────────────────────────────────┘
```

### TransactionLog Schema (Collection: `transactions`)

```
┌─────────────────────────────────────────────────────────┐
│                     TransactionLog                      │
├─────────────────────────────────────────────────────────┤
│  tx_id        (str, UUID, unique)                       │
│  rider_id     (str, FK → riders)                        │
│  amount       (float, +credit / -debit)                 │
│  tx_type      (TransactionType enum)                    │
│  description  (str, human-readable)                     │
│  timestamp    (datetime, UTC)                           │
└─────────────────────────────────────────────────────────┘

TransactionType Enum:
  • premium_paid      — Policy premium deduction
  • claim_payout      — Approved claim credit
  • penalty_deducted  — Fraud strike wallet penalty
```

### Enum Definitions

```python
BanType:        "none" | "temporary" | "permanent"
PolicyType:     "heavy_rain" | "severe_pollution" | "traffic_gridlock" | "comprehensive"
TransactionType: "premium_paid" | "claim_payout" | "penalty_deducted"
```

### Database Indexes

| Collection | Field | Type |
|---|---|---|
| `riders` | `rider_id` | Unique |
| `riders` | `email` | Unique |
| `transactions` | `tx_id` | Unique |
| `transactions` | `rider_id` | Query index |
| `transactions` | `timestamp` | Query index |
| `transactions` | `tx_type` | Query index |
| `admin_metrics` | `last_updated` | Query index |

---

## 📜 Business Rules & Underwriting

### Rule 1: Minimum Active Days (Underwriting Gate)

```
IF rider.active_delivery_days < 5:
    REJECT policy purchase
    MESSAGE: "Underwriting Rejected: Minimum 5 active delivery days
              required before cover starts."
```

**Why:** Prevents adverse selection — riders must demonstrate active platform usage before they can buy cover.

### Rule 2: Dynamic ML-Based Premium Pricing

Premium pricing is now dynamically computed by the ML Engine based on:
- **14-day weather forecast** for the rider's location
- **City tier** (base premium: Delhi/Noida/Gurugram ₹45, Mumbai/Chennai ₹40, Others ₹30)
- **Rider income** (income-adjusted factor, capped at 1.3x)
- **Risk multiplier** (1.0x to 2.0x based on forecast risk score)

Three plan tiers are offered: **Basic** (rain-only), **Standard** (rain + pollution), **Premium** (comprehensive).

### Rule 3: Circuit Breaker (Underwriting Suspension)

```
IF ML_forecast_risk > 0.85:
    SUSPEND all new policy purchases
    STATUS: "Underwriting Suspended: High Risk"
    REASON: Extreme 14-day weather forecast (floods, cyclones, etc.)
```

### Rule 4: Fraud Detection & Progressive Penalties

| Strike Count | Wallet Penalty | Action |
|---|---|---|
| 5 | ₹50 | Warning |
| 7 | ₹80 | Escalated warning |
| ≥ 10 | ₹120 | **Permanent ban** |

Strikes are tracked via the `ban_history` array length. Each rejected claim appends a `BanRecord`.

---

## 📊 Actuarial Payout Formula

GigShield uses a **Dynamic Actuarial Payout Model** that locks a **40% company margin**.

### The Formula

```
                    premium_paid × TARGET_LOSS_RATIO
calculated_payout = ─────────────────────────────────────
                    event_probability × (1 + SAFETY_MARGIN)
```

### Locked Constants

| Constant | Value | Meaning |
|---|---|---|
| `TARGET_LOSS_RATIO` | **0.60** | 60% of premium income allocated to claims |
| `SAFETY_MARGIN` | **0.15** | 15% actuarial buffer for adverse deviation |
| **Company Margin** | **40%** | Retained for operations (1 − 0.60 = 0.40) |

### Event Probability Mapping

| Policy Type | Probability Key | Event Probability |
|---|---|---|
| `traffic_gridlock` | traffic | **0.05** (5%) |
| `heavy_rain` | rain | **0.10** (10%) |
| `severe_pollution` | aqi | **0.15** (15%) |
| `comprehensive` | aqi (fallback) | **0.15** (15%) |

### Worked Examples

#### Example 1: Heavy Rain Policy (Mumbai Rider)
```
Premium paid     = ₹40
Event probability = 0.10 (rain)

Payout = (40 × 0.60) / (0.10 × 1.15)
       = 24 / 0.115
       = ₹208.70
```

#### Example 2: Comprehensive Policy (Delhi Rider)
```
Premium paid     = ₹45
Event probability = 0.15 (aqi)

Payout = (45 × 0.60) / (0.15 × 1.15)
       = 27 / 0.1725
       = ₹156.52
```

#### Example 3: Traffic Gridlock Policy
```
Premium paid     = ₹30
Event probability = 0.05 (traffic)

Payout = (30 × 0.60) / (0.05 × 1.15)
       = 18 / 0.0575
       = ₹313.04
```

> **Key Insight:** Lower-probability events produce **higher payouts** — this is actuarially correct. A 5% event is rarer, so each occurrence must cover more lost income to make the insurance worthwhile.

---

## 🤖 ML Premium Engine

### Dynamic Pricing Flow

```
Mobile App / Frontend
        │
        ▼
  POST /claims/premium
  { latitude, longitude, daily_income, city, active_days }
        │
        ▼
  ┌───────────────────────┐
  │ Fetch 14-day forecast │──── Open-Meteo API
  │ precipitation_sum     │     (daily forecast data)
  │ temperature_max       │
  └──────────┬────────────┘
             │
             ▼
  ┌───────────────────────┐
  │ Compute Risk Score    │
  │ (0.0 – 1.0)          │
  │                       │
  │ Precipitation > 200mm │ → +0.40 risk
  │ Precipitation > 100mm │ → +0.25 risk
  │ Heavy rain days ≥ 7   │ → +0.30 risk (flood)
  │ Temperature > 48°C    │ → +0.20 risk
  └──────────┬────────────┘
             │
      ┌──────┴──────┐
      ▼              ▼
 Risk ≤ 0.85    Risk > 0.85
      │              │
      ▼              ▼
 Generate 3     SUSPEND
 dynamic        underwriting
 plan tiers     (Circuit Breaker)
      │
      ▼
 PremiumResponse
 { is_suspended, forecast_risk, plans[], risk_factors[] }
```

### Dynamic Premium Calculation

```
risk_multiplier = 1.0 + (forecast_risk × 1.0)    # 1.0x to 2.0x
income_factor   = min(1.0 + (income/3000 × 0.3), 1.3)

Basic    = base_premium × 0.7 × risk_multiplier × income_factor
Standard = base_premium × 1.0 × risk_multiplier × income_factor
Premium  = base_premium × 1.4 × risk_multiplier × income_factor
```

---

## ⚙️ Application Workflow

### Startup Sequence

```
1. uvicorn main:app --reload
2. Create /uploads directory
3. Create MongoDB indexes (6 indexes across 3 collections)
4. Seed default rider (Rider_007) + admin account
5. Initialize platform_status = false in app_state
6. Run legacy rider migration (idempotent backfill)
7. Seed admin_metrics document (if missing)
8. ✅ App ready on https://gigshield-4u5z.onrender.com
```

### Rider Journey

```
REGISTER → LOGIN → ADD BALANCE → BUY POLICY → FILE CLAIM → GET PAYOUT
    │          │                      │              │            │
    ▼          ▼                      ▼              ▼            ▼
 GIG-ID    JWT Token          Check ≥5 days    4 API checks   Actuarial
 created   (2hr expiry)      ML premium       Decision engine  formula
                              Store premium    Image proof      payout
```

### Mobile App Journey (Firebase)

```
FIREBASE LOGIN → POST /auth/firebase-sync → JWT TOKEN → USE BACKEND NORMALLY
       │                    │                    │
       ▼                    ▼                    ▼
  Firebase Auth       Upsert rider_col     Standard JWT
  ID Token           (create or update)    for all routes
```

### Claim Decision Engine

```
Rider submits claim (GPS + incident_type + image)
                    │
                    ▼
          ┌─────────────────┐
          │ incident = other │──────► MANUAL REVIEW (queued)
          └────────┬────────┘
                   │ No
                   ▼
          ┌─────────────────┐
          │  verify_all()   │──────► 4 parallel API calls
          │  Weather + AQI  │        (10s timeout each)
          │  Traffic + News  │
          └────────┬────────┘
                   │
                   ▼
          ┌─────────────────┐
          │ API timeout?    │──────► MANUAL REVIEW (queued)
          └────────┬────────┘
                   │ No
                   ▼
    ┌──────────────────────────────┐
    │      DECISION ENGINE         │
    │                              │
    │  disruption + server_down?   │
    │  strike + news_count > 0?    │
    │  pollution + AQI ≥ 300?      │
    │  rain + precip ≥ 5mm?        │
    │  traffic + speed ≤ 5km/h?    │
    └──────────┬───────────────────┘
               │
       ┌───────┴───────┐
       ▼               ▼
   APPROVED         REJECTED
       │               │
       ▼               ▼
  Actuarial         Fraud check
  formula           (strike count)
  payout            penalty + possible ban
       │               │
       ▼               ▼
  Credit wallet    Debit wallet
  Log transaction  Log penalty
  Update metrics   Update ban_history
```

### Zero-Touch Parametric Payout (Admin Flow)

```
Admin triggers scan
        │
        ▼
  Fetch live Delhi weather + AQI
        │
        ▼
  ┌──────────────┐     No
  │ AQI > 300?   │──────────┐
  │ Rain > 5mm?  │          │
  └──────┬───────┘          ▼
         │ Yes         "No triggers breached"
         ▼
  Fetch ALL riders with:
  • ban_status = "none"
  • role = "rider"
  • has_active_policy = true
         │
         ▼
  For EACH rider:
  ├── Get policy_type + premium_paid
  ├── Look up event_probability
  ├── Calculate actuarial payout
  ├── $inc balance (concurrent)
  └── Build TransactionLog doc
         │
         ▼
  Bulk insert all transactions
  Update admin_metrics.total_payouts
         │
         ▼
  ✅ "Auto-payout complete"
     riders_credited: N
     total_payouts: ₹X
```

---

## 🔌 API Reference

> 🛡️ **Error Handling:** Core endpoints implement robust error boundaries (`try/except`) ensuring any unexpected server exceptions return strictly formatted JSON `500 Internal Server Error` responses. This prevents UI crashes caused by parsing raw HTML tracebacks.

### Authentication — `/auth`

| Method | Endpoint | Auth | Request Body | Response |
|---|---|---|---|---|
| `POST` | `/auth/register` | None | `{name, phone, email, age, city, avg_daily_income, password}` | `{message, rider_id}` |
| `POST` | `/auth/login` | None | `{email, password}` | `{token, rider_id}` |
| `POST` | `/auth/firebase-sync` | None | `{email, firebase_token, name}` | `{token, rider_id, is_new_user}` |
| `POST` | `/auth/forgot-password` | None | `{email}` | `{message}` |
| `POST` | `/auth/reset-password` | None | `{email, otp, new_password}` | `{message}` |

### Claims & Policy — `/claims`

| Method | Endpoint | Auth | Request | Response |
|---|---|---|---|---|
| `POST` | `/claims/file` | JWT | `FormData: {latitude, longitude, incident_type, custom_reason, image_proof}` | `{claim_status, system_message, new_balance}` |
| `POST` | `/claims/buy-policy` | JWT | `{city}` | `{message, policy_type, policy_expiry, new_balance}` |
| `GET` | `/claims/policy-status` | JWT | — | `{policy_active, policy_type, policy_expiry, balance}` |
| `POST` | `/claims/premium` | None | `{latitude, longitude, daily_income, city, active_days}` | `{is_suspended, forecast_risk, plans[], risk_factors[]}` |

### Admin — `/admin`

| Method | Endpoint | Auth | Request Body | Response |
|---|---|---|---|---|
| `POST` | `/admin/toggle-crash` | Admin JWT | — | `{platform_down}` |
| `POST` | `/admin/issue-ban` | Admin JWT | `{rider_id, ban_type, reason}` | `{message, ban_type, reason}` |
| `POST` | `/admin/revoke-suspension` | Admin JWT | `{rider_id}` | `{message}` |
| `POST` | `/admin/simulate-zero-touch-payouts` | Admin JWT | — | `{riders_credited, total_payouts, reason, aqi, precipitation_mm}` |
| `GET` | `/admin/riders` | Admin JWT | — | `[{rider_id, name, city, active_delivery_days, balance, has_active_policy, current_ban_status}]` |

### Frontend

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | Serves the public rider app (`templates/index.html`) |
| `GET` | `/neural-portal` | Serves the isolated admin portal (`templates/admin.html`) |

> 📝 **Swagger Docs** available at `/docs` (auto-generated by FastAPI)

### Frontend — Admin Data Sheet

The Admin Dashboard includes a **Registered Riders Database** panel that renders a real-time data table:

| Column | Source Field | Display |
|---|---|---|
| Rider ID | `rider_id` | Raw ID string |
| Name | `name` | Full name |
| City | `city` | Registration city |
| Active Days | `active_delivery_days` | Integer count (min 5 for eligibility) |
| Wallet (₹) | `balance` | Formatted to 2 decimals |
| Policy Active | `has_active_policy` | ✅ YES / ❌ NO badge |
| Ban Status | `current_ban_status` | Color-coded: green (none), amber (temporary), red (permanent) |

### Frontend — Circuit Breaker Badge

The Admin Dashboard includes a **Circuit Breaker / Underwriting Status** indicator:

| State | Visual | Condition |
|---|---|---|
| 🟢 Active | Green badge, steady glow | `is_suspended = false` |
| 🔴 Suspended | Red badge, pulsing animation | `is_suspended = true` (forecast risk > 85%) |

---

## 🌐 External API Integrations

| API | Provider | Data Used | Threshold |
|---|---|---|---|
| **Weather** | [Open-Meteo](https://open-meteo.com/) | Precipitation (mm/hr) | ≥ 5.0 mm |
| **14-Day Forecast** | [Open-Meteo](https://open-meteo.com/) | Daily precipitation & temperature | Risk scoring |
| **Air Quality** | [WAQI](https://waqi.info/) | AQI index | ≥ 300 |
| **Traffic** | [TomTom](https://developer.tomtom.com/) | Current speed (km/h) | ≤ 5 km/h |
| **News** | [NewsAPI](https://newsapi.org/) | Strike/protest article count | > 0 articles |
| **AI Assistant** | [Groq](https://groq.com/) | Real-time rider support chat | `llama-3.1-8b-instant` |

All 4 APIs are called **in parallel** using `asyncio.gather()` with a 10-second timeout per call. If any API fails, the claim is routed to **manual review** instead of being rejected.

---

## 🔐 Security Architecture

| Feature | Implementation |
|---|---|
| **Password Storage** | Bcrypt hashing (auto-migrates legacy plaintext on login) |
| **Authentication** | JWT (HS256) with 2-hour expiry |
| **Mobile Auth** | Firebase ID token verification → JWT bridge |
| **Authorization** | Role-based: `get_current_rider()` for riders, `verify_admin()` for admins |
| **Admin Detection** | `role` field on rider document (`"rider"` or `"admin"`) |
| **Ban Enforcement** | Permanently banned accounts blocked at login |
| **Password Reset** | 6-digit OTP with 10-minute expiry (strict UTC validation, fields permanently removed via DB `$unset` on success) |
| **CORS** | Configurable via `.env` (defaults to `*` for development) |
| **DB Security** | MongoDB Atlas TLS via `certifi` |

### Auth Flow

```
Request → Authorization: Bearer <JWT>
            │
            ▼
    get_current_rider()
    ├── Extract token from header
    ├── jwt.decode(token, SECRET_KEY)
    ├── Check expiry
    └── Return rider_id
            │
            ▼
    verify_admin()  (admin routes only)
    ├── DB lookup by rider_id
    ├── Check role == "admin"
    └── Return user doc or 403
```

### Firebase Sync Flow

```
Mobile App → POST /auth/firebase-sync
              │
              ▼
    _mock_verify_firebase_token()
    ├── Validate token format
    └── Return decoded payload (uid)
              │
              ▼
    Upsert riders_col by email
    ├── Existing → update name, firebase_uid
    └── New → create full RiderProfile + log TX
              │
              ▼
    create_token(rider_id)
    └── Return {token, rider_id, is_new_user}
```

---

## 🚀 Setup & Run

### Prerequisites

- Python 3.10+
- MongoDB Atlas account (or local MongoDB)
- API keys: WAQI, TomTom, NewsAPI

### 1. Clone & Install

```bash
git clone <repository-url>
cd GigShield_Backend
python -m venv venv
source venv/bin/activate        # macOS/Linux
pip install -r requirements.txt
```

### 2. Configure Environment

Create a `.env` file:

```env
MONGO_URL=mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/
MONGO_DB_NAME=gigshield_final
SECRET_KEY=<your-jwt-secret>
WAQI_TOKEN=<your-waqi-api-token>
TOMTOM_API_KEY=<your-tomtom-api-key>
NEWS_API_KEY=<your-newsapi-key>
CORS_ORIGINS=*
```

### 3. Run the Server

```bash
python main.py
# or
uvicorn main:app --reload --port 8000
```

### 4. Access

| URL | What |
|---|---|
| `https://gigshield-4u5z.onrender.com` | Rider App (Public Frontend) |
| `https://gigshield-4u5z.onrender.com/neural-portal` | Admin Portal (Secret Route) |
| `https://gigshield-4u5z.onrender.com/docs` | Swagger API Docs |
| `https://gigshield-4u5z.onrender.com/redoc` | ReDoc API Docs |

### Default Seed Accounts

| Role | Email | Password |
|---|---|---|
| **Rider** | `rider@gigshield.com` | `password123` |
| **Admin** | `admin@gigshield.com` | `24680` |

---

## 👥 Team

**Neural Ninjas** — Hackathon Team

---

*Built with ❤️ using FastAPI, MongoDB, and real-time parametric data.*
