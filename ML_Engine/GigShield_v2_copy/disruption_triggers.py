"""
╔══════════════════════════════════════════════════════════════════════════╗
║   GigShield v2.1 — 5 Automated Disruption Triggers                    ║
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
║                                                                        ║
║   v2.1 FIX: Improved sensitivity for:                                  ║
║     - Sub-Himalayan transition zones (Chandigarh-type)                 ║
║     - Deccan plateau moderate-climate zones (Hyderabad-type)           ║
║     - Ganges river basin flood plains (Patna-type)                     ║
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
#
# v2.1: Added sensitivity for moderate rain at poorly-drained elevations
#       and river basin zones where even 20mm causes urban flooding
# ─────────────────────────────────────────────────────────────────────────────

def trigger_heavy_rain(
    precipitation_mm: float,
    rolling_7d_rain_mm: float,
    elevation_m: float = 100.0,
    is_coastal: bool = False,
    latitude: float = 20.0,
) -> TriggerResult:
    """
    Heavy rainfall disruption trigger.
    
    Thresholds (IMD calibrated):
        Orange: >65mm/day → moderate disruption
        Red:    >115mm/day → severe disruption
        Waterlogging: rolling_7d > 200mm with low elevation
    
    v2.1: Added zone-adaptive thresholds:
        - River basin plains (Patna-type, <80m, lat 24-28): lower flood threshold
        - Plateau zones (Hyderabad-type): moderate rain + poor drainage
        - Sub-Himalayan (Chandigarh-type): mountain runoff amplifier
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
    elif precipitation_mm > 15 and elevation_m < 80:
        # v2.1: Low-elevation zones get disrupted even by moderate rain
        # (poor drainage, waterlogging in urban areas — Patna, Lucknow, etc.)
        sev = 0.05 + 0.08 * (precipitation_mm - 15) / 15
        reasons.append(f"Light rain in flood-prone zone: {precipitation_mm:.0f}mm at {elevation_m:.0f}m")

    # Waterlogging amplifier — persistent rain + low elevation
    if rolling_7d_rain_mm > 200 and elevation_m < 50:
        waterlog_boost = 0.20 * min(rolling_7d_rain_mm / 400, 1.0)
        sev += waterlog_boost
        reasons.append(f"Waterlogging risk: {rolling_7d_rain_mm:.0f}mm in 7 days at {elevation_m:.0f}m elevation")
    elif rolling_7d_rain_mm > 100 and elevation_m < 80:
        # v2.1: River basin plains (Patna, Varanasi) — lower waterlogging threshold
        waterlog_boost = 0.10 * min(rolling_7d_rain_mm / 300, 1.0)
        sev += waterlog_boost
        reasons.append(f"Accumulated rain in low-elevation zone: {rolling_7d_rain_mm:.0f}mm over 7 days")

    # Coastal amplifier
    if is_coastal and precipitation_mm > 50:
        sev *= 1.15
        reasons.append("Coastal zone — drainage strain amplified")

    # v2.1: Sub-Himalayan runoff amplifier — mountain catchment zones
    # These areas get flash floods from upstream rain even with moderate local rainfall
    if latitude > 28 and elevation_m < 400 and precipitation_mm > 25:
        runoff_boost = 0.08 * min(precipitation_mm / 60, 1.0)
        sev += runoff_boost
        reasons.append(f"Sub-Himalayan runoff zone — mountain drainage amplifier")

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
#
# v2.1: Added sub-Himalayan threshold (39°C) and plateau humidity stress
# ─────────────────────────────────────────────────────────────────────────────

def trigger_extreme_heat(
    temp_max: float,
    apparent_temp_max: float,
    rolling_3d_temp: float,
    elevation_m: float = 100.0,
    is_coastal: bool = False,
    latitude: float = 20.0,
    distance_to_coast_km: float = 100.0,
) -> TriggerResult:
    """
    Extreme heat / heat stress disruption trigger.
    
    v2.1 GPS-adaptive thresholds:
        Coastal:           38°C (high humidity makes heat worse at lower temps)
        Sub-Himalayan:     39°C (lat>28, elev 200-600m — workers not acclimatized)
        Inland plateau:    40°C (Deccan — humidity + moderate altitude)
        High altitude:     35°C (>600m — workers not acclimatized)
        Arid/dry inland:   43°C (dry heat, workers more resilient)
        Default plains:    42°C (IMD standard)
    
    Duration matters: 3+ consecutive hot days = heat wave multiplier.
    """
    # GPS-adaptive threshold — v2.1 EXPANDED
    if is_coastal:
        threshold = 38.0   # humidity makes it worse at lower temps
    elif elevation_m > 600:
        threshold = 35.0   # altitude workers less acclimatized
    elif latitude > 28 and elevation_m > 200:
        # v2.1: Sub-Himalayan transition zones (Chandigarh, Dehradun outskirts)
        # These get humid heat from plains + altitude discomfort
        threshold = 39.0
    elif elevation_m > 400 and distance_to_coast_km > 100:
        # v2.1: Deccan plateau (Hyderabad, Bengaluru)
        # Moderate elevation but high humidity during pre-monsoon
        threshold = 40.0
    elif distance_to_coast_km > 300 and latitude > 24:
        # Arid zones (Jodhpur, Bikaner) — dry heat, workers more resilient
        threshold = 43.0
    else:
        threshold = 42.0   # IMD plains heatwave threshold

    sev = 0.0
    reasons = []

    excess = temp_max - threshold
    if excess > 0:
        sev = np.clip(excess / 6.0, 0, 0.8)
        reasons.append(f"Temperature {temp_max:.1f}°C exceeds threshold {threshold:.0f}°C")
    elif excess > -2:
        # v2.1: Near-threshold stress — captures 40-42°C for 42°C threshold zones
        # This is crucial for Chandigarh/Hyderabad where temps hover just below
        near_sev = 0.05 * (2 + excess) / 2  # 0 to 0.05 linear ramp
        if near_sev > 0:
            sev = near_sev
            reasons.append(f"Near-threshold heat: {temp_max:.1f}°C (threshold {threshold:.0f}°C)")

    # Apparent temperature check (feels-like with humidity)
    if apparent_temp_max > 43:
        # v2.1: Lowered from 45 to 43 — captures more humid heat events
        apparent_sev = np.clip((apparent_temp_max - 43) / 8.0, 0, 0.6)
        if apparent_sev > sev:
            sev = max(sev, apparent_sev)
            reasons.append(f"Heat index {apparent_temp_max:.1f}°C (WHO danger zone)")

    # Heat wave amplifier: 3+ day sustained heat
    if rolling_3d_temp > threshold:
        wave_boost = 0.15 * min((rolling_3d_temp - threshold) / 5.0, 1.0)
        sev += wave_boost
        reasons.append(f"Sustained heat wave: 3-day avg {rolling_3d_temp:.1f}°C")
    elif rolling_3d_temp > threshold - 2:
        # v2.1: Near-threshold sustained heat also stresses workers
        wave_boost = 0.05 * min((rolling_3d_temp - (threshold - 2)) / 2.0, 1.0)
        sev += wave_boost
        reasons.append(f"Persistent near-threshold heat: 3-day avg {rolling_3d_temp:.1f}°C")

    sev = np.clip(sev, 0, 1.0)
    loss_mult = sev * 0.70  # heat → up to 70% income loss (workers can still do short runs)

    return TriggerResult(
        trigger_id="extreme_heat",
        trigger_name="Extreme Heat / Heat Stress",
        icon="🌡️",
        active=sev > 0.08,  # v2.1: lowered from 0.10 to catch near-threshold
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
    elif wind_speed_max > 30:
        # v2.1: Moderate wind — still risky for two-wheelers in rain
        if precipitation_mm > 10:
            sev = 0.08 + 0.12 * (wind_speed_max - 30) / 10
            reasons.append(f"Moderate winds with rain: {wind_speed_max:.0f} km/h")

    # Gust amplifier
    if wind_gust_max > 80:
        gust_sev = 0.30 * min((wind_gust_max - 80) / 40, 1.0)
        sev += gust_sev
        reasons.append(f"Dangerous gusts: {wind_gust_max:.0f} km/h")
    elif wind_gust_max > 60:
        # v2.1: moderate gusts
        gust_sev = 0.10 * min((wind_gust_max - 60) / 20, 1.0)
        sev += gust_sev
        reasons.append(f"Strong gusts: {wind_gust_max:.0f} km/h")

    # Storm combo: rain + wind = exponentially worse
    if precipitation_mm > 30 and wind_speed_max > 35:
        combo = 0.20 * (precipitation_mm / 100) * (wind_speed_max / 60)
        sev += combo
        reasons.append(f"Storm conditions: rain + wind compound effect")
    elif precipitation_mm > 15 and wind_speed_max > 25:
        # v2.1: lighter storm combo for moderate conditions
        combo = 0.08 * (precipitation_mm / 60) * (wind_speed_max / 40)
        sev += combo

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
#
# v2.1: Much more sensitive for river basin plains (Patna, Varanasi, Lucknow)
#       Added river proximity proxy using latitude bands + low elevation
# ─────────────────────────────────────────────────────────────────────────────

def trigger_flood_zone(
    elevation_m: float,
    distance_to_coast_km: float,
    is_coastal: bool,
    rolling_7d_rain_mm: float,
    precipitation_mm: float,
    latitude: float = 20.0,
) -> TriggerResult:
    """
    Flood zone risk trigger — GPS-based zone vulnerability.
    
    v2.1 improvements:
        - River basin detection using lat/lon + elevation proxy
        - Lower thresholds for Gangetic plain (lat 24-28, elev <80m)
        - Gradual activation instead of hard cutoffs
    """
    sev = 0.0
    reasons = []

    # ── Base zone vulnerability (static from GPS) ──
    zone_vuln = 0.0

    # Detect river basin plains (Ganges, Brahmaputra)
    # Lat 24-28, low elevation, far from coast = Gangetic flood plain
    is_river_basin = (
        24 < latitude < 28 and
        elevation_m < 80 and
        distance_to_coast_km > 200
    )

    if elevation_m < 10:
        zone_vuln = 0.45
        reasons.append(f"Very low elevation: {elevation_m:.0f}m (severe flood-prone)")
    elif elevation_m < 30:
        zone_vuln = 0.30
        reasons.append(f"Low elevation: {elevation_m:.0f}m (flood-prone)")
    elif elevation_m < 80:
        zone_vuln = 0.15 if is_river_basin else 0.10
        if is_river_basin:
            reasons.append(f"River basin zone: {elevation_m:.0f}m (Gangetic plain)")
    # High elevation → near-zero vulnerability (this powers the safety discount)

    # v2.1: River basin amplifier — these areas flood from UPSTREAM rain
    if is_river_basin:
        zone_vuln += 0.10
        reasons.append(f"Riverine flood zone: upstream catchment risk")

    # Coastal amplifier
    if is_coastal and distance_to_coast_km < 10:
        zone_vuln += 0.15
        reasons.append(f"Coastal zone: {distance_to_coast_km:.1f}km from coast")

    # ── Rainfall activation — zone vulnerability × actual rain ──
    rain_activation = 0.0

    # v2.1: Different rain thresholds for river basins vs normal
    if is_river_basin:
        # River basins flood at much lower rain thresholds
        if rolling_7d_rain_mm > 150:
            rain_activation = 0.80
            reasons.append(f"Severe flood risk: {rolling_7d_rain_mm:.0f}mm in 7 days (river basin)")
        elif rolling_7d_rain_mm > 80:
            rain_activation = 0.40 + 0.40 * (rolling_7d_rain_mm - 80) / 70
            reasons.append(f"High flood risk: {rolling_7d_rain_mm:.0f}mm in 7 days (river basin)")
        elif rolling_7d_rain_mm > 40:
            rain_activation = 0.15 + 0.25 * (rolling_7d_rain_mm - 40) / 40
            reasons.append(f"Moderate flood risk: {rolling_7d_rain_mm:.0f}mm accumulated (river basin)")
    else:
        # Standard thresholds
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
    elif precipitation_mm > 40 and is_river_basin:
        # v2.1: River basins flash-flood at lower thresholds
        sev += 0.10
        reasons.append(f"Flash flood risk: {precipitation_mm:.0f}mm today in river basin")

    sev = np.clip(sev, 0, 1.0)
    loss_mult = sev * 0.80  # v2.1: raised from 0.75 — flooding is devastating

    return TriggerResult(
        trigger_id="flood_zone",
        trigger_name="Flood Zone Risk",
        icon="🌊",
        active=sev > 0.06,  # v2.1: lowered from 0.08 for gradual activation
        severity=round(float(sev), 4),
        loss_multiplier=round(float(loss_mult), 4),
        description="; ".join(reasons) if reasons else "Zone has low flood risk",
    )


# ─────────────────────────────────────────────────────────────────────────────
# TRIGGER 5: POOR VISIBILITY / SMOG
# Source: Shortwave radiation as cloud/fog proxy
#         Low radiation + high humidity = reduced visibility
#         Common in North India (Nov-Jan) and during monsoon
#
# v2.1: Added dust storm detection for Deccan/arid zones
#       Better winter smog detection for Indo-Gangetic plain
# ─────────────────────────────────────────────────────────────────────────────

def trigger_poor_visibility(
    shortwave_radiation_mj: float,
    precipitation_mm: float,
    temp_max: float,
    wind_speed_max: float,
    latitude: float = 20.0,
    elevation_m: float = 100.0,
) -> TriggerResult:
    """
    Poor visibility / smog disruption trigger.
    
    Uses solar radiation as visibility proxy:
        Normal clear day: 18-26 MJ/m²
        Overcast/rainy:   8-15 MJ/m²
        Dense fog/smog:   < 5 MJ/m²
    
    v2.1: Added dust/haze for Deccan plateau and Indo-Gangetic smog
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
    elif temp_max < 20 and wind_speed_max < 12 and shortwave_radiation_mj < 10:
        # v2.1: Moderate fog — common in Chandigarh, Lucknow, Patna winters
        fog_boost = 0.10
        sev += fog_boost
        reasons.append(f"Morning fog conditions: {temp_max:.0f}°C, light winds")

    # v2.1: Indo-Gangetic winter smog (lat 24-30, Oct-Feb proxy via low radiation + moderate temp)
    if latitude > 24 and latitude < 31 and temp_max < 25 and shortwave_radiation_mj < 12:
        smog_boost = 0.08 * (12 - shortwave_radiation_mj) / 12
        sev += smog_boost
        reasons.append(f"Indo-Gangetic haze: radiation {shortwave_radiation_mj:.1f} MJ/m²")

    # v2.1: Dust/haze for Deccan plateau and arid zones
    # Hot + moderate wind + low radiation (but no rain) = dust storm
    if temp_max > 35 and wind_speed_max > 20 and shortwave_radiation_mj < 15 and precipitation_mm < 1:
        dust_sev = 0.12 * min(wind_speed_max / 40, 1.0)
        sev += dust_sev
        reasons.append(f"Dust haze: hot ({temp_max:.0f}°C), windy ({wind_speed_max:.0f} km/h), dry")

    # Monsoon murk: rain + dark
    if precipitation_mm > 20 and shortwave_radiation_mj < 10:
        murk_boost = 0.10 * (precipitation_mm / 80)
        sev += murk_boost
        reasons.append("Monsoon low-visibility conditions")

    sev = np.clip(sev, 0, 1.0)
    loss_mult = sev * 0.50  # v2.1: raised from 0.45 — visibility kills commute time

    return TriggerResult(
        trigger_id="poor_visibility",
        trigger_name="Poor Visibility / Smog",
        icon="🌫️",
        active=sev > 0.08,  # v2.1: lowered from 0.10
        severity=round(float(sev), 4),
        loss_multiplier=round(float(loss_mult), 4),
        description="; ".join(reasons) if reasons else "Visibility conditions normal",
    )


# ─────────────────────────────────────────────────────────────────────────────
# NEW: DELHI NCR AQI TRIGGER (Hackathon Deliverable)
# ─────────────────────────────────────────────────────────────────────────────
def trigger_severe_aqi(
    latitude: float,
    longitude: float,
    shortwave_radiation_mj: float, 
    rolling_3d_temp: float,
    wind_speed_max: float
) -> TriggerResult:
    """
    Simulates a CPCB AQI > 300 trigger specifically for Delhi, Gurugram, Noida.
    Uses radiation blockage, low wind (stagnation), and winter temperatures 
    as a robust proxy for extreme smog/smoke.
    """
    # Check if inside NCR box roughly (Lat 28.2 to 28.9, Lon 76.8 to 77.6)
    in_ncr = 28.2 <= latitude <= 28.9 and 76.8 <= longitude <= 77.6
    
    # Needs to be NCR
    if not in_ncr:
        return TriggerResult(
            trigger_id="severe_aqi",
            trigger_name="Severe Air Quality",
            icon="😷", active=False, severity=0.0, loss_multiplier=1.0,
            description="AQI safe or outside Delhi NCR."
        )

    # Proxy conditions for AQI > 300: Very low wind, blocked sun, usually cooler temps
    stagnant_air = wind_speed_max < 12.0
    blocked_sun = shortwave_radiation_mj < 10.0
    
    # Calculate an "AQI proxy score" (0 to 1)
    smog_score = 0.0
    if stagnant_air and blocked_sun:
        wind_factor = max(0, 12 - wind_speed_max) / 12  # 0 to 1
        sun_factor = max(0, 10 - shortwave_radiation_mj) / 10 # 0 to 1
        # Winter inversion factor (worse below 25C)
        inversion = 1.0 if rolling_3d_temp < 25 else 0.5
        smog_score = (wind_factor * 0.4 + sun_factor * 0.6) * inversion

    threshold = 0.6 # Roughly maps to AQI 300+
    is_active = smog_score > threshold
    
    severity = min(1.0, smog_score * 1.2)
    loss_multiplier = 1.0 + (severity * 0.25) if is_active else 1.0
    
    desc = "Hazardous Air Quality (AQI > 300). Wear N95 masks." if is_active else "Delhi NCR AQI is below severe threshold."

    return TriggerResult(
        trigger_id="severe_aqi",
        trigger_name="Severe Air Quality",
        icon="😷",
        active=is_active,
        severity=severity,
        loss_multiplier=loss_multiplier,
        description=desc
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
    latitude: float = 20.0,
    longitude: float = 77.0,
) -> dict:
    """
    Evaluate all disruption triggers and compute composite disruption metrics.
    
    v2.1: Passes latitude/longitude for zone-adaptive thresholds and AQI mapping.
    
    Returns:
        triggers: list of TriggerResult
        any_active: bool
        max_severity: float
        compound_severity: float (with multi-trigger amplification)
        composite_loss_ratio: float (0-1, for ML target / premium calculation)
    """
    t1 = trigger_heavy_rain(
        precipitation_mm, rolling_7d_rain_mm, elevation_m, is_coastal,
        latitude=latitude,
    )
    t2 = trigger_extreme_heat(
        temp_max, apparent_temp_max, rolling_3d_temp, elevation_m, is_coastal,
        latitude=latitude, distance_to_coast_km=distance_to_coast_km,
    )
    t3 = trigger_storm(wind_speed_max, wind_gust_max, precipitation_mm, is_coastal)
    t4 = trigger_flood_zone(
        elevation_m, distance_to_coast_km, is_coastal, rolling_7d_rain_mm,
        precipitation_mm, latitude=latitude,
    )
    t5 = trigger_poor_visibility(
        shortwave_radiation_mj, precipitation_mm, temp_max, wind_speed_max,
        latitude=latitude, elevation_m=elevation_m,
    )
    t6 = trigger_severe_aqi(
        latitude, longitude, shortwave_radiation_mj, rolling_3d_temp, wind_speed_max
    )

    triggers = [t1, t2, t3, t4, t5, t6]
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
