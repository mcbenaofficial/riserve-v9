import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { ChevronLeft, CalendarDays, User, Armchair, CheckCircle2, Circle, AlertCircle } from "lucide-react-native";
import { useTheme } from "../../hooks/useTheme";
import { GlassCard } from "../../components/GlassCard";
import { getSalonAppointments } from "../../services/api";

type Appt = {
  id: string;
  client_name: string;
  client_phone: string | null;
  time: string;
  duration: number | null;
  status: string;
  resource_name: string | null;
  notes: string | null;
  amount: number;
};

function formatDuration(min: number | null) {
  if (!min) return null;
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function Header() {
  const { C } = useTheme();
  return (
    <View style={{ paddingTop: 52, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: C.borderFaint, backgroundColor: C.bg + "F5" }}>
      <TouchableOpacity onPress={() => router.back()} style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 }}>
        <ChevronLeft size={16} color={C.textMuted} strokeWidth={1.6} />
        <Text style={{ fontSize: 13, color: C.textMuted }}>Back</Text>
      </TouchableOpacity>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <CalendarDays size={18} color={C.salon} strokeWidth={1.6} />
        <Text style={{ fontSize: 20, fontWeight: "700", color: C.text }}>Appointments</Text>
      </View>
      <Text style={{ fontSize: 12, color: C.textFaint, marginTop: 2 }}>
        {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
      </Text>
    </View>
  );
}

export default function AppointmentsScreen() {
  const { C } = useTheme();
  const [appts, setAppts] = useState<Appt[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await getSalonAppointments();
      setAppts(res.data);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const nowMin = (() => {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  })();

  const isPast = (time: string) => {
    try {
      const [h, m] = time.split(":").map(Number);
      return (h * 60 + m) < nowMin;
    } catch { return false; }
  };

  const STATUS_CONFIG: Record<string, { color: string; label: string; Icon: any }> = {
    Confirmed:    { color: C.success,   label: "Confirmed",   Icon: CheckCircle2 },
    Pending:      { color: C.warning,   label: "Pending",     Icon: Circle },
    "In Progress":{ color: C.salon,     label: "In Progress", Icon: AlertCircle },
    Completed:    { color: C.textFaint, label: "Done",        Icon: CheckCircle2 },
    Cancelled:    { color: C.error,     label: "Cancelled",   Icon: AlertCircle },
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Header />
      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={C.salon} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, gap: 10 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.salon} />}
        >
          {appts.length === 0 && (
            <Text style={{ color: C.textFaint, textAlign: "center", marginTop: 40 }}>
              No appointments today
            </Text>
          )}
          {appts.map((a) => {
            const cfg = STATUS_CONFIG[a.status] ?? { color: C.textFaint, label: a.status, Icon: Circle };
            const past = isPast(a.time);
            return (
              <GlassCard
                key={a.id}
                style={{ padding: 15, opacity: past ? 0.55 : 1 }}
                borderColor={cfg.color + "40"}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <View style={{ alignItems: "center", width: 54, marginRight: 14 }}>
                    <Text style={{ fontSize: 18, fontWeight: "800", color: past ? C.textFaint : C.salon, letterSpacing: 0.5 }}>
                      {a.time}
                    </Text>
                    {a.duration && (
                      <Text style={{ fontSize: 10, color: C.textFaint, marginTop: 2 }}>
                        {formatDuration(a.duration)}
                      </Text>
                    )}
                  </View>

                  <View style={{ flex: 1, gap: 4 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <User size={12} color={C.textMuted} strokeWidth={1.6} />
                      <Text style={{ fontSize: 15, fontWeight: "700", color: C.text }}>{a.client_name}</Text>
                    </View>
                    {a.resource_name && (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Armchair size={12} color={C.textFaint} strokeWidth={1.6} />
                        <Text style={{ fontSize: 12, color: C.textMuted }}>{a.resource_name}</Text>
                      </View>
                    )}
                    {a.notes && (
                      <Text style={{ fontSize: 11, color: C.textFaint, fontStyle: "italic", marginTop: 2 }} numberOfLines={1}>
                        {a.notes}
                      </Text>
                    )}
                  </View>

                  <View style={{ alignItems: "flex-end", gap: 6, marginLeft: 8 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: cfg.color + "22", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: cfg.color + "55" }}>
                      <cfg.Icon size={10} color={cfg.color} strokeWidth={2} />
                      <Text style={{ fontSize: 11, fontWeight: "600", color: cfg.color }}>{cfg.label}</Text>
                    </View>
                    {a.amount > 0 && (
                      <Text style={{ fontSize: 12, color: C.textMuted }}>₹{a.amount.toFixed(0)}</Text>
                    )}
                  </View>
                </View>
              </GlassCard>
            );
          })}
          <View style={{ height: 60 }} />
        </ScrollView>
      )}
    </View>
  );
}
