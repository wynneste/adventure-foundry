import * as AppleAuthentication from "expo-apple-authentication";
import { useState } from "react";
import { Alert, Platform, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";

export default function SignIn() {
  const t = useTheme();
  const { signInWith } = useAuth();
  const [busy, setBusy] = useState<string | null>(null);

  async function go(provider: "google" | "discord" | "apple") {
    setBusy(provider);
    try {
      await signInWith(provider);
    } catch (e) {
      // The person backing out of Apple's sheet isn't an error worth showing.
      if (!(e instanceof Error && "code" in e && e.code === "ERR_REQUEST_CANCELED")) {
        Alert.alert("Sign-in failed", e instanceof Error ? e.message : String(e));
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg, padding: 24, justifyContent: "space-between" }}>
      <View style={{ marginTop: 80 }}>
        <Text style={{ color: t.accent, fontSize: 40, fontWeight: "900" }}>Adventure{"\n"}Foundry</Text>
        <Text style={{ color: t.text, fontSize: 18, marginTop: 12 }}>
          Find your playgroup. Swipe on Magic players near your LGS or online.
        </Text>
      </View>
      <View style={{ gap: 6 }}>
        {Platform.OS === "ios" ? (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
            cornerRadius={14}
            style={{ height: 50, marginVertical: 4 }}
            onPress={() => go("apple")}
          />
        ) : (
          <Button title="Continue with Apple" variant="secondary" onPress={() => go("apple")} loading={busy === "apple"} />
        )}
        <Button title="Continue with Google" variant="secondary" onPress={() => go("google")} loading={busy === "google"} />
        <Button title="Continue with Discord" onPress={() => go("discord")} loading={busy === "discord"} />
        <Text style={{ color: t.muted, fontSize: 12, textAlign: "center", marginTop: 12 }}>
          18+ only. Adventure Foundry is unofficial Fan Content permitted under the Fan Content Policy. Not approved/endorsed by Wizards. Portions of the materials used are property of Wizards of the Coast. ©Wizards of the Coast LLC.
        </Text>
      </View>
    </SafeAreaView>
  );
}
