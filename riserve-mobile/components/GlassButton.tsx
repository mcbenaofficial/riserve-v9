import React from "react";
import {
  TouchableOpacity, Text, StyleSheet, ViewStyle, TextStyle, ActivityIndicator, View,
} from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../hooks/useTheme";

type Variant = "accent" | "outline" | "ghost" | "danger";

interface GlassButtonProps {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  loading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  disabled?: boolean;
}

export function GlassButton({
  label, onPress, variant = "outline", loading = false, style, textStyle, disabled,
}: GlassButtonProps) {
  const { C, isDark } = useTheme();

  const VARIANTS: Record<Variant, { bg: string; border: string; text: string; gradient?: [string, string] }> = {
    accent:  { bg: "transparent",  border: C.accentBorder,  text: C.accentLight,  gradient: [C.accent, C.accentLight] },
    outline: { bg: C.accentBg,     border: C.accentBorder,  text: C.accentLight },
    ghost:   { bg: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)", border: C.borderFaint, text: C.textMuted },
    danger:  { bg: C.errorBg,      border: C.errorBorder,   text: isDark ? "#D4887E" : C.error },
  };

  const v = VARIANTS[variant];

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.72}
      style={[
        styles.base,
        {
          borderColor: v.border,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: isDark ? 0.22 : 0.06,
          shadowRadius: 8,
          elevation: 3,
        },
        style,
      ]}
    >
      <BlurView intensity={isDark ? 52 : 62} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} />
      {v.gradient ? (
        <LinearGradient
          colors={v.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[StyleSheet.absoluteFill, { opacity: 0.72 }]}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: v.bg }]} />
      )}
      {/* Top specular */}
      <LinearGradient
        colors={["rgba(255,255,255,0.10)", "rgba(255,255,255,0.0)"]}
        style={[StyleSheet.absoluteFill, { height: "60%" }]}
        pointerEvents="none"
      />
      <View
        style={[styles.specular, { backgroundColor: isDark ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.90)" }]}
        pointerEvents="none"
      />
      {loading
        ? <ActivityIndicator color={v.text} size="small" style={{ position: "relative" }} />
        : <Text style={[styles.label, { color: v.text }, textStyle]}>{label}</Text>
      }
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    position: "relative",
  },
  specular: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 1,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    position: "relative",
  },
});
