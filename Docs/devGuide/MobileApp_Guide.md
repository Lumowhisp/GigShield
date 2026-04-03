# 📱 Mobile App Guide

The GigShield mobile application is built using React Native and Expo. It lives inside the `MobileApp/` directory.

## App Architecture

*   **State Management:** React local state (`useState`, `useRef` for animations). Profile state is injected largely per-route via Stack Navigation parameters.
*   **Navigation:** Uses `@react-navigation/native-stack`. Contains a primary Stack containing Auth Screens, fading into Tab Navigation (via `MainTabs`) for Dashboard/Wallet functionality.
*   **Networking:** All requests isolate through `src/services/api.ts`.

---

## Core Screens

### 1. `DashboardScreen.tsx`
*   **Purpose:** The central hub.
*   **Key Logic:** Responsible for calling `fetchPremiumQuote()` on mount to get live real-time conditions. Maps the complex `PremiumResponse` JSON into Lottie visualizations.
*   **Triggers Array:** Iterates over active disruptions in `premiumData.forecast_risk` to vividly display what triggers are active today.

### 2. `PlanSelectionScreen.tsx`
*   **Purpose:** Where the AI quote math becomes human-readable UI.
*   **Key Logic:** 
    *   **Suspension Intercept:** Renders a fullscreen red "danger card" if `premiumData.is_suspended` is true. This acts as the actuarial circuit breaker UI.
    *   **Underwriting Locks:** Reads the `is_eligible` boolean on specific plans. If `< 5 active days` flagged the user ineligible, opacity drops to `0.5` and a lock renders over the plan card.

### 3. `WalletScreen.tsx`
*   **Purpose:** Simulates claims and auto-payout history.
*   **Key Logic:** Mock logic demonstrating a parameteric model where weather matches instantly trigger payouts without adjuster friction.

---

## Reusable Components

All theme configs (colors, spacing, shadows) exist in `src/theme/index.ts`. 

*   `PlanCard.tsx`: The animated card component for plans. Highly dynamic to support adjustments vs suspensions vs recommendations.
*   `WeatherStat.tsx`: Small badge components showing metrics.
*   `StatusBadge.tsx`: Reusable label chip.

## Lottie Animations Layer

Lottie animations are crucial to the GigShield visual identity. URLs are mapped constantly in the code:
- Safe states (`zoneSafety`)
- High risk triggers (`heavy_rain`, `extreme_heat`)
Ensure the phone has network access to render Lottie JSON from `lottie.host`.
