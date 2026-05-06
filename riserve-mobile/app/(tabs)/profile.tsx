import React, { useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import {
  CalendarDays, Coffee, Leaf, Banknote, Sparkles, BookOpen, Star, ChevronRight, Moon, Sun,
} from "lucide-react-native";
import { router } from "expo-router";
import { useTheme } from "../../hooks/useTheme";
import { Colors } from "../../constants/colors";
import { GlassCard } from "../../components/GlassCard";
import { GlassButton } from "../../components/GlassButton";
import { NoiseOverlay } from "../../components/NoiseOverlay";
import { useAuth } from "../../hooks/useAuth";

const PROFILE_ITEMS = [
  { Icon: CalendarDays, label: "Shift Schedule",    sub: "Next: Tomorrow 9:00 AM",       route: "schedule" },
  { Icon: Coffee,       label: "Break Log",          sub: "1 break taken today · 15 min", route: "breaks" },
  { Icon: Leaf,         label: "Leave Management",   sub: "3 days pending approval",       route: "leaves" },
  { Icon: Banknote,     label: "Payroll",            sub: "Last payout: Apr 30",           route: "payroll" },
  { Icon: Sparkles,     label: "Tips",               sub: "This week: ₹2,340",             route: "tips" },
  { Icon: BookOpen,     label: "Training & SOPs",    sub: "2 new modules added",           route: "training" },
];

const REP_BREAKDOWN = [
  { label: "Service Quality", score: 4.9 },
  { label: "Speed",           score: 4.6 },
  { label: "Friendliness",    score: 5.0 },
  { label: "Accuracy",        score: 4.7 },
];

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const { C, isDark, toggleTheme } = useTheme();
  const styles = useMemo(() => createStyles(C), [C]);

  const initials = user?.name
    ? user.name.split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase()
    : "?";

  return (
    <View style={styles.bg}>
      {isDark && <LinearGradient colors={["#1C1612", "#12100D"]} style={StyleSheet.absoluteFill} />}
      <NoiseOverlay />

      <View style={styles.headerBar}>
        <Text style={styles.headerTitle}>Profile</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Avatar card */}
        <GlassCard style={styles.avatarCard} borderColor={C.border}>
          <View style={{ alignItems: "center", padding: 20 }}>
            <LinearGradient
              colors={[C.restaurantBg, "rgba(232,184,109,0.1)"]}
              style={styles.avatar}
            >
              <Text style={[styles.avatarText, { color: C.restaurantLight }]}>{initials}</Text>
            </LinearGradient>
            <Text style={styles.name}>{user?.name ?? "—"}</Text>
            <Text style={styles.role}>{user?.role ?? "Staff"} · Restaurant</Text>

            <View style={styles.statsRow}>
              {([["4.8", "Rep Score", C.restaurant], ["142", "Reviews", C.success], ["₹8.2K", "Tips MTD", C.accent]] as [string, string, string][]).map(
                ([val, sub, col]) => (
                  <View key={sub} style={{ alignItems: "center" }}>
                    <Text style={[styles.statVal, { color: col }]}>{val}</Text>
                    <Text style={styles.statSub}>{sub}</Text>
                  </View>
                )
              )}
            </View>
          </View>
        </GlassCard>

        {/* Rep breakdown */}
        <GlassCard style={styles.repCard} borderColor={"rgba(200,149,58,0.2)"}>
          <View style={{ padding: 14 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 }}>
              <Star size={12} color={C.restaurant} strokeWidth={1.6} />
              <Text style={styles.repTitle}>Rep Score Breakdown</Text>
            </View>
            {REP_BREAKDOWN.map(({ label, score }) => (
              <View key={label} style={styles.repRow}>
                <Text style={styles.repLabel}>{label}</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <View style={[styles.barBg, { backgroundColor: C.border }]}>
                    <View style={[styles.barFill, { width: `${(score / 5) * 100}%` as any, backgroundColor: C.restaurant }]} />
                  </View>
                  <Text style={[styles.repScore, { color: C.restaurant }]}>{score}</Text>
                </View>
              </View>
            ))}
          </View>
        </GlassCard>

        {/* Theme toggle */}
        <GlassCard style={{ marginBottom: 12, overflow: "hidden" }} borderColor={C.border}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 14 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              {isDark
                ? <Moon size={16} color={C.accentLight} strokeWidth={1.6} />
                : <Sun size={16} color={C.restaurant} strokeWidth={1.6} />}
              <Text style={{ fontSize: 13, fontWeight: "500", color: C.text }}>
                {isDark ? "Dark Mode" : "Light Mode"}
              </Text>
            </View>
            <Switch
              value={isDark}
              onValueChange={toggleTheme}
              trackColor={{ false: C.border, true: C.accentBg }}
              thumbColor={isDark ? C.accentLight : C.textFaint}
            />
          </View>
        </GlassCard>

        {/* Profile items */}
        <View style={styles.itemList}>
          {PROFILE_ITEMS.map((item) => (
            <TouchableOpacity
              key={item.route}
              activeOpacity={0.8}
              onPress={() => router.push(`/module/${item.route}` as any)}
            >
              <GlassCard style={styles.itemCard} borderColor={C.borderFaint}>
                <View style={styles.itemRow}>
                  <item.Icon size={18} color={C.textMuted} strokeWidth={1.6} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemLabel}>{item.label}</Text>
                    <Text style={styles.itemSub}>{item.sub}</Text>
                  </View>
                  <ChevronRight size={14} color={C.textDim} strokeWidth={1.6} />
                </View>
              </GlassCard>
            </TouchableOpacity>
          ))}
        </View>

        <GlassButton label="Sign Out" variant="danger" onPress={logout} style={{ marginTop: 20 }} />
        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

function createStyles(C: Colors) {
  return StyleSheet.create({
    bg: { flex: 1, backgroundColor: C.bg },
    headerBar: {
      paddingTop: 56, paddingHorizontal: 18, paddingBottom: 12,
      borderBottomWidth: 1, borderBottomColor: C.borderFaint,
    },
    headerTitle: { fontSize: 22, fontWeight: "700", color: C.text },
    scroll: { padding: 16 },
    avatarCard: { marginBottom: 12, overflow: "hidden" },
    avatar: {
      width: 64, height: 64, borderRadius: 32,
      alignItems: "center", justifyContent: "center",
      borderWidth: 2, borderColor: "rgba(200,149,58,0.5)",
      marginBottom: 10,
    },
    avatarText: { fontSize: 24, fontWeight: "800" },
    name: { fontSize: 19, fontWeight: "700", color: C.text },
    role: { fontSize: 12, color: C.textFaint, marginTop: 2, marginBottom: 14 },
    statsRow: { flexDirection: "row", gap: 28 },
    statVal: { fontSize: 18, fontWeight: "700" },
    statSub: { fontSize: 10, color: C.textFaint, marginTop: 2 },
    repCard: { marginBottom: 12, overflow: "hidden" },
    repTitle: { fontSize: 11, color: C.restaurant, textTransform: "uppercase", letterSpacing: 0.8, fontWeight: "600" },
    repRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
    repLabel: { fontSize: 12, color: C.textMuted },
    barBg: { width: 80, height: 4, borderRadius: 2 },
    barFill: { height: "100%", borderRadius: 2 },
    repScore: { fontSize: 12, width: 24 },
    itemList: { gap: 6 },
    itemCard: { overflow: "hidden" },
    itemRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 13 },
    itemLabel: { fontSize: 13, fontWeight: "500", color: C.text },
    itemSub: { fontSize: 11, color: C.textFaint, marginTop: 1 },
  });
}
