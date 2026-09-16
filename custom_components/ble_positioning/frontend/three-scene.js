/**
 * BLE Positioning – WebGL-Renderer (Three.js)
 *
 * Zweiter Renderer neben der Canvas-2D-Szene. Der Canvas-Renderer bleibt
 * unveraendert bestehen und dient als Rueckfallebene fuer Geraete ohne
 * brauchbares WebGL.
 *
 * Warum ueberhaupt: der 2D-Renderer sortiert Flaechen von hinten nach vorn.
 * Fuer Waende reicht das; sobald sich Moebel gegenseitig und die Waende
 * ueberlappen, hat eine Reihenfolge pro Flaeche keine richtige Antwort mehr.
 * Dafuer braucht es einen Tiefenpuffer pro Pixel. Ausserdem laesst sich ein
 * Canvas-Pattern nicht perspektivisch verzerren – Dielen wirken deshalb
 * aufgeklebt statt in die Tiefe laufend. Beides loest WebGL strukturell.
 *
 * Die Datei laedt Three.js aus vendor/ und nie von einem CDN: eine
 * HA-Instanz laeuft haeufig ohne Internetzugang.
 */

import * as THREE from "./vendor/three.module.js";
// Query-Version im Pfad: Modul-Importe nutzen den HTTP-Cache, und eine
// einmal als 404 gecachte URL bleibt tot, auch wenn die Datei laengst
// ausgeliefert wird. Bei jeder Aenderung an den Moebeln hochzaehlen.
import { makeFurniture, disposeFurnitureCache } from "./three-furniture.js?m=4";
import { SkyDome } from "./three-sky.js?s=5";

/* ── Prozedurale Texturen ────────────────────────────────────────────────
   Canvas-generiert statt mitgeliefert: keine Binaerdateien im Repo, und
   die Aufloesung laesst sich am Geraet ausrichten. */

function _canvasFrom(w, h, draw) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  draw(c.getContext("2d"), c);
  return c;
}

/* Normal-Map aus einem Graustufenbild. Die Helligkeit wird als Hoehe
   gelesen und per Sobel-Operator abgeleitet – so bekommen Fugen und
   Maserung echte Tiefe, statt nur aufgemalt zu sein. */
function normalFromHeight(srcCanvas, strength) {
  const w = srcCanvas.width, h = srcCanvas.height;
  const src = srcCanvas.getContext("2d").getImageData(0, 0, w, h).data;
  const lum = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    lum[i] = (src[i*4] * 0.299 + src[i*4+1] * 0.587 + src[i*4+2] * 0.114) / 255;
  }
  const at = (x, y) => lum[((y + h) % h) * w + ((x + w) % w)];
  const out = new ImageData(w, h);
  const k = strength ?? 2.2;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (at(x-1,y-1) + 2*at(x-1,y) + at(x-1,y+1))
               - (at(x+1,y-1) + 2*at(x+1,y) + at(x+1,y+1));
      const dy = (at(x-1,y-1) + 2*at(x,y-1) + at(x+1,y-1))
               - (at(x-1,y+1) + 2*at(x,y+1) + at(x+1,y+1));
      let nx = dx * k, ny = dy * k, nz = 1;
      const len = Math.hypot(nx, ny, nz) || 1;
      const i = (y * w + x) * 4;
      out.data[i]   = ((nx / len) * 0.5 + 0.5) * 255;
      out.data[i+1] = ((ny / len) * 0.5 + 0.5) * 255;
      out.data[i+2] = ((nz / len) * 0.5 + 0.5) * 255;
      out.data[i+3] = 255;
    }
  }
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  c.getContext("2d").putImageData(out, 0, 0);
  return c;
}

function _tex(canvas, renderer, srgb) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  const aniso = renderer?.capabilities?.getMaxAnisotropy?.() || 1;
  t.anisotropy = Math.min(8, aniso);
  return t;
}

/* Dielenboden als vollstaendiges PBR-Set: Farbe, Normale, Rauheit.
   Die Fugen sind in allen drei Karten an derselben Stelle – nur dann
   wirkt der Boden wie Holz und nicht wie bedrucktes Papier. */
function woodMaps(renderer) {
  const S = 512, plank = 64;
  const seams = [];
  const albedo = _canvasFrom(S, S, (x) => {
    for (let i = 0; i < S / plank; i++) {
      const base = 178 + Math.floor(Math.random() * 26);
      x.fillStyle = `rgb(${base},${Math.round(base*0.79)},${Math.round(base*0.55)})`;
      x.fillRect(0, i * plank, S, plank);
      for (let g = 0; g < 26; g++) {
        const y = i * plank + Math.random() * plank;
        x.strokeStyle = `rgba(90,60,30,${0.03 + Math.random() * 0.06})`;
        x.lineWidth = 0.5 + Math.random();
        x.beginPath(); x.moveTo(0, y);
        for (let px = 0; px <= S; px += 32) x.lineTo(px, y + Math.sin((px + i*40)/60) * 1.4);
        x.stroke();
      }
      const off = (i % 2) * 140;
      seams.push({ y: i * plank, off });
      x.strokeStyle = "rgba(60,40,20,0.35)";
      x.lineWidth = 1.5;
      x.beginPath(); x.moveTo(0, i * plank); x.lineTo(S, i * plank); x.stroke();
      for (let sx = off; sx < S; sx += 256) {
        x.beginPath(); x.moveTo(sx, i * plank); x.lineTo(sx, (i+1) * plank); x.stroke();
      }
    }
  });

  // Hoehenbild: nur die Fugen sind tief, die Maserung kaum
  const height = _canvasFrom(S, S, (x) => {
    x.fillStyle = "#b8b8b8"; x.fillRect(0, 0, S, S);
    x.strokeStyle = "#202020"; x.lineWidth = 2.5;
    for (const sm of seams) {
      x.beginPath(); x.moveTo(0, sm.y); x.lineTo(S, sm.y); x.stroke();
      for (let sx = sm.off; sx < S; sx += 256) {
        x.beginPath(); x.moveTo(sx, sm.y); x.lineTo(sx, sm.y + plank); x.stroke();
      }
    }
    // leichte Wellung der Dielen
    for (let i = 0; i < 90; i++) {
      x.strokeStyle = `rgba(255,255,255,${0.05 + Math.random()*0.06})`;
      x.lineWidth = 2 + Math.random() * 4;
      const y = Math.random() * S;
      x.beginPath(); x.moveTo(0, y); x.lineTo(S, y + (Math.random()-0.5)*6); x.stroke();
    }
  });

  // Rauheit: Fugen matt, Dielenmitte seidig
  const rough = _canvasFrom(S, S, (x) => {
    x.fillStyle = "#6e6e6e"; x.fillRect(0, 0, S, S);
    x.strokeStyle = "#d8d8d8"; x.lineWidth = 3;
    for (const sm of seams) {
      x.beginPath(); x.moveTo(0, sm.y); x.lineTo(S, sm.y); x.stroke();
      for (let sx = sm.off; sx < S; sx += 256) {
        x.beginPath(); x.moveTo(sx, sm.y); x.lineTo(sx, sm.y + plank); x.stroke();
      }
    }
  });

  return {
    map:          _tex(albedo, renderer, true),
    normalMap:    _tex(normalFromHeight(height, 2.6), renderer, false),
    roughnessMap: _tex(rough, renderer, false),
  };
}

function plasterMaps(renderer) {
  const S = 256;
  const base = _canvasFrom(S, S, (x) => {
    x.fillStyle = "#f2f2ef"; x.fillRect(0, 0, S, S);
    const img = x.getImageData(0, 0, S, S);
    for (let i = 0; i < img.data.length; i += 4) {
      const n = (Math.random() - 0.5) * 12;
      img.data[i] += n; img.data[i+1] += n; img.data[i+2] += n;
    }
    x.putImageData(img, 0, 0);
  });
  // Feines Korn als Relief – Putz ist nie spiegelglatt
  const height = _canvasFrom(S, S, (x) => {
    x.fillStyle = "#808080"; x.fillRect(0, 0, S, S);
    const img = x.getImageData(0, 0, S, S);
    for (let i = 0; i < img.data.length; i += 4) {
      const n = (Math.random() - 0.5) * 42;
      img.data[i] += n; img.data[i+1] += n; img.data[i+2] += n;
    }
    x.putImageData(img, 0, 0);
  });
  return {
    map:       _tex(base, renderer, true),
    normalMap: _tex(normalFromHeight(height, 0.7), renderer, false),
  };
}

/* Umgebungsmap: ohne sie hat Glas nichts zu spiegeln und wirkt flach,
   und Metall sieht aus wie grauer Kunststoff.

   Statt eine HDR-Datei mitzuliefern werden hier Umgebungen prozedural
   erzeugt. Das kostet einmalig ein paar Millisekunden, wiegt nichts im
   Paket und laesst sich in Stufen anbieten. Wer eine eigene Aufnahme
   nutzen will, gibt eine equirectangulare Bilddatei an – die Presets
   bleiben dann als Rueckfall bestehen. */

export const ENV_PRESETS = {
  studio:  { label: "Studio (hell)",    sky: ["#ffffff","#dfe6ef","#b9b3a8","#6d6459"],
             key: [150, 70, 110, "rgba(255,255,255,1)"],
             fill:[390, 96,  80, "rgba(255,236,205,0.85)"] },
  warm:    { label: "Abendlicht",       sky: ["#ffd9a8","#f0b183","#8a6a5a","#3d3230"],
             key: [170, 92, 130, "rgba(255,214,160,1)"],
             fill:[400,110,  70, "rgba(255,160,110,0.7)"] },
  neutral: { label: "Neutral grau",     sky: ["#f4f4f4","#d8d8d8","#a8a8a8","#6a6a6a"],
             key: [256, 64, 150, "rgba(255,255,255,0.9)"],
             fill:[100,120,  60, "rgba(255,255,255,0.35)"] },
  outdoor: { label: "Freier Himmel",    sky: ["#9fc7f0","#cfe3f7","#8fa87d","#4d5c42"],
             key: [120, 50,  90, "rgba(255,252,240,1)"],
             fill:[380, 80, 110, "rgba(200,225,255,0.6)"] },
};

function envCanvas(preset) {
  const p = ENV_PRESETS[preset] || ENV_PRESETS.studio;
  const c = document.createElement("canvas");
  c.width = 512; c.height = 256;
  const x = c.getContext("2d");

  const sky = x.createLinearGradient(0, 0, 0, 256);
  sky.addColorStop(0.00, p.sky[0]);
  sky.addColorStop(0.45, p.sky[1]);
  sky.addColorStop(0.55, p.sky[2]);
  sky.addColorStop(1.00, p.sky[3]);
  x.fillStyle = sky;
  x.fillRect(0, 0, 512, 256);

  // Weiches Lichtfeld – das erscheint auf Glaskanten als Glanz
  const soft = (cx, cy, r, col) => {
    const g = x.createRadialGradient(cx, cy, 4, cx, cy, r);
    g.addColorStop(0, col);
    g.addColorStop(1, col.replace(/[\d.]+\)$/, "0)"));
    x.fillStyle = g;
    x.fillRect(cx - r, cy - r, r * 2, r * 2);
  };
  soft(p.key[0],  p.key[1],  p.key[2],  p.key[3]);
  soft(p.fill[0], p.fill[1], p.fill[2], p.fill[3]);
  return c;
}

function envFromCanvas(renderer, canvas) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const env = pmrem.fromEquirectangular(tex).texture;
  pmrem.dispose();
  tex.dispose();
  return env;
}

export class ThreeScene {
  /**
   * @param {HTMLCanvasElement} canvas eigenes Canvas, getrennt vom 2D-Canvas
   */
  constructor(canvas, opts) {
    this.canvas = canvas;
    // Glas mit echter Lichtbrechung kostet pro Bild ein zusaetzliches
    // Render-Target. Auf schwachen Geraeten lieber schlichtes Transparenz-
    // glas als eine ruckelnde Szene.
    const cores = navigator.hardwareConcurrency || 4;
    this.lowQuality = opts?.lowQuality ?? (cores <= 4);
    this.ok = false;
    this.disposed = false;
    this._objects = [];
    this._onLost = null;

    try {
      this.renderer = new THREE.WebGLRenderer({
        // alpha: die Wetterkulisse liegt auf einem eigenen Canvas dahinter
        // und muss durchscheinen, wo kein Gebaeude steht.
        canvas, antialias: true, alpha: true, powerPreference: "default",
        // Ohne dieses Flag verwirft der Browser den Zeichenpuffer nach dem
        // Compositing. Die Szene steht meist still und wird nur bei
        // Aenderungen neu gezeichnet – das Bild waere danach schwarz.
        // Die Alternative waere ein dauernder RAF-Loop, der auf dem Handy
        // ohne Not Akku verbrennt.
        preserveDrawingBuffer: true,
      });
    } catch (e) {
      // Kein WebGL – der Aufrufer faellt auf den Canvas-Renderer zurueck
      this.error = e;
      return;
    }

    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.shadowMap.autoUpdate = true;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.scene = new THREE.Scene();
    this.scene.background = null;          // Himmel kommt vom Canvas dahinter
    this.renderer.setClearColor(0x000000, 0);

    // Orthografisch, nicht perspektivisch: das Referenzbild ist eine
    // isometrische Architekturdarstellung, keine Kameraaufnahme.
    // Tiefenbereich muss die Himmelskuppel einschliessen (Radius 1000).
    // Mit -200..400 lag sie ausserhalb und wurde weggeclippt – die Kuppel
    // war korrekt aufgebaut und trotzdem unsichtbar.
    // Bei orthografischer Projektion ist die Tiefe linear verteilt, eine
    // grosse Spanne kostet hier also keine Praezision.
    this.camera = new THREE.OrthographicCamera(-10, 10, 10, -10, -3000, 3000);

    this._buildLights();

    // Kontextverlust kommt in WebViews real vor (Tab im Hintergrund,
    // Speicherdruck). Ohne Behandlung bleibt ein schwarzes Bild stehen.
    this._lostHandler = (ev) => {
      ev.preventDefault();
      this.ok = false;
      if (this._onLost) this._onLost();
    };
    this._restoredHandler = () => { this.ok = true; this.render(); };
    canvas.addEventListener("webglcontextlost", this._lostHandler, false);
    canvas.addEventListener("webglcontextrestored", this._restoredHandler, false);

    this.wood = woodMaps(this.renderer);
    this.plaster = plasterMaps(this.renderer);
    // Reflexionen fuer alle Materialien, nicht nur fuers Glas
    this.ok = true;
    this.setEnvironment(opts?.envPreset || "studio", opts?.envUrl);
  }

  /* Quader mit gefasten Kanten. Three.js bringt so etwas nicht mit;
     eine ExtrudeGeometry mit kleiner Bevel ist der guenstigste Weg. */
  static chamferBox(w, h, d, bevel) {
    const b = Math.min(bevel ?? 0.012, w / 3, h / 3, d / 3);
    if (b <= 0.002) return new THREE.BoxGeometry(w, h, d);
    const sh = new THREE.Shape();
    sh.moveTo(-w / 2 + b, -h / 2);
    sh.lineTo(w / 2 - b, -h / 2);
    sh.lineTo(w / 2, -h / 2 + b);
    sh.lineTo(w / 2, h / 2 - b);
    sh.lineTo(w / 2 - b, h / 2);
    sh.lineTo(-w / 2 + b, h / 2);
    sh.lineTo(-w / 2, h / 2 - b);
    sh.lineTo(-w / 2, -h / 2 + b);
    sh.closePath();
    const geo = new THREE.ExtrudeGeometry(sh, {
      depth: d - b * 2, bevelEnabled: true, bevelSize: b, bevelThickness: b,
      bevelSegments: 1, curveSegments: 1,
    });
    geo.translate(0, 0, -(d - b * 2) / 2);
    geo.computeVertexNormals();
    return geo;
  }

  /**
   * Tageslicht nach Sonnenstand und Wetter.
   *
   * Der entscheidende Punkt: das Aussenlicht wird NICHT global in die
   * Raeume geschuettet. Die Grundhelligkeit bleibt niedrig, und das
   * Tageslicht kommt ueber eigene Lichter an Fenstern und offenen Tueren
   * herein (siehe updateDaylightPorts). Dadurch ist ein fensterloser Raum
   * von selbst dunkel – ohne Sonderregel, und eine Lampe wirkt dort auch
   * tagsueber.
   *
   * @param {{elevation:number, condition:string, night:boolean}} o
   */
  setDaylight(o) {
    if (!this.ok) return;
    const night = !!o.night;
    const cond = String(o.condition || "");
    // Truebung: 1 = klar, 0.5 = stark bewoelkt, darunter Regen und Sturm
    const clarity = night ? 0 :
      /sunny|clear/.test(cond)            ? 1.0 :
      /partlycloudy/.test(cond)           ? 0.78 :
      /cloudy|fog/.test(cond)             ? 0.5 :
      /rain|snow|sleet|hail/.test(cond)   ? 0.38 :
      /pouring|lightning|storm/.test(cond)? 0.28 : 0.7;

    // Sonnenhoehe: flach stehende Sonne bringt weniger Licht
    const elev = Math.max(0, Math.min(90, o.elevation ?? 45));
    const height = Math.sin((elev * Math.PI) / 180);
    this._dayFactor = night ? 0 : clarity * (0.25 + 0.75 * height);

    if (night) {
      // Mondlicht: sehr schwach, kuehl. Ohne etwas Grundlicht waere die
      // Szene komplett schwarz und man saehe nicht einmal die Umrisse.
      this.hemi.intensity = 0.16;
      this.hemi.color.setHex(0x2a3a5c);
      this.hemi.groundColor.setHex(0x14171f);
      this.sun.intensity = 0.12;
      this.sun.color.setHex(0x9fb6e0);
      this.sun.castShadow = false;          // Mondschatten waere aufdringlich
    } else {
      // Bedeckter Himmel streut: weniger Richtungslicht, mehr Diffuses
      this.hemi.intensity = 0.34 + (1 - clarity) * 0.5 + this._dayFactor * 0.3;
      this.hemi.color.setHex(0xdce8f5);
      this.hemi.groundColor.setHex(0xb9a88f);
      this.sun.intensity = 2.4 * this._dayFactor;
      this.sun.color.setHex(clarity > 0.7 ? 0xfff3e0 : 0xeef2f8);
      this.sun.castShadow = clarity > 0.45; // diffuses Licht wirft keine harten Schatten
    }
    this._applyPortIntensity();
  }

  /**
   * Fenster und offene Tueren als Lichtquellen. Jede Oeffnung bekommt ein
   * Licht knapp innerhalb des Raums – so wandert das Tageslicht dorthin,
   * wo es real auch hinkommt.
   * @param {Array<{x,y,sillH,topH,width,kind,open}>} ports
   */
  updateDaylightPorts(ports) {
    if (!this.ok) return;
    this._ports = this._ports || [];
    for (const p of this._ports) this.scene.remove(p.light);
    this._ports = [];

    // Lichtbudget: WebGL bindet jede Lampe im Shader. Die Raumlampen
    // brauchen Platz, daher hier deckeln und nach Flaeche priorisieren.
    const list = (ports || [])
      .filter(p => p.kind === "window" || p.open)
      .sort((a, b) => (b.width || 1) - (a.width || 1))
      .slice(0, 5);

    for (const p of list) {
      const h = ((p.sillH ?? 0.9) + (p.topH ?? 2.1)) / 2;
      const l = new THREE.PointLight(0xffffff, 0, 0, 2);
      l.castShadow = false;
      // Etwas nach innen versetzt, sonst leuchtet es die Aussenwand an
      l.position.set(p.x + (p.inx || 0) * 0.35, h, p.y + (p.iny || 0) * 0.35);
      l.userData.area = Math.max(0.3, (p.width || 1) * ((p.topH ?? 2.1) - (p.sillH ?? 0.9)));
      this.scene.add(l);
      this._ports.push({ light: l });
    }
    this._applyPortIntensity();
  }

  _applyPortIntensity() {
    if (!this._ports) return;
    const f = this._dayFactor ?? 0.6;
    for (const p of this._ports) {
      // Grosse Fenster lassen mehr herein; Candela wie bei den Lampen
      const lumen = 2600 * f * p.light.userData.area;
      p.light.intensity = lumen / (4 * Math.PI);
      p.light.color.setHex(f > 0.55 ? 0xfff4e2 : 0xe8eef7);
    }
  }

  /** Himmelskuppel anlegen. Ersetzt Hintergrundfarbe und Wetter-Canvas. */
  async initSky(mode) {
    if (!this.ok || this.dome) return null;
    this.dome = new SkyDome(this.scene, { mode: mode || "sky" });
    const used = await this.dome.initShader();
    this.scene.background = null;     // die Kuppel traegt den Himmel
    this._skyHex = "__dome__";
    return used;
  }

  onContextLost(fn) { this._onLost = fn; }

  /* Ambient Occlusion fuer den Boden: zum Wandfuss hin wird es dunkler,
     in den Ecken am staerksten. Echtes SSAO waere ein Post-Processing-Pass
     mit einem zusaetzlichen Vollbild-Durchlauf pro Frame – auf dem Handy
     teuer. Eine gebackene Karte kostet einmalig ein paar Millisekunden
     und traegt denselben Eindruck: Flaechen wirken angefasst statt
     aufgelegt.
     Der Verlauf wird in Metern gerechnet, damit ein grosser Raum nicht
     mehr Schatten bekommt als ein kleiner. */
  _roomAO(w, h) {
    const key = w.toFixed(2) + "x" + h.toFixed(2);
    this._aoCache = this._aoCache || new Map();
    if (this._aoCache.has(key)) return this._aoCache.get(key);

    const S = 256;
    const c = document.createElement("canvas");
    c.width = c.height = S;
    const x = c.getContext("2d");
    x.fillStyle = "#ffffff";
    x.fillRect(0, 0, S, S);

    // Abklinglaenge: rund 45 cm, in Pixel je Achse umgerechnet
    const fall = 0.45;
    const px = Math.min(0.42, fall / Math.max(w, 0.1)) * S;
    const py = Math.min(0.42, fall / Math.max(h, 0.1)) * S;
    const edge = (grad) => { x.fillStyle = grad; x.fillRect(0, 0, S, S); };

    const g1 = x.createLinearGradient(0, 0, px, 0);
    g1.addColorStop(0, "rgba(0,0,0,0.42)"); g1.addColorStop(1, "rgba(0,0,0,0)");
    edge(g1);
    const g2 = x.createLinearGradient(S, 0, S - px, 0);
    g2.addColorStop(0, "rgba(0,0,0,0.42)"); g2.addColorStop(1, "rgba(0,0,0,0)");
    edge(g2);
    const g3 = x.createLinearGradient(0, 0, 0, py);
    g3.addColorStop(0, "rgba(0,0,0,0.42)"); g3.addColorStop(1, "rgba(0,0,0,0)");
    edge(g3);
    const g4 = x.createLinearGradient(0, S, 0, S - py);
    g4.addColorStop(0, "rgba(0,0,0,0.42)"); g4.addColorStop(1, "rgba(0,0,0,0)");
    edge(g4);

    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    this._aoCache.set(key, t);
    return t;
  }

  /**
   * Umgebung setzen. Ohne eigene Datei greift eines der Presets, das ist
   * der Normalfall. `url` erwartet ein equirectangulares Bild; schlaegt
   * das Laden fehl, bleibt das Preset stehen statt dass die Spiegelungen
   * ganz verschwinden.
   */
  setEnvironment(preset, url) {
    if (!this.ok) return;
    const apply = (tex) => {
      const old = this.env;
      this.env = tex;
      this.scene.environment = tex;
      if (old && old !== tex) old.dispose();
    };
    if (preset === "off") { apply(null); return; }

    apply(envFromCanvas(this.renderer, envCanvas(preset)));
    if (!url) return;

    // Eigene Aufnahme nachladen – asynchron, damit die Szene sofort steht
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (this.disposed || !this.ok) return;
      try {
        const c = document.createElement("canvas");
        c.width = img.naturalWidth; c.height = img.naturalHeight;
        c.getContext("2d").drawImage(img, 0, 0);
        apply(envFromCanvas(this.renderer, c));
      } catch (e) {
        console.warn("BLE Positioning: Umgebungsbild unbrauchbar, nutze Preset", e);
      }
    };
    img.onerror = () => {
      console.warn("BLE Positioning: Umgebungsbild nicht ladbar:", url);
    };
    img.src = url;
  }

  _buildLights() {
    // Himmel/Boden-Aufhellung ersetzt teure globale Beleuchtung
    // Referenz behalten: die Grundhelligkeit haengt an Tageszeit und Wetter
    this.hemi = new THREE.HemisphereLight(0xdcE8f5, 0xb9a88f, 1.5);
    this.scene.add(this.hemi);

    const sun = new THREE.DirectionalLight(0xfff3e0, 2.1);
    sun.castShadow = true;
    // Auflösung nach Leistung: eine 4k-Map kostet 64 MB, das lohnt nur
    // auf kräftiger Hardware. Radius weicht die Kante auf.
    const big = (navigator.hardwareConcurrency || 4) > 4;
    sun.shadow.mapSize.set(big ? 4096 : 2048, big ? 4096 : 2048);
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.025;
    sun.shadow.radius = 2.5;
    this.sun = sun;
    this.scene.add(sun);
    this.scene.add(sun.target);
  }

  /* Wand mit Öffnungen. Three.js kennt kein CSG, und eine Boolean-
     Bibliothek wäre für rechteckige Löcher überdimensioniert: die Wand
     wird stattdessen aus Segmenten um jede Öffnung herum zusammengesetzt.
     Robust, exakt, und die Segmente werfen korrekte Schatten.

     `axis` ist "x" (Wand läuft in X-Richtung) oder "z".
     `openings`: [{ pos, width, sillH, topH }] – pos ist die Mitte der
     Öffnung entlang der Wandachse, in Weltkoordinaten. */
  _wallWithOpenings(axis, aStart, aEnd, fixed, wallH, wd, openings, mat) {
    const g = new THREE.Group();
    const len = aEnd - aStart;
    if (len <= 0) return g;

    const box = (a0, a1, y0, y1) => {
      const w = a1 - a0, h = y1 - y0;
      if (w <= 0.001 || h <= 0.001) return;
      // Leichte Fase an den Kanten: eine scharfe Kante faengt kein Licht
      // und wirkt deshalb wie ausgeschnittenes Papier. Der Grat von wenigen
      // Millimetern erzeugt den hellen Saum, den echte Wandkanten haben.
      const geo = axis === "x"
        ? ThreeScene.chamferBox(w, h, wd)
        : ThreeScene.chamferBox(wd, h, w);
      const m = new THREE.Mesh(geo, mat);
      const ac = (a0 + a1) / 2, yc = (y0 + y1) / 2;
      m.position.set(axis === "x" ? ac : fixed, yc, axis === "x" ? fixed : ac);
      m.castShadow = true;
      m.receiveShadow = true;
      g.add(m);
    };

    // Öffnungen sortieren und auf die Wand beschneiden
    const ops = (openings || [])
      .map(o => ({
        a0: Math.max(aStart, o.pos - o.width / 2),
        a1: Math.min(aEnd,   o.pos + o.width / 2),
        y0: Math.max(0, o.sillH || 0),
        y1: Math.min(wallH, o.topH ?? wallH),
      }))
      .filter(o => o.a1 > o.a0 && o.y1 > o.y0)
      .sort((p, q) => p.a0 - q.a0);

    let cur = aStart;
    for (const o of ops) {
      box(cur, o.a0, 0, wallH);                 // Pfeiler davor
      if (o.y0 > 0)     box(o.a0, o.a1, 0, o.y0);        // Brüstung unter dem Fenster
      if (o.y1 < wallH) box(o.a0, o.a1, o.y1, wallH);    // Sturz darüber
      cur = Math.max(cur, o.a1);
    }
    box(cur, aEnd, 0, wallH);                   // Rest bis zum Wandende
    return g;
  }

  /* Türblatt. Der Öffnungswinkel kommt aus dem HA-Status, damit eine
     offene Tür auch offen dasteht. */
  _doorLeaf(axis, pos, fixed, width, height, wd, openAmount) {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({
      color: 0xb98a5c, roughness: 0.65, metalness: 0.02,
    });
    const leaf = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, Math.max(0.03, wd * 0.28)), mat
    );
    // Drehpunkt an die Kante legen, sonst rotiert das Blatt um die Mitte
    leaf.position.x = width / 2;
    leaf.position.y = height / 2;
    leaf.castShadow = true;
    const pivot = new THREE.Group();
    pivot.add(leaf);
    pivot.rotation.y = -(openAmount || 0) * Math.PI * 0.42;
    if (axis === "x") pivot.position.set(pos - width / 2, 0, fixed);
    else { pivot.position.set(fixed, 0, pos - width / 2); pivot.rotation.y += Math.PI / 2; }
    g.add(pivot);

    // Zarge
    const fr = new THREE.MeshStandardMaterial({ color: 0xe8e4dc, roughness: 0.8 });
    const t = 0.05;
    const jamb = (dx, dz, w, h, d) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), fr);
      m.position.set(
        axis === "x" ? pos + dx : fixed,
        h / 2 + (dz === "top" ? height : 0),
        axis === "x" ? fixed : pos + dx
      );
      if (dz === "top") m.position.y = height + t / 2;
      m.castShadow = true;
      g.add(m);
    };
    const side = axis === "x" ? [width / 2, -width / 2] : [width / 2, -width / 2];
    for (const s of side) jamb(s, "side", axis === "x" ? t : wd * 1.05, height, axis === "x" ? wd * 1.05 : t);
    jamb(0, "top", axis === "x" ? width + t * 2 : wd * 1.05, t, axis === "x" ? wd * 1.05 : width + t * 2);
    return g;
  }

  /* Fenster: Rahmen, Glas, Fensterbank. Glas ist bewusst nicht voll
     transparent – sonst verschwindet es in der isometrischen Ansicht. */
  _windowUnit(axis, pos, fixed, width, sillH, topH, wd, state) {
    const g = new THREE.Group();
    const h = topH - sillH;
    const frameMat = new THREE.MeshStandardMaterial({ color: 0xf0f2f5, roughness: 0.55 });
    // Echtes Fensterglas ist farblos – gruenlich wird es nur an der
    // Schnittkante. Die fruehere Blaufaerbung kam aus einem eingefaerbten
    // color-Wert. Ausserdem schliessen sich transmission und
    // transparent/opacity gegenseitig aus: transmission bringt seine
    // eigene Durchsicht mit, opacity daneben macht es milchig.
    const glassMat = this.lowQuality
      ? new THREE.MeshPhysicalMaterial({
          color: 0xffffff, roughness: 0.06, metalness: 0,
          transparent: true, opacity: 0.22, envMapIntensity: 1.4,
        })
      : new THREE.MeshPhysicalMaterial({
          color: 0xffffff, roughness: 0.02, metalness: 0,
          transmission: 1.0, thickness: 0.012, ior: 1.52,
          specularIntensity: 1.0, envMapIntensity: 1.5,
          transparent: false,
        });
    const put = (mesh, a, y, d) => {
      mesh.position.set(axis === "x" ? a : fixed + (d || 0), y, axis === "x" ? fixed + (d || 0) : a);
      g.add(mesh);
    };
    const glass = new THREE.Mesh(
      axis === "x" ? new THREE.BoxGeometry(width * 0.92, h * 0.9, 0.02)
                   : new THREE.BoxGeometry(0.02, h * 0.9, width * 0.92),
      glassMat
    );
    put(glass, pos, sillH + h / 2);

    const fw = 0.05;
    const bar = (w, hh, d, a, y) => {
      const m = new THREE.Mesh(
        axis === "x" ? new THREE.BoxGeometry(w, hh, d) : new THREE.BoxGeometry(d, hh, w),
        frameMat
      );
      m.castShadow = true;
      put(m, a, y);
    };
    bar(width, fw, wd * 1.02, pos, sillH);          // unten
    bar(width, fw, wd * 1.02, pos, topH);           // oben
    bar(fw, h, wd * 1.02, pos - width / 2, sillH + h / 2);
    bar(fw, h, wd * 1.02, pos + width / 2, sillH + h / 2);

    // Zustandsring: offen/gekippt sichtbar machen, ohne Text zu brauchen
    if (state === "open" || state === "tilted") {
      const c = state === "open" ? 0xe06c6c : 0xe0a13f;
      const ring = new THREE.Mesh(
        axis === "x" ? new THREE.BoxGeometry(width * 0.94, 0.03, wd * 1.3)
                     : new THREE.BoxGeometry(wd * 1.3, 0.03, width * 0.94),
        new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.5 })
      );
      put(ring, pos, topH - 0.04);
    }
    return g;
  }

  /* ── Licht ───────────────────────────────────────────────────────────
     Three.js rechnet seit r155 in physikalischen Einheiten: Intensität
     einer Punktlichtquelle in Candela, Abfall mit dem Quadrat der
     Entfernung (decay = 2). Damit verhält sich eine Lampe von selbst
     richtig – doppelter Abstand, ein Viertel der Helligkeit – statt dass
     man einen Radius von Hand einstellt.

     HA liefert je nach Lampe rgb_color, color_temp_kelvin oder nur
     brightness. Alle drei Fälle landen hier in Farbe plus Lumen. */

  /** Farbtemperatur nach RGB, Näherung nach Tanner Helland. */
  static kelvinToRGB(k) {
    const t = Math.max(1000, Math.min(12000, k)) / 100;
    let r, g, b;
    if (t <= 66) {
      r = 255;
      g = 99.47 * Math.log(t) - 161.12;
      b = t <= 19 ? 0 : 138.52 * Math.log(t - 10) - 305.04;
    } else {
      r = 329.7 * Math.pow(t - 60, -0.1332);
      g = 288.12 * Math.pow(t - 60, -0.0755);
      b = 255;
    }
    const cl = (v) => Math.max(0, Math.min(255, v)) / 255;
    return [cl(r), cl(g), cl(b)];
  }

  /**
   * Lichter aus HA übernehmen. Wird bei jeder Zustandsänderung gerufen –
   * bestehende Lampen werden aktualisiert statt neu gebaut, damit Farbe
   * und Helligkeit ohne Flackern überblenden können.
   *
   * @param {Array<{x,y,z,on,brightness,rgb,kelvin,entity}>} lights
   */
  updateLights(lights) {
    if (!this.ok) return;
    this._lamps = this._lamps || new Map();
    const seen = new Set();
    // WebGL bindet Lichter im Shader: jede zusätzliche Lampe kostet in
    // jedem Fragment. Darum eine harte Obergrenze – die hellsten gewinnen.
    const MAX = 8;
    const list = (lights || [])
      .filter(l => l.on && l.x != null && l.y != null)
      .sort((a, b) => (b.brightness || 0) - (a.brightness || 0))
      .slice(0, MAX);

    for (const l of list) {
      const key = l.entity || `${l.x},${l.y}`;
      seen.add(key);
      let lamp = this._lamps.get(key);
      if (!lamp) {
        const pl = new THREE.PointLight(0xffffff, 1, 0, 2);   // decay 2
        pl.castShadow = false;      // Punktschatten sind teuer; die Sonne reicht
        const bulb = new THREE.Mesh(
          new THREE.SphereGeometry(0.05, 12, 8),
          new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff })
        );
        const grp = new THREE.Group();
        grp.add(pl); grp.add(bulb);
        this.scene.add(grp);
        lamp = { grp, pl, bulb };
        this._lamps.set(key, lamp);
      }

      // Farbe: RGB schlägt Kelvin, Kelvin schlägt neutrales Warmweiß
      let rgb;
      if (Array.isArray(l.rgb) && l.rgb.length === 3) {
        rgb = l.rgb.map(v => Math.max(0, Math.min(255, v)) / 255);
      } else if (l.kelvin) {
        rgb = ThreeScene.kelvinToRGB(l.kelvin);
      } else {
        rgb = ThreeScene.kelvinToRGB(2700);
      }
      lamp.pl.color.setRGB(rgb[0], rgb[1], rgb[2]);
      lamp.bulb.material.color.setRGB(rgb[0], rgb[1], rgb[2]);
      lamp.bulb.material.emissive.setRGB(rgb[0], rgb[1], rgb[2]);

      // Helligkeit: HA gibt 0..255. Als Lichtstrom gedacht entspricht
      // volle Helligkeit etwa einer 800-lm-Birne. Candela = lm / 4π.
      const frac = Math.max(0, Math.min(255, l.brightness ?? 255)) / 255;
      const lumen = 800 * frac;
      lamp.pl.intensity = lumen / (4 * Math.PI);
      lamp.bulb.material.emissiveIntensity = 0.4 + frac * 0.6;

      const h = l.z != null ? l.z : Math.max(0.6, (this._wallH || 2.5) - 0.35);
      lamp.grp.position.set(l.x, h, l.y);
    }

    // Erloschene oder entfallene Lampen abräumen
    for (const [key, lamp] of this._lamps) {
      if (seen.has(key)) continue;
      this.scene.remove(lamp.grp);
      lamp.bulb.geometry.dispose();
      lamp.bulb.material.dispose();
      this._lamps.delete(key);
    }
  }

  /** Alte Geometrie freigeben – sonst waechst der GPU-Speicher bei jedem Neubau. */
  _clear() {
    for (const o of this._objects) {
      this.scene.remove(o);
      o.traverse?.((n) => {
        if (n.geometry) n.geometry.dispose();
        if (n.material) {
          const mats = Array.isArray(n.material) ? n.material : [n.material];
          for (const m of mats) m.dispose();
        }
      });
    }
    this._objects = [];
  }

  /**
   * Szene aus den Kartendaten aufbauen.
   * @param {{rooms:Array, floorW:number, floorH:number, wallHeight:number,
   *          wallDepth:number, sunAzimuth:number, sunElevation:number}} d
   */
  build(d) {
    if (!this.ok) return;
    this._clear();

    const rooms = d.rooms || [];
    const wallH = Math.max(0.5, Math.min(6, d.wallHeight ?? 2.5));
    const wd = d.wallDepth ?? 0.14;

    // Bezugsrahmen: die bebaute Flaeche, nicht das Grundstueck. Sonst
    // schrumpft das Gebaeude, wenn das Grundstueck viel groesser ist.
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    for (const r of rooms) {
      if (r.x1 == null || r.x2 == null) continue;
      x1 = Math.min(x1, r.x1, r.x2); x2 = Math.max(x2, r.x1, r.x2);
      y1 = Math.min(y1, r.y1, r.y2); y2 = Math.max(y2, r.y1, r.y2);
    }
    if (!isFinite(x1)) { x1 = 0; y1 = 0; x2 = d.floorW || 10; y2 = d.floorH || 10; }
    this.bounds = { x1, y1, x2, y2 };
    const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2;
    this.center = new THREE.Vector3(cx, 0, cy);
    this.span = Math.max(x2 - x1, y2 - y1, 2);

    this._wallH = wallH;
    this._walls = [];
    const group = new THREE.Group();

    // Tueren und Fenster in eine gemeinsame Form bringen: die Wandlogik
    // interessiert nur Position, Breite und Hoehenband.
    const openings = [];
    for (const dr of (d.doors || [])) {
      if (dr.x == null || dr.y == null) continue;
      openings.push({
        kind: "door", x: dr.x, y: dr.y,
        width: dr.width || 0.9, sillH: 0, topH: dr.height || 2.05,
        openAmount: dr.state === "open" ? 1 : (dr.open_amount ?? 0),
      });
    }
    for (const wi of (d.windows || [])) {
      if (wi.x == null || wi.y == null) continue;
      openings.push({
        kind: "window", x: wi.x, y: wi.y,
        width: wi.width || 1.1,
        sillH: wi.sill ?? 0.9,
        topH: (wi.sill ?? 0.9) + (wi.height || 1.2),
        state: wi.state,
      });
    }

    // ── Sockelplatte ────────────────────────────────────────────────────
    const pad = 0.45;
    const pw = (x2 - x1) + pad * 2, ph = (y2 - y1) + pad * 2;
    const plate = new THREE.Mesh(
      new THREE.BoxGeometry(pw, 0.12, ph),
      new THREE.MeshStandardMaterial({ color: 0xf6f7f9, roughness: 0.92, metalness: 0 })
    );
    plate.position.set(cx, -0.06, cy);
    plate.receiveShadow = true;
    group.add(plate);

    // ── Raeume ──────────────────────────────────────────────────────────
    for (const r of rooms) {
      if (r.x1 == null || r.x2 == null) continue;
      const rx1 = Math.min(r.x1, r.x2), rx2 = Math.max(r.x1, r.x2);
      const ry1 = Math.min(r.y1, r.y2), ry2 = Math.max(r.y1, r.y2);
      const rw = rx2 - rx1, rh = ry2 - ry1;
      if (rw <= 0 || rh <= 0) continue;

      // Boden: eigene Texturkopie, damit repeat pro Raum stimmt und die
      // Dielen ueber Raumgrenzen hinweg nicht springen.
      // Alle drei Karten teilen dieselbe Kachelung, sonst sitzen Fugen,
      // Relief und Glanz nicht uebereinander.
      const rep = [rw / 2.2, rh / 2.2], offs = [rx1 / 2.2, ry1 / 2.2];
      const mk = (t) => { const c = t.clone(); c.needsUpdate = true;
        c.repeat.set(rep[0], rep[1]); c.offset.set(offs[0], offs[1]); return c; };
      const floorGeo = new THREE.PlaneGeometry(rw, rh);
      // aoMap braucht einen zweiten UV-Satz; der erste passt hier genau.
      floorGeo.setAttribute("uv1", floorGeo.getAttribute("uv"));
      const floor = new THREE.Mesh(floorGeo, new THREE.MeshStandardMaterial({
        map: mk(this.wood.map),
        normalMap: mk(this.wood.normalMap),
        normalScale: new THREE.Vector2(0.8, 0.8),
        roughnessMap: mk(this.wood.roughnessMap),
        roughness: 1, metalness: 0,
        aoMap: this._roomAO(rw, rh), aoMapIntensity: 1,
        envMapIntensity: 0.55,
      }));
      floor.rotation.x = -Math.PI / 2;
      floor.position.set(rx1 + rw / 2, 0.001, ry1 + rh / 2);
      floor.receiveShadow = true;
      group.add(floor);

      // Waende als Koerper mit Dicke, Decke bleibt offen (Puppenhaus).
      // Nur Nord- und Westwand, damit der Raum zur Kamera hin offen bleibt.
      const wallMat = new THREE.MeshStandardMaterial({
        map: this.plaster.map, normalMap: this.plaster.normalMap,
        normalScale: new THREE.Vector2(0.35, 0.35),
        color: 0xffffff, roughness: 0.94, metalness: 0, envMapIntensity: 0.4,
      });
      // Alle vier Wände bauen. Nur Nord und West zu zeichnen war zu
      // einfach gedacht: Fenster an der Süd- oder Ostwand hatten dann
      // keine Wand, in der sie sitzen konnten, und blieben unsichtbar.
      // Stattdessen werden alle gebaut und die zur Kamera zeigenden beim
      // Blickwechsel ausgeblendet (siehe _updateWallVisibility).
      const near = (v, t) => Math.abs(v - t) < 0.45;
      const sides = [
        { id: "N", axis: "x", a0: rx1 - wd, a1: rx2 + wd, fixed: ry1 - wd / 2, nx: 0, nz: -1 },
        { id: "S", axis: "x", a0: rx1 - wd, a1: rx2 + wd, fixed: ry2 + wd / 2, nx: 0, nz:  1 },
        { id: "W", axis: "z", a0: ry1 - wd, a1: ry2 + wd, fixed: rx1 - wd / 2, nx: -1, nz: 0 },
        { id: "E", axis: "z", a0: ry1 - wd, a1: ry2 + wd, fixed: rx2 + wd / 2, nx:  1, nz: 0 },
      ];

      for (const sd of sides) {
        const ops = [];
        for (const o of openings) {
          const along = sd.axis === "x" ? o.x : o.y;
          const across = sd.axis === "x" ? o.y : o.x;
          const lo = sd.axis === "x" ? rx1 : ry1, hi = sd.axis === "x" ? rx2 : ry2;
          const edge = sd.id === "N" ? ry1 : sd.id === "S" ? ry2
                     : sd.id === "W" ? rx1 : rx2;
          if (near(across, edge) && along >= lo - 0.5 && along <= hi + 0.5) {
            ops.push({ ...o, axis: sd.axis, pos: along, fixed: sd.fixed });
          }
        }
        const wall = this._wallWithOpenings(sd.axis, sd.a0, sd.a1, sd.fixed,
                                            wallH, wd, ops, wallMat);
        // Normale merken, damit die Sichtbarkeit später vom Blickwinkel
        // abhängen kann statt fest verdrahtet zu sein.
        wall.userData.normal = new THREE.Vector3(sd.nx, 0, sd.nz);
        wall.userData.isWall = true;
        group.add(wall);
        this._walls.push(wall);

        for (const o of ops) {
          const el = o.kind === "door"
            ? this._doorLeaf(o.axis, o.pos, o.fixed, o.width, o.topH ?? 2.05, wd, o.openAmount)
            : this._windowUnit(o.axis, o.pos, o.fixed, o.width, o.sillH ?? 0.9,
                               o.topH ?? 2.1, wd, o.state);
          el.userData.normal = wall.userData.normal;
          el.userData.isWall = true;
          group.add(el);
          this._walls.push(el);
        }
      }

      // Sockelleiste: klein, aber sie macht den Uebergang glaubwuerdig
      const skMat = new THREE.MeshStandardMaterial({ color: 0xf8f8f6, roughness: 0.6 });
      const sk1 = new THREE.Mesh(new THREE.BoxGeometry(rw, 0.09, 0.025), skMat);
      sk1.position.set(rx1 + rw / 2, 0.045, ry1 + 0.012);
      group.add(sk1);
      const sk2 = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.09, rh), skMat);
      sk2.position.set(rx1 + 0.012, 0.045, ry1 + rh / 2);
      group.add(sk2);
    }

    // ── Moebel und Geraete ──────────────────────────────────────────────
    for (const it of (d.furniture || [])) {
      const obj = makeFurniture(it.type, it);
      if (!obj) continue;
      if (it.scale && it.scale !== 1) obj.scale.setScalar(it.scale);
      group.add(obj);
    }

    // Oeffnungen fuer das Tageslicht merken, mit Richtung nach innen
    const ports = openings.map(o => {
      let inx = 0, iny = 0;
      for (const r of rooms) {
        if (r.x1 == null) continue;
        const rx1 = Math.min(r.x1, r.x2), rx2 = Math.max(r.x1, r.x2);
        const ry1 = Math.min(r.y1, r.y2), ry2 = Math.max(r.y1, r.y2);
        if (o.x >= rx1 - 0.5 && o.x <= rx2 + 0.5 && o.y >= ry1 - 0.5 && o.y <= ry2 + 0.5) {
          iny = Math.abs(o.y - ry1) < 0.45 ? 1 : Math.abs(o.y - ry2) < 0.45 ? -1 : 0;
          inx = Math.abs(o.x - rx1) < 0.45 ? 1 : Math.abs(o.x - rx2) < 0.45 ? -1 : 0;
          break;
        }
      }
      return { ...o, inx, iny, open: o.kind === "door" && (o.openAmount || 0) > 0.1 };
    });
    this.updateDaylightPorts(ports);

    this.scene.add(group);
    this._objects.push(group);

    this.setSun(d.sunAzimuth ?? 135, d.sunElevation ?? 55);
    this.resize();
  }

  /**
   * Personen aus dem Tracking. Getrennt von build(), weil sich Positionen
   * laufend aendern – Figuren werden verschoben statt neu gebaut, sonst
   * flackert es bei jedem Update.
   * @param {Array<{id,x,y,posture,color,heading}>} people
   */
  updatePeople(people) {
    if (!this.ok) return;
    this._people = this._people || new Map();
    const seen = new Set();
    for (const p of (people || [])) {
      if (p.x == null || p.y == null) continue;
      const id = p.id || `${p.x},${p.y}`;
      seen.add(id);
      let fig = this._people.get(id);
      // Haltungswechsel braucht eine andere Geometrie, sonst reicht Verschieben
      if (fig && fig.posture !== (p.posture || "standing")) {
        this.scene.remove(fig.obj); fig = null; this._people.delete(id);
      }
      if (!fig) {
        const obj = makeFurniture("person", {
          posture: p.posture || "standing", color: p.color,
        });
        if (!obj) continue;
        this.scene.add(obj);
        fig = { obj, posture: p.posture || "standing" };
        this._people.set(id, fig);
      }
      fig.obj.position.set(p.x, p.z || 0, p.y);
      if (p.heading != null) fig.obj.rotation.y = (p.heading * Math.PI) / 180;
    }
    for (const [id, fig] of this._people) {
      if (seen.has(id)) continue;
      this.scene.remove(fig.obj);
      this._people.delete(id);
    }
  }

  /** Sonnenstand aus HA uebernehmen – dieselbe Quelle wie die 2D-Kulisse. */
  setSun(azimuthDeg, elevationDeg) {
    if (!this.ok || !this.sun) return;
    // Kuppel folgt demselben Sonnenstand wie das Richtungslicht
    if (this.dome) this.dome.updateSunPosition(elevationDeg, azimuthDeg);
    const az = (azimuthDeg * Math.PI) / 180;
    const el = Math.max(12, elevationDeg) * Math.PI / 180;
    const dist = this.span * 3 + 10;
    this.sun.position.set(
      this.center.x + Math.sin(az) * Math.cos(el) * dist,
      Math.sin(el) * dist,
      this.center.z + Math.cos(az) * Math.cos(el) * dist
    );
    this.sun.target.position.copy(this.center);
    const s = this.span * 1.4 + 3;
    const cam = this.sun.shadow.camera;
    cam.left = -s; cam.right = s; cam.top = s; cam.bottom = -s;
    cam.near = 0.5; cam.far = dist * 2.2;
    cam.updateProjectionMatrix();
  }

  /** Kamera aus Azimut/Elevation/Zoom setzen – gleiche Bedienung wie in 2D. */
  setView(azimuthDeg, elevationDeg, zoom) {
    if (!this.ok) return;
    this._az = azimuthDeg; this._el = elevationDeg; this._zoom = zoom || 1;
    const az = (azimuthDeg * Math.PI) / 180;
    const el = Math.max(5, Math.min(89, elevationDeg)) * Math.PI / 180;
    const d = this.span * 4 + 20;
    this.camera.position.set(
      this.center.x + Math.sin(az) * Math.cos(el) * d,
      Math.sin(el) * d,
      this.center.z + Math.cos(az) * Math.cos(el) * d
    );
    this.camera.lookAt(this.center);
    this._updateWallVisibility();
    this.resize();
  }

  /* Wände, deren Aussenseite zur Kamera zeigt, würden den Raum zustellen.
     Sie werden ausgeblendet – dasselbe Prinzip wie das Backface-Culling im
     Canvas-Renderer, nur pro Wand statt pro Fläche. */
  _updateWallVisibility() {
    if (!this._walls || !this._walls.length) return;
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);          // zeigt von der Kamera weg
    for (const w of this._walls) {
      const n = w.userData.normal;
      if (!n) continue;
      // Skalarprodukt > 0: die Aussenseite zeigt von der Kamera fort,
      // die Wand steht also hinten und bleibt sichtbar.
      w.visible = n.dot(dir) > 0.06;
    }
  }

  /* Weltpunkt nach Bildschirmkoordinaten (CSS-Pixel). Damit koennen die
     bestehenden 2D-Overlays – Musik-Bubbles samt Treffer-Zonen – unveraendert
     ueber der WebGL-Szene weiterlaufen, statt sie in 3D neu zu bauen. */
  projectToScreen(x, y, z) {
    const v = new THREE.Vector3(x, z || 0, y).project(this.camera);
    const w = this.canvas.clientWidth || 1, h = this.canvas.clientHeight || 1;
    return { x: (v.x * 0.5 + 0.5) * w, y: (-v.y * 0.5 + 0.5) * h };
  }

  /** Pixel pro Meter auf dem Bildschirm – fuer Groessen in den Overlays. */
  screenUnitPx() {
    const a = this.projectToScreen(0, 0, 0);
    const b = this.projectToScreen(1, 0, 0);
    return Math.max(4, Math.hypot(b.x - a.x, b.y - a.y));
  }

  /** Himmelsfarbe, z. B. aus dem Wetterzustand. */
  setSkyWeather(condition) {
    if (this.dome) this.dome.setWeather(condition);
  }

  setSky(hex) {
    if (!this.ok) return;
    if (this.dome) return;             // Kuppel hat Vorrang

    if (this._skyHex === hex) return;      // Farbobjekt nicht jedes Bild neu
    this._skyHex = hex;
    // null heisst: das Wetter-Canvas dahinter uebernimmt den Himmel
    this.scene.background = hex ? new THREE.Color(hex) : null;
  }

  resize() {
    if (!this.ok) return;
    const w = this.canvas.clientWidth || 300;
    const h = this.canvas.clientHeight || 200;
    this.renderer.setSize(w, h, false);
    // Orthografisches Frustum an das Seitenverhaeltnis anpassen
    const half = (this.span * 0.85) / (this._zoom || 1);
    const aspect = w / h;
    let hw = half, hh = half;
    if (aspect >= 1) hw = half * aspect; else hh = half / aspect;
    const c = this.camera;
    c.left = -hw; c.right = hw; c.top = hh; c.bottom = -hh;
    c.updateProjectionMatrix();
  }

  render() {
    if (!this.ok || this.disposed) return;
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.disposed = true;
    this.ok = false;
    this._clear();
    this.canvas.removeEventListener("webglcontextlost", this._lostHandler);
    this.canvas.removeEventListener("webglcontextrestored", this._restoredHandler);
    if (this._people) {
      for (const f of this._people.values()) this.scene.remove(f.obj);
      this._people.clear();
    }
    if (this._lamps) {
      for (const l of this._lamps.values()) this.scene.remove(l.grp);
      this._lamps.clear();
    }
    this.dome?.dispose();
    disposeFurnitureCache();
    for (const set of [this.wood, this.plaster]) {
      if (!set) continue;
      for (const t of Object.values(set)) t?.dispose?.();
    }
    if (this._aoCache) { for (const t of this._aoCache.values()) t.dispose(); this._aoCache.clear(); }
    this.env?.dispose();
    this.renderer?.dispose();
  }
}

export default ThreeScene;
