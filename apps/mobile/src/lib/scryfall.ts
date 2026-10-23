// Card data from Scryfall (https://scryfall.com/docs/api). Free, no key needed.
// Their rules: send a descriptive User-Agent/Accept header, stay under ~10
// requests/second, and credit Scryfall + keep the artist credit visible.

const HEADERS = { "User-Agent": "AdventureFoundry/0.1", Accept: "application/json" };

export type CommanderCard = {
  id: string;
  name: string;
  imageUrl: string | null;
  artCropUrl: string | null;
  artist: string | null;
  colorIdentity: string[];
};

type ScryfallCard = {
  id: string;
  name: string;
  artist?: string;
  color_identity: string[];
  image_uris?: { normal: string; art_crop: string };
  card_faces?: { image_uris?: { normal: string; art_crop: string } }[];
};

function toCommander(c: ScryfallCard): CommanderCard {
  const images = c.image_uris ?? c.card_faces?.[0]?.image_uris;
  return {
    id: c.id,
    name: c.name,
    imageUrl: images?.normal ?? null,
    artCropUrl: images?.art_crop ?? null,
    artist: c.artist ?? null,
    colorIdentity: c.color_identity,
  };
}

/** Search legal commanders by name. */
export async function searchCommanders(text: string, signal?: AbortSignal): Promise<CommanderCard[]> {
  const q = text.trim();
  if (q.length < 2) return [];
  const query = encodeURIComponent(`is:commander ${q}`);
  const res = await fetch(`https://api.scryfall.com/cards/search?q=${query}&order=edhrec&unique=cards`, {
    headers: HEADERS,
    signal,
  });
  if (res.status === 404) return []; // Scryfall uses 404 for "no results"
  if (!res.ok) throw new Error(`Scryfall error ${res.status}`);
  const body: { data: ScryfallCard[] } = await res.json();
  return body.data.slice(0, 20).map(toCommander);
}
