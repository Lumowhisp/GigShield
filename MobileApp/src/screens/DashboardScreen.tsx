import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Animated, ActivityIndicator, Platform, Dimensions, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import LottieView from 'lottie-react-native';
import { LineChart } from 'react-native-chart-kit';
import { colors, spacing, fontSize, fontWeight, borderRadius, shadows } from '../theme';
import RiskGauge from '../components/RiskGauge';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import type { PremiumResponse, TriggerInfo } from '../services/api';
import type { RootStackParamList, BottomTabParamList } from '../../App';

type Props = {
  route: RouteProp<BottomTabParamList, 'Home'>;
  navigation: NativeStackNavigationProp<BottomTabParamList, 'Home'>;
};

const DISRUPTION_LOTTIES: Record<string, string> = {
  heavy_rain: 'https://lottie.host/0d5e4c47-43b2-4700-8325-b3bd77ec70a5/SNcBwguIuy.lottie',
  extreme_heat: 'https://lottie.host/84088923-1edc-418f-bb85-bc5a73ada6ec/BqvaS6soSP.lottie',
  storm: 'https://lottie.host/a1472697-b52c-4de2-8b6d-50e174cfa393/9rIIiaF9vk.lottie',
  flood_zone: 'https://lottie.host/28c36fdc-b9d9-465e-b56d-dce04003c5bc/NdEmTWppUw.lottie',
  poor_visibility: 'https://lottie.host/cfbbb843-09e6-4207-aebb-4d120df152e2/YEIHwn6glE.lottie',
};

const PLAN_COLORS: Record<string, string> = {
  basic: colors.aqua,
  standard: colors.orange,
  premium: '#FFD700',
};

// Weather Lotties 
const WEATHER_LOTTIES = {
  clear: 'https://lottie.host/801a61b8-2510-4ed3-a00d-58fe8fe40639/0YqI4uT1G4.lottie', // Using a nice sun/cloud mix since clear ones often lack impact, or swap if user prefers
  cloudy: 'https://lottie.host/801a61b8-2510-4ed3-a00d-58fe8fe40639/0YqI4uT1G4.lottie',
  rain: 'https://lottie.host/fbc521af-4c3e-4364-b97c-8e4d2ff36d53/4I02t0fS26.lottie',
};

const getWeatherLottie = (code: number) => {
  if (code < 3) return WEATHER_LOTTIES.clear;
  if (code >= 3 && code <= 48) return WEATHER_LOTTIES.cloudy;
  return WEATHER_LOTTIES.rain;
};

export default function DashboardScreen({ route }: Props) {
  const { premiumData, activePlan } = route.params;
  const planDetails = premiumData.plans[activePlan];
  const planColor = PLAN_COLORS[activePlan] || colors.orange;
  const [isSimulating, setIsSimulating] = useState(false);
  const [weather, setWeather] = useState<{ temperature: number; weathercode: number } | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();

    // Fetch real-time weather
    if (premiumData.latitude && premiumData.longitude) {
      fetch(`https://api.open-meteo.com/v1/forecast?latitude=${premiumData.latitude}&longitude=${premiumData.longitude}&current_weather=true`)
        .then(res => res.json())
        .then(data => {
          if (data.current_weather) setWeather(data.current_weather);
        })
        .catch(err => console.error("Weather fetch failed", err));
    }
  }, []);

  const zp = premiumData.zone_profile;
  const fr = premiumData.forecast_risk;
  const triggers = premiumData.all_triggers_today || [];
  const lossRatio = premiumData.forecast_loss_ratio_7d;
  const screenWidth = Dimensions.get("window").width;

  const getNext7DaysLabels = () => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const today = new Date().getDay();
    return Array.from({ length: 7 }).map((_, i) => days[(today + i) % 7]);
  };

  const handleSimulate = () => {
    setIsSimulating(true);
    setTimeout(() => {
      setIsSimulating(false);
      alert('✅ Payout simulated: ₹' + Math.round(planDetails.expected_weekly_payout_inr) + ' via UPI');
    }, 2000);
  };

  return (
    <View style={styles.container}>
      {/* ── Top App Header ── */}
      <View style={styles.topNav}>
        <View style={styles.leftNavItems}>
          <TouchableOpacity style={styles.profileIcon} activeOpacity={0.7}>
            <Ionicons name="person-circle-outline" size={40} color={colors.textSecondary} />
          </TouchableOpacity>
          <Text style={styles.brandTitle}>GigGuard</Text>
        </View>
        
        <View style={styles.weatherBadge}>
          {!weather ? (
            <ActivityIndicator color={colors.aqua} size="small" />
          ) : (
            <>
              <LottieView
                source={{ uri: getWeatherLottie(weather.weathercode) }}
                autoPlay
                loop
                style={styles.weatherLottie}
              />
              <Text style={styles.weatherText}>{Math.round(weather.temperature)}°C</Text>
            </>
          )}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Animated.View style={{ opacity: fadeAnim }}>

          {/* ── Hero: Active plan banner ── */}
          <View style={[styles.heroBanner, { borderColor: planColor + '40' }]}>
            <View style={styles.heroTop}>
              <View>
                <Text style={styles.heroLabel}>ACTIVE COVERAGE</Text>
                <Text style={[styles.heroPlan, { color: planColor }]}>
                  {planDetails.label.toUpperCase()} PLAN
                </Text>
              </View>
              <View style={[styles.activeBadge, { backgroundColor: planColor }]}>
                <Text style={styles.activeBadgeText}>● LIVE</Text>
              </View>
            </View>
            <View style={styles.heroStats}>
              <View style={styles.heroStat}>
                <Text style={styles.heroStatLabel}>Weekly Premium</Text>
                <Text style={styles.heroStatValue}>₹{Math.round(planDetails.weekly_premium_inr)}</Text>
              </View>
              <View style={styles.heroStatDivider} />
              <View style={styles.heroStat}>
                <Text style={styles.heroStatLabel}>Coverage</Text>
                <Text style={styles.heroStatValue}>{planDetails.coverage_pct}%</Text>
              </View>
              <View style={styles.heroStatDivider} />
              <View style={styles.heroStat}>
                <Text style={styles.heroStatLabel}>Hours/Day</Text>
                <Text style={styles.heroStatValue}>{planDetails.coverage_hours_per_day}h</Text>
              </View>
            </View>
          </View>

          {/* ── Risk Gauge & Chart ── */}
          <View style={styles.gaugeSection}>
            <Text style={styles.sectionLabel}>7-DAY DISRUPTION FORECAST</Text>
            <View style={styles.gaugeContainer}>
              <RiskGauge
                value={lossRatio}
                riskLevel={premiumData.disruption_risk}
                size={180}
              />
            </View>
            <Text style={styles.forecastSummary}>{fr.forecast_summary}</Text>
            
            {/* ── Line Chart ── */}
            {fr.daily_risks && fr.daily_risks.length > 0 && (
              <View style={styles.chartWrapper}>
                <LineChart
                  data={{
                    labels: getNext7DaysLabels(),
                    datasets: [{
                      data: fr.daily_risks.map(r => r * 100), // convert to percentage
                    }]
                  }}
                  width={screenWidth - spacing.xl * 2}
                  height={200}
                  fromZero={true}
                  formatYLabel={(yValue) => {
                    const rounded = Math.round(parseFloat(yValue));
                    return isNaN(rounded) ? "0" : rounded.toString();
                  }}
                  chartConfig={{
                    backgroundColor: 'transparent',
                    backgroundGradientFrom: colors.bgCard,
                    backgroundGradientTo: colors.bgCard,
                    decimalPlaces: 0,
                    color: (opacity = 1) => `rgba(0, 229, 255, ${opacity})`,
                    labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity * 0.7})`,
                    style: { borderRadius: borderRadius.lg },
                    propsForDots: {
                      r: "5",
                      strokeWidth: "2",
                      stroke: colors.orange
                    }
                  }}
                  bezier
                  style={styles.lineChart}
                  yAxisSuffix="%"
                />
              </View>
            )}
          </View>

          {/* ── Active Triggers ── */}
          <Text style={styles.sectionLabel}>DISRUPTION TRIGGERS</Text>
          <View style={styles.triggersContainer}>
            {triggers.map((t: TriggerInfo, i: number) => (
              <View 
                key={i} 
                style={[
                  styles.triggerCard, 
                  !t.active && { opacity: 0.65, borderColor: 'rgba(255,255,255,0.02)' }
                ]}
              >
                <View style={styles.triggerHeader}>
                  {DISRUPTION_LOTTIES[t.trigger_id] ? (
                    <View style={[styles.triggerGif, !t.active && { opacity: 0.5 }]}>
                      <LottieView
                        source={{ uri: DISRUPTION_LOTTIES[t.trigger_id] }}
                        autoPlay
                        loop
                        style={{ width: '100%', height: '100%' }}
                      />
                    </View>
                  ) : (
                    <Text style={[styles.triggerIcon, !t.active && { opacity: 0.5 }]}>{t.icon}</Text>
                  )}
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.triggerName}>{t.trigger_name}</Text>
                    <Text style={[styles.triggerDesc, !t.active && { color: colors.success }]}>
                      {t.active ? t.description : "All clear — safe conditions"}
                    </Text>
                  </View>
                  <View style={[styles.severityBadge, !t.active && { backgroundColor: 'transparent' }]}>
                    <Text style={[styles.severityText, !t.active && { color: colors.success }]}>
                      {t.active ? `${Math.round(t.severity * 100)}%` : "SAFE"}
                    </Text>
                  </View>
                </View>
                {/* Severity bar */}
                <View style={styles.severityBarBg}>
                  <View style={[
                    styles.severityBarFill,
                    {
                      width: t.active ? `${Math.min(t.severity * 100, 100)}%` : '0%',
                      backgroundColor: t.severity > 0.5 ? colors.danger : t.severity > 0.25 ? colors.warning : colors.aqua,
                    },
                  ]} />
                </View>
              </View>
            ))}
          </View>

          {/* ── Zone Profile ── */}
          <Text style={styles.sectionLabel}>ZONE PROFILE</Text>
          <View style={styles.zoneGrid}>
            <View style={styles.zoneItem}>
              <Text style={styles.zoneIcon}>⛰️</Text>
              <Text style={styles.zoneValue}>{Math.round(zp.elevation_m)}m</Text>
              <Text style={styles.zoneLabel}>Elevation</Text>
            </View>
            <View style={styles.zoneItem}>
              <Text style={styles.zoneIcon}>🌊</Text>
              <Text style={[styles.zoneValue, zp.is_coastal && { color: colors.aqua }]}>
                {Math.round(zp.distance_to_coast_km)}km
              </Text>
              <Text style={styles.zoneLabel}>To Coast</Text>
            </View>
            <View style={styles.zoneItem}>
              <Text style={styles.zoneIcon}>💧</Text>
              <Text style={[
                styles.zoneValue,
                {
                  color: zp.waterlogging_risk === 'high_risk' ? colors.danger
                    : zp.waterlogging_risk === 'risky' ? colors.warning
                    : colors.success,
                }
              ]}>
                {zp.waterlogging_risk.replace('_', ' ').toUpperCase()}
              </Text>
              <Text style={styles.zoneLabel}>Flood Risk</Text>
            </View>
            <View style={styles.zoneItem}>
              <Text style={styles.zoneIcon}>🛡️</Text>
              <Text style={[styles.zoneValue, { color: colors.success }]}>
                {(zp.zone_safety_score * 100).toFixed(0)}%
              </Text>
              <Text style={styles.zoneLabel}>Safety Score</Text>
            </View>
          </View>

          {/* ── Pricing Breakdown ── */}
          {planDetails.adjustments && planDetails.adjustments.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>PRICING ADJUSTMENTS</Text>
              <View style={styles.adjustCard}>
                <View style={styles.adjustRow}>
                  <Text style={styles.adjustLabel}>Base premium</Text>
                  <Text style={styles.adjustValue}>₹{planDetails.base_premium_inr.toFixed(2)}</Text>
                </View>
                {planDetails.adjustments.map((adj, i) => (
                  <View key={i} style={styles.adjustRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.adjustLabel}>
                        {adj.type.replace(/_/g, ' ')}
                      </Text>
                      <Text style={styles.adjustReason}>{adj.reason}</Text>
                    </View>
                    <Text style={[
                      styles.adjustValue,
                      { color: adj.amount < 0 ? colors.success : colors.warning },
                    ]}>
                      {adj.amount < 0 ? '-' : '+'}₹{Math.abs(adj.amount).toFixed(2)}
                    </Text>
                  </View>
                ))}
                <View style={styles.adjustTotal}>
                  <Text style={styles.adjustTotalLabel}>Weekly total</Text>
                  <Text style={styles.adjustTotalValue}>
                    ₹{planDetails.weekly_premium_inr.toFixed(2)}
                  </Text>
                </View>
              </View>
            </>
          )}

          {/* ── Claim Simulator ── */}
          <Text style={styles.sectionLabel}>CLAIM SIMULATOR</Text>
          <View style={styles.claimCard}>
            {lossRatio > 0.15 ? (
              <>
                <View style={styles.claimWarningRow}>
                  <Text style={styles.claimWarningIcon}>⚠️</Text>
                  <Text style={styles.claimWarningText}>
                    Weather threshold breached — auto-payout eligible
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.claimButton, isSimulating && { opacity: 0.6 }]}
                  onPress={handleSimulate}
                  disabled={isSimulating}
                  activeOpacity={0.8}
                >
                  <Text style={styles.claimButtonText}>
                    {isSimulating ? '⏳ Processing UPI...' : '💸 Simulate Auto-Claim'}
                  </Text>
                </TouchableOpacity>
                <Text style={styles.claimSubtext}>
                  Estimated payout: ₹{Math.round(planDetails.expected_weekly_payout_inr)}
                </Text>
              </>
            ) : (
              <View style={styles.claimSafe}>
                <Text style={styles.claimSafeIcon}>🟢</Text>
                <Text style={styles.claimSafeText}>Conditions normal — no payout required</Text>
                <Text style={styles.claimSafeHint}>
                  When weather triggers breach thresholds, payouts are automatic via UPI.
                </Text>
              </View>
            )}
          </View>

          {/* ── Model Info ── */}
          <View style={styles.modelInfo}>
            <Text style={styles.modelInfoText}>
              Model {premiumData.model_version} • R² {premiumData.model_r2.toFixed(4)} • {premiumData.date}
            </Text>
          </View>

          <View style={{ height: 40 }} />
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scrollContent: { padding: spacing.xl, paddingBottom: spacing.huge },

  // Top Nav
  topNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: spacing.md,
    backgroundColor: colors.bg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.03)',
  },
  leftNavItems: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileIcon: {
    marginRight: spacing.sm,
  },
  brandTitle: {
    fontSize: 22,
    fontWeight: fontWeight.heavy,
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  weatherBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 229, 255, 0.08)',
    paddingRight: spacing.md,
    paddingLeft: spacing.sm,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.2)',
  },
  weatherLottie: {
    width: 28,
    height: 28,
    marginRight: 4,
  },
  weatherText: {
    color: colors.aqua,
    fontWeight: fontWeight.bold,
    fontSize: fontSize.md,
  },

  // Hero
  heroBanner: {
    backgroundColor: colors.bgCard, borderRadius: borderRadius.xl,
    padding: spacing.xl, marginBottom: spacing.xxl,
    borderWidth: 1,
  },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.xl },
  heroLabel: { fontSize: fontSize.xs, color: colors.textMuted, letterSpacing: 1.5, marginBottom: 4 },
  heroPlan: { fontSize: 22, fontWeight: fontWeight.heavy },
  activeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: borderRadius.full },
  activeBadgeText: { color: '#FFF', fontSize: 10, fontWeight: fontWeight.bold, letterSpacing: 1 },
  heroStats: { flexDirection: 'row', alignItems: 'center' },
  heroStat: { flex: 1, alignItems: 'center' },
  heroStatLabel: { fontSize: 10, color: colors.textMuted, marginBottom: 4, textTransform: 'uppercase' },
  heroStatValue: { fontSize: fontSize.xl, fontWeight: fontWeight.heavy, color: colors.textPrimary },
  heroStatDivider: { width: 1, height: 30, backgroundColor: colors.border },

  // Gauge & Chart
  gaugeSection: { alignItems: 'center', marginBottom: spacing.xxxl },
  gaugeContainer: { marginVertical: spacing.lg },
  forecastSummary: {
    fontSize: fontSize.sm, color: colors.textSecondary, textAlign: 'center',
    paddingHorizontal: spacing.xl, marginBottom: spacing.xl,
  },
  chartWrapper: {
    marginTop: spacing.md,
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
    overflow: 'hidden',
    alignSelf: 'stretch',
  },
  lineChart: {
    borderRadius: borderRadius.lg,
    paddingRight: 20, 
    paddingLeft: 10,  // Prevents Y-axis text from clipping on Android
  },

  // Section labels
  sectionLabel: {
    fontSize: fontSize.xs, fontWeight: fontWeight.bold, color: colors.aqua,
    letterSpacing: 2, marginBottom: spacing.lg,
  },

  // Triggers
  triggersContainer: { marginBottom: spacing.xxl },
  triggerCard: {
    backgroundColor: colors.bgCard, borderRadius: borderRadius.lg,
    padding: spacing.lg, marginBottom: spacing.md,
    borderWidth: 1, borderColor: colors.border,
  },
  triggerHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  triggerIcon: { fontSize: 32 },
  triggerGif: { width: 36, height: 36, borderRadius: 6 },
  triggerName: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.textPrimary, marginBottom: 2 },
  triggerDesc: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2 },
  severityBadge: {
    backgroundColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },
  severityText: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.textPrimary },
  severityBarBg: {
    height: 4, backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 2, marginTop: spacing.md, overflow: 'hidden',
  },
  severityBarFill: { height: 4, borderRadius: 2 },
  noTriggersCard: {
    backgroundColor: colors.bgCard, borderRadius: borderRadius.lg,
    padding: spacing.xxl, alignItems: 'center', marginBottom: spacing.xxl,
    borderWidth: 1, borderColor: colors.border,
  },
  noTriggersIcon: { fontSize: 32, marginBottom: spacing.sm },
  noTriggersText: { fontSize: fontSize.md, color: colors.success, fontWeight: fontWeight.semibold },

  // Zone
  zoneGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: spacing.xxl,
  },
  zoneItem: {
    width: '47%' as any, backgroundColor: colors.bgCard, borderRadius: borderRadius.lg,
    padding: spacing.lg, alignItems: 'center',
    borderWidth: 1, borderColor: colors.border,
  },
  zoneIcon: { fontSize: 24, marginBottom: spacing.sm },
  zoneValue: { fontSize: fontSize.lg, fontWeight: fontWeight.heavy, color: colors.textPrimary, marginBottom: 2 },
  zoneLabel: { fontSize: fontSize.xs, color: colors.textMuted },

  // Adjustments
  adjustCard: {
    backgroundColor: colors.bgCard, borderRadius: borderRadius.lg,
    padding: spacing.lg, marginBottom: spacing.xxl,
    borderWidth: 1, borderColor: colors.border,
  },
  adjustRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  adjustLabel: { fontSize: fontSize.sm, color: colors.textSecondary, textTransform: 'capitalize' },
  adjustReason: { fontSize: 10, color: colors.textMuted, marginTop: 2, maxWidth: 240 },
  adjustValue: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.textPrimary },
  adjustTotal: {
    flexDirection: 'row', justifyContent: 'space-between', paddingTop: spacing.md,
  },
  adjustTotalLabel: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.textPrimary },
  adjustTotalValue: { fontSize: fontSize.xl, fontWeight: fontWeight.heavy, color: colors.orange },

  // Claims
  claimCard: {
    backgroundColor: colors.bgCard, borderRadius: borderRadius.lg,
    padding: spacing.xl, marginBottom: spacing.xxl,
    borderWidth: 1, borderColor: colors.border,
  },
  claimWarningRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg },
  claimWarningIcon: { fontSize: 24, marginRight: 10 },
  claimWarningText: { fontSize: fontSize.md, color: colors.danger, fontWeight: fontWeight.bold, flex: 1 },
  claimButton: {
    backgroundColor: colors.danger, paddingVertical: 16,
    borderRadius: borderRadius.lg, alignItems: 'center',
    ...shadows.card, shadowColor: colors.danger,
  },
  claimButtonText: { color: '#FFF', fontSize: fontSize.md, fontWeight: fontWeight.bold },
  claimSubtext: { fontSize: fontSize.xs, color: colors.textMuted, textAlign: 'center', marginTop: spacing.md },
  claimSafe: { alignItems: 'center' },
  claimSafeIcon: { fontSize: 32, marginBottom: spacing.sm },
  claimSafeText: { fontSize: fontSize.md, color: colors.success, fontWeight: fontWeight.semibold },
  claimSafeHint: { fontSize: fontSize.xs, color: colors.textMuted, textAlign: 'center', marginTop: spacing.sm },

  // Model
  modelInfo: { alignItems: 'center', paddingVertical: spacing.lg },
  modelInfoText: { fontSize: 10, color: colors.textMuted, letterSpacing: 0.5 },
});
