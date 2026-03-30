"""
╔══════════════════════════════════════════════════════════════════════════════╗
║  GigGuard — Stress Testing Suite (v4)                                      ║
║  Tests model behavior under extreme weather scenarios + sensitivity ramps   ║
║  Uses pure ML model only — no risk_score dependency                         ║
╚══════════════════════════════════════════════════════════════════════════════╝
"""

import pandas as pd
import joblib


def main():
    print("=========================================================")
    print(" 🚨  GIGGUARD STRESS TESTING v4 (EXTREME SCENARIOS)")
    print("=========================================================\n")

    print("⏳ Loading production model...")
    try:
        payload = joblib.load("gigguard_model.pkl")
        model = payload["model"]
        feature_cols = payload["features"]
    except FileNotFoundError:
        print("❌ Cannot find gigguard_model.pkl. Run export_models.py first.")
        return

    print(f"✅ Model loaded — {len(feature_cols)} features\n")

    def simulate(name, case_dict):
        """Run a single stress scenario through the model."""
        row = {}
        for col in feature_cols:
            if col.startswith("city_"):
                row[col] = case_dict.get(col, 0)
            else:
                row[col] = case_dict.get(col, 0.0)

        test_df = pd.DataFrame([row])[feature_cols]
        pred = model.predict(test_df.values)[0]

        print("=" * 65)
        print(f"🔥 SCENARIO: {name}")
        print("-" * 65)
        print(f"  🌧️ Rain            : {case_dict.get('precipitation_sum', 0):>5} mm")
        print(f"  🌡️ Temperature     : {case_dict.get('temperature_2m_max', 0):>5} °C")
        print(f"  💨 Wind Speed      : {case_dict.get('wind_speed_10m_max', 0):>5} km/h")
        print(f"  🌊 7-Day Rain Base : {case_dict.get('rolling_7d_rain', 0):>5} mm")
        print(f"  🌊 Tail Event      : {'YES ⚠️' if case_dict.get('tail_event', 0) else 'no'}")

        print(f"\n👉 PREDICTED DAILY LOSS : ₹ {max(0, pred):.2f}")
        print("=" * 65 + "\n")
        return max(0, pred)

    # ---------------------------------------------------------
    # SCENARIO 1: Heavy Flood (Mumbai Monsoon)
    # IMD Orange Alert: >115mm rain, strong wind
    # ---------------------------------------------------------
    simulate("HEAVY FLOOD OUTBREAK (Mumbai — IMD Orange Alert)", {
        "city_Mumbai": 1,
        "sin_time": 0.5,
        "cos_time": 0.5,
        "seasonal_factor": 1.1,
        "precipitation_sum": 120,
        "precipitation_hours": 20,
        "temperature_2m_max": 28,
        "apparent_temperature_max": 31,
        "wind_speed_10m_max": 45,
        "wind_gusts_10m_max": 65,
        "shortwave_radiation_sum": 4,
        "rolling_7d_rain": 250,
        "rolling_3d_temp": 30,
        "rain_wind_interaction": 120 * 45,
        "rain_squared": 120 ** 2,
        "wind_squared": 45 ** 2,
        "temp_squared": 28 ** 2,
        "rain_wind_ratio": 120 / (45 + 1),
        "heat_index_proxy": 28 * 0.8,
        "tail_event": 1,
    })

    # ---------------------------------------------------------
    # SCENARIO 2: Perfect Clear Weather
    # No disruption — loss should be ~₹0
    # ---------------------------------------------------------
    simulate("PERFECT CLEAR WEATHER (Mumbai)", {
        "city_Mumbai": 1,
        "sin_time": 0.5,
        "cos_time": 0.5,
        "seasonal_factor": 1.0,
        "precipitation_sum": 0,
        "precipitation_hours": 0,
        "temperature_2m_max": 25,
        "apparent_temperature_max": 26,
        "wind_speed_10m_max": 10,
        "wind_gusts_10m_max": 15,
        "shortwave_radiation_sum": 20,
        "rolling_7d_rain": 0,
        "rolling_3d_temp": 25,
        "rain_wind_interaction": 0,
        "rain_squared": 0,
        "wind_squared": 100,
        "temp_squared": 625,
        "rain_wind_ratio": 0,
        "heat_index_proxy": 25 * 0.1,
        "tail_event": 0,
    })

    # ---------------------------------------------------------
    # SCENARIO 3: Lethal Delhi Heatwave
    # NDMA threshold: >45°C for plains
    # ---------------------------------------------------------
    simulate("SEVERE HEATWAVE (Delhi — NDMA Alert)", {
        "city_Delhi": 1,
        "sin_time": 0.8,
        "cos_time": 0.2,
        "seasonal_factor": 1.1,
        "precipitation_sum": 0,
        "precipitation_hours": 0,
        "temperature_2m_max": 48,
        "apparent_temperature_max": 52,
        "wind_speed_10m_max": 15,
        "wind_gusts_10m_max": 22,
        "shortwave_radiation_sum": 25,
        "rolling_7d_rain": 0,
        "rolling_3d_temp": 46,
        "rain_wind_interaction": 0,
        "rain_squared": 0,
        "wind_squared": 225,
        "temp_squared": 48 ** 2,
        "rain_wind_ratio": 0,
        "heat_index_proxy": 48 * 0.0,
        "tail_event": 1,
    })

    # ---------------------------------------------------------
    # SCENARIO 4: Cyclone Landfall (Chennai)
    # Combined rain + wind — compound effect
    # ---------------------------------------------------------
    simulate("CYCLONE LANDFALL (Chennai — Compound Event)", {
        "city_Chennai": 1,
        "sin_time": -0.3,
        "cos_time": 0.95,
        "seasonal_factor": 1.0,
        "precipitation_sum": 150,
        "precipitation_hours": 24,
        "temperature_2m_max": 30,
        "apparent_temperature_max": 33,
        "wind_speed_10m_max": 80,
        "wind_gusts_10m_max": 120,
        "shortwave_radiation_sum": 2,
        "rolling_7d_rain": 400,
        "rolling_3d_temp": 29,
        "rain_wind_interaction": 150 * 80,
        "rain_squared": 150 ** 2,
        "wind_squared": 80 ** 2,
        "temp_squared": 30 ** 2,
        "rain_wind_ratio": 150 / (80 + 1),
        "heat_index_proxy": 30 * 0.9,
        "tail_event": 1,
    })

    # ---------------------------------------------------------
    # LEVEL 3: SENSITIVITY TESTING
    # Gradually increase rain to validate monotonic response
    # ---------------------------------------------------------
    print("=========================================================")
    print(" 🧠  LEVEL 3: SENSITIVITY TESTING (RAIN RAMP)")
    print("=========================================================")
    print("  Gradually increasing rain on a standard day in Mumbai...\n")

    base_case = {
        "city_Mumbai": 1,
        "sin_time": 0.5,
        "cos_time": 0.5,
        "seasonal_factor": 1.0,
        "temperature_2m_max": 28,
        "wind_speed_10m_max": 15,
        "rolling_7d_rain": 10,
        "rolling_3d_temp": 28,
        "tail_event": 0,
    }

    row = {}
    for col in feature_cols:
        if col.startswith("city_"):
            row[col] = base_case.get(col, 0)
        else:
            row[col] = base_case.get(col, 0.0)

    test_df = pd.DataFrame([row])[feature_cols]

    prev_loss = -1
    monotonic = True

    for rain in [0, 10, 20, 40, 60, 80, 100, 120, 150, 200]:
        test_df["precipitation_sum"] = rain
        test_df["rain_squared"] = rain ** 2
        test_df["rain_wind_interaction"] = rain * 15
        test_df["rain_wind_ratio"] = rain / (15 + 1)
        test_df["tail_event"] = 1 if rain > 100 else 0

        pred = model.predict(test_df.values)[0]
        loss = max(0, pred)

        bar = "█" * int(loss / 20)
        check = "↗️" if loss >= prev_loss else "⚠️ NON-MONOTONIC"
        if loss < prev_loss:
            monotonic = False

        print(f"  🌧️ Rain: {rain:>3} mm  →  💸 Loss: ₹ {loss:>7.2f}  {bar}  {check}")
        prev_loss = loss

    print(f"\n  Monotonicity check: {'✅ PASSED — loss increases with rain' if monotonic else '⚠️ FAILED — model has non-monotonic regions'}")

    # Temperature sensitivity
    print("\n" + "=" * 65)
    print(" 🌡️  SENSITIVITY: TEMPERATURE RAMP (Delhi)")
    print("=" * 65 + "\n")

    base_case_temp = {
        "city_Delhi": 1,
        "sin_time": 0.8,
        "cos_time": 0.2,
        "seasonal_factor": 1.1,
        "precipitation_sum": 0,
        "wind_speed_10m_max": 10,
        "rolling_7d_rain": 0,
        "rolling_3d_temp": 30,
        "tail_event": 0,
    }

    row_t = {}
    for col in feature_cols:
        if col.startswith("city_"):
            row_t[col] = base_case_temp.get(col, 0)
        else:
            row_t[col] = base_case_temp.get(col, 0.0)

    test_df_t = pd.DataFrame([row_t])[feature_cols]

    for temp in [25, 30, 35, 38, 40, 42, 44, 46, 48, 50]:
        test_df_t["temperature_2m_max"] = temp
        test_df_t["apparent_temperature_max"] = temp + 3
        test_df_t["temp_squared"] = temp ** 2
        test_df_t["rolling_3d_temp"] = temp
        test_df_t["heat_index_proxy"] = temp * 0.1
        test_df_t["tail_event"] = 1 if temp > 45 else 0

        pred = model.predict(test_df_t.values)[0]
        loss = max(0, pred)
        bar = "█" * int(loss / 20)
        print(f"  🌡️ Temp: {temp:>3} °C  →  💸 Loss: ₹ {loss:>7.2f}  {bar}")

    print("\n" + "=" * 65 + "\n")


if __name__ == "__main__":
    main()
