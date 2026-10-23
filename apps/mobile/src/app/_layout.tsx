import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, View } from "react-native";
import { AuthProvider, useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";

function RootNavigator() {
  const { session, profile, loading } = useAuth();
  const t = useTheme();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: t.bg }}>
        <ActivityIndicator color={t.accent} />
      </View>
    );
  }

  const signedIn = !!session;
  const onboarded = !!profile?.onboarded;

  return (
    <Stack screenOptions={{ headerTintColor: t.accent, headerStyle: { backgroundColor: t.bg }, headerTitleStyle: { color: t.text }, contentStyle: { backgroundColor: t.bg } }}>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="sign-in" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && !onboarded}>
        <Stack.Screen name="onboarding" options={{ title: "Build your profile" }} />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && onboarded}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="chat/[id]" options={{ title: "Chat" }} />
        <Stack.Screen name="profile/[id]" options={{ title: "" }} />
        <Stack.Screen name="edit-profile" options={{ title: "Edit profile", presentation: "modal" }} />
        <Stack.Screen name="verify" options={{ title: "Get verified", presentation: "modal" }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="auto" />
      <RootNavigator />
    </AuthProvider>
  );
}
