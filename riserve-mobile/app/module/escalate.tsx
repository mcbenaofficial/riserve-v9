import { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, TextInput } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { ChevronLeft, AlertTriangle } from "lucide-react-native";
import { useTheme } from "../../hooks/useTheme";
import { GlassCard } from "../../components/GlassCard";
import { reportIncident } from "../../services/api";

type EscStatus = "pending" | "acknowledged" | "resolved";

const RECENT = [
  { id: "1", description: "Customer complaint at T07 — food quality issue", status: "resolved" as EscStatus, time: "2h ago" },
  { id: "2", description: "Staff altercation near bar section", status: "acknowledged" as EscStatus, time: "4h ago" },
  { id: "3", description: "POS system unresponsive at station 2", status: "pending" as EscStatus, time: "6h ago" },
];

function Header() {
  const { C } = useTheme();
  return (
    <View style={{ paddingTop: 52, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: C.borderFaint, backgroundColor: C.bg + "F5" }}>
      <TouchableOpacity onPress={() => router.back()} style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 }}>
        <ChevronLeft size={16} color={C.textMuted} strokeWidth={1.6} />
        <Text style={{ fontSize: 13, color: C.textMuted }}>Back</Text>
      </TouchableOpacity>
      <Text style={{ fontSize: 20, fontWeight: "700", color: C.text }}>Escalate</Text>
    </View>
  );
}

export default function EscalateScreen() {
  const { C } = useTheme();
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const ESC_STATUS_COLOR: Record<EscStatus, string> = {
    pending: C.warning,
    acknowledged: C.accent,
    resolved: C.success,
  };

  const handleEscalate = async () => {
    if (!description.trim() || submitting) return;
    setSubmitting(true);
    try {
      await reportIncident({ incident_type: "escalation", description: description.trim(), severity: "high" });
      setSent(true);
      setDescription("");
      setTimeout(() => setSent(false), 3000);
    } catch {} finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Header />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>

        <GlassCard style={{ padding: 16, gap: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <AlertTriangle size={18} color={C.error} strokeWidth={1.6} />
            <Text style={{ fontSize: 14, fontWeight: "600", color: C.text }}>Describe the issue</Text>
          </View>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="What's happening? Include table, section, or any relevant context…"
            placeholderTextColor={C.textFaint}
            multiline
            numberOfLines={5}
            style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: C.text, minHeight: 120, textAlignVertical: "top" }}
          />

          <TouchableOpacity onPress={handleEscalate} disabled={submitting || !description.trim()} activeOpacity={0.85}>
            <LinearGradient
              colors={["#6B7FD7", "#4A5FC4"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ borderRadius: 14, paddingVertical: 16, alignItems: "center", opacity: submitting || !description.trim() ? 0.5 : 1 }}
            >
              <Text style={{ fontSize: 16, fontWeight: "700", color: "#fff" }}>
                {submitting ? "Escalating…" : sent ? "Escalated!" : "Escalate to Manager"}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </GlassCard>

        <Text style={{ fontSize: 13, fontWeight: "600", color: C.textMuted }}>Recent Escalations</Text>

        {RECENT.map((esc) => {
          const color = ESC_STATUS_COLOR[esc.status];
          return (
            <GlassCard key={esc.id} style={{ padding: 14, gap: 6 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                <Text style={{ fontSize: 13, color: C.text, flex: 1, lineHeight: 18 }}>{esc.description}</Text>
                <View style={{ marginLeft: 10, backgroundColor: color + "22", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: color + "55" }}>
                  <Text style={{ fontSize: 10, fontWeight: "600", color, textTransform: "capitalize" }}>{esc.status}</Text>
                </View>
              </View>
              <Text style={{ fontSize: 11, color: C.textFaint }}>{esc.time}</Text>
            </GlassCard>
          );
        })}
      </ScrollView>
    </View>
  );
}
