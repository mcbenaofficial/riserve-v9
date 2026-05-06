import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { router } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { useTheme } from "../../hooks/useTheme";
import { GlassCard } from "../../components/GlassCard";

type ItemStatus = "Out of Stock" | "Low Stock";

const ITEMS: { id: string; name: string; category: string; status: ItemStatus; updated: string }[] = [
  { id: "1", name: "Salmon Fillet", category: "Seafood", status: "Out of Stock", updated: "2h ago" },
  { id: "2", name: "Truffle Oil", category: "Condiments", status: "Low Stock", updated: "45m ago" },
  { id: "3", name: "Burrata Cheese", category: "Dairy", status: "Out of Stock", updated: "3h ago" },
  { id: "4", name: "Wagyu Beef", category: "Meat", status: "Low Stock", updated: "1h ago" },
];

function Header() {
  const { C } = useTheme();
  return (
    <View style={{ paddingTop: 52, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: C.borderFaint, backgroundColor: C.bg + "F5" }}>
      <TouchableOpacity onPress={() => router.back()} style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 }}>
        <ChevronLeft size={16} color={C.textMuted} strokeWidth={1.6} />
        <Text style={{ fontSize: 13, color: C.textMuted }}>Back</Text>
      </TouchableOpacity>
      <Text style={{ fontSize: 20, fontWeight: "700", color: C.text }}>86'd Items</Text>
    </View>
  );
}

export default function EightySixedScreen() {
  const { C } = useTheme();

  const STATUS_COLOR: Record<ItemStatus, string> = {
    "Out of Stock": C.error,
    "Low Stock": C.warning,
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Header />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        {ITEMS.map((item) => {
          const color = STATUS_COLOR[item.status];
          return (
            <GlassCard key={item.id} style={{ padding: 14 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={{ fontSize: 16, fontWeight: "600", color: C.text }}>{item.name}</Text>
                  <Text style={{ fontSize: 12, color: C.textMuted }}>{item.category} · Updated {item.updated}</Text>
                </View>
                <View style={{ backgroundColor: color + "22", borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4, borderWidth: 1, borderColor: color + "55" }}>
                  <Text style={{ fontSize: 11, fontWeight: "600", color }}>{item.status}</Text>
                </View>
              </View>
            </GlassCard>
          );
        })}
      </ScrollView>
    </View>
  );
}
