# BLE Positioning — WebGL-Renderer: Übergabestand

Stand: 5.3.2 · Projekt `ha-ble-positioning` · Karte `ble-positioning-card.js`

Dieses Dokument beschreibt den zweiten Renderer (Three.js) so, dass man
ohne die vorherige Sitzung weiterarbeiten kann. Es ersetzt kein Lesen des
Codes, aber es nennt die Entscheidungen und die Fallen.

---

## 1. Grundsatz: zwei Renderer nebeneinander

Der Canvas-2D-Renderer (`_draw3DSceneInner`) bleibt **unverändert** bestehen
und ist die Rückfallebene. Der WebGL-Renderer ist ein eigenes ES-Modul und
wird nur im Theme `webgl` aktiv.

| | Canvas 2D | WebGL |
|---|---|---|
| Datei | `ble-positioning-card.js` | `frontend/three-scene.js` |
| Aktiv bei | allen anderen Themes | Theme `webgl` |
| Verdeckung | Painter's Sort pro Fläche | Tiefenpuffer pro Pixel |
| Texturen | Canvas-Pattern, nicht perspektivisch | UV-Map, perspektivisch korrekt |

**Warum überhaupt WebGL:** der Painter's Sort hat bei sich gegenseitig
überlappenden Objekten keine richtige Antwort. Für Wände reicht er, für
Möbel nicht. Das ist der eigentliche Grund für den Wechsel, nicht die Optik.

### Rückfall an drei Stellen
1. Kein WebGL-Kontext → `ThreeScene.ok === false`
2. Dynamischer Import schlägt fehl → `_glFailed = true`
3. `webglcontextlost` im WebView → einmalig zurück auf 2D, kein Retry-Loop

In allen Fällen zeichnet der Canvas-Pfad weiter. `_get3DTheme()` bildet
`webgl` auf `studio` ab, damit der Rückfall nicht wie das Standard-Theme
aussieht.

---

## 2. Auslieferung

Three.js r169 (MIT) liegt unter `frontend/vendor/three.module.js`, ~672 KB
minifiziert. **Kein CDN** — eine HA-Instanz läuft häufig ohne Internet.

`_copy_js_files()` in `__init__.py` kopiert nach `/config/www/ble_positioning/`:
- `ble-positioning-card.js`
- `ble-positioning-tracker.js`
- `three-scene.js`
- `modules/*.js`
- `vendor/*.js`

Der Import in der Karte ist ein **absoluter Pfad**:
`await import("/local/ble_positioning/three-scene.js")` — die Karte ist ein
klassisches Script ohne `import.meta`, ein relativer Pfad funktioniert nicht.

> **Falle:** `_copy_js_files` läuft nur bei `async_setup_entry`, also nur beim
> HA-Neustart. Nach dem Entpacken immer HA neu starten und hart neu laden.

---

## 3. Datenformat an `build()`

```js
sc.build({
  rooms:   [{ x1, y1, x2, y2, color }],
  doors:   [{ x, y, width, height, state, open_amount, entity }],
  windows: [{ x, y, width, height, sill, state, entity }],
  floorW, floorH, wallHeight, wallDepth,
  sunAzimuth, sunElevation,       // aus sun.sun
});
```

Achsen: HA-`x` → Three-`x`, HA-`y` → Three-**`z`**, Höhe → Three-`y`.

### Was einen Neuaufbau auslöst
`_glDataKey` deckt **nur Geometrie** ab. Zustände von Türen, Fenstern und
Lampen ändern sich ständig und dürfen die Szene nicht neu bauen. Sonne und
Lampen laufen über eigene, billige Pfade (`setSun`, `updateLights`).

---

## 4. Öffnungen in Wänden

Three.js hat kein CSG. Statt einer Boolean-Bibliothek wird die Wand aus
**Segmenten um die Öffnung herum** zusammengesetzt: Pfeiler links, Brüstung
darunter, Sturz darüber, Pfeiler rechts (`_wallWithOpenings`).

Vorteile: exakt, robust, korrekte Schatten, keine weitere Abhängigkeit.

Zuordnung: eine Öffnung gehört zu einer Wand, wenn sie weniger als 0,45 m
von der Wandlinie entfernt liegt. Gezeichnet werden nur Nord- und Westwand,
damit der Raum zur Kamera hin offen bleibt (Puppenhaus-Ansicht).

Türblätter rotieren um einen Pivot **an der Kante**, nicht um die Mitte.
Der Öffnungswinkel kommt aus dem HA-Status.

---

## 5. Licht — die Physik

Seit Three.js r155 sind physikalische Einheiten Standard. Das ist der Grund,
warum hier nichts „per Hand eingestellt" wird:

- `PointLight.intensity` ist **Candela**
- `decay = 2` → Abfall mit dem Quadrat der Entfernung
- Doppelter Abstand ergibt automatisch ein Viertel der Helligkeit

### Umrechnung aus HA
| HA-Attribut | Weg in die Szene |
|---|---|
| `rgb_color` | direkt, hat Vorrang |
| `color_temp_kelvin` | `kelvinToRGB()`, Näherung nach Tanner Helland |
| keins von beidem | 2700 K Warmweiß |
| `brightness` 0–255 | Anteil × 800 lm, dann `cd = lm / 4π` |

Die 800 lm entsprechen etwa einer klassischen 60-W-Birne. Wer heller will,
ändert diese eine Zahl, nicht die Intensitäten einzeln.

### Grenzen
- **Maximal 8 Lampen gleichzeitig.** WebGL bindet Lichter im Shader; jede
  weitere kostet in jedem Fragment. Sortiert wird nach Helligkeit, die
  hellsten gewinnen.
- Lampen werfen **keine** Schatten (`castShadow = false`). Punktschatten
  brauchen sechs Shadow-Maps pro Lampe. Die Sonne wirft Schatten, das reicht
  für die Raumwirkung.
- Lampen werden **aktualisiert, nicht neu gebaut** — sonst flackert es bei
  jeder Helligkeitsänderung.

---

## 6. Kamera

Orthografisch, nicht perspektivisch. Das Referenzbild ist eine isometrische
Architekturdarstellung, keine Kameraaufnahme. Das Frustum wird in `resize()`
ans Seitenverhältnis angepasst; `zoom` skaliert die halbe Frustumbreite.

Bezugsrahmen ist die **Bounding-Box der Räume**, nicht `floor_w`/`floor_h`.
Ist das Grundstück viel größer als die Bebauung, schrumpft das Gebäude sonst
auf einen Bruchteil der Fläche. (Derselbe Fix existiert seit 5.1.0 auch im
Canvas-Renderer.)

---

## 6a. Glas und Umgebungsmap

Glas sah anfangs blau und milchig aus. Zwei Fehler steckten drin:

1. `color: 0xdceaf6` – eingefärbtes Glas. Echtes Fensterglas ist farblos,
   grünlich wird es nur an der Schnittkante.
2. `transmission` zusammen mit `transparent: true` und `opacity`.
   Das schließt sich aus: `transmission` bringt seine eigene Durchsicht mit,
   ein zusätzliches `opacity` macht das Ergebnis milchig.

Wichtiger noch: **ohne Umgebungsmap hat Glas nichts zu spiegeln.**
`studioEnvironment()` erzeugt prozedural ein Studio (heller Himmel, warmer
Boden, ein Lichtfeld als Fenster), schickt es durch den `PMREMGenerator`
und setzt es als `scene.environment`. Das hebt jedes Material, nicht nur
Glas – Metall sieht sonst aus wie grauer Kunststoff.

**Qualitätsstufe:** `transmission` kostet pro Bild ein zusätzliches
Render-Target. Bei `hardwareConcurrency <= 4` schaltet `lowQuality`
automatisch auf schlichtes Transparenzglas.

**Presets und eigenes Bild.** `ENV_PRESETS` kennt `studio`, `warm`,
`neutral`, `outdoor`; dazu `off` für matt. Option `env_preset` im
Design-Reiter. Über `env_url` lässt sich ein eigenes equirectangulares
Bild (2:1) laden — es wird asynchron nachgeladen, das Preset steht
sofort und bleibt stehen, falls das Bild nicht lädt. Der PMREM-Durchlauf
läuft nur bei Änderung (`_glEnvKey`), nicht pro Bild.

## 6b. Möbel (`three-furniture.js`)

Alles parametrisch aus Grundkörpern – keine geladenen Modelle, also keine
Lizenzfragen, keine Megabytes, einheitlicher Stil.

Konvention: Ursprung mittig auf dem Boden (y = 0), Objekt schaut nach +Z,
gedreht wird erst beim Platzieren.

Vorhanden: `bed`, `sofa`/`couch`, `armchair`/`chair`, `wardrobe`/`shelf`,
`tv`, `speaker`, `person`.

**TV und Lautsprecher tragen ihren Entity-Zustand:** ein laufender
Fernseher leuchtet (emissiv, kein echtes Licht – das wäre bei acht Lampen
Verschwendung), ein spielender Lautsprecher zeigt einen Ring, dessen
Intensität am `volume_level` hängt.

`makeFurniture(type, opts)` ist der Einstieg. Unbekannte Typen liefern
`null`, damit unbekannte Deko einfach übersprungen wird.

**Person:** stilisiert, nicht anatomisch. Haltungen `standing`, `sitting`,
`lying`. Die Nasenandeutung ist Absicht – ohne sie sieht man nicht, wohin
jemand schaut, und das ist bei Anwesenheitsdaten die halbe Aussage.
Figuren werden verschoben statt neu gebaut; nur ein Haltungswechsel
erzwingt neue Geometrie.

## 7. Noch nicht in der WebGL-Szene

- Scanner-Marker, mmWave-Rohdaten
- Musik-Bubbles (in 2D auf Canvas gezeichnet)
- Wetter-Kulisse und Himmel
- Teppiche, Pflanzen, Lampenschirme, Regalinhalt
- Bedienung: Drehen und Zoomen laufen noch über die 2D-Handler

## 8. Offene Entscheidungen

**Möbel — parametrisch oder Modelle?** Davon hängt viel ab. Einfache Körper
aus dem Deko-Editor sind leicht, aber begrenzt. GLTF-Modelle sehen besser
aus, brauchen aber einen Katalog, Lizenzklärung und deutlich mehr Speicher.

**Overlays ins DOM.** Mit WebGL könnten Musik-Bubble und Beschriftungen
echtes HTML über der Szene werden, statt auf die Canvas gemalt zu werden.
Damit entfiele die gesamte Treffer-Zonen-Rechnerei samt der
Koordinatenumrechnung zwischen physischen und CSS-Pixeln.

**Bedienung.** Noch offen. Zu klären: ein Finger dreht, zwei Finger zoomen,
und wie sich das mit dem Verschieben der Musik-Bubble verträgt.

---

## 9. Fallen, die schon einmal zugeschlagen haben

1. **Temporal dead zone.** In 5.0.0 griff ein Block auf `isOuterWall` zu,
   bevor dessen `const` deklariert war → `ReferenceError` in jedem Frame.
   Weil `ctx.restore()` dadurch nie erreicht wurde, stapelte sich pro Frame
   eine weitere Skalierung: gemessener Transform-Faktor 1,1 × 10⁸⁸.
   `no-undef` findet das **nicht** — dafür braucht es `no-use-before-define`.

2. **Canvas-Transform absichern.** `_draw3DScene` ist seit 5.0.2 ein Wrapper
   mit `try/catch`, der den Transform auf den Stand vor dem Aufruf
   zurücksetzt. Ein Zeichenfehler darf nie wieder das ganze Bild zerstören.

3. **Koordinatenräume.** 2D rechnet in **physischen** Canvas-Pixeln, 3D in
   **CSS**-Pixeln. `_canvasXY` misst physisch. Treffer-Zonen werden deshalb
   immer physisch abgelegt, gespeicherte Versätze immer in CSS-Pixeln.

4. **Touch hat kein `button`.** `_touchToMouse` baut ein Maus-Objekt ohne
   `button`-Feld. Ein Vergleich `e.button === 0` schlägt in der Companion
   App immer fehl. Richtig: `e.button === 0 || e.button == null`.

5. **`ctx.filter` fehlt in älteren iOS-WebViews.** Für Weichzeichner
   `shadowBlur` nehmen.

6. **Modul-Import scheitert an einer einzigen fehlenden Datei.** In 5.3.0
   wurde `three-furniture.js` nicht ausgeliefert (404). Weil
   `three-scene.js` sie importiert, schlug der ganze Import fehl — und der
   Rückfall auf Canvas sah fast normal aus, also fiel es nicht auf.
   Seither kopiert `_copy_js_files` alle `three-*.js` per glob, und ein
   fehlgeschlagener WebGL-Start zeigt einen Toast.

7. **`preserveDrawingBuffer: true` ist Pflicht.** Ohne das Flag verwirft der
   Browser den Zeichenpuffer nach dem Compositing. Die Szene steht meist
   still und wird nur bei Änderungen neu gezeichnet — das Bild ist danach
   schwarz, obwohl `readPixels` direkt nach `render()` korrekte Farben
   liefert. Genau dieses Symptom (WebGL-Puffer korrekt, Bildschirm schwarz)
   kostete beim ersten Test Zeit. Die Alternative wäre ein dauernder
   RAF-Loop, der auf dem Handy ohne Not Akku verbrennt.

---

## 10. Release-Checkliste

```bash
node --check ble-positioning-card.js
node --check three-scene.js          # vorher nach .mjs kopieren
python3 -m py_compile __init__.py coordinator.py

npx eslint --no-eslintrc --env browser,es2022 \
  --parser-options ecmaVersion:2022,sourceType:script \
  --rule '{"no-undef":"error","no-use-before-define":["error",{"variables":true,"functions":false,"classes":false}]}' \
  ble-positioning-card.js modules/*.js
```

Bekannte, unkritische Befunde: `AmbientLightSensor` (Feature-Detection),
`BLEModuleBase`/`BLEModuleRegistry` (dateiübergreifende Globals),
`roomSelRow`/`edCanvas` (Nutzung in später laufenden Callbacks).

Version in **zwei** Dateien hochziehen: `CARD_VERSION` in der Karte und
`version` in `manifest.json`.

Niemals das Live-System direkt anfassen — Auslieferung nur als ZIP.
