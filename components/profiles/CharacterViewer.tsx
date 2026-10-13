"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { composeCharacter, type Character } from "@/lib/osrs-character";
import { loadOsrsData } from "@/lib/osrs-data";
import { buildCharacterMesh, type CharacterMesh } from "@/lib/osrs-model";

interface Stage {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  holder: THREE.Group;
  mesh: CharacterMesh | null;
}

/**
 * The member's OSRS character in 3D, wearing their gear. Drag to turn it;
 * it slowly turns on its own until someone does.
 */
export function CharacterViewer({ character, className = "" }: { character: Character; className?: string }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Stage | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "no-webgl">("loading");

  // Scene setup, once.
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    } catch {
      const frame = requestAnimationFrame(() => setStatus("no-webgl"));
      return () => cancelAnimationFrame(frame);
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);
    renderer.domElement.style.display = "block";
    renderer.domElement.style.touchAction = "pan-y";

    const scene = new THREE.Scene();
    scene.add(new THREE.AmbientLight(0xffffff, 1.6));
    const key = new THREE.DirectionalLight(0xfff4e0, 2.2);
    key.position.set(-2, 3, 4);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xc8dcff, 0.8);
    rim.position.set(3, 2, -3);
    scene.add(rim);

    // Soft shadow under the feet.
    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.55, 32),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25, depthWrite: false }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.001;
    scene.add(shadow);

    const holder = new THREE.Group();
    scene.add(holder);

    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    camera.position.set(0, 1.1, 5.2);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0.95, 0);
    controls.enablePan = false;
    controls.enableZoom = false;
    controls.enableDamping = true;
    controls.minPolarAngle = Math.PI * 0.3;
    controls.maxPolarAngle = Math.PI * 0.62;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 1.2;
    controls.addEventListener("start", () => {
      controls.autoRotate = false;
    });

    const resize = () => {
      const { clientWidth: w, clientHeight: h } = mount;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      renderer.domElement.style.width = `${w}px`;
      renderer.domElement.style.height = `${h}px`;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(mount);

    // Play the stand animation (frame lengths are game ticks of 20 ms).
    let frame = 0;
    let animFrame = 0;
    let animElapsed = 0;
    let last = performance.now();
    const tick = () => {
      const now = performance.now();
      const mesh = stageRef.current?.mesh;
      if (mesh && mesh.frameLengths.length > 1) {
        animElapsed += now - last;
        const length = Math.max(mesh.frameLengths[animFrame % mesh.frameLengths.length], 1) * 20;
        if (animElapsed >= length) {
          animElapsed -= length;
          animFrame = (animFrame + 1) % mesh.frameLengths.length;
          mesh.setFrame(animFrame);
        }
      }
      last = now;
      controls.update();
      renderer.render(scene, camera);
      frame = requestAnimationFrame(tick);
    };
    tick();

    stageRef.current = { renderer, scene, camera, controls, holder, mesh: null };
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      holder.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          (o.material as THREE.Material).dispose();
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
      stageRef.current = null;
    };
  }, []);

  // (Re)build the character whenever its look or gear changes.
  const key = JSON.stringify(character);
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setStatus((s) => (s === "no-webgl" ? s : "loading"));
      try {
        const data = await loadOsrsData();
        const ids = Object.values(character.gear).map((g) => g!.id);
        const parts = composeCharacter(character.look, ids, data.items, data.kits);
        const mesh = await buildCharacterMesh(parts, character.look, data.textures);
        const { group } = mesh;
        const stage = stageRef.current;
        if (cancelled || !stage) return;
        // Stand the character on the floor, centred.
        const box = new THREE.Box3().setFromObject(group);
        const centre = box.getCenter(new THREE.Vector3());
        group.position.set(-centre.x, -box.min.y, -centre.z);
        const old = stage.holder.children.slice();
        stage.holder.add(group);
        stage.mesh = mesh;
        for (const o of old) {
          stage.holder.remove(o);
          o.traverse((m) => {
            if (m instanceof THREE.Mesh) {
              m.geometry.dispose();
              (m.material as THREE.Material).dispose();
            }
          });
        }
        // Frame the full height (weapons and capes can stick out).
        const height = box.max.y - box.min.y;
        stage.controls.target.set(0, height * 0.5, 0);
        const distance = (height * 0.62) / Math.tan(THREE.MathUtils.degToRad(stage.camera.fov / 2));
        const dir = stage.camera.position.clone().sub(stage.controls.target).normalize();
        stage.camera.position.copy(stage.controls.target).addScaledVector(dir, Math.max(distance, 3));
        setStatus("ready");
      } catch {
        if (!cancelled) setStatus("error");
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
    // `key` captures every change to the character.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return (
    <div className={`relative ${className}`}>
      <div ref={mountRef} className="absolute inset-0 cursor-grab active:cursor-grabbing" aria-label="3D character, drag to turn" role="img" />
      {status === "loading" && (
        <p className="absolute inset-x-0 bottom-3 text-center text-xs text-parchment/80 pointer-events-none">Loading character...</p>
      )}
      {status === "error" && (
        <p className="absolute inset-x-0 bottom-3 text-center text-xs text-parchment/80 pointer-events-none">Couldn&apos;t load the character.</p>
      )}
      {status === "no-webgl" && (
        <p className="absolute inset-0 flex items-center justify-center p-4 text-center text-xs text-parchment/80">
          Your browser can&apos;t show 3D here.
        </p>
      )}
    </div>
  );
}
