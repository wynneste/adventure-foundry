import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/supabase";

async function setStatus(formData: FormData) {
  "use server";
  const { admin } = await requireAdmin();
  await admin.from("stores").update({ status: String(formData.get("status")) }).eq("id", String(formData.get("id")));
  revalidatePath("/admin/stores");
}

async function addStore(formData: FormData) {
  "use server";
  const { admin } = await requireAdmin();
  const lat = Number(formData.get("lat"));
  const lng = Number(formData.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) redirect("/admin/stores?error=Latitude+and+longitude+are+required");
  const { error } = await admin.from("stores").insert({
    name: String(formData.get("name")),
    address: String(formData.get("address") || "") || null,
    city: String(formData.get("city") || "") || null,
    website: String(formData.get("website") || "") || null,
    location: `SRID=4326;POINT(${lng} ${lat})`,
    source: "manual",
    status: "verified",
  });
  redirect(error ? `/admin/stores?error=${encodeURIComponent(error.message)}` : "/admin/stores?ok=Store+added");
}

async function runImport() {
  "use server";
  await requireAdmin();
  const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/import-stores`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ lat: 39.0997, lng: -94.5786, radiusMeters: 50000 }),
  });
  const text = await res.text();
  redirect(`/admin/stores?${res.ok ? "ok" : "error"}=${encodeURIComponent(`Import: ${text}`)}`);
}

export default async function Stores({ searchParams }: { searchParams: Promise<{ status?: string; q?: string; ok?: string; error?: string }> }) {
  const { status, q, ok, error } = await searchParams;
  const { admin } = await requireAdmin();
  let query = admin.from("stores").select("id, name, address, city, website, status, source, owner_id").order("name").limit(500);
  if (status) query = query.eq("status", status);
  if (q) query = query.ilike("name", `%${q}%`);
  const { data: stores } = await query;

  return (
    <>
      <h1>Stores</h1>
      {ok ? <p style={{ color: "var(--ok)" }}>{ok}</p> : null}
      {error ? <p style={{ color: "var(--danger)" }}>{error}</p> : null}

      <div className="row" style={{ marginBottom: 12 }}>
        <form className="row">
          <input name="q" placeholder="Search name" defaultValue={q} style={{ width: 200 }} />
          <select name="status" defaultValue={status ?? ""} style={{ width: 160 }}>
            <option value="">All statuses</option>
            <option value="unverified">Unverified</option>
            <option value="pending">Pending</option>
            <option value="verified">Verified</option>
            <option value="hidden">Hidden</option>
          </select>
          <button className="secondary">Filter</button>
        </form>
        <form action={runImport}>
          <button>Import Kansas City stores from Google</button>
        </form>
      </div>
      <p className="muted">
        The Google import grabs comic, board game and card shops. Hide any that don&apos;t run Magic, and verify the ones you&apos;ve confirmed.
      </p>

      <div className="table-wrap">
        <table>
          <thead><tr><th>Store</th><th>Status</th><th>Source</th><th>Actions</th></tr></thead>
          <tbody>
            {(stores ?? []).map((s) => (
              <tr key={s.id}>
                <td>
                  <strong>{s.name}</strong>
                  <div className="muted">{s.address}</div>
                  {s.website ? <a href={s.website} target="_blank" rel="noreferrer" className="muted">{s.website}</a> : null}
                </td>
                <td><span className={`badge ${s.status}`}>{s.status}</span>{s.owner_id ? <div className="muted">has owner</div> : null}</td>
                <td className="muted">{s.source}</td>
                <td>
                  <div className="row">
                    {(["verified", "unverified", "hidden"] as const).filter((x) => x !== s.status).map((x) => (
                      <form key={x} action={setStatus} className="inline">
                        <input type="hidden" name="id" value={s.id} />
                        <input type="hidden" name="status" value={x} />
                        <button className={x === "hidden" ? "danger" : x === "verified" ? "" : "secondary"}>
                          {x === "verified" ? "Verify" : x === "hidden" ? "Hide" : "Unverify"}
                        </button>
                      </form>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Add a store manually</h2>
      <form action={addStore} className="card">
        <div className="grid">
          <label>Name<input name="name" required /></label>
          <label>Address<input name="address" /></label>
          <label>City<input name="city" defaultValue="Kansas City" /></label>
          <label>Website<input name="website" type="url" /></label>
          <label>Latitude<input name="lat" required placeholder="39.0997" /></label>
          <label>Longitude<input name="lng" required placeholder="-94.5786" /></label>
        </div>
        <p className="muted">Tip: right-click the spot in Google Maps and click the coordinates to copy them.</p>
        <button>Add store</button>
      </form>
    </>
  );
}
