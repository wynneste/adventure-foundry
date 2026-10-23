import { Tabs } from "expo-router/tabs";
import { Text } from "react-native";
import { useTheme } from "@/lib/theme";

// Emoji icons keep v1 dependency-free; swap for an icon set later.
const icon = (glyph: string) => ({ focused }: { focused: boolean }) => (
  <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.55 }}>{glyph}</Text>
);

export default function TabsLayout() {
  const t = useTheme();
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: t.accent,
        tabBarStyle: { backgroundColor: t.card, borderTopColor: t.border },
        headerStyle: { backgroundColor: t.bg },
        headerTitleStyle: { color: t.text },
        sceneStyle: { backgroundColor: t.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Discover", tabBarIcon: icon("🔥") }} />
      <Tabs.Screen name="matches" options={{ title: "Matches", tabBarIcon: icon("💬") }} />
      <Tabs.Screen name="events" options={{ title: "Events", tabBarIcon: icon("📅") }} />
      <Tabs.Screen name="stores" options={{ title: "Stores", tabBarIcon: icon("🗺️") }} />
      <Tabs.Screen name="me" options={{ title: "Me", tabBarIcon: icon("🧙") }} />
    </Tabs>
  );
}
