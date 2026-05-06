import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { ChevronLeft, Armchair, Clock, User } from "lucide-react-native";
import { useTheme } from "../../hooks/useTheme";
import { GlassCard } from "../../components/GlassCard";
import { getSalonRooms } from "../../services/api";

type Room = {
  id: string;
  name: string;
  status: "Available" | "Occupied" | "Upcoming";
  current_client: string | null;
  next_client: string | null;
  next_time: string | null;
};

function Header() {
  const { C } = useTheme();
  return (
    <View style={{ paddingTop: 52, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: C.borderFaint, backgroundColor: C.bg + "F5" }}>
      <TouchableOpacity onPress={() => router.back()} style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 }}>
        <ChevronLeft size={16} color={C.textMuted} strokeWidth={1.6} />
        <Text style={{ fontSize: 13, color: C.textMuted }}>Back</Text>
      </TouchableOpacity>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Armchair size={18} color={C.salon} strokeWidth={1.6} />
        <Text style={{ fontSize: 20, fontWeight: "700", color: C.text }}>Room View</Text>
      </View>
    </View>
  );
}

function RoomCard({ room }: { room: Room }) {
  const { C } = useTheme();
  const STATUS_CONFIG = {
    Available: { color: C.success,  border: C.success  + "50" },
    Occupied:  { color: C.salon,    border: C.salon    + "50" },
    Upcoming:  { color: C.warning,  border: C.warning  + "50" },
  };
  const cfg = STATUS_CONFIG[room.status] ?? STATUS_CONFIG.Available;

  return (
    <GlassCard style={{ padding: 15, flex: 1, minWidth: "47%" }} borderColor={cfg.border}>
      <View style={{ gap: 8 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Armchair size={16} color={cfg.color} strokeWidth={1.6} />
          <View style={{ backgroundColor: cfg.color + "22", borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3, borderWidth: 1, borderColor: cfg.color + "55" }}>
            <Text style={{ fontSize: 9, fontWeight: "700", color: cfg.color, letterSpacing: 0.4 }}>
              {room.status.toUpperCase()}
            </Text>
          </View>
        </View>

        <Text style={{ fontSize: 15, fontWeight: "700", color: C.text }}>{room.name}</Text>

        {room.status === "Occupied" && room.current_client && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
            <User size={11} color={C.textMuted} strokeWidth={1.6} />
            <Text style={{ fontSize: 12, color: C.textMuted }} numberOfLines={1}>{room.current_client}</Text>
          </View>
        )}

        {(room.status === "Available" || room.status === "Upcoming") && room.next_client && (
          <View style={{ gap: 2 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
              <Clock size={11} color={C.textFaint} strokeWidth={1.6} />
              <Text style={{ fontSize: 11, color: C.textFaint }}>Next: {room.next_time}</Text>
            </View>
            <Text style={{ fontSize: 11, color: C.textMuted }} numberOfLines={1}>{room.next_client}</Text>
          </View>
        )}

        {room.status === "Available" && !room.next_client && (
          <Text style={{ fontSize: 11, color: C.textFaint }}>Free all day</Text>
        )}
      </View>
    </GlassCard>
  );
}

export default function RoomViewScreen() {
  const { C } = useTheme();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await getSalonRooms();
      setRooms(res.data);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const available = rooms.filter((r) => r.status === "Available").length;
  const occupied  = rooms.filter((r) => r.status === "Occupied").length;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Header />
      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={C.salon} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.salon} />}
        >
          {rooms.length > 0 && (
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
              {[
                { label: "AVAILABLE", count: available, color: C.success },
                { label: "OCCUPIED",  count: occupied,  color: C.salon },
                { label: "TOTAL",     count: rooms.length, color: C.textMuted },
              ].map(({ label, count, color }) => (
                <GlassCard key={label} style={{ flex: 1, padding: 12, alignItems: "center" }} borderColor={C.border}>
                  <Text style={{ fontSize: 22, fontWeight: "800", color }}>{count}</Text>
                  <Text style={{ fontSize: 10, color: C.textFaint, marginTop: 2, letterSpacing: 0.5 }}>{label}</Text>
                </GlassCard>
              ))}
            </View>
          )}

          {rooms.length === 0 ? (
            <Text style={{ color: C.textFaint, textAlign: "center", marginTop: 40 }}>
              No rooms configured for this outlet
            </Text>
          ) : (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
              {rooms.map((room) => <RoomCard key={room.id} room={room} />)}
            </View>
          )}
          <View style={{ height: 60 }} />
        </ScrollView>
      )}
    </View>
  );
}
