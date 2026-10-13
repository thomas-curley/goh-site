"use client";

import { useState } from "react";
import { itemIconUrl, type CharacterGear, type GearItem } from "@/lib/osrs-character";
import { SLOT_LABELS, wikiItemIcon, wikiItemPage, type EquipmentSlot } from "@/lib/profiles-format";

// In-game Worn Equipment layout: 3 columns, empty cells are null.
const LAYOUT: (EquipmentSlot | null)[][] = [
  [null, "head", null],
  ["cape", "neck", "ammo"],
  ["weapon", "body", "shield"],
  [null, "legs", null],
  ["hands", "feet", "ring"],
];

/** The item's icon: RuneLite's icon by id, then the wiki's by name, then the name. */
export function ItemIcon({ item, className = "max-w-[36px] max-h-[32px]" }: { item: GearItem; className?: string }) {
  const [attempt, setAttempt] = useState(0);
  const sources = [itemIconUrl(item.id), wikiItemIcon(item.name)];
  if (attempt >= sources.length) return <span className="text-[10px] leading-tight text-center text-parchment/90 px-1 line-clamp-3">{item.name}</span>;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      key={attempt}
      src={sources[attempt]}
      alt={item.name}
      onError={() => setAttempt((a) => a + 1)}
      className={`${className} object-contain [image-rendering:pixelated]`}
    />
  );
}

/**
 * Gear drawn like the in-game Worn Equipment tab: stone slots in the
 * familiar cross layout, each with the item's icon (or its name if no icon
 * loads). Optional onSlotClick makes slots buttons, for the editor.
 */
export function EquipmentPanel({
  gear,
  onSlotClick,
  activeSlot,
}: {
  gear: CharacterGear;
  onSlotClick?: (slot: EquipmentSlot) => void;
  activeSlot?: EquipmentSlot | null;
}) {
  return (
    <div className="inline-grid grid-cols-3 gap-2 rounded-lg p-3" style={{ background: "#3e3529", boxShadow: "inset 0 0 0 2px #2a2318" }}>
      {LAYOUT.flat().map((slot, i) => {
        if (!slot) return <div key={i} className="w-12 h-12" />;
        const item = gear[slot];
        const content = item ? <ItemIcon key={item.id} item={item} /> : <span className="text-[9px] uppercase tracking-wide text-[#8a7b63]">{SLOT_LABELS[slot]}</span>;
        const className = `w-12 h-12 rounded flex items-center justify-center overflow-hidden ${
          activeSlot === slot ? "ring-2 ring-gold-light" : ""
        }`;
        const style = { background: "#5b4e3c", boxShadow: "inset 0 0 0 1px #2a2318, inset 0 2px 0 #6b5d48" };
        const title = item ? `${SLOT_LABELS[slot]}: ${item.name}` : `${SLOT_LABELS[slot]}: empty`;
        if (onSlotClick) {
          return (
            <button key={slot} type="button" onClick={() => onSlotClick(slot)} title={title} aria-label={title} className={`${className} cursor-pointer hover:brightness-125`} style={style}>
              {content}
            </button>
          );
        }
        return item ? (
          <a key={slot} href={wikiItemPage(item.name)} target="_blank" rel="noreferrer" title={title} className={`${className} hover:brightness-125`} style={style}>
            {content}
          </a>
        ) : (
          <div key={slot} title={title} className={className} style={style}>
            {content}
          </div>
        );
      })}
    </div>
  );
}
