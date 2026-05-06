import React from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { AuthContext, useAuthProvider } from "../hooks/useAuth";
import { ThemeProvider, useTheme } from "../hooks/useTheme";

function AppShell() {
  const auth = useAuthProvider();
  const { isDark } = useTheme();

  return (
    <AuthContext.Provider value={auth}>
      <StatusBar
        style={isDark ? "light" : "dark"}
        backgroundColor={isDark ? "#0A0A0C" : "#F5F4F0"}
      />
      <Stack screenOptions={{ headerShown: false, animation: "fade" }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="module" />
      </Stack>
    </AuthContext.Provider>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AppShell />
    </ThemeProvider>
  );
}
