import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkPermission } from "@/lib/check-permission";
import { resolvePostDestination } from "@/lib/discord";
import { ALERT_CHANNEL_FEATURES } from "@/lib/alert-channels";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// GET - every registered feature merged with its DB override and the
// effective value currently in use, so the admin UI can show what's
// actually happening rather than just what's stored.
export async function GET() {
  const { allowed } = await checkPermission("manage_settings");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const { data: rows } = await supabase.from("alert_channels").select("feature_key, channel_id");
  const rowByKey = new Map((rows ?? []).map((r) => [r.feature_key, r.channel_id as string | null]));

  const features = ALERT_CHANNEL_FEATURES.map((f) => {
    const customChannelId = rowByKey.get(f.key) ?? null;
    const envDefault = f.envVar ? process.env[f.envVar] ?? null : null;
    const effectiveChannelId = customChannelId ?? envDefault;
    const source: "custom" | "env" | "unset" = customChannelId ? "custom" : envDefault ? "env" : "unset";

    return {
      key: f.key,
      label: f.label,
      envVar: f.envVar ?? null,
      customChannelId,
      effectiveChannelId,
      source,
    };
  });

  return NextResponse.json({ features });
}

// PUT - set (or clear) one feature's channel override.
export async function PUT(request: NextRequest) {
  const { allowed, user } = await checkPermission("manage_settings");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const body = await request.json().catch(() => ({}));
  const featureKey = typeof body.featureKey === "string" ? body.featureKey : "";
  const input = typeof body.input === "string" ? body.input.trim() : "";

  if (!ALERT_CHANNEL_FEATURES.some((f) => f.key === featureKey)) {
    return NextResponse.json({ error: "Unknown feature." }, { status: 400 });
  }

  let channelId: string | null = null;
  if (input) {
    channelId = resolvePostDestination(input, null);
    if (!channelId) {
      return NextResponse.json({ error: "Couldn't parse that as a channel/thread ID or Discord link." }, { status: 400 });
    }
  }

  const { error } = await supabase
    .from("alert_channels")
    .upsert(
      {
        feature_key: featureKey,
        channel_id: channelId,
        updated_by: user?.discord_username ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "feature_key" }
    );

  if (error) return NextResponse.json({ error: "Failed to save." }, { status: 500 });

  return NextResponse.json({ saved: true, channelId });
}
