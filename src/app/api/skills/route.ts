import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// GET /api/skills — the live skill library ("the rack"). Official skills first,
// then newest forged skills, so a freshly forged one surfaces near the top.
export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("skills")
    .select(
      "slug, name, description, trigger_keywords, execution_type, is_official, usage_count, created_at",
    )
    .order("is_official", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: `Failed to load skills: ${error.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ skills: data ?? [] });
}
