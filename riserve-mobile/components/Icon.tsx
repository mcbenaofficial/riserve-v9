import React from "react";
import { LucideIcon } from "lucide-react-native";

interface IconProps {
  Icon: LucideIcon;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export function Icon({ Icon: LI, size = 16, color = "currentColor", strokeWidth = 1.6 }: IconProps) {
  // Cast to any to bridge lucide-react-native's runtime props vs TS types
  const LIAny = LI as any;
  return <LIAny size={size} color={color} strokeWidth={strokeWidth} />;
}
