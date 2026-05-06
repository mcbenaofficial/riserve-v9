import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, RefreshControl,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { ChevronLeft, Banknote, ChevronDown, ChevronRight } from "lucide-react-native";
import { useTheme } from "../../hooks/useTheme";
import { GlassCard } from "../../components/GlassCard";
import { getMyPayslips } from "../../services/api";

type Payslip = {
  id: string;
  period: string;
  month: number;
  year: number;
  gross_pay: number;
  net_pay: number;
  total_deductions: number;
  basic_salary: number;
  allowances: number;
  overtime_pay: number;
  bonus: number;
  tax: number;
  provident_fund: number;
  days_present: number;
  days_absent: number;
};

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function fmt(n: number): string {
  return "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 0 });
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
        <Banknote size={18} color={C.accent} strokeWidth={1.6} />
        <Text style={{ fontSize: 20, fontWeight: "700", color: C.text }}>Payroll</Text>
      </View>
      <Text style={{ fontSize: 12, color: C.textFaint, marginTop: 2 }}>Your payslips · last 12 months</Text>
    </View>
  );
}

function PayslipCard({ p }: { p: Payslip }) {
  const { C } = useTheme();
  const [open, setOpen] = useState(false);
  const label = p.period || `${MONTHS[(p.month ?? 1) - 1]} ${p.year}`;

  return (
    <GlassCard style={{ padding: 0, overflow: "hidden" }} borderColor={C.accent + "30"}>
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => setOpen((v) => !v)}
        style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 14 }}
      >
        <View style={{ gap: 2 }}>
          <Text style={{ fontSize: 14, fontWeight: "600", color: C.text }}>{label}</Text>
          <Text style={{ fontSize: 12, color: C.textMuted }}>
            {p.days_present}d present · {p.days_absent}d absent
          </Text>
        </View>
        <View style={{ alignItems: "flex-end", gap: 2 }}>
          <Text style={{ fontSize: 16, fontWeight: "700", color: C.accent }}>{fmt(p.net_pay)}</Text>
          <Text style={{ fontSize: 10, color: C.textFaint }}>net pay</Text>
        </View>
      </TouchableOpacity>

      {open && (
        <View style={{ paddingHorizontal: 14, paddingBottom: 14, gap: 6 }}>
          <View style={{ height: 1, backgroundColor: C.borderFaint, marginBottom: 6 }} />

          <Text style={{ fontSize: 10, color: C.textDim, letterSpacing: 0.8, marginBottom: 4 }}>EARNINGS</Text>
          {[
            ["Basic Salary",   p.basic_salary],
            ["Allowances",     p.allowances],
            ["Overtime",       p.overtime_pay],
            ["Bonus",          p.bonus],
          ].filter(([, v]) => (v as number) > 0).map(([label, val]) => (
            <Row key={label as string} label={label as string} value={fmt(val as number)} color={C.success} />
          ))}
          <Row label="Gross Pay" value={fmt(p.gross_pay)} color={C.success} bold />

          <View style={{ height: 1, backgroundColor: C.borderFaint, marginVertical: 4 }} />

          <Text style={{ fontSize: 10, color: C.textDim, letterSpacing: 0.8, marginBottom: 4 }}>DEDUCTIONS</Text>
          {[
            ["Income Tax",      p.tax],
            ["Provident Fund",  p.provident_fund],
          ].filter(([, v]) => (v as number) > 0).map(([label, val]) => (
            <Row key={label as string} label={label as string} value={`-${fmt(val as number)}`} color={C.error} />
          ))}
          <Row label="Total Deductions" value={`-${fmt(p.total_deductions)}`} color={C.error} bold />

          <View style={{ height: 1, backgroundColor: C.borderFaint, marginVertical: 4 }} />
          <Row label="Net Pay" value={fmt(p.net_pay)} color={C.accent} bold />
        </View>
      )}

      <TouchableOpacity
        onPress={() => setOpen((v) => !v)}
        style={{ alignItems: "center", paddingVertical: 6, borderTopWidth: 1, borderTopColor: C.borderFaint }}
      >
        {open
          ? <ChevronDown size={14} color={C.textFaint} strokeWidth={1.6} />
          : <ChevronRight size={14} color={C.textFaint} strokeWidth={1.6} />}
      </TouchableOpacity>
    </GlassCard>
  );
}

function Row({ label, value, color, bold }: { label: string; value: string; color: string; bold?: boolean }) {
  const { C } = useTheme();
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
      <Text style={{ fontSize: 13, color: C.textMuted, fontWeight: bold ? "600" : "400" }}>{label}</Text>
      <Text style={{ fontSize: 13, color, fontWeight: bold ? "700" : "500" }}>{value}</Text>
    </View>
  );
}

export default function PayrollScreen() {
  const { C } = useTheme();
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await getMyPayslips();
      if (Array.isArray(res.data)) setPayslips(res.data);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Header />
      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={C.accent} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, gap: 10 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} />}
        >
          {payslips.length === 0 ? (
            <View style={{ alignItems: "center", marginTop: 48, gap: 8 }}>
              <Banknote size={32} color={C.textFaint} strokeWidth={1.4} />
              <Text style={{ color: C.textFaint }}>No published payslips yet</Text>
            </View>
          ) : (
            payslips.map((p) => <PayslipCard key={p.id} p={p} />)
          )}
          <View style={{ height: 60 }} />
        </ScrollView>
      )}
    </View>
  );
}
