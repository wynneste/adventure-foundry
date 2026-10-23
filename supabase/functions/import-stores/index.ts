// Pulls game stores near a city from the Google Places API (New) and upserts
// them into `stores`. Re-running is safe: existing rows keep their status and
// owner, only the Google details are refreshed.
//
// Deploy:  supabase functions deploy import-stores
// Secrets: supabase secrets set GOOGLE_PLACES_API_KEY=...
// Run (admin only, from the admin site or curl with the service role key):
//   POST /functions/v1/import-stores  {"lat":39.0997,"lng":-94.5786,"radiusMeters":50000}
import { createClient } from "jsr:@supabase/supabase-js@2";

const KANSAS_CITY = { lat: 39.0997, lng: -94.5786 };
const QUERIES = [
  "Magic the Gathering game store",
  "trading card game store",
  "board game store",
  "comic and game shop",
];
const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.addressComponents",
  "places.location",
  "places.nationalPhoneNumber",
  "places.websiteUri",
  "places.businessStatus",
  "nextPageToken",
].join(",");

type Place = {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  addressComponents?: { longText: string; types: string[] }[];
  location: { latitude: number; longitude: number };
  nationalPhoneNumber?: string;
  websiteUri?: string;
  businessStatus?: string;
};

async function searchPlaces(apiKey: string, query: string, lat: number, lng: number, radius: number) {
  const places: Place[] = [];
  let pageToken: string | undefined;
  // Text Search returns up to 20 per page and 60 total.
  for (let page = 0; page < 3; page++) {
    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": FIELD_MASK,
      },
      body: JSON.stringify({
        textQuery: query,
        pageSize: 20,
        pageToken,
        locationBias: { circle: { center: { latitude: lat, longitude: lng }, radius } },
      }),
    });
    if (!res.ok) throw new Error(`Places API ${res.status}: ${await res.text()}`);
    const body = await res.json();
    places.push(...(body.places ?? []));
    pageToken = body.nextPageToken;
    if (!pageToken) break;
  }
  return places;
}

Deno.serve(async (req) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const apiKey = Deno.env.get("GOOGLE_PLACES_API_KEY");
  if (!apiKey) return new Response("GOOGLE_PLACES_API_KEY is not set", { status: 500 });

  const admin = createClient(supabaseUrl, serviceKey);

  // Only admins may run the import.
  const jwt = req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
  if (jwt !== serviceKey) {
    const { data: { user } } = await admin.auth.getUser(jwt);
    const { data: isAdmin } = user
      ? await admin.from("admins").select("user_id").eq("user_id", user.id).maybeSingle()
      : { data: null };
    if (!isAdmin) return new Response("Admins only", { status: 403 });
  }

  const { lat = KANSAS_CITY.lat, lng = KANSAS_CITY.lng, radiusMeters = 50000 } =
    await req.json().catch(() => ({}));
  // Google caps locationBias radius at 50 km.
  const radius = Math.min(radiusMeters, 50000);

  const byId = new Map<string, Place>();
  for (const q of QUERIES) {
    for (const p of await searchPlaces(apiKey, q, lat, lng, radius)) {
      if (p.businessStatus && p.businessStatus !== "OPERATIONAL") continue;
      byId.set(p.id, p);
    }
  }

  const { data: existing } = await admin
    .from("stores")
    .select("google_place_id")
    .in("google_place_id", [...byId.keys()]);
  const known = new Set((existing ?? []).map((r) => r.google_place_id));

  const rows = [...byId.values()].map((p) => ({
    google_place_id: p.id,
    name: p.displayName?.text ?? "Unnamed store",
    address: p.formattedAddress ?? null,
    city: p.addressComponents?.find((c) => c.types.includes("locality"))?.longText ?? null,
    location: `SRID=4326;POINT(${p.location.longitude} ${p.location.latitude})`,
    phone: p.nationalPhoneNumber ?? null,
    website: p.websiteUri ?? null,
    updated_at: new Date().toISOString(),
  }));

  // Existing rows: refresh Google details only, so status/owner are untouched.
  const updates = rows.filter((r) => known.has(r.google_place_id));
  const inserts = rows
    .filter((r) => !known.has(r.google_place_id))
    .map((r) => ({ ...r, source: "google_import", status: "unverified" }));

  if (updates.length) {
    const { error } = await admin.from("stores").upsert(updates, { onConflict: "google_place_id" });
    if (error) return new Response(error.message, { status: 500 });
  }
  if (inserts.length) {
    const { error } = await admin.from("stores").insert(inserts);
    if (error) return new Response(error.message, { status: 500 });
  }

  return Response.json({ found: rows.length, added: inserts.length, updated: updates.length });
});
