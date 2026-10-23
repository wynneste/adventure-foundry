import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/supabase";

async function setBanned(formData: FormData) {
  "use server";
  const { admin } = await requireAdmin();
  await admin.from("profiles").update({ is_banned: formData.get("banned") === "true" }).eq("id", String(formData.get("id")));
  revalidatePath("/admin/users");
}

export default async function Users({ searchParams }: { searchParams: Promise<{ q?: string; id?: string }> }) {
  const { q, id } = await searchParams;
  const { admin } = await requireAdmin();
  let query = admin
    .from("profiles")
    .select("id, display_name, handle, age_range, verification, is_banned, created_at, home_store:stores(name)")
    .order("created_at", { ascending: false })
    .limit(100);
  if (id) query = query.eq("id", id);
  else if (q) query = query.or(`display_name.ilike.%${q.replace(/[,()]/g, "")}%,handle.ilike.%${q.replace(/[,()]/g, "")}%`);
  const { data: users } = await query;

  return (
    <>
      <h1>Users</h1>
      <form className="row" style={{ marginBottom: 12 }}>
        <input name="q" placeholder="Search name or handle" defaultValue={q} style={{ width: 260 }} />
        <button className="secondary">Search</button>
      </form>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Player</th><th>Age</th><th>LGS</th><th>Verified</th><th>Joined</th><th /></tr></thead>
          <tbody>
            {(users ?? []).map((u) => (
              <tr key={u.id}>
                <td>{u.display_name} {u.handle ? <span className="muted">({u.handle})</span> : null}</td>
                <td>{u.age_range}</td>
                <td className="muted">{(u.home_store as unknown as { name: string } | null)?.name}</td>
                <td><span className={`badge ${u.verification}`}>{u.verification}</span></td>
                <td className="muted">{new Date(u.created_at).toLocaleDateString()}</td>
                <td>
                  <form action={setBanned}>
                    <input type="hidden" name="id" value={u.id} />
                    <input type="hidden" name="banned" value={String(!u.is_banned)} />
                    <button className={u.is_banned ? "secondary" : "danger"}>{u.is_banned ? "Unban" : "Ban"}</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
