import React from "react";
import { Tabs } from "expo-router";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { View, Platform, StyleSheet, TouchableOpacity } from "react-native";
import { Home, Bell, CircleUser } from "lucide-react-native";
import { useTheme } from "../../hooks/useTheme";
import { NoiseOverlay } from "../../components/NoiseOverlay";

const ICONS = [Home, Bell, CircleUser];

function TabBar({ state, descriptors, navigation }: any) {
  const { C, isDark } = useTheme();

  return (
    <View style={styles.outerWrapper}>
      {/* Shadow carrier — no overflow:hidden so shadow renders */}
      <View style={[styles.shadowCarrier, { borderColor: isDark ? "rgba(255,255,255,0.11)" : "rgba(0,0,0,0.06)" }]}>
        {/* Clip container — overflow:hidden keeps blur inside pill */}
        <View style={styles.pillClip}>
          {/* Heavy blur — ultra-thick material */}
          <BlurView
            intensity={100}
            tint={isDark ? "dark" : "light"}
            style={StyleSheet.absoluteFill}
          />
          {/* Thin color tint — keep blur visible */}
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: isDark ? "rgba(18,16,13,0.42)" : "rgba(248,247,244,0.46)" },
            ]}
          />
          {/* Top specular sheen */}
          <LinearGradient
            colors={
              isDark
                ? ["rgba(255,255,255,0.072)", "rgba(255,255,255,0.0)"]
                : ["rgba(255,255,255,0.82)", "rgba(255,255,255,0.0)"]
            }
            style={[StyleSheet.absoluteFill, { height: "50%" }]}
          />
          {/* 1px top specular line */}
          <View
            style={[
              StyleSheet.absoluteFill,
              {
                borderRadius: 28,
                borderWidth: 1,
                borderTopColor: isDark ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,1.0)",
                borderLeftColor: isDark ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.7)",
                borderRightColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.4)",
                borderBottomColor: "transparent",
              },
            ]}
          />

          {/* Grain texture inside pill */}
          <NoiseOverlay opacity={isDark ? 0.028 : 0.016} />

          <View style={styles.row}>
            {state.routes.map((route: any, index: number) => {
              const focused = state.index === index;
              const Icon = ICONS[index];
              const iconColor = focused ? C.accentLight : C.textDim;

              return (
                <TouchableOpacity
                  key={route.key}
                  style={styles.tab}
                  activeOpacity={0.65}
                  onPress={() => navigation.navigate(route.name)}
                >
                  <View
                    style={[
                      styles.iconPill,
                      focused && {
                        backgroundColor: C.accentBg,
                        borderColor: C.accentBorder,
                      },
                      !focused && { borderColor: "transparent" },
                    ]}
                  >
                    <Icon size={19} color={iconColor} strokeWidth={focused ? 2 : 1.5} />
                  </View>
                  {focused && (
                    <View style={[styles.activeDot, { backgroundColor: C.accentLight }]} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
    </View>
  );
}

const PILL_HEIGHT = 62;
const TAB_BAR_TOTAL = PILL_HEIGHT + (Platform.OS === "ios" ? 40 : 26);

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarStyle: { display: "none" },
      }}
      sceneContainerStyle={{ paddingBottom: TAB_BAR_TOTAL }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="notifications" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  outerWrapper: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 28,
    paddingBottom: Platform.OS === "ios" ? 28 : 12,
    paddingTop: 6,
    backgroundColor: "transparent",
  },
  shadowCarrier: {
    borderRadius: 28,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.28,
    shadowRadius: 24,
    elevation: 16,
  },
  pillClip: {
    borderRadius: 28,
    overflow: "hidden",
    height: PILL_HEIGHT,
  },
  row: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingHorizontal: 12,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    height: PILL_HEIGHT,
    gap: 4,
  },
  iconPill: {
    width: 52,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
});
