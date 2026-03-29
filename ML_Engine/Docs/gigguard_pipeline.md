# 🌦️ GigGuard -- Weather Data Pipeline & Feature Engineering

## 📌 Overview

This module collects and transforms **10 years of historical weather
data** across major Indian cities to power GigGuard's **AI-based weekly
premium model**.

The goal is to estimate: **disruption risk → income loss → dynamic
premium pricing**

------------------------------------------------------------------------

## 🏙️ Data Collection

We use the Open-Meteo Archive API to fetch daily weather data for:

-   Mumbai\
-   Delhi\
-   Bengaluru\
-   Hyderabad\
-   Ahmedabad\
-   Chennai\
-   Kolkata\
-   Surat\
-   Pune\
-   Jaipur

### 📊 Raw Features Collected

-   temperature_2m_max\
-   apparent_temperature_max\
-   precipitation_sum\
-   rain_sum\
-   precipitation_hours\
-   wind_speed_10m_max\
-   wind_gusts_10m_max\
-   shortwave_radiation_sum

------------------------------------------------------------------------

## ⚙️ Feature Engineering

### 🔁 Rolling Features

-   rolling_7d_rain\
-   rolling_3d_temp

### 🕒 Seasonal Encoding

-   sin_time\
-   cos_time

------------------------------------------------------------------------

## 🚨 Disruption Labeling

Rules: - precipitation_sum \> 50\
- temperature_2m_max \> 45\
- wind_speed_10m_max \> 60

Output: - 1 → Disruption\
- 0 → Normal

------------------------------------------------------------------------

## 📅 Weekly Aggregation

-   Temperature → mean\
-   Rain → sum\
-   Wind → max\
-   Disruption → max

------------------------------------------------------------------------

## 💰 Income Loss Modeling

-   avg_daily_income ≈ ₹800\
-   expected_loss = disruption × income × 3

------------------------------------------------------------------------

## 🧠 ML Pipeline

Weather Data → Feature Engineering → Disruption → Weekly Aggregation →
Income Loss → ML Model → Premium

------------------------------------------------------------------------

## 🚀 Key Insight

This system predicts **income disruption risk**, not just weather.

------------------------------------------------------------------------

## ✅ Output

-   10 years data\
-   Weekly dataset\
-   ML-ready pipeline

------------------------------------------------------------------------

## 🔥 Future Improvements

-   Add AQI\
-   Add traffic data\
-   Use real earnings data

------------------------------------------------------------------------

## 🏁 Conclusion

Foundation for GigGuard parametric insurance system.
