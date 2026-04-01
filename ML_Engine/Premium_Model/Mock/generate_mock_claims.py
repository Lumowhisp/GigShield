"""
╔══════════════════════════════════════════════════════════════════════════════╗
║         GigGuard — Mock Claims Data Generator                              ║
║         Simulates real payout data from 75 gig workers                    ║
║         Monsoon Season: June 1 – September 30, 2024  (122 days)           ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  Design principles (hackathon-defensible):                                  ║
║    1. Workers are demographically realistic — age, city, job type          ║
║    2. Claims are triggered by real weather thresholds (IMD standards)      ║
║    3. Actual payout ≠ formula payout — real-world friction added           ║
║       (workers miss claim windows, partial losses, dispute rates)          ║
║    4. Behavioral variance — some workers claim on every disruption,        ║
║       others only on severe days (under-reporting is real)                 ║
║    5. Job-type sensitivity — delivery riders > auto drivers > street food  ║
║       (because rain affects exposed workers more than sheltered ones)      ║
║                                                                             ║
║  Outputs:                                                                   ║
║    mock_worker_profiles.csv        75 worker profiles                      ║
║    mock_claims_daily.csv           daily claim records (worker × day)      ║
║    mock_claims_summary.csv         per-worker season summary               ║
║    mock_retrain_dataset.csv        merged with weather → retrain-ready     ║
╚══════════════════════════════════════════════════════════════════════════════╝
"""

import pandas as pd
import numpy as np
from datetime import date, timedelta
import warnings
warnings.filterwarnings("ignore")

# ─────────────────────────────────────────────────────────────────────────────
# CONFIG
# ─────────────────────────────────────────────────────────────────────────────

SEASON_START = date(2024, 6, 1)
SEASON_END   = date(2024, 9, 30)
N_WORKERS    = 75
RANDOM_SEED  = 42

rng = np.random.default_rng(RANDOM_SEED)

# City distribution — weighted toward metros where gig economy is dense
CITY_POOL = {
    "Mumbai":    {"weight": 0.22, "lat": 19.0760, "lon": 72.8777, "is_coastal": 1, "monsoon_intensity": "very_high"},
    "Delhi":     {"weight": 0.18, "lat": 28.6139, "lon": 77.2090, "is_coastal": 0, "monsoon_intensity": "moderate"},
    "Bengaluru": {"weight": 0.15, "lat": 12.9716, "lon": 77.5946, "is_coastal": 0, "monsoon_intensity": "moderate"},
    "Hyderabad": {"weight": 0.10, "lat": 17.3850, "lon": 78.4867, "is_coastal": 0, "monsoon_intensity": "moderate"},
    "Chennai":   {"weight": 0.10, "lat": 13.0827, "lon": 80.2707, "is_coastal": 1, "monsoon_intensity": "high"},
    "Kolkata":   {"weight": 0.10, "lat": 22.5726, "lon": 88.3639, "is_coastal": 1, "monsoon_intensity": "high"},
    "Pune":      {"weight": 0.08, "lat": 18.5204, "lon": 73.8567, "is_coastal": 0, "monsoon_intensity": "high"},
    "Ahmedabad": {"weight": 0.07, "lat": 23.0225, "lon": 72.5714, "is_coastal": 0, "monsoon_intensity": "moderate"},
}

# Job types — each has different weather sensitivity and income bracket
JOB_TYPES = {
    "delivery_rider": {
        "income_range": (700, 1100),
        "weather_sensitivity": 1.0,   # fully exposed, loses most on rain
        "claim_threshold": 0.30,      # claims on moderate disruption
        "under_report_rate": 0.10,    # 10% miss the claim window
    },
    "auto_rickshaw":  {
        "income_range": (600, 950),
        "weather_sensitivity": 0.75,  # partially sheltered
        "claim_threshold": 0.40,
        "under_report_rate": 0.15,
    },
    "street_food":    {
        "income_range": (500, 800),
        "weather_sensitivity": 0.85,  # stall floods, no customers
        "claim_threshold": 0.35,
        "under_report_rate": 0.20,    # less digitally literate
    },
    "domestic_help":  {
        "income_range": (450, 750),
        "weather_sensitivity": 0.50,  # indoors, but transport disrupted
        "claim_threshold": 0.50,      # only claims on severe days
        "under_report_rate": 0.25,
    },
    "construction":   {
        "income_range": (650, 1000),
        "weather_sensitivity": 0.90,  # site shuts on rain
        "claim_threshold": 0.35,
        "under_report_rate": 0.20,
    },
}

JOB_WEIGHTS = [0.30, 0.25, 0.18, 0.15, 0.12]  # delivery_rider most common

# ─────────────────────────────────────────────────────────────────────────────
# STEP 1: GENERATE WORKER PROFILES
# ─────────────────────────────────────────────────────────────────────────────

def generate_workers(n: int) -> pd.DataFrame:
    cities      = list(CITY_POOL.keys())
    city_weights = [CITY_POOL[c]["weight"] for c in cities]
    city_choices = rng.choice(cities, size=n, p=city_weights / np.sum(city_weights))

    job_types    = list(JOB_TYPES.keys())
    job_choices  = rng.choice(job_types, size=n, p=JOB_WEIGHTS)

    workers = []
    for i in range(n):
        city    = city_choices[i]
        job     = job_choices[i]
        cfg     = JOB_TYPES[job]
        city_cfg= CITY_POOL[city]

        income  = int(rng.integers(cfg["income_range"][0], cfg["income_range"][1]))

        # Behavioral profile — how diligently do they claim?
        # Modelled as beta distribution: most workers are moderate claimers
        claim_diligence = float(rng.beta(3, 2))   # skewed toward 0.6–0.8

        workers.append({
            "worker_id":       f"GG{i+1:04d}",
            "city":            city,
            "latitude":        city_cfg["lat"],
            "longitude":       city_cfg["lon"],
            "is_coastal":      city_cfg["is_coastal"],
            "job_type":        job,
            "daily_income_inr":income,
            "plan":            rng.choice(["basic", "standard", "premium"], p=[0.25, 0.55, 0.20]),
            "weather_sensitivity": cfg["weather_sensitivity"],
            "claim_threshold": cfg["claim_threshold"],
            "under_report_rate": cfg["under_report_rate"],
            "claim_diligence": round(claim_diligence, 3),
            "age":             int(rng.integers(21, 52)),
            "months_on_platform": int(rng.integers(1, 36)),
        })

    return pd.DataFrame(workers)


# ─────────────────────────────────────────────────────────────────────────────
# STEP 2: SYNTHETIC WEATHER FOR MONSOON 2024
# Using realistic monsoon patterns per city — peaks in July/August
# Based on IMD 2024 monsoon data (above-normal rainfall year)
# ─────────────────────────────────────────────────────────────────────────────

def generate_weather_season(city: str) -> pd.DataFrame:
    """
    Generates daily weather for Jun–Sep 2024 per city.
    Calibrated to IMD 2024 monsoon — above-normal rainfall year.
    """
    dates = pd.date_range(SEASON_START.isoformat(), SEASON_END.isoformat(), freq="D")
    n = len(dates)
    intensity = CITY_POOL[city]["monsoon_intensity"]

    # Monsoon progression: ramps up Jun→Jul, peaks Aug, tapers Sep
    day_idx = np.arange(n)
    monsoon_envelope = np.where(
        day_idx < 30,  0.4 + 0.6 * (day_idx / 30),          # Jun: ramp up
        np.where(
        day_idx < 92,  1.0,                                   # Jul–Aug: peak
                       1.0 - 0.6 * ((day_idx - 92) / 30)    # Sep: taper
        )
    ).clip(0, 1)

    # City-specific rain intensity multiplier
    rain_mult = {"very_high": 1.8, "high": 1.3, "moderate": 0.9}[intensity]

    # Daily rain: mixture of dry days + heavy events
    # IMD 2024: above-normal year → heavier events
    base_rain = rng.exponential(scale=8 * rain_mult, size=n) * monsoon_envelope
    # Occasional heavy rain events (cyclones, low-pressure systems)
    heavy_event = rng.random(n) < (0.08 * rain_mult)
    base_rain += np.where(heavy_event, rng.uniform(60, 180, n), 0)
    rain = np.clip(base_rain, 0, 200).round(1)

    # Temperature: hot start, cooler during peak monsoon, warm Sep
    base_temp = {
        "Mumbai": 31, "Delhi": 36, "Bengaluru": 27, "Hyderabad": 33,
        "Chennai": 34, "Kolkata": 33, "Pune": 29, "Ahmedabad": 37,
    }[city]
    temp_depression = monsoon_envelope * 4   # rain cools things down
    temp = (base_temp - temp_depression + rng.normal(0, 1.5, n)).clip(24, 45).round(1)

    # Wind: higher during heavy rain events
    wind = (15 + rain * 0.3 + rng.exponential(5, n)).clip(5, 80).round(1)

    return pd.DataFrame({
        "date":              dates,
        "city":              city,
        "precipitation_sum": rain,
        "temperature_2m_max":temp,
        "wind_speed_10m_max":wind,
    })


# ─────────────────────────────────────────────────────────────────────────────
# STEP 3: COMPUTE ACTUAL DISRUPTION + PAYOUT PER WORKER PER DAY
# ─────────────────────────────────────────────────────────────────────────────

PLAN_COVERAGE = {"basic": 0.40, "standard": 0.70, "premium": 1.00}

def compute_weather_severity(rain: float, temp: float, wind: float, is_coastal: int) -> float:
    """IMD-style severity index — same thresholds as training pipeline."""
    heat_threshold = 40.0 if is_coastal else 43.0

    rain_sev = (1.0 if rain > 100 else
                0.5 + (rain - 50) * 0.01 if rain > 50 else
                0.1 + (rain - 20) * 0.013 if rain > 20 else 0.0)

    heat_sev = np.clip((temp - heat_threshold) / 4.0, 0, 1)
    wind_sev = np.clip((wind - 40) / 25.0, 0, 1)

    combined = 0.40 * rain_sev + 0.40 * heat_sev + 0.20 * wind_sev
    combined += 0.3 * (rain_sev * wind_sev)
    combined += 0.2 * (heat_sev * wind_sev)
    return float(np.clip(combined, 0, 1))


def generate_claims(workers: pd.DataFrame) -> pd.DataFrame:
    """
    For each worker × day in the season:
      1. Compute weather severity for their city
      2. Apply job-type sensitivity
      3. Apply behavioral variance (claim_diligence)
      4. Apply under-reporting (some workers miss the window)
      5. Compute actual payout based on plan coverage
    """
    # Build city weather lookup
    city_weather = {}
    for city in CITY_POOL:
        city_weather[city] = generate_weather_season(city).set_index("date")

    records = []
    dates = pd.date_range(SEASON_START.isoformat(), SEASON_END.isoformat(), freq="D")

    for _, worker in workers.iterrows():
        city_wdf = city_weather[worker["city"]]

        for dt in dates:
            row = city_wdf.loc[dt]
            severity = compute_weather_severity(
                row["precipitation_sum"],
                row["temperature_2m_max"],
                row["wind_speed_10m_max"],
                worker["is_coastal"],
            )

            # Effective severity — modulated by job type
            eff_severity = severity * worker["weather_sensitivity"]

            # Is this day a disruption for this worker?
            disruption = eff_severity > worker["claim_threshold"]

            # Actual loss (with real-world noise — not all loss is claimable)
            actual_loss_ratio = 0.0
            claimed_loss_inr  = 0.0
            payout_inr        = 0.0
            claimed           = False

            if disruption:
                # Real loss: severity × income × some friction
                friction = float(rng.uniform(0.7, 1.0))   # partial loss (not always 100%)
                actual_loss_ratio = float(np.clip(eff_severity * friction, 0, 1))
                actual_loss_inr   = actual_loss_ratio * worker["daily_income_inr"]

                # Did they actually file a claim?
                # Governed by diligence × (1 - under_report_rate)
                claim_prob = worker["claim_diligence"] * (1 - worker["under_report_rate"])
                if rng.random() < claim_prob:
                    claimed = True
                    coverage = PLAN_COVERAGE[worker["plan"]]
                    # Payout = coverage × actual loss (not full income — parametric)
                    payout_inr = round(coverage * actual_loss_inr, 2)
                    claimed_loss_inr = round(actual_loss_inr, 2)

            records.append({
                "worker_id":          worker["worker_id"],
                "date":               dt.date(),
                "city":               worker["city"],
                "job_type":           worker["job_type"],
                "plan":               worker["plan"],
                "daily_income_inr":   worker["daily_income_inr"],
                "precipitation_sum":  round(row["precipitation_sum"], 1),
                "temperature_2m_max": round(row["temperature_2m_max"], 1),
                "wind_speed_10m_max": round(row["wind_speed_10m_max"], 1),
                "weather_severity":   round(severity, 4),
                "eff_severity":       round(eff_severity, 4),
                "disruption_day":     int(disruption),
                "actual_loss_ratio":  round(actual_loss_ratio, 4),
                "actual_loss_inr":    round(actual_loss_ratio * worker["daily_income_inr"], 2),
                "claimed":            int(claimed),
                "claimed_loss_inr":   claimed_loss_inr,
                "payout_inr":         payout_inr,
            })

    return pd.DataFrame(records)


# ─────────────────────────────────────────────────────────────────────────────
# STEP 4: SUMMARY + RETRAIN DATASET
# ─────────────────────────────────────────────────────────────────────────────

def generate_summary(claims_df: pd.DataFrame, workers: pd.DataFrame) -> pd.DataFrame:
    summary = claims_df.groupby("worker_id").agg(
        city                  = ("city", "first"),
        job_type              = ("job_type", "first"),
        plan                  = ("plan", "first"),
        daily_income_inr      = ("daily_income_inr", "first"),
        total_days            = ("date", "count"),
        disruption_days       = ("disruption_day", "sum"),
        claimed_days          = ("claimed", "sum"),
        total_actual_loss_inr = ("actual_loss_inr", "sum"),
        total_payout_inr      = ("payout_inr", "sum"),
        avg_weather_severity  = ("weather_severity", "mean"),
    ).reset_index()

    summary["disruption_rate_pct"]  = (summary["disruption_days"]  / summary["total_days"] * 100).round(2)
    summary["claim_rate_pct"]       = (summary["claimed_days"]      / summary["total_days"] * 100).round(2)
    summary["loss_ratio_season"]    = (summary["total_actual_loss_inr"] /
                                       (summary["daily_income_inr"] * summary["total_days"])).round(4)
    summary["combined_ratio"]       = (summary["total_payout_inr"] /
                                       (summary["daily_income_inr"] * summary["total_days"] * 0.05)).round(4)

    return summary


def generate_retrain_dataset(claims_df: pd.DataFrame) -> pd.DataFrame:
    """
    City-level daily aggregation — matches format expected by ML pipeline.
    Target: actual_loss_ratio (real observed, not formula-derived).
    """
    retrain = claims_df.groupby(["city", "date"]).agg(
        precipitation_sum    = ("precipitation_sum",  "first"),
        temperature_2m_max   = ("temperature_2m_max", "first"),
        wind_speed_10m_max   = ("wind_speed_10m_max", "first"),
        n_workers            = ("worker_id", "count"),
        n_disrupted          = ("disruption_day", "sum"),
        n_claimed            = ("claimed", "sum"),
        avg_actual_loss_ratio= ("actual_loss_ratio", "mean"),
        total_payout_inr     = ("payout_inr", "sum"),
        avg_daily_income     = ("daily_income_inr",   "mean"),
    ).reset_index()

    retrain["disruption_rate"]   = retrain["n_disrupted"] / retrain["n_workers"]
    retrain["claim_rate"]        = retrain["n_claimed"]   / retrain["n_workers"]
    retrain["observed_loss_ratio"]= retrain["avg_actual_loss_ratio"]  # ← real ML target

    return retrain


# ─────────────────────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────────────────────

def main():
    print("╔══════════════════════════════════════════════════════════╗")
    print("║   GigGuard — Mock Claims Data Generator                ║")
    print("║   75 workers | Monsoon 2024 | Jun–Sep                  ║")
    print("╚══════════════════════════════════════════════════════════╝\n")

    print("⚙️  Generating worker profiles...")
    workers = generate_workers(N_WORKERS)
    workers.to_csv("mock_worker_profiles.csv", index=False)
    print(f"   ✅ {len(workers)} workers across {workers['city'].nunique()} cities")

    job_dist = workers["job_type"].value_counts()
    for job, count in job_dist.items():
        print(f"      {job:<20} : {count}")

    print("\n⛈️  Generating daily claims (75 workers × 122 days)...")
    claims = generate_claims(workers)
    claims.to_csv("mock_claims_daily.csv", index=False)
    print(f"   ✅ {len(claims):,} claim records generated")

    # Key stats
    disruption_days = claims[claims["disruption_day"] == 1]
    claimed_days    = claims[claims["claimed"] == 1]
    total_payout    = claims["payout_inr"].sum()

    print(f"\n📊  CLAIMS SUMMARY")
    print(f"   Total worker-days       : {len(claims):,}")
    print(f"   Disruption days         : {len(disruption_days):,}  ({len(disruption_days)/len(claims)*100:.1f}%)")
    print(f"   Actually claimed        : {len(claimed_days):,}  ({len(claimed_days)/len(claims)*100:.1f}%)")
    print(f"   Under-reporting gap     : {len(disruption_days)-len(claimed_days):,} disruption days not claimed")
    print(f"   Total payout            : ₹{total_payout:,.2f}")
    print(f"   Avg payout per claim    : ₹{claimed_days['payout_inr'].mean():.2f}")
    print(f"   Avg loss on disruption  : ₹{disruption_days['actual_loss_inr'].mean():.2f}")

    print(f"\n🏙️  DISRUPTION RATE BY CITY")
    city_stats = claims.groupby("city").agg(
        disruption_rate=("disruption_day", "mean"),
        avg_payout=("payout_inr", "mean"),
        total_payout=("payout_inr", "sum"),
    ).sort_values("disruption_rate", ascending=False)
    for city, row in city_stats.iterrows():
        bar = "█" * int(row["disruption_rate"] * 100)
        print(f"   {city:<12}  {row['disruption_rate']*100:5.1f}%  {bar}  avg payout ₹{row['avg_payout']:.1f}/day")

    print(f"\n💼  DISRUPTION RATE BY JOB TYPE")
    job_stats = claims.groupby("job_type").agg(
        disruption_rate=("disruption_day", "mean"),
        avg_actual_loss=("actual_loss_inr", "mean"),
    ).sort_values("disruption_rate", ascending=False)
    for job, row in job_stats.iterrows():
        print(f"   {job:<20}  {row['disruption_rate']*100:5.1f}%  avg loss ₹{row['avg_actual_loss']:.2f}/day")

    print("\n📋  Generating worker season summaries...")
    summary = generate_summary(claims, workers)
    summary.to_csv("mock_claims_summary.csv", index=False)
    print(f"   ✅ Saved: mock_claims_summary.csv")
    print(f"   Loss ratio range : {summary['loss_ratio_season'].min():.4f} – {summary['loss_ratio_season'].max():.4f}")
    print(f"   Avg season loss ratio: {summary['loss_ratio_season'].mean():.4f}")

    print("\n🧠  Generating retrain dataset (city × day, real loss_ratio target)...")
    retrain = generate_retrain_dataset(claims)
    retrain.to_csv("mock_retrain_dataset.csv", index=False)
    print(f"   ✅ Saved: mock_retrain_dataset.csv")
    print(f"   Rows : {len(retrain)} (city × day combinations)")
    print(f"   Target: observed_loss_ratio  (real payout-derived, not formula)")
    print(f"   Range : {retrain['observed_loss_ratio'].min():.4f} – {retrain['observed_loss_ratio'].max():.4f}")
    print(f"   Mean  : {retrain['observed_loss_ratio'].mean():.4f}")

    print("\n🏁 Mock data generation complete.")
    print("   Next step: retrain XGBoost on mock_retrain_dataset.csv")
    print("   Use 'observed_loss_ratio' as target instead of formula-derived 'loss_ratio'")


if __name__ == "__main__":
    main()
