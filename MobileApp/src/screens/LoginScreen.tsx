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
  ActivityIndicator
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, spacing, borderRadius, fontSize, fontWeight, shadows } from '../theme';
import { loginUser } from '../services/api';
import PremiumInput from '../components/PremiumInput';

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
  }, []);

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }
    
    setError('');
    setLoading(true);

    try {
      const res = await loginUser(email, password);
      console.log('Login success! User ID:', res.user_id);
      navigation.navigate('Location');
    } catch (err: any) {
      setError(err.message || 'An error occurred during login');
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

      <KeyboardAvoidingView 
        style={styles.keyboardView} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
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
            
            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <TouchableOpacity style={styles.forgotPassword}>
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
  content: {
    flex: 1,
    paddingHorizontal: spacing.xxl,
    justifyContent: 'center',
  },
  header: {
    marginBottom: spacing.huge,
    alignItems: 'center',
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
  errorText: {
    color: colors.danger,
    fontSize: fontSize.sm,
    marginBottom: spacing.lg,
    textAlign: 'center',
    backgroundColor: colors.dangerDim,
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
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
