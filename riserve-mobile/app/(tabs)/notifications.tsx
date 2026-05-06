import React, { useMemo, useState, useCallback, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import {
  BellRing, AlertTriangle, MessageSquare, ClipboardList,
  CheckCircle2, Bell,
} from "lucide-react-native";
import { useTheme } from "../../hooks/useTheme";
import { GlassCard } from "../../components/GlassCard";
import { Colors } from "../../constants/colors";
import { getNotifications } from "../../services/api";

type NotifColor = "warning" | "accent" | "error" | "salon" | "success";
type NotifIcon = "ClipboardList" | "AlertTriangle" | "MessageSquare" | "BellRing";

type Notif = {
  id: string;
  type: string;
  title: string;
  body: string;
  icon: NotifIcon;
  color: NotifColor;
  created_at: string | null;
};

function resolveIcon(icon: NotifIcon) {
  const map: Record<NotifIcon, typeof ClipboardList> = {
    ClipboardList: ClipboardList,
    AlertTriangle: AlertTriangle,
    MessageSquare: MessageSquare,
    BellRing: BellRing,
  };
  return map[icon] ?? BellRing;
}

function resolveColor(key: NotifColor, C: Colors): string {
  const map: Record<NotifColor, string> = {
    warning: C.warning,
    accent:  C.accent,
    error:   C.error,
    salon:   C.salon,
    success: C.success,
  };
  return map[key] ?? C.accent;
}

function timeAgo(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

function groupByDay(items: Notif[]): { label: string; items: Notif[] }[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const buckets: Record<string, Notif[]> = {};
  for (const n of items) {
    const d = n.created_at ? new Date(n.created_at) : null;
    let label = "Older";
    if (d) {
      const day = new Date(d);
      day.setHours(0, 0, 0, 0);
      if (day.getTime() === today.getTime()) label = "Today";
      else if (day.getTime() === yesterday.getTime()) label = "Yesterday";
    }
    if (!buckets[label]) buckets[label] = [];
    buckets[label].push(n);
  }

  const order = ["Today", "Yesterday", "Older"];
  return order.filter((l) => buckets[l]).map((l) => ({ label: l, items: buckets[l] }));
}

export default function NotificationsScreen() {
  const { C, isDark } = useTheme();
  const styles = useMemo(() => createStyles(C), [C]);

  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [read, setRead] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    try {
      const res = await getNotifications();
      if (Array.isArray(res.data)) setNotifs(res.data);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const markRead = (id: string) => setRead((prev) => new Set([...prev, id]));
  const markAllRead = () => setRead(new Set(notifs.map((n) => n.id)));

  const unreadCount = notifs.filter((n) => !read.has(n.id)).length;
  const groups = useMemo(() => groupByDay(notifs), [notifs]);

  return (
    <View style={styles.bg}>
      {isDark && <LinearGradient colors={["#0D0D1A", "#0A0A0C"]} style={StyleSheet.absoluteFill} />}

      <View style={styles.headerBar}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={styles.headerTitle}>Alerts</Text>
            {unreadCount > 0 && (
              <View style={{ backgroundColor: C.error, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 }}>
                <Text style={{ fontSize: 11, fontWeight: "700", color: "#fff" }}>{unreadCount}</Text>
              </View>
            )}
          </View>
          {unreadCount > 0 && (
            <TouchableOpacity onPress={markAllRead} activeOpacity={0.7}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                <CheckCircle2 size={13} color={C.success} strokeWidth={1.8} />
                <Text style={{ fontSize: 12, color: C.success }}>Mark all read</Text>
              </View>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={C.accent} />
        </View>
      ) : notifs.length === 0 ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 10 }}>
          <Bell size={36} color={C.textFaint} strokeWidth={1.4} />
          <Text style={{ color: C.textFaint, fontSize: 14 }}>No recent alerts</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} />}
        >
          {groups.map(({ label, items }) => (
            <View key={label}>
              <Text style={styles.sectionLabel}>{label}</Text>
              {items.map((n) => {
                const Icon = resolveIcon(n.icon as NotifIcon);
                const color = resolveColor(n.color as NotifColor, C);
                const isRead = read.has(n.id);
                return (
                  <TouchableOpacity
                    key={n.id}
                    activeOpacity={0.8}
                    onPress={() => markRead(n.id)}
                    style={{ marginBottom: 6, opacity: isRead ? 0.55 : 1 }}
                  >
                    <GlassCard
                      style={styles.notifCard}
                      borderColor={isRead ? C.borderFaint : color + "44"}
                    >
                      {!isRead && (
                        <View style={{
                          position: "absolute", top: 10, right: 10,
                          width: 7, height: 7, borderRadius: 4,
                          backgroundColor: color,
                        }} />
                      )}
                      <View style={styles.notifRow}>
                        <View style={[styles.iconCircle, { backgroundColor: color + "22" }]}>
                          <Icon size={15} color={color} strokeWidth={1.6} />
                        </View>
                        <View style={{ flex: 1, paddingRight: 12 }}>
                          <Text style={[styles.notifTitle, { color: isRead ? C.textMuted : C.text }]}
                            numberOfLines={1}>
                            {n.title}
                          </Text>
                          <Text style={styles.notifBody} numberOfLines={2}>{n.body}</Text>
                          <Text style={styles.notifTime}>{timeAgo(n.created_at)}</Text>
                        </View>
                      </View>
                    </GlassCard>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
          <View style={{ height: 100 }} />
        </ScrollView>
      )}
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
    sectionLabel: {
      fontSize: 10, color: C.textDim, letterSpacing: 1.2,
      textTransform: "uppercase", marginBottom: 8, marginTop: 4,
    },
    notifCard: { overflow: "hidden" },
    notifRow: { flexDirection: "row", gap: 12, alignItems: "flex-start", padding: 13 },
    iconCircle: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", flexShrink: 0 },
    notifTitle: { fontSize: 13, fontWeight: "600", lineHeight: 18 },
    notifBody: { fontSize: 12, color: C.textMuted, lineHeight: 17, marginTop: 2 },
    notifTime: { fontSize: 11, color: C.textFaint, marginTop: 4 },
  });
}
