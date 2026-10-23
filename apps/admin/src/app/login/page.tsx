import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { userClient } from "@/lib/supabase";

async function origin() {
  const h = await headers();
  return `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
}

async function signInWithProvider(formData: FormData) {
  "use server";
  const provider = formData.get("provider") as "google" | "discord" | "apple";
  const supabase = await userClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: `${await origin()}/auth/callback` },
  });
  if (error) redirect(`/login?error=${encodeURIComponent(error.message)}`);
  redirect(data.url);
}

async function signInWithEmail(formData: FormData) {
  "use server";
  const supabase = await userClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: String(formData.get("email")),
    options: { emailRedirectTo: `${await origin()}/auth/callback` },
  });
  redirect(error ? `/login?error=${encodeURIComponent(error.message)}` : "/login?sent=1");
}

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string; sent?: string }> }) {
  const { error, sent } = await searchParams;
  return (
    <main style={{ maxWidth: 420 }}>
      <h1>Sign in</h1>
      {error ? <p style={{ color: "var(--danger)" }}>{error}</p> : null}
      {sent ? <p>Check your email for a sign-in link.</p> : null}
      <form action={signInWithProvider} className="row" style={{ flexDirection: "column", alignItems: "stretch" }}>
        <button name="provider" value="google">Continue with Google</button>
        <button name="provider" value="discord">Continue with Discord</button>
        <button name="provider" value="apple" className="secondary">Continue with Apple</button>
      </form>
      <h2>Or use your store email</h2>
      <form action={signInWithEmail}>
        <label>Email<input type="email" name="email" required /></label>
        <button>Email me a link</button>
      </form>
    </main>
  );
}
