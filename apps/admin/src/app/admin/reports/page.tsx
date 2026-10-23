import Link from "next/link";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/supabase";

async function resolve(formData: FormData) {
  "use server";
  const { admin } = await requireAdmin();
  const id = String(formData.get("id"));
  const action = String(formData.get("action"));
  const reportedId = String(formData.get("reported_id"));
  if (action === "ban") await admin.from("profiles").update({ is_banned: true }).eq("id", reportedId);
  await admin.from("reports").update({
    status: action === "dismiss" ? "dismissed" : "actioned",
    admin_notes: String(formData.get("notes") || "") || null,
  }).eq("id", id);
  revalidatePath("/admin/reports");
}

export default async function Reports({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const { show } = await searchParams;
  const { admin } = await requireAdmin();
  const { data: reports } = await admin
    .from("reports")
    .select("*, reporter:profiles!reports_reporter_id_fkey(display_name), reported:profiles!reports_reported_id_fkey(id, display_name, handle)")
    .eq("status", show === "closed" ? "actioned" : "open")
    .order("created_at", { ascending: false })
    .limit(200);

  // How many times each reported person has been reported in total.
  const ids = [...new Set((reports ?? []).map((r) => r.reported_id))];
  const { data: all } = await admin.from("reports").select("reported_id").in("reported_id", ids);
  const totals = new Map<string, number>();
  (all ?? []).forEach((r) => totals.set(r.reported_id, (totals.get(r.reported_id) ?? 0) + 1));

  return (
    <>
      <h1>Reports</h1>
      <p><Link href="/admin/reports">Open</Link> · <Link href="/admin/reports?show=closed">Actioned</Link></p>
      {(reports ?? []).map((r) => (
        <div key={r.id} className="card">
          <div className="row">
            <span className={`badge ${r.status}`}>{r.reason}</span>
            <strong>{r.reported?.display_name}</strong>
            <span className="muted">reported by {r.reporter?.display_name} · {new Date(r.created_at).toLocaleString()}</span>
            <span className="muted">· {totals.get(r.reported_id)} report(s) total</span>
            <Link href={`/admin/users?id=${r.reported_id}`}>View user</Link>
          </div>
          {r.details ? <p>{r.details}</p> : null}
          {r.status === "open" ? (
            <form action={resolve} className="row">
              <input type="hidden" name="id" value={r.id} />
              <input type="hidden" name="reported_id" value={r.reported_id} />
              <input name="notes" placeholder="Notes (private)" style={{ flex: 1, minWidth: 200 }} />
              <button name="action" value="warn" className="secondary">Mark handled</button>
              <button name="action" value="ban" className="danger">Ban user</button>
              <button name="action" value="dismiss" className="secondary">Dismiss</button>
            </form>
          ) : <p className="muted">{r.admin_notes}</p>}
        </div>
      ))}
    </>
  );
}
