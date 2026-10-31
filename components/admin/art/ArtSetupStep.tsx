"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ImageUploader } from "@/components/admin/ImageUploader";
import { Field, inputClass } from "@/components/admin/bingo/BasicsStep";
import { ChoiceCard } from "@/components/admin/quests/QuestBasicsStep";
import { COMMENTS_LABELS, type ArtContest, type CommentsVisibility } from "@/lib/art";

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ArtSetupStep({ contest, onSaved }: { contest: ArtContest; onSaved: () => Promise<void> }) {
  const [form, setForm] = useState({
    name: contest.name,
    theme: contest.theme ?? "",
    description: contest.description ?? "",
    rules: contest.rules ?? "",
    banner: contest.banner_url ? [contest.banner_url] : ([] as string[]),
    submissionsClose: toLocalInput(contest.submissions_close_at),
    votingClose: toLocalInput(contest.voting_close_at),
    submitEligibility: contest.submit_eligibility,
    entryVisibility: contest.entry_visibility,
    maxEntries: contest.max_entries_per_person,
    maxImages: contest.max_images_per_entry,
    votes: contest.votes_per_voter,
    voteEligibility: contest.vote_eligibility,
    liveResults: contest.show_live_results,
    comments: contest.comments_visibility,
    anonymous: contest.anonymous_voting,
  });
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setStatus(null);
  };

  const save = async () => {
    setSaving(true);
    const res = await fetch(`/api/admin/art/${contest.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        theme: form.theme,
        description: form.description,
        rules: form.rules,
        banner_url: form.banner[0] ?? null,
        submissions_close_at: form.submissionsClose ? new Date(form.submissionsClose).toISOString() : null,
        voting_close_at: form.votingClose ? new Date(form.votingClose).toISOString() : null,
        submit_eligibility: form.submitEligibility,
        entry_visibility: form.entryVisibility,
        max_entries_per_person: form.maxEntries,
        max_images_per_entry: form.maxImages,
        votes_per_voter: form.votes,
        vote_eligibility: form.voteEligibility,
        show_live_results: form.liveResults,
        comments_visibility: form.comments,
        anonymous_voting: form.anonymous,
      }),
    });
    const json = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) return setStatus({ ok: false, text: json.error ?? "Couldn't save." });
    setStatus({ ok: true, text: "Saved." });
    await onSaved();
  };

  const num = (k: "maxEntries" | "maxImages" | "votes", max: number) => (
    <input type="number" min={1} max={max} value={form[k]} onChange={(e) => set(k, Math.max(1, Math.min(max, Number(e.target.value) || 1)))} className={`${inputClass} sm:w-28`} />
  );

  return (
    <div className="space-y-5">
      <Card hover={false} className="space-y-4">
        <h2 className="font-display text-xl text-bark-brown">The contest</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name">
            <input value={form.name} maxLength={100} onChange={(e) => set("name", e.target.value)} className={inputClass} />
          </Field>
          <Field label="Theme (optional)" hint="Shown big on the contest page, e.g. &quot;Gnomes on holiday&quot;.">
            <input value={form.theme} maxLength={200} onChange={(e) => set("theme", e.target.value)} className={inputClass} />
          </Field>
        </div>
        <Field label="Description" hint="What it's about, prizes, anything people should know.">
          <textarea value={form.description} rows={3} maxLength={2000} onChange={(e) => set("description", e.target.value)} className={inputClass} />
        </Field>
        <Field label="Rules" hint="Entrants must tick that their piece follows these. Line breaks are kept.">
          <textarea
            value={form.rules}
            rows={5}
            maxLength={4000}
            onChange={(e) => set("rules", e.target.value)}
            className={inputClass}
            placeholder={"Your own original work only (no AI-generated images).\nKeep it clan-friendly: no NSFW or hateful content.\nOSRS-themed pieces only."}
          />
        </Field>
        <ImageUploader images={form.banner} onChange={(v) => set("banner", v)} maxImages={1} label="Banner image (optional)" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Entries close (optional)" hint="Shown as a countdown; entries stop at this time even before you move it to judging.">
            <input type="datetime-local" value={form.submissionsClose} onChange={(e) => set("submissionsClose", e.target.value)} className={inputClass} />
          </Field>
          <Field label="Voting closes (optional)" hint="Shown as a countdown; votes stop at this time.">
            <input type="datetime-local" value={form.votingClose} onChange={(e) => set("votingClose", e.target.value)} className={inputClass} />
          </Field>
        </div>
      </Card>

      <Card hover={false} className="space-y-4">
        <h2 className="font-display text-xl text-bark-brown">Entering</h2>
        <Field label="Who can enter">
          <div className="grid gap-2 sm:grid-cols-2">
            <ChoiceCard name="submit" checked={form.submitEligibility === "clan"} onPick={() => set("submitEligibility", "clan")} title="Clan members" text="Signed in with a linked, verified RSN that's in the clan." />
            <ChoiceCard name="submit" checked={form.submitEligibility === "signed_in"} onPick={() => set("submitEligibility", "signed_in")} title="Anyone signed in" text="Any Discord account, clan member or not (friends, guests)." />
          </div>
        </Field>
        <Field label="Who can see the entries" hint="Applies to every entry, in the vote and in the gallery afterwards. Changing it later updates entries already in.">
          <div className="grid gap-2 sm:grid-cols-2">
            <ChoiceCard name="entryVis" checked={form.entryVisibility === "public"} onPick={() => set("entryVisibility", "public")} title="Everyone" text="Anyone visiting the site, signed in or not." />
            <ChoiceCard name="entryVis" checked={form.entryVisibility === "clan"} onPick={() => set("entryVisibility", "clan")} title="Clan members only" text="Only signed-in clan members (and staff) can see the artwork." />
          </div>
        </Field>
        <div className="flex flex-wrap gap-6">
          <Field label="Entries per person">{num("maxEntries", 20)}</Field>
          <Field label="Images per entry" hint="Up to 20 MB each.">{num("maxImages", 10)}</Field>
        </div>
      </Card>

      <Card hover={false} className="space-y-4">
        <h2 className="font-display text-xl text-bark-brown">Voting</h2>
        <Field label="Votes per person" hint="Each vote goes to a different entry. Nobody can vote for their own.">{num("votes", 20)}</Field>
        <Field label="Who can vote">
          <div className="grid gap-2 sm:grid-cols-3">
            <ChoiceCard name="vote" checked={form.voteEligibility === "clan"} onPick={() => set("voteEligibility", "clan")} title="Clan members" text="One ballot per verified clan member's account." />
            <ChoiceCard name="vote" checked={form.voteEligibility === "signed_in"} onPick={() => set("voteEligibility", "signed_in")} title="Anyone signed in" text="One ballot per Discord account." />
            <ChoiceCard name="vote" checked={form.voteEligibility === "ip"} onPick={() => set("voteEligibility", "ip")} title="Anyone, once per IP" text="No login needed; one ballot per internet connection (a household shares one)." />
          </div>
        </Field>
        <Field label="Results while voting">
          <div className="grid gap-2 sm:grid-cols-2">
            <ChoiceCard name="live" checked={!form.liveResults} onPick={() => set("liveResults", false)} title="Hidden until the end" text="Nobody sees counts until you finish the contest, so no one piles onto the leader." />
            <ChoiceCard name="live" checked={form.liveResults} onPick={() => set("liveResults", true)} title="Live counts" text="Everyone sees the running totals while voting." />
          </div>
        </Field>
        <Field label="Voters' comments" hint="Voters can say why they picked a piece. Staff can hide any comment.">
          <select value={form.comments} onChange={(e) => set("comments", e.target.value as CommentsVisibility)} className={`${inputClass} sm:w-96 cursor-pointer`}>
            {(Object.keys(COMMENTS_LABELS) as CommentsVisibility[]).map((k) => (
              <option key={k} value={k}>
                {COMMENTS_LABELS[k]}
              </option>
            ))}
          </select>
        </Field>
        <label className="flex items-start gap-2 text-sm text-bark-brown cursor-pointer">
          <input type="checkbox" checked={form.anonymous} onChange={(e) => set("anonymous", e.target.checked)} className="accent-gnome-green mt-1" />
          <span>
            Hide artists&apos; names while voting
            <span className="block text-xs text-iron-grey">People vote on the art, not the name. Credit is shown afterwards, the way each artist chose.</span>
          </span>
        </label>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <Button disabled={saving} onClick={save}>
          {saving ? "Saving..." : "Save"}
        </Button>
        {status && <span className={`text-sm ${status.ok ? "text-gnome-green" : "text-red-accent"}`}>{status.text}</span>}
      </div>
    </div>
  );
}
