import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { router } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { useTheme } from "../../hooks/useTheme";
import { GlassCard } from "../../components/GlassCard";

const ORDERS = [
  { id: "1", table: "T04", items: 3, status: "Preparing", elapsed: "8 min" },
  { id: "2", table: "T09", items: 5, status: "Ready", elapsed: "14 min" },
  { id: "3", table: "T02", items: 2, status: "Ordering", elapsed: "2 min" },
  { id: "4", table: "T11", items: 4, status: "Preparing", elapsed: "11 min" },
];

function Header() {
  const { C } = useTheme();
  return (
    <View style={{ paddingTop: 52, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: C.borderFaint, backgroundColor: C.bg + "F5" }}>
      <TouchableOpacity onPress={() => router.back()} style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 }}>
        <ChevronLeft size={16} color={C.textMuted} strokeWidth={1.6} />
        <Text style={{ fontSize: 13, color: C.textMuted }}>Back</Text>
      </TouchableOpacity>
      <Text style={{ fontSize: 20, fontWeight: "700", color: C.text }}>Orders</Text>
    </View>
  );
}

export default function OrdersScreen() {
  const { C } = useTheme();

  const STATUS_COLOR: Record<string, string> = {
    Preparing: C.warning,
    Ready: C.success,
    Ordering: C.accent,
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Header />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        {ORDERS.map((order) => {
          const color = STATUS_COLOR[order.status] ?? C.textMuted;
          return (
            <GlassCard key={order.id} style={{ padding: 16 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Text style={{ fontSize: 28, fontWeight: "800", color: C.text, letterSpacing: 1 }}>
                  {order.table}
                </Text>
                <View style={{ alignItems: "flex-end", gap: 6 }}>
                  <View style={{ backgroundColor: color + "22", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: color + "55" }}>
                    <Text style={{ fontSize: 12, fontWeight: "600", color }}>
                      {order.status}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 12, color: C.textMuted }}>{order.items} items · {order.elapsed}</Text>
                </View>
              </View>
            </GlassCard>
          );
        })}
      </ScrollView>
    </View>
  );
}
