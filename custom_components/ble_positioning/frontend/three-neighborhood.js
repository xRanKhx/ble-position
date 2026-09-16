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
const HOUSE_COLORS = [0x9a958c, 0x8e877c, 0x847d73, 0x938b80, 0x7d776e];
const ROOF_COLORS  = [0x44433f, 0x3a3836, 0x4a403a, 0x333130];

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
      color: 0x2a2d33, roughness: 0.6, metalness: 0.02,
    });
    const walk = new THREE.MeshStandardMaterial({
      color: 0x60646a, roughness: 0.6, metalness: 0,
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
      this._snowTargets = this._snowTargets || [];
      this._snowTargets.push(roof);
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
  _addTrees(g, reach, roadW, ownW, ownD, r) {
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5a4632, roughness: 0.95 });
    for (let i = 0; i < 34; i++) {
      const x = (r() - 0.5) * reach * 1.9;
      const z = (r() - 0.5) * reach * 1.9;
      if (Math.hypot(x, z) > reach) continue;
      if (Math.abs(x) < ownW / 2 + 2 && Math.abs(z) < ownD / 2 + 2) continue;
      // Nicht auf der Fahrbahn, aber gern am Gehwegrand
      if (Math.abs(x) < roadW / 2 + 1.6 || Math.abs(z) < roadW / 2 + 1.6) continue;

      const hh = 3 + r() * 2.6;
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, hh, 6), trunkMat);
      t.position.set(x, hh / 2, z);
      t.castShadow = true;
      t.receiveShadow = true;
      g.add(t);
      const tree = { objs: [t], x, z, r: 1.8 };
      this._blockers.push(tree);

      const green = new THREE.MeshStandardMaterial({
        color: new THREE.Color().setHSL(0.26 + r() * 0.06, 0.38, 0.26 + r() * 0.1),
        roughness: 0.95,
      });
      for (let k = 0; k < 2; k++) {
        const rad = (1.1 + r() * 0.7) * (k ? 0.75 : 1);
        const c = new THREE.Mesh(new THREE.SphereGeometry(rad, 10, 8), green);
        c.position.set(x + (r() - 0.5) * 0.7, hh + rad * 0.5 + k * 0.7, z + (r() - 0.5) * 0.7);
        c.castShadow = true;
        c.receiveShadow = true;
        g.add(c);
        tree.objs.push(c);
        this._snowTargets = this._snowTargets || [];
        this._snowTargets.push(c);
      }
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
      for (const o of b.objs) o.visible = !blocks;
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
      tint(this._snowTargets, 0xeef3f8);   // Daecher und Baumkronen
      tint(this._roadTargets, 0xdfe6ee);   // Strassen und Gehwege
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
        m.material.roughness = wet ? 0.1 : m.userData.dryRough;
        m.material.metalness = wet ? 0.2 : m.userData.dryMetal;
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
