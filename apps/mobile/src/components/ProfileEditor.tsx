import Slider from "@react-native-community/slider";
import { useEffect, useMemo, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Switch, Text, View } from "react-native";
import { useAuth } from "@/lib/auth";
import { COMPETITIVENESS, FORMATS, MANA, PLATFORMS, POWER_LEVELS, WEEKDAYS } from "@/lib/constants";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/lib/theme";
import { deviceTimezone } from "@/lib/time";
import type { Availability, DeckLink, ManaColor, MatchIntent, MtgFormat, OnlinePlatform, PlayMode, PowerLevel, Profile } from "@/lib/types";
import { CommanderPicker } from "./CommanderPicker";
import { PhotoSlot } from "./PhotoSlot";
import { Button, Chip, ChipRow, Field, Muted, Section } from "./ui";

// Simple time blocks instead of a fiddly time picker. Minutes from midnight.
const BLOCKS = [
  { label: "Morning", start: 9 * 60, end: 12 * 60 },
  { label: "Afternoon", start: 12 * 60, end: 17 * 60 },
  { label: "Evening", start: 17 * 60, end: 22 * 60 },
  { label: "Late", start: 22 * 60, end: 24 * 60 },
];

type StoreOption = { id: string; name: string; city: string | null };

/** Parses MM/DD/YYYY into YYYY-MM-DD, or null if invalid. */
function parseBirthdate(text: string) {
  const m = text.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const [, mm, dd, yyyy] = m.map(Number);
  const d = new Date(Date.UTC(yyyy, mm - 1, dd));
  if (d.getUTCMonth() !== mm - 1 || d.getUTCDate() !== dd) return null;
  return `${yyyy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}

function isAdult(isoDate: string) {
  const birth = new Date(isoDate + "T00:00:00Z");
  const cutoff = new Date();
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 18);
  return birth <= cutoff;
}

export function ProfileEditor({ onSaved }: { onSaved: () => void }) {
  const t = useTheme();
  const { session, profile, refreshProfile } = useAuth();
  const userId = session!.user.id;
  const meta = session!.user.user_metadata ?? {};

  const [p, setP] = useState<Partial<Profile>>(() => profile ?? {
    display_name: meta.full_name ?? meta.name ?? "",
    handle: meta.custom_claims?.global_name ?? meta.preferred_username ?? null,
    use_handle_as_name: false,
    play_mode: "both",
    in_person_weight: 50,
    power_level: "casual",
    competitiveness: 2,
    colors: [],
    intents: ["play"],
    platforms: [],
    search_radius_miles: 25,
    timezone: deviceTimezone(),
  });
  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => setP((prev) => ({ ...prev, [k]: v }));

  const [birthdate, setBirthdate] = useState("");
  const [formats, setFormats] = useState<MtgFormat[]>([]);
  const [handles, setHandles] = useState<Partial<Record<OnlinePlatform, string>>>({});
  const [availability, setAvailability] = useState<Availability[]>([]);
  const [decks, setDecks] = useState<DeckLink[]>([]);
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [storeQuery, setStoreQuery] = useState("");
  const [saving, setSaving] = useState(false);

  // Load the rest of an existing profile.
  useEffect(() => {
    supabase.from("stores").select("id, name, city").order("name").then(({ data }) => setStores(data ?? []));
    if (!profile) return;
    supabase.from("profile_private").select("birthdate").eq("id", userId).maybeSingle().then(({ data }) => {
      if (data) {
        const [y, m, d] = data.birthdate.split("-");
        setBirthdate(`${m}/${d}/${y}`);
      }
    });
    supabase.from("profile_formats").select("format").eq("profile_id", userId).order("rank")
      .then(({ data }) => setFormats((data ?? []).map((f) => f.format)));
    supabase.from("profile_platforms").select("platform, handle").eq("profile_id", userId)
      .then(({ data }) => setHandles(Object.fromEntries((data ?? []).map((r) => [r.platform, r.handle ?? ""]))));
    supabase.from("availability").select("weekday, start_minute, end_minute").eq("profile_id", userId)
      .then(({ data }) => setAvailability(data ?? []));
    supabase.from("deck_links").select("label, url").eq("profile_id", userId).then(({ data }) => setDecks(data ?? []));
  }, [profile, userId]);

  const filteredStores = useMemo(() => {
    const q = storeQuery.trim().toLowerCase();
    return stores.filter((s) => s.id === p.home_store_id || (q.length > 0 && s.name.toLowerCase().includes(q))).slice(0, 8);
  }, [stores, storeQuery, p.home_store_id]);

  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const hasBlock = (day: number, b: (typeof BLOCKS)[number]) =>
    availability.some((a) => a.weekday === day && a.start_minute === b.start);
  const toggleBlock = (day: number, b: (typeof BLOCKS)[number]) =>
    setAvailability((prev) =>
      hasBlock(day, b)
        ? prev.filter((a) => !(a.weekday === day && a.start_minute === b.start))
        : [...prev, { weekday: day, start_minute: b.start, end_minute: b.end }],
    );

  const inPerson = p.play_mode !== "online";
  const online = p.play_mode !== "in_person";

  async function save() {
    const iso = parseBirthdate(birthdate);
    const problems = [
      !p.display_name?.trim() && "your name",
      !iso && "your birthdate (MM/DD/YYYY)",
      formats.length === 0 && "at least one format",
      inPerson && !p.home_store_id && "your favorite local game store",
      !p.photo_person && "a photo of you",
    ].filter(Boolean);
    if (problems.length) {
      Alert.alert("Almost there", `Please add ${problems.join(", ")}.`);
      return;
    }
    if (!isAdult(iso!)) {
      Alert.alert("Sorry", "Adventure Foundry is for players 18 and older.");
      return;
    }
    const badDeck = decks.find((d) => d.url && !/^https:\/\/(www\.)?(moxfield\.com|archidekt\.com)\//i.test(d.url));
    if (badDeck) {
      Alert.alert("Deck links", "Deck links need to be Moxfield or Archidekt URLs starting with https://");
      return;
    }

    setSaving(true);
    try {
      const platforms = online ? (Object.keys(handles) as OnlinePlatform[]) : [];
      const row = {
        id: userId,
        display_name: p.display_name!.trim(),
        use_handle_as_name: !!p.use_handle_as_name && !!p.handle,
        handle: p.handle?.trim() || null,
        pronouns: p.pronouns?.trim() || null,
        bio: p.bio?.trim() || null,
        play_mode: p.play_mode,
        in_person_weight: p.in_person_weight,
        power_level: p.power_level,
        competitiveness: p.competitiveness,
        colors: p.colors,
        intents: p.intents?.length ? p.intents : ["play"],
        platforms,
        favorite_commander_name: p.favorite_commander_name ?? null,
        favorite_commander_scryfall_id: p.favorite_commander_scryfall_id ?? null,
        favorite_commander_image: p.favorite_commander_image ?? null,
        photo_person: p.photo_person,
        photo_commander: p.photo_commander ?? null,
        photo_playmat: p.photo_playmat ?? null,
        home_store_id: p.home_store_id ?? null,
        timezone: deviceTimezone(),
        search_radius_miles: p.search_radius_miles,
      };
      const r1 = await supabase.from("profiles").upsert(row);
      if (r1.error) throw r1.error;
      const r2 = await supabase.from("profile_private").upsert({ id: userId, birthdate: iso });
      if (r2.error) throw r2.error;

      // Replace the list-style tables wholesale — simplest correct approach at this size.
      await Promise.all([
        supabase.from("profile_formats").delete().eq("profile_id", userId),
        supabase.from("profile_platforms").delete().eq("profile_id", userId),
        supabase.from("availability").delete().eq("profile_id", userId),
        supabase.from("deck_links").delete().eq("profile_id", userId),
      ]);
      const inserts = await Promise.all([
        supabase.from("profile_formats").insert(formats.map((format, i) => ({ profile_id: userId, format, rank: i + 1 }))),
        platforms.length
          ? supabase.from("profile_platforms").insert(platforms.map((platform) => ({ profile_id: userId, platform, handle: handles[platform] || null })))
          : null,
        availability.length
          ? supabase.from("availability").insert(availability.map((a) => ({ ...a, profile_id: userId })))
          : null,
        decks.filter((d) => d.url).length
          ? supabase.from("deck_links").insert(decks.filter((d) => d.url).map((d) => ({ profile_id: userId, label: d.label || null, url: d.url })))
          : null,
      ]);
      const failed = inserts.find((r) => r?.error);
      if (failed?.error) throw failed.error;

      const r3 = await supabase.from("profiles").update({ onboarded: true }).eq("id", userId);
      if (r3.error) throw r3.error;
      await refreshProfile();
      onSaved();
    } catch (e) {
      Alert.alert("Couldn't save", e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
        <Section title="Photos" hint="You, your commander and your playmat. Tap a box to choose a photo.">
          <View style={{ flexDirection: "row", gap: 10 }}>
            <PhotoSlot userId={userId} slot="person" label="You" path={p.photo_person ?? null} onUploaded={(v) => set("photo_person", v)} />
            <PhotoSlot
              userId={userId} slot="commander" label="Commander" path={p.photo_commander ?? null}
              fallbackUrl={p.favorite_commander_image} onUploaded={(v) => set("photo_commander", v)}
            />
            <PhotoSlot userId={userId} slot="playmat" label="Playmat" path={p.photo_playmat ?? null} onUploaded={(v) => set("photo_playmat", v)} />
          </View>
        </Section>

        <Section title="About you">
          <Field label="Name" value={p.display_name ?? ""} onChangeText={(v) => set("display_name", v)} maxLength={40} />
          <Field label="Handle (Discord name, Arena name...)" value={p.handle ?? ""} onChangeText={(v) => set("handle", v)} maxLength={40} autoCapitalize="none" />
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <Text style={{ color: t.text, flex: 1 }}>Show my handle instead of my name</Text>
            <Switch value={!!p.use_handle_as_name} onValueChange={(v) => set("use_handle_as_name", v)} disabled={!p.handle} />
          </View>
          <Field label="Pronouns (optional)" value={p.pronouns ?? ""} onChangeText={(v) => set("pronouns", v)} maxLength={30} />
          <Field label="Birthdate — only your age range is shown" placeholder="MM/DD/YYYY" value={birthdate} onChangeText={setBirthdate} keyboardType="numbers-and-punctuation" maxLength={10} />
          <Field label="Bio" value={p.bio ?? ""} onChangeText={(v) => set("bio", v)} multiline maxLength={500} style={{ minHeight: 90 }} placeholder="What do you love about Magic?" />
        </Section>

        <Section title="Looking for">
          <ChipRow>
            {(["play", "trade"] as MatchIntent[]).map((i) => (
              <Chip key={i} label={i === "play" ? "People to play with" : "Trading partners"} selected={p.intents?.includes(i)} onPress={() => set("intents", toggle(p.intents ?? [], i))} />
            ))}
          </ChipRow>
        </Section>

        <Section title="Favorite commander">
          <CommanderPicker
            value={{ name: p.favorite_commander_name ?? null, image: p.favorite_commander_image ?? null }}
            onChange={(card) => setP((prev) => ({
              ...prev,
              favorite_commander_name: card.name,
              favorite_commander_scryfall_id: card.id,
              favorite_commander_image: card.imageUrl,
            }))}
          />
        </Section>

        <Section title="Formats" hint="Pick all you play. Tap in order of preference: your first pick is your favorite.">
          <ChipRow>
            {FORMATS.map((f) => {
              const rank = formats.indexOf(f.value);
              return (
                <Chip key={f.value} label={rank >= 0 ? `${rank + 1}. ${f.label}` : f.label} selected={rank >= 0} onPress={() => setFormats(toggle(formats, f.value))} />
              );
            })}
          </ChipRow>
        </Section>

        <Section title="Favorite colors">
          <ChipRow>
            {MANA.map((m) => (
              <Chip key={m.value} label={m.label} color={m.value === "W" ? "#B8A66A" : m.color} selected={p.colors?.includes(m.value)} onPress={() => set("colors", toggle(p.colors ?? [], m.value as ManaColor))} />
            ))}
          </ChipRow>
        </Section>

        <Section title="Power level">
          <ChipRow>
            {POWER_LEVELS.map((l) => (
              <Chip key={l.value} label={l.label} selected={p.power_level === l.value} onPress={() => set("power_level", l.value as PowerLevel)} />
            ))}
          </ChipRow>
        </Section>

        <Section title="Casual or competitive?">
          <ChipRow>
            {COMPETITIVENESS.map((label, i) => (
              <Chip key={label} label={label} selected={p.competitiveness === i + 1} onPress={() => set("competitiveness", i + 1)} />
            ))}
          </ChipRow>
        </Section>

        <Section title="How do you play?">
          <ChipRow>
            {([["in_person", "In person"], ["online", "Online"], ["both", "Both"]] as [PlayMode, string][]).map(([v, label]) => (
              <Chip key={v} label={label} selected={p.play_mode === v} onPress={() => set("play_mode", v)} />
            ))}
          </ChipRow>
          {p.play_mode === "both" ? (
            <View style={{ marginTop: 12 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Muted>Mostly online</Muted>
                <Muted>Mostly in person</Muted>
              </View>
              <Slider minimumValue={0} maximumValue={100} step={10} value={p.in_person_weight ?? 50} onSlidingComplete={(v) => set("in_person_weight", v)} minimumTrackTintColor={t.accent} />
            </View>
          ) : null}
        </Section>

        {inPerson ? (
          <Section title="Favorite local game store" hint="We match you with players near this store.">
            <Field placeholder="Search stores" value={storeQuery} onChangeText={setStoreQuery} />
            {filteredStores.map((s) => (
              <Pressable key={s.id} onPress={() => { set("home_store_id", s.id); setStoreQuery(""); }} style={{ paddingVertical: 8 }}>
                <Text style={{ color: s.id === p.home_store_id ? t.accent : t.text, fontWeight: s.id === p.home_store_id ? "700" : "400" }}>
                  {s.id === p.home_store_id ? "✓ " : ""}{s.name}{s.city ? ` · ${s.city}` : ""}
                </Text>
              </Pressable>
            ))}
            <View style={{ marginTop: 12 }}>
              <Text style={{ color: t.text }}>Match radius: {p.search_radius_miles} miles</Text>
              <Slider minimumValue={5} maximumValue={100} step={5} value={p.search_radius_miles ?? 25} onSlidingComplete={(v) => set("search_radius_miles", v)} minimumTrackTintColor={t.accent} />
            </View>
          </Section>
        ) : null}

        {online ? (
          <Section title="Where you play online" hint="Handles are only shown to people you match with.">
            {PLATFORMS.map((pl) => {
              const on = pl.value in handles;
              return (
                <View key={pl.value} style={{ marginBottom: 6 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <Text style={{ color: t.text }}>{pl.label}</Text>
                    <Switch
                      value={on}
                      onValueChange={(v) => setHandles((prev) => {
                        const next = { ...prev };
                        if (v) next[pl.value] = "";
                        else delete next[pl.value];
                        return next;
                      })}
                    />
                  </View>
                  {on ? (
                    <Field placeholder={pl.handleHint} value={handles[pl.value] ?? ""} autoCapitalize="none" onChangeText={(v) => setHandles((prev) => ({ ...prev, [pl.value]: v }))} />
                  ) : null}
                </View>
              );
            })}
          </Section>
        ) : null}

        <Section title="When are you free?" hint={`In your time zone (${deviceTimezone()}). Others see it converted to theirs.`}>
          {WEEKDAYS.map((day, d) => (
            <View key={day} style={{ flexDirection: "row", alignItems: "center", marginBottom: 6, gap: 6 }}>
              <Text style={{ color: t.text, width: 36 }}>{day}</Text>
              <ChipRow>
                {BLOCKS.map((b) => <Chip key={b.label} label={b.label} selected={hasBlock(d, b)} onPress={() => toggleBlock(d, b)} />)}
              </ChipRow>
            </View>
          ))}
        </Section>

        <Section title="Decklists" hint="Moxfield or Archidekt links.">
          {decks.map((d, i) => (
            <View key={i} style={{ flexDirection: "row", gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Field placeholder="Deck name" value={d.label ?? ""} onChangeText={(v) => setDecks(decks.map((x, j) => (j === i ? { ...x, label: v } : x)))} />
              </View>
              <View style={{ flex: 2 }}>
                <Field placeholder="https://moxfield.com/decks/..." autoCapitalize="none" keyboardType="url" value={d.url} onChangeText={(v) => setDecks(decks.map((x, j) => (j === i ? { ...x, url: v } : x)))} />
              </View>
            </View>
          ))}
          {decks.length < 10 ? <Button title="Add deck link" variant="secondary" onPress={() => setDecks([...decks, { label: "", url: "" }])} /> : null}
        </Section>

        <Button title={profile?.onboarded ? "Save profile" : "Start matching"} onPress={save} loading={saving} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
