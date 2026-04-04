# 🎬 GigGuard Demo Video Script
### *Hackathon Presentation — 2 min 30 sec*

---

## 📋 Pre-Recording Checklist

- [ ] Backend running at `https://gigguard-4u5z.onrender.com` (or local `0.0.0.0:8000`)
- [ ] MongoDB connected (check `/health` endpoint for `db_status: "ok"`)
- [ ] Expo app running on device/simulator
- [ ] A test account logged in (or have credentials ready)
- [ ] Screen recorder running on phone (or use Expo emulator + OBS)

---

## SCENE 1 — The Problem *(0:00 – 0:20)*

> **[SCREEN: Title Card / Slide]**

### 🎙️ Voiceover:

> *"India has over 15 million gig delivery riders — Zomato, Swiggy, Uber, Rapido. When heavy rain hits, when the AQI crosses 300, or when a heatwave strikes — they can't work. Their income drops to zero. And no insurance product exists that covers this.*
>
> *GigGuard fixes this. It's a parametric, AI-powered micro-insurance platform that automatically pays riders when weather disrupts their earnings — no claim forms, no waiting."*

### ⏱️ Duration: 20 seconds

---

## SCENE 2 — The ML Engine *(0:20 – 0:55)*

> **[SCREEN: Show Swagger UI at `/docs` OR a quick terminal + architecture diagram]**

### 🎙️ Voiceover:

> *"Let me show you the brain behind GigGuard.*
>
> *Our ML engine is an XGBoost model trained on 10 years of weather data across 35 GPS zones spanning all of India — from Mumbai's monsoons to Delhi's smog, Patna's floods to Shimla's cold."*

**[ON SCREEN: Show the `/health` endpoint response — highlight these numbers]**

> *"The model ingests 34 features — rainfall, temperature, wind, solar radiation, elevation, coast distance — and outputs a loss ratio: the expected fraction of income a rider will lose today.*
>
> *Test R-squared: 87.73%. Mean absolute error: just ₹0.87 per day. Walk-forward cross-validated — no data leakage."*

**[Quick flash: Show `disruption_triggers.py` header or a slide listing the 6 triggers]**

> *"We have 6 automated disruption triggers, each calibrated against real Indian standards:*
>
> 1. *🌧️ **Heavy Rain** — IMD Orange/Red alert thresholds (65mm / 115mm)*
> 2. *🌡️ **Extreme Heat** — GPS-adaptive: 38°C coast, 42°C plains, 43°C desert*
> 3. *💨 **Storm / Cyclone** — winds > 40 km/h, gusts > 80 km/h*
> 4. *🌊 **Flood Zone** — elevation + accumulated rain + river basin detection*
> 5. *🌫️ **Poor Visibility / Smog** — solar radiation proxy*
> 6. *😷 **Severe AQI** — Delhi NCR AQI > 300 proxy*
>
> *Each trigger returns a severity score, a loss multiplier, and fires automatically — zero human intervention."*

### ⏱️ Duration: 35 seconds

---

## SCENE 3 — Dynamic Pricing & Capping *(0:55 – 1:15)*

> **[SCREEN: Show Plan Selection Screen in the app OR the `/premium` JSON response]**

### 🎙️ Voiceover:

> *"Pricing is fully dynamic — recalculated every week based on your GPS location and the 7-day weather forecast.*
>
> *Here's the formula:*
> ```
> Premium = ML_Loss_Ratio × Daily_Income × Coverage% × 7 days × Loading
> ```
>
> *Then we apply 5 real-time micro-adjustments:*
> 1. *✅ **Zone Safety Discount** — safe elevation zones get ₹2–10 off per week*
> 2. *✅ **Forecast Surge** — if 4+ of 7 days have severe weather, coverage hours auto-extend and premium adjusts +12%*
> 3. *✅ **No-Claim Streak** — up to 15% loyalty discount for consecutive safe weeks*
> 4. *✅ **Multi-Trigger Loading** — 3+ simultaneous hazards trigger a +15% compound surcharge*
> 5. *✅ **Seasonal Adjustment** — monsoon months get +15%, winter fog +5%*"

**[ON SCREEN: Highlight the pricing breakdown card showing Base Premium → Adjustments → Final]**

> *"And critically — we've introduced premium caps for affordability. Basic plans are capped at ₹49/week, Standard at ₹99/week. So even in the worst monsoon, the rider never pays more than that. Premium plan stays uncapped for high-risk riders who want full coverage."*

### ⏱️ Duration: 20 seconds

---

## SCENE 4 — App Walkthrough *(1:15 – 2:10)*

### 4a. Login & Location *(1:15 – 1:25)*

> **[SCREEN: Show Login screen → Location Permission screen]**

### 🎙️ Voiceover:

> *"The rider opens GigGuard. Logs in with email — secured with bcrypt password hashing and JWT tokens stored in device SecureStore.*
>
> *The app requests GPS permission. Their exact coordinates are sent to our backend — this is how we make the insurance fully portable. Any GPS point in India works."*

---

### 4b. Plan Selection *(1:25 – 1:40)*

> **[SCREEN: PlanSelectionScreen — scroll through slowly]**

### 🎙️ Voiceover:

> *"The AI generates a personalized quote. We show three tiers:*
> - ***Basic** — 40% income coverage, ₹20–49/week*
> - ***Standard** — 70% coverage, recommended, ₹20–99/week*
> - ***Premium** — 100% full income replacement*
>
> *Below, we show the 7-day disruption forecast as a bar chart — each bar represents one day's predicted risk. The 'Income at Risk' card shows exactly how many rupees the rider stands to lose versus how much GigGuard will recover.*
>
> *Full transparency — we even show the pricing formula and model accuracy right here on the screen."*

**[ON SCREEN: Tap "Standard" plan → Tap "Activate Coverage"]**

---

### 4c. Payment *(1:40 – 1:50)*

> **[SCREEN: PaymentScreen]**

### 🎙️ Voiceover:

> *"Payment supports UPI, cards, net banking, and wallets — PhonePe, GPay, Paytm, BHIM. The checkout includes GST breakdown, SSL encryption badge, and RBI compliance notice.*
>
> *Tap pay — animated processing with real-time status — and the policy is activated for 7 days."*

**[ON SCREEN: Select PhonePe → Tap "Pay Securely" → Show processing animation → Success screen]**

---

### 4d. Dashboard *(1:50 – 2:05)*

> **[SCREEN: DashboardScreen — scroll through key sections]**

### 🎙️ Voiceover:

> *"This is the real-time command center. Live weather, active plan status with expiry countdown, and the 7-day disruption forecast rendered as a Bezier line chart.*
>
> *Below — every disruption trigger is shown with live severity bars, loss factors, and active/safe status. We also stream live AQI data and a city disruption feed.*
>
> *And here's the magic — the Claim Simulator."*

**[ON SCREEN: Tap "⚡ DEMO: Force Payout Trigger"]**

> *"When weather breaches a threshold — or in this demo, when we force a trigger — GigGuard calculates the payout instantly, writes it to MongoDB, and sends the money via UPI in under 3 seconds."*

**[ON SCREEN: Show iOS-style push notification sliding down with confetti → "Money Received! 💰"]**

> *"The rider sees a push notification — ₹ amount deposited. No forms. No waiting. Fully parametric."*

---

### 4e. Wallet Passbook *(2:05 – 2:15)*

> **[SCREEN: WalletScreen — scroll through]**

### 🎙️ Voiceover:

> *"The Wallet is a passbook-style ledger. Every policy purchase and every automated payout is recorded chronologically with settlement status.*
>
> *We also show the actuarial health of the insurance pool — Burning Cost Ratio at 67%, right in the target zone. The model R², MAE, and a 4-step expandable formula that explains exactly how every rupee is calculated."*

---

## SCENE 5 — Close *(2:15 – 2:30)*

> **[SCREEN: Dashboard with GigBot floating button → Tap it → Show AI chat]**

### 🎙️ Voiceover:

> *"And if the rider has any questions — GigBot, our AI support assistant powered by Llama 3.1, is always available in-app.*
>
> *GigGuard — GPS-portable, parametric, instant. Weather can't stop gig workers from earning. We make sure of it."*

**[END CARD: "GigGuard — Parametric Micro-Insurance for India's Gig Economy"]**

### ⏱️ Duration: 15 seconds

---

## 📊 Key Numbers to Flash On-Screen

| Metric | Value |
|---|---|
| ML Model | XGBoost v2.1 |
| Training Data | 10 years, 35 GPS zones, 126K rows |
| Features | 34 (weather + geo + trigger indicators) |
| Test R² | 0.8773 |
| Test MAE | ₹0.021 per ₹1 income |
| Walk-Forward CV R² | 0.8772 |
| Overfit Gap | 0.0217 (excellent) |
| Disruption Triggers | 6 automated |
| Plan Tiers | 3 (Basic / Standard / Premium) |
| Premium Cap — Basic | ₹49/week |
| Premium Cap — Standard | ₹99/week |
| Pricing Adjustments | 5 dynamic micro-adjustors |
| Settlement Time | ~3 seconds |
| Authentication | JWT + bcrypt + SecureStore |
| AI Assistant | GigBot (Llama 3.1 via Groq) |
| Payment Methods | UPI, Card, Net Banking, Wallet |

---

## 🎯 Key Technical Differentiators to Emphasize

1. **100% Parametric** — No claim forms, zero human adjudication. Weather data → trigger → payout. Fully automated pipeline.

2. **GPS-Portable** — Not tied to any city. Works at ANY GPS coordinate in India. Elevation, coast distance, and zone safety are computed on-the-fly from lat/lon.

3. **Non-Leaking ML** — Target variable includes stochastic worker behavior noise (resilience, demand variance, infrastructure quality). Identical weather → different losses. Honest R², not inflated.

4. **Zone-Adaptive Triggers** — Thresholds change based on geography. Chandigarh (39°C heat threshold) ≠ Jodhpur (43°C). Patna (river basin, lower flood threshold) ≠ Mumbai (coastal amplifier). Not one-size-fits-all.

5. **Actuarially Sound** — Burning Cost Ratio 67.2% (target: 55–70%). Premium floors (₹20–39) and caps (₹49/₹99) ensure affordability without pool insolvency. Tail risk modeled with sigma-based uncertainty loading.

6. **Fraud Prevention** — Duplicate claim detection (same trigger within 24h rejected), active policy verification, JWT authentication on every payout endpoint.

---

## 🎬 Recording Tips

- **Phone recording**: Use iOS built-in screen recorder (Control Center → Screen Recording). Set device to Do Not Disturb.
- **Scrolling pace**: Slow, deliberate. Pause 1–2 seconds on each important card before scrolling.
- **Tap animations**: Make taps visible. After tapping, wait for the full animation to complete.
- **Voiceover**: Record separately in a quiet room with good audio. Sync in post-production.
- **Music**: Use royalty-free background music (low volume) — something modern/techy.
- **Transitions**: Use simple fade/cut transitions between scenes. No flashy effects — let the app speak.
