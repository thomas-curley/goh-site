import { NextRequest, NextResponse } from "next/server";
import { checkPermission } from "@/lib/check-permission";
import { artServiceClient } from "@/lib/art-server";

async function context() {
  const { allowed } = await checkPermission("manage_art");
  if (!allowed) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  const supabase = artServiceClient();
  if (!supabase) return { error: NextResponse.json({ error: "Supabase not configured" }, { status: 503 }) };
  return { supabase };
}

// PATCH { comment_hidden } - hide or show a voter's comment.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string; voteId: string }> }) {
  const { id, voteId } = await params;
  const ctx = await context();
  if ("error" in ctx) return ctx.error;
  const body = await request.json().catch(() => ({}));
  await ctx.supabase.from("art_votes").update({ comment_hidden: !!body.comment_hidden }).eq("id", voteId).eq("contest_id", id);
  return NextResponse.json({ saved: true });
}

// DELETE - throw out a vote (e.g. one that broke the rules).
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string; voteId: string }> }) {
  const { id, voteId } = await params;
  const ctx = await context();
  if ("error" in ctx) return ctx.error;
  await ctx.supabase.from("art_votes").delete().eq("id", voteId).eq("contest_id", id);
  return NextResponse.json({ deleted: true });
}
