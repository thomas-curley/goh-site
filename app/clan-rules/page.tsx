import type { Metadata } from "next";
import { checkSectionAccess } from "@/lib/section-gate";
import { SectionUnavailable } from "@/components/layout/SectionUnavailable";
import { ClanPageShell } from "@/components/clan/ClanPageShell";
import { Card } from "@/components/ui/Card";
import { RichText } from "@/lib/render-lite-markdown";
import { getClanPage, getLegacyClanRules } from "@/lib/clan-pages";
import { CLAN_NAME } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Clan Rules",
  description: `The rules every member of ${CLAN_NAME} agrees to, in game and on Discord.`,
};

export const dynamic = "force-dynamic";

export default async function ClanRulesPage() {
  if (!(await checkSectionAccess("clan_rules"))) return <SectionUnavailable />;

  const page = await getClanPage("clan-rules");
  const rules = page ? null : await getLegacyClanRules();

  return (
    <ClanPageShell
      title="Clan Rules"
      intro={`The rules every member of ${CLAN_NAME} agrees to, in game and on Discord.`}
      page={page}
      fallback={
        rules && (rules.intro || rules.sections.length > 0) ? (
          <div className="space-y-5">
            {rules.intro && (
              <Card hover={false}>
                <RichText content={rules.intro} />
              </Card>
            )}
            {rules.sections.map((section) => (
              <Card key={section.title} hover={false}>
                <h2 className="font-display text-xl text-gnome-green mb-2">{section.title}</h2>
                <RichText content={section.content} />
              </Card>
            ))}
          </div>
        ) : (
          <Card hover={false} className="text-center py-10">
            <p className="text-bark-brown-light">The clan rules haven&apos;t been posted yet. Check back soon.</p>
          </Card>
        )
      }
    />
  );
}
