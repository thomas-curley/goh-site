"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";

interface DiscordRole {
  id: string;
  name: string;
  color: string | null;
}

interface RolePingSelectorProps {
  selectedRoles: string[];
  onChange: (roleIds: string[]) => void;
}

const BUILT_IN_OPTIONS: DiscordRole[] = [
  { id: "@everyone", name: "@everyone", color: null },
  { id: "@here", name: "@here", color: null },
];

export function RolePingSelector({ selectedRoles, onChange }: RolePingSelectorProps) {
  const [roles, setRoles] = useState<DiscordRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRoles() {
      try {
        const res = await fetch("/api/discord/roles");
        if (res.ok) {
          const data = await res.json();
          setRoles(data.roles ?? []);
        }
      } catch {
        // Discord not configured
      } finally {
        setLoading(false);
      }
    }
    fetchRoles();
  }, []);

  const allOptions = [...BUILT_IN_OPTIONS, ...roles];
  const available = allOptions.filter((r) => !selectedRoles.includes(r.id));

  const addRole = (roleId: string) => {
    if (roleId && !selectedRoles.includes(roleId)) {
      onChange([...selectedRoles, roleId]);
    }
  };

  const removeRole = (roleId: string) => {
    onChange(selectedRoles.filter((id) => id !== roleId));
  };

  const getRoleName = (id: string) => allOptions.find((r) => r.id === id)?.name ?? id;
  const getRoleColor = (id: string) => allOptions.find((r) => r.id === id)?.color ?? null;

  if (loading) {
    return <p className="text-xs text-iron-grey">Loading roles...</p>;
  }

  return (
    <div>
      <label className="block text-sm font-semibold text-bark-brown mb-2">
        Ping Roles (optional)
      </label>

      {/* Selected roles as removable tags */}
      {selectedRoles.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {selectedRoles.map((id) => (
            <span
              key={id}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-gnome-green/15 text-gnome-green border border-gnome-green/30"
              style={getRoleColor(id) ? {
                backgroundColor: `${getRoleColor(id)}20`,
                color: getRoleColor(id)!,
                borderColor: `${getRoleColor(id)}50`,
              } : undefined}
            >
              @{getRoleName(id)}
              <button
                type="button"
                onClick={() => removeRole(id)}
                className="hover:opacity-70 cursor-pointer"
                aria-label={`Remove @${getRoleName(id)}`}
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Add role row */}
      {available.length > 0 && (
        <div className="flex gap-2">
          <select
            id="role-ping-select"
            defaultValue=""
            onChange={(e) => {
              addRole(e.target.value);
              e.target.value = "";
            }}
            className="flex-1 px-3 py-2 rounded-md border border-bark-brown-light bg-parchment text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-gnome-green cursor-pointer"
          >
            <option value="" disabled>Select a role to ping...</option>
            {available.map((role) => (
              <option key={role.id} value={role.id}>@{role.name}</option>
            ))}
          </select>
        </div>
      )}

      {selectedRoles.length === 0 && (
        <p className="text-xs text-iron-grey mt-1">No roles selected — post won&apos;t ping anyone.</p>
      )}
    </div>
  );
}

/**
 * Convert selected role IDs to Discord mention format for message content.
 */
export function formatRolePings(roleIds: string[]): string {
  if (roleIds.length === 0) return "";

  return roleIds.map((id) => {
    if (id === "@everyone") return "@everyone";
    if (id === "@here") return "@here";
    return `<@&${id}>`;
  }).join(" ");
}
