import { Card } from "@/components/ui/Card";

interface BossInfoBoxProps {
  name: string;
  image?: string;
  combatLevel?: number;
  hitpoints?: number;
  maxHit?: number;
  attackStyles?: string[];
  recommendedStats?: string;
  recommendedGear?: string;
  notes?: string;
  wikiUrl?: string;
}

export function BossInfoBox({
  name,
  combatLevel,
  hitpoints,
  maxHit,
  attackStyles,
  recommendedStats,
  recommendedGear,
  notes,
  wikiUrl,
}: BossInfoBoxProps) {
  return (
    <Card hover={false} className="border-l-4 border-l-gnome-green">
      <h3 className="font-display text-xl text-gnome-green mb-3">{name}</h3>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        {combatLevel && (
          <div>
            <p className="text-xs text-iron-grey uppercase tracking-wide">Combat</p>
            <p className="font-stats font-bold text-bark-brown">{combatLevel}</p>
          </div>
        )}
        {hitpoints && (
          <div>
            <p className="text-xs text-iron-grey uppercase tracking-wide">Hitpoints</p>
            <p className="font-stats font-bold text-bark-brown">{hitpoints.toLocaleString()}</p>
          </div>
        )}
        {maxHit && (
          <div>
            <p className="text-xs text-iron-grey uppercase tracking-wide">Max Hit</p>
            <p className="font-stats font-bold text-red-accent">{maxHit}</p>
          </div>
        )}
        {attackStyles && (
          <div>
            <p className="text-xs text-iron-grey uppercase tracking-wide">Attack Styles</p>
            <p className="text-sm text-bark-brown">{attackStyles.join(", ")}</p>
          </div>
        )}
      </div>

      {recommendedStats && (
        <div className="mb-3">
          <p className="text-xs text-iron-grey uppercase tracking-wide mb-1">Recommended Stats</p>
          <p className="text-sm text-bark-brown-light">{recommendedStats}</p>
        </div>
      )}

      {recommendedGear && (
        <div className="mb-3">
          <p className="text-xs text-iron-grey uppercase tracking-wide mb-1">Recommended Gear</p>
          <p className="text-sm text-bark-brown-light">{recommendedGear}</p>
        </div>
      )}

      {notes && (
        <div className="mb-3">
          <p className="text-xs text-iron-grey uppercase tracking-wide mb-1">Clan Tips</p>
          <p className="text-sm text-bark-brown-light italic">{notes}</p>
        </div>
      )}

      {wikiUrl && (
        <a
          href={wikiUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-gnome-green hover:text-gnome-green-light underline"
        >
          Full OSRS Wiki Guide &rarr;
        </a>
      )}
    </Card>
  );
}
