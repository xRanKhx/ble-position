/**
 * BLE Positioning – Möbel und Personen für den WebGL-Renderer
 *
 * Alles parametrisch aus Grundkörpern, bewusst ohne geladene Modelle:
 * keine Lizenzfragen, keine Megabytes, und die Maße lassen sich aus dem
 * Deko-Editor steuern. Der Stil bleibt dadurch einheitlich.
 *
 * Konvention für alle Factories:
 *   Ursprung liegt mittig auf dem Boden (y = 0), Objekt schaut nach +Z.
 *   Gedreht wird erst beim Platzieren über `rotation`.
 */

import * as THREE from "./vendor/three.module.js";

/* ── Materialien ──────────────────────────────────────────────────────── */

const cache = new Map();
function mat(key, opts) {
  if (!cache.has(key)) cache.set(key, new THREE.MeshStandardMaterial(opts));
  return cache.get(key);
}

const M = {
  fabric:  (c) => mat("fab" + c,  { color: c, roughness: 0.95, metalness: 0 }),
  wood:    (c) => mat("wood" + c, { color: c, roughness: 0.55, metalness: 0.02 }),
  metal:   (c) => mat("met" + c,  { color: c, roughness: 0.32, metalness: 0.85 }),
  matte:   (c) => mat("mat" + c,  { color: c, roughness: 0.8,  metalness: 0 }),
  plastic: (c) => mat("pla" + c,  { color: c, roughness: 0.45, metalness: 0.05 }),
};

/** Quader mit abgerundeten Kanten wirkt sofort weniger nach Bauklotz.
    Three.js bringt keine RoundedBox mit, deshalb hier per Hand. */
function box(w, h, d, material, radius) {
  const r = Math.min(radius ?? 0, w / 2, h / 2, d / 2);
  let geo;
  if (r > 0.004) {
    // Angenähert über ein Extrudieren mit Fase – günstiger als echte
    // Rundung und in isometrischer Ansicht nicht zu unterscheiden.
    const shape = new THREE.Shape();
    const x0 = -w / 2, y0 = -h / 2;
    shape.moveTo(x0 + r, y0);
    shape.lineTo(x0 + w - r, y0);
    shape.quadraticCurveTo(x0 + w, y0, x0 + w, y0 + r);
    shape.lineTo(x0 + w, y0 + h - r);
    shape.quadraticCurveTo(x0 + w, y0 + h, x0 + w - r, y0 + h);
    shape.lineTo(x0 + r, y0 + h);
    shape.quadraticCurveTo(x0, y0 + h, x0, y0 + h - r);
    shape.lineTo(x0, y0 + r);
    shape.quadraticCurveTo(x0, y0, x0 + r, y0);
    geo = new THREE.ExtrudeGeometry(shape, {
      depth: d, bevelEnabled: true, bevelSize: r * 0.5,
      bevelThickness: r * 0.5, bevelSegments: 2, curveSegments: 4,
    });
    geo.translate(0, 0, -d / 2);
  } else {
    geo = new THREE.BoxGeometry(w, h, d);
  }
  const m = new THREE.Mesh(geo, material);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function put(parent, mesh, x, y, z) {
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

/* ── Möbel ────────────────────────────────────────────────────────────── */

export function makeBed(o = {}) {
  const w = o.width ?? 1.6, d = o.depth ?? 2.0;
  const g = new THREE.Group();
  const frame = M.wood(o.frameColor ?? 0x6b4f37);
  const linen = M.fabric(o.linenColor ?? 0xeceae4);

  put(g, box(w, 0.26, d, frame, 0.02), 0, 0.17, 0);          // Bettkasten
  put(g, box(w - 0.06, 0.18, d - 0.08, linen, 0.05), 0, 0.39, 0); // Matratze
  // Decke: etwas kürzer, damit die Matratze am Fußende hervorschaut
  put(g, box(w - 0.04, 0.09, d * 0.62, M.fabric(o.duvetColor ?? 0xd8dee8), 0.05),
      0, 0.50, d * 0.16);
  // Kopfteil
  put(g, box(w, 0.55, 0.08, frame, 0.02), 0, 0.55, -d / 2 + 0.04);
  // Kissen
  const pw = w / 2 - 0.09;
  put(g, box(pw, 0.12, 0.34, linen, 0.06), -pw / 2 - 0.03, 0.54, -d / 2 + 0.28);
  put(g, box(pw, 0.12, 0.34, linen, 0.06),  pw / 2 + 0.03, 0.54, -d / 2 + 0.28);
  // Füße
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    put(g, box(0.07, 0.08, 0.07, frame), sx * (w / 2 - 0.07), 0.04, sz * (d / 2 - 0.07));
  }
  return g;
}

export function makeSofa(o = {}) {
  const w = o.width ?? 2.1, d = o.depth ?? 0.9;
  const g = new THREE.Group();
  const f = M.fabric(o.color ?? 0x5c6672);

  put(g, box(w, 0.32, d, f, 0.05), 0, 0.28, 0);                  // Korpus
  put(g, box(w - 0.36, 0.14, d - 0.14, M.fabric(o.color ?? 0x67717d), 0.06),
      0, 0.51, 0.03);                                            // Sitzpolster
  put(g, box(w, 0.52, 0.18, f, 0.06), 0, 0.62, -d / 2 + 0.09);   // Rückenlehne
  for (const sx of [-1, 1]) {                                     // Armlehnen
    put(g, box(0.18, 0.34, d, f, 0.06), sx * (w / 2 - 0.09), 0.61, 0);
  }
  // Zwei Kissen, leicht gekippt – sonst wirkt es wie ein Wartezimmer
  for (const sx of [-1, 1]) {
    const c = box(0.36, 0.36, 0.12, M.fabric(o.cushionColor ?? 0x8d99a6), 0.05);
    c.rotation.z = sx * 0.12;
    put(g, c, sx * (w / 2 - 0.34), 0.66, -d / 2 + 0.22);
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    put(g, box(0.06, 0.12, 0.06, M.wood(0x3b2f26)),
        sx * (w / 2 - 0.12), 0.06, sz * (d / 2 - 0.12));
  }
  return g;
}

export function makeArmchair(o = {}) {
  const w = o.width ?? 0.82, d = o.depth ?? 0.82;
  const g = new THREE.Group();
  const f = M.fabric(o.color ?? 0x7a6a5a);
  put(g, box(w, 0.28, d, f, 0.06), 0, 0.30, 0);
  put(g, box(w - 0.22, 0.12, d - 0.14, f, 0.06), 0, 0.50, 0.02);
  put(g, box(w, 0.48, 0.16, f, 0.07), 0, 0.60, -d / 2 + 0.08);
  for (const sx of [-1, 1]) {
    put(g, box(0.14, 0.28, d - 0.08, f, 0.06), sx * (w / 2 - 0.07), 0.56, 0.02);
  }
  // Schräg gestellte Holzbeine
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const leg = box(0.045, 0.2, 0.045, M.wood(0x4a3625));
    leg.rotation.x = sz * 0.1; leg.rotation.z = -sx * 0.1;
    put(g, leg, sx * (w / 2 - 0.1), 0.1, sz * (d / 2 - 0.1));
  }
  return g;
}

export function makeWardrobe(o = {}) {
  const w = o.width ?? 2.0, h = o.height ?? 2.1, d = o.depth ?? 0.58;
  const g = new THREE.Group();
  const body = M.wood(o.color ?? 0x8a7259);
  put(g, box(w, h, d, body, 0.01), 0, h / 2, 0);

  // Türfugen und Griffe: ohne sie bleibt es ein brauner Block
  const doors = Math.max(2, Math.round(w / 0.55));
  const dw = w / doors;
  for (let i = 0; i < doors; i++) {
    const cx = -w / 2 + dw * (i + 0.5);
    put(g, box(dw - 0.012, h - 0.05, 0.012, M.wood(o.frontColor ?? 0x96805f), 0.006),
        cx, h / 2, d / 2 + 0.006);
    const handle = box(0.018, 0.16, 0.018, M.metal(0xc9ccd2), 0.008);
    put(g, handle, cx + dw / 2 - 0.05, h * 0.52, d / 2 + 0.02);
  }
  return g;
}

/* ── Geräte mit HA-Zustand ────────────────────────────────────────────── */

/**
 * Fernseher. Der Bildschirm leuchtet, wenn das Gerät läuft – deshalb ist er
 * hier kein Dekostück, sondern spiegelt den Entity-Status wider.
 * `state`: "playing" | "on" | "off"  ·  `tint`: Farbe des Bildinhalts
 */
export function makeTV(o = {}) {
  const w = o.width ?? 1.25, h = o.height ?? 0.72;
  const g = new THREE.Group();
  const standH = o.wallMounted ? 0 : (o.standHeight ?? 0.52);

  if (!o.wallMounted) {
    put(g, box(0.5, 0.03, 0.28, M.matte(0x2a2d33), 0.01), 0, standH - 0.24, 0);
    put(g, box(0.09, standH - 0.22, 0.09, M.matte(0x2a2d33)), 0, standH - 0.12, 0);
  }
  // Gehäuse
  put(g, box(w, h, 0.045, M.matte(0x16181c), 0.012), 0, standH + h / 2, 0);

  const on = o.state === "playing" || o.state === "on";
  const tint = new THREE.Color(o.tint ?? (o.state === "playing" ? 0x4a7fd4 : 0x2a3340));
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(w - 0.045, h - 0.045),
    new THREE.MeshStandardMaterial({
      color: on ? tint : 0x0d0f12,
      emissive: on ? tint : 0x000000,
      // Der Bildschirm ist selbst eine Lichtquelle für die Optik, aber
      // keine echte Lampe – das wäre bei acht Lichtern Verschwendung.
      emissiveIntensity: on ? (o.state === "playing" ? 1.6 : 0.8) : 0,
      roughness: 0.18, metalness: 0.1,
    })
  );
  screen.position.set(0, standH + h / 2, 0.024);
  g.add(screen);
  g.userData.screen = screen;
  return g;
}

/**
 * Lautsprecher. `level` 0..1 treibt den Leuchtring; damit sieht man auf
 * einen Blick, ob und wie laut etwas läuft.
 */
export function makeSpeaker(o = {}) {
  const w = o.width ?? 0.2, h = o.height ?? 0.32, d = o.depth ?? 0.19;
  const g = new THREE.Group();
  put(g, box(w, h, d, M.matte(o.color ?? 0x23262b), 0.015), 0, h / 2, 0);

  // Zwei Treiber, leicht versenkt
  const cone = (r, y) => {
    const m = new THREE.Mesh(
      new THREE.CircleGeometry(r, 20),
      M.plastic(0x15171a)
    );
    m.position.set(0, y, d / 2 + 0.002);
    g.add(m);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(r * 0.94, r, 20),
      M.metal(0x4a4f57)
    );
    ring.position.set(0, y, d / 2 + 0.004);
    g.add(ring);
  };
  cone(w * 0.3, h * 0.68);
  cone(w * 0.18, h * 0.3);

  const playing = o.state === "playing";
  const lvl = Math.max(0, Math.min(1, o.level ?? 0));
  const led = new THREE.Mesh(
    new THREE.RingGeometry(w * 0.06, w * 0.1, 16),
    new THREE.MeshStandardMaterial({
      color: playing ? 0x38bdf8 : 0x2a2f36,
      emissive: playing ? 0x38bdf8 : 0x000000,
      emissiveIntensity: playing ? 0.5 + lvl * 1.5 : 0,
    })
  );
  led.position.set(0, h * 0.12, d / 2 + 0.004);
  g.add(led);
  g.userData.led = led;
  return g;
}

/* ── Person ───────────────────────────────────────────────────────────── */

/**
 * Stilisierte Person. Bewusst nicht anatomisch: die Figur soll Position und
 * Blickrichtung zeigen, ohne in der isometrischen Ansicht unangenehm
 * aufzufallen. `posture`: "standing" | "sitting" | "lying".
 */
export function makePerson(o = {}) {
  const g = new THREE.Group();
  const skin = M.matte(o.skinColor ?? 0xe0ac86);
  const cloth = M.fabric(o.color ?? 0x3d7ea6);
  const pants = M.fabric(o.pantsColor ?? 0x2f3742);
  const posture = o.posture || "standing";

  const scale = posture === "sitting" ? 0.72 : 1;
  const legH = 0.82 * scale, torsoH = 0.62, headR = 0.105;

  const body = new THREE.Group();

  if (posture === "lying") {
    // Liegend: Achse kippt, damit die Figur auf dem Bett funktioniert
    body.rotation.x = -Math.PI / 2;
    body.position.y = 0.16;
  }

  // Beine
  for (const sx of [-1, 1]) {
    const leg = box(0.115, legH, 0.13, pants, 0.05);
    put(body, leg, sx * 0.1, legH / 2, 0);
    if (posture === "sitting") {
      leg.rotation.x = -Math.PI / 2.2;
      leg.position.set(sx * 0.1, legH * 0.62, legH * 0.28);
    }
  }
  // Rumpf, nach oben leicht schmaler
  const torso = box(0.34, torsoH, 0.19, cloth, 0.07);
  put(body, torso, 0, legH + torsoH / 2, posture === "sitting" ? -0.02 : 0);
  // Arme
  for (const sx of [-1, 1]) {
    const arm = box(0.085, torsoH * 0.88, 0.1, cloth, 0.04);
    arm.rotation.z = sx * 0.07;
    put(body, arm, sx * 0.215, legH + torsoH * 0.52, 0);
  }
  // Kopf mit Hals
  put(body, box(0.08, 0.06, 0.08, skin, 0.02), 0, legH + torsoH + 0.03, 0);
  const head = new THREE.Mesh(new THREE.SphereGeometry(headR, 20, 16), skin);
  head.castShadow = true;
  put(body, head, 0, legH + torsoH + 0.06 + headR, 0);
  // Nasenandeutung als Blickrichtung – ohne sie sieht man nicht, wohin
  // die Person schaut, und das ist bei Anwesenheitsdaten die halbe Aussage.
  put(body, box(0.035, 0.035, 0.05, skin, 0.012),
      0, legH + torsoH + 0.06 + headR, headR * 0.88);

  g.add(body);
  g.userData.body = body;
  return g;
}

/* ── Registry ─────────────────────────────────────────────────────────── */

export const FURNITURE = {
  bed: makeBed,
  sofa: makeSofa,
  couch: makeSofa,
  armchair: makeArmchair,
  chair: makeArmchair,
  wardrobe: makeWardrobe,
  shelf: makeWardrobe,
  tv: makeTV,
  speaker: makeSpeaker,
  person: makePerson,
};

/** Baut ein Objekt nach Typ und stellt es an seinen Platz. */
export function makeFurniture(type, opts) {
  const fn = FURNITURE[String(type || "").toLowerCase()];
  if (!fn) return null;
  const g = fn(opts || {});
  if (opts?.rotation != null) g.rotation.y = (opts.rotation * Math.PI) / 180;
  if (opts?.x != null && opts?.y != null) g.position.set(opts.x, opts.z || 0, opts.y);
  return g;
}

export function disposeFurnitureCache() {
  for (const m of cache.values()) m.dispose();
  cache.clear();
}
