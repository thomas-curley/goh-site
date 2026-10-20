"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ChannelSelector } from "@/components/admin/ChannelSelector";
import { inputClass } from "@/components/admin/bingo/BasicsStep";
import type { FeedEvent } from "@/lib/clan-feed";
import type { FeedOutcome } from "@/lib/clan-feed-server";

interface Channel {
  channel_id: string;
  label: string | null;
}
interface Logged {
  id: string;
  channel_id: string;
  author_name: string | null;
  posted_at: string;
  text: string;
  image_urls: string[];
  events: FeedEvent[];
  outcomes: FeedOutcome[];
}
type Filter = "all" | "counted" | "understood" | "not understood";
interface DropTrackerState {
  configured: boolean;
  lastPolledAt: string | null;
  lastResult: { players?: number; newDrops?: number; counted?: number; skipped?: string; error?: string; at?: string } | null;
}

const KIND_LABEL: Record<FeedEvent["kind"], string> = { drop: "Drop", collection_log: "Collection log", pet: "Pet", quest: "Quest" };
const GOOD = new Set(["counted", "queued"]);

function when(iso: string) {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function EventChips({ events }: { events: FeedEvent[] }) {
  return (
    <>
      {events.map((e, i) => (
        <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-parchment-dark text-bark-brown">
          {KIND_LABEL[e.kind]}: <span className="font-mono">{e.rsn}</span> · {e.name}
          {e.quantity > 1 && ` x ${e.quantity}`}
        </span>
      ))}
    </>
  );
}

function Outcomes({ outcomes }: { outcomes: FeedOutcome[] }) {
  if (outcomes.length === 0) return <p className="text-xs text-iron-grey">Nothing live this could count for.</p>;
  return (
    <ul className="space-y-0.5">
      {outcomes.map((o, i) => (
        <li key={i} className="text-xs">
          <span className={`font-semibold ${GOOD.has(o.result) ? "text-gnome-green" : o.result === "already counted" || o.result === "duplicate" ? "text-iron-grey" : "text-gold"}`}>
            {o.result === "queued" ? "Sent for review" : o.result.charAt(0).toUpperCase() + o.result.slice(1)}
          </span>
          <span className="text-bark-brown-light">
            {" "}
            · {o.target === "bingo" ? "Bingo" : "Quest event"} {o.eventName}
            {o.tileTitle && ` › ${o.tileTitle}`}
          </span>
        </li>
      ))}
    </ul>
  );
}

export default function ClanFeedPage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [messages, setMessages] = useState<Logged[] | null>(null);
  const [adding, setAdding] = useState("");
  const [saved, setSaved] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [test, setTest] = useState({ content: "", title: "", description: "" });
  const [testResult, setTestResult] = useState<{ events: FeedEvent[]; outcomes: FeedOutcome[] } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [names, setNames] = useState<Map<string, string>>(new Map([["droptracker-api", "DropTracker API"]]));
  const [droptracker, setDroptracker] = useState<DropTrackerState | null>(null);
  const [pollNote, setPollNote] = useState<{ ok: boolean; text: string } | null>(null);

  const load = () =>
    fetch("/api/admin/clan-feed")
      .then((r) => r.json())
      .then((d) => {
        setChannels(d.channels ?? []);
        setMessages(d.messages ?? []);
        setDroptracker(d.droptracker ?? null);
      })
      .catch(() => setMessages([]));

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/clan-feed")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        setChannels(d.channels ?? []);
        setMessages(d.messages ?? []);
        setDroptracker(d.droptracker ?? null);
      })
      .catch(() => !cancelled && setMessages([]));
    fetch("/api/discord/channels")
      .then((r) => r.json())
      .then((d: { groups?: { channels: { id: string; name: string }[] }[] }) => !cancelled && setNames(new Map([["droptracker-api", "DropTracker API"], ...(d.groups ?? []).flatMap((g) => g.channels.map((c) => [c.id, c.name] as const))])))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const saveChannels = async (next: Channel[]) => {
    setChannels(next);
    const res = await fetch("/api/admin/clan-feed", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ channels: next }) });
    setSaved(res.ok ? "Saved. The bot picks up changes within 5 minutes." : "Couldn't save.");
  };

  const runTest = async () => {
    setBusy("test");
    const res = await fetch("/api/admin/clan-feed", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "test", ...test }) });
    setTestResult(await res.json().catch(() => null));
    setBusy(null);
  };

  const pollNow = async () => {
    setBusy("poll");
    setPollNote(null);
    const res = await fetch("/api/admin/clan-feed", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "poll" }) });
    const json = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) setPollNote({ ok: false, text: json.error ?? "Couldn't reach DropTracker." });
    else if (json.result?.error) setPollNote({ ok: false, text: json.result.error });
    else setPollNote({ ok: true, text: `Connected to DropTracker group ${json.groupId}. Read ${json.result.players} players: ${json.result.newDrops} new drops, ${json.result.counted} counted for a bingo.` });
    await load();
  };

  const replay = async (id: string) => {
    setBusy(id);
    await fetch("/api/admin/clan-feed", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "replay", id }) });
    await load();
    setBusy(null);
  };

  const shown = (messages ?? []).filter((m) =>
    filter === "all" ? true : filter === "counted" ? m.outcomes.some((o) => GOOD.has(o.result)) : filter === "understood" ? m.events.length > 0 : m.events.length === 0
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-gnome-green">Clan Feed</h1>
        <p className="text-bark-brown-light max-w-3xl">
          The bot reads the Discord channels you pick here, where DropTracker or a clan-chat forwarder posts drops, collection log items, pets and quest completions. Matching drops tick bingo item tiles, and quest completions count for quest event players, even for people who don&apos;t use WikiSync or Discord. Only posts from bots and webhooks are read, never what members type.
        </p>
      </div>

      <Card hover={false} className="space-y-3">
        <h2 className="font-display text-xl text-bark-brown">Channels to read</h2>
        {channels.length === 0 && <p className="text-sm text-iron-grey">None yet. Add your DropTracker channel (and any clan-chat feed).</p>}
        <ul className="space-y-1.5">
          {channels.map((c) => (
            <li key={c.channel_id} className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-mono text-bark-brown">#{names.get(c.channel_id) ?? c.label ?? c.channel_id}</span>
              <button type="button" onClick={() => saveChannels(channels.filter((x) => x.channel_id !== c.channel_id))} className="text-xs text-red-accent hover:underline cursor-pointer">
                Remove
              </button>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-end gap-2">
          <div className="w-full sm:w-80">
            <ChannelSelector value={adding} onChange={setAdding} label="Add a channel" allowBlank blankLabel="Pick a channel..." excludeForums />
          </div>
          <Button
            size="sm"
            disabled={!adding || channels.some((c) => c.channel_id === adding)}
            onClick={() => {
              saveChannels([...channels, { channel_id: adding, label: names.get(adding) ?? null }]);
              setAdding("");
            }}
          >
            Add
          </Button>
        </div>
        {saved && <p className="text-xs text-gnome-green">{saved}</p>}
        <p className="text-xs text-iron-grey">
          Bingo: drops count for proof tiles whose item list includes the item, for the player&apos;s team. Each bingo chooses whether they count straight away or go to the review queue (Basics step). Quest events: completions count for players in a live event, by RSN.
        </p>
      </Card>

      <Card hover={false} className="space-y-3">
        <h2 className="font-display text-xl text-bark-brown">DropTracker API</h2>
        {!droptracker?.configured ? (
          <p className="text-sm text-iron-grey">
            Not connected. Add the group&apos;s API key in Vercel as <span className="font-mono">DROPTRACKER_API_KEY</span> (and redeploy). Then drops are read straight from DropTracker every 5 minutes while a bingo is live, so nothing is missed if the bot was offline. Quests still come from the Discord post, since the API doesn&apos;t list them.
          </p>
        ) : (
          <>
            <p className="text-sm text-bark-brown-light">
              Connected. Drops are read every 5 minutes while a bingo is live, and each one is counted once even if the Discord post is read too.
            </p>
            <p className="text-xs text-iron-grey">
              {droptracker.lastPolledAt ? `Last read ${when(droptracker.lastPolledAt)}` : "Not read yet"}
              {droptracker.lastResult?.error
                ? ` · last try failed: ${droptracker.lastResult.error}`
                : droptracker.lastResult?.skipped
                  ? ` · skipped: ${droptracker.lastResult.skipped}`
                  : droptracker.lastResult?.players != null
                    ? ` · ${droptracker.lastResult.players} players, ${droptracker.lastResult.newDrops ?? 0} new drops, ${droptracker.lastResult.counted ?? 0} counted`
                    : ""}
            </p>
            <Button size="sm" variant="ghost" disabled={busy === "poll"} onClick={pollNow}>
              {busy === "poll" ? "Reading..." : "Check now"}
            </Button>
          </>
        )}
        {pollNote && <p className={`text-xs ${pollNote.ok ? "text-gnome-green" : "text-red-accent"}`}>{pollNote.text}</p>}
      </Card>

      <Card hover={false} className="space-y-3">
        <h2 className="font-display text-xl text-bark-brown">Try a message</h2>
        <p className="text-sm text-iron-grey">Paste a post to see what the bot would understand and what it would count for right now. Nothing is counted.</p>
        <textarea value={test.content} onChange={(e) => setTest({ ...test, content: e.target.value })} rows={2} className={inputClass} placeholder="control348 received a drop:   or   Spoon Gnome has completed a quest: Monkey Madness II" />
        <div className="grid gap-2 sm:grid-cols-2">
          <input value={test.title} onChange={(e) => setTest({ ...test, title: e.target.value })} className={inputClass} placeholder="Embed title (DropTracker's item name), optional" />
          <input value={test.description} onChange={(e) => setTest({ ...test, description: e.target.value })} className={inputClass} placeholder="Embed text, optional" />
        </div>
        <Button size="sm" disabled={busy === "test" || (!test.content.trim() && !test.title.trim())} onClick={runTest}>
          {busy === "test" ? "Reading..." : "Read it"}
        </Button>
        {testResult && (
          <div className="rounded-md bg-parchment-dark/40 p-3 space-y-2">
            {testResult.events.length === 0 ? (
              <p className="text-sm text-gold">Not understood. Send this example to whoever looks after the site so the reader can learn it.</p>
            ) : (
              <>
                <div className="flex flex-wrap gap-1.5">
                  <EventChips events={testResult.events} />
                </div>
                <Outcomes outcomes={testResult.outcomes} />
              </>
            )}
          </div>
        )}
      </Card>

      <Card hover={false} className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-xl text-bark-brown">What the bot has read</h2>
          <div className="flex flex-wrap gap-1">
            {(["all", "counted", "understood", "not understood"] as const).map((f) => (
              <button key={f} type="button" onClick={() => setFilter(f)} className={`px-2.5 py-1 rounded-full text-xs cursor-pointer capitalize ${filter === f ? "bg-gnome-green text-text-light font-semibold" : "bg-parchment-dark text-bark-brown"}`}>
                {f}
              </button>
            ))}
          </div>
        </div>
        <p className="text-xs text-iron-grey">The last 30 days. &quot;Run again&quot; re-checks a post, for example after adding the player to the event.</p>
        {messages === null ? (
          <p className="text-sm text-iron-grey">Loading...</p>
        ) : shown.length === 0 ? (
          <p className="text-sm text-iron-grey">Nothing here yet.</p>
        ) : (
          <ul className="divide-y divide-bark-brown-light/20">
            {shown.map((m) => (
              <li key={m.id} className="py-3 space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-iron-grey">
                    {when(m.posted_at)} · {m.author_name ?? "unknown"} · #{names.get(m.channel_id) ?? channels.find((c) => c.channel_id === m.channel_id)?.label ?? m.channel_id}
                  </p>
                  {m.events.length > 0 && (
                    <button type="button" disabled={busy === m.id} onClick={() => replay(m.id)} className="text-xs text-gnome-green hover:underline cursor-pointer">
                      {busy === m.id ? "Checking..." : "Run again"}
                    </button>
                  )}
                </div>
                {m.events.length > 0 ? (
                  <>
                    <div className="flex flex-wrap gap-1.5">
                      <EventChips events={m.events} />
                    </div>
                    <Outcomes outcomes={m.outcomes} />
                  </>
                ) : (
                  <p className="text-xs text-gold">Not understood</p>
                )}
                <details className="text-xs">
                  <summary className="cursor-pointer text-iron-grey">Original post</summary>
                  <pre className="mt-1 whitespace-pre-wrap font-mono text-[11px] text-bark-brown-light bg-parchment-dark/30 rounded p-2">{m.text}</pre>
                </details>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
