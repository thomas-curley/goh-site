// Client-side loading of the compact OSRS models in public/osrs/models and
// building a three.js mesh for a composed character (see lib/osrs-character).

import * as THREE from "three";
import { OSRS_DATA_URL, hslToRgb, playerRecolours, type CharacterLook, type ModelPart } from "@/lib/osrs-character";

export interface RawModel {
  vertexCount: number;
  faceCount: number;
  verts: Int32Array;
  a: Uint32Array;
  b: Uint32Array;
  c: Uint32Array;
  colours: Uint16Array;
  types: Uint8Array;
  alphas: Uint8Array | null;
  textures: Int16Array | null;
  /** Animation group of each vertex. */
  labels: Uint16Array | null;
}

/** Parses the "OSM1" format written by scripts/osrs-models/extract.mjs. */
export function parseModel(buffer: ArrayBuffer): RawModel {
  const view = new DataView(buffer);
  const magic = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
  if (magic !== "OSM1") throw new Error("Not an OSRS model file");
  const vc = view.getUint32(4, true);
  const fc = view.getUint32(8, true);
  const flags = view.getUint8(12);
  const wide = (flags & 4) !== 0;
  const wideIdx = vc > 65536;
  let p = 13;
  const verts = new Int32Array(vc * 3);
  for (let i = 0; i < vc * 3; i++) {
    verts[i] = wide ? view.getInt32(p, true) : view.getInt16(p, true);
    p += wide ? 4 : 2;
  }
  const a = new Uint32Array(fc);
  const b = new Uint32Array(fc);
  const c = new Uint32Array(fc);
  for (let i = 0; i < fc; i++) {
    for (const arr of [a, b, c]) {
      arr[i] = wideIdx ? view.getUint32(p, true) : view.getUint16(p, true);
      p += wideIdx ? 4 : 2;
    }
  }
  const colours = new Uint16Array(fc);
  for (let i = 0; i < fc; i++, p += 2) colours[i] = view.getUint16(p, true);
  const types = new Uint8Array(fc);
  for (let i = 0; i < fc; i++, p += 1) types[i] = view.getUint8(p);
  let alphas: Uint8Array | null = null;
  if (flags & 1) {
    alphas = new Uint8Array(fc);
    for (let i = 0; i < fc; i++, p += 1) alphas[i] = view.getUint8(p);
  }
  let textures: Int16Array | null = null;
  if (flags & 2) {
    textures = new Int16Array(fc);
    for (let i = 0; i < fc; i++, p += 2) textures[i] = view.getInt16(p, true);
  }
  let labels: Uint16Array | null = null;
  if (flags & 8) {
    labels = new Uint16Array(vc);
    for (let i = 0; i < vc; i++, p += 2) labels[i] = view.getUint16(p, true);
  }
  return { vertexCount: vc, faceCount: fc, verts, a, b, c, colours, types, alphas, textures, labels };
}

const modelCache = new Map<number, Promise<RawModel | null>>();

export function loadModel(id: number): Promise<RawModel | null> {
  let pending = modelCache.get(id);
  if (!pending) {
    pending = fetch(`${OSRS_DATA_URL}/models/${id}.bin`)
      .then((r) => (r.ok ? r.arrayBuffer() : null))
      .then((buf) => (buf ? parseModel(buf) : null))
      .catch(() => null);
    modelCache.set(id, pending);
  }
  return pending;
}

/** The stand animation: skeleton (transform type + animation groups per step) and frames. */
interface Pose {
  types: number[];
  groups: number[][];
  frames: { length: number; steps: [number, number, number, number][] }[];
}

let posePending: Promise<Pose | null> | null = null;

function loadPose(): Promise<Pose | null> {
  posePending ??= fetch(`${OSRS_DATA_URL}/pose.json`)
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);
  return posePending;
}

/**
 * Applies one animation frame to vertex positions (game coordinates), as the
 * game client does: type 0 sets the pivot, 1 moves, 2 rotates, 3 scales.
 */
function applyFrame(pos: Float64Array, byLabel: number[][], pose: Pose, frame: Pose["frames"][number]) {
  let ox = 0;
  let oy = 0;
  let oz = 0;
  for (const [step, dx, dy, dz] of frame.steps) {
    const type = pose.types[step];
    const labels = pose.groups[step] ?? [];
    if (type === 0) {
      let n = 0;
      ox = oy = oz = 0;
      for (const l of labels) {
        for (const v of byLabel[l] ?? []) {
          ox += pos[v * 3];
          oy += pos[v * 3 + 1];
          oz += pos[v * 3 + 2];
          n++;
        }
      }
      if (n > 0) {
        ox = dx + ox / n;
        oy = dy + oy / n;
        oz = dz + oz / n;
      } else {
        ox = dx;
        oy = dy;
        oz = dz;
      }
    } else if (type === 1) {
      for (const l of labels) {
        for (const v of byLabel[l] ?? []) {
          pos[v * 3] += dx;
          pos[v * 3 + 1] += dy;
          pos[v * 3 + 2] += dz;
        }
      }
    } else if (type === 2) {
      const rx = ((dx & 255) * 8 * Math.PI) / 1024;
      const ry = ((dy & 255) * 8 * Math.PI) / 1024;
      const rz = ((dz & 255) * 8 * Math.PI) / 1024;
      for (const l of labels) {
        for (const v of byLabel[l] ?? []) {
          let x = pos[v * 3] - ox;
          let y = pos[v * 3 + 1] - oy;
          let z = pos[v * 3 + 2] - oz;
          if (rz) {
            const s = Math.sin(rz);
            const c = Math.cos(rz);
            const nx = s * y + c * x;
            y = c * y - s * x;
            x = nx;
          }
          if (rx) {
            const s = Math.sin(rx);
            const c = Math.cos(rx);
            const ny = c * y - s * z;
            z = s * y + c * z;
            y = ny;
          }
          if (ry) {
            const s = Math.sin(ry);
            const c = Math.cos(ry);
            const nx = s * z + c * x;
            z = c * z - s * x;
            x = nx;
          }
          pos[v * 3] = x + ox;
          pos[v * 3 + 1] = y + oy;
          pos[v * 3 + 2] = z + oz;
        }
      }
    } else if (type === 3) {
      for (const l of labels) {
        for (const v of byLabel[l] ?? []) {
          pos[v * 3] = ((pos[v * 3] - ox) * dx) / 128 + ox;
          pos[v * 3 + 1] = ((pos[v * 3 + 1] - oy) * dy) / 128 + oy;
          pos[v * 3 + 2] = ((pos[v * 3 + 2] - oz) * dz) / 128 + oz;
        }
      }
    }
  }
}

function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

interface Face {
  v: [number, number, number];
  rgba: [number, number, number, number];
  flat: boolean;
}

export interface CharacterMesh {
  group: THREE.Group;
  /** Stand animation: frame lengths (game ticks of 20 ms) and a setter. */
  frameLengths: number[];
  setFrame: (index: number) => void;
}

/**
 * Builds the character mesh: one geometry for solid faces and one for
 * see-through faces, posed in the game's standing animation. Coordinates go
 * from the game's (y down) to three.js (y up), about 2 units tall.
 */
export async function buildCharacterMesh(
  parts: ModelPart[],
  look: CharacterLook,
  textureColours: Record<string, number>,
): Promise<CharacterMesh> {
  const [models, pose] = await Promise.all([Promise.all(parts.map((p) => loadModel(p.model))), loadPose()]);
  const player = playerRecolours(look);

  // Merge every part into one vertex list, as the game does before animating.
  const base: number[] = [];
  const byLabel: number[][] = [];
  const solid: Face[] = [];
  const clear: Face[] = [];
  models.forEach((model, mi) => {
    if (!model) return;
    const part = parts[mi];
    const first = base.length / 3;
    for (let v = 0; v < model.vertexCount; v++) {
      base.push(model.verts[v * 3], model.verts[v * 3 + 1] + part.offsetY, model.verts[v * 3 + 2]);
      const label = model.labels ? model.labels[v] : 0;
      (byLabel[label] ??= []).push(first + v);
    }
    for (let f = 0; f < model.faceCount; f++) {
      const type = model.types[f] & 3;
      let tex = model.textures ? model.textures[f] : -1;
      if (tex >= 0 && part.retexture.has(tex)) tex = part.retexture.get(tex)!;
      // Hidden faces, as the game treats them.
      if (tex < 0 && type === 2) continue;
      if (tex >= 0 && type > 1) continue;

      let hsl = model.colours[f];
      if (tex >= 0 && textureColours[tex] !== undefined) {
        hsl = textureColours[tex];
      } else {
        hsl = part.recolour.get(hsl) ?? hsl;
        hsl = player.get(hsl) ?? hsl;
      }
      const [r, g, b] = type === 3 && tex < 0 ? [0.02, 0.02, 0.02] : hslToRgb(hsl);
      const alpha = model.alphas ? 1 - model.alphas[f] / 255 : 1;
      if (alpha <= 0.01) continue;
      // Game faces wind the other way round from three.js.
      const face: Face = {
        v: [first + model.a[f], first + model.c[f], first + model.b[f]],
        rgba: [srgbToLinear(r), srgbToLinear(g), srgbToLinear(b), alpha],
        flat: type === 1,
      };
      (alpha < 0.99 ? clear : solid).push(face);
    }
  });

  // Vertex positions for each frame of the stand animation (or unposed).
  const frames = pose?.frames.length ? pose.frames : [null];
  // Animation frames expect z the other way round from the stored models.
  const posed = frames.map((frame) => {
    const pos = Float64Array.from(base);
    if (frame && pose) {
      for (let i = 2; i < pos.length; i += 3) pos[i] = -pos[i];
      applyFrame(pos, byLabel, pose, frame);
      for (let i = 2; i < pos.length; i += 3) pos[i] = -pos[i];
    }
    return pos;
  });

  const scale = 1 / 128;
  const group = new THREE.Group();
  const builders: ((pos: Float64Array) => void)[] = [];

  for (const [faces, transparent] of [
    [solid, false],
    [clear, true],
  ] as const) {
    if (!faces.length) continue;
    const geometry = new THREE.BufferGeometry();
    const position = new THREE.Float32BufferAttribute(new Float32Array(faces.length * 9), 3);
    const normal = new THREE.Float32BufferAttribute(new Float32Array(faces.length * 9), 3);
    const colour = new THREE.Float32BufferAttribute(new Float32Array(faces.length * 12), 4);
    faces.forEach((face, i) => {
      for (let k = 0; k < 3; k++) colour.setXYZW(i * 3 + k, ...face.rgba);
    });
    geometry.setAttribute("position", position);
    geometry.setAttribute("normal", normal);
    geometry.setAttribute("color", colour);

    const vn = new Float32Array(base.length);
    const fnorm = new Float32Array(faces.length * 3);
    const pa = new THREE.Vector3();
    const pb = new THREE.Vector3();
    const pc = new THREE.Vector3();
    const n = new THREE.Vector3();
    // Game coordinates (y down, z away) to three.js (y up, z towards the viewer).
    const at = (pos: Float64Array, v: number, out: THREE.Vector3) =>
      out.set(pos[v * 3] * scale, -pos[v * 3 + 1] * scale, -pos[v * 3 + 2] * scale);

    builders.push((pos) => {
      vn.fill(0);
      faces.forEach((face, i) => {
        at(pos, face.v[0], pa);
        at(pos, face.v[1], pb);
        at(pos, face.v[2], pc);
        n.subVectors(pb, pa).cross(pc.sub(pa)).normalize();
        fnorm[i * 3] = n.x;
        fnorm[i * 3 + 1] = n.y;
        fnorm[i * 3 + 2] = n.z;
        for (const v of face.v) {
          vn[v * 3] += n.x;
          vn[v * 3 + 1] += n.y;
          vn[v * 3 + 2] += n.z;
        }
      });
      faces.forEach((face, i) => {
        face.v.forEach((v, k) => {
          at(pos, v, pa);
          position.setXYZ(i * 3 + k, pa.x, pa.y, pa.z);
          if (face.flat) normal.setXYZ(i * 3 + k, fnorm[i * 3], fnorm[i * 3 + 1], fnorm[i * 3 + 2]);
          else {
            n.set(vn[v * 3], vn[v * 3 + 1], vn[v * 3 + 2]).normalize();
            normal.setXYZ(i * 3 + k, n.x, n.y, n.z);
          }
        });
      });
      position.needsUpdate = true;
      normal.needsUpdate = true;
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();
    });

    const material = new THREE.MeshLambertMaterial({
      vertexColors: true,
      side: THREE.DoubleSide,
      transparent,
      depthWrite: !transparent,
    });
    group.add(new THREE.Mesh(geometry, material));
  }

  const setFrame = (index: number) => {
    const pos = posed[index % posed.length];
    for (const build of builders) build(pos);
  };
  setFrame(0);

  return { group, frameLengths: frames.map((f) => f?.length ?? 1), setFrame };
}
