import { useEffect, useState, useRef } from "react";
import { View, Text, ScrollView, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { ChevronLeft, Send } from "lucide-react-native";
import { useTheme } from "../../hooks/useTheme";
import { GlassCard } from "../../components/GlassCard";
import { getMessages, sendMessage } from "../../services/api";

const CHANNELS = ["general", "managers", "section-a"];

interface Message {
  id: string;
  sender_name: string;
  content: string;
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
      <Text style={{ fontSize: 20, fontWeight: "700", color: C.text }}>Messages</Text>
    </View>
  );
}

export default function MessagesScreen() {
  const { C } = useTheme();
  const [channel, setChannel] = useState("general");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const loadMessages = (ch: string) => {
    setLoading(true);
    getMessages(ch)
      .then((res) => setMessages(res.data?.messages ?? res.data ?? []))
      .catch(() => setMessages([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadMessages(channel); }, [channel]);

  const handleSend = async () => {
    if (!input.trim() || sending) return;
    setSending(true);
    try {
      await sendMessage({ content: input.trim(), channel });
      setInput("");
      loadMessages(channel);
    } catch {} finally {
      setSending(false);
    }
  };

  const formatTime = (ts: string) => {
    try { return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); } catch { return ""; }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Header />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 52, borderBottomWidth: 1, borderBottomColor: C.borderFaint }} contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 10, gap: 8 }}>
        {CHANNELS.map((ch) => (
          <TouchableOpacity
            key={ch}
            onPress={() => setChannel(ch)}
            style={{ paddingHorizontal: 14, paddingVertical: 5, borderRadius: 20, backgroundColor: channel === ch ? C.accentBg : "transparent", borderWidth: 1, borderColor: channel === ch ? C.accentBorder : C.border }}
          >
            <Text style={{ fontSize: 13, fontWeight: "600", color: channel === ch ? C.accentLight : C.textMuted }}>#{ch}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={C.accentLight} />
        </View>
      ) : (
        <ScrollView ref={scrollRef} contentContainerStyle={{ padding: 16, gap: 10 }} onContentSizeChange={() => scrollRef.current?.scrollToEnd()}>
          {messages.length === 0 && (
            <Text style={{ color: C.textMuted, textAlign: "center", marginTop: 40 }}>No messages yet.</Text>
          )}
          {messages.map((msg) => (
            <GlassCard key={msg.id} style={{ padding: 12 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                <Text style={{ fontSize: 13, fontWeight: "600", color: C.accentLight }}>{msg.sender_name}</Text>
                <Text style={{ fontSize: 11, color: C.textFaint }}>{formatTime(msg.created_at)}</Text>
              </View>
              <Text style={{ fontSize: 14, color: C.text, lineHeight: 20 }}>{msg.content}</Text>
            </GlassCard>
          ))}
        </ScrollView>
      )}

      <View style={{ padding: 12, borderTopWidth: 1, borderTopColor: C.borderFaint, flexDirection: "row", gap: 8, backgroundColor: C.bg + "F5" }}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Type a message…"
          placeholderTextColor={C.textFaint}
          style={{ flex: 1, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: C.text }}
          returnKeyType="send"
          onSubmitEditing={handleSend}
        />
        <TouchableOpacity
          onPress={handleSend}
          disabled={sending}
          style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: C.accentBg, borderWidth: 1, borderColor: C.accentBorder, alignItems: "center", justifyContent: "center" }}
          activeOpacity={0.7}
        >
          <Send size={18} color={C.accentLight} strokeWidth={1.6} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
