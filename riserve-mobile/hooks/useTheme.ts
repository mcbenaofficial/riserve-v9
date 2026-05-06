import React, { createContext, useContext, useState, useCallback } from "react";
import { useColorScheme } from "react-native";
import { Colors, darkPalette, lightPalette } from "../constants/colors";

interface ThemeContextValue {
  C: Colors;
  isDark: boolean;
  toggleTheme: () => void;
}

export const ThemeContext = createContext<ThemeContextValue>({
  C: darkPalette,
  isDark: true,
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const scheme = useColorScheme();
  const [override, setOverride] = useState<"dark" | "light" | null>(null);

  const active = override ?? scheme ?? "dark";
  const isDark = active === "dark";

  const toggleTheme = useCallback(() => {
    setOverride((prev) => {
      const current = prev ?? scheme ?? "dark";
      return current === "dark" ? "light" : "dark";
    });
  }, [scheme]);

  return React.createElement(
    ThemeContext.Provider,
    { value: { C: isDark ? darkPalette : lightPalette, isDark, toggleTheme } },
    children
  );
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
