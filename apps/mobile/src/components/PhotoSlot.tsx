import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, Text, View } from "react-native";
import { photoUrl, supabase } from "@/lib/supabase";
import { useTheme } from "@/lib/theme";

/** One of the three profile photo slots: you, your commander, your playmat. */
export function PhotoSlot({
  userId, slot, label, path, fallbackUrl, onUploaded,
}: {
  userId: string;
  slot: "person" | "commander" | "playmat";
  label: string;
  path: string | null;
  fallbackUrl?: string | null;
  onUploaded: (path: string) => void;
}) {
  const t = useTheme();
  const [busy, setBusy] = useState(false);
  const shown = photoUrl(path) ?? fallbackUrl ?? null;

  async function pick() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [4, 5],
      quality: 0.8,
    });
    if (result.canceled) return;
    setBusy(true);
    try {
      const asset = result.assets[0];
      const body = await (await fetch(asset.uri)).arrayBuffer();
      // Timestamp in the name so image caches pick up replacements.
      const objectPath = `${userId}/${slot}-${Date.now()}.jpg`;
      const { error } = await supabase.storage
        .from("profile-photos")
        .upload(objectPath, body, { contentType: asset.mimeType ?? "image/jpeg", upsert: true });
      if (error) throw error;
      onUploaded(objectPath);
    } catch (e) {
      Alert.alert("Upload failed", e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Pressable onPress={pick} style={{ flex: 1 }} accessibilityLabel={`Change ${label} photo`}>
      <View
        style={{
          aspectRatio: 4 / 5, borderRadius: 12, overflow: "hidden", backgroundColor: t.chip,
          borderWidth: 1, borderColor: t.border, alignItems: "center", justifyContent: "center",
        }}
      >
        {shown ? <Image source={shown} style={{ width: "100%", height: "100%" }} contentFit="cover" /> : <Text style={{ color: t.muted, fontSize: 28 }}>+</Text>}
        {busy ? <ActivityIndicator style={{ position: "absolute" }} /> : null}
      </View>
      <Text style={{ color: t.muted, textAlign: "center", marginTop: 4, fontSize: 12 }}>{label}</Text>
    </Pressable>
  );
}
