import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, View } from "react-native";
import { ProfileCard } from "@/components/ProfileCard";
import { ReportSheet } from "@/components/ReportSheet";
import { Button } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { loadPerson } from "@/lib/data";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/lib/theme";
import type { Candidate } from "@/lib/types";

export default function PersonProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTheme();
  const { session } = useAuth();
  const [person, setPerson] = useState<Candidate | null>(null);
  const [reporting, setReporting] = useState(false);

  useEffect(() => {
    loadPerson(id).then(setPerson);
  }, [id]);

  // Private "would you play again?" Only the moderation team ever sees it.
  async function review(wouldPlayAgain: boolean) {
    const { error } = await supabase.from("reviews").upsert(
      { reviewer_id: session!.user.id, reviewee_id: id, would_play_again: wouldPlayAgain },
      { onConflict: "reviewer_id,reviewee_id" },
    );
    Alert.alert(error ? "Couldn't save" : "Thanks!", error ? error.message : "This stays private. It helps keep the community friendly.");
  }

  if (!person) return <ActivityIndicator style={{ flex: 1, backgroundColor: t.bg }} color={t.accent} />;

  return (
    <View style={{ flex: 1, padding: 12, backgroundColor: t.bg, gap: 8 }}>
      <ProfileCard person={person} />
      <View style={{ flexDirection: "row", gap: 8 }}>
        <View style={{ flex: 1 }}><Button title="👍 Would play again" variant="secondary" onPress={() => review(true)} /></View>
        <View style={{ flex: 1 }}><Button title="👎 Wouldn't" variant="secondary" onPress={() => review(false)} /></View>
      </View>
      <Button title="Report or block" variant="secondary" onPress={() => setReporting(true)} />
      <ReportSheet visible={reporting} onClose={() => setReporting(false)} reportedId={id} onBlocked={() => router.dismissAll()} />
    </View>
  );
}
