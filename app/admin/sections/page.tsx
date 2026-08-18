"use client";

import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/Card";
import { SITE_SECTIONS } from "@/lib/site-sections";

interface SectionRow {
  key: string;
  staff_only: boolean;
  updated_by: string | null;
  updated_at: string;
}

export default function AdminSectionsPage() {
  const [sections, setSections] = useState<SectionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/sections");
    const data = await res.json().catch(() => ({}));
    setSections(res.ok ? data.sections ?? [] : []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const isStaffOnly = (key: string) => sections.find((s) => s.key === key)?.staff_only ?? false;

  const toggle = async (key: string) => {
    setSavingKey(key);
    await fetch("/api/admin/sections", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, staffOnly: !isStaffOnly(key) }),
    });
    await load();
    setSavingKey(null);
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
      <h1 className="font-display text-3xl text-gnome-green mb-2">Section Visibility</h1>
      <p className="text-sm text-bark-brown-light mb-6">
        Toggle a section staff-only to hide its nav links and lock the pages themselves down while a feature
        isn&apos;t released yet. Turning a toggle off restores the section&apos;s normal access level.
      </p>

      <div className="space-y-3">
        {SITE_SECTIONS.map((section) => {
          const staffOnly = isStaffOnly(section.key);
          const row = sections.find((s) => s.key === section.key);
          return (
            <Card key={section.key} hover={false}>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-semibold text-bark-brown">{section.label}</p>
                  <p className="text-xs text-iron-grey mt-0.5">{section.description}</p>
                  {row?.updated_by && (
                    <p className="text-xs text-iron-grey mt-1">
                      Last changed by {row.updated_by} on {new Date(row.updated_at).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => toggle(section.key)}
                  disabled={savingKey === section.key}
                  className={`shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-md border-2 text-sm font-semibold transition-colors cursor-pointer ${
                    staffOnly
                      ? "bg-gnome-green/15 border-gnome-green text-gnome-green"
                      : "border-bark-brown-light text-bark-brown-light hover:border-gnome-green"
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                      staffOnly ? "bg-gnome-green border-gnome-green" : "border-bark-brown-light"
                    }`}
                  >
                    {staffOnly && (
                      <svg className="w-3 h-3 text-text-light" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </span>
                  {savingKey === section.key ? "Saving..." : staffOnly ? "Staff Only" : "Visible"}
                </button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
