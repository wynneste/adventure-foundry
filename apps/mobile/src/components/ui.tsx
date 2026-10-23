import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";
import { useTheme } from "@/lib/theme";

export function Button({
  title, onPress, variant = "primary", disabled, loading,
}: {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "danger";
  disabled?: boolean;
  loading?: boolean;
}) {
  const t = useTheme();
  const bg = variant === "primary" ? t.accent : variant === "danger" ? t.danger : t.chip;
  const fg = variant === "primary" ? t.accentText : variant === "danger" ? "#fff" : t.text;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [styles.button, { backgroundColor: bg, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 }]}
    >
      {loading ? <ActivityIndicator color={fg} /> : <Text style={[styles.buttonText, { color: fg }]}>{title}</Text>}
    </Pressable>
  );
}

export function Chip({ label, selected, onPress, color }: { label: string; selected?: boolean; onPress?: () => void; color?: string }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole={onPress ? "checkbox" : "text"}
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={[
        styles.chip,
        { backgroundColor: selected ? (color ?? t.accent) : t.chip, borderColor: selected ? (color ?? t.accent) : t.border },
      ]}
    >
      <Text style={{ color: selected ? (color ? "#fff" : t.accentText) : t.text, fontWeight: "600", fontSize: 13 }}>
        {label}
      </Text>
    </Pressable>
  );
}

export function ChipRow({ children }: { children: ReactNode }) {
  return <View style={styles.chipRow}>{children}</View>;
}

export function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  const t = useTheme();
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: t.text }]}>{title}</Text>
      {hint ? <Text style={{ color: t.muted, marginBottom: 8, fontSize: 13 }}>{hint}</Text> : null}
      {children}
    </View>
  );
}

export function Field(props: TextInputProps & { label?: string }) {
  const t = useTheme();
  const { label, style, ...rest } = props;
  return (
    <View style={{ marginBottom: 10 }}>
      {label ? <Text style={{ color: t.muted, marginBottom: 4, fontSize: 13 }}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={t.muted}
        style={[styles.input, { color: t.text, backgroundColor: t.card, borderColor: t.border }, style]}
        {...rest}
      />
    </View>
  );
}

export function Muted({ children }: { children: ReactNode }) {
  const t = useTheme();
  return <Text style={{ color: t.muted, fontSize: 13 }}>{children}</Text>;
}

export function Screen({ children }: { children: ReactNode }) {
  const t = useTheme();
  return <View style={{ flex: 1, backgroundColor: t.bg }}>{children}</View>;
}

const styles = StyleSheet.create({
  button: { paddingVertical: 14, paddingHorizontal: 18, borderRadius: 14, alignItems: "center", marginVertical: 4 },
  buttonText: { fontWeight: "700", fontSize: 16 },
  chip: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 17, fontWeight: "700", marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 },
});
