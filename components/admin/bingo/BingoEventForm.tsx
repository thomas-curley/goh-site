"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { SKILLS, BOSSES, ACTIVITIES, COMPUTED_METRICS, MetricProps } from "@wise-old-man/utils";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ImageUploader } from "@/components/admin/ImageUploader";
import { GRID_SIZES } from "@/lib/bingo";

const inputClass = "w-full px-3 py-2 rounded-md border border-bark-brown-light bg-parchment text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-gnome-green";

const METRIC_GROUPS: { label: string; metrics: string[] }[] = [
  { label: "Skills", metrics: [...SKILLS].filter((m) => m !== "overall") },
  { label: "Bosses", metrics: [...BOSSES] },
  { label: "Activities", metrics: [...ACTIVITIES] },
  { label: "Other", metrics: [...COMPUTED_METRICS] },
];

function metricLabel(metric: string): string {
  return (MetricProps as Record<string, { name: string }>)[metric]?.name ?? metric.replace(/_/g, " ");
}

interface TeamDraft {
  id?: string; // present when editing an existing team
  name: string;
  color: string;
  members: string[];
}

interface TileDraft {
  id?: string; // present when editing an existing tile
  position: number;
  taskTitle: string;
  taskDescription: string;
  trackingType: "wom" | "manual";
  womSource: "existing" | "auto-create";
  womCompetitionInput: string; // raw "id or URL" text for "existing"
  womMetric: string;
  womTargetValue: string;
}

function emptyTeam(n: number): TeamDraft {
  return { name: `Team ${n}`, color: "", members: [] };
}

function emptyTile(position: number): TileDraft {
  return {
    position,
    taskTitle: "",
    taskDescription: "",
    trackingType: "manual",
    womSource: "auto-create",
    womCompetitionInput: "",
    womMetric: SKILLS[1], // skip "overall"
    womTargetValue: "",
  };
}

/** Pulls a numeric WOM competition id out of either a bare id or a wiseoldman.net URL. */
function parseWomCompetitionId(input: string): number | null {
  const match = input.match(/(\d+)\s*$/);
  return match ? Number(match[1]) : null;
}

export interface BingoEventFormInitial {
  event: { id: string; name: string; description: string | null; banner_url: string | null; starts_at: string | null; ends_at: string | null; grid_size: number; status: "draft" | "active" | "completed" };
  teams: { id: string; name: string; color: string | null; members: { rsn: string }[] }[];
  tiles: { id: string; position: number; task_title: string; task_description: string | null; tracking_type: "wom" | "manual"; wom_target_value: number | null }[];
}

export function BingoEventForm({ initial }: { initial?: BingoEventFormInitial }) {
  const router = useRouter();
  const mode = initial ? "edit" : "create";

  const [name, setName] = useState(initial?.event.name ?? "");
  const [description, setDescription] = useState(initial?.event.description ?? "");
  const [bannerUrl, setBannerUrl] = useState<string[]>(initial?.event.banner_url ? [initial.event.banner_url] : []);
  const [startsAt, setStartsAt] = useState(initial?.event.starts_at?.slice(0, 16) ?? "");
  const [endsAt, setEndsAt] = useState(initial?.event.ends_at?.slice(0, 16) ?? "");
  const [gridSize, setGridSize] = useState(initial?.event.grid_size ?? 5);

  const [teams, setTeams] = useState<TeamDraft[]>(
    initial?.teams.map((t) => ({ id: t.id, name: t.name, color: t.color ?? "", members: t.members.map((m) => m.rsn) })) ?? [emptyTeam(1), emptyTeam(2)]
  );

  const [tiles, setTiles] = useState<TileDraft[]>(() => {
    if (initial) {
      return initial.tiles.map((t) => ({
        id: t.id,
        position: t.position,
        taskTitle: t.task_title,
        taskDescription: t.task_description ?? "",
        trackingType: t.tracking_type,
        womSource: "existing",
        womCompetitionInput: "",
        womMetric: SKILLS[1],
        womTargetValue: t.wom_target_value != null ? String(t.wom_target_value) : "",
      }));
    }
    return Array.from({ length: gridSize * gridSize }, (_, i) => emptyTile(i));
  });

  const [selectedTile, setSelectedTile] = useState(0);
  const [clanMembers, setClanMembers] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [tileResults, setTileResults] = useState<{ position: number; taskTitle: string; ok: boolean; error?: string }[]>([]);

  useEffect(() => {
    fetch("/api/clan-members")
      .then((res) => res.json())
      .then((data) => setClanMembers((data.members ?? []).map((m: { displayName: string }) => m.displayName)))
      .catch(() => setClanMembers([]));
  }, []);

  // Only regenerate the tile grid when the size actually changes in create
  // mode -- resizing an existing board is out of scope for edit mode.
  const resizeGrid = (size: number) => {
    setGridSize(size);
    setTiles((prev) => {
      const next = Array.from({ length: size * size }, (_, i) => prev[i] ?? emptyTile(i));
      return next.map((t, i) => ({ ...t, position: i }));
    });
    setSelectedTile(0);
  };

  const updateTeam = (i: number, patch: Partial<TeamDraft>) => setTeams((prev) => prev.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
  const addTeam = () => setTeams((prev) => [...prev, emptyTeam(prev.length + 1)]);
  const removeTeam = (i: number) => setTeams((prev) => prev.filter((_, idx) => idx !== i));
  const addMember = (ti: number, rsn: string) => {
    if (!rsn.trim() || teams[ti].members.includes(rsn)) return;
    updateTeam(ti, { members: [...teams[ti].members, rsn] });
  };
  const removeMember = (ti: number, rsn: string) => updateTeam(ti, { members: teams[ti].members.filter((m) => m !== rsn) });

  const updateTile = (i: number, patch: Partial<TileDraft>) => setTiles((prev) => prev.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));

  const tile = tiles[selectedTile];
  const tilesFilled = tiles.filter((t) => t.taskTitle.trim()).length;

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    setStatus(null);
    setTileResults([]);

    if (mode === "create") {
      const body = {
        name,
        description,
        bannerUrl: bannerUrl[0] ?? null,
        startsAt: startsAt ? new Date(startsAt).toISOString() : null,
        endsAt: endsAt ? new Date(endsAt).toISOString() : null,
        gridSize,
        teams: teams.map((t) => ({ name: t.name.trim(), color: t.color || null, members: t.members })),
        tiles: tiles.map((t) => ({
          position: t.position,
          taskTitle: t.taskTitle.trim(),
          taskDescription: t.taskDescription.trim() || null,
          trackingType: t.trackingType,
          womSource: t.womSource,
          womCompetitionWomId: t.trackingType === "wom" && t.womSource === "existing" ? parseWomCompetitionId(t.womCompetitionInput) ?? undefined : undefined,
          womMetric: t.trackingType === "wom" && t.womSource === "auto-create" ? t.womMetric : undefined,
          womTargetValue: t.womTargetValue ? Number(t.womTargetValue) : null,
        })),
      };

      const res = await fetch("/api/admin/bingo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setTileResults(data.tileResults ?? []);
        const failedCount = (data.tileResults ?? []).filter((r: { ok: boolean }) => !r.ok).length;
        setStatus(failedCount > 0 ? `Board created, but ${failedCount} tile(s) need attention below.` : "Board created!");
        if (failedCount === 0) router.push(`/admin/bingo/${data.eventId}/edit`);
      } else {
        setError(data.error ?? "Failed to create the board.");
      }
    } else {
      const body = {
        name,
        description,
        bannerUrl: bannerUrl[0] ?? null,
        startsAt: startsAt ? new Date(startsAt).toISOString() : null,
        endsAt: endsAt ? new Date(endsAt).toISOString() : null,
        teams: teams.map((t) => ({ id: t.id, name: t.name.trim(), members: t.members })),
        tiles: tiles.map((t) => ({ id: t.id, taskTitle: t.taskTitle.trim(), taskDescription: t.taskDescription.trim() || null, womTargetValue: t.womTargetValue ? Number(t.womTargetValue) : null })),
      };
      const res = await fetch(`/api/admin/bingo/${initial!.event.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setStatus(data.warning ?? "Saved.");
      else setError(data.error ?? "Failed to save.");
    }

    setSubmitting(false);
  };

  const canSubmit = !!name.trim() && teams.length >= 2 && teams.every((t) => t.name.trim()) && tilesFilled === tiles.length && !submitting;

  return (
    <div className="space-y-6">
      {error && <div className="p-3 rounded-md bg-red-accent/10 border border-red-accent/30 text-sm text-red-accent">{error}</div>}
      {status && <div className="p-3 rounded-md bg-gnome-green/10 border border-gnome-green/30 text-sm text-gnome-green">{status}</div>}
      {tileResults.some((r) => !r.ok) && (
        <div className="p-3 rounded-md bg-red-accent/10 border border-red-accent/30 text-sm text-red-accent space-y-1">
          {tileResults.filter((r) => !r.ok).map((r) => (
            <p key={r.position}><span className="font-semibold">{r.taskTitle || `Tile ${r.position + 1}`}:</span> {r.error}</p>
          ))}
        </div>
      )}

      <Card hover={false}>
        <h2 className="font-display text-xl text-bark-brown mb-4">Basic Info</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-bark-brown mb-1">Event Name *</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} placeholder="e.g. Winter PvM Bingo" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-bark-brown mb-1">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={inputClass} placeholder="Describe the rules and rewards..." />
          </div>
          <ImageUploader images={bannerUrl} onChange={setBannerUrl} maxImages={1} label="Banner Image (optional)" />
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <label className="block text-sm font-semibold text-bark-brown mb-1">Starts (optional)</label>
              <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className={inputClass} />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-semibold text-bark-brown mb-1">Ends (optional)</label>
              <input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className={inputClass} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-bark-brown mb-1">Grid Size</label>
            <select
              value={gridSize}
              onChange={(e) => resizeGrid(Number(e.target.value))}
              disabled={mode === "edit"}
              className={`${inputClass} cursor-pointer sm:w-48 disabled:opacity-60 disabled:cursor-not-allowed`}
            >
              {GRID_SIZES.map((n) => (
                <option key={n} value={n}>{n}x{n} ({n * n} tiles)</option>
              ))}
            </select>
            {mode === "edit" && <p className="text-xs text-iron-grey mt-1">Grid size can&apos;t change after a board is created.</p>}
          </div>
        </div>
      </Card>

      <Card hover={false}>
        <h2 className="font-display text-xl text-bark-brown mb-1">Teams</h2>
        <p className="text-xs text-iron-grey mb-4">Every team shares the same tiles -- each completes them independently.</p>
        <div className="space-y-4">
          {teams.map((team, ti) => (
            <TeamEditor
              key={team.id ?? ti}
              team={team}
              index={ti}
              removable={teams.length > 2}
              clanMembers={clanMembers}
              onUpdate={(patch) => updateTeam(ti, patch)}
              onRemove={() => removeTeam(ti)}
              onAddMember={(rsn) => addMember(ti, rsn)}
              onRemoveMember={(rsn) => removeMember(ti, rsn)}
            />
          ))}
          <button type="button" onClick={addTeam} className="text-sm text-gnome-green hover:underline cursor-pointer">+ Add team</button>
        </div>
      </Card>

      <Card hover={false}>
        <h2 className="font-display text-xl text-bark-brown mb-1">Tiles</h2>
        <p className="text-xs text-iron-grey mb-4">{tilesFilled}/{tiles.length} tiles have a task. Click a cell to edit it.</p>

        <div
          className="grid gap-1.5 mb-6"
          style={{ gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))` }}
        >
          {tiles.map((t, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setSelectedTile(i)}
              title={t.taskTitle || `Tile ${i + 1}`}
              className={`aspect-square rounded-md border-2 text-[10px] sm:text-xs font-semibold p-1 flex items-center justify-center text-center overflow-hidden transition-colors cursor-pointer ${
                selectedTile === i
                  ? "border-gnome-green bg-gnome-green/15 text-gnome-green"
                  : t.taskTitle.trim()
                    ? "border-bark-brown-light bg-parchment-dark/40 text-bark-brown"
                    : "border-dashed border-bark-brown-light/60 text-iron-grey"
              }`}
            >
              {t.taskTitle.trim() ? t.taskTitle : i + 1}
            </button>
          ))}
        </div>

        {tile && (
          <div className="border-t border-parchment-dark pt-4 space-y-4">
            <p className="text-xs font-semibold text-bark-brown uppercase tracking-wide">Tile {selectedTile + 1}</p>
            <div>
              <label className="block text-sm font-semibold text-bark-brown mb-1">Task Title *</label>
              <input type="text" value={tile.taskTitle} onChange={(e) => updateTile(selectedTile, { taskTitle: e.target.value })} className={inputClass} placeholder="e.g. 500 Vorkath KC" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-bark-brown mb-1">Task Description</label>
              <textarea value={tile.taskDescription} onChange={(e) => updateTile(selectedTile, { taskDescription: e.target.value })} rows={2} className={inputClass} />
            </div>

            <div>
              <label className="block text-sm font-semibold text-bark-brown mb-2">Tracking</label>
              <div className="flex gap-4">
                {(["manual", "wom"] as const).map((tt) => (
                  <label key={tt} className={`flex items-center gap-2 text-sm text-bark-brown ${mode === "edit" ? "opacity-60" : "cursor-pointer"}`}>
                    <input
                      type="radio"
                      checked={tile.trackingType === tt}
                      disabled={mode === "edit"}
                      onChange={() => updateTile(selectedTile, { trackingType: tt })}
                      className="accent-gnome-green"
                    />
                    {tt === "manual" ? "Manual (screenshot + admin review)" : "Wise Old Man competition"}
                  </label>
                ))}
              </div>
              {mode === "edit" && <p className="text-xs text-iron-grey mt-1">Tracking type can&apos;t change after a tile is created.</p>}
            </div>

            {tile.trackingType === "wom" && (
              <div className="space-y-3 pl-1 border-l-2 border-gnome-green/30">
                {mode === "create" && (
                  <div className="flex gap-4">
                    {(["auto-create", "existing"] as const).map((src) => (
                      <label key={src} className="flex items-center gap-2 text-sm text-bark-brown cursor-pointer">
                        <input type="radio" checked={tile.womSource === src} onChange={() => updateTile(selectedTile, { womSource: src })} className="accent-gnome-green" />
                        {src === "auto-create" ? "Create a new competition" : "Link an existing tracked competition"}
                      </label>
                    ))}
                  </div>
                )}
                {mode === "create" && tile.womSource === "auto-create" && (
                  <div>
                    <label className="block text-sm font-semibold text-bark-brown mb-1">Metric</label>
                    <select value={tile.womMetric} onChange={(e) => updateTile(selectedTile, { womMetric: e.target.value })} className={`${inputClass} cursor-pointer`}>
                      {METRIC_GROUPS.map((group) => (
                        <optgroup key={group.label} label={group.label}>
                          {group.metrics.map((m) => <option key={m} value={m}>{metricLabel(m)}</option>)}
                        </optgroup>
                      ))}
                    </select>
                  </div>
                )}
                {mode === "create" && tile.womSource === "existing" && (
                  <div>
                    <label className="block text-sm font-semibold text-bark-brown mb-1">WOM Competition ID or URL</label>
                    <input
                      type="text"
                      value={tile.womCompetitionInput}
                      onChange={(e) => updateTile(selectedTile, { womCompetitionInput: e.target.value })}
                      placeholder="https://wiseoldman.net/competitions/12345"
                      className={inputClass}
                    />
                    <p className="text-xs text-iron-grey mt-1">Must already be tracked under Admin &gt; WOM Competitions.</p>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-semibold text-bark-brown mb-1">Target Value (gained to count as complete)</label>
                  <input
                    type="number"
                    value={tile.womTargetValue}
                    onChange={(e) => updateTile(selectedTile, { womTargetValue: e.target.value })}
                    className={`${inputClass} sm:w-48`}
                    placeholder="e.g. 500"
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </Card>

      <Button size="lg" className="w-full" disabled={!canSubmit} onClick={handleSubmit}>
        {submitting ? "Saving..." : mode === "create" ? "Create Event" : "Save Changes"}
      </Button>
    </div>
  );
}

function TeamEditor({
  team, index, removable, clanMembers, onUpdate, onRemove, onAddMember, onRemoveMember,
}: {
  team: TeamDraft;
  index: number;
  removable: boolean;
  clanMembers: string[];
  onUpdate: (patch: Partial<TeamDraft>) => void;
  onRemove: () => void;
  onAddMember: (rsn: string) => void;
  onRemoveMember: (rsn: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = q ? clanMembers.filter((m) => m.toLowerCase().includes(q)) : clanMembers;
    return matches.filter((m) => !team.members.includes(m)).slice(0, 15);
  }, [query, clanMembers, team.members]);

  return (
    <Card hover={false} className="bg-parchment-dark/30">
      <div className="flex gap-2 mb-3">
        <input type="text" value={team.name} onChange={(e) => onUpdate({ name: e.target.value })} placeholder={`Team ${index + 1} name`} className={inputClass} />
        {removable && <button type="button" onClick={onRemove} className="text-red-accent text-xs cursor-pointer shrink-0 px-2">✕ Remove</button>}
      </div>

      <div className="flex flex-wrap gap-1.5 mb-2">
        {team.members.map((rsn) => (
          <span key={rsn} className="inline-flex items-center gap-1 text-xs font-mono px-2 py-1 rounded bg-gnome-green/10 text-gnome-green">
            {rsn}
            <button type="button" onClick={() => onRemoveMember(rsn)} className="text-red-accent cursor-pointer">✕</button>
          </span>
        ))}
      </div>

      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setShowSuggestions(true); }}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          placeholder="Add member by RSN..."
          autoComplete="off"
          className={`${inputClass} font-mono`}
        />
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute left-0 right-0 mt-1 card-wood py-1 z-10 shadow-xl max-h-48 overflow-y-auto">
            {suggestions.map((name) => (
              <button
                key={name}
                type="button"
                onMouseDown={() => { onAddMember(name); setQuery(""); }}
                className="block w-full text-left px-3 py-1.5 text-sm font-mono text-bark-brown hover:bg-parchment-dark transition-colors cursor-pointer"
              >
                {name}
              </button>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
