import { supabase } from "./supabase";
import type { Availability, Candidate, DeckLink, MatchIntent, MtgFormat, Profile } from "./types";

type DiscoverRow = { profile_id: string; location_label: string; distance_miles: number | null; shared_formats: MtgFormat[] };

/** Fills in formats, availability and deck links for a list of profile ids. */
async function hydrate(ids: string[]) {
  const [profiles, formats, availability, decks] = await Promise.all([
    supabase.from("profiles").select("*").in("id", ids),
    supabase.from("profile_formats").select("profile_id, format, rank").in("profile_id", ids).order("rank"),
    supabase.from("availability").select("*").in("profile_id", ids).order("weekday"),
    supabase.from("deck_links").select("*").in("profile_id", ids),
  ]);
  return {
    profiles: new Map(((profiles.data ?? []) as Profile[]).map((p) => [p.id, p])),
    formatsFor: (id: string) => (formats.data ?? []).filter((f) => f.profile_id === id).map((f) => f.format as MtgFormat),
    availabilityFor: (id: string) => (availability.data ?? []).filter((a) => a.profile_id === id) as Availability[],
    decksFor: (id: string) => (decks.data ?? []).filter((d) => d.profile_id === id) as DeckLink[],
  };
}

export async function loadCandidates(intent: MatchIntent): Promise<Candidate[]> {
  const { data, error } = await supabase.rpc("discover", { p_intent: intent, p_limit: 20 });
  if (error) throw error;
  const rows = (data ?? []) as DiscoverRow[];
  if (!rows.length) return [];
  const h = await hydrate(rows.map((r) => r.profile_id));
  return rows.flatMap((r) => {
    const p = h.profiles.get(r.profile_id);
    if (!p) return [];
    return [{
      ...p,
      location_label: r.location_label,
      distance_miles: r.distance_miles,
      shared_formats: r.shared_formats,
      formats: h.formatsFor(p.id),
      availability: h.availabilityFor(p.id),
      deck_links: h.decksFor(p.id),
    }];
  });
}

/** Full profile for someone you're chatting with. */
export async function loadPerson(id: string): Promise<Candidate | null> {
  const h = await hydrate([id]);
  const p = h.profiles.get(id);
  if (!p) return null;
  const { data: store } = p.home_store_id
    ? await supabase.from("stores").select("name").eq("id", p.home_store_id).maybeSingle()
    : { data: null };
  return {
    ...p,
    location_label: store?.name ?? (p.play_mode === "online" ? "Online" : ""),
    distance_miles: null,
    shared_formats: [],
    formats: h.formatsFor(id),
    availability: h.availabilityFor(id),
    deck_links: h.decksFor(id),
  };
}

export async function swipe(swipeeId: string, intent: MatchIntent, direction: "like" | "pass") {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { matched: false };
  const { error } = await supabase.from("swipes").insert({ swiper_id: user.id, swipee_id: swipeeId, intent, direction });
  if (error) throw error;
  if (direction === "pass") return { matched: false };
  const [a, b] = [user.id, swipeeId].sort();
  const { data } = await supabase.from("matches").select("id").eq("user_a", a).eq("user_b", b).eq("intent", intent).maybeSingle();
  return { matched: !!data };
}
