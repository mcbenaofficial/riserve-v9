import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { router } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { useTheme } from "../../hooks/useTheme";
import { GlassCard } from "../../components/GlassCard";

type TableStatus = "free" | "seated" | "ordering" | "billing" | "needs";

const STATUS_LABEL: Record<TableStatus, string> = {
  free: "Free",
  seated: "Seated",
  ordering: "Ordering",
  billing: "Billing",
  needs: "Needs",
};

const TABLES: { id: string; status: TableStatus }[] = [
  { id: "T01", status: "seated" },
  { id: "T02", status: "ordering" },
  { id: "T03", status: "free" },
  { id: "T04", status: "needs" },
  { id: "T05", status: "billing" },
  { id: "T06", status: "free" },
  { id: "T07", status: "seated" },
  { id: "T08", status: "ordering" },
  { id: "T09", status: "free" },
  { id: "T10", status: "seated" },
  { id: "T11", status: "ordering" },
  { id: "T12", status: "billing" },
  { id: "T13", status: "free" },
  { id: "T14", status: "needs" },
  { id: "T15", status: "free" },
  { id: "T16", status: "seated" },
];

function Header() {
  const { C } = useTheme();
  return (
    <View style={{ paddingTop: 52, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: C.borderFaint, backgroundColor: C.bg + "F5" }}>
      <TouchableOpacity onPress={() => router.back()} style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 }}>
        <ChevronLeft size={16} color={C.textMuted} strokeWidth={1.6} />
        <Text style={{ fontSize: 13, color: C.textMuted }}>Back</Text>
      </TouchableOpacity>
      <Text style={{ fontSize: 20, fontWeight: "700", color: C.text }}>Floor View</Text>
    </View>
  );
}

export default function FloorScreen() {
  const { C } = useTheme();

  const STATUS_COLOR: Record<TableStatus, string> = {
    free: C.textFaint,
    seated: C.accent,
    ordering: C.success,
    billing: "#9B72CF",
    needs: C.error,
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Header />
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          {TABLES.map((table) => {
            const color = STATUS_COLOR[table.status];
            return (
              <GlassCard
                key={table.id}
                borderColor={color + "55"}
                style={{ width: "22%", aspectRatio: 1, alignItems: "center", justifyContent: "center", padding: 8 }}
              >
                <View style={{ position: "absolute", inset: 0, backgroundColor: color + "18", borderRadius: 16 }} />
                <Text style={{ fontSize: 13, fontWeight: "700", color: C.text }}>{table.id}</Text>
                <Text style={{ fontSize: 9, color, marginTop: 3 }}>{STATUS_LABEL[table.status]}</Text>
              </GlassCard>
            );
          })}
        </View>

        <View style={{ marginTop: 20, gap: 8 }}>
          <Text style={{ fontSize: 12, color: C.textMuted, marginBottom: 4 }}>Legend</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {(Object.entries(STATUS_LABEL) as [TableStatus, string][]).map(([status, label]) => (
              <View key={status} style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: STATUS_COLOR[status] }} />
                <Text style={{ fontSize: 11, color: C.textMuted }}>{label}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
