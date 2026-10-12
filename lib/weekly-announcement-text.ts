import type { GuideEntry, TipEntry, WeeklyCompetitionType } from "@/lib/weekly-announcement-templates";

export interface WeeklyAnnouncementText {
  /** 2-3 sentences opening the results post, ending with "Here are your winners:". */
  resultsIntro: string;
  /** 1-2 sentences opening the new forum thread, referencing last week. */
  forumIntro: string;
  finishedEmoji: string;
  nextEmoji: string;
  guideHeading: string | null;
  guide: GuideEntry[];
  tips: TipEntry[];
}

function fallbackText(params: { finishedName: string; nextName: string; nextType: WeeklyCompetitionType }): WeeklyAnnouncementText {
  return {
    resultsIntro: `What a week of grinding — ${params.finishedName} is in the books and you all showed up and put in the work. Here are your winners:`,
    forumIntro: `${params.finishedName} is behind us and it's time for something new. This week we're taking on ${params.nextName} — good luck, everyone!`,
    finishedEmoji: "🌿",
    nextEmoji: params.nextType === "sotw" ? "📊" : "⚔️",
    guideHeading: null,
    guide: [],
    tips: [],
  };
}

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

/**
 * Generates the dynamic parts of the weekly turnover posts (intros, emojis,
 * the per-skill/boss guide and tips) in a single OpenAI call, mirroring
 * app/api/content/reformat/route.ts's fetch pattern (no SDK). Never throws --
 * falls back to generic intros and an empty guide/tips on any failure, which
 * the admin fills in on the preview before anything is posted.
 */
export async function generateWeeklyAnnouncementText(params: {
  finishedType: WeeklyCompetitionType;
  finishedName: string;
  nextType: WeeklyCompetitionType;
  nextName: string;
}): Promise<WeeklyAnnouncementText> {
  const fallback = fallbackText(params);
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) return fallback;

  const { finishedType, finishedName, nextType, nextName } = params;
  const finishedKind = finishedType === "sotw" ? "skill" : "boss";
  const nextKind = nextType === "sotw" ? "skill" : "boss";

  const systemPrompt = `You write Discord copy for "Gn0me Home", an Old School RuneScape clan. The voice is warm, casual, a little playful, never corporate. Use accurate, current OSRS knowledge (methods, unlocks, XP rates, gear) -- if unsure of an exact number, give a safe approximate range rather than inventing precision. Use the em dash "—" where a dash is needed. Respond with strict JSON only, no markdown fences, matching exactly:
{"resultsIntro": string, "forumIntro": string, "finishedEmoji": string, "nextEmoji": string, "guideHeading": string, "guide": [{"heading": string, "body": string, "bullets": string[]}], "tips": [{"lead": string, "text": string}]}

- resultsIntro: 2-3 sentences celebrating the just-finished ${finishedKind} competition "${finishedName}", with a flavourful nod to what it involves, ending with "Here are your winners:". Example: "The serpent has been slain. What an incredible week of bossing — Hueycoatl is no joke and you all showed up and put in the work. Here are your winners:"
- forumIntro: 1-2 sentences saying "${finishedName}" is behind us and introducing this week's ${nextKind} "${nextName}". Example: "Hueycoatl is behind us and we're picking up our bows. This week we're grinding Fletching — grab your knife, your logs, and your best clicking finger."
- finishedEmoji / nextEmoji: ONE standard Unicode emoji that fits "${finishedName}" / "${nextName}" (e.g. 🪶 Fletching, 🐍 Hueycoatl, 🎣 Fishing, 🔥 Firemaking).
- guideHeading: ${nextType === "sotw" ? `"Best ${nextName} methods by level"` : `a short heading like "How to take on ${nextName}"`}.
- guide: ${nextType === "sotw"
    ? `5-7 training methods ordered by level. heading is "<lvl range> — <method>" (e.g. "55–99 — Broad Bolts (recommended for most players)"); body is 1-3 sentences; bullets (0-2, may be empty) are short facts like XP/hr or cost.`
    : `4-6 entries covering requirements/unlocks, recommended gear setups (budget and max), inventory, and the core mechanics/strategy. heading is short (e.g. "Requirements", "Budget gear", "Key mechanics"); body is 1-3 sentences; bullets (0-3, may be empty) are short specifics.`}
- tips: 4-5 tips. lead is a short bolded phrase (e.g. "Broad bolts are the meta"), text completes it in one sentence. Include one tip for Ironmen.`;

  const userPrompt = `Finished: "${finishedName}" (${finishedKind}). Next: "${nextName}" (${nextKind}).`;

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
        temperature: 0.7,
        max_tokens: 2000,
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      console.error("Weekly announcement text generation failed:", await res.text());
      return fallback;
    }

    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content;
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);

    const guide: GuideEntry[] = Array.isArray(parsed.guide)
      ? parsed.guide
          .map((g: Record<string, unknown>) => ({
            heading: str(g?.heading) ?? "",
            body: str(g?.body) ?? "",
            bullets: Array.isArray(g?.bullets) ? (g.bullets as unknown[]).map(str).filter((b): b is string => !!b) : [],
          }))
          .filter((g: GuideEntry) => g.heading)
      : [];
    const tips: TipEntry[] = Array.isArray(parsed.tips)
      ? parsed.tips
          .map((t: Record<string, unknown>) => ({ lead: str(t?.lead) ?? "", text: str(t?.text) ?? "" }))
          .filter((t: TipEntry) => t.lead && t.text)
      : [];

    return {
      resultsIntro: str(parsed.resultsIntro) ?? fallback.resultsIntro,
      forumIntro: str(parsed.forumIntro) ?? fallback.forumIntro,
      finishedEmoji: str(parsed.finishedEmoji) ?? fallback.finishedEmoji,
      nextEmoji: str(parsed.nextEmoji) ?? fallback.nextEmoji,
      guideHeading: str(parsed.guideHeading),
      guide,
      tips,
    };
  } catch (err) {
    console.error("Weekly announcement text generation error:", err);
    return fallback;
  }
}
