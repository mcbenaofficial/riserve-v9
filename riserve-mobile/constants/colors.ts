export type Colors = {
  bg: string;
  surface: string;
  card: string;
  cardHover: string;
  border: string;
  borderFaint: string;
  text: string;
  textMuted: string;
  textFaint: string;
  textDim: string;
  accent: string;
  accentLight: string;
  accentBg: string;
  accentBorder: string;
  restaurant: string;
  restaurantLight: string;
  restaurantBg: string;
  salon: string;
  salonLight: string;
  salonBg: string;
  success: string;
  successBg: string;
  successBorder: string;
  warning: string;
  warningBg: string;
  error: string;
  errorBg: string;
  errorBorder: string;
  glassTint: string;
  glassOverlay: string;
};

export const darkPalette: Colors = {
  // Zen dark — warm deep charcoal (matches web app Zen dark mode)
  bg: "#12100D",
  surface: "#1C1915",
  card: "#1C1915",
  cardHover: "#25221E",
  border: "#3A3530",
  borderFaint: "#2A2420",
  text: "#F2EDE6",
  textMuted: "#A8A39A",
  textFaint: "#6A6460",
  textDim: "#524E4A",
  accent: "#C4907E",
  accentLight: "#D4A89A",
  accentBg: "rgba(212,168,154,0.13)",
  accentBorder: "rgba(212,168,154,0.28)",
  restaurant: "#C8953A",
  restaurantLight: "#E8B86D",
  restaurantBg: "rgba(200,149,58,0.13)",
  salon: "#8EA8B0",
  salonLight: "#A8C0C8",
  salonBg: "rgba(142,168,176,0.13)",
  success: "#8B9E7E",
  successBg: "rgba(139,158,126,0.12)",
  successBorder: "rgba(139,158,126,0.25)",
  warning: "#C4A86E",
  warningBg: "rgba(196,168,110,0.12)",
  error: "#B8887E",
  errorBg: "rgba(184,136,126,0.12)",
  errorBorder: "rgba(184,136,126,0.25)",
  glassTint: "rgba(18,16,13,0.55)",
  glassOverlay: "rgba(255,255,255,0.035)",
};

export const lightPalette: Colors = {
  bg: "#F5F4F0",
  surface: "#FFFFFF",
  card: "#FFFFFF",
  cardHover: "#FAF9F6",
  border: "#E2DED5",
  borderFaint: "#EAE7E0",
  text: "#1C1A16",
  textMuted: "#6E6A62",
  textFaint: "#A8A49C",
  textDim: "#C4C0B8",
  accent: "#5A6EC4",
  accentLight: "#6B7FD7",
  accentBg: "rgba(107,127,215,0.10)",
  accentBorder: "rgba(107,127,215,0.22)",
  restaurant: "#B8852A",
  restaurantLight: "#C8953A",
  restaurantBg: "rgba(200,149,58,0.10)",
  salon: "#5E8898",
  salonLight: "#7C9CA8",
  salonBg: "rgba(124,156,168,0.10)",
  success: "#3B9E71",
  successBg: "rgba(76,175,130,0.10)",
  successBorder: "rgba(76,175,130,0.20)",
  warning: "#D06E28",
  warningBg: "rgba(255,140,66,0.10)",
  error: "#D03030",
  errorBg: "rgba(255,68,68,0.10)",
  errorBorder: "rgba(255,68,68,0.20)",
  glassTint: "rgba(245,244,240,0.88)",
  glassOverlay: "rgba(0,0,0,0.025)",
};

// Static dark alias — only use in static/non-component contexts
export const C = darkPalette;

export const VERTICALS = {
  restaurant: { label: "Restaurant", color: darkPalette.restaurant, accent: darkPalette.restaurantLight, bg: darkPalette.restaurantBg },
  salon: { label: "Salon & Spa", color: darkPalette.salon, accent: darkPalette.salonLight, bg: darkPalette.salonBg },
} as const;

export type VerticalKey = keyof typeof VERTICALS;
