// Pulls everything the member-profile character viewer needs out of the
// Old School RuneScape game cache: every wearable item, the body-part kits a
// player can pick in the character creator, texture fallback colours, and a
// compact copy of each 3D model they use.
//
//   node extract.mjs [outDir]     (downloads the latest cache from archive.openrs2.org)
//
// osrscachereader handles the cache containers; item and kit definitions are
// decoded here because the library's decoders predate the current formats
// (32-bit model ids). Decoding follows RuneLite's cache loaders.

import fs from "node:fs";
import path from "node:path";
import { RSCache, IndexType, ConfigType } from "osrscachereader";

const OUT = path.resolve(process.argv[2] ?? "out");

class Reader {
  constructor(bytes) {
    this.b = bytes;
    this.p = 0;
  }
  u8() {
    return this.b[this.p++];
  }
  i8() {
    const v = this.u8();
    return v > 127 ? v - 256 : v;
  }
  u16() {
    const v = (this.b[this.p] << 8) | this.b[this.p + 1];
    this.p += 2;
    return v;
  }
  i16() {
    const v = this.u16();
    return v > 32767 ? v - 65536 : v;
  }
  u24() {
    const v = (this.b[this.p] << 16) | (this.b[this.p + 1] << 8) | this.b[this.p + 2];
    this.p += 3;
    return v;
  }
  i32() {
    const v = (this.b[this.p] << 24) | (this.b[this.p + 1] << 16) | (this.b[this.p + 2] << 8) | this.b[this.p + 3];
    this.p += 4;
    return v;
  }
  str() {
    let s = "";
    for (;;) {
      const c = this.u8();
      if (c === 0) return s;
      s += String.fromCharCode(c);
    }
  }
  params() {
    const n = this.u8();
    for (let i = 0; i < n; i++) {
      const type = this.u8();
      this.u24();
      if (type === 1) this.str();
      else if (type === 2) this.p += 8;
      else this.p += 4;
    }
  }
}

function decodeItem(bytes, id) {
  const r = new Reader(bytes);
  const d = {
    id,
    name: null,
    wearPos1: -1,
    wearPos2: -1,
    wearPos3: -1,
    m: [-1, -1, -1],
    f: [-1, -1, -1],
    mo: 0,
    fo: 0,
    rf: [],
    rr: [],
    tf: [],
    tr: [],
    noted: false,
    template: false,
  };
  for (;;) {
    const op = r.u8();
    if (op === 0) return d;
    if (op === 1) r.u16();
    else if (op === 2) d.name = r.str();
    else if (op === 3 || op === 9) r.str();
    else if (op >= 4 && op <= 8) r.u16();
    else if (op === 11 || op === 15 || op === 16 || op === 65 || op === 160 || op === 251) {
      // flags
    } else if (op === 12) r.i32();
    else if (op === 13) d.wearPos1 = r.i8();
    else if (op === 14) d.wearPos2 = r.i8();
    else if (op === 23) {
      d.m[0] = r.u16();
      d.mo = r.u8();
    } else if (op === 24) d.m[1] = r.u16();
    else if (op === 25) {
      d.f[0] = r.u16();
      d.fo = r.u8();
    } else if (op === 26) d.f[1] = r.u16();
    else if (op === 27) d.wearPos3 = r.i8();
    else if (op >= 30 && op < 40) r.str();
    else if (op === 40 || op === 41) {
      const n = r.u8();
      for (let i = 0; i < n; i++) {
        const find = r.u16();
        const repl = r.u16();
        if (op === 40) {
          d.rf.push(find);
          d.rr.push(repl);
        } else {
          d.tf.push(find);
          d.tr.push(repl);
        }
      }
    } else if (op === 42) r.i8();
    else if (op === 43) {
      r.u8();
      while (r.u8() !== 0) r.str();
    } else if (op === 44) r.i32();
    else if (op === 45) {
      d.m[0] = r.i32();
      d.mo = r.u8();
    } else if (op === 46) d.m[1] = r.i32();
    else if (op === 47) d.m[2] = r.i32();
    else if (op === 48) {
      d.f[0] = r.i32();
      d.fo = r.u8();
    } else if (op === 49) d.f[1] = r.i32();
    else if (op === 50) d.f[2] = r.i32();
    else if (op >= 51 && op <= 54) r.i32();
    else if (op === 75) r.i16();
    else if (op === 78) d.m[2] = r.u16();
    else if (op === 79) d.f[2] = r.u16();
    else if (op >= 90 && op <= 95) r.u16();
    else if (op === 97) r.u16();
    else if (op === 98) {
      r.u16();
      d.noted = true;
    } else if (op === 99) r.u16();
    else if (op >= 100 && op < 110) {
      r.u16();
      r.u16();
    } else if (op >= 110 && op <= 112) r.u16();
    else if (op === 113 || op === 114 || op === 115) r.u8();
    else if (op === 139 || op === 148) r.u16();
    else if (op === 140 || op === 149) {
      r.u16();
      d.template = true;
    } else if (op === 161) {
      const n = r.u16();
      r.p += n * 2;
    } else if (op === 200) {
      r.u8();
      r.u8();
      r.str();
    } else if (op === 201) {
      r.u8();
      r.u16();
      r.u16();
      r.i32();
      r.i32();
      r.str();
    } else if (op === 202) {
      r.u8();
      r.u16();
      r.u16();
      r.u16();
      r.i32();
      r.i32();
      r.str();
    } else if (op === 249) r.params();
    else throw new Error(`item ${id}: unknown opcode ${op}`);
  }
}

function decodeKit(bytes, id) {
  const r = new Reader(bytes);
  const d = { id, part: -1, models: [], sel: true, rf: [], rr: [] };
  for (;;) {
    const op = r.u8();
    if (op === 0) return d;
    if (op === 1) d.part = r.u8();
    else if (op === 2 || op === 5) {
      const n = r.u8();
      d.models = [];
      for (let i = 0; i < n; i++) d.models.push(op === 2 ? r.u16() : r.i32());
    } else if (op === 3) d.sel = false;
    else if (op === 40 || op === 41) {
      const n = r.u8();
      for (let i = 0; i < n; i++) {
        const find = r.i16();
        const repl = r.i16();
        if (op === 40) {
          d.rf.push(find & 0xffff);
          d.rr.push(repl & 0xffff);
        }
      }
    } else if (op >= 60 && op < 70) r.u16();
    else if (op >= 70 && op < 80) r.i32();
    else throw new Error(`kit ${id}: unknown opcode ${op}`);
  }
}

// Sequence (animation) definitions; only the frame list is kept.
function decodeSequence(bytes, id) {
  const r = new Reader(bytes);
  const d = { id, frameLengths: [], frameIds: [], mayaId: -1 };
  for (;;) {
    const op = r.u8();
    if (op === 0) return d;
    if (op === 1) {
      const n = r.u16();
      for (let i = 0; i < n; i++) d.frameLengths.push(r.u16());
      for (let i = 0; i < n; i++) d.frameIds.push(r.u16());
      for (let i = 0; i < n; i++) d.frameIds[i] += r.u16() * 65536;
    } else if (op === 2 || op === 6 || op === 7) r.u16();
    else if (op === 3) {
      const n = r.u8();
      r.p += n;
    } else if (op === 4 || op === 19) {
      // flags
    } else if (op === 5 || (op >= 8 && op <= 11)) r.u8();
    else if (op === 12) {
      const n = r.u8();
      r.p += n * 4;
    } else if (op === 13) d.mayaId = r.i32();
    else if (op === 14) {
      const n = r.u16();
      r.p += n * 7;
    } else if (op === 15) r.p += 4;
    else if (op === 16) r.i8();
    else if (op === 17) {
      const n = r.u8();
      r.p += n;
    } else if (op === 18) r.str();
    else throw new Error(`sequence ${id}: unknown opcode ${op}`);
  }
}

class ItemLoader {
  load(bytes, id) {
    return decodeItem(bytes, id);
  }
}
class KitLoader {
  load(bytes, id) {
    return decodeKit(bytes, id);
  }
}
ConfigType.ITEM.loader = ItemLoader;
ConfigType.IDENTKIT.loader = KitLoader;
ConfigType.SEQUENCE.loader = class {
  load(bytes, id) {
    return decodeSequence(bytes, id);
  }
};

/** The player's standing animation, used to pose the character. */
const STAND_ANIMATION = 808;

/**
 * Compact model file (little-endian):
 *   "OSM1", u32 vertexCount, u32 faceCount,
 *   u8 flags (1 alpha, 2 textures, 4 int32 vertices, 8 vertex labels)
 *   vertices: x,y,z per vertex (int16, or int32 with flag 4)
 *   faces:    a,b,c per face (uint16 if vertexCount <= 65536, else uint32)
 *   colours:  uint16 HSL per face
 *   types:    uint8 render type per face
 *   alphas:   uint8 per face (flag 1; 0 = opaque)
 *   textures: int16 per face (flag 2; -1 = none)
 *   labels:   uint16 per vertex (flag 8; which animation group moves it)
 */
function packModel(m) {
  const vc = m.vertexCount;
  const fc = m.faceCount;
  const hasAlpha = Array.isArray(m.faceAlphas) && m.faceAlphas.length > 0 && m.faceAlphas.some((a) => a);
  const hasTex = Array.isArray(m.faceTextures) && m.faceTextures.some((t) => t >= 0);
  let wide = false;
  for (const arr of [m.vertexPositionsX, m.vertexPositionsY, m.vertexPositionsZ]) {
    for (let i = 0; i < vc; i++) if (arr[i] < -32768 || arr[i] > 32767) wide = true;
  }
  const labels = new Uint16Array(vc);
  let hasLabels = false;
  (m.vertexGroups ?? []).forEach((group, label) => {
    for (const v of group ?? []) {
      if (v < vc) labels[v] = label;
      if (label) hasLabels = true;
    }
  });
  const vBytes = wide ? 4 : 2;
  const iBytes = vc > 65536 ? 4 : 2;
  const size = 13 + vc * 3 * vBytes + fc * 3 * iBytes + fc * 2 + fc + (hasAlpha ? fc : 0) + (hasTex ? fc * 2 : 0) + (hasLabels ? vc * 2 : 0);
  const buf = Buffer.alloc(size);
  let p = 0;
  buf.write("OSM1", 0, "ascii");
  p = 4;
  buf.writeUInt32LE(vc, p);
  buf.writeUInt32LE(fc, p + 4);
  buf.writeUInt8((hasAlpha ? 1 : 0) | (hasTex ? 2 : 0) | (wide ? 4 : 0) | (hasLabels ? 8 : 0), p + 8);
  p += 9;
  for (let i = 0; i < vc; i++) {
    for (const arr of [m.vertexPositionsX, m.vertexPositionsY, m.vertexPositionsZ]) {
      if (wide) buf.writeInt32LE(arr[i] | 0, p);
      else buf.writeInt16LE(arr[i] | 0, p);
      p += vBytes;
    }
  }
  for (let i = 0; i < fc; i++) {
    for (const arr of [m.faceVertexIndices1, m.faceVertexIndices2, m.faceVertexIndices3]) {
      if (iBytes === 4) buf.writeUInt32LE(arr[i], p);
      else buf.writeUInt16LE(arr[i], p);
      p += iBytes;
    }
  }
  for (let i = 0; i < fc; i++, p += 2) buf.writeUInt16LE((m.faceColors[i] ?? 0) & 0xffff, p);
  for (let i = 0; i < fc; i++, p += 1) buf.writeUInt8((m.faceRenderTypes?.[i] ?? 0) & 0xff, p);
  if (hasAlpha) for (let i = 0; i < fc; i++, p += 1) buf.writeUInt8((m.faceAlphas[i] ?? 0) & 0xff, p);
  if (hasTex) for (let i = 0; i < fc; i++, p += 2) buf.writeInt16LE(m.faceTextures[i] ?? -1, p);
  if (hasLabels) for (let i = 0; i < vc; i++, p += 2) buf.writeUInt16LE(labels[i], p);
  return buf;
}

async function latestCache() {
  const list = await (await fetch("https://archive.openrs2.org/caches.json")).json();
  const complete = list
    .filter((c) => c.game === "oldschool" && c.environment === "live" && c.timestamp && c.groups && c.valid_groups === c.groups)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  if (!complete.length) throw new Error("No complete OSRS cache on openrs2");
  return complete[0];
}

const info = await latestCache();
console.log(`Cache ${info.id} (${info.timestamp}, build ${info.builds?.[0]?.major ?? "?"})`);
const zipPath = path.join(OUT, "..", `cache-${info.id}.zip`);
fs.mkdirSync(path.join(OUT, "models"), { recursive: true });
if (!fs.existsSync(zipPath)) {
  const res = await fetch(`https://archive.openrs2.org/caches/${info.scope}/${info.id}/disk.zip`);
  if (!res.ok) throw new Error(`Cache download failed: ${res.status}`);
  fs.writeFileSync(zipPath, Buffer.from(await res.arrayBuffer()));
}

const cache = new RSCache(zipPath);
await cache.onload;

const itemDefs = (await cache.getAllDefs(IndexType.CONFIGS, ConfigType.ITEM)).filter(Boolean);
const kitDefs = (await cache.getAllDefs(IndexType.CONFIGS, ConfigType.IDENTKIT)).filter(Boolean);

// Wearable, real items only (no noted/placeholder copies), one per distinct look.
const seen = new Set();
const items = [];
for (const d of itemDefs) {
  if (d.wearPos1 < 0 || !d.name || d.name === "null" || d.noted || d.template) continue;
  // Rings (12) and ammo (13) aren't drawn on the player but still fill an equipment slot.
  if (d.m[0] < 0 && d.f[0] < 0 && d.wearPos1 !== 12 && d.wearPos1 !== 13) continue;
  const key = JSON.stringify([d.name.toLowerCase(), d.wearPos1, d.m, d.f, d.rf, d.rr, d.tf, d.tr]);
  if (seen.has(key)) continue;
  seen.add(key);
  const hide = [d.wearPos2, d.wearPos3].filter((s) => s >= 0);
  items.push({
    id: d.id,
    name: d.name,
    slot: d.wearPos1,
    ...(hide.length ? { hide } : {}),
    m: d.m.filter((x) => x >= 0),
    f: d.f.filter((x) => x >= 0),
    ...(d.mo ? { mo: d.mo } : {}),
    ...(d.fo ? { fo: d.fo } : {}),
    ...(d.rf.length ? { rf: d.rf, rr: d.rr } : {}),
    ...(d.tf.length ? { tf: d.tf, tr: d.tr } : {}),
  });
}
const kits = kitDefs
  .filter((k) => k.part >= 0 && k.models.length)
  .map((k) => ({ id: k.id, part: k.part, models: k.models, ...(k.sel ? {} : { hidden: true }), ...(k.rf.length ? { rf: k.rf, rr: k.rr } : {}) }));

// Texture fallback colours (HSL), used instead of drawing texture images.
const textures = {};
const texFiles = (await cache.getAllFiles(IndexType.TEXTURES, 0).catch(() => [])) ?? [];
for (const f of texFiles) {
  if (!f?.content || f.content.length < 4) continue;
  const r = new Reader(f.content);
  r.u16();
  textures[f.id] = r.u16();
}

const modelIds = new Set();
for (const it of items) for (const m of [...it.m, ...it.f]) modelIds.add(m);
for (const k of kits) for (const m of k.models) modelIds.add(m);

let written = 0;
let bytes = 0;
const missing = [];
for (const id of modelIds) {
  let m;
  try {
    m = await cache.getDef(IndexType.MODELS, id);
  } catch {
    m = null;
  }
  if (!m || !m.vertexCount) {
    missing.push(id);
    continue;
  }
  const buf = packModel(m);
  fs.writeFileSync(path.join(OUT, "models", `${id}.bin`), buf);
  written++;
  bytes += buf.length;
}

// Items whose models couldn't be read would render as nothing; drop them.
const missingSet = new Set(missing);
const usable = items.filter((it) => ![...it.m, ...it.f].some((m) => missingSet.has(m)));

// Standing pose: every frame of the stand animation, against its skeleton.
let pose = null;
try {
  const seq = await cache.getDef(IndexType.CONFIGS, ConfigType.SEQUENCE, STAND_ANIMATION);
  if (!seq.frameIds.length) throw new Error(`no frames (skeletal animation ${seq.mayaId})`);
  const frames = [];
  let skeleton = null;
  for (let i = 0; i < seq.frameIds.length; i++) {
    const frameId = seq.frameIds[i];
    const frame = await cache.getDef(IndexType.FRAMES, frameId >>> 16, frameId & 0xffff);
    skeleton ??= frame.framemap;
    frames.push({
      length: seq.frameLengths[i],
      steps: frame.indexFrameIds.map((g, j) => [g, frame.translator_x[j], frame.translator_y[j], frame.translator_z[j]]),
    });
  }
  pose = { animation: STAND_ANIMATION, types: skeleton.types, groups: skeleton.frameMaps, frames };
} catch (err) {
  console.warn("Couldn't extract the stand animation:", err);
}

const meta = {
  cacheId: info.id,
  cacheTimestamp: info.timestamp,
  build: info.builds?.[0]?.major ?? null,
  items: usable.length,
  kits: kits.length,
  models: written,
  modelBytes: bytes,
  missingModels: missing.length,
  poseFrames: pose?.frames.length ?? 0,
};
fs.writeFileSync(path.join(OUT, "items.json"), JSON.stringify(usable));
fs.writeFileSync(path.join(OUT, "kits.json"), JSON.stringify(kits));
fs.writeFileSync(path.join(OUT, "textures.json"), JSON.stringify(textures));
if (pose) fs.writeFileSync(path.join(OUT, "pose.json"), JSON.stringify(pose));
fs.writeFileSync(path.join(OUT, "meta.json"), JSON.stringify(meta, null, 2));
console.log(meta);
process.exit(0);
