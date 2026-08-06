"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { TextFormatToolbar } from "@/components/admin/TextFormatToolbar";
import { ACCESS_LEVEL_LABELS, type AccessLevel } from "@/lib/clan-access";

interface HandbookSection {
  id: string;
  slug: string;
  title: string;
  parent_slug: string | null;
  order_index: number;
  pull_quote: string | null;
  content: string;
  visibility: AccessLevel;
  is_published: boolean;
}

const ACCESS_LEVELS: AccessLevel[] = ["anonymous", "verified_player", "clan_member"];

const inputClass = "w-full px-3 py-2 rounded-md border border-bark-brown-light bg-parchment text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-gnome-green";
const labelClass = "block text-sm font-semibold text-bark-brown mb-1";

const EMPTY_FORM = {
  title: "",
  slug: "",
  parent_slug: "",
  order_index: 0,
  pull_quote: "",
  content: "",
  visibility: "clan_member" as AccessLevel,
  is_published: true,
};

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export default function AdminHandbookPage() {
  const [sections, setSections] = useState<HandbookSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [slugTouched, setSlugTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const contentRef = useRef<HTMLTextAreaElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/handbook");
    const data = await res.json().catch(() => ({}));
    setSections(res.ok ? data.sections ?? [] : []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const update = (field: keyof typeof form, value: string | number | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const startNew = (parentSlug = "") => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, parent_slug: parentSlug });
    setSlugTouched(false);
    setStatus(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const startEdit = (section: HandbookSection) => {
    setEditingId(section.id);
    setForm({
      title: section.title,
      slug: section.slug,
      parent_slug: section.parent_slug ?? "",
      order_index: section.order_index,
      pull_quote: section.pull_quote ?? "",
      content: section.content,
      visibility: section.visibility,
      is_published: section.is_published,
    });
    setSlugTouched(true);
    setStatus(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setStatus(null);

    const payload = {
      title: form.title,
      slug: form.slug,
      parent_slug: form.parent_slug || null,
      order_index: form.order_index,
      pull_quote: form.pull_quote || null,
      content: form.content,
      visibility: form.visibility,
      is_published: form.is_published,
    };

    const res = editingId
      ? await fetch(`/api/admin/handbook/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      : await fetch("/api/admin/handbook", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setStatus({ type: "success", message: editingId ? "Section updated!" : "Section created!" });
      startNew();
      await load();
    } else {
      setStatus({ type: "error", message: data.error ?? "Failed to save section." });
    }
    setSaving(false);
  };

  const handleDelete = async (section: HandbookSection) => {
    const childCount = sections.filter((s) => s.parent_slug === section.slug).length;
    const warning = childCount > 0
      ? `Delete "${section.title}"? This will also delete its ${childCount} subsection${childCount === 1 ? "" : "s"}.`
      : `Delete "${section.title}"?`;
    if (!confirm(warning)) return;

    const res = await fetch(`/api/admin/handbook/${section.id}`, { method: "DELETE" });
    if (res.ok) {
      if (editingId === section.id) startNew();
      await load();
    } else {
      alert("Failed to delete section.");
    }
  };

  const topLevel = sections.filter((s) => !s.parent_slug).sort((a, b) => a.order_index - b.order_index);
  const childrenOf = (slug: string) => sections.filter((s) => s.parent_slug === slug).sort((a, b) => a.order_index - b.order_index);

  return (
    <div>
      <h1 className="font-display text-3xl text-gnome-green mb-1">Staff Handbook</h1>
      <p className="text-bark-brown-light mb-6">
        Manage the pages published at <code className="font-mono text-xs bg-parchment-dark px-1 rounded">/staff-handbook</code>.
      </p>

      {status && (
        <div className={`mb-4 p-3 rounded-md text-sm border ${status.type === "error" ? "bg-red-accent/10 border-red-accent/30 text-red-accent" : "bg-gnome-green/10 border-gnome-green/30 text-gnome-green"}`}>
          {status.message}
        </div>
      )}

      <Card hover={false} className="mb-8">
        <h2 className="font-display text-lg text-bark-brown mb-4">
          {editingId ? "Edit Section" : "New Section"}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Title</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => {
                  update("title", e.target.value);
                  if (!slugTouched) update("slug", slugify(e.target.value));
                }}
                required
                className={inputClass}
                placeholder="Duties & Expectations"
              />
            </div>
            <div>
              <label className={labelClass}>Slug (used in the URL)</label>
              <input
                type="text"
                value={form.slug}
                onChange={(e) => { update("slug", slugify(e.target.value)); setSlugTouched(true); }}
                required
                className={`${inputClass} font-mono`}
                placeholder="duties-expectations"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>Parent Section (optional)</label>
              <select value={form.parent_slug} onChange={(e) => update("parent_slug", e.target.value)} className={`${inputClass} cursor-pointer`}>
                <option value="">(top-level)</option>
                {sections.filter((s) => !s.parent_slug && s.id !== editingId).map((s) => (
                  <option key={s.slug} value={s.slug}>{s.title}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Order</label>
              <input
                type="number"
                value={form.order_index}
                onChange={(e) => update("order_index", parseInt(e.target.value) || 0)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Visibility</label>
              <select value={form.visibility} onChange={(e) => update("visibility", e.target.value)} className={`${inputClass} cursor-pointer`}>
                {ACCESS_LEVELS.map((level) => (
                  <option key={level} value={level}>{ACCESS_LEVEL_LABELS[level]}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={labelClass}>Pull Quote (optional)</label>
            <input
              type="text"
              value={form.pull_quote}
              onChange={(e) => update("pull_quote", e.target.value)}
              className={inputClass}
              placeholder="Many hands make light work."
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-semibold text-bark-brown">Content</label>
              <TextFormatToolbar value={form.content} onChange={(v) => update("content", v)} targetRef={contentRef} />
            </div>
            <textarea
              ref={contentRef}
              value={form.content}
              onChange={(e) => update("content", e.target.value)}
              rows={12}
              className={`${inputClass} resize-y font-mono text-sm`}
              placeholder={"Write in paragraphs, separated by a blank line.\n\nStart a line with \"- \" for a bullet list item.\n\nUse **bold**, *italic*, and [link text](/staff-handbook/discipline) for links to other sections."}
            />
            <p className="text-xs text-iron-grey mt-1">
              Blank lines start a new paragraph. Lines starting with "- " become a bullet list.
            </p>
          </div>

          <label className="flex items-center gap-2 text-sm text-bark-brown cursor-pointer">
            <input type="checkbox" checked={form.is_published} onChange={(e) => update("is_published", e.target.checked)} className="accent-gnome-green" />
            Published (visible on the site)
          </label>

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : editingId ? "Save Changes" : "Create Section"}
            </Button>
            {editingId && (
              <Button type="button" variant="ghost" onClick={() => startNew()}>Cancel</Button>
            )}
          </div>
        </form>
      </Card>

      <h2 className="font-display text-lg text-bark-brown mb-3">All Sections</h2>
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-parchment-dark border-t-gnome-green rounded-full animate-spin" />
        </div>
      ) : topLevel.length === 0 ? (
        <Card hover={false}><p className="text-sm text-iron-grey">No sections yet — create the first one above.</p></Card>
      ) : (
        <div className="space-y-3">
          {topLevel.map((section) => (
            <Card key={section.id} hover={false}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-bark-brown">
                    {section.title}
                    {!section.is_published && <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-iron-grey/10 text-iron-grey align-middle">Draft</span>}
                    {section.visibility !== "clan_member" && (
                      <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-gnome-green/10 text-gnome-green align-middle">{ACCESS_LEVEL_LABELS[section.visibility]}</span>
                    )}
                  </p>
                  <p className="text-xs text-iron-grey font-mono">/{section.slug}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button size="sm" variant="ghost" onClick={() => startEdit(section)}>Edit</Button>
                  <Button size="sm" variant="ghost" onClick={() => handleDelete(section)}>Delete</Button>
                </div>
              </div>

              {childrenOf(section.slug).length > 0 && (
                <div className="mt-3 ml-4 pl-4 border-l-2 border-parchment-dark space-y-2">
                  {childrenOf(section.slug).map((child) => (
                    <div key={child.id} className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm text-bark-brown">
                          {child.title}
                          {!child.is_published && <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-iron-grey/10 text-iron-grey align-middle">Draft</span>}
                        </p>
                        <p className="text-xs text-iron-grey font-mono">/{child.slug}</p>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Button size="sm" variant="ghost" onClick={() => startEdit(child)}>Edit</Button>
                        <Button size="sm" variant="ghost" onClick={() => handleDelete(child)}>Delete</Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={() => startNew(section.slug)}
                className="mt-3 ml-4 text-xs text-gnome-green hover:underline cursor-pointer"
              >
                + Add Subsection
              </button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
