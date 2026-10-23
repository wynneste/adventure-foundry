import { useColorScheme } from "react-native";

// "Foundry" palette: forge-ember accent on deep night purple.
const light = {
  bg: "#F7F4EF",
  card: "#FFFFFF",
  text: "#1E1A26",
  muted: "#6B6475",
  border: "#E3DDD3",
  accent: "#E2632B",
  accentText: "#FFFFFF",
  like: "#2E9E6A",
  pass: "#B8B1C2",
  danger: "#C23B3B",
  chip: "#EFE9E0",
};

const dark: typeof light = {
  bg: "#141019",
  card: "#1F1A27",
  text: "#F1ECF5",
  muted: "#A39CAD",
  border: "#2F2838",
  accent: "#F07A3E",
  accentText: "#1A0F08",
  like: "#3DBB80",
  pass: "#5A5265",
  danger: "#E25757",
  chip: "#2A2333",
};

export type Theme = typeof light;

export function useTheme(): Theme {
  return useColorScheme() === "dark" ? dark : light;
}
