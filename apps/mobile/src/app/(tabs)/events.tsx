import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, Linking, RefreshControl, Text, View } from "react-native";
import { Chip, ChipRow, Muted } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { addToCalendar } from "@/lib/calendar";
import { FORMATS, labelFor } from "@/lib/constants";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/lib/theme";
import type { EventRow, RsvpStatus } from "@/lib/types";

type Counts = Record<string, { interested: number; going: number }>;

export default function Events() {
  const t = useTheme();
  const { session, profile } = useAuth();
  const me = session!.user.id;
  const [events, setEvents] = useState<EventRow[]>([]);
  const [counts, setCounts] = useState<Counts>({});
  const [mine, setMine] = useState<Record<string, RsvpStatus>>({});
  const [filter, setFilter] = useState<"all" | "home" | "online">("all");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    let q = supabase
      .from("events")
      .select("id, title, description, format, is_online, online_link, entry_fee_cents, starts_at, ends_at, store:stores(id, name, address)")
      .gte("starts_at", new Date(Date.now() - 3 * 3600_000).toISOString())
      .order("starts_at")
      .limit(100);
    if (filter === "home" && profile?.home_store_id) q = q.eq("store_id", profile.home_store_id);
    if (filter === "online") q = q.eq("is_online", true);
    const { data } = await q;
    const rows = (data ?? []) as unknown as EventRow[];
    setEvents(rows);
    const ids = rows.map((e) => e.id);
    const [{ data: c }, { data: r }] = await Promise.all([
      supabase.from("event_counts").select("*").in("event_id", ids),
      supabase.from("event_rsvps").select("event_id, status").eq("profile_id", me).in("event_id", ids),
    ]);
    setCounts(Object.fromEntries((c ?? []).map((x) => [x.event_id, { interested: x.interested, going: x.going }])));
    setMine(Object.fromEntries((r ?? []).map((x) => [x.event_id, x.status])));
    setRefreshing(false);
  }, [filter, me, profile?.home_store_id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function rsvp(e: EventRow, status: RsvpStatus) {
    const current = mine[e.id];
    if (current === status) {
      await supabase.from("event_rsvps").delete().eq("event_id", e.id).eq("profile_id", me);
    } else {
      await supabase.from("event_rsvps").upsert({ event_id: e.id, profile_id: me, status });
      if (status === "going") {
        addToCalendar({
          title: e.title,
          start: new Date(e.starts_at),
          end: e.ends_at ? new Date(e.ends_at) : undefined,
          location: e.store ? `${e.store.name}${e.store.address ? ", " + e.store.address : ""}` : e.online_link ?? "Online",
          notes: e.description ?? undefined,
        });
      }
    }
    load();
  }

  return (
    <FlatList
      style={{ backgroundColor: t.bg }}
      contentContainerStyle={{ padding: 12, gap: 10 }}
      data={events}
      keyExtractor={(e) => e.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
      ListHeaderComponent={
        <ChipRow>
          <Chip label="All" selected={filter === "all"} onPress={() => setFilter("all")} />
          {profile?.home_store_id ? <Chip label="My LGS" selected={filter === "home"} onPress={() => setFilter("home")} /> : null}
          <Chip label="Online" selected={filter === "online"} onPress={() => setFilter("online")} />
        </ChipRow>
      }
      ListEmptyComponent={<Text style={{ color: t.muted, textAlign: "center", marginTop: 40 }}>No upcoming events yet.</Text>}
      renderItem={({ item: e }) => {
        const start = new Date(e.starts_at);
        const c = counts[e.id] ?? { interested: 0, going: 0 };
        return (
          <View style={{ backgroundColor: t.card, borderRadius: 16, padding: 14, gap: 6, borderWidth: 1, borderColor: t.border }}>
            <Text style={{ color: t.accent, fontWeight: "700" }}>
              {start.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} ·{" "}
              {start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
            </Text>
            <Text style={{ color: t.text, fontSize: 17, fontWeight: "800" }}>{e.title}</Text>
            <Muted>
              {[e.store?.name ?? (e.is_online ? "Online" : null), e.format ? labelFor(FORMATS, e.format) : null,
                e.entry_fee_cents ? `$${(e.entry_fee_cents / 100).toFixed(2)}` : e.entry_fee_cents === 0 ? "Free" : null]
                .filter(Boolean).join(" · ")}
            </Muted>
            {e.description ? <Text style={{ color: t.text }} numberOfLines={3}>{e.description}</Text> : null}
            {e.online_link ? <Text style={{ color: t.accent }} onPress={() => Linking.openURL(e.online_link!)}>Join link</Text> : null}
            <Muted>{c.going} going · {c.interested} interested</Muted>
            <ChipRow>
              <Chip label="★ Interested" selected={mine[e.id] === "interested"} onPress={() => rsvp(e, "interested")} />
              <Chip label="✓ Going" selected={mine[e.id] === "going"} onPress={() => rsvp(e, "going")} />
            </ChipRow>
          </View>
        );
      }}
    />
  );
}
