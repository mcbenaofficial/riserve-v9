import { useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Modal } from "react-native";
import { router } from "expo-router";
import { ChevronLeft, Plus } from "lucide-react-native";
import { useTheme } from "../../hooks/useTheme";
import { GlassCard } from "../../components/GlassCard";
import { getShiftNotes, createShiftNote } from "../../services/api";

type ShiftType = "day" | "evening" | "night";

interface ShiftNote {
  id: string;
  author_name: string;
  shift_type: ShiftType;
  content: string;
  tags: string[];
  created_at: string;
}

function Header() {
  const { C } = useTheme();
  return (
    <View style={{ paddingTop: 52, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: C.borderFaint, backgroundColor: C.bg + "F5" }}>
      <TouchableOpacity onPress={() => router.back()} style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 }}>
        <ChevronLeft size={16} color={C.textMuted} strokeWidth={1.6} />
        <Text style={{ fontSize: 13, color: C.textMuted }}>Back</Text>
      </TouchableOpacity>
      <Text style={{ fontSize: 20, fontWeight: "700", color: C.text }}>Shift Notes</Text>
    </View>
  );
}

export default function ShiftNotesScreen() {
  const { C } = useTheme();
  const [notes, setNotes] = useState<ShiftNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const SHIFT_COLOR: Record<ShiftType, string> = {
    day: C.restaurantLight,
    evening: C.accent,
    night: "#9B72CF",
  };

  const load = () => {
    setLoading(true);
    getShiftNotes()
      .then((res) => setNotes(res.data?.notes ?? res.data ?? []))
      .catch(() => setNotes([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async () => {
    if (!content.trim() || submitting) return;
    setSubmitting(true);
    const today = new Date().toISOString().split("T")[0];
    try {
      await createShiftNote({ content: content.trim(), shift_date: today, shift_type: "day", tags: [] });
      setModalVisible(false);
      setContent("");
      load();
    } catch {} finally {
      setSubmitting(false);
    }
  };

  const formatDate = (ts: string) => {
    try { return new Date(ts).toLocaleDateString([], { month: "short", day: "numeric" }); } catch { return ""; }
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
          {notes.length === 0 && (
            <Text style={{ color: C.textMuted, textAlign: "center", marginTop: 40 }}>No shift notes yet.</Text>
          )}
          {notes.map((note) => {
            const shiftColor = SHIFT_COLOR[note.shift_type] ?? C.textMuted;
            return (
              <GlassCard key={note.id} style={{ padding: 14, gap: 8 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={{ fontSize: 13, fontWeight: "600", color: C.accentLight }}>{note.author_name}</Text>
                  <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
                    <View style={{ backgroundColor: shiftColor + "22", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: shiftColor + "55" }}>
                      <Text style={{ fontSize: 10, fontWeight: "600", color: shiftColor, textTransform: "capitalize" }}>{note.shift_type}</Text>
                    </View>
                    <Text style={{ fontSize: 11, color: C.textFaint }}>{formatDate(note.created_at)}</Text>
                  </View>
                </View>
                <Text style={{ fontSize: 14, color: C.text, lineHeight: 20 }}>{note.content}</Text>
                {note.tags?.length > 0 && (
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                    {note.tags.map((tag, i) => (
                      <View key={i} style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 }}>
                        <Text style={{ fontSize: 10, color: C.textMuted }}>#{tag}</Text>
                      </View>
                    ))}
                  </View>
                )}
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
          <Text style={{ fontSize: 15, fontWeight: "600", color: C.accentLight }}>Add Note</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setModalVisible(false)}>
        <View style={{ flex: 1, backgroundColor: C.bg, padding: 24 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
            <Text style={{ fontSize: 18, fontWeight: "700", color: C.text }}>Add Shift Note</Text>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Text style={{ fontSize: 14, color: C.textMuted }}>Cancel</Text>
            </TouchableOpacity>
          </View>

          <Text style={{ fontSize: 12, color: C.textMuted, marginBottom: 6 }}>Note</Text>
          <TextInput
            value={content}
            onChangeText={setContent}
            placeholder="Write your handoff note…"
            placeholderTextColor={C.textFaint}
            multiline
            numberOfLines={6}
            style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: C.text, minHeight: 140, textAlignVertical: "top", marginBottom: 24 }}
          />

          <TouchableOpacity
            onPress={handleSubmit}
            disabled={submitting || !content.trim()}
            activeOpacity={0.8}
            style={{ backgroundColor: C.accentBg, borderWidth: 1, borderColor: C.accentBorder, borderRadius: 12, paddingVertical: 14, alignItems: "center", opacity: submitting || !content.trim() ? 0.5 : 1 }}
          >
            <Text style={{ fontSize: 15, fontWeight: "600", color: C.accentLight }}>
              {submitting ? "Saving…" : "Save Note"}
            </Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}
