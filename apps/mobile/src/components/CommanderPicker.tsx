import { Image } from "expo-image";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { searchCommanders, type CommanderCard } from "@/lib/scryfall";
import { useTheme } from "@/lib/theme";
import { Field, Muted } from "./ui";

export function CommanderPicker({
  value, onChange,
}: {
  value: { name: string | null; image: string | null };
  onChange: (card: CommanderCard) => void;
}) {
  const t = useTheme();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CommanderCard[]>([]);
  const [loading, setLoading] = useState(false);

  // Debounce typing so we stay well under Scryfall's rate limit.
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        setResults(await searchCommanders(query, controller.signal));
      } catch {
        // aborted or offline — keep previous results
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  return (
    <View>
      {value.name ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 10 }}>
          {value.image ? <Image source={value.image} style={{ width: 60, height: 84, borderRadius: 4 }} /> : null}
          <Text style={{ color: t.text, fontWeight: "700", fontSize: 16, flex: 1 }}>{value.name}</Text>
        </View>
      ) : null}
      <Field placeholder="Search commanders (e.g. Atraxa)" value={query} onChangeText={setQuery} autoCorrect={false} />
      {loading ? <ActivityIndicator /> : null}
      {results.map((card) => (
        <Pressable
          key={card.id}
          onPress={() => {
            onChange(card);
            setQuery("");
            setResults([]);
          }}
          style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 }}
        >
          {card.artCropUrl ? <Image source={card.artCropUrl} style={{ width: 48, height: 36, borderRadius: 4 }} /> : null}
          <Text style={{ color: t.text, flex: 1 }}>{card.name}</Text>
        </Pressable>
      ))}
      <Muted>Card data and images from Scryfall.</Muted>
    </View>
  );
}
