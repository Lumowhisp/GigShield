import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Alert, Animated, KeyboardAvoidingView, ScrollView, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import LottieView from 'lottie-react-native';
import { colors, spacing, fontSize, fontWeight, borderRadius, shadows } from '../theme';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { fetchPremium, fetchUserProfile } from '../services/api';

type Props = {
  route: any;
  navigation: NativeStackNavigationProp<any, 'Location'>;
};

const LOTTIE_URLS = {
  location: 'https://lottie.host/5b2a95d9-4924-4cb6-b19c-b9970a7f8699/BAHjchyN2g.lottie',
  headerPin: 'https://lottie.host/c3516b38-07de-44b9-a039-b730fd51526e/XsgVjadZLt.lottie',
  weather: 'https://lottie.host/fcf8c56e-0041-4d4f-96bc-48be260059c4/NyUYcyrXV9.lottie',
  ai: 'https://lottie.host/b5a806b0-3ee4-4f07-9a4b-aa1cdbe068b6/wrGOIro3VA.lottie',
};

export default function LocationPermissionScreen({ navigation, route }: Props) {
  const [incomeStr, setIncomeStr] = useState('800');
  const [isLoading, setIsLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const blob1Anim = useRef(new Animated.Value(0)).current;
  const blob2Anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 50, friction: 8, useNativeDriver: true }),
    ]).start();

    // Subtle background animations matching Auth screens
    Animated.loop(Animated.timing(blob1Anim, { toValue: 1, duration: 25000, useNativeDriver: true })).start();
    Animated.loop(Animated.timing(blob2Anim, { toValue: 1, duration: 20000, useNativeDriver: true })).start();
  }, []);

  const spin1 = blob1Anim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const spin2 = blob2Anim.interpolate({ inputRange: [0, 1], outputRange: ['360deg', '0deg'] });

  const handleContinue = async () => {
    const income = parseFloat(incomeStr);
    if (isNaN(income) || income < 100) {
      Alert.alert('Invalid Income', 'Please enter a valid daily income (min ₹100).');
      return;
    }
    setIsLoading(true);
    setStatusMsg('Requesting GPS permission...');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location is required to calculate zone-based risks.');
        setIsLoading(false);
        return;
      }
      setStatusMsg('Acquiring precision location...');
      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setStatusMsg('Analyzing hyper-local weather risks via AI...');
      const premiumData = await fetchPremium(location.coords.latitude, location.coords.longitude, income);
      setIsLoading(false);

      // Check if we have an active policy from login param
      const activePolicy = route.params?.activePolicy;
      if (activePolicy && activePolicy.status === 'active') {
        const tier = activePolicy.tier.toLowerCase();
        navigation.navigate('MainTabs', { 
          premiumData, 
          activePlan: tier as any 
        });
      } else {
        navigation.navigate('PlanSelection', { premiumData });
      }
    } catch (err: any) {
      setIsLoading(false);
      Alert.alert('API Error', err.message || 'Failed to fetch premium data.');
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <LinearGradient
        colors={[colors.gradientStart, colors.gradientEnd]}
        style={StyleSheet.absoluteFillObject}
      />
      <Animated.View style={[styles.blob, styles.blob1, { transform: [{ rotate: spin1 }, { translateX: 60 }, { translateY: 40 }] }]} />
      <Animated.View style={[styles.blob, styles.blob2, { transform: [{ rotate: spin2 }, { translateX: -50 }, { translateY: -60 }] }]} />

      <ScrollView 
        contentContainerStyle={{ flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>

        <View style={styles.header}>
          <LottieView
            source={{ uri: LOTTIE_URLS.headerPin }}
            autoPlay
            loop
            style={styles.headerLottie}
          />
          <Text style={styles.title}>Where do you ride?</Text>
          <Text style={styles.subtitle}>
            GigGuard uses your live GPS to calculate hyper-local weather risks for your exact zone.
          </Text>
        </View>

        {/* Feature highlights with Lottie animations */}
        <View style={styles.featuresColumn}>
          <View style={styles.featureCard}>
            <View style={styles.lottieContainer}>
              <LottieView
                source={{ uri: LOTTIE_URLS.location }}
                autoPlay
                loop
                style={styles.lottie}
              />
            </View>
            <View style={styles.featureTextContainer}>
              <Text style={styles.featureTitle}>Real-time GPS</Text>
              <Text style={styles.featureDesc}>Precision zone-level risk tracking</Text>
            </View>
          </View>

          <View style={styles.featureCard}>
            <View style={styles.lottieContainer}>
              <LottieView
                source={{ uri: LOTTIE_URLS.weather }}
                autoPlay
                loop
                style={styles.lottie}
              />
            </View>
            <View style={styles.featureTextContainer}>
              <Text style={styles.featureTitle}>5 Risk Triggers</Text>
              <Text style={styles.featureDesc}>Rain, heat, storm, flood, visibility</Text>
            </View>
          </View>

          <View style={styles.featureCard}>
            <View style={styles.lottieContainer}>
              <LottieView
                source={{ uri: LOTTIE_URLS.ai }}
                autoPlay
                loop
                style={styles.lottie}
              />
            </View>
            <View style={styles.featureTextContainer}>
              <Text style={styles.featureTitle}>AI Pricing</Text>
              <Text style={styles.featureDesc}>Dynamic premiums powered by ML</Text>
            </View>
          </View>
        </View>

        {/* Income input */}
        <View style={styles.inputSection}>
          <Text style={styles.inputLabel}>AVERAGE DAILY EARNINGS</Text>
          <View style={styles.inputWrapper}>
            <Text style={styles.currencySymbol}>₹</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={incomeStr}
              onChangeText={setIncomeStr}
              placeholderTextColor={colors.textMuted}
              editable={!isLoading}
            />
            <Text style={styles.inputSuffix}>/day</Text>
          </View>
          <Text style={styles.inputHint}>This sets your maximum coverage payout limit</Text>
        </View>

      </Animated.View>
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        {isLoading && (
          <View style={styles.loadingContainer}>
            <LottieView
              source={{ uri: LOTTIE_URLS.ai }}
              autoPlay
              loop
              style={{ width: 60, height: 60, marginRight: 4, marginLeft: -15 }} // Adjusting margins so text doesn't push too far right
            />
            <Text style={styles.loadingText}>{statusMsg}</Text>
          </View>
        )}
        <TouchableOpacity
          style={styles.buttonShadowWrapper}
          onPress={handleContinue}
          disabled={isLoading}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={[colors.orangeLight, colors.orange]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.primaryButton, isLoading && styles.disabledButton]}
          >
            <Text style={styles.primaryButtonText}>
              {isLoading ? 'Analyzing...' : 'Grant Location & Continue'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  blob: {
    position: 'absolute',
    width: 450,
    height: 450,
    borderRadius: 225,
    opacity: 0.1,
  },
  blob1: {
    top: -50,
    right: -100,
    backgroundColor: colors.orange,
  },
  blob2: {
    bottom: -100,
    left: -150,
    backgroundColor: colors.aqua,
  },
  content: {
    flex: 1,
    padding: spacing.xxl,
    paddingTop: spacing.huge,
  },
  header: {
    marginBottom: spacing.xxl,
  },
  headerLottie: {
    width: 220,
    height: 220,
    marginLeft: -45, // Offset Lottie's internal transparent padding
    marginBottom: -50, // Pull the text right up to the animation
    marginTop: -30,
  },
  title: {
    fontSize: 28,
    fontWeight: fontWeight.heavy,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    lineHeight: 22,
  },

  // Feature cards with Lottie
  featuresColumn: {
    gap: 10,
    marginBottom: spacing.xxl,
  },
  featureCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  lottieContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.bgElevated,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  lottie: {
    width: 48,
    height: 48,
  },
  featureTextContainer: {
    marginLeft: 14,
    flex: 1,
  },
  featureTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  featureDesc: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: 2,
  },

  // Income input
  inputSection: {
    marginBottom: spacing.xxxl,
  },
  inputLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: colors.aqua,
    marginBottom: spacing.md,
    letterSpacing: 1.5,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.xl,
  },
  currencySymbol: {
    fontSize: 24,
    fontWeight: fontWeight.bold,
    color: colors.textMuted,
    marginRight: spacing.sm,
  },
  input: {
    flex: 1,
    height: 60,
    color: colors.textPrimary,
    fontSize: 28,
    fontWeight: fontWeight.heavy,
  },
  inputSuffix: {
    fontSize: fontSize.md,
    color: colors.textMuted,
    marginLeft: spacing.sm,
  },
  inputHint: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },

  // Footer
  footer: {
    padding: spacing.xxl,
    paddingBottom: spacing.huge,
  },
  loadingContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  loadingText: {
    marginLeft: spacing.sm,
    color: colors.aqua,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
  buttonShadowWrapper: {
    shadowColor: colors.orange,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
  },
  primaryButton: {
    paddingVertical: 18,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
  },
  disabledButton: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
  },
});
