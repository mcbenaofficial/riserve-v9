import { Redirect } from "expo-router";
import { useAuth } from "../hooks/useAuth";
import { View, ActivityIndicator } from "react-native";
import { useTheme } from "../hooks/useTheme";

export default function Index() {
  const { token, loading } = useAuth();
  const { C } = useTheme();
  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={C.accentLight} />
      </View>
    );
  }
  return <Redirect href={token ? "/(tabs)" : "/(auth)/login"} />;
}
