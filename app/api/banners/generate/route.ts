import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { buildBannerPrompt } from "@/lib/banner-prompt";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  // Rate limit: 5 banner generations per minute per IP
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  const { allowed } = rateLimit(ip, { limit: 5, windowMs: 60_000 });
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests. Try again in a minute." }, { status: 429 });
  }

  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    return NextResponse.json({ error: "OpenAI API key not configured" }, { status: 503 });
  }

  try {
    const body = await request.json();
    const { title, description, eventType, type, customPrompt } = body;

    if (!title) {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }

    // Build prompt — use custom prompt if provided, otherwise auto-generate
    const prompt = customPrompt?.trim() || buildBannerPrompt({
      title,
      description,
      eventType,
      type: type ?? "event",
    });

    // Call DALL-E 3
    const dalleRes = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt,
        n: 1,
        size: "1792x1024", // 16:9-ish landscape
        quality: "standard",
        response_format: "url",
      }),
    });

    if (!dalleRes.ok) {
      const err = await dalleRes.text();
      console.error("DALL-E error:", err);
      return NextResponse.json({ error: "Image generation failed" }, { status: 500 });
    }

    const dalleData = await dalleRes.json();
    const tempUrl = dalleData.data?.[0]?.url;
    const revisedPrompt = dalleData.data?.[0]?.revised_prompt;

    if (!tempUrl) {
      return NextResponse.json({ error: "No image returned" }, { status: 500 });
    }

    // Upload to Supabase Storage
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      // Return temp URL if Supabase isn't configured
      return NextResponse.json({
        url: tempUrl,
        prompt,
        revised_prompt: revisedPrompt,
        stored: false,
      });
    }

    // Download the image
    const imageRes = await fetch(tempUrl);
    const imageBuffer = await imageRes.arrayBuffer();

    // Upload to Supabase Storage
    const supabase = createClient(supabaseUrl, serviceKey);
    const fileName = `${type ?? "event"}_${Date.now()}.png`;

    const { error: uploadError } = await supabase.storage
      .from("banners")
      .upload(fileName, imageBuffer, {
        contentType: "image/png",
        cacheControl: "31536000",
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      // Fall back to temp URL
      return NextResponse.json({
        url: tempUrl,
        prompt,
        revised_prompt: revisedPrompt,
        stored: false,
      });
    }

    // Get public URL
    const { data: publicUrl } = supabase.storage
      .from("banners")
      .getPublicUrl(fileName);

    return NextResponse.json({
      url: publicUrl.publicUrl,
      prompt,
      revised_prompt: revisedPrompt,
      stored: true,
    });
  } catch (err) {
    console.error("Banner generation error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
