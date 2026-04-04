import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Platform,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import LottieView from 'lottie-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { colors, spacing, fontSize, fontWeight, borderRadius, shadows } from '../theme';
import { fetchUserProfile, updateUserProfile, UserProfile } from '../services/api';
import type { RouteProp } from '@react-navigation/native';
import type { PremiumResponse, TriggerInfo } from '../services/api';

type Props = {
  route: any;
};

const PLAN_COLORS: Record<string, string> = {
  basic: colors.aqua,
  standard: colors.orange,
  premium: '#FFD700',
};

const DISRUPTION_LOTTIES: Record<string, string> = {
  heavy_rain: 'https://lottie.host/0d5e4c47-43b2-4700-8325-b3bd77ec70a5/SNcBwguIuy.lottie',
  extreme_heat: 'https://lottie.host/84088923-1edc-418f-bb85-bc5a73ada6ec/BqvaS6soSP.lottie',
  storm: 'https://lottie.host/a1472697-b52c-4de2-8b6d-50e174cfa393/9rIIiaF9vk.lottie',
  flood_zone: 'https://lottie.host/28c36fdc-b9d9-465e-b56d-dce04003c5bc/NdEmTWppUw.lottie',
  poor_visibility: 'https://lottie.host/cfbbb843-09e6-4207-aebb-4d120df152e2/YEIHwn6glE.lottie',
};

export default function CoverageScreen({ route }: Props) {
  const { premiumData, activePlan } = route.params || {};
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPicker, setShowPicker] = useState(false);
  const [savingTime, setSavingTime] = useState(false);

  useEffect(() => {
    fetchUserProfile()
      .then(setProfile)
      .catch(err => console.error('Coverage profile load failed', err))
      .finally(() => setLoading(false));
  }, []);

  if (!premiumData || !activePlan) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyState}>
          <Ionicons name="shield-outline" size={64} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>No Active Policy</Text>
          <Text style={styles.emptySubtitle}>Purchase a plan to see your coverage details</Text>
        </View>
      </View>
    );
  }

  const planDetails = (premiumData.plans as any)[activePlan];
  const planColor = PLAN_COLORS[activePlan] || colors.orange;
  const triggers = premiumData.all_triggers_today || [];
  const zp = premiumData.zone_profile;

  const getDaysRemaining = () => {
    if (!profile?.active_policy?.expires_at) return null;
    const expiry = new Date(profile.active_policy.expires_at);
    const diff = expiry.getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  const daysRemaining = getDaysRemaining();

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Animated.View>
          {/* ── Header ── */}
          <Text style={styles.headerTitle}>Your Coverage</Text>
          <Text style={styles.headerSubtitle}>Active parametric protection details</Text>

          {/* ── Active Plan Card ── */}
          <View style={[styles.planCard, { borderColor: planColor + '40' }]}>
            <View style={styles.planCardHeader}>
              <View>
                <Text style={styles.planLabel}>ACTIVE PLAN</Text>
                <Text style={[styles.planName, { color: planColor }]}>
                  {planDetails.label.toUpperCase()}
                </Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: planColor }]}>
                <Text style={styles.statusText}>
                  {daysRemaining !== null ? `${daysRemaining}d LEFT` : '● LIVE'}
                </Text>
              </View>
            </View>

            <View style={styles.statsGrid}>
              <View style={styles.statBox}>
                <Text style={styles.statIcon}>🛡️</Text>
                <Text style={styles.statValue}>{planDetails.coverage_pct}%</Text>
                <Text style={styles.statLabel}>Coverage</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statIcon}>💰</Text>
                <Text style={styles.statValue}>₹{Math.round(planDetails.weekly_premium_inr)}</Text>
                <Text style={styles.statLabel}>Premium/wk</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statIcon}>⚡</Text>
                <Text style={styles.statValue}>Instant</Text>
                <Text style={styles.statLabel}>Settlement</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statIcon}>💸</Text>
                <Text style={styles.statValue}>₹{Math.round(planDetails.max_weekly_payout_inr)}</Text>
                <Text style={styles.statLabel}>Max Payout</Text>
              </View>
            </View>
          </View>

          {/* ── Coverage Window (COMMENTED OUT) ──
          <View style={styles.infoCard}>
            <View style={styles.infoHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 8 }}>
                <Ionicons name="time-outline" size={18} color={colors.aqua} />
                <Text style={styles.infoTitle}>Coverage Window</Text>
              </View>
            </View>
          </View>
          */}

          {/* ── Trigger Thresholds — Live Readings vs Payout Thresholds ── */}
          <Text style={styles.sectionLabel}>TRIGGER THRESHOLDS</Text>
          <View style={styles.thresholdsCard}>
            <View style={styles.thresholdHeader}>
              <View style={styles.liveDot} />
              <Text style={styles.thresholdTitle}>Live Weather vs Payout Triggers</Text>
            </View>

            {(() => {
              const w = premiumData.today_weather || {};
              const thresholds = [
                { icon: '🌧️', name: 'Rainfall', current: w.precipitation_mm ?? 0, threshold: w.rain_threshold_mm ?? 20, unit: 'mm', desc: 'Daily precipitation' },
                { icon: '🌡️', name: 'Temperature', current: w.temp_max_c ?? 0, threshold: w.heat_threshold_c ?? 42, unit: '°C', desc: 'Max temperature' },
                { icon: '🌬️', name: 'Wind Speed', current: w.wind_speed_max_kmh ?? 0, threshold: w.wind_threshold_kmh ?? 50, unit: 'km/h', desc: 'Max wind speed' },
                { icon: '💨', name: 'Wind Gusts', current: w.wind_gust_max_kmh ?? 0, threshold: 80, unit: 'km/h', desc: 'Max gust speed' },
                { icon: '🌊', name: 'Flood Risk', current: w.rolling_7d_rain_mm ?? 0, threshold: w.flood_rain_threshold_mm ?? 100, unit: 'mm', desc: '7-day cumulative rain' },
                { icon: '☀️', name: 'Feel-Like Temp', current: w.apparent_temp_c ?? 0, threshold: 45, unit: '°C', desc: 'Apparent temperature' },
              ];
              return thresholds.map((item, i) => {
                const current = item.current || 0;
                const threshold = item.threshold || 1;
                const ratio = Math.min(current / threshold, 1);
                const pct = Math.round(ratio * 100);
                const barColor = pct > 80 ? colors.danger : pct > 50 ? colors.warning : colors.success;
                const isBreached = current >= threshold;
                return (
                  <View key={i} style={[styles.thresholdRow, i < thresholds.length - 1 && styles.thresholdBorder]}>
                    <Text style={styles.thresholdIcon}>{item.icon}</Text>
                    <View style={styles.thresholdInfo}>
                      <View style={styles.thresholdNameRow}>
                        <Text style={styles.thresholdName}>{item.name}</Text>
                        {isBreached && (
                          <View style={styles.breachedBadge}>
                            <Text style={styles.breachedText}>TRIGGERED</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.thresholdDesc}>{item.desc}</Text>
                      <View style={styles.thresholdBarBg}>
                        <View style={[styles.thresholdBarFill, { width: `${pct}%`, backgroundColor: barColor }]} />
                      </View>
                      <View style={styles.thresholdValues}>
                        <Text style={[styles.thresholdCurrent, { color: barColor }]}>
                          {current.toFixed(1)} {item.unit}
                        </Text>
                        <Text style={styles.thresholdTarget}>
                          Trigger: {threshold.toFixed(1)} {item.unit}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              });
            })()}

            <View style={styles.thresholdFooter}>
              <Ionicons name="cloud-outline" size={12} color={colors.textMuted} />
              <Text style={styles.thresholdFooterText}>
                Real-time weather from Open-Meteo API • Thresholds calibrated per zone
              </Text>
            </View>
          </View>

          {/* ── Pricing Breakdown ── */}
          <Text style={styles.sectionLabel}>PRICING BREAKDOWN</Text>
          <View style={styles.pricingCard}>
            <View style={styles.pricingRow}>
              <Text style={styles.pricingLabel}>Base Premium</Text>
              <Text style={styles.pricingValue}>₹{planDetails.base_premium_inr.toFixed(2)}</Text>
            </View>
            {planDetails.adjustments && planDetails.adjustments.map((adj: any, i: number) => (
              <View key={i} style={styles.pricingRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.pricingLabel}>{adj.type.replace(/_/g, ' ')}</Text>
                  <Text style={styles.pricingReason}>{adj.reason}</Text>
                </View>
                <Text style={[
                  styles.pricingValue,
                  { color: adj.amount < 0 ? colors.success : colors.warning }
                ]}>
                  {adj.amount < 0 ? '-' : '+'}₹{Math.abs(adj.amount).toFixed(2)}
                </Text>
              </View>
            ))}
            <View style={styles.pricingTotal}>
              <Text style={styles.pricingTotalLabel}>Weekly Total</Text>
              <Text style={[styles.pricingTotalValue, { color: planColor }]}>
                ₹{planDetails.weekly_premium_inr.toFixed(2)}
              </Text>
            </View>
          </View>

          {/* ── Zone Info ── */}
          <Text style={styles.sectionLabel}>ZONE PROFILE</Text>
          <View style={styles.zoneCard}>
            <View style={styles.zoneRow}>
              <Text style={styles.zoneLabel}>📍 Location</Text>
              <Text style={styles.zoneValue}>
                {premiumData.latitude.toFixed(4)}°, {premiumData.longitude.toFixed(4)}°
              </Text>
            </View>
            <View style={styles.zoneRow}>
              <Text style={styles.zoneLabel}>⛰️ Elevation</Text>
              <Text style={styles.zoneValue}>{Math.round(zp.elevation_m)}m</Text>
            </View>
            <View style={styles.zoneRow}>
              <Text style={styles.zoneLabel}>🌊 Coast Distance</Text>
              <Text style={styles.zoneValue}>{Math.round(zp.distance_to_coast_km)}km</Text>
            </View>
            <View style={styles.zoneRow}>
              <Text style={styles.zoneLabel}>💧 Flood Risk</Text>
              <Text style={[styles.zoneValue, {
                color: zp.waterlogging_risk === 'high_risk' ? colors.danger :
                  zp.waterlogging_risk === 'risky' ? colors.warning : colors.success
              }]}>
                {zp.waterlogging_risk.replace('_', ' ').toUpperCase()}
              </Text>
            </View>
            <View style={[styles.zoneRow, { borderBottomWidth: 0 }]}>
              <Text style={styles.zoneLabel}>🛡️ Safety Score</Text>
              <Text style={[styles.zoneValue, { color: colors.success }]}>
                {(zp.zone_safety_score * 100).toFixed(0)}%
              </Text>
            </View>
          </View>

          {/* ── Settlement Info ── */}
          <View style={styles.settlementCard}>
            <Ionicons name="flash-outline" size={20} color={colors.aqua} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.settlementTitle}>Instant Parametric Settlement</Text>
              <Text style={styles.settlementDesc}>
                When weather triggers breach thresholds, payouts are calculated automatically and
                sent to your UPI within minutes. Zero paperwork, zero waiting.
              </Text>
            </View>
          </View>

          {/* ── Model Info ── */}
          <View style={styles.modelInfo}>
            <Text style={styles.modelInfoText}>
              Model {premiumData.model_version} • R² {premiumData.model_r2.toFixed(4)} • {premiumData.date}
            </Text>
          </View>

          <View style={{ height: 110 }} />
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
  },
  scrollContent: {
    paddingHorizontal: spacing.xl,
    paddingBottom: 40,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: fontWeight.heavy,
    color: colors.textPrimary,
  },
  headerSubtitle: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: 4,
    marginBottom: spacing.xxl,
  },

  // Empty state
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xxl,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    marginTop: spacing.lg,
  },
  emptySubtitle: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    textAlign: 'center',
  },

  // Plan card
  planCard: {
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    marginBottom: spacing.xxl,
    borderWidth: 1,
    ...shadows.card,
  },
  planCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xl,
  },
  planLabel: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  planName: {
    fontSize: 24,
    fontWeight: fontWeight.heavy,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
  },
  statusText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: fontWeight.bold,
    letterSpacing: 1,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statBox: {
    width: '47%',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  statIcon: { fontSize: 20, marginBottom: 6 },
  statValue: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.heavy,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 10,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Info card
  infoCard: {
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    marginBottom: spacing.xxl,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.1)',
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: spacing.md,
  },
  infoTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  infoValue: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.heavy,
    color: colors.aqua,
    marginBottom: spacing.sm,
  },
  infoDesc: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  editShiftBtn: {
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.3)',
  },
  editShiftText: {
    color: colors.aqua,
    fontSize: 9,
    fontWeight: fontWeight.bold,
  },

  // Section labels
  sectionLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: colors.aqua,
    letterSpacing: 2,
    marginBottom: spacing.lg,
  },

  // Thresholds
  thresholdsCard: {
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    marginBottom: spacing.xxl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  thresholdHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
    gap: 8,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.success,
  },
  thresholdTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  thresholdRow: {
    flexDirection: 'row',
    paddingVertical: spacing.md,
  },
  thresholdBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  thresholdIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  thresholdInfo: {
    flex: 1,
  },
  thresholdNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  thresholdName: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  breachedBadge: {
    backgroundColor: colors.dangerDim,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  breachedText: {
    fontSize: 8,
    fontWeight: fontWeight.bold,
    color: colors.danger,
    letterSpacing: 0.5,
  },
  thresholdDesc: {
    fontSize: 10,
    color: colors.textMuted,
    marginBottom: 8,
  },
  thresholdBarBg: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 6,
  },
  thresholdBarFill: {
    height: 6,
    borderRadius: 3,
  },
  thresholdValues: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  thresholdCurrent: {
    fontSize: 11,
    fontWeight: fontWeight.bold,
  },
  thresholdTarget: {
    fontSize: 10,
    color: colors.textMuted,
  },
  thresholdFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.04)',
    gap: 6,
  },
  thresholdFooterText: {
    fontSize: 9,
    color: colors.textMuted,
    flex: 1,
  },

  // Pricing
  pricingCard: {
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    marginBottom: spacing.xxl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pricingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pricingLabel: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textTransform: 'capitalize',
  },
  pricingReason: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 2,
    maxWidth: 240,
  },
  pricingValue: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  pricingTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: spacing.md,
  },
  pricingTotalLabel: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  pricingTotalValue: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.heavy,
  },

  // Zone
  zoneCard: {
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    marginBottom: spacing.xxl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  zoneRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  zoneLabel: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  zoneValue: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },

  // Settlement
  settlementCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 229, 255, 0.06)',
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    marginBottom: spacing.xxl,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.15)',
  },
  settlementTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: 6,
  },
  settlementDesc: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    lineHeight: 18,
  },

  // Model
  modelInfo: { alignItems: 'center', paddingVertical: spacing.lg },
  modelInfoText: { fontSize: 10, color: colors.textMuted, letterSpacing: 0.5 },
});
