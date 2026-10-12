import { NextRequest, NextResponse } from "next/server";
import { checkPermission } from "@/lib/check-permission";
import { getServiceClient } from "@/lib/handbook-editions";
import { HANDBOOK_BUCKET } from "@/lib/handbook-format";

const EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

// POST - a one-time signed upload URL in the private handbook bucket, so
// the browser can upload a page (or the PDF) directly without the bucket
// being writable by everyone. Body: { contentType }.
export async function POST(request: NextRequest) {
  const { allowed } = await checkPermission("manage_handbook");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const body = await request.json().catch(() => ({}));
  const ext = EXTENSIONS[body.contentType as string];
  if (!ext) return NextResponse.json({ error: "Upload PNG, JPG or WebP pages, or a PDF." }, { status: 400 });

  const id = `${Date.now()}_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
  const path = ext === "pdf" ? `pdf/${id}.pdf` : `pages/${id}.${ext}`;
  const { data, error } = await supabase.storage.from(HANDBOOK_BUCKET).createSignedUploadUrl(path);
  if (error || !data) return NextResponse.json({ error: "Couldn't start the upload." }, { status: 500 });
  return NextResponse.json({ path, token: data.token });
}
