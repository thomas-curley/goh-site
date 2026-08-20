"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ImageUploader } from "@/components/admin/ImageUploader";
import { statusLabel, type BingoTileCompletionStatus } from "@/lib/bingo";

interface Team {
  id: string;
  name: string;
  color: string | null;
  members: string[];
}

interface Tile {
  id: string;
  position: number;
  task_title: string;
  task_description: string | null;
  tracking_type: "wom" | "manual";
  wom_target_value: number | null;
}

interface Completion {
  tile_id: string;
  team_id: string;
  status: BingoTileCompletionStatus;
  wom_progress_value: number | null;
  image_urls: string[] | null;
  submitted_at: string | null;
  review_notes: string | null;
}

interface BoardData {
  event: { id: string; name: string; description: string | null; banner_url: string | null; starts_at: string | null; ends_at: string | null; grid_size: number; status: string };
  teams: Team[];
  tiles: Tile[];
  completions: Completion[];
  viewerTeamId: string | null;
}

const STATUS_STYLE: Record<BingoTileCompletionStatus, string> = {
  incomplete: "border-bark-brown-light bg-parchment-dark/40 text-bark-brown",
  pending_review: "border-gold bg-gold/15 text-gold",
  completed: "border-gnome-green bg-gnome-green/15 text-gnome-green",
};

export function BingoBoard({ eventId }: { eventId: string }) {
  const [data, setData] = useState<BoardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [selectedTileId, setSelectedTileId] = useState<string | null>(null);
  const [submitImages, setSubmitImages] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/bingo/${eventId}`);
    if (!res.ok) { setNotFound(true); setLoading(false); return; }
    const json: BoardData = await res.json();
    setData(json);
    setSelectedTeamId((prev) => prev ?? json.viewerTeamId ?? json.teams[0]?.id ?? null);
    setLoading(false);
  }, [eventId]);

  useEffect(() => { load(); }, [load]);

  const completionByKey = useMemo(() => {
    const map = new Map<string, Completion>();
    (data?.completions ?? []).forEach((c) => map.set(`${c.tile_id}:${c.team_id}`, c));
    return map;
  }, [data]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-8 h-8 border-4 border-parchment-dark border-t-gnome-green rounded-full animate-spin" />
      </div>
    );
  }

  if (notFound || !data) {
    return <p className="text-bark-brown-light text-center py-16">Bingo event not found.</p>;
  }

  const { event, teams, tiles } = data;
  const selectedTeam = teams.find((t) => t.id === selectedTeamId) ?? null;
  const completedCount = selectedTeam ? tiles.filter((t) => completionByKey.get(`${t.id}:${selectedTeam.id}`)?.status === "completed").length : 0;
  const hasBingo = selectedTeam && completedCount === tiles.length;
  const selectedTile = tiles.find((t) => t.id === selectedTileId) ?? null;
  const selectedCompletion = selectedTile && selectedTeam ? completionByKey.get(`${selectedTile.id}:${selectedTeam.id}`) : undefined;
  const isViewerTeamSelected = selectedTeamId === data.viewerTeamId && data.viewerTeamId !== null;

  const submit = async () => {
    if (!selectedTile || submitImages.length === 0) return;
    setSubmitting(true);
    setSubmitError(null);
    const res = await fetch(`/api/bingo/${eventId}/tiles/${selectedTile.id}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageUrls: submitImages }),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok) {
      setSubmitImages([]);
      await load();
    } else {
      setSubmitError(json.error ?? "Failed to submit.");
    }
    setSubmitting(false);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      {event.banner_url && <img src={event.banner_url} alt="" className="w-full h-48 object-cover rounded-lg mb-6" />}
      <h1 className="font-display text-4xl text-gnome-green mb-2">{event.name}</h1>
      {event.description && <p className="text-bark-brown-light mb-6">{event.description}</p>}

      <div className="flex flex-wrap gap-2 mb-6">
        {teams.map((team) => (
          <Button
            key={team.id}
            size="sm"
            variant={selectedTeamId === team.id ? "primary" : "ghost"}
            onClick={() => { setSelectedTeamId(team.id); setSelectedTileId(null); }}
          >
            {team.name}{team.id === data.viewerTeamId ? " (You)" : ""}
          </Button>
        ))}
      </div>

      {hasBingo && (
        <div className="mb-6 p-4 rounded-md bg-gold/15 border border-gold text-center">
          <p className="font-display text-2xl text-gold">🎉 BINGO! {selectedTeam!.name} completed the board!</p>
        </div>
      )}

      <p className="text-sm text-iron-grey mb-3">{completedCount}/{tiles.length} tiles completed</p>

      <div className="grid gap-2 mb-6" style={{ gridTemplateColumns: `repeat(${event.grid_size}, minmax(0, 1fr))` }}>
        {tiles.map((tile) => {
          const completion = selectedTeam ? completionByKey.get(`${tile.id}:${selectedTeam.id}`) : undefined;
          const status = completion?.status ?? "incomplete";
          return (
            <button
              key={tile.id}
              type="button"
              onClick={() => setSelectedTileId(tile.id)}
              title={tile.task_title}
              className={`aspect-square rounded-md border-2 text-[10px] sm:text-xs font-semibold p-1.5 flex items-center justify-center text-center overflow-hidden transition-colors cursor-pointer ${STATUS_STYLE[status]} ${selectedTileId === tile.id ? "ring-2 ring-gnome-green" : ""}`}
            >
              {tile.task_title}
            </button>
          );
        })}
      </div>

      {selectedTile && (
        <Card hover={false}>
          <h3 className="font-display text-lg text-bark-brown mb-1">{selectedTile.task_title}</h3>
          {selectedTile.task_description && <p className="text-sm text-bark-brown-light mb-3">{selectedTile.task_description}</p>}

          <p className="text-xs text-iron-grey mb-3">
            Status: <span className="font-semibold">{statusLabel(selectedCompletion?.status ?? "incomplete")}</span>
            {selectedTile.tracking_type === "wom" && selectedTile.wom_target_value != null && (
              <span> · Progress: {selectedCompletion?.wom_progress_value ?? 0} / {selectedTile.wom_target_value}</span>
            )}
          </p>

          {selectedCompletion?.review_notes && (
            <p className="text-xs text-bark-brown-light mb-3">Admin notes: {selectedCompletion.review_notes}</p>
          )}

          {(selectedCompletion?.image_urls?.length ?? 0) > 0 && (
            <div className="grid grid-cols-3 gap-2 mb-3">
              {selectedCompletion!.image_urls!.map((url, i) => (
                <img key={i} src={url} alt="" className="w-full h-24 object-cover rounded-md border border-bark-brown-light" />
              ))}
            </div>
          )}

          {selectedTile.tracking_type === "manual" && isViewerTeamSelected && selectedCompletion?.status !== "completed" && selectedCompletion?.status !== "pending_review" && (
            <div className="border-t border-parchment-dark pt-3 mt-1">
              <p className="text-sm font-semibold text-bark-brown mb-2">Submit proof</p>
              {submitError && <p className="text-xs text-red-accent mb-2">{submitError}</p>}
              <ImageUploader images={submitImages} onChange={setSubmitImages} maxImages={3} label="Screenshots" />
              <Button size="sm" className="mt-3" disabled={submitting || submitImages.length === 0} onClick={submit}>
                {submitting ? "Submitting..." : "Submit for Review"}
              </Button>
            </div>
          )}

          {selectedTile.tracking_type === "manual" && isViewerTeamSelected && selectedCompletion?.status === "pending_review" && (
            <p className="text-xs text-gold">Awaiting admin review.</p>
          )}
        </Card>
      )}
    </div>
  );
}
