"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { SectionEditor } from "@/components/admin/SectionEditor";
import { TemplateEditor } from "@/components/admin/TemplateEditor";
import { PageTour } from "@/components/admin/tour/PageTour";
import type { PostSection, PostTemplate, ContentType } from "@/lib/post-templates";
import { TEMPLATE_TOUR } from "@/lib/tours";

const CONTENT_TYPES: { key: ContentType; label: string }[] = [
  { key: "announcement", label: "Announcements" },
  { key: "event_post", label: "Event Posts" },
  { key: "event_recap", label: "Event Recaps" },
  { key: "signup_thread", label: "Signup Threads" },
];

export default function AdminTemplatesPage() {
  const [tab, setTab] = useState<"sections" | "templates">("templates");

  const [sections, setSections] = useState<PostSection[]>([]);
  const [templates, setTemplates] = useState<PostTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  const [editingSection, setEditingSection] = useState<PostSection | null | undefined>(undefined);
  const [editingTemplate, setEditingTemplate] = useState<{ template: PostTemplate | null; contentType: ContentType } | null>(null);

  const supabase = createSupabaseBrowserClient();

  const load = useCallback(async () => {
    const [sectionsRes, templatesRes] = await Promise.all([
      supabase.from("post_sections").select("*").order("name", { ascending: true }),
      supabase.from("post_templates").select("*").order("name", { ascending: true }),
    ]);
    if (sectionsRes.data) setSections(sectionsRes.data);
    if (templatesRes.data) setTemplates(templatesRes.data);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  const closeEditors = () => {
    setEditingSection(undefined);
    setEditingTemplate(null);
  };

  const onSaved = async () => {
    closeEditors();
    await load();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-parchment-dark border-t-gnome-green rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <PageTour tour={TEMPLATE_TOUR} />
      <div className="flex items-center justify-between mb-1">
        <h1 className="font-display text-3xl text-gnome-green">Post Templates</h1>
        <Link href="/admin/templates?tour=template" className="text-sm text-gnome-green hover:underline">
          Take the Tour →
        </Link>
      </div>
      <p className="text-bark-brown-light mb-6">
        Build reusable layouts for announcements, event posts, event recaps, and signup threads,
        assembled from a shared library of sections.
      </p>

      <div className="flex gap-2 mb-6">
        <Button size="sm" variant={tab === "templates" ? "primary" : "ghost"} onClick={() => setTab("templates")}>Templates</Button>
        <Button size="sm" variant={tab === "sections" ? "primary" : "ghost"} onClick={() => setTab("sections")}>Section Library</Button>
      </div>

      {tab === "templates" && (
        <div>
          {editingTemplate && (
            <TemplateEditor
              template={editingTemplate.template}
              contentType={editingTemplate.contentType}
              onSaved={onSaved}
              onCancel={closeEditors}
            />
          )}

          {!editingTemplate && CONTENT_TYPES.map((ct) => {
            const group = templates.filter((t) => t.content_type === ct.key);
            return (
              <Card hover={false} key={ct.key} className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-display text-lg text-bark-brown">{ct.label}</h2>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setEditingTemplate({ template: null, contentType: ct.key })}
                    data-tour={ct.key === "event_recap" ? "template-new-event-recap" : undefined}
                  >
                    + New Template
                  </Button>
                </div>
                {group.length === 0 ? (
                  <p className="text-sm text-iron-grey">No templates yet.</p>
                ) : (
                  <div className="space-y-1">
                    {group.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => setEditingTemplate({ template: t, contentType: ct.key })}
                        className="w-full flex items-center justify-between text-left py-2 px-3 rounded-md border border-parchment-dark hover:border-gnome-green transition-colors cursor-pointer"
                      >
                        <span className="text-sm text-bark-brown">{t.name}</span>
                        <span className="flex items-center gap-2">
                          {t.is_default && <span className="text-xs bg-gnome-green/15 text-gnome-green px-1.5 py-0.5 rounded">Default</span>}
                          <span className="text-xs text-iron-grey">{t.sections?.length ?? 0} sections</span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {tab === "sections" && (
        <div>
          {editingSection !== undefined && (
            <SectionEditor section={editingSection} onSaved={onSaved} onCancel={closeEditors} />
          )}

          {editingSection === undefined && (
            <>
              <div className="mb-4">
                <Button size="sm" variant="secondary" onClick={() => setEditingSection(null)}>+ New Section</Button>
              </div>
              <Card hover={false}>
                <div className="space-y-1">
                  {sections.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setEditingSection(s)}
                      className={`w-full flex items-center justify-between text-left py-2 px-3 rounded-md border border-parchment-dark hover:border-gnome-green transition-colors cursor-pointer ${!s.is_active ? "opacity-50" : ""}`}
                    >
                      <span className="text-sm text-bark-brown">
                        {s.name}
                        {!s.is_active && <span className="text-xs text-iron-grey ml-2">(inactive)</span>}
                      </span>
                      <span className="text-xs text-iron-grey">{s.block_type}</span>
                    </button>
                  ))}
                  {sections.length === 0 && <p className="text-sm text-iron-grey">No sections yet.</p>}
                </div>
              </Card>
            </>
          )}
        </div>
      )}
    </div>
  );
}
