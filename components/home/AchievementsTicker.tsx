interface Achievement {
  playerId: number;
  name: string;
  metric: string;
  threshold: number;
  createdAt: Date;
  player?: {
    displayName: string;
  };
}

interface AchievementsTickerProps {
  achievements: Achievement[];
}

function formatMetric(metric: string): string {
  return metric.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatThreshold(threshold: number): string {
  if (threshold >= 1_000_000_000) return `${(threshold / 1_000_000_000).toFixed(0)}B`;
  if (threshold >= 1_000_000) return `${(threshold / 1_000_000).toFixed(0)}M`;
  if (threshold >= 1_000) return `${(threshold / 1_000).toFixed(0)}K`;
  return threshold.toLocaleString();
}

export function AchievementsTicker({ achievements }: AchievementsTickerProps) {
  if (achievements.length === 0) return null;

  return (
    <div className="overflow-hidden bg-bark-brown/10 border-y border-bark-brown-light/30">
      <div className="flex animate-[scroll_30s_linear_infinite] gap-8 py-3 px-4 whitespace-nowrap">
        {[...achievements, ...achievements].map((a, i) => (
          <span key={`${a.playerId}-${a.name}-${i}`} className="text-sm text-bark-brown-light inline-flex items-center gap-2">
            <span className="text-gold-display">★</span>
            <span className="font-mono font-bold text-gnome-green">
              {a.player?.displayName ?? "Unknown"}
            </span>
            <span>
              reached {formatThreshold(a.threshold)} {formatMetric(a.metric)}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
