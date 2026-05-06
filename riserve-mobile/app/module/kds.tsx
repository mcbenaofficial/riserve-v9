import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { router } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { useTheme } from "../../hooks/useTheme";
import { GlassCard } from "../../components/GlassCard";

const TICKETS = [
  { id: "1", table: "T04", age: 3, items: ["Grilled Salmon", "Caesar Salad", "Lemonade"] },
  { id: "2", table: "T09", age: 9, items: ["Margherita Pizza", "Garlic Bread"] },
  { id: "3", table: "T02", age: 15, items: ["Beef Burger", "Fries", "Coke"] },
];

function Header() {
  const { C } = useTheme();
  return (
    <View style={{ paddingTop: 52, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: C.borderFaint, backgroundColor: C.bg + "F5" }}>
      <TouchableOpacity onPress={() => router.back()} style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 }}>
        <ChevronLeft size={16} color={C.textMuted} strokeWidth={1.6} />
        <Text style={{ fontSize: 13, color: C.textMuted }}>Back</Text>
      </TouchableOpacity>
      <Text style={{ fontSize: 20, fontWeight: "700", color: C.text }}>KDS Feed</Text>
    </View>
  );
}

export default function KDSScreen() {
  const { C } = useTheme();

  function ageColor(age: number) {
    if (age < 5) return C.success;
    if (age <= 12) return C.warning;
    return C.error;
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Header />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        {TICKETS.map((ticket) => {
          const color = ageColor(ticket.age);
          return (
            <GlassCard key={ticket.id} borderColor={color + "44"} style={{ padding: 16, gap: 12 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ fontSize: 22, fontWeight: "800", color: C.text }}>{ticket.table}</Text>
                <View style={{ backgroundColor: color + "22", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: color + "55" }}>
                  <Text style={{ fontSize: 12, fontWeight: "600", color }}>{ticket.age} min</Text>
                </View>
              </View>

              <View style={{ gap: 4 }}>
                {ticket.items.map((item, i) => (
                  <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: C.textFaint }} />
                    <Text style={{ fontSize: 14, color: C.textMuted }}>{item}</Text>
                  </View>
                ))}
              </View>

              <TouchableOpacity
                style={{ backgroundColor: C.accentBg, borderWidth: 1, borderColor: C.accentBorder, borderRadius: 10, paddingVertical: 10, alignItems: "center" }}
                activeOpacity={0.7}
              >
                <Text style={{ fontSize: 14, fontWeight: "600", color: C.accentLight }}>Dispatch</Text>
              </TouchableOpacity>
            </GlassCard>
          );
        })}
      </ScrollView>
    </View>
  );
}
