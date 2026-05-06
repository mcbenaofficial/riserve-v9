import React, { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { ChevronLeft, BookOpen, CheckCircle2, Circle, ChevronRight } from "lucide-react-native";
import { useTheme } from "../../hooks/useTheme";
import { GlassCard } from "../../components/GlassCard";
import { getMyTraining, completeTrainingModule, uncompleteTrainingModule } from "../../services/api";

type Module = {
  id: string;
  title: string;
  category: string;
  duration_minutes: number;
  completed: boolean;
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
        <BookOpen size={18} color={C.accentLight} strokeWidth={1.6} />
        <Text style={{ fontSize: 20, fontWeight: "700", color: C.text }}>Training & SOPs</Text>
      </View>
      <Text style={{ fontSize: 12, color: C.textFaint, marginTop: 2 }}>Your learning modules</Text>
    </View>
  );
}

export default function TrainingScreen() {
  const { C } = useTheme();
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { const res = await getMyTraining(); setModules(res.data); }
    catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, []);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const toggle = async (m: Module) => {
    if (toggling) return;
    setToggling(m.id);
    // Optimistic update
    setModules((prev) => prev.map((mod) => mod.id === m.id ? { ...mod, completed: !mod.completed } : mod));
    try {
      if (m.completed) await uncompleteTrainingModule(m.id);
      else await completeTrainingModule(m.id);
    } catch {
      // Revert on failure
      setModules((prev) => prev.map((mod) => mod.id === m.id ? { ...mod, completed: m.completed } : mod));
    } finally {
      setToggling(null);
    }
  };

  const completedCount = modules.filter((m) => m.completed).length;
  const total = modules.length;
  const pct = total > 0 ? Math.round((completedCount / total) * 100) : 0;

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
        {total > 0 && (
          <GlassCard style={{ padding: 14 }} borderColor={C.accentBorder}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <View>
                <Text style={{ fontSize: 13, fontWeight: "600", color: C.text }}>Overall Progress</Text>
                <Text style={{ fontSize: 11, color: C.textFaint, marginTop: 2 }}>{completedCount} of {total} completed</Text>
              </View>
              <Text style={{ fontSize: 24, fontWeight: "800", color: C.accent }}>{pct}%</Text>
            </View>
            <View style={{ height: 6, backgroundColor: C.border, borderRadius: 3 }}>
              <View style={{ width: `${pct}%` as any, height: "100%", backgroundColor: C.accent, borderRadius: 3 }} />
            </View>
          </GlassCard>
        )}

        {modules.length === 0 && (
          <Text style={{ color: C.textFaint, textAlign: "center", marginTop: 40 }}>No training modules assigned yet</Text>
        )}

        {modules.map((m) => (
          <TouchableOpacity key={m.id} activeOpacity={0.8} onPress={() => toggle(m)}>
            <GlassCard
              style={{ padding: 14, opacity: m.completed ? 0.65 : 1 }}
              borderColor={m.completed ? C.success + "33" : C.border}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                {m.completed
                  ? <CheckCircle2 size={16} color={C.success} strokeWidth={2} />
                  : <Circle size={16} color={C.textFaint} strokeWidth={1.6} />}
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ fontSize: 13, fontWeight: "600", color: m.completed ? C.textMuted : C.text, textDecorationLine: m.completed ? "line-through" : "none" }}>
                    {m.title}
                  </Text>
                  <Text style={{ fontSize: 11, color: C.textFaint }}>{m.category} · {m.duration_minutes} min</Text>
                </View>
                <ChevronRight size={13} color={C.textDim} strokeWidth={1.6} />
              </View>
            </GlassCard>
          </TouchableOpacity>
        ))}

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}
