import pandas as pd

def run_backtest():
    print("=========================================================")
    print(" 🛡️  GIGGUARD PARAMETRIC INSURANCE — FINANCIAL BACKTEST 🛡️ ")
    print("=========================================================")
    
    # 1. Load Data
    try:
        preds = pd.read_csv("weekly_with_predictions.csv")
        actuals = pd.read_csv("historical_weekly_business_logic.csv")
    except FileNotFoundError:
        print("❌ Error: Missing generated data. Ensure the pipeline has finished running completely.")
        return

    # Convert dates
    preds["date"] = pd.to_datetime(preds["date"])
    actuals["date"] = pd.to_datetime(actuals["date"])
    
    # Isolate test period: the model was trained strictly on 2015-2022 data.
    # A true backtest evaluates financial performance on the completely unseen 2023-2025 timeframe.
    preds = preds[preds["date"] >= "2023-01-01"]
    actuals = actuals[actuals["date"] >= "2023-01-01"]

    # 2. Merge Predictions (Premiums) with Actuals (Payouts / Claims)
    merged = pd.merge(
        preds, 
        actuals[["date", "city", "expected_loss_inr"]], 
        on=["date", "city"], 
        how="inner"
    )

    # 3. Calculate Core Insurance Financials
    # In a parametric model:
    # We collect 'estimated_premium_inr' each week based exclusively on the AI's calculation + margin.
    # We pay out 'expected_loss_inr' when the real-world threshold triggers an actual calculated loss.
    
    total_premiums_collected = merged["estimated_premium_inr"].sum()
    total_payouts_made       = merged["expected_loss_inr"].sum()
    
    # Industry benchmark: 
    # Loss ratio < 100% means the insurance is profitable.
    # A "healthy" commercial target for insurtech is typically ~60% to 80% to balance growth/trust with solvency.
    loss_ratio = total_payouts_made / total_premiums_collected if total_premiums_collected > 0 else 0
    net_profit = total_premiums_collected - total_payouts_made

    print("\n[ COMBINED PORTFOLIO PERFORMANCE : 2023 - 2025 ]")
    print("   Evaluating 3 years of completely UNSEEN weather disruptions...\n")
    print(f"  Total Premium Collected : ₹ {total_premiums_collected:,.2f}")
    print(f"  Total Payouts (Claims)  : ₹ {total_payouts_made:,.2f}")
    print(f"  Net Underwriting Profit : ₹ {net_profit:,.2f}")
    print(f"  Overall Portfolio LR    : {loss_ratio*100:.2f}%\n")
    
    # 4. City-wise Breakdown for Actuarial Granularity
    print("-" * 80)
    print(f"  {'City':<14} | {'Premium Collected':<18} | {'Total Payouts':<18} | {'Loss Ratio'}")
    print("-" * 80)
    
    city_grouped = merged.groupby("city").sum(numeric_only=True)
    city_grouped["loss_ratio"] = city_grouped["expected_loss_inr"] / city_grouped["estimated_premium_inr"]
    city_grouped = city_grouped.sort_values("loss_ratio", ascending=False)
    
    for city, row in city_grouped.iterrows():
        # Tag high risk cities to easily visualize the pool's variance
        alert = "⚠️ (Unprofitable)" if row['loss_ratio'] >= 1.0 else ("✅ (Sweet Spot)" if row['loss_ratio'] > 0.6 else "💎 (Highly Profitable)")
        print(f"  {city:<14} | ₹ {row['estimated_premium_inr']:<16,.2f} | ₹ {row['expected_loss_inr']:<16,.2f} | {row['loss_ratio']*100:>6.2f}% {alert}")
    
    print("-" * 80)
    print("\n   Interpretation:")
    print("   Loss Ratio > 100% means claims exceeded premiums (insolvency risk locally).")
    print("   A total healthy Loss Ratio relies heavily on geographic diversification.")

if __name__ == "__main__":
    run_backtest()
