import React, { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { ChevronLeft, Sparkles, TrendingUp } from "lucide-react-native";
import { useTheme } from "../../hooks/useTheme";
import { GlassCard } from "../../components/GlassCard";
import { getMyTips } from "../../services/api";

const GOLD = "#C8953A";

type TipEntry = {
  id: string;
  date: string;
  amount: number;
  source_notes: string | null;
};

function fmt(n: number) { return "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 0 }); }

function fmtDate(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" });
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
        <Sparkles size={18} color={GOLD} strokeWidth={1.6} />
        <Text style={{ fontSize: 20, fontWeight: "700", color: C.text }}>Tips</Text>
      </View>
      <Text style={{ fontSize: 12, color: C.textFaint, marginTop: 2 }}>Your tip earnings this week</Text>
    </View>
  );
}

export default function TipsScreen() {
  const { C } = useTheme();
  const [tips, setTips] = useState<TipEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { const res = await getMyTips(); setTips(res.data); }
    catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, []);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const weekTotal = tips.reduce((s, t) => s + t.amount, 0);
  const todayAmt = tips[0]?.amount ?? 0;
  const avg = tips.length > 0 ? Math.round(weekTotal / tips.length) : 0;
  const maxAmt = tips.length > 0 ? Math.max(...tips.map((t) => t.amount)) : 1;

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
        <GlassCard style={{ padding: 16 }} borderColor={"rgba(200,149,58,0.3)"} gradient={["rgba(28,22,10,0.96)", "rgba(16,14,8,0.96)"]}>
          <View style={{ alignItems: "center", gap: 4 }}>
            <Sparkles size={20} color={GOLD} strokeWidth={1.6} />
            <Text style={{ fontSize: 32, fontWeight: "800", color: GOLD, marginTop: 4 }}>{fmt(weekTotal)}</Text>
            <Text style={{ fontSize: 12, color: C.textFaint }}>Total this week</Text>
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-around", marginTop: 16 }}>
            {([["Today", fmt(todayAmt)], ["Avg/day", fmt(avg)], ["Days", String(tips.length)]] as [string, string][]).map(([label, value]) => (
              <View key={label} style={{ alignItems: "center" }}>
                <Text style={{ fontSize: 16, fontWeight: "700", color: C.text }}>{value}</Text>
                <Text style={{ fontSize: 10, color: C.textFaint, marginTop: 2 }}>{label}</Text>
              </View>
            ))}
          </View>
        </GlassCard>

        {tips.length === 0 && (
          <Text style={{ color: C.textFaint, textAlign: "center", marginTop: 20 }}>No tip records this week</Text>
        )}

        {tips.length > 0 && (
          <>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 4 }}>
              <TrendingUp size={12} color={GOLD} strokeWidth={1.6} />
              <Text style={{ fontSize: 10, color: C.textDim, letterSpacing: 1 }}>DAILY BREAKDOWN</Text>
            </View>
            {tips.map((t) => {
              const barWidth = `${Math.round((t.amount / maxAmt) * 100)}%` as any;
              return (
                <GlassCard key={t.id} style={{ padding: 13 }} borderColor={"rgba(200,149,58,0.2)"}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <Text style={{ fontSize: 13, fontWeight: "600", color: C.text }}>{fmtDate(t.date)}</Text>
                    <Text style={{ fontSize: 15, fontWeight: "700", color: GOLD }}>{fmt(t.amount)}</Text>
                  </View>
                  <View style={{ height: 4, backgroundColor: C.border, borderRadius: 2, marginBottom: 6 }}>
                    <View style={{ width: barWidth, height: "100%", backgroundColor: GOLD + "CC", borderRadius: 2 }} />
                  </View>
                  {t.source_notes && <Text style={{ fontSize: 11, color: C.textFaint }}>{t.source_notes}</Text>}
                </GlassCard>
              );
            })}
          </>
        )}

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}
