/**
 * BLE Positioning – Nachbarschaft
 *
 * Straßen, Nachbarhäuser und Bäume rings um das eigene Gebäude. Alles
 * prozedural und deterministisch: derselbe Grundriss ergibt immer dieselbe
 * Umgebung. Ohne festen Zufallskeim würde die Nachbarschaft bei jedem
 * Neuaufbau umspringen, und das fällt sofort unangenehm auf.
 *
 * Die Häuser sind bewusst schlicht gehalten. Sie stehen im Hintergrund und
 * sollen dem eigenen Grundriss Maßstab und Umfeld geben, nicht mit ihm um
 * Aufmerksamkeit konkurrieren.
 */

import * as THREE from "./vendor/three.module.js";

/* Deterministischer Zufall (Mulberry32). Reicht völlig und braucht keine
   Abhängigkeit. */
function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* Bewusst gedaempft: die Nachbarschaft ist Kulisse. Waeren die Fassaden
   so hell wie das eigene Gebaeude, zoege der Blick nach aussen. */
// Heller als zuvor: im Zielbild treten die Nachbarhaeuser deutlich
// hervor, ohne vom Zentrum abzulenken.
const HOUSE_COLORS = [0xc9c4b8, 0xbdb7aa, 0xd2ccc0, 0xc3bcae, 0xb6b0a4];
const ROOF_COLORS  = [0x5c5a56, 0x4e4c49, 0x635a52, 0x494744];

export class Neighborhood {
  /**
   * @param {THREE.Scene} scene
   * @param {{seed?:number}} opts
   */
  constructor(scene, opts = {}) {
    this.scene = scene;
    this.seed = opts.seed ?? 1337;
    this.group = null;
    this._key = null;
    this._snow = null;
  }

  /**
   * Umgebung aufbauen.
   * @param {{x1,y1,x2,y2}} bounds  eigenes Gebäude, bleibt frei
   * @param {number} span           Ausdehnung der Szene in Metern
   */
  build(bounds, span) {
    const key = [bounds.x1, bounds.y1, bounds.x2, bounds.y2, span, this.seed].join("|");
    if (key === this._key) return;
    this._key = key;
    this.dispose();

    const r = rng(this.seed);
    const cx = (bounds.x1 + bounds.x2) / 2;
    const cz = (bounds.y1 + bounds.y2) / 2;
    // Eigenes Grundstück plus Puffer bleibt unbebaut
    const ownW = Math.abs(bounds.x2 - bounds.x1) + 5;
    const ownD = Math.abs(bounds.y2 - bounds.y1) + 5;
    const reach = Math.max(span * 1.45, 34);

    const g = new THREE.Group();
    // Leicht abgesenkt, damit die Straßen nicht mit dem Boden flimmern
    g.position.set(cx, -0.1, cz);
    this._origin = new THREE.Vector3(cx, 0, cz);
    // Alles, was die Sicht auf das eigene Gebaeude verstellen kann
    this._blockers = [];

    const roadW = 7.5;
    this._addRoads(g, reach, roadW, r);
    this._addBuildings(g, reach, roadW, ownW, ownD, r);
    this._addTrees(g, reach, roadW, ownW, ownD, r);

    // Sicherheitsnetz: jedes Mesh wirft und empfaengt Schatten. Einzeln
    // gesetzt wird leicht eines vergessen, und ein fehlender Schatten
    // faellt erst spaet auf.
    g.traverse((o) => {
      if (!o.isMesh) return;
      o.receiveShadow = true;
      // Flache Flaechen wie Fensterscheiben und Fahrbahnmarkierungen
      // sollen keinen eigenen Schatten werfen – das flackert nur.
      if (!o.geometry?.type?.includes("Plane")) o.castShadow = true;
    });

    this.scene.add(g);
    this.group = g;
  }

  /* Straßenkreuz mit Mittelstreifen und Gehwegen. */
  _addRoads(g, reach, roadW, r) {
    const len = reach * 2;
    // Dunkler gehalten, damit das eigene Gebaeude der Blickanker bleibt
    const asphalt = new THREE.MeshStandardMaterial({
      color: 0x3c4046, roughness: 0.62, metalness: 0.02,
    });
    // Gehweg deutlich heller – er soll sich klar vom Asphalt absetzen
    const walk = new THREE.MeshStandardMaterial({
      color: 0xa8aca8, roughness: 0.7, metalness: 0,
    });

    const strip = (w, d, y, mat) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.06, d), mat);
      m.position.y = y;
      m.receiveShadow = true;
      g.add(m);
      this._roadTargets = this._roadTargets || [];
      this._roadTargets.push(m);
      return m;
    };
    // Gehwege etwas breiter darunter, ergibt eine Bordsteinkante
    strip(roadW + 3.4, len, 0.02, walk);
    strip(len, roadW + 3.4, 0.02, walk);
    strip(roadW, len, 0.07, asphalt);
    strip(len, roadW, 0.07, asphalt);

    // Zusaetzliche Nebenstrassen – im Zielbild ist mehr Netz zu sehen
    const sideOff = reach * 0.52;
    for (const s2 of [-1, 1]) {
      const n1 = new THREE.Mesh(new THREE.BoxGeometry(roadW * 0.7, 0.05, len), asphalt);
      n1.position.set(s2 * sideOff, 0.05, 0);
      n1.receiveShadow = true; g.add(n1); this._roadTargets.push(n1);
      const n2 = new THREE.Mesh(new THREE.BoxGeometry(len, 0.05, roadW * 0.7), asphalt);
      n2.position.set(0, 0.05, s2 * sideOff);
      n2.receiveShadow = true; g.add(n2); this._roadTargets.push(n2);
    }

    // Mittelstreifen, an der Kreuzung ausgespart
    const dash = new THREE.MeshStandardMaterial({
      color: 0xd9d4c4, roughness: 0.7, emissive: 0x2a2820, emissiveIntensity: 0.2,
    });
    const gap = roadW * 0.9;
    for (let s = -1; s <= 1; s += 2) {
      for (let d = gap; d < reach; d += 4.2) {
        const a = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.02, 2.0), dash);
        a.position.set(0, 0.105, s * d);
        g.add(a);
        const b = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.02, 0.22), dash);
        b.position.set(s * d, 0.105, 0);
        g.add(b);
      }
    }
  }

  /* Häuser in den vier Quadranten, entlang der Straßen ausgerichtet. */
  _addBuildings(g, reach, roadW, ownW, ownD, r) {
    const margin = roadW / 2 + 3.6;
    // Reichlich Versuche: die Filter (eigenes Grundstueck, Strassen,
    // Abstand) verwerfen viele Kandidaten, sonst bleibt die Strasse leer.
    const tries = 400;
    const placed = [];

    const overlaps = (x, z, w, d) => {
      // Eigenes Grundstück freihalten
      if (Math.abs(x) < ownW / 2 + w / 2 && Math.abs(z) < ownD / 2 + d / 2) return true;
      // Straßenkorridore freihalten
      if (Math.abs(x) < margin + w / 2 || Math.abs(z) < margin + d / 2) return true;
      for (const p of placed) {
        if (Math.abs(x - p.x) < (w + p.w) / 2 + 2.2 &&
            Math.abs(z - p.z) < (d + p.d) / 2 + 2.2) return true;
      }
      return false;
    };

    for (let i = 0; i < tries && placed.length < 14; i++) {
      const w = 7 + r() * 7;
      const d = 7 + r() * 6;
      // Gezielt in einen Quadranten setzen statt frei zu streuen: das
      // Strassenkreuz schneidet sonst so viel aus, dass fast alle
      // Kandidaten verworfen werden und die Bloecke leer bleiben.
      const qx = (i % 2) ? 1 : -1;
      const qz = (Math.floor(i / 2) % 2) ? 1 : -1;
      const inner = margin + Math.max(w, d) / 2 + 0.8;
      const x = qx * (inner + r() * Math.max(2, reach * 0.9 - inner));
      const z = qz * (inner + r() * Math.max(2, reach * 0.9 - inner));
      if (Math.hypot(x, z) > reach * 0.98) continue;
      if (overlaps(x, z, w, d)) continue;
      placed.push({ x, z, w, d });

      const floors = 1 + Math.floor(r() * 4);
      const h = 2.9 * floors;
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, d),
        new THREE.MeshStandardMaterial({
          color: HOUSE_COLORS[Math.floor(r() * HOUSE_COLORS.length)],
          roughness: 0.6, metalness: 0.05,
        })
      );
      body.position.set(x, h / 2, z);
      body.castShadow = true;
      body.receiveShadow = true;
      g.add(body);

      // Flaches Dach mit Überstand – reicht für den Hintergrund
      const roof = new THREE.Mesh(
        new THREE.BoxGeometry(w + 0.5, 0.35, d + 0.5),
        new THREE.MeshStandardMaterial({
          color: ROOF_COLORS[Math.floor(r() * ROOF_COLORS.length)],
          roughness: 0.6, metalness: 0.05,
        })
      );
      roof.position.set(x, h + 0.17, z);
      roof.castShadow = true;
      roof.receiveShadow = true;
      g.add(roof);
      // Duenne Schneeschicht auf dem Dach, statt das Dach weiss zu faerben
      const rcap = new THREE.Mesh(
        new THREE.BoxGeometry(w + 0.55, 0.12, d + 0.55),
        new THREE.MeshStandardMaterial({ color: 0xf2f6fa, roughness: 0.92 })
      );
      rcap.position.set(x, h + 0.39, z);
      rcap.castShadow = true;
      rcap.visible = false;
      rcap.userData.isSnowCap = true;
      rcap.userData.weatherOk = false;
      g.add(rcap);
      this._snowCaps = this._snowCaps || [];
      this._snowCaps.push(rcap);
      // Haus samt Dach als eine Einheit ein- und ausblenden
      this._blockers.push({ objs: [body, roof], x, z, r: Math.max(w, d) / 2 });
      this._lastHouse = this._blockers[this._blockers.length - 1];

      // Fensterraster: dunkle Felder, nachts leuchtet ein Teil
      const winMat = new THREE.MeshStandardMaterial({
        color: 0x2b3440, roughness: 0.25, metalness: 0.1,
        emissive: 0x000000, emissiveIntensity: 0,
      });
      const litMat = new THREE.MeshStandardMaterial({
        color: 0xffd9a0, roughness: 0.3,
        emissive: 0xffc878, emissiveIntensity: 1.1,
      });
      for (let f = 0; f < floors; f++) {
        const cols = Math.max(2, Math.floor(w / 2.4));
        for (let c = 0; c < cols; c++) {
          const lit = r() < 0.3;
          const wx = -w / 2 + (c + 0.5) * (w / cols);
          const wy = 1.1 + f * 2.9;
          for (const [dx, dz, rot] of [[0, d / 2 + 0.03, 0], [0, -d / 2 - 0.03, Math.PI]]) {
            const p = new THREE.Mesh(
              new THREE.PlaneGeometry(0.95, 1.25),
              lit && r() < 0.6 ? litMat : winMat
            );
            p.position.set(x + wx + dx, wy, z + dz);
            p.rotation.y = rot;
            g.add(p);
            if (this._lastHouse) this._lastHouse.objs.push(p);
          }
        }
      }
    }
  }

  /* Bäume: Stamm plus zwei versetzte Kugeln, das genügt auf Distanz. */
  /* Baeume in Gruppen auf eigenen Gruen-Inseln, mit verschiedenen
     Formen. Einzeln verstreute Baeume gleicher Bauart wirken wie
     Platzhalter; erst die Mischung liest sich als Bepflanzung. */
  _addTrees(g, reach, roadW, ownW, ownD, r) {
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5a4632, roughness: 0.95 });
    const islandMat = new THREE.MeshStandardMaterial({ color: 0x6d8a4e, roughness: 0.95 });
    const margin2 = roadW / 2 + 2.2;
    this._snowCaps = this._snowCaps || [];

    const addCap = (mesh, objs) => {
      const cap = new THREE.Mesh(
        new THREE.SphereGeometry(1.06, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.42),
        new THREE.MeshStandardMaterial({ color: 0xf2f6fa, roughness: 0.92 }));
      cap.scale.copy(mesh.scale);
      cap.position.copy(mesh.position);
      cap.visible = false;
      cap.userData.isSnowCap = true;
      cap.userData.weatherOk = false;
      g.add(cap); objs.push(cap);
      this._snowCaps.push(cap);
    };

    const makeTree = (kind, x, z) => {
      const objs = [];
      const hh = (kind === "column" ? 5.0 : kind === "broad" ? 3.2 : 4.0) * (0.8 + r() * 0.45);
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, hh, 6), trunkMat);
      t.position.set(x, hh / 2, z);
      t.castShadow = true; t.receiveShadow = true;
      g.add(t); objs.push(t);

      const green = new THREE.MeshStandardMaterial({
        color: new THREE.Color().setHSL(0.24 + r() * 0.08, 0.34 + r() * 0.18,
                                        0.28 + r() * 0.14),
        roughness: 0.95,
      });
      const blobs = [];
      if (kind === "column") {
        const m = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 10), green);
        m.scale.set(0.7, 1.9, 0.7);
        m.position.set(x, hh + 1.3, z);
        blobs.push(m);
      } else if (kind === "broad") {
        for (let k = 0; k < 3; k++) {
          const rad = 1.2 + r() * 0.6;
          const m = new THREE.Mesh(new THREE.SphereGeometry(rad, 10, 8), green);
          m.position.set(x + (r() - 0.5) * 1.5, hh + 0.4 + k * 0.42, z + (r() - 0.5) * 1.5);
          blobs.push(m);
        }
      } else {
        const m = new THREE.Mesh(new THREE.ConeGeometry(1.2 + r() * 0.4, 3.2, 9), green);
        m.position.set(x, hh + 1.1, z);
        blobs.push(m);
      }
      for (const m of blobs) {
        m.castShadow = true; m.receiveShadow = true;
        g.add(m); objs.push(m);
        addCap(m, objs);
      }
      return objs;
    };

    const kinds = ["broad", "column", "cone"];
    for (let gi = 0; gi < 7; gi++) {
      let gx = 0, gz = 0, ok = false;
      for (let t = 0; t < 40 && !ok; t++) {
        gx = (r() - 0.5) * reach * 1.5;
        gz = (r() - 0.5) * reach * 1.5;
        if (Math.hypot(gx, gz) > reach * 0.9) continue;
        if (Math.abs(gx) < ownW / 2 + 3 && Math.abs(gz) < ownD / 2 + 3) continue;
        if (Math.abs(gx) < margin2 + 2 || Math.abs(gz) < margin2 + 2) continue;
        ok = true;
      }
      if (!ok) continue;

      // Gruen-Insel unter der Gruppe
      const isl = new THREE.Mesh(new THREE.CircleGeometry(3.2 + r() * 1.6, 24), islandMat);
      isl.rotation.x = -Math.PI / 2;
      isl.position.set(gx, 0.035, gz);
      isl.receiveShadow = true;
      g.add(isl);
      this._roadTargets.push(isl);

      const objs = [isl];
      const n = 3 + Math.floor(r() * 3);
      for (let i2 = 0; i2 < n; i2++) {
        const ang = (i2 / n) * Math.PI * 2 + r();
        const rad = 0.7 + r() * 1.9;
        const kind = kinds[Math.floor(r() * kinds.length)];
        objs.push(...makeTree(kind, gx + Math.cos(ang) * rad, gz + Math.sin(ang) * rad));
      }
      this._blockers.push({ objs, x: gx, z: gz, r: 4.5 });
    }
  }


  /**
   * Alles ausblenden, was zwischen Kamera und eigenem Gebaeude steht.
   * Gleiches Prinzip wie bei den Waenden: was die Sicht verstellt, wird
   * weggenommen. Ohne das steht man vor der Nachbarfassade statt vor der
   * eigenen Wohnung.
   *
   * @param {THREE.Vector3} camDir  Blickrichtung (von der Kamera weg)
   * @param {number} keep           Radius um das Gebaeude, der frei bleibt
   */
  updateOcclusion(camDir, keep) {
    if (!this._blockers || !this._origin) return;
    const d = camDir.clone().setY(0).normalize();
    // Senkrechte zur Blickrichtung, fuer den seitlichen Abstand
    const side = new THREE.Vector3(-d.z, 0, d.x);
    const r = Math.max(6, keep || 12);
    for (const b of this._blockers) {
      // Position relativ zum Gebaeudemittelpunkt, in lokalen Koordinaten
      const vx = b.x, vz = b.z;
      const along = vx * d.x + vz * d.z;        // negativ = vor dem Gebaeude
      const lat = Math.abs(vx * side.x + vz * side.z);
      // Vor dem Gebaeude und seitlich nah genug, um es zu verdecken
      const blocks = along < 0 && lat < r + b.r;
      // Sichtbarkeit hat zwei unabhaengige Gruende: Wetter (liegt Schnee?)
      // und Verdeckung (steht es im Weg?). Beide auf dasselbe Flag zu
      // schreiben hiess, dass der zuletzt laufende gewinnt – deshalb
      // blieben Schneehauben im Sommer stehen.
      for (const o of b.objs) {
        o.userData.occluded = blocks;
        o.visible = !blocks && (o.userData.weatherOk !== false);
        // Kinder mitnehmen: Hauben und Aufsaetze haengen an den Eltern
        o.traverse?.((ch) => {
          if (ch === o) return;
          ch.visible = !blocks && (ch.userData.weatherOk !== false);
        });
      }
    }
  }

  /**
   * Wetter und Tageszeit. Schnee legt sich auf Dächer und Kronen, nachts
   * werden die Fassaden abgedunkelt und mehr Fenster leuchten.
   */
  setWeather(condition, night) {
    if (!this.group) return;
    const snow = /snow|sleet|hail/.test(String(condition || ""));
    if (this._snow !== snow) {
      this._snow = snow;
      // Originalfarbe beim ersten Mal sichern – sonst bliebe nach dem
      // Umschalten alles weiss, weil die Ausgangsfarbe verloren waere.
      const tint = (list, hex) => {
        for (const m of (list || [])) {
          if (m.userData.baseHex == null) m.userData.baseHex = m.material.color.getHex();
          m.material.color.setHex(snow ? hex : m.userData.baseHex);
        }
      };
      // Hauben: Wetterzustand getrennt vom Verdeckungszustand fuehren
      for (const cap of (this._snowCaps || [])) {
        cap.userData.weatherOk = snow;
        cap.userData.isSnowCap = true;
        cap.visible = snow && !cap.userData.occluded;
      }
      // Strassen werden Schneematsch, nicht Reinweiss: nur so bleiben
      // Fahrbahnmarkierungen und Bordsteinkanten noch zu erkennen.
      tint(this._roadTargets, 0x777a80);
      // Schnee streut diffus: rau und ohne Metallanteil, sonst wirkt er
      // wie lackiert.
      for (const m of (this._roadTargets || [])) {
        if (m.userData.dryRough == null) {
          m.userData.dryRough = m.material.roughness;
          m.userData.dryMetal = m.material.metalness;
        }
        if (snow) { m.material.roughness = 0.95; m.material.metalness = 0; }
        m.material.needsUpdate = true;
      }
    }

    // Nasser Asphalt spiegelt: niedrige Rauheit, etwas Metallanteil.
    // Das ist der Effekt, der Regenbilder ueberhaupt erst glaubwuerdig
    // macht – mehr noch als die Tropfen selbst.
    const wet = /rain|pouring|lightning|storm/.test(String(condition || ""));
    if (this._wet !== wet) {
      this._wet = wet;
      for (const m of (this._roadTargets || [])) {
        if (m.userData.dryRough == null) {
          m.userData.dryRough = m.material.roughness;
          m.userData.dryMetal = m.material.metalness;
        }
        m.material.roughness = wet ? 0.15 : 0.8;
        m.material.metalness = wet ? 0.3 : m.userData.dryMetal;
        m.material.envMapIntensity = wet ? 1.6 : 1.0;
        m.material.needsUpdate = true;
      }
    }
    // Nachts sind die Fassaden dunkler; das eigene Haus soll herausstechen
    this.group.traverse((o) => {
      if (o.isMesh && o.material && o.material.emissiveIntensity != null &&
          o.material.emissiveIntensity > 0.5) {
        o.material.emissiveIntensity = night ? 1.4 : 0.15;
      }
    });
  }

  dispose() {
    if (!this.group) return;
    this.group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        const l = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of l) m.dispose();
      }
    });
    this.scene.remove(this.group);
    this.group = null;
    this._snowTargets = null;
    this._snow = null;
  }
}

export default Neighborhood;
