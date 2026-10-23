import type { ManaColor, MtgFormat, OnlinePlatform, PowerLevel } from "./types";

export const FORMATS: { value: MtgFormat; label: string }[] = [
  { value: "commander", label: "Commander" },
  { value: "cedh", label: "cEDH" },
  { value: "standard", label: "Standard" },
  { value: "pauper", label: "Pauper" },
  { value: "canadian_highlander", label: "Canadian Highlander" },
  { value: "modern", label: "Modern" },
  { value: "pioneer", label: "Pioneer" },
  { value: "legacy", label: "Legacy" },
  { value: "vintage", label: "Vintage" },
  { value: "draft_sealed", label: "Draft / Sealed" },
  { value: "oathbreaker", label: "Oathbreaker" },
  { value: "brawl", label: "Brawl" },
  { value: "cube", label: "Cube" },
  { value: "dandan", label: "Dandân" },
];

export const PLATFORMS: { value: OnlinePlatform; label: string; handleHint: string }[] = [
  { value: "discord", label: "Discord", handleHint: "username" },
  { value: "spelltable", label: "SpellTable", handleHint: "display name" },
  { value: "tabletop_simulator", label: "Tabletop Simulator", handleHint: "Steam name" },
  { value: "mtg_arena", label: "MTG Arena", handleHint: "Name#12345" },
  { value: "mtgo", label: "MTGO", handleHint: "username" },
  { value: "cockatrice", label: "Cockatrice", handleHint: "username" },
  { value: "xmage", label: "XMage", handleHint: "username" },
  { value: "untap_gg", label: "Untap.gg", handleHint: "username" },
];

export const POWER_LEVELS: { value: PowerLevel; label: string }[] = [
  { value: "casual", label: "Casual" },
  { value: "mid", label: "Mid" },
  { value: "high", label: "High" },
  { value: "cedh", label: "cEDH" },
];

export const COMPETITIVENESS = ["Just vibes", "Mostly casual", "Balanced", "Competitive", "Tournament grinder"];

export const MANA: { value: ManaColor; label: string; color: string }[] = [
  { value: "W", label: "White", color: "#F8F1D8" },
  { value: "U", label: "Blue", color: "#4A90D9" },
  { value: "B", label: "Black", color: "#3A3340" },
  { value: "R", label: "Red", color: "#D9534F" },
  { value: "G", label: "Green", color: "#3E9B5A" },
];

export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const REPORT_REASONS = [
  { value: "harassment", label: "Harassment or hate" },
  { value: "inappropriate", label: "Inappropriate content" },
  { value: "fake_profile", label: "Fake profile or scam" },
  { value: "underage", label: "May be under 18" },
  { value: "no_show", label: "No-show / flaked" },
  { value: "cheating", label: "Cheating" },
  { value: "other", label: "Something else" },
] as const;

export const labelFor = <T extends string>(list: { value: T; label: string }[], v: T) =>
  list.find((x) => x.value === v)?.label ?? v;

export const COMMUNITY_DISCORD_URL = process.env.EXPO_PUBLIC_COMMUNITY_DISCORD_URL || "https://discord.gg/Fe39AC7zg";
