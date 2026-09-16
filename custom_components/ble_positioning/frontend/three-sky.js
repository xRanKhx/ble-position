/**
 * BLE Positioning – Himmelskuppel
 *
 * Zwei Varianten hinter einer gemeinsamen Schnittstelle:
 *
 *   "sky"      Preetham-Modell aus Sky.js. Physikalisch motivierte
 *              Streuung, reagiert auf Sonnenstand und Trübung. Der
 *              Sonnenuntergang entsteht dabei von selbst, statt
 *              Farben von Hand zu setzen.
 *   "gradient" Schlichter Verlauf von Horizont zu Zenit über ein
 *              eigenes ShaderMaterial. Günstiger und ruhiger.
 *
 * Beide liegen auf einer SphereGeometry mit BackSide, damit die
 * Innenseite gerendert wird. Sky.js bringt von Haus aus eine Box mit;
 * hier wird nur sein Material übernommen und auf die Kugel gelegt.
 *
 * Nachts trägt das Preetham-Modell nichts mehr bei – es kennt keine
 * Sterne. Deshalb blendet die Kuppel dann auf einen dunklen Verlauf
 * mit Sternenfeld um.
 */

import * as THREE from "./vendor/three.module.js";

const RADIUS = 1000;

/* Sterne als eigene Punktwolke. Nur nachts sichtbar, Helligkeit wird
   über die Dämmerung eingeblendet. */
function makeStars(count) {
  const pos = new Float32Array(count * 3);
  const size = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    // Gleichverteilt auf der oberen Halbkugel
    const u = Math.random(), v = Math.random() * 0.5;
    const th = 2 * Math.PI * u, ph = Math.acos(1 - 2 * v);
    const r = RADIUS * 0.92;
    pos[i*3]   = r * Math.sin(ph) * Math.cos(th);
    pos[i*3+1] = r * Math.cos(ph);
    pos[i*3+2] = r * Math.sin(ph) * Math.sin(th);
    size[i] = 1 + Math.pow(Math.random(), 3) * 4;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uOpacity: { value: 0 },
      uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) },
    },
    transparent: true,
    depthWrite: false,
    vertexShader: `
      attribute float aSize;
      uniform float uPixelRatio;
      varying float vS;
      void main() {
        vS = aSize;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        // Punktgroesse an die Pixeldichte koppeln, sonst verschwinden
        // die Sterne auf hochaufloesenden Displays unter einem Pixel.
        gl_PointSize = aSize * uPixelRatio;
      }`,
    fragmentShader: `
      uniform float uOpacity;
      varying float vS;
      void main() {
        // Runder, weich auslaufender Punkt statt Quadrat
        vec2 d = gl_PointCoord - vec2(0.5);
        float a = smoothstep(0.5, 0.1, length(d));
        gl_FragColor = vec4(vec3(1.0, 0.98, 0.92), a * uOpacity);
      }`,
  });
  return new THREE.Points(geo, mat);
}

/* Verlaufskuppel: Horizont- und Zenitfarbe als Uniforms. */
function gradientMaterial() {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uColorTop:    { value: new THREE.Color(0x4f86c6) },
      uColorBottom: { value: new THREE.Color(0xdfe8f2) },
      uExponent:    { value: 0.75 },
    },
    vertexShader: `
      varying vec3 vPos;
      void main() {
        vPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform vec3 uColorTop;
      uniform vec3 uColorBottom;
      uniform float uExponent;
      varying vec3 vPos;
      void main() {
        // Höhe auf 0..1, Exponent steuert, wie hoch der Horizontsaum reicht
        float h = normalize(vPos).y * 0.5 + 0.5;
        float t = pow(clamp(h, 0.0, 1.0), uExponent);
        gl_FragColor = vec4(mix(uColorBottom, uColorTop, t), 1.0);
      }`,
  });
}

export class SkyDome {
  /**
   * @param {THREE.Scene} scene
   * @param {{mode?: "sky"|"gradient", stars?: number}} opts
   */
  constructor(scene, opts = {}) {
    this.scene = scene;
    this.mode = opts.mode === "gradient" ? "gradient" : "sky";
    this._sunDir = new THREE.Vector3(0, 1, 0);

    const geo = new THREE.SphereGeometry(RADIUS, 48, 24);

    this.gradientMat = gradientMaterial();
    this.gradient = new THREE.Mesh(geo, this.gradientMat);
    this.gradient.frustumCulled = false;
    this.gradient.renderOrder = -2;
    scene.add(this.gradient);

    this.stars = makeStars(opts.stars ?? 900);
    this.stars.frustumCulled = false;
    this.stars.renderOrder = -1;
    scene.add(this.stars);

    this.sky = null;
    this.skyMesh = null;
  }

  /** Sky.js nachladen. Schlägt es fehl, bleibt die Verlaufskuppel stehen. */
  async initShader() {
    if (this.mode !== "sky" || this.skyMesh) return this.mode;
    try {
      const mod = await import("./vendor/Sky.js");
      const sky = new mod.Sky();
      this.sky = sky;
      // Nur das Material übernehmen: Sky.js liefert eine Box, gefordert
      // ist eine Kuppel mit BackSide.
      const mat = sky.material;
      mat.side = THREE.BackSide;
      mat.depthWrite = false;
      this.skyMesh = new THREE.Mesh(new THREE.SphereGeometry(RADIUS, 48, 24), mat);
      this.skyMesh.frustumCulled = false;
      this.skyMesh.renderOrder = -2;
      this.scene.add(this.skyMesh);
      this.gradient.visible = false;
      this.setAtmosphere({});
      return "sky";
    } catch (e) {
      console.warn("BLE Positioning: Sky-Shader nicht ladbar, nutze Verlaufskuppel", e);
      this.mode = "gradient";
      return "gradient";
    }
  }

  /**
   * Atmosphäre einstellen.
   * @param {{turbidity?:number, rayleigh?:number, mieCoefficient?:number,
   *          mieDirectionalG?:number}} o
   */
  setAtmosphere(o = {}) {
    if (!this.sky) return;
    const u = this.sky.material.uniforms;
    if (o.turbidity        != null) u.turbidity.value        = o.turbidity;
    if (o.rayleigh         != null) u.rayleigh.value         = o.rayleigh;
    if (o.mieCoefficient   != null) u.mieCoefficient.value   = o.mieCoefficient;
    if (o.mieDirectionalG  != null) u.mieDirectionalG.value  = o.mieDirectionalG;
  }

  /**
   * Sonnenstand setzen. Winkel in Grad, wie sie HA über sun.sun liefert.
   * Negative Elevation heißt: Sonne unter dem Horizont.
   */
  updateSunPosition(elevation, azimuth) {
    const el = (elevation ?? 45);
    const az = (azimuth ?? 180);
    // HA zählt Azimut von Nord über Ost. Three: +Z ist Süd in unserer
    // Szene, deshalb dieselbe Umrechnung wie beim Richtungslicht.
    const phi   = THREE.MathUtils.degToRad(90 - el);
    const theta = THREE.MathUtils.degToRad(az);
    this._sunDir.setFromSphericalCoords(1, phi, theta);
    if (this.sky) this.sky.material.uniforms.sunPosition.value.copy(this._sunDir);

    // Dämmerung: zwischen -8° und +6° wird auf Nacht geblendet
    const night = THREE.MathUtils.clamp((6 - el) / 14, 0, 1);
    this._night = night;
    this.stars.material.uniforms.uOpacity.value = Math.pow(night, 2.2);

    if (this.skyMesh) {
      // Preetham kennt keine Nacht. Unter dem Horizont wird deshalb auf
      // die Verlaufskuppel überblendet, sonst bliebe ein fahler Rest.
      const useGrad = night > 0.55;
      this.skyMesh.visible = !useGrad;
      this.gradient.visible = useGrad;
    }
    if (this.gradient.visible || !this.skyMesh) this._applyNightColors(night);
    return this._sunDir;
  }

  _applyNightColors(night) {
    const u = this.gradientMat.uniforms;
    // Tagfarben als Ausgangspunkt, nachts tief abgedunkelt
    const topDay = new THREE.Color(0x4f86c6), botDay = new THREE.Color(0xdfe8f2);
    const topNight = new THREE.Color(0x070b16), botNight = new THREE.Color(0x1b2338);
    u.uColorTop.value.copy(topDay).lerp(topNight, night);
    u.uColorBottom.value.copy(botDay).lerp(botNight, night);
  }

  /**
   * Gestirn als Scheibe am Himmel. Nachts der Mond mit echter Phase,
   * tagsüber die Sonne. Liegt in der Kuppel, nicht auf einem Canvas
   * davor – sonst verdeckt die opake Kuppel es wieder.
   * @param {number} phase 0..1, 0 = Neumond, 0.5 = Vollmond
   */
  setBody(phase, isNight) {
    const want = isNight ? "moon" : "sun";
    if (this._bodyKind !== want || this._bodyPhase !== phase) {
      this._bodyKind = want; this._bodyPhase = phase;
      if (this._body) { this.scene.remove(this._body);
        this._body.material.map?.dispose(); this._body.material.dispose(); }
      this._body = new THREE.Sprite(new THREE.SpriteMaterial({
        map: new THREE.CanvasTexture(this._bodyCanvas(phase, isNight)),
        transparent: true, depthWrite: false, depthTest: false,
        // Additiv: das Gestirn leuchtet, statt den Himmel auszustanzen
        blending: isNight ? THREE.NormalBlending : THREE.AdditiveBlending,
      }));
      this._body.renderOrder = -1;
      this._body.scale.setScalar(RADIUS * (isNight ? 0.13 : 0.17));
      this.scene.add(this._body);
    }
    // An den Sonnenstand hängen; nachts gegenüber, wie der echte Mond
    const d = this._sunDir.clone();
    if (isNight) { d.x = -d.x; d.z = -d.z; d.y = Math.abs(d.y) * 0.8 + 0.25; }
    this._body.position.copy(d.normalize().multiplyScalar(RADIUS * 0.8));
  }

  _bodyCanvas(phase, isNight) {
    const S = 256, c = document.createElement("canvas");
    c.width = c.height = S;
    const x = c.getContext("2d");
    const r = S * 0.3, cx = S / 2, cy = S / 2;
    // Schein ringsum
    const g = x.createRadialGradient(cx, cy, r * 0.7, cx, cy, S * 0.5);
    g.addColorStop(0, isNight ? "rgba(200,215,255,0.5)" : "rgba(255,240,190,0.85)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = g; x.fillRect(0, 0, S, S);

    x.fillStyle = isNight ? "#eef2ff" : "#fff6d8";
    x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fill();

    if (isNight) {
      // Terminator wie im 2D-Renderer: Halbkreis plus Ellipsenbogen
      const term = Math.cos(2 * Math.PI * phase);
      const waxing = phase < 0.5;
      if (term > 0.995) {
        x.globalCompositeOperation = "destination-out";
        x.beginPath(); x.arc(cx, cy, r * 0.97, 0, Math.PI * 2); x.fill();
      } else if (term < -0.995) {
        // Vollmond: nichts ausstanzen
      } else {
        x.save();
        x.translate(cx, cy);
        if (!waxing) x.scale(-1, 1);
        x.globalCompositeOperation = "destination-out";
        x.beginPath();
        x.arc(0, 0, r, -Math.PI / 2, Math.PI / 2, true);
        x.ellipse(0, 0, r * Math.abs(term), r, 0, Math.PI / 2, -Math.PI / 2, term > 0);
        x.closePath(); x.fill();
        x.restore();
      }
    }
    return c;
  }

  /** Horizont- und Zenitfarbe direkt setzen (Verlaufsmodus). */
  setColors(bottom, top) {
    if (bottom != null) this.gradientMat.uniforms.uColorBottom.value.set(bottom);
    if (top != null) this.gradientMat.uniforms.uColorTop.value.set(top);
  }

  /** Trübung aus dem Wetterzustand ableiten. */
  setWeather(condition) {
    const c = String(condition || "");
    const turbidity =
      /sunny|clear/.test(c)             ? 2.2 :
      /partlycloudy/.test(c)            ? 5.0 :
      /cloudy/.test(c)                  ? 10.0 :
      /fog/.test(c)                     ? 16.0 :
      /rain|snow|sleet|hail/.test(c)    ? 14.0 :
      /pouring|lightning|storm/.test(c) ? 20.0 : 4.0;
    // Rayleigh bestimmt, wie blau der Himmel bleibt; bei Trübung sinkt es
    const rayleigh = Math.max(0.4, 3.0 - turbidity * 0.11);
    this.setAtmosphere({ turbidity, rayleigh, mieCoefficient: 0.005, mieDirectionalG: 0.8 });
  }

  dispose() {
    for (const m of [this.gradient, this.skyMesh, this.stars, this._body]) {
      if (!m) continue;
      this.scene.remove(m);
      m.geometry?.dispose();
      m.material?.dispose();
    }
  }
}

export default SkyDome;
