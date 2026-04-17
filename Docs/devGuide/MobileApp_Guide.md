# 📱 Mobile App Guide

The GigGuard mobile application is built using React Native and Expo (SDK 54). It lives inside the `MobileApp/` directory.

## App Architecture

*   **State Management:** React local state (`useState`, `useRef` for animations) + Navigation parameters pass structured premium information between screens without requiring heavy global stores like Redux.
*   **Navigation:** Uses `@react-navigation/native-stack` mixed with a Bottom Tab Navigator (`MainTabs`).
*   **Networking:** All requests isolate through `src/services/api.ts`, which communicates with the FastAPI backend on Render.
*   **Persistence:** Uses `expo-secure-store` to keep JWT tokens and `expo-location` for obtaining coordinates.
*   **Authentication:** Seamless Firebase Auth integrated with a Python API JWT bridge (`POST /auth/firebase-sync`).
*   **Payments:** Razorpay Sandbox integration via `expo-web-browser` — a hosted checkout page is opened in-app for UPI/Card/NetBanking payments.

---

## App Screens & Flow

```
SplashScreen → WelcomeScreen → LoginScreen / SignupScreen
                                       │
                                       ▼
                            LocationPermissionScreen
                                       │
                                       ▼
                             PlanSelectionScreen
                                       │
                                       ▼
                              PaymentScreen (Razorpay)
                                       │
                                       ▼
                     ┌─────── MainTabs (Bottom Tabs) ───────┐
                     │                                       │
              DashboardScreen    CoverageScreen    WalletScreen    ProfileScreen
                     │
              ┌──────┴──────┐
        Judge Sandbox    GigBot AI
          (Simulator)     (Llama 3.1)
```

### Auth & Onboarding
1.  **`SplashScreen.tsx`** / **`WelcomeScreen.tsx`**: Brand introductions with Lottie animations.
2.  **`LoginScreen.tsx`** / **`SignupScreen.tsx`**: Firebase Email/Password auth handling. On success, calls `/auth/firebase-sync` to bridge Firebase → MongoDB → JWT.
3.  **`LocationPermissionScreen.tsx`**: Prompts user before activating GPS for AI pricing. Fetches live GPS coordinates and calls `POST /premium` to get the initial AI quote.

### Plan Selection & Payment
4.  **`PlanSelectionScreen.tsx`**: Renders dynamic AI-priced plan cards (Basic/Standard/Premium). Features:
    - Circuit Breaker intercept: fullscreen red card if `is_suspended = true`
    - Underwriting lock: Standard & Premium grayed out if `active_days < 5`
    - Live adjustment breakdown per plan (zone discount, seasonal surge, loyalty, etc.)
    - Animated plan comparison with coverage %, payout caps, and eligibility badges
5.  **`PaymentScreen.tsx`**: Full Razorpay Sandbox payment flow:
    - Creates a Razorpay order via `POST /policy/order`
    - Opens hosted checkout page via `expo-web-browser`
    - Polls `GET /policy/order/verify/{order_id}` to confirm payment (up to 4 attempts with 2s delay)
    - On success: animated processing pipeline → policy activation → auto-redirect to Dashboard
    - Displays digital receipt with GST breakdown, PCI-DSS/RBI compliance badges

### Main Dashboard & Hub (`MainTabs`)
6.  **`DashboardScreen.tsx`**: The central hub. Key features:
    - **Hero Banner**: Active plan with glow animation, expiry countdown, and live status
    - **Vesting Timer**: Real-time countdown showing activation period (2h for first policy, trust-tier-based for subsequent)
    - **7-Day Disruption Forecast**: Bezier line chart (`react-native-chart-kit`) mapping daily risk percentages
    - **Real-Time Triggers**: Lottie-animated trigger cards with severity bars and loss multipliers
    - **Judge ML Sandbox**: A dedicated simulator panel allowing judges to override weather parameters (rain, temp, wind) and see the ML model + triggers respond in real-time via `POST /premium/simulate`
    - **Force Autopay Pipeline**: Visualizes the 8-step fraud firewall in real-time (JWT → Policy → Vesting → Trust → Duplicate → Fraud → Circuit Breaker → Settlement)
    - **Push Notification Simulation**: iOS-style notification banner with confetti on payout settlement
    - **Expiry Alerts**: Red banner with "RENEW" CTA when policy expires
    - **Unverified ID Alert**: Orange banner prompting gig worker ID verification for trust score benefits
    - **GPS Location Sync**: Automatically posts coordinates to `POST /user/location` for autopay scanning
    - **GigBot AI**: Floating chatbot button opening Llama 3.1 (Groq) for rider support

7.  **`CoverageScreen.tsx`**: Detailed policy coverage view:
    - Active plan card with stats (coverage %, premium, settlement speed, max payout)
    - Trigger Thresholds panel: live weather readings vs payout trigger thresholds with progress bars
    - Pricing Breakdown: itemized base premium + all actuarial micro-adjustments
    - Zone Profile: elevation, coast distance, flood risk, safety score
    - Expired state with renewal CTA

8.  **`WalletScreen.tsx`**: Passbook-style financial ledger:
    - Actuarial Health Panel: BCR bar (67.2%), Model R², MAE, training data span
    - Expandable "How Your Premium is Calculated" card with 4-step formula walkthrough
    - Chronological transaction list merging `policy_history` (purchases) and `payout_history` (settlements)
    - Color-coded entries: green for payouts, orange for purchases, with trigger-specific icons

9.  **`ProfileScreen.tsx`**: Rider identity management:
    - Profile completion ring (SVG animated progress)
    - **Trust Score System** (see below)
    - Personal details: name, DOB (date picker), mobile (OTP verification)
    - Gig Worker ID verification (2-second mock verification → trust +10)
    - Address auto-fill via PIN code (api.postalpincode.in)
    - Platform ID (GG-XXXX-XXXX) with copy-to-clipboard
    - Help & Support link, Logout

---

## Unified Trust Score UI

The ProfileScreen displays the rider's trust score (0–100) with full educational transparency:

### Trust Tiers (as implemented in frontend)

| Tier | Score | Vesting | Fraud Check | Color |
|---|---|---|---|---|
| 🟢 **VETERAN** | 80–100 | 2h | Light (Geofence only) | Green |
| 🔵 **TRUSTED** | 50–79 | 4h | Standard | Aqua |
| 🟡 **NEUTRAL** | 25–49 | 8h | Full + Flagged | Orange |
| 🔴 **SUSPICIOUS** | 0–24 | 24h | Full + Blocked | Red |

### Trust Score Mutations (displayed in-app)

**How to Earn:**
| Action | Points |
|---|---|
| ✅ Clean payout settlement | +3 pts |
| 📍 Consistent GPS location (within 5km, 1x/24h) | +2 pts |
| 🛡️ Verify Gig Worker ID | +10 pts |
| 📝 Complete Profile Details | +5 pts |
| 📅 No-claim week (honest use) | +1 pt |

**What Costs Trust:**
| Action | Points |
|---|---|
| 🚨 High fraud score (≥60) | −25 pts |
| ⚠️ Moderate fraud flag (≥30) | −10 pts |
| 📍 GPS teleportation (>40km) | −25 pts |
| 🌐 VPN/proxy detected | −15 pts |
| ⏱️ Irregular location pings | −5 pts |

The trust score progress bar uses a segmented color gradient (Red → Orange → Aqua → Green) with threshold markers at 0, 25, 50, 80, 100.

---

## Reusable Components & Theme Layer

All theme configs (colors, spacing, shadows, fonts) exist centrally in `src/theme/index.ts`.
The UI is strictly based on a **Premium Dark Theme** utilizing the brand base color `#131323`, punctuated by aqua (`#00E5FF`) and burnt orange (`#FF6B35`) accents.

| Component | Purpose |
|---|---|
| `PlanCard.tsx` | Animated plan card — supports adjustments, suspensions, recommendations, and underwriting locks |
| `GigBotModal.tsx` | Floating AI chatbot interface powered by Llama 3.1 (Groq) |
| `RiskGauge.tsx` | SVG-based visual gauge for disruption risk level (0–1 scale) |
| `AQIPanel.tsx` | Live air quality data display for Delhi NCR geo-fence |
| `CityAlertsFeed.tsx` | Real-time city disruption news feed with dynamic alert reasons |
| `PremiumInput.tsx` | Premium configuration input form |
| `WeatherStat.tsx` | Small metric badge for weather data visualization |
| `StatusBadge.tsx` | Reusable label chip (active/safe/suspended) |

---

## Lottie Animations Layer

Lottie animations are crucial to the GigGuard visual identity. URLs are mapped constantly in the code:
- Weather states: clear sky, cloudy, rain (mapped via `weathercode`)
- High risk triggers: `heavy_rain`, `extreme_heat`, `storm`, `flood_zone`, `poor_visibility`
- Push-notification confettis on `simulatePayout()` success
- Processing animations during Razorpay checkout flow

---

## API Integration Summary

| Function | Endpoint | Screen |
|---|---|---|
| `fetchPremium()` | `POST /premium` | PlanSelection, Dashboard |
| `fetchSimulatedPremium()` | `POST /premium/simulate` | Dashboard (Judge Sandbox) |
| `loginUser()` / `registerUser()` | `POST /auth/login` / `register` | Login, Signup |
| `syncFirebaseUser()` | `POST /auth/firebase-sync` | Login (Firebase bridge) |
| `fetchUserProfile()` | `GET /auth/me` | Dashboard, Coverage, Wallet, Profile |
| `updateUserProfile()` | `POST /auth/profile/update` | Profile |
| `createRazorpayOrder()` | `POST /policy/order` | Payment |
| `verifyRazorpayOrder()` | `GET /policy/order/verify/{id}` | Payment |
| `purchasePolicy()` | `POST /policy/purchase` | Payment |
| `simulatePayout()` | `POST /policy/payout/simulate` | Dashboard |
| `updateUserLocation()` | `POST /user/location` | Dashboard (background) |
| `registerPushToken()` | `POST /user/push-token` | Dashboard (background) |
