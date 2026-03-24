'use client';

import React, { useEffect } from 'react';

export type BrandingData = {
  primary_color?: string;
  font_family?: string;
  logo_url?: string;
  hero_image?: string;
  hero_tagline?: string;
  custom_domain?: string;
};

export const BrandingContext = React.createContext<BrandingData | null>(null);

function hexToRgbOklch(hex: string) {
  // A simplistic approximation for injecting into shadcn CSS vars
  // Shadcn commonly uses HSL or OKLCH. We use RGB or raw values depending on globals.css
  // For standard shadcn tailwind setup initialized by CLI, it's HSL (e.g., 222.2 47.4% 11.2%)
  // But let's build a simple HEX to HSL converter:
  let r = 0, g = 0, b = 0;
  if (hex.length === 4) {
    r = "0x" + hex[1] + hex[1];
    g = "0x" + hex[2] + hex[2];
    b = "0x" + hex[3] + hex[3];
  } else if (hex.length === 7) {
    r = "0x" + hex[1] + hex[2];
    g = "0x" + hex[3] + hex[4];
    b = "0x" + hex[5] + hex[6];
  }
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return `${(h * 360).toFixed(1)} ${(s * 100).toFixed(1)}% ${(l * 100).toFixed(1)}%`;
}

export function BrandingProvider({ branding, children }: { branding: BrandingData; children: React.ReactNode }) {
  useEffect(() => {
    const root = document.documentElement;
    if (branding.primary_color) {
      const hsl = hexToRgbOklch(branding.primary_color);
      root.style.setProperty('--primary', hsl);
      root.style.setProperty('--ring', hsl);
    }
    if (branding.font_family) {
      document.body.style.fontFamily = `"${branding.font_family}", sans-serif`;
    }
  }, [branding]);

  return <BrandingContext.Provider value={branding}>{children}</BrandingContext.Provider>;
}

export const useBranding = () => {
    return React.useContext(BrandingContext);
}
