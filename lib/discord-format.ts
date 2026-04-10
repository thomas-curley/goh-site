/**
 * Formats an event into the Discord message style used in the Gn0me Home events channel.
 * Matches the format from the clan's existing event posts with emojis and sections.
 */

interface EventData {
  title: string;
  description?: string | null;
  event_type: string;
  host_rsn?: string | null;
  start_time: string;
  end_time?: string | null;
  world?: number | null;
  location?: string | null;
  meet_location?: string | null;
  spots?: string | null;
  signup_type?: string | null;
  voice_channel?: string | null;
  requirements?: string | null;
  requirements_list?: string | null;
  guide_text?: string | null;
  video_url?: string | null;
  prize_pool?: string | null;
}

export function formatDiscordMessage(event: EventData): string {
  const lines: string[] = [];

  // Header
  lines.push(`📢 @Event Pings **${event.title}** 📢`);
  lines.push("");

  // Description
  if (event.description) {
    lines.push(event.description);
    lines.push("");
  }

  // Event details
  lines.push(`⚔️ Event: ${event.title}`);
  if (event.host_rsn) lines.push(`🤠 Host: ${event.host_rsn}`);

  // Format date and time
  const startDate = new Date(event.start_time);
  const dateStr = startDate.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const timeStr = startDate.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });

  lines.push(`📅 Date: ${dateStr}`);
  lines.push(`⏰ Time: ${timeStr}`);

  if (event.world) lines.push(`🌍 World: ${event.world}`);
  if (event.meet_location) lines.push(`📍 Meet: ${event.meet_location}`);
  if (event.spots) lines.push(`👥 Spots: ${event.spots}`);
  if (event.signup_type) lines.push(`📝 Signup: ${event.signup_type}`);
  if (event.voice_channel) lines.push(`🔊 Voice: ${event.voice_channel}`);
  if (event.prize_pool) lines.push(`🏆 Prize Pool: ${event.prize_pool}`);

  // Requirements
  if (event.requirements_list) {
    lines.push("");
    lines.push("🎆 Recommended Requirements");
    const reqs = event.requirements_list
      .split("\n")
      .map((r) => r.trim())
      .filter(Boolean);
    for (const req of reqs) {
      lines.push(`• ${req.replace(/^[•\-*]\s*/, "")}`);
    }
  } else if (event.requirements) {
    lines.push("");
    lines.push(`🎆 Requirements: ${event.requirements}`);
  }

  // Event guide
  if (event.guide_text) {
    lines.push("");
    lines.push(`📄 Event-Specific Guide: ${event.title} Mechanics`);
    lines.push(event.guide_text);
  }

  // Video
  if (event.video_url) {
    lines.push("");
    lines.push(`Video Guide: ${event.video_url}`);
  }

  return lines.join("\n");
}

/**
 * Build the Discord Scheduled Event description (shorter, for the event sidebar).
 */
export function formatDiscordEventDescription(event: EventData): string {
  const parts: string[] = [];

  if (event.description) parts.push(event.description);
  if (event.host_rsn) parts.push(`Host: ${event.host_rsn}`);
  if (event.world) parts.push(`World: ${event.world}`);
  if (event.meet_location) parts.push(`Meet: ${event.meet_location}`);
  if (event.spots) parts.push(`Spots: ${event.spots}`);
  if (event.requirements) parts.push(`Requirements: ${event.requirements}`);
  if (event.prize_pool) parts.push(`Prize Pool: ${event.prize_pool}`);

  return parts.join("\n");
}
