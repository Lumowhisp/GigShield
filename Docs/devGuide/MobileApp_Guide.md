# 📱 Mobile App Guide

The GigGuard mobile application is built using React Native and Expo (SDK 54). It lives inside the `MobileApp/` directory.

## App Architecture

*   **State Management:** React local state (`useState`, `useRef` for animations) + Navigation parameters pass structured premium information between screens without requiring heavy global stores like Redux.
*   **Navigation:** Uses `@react-navigation/native-stack` mixed with a Bottom Tab Navigator (`MainTabs`).
*   **Networking:** All requests isolate through `src/services/api.ts`.
*   **Persistence:** Uses `expo-secure-store` to keep JWT tokens and `expo-location` for obtaining coordinates.
*   **Authentication:** Seamless Firebase Auth integrated with a Python API JWT bridge.

---

## App Screens & Flow

**Auth & Onboarding**
1. `SplashScreen.tsx` / `WelcomeScreen.tsx`: Brand introductions with Lottie animations.
2. `LoginScreen.tsx` / `SignupScreen.tsx`: Firebase Email/Password auth handling.
3. `LocationPermissionScreen.tsx`: Prompts user before activating GPS for pricing.
4. `PlanSelectionScreen.tsx`: Handles pricing AI quote math. Renders UI dynamically, graying out plans if user has `< 5` active days, and displaying a full red screen if `is_suspended` is active.
5. `PaymentScreen.tsx`: Payment gateways simulation holding strict breakdown of GST and limits.

**Main Dashboard & Hub (`MainTabs`)**
6. `DashboardScreen.tsx`: The central hub calling `/premium`. Renders Bezier path charts (`react-native-chart-kit`) mapping the 7-day risk array.
7. `CoverageScreen.tsx`: Displays active disruption triggers via the `AQIPanel` and active weather triggers array.
8. `WalletScreen.tsx`: The passbook-style ledger listing parametric settlement payouts and historical premium deductions securely.
9. `ProfileScreen.tsx`: Manages rider identity and statistics.

---

## Reusable Components & Theme Layer

All theme configs (colors, spacing, shadows, fonts) exist centrally in `src/theme/index.ts`.
The UI is strictly based on a **Premium Dark Theme** utilizing the brand base color `#131323`, punctuated by aqua (`#00E5FF`) and burnt orange (`#FF6B35`) accents.

*   `PlanCard.tsx`: The animated card component for plans. Highly dynamic to support adjustments vs suspensions vs recommendations.
*   `GigBotModal.tsx`: The floating action button mounting our Llama 3.1 LLM Chatbot via Groq for instantaneous rider support.
*   `RiskGauge.tsx` & `WeatherStat.tsx`: Small visualization badges utilizing SVG paths to rapidly convey numerical information.
*   `CityAlertsFeed.tsx`: Streams dynamic string reasons detailing exactly *why* a premium changed locally.

## Lottie Animations Layer

Lottie animations are crucial to the GigGuard visual identity. URLs are mapped constantly in the code:
- Safe states (`zoneSafety`)
- High risk triggers (`heavy_rain`, `extreme_heat`)
- Push-notification confettis on `simulatePayout()` success.
