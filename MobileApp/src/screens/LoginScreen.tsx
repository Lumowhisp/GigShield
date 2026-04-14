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
  Alert,
  ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, spacing, borderRadius, fontSize, fontWeight, shadows } from '../theme';
import { loginUser, syncFirebaseUser, fetchUserProfile } from '../services/api';
import PremiumInput from '../components/PremiumInput';
import { auth } from '../config/firebaseConfig';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';

type AuthStackParamList = {
  Login: undefined;
  Signup: undefined;
  Location: undefined;
};

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'Login'>;
};

export default function LoginScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }
    
    setError('');
    setLoading(true);

    try {
      // 1. Firebase Sign In
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      console.log('Firebase Login success! UID:', user.uid);
      
      // 2. Sync with MongoDB & Get Profile
      await syncFirebaseUser(email, user.uid);
      const profileData = await fetchUserProfile();
      
      if (profileData.active_policy && profileData.active_policy.status === 'active') {
        navigation.navigate('Location' as any, { activePolicy: profileData.active_policy });
      } else {
        navigation.navigate('Location' as any);
      }
    } catch (err: any) {
      let friendlyError = 'An error occurred during login';
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        friendlyError = 'Invalid email or password. Please try again.';
      } else if (err.code === 'auth/too-many-requests') {
        friendlyError = 'Too many failed attempts. Please reset your password or try again later.';
      } else if (err.code === 'auth/invalid-email') {
        friendlyError = 'Please enter a valid email address.';
      } else if (err.message) {
        // Fallback for general errors but strip out 'Firebase:' text if present
        friendlyError = err.message.replace(/Firebase:\s*/, '').replace(/\(auth\/.*\)\.?/, '').trim();
      }
      setError(friendlyError);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError('Please enter your email address first.');
      return;
    }
    
    try {
      await sendPasswordResetEmail(auth, email);
      Alert.alert(
        "Password Reset Sent",
        "Check your email for a link to reset your password.",
        [{ text: "OK" }]
      );
    } catch (err: any) {
      let friendlyError = 'Failed to send reset email';
      if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
        friendlyError = 'No account found with this email address.';
      } else if (err.code === 'auth/invalid-email') {
        friendlyError = 'Please enter a valid email address.';
      } else if (err.message) {
        friendlyError = err.message.replace(/Firebase:\s*/, '').replace(/\(auth\/.*\)\.?/, '').trim();
      }
      setError(friendlyError);
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
                <Ionicons name="shield-checkmark" size={42} color={colors.aqua} />
              </View>
              <Text style={styles.brandTitle}>GigGuard</Text>
              <Text style={styles.title}>Welcome Back</Text>
              <Text style={styles.subtitle}>Enter your credentials to access your live dashboard</Text>
            </View>

            <View style={styles.formContainer}>
              <LinearGradient
                colors={['rgba(255,255,255,0.03)', 'rgba(255,255,255,0.01)']}
                style={[StyleSheet.absoluteFillObject, { borderRadius: borderRadius.xl }]}
              />
              
              <PremiumInput
                label="Email Address"
                themeColor={colors.orange}
                value={email}
                onChangeText={(text) => { setEmail(text); setError(''); }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />

              <PremiumInput
                label="Password"
                themeColor={colors.orange}
                value={password}
                onChangeText={(text) => { setPassword(text); setError(''); }}
                isPassword
              />
              
              {error ? (
                <Animated.View style={styles.errorContainer}>
                  <Ionicons name="alert-circle-outline" size={20} color={colors.orange} />
                  <Text style={styles.errorText}>{error}</Text>
                </Animated.View>
              ) : null}

              <TouchableOpacity style={styles.forgotPassword} onPress={handleForgotPassword}>
                <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                activeOpacity={0.8}
                onPress={handleLogin}
                disabled={loading}
                style={styles.buttonShadowWrapper}
              >
                <LinearGradient
                  colors={[colors.orangeLight, colors.orange]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.loginButtonGlow}
                >
                  {loading ? (
                    <ActivityIndicator color={colors.textPrimary} />
                  ) : (
                    <Text style={styles.loginButtonText}>Sign In</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>

            </View>

            <View style={styles.footer}>
              <Text style={styles.footerText}>Don't have an account? </Text>
              <TouchableOpacity 
                activeOpacity={0.8}
                onPress={() => navigation.navigate('Signup' as any)}
              >
                <Text style={styles.signupText}>Apply for Coverage</Text>
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
    backgroundColor: colors.aqua,
  },
  blob2: {
    bottom: -100,
    left: -100,
    backgroundColor: colors.orange,
  },
  header: {
    marginBottom: spacing.huge,
    alignItems: 'center',
  },
  iconWrapper: {
    marginBottom: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.aquaDim,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.aquaBorder,
  },
  brandTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.aqua,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: fontSize.hero,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: '80%',
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
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: spacing.xxl,
  },
  forgotPasswordText: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
  },
  buttonShadowWrapper: {
    shadowColor: colors.orange,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
  },
  loginButtonGlow: {
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginButtonText: {
    color: colors.textPrimary,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    letterSpacing: 0.5,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 107, 53, 0.08)', // Using the brand orange instead of harsh red
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 53, 0.25)',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  errorText: {
    color: colors.orangeLight,
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
  signupText: {
    color: colors.aqua,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    marginLeft: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
