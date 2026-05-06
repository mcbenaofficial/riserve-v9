import { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { router } from "expo-router";
import { ChevronLeft, Bell } from "lucide-react-native";
import { useTheme } from "../../hooks/useTheme";
import { GlassCard } from "../../components/GlassCard";

type AlertStatus = "pending" | "acknowledged" | "done";

interface CallAlert {
  id: string;
  table: string;
  section: string;
  time: string;
  status: AlertStatus;
}

const INIT_ALERTS: CallAlert[] = [
  { id: "1", table: "T03", section: "Main Floor", time: "2 min ago", status: "pending" },
  { id: "2", table: "T11", section: "Terrace", time: "8 min ago", status: "acknowledged" },
];

function Header() {
  const { C } = useTheme();
  return (
    <View style={{ paddingTop: 52, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: C.borderFaint, backgroundColor: C.bg + "F5" }}>
      <TouchableOpacity onPress={() => router.back()} style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 }}>
        <ChevronLeft size={16} color={C.textMuted} strokeWidth={1.6} />
        <Text style={{ fontSize: 13, color: C.textMuted }}>Back</Text>
      </TouchableOpacity>
      <Text style={{ fontSize: 20, fontWeight: "700", color: C.text }}>Call Alerts</Text>
    </View>
  );
}

export default function CallAlertsScreen() {
  const { C } = useTheme();
  const [alerts, setAlerts] = useState<CallAlert[]>(INIT_ALERTS);

  const update = (id: string, status: AlertStatus) => {
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)));
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Header />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        {alerts.map((alert) => {
          const dismissed = alert.status === "done";
          return (
            <GlassCard
              key={alert.id}
              borderColor={dismissed ? C.borderFaint : alert.status === "pending" ? C.warning + "55" : C.accentBorder}
              style={{ padding: 14, opacity: dismissed ? 0.45 : 1 }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 }}>
                <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: dismissed ? C.textFaint + "22" : C.warning + "22", borderWidth: 1, borderColor: dismissed ? C.borderFaint : C.warning + "55", alignItems: "center", justifyContent: "center" }}>
                  <Bell size={18} color={dismissed ? C.textFaint : C.warning} strokeWidth={1.6} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 18, fontWeight: "800", color: dismissed ? C.textFaint : C.text }}>{alert.table}</Text>
                  <Text style={{ fontSize: 12, color: C.textMuted }}>{alert.section} · {alert.time}</Text>
                </View>
                {!dismissed && (
                  <View style={{ backgroundColor: alert.status === "pending" ? C.warning + "22" : C.accentBg, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: alert.status === "pending" ? C.warning + "55" : C.accentBorder }}>
                    <Text style={{ fontSize: 10, fontWeight: "600", color: alert.status === "pending" ? C.warning : C.accentLight, textTransform: "capitalize" }}>
                      {alert.status}
                    </Text>
                  </View>
                )}
              </View>

              {!dismissed && (
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {alert.status === "pending" && (
                    <TouchableOpacity
                      onPress={() => update(alert.id, "acknowledged")}
                      activeOpacity={0.7}
                      style={{ flex: 1, backgroundColor: C.accentBg, borderWidth: 1, borderColor: C.accentBorder, borderRadius: 10, paddingVertical: 9, alignItems: "center" }}
                    >
                      <Text style={{ fontSize: 13, fontWeight: "600", color: C.accentLight }}>ACK</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    onPress={() => update(alert.id, "done")}
                    activeOpacity={0.7}
                    style={{ flex: 1, backgroundColor: C.success + "18", borderWidth: 1, borderColor: C.success + "44", borderRadius: 10, paddingVertical: 9, alignItems: "center" }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: "600", color: C.success }}>Done</Text>
                  </TouchableOpacity>
                </View>
              )}
            </GlassCard>
          );
        })}
      </ScrollView>
    </View>
  );
}
