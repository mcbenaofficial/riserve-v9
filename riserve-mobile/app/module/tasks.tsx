import { useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { ChevronLeft, CheckCircle2, Circle } from "lucide-react-native";
import { useTheme } from "../../hooks/useTheme";
import { GlassCard } from "../../components/GlassCard";
import { getTasks, updateTask } from "../../services/api";

type Category = "opening" | "closing" | "cleaning" | "general";

interface Task {
  id: string;
  title: string;
  category: Category;
  status: string;
}

function Header() {
  const { C } = useTheme();
  return (
    <View style={{ paddingTop: 52, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: C.borderFaint, backgroundColor: C.bg + "F5" }}>
      <TouchableOpacity onPress={() => router.back()} style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 }}>
        <ChevronLeft size={16} color={C.textMuted} strokeWidth={1.6} />
        <Text style={{ fontSize: 13, color: C.textMuted }}>Back</Text>
      </TouchableOpacity>
      <Text style={{ fontSize: 20, fontWeight: "700", color: C.text }}>Tasks</Text>
    </View>
  );
}

export default function TasksScreen() {
  const { C } = useTheme();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const CATEGORY_COLOR: Record<Category, string> = {
    opening: C.success,
    closing: C.accent,
    cleaning: C.restaurant,
    general: C.textMuted,
  };

  useEffect(() => {
    getTasks()
      .then((res) => setTasks(res.data?.tasks ?? res.data ?? []))
      .catch(() => setTasks([]))
      .finally(() => setLoading(false));
  }, []);

  const handleToggle = async (task: Task) => {
    if (task.status === "done") return;
    try {
      await updateTask(task.id, { status: "done" });
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: "done" } : t)));
    } catch {}
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Header />
      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={C.accentLight} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
          {tasks.length === 0 && (
            <Text style={{ color: C.textMuted, textAlign: "center", marginTop: 40 }}>No tasks found.</Text>
          )}
          {tasks.map((task) => {
            const done = task.status === "done";
            const catColor = CATEGORY_COLOR[task.category as Category] ?? C.textMuted;
            return (
              <GlassCard key={task.id} style={{ padding: 14 }}>
                <TouchableOpacity
                  onPress={() => handleToggle(task)}
                  activeOpacity={0.7}
                  style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
                >
                  {done
                    ? <CheckCircle2 size={22} color={C.success} strokeWidth={1.6} />
                    : <Circle size={22} color={C.textFaint} strokeWidth={1.6} />
                  }
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={{ fontSize: 14, fontWeight: "500", color: done ? C.textFaint : C.text, textDecorationLine: done ? "line-through" : "none" }}>
                      {task.title}
                    </Text>
                    <View style={{ backgroundColor: catColor + "22", borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2, alignSelf: "flex-start", borderWidth: 1, borderColor: catColor + "44" }}>
                      <Text style={{ fontSize: 10, fontWeight: "600", color: catColor }}>{task.category}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              </GlassCard>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}
