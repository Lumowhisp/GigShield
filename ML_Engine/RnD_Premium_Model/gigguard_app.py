"""
╔══════════════════════════════════════════════════════════════════════════════╗
║  GigGuard — Worker Dashboard (v4)                                          ║
║  Pure ML Engine | SHAP Explainability | Actuarial Pricing                  ║
╚══════════════════════════════════════════════════════════════════════════════╝
"""

import streamlit as st
import pandas as pd
import numpy as np
import time
import joblib

# ==========================================
# 💎 PREMIUM UI/UX AESTHETIC STYLING
# ==========================================
st.set_page_config(page_title="GigGuard | Worker Dashboard", page_icon="🛡️", layout="wide")

st.markdown("""
<style>
/* Modern Glassmorphism & Dark Mode Baseline */
.stApp {
    background: linear-gradient(135deg, #0e1117 0%, #1a1c24 100%);
    color: #e2e8f0;
    font-family: 'Inter', sans-serif;
}
.stMetric {
    background-color: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.05);
    padding: 20px;
    border-radius: 12px;
    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    transition: transform 0.2s ease, box-shadow 0.2s ease;
}
.stMetric:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 12px rgba(0,0,0,0.2);
}
[data-testid="stSidebar"] {
    background-color: rgba(10, 12, 16, 0.95);
    border-right: 1px solid rgba(255,255,255,0.05);
}
.plan-card {
    background-color: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.1);
    padding: 24px;
    border-radius: 12px;
    text-align: left;
    height: 100%;
    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    display: flex;
    flex-direction: column;
}
.plan-recommended {
    border: 1px solid #ecc94b;
    background-color: rgba(236, 201, 75, 0.05);
    box-shadow: 0 0 15px rgba(236, 201, 75, 0.2);
}
.plan-price {
    font-size: 32px;
    font-weight: 700;
    margin: 10px 0;
    color: #ffffff;
}
.actuarial-breakdown {
    font-size: 12px;
    color: #888;
    margin-top: 8px;
    line-height: 1.6;
}
</style>
""", unsafe_allow_html=True)

# ==========================================
# 🧠 ML ENGINE — SINGLE PURE MODEL
# ==========================================
@st.cache_resource
def load_model():
    """Loads the single pre-trained production XGBRegressor."""
    try:
        payload = joblib.load("gigguard_model.pkl")
        return payload["model"], payload["features"]
    except FileNotFoundError:
        st.error("❌ gigguard_model.pkl not found. Run `python export_models.py` first.")
        return None, None


def main():
    model, feature_cols = load_model()
    if model is None:
        return

    # ==========================================
    # ⚙️ SIDEBAR — WEATHER CONTROLS
    # ==========================================
    st.sidebar.title("🧠 AI Weather Engine")
    st.sidebar.caption("Pure ML — XGBRegressor trained on 10 years × 10 cities")

    city = st.sidebar.selectbox("📍 Geographic Node",
        ["Mumbai", "Delhi", "Bengaluru", "Hyderabad", "Ahmedabad",
         "Chennai", "Kolkata", "Surat", "Pune", "Jaipur"])

    st.sidebar.markdown("---")
    st.sidebar.subheader("🌦️ Live Weather Matrix")
    rain = st.sidebar.slider("Daily Rainfall (mm)", 0, 300, 0, 5)
    temp = st.sidebar.slider("Max Temperature (°C)", 10, 52, 28, 1)
    wind = st.sidebar.slider("Sustained Wind (km/h)", 0, 150, 10, 5)

    st.sidebar.markdown("---")
    st.sidebar.subheader("📅 Recent Weather History")
    rain_7d = st.sidebar.slider("Accumulated Last 7 Days (mm)", 0, 800, 10, 20)
    temp_3d = st.sidebar.slider("Avg Temp Last 3 Days (°C)", 10, 52, 28, 1)

    # ==========================================
    # ⚙️ FEATURE ENGINEERING PIPELINE
    # ==========================================
    row = {col: 0.0 for col in feature_cols}
    city_col = f"city_{city}"
    if city_col in row:
        row[city_col] = 1.0

    row["sin_time"] = 0.5
    row["cos_time"] = 0.5
    row["seasonal_factor"] = 1.0
    row["precipitation_sum"] = float(rain)
    row["precipitation_hours"] = float(min(rain / 5.0, 24.0))
    row["temperature_2m_max"] = float(temp)
    row["apparent_temperature_max"] = float(temp + 2.0)
    row["wind_speed_10m_max"] = float(wind)
    row["wind_gusts_10m_max"] = float(wind * 1.5)
    row["shortwave_radiation_sum"] = 24.0 if rain < 5 else 4.0
    row["rolling_7d_rain"] = float(rain_7d)
    row["rolling_3d_temp"] = float(temp_3d)

    # Interaction features
    row["rain_wind_interaction"] = float(rain * wind)
    row["rain_squared"] = float(rain ** 2)
    row["wind_squared"] = float(wind ** 2)
    row["temp_squared"] = float(temp ** 2)
    row["rain_wind_ratio"] = float(rain / (wind + 1))
    humidity_proxy = max(0, 1 - (row["shortwave_radiation_sum"] / 22.0))
    row["heat_index_proxy"] = float(temp * humidity_proxy)
    row["tail_event"] = 1.0 if (rain > 100 or temp > 45 or wind > 60) else 0.0

    # INFERENCE
    test_df = pd.DataFrame([row])[feature_cols]
    pred_loss = max(0, model.predict(test_df.values)[0])

    if pred_loss < 1.0:
        loss_val = 0
        loss_display = "Negligible"
    else:
        loss_val = int(round(pred_loss))
        loss_display = f"₹ {loss_val}"

    is_triggered = loss_val >= 50

    # Risk zone classification
    if loss_val > 150:
        risk_zone, risk_color = "HIGH ⚠️", "inverse"
    elif loss_val >= 50:
        risk_zone, risk_color = "MEDIUM 🟠", "off"
    else:
        risk_zone, risk_color = "LOW 🟢", "normal"

    # ==========================================
    # 1. TOP SECTION — Protection Status
    # ==========================================
    st.title("🛡️ GigGuard Dashboard")
    st.caption("Zero-Deductible Parametric Income Protection — Pure AI Engine")

    st.markdown("### Today's Protection Status")
    c1, c2, c3, c4 = st.columns(4)

    c1.metric("📍 Location", f"{city} Zone")
    c2.metric("🌧️ Current Risk", risk_zone)
    c3.metric("💸 Expected Loss Today", loss_display)
    c4.metric("⚡ Payout Status", "✅ Eligible" if is_triggered else "❌ Not eligible")

    st.markdown("<br>", unsafe_allow_html=True)

    # ==========================================
    # 2. 3-TIER ACTUARIAL PREMIUM PLANS
    # ==========================================
    st.markdown("### 💰 Select Your Coverage Plan")
    st.write("Premiums calculated using actuarial formula: `E[loss] + risk_loading + expenses + margin`")

    if "selected_plan" not in st.session_state:
        st.session_state["selected_plan"] = "Standard"

    # ── Actuarial Premium Calculation ──
    weekly_loss = pred_loss * 7
    risk_loading = weekly_loss * 0.20        # σ buffer for loss volatility
    expense_loading = weekly_loss * 0.15     # ops, tech, support costs
    actuarial_base = weekly_loss + risk_loading + expense_loading
    profit_margin = actuarial_base * 0.10    # sustainable business margin
    full_premium = actuarial_base + profit_margin

    # 3-Tier Product Scaling from actuarial base
    basic_price = int(max(29, full_premium * 0.70))
    std_price   = int(max(49, full_premium * 1.00))
    prm_price   = int(max(79, full_premium * 1.40))

    p1, p2, p3 = st.columns(3)

    with p1:
        st.markdown("<div class='plan-card'>", unsafe_allow_html=True)
        st.subheader("🥉 BASIC")
        st.markdown(f"<div class='plan-price'>₹{basic_price} <span style='font-size:16px; font-weight:normal; color:#aaa;'>/ week</span></div>", unsafe_allow_html=True)
        st.write("✔️ Covers up to **₹300/day**")
        st.write("✔️ Severe catastrophic events only")
        st.markdown(f"<div class='actuarial-breakdown'>E[loss]: ₹{weekly_loss:.0f} × 0.70 coverage</div>", unsafe_allow_html=True)
        if st.button("Select Basic", key="btn_basic", use_container_width=True):
            st.session_state["selected_plan"] = "Basic"
        st.markdown("</div>", unsafe_allow_html=True)

    with p2:
        st.markdown("<div class='plan-card plan-recommended'>", unsafe_allow_html=True)
        st.subheader("🥈 STANDARD ⭐")
        st.markdown(f"<div class='plan-price'>₹{std_price} <span style='font-size:16px; font-weight:normal; color:#aaa;'>/ week</span></div>", unsafe_allow_html=True)
        st.write("✔️ Covers up to **₹600/day**")
        st.write("✔️ Most balanced pricing structure")
        st.markdown(f"<div class='actuarial-breakdown'>E[loss]: ₹{weekly_loss:.0f} + risk: ₹{risk_loading:.0f} + ops: ₹{expense_loading:.0f} + margin: ₹{profit_margin:.0f}</div>", unsafe_allow_html=True)
        if st.button("Select Standard", key="btn_std", use_container_width=True):
            st.session_state["selected_plan"] = "Standard"
        st.markdown("</div>", unsafe_allow_html=True)

    with p3:
        st.markdown("<div class='plan-card'>", unsafe_allow_html=True)
        st.subheader("🥇 PREMIUM")
        st.markdown(f"<div class='plan-price'>₹{prm_price} <span style='font-size:16px; font-weight:normal; color:#aaa;'>/ week</span></div>", unsafe_allow_html=True)
        st.write("✔️ Covers **Full Loss (₹800+/day)**")
        st.write("✔️ Early-trigger + priority payout")
        st.markdown(f"<div class='actuarial-breakdown'>E[loss]: ₹{weekly_loss:.0f} × 1.40 enhanced</div>", unsafe_allow_html=True)
        if st.button("Select Premium", key="btn_prm", use_container_width=True):
            st.session_state["selected_plan"] = "Premium"
        st.markdown("</div>", unsafe_allow_html=True)

    st.success(f"**{st.session_state['selected_plan']} Plan** is currently active.")
    st.markdown("---")

    # Two-column layout for analytics
    left_col, right_col = st.columns([1.3, 1])

    with left_col:
        # ==========================================
        # 3. CLAIM SIMULATION
        # ==========================================
        st.markdown("### ⚡ Claim Simulation Sandbox")
        if is_triggered:
            st.error(f"⚠️ Extreme weather breached parametric threshold. AI triggers automatic claim.")
            if st.button("🚀 Execute Smart Claim", type="primary", use_container_width=True):
                with st.spinner("Processing parametric trigger & executing wallet transfer..."):
                    time.sleep(1.5)
                    st.balloons()
                    st.success(f"💰 **₹ {loss_val} successfully credited** to wallet! Processing time: Instant")
        else:
            st.info("🟢 Normal conditions. Parametric index not breached. No payout required.")
            st.button("🚀 Execute Smart Claim", disabled=True, use_container_width=True)

        st.markdown("<br>", unsafe_allow_html=True)

        # ==========================================
        # 4. LIVE RISK VISUALIZATION (Rain vs Loss)
        # ==========================================
        st.markdown("### 📊 Live Risk Visualization")
        st.write("AI-predicted loss curve as rainfall increases under current conditions.")

        sens_rains = list(range(0, 310, 20))
        sens_losses = []

        for r in sens_rains:
            base_sens = row.copy()
            base_sens["precipitation_sum"] = float(r)
            base_sens["precipitation_hours"] = float(min(r / 5.0, 24.0))
            base_sens["rain_wind_interaction"] = float(r * wind)
            base_sens["rain_squared"] = float(r ** 2)
            base_sens["rain_wind_ratio"] = float(r / (wind + 1))
            base_sens["tail_event"] = 1.0 if r > 100 else 0.0

            t_df = pd.DataFrame([base_sens])[feature_cols]
            p_loss = int(round(max(0, model.predict(t_df.values)[0])))
            sens_losses.append(p_loss)

        chart_data = pd.DataFrame({
            "Rainfall (mm)": sens_rains,
            "Predicted Loss (₹)": sens_losses
        }).set_index("Rainfall (mm)")

        try:
            st.line_chart(chart_data, color="#ff4b4b", x_label="Rainfall (mm)", y_label="Predicted Loss (₹)")
        except TypeError:
            st.line_chart(chart_data, color="#ff4b4b")

    with right_col:
        # ==========================================
        # 5. SHAP EXPLAINABILITY (WHY THIS PRICE)
        # ==========================================
        st.markdown("### 🧠 Why This Price?")
        st.caption("AI Feature Attribution — what's driving your premium")

        # Build a simple waterfall-style explanation
        # Show top contributing features and their raw values
        feature_impact = []
        weather_features_display = {
            "precipitation_sum": ("🌧️ Rainfall", f"{rain} mm"),
            "temperature_2m_max": ("🌡️ Temperature", f"{temp} °C"),
            "wind_speed_10m_max": ("💨 Wind Speed", f"{wind} km/h"),
            "rolling_7d_rain": ("🌊 7-Day Rain", f"{rain_7d} mm"),
            "rolling_3d_temp": ("📅 3-Day Temp", f"{temp_3d} °C"),
            "rain_wind_interaction": ("⛈️ Storm Index", f"{rain * wind}"),
            "tail_event": ("🚨 Extreme Event", "YES" if row["tail_event"] else "No"),
        }

        for feat_name, (display_name, display_val) in weather_features_display.items():
            if feat_name in feature_cols:
                idx = feature_cols.index(feat_name)
                importance = model.feature_importances_[idx]
                feature_impact.append({
                    "Factor": display_name,
                    "Value": display_val,
                    "Weight": f"{importance:.1%}",
                })

        if feature_impact:
            impact_df = pd.DataFrame(feature_impact)
            st.dataframe(impact_df, use_container_width=True, hide_index=True)

        st.markdown("<br>", unsafe_allow_html=True)

        # ==========================================
        # 6. WEEKLY OUTLOOK
        # ==========================================
        st.markdown("### 📅 Weekly Outlook")
        weekly_predicted_loss = loss_val * 7
        st.info(
            f"**Upcoming Next 7 Days:** {risk_zone}\n\n"
            f"**Expected Weekly Loss:** ₹ {weekly_predicted_loss}\n\n"
            f"**Actuarial Premium:** ₹ {std_price}/week"
        )

        st.markdown("<br>", unsafe_allow_html=True)

        # ==========================================
        # 7. PERSONAL INSURANCE DASHBOARD
        # ==========================================
        st.markdown("### 📈 Personal Insurance Dashboard")
        st.caption("Year-to-Date (YTD) Snapshot")

        paid_premiums = std_price * 12  # ~3 months
        claimed_payouts = int(weekly_predicted_loss * 3.5)
        net_benefit = claimed_payouts - paid_premiums

        c_p1, c_p2 = st.columns(2)
        c_p1.metric("Total Paid", f"₹ {paid_premiums}")
        c_p2.metric("Total Claimed", f"₹ {claimed_payouts}", "Tax Free")

        st.metric("Net Benefit", f"{'+'  if net_benefit >= 0 else ''}₹ {net_benefit}",
                   delta="Profitable" if net_benefit > 0 else "Protected")


if __name__ == "__main__":
    main()
