import { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { router } from "expo-router";
import { ChevronLeft, Radio, Plus, Users } from "lucide-react-native";
import { useTheme } from "../../hooks/useTheme";
import { GlassCard } from "../../components/GlassCard";

const CHANNELS = [
  { id: "1", name: "All Staff", description: "Broadcast to everyone on shift", live: true, listeners: 12 },
  { id: "2", name: "Kitchen", description: "Kitchen + expeditor team", live: false, listeners: 4 },
];

function Header() {
  const { C } = useTheme();
  return (
    <View style={{ paddingTop: 52, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: C.borderFaint, backgroundColor: C.bg + "F5" }}>
      <TouchableOpacity onPress={() => router.back()} style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 }}>
        <ChevronLeft size={16} color={C.textMuted} strokeWidth={1.6} />
        <Text style={{ fontSize: 13, color: C.textMuted }}>Back</Text>
      </TouchableOpacity>
      <Text style={{ fontSize: 20, fontWeight: "700", color: C.text }}>Intercom</Text>
    </View>
  );
}

export default function IntercomScreen() {
  const { C } = useTheme();
  const [tuned, setTuned] = useState<string | null>(null);
  const isManager = true;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Header />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>

        {CHANNELS.map((ch) => {
          const active = tuned === ch.id;
          return (
            <GlassCard
              key={ch.id}
              borderColor={ch.live ? C.accentBorder : C.border}
              style={{ padding: 16, gap: 10 }}
            >
              <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
                <View style={{ flex: 1, gap: 3 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Text style={{ fontSize: 16, fontWeight: "700", color: C.text }}>{ch.name}</Text>
                    {ch.live && (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: C.error + "22", borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2, borderWidth: 1, borderColor: C.error + "55" }}>
                        <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: C.error }} />
                        <Text style={{ fontSize: 9, fontWeight: "700", color: C.error }}>LIVE</Text>
                      </View>
                    )}
                  </View>
                  <Text style={{ fontSize: 12, color: C.textMuted }}>{ch.description}</Text>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Users size={12} color={C.textFaint} strokeWidth={1.6} />
                  <Text style={{ fontSize: 12, color: C.textFaint }}>{ch.listeners}</Text>
                </View>
              </View>

              <TouchableOpacity
                onPress={() => setTuned(active ? null : ch.id)}
                activeOpacity={0.75}
                style={{
                  flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
                  backgroundColor: active ? C.accentBg : "transparent",
                  borderWidth: 1, borderColor: active ? C.accentBorder : C.border,
                  borderRadius: 10, paddingVertical: 10,
                }}
              >
                <Radio size={15} color={active ? C.accentLight : C.textMuted} strokeWidth={1.6} />
                <Text style={{ fontSize: 14, fontWeight: "600", color: active ? C.accentLight : C.textMuted }}>
                  {active ? "Tuned In" : "Tune In"}
                </Text>
              </TouchableOpacity>
            </GlassCard>
          );
        })}

        {isManager && (
          <TouchableOpacity
            activeOpacity={0.7}
            style={{ borderWidth: 1, borderColor: C.border, borderRadius: 16, borderStyle: "dashed", paddingVertical: 18, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 }}
          >
            <Plus size={16} color={C.textFaint} strokeWidth={1.6} />
            <Text style={{ fontSize: 14, color: C.textFaint }}>Create Channel</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}
