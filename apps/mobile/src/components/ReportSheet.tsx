import { useState } from "react";
import { Alert, Modal, ScrollView, Text, View } from "react-native";
import { REPORT_REASONS } from "@/lib/constants";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/lib/theme";
import { Button, Chip, ChipRow, Field } from "./ui";

/** Report and/or block someone. Blocking also ends any chats with them. */
export function ReportSheet({
  visible, onClose, reportedId, conversationId, onBlocked,
}: {
  visible: boolean;
  onClose: () => void;
  reportedId: string;
  conversationId?: string;
  onBlocked?: () => void;
}) {
  const t = useTheme();
  const [reason, setReason] = useState<string | null>(null);
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(alsoBlock: boolean, withReason: string | null = reason) {
    setBusy(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    if (withReason) {
      const { error } = await supabase.from("reports").insert({
        reporter_id: user.id, reported_id: reportedId, conversation_id: conversationId ?? null, reason: withReason, details: details || null,
      });
      if (error) Alert.alert("Couldn't send report", error.message);
    }
    if (alsoBlock) {
      await supabase.from("blocks").insert({ blocker_id: user.id, blocked_id: reportedId });
      onBlocked?.();
    }
    setBusy(false);
    setReason(null);
    setDetails("");
    onClose();
    Alert.alert(alsoBlock ? "Blocked" : "Thanks", alsoBlock ? "You won't see each other anymore." : "Our team will review this.");
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <ScrollView style={{ flex: 1, backgroundColor: t.bg }} contentContainerStyle={{ padding: 20, gap: 12 }}>
        <Text style={{ color: t.text, fontSize: 22, fontWeight: "800" }}>Report or block</Text>
        <Text style={{ color: t.muted }}>Reports are private. They won't know it was you.</Text>
        <ChipRow>
          {REPORT_REASONS.map((r) => (
            <Chip key={r.value} label={r.label} selected={reason === r.value} onPress={() => setReason(r.value)} />
          ))}
        </ChipRow>
        <Field label="Anything else? (optional)" value={details} onChangeText={setDetails} multiline style={{ minHeight: 90 }} />
        <View style={{ gap: 4 }}>
          <Button title="Report & block" variant="danger" onPress={() => submit(true)} loading={busy} />
          <Button title="Report only" variant="secondary" onPress={() => submit(false)} disabled={!reason || busy} />
          <Button title="Block without reporting" variant="secondary" onPress={() => submit(true, null)} disabled={busy} />
          <Button title="Cancel" variant="secondary" onPress={onClose} />
        </View>
      </ScrollView>
    </Modal>
  );
}
