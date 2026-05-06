import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, TextInput,
} from "react-native";
import { router } from "expo-router";
import { ChevronLeft, User, Phone, BookOpen, CalendarDays, ChevronDown, ChevronRight } from "lucide-react-native";
import { useTheme } from "../../hooks/useTheme";
import { GlassCard } from "../../components/GlassCard";
import { getSalonClients } from "../../services/api";

type Client = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  last_visit: string | null;
  total_bookings: number;
  total_revenue: number;
};

function formatDate(iso: string | null) {
  if (!iso) return "Never";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function ClientCard({ client }: { client: Client }) {
  const { C } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const initials = client.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  return (
    <GlassCard style={{ overflow: "hidden" }} borderColor={C.border}>
      <TouchableOpacity onPress={() => setExpanded((v) => !v)} activeOpacity={0.85}>
        <View style={{ flexDirection: "row", alignItems: "center", padding: 14, gap: 12 }}>
          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: C.salonBg, borderWidth: 1, borderColor: C.salon + "60", alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontSize: 14, fontWeight: "700", color: C.salon }}>{initials}</Text>
          </View>
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={{ fontSize: 14, fontWeight: "700", color: C.text }}>{client.name}</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <BookOpen size={10} color={C.textFaint} strokeWidth={1.6} />
                <Text style={{ fontSize: 11, color: C.textFaint }}>{client.total_bookings} visits</Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <CalendarDays size={10} color={C.textFaint} strokeWidth={1.6} />
                <Text style={{ fontSize: 11, color: C.textFaint }}>{formatDate(client.last_visit)}</Text>
              </View>
            </View>
          </View>
          <View style={{ alignItems: "flex-end", gap: 4 }}>
            {client.total_revenue > 0 && (
              <Text style={{ fontSize: 12, fontWeight: "600", color: C.success }}>₹{client.total_revenue.toFixed(0)}</Text>
            )}
            {expanded
              ? <ChevronDown size={14} color={C.textFaint} strokeWidth={1.6} />
              : <ChevronRight size={14} color={C.textFaint} strokeWidth={1.6} />}
          </View>
        </View>
      </TouchableOpacity>

      {expanded && (
        <View style={{ paddingHorizontal: 14, paddingBottom: 14, gap: 8, borderTopWidth: 1, borderTopColor: C.borderFaint }}>
          {client.phone && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingTop: 10 }}>
              <Phone size={12} color={C.salon} strokeWidth={1.6} />
              <Text style={{ fontSize: 13, color: C.text }}>{client.phone}</Text>
            </View>
          )}
          {client.email && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <User size={12} color={C.textFaint} strokeWidth={1.6} />
              <Text style={{ fontSize: 13, color: C.textMuted }}>{client.email}</Text>
            </View>
          )}
          {client.notes ? (
            <View style={{ backgroundColor: C.salonBg, borderRadius: 8, padding: 10, borderLeftWidth: 2, borderLeftColor: C.salon + "80" }}>
              <Text style={{ fontSize: 10, color: C.salon, letterSpacing: 0.6, marginBottom: 4 }}>CLIENT NOTES</Text>
              <Text style={{ fontSize: 13, color: C.textMuted, lineHeight: 18 }}>{client.notes}</Text>
            </View>
          ) : (
            <Text style={{ fontSize: 12, color: C.textFaint, fontStyle: "italic", paddingTop: 4 }}>No notes on file</Text>
          )}
        </View>
      )}
    </GlassCard>
  );
}

export default function ClientNotesScreen() {
  const { C } = useTheme();
  const [clients, setClients] = useState<Client[]>([]);
  const [filtered, setFiltered] = useState<Client[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await getSalonClients();
      setClients(res.data);
      setFiltered(res.data);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!query.trim()) {
      setFiltered(clients);
    } else {
      const q = query.toLowerCase();
      setFiltered(clients.filter((c) =>
        c.name.toLowerCase().includes(q) ||
        c.phone?.includes(q) ||
        c.email?.toLowerCase().includes(q)
      ));
    }
  }, [query, clients]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Header */}
      <View style={{ paddingTop: 52, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: C.borderFaint, backgroundColor: C.bg + "F5" }}>
        <TouchableOpacity onPress={() => router.back()} style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 }}>
          <ChevronLeft size={16} color={C.textMuted} strokeWidth={1.6} />
          <Text style={{ fontSize: 13, color: C.textMuted }}>Back</Text>
        </TouchableOpacity>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <User size={18} color={C.salon} strokeWidth={1.6} />
          <Text style={{ fontSize: 20, fontWeight: "700", color: C.text }}>Client Context</Text>
        </View>
      </View>

      <View style={{ paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.borderFaint }}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search clients…"
          placeholderTextColor={C.textFaint}
          style={{ backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, color: C.text, fontSize: 14 }}
          autoCapitalize="none"
        />
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={C.salon} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, gap: 8 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.salon} />}
          keyboardShouldPersistTaps="handled"
        >
          {filtered.length === 0 && (
            <Text style={{ color: C.textFaint, textAlign: "center", marginTop: 40 }}>
              {query ? "No clients match your search" : "No clients on file"}
            </Text>
          )}
          {filtered.map((c) => <ClientCard key={c.id} client={c} />)}
          <View style={{ height: 60 }} />
        </ScrollView>
      )}
    </View>
  );
}
