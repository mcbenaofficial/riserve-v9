declare module "lucide-react-native" {
  import React from "react";

  export interface LucideProps {
    size?: number;
    color?: string;
    strokeWidth?: number;
    absoluteStrokeWidth?: boolean;
    style?: import("react-native").StyleProp<import("react-native").ViewStyle>;
  }

  export type LucideIcon = React.FC<LucideProps>;

  export const Home: LucideIcon;
  export const Bell: LucideIcon;
  export const CircleUser: LucideIcon;
  export const UtensilsCrossed: LucideIcon;
  export const Scissors: LucideIcon;
  export const Clock: LucideIcon;
  export const LogIn: LucideIcon;
  export const LogOut: LucideIcon;
  export const Radio: LucideIcon;
  export const Play: LucideIcon;
  export const X: LucideIcon;
  export const ClipboardList: LucideIcon;
  export const LayoutGrid: LucideIcon;
  export const BellRing: LucideIcon;
  export const MonitorPlay: LucideIcon;
  export const AlertTriangle: LucideIcon;
  export const ArrowLeftRight: LucideIcon;
  export const CalendarDays: LucideIcon;
  export const Armchair: LucideIcon;
  export const User: LucideIcon;
  export const Package: LucideIcon;
  export const TrendingUp: LucideIcon;
  export const CheckSquare: LucideIcon;
  export const ArrowUpCircle: LucideIcon;
  export const MessageSquare: LucideIcon;
  export const Flag: LucideIcon;
  export const Mic: LucideIcon;
  export const ThumbsUp: LucideIcon;
  export const Users: LucideIcon;
  export const BarChart2: LucideIcon;
  export const Zap: LucideIcon;
  export const Check: LucideIcon;
  export const Plus: LucideIcon;
  export const Headphones: LucideIcon;
  export const Star: LucideIcon;
  export const ChevronLeft: LucideIcon;
  export const ChevronRight: LucideIcon;
  export const Send: LucideIcon;
  export const Banknote: LucideIcon;
  export const BookOpen: LucideIcon;
  export const Leaf: LucideIcon;
  export const Coffee: LucideIcon;
  export const Sparkles: LucideIcon;
  export const Utensils: LucideIcon;
  export const AlertCircle: LucideIcon;
  export const Info: LucideIcon;
  export const ChevronDown: LucideIcon;
  export const CheckCircle2: LucideIcon;
  export const Circle: LucideIcon;
  export const Moon: LucideIcon;
  export const Sun: LucideIcon;
  export const Phone: LucideIcon;
}
