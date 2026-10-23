import Link from "next/link";
import { requireAdmin } from "@/lib/supabase";

// Players never see these. They help spot people with a pattern of bad games.
export default async function Reviews() {
  const { admin } = await requireAdmin();
  const { data: reviews } = await admin.from("reviews").select("reviewee_id, would_play_again");

  const byPerson = new Map<string, { up: number; down: number }>();
  (reviews ?? []).forEach((r) => {
    const s = byPerson.get(r.reviewee_id) ?? { up: 0, down: 0 };
    if (r.would_play_again) s.up++;
    else s.down++;
    byPerson.set(r.reviewee_id, s);
  });
  const ids = [...byPerson.keys()];
  const { data: people } = await admin.from("profiles").select("id, display_name, handle").in("id", ids);
  const rows = (people ?? [])
    .map((p) => ({ ...p, ...byPerson.get(p.id)! }))
    .sort((a, b) => b.down / (b.up + b.down) - a.down / (a.up + a.down) || b.down - a.down);

  return (
    <>
      <h1>Hidden reviews</h1>
      <p className="muted">&ldquo;Would you play with them again?&rdquo; Sorted by the share of 👎. Look at anyone with several 👎 alongside reports.</p>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Player</th><th>👍</th><th>👎</th><th>% 👎</th><th /></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.display_name} {r.handle ? <span className="muted">({r.handle})</span> : null}</td>
                <td>{r.up}</td>
                <td>{r.down}</td>
                <td>{Math.round((100 * r.down) / (r.up + r.down))}%</td>
                <td><Link href={`/admin/users?id=${r.id}`}>View</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
