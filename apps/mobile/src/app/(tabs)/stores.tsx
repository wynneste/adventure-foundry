import { useEffect, useState } from "react";
import { Linking, Platform, Text, View } from "react-native";
import MapView, { Callout, Marker } from "react-native-maps";
import { Button, Muted } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/lib/theme";
import type { Store } from "@/lib/types";

const KANSAS_CITY = { latitude: 39.0997, longitude: -94.5786, latitudeDelta: 0.6, longitudeDelta: 0.6 };

export default function Stores() {
  const t = useTheme();
  const { session, profile, refreshProfile } = useAuth();
  const [stores, setStores] = useState<Store[]>([]);
  const [selected, setSelected] = useState<Store | null>(null);

  useEffect(() => {
    // store_lat / store_lng are computed columns defined in the migration.
    supabase.from("stores").select("id, name, address, city, website, phone, status, lat:store_lat, lng:store_lng")
      .then(({ data }) => setStores((data ?? []) as unknown as Store[]));
  }, []);

  const home = stores.find((s) => s.id === profile?.home_store_id);
  const region = home ? { latitude: home.lat, longitude: home.lng, latitudeDelta: 0.4, longitudeDelta: 0.4 } : KANSAS_CITY;

  async function makeHome(s: Store) {
    await supabase.from("profiles").update({ home_store_id: s.id }).eq("id", session!.user.id);
    await refreshProfile();
  }

  function directions(s: Store) {
    const q = encodeURIComponent(`${s.name} ${s.address ?? ""}`);
    Linking.openURL(Platform.OS === "ios" ? `http://maps.apple.com/?q=${q}` : `https://www.google.com/maps/search/?api=1&query=${q}`);
  }

  return (
    <View style={{ flex: 1 }}>
      <MapView style={{ flex: 1 }} initialRegion={region} showsUserLocation>
        {stores.map((s) => (
          <Marker
            key={s.id}
            coordinate={{ latitude: s.lat, longitude: s.lng }}
            pinColor={s.id === profile?.home_store_id ? "gold" : s.status === "verified" ? t.accent : "gray"}
            onPress={() => setSelected(s)}
          >
            <Callout><Text>{s.name}</Text></Callout>
          </Marker>
        ))}
      </MapView>
      {selected ? (
        <View style={{ position: "absolute", left: 12, right: 12, bottom: 12, backgroundColor: t.card, borderRadius: 16, padding: 14, gap: 4 }}>
          <Text style={{ color: t.text, fontSize: 18, fontWeight: "800" }}>
            {selected.name} {selected.status === "verified" ? "✓" : ""}
          </Text>
          {selected.address ? <Muted>{selected.address}</Muted> : null}
          {selected.website ? <Text style={{ color: t.accent }} onPress={() => Linking.openURL(selected.website!)}>Website</Text> : null}
          <View style={{ flexDirection: "row", gap: 8, marginTop: 6 }}>
            <View style={{ flex: 1 }}>
              <Button
                title={selected.id === profile?.home_store_id ? "Your LGS ★" : "Make my LGS"}
                variant={selected.id === profile?.home_store_id ? "secondary" : "primary"}
                onPress={() => makeHome(selected)}
              />
            </View>
            <View style={{ flex: 1 }}><Button title="Directions" variant="secondary" onPress={() => directions(selected)} /></View>
          </View>
          <Button title="Close" variant="secondary" onPress={() => setSelected(null)} />
        </View>
      ) : null}
    </View>
  );
}
