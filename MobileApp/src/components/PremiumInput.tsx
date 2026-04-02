import React, { useRef, useEffect, useState } from 'react';
import { View, TextInput, Animated, StyleSheet, TextInputProps, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, fontSize, fontWeight } from '../theme';

interface PremiumInputProps extends TextInputProps {
  label: string;
  themeColor?: string;
  value: string;
  isPassword?: boolean;
}

export default function PremiumInput({ 
  label, 
  themeColor = colors.aqua, 
  value, 
  onFocus, 
  onBlur, 
  isPassword = false,
  ...props 
}: PremiumInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const floatAnim = useRef(new Animated.Value(value ? 1 : 0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Floating label effect
  useEffect(() => {
    Animated.timing(floatAnim, {
      toValue: isFocused || !!value ? 1 : 0,
      duration: 200,
      useNativeDriver: false, // Color interpolation requires false
    }).start();
  }, [isFocused, !!value]);

  // Keyboard typing "pulse" effect
  useEffect(() => {
    if (value && value.length > 0) {
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.02, duration: 50, useNativeDriver: true }),
        Animated.spring(pulseAnim, { toValue: 1, friction: 3, tension: 40, useNativeDriver: true })
      ]).start();
    }
  }, [value]);

  const handleFocus = (e: any) => {
    setIsFocused(true);
    if (onFocus) onFocus(e);
  };

  const handleBlur = (e: any) => {
    setIsFocused(false);
    if (onBlur) onBlur(e);
  };

  const labelTranslateY = floatAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [20, 8],
  });
  
  const labelScale = floatAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.75], // Make it much smaller when floating
  });

  const labelColor = floatAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.textMuted, themeColor],
  });

  return (
    <Animated.View style={[
      styles.container, 
      isFocused && { borderColor: themeColor },
      !isFocused && !!value && { borderColor: 'rgba(255,255,255,0.15)' },
      { transform: [{ scale: pulseAnim }] } // The typing interaction effect!
    ]}>
      {/* Background tint overlay when focused */}
      {isFocused && (
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: themeColor, opacity: 0.05 }]} />
      )}
      
      <Animated.Text style={[styles.label, { 
        color: labelColor, 
        transform: [
          { translateY: labelTranslateY }, 
          { scale: labelScale },
          { translateX: floatAnim.interpolate({inputRange: [0,1], outputRange: [0, -12]}) }
        ] 
      }]}>
        {label}
      </Animated.Text>
      
      <View style={styles.inputRow}>
        <TextInput
          style={[
            styles.input, 
            { color: isFocused ? colors.textPrimary : colors.textSecondary },
            isPassword && { paddingRight: 40 }
          ]}
          value={value}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholderTextColor="transparent"
          secureTextEntry={isPassword && !showPassword}
          {...props}
        />
        {isPassword && (
          <TouchableOpacity 
            style={styles.eyeIcon} 
            onPress={() => setShowPassword(!showPassword)}
            activeOpacity={0.7}
          >
            <Ionicons 
              name={showPassword ? "eye-off-outline" : "eye-outline"} 
              size={20} 
              color={isFocused ? themeColor : colors.textMuted} 
            />
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    height: 64, // Fixed height to allow floating inner label
    overflow: 'hidden',
    position: 'relative',
    marginBottom: spacing.xl,
  },
  label: {
    position: 'absolute',
    left: spacing.lg,
    top: 0,
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    zIndex: 1,
  },
  inputRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 2,
  },
  input: {
    flex: 1,
    marginTop: 18,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
  },
  eyeIcon: {
    position: 'absolute',
    right: spacing.md,
    height: '100%',
    justifyContent: 'center',
    paddingTop: 18, // Aligns with the input text
  }
});
