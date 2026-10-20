"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ImageUploader } from "@/components/admin/ImageUploader";
import { GRID_SIZES } from "@/lib/bingo";
import type { AdminBingo } from "./BingoBuilder";

export const inputClass =
  "w-full px-3 py-2 rounded-md border border-bark-brown-light bg-parchment text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-gnome-green";

/** ISO time -> the value a datetime-local input wants, in the viewer's timezone. */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function Field({ label, hint, children }: { label: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-bark-brown mb-1">{label}</label>
      {children}
      {hint && <p className="text-xs text-iron-grey mt-1">{hint}</p>}
    </div>
  );
}

export function BasicsStep({ data, onSaved, onNext }: { data: AdminBingo; onSaved: () => Promise<void>; onNext: () => void }) {
  const { event } = data;
  const [form, setForm] = useState({
    name: event.name,
    description: event.description ?? "",
    rules: event.rules ?? "",
    banner: event.banner_url ? [event.banner_url] : ([] as string[]),
    starts: toLocalInput(event.starts_at),
    ends: toLocalInput(event.ends_at),
    grid: event.grid_size,
    winRule: event.win_rule,
    lineBonus: event.line_bonus,
    blackoutBonus: event.blackout_bonus,
    hideOthers: event.hide_other_teams,
    feedMode: event.feed_mode ?? "approve",
  });
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setStatus(null);
  };

  const shrinking = form.grid < event.grid_size && data.tiles.some((t) => t.position % event.grid_size >= form.grid || Math.floor(t.position / event.grid_size) >= form.grid);

  const save = async (andNext = false) => {
    setSaving(true);
    const res = await fetch(`/api/admin/bingo/${event.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        description: form.description,
        rules: form.rules,
        banner_url: form.banner[0] ?? null,
        starts_at: form.starts ? new Date(form.starts).toISOString() : null,
        ends_at: form.ends ? new Date(form.ends).toISOString() : null,
        grid_size: form.grid,
        win_rule: form.winRule,
        line_bonus: form.lineBonus,
        blackout_bonus: form.blackoutBonus,
        hide_other_teams: form.hideOthers,
        feed_mode: form.feedMode,
      }),
    });
    const json = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) return setStatus({ ok: false, text: json.error ?? "Couldn't save." });
    await onSaved();
    setStatus({ ok: true, text: "Saved." });
    if (andNext) onNext();
  };

  return (
    <div className="space-y-5">
      <Card hover={false} className="space-y-4">
        <Field label="Name">
          <input value={form.name} maxLength={100} onChange={(e) => set("name", e.target.value)} className={inputClass} />
        </Field>
        <Field label="Short description" hint="Shown on the bingo list and at the top of the board.">
          <textarea value={form.description} rows={2} maxLength={2000} onChange={(e) => set("description", e.target.value)} className={inputClass} placeholder="Four teams, one week, 25 tiles of PvM and skilling." />
        </Field>
        <Field label="Rules" hint="Shown on the board's Rules tab. Line breaks are kept.">
          <textarea
            value={form.rules}
            rows={5}
            maxLength={4000}
            onChange={(e) => set("rules", e.target.value)}
            className={inputClass}
            placeholder={"Drops must happen during the event.\nScreenshot the loot message with your name visible.\nAlts on your team's list count."}
          />
        </Field>
        <ImageUploader images={form.banner} onChange={(v) => set("banner", v)} maxImages={1} label="Banner image (optional)" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Starts" hint="The board stays hidden from members until then.">
            <input type="datetime-local" value={form.starts} onChange={(e) => set("starts", e.target.value)} className={inputClass} />
          </Field>
          <Field label="Ends" hint="Tracked progress stops counting at this time.">
            <input type="datetime-local" value={form.ends} onChange={(e) => set("ends", e.target.value)} className={inputClass} />
          </Field>
        </div>
      </Card>

      <Card hover={false} className="space-y-4">
        <h2 className="font-display text-xl text-bark-brown">Board and scoring</h2>
        <Field
          label="Board size"
          hint={
            event.status !== "draft"
              ? "The size is fixed once a board leaves draft."
              : shrinking
                ? "Tiles outside the smaller board will be removed when you save."
                : "Tiles keep their row and column if you change this."
          }
        >
          <div className="flex flex-wrap gap-2">
            {GRID_SIZES.map((n) => (
              <button
                key={n}
                type="button"
                disabled={event.status !== "draft"}
                onClick={() => set("grid", n)}
                className={`px-3 py-1.5 rounded-md border text-sm cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 ${
                  form.grid === n ? "border-gnome-green bg-gnome-green text-text-light font-semibold" : "border-bark-brown-light/50 text-bark-brown hover:bg-parchment-dark"
                }`}
              >
                {n}×{n}
                <span className="opacity-70"> · {n * n}</span>
              </button>
            ))}
          </div>
        </Field>
        <Field label="How the winner is decided">
          <div className="grid gap-2 sm:grid-cols-2">
            {(
              [
                ["points", "Most points", "Tile points plus line and blackout bonuses. Highest score when the event ends wins."],
                ["blackout", "First to blackout", "The first team to finish every tile wins. Points break ties if nobody finishes."],
              ] as const
            ).map(([value, title, text]) => (
              <label
                key={value}
                className={`rounded-md border p-3 cursor-pointer text-sm ${form.winRule === value ? "border-gnome-green bg-gnome-green/10" : "border-bark-brown-light/40 hover:bg-parchment-dark/40"}`}
              >
                <input type="radio" name="winRule" className="sr-only" checked={form.winRule === value} onChange={() => set("winRule", value)} />
                <span className="font-semibold text-bark-brown">{title}</span>
                <span className="block text-xs text-iron-grey mt-0.5">{text}</span>
              </label>
            ))}
          </div>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Bonus per finished line" hint="Each full row, column or diagonal.">
            <input type="number" min={0} max={1000} value={form.lineBonus} onChange={(e) => set("lineBonus", Number(e.target.value))} className={`${inputClass} sm:w-32`} />
          </Field>
          <Field label="Blackout bonus" hint="For finishing the whole board.">
            <input type="number" min={0} max={1000} value={form.blackoutBonus} onChange={(e) => set("blackoutBonus", Number(e.target.value))} className={`${inputClass} sm:w-32`} />
          </Field>
        </div>
        <label className="flex items-start gap-2 text-sm text-bark-brown cursor-pointer">
          <input type="checkbox" checked={form.hideOthers} onChange={(e) => set("hideOthers", e.target.checked)} className="accent-gnome-green mt-1" />
          <span>
            Hide other teams&apos; boards until the end
            <span className="block text-xs text-iron-grey">Teams still see the standings (points only). Every board is revealed when the bingo finishes.</span>
          </span>
        </label>
        <Field
          label="Drops from the clan feed"
          hint="When DropTracker (or another feed in Admin › Clan Feed) posts a drop that's on a tile's item list, for a player on a team."
        >
          <div className="grid gap-2 sm:grid-cols-3">
            {(
              [
                ["approve", "Count them", "The tile ticks off straight away. Staff can still undo it in the review queue."],
                ["review", "Send for review", "They land in the review queue with the drop's details, like a screenshot would."],
                ["off", "Ignore them", "Only screenshots and tracked tiles count."],
              ] as const
            ).map(([value, title, text]) => (
              <label
                key={value}
                className={`rounded-md border p-3 cursor-pointer text-sm ${form.feedMode === value ? "border-gnome-green bg-gnome-green/10" : "border-bark-brown-light/40 hover:bg-parchment-dark/40"}`}
              >
                <input type="radio" name="feedMode" className="sr-only" checked={form.feedMode === value} onChange={() => set("feedMode", value)} />
                <span className="font-semibold text-bark-brown">{title}</span>
                <span className="block text-xs text-iron-grey mt-0.5">{text}</span>
              </label>
            ))}
          </div>
        </Field>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <Button disabled={saving} onClick={() => save(true)}>
          {saving ? "Saving..." : "Save and go to the board"}
        </Button>
        <Button variant="ghost" disabled={saving} onClick={() => save(false)}>
          Save
        </Button>
        {status && <span className={`text-sm ${status.ok ? "text-gnome-green" : "text-red-accent"}`}>{status.text}</span>}
      </div>
    </div>
  );
}
