"use client";

import { useState, useEffect, useCallback } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

interface CommandSpec {
  type: "text" | "embed" | "random" | "wom" | "activity";
  ephemeral: boolean;
  allowed_channels: string[];
  allowed_roles: string[];
  response: {
    content: string;
    title: string;
    color: string;
    footer: string;
    activity_period: string; // "week" | "month" | "all"
    activity_limit: number;
    responses: string[];
    wom_type: string;
    wom_period: string;
  };
}

interface CustomCommand {
  id: string;
  name: string;
  description: string;
  spec: CommandSpec;
  enabled: boolean;
  created_by: string | null;
  created_at: string;
}

const EMPTY_SPEC: CommandSpec = {
  type: "text",
  ephemeral: false,
  allowed_channels: [],
  allowed_roles: [],
  response: {
    content: "",
    title: "",
    color: "#2D5016",
    footer: "Gn0me Home",
    responses: [""],
    wom_type: "stats",
    wom_period: "week",
    activity_period: "all",
    activity_limit: 20,
  },
};

const inputClass = "w-full px-3 py-2 rounded-md border border-bark-brown-light bg-parchment text-text-primary focus:outline-none focus:ring-2 focus:ring-gnome-green";
const labelClass = "block text-sm font-semibold text-bark-brown mb-1";

export default function AdminCommandsPage() {
  const [commands, setCommands] = useState<CustomCommand[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);

  // Wizard state
  const [step, setStep] = useState(0); // 0=list, 1=basic, 2=type, 3=config, 4=restrictions, 5=preview
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [spec, setSpec] = useState<CommandSpec>({ ...EMPTY_SPEC, response: { ...EMPTY_SPEC.response } });
  const [editingId, setEditingId] = useState<string | null>(null);

  const supabase = createSupabaseBrowserClient();

  const loadCommands = useCallback(async () => {
    const { data } = await supabase
      .from("custom_commands")
      .select("*")
      .order("name");
    if (data) setCommands(data);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { loadCommands(); }, [loadCommands]);

  const resetWizard = () => {
    setStep(0);
    setName("");
    setDescription("");
    setSpec({ ...EMPTY_SPEC, response: { ...EMPTY_SPEC.response, responses: [""] } });
    setEditingId(null);
  };

  const handleSave = async () => {
    setStatus(null);

    const { data: { user } } = await supabase.auth.getUser();
    let author = "Admin";
    if (user) {
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("rsn, discord_username")
        .eq("id", user.id)
        .single();
      author = profile?.rsn ?? profile?.discord_username ?? "Admin";
    }

    const res = await fetch("/api/commands", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name, description, spec, created_by: author,
        guild_id: process.env.NEXT_PUBLIC_DISCORD_GUILD_ID,
      }),
    });

    if (res.ok) {
      setStatus(`Command "/${name}" saved! Run \`/command reload\` in Discord to activate.`);
      resetWizard();
      await loadCommands();
    } else {
      const err = await res.json();
      setStatus(`Error: ${err.error}`);
    }
  };

  const handleDelete = async (cmd: CustomCommand) => {
    if (!confirm(`Delete "/${cmd.name}"?`)) return;
    await fetch(`/api/commands/${cmd.name}`, { method: "DELETE" });
    setStatus(`Deleted "/${cmd.name}".`);
    await loadCommands();
  };

  const handleEdit = (cmd: CustomCommand) => {
    setName(cmd.name);
    setDescription(cmd.description);
    setSpec(cmd.spec);
    setEditingId(cmd.id);
    setStep(1);
  };

  const handleToggle = async (cmd: CustomCommand) => {
    await fetch(`/api/commands/${cmd.name}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !cmd.enabled }),
    });
    await loadCommands();
  };

  // Preview builder
  const preview = buildPreview(name, spec);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-parchment-dark border-t-gnome-green rounded-full animate-spin" />
      </div>
    );
  }

  // Step 0: Command list
  if (step === 0) {
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-display text-3xl text-gnome-green">Custom Commands</h1>
          <Button onClick={() => setStep(1)}>+ Create Command</Button>
        </div>

        {status && (
          <div className="mb-4 p-3 rounded-md bg-gnome-green/10 border border-gnome-green/30 text-sm text-gnome-green">{status}</div>
        )}

        {commands.length === 0 ? (
          <Card hover={false}><p className="text-sm text-iron-grey">No custom commands yet.</p></Card>
        ) : (
          <div className="space-y-2">
            {commands.map((cmd) => (
              <Card key={cmd.id} hover={false} className={!cmd.enabled ? "opacity-60" : ""}>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono font-bold text-gnome-green">/{cmd.name}</span>
                      <span className="text-xs text-iron-grey capitalize">{cmd.spec.type}</span>
                      {!cmd.enabled && <span className="text-xs bg-iron-grey/20 text-iron-grey px-1.5 py-0.5 rounded">Disabled</span>}
                    </div>
                    <p className="text-xs text-bark-brown-light truncate">{cmd.description}</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => handleEdit(cmd)} className="text-xs text-gnome-green hover:underline cursor-pointer">Edit</button>
                    <button onClick={() => handleToggle(cmd)} className="text-xs text-iron-grey hover:underline cursor-pointer">{cmd.enabled ? "Disable" : "Enable"}</button>
                    <button onClick={() => handleDelete(cmd)} className="text-xs text-red-accent hover:underline cursor-pointer">Delete</button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-3xl text-gnome-green">
          {editingId ? "Edit Command" : "Create Command"}
        </h1>
        <Button variant="ghost" onClick={resetWizard}>Cancel</Button>
      </div>

      {/* Progress */}
      <div className="flex gap-1 mb-6">
        {["Basic Info", "Response Type", "Configure", "Restrictions", "Preview"].map((label, i) => (
          <div
            key={label}
            className={`flex-1 h-2 rounded-full ${i + 1 <= step ? "bg-gnome-green" : "bg-parchment-dark"}`}
            title={label}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        <div>
          {/* Step 1: Basic Info */}
          {step === 1 && (
            <Card hover={false}>
              <h2 className="font-display text-lg text-bark-brown mb-4">Step 1: Basic Info</h2>
              <div className="space-y-4">
                <div>
                  <label className={labelClass}>Command Name *</label>
                  <div className="flex items-center gap-2">
                    <span className="text-bark-brown-light font-mono">/</span>
                    <input type="text" value={name} onChange={(e) => setName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} className={`${inputClass} font-mono`} placeholder="my-command" />
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Description</label>
                  <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} placeholder="What this command does" />
                </div>
                <Button onClick={() => setStep(2)} disabled={!name.trim()}>Next</Button>
              </div>
            </Card>
          )}

          {/* Step 2: Response Type */}
          {step === 2 && (
            <Card hover={false}>
              <h2 className="font-display text-lg text-bark-brown mb-4">Step 2: Response Type</h2>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { type: "text", label: "Plain Text", desc: "Simple text response" },
                  { type: "embed", label: "Embed", desc: "Rich embed with title, color, footer" },
                  { type: "random", label: "Random", desc: "Random pick from a list" },
                  { type: "wom", label: "WOM Data", desc: "Fetch player stats from Wise Old Man" },
                  { type: "activity", label: "Activity Leaderboard", desc: "Show clan event attendance rankings" },
                ].map((opt) => (
                  <button
                    key={opt.type}
                    onClick={() => { setSpec((s) => ({ ...s, type: opt.type as CommandSpec["type"] })); setStep(3); }}
                    className={`p-4 rounded-lg border-2 text-left transition-colors cursor-pointer ${
                      spec.type === opt.type ? "border-gnome-green bg-gnome-green/10" : "border-bark-brown-light hover:border-gnome-green"
                    }`}
                  >
                    <p className="font-semibold text-bark-brown">{opt.label}</p>
                    <p className="text-xs text-bark-brown-light">{opt.desc}</p>
                  </button>
                ))}
              </div>
              <div className="mt-4">
                <Button variant="ghost" onClick={() => setStep(1)}>Back</Button>
              </div>
            </Card>
          )}

          {/* Step 3: Configure Response */}
          {step === 3 && (
            <Card hover={false}>
              <h2 className="font-display text-lg text-bark-brown mb-4">Step 3: Configure Response</h2>
              <div className="space-y-4">
                {spec.type === "text" && (
                  <div>
                    <label className={labelClass}>Response Text</label>
                    <textarea value={spec.response.content} onChange={(e) => setSpec((s) => ({ ...s, response: { ...s.response, content: e.target.value } }))} rows={4} className={`${inputClass} resize-y`} placeholder="Hello! Welcome to Gn0me Home." />
                  </div>
                )}

                {spec.type === "embed" && (
                  <>
                    <div>
                      <label className={labelClass}>Embed Title</label>
                      <input type="text" value={spec.response.title} onChange={(e) => setSpec((s) => ({ ...s, response: { ...s.response, title: e.target.value } }))} className={inputClass} placeholder="My Embed" />
                    </div>
                    <div>
                      <label className={labelClass}>Embed Content</label>
                      <textarea value={spec.response.content} onChange={(e) => setSpec((s) => ({ ...s, response: { ...s.response, content: e.target.value } }))} rows={3} className={`${inputClass} resize-y`} placeholder="Embed description text..." />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className={labelClass}>Color</label>
                        <input type="color" value={spec.response.color} onChange={(e) => setSpec((s) => ({ ...s, response: { ...s.response, color: e.target.value } }))} className="w-full h-10 rounded-md border border-bark-brown-light cursor-pointer" />
                      </div>
                      <div>
                        <label className={labelClass}>Footer</label>
                        <input type="text" value={spec.response.footer} onChange={(e) => setSpec((s) => ({ ...s, response: { ...s.response, footer: e.target.value } }))} className={inputClass} placeholder="Gn0me Home" />
                      </div>
                    </div>
                  </>
                )}

                {spec.type === "random" && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className={labelClass}>Responses (bot picks one randomly)</label>
                      <Button type="button" variant="ghost" size="sm" onClick={() => setSpec((s) => ({ ...s, response: { ...s.response, responses: [...s.response.responses, ""] } }))}>+ Add</Button>
                    </div>
                    <div className="space-y-2">
                      {spec.response.responses.map((r, i) => (
                        <div key={i} className="flex gap-2">
                          <input type="text" value={r} onChange={(e) => {
                            const next = [...spec.response.responses];
                            next[i] = e.target.value;
                            setSpec((s) => ({ ...s, response: { ...s.response, responses: next } }));
                          }} className={`${inputClass} flex-1`} placeholder={`Response ${i + 1}`} />
                          {spec.response.responses.length > 1 && (
                            <button type="button" onClick={() => setSpec((s) => ({ ...s, response: { ...s.response, responses: s.response.responses.filter((_, idx) => idx !== i) } }))} className="text-red-accent text-xs cursor-pointer px-2">✕</button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {spec.type === "wom" && (
                  <div className="space-y-4">
                    <div>
                      <label className={labelClass}>WOM Data Type</label>
                      <select value={spec.response.wom_type} onChange={(e) => setSpec((s) => ({ ...s, response: { ...s.response, wom_type: e.target.value } }))} className={`${inputClass} cursor-pointer`}>
                        <option value="stats">Player Stats</option>
                        <option value="kc">Boss Kill Counts</option>
                        <option value="gains">XP Gains</option>
                      </select>
                    </div>
                    {spec.response.wom_type === "gains" && (
                      <div>
                        <label className={labelClass}>Gains Period</label>
                        <select value={spec.response.wom_period} onChange={(e) => setSpec((s) => ({ ...s, response: { ...s.response, wom_period: e.target.value } }))} className={`${inputClass} cursor-pointer`}>
                          <option value="day">Day</option>
                          <option value="week">Week</option>
                          <option value="month">Month</option>
                          <option value="year">Year</option>
                        </select>
                      </div>
                    )}
                    <p className="text-xs text-iron-grey">WOM commands auto-fetch data for the user who runs the command (via linked RSN).</p>
                  </div>
                )}

                {spec.type === "activity" && (
                  <div className="space-y-4">
                    <div>
                      <label className={labelClass}>Leaderboard Title</label>
                      <input type="text" value={spec.response.title} onChange={(e) => setSpec((s) => ({ ...s, response: { ...s.response, title: e.target.value } }))} className={inputClass} placeholder="Event Activity Leaderboard" />
                    </div>
                    <div>
                      <label className={labelClass}>Time Period</label>
                      <select value={spec.response.activity_period} onChange={(e) => setSpec((s) => ({ ...s, response: { ...s.response, activity_period: e.target.value } }))} className={`${inputClass} cursor-pointer`}>
                        <option value="all">All Time</option>
                        <option value="month">Last 30 Days</option>
                        <option value="week">Last 7 Days</option>
                      </select>
                    </div>
                    <div>
                      <label className={labelClass}>Max Players Shown</label>
                      <input type="number" value={spec.response.activity_limit} onChange={(e) => setSpec((s) => ({ ...s, response: { ...s.response, activity_limit: parseInt(e.target.value) || 20 } }))} className={inputClass} min={5} max={50} />
                    </div>
                    <p className="text-xs text-iron-grey">Shows a ranked table of clan members by number of events attended. Data comes from the attendance tracking system.</p>
                  </div>
                )}

                <div className="flex gap-3">
                  <Button variant="ghost" onClick={() => setStep(2)}>Back</Button>
                  <Button onClick={() => setStep(4)}>Next</Button>
                </div>
              </div>
            </Card>
          )}

          {/* Step 4: Restrictions */}
          {step === 4 && (
            <Card hover={false}>
              <h2 className="font-display text-lg text-bark-brown mb-4">Step 4: Restrictions (optional)</h2>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <button type="button" onClick={() => setSpec((s) => ({ ...s, ephemeral: !s.ephemeral }))}
                    className={`mt-0.5 w-6 h-6 rounded border-2 flex items-center justify-center shrink-0 cursor-pointer ${spec.ephemeral ? "bg-gnome-green border-gnome-green" : "border-bark-brown-light"}`}>
                    {spec.ephemeral && <svg className="w-4 h-4 text-text-light" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                  </button>
                  <div>
                    <p className="font-semibold text-bark-brown">Ephemeral (private)</p>
                    <p className="text-xs text-bark-brown-light">Response only visible to the user who ran the command.</p>
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Restrict to Roles (comma-separated names, leave blank for everyone)</label>
                  <input type="text" value={spec.allowed_roles.join(", ")} onChange={(e) => setSpec((s) => ({ ...s, allowed_roles: e.target.value.split(",").map((r) => r.trim()).filter(Boolean) }))} className={inputClass} placeholder="Officer, Council Member" />
                </div>
                <div className="flex gap-3">
                  <Button variant="ghost" onClick={() => setStep(3)}>Back</Button>
                  <Button onClick={() => setStep(5)}>Preview</Button>
                </div>
              </div>
            </Card>
          )}

          {/* Step 5: Preview + Save */}
          {step === 5 && (
            <Card hover={false}>
              <h2 className="font-display text-lg text-bark-brown mb-4">Step 5: Review & Save</h2>
              <div className="space-y-3 text-sm mb-6">
                <p><span className="text-iron-grey">Command:</span> <span className="font-mono text-gnome-green">/{name}</span></p>
                <p><span className="text-iron-grey">Type:</span> <span className="capitalize">{spec.type}</span></p>
                <p><span className="text-iron-grey">Description:</span> {description || "—"}</p>
                <p><span className="text-iron-grey">Ephemeral:</span> {spec.ephemeral ? "Yes" : "No"}</p>
                {spec.allowed_roles.length > 0 && (
                  <p><span className="text-iron-grey">Roles:</span> {spec.allowed_roles.join(", ")}</p>
                )}
              </div>
              <div className="flex gap-3">
                <Button variant="ghost" onClick={() => setStep(4)}>Back</Button>
                <Button onClick={handleSave}>Save Command</Button>
              </div>
              {status && <p className={`text-sm mt-4 ${status.startsWith("Error") ? "text-red-accent" : "text-gnome-green"}`}>{status}</p>}
            </Card>
          )}
        </div>

        {/* Live Preview */}
        {step >= 3 && (
          <div className="xl:sticky xl:top-20 xl:self-start">
            <h2 className="font-display text-lg text-bark-brown mb-4">Discord Preview</h2>
            <div className="bg-[#313338] text-[#dbdee1] font-sans text-sm leading-relaxed overflow-auto max-h-[60vh] rounded-lg border border-[#1e1f22] p-4 shadow-lg">
              <p className="text-[#72767d] text-xs mb-2">/{name}</p>
              <pre className="whitespace-pre-wrap break-words font-sans text-[13px]">
                {preview || "Configure the response to see a preview..."}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function buildPreview(name: string, spec: CommandSpec): string {
  if (!name) return "";

  switch (spec.type) {
    case "text":
      return spec.response.content || "(empty response)";
    case "embed":
      return [
        spec.response.title ? `**${spec.response.title}**` : null,
        spec.response.content || "(embed content)",
        spec.response.footer ? `\n— ${spec.response.footer}` : null,
      ].filter(Boolean).join("\n");
    case "random":
      const responses = spec.response.responses.filter((r) => r.trim());
      return responses.length > 0
        ? `One of:\n${responses.map((r, i) => `  ${i + 1}. ${r}`).join("\n")}`
        : "(no responses added)";
    case "wom":
      return `[Fetches ${spec.response.wom_type} from WOM for the user's linked RSN]${
        spec.response.wom_type === "gains" ? `\nPeriod: ${spec.response.wom_period}` : ""
      }`;
    case "activity": {
      const periodLabel = spec.response.activity_period === "month" ? "Last 30 Days" : spec.response.activity_period === "week" ? "Last 7 Days" : "All Time";
      return [
        `**${spec.response.title || "Event Activity Leaderboard"}**`,
        `Period: ${periodLabel}`,
        "",
        "```",
        " #  RSN               Events",
        " 1  Tiffy X                12",
        " 2  Gn0me Vlad              9",
        " 3  Pizza Queen              7",
        `... (top ${spec.response.activity_limit})`,
        "```",
      ].join("\n");
    }
    default:
      return "";
  }
}
