import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: eventId } = await params;

  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    return NextResponse.json({ error: "OpenAI API key not configured" }, { status: 503 });
  }

  try {
    const body = await request.json();
    const { imageUrl } = body;

    if (!imageUrl) {
      return NextResponse.json({ error: "imageUrl is required" }, { status: 400 });
    }

    // Use GPT-4o vision to extract player names from the screenshot
    const chatRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are an Old School RuneScape screenshot analyzer. Your job is to extract player names (RSNs) visible in the screenshot.

Rules:
- Look for player names rendered in the OSRS game font above characters' heads
- Look for names in the clan chat panel, friends list, or any chat messages
- Look for names in group interfaces, raids party panels, or loot trackers
- RSNs can contain letters, numbers, spaces, hyphens, and underscores
- RSNs are max 12 characters
- Return ONLY the list of unique player names you can identify
- If you can't read a name clearly, skip it rather than guessing
- Do NOT include NPC names, item names, or other game text
- Return as a JSON array of strings, nothing else

Example output: ["Tiffy X", "Gn0me Vlad", "Pizza Queen"]
If no names found: []`,
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Extract all visible player names (RSNs) from this Old School RuneScape screenshot. Return only a JSON array of strings.",
              },
              {
                type: "image_url",
                image_url: { url: imageUrl, detail: "high" },
              },
            ],
          },
        ],
        temperature: 0.1,
        max_tokens: 500,
      }),
    });

    if (!chatRes.ok) {
      const err = await chatRes.text();
      console.error("GPT-4o vision error:", err);
      return NextResponse.json({ error: "Screenshot analysis failed" }, { status: 500 });
    }

    const chatData = await chatRes.json();
    const content = chatData.choices?.[0]?.message?.content?.trim() ?? "[]";

    // Parse the names — GPT might wrap in markdown code blocks
    let names: string[] = [];
    try {
      const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      names = JSON.parse(cleaned);
      if (!Array.isArray(names)) names = [];
      // Filter valid RSNs
      names = names.filter(
        (n) => typeof n === "string" && n.length > 0 && n.length <= 12
      );
    } catch {
      console.error("Failed to parse GPT response:", content);
      return NextResponse.json({
        error: "Could not parse names from screenshot",
        raw: content,
      }, { status: 422 });
    }

    if (names.length === 0) {
      return NextResponse.json({
        names: [],
        message: "No player names detected in the screenshot.",
      });
    }

    // Try to match names to user_profiles for discord_id resolution
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    const resolved: {
      rsn: string;
      discord_id: string | null;
      discord_username: string | null;
      discord_nickname: string | null;
      matched: boolean;
    }[] = [];

    if (supabaseUrl && serviceKey) {
      const supabase = createClient(supabaseUrl, serviceKey);

      for (const name of names) {
        const { data: profile } = await supabase
          .from("user_profiles")
          .select("discord_id, discord_username, discord_nickname")
          .ilike("rsn", name)
          .maybeSingle();

        resolved.push({
          rsn: name,
          discord_id: profile?.discord_id ?? null,
          discord_username: profile?.discord_username ?? null,
          discord_nickname: profile?.discord_nickname ?? null,
          matched: !!profile,
        });
      }
    } else {
      for (const name of names) {
        resolved.push({
          rsn: name,
          discord_id: null,
          discord_username: null,
          discord_nickname: null,
          matched: false,
        });
      }
    }

    return NextResponse.json({
      names: resolved,
      count: resolved.length,
      matched: resolved.filter((r) => r.matched).length,
      message: `Found ${resolved.length} player name(s), ${resolved.filter((r) => r.matched).length} matched to linked profiles.`,
    });
  } catch (err) {
    console.error("Screenshot scan error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
