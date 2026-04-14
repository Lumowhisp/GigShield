import React, { useRef, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Image, Modal, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, fontSize, fontWeight, shadows } from '../theme';
import type { PlanDetail } from '../services/api';

interface PlanCardProps {
  planKey: 'basic' | 'standard' | 'premium';
  plan: PlanDetail;
  isSelected: boolean;
  isRecommended?: boolean;
  onSelect: () => void;
  incomeAtRisk?: number;
  coveredAmount?: number;
}

const PLAN_CONFIG: Record<string, { color: string; accentDim: string; icon: string }> = {
  basic: { color: colors.aqua, accentDim: colors.aquaDim, icon: 'shield-outline' },
  standard: { color: colors.orange, accentDim: colors.orangeDim, icon: 'shield-half' },
  premium: { color: '#FFD700', accentDim: 'rgba(255, 215, 0, 0.10)', icon: 'shield-checkmark' },
};

// Human-readable labels for adjustment types
const ADJUSTMENT_LABELS: Record<string, string> = {
  zone_safety_discount: 'Safe Zone Reward',
  forecast_surge: 'Severe Weather Loading',
  loyalty_discount: 'No-Claim Loyalty Bonus',
  compound_risk: 'Multi-Hazard Surcharge',
  seasonal: 'Seasonal Adjustment',
  price_cap_discount: 'Max Price Cap Applied',
  minimum_base_floor: 'Minimum Coverage Floor',
};

// Local image assets for plan icons
const PLAN_ICONS: Record<string, any> = {
  standard: require('../../assets/Standard Background Removed.png'),
  premium: require('../../assets/Premium Background Removed.png'),
};

export default function PlanCard({ planKey, plan, isSelected, isRecommended, onSelect, incomeAtRisk, coveredAmount }: PlanCardProps) {
  const [showInfo, setShowInfo] = useState(false);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: isSelected ? 1.015 : 1,
        tension: 100,
        friction: 10,
        useNativeDriver: false,
      }),
      Animated.timing(glowAnim, {
        toValue: isSelected ? 1 : 0,
        duration: 300,
        useNativeDriver: false,
      }),
    ]).start();
  }, [isSelected]);

  const config = PLAN_CONFIG[planKey];

  const borderColor = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(255,255,255,0.04)', config.color + '80'],
  });

  const bgColor = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.bgCard, config.accentDim],
  });

  const isEligible = plan.is_eligible !== false; // handle undefined as true for older schema

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      style={[
        styles.card,
        {
          borderColor: isSelected ? config.color : colors.border,
          backgroundColor: isSelected ? config.accentDim : colors.bgCard,
        },
        !isEligible && { opacity: 0.5 }
      ]}
      onPress={() => isEligible && onSelect()}
      disabled={!isEligible}
    >
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        
        {/* Badges row */}
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
          {isRecommended && isEligible && (
            <View style={[styles.badge, { backgroundColor: colors.orangeDim }]}>
              <Text style={[styles.badgeText, { color: colors.orange }]}>★ RECOMMENDED</Text>
            </View>
          )}
          {!isEligible && (
            <View style={[styles.badge, { backgroundColor: colors.dangerDim }]}>
              <Text style={[styles.badgeText, { color: colors.danger }]}>🔒 REQUIRES 5+ ACTIVE DAYS</Text>
            </View>
          )}
        </View>

        {/* Plan header row */}
        <View style={styles.headerRow}>
          {/* Icon */}
          <View style={[styles.iconContainer, { backgroundColor: config.color + '15', borderColor: config.color + '30' }]}>
            <Ionicons name={config.icon as any} size={28} color={config.color} />
          </View>

          {/* Name + coverage */}
          <View style={styles.nameBlock}>
            <Text style={[styles.planName, isSelected && { color: config.color }]}>
              {plan.label}
            </Text>
            <Text style={styles.coverage}>
              {plan.coverage_pct}% Daily Income Covered
            </Text>
          </View>

          {/* Info icon */}
          <TouchableOpacity
            onPress={() => setShowInfo(true)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={{ marginRight: 10 }}
          >
            <Ionicons name="information-circle-outline" size={22} color={colors.textMuted} />
          </TouchableOpacity>

          {/* Radio */}
          <View style={[styles.radio, isSelected && { borderColor: config.color }]}>
            {isSelected && <View style={[styles.radioDot, { backgroundColor: config.color }]} />}
          </View>
        </View>

        {/* Price row */}
        <View style={styles.priceRow}>
          <View style={styles.priceLeft}>
            <Text style={styles.currencySmall}>₹</Text>
            <Text style={[styles.priceValue, isSelected && { color: config.color }]}>
              {Math.round(plan.weekly_premium_inr)}
            </Text>
            <Text style={styles.pricePeriod}>/week</Text>
          </View>
        </View>

        {/* Adjustments - only when selected */}
        {isSelected && plan.adjustments && plan.adjustments.length > 0 && (
          <View style={styles.adjustRow}>
            {plan.adjustments.map((adj, i) => (
              <View
                key={i}
                style={[
                  styles.adjustChip,
                  { backgroundColor: adj.amount < 0 ? colors.successDim : colors.warningDim },
                ]}
              >
                <Text style={[
                  styles.adjustText,
                  { color: adj.amount < 0 ? colors.success : colors.warning },
                ]}>
                  {adj.amount < 0 ? '↓' : '↑'} ₹{Math.abs(adj.amount).toFixed(0)} {ADJUSTMENT_LABELS[adj.type] || adj.type.replace(/_/g, ' ')}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Footer: Max payout */}
        <View style={styles.footerRow}>
          <Text style={styles.footerLabel}>Max payout</Text>
          <Text style={styles.footerValue}>₹{Math.round(plan.max_weekly_payout_inr)}/wk</Text>
        </View>

        {/* Income at Risk - only when selected */}
        {isSelected && incomeAtRisk != null && coveredAmount != null && (
          <View style={styles.riskInlineCard}>
            <View style={styles.riskInlineRow}>
              <View style={{ alignItems: 'center', flex: 1 }}>
                <Text style={styles.riskInlineLoss}>₹{Math.round(incomeAtRisk).toLocaleString('en-IN')}</Text>
                <Text style={styles.riskInlineLabel}>Weekly Risk</Text>
              </View>
              <Ionicons name="arrow-forward" size={14} color={colors.textMuted} />
              <View style={{ alignItems: 'center', flex: 1 }}>
                <Text style={styles.riskInlineCovered}>₹{Math.round(coveredAmount).toLocaleString('en-IN')}</Text>
                <Text style={styles.riskInlineLabel}>You Recover</Text>
              </View>
            </View>
            <View style={styles.riskInlineBar}>
              <View style={[styles.riskInlineFill, { width: `${plan.coverage_pct}%` }]} />
            </View>
            <Text style={styles.riskInlineHint}>{plan.coverage_pct}% auto-recovered — no forms needed</Text>
          </View>
        )}
      </Animated.View>

      {/* ─── Info Modal ─── */}
      <Modal
        visible={showInfo}
        transparent
        animationType="slide"
        onRequestClose={() => setShowInfo(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Ionicons name={config.icon as any} size={24} color={config.color} />
              <Text style={[styles.modalTitle, { color: config.color }]}>
                {plan.label} — Pricing Breakdown
              </Text>
              <TouchableOpacity onPress={() => setShowInfo(false)}>
                <Ionicons name="close-circle" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView 
              showsVerticalScrollIndicator={true}
              nestedScrollEnabled={true}
              bounces={true}
              contentContainerStyle={{ paddingBottom: 20 }}
              style={{ flex: 1 }}
            >
              {/* What is this plan */}
              <Text style={styles.modalSectionTitle}>What You Get</Text>
              <Text style={styles.modalDesc}>
                Covers {plan.coverage_pct}% of your daily earnings when weather disruptions prevent you from working. Payouts are triggered automatically — no forms, no waiting.
              </Text>
              <View style={styles.modalHighlight}>
                <Text style={styles.modalHighlightLabel}>Coverage Hours</Text>
                <Text style={[styles.modalHighlightValue, { color: config.color }]}>{plan.coverage_hours_per_day}h/day</Text>
              </View>

              {/* Step-by-step pricing waterfall */}
              <Text style={styles.modalSectionTitle}>Price Calculation</Text>
              
              <View style={styles.waterfallBox}>
                {/* Step 1: Base Premium */}
                <View style={styles.waterfallRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.waterfallLabel}>Base Premium</Text>
                    <Text style={styles.waterfallHint}>Calculated by our AI based on your zone's weather risk and your daily earnings</Text>
                  </View>
                  <Text style={styles.waterfallValue}>₹{plan.base_premium_inr.toFixed(0)}</Text>
                </View>

                {/* Each Adjustment */}
                {plan.adjustments && plan.adjustments.map((adj, i) => (
                  <View key={i} style={styles.waterfallRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.waterfallLabel, { color: adj.amount < 0 ? colors.success : colors.warning }]}>
                        {adj.amount < 0 ? '↓' : '↑'} {ADJUSTMENT_LABELS[adj.type] || adj.type}
                      </Text>
                      <Text style={styles.waterfallHint}>{adj.reason}</Text>
                    </View>
                    <Text style={[styles.waterfallValue, { color: adj.amount < 0 ? colors.success : colors.warning }]}>
                      {adj.amount < 0 ? '−' : '+'}₹{Math.abs(adj.amount).toFixed(0)}
                    </Text>
                  </View>
                ))}

                {/* Divider */}
                <View style={styles.waterfallDivider} />

                {/* Final Price */}
                <View style={[styles.waterfallRow, { borderBottomWidth: 0 }]}>
                  <Text style={[styles.waterfallLabel, { color: colors.textPrimary, fontWeight: fontWeight.heavy }]}>You Pay (Weekly)</Text>
                  <Text style={[styles.waterfallValue, { color: config.color, fontSize: 22 }]}>₹{Math.round(plan.weekly_premium_inr)}</Text>
                </View>

                {/* Monthly equivalent */}
                <View style={[styles.waterfallRow, { borderBottomWidth: 0, paddingVertical: 2 }]}>
                  <Text style={styles.waterfallHint}>Monthly equivalent</Text>
                  <Text style={[styles.waterfallHint, { fontWeight: fontWeight.bold }]}>₹{plan.monthly_premium_inr.toFixed(0)}/mo</Text>
                </View>
              </View>

              {/* Value proposition */}
              <Text style={styles.modalSectionTitle}>Your Protection</Text>
              <View style={styles.modalHighlight}>
                <Text style={styles.modalHighlightLabel}>Max Weekly Payout</Text>
                <Text style={[styles.modalHighlightValue, { color: colors.success }]}>₹{Math.round(plan.max_weekly_payout_inr)}</Text>
              </View>
              <View style={[styles.modalHighlight, { marginTop: 8 }]}>
                <Text style={styles.modalHighlightLabel}>Expected Weekly Return</Text>
                <Text style={[styles.modalHighlightValue, { color: colors.aqua }]}>₹{Math.round(plan.expected_weekly_payout_inr)}</Text>
              </View>

              {/* Glossary */}
              <Text style={styles.modalSectionTitle}>Term Glossary</Text>
              <View style={styles.glossaryItem}>
                <Ionicons name="location-outline" size={14} color={colors.aqua} />
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={styles.glossaryTerm}>Zone Safety Discount</Text>
                  <Text style={styles.glossaryDef}>Riders in elevated, well-drained areas face lower flood risk, so they get a weekly discount.</Text>
                </View>
              </View>
              <View style={styles.glossaryItem}>
                <Ionicons name="thunderstorm-outline" size={14} color={colors.orange} />
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={styles.glossaryTerm}>Forecast Surge</Text>
                  <Text style={styles.glossaryDef}>When our AI detects multiple severe weather days ahead, coverage hours are extended and a small surcharge is added.</Text>
                </View>
              </View>
              <View style={styles.glossaryItem}>
                <Ionicons name="heart-outline" size={14} color={colors.success} />
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={styles.glossaryTerm}>No-Claim Loyalty Bonus</Text>
                  <Text style={styles.glossaryDef}>For every week without a claim, you earn a 2% discount (up to 15% max).</Text>
                </View>
              </View>
              <View style={styles.glossaryItem}>
                <Ionicons name="layers-outline" size={14} color={colors.warning} />
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={styles.glossaryTerm}>Multi-Hazard Surcharge</Text>
                  <Text style={styles.glossaryDef}>When 2+ weather hazards are active simultaneously (e.g., rain + storm), compound risk loading is applied.</Text>
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    padding: spacing.xl,
    marginBottom: 14,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    alignSelf: 'flex-start',
    marginBottom: 14,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
    letterSpacing: 1.2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
  },
  nameBlock: {
    flex: 1,
    marginLeft: 14,
  },
  planName: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  coverage: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.04)',
  },
  priceLeft: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  currencySmall: {
    fontSize: 18,
    fontWeight: fontWeight.bold,
    color: colors.textSecondary,
  },
  priceValue: {
    fontSize: 32,
    fontWeight: fontWeight.heavy,
    color: colors.textPrimary,
    marginLeft: 2,
  },
  pricePeriod: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginLeft: 4,
  },
  monthlyText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  adjustRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 12,
  },
  adjustChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
  },
  adjustText: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.04)',
  },
  footerLabel: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  footerValue: {
    fontSize: fontSize.sm,
    color: colors.textPrimary,
    fontWeight: fontWeight.bold,
  },

  // ── Inline Risk Card ──
  riskInlineCard: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  riskInlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  riskInlineLoss: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.heavy,
    color: colors.danger,
    marginBottom: 2,
  },
  riskInlineCovered: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.heavy,
    color: colors.success,
    marginBottom: 2,
  },
  riskInlineLabel: {
    fontSize: 10,
    color: colors.textMuted,
  },
  riskInlineBar: {
    height: 5,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 3,
    marginBottom: 6,
    overflow: 'hidden',
  },
  riskInlineFill: {
    height: '100%',
    backgroundColor: colors.success,
    borderRadius: 3,
  },
  riskInlineHint: {
    fontSize: 10,
    color: colors.textMuted,
    textAlign: 'center',
  },

  // ── Info Modal ──
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: colors.bgElevated,
    borderTopLeftRadius: borderRadius.xxl,
    borderTopRightRadius: borderRadius.xxl,
    paddingTop: spacing.xxl,
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.lg,
    height: '80%',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: spacing.xl,
  },
  modalTitle: {
    flex: 1,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
  },
  modalSectionTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.aqua,
    letterSpacing: 0.5,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
  },
  modalDesc: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  modalHighlight: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: borderRadius.md,
    paddingVertical: 10,
    paddingHorizontal: spacing.lg,
  },
  modalHighlightLabel: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  modalHighlightValue: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.heavy,
  },

  // Waterfall pricing
  waterfallBox: {
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  waterfallRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  waterfallLabel: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    fontWeight: fontWeight.medium,
  },
  waterfallValue: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.heavy,
    color: colors.textPrimary,
    marginLeft: spacing.md,
  },
  waterfallHint: {
    fontSize: 11,
    color: colors.textMuted,
    lineHeight: 15,
    marginTop: 2,
  },
  waterfallDivider: {
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginVertical: spacing.sm,
    borderRadius: 1,
  },

  // Glossary
  glossaryItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  glossaryTerm: {
    fontSize: fontSize.sm,
    color: colors.textPrimary,
    fontWeight: fontWeight.semibold,
  },
  glossaryDef: {
    fontSize: 11,
    color: colors.textMuted,
    lineHeight: 16,
    marginTop: 2,
  },
});
