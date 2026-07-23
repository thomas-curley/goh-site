"use client";

import { useState, useEffect, useCallback } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ConfigFields, emptyConfig } from "@/components/admin/SectionEditor";
import { renderTemplate } from "@/lib/post-templates";
import { parseImportedTemplate } from "@/lib/post-template-import";
import type { PostTemplate, PostSection, SectionInstance, ContentType, BlockType } from "@/lib/post-templates";

interface TemplateEditorProps {
  template: PostTemplate | null;
  contentType: ContentType;
  onSaved: () => void;
  onCancel: () => void;
}

const MOCK_DATA: Record<ContentType, Record<string, unknown>> = {
  announcement: {
    title: "Sample Announcement",
    content: "This is a sample announcement body, shown here so you can see how this template lays it out.",
    author: "Tmansim21",
    pingRoles: ["@everyone"],
  },
  event_post: {
    title: "Sample Raid Night",
    description: "Join us for a night of raiding!",
    host_rsn: "Tmansim21",
    dateStr: "Saturday, July 25",
    timeStr: "8:00 PM EDT",
    world: 420,
    meet_location: "Grand Exchange",
    spots: "10",
    signup_type: "React to sign up",
    voice_channel: "Event Room 1",
    prize_pool: "50M GP",
    requirements: "70+ combat",
    requirements_list: "70+ Combat\nStrong ranged setup",
    guide_text: "Phase 1: watch for the tail sweep.",
    video_url: "https://youtube.com/example",
    pingRoles: ["@everyone"],
  },
  event_recap: {
    title: "Sample Raid Night",
    description: "What a night! The clan gathered and had a blast.",
    highlights: ["Someone tanked the boss solo", "We found a rare drop"],
    winners: [{ rsn: "PlayerOne", prize: "10M GP" }, { rsn: "PlayerTwo", prize: "5M GP" }],
    author: "Tmansim21",
    dateStr: "Saturday, July 25",
    pingRoles: [],
  },
  signup_thread: {
    title: "Sample Raid Night",
    dateStr: "Saturday, July 25",
    host_rsn: "Tmansim21",
    spots: "10",
  },
};

const BLANK_BLOCK_TYPES: { key: BlockType; label: string }[] = [
  { key: "line", label: "Single Line" },
  { key: "paragraph", label: "Paragraph" },
  { key: "list", label: "List" },
  { key: "static_text", label: "Static Text" },
];

function newInstanceId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `tmp_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export function TemplateEditor({ template, contentType, onSaved, onCancel }: TemplateEditorProps) {
  const [name, setName] = useState(template?.name ?? "");
  const [description, setDescription] = useState(template?.description ?? "");
  const [isDefault, setIsDefault] = useState(template?.is_default ?? false);
  const [sections, setSections] = useState<SectionInstance[]>(template?.sections ?? []);
  const [library, setLibrary] = useState<PostSection[]>([]);
  const [addFromLibraryId, setAddFromLibraryId] = useState("");
  const [addBlankType, setAddBlankType] = useState<BlockType>("line");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState("");

  const supabase = createSupabaseBrowserClient();
  const isNew = !template;

  const loadLibrary = useCallback(async () => {
    const { data } = await supabase
      .from("post_sections")
      .select("*")
      .eq("is_active", true)
      .order("name", { ascending: true });
    if (data) setLibrary(data);
  }, [supabase]);

  useEffect(() => { loadLibrary(); }, [loadLibrary]);

  const addFromLibrary = () => {
    const preset = library.find((s) => s.id === addFromLibraryId);
    if (!preset) return;
    setSections((prev) => [
      ...prev,
      {
        instance_id: newInstanceId(),
        source_section_id: preset.id,
        block_type: preset.block_type,
        label: preset.name,
        blankLineBefore: true,
        config: { ...(preset.config as Record<string, unknown>) },
      },
    ]);
    setAddFromLibraryId("");
  };

  const addBlank = () => {
    setSections((prev) => [
      ...prev,
      {
        instance_id: newInstanceId(),
        source_section_id: null,
        block_type: addBlankType,
        label: "New Section",
        blankLineBefore: true,
        config: emptyConfig(addBlankType),
      },
    ]);
  };

  const handleImport = () => {
    if (!importText.trim()) return;
    if (sections.length > 0) {
      const confirmed = window.confirm(
        "This replaces the current sections with a best-effort parse of the pasted text. Continue?"
      );
      if (!confirmed) return;
    }
    setSections(parseImportedTemplate(importText));
    setImportText("");
    setShowImport(false);
    setExpandedId(null);
  };

  const removeInstance = (instanceId: string) => {
    setSections((prev) => prev.filter((s) => s.instance_id !== instanceId));
    if (expandedId === instanceId) setExpandedId(null);
  };

  const moveInstance = (instanceId: string, direction: "up" | "down") => {
    setSections((prev) => {
      const index = prev.findIndex((s) => s.instance_id === instanceId);
      const target = direction === "up" ? index - 1 : index + 1;
      if (index < 0 || target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const updateInstance = (instanceId: string, patch: Partial<SectionInstance>) => {
    setSections((prev) => prev.map((s) => (s.instance_id === instanceId ? { ...s, ...patch } : s)));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (template?.is_default && !isDefault) {
      const confirmed = window.confirm(
        `"${template.name}" is currently the default ${contentType} template. If you remove it as default without setting another one, posting will fail until a new default is chosen. Continue?`
      );
      if (!confirmed) return;
    }

    setSaving(true);
    setError(null);

    const { data: { user } } = await supabase.auth.getUser();
    let createdBy = "Admin";
    if (user) {
      const { data: profile } = await supabase.from("user_profiles").select("rsn, discord_username").eq("id", user.id).single();
      createdBy = profile?.rsn ?? profile?.discord_username ?? "Admin";
    }

    if (isDefault) {
      // Only one default per content type — clear any existing one first.
      await supabase
        .from("post_templates")
        .update({ is_default: false })
        .eq("content_type", contentType)
        .eq("is_default", true)
        .neq("id", template?.id ?? "00000000-0000-0000-0000-000000000000");
    }

    const row = { content_type: contentType, name: name.trim(), description: description.trim(), is_default: isDefault, sections, created_by: createdBy };

    const { error: saveError } = isNew
      ? await supabase.from("post_templates").insert(row)
      : await supabase.from("post_templates").update(row).eq("id", template.id);

    if (saveError) {
      setError(saveError.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    onSaved();
  };

  const handleDelete = async () => {
    if (!template) return;
    if (!window.confirm(`Delete template "${template.name}"?`)) return;
    setSaving(true);
    await supabase.from("post_templates").delete().eq("id", template.id);
    setSaving(false);
    onSaved();
  };

  const inputClass = "w-full px-3 py-2 rounded-md border border-bark-brown-light bg-parchment text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-gnome-green";
  const labelClass = "block text-xs font-semibold text-bark-brown mb-1";
  const preview = renderTemplate(sections, MOCK_DATA[contentType]);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
      <Card hover={false}>
        <h3 className="font-display text-base text-bark-brown mb-4">
          {isNew ? `New ${contentType} Template` : `Edit: ${template.name}`}
        </h3>
        <form onSubmit={handleSave} className="space-y-4">
          <div data-tour="template-editor-name">
            <label className={labelClass}>Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} required className={inputClass} placeholder="Raid Night Recap" />
          </div>
          <div>
            <label className={labelClass}>Description</label>
            <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} placeholder="What this template is for" />
          </div>
          <label className="flex items-center gap-2 text-xs text-bark-brown-light">
            <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
            Use as the default template for {contentType}
          </label>

          {/* Import from pasted Discord template text */}
          <div className="rounded-md border border-parchment-dark p-3" data-tour="template-editor-import">
            <button
              type="button"
              onClick={() => setShowImport(!showImport)}
              className="text-xs font-semibold text-gnome-green hover:underline cursor-pointer"
            >
              {showImport ? "▾" : "▸"} Import from Discord Text
            </button>
            {showImport && (
              <div className="mt-2 space-y-2">
                <p className="text-xs text-iron-grey">
                  Paste a template you already use in Discord (like the ones in your pinned messages).
                  Recognized placeholders (Event Name, Date, World, Host, etc.) become live fields;
                  anything else is kept as a literal [bracket] reminder to fill in or rebind by hand
                  afterward. This is a starting point, not a perfect conversion — review the result below.
                </p>
                <textarea
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  rows={8}
                  className={`${inputClass} font-mono text-xs resize-y`}
                  placeholder={"[emoji] **[Event Name] — Results** · [Day Date]\n\n**Attendees:** [number] members\n..."}
                />
                <Button type="button" size="sm" variant="secondary" disabled={!importText.trim()} onClick={handleImport}>
                  Parse & {sections.length > 0 ? "Replace" : "Build"} Sections
                </Button>
              </div>
            )}
          </div>

          {/* Section list */}
          <div data-tour="template-editor-sections">
            <label className={labelClass}>Sections</label>
            {sections.length === 0 ? (
              <p className="text-xs text-iron-grey mb-2">No sections yet — add one from the library below.</p>
            ) : (
              <div className="space-y-2 mb-3">
                {sections.map((instance, i) => (
                  <div key={instance.instance_id} className="rounded-md border border-parchment-dark">
                    <div className="flex items-center gap-2 px-3 py-2">
                      <div className="flex flex-col">
                        <button type="button" disabled={i === 0} onClick={() => moveInstance(instance.instance_id, "up")} className="text-xs text-iron-grey hover:text-gnome-green disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed leading-none">▲</button>
                        <button type="button" disabled={i === sections.length - 1} onClick={() => moveInstance(instance.instance_id, "down")} className="text-xs text-iron-grey hover:text-gnome-green disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed leading-none">▼</button>
                      </div>
                      <button
                        type="button"
                        onClick={() => setExpandedId(expandedId === instance.instance_id ? null : instance.instance_id)}
                        className="flex-1 text-left text-sm text-bark-brown cursor-pointer"
                      >
                        {instance.label} <span className="text-xs text-iron-grey">({instance.block_type})</span>
                      </button>
                      <label className="flex items-center gap-1 text-xs text-iron-grey shrink-0">
                        <input
                          type="checkbox"
                          checked={instance.blankLineBefore}
                          onChange={(e) => updateInstance(instance.instance_id, { blankLineBefore: e.target.checked })}
                        />
                        blank line before
                      </label>
                      <button type="button" onClick={() => removeInstance(instance.instance_id)} className="text-xs text-red-accent hover:underline cursor-pointer shrink-0">✕</button>
                    </div>
                    {expandedId === instance.instance_id && (
                      <div className="px-3 pb-3 space-y-3 border-t border-parchment-dark pt-3">
                        <div>
                          <label className={labelClass}>Label</label>
                          <input
                            type="text"
                            value={instance.label}
                            onChange={(e) => updateInstance(instance.instance_id, { label: e.target.value })}
                            className={inputClass}
                          />
                        </div>
                        <ConfigFields
                          blockType={instance.block_type}
                          config={instance.config as Record<string, unknown>}
                          onChange={(patch) => updateInstance(instance.instance_id, { config: { ...instance.config, ...patch } })}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2 items-center" data-tour="template-editor-add-library">
            <select value={addFromLibraryId} onChange={(e) => setAddFromLibraryId(e.target.value)} className={`${inputClass} flex-1 min-w-[180px] cursor-pointer`}>
              <option value="">Add from library...</option>
              {library.map((s) => (
                <option key={s.id} value={s.id}>{s.name} ({s.block_type})</option>
              ))}
            </select>
            <Button type="button" size="sm" variant="secondary" disabled={!addFromLibraryId} onClick={addFromLibrary}>Add</Button>
          </div>
          <div className="flex flex-wrap gap-2 items-center mt-2">
            <select value={addBlankType} onChange={(e) => setAddBlankType(e.target.value as BlockType)} className={`${inputClass} flex-1 min-w-[180px] cursor-pointer`}>
              {BLANK_BLOCK_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
            <Button type="button" size="sm" variant="ghost" onClick={addBlank}>+ Blank Section</Button>
          </div>

          {error && <p className="text-red-accent text-sm">{error}</p>}

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={saving} data-tour="template-editor-save">{saving ? "Saving..." : isNew ? "Create Template" : "Save Changes"}</Button>
            <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
            {!isNew && (
              <button type="button" onClick={handleDelete} className="text-xs text-red-accent hover:underline ml-auto cursor-pointer">
                Delete Template
              </button>
            )}
          </div>
        </form>
      </Card>

      {/* Live Preview */}
      <div className="xl:sticky xl:top-20 xl:self-start" data-tour="template-editor-preview">
        <h3 className="font-display text-base text-bark-brown mb-2">Preview (sample data)</h3>
        <div className="bg-[#313338] text-[#dbdee1] font-sans text-sm leading-relaxed overflow-auto max-h-[70vh] rounded-lg border border-[#1e1f22] p-4 shadow-lg">
          <pre className="whitespace-pre-wrap break-words font-sans text-[13px]">
            {preview || <span className="text-[#72767d]">Add sections to see a preview...</span>}
          </pre>
        </div>
      </div>
    </div>
  );
}
