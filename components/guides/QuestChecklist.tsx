"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";

interface Quest {
  name: string;
  unlock: string;
  wikiUrl?: string;
  difficulty?: "Novice" | "Intermediate" | "Experienced" | "Master" | "Grandmaster";
}

interface QuestChecklistProps {
  title: string;
  quests: Quest[];
}

const DIFFICULTY_COLORS: Record<string, string> = {
  Novice: "text-gnome-green-light",
  Intermediate: "text-gnome-green",
  Experienced: "text-gold",
  Master: "text-red-accent",
  Grandmaster: "text-red-accent font-bold",
};

export function QuestChecklist({ title, quests }: QuestChecklistProps) {
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const toggle = (name: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  return (
    <Card hover={false}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display text-lg text-gnome-green">{title}</h3>
        <span className="text-xs text-iron-grey">
          {checked.size}/{quests.length} complete
        </span>
      </div>
      <ul className="space-y-2">
        {quests.map((quest) => (
          <li key={quest.name} className="flex items-start gap-3">
            <button
              onClick={() => toggle(quest.name)}
              className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
                checked.has(quest.name)
                  ? "bg-gnome-green border-gnome-green"
                  : "border-bark-brown-light hover:border-gnome-green"
              }`}
            >
              {checked.has(quest.name) && (
                <svg className="w-3 h-3 text-text-light" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className={`text-sm font-semibold ${checked.has(quest.name) ? "line-through text-iron-grey" : "text-bark-brown"}`}>
                  {quest.wikiUrl ? (
                    <a href={quest.wikiUrl} target="_blank" rel="noopener noreferrer" className="hover:text-gnome-green">
                      {quest.name}
                    </a>
                  ) : (
                    quest.name
                  )}
                </span>
                {quest.difficulty && (
                  <span className={`text-xs ${DIFFICULTY_COLORS[quest.difficulty] ?? "text-iron-grey"}`}>
                    {quest.difficulty}
                  </span>
                )}
              </div>
              <p className="text-xs text-iron-grey">Unlocks: {quest.unlock}</p>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
