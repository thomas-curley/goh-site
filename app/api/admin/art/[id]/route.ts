import { NextRequest, NextResponse } from "next/server";
import { checkPermission } from "@/lib/check-permission";
import { announceArt, ART_BUCKET, artServiceClient, ENTRY_COLUMNS, loadContest, signImages } from "@/lib/art-server";
import { creditName, rankEntries, type ArtContestStatus, type ArtEntry } from "@/lib/art";

const STATUSES: ArtContestStatus[] = ["draft", "submissions", "review", "voting", "completed"];

async function guard() {
  const { allowed, user } = await checkPermission("manage_art");
  if (!allowed) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  const supabase = artServiceClient();
  if (!supabase) return { error: NextResponse.json({ error: "Supabase not configured" }, { status: 503 }) };
  return { supabase, user };
}

// GET - the whole contest for staff: settings, every entry (with images and
// the artist's choices), vote counts and every vote's comment.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await guard();
  if ("error" in ctx) return ctx.error;
  const { supabase } = ctx;
  const contest = await loadContest(supabase, id);
  if (!contest) return NextResponse.json({ error: "Contest not found." }, { status: 404 });

  const [{ data: entries }, { data: votes }] = await Promise.all([
    supabase.from("art_entries").select(ENTRY_COLUMNS).eq("contest_id", id).order("created_at"),
    supabase.from("art_votes").select("id, entry_id, voter_key, voter_name, comment, comment_hidden, created_at").eq("contest_id", id).order("created_at", { ascending: false }),
  ]);
  const list = (entries ?? []) as ArtEntry[];
  const urls = await signImages(supabase, list.flatMap((e) => e.image_paths));
  const results = rankEntries(list.filter((e) => e.status === "approved").map((e) => e.id), votes ?? []);
  return NextResponse.json({
    contest,
    entries: list.map((e) => ({ ...e, images: e.image_paths.map((p) => urls[p]).filter(Boolean), shownAs: creditName(e) })),
    votes: votes ?? [],
    results,
    voterCount: new Set((votes ?? []).map((v) => v.voter_key)).size,
  });
}

// PATCH - change settings or move the contest along. Opening entries,
// opening voting and finishing are only posted to the art contests channel
// when staff ask for it ({ announce: true }); by default nothing is posted.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await guard();
  if ("error" in ctx) return ctx.error;
  const { supabase } = ctx;
  const contest = await loadContest(supabase, id);
  if (!contest) return NextResponse.json({ error: "Contest not found." }, { status: 404 });
  const body = await request.json().catch(() => ({}));
  const update: Record<string, unknown> = {};

  const text = (key: string, max: number) => {
    if (key in body) update[key] = typeof body[key] === "string" ? body[key].trim().slice(0, max) || null : null;
  };
  if ("name" in body) {
    const name = typeof body.name === "string" ? body.name.trim().slice(0, 100) : "";
    if (!name) return NextResponse.json({ error: "The contest needs a name." }, { status: 400 });
    update.name = name;
  }
  text("description", 2000);
  text("rules", 4000);
  text("theme", 200);
  text("banner_url", 1000);
  for (const key of ["submissions_close_at", "voting_close_at"]) {
    if (key in body) {
      const v = body[key];
      if (v !== null && (typeof v !== "string" || Number.isNaN(Date.parse(v)))) return NextResponse.json({ error: "That date isn't valid." }, { status: 400 });
      update[key] = v;
    }
  }
  const pick = (key: string, options: string[]) => {
    if (key in body) {
      if (!options.includes(body[key])) throw new Error(`Unknown ${key}`);
      update[key] = body[key];
    }
  };
  const num = (key: string, min: number, max: number) => {
    if (key in body) update[key] = Math.max(min, Math.min(max, Math.floor(Number(body[key]) || min)));
  };
  try {
    pick("submit_eligibility", ["clan", "signed_in"]);
    pick("vote_eligibility", ["clan", "signed_in", "ip"]);
    pick("comments_visibility", ["live", "after", "private", "off"]);
  } catch {
    return NextResponse.json({ error: "One of the settings isn't valid." }, { status: 400 });
  }
  num("max_entries_per_person", 1, 20);
  num("max_images_per_entry", 1, 10);
  num("votes_per_voter", 1, 20);
  if ("show_live_results" in body) update.show_live_results = !!body.show_live_results;
  if ("anonymous_voting" in body) update.anonymous_voting = !!body.anonymous_voting;

  let announce: "submissions" | "voting" | "completed" | null = null;
  if ("status" in body) {
    if (!STATUSES.includes(body.status)) return NextResponse.json({ error: "Unknown status." }, { status: 400 });
    if (body.status === "voting") {
      const { count } = await supabase.from("art_entries").select("*", { count: "exact", head: true }).eq("contest_id", id).eq("status", "approved");
      if (!count) return NextResponse.json({ error: "Approve at least one entry before opening voting." }, { status: 400 });
    }
    if (body.status !== contest.status && ["submissions", "voting", "completed"].includes(body.status)) announce = body.status;
    update.status = body.status;
  }
  if (Object.keys(update).length === 0) return NextResponse.json({ saved: true });
  update.updated_at = new Date().toISOString();
  const { error } = await supabase.from("art_contests").update(update).eq("id", id);
  if (error) return NextResponse.json({ error: "Couldn't save the contest." }, { status: 500 });

  if (announce && body.announce === true) {
    const site = process.env.NEXT_PUBLIC_SITE_URL ?? "";
    const link = site ? `\n${site}/art/${id}` : "";
    const name = (update.name as string) ?? contest.name;
    if (announce === "submissions") {
      await announceArt(supabase, `${name}: entries open`, `🎨 **${name}** is taking entries!${contest.theme ? `\nTheme: **${contest.theme}**` : ""}\nSubmit your artwork on the website.${link}`);
    } else if (announce === "voting") {
      await announceArt(supabase, `${name}: voting open`, `🗳️ Voting is open for **${name}**! Pick your favourite${contest.votes_per_voter > 1 ? `s (up to ${contest.votes_per_voter})` : ""}.${link}`);
    } else {
      const [{ data: entries }, { data: votes }] = await Promise.all([
        supabase.from("art_entries").select("id, title, credit, credit_name, rsn").eq("contest_id", id).eq("status", "approved"),
        supabase.from("art_votes").select("entry_id").eq("contest_id", id),
      ]);
      const ranked = rankEntries((entries ?? []).map((e) => e.id), votes ?? []).filter((r) => r.votes > 0).slice(0, 3);
      const medals = ["🥇", "🥈", "🥉"];
      const lines = ranked.map((r) => {
        const e = (entries ?? []).find((x) => x.id === r.entryId)!;
        return `${medals[r.rank - 1] ?? `${r.rank}.`} **${e.title}** by ${creditName(e)} (${r.votes} ${r.votes === 1 ? "vote" : "votes"})`;
      });
      await announceArt(supabase, `${name}: results`, [`🏆 **${name}** results are in!`, "", ...lines, link].join("\n").trim());
    }
  }
  return NextResponse.json({ saved: true });
}

// DELETE - remove a contest, its entries, votes and stored images.
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await guard();
  if ("error" in ctx) return ctx.error;
  const { data: entries } = await ctx.supabase.from("art_entries").select("image_paths").eq("contest_id", id);
  const paths = (entries ?? []).flatMap((e) => e.image_paths ?? []);
  if (paths.length) await ctx.supabase.storage.from(ART_BUCKET).remove(paths);
  const { error } = await ctx.supabase.from("art_contests").delete().eq("id", id);
  if (error) return NextResponse.json({ error: "Couldn't delete the contest." }, { status: 500 });
  return NextResponse.json({ deleted: true });
}
