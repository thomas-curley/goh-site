"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ChannelSelector, loadChannelList } from "@/components/admin/ChannelSelector";

interface Settings {
  enabled: boolean;
  categoryId: string | null;
  nameTemplate: string;
  defaultMaxPeople: number;
  maxRoomSize: number;
  creatorRoleIds: string[];
  staffRoleIds: string[];
  roomsPerPerson: number;
  cleanupMinutes: number;
  deleteWhenEmpty: boolean;
  emptyGraceMinutes: number;
  logChannelId: string | null;
  updatedAt: string | null;
}

interface Role {
  id: string;
  name: string;
  color: string | null;
}

const inputClass =
  "w-full px-3 py-2 rounded-md border border-bark-brown-light bg-parchment text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-gnome-green";

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-bark-brown mb-1">{label}</label>
      {children}
      {hint && <p className="text-xs text-iron-grey mt-1">{hint}</p>}
    </div>
  );
}

function RolePicker({ roles, value, onChange, emptyLabel }: { roles: Role[]; value: string[]; onChange: (ids: string[]) => void; emptyLabel: string }) {
  const [filter, setFilter] = useState("");
  const shown = roles.filter((r) => r.name.toLowerCase().includes(filter.trim().toLowerCase()));
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  return (
    <div className="space-y-2">
      <p className="text-xs text-bark-brown-light">
        {value.length === 0 ? emptyLabel : `Selected: ${value.map((id) => roles.find((r) => r.id === id)?.name ?? id).join(", ")}`}
      </p>
      <input type="search" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter roles..." aria-label="Filter roles" className={inputClass} />
      <div className="max-h-48 overflow-y-auto rounded-md border border-bark-brown-light/40 p-2 grid gap-1 sm:grid-cols-2">
        {shown.map((r) => (
          <label key={r.id} className="flex items-center gap-2 text-sm text-bark-brown cursor-pointer">
            <input type="checkbox" checked={value.includes(r.id)} onChange={() => toggle(r.id)} className="accent-gnome-green" />
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: r.color ?? "#99aab5" }} />
            <span className="truncate">{r.name}</span>
          </label>
        ))}
        {shown.length === 0 && <p className="text-xs text-iron-grey">No roles match.</p>}
      </div>
    </div>
  );
}

export default function VoiceRoomsSettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/voice-rooms")
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (cancelled) return;
        if (ok) setSettings(d.settings);
        else setError(d.error ?? "Couldn't load the settings.");
      })
      .catch(() => !cancelled && setError("Couldn't load the settings."));
    fetch("/api/discord/roles")
      .then((r) => (r.ok ? r.json() : { roles: [] }))
      .then((d) => !cancelled && setRoles(d.roles ?? []))
      .catch(() => undefined);
    loadChannelList().then((list) => !cancelled && setCategories(list?.categories ?? []));
    return () => {
      cancelled = true;
    };
  }, []);

  const preview = useMemo(() => (settings?.nameTemplate || "🔇 {name}'s room").replaceAll("{name}", "Gnomeo"), [settings?.nameTemplate]);

  if (!settings) {
    return <p className="text-sm text-iron-grey">{error ?? "Loading..."}</p>;
  }

  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings({ ...settings, [key]: value });
    setStatus(null);
  };
  const num = (key: keyof Settings) => (e: React.ChangeEvent<HTMLInputElement>) => set(key, Number(e.target.value) as never);

  const save = async () => {
    setSaving(true);
    setError(null);
    const res = await fetch("/api/admin/voice-rooms", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ settings }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (res.ok) {
      setSettings(data.settings);
      setStatus("Saved. The bot picks up changes within a couple of minutes.");
    } else setError(data.error ?? "Failed to save.");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-gnome-green mb-1">Voice Rooms</h1>
        <p className="text-bark-brown-light">
          Settings for the Discord bot&apos;s <code className="font-mono">/vc</code> rooms: temporary voice channels where
          everyone joins muted except the creator, staff, and people they let speak.
        </p>
      </div>

      <Card hover={false} className="space-y-4">
        <label className="flex items-center gap-2 text-sm text-bark-brown cursor-pointer">
          <input type="checkbox" checked={settings.enabled} onChange={(e) => set("enabled", e.target.checked)} className="accent-gnome-green" />
          Members can create rooms with <code className="font-mono">/vc</code>
        </label>

        <Field label="Category for new rooms" hint="Rooms already open stay where they are if you change this.">
          {categories === null ? (
            <p className="text-xs text-iron-grey">Loading categories...</p>
          ) : (
            <select value={settings.categoryId ?? ""} onChange={(e) => set("categoryId", e.target.value || null)} className={`${inputClass} cursor-pointer`}>
              <option value="">&quot;Temp Rooms&quot; (created automatically)</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
        </Field>

        <Field label="Room name" hint={`{name} becomes the creator's server name. Preview: ${preview}`}>
          <input value={settings.nameTemplate} maxLength={90} onChange={(e) => set("nameTemplate", e.target.value)} className={inputClass} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Default max people" hint="Used when the creator doesn't give a number.">
            <input type="number" min={1} max={99} value={settings.defaultMaxPeople} onChange={num("defaultMaxPeople")} className={inputClass} />
          </Field>
          <Field label="Largest room allowed" hint="Up to 99.">
            <input type="number" min={1} max={99} value={settings.maxRoomSize} onChange={num("maxRoomSize")} className={inputClass} />
          </Field>
          <Field label="Rooms per person" hint="Staff aren't limited.">
            <input type="number" min={1} max={10} value={settings.roomsPerPerson} onChange={num("roomsPerPerson")} className={inputClass} />
          </Field>
        </div>
      </Card>

      <Card hover={false} className="space-y-4">
        <h2 className="font-display text-xl text-bark-brown">Who can do what</h2>
        <Field label="Who can create rooms">
          <RolePicker roles={roles} value={settings.creatorRoleIds} onChange={(ids) => set("creatorRoleIds", ids)} emptyLabel="Everyone in the server." />
        </Field>
        <Field label="Staff roles" hint="Staff can always speak, and can manage or close any room.">
          <RolePicker
            roles={roles}
            value={settings.staffRoleIds}
            onChange={(ids) => set("staffRoleIds", ids)}
            emptyLabel="Roles named Council, Oak, Pine, Yew, Silver Key or Gold Key (plus anyone who can manage channels)."
          />
        </Field>
      </Card>

      <Card hover={false} className="space-y-4">
        <h2 className="font-display text-xl text-bark-brown">Cleanup and logging</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Check for empty rooms every (minutes)" hint="5 to 1440.">
            <input type="number" min={5} max={1440} value={settings.cleanupMinutes} onChange={num("cleanupMinutes")} className={inputClass} />
          </Field>
          <Field label="Grace period for new rooms (minutes)" hint="A room younger than this isn't removed, so it isn't deleted before its creator joins.">
            <input type="number" min={0} max={120} value={settings.emptyGraceMinutes} onChange={num("emptyGraceMinutes")} className={inputClass} />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm text-bark-brown cursor-pointer">
          <input type="checkbox" checked={settings.deleteWhenEmpty} onChange={(e) => set("deleteWhenEmpty", e.target.checked)} className="accent-gnome-green" />
          Also delete a room as soon as the last person leaves
        </label>
        <ChannelSelector
          label="Log channel"
          value={settings.logChannelId ?? ""}
          onChange={(id) => set("logChannelId", id || null)}
          allowBlank
          blankLabel="No log"
          excludeForums
        />
        <p className="text-xs text-iron-grey -mt-2">Posts when rooms are created and closed. Leave blank for no log.</p>
      </Card>

      {error && <p className="text-sm text-red-accent">{error}</p>}
      {status && <p className="text-sm text-gnome-green">{status}</p>}
      <div className="flex items-center gap-3">
        <Button disabled={saving} onClick={save}>
          {saving ? "Saving..." : "Save settings"}
        </Button>
        {settings.updatedAt && <span className="text-xs text-iron-grey">Last saved {new Date(settings.updatedAt).toLocaleString()}</span>}
      </div>
    </div>
  );
}
