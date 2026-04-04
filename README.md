# 🛡️ GudieWire / GigGuard 

Welcome to the GigGuard monorepo! GigGuard is a parametric insurance engine designed specifically for gig workers in India, providing dynamic, weather-based coverage and automated payouts.

This repository holds the entire platform logic, from the sophisticated Machine Learning pricing backend to the beautifully animated React Native mobile app.

---

## 📚 Developer Guides & Documentation

To deeply understand the core architecture of the codebase, please review our extensive documentation. **Start with the Project Report.**

- 🏆 **[Project Report](./Docs/Project_Report.md)**: The comprehensive summary of the GigGuard platform, architecture, actuarial models, and business viability.
- 🏗️ **[Master Architecture Guide](./Docs/devGuide/Master_Architecture.md)**: Understand how the React Native App, FastAPI Backend, and ML Model interact in real-time.
- 🧠 **[ML Engine & Analytics Guide](./Docs/devGuide/ML_Engine_Guide.md)**: Deep dive into the custom Actuarial math, dynamic pricing logic, and the 6 heuristic disruption triggers.
- 📊 **[ML Model Analysis](./Docs/devGuide/ML_Model_Analysis_GigGuard_v2.md)**: Analysis of our XGBoost model performance (R² = 0.8773) and feature engineering.
- 🌐 **[Backend API Reference](./Docs/devGuide/Backend_API_Reference.md)**: FastAPI endpoints, Firebase synchronization, payout simulations, and MongoDB user architecture.
- 📱 **[Mobile App Guide](./Docs/devGuide/MobileApp_Guide.md)**: Details on the React Native Expo frontend, UI component tree, and custom animations.

---

## 🚀 Quick Start (Running Locally)

**For Judges:** The Mobile App is pre-configured to connect to our live production AI model and database hosted on Render (`https://gigguard-4u5z.onrender.com`). **You only need to run the Mobile App to fully test the platform.** We have provided the backend code for full transparency.

### 1. The React Native Mobile App (Required)
```bash
cd MobileApp
npm install
npx expo start --clear
```
*Use the Expo Go app on your physical device, or press `i` to run in the iOS Simulator.*

### 2. The FastAPI Backend (Optional)
If you want to run the ML engine and API locally to verify our code, you will need to set up the environment variables.

Copy the provided example environment file (which includes our hackathon sandbox MongoDB access so your test will work out of the box):
```bash
cd ML_Engine/GigGuard_v2_copy
cp .env.example .env
```

Then boot the AI engine:
```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python3 main.py
```
*The backend will run on `http://localhost:8000` via Uvicorn. To connect the mobile app to your local backend, change `BASE_URL` in `MobileApp/src/services/api.ts` to your local machine IP.*

---

## 🏆 Hackathon Specific Deliverables

If you are a judge reviewing our submission, please note the following technical constraints we specifically engineered:
1. **Underwriting (Active Days check)**: Evaluated directly in `main.py` dynamically shutting down Premium tiers if users have `< 5` active days.
2. **Delhi NCR AQI Trigger**: A highly specific geo-fenced trigger mapping stagnation and solar blockage in `disruption_triggers.py` to trigger severe pollution warnings for riders.
3. **Catastrophic Event Circuit Breakers**: If the dynamic AI loss-ratio hits >85%, the backend safely intercepts the UI and triggers an immediate suspension lock.
