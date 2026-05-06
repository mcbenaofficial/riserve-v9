import React, { useState } from "react";
import {
  View, Text, TextInput, StyleSheet, KeyboardAvoidingView,
  Platform, TouchableOpacity, Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { router } from "expo-router";
import { useAuth } from "../../hooks/useAuth";
import { useTheme } from "../../hooks/useTheme";

export default function LoginScreen() {
  const { login } = useAuth();
  const { C, isDark } = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) return;
    setLoading(true);
    try {
      await login(email.trim().toLowerCase(), password);
      router.replace("/(tabs)");
    } catch {
      Alert.alert("Login failed", "Check your credentials and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {isDark && (
        <LinearGradient colors={["#0D0D1A", "#0A0A0C"]} style={StyleSheet.absoluteFill} />
      )}
      <View style={[styles.glow, { backgroundColor: isDark ? "rgba(107,127,215,0.12)" : "rgba(107,127,215,0.07)" }]} />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.center}
      >
        <View style={[styles.card, { borderColor: C.border }]}>
          <BlurView intensity={20} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? "rgba(14,14,22,0.6)" : "rgba(255,255,255,0.75)" }]} />

          <View style={{ position: "relative" }}>
            <Text style={[styles.eyebrow, { color: C.textFaint }]}>RI'SERVE</Text>
            <Text style={[styles.title, { color: C.text }]}>Staff Portal</Text>
            <Text style={[styles.subtitle, { color: C.textMuted }]}>Sign in to your account</Text>

            <View style={styles.inputWrap}>
              <Text style={[styles.inputLabel, { color: C.textFaint }]}>Email</Text>
              <TextInput
                style={[styles.input, { backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)", borderColor: C.border, color: C.text }]}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholderTextColor={C.textFaint}
                placeholder="you@example.com"
              />
            </View>

            <View style={styles.inputWrap}>
              <Text style={[styles.inputLabel, { color: C.textFaint }]}>Password</Text>
              <TextInput
                style={[styles.input, { backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)", borderColor: C.border, color: C.text }]}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholderTextColor={C.textFaint}
                placeholder="••••••••"
              />
            </View>

            <TouchableOpacity
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.8}
              style={styles.btnWrap}
            >
              <LinearGradient
                colors={["#6B7FD7", "#4A5FC4"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.btn}
              >
                <Text style={styles.btnText}>{loading ? "Signing in…" : "Sign In"}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  glow: {
    position: "absolute", top: -100, left: "25%",
    width: 280, height: 280, borderRadius: 140,
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  card: {
    width: "100%", maxWidth: 380,
    borderRadius: 24, overflow: "hidden",
    borderWidth: 1, padding: 28,
  },
  eyebrow: { fontSize: 10, letterSpacing: 3, textTransform: "uppercase", marginBottom: 4 },
  title: { fontSize: 26, fontWeight: "700", marginBottom: 4 },
  subtitle: { fontSize: 13, marginBottom: 28 },
  inputWrap: { marginBottom: 16 },
  inputLabel: { fontSize: 11, letterSpacing: 0.5, marginBottom: 6 },
  input: {
    borderWidth: 1, borderRadius: 10, padding: 12,
    fontSize: 14,
  },
  btnWrap: { marginTop: 8, borderRadius: 12, overflow: "hidden" },
  btn: { paddingVertical: 13, alignItems: "center", borderRadius: 12 },
  btnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
