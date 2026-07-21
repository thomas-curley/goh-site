"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import type { PostSection, BlockType } from "@/lib/post-templates";

interface SectionEditorProps {
  section: PostSection | null;
  onSaved: () => void;
  onCancel: () => void;
}

const BLOCK_TYPES: { key: BlockType; label: string }[] = [
  { key: "role_ping_prefix", label: "Role Ping Prefix" },
  { key: "line", label: "Single Line" },
  { key: "paragraph", label: "Paragraph" },
  { key: "list", label: "List" },
  { key: "static_text", label: "Static Text" },
];

export function emptyConfig(blockType: BlockType): Record<string, unknown> {
  switch (blockType) {
    case "line":
      return { emoji: "", template: "", requireKeys: [] };
    case "paragraph":
      return { bindKey: "" };
    case "list":
      return { bindKey: "", splitNewlines: false, style: "bullet", itemPrefix: "• ", itemTemplate: "{value}" };
    case "static_text":
      return { emoji: "", template: "" };
    default:
      return {};
  }
}

const inputClass = "w-full px-3 py-2 rounded-md border border-bark-brown-light bg-parchment text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-gnome-green";
const labelClass = "block text-xs font-semibold text-bark-brown mb-1";

export function SectionEditor({ section, onSaved, onCancel }: SectionEditorProps) {
  const [name, setName] = useState(section?.name ?? "");
  const [description, setDescription] = useState(section?.description ?? "");
  const [blockType, setBlockType] = useState<BlockType>(section?.block_type ?? "line");
  const [config, setConfig] = useState<Record<string, unknown>>(
    (section?.config as Record<string, unknown>) ?? emptyConfig("line")
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createSupabaseBrowserClient();
  const isNew = !section;

  const updateConfig = (patch: Record<string, unknown>) => setConfig((prev) => ({ ...prev, ...patch }));

  const handleBlockTypeChange = (next: BlockType) => {
    setBlockType(next);
    setConfig(emptyConfig(next));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);

    const row = { name: name.trim(), description: description.trim(), block_type: blockType, config };

    const { error: saveError } = isNew
      ? await supabase.from("post_sections").insert(row)
      : await supabase.from("post_sections").update(row).eq("id", section.id);

    if (saveError) {
      setError(saveError.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    onSaved();
  };

  const handleToggleActive = async () => {
    if (!section) return;
    setSaving(true);
    await supabase.from("post_sections").update({ is_active: !section.is_active }).eq("id", section.id);
    setSaving(false);
    onSaved();
  };

  return (
    <Card hover={false} className="mb-6">
      <h3 className="font-display text-base text-bark-brown mb-4">
        {isNew ? "New Section" : `Edit: ${section.name}`}
      </h3>
      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label className={labelClass}>Name</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} required className={inputClass} placeholder="Raid Header" />
        </div>
        <div>
          <label className={labelClass}>Description (admin-facing hint)</label>
          <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} placeholder="What this section is for" />
        </div>
        <div>
          <label className={labelClass}>Block Type</label>
          <select
            value={blockType}
            onChange={(e) => handleBlockTypeChange(e.target.value as BlockType)}
            disabled={!isNew}
            className={`${inputClass} cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed`}
          >
            {BLOCK_TYPES.map((t) => (
              <option key={t.key} value={t.key}>{t.label}</option>
            ))}
          </select>
          {!isNew && (
            <p className="text-xs text-iron-grey mt-1">
              Block type can&apos;t be changed after creation — make a new section instead.
            </p>
          )}
        </div>

        <ConfigFields blockType={blockType} config={config} onChange={updateConfig} />

        {error && <p className="text-red-accent text-sm">{error}</p>}

        <div className="flex items-center gap-3">
          <Button type="submit" size="sm" disabled={saving}>
            {saving ? "Saving..." : isNew ? "Create Section" : "Save Changes"}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
          {!isNew && (
            <button
              type="button"
              onClick={handleToggleActive}
              className="text-xs text-red-accent hover:underline ml-auto cursor-pointer"
            >
              {section.is_active ? "Deactivate" : "Reactivate"}
            </button>
          )}
        </div>
      </form>
    </Card>
  );
}

export function ConfigFields({
  blockType,
  config,
  onChange,
}: {
  blockType: BlockType;
  config: Record<string, unknown>;
  onChange: (patch: Record<string, unknown>) => void;
}) {
  const str = (key: string) => (config[key] as string) ?? "";
  const bool = (key: string) => !!config[key];
  const skipIf = (config.skipIf as { key?: string; equals?: string }) ?? {};

  if (blockType === "role_ping_prefix") {
    return <p className="text-xs text-iron-grey">No configuration needed — renders selected role pings, if any.</p>;
  }

  if (blockType === "line") {
    return (
      <div className="space-y-3 p-3 rounded-md border border-parchment-dark">
        <div>
          <label className={labelClass}>Emoji</label>
          <input type="text" value={str("emoji")} onChange={(e) => onChange({ emoji: e.target.value })} maxLength={4} className={`${inputClass} w-20 text-center`} />
        </div>
        <div>
          <label className={labelClass}>Template</label>
          <input
            type="text"
            value={str("template")}
            onChange={(e) => onChange({ template: e.target.value })}
            required
            className={`${inputClass} font-mono`}
            placeholder="{emoji} Host: {host_rsn}"
          />
          <p className="text-xs text-iron-grey mt-1">Use {"{emoji}"} and {"{fieldName}"} placeholders.</p>
        </div>
        <div>
          <label className={labelClass}>Required Fields (comma-separated — line is hidden if any are empty)</label>
          <input
            type="text"
            value={((config.requireKeys as string[]) ?? []).join(", ")}
            onChange={(e) => onChange({ requireKeys: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
            className={`${inputClass} font-mono`}
            placeholder="host_rsn"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Skip if field...</label>
            <input
              type="text"
              value={skipIf.key ?? ""}
              onChange={(e) => onChange({ skipIf: e.target.value ? { key: e.target.value, equals: skipIf.equals ?? "" } : undefined })}
              className={`${inputClass} font-mono`}
              placeholder="spots"
            />
          </div>
          <div>
            <label className={labelClass}>...equals</label>
            <input
              type="text"
              value={skipIf.equals ?? ""}
              onChange={(e) => onChange({ skipIf: { key: skipIf.key ?? "", equals: e.target.value } })}
              className={inputClass}
              placeholder="Open"
            />
          </div>
        </div>
      </div>
    );
  }

  if (blockType === "paragraph") {
    return (
      <div className="space-y-3 p-3 rounded-md border border-parchment-dark">
        <div>
          <label className={labelClass}>Data Field</label>
          <input type="text" value={str("bindKey")} onChange={(e) => onChange({ bindKey: e.target.value })} required className={`${inputClass} font-mono`} placeholder="description" />
        </div>
        <div>
          <label className={labelClass}>Heading Emoji (optional)</label>
          <input type="text" value={str("headingEmoji")} onChange={(e) => onChange({ headingEmoji: e.target.value })} maxLength={4} className={`${inputClass} w-20 text-center`} />
        </div>
        <div>
          <label className={labelClass}>Heading Template (optional)</label>
          <input
            type="text"
            value={str("headingTemplate")}
            onChange={(e) => onChange({ headingTemplate: e.target.value })}
            className={`${inputClass} font-mono`}
            placeholder="{emoji} Event-Specific Guide: {title} Mechanics"
          />
        </div>
      </div>
    );
  }

  if (blockType === "list") {
    const style = str("style") || "bullet";
    return (
      <div className="space-y-3 p-3 rounded-md border border-parchment-dark">
        <div>
          <label className={labelClass}>Data Field (newline-separated text or an array)</label>
          <input type="text" value={str("bindKey")} onChange={(e) => onChange({ bindKey: e.target.value })} required className={`${inputClass} font-mono`} placeholder="highlights" />
        </div>
        <label className="flex items-center gap-2 text-xs text-bark-brown-light">
          <input type="checkbox" checked={bool("splitNewlines")} onChange={(e) => onChange({ splitNewlines: e.target.checked })} />
          Field is newline-separated text, not an array
        </label>
        <div>
          <label className={labelClass}>Style</label>
          <select value={style} onChange={(e) => onChange({ style: e.target.value })} className={`${inputClass} cursor-pointer`}>
            <option value="bullet">Bullet list</option>
            <option value="medal">Medal ranking (🥇🥈🥉🎖️)</option>
          </select>
        </div>
        {style === "bullet" && (
          <div>
            <label className={labelClass}>Item Prefix</label>
            <input type="text" value={str("itemPrefix")} onChange={(e) => onChange({ itemPrefix: e.target.value })} className={inputClass} placeholder="• " />
          </div>
        )}
        <div>
          <label className={labelClass}>Item Template</label>
          <input
            type="text"
            value={str("itemTemplate")}
            onChange={(e) => onChange({ itemTemplate: e.target.value })}
            required
            className={`${inputClass} font-mono`}
            placeholder={style === "medal" ? "**{rsn}**{prizeSuffix}" : "{value}"}
          />
        </div>
        <div>
          <label className={labelClass}>Heading Emoji (optional)</label>
          <input type="text" value={str("headingEmoji")} onChange={(e) => onChange({ headingEmoji: e.target.value })} maxLength={4} className={`${inputClass} w-20 text-center`} />
        </div>
        <div>
          <label className={labelClass}>Heading Template (optional)</label>
          <input type="text" value={str("headingTemplate")} onChange={(e) => onChange({ headingTemplate: e.target.value })} className={`${inputClass} font-mono`} placeholder="{emoji} **Highlights**" />
        </div>
        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-parchment-dark">
          <div>
            <label className={labelClass}>Fallback Field (optional)</label>
            <input type="text" value={str("fallbackBindKey")} onChange={(e) => onChange({ fallbackBindKey: e.target.value })} className={`${inputClass} font-mono`} placeholder="requirements" />
          </div>
          <div>
            <label className={labelClass}>Fallback Template</label>
            <input type="text" value={str("fallbackTemplate")} onChange={(e) => onChange({ fallbackTemplate: e.target.value })} className={`${inputClass} font-mono`} placeholder="{emoji} Requirements: {value}" />
          </div>
        </div>
      </div>
    );
  }

  // static_text
  return (
    <div className="space-y-3 p-3 rounded-md border border-parchment-dark">
      <div>
        <label className={labelClass}>Emoji (optional)</label>
        <input type="text" value={str("emoji")} onChange={(e) => onChange({ emoji: e.target.value })} maxLength={4} className={`${inputClass} w-20 text-center`} />
      </div>
      <div>
        <label className={labelClass}>Text</label>
        <input
          type="text"
          value={str("template")}
          onChange={(e) => onChange({ template: e.target.value })}
          required
          className={`${inputClass} font-mono`}
          placeholder="Thanks for coming! See you at the next one {emoji}"
        />
      </div>
    </div>
  );
}
