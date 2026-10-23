import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, Dimensions, Modal, PanResponder, Pressable, Text, View } from "react-native";
import { ProfileCard, displayName } from "@/components/ProfileCard";
import { Button, Chip, ChipRow } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { loadCandidates, swipe } from "@/lib/data";
import { useTheme } from "@/lib/theme";
import type { Candidate, MatchIntent } from "@/lib/types";

const SWIPE_DISTANCE = Dimensions.get("window").width * 0.3;

export default function Discover() {
  const t = useTheme();
  const { profile } = useAuth();
  const intents = profile?.intents?.length ? profile.intents : (["play"] as MatchIntent[]);
  const [intent, setIntent] = useState<MatchIntent>(intents[0]);
  const [deck, setDeck] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [matchedWith, setMatchedWith] = useState<Candidate | null>(null);
  const position = useRef(new Animated.ValueXY()).current;

  const refill = useCallback(async () => {
    setLoading(true);
    try {
      setDeck(await loadCandidates(intent));
    } finally {
      setLoading(false);
    }
  }, [intent]);

  useEffect(() => {
    refill();
  }, [refill]);

  const decide = useCallback(async (direction: "like" | "pass") => {
    const current = deck[0];
    if (!current) return;
    Animated.timing(position, {
      toValue: { x: (direction === "like" ? 1.5 : -1.5) * Dimensions.get("window").width, y: 0 },
      duration: 220,
      // JS driver throughout: the drag uses it, and one value can't mix drivers.
      useNativeDriver: false,
    }).start(() => {
      position.setValue({ x: 0, y: 0 });
      setDeck((d) => d.slice(1));
    });
    const { matched } = await swipe(current.id, intent, direction);
    if (matched) setMatchedWith(current);
    if (deck.length <= 3) loadCandidates(intent).then((more) =>
      setDeck((d) => [...d, ...more.filter((m) => !d.some((x) => x.id === m.id) && m.id !== current.id)]));
  }, [deck, intent, position]);

  // Horizontal drags swipe; vertical drags scroll the profile.
  const pan = PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
    onPanResponderMove: Animated.event([null, { dx: position.x }], { useNativeDriver: false }),
    onPanResponderRelease: (_, g) => {
      if (g.dx > SWIPE_DISTANCE) decide("like");
      else if (g.dx < -SWIPE_DISTANCE) decide("pass");
      else Animated.spring(position, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start();
    },
  });

  const rotate = position.x.interpolate({ inputRange: [-300, 0, 300], outputRange: ["-8deg", "0deg", "8deg"] });
  const current = deck[0];

  return (
    <View style={{ flex: 1, padding: 12, backgroundColor: t.bg }}>
      {intents.length > 1 ? (
        <View style={{ marginBottom: 10 }}>
          <ChipRow>
            <Chip label="Play" selected={intent === "play"} onPress={() => setIntent("play")} />
            <Chip label="Trade" selected={intent === "trade"} onPress={() => setIntent("trade")} />
          </ChipRow>
        </View>
      ) : null}

      {loading && !current ? (
        <ActivityIndicator style={{ flex: 1 }} color={t.accent} />
      ) : current ? (
        <>
          <Animated.View
            key={current.id}
            {...pan.panHandlers}
            style={{ flex: 1, transform: [{ translateX: position.x }, { rotate }] }}
          >
            <ProfileCard person={current} />
          </Animated.View>
          <View style={{ flexDirection: "row", justifyContent: "center", gap: 40, paddingVertical: 12 }}>
            <RoundButton glyph="✕" color={t.pass} label="Pass" onPress={() => decide("pass")} />
            <RoundButton glyph="♥" color={t.like} label="Like" onPress={() => decide("like")} />
          </View>
        </>
      ) : (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 12 }}>
          <Text style={{ color: t.text, fontSize: 20, fontWeight: "700", textAlign: "center" }}>You've seen everyone nearby</Text>
          <Text style={{ color: t.muted, textAlign: "center" }}>
            Try widening your radius, turning on online play, or check the Events tab for what's happening at local stores.
          </Text>
          <Button title="Check again" variant="secondary" onPress={refill} />
        </View>
      )}

      <Modal visible={!!matchedWith} transparent animationType="fade" onRequestClose={() => setMatchedWith(null)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.75)", justifyContent: "center", padding: 32, gap: 12 }}>
          <Text style={{ color: "#fff", fontSize: 34, fontWeight: "900", textAlign: "center" }}>It's a match!</Text>
          <Text style={{ color: "#fff", textAlign: "center", fontSize: 16 }}>
            You and {matchedWith ? displayName(matchedWith) : ""} both want to {intent === "trade" ? "trade" : "play"}.
          </Text>
          <Button title="Say hi" onPress={() => { setMatchedWith(null); router.push("/matches"); }} />
          <Button title="Keep swiping" variant="secondary" onPress={() => setMatchedWith(null)} />
        </View>
      </Modal>
    </View>
  );
}

function RoundButton({ glyph, color, label, onPress }: { glyph: string; color: string; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        width: 64, height: 64, borderRadius: 32, backgroundColor: color, alignItems: "center", justifyContent: "center",
        transform: [{ scale: pressed ? 0.92 : 1 }],
      })}
    >
      <Text style={{ color: "#fff", fontSize: 28, fontWeight: "800" }}>{glyph}</Text>
    </Pressable>
  );
}
