import { useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Modal } from "react-native";
import { router } from "expo-router";
import { ChevronLeft, Plus, ChevronDown } from "lucide-react-native";
import { useTheme } from "../../hooks/useTheme";
import { GlassCard } from "../../components/GlassCard";
import { getIncidents, reportIncident } from "../../services/api";

type Severity = "low" | "medium" | "high" | "critical";
type IncidentType = "complaint" | "accident" | "quality" | "other";

const TYPES: IncidentType[] = ["complaint", "accident", "quality", "other"];

interface Incident {
  id: string;
  incident_type: string;
  description: string;
  severity: Severity;
  created_at: string;
  table_ref?: string;
}

function Header() {
  const { C } = useTheme();
  return (
    <View style={{ paddingTop: 52, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: C.borderFaint, backgroundColor: C.bg + "F5" }}>
      <TouchableOpacity onPress={() => router.back()} style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 }}>
        <ChevronLeft size={16} color={C.textMuted} strokeWidth={1.6} />
        <Text style={{ fontSize: 13, color: C.textMuted }}>Back</Text>
      </TouchableOpacity>
      <Text style={{ fontSize: 20, fontWeight: "700", color: C.text }}>Incidents</Text>
    </View>
  );
}

export default function IncidentsScreen() {
  const { C } = useTheme();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [type, setType] = useState<IncidentType>("complaint");
  const [description, setDescription] = useState("");
  const [tableRef, setTableRef] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showTypePicker, setShowTypePicker] = useState(false);

  const SEV_COLOR: Record<Severity, string> = {
    low: C.success,
    medium: C.warning,
    high: C.error,
    critical: "#8B0000",
  };

  const load = () => {
    setLoading(true);
    getIncidents()
      .then((res) => setIncidents(res.data?.incidents ?? res.data ?? []))
      .catch(() => setIncidents([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async () => {
    if (!description.trim() || submitting) return;
    setSubmitting(true);
    try {
      await reportIncident({ incident_type: type, description: description.trim(), table_ref: tableRef.trim() || undefined });
      setModalVisible(false);
      setDescription("");
      setTableRef("");
      setType("complaint");
      load();
    } catch {} finally {
      setSubmitting(false);
    }
  };

  const formatDate = (ts: string) => {
    try { return new Date(ts).toLocaleDateString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }); } catch { return ""; }
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Header />
      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={C.accentLight} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 100 }}>
          {incidents.length === 0 && (
            <Text style={{ color: C.textMuted, textAlign: "center", marginTop: 40 }}>No incidents logged.</Text>
          )}
          {incidents.map((inc) => {
            const color = SEV_COLOR[inc.severity] ?? C.textMuted;
            return (
              <GlassCard key={inc.id} style={{ padding: 14, gap: 6 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <Text style={{ fontSize: 14, fontWeight: "600", color: C.text, textTransform: "capitalize" }}>{inc.incident_type}</Text>
                  <View style={{ backgroundColor: color + "22", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: color + "55" }}>
                    <Text style={{ fontSize: 10, fontWeight: "600", color, textTransform: "uppercase" }}>{inc.severity}</Text>
                  </View>
                </View>
                <Text style={{ fontSize: 13, color: C.textMuted, lineHeight: 18 }}>{inc.description}</Text>
                {inc.table_ref && <Text style={{ fontSize: 11, color: C.textFaint }}>Table: {inc.table_ref}</Text>}
                <Text style={{ fontSize: 11, color: C.textFaint }}>{formatDate(inc.created_at)}</Text>
              </GlassCard>
            );
          })}
        </ScrollView>
      )}

      <View style={{ position: "absolute", bottom: 24, left: 16, right: 16 }}>
        <TouchableOpacity
          onPress={() => setModalVisible(true)}
          activeOpacity={0.8}
          style={{ backgroundColor: C.accentBg, borderWidth: 1, borderColor: C.accentBorder, borderRadius: 14, paddingVertical: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}
        >
          <Plus size={16} color={C.accentLight} strokeWidth={2} />
          <Text style={{ fontSize: 15, fontWeight: "600", color: C.accentLight }}>Report Incident</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setModalVisible(false)}>
        <View style={{ flex: 1, backgroundColor: C.bg, padding: 24 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
            <Text style={{ fontSize: 18, fontWeight: "700", color: C.text }}>Report Incident</Text>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Text style={{ fontSize: 14, color: C.textMuted }}>Cancel</Text>
            </TouchableOpacity>
          </View>

          <Text style={{ fontSize: 12, color: C.textMuted, marginBottom: 6 }}>Type</Text>
          <TouchableOpacity
            onPress={() => setShowTypePicker(!showTypePicker)}
            style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}
          >
            <Text style={{ fontSize: 14, color: C.text, textTransform: "capitalize" }}>{type}</Text>
            <ChevronDown size={16} color={C.textMuted} strokeWidth={1.6} />
          </TouchableOpacity>
          {showTypePicker && (
            <GlassCard style={{ marginBottom: 12 }}>
              {TYPES.map((t) => (
                <TouchableOpacity key={t} onPress={() => { setType(t); setShowTypePicker(false); }} style={{ paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: C.borderFaint }}>
                  <Text style={{ fontSize: 14, color: type === t ? C.accentLight : C.textMuted, textTransform: "capitalize" }}>{t}</Text>
                </TouchableOpacity>
              ))}
            </GlassCard>
          )}

          <Text style={{ fontSize: 12, color: C.textMuted, marginBottom: 6, marginTop: 12 }}>Description</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Describe the incident…"
            placeholderTextColor={C.textFaint}
            multiline
            numberOfLines={4}
            style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: C.text, minHeight: 100, textAlignVertical: "top", marginBottom: 12 }}
          />

          <Text style={{ fontSize: 12, color: C.textMuted, marginBottom: 6 }}>Table Reference (optional)</Text>
          <TextInput
            value={tableRef}
            onChangeText={setTableRef}
            placeholder="e.g. T04"
            placeholderTextColor={C.textFaint}
            style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: C.text, marginBottom: 24 }}
          />

          <TouchableOpacity
            onPress={handleSubmit}
            disabled={submitting || !description.trim()}
            activeOpacity={0.8}
            style={{ backgroundColor: C.accentBg, borderWidth: 1, borderColor: C.accentBorder, borderRadius: 12, paddingVertical: 14, alignItems: "center", opacity: submitting || !description.trim() ? 0.5 : 1 }}
          >
            <Text style={{ fontSize: 15, fontWeight: "600", color: C.accentLight }}>
              {submitting ? "Submitting…" : "Submit Incident"}
            </Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}
