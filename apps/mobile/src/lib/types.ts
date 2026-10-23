// Mirrors the database enums and tables in supabase/migrations.
// Once your Supabase project exists you can generate these instead:
//   npx supabase gen types typescript --project-id <id> > src/lib/database.types.ts

export type MtgFormat =
  | "commander" | "standard" | "pauper" | "canadian_highlander" | "modern" | "pioneer"
  | "legacy" | "vintage" | "cedh" | "draft_sealed" | "oathbreaker" | "brawl" | "cube" | "dandan";

export type OnlinePlatform =
  | "discord" | "spelltable" | "tabletop_simulator" | "mtg_arena" | "mtgo"
  | "cockatrice" | "xmage" | "untap_gg";

export type PlayMode = "in_person" | "online" | "both";
export type PowerLevel = "casual" | "mid" | "high" | "cedh";
export type MatchIntent = "play" | "trade";
export type ManaColor = "W" | "U" | "B" | "R" | "G";
export type Screening = "pending" | "keep" | "left";
export type RsvpStatus = "interested" | "going";

export type Profile = {
  id: string;
  display_name: string;
  use_handle_as_name: boolean;
  handle: string | null;
  pronouns: string | null;
  bio: string | null;
  age_range: string | null;
  play_mode: PlayMode;
  in_person_weight: number;
  power_level: PowerLevel;
  competitiveness: number;
  colors: ManaColor[];
  intents: MatchIntent[];
  platforms: OnlinePlatform[];
  favorite_commander_name: string | null;
  favorite_commander_scryfall_id: string | null;
  favorite_commander_image: string | null;
  photo_person: string | null;
  photo_commander: string | null;
  photo_playmat: string | null;
  home_store_id: string | null;
  timezone: string;
  search_radius_miles: number;
  verification: "none" | "pending" | "verified" | "rejected";
  onboarded: boolean;
};

export type Store = {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  website: string | null;
  phone: string | null;
  status: "unverified" | "pending" | "verified" | "hidden";
  lat: number;
  lng: number;
};

export type Availability = { id?: string; weekday: number; start_minute: number; end_minute: number };
export type DeckLink = { id?: string; label: string | null; url: string };

export type EventRow = {
  id: string;
  title: string;
  description: string | null;
  format: MtgFormat | null;
  is_online: boolean;
  online_link: string | null;
  entry_fee_cents: number | null;
  starts_at: string;
  ends_at: string | null;
  store: { id: string; name: string; address: string | null } | null;
};

export type Message = { id: string; conversation_id: string; sender_id: string; body: string; created_at: string };

/** What the swipe deck shows for one person. */
export type Candidate = Profile & {
  location_label: string;
  distance_miles: number | null;
  shared_formats: MtgFormat[];
  formats: MtgFormat[];
  availability: Availability[];
  deck_links: DeckLink[];
};
