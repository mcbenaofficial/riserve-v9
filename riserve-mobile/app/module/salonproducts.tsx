import React, { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView, TouchableOpacity, RefreshControl } from "react-native";
import { router } from "expo-router";
import { ChevronLeft, Package, AlertCircle, AlertTriangle } from "lucide-react-native";
import { useTheme } from "../../hooks/useTheme";
import { GlassCard } from "../../components/GlassCard";
import { getInventoryAlerts } from "../../services/api";

type StockStatus = "Out of Stock" | "Low Stock";

const FALLBACK_ITEMS: { id: string; name: string; category: string; status: StockStatus; updated: string }[] = [
  { id: "1", name: "Olaplex No.3 Hair Perfector", category: "Treatments", status: "Low Stock",    updated: "1h ago" },
  { id: "2", name: "OPI Nail Polish — Mauve",      category: "Nail",       status: "Out of Stock", updated: "3h ago" },
  { id: "3", name: "Kerastase Shampoo 500ml",      category: "Haircare",   status: "Low Stock",    updated: "30m ago" },
  { id: "4", name: "Dermalogica Moisturiser",      category: "Skincare",   status: "Out of Stock", updated: "2h ago" },
  { id: "5", name: "Wax Strips (sensitive)",        category: "Waxing",    status: "Low Stock",    updated: "45m ago" },
];

function Header() {
  const { C } = useTheme();
  return (
    <View style={{ paddingTop: 52, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: C.borderFaint, backgroundColor: C.bg + "F5" }}>
      <TouchableOpacity onPress={() => router.back()} style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 }}>
        <ChevronLeft size={16} color={C.textMuted} strokeWidth={1.6} />
        <Text style={{ fontSize: 13, color: C.textMuted }}>Back</Text>
      </TouchableOpacity>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Package size={18} color={C.salon} strokeWidth={1.6} />
        <Text style={{ fontSize: 20, fontWeight: "700", color: C.text }}>Product Inventory</Text>
      </View>
      <Text style={{ fontSize: 12, color: C.textFaint, marginTop: 2 }}>Low stock · out of stock alerts</Text>
    </View>
  );
}

export default function SalonProductsScreen() {
  const { C } = useTheme();
  const [items, setItems] = useState(FALLBACK_ITEMS);
  const [refreshing, setRefreshing] = useState(false);

  const STATUS_CONFIG: Record<StockStatus, { color: string; Icon: any }> = {
    "Out of Stock": { color: C.error,   Icon: AlertCircle },
    "Low Stock":    { color: C.warning, Icon: AlertTriangle },
  };

  const load = useCallback(async () => {
    try {
      const res = await getInventoryAlerts();
      if (Array.isArray(res.data) && res.data.length > 0) {
        setItems(res.data.map((i: any) => ({
          id: i.id ?? i.name,
          name: i.name,
          category: i.category ?? "Product",
          status: (i.status ?? i.stock_status ?? "Low Stock") as StockStatus,
          updated: i.updated ?? i.updated_at ?? "—",
        })));
      }
    } catch {}
  }, []);

  useEffect(() => { load(); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const outCount = items.filter((i) => i.status === "Out of Stock").length;
  const lowCount = items.filter((i) => i.status === "Low Stock").length;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Header />
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 10 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.salon} />}
      >
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 6 }}>
          <GlassCard style={{ flex: 1, padding: 12, alignItems: "center" }} borderColor={C.error + "33"}>
            <Text style={{ fontSize: 22, fontWeight: "800", color: C.error }}>{outCount}</Text>
            <Text style={{ fontSize: 9, color: C.textFaint, marginTop: 2, letterSpacing: 0.5 }}>OUT OF STOCK</Text>
          </GlassCard>
          <GlassCard style={{ flex: 1, padding: 12, alignItems: "center" }} borderColor={C.warning + "33"}>
            <Text style={{ fontSize: 22, fontWeight: "800", color: C.warning }}>{lowCount}</Text>
            <Text style={{ fontSize: 9, color: C.textFaint, marginTop: 2, letterSpacing: 0.5 }}>LOW STOCK</Text>
          </GlassCard>
        </View>

        {items.map((item) => {
          const cfg = STATUS_CONFIG[item.status] ?? STATUS_CONFIG["Low Stock"];
          return (
            <GlassCard
              key={item.id}
              style={{ padding: 14 }}
              borderColor={cfg.color + "30"}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={{ fontSize: 14, fontWeight: "600", color: C.text }}>{item.name}</Text>
                  <Text style={{ fontSize: 12, color: C.textMuted }}>{item.category} · {item.updated}</Text>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: cfg.color + "22", borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5, borderWidth: 1, borderColor: cfg.color + "55", marginLeft: 10 }}>
                  <cfg.Icon size={11} color={cfg.color} strokeWidth={1.8} />
                  <Text style={{ fontSize: 11, fontWeight: "600", color: cfg.color }}>{item.status}</Text>
                </View>
              </View>
            </GlassCard>
          );
        })}
        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}
