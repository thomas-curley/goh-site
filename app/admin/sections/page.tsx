"use client";

import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/Card";
import { SITE_SECTIONS } from "@/lib/site-sections";
import { ASSIGNABLE_ROLES } from "@/lib/permissions";

interface VisibilityRow {
  id: string;
  role: string;
  section_key: string;
  visible: boolean;
}

export default function AdminSectionsPage() {
  const [rows, setRows] = useState<VisibilityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/section-visibility");
    const data = await res.json().catch(() => ({}));
    if (res.ok) setRows(data.visibility ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Absence of a row means visible -- fails open, same default the backend uses.
  const isVisible = (role: string, sectionKey: string): boolean => {
    const row = rows.find((r) => r.role === role && r.section_key === sectionKey);
    return row?.visible ?? true;
  };

  const toggle = async (role: string, sectionKey: string) => {
    setSaving(true);
    setStatus(null);
    const nextVisible = !isVisible(role, sectionKey);

    await fetch("/api/admin/section-visibility", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role, sectionKey, visible: nextVisible }),
    });

    await load();
    setStatus(`Updated ${role} → ${sectionKey}`);
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-parchment-dark border-t-gnome-green rounded-full animate-spin" />
      </div>
    );
  }

  const sortedRoles = [...ASSIGNABLE_ROLES].sort((a, b) => b.order - a.order);

  return (
    <div>
      <h1 className="font-display text-3xl text-gnome-green mb-2">Section Visibility</h1>
      <p className="text-sm text-bark-brown-light mb-6">
        Control which ranks (and Guests -- anyone not registered or not signed in) can see each part of the
        public site. Everything is visible by default until you uncheck it here.
      </p>

      {status && (
        <div className="mb-4 p-3 rounded-md bg-gnome-green/10 border border-gnome-green/30 text-sm text-gnome-green">
          {status}
        </div>
      )}

      {/* Desktop table */}
      <Card hover={false} className="overflow-x-auto hidden md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-bark-brown-light">
              <th className="text-left py-3 pr-4 text-iron-grey font-semibold">Rank</th>
              {SITE_SECTIONS.map((section) => (
                <th
                  key={section.key}
                  className="text-center py-3 px-2 text-iron-grey font-semibold"
                  title={section.description}
                >
                  <div className="text-xs leading-tight">{section.label}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedRoles.map((role) => (
              <tr key={role.key} className="border-b border-parchment-dark last:border-0">
                <td className="py-3 pr-4">
                  <span className="font-semibold text-bark-brown">{role.name}</span>
                </td>
                {SITE_SECTIONS.map((section) => {
                  const visible = isVisible(role.key, section.key);
                  return (
                    <td key={section.key} className="text-center py-3 px-2">
                      <button
                        onClick={() => toggle(role.key, section.key)}
                        disabled={saving}
                        className={`w-8 h-8 rounded-md border-2 transition-colors cursor-pointer inline-flex items-center justify-center ${
                          visible
                            ? "bg-gnome-green border-gnome-green"
                            : "bg-transparent border-bark-brown-light hover:border-gnome-green"
                        }`}
                        title={`${visible ? "Hide" : "Show"} "${section.label}" for ${role.name}`}
                      >
                        {visible && (
                          <svg className="w-4 h-4 text-text-light" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* Mobile cards */}
      <div className="md:hidden space-y-4">
        {sortedRoles.map((role) => (
          <Card key={role.key} hover={false}>
            <h3 className="font-display text-lg text-bark-brown mb-3">{role.name}</h3>
            <div className="space-y-2">
              {SITE_SECTIONS.map((section) => {
                const visible = isVisible(role.key, section.key);
                return (
                  <button
                    key={section.key}
                    onClick={() => toggle(role.key, section.key)}
                    disabled={saving}
                    className="w-full flex items-center justify-between py-2 px-3 rounded-md hover:bg-parchment-dark transition-colors cursor-pointer"
                  >
                    <div className="text-left">
                      <p className="text-sm font-semibold text-bark-brown">{section.label}</p>
                      <p className="text-xs text-iron-grey">{section.description}</p>
                    </div>
                    <div
                      className={`w-6 h-6 rounded border-2 shrink-0 ml-3 flex items-center justify-center ${
                        visible ? "bg-gnome-green border-gnome-green" : "border-bark-brown-light"
                      }`}
                    >
                      {visible && (
                        <svg className="w-3 h-3 text-text-light" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </Card>
        ))}
      </div>

      <Card hover={false} className="mt-6 bg-parchment-dark">
        <h3 className="font-display text-base text-bark-brown mb-2">How this works</h3>
        <ul className="space-y-1 text-xs text-bark-brown-light">
          <li>• Guests are anyone not signed in, or signed in without a linked &amp; verified RSN</li>
          <li>• A checked box means that rank can see the section; unchecked hides it and blocks the page directly</li>
          <li>• A section with no boxes unchecked for a rank is visible to it by default</li>
        </ul>
      </Card>
    </div>
  );
}
