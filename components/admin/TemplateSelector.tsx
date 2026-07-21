"use client";

import { useState, useEffect, useCallback } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import type { ContentType } from "@/lib/post-templates";

interface TemplateOption {
  id: string;
  name: string;
  is_default: boolean;
}

interface TemplateSelectorProps {
  contentType: ContentType;
  value: string;
  onChange: (templateId: string) => void;
  label?: string;
}

export function TemplateSelector({ contentType, value, onChange, label = "Template" }: TemplateSelectorProps) {
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const supabase = createSupabaseBrowserClient();
    const { data } = await supabase
      .from("post_templates")
      .select("id, name, is_default")
      .eq("content_type", contentType)
      .order("is_default", { ascending: false })
      .order("name", { ascending: true });

    const rows = (data ?? []) as TemplateOption[];
    if (rows.length > 0) {
      setTemplates(rows);
      if (!value) {
        const def = rows.find((t) => t.is_default) ?? rows[0];
        if (def) onChange(def.id);
      }
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentType]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return <p className="text-xs text-iron-grey">Loading templates...</p>;
  }

  if (templates.length === 0) {
    return <p className="text-xs text-red-accent">No templates found for {contentType}. Create one on the Post Templates admin page.</p>;
  }

  return (
    <div>
      <label className="block text-sm font-semibold text-bark-brown mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-md border border-bark-brown-light bg-parchment text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-gnome-green cursor-pointer"
      >
        {templates.map((t) => (
          <option key={t.id} value={t.id}>{t.name}{t.is_default ? " (Default)" : ""}</option>
        ))}
      </select>
    </div>
  );
}
