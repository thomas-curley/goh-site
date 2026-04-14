"use client";

import { useState, useEffect, useCallback } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { normalizeRole } from "@/lib/permissions";

// Rank hierarchy — higher index = higher rank
const RANK_ORDER: Record<string, number> = {
  gnome_child: 0,
  oak: 1,
  pine: 2,
  yew: 3,
  council_member: 4,
};

function getRankLevel(rank: string | null): number {
  if (!rank) return -1;
  return RANK_ORDER[normalizeRole(rank)] ?? -1;
}

interface ResetRequest {
  id: string;
  requested_rsn: string;
  reason: string;
  status: string;
  created_at: string;
  requester: {
    discord_username: string;
    discord_id: string;
  } | null;
  current_holder: {
    discord_username: string;
    discord_id: string;
    rsn: string | null;
  } | null;
}

interface LinkedProfile {
  id: string;
  discord_id: string;
  discord_username: string;
  discord_nickname: string | null;
  rsn: string | null;
  rsn_verified: boolean;
  clan_rank: string | null;
  linked_at: string | null;
}

export default function AdminRsnLinksPage() {
  const [requests, setRequests] = useState<ResetRequest[]>([]);
  const [profiles, setProfiles] = useState<LinkedProfile[]>([]);
  const [myRank, setMyRank] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionStatus, setActionStatus] = useState<string | null>(null);

  const supabase = createSupabaseBrowserClient();

  const loadData = useCallback(async () => {
    // Get current user's rank
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: myProfile } = await supabase
        .from("user_profiles")
        .select("clan_rank")
        .eq("id", user.id)
        .single();
      if (myProfile) setMyRank(myProfile.clan_rank);
    }

    // Load pending reset requests
    const { data: reqData } = await supabase
      .from("rsn_reset_requests")
      .select(`
        id, requested_rsn, reason, status, created_at,
        requester:requester_id(discord_username, discord_id),
        current_holder:current_holder_id(discord_username, discord_id, rsn)
      `)
      .eq("status", "pending")
      .order("created_at", { ascending: true });

    if (reqData) setRequests(reqData as unknown as ResetRequest[]);

    // Load ALL linked profiles (RLS now allows authenticated read of all)
    const { data: profData } = await supabase
      .from("user_profiles")
      .select("id, discord_id, discord_username, discord_nickname, rsn, rsn_verified, clan_rank, linked_at")
      .order("linked_at", { ascending: false });

    if (profData) setProfiles(profData);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleApproveReset = async (request: ResetRequest) => {
    setActionStatus("Processing...");

    const { data: holder } = await supabase
      .from("user_profiles")
      .select("id")
      .ilike("rsn", request.requested_rsn)
      .maybeSingle();

    if (holder) {
      await supabase
        .from("user_profiles")
        .update({ rsn: null, rsn_verified: false, clan_rank: null, linked_at: null })
        .eq("id", holder.id);
    }

    const { data: { user } } = await supabase.auth.getUser();
    await supabase
      .from("rsn_reset_requests")
      .update({
        status: "approved",
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", request.id);

    setActionStatus(`Approved — "${request.requested_rsn}" has been unlinked.`);
    await loadData();
  };

  const handleDenyReset = async (request: ResetRequest) => {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase
      .from("rsn_reset_requests")
      .update({
        status: "denied",
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", request.id);

    setActionStatus(`Denied request for "${request.requested_rsn}".`);
    await loadData();
  };

  const handleForceUnlink = async (profile: LinkedProfile) => {
    await supabase
      .from("user_profiles")
      .update({ rsn: null, rsn_verified: false, clan_rank: null, linked_at: null })
      .eq("id", profile.id);

    setActionStatus(`Force-unlinked "${profile.rsn}" from ${profile.discord_username}.`);
    await loadData();
  };

  const myRankLevel = getRankLevel(myRank);

  // Split profiles: linked RSNs and all users
  const linkedProfiles = profiles.filter((p) => p.rsn);
  const allUsers = profiles;

  // Filter to profiles at or below my rank (owners/council can see everyone)
  const canManage = (profile: LinkedProfile) => {
    const theirLevel = getRankLevel(profile.clan_rank);
    return theirLevel < myRankLevel || myRankLevel >= 4; // council_member sees all
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-parchment-dark border-t-gnome-green rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-display text-3xl text-gnome-green mb-6">RSN Links</h1>

      {actionStatus && (
        <div className="mb-6 p-3 rounded-md bg-gnome-green/10 border border-gnome-green/30 text-sm text-gnome-green">
          {actionStatus}
        </div>
      )}

      {/* Pending Reset Requests */}
      <section className="mb-10">
        <h2 className="font-display text-xl text-bark-brown mb-4">
          Pending Reset Requests ({requests.length})
        </h2>

        {requests.length === 0 ? (
          <Card hover={false}>
            <p className="text-sm text-iron-grey">No pending reset requests.</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {requests.map((req) => (
              <Card key={req.id} hover={false}>
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="flex-1">
                    <p className="font-mono font-bold text-bark-brown">
                      {req.requested_rsn}
                    </p>
                    <p className="text-sm text-bark-brown-light mt-1">
                      <span className="text-iron-grey">Requested by:</span>{" "}
                      {req.requester?.discord_username ?? "Unknown"}
                    </p>
                    {req.current_holder && (
                      <p className="text-sm text-bark-brown-light">
                        <span className="text-iron-grey">Currently held by:</span>{" "}
                        {req.current_holder.discord_username}
                      </p>
                    )}
                    <p className="text-sm text-bark-brown-light mt-2">
                      <span className="text-iron-grey">Reason:</span> {req.reason}
                    </p>
                    <p className="text-xs text-iron-grey mt-1">
                      {new Date(req.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button size="sm" onClick={() => handleApproveReset(req)}>
                      Approve
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => handleDenyReset(req)}>
                      Deny
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* All Linked RSNs */}
      <section className="mb-10">
        <h2 className="font-display text-xl text-bark-brown mb-4">
          Linked RSNs ({linkedProfiles.length})
        </h2>

        {linkedProfiles.length === 0 ? (
          <Card hover={false}>
            <p className="text-sm text-iron-grey">No RSNs linked yet.</p>
          </Card>
        ) : (
          <div className="space-y-2">
            {linkedProfiles.map((p) => {
              const manageable = canManage(p);
              return (
                <Card key={p.id} hover={false} className="flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="min-w-0">
                      <p className="font-mono font-bold text-gnome-green text-sm truncate">{p.rsn}</p>
                      <p className="text-xs text-iron-grey truncate">
                        {p.discord_nickname ? (
                          <><span className="text-bark-brown-light">{p.discord_nickname}</span> ({p.discord_username})</>
                        ) : (
                          p.discord_username
                        )}
                        {p.clan_rank && (
                          <span className="ml-2 capitalize">
                            · {normalizeRole(p.clan_rank).replace(/_/g, " ")}
                          </span>
                        )}
                      </p>
                    </div>
                    {p.rsn_verified && (
                      <span className="text-xs text-gnome-green-light bg-gnome-green/10 px-2 py-0.5 rounded-full shrink-0">
                        Verified
                      </span>
                    )}
                  </div>
                  {manageable && (
                    <button
                      onClick={() => handleForceUnlink(p)}
                      className="text-xs text-red-accent hover:underline cursor-pointer shrink-0 ml-2"
                    >
                      Force Unlink
                    </button>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* All Users (including those without RSN linked) */}
      <section>
        <h2 className="font-display text-xl text-bark-brown mb-4">
          All Users ({allUsers.length})
        </h2>
        <div className="space-y-2">
          {allUsers.map((p) => (
            <Card key={p.id} hover={false} className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-sm text-bark-brown font-semibold truncate">
                  {p.discord_nickname ?? p.discord_username}
                  {p.discord_nickname && (
                    <span className="text-xs text-iron-grey font-normal ml-2">({p.discord_username})</span>
                  )}
                </p>
                <p className="text-xs text-iron-grey">
                  {p.rsn ? (
                    <span>RSN: <span className="font-mono text-gnome-green">{p.rsn}</span></span>
                  ) : (
                    <span>No RSN linked</span>
                  )}
                  {p.clan_rank && (
                    <span className="ml-2 capitalize">
                      · {normalizeRole(p.clan_rank).replace(/_/g, " ")}
                    </span>
                  )}
                </p>
              </div>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
