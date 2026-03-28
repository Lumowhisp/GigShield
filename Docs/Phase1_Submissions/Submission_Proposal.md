## Inspiration
Every day, over 1.2 crore gig workers in India hit the roads, running on tight margins and taking home just ₹800–1,200 a day. But what happens when a sudden cloudburst floods the streets, or Delhi winters push the AQI to hazardous levels? They have to log off, instantly losing their daily income with absolutely zero safety net. Traditional insurance is too slow, too paper-heavy, and just doesn't work for gig life. We wanted to build something fast, fair, and entirely automated to protect their livelihoods.

## What it does
**GigGuard** is an AI-powered micro-insurance platform built for food delivery partners. Instead of filing claims and waiting weeks, everything relies on real-world data. 
Riders pay a tiny weekly premium (as low as ₹30). If a massive disruption hits their specific delivery zone—like extreme rain or a severe 48-hour smog wave—our system detects it via APIs and instantly drops a UPI payout straight into their wallet. No claims, no waiting, just instant relief so they don't lose out when disaster strikes.

## How we built it
We combined real-time external data with Machine Learning to make it fully automated:
* **Parametric Triggers:** We wired up OpenWeatherMap and MapMyIndia APIs to monitor live severe weather and massive traffic blockages. 
* **Dynamic AI Pricing:** We didn't want a flat fee. We trained an ML model on 10 years of historical data to figure out which zones are riskier (like flood-prone areas) and adjust premiums locally.
* **Anti-Spoofing Protocol:** Since GPS spoofing is a known issue, we built a trust engine that actively cross-checks cellular towers and local Wi-Fi networks to prove the rider is actually where they say they are.

## Challenges we ran into
* **Stopping the Money Bleed:** At first, our model paid out on every minor pollution spike, which would quickly bankrupt the insurance pool. We had to rethink our logic entirely, creating an "Intelligent Duration-Backed AQI" model that only triggers full payouts when severe AQI (like >400) sustains for over 48 hours.
* **Fighting Location Fraud:** We quickly realized we couldn't just trust a phone's GPS coordinates. Pivoting to network-level validation (cell towers and Wi-Fi mapping) was incredibly tough but absolutely necessary to prevent fake claims.

## Accomplishments that we're proud of
* **Pricing it Right:** We managed to build a realistic financial model where the premium costs less than 1.5% of a rider's weekly net income, making it actually affordable.
* **Mathematical Fairness:** We successfully tied real-world severity directly to the payout amounts using dynamic math formulas. It feels great to build something that's both socially impactful and actuariably sound.

## What we learned
Building parametric insurance isn't just about calling a weather API. We really had to put ourselves in the rider's shoes. For example, if a massive storm knocks out cell towers, our strict fraud engine would initially penalize an honest worker. We learned how essential it is to build empathetic fallback options—like allowing them to securely upload a photo later for AI vision review—instead of just outright rejecting them.

## What's next for GigGuard
We've locked down the core logic, API mapping, and mathematical validation. 
* Next up is fully building out the React Native mobile app so riders have a slick, low-latency interface that works well outdoors.
* We also plan to integrate the Razorpay Sandbox for live UPI payout testing and fine-tune our computer vision models for our fallback verification flow.



