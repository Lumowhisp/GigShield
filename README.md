# 🛡️ GigGuard
**AI-Powered Parametric Insurance for India’s Gig Economy**  
*Guidewire DEVTrails 2026 - Phase 1: Ideation & Foundation*

---

## 📖 Overview
India’s 1.2 crore gig workers, specifically food delivery partners, face a critical "Livelihood Gap." While grossing ₹26K-30K/month, steep operational costs reduce net earnings to roughly ₹800–1,200/day. High-impact external disruptions—such as severe weather, public curfews, or platform outages—result in immediate, unrecoverable income loss without the safety net of formal employment benefits.

**GigGuard** bridges this gap. It is an AI-enabled parametric insurance platform that replaces slow, manual claims processing with objective API triggers to automate instant payouts when uncontrollable events halt earning potential.

## 🎯 Target Persona & Workflow
* **Persona:** Food Delivery Partners (Zomato / Swiggy in Metro/Tier-1 Cities).
* **Coverage Scope:** Loss of Income only. (Strictly excludes health, vehicle repair, or accidents).
* **Core Workflow:**
  1. **Onboard:** Rider registers via the GigGuard Mobile App and links an operational UPI ID.
  2. **Opt-In:** Rider subscribes to a dynamic weekly micro-premium tier.
  3. **Trigger Event:** An external disruption occurs (e.g., severe cloudburst/flooding).
  4. **Validation:** Backend APIs confirm the disruption in the rider's active geo-fenced commercial zone.
  5. **Auto-Payout:** AI verifies location integrity and executes an instant UPI payout.

## 💰 Financial Model & Parametric Triggers
Gig workers operate on weekly cash flows. GigGuard utilizes a **3-Tier Weekly Premium Model**:
* **Basic (₹30/week):** Covers up to ₹500/week.
* **Standard (₹60/week):** Covers up to ₹1,200/week.
* **Premium (₹100/week):** Covers up to ₹2,500/week.

*Note: Premiums are dynamically calibrated by our AI based on hyper-local disruption histories (e.g., flood-prone zones carry a dynamically adjusted premium).*

**Objective API Triggers:**
* **Environmental:** Heavy Rainfall (>40mm/24h), Extreme Heat (>45°C), or Severe AQI (>300). *(Source: OpenWeatherMap API)*
* **Infrastructure/Social:** Unplanned curfews or severe route blockages. *(Source: MapMyIndia Traffic/Incident APIs)*
* **Platform Tech:** Extended primary delivery app outages. *(Source: Simulated Uptime APIs)*

**Platform Choice:** A **Mobile-First PWA/Native App**, built specifically for riders who operate entirely via smartphones.

## 🧠 AI / ML Integration: Dynamic Risk & Fraud Triangulation
GigGuard doesn't rely on static pricing or manual claim reviews. We use Machine Learning to power two core engines:
* **Predictive Granular Pricing (Risk Engine):** Instead of a flat city-wide premium, the ML model ingests 10+ years of Open-Meteo historical weather data and MapMyIndia traffic patterns to generate a hyper-local **Zone Risk Score**. This dynamically adjusts the Weekly Premium down to the municipal ward level. 
* **Behavioral Fraud Triage (Trust Engine):** The AI automatically cross-references physical world telemetry. If a rider claims a payout for "impassable flooded roads," the AI queries live MapMyIndia traffic flows for that exact coordinate. If traffic is moving at 40 km/h, the claim is auto-flagged.

**Real-Life Example:** Rahul delivers in **Andheri East (Low-Lying/Flood-Prone)**, while Amit delivers in **Bandra West (Well-Drained/Coastal)**. During the monsoon, the AI dynamically raises Rahul’s Base Premium slightly to ₹34/week due to the high probability of disrupted shifts, while Amit pays just ₹28/week. On July 15th, a massive cloudburst hits Andheri. Rahul is forced to stop working. The AI instantly reads the >40mm rain data from OpenWeatherMap and the "severe gridlock" data from MapMyIndia, automatically triggering Rahul's ₹500 payout without a single piece of paperwork.

## 🚨 Adversarial Defense Architecture (Anti-Spoofing)
To neutralize organized GPS-spoofing fraud rings, GigGuard relies on multi-layered network topography validation rather than simple coordinate trust.

1. **Cellular Triangulation (Cell ID):** GPS logic is cross-validated against connected cellular towers to detect immediate location discrepancies.
2. **BSSID Mapping:** The app scans visible Wi-Fi MAC addresses to ensure the network terrain matches the commercial "red-zone," defeating at-home spoofing setups.
3. **Sensor Telemetry:** Velocity heuristics and internal barometer checks flag impossible movement patterns or mismatched atmospheric pressure.
4. **Asynchronous Verification (UX Balance):** If location confidence is degraded strictly due to storm-induced network drops, the automated payout is paused instead of rejected. An asynchronous micro-task (e.g., uploading a live photo of the flood layout) is triggered and verified via a lightweight vision model to release funds without penalizing honest workers.

## 🛠️ Tech Stack & Phase Roadmap
* **Frontend:** PWA / React Native (Optimized for outdoor visibility and low latency).
* **Backend:** Node.js / Express (Handling API trigger polling).
* **AI/ML Layer:** Python / FastAPI (Risk modeling, Cell-ID anomaly detection).
* **Data Integrations:** OpenWeatherMap, MapMyIndia, Razorpay Sandbox.

**Roadmap:**
* **Phase 2 (Weeks 3-4):** Mobile UI development, premium ML modeling, and mock API parametric trigger wiring.
* **Phase 3 (Weeks 5-6):** Implementation of Sensor Fraud Detection, Razorpay Test-Mode auto-payouts, and Admin Analytics Dashboard.

---

## 🤝 Team Contribution Guidelines

This repository is a **private team project** developed for an AI Innovation Hackathon. Only project team members should contribute.

**Team Members:**
- Aditya *(Workflow & Architecture)*
- Aaryan *(Data Sources & API Integrations)*
- Abhishek Binwal *(Parametric Triggers & Fraud Ideation)*
- Shlok Gupta *(Income Disruption Research)*
- Abhishek Yadav *(Research)*

### 📌 Development Workflow
1. **Clone the Repository:** `git clone <repository-url>`
2. **Create a Feature Branch:** `git checkout -b feature/feature-name`
3. **Commit Your Changes:** `git commit -m "feat: added weather trigger monitoring"`
4. **Push & PR:** Push to origin and open a Pull Request to `main`. Do not push directly to `main`.
