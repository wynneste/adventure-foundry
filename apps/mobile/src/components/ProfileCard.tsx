import { Image } from "expo-image";
import { useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { COMPETITIVENESS, FORMATS, MANA, PLATFORMS, POWER_LEVELS, labelFor } from "@/lib/constants";
import { photoUrl } from "@/lib/supabase";
import { useTheme } from "@/lib/theme";
import { availabilityInMyZone, describeSlot, localTimeIn, relativeToMe } from "@/lib/time";
import type { Candidate } from "@/lib/types";
import { Chip, ChipRow } from "./ui";

export function displayName(p: { display_name: string; use_handle_as_name: boolean; handle: string | null }) {
  return p.use_handle_as_name && p.handle ? p.handle : p.display_name;
}

function playModeLabel(p: Candidate) {
  if (p.play_mode === "in_person") return "In person";
  if (p.play_mode === "online") return "Online";
  if (p.in_person_weight >= 70) return "Mostly in person";
  if (p.in_person_weight <= 30) return "Mostly online";
  return "In person & online";
}

/** The full profile shown on the swipe deck. Tap the photo to cycle you → commander → playmat. */
export function ProfileCard({ person }: { person: Candidate }) {
  const t = useTheme();
  const photos = [
    photoUrl(person.photo_person),
    photoUrl(person.photo_commander) ?? person.favorite_commander_image,
    photoUrl(person.photo_playmat),
  ].filter((x): x is string => !!x);
  const [photoIndex, setPhotoIndex] = useState(0);

  return (
    <ScrollView style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]} contentContainerStyle={{ paddingBottom: 24 }}>
      <Pressable onPress={() => setPhotoIndex((i) => (i + 1) % Math.max(photos.length, 1))}>
        {photos.length ? (
          <Image source={photos[photoIndex]} style={styles.photo} contentFit="cover" accessibilityLabel={`Photo ${photoIndex + 1} of ${photos.length}`} />
        ) : (
          <View style={[styles.photo, { backgroundColor: t.chip }]} />
        )}
        <View style={styles.dots}>
          {photos.map((_, i) => (
            <View key={i} style={[styles.dot, { backgroundColor: i === photoIndex ? "#fff" : "rgba(255,255,255,0.45)" }]} />
          ))}
        </View>
      </Pressable>

      <View style={{ padding: 16, gap: 14 }}>
        <View>
          <Text style={[styles.name, { color: t.text }]}>
            {displayName(person)}
            {person.verification === "verified" ? "  ✓" : ""}
          </Text>
          <Text style={{ color: t.muted }}>
            {[person.age_range, person.pronouns, person.location_label].filter(Boolean).join(" · ")}
          </Text>
          <Text style={{ color: t.muted, marginTop: 2 }}>
            🕒 {localTimeIn(person.timezone)} · {relativeToMe(person.timezone)}
          </Text>
        </View>

        {person.bio ? <Text style={{ color: t.text, fontSize: 15, lineHeight: 21 }}>{person.bio}</Text> : null}

        {person.favorite_commander_name ? (
          <View>
            <Text style={[styles.label, { color: t.muted }]}>Favorite commander</Text>
            <Text style={{ color: t.text, fontWeight: "600" }}>{person.favorite_commander_name}</Text>
          </View>
        ) : null}

        <View>
          <Text style={[styles.label, { color: t.muted }]}>Formats</Text>
          <ChipRow>
            {person.formats.map((f) => (
              <Chip key={f} label={labelFor(FORMATS, f)} selected={person.shared_formats.includes(f)} />
            ))}
          </ChipRow>
        </View>

        <View style={{ flexDirection: "row", gap: 24, flexWrap: "wrap" }}>
          <View>
            <Text style={[styles.label, { color: t.muted }]}>Power</Text>
            <Text style={{ color: t.text }}>{labelFor(POWER_LEVELS, person.power_level)}</Text>
          </View>
          <View>
            <Text style={[styles.label, { color: t.muted }]}>Vibe</Text>
            <Text style={{ color: t.text }}>{COMPETITIVENESS[person.competitiveness - 1]}</Text>
          </View>
          <View>
            <Text style={[styles.label, { color: t.muted }]}>Plays</Text>
            <Text style={{ color: t.text }}>{playModeLabel(person)}</Text>
          </View>
        </View>

        {person.colors.length ? (
          <View style={{ flexDirection: "row", gap: 6 }}>
            {MANA.filter((m) => person.colors.includes(m.value)).map((m) => (
              <View key={m.value} accessibilityLabel={m.label} style={[styles.pip, { backgroundColor: m.color }]}>
                <Text style={{ fontWeight: "800", color: m.value === "W" ? "#333" : "#fff" }}>{m.value}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {person.platforms.length ? (
          <View>
            <Text style={[styles.label, { color: t.muted }]}>Plays online on</Text>
            <ChipRow>
              {person.platforms.map((p) => <Chip key={p} label={labelFor(PLATFORMS, p)} />)}
            </ChipRow>
          </View>
        ) : null}

        {person.availability.length ? (
          <View>
            <Text style={[styles.label, { color: t.muted }]}>Free (your time)</Text>
            {availabilityInMyZone(person.availability, person.timezone).map((s, i) => (
              <Text key={i} style={{ color: t.text }}>{describeSlot(s)}</Text>
            ))}
          </View>
        ) : null}

        {person.deck_links.length ? (
          <View>
            <Text style={[styles.label, { color: t.muted }]}>Decks</Text>
            {person.deck_links.map((d) => (
              <Text key={d.url} style={{ color: t.accent, paddingVertical: 2 }} onPress={() => Linking.openURL(d.url)}>
                {d.label || d.url.replace(/^https:\/\/(www\.)?/, "")}
              </Text>
            ))}
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, borderRadius: 20, borderWidth: 1, overflow: "hidden" },
  photo: { width: "100%", aspectRatio: 4 / 5 },
  dots: { position: "absolute", top: 10, left: 0, right: 0, flexDirection: "row", justifyContent: "center", gap: 6 },
  dot: { width: 28, height: 4, borderRadius: 2 },
  name: { fontSize: 26, fontWeight: "800" },
  label: { fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 6 },
  pip: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
});
