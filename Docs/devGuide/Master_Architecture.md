# 🏗️ Master Architecture Guide: GigGuard

Welcome to the **GigGuard** (GigGuard) parameteric micro-insurance platform. This document outlines how the entire ecosystem fits together, from the React Native Mobile App to the FastAPI Backend, MongoDB Database, and the XGBoost Machine Learning Engine.

## 🌟 System Overview

The project is divided into three primary components:

1. **MobileApp (Frontend)**
   - Built with React Native & Expo SDK (v54).
   - Utilizes a stateless UI architecture where the source of truth primarily resides in the backend.
   - Handles real-time location tracking and Firebase Authentication.
   - Extensive use of Lottie animations and a premium Dark Theme `#131323`.

2. **Backend API (FastAPI / Uvicorn)**
   - A highly concurrent ASGI Python server bridging MongoDB and the ML models.
   - Handles JWT bridging from Firebase (`/auth/firebase-sync`).
   - Connects to external APIs like Open-Meteo for real-time and forecasted weather data.
   - Manages payouts, policy purchases, and fraud detection.

3. **Machine Learning & Trigger Engine**
   - Uses an `XGBoost v2.1` native Booster model (`gigshield_v2_model.ubj`) trained on 10 years of data to predict weekly loss probabilities based on 39 environment features. Loaded in native binary format for memory efficiency (no scikit-learn dependency at runtime).
   - Contains a deterministic heuristic engine (`disruption_triggers.py`) evaluating 6 disruption triggers: Heavy Rain, Extreme Heat, Storm/Cyclone, Flood Zone, Poor Visibility, and Severe AQI (Delhi NCR).

---

## 🔄 Data Architecture & Flow

### The "Quote Engine" Lifecycle
The core feature of GigGuard is generating a dynamic premium quote based on real-time weather and ML risk analysis.

1. **Client Trigger:** The mobile app fetches the user's GPS coordinates and calls `POST /premium`.
2. **Context Gathering (Backend):**
   - FastAPI concurrently fetches 14 days of weather data (7 days historical + 7 days forecast) and elevation data from Open-Meteo.
3. **Trigger Evaluation:**
   - The engine evaluates 6 severe disruption triggers over the forecast period, calculating `loss_multiplier` and `severity`.
4. **Machine Learning Prediction:**
   - Weather arrays are compiled into 39 features and fed into the `XGBoost` model.
   - The model predicts the expected `loss_ratio` for each forecasted day.
5. **Actuarial Adjustments:**
   - Base premium is calculated by multiplying expected payout by the risk ratios, applying a `sigma` uncertainty load, dynamic margins, and hard caps (₹49/₹99).
   - Contains 5 micro-adjustors (e.g., Zone Safety Discount, Seasonal Surge).
   - Underwriting rules check active days to lock premium tiers for users with `< 5` deliveries.
6. **Response:** App receives a `PremiumResponse` JSON object modifying the UI instantly.

### The "Automated Claims & Anti-Fraud (Autopay)" Lifecycle
To handle 10-second auto-settlement while preventing massive financial scams, the system relies on an anchored geofencing architecture:
1. **The Anchor Check**: Users are geofenced to the GPS coordinates where they originally purchased the policy (`baseline_latitude`, `baseline_longitude`).
2. **The Sweep**: An Asynchronous `APScheduler` job (`autopay_trigger_scan`) fires every 5 minutes reading all active users' latest pinged GPS.
3. **The Fraud Firewall**: Before extracting weather data, the engine runs a `haversine_distance` calculation. If the user is > 40km away from their baseline, they are hard-rejected to prevent Teleportation Sploofing.
4. **The Settlement**: Valid triggers push a mock UTR generation to RazorpayX Sandbox logic, execute the DB write, and fire an Expo Push Notification instantly signaling settlement.

### Stack Details
- **Database**: MongoDB Atlas (`motor` async driver)
- **Auth**: Firebase Auth bridged to PyJWT
- **Web Framework**: FastAPI (Uvicorn)
- **ML Framework**: `xgboost` (native Booster), `pandas`, `numpy`
- **Mobile Environment**: React Native via Expo SDK

---

## 🧭 Navigation Reference

- For detailed mathematical pricing and actuarial rules, see **[ML Engine Guide](./ML_Engine_Guide.md)**.
- For API routes and data schemas, see **[Backend API Reference](./Backend_API_Reference.md)**.
- For frontend components, navigation, and state, see **[MobileApp Guide](./MobileApp_Guide.md)**.
- For a breakdown of model performance, see **[ML Model Analysis](./ML_Model_Analysis_GigGuard_v2.md)**.
