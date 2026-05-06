import React, { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { ChevronLeft, CalendarDays, Clock } from "lucide-react-native";
import { useTheme } from "../../hooks/useTheme";
import { GlassCard } from "../../components/GlassCard";
import { getMySchedule } from "../../services/api";

type AttendanceRow = {
  date: string;
  clock_in: string | null;
  clock_out: string | null;
  hours_worked: number | null;
  status: string;
  notes: string | null;
};

const STATUS_CFG: Record<string, { label: string; color: string }> = {
  present:  { label: "Present",  color: "#4CAF82" },
  absent:   { label: "Absent",   color: "#FF4444" },
  half_day: { label: "Half Day", color: "#FF8C42" },
  leave:    { label: "On Leave", color: "#6B7FD7" },
};

function fmtTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return { day: "Today", date: d.toLocaleDateString([], { day: "numeric", month: "short" }) };
  if (d.toDateString() === yesterday.toDateString()) return { day: "Yesterday", date: d.toLocaleDateString([], { day: "numeric", month: "short" }) };
  return { day: d.toLocaleDateString([], { weekday: "short" }), date: d.toLocaleDateString([], { day: "numeric", month: "short" }) };
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
        <CalendarDays size={18} color={C.accent} strokeWidth={1.6} />
        <Text style={{ fontSize: 20, fontWeight: "700", color: C.text }}>Shift Schedule</Text>
      </View>
      <Text style={{ fontSize: 12, color: C.textFaint, marginTop: 2 }}>Last 14 days attendance</Text>
    </View>
  );
}

export default function ScheduleScreen() {
  const { C } = useTheme();
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await getMySchedule();
      setRows(res.data);
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, []);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  if (loading) return (
    <View style={{ flex: 1, backgroundColor: C.bg, alignItems: "center", justifyContent: "center" }}>
      <ActivityIndicator color={C.accent} />
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Header />
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 8 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} />}
      >
        {rows.length === 0 && (
          <Text style={{ color: C.textFaint, textAlign: "center", marginTop: 40 }}>No attendance records yet</Text>
        )}
        {rows.map((row) => {
          const cfg = STATUS_CFG[row.status] ?? { label: row.status, color: C.textFaint };
          const { day, date } = fmtDate(row.date);
          const isToday = day === "Today";
          return (
            <GlassCard key={row.date} style={{ padding: 14 }} borderColor={isToday ? C.success + "55" : C.border}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
                <View style={{ width: 52, alignItems: "center" }}>
                  <Text style={{ fontSize: 10, color: C.textFaint, letterSpacing: 0.4 }}>{day.toUpperCase()}</Text>
                  <Text style={{ fontSize: 16, fontWeight: "700", color: isToday ? C.success : C.text }}>{date.split(" ")[0]}</Text>
                  <Text style={{ fontSize: 10, color: C.textFaint }}>{date.split(" ")[1]}</Text>
                </View>

                <View style={{ flex: 1, gap: 3 }}>
                  {row.clock_in ? (
                    <>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                        <Clock size={11} color={C.textFaint} strokeWidth={1.6} />
                        <Text style={{ fontSize: 12, color: C.textMuted }}>
                          {fmtTime(row.clock_in)} – {fmtTime(row.clock_out)}
                        </Text>
                      </View>
                      {row.hours_worked != null && (
                        <Text style={{ fontSize: 11, color: C.textFaint }}>{row.hours_worked.toFixed(1)}h worked</Text>
                      )}
                    </>
                  ) : (
                    <Text style={{ fontSize: 13, color: C.textFaint, fontStyle: "italic" }}>No clock-in recorded</Text>
                  )}
                </View>

                <View style={{ backgroundColor: cfg.color + "22", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: cfg.color + "55" }}>
                  <Text style={{ fontSize: 10, fontWeight: "600", color: cfg.color }}>{cfg.label}</Text>
                </View>
              </View>
            </GlassCard>
          );
        })}
        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}
