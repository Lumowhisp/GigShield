import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Animated, Image, Platform, Modal, Pressable } from 'react-native';
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
  const [showZoneInfo, setShowZoneInfo] = useState(false);
  const [showRiskInfo, setShowRiskInfo] = useState(false);
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
              <Ionicons name="location-sharp" size={14} color={colors.aqua} style={{ marginRight: 4 }} />
              <Text style={styles.contextValue}>
                {premiumData.latitude.toFixed(2)}°, {premiumData.longitude.toFixed(2)}°
              </Text>
            </View>
            <View style={styles.contextDivider} />
            <View style={styles.contextItem}>
              <Ionicons name="wallet-outline" size={14} color={colors.orange} style={{ marginRight: 4 }} />
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
            <TouchableOpacity 
              style={styles.infoCard} 
              activeOpacity={0.8}
              onPress={() => setShowZoneInfo(true)}
            >
              <Ionicons name="information-circle-outline" size={16} color={colors.textMuted} style={styles.infoIcon} />
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
            </TouchableOpacity>

            {/* ── Forecast card with risk % ── */}
            <TouchableOpacity 
              style={[styles.infoCard, { borderColor: riskColor + '33' }]}
              activeOpacity={0.8}
              onPress={() => setShowRiskInfo(true)}
            >
              <Ionicons name="information-circle-outline" size={16} color={colors.textMuted} style={styles.infoIcon} />
              <View style={[styles.lottieWrapper, { backgroundColor: riskColor + '15', borderRadius: borderRadius.xl }]}>
                <Ionicons name="rainy-outline" size={32} color={riskColor} />
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
            </TouchableOpacity>
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
                incomeAtRisk={premiumData.daily_income_inr * 7 * actualLossRatio}
                coveredAmount={premiumData.daily_income_inr * 7 * actualLossRatio * (premiumData.plans.basic.coverage_pct / 100)}
              />
              <PlanCard
                planKey="standard"
                plan={premiumData.plans.standard}
                isSelected={selectedPlan === 'standard'}
                isRecommended
                onSelect={() => setSelectedPlan('standard')}
                incomeAtRisk={premiumData.daily_income_inr * 7 * actualLossRatio}
                coveredAmount={premiumData.daily_income_inr * 7 * actualLossRatio * (premiumData.plans.standard.coverage_pct / 100)}
              />
              <PlanCard
                planKey="premium"
                plan={premiumData.plans.premium}
                isSelected={selectedPlan === 'premium'}
                onSelect={() => setSelectedPlan('premium')}
                incomeAtRisk={premiumData.daily_income_inr * 7 * actualLossRatio}
                coveredAmount={premiumData.daily_income_inr * 7 * actualLossRatio * (premiumData.plans.premium.coverage_pct / 100)}
              />
            </>
          )}

          {/* ─ 7-Day Risk Bar Chart ─ */}
          {fr.daily_risks && fr.daily_risks.length > 0 ? (
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
          ) : (
            <View style={styles.riskChartCard}>
              <View style={styles.riskChartHeader}>
                <Ionicons name="bar-chart-outline" size={14} color={colors.aqua} />
                <Text style={styles.riskChartTitle}>Daily Disruption Risk (Next 7 Days)</Text>
              </View>
              <View style={{ alignItems: 'center', paddingVertical: spacing.lg }}>
                <Ionicons name="cloud-offline-outline" size={32} color={colors.textMuted} />
                <Text style={{ fontSize: fontSize.sm, color: colors.textMuted, marginTop: spacing.sm, textAlign: 'center' }}>
                  Forecast data is being processed. Your plan price is based on zone-level risk modeling.
                </Text>
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


          {/* ─ Pricing Transparency Card ─ */}
          <View style={styles.formulaCard}>
            {/* Header with trust badge */}
            <View style={styles.formulaHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 8 }}>
                <View style={styles.formulaIconWrap}>
                  <Ionicons name="eye-outline" size={20} color={colors.aqua} />
                </View>
                <View>
                  <Text style={styles.formulaTitle}>How Your Price Is Set</Text>
                  <Text style={{ fontSize: 10, color: colors.aqua, fontWeight: fontWeight.bold, letterSpacing: 1, marginTop: 2 }}>RADICAL TRANSPARENCY</Text>
                </View>
              </View>
            </View>

            {/* Selected plan waterfall */}
            <View style={styles.formulaWaterfall}>
              <View style={styles.formulaWRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="analytics-outline" size={14} color={colors.aqua} />
                  <Text style={styles.formulaLabel}>AI Weather Risk</Text>
                </View>
                <Text style={[styles.formulaValue, { color: premiumData.forecast_loss_ratio_7d > 0.15 ? colors.danger : colors.success }]}>
                  {(premiumData.forecast_loss_ratio_7d * 100).toFixed(1)}%
                </Text>
              </View>
              <View style={styles.formulaWRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="wallet-outline" size={14} color={colors.orange} />
                  <Text style={styles.formulaLabel}>Your Daily Earnings</Text>
                </View>
                <Text style={styles.formulaValue}>₹{premiumData.daily_income_inr}</Text>
              </View>
              <View style={styles.formulaWRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="shield-half-outline" size={14} color={colors.textSecondary} />
                  <Text style={styles.formulaLabel}>Coverage Level</Text>
                </View>
                <Text style={styles.formulaValue}>{premiumData.plans[selectedPlan]?.coverage_pct}%</Text>
              </View>

              <View style={styles.formulaWDivider} />

              <View style={styles.formulaWRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="calculator-outline" size={14} color={colors.aqua} />
                  <Text style={[styles.formulaLabel, { color: colors.textPrimary, fontWeight: fontWeight.bold }]}>Base Premium</Text>
                </View>
                <Text style={[styles.formulaValue, { fontSize: fontSize.lg }]}>₹{premiumData.plans[selectedPlan]?.base_premium_inr.toFixed(0)}</Text>
              </View>

              {premiumData.plans[selectedPlan]?.adjustments?.map((adj: any, i: number) => (
                <View key={i} style={styles.formulaWRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                    <Ionicons name={adj.amount < 0 ? "trending-down-outline" : "trending-up-outline"} size={14} color={adj.amount < 0 ? colors.success : colors.warning} />
                    <Text style={[styles.formulaLabel, { color: adj.amount < 0 ? colors.success : colors.warning }]}>
                      {adj.type.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}
                    </Text>
                  </View>
                  <Text style={[styles.formulaValue, { color: adj.amount < 0 ? colors.success : colors.warning }]}>
                    {adj.amount < 0 ? '−' : '+'}₹{Math.abs(adj.amount).toFixed(0)}
                  </Text>
                </View>
              ))}

              <View style={styles.formulaWDivider} />

              <View style={[styles.formulaWRow, { borderBottomWidth: 0 }]}>
                <Text style={[styles.formulaLabel, { color: colors.textPrimary, fontWeight: fontWeight.heavy, fontSize: fontSize.md }]}>You Pay</Text>
                <Text style={[styles.formulaValue, { color: colors.orange, fontSize: 22, fontWeight: fontWeight.heavy }]}>
                  ₹{Math.round(premiumData.plans[selectedPlan]?.weekly_premium_inr)}/wk
                </Text>
              </View>
            </View>

            {/* ML Confidence */}
            <View style={styles.formulaConfidence}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <Ionicons name="hardware-chip-outline" size={14} color={colors.aqua} />
                <Text style={{ fontSize: 11, color: colors.textSecondary, fontWeight: fontWeight.semibold }}>ML Model Confidence</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={styles.formulaConfBar}>
                  <View style={[styles.formulaConfFill, { width: `${(premiumData.model_r2 * 100)}%` }]} />
                </View>
                <Text style={{ fontSize: fontSize.sm, fontWeight: fontWeight.heavy, color: colors.aqua }}>
                  {(premiumData.model_r2 * 100).toFixed(1)}%
                </Text>
              </View>
            </View>

            {/* Trust signals */}
            <View style={styles.formulaTrust}>
              <View style={styles.formulaTrustItem}>
                <Ionicons name="lock-closed-outline" size={16} color={colors.success} />
                <Text style={styles.formulaTrustText}>100% Parametric</Text>
              </View>
              <View style={styles.formulaTrustItem}>
                <Ionicons name="flash-outline" size={16} color={colors.orange} />
                <Text style={styles.formulaTrustText}>Auto Payouts</Text>
              </View>
              <View style={styles.formulaTrustItem}>
                <Ionicons name="document-text-outline" size={16} color={colors.aqua} />
                <Text style={styles.formulaTrustText}>No Claim Forms</Text>
              </View>
            </View>

            {zp.weekly_discount_inr > 0 && (
              <View style={styles.formulaSavings}>
                <Ionicons name="gift-outline" size={16} color={colors.success} />
                <Text style={styles.formulaSavingsText}>
                  Your safe zone saves you <Text style={{ fontWeight: fontWeight.heavy, color: colors.success }}>₹{zp.weekly_discount_inr.toFixed(0)}/week</Text>
                </Text>
              </View>
            )}
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

      {/* ══════ Zone Safety Info Modal ══════ */}
      <Modal visible={showZoneInfo} transparent animationType="slide" onRequestClose={() => setShowZoneInfo(false)}>
        <View style={styles.tipModalOverlay}>
          <View style={styles.tipModalCard}>
            <View style={styles.tipModalHeader}>
              <View style={styles.tipModalIconWrap}>
                <Ionicons name="shield-checkmark" size={28} color={colors.success} />
              </View>
              <Text style={styles.tipModalTitle}>Zone Safety Score</Text>
              <TouchableOpacity onPress={() => setShowZoneInfo(false)}>
                <Ionicons name="close-circle" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} bounces={true} contentContainerStyle={{ paddingBottom: 20 }}>
              {/* Big score */}
              <View style={styles.tipScoreRow}>
                <Text style={styles.tipScoreBig}>{(zp.zone_safety_score * 100).toFixed(0)}%</Text>
                <Text style={styles.tipScoreCaption}>Your zone is rated as{' '}
                  <Text style={{ color: zp.zone_safety_score > 0.7 ? colors.success : colors.warning, fontWeight: fontWeight.bold }}>
                    {zp.zone_safety_score > 0.85 ? 'Very Safe' : zp.zone_safety_score > 0.7 ? 'Safe' : zp.zone_safety_score > 0.5 ? 'Moderate' : 'Risky'}
                  </Text>
                </Text>
              </View>

              {/* Factors */}
              <Text style={styles.tipSectionTitle}>What determines this?</Text>
              <View style={styles.tipFactorRow}>
                <View style={styles.tipFactorIcon}>
                  <Ionicons name="triangle-outline" size={18} color={colors.aqua} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.tipFactorLabel}>Elevation</Text>
                  <Text style={styles.tipFactorValue}>{zp.elevation_m.toFixed(0)}m above sea level</Text>
                </View>
              </View>
              <View style={styles.tipFactorRow}>
                <View style={styles.tipFactorIcon}>
                  <Ionicons name="water-outline" size={18} color={colors.aqua} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.tipFactorLabel}>Distance from Coast</Text>
                  <Text style={styles.tipFactorValue}>{zp.distance_to_coast_km.toFixed(0)} km</Text>
                </View>
              </View>
              <View style={styles.tipFactorRow}>
                <View style={styles.tipFactorIcon}>
                  <Ionicons name="warning-outline" size={18} color={zp.waterlogging_risk === 'low' ? colors.success : colors.warning} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.tipFactorLabel}>Waterlogging Risk</Text>
                  <Text style={styles.tipFactorValue}>{zp.waterlogging_risk.replace(/_/g, ' ').replace(/^\w/, (c: string) => c.toUpperCase())}</Text>
                </View>
              </View>

              {/* Discount callout */}
              {zp.weekly_discount_inr > 0 && (
                <View style={styles.tipDiscountBox}>
                  <Ionicons name="gift-outline" size={20} color={colors.success} />
                  <Text style={styles.tipDiscountText}>
                    You're saving <Text style={{ fontWeight: fontWeight.heavy, color: colors.success }}>₹{zp.weekly_discount_inr.toFixed(0)}/week</Text> because your zone is safe!
                  </Text>
                </View>
              )}

              <Text style={styles.tipNote}>
                Higher elevation + farther from coast = lower flood risk = cheaper premium. This score is automatically recalculated every time you request a quote.
              </Text>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ══════ 7-Day Risk Info Modal ══════ */}
      <Modal visible={showRiskInfo} transparent animationType="slide" onRequestClose={() => setShowRiskInfo(false)}>
        <View style={styles.tipModalOverlay}>
          <View style={styles.tipModalCard}>
            <View style={styles.tipModalHeader}>
              <View style={[styles.tipModalIconWrap, { backgroundColor: riskColor + '15' }]}>
                <Ionicons name="analytics-outline" size={28} color={riskColor} />
              </View>
              <Text style={styles.tipModalTitle}>7-Day Risk Forecast</Text>
              <TouchableOpacity onPress={() => setShowRiskInfo(false)}>
                <Ionicons name="close-circle" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} bounces={true} contentContainerStyle={{ paddingBottom: 20 }}>
              {/* Big risk value */}
              <View style={styles.tipScoreRow}>
                <Text style={[styles.tipScoreBig, { color: riskColor }]}>{(premiumData.forecast_loss_ratio_7d * 100).toFixed(0)}%</Text>
                <View style={[styles.tipRiskBadge, { backgroundColor: riskColor + '20', borderColor: riskColor + '40' }]}>
                  <Text style={[styles.tipRiskBadgeText, { color: riskColor }]}>{premiumData.disruption_risk.toUpperCase()} RISK</Text>
                </View>
              </View>

              <Text style={styles.tipSectionTitle}>How is this predicted?</Text>
              <Text style={styles.tipDesc}>
                Our XGBoost ML model, trained on 10 years of climate data across 35 Indian zones, analyzes the following for your exact location:
              </Text>

              {/* Factors with icons */}
              {[
                { icon: 'rainy-outline', label: 'Rainfall Forecast', color: colors.aqua },
                { icon: 'thermometer-outline', label: 'Temperature Extremes', color: colors.orange },
                { icon: 'thunderstorm-outline', label: 'Wind & Storm Activity', color: colors.warning },
                { icon: 'water-outline', label: 'Flood Zone Vulnerability', color: colors.info },
                { icon: 'cloud-outline', label: 'Air Quality (AQI)', color: colors.textMuted },
              ].map((f, i) => (
                <View key={i} style={styles.tipFactorRow}>
                  <View style={styles.tipFactorIcon}>
                    <Ionicons name={f.icon as any} size={18} color={f.color} />
                  </View>
                  <Text style={styles.tipFactorLabel}>{f.label}</Text>
                </View>
              ))}

              {/* Trigger days callout */}
              <View style={[styles.tipDiscountBox, { backgroundColor: fr.trigger_days_count > 0 ? 'rgba(255,107,53,0.08)' : 'rgba(0,230,118,0.08)', borderColor: fr.trigger_days_count > 0 ? 'rgba(255,107,53,0.2)' : 'rgba(0,230,118,0.2)' }]}>
                <Ionicons name={fr.trigger_days_count > 0 ? 'alert-circle-outline' : 'checkmark-circle-outline'} size={20} color={fr.trigger_days_count > 0 ? colors.orange : colors.success} />
                <Text style={styles.tipDiscountText}>
                  {fr.trigger_days_count > 0 
                    ? <>{<Text style={{ fontWeight: fontWeight.heavy, color: colors.orange }}>{fr.trigger_days_count} out of 7 days</Text>} have active weather triggers this week.</>
                    : <Text style={{ color: colors.success }}>No major disruptions expected this week. ✓</Text>
                  }
                </Text>
              </View>

              <Text style={styles.tipNote}>
                This forecast refreshes every time you open the app, ensuring your premium always reflects the latest weather conditions.
              </Text>
            </ScrollView>
          </View>
        </View>
      </Modal>
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
    position: 'relative',
  },
  infoIcon: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 1,
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
    marginBottom: spacing.lg,
  },
  formulaIconWrap: {
    width: 38,
    height: 38,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(0, 229, 255, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  formulaTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  formulaWaterfall: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  formulaWRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  formulaLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: fontWeight.medium,
  },
  formulaValue: {
    fontSize: 14,
    fontWeight: fontWeight.heavy,
    color: colors.textPrimary,
  },
  formulaWDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginVertical: 4,
  },
  formulaConfidence: {
    marginBottom: spacing.lg,
    paddingHorizontal: 4,
  },
  formulaConfBar: {
    flex: 1,
    height: 6,
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  formulaConfFill: {
    height: '100%',
    backgroundColor: colors.aqua,
    borderRadius: 3,
  },
  formulaTrust: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  formulaTrustItem: {
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  formulaTrustText: {
    fontSize: 10,
    color: colors.textSecondary,
    fontWeight: fontWeight.bold,
    textAlign: 'center',
  },
  formulaSavings: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: spacing.lg,
    padding: spacing.md,
    backgroundColor: 'rgba(0,230,118,0.08)',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(0,230,118,0.2)',
  },
  formulaSavingsText: {
    fontSize: 12,
    color: colors.textSecondary,
    flex: 1,
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

  // ══ Tip Info Modals ══
  tipModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  tipModalCard: {
    backgroundColor: colors.bgElevated,
    borderTopLeftRadius: borderRadius.xxl,
    borderTopRightRadius: borderRadius.xxl,
    paddingTop: spacing.xxl,
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.lg,
    maxHeight: '75%',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  tipModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: spacing.xl,
  },
  tipModalIconWrap: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.lg,
    backgroundColor: 'rgba(0,230,118,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tipModalTitle: {
    flex: 1,
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  tipScoreRow: {
    alignItems: 'center',
    marginBottom: spacing.xl,
    paddingVertical: spacing.lg,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: borderRadius.xl,
  },
  tipScoreBig: {
    fontSize: 48,
    fontWeight: fontWeight.heavy,
    color: colors.success,
    marginBottom: 4,
  },
  tipScoreCaption: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  tipRiskBadge: {
    marginTop: spacing.sm,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  tipRiskBadgeText: {
    fontSize: 11,
    fontWeight: fontWeight.bold,
    letterSpacing: 1,
  },
  tipSectionTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.aqua,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: spacing.md,
  },
  tipDesc: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  tipFactorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  tipFactorIcon: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(255,255,255,0.04)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  tipFactorLabel: {
    fontSize: fontSize.sm,
    color: colors.textPrimary,
    fontWeight: fontWeight.medium,
  },
  tipFactorValue: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  tipDiscountBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: spacing.lg,
    padding: spacing.lg,
    backgroundColor: 'rgba(0,230,118,0.08)',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(0,230,118,0.2)',
  },
  tipDiscountText: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  tipNote: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    lineHeight: 18,
    marginTop: spacing.lg,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
