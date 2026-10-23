import * as Location from "expo-location";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, ScrollView, Switch, Text, View } from "react-native";
import { ProfileCard } from "@/components/ProfileCard";
import { Button, Muted, Section } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { loadPerson } from "@/lib/data";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/lib/theme";
import type { Candidate } from "@/lib/types";

const TRAVEL_DAYS = 7;

export default function Me() {
  const t = useTheme();
  const { session, profile, signOut } = useAuth();
  const me = session!.user.id;
  const [preview, setPreview] = useState<Candidate | null>(null);
  const [travelUntil, setTravelUntil] = useState<Date | null>(null);

  useFocusEffect(useCallback(() => {
    loadPerson(me).then(setPreview);
    supabase.from("profile_private").select("travel_until, travel_location").eq("id", me).maybeSingle().then(({ data }) => {
      const until = data?.travel_location && data.travel_until ? new Date(data.travel_until) : null;
      setTravelUntil(until && until > new Date() ? until : null);
    });
  }, [me]));

  // Traveling: match around where you are now instead of your LGS. Others see "~N mi away", not your location.
  async function setTraveling(on: boolean) {
    if (!on) {
      await supabase.from("profile_private").update({ travel_location: null, travel_until: null }).eq("id", me);
      setTravelUntil(null);
      return;
    }
    const { granted } = await Location.requestForegroundPermissionsAsync();
    if (!granted) {
      Alert.alert("Location needed", "Allow location access to match with players where you're traveling.");
      return;
    }
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
    // Round to ~1 km before it ever leaves the phone.
    const lat = Math.round(pos.coords.latitude * 100) / 100;
    const lng = Math.round(pos.coords.longitude * 100) / 100;
    const until = new Date(Date.now() + TRAVEL_DAYS * 86400_000);
    const { error } = await supabase.from("profile_private")
      .update({ travel_location: `SRID=4326;POINT(${lng} ${lat})`, travel_until: until.toISOString() }).eq("id", me);
    if (error) Alert.alert("Couldn't turn on travel mode", error.message);
    else setTravelUntil(until);
  }

  return (
    <ScrollView style={{ backgroundColor: t.bg }} contentContainerStyle={{ padding: 16, gap: 8 }}>
      <Button title="Edit profile" onPress={() => router.push("/edit-profile")} />

      <Section title="Traveling?" hint={`Match with players near you for ${TRAVEL_DAYS} days instead of near your LGS.`}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={{ color: t.text }}>{travelUntil ? `On until ${travelUntil.toLocaleDateString()}` : "Off"}</Text>
          <Switch value={!!travelUntil} onValueChange={setTraveling} />
        </View>
      </Section>

      <Section title="Verification">
        {profile?.verification === "verified" ? (
          <Muted>✓ You're verified.</Muted>
        ) : profile?.verification === "pending" ? (
          <Muted>Your selfie is being reviewed.</Muted>
        ) : (
          <Button title="Get the verified check" variant="secondary" onPress={() => router.push("/verify")} />
        )}
      </Section>

      <Section title="How others see you">
        <View style={{ height: 640 }}>{preview ? <ProfileCard person={preview} /> : null}</View>
      </Section>

      <Button title="Sign out" variant="secondary" onPress={signOut} />
      <Button
        title="Delete account"
        variant="danger"
        onPress={() => Alert.alert("Delete account?", "Email support@adventurefoundry.app and we'll delete everything within 30 days.")}
      />
    </ScrollView>
  );
}
