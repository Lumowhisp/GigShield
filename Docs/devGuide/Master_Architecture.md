# 🏗️ Master Architecture Guide: GigShield

Welcome to the **GigShield** parameteric insurance platform. This document outlines how the entire ecosystem fits together, from the React Native Mobile App to the FastAPI Backend and the scikit-learn ML Engine.

## 🌟 System Overview

The project is divided into three primary components:

1. **MobileApp (Frontend)**
   - Expo/React Native application providing the interface for gig riders.
   - Built with a stateless UI architecture where truth primarily resides in the backend.
   - Handles real-time location tracking and biometric/Firebase auth.

2. **GigShield_v2_copy (Backend/API)**
   - A highly concurrent FastAPI server serving the mobile clients.
   - Bridges the gap between MongoDB (user data) and the Machine Learning models.
   - Responsible for fetching live data from external providers (Open-Meteo).

3. **Machine Learning Engine**
   - Uses a `RandomForestRegressor` (`gigshield_v2_model.joblib`) to predict weekly disruption probabilities.
   - Contains a deterministic heuristic engine (`disruption_triggers.py`) ensuring algorithmic safety floors.
   - Incorporates strict Underwriting Rules (Hackathon deliverables).

---

## 🔄 Data Architecture & Flow

### The "Quote Engine" Lifecycle
The core feature of GigShield is generating a dynamic premium quote based on real-time weather and ML risk analysis.

1. **Client Trigger:** The mobile app fetches the user's GPS coordinates and calls `POST /premium`.
2. **Context Gathering (Backend):**
   - FastAPI concurrently fetches 14 days of weather data (7 days historical + 7 days forecast) and elevation data from Open-Meteo.
3. **Trigger Evaluation:**
   - The engine evaluates 6 severe disruption triggers (Heat, Storm, Flood, Rain, Visibility, AQI) over the forecast period.
4. **Machine Learning Prediction:**
   - Weather arrays are compiled into 34 features and fed into the `gigshield_v2_model`.
   - The model predicts the `loss_ratio` (expected payout multiplier) for each day.
5. **Actuarial Adjustments:**
   - The system calculates the base premium by multiplying expected payout by the risk ratios, applies a `sigma` uncertainty load, dynamic margins, and hardens it against maximum caps.
   - Underwriting rules check `active_days_last_30_days < 5` to lock premium tiers.
6. **Response:** App receives a `PremiumResponse` JSON object modifying the UI instantly.

### Stack Details
- **Database**: MongoDB (Local/Cloud)
- **Auth**: Firebase Auth (mapped to Mongo via `/auth/firebase-sync`)
- **Web Framework**: FastAPI (Uvicorn)
- **ML Framework**: `scikit-learn` (v1.6.0), `pandas`, `numpy`
- **Mobile Environment**: React Native via Expo SDK

---

## 🧭 Navigation Reference

- For detailed mathematical pricing and actuarial rules, see **[ML Engine Guide](./ML_Engine_Guide.md)**.
- For API routes and data schemas, see **[Backend API Reference](./Backend_API_Reference.md)**.
- For frontend components, navigation, and state, see **[MobileApp Guide](./MobileApp_Guide.md)**.
