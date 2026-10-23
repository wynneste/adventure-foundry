import Link from "next/link";
import { requireAdmin } from "@/lib/supabase";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <>
      <nav>
        <strong>Adventure Foundry Admin</strong>
        <Link href="/admin">Overview</Link>
        <Link href="/admin/stores">Stores</Link>
        <Link href="/admin/claims">Store claims</Link>
        <Link href="/admin/reports">Reports</Link>
        <Link href="/admin/reviews">Hidden reviews</Link>
        <Link href="/admin/verifications">Verification</Link>
        <Link href="/admin/users">Users</Link>
        <Link href="/store">Store portal</Link>
      </nav>
      <main>{children}</main>
    </>
  );
}
