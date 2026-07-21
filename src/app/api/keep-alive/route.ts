import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// GET /api/keep-alive — hit once a day by the Vercel cron job (see
// vercel.json) purely to generate real Supabase activity so the free-tier
// project doesn't get auto-paused for inactivity. Does a trivial read (row
// count on `skills`), no writes, no auth, nothing sensitive in the response.
export async function GET() {
  const { count, error } = await supabaseAdmin
    .from("skills")
    .select("*", { count: "exact", head: true });

  if (error) {
    return NextResponse.json(
      { ok: false, error: `Keep-alive read failed: ${error.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    timestamp: new Date().toISOString(),
    skillCount: count ?? 0,
  });
}
