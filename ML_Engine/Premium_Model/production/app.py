"""
╔══════════════════════════════════════════════════════════════╗
║  app.py — Interactive Location-Based Demo Dashboard         ║
║  Streamlit UI, fetching, predicting and presenting results  ║
╚══════════════════════════════════════════════════════════════╝
"""
import streamlit as st
import pandas as pd
import numpy as np
import plotly.graph_objects as go
import time

from weather_api import fetch_weather
from feature_engineering import build_features
from predict import RiskPredictor

# ==========================================
# 💎 UI/UX AESTHETICS
# ==========================================
st.set_page_config(page_title="GigGuard | Live Predictor", page_icon="🛡️", layout="wide")

st.markdown("""
<style>
.stApp {
    background: linear-gradient(135deg, #0e1117 0%, #1a1c24 100%);
    color: #e2e8f0;
    font-family: 'Inter', sans-serif;
}
.metric-box {
    background-color: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.05);
    padding: 16px;
    border-radius: 12px;
    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
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
}
.plan-price {
    font-size: 28px;
    font-weight: 700;
    margin: 10px 0;
    color: #ffffff;
}
</style>
""", unsafe_allow_html=True)

# ── Load Model Singleton ──
@st.cache_resource
def get_predictor():
    try:
        return RiskPredictor(model_path="../gigguard_model.pkl")
    except Exception as e:
        print("Model loading failed:", e)
        st.error(f"❌ Could not load ML model: {e}")
        return None

predictor = get_predictor()

def main():
    if predictor is None:
        st.warning("Please run `export_models.py` in the parent directory first.")
        return

    st.title("🛡️ GigGuard — Live Parametric Predictor")
    st.markdown("Enter any latitude/longitude in India. The ML engine will fetch a 7-day forecast, construct 29 non-linear risk features, and generate an actuarial premium quote in ~1.5s.")

    import requests

    # ==========================================
    # 📍 LIVE LOCATION SENSOR
    # ==========================================
    st.subheader("1. Authenticate & Auto-Detect Location")
    
    # Session state to hold our active coordinates
    if "active_lat" not in st.session_state:
        st.session_state["active_lat"] = None
    if "active_lon" not in st.session_state:
        st.session_state["active_lon"] = None

    col1, col2 = st.columns([1, 2])
    
    with col1:
        if st.button("📍 Auto-Detect Live Location", type="primary", use_container_width=True):
            with st.spinner("Pinging satellites..."):
                try:
                    # Quick IP-based geolocation for hackathon seamlessness (no browser prompts needed)
                    loc = requests.get('https://ipinfo.io/loc', timeout=5).text.strip().split(',')
                    st.session_state["active_lat"] = float(loc[0])
                    st.session_state["active_lon"] = float(loc[1])
                    st.success("✅ Location Secured!")
                except Exception as e:
                    st.error("Could not fetch automatic location. Please enter manually.")
    
    with col2:
        if st.session_state["active_lat"] is not None:
            st.info(f"**Current Active Terminal:** Lat: `{st.session_state['active_lat']}` | Lon: `{st.session_state['active_lon']}`")
        else:
            st.warning("Awaiting location signal...")

    with st.expander("⚙️ Manual Override Settings"):
        mcol1, mcol2 = st.columns(2)
        with mcol1:
            man_lat = st.number_input("Latitude", value=19.0760, format="%.4f")
        with mcol2:
            man_lon = st.number_input("Longitude", value=72.8777, format="%.4f")
        if st.button("Apply Manual Override"):
            st.session_state["active_lat"] = man_lat
            st.session_state["active_lon"] = man_lon
            st.rerun()

    # ==========================================
    # 🚀 EXECUTE ML PIPELINE
    # ==========================================
    st.markdown("<br>", unsafe_allow_html=True)
    
    run_pipeline = st.button("🚀 Calculate Live Weekly Premium", use_container_width=True)
    
    if run_pipeline:
        if st.session_state["active_lat"] is None:
            st.error("⚠️ Please detect your location first.")
            return

        lat = st.session_state["active_lat"]
        lon = st.session_state["active_lon"]

        with st.spinner("Fetching 14-day weather horizon from Open-Meteo..."):
            t0 = time.time()
            try:
                raw_weather_df = fetch_weather(lat, lon)
            except Exception as e:
                st.error(f"API Error: {e}")
                return

        with st.spinner("Engineering 29 reality-grounded ML features..."):
            features_df, nearest_city = build_features(
                weather_df=raw_weather_df,
                lat=lat,
                lon=lon,
                feature_cols=predictor.feature_cols
            )

        with st.spinner("Running XGBoost Inference & Actuarial Pricing..."):
            daily_preds = predictor.predict_7_days(features_df)
            quote = predictor.calculate_weekly_premium(daily_preds)
            t1 = time.time()

        st.success(f"Pipeline executed successfully in {t1 - t0:.2f} seconds!")

        st.markdown(f"**Zone Anchor:** Mapped to `{nearest_city}` risk profile.")

        # ==========================================
        # 💰 3-TIER PRICING UI
        # ==========================================
        st.markdown("### 💰 Actuarial Premium Tiers")
        
        p1, p2, p3 = st.columns(3)

        with p1:
            st.markdown("<div class='plan-card'>", unsafe_allow_html=True)
            st.subheader("🥉 BASIC")
            st.markdown(f"<div class='plan-price'>₹{quote['plans']['basic']} <span style='font-size:16px; font-weight:normal; color:#aaa;'>/ week</span></div>", unsafe_allow_html=True)
            st.write("✔️ Covers **70%** of expected loss")
            st.write("✔️ Severe catastrophic events only")
            st.markdown("</div>", unsafe_allow_html=True)

        with p2:
            st.markdown("<div class='plan-card plan-recommended'>", unsafe_allow_html=True)
            st.subheader("🥈 STANDARD ⭐")
            st.markdown(f"<div class='plan-price'>₹{quote['plans']['standard']} <span style='font-size:16px; font-weight:normal; color:#aaa;'>/ week</span></div>", unsafe_allow_html=True)
            st.write("✔️ Covers **100%** of expected loss")
            st.write("✔️ Actuarially balanced")
            st.markdown("</div>", unsafe_allow_html=True)

        with p3:
            st.markdown("<div class='plan-card'>", unsafe_allow_html=True)
            st.subheader("🥇 PREMIUM")
            st.markdown(f"<div class='plan-price'>₹{quote['plans']['premium']} <span style='font-size:16px; font-weight:normal; color:#aaa;'>/ week</span></div>", unsafe_allow_html=True)
            st.write("✔️ Covers **140%** enhanced payout")
            st.write("✔️ Early-trigger algorithm")
            st.markdown("</div>", unsafe_allow_html=True)

        # ==========================================
        # 📊 PREDICTION BREAKDOWN
        # ==========================================
        st.markdown("---")
        st.markdown("### 📊 Next 7 Days: Predicted Earnings Disruption")
        
        forecast_dates = raw_weather_df["date"].tail(7).dt.strftime("%a, %b %d").tolist()
        
        # Plotly combination chart
        fig = go.Figure()
        
        # Add daily expected loss bars
        fig.add_trace(go.Bar(
            x=forecast_dates,
            y=quote['daily_breakdown'],
            name='Expected Loss (₹)',
            marker_color='#ff4b4b',
            opacity=0.8
        ))
        
        # Add a rainfall line overlay just for context (from raw weather_df's last 7 rows)
        daily_rain = raw_weather_df["precipitation_sum"].tail(7).tolist()
        fig.add_trace(go.Scatter(
            x=forecast_dates,
            y=daily_rain,
            name='Rainfall (mm)',
            mode='lines+markers',
            yaxis="y2",
            line=dict(color='#3283FE', width=3)
        ))
        
        fig.update_layout(
            plot_bgcolor="rgba(0,0,0,0)",
            paper_bgcolor="rgba(0,0,0,0)",
            font_color="#e2e8f0",
            title="Daily Expected Income Loss vs Rainfall",
            xaxis=dict(showgrid=False),
            yaxis=dict(title="Estimated Loss (INR)", showgrid=True, gridcolor="rgba(255,255,255,0.05)"),
            yaxis2=dict(title="Rainfall (mm)", overlaying="y", side="right", showgrid=False),
            hovermode="x unified",
            legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1)
        )
        
        st.plotly_chart(fig, use_container_width=True)

        # Mathematical justification
        with st.expander("Show Actuarial Mathematical Breakdown"):
            st.write("""
            The Standard premium is exacted from the following actuarial formula:
            `Premium = E[Loss] + Risk_Loading(σ) + Expense_Ratio(15%) + Profit_Margin(10%)`
            """)
            
            b1, b2, b3, b4 = st.columns(4)
            b1.metric("1. Pure Premium (E[Loss])", f"₹ {quote['pure_premium']:.1f}")
            b2.metric("2. Risk Buffer", f"₹ {quote['risk_loading']:.1f}")
            b3.metric("3. Ops & Cloud Cost", f"₹ {quote['expense_loading']:.1f}")
            b4.metric("4. Underwriting Profit", f"₹ {quote['profit_margin']:.1f}")
            


if __name__ == "__main__":
    main()
