import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { SkillProps, BossProps, type Skill, type Boss } from "@wise-old-man/utils";
import { resolveRange } from "@/lib/activity-range";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export interface MetricRanking {
  metric: string;
  name: string;
  totalGained: number;
}

// GET - clan-wide skill XP / boss KC gained for a date range, ranked highest
// first. Backed by skill_boss_gains_daily, populated once a day by the
// snapshot cron (see app/api/snapshots/capture/route.ts) -- there's no
// single live WOM call across every skill/boss, so this is "as of the last
// capture," not real-time, unlike the rest of the Player Activity dashboard.
export async function GET(request: NextRequest) {
  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const { start, end } = resolveRange(request.nextUrl.searchParams);
  const startDate = start.toISOString().split("T")[0];
  const endDate = end.toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("skill_boss_gains_daily")
    .select("date, metric, metric_type, total_gained")
    .gte("date", startDate)
    .lte("date", endDate);

  if (error) return NextResponse.json({ error: "Failed to load skill/boss gains." }, { status: 500 });

  const rows = data ?? [];
  let lastCapturedDate: string | null = null;
  const totalsByMetric = new Map<string, { metricType: string; total: number }>();

  for (const row of rows) {
    const entry = totalsByMetric.get(row.metric) ?? { metricType: row.metric_type, total: 0 };
    entry.total += row.total_gained;
    totalsByMetric.set(row.metric, entry);
    if (!lastCapturedDate || row.date > lastCapturedDate) lastCapturedDate = row.date;
  }

  const skills: MetricRanking[] = [];
  const bosses: MetricRanking[] = [];

  for (const [metric, { metricType, total }] of totalsByMetric) {
    if (total <= 0) continue;
    if (metricType === "skill") {
      const name = SkillProps[metric as Skill]?.name ?? metric;
      skills.push({ metric, name, totalGained: total });
    } else if (metricType === "boss") {
      const name = BossProps[metric as Boss]?.name ?? metric;
      bosses.push({ metric, name, totalGained: total });
    }
  }

  skills.sort((a, b) => b.totalGained - a.totalGained);
  bosses.sort((a, b) => b.totalGained - a.totalGained);

  return NextResponse.json({ skills, bosses, asOfDate: lastCapturedDate });
}
