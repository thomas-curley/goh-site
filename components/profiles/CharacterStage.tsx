"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";
import { ItemIcon } from "@/components/profiles/EquipmentPanel";
import type { Character } from "@/lib/osrs-character";
import { SLOT_LABELS, wikiItemPage, type EquipmentSlot } from "@/lib/profiles-format";

const CharacterViewer = dynamic(() => import("@/components/profiles/CharacterViewer").then((m) => m.CharacterViewer), {
  ssr: false,
  loading: () => <div className="w-full h-full" />,
});

const LEFT: EquipmentSlot[] = ["head", "neck", "cape", "body", "legs", "feet"];
const RIGHT: EquipmentSlot[] = ["weapon", "shield", "hands", "ring", "ammo"];

function Slot({ character, slot }: { character: Character; slot: EquipmentSlot }) {
  const item = character.gear[slot];
  const className = "w-11 h-11 sm:w-12 sm:h-12 rounded flex items-center justify-center overflow-hidden";
  const style = { background: "rgba(40, 32, 22, 0.85)", boxShadow: "inset 0 0 0 1px #6b5d48, 0 1px 2px rgba(0,0,0,0.5)" };
  if (!item) {
    return (
      <div className={className} style={style} title={`${SLOT_LABELS[slot]}: empty`}>
        <span className="text-[8px] uppercase tracking-wide text-[#8a7b63]">{SLOT_LABELS[slot]}</span>
      </div>
    );
  }
  return (
    <a href={wikiItemPage(item.name)} target="_blank" rel="noreferrer" title={`${SLOT_LABELS[slot]}: ${item.name}`} className={`${className} hover:brightness-125`} style={style}>
      <ItemIcon key={item.id} item={item} />
    </a>
  );
}

/**
 * The character "stage" on a profile, like an armory page: the 3D character
 * in the middle, with their worn items down each side.
 */
export function CharacterStage({ character, title, footer }: { character: Character; title: ReactNode; footer?: ReactNode }) {
  return (
    <div
      className="rounded-lg overflow-hidden border border-[#6b5d48] shadow-lg"
      style={{ background: "radial-gradient(ellipse at 50% 40%, #5a4a34 0%, #2e2519 65%, #1d1710 100%)" }}
    >
      <div className="px-4 pt-4 text-center">{title}</div>
      <div className="flex items-stretch gap-2 px-2 sm:px-3 pb-3">
        <div className="flex flex-col justify-center gap-2">
          {LEFT.map((s) => (
            <Slot key={s} character={character} slot={s} />
          ))}
        </div>
        <div className="flex-1 min-w-0 h-[380px] sm:h-[420px]">
          <CharacterViewer character={character} className="w-full h-full" />
        </div>
        <div className="flex flex-col justify-center gap-2">
          {RIGHT.map((s) => (
            <Slot key={s} character={character} slot={s} />
          ))}
        </div>
      </div>
      {footer && <div className="px-4 pb-4 text-center">{footer}</div>}
    </div>
  );
}
