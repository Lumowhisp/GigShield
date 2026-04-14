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
  Alert,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSize, fontWeight, borderRadius } from '../theme';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import type { PremiumResponse } from '../services/api';
import { purchasePolicy, createRazorpayOrder, verifyRazorpayOrder, BASE_URL } from '../services/api';
import type { RootStackParamList } from '../../App';
import * as WebBrowser from 'expo-web-browser';

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
  const [razorpayOrderId, setRazorpayOrderId] = useState<string | null>(null);
  const [razorpayPaymentId, setRazorpayPaymentId] = useState<string | null>(null);
  const [razorpaySignature, setRazorpaySignature] = useState<string | null>(null);

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

  // Pulse animation setup
  useEffect(() => {
    if (stage !== 'processing') return;

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    );
    pulse.start();

    return () => pulse.stop();
  }, [stage]);

  // Processing step ticker
  useEffect(() => {
    if (stage !== 'processing') return;

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

        // Finalize policy in background with Razorpay details if available
        const premiumAmt = premiumData.plans[activePlan as keyof typeof premiumData.plans].weekly_premium_inr;
        try {
          await purchasePolicy(
            activePlan,
            premiumAmt,
            premiumData.latitude,
            premiumData.longitude,
            razorpayOrderId || undefined,
            razorpayPaymentId || undefined,
            razorpaySignature || undefined,
          );
          triggerSuccess();
        } catch (error) {
          console.error("Policy Purchase Failed:", error);
          setStage('checkout'); // Fallback if API fails
          Alert.alert('Purchase Failed', 'Could not activate coverage. Please try again.');
        }
      }
    }, 900);

    return () => clearInterval(stepInterval);
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

  const handlePay = async () => {
    const planPrice = premiumData.plans[activePlan as keyof typeof premiumData.plans].weekly_premium_inr;
    const totalAmount = Math.round(planPrice * 1.18); // Including GST

    try {
      // Step 1: Create Razorpay order on backend
      const orderResponse = await createRazorpayOrder(activePlan, totalAmount);

      // Step 2: Open Razorpay checkout in system browser
      const checkoutUrl = `${BASE_URL}/razorpay/checkout?order_id=${orderResponse.order_id}&key_id=${orderResponse.key_id}&amount=${orderResponse.amount_paise}&plan=${activePlan}`;

      const result = await WebBrowser.openBrowserAsync(checkoutUrl, {
        dismissButtonStyle: 'cancel',
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
      });

      // Step 3: After browser closes, VERIFY payment with Razorpay before proceeding
      setRazorpayOrderId(orderResponse.order_id);

      try {
        // Poll verification — Razorpay sandbox has a delay before order status updates to "paid"
        const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
        let paid = false;

        for (let attempt = 1; attempt <= 4; attempt++) {
          await delay(2000); // Wait 2s before each check
          const verification = await verifyRazorpayOrder(orderResponse.order_id);
          console.log(`🔍 Payment verification attempt ${attempt}/4:`, verification);

          if (verification.paid) {
            paid = true;
            break;
          }
        }

        if (paid) {
          // Payment confirmed — proceed to processing
          setProcessingStep(0);
          progressAnim.setValue(1 / PROCESSING_STEPS.length);
          setStage('processing');
        } else {
          // Payment NOT completed — user closed browser without paying
          Alert.alert(
            'Payment Incomplete',
            'Your payment was not completed. Please try again to activate your coverage.',
            [{ text: 'OK' }]
          );
        }
      } catch (verifyError: any) {
        console.error('Payment verification failed:', verifyError);
        Alert.alert(
          'Verification Failed',
          'Could not verify your payment status. Please try again.',
          [{ text: 'OK' }]
        );
      }

    } catch (error: any) {
      console.error('Razorpay order failed:', error);
      Alert.alert(
        'Gateway Unavailable',
        'Payment gateway is currently unreachable. Please check your connection and try again.',
        [{ text: 'OK' }]
      );
    }
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
              <View style={[styles.merchantLogo, { backgroundColor: 'rgba(0, 229, 255, 0.1)' }]}>
                <Ionicons name="shield-checkmark" size={24} color={colors.aqua} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.merchantName}>GigGuard Underwriting</Text>
                <Text style={styles.merchantUrl}>End-to-End Encrypted Handshake</Text>
              </View>
              <View style={styles.verifiedBadgeContainer}>
                <Ionicons name="checkmark-done-circle" size={16} color={colors.success} />
                <Text style={styles.verifiedBadgeText}>VERIFIED</Text>
              </View>
            </View>
          </View>

          {/* ── Order Summary Receipt ── */}
          <View style={styles.orderCard}>
            <View style={styles.receiptHeader}>
              <Ionicons name="receipt-outline" size={16} color={colors.textSecondary} />
              <Text style={styles.sectionLabel}>Digital Receipt</Text>
            </View>

            <View style={styles.orderRow}>
              <Text style={styles.orderLabel}>{activePlan.charAt(0).toUpperCase() + activePlan.slice(1)} Protection (1 Wk)</Text>
              <Text style={styles.orderValue}>{displayAmount}</Text>
            </View>
            <View style={styles.orderRow}>
              <Text style={styles.orderLabel}>GST (18%)</Text>
              <Text style={styles.orderValue}>
                ₹{planPrice ? (planPrice * 0.18).toFixed(0) : '0'}
              </Text>
            </View>

            {/* Dashed divider */}
            <View style={styles.dashedDivider}>
              {[...Array(30)].map((_, i) => <View key={i} style={styles.dashLine} />)}
            </View>

            <View style={styles.orderRow}>
              <Text style={styles.orderTotal}>Total Payable</Text>
              <Text style={[styles.orderTotalValue, { color: planColor }]}>
                ₹{planPrice ? (planPrice * 1.18).toFixed(0) : '0'}
              </Text>
            </View>
          </View>

          <View style={styles.trustSignalsContainer}>
            <View style={styles.trustSignal}>
              <View style={styles.trustIconWrap}><Ionicons name="shield-half-outline" size={16} color={colors.aqua} /></View>
              <Text style={styles.trustText}>Bank-Grade{"\n"}Security</Text>
            </View>
            <View style={styles.trustSignal}>
              <View style={[styles.trustIconWrap, { borderColor: 'rgba(255, 107, 53, 0.3)' }]}><Ionicons name="lock-closed-outline" size={16} color={colors.orange} /></View>
              <Text style={styles.trustText}>PCI-DSS{"\n"}Compliant</Text>
            </View>
            <View style={styles.trustSignal}>
              <View style={[styles.trustIconWrap, { borderColor: 'rgba(0, 230, 118, 0.3)' }]}><Ionicons name="business-outline" size={16} color={colors.success} /></View>
              <Text style={styles.trustText}>RBI Regulated{"\n"}Gateway</Text>
            </View>
          </View>

          <View style={styles.gatewayCard}>
            <View style={styles.gatewayHeader}>
              <View style={styles.poweredByWrap}>
                <Text style={styles.poweredByText}>Secured by</Text>
                <Text style={styles.razorpayText}>RAZORPAY</Text>
              </View>
              <View style={styles.gatewayPulse}>
                <View style={styles.pulseInner} />
                <Text style={styles.gatewayActiveText}>GATEWAY ACTIVE</Text>
              </View>
            </View>
            <Text style={styles.gatewayDesc}>
              You will be securely redirected to India's most trusted gateway. All UPI apps, Credit/Debit cards, and NetBanking supported.
            </Text>

            <View style={styles.gatewayLogos}>
              {['UPI', 'VISA', 'MasterCard', 'NetBanking'].map(method => (
                <View key={method} style={styles.gLogo}>
                  <Text style={styles.gLogoText}>{method}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* ── Pay Button ── */}
          <TouchableOpacity
            style={[styles.payBtn, { backgroundColor: planColor }]}
            onPress={handlePay}
            activeOpacity={0.85}
          >
            <Ionicons name="open-outline" size={18} color="#000" style={{ marginRight: 8 }} />
            <Text style={styles.payBtnText}>
              Pay ₹{planPrice ? (planPrice * 1.18).toFixed(0) : '0'} via Razorpay
            </Text>
          </TouchableOpacity>

          {/* ── Footer ── */}
          <View style={styles.footer}>
            <Ionicons name="shield-checkmark" size={12} color={colors.textSecondary} />
            <Text style={styles.footerText}>Secured by GigGuard · RBI Licensed · 256-bit Encryption</Text>
          </View>

          {/* Hackathon note */}
          <View style={styles.hackBadge}>
            <Ionicons name="information-circle-outline" size={12} color={colors.orange} />
            <Text style={styles.hackText}>RAZORPAY SANDBOX · Test payment gateway active</Text>
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
  header: { marginBottom: 20 },
  merchantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: borderRadius.xl,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    gap: 14,
  },
  merchantLogo: {
    width: 48, height: 48, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(0, 229, 255, 0.3)',
  },
  merchantName: { color: colors.textPrimary, fontSize: 15, fontWeight: fontWeight.bold, letterSpacing: 0.5 },
  merchantUrl: { color: colors.aqua, fontSize: 10, marginTop: 4, letterSpacing: 0.5, fontWeight: fontWeight.bold },
  verifiedBadgeContainer: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 230, 118, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(0, 230, 118, 0.2)',
  },
  verifiedBadgeText: { color: colors.success, fontSize: 8, fontWeight: fontWeight.bold, marginTop: 2 },

  // Order summary receipt
  orderCard: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: borderRadius.xl,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    marginBottom: 24,
  },
  receiptHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 20,
  },
  sectionLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: fontWeight.bold,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  orderRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16, alignItems: 'center' },
  orderLabel: { color: colors.textSecondary, fontSize: fontSize.md, fontWeight: fontWeight.medium },
  orderValue: { color: colors.textPrimary, fontSize: fontSize.md, fontWeight: fontWeight.bold },

  dashedDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    marginVertical: 12,
    marginBottom: 20,
    opacity: 0.4,
  },
  dashLine: {
    width: 6,
    height: 1.5,
    backgroundColor: colors.textSecondary,
    marginRight: 4,
  },

  orderTotal: { color: colors.textPrimary, fontSize: 16, fontWeight: fontWeight.bold, textTransform: 'uppercase', letterSpacing: 0.5 },
  orderTotalValue: { fontSize: 26, fontWeight: fontWeight.heavy },

  // Trust Signals
  trustSignalsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
    gap: 10,
  },
  trustSignal: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.01)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
    borderRadius: borderRadius.lg,
    padding: 12,
    alignItems: 'center',
  },
  trustIconWrap: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1, borderColor: 'rgba(0, 229, 255, 0.3)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 8,
  },
  trustText: {
    color: colors.textSecondary, fontSize: 10, textAlign: 'center', fontWeight: fontWeight.bold, lineHeight: 14,
  },

  // Gateway Info Box
  gatewayCard: {
    backgroundColor: 'rgba(0, 229, 255, 0.03)',
    borderRadius: borderRadius.xl,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.15)',
    marginBottom: 24,
  },
  gatewayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  poweredByWrap: {
    flexDirection: 'column',
    justifyContent: 'center',
  },
  poweredByText: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: fontWeight.medium,
    letterSpacing: 0.5,
  },
  razorpayText: {
    color: '#008cff', // Razorpay Blue
    fontSize: 16,
    fontWeight: fontWeight.heavy,
    letterSpacing: 1,
    marginTop: 2,
  },
  gatewayPulse: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(0, 230, 118, 0.1)',
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: borderRadius.full,
    borderWidth: 1, borderColor: 'rgba(0, 230, 118, 0.3)',
  },
  pulseInner: {
    width: 6, height: 6, borderRadius: 3, backgroundColor: colors.success,
  },
  gatewayActiveText: { color: colors.success, fontSize: 9, fontWeight: fontWeight.bold, letterSpacing: 0.5 },
  gatewayDesc: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  gatewayLogos: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  gLogo: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  gLogoText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: fontWeight.bold,
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