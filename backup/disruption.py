"""
╔══════════════════════════════════════════════════════════════════════════╗
║   GigShield v2 — 5 Automated Disruption Triggers                      ║
║   GPS-Portable | Public API Driven | Zero City Dependency              ║
╠══════════════════════════════════════════════════════════════════════════╣
║   Each trigger uses real-time data from Open-Meteo (free, no key).     ║
║   Thresholds calibrated against IMD, NDMA, and WHO standards.          ║
║                                                                        ║
║   Trigger 1: 🌧️  Heavy Rain / Waterlogging                            ║
║   Trigger 2: 🌡️  Extreme Heat / Heat Stress                           ║
║   Trigger 3: 💨  Storm / Cyclone                                       ║
║   Trigger 4: 🌊  Flood Zone Risk (elevation + rain + coast)            ║
║   Trigger 5: 🌫️  Poor Visibility / Smog                               ║
║                                                                        ║
║   Each returns: active, severity (0-1), loss_multiplier, description   ║
╚══════════════════════════════════════════════════════════════════════════╝
"""

import numpy as np
from dataclasses import dataclass


@dataclass
class TriggerResult:
    """Output of a single disruption trigger evaluation."""
    trigger_id: str
    trigger_name: str
    icon: str
    active: bool
    severity: float          # 0.0 to 1.0
    loss_multiplier: float   # fraction of daily income at risk (0-1)
    description: str


# ─────────────────────────────────────────────────────────────────────────────
# TRIGGER 1: HEAVY RAIN / WATERLOGGING
# Source: IMD Orange Alert = 64.5mm+, Red Alert = 115.5mm+
# Also considers accumulated rain (rolling_7d) for waterlogging
# ─────────────────────────────────────────────────────────────────────────────

def trigger_heavy_rain(
    precipitation_mm: float,
    rolling_7d_rain_mm: float,
    elevation_m: float = 100.0,
    is_coastal: bool = False,
) -> TriggerResult:
    """
    Heavy rainfall disruption trigger.
    
    Thresholds (IMD calibrated):
        Orange: >65mm/day → moderate disruption
        Red:    >115mm/day → severe disruption
        Waterlogging: rolling_7d > 200mm with low elevation
    """
    sev = 0.0
    reasons = []

    # Daily intensity scoring
    if precipitation_mm > 115:
        sev = 0.75 + 0.25 * min((precipitation_mm - 115) / 85, 1.0)
        reasons.append(f"Extreme rainfall: {precipitation_mm:.0f}mm (IMD Red Alert)")
    elif precipitation_mm > 65:
        sev = 0.35 + 0.40 * (precipitation_mm - 65) / 50
        reasons.append(f"Heavy rainfall: {precipitation_mm:.0f}mm (IMD Orange Alert)")
    elif precipitation_mm > 30:
        sev = 0.10 + 0.25 * (precipitation_mm - 30) / 35
        reasons.append(f"Moderate rainfall: {precipitation_mm:.0f}mm")

    # Waterlogging amplifier — persistent rain + low elevation
    if rolling_7d_rain_mm > 200 and elevation_m < 50:
        waterlog_boost = 0.20 * min(rolling_7d_rain_mm / 400, 1.0)
        sev += waterlog_boost
        reasons.append(f"Waterlogging risk: {rolling_7d_rain_mm:.0f}mm in 7 days at {elevation_m:.0f}m elevation")

    # Coastal amplifier
    if is_coastal and precipitation_mm > 50:
        sev *= 1.15
        reasons.append("Coastal zone — drainage strain amplified")

    sev = np.clip(sev, 0, 1.0)
    loss_mult = sev * 0.85  # heavy rain → up to 85% income loss

    return TriggerResult(
        trigger_id="heavy_rain",
        trigger_name="Heavy Rain / Waterlogging",
        icon="🌧️",
        active=sev > 0.10,
        severity=round(float(sev), 4),
        loss_multiplier=round(float(loss_mult), 4),
        description="; ".join(reasons) if reasons else "No significant rainfall",
    )


# ─────────────────────────────────────────────────────────────────────────────
# TRIGGER 2: EXTREME HEAT / HEAT STRESS
# Source: IMD Heatwave = +4.5°C above normal OR >40°C (plains), >30°C (coast)
# WHO: heat index > 41°C = danger for outdoor workers
# ─────────────────────────────────────────────────────────────────────────────

def trigger_extreme_heat(
    temp_max: float,
    apparent_temp_max: float,
    rolling_3d_temp: float,
    elevation_m: float = 100.0,
    is_coastal: bool = False,
) -> TriggerResult:
    """
    Extreme heat / heat stress disruption trigger.
    
    Coastal areas: threshold = 38°C (higher humidity makes heat worse)
    Inland/plains: threshold = 42°C
    High altitude:  threshold = 35°C (workers not acclimatized)
    
    Duration matters: 3+ consecutive hot days = heat wave multiplier.
    """
    # GPS-adaptive threshold
    if is_coastal:
        threshold = 38.0   # humidity makes it worse at lower temps
    elif elevation_m > 600:
        threshold = 35.0   # altitude workers less acclimatized
    else:
        threshold = 42.0   # IMD plains heatwave threshold

    sev = 0.0
    reasons = []

    excess = temp_max - threshold
    if excess > 0:
        sev = np.clip(excess / 6.0, 0, 0.8)
        reasons.append(f"Temperature {temp_max:.1f}°C exceeds threshold {threshold:.0f}°C")

    # Apparent temperature check (feels-like with humidity)
    if apparent_temp_max > 45:
        apparent_sev = np.clip((apparent_temp_max - 45) / 8.0, 0, 0.5)
        if apparent_sev > sev:
            sev = max(sev, apparent_sev)
            reasons.append(f"Heat index {apparent_temp_max:.1f}°C (WHO danger zone)")

    # Heat wave amplifier: 3+ day sustained heat
    if rolling_3d_temp > threshold:
        wave_boost = 0.15 * min((rolling_3d_temp - threshold) / 5.0, 1.0)
        sev += wave_boost
        reasons.append(f"Sustained heat wave: 3-day avg {rolling_3d_temp:.1f}°C")

    sev = np.clip(sev, 0, 1.0)
    loss_mult = sev * 0.70  # heat → up to 70% income loss (workers can still do short runs)

    return TriggerResult(
        trigger_id="extreme_heat",
        trigger_name="Extreme Heat / Heat Stress",
        icon="🌡️",
        active=sev > 0.10,
        severity=round(float(sev), 4),
        loss_multiplier=round(float(loss_mult), 4),
        description="; ".join(reasons) if reasons else "Temperature within safe range",
    )


# ─────────────────────────────────────────────────────────────────────────────
# TRIGGER 3: STORM / CYCLONE
# Source: IMD Cyclone Warning = sustained wind > 62 km/h
#         Beaufort Scale 8+ = gale force, dangerous for two-wheelers
# ─────────────────────────────────────────────────────────────────────────────

def trigger_storm(
    wind_speed_max: float,
    wind_gust_max: float,
    precipitation_mm: float,
    is_coastal: bool = False,
) -> TriggerResult:
    """
    Storm / cyclone disruption trigger.
    
    Thresholds:
        Wind > 40 km/h:  dangerous for two-wheelers (moderate)
        Wind > 62 km/h:  IMD cyclone warning (severe)
        Gusts > 80 km/h: extremely dangerous, full shutdown
        Rain + Wind combo: storm amplification
    """
    sev = 0.0
    reasons = []

    # Wind speed severity
    if wind_speed_max > 62:
        sev = 0.65 + 0.35 * min((wind_speed_max - 62) / 38, 1.0)
        reasons.append(f"Cyclonic winds: {wind_speed_max:.0f} km/h (IMD cyclone warning)")
    elif wind_speed_max > 40:
        sev = 0.20 + 0.45 * (wind_speed_max - 40) / 22
        reasons.append(f"Gale-force winds: {wind_speed_max:.0f} km/h (unsafe for two-wheelers)")

    # Gust amplifier
    if wind_gust_max > 80:
        gust_sev = 0.30 * min((wind_gust_max - 80) / 40, 1.0)
        sev += gust_sev
        reasons.append(f"Dangerous gusts: {wind_gust_max:.0f} km/h")

    # Storm combo: rain + wind = exponentially worse
    if precipitation_mm > 30 and wind_speed_max > 35:
        combo = 0.20 * (precipitation_mm / 100) * (wind_speed_max / 60)
        sev += combo
        reasons.append(f"Storm conditions: rain + wind compound effect")

    # Coastal cyclone amplifier
    if is_coastal and wind_speed_max > 50:
        sev *= 1.20
        reasons.append("Coastal zone — cyclone risk elevated")

    sev = np.clip(sev, 0, 1.0)
    loss_mult = sev * 0.90  # storms → up to 90% income loss

    return TriggerResult(
        trigger_id="storm",
        trigger_name="Storm / Cyclone",
        icon="💨",
        active=sev > 0.10,
        severity=round(float(sev), 4),
        loss_multiplier=round(float(loss_mult), 4),
        description="; ".join(reasons) if reasons else "Wind conditions safe",
    )


# ─────────────────────────────────────────────────────────────────────────────
# TRIGGER 4: FLOOD ZONE RISK
# Source: NDMA flood vulnerability = f(elevation, coastal, accumulated rain)
# This is a ZONE-LEVEL risk — same GPS always has same base risk
# Activated when recent rain overwhelms zone capacity
# ─────────────────────────────────────────────────────────────────────────────

def trigger_flood_zone(
    elevation_m: float,
    distance_to_coast_km: float,
    is_coastal: bool,
    rolling_7d_rain_mm: float,
    precipitation_mm: float,
) -> TriggerResult:
    """
    Flood zone risk trigger — GPS-based zone vulnerability.
    
    High risk zones:
        Elevation < 20m + coastal + heavy rain → extreme flood risk
        Elevation < 50m + accumulated rain > 300mm → severe waterlogging
        River basins (low elevation inland) + sustained rain
    
    This trigger powers the "waterlogging safety discount" —
    workers in high-elevation zones get ₹2-5/week off.
    """
    sev = 0.0
    reasons = []

    # Base zone vulnerability (static from GPS)
    zone_vuln = 0.0
    if elevation_m < 10:
        zone_vuln = 0.40
        reasons.append(f"Very low elevation: {elevation_m:.0f}m (severe flood-prone)")
    elif elevation_m < 30:
        zone_vuln = 0.25
        reasons.append(f"Low elevation: {elevation_m:.0f}m (flood-prone)")
    elif elevation_m < 80:
        zone_vuln = 0.10
    # High elevation → near-zero vulnerability (this powers the safety discount)

    # Coastal amplifier
    if is_coastal and distance_to_coast_km < 10:
        zone_vuln += 0.15
        reasons.append(f"Coastal zone: {distance_to_coast_km:.1f}km from coast")

    # Rainfall activation — zone vulnerability × actual rain
    rain_activation = 0.0
    if rolling_7d_rain_mm > 300:
        rain_activation = 0.80
        reasons.append(f"Severe accumulated rain: {rolling_7d_rain_mm:.0f}mm in 7 days")
    elif rolling_7d_rain_mm > 150:
        rain_activation = 0.40 + 0.40 * (rolling_7d_rain_mm - 150) / 150
        reasons.append(f"High accumulated rain: {rolling_7d_rain_mm:.0f}mm in 7 days")
    elif rolling_7d_rain_mm > 80:
        rain_activation = 0.10 + 0.30 * (rolling_7d_rain_mm - 80) / 70

    sev = zone_vuln * (0.3 + 0.7 * rain_activation)  # zone_vuln modulates impact

    # Today's rain surge
    if precipitation_mm > 80 and elevation_m < 50:
        sev += 0.15
        reasons.append(f"Flash flood risk: {precipitation_mm:.0f}mm today at low elevation")

    sev = np.clip(sev, 0, 1.0)
    loss_mult = sev * 0.75  # flooding → up to 75% income loss

    return TriggerResult(
        trigger_id="flood_zone",
        trigger_name="Flood Zone Risk",
        icon="🌊",
        active=sev > 0.08,
        severity=round(float(sev), 4),
        loss_multiplier=round(float(loss_mult), 4),
        description="; ".join(reasons) if reasons else "Zone has low flood risk",
    )


# ─────────────────────────────────────────────────────────────────────────────
# TRIGGER 5: POOR VISIBILITY / SMOG
# Source: Shortwave radiation as cloud/fog proxy
#         Low radiation + high humidity = reduced visibility
#         Common in North India (Nov-Jan) and during monsoon
# ─────────────────────────────────────────────────────────────────────────────

def trigger_poor_visibility(
    shortwave_radiation_mj: float,
    precipitation_mm: float,
    temp_max: float,
    wind_speed_max: float,
) -> TriggerResult:
    """
    Poor visibility / smog disruption trigger.
    
    Uses solar radiation as visibility proxy:
        Normal clear day: 18-26 MJ/m²
        Overcast/rainy:   8-15 MJ/m²
        Dense fog/smog:   < 5 MJ/m²
    
    Winter fog: low temp + low wind + low radiation
    Monsoon murk: heavy rain + low radiation
    """
    sev = 0.0
    reasons = []

    # Very low radiation = dense cloud/fog/smog
    if shortwave_radiation_mj < 3:
        sev = 0.50 + 0.50 * (3 - shortwave_radiation_mj) / 3
        reasons.append(f"Dense fog/smog: radiation {shortwave_radiation_mj:.1f} MJ/m² (severely reduced visibility)")
    elif shortwave_radiation_mj < 6:
        sev = 0.15 + 0.35 * (6 - shortwave_radiation_mj) / 3
        reasons.append(f"Poor visibility: radiation {shortwave_radiation_mj:.1f} MJ/m²")
    elif shortwave_radiation_mj < 10:
        sev = 0.05 + 0.10 * (10 - shortwave_radiation_mj) / 4

    # Winter fog signature: cold + calm + dark
    if temp_max < 15 and wind_speed_max < 10 and shortwave_radiation_mj < 8:
        fog_boost = 0.20
        sev += fog_boost
        reasons.append(f"Winter fog conditions: {temp_max:.0f}°C, calm winds")

    # Monsoon murk: rain + dark
    if precipitation_mm > 20 and shortwave_radiation_mj < 10:
        murk_boost = 0.10 * (precipitation_mm / 80)
        sev += murk_boost
        reasons.append("Monsoon low-visibility conditions")

    sev = np.clip(sev, 0, 1.0)
    loss_mult = sev * 0.45  # poor visibility → up to 45% income loss (slower driving)

    return TriggerResult(
        trigger_id="poor_visibility",
        trigger_name="Poor Visibility / Smog",
        icon="🌫️",
        active=sev > 0.10,
        severity=round(float(sev), 4),
        loss_multiplier=round(float(loss_mult), 4),
        description="; ".join(reasons) if reasons else "Visibility conditions normal",
    )


# ─────────────────────────────────────────────────────────────────────────────
# COMPOSITE EVALUATOR — runs all 5 triggers + compound risk
# ─────────────────────────────────────────────────────────────────────────────

def evaluate_all_triggers(
    precipitation_mm: float,
    temp_max: float,
    apparent_temp_max: float,
    wind_speed_max: float,
    wind_gust_max: float,
    shortwave_radiation_mj: float,
    rolling_7d_rain_mm: float,
    rolling_3d_temp: float,
    elevation_m: float,
    distance_to_coast_km: float,
    is_coastal: bool,
) -> dict:
    """
    Evaluate all 5 disruption triggers and compute composite disruption metrics.
    
    Returns:
        triggers: list of TriggerResult
        any_active: bool
        max_severity: float
        compound_severity: float (with multi-trigger amplification)
        composite_loss_ratio: float (0-1, for ML target / premium calculation)
    """
    t1 = trigger_heavy_rain(precipitation_mm, rolling_7d_rain_mm, elevation_m, is_coastal)
    t2 = trigger_extreme_heat(temp_max, apparent_temp_max, rolling_3d_temp, elevation_m, is_coastal)
    t3 = trigger_storm(wind_speed_max, wind_gust_max, precipitation_mm, is_coastal)
    t4 = trigger_flood_zone(elevation_m, distance_to_coast_km, is_coastal, rolling_7d_rain_mm, precipitation_mm)
    t5 = trigger_poor_visibility(shortwave_radiation_mj, precipitation_mm, temp_max, wind_speed_max)

    triggers = [t1, t2, t3, t4, t5]
    active_triggers = [t for t in triggers if t.active]
    n_active = len(active_triggers)

    if n_active == 0:
        return {
            "triggers": triggers,
            "any_active": False,
            "n_active": 0,
            "max_severity": 0.0,
            "compound_severity": 0.0,
            "composite_loss_ratio": 0.0,
        }

    max_sev = max(t.severity for t in active_triggers)
    max_loss = max(t.loss_multiplier for t in active_triggers)

    # Compound risk: multiple simultaneous triggers are worse than the sum
    # 2 triggers: 1.3x, 3 triggers: 1.6x, 4+: 2.0x
    compound_factor = 1.0
    if n_active >= 4:
        compound_factor = 2.0
    elif n_active == 3:
        compound_factor = 1.6
    elif n_active == 2:
        compound_factor = 1.3

    compound_sev = np.clip(max_sev * compound_factor, 0, 1.0)

    # Composite loss ratio — the final disruption measure
    # Uses the WORST trigger's loss multiplier, amplified by compound factor
    composite_loss = np.clip(max_loss * compound_factor, 0, 1.0)

    return {
        "triggers": triggers,
        "any_active": True,
        "n_active": n_active,
        "max_severity": round(float(max_sev), 4),
        "compound_severity": round(float(compound_sev), 4),
        "composite_loss_ratio": round(float(composite_loss), 4),
    }


def compute_zone_safety_score(elevation_m: float, distance_to_coast_km: float, is_coastal: bool) -> dict:
    """
    Static zone safety assessment from GPS coordinates.
    Used for waterlogging safety discount in dynamic pricing.
    
    Returns:
        score: 0-1 (1 = very safe, 0 = very risky)
        discount_per_week_inr: ₹0-10 weekly discount for safe zones
        risk_label: str
    """
    score = 0.5  # neutral baseline

    # Elevation component (40% weight)
    if elevation_m > 300:
        elev_score = 1.0
    elif elevation_m > 100:
        elev_score = 0.5 + 0.5 * (elevation_m - 100) / 200
    elif elevation_m > 30:
        elev_score = 0.2 + 0.3 * (elevation_m - 30) / 70
    else:
        elev_score = max(0, elevation_m / 30) * 0.2

    # Coastal component (30% weight)
    if distance_to_coast_km > 100:
        coast_score = 1.0
    elif distance_to_coast_km > 50:
        coast_score = 0.5 + 0.5 * (distance_to_coast_km - 50) / 50
    else:
        coast_score = distance_to_coast_km / 50 * 0.5

    # Drainage proxy (30% weight) — higher elevation = better drainage
    drain_score = np.clip(elevation_m / 200, 0, 1.0)

    score = 0.40 * elev_score + 0.30 * coast_score + 0.30 * drain_score
    score = round(float(np.clip(score, 0, 1.0)), 4)

    # Discount calculation: max ₹10/week for safest zones
    discount = round(score * 10.0, 2) if score > 0.5 else 0.0

    # Risk label
    if score > 0.75:
        label = "very_safe"
    elif score > 0.50:
        label = "safe"
    elif score > 0.30:
        label = "moderate"
    elif score > 0.15:
        label = "risky"
    else:
        label = "high_risk"

    return {
        "zone_safety_score": score,
        "waterlogging_risk": label,
        "weekly_discount_inr": discount,
    }
