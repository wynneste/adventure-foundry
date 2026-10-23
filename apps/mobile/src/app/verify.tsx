import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, Text, View } from "react-native";
import { Button, Muted } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/lib/theme";

const GESTURES = ["a peace sign ✌️", "a thumbs up 👍", "three fingers up", "a hand on your head", "pointing at the camera"];

/**
 * Photo verification v1: take a selfie doing a random pose; an admin compares
 * it to the profile photo on the website. Automated face matching can come later.
 */
export default function Verify() {
  const t = useTheme();
  const { session, refreshProfile } = useAuth();
  const gesture = useMemo(() => GESTURES[Math.floor(Math.random() * GESTURES.length)], []);
  const [busy, setBusy] = useState(false);

  async function capture() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Camera needed", "Allow camera access to take your verification selfie.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ cameraType: ImagePicker.CameraType.front, quality: 0.7 });
    if (result.canceled) return;
    setBusy(true);
    try {
      const userId = session!.user.id;
      const path = `${userId}/selfie-${Date.now()}.jpg`;
      const body = await (await fetch(result.assets[0].uri)).arrayBuffer();
      const up = await supabase.storage.from("verification").upload(path, body, { contentType: "image/jpeg" });
      if (up.error) throw up.error;
      const ins = await supabase.from("verifications").insert({ profile_id: userId, selfie_path: path, gesture });
      if (ins.error) throw ins.error;
      await supabase.from("profiles").update({ verification: "pending" }).eq("id", userId);
      await refreshProfile();
      Alert.alert("Sent!", "We'll review it soon.");
      router.back();
    } catch (e) {
      Alert.alert("Couldn't upload", e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ flex: 1, padding: 24, gap: 16, backgroundColor: t.bg }}>
      <Text style={{ color: t.text, fontSize: 22, fontWeight: "800" }}>Show us it's really you</Text>
      <Text style={{ color: t.text, fontSize: 18 }}>Take a selfie making {gesture}</Text>
      <Muted>Only our moderators see this photo. It's never shown on your profile.</Muted>
      <Button title="Open camera" onPress={capture} loading={busy} />
    </View>
  );
}
