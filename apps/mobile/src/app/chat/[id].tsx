import * as Clipboard from "expo-clipboard";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, FlatList, KeyboardAvoidingView, Linking, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { displayName } from "@/components/ProfileCard";
import { ReportSheet } from "@/components/ReportSheet";
import { Button, Chip, ChipRow, Field, Muted } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { addToCalendar } from "@/lib/calendar";
import { COMMUNITY_DISCORD_URL, PLATFORMS, labelFor } from "@/lib/constants";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/lib/theme";
import { localTimeIn, relativeToMe } from "@/lib/time";
import type { Message, OnlinePlatform, Profile, Screening } from "@/lib/types";

type Member = Pick<Profile, "id" | "display_name" | "handle" | "use_handle_as_name" | "timezone">;

// Links in chat are fine; images are not. Strip anything that looks like an image URL.
const IMAGE_URL = /https?:\/\/\S+\.(png|jpe?g|gif|webp|heic)(\?\S*)?/gi;

export default function Chat() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTheme();
  const { session } = useAuth();
  const me = session!.user.id;

  const [kind, setKind] = useState<"match" | "group">("match");
  const [title, setTitle] = useState<string | null>(null);
  const [closed, setClosed] = useState(false);
  const [screening, setScreening] = useState<Screening>("pending");
  const [members, setMembers] = useState<Member[]>([]);
  const [handles, setHandles] = useState<{ platform: OnlinePlatform; handle: string | null; profile_id: string }[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [reporting, setReporting] = useState<string | null>(null);
  const [scheduling, setScheduling] = useState(false);
  const listRef = useRef<FlatList<Message>>(null);

  const load = useCallback(async () => {
    const [{ data: conv }, { data: mem }, { data: msgs }] = await Promise.all([
      supabase.from("conversations").select("kind, title, closed_at").eq("id", id).maybeSingle(),
      supabase.from("conversation_members").select("profile_id, screening").eq("conversation_id", id),
      supabase.from("messages").select("*").eq("conversation_id", id).order("created_at"),
    ]);
    if (!conv) {
      Alert.alert("This chat is no longer available");
      router.back();
      return;
    }
    setKind(conv.kind);
    setTitle(conv.title);
    setClosed(!!conv.closed_at);
    setScreening((mem ?? []).find((m) => m.profile_id === me)?.screening ?? "keep");
    setMessages(msgs ?? []);
    const otherIds = (mem ?? []).map((m) => m.profile_id).filter((x) => x !== me);
    const [{ data: people }, { data: plats }] = await Promise.all([
      supabase.from("profiles").select("id, display_name, handle, use_handle_as_name, timezone").in("id", otherIds),
      supabase.from("profile_platforms").select("profile_id, platform, handle").in("profile_id", otherIds),
    ]);
    setMembers((people ?? []) as Member[]);
    setHandles(plats ?? []);
  }, [id, me]);

  useEffect(() => {
    load();
    // Live updates while the chat is open.
    const channel = supabase
      .channel(`chat:${id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${id}` },
        (payload) => setMessages((prev) => (prev.some((m) => m.id === payload.new.id) ? prev : [...prev, payload.new as Message])))
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, load]);

  async function send() {
    const body = draft.replace(IMAGE_URL, "[image removed]").trim();
    if (!body) return;
    setDraft("");
    const { data, error } = await supabase.from("messages").insert({ conversation_id: id, sender_id: me, body }).select().single();
    if (error) {
      setDraft(body);
      Alert.alert("Couldn't send", closed ? "This chat has ended." : error.message);
    } else {
      setMessages((prev) => (prev.some((m) => m.id === data.id) ? prev : [...prev, data as Message]));
    }
  }

  async function decide(choice: "keep" | "left") {
    await supabase.from("conversation_members").update({ screening: choice }).eq("conversation_id", id).eq("profile_id", me);
    if (choice === "left") router.back();
    else setScreening("keep");
  }

  const other = members[0];
  const headerTitle = kind === "group" ? title ?? "Group chat" : other ? displayName(other) : "Chat";
  // The easy out appears once there's a message from the other person.
  const showScreening = kind === "match" && screening === "pending" && !closed && messages.some((m) => m.sender_id !== me);
  const discord = handles.filter((h) => h.platform === "discord" && h.handle);

  return (
    <SafeAreaView edges={["bottom"]} style={{ flex: 1, backgroundColor: t.bg }}>
      <Stack.Screen
        options={{
          title: headerTitle,
          headerRight: () => (
            <View style={{ flexDirection: "row", gap: 16 }}>
              <Pressable onPress={() => setScheduling(true)} accessibilityLabel="Schedule a game"><Text style={{ fontSize: 20 }}>📅</Text></Pressable>
              {kind === "match" && other ? (
                <Pressable onPress={() => setReporting(other.id)} accessibilityLabel="Report or block"><Text style={{ fontSize: 20 }}>⚑</Text></Pressable>
              ) : null}
            </View>
          ),
        }}
      />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={90}>
        {kind === "match" && other ? (
          <Pressable onPress={() => router.push({ pathname: "/profile/[id]", params: { id: other.id } })} style={{ padding: 10, borderBottomWidth: 1, borderColor: t.border }}>
            <Muted>
              🕒 Their time: {localTimeIn(other.timezone)} ({relativeToMe(other.timezone)}) · View profile ›
            </Muted>
          </Pressable>
        ) : null}

        <View style={{ flexDirection: "row", gap: 8, padding: 10, flexWrap: "wrap" }}>
          {discord.map((d) => (
            <Chip key={d.profile_id} label={`Discord: ${d.handle}`} onPress={async () => {
              await Clipboard.setStringAsync(d.handle!);
              Alert.alert("Copied", `${d.handle} copied. Add them as a friend in Discord.`);
            }} />
          ))}
          {handles.filter((h) => h.platform !== "discord" && h.handle).map((h) => (
            <Chip key={h.profile_id + h.platform} label={`${labelFor(PLATFORMS, h.platform)}: ${h.handle}`} />
          ))}
          {COMMUNITY_DISCORD_URL ? <Chip label="Join our Discord" onPress={() => Linking.openURL(COMMUNITY_DISCORD_URL)} /> : null}
        </View>

        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: 12, gap: 6 }}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          ListHeaderComponent={
            <Text style={{ color: t.muted, textAlign: "center", marginBottom: 8, fontSize: 12 }}>
              Text only, no photos in chat. Meeting up? First games are best at your LGS. 🏪
            </Text>
          }
          renderItem={({ item }) => {
            const mine = item.sender_id === me;
            const sender = members.find((m) => m.id === item.sender_id);
            return (
              <View style={{ alignSelf: mine ? "flex-end" : "flex-start", maxWidth: "80%" }}>
                {kind === "group" && !mine && sender ? <Muted>{displayName(sender)}</Muted> : null}
                <View style={{ backgroundColor: mine ? t.accent : t.card, padding: 10, borderRadius: 14 }}>
                  <Text style={{ color: mine ? t.accentText : t.text, fontSize: 15 }}>{item.body}</Text>
                </View>
              </View>
            );
          }}
        />

        {showScreening ? (
          <View style={{ padding: 12, borderTopWidth: 1, borderColor: t.border, backgroundColor: t.card, gap: 6 }}>
            <Text style={{ color: t.text, fontWeight: "700" }}>First impression check</Text>
            <Muted>Not feeling it? Leave quietly. They'll just see the chat ended, never why.</Muted>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <View style={{ flex: 1 }}><Button title="Keep chatting" onPress={() => decide("keep")} /></View>
              <View style={{ flex: 1 }}><Button title="Easy out" variant="secondary" onPress={() => decide("left")} /></View>
            </View>
          </View>
        ) : null}

        {closed ? (
          <Text style={{ color: t.muted, textAlign: "center", padding: 16 }}>This chat has ended.</Text>
        ) : (
          <View style={{ flexDirection: "row", padding: 10, gap: 8, borderTopWidth: 1, borderColor: t.border }}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Message"
              placeholderTextColor={t.muted}
              multiline
              maxLength={2000}
              style={{ flex: 1, color: t.text, backgroundColor: t.card, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8, maxHeight: 120 }}
            />
            <Button title="Send" onPress={send} disabled={!draft.trim()} />
          </View>
        )}
      </KeyboardAvoidingView>

      {reporting ? (
        <ReportSheet visible onClose={() => setReporting(null)} reportedId={reporting} conversationId={id} onBlocked={() => router.back()} />
      ) : null}
      <ScheduleSheet
        visible={scheduling}
        onClose={() => setScheduling(false)}
        withNames={members.map(displayName).join(", ")}
        onScheduled={async (summary) => {
          await supabase.from("messages").insert({ conversation_id: id, sender_id: me, body: `📅 ${summary}` });
        }}
      />
    </SafeAreaView>
  );
}

/** Pick a day, time and place, then hand off to the phone's calendar. */
function ScheduleSheet({
  visible, onClose, withNames, onScheduled,
}: {
  visible: boolean;
  onClose: () => void;
  withNames: string;
  onScheduled: (summary: string) => Promise<void>;
}) {
  const t = useTheme();
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + i);
    return d;
  });
  const hours = [10, 12, 14, 16, 17, 18, 19, 20, 21];
  const [day, setDay] = useState(0);
  const [hour, setHour] = useState(19);
  const [where, setWhere] = useState("");

  async function confirm() {
    const start = new Date(days[day]);
    start.setHours(hour);
    const place = where.trim() || "TBD";
    const summary = `Game scheduled: ${start.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} at ${start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZoneName: "short" })} · ${place}`;
    await addToCalendar({ title: `Magic with ${withNames}`, start, location: place, notes: "Scheduled on Adventure Foundry" });
    await onScheduled(summary);
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <ScrollView style={{ backgroundColor: t.bg }} contentContainerStyle={{ padding: 20, gap: 16 }}>
        <Text style={{ color: t.text, fontSize: 22, fontWeight: "800" }}>Schedule a game</Text>
        <ChipRow>
          {days.map((d, i) => (
            <Chip key={i} label={i === 0 ? "Today" : d.toLocaleDateString("en-US", { weekday: "short", month: "numeric", day: "numeric" })} selected={day === i} onPress={() => setDay(i)} />
          ))}
        </ChipRow>
        <ChipRow>
          {hours.map((h) => (
            <Chip key={h} label={new Date(2000, 0, 1, h).toLocaleTimeString("en-US", { hour: "numeric" })} selected={hour === h} onPress={() => setHour(h)} />
          ))}
        </ChipRow>
        <Field label="Where? (store name, SpellTable, Discord...)" value={where} onChangeText={setWhere} />
        <Muted>Your phone's calendar will open so you can save it to Apple or Google Calendar.</Muted>
        <Button title="Add to calendar & share" onPress={confirm} />
        <Button title="Cancel" variant="secondary" onPress={onClose} />
      </ScrollView>
    </Modal>
  );
}
