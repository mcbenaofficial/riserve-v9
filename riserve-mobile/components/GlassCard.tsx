import React from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../hooks/useTheme";
import { NoiseOverlay } from "./NoiseOverlay";

interface GlassCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  intensity?: number;
  gradient?: [string, string];
  borderColor?: string;
  borderWidth?: number;
  noiseOpacity?: number;
}

export function GlassCard({
  children,
  style,
  intensity,
  gradient,
  borderColor,
  borderWidth = 1,
  noiseOpacity,
}: GlassCardProps) {
  const { C, isDark } = useTheme();
  const resolvedBorder = borderColor ?? C.border;
  const blurIntensity = intensity ?? (isDark ? 62 : 72);

  return (
    <View
      style={[
        styles.wrapper,
        {
          borderColor: resolvedBorder,
          borderWidth,
          shadowColor: isDark ? "#000" : "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: isDark ? 0.28 : 0.08,
          shadowRadius: 10,
          elevation: 4,
        },
        style,
      ]}
    >
      {/* Core blur layer */}
      <BlurView
        intensity={blurIntensity}
        tint={isDark ? "dark" : "light"}
        style={StyleSheet.absoluteFill}
      />

      {/* Color tint — kept intentionally thin so blur breathes */}
      {isDark && gradient ? (
        <LinearGradient
          colors={gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      ) : (
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: isDark
                ? "rgba(28,25,21,0.44)"
                : "rgba(255,255,255,0.62)",
            },
          ]}
        />
      )}

      {/* Top specular sheen — fades from white at top to transparent */}
      <LinearGradient
        colors={
          isDark
            ? ["rgba(255,255,255,0.065)", "rgba(255,255,255,0.0)"]
            : ["rgba(255,255,255,0.88)", "rgba(255,255,255,0.0)"]
        }
        style={[StyleSheet.absoluteFill, styles.sheen]}
        pointerEvents="none"
      />

      {/* 1px top-edge specular line (pure apple glass tell) */}
      <View
        style={[
          styles.specular,
          {
            backgroundColor: isDark
              ? "rgba(255,255,255,0.10)"
              : "rgba(255,255,255,0.95)",
          },
        ]}
        pointerEvents="none"
      />

      {/* Grain texture */}
      <NoiseOverlay opacity={noiseOpacity ?? (isDark ? 0.032 : 0.018)} />

      {/* Content sits above all layers */}
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: 16,
    overflow: "hidden",
    position: "relative",
  },
  sheen: {
    height: "55%",
  },
  specular: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 1,
  },
  content: {
    position: "relative",
  },
});
