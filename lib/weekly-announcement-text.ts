import type { WeeklyCompetitionType } from "@/lib/weekly-announcement-templates";

export interface WeeklyAnnouncementText {
  resultsFlavourLine: string;
  newWeekIntro: string;
  forumIntro: string;
}

const FALLBACK_TEXT: WeeklyAnnouncementText = {
  resultsFlavourLine: "Another great week in the books!",
  newWeekIntro: "A new week, a new challenge -- let's see what the clan can do.",
  forumIntro: "Last week wrapped up with some great grinding from the whole clan. Time to see what everyone's made of this week!",
};

const TYPE_NOUN: Record<WeeklyCompetitionType, string> = {
  sotw: "skilling",
  botw: "boss-killing",
};

/**
 * Generates the three short dynamic snippets the weekly announcement
 * templates need (results flavour line, new-week intro, forum intro) in a
 * single OpenAI call, mirroring app/api/content/reformat/route.ts's exact
 * fetch pattern (gpt-4o-mini, no SDK). Never throws -- falls back to a
 * generic static set on any failure (missing key, request error, bad JSON)
 * so a flaky/absent AI call never blocks the actual announcement, which is
 * the part that matters.
 */
export async function generateWeeklyAnnouncementText(params: {
  finishedType: WeeklyCompetitionType;
  finishedName: string;
  nextType: WeeklyCompetitionType;
  nextName: string;
}): Promise<WeeklyAnnouncementText> {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) return FALLBACK_TEXT;

  const { finishedType, finishedName, nextType, nextName } = params;

  const systemPrompt = `You write short, casual Discord copy for "Gn0me Home", an Old School RuneScape clan. The voice is warm, casual, gnome-themed, and never corporate. Keep every line brief -- these are single lines or short paragraphs inserted into a templated Discord post, not full posts themselves. Respond with strict JSON only, no markdown, matching exactly this shape: {"resultsFlavourLine": string, "newWeekIntro": string, "forumIntro": string}.

- resultsFlavourLine: ONE sentence, casual, about the just-finished ${TYPE_NOUN[finishedType]} competition "${finishedName}" wrapping up (e.g. reference what that skill/boss involves).
- newWeekIntro: ONE casual sentence introducing the new ${TYPE_NOUN[nextType]} competition "${nextName}" that's about to start.
- forumIntro: 2-3 casual sentences, referencing the previous week ("${finishedName}") wrapping up and introducing this week's "${nextName}" competition.`;

  const userPrompt = `Finished competition: "${finishedName}" (${finishedType === "sotw" ? "skill" : "boss"}). Next competition: "${nextName}" (${nextType === "sotw" ? "skill" : "boss"}).`;

  try {
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
        temperature: 0.8,
        max_tokens: 300,
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      console.error("Weekly announcement text generation failed:", await res.text());
      return FALLBACK_TEXT;
    }

    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content;
    if (!raw) return FALLBACK_TEXT;

    const parsed = JSON.parse(raw);
    if (
      typeof parsed.resultsFlavourLine !== "string" ||
      typeof parsed.newWeekIntro !== "string" ||
      typeof parsed.forumIntro !== "string"
    ) {
      return FALLBACK_TEXT;
    }

    return parsed as WeeklyAnnouncementText;
  } catch (err) {
    console.error("Weekly announcement text generation error:", err);
    return FALLBACK_TEXT;
  }
}
