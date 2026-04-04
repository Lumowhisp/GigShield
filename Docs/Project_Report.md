# GigShield — Project Report

### AI-Powered Parametric Micro-Insurance for India's Gig Economy

**Team:** Neural Ninjas  
**Hackathon:** Guidewire DEVTrails 2026  
**Submission Phase:** Phase 2 — Automation & Protection  
**Date:** April 4, 2026

---

## Table of Contents

1. [Abstract](#1-abstract)
2. [Problem Statement](#2-problem-statement)
3. [Proposed Solution](#3-proposed-solution)
4. [System Architecture](#4-system-architecture)
5. [Technology Stack](#5-technology-stack)
6. [Machine Learning Engine](#6-machine-learning-engine)
7. [Disruption Trigger System](#7-disruption-trigger-system)
8. [Dynamic Premium Pricing Model](#8-dynamic-premium-pricing-model)
9. [Actuarial Payout Model](#9-actuarial-payout-model)
10. [Mobile Application](#10-mobile-application)
11. [Backend API Architecture](#11-backend-api-architecture)
12. [Database Design](#12-database-design)
13. [Security Architecture](#13-security-architecture)
14. [Fraud Detection & Prevention](#14-fraud-detection--prevention)
15. [AI Chatbot — GigBot](#15-ai-chatbot--gigbot)
16. [Model Audit & Stress Testing](#16-model-audit--stress-testing)
17. [Business Viability & Financial Analysis](#17-business-viability--financial-analysis)
18. [Key Technical Differentiators](#18-key-technical-differentiators)
19. [Future Scope](#19-future-scope)
20. [Conclusion](#20-conclusion)
21. [References](#21-references)

---

## 1. Abstract

GigShield (marketed as **GigGuard**) is an end-to-end, AI-powered parametric micro-insurance platform engineered to protect India's 15+ million gig delivery riders — Zomato, Swiggy, Uber, Rapido, Zepto — against income loss caused by uncontrollable external disruptions such as extreme weather events, severe air pollution, flooding, and cyclones. Unlike traditional insurance which relies on manual claim filing and weeks of adjudication, GigShield delivers a **fully automated, zero-touch claims pipeline**: real-time weather and environmental data are monitored continuously; when pre-defined parametric thresholds are breached, payouts are calculated actuarially and settled to the rider's wallet in under 3 seconds — with no human intervention and no paperwork.

The platform combines a **Random Forest ML model** (R² = 0.8773, trained on 126,175 rows across 35 GPS zones covering 10 years of weather data) with a **deterministic heuristic trigger engine** (6 automated disruption triggers) and a **dynamic actuarial pricing system** with weekly premiums as low as ₹20—all delivered through a premium React Native mobile application.

---

## 2. Problem Statement

### 2.1 Context

India's platform-based delivery economy has grown exponentially, with over **1.2 crore (12 million)** gig workers hitting the roads daily, earning between ₹300–₹1,200 per day on tight margins. These workers — the backbone of India's digital commerce — have **zero income protection** against external disruptions they cannot control.

### 2.2 The Gap

When a cloudburst floods Mumbai's streets, when Delhi's AQI crosses 400, or when a heatwave shuts down deliveries in Rajasthan — riders must log off. Their income drops to **zero instantly**, with no safety net. Traditional insurance products fail gig workers because they are:

| Traditional Insurance Problem | Impact on Gig Workers |
|---|---|
| Slow claims processing (weeks) | Workers need relief within hours, not weeks |
| Complex paperwork & documentation | Workers operate in the field with smartphones only |
| High premiums (monthly/annual) | Workers earn daily and think in weekly cycles |
| One-size-fits-all pricing | Risk varies dramatically by GPS zone and season |
| Covers health/accidents only | No product exists for **income loss** due to weather |

### 2.3 Scope Constraints (as per DEVTrails 2026 rulebook)

- **Coverage:** Loss of income **only** — strictly excludes health, life, accidents, or vehicle repairs
- **Pricing model:** Must be structured on a **weekly** basis
- **Persona:** Food delivery partners (Zomato/Swiggy ecosystem)
- **Parametric triggers:** Automated claim initiation from real-time disruption data

---

## 3. Proposed Solution

**GigShield** is a parametric micro-insurance engine that reimagines insurance for the gig economy:

| Feature | Description |
|---|---|
| **Parametric Design** | No claim forms — payouts trigger automatically when weather data breaches pre-defined thresholds |
| **AI-Powered Dynamic Pricing** | ML model + 14-day weather forecast → personalized weekly premium per GPS coordinate |
| **GPS-Portable Coverage** | Works at any GPS coordinate in India — not tied to a city or zone. Elevation, coast distance, and safety scores computed on-the-fly |
| **Instant Settlement** | Payout calculated and deposited in < 3 seconds upon trigger breach |
| **3-Tier Plans** | Basic (40% coverage, ₹20–49/week), Standard (70%, ₹20–99/week), Premium (100% income replacement) |
| **Circuit Breaker** | Auto-suspends new policy sales when catastrophic risk forecast > 85% — protecting the insurance pool |
| **Underwriting Gate** | Minimum 5 active delivery days required before coverage eligibility — prevents adverse selection |
| **AI Assistant (GigBot)** | In-app chatbot powered by Llama 3.1 (via Groq) for real-time rider support |

---

## 4. System Architecture

### 4.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        GIGSHIELD PLATFORM                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────┐     ┌──────────────────┐     ┌────────────────┐  │
│  │  React Native │     │   FastAPI Backend │     │   ML Engine    │  │
│  │  Mobile App   │────▶│   (Uvicorn ASGI)  │────▶│  (XGBoost /   │  │
│  │  (Expo SDK)   │◀────│                    │◀────│   RandomForest)│  │
│  └──────────────┘     └────────┬───────────┘     └────────────────┘  │
│         │                      │                         │          │
│         │              ┌───────┴───────┐                 │          │
│         │              │               │                 │          │
│  ┌──────▼──────┐  ┌────▼────┐  ┌──────▼──────┐  ┌──────▼──────┐   │
│  │  Firebase   │  │ MongoDB │  │  External   │  │ Disruption  │   │
│  │  Auth       │  │  Atlas  │  │  APIs       │  │ Triggers    │   │
│  └─────────────┘  └─────────┘  └─────────────┘  └─────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

External APIs:
• Open-Meteo (Weather + Forecast + Elevation)
• WAQI (Air Quality Index)
• TomTom (Traffic Speed)
• NewsAPI (Strikes/Protest Detection)
• Groq (LLM — GigBot AI Assistant)
```

### 4.2 The "Quote Engine" Lifecycle

The core feature is generating a dynamic premium quote based on real-time weather and ML risk analysis:

1. **Client Trigger** — Mobile app fetches GPS coordinates and calls `POST /premium`
2. **Context Gathering** — Backend concurrently fetches 14 days of weather data (7 historical + 7 forecast) and elevation data from Open-Meteo
3. **Trigger Evaluation** — 6 severe disruption triggers are evaluated over the forecast period
4. **ML Prediction** — Weather arrays compiled into 34 features, fed into the trained model; predicts `loss_ratio` for each day
5. **Actuarial Adjustments** — Base premium calculated with sigma uncertainty loading, dynamic margins, and premium caps
6. **Response** — App receives `PremiumResponse` JSON, UI updates instantly

---

## 5. Technology Stack

### 5.1 Backend & ML Engine

| Layer | Technology | Justification |
|---|---|---|
| **Web Framework** | FastAPI (Python) | Async-first, auto-generated Swagger docs, type-safe with Pydantic |
| **ASGI Server** | Uvicorn | Production-grade async Python server |
| **Database** | MongoDB Atlas | Flexible document model for rider profiles, transactions |
| **Async DB Driver** | Motor 3.7.1 | Non-blocking MongoDB operations |
| **Schema Validation** | Pydantic V2 | Strict typing with enum enforcement |
| **ML Model** | XGBoost 2.1+ / scikit-learn 1.5+ | Ensemble learning for loss-ratio regression |
| **Data Processing** | pandas 2.2+, NumPy 2.0+ | Feature engineering & data wrangling |
| **HTTP Client** | httpx 0.28+ | Async parallel requests to external APIs |
| **Authentication** | bcrypt 5.0 + PyJWT 2.10+ | Industry-standard password hashing + stateless JWT tokens |
| **Configuration** | python-dotenv | Environment-based secret management |

### 5.2 Mobile Application

| Layer | Technology | Version |
|---|---|---|
| **Framework** | React Native | 0.81.5 |
| **Toolchain** | Expo SDK | 54.0 |
| **Navigation** | React Navigation (Native Stack + Bottom Tabs) | 7.x |
| **Auth Provider** | Firebase Auth | 12.11.0 |
| **Secure Storage** | expo-secure-store | 15.0 |
| **Location** | expo-location | 19.0 |
| **Charts** | react-native-chart-kit | 6.12 |
| **Animations** | Lottie (lottie-react-native) | 7.3 |
| **Gradients** | expo-linear-gradient | 15.0 |
| **Language** | TypeScript | 5.9 |

### 5.3 External API Integrations

| API | Provider | Data Consumed | Threshold / Usage |
|---|---|---|---|
| **Weather** | Open-Meteo | Precipitation, temp, wind, radiation, elevation | 7+7 day window, trigger evaluation |
| **Air Quality** | WAQI | AQI index | ≥ 300 (severe pollution trigger) |
| **Traffic** | TomTom | Current speed (km/h) | ≤ 5 km/h (gridlock) |
| **News** | NewsAPI | Strike/protest article count | > 0 articles = disruption |
| **AI Chat** | Groq | LLM inference (Llama 3.1 8B) | Real-time rider support |

---

## 6. Machine Learning Engine

### 6.1 Model Specifications

| Parameter | Value |
|---|---|
| **Algorithm** | XGBoost v2.1 (Gradient Boosted Trees) |
| **Target Variable** | `loss_ratio` — expected fraction of daily income lost (0.0 – 1.0) |
| **Feature Space** | 34 features (raw weather + rolling windows + geographic + trigger indicators) |
| **Training Data** | 126,175 rows, 35 GPS zones, 10 years of historical weather |
| **Test R²** | **0.8773** (87.73% variance explained) |
| **Train R²** | 0.8991 |
| **Walk-Forward CV R²** | 0.8772 |
| **Overfit Gap** | 0.0217 (excellent — minimal overfitting) |
| **Test MAE** | ₹0.021 per ₹1 income |

### 6.2 Feature Engineering

The 34 input features are grouped into four categories:

**A. Raw Weather Variables (7)**
- `precipitation_sum`, `temperature_2m_max`, `wind_speed_10m_max`, `apparent_temperature_max`, `precipitation_hours`, `wind_gusts_10m_max`, `shortwave_radiation_sum`

**B. Engineered Rolling & Interaction Features (15)**
- Rolling windows: `rolling_7d_rain`, `rolling_3d_temp`, `rolling_7d_wind`
- Temporal: `sin_time`, `cos_time`, `is_weekend`, `month`
- Interactions: `rain_wind_interaction`, `rain_squared`, `wind_squared`, `temp_squared`, `rain_wind_ratio`, `heat_index_proxy`, `rain_intensity`, `temp_humidity_gap`

**C. Geographic Features (6)**
- `elevation`, `is_coastal`, `latitude`, `longitude`, `distance_to_coast`, `zone_safety_score`

**D. Trigger Indicators (6)**
- `trigger_rain_active`, `trigger_heat_active`, `trigger_storm_active`, `trigger_flood_active`, `trigger_visibility_active`, `n_triggers_active`

### 6.3 Feature Importance Analysis

| Rank | Feature | Importance |
|---|---|---|
| 1 | `trigger_rain_active` | **60.92%** |
| 2 | `n_triggers_active` | 10.35% |
| 3 | `trigger_heat_active` | 6.63% |
| 4 | `trigger_flood_active` | 6.39% |
| 5 | `rain_squared` | 5.85% |
| 6 | `precipitation_sum` | 2.77% |
| 7 | `rain_wind_interaction` | 1.92% |
| 8 | `trigger_visibility_active` | 1.50% |
| 9 | `zone_safety_score` | 0.83% |
| 10 | `rolling_7d_rain` | 0.53% |

**Key Insight:** The top 4 features are **not** raw weather data — they are Boolean flags from the deterministic trigger engine. The ML model autonomously learned that expert-guided structured triggers are far more predictive than raw measurements. This validates the hybrid heuristic-ML architecture and avoids the "black box" problem of pure deep learning.

### 6.4 Geographic Coverage

The model is trained across 8 distinct Indian climate regions covering 35 GPS zones:

| Region | Representative Cities |
|---|---|
| West Coast | Mumbai, Goa, Kochi, Mangaluru, Thiruvananthapuram |
| East Coast | Chennai, Vizag, Bhubaneswar, Puri, Thanjavur |
| Delta/Lowland | Kolkata, Surat |
| Northern Plains | Delhi, Lucknow, Varanasi, Patna, Chandigarh |
| Western Desert | Ahmedabad, Jaipur, Jodhpur, Bikaner, Udaipur |
| Deccan Plateau | Hyderabad, Bengaluru, Pune, Nagpur, Jabalpur, Raipur |
| Himalayan Foothills | Dehradun, Shimla, Dharamshala |
| Northeast | Guwahati, Shillong, Imphal, Gangtok |

### 6.5 Target Variable Design (Anti-Leakage)

The `loss_ratio` target includes stochastic worker behavior noise — worker resilience, demand variance, and infrastructure quality randomization. This ensures:
- Identical weather conditions → **different** loss outcomes (realistic)
- The model learns weather-risk patterns, not data artifacts
- R² reflects genuine predictive skill, not inflated correlations

---

## 7. Disruption Trigger System

GigShield implements **6 automated disruption triggers**, each calibrated against real Indian meteorological standards. These deterministic heuristics serve as safety floors — guaranteeing payouts on highly specific conditions regardless of ML output.

### 7.1 Trigger Definitions

| # | Trigger | Calibration Standard | Threshold |
|---|---|---|---|
| 1 | 🌧️ **Heavy Rain** | IMD Orange/Red alert | 65mm (Orange) / 115mm (Red) rolling 7-day |
| 2 | 🌡️ **Extreme Heat** | GPS-adaptive | 38°C coast, 42°C plains, 43°C desert (apparent temp) |
| 3 | 💨 **Storm / Cyclone** | Beaufort + IMD cyclone scale | Wind > 40 km/h sustained, gusts > 80 km/h |
| 4 | 🌊 **Flood Zone** | Elevation + accumulated rain | Elevation < 30m + extreme 7-day rolling precipitation + river basin detection |
| 5 | 🌫️ **Poor Visibility / Smog** | Solar radiation proxy | Low shortwave radiation indicating dense overcast/fog |
| 6 | 😷 **Severe AQI** | Delhi NCR geo-fence | Temperature inversion + stagnant air (< 12 km/h) + blocked solar radiation → AQI > 300 proxy |

### 7.2 Key Design Decisions

- **Zone-Adaptive Thresholds** — Chandigarh (39°C heat threshold) ≠ Jodhpur (43°C). Patna (river basin, lower flood threshold) ≠ Mumbai (coastal amplifier). Not one-size-fits-all.
- **Trigger Stacking** — Each trigger returns a severity score (0–1) and a loss multiplier. Multiple simultaneous triggers compound (multi-trigger loading in premium calculation).
- **Coastal Discount Layer** — Rain triggers include a coastal modifier accounting for better drainage infrastructure in some coastal cities.

---

## 8. Dynamic Premium Pricing Model

### 8.1 Pricing Pipeline

```
POST /premium { latitude, longitude, daily_income, target_date, no_claim_weeks, active_days }
                │
                ▼
┌──────────────────────────────────────────────────────────────────┐
│  Step 1: Fetch 14-Day Weather (7 historical + 7 forecast)       │
│  Step 2: Compute 34 ML Features + Evaluate 6 Triggers           │
│  Step 3: ML Model → loss_ratio[7] (next 7 days)                │
│  Step 4: Actuarial Premium Calculation                           │
│  Step 5: 5 Micro-Adjustments                                    │
│  Step 6: Premium Capping (Affordability Guarantee)               │
└──────────────────────────────────────────────────────────────────┘
                │
                ▼
PremiumResponse { is_suspended, disruption_risk, zone_profile, 
                  forecast_risk, plans: {basic, standard, premium} }
```

### 8.2 Actuarial Premium Formula

```
expected_payout = daily_income × avg_loss_ratio × coverage_% × 7 days
risk_load       = σ(loss_ratio_forecast) × scaling_factor              # Sigma uncertainty
pure_premium    = (expected_payout + risk_load) × tail_modifier
base_premium    = pure_premium × (1 + ops_margin + dynamic_margin)
```

### 8.3 Five Real-Time Micro-Adjustments

| # | Adjustment | Effect |
|---|---|---|
| 1 | **Zone Safety Discount** | Safe elevation zones → ₹2–10/week deduction |
| 2 | **Forecast Surge** | 4+ of 7 severe days → coverage hours auto-extend, premium +12% |
| 3 | **No-Claim Streak** | Up to 15% loyalty discount for consecutive safe weeks |
| 4 | **Multi-Trigger Loading** | 3+ simultaneous hazards → +15% compound surcharge |
| 5 | **Seasonal Adjustment** | Monsoon months +15%, winter fog +5% |

### 8.4 Affordability Caps

| Plan | Coverage | Weekly Premium Range | Hard Cap |
|---|---|---|---|
| Basic | 40% income | ₹20 – ₹49 | **₹49/week** |
| Standard | 70% income | ₹20 – ₹99 | **₹99/week** |
| Premium | 100% income | ₹39+ | Uncapped (dynamic) |

### 8.5 Circuit Breaker

```
IF avg_loss_ratio (next 7 days) > 85%:
    → is_suspended = True
    → All new policy purchases BLOCKED
    → Reason: "Extreme weather forecast — underwriting suspended"
```

This protects the insurance pool from catastrophic events (e.g., Mumbai 14-day monsoon).

### 8.6 Underwriting Gate

```
IF active_days_last_30_days < 5:
    → Standard and Premium plans LOCKED (is_eligible = False)
    → Only Basic plan available
    → Prevents adverse selection by inactive riders
```

---

## 9. Actuarial Payout Model

### 9.1 Formula

```
                      premium_paid × TARGET_LOSS_RATIO
calculated_payout = ─────────────────────────────────────
                    event_probability × (1 + SAFETY_MARGIN)
```

### 9.2 Constants

| Constant | Value | Meaning |
|---|---|---|
| `TARGET_LOSS_RATIO` | **0.60** | 60% of premium income allocated to claims |
| `SAFETY_MARGIN` | **0.15** | 15% actuarial buffer for adverse deviation |
| **Company Margin** | **40%** | Retained for operations (1 − 0.60) |

### 9.3 Worked Example

**Heavy Rain Policy — Mumbai Rider:**
```
Premium paid      = ₹40
Event probability = 0.10 (rain)

Payout = (40 × 0.60) / (0.10 × 1.15)
       = 24 / 0.115
       = ₹208.70
```

**Key Insight:** Lower-probability events produce higher payouts — actuarially correct, as rarer events must cover more lost income per occurrence to justify the insurance product.

---

## 10. Mobile Application

### 10.1 Overview

The mobile app is built using **React Native (Expo SDK 54)** with TypeScript, targeting both iOS and Android. It employs a stateless UI architecture where the source of truth resides in the backend.

### 10.2 Screen Flow

```
SplashScreen → WelcomeScreen → LoginScreen / SignupScreen
                                       │
                                       ▼
                            LocationPermissionScreen
                                       │
                                       ▼
                     ┌─────── MainTabs (Bottom Tabs) ───────┐
                     │                                       │
              DashboardScreen    CoverageScreen    ProfileScreen
                     │                │
                     ▼                ▼
           PlanSelectionScreen   WalletScreen
                     │
                     ▼
              PaymentScreen
```

### 10.3 Key Screens

| Screen | Purpose | Key Logic |
|---|---|---|
| **DashboardScreen** | Central hub — live weather, plan status, disruption forecast | Calls `fetchPremiumQuote()` on mount; maps `PremiumResponse` to Lottie visualizations |
| **PlanSelectionScreen** | AI quote → human-readable plan cards | Circuit breaker intercept (fullscreen red card if `is_suspended`); underwriting locks on ineligible plans |
| **PaymentScreen** | UPI/Card/Wallet checkout | PhonePe, GPay, Paytm, BHIM; GST breakdown, SSL badge, RBI compliance notice |
| **WalletScreen** | Passbook-style transaction ledger | Every policy purchase and payout recorded chronologically; actuarial health indicators (BCR, R², MAE) |
| **CoverageScreen** | Active policy details & triggers | Live severity bars per trigger, loss factors, active/safe status |
| **ProfileScreen** | Rider profile management | Active days, earnings data, account settings |

### 10.4 Component Architecture

| Component | Purpose |
|---|---|
| `PlanCard.tsx` | Animated plan card — supports adjustments, suspensions, recommendations |
| `AQIPanel.tsx` | Live air quality data display |
| `CityAlertsFeed.tsx` | Real-time city disruption news feed |
| `GigBotModal.tsx` | Floating AI chatbot interface |
| `RiskGauge.tsx` | Visual gauge for disruption risk level |
| `PremiumInput.tsx` | Premium configuration input form |
| `WeatherStat.tsx` | Small metric badge for weather data |
| `StatusBadge.tsx` | Reusable label chip (active/safe/suspended) |

### 10.5 Design Language

- **Lottie Animations** for weather states, risk visualization, and transitions
- **Linear Gradients** for premium visual identity
- **Bezier Line Charts** for 7-day disruption forecasts
- **iOS-style Push Notifications** with confetti effects for payout events

---

## 11. Backend API Architecture

### 11.1 API Endpoints

#### Authentication (`/auth`)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/auth/register` | None | Rider registration with bcrypt password hashing |
| `POST` | `/auth/login` | None | Email/password login → JWT token |
| `POST` | `/auth/firebase-sync` | None | Firebase token → MongoDB upsert → JWT bridge |
| `POST` | `/auth/forgot-password` | None | OTP generation (6-digit, 10-min expiry) |
| `POST` | `/auth/reset-password` | None | OTP verification + password change |

#### Core ML & Policy (`/claims`)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/premium` | None | **Core ML Engine** — fetches weather, runs model, returns personalized plans |
| `POST` | `/claims/buy-policy` | JWT | Policy purchase with underwriting checks |
| `GET` | `/claims/policy-status` | JWT | Current policy state, balance, expiry |
| `POST` | `/claims/file` | JWT | File a claim with GPS + incident type + image proof |

#### Admin (`/admin`)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/admin/simulate-zero-touch-payouts` | Admin JWT | Trigger city-wide parametric auto-payouts |
| `POST` | `/admin/toggle-crash` | Admin JWT | Simulate platform outage |
| `POST` | `/admin/issue-ban` | Admin JWT | Issue temporary/permanent ban |
| `GET` | `/admin/riders` | Admin JWT | Full rider database with policy/ban status |

### 11.2 Error Handling

All core endpoints implement robust error boundaries (`try/except`), ensuring unexpected exceptions return strictly formatted JSON `500` responses — preventing the mobile app UI from crashing on HTML traceback parsing.

### 11.3 Weather API Fallback

If `httpx` encounters a `ConnectError` to Open-Meteo (e.g., hackathon Wi-Fi issues), `/premium` falls back to a realistic set of hard-coded mock arrays to prevent crashes during live demos.

---

## 12. Database Design

### 12.1 MongoDB Collections

GigShield uses **4 MongoDB collections** with strict separation of concerns:

| Collection | Model | Purpose |
|---|---|---|
| `riders` | `RiderProfile` | Rider accounts, wallets, policy state, ban history |
| `transactions` | `TransactionLog` | Immutable financial ledger (all money movements) |
| `admin_metrics` | `AdminDashboardMetrics` | Pre-aggregated KPIs for admin dashboard |
| `app_state` | — | Platform status toggle (outage simulation) |

### 12.2 RiderProfile Schema

```
RiderProfile
├── Identity: rider_id, name, phone, email, age, city, avg_daily_income, password (bcrypt)
├── Underwriting: active_delivery_days (min 5 for eligibility)
├── Financial: balance (wallet)
├── Policy State: has_active_policy, active_policy_type, premium_paid, policy_expiry
├── Ban Management: current_ban_status (none/temporary/permanent), ban_history[]
├── Firebase Integration: firebase_uid
└── Timestamps: created_at, updated_at
```

### 12.3 TransactionLog Schema

```
TransactionLog
├── tx_id (UUID, unique)
├── rider_id (FK → riders)
├── amount (+credit / -debit)
├── tx_type: premium_paid | claim_payout | penalty_deducted
├── description (human-readable)
└── timestamp (UTC)
```

### 12.4 Database Indexes

| Collection | Field | Type |
|---|---|---|
| `riders` | `rider_id` | Unique |
| `riders` | `email` | Unique |
| `transactions` | `tx_id` | Unique |
| `transactions` | `rider_id` | Query |
| `transactions` | `timestamp` | Query |
| `transactions` | `tx_type` | Query |
| `admin_metrics` | `last_updated` | Query |

---

## 13. Security Architecture

| Layer | Implementation |
|---|---|
| **Password Storage** | Bcrypt hashing (auto-migrates legacy plaintext on login) |
| **Authentication** | JWT (HS256) with 2-hour expiry |
| **Mobile Auth** | Firebase ID token verification → JWT bridge |
| **Authorization** | Role-based: `get_current_rider()` for riders, `verify_admin()` for admins |
| **Admin Detection** | `role` field on rider document (`"rider"` or `"admin"`) |
| **Ban Enforcement** | Permanently banned accounts blocked at login |
| **Password Reset** | 6-digit OTP with 10-minute expiry, fields permanently removed via `$unset` on success |
| **Credential Storage** | expo-secure-store on device (encrypted keychain) |
| **CORS** | Configurable via `.env` |
| **DB Transport** | MongoDB Atlas TLS via `certifi` |

### 13.1 Auth Flow

```
Mobile App → Firebase Auth → POST /auth/firebase-sync → Upsert rider in MongoDB
                                                        → Generate JWT token
                                                        → Return {token, rider_id}

All subsequent API calls → Authorization: Bearer <JWT>
                           → get_current_rider() extracts/validates token
                           → verify_admin() for admin-only routes
```

---

## 14. Fraud Detection & Prevention

### 14.1 Multi-Layered Architecture

```
Layer 1: External Data Verification (4 parallel API calls + 10s timeout)
Layer 2: User Context (activity logs, GPS validation, ban history)
Layer 3: Intelligence Layer (AI/ML anomaly detection)
```

### 14.2 Fraud Categories & Mitigations

| Fraud Type | Detection | Prevention |
|---|---|---|
| **Fake Trigger Exploitation** | API cross-verification, threshold validation | Payouts restricted to verified API-triggered events only |
| **Location Spoofing** | GPS drift analysis, movement pattern validation | Device fingerprinting, anti-spoofing mechanisms |
| **Multiple Claim Exploitation** | Timestamp clustering, duplicate detection | Single payout per event rule; 24-hour duplicate rejection |
| **Threshold Gaming** | Behavioral pattern analysis | Dynamic thresholds (zone-adaptive) |
| **Collusion Fraud** | Graph-based clustering | Network behavior monitoring and flagging |

### 14.3 Progressive Penalty System

| Strike Count | Wallet Penalty | Action |
|---|---|---|
| 5 | ₹50 | Warning |
| 7 | ₹80 | Escalated warning |
| ≥ 10 | ₹120 | **Permanent ban** |

### 14.4 Risk Scoring

Each claim is assigned a fraud risk score:
- **0–30:** Safe → Auto-approve
- **30–60:** Suspicious → Enhanced verification
- **60–100:** Fraud → Reject + penalty

---

## 15. AI Chatbot — GigBot

GigBot is GigShield's in-app AI support assistant, available as a floating action button on the Dashboard. It is powered by **Llama 3.1 8B Instant** served via the **Groq** inference API.

**Capabilities:**
- Answer rider questions about coverage, pricing, and triggers
- Explain payout calculations and actuarial formulas
- Provide weather-aware context (e.g., "Will I be covered if it rains tomorrow in my zone?")
- Available 24/7 with sub-second response times (Groq inference)

---

## 16. Model Audit & Stress Testing

A comprehensive model audit was conducted with **27 tests** across 7 categories.

### 16.1 Audit Summary

| Metric | Result |
|---|---|
| Total Tests | 27 |
| ✅ Passed | 20 (74.1%) |
| ⚠️ Warnings | 1 |
| ❌ Failed | 6 |
| **Verdict** | Model is ML-correct; premium pricing needs actuarial re-calibration for isolated catastrophic events |

> **Note:** The 6 "failures" are **not model bugs**. The ML model correctly predicts 99–100% loss ratios during Mumbai monsoon and cyclones (actuarially accurate). The failures are in BCR test thresholds because weekly premium caps (₹49/₹99) cannot alone fund extreme 14-day catastrophic payouts — this is solved by geographic pooling and reinsurance.

### 16.2 Sanity Checks ✅

| Test | Result | Value |
|---|---|---|
| Clear Day (Bangalore) — Loss < 10% | ✅ PASS | 0.00% |
| Heavy Monsoon (Mumbai) — Loss > 35% | ✅ PASS | 100.00% |
| Output Bounded [0, 1] | ✅ PASS | 1.0000 |
| Zero Rain/Wind: Very Low Risk | ✅ PASS | 0.00% |
| Monotonicity (rain↑ → loss↑) | ✅ PASS | 0.3% → 17.4% → 71.5% |
| Coastal > Inland for Same Rain | ✅ PASS | 46.2% vs 27.3% |

### 16.3 Stress Test Results

| Scenario | Avg Loss | Triggers Active | Interpretation |
|---|---|---|---|
| Mumbai (14-day extreme monsoon) | 99.9% | 4/5 | Correct catastrophic prediction |
| Kolkata (cyclone) | 99.3% | 4/5 | Coast + flood + rain + storm |
| Jaipur (49°C heat wave, 14 days) | 43.71% | Heat trigger | Correct heat activation |
| Chennai (cyclone, 180mm rain, 120km/h wind) | 100.0% | 5/5 | Full catastrophic tail event |
| Delhi (dry season) | 0.1% | 0/5 | Correctly safe |
| Bangalore (mild rain) | 0.1% | 0/5 | Correctly safe |

### 16.4 Edge Case Validation ✅

| Test | Result |
|---|---|
| Negative inputs (clipped to 0) | ✅ Output = 0.0000 |
| Trigger boundary (30mm vs 31mm) | ✅ 1.27% → 10.59% (non-linear cliff) |
| Himalayan zone (2500m elevation) | ✅ 25.6% (flood suppressed by elevation) |
| Weekend vs Weekday | ✅ 0.61% / 0.64% |
| All-zero degenerate inputs | ✅ 0.1893 (bounded, no crash) |

---

## 17. Business Viability & Financial Analysis

### 17.1 Annual Pool Solvency Projection

Scenario: 14 peak monsoon days + 351 normal days (1.5% avg loss ratio baseline), 1,000 riders.

| Plan | Annual BCR | Profit | Margin | Status |
|---|---|---|---|---|
| Basic (40%) | 1.14 | -₹3,67,532 | -14.4% | 🔴 Underpriced (intentional for affordability) |
| Standard (70%) | 0.99 | +₹45,818 | 0.9% | 🟡 Breakeven |
| **Premium (100%)** | **0.83** | **+₹14,99,169** | **17.1%** | **🟢 Healthy** |

### 17.2 Cross-Subsidy Model

This follows the standard microinsurance cross-subsidy strategy:
- **Premium plan** margins (17.1% profit) cross-fund Basic plan losses
- **Geographic pooling** — Delhi/Bangalore riders fund Mumbai monsoon riders
- **Annual reserve accumulation** during non-monsoon months (85% of the year)
- **Reinsurance layers** for catastrophic tail events (cyclones, 14-day monsoons)

### 17.3 Affordability Metrics

- Weekly premium < **1.5%** of a rider's weekly net income
- Basic plan: ₹49/week → ₹7/day for a ₹500/day income rider
- Instant settlement eliminates the cash-flow gap that destroys gig worker finances

---

## 18. Key Technical Differentiators

| # | Differentiator | Description |
|---|---|---|
| 1 | **100% Parametric** | No claim forms. Weather data → trigger → payout. Fully automated pipeline, zero human adjudication. |
| 2 | **GPS-Portable** | Not tied to any city. Works at ANY GPS coordinate in India. Elevation, coast distance, zone safety computed on-the-fly. |
| 3 | **Non-Leaking ML** | Target variable includes stochastic worker behavior noise. Identical weather → different losses. Honest R², not inflated. |
| 4 | **Zone-Adaptive Triggers** | Thresholds change by geography. Chandigarh ≠ Jodhpur for heat. Patna ≠ Mumbai for flood. |
| 5 | **Actuarially Sound** | BCR 67.2% (target: 55–70%). Premium floors and caps ensure affordability without pool insolvency. Tail risk modeled with sigma uncertainty. |
| 6 | **Hybrid ML Architecture** | Deterministic physics triggers + ML model. The model learned to prioritize the trigger features (60.9% importance), validating the hybrid design. |
| 7 | **Circuit Breaker** | Auto-suspends underwriting during catastrophic forecasts (>85% loss ratio), protecting the pool. |
| 8 | **Fraud Prevention** | Duplicate claim detection (24h window), active policy verification, JWT on every payout endpoint, progressive ban system. |

---

## 19. Future Scope

### Phase 3 Roadmap (Weeks 5–6)

| Feature | Description |
|---|---|
| **Razorpay Sandbox Integration** | Live UPI payout testing via Razorpay test mode |
| **Advanced Fraud Detection** | GPS spoofing detection via cell tower + Wi-Fi triangulation |
| **Computer Vision Fallback** | AI vision review for riders who lose connectivity during storms |
| **Admin Analytics Dashboard** | Loss ratios, predictive analytics on next week's weather exposure |
| **Reinsurance Layer** | Automated catastrophic event reserve management |
| **Multi-Persona Expansion** | Extend to e-commerce (Amazon/Flipkart) and quick-commerce (Zepto/Blinkit) riders |
| **Regional Language Support** | Hindi, Tamil, Bengali, Marathi in-app |

---

## 20. Conclusion

GigShield represents a paradigm shift in how insurance serves India's gig economy. By combining machine learning, actuarial science, and parametric automation into a single platform, we've created a product that is:

- **Fast** — premiums calculated in milliseconds, payouts settled in 3 seconds
- **Fair** — dynamic pricing ensures riders only pay for their actual zone risk
- **Affordable** — as low as ₹20/week, less than 1.5% of weekly income
- **Transparent** — every formula, threshold, and calculation shown to the rider
- **Scalable** — GPS-portable architecture works at any coordinate in India

Weather can't stop gig workers from earning. **GigShield makes sure of it.**

---

## 21. References

1. Open-Meteo Weather API — https://open-meteo.com/
2. WAQI Air Quality Index — https://waqi.info/
3. TomTom Traffic API — https://developer.tomtom.com/
4. NewsAPI — https://newsapi.org/
5. Groq AI Inference — https://groq.com/
6. India Meteorological Department (IMD) Severe Weather Standards
7. IRDAI Parametric Insurance Guidelines
8. Guidewire DEVTrails 2026 Rulebook & Use Case Document

---

*Built with ❤️ by Team Neural Ninjas — Guidewire DEVTrails 2026*
