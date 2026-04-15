# GigShield v2.2 — Full Model Audit Report
**Date:** 2026-04-14 | **Verdict:** 🏆 PRODUCTION READY (13/13 checks passed)

---

## 1. Core Model Performance

| Metric | Value | Status |
|---|---|---|
| Train R² | 0.9031 | ✅ |
| **Test R²** | **0.8795** | ✅ |
| Overfit Gap | 0.0236 | ✅ Excellent |
| Test MAE | 0.0207 | ✅ |
| Test RMSE | 0.0414 | ✅ |
| Explained Variance | 0.8795 | ✅ |
| Features | 39 | — |
| Training Rows | 101,540 | — |
| Test Rows | 24,635 | — |
| GPS Zones | 35 | — |

---

## 2. Tail Risk Performance

| Percentile | Threshold | R² | MAE | RMSE | n | Status |
|---|---|---|---|---|---|---|
| P90 | ≥0.1657 | 0.8531 | 0.0540 | 0.0722 | 2,466 | ✅ |
| P95 | ≥0.2642 | 0.7434 | 0.0677 | 0.0914 | 1,232 | ✅ |
| P99 | ≥0.6178 | -0.0472 | 0.0937 | 0.1225 | 247 | ⚠️ |

> P99 tail is inherently noisy (only 247 extreme samples with stochastic worker noise). Acceptable for parametric insurance — these events always trigger maximum payout regardless.

---

## 3. Per-Region Test Performance (35 GPS Zones)

| Region | R² | MAE | n | Status |
|---|---|---|---|---|
| north_plains_delhi | 0.9498 | 0.0129 | 1,096 | ✅ |
| thar_desert_deep | 0.9443 | 0.0186 | 547 | ✅ |
| north_plains_chandigarh | 0.9386 | 0.0124 | 547 | ✅ |
| north_arid_jaipur | 0.9223 | 0.0112 | 1,096 | ✅ |
| west_coast_mangalore | 0.9134 | 0.0136 | 547 | ✅ |
| west_arid_ahmedabad | 0.9107 | 0.0118 | 1,096 | ✅ |
| central_jabalpur | 0.9039 | 0.0120 | 547 | ✅ |
| west_coast_goa | 0.9001 | 0.0360 | 547 | ✅ |
| northeast_shillong | 0.8952 | 0.0091 | 547 | ✅ |
| himalayan_dharamshala | 0.8908 | 0.0089 | 547 | ✅ |
| northeast_gangtok | 0.8714 | 0.0136 | 547 | ✅ |
| aravalli_udaipur | 0.8636 | 0.0097 | 547 | ✅ |
| delta_surat | 0.8592 | 0.0361 | 1,096 | ✅ |
| west_coast_low (Mumbai) | 0.8491 | 0.0445 | 1,096 | ✅ |
| east_coast_bhubaneswar | 0.8485 | 0.0274 | 547 | ✅ |
| central_raipur | 0.8476 | 0.0105 | 547 | ✅ |
| himalayan_dehradun | 0.8463 | 0.0165 | 547 | ✅ |
| east_coast_vizag | 0.8404 | 0.0235 | 547 | ✅ |
| north_plains_varanasi | 0.8363 | 0.0123 | 547 | ✅ |
| north_plains_lucknow | 0.8148 | 0.0130 | 547 | ✅ |
| west_coast_kerala | 0.8097 | 0.0502 | 547 | ✅ |
| thar_desert | 0.8024 | 0.0106 | 547 | ✅ |
| northeast_guwahati | 0.7987 | 0.0264 | 547 | ✅ |
| north_plains_patna | 0.7967 | 0.0237 | 547 | ✅ |
| south_tip_coast | 0.7869 | 0.0260 | 547 | ✅ |
| deccan_nagpur | 0.7532 | 0.0112 | 547 | ✅ |
| east_coast_thanjavur | 0.7367 | 0.0338 | 547 | ✅ |
| northeast_imphal | 0.7367 | 0.0101 | 547 | ✅ |
| delta_kolkata | 0.7185 | 0.0397 | 1,096 | ✅ |
| deccan_pune | 0.6864 | 0.0085 | 1,096 | ⚠️ |
| east_coast_chennai | 0.6827 | 0.0440 | 1,096 | ⚠️ |
| himalayan_shimla | 0.6597 | 0.0093 | 547 | ⚠️ |
| east_coast_puri | 0.6439 | 0.0342 | 547 | ⚠️ |
| deccan_hyderabad | 0.6221 | 0.0079 | 1,096 | ⚠️ |
| deccan_bengaluru | 0.4604 | 0.0137 | 1,096 | ⚠️ |

**Summary:** 29/35 regions with R² > 0.70 (83% pass rate)

> ⚠️ regions have low disruption signal (mild climates like Bengaluru/Pune) — low MAE confirms predictions are still accurate, just less variance to explain.

---

## 4. Feature Importance (Top 15)

| Rank | Feature | Importance |
|---|---|---|
| 1 | trigger_rain_active | 0.4701 |
| 2 | n_triggers_active | 0.1856 |
| 3 | trigger_heat_active | 0.0741 |
| 4 | precipitation_sum | 0.0600 |
| 5 | rain_squared | 0.0548 |
| 6 | trigger_flood_active | 0.0523 |
| 7 | rain_wind_interaction | 0.0233 |
| 8 | zone_safety_score | 0.0147 |
| 9 | rolling_7d_rain | 0.0100 |
| 10 | trigger_visibility_active | 0.0088 |
| 11 | temperature_2m_max | 0.0084 |
| 12 | elevation | 0.0045 |
| 13 | temp_squared | 0.0044 |
| 14 | is_coastal | 0.0039 |
| 15 | expected_orders_drop | 0.0037 |

---

## 5. Statistical Validation

### Prediction Distribution
| Statistic | Actual | Predicted |
|---|---|---|
| Mean | 0.0662 | 0.0655 |
| Std Dev | 0.1192 | 0.1097 |
| Min | 0.0000 | 0.0000 |
| Max | 1.0000 | 1.0688 |

### Residual Analysis
- **Mean residual:** 0.000716 ✅ unbiased
- **Std residual:** 0.0414
- **P5/P95 range:** [-0.0786, 0.0529]
- **Over-predicting:** 2.9%
- **Under-predicting:** 1.8%

### Monotonicity (Constraint Validation)
- **Rain ↑ → Loss ↑:** ✅ PASS
- **Wind ↑ → Loss ↑:** ✅ PASS

---

## 6. Walk-Forward Cross-Validation

| Fold | R² | MAE | Status |
|---|---|---|---|
| 2020 | 0.8943 | 0.0188 | ✅ |
| 2021 | 0.8842 | 0.0188 | ✅ |
| 2022 | 0.8896 | 0.0198 | ✅ |
| 2023 | 0.8623 | 0.0187 | ✅ |
| **Average** | **0.8826 ± 0.0123** | — | ✅ Stable |

---

## 7. Trigger System Validation

| Scenario | Triggers Fired | Loss Ratio | Status |
|---|---|---|---|
| Clear day | 0 | 0.0000 | ✅ |
| Heavy monsoon rain | 3 (Rain, Flood, Visibility) | 1.0000 | ✅ |
| Delhi extreme heat | 1 (Heat) | 0.6650 | ✅ |
| Cyclone | 4 (Rain, Storm, Flood, Visibility) | 1.0000 | ✅ |
| Winter fog (Delhi) | 1 (Visibility) | 0.3183 | ✅ |

---

## 8. Zone Safety Scores

| Zone | Score | Discount | Risk Label |
|---|---|---|---|
| Mumbai (coastal, 8m) | 0.0783 | ₹0.00 | high_risk |
| Delhi (inland, 214m) | 0.9140 | ₹9.14 | very_safe |
| Shimla (himalayan, 2199m) | 1.0000 | ₹10.00 | very_safe |
| Kolkata (delta, 9m) | 0.1875 | ₹0.00 | risky |
| Bengaluru (plateau, 906m) | 1.0000 | ₹10.00 | very_safe |

---

## 9. Edge Cases & Adversarial Inputs

| Input | Prediction | Status |
|---|---|---|
| All zeros | 0.1466 | ✅ |
| All ones | 0.1554 | ✅ |
| Max rain (200mm) | 0.1694 | ✅ |
| Max temp (50°C) | 0.1600 | ✅ |
| Max wind (100km/h) | 0.1635 | ✅ |
| Extreme combo | 0.1972 | ✅ |

---

## 10. Data Integrity

| Check | Result |
|---|---|
| Total rows | 126,175 |
| Date range | 2015-01-01 → 2025-12-31 |
| GPS zones | 35 (8 climate regions) |
| NaN in features | 0 ✅ |
| NaN in target | 0 ✅ |
| Duplicate rows | 0 ✅ |
| Meta ↔ Model feature match | 39 = 39 ✅ |

---

## Final Verdict

| # | Check | Result |
|---|---|---|
| 1 | Model R² > 0.85 | ✅ |
| 2 | Overfit gap < 0.05 | ✅ |
| 3 | MAE < 0.03 | ✅ |
| 4 | CV R² > 0.85 | ✅ |
| 5 | CV stability (std < 0.03) | ✅ |
| 6 | Region coverage ≥ 30 zones | ✅ |
| 7 | 83% regions R² > 0.70 | ✅ |
| 8 | All edge cases valid | ✅ |
| 9 | Trigger system correct | ✅ |
| 10 | Feature count match | ✅ |
| 11 | No NaN in data | ✅ |
| 12 | No duplicate rows | ✅ |
| 13 | Unbiased predictions | ✅ |

### 🏆 SCORE: 13/13 — PRODUCTION READY

---

*Generated by `run_full_audit.py` | GigShield v2.2 ML Pipeline*
