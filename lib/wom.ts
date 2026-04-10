import { WOMClient } from "@wise-old-man/utils";
import { WOM_GROUP_ID } from "./constants";

const womClient = new WOMClient({
  apiKey: process.env.WOM_API_KEY,
  userAgent: "Gn0meHome-Website",
});

export interface ClanMember {
  username: string;
  displayName: string;
  type: string;
  build: string;
  role: string;
  exp: number;
  ehp: number;
  ehb: number;
  ttm: number;
  registeredAt: string;
  lastChangedAt: string | null;
}

export async function getGroupMembers(): Promise<ClanMember[]> {
  try {
    const result = await womClient.groups.getGroupDetails(WOM_GROUP_ID);
    const memberships = result.memberships ?? [];

    return memberships.map((m) => ({
      username: m.player.username,
      displayName: m.player.displayName,
      type: m.player.type,
      build: m.player.build,
      role: m.role,
      exp: m.player.exp,
      ehp: m.player.ehp,
      ehb: m.player.ehb,
      ttm: m.player.ttm,
      registeredAt: m.player.registeredAt.toString(),
      lastChangedAt: m.player.lastChangedAt?.toString() ?? null,
    }));
  } catch (error) {
    console.error("Failed to fetch group members from WOM:", error);
    return [];
  }
}

export async function getGroupDetails() {
  try {
    return await womClient.groups.getGroupDetails(WOM_GROUP_ID);
  } catch (error) {
    console.error("Failed to fetch group details from WOM:", error);
    return null;
  }
}

export async function getPlayerDetails(username: string) {
  try {
    return await womClient.players.getPlayerDetails(username);
  } catch (error) {
    console.error(`Failed to fetch player ${username} from WOM:`, error);
    return null;
  }
}

export async function getGroupAchievements(limit: number = 20) {
  try {
    return await womClient.groups.getGroupAchievements(WOM_GROUP_ID, { limit });
  } catch (error) {
    console.error("Failed to fetch group achievements from WOM:", error);
    return [];
  }
}

export async function getGroupCompetitions() {
  try {
    return await womClient.groups.getGroupCompetitions(WOM_GROUP_ID);
  } catch (error) {
    console.error("Failed to fetch group competitions from WOM:", error);
    return [];
  }
}
