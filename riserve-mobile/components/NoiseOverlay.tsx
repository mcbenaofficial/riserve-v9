import React from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Defs, Filter, FeTurbulence, FeColorMatrix, Rect } from "react-native-svg";
import { useTheme } from "../hooks/useTheme";

interface NoiseOverlayProps {
  opacity?: number;
}

export function NoiseOverlay({ opacity }: NoiseOverlayProps) {
  const { isDark } = useTheme();
  const o = opacity ?? (isDark ? 0.038 : 0.022);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          <Filter id="grain" x="0%" y="0%" width="100%" height="100%">
            <FeTurbulence
              type="fractalNoise"
              baseFrequency="0.72"
              numOctaves="4"
              stitchTiles="stitch"
            />
            <FeColorMatrix type="saturate" values="0" />
          </Filter>
        </Defs>
        <Rect width="100%" height="100%" filter="url(#grain)" opacity={o} />
      </Svg>
    </View>
  );
}
