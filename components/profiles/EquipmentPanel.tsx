"use client";

import { useState } from "react";
import { SLOT_LABELS, wikiItemIcon, wikiItemPage, type EquipmentSlot, type Outfit } from "@/lib/profiles-format";

// In-game Worn Equipment layout: 3 columns, empty cells are null.
const LAYOUT: (EquipmentSlot | null)[][] = [
  [null, "head", null],
  ["cape", "neck", "ammo"],
  ["weapon", "body", "shield"],
  [null, "legs", null],
  ["hands", "feet", "ring"],
];

function SlotIcon({ name }: { name: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <span className="text-[10px] leading-tight text-center text-parchment/90 px-1 line-clamp-3">{name}</span>;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={wikiItemIcon(name)} alt={name} onError={() => setFailed(true)} className="max-w-[36px] max-h-[32px] object-contain [image-rendering:pixelated]" />
  );
}

/**
 * An outfit drawn like the in-game Worn Equipment tab: stone slots in the
 * familiar cross layout, each with the item's wiki icon (or its name if the
 * wiki has no icon by that name). Optional onSlotClick makes slots buttons,
 * for the outfit editor.
 */
export function EquipmentPanel({
  outfit,
  onSlotClick,
  activeSlot,
}: {
  outfit: Outfit;
  onSlotClick?: (slot: EquipmentSlot) => void;
  activeSlot?: EquipmentSlot | null;
}) {
  return (
    <div className="inline-grid grid-cols-3 gap-2 rounded-lg p-3" style={{ background: "#3e3529", boxShadow: "inset 0 0 0 2px #2a2318" }}>
      {LAYOUT.flat().map((slot, i) => {
        if (!slot) return <div key={i} className="w-12 h-12" />;
        const item = outfit[slot];
        const content = item ? <SlotIcon name={item.name} /> : <span className="text-[9px] uppercase tracking-wide text-[#8a7b63]">{SLOT_LABELS[slot]}</span>;
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
