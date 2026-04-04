"""
Export the production XGBRegressor model for Streamlit inference.

Loads the pure ML feature matrix, trains the model with identical
hyperparameters as the evaluation pipeline, and exports a single
gigguard_model.pkl file containing the model + feature column list.

Run: python export_models.py
"""

import pandas as pd
import joblib
from xgboost import XGBRegressor


def export():
    print("╔══════════════════════════════════════════════╗")
    print("║  GigGuard — Exporting Production Model      ║")
    print("╚══════════════════════════════════════════════╝\n")

    print("  → Loading ml_features_pure.csv...")
    df = pd.read_csv("ml_features_pure.csv")

    targets = df["loss_ratio"].values
    features_df = df.drop(columns=[
        "date", "city", "expected_loss_inr", "loss_ratio", 
        "daily_income_inr", "disruption_occurred"
    ], errors='ignore')
    cols = features_df.columns.tolist()
    X = features_df.fillna(0).values

    print(f"  → Training XGBRegressor ({len(cols)} features, {len(X):,} rows)...")

    mc = []
    for f in cols:
        if any(k in f for k in ["rain", "precipitation", "wind", "storm"]):
            mc.append(1)
        else:
            mc.append(0)
    mc_tuple = tuple(mc)

    model = XGBRegressor(
        n_estimators=300,
        learning_rate=0.05,
        max_depth=5,
        subsample=0.8,
        colsample_bytree=0.8,
        reg_lambda=2,
        random_state=42,
        monotone_constraints=mc_tuple
    )
    model.fit(X, targets)

    # Save single production payload
    payload = {"model": model, "features": cols}
    joblib.dump(payload, "gigguard_model.pkl")

    print(f"  ✅ Saved gigguard_model.pkl")
    print(f"     Features : {len(cols)}")
    print(f"     Rows     : {len(X):,}")
    print(f"\n  Usage: payload = joblib.load('gigguard_model.pkl')")
    print(f"         model, features = payload['model'], payload['features']")


if __name__ == "__main__":
    export()
