import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, Modal, Pressable,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { router } from "expo-router";
import {
  UtensilsCrossed, Scissors, Clock, LogIn, LogOut, Radio, Play, X,
  ClipboardList, LayoutGrid, BellRing, MonitorPlay, AlertTriangle,
  ArrowLeftRight, CalendarDays, Armchair, User, Package, TrendingUp,
  CheckSquare, ArrowUpCircle, MessageSquare, Flag, Mic, ThumbsUp,
  Users, BarChart2, Check, Headphones,
} from "lucide-react-native";
import { Colors, VerticalKey } from "../../constants/colors";
import { useTheme } from "../../hooks/useTheme";
import { GlassCard } from "../../components/GlassCard";
import { NoiseOverlay } from "../../components/NoiseOverlay";
import { useAuth } from "../../hooks/useAuth";
import { myAttendanceToday, clockIn, clockOut } from "../../services/api";

const VERTICAL_MODULES: Record<VerticalKey, any[]> = {
  restaurant: [
    { id: "orders",     Icon: ClipboardList, label: "Orders",           badge: 3,    alert: false, route: "orders" },
    { id: "tables",     Icon: LayoutGrid,    label: "Floor View",       badge: null, alert: false, route: "floor" },
    { id: "callwaiter", Icon: BellRing,      label: "Call Alerts",      badge: 2,    alert: true,  route: "callalerts" },
    { id: "kds",        Icon: MonitorPlay,   label: "KDS Feed",         badge: 5,    alert: false, route: "kds" },
    { id: "inventory",  Icon: AlertTriangle, label: "86'd Items",       badge: 1,    alert: true,  route: "eightysixed" },
    { id: "handoff",    Icon: ArrowLeftRight,label: "Shift Notes",      badge: null, alert: false, route: "shiftnotes" },
  ],
  salon: [
    { id: "appointments", Icon: CalendarDays,  label: "Appointments",     badge: 4,    alert: false, route: "appointments" },
    { id: "roomview",     Icon: Armchair,       label: "Room View",        badge: null, alert: false, route: "roomview" },
    { id: "clientnotes",  Icon: User,           label: "Client Context",   badge: null, alert: false, route: "clientnotes" },
    { id: "products",     Icon: Package,        label: "Product Inventory",badge: 1,    alert: true,  route: "salonproducts" },
    { id: "handoff",      Icon: ArrowLeftRight, label: "Shift Notes",      badge: null, alert: false, route: "shiftnotes" },
    { id: "upsell",       Icon: TrendingUp,     label: "Upsell Queue",     badge: null, alert: false, route: "upsell" },
  ],
};

const SHARED_MODULES = [
  { id: "tasks",    Icon: CheckSquare,   label: "Tasks",    badge: 3,    highlight: false, route: "tasks" },
  { id: "messages", Icon: MessageSquare, label: "Messages", badge: 2,    highlight: false, route: "messages" },
  { id: "escalate", Icon: ArrowUpCircle, label: "Escalate", badge: null, highlight: false, route: "escalate" },
  { id: "incident", Icon: Flag,          label: "Incidents",badge: null, highlight: false, route: "incidents" },
  { id: "intercom", Icon: Radio,         label: "Intercom", badge: 1,    highlight: true,  route: "intercom" },
];

const MANAGER_MODULES = [
  { id: "voiceChannel", Icon: Mic,      label: "Create Voice Channel",  sub: "Broadcast to all staff or a section", route: "intercom" },
  { id: "approvals",    Icon: ThumbsUp, label: "Pending Approvals",     sub: "3 leave requests · 1 shift swap",     route: "approvals" },
  { id: "staffStatus",  Icon: Users,    label: "Staff Status Board",    sub: "Live: 8 clocked in · 2 on break",     route: "staffstatus" },
  { id: "reports",      Icon: BarChart2,label: "Performance Reports",   sub: "Rep scores, tips, attendance",         route: "reports" },
];

const INTERCOM_CHANNELS = [
  { name: "Floor – Dinner Rush",  host: "Manager Priya",  listeners: 6, live: true },
  { name: "Section B Briefing",   host: "Sr. Staff Ravi", listeners: 3, live: false },
];

export default function HomeScreen() {
  const { user } = useAuth();
  const { C, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [vertical, setVertical] = useState<VerticalKey>("restaurant");
  const [clockedIn, setClockedIn] = useState(false);
  const [clockInfo, setClockInfo] = useState<any>(null);
  const [intercomOpen, setIntercomOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const VERTICALS = useMemo(() => ({
    restaurant: { label: "Restaurant", color: C.restaurant, accent: C.restaurantLight, bg: C.restaurantBg },
    salon:       { label: "Salon & Spa", color: C.salon,     accent: C.salonLight,      bg: C.salonBg },
  }), [C]);

  const v = VERTICALS[vertical];
  const styles = useMemo(() => createStyles(C), [C]);

  const isManager = user?.role === "Manager" || user?.role === "Owner" ||
    user?.role === "admin" || user?.role === "manager";

  const loadAttendance = useCallback(async () => {
    try {
      const res = await myAttendanceToday();
      setClockedIn(res.data.clocked_in);
      setClockInfo(res.data);
    } catch {}
  }, []);

  useEffect(() => { loadAttendance(); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAttendance();
    setRefreshing(false);
  };

  const handleClock = async () => {
    try {
      if (!clockedIn) {
        await clockIn();
        setClockedIn(true);
        loadAttendance();
      } else {
        if (clockInfo?.attendance_id) {
          await clockOut(clockInfo.attendance_id);
        }
        setClockedIn(false);
        loadAttendance();
      }
    } catch {}
  };

  const goModule = (route: string) => router.push(`/module/${route}` as any);

  return (
    <View style={styles.bg}>
      {isDark && (
        <LinearGradient colors={["#1C1612", "#12100D", "#12100D"]} style={StyleSheet.absoluteFill} />
      )}
      <NoiseOverlay />

      {/* Header */}
      <BlurView intensity={20} tint={isDark ? "dark" : "light"} style={styles.header}>
        <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? "rgba(18,16,13,0.75)" : "rgba(245,244,240,0.88)" }]} />
        <View style={[styles.headerInner, { paddingTop: insets.top + 10 }]}>
          <View>
            <Text style={styles.headerEyebrow}>RI'SERVE</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
              {vertical === "restaurant"
                ? <UtensilsCrossed size={16} color={v.color} strokeWidth={1.6} />
                : <Scissors size={16} color={v.color} strokeWidth={1.6} />}
              <Text style={styles.headerTitle}>{v.label} Staff</Text>
            </View>
          </View>
          <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
            {(["restaurant", "salon"] as VerticalKey[]).map((k) => {
              const vk = VERTICALS[k];
              return (
                <TouchableOpacity
                  key={k}
                  onPress={() => setVertical(k)}
                  style={[styles.pill, { borderColor: C.border }, vertical === k && { borderColor: vk.color, backgroundColor: vk.bg }]}
                >
                  <Text style={[styles.pillText, { color: vertical === k ? vk.accent : C.textFaint }]}>
                    {vk.label === "Restaurant" ? "Rest." : "Salon"}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </BlurView>

      <ScrollView
        style={{ flex: 1, marginTop: insets.top + 62 }}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accentLight} />}
      >
        {/* Clock strip */}
        <GlassCard
          style={styles.clockCard}
          borderColor={clockedIn ? "rgba(76,175,130,0.3)" : "rgba(200,149,58,0.25)"}
          gradient={clockedIn
            ? ["rgba(22,30,20,0.92)", "rgba(14,20,14,0.92)"]
            : ["rgba(30,22,12,0.92)", "rgba(22,16,10,0.92)"]}
        >
          <View style={styles.clockInner}>
            <View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                <Clock size={11} color={clockedIn ? C.success : C.restaurant} strokeWidth={1.6} />
                <Text style={[styles.clockLabel, { color: clockedIn ? C.success : C.restaurant }]}>
                  {clockedIn ? "On Shift" : "Off Shift"}
                </Text>
              </View>
              <Text style={styles.clockSub}>
                {clockedIn
                  ? `Clocked in at ${clockInfo?.clock_in ? new Date(clockInfo.clock_in).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}`
                  : "Tap to start your shift"}
              </Text>
            </View>
            <TouchableOpacity
              onPress={handleClock}
              style={[styles.clockBtn, {
                borderColor: clockedIn ? C.success : C.restaurant,
                backgroundColor: clockedIn ? "rgba(76,175,130,0.1)" : "rgba(200,149,58,0.1)",
              }]}
            >
              {clockedIn
                ? <LogOut size={12} color={C.success} strokeWidth={1.6} />
                : <LogIn size={12} color={C.restaurant} strokeWidth={1.6} />}
              <Text style={[styles.clockBtnText, { color: clockedIn ? C.success : C.restaurant }]}>
                {clockedIn ? "Clock Out" : "Clock In"}
              </Text>
            </TouchableOpacity>
          </View>
        </GlassCard>

        {/* Intercom banner */}
        <TouchableOpacity onPress={() => setIntercomOpen(true)} activeOpacity={0.8}>
          <GlassCard style={styles.intercomCard} borderColor={C.accentBorder}>
            <View style={styles.intercomInner}>
              <View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 3 }}>
                  <Radio size={11} color={C.accentLight} strokeWidth={1.6} />
                  <Text style={[styles.intercomLabel, { color: C.accentLight }]}>Intercom</Text>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text style={styles.intercomChannel}>Floor – Dinner Rush</Text>
                  <View style={styles.liveBadge}><Text style={styles.liveText}>LIVE</Text></View>
                </View>
              </View>
              <View style={[styles.playBtn, { backgroundColor: C.accentBg, borderColor: C.accentBorder }]}>
                <Play size={13} color={C.accentLight} strokeWidth={1.6} />
              </View>
            </View>
          </GlassCard>
        </TouchableOpacity>

        {/* Vertical modules grid */}
        <Text style={styles.sectionLabel}>{v.label} Modules</Text>
        <View style={styles.moduleGrid}>
          {VERTICAL_MODULES[vertical].map((mod) => (
            <TouchableOpacity
              key={mod.id}
              onPress={() => goModule(mod.route)}
              activeOpacity={0.75}
              style={styles.moduleCardWrap}
            >
              <GlassCard
                style={styles.moduleCard}
                borderColor={mod.alert ? "rgba(255,68,68,0.25)" : C.border}
                gradient={mod.alert
                  ? ["rgba(28,18,16,0.95)", "rgba(22,14,12,0.95)"]
                  : ["rgba(22,20,18,0.95)", "rgba(18,16,14,0.95)"]}
              >
                <mod.Icon size={20} color={mod.alert ? "#FF6B6B" : v.color} strokeWidth={1.6} />
                <Text style={[styles.moduleName, { color: mod.alert ? "#FF8888" : C.text }]}>{mod.label}</Text>
                {mod.badge && (
                  <View style={[styles.badge, { backgroundColor: mod.alert ? C.error : v.color }]}>
                    <Text style={styles.badgeText}>{mod.badge}</Text>
                  </View>
                )}
              </GlassCard>
            </TouchableOpacity>
          ))}
        </View>

        {/* Shared modules */}
        <Text style={styles.sectionLabel}>Team & Operations</Text>
        <View style={styles.listStack}>
          {SHARED_MODULES.map((mod) => (
            <TouchableOpacity key={mod.id} onPress={() => goModule(mod.route)} activeOpacity={0.8}>
              <GlassCard
                style={styles.listCard}
                borderColor={mod.highlight ? C.accentBorder : C.borderFaint}
              >
                <View style={styles.listRow}>
                  <mod.Icon size={18} color={mod.highlight ? C.accentLight : C.textMuted} strokeWidth={1.6} />
                  <Text style={[styles.listLabel, { color: mod.highlight ? C.accentLight : C.text }]}>
                    {mod.label}
                  </Text>
                  {mod.badge && (
                    <View style={[styles.badge, { backgroundColor: C.accent, marginLeft: "auto" }]}>
                      <Text style={styles.badgeText}>{mod.badge}</Text>
                    </View>
                  )}
                </View>
              </GlassCard>
            </TouchableOpacity>
          ))}

          {isManager && (
            <>
              <Text style={[styles.sectionLabel, { marginTop: 16 }]}>Manager Controls</Text>
              {MANAGER_MODULES.map((mod) => (
                <TouchableOpacity key={mod.id} onPress={() => goModule(mod.route)} activeOpacity={0.8}>
                  <GlassCard style={styles.listCard} borderColor={C.border}>
                    <View style={styles.listRow}>
                      <mod.Icon size={18} color={C.accentLight} strokeWidth={1.6} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.listLabel, { color: C.text }]}>{mod.label}</Text>
                        <Text style={styles.listSub}>{mod.sub}</Text>
                      </View>
                    </View>
                  </GlassCard>
                </TouchableOpacity>
              ))}
            </>
          )}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Intercom modal */}
      <Modal visible={intercomOpen} transparent animationType="fade">
        <Pressable style={styles.modalBg} onPress={() => setIntercomOpen(false)}>
          <BlurView intensity={20} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? "rgba(8,8,12,0.9)" : "rgba(240,239,235,0.9)" }]} />
        </Pressable>
        <View style={[styles.intercomModal, { backgroundColor: isDark ? "rgba(12,12,18,0.98)" : "rgba(250,249,246,0.98)", borderTopColor: C.border }]}>
          <View style={styles.intercomModalHeader}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Radio size={18} color={C.accentLight} strokeWidth={1.6} />
              <Text style={[styles.intercomModalTitle, { color: C.text }]}>Intercom Channels</Text>
            </View>
            <TouchableOpacity onPress={() => setIntercomOpen(false)} style={[styles.closeBtn, { backgroundColor: C.borderFaint }]}>
              <X size={14} color={C.textMuted} strokeWidth={1.6} />
            </TouchableOpacity>
          </View>
          {INTERCOM_CHANNELS.map((ch, i) => (
            <GlassCard
              key={i}
              style={{ marginBottom: 10 }}
              borderColor={ch.live ? "rgba(255,68,68,0.2)" : C.border}
            >
              <View style={{ padding: 14 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 10 }}>
                  <View>
                    <Text style={{ fontSize: 14, fontWeight: "600", color: C.text }}>{ch.name}</Text>
                    <Text style={{ fontSize: 11, color: C.textFaint, marginTop: 2 }}>by {ch.host}</Text>
                  </View>
                  {ch.live && (
                    <View style={styles.liveBadge}>
                      <Text style={styles.liveText}>LIVE</Text>
                    </View>
                  )}
                </View>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <TouchableOpacity
                    style={[styles.tuneInBtn, { backgroundColor: ch.live ? C.accent : C.card, borderColor: ch.live ? C.accent : C.border }]}
                    activeOpacity={0.8}
                  >
                    {ch.live
                      ? <Play size={12} color="#fff" strokeWidth={1.6} />
                      : <Radio size={12} color={C.textFaint} strokeWidth={1.6} />}
                    <Text style={{ fontSize: 12, fontWeight: "600", color: ch.live ? "#fff" : C.textFaint, marginLeft: 5 }}>
                      {ch.live ? "Tune In" : "Waiting..."}
                    </Text>
                  </TouchableOpacity>
                  <View style={[styles.listenerChip, { backgroundColor: C.borderFaint }]}>
                    <Headphones size={11} color={C.textFaint} strokeWidth={1.6} />
                    <Text style={{ fontSize: 12, color: C.textFaint, marginLeft: 4 }}>{ch.listeners}</Text>
                  </View>
                </View>
              </View>
            </GlassCard>
          ))}
          {isManager && (
            <TouchableOpacity style={[styles.createChannelBtn, { backgroundColor: C.accentBg, borderColor: C.accent }]} activeOpacity={0.8}>
              <Mic size={14} color={C.accentLight} strokeWidth={1.6} />
              <Text style={{ fontSize: 13, fontWeight: "600", color: C.accentLight, marginLeft: 6 }}>
                Create New Channel
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </Modal>
    </View>
  );
}

function createStyles(C: Colors) {
  return StyleSheet.create({
    bg: { flex: 1, backgroundColor: C.bg },
    header: {
      position: "absolute", top: 0, left: 0, right: 0, zIndex: 10,
      borderBottomWidth: 1, borderBottomColor: C.borderFaint,
      overflow: "hidden",
    },
    headerInner: {
      flexDirection: "row", justifyContent: "space-between", alignItems: "center",
      paddingHorizontal: 18, paddingBottom: 12, position: "relative",
    },
    headerEyebrow: { fontSize: 9, color: C.textDim, letterSpacing: 2, textTransform: "uppercase" },
    headerTitle: { fontSize: 17, fontWeight: "700", color: C.text },
    pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
    pillText: { fontSize: 11 },
    scroll: { padding: 16 },
    clockCard: { marginBottom: 12, overflow: "hidden" },
    clockInner: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 14 },
    clockLabel: { fontSize: 11, textTransform: "uppercase", letterSpacing: 0.8, fontWeight: "600" },
    clockSub: { fontSize: 13, color: C.textMuted, marginTop: 3 },
    clockBtn: {
      flexDirection: "row", alignItems: "center", gap: 5,
      paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, borderWidth: 1,
    },
    clockBtnText: { fontSize: 12, fontWeight: "600" },
    intercomCard: { marginBottom: 16, overflow: "hidden" },
    intercomInner: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 14 },
    intercomLabel: { fontSize: 11, textTransform: "uppercase", letterSpacing: 0.8 },
    intercomChannel: { fontSize: 13, color: C.textMuted },
    liveBadge: { backgroundColor: "rgba(255,68,68,0.2)", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    liveText: { fontSize: 9, color: "#FF8888", letterSpacing: 0.5 },
    playBtn: {
      width: 32, height: 32, borderRadius: 16,
      borderWidth: 1,
      alignItems: "center", justifyContent: "center",
    },
    sectionLabel: { fontSize: 10, color: C.textDim, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 8, marginTop: 4 },
    moduleGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
    moduleCardWrap: { width: "48%" },
    moduleCard: { padding: 14, gap: 8, overflow: "hidden", position: "relative" },
    moduleName: { fontSize: 13, fontWeight: "600" },
    badge: {
      position: "absolute", top: 10, right: 10,
      width: 18, height: 18, borderRadius: 9,
      alignItems: "center", justifyContent: "center",
    },
    badgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },
    listStack: { gap: 6 },
    listCard: { overflow: "hidden" },
    listRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 13 },
    listLabel: { fontSize: 13, fontWeight: "500" },
    listSub: { fontSize: 11, color: C.textFaint, marginTop: 1 },
    modalBg: { ...StyleSheet.absoluteFillObject, zIndex: 1 },
    intercomModal: {
      position: "absolute", bottom: 0, left: 0, right: 0,
      borderTopLeftRadius: 24, borderTopRightRadius: 24,
      borderTopWidth: 1,
      padding: 20, paddingBottom: 40, zIndex: 2,
    },
    intercomModalHeader: {
      flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20,
    },
    intercomModalTitle: { fontSize: 16, fontWeight: "700" },
    closeBtn: {
      width: 30, height: 30, borderRadius: 8,
      alignItems: "center", justifyContent: "center",
    },
    tuneInBtn: {
      flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
      paddingVertical: 9, borderRadius: 8, borderWidth: 1,
    },
    listenerChip: {
      flexDirection: "row", alignItems: "center",
      paddingHorizontal: 10, paddingVertical: 9, borderRadius: 8,
    },
    createChannelBtn: {
      flexDirection: "row", alignItems: "center", justifyContent: "center",
      paddingVertical: 12, borderRadius: 12,
      borderWidth: 1, borderStyle: "dashed",
      marginTop: 4,
    },
  });
}
