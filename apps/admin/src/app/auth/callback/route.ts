import { NextResponse, type NextRequest } from "next/server";
import { userClient } from "@/lib/supabase";

// OAuth and email links land here with a one-time code to trade for a session.
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (code) {
    const supabase = await userClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error.message)}`, request.url));
  }
  return NextResponse.redirect(new URL("/", request.url));
}
