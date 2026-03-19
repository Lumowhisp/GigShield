# 🎯 GigGuard: Disruption Trigger & API Mapping Matrix

**Phase 1 Data Source Architecture | Lead: Aaryan**

To build a robust, AI-powered parametric insurance platform, we have mapped the most critical external disruptions to specific, measurable API triggers.

_(Note: Economic fluctuations and personal health issues have been strictly excluded to comply with hackathon constraints)._

## 🌍 1. Environmental Disruptions (Weather & Climate)

_These are the most frequent causes of income loss and the primary focus of our AI predictive model._

| **Disruption Type**              | **Trigger Threshold (The Rule)** | **Required API Data**                | **🏆 THE BEST API TO USE (Winner)**                                                                      |
| -------------------------------- | -------------------------------- | ------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| **Heavy Rainfall / Cloudbursts** | Rainfall ≥ 20 mm/hour            | Precipitation data (Live & Forecast) | **OpenWeather API** (Provides free live data + 5-day forecast for dynamic pricing).                      |
| ---                              | ---                              | ---                                  | ---                                                                                                      |
| **Urban / Flash Flooding**       | Alert = TRUE OR Rainfall > 50mm  | Severe Weather Alerts & Rain totals  | **OpenWeather API** (Using their severe weather alert endpoints).                                        |
| ---                              | ---                              | ---                                  | ---                                                                                                      |
| **Heatwaves / Extreme Cold**     | Temp ≥ 45°C OR Temp ≤ 4°C        | Live Temperature Data                | **OpenWeather API**                                                                                      |
| ---                              | ---                              | ---                                  | ---                                                                                                      |
| **Severe Pollution / Smog**      | AQI ≥ 350 (Hazardous)            | Live Air Quality Index               | **OpenWeather API (Air Pollution endpoint)** (No need for a separate WAQI API; keeps the backend clean). |
| ---                              | ---                              | ---                                  | ---                                                                                                      |
| **Cyclones / High Winds**        | Wind speed ≥ 60 km/h             | Live Wind Speed Data                 | **OpenWeather API**                                                                                      |
| ---                              | ---                              | ---                                  | ---                                                                                                      |

- **🧠 AI Integration Strategy:** We will use **Open-Meteo (100% Free)** offline in Google Colab to pull 10 years of historical data for these exact parameters to train our risk-prediction model.

## 🚧 2. Infrastructure & Urban Failures

_When the city stops, the rider stops. We triangulate this data to prevent fake claims._

| **Disruption Type**               | **Trigger Threshold (The Rule)**     | **Required API Data**            | **🏆 THE BEST API TO USE (Winner)**                                                                                     |
| --------------------------------- | ------------------------------------ | -------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **Traffic Gridlock**              | Congestion ≥ 90% (Avg speed < 5km/h) | Real-time traffic flow & density | **MapMyIndia (Mappls)** (Best hyper-local Indian traffic data with a generous free dev tier).                           |
| ---                               | ---                                  | ---                              | ---                                                                                                                     |
| **Waterlogged Roads / Blockages** | Road Status = "Impassable"           | Traffic incident reports         | **TomTom Traffic API** OR **MapMyIndia** (To detect closed routes).                                                     |
| ---                               | ---                                  | ---                              | ---                                                                                                                     |
| **Power / Internet Shutdowns**    | Connectivity = OFF                   | Network Outage Data              | **Mocked Node.js Endpoint** (Internet shutdowns are hard to fetch via free APIs; simulating this is best for the demo). |
| ---                               | ---                                  | ---                              | ---                                                                                                                     |

- **🧠 AI Integration Strategy:** These APIs act as our **"Ghost Rider Protocol" (Fraud Detection)**. If a rider claims they are stuck in a flood, the AI checks MapMyIndia. If traffic is flowing normally, the claim is flagged as potential fraud.

## 🚨 3. Social & Political Disruptions

_Unplanned curfews or strikes that physically block delivery zones._

| **Disruption Type**        | **Trigger Threshold (The Rule)** | **Required API Data**        | **🏆 THE BEST API TO USE (Winner)**                                                     |
| -------------------------- | -------------------------------- | ---------------------------- | --------------------------------------------------------------------------------------- |
| **Riots / Sudden Curfews** | Section 144 / Curfew = TRUE      | Local News / Govt Alert APIs | **NewsAPI (Free Tier)** (Search for keywords like "Curfew", "Section 144" + City Name). |
| ---                        | ---                              | ---                          | ---                                                                                     |
| **Protests / Strikes**     | Major road blockade detected     | Traffic Incident Data        | **MapMyIndia (Mappls) Incident API** (Detects major road closures due to protests).     |
| ---                        | ---                              | ---                          | ---                                                                                     |

## 💻 4. Platform / Tech Disruptions

_When the app crashes, the rider's income hits zero through no fault of their own._

| **Disruption Type**                  | **Trigger Threshold (The Rule)** | **Required API Data**   | **🏆 THE BEST API TO USE (Winner)**                                                                                                                            |
| ------------------------------------ | -------------------------------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **App Server Crash (Zomato/Swiggy)** | API uptime ≤ 10%                 | Service Uptime Monitors | **Simulated / Mocked API** (Real platforms won't share this data. We will build a toggle in our Admin Dashboard to simulate an "App Down" event for the demo). |
| ---                                  | ---                              | ---                     | ---                                                                                                                                                            |
| **Payment Gateway Failure**          | Gateway Status = DOWN            | Payment Uptime Check    | **Razorpay Status API** (Or simulated through our backend).                                                                                                    |
| ---                                  | ---                              | ---                     | ---                                                                                                                                                            |

## ❌ Out of Scope (Filtered for Compliance)

_To strictly adhere to DEVTrails judging criteria, we are excluding the following from our parametric model:_

- **Category 5 (Economic):** Low order demand, too many workers, surge removal. _(Reason: These are standard business risks, not external uncontrollable disasters)._
- **Category 6 (Behavioral/Health):** Fatigue, illness, rating drops. _(Reason: Hackathon rules explicitly forbid health/medical coverage)._