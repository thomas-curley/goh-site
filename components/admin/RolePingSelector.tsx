"use client";

import { useState, useEffect } from "react";

interface DiscordRole {
  id: string;
  name: string;
  color: string | null;
}

interface RolePingSelectorProps {
  selectedRoles: string[]; // role IDs
  onChange: (roleIds: string[]) => void;
}

// Built-in options that aren't real roles
const BUILT_IN_OPTIONS = [
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

  const toggle = (roleId: string) => {
    if (selectedRoles.includes(roleId)) {
      onChange(selectedRoles.filter((id) => id !== roleId));
    } else {
      onChange([...selectedRoles, roleId]);
    }
  };

  if (loading) {
    return <p className="text-xs text-iron-grey">Loading roles...</p>;
  }

  return (
    <div>
      <label className="block text-sm font-semibold text-bark-brown mb-2">
        Ping Roles (optional)
      </label>
      <div className="flex flex-wrap gap-2">
        {allOptions.map((role) => {
          const isSelected = selectedRoles.includes(role.id);
          return (
            <button
              key={role.id}
              type="button"
              onClick={() => toggle(role.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors cursor-pointer border ${
                isSelected
                  ? "bg-gnome-green border-gnome-green text-text-light"
                  : "border-bark-brown-light text-bark-brown-light hover:border-gnome-green hover:text-gnome-green"
              }`}
              style={
                isSelected && role.color
                  ? { backgroundColor: role.color, borderColor: role.color }
                  : undefined
              }
            >
              @{role.name}
            </button>
          );
        })}
      </div>
      {selectedRoles.length > 0 && (
        <p className="text-xs text-iron-grey mt-2">
          Will ping: {selectedRoles.map((id) => {
            const role = allOptions.find((r) => r.id === id);
            return `@${role?.name ?? id}`;
          }).join(", ")}
        </p>
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
