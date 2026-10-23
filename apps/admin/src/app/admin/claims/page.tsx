import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/supabase";

async function decide(formData: FormData) {
  "use server";
  const { user, admin } = await requireAdmin();
  const id = String(formData.get("id"));
  const approve = formData.get("decision") === "approve";
  const { data: claim } = await admin.from("store_claims").select("*").eq("id", id).single();
  if (!claim) return;

  if (approve) {
    let storeId = claim.store_id as string | null;
    if (!storeId) {
      // A brand-new store: needs coordinates typed in by the admin.
      const lat = Number(formData.get("lat"));
      const lng = Number(formData.get("lng"));
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      const { data: created } = await admin.from("stores").insert({
        name: claim.proposed_name, address: claim.proposed_address,
        location: `SRID=4326;POINT(${lng} ${lat})`, source: "self_signup",
      }).select("id").single();
      storeId = created?.id ?? null;
    }
    await admin.from("stores").update({ owner_id: claim.user_id, status: "verified" }).eq("id", storeId);
  }
  await admin.from("store_claims").update({ status: approve ? "approved" : "rejected", reviewed_by: user.id }).eq("id", id);
  revalidatePath("/admin/claims");
}

export default async function Claims() {
  const { admin } = await requireAdmin();
  const { data: claims } = await admin
    .from("store_claims")
    .select("*, store:stores(name, address, website, phone)")
    .eq("status", "pending")
    .order("created_at");

  return (
    <>
      <h1>Store claims</h1>
      <p className="muted">
        Before approving, confirm the person really runs the store: call the store&apos;s public phone number, or check that
        their email is on the store&apos;s own website domain. Google doesn&apos;t let apps check Business Profile ownership directly.
      </p>
      {(claims ?? []).length === 0 ? <p>Nothing waiting.</p> : null}
      {(claims ?? []).map((c) => (
        <div key={c.id} className="card">
          <strong>{c.store?.name ?? `NEW: ${c.proposed_name}`}</strong>
          <div className="muted">{c.store?.address ?? c.proposed_address}</div>
          {c.store?.website ? <div className="muted">Site: {c.store.website} · Phone: {c.store.phone ?? "?"}</div> : null}
          <p>Contact: {c.contact_email} {c.contact_phone ? `· ${c.contact_phone}` : ""}</p>
          {c.notes ? <p className="muted">&ldquo;{c.notes}&rdquo;</p> : null}
          <form action={decide} className="row">
            <input type="hidden" name="id" value={c.id} />
            {!c.store_id ? (
              <>
                <input name="lat" placeholder="Latitude" style={{ width: 140 }} />
                <input name="lng" placeholder="Longitude" style={{ width: 140 }} />
              </>
            ) : null}
            <button name="decision" value="approve">Approve & make owner</button>
            <button name="decision" value="reject" className="danger">Reject</button>
          </form>
        </div>
      ))}
    </>
  );
}
