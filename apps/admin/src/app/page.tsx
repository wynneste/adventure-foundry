import Link from "next/link";
import { userClient } from "@/lib/supabase";

export default async function Home() {
  const supabase = await userClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: isAdmin } = user ? await supabase.rpc("is_admin") : { data: false };

  return (
    <main>
      <h1>Adventure Foundry</h1>
      <p>Find your playgroup. This site is for store owners and the moderation team. Players use the phone app.</p>
      <div className="grid">
        <div className="card">
          <h2>Store owners</h2>
          <p className="muted">Claim your store, get verified, and post events like FNM and prereleases.</p>
          <Link href="/store">Open the store portal →</Link>
        </div>
        {isAdmin ? (
          <div className="card">
            <h2>Moderation</h2>
            <p className="muted">Stores, claims, reports, reviews and photo verification.</p>
            <Link href="/admin">Open admin →</Link>
          </div>
        ) : null}
      </div>
      {!user ? <p><Link href="/login">Sign in</Link></p> : null}
    </main>
  );
}
