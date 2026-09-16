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

/* Basisradius der Kuppel. Sie wird zur Laufzeit auf die Szene skaliert:
   ist sie nur wenig groesser als das Gebaeude, sieht man sie beim
   Rauszoomen als Kugel – wie eine Schneekugel –, und beim Hineinzoomen
   steht man darin. Ein fester Radius von 1000 waere immer nur Innenraum. */
const RADIUS = 1;

/* Sterne als eigene Punktwolke. Nur nachts sichtbar, Helligkeit wird
   über die Dämmerung eingeblendet. */
function makeStars(count) {
  const pos = new Float32Array(count * 3);
  const size = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    // Gleichverteilt auf der oberen Halbkugel, ein Drittel jedoch
    // entlang eines Bandes – das liest sich als Milchstrasse.
    const band = i % 3 === 0;
    const u = Math.random();
    let v = Math.random() * 0.5;
    if (band) v = 0.12 + Math.abs((Math.random() + Math.random()) / 2 - 0.5) * 0.4;
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
    // Sterne stehen jenseits jeder Nebelreichweite – ohne fog:false
    // ueberzieht der Szenennebel den Himmel mit einem grauen Schleier.
    fog: false,
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
    fog: false,          // der Himmel selbst wird nie vernebelt
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

/* Niederschlag als Partikelwolke ueber der Szene.
   Die Bewegung laeuft im Vertex-Shader: die CPU muesste sonst jedes Bild
   tausende Positionen neu schreiben, das ist auf dem Handy spuerbar.
   Jeder Tropfen bekommt eine eigene Phase, faellt und beginnt oben neu. */
function makePrecipitation(kind, count, extent, height) {
  const n = count;
  const pos = new Float32Array(n * 3);
  const rnd = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    pos[i*3]   = (Math.random() - 0.5) * extent;
    pos[i*3+1] = Math.random() * height;
    pos[i*3+2] = (Math.random() - 0.5) * extent;
    rnd[i] = Math.random();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("aRnd", new THREE.BufferAttribute(rnd, 1));

  const snow = kind === "snow";
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime:   { value: 0 },
      uSpeed:  { value: snow ? 1.1 : 9.0 },
      uHeight: { value: height },
      uOpacity:{ value: 0 },
      uSize:   { value: (snow ? 7.0 : 6.0) * Math.min(window.devicePixelRatio || 1, 2) },
      uSnow:   { value: snow ? 1 : 0 },
    },
    vertexShader: `
      attribute float aRnd;
      uniform float uTime, uSpeed, uHeight, uSize, uSnow;
      varying float vR;
      void main() {
        vR = aRnd;
        vec3 p = position;
        // Fallen mit Umbruch: mod haelt die Tropfen im Band
        float fall = uTime * uSpeed * (0.7 + aRnd * 0.6);
        p.y = mod(p.y - fall, uHeight);
        if (uSnow > 0.5) {
          // Schnee pendelt seitlich, Regen faellt gerade
          p.x += sin(uTime * 0.6 + aRnd * 30.0) * 1.6;
          p.z += cos(uTime * 0.5 + aRnd * 25.0) * 1.4;
        }
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = uSize * (0.6 + aRnd * 0.8);
      }`,
    fragmentShader: `
      uniform float uOpacity, uSnow;
      varying float vR;
      void main() {
        vec2 d = gl_PointCoord - vec2(0.5);
        float a;
        if (uSnow > 0.5) {
          a = smoothstep(0.5, 0.05, length(d));          // runde Flocke
        } else {
          // Tropfen: schmaler, heller Strich. Ein runder Punkt sieht aus
          // wie ein Stern und geht im Bild unter.
          a = smoothstep(0.5, 0.0, length(vec2(d.x * 5.0, d.y * 0.85)));
          a *= smoothstep(0.5, 0.2, abs(d.y));   // oben und unten auslaufen
        }
        vec3 col = uSnow > 0.5 ? vec3(1.0) : vec3(0.82, 0.90, 1.0);
        gl_FragColor = vec4(col, a * uOpacity);
      }`,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  return pts;
}

/* Wolken als Billboards. Weiche Scheiben, die langsam ziehen – in der
   isometrischen Ansicht genuegt das voellig und kostet fast nichts. */
function cloudTexture() {
  const S = 128, c = document.createElement("canvas");
  c.width = c.height = S;
  const x = c.getContext("2d");
  for (let i = 0; i < 7; i++) {
    const r = S * (0.14 + Math.random() * 0.16);
    const cx = S * (0.25 + Math.random() * 0.5);
    const cy = S * (0.4 + Math.random() * 0.25);
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, "rgba(255,255,255,0.95)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = g;
    x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
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
    this._rain = null;
    this._snow = null;
    this._clouds = null;
  }

  /**
   * Wolken und Niederschlag nach Wetterlage.
   * @param {string} condition  HA-Wetterzustand
   * @param {number} span       Ausdehnung der Szene in Metern
   */
  setSceneWeather(condition, span) {
    const c = String(condition || "");
    const extent = Math.max(24, span * 3);
    const height = Math.max(14, span * 1.4);

    // ── Niederschlag ──────────────────────────────────────────────────
    const snow = /snow|sleet|hail/.test(c);
    const rain = /rain|pouring|lightning|storm/.test(c);
    const heavy = /pouring|lightning|storm/.test(c);

    // Zwei getrennte Systeme statt eines umgebauten: Regen und Schnee
    // haben eigene Geschwindigkeit, Form und Dichte. Beim Umschalten
    // wird nur die Deckkraft gefahren, nichts neu aufgebaut – dadurch
    // gibt es keinen Ruckler beim Wetterwechsel.
    if (this._precipExtent !== extent) {
      this._precipExtent = extent;
      for (const k of ["_rain", "_snow"]) {
        if (this[k]) { this.scene.remove(this[k]);
          this[k].geometry.dispose(); this[k].material.dispose(); this[k] = null; }
      }
    }
    if (!this._rain) {
      this._rain = makePrecipitation("rain", 2200, extent, height);
      this.scene.add(this._rain);
    }
    if (!this._snow) {
      this._snow = makePrecipitation("snow", 1100, extent, height);
      this.scene.add(this._snow);
    }
    this._rain.visible = rain;
    this._snow.visible = snow;
    this._rain.material.uniforms.uOpacity.value = heavy ? 0.95 : 0.78;
    this._snow.material.uniforms.uOpacity.value = heavy ? 0.9 : 0.72;

    // ── Wolken ────────────────────────────────────────────────────────
    const cloudy = /cloud|rain|snow|sleet|hail|pouring|lightning|storm|fog/.test(c);
    const many = /cloudy|rain|pouring|storm|snow|fog/.test(c);
    const want = cloudy ? (many ? 7 : 4) : 0;
    if (this._cloudCount !== want || this._cloudExtent !== extent) {
      if (this._clouds) { this.scene.remove(this._clouds); }
      this._cloudCount = want; this._cloudExtent = extent;
      this._clouds = null;
      if (want > 0) {
        if (!this._cloudTex) this._cloudTex = cloudTexture();
        const g = new THREE.Group();
        for (let i = 0; i < want; i++) {
          const sp = new THREE.Sprite(new THREE.SpriteMaterial({
            map: this._cloudTex, transparent: true, depthWrite: false, fog: false,
            opacity: 0.55 + Math.random() * 0.25,
          }));
          const sc = extent * (0.22 + Math.random() * 0.2);
          sp.scale.set(sc, sc * 0.55, 1);
          sp.position.set(
            (Math.random() - 0.5) * extent,
            height * (0.72 + Math.random() * 0.3),
            (Math.random() - 0.5) * extent
          );
          sp.userData.drift = 0.25 + Math.random() * 0.5;
          g.add(sp);
        }
        g.frustumCulled = false;
        this._clouds = g;
        this.scene.add(g);
      }
    }
    if (this._clouds) {
      // Bei Nebel und Sturm dichter und dunkler
      const dim = /fog/.test(c) ? 0.85 : /pouring|storm|lightning/.test(c) ? 0.62 : 1;
      for (const sp of this._clouds.children) sp.material.color.setScalar(dim);
    }
  }

  /**
   * Gelaende rings um das Gebaeude. Ohne Boden schwebt das Haus im
   * Nichts – der Horizont ist es, der dem Bild Tiefe gibt.
   * Die Flaeche laeuft ueber eine Alpha-Maske zum Rand hin aus, statt
   * an einer harten Kante zu enden.
   */
  setGround(span, night) {
    const sp = Math.max(8, span || 12);
    const size = sp * 16;
    if (!this._ground) {
      const S = 256, c = document.createElement("canvas");
      c.width = c.height = S;
      const x = c.getContext("2d");
      x.fillStyle = "#6f7d5c";
      x.fillRect(0, 0, S, S);
      // Unruhe, damit es nicht wie ein Filzteppich wirkt
      for (let i = 0; i < 2600; i++) {
        const r = 1 + Math.random() * 6;
        x.fillStyle = `rgba(${90 + Math.random()*60|0},${105 + Math.random()*55|0},${60 + Math.random()*45|0},0.5)`;
        x.beginPath();
        x.arc(Math.random() * S, Math.random() * S, r, 0, Math.PI * 2);
        x.fill();
      }
      const tex = new THREE.CanvasTexture(c);
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.repeat.set(24, 24);
      this._groundTex = tex;

      // Auslaufmaske: in der Mitte deckend, zum Rand durchsichtig
      const A = 256, ac = document.createElement("canvas");
      ac.width = ac.height = A;
      const ax = ac.getContext("2d");
      const g = ax.createRadialGradient(A/2, A/2, A*0.12, A/2, A/2, A*0.5);
      g.addColorStop(0, "rgba(255,255,255,1)");
      g.addColorStop(0.55, "rgba(255,255,255,0.92)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      ax.fillStyle = g; ax.fillRect(0, 0, A, A);
      this._groundAlpha = new THREE.CanvasTexture(ac);

      // Runde Scheibe: passt zur Kuppel und laeuft ohne Ecken aus
      const geo = new THREE.CircleGeometry(0.5, 64);
      const mat = new THREE.MeshStandardMaterial({
        map: tex, alphaMap: this._groundAlpha, transparent: true,
        roughness: 0.96, metalness: 0, depthWrite: false,
      });
      this._ground = new THREE.Mesh(geo, mat);
      this._ground.rotation.x = -Math.PI / 2;
      this._ground.receiveShadow = true;
      this._ground.renderOrder = -1;
      this.scene.add(this._ground);
    }
    // Etwas kleiner als die Kuppel, damit sie nicht durchstoesst
    const gsize = Math.min(size, (this._radius || size) * 1.92);
    this._ground.scale.set(gsize, gsize, 1);
    if (this._center) this._ground.position.set(this._center.x, -0.14, this._center.z);
    // Nachts abdunkeln, sonst leuchtet die Wiese heller als das Haus
    this._ground.material.color.setScalar(night ? 0.22 : 1);
  }

  /** Muss pro Bild laufen, damit Regen faellt und Wolken ziehen. */
  animate(t) {
    if (this._rain?.visible) this._rain.material.uniforms.uTime.value = t;
    if (this._snow?.visible) this._snow.material.uniforms.uTime.value = t;
    if (this._clouds) {
      const ex = this._cloudExtent || 60;
      for (const sp of this._clouds.children) {
        sp.position.x += sp.userData.drift * 0.02;
        if (sp.position.x > ex / 2) sp.position.x = -ex / 2;
      }
    }
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
      mat.fog = false;
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
  setBody(phase, isNight, span) {
    // Massstab der Szene, nicht der Kuppel: bei orthografischer Projektion
    // ist das Sichtfenster nur wenige Dutzend Einheiten breit. Auf Radius
    // 800 stand das Gestirn weit ausserhalb und war nie zu sehen.
    const sp = Math.max(6, span || 12);
    const want = isNight ? "moon" : "sun";
    if (this._bodyKind !== want || this._bodyPhase !== phase) {
      this._bodyKind = want; this._bodyPhase = phase;
      if (this._body) { this.scene.remove(this._body);
        this._body.material.map?.dispose(); this._body.material.dispose(); }
      this._body = new THREE.Sprite(new THREE.SpriteMaterial({
        map: new THREE.CanvasTexture(this._bodyCanvas(phase, isNight)),
        transparent: true, depthWrite: false, depthTest: false, fog: false,
        // Additiv: das Gestirn leuchtet, statt den Himmel auszustanzen
        blending: isNight ? THREE.NormalBlending : THREE.AdditiveBlending,
      }));
      this._body.renderOrder = -1;
      this.scene.add(this._body);
    }
    this._body.scale.setScalar(sp * (isNight ? 0.34 : 0.42));
    // An den Sonnenstand hängen; nachts gegenüber, wie der echte Mond
    const d = this._sunDir.clone();
    if (isNight) { d.x = -d.x; d.z = -d.z; d.y = Math.abs(d.y) * 0.8 + 0.3; }
    d.normalize();
    // Innerhalb des Sichtfensters, aber hinter allem: depthTest ist aus,
    // das Gestirn wird also nie von einer Wand verdeckt.
    // Knapp innerhalb der Kuppel, damit es beim Rauszoomen mit ihr
    // zusammen im Bild bleibt
    const rr = (this._radius || sp * 1.75) * 0.8;
    this._body.position.copy(this._center || new THREE.Vector3())
      .addScaledVector(d, rr);
  }

  /** Bezugspunkt der Szene, damit das Gestirn im Bild bleibt. */
  setCenter(v) { this._center = v.clone(); }

  /**
   * Kuppel auf die Szene skalieren. Der Faktor entscheidet, ab wann man
   * sie von aussen sieht: knapp ueber der Gebaeudegroesse wirkt sie wie
   * eine Kugel auf dem Tisch, sehr gross wie echter Himmel.
   */
  setScale(span) {
    const r = Math.max(9, (span || 12) * 1.75);
    if (this._radius === r) return;
    this._radius = r;
    for (const m of [this.gradient, this.skyMesh, this.stars]) {
      if (m) m.scale.setScalar(r);
    }
    if (this._center) {
      for (const m of [this.gradient, this.skyMesh, this.stars]) {
        if (m) m.position.set(this._center.x, 0, this._center.z);
      }
    }
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
    if (this._clouds) this.scene.remove(this._clouds);
    if (this._ground) { this.scene.remove(this._ground);
      this._groundTex?.dispose(); this._groundAlpha?.dispose(); }
    this._cloudTex?.dispose();
    for (const m of [this.gradient, this.skyMesh, this.stars, this._body,
                    this._rain, this._snow]) {
      if (!m) continue;
      this.scene.remove(m);
      m.geometry?.dispose();
      m.material?.dispose();
    }
  }
}

export default SkyDome;
