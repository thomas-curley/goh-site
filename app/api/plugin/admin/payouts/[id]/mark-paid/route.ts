import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyPluginToken } from "@/lib/plugin-auth";
import { hasPermission } from "@/lib/permissions";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

/**
 * POST /api/plugin/admin/payouts/[id]/mark-paid -- marks a payout paid from
 * the plugin, with an optional proof-of-payment screenshot uploaded to the
 * same "banners" Storage bucket the site's own admin UI already uses for
 * every other image upload (banners, gnomie review photos, attendance
 * screenshots) -- appended to screenshot_urls, the same column the web
 * admin payout editor already writes to, so both surfaces show the same
 * proof trail. A failed screenshot upload doesn't block marking as paid --
 * it's best-effort, same as the site's own upload UI silently skipping a
 * failed file.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const identity = await verifyPluginToken(request);
  if (!identity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const { data: perms } = await supabase
    .from("role_permissions")
    .select("role, permission, granted")
    .eq("permission", "manage_payouts");

  if (!hasPermission(perms ?? [], identity.clanRank, "manage_payouts")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: existing } = await supabase
    .from("prize_payouts")
    .select("screenshot_urls")
    .eq("id", id)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: "Payout not found." }, { status: 404 });
  }

  let screenshotUrl: string | null = null;
  const formData = await request.formData().catch(() => null);
  const file = formData?.get("screenshot");

  if (file instanceof File && file.size > 0) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const fileName = `payout_proof_${id}_${Date.now()}.png`;
    const { error: uploadError } = await supabase.storage
      .from("banners")
      .upload(fileName, bytes, { contentType: file.type || "image/png", cacheControl: "31536000" });

    if (!uploadError) {
      const { data: pub } = supabase.storage.from("banners").getPublicUrl(fileName);
      screenshotUrl = pub.publicUrl;
    }
  }

  const screenshotUrls = screenshotUrl
    ? [...(existing.screenshot_urls ?? []), screenshotUrl]
    : existing.screenshot_urls;

  const { error } = await supabase
    .from("prize_payouts")
    .update({
      is_paid: true,
      paid_at: new Date().toISOString(),
      paid_by: identity.discordUsername,
      screenshot_urls: screenshotUrls,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return NextResponse.json({ error: "Failed to mark as paid." }, { status: 500 });

  return NextResponse.json({ paid: true, screenshotUploaded: !!screenshotUrl });
}
