import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    return NextResponse.json({ error: "OpenAI API key not configured" }, { status: 503 });
  }

  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  const { allowed } = rateLimit(ip, { limit: 15, windowMs: 60_000 });
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests. Try again in a minute." }, { status: 429 });
  }

  try {
    const { content, title, type } = await request.json();

    if (!content) {
      return NextResponse.json({ error: "content is required" }, { status: 400 });
    }

    const systemPrompt = type === "event"
      ? `You are a content formatter for "Gn0me Home", an Old School RuneScape clan. Your job is to take raw event descriptions and reformat them into engaging, well-structured Discord posts.

Rules:
- Use Discord markdown: **bold**, *italic*, __underline__, ~~strikethrough~~, \`code\`, > blockquotes
- Use emojis that fit OSRS/gaming culture (⚔️ 🗡️ 🛡️ 🏹 🧙 💰 🎯 🏆 🔥 ⭐ 📢 etc.)
- Keep the tone fun, hype, and community-focused — like a clan leader rallying the troops
- Preserve ALL factual information (dates, times, worlds, requirements, etc.)
- Structure with clear sections using emoji headers
- Keep it concise but engaging — don't add fluff, but make it exciting
- If there are requirements or mechanics, format them as clean bullet lists
- End with a call-to-action or hype line
- Do NOT add information that wasn't in the original
- Do NOT wrap in code blocks — output raw Discord markdown`
      : `You are a content formatter for "Gn0me Home", an Old School RuneScape clan. Your job is to take raw announcement text and reformat it into a polished, engaging Discord-ready post.

Rules:
- Use Discord markdown: **bold**, *italic*, __underline__, > blockquotes
- Use relevant emojis (📢 🎉 🔥 ⭐ 🏆 🗡️ ⚔️ 🛡️ etc.)
- Keep the tone warm, community-focused, and exciting
- Preserve ALL factual information
- Structure with clear sections if the content is long
- Use bullet points for lists
- Keep it concise but polished
- End with engagement — a question, call-to-action, or hype
- Do NOT add information that wasn't in the original
- Do NOT wrap in code blocks — output raw Discord markdown`;

    const userPrompt = title
      ? `Reformat this ${type ?? "announcement"} titled "${title}":\n\n${content}`
      : `Reformat this ${type ?? "announcement"}:\n\n${content}`;

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("OpenAI reformat error:", err);
      return NextResponse.json({ error: "Reformat failed" }, { status: 500 });
    }

    const data = await res.json();
    const reformatted = data.choices?.[0]?.message?.content?.trim();

    if (!reformatted) {
      return NextResponse.json({ error: "No content returned" }, { status: 500 });
    }

    return NextResponse.json({ reformatted });
  } catch (err) {
    console.error("Content reformat error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
