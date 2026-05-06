import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, RefreshControl,
  ActivityIndicator, Modal, TextInput, Alert,
} from "react-native";
import { router } from "expo-router";
import { ChevronLeft, Leaf, CheckCircle2, Circle, AlertCircle, Plus, X } from "lucide-react-native";
import { useTheme } from "../../hooks/useTheme";
import { GlassCard } from "../../components/GlassCard";
import { GlassButton } from "../../components/GlassButton";
import { getMyLeaves } from "../../services/api";
import api from "../../services/api";
import { useAuth } from "../../hooks/useAuth";

type Leave = {
  id: string;
  start_date: string;
  end_date: string;
  days: number;
  reason: string | null;
  status: string;
  approver_notes: string | null;
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  } catch { return iso; }
}

function Header() {
  const { C } = useTheme();
  return (
    <View style={{ paddingTop: 52, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: C.borderFaint, backgroundColor: C.bg + "F5" }}>
      <TouchableOpacity onPress={() => router.back()} style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 }}>
        <ChevronLeft size={16} color={C.textMuted} strokeWidth={1.6} />
        <Text style={{ fontSize: 13, color: C.textMuted }}>Back</Text>
      </TouchableOpacity>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Leaf size={18} color={C.success} strokeWidth={1.6} />
        <Text style={{ fontSize: 20, fontWeight: "700", color: C.text }}>Leave Management</Text>
      </View>
      <Text style={{ fontSize: 12, color: C.textFaint, marginTop: 2 }}>Your leave requests</Text>
    </View>
  );
}

function StatusBadge({ status }: { status: string }) {
  const { C } = useTheme();
  const cfg: Record<string, { color: string; Icon: typeof CheckCircle2 }> = {
    approved: { color: C.success,   Icon: CheckCircle2 },
    pending:  { color: C.warning,   Icon: Circle },
    rejected: { color: C.error,     Icon: AlertCircle },
  };
  const c = cfg[status.toLowerCase()] ?? cfg.pending;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: c.color + "22", borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4, borderWidth: 1, borderColor: c.color + "55" }}>
      <c.Icon size={10} color={c.color} strokeWidth={2} />
      <Text style={{ fontSize: 11, fontWeight: "600", color: c.color, textTransform: "capitalize" }}>{status}</Text>
    </View>
  );
}

function RequestModal({ visible, onClose, onSubmit }: { visible: boolean; onClose: () => void; onSubmit: (data: { start: string; end: string; reason: string }) => void }) {
  const { C, isDark } = useTheme();
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [reason, setReason] = useState("");

  const inputStyle = {
    borderWidth: 1, borderColor: C.border, borderRadius: 10,
    paddingHorizontal: 13, paddingVertical: 11,
    fontSize: 14, color: C.text,
    backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)",
    marginBottom: 12,
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: isDark ? "rgba(0,0,0,0.7)" : "rgba(0,0,0,0.4)" }}>
        <View style={{ backgroundColor: C.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
            <Text style={{ fontSize: 17, fontWeight: "700", color: C.text }}>Request Leave</Text>
            <TouchableOpacity onPress={onClose}><X size={18} color={C.textMuted} /></TouchableOpacity>
          </View>
          <Text style={{ fontSize: 11, color: C.textFaint, marginBottom: 6, letterSpacing: 0.5 }}>START DATE (YYYY-MM-DD)</Text>
          <TextInput
            style={inputStyle}
            placeholder="2026-05-10"
            placeholderTextColor={C.textFaint}
            value={start}
            onChangeText={setStart}
          />
          <Text style={{ fontSize: 11, color: C.textFaint, marginBottom: 6, letterSpacing: 0.5 }}>END DATE (YYYY-MM-DD)</Text>
          <TextInput
            style={inputStyle}
            placeholder="2026-05-11"
            placeholderTextColor={C.textFaint}
            value={end}
            onChangeText={setEnd}
          />
          <Text style={{ fontSize: 11, color: C.textFaint, marginBottom: 6, letterSpacing: 0.5 }}>REASON</Text>
          <TextInput
            style={[inputStyle, { height: 80, textAlignVertical: "top" }]}
            placeholder="Brief reason for leave…"
            placeholderTextColor={C.textFaint}
            value={reason}
            onChangeText={setReason}
            multiline
          />
          <GlassButton
            label="Submit Request"
            onPress={() => {
              if (!start || !end) return Alert.alert("Missing dates", "Please enter start and end dates.");
              onSubmit({ start, end, reason });
            }}
          />
        </View>
      </View>
    </Modal>
  );
}

export default function LeavesScreen() {
  const { C } = useTheme();
  const { user } = useAuth();
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await getMyLeaves();
      if (Array.isArray(res.data)) setLeaves(res.data);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const submitLeave = async ({ start, end, reason }: { start: string; end: string; reason: string }) => {
    try {
      const staffRes = await api.get("/mobile/me/profile");
      const staffId = staffRes.data?.staff?.id;
      if (!staffId) return Alert.alert("Error", "Staff profile not found.");
      await api.post(`/staff/leave/requests?staff_id=${staffId}`, {
        leave_type_id: "annual",
        start_date: start,
        end_date: end,
        reason,
      });
      setModalVisible(false);
      load();
    } catch (e: any) {
      Alert.alert("Failed", e?.response?.data?.detail ?? "Could not submit request.");
    }
  };

  const pending = leaves.filter((l) => l.status === "pending").length;
  const approved = leaves.filter((l) => l.status === "approved").length;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Header />

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={C.success} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, gap: 10 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.success} />}
        >
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 4 }}>
            <GlassCard style={{ flex: 1, padding: 12, alignItems: "center" }} borderColor={C.warning + "33"}>
              <Text style={{ fontSize: 22, fontWeight: "800", color: C.warning }}>{pending}</Text>
              <Text style={{ fontSize: 9, color: C.textFaint, marginTop: 2, letterSpacing: 0.5 }}>PENDING</Text>
            </GlassCard>
            <GlassCard style={{ flex: 1, padding: 12, alignItems: "center" }} borderColor={C.success + "33"}>
              <Text style={{ fontSize: 22, fontWeight: "800", color: C.success }}>{approved}</Text>
              <Text style={{ fontSize: 9, color: C.textFaint, marginTop: 2, letterSpacing: 0.5 }}>APPROVED</Text>
            </GlassCard>
          </View>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setModalVisible(true)}
            style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: C.success + "18", borderRadius: 12, paddingVertical: 13, borderWidth: 1, borderColor: C.success + "44", marginBottom: 4 }}
          >
            <Plus size={14} color={C.success} strokeWidth={2} />
            <Text style={{ fontSize: 13, fontWeight: "600", color: C.success }}>Request Leave</Text>
          </TouchableOpacity>

          {leaves.length === 0 ? (
            <View style={{ alignItems: "center", marginTop: 40, gap: 8 }}>
              <Leaf size={32} color={C.textFaint} strokeWidth={1.4} />
              <Text style={{ color: C.textFaint }}>No leave requests yet</Text>
            </View>
          ) : (
            leaves.map((l) => (
              <GlassCard key={l.id} style={{ padding: 14 }} borderColor={C.border}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text style={{ fontSize: 14, fontWeight: "600", color: C.text }}>
                      {formatDate(l.start_date)} — {formatDate(l.end_date)}
                    </Text>
                    <Text style={{ fontSize: 12, color: C.textMuted }}>
                      {l.days} {l.days === 1 ? "day" : "days"}
                      {l.reason ? ` · ${l.reason}` : ""}
                    </Text>
                    {l.approver_notes && (
                      <Text style={{ fontSize: 11, color: C.textFaint, fontStyle: "italic", marginTop: 2 }}>
                        Note: {l.approver_notes}
                      </Text>
                    )}
                  </View>
                  <StatusBadge status={l.status} />
                </View>
              </GlassCard>
            ))
          )}
          <View style={{ height: 60 }} />
        </ScrollView>
      )}

      <RequestModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onSubmit={submitLeave}
      />
    </View>
  );
}
