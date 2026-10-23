import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/supabase";

const FORMATS = [
  ["commander", "Commander"], ["cedh", "cEDH"], ["standard", "Standard"], ["pauper", "Pauper"],
  ["canadian_highlander", "Canadian Highlander"], ["modern", "Modern"], ["pioneer", "Pioneer"], ["legacy", "Legacy"],
  ["vintage", "Vintage"], ["draft_sealed", "Draft / Sealed"], ["oathbreaker", "Oathbreaker"], ["brawl", "Brawl"],
  ["cube", "Cube"], ["dandan", "Dandân"],
] as const;

// Stores are all in Kansas City for now. Turn a datetime-local value into a real instant in Central time.
const STORE_TZ = "America/Chicago";
function centralToIso(local: string) {
  const asUtc = new Date(`${local}:00Z`);
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: STORE_TZ, timeZoneName: "longOffset" }).formatToParts(asUtc);
  const offset = parts.find((p) => p.type === "timeZoneName")?.value.replace("GMT", "") || "+00:00";
  return new Date(`${local}:00${offset}`).toISOString();
}

async function claimStore(formData: FormData) {
  "use server";
  const { user, supabase } = await requireUser();
  const storeId = String(formData.get("store_id") || "") || null;
  const { error } = await supabase.from("store_claims").insert({
    user_id: user.id,
    store_id: storeId,
    proposed_name: storeId ? null : String(formData.get("proposed_name") || "") || null,
    proposed_address: storeId ? null : String(formData.get("proposed_address") || "") || null,
    contact_email: String(formData.get("contact_email")),
    contact_phone: String(formData.get("contact_phone") || "") || null,
    notes: String(formData.get("notes") || "") || null,
  });
  redirect(error ? `/store?error=${encodeURIComponent(error.message)}` : "/store?ok=Claim+sent.+We'll+be+in+touch+to+verify.");
}

async function createEvent(formData: FormData) {
  "use server";
  const { user, supabase } = await requireUser();
  const fee = String(formData.get("fee") || "");
  const ends = String(formData.get("ends_at") || "");
  // RLS only lets verified owners of this store insert.
  const { error } = await supabase.from("events").insert({
    store_id: String(formData.get("store_id")),
    title: String(formData.get("title")),
    description: String(formData.get("description") || "") || null,
    format: String(formData.get("format") || "") || null,
    entry_fee_cents: fee === "" ? null : Math.round(Number(fee) * 100),
    starts_at: centralToIso(String(formData.get("starts_at"))),
    ends_at: ends ? centralToIso(ends) : null,
    created_by: user.id,
  });
  redirect(error ? `/store?error=${encodeURIComponent(error.message)}` : "/store?ok=Event+posted");
}

async function deleteEvent(formData: FormData) {
  "use server";
  const { supabase } = await requireUser();
  await supabase.from("events").delete().eq("id", String(formData.get("id")));
  revalidatePath("/store");
}

export default async function StorePortal({ searchParams }: { searchParams: Promise<{ q?: string; ok?: string; error?: string }> }) {
  const { q, ok, error } = await searchParams;
  const { user, supabase } = await requireUser();

  const [{ data: myStores }, { data: myClaims }, { data: matches }] = await Promise.all([
    supabase.from("stores").select("id, name, address, status").eq("owner_id", user.id),
    supabase.from("store_claims").select("id, status, proposed_name, store:stores(name)").order("created_at", { ascending: false }),
    q ? supabase.from("stores").select("id, name, address").ilike("name", `%${q}%`).is("owner_id", null).limit(10) : Promise.resolve({ data: [] }),
  ]);
  const verified = (myStores ?? []).filter((s) => s.status === "verified");
  const { data: events } = verified.length
    ? await supabase.from("events").select("id, title, starts_at, format, store_id").in("store_id", verified.map((s) => s.id))
        .gte("starts_at", new Date().toISOString()).order("starts_at")
    : { data: [] };

  return (
    <main>
      <p><Link href="/">← Home</Link></p>
      <h1>Store portal</h1>
      {ok ? <p style={{ color: "var(--ok)" }}>{ok}</p> : null}
      {error ? <p style={{ color: "var(--danger)" }}>{error}</p> : null}

      {verified.length ? (
        <>
          <h2>Post an event</h2>
          <form action={createEvent} className="card">
            <div className="grid">
              <label>Store
                <select name="store_id">{verified.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
              </label>
              <label>Title<input name="title" required placeholder="Friday Night Magic: Commander" /></label>
              <label>Format
                <select name="format"><option value="">Any / mixed</option>{FORMATS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
              </label>
              <label>Starts (Central time)<input type="datetime-local" name="starts_at" required /></label>
              <label>Ends (optional)<input type="datetime-local" name="ends_at" /></label>
              <label>Entry fee in $ (blank if none listed, 0 = free)<input name="fee" inputMode="decimal" /></label>
            </div>
            <label>Description<textarea name="description" rows={3} /></label>
            <button>Post event</button>
          </form>

          <h2>Upcoming events</h2>
          {(events ?? []).length === 0 ? <p className="muted">None yet.</p> : null}
          {(events ?? []).map((e) => (
            <div key={e.id} className="card row" style={{ justifyContent: "space-between" }}>
              <div>
                <strong>{e.title}</strong>
                <div className="muted">{new Date(e.starts_at).toLocaleString("en-US", { timeZone: STORE_TZ })}</div>
              </div>
              <form action={deleteEvent}>
                <input type="hidden" name="id" value={e.id} />
                <button className="danger">Delete</button>
              </form>
            </div>
          ))}
        </>
      ) : null}

      <h2>Your stores</h2>
      {(myStores ?? []).length === 0 ? <p className="muted">You don&apos;t manage any stores yet.</p> : null}
      {(myStores ?? []).map((s) => (
        <div key={s.id} className="card"><strong>{s.name}</strong> <span className={`badge ${s.status}`}>{s.status}</span><div className="muted">{s.address}</div></div>
      ))}
      {(myClaims ?? []).filter((c) => c.status === "pending").map((c) => (
        <p key={c.id} className="muted">Claim pending: {(c.store as unknown as { name: string } | null)?.name ?? c.proposed_name}</p>
      ))}

      <h2>Claim your store</h2>
      <p className="muted">
        Most Kansas City stores are already listed from Google Maps. Find yours and claim it. We verify by calling the store&apos;s
        listed number or emailing an address on your store&apos;s website.
      </p>
      <form className="row" style={{ marginBottom: 12 }}>
        <input name="q" placeholder="Store name" defaultValue={q} style={{ width: 260 }} />
        <button className="secondary">Search</button>
      </form>
      {q ? (
        <form action={claimStore} className="card">
          {(matches ?? []).length ? (
            <label>Which store?
              <select name="store_id">
                {(matches ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}: {s.address}</option>)}
                <option value="">My store isn&apos;t listed (new store)</option>
              </select>
            </label>
          ) : (
            <p>No unclaimed match for &ldquo;{q}&rdquo;. Tell us about your store:</p>
          )}
          <div className="grid">
            <label>Store name (if new)<input name="proposed_name" defaultValue={q} /></label>
            <label>Store address (if new)<input name="proposed_address" /></label>
            <label>Business email<input type="email" name="contact_email" required defaultValue={user.email ?? ""} /></label>
            <label>Phone<input name="contact_phone" /></label>
          </div>
          <label>Anything we should know?<textarea name="notes" rows={2} /></label>
          <button>Send claim</button>
        </form>
      ) : null}
    </main>
  );
}
