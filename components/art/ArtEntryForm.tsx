"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { ArtUploader, type ArtImage } from "./ArtUploader";

const input =
  "w-full px-3 py-2 rounded-md border border-bark-brown-light bg-parchment text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-gnome-green";

export interface EntryDraft {
  id?: string;
  title: string;
  description: string;
  images: ArtImage[];
  credit: "rsn" | "custom" | "anonymous";
  credit_name: string;
  gallery_opt_in: boolean;
}

export const emptyEntry = (): EntryDraft => ({ title: "", description: "", images: [], credit: "rsn", credit_name: "", gallery_opt_in: false });

function Choice({ name, checked, onPick, title, text, disabled }: { name: string; checked: boolean; onPick: () => void; title: string; text: string; disabled?: boolean }) {
  return (
    <label className={`rounded-md border p-2.5 text-sm ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"} ${checked ? "border-gnome-green bg-gnome-green/10" : "border-bark-brown-light/40 hover:bg-parchment-dark/40"}`}>
      <input type="radio" name={name} className="sr-only" checked={checked} disabled={disabled} onChange={onPick} />
      <span className="font-semibold text-bark-brown">{title}</span>
      <span className="block text-xs text-iron-grey mt-0.5">{text}</span>
    </label>
  );
}

/**
 * Enter (or edit) a piece: title, description, images and the artist's own
 * choices about how they're credited and the gallery. Who can see entries is
 * set by staff for the whole contest. When `pieceLocked`, only the credit and
 * gallery choices can change (entries have closed).
 */
export function ArtEntryForm({
  contestId,
  draft: initial,
  maxImages,
  rsn,
  rules,
  clanOnly,
  pieceLocked = false,
  onDone,
  onCancel,
}: {
  contestId: string;
  draft: EntryDraft;
  maxImages: number;
  rsn: string | null;
  rules: string | null;
  clanOnly: boolean;
  pieceLocked?: boolean;
  onDone: (message: string) => void;
  onCancel?: () => void;
}) {
  const [d, setD] = useState<EntryDraft>(initial);
  const [agreed, setAgreed] = useState(!!initial.id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof EntryDraft>(k: K, v: EntryDraft[K]) => setD((x) => ({ ...x, [k]: v }));
  const editing = !!d.id;

  const submit = async () => {
    setBusy(true);
    setError(null);
    const privacy = { credit: d.credit, credit_name: d.credit_name, gallery_opt_in: d.gallery_opt_in };
    const piece = { title: d.title, description: d.description, image_paths: d.images.map((i) => i.path) };
    const res = await fetch(editing ? `/api/art/${contestId}/entries/${d.id}` : `/api/art/${contestId}/entries`, {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(pieceLocked ? privacy : { ...piece, ...privacy, agreed_rules: agreed }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(json.error ?? "Couldn't save your entry.");
    onDone(editing ? (pieceLocked ? "Your choices are saved." : "Saved. Staff will take another look before it goes to the vote.") : "Entered! Staff will check it against the rules and let you know here.");
  };

  return (
    <div className="space-y-4">
      {!pieceLocked && (
        <>
          <label className="block text-sm font-semibold text-bark-brown">
            Title
            <input value={d.title} maxLength={100} onChange={(e) => set("title", e.target.value)} className={`${input} mt-1 font-normal`} placeholder="Give your piece a name" />
          </label>
          <label className="block text-sm font-semibold text-bark-brown">
            A few words about it <span className="font-normal text-iron-grey">(optional)</span>
            <textarea value={d.description} maxLength={1000} rows={3} onChange={(e) => set("description", e.target.value)} className={`${input} mt-1 font-normal`} placeholder="What inspired it, what you made it with..." />
          </label>
          <div>
            <p className="text-sm font-semibold text-bark-brown mb-1">Your artwork</p>
            <ArtUploader contestId={contestId} images={d.images} onChange={(v) => set("images", v)} max={maxImages} />
          </div>
        </>
      )}

      <p className="text-xs text-iron-grey">
        <span className="font-semibold text-bark-brown">Who can see it: </span>
        {clanOnly ? "only signed-in clan members (and staff), set by staff for this contest." : "everyone visiting the site, set by staff for this contest."}
      </p>

      <fieldset className="space-y-1.5">
        <legend className="text-sm font-semibold text-bark-brown mb-1">How you&apos;re credited</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          <Choice name="credit" checked={d.credit === "rsn"} onPick={() => set("credit", "rsn")} disabled={!rsn} title="My RSN" text={rsn ? `Shown as ${rsn}.` : "Link your RSN on your Account page to use this."} />
          <Choice name="credit" checked={d.credit === "custom"} onPick={() => set("credit", "custom")} title="A name I choose" text="An artist name or nickname." />
          <Choice name="credit" checked={d.credit === "anonymous"} onPick={() => set("credit", "anonymous")} title="Anonymous" text="No name shown anywhere (staff still know it's yours)." />
        </div>
        {d.credit === "custom" && <input value={d.credit_name} maxLength={40} onChange={(e) => set("credit_name", e.target.value)} className={`${input} sm:w-72`} placeholder="Name to show" aria-label="Name to show" />}
      </fieldset>

      <label className="flex items-start gap-2 text-sm text-bark-brown cursor-pointer">
        <input type="checkbox" checked={d.gallery_opt_in} onChange={(e) => set("gallery_opt_in", e.target.checked)} className="accent-gnome-green mt-1" />
        <span>
          Show it in the Gn0mie Gallery after the contest
          <span className="block text-xs text-iron-grey">
            The gallery shows off members&apos; work for good. {clanOnly ? "Entries in this contest are clan-only, so only clan members will see it there." : "Anyone can see it there."} You can change this later.
          </span>
        </span>
      </label>

      {!pieceLocked && !editing && (
        <label className="flex items-start gap-2 text-sm text-bark-brown cursor-pointer">
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="accent-gnome-green mt-1" />
          <span>
            This is my own work and it follows the contest rules{rules ? " above" : ""}.
          </span>
        </label>
      )}

      {error && <p className="text-sm text-red-accent">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <Button disabled={busy || (!pieceLocked && (!d.title.trim() || d.images.length === 0 || (!editing && !agreed)))} onClick={submit}>
          {busy ? "Saving..." : editing ? "Save changes" : "Submit my entry"}
        </Button>
        {onCancel && (
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}
