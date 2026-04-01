import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Animated } from 'react-native';
import { colors, spacing, fontSize, fontWeight, borderRadius, shadows } from '../theme';
import RiskGauge from '../components/RiskGauge';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import type { PremiumResponse, TriggerInfo } from '../services/api';

type RootStackParamList = {
  MainDashboard: { premiumData: PremiumResponse; activePlan: 'basic' | 'standard' | 'premium' };
};

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'MainDashboard'>;
  route: RouteProp<RootStackParamList, 'MainDashboard'>;
};

const PLAN_COLORS: Record<string, string> = {
  basic: colors.aqua,
  standard: colors.orange,
  premium: '#FFD700',
};

export default function DashboardScreen({ route }: Props) {
  const { premiumData, activePlan } = route.params;
  const planDetails = premiumData.plans[activePlan];
  const planColor = PLAN_COLORS[activePlan] || colors.orange;
  const [isSimulating, setIsSimulating] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, []);

  const zp = premiumData.zone_profile;
  const fr = premiumData.forecast_risk;
  const triggers = premiumData.active_triggers_today || [];
  const lossRatio = premiumData.forecast_loss_ratio_7d;

  const handleSimulate = () => {
    setIsSimulating(true);
    setTimeout(() => {
      setIsSimulating(false);
      alert('✅ Payout simulated: ₹' + Math.round(planDetails.expected_weekly_payout_inr) + ' via UPI');
    }, 2000);
  };

  return (
    <View style={styles.container}>
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

          {/* ── Risk Gauge ── */}
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
          </View>

          {/* ── Active Triggers ── */}
          <Text style={styles.sectionLabel}>DISRUPTION TRIGGERS</Text>
          {triggers.length > 0 ? (
            <View style={styles.triggersContainer}>
              {triggers.map((t: TriggerInfo, i: number) => (
                <View key={i} style={styles.triggerCard}>
                  <View style={styles.triggerHeader}>
                    <Text style={styles.triggerIcon}>{t.icon}</Text>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.triggerName}>{t.trigger_name}</Text>
                      <Text style={styles.triggerDesc}>{t.description}</Text>
                    </View>
                    <View style={styles.severityBadge}>
                      <Text style={styles.severityText}>
                        {Math.round(t.severity * 100)}%
                      </Text>
                    </View>
                  </View>
                  {/* Severity bar */}
                  <View style={styles.severityBarBg}>
                    <View style={[
                      styles.severityBarFill,
                      {
                        width: `${Math.min(t.severity * 100, 100)}%`,
                        backgroundColor: t.severity > 0.5 ? colors.danger : t.severity > 0.25 ? colors.warning : colors.aqua,
                      },
                    ]} />
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.noTriggersCard}>
              <Text style={styles.noTriggersIcon}>✅</Text>
              <Text style={styles.noTriggersText}>All clear — no active disruptions</Text>
            </View>
          )}

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
  scrollContent: { padding: spacing.xl, paddingTop: spacing.lg },

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

  // Gauge
  gaugeSection: { alignItems: 'center', marginBottom: spacing.xxxl },
  gaugeContainer: { marginVertical: spacing.lg },
  forecastSummary: {
    fontSize: fontSize.sm, color: colors.textSecondary, textAlign: 'center',
    paddingHorizontal: spacing.xl,
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
  triggerIcon: { fontSize: 28 },
  triggerName: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.textPrimary },
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
