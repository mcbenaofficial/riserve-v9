import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { ChevronLeft, TrendingUp, Clock, User, Sparkles, Check, Plus } from "lucide-react-native";
import { useTheme } from "../../hooks/useTheme";
import { GlassCard } from "../../components/GlassCard";
import { getSalonUpsell } from "../../services/api";

const GOLD = "#C8953A";

type UpsellAppt = {
  id: string;
  client_name: string;
  time: string;
  duration: number | null;
  amount: number;
  notes: string | null;
  suggestions: string[];
};

function Header() {
  const { C } = useTheme();
  return (
    <View style={{ paddingTop: 52, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: C.borderFaint, backgroundColor: C.bg + "F5" }}>
      <TouchableOpacity onPress={() => router.back()} style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 }}>
        <ChevronLeft size={16} color={C.textMuted} strokeWidth={1.6} />
        <Text style={{ fontSize: 13, color: C.textMuted }}>Back</Text>
      </TouchableOpacity>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <TrendingUp size={18} color={GOLD} strokeWidth={1.6} />
        <Text style={{ fontSize: 20, fontWeight: "700", color: C.text }}>Upsell Queue</Text>
      </View>
      <Text style={{ fontSize: 12, color: C.textFaint, marginTop: 2 }}>Upcoming clients · add-on opportunities</Text>
    </View>
  );
}

function UpsellCard({ appt }: { appt: UpsellAppt }) {
  const { C } = useTheme();
  const [marked, setMarked] = useState<Record<string, boolean>>({});

  return (
    <GlassCard
      style={{ padding: 15, gap: 12 }}
      borderColor={"rgba(200,149,58,0.25)"}
      gradient={["rgba(24,20,12,0.95)", "rgba(16,14,8,0.95)"]}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
        <View style={{ gap: 4 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <User size={12} color={C.textMuted} strokeWidth={1.6} />
            <Text style={{ fontSize: 15, fontWeight: "700", color: C.text }}>{appt.client_name}</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Clock size={11} color={C.textFaint} strokeWidth={1.6} />
            <Text style={{ fontSize: 12, color: C.textMuted }}>{appt.time}</Text>
            {appt.duration && (
              <Text style={{ fontSize: 12, color: C.textFaint }}>· {appt.duration}m</Text>
            )}
          </View>
        </View>
        {appt.amount > 0 && (
          <View style={{ backgroundColor: "rgba(200,149,58,0.12)", borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4, borderWidth: 1, borderColor: "rgba(200,149,58,0.3)" }}>
            <Text style={{ fontSize: 12, fontWeight: "600", color: GOLD }}>₹{appt.amount.toFixed(0)}</Text>
          </View>
        )}
      </View>

      <View style={{ gap: 6 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
          <Sparkles size={11} color={GOLD} strokeWidth={1.6} />
          <Text style={{ fontSize: 10, color: GOLD, letterSpacing: 0.6, fontWeight: "600" }}>SUGGESTED ADD-ONS</Text>
        </View>
        {appt.suggestions.map((s) => {
          const done = marked[s];
          return (
            <TouchableOpacity
              key={s}
              onPress={() => setMarked((prev) => ({ ...prev, [s]: !prev[s] }))}
              activeOpacity={0.75}
              style={{
                flexDirection: "row", alignItems: "center", gap: 10,
                backgroundColor: done ? C.successBg : C.glassOverlay,
                borderRadius: 8, paddingVertical: 9, paddingHorizontal: 11,
                borderWidth: 1, borderColor: done ? C.successBorder : C.borderFaint,
              }}
            >
              <View style={{
                width: 18, height: 18, borderRadius: 9,
                backgroundColor: done ? C.success : "transparent",
                borderWidth: 1, borderColor: done ? C.success : C.textFaint,
                alignItems: "center", justifyContent: "center",
              }}>
                {done && <Check size={10} color="#fff" strokeWidth={2.5} />}
              </View>
              <Text style={{ flex: 1, fontSize: 13, color: done ? C.success : C.text, textDecorationLine: done ? "line-through" : "none" }}>
                {s}
              </Text>
              {!done && <Plus size={13} color={C.textFaint} strokeWidth={1.6} />}
            </TouchableOpacity>
          );
        })}
      </View>

      {appt.notes && (
        <Text style={{ fontSize: 11, color: C.textFaint, fontStyle: "italic" }} numberOfLines={2}>
          Note: {appt.notes}
        </Text>
      )}
    </GlassCard>
  );
}

export default function UpsellScreen() {
  const { C } = useTheme();
  const [appts, setAppts] = useState<UpsellAppt[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await getSalonUpsell();
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

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Header />
      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={GOLD} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, gap: 12 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={GOLD} />}
        >
          {appts.length === 0 && (
            <View style={{ alignItems: "center", marginTop: 40, gap: 8 }}>
              <TrendingUp size={32} color={C.textFaint} strokeWidth={1.4} />
              <Text style={{ color: C.textFaint, textAlign: "center" }}>
                No upcoming appointments to upsell
              </Text>
            </View>
          )}
          {appts.map((a) => <UpsellCard key={a.id} appt={a} />)}
          <View style={{ height: 60 }} />
        </ScrollView>
      )}
    </View>
  );
}
