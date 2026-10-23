import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** Acts as the signed-in person. RLS applies. */
export async function userClient() {
  const store = await cookies();
  return createServerClient(url, anonKey, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // Called from a Server Component, where cookies are read-only. The proxy refreshes them.
        }
      },
    },
  });
}

/** Bypasses RLS. Only call after requireAdmin(). */
export function serviceClient() {
  return createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
}

export async function requireUser() {
  const supabase = await userClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { user, supabase };
}

export async function requireAdmin() {
  const { user, supabase } = await requireUser();
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) redirect("/store");
  return { user, admin: serviceClient() };
}
