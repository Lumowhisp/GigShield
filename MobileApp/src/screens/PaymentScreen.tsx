import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  ActivityIndicator,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSize, fontWeight, borderRadius } from '../theme';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import type { PremiumResponse } from '../services/api';
import { purchasePolicy } from '../services/api';
import type { RootStackParamList } from '../../App';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Payment'>;
  route: RouteProp<RootStackParamList, 'Payment'>;
};

type PaymentMethod = 'upi' | 'card' | 'netbanking' | 'wallet';
type Stage = 'checkout' | 'processing' | 'success';

interface UpiApp {
  id: string;
  name: string;
  shortName: string;
  color: string;
  logo: any; // Using any for require() source
}

const UPI_APPS: UpiApp[] = [
  { id: 'phonepe', name: 'PhonePe', shortName: 'PP', color: '#5F259F', logo: require('../../assets/UPI-APP-Logo/phone-pe-100.png') },
  { id: 'gpay', name: 'Google Pay', shortName: 'G', color: '#4285F4', logo: require('../../assets/UPI-APP-Logo/google-pay-100.png') },
  { id: 'paytm', name: 'Paytm', shortName: 'PT', color: '#002970', logo: require('../../assets/UPI-APP-Logo/icons8-paytm-100.png') },
  { id: 'bhim', name: 'BHIM UPI', shortName: 'BH', color: '#1A6FAB', logo: require('../../assets/UPI-APP-Logo/bhim-100.png') },
];

const PROCESSING_STEPS = [
  'Authenticating your request...',
  'Verifying payment details...',
  'Contacting your bank...',
  'Securing your coverage...',
];

const PLAN_COLORS: Record<string, string> = {
  basic: '#60A5FA',
  standard: '#A78BFA',
  premium: '#F59E0B',
};

const BANKS = [
  { id: 'sbi', name: 'SBI', logo: require('../../assets/UPI-APP-Logo/sbi.png'), color: '#1B6FAB' },
  { id: 'hdfc', name: 'HDFC Bank', logo: require('../../assets/UPI-APP-Logo/hdfc.png'), color: '#1A6FAB' },
  { id: 'icici', name: 'ICICI Bank', logo: require('../../assets/UPI-APP-Logo/icici.png'), color: '#F37021' },
  { id: 'axis', name: 'Axis Bank', logo: require('../../assets/UPI-APP-Logo/axis.png'), color: '#971237' },
  { id: 'kotak', name: 'Kotak Mahindra', logo: require('../../assets/UPI-APP-Logo/kotak.png'), color: '#EE1C25' },
];

const WALLETS = [
  { id: 'paytm', name: 'Paytm Wallet', logo: require('../../assets/UPI-APP-Logo/icons8-paytm-100.png'), color: '#002970' },
  { id: 'amazon', name: 'Amazon Pay', logo: require('../../assets/UPI-APP-Logo/amazon-pay-100.png'), color: '#FF9900' },
  { id: 'mobikwik', name: 'MobiKwik', logo: require('../../assets/UPI-APP-Logo/mobikwik.jpeg'), color: '#00BAF2' },
  { id: 'freecharge', name: 'Freecharge', logo: 'https://viamm.com/wp-content/uploads/2021/01/Freecharge-Logo.png', color: '#E4173E' },
];

export default function PaymentScreen({ navigation, route }: Props) {
  const { premiumData, activePlan } = route.params;
  const planColor = PLAN_COLORS[activePlan] ?? colors.orange;

  // ─── State ───────────────────────────────────────────────────────────
  const [stage, setStage] = useState<Stage>('checkout');
  const [method, setMethod] = useState<PaymentMethod>('upi');
  const [selectedUpiApp, setSelectedUpiApp] = useState<string | null>(null);
  const [upiId, setUpiId] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [cardName, setCardName] = useState('');
  const [processingStep, setProcessingStep] = useState(0);

  // ─── Animations ──────────────────────────────────────────────────────
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const checkAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
  }, []);

  // Processing step ticker
  useEffect(() => {
    if (stage !== 'processing') return;

    // Pulse the spinner
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    );
    pulse.start();

    // Step through messages
    let step = 0;
    const stepInterval = setInterval(async () => {
      step++;
      if (step < PROCESSING_STEPS.length) {
        setProcessingStep(step);
        Animated.timing(progressAnim, {
          toValue: (step + 1) / PROCESSING_STEPS.length,
          duration: 500,
          useNativeDriver: false,
        }).start();
      } else {
        clearInterval(stepInterval);
        
        // Finalize policy in background
        const premiumAmt = premiumData.plans[activePlan as keyof typeof premiumData.plans].weekly_premium_inr;
        try {
          await purchasePolicy(activePlan, premiumAmt);
          pulse.stop();
          triggerSuccess();
        } catch (error) {
          console.error("Policy Purchase Failed:", error);
          pulse.stop();
          setStage('checkout'); // Fallback if API fails
        }
      }
    }, 900);

    return () => {
      clearInterval(stepInterval);
      pulse.stop();
    };
  }, [stage]);

  const triggerSuccess = () => {
    setStage('success');
    Animated.sequence([
      Animated.spring(scaleAnim, { toValue: 1.15, friction: 4, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 6, useNativeDriver: true }),
    ]).start();
    Animated.timing(checkAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();

    setTimeout(() => {
      navigation.reset({
        index: 0,
        routes: [{ name: 'MainTabs', params: { premiumData, activePlan } }],
      });
    }, 2200);
  };

  const handlePay = () => {
    setProcessingStep(0);
    progressAnim.setValue(1 / PROCESSING_STEPS.length);
    setStage('processing');
  };

  // ─── Helpers ─────────────────────────────────────────────────────────
  const formatCard = (val: string) =>
    val.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim();

  const formatExpiry = (val: string) => {
    const clean = val.replace(/\D/g, '').slice(0, 4);
    return clean.length > 2 ? clean.slice(0, 2) + '/' + clean.slice(2) : clean;
  };

  const canPay = () => {
    if (method === 'upi') return selectedUpiApp !== null || upiId.includes('@');
    if (method === 'card') return cardNumber.replace(/\s/g, '').length === 16 && cardExpiry.length === 5 && cardCvv.length === 3 && cardName.length > 1;
    return true; // netbanking / wallet always enabled for mock
  };

  const planPrice = activePlan === 'basic' ? premiumData?.plans.basic.weekly_premium_inr
    : activePlan === 'standard' ? premiumData?.plans.standard.weekly_premium_inr
      : premiumData?.plans.premium.weekly_premium_inr;
  const displayAmount = planPrice ? `₹${planPrice.toFixed(0)}` : '₹0';

  // ─── Screens ─────────────────────────────────────────────────────────

  if (stage === 'processing') {
    return (
      <View style={styles.fullCenter}>
        <Animated.View style={[styles.processingCard, { transform: [{ scale: pulseAnim }] }]}>
          <View style={styles.processingLogoRing}>
            <ActivityIndicator size="large" color={planColor} />
          </View>
        </Animated.View>

        <Text style={styles.processingTitle}>Processing Payment</Text>
        <Text style={styles.processingSubtitle}>{displayAmount} · {activePlan.charAt(0).toUpperCase() + activePlan.slice(1)} Plan</Text>

        {/* Progress bar */}
        <View style={styles.progressTrack}>
          <Animated.View
            style={[styles.progressFill, {
              width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
              backgroundColor: planColor,
            }]}
          />
        </View>

        <Text style={styles.processingStep}>{PROCESSING_STEPS[processingStep]}</Text>

        <View style={styles.securedRow}>
          <Ionicons name="lock-closed" size={11} color={colors.textSecondary} />
          <Text style={styles.securedText}>256-bit SSL · RBI Compliant</Text>
        </View>
      </View>
    );
  }

  if (stage === 'success') {
    return (
      <View style={styles.fullCenter}>
        <Animated.View style={[styles.successRing, { transform: [{ scale: scaleAnim }] }]}>
          <Animated.View style={{ opacity: checkAnim }}>
            <Ionicons name="checkmark" size={44} color="#00FF88" />
          </Animated.View>
        </Animated.View>

        <Animated.View style={{ opacity: checkAnim, alignItems: 'center' }}>
          <Text style={styles.successTitle}>Payment Successful!</Text>
          <Text style={styles.successAmount}>{displayAmount}</Text>
          <Text style={styles.successSubtitle}>Your {activePlan.charAt(0).toUpperCase() + activePlan.slice(1)} plan is now active</Text>

          <View style={styles.successMeta}>
            <View style={styles.successMetaRow}>
              <Text style={styles.successMetaLabel}>Transaction ID</Text>
              <Text style={styles.successMetaValue}>GG{Date.now().toString().slice(-8)}</Text>
            </View>
            <View style={styles.successMetaRow}>
              <Text style={styles.successMetaLabel}>Time</Text>
              <Text style={styles.successMetaValue}>{new Date().toLocaleTimeString('en-IN')}</Text>
            </View>
            <View style={styles.successMetaRow}>
              <Text style={styles.successMetaLabel}>Status</Text>
              <Text style={[styles.successMetaValue, { color: '#00FF88' }]}>✓ Confirmed</Text>
            </View>
          </View>

          <Text style={styles.redirectHint}>Redirecting to your dashboard...</Text>
        </Animated.View>
      </View>
    );
  }

  // ─── Checkout Screen ──────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.checkoutRoot} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>

          {/* ── Header ── */}
          <View style={styles.header}>
            <View style={styles.merchantRow}>
              <View style={[styles.merchantLogo, { backgroundColor: planColor + '22' }]}>
                <Ionicons name="shield-checkmark" size={20} color={planColor} />
              </View>
              <View>
                <Text style={styles.merchantName}>GigGuard Insurance</Text>
                <Text style={styles.merchantUrl}>gigguard.in · Verified Merchant</Text>
              </View>
              <View style={styles.verifiedBadge}>
                <Ionicons name="checkmark-circle" size={14} color="#00FF88" />
              </View>
            </View>
          </View>

          {/* ── Order Summary ── */}
          <View style={styles.orderCard}>
            <View style={styles.orderRow}>
              <Text style={styles.orderLabel}>{activePlan.charAt(0).toUpperCase() + activePlan.slice(1)} Plan (Weekly)</Text>
              <Text style={styles.orderValue}>{displayAmount}</Text>
            </View>
            <View style={styles.orderRow}>
              <Text style={styles.orderLabel}>GST (18%)</Text>
              <Text style={styles.orderValue}>
                ₹{planPrice ? (planPrice * 0.18).toFixed(0) : '0'}
              </Text>
            </View>
            <View style={styles.orderDivider} />
            <View style={styles.orderRow}>
              <Text style={styles.orderTotal}>Total Payable</Text>
              <Text style={[styles.orderTotalValue, { color: planColor }]}>
                ₹{planPrice ? (planPrice * 1.18).toFixed(0) : '0'}
              </Text>
            </View>
          </View>

          {/* ── Method Tabs ── */}
          <View style={styles.methodTabs}>
            {(['upi', 'card', 'netbanking', 'wallet'] as PaymentMethod[]).map((m) => (
              <TouchableOpacity
                key={m}
                style={[styles.methodTab, method === m && { borderColor: planColor, backgroundColor: planColor + '15' }]}
                onPress={() => setMethod(m)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={m === 'upi' ? 'phone-portrait' : m === 'card' ? 'card' : m === 'netbanking' ? 'business' : 'wallet'}
                  size={16}
                  color={method === m ? planColor : colors.textSecondary}
                />
                <Text style={[styles.methodTabText, method === m && { color: planColor }]}>
                  {m === 'upi' ? 'UPI' : m === 'card' ? 'Card' : m === 'netbanking' ? 'Net Banking' : 'Wallet'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── UPI Method ── */}
          {method === 'upi' && (
            <View style={styles.methodContent}>
              <Text style={styles.sectionLabel}>Pay with UPI App</Text>
              <View style={styles.upiAppsGrid}>
                {UPI_APPS.map((app) => (
                  <TouchableOpacity
                    key={app.id}
                    style={[
                      styles.upiAppTile,
                      selectedUpiApp === app.id && { borderColor: planColor, backgroundColor: planColor + '12' },
                    ]}
                    onPress={() => { setSelectedUpiApp(app.id); setUpiId(''); }}
                    activeOpacity={0.7}
                  >
                    <View style={styles.upiAppIcon}>
                      <Image 
                        source={app.logo} 
                        style={styles.upiAppLogo} 
                        resizeMode="contain" 
                      />
                    </View>
                    <Text style={styles.upiAppName}>{app.name}</Text>
                    {selectedUpiApp === app.id && (
                      <Ionicons name="checkmark-circle" size={14} color={planColor} style={styles.upiCheck} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.orRow}>
                <View style={styles.orLine} />
                <Text style={styles.orText}>OR</Text>
                <View style={styles.orLine} />
              </View>

              <Text style={styles.sectionLabel}>Enter UPI ID</Text>
              <View style={styles.upiInputWrap}>
                <TextInput
                  style={styles.upiInput}
                  placeholder="yourname@upi"
                  placeholderTextColor={colors.textSecondary}
                  value={upiId}
                  onChangeText={(t) => { setUpiId(t); setSelectedUpiApp(null); }}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
                <Text style={styles.upiInputIcon}>@</Text>
              </View>
            </View>
          )}

          {/* ── Card Method ── */}
          {method === 'card' && (
            <View style={styles.methodContent}>
              {/* Mock Card Visual */}
              <View style={[styles.cardVisual, { borderColor: planColor + '40' }]}>
                <View style={styles.cardVisualTop}>
                  <View style={styles.cardChip} />
                  <Text style={styles.cardVisualNetwork}>VISA</Text>
                </View>
                <Text style={styles.cardVisualNumber}>
                  {cardNumber || '•••• •••• •••• ••••'}
                </Text>
                <View style={styles.cardVisualBottom}>
                  <View>
                    <Text style={styles.cardVisualHint}>CARD HOLDER</Text>
                    <Text style={styles.cardVisualValue}>{cardName || 'YOUR NAME'}</Text>
                  </View>
                  <View>
                    <Text style={styles.cardVisualHint}>EXPIRES</Text>
                    <Text style={styles.cardVisualValue}>{cardExpiry || 'MM/YY'}</Text>
                  </View>
                </View>
              </View>

              <TextInput
                style={styles.cardInput}
                placeholder="Card Number"
                placeholderTextColor={colors.textSecondary}
                value={cardNumber}
                onChangeText={(t) => setCardNumber(formatCard(t))}
                keyboardType="number-pad"
                maxLength={19}
              />
              <TextInput
                style={styles.cardInput}
                placeholder="Cardholder Name"
                placeholderTextColor={colors.textSecondary}
                value={cardName}
                onChangeText={setCardName}
                autoCapitalize="words"
              />
              <View style={styles.cardRow}>
                <TextInput
                  style={[styles.cardInput, { flex: 1, marginRight: 8 }]}
                  placeholder="MM/YY"
                  placeholderTextColor={colors.textSecondary}
                  value={cardExpiry}
                  onChangeText={(t) => setCardExpiry(formatExpiry(t))}
                  keyboardType="number-pad"
                  maxLength={5}
                />
                <TextInput
                  style={[styles.cardInput, { flex: 1 }]}
                  placeholder="CVV"
                  placeholderTextColor={colors.textSecondary}
                  value={cardCvv}
                  onChangeText={(t) => setCardCvv(t.replace(/\D/g, '').slice(0, 3))}
                  keyboardType="number-pad"
                  secureTextEntry
                  maxLength={3}
                />
              </View>
            </View>
          )}

          {/* ── Net Banking ── */}
          {method === 'netbanking' && (
            <View style={styles.methodContent}>
              <Text style={styles.sectionLabel}>Select Your Bank</Text>
              {BANKS.map((bank) => (
                <TouchableOpacity key={bank.id} style={styles.bankRow} activeOpacity={0.7}>
                  <View style={[styles.bankIcon, { backgroundColor: bank.logo ? '#fff' : (bank.color + '22') }]}>
                    {bank.logo ? (
                      <Image source={bank.logo} style={styles.bankLogo} resizeMode="contain" />
                    ) : (
                      <Text style={[styles.bankIconText, { color: bank.color }]}>{bank.name[0]}</Text>
                    )}
                  </View>
                  <Text style={styles.bankName}>{bank.name}</Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* ── Wallets ── */}
          {method === 'wallet' && (
            <View style={styles.methodContent}>
              <Text style={styles.sectionLabel}>Select Wallet</Text>
              {WALLETS.map((w) => (
                <TouchableOpacity key={w.id} style={styles.bankRow} activeOpacity={0.7}>
                  <View style={[styles.bankIcon, { backgroundColor: '#fff' }]}>
                    <Image 
                      source={typeof w.logo === 'string' ? { uri: w.logo } : w.logo} 
                      style={styles.bankLogo} 
                      resizeMode="contain" 
                    />
                  </View>
                  <Text style={styles.bankName}>{w.name}</Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* ── Pay Button ── */}
          <TouchableOpacity
            style={[styles.payBtn, { backgroundColor: canPay() ? planColor : planColor + '55' }]}
            onPress={handlePay}
            disabled={!canPay()}
            activeOpacity={0.85}
          >
            <Ionicons name="lock-closed" size={16} color="#000" style={{ marginRight: 8 }} />
            <Text style={styles.payBtnText}>
              Pay ₹{planPrice ? (planPrice * 1.18).toFixed(0) : '0'} Securely
            </Text>
          </TouchableOpacity>

          {/* ── Footer ── */}
          <View style={styles.footer}>
            <Ionicons name="shield-checkmark" size={12} color={colors.textSecondary} />
            <Text style={styles.footerText}>Secured by GigGuard · RBI Licensed · 256-bit Encryption</Text>
          </View>

          <View style={styles.badgeRow}>
            {['UPI', 'VISA', 'MC', 'RuPay'].map((b) => (
              <View key={b} style={styles.networkBadge}>
                <Text style={styles.networkBadgeText}>{b}</Text>
              </View>
            ))}
          </View>

          {/* Hackathon note */}
          <View style={styles.hackBadge}>
            <Ionicons name="information-circle-outline" size={12} color={colors.orange} />
            <Text style={styles.hackText}>HACKATHON DEMO · No real transaction occurs</Text>
          </View>

        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  checkoutRoot: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
  },

  // Header
  header: { marginBottom: 16 },
  merchantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: borderRadius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  merchantLogo: {
    width: 40, height: 40, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  merchantName: { color: colors.textPrimary, fontSize: fontSize.md, fontWeight: fontWeight.bold },
  merchantUrl: { color: colors.textSecondary, fontSize: 11, marginTop: 2 },
  verifiedBadge: { marginLeft: 'auto' },

  // Order summary
  orderCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: borderRadius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
  },
  orderRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  orderLabel: { color: colors.textSecondary, fontSize: fontSize.sm },
  orderValue: { color: colors.textPrimary, fontSize: fontSize.sm, fontWeight: fontWeight.medium },
  orderDivider: { height: 1, backgroundColor: colors.border, marginVertical: 8 },
  orderTotal: { color: colors.textPrimary, fontSize: fontSize.md, fontWeight: fontWeight.bold },
  orderTotalValue: { fontSize: 18, fontWeight: fontWeight.bold },

  // Method tabs
  methodTabs: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  methodTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  methodTabText: { color: colors.textSecondary, fontSize: 10, fontWeight: fontWeight.medium },

  // Method content area
  methodContent: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: borderRadius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 20,
  },
  sectionLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: fontWeight.bold,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 12,
  },

  // UPI apps
  upiAppsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  upiAppTile: {
    width: '47%',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
    position: 'relative',
  },
  upiAppIcon: {
    width: 34, height: 34, borderRadius: 8,
    backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
    padding: 4,
  },
  upiAppLogo: {
    width: '100%',
    height: '100%',
  },
  upiAppIconText: { color: '#fff', fontSize: 11, fontWeight: fontWeight.bold },
  upiAppName: { color: colors.textPrimary, fontSize: 12, fontWeight: fontWeight.medium, flex: 1 },
  upiCheck: { position: 'absolute', top: 6, right: 6 },
  orRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 16, gap: 10 },
  orLine: { flex: 1, height: 1, backgroundColor: colors.border },
  orText: { color: colors.textSecondary, fontSize: 12 },
  upiInputWrap: { position: 'relative' },
  upiInput: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 13,
    color: colors.textPrimary,
    fontSize: fontSize.md,
  },
  upiInputIcon: {
    position: 'absolute', right: 14, top: 13,
    color: colors.textSecondary, fontSize: 18,
  },

  // Card
  cardVisual: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    marginBottom: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  cardVisualTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  cardChip: { width: 30, height: 22, borderRadius: 4, backgroundColor: '#C8A951' },
  cardVisualNetwork: { color: colors.textPrimary, fontSize: 18, fontWeight: fontWeight.bold, fontStyle: 'italic' },
  cardVisualNumber: { color: colors.textPrimary, fontSize: 18, letterSpacing: 3, marginBottom: 20, fontWeight: fontWeight.medium },
  cardVisualBottom: { flexDirection: 'row', justifyContent: 'space-between' },
  cardVisualHint: { color: colors.textSecondary, fontSize: 9, letterSpacing: 1, marginBottom: 2 },
  cardVisualValue: { color: colors.textPrimary, fontSize: 13, fontWeight: fontWeight.medium, textTransform: 'uppercase' },
  cardInput: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 13,
    color: colors.textPrimary,
    fontSize: fontSize.md,
    marginBottom: 10,
  },
  cardRow: { flexDirection: 'row' },

  // Net banking / wallet
  bankRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  bankIcon: {
    width: 36, height: 36, borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', padding: 4,
  },
  bankLogo: { width: '100%', height: '100%' },
  bankIconText: { fontWeight: fontWeight.bold, fontSize: 14 },
  bankName: { color: colors.textPrimary, fontSize: fontSize.md, flex: 1 },

  // Pay button
  payBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.lg,
    paddingVertical: 16,
    marginBottom: 16,
  },
  payBtnText: { color: '#000', fontSize: fontSize.md, fontWeight: fontWeight.bold },

  // Footer
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 12 },
  footerText: { color: colors.textSecondary, fontSize: 10 },
  badgeRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 16 },
  networkBadge: {
    borderWidth: 1, borderColor: colors.border,
    borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3,
  },
  networkBadgeText: { color: colors.textSecondary, fontSize: 10, fontWeight: fontWeight.bold },
  hackBadge: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, marginBottom: 20,
  },
  hackText: { color: colors.orange, fontSize: 9, letterSpacing: 0.5 },

  // ── Processing ──
  fullCenter: {
    flex: 1, backgroundColor: colors.bg,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  processingCard: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 28,
  },
  processingLogoRing: { alignItems: 'center', justifyContent: 'center' },
  processingTitle: { color: colors.textPrimary, fontSize: 20, fontWeight: fontWeight.bold, marginBottom: 6 },
  processingSubtitle: { color: colors.textSecondary, fontSize: fontSize.sm, marginBottom: 28 },
  progressTrack: {
    width: '100%', height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden', marginBottom: 16,
  },
  progressFill: { height: '100%', borderRadius: 2 },
  processingStep: { color: colors.textSecondary, fontSize: fontSize.sm, marginBottom: 20, textAlign: 'center' },
  securedRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  securedText: { color: colors.textSecondary, fontSize: 10 },

  // ── Success ──
  successRing: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: 'rgba(0, 255, 136, 0.08)',
    borderWidth: 2, borderColor: 'rgba(0,255,136,0.3)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 28,
  },
  successTitle: { color: colors.textPrimary, fontSize: 24, fontWeight: fontWeight.bold, marginBottom: 6 },
  successAmount: { color: '#00FF88', fontSize: 36, fontWeight: fontWeight.bold, marginBottom: 4 },
  successSubtitle: { color: colors.textSecondary, fontSize: fontSize.sm, marginBottom: 28 },
  successMeta: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: borderRadius.lg,
    borderWidth: 1, borderColor: colors.border,
    padding: 16, marginBottom: 24,
  },
  successMetaRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  successMetaLabel: { color: colors.textSecondary, fontSize: fontSize.sm },
  successMetaValue: { color: colors.textPrimary, fontSize: fontSize.sm, fontWeight: fontWeight.medium },
  redirectHint: { color: colors.textSecondary, fontSize: 11 },
});