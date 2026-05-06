import React, { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { ChevronLeft, Coffee, Clock, CheckCircle2 } from "lucide-react-native";
import { useTheme } from "../../hooks/useTheme";
import { GlassCard } from "../../components/GlassCard";
import { getMyBreaks, startBreak, endBreak } from "../../services/api";

type BreakEntry = {
  id: string;
  break_type: "meal" | "short" | "personal";
  started_at: string;
  ended_at: string | null;
  duration_minutes: number | null;
};

const BREAK_LABELS: Record<string, string> = { meal: "Meal Break", short: "Short Break", personal: "Personal Break" };

const POLICY = [
  { label: "Meal Break",  allowed: 1, duration: "30 min" },
  { label: "Short Break", allowed: 2, duration: "10 min each" },
];

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
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
        <Coffee size={18} color={C.restaurant} strokeWidth={1.6} />
        <Text style={{ fontSize: 20, fontWeight: "700", color: C.text }}>Break Log</Text>
      </View>
      <Text style={{ fontSize: 12, color: C.textFaint, marginTop: 2 }}>Today's breaks</Text>
    </View>
  );
}

export default function BreaksScreen() {
  const { C } = useTheme();
  const [breaks, setBreaks] = useState<BreakEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    try { const res = await getMyBreaks(); setBreaks(res.data); }
    catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, []);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const activeBreak = breaks.find((b) => b.ended_at === null);
  const totalMin = breaks.reduce((s, b) => s + (b.duration_minutes ?? 0), 0);

  const handleStartBreak = async (type: string) => {
    setActing(true);
    try { await startBreak(type); await load(); }
    catch {} finally { setActing(false); }
  };

  const handleEndBreak = async () => {
    if (!activeBreak) return;
    setActing(true);
    try { await endBreak(activeBreak.id); await load(); }
    catch {} finally { setActing(false); }
  };

  if (loading) return (
    <View style={{ flex: 1, backgroundColor: C.bg, alignItems: "center", justifyContent: "center" }}>
      <ActivityIndicator color={C.accent} />
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Header />
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 10 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} />}
      >
        {/* Stats */}
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 4 }}>
          <GlassCard style={{ flex: 1, padding: 12, alignItems: "center" }} borderColor={C.restaurant + "33"}>
            <Text style={{ fontSize: 22, fontWeight: "800", color: C.restaurant }}>{totalMin}m</Text>
            <Text style={{ fontSize: 9, color: C.textFaint, marginTop: 2, letterSpacing: 0.5 }}>TOTAL TAKEN</Text>
          </GlassCard>
          <GlassCard style={{ flex: 1, padding: 12, alignItems: "center" }} borderColor={C.border}>
            <Text style={{ fontSize: 22, fontWeight: "800", color: C.text }}>{breaks.length}</Text>
            <Text style={{ fontSize: 9, color: C.textFaint, marginTop: 2, letterSpacing: 0.5 }}>BREAKS</Text>
          </GlassCard>
        </View>

        {/* Active break banner */}
        {activeBreak && (
          <GlassCard style={{ padding: 14 }} borderColor={C.warning + "55"}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.warning }} />
                <Text style={{ fontSize: 13, color: C.warning, fontWeight: "600" }}>
                  On break since {fmtTime(activeBreak.started_at)}
                </Text>
              </View>
              <TouchableOpacity
                onPress={handleEndBreak}
                disabled={acting}
                style={{ backgroundColor: C.warning + "22", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: C.warning + "55" }}
              >
                <Text style={{ fontSize: 12, color: C.warning, fontWeight: "600" }}>End Break</Text>
              </TouchableOpacity>
            </View>
          </GlassCard>
        )}

        {/* Start break buttons */}
        {!activeBreak && (
          <View style={{ flexDirection: "row", gap: 8 }}>
            {["short", "meal", "personal"].map((type) => (
              <TouchableOpacity
                key={type}
                onPress={() => handleStartBreak(type)}
                disabled={acting}
                style={{ flex: 1, backgroundColor: C.accentBg, borderRadius: 10, paddingVertical: 9, alignItems: "center", borderWidth: 1, borderColor: C.accentBorder }}
              >
                <Text style={{ fontSize: 11, fontWeight: "600", color: C.accentLight }}>
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Today's log */}
        <Text style={{ fontSize: 10, color: C.textDim, letterSpacing: 1, marginTop: 4 }}>TODAY'S LOG</Text>
        {breaks.length === 0 && (
          <Text style={{ color: C.textFaint, fontSize: 13, textAlign: "center", marginTop: 12 }}>No breaks logged yet today</Text>
        )}
        {breaks.map((b) => (
          <GlassCard key={b.id} style={{ padding: 13 }} borderColor={b.ended_at ? C.border : C.warning + "44"}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View style={{ gap: 3 }}>
                <Text style={{ fontSize: 14, fontWeight: "600", color: C.text }}>{BREAK_LABELS[b.break_type] ?? b.break_type}</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                  <Clock size={11} color={C.textFaint} strokeWidth={1.6} />
                  <Text style={{ fontSize: 12, color: C.textMuted }}>
                    {fmtTime(b.started_at)}{b.ended_at ? ` – ${fmtTime(b.ended_at)}` : " – ongoing"}
                  </Text>
                </View>
              </View>
              {b.duration_minutes != null ? (
                <View style={{ alignItems: "center", gap: 2 }}>
                  <CheckCircle2 size={14} color={C.success} strokeWidth={1.8} />
                  <Text style={{ fontSize: 11, color: C.success }}>{b.duration_minutes}m</Text>
                </View>
              ) : (
                <View style={{ backgroundColor: C.warning + "22", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}>
                  <Text style={{ fontSize: 11, color: C.warning, fontWeight: "600" }}>Active</Text>
                </View>
              )}
            </View>
          </GlassCard>
        ))}

        {/* Policy */}
        <Text style={{ fontSize: 10, color: C.textDim, letterSpacing: 1, marginTop: 8 }}>BREAK POLICY</Text>
        <GlassCard style={{ padding: 14 }} borderColor={C.border}>
          {POLICY.map((p, i) => (
            <View key={p.label} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, borderBottomWidth: i < POLICY.length - 1 ? 1 : 0, borderBottomColor: C.borderFaint }}>
              <Text style={{ fontSize: 13, color: C.textMuted }}>{p.label}</Text>
              <Text style={{ fontSize: 13, color: C.text }}>{p.allowed}× · {p.duration}</Text>
            </View>
          ))}
        </GlassCard>

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}
