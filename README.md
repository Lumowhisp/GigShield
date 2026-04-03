# 🛡️ GudieWire / GigShield 

Welcome to the GigShield monorepo! GigShield is a parametric insurance engine designed specifically for gig workers in India, providing dynamic, weather-based coverage and automated payouts.

This repository holds the entire platform logic, from the sophisticated Machine Learning pricing backend to the beautifully animated React Native mobile app.

---

## 📚 Developer Guides & Documentation

To understand the core architecture of the codebase, please review the extensive developer guides linked below:

- **[Master Architecture Guide](./Docs/Master_Architecture.md)**: Start here. Understand how the React Native App, FastAPI Backend, and ML Model interact in real-time.
- **[ML Engine & Analytics Guide](./Docs/ML_Engine_Guide.md)**: Deep dive into the custom Actuarial math, the RandomForestRegressor ML model, and the 6 dynamic disruption triggers.
- **[Backend API Reference](./Docs/Backend_API_Reference.md)**: FastAPI endpoints, Firebase synchronization, and MongoDB user architecture.
- **[Mobile App Guide](./Docs/MobileApp_Guide.md)**: Details on the React Native Expo frontend, UI component tree, and Lottie implementations.

---

## 🚀 Quick Start (Running Locally)

You will need two terminal windows to run the stack.

### 1. The FastAPI Backend
```bash
cd ML_Engine/GigShield_v2_copy
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python3 main.py
```
*The backend will run on `http://localhost:8000` via Uvicorn.*

### 2. The React Native Mobile App
```bash
cd MobileApp
npm install
npx expo start --clear
```
*Use the Expo Go app on your physical device, or press `i` to run in the iOS Simulator.*

---

## 🏆 Hackathon Specific Deliverables

If you are a judge reviewing our submission, please note the following technical constraints we specifically engineered:
1. **Underwriting (Active Days check)**: Evaluated directly in `main.py` dynamically shutting down Premium tiers if users have `< 5` active days.
2. **Delhi NCR AQI Trigger**: A highly specific geo-fenced trigger mapping stagnation and solar blockage in `disruption_triggers.py` to trigger severe pollution warnings.
3. **Catastrophic Event Circuit Breakers**: If the dynamic loss-ratio hits >85%, the backend safely intercepts the UI and triggers a suspension lock.
