import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/supabase";

async function decide(formData: FormData) {
  "use server";
  const { user, admin } = await requireAdmin();
  const status = formData.get("decision") === "approve" ? "verified" : "rejected";
  await admin.from("verifications").update({ status, reviewed_by: user.id }).eq("id", String(formData.get("id")));
  await admin.from("profiles").update({ verification: status }).eq("id", String(formData.get("profile_id")));
  revalidatePath("/admin/verifications");
}

export default async function Verifications() {
  const { admin } = await requireAdmin();
  const { data: pending } = await admin
    .from("verifications")
    .select("id, profile_id, selfie_path, gesture, created_at, profile:profiles(display_name, photo_person)")
    .eq("status", "pending")
    .order("created_at");

  // Selfies are in a private bucket, so make short-lived links for viewing.
  const items = await Promise.all((pending ?? []).map(async (v) => {
    const { data } = await admin.storage.from("verification").createSignedUrl(v.selfie_path, 600);
    const profile = v.profile as unknown as { display_name: string; photo_person: string | null } | null;
    const photo = profile?.photo_person
      ? admin.storage.from("profile-photos").getPublicUrl(profile.photo_person).data.publicUrl
      : null;
    return { ...v, profile, selfieUrl: data?.signedUrl, photo };
  }));

  return (
    <>
      <h1>Photo verification</h1>
      <p className="muted">Approve if it&apos;s clearly the same person as the profile photo and they&apos;re doing the requested pose.</p>
      {items.length === 0 ? <p>Nothing waiting.</p> : null}
      {items.map((v) => (
        <div key={v.id} className="card">
          <strong>{v.profile?.display_name}</strong> · asked for <em>{v.gesture}</em>
          <div className="row" style={{ margin: "10px 0" }}>
            <div>{v.photo ? <img className="thumb" src={v.photo} alt="Profile" /> : <div className="thumb" />}<div className="muted">Profile</div></div>
            <div>{v.selfieUrl ? <img className="thumb" src={v.selfieUrl} alt="Selfie" /> : <div className="thumb" />}<div className="muted">Selfie</div></div>
          </div>
          <form action={decide} className="row">
            <input type="hidden" name="id" value={v.id} />
            <input type="hidden" name="profile_id" value={v.profile_id} />
            <button name="decision" value="approve">Approve</button>
            <button name="decision" value="reject" className="danger">Reject</button>
          </form>
        </div>
      ))}
    </>
  );
}
