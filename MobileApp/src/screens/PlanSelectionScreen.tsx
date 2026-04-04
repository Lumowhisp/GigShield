import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Animated, Image, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import LottieView from 'lottie-react-native';
import { colors, spacing, fontSize, fontWeight, borderRadius, shadows } from '../theme';
import PlanCard from '../components/PlanCard';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import type { PremiumResponse } from '../services/api';

type RootStackParamList = {
  PlanSelection: { premiumData: PremiumResponse };
  Payment: { premiumData: PremiumResponse; activePlan: string };
  MainTabs: { premiumData: PremiumResponse; activePlan: string };
};

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'PlanSelection'>;
  route: RouteProp<RootStackParamList, 'PlanSelection'>;
};

const LOTTIE_URLS = {
  zoneSafety: 'https://lottie.host/f501eb42-4ea2-4777-a980-bfe4bbcb4104/DxL7fJEhez.lottie',
  forecast: 'https://lottie.host/272b1111-cdda-4de2-a7df-f5dede69e1c1/VkfWArCJ5U.lottie',
};

const DISRUPTION_LOTTIES: Record<string, string> = {
  heavy_rain: 'https://lottie.host/0d5e4c47-43b2-4700-8325-b3bd77ec70a5/SNcBwguIuy.lottie',
  extreme_heat: 'https://lottie.host/84088923-1edc-418f-bb85-bc5a73ada6ec/BqvaS6soSP.lottie',
  storm: 'https://lottie.host/a1472697-b52c-4de2-8b6d-50e174cfa393/9rIIiaF9vk.lottie',
  flood_zone: 'https://lottie.host/28c36fdc-b9d9-465e-b56d-dce04003c5bc/NdEmTWppUw.lottie',
  poor_visibility: 'https://lottie.host/cfbbb843-09e6-4207-aebb-4d120df152e2/YEIHwn6glE.lottie',
};

const RISK_COLORS: Record<string, string> = {
  low: colors.success,
  moderate: colors.warning,
  high: colors.orange,
  extreme: colors.danger,
};

export default function PlanSelectionScreen({ navigation, route }: Props) {
  const { premiumData } = route.params;
  const [selectedPlan, setSelectedPlan] = useState<'basic' | 'standard' | 'premium'>('standard');
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 50, friction: 9, useNativeDriver: true }),
    ]).start();
  }, []);

  const handleActivate = () => {
    navigation.navigate('Payment', { premiumData, activePlan: selectedPlan });
  };

  const riskColor = RISK_COLORS[premiumData.disruption_risk] || colors.textMuted;
  const zp = premiumData.zone_profile;
  const fr = premiumData.forecast_risk;

  // Use the backend's forecast_loss_ratio_7d which includes the 2% actuarial floor
  const actualLossRatio = premiumData.forecast_loss_ratio_7d;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>

          {/* ─ Header ─ */}
          <Text style={styles.headerLabel}>YOUR AI QUOTE</Text>
          <Text style={styles.title}>Choose Your Shield</Text>

          {/* ─ Context strip ─ */}
          <View style={styles.contextStrip}>
            <View style={styles.contextItem}>
              <Text style={styles.contextEmoji}>📍</Text>
              <Text style={styles.contextValue}>
                {premiumData.latitude.toFixed(2)}°, {premiumData.longitude.toFixed(2)}°
              </Text>
            </View>
            <View style={styles.contextDivider} />
            <View style={styles.contextItem}>
              <Text style={styles.contextEmoji}>💰</Text>
              <Text style={styles.contextValue}>₹{premiumData.daily_income_inr}/day</Text>
            </View>
            <View style={styles.contextDivider} />
            <View style={styles.contextItem}>
              <View style={[styles.riskDot, { backgroundColor: riskColor }]} />
              <Text style={[styles.contextValue, { color: riskColor }]}>
                {premiumData.disruption_risk.toUpperCase()}
              </Text>
            </View>
          </View>

          {/* ─ Zone + Forecast info cards with Lottie ─ */}
          <View style={styles.infoRow}>
            <View style={styles.infoCard}>
              <View style={styles.lottieWrapper}>
                <LottieView
                  source={{ uri: LOTTIE_URLS.zoneSafety }}
                  autoPlay
                  loop
                  style={styles.lottieIcon}
                />
              </View>
              <Text style={styles.infoLabel}>Zone Safety</Text>
              <Text style={styles.infoValue}>
                {(zp.zone_safety_score * 100).toFixed(0)}%
              </Text>
              {zp.weekly_discount_inr > 0 && (
                <View style={styles.discountBadge}>
                  <Text style={styles.discountText}>
                    -₹{zp.weekly_discount_inr.toFixed(0)}/wk
                  </Text>
                </View>
              )}
            </View>

            {/* ── Forecast card with risk % ── */}
            <View style={[styles.infoCard, { borderColor: riskColor + '33' }]}>
              <View style={styles.lottieWrapper}>
                <LottieView
                  source={{ uri: LOTTIE_URLS.forecast }}
                  autoPlay
                  loop
                  style={styles.lottieIcon}
                />
              </View>
              <Text style={styles.infoLabel}>7-Day Risk</Text>
              <Text style={[styles.infoValue, { color: riskColor }]}>
                {(premiumData.forecast_loss_ratio_7d * 100).toFixed(0)}%
              </Text>
              <View style={[styles.riskLevelBadge, { backgroundColor: riskColor + '22', borderColor: riskColor + '44' }]}>
                <Text style={[styles.riskLevelText, { color: riskColor }]}>
                  {premiumData.disruption_risk.toUpperCase()}
                </Text>
              </View>
            </View>
          </View>

          {/* ─ Plan cards ─ */}
          <Text style={styles.sectionLabel}>SELECT PROTECTION TIER</Text>

          {premiumData.is_suspended ? (
            <View style={styles.suspensionCard}>
              <Ionicons name="warning" size={32} color={colors.danger} />
              <Text style={styles.suspensionTitle}>ENROLLMENTS SUSPENDED</Text>
              <Text style={styles.suspensionText}>
                Due to catastrophic weather forecasts (Loss Ratio &gt; 85%) in your zone, we have temporarily paused new policy issuances to protect our risk pool. Please try again later when weather conditions normalize.
              </Text>
            </View>
          ) : (
            <>
              <PlanCard
                planKey="basic"
                plan={premiumData.plans.basic}
                isSelected={selectedPlan === 'basic'}
                onSelect={() => setSelectedPlan('basic')}
              />
              <PlanCard
                planKey="standard"
                plan={premiumData.plans.standard}
                isSelected={selectedPlan === 'standard'}
                isRecommended
                onSelect={() => setSelectedPlan('standard')}
              />
              <PlanCard
                planKey="premium"
                plan={premiumData.plans.premium}
                isSelected={selectedPlan === 'premium'}
                onSelect={() => setSelectedPlan('premium')}
              />
            </>
          )}

          {/* ─ 7-Day Risk Bar Chart ─ */}
          {fr.daily_risks && fr.daily_risks.length > 0 && (
            <View style={styles.riskChartCard}>
              <View style={styles.riskChartHeader}>
                <Ionicons name="bar-chart-outline" size={14} color={colors.aqua} />
                <Text style={styles.riskChartTitle}>Daily Disruption Risk (Next 7 Days)</Text>
              </View>
              <View style={styles.barsRow}>
                {fr.daily_risks.slice(0, 7).map((rawRisk, i) => {
                  const risk = Math.max(rawRisk, 0.02);
                  const pct = Math.min(risk, 1);
                  const barColor = pct > 0.5 ? colors.danger : pct > 0.25 ? colors.orange : colors.success;
                  const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
                  const today = new Date();
                  const dayLabel = dayNames[(today.getDay() + i) % 7];
                  return (
                    <View key={i} style={styles.barCol}>
                      <Text style={[styles.barPct, { color: barColor }]}>{(pct * 100).toFixed(0)}%</Text>
                      <View style={styles.barTrack}>
                        <View style={[styles.barFill, { height: `${Math.max(pct * 100, 6)}%`, backgroundColor: barColor }]} />
                      </View>
                      <Text style={styles.barDay}>{i === 0 ? 'Today' : dayLabel}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* ─ Active triggers ─ */}
          {premiumData.all_triggers_today && premiumData.all_triggers_today.filter(t => t.active).length > 0 && (
            <View style={styles.triggersBar}>
              <Text style={styles.triggersLabel}>ACTIVE NOW</Text>
              <View style={styles.triggersChips}>
                {premiumData.all_triggers_today.filter(t => t.active).map((t, i) => (
                  <View key={i} style={styles.triggerChip}>
                    {DISRUPTION_LOTTIES[t.trigger_id] ? (
                      <View style={styles.chipGif}>
                        <LottieView
                          source={{ uri: DISRUPTION_LOTTIES[t.trigger_id] }}
                          autoPlay
                          loop
                          style={{ width: '100%', height: '100%' }}
                        />
                      </View>
                    ) : (
                      <Text style={styles.triggerIcon}>{t.icon}</Text>
                    )}
                    <Text style={styles.triggerText}>{t.trigger_name.split(' ')[0]}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* ─ Income at Risk Card (persuasion) ─ */}
          <View style={styles.incomeRiskCard}>
            <View style={styles.incomeRiskHeader}>
              <Ionicons name="trending-down" size={16} color={colors.danger} />
              <Text style={styles.incomeRiskTitle}>Your Income at Risk This Week</Text>
            </View>
            <View style={styles.incomeRiskRow}>
              <View style={styles.incomeRiskBlock}>
                <Text style={styles.incomeRiskValue}>
                  ₹{Math.round(premiumData.daily_income_inr * 7 * actualLossRatio).toLocaleString('en-IN')}
                </Text>
                <Text style={styles.incomeRiskLabel}>Expected Loss</Text>
              </View>
              <Ionicons name="arrow-forward" size={14} color={colors.textMuted} />
              <View style={styles.incomeRiskBlock}>
                <Text style={[styles.incomeRiskValue, { color: colors.success }]}>
                  ₹{Math.round(premiumData.daily_income_inr * 7 * actualLossRatio * ((premiumData.plans[selectedPlan]?.coverage_pct || 70) / 100)).toLocaleString('en-IN')}
                </Text>
                <Text style={styles.incomeRiskLabel}>Covered by GigShield</Text>
              </View>
            </View>
            <View style={styles.incomeRiskBar}>
              <View style={[styles.incomeRiskFill, {
                width: `${Math.min(premiumData.plans[selectedPlan]?.coverage_pct || 70, 100)}%`
              }]} />
            </View>
            <Text style={styles.incomeRiskHint}>
              {premiumData.plans[selectedPlan]?.coverage_pct || 70}% of disrupted earnings recovered automatically — no forms, no waiting.
            </Text>
          </View>

          {/* ─ Social Proof Card (persuasion) ─ */}
          <View style={styles.socialProofCard}>
            <View style={styles.socialProofRow}>
              <Text style={styles.socialProofStat}>⚡ 3 sec</Text>
              <Text style={styles.socialProofDivider}>|</Text>
              <Text style={styles.socialProofStat}>12 claims cleared</Text>
              <Text style={styles.socialProofDivider}>|</Text>
              <Text style={styles.socialProofStat}>100% automated</Text>
            </View>
            <Text style={styles.socialProofMsg}>
              Riders in your zone used GigShield <Text style={{ color: colors.orange, fontWeight: fontWeight.bold }}>
                {fr.trigger_days_count > 0 ? `${fr.trigger_days_count} times this week` : 'last season'}
              </Text> — payouts landed before the rain stopped.
            </Text>
          </View>


          {/* ─ Pricing Formula Transparency ─ */}
          <View style={styles.formulaCard}>
            <View style={styles.formulaHeader}>
              <Ionicons name="calculator-outline" size={18} color={colors.aqua} />
              <Text style={styles.formulaTitle}>How Pricing Works</Text>
            </View>
            <View style={styles.formulaCodeBox}>
              <Text style={styles.formulaCode}>
                Premium = Loss_Ratio × Income × Coverage × Loading
              </Text>
            </View>
            <View style={styles.formulaDetails}>
              <View style={styles.formulaRow}>
                <Text style={styles.formulaLabel}>ML Loss Ratio</Text>
                <Text style={[styles.formulaValue, { color: premiumData.forecast_loss_ratio_7d > 0.15 ? colors.danger : colors.success }]}>
                  {(premiumData.forecast_loss_ratio_7d * 100).toFixed(2)}%
                </Text>
              </View>
              <View style={styles.formulaRow}>
                <Text style={styles.formulaLabel}>Your Daily Income</Text>
                <Text style={styles.formulaValue}>₹{premiumData.daily_income_inr}</Text>
              </View>
              <View style={styles.formulaRow}>
                <Text style={styles.formulaLabel}>Model Accuracy (R²)</Text>
                <Text style={[styles.formulaValue, { color: colors.aqua }]}>
                  {(premiumData.model_r2 * 100).toFixed(2)}%
                </Text>
              </View>
              <View style={styles.formulaRow}>
                <Text style={styles.formulaLabel}>Zone Safety Discount</Text>
                <Text style={[styles.formulaValue, { color: colors.success }]}>
                  -₹{zp.weekly_discount_inr.toFixed(0)}/wk
                </Text>
              </View>
            </View>
            <Text style={styles.formulaNote}>
              🔒 100% parametric — payouts triggered automatically by weather data, no claim forms needed.
            </Text>
          </View>

          <View style={{ height: 110 }} />
        </Animated.View>
      </ScrollView>

      {/* ─ Floating CTA ─ */}
      <View style={styles.floatingFooter}>
        <TouchableOpacity
          style={[
            styles.activateButton,
            premiumData?.is_suspended && { opacity: 0.5, backgroundColor: colors.textMuted }
          ]}
          onPress={handleActivate}
          disabled={premiumData?.is_suspended}
          activeOpacity={0.8}
        >
          <Text style={styles.activateText}>
            {premiumData?.is_suspended ? 'UNAVAILABLE' : 'Activate Coverage →'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scrollContent: { padding: spacing.xl, paddingTop: 56 },

  headerLabel: {
    fontSize: 11,
    fontWeight: fontWeight.bold,
    color: colors.aqua,
    letterSpacing: 2,
    marginBottom: 6,
  },
  title: {
    fontSize: 30,
    fontWeight: fontWeight.heavy,
    color: colors.textPrimary,
    marginBottom: spacing.xxl,
  },

  contextStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.lg,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xxl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  contextItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  contextEmoji: { fontSize: 13, marginRight: 5 },
  contextValue: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: fontWeight.semibold,
  },
  contextDivider: {
    width: 1,
    height: 18,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  riskDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    marginRight: 5,
  },

  infoRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: spacing.xxl,
  },
  infoCard: {
    flex: 1,
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.xl,
    paddingVertical: 20,
    paddingHorizontal: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  lottieWrapper: {
    width: 64,
    height: 64,
    marginBottom: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lottieIcon: {
    width: 64,
    height: 64,
  },
  infoLabel: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: fontWeight.medium,
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 22,
    fontWeight: fontWeight.heavy,
    color: colors.textPrimary,
  },
  discountBadge: {
    marginTop: 8,
    backgroundColor: colors.successDim,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
  },
  discountText: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
    color: colors.success,
  },

  triggersBar: {
    backgroundColor: colors.dangerDim,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.xxl,
    borderWidth: 1,
    borderColor: 'rgba(255,82,82,0.15)',
  },
  triggersLabel: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
    color: colors.danger,
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  triggersChips: { flexDirection: 'row', gap: 8 },
  triggerChip: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: borderRadius.sm,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)'
  },
  triggerIcon: { fontSize: 16, marginRight: 6 },
  chipGif: { width: 18, height: 18, marginRight: 6 },
  triggerText: { fontSize: fontSize.sm, color: colors.textPrimary, fontWeight: fontWeight.bold },

  sectionLabel: {
    fontSize: 11,
    fontWeight: fontWeight.bold,
    color: colors.textMuted,
    letterSpacing: 2,
    marginBottom: spacing.lg,
  },

  floatingFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.xl,
    paddingBottom: 40,
    backgroundColor: 'rgba(19, 19, 35, 0.97)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.04)',
  },
  activateButton: {
    backgroundColor: colors.orange,
    paddingVertical: 18,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    ...shadows.card,
    shadowColor: colors.orange,
  },
  activateText: {
    color: '#FFFFFF',
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
  },

  formulaCard: {
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    marginBottom: spacing.xxl,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.1)',
  },
  formulaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: spacing.md,
  },
  formulaTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  formulaCodeBox: {
    backgroundColor: 'rgba(0, 229, 255, 0.06)',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.12)',
  },
  formulaCode: {
    fontSize: 11,
    fontWeight: fontWeight.bold,
    color: colors.aqua,
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  formulaDetails: {
    marginBottom: spacing.md,
  },
  formulaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  formulaLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  formulaValue: {
    fontSize: 13,
    fontWeight: fontWeight.heavy,
    color: colors.textPrimary,
  },
  formulaNote: {
    fontSize: 10,
    color: colors.textMuted,
    lineHeight: 14,
    textAlign: 'center',
    marginTop: spacing.sm,
  },

  suspensionCard: {
    backgroundColor: 'rgba(255, 69, 58, 0.08)',
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 69, 58, 0.3)',
    marginBottom: spacing.xl,
  },
  suspensionTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.heavy,
    color: colors.danger,
    marginTop: spacing.sm,
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  suspensionText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },

  riskLevelBadge: {
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  riskLevelText: {
    fontSize: 9,
    fontWeight: fontWeight.bold,
    letterSpacing: 1,
  },

  riskChartCard: {
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    marginBottom: spacing.xxl,
    borderWidth: 1,
    borderColor: 'rgba(0,229,255,0.08)',
  },
  riskChartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.lg,
  },
  riskChartTitle: {
    fontSize: 11,
    fontWeight: fontWeight.bold,
    color: colors.textSecondary,
    letterSpacing: 0.3,
  },
  barsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 90,
    gap: 4,
  },
  barCol: {
    flex: 1,
    alignItems: 'center',
    height: '100%',
    justifyContent: 'flex-end',
  },
  barPct: {
    fontSize: 8,
    fontWeight: fontWeight.bold,
    marginBottom: 3,
  },
  barTrack: {
    width: '100%',
    height: 60,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 4,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    borderRadius: 4,
    minHeight: 4,
  },
  barDay: {
    fontSize: 8,
    color: colors.textMuted,
    marginTop: 4,
    fontWeight: fontWeight.medium,
  },

  incomeRiskCard: {
    backgroundColor: 'rgba(255,69,58,0.05)',
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,69,58,0.12)',
  },
  incomeRiskHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.md,
  },
  incomeRiskTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  incomeRiskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  incomeRiskBlock: {
    flex: 1,
    alignItems: 'center',
  },
  incomeRiskValue: {
    fontSize: 22,
    fontWeight: fontWeight.heavy,
    color: colors.danger,
    marginBottom: 2,
  },
  incomeRiskLabel: {
    fontSize: 10,
    color: colors.textMuted,
    textAlign: 'center',
  },
  incomeRiskBar: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 3,
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  incomeRiskFill: {
    height: '100%',
    backgroundColor: colors.success,
    borderRadius: 3,
  },
  incomeRiskHint: {
    fontSize: 11,
    color: colors.textMuted,
    lineHeight: 16,
    textAlign: 'center',
  },

  socialProofCard: {
    backgroundColor: 'rgba(255,140,0,0.05)',
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.xxl,
    borderWidth: 1,
    borderColor: 'rgba(255,140,0,0.1)',
  },
  socialProofRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: spacing.sm,
  },
  socialProofStat: {
    fontSize: 11,
    fontWeight: fontWeight.bold,
    color: colors.aqua,
  },
  socialProofDivider: {
    color: 'rgba(255,255,255,0.15)',
    fontSize: 12,
  },
  socialProofMsg: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
});
