import Link from "next/link";
import { requireAdmin } from "@/lib/supabase";

export default async function Overview() {
  const { admin } = await requireAdmin();
  const count = async (table: string, filter?: [string, string]) => {
    let q = admin.from(table).select("*", { count: "exact", head: true });
    if (filter) q = q.eq(filter[0], filter[1]);
    return (await q).count ?? 0;
  };
  const [players, stores, claims, reports, verifications] = await Promise.all([
    count("profiles", ["onboarded", "true"]),
    count("stores"),
    count("store_claims", ["status", "pending"]),
    count("reports", ["status", "open"]),
    count("verifications", ["status", "pending"]),
  ]);

  const tiles = [
    { label: "Players", value: players, href: "/admin/users" },
    { label: "Stores", value: stores, href: "/admin/stores" },
    { label: "Claims waiting", value: claims, href: "/admin/claims" },
    { label: "Open reports", value: reports, href: "/admin/reports" },
    { label: "Selfies to review", value: verifications, href: "/admin/verifications" },
  ];

  return (
    <>
      <h1>Overview</h1>
      <div className="grid">
        {tiles.map((t) => (
          <Link key={t.label} href={t.href} className="card" style={{ textDecoration: "none", color: "inherit" }}>
            <div className="muted">{t.label}</div>
            <div style={{ fontSize: 32, fontWeight: 800 }}>{t.value}</div>
          </Link>
        ))}
      </div>
    </>
  );
}
