import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Animated } from 'react-native';
import LottieView from 'lottie-react-native';
import { colors, spacing, fontSize, fontWeight, borderRadius, shadows } from '../theme';
import PlanCard from '../components/PlanCard';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import type { PremiumResponse } from '../services/api';

type RootStackParamList = {
  PlanSelection: { premiumData: PremiumResponse };
  MainDashboard: { premiumData: PremiumResponse; activePlan: string };
};

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'PlanSelection'>;
  route: RouteProp<RootStackParamList, 'PlanSelection'>;
};

const LOTTIE_URLS = {
  zoneSafety: 'https://lottie.host/f501eb42-4ea2-4777-a980-bfe4bbcb4104/DxL7fJEhez.lottie',
  forecast: 'https://lottie.host/272b1111-cdda-4de2-a7df-f5dede69e1c1/VkfWArCJ5U.lottie',
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
    navigation.reset({
      index: 0,
      routes: [{ name: 'MainDashboard', params: { premiumData, activePlan: selectedPlan } }],
    });
  };

  const riskColor = RISK_COLORS[premiumData.disruption_risk] || colors.textMuted;
  const zp = premiumData.zone_profile;
  const fr = premiumData.forecast_risk;

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

            <View style={styles.infoCard}>
              <View style={styles.lottieWrapper}>
                <LottieView
                  source={{ uri: LOTTIE_URLS.forecast }}
                  autoPlay
                  loop
                  style={styles.lottieIcon}
                />
              </View>
              <Text style={styles.infoLabel}>Forecast</Text>
              <Text style={styles.infoValue}>
                {fr.trigger_days_count}/7 days
              </Text>
              {fr.coverage_extended && (
                <View style={styles.extendedBadge}>
                  <Text style={styles.extendedText}>Extended</Text>
                </View>
              )}
            </View>
          </View>

          {/* ─ Active triggers ─ */}
          {premiumData.active_triggers_today.length > 0 && (
            <View style={styles.triggersBar}>
              <Text style={styles.triggersLabel}>ACTIVE NOW</Text>
              <View style={styles.triggersChips}>
                {premiumData.active_triggers_today.map((t, i) => (
                  <View key={i} style={styles.triggerChip}>
                    <Text style={styles.triggerIcon}>{t.icon}</Text>
                    <Text style={styles.triggerText}>{t.trigger_name.split(' ')[0]}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* ─ Plan cards ─ */}
          <Text style={styles.sectionLabel}>SELECT PROTECTION TIER</Text>

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

          <View style={{ height: 110 }} />
        </Animated.View>
      </ScrollView>

      {/* ─ Floating CTA ─ */}
      <View style={styles.floatingFooter}>
        <TouchableOpacity style={styles.activateButton} onPress={handleActivate} activeOpacity={0.8}>
          <Text style={styles.activateText}>Activate Coverage →</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scrollContent: { padding: spacing.xl, paddingTop: 56 },

  // Header
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

  // Context strip
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

  // Info cards
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
  extendedBadge: {
    marginTop: 8,
    backgroundColor: colors.aquaDim,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
  },
  extendedText: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
    color: colors.aqua,
  },

  // Triggers
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
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: borderRadius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  triggerIcon: { fontSize: 13, marginRight: 4 },
  triggerText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: fontWeight.semibold,
  },

  // Section labels
  sectionLabel: {
    fontSize: 11,
    fontWeight: fontWeight.bold,
    color: colors.textMuted,
    letterSpacing: 2,
    marginBottom: spacing.lg,
  },

  // Floating footer
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
});
