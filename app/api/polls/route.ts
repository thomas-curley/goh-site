import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkPermission } from "@/lib/check-permission";
import { createPoll, resolvePostDestination } from "@/lib/discord";
import { getAlertChannel } from "@/lib/alert-channels";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

const MAX_QUESTION_LENGTH = 300;
const MAX_ANSWER_LENGTH = 55;
const MIN_ANSWERS = 2;
const MAX_ANSWERS = 10;
const MIN_DURATION_HOURS = 1;
const MAX_DURATION_HOURS = 768; // 32 days, Discord's max

export async function POST(request: NextRequest) {
  const { allowed, user } = await checkPermission("manage_polls");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const body = await request.json().catch(() => ({}));

  const question = typeof body.question === "string" ? body.question.trim() : "";
  const answers: string[] = Array.isArray(body.answers)
    ? body.answers.map((a: unknown) => (typeof a === "string" ? a.trim() : "")).filter(Boolean)
    : [];
  const allowMultiselect = body.allowMultiselect === true;
  const durationHours = Number(body.durationHours);

  if (!question || question.length > MAX_QUESTION_LENGTH) {
    return NextResponse.json({ error: `Question is required and must be ${MAX_QUESTION_LENGTH} characters or fewer.` }, { status: 400 });
  }
  if (answers.length < MIN_ANSWERS || answers.length > MAX_ANSWERS) {
    return NextResponse.json({ error: `Provide between ${MIN_ANSWERS} and ${MAX_ANSWERS} answers.` }, { status: 400 });
  }
  if (answers.some((a) => a.length > MAX_ANSWER_LENGTH)) {
    return NextResponse.json({ error: `Each answer must be ${MAX_ANSWER_LENGTH} characters or fewer.` }, { status: 400 });
  }
  if (!Number.isFinite(durationHours) || durationHours < MIN_DURATION_HOURS || durationHours > MAX_DURATION_HOURS) {
    return NextResponse.json({ error: `Duration must be between ${MIN_DURATION_HOURS} and ${MAX_DURATION_HOURS} hours.` }, { status: 400 });
  }

  const channelId = resolvePostDestination(body.destination, await getAlertChannel(supabase, "polls"));
  if (!channelId) {
    return NextResponse.json({ error: "No destination channel configured or provided." }, { status: 400 });
  }

  let created: { messageId: string; options: { answerId: number; text: string }[] };
  try {
    created = await createPoll(channelId, question, answers, durationHours, allowMultiselect);
  } catch (err) {
    console.error("Failed to create Discord poll:", err);
    return NextResponse.json({ error: "Failed to post the poll to Discord." }, { status: 502 });
  }

  const { data: inserted, error } = await supabase
    .from("polls")
    .insert({
      question,
      options: created.options.map((o) => ({ answer_id: o.answerId, text: o.text })),
      channel_id: channelId,
      discord_message_id: created.messageId,
      allow_multiselect: allowMultiselect,
      duration_hours: durationHours,
      created_by: user?.discord_username ?? null,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    return NextResponse.json({ error: "Poll was posted to Discord but failed to save. Check the channel." }, { status: 500 });
  }

  return NextResponse.json({ id: inserted.id });
}

export async function GET() {
  const { allowed } = await checkPermission("manage_polls");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const { data, error } = await supabase.from("polls").select("*").order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: "Failed to load polls." }, { status: 500 });

  return NextResponse.json({ polls: data ?? [] });
}
