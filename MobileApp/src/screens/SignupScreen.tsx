import React, { useState, useRef, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  KeyboardAvoidingView, 
  Platform,
  Animated,
  ActivityIndicator,
  ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, spacing, borderRadius, fontSize, fontWeight, shadows } from '../theme';
import { registerUser, syncFirebaseUser } from '../services/api';
import PremiumInput from '../components/PremiumInput';
import { auth } from '../config/firebaseConfig';
import { createUserWithEmailAndPassword } from 'firebase/auth';

type AuthStackParamList = {
  Login: undefined;
  Signup: undefined;
  Location: undefined;
};

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'Signup'>;
};

export default function SignupScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const blob1Anim = useRef(new Animated.Value(0)).current;
  const blob2Anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 40,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();

    // Orbital blob animations for a premium 3D feel
    Animated.loop(
      Animated.timing(blob1Anim, { toValue: 1, duration: 15000, useNativeDriver: true })
    ).start();
    Animated.loop(
      Animated.timing(blob2Anim, { toValue: 1, duration: 20000, useNativeDriver: true })
    ).start();
  }, []);

  const spin1 = blob1Anim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const spin2 = blob2Anim.interpolate({ inputRange: [0, 1], outputRange: ['360deg', '0deg'] });

  const handleSignup = async () => {
    if (!email || !password || !confirmPassword) {
      setError('Please fill in all fields.');
      return;
    }

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    // Granular password validation feedback
    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    if (!/[A-Z]/.test(password)) {
      setError('Please add at least one uppercase letter (A-Z).');
      return;
    }
    if (!/[a-z]/.test(password)) {
      setError('Please add at least one lowercase letter (a-z).');
      return;
    }
    if (!/\d/.test(password)) {
      setError('Please add at least one number (0-9).');
      return;
    }
    if (!/[@$!%*?&#]/.test(password)) {
      setError('Please add at least one special character (e.g., @, $, !, %).');
      return;
    }

    setError('');
    setLoading(true);

    try {
      // 1. Firebase Register
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      console.log('Firebase Register success! UID:', user.uid);
      
      // 2. Sync with MongoDB
      await syncFirebaseUser(email, user.uid);

      navigation.navigate('Location');
    } catch (err: any) {
      let friendlyError = 'An error occurred during registration.';
      if (err.code === 'auth/email-already-in-use') {
        friendlyError = 'An account with this email already exists.';
      } else if (err.code === 'auth/invalid-email') {
        friendlyError = 'Please enter a valid email address.';
      } else if (err.code === 'auth/weak-password') {
        friendlyError = 'Your password is too weak. Please choose a stronger one.';
      } else if (err.message) {
        friendlyError = err.message.replace(/Firebase:\s*/, '').replace(/\(auth\/.*\)\.?/, '').trim();
      }
      setError(friendlyError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[colors.gradientStart, colors.gradientEnd]}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Premium Animated Plasma Blobs */}
      <Animated.View style={[styles.blob, styles.blob1, { transform: [{ rotate: spin1 }, { translateX: 50 }, { translateY: 50 }] }]} />
      <Animated.View style={[styles.blob, styles.blob2, { transform: [{ rotate: spin2 }, { translateX: -40 }, { translateY: -40 }] }]} />

      <KeyboardAvoidingView 
        style={styles.keyboardView} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View 
            style={[
              styles.content,
              { 
                opacity: fadeAnim, 
                transform: [{ translateY: slideAnim }] 
              }
            ]}
          >
            <View style={styles.header}>
              <View style={styles.iconWrapper}>
                <Ionicons name="shield-half" size={42} color={colors.orange} />
              </View>
              <Text style={styles.brandTitle}>Onboarding</Text>
              <Text style={styles.title}>Apply For Coverage</Text>
              <Text style={styles.subtitle}>Protect your daily gig income starting today</Text>
            </View>

            <View style={styles.formContainer}>
              <LinearGradient
                colors={['rgba(255,255,255,0.03)', 'rgba(255,255,255,0.01)']}
                style={[StyleSheet.absoluteFillObject, { borderRadius: borderRadius.xl }]}
              />

              <PremiumInput
                label="Email Address"
                themeColor={colors.aqua}
                value={email}
                onChangeText={(text) => { setEmail(text); setError(''); }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />

              <PremiumInput
                label="Create Password"
                themeColor={colors.aqua}
                value={password}
                onChangeText={(text) => { setPassword(text); setError(''); }}
                isPassword
              />

              <View style={{ marginBottom: spacing.sm }}>
                <PremiumInput
                  label="Confirm Password"
                  themeColor={colors.aqua}
                  value={confirmPassword}
                  onChangeText={(text) => { setConfirmPassword(text); setError(''); }}
                  isPassword
                />
              </View>
              
              {error ? (
                <Animated.View style={styles.errorContainer}>
                  <Ionicons name="alert-circle-outline" size={20} color={colors.aqua} />
                  <Text style={styles.errorText}>{error}</Text>
                </Animated.View>
              ) : null}

              <TouchableOpacity 
                activeOpacity={0.8}
                onPress={handleSignup}
                disabled={loading}
                style={styles.buttonShadowWrapper}
              >
                <LinearGradient
                  colors={[colors.aquaLight, colors.aqua]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.signupButtonGlow}
                >
                  {loading ? (
                    <ActivityIndicator color={colors.bg} />
                  ) : (
                    <Text style={styles.signupButtonText}>Create Account</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>

            </View>

            <View style={styles.footer}>
              <Text style={styles.footerText}>Already protected? </Text>
              <TouchableOpacity 
                activeOpacity={0.8}
                onPress={() => navigation.navigate('Login')}
              >
                <Text style={styles.loginText}>Sign In</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.xxl,
    justifyContent: 'center',
  },
  blob: {
    position: 'absolute',
    width: 400,
    height: 400,
    borderRadius: 200,
    opacity: 0.08,
  },
  blob1: {
    top: -100,
    right: -100,
    backgroundColor: colors.orange,
  },
  blob2: {
    bottom: -100,
    left: -100,
    backgroundColor: colors.aqua,
  },
  header: {
    marginBottom: spacing.xxxl,
    alignItems: 'center',
  },
  iconWrapper: {
    marginBottom: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.orangeDim,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.orangeBorder,
  },
  brandTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.orange,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: fontSize.xxxl,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: '85%',
    lineHeight: 22,
  },
  formContainer: {
    padding: spacing.xxl,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  buttonShadowWrapper: {
    shadowColor: colors.aqua,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
  },
  signupButtonGlow: {
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signupButtonText: {
    color: colors.bg,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    letterSpacing: 0.5,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 229, 255, 0.08)', // Using brand aqua instead of red
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.25)',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  errorText: {
    color: colors.aquaLight,
    fontSize: fontSize.sm,
    marginLeft: spacing.sm,
    fontWeight: fontWeight.medium,
    flex: 1,
  },
  // ── Divider ──
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.xl,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  dividerText: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    marginHorizontal: spacing.md,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  // ── Google Button ──
  googleButton: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: borderRadius.md,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  googleIcon: {
    fontSize: 20,
    fontWeight: '800' as any,
    color: '#4285F4',
    backgroundColor: 'rgba(255,255,255,0.9)',
    width: 28,
    height: 28,
    textAlign: 'center',
    lineHeight: 28,
    borderRadius: 6,
    overflow: 'hidden',
  },
  googleButtonText: {
    color: colors.textPrimary,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    letterSpacing: 0.3,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.xxxl,
    alignItems: 'center',
  },
  footerText: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
  },
  loginText: {
    color: colors.orange,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    marginLeft: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
