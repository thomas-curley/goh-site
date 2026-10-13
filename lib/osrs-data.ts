// Client-side loading of the item, kit and texture tables in public/osrs.

import { OSRS_DATA_URL, type OsrsItem, type OsrsKit } from "@/lib/osrs-character";

export interface OsrsData {
  items: Map<number, OsrsItem>;
  itemList: OsrsItem[];
  kits: Map<number, OsrsKit>;
  kitList: OsrsKit[];
  textures: Record<string, number>;
}

let pending: Promise<OsrsData> | null = null;

export function loadOsrsData(): Promise<OsrsData> {
  if (!pending) {
    const get = <T,>(name: string): Promise<T> =>
      fetch(`${OSRS_DATA_URL}/${name}.json`).then((r) => {
        if (!r.ok) throw new Error(`Couldn't load ${name}`);
        return r.json() as Promise<T>;
      });
    pending = Promise.all([get<OsrsItem[]>("items"), get<OsrsKit[]>("kits"), get<Record<string, number>>("textures")])
      .then(([itemList, kitList, textures]) => ({
        items: new Map(itemList.map((i) => [i.id, i])),
        itemList,
        kits: new Map(kitList.map((k) => [k.id, k])),
        kitList,
        textures,
      }))
      .catch((err) => {
        pending = null;
        throw err;
      });
  }
  return pending;
}
