import { Image } from "expo-image";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { displayName } from "@/components/ProfileCard";
import { Button } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { photoUrl, supabase } from "@/lib/supabase";
import { useTheme } from "@/lib/theme";
import type { Profile, Screening } from "@/lib/types";

type Person = Pick<Profile, "id" | "display_name" | "handle" | "use_handle_as_name" | "photo_person">;
type Row = {
  id: string;
  kind: "match" | "group";
  title: string | null;
  closed: boolean;
  myScreening: Screening;
  others: Person[];
  lastMessage: string | null;
  lastAt: string | null;
};

export default function Matches() {
  const t = useTheme();
  const { session } = useAuth();
  const me = session!.user.id;
  const [rows, setRows] = useState<Row[]>([]);
  const [pods, setPods] = useState<Person[][]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    const { data: mine } = await supabase
      .from("conversation_members")
      .select("conversation_id, screening, conversations(id, kind, title, closed_at, created_at)")
      .eq("profile_id", me)
      .neq("screening", "left");
    const convIds = (mine ?? []).map((m) => m.conversation_id);

    const [{ data: members }, { data: lastMessages }, { data: suggested }] = await Promise.all([
      supabase.from("conversation_members").select("conversation_id, profile_id").in("conversation_id", convIds),
      supabase.from("messages").select("conversation_id, body, created_at").in("conversation_id", convIds)
        .order("created_at", { ascending: false }).limit(200),
      supabase.rpc("suggest_pods"),
    ]);
    const suggestionPairs = (suggested ?? []) as { member_1: string; member_2: string }[];
    const peopleIds = [...new Set([
      ...(members ?? []).map((m) => m.profile_id),
      ...suggestionPairs.flatMap((s) => [s.member_1, s.member_2]),
    ])].filter((id) => id !== me);
    const { data: people } = await supabase
      .from("profiles").select("id, display_name, handle, use_handle_as_name, photo_person").in("id", peopleIds);
    const byId = new Map((people ?? []).map((p) => [p.id, p as Person]));

    const next: Row[] = (mine ?? []).flatMap((m) => {
      const c = m.conversations as unknown as { id: string; kind: "match" | "group"; title: string | null; closed_at: string | null; created_at: string } | null;
      if (!c) return [];
      const last = (lastMessages ?? []).find((x) => x.conversation_id === c.id);
      return [{
        id: c.id,
        kind: c.kind,
        title: c.title,
        closed: !!c.closed_at,
        myScreening: m.screening as Screening,
        others: (members ?? []).filter((x) => x.conversation_id === c.id && x.profile_id !== me)
          .map((x) => byId.get(x.profile_id)).filter((x): x is Person => !!x),
        lastMessage: last?.body ?? null,
        lastAt: last?.created_at ?? c.created_at,
      }];
    }).sort((a, b) => (b.lastAt ?? "").localeCompare(a.lastAt ?? ""));

    setRows(next);
    setPods(suggestionPairs.map((s) => [byId.get(s.member_1), byId.get(s.member_2)].filter((x): x is Person => !!x)));
    setRefreshing(false);
  }, [me]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function startPod(people: Person[]) {
    const { data, error } = await supabase.rpc("create_group_chat", {
      member_ids: people.map((p) => p.id),
      chat_title: "Commander pod",
    });
    if (error) Alert.alert("Couldn't start the pod", error.message);
    else router.push({ pathname: "/chat/[id]", params: { id: data as string } });
  }

  return (
    <FlatList
      style={{ backgroundColor: t.bg }}
      contentContainerStyle={{ padding: 12, gap: 8 }}
      data={rows}
      keyExtractor={(r) => r.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
      ListHeaderComponent={pods.length ? (
        <View style={{ backgroundColor: t.card, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: t.border, marginBottom: 8 }}>
          <Text style={{ color: t.text, fontWeight: "800", fontSize: 16 }}>Pod ready? 🎲</Text>
          {pods.slice(0, 3).map((pair) => (
            <View key={pair.map((p) => p.id).join()} style={{ marginTop: 8 }}>
              <Text style={{ color: t.muted, marginBottom: 4 }}>
                You, {pair.map(displayName).join(" and ")} all matched each other.
              </Text>
              <Button title="Start a group chat" variant="secondary" onPress={() => startPod(pair)} />
            </View>
          ))}
        </View>
      ) : undefined}
      ListEmptyComponent={
        <Text style={{ color: t.muted, textAlign: "center", marginTop: 60 }}>No matches yet. Go swipe on some planeswalkers!</Text>
      }
      renderItem={({ item }) => {
        const first = item.others[0];
        const name = item.kind === "group" ? item.title ?? item.others.map(displayName).join(", ") : first ? displayName(first) : "Player";
        const needsDecision = item.kind === "match" && item.myScreening === "pending" && !!item.lastMessage;
        return (
          <Pressable
            onPress={() => router.push({ pathname: "/chat/[id]", params: { id: item.id } })}
            style={{ flexDirection: "row", gap: 12, alignItems: "center", padding: 10, borderRadius: 14, backgroundColor: t.card }}
          >
            <Image source={photoUrl(first?.photo_person)} style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: t.chip }} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.text, fontWeight: "700" }}>{name}</Text>
              <Text style={{ color: t.muted }} numberOfLines={1}>
                {item.closed ? "This chat has ended" : item.lastMessage ?? "New match. Say hi!"}
              </Text>
            </View>
            {needsDecision ? <Text style={{ color: t.accent, fontWeight: "700" }}>Review</Text> : null}
          </Pressable>
        );
      }}
    />
  );
}
