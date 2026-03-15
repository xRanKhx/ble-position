/**
 * BLE Indoor Positioning Card
 * Lovelace Custom Card – Phase 2
 *
 * Modes:
 *   view       – live tracking on floorplan
 *   calibrate  – click grid point → stand there → capture
 *   scanners   – place / edit scanners on floorplan
 *   rooms      – draw / edit rooms on floorplan
 */

const CARD_VERSION = "2.11.34";
const DOMAIN       = "ble_positioning";

// ── Colour palette for scanners ───────────────────────────────────────────
const SCANNER_COLORS = [
  "#f97316","#00e5ff","#a78bfa","#ffd600",
  "#00ff88","#ff3b5c","#e879f9","#38bdf8",
];

// ── CSS ───────────────────────────────────────────────────────────────────
const CARD_CSS = `
:host {
  --bg:      #07090d;
  --surf:    #0d1219;
  --surf2:   #111820;
  --border:  #1c2535;
  --accent:  #00e5ff;
  --green:   #00ff88;
  --yellow:  #ffd600;
  --red:     #ff3b5c;
  --purple:  #a78bfa;
  --text:    #c8d8ec;
  --muted:   #445566;
  font-family: 'JetBrains Mono', 'Courier New', monospace;
}
* { box-sizing: border-box; margin: 0; padding: 0; }

.card {
  background: var(--bg);
  border-radius: 12px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 500px;
  border: 1px solid var(--border);
}

/* ── Header ── */
.card-header {
  background: var(--surf);
  border-bottom: 1px solid var(--border);
  padding: 8px 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
  gap: 8px;
}
.card-title {
  font-size: 12px;
  font-weight: 700;
  color: var(--accent);
  letter-spacing: .08em;
  white-space: nowrap;
}
.tabs-scroll-wrap {
  display: flex;
  align-items: center;
  gap: 3px;
  flex: 1;
  min-width: 0;
  position: relative;
}
.tabs-arrow {
  flex-shrink: 0;
  width: 20px; height: 20px;
  border-radius: 4px;
  border: 1px solid var(--border);
  background: var(--surf2);
  color: var(--text);
  font-size: 11px;
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  user-select: none;
  -webkit-user-select: none;
  transition: background 0.15s;
}
.tabs-arrow:active { background: var(--surf3); }
.mode-tabs {
  display: flex;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 6px;
  overflow-x: auto;
  overflow-y: hidden;
  flex: 1;
  min-width: 0;
  scroll-behavior: smooth;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}
.mode-tabs::-webkit-scrollbar { display: none; }
.mode-tab {
  padding: 3px 9px;
  font-size: 9px;
  font-weight: 700;
  cursor: pointer;
  border: none;
  background: transparent;
  flex-shrink: 0;
  white-space: nowrap;
  color: var(--muted);
  letter-spacing: .05em;
  transition: all .15s;
  font-family: inherit;
}
.mode-tab.active            { background: var(--accent);  color: var(--bg); }
.mode-tab.active.cal        { background: var(--green);   color: var(--bg); }
.mode-tab.active.scanners   { background: var(--yellow);  color: var(--bg); }
.mode-tab.active.rooms      { background: var(--purple);  color: var(--bg); }
.mode-tab.active.lights     { background: var(--yellow);  color: var(--bg); }
.mode-tab.active.alarm      { background: var(--red);     color: #fff; }
.mode-tab.active.energie    { background: #f59e0b;        color: #07090d; }
.mode-tab.active.settings   { background: #94a3b8;        color: #07090d; }
.mode-tab.active.automate   { background: #a855f7;        color: #fff; }
.mode-tab.active.journey    { background: #38bdf8;        color: #07090d; }
.mode-tab.active.info       { background: #00bcd4;        color: #07090d; }
.mode-tab.active.deko       { background: #10b981;        color: #07090d; }
.floor-btn { background:var(--surf3);border:1px solid var(--border);color:var(--muted);border-radius:4px;padding:2px 8px;font-size:8px;cursor:pointer;font-family:inherit;font-weight:700;white-space:nowrap;flex-shrink:0; }
.floor-btn.active { background:var(--accent);color:var(--bg);border-color:var(--accent); }
:host(.night-mode) .card-wrap { filter: brightness(0.72) saturate(0.85); }
@keyframes alarm-pulse {
  0%,100% { opacity: 1; }
  50%      { opacity: 0.35; }
}
.conn-dot {
  width: 7px; height: 7px;
  border-radius: 50%;
  background: var(--red);
  flex-shrink: 0;
  transition: background .3s;
}
.conn-dot.ok { background: var(--green); box-shadow: 0 0 6px var(--green); }

/* ── Body ── */
.card-body {
  display: flex;
  flex: 1;
  overflow: hidden;
  min-height: 0;
}

/* ── Sidebar ── */
.sidebar {
  width: var(--sidebar-width, 260px);
  min-width: 200px;
  max-width: 420px;
  background: var(--surf);
  border-right: 1px solid var(--border);
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  overflow-y: auto;
  overflow-x: hidden;
  flex-shrink: 0;
  scrollbar-width: thin;
  scrollbar-color: var(--border) transparent;
}
.sidebar::-webkit-scrollbar { width: 4px; }
.sidebar::-webkit-scrollbar-track { background: transparent; }
.sidebar::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }
.sb-box {
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 7px 8px;
  background: var(--bg);
}
.sb-title {
  font-size: 7px;
  font-weight: 700;
  letter-spacing: .18em;
  color: var(--muted);
  text-transform: uppercase;
  margin-bottom: 5px;
  padding-bottom: 3px;
  border-bottom: 1px solid var(--border);
}
.sb-row {
  display: flex;
  justify-content: space-between;
  font-size: 9px;
  color: var(--muted);
  margin-bottom: 2px;
  align-items: center;
}
.sb-val   { color: var(--text); font-weight: 600; }
.sb-green { color: var(--green); font-weight: 700; }
.bar {
  height: 2px; background: var(--border);
  border-radius: 2px; margin: 1px 0 4px; overflow: hidden;
}
.bar-fill { height: 100%; border-radius: 2px; transition: width .4s; }
.room-box {
  margin-top: 4px; padding: 5px 7px;
  background: rgba(0,229,255,.07);
  border: 1px solid rgba(0,229,255,.2);
  border-radius: 5px; text-align: center;
}
.room-lbl  { font-size: 7px; color: var(--muted); margin-bottom: 1px; }
.room-name { font-size: 13px; font-weight: 700; color: var(--accent); }

/* ── Buttons ── */
.btn {
  width: 100%; padding: 5px; border: none; border-radius: 5px;
  font-family: inherit; font-size: 9px; font-weight: 700;
  cursor: pointer; letter-spacing: .04em; transition: all .15s; margin-top: 3px;
}
.btn-green  { background: var(--green); color: var(--bg); }
.btn-green:hover  { filter: brightness(1.1); transform: translateY(-1px); }
.btn-green:disabled { background: var(--muted); cursor: not-allowed; transform: none; }
.btn-outline { background: transparent; border: 1px solid var(--accent); color: var(--accent); }
.btn-outline:hover { background: rgba(0,229,255,.1); }
.btn-red  { background: transparent; border: 1px solid var(--red); color: var(--red); }
.btn-red:hover { background: rgba(255,59,92,.1); }
.btn-yellow { background: var(--yellow); color: var(--bg); }
.btn-purple { background: var(--purple); color: var(--bg); }
.cal-status { font-size: 8px; color: var(--yellow); margin-top: 3px; min-height: 12px; text-align: center; }

/* ── Scanner editor ── */
.scanner-form { display: flex; flex-direction: column; gap: 4px; margin-top: 4px; }
.scanner-form input, .scanner-form select {
  background: var(--surf2); border: 1px solid var(--border);
  color: var(--text); padding: 3px 6px; border-radius: 4px;
  font-family: inherit; font-size: 9px; width: 100%;
}
.scanner-form input:focus, .scanner-form select:focus {
  outline: none; border-color: var(--accent);
}
.scanner-form label { font-size: 8px; color: var(--muted); }
.color-row { display: flex; align-items: center; gap: 6px; }
.color-swatch {
  width: 18px; height: 18px; border-radius: 4px;
  border: 2px solid var(--border); cursor: pointer; flex-shrink: 0;
}

/* ── Room editor ── */
.room-list { display: flex; flex-direction: column; gap: 3px; margin-top: 4px; }
.room-entry {
  background: var(--surf2); border: 1px solid var(--border);
  border-radius: 4px; padding: 4px 6px;
  display: flex; align-items: center; gap: 5px; cursor: pointer;
}
.room-entry.selected { border-color: var(--yellow); }
.room-entry-color { width: 10px; height: 10px; border-radius: 2px; flex-shrink: 0; }
.room-entry-name  { font-size: 9px; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.room-entry-del   { background: none; border: none; color: var(--red); cursor: pointer; font-size: 11px; padding: 0; }

/* ── Canvas wrap ── */
.canvas-wrap {
  flex: 1; position: relative; overflow: hidden;
  display: flex; align-items: center; justify-content: center;
  background: var(--bg); min-height: 0; min-width: 0;
}
canvas { display: block; cursor: crosshair; touch-action: none; user-select: none; -webkit-user-select: none; }

/* ── Tooltip ── */
.tooltip {
  position: fixed;
  background: var(--surf); border: 1px solid var(--accent);
  border-radius: 5px; padding: 4px 8px; font-size: 9px;
  pointer-events: none; display: none; z-index: 1000;
  color: var(--text); white-space: nowrap;
}

/* ── Toast ── */
.toast {
  position: absolute; bottom: 12px; right: 12px;
  background: var(--surf); border: 1px solid var(--green);
  border-radius: 7px; padding: 8px 14px; font-size: 10px;
  color: var(--green); display: none; z-index: 500;
  box-shadow: 0 4px 16px rgba(0,255,136,.15);
}

/* ── Mode hint bar ── */
.mode-hint {
  position: absolute; top: 8px; left: 50%; transform: translateX(-50%);
  background: rgba(13,18,25,.88); border: 1px solid var(--border);
  border-radius: 4px; padding: 3px 10px; font-size: 9px; color: var(--muted);
  pointer-events: none; white-space: nowrap; z-index: 10;
}


/* ── Versions-Badge ── */
.card-version-badge {
  position: absolute;
  bottom: 4px;
  right: 6px;
  font-size: 8px;
  color: var(--muted);
  opacity: 0.45;
  pointer-events: none;
  font-family: 'JetBrains Mono', monospace;
  letter-spacing: 0.05em;
  z-index: 5;
  user-select: none;
}

/* ── Dashboard Mode: kein Header, keine Sidebar, transparenter Hintergrund ── */
:host(.dashboard-mode) { background: transparent !important; }
:host(.dashboard-mode) .card {
  background: transparent !important;
  border: none !important;
  border-radius: 0 !important;
  min-height: 0 !important;
}
:host(.dashboard-mode) .card-header { display: none !important; }
:host(.dashboard-mode) .sidebar { display: none !important; }
:host(.dashboard-mode) .card-body { flex: 1; }
:host(.dashboard-mode) .canvas-wrap { flex: 1; }

/* ── Universal input/select/textarea reset for dark theme ── */
input, select, textarea, button {
  box-sizing: border-box;
  font-family: inherit;
}
input[type="text"], input[type="number"], input[type="search"],
input:not([type="color"]):not([type="range"]):not([type="checkbox"]):not([type="radio"]) {
  background: #07090d !important;
  color: #c8d8ec !important;
  border: 1px solid #1c2535 !important;
  border-radius: 3px;
  padding: 2px 5px;
  font-size: 9px;
}
input:focus:not([type="color"]):not([type="range"]):not([type="checkbox"]):not([type="radio"]) {
  outline: none !important;
  border-color: #00e5ff !important;
  box-shadow: 0 0 0 1px #00e5ff22;
}
select {
  background: #07090d !important;
  color: #c8d8ec !important;
  border: 1px solid #1c2535 !important;
}
textarea {
  background: #07090d !important;
  color: #c8d8ec !important;
  border: 1px solid #1c2535 !important;
}
`;

// ─────────────────────────────────────────────────────────────────────────────
class BLEPositioningCard extends HTMLElement {

  // ── Custom element boilerplate ──────────────────────────────────────────

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._hass     = null;
    this._config   = {};
    this._data     = null;   // card_data from backend
    this._mode     = "view"; // view | calibrate | scanners | rooms | lights | alarm
    this._entryId  = "";
    this._devId         = "";     // currently selected device
    this._showAllDevices = true;  // show all devices simultaneously
    this._wizardMode    = false;
    this._wizardRoom    = null;
    this._editDevice    = null;
    this._addingDevice  = false;
    this._pendingAlarms      = [];
    this._pendingInfoSensors = [];
    this._placingInfoIdx     = -1;   // [{id, name, entity, color, scope, room_idx}]
    this._pendingEnergyLines = [];   // [{id,name,type,entity,max_w,x1,y1,x2,y2}]
    this._pendingDecos       = [];   // [{id,type,mx,my,size,label,angle}]
    this._dekoPlacing        = null; // type string when placing
    this._dekoSelected       = -1;   // selected deco index
    this._dekoDragging       = -1;   // dragging deco index
    this._pendingBatteries   = [];   // [{id,name,entity,mx,my}]
    this._placingEnergyPt    = null;
    this._placingBatteryIdx  = -1;
    this._energyAnimTs       = 0;
    this._editAlarm     = null;
    this._addingAlarm   = false;
    this._alarmPulse    = 0;    // animation frame counter
    this._wizardPts     = [];
    this._doors          = [];
    this._windows        = [];
    this._pendingWindows = [];
    this._placingDoor    = false;
    this._placingWindow  = false;
    this._pendingDoors   = [];
    this._doorPenalty    = true;   // toggle: use doors for room-change guard
    this._dragDoor       = null;   // {idx, handle:'start'|'end'|'move', startMx, startMy}
    this._dragWindow     = null;   // same structure as _dragDoor

    // Canvas state
    this._canvas   = null;
    this._ctx      = null;
    this._bgImg    = new Image();
    this._bgLoaded = false;
    this._raf      = null;

    // Grid
    this._gridPts  = [];

    // Calibration
    this._selGridPt      = null;
    this._localFpHints   = {};   // (mx,my) → true – overlay before backend confirms
    this._pendingLights  = [];   // lights in edit mode
    this._placingLight      = false; // true when next canvas click places a new light
    this._replacingLightIdx = null;  // index of light being repositioned
    this._selLight          = null;  // index of selected light for dragging

    // Scanner editing
    this._editScanner    = null;   // index or null
    this._pendingScanners= [];     // working copy
    this._placingIdx     = -1;     // scanner being placed by click

    // Room editing
    this._pendingRooms   = [];
    this._zoneEditRoom   = null;
    this._imgOpacity     = 0.35;   // floor image opacity (0=hidden, 1=full)
    this._imgVisible     = true;
    this._selRoomIdx     = -1;
    this._drawState      = { active: false, sx: 0, sy: 0, ex: 0, ey: 0 };
    // Room drag / resize
    this._roomDrag       = null;  // {idx, mode:'move'|'resize', handle, startMx,startMy, origRoom}
    this._roomSubMode    = 'draw'; // 'draw' | 'edit'  – toggled by sidebar button
    // Map size editing
    this._editingMapSize = false;

    // EMA (visual smoothing, mirrors backend)
    this._ema            = {};     // devId → {x, y}

    // ── Optional features ──────────────────────────────────────────────────
    this._opts = {
      showRoomTemp:    true,   // Raum-Temperaturen im Grundriss
      showDeviceTrail: true,   // Geräte-Historie (Pfad)
      nightMode:       true,   // Nacht-Modus (auto via sun.sun)
      showMmwave:      true,   // mmWave Personen-Tracking overlay
      mmwaveClassify:  true,   // Personen/Tier-Klassifikation
      mmwavePosture:   true,   // Haltungs-Erkennung (Stehen/Sitzen/Liegen)
      mmwaveFallDetect:true,   // Sturz-Erkennung
      mmwaveFallSound: true,   // Alarm-Sound bei Sturz
      mmwaveFusion:    true,   // Multi-Sensor Fusion
      showAnalytics:   true,   // Aktivitäts-Aufzeichnung
      showSleep:       true,   // Schlaf-Monitoring
      mmwavePersonID:  false,  // Personen-Wiedererkennung via Muster
      showEmergencyBtn:false,  // Notfall-Button
      texFloor:      null,    // dataURL Bodentextur
      texWallOuter:  null,    // dataURL Außenwand-Textur
      texWallInner:  null,    // dataURL Innenwand-Textur
      texDoor:       null,    // dataURL Tür-Textur
      showInfoOverlay: true,   // Info-Sensor Badges
      showScanners:    true,   // Scanner-Overlay im Live-View
      showDevices:     true,   // Gerät-Punkte im Live-View
      showAlarmOverlay:true,   // Alarm-Overlay
      showEnergy:      true,   // Energiefluss-Overlay
      showCompare:     false,  // Grundriss-Vergleichsmodus
      ptzTracking:     false,  // PTZ Kamera Auto-Tracking
      zoomPan:         true,   // Zoom & Pan mit Maus/Touch
      personAvatar:    true,   // Personen-Profilbild aus HA
      roomTapLight:    false,  // Raum-Tap → Licht steuern
      showHeating:     false,  // Heizungsplan-Tab
      showHeatmap:     false,  // Zeitplan-Overlay Heatmap
      show3D:          false,  // 3D isometrische Ansicht
      floorOverlay:    false,  // Etagen-Überlagerung 3D
      shadowSim:       false,  // 3D Schatten-Simulation
      guestMode:       false,  // Gast-Modus (Geräte ausblenden)
      energyRoomCorr:  false,  // Energie-Raum-Korrelation
    };
    this._wallHeight  = 2.5;   // Wandhöhe in Metern (global)
    this._guestHidden = {};   // { device_id: true } - im Gast-Modus versteckt
    this._energyRoomData = {}; // { roomName: { wh: 0, minutes: 0 } }
    this._3dAzimuth   = 30;    // 3D orbit: horizontal angle (weniger schräg)
    this._3dElevation = 42;    // 3D orbit: vertical angle (mehr von oben = besser lesbar)
    this._3dZoom      = 1.0;   // 3D zoom
    this._3dDrag      = null;  // 3D drag state
    this._3dWallColor = null;  // null = use room color, else override hex
    this._3dWallAlpha = 0.75;  // wall face opacity

    // Zoom/Pan state
    this._zoom      = 1.0;
    this._panX      = 0;
    this._panY      = 0;
    this._isPanning = false;
    this._panStart  = null;
    this._pinchDist = null;

    // Device trail history
    this._deviceTrail = {};  // devId → [{mx,my,ts}]
    this._trailMaxLen = 20;

    // Night mode
    this._isNightMode = false;

    // Heatmap data
    this._heatmapData = {};  // roomName → [{ts, devId}]

    // Multi-floor
    this._floors      = [];   // [{id,name,floor_w,floor_h,...}]
    this._activeFloor = 0;
    this._floorSwitching = false;

    // Automation assistant
    this._automations = [];   // built automations
    this._autoWizard  = null; // wizard state

    // mmWave 2-Punkt-Kalibrierung
    this._mmwaveCalibPoints = null; // {sensorId, phase:1|2, points:[{fx,fy,sx,sy}]}

    // Texturen (wall_outer, wall_inner, floor) - je ein HTMLImageElement nach Load
    this._textures = {};       // {floor:Image, wall_outer:Image, wall_inner:Image, door:Image}
    this._textureSrc = {};     // {floor:dataURL, wall_outer:dataURL, ...} – aus opts geladen

    // Bind methods used as event listeners
    this._onCanvasClick  = this._onCanvasClick.bind(this);
    this._onCanvasMove   = this._onCanvasMove.bind(this);
    this._onCanvasDown   = this._onCanvasDown.bind(this);
    this._onCanvasUp     = this._onCanvasUp.bind(this);
    this._onCanvasLeave  = this._onCanvasLeave.bind(this);
    this._onResize       = this._onResize.bind(this);
  }

  // ── HA integration ──────────────────────────────────────────────────────

  set hass(hass) {
    const wasBooted = this._booted;
    this._hass = hass;
    if (!wasBooted) {
      this._booted = true;
      this._boot();
    } else {
      // Update live entity values in sidebar
      this._updateSidebarLive();
      // Trigger redraw so alarm/light states refresh immediately
      // (RAF-Loop throttles when browser tab is in background)
      if (!this._hassRedrawPending) {
        this._hassRedrawPending = true;
        requestAnimationFrame(() => {
          this._hassRedrawPending = false;
          this._draw();
        });
      }
    }
  }

  setConfig(config) {
    // HA übergibt ein readonly/frozen Object – zuerst kopieren, dann modifizieren
    const cfg = Object.assign({}, config || {});
    // Always ensure type is present regardless of what HA YAML editor sends
    if (!cfg.type || !cfg.type.includes("ble-positioning")) cfg.type = "custom:ble-positioning-card";
    this._config       = cfg;
    this._entryId      = cfg.entry_id || "";
    this._devId        = cfg.device_id || "";
    this._dashboardMode = cfg.dashboard_mode !== false; // default: true im Dashboard
  }

  static getConfigElement() {
    return document.createElement("ble-positioning-card-editor");
  }

  static getStubConfig() {
    return { type: "ble-positioning-card", entry_id: "", device_id: "" };
  }

  getCardSize() { return 6; }

  // ── Boot ─────────────────────────────────────────────────────────────────

  _highlightWizardRoom() {
    // Scroll canvas view so wizard room is centered
    if (this._wizardRoom === null) return;
    const rooms = this._data?.rooms || [];
    const room  = rooms[this._wizardRoom];
    if (!room) return;
    // Just trigger a redraw - the room highlight is handled in _drawRooms
    // by checking this._wizardRoom
  }

  async _discoverEntryId() {
    // Strategy 1: check URL path - panel URL contains no entry_id but we can
    // try the config_entries API to find ble_positioning entries
    try {
      const res = await this._hass.callApi("GET", "config/config_entries/entry");
      const entries = res.filter(e => e.domain === "ble_positioning");
      if (entries.length > 0) {
        this._entryId = entries[0].entry_id;
        console.log("BLE Positioning: discovered entry_id via config_entries:", this._entryId);
        return;
      }
    } catch(e) {
      console.warn("BLE Positioning: config_entries discovery failed", e);
    }
    console.error("BLE Positioning: no entry_id found – please set entry_id in card config");
  }

  async _boot() {
    try {
    // If no entry_id yet, try to discover it from HA states
    if (!this._entryId && this._hass) {
      await this._discoverEntryId();
    }

    this._render();
    this._canvas = this.shadowRoot.querySelector("canvas");
    this._ctx    = this._canvas.getContext("2d");
    this._attachCanvasEvents();

    // ResizeObserver is more reliable than window resize in Shadow DOM
    this._resizeObserver = new ResizeObserver(() => this._onResize());
    this._resizeObserver.observe(this.shadowRoot.getElementById("cwrap"));
    window.addEventListener("resize", this._onResize);

    await this._loadData();

    // Wait for layout to settle before first resize
    requestAnimationFrame(() => {
      this._onResize();
      this._startRenderLoop();
    });
    } catch(e) { console.error("BLE Positioning: _boot error", e); }
  }

  async _loadData() {
    if (!this._entryId) {
      this._loadError = "Keine entry_id konfiguriert. Bitte entry_id in der Karten-Konfiguration setzen.";
      return;
    }
    try {
      const res = await this._hass.callApi("GET",
        `ble_positioning/${this._entryId}/card_data`);
      const firstLoad = !this._data;
      this._data = res;
      if (!this._devId && res.devices?.length) {
        this._devId = res.devices[0].device_id;
      }
      // Only reset pending state on first load, not after saves
      this._doors   = res.doors   || [];
      this._windows = res.windows || [];
      if (res.door_penalty !== undefined) this._doorPenalty = res.door_penalty;
      if (res.img_opacity !== undefined) this._imgOpacity = res.img_opacity;
      if (res.options) { Object.assign(this._opts, res.options); this._loadTextures(); }
      if (res.wall_height != null) this._wallHeight = res.wall_height;
      if (res.wall_color  !== undefined) this._3dWallColor = res.wall_color;
      if (res.wall_alpha  != null) this._3dWallAlpha = res.wall_alpha;
      if (res.floors) {
        this._floors      = res.floors;
        this._activeFloor = res.active_floor || 0;
        this._rebuildFloorSelector();
      }
      if (firstLoad) {
        this._pendingScanners = structuredClone(res.scanners || []);
        this._pendingRooms    = structuredClone(res.rooms    || []);
        this._pendingDoors    = structuredClone(res.doors    || []);
        this._pendingWindows  = structuredClone(res.windows  || []);
        if (res.door_penalty !== undefined) this._doorPenalty = res.door_penalty;
      }
      // Always sync lights from backend (so Lights-Tab shows correct state after reload)
      this._pendingLights = structuredClone(res.lights || []);
      // Sync mmwave/ptz nur wenn NICHT gerade im Editor-Tab bearbeitet wird
      // (sonst würden ungespeicherte Änderungen überschrieben)
      if (this._mode !== "mmwave") {
        this._pendingMmwave = structuredClone(res.mmwave_sensors || []);
      }
      if (this._mode !== "ptz" && res.ptz_cameras) {
        this._ptzCameras = structuredClone(res.ptz_cameras);
      }
      // Always sync energy from backend
      this._pendingEnergyLines = structuredClone(res.energy_lines || []);
      this._pendingDecos       = structuredClone(res.decos       || []);
      if (res.decos) this._data.decos = res.decos;
      this._pendingBatteries   = structuredClone(res.batteries   || []);

      // Always sync info_sensors from backend
      this._pendingInfoSensors = structuredClone(res.info_sensors || []);

      // Always sync alarms from backend (so saved alarms appear immediately)
      this._pendingAlarms = structuredClone(res.alarms || []);

      // Always reload bg image if path changed (or on first load)
      const newPath = res.image_path || "";
      if (newPath !== (this._lastImagePath || "")) {
        this._lastImagePath = newPath;
        this._loadBgImage();
      }
      this._buildGrid();
      this._rebuildSidebar();
      this._setConnected(true);
    } catch (e) {
      console.error("BLE card: load failed", e);
      this._setConnected(false);
      // Keep existing this._data - don't wipe it on transient errors
    }
  }

  // ── Render skeleton ──────────────────────────────────────────────────────

  _render() {
    const s = this.shadowRoot;
    s.innerHTML = `
<style>${CARD_CSS}</style>
<div class="card">
  <div class="card-header">
    <span class="card-title">⌖ BLE POSITIONING</span>
    <div class="floor-selector" id="floorSel" style="display:none;padding:2px 8px;background:var(--surf2);border-bottom:1px solid var(--border);display:flex;align-items:center;gap:4px;overflow-x:auto;flex-shrink:0"></div>
    <div class="tabs-scroll-wrap" id="tabswrap">
      <button class="tabs-arrow" id="tabarr-l">‹</button>
      <div class="mode-tabs" id="modetabs">
      <button class="mode-tab active" data-mode="view">⌖ LIVE</button>
      <button class="mode-tab cal"      data-mode="calibrate">✦ CAL</button>
      <button class="mode-tab scanners" data-mode="scanners">◈ SCANNER</button>
      <button class="mode-tab rooms"    data-mode="rooms">▭ RÄUME</button>
      <button class="mode-tab lights"   data-mode="lights">💡 LIGHTS</button>
      <button class="mode-tab alarm"    data-mode="alarm">🚨 ALARM</button>
      <button class="mode-tab info"     data-mode="info">ℹ INFO</button>
      <button class="mode-tab energie"  data-mode="energie">⚡ ENERGIE</button>
      <button class="mode-tab deko"     data-mode="deko">🏗 DEKO</button>
      <button class="mode-tab design"    data-mode="design">🎨 DESIGN</button>
      <button class="mode-tab settings"  data-mode="settings">⚙ OPT</button>
      <button class="mode-tab automate" data-mode="automate">🤖 AUTO</button>
      <button class="mode-tab mmwave"   data-mode="mmwave">📡 MMWAVE</button>
      <button class="mode-tab analytics" data-mode="analytics">📊 ANALYSE</button>
      <button class="mode-tab ptz"       data-mode="ptz">📹 PTZ</button>
      <button class="mode-tab journey"  data-mode="journey">⏮ REISE</button>
      </div><!-- end mode-tabs -->
      <button class="tabs-arrow" id="tabarr-r">›</button>
    </div><!-- end tabs-scroll-wrap -->
    <div class="conn-dot" id="conn"></div>
  </div>
  <div class="card-body">
    <div class="sidebar" id="sidebar"></div>
    <div class="canvas-wrap" id="cwrap">
      <canvas id="c"></canvas>
      <div class="mode-hint" id="hint"></div>
      <div class="toast" id="toast"></div>
      <div class="card-version-badge" id="vbadge">v${CARD_VERSION}</div>
    </div>
  </div>
</div>
<div class="tooltip" id="tip"></div>`;

    // ── Dashboard Mode: Kein Header, keine Sidebar, transparenter Hintergrund ─
    if (this._dashboardMode) {
      this.classList.add('dashboard-mode');
      // Background des host-elements transparent setzen
      this.style.background = 'transparent';
    } else {
      this.classList.remove('dashboard-mode');
      this.style.background = '';
    }

    // ── Tab scroll arrows ─────────────────────────────────────────────────────
    const modetabsEl = s.getElementById('modetabs');
    const arrLEl = s.getElementById('tabarr-l');
    const arrREl = s.getElementById('tabarr-r');
    if (modetabsEl && arrLEl && arrREl) {
      const scrollAmt = 90;
      arrLEl.addEventListener('click', () => modetabsEl.scrollBy({ left: -scrollAmt, behavior: 'smooth' }));
      arrREl.addEventListener('click', () => modetabsEl.scrollBy({ left:  scrollAmt, behavior: 'smooth' }));
      const updateArrows = () => {
        arrLEl.style.opacity = modetabsEl.scrollLeft <= 2 ? '0.3' : '1';
        arrREl.style.opacity = modetabsEl.scrollLeft + modetabsEl.clientWidth >= modetabsEl.scrollWidth - 2 ? '0.3' : '1';
      };
      modetabsEl.addEventListener('scroll', updateArrows, { passive:true });
      this._setTimeout(updateArrows, 50);
    }
    s.querySelectorAll(".mode-tab").forEach(btn => {
      btn.addEventListener("click", () => {
        this._setMode(btn.dataset.mode);
        // Scroll active into view after mode switch
        this._setTimeout(() => btn.scrollIntoView({ inline: 'nearest', behavior: 'smooth' }), 50);
      });
    });
  }

  // ── Mode switching ───────────────────────────────────────────────────────

  _setMode(mode) {
    this._mode      = mode;
    if (mode === "mmwave" || mode === "ptz") {
      // Sync pending state from server when entering mmwave/ptz tab
      this._pendingMmwave = structuredClone(this._data?.mmwave_sensors || []);
      if (this._data?.ptz_cameras) this._ptzCameras = structuredClone(this._data.ptz_cameras);
    }
    if (mode === "lights") {
      this._pendingLights = structuredClone(this._data?.lights || []);
      this._pendingDesigns = structuredClone(this._data?.custom_designs || []);
      this._pendingMmwave  = structuredClone(this._data?.mmwave_sensors || []);
      if (this._data?.ptz_cameras) this._ptzCameras = structuredClone(this._data.ptz_cameras);
      this._initOptEventListener();
      // Strip live state fields – keep only config fields
      this._pendingLights = this._pendingLights.map(l => ({
        id: l.id, name: l.name, entity: l.entity,
        mx: l.mx, my: l.my, mz: l.mz,
        room_id: l.room_id, color: l.color,
        lumen: l.lumen, lamp_type: l.lamp_type
      }));
    }
    this._selGridPt = null;
    this._placingIdx = -1;
    this._drawState.active = false;
    this._selRoomIdx = -1;

    // Update tab highlight
    this.shadowRoot.querySelectorAll(".mode-tab").forEach(b => {
      b.classList.toggle("active", b.dataset.mode === mode);
    });

    // Hint text
    const hints = {
      view:      "",
      calibrate: "Rasterpunkt anklicken → stehen bleiben → AUFNEHMEN",
      scanners:  "Scanner anklicken zum Bearbeiten · Neu: + Scanner",
      rooms:     "Rechteck ziehen: Raum · 🏠/🌿 Typ umschalten für Innen/Außen",
    };
    const hintEl = this.shadowRoot.getElementById("hint");
    if (hintEl) hintEl.textContent = hints[mode] || "";

    // Canvas cursor
    if (this._canvas) {
      this._canvas.style.cursor =
        mode === "calibrate" ? "crosshair" :
        mode === "scanners"  ? (this._placingIdx >= 0 ? "crosshair" : "default") :
        mode === "lights"    ? (this._placingLight ? "crosshair" : "move") :
        mode === "rooms"     ? "crosshair" :
        mode === "mmwave"    ? (this._mmwavePlacing != null || this._mmwaveCalibPoints?.phase >= 1 ? "crosshair" : "default") :
        mode === "ptz"       ? (this._ptzPlacing    != null ? "crosshair" : "default") : "default";
    }

    this._rebuildSidebar();
  }

  // ── Sidebar ──────────────────────────────────────────────────────────────

  _rebuildSidebar() {
    // Performance: nicht rebuilden wenn Browser-Tab im Hintergrund (außer bei view-Modus)
    if (document.hidden && this._mode === "view") return;
    // Commit any active input values before rebuilding
    const active = this.shadowRoot.activeElement;
    if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA")) {
      active.blur();
    }
    const sb = this.shadowRoot.getElementById("sidebar");
    if (!sb) return;
    sb.innerHTML = "";
    this._rebuildFloorSelector();
    // Always redraw after sidebar rebuild (instant feedback)
    requestAnimationFrame(() => this._draw());

    switch (this._mode) {
      case "view":       sb.appendChild(this._sidebarView());       break;
      case "calibrate":  sb.appendChild(this._sidebarCalibrate());  break;
      case "scanners":   sb.appendChild(this._sidebarScanners());   break;
      case "rooms":      sb.appendChild(this._sidebarRooms());      break;
      case "lights":     sb.appendChild(this._sidebarLights());     break;
      case "alarm":      sb.appendChild(this._sidebarAlarm());      break;
      case "energie":    sb.appendChild(this._sidebarEnergie());     break;
      case "settings":   sb.appendChild(this._sidebarSettings());    break;
      case "automate":   sb.appendChild(this._sidebarAutomate());    break;
      case "journey":    sb.appendChild(this._sidebarJourney());      break;
      case "info":       sb.appendChild(this._sidebarInfo());        break;
      case "deko":       sb.appendChild(this._sidebarDeko());        break;
      case "design":     sb.appendChild(this._sidebarDesign());      break;
      case "mmwave":     sb.appendChild(this._sidebarMmwave());      break;
      case "analytics":  sb.appendChild(this._sidebarAnalytics());    break;
      case "ptz":        sb.appendChild(this._sidebarPtz());           break;
    }
  }

  // View sidebar
  _sidebarView() {
    const wrap = document.createElement("div");
    const scanners = this._data?.scanners || [];
    const devices  = this._data?.devices  || [];

    // Device selector (if multiple)
    if (devices.length > 1) {
      const box = this._sbBox("Gerät");
      const sel = document.createElement("select");
      sel.style.cssText = "width:100%;background:var(--surf2);border:1px solid var(--border);color:var(--text);padding:3px 5px;border-radius:4px;font-family:inherit;font-size:9px;margin-top:2px";
      devices.forEach(d => {
        const opt = document.createElement("option");
        opt.value = d.device_id; opt.textContent = d.device_name;
        if (d.device_id === this._devId) opt.selected = true;
        sel.appendChild(opt);
      });
      sel.addEventListener("change", () => { this._devId = sel.value; this._rebuildSidebar(); });

      // "Alle anzeigen" toggle
      const allBtn = document.createElement("button");
      allBtn.textContent = this._showAllDevices ? "👁 Alle" : "👁 Einer";
      allBtn.style.cssText = `background:${this._showAllDevices ? "var(--accent)" : "var(--surf2)"};border:1px solid var(--border);color:${this._showAllDevices ? "#000" : "var(--text)"};border-radius:4px;padding:2px 7px;font-size:9px;cursor:pointer;font-family:inherit;white-space:nowrap`;
      allBtn.addEventListener("click", () => {
        this._showAllDevices = !this._showAllDevices;
        allBtn.textContent = this._showAllDevices ? "👁 Alle" : "👁 Einer";
        allBtn.style.background = this._showAllDevices ? "var(--accent)" : "var(--surf2)";
        allBtn.style.color      = this._showAllDevices ? "#000" : "var(--text)";
      });
      // hdrRight: kleiner Header-Bereich rechts neben Select
      const hdrRow = document.createElement("div");
      hdrRow.style.cssText = "display:flex;gap:4px;align-items:center;margin-top:2px";
      hdrRow.appendChild(sel);
      hdrRow.appendChild(allBtn);
      box.appendChild(hdrRow);
      wrap.appendChild(box);
    }

    // Scanner distances
    const sbBox = this._sbBox("Scanner");
    scanners.forEach(s => {
      const row = document.createElement("div"); row.className = "sb-row";
      row.innerHTML = `<span>${s.name}</span><span class="sb-val" id="sv_${s.id}">--</span>`;
      sbBox.appendChild(row);
      const bar = document.createElement("div"); bar.className = "bar";
      bar.innerHTML = `<div class="bar-fill" id="bar_${s.id}" style="width:0%;background:${s.color||"#00e5ff"}"></div>`;
      sbBox.appendChild(bar);
    });
    wrap.appendChild(sbBox);

    // Position
    const posBox = this._sbBox("Position");
    posBox.innerHTML += `
      <div class="sb-row"><span>X</span><span class="sb-val" id="pv_x">--</span></div>
      <div class="sb-row"><span>Y</span><span class="sb-val" id="pv_y">--</span></div>
      <div class="sb-row"><span>Score</span><span class="sb-green" id="pv_score">--</span></div>
      <div class="room-box"><div class="room-lbl">RAUM</div><div class="room-name" id="pv_room">--</div></div>
      <div class="room-box" id="pv_zone_box" style="display:none;margin-top:4px"><div class="room-lbl" style="color:#a78bfa">ZONE</div><div class="room-name" id="pv_zone" style="color:#a78bfa">--</div></div>`;
    wrap.appendChild(posBox);

    // FP stats
    const fpBox = this._sbBox("Fingerprints");
    const counts = this._data?.fp_counts || {};
    const cnt = counts[this._devId] || 0;
    fpBox.innerHTML += `
      <div class="sb-row"><span>Gesamt</span><span class="sb-green" id="pv_fpcount">${cnt}</span></div>
      <div class="sb-row"><span>Auto-Cal heute</span><span class="sb-green" id="pv_actoday">--</span></div>`;
    wrap.appendChild(fpBox);


    // ── mmWave Personen Live-Panel ─────────────────────────────────────────
    const sensors = (this._pendingMmwave?.length > 0 ? this._pendingMmwave : this._data?.mmwave_sensors) || [];
    if (sensors.length > 0) {
      const mmBox = this._sbBox("📡 mmWave Personen");
      mmBox.id = "mmwave_persons_box";

      // Gesamt-Zähler Header
      const totalRow = document.createElement("div");
      totalRow.style.cssText = "display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;padding:4px 6px;background:#111820;border-radius:4px;border:1px solid #1c2535";
      totalRow.innerHTML = `<span style="font-size:9px;color:#94a3b8">Erkannte Personen</span>
        <span id="mmw_total_count" style="font-size:14px;font-weight:700;color:#00e5ff;font-family:'JetBrains Mono',monospace">0</span>`;
      mmBox.appendChild(totalRow);

      // Personen-Karten Container
      const personsContainer = document.createElement("div");
      personsContainer.id = "mmw_persons_container";
      personsContainer.style.cssText = "display:flex;flex-direction:column;gap:4px";
      mmBox.appendChild(personsContainer);

      // Sensor-Übersicht (kein Panel, nur kompakt)
      sensors.forEach(sensor => {
        const srow = document.createElement("div");
        srow.style.cssText = "display:flex;align-items:center;gap:6px;padding:3px 0;border-top:1px solid #0d1219;margin-top:4px";
        const scol = sensor.color || "#ff6b35";
        srow.innerHTML = `<span style="width:6px;height:6px;border-radius:50%;background:${scol};flex-shrink:0;display:inline-block"></span>
          <span style="font-size:8px;color:#94a3b8;flex:1">${sensor.name || sensor.id}</span>
          <span id="mmw_sens_${sensor.id}_cnt" style="font-size:8px;color:${scol};font-weight:700">0 P</span>`;
        mmBox.appendChild(srow);
      });

      wrap.appendChild(mmBox);
    }

    // ── Sichtbarkeits-Schalter ────────────────────────────────────────────
    const visBox = this._sbBox("Einblenden / Ausblenden");
    const visDefs = [
      { key:"showMmwave",      emoji:"📡", label:"mmWave" },
      { key:"showCamera",      emoji:"📷", label:"Kameras" },
      { key:"showDeviceTrail", emoji:"👣", label:"Gerätepfad" },
      { key:"showRoomTemp",    emoji:"🌡", label:"Temperatur" },
      { key:"showPresence",    emoji:"👁", label:"Präsenz" },
      { key:"showGeofence",    emoji:"🔔", label:"Geofence" },
      { key:"showRaumVerlauf", emoji:"⏱", label:"Verlauf" },
      { key:"showHeatmap",     emoji:"🗺", label:"Heatmap" },
      { key:"showInfoOverlay", emoji:"ℹ",  label:"Info-Sensor" },
      { key:"showScanners",    emoji:"📶", label:"Scanner" },
      { key:"showDevices",     emoji:"📱", label:"Geräte" },
      { key:"showAlarmOverlay",emoji:"🚨", label:"Alarme" },
      { key:"showEnergy",      emoji:"⚡", label:"Energie" },
      { key:"show3D",          emoji:"🧊", label:"3D-Modus" },
    ];
    const visGrid = document.createElement("div");
    visGrid.style.cssText = "display:grid;grid-template-columns:repeat(2,1fr);gap:3px;margin-top:4px";
    visDefs.forEach(def => {
      const active = this._opts?.[def.key] !== false;
      const btn = document.createElement("button");
      btn.style.cssText = `display:flex;align-items:center;gap:3px;padding:3px 5px;border-radius:4px;border:1px solid ${active?"var(--accent)44":"var(--border)"};background:${active?"var(--accent)11":"var(--surf2)"};color:${active?"var(--accent)":"var(--muted)"};font-size:8px;cursor:pointer;font-family:inherit;white-space:nowrap;width:100%`;
      btn.innerHTML = `<span>${def.emoji}</span><span>${def.label}</span>`;
      btn.addEventListener("click", () => {
        if (!this._opts) this._opts = {};
        this._opts[def.key] = !active;
        this._rebuildSidebar();
        this._draw();
      });
      visGrid.appendChild(btn);
    });
    visBox.appendChild(visGrid);
    wrap.appendChild(visBox);

    return wrap;
  }

  // Calibrate sidebar
  _sidebarCalibrate() {
    const wrap = document.createElement("div");

    // Device selector
    if ((this._data?.devices || []).length > 1) {
      wrap.appendChild(this._deviceSelector());
    }

    // ── Room progress overview ────────────────────────────────────────────
    const rooms   = this._data?.rooms || [];
    const fpCounts = this._data?.fp_counts || {};
    const allFps  = this._data?.fingerprints || [];
    const MIN_PTS = 5;

    // Build per-room fp count
    const roomFpCount = (room) => {
      return allFps.filter(fp =>
        fp.device_id === this._devId &&
        fp.mx >= room.x1 && fp.mx <= room.x2 &&
        fp.my >= room.y1 && fp.my <= room.y2
      ).length;
    };

    // Overview box: one row per room with status indicator
    if (rooms.length > 0) {
      const ovBox = this._sbBox("Raum-Fortschritt");
      rooms.forEach((room, ri) => {
        const cnt   = roomFpCount(room);
        const pct   = Math.min(100, Math.round(cnt / MIN_PTS * 100));
        const color = cnt === 0 ? "var(--red)" : cnt < MIN_PTS ? "var(--yellow)" : "var(--green)";
        const icon  = cnt === 0 ? "○" : cnt < MIN_PTS ? "◐" : "●";
        const row   = document.createElement("div");
        row.style.cssText = "display:flex;align-items:center;gap:5px;margin-bottom:4px;cursor:pointer;border-radius:4px;padding:3px 4px;";
        if (this._wizardRoom === ri) row.style.background = "var(--surf2)";
        row.innerHTML = `
          <span style="color:${color};font-size:13px;line-height:1">${icon}</span>
          <span style="flex:1;font-size:9px;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${room.name || "Raum "+(ri+1)}</span>
          <span style="font-size:8px;color:${color};white-space:nowrap">${cnt}/${MIN_PTS}</span>
          <div style="width:30px;height:4px;background:var(--border);border-radius:2px;overflow:hidden">
            <div style="width:${pct}%;height:100%;background:${color};border-radius:2px"></div>
          </div>`;
        row.addEventListener("click", () => {
          this._wizardRoom = (this._wizardRoom === ri) ? null : ri;
          this._wizardMode = this._wizardRoom !== null;
          // Optimalen Rasterschritt für Raum berechnen (mind. 5 Punkte)
          if (this._wizardMode && this._wizardRoom !== null) {
            const wr = rooms[this._wizardRoom];
            if (wr) this._wizardGridStep = this._wizardOptimalStep(wr);
            this._buildGrid();
            // Ersten Vorschlag: Eckpunkt (max Abstand von Raummitte)
            const cx = (wr.x1 + wr.x2) / 2, cy = (wr.y1 + wr.y2) / 2;
            const first = this._wizardNextPoint(cx, cy);
            if (first) {
              this._selGridPt = first;
            }
          }
          this._highlightWizardRoom();
          this._rebuildSidebar();
        });
        ovBox.appendChild(row);
      });

      // Overall status message
      const totalRooms = rooms.length;
      const readyRooms = rooms.filter((r,i) => roomFpCount(r) >= MIN_PTS).length;
      const statusDiv  = document.createElement("div");
      statusDiv.style.cssText = "font-size:8px;margin-top:5px;padding:4px 6px;border-radius:4px;line-height:1.5;";
      if (readyRooms === 0) {
        statusDiv.style.background = "rgba(239,68,68,0.12)";
        statusDiv.style.color = "var(--red)";
        statusDiv.textContent = "⚠ Noch keine Räume kalibriert. Klicke auf einen Raum um zu starten.";
      } else if (readyRooms < totalRooms) {
        statusDiv.style.background = "rgba(234,179,8,0.12)";
        statusDiv.style.color = "var(--yellow)";
        statusDiv.textContent = `◐ ${readyRooms}/${totalRooms} Räume bereit. Noch ${totalRooms-readyRooms} zu kalibrieren.`;
      } else {
        statusDiv.style.background = "rgba(34,197,94,0.12)";
        statusDiv.style.color = "var(--green)";
        statusDiv.textContent = `✓ Alle ${totalRooms} Räume kalibriert! Auto-Cal läuft im Hintergrund.`;
      }
      ovBox.appendChild(statusDiv);
      wrap.appendChild(ovBox);
    }

    // ── Active wizard or manual cal ───────────────────────────────────────
    const box = this._sbBox(this._wizardMode
      ? `Wizard: ${rooms[this._wizardRoom]?.name || "Raum"}`
      : "Kalibrierung");

    if (this._wizardMode && this._wizardRoom !== null) {
      const room  = rooms[this._wizardRoom];
      const cnt   = roomFpCount(room);
      const left  = Math.max(0, MIN_PTS - cnt);
      const hint  = document.createElement("div");
      hint.style.cssText = "font-size:8px;color:var(--muted);margin-bottom:6px;line-height:1.6;background:var(--surf2);padding:5px 6px;border-radius:4px;";
      const gridLabel = this._wizardGridStep >= 2.0 ? "2m-Raster (grob)" : "1m-Raster (fein)";
      const gridColor = this._wizardGridStep >= 2.0 ? "var(--yellow)" : "var(--green)";
      hint.innerHTML = left > 0
        ? `📍 Noch <b style="color:var(--yellow)">${left}</b> Punkt${left>1?"e":""} in <b style="color:var(--accent)">${room.name||"Raum"}</b> aufnehmen.<br>
           Raster: <b style="color:${gridColor}">${gridLabel}</b><br>
           Klicke auf einen blinkenden Punkt auf der Karte → stehe dort → AUFNEHMEN.`
        : `✓ Mindest-Kalibrierung erreicht! Du kannst weitere Punkte aufnehmen oder zum nächsten Raum wechseln.`;
      box.appendChild(hint);

      // Next room button if done
      if (left === 0) {
        const nextRoom = rooms.findIndex((r, i) => i > this._wizardRoom && roomFpCount(r) < MIN_PTS);
        if (nextRoom >= 0) {
          const nextBtn = document.createElement("button");
          nextBtn.className = "btn btn-yellow";
          nextBtn.textContent = `→ Weiter: ${rooms[nextRoom].name || "Raum "+(nextRoom+1)}`;
          nextBtn.style.marginBottom = "4px";
          nextBtn.addEventListener("click", () => {
            this._wizardRoom = nextRoom;
            this._highlightWizardRoom();
            this._rebuildSidebar();
          });
          box.appendChild(nextBtn);
        } else {
          const doneBtn = document.createElement("button");
          doneBtn.className = "btn btn-green";
          doneBtn.textContent = "✓ Kalibrierung abgeschlossen!";
          doneBtn.style.marginBottom = "4px";
          doneBtn.addEventListener("click", () => {
            this._wizardMode = false;
            this._wizardRoom = null;
            this._rebuildSidebar();
          });
          box.appendChild(doneBtn);
        }
      }
    } else {
      const hint = document.createElement("div");
      hint.style.cssText = "font-size:8px;color:var(--muted);margin-bottom:5px;line-height:1.6";
      hint.textContent = "Klicke einen Rasterpunkt → stehe dort → AUFNEHMEN";
      box.appendChild(hint);
    }

    const fpCount = fpCounts[this._devId] || 0;
    const gridTotal = this._gridPts.length;
    const pct = gridTotal > 0 ? Math.round(fpCount / gridTotal * 100) : 0;
    const rowEl = document.createElement("div"); rowEl.className = "sb-row";
    rowEl.innerHTML = `<span>Gewählt</span><span class="sb-green" id="cal_sel">--</span>`;
    box.appendChild(rowEl);
    const row2 = document.createElement("div"); row2.className = "sb-row";
    row2.innerHTML = `<span>Gesamt</span><span class="sb-green">${fpCount}/${gridTotal} (${pct}%)</span>`;
    box.appendChild(row2);

    // Grid step control
    const gsBox = this._sbBox("Rastergröße");
    const gsHint = document.createElement("div");
    gsHint.style.cssText = "font-size:8px;color:var(--muted);margin-bottom:6px;line-height:1.4";
    gsHint.textContent = "Abstand zwischen Kalibrierpunkten in Metern. Kleiner = mehr Punkte = genauer, aber mehr Aufwand.";
    gsBox.appendChild(gsHint);

    const currentStep = this._data?.grid_step || 0.5;
    const steps = [0.25, 0.5, 0.75, 1.0, 1.5, 2.0];
    const stepRow = document.createElement("div");
    stepRow.style.cssText = "display:flex;flex-wrap:wrap;gap:3px;margin-bottom:4px";
    steps.forEach(s => {
      const btn = document.createElement("button");
      btn.className = "btn " + (Math.abs(s - currentStep) < 0.01 ? "btn-green" : "btn-outline");
      btn.style.cssText = "flex:1;min-width:30px;font-size:9px;padding:3px 2px";
      btn.textContent = s < 1 ? `${Math.round(s*100)}cm` : `${s}m`;
      btn.addEventListener("click", async () => {
        try {
          await this._hass.callApi("POST",
            `ble_positioning/${this._entryId}/grid_step`, { grid_step: s });
          await this._loadData();
          this._rebuildSidebar();
          this._showToast(`Raster: ${btn.textContent}`);
        } catch(e) { this._showToast("Fehler: " + e.message); }
      });
      stepRow.appendChild(btn);
    });
    gsBox.appendChild(stepRow);

    const gsNote = document.createElement("div");
    gsNote.style.cssText = "font-size:7px;color:var(--muted);margin-top:2px";
    gsNote.textContent = `Aktuell: ${currentStep < 1 ? Math.round(currentStep*100)+"cm" : currentStep+"m"} → ${gridTotal} Punkte gesamt`;
    gsBox.appendChild(gsNote);
    wrap.appendChild(gsBox);

    // Show live sensor values so user can see if scanner data is arriving
    const dev = (this._data?.devices || []).find(d => d.device_id === this._devId);
    const svals = dev?.sensor_vals || {};
    const scanners = this._data?.scanners || [];
    if (scanners.length > 0) {
      const svBox = document.createElement("div");
      svBox.style.cssText = "margin:4px 0;border:1px solid var(--border);border-radius:4px;padding:5px 7px;background:var(--bg)";
      let hasAny = false;
      scanners.forEach(s => {
        const eid = s.entity || "";
        const val = svals[eid];
        const row = document.createElement("div");
        row.style.cssText = "display:flex;justify-content:space-between;font-size:8px;margin-bottom:2px";
        const ok = val !== null && val !== undefined;
        if (ok) hasAny = true;
        const noEntity = !s.entity;
        row.innerHTML = `<span style="color:var(--muted)">${s.name}</span>`
          + `<span style="color:${ok ? "var(--green)" : noEntity ? "var(--muted)" : "var(--red)"};">${ok ? parseFloat(val).toFixed(1)+" m" : noEntity ? "— kein Entity" : "⚠ kein Signal"}</span>`;
        svBox.appendChild(row);
      });
      if (!hasAny) {
        const warn = document.createElement("div");
        warn.style.cssText = "font-size:8px;color:var(--red);margin-top:3px;line-height:1.4";
        warn.textContent = "⚠ Keine Sensorwerte – Entity-IDs prüfen!";
        svBox.appendChild(warn);
      }
      box.appendChild(svBox);
    }

    // In wizard mode: allow capture at current device position (no grid click needed)
    const dev2  = (this._data?.devices || []).find(d => d.device_id === this._devId);
    const hasSensorData = dev2 && Object.values(dev2.sensor_vals || {}).some(v => v !== null && v !== undefined);
    const hasGridPt = !!this._selGridPt;

    const btn = document.createElement("button");
    btn.className = "btn btn-green"; btn.id = "btn_capture";
    btn.style.fontSize = "10px";

    if (this._wizardMode) {
      // Wizard mode: capture at suggested grid point (_selGridPt)
      // Nutzer geht zum vorgeschlagenen Punkt und drückt dann Aufnehmen
      const hasTarget = !!this._selGridPt;
      btn.disabled  = !hasSensorData || !hasTarget;
      if (!hasSensorData) {
        btn.textContent = "⬤ Warte auf Sensordaten...";
      } else if (!hasTarget) {
        btn.textContent = "⬤ Kein Punkt ausgewählt";
      } else {
        btn.textContent = `⬤ Aufnehmen bei ${this._selGridPt.mx.toFixed(2)} / ${this._selGridPt.my.toFixed(2)}`;
      }
      btn.title = "Nimmt Fingerprint am vorgeschlagenen Rasterpunkt auf";
      btn.addEventListener("click", () => this._captureFingerprint());
    } else {
      btn.disabled  = !hasGridPt;
      btn.textContent = hasGridPt ? "⬤ AUFNEHMEN" : "⬤ Erst Punkt anklicken";
      btn.addEventListener("click", () => this._captureFingerprint());
    }
    box.appendChild(btn);

    // Wizard: show auto-capture countdown if device is still
    if (this._wizardMode && hasSensorData) {
      const autoHint = document.createElement("div");
      autoHint.style.cssText = "font-size:8px;color:var(--muted);margin-top:3px;text-align:center";
      autoHint.textContent = "💡 Gerät ruhig hinlegen → Button drücken";
      box.appendChild(autoHint);
    }

    const status = document.createElement("div");
    status.className = "cal-status"; status.id = "cal_status";
    box.appendChild(status);

    wrap.appendChild(box);

    // ── Fingerprint-Alter ─────────────────────────────────────────────────
    const ageBox = this._sbBox("Fingerprint-Alter (Auto-Kalibrierung)");

    const ageHint = document.createElement("div");
    ageHint.style.cssText = "font-size:8px;color:var(--muted);margin-bottom:8px;line-height:1.6";
    ageHint.innerHTML =
      "Nach wie vielen Tagen darf die Auto-Kalibrierung einen vorhandenen Fingerprint überschreiben?<br>" +
      "<span style='color:var(--yellow)'>⚠ Wird sofort gespeichert – kein HA-Neustart nötig.</span>";
    ageBox.appendChild(ageHint);

    const currentAutoAge   = this._data?.auto_fp_max_age   ?? 7;
    const currentManualAge = this._data?.manual_fp_max_age ?? 30;

    const mkAgeRow = (label, icon, currentVal, fieldKey) => {
      const row = document.createElement("div");
      row.style.cssText = "margin-bottom:8px";

      const lbl = document.createElement("div");
      lbl.style.cssText = "font-size:8px;color:var(--text);margin-bottom:3px;display:flex;align-items:center;gap:4px";
      lbl.innerHTML = `<span>${icon}</span><span>${label}</span>`;
      row.appendChild(lbl);

      const inputRow = document.createElement("div");
      inputRow.style.cssText = "display:flex;align-items:center;gap:5px";

      const input = document.createElement("input");
      input.type  = "number";
      input.min   = "1";
      input.max   = "3650";
      input.value = currentVal;
      input.style.cssText =
        "width:60px;padding:3px 6px;border-radius:4px;border:1px solid var(--border);" +
        "background:var(--surf2);color:var(--text);font-size:10px;text-align:center";

      const unit = document.createElement("span");
      unit.style.cssText = "font-size:8px;color:var(--muted)";
      unit.textContent   = "Tage";

      const saveBtn = document.createElement("button");
      saveBtn.className   = "btn btn-outline";
      saveBtn.style.cssText = "flex:1;font-size:9px;padding:3px 6px";
      saveBtn.textContent = "Speichern";

      saveBtn.addEventListener("click", async () => {
        const val = parseInt(input.value, 10);
        if (isNaN(val) || val < 1 || val > 3650) {
          this._showToast("Wert muss zwischen 1 und 3650 liegen"); return;
        }
        try {
          saveBtn.disabled   = true;
          saveBtn.textContent = "...";
          await this._hass.callApi("POST",
            `ble_positioning/${this._entryId}/fp_age`,
            { [fieldKey]: val });
          await this._loadData();
          this._showToast(`${label}: ${val} Tage gespeichert`);
          saveBtn.textContent = "✓";
          this._setTimeout(() => { saveBtn.disabled = false; saveBtn.textContent = "Speichern"; }, 1500);
        } catch(e) {
          saveBtn.disabled = false;
          saveBtn.textContent = "Speichern";
          this._showToast("Fehler: " + e.message);
        }
      });

      inputRow.appendChild(input);
      inputRow.appendChild(unit);
      inputRow.appendChild(saveBtn);
      row.appendChild(inputRow);
      return row;
    };

    ageBox.appendChild(mkAgeRow(
      "Auto-Fingerprints (auto=true)",  "🤖", currentAutoAge,   "auto_fp_max_age"));
    ageBox.appendChild(mkAgeRow(
      "Manuelle Fingerprints (auto=false)", "✋", currentManualAge, "manual_fp_max_age"));

    // Info row showing how many prints would be refreshed
    const allFpsForAge = this._data?.fingerprints || [];
    const nowSec = Date.now() / 1000;
    const autoOld   = allFpsForAge.filter(fp =>
      fp.device_id === this._devId && fp.auto === true  &&
      (nowSec - (fp.ts || 0)) / 86400 > currentAutoAge).length;
    const manualOld = allFpsForAge.filter(fp =>
      fp.device_id === this._devId && fp.auto !== true  &&
      (nowSec - (fp.ts || 0)) / 86400 > currentManualAge).length;

    if (autoOld > 0 || manualOld > 0) {
      const infoDiv = document.createElement("div");
      infoDiv.style.cssText =
        "font-size:8px;padding:4px 6px;border-radius:4px;margin-top:2px;" +
        "background:rgba(234,179,8,0.12);color:var(--yellow);line-height:1.6";
      infoDiv.innerHTML =
        `⏰ Aktuell veraltet: <b>${autoOld}</b> Auto-Print${autoOld!==1?"s":""}, ` +
        `<b>${manualOld}</b> Manuell${manualOld!==1?"e":""}. ` +
        `Werden beim nächsten Stillstand erneuert.`;
      ageBox.appendChild(infoDiv);
    } else {
      const okDiv = document.createElement("div");
      okDiv.style.cssText =
        "font-size:8px;padding:4px 6px;border-radius:4px;margin-top:2px;" +
        "background:rgba(34,197,94,0.12);color:var(--green)";
      okDiv.textContent = "✓ Alle Fingerprints innerhalb der Altersgrenzen.";
      ageBox.appendChild(okDiv);
    }

    wrap.appendChild(ageBox);

    // Import / Export / Clear
    const mgmtBox = this._sbBox("Verwaltung");
    const clrBtn = document.createElement("button");
    clrBtn.className = "btn btn-red"; clrBtn.textContent = "✕ Alle löschen";
    clrBtn.addEventListener("click", () => this._clearFingerprints());
    mgmtBox.appendChild(clrBtn);

    const expBtn = document.createElement("button");
    expBtn.className = "btn btn-outline"; expBtn.textContent = "↓ Export JSON";
    expBtn.addEventListener("click", () => this._exportFP());
    mgmtBox.appendChild(expBtn);

    const impLbl = document.createElement("label");
    impLbl.className = "btn btn-outline";
    impLbl.style.cssText = "display:block;text-align:center;cursor:pointer;margin-top:3px";
    impLbl.innerHTML = "↑ Import JSON<input type='file' accept='.json' style='display:none'>";
    impLbl.querySelector("input").addEventListener("change", e => this._importFP(e));
    mgmtBox.appendChild(impLbl);
    wrap.appendChild(mgmtBox);

    return wrap;
  }

  // Scanner sidebar
  _sidebarScanners() {
    const wrap = document.createElement("div");
    const box  = this._sbBox("Scanner");

    // List
    const list = document.createElement("div");
    list.style.cssText = "display:flex;flex-direction:column;gap:3px;margin-bottom:6px";
    this._pendingScanners.forEach((s, i) => {
      const row = document.createElement("div");
      row.className = "room-entry" + (this._editScanner === i ? " selected" : "");
      row.innerHTML = `
        <div class="room-entry-color" style="background:${s.color||"#888"}"></div>
        <span class="room-entry-name">${s.name}</span>
        <button class="room-entry-del" data-idx="${i}">✕</button>`;
      row.addEventListener("click", e => {
        if (e.target.dataset.idx !== undefined) return;
        this._editScanner = (this._editScanner === i) ? null : i;
        this._rebuildSidebar();
      });
      row.querySelector(".room-entry-del").addEventListener("click", e => {
        e.stopPropagation();
        this._pendingScanners.splice(i, 1);
        this._editScanner = null;
        this._rebuildSidebar();
      });
      list.appendChild(row);
    });
    box.appendChild(list);

    // Inline editor for selected scanner
    if (this._editScanner !== null && this._pendingScanners[this._editScanner]) {
      const s = this._pendingScanners[this._editScanner];
      const form = document.createElement("div"); form.className = "scanner-form";

      // ── Sensor-Name als Heading im Editor ──
      const edHdr = document.createElement("div");
      edHdr.style.cssText = "font-size:9px;font-weight:700;color:var(--accent);letter-spacing:1px;padding:4px 0 6px;border-bottom:1px solid var(--border);margin-bottom:6px;display:flex;align-items:center;gap:5px";
      const edDot = document.createElement("div");
      edDot.style.cssText = `width:8px;height:8px;border-radius:50%;background:${s.color||"#888"};flex-shrink:0`;
      const edName = document.createElement("span");
      edName.textContent = s.name || "Scanner";
      edHdr.append(edDot, edName);
      form.appendChild(edHdr);

      const addField = (lbl, key, ph) => {
        const l = document.createElement("label"); l.textContent = lbl;
        const inp = document.createElement("input");
        inp.placeholder = ph || ""; inp.value = s[key] || "";
        inp.addEventListener("input", () => { s[key] = inp.value; });
        form.appendChild(l); form.appendChild(inp);
      };

      addField("Name",        "name",        "Wohnzimmer-Proxy");
      addField("Nearest Key", "nearest_key", "17bbd0");

      // Color picker
      const colorRow = document.createElement("div"); colorRow.className = "color-row";
      const colorL   = document.createElement("label"); colorL.textContent = "Farbe";
      const colorSw  = document.createElement("div"); colorSw.className = "color-swatch";
      colorSw.style.background = s.color || "#888";
      const colorInp = document.createElement("input");
      colorInp.type = "color"; colorInp.value = s.color || "#00e5ff";
      colorInp.style.display = "none";
      colorInp.addEventListener("input", () => {
        s.color = colorInp.value; colorSw.style.background = colorInp.value;
      });
      colorSw.addEventListener("click", () => colorInp.click());
      colorRow.append(colorL, colorSw, colorInp);
      form.appendChild(colorRow);

      // Place button
      const placeBtn = document.createElement("button");
      placeBtn.className = "btn btn-yellow"; placeBtn.style.marginTop = "4px";
      placeBtn.textContent = "📍 Auf Karte platzieren";
      placeBtn.addEventListener("click", () => {
        this._placingIdx = this._editScanner;
        this._canvas.style.cursor = "crosshair";
        this._showToast("Klicke auf die Scanner-Position im Grundriss");
      });
      form.appendChild(placeBtn);
      box.appendChild(form);
    }

    // Add scanner button
    const addBtn = document.createElement("button");
    addBtn.className = "btn btn-outline"; addBtn.textContent = "+ Scanner";
    addBtn.addEventListener("click", () => {
      const idx = this._pendingScanners.length;
      this._pendingScanners.push({
        id: `s${idx+1}`, name: `Scanner ${idx+1}`,
        entity: "", entity_raw: "", nearest_key: "",
        color: SCANNER_COLORS[idx % SCANNER_COLORS.length],
        mx: 0, my: 0,
      });
      this._editScanner = idx;
      this._rebuildSidebar();
    });
    box.appendChild(addBtn);

    // Save button
    const saveBtn = document.createElement("button");
    saveBtn.className = "btn btn-green"; saveBtn.textContent = "✓ Speichern";
    saveBtn.addEventListener("click", () => this._saveScanners());
    box.appendChild(saveBtn);

    wrap.appendChild(box);

    // ── Geräte-Bereich ─────────────────────────────────────────────────
    const devBox = this._sbBox("Geräte");
    const devices = this._data?.devices || [];
    const scanners = this._pendingScanners;

    // Hinweis wenn kein Gerät
    if (devices.length === 0 && !this._addingDevice) {
      const hint = document.createElement("div");
      hint.style.cssText = "font-size:8.5px;color:var(--yellow);line-height:1.5;padding:4px 0";
      hint.textContent = "⚠ Noch kein Gerät konfiguriert. Klicke auf '+ Gerät' um ein Gerät hinzuzufügen.";
      devBox.appendChild(hint);
    }

    // Vorhandene Geräte
    devices.forEach((dev, di) => {
      const isEdit = this._editDevice === di;
      const row = document.createElement("div");
      row.style.cssText = "display:flex;align-items:center;gap:4px;margin-bottom:2px;cursor:pointer;" +
        "border-radius:4px;padding:3px 5px;" + (isEdit ? "background:var(--surf2)" : "");
      const dot = document.createElement("span");
      dot.style.cssText = "width:8px;height:8px;border-radius:50%;background:var(--accent);flex-shrink:0";
      const nm = document.createElement("span");
      nm.style.cssText = "flex:1;font-size:9px;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap";
      nm.textContent = dev.device_name || dev.device_id;
      const fp = document.createElement("span");
      fp.style.cssText = "font-size:8px;color:var(--muted)";
      fp.textContent = (this._data?.fp_counts?.[dev.device_id] || 0) + " FPs";
      row.append(dot, nm, fp);
      row.addEventListener("click", () => {
        this._editDevice = isEdit ? null : di;
        this._rebuildSidebar();
      });
      devBox.appendChild(row);

      if (isEdit) {
        const ef = document.createElement("div");
        ef.style.cssText = "display:flex;flex-direction:column;gap:3px;padding:5px 4px;margin-bottom:5px;background:var(--surf2);border-radius:4px";

        // Gerätename
        const mkField = (lbl, val, onchange) => {
          const l = document.createElement("span");
          l.style.cssText = "font-size:8px;color:var(--muted)";
          l.textContent = lbl;
          const inp = document.createElement("input");
          inp.value = val || "";
          inp.style.cssText = "width:100%;background:var(--bg);border:1px solid var(--border);color:var(--text);padding:2px 5px;border-radius:3px;font-size:9px;font-family:inherit;box-sizing:border-box";
          inp.addEventListener("input", () => onchange(inp.value));
          ef.append(l, inp);
          return inp;
        };

        let editName = dev.device_name || "";
        mkField("Gerätename", editName, v => editName = v);

        // Pro Scanner: Distanz-Entity + Roh-Entity
        const scannerEntities = dev.scanner_entities || {};
        const scannerEntitiesRaw = dev.scanner_entities_raw || {};
        const tmpEntities = Object.assign({}, scannerEntities);
        const tmpRaw = Object.assign({}, scannerEntitiesRaw);

        if (scanners.length > 0) {
          const sec = document.createElement("span");
          sec.style.cssText = "font-size:8px;color:var(--accent);margin-top:4px;font-weight:600";
          sec.textContent = "Entities pro Scanner:";
          ef.appendChild(sec);

          scanners.forEach(s => {
            const sid = s.nearest_key || s.id || s.name;
            const slbl = document.createElement("span");
            slbl.style.cssText = "font-size:8px;color:var(--muted);margin-top:3px";
            slbl.textContent = "▸ " + s.name;
            ef.appendChild(slbl);
            mkField("  Distanz-Entity", tmpEntities[sid] || "", v => tmpEntities[sid] = v);
            mkField("  Roh-Entity (opt.)", tmpRaw[sid] || "", v => tmpRaw[sid] = v);
          });
        }

        const saveEd = document.createElement("button");
        saveEd.className = "btn btn-green";
        saveEd.style.cssText = "width:100%;margin-top:5px;font-size:9px";
        saveEd.textContent = "✓ Speichern";
        saveEd.addEventListener("click", async () => {
          saveEd.disabled = true; saveEd.textContent = "Speichert...";
          try {
            await this._hass.callApi("POST",
              `ble_positioning/${this._entryId}/update_device`,
              { device_id: dev.device_id, device_name: editName,
                entity_map: tmpEntities, entity_map_raw: tmpRaw });
            await this._loadData();
            this._editDevice = null;
            this._rebuildSidebar();
            this._showToast("✓ " + editName + " gespeichert");
          } catch(e) {
            saveEd.disabled = false; saveEd.textContent = "✓ Speichern";
            this._showToast("✗ " + (e?.body?.message || e.message || e));
          }
        });
        ef.appendChild(saveEd);
        devBox.appendChild(ef);
      }
    });

    // + Gerät Button
    const addDevBtn = document.createElement("button");
    addDevBtn.className = "btn btn-outline";
    addDevBtn.style.cssText = "width:100%;margin-top:4px;font-size:9px";
    addDevBtn.textContent = this._addingDevice ? "✕ Abbrechen" : "+ Gerät hinzufügen";
    addDevBtn.addEventListener("click", () => {
      this._addingDevice = !this._addingDevice;
      this._rebuildSidebar();
    });
    devBox.appendChild(addDevBtn);

    if (this._addingDevice) {
      const nf = document.createElement("div");
      nf.style.cssText = "display:flex;flex-direction:column;gap:3px;padding:5px 4px;margin-top:4px;background:var(--surf2);border-radius:4px";

      const mkNf = (lbl, ph, ref) => {
        const l = document.createElement("span");
        l.style.cssText = "font-size:8px;color:var(--muted)";
        l.textContent = lbl;
        const inp = document.createElement("input");
        inp.placeholder = ph;
        inp.style.cssText = "width:100%;background:var(--bg);border:1px solid var(--border);color:var(--text);padding:2px 5px;border-radius:3px;font-size:9px;font-family:inherit;box-sizing:border-box";
        nf.append(l, inp);
        return inp;
      };

      const nName = mkNf("Gerätename *", "iPhone 16");
      const nId   = mkNf("Geräte-ID *", "iphone_16");

      // Auto-fill ID aus Name
      nName.addEventListener("input", () => {
        if (!nId.value) nId.value = nName.value.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
      });

      // Pro Scanner Felder
      const scannerInputs = {};
      if (scanners.length > 0) {
        const sec = document.createElement("span");
        sec.style.cssText = "font-size:8px;color:var(--accent);margin-top:4px;font-weight:600";
        sec.textContent = "Entities pro Scanner:";
        nf.appendChild(sec);

        scanners.forEach(s => {
          const sid = s.nearest_key || s.id || s.name;
          const slbl = document.createElement("span");
          slbl.style.cssText = "font-size:8px;color:var(--muted);margin-top:3px";
          slbl.textContent = "▸ " + s.name;
          nf.appendChild(slbl);
          const dInp = mkNf("  Distanz-Entity *", "sensor.gerät_distance_to_proxy_" + sid);
          const rInp = mkNf("  Roh-Entity (opt.)", "sensor.gerät_unfiltered_" + sid);
          scannerInputs[sid] = { dist: dInp, raw: rInp };
        });
      } else {
        const warn = document.createElement("span");
        warn.style.cssText = "font-size:8px;color:var(--yellow);margin-top:3px";
        warn.textContent = "⚠ Erst Scanner anlegen und speichern, dann Gerät hinzufügen.";
        nf.appendChild(warn);
      }

      const confirmBtn = document.createElement("button");
      confirmBtn.className = "btn btn-green";
      confirmBtn.style.cssText = "width:100%;margin-top:5px;font-size:9px";
      confirmBtn.textContent = "+ Gerät anlegen";
      confirmBtn.addEventListener("click", async () => {
        const name  = nName.value.trim();
        const devId = nId.value.trim().replace(/\s+/g, "_").toLowerCase();
        if (!name || !devId) { this._showToast("Name und ID sind Pflicht"); return; }
        const entityMap = {}, entityMapRaw = {};
        Object.entries(scannerInputs).forEach(([sid, inp]) => {
          if (inp.dist.value.trim()) entityMap[sid] = inp.dist.value.trim();
          if (inp.raw.value.trim()) entityMapRaw[sid] = inp.raw.value.trim();
        });
        try {
          confirmBtn.disabled = true; confirmBtn.textContent = "Wird angelegt...";
          await this._hass.callApi("POST",
            `ble_positioning/${this._entryId}/add_device`,
            { device_id: devId, device_name: name,
              entity_map: entityMap, entity_map_raw: entityMapRaw });
          await this._loadData();
          this._addingDevice = false;
          this._rebuildSidebar();
          this._showToast("✓ Gerät " + name + " angelegt");
        } catch(e) {
          confirmBtn.disabled = false; confirmBtn.textContent = "+ Gerät anlegen";
          this._showToast("✗ " + (e?.body?.message || e.message || e));
        }
      });
      nf.appendChild(confirmBtn);
      devBox.appendChild(nf);
    }

    wrap.appendChild(devBox);
    return wrap;
  }

  // Rooms sidebar

  _sidebarRooms() {
    const wrap = document.createElement("div");

    // ── Floor image upload ───────────────────────────────────
    const imgBox = this._sbBox("Grundriss-Bild");
    const hasImg = !!(this._data?.image_path);
    if (hasImg) {
      const imgRow = document.createElement("div");
      imgRow.style.cssText = "display:flex;align-items:center;gap:4px;margin-bottom:5px";
      imgRow.innerHTML = `<span style="font-size:8px;color:var(--green);flex:1">✓ Bild geladen</span>`;
      const visBtn = document.createElement("button");
      visBtn.className = "btn btn-outline"; visBtn.style.fontSize="8px"; visBtn.style.padding="2px 6px";
      visBtn.textContent = this._imgVisible ? "👁 Sichtbar" : "👁 Ausgeblendet";
      visBtn.addEventListener("click", () => { this._imgVisible = !this._imgVisible; this._rebuildSidebar(); });
      imgRow.appendChild(visBtn);
      const delBtn = document.createElement("button");
      delBtn.className = "btn"; delBtn.style.cssText="font-size:8px;padding:2px 6px;background:var(--red)";
      delBtn.textContent = "✕ Entfernen";
      delBtn.addEventListener("click", async () => {
        await this._hass.callApi("POST", `ble_positioning/${this._entryId}/clear_image`, {});
        await this._loadData(); this._rebuildSidebar();
      });
      imgRow.appendChild(delBtn);
      imgBox.appendChild(imgRow);
      // Opacity slider
      const slRow = document.createElement("div");
      slRow.style.cssText = "display:flex;align-items:center;gap:5px;margin-top:3px";
      slRow.innerHTML = `<span style="font-size:8px;color:var(--muted);min-width:50px">Deckkraft</span>`;
      const sl = document.createElement("input");
      sl.type="range"; sl.min=0; sl.max=100; sl.value=Math.round(this._imgOpacity*100);
      sl.style.cssText="flex:1;height:4px;accent-color:var(--purple)";
      sl.addEventListener("input", () => { this._imgOpacity = sl.value/100; });
      const pct = document.createElement("span");
      pct.style.cssText="font-size:8px;color:var(--muted);min-width:24px;text-align:right";
      pct.textContent = Math.round(this._imgOpacity*100)+"%";
      sl.addEventListener("input", () => { this._imgOpacity=sl.value/100; pct.textContent=sl.value+"%"; });
      slRow.appendChild(sl); slRow.appendChild(pct);
      imgBox.appendChild(slRow);
    } else {
      const hint = document.createElement("div");
      hint.style.cssText = "font-size:8px;color:var(--muted);margin-bottom:5px";
      hint.textContent = "PNG/JPG/SVG hochladen (max 5MB)";
      imgBox.appendChild(hint);
      const fileBtn = document.createElement("button");
      fileBtn.className = "btn btn-outline"; fileBtn.style.width="100%";
      fileBtn.textContent = "📁 Grundriss hochladen";
      // ── SVG-Import (rect elements → rooms) ─────────────────────
      const svgBtn = document.createElement("button");
      svgBtn.className = "btn btn-outline"; svgBtn.style.cssText="width:100%;margin-top:4px";
      svgBtn.textContent = "📐 SVG-Raumplan importieren";
      svgBtn.title = "Importiert <rect>-Elemente aus SVG als Räume (Inkscape, Illustrator etc.)";
      svgBtn.addEventListener("click", () => {
        const si = document.createElement("input"); si.type="file"; si.accept=".svg,image/svg+xml";
        si.addEventListener('change', async () => {
          const sf = si.files[0]; if(!sf) return;
          try {
            const txt = await sf.text();
            const parser = new DOMParser();
            const svgDoc = parser.parseFromString(txt, "image/svg+xml");
            const svgEl  = svgDoc.querySelector("svg");
            if (!svgEl) { this._showToast("Ungültige SVG-Datei"); return; }

            // ── Szenario A: <rect>-Elemente (Inkscape, Illustrator) ───────────
            const rects = Array.from(svgDoc.querySelectorAll("rect")).filter(r =>
              parseFloat(r.getAttribute("width")||0) > 10 &&
              parseFloat(r.getAttribute("height")||0) > 10
            );
            if (rects.length > 0) {
              const vb = svgEl.getAttribute("viewBox")?.split(/[\s,]+/).map(Number) || [0,0,1000,1000];
              const vbW = vb[2]||1000, vbH = vb[3]||1000;
              const fw = this._data?.floor_w || 10;
              const fh = this._data?.floor_h || 10;
              const imported = rects.map((r,idx) => {
                const rx=parseFloat(r.getAttribute("x")||0), ry=parseFloat(r.getAttribute("y")||0);
                const rw=parseFloat(r.getAttribute("width")||10), rh=parseFloat(r.getAttribute("height")||10);
                const lbl = r.getAttribute("inkscape:label") || r.getAttribute("id") || ("Raum "+(idx+1));
                return { name: lbl,
                  x1: parseFloat(((rx/vbW)*fw).toFixed(2)),
                  y1: parseFloat(((ry/vbH)*fh).toFixed(2)),
                  x2: parseFloat((((rx+rw)/vbW)*fw).toFixed(2)),
                  y2: parseFloat((((ry+rh)/vbH)*fh).toFixed(2)),
                  color:"#1a2a3a", wall_color:"#00e5ff" };
              });
              this._pendingRooms = [...(this._pendingRooms||[]), ...imported];
              this._draw();
              this._showToast("✓ "+imported.length+" Räume aus SVG importiert (Inkscape-Modus)");
              this._rebuildSidebar();
              return;
            }

            // ── Szenario B: Eingebettetes Bild (SweetHome3D, SketchUp etc.) ──
            // Das SVG enthält ein base64-PNG/JPG – als Hintergrundbild laden
            const imgEl = svgDoc.querySelector("image");
            const href  = imgEl?.getAttribute("xlink:href") || imgEl?.getAttribute("href") || "";
            const b64Match = href.match(/^data:image\/(png|jpe?g|webp);base64,(.+)$/is);
            if (b64Match) {
              const ext = b64Match[1].replace("jpeg","jpg");
              const b64 = b64Match[2].replace(/\s/g,"");
              // Skaliere auf max 1200px (Backend erwartet jpg/png ≤5MB)
              const origImg = new Image();
              await new Promise((res,rej)=>{ origImg.onload=res; origImg.onerror=rej; origImg.src=href; });
              const MAX=1200;
              const scale=Math.min(1, MAX/Math.max(origImg.width||1, origImg.height||1));
              const oc=document.createElement("canvas");
              oc.width=Math.round((origImg.width||897)*scale);
              oc.height=Math.round((origImg.height||815)*scale);
              oc.getContext("2d").drawImage(origImg, 0, 0, oc.width, oc.height);
              const finalB64 = oc.toDataURL("image/jpeg",0.88).split(",")[1];
              // Upload als Hintergrundbild
              this._showToast("⏳ SVG-Bild wird hochgeladen...");
              await this._hass.callApi("POST", `ble_positioning/${this._entryId}/upload_image`,
                { image_b64: finalB64, ext: "jpg" });
              await this._loadData();
              this._rebuildSidebar();
              this._showToast("✓ SweetHome3D-Grundriss als Hintergrundbild geladen! Räume bitte manuell einzeichnen.");
              return;
            }

            // ── Szenario C: Externes Bild oder nur Vektoren ─────────────────
            // SVG selbst als Hintergrundbild rendern (über Canvas)
            const svgBlob = new Blob([txt], {type:"image/svg+xml"});
            const svgUrl  = URL.createObjectURL(svgBlob);
            const svgImg  = new Image();
            await new Promise((res,rej)=>{ svgImg.onload=res; svgImg.onerror=rej; svgImg.src=svgUrl; });
            URL.revokeObjectURL(svgUrl);
            const oc2=document.createElement("canvas");
            oc2.width=Math.min(svgImg.width||1000,1200);
            oc2.height=Math.round((svgImg.height||835)*(oc2.width/(svgImg.width||1000)));
            oc2.getContext("2d").drawImage(svgImg,0,0,oc2.width,oc2.height);
            const finalB64b = oc2.toDataURL("image/jpeg",0.88).split(",")[1];
            this._showToast("⏳ SVG wird gerendert und hochgeladen...");
            await this._hass.callApi("POST", `ble_positioning/${this._entryId}/upload_image`,
              { image_b64: finalB64b, ext: "jpg" });
            await this._loadData();
            this._rebuildSidebar();
            this._showToast("✓ SVG als Hintergrundbild geladen! Räume bitte manuell einzeichnen.");
          } catch(e) { this._showToast("SVG-Fehler: "+(e.message||e)); }
        });
        si.click();
      });
      imgBox.appendChild(svgBtn);
      fileBtn.addEventListener("click", () => {
        const inp = document.createElement("input");
        inp.type="file"; inp.accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml";
        inp.onchange = async () => {
          const file = inp.files[0]; if(!file) return;
          if(file.size > 5*1024*1024) { alert("Datei zu groß (max 5MB)"); return; }
          const ext = file.name.split(".").pop().toLowerCase();
          const b64 = await new Promise(res => { const r=new FileReader(); r.onload=()=>res(r.result.split(",")[1]); r.readAsDataURL(file); });
          // Resize image to max 1200px before upload to keep payload small
          try {
            const img = new Image();
            await new Promise((res, rej) => {
              img.onload = res; img.onerror = rej;
              img.src = "data:image/" + ext + ";base64," + b64;
            });
            const MAX = 1200;
            const scale = Math.min(1, MAX / Math.max(img.width, img.height));
            const oc = document.createElement("canvas");
            oc.width  = Math.round(img.width  * scale);
            oc.height = Math.round(img.height * scale);
            oc.getContext("2d").drawImage(img, 0, 0, oc.width, oc.height);
            b64 = oc.toDataURL("image/jpeg", 0.85).split(",")[1];
            ext = "jpg";
          } catch(_) { /* use original if resize fails */ }

          try {
            await this._hass.callApi(
              "POST",
              `ble_positioning/${this._entryId}/upload_image`,
              { image_b64: b64, ext }
            );
            await this._loadData();
            this._rebuildSidebar();
          } catch(err) {
            alert("Upload fehlgeschlagen: " + (err.message || err));
          }
        };
        inp.click();
      });
      imgBox.appendChild(fileBtn);
    }
    wrap.appendChild(imgBox);

    // ── SVG-Export (immer sichtbar wenn Räume vorhanden) ─────
    const rooms0 = this._pendingRooms || this._data?.rooms || [];
    if (rooms0.length > 0) {
      const svgExpBox = this._sbBox("Raumplan exportieren");
      const svgExpBtn = document.createElement("button");
      svgExpBtn.className = "btn btn-outline";
      svgExpBtn.style.cssText = "width:100%;margin-top:2px;font-size:9px";
      svgExpBtn.textContent = "💾 Als SVG herunterladen";
      svgExpBtn.title = "Speichert alle Räume, Zonen, Türen und Fenster als SVG-Vektordatei (Inkscape-kompatibel)";
      svgExpBtn.addEventListener("click", () => {
        try {
          const rooms   = this._pendingRooms   || this._data?.rooms   || [];
          const doors   = this._pendingDoors   || this._data?.doors   || [];
          const windows = this._pendingWindows || this._data?.windows || [];
          const fw = this._data?.floor_w || 10;
          const fh = this._data?.floor_h || 10;
          const SCALE = 100, SVG_W = Math.round(fw*SCALE), SVG_H = Math.round(fh*SCALE), PAD = 20;

          let svg = `<?xml version="1.0" encoding="UTF-8"?>\n`;
          svg += `<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"\n`;
          svg += `     width="${SVG_W+PAD*2}px" height="${SVG_H+PAD*2}px"\n`;
          svg += `     viewBox="${-PAD} ${-PAD} ${SVG_W+PAD*2} ${SVG_H+PAD*2}">\n`;
          svg += `  <title>BLE Positioning Raumplan</title>\n`;
          svg += `  <desc>Exportiert von BLE Positioning v${CARD_VERSION} – ${fw}m x ${fh}m</desc>\n\n`;

          svg += `  <rect x="${-PAD}" y="${-PAD}" width="${SVG_W+PAD*2}" height="${SVG_H+PAD*2}" fill="#07090d"/>\n`;
          svg += `  <rect x="0" y="0" width="${SVG_W}" height="${SVG_H}" fill="#0d1219" stroke="#1c2535" stroke-width="2"/>\n\n`;

          svg += `  <g stroke="#1c2535" stroke-width="0.5" opacity="0.5">\n`;
          for (let x=SCALE; x<SVG_W; x+=SCALE) svg += `    <line x1="${x}" y1="0" x2="${x}" y2="${SVG_H}"/>\n`;
          for (let y=SCALE; y<SVG_H; y+=SCALE) svg += `    <line x1="0" y1="${y}" x2="${SVG_W}" y2="${y}"/>\n`;
          svg += `  </g>\n\n`;

          svg += `  <g id="rooms">\n`;
          rooms.forEach((r, ri) => {
            const x1=r.x1*SCALE, y1=r.y1*SCALE, x2=r.x2*SCALE, y2=r.y2*SCALE;
            const rx=Math.round(Math.min(x1,x2)), ry=Math.round(Math.min(y1,y2));
            const rw=Math.round(Math.abs(x2-x1)), rh=Math.round(Math.abs(y2-y1));
            const fill=r.color||"#1a2a3a", wall=r.wall_color||"#00e5ff";
            const name=(r.name||`Raum ${ri+1}`).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
            const cx=rx+rw/2, cy=ry+rh/2;
            svg += `    <g id="room_${ri}_${(r.name||"r").replace(/[^a-zA-Z0-9]/g,"_")}" inkscape:label="${name}">\n`;
            svg += `      <rect x="${rx}" y="${ry}" width="${rw}" height="${rh}" fill="${fill}" fill-opacity="0.55" stroke="${wall}" stroke-width="2"/>\n`;
            (r.zones||[]).forEach((z,zi) => {
              const zx1=rx+(z.rx1||0)*rw, zy1=ry+(z.ry1||0)*rh;
              const zx2=rx+(z.rx2||1)*rw, zy2=ry+(z.ry2||1)*rh;
              const zn=(z.name||`Zone ${zi+1}`).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
              svg += `      <rect x="${Math.round(Math.min(zx1,zx2))}" y="${Math.round(Math.min(zy1,zy2))}" width="${Math.round(Math.abs(zx2-zx1))}" height="${Math.round(Math.abs(zy2-zy1))}" fill="none" stroke="#f59e0b" stroke-width="1" stroke-dasharray="4,3" opacity="0.75"/>\n`;
              svg += `      <text x="${Math.round((zx1+zx2)/2)}" y="${Math.round((zy1+zy2)/2)}" text-anchor="middle" dominant-baseline="middle" font-family="monospace" font-size="7" fill="#f59e0b">${zn}</text>\n`;
            });
            if (rw>20&&rh>14) {
              const fs=Math.min(14,Math.max(7,Math.floor(Math.min(rw,rh)/6)));
              svg += `      <text x="${Math.round(cx)}" y="${Math.round(cy-(rh>28?fs*0.55:0))}" text-anchor="middle" dominant-baseline="middle" font-family="'JetBrains Mono',monospace" font-size="${fs}" fill="#c8d8ec" font-weight="600">${name}</text>\n`;
              if (rh>28) {
                const dw=(Math.abs(r.x2-r.x1)).toFixed(1), dh=(Math.abs(r.y2-r.y1)).toFixed(1);
                svg += `      <text x="${Math.round(cx)}" y="${Math.round(cy+fs*0.65)}" text-anchor="middle" dominant-baseline="middle" font-family="monospace" font-size="${Math.max(6,fs-3)}" fill="#445566">${dw}x${dh}m</text>\n`;
              }
            }
            svg += `    </g>\n`;
          });
          svg += `  </g>\n\n`;

          if (doors.length) {
            svg += `  <g id="doors" stroke="#a78bfa" stroke-width="3" fill="none">\n`;
            doors.forEach((d,i) => svg += `    <line x1="${Math.round(d.x1*SCALE)}" y1="${Math.round(d.y1*SCALE)}" x2="${Math.round(d.x2*SCALE)}" y2="${Math.round(d.y2*SCALE)}" id="door_${i}"/>\n`);
            svg += `  </g>\n\n`;
          }
          if (windows.length) {
            svg += `  <g id="windows" stroke="#38bdf8" stroke-width="2" fill="none" stroke-dasharray="5,2">\n`;
            windows.forEach((w,i) => svg += `    <line x1="${Math.round(w.x1*SCALE)}" y1="${Math.round(w.y1*SCALE)}" x2="${Math.round(w.x2*SCALE)}" y2="${Math.round(w.y2*SCALE)}" id="window_${i}"/>\n`);
            svg += `  </g>\n\n`;
          }

          svg += `  <g transform="translate(10,${SVG_H-18})">\n`;
          svg += `    <rect x="0" y="0" width="${SCALE}" height="6" fill="none" stroke="#445566" stroke-width="1"/>\n`;
          svg += `    <rect x="0" y="0" width="${SCALE/2}" height="6" fill="#445566" fill-opacity="0.5"/>\n`;
          svg += `    <text x="${SCALE/2}" y="14" text-anchor="middle" font-family="monospace" font-size="8" fill="#445566">1 m</text>\n`;
          svg += `  </g>\n`;
          svg += `  <text x="${SVG_W}" y="${SVG_H+14}" text-anchor="end" font-family="monospace" font-size="7" fill="#445566">BLE Positioning v${CARD_VERSION} · ${fw}m x ${fh}m · ${rooms.length} Räume</text>\n`;
          svg += `</svg>`;

          const blob = new Blob([svg], {type:"image/svg+xml;charset=utf-8"});
          const url  = URL.createObjectURL(blob);
          const a    = document.createElement("a");
          a.href=url; a.download=`raumplan_${new Date().toISOString().slice(0,10)}.svg`;
          document.body.appendChild(a); a.click(); document.body.removeChild(a);
          URL.revokeObjectURL(url);
          this._showToast(`✓ SVG: ${rooms.length} Räume, ${doors.length} Türen, ${windows.length} Fenster`);
        } catch(e) { this._showToast("SVG-Export-Fehler: "+(e.message||e)); }
      });
      const rInfo = document.createElement("div");
      rInfo.style.cssText = "font-size:8px;color:#445566;margin-top:3px;text-align:center";
      rInfo.textContent = `${rooms0.length} Räume · ${(this._pendingDoors||this._data?.doors||[]).length} Türen · ${(this._pendingWindows||this._data?.windows||[]).length} Fenster`;
      svgExpBox.appendChild(svgExpBtn);
      svgExpBox.appendChild(rInfo);
      wrap.appendChild(svgExpBox);
    }

    // ── Map-size editor ──────────────────────────────────────
    const mapBox = this._sbBox("Grundriss-Größe");
    const fw = this._data?.floor_w || 10, fh = this._data?.floor_h || 10;
    mapBox.innerHTML += `
      <div class="sb-row"><span>Breite</span>
        <input id="map_w" type="number" step="0.5" min="1" max="100" value="${fw}"
          style="width:50px;background:var(--surf2);border:1px solid var(--border);color:var(--text);padding:2px 4px;border-radius:3px;font-family:inherit;font-size:9px;text-align:right">
        <span style="color:var(--muted);font-size:8px">m</span>
      </div>
      <div class="sb-row" style="margin-top:3px"><span>Höhe</span>
        <input id="map_h" type="number" step="0.5" min="1" max="100" value="${fh}"
          style="width:50px;background:var(--surf2);border:1px solid var(--border);color:var(--text);padding:2px 4px;border-radius:3px;font-family:inherit;font-size:9px;text-align:right">
        <span style="color:var(--muted);font-size:8px">m</span>
      </div>`;
    const mapHint = document.createElement("div");
    mapHint.style.cssText = "font-size:8px;color:var(--muted);margin-top:4px";
    mapHint.textContent = "Wird beim Speichern übernommen";
    mapBox.appendChild(mapHint);
    wrap.appendChild(mapBox);

    // ── Rooms box ───────────────────────────────────────────
    const box  = this._sbBox("Räume");

    // Submode toggle: draw vs edit
    const modeRow = document.createElement("div");
    modeRow.style.cssText = "display:flex;gap:4px;margin-bottom:6px";
    ["Zeichnen","Verschieben"].forEach((lbl, idx) => {
      const mode = idx === 0 ? "draw" : "edit";
      const b = document.createElement("button");
      b.style.cssText = "flex:1;padding:3px;border-radius:4px;font-family:inherit;font-size:8px;font-weight:700;cursor:pointer;border:none;transition:all .15s";
      b.textContent = lbl;
      const active = this._roomSubMode === mode;
      b.style.background = active ? (mode==="draw" ? "var(--purple)" : "var(--yellow)") : "var(--surf2)";
      b.style.color      = active ? "var(--bg)" : "var(--muted)";
      b.style.border     = `1px solid ${active ? "transparent" : "var(--border)"}`;
      b.addEventListener("click", () => { this._roomSubMode = mode; this._rebuildSidebar(); });
      modeRow.appendChild(b);
    });
    box.appendChild(modeRow);

    const hint = document.createElement("div");
    hint.style.cssText = "font-size:8px;color:var(--muted);margin-bottom:5px;line-height:1.5";
    hint.textContent = this._roomSubMode === "draw"
      ? "Rechteck ziehen → neuer Raum"
      : "Raum anklicken → ziehen zum Verschieben · Ecke ziehen zum Skalieren";
    box.appendChild(hint);

    const list = document.createElement("div"); list.className = "room-list";
    this._pendingRooms.forEach((r, i) => {
      const row = document.createElement("div");
      row.className = "room-entry" + (this._selRoomIdx === i ? " selected" : "");

      // Color picker swatch
      const colorWrap = document.createElement("div");
      colorWrap.style.cssText = "position:relative;width:22px;height:22px;flex-shrink:0;cursor:pointer;border-radius:4px;overflow:hidden;border:1px solid var(--border)";
      colorWrap.style.background = this._roomSolidColor(r.color);
      const colorInp = document.createElement("input");
      colorInp.type = "color";
      colorInp.value = this._roomHexColor(r.color);
      colorInp.style.cssText = "position:absolute;inset:-4px;opacity:0.01;width:140%;height:140%;cursor:pointer;padding:0;border:none";
      colorInp.addEventListener("input", () => {
        const hex = colorInp.value;
        r.color = `rgba(${parseInt(hex.slice(1,3),16)},${parseInt(hex.slice(3,5),16)},${parseInt(hex.slice(5,7),16)},0.22)`;
        colorWrap.style.background = this._roomSolidColor(r.color);
      });
      // Ensure touch opens color picker
      colorWrap.addEventListener("touchend", e => { e.preventDefault(); colorInp.click(); });
      colorWrap.appendChild(colorInp);

      // ── Raumtyp: indoor / outdoor ──────────────────────────────────────────
      const typeBtn = document.createElement("button");
      const isOutdoor = r.zone_type === "outdoor";
      typeBtn.title = isOutdoor ? "Außenbereich – klicken für Innenbereich" : "Innenbereich – klicken für Außenbereich";
      typeBtn.textContent = isOutdoor ? "🌿" : "🏠";
      typeBtn.style.cssText = "font-size:12px;background:"+(isOutdoor?"rgba(34,197,94,0.15)":"rgba(100,180,255,0.1)")+";border:1px solid "+(isOutdoor?"#22c55e":"var(--border)")+";border-radius:4px;width:22px;height:22px;cursor:pointer;flex-shrink:0;display:flex;align-items:center;justify-content:center;padding:0";
      typeBtn.addEventListener("click", () => {
        r.zone_type = r.zone_type === "outdoor" ? "indoor" : "outdoor";
        this._draw();
        this._rebuildSidebar();
      });

      // Name: show as text, click to edit
      const nameEl = document.createElement("div");
      nameEl.className = "room-entry-name";
      nameEl.style.cssText = "flex:1;overflow:hidden;cursor:text;";

      const nameSpan = document.createElement("span");
      const groupLabel = r.group_id ? ` [${r.group_name || "Gruppe"}]` : "";
      nameSpan.textContent = r.name + groupLabel;
      nameSpan.style.cssText = "font-size:9px;color:var(--text);display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;";

      const nameInp = document.createElement("input");
      nameInp.value = r.name;
      nameInp.style.cssText = "display:none;background:var(--surf2);border:1px solid var(--accent);border-radius:3px;color:var(--text);font-family:inherit;font-size:9px;width:100%;outline:none;padding:1px 3px;box-sizing:border-box";

      const startEdit = (e) => {
        e.stopPropagation();
        nameSpan.style.display = "none";
        nameInp.style.display  = "block";
        nameInp.focus();
        nameInp.select();
      };
      const stopEdit = () => {
        r.name = nameInp.value || r.name;
        nameSpan.textContent   = r.name;
        nameSpan.style.display = "block";
        nameInp.style.display  = "none";
      };
      nameSpan.addEventListener("click", startEdit);
      nameSpan.addEventListener("touchend", e => { e.preventDefault(); startEdit(e); });
      nameInp.addEventListener("blur",  stopEdit);
      nameInp.addEventListener("keydown", e => { if (e.key === "Enter") { stopEdit(); e.target.blur(); } });
      nameInp.addEventListener("input", () => { r.name = nameInp.value; });

      nameEl.append(nameSpan, nameInp);

      const del = document.createElement("button"); del.className = "room-entry-del"; del.textContent = "✕";
      del.addEventListener("click", e => {
        e.stopPropagation();
        if (!this._roomHistory) this._roomHistory = [];
        this._roomHistory.push(structuredClone(this._pendingRooms));
        if (this._roomHistory.length > 30) this._roomHistory.shift();
        this._pendingRooms.splice(i, 1);
        if (this._selRoomIdx === i) this._selRoomIdx = -1;
        this._rebuildSidebar();
      });

      // Zone toggle button
      const zoneBtn = document.createElement("button");
      const hasZones = r.zones && r.zones.length > 0;
      zoneBtn.textContent = "🗺";
      zoneBtn.title = "Zonen / Bereiche konfigurieren";
      zoneBtn.style.cssText = "font-size:10px;background:"+(hasZones?"rgba(167,139,250,0.2)":"var(--surf2)")+";border:1px solid "+(hasZones?"#a78bfa":"var(--border)")+";border-radius:4px;width:22px;height:22px;cursor:pointer;flex-shrink:0;display:flex;align-items:center;justify-content:center;padding:0";
      zoneBtn.addEventListener("click", e => {
        e.stopPropagation();
        this._zoneEditRoom = (this._zoneEditRoom === i) ? null : i;
        this._rebuildSidebar();
      });

      row.append(colorWrap, typeBtn, nameEl, zoneBtn, del);
      row.addEventListener("click", () => {
        this._selRoomIdx = (this._selRoomIdx === i) ? -1 : i;
        this._rebuildSidebar();
      });
      list.appendChild(row);

      // Inline Zone Editor
      if (this._zoneEditRoom === i) {
        const zPanel = document.createElement("div");
        zPanel.style.cssText = "background:rgba(167,139,250,0.08);border:1px solid rgba(167,139,250,0.3);border-radius:6px;padding:6px;margin-bottom:4px";
        // Room presence entity
        const rEntLbl = document.createElement("div");
        rEntLbl.style.cssText = "font-size:7px;color:#a78bfa;margin-bottom:3px;font-weight:700";
        rEntLbl.textContent = "Raum-Präsenz Entity";
        const rEntInp = document.createElement("input");
        rEntInp.placeholder = "binary_sensor.presence_raum";
        rEntInp.value = r.presence_entity || "";
        rEntInp.style.cssText = "width:100%;background:var(--surf2);border:1px solid var(--border);color:var(--text);border-radius:3px;padding:2px 4px;font-size:8px;box-sizing:border-box;margin-bottom:6px";
        rEntInp.addEventListener("input", () => { r.presence_entity = rEntInp.value.trim(); });
        zPanel.append(rEntLbl, rEntInp);
        // Zone list header
        const zHdr = document.createElement("div");
        zHdr.style.cssText = "font-size:7px;color:#a78bfa;font-weight:700;margin-bottom:3px;display:flex;justify-content:space-between;align-items:center";
        zHdr.innerHTML = "<span>Bereiche</span>";
        const addZBtn = document.createElement("button");
        addZBtn.textContent = "+ Zone";
        addZBtn.style.cssText = "font-size:7px;background:rgba(167,139,250,0.2);border:1px solid #a78bfa;color:#a78bfa;border-radius:3px;padding:1px 5px;cursor:pointer";
        addZBtn.addEventListener("click", e => {
          e.stopPropagation();
          if (!r.zones) r.zones = [];
          r.zones.push({ name: "Zone "+(r.zones.length+1), rx1:0.0, ry1:0.0, rx2:0.5, ry2:0.5, color:"#a78bfa", presence_entity:"" });
          this._rebuildSidebar();
        });
        zHdr.appendChild(addZBtn);
        zPanel.appendChild(zHdr);
        if (!r.zones) r.zones = [];
        r.zones.forEach((z, zi) => {
          const zRow = document.createElement("div");
          zRow.style.cssText = "background:var(--surf2);border:1px solid var(--border);border-radius:4px;padding:4px;margin-bottom:4px";
          const zTopRow = document.createElement("div");
          zTopRow.style.cssText = "display:flex;align-items:center;gap:4px;margin-bottom:3px";
          const zCW = document.createElement("div");
          zCW.style.cssText = "position:relative;width:18px;height:18px;border-radius:3px;overflow:hidden;border:1px solid var(--border);flex-shrink:0";
          zCW.style.background = z.color || "#a78bfa";
          const zCI = document.createElement("input"); zCI.type="color"; zCI.value=z.color||"#a78bfa";
          zCI.style.cssText = "position:absolute;inset:-4px;opacity:0.01;width:140%;height:140%;cursor:pointer";
          zCI.addEventListener("input", () => { z.color=zCI.value; zCW.style.background=z.color; });
          zCW.appendChild(zCI);
          const zNI = document.createElement("input"); zNI.placeholder="Schlafbereich"; zNI.value=z.name||"";
          zNI.style.cssText = "flex:1;background:var(--surf3);border:1px solid var(--border);color:var(--text);border-radius:3px;padding:1px 3px;font-size:8px";
          zNI.addEventListener("input", () => { z.name=zNI.value; });
          const zD = document.createElement("button"); zD.textContent="✕";
          zD.style.cssText = "background:none;border:none;color:var(--red);cursor:pointer;font-size:10px;padding:0;flex-shrink:0";
          zD.addEventListener("click", e => { e.stopPropagation(); r.zones.splice(zi,1); this._rebuildSidebar(); });
          zTopRow.append(zCW, zNI, zD);
          zRow.appendChild(zTopRow);
          // Position grid
          const zPL = document.createElement("div");
          zPL.style.cssText = "font-size:7px;color:var(--muted);margin-bottom:2px";
          zPL.textContent = "Position 0..1 (relativ zu Raumgröße)";
          zRow.appendChild(zPL);
          const zGrid = document.createElement("div");
          zGrid.style.cssText = "display:grid;grid-template-columns:1fr 1fr;gap:3px;margin-bottom:3px";
          [["X1","rx1"],["Y1","ry1"],["X2","rx2"],["Y2","ry2"]].forEach(([lbl,key]) => {
            const cell = document.createElement("div");
            cell.style.cssText = "display:flex;align-items:center;gap:2px";
            const l = document.createElement("span"); l.style.cssText="font-size:7px;color:var(--muted);min-width:14px"; l.textContent=lbl;
            const inp = document.createElement("input"); inp.type="number"; inp.min=0; inp.max=1; inp.step=0.05;
            inp.value = parseFloat((z[key]||0).toFixed(2));
            inp.style.cssText = "flex:1;background:var(--surf3);border:1px solid var(--border);color:var(--text);border-radius:3px;padding:1px 3px;font-size:8px;width:0";
            inp.addEventListener("input", () => { z[key]=parseFloat(inp.value)||0; this._draw(); });
            cell.append(l, inp); zGrid.appendChild(cell);
          });
          zRow.appendChild(zGrid);
          // Zone presence entity
          const zEL = document.createElement("div"); zEL.style.cssText="font-size:7px;color:var(--muted);margin-bottom:2px"; zEL.textContent="Präsenz Entity";
          const zEI = document.createElement("input"); zEI.placeholder="binary_sensor.zone_presence"; zEI.value=z.presence_entity||"";
          zEI.style.cssText = "width:100%;background:var(--surf3);border:1px solid var(--border);color:var(--text);border-radius:3px;padding:1px 3px;font-size:8px;box-sizing:border-box";
          zEI.addEventListener("input", () => { z.presence_entity=zEI.value.trim(); });
          zRow.append(zEL, zEI);
          zPanel.appendChild(zRow);
        });
        list.appendChild(zPanel);
      }
    });
    box.appendChild(list);

    // Group rooms button
    const groupBtn = document.createElement("button");
    groupBtn.className = "btn btn-outline"; groupBtn.style.cssText = "margin-bottom:3px;width:100%";
    groupBtn.textContent = "⊞ Räume verbinden (L-Form)";
    groupBtn.addEventListener("click", () => this._openGroupDialog());
    box.appendChild(groupBtn);

    wrap.appendChild(box);

    // ── Doors box ──────────────────────────────────────────────────────────
    const doorBox = this._sbBox("Türen");
    // Toggle: use doors for room-change penalty
    const penRow = document.createElement("div");
    penRow.style.cssText = "display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;padding:4px 6px;background:var(--surf2);border-radius:4px";
    const penLbl = document.createElement("span");
    penLbl.style.cssText = "font-size:8px;color:var(--text)";
    penLbl.textContent = "Raumwechsel nur durch Türen";
    const penTog = document.createElement("input");
    penTog.type = "checkbox"; penTog.checked = this._doorPenalty;
    penTog.style.cssText = "cursor:pointer;accent-color:var(--accent)";
    penTog.addEventListener("change", () => {
      this._doorPenalty = penTog.checked;
      // Send toggle to backend
      this._hass.callApi("POST", `ble_positioning/${this._entryId}/rooms`,
        { rooms: this._pendingRooms, doors: this._pendingDoors, windows: this._pendingWindows,
          door_penalty: this._doorPenalty }).catch(()=>{});
    });
    penRow.append(penLbl, penTog);
    doorBox.appendChild(penRow);

    const doorHint = document.createElement("div");
    doorHint.style.cssText = "font-size:8px;color:var(--muted);margin-bottom:5px;line-height:1.5";
    doorHint.textContent = this._pendingDoors.length === 0
      ? "Noch keine Türen. Platziere eine Tür auf der Karte."
      : "Türen: Gerät darf Raum nur wechseln wenn es nahe an einer Tür ist (≤1.5m).";
    doorBox.appendChild(doorHint);

    this._pendingDoors.forEach((d, i) => {
      const row = document.createElement("div");
      row.style.cssText = "display:flex;align-items:center;gap:4px;margin-bottom:3px;font-size:8px;";
      const lbl = document.createElement("span");
      lbl.style.cssText = "flex:1;color:var(--text);min-width:0";
      lbl.textContent = `Tür ${i+1}: ${d.connects?.[0]||"?"} ↔ ${d.connects?.[1]||"?"}`;
      // Entity input
      const eInp = document.createElement("input");
      eInp.style.cssText = "width:110px;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:3px;padding:2px 4px;font-size:8px";
      eInp.placeholder = "z.B. binary_sensor.tuer";
      eInp.value = d.entity_id || "";
      eInp.addEventListener("input", () => { this._pendingDoors[i].entity_id = eInp.value.trim(); });
      // Live state dot
      const stateDot = document.createElement("span");
      stateDot.style.cssText = "font-size:9px;min-width:12px;text-align:center";
      if (d.entity_id && this._hass?.states) {
        const s = this._hass.states[d.entity_id]?.state;
        stateDot.textContent = s === "open" || s === "on" ? "🟢" : s === "closed" || s === "off" ? "🔴" : "⚪";
      }
      const del = document.createElement("button");
      del.className = "room-entry-del"; del.textContent = "✕";
      del.addEventListener("click", () => { this._pendingDoors.splice(i,1); this._rebuildSidebar(); });
      // Mirror button
      const mirBtn = document.createElement("button");
      mirBtn.title = "Aufgehrichtung spiegeln";
      mirBtn.style.cssText = "background:none;border:1px solid var(--border);color:var(--muted);border-radius:3px;cursor:pointer;font-size:9px;padding:1px 4px;flex-shrink:0";
      mirBtn.textContent = d.mirrored ? "⇆✓" : "⇆";
      mirBtn.style.color = d.mirrored ? "var(--accent)" : "var(--muted)";
      mirBtn.style.borderColor = d.mirrored ? "var(--accent)" : "var(--border)";
      mirBtn.addEventListener("click", () => {
        this._pendingDoors[i].mirrored = !this._pendingDoors[i].mirrored;
        this._rebuildSidebar(); this._draw();
      });
      row.style.cssText = "display:grid;grid-template-columns:1fr 110px 12px auto 18px;align-items:center;gap:3px;margin-bottom:3px;font-size:8px;";
      row.append(lbl, eInp, stateDot, mirBtn, del);
      doorBox.appendChild(row);
    });

    const doorPlaceBtn = document.createElement("button");
    doorPlaceBtn.className = "btn " + (this._placingDoor ? "btn-yellow" : "btn-outline");
    doorPlaceBtn.style.width = "100%";
    doorPlaceBtn.textContent = this._placingDoor ? "✕ Tür-Platzierung abbrechen" : "📍 Tür platzieren";
    doorPlaceBtn.addEventListener("click", () => {
      this._placingDoor = !this._placingDoor;
      this._canvas.style.cursor = this._placingDoor ? "crosshair" : "default";
      this._rebuildSidebar();
    });
    doorBox.appendChild(doorPlaceBtn);

    if (this._placingDoor) {
      const ph = document.createElement("div");
      ph.style.cssText = "font-size:8px;color:var(--yellow);margin-top:4px;text-align:center";
      ph.textContent = "👆 Klicke auf die Türöffnung im Grundriss";
      doorBox.appendChild(ph);
    }
    wrap.appendChild(doorBox);

    // ── Fenster ──────────────────────────────────────────────────────────
    const winBox = document.createElement("div");
    winBox.style.cssText = "margin-top:10px";
    const winTitle = document.createElement("div");
    winTitle.style.cssText = "font-size:9px;font-weight:700;color:var(--accent);margin-bottom:5px;padding:4px 0;border-top:1px solid var(--border)";
    winTitle.textContent = "FENSTER";
    winBox.appendChild(winTitle);

    this._pendingWindows.forEach((w, i) => {
      const wrap2 = document.createElement("div");
      wrap2.style.cssText = "background:var(--surf2);border-radius:5px;padding:5px 6px;margin-bottom:4px;border:1px solid var(--border)";

      // Header row: label + type toggle + del
      const hdr2 = document.createElement("div");
      hdr2.style.cssText = "display:flex;align-items:center;gap:4px;margin-bottom:4px";
      const lbl = document.createElement("span");
      lbl.style.cssText = "flex:1;color:var(--text);font-size:8px;font-weight:700";
      lbl.textContent = `Fenster ${i+1}`;

      // Type selector: Fenster / Fenster+Rollo
      const typeSel = document.createElement("select");
      typeSel.style.cssText = "background:var(--surf3);border:1px solid var(--border);color:var(--text);border-radius:3px;font-size:7px;padding:1px 3px";
      [["window","🪟 Fenster"],["shutter","🪟+🔲 Rollo"]].forEach(([v,t]) => {
        const o = document.createElement("option"); o.value=v; o.textContent=t;
        if ((w.type||"window")===v) o.selected=true;
        typeSel.appendChild(o);
      });
      typeSel.addEventListener("change", () => {
        this._pendingWindows[i].type = typeSel.value;
        this._rebuildSidebar();
      });

      const del = document.createElement("button");
      del.className = "room-entry-del"; del.textContent = "✕";
      del.addEventListener("click", () => { this._pendingWindows.splice(i,1); this._rebuildSidebar(); });
      hdr2.append(lbl, typeSel, del);
      wrap2.appendChild(hdr2);

      // Window entity row
      const wRow = document.createElement("div");
      wRow.style.cssText = "display:flex;align-items:center;gap:4px;margin-bottom:3px";
      const wLbl = document.createElement("span"); wLbl.textContent="Fenster"; wLbl.style.cssText="font-size:7px;color:var(--muted);width:42px;flex-shrink:0";
      const eInp = document.createElement("input");
      eInp.style.cssText = "flex:1;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:3px;padding:2px 4px;font-size:8px";
      eInp.placeholder = "binary_sensor.fenster";
      eInp.value = w.entity_id || "";
      eInp.addEventListener("input", () => { this._pendingWindows[i].entity_id = eInp.value.trim(); });
      const stateDot = document.createElement("span");
      stateDot.style.cssText = "font-size:9px;flex-shrink:0";
      if (w.entity_id && this._hass?.states) {
        const s = this._hass.states[w.entity_id]?.state;
        stateDot.textContent = s==="open"||s==="on" ? "🟢" : s==="tilted" ? "🟠" : s==="closed"||s==="off" ? "🔴" : "⚪";
      }
      wRow.append(wLbl, eInp, stateDot);
      wrap2.appendChild(wRow);

      // Cover entity row (only for shutter type)
      if ((w.type||"window") === "shutter") {
        const cRow = document.createElement("div");
        cRow.style.cssText = "display:flex;align-items:center;gap:4px";
        const cLbl = document.createElement("span"); cLbl.textContent="Rollo"; cLbl.style.cssText="font-size:7px;color:var(--muted);width:42px;flex-shrink:0";
        const cInp = document.createElement("input");
        cInp.style.cssText = "flex:1;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:3px;padding:2px 4px;font-size:8px";
        cInp.placeholder = "cover.rollo";
        cInp.value = w.cover_entity || "";
        cInp.addEventListener("input", () => { this._pendingWindows[i].cover_entity = cInp.value.trim(); });
        // Position display
        const posDot = document.createElement("span");
        posDot.style.cssText = "font-size:8px;color:var(--accent);flex-shrink:0;min-width:28px;text-align:right";
        if (w.cover_entity && this._hass?.states) {
          const cs = this._hass.states[w.cover_entity];
          const pos = cs?.attributes?.current_position;
          posDot.textContent = pos !== undefined ? `${pos}%` : "⚪";
        }
        cRow.append(cLbl, cInp, posDot);
        wrap2.appendChild(cRow);
      }

      winBox.appendChild(wrap2);
    });

    const winPlaceBtn = document.createElement("button");
    winPlaceBtn.className = "btn " + (this._placingWindow ? "btn-blue" : "btn-outline");
    winPlaceBtn.style.width = "100%";
    winPlaceBtn.textContent = this._placingWindow ? "✕ Fenster-Platzierung abbrechen" : "📍 Fenster platzieren";
    winPlaceBtn.addEventListener("click", () => {
      this._placingWindow = !this._placingWindow;
      this._placingDoor = false;
      this._canvas.style.cursor = this._placingWindow ? "crosshair" : "default";
      this._rebuildSidebar();
    });
    winBox.appendChild(winPlaceBtn);

    if (this._placingWindow) {
      const ph = document.createElement("div");
      ph.style.cssText = "font-size:8px;color:var(--accent);margin-top:4px;text-align:center";
      ph.textContent = "👆 Klicke auf die Fensteröffnung im Grundriss";
      winBox.appendChild(ph);
    }
    wrap.appendChild(winBox);

    // ── Hauptspeicher-Button ─────────────────────────────────────────
    const mainSaveBtn = document.createElement("button");
    mainSaveBtn.className = "btn btn-green";
    mainSaveBtn.style.cssText = "width:100%;margin-top:14px;padding:9px;font-size:10px;font-weight:700;letter-spacing:0.5px";
    mainSaveBtn.textContent = "💾 Raumbearbeitung speichern";
    mainSaveBtn.addEventListener("click", () => this._saveRooms());
    wrap.appendChild(mainSaveBtn);

    return wrap;
  }

  _openGroupDialog() {
    const rooms = this._pendingRooms;
    if (rooms.length < 2) { this._showToast("Mindestens 2 Räume nötig"); return; }
    const overlay = document.createElement("div");
    overlay.style.cssText = "position:fixed;inset:0;background:rgba(7,9,13,0.88);display:flex;align-items:center;justify-content:center;z-index:9999;";
    const dlg = document.createElement("div");
    dlg.style.cssText = "background:var(--surf);border:1px solid var(--border);border-radius:10px;padding:18px;width:260px;";

    const title = document.createElement("div");
    title.style.cssText = "font-size:11px;font-weight:700;color:var(--accent);margin-bottom:10px";
    title.textContent = "⊞ Räume verbinden (L-Form)";
    dlg.appendChild(title);

    const info = document.createElement("div");
    info.style.cssText = "font-size:8px;color:var(--muted);margin-bottom:10px;line-height:1.5";
    info.textContent = "Diese zwei Räume gelten dann als ein logischer Raum (z.B. L-förmiges Wohn/Esszimmer).";
    dlg.appendChild(info);

    const sel1 = document.createElement("select");
    const sel2 = document.createElement("select");
    [sel1,sel2].forEach((s,si) => {
      s.style.cssText = "width:100%;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:4px;font-size:9px;margin-bottom:6px;box-sizing:border-box";
      rooms.forEach((r,i) => {
        const o = document.createElement("option");
        o.value = i;
        o.textContent = r.group_name ? `${r.name} [${r.group_name}]` : r.name;
        if (i === si) o.selected = true;
        s.appendChild(o);
      });
      dlg.appendChild(s);
    });

    const nameLbl = document.createElement("div");
    nameLbl.style.cssText = "font-size:8px;color:var(--muted);margin-bottom:3px";
    nameLbl.textContent = "Gemeinsamer Anzeige-Name (optional):";
    dlg.appendChild(nameLbl);

    const nameInp = document.createElement("input");
    nameInp.style.cssText = "width:100%;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:4px;font-size:9px;margin-bottom:10px;box-sizing:border-box";
    nameInp.placeholder = "z.B. Wohnküche";
    dlg.appendChild(nameInp);

    const btns = document.createElement("div");
    btns.style.cssText = "display:flex;gap:5px";

    const ok = document.createElement("button");
    ok.className = "btn btn-green"; ok.style.flex="1"; ok.textContent = "✓ Verbinden";
    const split = document.createElement("button");
    split.className = "btn btn-red"; split.style.flex="1"; split.textContent = "✗ Trennen";
    const cancel = document.createElement("button");
    cancel.className = "btn btn-outline"; cancel.style.flex="1"; cancel.textContent = "Abbruch";

    ok.addEventListener("click", () => {
      const i1 = parseInt(sel1.value), i2 = parseInt(sel2.value);
      if (i1 === i2) { this._showToast("Bitte zwei verschiedene Räume wählen"); return; }
      const gid = `grp_${Date.now()}`;
      const gname = nameInp.value.trim() || `${rooms[i1].name} + ${rooms[i2].name}`;
      rooms[i1].group_id = gid; rooms[i1].group_name = gname;
      rooms[i2].group_id = gid; rooms[i2].group_name = gname;
      overlay.remove(); this._rebuildSidebar();
      this._showToast(`✓ Verbunden als "${gname}"`);
    });
    split.addEventListener("click", () => {
      const i1 = parseInt(sel1.value), i2 = parseInt(sel2.value);
      [i1,i2].forEach(i => { delete rooms[i].group_id; delete rooms[i].group_name; });
      overlay.remove(); this._rebuildSidebar();
      this._showToast("Räume getrennt");
    });
    cancel.addEventListener("click", () => overlay.remove());

    btns.append(ok, split, cancel);
    dlg.appendChild(btns);
    overlay.appendChild(dlg);
    this.shadowRoot.appendChild(overlay);
  }

  // ── Sidebar helpers ──────────────────────────────────────────────────────

  _sbBox(title) {
    const div = document.createElement("div"); div.className = "sb-box";
    div.innerHTML = `<div class="sb-title">${title}</div>`;
    return div;
  }

  _deviceSelector() {
    const box = this._sbBox("Gerät");
    const sel = document.createElement("select");
    sel.style.cssText = "width:100%;background:var(--surf2);border:1px solid var(--border);color:var(--text);padding:3px 5px;border-radius:4px;font-family:inherit;font-size:9px;margin-top:2px";
    (this._data?.devices || []).forEach(d => {
      const opt = document.createElement("option");
      opt.value = d.device_id; opt.textContent = d.device_name;
      if (d.device_id === this._devId) opt.selected = true;
      sel.appendChild(opt);
    });
    sel.addEventListener("change", () => { this._devId = sel.value; this._rebuildSidebar(); });
    box.appendChild(sel);
    return box;
  }

  _updateSidebarLive() {
    if (!this._data || this._mode !== "view") return;
    this._updateSidebarFromData(this._data.devices || []);
    this._updateMmwavePersonsSidebar();
  }

  // ── mmWave Personen Live-Update ────────────────────────────────────────────
  _updateMmwavePersonsSidebar() {
    const sr = this.shadowRoot;
    if (!sr) return;
    const sensors = (this._pendingMmwave?.length > 0 ? this._pendingMmwave : this._data?.mmwave_sensors) || [];
    if (!sensors.length) return;

    // Alle aktiven Targets über alle Sensoren sammeln
    const allPersons = [];
    sensors.forEach(sensor => {
      if (sensor.mx == null || sensor.my == null) return;
      const numTargets = sensor.targets || 3;
      let sensorCount = 0;
      for (let ti = 1; ti <= numTargets; ti++) {
        const target = this._getMmwaveTarget ? this._getMmwaveTarget(sensor, ti) : null;
        if (!target || !target.present) continue;
        sensorCount++;
        const tName = (sensor.target_names || [])[ti-1] || ("Person " + ti);
        const tCol  = ["#ff6b35","#00e5ff","#22c55e"][ti-1] || "#a78bfa";
        const room  = this._getRoomForPoint ? this._getRoomForPoint(target.floor_mx, target.floor_my) : null;
        const roomName = room?.name || "Unbekannter Raum";
        // Zone
        const zone = this._getMmwaveZoneForTarget ? this._getMmwaveZoneForTarget(sensor, target) : "";
        // Distanz Sensor→Person
        const dx = target.floor_mx - (sensor.mx || 0);
        const dy = target.floor_my - (sensor.my || 0);
        const dist = Math.sqrt(dx*dx + dy*dy).toFixed(2);
        // Klasse + Haltung
        const clsResult = this._mmwaveClassify ? this._mmwaveClassify(sensor, target) : { cls:"unknown", confidence:0 };
        const clsInfo   = this._mmwaveClasses  ? this._mmwaveClasses()[clsResult.cls] : null;
        const posture   = this._mmwaveDetectPosture ? this._mmwaveDetectPosture(sensor, target) : "unknown";
        const fallState = (this._mmwaveFallState||{})[sensor.id+"_"+target.id];
        allPersons.push({
          tName, tCol, roomName, zone, dist, speed: target.speed || 0,
          moving: target.moving, clsResult, clsInfo, posture, fallState,
          sensorName: sensor.name || sensor.id, sensorId: sensor.id,
          floor_mx: target.floor_mx, floor_my: target.floor_my,
        });
      }
      // Sensor-Zähler aktualisieren
      const sEl = sr.getElementById(`mmw_sens_${sensor.id}_cnt`);
      if (sEl) sEl.textContent = sensorCount + " P";
    });

    // Gesamt-Zähler
    const totalEl = sr.getElementById("mmw_total_count");
    if (totalEl) totalEl.textContent = allPersons.length;

    // Personen-Karten neu rendern
    const container = sr.getElementById("mmw_persons_container");
    if (!container) return;
    container.innerHTML = "";

    if (allPersons.length === 0) {
      const emptyEl = document.createElement("div");
      emptyEl.style.cssText = "text-align:center;padding:8px;font-size:9px;color:#445566;font-style:italic";
      emptyEl.textContent = "Keine Personen erkannt";
      container.appendChild(emptyEl);
      return;
    }

    allPersons.forEach((p, idx) => {
      const card = document.createElement("div");
      const isAlarm = p.fallState?.phase === "alarm";
      card.style.cssText = `border-radius:6px;border:1px solid ${isAlarm ? "#ef4444" : p.tCol+"44"};
        background:${isAlarm ? "rgba(239,68,68,0.12)" : "#07090d"};padding:6px 8px;`;

      // ── Header: Name + Klasse-Icon ──────────────────────────────────────
      const hdr = document.createElement("div");
      hdr.style.cssText = "display:flex;align-items:center;justify-content:space-between;margin-bottom:4px";
      const nameSpan = document.createElement("div");
      nameSpan.style.cssText = `font-size:10px;font-weight:700;color:${p.tCol};font-family:'JetBrains Mono',monospace;display:flex;align-items:center;gap:4px`;
      const clsIcon = p.clsInfo?.icon || (p.clsResult.cls !== "unknown" ? "👤" : "❓");
      nameSpan.innerHTML = `<span style="font-size:12px">${clsIcon}</span>${p.tName}`;
      const statusBadge = document.createElement("span");
      statusBadge.style.cssText = `font-size:8px;padding:2px 5px;border-radius:10px;font-weight:700;
        background:${isAlarm ? "#ef4444" : (p.moving ? p.tCol+"33" : "#1c2535")};
        color:${isAlarm ? "#fff" : (p.moving ? p.tCol : "#445566")}`;
      statusBadge.textContent = isAlarm ? "🆘 STURZ" : (p.moving ? "▶ bewegt" : "● still");
      hdr.appendChild(nameSpan);
      hdr.appendChild(statusBadge);
      card.appendChild(hdr);

      // ── Raum + Zone ─────────────────────────────────────────────────────
      const roomRow = document.createElement("div");
      roomRow.style.cssText = "display:flex;align-items:center;gap:6px;margin-bottom:3px";
      roomRow.innerHTML = `<span style="font-size:10px">🏠</span>
        <span style="font-size:10px;font-weight:700;color:#c8d8ec;flex:1">${p.roomName}</span>
        ${p.zone ? `<span style="font-size:8px;padding:1px 5px;border-radius:8px;background:#a78bfa22;color:#a78bfa">${p.zone}</span>` : ""}`;
      card.appendChild(roomRow);

      // ── Sensor + Distanz ────────────────────────────────────────────────
      const sensRow = document.createElement("div");
      sensRow.style.cssText = "display:flex;justify-content:space-between;margin-bottom:3px";
      sensRow.innerHTML = `
        <div style="display:flex;align-items:center;gap:4px">
          <span style="font-size:9px">📡</span>
          <span style="font-size:9px;color:#94a3b8">${p.sensorName}</span>
        </div>
        <span style="font-size:9px;font-weight:700;color:${p.tCol};font-family:'JetBrains Mono',monospace">${p.dist}m</span>`;
      card.appendChild(sensRow);

      // ── Detail-Zeile: Haltung + Geschwindigkeit ─────────────────────────
      const detailRow = document.createElement("div");
      detailRow.style.cssText = "display:flex;gap:6px;flex-wrap:wrap;margin-top:2px";
      // Haltung
      if (p.posture && p.posture !== "unknown") {
        const postureIcon = { standing:"🧍",sitting:"🪑",lying:"🛌" }[p.posture] || "👤";
        const postureEl = document.createElement("span");
        postureEl.style.cssText = "font-size:8px;padding:1px 5px;border-radius:8px;background:#1c2535;color:#94a3b8;display:flex;align-items:center;gap:2px";
        postureEl.innerHTML = `${postureIcon} ${p.posture}`;
        detailRow.appendChild(postureEl);
      }
      // Geschwindigkeit
      if (Math.abs(p.speed) > 0.05) {
        const speedEl = document.createElement("span");
        speedEl.style.cssText = "font-size:8px;padding:1px 5px;border-radius:8px;background:#1c253588;color:#00e5ff;font-family:'JetBrains Mono',monospace";
        speedEl.textContent = `${p.speed.toFixed(1)} m/s`;
        detailRow.appendChild(speedEl);
      }
      // Klassen-Konfidenz
      if (p.clsResult.cls !== "unknown" && p.clsResult.confidence > 0.4) {
        const confEl = document.createElement("span");
        const confPct = Math.round(p.clsResult.confidence * 100);
        confEl.style.cssText = `font-size:8px;padding:1px 5px;border-radius:8px;background:${(p.clsInfo?.color||p.tCol)+"22"};color:${p.clsInfo?.color||p.tCol}`;
        confEl.textContent = `${p.clsInfo?.label || p.clsResult.cls} ${confPct}%`;
        detailRow.appendChild(confEl);
      }
      if (detailRow.children.length > 0) card.appendChild(detailRow);

      // ── Positions-Bar (visuell wo auf Grundriss) ────────────────────────
      const posBar = document.createElement("div");
      posBar.style.cssText = "margin-top:4px;font-size:7.5px;color:#445566;display:flex;justify-content:space-between";
      posBar.innerHTML = `<span>📍 ${p.floor_mx?.toFixed(1)}m / ${p.floor_my?.toFixed(1)}m</span>
        <span style="color:#1c2535">${p.sensorName}</span>`;
      card.appendChild(posBar);

      container.appendChild(card);
    });
  }

  // ── Canvas setup ─────────────────────────────────────────────────────────

  _loadBgImage() {
    const path = this._data?.image_path;
    // Generation-Counter verhindert Race Condition bei schnellen Floor-Wechseln
    const gen = (this._bgGeneration = (this._bgGeneration || 0) + 1);
    if (path) {
      // Always create a fresh Image object to avoid cached-onload issues
      const img = new Image();
      img.onload  = () => {
        if (gen !== this._bgGeneration) return; // Veraltetes Bild verwerfen
        this._bgImg = img;
        this._bgLoaded = true;
        this._onResize();
      };
      img.onerror = (e) => {
        if (gen !== this._bgGeneration) return;
        console.warn("BLE: floor image failed to load:", `/local/${path}`, e);
        this._bgLoaded = false;
        this._onResize();
      };
      // Add cache-busting to force reload after upload
      img.src = `/local/${path}?t=${Date.now()}`;
    } else {
      this._bgImg    = new Image();
      this._bgLoaded = false;
      this._onResize();
    }
  }

  _onResize() {
    const wrap = this.shadowRoot.getElementById("cwrap");
    if (!wrap || !this._canvas) return;

    // ── Auto-Sidebar-Breite nach Gesamtkartenbreite ──
    const cardEl = this.shadowRoot.querySelector(".card");
    if (cardEl) {
      const totalW = cardEl.offsetWidth;
      const sbW = totalW > 1400 ? 320
                : totalW > 1100 ? 280
                : totalW > 800  ? 240
                : totalW > 500  ? 200
                :                 170;
      const sb = this.shadowRoot.getElementById("sidebar");
      if (sb) sb.style.width = sbW + "px";
    }

    // Use offsetWidth/offsetHeight - more reliable in Shadow DOM than clientWidth
    const maxW = Math.max(wrap.offsetWidth  - 8, 200);
    const maxH = Math.max(wrap.offsetHeight - 8, 200);
    if (this._bgLoaded && this._bgImg.naturalWidth) {
      const ratio = this._bgImg.naturalWidth / this._bgImg.naturalHeight;
      const w = Math.min(maxW, maxH * ratio);
      this._canvas.width  = Math.max(w, 100);
      this._canvas.height = Math.max(w / ratio, 100);
    } else {
      this._canvas.width  = maxW;
      this._canvas.height = maxH;
    }
  }

  _attachCanvasEvents() {
    const c = this._canvas;
    c.addEventListener("click",      this._onCanvasClick);
    c.addEventListener("mousemove",  this._onCanvasMove);
    c.addEventListener("mousedown",  this._onCanvasDown);
    c.addEventListener("mouseup",    this._onCanvasUp);
    c.addEventListener("mouseleave", this._onCanvasLeave);
    c.addEventListener("wheel",      this._onWheel.bind(this), { passive: false });
    // Touch support
    c.addEventListener("touchstart", e => {
      e.preventDefault();
      if (e.touches.length === 2) { this._onTouchStart(e); return; }
      this._onCanvasDown(this._touchToMouse(e));
    }, { passive: false });
    c.addEventListener("touchmove", e => {
      e.preventDefault();
      if (e.touches.length === 2) { this._onTouchMove(e); return; }
      // Single finger: orbit in 3D, pan in 2D
      this._onCanvasMove(this._touchToMouse(e));
    }, { passive: false });
    c.addEventListener("touchend", e => {
      e.preventDefault();
      this._onTouchEnd(e);
      if (this._pinchDist != null) { this._pinchDist = null; return; }
      const m = this._touchToMouse(e);
      this._onCanvasUp(m);
      this._onCanvasClick(m);
    }, { passive: false });

    // Ctrl+Z Undo für Räume/Zonen
    this._keydownHandler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && this._mode === "rooms") {
        e.preventDefault();
        if (this._roomHistory && this._roomHistory.length > 0) {
          const snap = this._roomHistory.pop();
          this._pendingRooms = snap;
          this._rebuildSidebar();
          this._draw();
          this._showToast("Rückgängig ✓");
        }
      }
      // Space = pan mode (like most design tools)
      if (e.code === "Space" && !e.repeat && e.target === document.body) {
        e.preventDefault();
        this._spaceHeld = true;
        if (this._canvas) this._canvas.style.cursor = "grab";
      }
    };
    this._keyupHandler = (e) => {
      if (e.code === "Space") {
        this._spaceHeld = false;
        if (this._canvas && !this._isPanning) this._canvas.style.cursor = "";
      }
    };
    document.addEventListener("keydown", this._keydownHandler);
    document.addEventListener("keyup",   this._keyupHandler);
  }

  _touchToMouse(e) {
    const t = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]);
    if (!t) return { clientX: 0, clientY: 0, preventDefault: () => {} };
    return {
      clientX: t.clientX,
      clientY: t.clientY,
      preventDefault: () => {},
      _isTouch: true,
    };
  }

  // ── Canvas coordinate helpers ────────────────────────────────────────────

  _f2c(mx, my) {
    const d = this._data;
    if (!d) return { x: 0, y: 0 };
    if (!isFinite(mx) || !isFinite(my)) return { x: 0, y: 0 }; // NaN-Guard
    const W = this._canvas.width, H = this._canvas.height;
    const fw = d.floor_w || 10, fh = d.floor_h || 10;
    const baseX = (mx / fw) * W;
    const baseY = (my / fh) * H;
    if (!this._opts?.zoomPan || (this._zoom||1) === 1) return { x: baseX, y: baseY };
    const z   = this._zoom || 1;
    const dpr = window.devicePixelRatio || 1;
    const panXcv = (this._panX||0) * dpr;
    const panYcv = (this._panY||0) * dpr;
    return {
      x: W/2 + panXcv + (baseX - W/2) * z,
      y: H/2 + panYcv + (baseY - H/2) * z,
    };
  }
  _f2cBase(mx, my) {
    // Raw without zoom – used internally
    const d = this._data;
    if (!d) return { x: 0, y: 0 };
    const W = this._canvas.width, H = this._canvas.height;
    const fw = d.floor_w || 10, fh = d.floor_h || 10;
    return { x: (mx / fw) * W, y: (my / fh) * H };
  }

  _c2f(cx, cy) {
    const d = this._data;
    if (!d) return { mx: 0, my: 0 };
    const W = this._canvas.width, H = this._canvas.height;
    const fw = d.floor_w || 10, fh = d.floor_h || 10;
    if (!this._opts?.zoomPan || (this._zoom||1) === 1) {
      return { mx: (cx / W) * fw, my: (cy / H) * fh };
    }
    const z   = this._zoom || 1;
    const dpr = window.devicePixelRatio || 1;
    const panXcv = (this._panX||0) * dpr;
    const panYcv = (this._panY||0) * dpr;
    const baseX = (cx - W/2 - panXcv) / z + W/2;
    const baseY = (cy - H/2 - panYcv) / z + H/2;
    return { mx: (baseX / W) * fw, my: (baseY / H) * fh };
  }
  _canvasXY(e) {
    const r = this._canvas.getBoundingClientRect();
    // Scale for CSS vs actual canvas resolution
    const scaleX = this._canvas.width  / r.width;
    const scaleY = this._canvas.height / r.height;
    return {
      cx: (e.clientX - r.left) * scaleX,
      cy: (e.clientY - r.top)  * scaleY,
    };
  }

  // ── Grid ─────────────────────────────────────────────────────────────────


  // Wizard Raster-Verfeinerung: 2m → 1m wenn alle groben Punkte kalibriert

  // Berechne optimalen Rasterschritt für einen Raum sodass >= minPts Punkte entstehen

  // Gibt den am weitesten entfernten noch-nicht-kalibrierten Rasterpunkt
  // im aktuellen Wizard-Raum zurück (von zuletzt kalibriertem Punkt aus)
  _wizardNextPoint(fromMx, fromMy) {
    if (!this._wizardMode || this._wizardRoom === null) return null;
    const rooms = this._data?.rooms || [];
    const room  = rooms[this._wizardRoom];
    if (!room) return null;

    let best = null, bestDist = -1;
    for (const pt of this._gridPts) {
      // Nur Punkte im aktiven Wizard-Raum
      if (pt.mx < room.x1 - 0.01 || pt.mx > room.x2 + 0.01) continue;
      if (pt.my < room.y1 - 0.01 || pt.my > room.y2 + 0.01) continue;
      // Noch nicht kalibriert?
      if (this._hasFpAt(pt.mx, pt.my)) continue;
      const d = Math.hypot(pt.mx - fromMx, pt.my - fromMy);
      if (d > bestDist) { bestDist = d; best = pt; }
    }
    return best;
  }

  _wizardOptimalStep(room, minPts = 5) {
    const w = room.x2 - room.x1;
    const h = room.y2 - room.y1;
    for (const step of [2.0, 1.5, 1.0, 0.75, 0.5, 0.25]) {
      let pts = 0;
      for (let y = room.y1; y <= room.y2 + 1e-6; y = Math.round((y + step) * 1000) / 1000) {
        for (let x = room.x1; x <= room.x2 + 1e-6; x = Math.round((x + step) * 1000) / 1000) {
          pts++;
        }
      }
      if (pts >= minPts) return step;
    }
    return 0.25;
  }

  _checkWizardRefinement() {
    if (!this._wizardMode || this._wizardRoom === null) return;
    if (!this._wizardGridStep || this._wizardGridStep <= 1.0) return;  // bereits verfeinert

    const rooms  = this._data?.rooms || [];
    const room   = rooms[this._wizardRoom];
    if (!room) return;

    // Baue temporäres Grob-Raster für diesen Raum
    const step = this._wizardGridStep;
    const coarseUncal = [];
    for (let y = room.y1; y <= room.y2 + 1e-6; y = Math.round((y + step) * 1000) / 1000) {
      for (let x = room.x1; x <= room.x2 + 1e-6; x = Math.round((x + step) * 1000) / 1000) {
        const mx = parseFloat(x.toFixed(2)), my = parseFloat(y.toFixed(2));
        const key = `${mx}_${my}`;
        const hasFp = this._hasFpAt(mx, my);
        if (!hasFp) coarseUncal.push({ mx, my });
      }
    }

    // Alle Grob-Punkte kalibriert → auf nächst-feineren Schritt wechseln
    if (coarseUncal.length === 0) {
      const steps = [2.0, 1.5, 1.0, 0.75, 0.5, 0.25];
      const curIdx = steps.indexOf(this._wizardGridStep);
      const nextStep = curIdx >= 0 && curIdx < steps.length - 1
        ? steps[curIdx + 1]
        : null;
      if (nextStep !== null) {
        // Prüfe ob nächster Schritt noch neue unkalibrierte Punkte bringt
        let newPts = 0;
        for (let y = room.y1; y <= room.y2 + 1e-6; y = Math.round((y + nextStep) * 1000) / 1000) {
          for (let x = room.x1; x <= room.x2 + 1e-6; x = Math.round((x + nextStep) * 1000) / 1000) {
            const mx2 = parseFloat(x.toFixed(2)), my2 = parseFloat(y.toFixed(2));
            if (!this._hasFpAt(mx2, my2)) newPts++;
          }
        }
        if (newPts > 0) {
          this._wizardGridStep = nextStep;
          this._buildGrid();
          this._showCalStatus(`🔍 Raster verfeinert: ${nextStep}m-Schritte`, 'var(--accent)');
          this._rebuildSidebar();
        }
      }
    }
  }

  _buildGrid() {
    const d = this._data;
    if (!d) return;
    // Im Wizard-Modus: wizardGridStep überschreibt globalen grid_step
    const step = (this._wizardMode && this._wizardGridStep)
      ? this._wizardGridStep
      : (d.grid_step || 0.5);
    const W = d.floor_w || 10, H = d.floor_h || 10;
    const rooms = d.rooms || [];
    const pts = [];
    for (let y = 0; y <= H + 1e-6; y = Math.round((y + step) * 1000) / 1000) {
      for (let x = 0; x <= W + 1e-6; x = Math.round((x + step) * 1000) / 1000) {
        const mx = parseFloat(x.toFixed(2)), my = parseFloat(y.toFixed(2));
        if (this._inAnyRoom(mx, my, rooms)) pts.push({ mx, my });
      }
    }
    this._gridPts = pts;
  }

  _inAnyRoom(mx, my, rooms) {
    if (!rooms || rooms.length === 0) return true;
    return rooms.some(r => mx >= r.x1 && mx <= r.x2 && my >= r.y1 && my <= r.y2);
  }

  _snapToGrid(mx, my) {
    const step = this._data?.grid_step || 0.5;
    let best = null, bestD = Infinity;
    for (const p of this._gridPts) {
      const d = Math.hypot(p.mx - mx, p.my - my);
      if (d < bestD) { bestD = d; best = p; }
    }
    return (best && bestD < step * 0.75) ? best : null;
  }

  // ── Canvas events ────────────────────────────────────────────────────────

  async _onCanvasClick(e) {
    // ── 3D: nur Reset-Button prüfen ────────────────────────────────────────
    if (this._mode === "view" && this._opts?.show3D) {
      if (this._3dResetBtn) {
        const { cx, cy } = this._canvasXY(e);
        const b = this._3dResetBtn;
        const dpr = window.devicePixelRatio || 1;
        const bx = b.x * dpr, by = b.y * dpr, bw = b.w * dpr, bh = b.h * dpr;
        if (cx >= bx && cx <= bx+bw && cy >= by && cy <= by+bh) {
          this._3dAzimuth   = 30;
          this._3dElevation = 42;
          this._3dZoom      = 1.0;
          this._3dPanX      = 0;
          this._3dPanY      = 0;
          this._draw();
          return;
        }
      }
      return;
    }

    // ── Deko: place element ─────────────────────────────────────────────────
    // PTZ camera placement
    if (this._mode === "ptz" && this._ptzPlacing != null) {
      const { cx: pCx, cy: pCy } = this._canvasXY(e);
      const pF = this._c2f(pCx, pCy);
      if (this._ptzCameras[this._ptzPlacing]) {
        this._ptzCameras[this._ptzPlacing].mx = Math.round(pF.x*10)/10;
        this._ptzCameras[this._ptzPlacing].my = Math.round(pF.y*10)/10;
        this._showToast("📹 PTZ-Kamera platziert");
        this._ptzPlacing = null;
        this._rebuildSidebar(); this._draw();
      }
      return;
    }
    // mmWave sensor placement
    if (this._mode === "mmwave" && this._mmwavePlacing != null) {
      const { cx: mwCx, cy: mwCy } = this._canvasXY(e);
      const mwF = this._c2f(mwCx, mwCy);
      if (this._pendingMmwave[this._mmwavePlacing]) {
        this._pendingMmwave[this._mmwavePlacing].mx = Math.round(mwF.mx*10)/10;
        this._pendingMmwave[this._mmwavePlacing].my = Math.round(mwF.my*10)/10;
        this._showToast("📡 Sensor platziert");
        this._mmwavePlacing = null;
        this._rebuildSidebar(); this._draw();
      }
      return;
    }
    // mmWave 2-Punkt-Kalibrierung: Canvas-Click erfasst Grundriss-Koordinate
    if (this._mode === "mmwave" && this._mmwaveCalibPoints?.phase >= 1) {
      const { cx: cCx, cy: cCy } = this._canvasXY(e);
      const cF = this._c2f(cCx, cCy);
      const cal = this._mmwaveCalibPoints;
      const s = (this._pendingMmwave || []).find(x => x.id === cal.sensorId);
      if (!s) return;
      // Lese aktuelle Sensor-Rohwerte für diesen Moment
      const t1 = this._getMmwaveTargetRaw(s, 1);
      if (!t1) { this._showToast("⚠ Kein Target erkannt – stell dich vor den Sensor!"); return; }
      const point = { fx: cF.mx, fy: cF.my, sx: t1.x_mm / 1000, sy: t1.y_mm / 1000 };
      cal.points.push(point);
      if (cal.phase === 1) {
        cal.phase = 2;
        this._showToast(`✓ Punkt 1 erfasst (Sensor: ${t1.x_mm.toFixed(0)}/${t1.y_mm.toFixed(0)}mm → Grundriss: ${cF.mx.toFixed(2)}/${cF.my.toFixed(2)}m) – gehe jetzt zu Punkt 2`);
        this._rebuildSidebar();
      } else if (cal.phase === 2) {
        // Beide Punkte da – berechne Skalierung + Offset
        const [p1, p2] = cal.points;
        const dSx = p2.sx - p1.sx, dSy = p2.sy - p1.sy;
        const dFx = p2.fx - p1.fx, dFy = p2.fy - p1.fy;
        const scale_x = Math.abs(dSx) > 0.05 ? dFx / dSx : (s.calibration?.scale_x || 1);
        const scale_y = Math.abs(dSy) > 0.05 ? dFy / dSy : (s.calibration?.scale_y || 1);
        const offset_x = p1.fx - p1.sx * scale_x;
        const offset_y = p1.fy - p1.sy * scale_y;
        s.calibration = { scale_x, scale_y, offset_x, offset_y };
        this._mmwaveCalibPoints = null;
        this._showToast(`✅ Kalibrierung gesetzt: Skala X=${scale_x.toFixed(3)} Y=${scale_y.toFixed(3)}`);
        this._rebuildSidebar(); this._draw();
      }
      return;
    }
    if (this._mode === "deko" && this._dekoPlacing) {
      const { cx: dCx, cy: dCy } = this._canvasXY(e);
      const fl = this._c2f(dCx, dCy);
      this._pendingDecos.push({ id:"deko_"+Date.now(), type:this._dekoPlacing,
        mx:parseFloat(fl.mx.toFixed(2)), my:parseFloat(fl.my.toFixed(2)),
        size:1.0, label:"" });
      this._dekoPlacing = null;
      this._canvas.style.cursor = "default";
      this._rebuildSidebar(); this._draw(); return;
    }

    const { cx, cy } = this._canvasXY(e);
    const fl = this._c2f(cx, cy);

    // Window placement mode (rooms tab)
    if (this._mode === "rooms" && this._placingWindow) {
      const rooms = this._pendingRooms;
      // ── Snap-Logik identisch zu Türen ─────────────────────────────────────
      // 1. Finde nächste Wand + bestimme Winkel (0=horizontal, PI/2=vertikal)
      let bestWallDist = Infinity, snappedX = fl.mx, snappedY = fl.my, angle = 0;
      rooms.forEach(r => {
        const walls = [
          { dist: Math.abs(fl.my - r.y1), snapX: fl.mx, snapY: r.y1, angle: 0     },  // oben
          { dist: Math.abs(fl.my - r.y2), snapX: fl.mx, snapY: r.y2, angle: 0     },  // unten
          { dist: Math.abs(fl.mx - r.x1), snapX: r.x1,  snapY: fl.my, angle: Math.PI/2 },  // links
          { dist: Math.abs(fl.mx - r.x2), snapX: r.x2,  snapY: fl.my, angle: Math.PI/2 },  // rechts
        ];
        walls.forEach(w => {
          if (w.dist < bestWallDist) {
            bestWallDist = w.dist;
            snappedX     = w.snapX;
            snappedY     = w.snapY;
            angle        = w.angle;
          }
        });
      });
      // Nur snappen wenn nah genug an einer Wand (wie Türen)
      const finalX = bestWallDist < 0.8 ? snappedX : fl.mx;
      const finalY = bestWallDist < 0.8 ? snappedY : fl.my;
      // Welche Räume berührt das Fenster?
      const touching = rooms.filter(r =>
        finalX >= r.x1 - 0.3 && finalX <= r.x2 + 0.3 &&
        finalY >= r.y1 - 0.3 && finalY <= r.y2 + 0.3
      );
      this._pendingWindows.push({
        x:    parseFloat(finalX.toFixed(2)),
        y:    parseFloat(finalY.toFixed(2)),
        width:     1.0,
        angle:     angle,
        entity_id: "",
        room:      touching[0]?.name || "",
      });
      this._placingWindow = false;
      this._canvas.style.cursor = "default";
      this._showToast(`Fenster platziert${touching[0] ? ": " + touching[0].name : ""}`);
      this._rebuildSidebar(); this._draw();
      return;
    }

    // Info sensor placement
    if (this._placingInfoIdx >= 0) {
      const s = this._pendingInfoSensors[this._placingInfoIdx];
      if (s) {
        s.mx = parseFloat(fl.mx.toFixed(2));
        s.my = parseFloat(fl.my.toFixed(2));
        this._showToast(`${s.name||"Sensor"} platziert`);
      }
      this._placingInfoIdx = -1;
      this._canvas.style.cursor = "default";
      this._rebuildSidebar(); this._draw();
      return;
    }

    // Door placement mode (rooms tab)
    if (this._mode === "rooms" && this._placingDoor) {
      const mx = parseFloat(fl.mx.toFixed(2));
      const my = parseFloat(fl.my.toFixed(2));
      // Find which rooms are adjacent to this point
      const rooms = this._pendingRooms;
      const touching = rooms.filter(r =>
        mx >= r.x1 - 0.3 && mx <= r.x2 + 0.3 &&
        my >= r.y1 - 0.3 && my <= r.y2 + 0.3
      );
      const connects = touching.length >= 2
        ? [touching[0].name, touching[1].name]
        : touching.length === 1 ? [touching[0].name, "?"] : ["?", "?"];
      this._pendingDoors.push({ x: mx, y: my, connects, width: 0.9, mirrored: false });
      this._placingDoor = false;
      this._canvas.style.cursor = "default";
      this._showToast(`Tür platziert: ${connects[0]} ↔ ${connects[1]}`);
      this._rebuildSidebar();
      return;
    }

    if (this._mode === "calibrate") {
      const sn = this._snapToGrid(fl.mx, fl.my);
      if (sn) {
        this._selGridPt = sn;
        const sel = this.shadowRoot.getElementById("cal_sel");
        if (sel) sel.textContent = `${sn.mx.toFixed(2)} / ${sn.my.toFixed(2)}`;
        const btn = this.shadowRoot.getElementById("btn_capture");
        if (btn) btn.disabled = false;
      }
    }

    if (this._mode === "scanners" && this._placingIdx >= 0) {
      const s = this._pendingScanners[this._placingIdx];
      if (s) {
        s.mx = parseFloat(fl.mx.toFixed(2));
        s.my = parseFloat(fl.my.toFixed(2));
        this._showToast(`${s.name} platziert: ${s.mx}m / ${s.my}m`);
      }
      this._placingIdx = -1;
      this._canvas.style.cursor = "default";
      this._rebuildSidebar();
    }

    // ── Energie: line endpoints + battery placing ─────────────────────────
    // Room tap → light toggle (view mode, optional)
    if (this._mode === "view" && this._opts?.roomTapLight) {
      const handled = await this._handleRoomTap(fl.mx, fl.my);
      if (handled) return;
    }

    if (this._mode === "energie" && this._placingEnergyPt) {
      const { lineIdx, point } = this._placingEnergyPt;
      const line = this._pendingEnergyLines[lineIdx];
      if (line) {
        if (point === "start") { line.x1 = parseFloat(fl.mx.toFixed(2)); line.y1 = parseFloat(fl.my.toFixed(2)); }
        else                   { line.x2 = parseFloat(fl.mx.toFixed(2)); line.y2 = parseFloat(fl.my.toFixed(2)); }
        this._showToast(`${line.name}: ${point==="start"?"Start":"Ende"} gesetzt`);
      }
      this._placingEnergyPt = null;
      this._rebuildSidebar(); this._draw();
    }

    if (this._mode === "energie" && this._placingBatteryIdx >= 0) {
      const bat = this._pendingBatteries[this._placingBatteryIdx];
      if (bat) {
        bat.mx = parseFloat(fl.mx.toFixed(2));
        bat.my = parseFloat(fl.my.toFixed(2));
        this._showToast(`${bat.name || "Akku"} platziert`);
      }
      this._placingBatteryIdx = -1;
      this._rebuildSidebar(); this._draw();
    }

    // ── Lights: place / reposition ──────────────────────────────────
    if (this._mode === "lights" && this._placingLight) {
      const mx = parseFloat(fl.mx.toFixed(2));
      const my = parseFloat(fl.my.toFixed(2));
      if (this._selLight !== null) {
        // Reposition existing light
        this._pendingLights[this._selLight].mx = mx;
        this._pendingLights[this._selLight].my = my;
        this._selLight = null;
      } else {
        // Add new light
        const id = "light_" + Date.now();
        this._pendingLights.push({ id, name: `Lampe ${this._pendingLights.length + 1}`, entity: "", mx, my, mz: null });
      }
      this._placingLight = false;
      this._rebuildSidebar();
      this._showToast(`Lampe platziert: ${mx}m / ${my}m`);
    }
  }

  _onCanvasDown(e) {
    // ── 3D mode: intercept for orbit drag ──────────────────────────────────
    if (this._mode === "view" && this._opts?.show3D) {
      this._3dDrag = { x: e.clientX ?? e.touches?.[0]?.clientX ?? 0,
                       y: e.clientY ?? e.touches?.[0]?.clientY ?? 0,
                       az: this._3dAzimuth, el: this._3dElevation };
      this._canvas.style.cursor = "grabbing";
      return;
    }
    // Middle mouse / Alt+click / Space+LMB / right-click = pan in ANY mode (incl 3D)
    if (this._opts?.zoomPan &&
        (e.button === 1 || e.altKey || this._spaceHeld || e.button === 2)) {
      if (this._mode === "view" && this._opts?.show3D) {
        // 3D pan via mouse
        this._is3dPanning = true;
        const rect = this._canvas.getBoundingClientRect();
        this._3dPanStart = { x: e.clientX - rect.left, y: e.clientY - rect.top,
          px: this._3dPanX||0, py: this._3dPanY||0 };
        this._canvas.style.cursor = "grabbing";
        return;
      }
      this._isPanning = true;
      const rect = this._canvas.getBoundingClientRect();
      this._panStart = { x: e.clientX - rect.left, y: e.clientY - rect.top, px: this._panX||0, py: this._panY||0 };
      this._canvas.style.cursor = "grabbing";
      return;
    }
    // 2D: also pan when zoomed in with LMB in view mode
    if (this._opts?.zoomPan && e.button === 0 && (this._zoom||1) > 1 && this._mode === "view") {
      this._isPanning = true;
      const rect = this._canvas.getBoundingClientRect();
      this._panStart = { x: e.clientX - rect.left, y: e.clientY - rect.top, px: this._panX||0, py: this._panY||0 };
      this._canvas.style.cursor = "grabbing";
      return;
    }
    // ── Deko drag: pick up existing deco element ──────────────────────────────
    if (this._mode === "deko" && !this._dekoPlacing) {
      const { cx: dCx, cy: dCy } = this._canvasXY(e);
      const df = this._c2f(dCx, dCy);
      const decos = this._pendingDecos || [];
      const hitIdx = decos.findIndex(d =>
        d.mx != null &&
        Math.abs(d.mx - df.mx) < (d.size||1)*0.9 &&
        Math.abs(d.my - df.my) < (d.size||1)*0.9
      );
      if (hitIdx >= 0) {
        this._dekoDragging = hitIdx;
        this._dekoSelected = hitIdx;
        this._canvas.style.cursor = "grabbing";
        this._rebuildSidebar();
        return;
      }
    }
    if (this._mode !== "rooms") return;
    const { cx, cy } = this._canvasXY(e);
    const fl = this._c2f(cx, cy);

    // ── Zone drag: check zone handles if a room's zone panel is open ────────
    if (this._zoneEditRoom != null) {
      const r = this._pendingRooms[this._zoneEditRoom];
      if (r && r.zones) {
        const rW = r.x2 - r.x1, rH = r.y2 - r.y1;
        const hitR = 0.3; // metres
        for (let zi = 0; zi < r.zones.length; zi++) {
          const z = r.zones[zi];
          // Absolute floor-metre corners
          const zax1 = r.x1 + (z.rx1||0)*rW, zay1 = r.y1 + (z.ry1||0)*rH;
          const zax2 = r.x1 + (z.rx2||1)*rW, zay2 = r.y1 + (z.ry2||1)*rH;
          const corners = [
            {h:"tl",mx:zax1,my:zay1},{h:"tr",mx:zax2,my:zay1},
            {h:"bl",mx:zax1,my:zay2},{h:"br",mx:zax2,my:zay2},
          ];
          const hit = corners.find(c=>Math.hypot(fl.mx-c.mx,fl.my-c.my)<hitR);
          if (hit) {
            this._zoneDrag = {ri:this._zoneEditRoom, zi, handle:hit.h,
              startMx:fl.mx, startMy:fl.my, origZ:{...z}};
            this._canvas.style.cursor = "nwse-resize";
            return;
          }
          // Move: click inside zone
          if (fl.mx>=zax1 && fl.mx<=zax2 && fl.my>=zay1 && fl.my<=zay2) {
            this._zoneDrag = {ri:this._zoneEditRoom, zi, handle:"move",
              startMx:fl.mx, startMy:fl.my, origZ:{...z}};
            this._canvas.style.cursor = "grabbing";
            return;
          }
        }
        // Click inside the room but outside any zone → start drawing new zone
        if (fl.mx>=r.x1 && fl.mx<=r.x2 && fl.my>=r.y1 && fl.my<=r.y2) {
          if (!this._roomHistory) this._roomHistory = [];
          this._roomHistory.push(structuredClone(this._pendingRooms));
          if (this._roomHistory.length > 30) this._roomHistory.shift();
          if (!r.zones) r.zones = [];
          const rW2 = r.x2-r.x1, rH2 = r.y2-r.y1;
          const rx1 = (fl.mx-r.x1)/rW2, ry1 = (fl.my-r.y1)/rH2;
          r.zones.push({name:"Zone "+(r.zones.length+1),rx1,ry1,rx2:rx1,ry2:ry1,
            color:"#a78bfa",presence_entity:""});
          const newZi = r.zones.length-1;
          this._zoneDrag = {ri:this._zoneEditRoom, zi:newZi, handle:"br",
            startMx:fl.mx, startMy:fl.my, origZ:{...r.zones[newZi]}};
          this._canvas.style.cursor = "nwse-resize";
          this._rebuildSidebar();
          return;
        }
      }
    }

    // Check door handle hits first
    const floorW = this._data?.floor_w || 10;
    const scale  = this._canvas.width / floorW;
    for (let i = 0; i < this._pendingDoors.length; i++) {
      const d   = this._pendingDoors[i];
      const ang = this._doorAngle(d);
      const hw  = (d.width || 0.9) / 2;
      // End handles in floor coords
      const cosA = Math.cos(ang), sinA = Math.sin(ang);
      const p1 = { mx: d.x - hw * cosA, my: d.y - hw * sinA };
      const p2 = { mx: d.x + hw * cosA, my: d.y + hw * sinA };
      const hitR = 12 / scale;  // 12px hit radius in floor metres (bigger = easier to grab)
      if (Math.hypot(fl.mx - p1.mx, fl.my - p1.my) < hitR) {
        this._dragDoor = { idx: i, handle: "start" }; return;
      }
      if (Math.hypot(fl.mx - p2.mx, fl.my - p2.my) < hitR) {
        this._dragDoor = { idx: i, handle: "end" }; return;
      }
      // Move handle: click anywhere along the door line
      // Project click point onto door axis, check if within door width + margin
      const proj = (fl.mx - d.x) * cosA + (fl.my - d.y) * sinA;
      const perp = Math.abs((fl.mx - d.x) * (-sinA) + (fl.my - d.y) * cosA);
      if (Math.abs(proj) <= hw + hitR && perp <= hitR) {
        this._dragDoor = { idx: i, handle: "move", startMx: fl.mx, startMy: fl.my,
                           origX: d.x, origY: d.y }; return;
      }
    }

    // Window hit detection (scale handles + move)
    const floorWw = this._data?.floor_w || 10;
    const scaleWw = this._canvas.width / floorWw;
    for (let i = 0; i < this._pendingWindows.length; i++) {
      const w   = this._pendingWindows[i];
      const ang = w.angle || 0;
      const hw  = (w.width || 1.0) / 2;
      const cosA = Math.cos(ang), sinA = Math.sin(ang);
      const p1 = { mx: w.x - hw * cosA, my: w.y - hw * sinA };
      const p2 = { mx: w.x + hw * cosA, my: w.y + hw * sinA };
      const hitR = 14 / scaleWw;
      if (Math.hypot(fl.mx - p1.mx, fl.my - p1.my) < hitR) {
        this._dragWindow = { idx: i, handle: "start" }; return;
      }
      if (Math.hypot(fl.mx - p2.mx, fl.my - p2.my) < hitR) {
        this._dragWindow = { idx: i, handle: "end" }; return;
      }
      const proj = (fl.mx - w.x) * cosA + (fl.my - w.y) * sinA;
      const perp = Math.abs((fl.mx - w.x) * (-sinA) + (fl.my - w.y) * cosA);
      if (Math.abs(proj) <= hw + hitR && perp <= hitR) {
        this._dragWindow = { idx: i, handle: "move", startMx: fl.mx, startMy: fl.my,
                             origX: w.x, origY: w.y }; return;
      }
    }

    if (this._roomSubMode === "edit") {
      // Check resize handle first (8px corner zones in canvas coords)
      const handleR = 10; // px in floor-metres scale
      const scaleX  = (this._data?.floor_w||10) / this._canvas.width;
      const scaleY  = (this._data?.floor_h||10) / this._canvas.height;
      const hrm     = handleR * Math.max(scaleX, scaleY); // handle radius in metres

      for (let i = this._pendingRooms.length-1; i >= 0; i--) {
        const r = this._pendingRooms[i];
        const corners = [
          { h:"tl", mx:r.x1, my:r.y1 }, { h:"tr", mx:r.x2, my:r.y1 },
          { h:"bl", mx:r.x1, my:r.y2 }, { h:"br", mx:r.x2, my:r.y2 },
        ];
        const hit = corners.find(c => Math.hypot(fl.mx-c.mx, fl.my-c.my) < hrm);
        if (hit) {
          this._roomDrag = { idx:i, mode:"resize", handle:hit.h,
            startMx:fl.mx, startMy:fl.my, origRoom:{...r} };
          this._selRoomIdx = i;
          this._rebuildSidebar();
          return;
        }
        // Check move (click inside room)
        if (fl.mx>=r.x1 && fl.mx<=r.x2 && fl.my>=r.y1 && fl.my<=r.y2) {
          this._roomDrag = { idx:i, mode:"move",
            startMx:fl.mx, startMy:fl.my, origRoom:{...r} };
          this._selRoomIdx = i;
          this._rebuildSidebar();
          return;
        }
      }
    } else {
      this._drawState = { active: true, sx: fl.mx, sy: fl.my, ex: fl.mx, ey: fl.my };
    }
  }

  _onCanvasMove(e) {
    // ── 3D orbit + pan drag ─────────────────────────────────────────────────
    if (this._mode === "view" && this._opts?.show3D) {
      const cx = e.clientX ?? e.touches?.[0]?.clientX ?? 0;
      const cy = e.clientY ?? e.touches?.[0]?.clientY ?? 0;
      // 3D Pan (middle mouse / space)
      if (this._is3dPanning && this._3dPanStart) {
        const rect = this._canvas.getBoundingClientRect();
        const x = cx - rect.left, y = cy - rect.top;
        this._3dPanX = this._3dPanStart.px + (x - this._3dPanStart.x);
        this._3dPanY = this._3dPanStart.py + (y - this._3dPanStart.y);
        this._canvas.style.cursor = "grabbing";
        this._draw(); return;
      }
      // 3D Orbit (single LMB drag)
      if (this._3dDrag) {
        const dx = cx - this._3dDrag.x;
        const dy = cy - this._3dDrag.y;
        this._3dAzimuth   = this._3dDrag.az + dx * 0.4;
        this._3dElevation = Math.max(5, Math.min(85, this._3dDrag.el - dy * 0.3));
        this._draw();
      }
      this._canvas.style.cursor = this._3dDrag || this._is3dPanning ? "grabbing" : "grab";
      return;
    }
    // Pan handling
    if (this._isPanning && this._panStart) {
      const rect = this._canvas.getBoundingClientRect();
      const x    = e.clientX - rect.left;
      const y    = e.clientY - rect.top;
      this._panX = this._panStart.px + (x - this._panStart.x);
      this._panY = this._panStart.py + (y - this._panStart.y);
      this._draw();
      return;
    }
    // ── Deko drag move ──────────────────────────────────────────────────────
    if (this._mode === "deko" && this._dekoDragging >= 0) {
      const { cx: mvCx, cy: mvCy } = this._canvasXY(e);
      const mf = this._c2f(mvCx, mvCy);
      if (this._pendingDecos[this._dekoDragging]) {
        this._pendingDecos[this._dekoDragging].mx = parseFloat(mf.mx.toFixed(2));
        this._pendingDecos[this._dekoDragging].my = parseFloat(mf.my.toFixed(2));
      }
      this._draw();
      return;
    }
    const { cx, cy } = this._canvasXY(e);
    const fl = this._c2f(cx, cy);
    const tip = this.shadowRoot.getElementById("tip");

    // Track mouse position for scanner placement crosshair
    this._mouseFloor = fl;

    // ── Zone drag move ──────────────────────────────────────────────────────
    if (this._zoneDrag) {
      const { ri, zi, handle } = this._zoneDrag;
      const r = this._pendingRooms[ri];
      const z = r && r.zones && r.zones[zi];
      if (z && r) {
        const rW = r.x2-r.x1, rH = r.y2-r.y1;
        if (rW>0 && rH>0) {
          const rx = Math.max(0,Math.min(1,(fl.mx-r.x1)/rW));
          const ry = Math.max(0,Math.min(1,(fl.my-r.y1)/rH));
          const dx = (fl.mx-this._zoneDrag.startMx)/rW;
          const dy = (fl.my-this._zoneDrag.startMy)/rH;
          const oz = this._zoneDrag.origZ;
          if (handle==="move") {
            const zw=oz.rx2-oz.rx1, zh=oz.ry2-oz.ry1;
            z.rx1=Math.max(0,Math.min(1-zw,oz.rx1+dx));
            z.ry1=Math.max(0,Math.min(1-zh,oz.ry1+dy));
            z.rx2=z.rx1+zw; z.ry2=z.ry1+zh;
          } else if (handle==="tl") { z.rx1=Math.min(rx,oz.rx2-0.05); z.ry1=Math.min(ry,oz.ry2-0.05); }
          else if (handle==="tr") { z.rx2=Math.max(rx,oz.rx1+0.05); z.ry1=Math.min(ry,oz.ry2-0.05); }
          else if (handle==="bl") { z.rx1=Math.min(rx,oz.rx2-0.05); z.ry2=Math.max(ry,oz.ry1+0.05); }
          else if (handle==="br") { z.rx2=Math.max(rx,oz.rx1+0.05); z.ry2=Math.max(ry,oz.ry1+0.05); }
          this._draw();
        }
      }
      return;
    }

    // Zone hover cursor (when zone panel is open)
    if (this._mode === "rooms" && this._zoneEditRoom != null && !this._zoneDrag) {
      const r = this._pendingRooms[this._zoneEditRoom];
      if (r && r.zones) {
        const rW=r.x2-r.x1, rH=r.y2-r.y1;
        let overHandle=false, overZone=false;
        for (const z of r.zones) {
          const zax1=r.x1+(z.rx1||0)*rW, zay1=r.y1+(z.ry1||0)*rH;
          const zax2=r.x1+(z.rx2||1)*rW, zay2=r.y1+(z.ry2||1)*rH;
          const corners=[{mx:zax1,my:zay1},{mx:zax2,my:zay1},{mx:zax1,my:zay2},{mx:zax2,my:zay2}];
          if (corners.some(c=>Math.hypot(fl.mx-c.mx,fl.my-c.my)<0.3)) { overHandle=true; break; }
          if (fl.mx>=zax1&&fl.mx<=zax2&&fl.my>=zay1&&fl.my<=zay2) { overZone=true; }
        }
        if (overHandle) { this._canvas.style.cursor="nwse-resize"; return; }
        if (overZone)   { this._canvas.style.cursor="move"; return; }
      }
    }

    // Door drag (scale or move)
    if (this._mode === "rooms" && this._dragDoor !== null) {
      const d   = this._pendingDoors[this._dragDoor.idx];
      if (!d) return;
      const ang  = this._doorAngle(d);
      const cosA = Math.cos(ang), sinA = Math.sin(ang);
      if (this._dragDoor.handle === "move") {
        d.x = parseFloat((this._dragDoor.origX + fl.mx - this._dragDoor.startMx).toFixed(2));
        d.y = parseFloat((this._dragDoor.origY + fl.my - this._dragDoor.startMy).toFixed(2));
        const touching = this._pendingRooms.filter(r =>
          d.x >= r.x1-0.4 && d.x <= r.x2+0.4 && d.y >= r.y1-0.4 && d.y <= r.y2+0.4);
        if (touching.length >= 2) d.connects = [touching[0].name, touching[1].name];
      } else {
        const hw = Math.abs((fl.mx - d.x) * cosA + (fl.my - d.y) * sinA);
        d.width  = parseFloat(Math.max(0.4, hw * 2).toFixed(2));
      }
      return;
    }

    // Window drag
    if (this._mode === "rooms" && this._dragWindow !== null) {
      const w   = this._pendingWindows[this._dragWindow.idx];
      if (!w) return;
      const ang  = w.angle || 0;
      const cosA = Math.cos(ang), sinA = Math.sin(ang);
      if (this._dragWindow.handle === "move") {
        w.x = parseFloat((this._dragWindow.origX + fl.mx - this._dragWindow.startMx).toFixed(2));
        w.y = parseFloat((this._dragWindow.origY + fl.my - this._dragWindow.startMy).toFixed(2));
      } else {
        // Resize: distance from center → new half-width
        const hw = Math.abs((fl.mx - w.x) * cosA + (fl.my - w.y) * sinA);
        w.width  = parseFloat(Math.max(0.3, hw * 2).toFixed(2));
      }
      return;
    }

    if (this._mode === "rooms") {
      if (this._drawState.active) {
        this._drawState.ex = fl.mx;
        this._drawState.ey = fl.my;
      } else if (this._roomDrag) {
        const d      = this._roomDrag;
        const dx     = fl.mx - d.startMx;
        const dy     = fl.my - d.startMy;
        const r      = this._pendingRooms[d.idx];
        const or     = d.origRoom;
        const fw     = this._data?.floor_w || 10;
        const fh     = this._data?.floor_h || 10;
        const others = this._pendingRooms.filter((_, i) => i !== d.idx);

        // ── Helpers ────────────────────────────────────────────
        // True if two rects overlap (strictly – touching edges = fine)
        const overlaps = (ax1,ay1,ax2,ay2, bx1,by1,bx2,by2) =>
          ax1 < bx2 - 0.001 && ax2 > bx1 + 0.001 &&
          ay1 < by2 - 0.001 && ay2 > by1 + 0.001;

        if (d.mode === "move") {
          // ── MOVE: clamp X and Y independently ─────────────
          const w = or.x2 - or.x1, h = or.y2 - or.y1;

          // Desired position (floor-clamped)
          let tx1 = Math.max(0, Math.min(fw - w, or.x1 + dx));
          let ty1 = Math.max(0, Math.min(fh - h, or.y1 + dy));

          // For each other room find the maximum X we can still go to
          // without overlapping when we also move in Y by ty1.
          // Strategy: try X first, then Y, pick whichever axis is blocked less.

          // --- X axis: fix ty1, find best tx1 ---
          let bestX = tx1;
          for (const o of others) {
            // Only relevant if the Y ranges will overlap
            const yOk = (ty1 < o.y2 - 0.001) && (ty1 + h > o.y1 + 0.001);
            if (!yOk) continue;
            if (overlaps(bestX, ty1, bestX+w, ty1+h, o.x1, o.y1, o.x2, o.y2)) {
              // Coming from left or right?
              if (or.x1 + dx < o.x1 + (o.x2-o.x1)/2)
                bestX = Math.min(bestX, o.x1 - w);   // push left
              else
                bestX = Math.max(bestX, o.x2);        // push right
              bestX = Math.max(0, Math.min(fw - w, bestX));
            }
          }
          // --- Y axis: fix tx1, find best ty1 ---
          let bestY = ty1;
          for (const o of others) {
            const xOk = (tx1 < o.x2 - 0.001) && (tx1 + w > o.x1 + 0.001);
            if (!xOk) continue;
            if (overlaps(tx1, bestY, tx1+w, bestY+h, o.x1, o.y1, o.x2, o.y2)) {
              if (or.y1 + dy < o.y1 + (o.y2-o.y1)/2)
                bestY = Math.min(bestY, o.y1 - h);
              else
                bestY = Math.max(bestY, o.y2);
              bestY = Math.max(0, Math.min(fh - h, bestY));
            }
          }

          // Choose the axis that keeps us closer to the desired position
          const distX = Math.abs(bestX - tx1);
          const distY = Math.abs(bestY - ty1);
          // Apply both corrections independently if neither causes new overlaps
          let fx1 = bestX, fy1 = bestY;
          // Verify combined position doesn't overlap anything; if it does, revert to lesser move
          let anyOverlap = others.some(o => overlaps(fx1,fy1,fx1+w,fy1+h,o.x1,o.y1,o.x2,o.y2));
          if (anyOverlap) {
            // Try X only
            fx1 = bestX; fy1 = ty1;
            anyOverlap = others.some(o => overlaps(fx1,fy1,fx1+w,fy1+h,o.x1,o.y1,o.x2,o.y2));
          }
          if (anyOverlap) {
            // Try Y only
            fx1 = tx1; fy1 = bestY;
            anyOverlap = others.some(o => overlaps(fx1,fy1,fx1+w,fy1+h,o.x1,o.y1,o.x2,o.y2));
          }
          if (anyOverlap) {
            // Stay put
            fx1 = r.x1; fy1 = r.y1;
          }

          r.x1 = parseFloat(fx1.toFixed(2));
          r.y1 = parseFloat(fy1.toFixed(2));
          r.x2 = parseFloat((fx1 + w).toFixed(2));
          r.y2 = parseFloat((fy1 + h).toFixed(2));

        } else {
          // ── RESIZE: only the moving edge can be blocked ────
          let nx1 = or.x1, ny1 = or.y1, nx2 = or.x2, ny2 = or.y2;
          const MIN = 0.3;
          switch(d.handle) {
            case "tl": nx1=Math.max(0,Math.min(or.x2-MIN,or.x1+dx)); ny1=Math.max(0,Math.min(or.y2-MIN,or.y1+dy)); break;
            case "tr": nx2=Math.max(or.x1+MIN,Math.min(fw,or.x2+dx)); ny1=Math.max(0,Math.min(or.y2-MIN,or.y1+dy)); break;
            case "bl": nx1=Math.max(0,Math.min(or.x2-MIN,or.x1+dx)); ny2=Math.max(or.y1+MIN,Math.min(fh,or.y2+dy)); break;
            case "br": nx2=Math.max(or.x1+MIN,Math.min(fw,or.x2+dx)); ny2=Math.max(or.y1+MIN,Math.min(fh,or.y2+dy)); break;
          }
          // Clamp the moving edge against every other room
          for (const o of others) {
            if (!overlaps(nx1,ny1,nx2,ny2, o.x1,o.y1,o.x2,o.y2)) continue;
            // Determine which edge is moving and snap it to the obstacle
            switch(d.handle) {
              case "tl":
                if (nx1 < o.x2 && nx2 > o.x1) nx1 = o.x2;   // left edge
                if (ny1 < o.y2 && ny2 > o.y1) ny1 = o.y2;   // top edge
                break;
              case "tr":
                if (nx2 > o.x1 && nx1 < o.x2) nx2 = o.x1;
                if (ny1 < o.y2 && ny2 > o.y1) ny1 = o.y2;
                break;
              case "bl":
                if (nx1 < o.x2 && nx2 > o.x1) nx1 = o.x2;
                if (ny2 > o.y1 && ny1 < o.y2) ny2 = o.y1;
                break;
              case "br":
                if (nx2 > o.x1 && nx1 < o.x2) nx2 = o.x1;
                if (ny2 > o.y1 && ny1 < o.y2) ny2 = o.y1;
                break;
            }
          }
          r.x1 = parseFloat(Math.max(0,   Math.min(nx1,nx2-MIN)).toFixed(2));
          r.y1 = parseFloat(Math.max(0,   Math.min(ny1,ny2-MIN)).toFixed(2));
          r.x2 = parseFloat(Math.min(fw,  Math.max(nx2,nx1+MIN)).toFixed(2));
          r.y2 = parseFloat(Math.min(fh,  Math.max(ny2,ny1+MIN)).toFixed(2));
        }
      } else if (this._roomSubMode === "edit") {
        // Update cursor based on hover
        this._updateRoomCursor(fl.mx, fl.my);
      }
    }

    if (this._mode === "calibrate") {
      const sn = this._snapToGrid(fl.mx, fl.my);
      if (sn && tip) {
        const hasFp = this._hasFpAt(sn.mx, sn.my);
        tip.style.display = "block";
        tip.style.left    = (e.clientX + 12) + "px";
        tip.style.top     = (e.clientY - 8)  + "px";
        tip.innerHTML     = `${sn.mx.toFixed(2)}m / ${sn.my.toFixed(2)}m `
          + (hasFp ? `<span style="color:var(--green)">✓ kalibriert</span>`
                   : `<span style="color:var(--muted)">nicht kalibriert</span>`);
        return;
      }
    }
    if (tip) tip.style.display = "none";
  }

  _onCanvasUp(e) {
    // ── 3D orbit release ────────────────────────────────────────────────────
    if (this._mode === "view" && this._opts?.show3D) {
      this._3dDrag = null;
      this._is3dPanning = false;
      this._3dPanStart = null;
      this._canvas.style.cursor = this._spaceHeld ? "grab" : "grab";
      return;
    }
    if (this._isPanning) {
      this._isPanning = false;
    if (this._spaceHeld && this._canvas) this._canvas.style.cursor = "grab";
    else if (this._canvas) this._canvas.style.cursor = "";
      this._panStart  = null;
      this._canvas.style.cursor = this._mode === "view" ? "default" : "crosshair";
      return;
    }
    // ── Deko drag release ────────────────────────────────────────────────────
    if (this._mode === "deko" && this._dekoDragging >= 0) {
      this._dekoDragging = -1;
      this._canvas.style.cursor = this._dekoPlacing ? "crosshair" : "default";
      return;
    }
    if (this._mode === "deko") return; // no drag active, let touchend call _onCanvasClick

    // ── Zone drag release ──────────────────────────────────────────────────
    if (this._zoneDrag) {
      const {ri, zi} = this._zoneDrag;
      const r = this._pendingRooms[ri];
      const z = r?.zones?.[zi];
      if (z) {
        // Normalize: ensure rx1<rx2 and ry1<ry2
        if (z.rx1>z.rx2){const t=z.rx1;z.rx1=z.rx2;z.rx2=t;}
        if (z.ry1>z.ry2){const t=z.ry1;z.ry1=z.ry2;z.ry2=t;}
        z.rx1=parseFloat(z.rx1.toFixed(3)); z.ry1=parseFloat(z.ry1.toFixed(3));
        z.rx2=parseFloat(z.rx2.toFixed(3)); z.ry2=parseFloat(z.ry2.toFixed(3));
      }
      this._zoneDrag = null;
      this._canvas.style.cursor = "crosshair";
      this._rebuildSidebar();
      return;
    }

    if (this._mode !== "rooms") return;
    if (this._dragDoor !== null) {
      this._dragDoor = null;
      this._rebuildSidebar();
      return;
    }
    if (this._dragWindow !== null) {
      this._dragWindow = null;
      this._draw();
      this._rebuildSidebar();
      return;
    }

    if (this._roomDrag) {
      // Drag/resize ended – just clear state
      this._roomDrag = null;
      this._canvas.style.cursor = "crosshair";
      return;
    }

    if (!this._drawState.active) return;
    this._drawState.active = false;
    const { sx, sy, ex, ey } = this._drawState;
    const x1 = Math.max(0, Math.min(sx, ex));
    const y1 = Math.max(0, Math.min(sy, ey));
    const x2 = Math.min(this._data?.floor_w || 10, Math.max(sx, ex));
    const y2 = Math.min(this._data?.floor_h || 10, Math.max(sy, ey));
    if (x2 - x1 < 0.3 || y2 - y1 < 0.3) return;

    // Snap edges to floor boundaries and existing room walls
    const fw = this._data?.floor_w || 10;
    const fh = this._data?.floor_h || 10;
    const SNAP = 0.3; // snap threshold in metres

    let sx1 = x1, sy1 = y1, sx2 = x2, sy2 = y2;

    // Snap to floor boundaries
    if (sx1 < SNAP) sx1 = 0;
    if (sy1 < SNAP) sy1 = 0;
    if (sx2 > fw - SNAP) sx2 = fw;
    if (sy2 > fh - SNAP) sy2 = fh;

    // Snap to existing room walls
    for (const r of this._pendingRooms) {
      for (const wall of [r.x1, r.x2]) {
        if (Math.abs(sx1 - wall) < SNAP) sx1 = wall;
        if (Math.abs(sx2 - wall) < SNAP) sx2 = wall;
      }
      for (const wall of [r.y1, r.y2]) {
        if (Math.abs(sy1 - wall) < SNAP) sy1 = wall;
        if (Math.abs(sy2 - wall) < SNAP) sy2 = wall;
      }
    }

    // Clip against existing rooms to prevent full overlap
    // (allow touching/sharing walls but not fully enclosed)
    // Simple: reduce the new room if it fully covers another
    for (const r of this._pendingRooms) {
      const overlapX = Math.max(0, Math.min(sx2, r.x2) - Math.max(sx1, r.x1));
      const overlapY = Math.max(0, Math.min(sy2, r.y2) - Math.max(sy1, r.y1));
      const newArea  = (sx2 - sx1) * (sy2 - sy1);
      const overlapArea = overlapX * overlapY;
      // If new room is >80% inside existing room → reject
      if (newArea > 0 && overlapArea / newArea > 0.8) {
        this._drawState.active = false;
        this._rebuildSidebar();
        return;
      }
    }

    const colors = ["rgba(100,180,255,0.18)","rgba(255,160,80,0.18)","rgba(120,220,130,0.18)",
                    "rgba(220,120,220,0.18)","rgba(255,220,80,0.18)","rgba(80,200,200,0.18)"];
    if (!this._roomHistory) this._roomHistory = [];
    this._roomHistory.push(structuredClone(this._pendingRooms));
    if (this._roomHistory.length > 30) this._roomHistory.shift();
    this._pendingRooms.push({
      name:  `Raum ${this._pendingRooms.length + 1}`,
      x1: parseFloat(sx1.toFixed(2)), y1: parseFloat(sy1.toFixed(2)),
      x2: parseFloat(sx2.toFixed(2)), y2: parseFloat(sy2.toFixed(2)),
      color: colors[this._pendingRooms.length % colors.length],
      zone_type: "indoor",
      zones: [],
      presence_entity: "",
    });
    this._rebuildSidebar();
  }

  _onCanvasLeave() {
    const tip = this.shadowRoot.getElementById("tip");
    if (tip) tip.style.display = "none";
    if (this._mode === "rooms") { this._drawState.active = false; this._roomDrag = null; }
  }

  _updateRoomCursor(mx, my) {
    if (!this._canvas) return;
    const scaleX = (this._data?.floor_w||10) / this._canvas.width;
    const scaleY = (this._data?.floor_h||10) / this._canvas.height;
    const hrm    = 10 * Math.max(scaleX, scaleY);
    for (let i = this._pendingRooms.length-1; i >= 0; i--) {
      const r = this._pendingRooms[i];
      const corners = [
        {h:"tl",mx:r.x1,my:r.y1},{h:"tr",mx:r.x2,my:r.y1},
        {h:"bl",mx:r.x1,my:r.y2},{h:"br",mx:r.x2,my:r.y2},
      ];
      if (corners.some(c => Math.hypot(mx-c.mx,my-c.my) < hrm)) {
        this._canvas.style.cursor = "nwse-resize"; return;
      }
      if (mx>=r.x1&&mx<=r.x2&&my>=r.y1&&my<=r.y2) {
        this._canvas.style.cursor = "move"; return;
      }
    }
    this._canvas.style.cursor = "crosshair";
  }

  // ── Fingerprint helpers ───────────────────────────────────────────────────

  _hasFpAt(mx, my) {
    const key = `${mx.toFixed(2)}_${my.toFixed(2)}`;
    // 1. Check real fingerprints from backend (returns fp object for color info)
    const fps = this._data?.fingerprints || [];
    const fp = fps.find(f =>
      f.device_id === this._devId &&
      Math.abs(f.mx - mx) < 0.015 &&
      Math.abs(f.my - my) < 0.015
    );
    if (fp) return fp;  // return fp object so _fpColor() can use ts/auto
    // 2. Local hint (captured this session but not yet polled)
    if (this._localFpHints[key]) return { ts: Date.now()/1000, auto: false };
    return false;
  }

  // ── Backend calls ────────────────────────────────────────────────────────

  async _captureWizardPoint() {
    // Capture at current device position (snapped to nearest grid point)
    const dev = (this._data?.devices || []).find(d => d.device_id === this._devId);
    const ema = this._ema[this._devId];
    const px  = ema ? ema.x : (dev?.x || 0);
    const py  = ema ? ema.y : (dev?.y || 0);

    // Snap to nearest grid point
    const snapped = this._snapToGrid(px, py);
    if (!snapped) {
      // No grid point nearby - capture at raw position rounded to grid step
      const step = this._data?.grid_step || 0.5;
      const mx = Math.round(px / step) * step;
      const my = Math.round(py / step) * step;
      await this._captureAt(mx, my);
    } else {
      await this._captureAt(snapped.mx, snapped.my);
    }
  }

  async _captureAt(mx, my) {
    try {
      await this._hass.callApi("POST",
        `ble_positioning/${this._entryId}/capture`,
        { device_id: this._devId, x: mx, y: my });
      this._localFpHints[`${mx.toFixed(2)}_${my.toFixed(2)}`] = true;
      this._checkWizardRefinement();
      const status = this.shadowRoot.getElementById("cal_status");
      if (status) status.textContent = `✓ Aufgenommen bei ${mx.toFixed(2)}m / ${my.toFixed(2)}m`;
      this._showToast(`✓ Punkt aufgenommen: ${mx.toFixed(2)} / ${my.toFixed(2)}`);
      // Refresh data to update room progress
      await this._loadData();
      // Auto-select farthest uncalibrated point in wizard room
      if (this._wizardMode) {
        const nextPt = this._wizardNextPoint(mx, my);
        if (nextPt) {
          this._selGridPt = nextPt;
          const sel = this.shadowRoot.getElementById("cal_sel");
          if (sel) sel.textContent = `${nextPt.mx.toFixed(2)} / ${nextPt.my.toFixed(2)}`;
        } else {
          this._selGridPt = null;  // alle kalibriert
        }
      }
      this._rebuildSidebar();
    } catch(e) {
      const errMsg = e?.message || e?.error || (typeof e === "string" ? e : JSON.stringify(e));
      this._showCalStatus("✗ " + (errMsg || "Unbekannter Fehler"), "var(--red)");
      this._showToast("✗ " + (errMsg || "Fehler beim Speichern"));
    }
  }

  async _captureFingerprint() {
    if (!this._selGridPt) return;
    const { mx, my } = this._selGridPt;
    // _captureAt behandelt alles intern inkl. Fehler, nextPt-Auswahl und Sidebar-Update
    await this._captureAt(mx, my);
  }

  async _clearFingerprints() {
    if (!confirm("Alle Fingerprints löschen?")) return;
    await this._hass.callApi("POST",
      `ble_positioning/${this._entryId}/clear`, { device_id: this._devId });
    this._localFpHints = {};
    await this._loadData();
    this._rebuildSidebar();
    this._showCalStatus("Alle gelöscht", "var(--red)");
  }

  async _exportFP() {
    const data = await this._hass.callApi("GET",
      `ble_positioning/${this._entryId}/export?device_id=${this._devId}`);
    const a = document.createElement("a");
    a.href     = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    a.download = `ble_fp_${this._devId}.json`;
    a.click();
  }

  async _importFP(e) {
    const file = e.target.files[0]; if (!file) return;
    const text = await file.text();
    try {
      await this._hass.callApi("POST",
        `ble_positioning/${this._entryId}/import`,
        JSON.parse(text));
      await this._loadData();
      this._rebuildSidebar();
      this._showCalStatus("✓ Importiert", "var(--green)");
    } catch (err) {
      this._showCalStatus("✗ Import Fehler", "var(--red)");
    }
  }

  async _saveMapSize(w, h) {
    if (!this._data) return;
    try {
      // Update entry data via a dedicated endpoint or scanner endpoint as workaround
      // We reuse the existing update_scanners endpoint to also carry floor dimensions
      // by storing them in a special __floor__ scanner entry
      // Instead: call a new /floor endpoint
      await this._hass.callApi("POST",
        `ble_positioning/${this._entryId}/floor`,
        { floor_w: w, floor_h: h });
      this._data.floor_w = w;
      this._data.floor_h = h;
      this._onResize();
      this._buildGrid();
      this._showToast(`✓ Grundriss: ${w}m × ${h}m`);
    } catch(e) {
      const errMsg = e?.message || e?.error || (typeof e === "string" ? e : JSON.stringify(e));
      this._showCalStatus("✗ " + (errMsg || "Unbekannter Fehler"), "var(--red)");
      this._showToast("✗ " + (errMsg || "Fehler beim Speichern"));
    }
    this._rebuildSidebar();
  }

  async _saveScanners() {
    try {
      await this._hass.callApi("POST",
        `ble_positioning/${this._entryId}/scanners`,
        { scanners: this._pendingScanners });
      // Update local data without resetting pending state
      if (this._data) this._data.scanners = structuredClone(this._pendingScanners);
      this._showToast("✓ Scanner gespeichert");
    } catch(e) {
      const errMsg = e?.message || e?.error || (typeof e === "string" ? e : JSON.stringify(e));
      this._showCalStatus("✗ " + (errMsg || "Unbekannter Fehler"), "var(--red)");
      this._showToast("✗ " + (errMsg || "Fehler beim Speichern"));
    }
    this._rebuildSidebar();
  }

  async _saveRooms() {
    try {
      // Lese aktuelle Grundriss-Größe aus den Feldern
      const mapW = parseFloat(this.shadowRoot.getElementById("map_w")?.value || this._data?.floor_w || 10);
      const mapH = parseFloat(this.shadowRoot.getElementById("map_h")?.value || this._data?.floor_h || 10);

      // Grundriss-Größe speichern falls geändert
      if (!isNaN(mapW) && !isNaN(mapH) && mapW >= 1 && mapH >= 1) {
        if (mapW !== this._data?.floor_w || mapH !== this._data?.floor_h ||
            Math.abs((this._imgOpacity||0.35) - (this._data?.img_opacity||0.35)) > 0.001) {
          await this._hass.callApi("POST",
            `ble_positioning/${this._entryId}/floor`,
            { floor_w: mapW, floor_h: mapH, img_opacity: this._imgOpacity ?? 0.35 });
          if (this._data) { this._data.floor_w = mapW; this._data.floor_h = mapH; this._data.img_opacity = this._imgOpacity; }
        }
      }

      // Räume, Türen, Fenster und Türen-Penalty speichern
      await this._hass.callApi("POST",
        `ble_positioning/${this._entryId}/rooms`,
        { rooms: this._pendingRooms, doors: this._pendingDoors,
          windows: this._pendingWindows, door_penalty: this._doorPenalty });

      if (this._data) {
        this._data.rooms   = structuredClone(this._pendingRooms);
        this._data.doors   = structuredClone(this._pendingDoors);
        this._data.windows = structuredClone(this._pendingWindows);
        this._buildGrid();
      }
      this._showToast("✓ Raumbearbeitung gespeichert");
    } catch(e) {
      const errMsg = e?.message || e?.error || (typeof e === "string" ? e : JSON.stringify(e));
      this._showCalStatus("✗ " + (errMsg || "Unbekannter Fehler"), "var(--red)");
      this._showToast("✗ " + (errMsg || "Fehler beim Speichern"));
    }
    this._rebuildSidebar();
  }

  // ── UI helpers ────────────────────────────────────────────────────────────

  _showCalStatus(msg, color) {
    const el = this.shadowRoot.getElementById("cal_status");
    if (!el) return;
    el.textContent  = msg;
    el.style.color  = color || "var(--yellow)";
    clearTimeout(this._calStatusTimer);
    this._calStatusTimer = setTimeout(() => { el.textContent = ""; }, 3000);
  }

  _showToast(msg) {
    const t = this.shadowRoot.getElementById("toast");
    if (!t) return;
    t.textContent   = msg;
    t.style.display = "block";
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => { t.style.display = "none"; }, 3000);
  }

  _setConnected(ok) {
    const dot = this.shadowRoot.getElementById("conn");
    if (dot) dot.className = "conn-dot" + (ok ? " ok" : "");
  }

  _roomHexColor(rgba) {
    // Convert rgba string to #rrggbb for color input
    if (!rgba) return "#6480ff";
    const m = rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (!m) return "#6480ff";
    return "#" + [m[1],m[2],m[3]].map(n => parseInt(n).toString(16).padStart(2,"0")).join("");
  }

  _roomSolidColor(rgba) {
    if (!rgba) return "#444";
    const m = rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (!m) return rgba;
    return `#${[m[1],m[2],m[3]].map(v => parseInt(v).toString(16).padStart(2,"0")).join("")}`;
  }

  // ── Render loop ──────────────────────────────────────────────────────────

  _startRenderLoop() {
    let lastPoll = 0;
    const loop = (ts) => {
      this._draw();
      // Poll card_data every 500ms for live position updates
      if (ts - lastPoll > 500) {
        lastPoll = ts;
        this._pollPositions();
      }
      this._raf = requestAnimationFrame(loop);
    };
    this._raf = requestAnimationFrame(loop);
  }

  async _pollPositions() {
    // Poll in view, lights AND calibrate mode (so FP dots stay fresh)
    if (!["view", "lights", "calibrate", "energie"].includes(this._mode)) return;
    try {
      const res = await this._hass.callApi("GET",
        `ble_positioning/${this._entryId}/card_data`);
      if (!res || !this._data) return;

      // Always update lights, fingerprints and info sensors
      if (res.lights?.length > 0) this._data.lights = res.lights; // FIX: nie mit leerem Array überschreiben
      this._data.info_sensors  = res.info_sensors || [];
      if (res.decos) { this._data.decos = res.decos; this._pendingDecos = structuredClone(res.decos); }
      this._pendingInfoSensors = structuredClone(res.info_sensors || []);

      this._data.fingerprints = res.fingerprints;  // FIX4: keep FP dots fresh
      this._data.windows      = res.windows || [];
      this._windows           = res.windows || [];
      this._data.fp_counts    = res.fp_counts;

      if (this._mode === "view") {
        this._data.devices = res.devices;
        // FIX3: device away (x/y=null) → clear EMA so dot disappears
        res.devices.forEach(dev => {
          const x = dev.x, y = dev.y;
          if (x == null || y == null) {
            delete this._ema[dev.device_id];
            return;
          }
          if (!this._ema[dev.device_id]) {
            this._ema[dev.device_id] = { x, y };
          } else {
            const e = this._ema[dev.device_id];
            const dist = Math.hypot(x - e.x, y - e.y);
            const alpha = dist > 2.0 ? 0.85 : dist > 1.0 ? 0.6 : 0.4;
            e.x += alpha * (x - e.x);
            e.y += alpha * (y - e.y);
          }
        });
        this._updateSidebarFromData(res.devices);
      }
      this._setConnected(true);
    } catch (_) {
      this._setConnected(false);
    }
  }

  _updateSidebarFromData(devices) {
    const dev = devices.find(d => d.device_id === this._devId);
    if (!dev) return;
    const set = (id, val) => {
      const el = this.shadowRoot.getElementById(id);
      if (el) el.textContent = val ?? "--";
    };
    set("pv_room",    dev.room);
    // Zone detection: find room, check which zone the device is in
    const devRoomObj = (this._data?.rooms||[]).find(r=>r.name===dev.room);
    if (devRoomObj && devRoomObj.zones && devRoomObj.zones.length && dev.x!=null && dev.y!=null) {
      const rW = devRoomObj.x2 - devRoomObj.x1, rH = devRoomObj.y2 - devRoomObj.y1;
      const relX = rW>0 ? (dev.x - devRoomObj.x1)/rW : 0;
      const relY = rH>0 ? (dev.y - devRoomObj.y1)/rH : 0;
      const activeZone = devRoomObj.zones.find(z =>
        relX >= (z.rx1||0) && relX <= (z.rx2||1) && relY >= (z.ry1||0) && relY <= (z.ry2||1));
      const zoneBox = this.shadowRoot.getElementById("pv_zone_box");
      if (zoneBox) zoneBox.style.display = activeZone ? "" : "none";
      set("pv_zone", activeZone ? activeZone.name : "--");
    } else {
      const zoneBox = this.shadowRoot.getElementById("pv_zone_box");
      if (zoneBox) zoneBox.style.display = "none";
    }
    set("pv_x",       dev.x != null ? parseFloat(dev.x).toFixed(2) + "m" : "--");
    set("pv_y",       dev.y != null ? parseFloat(dev.y).toFixed(2) + "m" : "--");
    set("pv_score",   dev.confidence != null ? parseFloat(dev.confidence).toFixed(2) : "--");
    set("pv_fpcount", dev.fp_count ?? "--");
    set("pv_actoday", dev.ac_today ?? "--");
    // Scanner distances: use device-specific entity if available
    const devEntities = dev.scanner_entities || {};
    (this._data?.scanners || []).forEach(s => {
      const sid     = s.nearest_key || s.id;
      const eid     = devEntities[sid] || s.entity || "";
      const state   = eid ? this._hass?.states?.[eid] : null;
      const val     = state ? parseFloat(state.state) : NaN;
      const el      = this.shadowRoot.getElementById(`sv_${s.id}`);
      if (el) el.textContent = isNaN(val) ? "--" : val.toFixed(1) + "m";
      const bar     = this.shadowRoot.getElementById(`bar_${s.id}`);
      if (bar) bar.style.width = isNaN(val) ? "0%" : Math.max(0, Math.min(100, (1-val/8)*100)) + "%";
    });
  }

  // ── Lights sidebar ────────────────────────────────────────────────────────

  _sidebarLights() {
    const wrap  = document.createElement("div");
    const rooms = this._data?.rooms || [];

    // ── Info ─────────────────────────────────────────────────────────────
    const info = document.createElement("div");
    info.style.cssText =
      "font-size:8px;color:var(--muted);margin-bottom:8px;line-height:1.7;" +
      "padding:6px 8px;background:var(--surf2);border-radius:4px;" +
      "border-left:3px solid var(--yellow)";
    info.innerHTML =
      "Leuchte anlegen: Raum wählen → HA-Entity eintragen → " +
      "Position auf Karte klicken.<br>" +
      "<b style=\'color:var(--yellow)\'>Das Licht wird hart an den Raumwänden begrenzt.</b>";
    wrap.appendChild(info);

    // ── Add button ────────────────────────────────────────────────────────
    const addBtn = document.createElement("button");
    addBtn.className = this._placingLight ? "btn btn-yellow" : "btn btn-outline";
    addBtn.style.cssText = "width:100%;margin-bottom:8px;font-size:10px";
    addBtn.textContent = this._placingLight
      ? "🖱 Jetzt auf Karte klicken…"
      : "+ Neue Leuchte hinzufügen";
    addBtn.addEventListener("click", () => {
      this._placingLight = !this._placingLight;
      this._rebuildSidebar();
    });
    wrap.appendChild(addBtn);

    // ── Light list ────────────────────────────────────────────────────────
    const lights = this._pendingLights;

    if (lights.length === 0) {
      const empty = document.createElement("div");
      empty.style.cssText = "font-size:8px;color:var(--muted);text-align:center;padding:14px 0";
      empty.textContent = "Noch keine Leuchten definiert";
      wrap.appendChild(empty);
    }

    lights.forEach((light, idx) => {
      const box = document.createElement("div");
      box.style.cssText =
        "border:1px solid var(--border);border-radius:5px;padding:7px 8px;" +
        "margin-bottom:6px;background:var(--surf2)";

      // ── Name + delete ────────────────────────────────────────────────
      const hdr = document.createElement("div");
      hdr.style.cssText = "display:flex;align-items:center;gap:5px;margin-bottom:5px";
      const bulb = document.createElement("span");
      bulb.textContent = "💡"; bulb.style.fontSize = "12px";
      const nameInp = document.createElement("input");
      nameInp.type = "text"; nameInp.value = light.name || `Leuchte ${idx+1}`;
      nameInp.placeholder = "Name";
      nameInp.style.cssText =
        "flex:1;padding:2px 5px;border-radius:3px;border:1px solid var(--border);" +
        "background:var(--bg);color:var(--text);font-size:9px";
      nameInp.addEventListener("change", () => { this._pendingLights[idx].name = nameInp.value; });
      const delBtn = document.createElement("button");
      delBtn.className = "btn btn-red";
      delBtn.style.cssText = "padding:2px 6px;font-size:9px";
      delBtn.textContent = "✕";
      delBtn.addEventListener("click", () => {
        this._pendingLights.splice(idx, 1);
        this._rebuildSidebar();
      });
      hdr.appendChild(bulb); hdr.appendChild(nameInp); hdr.appendChild(delBtn);
      box.appendChild(hdr);

      // ── Room selector (the key new field) ────────────────────────────
      const roomRow = document.createElement("div");
      roomRow.style.cssText = "display:flex;align-items:center;gap:4px;margin-bottom:5px";
      const roomLbl = document.createElement("span");
      roomLbl.style.cssText = "font-size:8px;color:var(--muted);white-space:nowrap;min-width:40px";
      roomLbl.textContent = "Raum:";
      const roomSel = document.createElement("select");
      roomSel.style.cssText =
        "flex:1;padding:2px 4px;border-radius:3px;border:1px solid var(--border);" +
        "background:var(--bg);color:var(--text);font-size:8.5px";

      // Empty option
      const optNone = document.createElement("option");
      optNone.value = ""; optNone.textContent = "— Raum wählen —";
      if (!light.room_id) optNone.selected = true;
      roomSel.appendChild(optNone);

      // One option per room
      rooms.forEach((r, ri) => {
        const opt = document.createElement("option");
        opt.value = ri;
        opt.textContent = r.name || `Raum ${ri+1}`;
        if (String(light.room_id) === String(ri)) opt.selected = true;
        roomSel.appendChild(opt);
      });

      roomSel.addEventListener("change", () => {
        const v = roomSel.value;
        this._pendingLights[idx].room_id = v === "" ? null : parseInt(v, 10);
        this._rebuildSidebar();
      });

      // Warn if no room assigned
      if (light.room_id == null) {
        const warn = document.createElement("span");
        warn.style.cssText = "font-size:8px;color:var(--red)";
        warn.textContent = "⚠";
        warn.title = "Bitte Raum zuweisen – sonst kein Clipping!";
        roomRow.appendChild(roomLbl); roomRow.appendChild(roomSel); roomRow.appendChild(warn);
      } else {
        roomRow.appendChild(roomLbl); roomRow.appendChild(roomSel);
      }
      box.appendChild(roomRow);

      // ── Entity ────────────────────────────────────────────────────────
      const entRow = document.createElement("div");
      entRow.style.cssText = "display:flex;align-items:center;gap:4px;margin-bottom:4px";
      const entLbl = document.createElement("span");
      entLbl.style.cssText = "font-size:8px;color:var(--muted);white-space:nowrap;min-width:40px";
      entLbl.textContent = "Entity:";
      const entInp = document.createElement("input");
      entInp.type = "text"; entInp.value = light.entity || "";
      entInp.placeholder = "light.wohnzimmer";
      entInp.style.cssText =
        "flex:1;padding:2px 5px;border-radius:3px;border:1px solid var(--border);" +
        "background:var(--bg);color:var(--text);font-size:8.5px;font-family:monospace";
      entInp.addEventListener("change", () => {
        this._pendingLights[idx].entity = entInp.value.trim();
        this._rebuildSidebar();
      });
      entRow.appendChild(entLbl); entRow.appendChild(entInp);
      box.appendChild(entRow);

      // ── Lampentyp-Picker ──────────────────────────────────────────────
      // Merge built-in + custom lamp designs
      const customLampTypes = (this._pendingDesigns||[])
        .filter(d=>d.use_as_lamp||d.category==="lamp"||d.category==="both")
        .map(d=>({ id:d.id, icon:"🎨", label:d.name, custom:true, design:d }));
      const LAMP_TYPES = [
        ...customLampTypes.length ? [{ id:"__sep__", icon:"", label:"── Eigene ──", disabled:true }].concat(customLampTypes).concat([{ id:"__sep2__", icon:"", label:"── Standard ──", disabled:true }]) : [],
        { id:"bulb",        icon:"💡", label:"Glühbirne"    },
        { id:"globe",       icon:"🔮", label:"Kugel"        },
        { id:"pendant",     icon:"🏮", label:"Hängeleuchte" },
        { id:"spot",        icon:"🔦", label:"Spot/Strahler" },
        { id:"floor",       icon:"🕯",  label:"Stehlampe"   },
        { id:"table",       icon:"🪔",  label:"Tischlampe"  },
        { id:"desk",        icon:"💼",  label:"Bürolampe"   },
        { id:"strip",       icon:"〰",  label:"LED-Streifen" },
        { id:"neon",        icon:"⚡",  label:"Neon/Röhre"  },
        { id:"ceiling",     icon:"⬛",  label:"Deckenleuchte"},
        { id:"chandelier",  icon:"👑",  label:"Kronleuchter" },
        { id:"wall",        icon:"▣",   label:"Wandleuchte"  },
      ];
      const ltRow = document.createElement("div");
      ltRow.style.cssText = "margin-bottom:5px";
      const ltHdr = document.createElement("div");
      ltHdr.style.cssText = "display:flex;align-items:center;justify-content:space-between;margin-bottom:3px";
      const ltLbl2 = document.createElement("span");
      ltLbl2.style.cssText = "font-size:8px;color:var(--muted)";
      ltLbl2.textContent = "Lampentyp:";
      const ltCurrent = document.createElement("button");
      const curType = LAMP_TYPES.find(t=>t.id===(light.lamp_type||"bulb")) || LAMP_TYPES[0];
      ltCurrent.style.cssText = "display:flex;align-items:center;gap:4px;padding:3px 8px;border-radius:5px;border:1px solid #f59e0b55;background:#f59e0b11;color:var(--text);font-size:9px;cursor:pointer;font-family:inherit";
      ltCurrent.innerHTML = `<span style="font-size:14px">${curType.icon}</span><span style="font-weight:700">${curType.label}</span>`;
      ltHdr.append(ltLbl2, ltCurrent);
      ltRow.appendChild(ltHdr);

      // Picker grid (collapsible)
      const ltGrid = document.createElement("div");
      ltGrid.style.cssText = "display:none;grid-template-columns:repeat(4,1fr);gap:3px;margin-top:3px";
      LAMP_TYPES.forEach(lt => {
        if (lt.disabled) {
          const sep2 = document.createElement("div");
          sep2.style.cssText = "grid-column:1/-1;font-size:7px;color:var(--muted);padding:2px 0;text-align:center;border-top:1px solid var(--border)";
          sep2.textContent = lt.label;
          ltGrid.appendChild(sep2); return;
        }
        const btn = document.createElement("button");
        const isAct = (light.lamp_type||"bulb") === lt.id;
        btn.style.cssText = `padding:4px 2px;border-radius:5px;border:1px solid ${isAct?"#f59e0b":"var(--border)"};`+
          `background:${isAct?"#f59e0b22":"var(--surf3)"};color:${isAct?"#f59e0b":"var(--text)"};`+
          `font-size:8px;cursor:pointer;text-align:center;font-family:inherit`;
        btn.innerHTML = `<div style="font-size:15px">${lt.icon}</div><div style="font-size:7px;margin-top:1px">${lt.label}</div>`;
        btn.addEventListener("click", () => {
          this._pendingLights[idx].lamp_type = lt.id;
          ltGrid.style.display = "none";
          this._rebuildSidebar();
          this._draw();
        });
        ltGrid.appendChild(btn);
      });
      ltCurrent.addEventListener("click", () => {
        ltGrid.style.display = ltGrid.style.display==="none" ? "grid" : "none";
      });
      ltRow.appendChild(ltGrid);
      box.appendChild(ltRow);

      // ── Mount height ──────────────────────────────────────────────────
      const hRow = document.createElement("div");
      hRow.style.cssText = "display:flex;align-items:center;gap:5px;margin-bottom:4px";
      const hLbl = document.createElement("span");
      hLbl.style.cssText = "font-size:8px;color:var(--muted);white-space:nowrap;min-width:40px";
      hLbl.textContent = "Höhe (m):";
      const hInp = document.createElement("input");
      hInp.type = "number"; hInp.step = "0.1"; hInp.min = "0.1";
      const wallHdef = Math.max(0.5, Math.min(6, this._wallHeight ?? 2.5));
      hInp.value = light.mz != null ? light.mz : (wallHdef * 0.88).toFixed(1);
      hInp.placeholder = (wallHdef * 0.88).toFixed(1);
      hInp.style.cssText =
        "flex:1;padding:2px 5px;border-radius:3px;border:1px solid var(--border);" +
        "background:var(--bg);color:var(--text);font-size:8.5px";
      hInp.addEventListener("change", () => {
        const v = parseFloat(hInp.value);
        this._pendingLights[idx].mz = isNaN(v) ? null : Math.max(0.1, v);
      });
      hRow.appendChild(hLbl); hRow.appendChild(hInp);
      box.appendChild(hRow);

      // ── Lumen ────────────────────────────────────────────────────────
      const lmRow = document.createElement("div");
      lmRow.style.cssText = "display:flex;align-items:center;gap:4px;margin-bottom:4px";
      const lmLbl = document.createElement("span");
      lmLbl.style.cssText = "font-size:8px;color:var(--muted);white-space:nowrap;min-width:40px";
      lmLbl.textContent = "Lumen (lm):";
      const lmInp = document.createElement("input");
      lmInp.type = "number"; lmInp.min = "1"; lmInp.step = "50";
      lmInp.value = light.lumen != null ? light.lumen : 800;
      lmInp.placeholder = "800";
      lmInp.style.cssText =
        "width:60px;padding:2px 5px;border-radius:3px;border:1px solid var(--border);" +
        "background:var(--bg);color:var(--text);font-size:8.5px";
      lmInp.addEventListener("change", () => {
        const v = parseFloat(lmInp.value);
        this._pendingLights[idx].lumen = isNaN(v) ? 800 : Math.max(1, v);
        this._draw();
      });
      // Preset buttons: 400 / 810 / 1600 / 2700lm
      const lmPresets = document.createElement("div");
      lmPresets.style.cssText = "display:flex;gap:2px;flex-wrap:wrap";
      [400, 810, 1600, 2700].forEach(lm => {
        const pb = document.createElement("button");
        pb.textContent = lm >= 1000 ? (lm/1000).toFixed(1)+"k" : lm+"";
        const isActive = Math.abs((light.lumen||800) - lm) < 5;
        pb.style.cssText = `padding:1px 4px;font-size:7px;border-radius:3px;cursor:pointer;` +
          `border:1px solid ${isActive?"#f59e0b":"var(--border)"};` +
          `background:${isActive?"#f59e0b22":"var(--surf3)"};` +
          `color:${isActive?"#f59e0b":"var(--muted)"}`;
        pb.title = lm + " lm";
        pb.addEventListener("click", () => {
          this._pendingLights[idx].lumen = lm;
          lmInp.value = lm;
          this._rebuildSidebar();
          this._draw();
        });
        lmPresets.appendChild(pb);
      });
      lmRow.append(lmLbl, lmInp, lmPresets);
      box.appendChild(lmRow);

      // Lumen-Indicator: visual brightness bar
      const lmBar = document.createElement("div");
      lmBar.style.cssText = "height:3px;background:var(--surf3);border-radius:2px;margin-bottom:5px;overflow:hidden";
      const lmFill = document.createElement("div");
      const lmNorm = Math.min(1, (light.lumen||800) / 2700);
      const lmR = Math.round(255 * Math.min(1, lmNorm * 2));
      const lmG = Math.round(255 * Math.min(1, lmNorm < 0.5 ? lmNorm * 2 : 2 - lmNorm * 2) * 0.9 + 200 * (1 - lmNorm));
      lmFill.style.cssText = `height:100%;width:${(lmNorm*100).toFixed(0)}%;` +
        `background:rgb(${lmR},${lmG},50);border-radius:2px;transition:width 0.3s`;
      lmBar.appendChild(lmFill);
      box.appendChild(lmBar);

      // ── Live state preview ────────────────────────────────────────────
      if (light.entity) {
        const state = this._hass?.states?.[light.entity];
        const stateRow = document.createElement("div");
        stateRow.style.cssText = "display:flex;align-items:center;gap:5px;margin-bottom:4px";
        if (!state) {
          stateRow.innerHTML = `<span style="font-size:8px;color:var(--red)">⚠ Entity nicht gefunden</span>`;
        } else {
          const on = state.state === "on";
          const bri = state.attributes.brightness;
          const rgb = state.attributes.rgb_color;
          const briPct = bri ? Math.round(bri / 255 * 100) : 0;
          const col = rgb ? `rgb(${rgb[0]},${rgb[1]},${rgb[2]})` : (on ? "#fff8e0" : "#333");
          stateRow.innerHTML =
            `<div style="width:12px;height:12px;border-radius:50%;background:${col};` +
            `box-shadow:0 0 6px 2px ${col};border:1px solid var(--border)"></div>` +
            `<span style="font-size:8px;color:${on ? "var(--green)" : "var(--muted)"}">` +
            `${on ? "AN" : "AUS"}${on ? " · " + briPct + "%" : ""}</span>`;
        }
        box.appendChild(stateRow);
      }

      // ── Position + move ───────────────────────────────────────────────
      const posRow = document.createElement("div");
      posRow.style.cssText = "display:flex;align-items:center;gap:5px";
      const posLbl = document.createElement("span");
      posLbl.style.cssText = "font-size:8px;color:var(--muted);flex:1";
      posLbl.textContent = light.mx != null
        ? `Pos: ${light.mx.toFixed(1)}m / ${light.my.toFixed(1)}m`
        : "Noch nicht platziert";
      const moveBtn = document.createElement("button");
      moveBtn.className = "btn btn-outline";
      moveBtn.style.cssText = "font-size:8px;padding:2px 5px";
      moveBtn.textContent = "↖ Verschieben";
      moveBtn.addEventListener("click", () => {
        this._selLight = idx;
        this._placingLight = true;
        this._showToast(`Neue Position für "${light.name}" klicken`);
        this._rebuildSidebar();
      });
      posRow.appendChild(posLbl); posRow.appendChild(moveBtn);
      box.appendChild(posRow);

      wrap.appendChild(box);
    });

    // ── Save ──────────────────────────────────────────────────────────────
    const saveBtn = document.createElement("button");
    saveBtn.className = "btn btn-green";
    saveBtn.style.cssText = "width:100%;margin-top:4px;font-size:10px";
    saveBtn.disabled = lights.length === 0;
    saveBtn.textContent = lights.length === 0
      ? "Keine Leuchten"
      : `💾 Speichern (${lights.length})`;
    saveBtn.addEventListener("click", async () => {
      try {
        saveBtn.disabled = true; saveBtn.textContent = "...";
        await this._hass.callApi("POST",
          `ble_positioning/${this._entryId}/lights`,
          { lights: this._pendingLights });
        await this._loadData();
        this._showToast(`${lights.length} Leuchte${lights.length !== 1 ? "n" : ""} gespeichert`);
        saveBtn.textContent = "✓ Gespeichert";
        this._setTimeout(() => {
          saveBtn.disabled = false;
          saveBtn.textContent = `💾 Speichern (${lights.length})`;
        }, 1500);
      } catch(e) {
        saveBtn.disabled = false;
        saveBtn.textContent = `💾 Speichern (${lights.length})`;
        this._showToast("Fehler: " + e.message);
      }
    });
    wrap.appendChild(saveBtn);

    return wrap;
  }

  // ── ALARM SIDEBAR ────────────────────────────────────────────────────────
  _sidebarAlarm() {
    const wrap  = document.createElement("div");
    const rooms = this._data?.rooms || [];

    // Info
    const info = document.createElement("div");
    info.style.cssText = "font-size:8px;color:var(--muted);margin-bottom:8px;line-height:1.6;" +
      "padding:6px 8px;background:var(--surf2);border-radius:4px;border-left:3px solid var(--red)";
    info.textContent = "Alarm-Sensor hinterlegen: Bei Auslösung leuchtet der Raum (oder alle Räume) in der gewählten Farbe auf.";
    wrap.appendChild(info);

    // Liste vorhandener Alarme
    const alarms = this._pendingAlarms;
    if (alarms.length === 0 && !this._addingAlarm) {
      const empty = document.createElement("div");
      empty.style.cssText = "font-size:8px;color:var(--muted);text-align:center;padding:14px 0";
      empty.textContent = "Noch keine Alarm-Sensoren definiert";
      wrap.appendChild(empty);
    }

    alarms.forEach((al, idx) => {
      const isEdit = this._editAlarm === idx;
      const box = document.createElement("div");
      box.style.cssText = "border:1px solid " + (isEdit ? "var(--red)" : "var(--border)") +
        ";border-radius:5px;padding:6px 8px;margin-bottom:6px;background:var(--surf2);cursor:pointer";

      // Header: Farb-Dot + Name + Status + Del
      const hdr = document.createElement("div");
      hdr.style.cssText = "display:flex;align-items:center;gap:5px";
      const dot = document.createElement("span");
      dot.style.cssText = "width:10px;height:10px;border-radius:2px;flex-shrink:0;background:" + (al.color || "#ff2222");
      const nm = document.createElement("span");
      nm.style.cssText = "flex:1;font-size:9px;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap";
      nm.textContent = al.name || al.entity || "Alarm";
      // Live-Status aus HA
      const stateVal = this._hass?.states?.[al.entity]?.state || "";
      const active = ["on","true","1","triggered","motion","wet","smoke"].includes(stateVal.toLowerCase());
      const stateDot = document.createElement("span");
      stateDot.style.cssText = "font-size:9px;" + (active ? "color:var(--red)" : "color:var(--muted)");
      stateDot.textContent = active ? "🔴" : "⚪";
      const delBtn = document.createElement("button");
      delBtn.style.cssText = "background:none;border:none;color:var(--muted);cursor:pointer;font-size:10px;padding:0 2px";
      delBtn.textContent = "✕";
      delBtn.addEventListener("click", e => {
        e.stopPropagation();
        this._pendingAlarms.splice(idx, 1);
        this._editAlarm = null;
        this._rebuildSidebar();
      });
      hdr.append(dot, nm, stateDot, delBtn);
      box.appendChild(hdr);
      box.addEventListener("click", () => {
        this._editAlarm = isEdit ? null : idx;
        this._rebuildSidebar();
      });

      if (isEdit) {
        const form = document.createElement("div");
        form.style.cssText = "display:flex;flex-direction:column;gap:4px;margin-top:6px";
        form.addEventListener("click", e => e.stopPropagation());

        const mkField = (lbl, val, cb, ph) => {
          const l = document.createElement("span");
          l.style.cssText = "font-size:8px;color:var(--muted)";
          l.textContent = lbl;
          const inp = document.createElement("input");
          inp.value = val || ""; inp.placeholder = ph || "";
          inp.style.cssText = "width:100%;background:var(--bg);border:1px solid var(--border);color:var(--text);padding:2px 5px;border-radius:3px;font-size:9px;font-family:inherit;box-sizing:border-box";
          inp.addEventListener("input", () => cb(inp.value));
          form.append(l, inp);
          return inp;
        };

        mkField("Name", al.name, v => al.name = v, "Wasserleck Küche");
        mkField("HA-Entity", al.entity, v => al.entity = v, "binary_sensor.water_leak");

        // Icon-Typ
        const iconRow2 = document.createElement("div"); iconRow2.style.cssText = "display:flex;flex-direction:column;gap:2px";
        const iconL2 = document.createElement("span"); iconL2.style.cssText = "font-size:8px;color:var(--muted)"; iconL2.textContent = "Alarm-Symbol";
        const iconSel2 = document.createElement("select");
        iconSel2.style.cssText = "width:100%;background:var(--bg);border:1px solid var(--border);color:var(--text);padding:2px 5px;border-radius:3px;font-size:9px;font-family:inherit";
        [["warning","⚠ Warnung"],["battery","🔋 Akku leer"],["camera","📷 Kamera / REC"],["electric","⚡ Elektrizität"],["fire","🔥 Feuer / Rauch"],["motion","🏃 Bewegung"],["water","💧 Wasser / Leck"],["shield","🛡 Einbruch"]].forEach(([v,t]) => {
          const o = document.createElement("option"); o.value = v; o.textContent = t;
          if ((al.icon || "warning") === v) o.selected = true;
          iconSel2.appendChild(o);
        });
        iconSel2.addEventListener("change", () => al.icon = iconSel2.value);
        iconRow2.append(iconL2, iconSel2);
        form.appendChild(iconRow2);

        // Farb-Picker
        const clrRow = document.createElement("div");
        clrRow.style.cssText = "display:flex;align-items:center;gap:6px;margin-top:2px";
        const clrL = document.createElement("span"); clrL.style.cssText = "font-size:8px;color:var(--muted)"; clrL.textContent = "Alarm-Farbe";
        const clrSw = document.createElement("div");
        clrSw.style.cssText = "width:22px;height:22px;border-radius:3px;cursor:pointer;border:1px solid var(--border);background:" + (al.color || "#ff2222");
        const clrInp = document.createElement("input");
        clrInp.type = "color"; clrInp.value = al.color || "#ff2222"; clrInp.style.display = "none";
        clrInp.addEventListener("input", () => { al.color = clrInp.value; clrSw.style.background = clrInp.value; dot.style.background = clrInp.value; });
        clrSw.addEventListener("click", () => clrInp.click());
        // Preset-Farben
        const presets = ["#ff2222","#ff8800","#ffee00","#00ccff","#cc00ff"];
        const presetRow = document.createElement("div");
        presetRow.style.cssText = "display:flex;gap:3px";
        presets.forEach(col => {
          const p = document.createElement("div");
          p.style.cssText = "width:14px;height:14px;border-radius:2px;cursor:pointer;background:" + col + ";border:1px solid var(--border)";
          p.addEventListener("click", () => { al.color = col; clrInp.value = col; clrSw.style.background = col; dot.style.background = col; });
          presetRow.appendChild(p);
        });
        clrRow.append(clrL, clrSw, clrInp, presetRow);
        form.appendChild(clrRow);

        // Scope: Raum oder Alle
        const scopeRow = document.createElement("div");
        scopeRow.style.cssText = "display:flex;flex-direction:column;gap:3px;margin-top:2px";
        const scopeL = document.createElement("span"); scopeL.style.cssText = "font-size:8px;color:var(--muted)"; scopeL.textContent = "Alarm gilt für";
        const scopeSel = document.createElement("select");
        scopeSel.style.cssText = "width:100%;background:var(--bg);border:1px solid var(--border);color:var(--text);padding:2px 5px;border-radius:3px;font-size:9px;font-family:inherit";
        const scopeOpts = [
          {v: "all",  t: "🏠 Alle Räume"},
          {v: "room", t: "🏷 Nur Raum wählen…"}
        ];
        scopeOpts.forEach(o => {
          const opt = document.createElement("option");
          opt.value = o.v; opt.textContent = o.t;
          if ((al.scope || "all") === o.v) opt.selected = true;
          scopeSel.appendChild(opt);
        });
        scopeSel.addEventListener("change", () => {
          al.scope = scopeSel.value;
          roomSelRow.style.display = al.scope === "room" ? "" : "none";
        });
        scopeRow.append(scopeL, scopeSel);
        form.appendChild(scopeRow);

        // Raum-Auswahl (nur wenn scope=room)
        const roomSelRow = document.createElement("div");
        roomSelRow.style.cssText = "display:flex;flex-direction:column;gap:2px;" + ((al.scope || "all") === "room" ? "" : "display:none");
        const roomSelL = document.createElement("span"); roomSelL.style.cssText = "font-size:8px;color:var(--muted)"; roomSelL.textContent = "Raum";
        const roomSel = document.createElement("select");
        roomSel.style.cssText = "width:100%;background:var(--bg);border:1px solid var(--border);color:var(--text);padding:2px 5px;border-radius:3px;font-size:9px;font-family:inherit";
        rooms.forEach((r, ri) => {
          const opt = document.createElement("option");
          opt.value = ri; opt.textContent = r.name || ("Raum " + (ri+1));
          if (al.room_idx === ri) opt.selected = true;
          roomSel.appendChild(opt);
        });
        roomSel.addEventListener("change", () => al.room_idx = parseInt(roomSel.value));
        roomSelRow.append(roomSelL, roomSel);
        form.appendChild(roomSelRow);
        // Sichtbarkeit initial
        roomSelRow.style.display = (al.scope || "all") === "room" ? "" : "none";

        box.appendChild(form);
      }

      wrap.appendChild(box);
    });

    // + Alarm Button
    const addBtn = document.createElement("button");
    addBtn.className = "btn btn-outline";
    addBtn.style.cssText = "width:100%;margin-top:4px;font-size:9px;border-color:var(--red);color:var(--red)";
    addBtn.textContent = this._addingAlarm ? "✕ Abbrechen" : "+ Alarm-Sensor hinzufügen";
    addBtn.addEventListener("click", () => {
      this._addingAlarm = !this._addingAlarm;
      this._rebuildSidebar();
    });
    wrap.appendChild(addBtn);

    // Neues Alarm-Formular
    if (this._addingAlarm) {
      const nf = document.createElement("div");
      nf.style.cssText = "display:flex;flex-direction:column;gap:4px;padding:6px 8px;margin-top:5px;background:var(--surf2);border-radius:5px;border:1px solid var(--red)";

      const mkNf = (lbl, ph) => {
        const l = document.createElement("span"); l.style.cssText = "font-size:8px;color:var(--muted)"; l.textContent = lbl;
        const inp = document.createElement("input"); inp.placeholder = ph;
        inp.style.cssText = "width:100%;background:var(--bg);border:1px solid var(--border);color:var(--text);padding:2px 5px;border-radius:3px;font-size:9px;font-family:inherit;box-sizing:border-box";
        nf.append(l, inp);
        return inp;
      };

      const nName   = mkNf("Name", "Rauchmelder Wohnzimmer");
      const nEntity = mkNf("HA-Entity", "binary_sensor.smoke_sensor");

      // Icon-Typ
      const nIconL = document.createElement("span"); nIconL.style.cssText = "font-size:8px;color:var(--muted)"; nIconL.textContent = "Alarm-Symbol";
      const nIconSel = document.createElement("select");
      nIconSel.style.cssText = "width:100%;background:var(--bg);border:1px solid var(--border);color:var(--text);padding:2px 5px;border-radius:3px;font-size:9px;font-family:inherit";
      [["warning","⚠ Warnung"],["battery","🔋 Akku leer"],["camera","📷 Kamera / REC"],["electric","⚡ Elektrizität"],["fire","🔥 Feuer / Rauch"],["motion","🏃 Bewegung"],["water","💧 Wasser / Leck"],["shield","🛡 Einbruch"]].forEach(([v,t]) => {
        const o = document.createElement("option"); o.value = v; o.textContent = t; nIconSel.appendChild(o);
      });
      nf.append(nIconL, nIconSel);

      // Farbe
      let nColor = "#ff2222";
      const nClrRow = document.createElement("div"); nClrRow.style.cssText = "display:flex;align-items:center;gap:6px";
      const nClrL = document.createElement("span"); nClrL.style.cssText = "font-size:8px;color:var(--muted)"; nClrL.textContent = "Farbe";
      const nClrSw = document.createElement("div"); nClrSw.style.cssText = "width:22px;height:22px;border-radius:3px;cursor:pointer;background:#ff2222;border:1px solid var(--border)";
      const nClrInp = document.createElement("input"); nClrInp.type = "color"; nClrInp.value = "#ff2222"; nClrInp.style.display = "none";
      nClrInp.addEventListener("input", () => { nColor = nClrInp.value; nClrSw.style.background = nColor; });
      nClrSw.addEventListener("click", () => nClrInp.click());
      const nPresets = document.createElement("div"); nPresets.style.cssText = "display:flex;gap:3px";
      ["#ff2222","#ff8800","#ffee00","#00ccff","#cc00ff"].forEach(col => {
        const p = document.createElement("div");
        p.style.cssText = "width:14px;height:14px;border-radius:2px;cursor:pointer;background:" + col + ";border:1px solid var(--border)";
        p.addEventListener("click", () => { nColor = col; nClrInp.value = col; nClrSw.style.background = col; });
        nPresets.appendChild(p);
      });
      nClrRow.append(nClrL, nClrSw, nClrInp, nPresets);
      nf.appendChild(nClrRow);

      // Scope
      const nScopeL = document.createElement("span"); nScopeL.style.cssText = "font-size:8px;color:var(--muted)"; nScopeL.textContent = "Gilt für";
      const nScopeSel = document.createElement("select");
      nScopeSel.style.cssText = "width:100%;background:var(--bg);border:1px solid var(--border);color:var(--text);padding:2px 5px;border-radius:3px;font-size:9px;font-family:inherit";
      [{v:"all",t:"🏠 Alle Räume"},{v:"room",t:"🏷 Nur Raum wählen"}].forEach(o => {
        const opt = document.createElement("option"); opt.value = o.v; opt.textContent = o.t; nScopeSel.appendChild(opt);
      });
      nf.append(nScopeL, nScopeSel);

      const nRoomRow = document.createElement("div"); nRoomRow.style.display = "none";
      const nRoomL = document.createElement("span"); nRoomL.style.cssText = "font-size:8px;color:var(--muted)"; nRoomL.textContent = "Raum";
      const nRoomSel = document.createElement("select");
      nRoomSel.style.cssText = "width:100%;background:var(--bg);border:1px solid var(--border);color:var(--text);padding:2px 5px;border-radius:3px;font-size:9px;font-family:inherit";
      rooms.forEach((r,ri) => { const opt = document.createElement("option"); opt.value = ri; opt.textContent = r.name || ("Raum " + (ri+1)); nRoomSel.appendChild(opt); });
      nRoomRow.append(nRoomL, nRoomSel);
      nf.appendChild(nRoomRow);
      nScopeSel.addEventListener("change", () => { nRoomRow.style.display = nScopeSel.value === "room" ? "" : "none"; });

      const confirmBtn = document.createElement("button");
      confirmBtn.className = "btn btn-outline";
      confirmBtn.style.cssText = "width:100%;margin-top:4px;font-size:9px;border-color:var(--red);color:var(--red)";
      confirmBtn.textContent = "+ Alarm anlegen";
      confirmBtn.addEventListener("click", async () => {
        const name   = nName.value.trim() || nEntity.value.trim();
        const entity = nEntity.value.trim();
        if (!entity) { this._showToast("HA-Entity ist Pflicht"); return; }
        const alarm = {
          id:       "alarm_" + Date.now(),
          name,
          entity,
          color:    nColor,
          icon:     nIconSel.value,
          scope:    nScopeSel.value,
          room_idx: nScopeSel.value === "room" ? parseInt(nRoomSel.value) : null,
        };
        this._pendingAlarms.push(alarm);
        await this._saveAlarms();
        this._addingAlarm = false;
        this._rebuildSidebar();
      });
      nf.appendChild(confirmBtn);
      wrap.appendChild(nf);
    }

    // Speichern
    if (alarms.length > 0) {
      const saveBtn = document.createElement("button");
      saveBtn.className = "btn btn-green";
      saveBtn.style.cssText = "width:100%;margin-top:6px;font-size:9px";
      saveBtn.textContent = "✓ Alarme speichern";
      saveBtn.addEventListener("click", () => this._saveAlarms());
      wrap.appendChild(saveBtn);
    }

    return wrap;
  }

  async _saveAlarms() {
    try {
      await this._hass.callApi("POST",
        `ble_positioning/${this._entryId}/alarms`,
        { alarms: this._pendingAlarms });
      await this._loadData();
      this._showToast("✓ Alarme gespeichert");
    } catch(e) {
      this._showToast("✗ " + (e?.body?.message || e.message || e));
    }
  }

  // ── ALARM CANVAS DRAW ────────────────────────────────────────────────────
  _drawAlarmOverlay() {
    const alarms = this._pendingAlarms?.length ? this._pendingAlarms : (this._data?.alarms || []);
    if (!alarms.length) return;
    const ctx   = this._ctx;
    const rooms = this._data?.rooms || [];
    const now   = Date.now();
    const pulse = 0.45 + 0.55 * Math.abs(Math.sin(now / 700));  // 0.45–1.0

    alarms.forEach(al => {
      const stateVal = this._hass?.states?.[al.entity]?.state || "";
      const active = ["on","true","1","triggered","motion","wet","smoke","detected"].includes(stateVal.toLowerCase());
      if (!active) return;

      const color = al.color || "#ff2222";
      const r = parseInt(color.slice(1,3),16);
      const g = parseInt(color.slice(3,5),16);
      const b = parseInt(color.slice(5,7),16);

      // Welche Räume betroffen?
      const targetRooms = al.scope === "room" && al.room_idx != null
        ? [rooms[al.room_idx]].filter(Boolean)
        : rooms;

      targetRooms.forEach(room => {
        if (!room) return;
        const c1 = this._f2c(room.x1, room.y1);
        const c2 = this._f2c(room.x2, room.y2);
        const rw = c2.x - c1.x, rh = c2.y - c1.y;

        // Farbige Füllung mit Puls
        ctx.fillStyle = `rgba(${r},${g},${b},${0.28 * pulse})`;
        ctx.fillRect(c1.x, c1.y, rw, rh);

        // Farbiger Rahmen
        ctx.strokeStyle = `rgba(${r},${g},${b},${0.85 * pulse})`;
        ctx.lineWidth = 2.5;
        ctx.strokeRect(c1.x + 1, c1.y + 1, rw - 2, rh - 2);

        // Icon mittig im Raum
        const cx = c1.x + rw / 2;
        const cy = c1.y + rh / 2;
        const iconSize = Math.min(rw, rh) * 0.22;

        ctx.save();
        ctx.globalAlpha = pulse;
        this._drawAlarmIcon(ctx, al.icon || "warning", cx, cy, iconSize, r, g, b);
        ctx.globalAlpha = 1.0;
        ctx.restore();

        // Raum-Name Label
        ctx.save();
        ctx.globalAlpha = Math.min(1, pulse * 1.2);
        ctx.font = "bold 9px 'JetBrains Mono',monospace";
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.textAlign = "center";
        ctx.fillText((al.name || "ALARM").toUpperCase(), cx, c1.y + rh * 0.82);
        ctx.textAlign = "left";
        ctx.globalAlpha = 1;
        ctx.restore();
      });
    });
  }

  _drawAlarmIcon(ctx, icon, cx, cy, sz, r, g, b) {
    const col  = `rgba(${r},${g},${b},0.92)`;
    const colD = `rgba(${r},${g},${b},0.7)`;
    ctx.fillStyle   = col;
    ctx.strokeStyle = "#fff";
    ctx.lineWidth   = Math.max(1, sz * 0.07);

    if (icon === "fire") {
      // Flamme: Bezier-Kurve
      ctx.beginPath();
      ctx.moveTo(cx, cy + sz);
      ctx.bezierCurveTo(cx - sz*0.8, cy + sz*0.3, cx - sz*0.5, cy - sz*0.5, cx, cy - sz);
      ctx.bezierCurveTo(cx + sz*0.2, cy - sz*0.3, cx + sz*0.1, cy - sz*0.1, cx + sz*0.4, cy - sz*0.5);
      ctx.bezierCurveTo(cx + sz*0.8, cy, cx + sz*0.8, cy + sz*0.5, cx, cy + sz);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
      // Innere Flamme
      ctx.fillStyle = `rgba(255,220,80,0.9)`;
      ctx.beginPath();
      ctx.moveTo(cx, cy + sz*0.5);
      ctx.bezierCurveTo(cx - sz*0.35, cy + sz*0.1, cx - sz*0.2, cy - sz*0.3, cx, cy - sz*0.5);
      ctx.bezierCurveTo(cx + sz*0.1, cy - sz*0.2, cx + sz*0.3, cy + sz*0.1, cx, cy + sz*0.5);
      ctx.closePath(); ctx.fill();

    } else if (icon === "motion") {
      // Laufende Person: Kopf + Körper stilisiert
      // Kopf
      ctx.beginPath(); ctx.arc(cx, cy - sz*0.75, sz*0.22, 0, Math.PI*2); ctx.fill(); ctx.stroke();
      // Körper / Oberkörper diagonal (läuft)
      ctx.beginPath();
      ctx.moveTo(cx, cy - sz*0.5);
      ctx.lineTo(cx + sz*0.3, cy);
      ctx.lineTo(cx + sz*0.1, cy + sz*0.5);
      ctx.moveTo(cx, cy - sz*0.5);
      ctx.lineTo(cx - sz*0.25, cy + sz*0.15);
      ctx.lineWidth = Math.max(2, sz * 0.12);
      ctx.strokeStyle = col;
      ctx.stroke();
      // Beine
      ctx.beginPath();
      ctx.moveTo(cx + sz*0.3, cy);
      ctx.lineTo(cx - sz*0.1, cy + sz*0.55);
      ctx.moveTo(cx + sz*0.3, cy);
      ctx.lineTo(cx + sz*0.55, cy + sz*0.55);
      ctx.stroke();
      // Arm
      ctx.beginPath();
      ctx.moveTo(cx - sz*0.05, cy - sz*0.2);
      ctx.lineTo(cx - sz*0.4, cy + sz*0.1);
      ctx.stroke();

    } else if (icon === "water") {
      // Wassertropfen
      ctx.beginPath();
      ctx.moveTo(cx, cy - sz);
      ctx.bezierCurveTo(cx + sz*0.8, cy - sz*0.1, cx + sz*0.8, cy + sz*0.5, cx, cy + sz);
      ctx.bezierCurveTo(cx - sz*0.8, cy + sz*0.5, cx - sz*0.8, cy - sz*0.1, cx, cy - sz);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      // Glanzfleck
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.beginPath(); ctx.ellipse(cx - sz*0.2, cy - sz*0.2, sz*0.15, sz*0.25, -0.5, 0, Math.PI*2); ctx.fill();

    } else if (icon === "shield") {
      // Schild mit Riss
      ctx.beginPath();
      ctx.moveTo(cx, cy - sz);
      ctx.lineTo(cx + sz*0.75, cy - sz*0.5);
      ctx.lineTo(cx + sz*0.75, cy + sz*0.1);
      ctx.bezierCurveTo(cx + sz*0.75, cy + sz*0.6, cx, cy + sz, cx, cy + sz);
      ctx.bezierCurveTo(cx, cy + sz, cx - sz*0.75, cy + sz*0.6, cx - sz*0.75, cy + sz*0.1);
      ctx.lineTo(cx - sz*0.75, cy - sz*0.5);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      // Riss (kaputtes Schild)
      ctx.strokeStyle = "rgba(255,255,255,0.9)";
      ctx.lineWidth = Math.max(1.5, sz * 0.09);
      ctx.beginPath();
      ctx.moveTo(cx - sz*0.1, cy - sz*0.6);
      ctx.lineTo(cx + sz*0.15, cy - sz*0.1);
      ctx.lineTo(cx - sz*0.05, cy + sz*0.4);
      ctx.stroke();

    } else if (icon === "battery") {
      // Warndreieck mit leerem Akku
      // Dreieck
      ctx.beginPath();
      ctx.moveTo(cx, cy - sz);
      ctx.lineTo(cx + sz*0.87, cy + sz*0.5);
      ctx.lineTo(cx - sz*0.87, cy + sz*0.5);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
      // Akku-Körper (weißes Rechteck innen)
      const bw = sz*0.75, bh = sz*0.38;
      const bx = cx - bw/2, by2 = cy + sz*0.02;
      ctx.fillStyle = "rgba(0,0,0,0.7)";
      ctx.fillRect(bx, by2, bw, bh);
      // Akku-Pole oben
      ctx.fillStyle = "#fff";
      ctx.fillRect(bx + bw*0.3, by2 - bh*0.18, bw*0.4, bh*0.18);
      // Akku-Rahmen
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = Math.max(1, sz*0.06);
      ctx.strokeRect(bx, by2, bw, bh);
      // Rotes X (leer)
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = Math.max(1.5, sz*0.1);
      ctx.lineCap = "round";
      const px = bx + bw*0.25, py = by2 + bh*0.2;
      const pw2 = bw*0.5, ph2 = bh*0.6;
      ctx.beginPath(); ctx.moveTo(px,py); ctx.lineTo(px+pw2,py+ph2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(px+pw2,py); ctx.lineTo(px,py+ph2); ctx.stroke();

    } else if (icon === "camera") {
      // Kamera mit REC-Punkt
      const cw = sz*1.4, ch2 = sz*0.9;
      const cx1 = cx - cw/2, cy1 = cy - ch2/2;
      // Gehäuse
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(cx1, cy1, cw, ch2, sz*0.15);
      else ctx.rect(cx1, cy1, cw, ch2);
      ctx.fill(); ctx.stroke();
      // Objektiv (Kreis)
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.strokeStyle = `rgb(${r},${g},${b})`;
      ctx.lineWidth = Math.max(1, sz*0.1);
      ctx.beginPath(); ctx.arc(cx - sz*0.1, cy, sz*0.32, 0, Math.PI*2); ctx.fill(); ctx.stroke();
      // Glanzpunkt
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.beginPath(); ctx.arc(cx - sz*0.2, cy - sz*0.1, sz*0.08, 0, Math.PI*2); ctx.fill();
      // REC Punkt (oben rechts)
      ctx.fillStyle = "#ff2222";
      ctx.beginPath(); ctx.arc(cx + sz*0.55, cy - sz*0.25, sz*0.16, 0, Math.PI*2); ctx.fill();
      // Sucher (oben rechts, kleines Rechteck)
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(cx + sz*0.3, cy1 + sz*0.08, sz*0.35, sz*0.22);

    } else if (icon === "electric") {
      // Blitz / Elektrizität
      ctx.beginPath();
      ctx.moveTo(cx + sz*0.15, cy - sz);        // oben rechts
      ctx.lineTo(cx - sz*0.35, cy + sz*0.05);   // mitte links
      ctx.lineTo(cx + sz*0.08, cy + sz*0.05);   // mitte mitte
      ctx.lineTo(cx - sz*0.15, cy + sz);         // unten links
      ctx.lineTo(cx + sz*0.45, cy - sz*0.1);    // mitte rechts
      ctx.lineTo(cx + sz*0.05, cy - sz*0.1);    // mitte mitte
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

    } else {
      // Standard: Warndreieck mit !
      ctx.beginPath();
      ctx.moveTo(cx, cy - sz);
      ctx.lineTo(cx + sz*0.87, cy + sz*0.5);
      ctx.lineTo(cx - sz*0.87, cy + sz*0.5);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#fff";
      ctx.font = `bold ${Math.max(8, sz * 0.7)}px monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("!", cx, cy + sz*0.1);
      ctx.textBaseline = "alphabetic";
      ctx.textAlign = "left";
    }
  }

  _drawAlarmEditOverlay() {
    // In edit mode: show room labels to help pick
    const rooms = this._data?.rooms || [];
    const ctx = this._ctx;
    rooms.forEach((room, ri) => {
      const c1 = this._f2c(room.x1, room.y1);
      const c2 = this._f2c(room.x2, room.y2);
      const cx = c1.x + (c2.x - c1.x) / 2;
      const cy = c1.y + (c2.y - c1.y) / 2;
      ctx.save();
      ctx.strokeStyle = "rgba(255,50,50,0.3)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4,4]);
      ctx.strokeRect(c1.x, c1.y, c2.x - c1.x, c2.y - c1.y);
      ctx.setLineDash([]);
      ctx.font = "9px 'JetBrains Mono',monospace";
      ctx.fillStyle = "rgba(255,100,100,0.7)";
      ctx.textAlign = "center";
      ctx.fillText(room.name || ("R" + (ri+1)), cx, cy);
      ctx.textAlign = "left";
      ctx.restore();
    });
  }


  // ── Light glow rendering ──────────────────────────────────────────────────

  // ══════════════════════════════════════════════════════════════════════════
  // MMWAVE SENSOR TAB – Sidebar
  // ══════════════════════════════════════════════════════════════════════════
  _sidebarMmwave() {
    const wrap = document.createElement("div");
    wrap.style.cssText = "display:flex;flex-direction:column;gap:0;min-height:0";
    if (!this._pendingMmwave) this._pendingMmwave = [];
    const sensors = this._pendingMmwave;

    // ── HEADER ──────────────────────────────────────────────────────────────
    const hdr = document.createElement("div");
    hdr.style.cssText = "padding:8px 10px 6px;border-bottom:1px solid #1c2535;flex-shrink:0";
    hdr.innerHTML = `<div style="font-size:10px;font-weight:700;color:#94a3b8;letter-spacing:1px;margin-bottom:5px">📡 MMWAVE SENSOREN</div>`;
    const addBtn = document.createElement("button");
    addBtn.style.cssText = "width:100%;padding:6px;border-radius:6px;border:1px solid #f59e0b55;background:#f59e0b11;color:#f59e0b;font-size:9px;font-weight:700;cursor:pointer;font-family:inherit";
    addBtn.textContent = "+ Sensor hinzufügen";
    addBtn.addEventListener("click", () => {
      sensors.push({ id:"mmw_"+Date.now(), name:"Sensor "+( sensors.length+1),
        entity_prefix:"", mx:1.0, my:1.0, rotation:0,
        fov_angle:120, fov_range:6, color:"#ff6b35",
        show_fov:true, target_names:["Person 1","Person 2","Person 3"],
        targets:3, mount_type:"wall", mount_height_m:1.5, mount_tilt_deg:0 });
      this._mmwaveEditIdx = sensors.length-1;
      this._rebuildSidebar();
    });
    hdr.appendChild(addBtn);
    wrap.appendChild(hdr);

    // ── SENSOR LIST ──────────────────────────────────────────────────────────
    const list = document.createElement("div");
    list.style.cssText = "padding:8px 10px";

    if (sensors.length === 0) {
      const empty = document.createElement("div");
      empty.style.cssText = "text-align:center;color:#445566;font-size:9px;padding:20px 0;line-height:2";
      empty.innerHTML = "Keine mmWave Sensoren konfiguriert.<br><b>+ Sensor hinzufügen</b> um zu beginnen.";
      list.appendChild(empty);
    }

    sensors.forEach((s, idx) => {
      const isEdit = this._mmwaveEditIdx === idx;
      const card = document.createElement("div");
      card.style.cssText = `border-radius:8px;border:1px solid ${isEdit?"#f59e0b55":"#1c2535"};background:${isEdit?"#f59e0b08":"#111820"};margin-bottom:6px;overflow:hidden`;

      // Card header row
      const crow = document.createElement("div");
      crow.style.cssText = "display:flex;align-items:center;gap:5px;padding:6px 8px;cursor:pointer";
      crow.addEventListener("click", () => {
        this._mmwaveEditIdx = isEdit ? null : idx;
        this._rebuildSidebar();
      });
      const dot = document.createElement("div");
      dot.style.cssText = `width:10px;height:10px;border-radius:50%;background:${s.color||"#ff6b35"};flex-shrink:0`;
      const nameLbl = document.createElement("span");
      nameLbl.style.cssText = "flex:1;font-size:9px;font-weight:700;color:#c8d8ec";
      nameLbl.textContent = s.name;
      const prefLbl = document.createElement("span");
      prefLbl.style.cssText = "font-size:7.5px;color:#445566;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:80px";
      prefLbl.textContent = s.entity_prefix ? s.entity_prefix.split(".").pop() : "kein Prefix";
      // Live target count
      const liveCnt = this._getMmwaveLiveTargetCount(s);
      const cntBadge = document.createElement("span");
      cntBadge.style.cssText = `font-size:8px;padding:1px 5px;border-radius:10px;background:${liveCnt>0?"#22c55e33":"#0d1219"};color:${liveCnt>0?"#22c55e":"#445566"}`;
      cntBadge.textContent = liveCnt > 0 ? `👤×${liveCnt}` : "—";
      const chevron = document.createElement("span");
      chevron.style.cssText = "font-size:8px;color:#445566";
      chevron.textContent = isEdit ? "▲" : "▼";
      const delBtn = document.createElement("button");
      delBtn.style.cssText = "padding:2px 6px;border:1px solid #ef444433;border-radius:3px;background:#ef444411;color:#ef4444;font-size:8px;cursor:pointer;font-family:inherit";
      delBtn.textContent = "✕";
      delBtn.addEventListener("click", (e) => { e.stopPropagation(); sensors.splice(idx,1); this._mmwaveEditIdx=null; this._rebuildSidebar(); });
      crow.append(dot, nameLbl, prefLbl, cntBadge, chevron, delBtn);
      card.appendChild(crow);

      // Expanded editor
      if (isEdit) {
        const body = document.createElement("div");
        body.style.cssText = "padding:6px 8px 8px;border-top:1px solid #1c2535";
        this._buildMmwaveSensorEditor(body, s, idx);
        card.appendChild(body);
      }
      list.appendChild(card);
    });

    // Save button
    const saveBtn = document.createElement("button");
    saveBtn.style.cssText = "width:100%;margin-top:4px;padding:8px;border-radius:6px;border:1px solid #22c55e55;background:#22c55e11;color:#22c55e;font-size:10px;font-weight:700;cursor:pointer;font-family:inherit";
    saveBtn.textContent = sensors.length ? `💾 Speichern (${sensors.length} Sensoren)` : "Keine Sensoren";
    saveBtn.disabled = sensors.length === 0;
    saveBtn.addEventListener("click", async () => {
      saveBtn.disabled=true; saveBtn.textContent="⏳...";
      try {
        await this._hass.callApi("POST",`ble_positioning/${this._entryId}/mmwave_sensors`,{ sensors });
        if (this._data) this._data.mmwave_sensors = structuredClone(sensors);
        this._pendingMmwave = structuredClone(sensors); // Sync pending mit gespeichertem Stand
        this._showToast(`✓ ${sensors.length} Sensor${sensors.length!==1?"en":""} gespeichert`);
        saveBtn.innerHTML="✓ Gespeichert";
        this._setTimeout(()=>{saveBtn.disabled=false;saveBtn.textContent=`💾 Speichern (${sensors.length} Sensoren)`;},2000);
      } catch(e){ saveBtn.disabled=false; saveBtn.textContent=`💾 Speichern (${sensors.length} Sensoren)`; this._showToast("Fehler: "+e.message); }
    });
    list.appendChild(saveBtn);
    wrap.appendChild(list);
    return wrap;
  }


  // ── Akkordeon-Sektion (wiederverwendbar) ──────────────────────────────────
  _mmwAccordion(icon, title, color, defaultOpen, buildFn) {
    const wrap = document.createElement("div");
    wrap.style.cssText = `margin-top:5px;border-radius:6px;border:1px solid ${color}33;overflow:hidden`;

    const hdr = document.createElement("div");
    hdr.style.cssText = `display:flex;align-items:center;gap:5px;padding:5px 8px;background:${color}0d;cursor:pointer;user-select:none`;
    const ico = document.createElement("span"); ico.style.cssText="font-size:11px"; ico.textContent=icon;
    const ttl = document.createElement("span"); ttl.style.cssText=`font-size:8px;font-weight:700;color:${color};flex:1`; ttl.textContent=title;
    const arr = document.createElement("span"); arr.style.cssText=`font-size:8px;color:${color};transition:transform 0.2s`; arr.textContent="▾";
    hdr.append(ico, ttl, arr);

    const body = document.createElement("div");
    body.style.cssText = `padding:6px 8px;display:${defaultOpen?"block":"none"}`;
    if (defaultOpen) arr.style.transform="rotate(0deg)"; else arr.style.transform="rotate(-90deg)";

    hdr.addEventListener("click", () => {
      const open = body.style.display !== "none";
      body.style.display = open ? "none" : "block";
      arr.style.transform = open ? "rotate(-90deg)" : "rotate(0deg)";
      if (!open && !body._built) { body._built=true; buildFn(body); }
    });

    wrap.append(hdr, body);
    // Sofort aufbauen wenn defaultOpen
    if (defaultOpen) { body._built=true; buildFn(body); }
    return wrap;
  }

  _buildMmwaveSensorEditor(body, s, idx) {
    const row  = (label, input) => {
      const d=document.createElement("div"); d.style.cssText="display:flex;align-items:center;gap:5px;margin-bottom:4px";
      const lb=document.createElement("span"); lb.style.cssText="font-size:8px;color:#445566;min-width:60px;white-space:nowrap"; lb.textContent=label;
      d.append(lb, input); return d;
    };
    const inp = (type,val,min,max,step,onChange,width) => {
      const i=document.createElement("input"); i.type=type; i.value=val??("");
      if(min!=null) i.min=min; if(max!=null) i.max=max; if(step!=null) i.step=step;
      i.style.cssText=`${width?`width:${width}px`:"flex:1"};padding:2px 4px;border-radius:3px;border:1px solid #1c2535;background:#07090d;color:#c8d8ec;font-size:8px;font-family:inherit`;
      i.addEventListener("input", ()=>onChange(i.value)); return i;
    };
    const tog = (label, checked, onChange) => {
      const lbl=document.createElement("label"); lbl.style.cssText="display:flex;align-items:center;gap:5px;font-size:8px;color:#445566;cursor:pointer;margin-bottom:3px";
      const cb=document.createElement("input"); cb.type="checkbox"; cb.checked=checked;
      cb.addEventListener("change",()=>onChange(cb.checked));
      lbl.append(cb, label); return lbl;
    };

    // ══ ⚙️ SENSOR – immer offen ══════════════════════════════════════════════
    body.appendChild(this._mmwAccordion("⚙️","SENSOR","#00e5ff",true, b => {
      // Name
      b.appendChild(row("Name:", inp("text", s.name, null,null,null, v=>{ s.name=v; this._draw(); })));

      // Entity-Prefix + Auto-Discovery
      const pfxWrap = document.createElement("div"); pfxWrap.style.cssText="margin-bottom:4px";
      const pfxLbl = document.createElement("div"); pfxLbl.style.cssText="font-size:7.5px;color:#445566;margin-bottom:2px";
      pfxLbl.textContent = "Entity-Prefix (z.B. sensor.mmwave_sensor_96ffa0)";
      const pfxInp = inp("text", s.entity_prefix||"", null,null,null, v=>{ s.entity_prefix=v; });
      pfxInp.style.width="100%"; pfxInp.placeholder="sensor.mmwave_…";
      pfxWrap.append(pfxLbl, pfxInp);
      b.appendChild(pfxWrap);

      // Auto-Discovery Button
      const discoBtn = document.createElement("button");
      discoBtn.className="btn btn-outline"; discoBtn.style.cssText="width:100%;font-size:8px;padding:3px;margin-bottom:5px";
      discoBtn.textContent="🔍 Entity-Prefix automatisch erkennen";
      discoBtn.addEventListener("click",()=>{
        const states=this._hass?.states||{};
        const candidates=Object.keys(states).filter(k=>k.match(/target_\d_x/i));
        const prefixSet=new Set();
        candidates.forEach(k=>{
          const parts=k.split("_"); let cut=parts.length-3;
          while(cut>1&&!/\d/.test(parts[cut-1])) cut--;
          const prefix=parts.slice(0,cut).join("_");
          if(prefix) prefixSet.add(prefix);
        });
        const prefixes=[...prefixSet].filter(p=>candidates.filter(c=>c.startsWith(p)).length>=2);
        if(prefixes.length===0){this._showToast("Keine passenden Entities gefunden");return;}
        if(prefixes.length===1){s.entity_prefix=prefixes[0];pfxInp.value=prefixes[0];this._showToast("✓ Prefix gesetzt: "+prefixes[0]);return;}
        // Mehrere Kandidaten: Toast mit Auswahl
        this._showToast("Gefunden: "+prefixes.slice(0,3).join(", "));
      });
      b.appendChild(discoBtn);

      // Entity-Status live
      this._updateMmwaveEntityStatus(b, s);

      // Position + Rotation
      const posRow=document.createElement("div"); posRow.style.cssText="display:flex;align-items:center;gap:4px;margin-bottom:4px";
      const posLbl=document.createElement("span"); posLbl.style.cssText="font-size:8px;color:#445566;min-width:24px"; posLbl.textContent="Pos:";
      const xi=inp("number",s.mx??0,-50,50,0.1,v=>{s.mx=parseFloat(v)||0;this._draw();},46);
      const yi=inp("number",s.my??0,-50,50,0.1,v=>{s.my=parseFloat(v)||0;this._draw();},46);
      const xl=document.createElement("span"); xl.style.cssText="font-size:7.5px;color:#445566"; xl.textContent="X";
      const yl=document.createElement("span"); yl.style.cssText="font-size:7.5px;color:#445566"; yl.textContent="Y m";
      posRow.append(posLbl,xl,xi,yl,yi);
      b.appendChild(posRow);

      const rotRow=document.createElement("div"); rotRow.style.cssText="display:flex;align-items:center;gap:5px;margin-bottom:4px";
      const rotLbl=document.createElement("span"); rotLbl.style.cssText="font-size:8px;color:#445566;min-width:60px"; rotLbl.textContent="Rotation:";
      const rotVal=document.createElement("span"); rotVal.style.cssText="font-size:8px;color:#00e5ff;min-width:30px"; rotVal.textContent=(s.rotation||0)+"°";
      const rotSlider=document.createElement("input"); rotSlider.type="range"; rotSlider.min=-180; rotSlider.max=180; rotSlider.step=1;
      rotSlider.value=s.rotation||0; rotSlider.style.cssText="flex:1;accent-color:#00e5ff";
      rotSlider.addEventListener("input",()=>{ s.rotation=parseInt(rotSlider.value); rotVal.textContent=s.rotation+"°"; this._draw(); });
      rotRow.append(rotLbl, rotSlider, rotVal);
      b.appendChild(rotRow);

      // FOV + Style
      const fovRow=document.createElement("div"); fovRow.style.cssText="display:flex;align-items:center;gap:4px;margin-bottom:4px";
      const fovLbl=document.createElement("span"); fovLbl.style.cssText="font-size:8px;color:#445566;min-width:60px"; fovLbl.textContent="FOV/Range:";
      const fovI=inp("number",s.fov_angle||60,10,180,5,v=>{s.fov_angle=parseFloat(v)||60;this._draw();},44);
      const ranI=inp("number",s.fov_range||5,0.5,20,0.5,v=>{s.fov_range=parseFloat(v)||5;this._draw();},44);
      const fovU=document.createElement("span"); fovU.style.cssText="font-size:7.5px;color:#445566"; fovU.textContent="° /";
      const ranU=document.createElement("span"); ranU.style.cssText="font-size:7.5px;color:#445566"; ranU.textContent="m";
      fovRow.append(fovLbl, fovI, fovU, ranI, ranU);
      b.appendChild(fovRow);

      // Farbe + FOV anzeigen + Achsen
      const styleRow=document.createElement("div"); styleRow.style.cssText="display:flex;align-items:center;gap:6px;margin-bottom:4px";
      const colLbl=document.createElement("span"); colLbl.style.cssText="font-size:8px;color:#445566"; colLbl.textContent="Farbe:";
      const colI=document.createElement("input"); colI.type="color"; colI.value=s.color||"#00e5ff";
      colI.style.cssText="width:28px;height:20px;border:none;background:none;cursor:pointer;padding:0";
      colI.addEventListener("input",()=>{s.color=colI.value;this._draw();});
      styleRow.append(colLbl, colI);
      styleRow.appendChild(tog("FOV", s.show_fov!==false, v=>{s.show_fov=v;this._draw();}));
      b.appendChild(styleRow);

      b.appendChild(tog("X-Achse umkehren", !!s.invert_x, v=>{s.invert_x=v;this._draw();}));
      b.appendChild(tog("Y-Achse umkehren", !!s.invert_y, v=>{s.invert_y=v;this._draw();}));

      // Target-Namen
      const numT=s.targets||3;
      const tnHdr=document.createElement("div"); tnHdr.style.cssText="font-size:7.5px;color:#445566;margin-top:4px;margin-bottom:3px"; tnHdr.textContent="Target-Namen:";
      b.appendChild(tnHdr);
      for(let t=0;t<numT;t++){
        const tr2=document.createElement("div"); tr2.style.cssText="display:flex;align-items:center;gap:4px;margin-bottom:3px";
        const tl=document.createElement("span"); tl.style.cssText="font-size:7.5px;color:#445566;min-width:50px"; tl.textContent=`Target ${t+1}:`;
        const tn=inp("text",(s.target_names||[])[t]||"",null,null,null,v=>{if(!s.target_names)s.target_names=[];s.target_names[t]=v;},null);
        const tv=this._getMmwaveTarget(s,t+1);
        const posBadge=document.createElement("span"); posBadge.style.cssText="font-size:7px;color:#445566;white-space:nowrap";
        posBadge.textContent=tv?.present?`📍${tv.floor_mx?.toFixed(1)},${tv.floor_my?.toFixed(1)}m`:"—";
        tr2.append(tl,tn,posBadge); b.appendChild(tr2);
      }
    }));

    // ══ 🔩 MONTAGE – standardmäßig offen ════════════════════════════════════
    body.appendChild(this._mmwAccordion("🔩","MONTAGE","#a78bfa",true, b => {
      // Montage-Typ Buttons
      const typeRow=document.createElement("div"); typeRow.style.cssText="display:flex;gap:4px;margin-bottom:5px";
      const tLbl=document.createElement("span"); tLbl.style.cssText="font-size:8px;color:#445566;min-width:60px;align-self:center"; tLbl.textContent="Typ:";
      [["wall","🧱 Wand"],["ceiling","⬆ Decke"],["floor","⬇ Boden"]].forEach(([val,label])=>{
        const btn=document.createElement("button"); btn.className="btn btn-outline";
        btn.style.cssText=`flex:1;font-size:8px;padding:3px;${(s.mount_type||"wall")===val?"background:#a78bfa22;border-color:#a78bfa;color:#a78bfa":""}`;
        btn.textContent=label;
        btn.addEventListener("click",()=>{s.mount_type=val;this._rebuildSidebar();});
        typeRow.appendChild(btn);
      });
      b.append(tLbl, typeRow);

      // Höhe + Neigung
      const paramRow=document.createElement("div"); paramRow.style.cssText="display:flex;align-items:center;gap:5px;margin-bottom:4px";
      const hLbl=document.createElement("span"); hLbl.style.cssText="font-size:8px;color:#445566;min-width:60px";
      hLbl.textContent=(s.mount_type||"wall")==="ceiling"?"Deckenhöhe:":"Wandhöhe:";
      const hI=inp("number",s.mount_height_m||1.5,0.5,5,0.1,v=>{s.mount_height_m=parseFloat(v)||1.5;},50);
      const hU=document.createElement("span"); hU.style.cssText="font-size:7.5px;color:#445566"; hU.textContent="m";
      paramRow.append(hLbl,hI,hU);
      if((s.mount_type||"wall")==="wall"){
        const tiLbl=document.createElement("span"); tiLbl.style.cssText="font-size:8px;color:#445566;margin-left:6px"; tiLbl.textContent="Neigung:";
        const tiI=inp("number",s.mount_tilt_deg||0,-60,60,1,v=>{s.mount_tilt_deg=parseFloat(v)||0;},44);
        const tiU=document.createElement("span"); tiU.style.cssText="font-size:7.5px;color:#445566"; tiU.textContent="°";
        paramRow.append(tiLbl,tiI,tiU);
      }
      b.appendChild(paramRow);

      // Referenzpunkt-Kalibrierung (2-Punkt)
      const calHdr=document.createElement("div"); calHdr.style.cssText="font-size:7.5px;color:#445566;margin-top:3px;margin-bottom:3px;display:flex;align-items:center;gap:5px";
      calHdr.innerHTML=`<span>📐 2-Punkt Kalibrierung</span>`;
      const calReset=document.createElement("button"); calReset.className="btn btn-outline";
      calReset.style.cssText="font-size:7px;padding:1px 5px;margin-left:auto";
      calReset.textContent="↺ Reset";
      calReset.addEventListener("click",()=>{ s.calibration={}; this._rebuildSidebar(); });
      calHdr.appendChild(calReset); b.appendChild(calHdr);

      const cal=s.calibration||{};
      const hasCalib=cal.scale_x||cal.scale_y||cal.offset_x||cal.offset_y;
      if(hasCalib){
        const calInfo=document.createElement("div"); calInfo.style.cssText="font-size:7px;color:#22c55e;margin-bottom:3px";
        calInfo.textContent=`✓ Kalibriert: scale=(${(cal.scale_x||1).toFixed(2)},${(cal.scale_y||1).toFixed(2)}) offset=(${(cal.offset_x||0).toFixed(2)},${(cal.offset_y||0).toFixed(2)})m`;
        b.appendChild(calInfo);
      }
      const calPhase=this._mmwaveCalibPoints?.sensorId===s.id ? (this._mmwaveCalibPoints.points.length>=1?2:1) : 0;
      const calStart=document.createElement("button"); calStart.className="btn btn-outline";
      calStart.style.cssText="width:100%;font-size:8px;padding:3px;margin-bottom:3px";
      if(calPhase===0){
        calStart.textContent="▶ Kalibrierung starten (2 Punkte)";
        calStart.addEventListener("click",()=>{
          this._mmwaveCalibPoints={sensorId:s.id,points:[]}; this._rebuildSidebar();
          this._showToast("Klicke auf Punkt 1 der echten Position auf der Karte");
        });
      } else if(calPhase===1){
        calStart.textContent="📍 Warte auf Punkt 1… (auf Karte klicken)";
        calStart.style.color="#f59e0b"; calStart.style.borderColor="#f59e0b";
        const cancel=document.createElement("button"); cancel.className="btn btn-outline";
        cancel.style.cssText="width:100%;font-size:8px;padding:2px;color:#ef4444;border-color:#ef4444;margin-top:2px";
        cancel.textContent="✕ Abbrechen";
        cancel.addEventListener("click",()=>{this._mmwaveCalibPoints=null;this._rebuildSidebar();});
        b.append(calStart,cancel);
        return;
      } else {
        const p1=this._mmwaveCalibPoints.points[0];
        calStart.textContent=`✓ P1=(${p1.fx.toFixed(2)},${p1.fy.toFixed(2)})m – Warte auf Punkt 2…`;
        calStart.style.color="#00e5ff"; calStart.style.borderColor="#00e5ff";
        const cancel=document.createElement("button"); cancel.className="btn btn-outline";
        cancel.style.cssText="width:100%;font-size:8px;padding:2px;color:#ef4444;border-color:#ef4444;margin-top:2px";
        cancel.textContent="✕ Abbrechen";
        cancel.addEventListener("click",()=>{this._mmwaveCalibPoints=null;this._rebuildSidebar();});
        b.append(calStart,cancel);
        return;
      }
      b.appendChild(calStart);

      // Sensor platzieren Button
      const placeBtn=document.createElement("button"); placeBtn.className="btn btn-outline";
      placeBtn.style.cssText="width:100%;font-size:8px;padding:3px;margin-top:2px";
      placeBtn.textContent="📍 Sensor auf Karte platzieren (klicken)";
      placeBtn.addEventListener("click",()=>{
        this._mmwaveCalib={sensorId:s.id}; this._showToast("Klicke auf die Sensor-Position auf der Karte");
        this._rebuildSidebar();
      });
      const isCalib=this._mmwaveCalib?.sensorId===s.id;
      if(isCalib){ placeBtn.textContent="📍 Klicke auf die Position…"; placeBtn.style.color="#00e5ff"; placeBtn.style.borderColor="#00e5ff"; }
      b.appendChild(placeBtn);
    }));

    // ══ 🧠 ERKENNUNG & KALIBRIERUNG – zugeklappt ════════════════════════════
    body.appendChild(this._mmwAccordion("🧠","ERKENNUNG & KALIBRIERUNG","#f59e0b",false, b => {

      // ─ KI-Klassifikation ─────────────────────────────────────────────────
      if(this._opts?.mmwaveClassify) {
        const clsHdr=document.createElement("div"); clsHdr.style.cssText="font-size:8px;font-weight:700;color:#f59e0b;margin-bottom:4px"; clsHdr.textContent="🤖 KI-Klassifikation";
        b.appendChild(clsHdr);
        const numT=s.targets||3;
        const grid=document.createElement("div"); grid.style.cssText="display:flex;flex-direction:column;gap:3px";
        for(let ti=1;ti<=numT;ti++){
          const key=s.id+"_"+ti;
          const prof=(this._mmwaveProfiles||{})[key];
          const target=this._getMmwaveTarget(s,ti);
          const cls=this._mmwaveClassify(s,{id:ti,...(target||{x_mm:0,y_mm:0,speed:0,angle:0})});
          const cInfo=this._mmwaveClasses()[cls.cls];
          const tName=(s.target_names||[])[ti-1]||`Target ${ti}`;
          const tRow=document.createElement("div"); tRow.style.cssText="display:flex;align-items:center;gap:4px;padding:3px 5px;border-radius:4px;background:var(--surf3)";
          const iconEl=document.createElement("span"); iconEl.style.cssText="font-size:13px";
          iconEl.textContent=target?.present?(cInfo?.icon||"❓"):"⬜";
          const info=document.createElement("div"); info.style.cssText="flex:1;min-width:0";
          const nameLbl=document.createElement("div"); nameLbl.style.cssText="font-size:8px;font-weight:700;color:var(--text)"; nameLbl.textContent=tName;
          const clsLbl=document.createElement("div"); clsLbl.style.cssText=`font-size:7px;color:${cInfo?.color||"#94a3b8"}`;
          clsLbl.textContent=cls.cls==="unknown"?"Noch unbekannt":`${cInfo?.label} · ${Math.round(cls.confidence*100)}%`;
          info.append(nameLbl,clsLbl);
          const trainBtn=document.createElement("button");
          const isTraining=this._mmwaveTrain?.sensorId===s.id&&this._mmwaveTrain?.targetId===ti;
          trainBtn.style.cssText="padding:2px 6px;border-radius:3px;font-size:7.5px;cursor:pointer;font-family:inherit;white-space:nowrap;border:1px solid var(--border);background:var(--surf2);color:var(--muted)";
          trainBtn.textContent=isTraining?`${Math.min(100,Math.round((Date.now()-this._mmwaveTrain.startTs)/300))}% ⏹`:"🎯 Einlernen";
          trainBtn.addEventListener("click",(e)=>{
            if(isTraining){this._mmwaveTrain=null;this._rebuildSidebar();return;}
            e.stopPropagation();
            const popup=document.createElement("div");
            popup.style.cssText="position:absolute;z-index:999;background:var(--surf3);border:1px solid var(--border);border-radius:6px;padding:4px;display:flex;flex-direction:column;gap:2px;min-width:100px";
            Object.entries(this._mmwaveClasses()).filter(([k])=>k!=="unknown").forEach(([clsKey,info2])=>{
              const opt=document.createElement("button");
              opt.style.cssText="padding:4px 8px;border:none;background:none;cursor:pointer;font-size:8px;color:var(--text);text-align:left;border-radius:3px;font-family:inherit";
              opt.innerHTML=`${info2.icon} ${info2.label}`;
              opt.addEventListener("mouseenter",()=>opt.style.background="var(--surf2)");
              opt.addEventListener("mouseleave",()=>opt.style.background="none");
              opt.addEventListener("click",()=>{document.body.removeChild(popup);this._mmwaveStartTraining(s.id,ti,clsKey);this._rebuildSidebar();});
              popup.appendChild(opt);
            });
            const r=trainBtn.getBoundingClientRect();
            popup.style.top=(r.bottom+window.scrollY+2)+"px"; popup.style.left=(r.left+window.scrollX)+"px";
            document.body.appendChild(popup);
            const close=()=>{if(document.body.contains(popup))document.body.removeChild(popup);document.removeEventListener("click",close);};
            this._setTimeout(()=>document.addEventListener("click",close),50);
          });
          if(prof?.frames?.length||prof?.trained_cls){
            const resetBtn=document.createElement("button");
            resetBtn.style.cssText="padding:2px 5px;border-radius:3px;font-size:7.5px;border:1px solid #ef444433;background:#ef444408;color:#ef4444;cursor:pointer;font-family:inherit";
            resetBtn.textContent="✕"; resetBtn.title="Profil zurücksetzen";
            resetBtn.addEventListener("click",()=>this._mmwaveResetProfile(s.id,ti));
            tRow.append(iconEl,info,trainBtn,resetBtn);
          } else { tRow.append(iconEl,info,trainBtn); }
          grid.appendChild(tRow);
        }
        b.appendChild(grid);
        const div2=document.createElement("div"); div2.style.cssText="height:1px;background:#1c2535;margin:8px 0"; b.appendChild(div2);
      }

      // ─ Postur-Wizard ─────────────────────────────────────────────────────
      this._buildMmwaveCalibPanel(b, s);

    }));

    // ══ 🛡 STURZ & HALTUNG – zugeklappt ════════════════════════════════════
    body.appendChild(this._mmwAccordion("🛡","STURZ & HALTUNG","#ef4444",false, b => {
      this._buildMmwavePosturePanel(b, s);
    }));

    // Speichern-Button
    const saveBtn=document.createElement("button"); saveBtn.className="btn";
    saveBtn.style.cssText="width:100%;margin-top:8px;font-size:9px;padding:5px";
    saveBtn.textContent="💾 Sensor speichern";
    saveBtn.addEventListener("click",async()=>{
      const sensors=this._pendingMmwave||this._data?.mmwave_sensors||[];
      const i=sensors.findIndex(x=>x.id===s.id); if(i>=0) sensors[i]=s;
      try{
        await this._hass.callApi("POST",`ble_positioning/${this._entryId}/mmwave_sensors`,{sensors});
        await this._loadData(); this._rebuildSidebar(); this._draw();
        this._showToast("✅ Sensor gespeichert");
      }catch(e){this._showToast("Fehler: "+e.message);}
    });
    body.appendChild(saveBtn);
  }
  _updateMmwaveEntityStatus(container, s) {
    container.innerHTML = "";
    container.style.cssText += ";padding:4px 6px;border-radius:4px;background:#111820";
    if (!s.entity_prefix && !s.entity_overrides) {
      const w = document.createElement("div");
      w.style.cssText = "color:#f59e0b;font-size:7.5px";
      w.textContent = "⚠ Kein Entity-Prefix gesetzt";
      container.appendChild(w); return;
    }
    if (!this._hass) return;
    const px = s.entity_prefix || "";
    // Alle relevanten Entity-Slots mit Beschreibung
    const slots = [
      { key:"presence",            label:"Präsenz",         suffix:"_presence" },
      { key:"target_count",        label:"Ziel-Anzahl",     suffix:"_moving_target_count" },
      { key:"target_1_x",         label:"Ziel 1 X",        suffix:"_target_1_x" },
      { key:"target_1_y",         label:"Ziel 1 Y",        suffix:"_target_1_y" },
      { key:"target_2_x",         label:"Ziel 2 X",        suffix:"_target_2_x" },
      { key:"target_2_y",         label:"Ziel 2 Y",        suffix:"_target_2_y" },
      { key:"target_3_x",         label:"Ziel 3 X",        suffix:"_target_3_x" },
      { key:"target_3_y",         label:"Ziel 3 Y",        suffix:"_target_3_y" },
    ];
    const overrides = s.entity_overrides || {};
    let found=0, total=slots.length;
    // Header
    const hdr = document.createElement("div");
    hdr.style.cssText = "display:flex;justify-content:space-between;align-items:center;margin-bottom:4px";
    const hdrLbl = document.createElement("span");
    hdrLbl.style.cssText = "font-size:7.5px;font-weight:700;color:#445566";
    hdrLbl.textContent = "ENTITÄTEN-STATUS";
    const toggleBtn = document.createElement("button");
    toggleBtn.style.cssText = "font-size:7px;padding:1px 5px;border-radius:3px;border:1px solid #1c2535;background:#07090d;color:#445566;cursor:pointer;font-family:inherit";
    const showDetail = s._showEntityDetail !== false;
    toggleBtn.textContent = showDetail ? "▲ einklappen" : "▼ details";
    toggleBtn.addEventListener("click", () => {
      s._showEntityDetail = !showDetail;
      this._rebuildSidebar();
    });
    hdr.append(hdrLbl, toggleBtn);
    container.appendChild(hdr);

    slots.forEach(slot => {
      // Effektive Entity: Override hat Vorrang, sonst Prefix+Suffix
      const override = overrides[slot.key];
      const autoEnt = px ? px + slot.suffix : null;
      const effectiveEnt = override || autoEnt;
      const state = effectiveEnt ? this._hass.states[effectiveEnt] : null;
      const ok = !!state;
      if (ok) found++;
      if (!showDetail) return; // Nur Summary ohne Details
      const row = document.createElement("div");
      row.style.cssText = "display:flex;align-items:center;gap:4px;margin-bottom:3px";
      const icon = document.createElement("span");
      icon.style.cssText = `font-size:8px;flex-shrink:0;color:${ok?"#22c55e":"#ef4444"}`;
      icon.textContent = ok ? "✓" : "✗";
      const lbl = document.createElement("span");
      lbl.style.cssText = "font-size:7.5px;color:#445566;width:60px;flex-shrink:0";
      lbl.textContent = slot.label+":";
      const entInp = document.createElement("input");
      entInp.type = "text";
      entInp.value = override || (autoEnt||"");
      entInp.placeholder = autoEnt || "entity_id...";
      entInp.style.cssText = `flex:1;padding:1px 4px;border-radius:3px;border:1px solid ${ok?"#22c55e44":"#ef444444"};background:#07090d;color:${ok?"#22c55e":"#ef4444"};font-size:7px;font-family:inherit`;
      entInp.addEventListener("change", () => {
        if (!s.entity_overrides) s.entity_overrides = {};
        const v = entInp.value.trim();
        if (v && v !== autoEnt) s.entity_overrides[slot.key] = v;
        else delete s.entity_overrides[slot.key];
        this._rebuildSidebar();
      });
      const valBadge = document.createElement("span");
      valBadge.style.cssText = "font-size:7px;color:#94a3b8;white-space:nowrap;max-width:50px;overflow:hidden;text-overflow:ellipsis";
      valBadge.textContent = ok ? (state.state.length>8 ? state.state.substring(0,7)+"…" : state.state) : "–";
      row.append(icon, lbl, entInp, valBadge);
      container.appendChild(row);
    });

    // Summary bar
    const sumBar = document.createElement("div");
    sumBar.style.cssText = `margin-top:3px;padding:3px 6px;border-radius:3px;font-size:7.5px;font-weight:700;text-align:center;background:${found===total?"#22c55e18":found>0?"#f59e0b18":"#ef444418"};color:${found===total?"#22c55e":found>0?"#f59e0b":"#ef4444"}`;
    sumBar.textContent = found===total ? `✓ Alle ${total} Entitäten gefunden` : `⚠ ${found}/${total} Entitäten gefunden – ${total-found} fehlen`;
    container.appendChild(sumBar);
  }

  _getMmwaveTarget(sensor, targetNum) {
    if (!sensor.entity_prefix && !sensor.entity_overrides) return null;
    if (!this._hass) return null;
    const px = sensor.entity_prefix || "";
    const ov = sensor.entity_overrides || {};
    const ent = (key, suffix) => {
      if (ov[key]) return ov[key];
      if (!px) return null;
      const direct = px + suffix;
      if (this._hass.states[direct]) return direct;
      const noParts = px.match(/^(.+?)([0-9a-f]{4,})$/i);
      if (noParts) {
        const alt = noParts[1] + "no_" + noParts[2] + suffix;
        if (this._hass.states[alt]) return alt;
      }
      return direct;
    };
    const xState  = this._hass.states[ent(`target_${targetNum}_x`, `_target_${targetNum}_x`)];
    const yState  = this._hass.states[ent(`target_${targetNum}_y`, `_target_${targetNum}_y`)];
    const spState = this._hass.states[ent(`target_${targetNum}_speed`, `_target_${targetNum}_speed`)];
    const angState= this._hass.states[ent(`target_${targetNum}_angle`, `_target_${targetNum}_angle`)];
    const dirState= this._hass.states[ent(`target_${targetNum}_direction`, `_target_${targetNum}_direction`)];
    if (!xState || !yState) return null;
    const x_raw = parseFloat(xState.state);
    const y_raw = parseFloat(yState.state);
    if (isNaN(x_raw) || isNaN(y_raw)) return null;
    const present = (Math.abs(x_raw) > 1 || y_raw > 10);
    const speed_raw = parseFloat(spState?.state) || 0;

    // ── Kalman-Filter + Dead-Zone auf Rohkoordinaten ─────────────────────
    // Ziel: Sensorrauschen (~100-200mm) unterdrücken wenn Person stillsteht,
    //       aber echte Bewegung sofort weitergeben.
    //
    // Kalman vereinfacht (1D, konstante Position):
    //   P_pred = P + Q          (Prozessrauschen)
    //   K      = P_pred / (P_pred + R)   (Kalman-Gain)
    //   x_est  = x_est + K * (z - x_est) (Update)
    //   P      = (1-K) * P_pred
    //
    // R (Messrauschen): groß wenn still (Sensor unzuverlässig), klein wenn bewegt
    // Q (Prozessrauschen): groß wenn bewegt (erlaubt schnelle Änderung), klein wenn still
    if (!this._mmwaveKalman) this._mmwaveKalman = {};
    const kKey = `${sensor.id}_${targetNum}`;

    if (!present) {
      // Target verschwunden → State zurücksetzen
      delete this._mmwaveKalman[kKey];
    } else {
      const isMoving = Math.abs(speed_raw) > 0.05 || (dirState?.state||"").toLowerCase() === "moving";
      const isStill  = Math.abs(speed_raw) < 0.03 && !isMoving;

      // Rauschparameter: aus Kalibrierungs-Profil wenn vorhanden, sonst Defaults
      const kalProf = sensor.kalman_profiles?.[targetNum-1];
      const R_still_cal = kalProf?.R_still || 200000;
      const R = isStill  ? R_still_cal : isMoving ? 3000  : Math.round(R_still_cal * 0.15);
      const Q = isMoving ? 8000        : isStill  ? 5     : 200;

      let ks = this._mmwaveKalman[kKey];
      if (!ks) {
        // Erstinitialisierung mit Rohwert
        ks = { x: x_raw, y: y_raw, Px: R, Py: R };
        this._mmwaveKalman[kKey] = ks;
      }

      // Kalman-Update X
      const Px_pred = ks.Px + Q;
      const Kx = Px_pred / (Px_pred + R);
      ks.x  = ks.x + Kx * (x_raw - ks.x);
      ks.Px = (1 - Kx) * Px_pred;

      // Kalman-Update Y
      const Py_pred = ks.Py + Q;
      const Ky = Py_pred / (Py_pred + R);
      ks.y  = ks.y + Ky * (y_raw - ks.y);
      ks.Py = (1 - Ky) * Py_pred;

      // Dead-Zone: Wenn still und Änderung < threshold → komplett einfrieren
      // (verhindert restliches Zittern bei sehr niedrigem Rauschen)
      const deadZone = isStill ? 80 : 0; // mm
      if (Math.abs(x_raw - ks.x) < deadZone) ks.x = ks.x; // kein Update
      if (Math.abs(y_raw - ks.y) < deadZone) ks.y = ks.y;
    }

    // Gefilterte oder Rohwerte verwenden
    const ks = this._mmwaveKalman?.[kKey];
    const x_mm = ks ? Math.round(ks.x) : x_raw;
    const y_mm = ks ? Math.round(ks.y) : y_raw;

    // Achsen invertieren
    const ix = sensor.invert_x ? -x_mm : x_mm;
    const iy = sensor.invert_y ? -y_mm : y_mm;
    // Kalibrierung
    const cal = sensor.calibration || {};
    const cx = (ix / 1000) * (cal.scale_x || 1) + (cal.offset_x || 0);
    const cy = (iy / 1000) * (cal.scale_y || 1) + (cal.offset_y || 0);
    // Koordinatentransformation
    const rot = (sensor.rotation || 0) * Math.PI / 180;
    const floor_mx = (sensor.mx||0) + cx * Math.cos(rot) - cy * Math.sin(rot);
    const floor_my = (sensor.my||0) + cx * Math.sin(rot) + cy * Math.cos(rot);

    return {
      id: targetNum,
      x_mm, y_mm, x_raw, y_raw,  // raw für Debug-Panel
      floor_mx, floor_my,
      speed: speed_raw,
      angle: parseFloat(angState?.state)||0,
      direction: dirState?.state||"",
      present,
      moving: Math.abs(speed_raw) > 0.05,
      // Kalman-Diagnose für Debug-Panel
      kalman_gain_x: ks ? Math.round(this._mmwaveKalman[kKey]?.Px||0) : null,
    };
  }

  // Gibt Rohwerte (mm) ohne Rotation/Skalierung zurück – für Kalibrierung
  _getMmwaveTargetRaw(sensor, targetNum) {
    if (!this._hass) return null;
    const px = sensor.entity_prefix || "";
    const ov = sensor.entity_overrides || {};
    const ent = (key, suffix) => ov[key] || (px ? px + suffix : null);
    const xState = this._hass.states[ent(`target_${targetNum}_x`, `_target_${targetNum}_x`)];
    const yState = this._hass.states[ent(`target_${targetNum}_y`, `_target_${targetNum}_y`)];
    if (!xState || !yState) return null;
    const x_mm = parseFloat(xState.state);
    const y_mm = parseFloat(yState.state);
    if (isNaN(x_mm) || isNaN(y_mm)) return null;
    return { x_mm, y_mm };
  }

  _getMmwaveLiveTargetCount(sensor) {
    if (!sensor.entity_prefix && !sensor.entity_overrides) return 0;
    if (!this._hass) return 0;
    const px = sensor.entity_prefix || "";
    const ov = sensor.entity_overrides || {};
    const st = this._hass.states[ov["target_count"] || (px+"_presence_target_count")] ||
               this._hass.states[ov["target_count"] || (px+"_moving_target_count")];
    if (st) return parseInt(st.state)||0;
    // Fallback: count present targets
    let count=0;
    for(let t=1;t<=3;t++) {
      const tg=this._getMmwaveTarget(sensor,t);
      if(tg?.present) count++;
    }
    return count;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // DESIGN EDITOR SIDEBAR
  // ══════════════════════════════════════════════════════════════════════════
  _sidebarDesign() {
    const wrap = document.createElement("div");
    wrap.style.cssText = "display:flex;flex-direction:column;gap:0;height:100%;overflow:hidden";

    if (!this._pendingDesigns) this._pendingDesigns = [];
    if (this._designEditorState === undefined) this._designEditorState = null;

    const des = this._pendingDesigns;
    const st  = this._designEditorState; // null = list view, {idx} = editing

    // ── HEADER ──────────────────────────────────────────────────────────────
    const hdr = document.createElement("div");
    hdr.style.cssText = "padding:8px 10px 6px;border-bottom:1px solid #1c2535;flex-shrink:0";

    if (st === null) {
      // LIST VIEW header
      hdr.innerHTML = `<div style="font-size:10px;font-weight:700;color:#94a3b8;letter-spacing:1px;margin-bottom:6px">🎨 DESIGN-EDITOR</div>`;
      const newBtn = document.createElement("button");
      newBtn.style.cssText = "width:100%;padding:7px;border-radius:6px;border:1px solid #f59e0b55;background:#f59e0b11;color:#f59e0b;font-size:10px;font-weight:700;cursor:pointer;font-family:inherit";
      newBtn.innerHTML = "+ Neues Design erstellen";
      newBtn.addEventListener("click", () => {
        const id = "custom_" + Date.now();
        des.push({ id, name: "Neues Design", category: "deko",
          shapes2d: [], shapes3d: [], preview_color: "#00e5ff",
          use_as_lamp: false, use_as_deko: true });
        this._designEditorState = { idx: des.length - 1, tool: "rect",
          selShape: null, view: "2d", zoom: 1, pan: {x:0,y:0},
          dragging: null, strokeColor: "#00e5ff", fillColor: "#00e5ff33",
          strokeWidth: 2, fontSize: 12, text: "Text" };
        this._rebuildSidebar();
      });
      hdr.appendChild(newBtn);
    } else {
      // EDITOR header with back button
      const d = des[st.idx];
      const backBtn = document.createElement("button");
      backBtn.style.cssText = "padding:3px 8px;border-radius:4px;border:1px solid #1c2535;background:#111820;color:#445566;font-size:9px;cursor:pointer;font-family:inherit;margin-bottom:5px";
      backBtn.innerHTML = "← Liste";
      backBtn.addEventListener("click", () => { this._designEditorState = null; this._rebuildSidebar(); });
      const titleInp = document.createElement("input");
      titleInp.type = "text"; titleInp.value = d.name;
      titleInp.style.cssText = "flex:1;padding:3px 6px;border-radius:4px;border:1px solid #1c2535;background:#07090d;color:#c8d8ec;font-size:10px;font-weight:700;font-family:inherit";
      titleInp.addEventListener("change", () => { des[st.idx].name = titleInp.value; });
      const hRow = document.createElement("div");
      hRow.style.cssText = "display:flex;align-items:center;gap:5px";
      hRow.append(backBtn, titleInp);
      hdr.appendChild(hRow);
    }
    wrap.appendChild(hdr);

    if (st === null) {
      // ── DESIGN LIST ───────────────────────────────────────────────────────
      this._buildDesignList(wrap, des);
    } else {
      // ── EDITOR BODY ───────────────────────────────────────────────────────
      this._buildDesignEditorBody(wrap, des, st);
    }

    return wrap;
  }

  // ── Design list view ──────────────────────────────────────────────────────
  _buildDesignList(wrap, des) {
    const list = document.createElement("div");
    list.style.cssText = "flex:1;overflow-y:auto;padding:8px 10px";

    if (des.length === 0) {
      const empty = document.createElement("div");
      empty.style.cssText = "text-align:center;color:#445566;font-size:9px;padding:20px 0;line-height:2";
      empty.innerHTML = "Noch keine eigenen Designs.<br>Klicke <b>+ Neues Design</b> um zu beginnen.";
      list.appendChild(empty);
    }

    des.forEach((d, idx) => {
      const row = document.createElement("div");
      row.style.cssText = "display:flex;align-items:center;gap:6px;padding:7px 8px;border-radius:6px;border:1px solid #1c2535;background:#111820;margin-bottom:5px;cursor:pointer";
      row.addEventListener("mouseenter", () => row.style.borderColor = d.preview_color || "#f59e0b");
      row.addEventListener("mouseleave", () => row.style.borderColor = "#1c2535");

      // Preview mini-canvas
      const pCanvas = document.createElement("canvas");
      pCanvas.width = 38; pCanvas.height = 38;
      pCanvas.style.cssText = "border-radius:4px;border:1px solid #1c2535;background:#0a0e18;flex-shrink:0";
      this._renderDesignPreview(pCanvas, d);
      row.appendChild(pCanvas);

      // Info
      const info = document.createElement("div");
      info.style.cssText = "flex:1;min-width:0";
      const nameEl = document.createElement("div");
      nameEl.style.cssText = "font-size:9px;font-weight:700;color:#c8d8ec;white-space:nowrap;overflow:hidden;text-overflow:ellipsis";
      nameEl.textContent = d.name;
      const metaEl = document.createElement("div");
      metaEl.style.cssText = "font-size:7.5px;color:#445566;margin-top:1px";
      const shape2dN = d.shapes2d?.length || 0;
      const shape3dN = d.shapes3d?.length || 0;
      const tags = [];
      if (d.use_as_deko) tags.push("🏗 Deko");
      if (d.use_as_lamp) tags.push("💡 Lampe");
      metaEl.textContent = `${shape2dN} 2D · ${shape3dN} 3D${tags.length?" · "+tags.join(" "):""}`;
      info.append(nameEl, metaEl);
      row.appendChild(info);

      // Edit + Delete
      const editBtn = document.createElement("button");
      editBtn.style.cssText = "padding:3px 7px;border-radius:4px;border:1px solid #f59e0b44;background:#f59e0b11;color:#f59e0b;font-size:8px;cursor:pointer;font-family:inherit";
      editBtn.textContent = "✏ Edit";
      editBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this._designEditorState = { idx, tool: "select", selShape: null, view: "2d",
          zoom: 1, pan: {x:0,y:0}, dragging: null,
          strokeColor: "#00e5ff", fillColor: "#00e5ff33",
          strokeWidth: 2, fontSize: 12, text: "Text" };
        this._rebuildSidebar();
      });
      const delBtn = document.createElement("button");
      delBtn.style.cssText = "padding:3px 6px;border-radius:4px;border:1px solid #ef444433;background:#ef444411;color:#ef4444;font-size:8px;cursor:pointer;font-family:inherit";
      delBtn.textContent = "✕";
      delBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        des.splice(idx, 1);
        this._rebuildSidebar();
      });
      row.append(editBtn, delBtn);
      list.appendChild(row);
    });

    // Save button
    const saveBtn = document.createElement("button");
    saveBtn.style.cssText = "width:100%;margin-top:6px;padding:8px;border-radius:6px;border:1px solid #22c55e55;background:#22c55e11;color:#22c55e;font-size:10px;font-weight:700;cursor:pointer;font-family:inherit";
    saveBtn.innerHTML = des.length ? `💾 Speichern (${des.length} Designs)` : "Keine Designs";
    saveBtn.disabled = des.length === 0;
    saveBtn.addEventListener("click", async () => {
      saveBtn.disabled = true; saveBtn.textContent = "⏳...";
      try {
        await this._hass.callApi("POST", `ble_positioning/${this._entryId}/custom_designs`, { designs: des });
        if (this._data) this._data.custom_designs = structuredClone(des);
        this._showToast(`✓ ${des.length} Design${des.length!==1?"s":""} gespeichert`);
        saveBtn.innerHTML = "✓ Gespeichert";
        this._setTimeout(() => { saveBtn.disabled=false; saveBtn.innerHTML=`💾 Speichern (${des.length} Designs)`; }, 1800);
      } catch(e) { saveBtn.disabled=false; saveBtn.innerHTML=`💾 Speichern (${des.length} Designs)`; this._showToast("Fehler: "+e.message); }
    });
    list.appendChild(saveBtn);
    wrap.appendChild(list);
  }

  // ── Full Design Editor body ───────────────────────────────────────────────
  _buildDesignEditorBody(wrap, des, st) {
    const d = des[st.idx];
    const shapes = st.view === "2d" ? d.shapes2d : d.shapes3d;

    // ── Toolbar row ──────────────────────────────────────────────────────────
    const toolbar = document.createElement("div");
    toolbar.style.cssText = "display:flex;flex-wrap:wrap;gap:3px;padding:5px 8px;border-bottom:1px solid #1c2535;flex-shrink:0;background:#111820";

    // 2D / 3D toggle
    ["2d","3d"].forEach(v => {
      const btn = document.createElement("button");
      btn.style.cssText = `padding:3px 8px;border-radius:4px;font-size:9px;font-weight:700;cursor:pointer;font-family:inherit;` +
        `border:1px solid ${st.view===v?"#f59e0b":"#1c2535"};` +
        `background:${st.view===v?"#f59e0b33":"#0d1219"};` +
        `color:${st.view===v?"#f59e0b":"#445566"}`;
      btn.textContent = v.toUpperCase();
      btn.addEventListener("click", () => { st.view = v; st.selShape = null; this._rebuildSidebar(); });
      toolbar.appendChild(btn);
    });

    // Separator
    const sep = () => { const s=document.createElement("div"); s.style.cssText="width:1px;background:#1c2535;margin:2px 0;align-self:stretch"; return s; };
    toolbar.appendChild(sep());

    // Tool buttons
    const TOOLS = [
      { id:"select",  icon:"↖",   tip:"Auswählen/Verschieben" },
      { id:"rect",    icon:"▭",   tip:"Rechteck" },
      { id:"circle",  icon:"○",   tip:"Kreis/Ellipse" },
      { id:"line",    icon:"╱",   tip:"Linie" },
      { id:"polyline",icon:"⌒",   tip:"Polylinie (Klicken, Doppelklick=Ende)" },
      { id:"polygon", icon:"⬡",   tip:"Polygon (gefüllt)" },
      { id:"text",    icon:"T",   tip:"Text" },
      { id:"arc",     icon:"◔",   tip:"Bogen/Arc" },
      { id:"image",   icon:"🖼",   tip:"Bild/Textur einfügen" },
    ];
    TOOLS.forEach(tool => {
      const btn = document.createElement("button");
      btn.title = tool.tip;
      btn.style.cssText = `padding:3px 6px;border-radius:4px;font-size:11px;cursor:pointer;font-family:inherit;` +
        `border:1px solid ${st.tool===tool.id?"#f59e0b":"#1c2535"};` +
        `background:${st.tool===tool.id?"#f59e0b33":"#0d1219"};` +
        `color:${st.tool===tool.id?"#f59e0b":"#c8d8ec"}`;
      btn.textContent = tool.icon;
      btn.addEventListener("click", () => { st.tool=tool.id; st.selShape=null; this._rebuildSidebar(); });
      toolbar.appendChild(btn);
    });

    toolbar.appendChild(sep());

    // Undo
    const undoBtn = document.createElement("button");
    undoBtn.title = "Rückgängig (Ctrl+Z)";
    undoBtn.style.cssText = "padding:3px 6px;border-radius:4px;font-size:10px;cursor:pointer;font-family:inherit;border:1px solid #1c2535;background:#0d1219;color:#445566";
    undoBtn.textContent = "↩";
    undoBtn.addEventListener("click", () => {
      if (st.history?.length) { shapes.splice(0, shapes.length, ...JSON.parse(st.history.pop())); this._renderDesignCanvas(edCanvas, d, st); }
    });
    toolbar.appendChild(undoBtn);

    // Clear all
    const clearBtn = document.createElement("button");
    clearBtn.title = "Alle Shapes löschen";
    clearBtn.style.cssText = "padding:3px 6px;border-radius:4px;font-size:10px;cursor:pointer;font-family:inherit;border:1px solid #ef444433;background:#0d1219;color:#ef4444";
    clearBtn.textContent = "🗑";
    clearBtn.addEventListener("click", () => {
      if (!shapes.length) return;
      if (!st.history) st.history = [];
      st.history.push(JSON.stringify(shapes));
      shapes.splice(0, shapes.length);
      this._renderDesignCanvas(edCanvas, d, st);
      this._rebuildSidebar();
    });
    toolbar.appendChild(clearBtn);

    wrap.appendChild(toolbar);

    // ── Color + stroke controls ──────────────────────────────────────────────
    const ctrlRow = document.createElement("div");
    ctrlRow.style.cssText = "display:flex;flex-wrap:wrap;align-items:center;gap:5px;padding:4px 8px;border-bottom:1px solid #1c2535;flex-shrink:0;font-size:8px;color:#445566";

    const mkColorInp = (label, key) => {
      const lbl = document.createElement("span"); lbl.textContent = label;
      const inp = document.createElement("input"); inp.type = "color";
      inp.value = (st[key]||"#00e5ff").replace(/[0-9a-f]{2}$/i,"ff").substring(0,7);
      inp.style.cssText = "width:26px;height:20px;border:none;border-radius:3px;cursor:pointer;padding:0;background:none";
      inp.addEventListener("input", () => {
        st[key] = inp.value;
        // If shape selected, update it
        if (st.selShape != null && shapes[st.selShape]) {
          if (key==="strokeColor") shapes[st.selShape].stroke = inp.value;
          if (key==="fillColor")   shapes[st.selShape].fill   = inp.value;
          this._renderDesignCanvas(edCanvas, d, st);
        }
      });
      return [lbl, inp];
    };

    ctrlRow.append(...mkColorInp("Rand:", "strokeColor"), ...mkColorInp("Füllung:", "fillColor"));

    const mkNumInp = (label, key, min, max, step) => {
      const lbl = document.createElement("span"); lbl.textContent = label;
      const inp = document.createElement("input"); inp.type="number";
      inp.min=min; inp.max=max; inp.step=step; inp.value=st[key];
      inp.style.cssText = "width:38px;padding:1px 4px;border-radius:3px;border:1px solid #1c2535;background:#07090d;color:#c8d8ec;font-size:8px;text-align:center";
      inp.addEventListener("input", () => {
        st[key] = parseFloat(inp.value) || st[key];
        if (st.selShape!=null && shapes[st.selShape]) {
          if (key==="strokeWidth") shapes[st.selShape].sw = st[key];
          if (key==="fontSize")    shapes[st.selShape].fs = st[key];
          this._renderDesignCanvas(edCanvas, d, st);
        }
      });
      return [lbl, inp];
    };
    ctrlRow.append(...mkNumInp("Breite:", "strokeWidth", 0.5, 20, 0.5));

    // Text content (only relevant for text tool)
    const txtLbl = document.createElement("span"); txtLbl.textContent = "Text:";
    const txtInp = document.createElement("input"); txtInp.type="text"; txtInp.value=st.text||"";
    txtInp.style.cssText = "width:55px;padding:1px 4px;border-radius:3px;border:1px solid #1c2535;background:#07090d;color:#c8d8ec;font-size:8px";
    txtInp.addEventListener("input", () => {
      st.text = txtInp.value;
      if (st.selShape!=null && shapes[st.selShape]?.type==="text") {
        shapes[st.selShape].text = txtInp.value;
        this._renderDesignCanvas(edCanvas, d, st);
      }
    });
    ctrlRow.append(txtLbl, txtInp);

    // Texture upload button
    const texLbl = document.createElement("span"); texLbl.textContent = "Textur:";
    const texBtn = document.createElement("button");
    texBtn.style.cssText = "padding:2px 6px;border-radius:3px;border:1px solid #f59e0b55;background:#f59e0b11;color:#f59e0b;font-size:8px;cursor:pointer;font-family:inherit";
    texBtn.textContent = "📁 Bild";
    texBtn.title = "Bild/Textur als Shape einfügen";
    const texFileInp = document.createElement("input");
    texFileInp.type = "file"; texFileInp.accept = "image/*";
    texFileInp.style.cssText = "display:none";
    texFileInp.addEventListener("change", () => {
      const file = texFileInp.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const src = ev.target.result;
        const img = new Image();
        img.onload = () => {
          const sh = { type:"image", x:-img.width/2, y:-img.height/2,
            w: img.width, h: img.height, src, stroke:"transparent",
            fill:"transparent", sw:0, _img: null };
          if (!st.history) st.history = [];
          st.history.push(JSON.stringify(shapes));
          shapes.push(sh);
          st.selShape = shapes.length-1;
          this._renderDesignCanvas(edCanvas, d, st);
          this._rebuildSidebar();
        };
        img.src = src;
        texFileInp.value = "";
      };
      reader.readAsDataURL(file);
    });
    texBtn.addEventListener("click", () => texFileInp.click());
    ctrlRow.append(texLbl, texBtn, texFileInp);
    wrap.appendChild(ctrlRow);

    // ── Canvas ───────────────────────────────────────────────────────────────
    const edCanvas = document.createElement("canvas");
    const CW = 220, CH = 200;
    edCanvas.width = CW; edCanvas.height = CH;
    edCanvas.style.cssText = `width:${CW}px;height:${CH}px;cursor:crosshair;background:#080c15;border-bottom:1px solid #1c2535;flex-shrink:0;display:block`;
    wrap.appendChild(edCanvas);

    // Grid reference lines
    this._renderDesignCanvas(edCanvas, d, st);

    // ── Canvas interaction ───────────────────────────────────────────────────
    this._attachDesignCanvasEvents(edCanvas, d, st, shapes, () => this._renderDesignCanvas(edCanvas, d, st), () => this._rebuildSidebar());

    // ── Shape layer panel ────────────────────────────────────────────────────
    const layerPanelWrap = document.createElement("div");
    layerPanelWrap.style.cssText = "flex:1;overflow-y:auto;padding:6px 8px;min-height:0";

    const layerHdr = document.createElement("div");
    layerHdr.style.cssText = "font-size:8px;font-weight:700;color:#445566;letter-spacing:0.5px;margin-bottom:4px;display:flex;justify-content:space-between";
    layerHdr.innerHTML = `<span>SHAPES (${shapes.length})</span>`;
    layerPanelWrap.appendChild(layerHdr);

    if (shapes.length === 0) {
      const hint = document.createElement("div");
      hint.style.cssText = "font-size:8px;color:#445566;padding:6px 0;text-align:center";
      hint.textContent = "Werkzeug wählen → auf Canvas zeichnen";
      layerPanelWrap.appendChild(hint);
    }

    shapes.forEach((sh, si) => {
      const sRow = document.createElement("div");
      const isActive = st.selShape === si;
      sRow.style.cssText = `display:flex;align-items:center;gap:4px;padding:3px 6px;border-radius:4px;` +
        `border:1px solid ${isActive?"#f59e0b55":"#1c2535"};` +
        `background:${isActive?"#f59e0b11":"#111820"};` +
        `margin-bottom:3px;cursor:pointer;font-size:8px`;
      // Color dot
      const dot = document.createElement("div");
      dot.style.cssText = `width:10px;height:10px;border-radius:2px;background:${sh.stroke||sh.fill||"#888"};flex-shrink:0`;
      const typeLbl = document.createElement("span");
      typeLbl.style.cssText = "color:#445566;flex-shrink:0";
      typeLbl.textContent = ({ rect:"▭",circle:"○",line:"╱",polyline:"⌒",polygon:"⬡",text:"T",arc:"◔" }[sh.type]||"?");
      const nameLbl = document.createElement("span");
      nameLbl.style.cssText = "flex:1;color:#c8d8ec;overflow:hidden;text-overflow:ellipsis;white-space:nowrap";
      nameLbl.textContent = sh.label || sh.type + (sh.text?" \""+sh.text.substring(0,8)+"\"":" #"+si);
      // Visibility toggle
      const visBtn = document.createElement("button");
      visBtn.style.cssText = "padding:1px 4px;border:none;background:none;cursor:pointer;font-size:9px;color:#445566";
      visBtn.textContent = sh.hidden ? "🙈" : "👁";
      visBtn.addEventListener("click", (e) => { e.stopPropagation(); sh.hidden=!sh.hidden; this._renderDesignCanvas(edCanvas,d,st); this._rebuildSidebar(); });
      // Tile toggle for image shapes
      if (sh.type==="image") {
        const tileBtn = document.createElement("button");
        tileBtn.style.cssText = `padding:1px 4px;border:none;background:none;cursor:pointer;font-size:9px;color:${sh.tile?"#f59e0b":"#445566"}`;
        tileBtn.title = sh.tile ? "Kacheln: AN" : "Kacheln: AUS";
        tileBtn.textContent = "▦";
        tileBtn.addEventListener("click", (e) => { e.stopPropagation(); sh.tile=!sh.tile; this._renderDesignCanvas(edCanvas,d,st); this._rebuildSidebar(); });
        sRow.appendChild(tileBtn);
      }
      // Delete
      const delS = document.createElement("button");
      delS.style.cssText = "padding:1px 4px;border:none;background:none;cursor:pointer;font-size:9px;color:#ef4444";
      delS.textContent = "✕";
      delS.addEventListener("click", (e) => {
        e.stopPropagation();
        if(!st.history) st.history=[];
        st.history.push(JSON.stringify(shapes));
        shapes.splice(si,1);
        if(st.selShape===si) st.selShape=null;
        else if(st.selShape>si) st.selShape--;
        this._renderDesignCanvas(edCanvas,d,st);
        this._rebuildSidebar();
      });
      sRow.append(dot, typeLbl, nameLbl, visBtn, delS);
      sRow.addEventListener("click", () => {
        st.selShape = (st.selShape===si) ? null : si;
        this._renderDesignCanvas(edCanvas,d,st);
        this._rebuildSidebar();
      });
      layerPanelWrap.appendChild(sRow);
    });

    // ── Design properties (category, use_as) ─────────────────────────────────
    const propBox = document.createElement("div");
    propBox.style.cssText = "padding:6px 8px;border-top:1px solid #1c2535;flex-shrink:0";

    // Category
    const catRow = document.createElement("div");
    catRow.style.cssText = "display:flex;align-items:center;gap:5px;margin-bottom:5px";
    const catLbl = document.createElement("span");
    catLbl.style.cssText = "font-size:8px;color:#445566;white-space:nowrap";
    catLbl.textContent = "Kategorie:";
    const catSel = document.createElement("select");
    catSel.style.cssText = "flex:1;padding:2px 4px;border-radius:3px;border:1px solid #1c2535;background:#07090d;color:#c8d8ec;font-size:8px";
    [["deko","🏗 Deko-Element"],["lamp","💡 Lampentyp"],["both","Beides"]].forEach(([v,l])=>{
      const opt=document.createElement("option"); opt.value=v; opt.textContent=l;
      if((d.category||"deko")===v) opt.selected=true;
      catSel.appendChild(opt);
    });
    catSel.addEventListener("change",()=>{
      d.category=catSel.value;
      d.use_as_deko = (catSel.value==="deko"||catSel.value==="both");
      d.use_as_lamp = (catSel.value==="lamp"||catSel.value==="both");
    });
    catRow.append(catLbl, catSel);
    propBox.appendChild(catRow);

    // Preview color
    const pcRow = document.createElement("div");
    pcRow.style.cssText = "display:flex;align-items:center;gap:5px;margin-bottom:5px";
    const pcLbl = document.createElement("span");
    pcLbl.style.cssText = "font-size:8px;color:#445566";
    pcLbl.textContent = "Vorschaufarbe:";
    const pcInp = document.createElement("input");
    pcInp.type="color"; pcInp.value=(d.preview_color||"#00e5ff").substring(0,7);
    pcInp.style.cssText = "width:28px;height:20px;border:none;border-radius:3px;cursor:pointer;padding:0;background:none";
    pcInp.addEventListener("input",()=>{ d.preview_color=pcInp.value; });
    const pcSize = document.createElement("span");
    pcSize.style.cssText = "font-size:7.5px;color:#445566";
    pcSize.textContent = "Canvas: 200×200 units = Vollgröße";
    pcRow.append(pcLbl, pcInp, pcSize);
    propBox.appendChild(pcRow);

    layerPanelWrap.appendChild(propBox);
    wrap.appendChild(layerPanelWrap);
  }

  // ── Render design canvas ──────────────────────────────────────────────────
  _renderDesignCanvas(canvas, design, st) {
    const ctx = canvas.getContext("2d");
    const W = canvas.width, H = canvas.height;
    const shapes = st.view === "2d" ? design.shapes2d : design.shapes3d;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#080c15";
    ctx.fillRect(0, 0, W, H);

    // Grid
    ctx.strokeStyle = "rgba(255,255,255,0.04)";
    ctx.lineWidth = 0.5;
    const gridStep = 20 * st.zoom;
    const ox = (st.pan?.x||0) % gridStep, oy = (st.pan?.y||0) % gridStep;
    for (let x = ox; x < W; x += gridStep) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
    for (let y = oy; y < H; y += gridStep) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }
    // Center cross
    ctx.strokeStyle = "rgba(255,255,255,0.12)"; ctx.lineWidth = 1; ctx.setLineDash([3,3]);
    ctx.beginPath(); ctx.moveTo(W/2,0); ctx.lineTo(W/2,H); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0,H/2); ctx.lineTo(W,H/2); ctx.stroke();
    ctx.setLineDash([]);

    const zoom = st.zoom || 1;
    const px = st.pan?.x || 0, py = st.pan?.y || 0;

    // Draw all shapes
    shapes.forEach((sh, si) => {
      if (sh.hidden) return;
      ctx.save();
      ctx.translate(px + W/2, py + H/2);
      ctx.scale(zoom, zoom);
      this._drawDesignShape(ctx, sh, st.selShape === si);
      ctx.restore();
    });

    // In-progress shape
    if (st._drawing) {
      ctx.save();
      ctx.translate(px + W/2, py + H/2);
      ctx.scale(zoom, zoom);
      this._drawDesignShape(ctx, st._drawing, false, true);
      ctx.restore();
    }
  }

  // ── Draw a single design shape ────────────────────────────────────────────
  _drawDesignShape(ctx, sh, selected=false, ghost=false) {
    ctx.globalAlpha = ghost ? 0.55 : (sh.opacity ?? 1.0);
    const stroke = sh.stroke || "#00e5ff";
    const fill   = sh.fill   || "transparent";
    const sw     = sh.sw     || 1.5;
    ctx.strokeStyle = stroke;
    ctx.fillStyle   = fill;
    ctx.lineWidth   = sw;
    ctx.lineCap     = "round";
    ctx.lineJoin    = "round";
    if (sh.dash) ctx.setLineDash(sh.dash); else ctx.setLineDash([]);
    if (sh.shadow) { ctx.shadowColor=stroke; ctx.shadowBlur=sh.shadow; }

    switch(sh.type) {
      case "rect": {
        const [x,y,w,h] = [sh.x,sh.y,sh.w,sh.h];
        if (fill !== "transparent") ctx.fillRect(x,y,w,h);
        ctx.strokeRect(x,y,w,h);
        break;
      }
      case "circle": {
        ctx.beginPath(); ctx.ellipse(sh.x,sh.y,sh.rx||sh.r,sh.ry||sh.r,0,0,Math.PI*2);
        if (fill!=="transparent") ctx.fill(); ctx.stroke();
        break;
      }
      case "line": {
        ctx.beginPath(); ctx.moveTo(sh.x1,sh.y1); ctx.lineTo(sh.x2,sh.y2); ctx.stroke();
        break;
      }
      case "polyline": case "polygon": {
        if (!sh.pts?.length) break;
        ctx.beginPath(); ctx.moveTo(sh.pts[0][0],sh.pts[0][1]);
        sh.pts.slice(1).forEach(p => ctx.lineTo(p[0],p[1]));
        if (sh.type==="polygon") { ctx.closePath(); if(fill!=="transparent") ctx.fill(); }
        ctx.stroke();
        break;
      }
      case "text": {
        ctx.font = `${sh.bold?"bold ":""}${sh.fs||12}px 'JetBrains Mono',monospace`;
        ctx.fillStyle = stroke;
        ctx.textAlign = sh.align || "center";
        ctx.textBaseline = "middle";
        ctx.fillText(sh.text||"", sh.x, sh.y);
        break;
      }
      case "arc": {
        ctx.beginPath();
        ctx.arc(sh.x, sh.y, sh.r||20, sh.a1||0, sh.a2||(Math.PI*1.5));
        if (fill!=="transparent") ctx.fill(); ctx.stroke();
        break;
      }
      case "image": {
        if (!sh.src) break;
        // Cache decoded image on shape object
        if (!sh._img || sh._img.src !== sh.src) {
          sh._img = new Image();
          sh._img.src = sh.src;
          sh._img.onload = () => {}; // will repaint next frame
        }
        if (sh._img.complete && sh._img.naturalWidth > 0) {
          ctx.globalAlpha = sh.opacity ?? 1;
          // Optional: tile as pattern or stretch
          if (sh.tile) {
            const pat = ctx.createPattern(sh._img, "repeat");
            if (pat) {
              ctx.fillStyle = pat;
              ctx.fillRect(sh.x, sh.y, sh.w||sh._img.width, sh.h||sh._img.height);
            }
          } else {
            ctx.drawImage(sh._img, sh.x, sh.y, sh.w||sh._img.width, sh.h||sh._img.height);
          }
          ctx.globalAlpha = 1;
          // Outline
          if (sw > 0) {
            ctx.strokeStyle = stroke; ctx.lineWidth = sw;
            ctx.strokeRect(sh.x, sh.y, sh.w||sh._img.width, sh.h||sh._img.height);
          }
        } else {
          // Placeholder while loading
          ctx.strokeStyle="#f59e0b"; ctx.lineWidth=1; ctx.setLineDash([4,3]);
          ctx.strokeRect(sh.x||0, sh.y||0, sh.w||60, sh.h||60);
          ctx.setLineDash([]); ctx.fillStyle="#f59e0b33";
          ctx.fillRect(sh.x||0, sh.y||0, sh.w||60, sh.h||60);
          ctx.fillStyle="#f59e0b"; ctx.font="10px sans-serif";
          ctx.textAlign="center"; ctx.textBaseline="middle";
          ctx.fillText("🖼", (sh.x||0)+(sh.w||60)/2, (sh.y||0)+(sh.h||60)/2);
        }
        break;
      }
    }
    ctx.shadowBlur = 0; ctx.globalAlpha = 1; ctx.setLineDash([]);

    // Selection handles
    if (selected && !ghost) {
      ctx.strokeStyle = "#f59e0b"; ctx.lineWidth = 1; ctx.setLineDash([3,3]);
      const bbox = this._shapebbox(sh);
      if (bbox) {
        ctx.strokeRect(bbox.x-3, bbox.y-3, bbox.w+6, bbox.h+6);
        ctx.setLineDash([]);
        ctx.fillStyle="#f59e0b";
        [[bbox.x-3,bbox.y-3],[bbox.x+bbox.w+3,bbox.y-3],
         [bbox.x-3,bbox.y+bbox.h+3],[bbox.x+bbox.w+3,bbox.y+bbox.h+3]].forEach(([hx,hy])=>{
          ctx.fillRect(hx-3,hy-3,6,6);
        });
      }
    }
  }

  // ── Shape bounding box ────────────────────────────────────────────────────
  _shapebbox(sh) {
    switch(sh.type) {
      case "rect":     return { x:sh.x, y:sh.y, w:sh.w, h:sh.h };
      case "circle":   return { x:sh.x-(sh.rx||sh.r), y:sh.y-(sh.ry||sh.r), w:(sh.rx||sh.r)*2, h:(sh.ry||sh.r)*2 };
      case "line":     return { x:Math.min(sh.x1,sh.x2), y:Math.min(sh.y1,sh.y2), w:Math.abs(sh.x2-sh.x1)||4, h:Math.abs(sh.y2-sh.y1)||4 };
      case "polyline": case "polygon":
        if (!sh.pts?.length) return null;
        const xs=sh.pts.map(p=>p[0]), ys=sh.pts.map(p=>p[1]);
        const minx=Math.min(...xs),miny=Math.min(...ys);
        return {x:minx,y:miny,w:Math.max(...xs)-minx||4,h:Math.max(...ys)-miny||4};
      case "text":     return { x:sh.x-30, y:sh.y-8, w:60, h:16 };
      case "arc":      return { x:sh.x-(sh.r||20), y:sh.y-(sh.r||20), w:(sh.r||20)*2, h:(sh.r||20)*2 };
      case "image":    return { x:sh.x||0, y:sh.y||0, w:sh.w||60, h:sh.h||60 };
      default: return null;
    }
  }

  // ── Canvas point hit test ─────────────────────────────────────────────────
  _shapeHitTest(sh, cx, cy, tol=6) {
    const bb = this._shapebbox(sh);
    if (!bb) return false;
    return cx >= bb.x-tol && cx <= bb.x+bb.w+tol && cy >= bb.y-tol && cy <= bb.y+bb.h+tol;
  }

  // ── Attach mouse/touch events to design canvas ───────────────────────────
  _attachDesignCanvasEvents(canvas, design, st, shapes, redraw, rebuildSidebar) {
    const W = canvas.width, H = canvas.height;

    const toLocal = (e) => {
      const r = canvas.getBoundingClientRect();
      const ex = (e.touches?.[0]?.clientX ?? e.clientX) - r.left;
      const ey = (e.touches?.[0]?.clientY ?? e.clientY) - r.top;
      const zoom = st.zoom||1;
      const px = st.pan?.x||0, py = st.pan?.y||0;
      return { x: (ex - W/2 - px) / zoom, y: (ey - H/2 - py) / zoom };
    };

    let isDown = false, startPt = null, panStart = null;

    const onDown = (e) => {
      e.preventDefault();
      isDown = true;
      const pt = toLocal(e);
      startPt = pt;

      if (e.altKey || st.tool === "_pan") {
        // Pan mode
        panStart = { x: e.clientX, y: e.clientY, ox: st.pan?.x||0, oy: st.pan?.y||0 };
        return;
      }

      if (st.tool === "select") {
        // Hit test shapes (reverse for top-first)
        let hit = -1;
        for (let i=shapes.length-1; i>=0; i--) {
          if (!shapes[i].hidden && this._shapeHitTest(shapes[i], pt.x, pt.y)) { hit=i; break; }
        }
        st.selShape = (hit >= 0) ? hit : null;
        if (hit >= 0) {
          st._dragStart = { mx: pt.x, my: pt.y, shapeSnap: structuredClone(shapes[hit]) };
        }
        rebuildSidebar(); return;
      }

      if (st.tool === "polyline" || st.tool === "polygon") {
        if (!st._drawing) {
          st._drawing = { type: st.tool, pts: [[pt.x,pt.y]], stroke: st.strokeColor, fill: st.fillColor, sw: st.strokeWidth };
        } else {
          st._drawing.pts.push([pt.x,pt.y]);
        }
        redraw(); return;
      }

      // Start drawing for rect/circle/line/arc
      st._drawing = this._startShape(st.tool, pt, st);
      redraw();
    };

    const onMove = (e) => {
      if (!isDown) {
        // Show cursor cross
        if (st.tool !== "select") canvas.style.cursor = "crosshair";
        return;
      }
      e.preventDefault();
      const pt = toLocal(e);

      if (panStart) {
        if (!st.pan) st.pan = {x:0,y:0};
        st.pan.x = panStart.ox + (e.clientX - panStart.x);
        st.pan.y = panStart.oy + (e.clientY - panStart.y);
        redraw(); return;
      }

      if (st.tool === "select" && st._dragStart && st.selShape != null) {
        const sh = shapes[st.selShape];
        const snap = st._dragStart.shapeSnap;
        const dx = pt.x - st._dragStart.mx, dy = pt.y - st._dragStart.my;
        this._moveShape(sh, snap, dx, dy);
        redraw(); return;
      }

      if (st._drawing) {
        this._updateShape(st._drawing, startPt, pt, st.tool);
        redraw();
      }
    };

    const onUp = (e) => {
      if (!isDown) return;
      isDown = false;
      panStart = null;
      const pt = toLocal(e);

      if (st._dragStart) { st._dragStart = null; return; }

      if (st.tool === "polyline" || st.tool === "polygon") return; // finished by dblclick

      if (st._drawing) {
        this._updateShape(st._drawing, startPt, pt, st.tool);
        const sh = st._drawing;
        st._drawing = null;
        // Only keep if has size
        const valid = (sh.type==="text") ||
          (sh.type==="line" && (Math.abs((sh.x2||0)-(sh.x1||0))>2||Math.abs((sh.y2||0)-(sh.y1||0))>2)) ||
          (sh.w!=null && Math.abs(sh.w)>2 && Math.abs(sh.h||sh.w)>2) ||
          (sh.r!=null && sh.r>2) ||
          (sh.pts?.length > 1);
        if (valid) {
          if (!st.history) st.history=[];
          st.history.push(JSON.stringify(shapes));
          shapes.push(sh);
          st.selShape = shapes.length-1;
          rebuildSidebar();
        }
        redraw();
      }
    };

    const onDblClick = (e) => {
      e.preventDefault();
      if (st.tool==="polyline"||st.tool==="polygon") {
        if (st._drawing?.pts?.length>=2) {
          if (!st.history) st.history=[];
          st.history.push(JSON.stringify(shapes));
          shapes.push(st._drawing);
          st.selShape=shapes.length-1;
          st._drawing=null;
          rebuildSidebar(); redraw();
        }
      } else if (st.tool==="text") {
        const pt=toLocal(e);
        if(!st.history) st.history=[];
        st.history.push(JSON.stringify(shapes));
        shapes.push({ type:"text", x:pt.x, y:pt.y, text:st.text||"Text",
          stroke:st.strokeColor, fs:st.fontSize, sw:0 });
        st.selShape=shapes.length-1; rebuildSidebar(); redraw();
      }
    };

    const onWheel = (e) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.12 : 0.89;
      st.zoom = Math.max(0.2, Math.min(8, (st.zoom||1) * factor));
      redraw();
    };

    // Keyboard
    const onKey = (e) => {
      if (e.key==="Escape") { st._drawing=null; redraw(); }
      if (e.key==="Delete"&&st.selShape!=null) {
        if(!st.history) st.history=[];
        st.history.push(JSON.stringify(shapes));
        shapes.splice(st.selShape,1); st.selShape=null; rebuildSidebar(); redraw();
      }
      if (e.ctrlKey&&e.key==="z") {
        if(st.history?.length){ shapes.splice(0,shapes.length,...JSON.parse(st.history.pop())); rebuildSidebar(); redraw(); }
      }
    };

    canvas.addEventListener("mousedown",  onDown);
    canvas.addEventListener("mousemove",  onMove);
    canvas.addEventListener("mouseup",    onUp);
    canvas.addEventListener("dblclick",   onDblClick);
    canvas.addEventListener("wheel",      onWheel, {passive:false});
    canvas.addEventListener("touchstart", onDown, {passive:false});
    canvas.addEventListener("touchmove",  onMove, {passive:false});
    canvas.addEventListener("touchend",   onUp,   {passive:false});
    document.addEventListener("keydown", onKey);
    // Cleanup on canvas detach
    const obs = new MutationObserver(() => {
      if (!canvas.isConnected) { document.removeEventListener("keydown", onKey); obs.disconnect(); }
    });
    obs.observe(canvas.parentNode || document.body, {childList:true, subtree:true});
  }

  // ── Shape factory: initial shape from start point ────────────────────────
  _startShape(tool, pt, st) {
    const base = { stroke: st.strokeColor, fill: st.fillColor, sw: st.strokeWidth };
    switch(tool) {
      case "rect":   return { ...base, type:"rect",   x:pt.x, y:pt.y, w:0,  h:0 };
      case "circle": return { ...base, type:"circle", x:pt.x, y:pt.y, rx:0, ry:0, r:0 };
      case "line":   return { ...base, type:"line",   x1:pt.x, y1:pt.y, x2:pt.x, y2:pt.y };
      case "arc":    return { ...base, type:"arc",    x:pt.x, y:pt.y, r:0, a1:0, a2:Math.PI*1.5 };
      case "text":   return { ...base, type:"text",   x:pt.x, y:pt.y, text:st.text||"Text", fs:st.fontSize, sw:0 };
      default:       return { ...base, type:tool, pts:[[pt.x,pt.y]] };
    }
  }

  // ── Update in-progress shape while dragging ───────────────────────────────
  _updateShape(sh, start, cur, tool) {
    const dx=cur.x-start.x, dy=cur.y-start.y;
    switch(tool) {
      case "rect":
        sh.x=Math.min(start.x,cur.x); sh.y=Math.min(start.y,cur.y);
        sh.w=Math.abs(dx); sh.h=Math.abs(dy); break;
      case "circle":
        sh.x=start.x; sh.y=start.y;
        sh.rx=Math.abs(dx); sh.ry=Math.abs(dy);
        sh.r=Math.hypot(dx,dy)/2; break;
      case "line":
        sh.x2=cur.x; sh.y2=cur.y; break;
      case "arc":
        sh.x=start.x; sh.y=start.y; sh.r=Math.hypot(dx,dy);
        sh.a1=Math.atan2(dy,dx); sh.a2=sh.a1+Math.PI*1.2; break;
      case "image":
        sh.x=Math.min(start.x,cur.x); sh.y=Math.min(start.y,cur.y);
        sh.w=Math.abs(dx); sh.h=Math.abs(dy); break;
    }
  }

  // ── Move shape by delta ───────────────────────────────────────────────────
  _moveShape(sh, snap, dx, dy) {
    switch(sh.type) {
      case "rect":
        sh.x=(snap.x||0)+dx; sh.y=(snap.y||0)+dy; break;
      case "circle":
        sh.x=(snap.x||0)+dx; sh.y=(snap.y||0)+dy; break;
      case "line":
        sh.x1=(snap.x1||0)+dx; sh.y1=(snap.y1||0)+dy;
        sh.x2=(snap.x2||0)+dx; sh.y2=(snap.y2||0)+dy; break;
      case "polyline": case "polygon":
        sh.pts=snap.pts.map(p=>[p[0]+dx, p[1]+dy]); break;
      case "text": case "arc":
        sh.x=(snap.x||0)+dx; sh.y=(snap.y||0)+dy; break;
    }
  }

  // ── Render mini preview for design list ──────────────────────────────────
  _renderDesignPreview(canvas, design) {
    const ctx = canvas.getContext("2d");
    const W=canvas.width, H=canvas.height;
    ctx.fillStyle="#080c15"; ctx.fillRect(0,0,W,H);
    const shapes = design.shapes2d?.length ? design.shapes2d : design.shapes3d;
    if (!shapes?.length) {
      ctx.fillStyle="var(--muted,#444)"; ctx.font="18px serif";
      ctx.textAlign="center"; ctx.textBaseline="middle";
      ctx.fillText("?", W/2, H/2); return;
    }
    // Auto-fit: find bounding box
    let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
    shapes.forEach(sh => {
      const bb=this._shapebbox(sh);
      if(bb){minX=Math.min(minX,bb.x);minY=Math.min(minY,bb.y);maxX=Math.max(maxX,bb.x+bb.w);maxY=Math.max(maxY,bb.y+bb.h);}
    });
    const bw=maxX-minX||1, bh=maxY-minY||1;
    const scale=Math.min((W-6)/bw, (H-6)/bh)*0.85;
    ctx.save();
    ctx.translate(W/2-(minX+bw/2)*scale, H/2-(minY+bh/2)*scale);
    ctx.scale(scale,scale);
    shapes.forEach(sh => { if(!sh.hidden) this._drawDesignShape(ctx,sh,false); });
    ctx.restore();
  }



  // ══════════════════════════════════════════════════════════════════════════
  // MMWAVE DRAWING – Canvas overlay
  // ══════════════════════════════════════════════════════════════════════════
  _drawMmwaveOverlay() {
    const ctx     = this._ctx;
    // Fallback: _pendingMmwave kann leer sein ([] ist truthy!) → explizit prüfen
    const sensors = (this._pendingMmwave?.length > 0 ? this._pendingMmwave : this._data?.mmwave_sensors) || [];
    if (!sensors.length) return;
    const t = Date.now() / 1000;

    sensors.forEach(sensor => {
      if (sensor.mx == null || sensor.my == null) return;
      if (this._mmwaveCalib?.sensorId === sensor.id) this._mmwaveCalibTick(sensor);
      const sc = this._f2c(sensor.mx, sensor.my);
      const col = sensor.color || "#ff6b35";

      // ── 1. FOV Kegel ───────────────────────────────────────────────────────
      if (sensor.show_fov !== false) {
        const fovAngle = (sensor.fov_angle || 120) * Math.PI / 180;
        const rot      = (sensor.rotation || 0) * Math.PI / 180;
        const rangeM   = sensor.fov_range || 6;
        const d        = this._data;
        if (d) {
          const W = this._canvas.width, H = this._canvas.height;
          const fw = d.floor_w||10, fh = d.floor_h||10;
          const zoom = this._zoom || 1;
          const rangePx = (rangeM / fw) * W * zoom;

          // Base direction: sensor faces "down" (0°=up, 90°=right in floor coords)
          const baseAngle = rot - Math.PI/2; // rotate so 0° = facing up
          const aStart = baseAngle - fovAngle/2;
          const aEnd   = baseAngle + fovAngle/2;

          // Heatmap-style gradient fill
          const grad = ctx.createRadialGradient(sc.x,sc.y,0,sc.x,sc.y,rangePx);
          grad.addColorStop(0,   col + "30");
          grad.addColorStop(0.6, col + "18");
          grad.addColorStop(1,   col + "00");
          ctx.beginPath();
          ctx.moveTo(sc.x,sc.y);
          ctx.arc(sc.x,sc.y,rangePx,aStart,aEnd);
          ctx.closePath();
          ctx.fillStyle = grad;
          ctx.fill();
          // Outline
          ctx.beginPath();
          ctx.moveTo(sc.x,sc.y);
          ctx.arc(sc.x,sc.y,rangePx,aStart,aEnd);
          ctx.closePath();
          ctx.strokeStyle = col + "60";
          ctx.lineWidth = 1;
          ctx.setLineDash([4,4]);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }

      // ── 2. Sensor Icon ──────────────────────────────────────────────────────
      // Pulsing ring
      const pulse = 0.6 + 0.4 * Math.sin(t * 2.5);
      const grd = ctx.createRadialGradient(sc.x,sc.y,0,sc.x,sc.y,16);
      grd.addColorStop(0, col+"80"); grd.addColorStop(1, col+"00");
      ctx.fillStyle=grd; ctx.beginPath(); ctx.arc(sc.x,sc.y,16*pulse,0,Math.PI*2); ctx.fill();
      // Core
      ctx.fillStyle=col; ctx.beginPath(); ctx.arc(sc.x,sc.y,5,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle="white"; ctx.lineWidth=1.5; ctx.stroke();
      // Direction arrow
      const rot2 = (sensor.rotation||0)*Math.PI/180;
      const arLen = 12;
      ctx.strokeStyle=col; ctx.lineWidth=2;
      ctx.beginPath();
      ctx.moveTo(sc.x,sc.y);
      ctx.lineTo(sc.x+Math.cos(rot2-Math.PI/2)*arLen, sc.y+Math.sin(rot2-Math.PI/2)*arLen);
      ctx.stroke();
      // Name label
      ctx.fillStyle="rgba(0,0,0,0.6)";
      ctx.fillRect(sc.x-22, sc.y-22, 44, 11);
      ctx.fillStyle=col; ctx.font="bold 8px monospace";
      ctx.textAlign="center"; ctx.textBaseline="middle";
      ctx.fillText(sensor.name||"mmWave", sc.x, sc.y-16.5);

      // ── 3. Place-mode crosshair ────────────────────────────────────────────
      if (this._mmwavePlacing != null) {
        ctx.strokeStyle="#f59e0b"; ctx.lineWidth=1; ctx.setLineDash([3,3]);
        const p=this._f2c(sensor.mx,sensor.my);
        ctx.beginPath(); ctx.arc(p.x,p.y,14,0,Math.PI*2); ctx.stroke();
        ctx.setLineDash([]);
      }

      // ── 4. Targets ────────────────────────────────────────────────────────
      for (let ti=1; ti<=3; ti++) {
        const target = this._getMmwaveTarget(sensor, ti);
        if (!target || !target.present) continue;
        const tc = this._f2c(target.floor_mx, target.floor_my);
        const tName = (sensor.target_names||[])[ti-1] || ("P"+ti);
        const tCol  = ["#ff6b35","#00e5ff","#22c55e"][ti-1] || "#fff";
        // Feed frame to classifier + posture + fall detector
        this._mmwaveLearnFrame(sensor, target);
        if (this._mmwaveTrain) this._mmwaveTrainingTick(sensor, target);
        const clsResult = this._mmwaveClassify(sensor, target);
        const clsInfo   = this._mmwaveClasses()[clsResult.cls];
        const posture   = this._mmwaveDetectPosture(sensor, target);
        target._posture = posture; // Figur-Zeichner kann darauf zugreifen
        this._mmwaveFallTick(sensor, target, posture);
        const fallState = (this._mmwaveFallState||{})[sensor.id+"_"+target.id];
        const isFallAlarm = fallState?.phase === "alarm";

        // ── Presence heatmap blob ──────────────────────────────────────────
        const heatRad = 28;
        const hGrd = ctx.createRadialGradient(tc.x,tc.y,0,tc.x,tc.y,heatRad);
        hGrd.addColorStop(0, tCol+"55");
        hGrd.addColorStop(0.4, tCol+"25");
        hGrd.addColorStop(1, tCol+"00");
        ctx.beginPath(); ctx.arc(tc.x,tc.y,heatRad,0,Math.PI*2);
        ctx.fillStyle=hGrd; ctx.fill();

        // ── Movement vector arrow ──────────────────────────────────────────
        if (target.moving && Math.abs(target.speed) > 0.05) {
          const d = this._data;
          const W = this._canvas.width;
          const fw = d?.floor_w||10;
          const zoom = this._zoom||1;
          const speedScale = Math.min(Math.abs(target.speed)*0.8, 2.5);
          const vLen = speedScale * (W/fw) * zoom * 0.18;
          const vAngle = (target.angle||0)*Math.PI/180 + (sensor.rotation||0)*Math.PI/180 - Math.PI/2;
          const vx = tc.x + Math.cos(vAngle)*vLen;
          const vy = tc.y + Math.sin(vAngle)*vLen;
          // Arrow line
          ctx.strokeStyle=tCol; ctx.lineWidth=2;
          ctx.beginPath(); ctx.moveTo(tc.x,tc.y); ctx.lineTo(vx,vy); ctx.stroke();
          // Arrowhead
          const aSize=5, aBack=vAngle+Math.PI;
          ctx.fillStyle=tCol; ctx.beginPath();
          ctx.moveTo(vx,vy);
          ctx.lineTo(vx+Math.cos(aBack+0.4)*aSize, vy+Math.sin(aBack+0.4)*aSize);
          ctx.lineTo(vx+Math.cos(aBack-0.4)*aSize, vy+Math.sin(aBack-0.4)*aSize);
          ctx.closePath(); ctx.fill();
        }

        // ── Person figure (class-aware) ─────────────────────────────────────
        this._drawMmwaveEntityFigure(ctx, tc, tCol, target, clsResult, clsInfo, sensor);

        // ── Name + class label ───────────────────────────────────────────────
        const zoom2 = this._zoom || 1;
        const sc2 = Math.max(1.0, Math.min(2.0, zoom2 * 1.1));
        const displayName = (this._opts?.mmwaveClassify && clsResult.cls!=="unknown")
          ? (clsInfo?.icon||"") + " " + tName
          : tName;
        // figR: adaptive to class and scale
        const figRBase = clsResult.cls==="pet"||clsResult.cls==="baby" ? 7 :
                         clsResult.cls==="child" ? 7 : 9;
        const figR = (figRBase + (target.moving?1:0)) * sc2;
        const bodyBottom = figR + (clsResult.cls==="adult"||clsResult.cls==="child" ? (14+11)*sc2 : 0);

        // Name pill (oben)
        const nameFontSz = Math.round(9 * sc2);
        ctx.font = `bold ${nameFontSz}px 'JetBrains Mono',monospace`;
        const nw = Math.max(36, ctx.measureText(displayName).width + 12);
        const nh = nameFontSz + 5;
        const ny = tc.y - figR - nh - 4;
        ctx.fillStyle = "rgba(0,0,0,0.75)";
        ctx.beginPath(); ctx.roundRect(tc.x-nw/2, ny, nw, nh, 4); ctx.fill();
        ctx.strokeStyle = (clsInfo?.color||tCol) + "88";
        ctx.lineWidth = 1; ctx.stroke();
        ctx.fillStyle = clsInfo?.color||tCol;
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(displayName, tc.x, ny + nh/2);

        // ── Raum-Zuordnung unter der Figur ───────────────────────────────
        const targetRoom = this._getRoomForPoint(target.floor_mx, target.floor_my);
        const roomName = targetRoom?.name || "";

        // ── Speed + Zone badge ────────────────────────────────────────────
        const zoneName = this._getMmwaveZoneForTarget(sensor, target);
        const speedStr = Math.abs(target.speed) > 0.05 ? `${target.speed.toFixed(1)}m/s` : "●";
        const postureStr = (this._opts?.mmwavePosture && posture !== "unknown")
          ? this._postureIcon(posture)+" " : "";
        const alarmStr = isFallAlarm ? "🆘 " : "";
        const badge = alarmStr + postureStr + (roomName ? roomName : (zoneName||"")) +
                      (speedStr !== "●" ? " · "+speedStr : "");
        const badgeFontSz = Math.round(8 * sc2);
        ctx.font = isFallAlarm ? `bold ${badgeFontSz}px monospace` : `${badgeFontSz}px monospace`;
        const bw2 = Math.max(40, ctx.measureText(badge).width + 10);
        const bh2 = badgeFontSz + 5;
        const by2 = tc.y + bodyBottom + 5;
        ctx.fillStyle = isFallAlarm ? "rgba(239,68,68,0.9)" : "rgba(0,0,0,0.7)";
        ctx.beginPath(); ctx.roundRect(tc.x-bw2/2, by2, bw2, bh2, 4); ctx.fill();
        if (roomName) {
          ctx.strokeStyle = (tCol) + "66"; ctx.lineWidth=1; ctx.stroke();
        }
        ctx.fillStyle = isFallAlarm ? "#fff" : (roomName ? tCol : "#94a3b8");
        ctx.textAlign="center"; ctx.textBaseline="middle";
        ctx.fillText(badge, tc.x, by2 + bh2/2);
      }

      // ── 5. Zone overlays ──────────────────────────────────────────────────
      this._drawMmwaveZones(sensor, col);
    });

    // Request next frame for animation
    if (this._opts?.showMmwave) requestAnimationFrame(() => this._draw());
    // Live-Sidebar aktualisieren (throttled via draw-cycle)
    if (this._mode === "view") this._updateMmwavePersonsSidebar();
  }

  _drawMmwaveZones(sensor, col) {
    if (!sensor.entity_prefix || !this._hass || !sensor.mx) return;
    const ctx = this._ctx;
    const px = sensor.entity_prefix;
    const d  = this._data;
    if (!d) return;
    const W = this._canvas.width, fw = d.floor_w||10;
    const zoom = this._zoom||1;
    const unitPx = (W/fw)*zoom;
    const rot = (sensor.rotation||0)*Math.PI/180;

    // Draw HA zones if any zone presence entities found
    for(let z=1; z<=3; z++) {
      const presEnt = this._hass.states[px+`_zone_${z}_presence`];
      const cntEnt  = this._hass.states[px+`_zone_${z}_all_target_count`];
      if (!presEnt) continue;
      const active = presEnt.state==="on"||presEnt.state==="True"||presEnt.state==="true";
      const cnt    = parseInt(cntEnt?.state)||0;
      // Zone positions are stored in sensor config if set; otherwise skip visual
      const zoneKey = `zone_${z}`;
      const zConf = sensor[zoneKey];
      if (!zConf) continue; // only draw if zone coordinates configured
      // Convert zone corners from sensor-mm to floor canvas
      const corners = [[zConf.x1,zConf.y1],[zConf.x2,zConf.y1],[zConf.x2,zConf.y2],[zConf.x1,zConf.y2]].map(([xmm,ymm])=>{
        const fx = (sensor.mx||0) + (xmm/1000)*Math.cos(rot) - (ymm/1000)*Math.sin(rot);
        const fy = (sensor.my||0) + (xmm/1000)*Math.sin(rot) + (ymm/1000)*Math.cos(rot);
        return this._f2c(fx,fy);
      });
      ctx.beginPath();
      ctx.moveTo(corners[0].x,corners[0].y);
      corners.slice(1).forEach(c=>ctx.lineTo(c.x,c.y));
      ctx.closePath();
      const zCol = ["#ff6b35","#00e5ff","#22c55e"][z-1];
      ctx.strokeStyle=zCol+(active?"cc":"44");
      ctx.lineWidth=1.5; ctx.setLineDash([4,3]); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle=zCol+(active?"18":"08"); ctx.fill();
      if (cnt > 0) {
        const cx=(corners[0].x+corners[2].x)/2, cy=(corners[0].y+corners[2].y)/2;
        ctx.fillStyle=zCol; ctx.font="bold 9px monospace"; ctx.textAlign="center";
        ctx.textBaseline="middle"; ctx.fillText(`Z${z}:${cnt}`, cx, cy);
      }
    }
  }

  _getMmwaveZoneForTarget(sensor, target) {
    const fx = target?.floor_mx, fy = target?.floor_my;
    if (fx == null || fy == null) return null;
    // Zonen sind in Räumen gespeichert (room.zones) mit relativen rx1/ry1/rx2/ry2
    const rooms = this._pendingRooms || this._data?.rooms || [];
    for (const room of rooms) {
      if (!room.zones?.length) continue;
      const rW = room.x2 - room.x1, rH = room.y2 - room.y1;
      if (rW <= 0 || rH <= 0) continue;
      for (const z of room.zones) {
        const zx1 = room.x1 + (z.rx1||0)*rW, zy1 = room.y1 + (z.ry1||0)*rH;
        const zx2 = room.x1 + (z.rx2||1)*rW, zy2 = room.y1 + (z.ry2||1)*rH;
        if (fx >= Math.min(zx1,zx2) && fx <= Math.max(zx1,zx2) &&
            fy >= Math.min(zy1,zy2) && fy <= Math.max(zy1,zy2)) {
          return z.name || "Zone";
        }
      }
    }
    return null;
  }



  // ══════════════════════════════════════════════════════════════════════════
  // MMWAVE KLASSIFIKATION – Personen / Kinder / Haustiere / Babys
  // Kombiniert: Einlern-Ritual + Automatisches Hintergrundlernen + Manuell
  // ══════════════════════════════════════════════════════════════════════════

  // ── Klassenmetadaten ────────────────────────────────────────────────────
  _mmwaveClasses() {
    return {
      adult:  { label:"Erwachsener", icon:"🧑",  color:"#00e5ff", priority:3 },
      child:  { label:"Kind",        icon:"🧒",  color:"#f59e0b", priority:2 },
      pet:    { label:"Haustier",    icon:"🐾",  color:"#10b981", priority:1 },
      baby:   { label:"Baby",        icon:"🍼",  color:"#f472b6", priority:0 },
      unknown:{ label:"Unbekannt",   icon:"❓",  color:"#94a3b8", priority:-1 },
    };
  }

  // ── Feature-Extraktion aus einem Target-Frame ────────────────────────────
  // Gibt einen Feature-Vektor zurück der für den Klassifikator verwendet wird
  _mmwaveExtractFeatures(sensor, target) {
    const mount = sensor.mount_type || "wall"; // wall | ceiling | floor
    const x_mm = target.x_mm;
    const y_mm = target.y_mm; // bei Wand = Entfernung; bei Decke = "Höhe"
    const speed = Math.abs(target.speed || 0);
    const angle = Math.abs(target.angle || 0);

    // Höhen-Proxy je nach Montage
    // Wand: y_mm = Abstand vom Sensor → niedrig = nahe am Boden = klein
    //       x_mm = seitlich, keine Höheninfo
    //       aber: bei 1.5m Wandhöhe: person_height ≈ sensor_h - y_mm*sin(elev)
    //       Vereinfacht: y_mm als Proxy – kurze y = flach am Boden (Tier/Baby)
    // Decke: y_mm = Distanz vom Sensor nach unten → größer = weiter weg vom Boden
    //        klein = direkt unter Sensor = hoch
    // Boden: entfernt (nur Wand/Decke)
    // Bei Wand-Montage: Neigungswinkel berücksichtigen
    // tilt_deg > 0 = Sensor nach unten geneigt → y_mm stärker zur Höhe beitragen
    const tiltRad = ((sensor.mount_tilt_deg || 0) * Math.PI / 180);
    const wallSinFactor = 0.4 + Math.sin(Math.max(0, tiltRad)) * 0.6; // 0.4…1.0
    const height_proxy = (mount === "ceiling")
      ? Math.max(0, (sensor.mount_height_m || 2.4) * 1000 - y_mm) // echte Höhe schätzen
      : Math.max(0, (sensor.mount_height_m || 1.5) * 1000 - y_mm * wallSinFactor); // Wand mit Neigung

    return {
      speed,           // m/s Betrag
      height_proxy,    // mm geschätzte Person-Höhe
      y_mm,            // Rohabstand
      x_mm: Math.abs(x_mm),
      angle,
      dist: Math.hypot(x_mm, y_mm), // Gesamtabstand
      ts: Date.now()
    };
  }

  // ── Feature-Statistiken aus Verlauf ─────────────────────────────────────
  _mmwaveComputeStats(frames) {
    if (!frames || frames.length < 3) return null;
    const speeds = frames.map(f=>f.speed);
    const heights = frames.map(f=>f.height_proxy).filter(h=>h>0);
    const n = speeds.length;
    const avgSpeed = speeds.reduce((a,b)=>a+b,0)/n;
    const maxSpeed = Math.max(...speeds);
    // Varianz der Geschwindigkeit (Chaosindikator)
    const varSpeed = speeds.reduce((a,b)=>a+(b-avgSpeed)**2,0)/n;
    const stdSpeed = Math.sqrt(varSpeed);
    const avgHeight = heights.length ? heights.reduce((a,b)=>a+b,0)/heights.length : 0;
    // Richtungswechsel (schnelle Änderungen = Tier/Kind)
    let dirChanges = 0;
    for(let i=1;i<frames.length;i++){
      const da = Math.abs((frames[i].angle||0)-(frames[i-1].angle||0));
      if(da > 20) dirChanges++;
    }
    const changerate = dirChanges / n;
    return { avgSpeed, maxSpeed, stdSpeed, avgHeight, changerate, n };
  }

  // ── Klassifikator ────────────────────────────────────────────────────────
  // Gibt { cls, confidence, scores } zurück
  _mmwaveClassify(sensor, target) {
    if (!this._opts?.mmwaveClassify) return { cls:"unknown", confidence:0, scores:{} };
    const key = sensor.id + "_" + target.id;
    const profile = (this._mmwaveProfiles||{})[key];

    // ── A) Eingelerntes Profil hat Vorrang ───────────────────────────────
    if (profile?.trained_cls && profile.trained_confidence >= 0.7) {
      return {
        cls: profile.trained_cls,
        confidence: profile.trained_confidence,
        scores: {},
        source: "trained"
      };
    }

    // ── B) Statistik-basierte Klassifikation ─────────────────────────────
    const stats = this._mmwaveComputeStats(profile?.frames);
    if (!stats || stats.n < 5) {
      // Nur aktueller Frame verfügbar → schwache Schätzung
      return this._mmwaveClassifySingleFrame(sensor, target);
    }

    const mount = sensor.mount_type || "wall";
    // Feature-Gewichte je nach Montage
    const heightWeight = (mount === "ceiling") ? 0.40 : (mount === "wall") ? 0.25 : 0.05;
    const speedWeight  = 0.30;
    const chaosWeight  = 0.30;

    // Scores: je höher desto wahrscheinlicher diese Klasse
    // Basis-Schwellwerte (empirisch, werden durch Einlernen verfeinert)
    const th = sensor.class_thresholds || {};
    const T = {
      adult_height:  th.adult_height  || 1400, // mm
      child_height:  th.child_height  || 900,
      baby_height:   th.baby_height   || 400,
      pet_height:    th.pet_height    || 350,
      adult_speed:   th.adult_speed   || 0.8,
      child_speed:   th.child_speed   || 1.2,
      pet_chaos:     th.pet_chaos     || 0.35,
      child_chaos:   th.child_chaos   || 0.25,
    };

    const h = stats.avgHeight;
    const spd = stats.avgSpeed;
    const chaos = stats.changerate + stats.stdSpeed * 0.5;

    // Score-Funktion: Gaußähnliche Kurve um Sollwert
    const score = (val, center, sigma) =>
      Math.exp(-0.5 * ((val-center)/sigma)**2);

    const scores = {
      adult: (
        heightWeight * score(h, T.adult_height,  300) +
        speedWeight  * score(spd, T.adult_speed, 0.5) +
        chaosWeight  * score(chaos, 0.05, 0.15)
      ),
      child: (
        heightWeight * score(h, T.child_height,  200) +
        speedWeight  * score(spd, T.child_speed, 0.6) +
        chaosWeight  * score(chaos, T.child_chaos, 0.15)
      ),
      pet: (
        heightWeight * score(h, T.pet_height, 200) +
        speedWeight  * score(spd, 0.4, 0.35) +
        chaosWeight  * score(chaos, T.pet_chaos, 0.2)
      ),
      baby: (
        heightWeight * score(h, T.baby_height, 150) +
        speedWeight  * score(spd, 0.1, 0.15) +
        chaosWeight  * score(chaos, 0.05, 0.1)
      ),
    };

    // Normieren
    const total = Object.values(scores).reduce((a,b)=>a+b,0)||1;
    Object.keys(scores).forEach(k => scores[k] = scores[k]/total);
    const cls = Object.entries(scores).sort((a,b)=>b[1]-a[1])[0];

    // Nur wenn Confidence > 45% ausgeben, sonst unknown
    if (cls[1] < 0.45) return { cls:"unknown", confidence: cls[1], scores, source:"stats" };
    return { cls: cls[0], confidence: cls[1], scores, source:"stats" };
  }

  // ── Einzel-Frame Klassifikation (Fallback, niedrige Confidence) ──────────
  _mmwaveClassifySingleFrame(sensor, target) {
    const mount = sensor.mount_type || "wall";
    const spd = Math.abs(target.speed||0);
    const y = target.y_mm || 0;
    const th = sensor.class_thresholds || {};

    // Sehr einfache Heuristik als Fallback
    if (mount !== "ceiling") {
      // Keine Höheninfo → nur Speed-basiert
      if (spd < 0.08) return { cls:"unknown", confidence:0.3, scores:{}, source:"frame" };
      if (spd > 1.5) return  { cls:"adult",   confidence:0.4, scores:{}, source:"frame" };
      return { cls:"unknown", confidence:0.2, scores:{}, source:"frame" };
    }
    // Deckenmontage: y_mm = Distanz → Höhe berechenbar
    const ht = Math.max(0, (sensor.mount_height_m||2.4)*1000 - y);
    if (ht < (th.pet_height||380))   return { cls:"pet",   confidence:0.5, scores:{}, source:"frame" };
    if (ht < (th.baby_height||500))  return { cls:"baby",  confidence:0.5, scores:{}, source:"frame" };
    if (ht < (th.child_height||950)) return { cls:"child", confidence:0.5, scores:{}, source:"frame" };
    return { cls:"adult", confidence:0.55, scores:{}, source:"frame" };
  }

  // ── Hintergrundlernen: neuen Frame zum Profil hinzufügen ─────────────────
  _mmwaveLearnFrame(sensor, target) {
    if (!this._opts?.mmwaveClassify) return;
    if (!this._mmwaveProfiles) this._mmwaveProfiles = {};
    const key = sensor.id + "_" + target.id;
    if (!this._mmwaveProfiles[key]) {
      this._mmwaveProfiles[key] = { frames:[], trained_cls:null, trained_confidence:0 };
    }
    const prof = this._mmwaveProfiles[key];
    const feat = this._mmwaveExtractFeatures(sensor, target);
    prof.frames.push(feat);
    // Rollierendes Fenster: max 600 Frames (~10 Min bei 1fps)
    if (prof.frames.length > 600) prof.frames.shift();
    // Auto-Konfidenz aktualisieren wenn genug Frames (≥30)
    if (prof.frames.length >= 30 && prof.frames.length % 15 === 0) {
      const result = this._mmwaveClassify(sensor, target);
      if (result.source === "stats" && result.confidence > 0.55
          && result.cls !== "unknown" && !prof.trained_cls) {
        // Auto-Promoted: erster stabiler Wert nach 30+ Frames
        prof.auto_cls = result.cls;
        prof.auto_confidence = result.confidence;
      }
    }
  }

  // ── Einlern-Ritual State Machine ─────────────────────────────────────────
  _mmwaveStartTraining(sensorId, targetId, targetClass) {
    this._mmwaveTrain = {
      sensorId, targetId, targetClass,
      startTs: Date.now(),
      durationMs: 30000,
      frames: [],
      phase: "collecting"  // collecting → analyzing → done
    };
    this._showToast(`🎯 Einlernen gestartet: Bitte ${this._mmwaveClasses()[targetClass]?.label} 30 Sek bewegen`);
    this._draw();
  }

  _mmwaveTrainingTick(sensor, target) {
    const tr = this._mmwaveTrain;
    if (!tr || tr.phase !== "collecting") return;
    if (tr.sensorId !== sensor.id || tr.targetId !== target.id) return;
    const feat = this._mmwaveExtractFeatures(sensor, target);
    tr.frames.push(feat);
    const elapsed = Date.now() - tr.startTs;
    if (elapsed >= tr.durationMs) {
      tr.phase = "analyzing";
      this._mmwaveFinishTraining(sensor);
    }
  }

  _mmwaveFinishTraining(sensor) {
    const tr = this._mmwaveTrain;
    if (!tr) return;
    const key = sensor.id + "_" + tr.targetId;
    if (!this._mmwaveProfiles) this._mmwaveProfiles = {};
    if (!this._mmwaveProfiles[key]) this._mmwaveProfiles[key] = { frames:[] };
    const prof = this._mmwaveProfiles[key];
    // Eingelinerte Frames als Basis
    prof.frames = [...tr.frames, ...prof.frames].slice(0,600);
    const stats = this._mmwaveComputeStats(tr.frames);
    // Speichere gemittelte Merkmal-Schwellwerte dieser Klasse ins Sensor-Profil
    const cls = tr.targetClass;
    if (stats) {
      if (!sensor.class_thresholds) sensor.class_thresholds = {};
      const T = sensor.class_thresholds;
      const alpha = 0.6; // Lernrate
      const prev = T[cls+"_height"] || stats.avgHeight;
      T[cls+"_height"] = Math.round(prev*(1-alpha) + stats.avgHeight*alpha);
      T[cls+"_speed"]  = parseFloat(((T[cls+"_speed"]||stats.avgSpeed)*(1-alpha) + stats.avgSpeed*alpha).toFixed(2));
    }
    prof.trained_cls = cls;
    prof.trained_confidence = Math.min(0.92, 0.65 + (tr.frames.length/600)*0.27);
    tr.phase = "done";
    const cInfo = this._mmwaveClasses()[cls];
    this._showToast(`✅ ${cInfo?.icon} ${cInfo?.label} eingelernt (${Math.round(prof.trained_confidence*100)}% Konfidenz)`);
    this._mmwaveTrain = null;
    this._rebuildSidebar();
  }

  // ── Profil zurücksetzen ──────────────────────────────────────────────────
  _mmwaveResetProfile(sensorId, targetId) {
    const key = sensorId + "_" + targetId;
    if (this._mmwaveProfiles) delete this._mmwaveProfiles[key];
    this._showToast("🗑 Profil zurückgesetzt");
    this._rebuildSidebar(); this._draw();
  }


  // ── Klassifikations-UI: Einlern-Panel im mmWave Sensor Editor ────────────
  _buildMmwaveClassifyPanel(body, sensor) {
    // Wurde in _buildMmwaveSensorEditor integriert – diese Methode ist leer
  }
  _drawMmwaveEntityFigure(ctx, tc, tCol, target, clsResult, clsInfo, sensor={}) {
    const col = (this._opts?.mmwaveClassify && clsResult?.cls !== "unknown")
      ? (clsInfo?.color || tCol) : tCol;
    const cls = clsResult?.cls || "unknown";
    const moving = target.moving;
    // Zoom-adaptive size: größer bei hohem Zoom
    const zoom = this._zoom || 1;
    const scale = Math.max(1.0, Math.min(2.0, zoom * 1.1));
    ctx.save();

    switch(cls) {
      case "adult": {
        // Haltungs-abhängige Figur: stehend / sitzend / liegend
        const posture = target?._posture || "standing";
        if (posture === "lying") {
          // Liegend: horizontaler Strich mit Kopf am Ende
          const r = 7 * scale;
          const bodyLen = 22 * scale;
          ctx.save();
          const aura = ctx.createRadialGradient(tc.x,tc.y,r,tc.x,tc.y,r*2.5);
          aura.addColorStop(0, col+"44"); aura.addColorStop(1, col+"00");
          ctx.fillStyle=aura; ctx.beginPath(); ctx.arc(tc.x,tc.y,r*2.5,0,Math.PI*2); ctx.fill();
          // Bett/Körper (horizontales Rechteck)
          ctx.fillStyle=col+"aa";
          ctx.beginPath(); ctx.roundRect(tc.x - bodyLen/2, tc.y - 4*scale, bodyLen, 8*scale, 3*scale); ctx.fill();
          ctx.strokeStyle=col; ctx.lineWidth=1.5; ctx.stroke();
          // Kopf (links)
          ctx.fillStyle=col; ctx.beginPath(); ctx.arc(tc.x - bodyLen/2 - r, tc.y, r, 0, Math.PI*2); ctx.fill();
          ctx.strokeStyle="rgba(255,255,255,0.8)"; ctx.lineWidth=1.5*scale; ctx.stroke();
          // Zzz Symbol
          ctx.font=`bold ${9*scale}px monospace`; ctx.fillStyle=col+"cc";
          ctx.textAlign="center"; ctx.textBaseline="middle";
          ctx.fillText("💤", tc.x + bodyLen/2 + 6*scale, tc.y - 8*scale);
          ctx.restore();
          break;
        }
        if (posture === "sitting") {
          // Sitzend: gebeugter Torso, Oberkörper nach vorne
          const r = 8 * scale;
          const torsoH = 10 * scale, torsoW = 8 * scale;
          ctx.save();
          const aura = ctx.createRadialGradient(tc.x,tc.y,r,tc.x,tc.y,r*2.5);
          aura.addColorStop(0, col+"44"); aura.addColorStop(1, col+"00");
          ctx.fillStyle=aura; ctx.beginPath(); ctx.arc(tc.x,tc.y,r*2.5,0,Math.PI*2); ctx.fill();
          // Stuhl-Sitz (flache Linie)
          ctx.strokeStyle=col+"88"; ctx.lineWidth=3*scale;
          ctx.beginPath(); ctx.moveTo(tc.x-8*scale, tc.y+r+torsoH); ctx.lineTo(tc.x+8*scale, tc.y+r+torsoH); ctx.stroke();
          // Beine (L-förmig)
          ctx.strokeStyle=col; ctx.lineWidth=2.5*scale;
          ctx.beginPath();
          ctx.moveTo(tc.x-4*scale, tc.y+r+torsoH); ctx.lineTo(tc.x-4*scale, tc.y+r+torsoH+8*scale);
          ctx.moveTo(tc.x+4*scale, tc.y+r+torsoH); ctx.lineTo(tc.x+4*scale, tc.y+r+torsoH+8*scale);
          ctx.stroke();
          // Torso (leicht nach vorne geneigt)
          ctx.fillStyle=col+"bb";
          ctx.beginPath(); ctx.roundRect(tc.x-torsoW/2, tc.y+r, torsoW, torsoH, 3*scale); ctx.fill();
          ctx.strokeStyle=col; ctx.lineWidth=1.5; ctx.stroke();
          // Arme auf Knien
          ctx.strokeStyle=col; ctx.lineWidth=2*scale; ctx.beginPath();
          ctx.moveTo(tc.x-torsoW/2,tc.y+r+4*scale); ctx.lineTo(tc.x-torsoW/2-5*scale,tc.y+r+torsoH*0.8);
          ctx.moveTo(tc.x+torsoW/2,tc.y+r+4*scale); ctx.lineTo(tc.x+torsoW/2+5*scale,tc.y+r+torsoH*0.8);
          ctx.stroke();
          // Kopf
          ctx.fillStyle=col; ctx.beginPath(); ctx.arc(tc.x,tc.y,r,0,Math.PI*2); ctx.fill();
          ctx.strokeStyle="rgba(255,255,255,0.8)"; ctx.lineWidth=2*scale; ctx.stroke();
          ctx.fillStyle="rgba(0,0,0,0.7)";
          ctx.beginPath(); ctx.arc(tc.x-r*0.3,tc.y-r*0.1,1.5*scale,0,Math.PI*2); ctx.fill();
          ctx.beginPath(); ctx.arc(tc.x+r*0.3,tc.y-r*0.1,1.5*scale,0,Math.PI*2); ctx.fill();
          ctx.restore();
          break;
        }
        // Standard: stehend
        const r = (moving ? 9 : 8) * scale;
        const blen = 14 * scale, bw = 9 * scale, leg = 11 * scale;
        // Glow aura
        const aura = ctx.createRadialGradient(tc.x,tc.y,r,tc.x,tc.y,r*2.8);
        aura.addColorStop(0, col+"44"); aura.addColorStop(1, col+"00");
        ctx.fillStyle=aura; ctx.beginPath(); ctx.arc(tc.x,tc.y,r*2.8,0,Math.PI*2); ctx.fill();
        // Shadow
        ctx.fillStyle="rgba(0,0,0,0.5)";
        ctx.beginPath(); ctx.ellipse(tc.x,tc.y+r+blen+2,bw*0.6,3*scale,0,0,Math.PI*2); ctx.fill();
        // Body (torso rectangle)
        ctx.fillStyle=col+"bb";
        ctx.beginPath(); ctx.roundRect(tc.x-bw/2, tc.y+r, bw, blen, 3*scale); ctx.fill();
        ctx.strokeStyle=col; ctx.lineWidth=1.5*scale; ctx.stroke();
        // Arms
        ctx.strokeStyle=col; ctx.lineWidth=2*scale;
        ctx.beginPath();
        if(moving) {
          ctx.moveTo(tc.x-bw/2,tc.y+r+2*scale); ctx.lineTo(tc.x-bw/2-7*scale,tc.y+r+blen*0.3);
          ctx.moveTo(tc.x+bw/2,tc.y+r+2*scale); ctx.lineTo(tc.x+bw/2+7*scale,tc.y+r+blen*0.7);
        } else {
          ctx.moveTo(tc.x-bw/2,tc.y+r+3*scale); ctx.lineTo(tc.x-bw/2-6*scale,tc.y+r+blen*0.5);
          ctx.moveTo(tc.x+bw/2,tc.y+r+3*scale); ctx.lineTo(tc.x+bw/2+6*scale,tc.y+r+blen*0.5);
        }
        ctx.stroke();
        // Legs
        ctx.beginPath();
        ctx.moveTo(tc.x-3*scale,tc.y+r+blen); ctx.lineTo(tc.x-4*scale,tc.y+r+blen+leg);
        ctx.moveTo(tc.x+3*scale,tc.y+r+blen); ctx.lineTo(tc.x+4*scale,tc.y+r+blen+leg);
        ctx.stroke();
        // Head
        ctx.fillStyle=col; ctx.beginPath(); ctx.arc(tc.x,tc.y,r,0,Math.PI*2); ctx.fill();
        ctx.strokeStyle="rgba(255,255,255,0.8)"; ctx.lineWidth=2*scale; ctx.stroke();
        // Face dots (eyes)
        ctx.fillStyle="rgba(0,0,0,0.7)";
        ctx.beginPath(); ctx.arc(tc.x-r*0.3,tc.y-r*0.1,1.5*scale,0,Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(tc.x+r*0.3,tc.y-r*0.1,1.5*scale,0,Math.PI*2); ctx.fill();
        break;
      }
      case "child": {
        const r = 7 * scale;
        const blen = 10 * scale, bw = 7 * scale, leg = 8 * scale;
        // Glow
        const aura = ctx.createRadialGradient(tc.x,tc.y,r,tc.x,tc.y,r*2.5);
        aura.addColorStop(0, col+"44"); aura.addColorStop(1, col+"00");
        ctx.fillStyle=aura; ctx.beginPath(); ctx.arc(tc.x,tc.y,r*2.5,0,Math.PI*2); ctx.fill();
        // Shadow
        ctx.fillStyle="rgba(0,0,0,0.4)";
        ctx.beginPath(); ctx.ellipse(tc.x,tc.y+r+blen+1,bw*0.5,2.5*scale,0,0,Math.PI*2); ctx.fill();
        // Body
        ctx.fillStyle=col+"bb";
        ctx.beginPath(); ctx.roundRect(tc.x-bw/2, tc.y+r, bw, blen, 3*scale); ctx.fill();
        ctx.strokeStyle=col; ctx.lineWidth=1.5*scale; ctx.stroke();
        // Arms up if moving
        ctx.strokeStyle=col; ctx.lineWidth=2*scale; ctx.beginPath();
        if(moving) {
          ctx.moveTo(tc.x-bw/2,tc.y+r); ctx.lineTo(tc.x-bw/2-6*scale,tc.y+r-4*scale);
          ctx.moveTo(tc.x+bw/2,tc.y+r); ctx.lineTo(tc.x+bw/2+6*scale,tc.y+r-4*scale);
        } else {
          ctx.moveTo(tc.x-bw/2,tc.y+r+3*scale); ctx.lineTo(tc.x-bw/2-5*scale,tc.y+r+blen*0.5);
          ctx.moveTo(tc.x+bw/2,tc.y+r+3*scale); ctx.lineTo(tc.x+bw/2+5*scale,tc.y+r+blen*0.5);
        }
        ctx.stroke();
        // Legs
        ctx.beginPath();
        ctx.moveTo(tc.x-2*scale,tc.y+r+blen); ctx.lineTo(tc.x-3*scale,tc.y+r+blen+leg);
        ctx.moveTo(tc.x+2*scale,tc.y+r+blen); ctx.lineTo(tc.x+3*scale,tc.y+r+blen+leg);
        ctx.stroke();
        // Head (rounder, bigger)
        ctx.fillStyle=col; ctx.beginPath(); ctx.arc(tc.x,tc.y,r,0,Math.PI*2); ctx.fill();
        ctx.strokeStyle="rgba(255,255,255,0.8)"; ctx.lineWidth=2*scale; ctx.stroke();
        ctx.fillStyle="rgba(0,0,0,0.6)";
        ctx.beginPath(); ctx.arc(tc.x-r*0.3,tc.y-r*0.1,1.5*scale,0,Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(tc.x+r*0.3,tc.y-r*0.1,1.5*scale,0,Math.PI*2); ctx.fill();
        // ✨
        ctx.font=`${10*scale}px serif`; ctx.fillStyle=col+"cc";
        ctx.textAlign="center"; ctx.textBaseline="middle";
        ctx.fillText("✨",tc.x+r+3*scale,tc.y-r*0.8);
        break;
      }
      case "pet": {
        const r = 7 * scale;
        // Unterscheide Katze (spitze Ohren, gekrümmter Schwanz) vs Hund (runde Ohren, wedelnder Schwanz)
        const isCat = (sensor?.target_names||[])[target?.id-1]?.toLowerCase().includes("katze") ||
                      (sensor?.target_names||[])[target?.id-1]?.toLowerCase().includes("cat");
        const wagAngle = moving ? Math.sin(Date.now()/200)*0.6 : 0.2;

        ctx.save();
        const aura = ctx.createRadialGradient(tc.x,tc.y,r,tc.x,tc.y,r*2.5);
        aura.addColorStop(0, col+"33"); aura.addColorStop(1, col+"00");
        ctx.fillStyle=aura; ctx.beginPath(); ctx.arc(tc.x,tc.y,r*2.5,0,Math.PI*2); ctx.fill();

        // Körper (Ellipse)
        ctx.fillStyle=col;
        ctx.beginPath(); ctx.ellipse(tc.x,tc.y+2*scale,r+2,r*0.8,0,0,Math.PI*2); ctx.fill();
        ctx.strokeStyle="rgba(255,255,255,0.6)"; ctx.lineWidth=1; ctx.stroke();

        // Kopf
        const hx = tc.x + (r+2)*scale, hy = tc.y - 1*scale;
        ctx.fillStyle=col; ctx.beginPath(); ctx.arc(hx, hy, (r-1)*scale, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle="rgba(255,255,255,0.6)"; ctx.lineWidth=1; ctx.stroke();

        if (isCat) {
          // Katze: spitze Dreieck-Ohren
          ctx.fillStyle=col;
          ctx.beginPath();
          ctx.moveTo(hx-3*scale, hy-(r-1)*scale);
          ctx.lineTo(hx-6*scale, hy-(r+5)*scale);
          ctx.lineTo(hx-0.5*scale, hy-(r-1)*scale);
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(hx+1*scale, hy-(r-1)*scale);
          ctx.lineTo(hx+5*scale, hy-(r+5)*scale);
          ctx.lineTo(hx+5.5*scale, hy-(r-1)*scale);
          ctx.fill();
          // Schnurrhaar
          ctx.strokeStyle=col+"99"; ctx.lineWidth=0.8;
          [[-1,1],[-1,2],[1,1],[1,2]].forEach(([sx,sy])=>{
            ctx.beginPath(); ctx.moveTo(hx,hy+sy*scale); ctx.lineTo(hx+sx*7*scale, hy+sy*1.5*scale); ctx.stroke();
          });
          // Gebogener Schwanz nach oben
          ctx.strokeStyle=col; ctx.lineWidth=2.5*scale;
          ctx.beginPath();
          ctx.moveTo(tc.x-r*scale, tc.y+2*scale);
          ctx.bezierCurveTo(tc.x-(r+8)*scale, tc.y-4*scale, tc.x-(r+6)*scale, tc.y-12*scale, tc.x-(r+2)*scale, tc.y-14*scale);
          ctx.stroke();
          // Emoji hint
          ctx.font=`${9*scale}px serif`; ctx.fillStyle=col+"cc";
          ctx.textAlign="center"; ctx.textBaseline="middle";
          ctx.fillText("🐱", tc.x, tc.y+r*scale+8*scale);
        } else {
          // Hund: runde hängende Ohren
          ctx.fillStyle=col+"cc";
          ctx.beginPath(); ctx.ellipse(hx-5*scale, hy+2*scale, 3*scale, 5*scale, -0.3, 0, Math.PI*2); ctx.fill();
          ctx.beginPath(); ctx.ellipse(hx+5*scale, hy+2*scale, 3*scale, 5*scale, 0.3, 0, Math.PI*2); ctx.fill();
          // Wedelnder Schwanz
          ctx.strokeStyle=col; ctx.lineWidth=2.5*scale;
          ctx.beginPath();
          ctx.moveTo(tc.x-r*scale, tc.y+2*scale);
          ctx.quadraticCurveTo(tc.x-(r+5)*scale, tc.y-5+wagAngle*10*scale, tc.x-(r+4)*scale, tc.y-9+wagAngle*7*scale);
          ctx.stroke();
          // Pfoten
          ctx.fillStyle=col+"88";
          [[-3,6],[0,7],[3,6]].forEach(([dx,dy])=>{
            ctx.beginPath(); ctx.arc(tc.x+dx*scale, tc.y+dy*scale, 2, 0, Math.PI*2); ctx.fill();
          });
          ctx.font=`${9*scale}px serif`; ctx.fillStyle=col+"cc";
          ctx.textAlign="center"; ctx.textBaseline="middle";
          ctx.fillText("🐶", tc.x, tc.y+r*scale+8*scale);
        }
        ctx.restore();
        break;
      }
      case "baby": {
        const r = 4;
        // Chubby body (large ellipse)
        ctx.fillStyle=col;
        ctx.beginPath(); ctx.ellipse(tc.x,tc.y+3,r,r+2,0,0,Math.PI*2); ctx.fill();
        ctx.strokeStyle="white"; ctx.lineWidth=1.2; ctx.stroke();
        // Large round head
        ctx.fillStyle=col; ctx.beginPath(); ctx.arc(tc.x,tc.y-2,r,0,Math.PI*2); ctx.fill();
        ctx.strokeStyle="white"; ctx.lineWidth=1; ctx.stroke();
        // Little arms/legs
        ctx.strokeStyle=col; ctx.lineWidth=2;
        ctx.beginPath();
        ctx.moveTo(tc.x-r,tc.y+2); ctx.lineTo(tc.x-r-3,tc.y+4);
        ctx.moveTo(tc.x+r,tc.y+2); ctx.lineTo(tc.x+r+3,tc.y+4);
        ctx.moveTo(tc.x-2,tc.y+r+2); ctx.lineTo(tc.x-2,tc.y+r+6);
        ctx.moveTo(tc.x+2,tc.y+r+2); ctx.lineTo(tc.x+2,tc.y+r+6);
        ctx.stroke();
        // Baby bottle emoji hint
        ctx.font="8px serif"; ctx.fillStyle=col+"aa";
        ctx.textAlign="center"; ctx.textBaseline="middle";
        ctx.fillText("🍼",tc.x+9,tc.y-5);
        break;
      }
      default: { // unknown
        const r = (moving ? 12 : 11) * scale;
        // Glow
        const aura = ctx.createRadialGradient(tc.x,tc.y,r,tc.x,tc.y,r*2.2);
        aura.addColorStop(0, col+"33"); aura.addColorStop(1, col+"00");
        ctx.fillStyle=aura; ctx.beginPath(); ctx.arc(tc.x,tc.y,r*2.2,0,Math.PI*2); ctx.fill();
        // Pulsing dashed ring
        ctx.strokeStyle=col; ctx.lineWidth=2.5*scale; ctx.setLineDash([5*scale,4*scale]);
        ctx.beginPath(); ctx.arc(tc.x,tc.y,r,0,Math.PI*2); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle=col+"33"; ctx.beginPath(); ctx.arc(tc.x,tc.y,r,0,Math.PI*2); ctx.fill();
        // ? symbol large
        ctx.fillStyle=col; ctx.font=`bold ${12*scale}px monospace`;
        ctx.textAlign="center"; ctx.textBaseline="middle";
        ctx.fillText("?",tc.x,tc.y);
        break;
      }
    }

    // Confidence ring (only when classify active and confident)
    if(this._opts?.mmwaveClassify && clsResult?.cls!=="unknown" && clsResult?.confidence>0.5) {
      const conf = clsResult.confidence;
      const rRing = (cls==="pet"||cls==="baby") ? 10 : 14;
      ctx.strokeStyle = col + Math.floor(conf*160).toString(16).padStart(2,"0");
      ctx.lineWidth = 1;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(tc.x, tc.y, rRing, -Math.PI/2, -Math.PI/2 + conf*Math.PI*2);
      ctx.stroke();
    }
    ctx.restore();
  }


  // ══════════════════════════════════════════════════════════════════════════
  // HALTUNGS-ERKENNUNG + STURZERKENNUNG
  // ══════════════════════════════════════════════════════════════════════════

  // ── Haltungs-Erkennung ────────────────────────────────────────────────────
  // Gibt "standing" | "sitting" | "lying" | "unknown" zurück
  _mmwaveDetectPosture(sensor, target) {
    // ═══════════════════════════════════════════════════════════════════════
    // Haltungserkennung – LD2450 (Wandmontage)
    //
    // Das LD2450 liefert NUR 2D-Koordinaten (x=horizontal, y=Tiefe).
    // Es gibt KEINE Höheninformation aus dem Sensor selbst.
    //
    // Einzige zuverlässige Signale:
    //   1. speed > 0: Person bewegt sich → aufrecht
    //   2. direction: "Moving" vs "Stationary"
    //   3. Deckenmontage: y_mm = Abstand nach unten → direkte Höhe
    //   4. Wandmontage + Neigungswinkel: y entlang geneigter Achse → Höhe
    //   5. Externe HA-Entität (z.B. Körpergröße-Sensor) → override
    // ═══════════════════════════════════════════════════════════════════════
    const mount  = sensor.mount_type || "wall";
    const y_mm   = target.y_mm || 0;
    const x_mm   = target.x_mm || 0;
    const speed  = Math.abs(target.speed || 0);
    const dir    = (target.direction || "").toLowerCase();
    const mountH = (sensor.mount_height_m || (mount === "ceiling" ? 2.4 : 1.5)) * 1000;
    const th     = sensor.posture_thresholds || {};

    // ── Externes Override: HA-Entity liefert Haltung direkt ─────────────
    if (sensor.posture_entity && this._hass?.states?.[sensor.posture_entity]) {
      const ext = this._hass.states[sensor.posture_entity].state.toLowerCase();
      if (ext.includes("stand")) return "standing";
      if (ext.includes("sit"))   return "sitting";
      if (ext.includes("lie") || ext.includes("lay")) return "lying";
    }

    // ── Kalibrierungs-Profil nutzen wenn vorhanden ────────────────────────
    const profiles = sensor.posture_profiles;
    if (profiles && Object.keys(profiles).length > 0) {
      const allP = Object.values(profiles).filter(p => p.sensor_id === sensor.id);
      const curDist = Math.sqrt((x_mm||0)**2 + (y_mm||0)**2);
      const prof = allP.reduce((best, p) => {
        if (!p.dist_mm) return best;
        const diff = Math.abs(curDist - p.dist_mm) / p.dist_mm;
        return (!best || diff < best._diff) ? {...p, _diff:diff} : best;
      }, null);

      if (prof && prof._diff < 0.5) {
        // Y-Schwellwert-basiert (zuverlässigster Ansatz aus Kalibrierung)
        if (prof.threshold_y_stand_sit && prof.threshold_y_sit_lie) {
          if (y_mm < prof.threshold_y_stand_sit) return "standing";
          if (y_mm < prof.threshold_y_sit_lie)   return "sitting";
          return "lying";
        } else if (prof.threshold_y_stand_sit) {
          return y_mm < prof.threshold_y_stand_sit ? "standing" : "sitting";
        }
        // Euklidische Distanz zu gemessenen Schwerpunkten
        if (prof.standing_x != null && prof.sitting_x != null) {
          const dSt = Math.hypot(x_mm-prof.standing_x, y_mm-prof.standing_y);
          const dSi = Math.hypot(x_mm-prof.sitting_x,  y_mm-prof.sitting_y);
          const dLy = prof.lying_x != null ? Math.hypot(x_mm-prof.lying_x, y_mm-prof.lying_y) : Infinity;
          const m = Math.min(dSt, dSi, dLy);
          return m===dSt ? "standing" : m===dSi ? "sitting" : "lying";
        }
      }
    }

    // ── Speed / Direction: sicherstes Signal ────────────────────────────
    // Bewegend → definitiv aufrecht (niemand kriecht mit 0.4 m/s)
    if (speed > 0.4)                     return "standing";
    if (dir === "moving" && speed > 0.1) return "standing";

    // ── Deckenmontage: y_mm = Abstand nach unten → direkte Höheninfo ────
    if (mount === "ceiling") {
      const T = { stand_min: th.stand_min ?? 1500, sit_min: th.sit_min ?? 900 };
      const personHeight_mm = Math.max(0, mountH - y_mm);
      if (personHeight_mm >= T.stand_min) return "standing";
      if (personHeight_mm >= T.sit_min)   return "sitting";
      return "lying";
    }

    // ── Wandmontage MIT Neigungswinkel (≥ 15°): Höhe berechenbar ────────
    const tiltDeg  = sensor.mount_tilt_deg || 0;
    const tiltRad  = Math.abs(tiltDeg) * Math.PI / 180;
    if (Math.abs(tiltDeg) >= 15) {
      const T = { stand_min: th.stand_min ?? 1500, sit_min: th.sit_min ?? 900 };
      const sinF = Math.sin(tiltRad);
      const personHeight_mm = Math.max(0, mountH - y_mm * sinF);
      if (personHeight_mm >= T.stand_min) return "standing";
      if (personHeight_mm >= T.sit_min)   return "sitting";
      if (speed < 0.08)                   return "lying";
      return "sitting";
    }

    // ── Wandmontage OHNE Neigung: kein Höhensignal ───────────────────────
    // Der LD2450 misst nur x/y in der Horizontalebene – keine Höhe.
    // Wir können stehend/sitzend NICHT physikalisch unterscheiden.
    //
    // Heuristik basierend auf:
    //   A) Leichte Mikrobewegung (Atemzug, Körperbalance beim Stehen)
    //      → speed beim Stehen oft 0.02–0.15, beim Sitzen oft 0
    //   B) Distanz: sehr nah (< 400mm) an Wand → eher sitzend/liegend
    //   C) Konfigurierbarer Schwellwert "wall_speed_stand" (default 0.0)
    //      → Nutzer kann kalibrieren was "Stehen" für seinen Sensor ist
    //
    // Standard-Fallback: "standing" wenn Präsenz erkannt
    // (konservativ – lieber falsch-positiv als immer "sitzend" anzeigen)
    const wallSpeedThresh = th.wall_speed_stand ?? 0.0; // kalibrierbar
    const dist_mm = Math.sqrt(x_mm*x_mm + y_mm*y_mm);

    // Sehr nahe an der Wand + still → sitzend oder liegend
    if (dist_mm < 400 && speed < 0.05) return "lying";
    if (dist_mm < 600 && speed < 0.03) return "sitting";

    // Speed über Schwellwert → stehend
    if (speed >= wallSpeedThresh && speed > 0.02) return "standing";

    // Still mit normaler Distanz → Standard ist STEHEND
    // (logischer Fallback: jemand der erkannt wird steht meistens)
    return "standing";
  }

  // ── Sturz-Erkennung State Machine ─────────────────────────────────────────
  // Zustand pro Sensor+Target: { phase, ts, prevPosture, alarmFired }
  _mmwaveFallTick(sensor, target, posture) {
    if (!this._opts?.mmwaveFallDetect) return;
    if (!this._mmwaveFallState) this._mmwaveFallState = {};
    const key = sensor.id + "_" + target.id;
    if (!this._mmwaveFallState[key]) {
      this._mmwaveFallState[key] = { phase:"normal", ts:0, prevPosture:"unknown", alarmFired:false };
    }
    const st    = this._mmwaveFallState[key];
    const now   = Date.now();
    const speed = Math.abs(target.speed || 0);
    const delayMs = (sensor.fall_alarm_delay ?? 30) * 1000;

    // ── Phase 1: Sturz-Signatur erkennen ─────────────────────────────────
    // Echte Sturz-Signatur braucht:
    //   (a) Vorher aufrecht (stehend/sitzend)
    //   (b) Jetzt liegend (nur wenn Sensor Höhe messen kann!)
    //   (c) Geschwindigkeit VORHER > 0.3 m/s (Bewegung/Aufprall)
    //       → normales langsames Hinlegen ins Bett wird ignoriert
    const wasUpright   = (st.prevPosture === "standing" || st.prevPosture === "sitting");
    const nowLying     = (posture === "lying");
    // Aufprall-Signal: vorherige Messung hatte Bewegung
    const hadMovement  = (st.prevSpeed || 0) > 0.3;

    // Sturz-Erkennung NUR wenn Sensor tatsächlich "lying" erkennen kann
    // (Deckenmontage ODER Wandmontage mit ausreichender Neigung ≥15°)
    const tiltDeg  = sensor.mount_tilt_deg || 0;
    const canDetectLying = (sensor.mount_type === "ceiling") || (Math.abs(tiltDeg) >= 15);

    if (st.phase === "normal") {
      if (canDetectLying && wasUpright && nowLying && hadMovement) {
        // Potentieller Sturz – Beobachtungsphase starten
        st.phase     = "suspected";
        st.ts        = now;
        st.alarmFired = false;
      }
      // KEIN stillSince mehr in Normal-Phase → verhindert Schlaf-Fehlalarm
    }

    // ── Phase 2: Verdacht – warten ob Person aufsteht ─────────────────────
    if (st.phase === "suspected") {
      if (speed > 0.25 || posture === "standing" || posture === "sitting") {
        // Person hat sich wieder bewegt → kein Sturz
        st.phase = "normal";
      } else if (now - st.ts >= delayMs && !st.alarmFired) {
        // Timeout – Person liegt noch reglos → ALARM
        st.phase      = "alarm";
        st.alarmFired = true;
        this._mmwaveTriggerFallAlarm(sensor, target, now - st.ts);
      }
    }

    // ── Phase 3: Alarm – bis Person sich wieder aufrichtet ───────────────
    if (st.phase === "alarm") {
      if (speed > 0.4 || posture === "standing") {
        st.phase = "normal"; st.alarmFired = false;
        this._showToast(`✅ ${(sensor.target_names||[])[target.id-1]||"Person"} wieder in Bewegung`);
      }
    }

    // Vorigen Zustand merken für nächsten Tick
    st.prevPosture = posture;
    st.prevSpeed   = speed;
  }

  // ── Alarm auslösen ────────────────────────────────────────────────────────
  _mmwaveTriggerFallAlarm(sensor, target, durationMs, isStill=false) {
    const tName = (sensor.target_names||[])[target.id-1] || `Person ${target.id}`;
    const sName = sensor.name || "mmWave";
    const dur   = Math.round(durationMs/1000);
    const msg   = isStill
      ? `⚠️ ${tName} liegt seit ${dur}s reglos (${sName})`
      : `🆘 STURZ: ${tName} ist gestürzt und liegt seit ${dur}s reglos! (${sName})`;

    // 1. Toast
    this._showToast(msg, 8000);

    // 2. HA-Event feuern
    if (this._hass) {
      this._hass.callService("homeassistant", "update_entity", {}).catch(()=>{});
      // Feuert ble_positioning_fall_detected Event
      try {
        this._hass.callApi("POST", "events/ble_positioning_fall_detected", {
          sensor_id:   sensor.id,
          sensor_name: sName,
          target_id:   target.id,
          target_name: tName,
          duration_s:  dur,
          floor_x:     target.floor_mx,
          floor_y:     target.floor_my,
          still_only:  isStill,
          timestamp:   new Date().toISOString()
        }).catch(()=>{});
      } catch(e) {}
    }

    // 3. Alarm-Sound (wenn aktiviert)
    if (this._opts?.mmwaveFallSound) {
      this._playFallAlarmSound();
    }

    // 4. Visueller Alarm-Zustand für Canvas
    if (!this._mmwaveFallAlarms) this._mmwaveFallAlarms = {};
    this._mmwaveFallAlarms[sensor.id+"_"+target.id] = {
      ts: Date.now(), tName, sName, floor_mx: target.floor_mx, floor_my: target.floor_my
    };
  }

  // ── Alarm-Sound ──────────────────────────────────────────────────────────
  _playFallAlarmSound() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      // Drei kurze Pieptöne – nicht zu aufdringlich
      [0, 0.35, 0.7].forEach(delay => {
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.frequency.value = 880;
        osc.type = "sine";
        gain.gain.setValueAtTime(0, ctx.currentTime + delay);
        gain.gain.linearRampToValueAtTime(0.4, ctx.currentTime + delay + 0.05);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + delay + 0.25);
        osc.start(ctx.currentTime + delay);
        osc.stop(ctx.currentTime + delay + 0.3);
      });
      // SOS-ähnliches Muster danach
      const osc2  = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.connect(gain2); gain2.connect(ctx.destination);
      osc2.frequency.value = 440;
      osc2.type = "square";
      gain2.gain.setValueAtTime(0, ctx.currentTime + 1.2);
      gain2.gain.linearRampToValueAtTime(0.25, ctx.currentTime + 1.25);
      gain2.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.8);
      osc2.start(ctx.currentTime + 1.2);
      osc2.stop(ctx.currentTime + 1.85);
      // Memory Leak Fix: AudioContext nach Wiedergabe schließen
      this._setTimeout(() => { try { ctx.close(); } catch(e) {} }, 2500);
    } catch(e) {}
  }

  // ── Haltungs-Icon ────────────────────────────────────────────────────────
  _postureIcon(posture) {
    return { standing:"🧍", sitting:"🪑", lying:"🛏", unknown:"" }[posture] || "";
  }
  _postureLabel(posture) {
    return { standing:"Stehend", sitting:"Sitzend", lying:"Liegend", unknown:"" }[posture] || "";
  }
  _postureColor(posture) {
    return { standing:"#22c55e", sitting:"#f59e0b", lying:"#94a3b8", unknown:"transparent" }[posture];
  }

  // ── Sturz-Overlay auf Canvas ──────────────────────────────────────────────
  _drawFallAlarmOverlay() {
    if (!this._mmwaveFallAlarms) return;
    const ctx = this._ctx;
    const now = Date.now();
    const pulse = 0.5 + 0.5 * Math.sin(now / 200); // schnelles Pulsieren

    Object.entries(this._mmwaveFallAlarms).forEach(([key, alarm]) => {
      const age = now - alarm.ts;
      if (age > 300000) { delete this._mmwaveFallAlarms[key]; return; } // 5 Min
      const fc = this._f2c(alarm.floor_mx, alarm.floor_my);

      // Großer roter Alarm-Ring
      ctx.strokeStyle = `rgba(239,68,68,${0.5 + 0.5*pulse})`;
      ctx.lineWidth   = 3;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(fc.x, fc.y, 22 + pulse*8, 0, Math.PI*2);
      ctx.stroke();

      // Füllung
      ctx.fillStyle = `rgba(239,68,68,${0.08 + 0.07*pulse})`;
      ctx.beginPath();
      ctx.arc(fc.x, fc.y, 30 + pulse*8, 0, Math.PI*2);
      ctx.fill();

      // SOS Label
      const t = Math.floor(age/1000);
      ctx.fillStyle = `rgba(239,68,68,${0.85+0.15*pulse})`;
      ctx.font = `bold ${10+pulse*2}px monospace`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("🆘 STURZ", fc.x, fc.y - 30);
      ctx.font = "bold 8px monospace";
      ctx.fillStyle = "white";
      ctx.fillText(`${alarm.tName} · ${t}s`, fc.x, fc.y + 28);
    });
  }


  // ── Haltungs-Schwellwert-Panel im Sensor Editor ───────────────────────────
  // ══════════════════════════════════════════════════════════════════════════
  // POSTURE CALIBRATION WIZARD
  // ══════════════════════════════════════════════════════════════════════════

  _buildMmwaveCalibPanel(body, sensor) {
    const panel = document.createElement("div");
    panel.style.cssText = "margin-top:6px;padding:8px;border-radius:8px;border:1px solid #00e5ff33;background:#00e5ff06";
    const hdr = document.createElement("div");
    hdr.style.cssText = "font-size:8px;font-weight:700;color:#00e5ff;margin-bottom:6px;display:flex;align-items:center;gap:5px";
    hdr.innerHTML = `<span>🎯 KALIBRIERUNG</span><span style="font-size:7px;color:#445566;font-weight:400"> Rauschen + Haltung kalibrieren</span>`;
    panel.appendChild(hdr);
    if (!sensor._calib_wizard) sensor._calib_wizard = { step:0, personIdx:0, measuredDist:null, collecting:false, samples:{standing:[],sitting:[],lying:[]}, countdown:0 };
    const wiz = sensor._calib_wizard;
    const content = document.createElement("div");
    panel.appendChild(content);
    const render = () => {
      content.innerHTML = "";
      if (wiz.step === 0)                  this._wizStep0(content, sensor, wiz, render);
      else if (wiz.step === 1)             this._wizStep1(content, sensor, wiz, render);
      else if (wiz.step === 2)             this._wizStep2(content, sensor, wiz, render);
      else if (wiz.step >= 3 && wiz.step <= 5) this._wizStepPose(content, sensor, wiz, render);
      else if (wiz.step === 6)             this._wizStepDone(content, sensor, wiz, render);
    };
    render();
    body.appendChild(panel);
  }

  _wizStep0(el, sensor, wiz, render) {
    const profiles = sensor.posture_profiles || {};
    const count = Object.keys(profiles).length;
    const info = document.createElement("div");
    info.style.cssText = "font-size:8px;color:#94a3b8;line-height:1.6;margin-bottom:8px";
    info.innerHTML = `Wizard misst für jede Person:<br>
      <b style="color:#00e5ff">1.</b> Distanz zum Sensor<br>
      <b style="color:#00e5ff">2.</b> 5s stehend &nbsp;<b style="color:#00e5ff">3.</b> 5s sitzend &nbsp;<b style="color:#00e5ff">4.</b> 5s liegend (optional)<br>
      ${count > 0 ? `<span style="color:#22c55e">✓ ${count} Profil(e) vorhanden</span>` : '<span style="color:#f59e0b">⚠ Noch keine Profile</span>'}`;
    el.appendChild(info);
    if (count > 0) {
      const list = document.createElement("div");
      list.style.cssText = "margin-bottom:8px";
      Object.entries(profiles).forEach(([name, p]) => {
        const row = document.createElement("div");
        row.style.cssText = "display:flex;align-items:center;gap:4px;margin-bottom:2px;font-size:7.5px;color:#94a3b8;padding:3px 6px;background:#0d1219;border-radius:4px";
        const del = document.createElement("button");
        del.style.cssText = "margin-left:auto;font-size:7px;padding:1px 5px;border-radius:3px;border:1px solid #ef444433;background:#ef444411;color:#ef4444;cursor:pointer;font-family:inherit";
        del.textContent = "✕";
        del.onclick = () => { delete profiles[name]; this._saveCalibProfiles(sensor); render(); };
        row.innerHTML = `<span style="color:#00e5ff">👤 ${name}</span><span>σx=${p.noise_x!=null?Math.round(p.noise_x)+"mm":"?"}</span><span>σy=${p.noise_y!=null?Math.round(p.noise_y)+"mm":"?"}</span><span>${p.standing_x!=null?"🧍":""}${p.sitting_x!=null?"🪑":""}${p.lying_x!=null?"🛌":""}</span>`;
        row.appendChild(del);
        list.appendChild(row);
      });
      el.appendChild(list);
    }
    const btn = document.createElement("button");
    btn.className = "btn btn-outline";
    btn.style.cssText = "width:100%;font-size:9px;padding:5px";
    btn.textContent = "🎯 Neue Kalibrierung starten";
    btn.onclick = () => { wiz.step=1; wiz.samples={standing:[],sitting:[],lying:[]}; wiz.customName=null; render(); };
    el.appendChild(btn);
  }

  _wizStep1(el, sensor, wiz, render) {
    const h = document.createElement("div");
    h.style.cssText = "font-size:9px;font-weight:700;color:#00e5ff;margin-bottom:6px;padding-bottom:4px;border-bottom:1px solid #00e5ff22";
    h.textContent = "👤 Schritt 1: Person wählen";
    el.appendChild(h);
    const names = sensor.target_names || ["Person 1","Person 2","Person 3"];
    names.forEach((name, i) => {
      const btn = document.createElement("button");
      btn.className = wiz.personIdx===i ? "btn" : "btn btn-outline";
      btn.style.cssText = `width:100%;margin-bottom:3px;font-size:9px;${wiz.personIdx===i?"background:#00e5ff22;border-color:#00e5ff":""}`;
      btn.textContent = (wiz.personIdx===i?"▶ ":"") + name + " (Target "+(i+1)+")";
      btn.onclick = () => { wiz.personIdx=i; render(); };
      el.appendChild(btn);
    });
    const nameRow = document.createElement("div");
    nameRow.style.cssText = "display:flex;gap:4px;margin-top:5px";
    const nameInp = document.createElement("input");
    nameInp.type="text"; nameInp.placeholder="Eigener Name (optional)";
    nameInp.value = wiz.customName||"";
    nameInp.style.cssText = "flex:1;font-size:8px;padding:3px 5px;border-radius:4px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-family:inherit";
    nameInp.oninput = () => { wiz.customName = nameInp.value.trim()||null; };
    nameRow.appendChild(nameInp);
    el.appendChild(nameRow);
    const nav = document.createElement("div");
    nav.style.cssText = "display:flex;gap:4px;margin-top:6px";
    const back = document.createElement("button");
    back.className="btn btn-outline"; back.style.cssText="flex:1;font-size:8px;padding:4px";
    back.textContent="← Zurück"; back.onclick=()=>{wiz.step=0;render();};
    const next = document.createElement("button");
    next.className="btn"; next.style.cssText="flex:2;font-size:9px;padding:4px";
    next.textContent="Weiter →"; next.onclick=()=>{wiz.step=2;render();};
    nav.append(back,next); el.appendChild(nav);
  }

  _wizStep2(el, sensor, wiz, render) {
    const h = document.createElement("div");
    h.style.cssText = "font-size:9px;font-weight:700;color:#00e5ff;margin-bottom:6px;padding-bottom:4px;border-bottom:1px solid #00e5ff22";
    h.textContent = "📏 Schritt 2: Distanz messen";
    el.appendChild(h);
    const t = this._getMmwaveTarget(sensor, wiz.personIdx+1);
    const dist = t?.present !== false && (t?.x_mm||t?.y_mm) ? Math.round(Math.sqrt((t.x_mm||0)**2+(t.y_mm||0)**2)) : null;
    if (dist) { wiz.measuredDist = dist; }
    const info = document.createElement("div");
    info.style.cssText = "font-size:8px;color:#94a3b8;margin-bottom:6px;line-height:1.5;padding:5px 8px;background:#0d1219;border-radius:5px";
    info.innerHTML = dist
      ? `Distanz: <b style="color:#00e5ff;font-size:12px">${dist}mm</b><br><span style="color:#445566">x=${t.x_mm}mm  y=${t.y_mm}mm  spd=${Math.round((t.speed||0)*1000)}mm/s</span>`
      : `<span style="color:#ef4444">⚠ Kein Target – steh vor dem Sensor!</span>`;
    el.appendChild(info);
    const manRow = document.createElement("div");
    manRow.style.cssText = "display:flex;align-items:center;gap:5px;font-size:8px;color:#445566;margin-bottom:5px";
    manRow.appendChild(Object.assign(document.createElement("span"),{textContent:"Manuell (mm):"}));
    const inp = document.createElement("input");
    inp.type="number"; inp.min=100; inp.max=8000; inp.step=50;
    inp.value=wiz.measuredDist||"";
    inp.style.cssText="width:65px;font-size:8px;padding:2px 4px;border-radius:3px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-family:inherit";
    inp.oninput=()=>{wiz.measuredDist=parseInt(inp.value)||null;};
    manRow.appendChild(inp); el.appendChild(manRow);
    if (!wiz._distTimer) wiz._distTimer = setInterval(render, 600);
    const nav = document.createElement("div");
    nav.style.cssText = "display:flex;gap:4px;margin-top:6px";
    const back = document.createElement("button");
    back.className="btn btn-outline"; back.style.cssText="flex:1;font-size:8px;padding:4px";
    back.textContent="← Zurück"; back.onclick=()=>{clearInterval(wiz._distTimer);wiz._distTimer=null;wiz.step=1;render();};
    const next = document.createElement("button");
    next.className="btn"; next.style.cssText="flex:2;font-size:9px;padding:4px";
    next.textContent="Weiter →";
    next.onclick=()=>{ if(!wiz.measuredDist){this._showToast("Erst Distanz messen!");return;} clearInterval(wiz._distTimer);wiz._distTimer=null;wiz.step=3;render(); };
    nav.append(back,next); el.appendChild(nav);
  }

  _wizStepPose(el, sensor, wiz, render) {
    const POSES = [
      {step:3,key:"standing",icon:"🧍",label:"STEHEND", desc:"Steh aufrecht vor dem Sensor – 5 Sek. stillhalten.",color:"#22c55e"},
      {step:4,key:"sitting", icon:"🪑",label:"SITZEND",  desc:"Sitz (Stuhl/Sofa) – 5 Sek. stillhalten.",            color:"#f59e0b"},
      {step:5,key:"lying",   icon:"🛌",label:"LIEGEND",  desc:"Leg dich hin – 5 Sek. Kann übersprungen werden.",    color:"#a78bfa"},
    ];
    const pose = POSES.find(p=>p.step===wiz.step);
    const h = document.createElement("div");
    h.style.cssText = `font-size:9px;font-weight:700;color:${pose.color};margin-bottom:5px;padding-bottom:4px;border-bottom:1px solid ${pose.color}33`;
    h.textContent = `${pose.icon} Schritt ${wiz.step}: ${pose.label}`;
    el.appendChild(h);
    const desc = document.createElement("div");
    desc.style.cssText = "font-size:8px;color:#94a3b8;margin-bottom:6px";
    desc.textContent = pose.desc;
    el.appendChild(desc);
    const t = this._getMmwaveTarget(sensor, wiz.personIdx+1);
    const live = document.createElement("div");
    live.style.cssText = `font-size:9px;color:${pose.color};margin-bottom:5px;padding:4px 8px;background:${pose.color}11;border-radius:4px;font-family:'JetBrains Mono',monospace`;
    live.textContent = t ? `x=${t.x_mm}mm  y=${t.y_mm}mm  spd=${Math.round((t.speed||0)*1000)}mm/s` : "Kein Signal";
    el.appendChild(live);
    const collected = (wiz.samples[pose.key]||[]).length;
    const sampEl = document.createElement("div");
    sampEl.style.cssText = "font-size:8px;color:#445566;margin-bottom:5px";
    sampEl.textContent = collected>0 ? `✓ ${collected} Messwerte (${(collected/10).toFixed(1)}s)` : "Noch keine Messwerte";
    el.appendChild(sampEl);
    if (wiz.collecting) {
      const prog = document.createElement("div");
      prog.style.cssText = "height:5px;border-radius:3px;background:#1c2535;overflow:hidden;margin-bottom:4px";
      const bar = document.createElement("div");
      bar.style.cssText = `height:100%;width:${Math.min(100,collected/50*100)}%;background:${pose.color};transition:width 0.1s`;
      prog.appendChild(bar); el.appendChild(prog);
      const cd = document.createElement("div");
      cd.style.cssText = `font-size:12px;font-weight:700;color:${pose.color};text-align:center;margin-bottom:5px`;
      cd.textContent = `⏱ ${Math.max(0,wiz.countdown).toFixed(1)}s`;
      el.appendChild(cd);
    }
    if (!wiz.collecting) {
      if (!wiz._liveTimer) wiz._liveTimer = setInterval(()=>{
        const tv=this._getMmwaveTarget(sensor,wiz.personIdx+1);
        if(tv) live.textContent=`x=${tv.x_mm}mm  y=${tv.y_mm}mm  spd=${Math.round((tv.speed||0)*1000)}mm/s`;
      },200);
      const recBtn = document.createElement("button");
      recBtn.className="btn";
      recBtn.style.cssText=`width:100%;font-size:10px;padding:6px;background:${pose.color}22;border-color:${pose.color};color:${pose.color};margin-bottom:4px;font-family:inherit`;
      recBtn.textContent = collected>0 ? "🔄 Neu aufzeichnen (5s)" : "⏺ Aufzeichnen (5s)";
      recBtn.onclick = () => {
        clearInterval(wiz._liveTimer); wiz._liveTimer=null;
        wiz.samples[pose.key]=[]; wiz.collecting=true; wiz.countdown=5; render();
        const start=Date.now();
        const rec=setInterval(()=>{
          const tv=this._getMmwaveTarget(sensor,wiz.personIdx+1);
          if(tv) wiz.samples[pose.key].push({x:tv.x_raw??tv.x_mm,y:tv.y_raw??tv.y_mm,speed:tv.speed||0});
          wiz.countdown=Math.max(0,5-(Date.now()-start)/1000);
          render();
        },100);
        setTimeout(()=>{ clearInterval(rec); wiz.collecting=false; wiz.countdown=0; render(); },5000);
      };
      el.appendChild(recBtn);
    }
    const nav = document.createElement("div");
    nav.style.cssText = "display:flex;gap:4px;margin-top:4px";
    const back=document.createElement("button"); back.className="btn btn-outline";
    back.style.cssText="flex:1;font-size:8px;padding:4px"; back.textContent="← Zurück";
    back.disabled=wiz.collecting;
    back.onclick=()=>{clearInterval(wiz._liveTimer);wiz._liveTimer=null;wiz.step--;render();};
    const skip=document.createElement("button"); skip.className="btn btn-outline";
    skip.style.cssText="flex:1;font-size:8px;padding:4px;color:#445566;border-color:#1c2535";
    skip.textContent="Überspringen"; skip.disabled=wiz.collecting;
    skip.onclick=()=>{clearInterval(wiz._liveTimer);wiz._liveTimer=null;wiz.step=wiz.step>=5?6:wiz.step+1;render();};
    const next=document.createElement("button"); next.className="btn";
    next.style.cssText=`flex:2;font-size:9px;padding:4px;background:${pose.color}22;border-color:${pose.color};color:${pose.color}`;
    next.textContent=collected>0?(wiz.step<5?"Weiter →":"✓ Fertig"):"Erst aufzeichnen!";
    next.disabled=wiz.collecting||collected===0;
    next.onclick=()=>{clearInterval(wiz._liveTimer);wiz._liveTimer=null;wiz.step=wiz.step>=5?6:wiz.step+1;render();};
    nav.append(back,skip,next); el.appendChild(nav);
  }

  _wizStepDone(el, sensor, wiz, render) {
    clearInterval(wiz._liveTimer); wiz._liveTimer=null;
    clearInterval(wiz._distTimer); wiz._distTimer=null;
    const h=document.createElement("div");
    h.style.cssText="font-size:9px;font-weight:700;color:#22c55e;margin-bottom:6px;padding-bottom:4px;border-bottom:1px solid #22c55e33";
    h.textContent="✅ Auswertung"; el.appendChild(h);
    const s=wiz.samples;
    const stat=arr=>{
      if(!arr||arr.length<3) return null;
      const xs=arr.map(a=>a.x),ys=arr.map(a=>a.y);
      const avg=a=>a.reduce((s,v)=>s+v,0)/a.length;
      const std=a=>{const m=avg(a);return Math.sqrt(a.reduce((s,v)=>s+(v-m)**2,0)/a.length);};
      return {ax:Math.round(avg(xs)),ay:Math.round(avg(ys)),sx:Math.round(std(xs)),sy:Math.round(std(ys)),n:arr.length};
    };
    const st=stat(s.standing), si=stat(s.sitting), ly=stat(s.lying);
    const name=wiz.customName||(sensor.target_names||[])[wiz.personIdx]||"Person "+(wiz.personIdx+1);
    const noiseR=st?Math.round(((st.sx**2+st.sy**2)/2)*15):200000;
    const res=document.createElement("div");
    res.style.cssText="font-size:8px;color:#94a3b8;line-height:1.8;margin-bottom:8px;padding:5px 8px;background:#0d1219;border-radius:5px";
    const r=(icon,lbl,d)=>d?`${icon} <b style="color:#c8d8ec">${lbl}</b>: (${d.ax},${d.ay})mm σ=(${d.sx},${d.sy})mm n=${d.n}<br>`
      :`${icon} <span style="color:#445566">${lbl}: nicht gemessen</span><br>`;
    res.innerHTML=`<b style="color:#00e5ff">👤 ${name}</b> – Distanz: ${wiz.measuredDist||"?"}mm<br>`
      +r("🧍","Stehend",st)+r("🪑","Sitzend",si)+r("🛌","Liegend",ly);
    el.appendChild(res);
    if(st){
      const ni=document.createElement("div");
      ni.style.cssText="font-size:7.5px;color:#00e5ff;margin-bottom:6px;padding:3px 7px;background:#00e5ff0a;border-radius:4px";
      ni.textContent=`📊 Kalman R_still=${noiseR} (σ=${st.sx}/${st.sy}mm) – ${noiseR<50000?"geringes":noiseR<200000?"mittleres":"hohes"} Rauschen`;
      el.appendChild(ni);
    }
    const save=document.createElement("button");
    save.className="btn"; save.style.cssText="width:100%;font-size:10px;padding:6px;background:#22c55e22;border-color:#22c55e;color:#22c55e;margin-bottom:4px;font-family:inherit";
    save.textContent=`💾 Profil "${name}" speichern`;
    save.onclick=()=>{
      if(!sensor.posture_profiles) sensor.posture_profiles={};
      sensor.posture_profiles[name]={
        name, dist_mm:wiz.measuredDist,
        noise_x:st?.sx, noise_y:st?.sy, kalman_R_still:noiseR,
        standing_x:st?.ax, standing_y:st?.ay,
        sitting_x:si?.ax,  sitting_y:si?.ay,
        lying_x:ly?.ax,    lying_y:ly?.ay,
        threshold_y_stand_sit:(st&&si)?Math.round((st.ay+si.ay)/2):null,
        threshold_y_sit_lie:(si&&ly)?Math.round((si.ay+ly.ay)/2):null,
        calibrated_at:new Date().toISOString(),
        sensor_id:sensor.id, target_idx:wiz.personIdx,
      };
      if(!sensor.kalman_profiles) sensor.kalman_profiles={};
      sensor.kalman_profiles[wiz.personIdx]={R_still:noiseR};
      this._saveCalibProfiles(sensor);
      this._showToast(`✅ Profil "${name}" gespeichert`);
      wiz.step=0; wiz.customName=null; render();
    };
    el.appendChild(save);
    const reset=document.createElement("button");
    reset.className="btn btn-outline"; reset.style.cssText="width:100%;font-size:8px;padding:3px;font-family:inherit";
    reset.textContent="← Neu starten";
    reset.onclick=()=>{wiz.step=0;wiz.samples={standing:[],sitting:[],lying:[]};wiz.customName=null;render();};
    el.appendChild(reset);
  }

  _saveCalibProfiles(sensor) {
    const sensors=this._pendingMmwave||this._data?.mmwave_sensors||[];
    const idx=sensors.findIndex(s=>s.id===sensor.id);
    if(idx<0) return;
    sensors[idx]=sensor;
    this._hass?.callApi("POST",`ble_positioning/${this._entryId}/mmwave_sensors`,{sensors})
      .catch(e=>this._showToast("Speichern fehlgeschlagen: "+e.message));
  }


  _buildMmwavePosturePanel(body, sensor) {
    if (!this._opts?.mmwaveFallDetect && !this._opts?.mmwavePosture) return;

    const panel = document.createElement("div");
    panel.style.cssText = "margin-top:6px;padding:6px 8px;border-radius:6px;border:1px solid #ef444433;background:#ef444408";

    // Header
    const hdr = document.createElement("div");
    hdr.style.cssText = "font-size:8px;font-weight:700;color:#ef4444;margin-bottom:5px";
    hdr.textContent = "🛡 STURZ & HALTUNG";
    panel.appendChild(hdr);

    // Fall alarm delay
    const delayRow = document.createElement("div");
    delayRow.style.cssText = "display:flex;align-items:center;gap:5px;margin-bottom:5px";
    const delayLbl = document.createElement("span");
    delayLbl.style.cssText = "font-size:8px;color:var(--muted);white-space:nowrap";
    delayLbl.textContent = "Alarm nach:";
    const delayInp = document.createElement("input");
    delayInp.type = "number"; delayInp.min = 5; delayInp.max = 300; delayInp.step = 5;
    delayInp.value = sensor.fall_alarm_delay ?? 30;
    delayInp.style.cssText = "width:50px;padding:2px 4px;border-radius:3px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-size:8px;text-align:center";
    delayInp.addEventListener("input", () => { sensor.fall_alarm_delay = parseInt(delayInp.value)||30; });
    const delayUnit = document.createElement("span");
    delayUnit.style.cssText = "font-size:8px;color:var(--muted)";
    delayUnit.textContent = "Sek Reglosigkeit";
    delayRow.append(delayLbl, delayInp, delayUnit);
    panel.appendChild(delayRow);

    // Sound toggle
    const soundRow = document.createElement("label");
    soundRow.style.cssText = "display:flex;align-items:center;gap:5px;font-size:8px;color:var(--muted);cursor:pointer;margin-bottom:5px";
    const soundCb = document.createElement("input"); soundCb.type="checkbox";
    soundCb.checked = this._opts?.mmwaveFallSound !== false;
    soundCb.addEventListener("change", () => { this._opts.mmwaveFallSound = soundCb.checked; });
    soundRow.append(soundCb, "🔔 Alarm-Sound bei Sturz");
    panel.appendChild(soundRow);

    // Test alarm button
    const testBtn = document.createElement("button");
    testBtn.style.cssText = "width:100%;padding:4px;border-radius:4px;border:1px solid #ef444433;background:#ef444411;color:#ef4444;font-size:8px;cursor:pointer;font-family:inherit;margin-bottom:5px";
    testBtn.textContent = "🔔 Alarm testen";
    testBtn.addEventListener("click", () => {
      if (this._opts?.mmwaveFallSound) this._playFallAlarmSound();
      this._showToast("🧪 Test: Sturz-Alarm würde jetzt feuern", 3000);
    });
    panel.appendChild(testBtn);

    // Posture thresholds (only when ceiling/wall)
    const mount = sensor.mount_type || "wall";
    if (mount !== "floor") {
      const thHdr = document.createElement("div");
      thHdr.style.cssText = "font-size:7.5px;color:var(--muted);margin-bottom:3px;margin-top:3px";
      thHdr.textContent = "Haltungs-Schwellwerte (Personenhöhe in mm):";
      panel.appendChild(thHdr);

      const T = sensor.posture_thresholds = sensor.posture_thresholds || {};
      // Live-Debug: zeige aktuelle Rohwerte + geschätzte Höhe
      const liveTarget = this._getMmwaveTarget(sensor, 1);
      if (liveTarget?.present) {
        const tiltDeg = sensor.mount_tilt_deg || 0;
        const tiltRad = Math.max(Math.abs(tiltDeg) * Math.PI / 180, 0.01);
        const mountH  = (sensor.mount_height_m || 1.5) * 1000;
        const estH    = Math.max(0, mountH - (liveTarget.y_mm||0) * Math.sin(tiltRad));
        const dbgDiv  = document.createElement("div");
        dbgDiv.style.cssText = "font-size:7px;color:#445566;background:#07090d;padding:3px 5px;border-radius:3px;margin-bottom:4px;line-height:1.7;font-family:monospace";
        dbgDiv.innerHTML = `y_mm: <b style="color:#c8d8ec">${Math.round(liveTarget.y_mm||0)}</b> &nbsp; speed: <b style="color:#c8d8ec">${(Math.abs(liveTarget.speed||0)).toFixed(2)} m/s</b><br>` +
          `geschätzte Höhe: <b style="color:#00e5ff">${Math.round(estH)} mm</b> &nbsp; Neigung: <b style="color:#c8d8ec">${tiltDeg}°</b>`;
        panel.appendChild(dbgDiv);
      }
      [
        ["Stehend ab:",  "stand_min", T.stand_min??1500, 800, 2200],
        ["Sitzend ab:",  "sit_min",   T.sit_min??900,    200, 1500],
      ].forEach(([lbl, key, val, min, max]) => {
        const row = document.createElement("div");
        row.style.cssText = "display:flex;align-items:center;gap:5px;margin-bottom:3px";
        const l = document.createElement("span");
        l.style.cssText = "font-size:7.5px;color:#445566;width:75px;white-space:nowrap";
        l.textContent = lbl;
        const inp = document.createElement("input");
        inp.type="number"; inp.min=min; inp.max=max; inp.step=50; inp.value=val;
        inp.style.cssText = "flex:1;padding:2px 4px;border-radius:3px;border:1px solid #1c2535;background:#07090d;color:#c8d8ec;font-size:8px;text-align:center";
        inp.addEventListener("input", () => { T[key] = parseInt(inp.value)||val; });
        row.append(l, inp);
        panel.appendChild(row);
      });
      const thHint = document.createElement("div");
      thHint.style.cssText = "font-size:7px;color:#445566;line-height:1.5;margin-top:2px";
      thHint.textContent = "Tipp: Neigung einstellen für bessere Höhenschätzung. Liegend = unter Sitzend-Schwelle + Stillstand.";
      panel.appendChild(thHint);
    }

    // Live posture status per target
    const statusHdr = document.createElement("div");
    statusHdr.style.cssText = "font-size:7.5px;color:var(--muted);margin-top:5px;margin-bottom:3px";
    statusHdr.textContent = "Live-Status:";
    panel.appendChild(statusHdr);

    const numT = sensor.targets || 3;
    for (let ti=1; ti<=numT; ti++) {
      const target = this._getMmwaveTarget(sensor, ti);
      if (!target?.present) continue;
      const posture  = this._mmwaveDetectPosture(sensor, target);
      const fallKey  = sensor.id+"_"+ti;
      const fallSt   = (this._mmwaveFallState||{})[fallKey];
      const isAlarm  = fallSt?.phase === "alarm";
      const isSusp   = fallSt?.phase === "suspected";
      const tName    = (sensor.target_names||[])[ti-1]||`Target ${ti}`;

      const row = document.createElement("div");
      row.style.cssText = `display:flex;align-items:center;gap:5px;padding:3px 5px;border-radius:4px;` +
        `background:${isAlarm?"#ef444422":isSusp?"#f59e0b11":"var(--surf3)"};` +
        `border:1px solid ${isAlarm?"#ef444455":isSusp?"#f59e0b44":"transparent"};margin-bottom:2px`;

      const icon = document.createElement("span"); icon.style.cssText="font-size:13px";
      icon.textContent = isAlarm ? "🆘" : isSusp ? "⚠️" : this._postureIcon(posture);
      const info = document.createElement("div"); info.style.cssText="flex:1;min-width:0";
      const nl = document.createElement("div");
      nl.style.cssText="font-size:8px;font-weight:700;color:var(--text)"; nl.textContent=tName;
      const sl = document.createElement("div");
      sl.style.cssText=`font-size:7px;color:${isAlarm?"#ef4444":isSusp?"#f59e0b":this._postureColor(posture)}`;
      sl.textContent = isAlarm ? "🆘 STURZ ERKANNT" :
                       isSusp  ? `⚠️ Reglos seit ${Math.round((Date.now()-(fallSt.ts||0))/1000)}s` :
                       this._postureLabel(posture);
      info.append(nl, sl);

      // Reset alarm button
      if (isAlarm || isSusp) {
        const resetBtn = document.createElement("button");
        resetBtn.style.cssText="padding:2px 6px;border-radius:3px;font-size:7.5px;border:1px solid #22c55e44;background:#22c55e11;color:#22c55e;cursor:pointer;font-family:inherit";
        resetBtn.textContent = "✓ OK";
        resetBtn.addEventListener("click", () => {
          if (this._mmwaveFallState?.[fallKey]) {
            this._mmwaveFallState[fallKey].phase = "normal";
            this._mmwaveFallState[fallKey].alarmFired = false;
            this._mmwaveFallState[fallKey].stillSince = null;
          }
          if (this._mmwaveFallAlarms?.[fallKey]) delete this._mmwaveFallAlarms[fallKey];
          this._rebuildSidebar(); this._draw();
        });
        row.append(icon, info, resetBtn);
      } else {
        row.append(icon, info);
      }
      panel.appendChild(row);
    }

    body.appendChild(panel);
  }



  // ══════════════════════════════════════════════════════════════════════════
  // BLOCK 1: MULTI-SENSOR FUSION + KALIBRIERUNG + PROFIL-EXPORT
  // ══════════════════════════════════════════════════════════════════════════

  // ── Multi-Sensor Fusion ───────────────────────────────────────────────────
  // Wenn zwei+ Sensoren denselben Bereich abdecken, trianguliere die Positionen
  // Gibt Map { fusedKey → { floor_mx, floor_my, confidence, sensorIds } } zurück
  _mmwaveFuseTargets() {
    if (!this._opts?.mmwaveFusion) return {};
    const sensors = this._pendingMmwave || [];
    if (sensors.length < 2) return {};
    const clusters = {};
    const MERGE_DIST = 1.5; // Meter: Targets innerhalb dieser Distanz fusionieren

    // Sammle alle aktiven Targets
    const allTargets = [];
    sensors.forEach(s => {
      for (let ti=1; ti<=3; ti++) {
        const t = this._getMmwaveTarget(s, ti);
        if (!t?.present) continue;
        allTargets.push({ sensor: s, target: t, ti });
      }
    });

    // Greedy-Clustering: nächste Paare zusammenfassen
    const merged = new Array(allTargets.length).fill(-1);
    let groupId = 0;
    for (let i=0; i<allTargets.length; i++) {
      if (merged[i] >= 0) continue;
      merged[i] = groupId;
      const a = allTargets[i];
      for (let k=i+1; k<allTargets.length; k++) {
        if (merged[k] >= 0) continue;
        const b = allTargets[k];
        if (b.sensor.id === a.sensor.id) continue; // selber Sensor – nicht fusionieren
        const dx = a.target.floor_mx - b.target.floor_mx;
        const dy = a.target.floor_my - b.target.floor_my;
        const dist = Math.hypot(dx, dy);
        if (dist < MERGE_DIST) { merged[k] = groupId; }
      }
      groupId++;
    }

    // Berechne gewichtetes Mittel pro Gruppe
    for (let g=0; g<groupId; g++) {
      const group = allTargets.filter((_, i) => merged[i]===g);
      if (group.length < 2) continue; // nur Gruppen mit 2+ Sensoren
      // Gewichtung: Confidence der Klassifikation wenn vorhanden
      let sumX=0, sumY=0, sumW=0;
      const sIds = [];
      group.forEach(({ sensor, target }) => {
        const cls = this._mmwaveClassify(sensor, target);
        const w = 0.5 + cls.confidence * 0.5;
        sumX += target.floor_mx * w;
        sumY += target.floor_my * w;
        sumW += w;
        sIds.push(sensor.id);
      });
      const key = "fused_" + g;
      clusters[key] = {
        floor_mx:   sumX / sumW,
        floor_my:   sumY / sumW,
        confidence: Math.min(0.99, group.length * 0.3 + 0.4),
        sensorIds:  sIds,
        count:      group.length,
        // Klassifikation aus dem sichersten Einzel-Sensor
        cls: group.map(({sensor,target}) => this._mmwaveClassify(sensor,target))
               .sort((a,b)=>b.confidence-a.confidence)[0]
      };
    }
    if (!this._mmwaveFused) this._mmwaveFused = {};
    this._mmwaveFused = clusters;
    return clusters;
  }

  // Fusions-Overlay auf Canvas zeichnen
  _drawMmwaveFusionOverlay(fusedTargets) {
    if (!this._opts?.mmwaveFusion || !Object.keys(fusedTargets).length) return;
    const ctx = this._ctx;
    Object.values(fusedTargets).forEach(ft => {
      const fc = this._f2c(ft.floor_mx, ft.floor_my);
      const clsInfo = this._mmwaveClasses()[ft.cls?.cls || "unknown"];
      // Fusions-Ring: weißer äußerer Ring = trianguliert
      ctx.strokeStyle = "rgba(255,255,255,0.7)";
      ctx.lineWidth   = 2;
      ctx.setLineDash([5,3]);
      ctx.beginPath(); ctx.arc(fc.x, fc.y, 18, 0, Math.PI*2); ctx.stroke();
      ctx.setLineDash([]);
      // Badge
      ctx.fillStyle = "rgba(255,255,255,0.15)";
      ctx.beginPath(); ctx.arc(fc.x, fc.y, 16, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = "white"; ctx.font = "bold 7px monospace";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(`⊕${ft.count}`, fc.x, fc.y);
      // Konfidenz-Label
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillRect(fc.x-22, fc.y+18, 44, 11);
      ctx.fillStyle = "#22c55e"; ctx.font = "7px monospace";
      ctx.fillText(`fusioniert · ${Math.round(ft.confidence*100)}%`, fc.x, fc.y+23.5);
    });
  }

  // ── Kalibrierungs-Assistent ───────────────────────────────────────────────
  _mmwaveStartCalibration(sensor) {
    this._mmwaveCalib = {
      sensorId: sensor.id,
      phase: "center",   // center → left → right → done
      measurements: [],
      startTs: Date.now()
    };
    this._showToast("📐 Kalibrierung: Stell dich in die MITTE des Raums und warte 5 Sek");
    this._rebuildSidebar();
  }

  _mmwaveCalibTick(sensor) {
    const cal = this._mmwaveCalib;
    if (!cal || cal.sensorId !== sensor.id) return;
    const now = Date.now();
    const elapsed = now - cal.startTs;

    // Sammle Messungen über 5 Sekunden
    if (elapsed < 5000) {
      for (let ti=1; ti<=3; ti++) {
        const t = this._getMmwaveTarget(sensor, ti);
        if (t?.present) {
          cal.measurements.push({ x: t.x_mm, y: t.y_mm, phase: cal.phase, ts: now });
        }
      }
    } else {
      this._mmwaveCalibNextPhase(sensor);
    }
  }

  _mmwaveCalibNextPhase(sensor) {
    const cal = this._mmwaveCalib;
    if (!cal) return;
    const phases = ["center","left","right"];
    const messages = {
      left:  "📐 Kalibrierung: Geh jetzt an die LINKE Wand des Raums (5 Sek)",
      right: "📐 Kalibrierung: Geh jetzt an die RECHTE Wand des Raums (5 Sek)",
      done:  "✅ Kalibrierung abgeschlossen!"
    };
    const idx = phases.indexOf(cal.phase);
    if (idx < phases.length-1) {
      cal.phase = phases[idx+1];
      cal.startTs = Date.now();
      this._showToast(messages[cal.phase]);
    } else {
      // Kalibrierung abschließen – Offset + Rotation berechnen
      this._mmwaveFinishCalibration(sensor);
    }
    this._rebuildSidebar();
  }

  _mmwaveFinishCalibration(sensor) {
    const cal = this._mmwaveCalib;
    if (!cal || cal.measurements.length < 10) {
      this._showToast("⚠️ Zu wenige Messungen – Kalibrierung fehlgeschlagen");
      this._mmwaveCalib = null;
      return;
    }
    // Mittelwerte der Messungen pro Phase
    const byPhase = {};
    cal.measurements.forEach(m => {
      if (!byPhase[m.phase]) byPhase[m.phase] = [];
      byPhase[m.phase].push({ x: m.x, y: m.y });
    });
    const avg = pts => ({
      x: pts.reduce((s,p)=>s+p.x,0)/pts.length,
      y: pts.reduce((s,p)=>s+p.y,0)/pts.length
    });
    const center = byPhase.center ? avg(byPhase.center) : null;
    if (center) {
      // Rotations-Korrektur: center sollte bei x≈0 sein
      const angleOffset = Math.atan2(center.x, center.y) * 180 / Math.PI;
      sensor.rotation = Math.round((sensor.rotation||0) - angleOffset);
      // Montagehöhen-Schätzung aus y-Distanz (Deckenmontage)
      if (sensor.mount_type === "ceiling") {
        sensor.mount_height_m = Math.round(center.y / 100) / 10;
      }
    }
    this._mmwaveCalib = null;
    this._showToast(`✅ Kalibrierung fertig! Rotation korrigiert auf ${sensor.rotation}°`);
    this._rebuildSidebar(); this._draw();
  }

  // ── Profil Export / Import ────────────────────────────────────────────────
  _mmwaveExportProfiles() {
    const data = {
      version: "1.0",
      exported: new Date().toISOString(),
      profiles: this._mmwaveProfiles || {},
      sensor_thresholds: (this._pendingMmwave||[]).map(s => ({
        id: s.id, name: s.name,
        class_thresholds:   s.class_thresholds,
        posture_thresholds: s.posture_thresholds,
        mount_type:         s.mount_type,
        mount_height_m:     s.mount_height_m,
        mount_tilt_deg:     s.mount_tilt_deg
      }))
    };
    // Frames weglassen – nur trainierte Profile
    const slim = structuredClone(data);
    Object.values(slim.profiles).forEach(p => { p.frames = []; });
    const blob = new Blob([JSON.stringify(slim, null, 2)], { type:"application/json" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = "mmwave_profiles.json"; a.click();
    URL.revokeObjectURL(url);
    this._showToast("📥 Profile exportiert");
  }

  _mmwaveImportProfiles(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (!data.profiles) throw new Error("Ungültiges Format");
        if (!this._mmwaveProfiles) this._mmwaveProfiles = {};
        Object.assign(this._mmwaveProfiles, data.profiles);
        // Sensor-Schwellwerte wiederherstellen
        (data.sensor_thresholds||[]).forEach(th => {
          const s = (this._pendingMmwave||[]).find(s=>s.id===th.id);
          if (s) {
            if (th.class_thresholds)   s.class_thresholds   = th.class_thresholds;
            if (th.posture_thresholds) s.posture_thresholds  = th.posture_thresholds;
            if (th.mount_type)         s.mount_type          = th.mount_type;
            if (th.mount_height_m)     s.mount_height_m      = th.mount_height_m;
            if (th.mount_tilt_deg != null) s.mount_tilt_deg  = th.mount_tilt_deg;
          }
        });
        this._showToast(`✅ ${Object.keys(data.profiles).length} Profile importiert`);
        this._rebuildSidebar(); this._draw();
      } catch(e) { this._showToast("❌ Import-Fehler: " + e.message); }
    };
    reader.readAsText(file);
  }


  // ══════════════════════════════════════════════════════════════════════════
  // BLOCK 2: ANALYTICS – Aktivitäts-Report, Schlaf, Energie-Korrelation
  // ══════════════════════════════════════════════════════════════════════════

  // ── Aktivitäts-Tracking initialisieren ───────────────────────────────────
  _analyticsInit() {
    if (!this._activityLog) {
      this._activityLog = {};       // { "roomName_personKey": [{ ts, duration, posture }] }
      this._activityDay  = {};      // { "YYYY-MM-DD": { rooms: {}, sleep: {} } }
      this._sleepState   = {};      // { personKey: { phase, startTs, duration } }
    }
  }

  // ── Aktivitäts-Frame aufzeichnen (wird in _draw aufgerufen) ───────────────
  _analyticsTick() {
    if (!this._opts?.showAnalytics) return;
    this._analyticsInit();
    const now = Date.now();
    if (this._lastAnalyticsTick && now - this._lastAnalyticsTick < 5000) return; // alle 5 Sek
    this._lastAnalyticsTick = now;
    const dateKey = new Date().toISOString().slice(0,10);
    if (!this._activityDay[dateKey]) this._activityDay[dateKey] = { rooms:{}, sleep:{}, energy:{} };
    const day = this._activityDay[dateKey];

    // Für jeden aktiven mmWave Target
    const sensors = this._pendingMmwave || [];
    sensors.forEach(sensor => {
      for (let ti=1; ti<=3; ti++) {
        const target = this._getMmwaveTarget(sensor, ti);
        if (!target?.present) continue;
        const tName   = (sensor.target_names||[])[ti-1] || `S${sensor.id.slice(-3)}_T${ti}`;
        const posture = this._mmwaveDetectPosture(sensor, target);
        const cls     = this._mmwaveClassify(sensor, target);
        const room    = this._getRoomForPoint(target.floor_mx, target.floor_my);
        const roomName = room?.name || "Unbekannt";

        // Raum-Aufenthalt akkumulieren
        if (!day.rooms[roomName]) day.rooms[roomName] = {};
        if (!day.rooms[roomName][tName]) day.rooms[roomName][tName] = 0;
        day.rooms[roomName][tName] += 5; // +5 Sek

        // Schlaf-Erkennung: liegend + still + Nacht (22–8 Uhr)
        const hour = new Date().getHours();
        const isNight = hour >= 22 || hour < 8;
        const isLying = posture === "lying";
        const isStill = Math.abs(target.speed||0) < 0.05;
        const sleepKey = tName;
        const sl = this._sleepState[sleepKey] = this._sleepState[sleepKey] || { phase:"awake", startTs:0 };
        if (this._opts?.showSleep && isNight && isLying && isStill) {
          if (sl.phase === "awake") { sl.phase = "sleeping"; sl.startTs = now; }
          const dur = Math.round((now - sl.startTs) / 1000);
          if (!day.sleep[sleepKey]) day.sleep[sleepKey] = { totalSec:0, startTs: sl.startTs };
          day.sleep[sleepKey].totalSec += 5;
          day.sleep[sleepKey].lastTs = now;
        } else if (sl.phase === "sleeping" && (!isLying || !isStill)) {
          sl.phase = "awake";
          if (day.sleep[sleepKey]) day.sleep[sleepKey].endTs = now;
        }
      }
    });

    // Energie-Korrelation: Räume mit Belegung vs. Energieverbrauch
    if (this._opts?.energyRoomCorr && this._data?.energy_lines?.length) {
      Object.keys(day.rooms).forEach(rName => {
        const totalOccupied = Object.values(day.rooms[rName]).reduce((a,b)=>a+b,0);
        if (!day.energy[rName]) day.energy[rName] = { occupiedSec:0, emptyHours:0 };
        day.energy[rName].occupiedSec = totalOccupied;
      });
    }

    // Nur letzte 7 Tage behalten
    const keys = Object.keys(this._activityDay).sort();
    while (keys.length > 7) { delete this._activityDay[keys.shift()]; keys.shift(); }
  }

  // ── Raum für einen Punkt finden ───────────────────────────────────────────
  _getRoomForPoint(mx, my) {
    const rooms = this._data?.rooms || this._pendingRooms || [];
    return rooms.find(r => {
      // Unterstütze beide Formate: x1/y1/x2/y2 und x/y/w/h
      const x1 = r.x1 ?? r.x ?? 0;
      const y1 = r.y1 ?? r.y ?? 0;
      const x2 = r.x2 ?? (x1 + (r.w || 4));
      const y2 = r.y2 ?? (y1 + (r.h || 3));
      return mx >= x1 && mx <= x2 && my >= y1 && my <= y2;
    }) || null;
  }

  // ── Aktivitäts-Report generieren ──────────────────────────────────────────
  _analyticsReport() {
    this._analyticsInit();
    const days = Object.entries(this._activityDay).sort((a,b)=>a[0].localeCompare(b[0]));
    if (!days.length) return { rooms:[], persons:[], sleep:[], energy:[], days:[] };

    // Räume nach Gesamtaufenthalt summieren
    const roomTotals = {};
    const personTotals = {};
    days.forEach(([date, day]) => {
      Object.entries(day.rooms||{}).forEach(([room, persons]) => {
        if (!roomTotals[room]) roomTotals[room] = 0;
        Object.entries(persons).forEach(([person, secs]) => {
          roomTotals[room] += secs;
          if (!personTotals[person]) personTotals[person] = {};
          if (!personTotals[person][room]) personTotals[person][room] = 0;
          personTotals[person][room] += secs;
        });
      });
    });

    // Schlaf-Zusammenfassung
    const sleepSummary = {};
    days.forEach(([date, day]) => {
      Object.entries(day.sleep||{}).forEach(([person, sl]) => {
        if (!sleepSummary[person]) sleepSummary[person] = [];
        sleepSummary[person].push({ date, totalSec: sl.totalSec });
      });
    });

    // Energie-Einsparpotenzial: unbesetzte Räume mit Aktivität in Energie-System
    const energyInsights = [];
    if (this._data?.energy_lines?.length) {
      Object.entries(roomTotals).forEach(([room, totalSec]) => {
        const totalH = totalSec / 3600;
        const dayCount = days.length;
        const avgH = totalH / dayCount;
        if (avgH < 2) {
          energyInsights.push({ room, avgH: avgH.toFixed(1), potential:"hoch" });
        }
      });
    }

    return {
      rooms:    Object.entries(roomTotals).map(([n,s])=>({ name:n, hours:(s/3600).toFixed(1) })).sort((a,b)=>b.hours-a.hours),
      persons:  personTotals,
      sleep:    sleepSummary,
      energy:   energyInsights,
      days:     days.length,
      dateRange: days.length ? `${days[0][0]} – ${days[days.length-1][0]}` : ""
    };
  }

  // ── Schlaf-Status auf Canvas ──────────────────────────────────────────────
  _drawSleepOverlay() {
    if (!this._opts?.showSleep) return;
    const ctx = this._ctx;
    Object.entries(this._sleepState||{}).forEach(([person, sl]) => {
      if (sl.phase !== "sleeping") return;
      // Finde die Position der schlafenden Person
      const sensors = this._pendingMmwave || [];
      sensors.forEach(sensor => {
        for (let ti=1; ti<=3; ti++) {
          const tName = (sensor.target_names||[])[ti-1] || `S${sensor.id.slice(-3)}_T${ti}`;
          if (tName !== person) continue;
          const target = this._getMmwaveTarget(sensor, ti);
          if (!target?.present) return;
          const tc = this._f2c(target.floor_mx, target.floor_my);
          const dur = Math.round((Date.now() - sl.startTs) / 60000);
          // Mond-Symbol + Schlafdauer
          ctx.font = "16px serif"; ctx.textAlign="center"; ctx.textBaseline="middle";
          ctx.fillText("🌙", tc.x+15, tc.y-20);
          ctx.fillStyle="rgba(0,0,0,0.6)";
          ctx.fillRect(tc.x-20, tc.y-33, 40, 11);
          ctx.fillStyle="#818cf8"; ctx.font="7px monospace";
          ctx.fillText(`${dur}min`, tc.x, tc.y-27.5);
        }
      });
    });
  }


  // ══════════════════════════════════════════════════════════════════════════
  // BLOCK 3: GRUNDRISS-VERGLEICHSMODUS + AR-EXPORT / QR-CODE
  // ══════════════════════════════════════════════════════════════════════════

  // ── Snapshot für Vergleich speichern ─────────────────────────────────────
  _compareSnapshotNow(label) {
    if (!this._compareSnapshots) this._compareSnapshots = [];
    const snap = {
      label: label || new Date().toLocaleTimeString("de-DE", {hour:"2-digit",minute:"2-digit"}),
      ts:    Date.now(),
      targets: [],
      rooms:  structuredClone(this._pendingRooms||this._data?.rooms||[])
    };
    // Alle aktiven Targets einfrieren
    (this._pendingMmwave||[]).forEach(sensor => {
      for (let ti=1; ti<=3; ti++) {
        const t = this._getMmwaveTarget(sensor, ti);
        if (!t?.present) continue;
        snap.targets.push({
          name:  (sensor.target_names||[])[ti-1]||`T${ti}`,
          color: ["#ff6b35","#00e5ff","#22c55e"][ti-1],
          floor_mx: t.floor_mx, floor_my: t.floor_my,
          posture:  this._mmwaveDetectPosture(sensor, t),
          cls:      this._mmwaveClassify(sensor, t)
        });
      }
    });
    this._compareSnapshots.unshift(snap);
    if (this._compareSnapshots.length > 10) this._compareSnapshots.pop();
    this._showToast(`📸 Snapshot "${snap.label}" gespeichert`);
    return snap;
  }

  // ── Vergleichs-Canvas zeichnen ────────────────────────────────────────────
  _drawCompareMode() {
    const snaps = this._compareSnapshots;
    if (!snaps || snaps.length < 2 || !this._compareActive) return;
    const ctx  = this._ctx;
    const c    = this._canvas;
    const W    = c.width, H = c.height;
    const half = W / 2;

    // Trennlinie
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.lineWidth   = 1.5;
    ctx.setLineDash([6,4]);
    ctx.beginPath(); ctx.moveTo(half,0); ctx.lineTo(half,H); ctx.stroke();
    ctx.setLineDash([]);

    // Header-Labels
    const labelY = 18;
    ["left","right"].forEach((side, si) => {
      const snapIdx = si === 0 ? (this._compareIdxA||0) : (this._compareIdxB||1);
      const snap    = snaps[snapIdx];
      if (!snap) return;
      const cx = si===0 ? half/2 : half + half/2;
      ctx.fillStyle = "rgba(0,0,0,0.7)";
      ctx.fillRect(cx-55, 4, 110, 16);
      ctx.fillStyle = "#f0f0f0"; ctx.font = "bold 8px monospace";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      const age = Math.round((Date.now()-snap.ts)/60000);
      ctx.fillText(`${snap.label}  (vor ${age}min)`, cx, labelY/2+4);
    });

    // Snapshot-Targets auf den jeweiligen Seiten zeichnen
    const drawSnapTargets = (snap, offsetX, clipLeft, clipRight) => {
      if (!snap) return;
      ctx.save();
      ctx.beginPath();
      ctx.rect(clipLeft, 0, clipRight-clipLeft, H);
      ctx.clip();
      snap.targets.forEach(t => {
        const d = this._data;
        if (!d) return;
        const fw = d.floor_w||10, fh = d.floor_h||10;
        const zoom = this._zoom||1;
        const cx = offsetX + ((t.floor_mx / fw) * (W*0.5) * zoom) + (this._panX||0);
        const cy = ((t.floor_my / fh) * H * zoom) + (this._panY||0);
        // Ghost-Figur
        ctx.fillStyle = t.color + "99";
        ctx.beginPath(); ctx.arc(cx, cy, 6, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = t.color; ctx.lineWidth=1; ctx.stroke();
        // Posture icon
        const pIcon = this._postureIcon(t.posture);
        if (pIcon) {
          ctx.font="10px serif"; ctx.textAlign="center"; ctx.textBaseline="middle";
          ctx.fillText(pIcon, cx, cy-14);
        }
        // Name
        ctx.fillStyle = "rgba(0,0,0,0.65)";
        ctx.fillRect(cx-16, cy+8, 32, 11);
        ctx.fillStyle = t.color; ctx.font="7px monospace";
        ctx.textAlign="center"; ctx.textBaseline="middle";
        ctx.fillText(t.name, cx, cy+13.5);
      });
      ctx.restore();
    };

    const snapA = snaps[this._compareIdxA||0];
    const snapB = snaps[this._compareIdxB||1];
    drawSnapTargets(snapA, 0,    0,    half);
    drawSnapTargets(snapB, half, half, W);
    ctx.restore();
  }

  // ── AR-Export: QR-Code für Live-Positionen ────────────────────────────────
  // Generiert einen QR-Code der auf eine HA-Seite mit Live-AR-Overlay zeigt
  _generateArQrCode() {
    // Erstelle eine temporäre standalone HTML-Seite die über HA API Live-Daten bezieht
    const entryId  = this._entryId;
    const haUrl    = window.location.origin;
    const arUrl    = `${haUrl}/local/ble_positioning_ar.html?entry=${entryId}`;

    // QR-Code via Google Charts API (kein externes npm nötig)
    const qrSize   = 200;
    const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${qrSize}x${qrSize}&data=${encodeURIComponent(arUrl)}`;

    // Panel erstellen
    const modal = document.createElement("div");
    modal.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);z-index:9999;display:flex;align-items:center;justify-content:center";

    const panel = document.createElement("div");
    panel.style.cssText = "background:var(--bg,#1e293b);border-radius:12px;padding:20px;max-width:320px;width:90%;text-align:center";

    const title = document.createElement("div");
    title.style.cssText = "font-size:14px;font-weight:700;color:var(--text,white);margin-bottom:8px";
    title.textContent = "📱 AR-Export";

    const desc = document.createElement("div");
    desc.style.cssText = "font-size:9px;color:#94a3b8;margin-bottom:12px;line-height:1.5";
    desc.textContent = "QR-Code mit Tablet/Smartphone scannen um Live-Positionen als AR-Overlay zu sehen.";

    const qrImg = document.createElement("img");
    qrImg.src = qrApiUrl;
    qrImg.style.cssText = "width:200px;height:200px;border-radius:8px;background:white;padding:8px;display:block;margin:0 auto 10px";

    const urlBox = document.createElement("div");
    urlBox.style.cssText = "font-size:7px;color:#64748b;word-break:break-all;padding:5px;background:var(--surf2,#0f172a);border-radius:4px;margin-bottom:10px";
    urlBox.textContent = arUrl;

    // AR-HTML generieren und zum Download anbieten
    const downloadBtn = document.createElement("button");
    downloadBtn.style.cssText = "padding:8px 16px;border-radius:6px;border:1px solid #3b82f6;background:#3b82f611;color:#3b82f6;font-size:9px;cursor:pointer;font-family:inherit;margin-right:6px";
    downloadBtn.textContent = "⬇ AR-HTML herunterladen";
    downloadBtn.addEventListener("click", () => this._downloadArHtml());

    const closeBtn = document.createElement("button");
    closeBtn.style.cssText = "padding:8px 16px;border-radius:6px;border:1px solid var(--border,#334155);background:none;color:var(--text,white);font-size:9px;cursor:pointer;font-family:inherit";
    closeBtn.textContent = "✕ Schließen";
    closeBtn.addEventListener("click", () => document.body.removeChild(modal));

    panel.append(title, desc, qrImg, urlBox, downloadBtn, closeBtn);
    modal.appendChild(panel);
    modal.addEventListener("click", e => { if(e.target===modal) document.body.removeChild(modal); });
    document.body.appendChild(modal);
  }

  // ── AR-HTML Seite generieren ──────────────────────────────────────────────
  _downloadArHtml() {
    const entryId = this._entryId;
    const haUrl   = window.location.origin;
    const html = `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>BLE Positioning – AR Live View</title>
<style>
  body { margin:0; background:#000; color:#fff; font-family:monospace; }
  canvas { position:fixed;top:0;left:0;width:100%;height:100%;z-index:10;pointer-events:none; }
  video  { position:fixed;top:0;left:0;width:100%;height:100%;object-fit:cover; }
  #overlay { position:fixed;top:10px;left:10px;z-index:20;background:rgba(0,0,0,0.7);padding:8px 12px;border-radius:8px;font-size:11px; }
  #status  { position:fixed;bottom:10px;left:50%;transform:translateX(-50%);z-index:20;background:rgba(0,0,0,0.7);padding:6px 12px;border-radius:20px;font-size:10px;white-space:nowrap; }
</style>
</head>
<body>
<video id="cam" autoplay playsinline></video>
<canvas id="ar"></canvas>
<div id="overlay">📡 BLE Positioning AR<br><span id="count" style="color:#22c55e">Verbinde...</span></div>
<div id="status" id="st">Kamera wird gestartet...</div>
<script>
const HA_URL="${haUrl}", ENTRY="${entryId}";
const video=document.getElementById('cam'), canvas=document.getElementById('ar'), ctx=canvas.getContext('2d');
const overlay=document.getElementById('count'), status=document.getElementById('st');
let targets=[], floorW=10, floorH=10, lastFetch=0;

navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'},audio:false})
  .then(s=>{ video.srcObject=s; status.textContent='📸 Kamera aktiv'; })
  .catch(()=>{ status.textContent='⚠ Kamera nicht verfügbar'; });

async function fetchTargets() {
  try {
    const r = await fetch(HA_URL+'/api/ble_positioning/'+ENTRY+'/card_data', {
      headers: { Authorization: 'Bearer ' + (localStorage.getItem('hassTokens') ? JSON.parse(localStorage.getItem('hassTokens')).access_token : '') }
    });
    const d = await r.json();
    floorW = d.floor_w||10; floorH = d.floor_h||10;
    targets = [];
    overlay.textContent = (d.mmwave_sensors||[]).length + ' Sensoren aktiv';
  } catch(e) { status.textContent='⚠ HA Verbindung fehlgeschlagen'; }
}

function draw() {
  canvas.width=window.innerWidth; canvas.height=window.innerHeight;
  const W=canvas.width, H=canvas.height;
  targets.forEach((t,i) => {
    const cx = (t.floor_mx/floorW)*W, cy = (t.floor_my/floorH)*H;
    const colors=['#ff6b35','#00e5ff','#22c55e'];
    const col = colors[i%3];
    ctx.strokeStyle=col; ctx.lineWidth=2;
    ctx.beginPath(); ctx.arc(cx,cy,20,0,Math.PI*2); ctx.stroke();
    ctx.fillStyle=col+'44'; ctx.beginPath(); ctx.arc(cx,cy,20,0,Math.PI*2); ctx.fill();
    ctx.fillStyle=col; ctx.font='bold 12px monospace'; ctx.textAlign='center';
    ctx.fillText(t.name||('P'+(i+1)), cx, cy+35);
    // Pulsierender Ring
    const p = 0.5+0.5*Math.sin(Date.now()/500);
    ctx.strokeStyle=col+Math.floor(p*180).toString(16).padStart(2,'0');
    ctx.beginPath(); ctx.arc(cx,cy,20+p*10,0,Math.PI*2); ctx.stroke();
  });
  requestAnimationFrame(draw);
}

setInterval(fetchTargets, 3000);
fetchTargets();
draw();
<\/script>
</body>
</html>`;
    const blob = new Blob([html], { type:"text/html" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = "ble_positioning_ar.html"; a.click();
    URL.revokeObjectURL(url);
    this._showToast("📱 AR-HTML heruntergeladen – auf Webserver/HA /local ablegen");
  }


  // ══════════════════════════════════════════════════════════════════════════
  // BLOCK 4: HOCHWERTIG – Raum-Kalender, Notfall-Button, Personen-Wiedererkennung
  // ══════════════════════════════════════════════════════════════════════════

  // ── Raum-Kalender: Automations-Vorschläge generieren ─────────────────────
  _generateRoomSchedule() {
    this._analyticsInit();
    const days = Object.entries(this._activityDay);
    if (days.length < 2) return [];
    const suggestions = [];
    const DOW_LABEL = ["So","Mo","Di","Mi","Do","Fr","Sa"];

    // Wochentags-Muster erkennen
    const weekdayPatterns = {}; // { roomName: { hour: count } }
    days.forEach(([dateStr, day]) => {
      const dow = new Date(dateStr).getDay();
      const isWeekday = dow >= 1 && dow <= 5;
      if (!isWeekday) return;
      Object.entries(day.rooms||{}).forEach(([room, persons]) => {
        if (!weekdayPatterns[room]) weekdayPatterns[room] = {};
        const totalSec = Object.values(persons).reduce((a,b)=>a+b,0);
        if (totalSec > 60) { // mind. 1 Minute
          const h = new Date(dateStr).getHours(); // Tages-Bucket approximiert
          if (!weekdayPatterns[room][h]) weekdayPatterns[room][h] = 0;
          weekdayPatterns[room][h]++;
        }
      });
    });

    // Suggestions bauen
    Object.entries(weekdayPatterns).forEach(([room, hours]) => {
      const peakHour = Object.entries(hours).sort((a,b)=>b[1]-a[1])[0];
      if (peakHour && peakHour[1] >= 2) {
        suggestions.push({
          room,
          type:    "schedule",
          trigger: `Montag–Freitag ${peakHour[0]}:00 Uhr`,
          action:  `${room} – Licht + Heizung vorheizen`,
          confidence: Math.min(0.95, peakHour[1] / days.length)
        });
      }
    });

    // Leere Räume identifizieren
    const allRooms = (this._pendingRooms||this._data?.rooms||[]).map(r=>r.name);
    const usedRooms = Object.keys(weekdayPatterns);
    allRooms.filter(r=>!usedRooms.includes(r)).forEach(r => {
      suggestions.push({
        room: r, type:"unused",
        trigger: "Nie belegt in letzten " + days.length + " Tagen",
        action:  `${r} – Heizung auf Frostschutz stellen`,
        confidence: 0.9
      });
    });

    return suggestions;
  }

  // ── Notfall-Button ────────────────────────────────────────────────────────
  _renderEmergencyButton() {
    if (!this._opts?.showEmergencyBtn) return;
    // Existiert bereits?
    if (this._emergencyBtn?.isConnected) return;
    const btn = document.createElement("button");
    btn.id = "ble-emergency-btn";
    btn.style.cssText = [
      "position:absolute;top:6px;right:6px;z-index:200",
      "width:36px;height:36px;border-radius:50%",
      "background:#ef4444;border:2px solid #fca5a5",
      "color:white;font-size:16px;cursor:pointer",
      "box-shadow:0 0 12px #ef444488",
      "animation:ble-pulse-emergency 2s infinite"
    ].join(";");
    btn.title = "Notfall";
    btn.textContent = "🆘";
    btn.addEventListener("click", () => this._showEmergencyPanel());
    const style = document.createElement("style");
    style.textContent = `@keyframes ble-pulse-emergency { 0%,100%{box-shadow:0 0 8px #ef444488} 50%{box-shadow:0 0 20px #ef4444cc} }`;
    this.shadowRoot.appendChild(style);
    const canvasWrap = this.shadowRoot.querySelector(".canvas-wrap") || this.shadowRoot.querySelector("canvas")?.parentElement;
    if (canvasWrap) { canvasWrap.style.position="relative"; canvasWrap.appendChild(btn); }
    this._emergencyBtn = btn;
  }

  _showEmergencyPanel() {
    const modal = document.createElement("div");
    modal.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.85);z-index:9999;display:flex;align-items:center;justify-content:center";
    const panel = document.createElement("div");
    panel.style.cssText = "background:#1e293b;border-radius:12px;padding:20px;max-width:300px;width:90%;text-align:center;border:2px solid #ef4444";
    panel.innerHTML = `<div style="font-size:40px;margin-bottom:8px">🆘</div>
      <div style="font-size:16px;font-weight:700;color:#ef4444;margin-bottom:6px">NOTFALL</div>
      <div style="font-size:10px;color:#94a3b8;margin-bottom:14px">Wähle eine Aktion:</div>`;

    const btns = [
      ["⚕ Arzt benachrichtigen",  "ble_positioning_emergency", { type:"medical" }],
      ["🔥 Feuerwehr",            "ble_positioning_emergency", { type:"fire"    }],
      ["👮 Polizei",              "ble_positioning_emergency", { type:"police"  }],
      ["✅ Alles OK – Abbrechen", null, null],
    ];
    btns.forEach(([label, event, data]) => {
      const b = document.createElement("button");
      const isCancel = !event;
      b.style.cssText = `width:100%;padding:10px;margin-bottom:6px;border-radius:6px;font-size:10px;cursor:pointer;font-family:inherit;border:1px solid ${isCancel?"#22c55e44":"#ef444444"};background:${isCancel?"#22c55e11":"#ef444411"};color:${isCancel?"#22c55e":"#ef4444"}`;
      b.textContent = label;
      b.addEventListener("click", () => {
        if (event && this._hass) {
          this._hass.callApi("POST", `events/${event}`, {
            ...data, timestamp: new Date().toISOString(),
            location: this._getEmergencyLocation()
          }).catch(()=>{});
          this._showToast(`🆘 ${label} – HA-Event ausgelöst`);
        }
        document.body.removeChild(modal);
      });
      panel.appendChild(b);
    });
    modal.appendChild(panel);
    modal.addEventListener("click", e=>{ if(e.target===modal) document.body.removeChild(modal); });
    document.body.appendChild(modal);
  }

  _getEmergencyLocation() {
    // Letzte bekannte Position der Person(en)
    const sensors = this._pendingMmwave || [];
    const positions = [];
    sensors.forEach(s => {
      for (let ti=1;ti<=3;ti++) {
        const t = this._getMmwaveTarget(s,ti);
        if (t?.present) positions.push({ name:(s.target_names||[])[ti-1], mx:t.floor_mx, my:t.floor_my });
      }
    });
    return positions;
  }

  // ── Personen-Wiedererkennung über Tageszeit-Muster ─────────────────────
  _mmwavePersonIdentify(sensor, target) {
    if (!this._opts?.mmwavePersonID) return null;
    this._analyticsInit();
    const now = new Date();
    const hour = now.getHours();
    const dow  = now.getDay(); // 0=So
    const pos  = this._getMmwaveTarget(sensor, target.id);
    if (!pos) return null;
    const room = this._getRoomForPoint(pos.floor_mx, pos.floor_my);
    if (!room) return null;

    // Suche in Verlauf: Welche Person ist typischerweise zu dieser Zeit in diesem Raum?
    const days = Object.entries(this._activityDay);
    const roomScores = {}; // { personName: score }
    days.forEach(([dateStr, day]) => {
      const dayDow = new Date(dateStr).getDay();
      if (Math.abs(dayDow - dow) > 1 && dayDow !== dow) return; // ähnliche Wochentage
      const persons = day.rooms?.[room.name];
      if (!persons) return;
      Object.entries(persons).forEach(([person, secs]) => {
        if (secs < 30) return;
        if (!roomScores[person]) roomScores[person] = 0;
        roomScores[person] += secs;
      });
    });

    const best = Object.entries(roomScores).sort((a,b)=>b[1]-a[1])[0];
    if (!best || best[1] < 60) return null;
    const totalSecs = Object.values(roomScores).reduce((a,b)=>a+b,1);
    const confidence = Math.min(0.85, best[1]/totalSecs);
    return { name: best[0], confidence, room: room.name };
  }


  // ══════════════════════════════════════════════════════════════════════════
  // BLOCK 5: ANALYTICS-TAB + VERGLEICHS-UI + SIDEBAR-ERWEITERUNGEN
  // ══════════════════════════════════════════════════════════════════════════

  _sidebarAnalytics() {
    const wrap = document.createElement("div");
    wrap.style.cssText = "display:flex;flex-direction:column;gap:0;height:100%;overflow:hidden";
    const report = this._analyticsReport();

    // ── Header ───────────────────────────────────────────────────────────────
    const hdr = document.createElement("div");
    hdr.style.cssText = "padding:8px 10px 6px;border-bottom:1px solid var(--border);flex-shrink:0";
    hdr.innerHTML = `<div style="font-size:10px;font-weight:700;color:#94a3b8;letter-spacing:1px;margin-bottom:3px">📊 ANALYTICS</div>
      <div style="font-size:8px;color:var(--muted)">${report.days} Tag(e) · ${report.dateRange||"—"}</div>`;
    wrap.appendChild(hdr);

    const scroll = document.createElement("div");
    scroll.style.cssText = "flex:1;overflow-y:auto;padding:8px 10px";

    const section = (title, color="#94a3b8") => {
      const d=document.createElement("div"); d.style.cssText=`font-size:8px;font-weight:700;color:${color};margin:8px 0 4px;letter-spacing:0.5px`;
      d.textContent=title; return d;
    };

    // ── Raum-Aufenthalt ───────────────────────────────────────────────────
    scroll.appendChild(section("🏠 RAUM-AUFENTHALT (Ges.)"));
    if (report.rooms.length === 0) {
      const empty=document.createElement("div"); empty.style.cssText="font-size:8px;color:var(--muted);padding:4px";
      empty.textContent="Noch keine Daten – KI läuft im Hintergrund..."; scroll.appendChild(empty);
    }
    report.rooms.slice(0,8).forEach(r => {
      const row=document.createElement("div"); row.style.cssText="display:flex;align-items:center;gap:5px;margin-bottom:3px";
      const lbl=document.createElement("span"); lbl.style.cssText="font-size:8px;color:var(--text);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"; lbl.textContent=r.name;
      const val=document.createElement("span"); val.style.cssText="font-size:8px;color:#f59e0b;white-space:nowrap"; val.textContent=`${r.hours}h`;
      const bar=document.createElement("div"); bar.style.cssText="width:60px;height:4px;background:var(--surf3);border-radius:2px;overflow:hidden";
      const fill=document.createElement("div");
      const maxH = Math.max(...report.rooms.map(x=>parseFloat(x.hours)),0.1);
      fill.style.cssText=`height:100%;background:#f59e0b;border-radius:2px;width:${Math.round(parseFloat(r.hours)/maxH*100)}%`;
      bar.appendChild(fill); row.append(lbl,bar,val); scroll.appendChild(row);
    });

    // ── Schlaf ────────────────────────────────────────────────────────────
    if (this._opts?.showSleep && Object.keys(report.sleep).length) {
      scroll.appendChild(section("🌙 SCHLAF","#818cf8"));
      Object.entries(report.sleep).forEach(([person, nights]) => {
        const avgMin = nights.reduce((a,b)=>a+b.totalSec,0)/nights.length/60;
        const row=document.createElement("div"); row.style.cssText="display:flex;align-items:center;gap:5px;margin-bottom:3px";
        const lbl=document.createElement("span"); lbl.style.cssText="font-size:8px;color:var(--text);flex:1"; lbl.textContent=person;
        const val=document.createElement("span"); val.style.cssText="font-size:8px;color:#818cf8"; val.textContent=`⌀ ${Math.round(avgMin)}min/Nacht`;
        row.append(lbl,val); scroll.appendChild(row);
      });
    }

    // ── Energie-Einsparpotenzial ──────────────────────────────────────────
    if (report.energy.length) {
      scroll.appendChild(section("⚡ EINSPARPOTENZIAL","#22c55e"));
      report.energy.forEach(e => {
        const row=document.createElement("div"); row.style.cssText="padding:3px 5px;border-radius:4px;background:#22c55e0a;border:1px solid #22c55e22;margin-bottom:3px";
        const rl=document.createElement("div"); rl.style.cssText="font-size:8px;font-weight:700;color:#22c55e"; rl.textContent=e.room;
        const al=document.createElement("div"); al.style.cssText="font-size:7.5px;color:var(--muted)"; al.textContent=`Ø ${e.avgH}h/Tag belegt → Heizung optimierbar`;
        row.append(rl,al); scroll.appendChild(row);
      });
    }

    // ── Automations-Vorschläge ────────────────────────────────────────────
    const suggestions = this._generateRoomSchedule();
    if (suggestions.length) {
      scroll.appendChild(section("🤖 AUTOMATIONS-VORSCHLÄGE","#f59e0b"));
      suggestions.slice(0,5).forEach(s => {
        const card=document.createElement("div"); card.style.cssText="padding:4px 6px;border-radius:4px;background:var(--surf3);margin-bottom:3px;border-left:2px solid #f59e0b";
        card.innerHTML=`<div style="font-size:7.5px;font-weight:700;color:#f59e0b">${s.room}</div>
          <div style="font-size:7px;color:var(--muted)">${s.trigger}</div>
          <div style="font-size:7.5px;color:var(--text)">${s.action}</div>
          <div style="font-size:7px;color:#22c55e">${Math.round(s.confidence*100)}% Konfidenz</div>`;
        scroll.appendChild(card);
      });
    }

    // ── Snapshot für Vergleich ────────────────────────────────────────────
    scroll.appendChild(section("📸 SNAPSHOTS","#00e5ff"));
    const snapBtn=document.createElement("button");
    snapBtn.style.cssText="width:100%;padding:6px;border-radius:5px;border:1px solid #00e5ff44;background:#00e5ff0a;color:#00e5ff;font-size:8px;cursor:pointer;font-family:inherit;margin-bottom:5px";
    snapBtn.textContent="📸 Snapshot jetzt erstellen";
    snapBtn.addEventListener("click",()=>{ this._compareSnapshotNow(); this._rebuildSidebar(); });
    scroll.appendChild(snapBtn);

    const snaps = this._compareSnapshots || [];
    if (snaps.length >= 2) {
      // Vergleichs-Auswahl
      const compRow = document.createElement("div"); compRow.style.cssText="display:flex;gap:4px;margin-bottom:4px;align-items:center";
      const mkSel = (idx, isA) => {
        const sel=document.createElement("select"); sel.style.cssText="flex:1;padding:2px 3px;border-radius:3px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-size:7.5px";
        snaps.forEach((s,i)=>{ const o=document.createElement("option"); o.value=i; o.textContent=s.label; if(i===idx)o.selected=true; sel.appendChild(o); });
        sel.addEventListener("change",()=>{ if(isA) this._compareIdxA=parseInt(sel.value); else this._compareIdxB=parseInt(sel.value); this._draw(); });
        return sel;
      };
      const vsLbl=document.createElement("span"); vsLbl.style.cssText="font-size:8px;color:var(--muted)";vsLbl.textContent="vs";
      compRow.append(mkSel(this._compareIdxA||0,true), vsLbl, mkSel(this._compareIdxB||1,false));
      scroll.appendChild(compRow);
      const toggleBtn=document.createElement("button");
      toggleBtn.style.cssText=`width:100%;padding:5px;border-radius:5px;border:1px solid ${this._compareActive?"#ef444455":"#00e5ff44"};background:${this._compareActive?"#ef444411":"#00e5ff0a"};color:${this._compareActive?"#ef4444":"#00e5ff"};font-size:8px;cursor:pointer;font-family:inherit;margin-bottom:4px`;
      toggleBtn.textContent = this._compareActive ? "✕ Vergleich beenden" : "↔ Vergleichsmodus starten";
      toggleBtn.addEventListener("click",()=>{ this._compareActive=!this._compareActive; this._rebuildSidebar(); this._draw(); });
      scroll.appendChild(toggleBtn);
    }

    // ── AR-Export ─────────────────────────────────────────────────────────
    scroll.appendChild(section("📱 AR-EXPORT","#a78bfa"));
    const arBtn=document.createElement("button");
    arBtn.style.cssText="width:100%;padding:6px;border-radius:5px;border:1px solid #a78bfa44;background:#a78bfa0a;color:#a78bfa;font-size:8px;cursor:pointer;font-family:inherit";
    arBtn.textContent="📱 AR QR-Code generieren";
    arBtn.addEventListener("click",()=>this._generateArQrCode());
    scroll.appendChild(arBtn);

    // ── Profil Export/Import ──────────────────────────────────────────────
    scroll.appendChild(section("💾 PROFILE","#f59e0b"));
    const expRow=document.createElement("div"); expRow.style.cssText="display:flex;gap:4px";
    const expBtn=document.createElement("button");
    expBtn.style.cssText="flex:1;padding:5px;border-radius:4px;border:1px solid #f59e0b44;background:#f59e0b0a;color:#f59e0b;font-size:8px;cursor:pointer;font-family:inherit";
    expBtn.textContent="⬆ Exportieren";
    expBtn.addEventListener("click",()=>this._mmwaveExportProfiles());
    const impBtn=document.createElement("button");
    impBtn.style.cssText="flex:1;padding:5px;border-radius:4px;border:1px solid #22c55e44;background:#22c55e0a;color:#22c55e;font-size:8px;cursor:pointer;font-family:inherit";
    impBtn.textContent="⬇ Importieren";
    impBtn.addEventListener("click",()=>{ const fi=document.createElement("input"); fi.type="file"; fi.accept=".json"; fi.addEventListener("change",e=>{ if(e.target.files[0]) this._mmwaveImportProfiles(e.target.files[0]); }); fi.click(); });
    expRow.append(expBtn,impBtn); scroll.appendChild(expRow);

    wrap.appendChild(scroll);
    return wrap;
  }



  // ══════════════════════════════════════════════════════════════════════════
  // PTZ KAMERA TRACKING SYSTEM
  // Modi: fixed | priority | tour | centroid  +  Alarm-Override
  // Steuerung: ONVIF + HA camera service
  // ══════════════════════════════════════════════════════════════════════════

  // ── PTZ Kamera-Objekt Struktur ────────────────────────────────────────────
  // { id, name, entity_id, mx, my, rotation, fov_h, fov_v,
  //   onvif_url, onvif_user, onvif_pass,
  //   floor_w_m, floor_h_m,           // physische Abmessung des überwachten Bereichs
  //   tracking_mode: "fixed"|"priority"|"tour"|"centroid",
  //   tracking_targets: [{type:"mmwave_target", sensor_id, target_id, name}
  //                     |{type:"ble_device", device_id, name}],
  //   tour_dwell_s: 5,                // Tour: Sek pro Ziel
  //   alarm_override: false,          // Kamera springt bei Sturz zur Person
  //   control_method: "onvif"|"ha"|"both" }

  _ptzInit() {
    if (!this._ptzCameras) this._ptzCameras = structuredClone(this._data?.ptz_cameras || []);
    if (!this._ptzState)   this._ptzState   = {}; // { cam_id: { tourIdx, lastSwitch, currentTarget, locked } }
  }

  // ── Haupt-Tick: welches Ziel soll die Kamera ansteuern? ──────────────────
  _ptzTick() {
    if (!this._opts?.ptzTracking) return;
    this._ptzInit();
    const now = Date.now();

    this._ptzCameras.forEach(cam => {
      if (!cam.entity_id && !cam.onvif_url) return;
      const st = this._ptzState[cam.id] = this._ptzState[cam.id] ||
        { tourIdx:0, lastSwitch:0, currentTarget:null, locked:false, lastSent:0 };

      // ── Alarm-Override hat höchste Priorität ────────────────────────────
      if (cam.alarm_override) {
        const alarmTarget = this._ptzFindAlarmTarget();
        if (alarmTarget) {
          if (!st.locked || st.lockedTarget !== alarmTarget.key) {
            st.locked = true; st.lockedTarget = alarmTarget.key;
            this._ptzMoveTo(cam, alarmTarget.floor_mx, alarmTarget.floor_my, st, now);
          }
          return;
        } else {
          st.locked = false; st.lockedTarget = null;
        }
      }

      // ── Ziel auswählen je nach Modus ────────────────────────────────────
      let target = null;
      switch (cam.tracking_mode) {
        case "fixed":    target = this._ptzTargetFixed(cam);             break;
        case "priority": target = this._ptzTargetPriority(cam);         break;
        case "tour":     target = this._ptzTargetTour(cam, st, now);    break;
        case "centroid": target = this._ptzTargetCentroid(cam);         break;
      }

      if (!target) return;

      // Rate-Limit: max alle 500ms senden (ONVIF/HA Belastung begrenzen)
      if (now - st.lastSent < 500) return;
      if (st.currentTarget?.floor_mx === target.floor_mx &&
          st.currentTarget?.floor_my === target.floor_my) return; // kein Wechsel

      st.currentTarget = target;
      st.lastSent = now;
      this._ptzMoveTo(cam, target.floor_mx, target.floor_my, st, now);
    });
  }

  // ── Alarm-Ziel suchen (Sturz) ─────────────────────────────────────────────
  _ptzFindAlarmTarget() {
    const alarms = this._mmwaveFallAlarms || {};
    const entries = Object.entries(alarms);
    if (!entries.length) return null;
    // Neuester Alarm
    const newest = entries.sort((a,b)=>b[1].ts-a[1].ts)[0];
    return { key: newest[0], floor_mx: newest[1].floor_mx, floor_my: newest[1].floor_my, name: newest[1].tName };
  }

  // ── Tracking-Modi ────────────────────────────────────────────────────────
  _ptzTargetFixed(cam) {
    const tConf = (cam.tracking_targets||[])[0];
    if (!tConf) return null;
    return this._ptzResolveTarget(tConf);
  }

  _ptzTargetPriority(cam) {
    const targets = cam.tracking_targets || [];
    for (const tConf of targets) {
      const t = this._ptzResolveTarget(tConf);
      if (t) return t; // erster aktiver in der Liste
    }
    return null;
  }

  _ptzTargetTour(cam, st, now) {
    const targets = cam.tracking_targets || [];
    if (!targets.length) return null;
    const dwellMs = (cam.tour_dwell_s || 5) * 1000;
    if (now - st.lastSwitch >= dwellMs) {
      st.tourIdx = (st.tourIdx + 1) % targets.length;
      st.lastSwitch = now;
    }
    return this._ptzResolveTarget(targets[st.tourIdx]);
  }

  _ptzTargetCentroid(cam) {
    const targets = cam.tracking_targets || [];
    const resolved = targets.map(t => this._ptzResolveTarget(t)).filter(Boolean);
    if (!resolved.length) return null;
    const cx = resolved.reduce((s,t)=>s+t.floor_mx,0)/resolved.length;
    const cy = resolved.reduce((s,t)=>s+t.floor_my,0)/resolved.length;
    // Zoom-Level berechnen: Abstand der weitesten Punkte
    let maxDist = 0;
    resolved.forEach(a => resolved.forEach(b => {
      maxDist = Math.max(maxDist, Math.hypot(a.floor_mx-b.floor_mx, a.floor_my-b.floor_my));
    }));
    return { floor_mx: cx, floor_my: cy, spread: maxDist, name:"Mittelpunkt" };
  }

  // ── Ziel aus Config-Objekt auflösen → {floor_mx, floor_my, name} ─────────
  _ptzResolveTarget(tConf) {
    if (!tConf) return null;
    if (tConf.type === "mmwave_target") {
      const sensor = (this._ptzCameras, this._pendingMmwave||[]).find(s=>s.id===tConf.sensor_id);
      if (!sensor) return null;
      const t = this._getMmwaveTarget(sensor, tConf.target_id);
      if (!t?.present) return null;
      return { floor_mx: t.floor_mx, floor_my: t.floor_my, name: tConf.name||"mmWave Ziel" };
    }
    if (tConf.type === "ble_device") {
      const dev = (this._data?.devices||[]).find(d=>d.device_id===tConf.device_id);
      if (!dev) return null;
      const mx = dev.x ?? dev.mx ?? null;
      const my = dev.y ?? dev.my ?? null;
      if (mx==null||my==null) return null;
      return { floor_mx: mx, floor_my: my, name: tConf.name||dev.name||"BLE Gerät" };
    }
    return null;
  }

  // ── Kamera bewegen ────────────────────────────────────────────────────────
  async _ptzMoveTo(cam, floor_mx, floor_my, st, now) {
    // Grundriss-Position → Pan/Tilt Winkel umrechnen
    const pt = this._ptzFloorToPanTilt(cam, floor_mx, floor_my);
    if (!pt) return;

    const method = cam.control_method || "ha";

    // ── HA Service ──────────────────────────────────────────────────────────
    if ((method === "ha" || method === "both") && cam.entity_id && this._hass) {
      try {
        await this._hass.callService("camera", "turn_absolute", {
          entity_id: cam.entity_id,
          pan:   pt.pan,
          tilt:  pt.tilt,
          zoom:  pt.zoom ?? 1
        });
      } catch(e) {
        // Fallback: generic PTZ move
        try {
          await this._hass.callService("onvif", "ptz", {
            entity_id: cam.entity_id,
            pan:   pt.pan,
            tilt:  pt.tilt,
            zoom:  pt.zoom ?? 1,
            move_mode: "AbsoluteMove",
            continuous_duration: 0
          });
        } catch(e2) {}
      }
    }

    // ── ONVIF direkt ────────────────────────────────────────────────────────
    if ((method === "onvif" || method === "both") && cam.onvif_url) {
      this._ptzSendOnvif(cam, pt);
    }

    st.lastSent = now;
  }

  // ── Grundriss-Koordinaten → Pan/Tilt ────────────────────────────────────
  _ptzFloorToPanTilt(cam, floor_mx, floor_my) {
    if (cam.mx == null || cam.my == null) return null;
    const dx = floor_mx - cam.mx;
    const dy = floor_my - cam.my;
    if (Math.hypot(dx,dy) < 0.05) return { pan:0, tilt:0, zoom:1 };

    // Kamera-Rotation berücksichtigen
    const camRot = (cam.rotation||0) * Math.PI/180;
    const relAngle = Math.atan2(dx, dy) - camRot; // relativ zur Kamera-Blickrichtung
    const dist     = Math.hypot(dx, dy);
    const mountH   = cam.mount_height_m || 2.0;

    // Pan: seitlicher Winkel (normiert auf -1…+1 für HA / Grad für ONVIF)
    const panDeg  = relAngle * 180 / Math.PI;
    const tiltDeg = Math.atan2(mountH, dist) * 180 / Math.PI - 90; // negativ = runter

    // FOV-basierte Normierung für HA (-1…+1)
    const fovH = cam.fov_h || 70;
    const fovV = cam.fov_v || 50;
    const panNorm  = Math.max(-1, Math.min(1, panDeg  / (fovH/2)));
    const tiltNorm = Math.max(-1, Math.min(1, tiltDeg / (fovV/2)));

    // Zoom: weiter weg = weniger Zoom
    const maxRange = cam.floor_w_m || 8;
    const zoom = Math.max(0.1, Math.min(1, 1 - dist/maxRange * 0.7));

    return { pan: panNorm, tilt: tiltNorm, zoom, panDeg, tiltDeg };
  }

  // ── ONVIF SOAP Kommando senden ───────────────────────────────────────────
  async _ptzSendOnvif(cam, pt) {
    if (!cam.onvif_url) return;
    const soap = `<?xml version="1.0" encoding="UTF-8"?>
<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope"
            xmlns:tptz="http://www.onvif.org/ver20/ptz/wsdl"
            xmlns:tt="http://www.onvif.org/ver10/schema">
  <s:Header>
    <Security xmlns="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd">
      <UsernameToken>
        <Username>${cam.onvif_user||"admin"}</Username>
        <Password>${cam.onvif_pass||""}</Password>
      </UsernameToken>
    </Security>
  </s:Header>
  <s:Body>
    <tptz:AbsoluteMove>
      <tptz:ProfileToken>${cam.onvif_profile||"Profile_1"}</tptz:ProfileToken>
      <tptz:Position>
        <tt:PanTilt x="${pt.pan.toFixed(4)}" y="${pt.tilt.toFixed(4)}" space="http://www.onvif.org/ver10/tptz/PanTiltSpaces/PositionGenericSpace"/>
        <tt:Zoom x="${(pt.zoom||1).toFixed(4)}" space="http://www.onvif.org/ver10/tptz/ZoomSpaces/PositionGenericSpace"/>
      </tt:Position>
      <tptz:Speed>
        <tt:PanTilt x="0.5" y="0.5"/>
        <tt:Zoom x="0.5"/>
      </tptz:Speed>
    </tptz:AbsoluteMove>
  </s:Body>
</s:Envelope>`;
    try {
      // Über HA-Proxy senden um CORS zu umgehen
      await this._hass.callApi("POST", "ble_positioning/onvif_proxy", {
        url:  cam.onvif_url + "/onvif/PTZ",
        soap, user: cam.onvif_user, pass: cam.onvif_pass
      });
    } catch(e) {}
  }

  // ── Canvas: PTZ-Tracking Overlay ─────────────────────────────────────────
  _drawPtzOverlay() {
    if (!this._opts?.ptzTracking) return;
    this._ptzInit();
    const ctx = this._ctx;
    const t   = Date.now() / 1000;

    this._ptzCameras.forEach(cam => {
      if (cam.mx == null) return;
      const cc = this._f2c(cam.mx, cam.my);
      const st = (this._ptzState||{})[cam.id] || {};

      // Kamera-Icon (pulsiert wenn aktives Tracking)
      const isTracking = !!(st.currentTarget);
      const pulse = 0.7 + 0.3 * Math.sin(t * 3);

      if (isTracking) {
        ctx.strokeStyle = `rgba(168,85,247,${pulse})`;
        ctx.lineWidth   = 2;
        ctx.beginPath(); ctx.arc(cc.x, cc.y, 14*pulse, 0, Math.PI*2); ctx.stroke();
      }
      ctx.fillStyle   = isTracking ? "#a855f7" : "#64748b";
      ctx.font        = "16px serif"; ctx.textAlign="center"; ctx.textBaseline="middle";
      ctx.fillText("📹", cc.x, cc.y);

      // Name
      ctx.fillStyle = "rgba(0,0,0,0.65)";
      ctx.fillRect(cc.x-20, cc.y+10, 40, 11);
      ctx.fillStyle = "#a855f7"; ctx.font="bold 7px monospace";
      ctx.textAlign="center"; ctx.textBaseline="middle";
      ctx.fillText(cam.name||"PTZ", cc.x, cc.y+15.5);

      // Tracking-Linie zum aktuellen Ziel
      if (st.currentTarget && isTracking) {
        const tc = this._f2c(st.currentTarget.floor_mx, st.currentTarget.floor_my);
        ctx.strokeStyle = `rgba(168,85,247,${0.4+0.3*pulse})`;
        ctx.lineWidth   = 1.5;
        ctx.setLineDash([4,4]);
        ctx.beginPath(); ctx.moveTo(cc.x, cc.y); ctx.lineTo(tc.x, tc.y); ctx.stroke();
        ctx.setLineDash([]);
        // Pfeilspitze
        const angle = Math.atan2(tc.y-cc.y, tc.x-cc.x);
        const mx = (cc.x+tc.x)/2, my = (cc.y+tc.y)/2;
        ctx.fillStyle="#a855f7"; ctx.beginPath();
        ctx.moveTo(mx+Math.cos(angle)*5, my+Math.sin(angle)*5);
        ctx.lineTo(mx+Math.cos(angle+2.5)*4, my+Math.sin(angle+2.5)*4);
        ctx.lineTo(mx+Math.cos(angle-2.5)*4, my+Math.sin(angle-2.5)*4);
        ctx.closePath(); ctx.fill();
        // Ziel-Label
        ctx.fillStyle="rgba(168,85,247,0.8)"; ctx.font="7px monospace";
        ctx.textAlign="center"; ctx.fillText(`→ ${st.currentTarget.name}`, mx, my-7);
      }

      // Alarm-Override Indicator
      if (cam.alarm_override && st.locked) {
        ctx.fillStyle="#ef4444"; ctx.font="9px serif";
        ctx.fillText("🆘", cc.x+10, cc.y-10);
      }
    });
  }


  // ══════════════════════════════════════════════════════════════════════════
  // PTZ SIDEBAR TAB
  // ══════════════════════════════════════════════════════════════════════════
  _sidebarPtz() {
    const wrap = document.createElement("div");
    wrap.style.cssText = "display:flex;flex-direction:column;height:100%;overflow:hidden";
    this._ptzInit();
    const cams = this._ptzCameras;

    // Header
    const hdr = document.createElement("div");
    hdr.style.cssText = "padding:8px 10px 6px;border-bottom:1px solid var(--border);flex-shrink:0";
    hdr.innerHTML = `<div style="font-size:10px;font-weight:700;color:#94a3b8;letter-spacing:1px;margin-bottom:4px">📹 PTZ TRACKING</div>`;
    const addBtn = document.createElement("button");
    addBtn.style.cssText = "width:100%;padding:6px;border-radius:5px;border:1px solid #a855f755;background:#a855f711;color:#a855f7;font-size:9px;font-weight:700;cursor:pointer;font-family:inherit";
    addBtn.textContent = "+ PTZ Kamera hinzufügen";
    addBtn.addEventListener("click", () => {
      cams.push({ id:"ptz_"+Date.now(), name:"Kamera "+(cams.length+1),
        entity_id:"", onvif_url:"", onvif_user:"admin", onvif_pass:"",
        onvif_profile:"Profile_1", mx:null, my:null, rotation:0,
        fov_h:70, fov_v:50, mount_height_m:2.0, floor_w_m:8,
        tracking_mode:"priority", tracking_targets:[],
        tour_dwell_s:5, alarm_override:false, control_method:"ha" });
      this._ptzEditIdx = cams.length-1;
      this._rebuildSidebar();
    });
    hdr.appendChild(addBtn);
    wrap.appendChild(hdr);

    const list = document.createElement("div");
    list.style.cssText = "flex:1;overflow-y:auto;padding:8px 10px";

    if (!cams.length) {
      const em=document.createElement("div"); em.style.cssText="text-align:center;color:var(--muted);font-size:9px;padding:20px 0;line-height:2";
      em.innerHTML="Keine PTZ-Kameras konfiguriert.<br><b>+ PTZ Kamera hinzufügen</b>"; list.appendChild(em);
    }

    cams.forEach((cam, idx) => {
      const isEdit = this._ptzEditIdx === idx;
      const st     = (this._ptzState||{})[cam.id] || {};
      const card   = document.createElement("div");
      card.style.cssText = `border-radius:8px;border:1px solid ${isEdit?"#a855f755":"var(--border)"};background:${isEdit?"#a855f708":"var(--surf2)"};margin-bottom:6px;overflow:hidden`;

      // Card header
      const crow = document.createElement("div");
      crow.style.cssText = "display:flex;align-items:center;gap:5px;padding:6px 8px;cursor:pointer";
      crow.addEventListener("click", () => { this._ptzEditIdx = isEdit?null:idx; this._rebuildSidebar(); });

      const isTracking = !!(st.currentTarget);
      const statusDot = document.createElement("div");
      statusDot.style.cssText = `width:8px;height:8px;border-radius:50%;background:${isTracking?"#a855f7":"#334155"};flex-shrink:0`;
      const nameLbl = document.createElement("span"); nameLbl.style.cssText="flex:1;font-size:9px;font-weight:700;color:var(--text)"; nameLbl.textContent=cam.name;
      const modeLbl = document.createElement("span"); modeLbl.style.cssText="font-size:7.5px;color:var(--muted)";
      modeLbl.textContent = ({fixed:"📌 Fixziel", priority:"⭐ Priorität", tour:"🔄 Tour", centroid:"⊕ Mittelpunkt"}[cam.tracking_mode]||"");
      const trackLbl = document.createElement("span"); trackLbl.style.cssText=`font-size:7.5px;color:${isTracking?"#a855f7":"var(--muted)"}`;
      trackLbl.textContent = isTracking ? `→ ${st.currentTarget?.name||"?"}` : "inaktiv";
      const chevron = document.createElement("span"); chevron.style.cssText="font-size:8px;color:var(--muted)"; chevron.textContent=isEdit?"▲":"▼";
      const delBtn  = document.createElement("button");
      delBtn.style.cssText="padding:2px 5px;border:1px solid #ef444433;border-radius:3px;background:#ef444408;color:#ef4444;font-size:7.5px;cursor:pointer;font-family:inherit";
      delBtn.textContent="✕";
      delBtn.addEventListener("click", e=>{ e.stopPropagation(); cams.splice(idx,1); this._ptzEditIdx=null; this._rebuildSidebar(); });
      crow.append(statusDot, nameLbl, modeLbl, trackLbl, chevron, delBtn);
      card.appendChild(crow);

      if (isEdit) {
        const body = document.createElement("div");
        body.style.cssText = "padding:6px 8px 8px;border-top:1px solid var(--border)";
        this._buildPtzEditor(body, cam, idx);
        card.appendChild(body);
      }
      list.appendChild(card);
    });

    // Save button
    const saveBtn = document.createElement("button");
    saveBtn.style.cssText = "width:100%;margin-top:4px;padding:8px;border-radius:6px;border:1px solid #22c55e55;background:#22c55e11;color:#22c55e;font-size:10px;font-weight:700;cursor:pointer;font-family:inherit";
    saveBtn.textContent = cams.length ? `💾 Speichern (${cams.length} Kameras)` : "Keine Kameras";
    saveBtn.disabled = !cams.length;
    saveBtn.addEventListener("click", async () => {
      saveBtn.disabled=true; saveBtn.textContent="⏳...";
      try {
        await this._hass.callApi("POST", `ble_positioning/${this._entryId}/ptz_cameras`, { cameras: cams });
        if(this._data) this._data.ptz_cameras = structuredClone(cams);
        this._showToast(`✓ ${cams.length} PTZ-Kamera${cams.length!==1?"s":""} gespeichert`);
        saveBtn.textContent="✓ Gespeichert";
        this._setTimeout(()=>{ saveBtn.disabled=false; saveBtn.textContent=`💾 Speichern (${cams.length} Kameras)`; },2000);
      } catch(e){ saveBtn.disabled=false; saveBtn.textContent=`💾 Speichern (${cams.length} Kameras)`; this._showToast("Fehler: "+e.message); }
    });
    list.appendChild(saveBtn);
    wrap.appendChild(list);
    return wrap;
  }

  _buildPtzEditor(body, cam, idx) {
    const row = (label, input, hint) => {
      const d=document.createElement("div"); d.style.cssText="margin-bottom:4px";
      const l=document.createElement("div"); l.style.cssText="font-size:7.5px;color:var(--muted);margin-bottom:1px"; l.textContent=label;
      d.appendChild(l); d.appendChild(input);
      if(hint){ const h=document.createElement("div"); h.style.cssText="font-size:7px;color:#475569;margin-top:1px"; h.textContent=hint; d.appendChild(h); }
      return d;
    };
    const inp = (type, val, placeholder, onChange) => {
      const i=document.createElement("input"); i.type=type; i.value=val||"";
      if(placeholder) i.placeholder=placeholder;
      i.style.cssText="width:100%;padding:2px 5px;border-radius:4px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-size:8px;font-family:inherit;box-sizing:border-box";
      i.addEventListener("input",()=>onChange(i.value)); return i;
    };

    // Name
    body.appendChild(row("Name:", inp("text", cam.name, "Kamera 1", v=>cam.name=v)));

    // Steuerung
    const ctrlSel = document.createElement("select");
    ctrlSel.style.cssText="width:100%;padding:2px 5px;border-radius:4px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-size:8px;margin-bottom:4px";
    [["ha","🏠 HA Service (camera.turn_absolute)"],["onvif","📡 ONVIF direkt"],["both","🔀 Beide"]].forEach(([v,l])=>{
      const o=document.createElement("option"); o.value=v; o.textContent=l; if(cam.control_method===v)o.selected=true; ctrlSel.appendChild(o);
    });
    ctrlSel.addEventListener("change",()=>{ cam.control_method=ctrlSel.value; this._rebuildSidebar(); });
    body.appendChild(row("Steuerung:", ctrlSel));

    // HA Entity
    if(cam.control_method!=="onvif") {
      body.appendChild(row("HA Entity:", inp("text", cam.entity_id, "camera.meine_ptz", v=>cam.entity_id=v)));
    }

    // ONVIF
    if(cam.control_method!=="ha") {
      body.appendChild(row("ONVIF URL:", inp("text", cam.onvif_url, "http://192.168.1.x:80", v=>cam.onvif_url=v)));
      const credRow=document.createElement("div"); credRow.style.cssText="display:flex;gap:4px;margin-bottom:4px";
      ["Benutzer","Passwort"].forEach((ph,i)=>{
        const inp2=document.createElement("input"); inp2.type=i===1?"password":"text";
        inp2.value=i===0?cam.onvif_user||"":cam.onvif_pass||""; inp2.placeholder=ph;
        inp2.style.cssText="flex:1;padding:2px 4px;border-radius:3px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-size:8px";
        inp2.addEventListener("input",()=>{ if(i===0)cam.onvif_user=inp2.value; else cam.onvif_pass=inp2.value; });
        credRow.appendChild(inp2);
      });
      body.appendChild(credRow);
      body.appendChild(row("ONVIF Profil:", inp("text", cam.onvif_profile, "Profile_1", v=>cam.onvif_profile=v)));
    }

    // Position
    const posRow=document.createElement("div"); posRow.style.cssText="display:flex;gap:4px;margin-bottom:4px";
    ["X (m)","Y (m)"].forEach((lbl,i)=>{
      const d=document.createElement("div"); d.style.cssText="flex:1;display:flex;flex-direction:column;gap:1px";
      const l=document.createElement("span"); l.style.cssText="font-size:7px;color:var(--muted)"; l.textContent=lbl;
      const inp2=document.createElement("input"); inp2.type="number"; inp2.min=0; inp2.step=0.1;
      inp2.value=i===0?cam.mx||"":cam.my||""; inp2.placeholder="klick auf Karte";
      inp2.style.cssText="padding:2px 4px;border-radius:3px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-size:8px;text-align:center";
      inp2.addEventListener("input",()=>{ if(i===0)cam.mx=parseFloat(inp2.value)||null; else cam.my=parseFloat(inp2.value)||null; this._draw(); });
      d.append(l,inp2); posRow.appendChild(d);
    });
    body.appendChild(posRow);

    // Rotation + Höhe
    const rotHRow=document.createElement("div"); rotHRow.style.cssText="display:flex;gap:4px;margin-bottom:4px";
    [["Rotation°","rotation",cam.rotation||0,-180,180,1],["Höhe m","mount_height_m",cam.mount_height_m||2,0.5,5,0.1]].forEach(([lbl,key,val,min,max,step])=>{
      const d=document.createElement("div"); d.style.cssText="flex:1;display:flex;flex-direction:column;gap:1px";
      const l=document.createElement("span"); l.style.cssText="font-size:7px;color:var(--muted)"; l.textContent=lbl;
      const inp2=document.createElement("input"); inp2.type="number"; inp2.min=min; inp2.max=max; inp2.step=step; inp2.value=val;
      inp2.style.cssText="padding:2px 4px;border-radius:3px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-size:8px;text-align:center";
      inp2.addEventListener("input",()=>{ cam[key]=parseFloat(inp2.value)||val; this._draw(); });
      d.append(l,inp2); rotHRow.appendChild(d);
    });
    body.appendChild(rotHRow);

    // Tracking Mode
    const modeHdr=document.createElement("div"); modeHdr.style.cssText="font-size:8px;font-weight:700;color:#a855f7;margin:6px 0 3px";
    modeHdr.textContent="🎯 TRACKING MODUS";
    body.appendChild(modeHdr);
    const modeSel=document.createElement("select");
    modeSel.style.cssText="width:100%;padding:3px 5px;border-radius:4px;border:1px solid #a855f744;background:var(--bg);color:var(--text);font-size:8px;margin-bottom:4px";
    [["fixed","📌 Fixziel – immer ein bestimmtes Ziel"],["priority","⭐ Priorität – erstes aktives Ziel"],["tour","🔄 Tour – alle der Reihe nach"],["centroid","⊕ Mittelpunkt – geometrischer Schwerpunkt"]].forEach(([v,l])=>{
      const o=document.createElement("option"); o.value=v; o.textContent=l; if(cam.tracking_mode===v)o.selected=true; modeSel.appendChild(o);
    });
    modeSel.addEventListener("change",()=>{ cam.tracking_mode=modeSel.value; this._rebuildSidebar(); });
    body.appendChild(modeSel);

    // Tour dwell
    if(cam.tracking_mode==="tour") {
      body.appendChild(row("Sek pro Ziel:", inp("number", cam.tour_dwell_s||5, "5", v=>cam.tour_dwell_s=parseInt(v)||5), "Tour-Verweildauer in Sekunden"));
    }

    // Alarm Override
    const alarmRow=document.createElement("label");
    alarmRow.style.cssText="display:flex;align-items:center;gap:5px;font-size:8px;color:var(--muted);cursor:pointer;margin-bottom:5px";
    const alarmCb=document.createElement("input"); alarmCb.type="checkbox"; alarmCb.checked=!!cam.alarm_override;
    alarmCb.addEventListener("change",()=>cam.alarm_override=alarmCb.checked);
    alarmRow.append(alarmCb,"🆘 Bei Sturz-Alarm zu betroffener Person wechseln");
    body.appendChild(alarmRow);

    // Ziel-Konfiguration
    const targetHdr=document.createElement("div"); targetHdr.style.cssText="font-size:8px;font-weight:700;color:#a855f7;margin:4px 0 3px";
    targetHdr.textContent = cam.tracking_mode==="centroid" ? "📍 ZIELE (Mittelpunkt aus allen)" : cam.tracking_mode==="tour" ? "📍 ZIELE (Tour-Reihenfolge)" : cam.tracking_mode==="priority" ? "📍 ZIELE (Priorität: oben = höher)" : "📍 FIXZIEL";
    body.appendChild(targetHdr);

    if (!cam.tracking_targets) cam.tracking_targets=[];
    cam.tracking_targets.forEach((t, ti) => {
      const tRow=document.createElement("div"); tRow.style.cssText="display:flex;align-items:center;gap:4px;margin-bottom:3px;padding:3px 5px;border-radius:4px;background:var(--surf3)";
      const icon=document.createElement("span"); icon.textContent=t.type==="mmwave_target"?"📡":"📱"; icon.style.cssText="font-size:10px";
      const lbl=document.createElement("span"); lbl.style.cssText="flex:1;font-size:8px;color:var(--text)"; lbl.textContent=t.name||"Ziel";
      // Priority move up/down
      if(cam.tracking_mode==="priority"||cam.tracking_mode==="tour") {
        if(ti>0){ const upBtn=document.createElement("button"); upBtn.style.cssText="padding:1px 5px;border:1px solid var(--border);border-radius:3px;background:none;color:var(--muted);font-size:8px;cursor:pointer"; upBtn.textContent="↑"; upBtn.addEventListener("click",()=>{ [cam.tracking_targets[ti-1],cam.tracking_targets[ti]]=[cam.tracking_targets[ti],cam.tracking_targets[ti-1]]; this._rebuildSidebar(); }); tRow.appendChild(upBtn); }
      }
      const delT=document.createElement("button"); delT.style.cssText="padding:1px 5px;border:1px solid #ef444433;border-radius:3px;background:#ef444408;color:#ef4444;font-size:7.5px;cursor:pointer"; delT.textContent="✕";
      delT.addEventListener("click",()=>{ cam.tracking_targets.splice(ti,1); this._rebuildSidebar(); });
      tRow.append(icon, lbl, delT); body.appendChild(tRow);
    });

    // Ziel hinzufügen
    if(cam.tracking_mode!=="fixed"||cam.tracking_targets.length===0) {
      const addTRow=document.createElement("div"); addTRow.style.cssText="display:flex;gap:3px;margin-top:2px";
      // mmWave Target Dropdown
      const mmSel=document.createElement("select"); mmSel.style.cssText="flex:1;padding:2px 3px;border-radius:3px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-size:7.5px";
      const def=document.createElement("option"); def.value=""; def.textContent="+ Ziel wählen"; mmSel.appendChild(def);
      (this._pendingMmwave||[]).forEach(s=>{
        for(let ti=1;ti<=3;ti++){
          const o=document.createElement("option"); o.value=JSON.stringify({type:"mmwave_target",sensor_id:s.id,target_id:ti,name:(s.target_names||[])[ti-1]||`${s.name} T${ti}`});
          o.textContent=`📡 ${(s.target_names||[])[ti-1]||`${s.name} Ziel ${ti}`}`; mmSel.appendChild(o);
        }
      });
      (this._data?.devices||[]).forEach(d=>{
        const o=document.createElement("option"); o.value=JSON.stringify({type:"ble_device",device_id:d.device_id,name:d.name||d.device_id});
        o.textContent=`📱 ${d.name||d.device_id}`; mmSel.appendChild(o);
      });
      const addTBtn=document.createElement("button"); addTBtn.style.cssText="padding:2px 7px;border-radius:3px;border:1px solid #a855f744;background:#a855f711;color:#a855f7;font-size:8px;cursor:pointer;font-family:inherit"; addTBtn.textContent="+";
      addTBtn.addEventListener("click",()=>{
        if(!mmSel.value) return;
        try{ cam.tracking_targets.push(JSON.parse(mmSel.value)); this._rebuildSidebar(); } catch(e){}
      });
      addTRow.append(mmSel, addTBtn); body.appendChild(addTRow);
    }

    // Place on map
    const placeBtn=document.createElement("button");
    placeBtn.style.cssText="width:100%;margin-top:5px;padding:5px;border-radius:4px;border:1px solid #a855f755;background:#a855f711;color:#a855f7;font-size:8px;cursor:pointer;font-family:inherit";
    placeBtn.textContent=this._ptzPlacing===idx?"✕ Abbrechen":"📍 Auf Grundriss platzieren";
    placeBtn.addEventListener("click",()=>{ this._ptzPlacing=this._ptzPlacing===idx?null:idx; this._rebuildSidebar(); this._draw(); });
    body.appendChild(placeBtn);
  }



  // Lumen → Glow-Skalierung (Referenz: 800lm = 1.0)
  _lumensToGlowFactor(lumen, bri) {
    const refLm = 800;
    const lm = Math.max(1, lumen || refLm);
    // Logarithmisches Empfindlichkeitsgesetz: jede Verdoppelung = +30% Radius
    const lumFactor = Math.log2(lm / refLm) * 0.3 + 1.0;
    return Math.max(0.3, lumFactor * (0.3 + bri * 0.7));
  }

  _drawLights(lights) {
    if (!lights || lights.length === 0) return;
    const ctx   = this._ctx;
    const rooms = this._data?.rooms || [];

    // ── Pass 1: darken rooms where all lights are off ─────────────────────
    // Build per-room info using room_id (authoritative) with geometric fallback
    const roomInfo = rooms.map(() => ({ anyLight: false, anyOn: false }));
    lights.forEach(light => {
      const ri = this._lightRoomIdx(light, rooms);
      if (ri >= 0) {
        roomInfo[ri].anyLight = true;
        if (light.on) roomInfo[ri].anyOn = true;
      }
    });

    ctx.save();
    roomInfo.forEach((info, ri) => {
      if (info.anyLight && !info.anyOn) {
        const r  = rooms[ri];
        const c1 = this._f2c(r.x1, r.y1), c2 = this._f2c(r.x2, r.y2);
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        ctx.fillRect(c1.x, c1.y, c2.x - c1.x, c2.y - c1.y);
      }
    });
    ctx.restore();

    // ── Pass 2: glow per light, clipped to assigned room ─────────────────
    lights.forEach(light => {
      if (!light.on) return;

      const ri = this._lightRoomIdx(light, rooms);

      // Glow color
      let r = 255, g = 248, b = 180;
      if (light.rgb && light.rgb.length === 3) {
        [r, g, b] = light.rgb;
      } else if (light.color_temp) {
        const ct = Math.max(153, Math.min(500, light.color_temp));
        const t  = (ct - 153) / 347;
        r = Math.round(200 + 55 * t);
        g = Math.round(220 - 30 * t);
        b = Math.round(255 - 100 * t);
      }

      const bri    = (light.brightness ?? 255) / 255;
      const lumFactor2D = this._lumensToGlowFactor(light.lumen, bri);
      const scaleX = this._canvas.width  / (this._data?.floor_w || 10);
      const scaleY = this._canvas.height / (this._data?.floor_h || 10);
      const glowPx = lumFactor2D * (scaleX + scaleY) / 2;
      const alpha  = Math.min(0.55, 0.10 + lumFactor2D * 0.22);
      const pos    = this._f2c(light.mx, light.my);

      ctx.save();

      // Build clip set: own room + group siblings
      let clipSet = [];
      if (ri >= 0) {
        const rm  = rooms[ri];
        const gid = rm.group_id;
        clipSet = gid ? rooms.filter(r2 => r2.group_id === gid) : [rm];
      }

      // Find open doors that connect the light's room to a neighbour
      const doors       = this._data?.doors || [];
      const openDoorRooms = [];   // {room, factor} – neighbour rooms reachable via open door
      if (ri >= 0) {
        const myRoomName = rooms[ri]?.name;
        doors.forEach(door => {
          // Check if door is open
          let doorOpen = true;  // default: open when no entity
          if (door.entity_id && this._hass?.states) {
            const s = this._hass.states[door.entity_id]?.state;
            if (s) doorOpen = (s === 'open' || s === 'on');
          }
          if (!doorOpen) return;
          // Find which rooms this door connects
          const connects = door.connects || [];
          if (!connects.includes(myRoomName)) return;
          // Find the neighbour room name
          const neighbourName = connects.find(n => n !== myRoomName);
          if (!neighbourName) return;
          const neighbourIdx = rooms.findIndex(r2 => r2.name === neighbourName);
          if (neighbourIdx < 0) return;
          // Distance from light to door → fade factor (closer = more bleed)
          const dist   = Math.hypot(light.mx - door.x, light.my - door.y);
          const factor = Math.max(0.05, 0.35 - dist * 0.06);  // 0.35 at door, fades with distance
          openDoorRooms.push({ room: rooms[neighbourIdx], factor });
        });

        // ── Bidirektional: Lichter im Nachbarraum scheinen zurück ──────────
      // Für jede offene Tür: prüfe ob im Nachbarraum eine aktive Lampe steht
      // und füge deren Licht als Bleed in unseren Raum ein
      if (ri >= 0) {
        const myRoomName2 = rooms[ri]?.name;
        const allLights = this._data?.lights || [];
        doors.forEach(door => {
          let doorOpen2 = true;
          if (door.entity_id && this._hass?.states) {
            const s = this._hass.states[door.entity_id]?.state;
            if (s) doorOpen2 = (s === 'open' || s === 'on');
          }
          if (!doorOpen2) return;
          const connects2 = door.connects || [];
          if (!connects2.includes(myRoomName2)) return;
          const neighbourName2 = connects2.find(n => n !== myRoomName2);
          if (!neighbourName2) return;
          const neighbourIdx2 = rooms.findIndex(r2 => r2.name === neighbourName2);
          if (neighbourIdx2 < 0) return;
          // Find active lights in the neighbour room
          allLights.forEach(nLight => {
            // Skip if this is the current light (avoid double-counting)
            if (nLight === light) return;
            // Check entity state
            let nActive = true;
            if (nLight.entity && this._hass?.states) {
              const ns = this._hass.states[nLight.entity]?.state;
              if (ns !== undefined) nActive = (ns === 'on' || ns === 'true' || ns === '1');
            }
            if (!nActive) return;
            // Check if this light belongs to the neighbour room
            const nRoomIdx = this._lightRoomIdx(nLight, rooms);
            if (nRoomIdx !== neighbourIdx2) return;
            // Neighbour light is active → bleed into our room
            const nPos = this._f2c(nLight.mx, nLight.my);
            const nDist = Math.hypot(nLight.mx - door.x, nLight.my - door.y);
            const nFactor = Math.max(0.03, 0.28 - nDist * 0.05);
            // Parse neighbour light colour
            const nCol = nLight.color || "#ffffff";
            const nHex = nCol.replace("#","");
            const nR = parseInt(nHex.slice(0,2),16)||255;
            const nG = parseInt(nHex.slice(2,4),16)||255;
            const nB = parseInt(nHex.slice(4,6),16)||255;
            const nAlpha = (nLight.brightness ?? 80) / 100 * 0.55;
            // Clip to our room and draw bleed
            ctx.save();
            ctx.beginPath();
            const myRm = rooms[ri];
            const mc1 = this._f2c(myRm.x1, myRm.y1), mc2 = this._f2c(myRm.x2, myRm.y2);
            ctx.rect(mc1.x, mc1.y, mc2.x - mc1.x, mc2.y - mc1.y);
            ctx.clip();
            const nGlowPx = Math.max(40, ((nLight.radius ?? 3) * this._scale));
            const bleedAlpha2 = nAlpha * nFactor;
            if (!isFinite(nPos.x) || !isFinite(nPos.y)) { ctx.restore(); return; }
            const bg2 = ctx.createRadialGradient(nPos.x, nPos.y, 0, nPos.x, nPos.y, nGlowPx * 1.4);
            bg2.addColorStop(0,   `rgba(${nR},${nG},${nB},${bleedAlpha2.toFixed(3)})`);
            bg2.addColorStop(0.5, `rgba(${nR},${nG},${nB},${(bleedAlpha2*0.4).toFixed(3)})`);
            bg2.addColorStop(1,   `rgba(${nR},${nG},${nB},0)`);
            ctx.fillStyle = bg2;
            ctx.beginPath(); ctx.arc(nPos.x, nPos.y, nGlowPx * 1.4, 0, Math.PI*2); ctx.fill();
            ctx.restore();
          });
        });
      }

      // Find open windows that are in the light's room → bleed outside (weaker, no neighbour room needed)
        // Windows don't connect rooms like doors do, but open windows let light bleed
        // along the wall edge into adjacent rooms
        const windows = this._data?.windows || [];
        windows.forEach(win => {
          // Check if window is open (open or tilted = lets light through)
          let winOpen = false;  // default: closed = no bleed
          if (win.entity_id && this._hass?.states) {
            const s = this._hass.states[win.entity_id]?.state;
            winOpen = (s === 'open' || s === 'on' || s === 'tilted');
          } else if (!win.entity_id) {
            winOpen = false;  // no entity = treat as closed (unlike doors)
          }
          if (!winOpen) return;
          // Check if window is near the light's room boundary
          const rm = rooms[ri];
          const inOrNearRoom = win.x >= rm.x1 - 0.3 && win.x <= rm.x2 + 0.3 &&
                               win.y >= rm.y1 - 0.3 && win.y <= rm.y2 + 0.3;
          if (!inOrNearRoom) return;
          // Find adjacent room on the other side of the window
          const wx = win.x, wy = win.y;
          const ang = win.angle || 0;
          // Normal direction through wall (perpendicular to window)
          const nx = Math.sin(ang), ny = -Math.cos(ang);
          // Try both sides of the wall
          for (const side of [1, -1]) {
            const testX = wx + nx * side * 0.5;
            const testY = wy + ny * side * 0.5;
            // Is test point outside the light's room?
            const insideOwn = testX >= rm.x1 && testX <= rm.x2 &&
                              testY >= rm.y1 && testY <= rm.y2;
            if (insideOwn) continue;
            // Find neighbour room on that side
            const neighbourIdx = rooms.findIndex((r2, idx) => idx !== ri &&
              testX >= r2.x1 - 0.1 && testX <= r2.x2 + 0.1 &&
              testY >= r2.y1 - 0.1 && testY <= r2.y2 + 0.1
            );
            if (neighbourIdx < 0) continue;
            const dist   = Math.hypot(light.mx - wx, light.my - wy);
            // Windows let through less light than open doors
            const isTilted = win.entity_id && this._hass?.states?.[win.entity_id]?.state === 'tilted';
            const baseFactor = isTilted ? 0.10 : 0.20;
            const factor = Math.max(0.03, baseFactor - dist * 0.04);
            openDoorRooms.push({ room: rooms[neighbourIdx], factor });
          }
        });
      }

      // ── Draw own room glow ────────────────────────────────────────────
      ctx.beginPath();
      if (clipSet.length > 0) {
        clipSet.forEach(cr => {
          const c1 = this._f2c(cr.x1, cr.y1), c2 = this._f2c(cr.x2, cr.y2);
          ctx.rect(c1.x, c1.y, c2.x - c1.x, c2.y - c1.y);
        });
      } else {
        ctx.rect(0, 0, this._canvas.width, this._canvas.height);
      }
      ctx.clip();

      const grad = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, glowPx);
      grad.addColorStop(0,   `rgba(${r},${g},${b},${alpha.toFixed(3)})`);
      grad.addColorStop(0.4, `rgba(${r},${g},${b},${(alpha * 0.5).toFixed(3)})`);
      grad.addColorStop(1,   `rgba(${r},${g},${b},0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, glowPx, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      // ── Draw bleed glow into neighbour rooms through open doors ──────
      openDoorRooms.forEach(({ room: nr, factor }) => {
        ctx.save();
        // Clip to neighbour room only
        ctx.beginPath();
        const nc1 = this._f2c(nr.x1, nr.y1), nc2 = this._f2c(nr.x2, nr.y2);
        ctx.rect(nc1.x, nc1.y, nc2.x - nc1.x, nc2.y - nc1.y);
        ctx.clip();
        // Dimmed glow
        const bleedAlpha = alpha * factor;
        const bg = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, glowPx * 1.4);
        bg.addColorStop(0,   `rgba(${r},${g},${b},${bleedAlpha.toFixed(3)})`);
        bg.addColorStop(0.5, `rgba(${r},${g},${b},${(bleedAlpha * 0.4).toFixed(3)})`);
        bg.addColorStop(1,   `rgba(${r},${g},${b},0)`);
        ctx.fillStyle = bg;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, glowPx * 1.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      // ── 2D Lampen-Symbol (typ-abhängig) ─────────────────────────────────
      this._drawLampSymbol2D(ctx, light, pos.x, pos.y, bri, r, g, b);
    });
  }

  // ── 2D Lampen-Symbol ─────────────────────────────────────────────────────
  _drawLampSymbol2D(ctx, light, cx, cy, bri, r, g, b) {
    const type = light.lamp_type || "bulb";
    const s = 8 + bri * 4; // symbol size
    const on = light.on !== false;
    const col = on ? `rgba(${r},${g},${b},0.95)` : "rgba(140,130,110,0.5)";
    ctx.save();
    ctx.translate(cx, cy);

    switch(type) {
      case "bulb": {
        // Klassische Glühbirne: Kreis + Sockel
        ctx.fillStyle = on ? `rgba(255,255,255,0.9)` : "rgba(80,80,70,0.4)";
        ctx.strokeStyle = col; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(0, -s*0.2, s*0.55, 0, Math.PI*2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = col;
        ctx.fillRect(-s*0.25, s*0.35, s*0.5, s*0.25);
        ctx.strokeStyle = col; ctx.lineWidth = 0.6;
        for(let i=0;i<3;i++){
          ctx.beginPath(); ctx.moveTo(-s*0.25, s*0.35+i*(s*0.08));
          ctx.lineTo(s*0.25, s*0.35+i*(s*0.08)); ctx.stroke();
        }
        break;
      }
      case "globe": {
        // Kugel: doppelter Kreis
        ctx.strokeStyle = col; ctx.lineWidth = 1.5;
        ctx.fillStyle = on ? `rgba(${r},${g},${b},0.25)` : "rgba(80,80,70,0.15)";
        ctx.beginPath(); ctx.arc(0, 0, s*0.6, 0, Math.PI*2); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.arc(0, 0, s*0.3, 0, Math.PI*2); ctx.fill(); ctx.stroke();
        // Äquator-Linie
        ctx.beginPath(); ctx.ellipse(0, 0, s*0.6, s*0.15, 0, 0, Math.PI*2); ctx.stroke();
        break;
      }
      case "pendant": {
        // Hängeleuchte: Kabel + Schirm
        ctx.strokeStyle = "rgba(130,120,100,0.7)"; ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.moveTo(0, -s*1.2); ctx.lineTo(0, -s*0.3); ctx.stroke();
        // Schirm (umgekehrter Kegel)
        ctx.fillStyle = `rgba(80,70,50,0.85)`;
        ctx.beginPath(); ctx.moveTo(-s*0.7, -s*0.3); ctx.lineTo(s*0.7, -s*0.3);
        ctx.lineTo(s*0.35, s*0.2); ctx.lineTo(-s*0.35, s*0.2); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = col; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(-s*0.7, -s*0.3); ctx.lineTo(s*0.7, -s*0.3); ctx.stroke();
        // Lichtöffnung unten
        if(on){ ctx.fillStyle=`rgba(${r},${g},${b},0.7)`; ctx.beginPath();
          ctx.ellipse(0, s*0.2, s*0.3, s*0.1, 0, 0, Math.PI*2); ctx.fill(); }
        break;
      }
      case "spot": {
        // Spot: kleiner Kreis + Lichtkegel
        ctx.fillStyle = "rgba(60,60,60,0.8)"; ctx.strokeStyle = col; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(0, 0, s*0.35, 0, Math.PI*2); ctx.fill(); ctx.stroke();
        if(on){
          ctx.fillStyle=`rgba(${r},${g},${b},0.25)`;
          ctx.beginPath(); ctx.moveTo(-s*0.35, 0); ctx.lineTo(s*0.35, 0);
          ctx.lineTo(s*0.6, s*0.9); ctx.lineTo(-s*0.6, s*0.9); ctx.closePath(); ctx.fill();
        }
        break;
      }
      case "floor": {
        // Stehlampe: langer Stiel + Schirm oben
        ctx.strokeStyle="rgba(130,120,100,0.7)"; ctx.lineWidth=1.2;
        ctx.beginPath(); ctx.moveTo(0, s*0.8); ctx.lineTo(0, -s*0.3); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-s*0.1, s*0.8); ctx.lineTo(s*0.6, s*0.8); ctx.stroke(); // Fuß
        ctx.fillStyle="rgba(70,60,45,0.85)";
        ctx.beginPath(); ctx.moveTo(-s*0.55, -s*0.3); ctx.lineTo(s*0.55, -s*0.3);
        ctx.lineTo(s*0.3, -s*0.8); ctx.lineTo(-s*0.3, -s*0.8); ctx.closePath(); ctx.fill();
        if(on){ ctx.fillStyle=`rgba(${r},${g},${b},0.6)`;
          ctx.beginPath(); ctx.ellipse(0,-s*0.3,s*0.45,s*0.1,0,0,Math.PI*2); ctx.fill(); }
        break;
      }
      case "table": {
        // Tischlampe: kurzer Stiel + Schirm + Basis
        ctx.strokeStyle="rgba(130,120,100,0.7)"; ctx.lineWidth=1;
        ctx.beginPath(); ctx.moveTo(0, s*0.5); ctx.lineTo(0, 0); ctx.stroke();
        ctx.fillStyle="rgba(60,55,40,0.8)"; // Sockel
        ctx.fillRect(-s*0.3, s*0.4, s*0.6, s*0.2);
        ctx.fillStyle="rgba(80,65,45,0.85)";
        ctx.beginPath(); ctx.moveTo(-s*0.5, 0); ctx.lineTo(s*0.5, 0);
        ctx.lineTo(s*0.25, -s*0.6); ctx.lineTo(-s*0.25, -s*0.6); ctx.closePath(); ctx.fill();
        if(on){ ctx.fillStyle=`rgba(${r},${g},${b},0.5)`;
          ctx.beginPath(); ctx.ellipse(0,0,s*0.4,s*0.1,0,0,Math.PI*2); ctx.fill(); }
        break;
      }
      case "desk": {
        // Bürolampe: Schwenkarm
        ctx.strokeStyle="rgba(130,120,100,0.8)"; ctx.lineWidth=1.2;
        ctx.beginPath(); ctx.moveTo(-s*0.4, s*0.7); ctx.lineTo(-s*0.4, s*0.1);
        ctx.lineTo(s*0.1, -s*0.2); ctx.lineTo(s*0.4, -s*0.5); ctx.stroke();
        ctx.fillStyle="rgba(50,50,50,0.8)";
        ctx.beginPath(); ctx.ellipse(s*0.4,-s*0.5,s*0.32,s*0.18,Math.PI/4,0,Math.PI*2); ctx.fill();
        if(on){ ctx.fillStyle=`rgba(${r},${g},${b},0.6)`;
          ctx.beginPath(); ctx.arc(s*0.55,-s*0.7,s*0.25,0,Math.PI*2); ctx.fill(); }
        break;
      }
      case "strip": {
        // LED-Streifen: horizontaler Balken mit Punkten
        ctx.fillStyle="rgba(30,30,30,0.7)";
        ctx.fillRect(-s*0.9, -s*0.15, s*1.8, s*0.3);
        const ledCount=6;
        for(let i=0;i<ledCount;i++){
          const lx=-s*0.75+i*(s*1.5/(ledCount-1));
          ctx.fillStyle=on?`rgba(${r},${g},${b},0.9)`:"rgba(60,60,50,0.5)";
          if(on){ctx.shadowColor=`rgb(${r},${g},${b})`;ctx.shadowBlur=4;}
          ctx.beginPath(); ctx.arc(lx, 0, s*0.12, 0, Math.PI*2); ctx.fill();
          ctx.shadowBlur=0;
        }
        break;
      }
      case "neon": {
        // Neonröhre: langer heller Balken
        const nLen=s*1.8;
        if(on){
          ctx.shadowColor=`rgb(${r},${g},${b})`; ctx.shadowBlur=10;
          ctx.strokeStyle=`rgba(${r},${g},${b},0.95)`; ctx.lineWidth=s*0.3;
          ctx.lineCap="round";
          ctx.beginPath(); ctx.moveTo(-nLen/2, 0); ctx.lineTo(nLen/2, 0); ctx.stroke();
          ctx.shadowBlur=0; ctx.lineCap="butt";
          ctx.strokeStyle=`rgba(255,255,255,0.8)`; ctx.lineWidth=s*0.1;
          ctx.beginPath(); ctx.moveTo(-nLen/2, 0); ctx.lineTo(nLen/2, 0); ctx.stroke();
        } else {
          ctx.strokeStyle="rgba(100,100,100,0.4)"; ctx.lineWidth=s*0.2;
          ctx.beginPath(); ctx.moveTo(-nLen/2, 0); ctx.lineTo(nLen/2, 0); ctx.stroke();
        }
        break;
      }
      case "ceiling": {
        // Deckenleuchte: Flaches Rechteck
        ctx.fillStyle="rgba(60,60,50,0.8)";
        ctx.fillRect(-s*0.8, -s*0.2, s*1.6, s*0.4);
        if(on){
          ctx.fillStyle=`rgba(${r},${g},${b},0.7)`;
          ctx.beginPath(); ctx.ellipse(0, s*0.2, s*0.6, s*0.2, 0, 0, Math.PI*2); ctx.fill();
        }
        break;
      }
      case "chandelier": {
        // Kronleuchter: Mittelkörper + Arme + Kerzen
        ctx.strokeStyle="rgba(180,160,100,0.8)"; ctx.lineWidth=1;
        // Mittelstab
        ctx.beginPath(); ctx.moveTo(0,-s); ctx.lineTo(0,-s*0.2); ctx.stroke();
        // Arme
        for(let i=0;i<5;i++){
          const a=(i/5)*Math.PI*2-Math.PI/2;
          const ax=Math.cos(a)*s*0.6, ay=Math.sin(a)*s*0.6;
          ctx.beginPath(); ctx.moveTo(0,-s*0.2); ctx.lineTo(ax,ay-s*0.2); ctx.stroke();
          // Kerze
          ctx.fillStyle=on?`rgba(${r},${g},${b},0.9)`:"rgba(80,80,60,0.4)";
          ctx.fillRect(ax-s*0.07, ay-s*0.5, s*0.14, s*0.3);
          if(on){ ctx.fillStyle="rgba(255,220,100,0.9)";
            ctx.beginPath(); ctx.arc(ax, ay-s*0.5, s*0.1, 0, Math.PI*2); ctx.fill(); }
        }
        break;
      }
      case "wall": {
        // Wandleuchte: Halber Kegel
        ctx.fillStyle="rgba(70,60,45,0.8)";
        ctx.beginPath(); ctx.moveTo(-s*0.1,-s*0.5); ctx.lineTo(-s*0.1,s*0.5);
        ctx.lineTo(s*0.5,s*0.25); ctx.lineTo(s*0.5,-s*0.25); ctx.closePath(); ctx.fill();
        if(on){ ctx.fillStyle=`rgba(${r},${g},${b},0.5)`;
          ctx.beginPath(); ctx.moveTo(s*0.5,-s*0.25); ctx.lineTo(s*1.0, 0);
          ctx.lineTo(s*0.5,s*0.25); ctx.closePath(); ctx.fill(); }
        break;
      }
      default: {
        // Fallback: einfacher Punkt
        ctx.fillStyle=col; ctx.beginPath(); ctx.arc(0,0,s*0.4,0,Math.PI*2); ctx.fill();
      }
    }
    ctx.restore();
  }

  // ── 3D Energiefluss-Overlay ──────────────────────────────────────────────
  _drawEnergyOverlay3D(ctx, project, unitPx) {
    const isEdit    = this._mode === "energie";
    const lines     = isEdit ? (this._pendingEnergyLines||[]) : (this._data?.energy_lines||[]);
    const batteries = isEdit ? (this._pendingBatteries||[])   : (this._data?.batteries||[]);
    if (!lines.length && !batteries.length) return;

    const now = performance.now();
    const dt  = Math.min(50, now - (this._energyAnimTs3D || now));
    this._energyAnimTs3D = now;

    const typeMap = {};
    this._energieTypes().forEach(t => { typeMap[t.id] = t; });
    const wallH = Math.max(0.5, Math.min(6, this._wallHeight ?? 2.5));
    // Energy lines float at mid-wall height
    const EZ = wallH * 0.4;

    if (!this._energyParticles3D) this._energyParticles3D = [];

    lines.forEach((line, li) => {
      if (line.x1==null || line.x2==null) return;
      const typeConf = typeMap[line.type||"solar"] || typeMap.solar;
      const col = typeConf.color;
      const [rr,gg,bb] = col.replace("#","").match(/../g).map(h=>parseInt(h,16));

      // Live value & direction
      let value = 0;
      if (line.entity && this._hass?.states?.[line.entity]) {
        value = parseFloat(this._hass.states[line.entity].state) || 0;
      }
      const maxW = line.max_w || 5000;
      const absVal = Math.abs(value);
      const frac = Math.min(1, absVal / maxW);
      const isActive = absVal > 0.5;
      let forward = line.direction === "forward" ? true
                  : line.direction === "reverse" ? false
                  : value >= 0;

      // 3D projected endpoints
      const p1 = project(line.x1, line.y1, EZ);
      const p2 = project(line.x2, line.y2, EZ);

      // Base line
      const alpha3 = isActive ? 0.85 : 0.22;
      const lw3 = 2 + frac * 4;
      ctx.save();
      ctx.strokeStyle = `rgba(${rr},${gg},${bb},${alpha3})`;
      ctx.lineWidth = lw3; ctx.lineCap = "round";
      if (isActive) { ctx.shadowColor = col; ctx.shadowBlur = 6 + frac * 8; }
      ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.restore();

      // Arrow markers along line
      if (isActive) {
        const dx=p2.x-p1.x, dy=p2.y-p1.y;
        const len=Math.hypot(dx,dy);
        if (len > 20) {
          const nx=dx/len, ny=dy/len;
          const dir3 = forward ? 1 : -1;
          [0.33, 0.66].forEach(t => {
            const ax=p1.x+dx*t, ay=p1.y+dy*t;
            const ax2=ax+nx*6*dir3, ay2=ay+ny*6*dir3;
            ctx.save();
            ctx.strokeStyle=`rgba(${rr},${gg},${bb},0.7)`; ctx.lineWidth=lw3*0.7; ctx.lineCap="round";
            ctx.beginPath();
            ctx.moveTo(ax2-nx*6-ny*4, ay2-ny*6+nx*4);
            ctx.lineTo(ax2, ay2);
            ctx.lineTo(ax2-nx*6+ny*4, ay2-ny*6-nx*4);
            ctx.stroke(); ctx.restore();
          });
        }
      }

      // Particles
      if (isActive) {
        if (!this._energyParticles3D[li]) this._energyParticles3D[li] = [];
        const particles3 = this._energyParticles3D[li];
        const lineLen3 = Math.hypot(p2.x-p1.x, p2.y-p1.y);
        const speed3 = (25 + frac * 130) / Math.max(1, lineLen3);
        const dir3 = forward ? 1 : -1;
        particles3.forEach(p => {
          p.t += dt / 1000 * speed3 * dir3;
          if (p.t > 1) p.t -= 1;
          if (p.t < 0) p.t += 1;
        });
        const wanted3 = Math.min(12, Math.max(2, Math.ceil(lineLen3 / Math.max(18, lineLen3 / 7))));
        while (particles3.length < wanted3) particles3.push({ t: Math.random() });
        particles3.length = Math.min(particles3.length, wanted3);

        particles3.forEach(p => {
          const px3 = p1.x + (p2.x-p1.x)*p.t;
          const py3 = p1.y + (p2.y-p1.y)*p.t;
          // Also interpolate in 3D for slight arc
          const floorP = project(
            line.x1 + (line.x2-line.x1)*p.t,
            line.y1 + (line.y2-line.y1)*p.t,
            EZ
          );
          ctx.save();
          ctx.fillStyle="#fff";
          ctx.shadowColor=col; ctx.shadowBlur=10;
          ctx.beginPath(); ctx.arc(floorP.x, floorP.y, 2.5+frac*1.5, 0, Math.PI*2); ctx.fill();
          ctx.restore();
        });

        // Arrow at destination
        const ang3 = forward ? Math.atan2(p2.y-p1.y, p2.x-p1.x) : Math.atan2(p1.y-p2.y, p1.x-p2.x);
        const tip3 = forward ? p2 : p1;
        const asz3 = 7+frac*5;
        ctx.save(); ctx.fillStyle=col; ctx.shadowColor=col; ctx.shadowBlur=5;
        ctx.translate(tip3.x,tip3.y); ctx.rotate(ang3);
        ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(-asz3,-asz3*0.42); ctx.lineTo(-asz3,asz3*0.42);
        ctx.closePath(); ctx.fill(); ctx.restore();
      } else {
        if (this._energyParticles3D) this._energyParticles3D[li] = [];
      }

      // Endpoint dots (floating spheres)
      [p1, p2].forEach(pt => {
        ctx.save();
        ctx.fillStyle=col; ctx.strokeStyle="rgba(7,9,13,0.85)"; ctx.lineWidth=2;
        ctx.shadowColor=col; ctx.shadowBlur=6;
        ctx.beginPath(); ctx.arc(pt.x,pt.y,5,0,Math.PI*2); ctx.fill(); ctx.stroke();
        ctx.restore();
      });

      // Value label (mid)
      const midP = project(
        (line.x1+line.x2)/2, (line.y1+line.y2)/2, EZ+wallH*0.12
      );
      const valStr = isActive ? (Math.abs(value) >= 1000
        ? (Math.abs(value)/1000).toFixed(1)+"kW"
        : Math.round(Math.abs(value))+"W") : "";
      if (valStr) {
        ctx.save();
        ctx.fillStyle=`rgba(${rr},${gg},${bb},0.9)`;
        ctx.font="bold 8px 'JetBrains Mono',monospace";
        ctx.textAlign="center"; ctx.textBaseline="middle";
        ctx.shadowColor="rgba(0,0,0,0.8)"; ctx.shadowBlur=3;
        ctx.fillText(valStr, midP.x, midP.y);
        ctx.restore();
      }
    });
  }

  // ── 3D Lampen-Symbol ──────────────────────────────────────────────────────
  _drawLampSymbol3D(ctx, project, light, r, g, b, bri, wallH) {
    const type = light.lamp_type || "bulb";
    const mz = light.mz != null ? light.mz : wallH * 0.88;
    const lp = project(light.mx, light.my, mz);
    const on = light.on !== false;
    const s = 6 + bri * 3;

    ctx.save();
    ctx.translate(lp.x, lp.y);

    switch(type) {
      case "globe": {
        // Kugel: konzentrischer Ring
        ctx.strokeStyle=on?`rgba(${r},${g},${b},0.9)`:"rgba(80,80,70,0.4)"; ctx.lineWidth=1.5;
        ctx.fillStyle=on?`rgba(${r},${g},${b},0.2)`:"rgba(40,40,35,0.2)";
        ctx.beginPath(); ctx.arc(0,0,s*0.8,0,Math.PI*2); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(0,0,s*0.8,s*0.25,0,0,Math.PI*2); ctx.stroke();
        break;
      }
      case "pendant": {
        // Schirm + Lichtöffnung
        ctx.fillStyle="rgba(80,70,50,0.9)";
        ctx.beginPath(); ctx.moveTo(-s,-s*0.5); ctx.lineTo(s,-s*0.5);
        ctx.lineTo(s*0.5,s*0.3); ctx.lineTo(-s*0.5,s*0.3); ctx.closePath(); ctx.fill();
        if(on){ ctx.fillStyle=`rgba(${r},${g},${b},0.6)`;
          ctx.beginPath(); ctx.ellipse(0,s*0.3,s*0.4,s*0.15,0,0,Math.PI*2); ctx.fill(); }
        break;
      }
      case "strip": case "neon": {
        // Horizontaler Balken
        const nLen=s*2.5;
        if(on){
          ctx.shadowColor=`rgb(${r},${g},${b})`; ctx.shadowBlur=8;
          ctx.strokeStyle=`rgba(${r},${g},${b},0.9)`; ctx.lineWidth=s*0.4; ctx.lineCap="round";
          ctx.beginPath(); ctx.moveTo(-nLen/2,0); ctx.lineTo(nLen/2,0); ctx.stroke();
          ctx.shadowBlur=0; ctx.lineCap="butt";
          ctx.strokeStyle="rgba(255,255,255,0.7)"; ctx.lineWidth=s*0.1;
          ctx.beginPath(); ctx.moveTo(-nLen/2,0); ctx.lineTo(nLen/2,0); ctx.stroke();
        } else {
          ctx.strokeStyle="rgba(80,80,70,0.4)"; ctx.lineWidth=s*0.3;
          ctx.beginPath(); ctx.moveTo(-nLen/2,0); ctx.lineTo(nLen/2,0); ctx.stroke();
        }
        break;
      }
      case "ceiling": {
        // Flache Scheibe
        ctx.fillStyle="rgba(60,60,50,0.85)";
        ctx.beginPath(); ctx.ellipse(0,0,s*1.0,s*0.3,0,0,Math.PI*2); ctx.fill();
        if(on){ ctx.fillStyle=`rgba(${r},${g},${b},0.5)`;
          ctx.beginPath(); ctx.ellipse(0,s*0.3,s*0.6,s*0.2,0,0,Math.PI*2); ctx.fill(); }
        break;
      }
      case "chandelier": {
        // Kronleuchter mit Armen
        for(let i=0;i<5;i++){
          const a=(i/5)*Math.PI*2;
          const ax=Math.cos(a)*s*0.8, ay=Math.sin(a)*s*0.3;
          ctx.strokeStyle="rgba(180,160,100,0.7)"; ctx.lineWidth=0.8;
          ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(ax,ay); ctx.stroke();
          if(on){ ctx.fillStyle=`rgba(${r},${g},${b},0.8)`;
            ctx.beginPath(); ctx.arc(ax,ay,s*0.18,0,Math.PI*2); ctx.fill(); }
        }
        break;
      }
      case "spot": {
        // Spot: kleiner Kreis + Kegelmarkierung
        ctx.fillStyle="rgba(50,50,50,0.9)"; ctx.strokeStyle=on?`rgba(${r},${g},${b},0.8)`:"rgba(60,60,50,0.4)";
        ctx.lineWidth=1.2;
        ctx.beginPath(); ctx.arc(0,0,s*0.5,0,Math.PI*2); ctx.fill(); ctx.stroke();
        break;
      }
      default: {
        // bulb, table, floor, desk, wall → Glühbirne
        ctx.fillStyle=on?`rgba(255,255,255,0.9)`:"rgba(80,80,70,0.35)";
        ctx.strokeStyle=on?`rgba(${r},${g},${b},0.9)`:"rgba(60,60,50,0.4)"; ctx.lineWidth=1.5;
        ctx.beginPath(); ctx.arc(0,0,s*0.6,0,Math.PI*2); ctx.fill(); ctx.stroke();
        if(on){
          const g2=ctx.createRadialGradient(0,0,0,0,0,s*0.6);
          g2.addColorStop(0,"rgba(255,255,255,0.9)");
          g2.addColorStop(1,`rgba(${r},${g},${b},0)`);
          ctx.fillStyle=g2; ctx.beginPath(); ctx.arc(0,0,s*0.6,0,Math.PI*2); ctx.fill();
        }
      }
    }
    ctx.restore();
  }

  // Returns the room index for a light – prefers explicit room_id, falls back
  // to geometric containment check (5cm tolerance).
  _lightRoomIdx(light, rooms) {
    // 1. Explicit assignment (most reliable)
    if (light.room_id != null) {
      const ri = parseInt(light.room_id, 10);
      if (!isNaN(ri) && ri >= 0 && ri < rooms.length) return ri;
    }
    // 2. Geometric fallback with small tolerance
    const EPS = 0.05;
    return rooms.findIndex(r =>
      light.mx >= r.x1 - EPS && light.mx <= r.x2 + EPS &&
      light.my >= r.y1 - EPS && light.my <= r.y2 + EPS
    );
  }


  // ── Lights edit overlay (mode === "lights") ───────────────────────────────

  _drawLightsOverlay() {
    const ctx    = this._ctx;
    const lights = this._pendingLights;

    lights.forEach((light, idx) => {
      const pos = this._f2c(light.mx, light.my);
      const isSel = this._selLight === idx;

      // Outer ring
      ctx.save();
      ctx.strokeStyle = isSel ? "#facc15" : "rgba(255,220,80,0.8)";
      ctx.lineWidth   = isSel ? 2.5 : 1.5;
      ctx.setLineDash(isSel ? [] : [3, 2]);
      ctx.beginPath(); ctx.arc(pos.x, pos.y, 10, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();

      // Centre dot
      ctx.save();
      ctx.fillStyle = isSel ? "#facc15" : "rgba(255,220,80,0.9)";
      ctx.beginPath(); ctx.arc(pos.x, pos.y, 3.5, 0, Math.PI * 2); ctx.fill();
      ctx.restore();

      // Label
      ctx.save();
      ctx.font      = "bold 9px 'JetBrains Mono',monospace";
      ctx.fillStyle = "rgba(255,220,80,0.9)";
      ctx.textAlign = "center";
      ctx.fillText(light.name || `L${idx+1}`, pos.x, pos.y - 14);
      ctx.textAlign = "left";
      ctx.restore();
    });

    // Placing hint
    if (this._placingLight) {
      const ctx2 = this._ctx;
      const c    = this._canvas;
      ctx2.save();
      ctx2.fillStyle = "rgba(250,204,21,0.12)";
      ctx2.fillRect(0, 0, c.width, c.height);
      ctx2.font      = "bold 11px 'JetBrains Mono',monospace";
      ctx2.fillStyle = "rgba(250,204,21,0.9)";
      ctx2.textAlign = "center";
      ctx2.fillText("→ Klicke auf die Position der Leuchte", c.width / 2, 22);
      ctx2.textAlign = "left";
      ctx2.restore();
    }
  }

  // ── Tracked setTimeout (automatisches Cleanup in disconnectedCallback) ─────
  _setTimeout(fn, ms) {
    const id = setTimeout(() => {
      this._timeouts = (this._timeouts||[]).filter(x => x !== id);
      fn();
    }, ms);
    if (!this._timeouts) this._timeouts = [];
    this._timeouts.push(id);
    return id;
  }

  disconnectedCallback() {
    if (this._raf) { cancelAnimationFrame(this._raf); this._raf = null; }
    if (this._dekoAnimFrame) { cancelAnimationFrame(this._dekoAnimFrame); this._dekoAnimFrame = null; }
    if (this._alarmAnimFrame) { cancelAnimationFrame(this._alarmAnimFrame); this._alarmAnimFrame = null; }
    if (this._resizeObserver) { this._resizeObserver.disconnect(); this._resizeObserver = null; }
    window.removeEventListener("resize", this._onResize);
    if (this._optEvtHandler) window.removeEventListener("ble_positioning_set_opt", this._optEvtHandler);
    if (this._keydownHandler) document.removeEventListener("keydown", this._keydownHandler);
    document.removeEventListener("keyup", this._keyupHandler);
    // Alle gectrackten Timeouts clearen
    (this._timeouts || []).forEach(id => clearTimeout(id));
    this._timeouts = [];
    // Reset boot flag so re-insertion re-boots correctly
    this._hass = null;
    this._booted = false;
  }

  connectedCallback() {
    // Re-boot if card was previously disconnected and hass is re-supplied
    // (HA calls set hass again after connectedCallback, triggering _boot)
  }

  // ── Main draw ─────────────────────────────────────────────────────────────

  _draw() {
    const ctx  = this._ctx;
    const c    = this._canvas;
    if (!ctx || !c) return;
    // Schedule next frame if any alarm is active (for pulse animation)
    const hasActiveAlarm = (this._pendingAlarms?.length ? this._pendingAlarms : (this._data?.alarms||[])).some(al => {
      const s = this._hass?.states?.[al.entity]?.state || "";
      return ["on","true","1","triggered","motion","wet","smoke","detected"].includes(s.toLowerCase());
    });
    if (hasActiveAlarm && !this._alarmAnimFrame) {
      this._alarmAnimFrame = requestAnimationFrame(() => { this._alarmAnimFrame = null; this._draw(); });
    }
    // Kontinuierlicher RAF-Loop wenn animierte Deko-Elemente aktiv sind
    // (TV an, Speaker an, Waschmaschine läuft, Gartenlampe etc.)
    const ANIM_DEKO_TYPES = ["tv","speaker","washingmachine","dishwasher","gardenlight","pondpump","fireplace","sprinkler"];
    const decoList = this._pendingDecos?.length ? this._pendingDecos : (this._data?.decos||[]);
    const hasAnimDeko = decoList.some(d => {
      if (ANIM_DEKO_TYPES.includes(d.type)) {
        if (!d.entity) return true; // Immer animieren wenn kein Entity (Gartenlampe etc.)
        const st = this._hass?.states?.[d.entity]?.state?.toLowerCase()||"";
        return ["on","playing","running","active","heat","cool"].includes(st);
      }
      return false;
    });
    if (hasAnimDeko && !this._dekoAnimFrame) {
      this._dekoAnimFrame = requestAnimationFrame(() => { this._dekoAnimFrame = null; this._draw(); });
    }
    if (!this._data) {
      // Show loading state
      ctx.fillStyle = "#0d1219"; ctx.fillRect(0, 0, c.width, c.height);
      ctx.font = "12px 'JetBrains Mono',monospace"; ctx.fillStyle = "#445566";
      ctx.textAlign = "center"; ctx.fillText("Lade...", c.width/2, c.height/2);
      ctx.textAlign = "left";
      return;
    }
    const W = c.width, H = c.height;
    ctx.clearRect(0, 0, W, H);

    // ── 3D mode: skip all 2D drawing ─────────────────────────────────────
    if (this._mode === "view" && this._opts?.show3D) {
      this._draw3DScene(ctx,
        this._data?.rooms   || [],
        this._data?.doors   || [],
        this._data?.windows || [],
        this._data?.lights  || [],
        this._data?.devices || []);
      // Note: _drawEnergyOverlay3D is called from inside _draw3DScene (project is only defined there)
      this._drawDaytimeSunIcon(ctx, c.width, c.height);
      this._drawNightOverlay(ctx, c.width, c.height);
      return;
    }

    // Background
    if (this._bgLoaded) {
      const _ovAlpha = 0.65 - (this._imgOpacity??0.35)*0.5;
      const _z = (this._opts?.zoomPan && this._zoom && this._zoom !== 1);
      const _hasZoom = _z || (this._panX||0) !== 0 || (this._panY||0) !== 0;
      if (_hasZoom) {
        // Outside the floor area: fill black
        ctx.fillStyle = "#07090d";
        ctx.fillRect(0, 0, W, H);
        const tl = this._f2c(0, 0);
        const br = this._f2c(this._data?.floor_w || 10, this._data?.floor_h || 10);
        const imgW = br.x - tl.x, imgH = br.y - tl.y;
        // Draw bg image zoomed
        if (this._imgVisible !== false) {
          ctx.globalAlpha = this._imgOpacity ?? 0.35;
          ctx.drawImage(this._bgImg, tl.x, tl.y, imgW, imgH);
          ctx.globalAlpha = 1.0;
        }
        // Dark overlay only over floor area
        ctx.fillStyle = "rgba(7,9,13," + _ovAlpha + ")";
        ctx.fillRect(tl.x, tl.y, imgW, imgH);
      } else {
        // Normal (no zoom): full canvas
        if (this._imgVisible !== false) {
          ctx.globalAlpha = this._imgOpacity ?? 0.35;
          ctx.drawImage(this._bgImg, 0, 0, W, H);
          ctx.globalAlpha = 1.0;
        }
        ctx.fillStyle = "rgba(7,9,13," + _ovAlpha + ")";
        ctx.fillRect(0, 0, W, H);
      }
    } else {
      ctx.fillStyle = "#0d1219";
      ctx.fillRect(0, 0, W, H);
    }

    const mode = this._mode;
    const rooms    = mode === "rooms"    ? this._pendingRooms    : (this._data.rooms    || []);
    const scanners = mode === "scanners" ? this._pendingScanners : (this._data.scanners || []);

    // unitPx2d für Textur-Skalierung: Pixel pro Meter im 2D-Canvas
    const fw2d = this._data?.floor_w || 10;
    this._unitPx2d = this._canvas.width / fw2d;

    this._checkNightMode();
    this._drawRooms(rooms);
    this._drawGrid();
    this._drawScanners(scanners);

    // Draw light glows BEFORE devices (they are part of the room layer)
    const lightsData = mode === "lights"
      ? this._pendingLights.map(l => ({...l, on: true, brightness: 200, rgb: null}))
      : (this._data.lights || []);
    this._drawLights(lightsData);

    if (mode === "view" || mode === "journey") {
      this._updateDeviceTrails();
      if (mode === "journey" && this._journeyActive) {
        this._drawJourneySnapshot();
      } else {
        if (this._opts?.showDevices !== false) this._drawDevices();
        this._collectJourneySnapshot();
      }
    }
    this._drawDoors();
    this._drawWindows();
    // mmWave sensor overlay (targets + FOV + heatmap)
    // Im mmwave-Editor-Tab: immer anzeigen; sonst nur wenn Option aktiv
    if (this._opts?.showMmwave || mode === "mmwave") this._drawMmwaveOverlay();
    // Fall alarm overlay (always on top when active)
    if (this._opts?.mmwaveFallDetect) this._drawFallAlarmOverlay();
    // Analytics tick (background data collection)
    this._analyticsTick();
    // Sleep overlay
    if (this._opts?.showSleep) this._drawSleepOverlay();
    // Multi-sensor fusion overlay
    if (this._opts?.mmwaveFusion && this._opts?.showMmwave) {
      const fused = this._mmwaveFuseTargets();
      this._drawMmwaveFusionOverlay(fused);
    }
    // Compare mode overlay
    if (this._opts?.showCompare) this._drawCompareMode();
    // Emergency button
    this._renderEmergencyButton();
    // PTZ Tracking tick + overlay
    if (this._opts?.ptzTracking) { this._ptzTick(); this._drawPtzOverlay(); }
    // During training: refresh sidebar every second
    if (this._mmwaveTrain && this._mmwaveTrain.phase==="collecting") {
      const now = Date.now();
      if (!this._lastTrainSidebarRefresh || now-this._lastTrainSidebarRefresh > 800) {
        this._lastTrainSidebarRefresh = now;
        if (this._mode==="mmwave") this._rebuildSidebar();
      }
    }
    // Room temperatures
    if (this._opts?.showRoomTemp) this._drawRoomTemperatures();
    // Room occupancy counter (persons per room)
    if (this._opts?.showMmwave !== false) this._drawRoomOccupancy();
    // Heatmap overlay
    if (this._opts?.showHeatmap) { this._updateHeatmap(); this._drawHeatmapOverlay(); }
    // Heating plan
    if (this._opts?.showHeating) this._drawHeatingOverlay();
    // Info sensors overlay (all modes)
    if (this._pendingInfoSensors?.length && this._opts?.showInfoOverlay !== false) this._drawInfoOverlay();
    // Energy lines + batteries
    if (this._opts?.showEnergy !== false) this._drawEnergyOverlay();
    // Deco elements (2D)
    if (this._mode !== 'deko') this._drawDecos(this._data?.decos || []);
    else this._drawDecos(this._pendingDecos, true);
    // Presence overlay (green glow per room)
    if (this._opts?.showPresence) this._drawPresenceOverlay();
    // Geofence check (fires toasts on room enter/leave)
    if (this._opts?.showGeofence) this._checkGeofence();
    // Camera overlay
    if (this._opts?.showCamera) this._drawCameraOverlay();
    // Raum-Verlauf (enhanced heatmap blue→red)
    if (this._opts?.showRaumVerlauf) { this._updateHeatmap(); this._drawRaumVerlaufOverlay(); }
    // Energy-Room correlation overlay
    if (this._opts?.energyRoomCorr) this._drawEnergyRoomOverlay(this._ctx);
    // Alarm overlay
    if (this._opts?.showAlarmOverlay !== false || mode === "alarm") this._drawAlarmOverlay();
    // Alarm edit overlay (placement/config)
    if (mode === "alarm") this._drawAlarmEditOverlay();
    if (mode === "calibrate")  this._drawCalibrationOverlay();
    if (mode === "rooms")      this._drawRoomDrawingOverlay();
    if (mode === "scanners")   this._drawScannerOverlay();
    if (mode === "lights")     this._drawLightsOverlay();
    this._drawNightOverlay(this._ctx, this._canvas.width / (window.devicePixelRatio||1), this._canvas.height / (window.devicePixelRatio||1));
  }


  // ══════════════════════════════════════════════════════════════════════════
  // ── NIGHT OVERLAY ─────────────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════
  _drawNightOverlay(ctx, W, H) {
    if (!this._opts?.nightMode || !this._isNightMode) return;
    // Dark blue-tinted overlay simulating night atmosphere
    const hour = new Date().getHours() + new Date().getMinutes() / 60;
    // Transition: dusk 19-21h, full night 21-5h, dawn 5-7h
    let alpha = 0;
    if (hour >= 21 || hour < 5) alpha = 0.45;
    else if (hour >= 19) alpha = 0.45 * ((hour - 19) / 2);
    else if (hour < 7)   alpha = 0.45 * (1 - (hour - 5) / 2);
    if (alpha < 0.01) return;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "rgba(5,10,40,1)";
    ctx.fillRect(0, 0, W, H);

    // Stars (random but stable)
    ctx.globalAlpha = alpha * 0.7;
    ctx.fillStyle = "#ffffff";
    const starSeed = 12345;
    for (let i = 0; i < 60; i++) {
      const sx = ((starSeed * (i * 2654435761 + 1)) % 9999) / 9999 * W;
      const sy = ((starSeed * (i * 2246822519 + 7)) % 9999) / 9999 * (H * 0.45);
      const sr = 0.5 + ((starSeed * (i * 1234567 + 3)) % 100) / 100;
      const twinkle = 0.4 + 0.6 * Math.abs(Math.sin(Date.now() / 1500 + i * 0.7));
      ctx.globalAlpha = alpha * twinkle * 0.6;
      ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.fill();
    }

    // Moon icon
    ctx.globalAlpha = alpha * 0.9;
    ctx.font = `${14 + alpha * 6}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText("🌙", W * 0.87, H * 0.04);

    // Bottom glow: warm street-light tint at horizon
    const grad = ctx.createLinearGradient(0, H * 0.6, 0, H);
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(1, `rgba(40,20,5,${alpha * 0.3})`);
    ctx.globalAlpha = 1;
    ctx.fillStyle = grad;
    ctx.fillRect(0, H * 0.6, W, H * 0.4);
    ctx.restore();
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ── SHADOW SIMULATION (3D) ────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════
  _drawShadows3D(ctx, rooms, project, unitPx) {
    if (!this._opts?.shadowSim || !this._opts?.showDayTime) return;
    const dt = this._getDaytimeConfig();
    if (!dt.isDay || dt.elevation < 0.05) return;

    const wallH = Math.max(0.5, Math.min(6, this._wallHeight ?? 2.5));
    // Sun direction: azimuth from getDaytimeConfig + user 3D azimuth offset
    const sunAz  = dt.azimuth;       // 0=E, PI=W
    const sunEl  = dt.elevation;     // 0=flat, 1=zenith
    // Shadow length: shorter at high sun, longer at low sun
    const shadowLen = wallH * (1 - sunEl * 0.8) / Math.tan(Math.max(0.1, sunEl)) * 0.6;

    // Shadow direction in floor-space (opposite of sun direction)
    const sdx = -Math.cos(sunAz) * shadowLen;
    const sdy = -Math.sin(sunAz) * shadowLen;

    ctx.save();
    ctx.globalAlpha = 0.25 * (1 - sunEl * 0.6);

    rooms.forEach(room => {
      if (room.zone_type === "outdoor") return;
      const {x1,y1,x2,y2} = room;
      const wallH3D = wallH;

      // For each exterior wall: project shadow polygon
      const walls = [
        { pts: [[x1,y1],[x2,y1]], nx: 0, ny: -1 },  // front
        { pts: [[x2,y1],[x2,y2]], nx: 1, ny:  0 },  // right
        { pts: [[x2,y2],[x1,y2]], nx: 0, ny:  1 },  // back
        { pts: [[x1,y2],[x1,y1]], nx: -1, ny: 0 },  // left
      ];
      walls.forEach(wall => {
        // Only cast shadow if wall faces away from sun
        const facingSun = wall.nx * Math.cos(sunAz) + wall.ny * Math.sin(sunAz);
        if (facingSun > 0) return; // facing sun = no shadow cast outward

        const [a, b] = wall.pts;
        const pa0 = project(a[0], a[1], 0);
        const pb0 = project(b[0], b[1], 0);
        const pa1 = project(a[0] + sdx, a[1] + sdy, 0);
        const pb1 = project(b[0] + sdx, b[1] + sdy, 0);

        ctx.fillStyle = "rgba(0,0,0,1)";
        ctx.beginPath();
        ctx.moveTo(pa0.x, pa0.y);
        ctx.lineTo(pb0.x, pb0.y);
        ctx.lineTo(pb1.x, pb1.y);
        ctx.lineTo(pa1.x, pa1.y);
        ctx.closePath();
        ctx.fill();
      });
    });
    ctx.restore();
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ── FLOOR OVERLAY 3D (Multi-Etagen Überlagerung) ──────────────────────────
  // ══════════════════════════════════════════════════════════════════════════
  _drawFloorOverlay3D(ctx, project, unitPx) {
    if (!this._opts?.floorOverlay) return;
    const floors = this._floors || [];
    if (floors.length < 2) return;
    const activeIdx = this._activeFloor ?? 0;

    floors.forEach((floor, fi) => {
      if (fi === activeIdx) return; // skip active floor
      const rooms = floor.rooms || [];
      if (!rooms.length) return;

      // Vertical offset: each floor is wallH meters above previous
      const wallH = Math.max(0.5, Math.min(6, this._wallHeight ?? 2.5));
      const zOffset = (fi - activeIdx) * (wallH + 0.3); // spacing between floors

      ctx.save();
      ctx.globalAlpha = 0.25; // semi-transparent ghost

      rooms.forEach(room => {
        const {x1,y1,x2,y2,color} = room;
        const corners = [[x1,y1],[x2,y1],[x2,y2],[x1,y2]];
        const fp = corners.map(([x,y]) => project(x, y, zOffset));
        const tp = corners.map(([x,y]) => project(x, y, zOffset + wallH));

        // Floor outline
        ctx.strokeStyle = color || "#64748b";
        ctx.lineWidth = 0.8;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        fp.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
        ctx.closePath(); ctx.stroke();
        ctx.setLineDash([]);

        // Ghost fill
        ctx.fillStyle = color || "#334155";
        ctx.globalAlpha = 0.08;
        ctx.beginPath();
        fp.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
        ctx.closePath(); ctx.fill();
        ctx.globalAlpha = 0.25;

        // Ceiling outline  
        ctx.setLineDash([2, 4]);
        ctx.beginPath();
        tp.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
        ctx.closePath(); ctx.stroke();
        ctx.setLineDash([]);
      });

      // Floor label
      const floorLabel = project(
        (floors[fi].floor_w || 10) / 2,
        -0.5,
        zOffset + wallH * 0.5
      );
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = "#94a3b8";
      ctx.font = "bold 8px 'JetBrains Mono',monospace";
      ctx.textAlign = "center";
      ctx.fillText(floor.name || `Etage ${fi}`, floorLabel.x, floorLabel.y);
      ctx.restore();
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ── ENERGIE-RAUM-KORRELATION ──────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════
  _updateEnergyRoomCorrelation() {
    if (!this._opts?.energyRoomCorr) return;
    const devices = this._data?.devices || [];
    const rooms   = this._data?.rooms   || [];
    const energyLines = this._pendingEnergyLines || [];

    // Collect energy entities from lines
    const energyEntities = energyLines
      .filter(l => l.entity_id)
      .map(l => ({
        id: l.entity_id,
        label: l.name || l.entity_id,
        wh: parseFloat(this._hass?.states?.[l.entity_id]?.state || 0)
      }));

    if (!energyEntities.length) return;

    // Sum up presence minutes per room (from heatmap data)
    const totalMinutes = Object.values(this._heatmapData || {}).reduce((s,v) => s + (v||0), 0) || 1;

    rooms.forEach(room => {
      const roomMinutes = this._heatmapData?.[room.name] || 0;
      const share = roomMinutes / totalMinutes;
      if (!this._energyRoomData[room.name]) {
        this._energyRoomData[room.name] = { wh: 0, share: 0, minutes: 0 };
      }
      this._energyRoomData[room.name].share = share;
      this._energyRoomData[room.name].minutes = roomMinutes;
      // Distribute total energy proportionally
      const totalWh = energyEntities.reduce((s, e) => s + e.wh, 0);
      this._energyRoomData[room.name].wh = totalWh * share;
    });
  }

  _drawEnergyRoomOverlay(ctx) {
    if (!this._opts?.energyRoomCorr) return;
    this._updateEnergyRoomCorrelation();
    const rooms = this._data?.rooms || [];
    if (!rooms.length) return;

    const maxWh = Math.max(...Object.values(this._energyRoomData).map(r => r.wh || 0), 0.01);

    rooms.forEach(room => {
      const data = this._energyRoomData[room.name];
      if (!data || data.wh < 0.001) return;

      const intensity = data.wh / maxWh;
      // Color: low=blue, mid=yellow, high=red (energy gradient)
      const r = Math.round(intensity > 0.5 ? 255 : intensity * 2 * 255);
      const g = Math.round(intensity < 0.5 ? intensity * 2 * 200 : (1 - intensity) * 2 * 200);
      const b = Math.round(intensity < 0.5 ? 255 * (1 - intensity * 2) : 0);

      const tl = this._f2c(room.x1, room.y1);
      const br = this._f2c(room.x2, room.y2);
      const rw = br.x - tl.x, rh = br.y - tl.y;

      // Fill room with energy tint
      ctx.save();
      ctx.globalAlpha = 0.25 * intensity;
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(tl.x, tl.y, rw, rh);
      ctx.globalAlpha = 1;

      // Label: kWh value
      const cx = (tl.x + br.x) / 2;
      const cy = (tl.y + br.y) / 2;
      const kwh = (data.wh / 1000).toFixed(2);
      const wh = data.wh < 100 ? data.wh.toFixed(0) + "Wh" : (data.wh / 1000).toFixed(2) + "kWh";

      ctx.fillStyle = `rgba(${r},${g},${b},0.9)`;
      ctx.font = "bold 9px 'JetBrains Mono',monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowColor = "rgba(0,0,0,0.8)";
      ctx.shadowBlur = 3;
      ctx.fillText("⚡ " + wh, cx, cy + rh * 0.25);
      ctx.shadowBlur = 0;

      // Mini bar
      const barW = rw * 0.5, barH = 3;
      const barX = cx - barW / 2, barY = cy + rh * 0.35;
      ctx.fillStyle = "rgba(0,0,0,0.4)";
      ctx.fillRect(barX, barY, barW, barH);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(barX, barY, barW * intensity, barH);
      ctx.restore();
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ── PRESENCE OVERLAY ──────────────────────────────────────────────────────
  // ═════════════════════════════════════════════════════════════════════════════

  _drawPresenceOverlay() {
    if (!this._data) return;
    const ctx   = this._ctx;
    const rooms = this._data.rooms || [];
    const devs  = this._data.devices || [];

    rooms.forEach(room => {
      const inRoom = devs.some(d => d.room === (room.name || room.id));
      const c1 = this._f2c(room.x1, room.y1);
      const c2 = this._f2c(room.x2, room.y2);
      const cx = (c1.x+c2.x)/2, cy = (c1.y+c2.y)/2;
      const rw = c2.x-c1.x, rh = c2.y-c1.y;

      if (inRoom) {
        // Green glow
        const grd = ctx.createRadialGradient(cx,cy,0,cx,cy,Math.max(rw,rh)/2);
        grd.addColorStop(0,   "rgba(0,255,120,0.18)");
        grd.addColorStop(0.6, "rgba(0,255,120,0.07)");
        grd.addColorStop(1,   "rgba(0,255,120,0)");
        ctx.save();
        ctx.fillStyle = grd;
        ctx.fillRect(c1.x,c1.y,rw,rh);
        // Person icon
        ctx.font = "bold 11px 'JetBrains Mono',monospace";
        ctx.fillStyle = "rgba(0,255,120,0.9)";
        ctx.textAlign = "center";
        ctx.fillText("👁", cx, cy + rh/2 - 8);
        ctx.textAlign = "left";
        ctx.restore();
      } else {
        // Gray dim overlay for empty rooms
        ctx.save();
        ctx.fillStyle = "rgba(100,120,140,0.04)";
        ctx.fillRect(c1.x,c1.y,rw,rh);
        ctx.restore();
      }
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ── GEOFENCE ALARM ────────────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════

  _checkGeofence() {
    if (!this._data) return;
    const devs  = this._data.devices || [];
    if (!this._geofencePrev) this._geofencePrev = {};

    devs.forEach(d => {
      const id   = d.device_id || d.name;
      const room = d.room || null;
      const prev = this._geofencePrev[id];
      if (prev !== undefined && prev !== room) {
        if (room)  this._showToast("🔔 " + (d.name||id) + " → " + room, 4000);
        if (prev)  this._showToast("🚪 " + (d.name||id) + " ← " + prev, 3000);
      }
      this._geofencePrev[id] = room;
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ── RAUM-VERLAUF (enhanced heatmap blau→rot) ──────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════

  _drawRaumVerlaufOverlay() {
    if (!this._data) return;
    const ctx   = this._ctx;
    const rooms = this._data.rooms || [];
    const now   = Date.now();
    const DAY   = 86400000;

    rooms.forEach(room => {
      const key    = room.name || (room.x1+","+room.y1);
      const events = this._heatmapData[key] || [];
      if (!events.length) return;

      // Count minutes present in last 24h
      const mins = events.reduce((s,ev) => {
        const age = (now - ev.ts) / DAY;
        return s + (age < 1 ? Math.max(0, 1-age) : 0);
      }, 0) * 24;

      if (mins < 0.1) return;
      const t = Math.min(1, mins / 120); // 0=0min, 1=2h+

      // Blue (cold) → Cyan → Green → Yellow → Red (hot)
      let r,g,b;
      if      (t < 0.25) { const u=t/0.25;    r=0;            g=Math.round(u*200);   b=255; }
      else if (t < 0.5)  { const u=(t-0.25)/0.25; r=0;        g=200;                 b=Math.round(255*(1-u)); }
      else if (t < 0.75) { const u=(t-0.5)/0.25;  r=Math.round(u*255); g=200;        b=0; }
      else               { const u=(t-0.75)/0.25; r=255;       g=Math.round(200*(1-u)); b=0; }

      const c1 = this._f2c(room.x1, room.y1);
      const c2 = this._f2c(room.x2, room.y2);
      const cx = (c1.x+c2.x)/2, cy = (c1.y+c2.y)/2;
      const rw = c2.x-c1.x, rh = c2.y-c1.y;

      if (!isFinite(cx)||!isFinite(cy)) return;
      const grd = ctx.createRadialGradient(cx,cy,0,cx,cy,Math.max(rw,rh)*0.6);
      grd.addColorStop(0,   "rgba("+r+","+g+","+b+",0.45)");
      grd.addColorStop(0.7, "rgba("+r+","+g+","+b+",0.18)");
      grd.addColorStop(1,   "rgba("+r+","+g+","+b+",0)");
      ctx.save();
      ctx.fillStyle = grd;
      ctx.fillRect(c1.x,c1.y,rw,rh);
      // Time label
      const label = mins < 60 ? Math.round(mins)+"min" : (mins/60).toFixed(1)+"h";
      ctx.font = "bold 9px 'JetBrains Mono',monospace";
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.textAlign = "center";
      ctx.fillText("⏱ "+label, cx, cy - rh/2 + 14);
      ctx.textAlign = "left";
      ctx.restore();
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ── CAMERA OVERLAY ────────────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════

  _drawCameraOverlay() {
    if (!this._data) return;
    const ctx    = this._ctx;
    const lights = this._data.lights || [];

    lights.forEach(light => {
      if (!light.camera) return;
      const pos  = this._f2c(light.x ?? light.mx ?? 0, light.y ?? light.my ?? 0);
      if (!isFinite(pos.x)||!isFinite(pos.y)) return;
      const angle = (light.camera_angle ?? 90) * Math.PI / 180;
      const dir   = (light.camera_dir   ?? 0)  * Math.PI / 180;
      const range = Math.max(20, ((light.camera_range ?? 3) / (this._data.floor_w||10)) * this._canvas.width * 0.3);

      ctx.save();
      // Sichtfeld
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
      ctx.arc(pos.x, pos.y, range, dir - angle/2, dir + angle/2);
      ctx.closePath();
      ctx.fillStyle   = "rgba(255,50,50,0.12)";
      ctx.strokeStyle = "rgba(255,80,80,0.5)";
      ctx.lineWidth   = 1;
      ctx.fill(); ctx.stroke();
      // Camera icon
      ctx.font = "10px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("📷", pos.x, pos.y - 6);
      // Red recording dot
      ctx.beginPath();
      ctx.arc(pos.x + 7, pos.y - 10, 3, 0, Math.PI*2);
      ctx.fillStyle = (Date.now()%1200 < 600) ? "#ff3333" : "#881111";
      ctx.fill();
      ctx.restore();
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ── DAYLIGHT / SUNPATH (3D) ───────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════

  _getDaytimeConfig() {
    const now  = new Date();
    const h    = now.getHours() + now.getMinutes()/60;
    // Simplified sun elevation: 0 at midnight, peak at noon
    const elev = Math.sin(((h - 6) / 12) * Math.PI);  // 0→1→0 from 6am to 6pm
    const azim = ((h - 6) / 12) * Math.PI;             // E to W across sky
    return { hour: h, elevation: Math.max(0, elev), azimuth: azim,
             isDay: h >= 6 && h <= 20 };
  }

  _drawDaytimeSunIcon(ctx, W, H) {
    if (!this._opts?.showDayTime) return;
    const dt   = this._getDaytimeConfig();
    if (!dt.isDay) return;
    // Sun position across top of canvas
    const sx   = W * (dt.azimuth / Math.PI);
    const sy   = H * 0.08 + (1-dt.elevation) * H * 0.05;
    const size = 14 + dt.elevation * 8;
    const alpha= 0.4 + dt.elevation * 0.5;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = size+"px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("☀", sx, sy);
    // Time label
    const hh = Math.floor(dt.hour).toString().padStart(2,"0");
    const mm = Math.floor((dt.hour%1)*60).toString().padStart(2,"0");
    ctx.font = "bold 8px 'JetBrains Mono',monospace";
    ctx.fillStyle = "rgba(255,220,100,0.8)";
    ctx.fillText(hh+":"+mm, sx, sy+14);
    ctx.restore();
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ── REISE / JOURNEY SIDEBAR ───────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════

  _sidebarJourney() {
    const wrap = document.createElement("div");
    wrap.style.cssText = "padding:8px;display:flex;flex-direction:column;gap:6px";

    const hdr = document.createElement("div");
    hdr.style.cssText = "font-size:10px;font-weight:700;color:#94a3b8;letter-spacing:1px;margin-bottom:2px";
    hdr.textContent = "⏮ ZEITREISE";
    wrap.appendChild(hdr);

    // Info
    const info = document.createElement("div");
    info.style.cssText = "font-size:9px;color:var(--muted);line-height:1.4;padding:6px 8px;background:var(--surf2);border-radius:6px;border:1px solid var(--border)";
    info.textContent = "Snapshots werden automatisch alle 10s gesammelt (7 Tage). Nutze den Slider um in der Zeit zurückzugehen.";
    wrap.appendChild(info);

    // Snapshot count
    const count = (this._journeySnapshots||[]).length;
    const countEl = document.createElement("div");
    countEl.style.cssText = "font-size:9px;color:#00e5ff;padding:4px 8px;background:var(--surf2);border-radius:6px";
    const snap0 = (this._journeySnapshots||[])[count-1];
    const devCount  = snap0?.devices?.length ?? 0;
    const mmwCount  = snap0?.mmwavePersons?.length ?? 0;
    const liCount   = snap0?.lights?.length ?? 0;
    const doCount   = snap0?.doors?.length ?? 0;
    const wiCount   = snap0?.windows?.length ?? 0;
    countEl.innerHTML =
      `<b style="color:#00e5ff">📦 ${count} Snapshots</b> · ${count>0?Math.round(count/6):"0"} min<br>` +
      `<span style="color:#445566;font-size:8px">` +
      `📱${devCount} BLE &nbsp; 👤${mmwCount} mmWave &nbsp; 💡${liCount} Licht &nbsp; 🚪${doCount} Türen &nbsp; 🪟${wiCount} Fenster` +
      `</span>`;
    wrap.appendChild(countEl);

    // Legende
    const legend = document.createElement("div");
    legend.style.cssText = "font-size:8px;color:#445566;padding:5px 7px;background:#07090d;border-radius:5px;line-height:1.8;border:1px solid #1c2535";
    legend.innerHTML =
      `<span style="color:#00b4cc">●</span> BLE-Gerät &nbsp;` +
      `<span style="color:#f59e0b">●</span> mmWave-Person &nbsp;` +
      `<span style="color:#ffd700">●</span> Licht an<br>` +
      `<span style="color:#a78bfa">—</span> Tür zu &nbsp;` +
      `<span style="color:#f59e0b">- -</span> Tür offen &nbsp;` +
      `<span style="color:#38bdf8">- -</span> Fenster`;
    wrap.appendChild(legend);

    if (count === 0) {
      const empty = document.createElement("div");
      empty.style.cssText = "font-size:9px;color:var(--muted);text-align:center;padding:12px";
      empty.textContent = "Noch keine Daten – warte 10s...";
      wrap.appendChild(empty);
      return wrap;
    }

    // Time slider
    const sliderBox = document.createElement("div");
    sliderBox.style.cssText = "display:flex;flex-direction:column;gap:4px;padding:6px 8px;background:var(--surf2);border-radius:6px;border:1px solid var(--border)";

    const sliderLbl = document.createElement("div");
    sliderLbl.style.cssText = "font-size:9px;font-weight:700;color:var(--text)";
    sliderLbl.textContent = "Zeitpunkt";

    const slider = document.createElement("input");
    slider.type="range"; slider.min=0; slider.max=Math.max(0,count-1);
    slider.value = this._journeyIdx ?? count-1;
    slider.style.cssText = "width:100%;accent-color:#00e5ff";

    const timeLbl = document.createElement("div");
    timeLbl.style.cssText = "font-size:8px;color:#00e5ff;text-align:center";
    const snap = (this._journeySnapshots||[])[this._journeyIdx ?? count-1];
    timeLbl.textContent = snap ? new Date(snap.ts).toLocaleString("de-DE") : "–";

    slider.oninput = () => {
      this._journeyIdx = parseInt(slider.value);
      const s = (this._journeySnapshots||[])[this._journeyIdx];
      timeLbl.textContent = s ? new Date(s.ts).toLocaleString("de-DE") : "–";
      this._journeyActive = true;
      this._draw();
    };

    sliderBox.append(sliderLbl, slider, timeLbl);
    wrap.appendChild(sliderBox);

    // Play controls
    const ctrlRow = document.createElement("div");
    ctrlRow.style.cssText = "display:flex;gap:4px";

    const mkBtn = (label, title, fn) => {
      const b = document.createElement("button");
      b.className = "btn btn-outline";
      b.style.cssText = "flex:1;font-size:11px;padding:4px";
      b.textContent = label; b.title=title;
      b.onclick = fn; return b;
    };

    const btnPlay   = mkBtn("▶", "Play", () => this._journeyPlay(slider, timeLbl));
    const btnPause  = mkBtn("⏸", "Pause", () => { this._journeyPaused = true; });
    const btnFast   = mkBtn("⏭", "Schnellvorlauf ×4", () => this._journeyPlay(slider, timeLbl, 4));
    const btnLive   = mkBtn("⌖ LIVE", "Zurück zu Live", () => {
      this._journeyActive = false;
      this._journeyPaused = true;
      this._setMode("view");
    });
    ctrlRow.append(btnPlay, btnPause, btnFast, btnLive);
    wrap.appendChild(ctrlRow);

    // Ghost trail toggle
    const ghostRow = document.createElement("div");
    ghostRow.style.cssText = "display:flex;align-items:center;gap:8px;padding:6px 8px;background:var(--surf2);border-radius:6px;border:1px solid var(--border);cursor:pointer";
    const ghostIsOn = this._opts?.journeyGhostTrail ?? true;
    ghostRow.innerHTML = '<div style="font-size:9px;font-weight:700;color:var(--text);flex:1">👻 Ghost-Trail anzeigen</div>';
    const gToggle = document.createElement("div");
    gToggle.style.cssText = "width:28px;height:16px;border-radius:8px;background:"+(ghostIsOn?"#00e5ff":"#334155")+";position:relative;transition:background 0.2s";
    const gKnob = document.createElement("div");
    gKnob.style.cssText = "position:absolute;top:2px;left:"+(ghostIsOn?"14px":"2px")+";width:12px;height:12px;border-radius:50%;background:#fff;transition:left 0.2s";
    gToggle.appendChild(gKnob);
    ghostRow.appendChild(gToggle);
    ghostRow.onclick = () => {
      if (!this._opts) this._opts={};
      this._opts.journeyGhostTrail = !this._opts.journeyGhostTrail;
      this._draw();
      this._rebuildSidebar();
    };
    wrap.appendChild(ghostRow);

    return wrap;
  }

  _journeyPlay(slider, timeLbl, speed=1) {
    this._journeyPaused = false;
    const count = (this._journeySnapshots||[]).length;
    if (!count) return;
    const step = () => {
      if (this._journeyPaused) return;
      this._journeyIdx = (this._journeyIdx ?? 0) + 1;
      if (this._journeyIdx >= count) { this._journeyIdx = count-1; this._journeyPaused=true; return; }
      slider.value = this._journeyIdx;
      const s = (this._journeySnapshots||[])[this._journeyIdx];
      if(timeLbl) timeLbl.textContent = s ? new Date(s.ts).toLocaleString("de-DE") : "–";
      this._journeyActive = true;
      this._draw();
      this._setTimeout(step, 300/speed);
    };
    step();
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ── SNAPSHOT COLLECTION (called in loop) ──────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════

  _drawJourneySnapshot() {
    const idx  = this._journeyIdx ?? 0;
    const snap = (this._journeySnapshots||[])[idx];
    if (!snap) return;
    const ctx = this._ctx;

    // ── Lichter ──────────────────────────────────────────────────
    (snap.lights||[]).forEach(l => {
      if (l.x == null || l.y == null) return;
      const pos = this._f2c(l.x, l.y);
      if (!isFinite(pos.x)||!isFinite(pos.y)) return;
      ctx.save();
      const col = l.on ? (l.color||"#ffd700") : "#334155";
      const alpha = l.on ? (l.brightness != null ? 0.3 + (l.brightness/255)*0.65 : 0.75) : 0.25;
      ctx.globalAlpha = alpha;
      // Lichtkegel / Glow
      if (l.on) {
        const grad = ctx.createRadialGradient(pos.x,pos.y,2,pos.x,pos.y,28);
        grad.addColorStop(0, col+"cc");
        grad.addColorStop(1, col+"00");
        ctx.beginPath(); ctx.arc(pos.x,pos.y,28,0,Math.PI*2);
        ctx.fillStyle = grad; ctx.fill();
      }
      ctx.globalAlpha = l.on ? 1 : 0.4;
      ctx.beginPath(); ctx.arc(pos.x,pos.y,5,0,Math.PI*2);
      ctx.fillStyle = col;
      ctx.strokeStyle = l.on ? "#fff" : "#445566";
      ctx.lineWidth = 1.2;
      ctx.fill(); ctx.stroke();
      ctx.restore();
    });

    // ── Türen (farbig je Zustand) ─────────────────────────────
    (snap.doors||[]).forEach(d => {
      const c1=this._f2c(d.x1,d.y1), c2=this._f2c(d.x2,d.y2);
      ctx.save();
      ctx.strokeStyle = d.open === true ? "#f59e0b" : d.open === false ? "#a78bfa" : "#a78bfa";
      ctx.lineWidth   = d.open ? 4 : 2.5;
      ctx.setLineDash(d.open ? [6,3] : []);
      ctx.beginPath(); ctx.moveTo(c1.x,c1.y); ctx.lineTo(c2.x,c2.y); ctx.stroke();
      ctx.restore();
    });

    // ── Fenster ───────────────────────────────────────────────
    (snap.windows||[]).forEach(w => {
      const c1=this._f2c(w.x1,w.y1), c2=this._f2c(w.x2,w.y2);
      ctx.save();
      ctx.strokeStyle = w.open === true ? "#38bdf8" : "#1e3a5f";
      ctx.lineWidth   = 2;
      ctx.setLineDash([4,2]);
      ctx.beginPath(); ctx.moveTo(c1.x,c1.y); ctx.lineTo(c2.x,c2.y); ctx.stroke();
      ctx.restore();
    });

    // ── BLE-Geräte ────────────────────────────────────────────
    (snap.devices||[]).forEach(d => {
      const pos = this._f2c(d.x??0, d.y??0);
      if (!isFinite(pos.x)||!isFinite(pos.y)) return;
      // Ghost trail
      if (this._opts?.journeyGhostTrail !== false) {
        for (let i=Math.max(0,idx-10); i<idx; i++) {
          const gs = (this._journeySnapshots||[])[i];
          if (!gs) continue;
          const gd = (gs.devices||[]).find(gd2=>gd2.id===d.id);
          if (!gd || gd.x==null) continue;
          const gpos = this._f2c(gd.x, gd.y);
          if (!isFinite(gpos.x)||!isFinite(gpos.y)) continue;
          const alpha = (i-idx+10)/10*0.4;
          ctx.save(); ctx.globalAlpha = alpha;
          ctx.beginPath(); ctx.arc(gpos.x,gpos.y,5,0,Math.PI*2);
          ctx.fillStyle = "#00b4cc"; ctx.fill();
          ctx.restore();
        }
      }
      ctx.save();
      ctx.beginPath(); ctx.arc(pos.x,pos.y,8,0,Math.PI*2);
      ctx.fillStyle = "rgba(0,180,204,0.85)";
      ctx.strokeStyle = "#fff"; ctx.lineWidth=1.5;
      ctx.fill(); ctx.stroke();
      ctx.font = "bold 7px 'JetBrains Mono',monospace";
      ctx.fillStyle = "#fff"; ctx.textAlign="center";
      ctx.fillText((d.name||d.id||"?").substring(0,4), pos.x, pos.y+3);
      if (d.room) {
        ctx.font="7px 'JetBrains Mono',monospace"; ctx.fillStyle="#00e5ff";
        ctx.fillText(d.room.substring(0,8), pos.x, pos.y+14);
      }
      ctx.textAlign="left"; ctx.restore();
    });

    // ── mmWave-Personen ───────────────────────────────────────
    (snap.mmwavePersons||[]).forEach(p => {
      if (p.x == null || p.y == null) return;
      const pos = this._f2c(p.x, p.y);
      if (!isFinite(pos.x)||!isFinite(pos.y)) return;
      // Ghost trail für mmWave
      if (this._opts?.journeyGhostTrail !== false) {
        for (let i=Math.max(0,idx-8); i<idx; i++) {
          const gs = (this._journeySnapshots||[])[i];
          if (!gs) continue;
          const gp = (gs.mmwavePersons||[]).find(x=>x.sensorId===p.sensorId&&x.targetId===p.targetId);
          if (!gp || gp.x==null) continue;
          const gpos = this._f2c(gp.x, gp.y);
          if (!isFinite(gpos.x)||!isFinite(gpos.y)) continue;
          ctx.save(); ctx.globalAlpha = (i-idx+8)/8*0.35;
          ctx.beginPath(); ctx.arc(gpos.x,gpos.y,4,0,Math.PI*2);
          ctx.fillStyle = "#f59e0b"; ctx.fill();
          ctx.restore();
        }
      }
      const icon = p.posture==="standing"?"🧍":p.posture==="sitting"?"🪑":p.posture==="lying"?"🛌":"👤";
      ctx.save();
      ctx.beginPath(); ctx.arc(pos.x,pos.y,9,0,Math.PI*2);
      ctx.fillStyle = "rgba(245,158,11,0.85)";
      ctx.strokeStyle="#fff7"; ctx.lineWidth=1.5;
      ctx.fill(); ctx.stroke();
      ctx.font="11px serif"; ctx.textAlign="center";
      ctx.fillText(icon, pos.x, pos.y+4);
      ctx.font="bold 6px 'JetBrains Mono',monospace"; ctx.fillStyle="#fff";
      ctx.fillText(p.name.substring(0,5), pos.x, pos.y+17);
      ctx.textAlign="left"; ctx.restore();
    });

    // ── Alarm-Overlay (wenn ausgelöst) ────────────────────────
    (snap.alarms||[]).filter(a=>a.triggered).forEach((a,i) => {
      ctx.save();
      ctx.fillStyle="rgba(239,68,68,0.15)"; ctx.fillRect(0,0,this._canvas.width,this._canvas.height);
      ctx.font="bold 11px 'JetBrains Mono',monospace"; ctx.fillStyle="#ef4444";
      ctx.textAlign="center";
      ctx.fillText("🚨 "+a.label, this._canvas.width/2, 18+i*14);
      ctx.textAlign="left"; ctx.restore();
    });

    // ── Zeitstempel-Overlay ───────────────────────────────────
    ctx.save();
    ctx.font="bold 9px 'JetBrains Mono',monospace";
    ctx.fillStyle="#0009"; ctx.fillRect(4,4,160,13);
    ctx.fillStyle="#00e5ff";
    ctx.fillText("⏮ "+new Date(snap.ts).toLocaleString("de-DE"), 7, 14);
    ctx.restore();
  }

  _collectJourneySnapshot() {
    if (!this._journeySnapshots) this._journeySnapshots = [];
    const now = Date.now();
    const WEEK = 7*24*3600000;
    // Purge old
    this._journeySnapshots = this._journeySnapshots.filter(s => now - s.ts < WEEK);

    // ── BLE-Geräte ───────────────────────────────────────────────
    const devices = (this._data?.devices || []).map(d => ({
      id: d.device_id||d.name, name: d.name,
      x: d.x, y: d.y, room: d.room
    }));

    // ── mmWave-Personen ──────────────────────────────────────────
    const mmwavePersons = [];
    for (const sensor of (this._pendingMmwave || this._data?.mmwave_sensors || [])) {
      const numT = sensor.targets || 3;
      for (let ti = 1; ti <= numT; ti++) {
        const t = this._getMmwaveTarget(sensor, ti);
        if (!t?.present) continue;
        mmwavePersons.push({
          sensorId: sensor.id, sensorName: sensor.name||sensor.id,
          targetId: ti,
          name: (sensor.target_names||[])[ti-1] || `Person ${ti}`,
          x: t.floor_mx ?? null, y: t.floor_my ?? null,
          room: this._getMmwaveZoneForTarget(sensor, t)?.room || null,
          posture: this._mmwaveDetectPosture(sensor, t),
          speed: t.speed || 0,
        });
      }
    }

    // ── Lichter ──────────────────────────────────────────────────
    const lights = (this._pendingLights || this._data?.lights || []).map(l => {
      const state = this._hass?.states?.[l.entity];
      return {
        entity: l.entity, name: l.name||l.entity,
        x: l.x, y: l.y,
        on: state?.state === 'on',
        brightness: state?.attributes?.brightness ?? null,
        color: l.color || null,
      };
    });

    // ── Türen / Fenster (HA-Entity-Zustand) ─────────────────────
    const doors = (this._pendingDoors || this._data?.doors || []).map(d => ({
      x1: d.x1, y1: d.y1, x2: d.x2, y2: d.y2,
      entity: d.entity||null,
      open: d.entity ? (this._hass?.states?.[d.entity]?.state === 'on') : null,
    }));
    const windows = (this._pendingWindows || this._data?.windows || []).map(w => ({
      x1: w.x1, y1: w.y1, x2: w.x2, y2: w.y2,
      entity: w.entity||null,
      open: w.entity ? (this._hass?.states?.[w.entity]?.state === 'on') : null,
    }));

    // ── Alarme (Zustand) ─────────────────────────────────────────
    const alarms = (this._pendingAlarms || this._data?.alarms || [])
      .filter(a => a.entity)
      .map(a => ({
        entity: a.entity, label: a.label||a.entity,
        triggered: ['on','true','1','triggered','motion','detected']
          .includes((this._hass?.states?.[a.entity]?.state||'').toLowerCase()),
      }));

    this._journeySnapshots.push({
      ts: now,
      devices,
      mmwavePersons,
      lights,
      doors,
      windows,
      alarms,
    });

    // Set slider to live end unless user is browsing
    if (!this._journeyActive) {
      this._journeyIdx = this._journeySnapshots.length - 1;
    }
  }

  // Build outer outline path for a group of rectangles (L-shape etc.)
  // Returns a canvas Path2D tracing only the outer edges
  _buildGroupOutline(rects) {
    // Simple approach: draw all rects filled, then trace outer edge
    // For rendering: fill each rect, then stroke only shared boundary removal
    // We compute the union outline via edge-segment deduplication
    const EPS = 0.5; // px tolerance
    const segments = [];
    rects.forEach(r => {
      const c1 = this._f2c(r.x1, r.y1), c2 = this._f2c(r.x2, r.y2);
      const x1=c1.x, y1=c1.y, x2=c2.x, y2=c2.y;
      // 4 edges: top, right, bottom, left
      segments.push([x1,y1,x2,y1],[x2,y1,x2,y2],[x2,y2,x1,y2],[x1,y2,x1,y1]);
    });
    // Remove duplicate / shared edges (appear twice = interior wall)
    const unique = segments.filter((s,i) =>
      !segments.some((t,j) => j!==i &&
        Math.abs(s[0]-t[2])<EPS && Math.abs(s[1]-t[3])<EPS &&
        Math.abs(s[2]-t[0])<EPS && Math.abs(s[3]-t[1])<EPS)
    );
    return unique;
  }

  _drawRooms(rooms) {
    const ctx = this._ctx;

    // Group rooms by group_id, ungrouped rooms get their own key
    const groups = new Map();
    rooms.forEach((r, i) => {
      const key = r.group_id || `__solo_${i}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(r);
    });

    groups.forEach((grpRooms) => {
      const color = grpRooms[0].color || "rgba(100,180,255,0.1)";
      const isGroup = grpRooms.length > 1;
      const displayName = grpRooms[0].group_name || grpRooms[0].name;
      const isOutdoorZone = grpRooms[0].zone_type === "outdoor";

      if (isGroup) {
        // ── Grouped rooms: fill each rect, draw shared outline only ──────
        // Fill all rects
        grpRooms.forEach(r => {
          const c1 = this._f2c(r.x1, r.y1), c2 = this._f2c(r.x2, r.y2);
          ctx.fillStyle = color;
          ctx.fillRect(c1.x, c1.y, c2.x-c1.x, c2.y-c1.y);
        });
        // Draw outer outline only (remove shared walls)
        const segs = this._buildGroupOutline(grpRooms);
        ctx.strokeStyle = "rgba(255,255,255,0.35)";
        ctx.lineWidth   = 1.5;
        ctx.setLineDash([]);
        segs.forEach(([x1,y1,x2,y2]) => {
          ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
        });
        // Label in centroid of combined area
        let cx=0, cy=0, n=0;
        grpRooms.forEach(r => {
          const c1=this._f2c(r.x1,r.y1), c2=this._f2c(r.x2,r.y2);
          cx += (c1.x+c2.x)/2; cy += (c1.y+c2.y)/2; n++;
        });
        ctx.font="bold 10px 'Syne','JetBrains Mono',monospace";
        ctx.textAlign="center"; ctx.fillStyle="rgba(255,255,255,0.25)";
        ctx.fillText(displayName, cx/n, cy/n);
        ctx.textAlign="left";

      } else {
        // ── Single room: normal draw ───────────────────────────────────────
        const r = grpRooms[0];
        const c1=this._f2c(r.x1,r.y1), c2=this._f2c(r.x2,r.y2);
        const rw2=c2.x-c1.x, rh2=c2.y-c1.y;
        // Outdoor zone: flat green area, dashed border, no fill
        if (isOutdoorZone) {
          ctx.fillStyle = "rgba(34,197,94,0.08)";
          ctx.fillRect(c1.x,c1.y,rw2,rh2);
          ctx.save();
          ctx.strokeStyle="rgba(34,197,94,0.55)"; ctx.lineWidth=1.2;
          ctx.setLineDash([6,4]);
          ctx.strokeRect(c1.x,c1.y,rw2,rh2);
          ctx.setLineDash([]); ctx.restore();
          const midX=c1.x+rw2/2, midY=c1.y+rh2/2;
          ctx.font=`${Math.max(10,Math.min(rw2,rh2)*0.25)}px sans-serif`;
          ctx.textAlign="center"; ctx.textBaseline="middle";
          ctx.globalAlpha=0.45; ctx.fillText("🌿",midX,midY-6); ctx.globalAlpha=1;
          ctx.font="bold 7px 'JetBrains Mono',monospace";
          ctx.fillStyle="#22c55e"; ctx.fillText(r.name,midX,midY+9);
          ctx.textBaseline="alphabetic";
          const seed=(r.x1*1000+r.y1*137)|0;
          ctx.fillStyle="rgba(34,197,94,0.12)";
          for(let gi=0;gi<18;gi++){
            const gx=c1.x+8+Math.abs((seed*(gi+7)*2654435761)%(Math.max(4,rw2-16)|0));
            const gy=c1.y+8+Math.abs((seed*(gi+13)*2246822519)%(Math.max(4,rh2-16)|0));
            ctx.fillRect(gx,gy,2,2);
          }
        } else {
        // ── Boden-Textur (2D) ─────────────────────────────────────────────
        const floorPat2d = this._texPattern(ctx, "floor", this._unitPx2d || 40);
        if (floorPat2d) {
          ctx.save();
          ctx.fillStyle = floorPat2d;
          ctx.globalAlpha = 0.75;
          ctx.fillRect(c1.x,c1.y,rw2,rh2);
          ctx.globalAlpha = 1;
          // Raumfarb-Tint
          ctx.fillStyle = color.replace(/[\d.]+\)$/, "0.22)");
          ctx.fillRect(c1.x,c1.y,rw2,rh2);
          ctx.restore();
        } else {
          ctx.fillStyle = color;
          ctx.fillRect(c1.x,c1.y,rw2,rh2);
        }
        ctx.strokeStyle = "rgba(255,255,255,0.12)";
        ctx.lineWidth=1; ctx.setLineDash([]);
        ctx.strokeRect(c1.x,c1.y,c2.x-c1.x,c2.y-c1.y);
        ctx.font="bold 10px 'Syne','JetBrains Mono',monospace";
        ctx.textAlign="center"; ctx.fillStyle="rgba(255,255,255,0.2)";
        ctx.fillText(r.name,(c1.x+c2.x)/2,(c1.y+c2.y)/2);
        ctx.textAlign="left";

        // Zone overlays inside room
        if (r.zones && r.zones.length) {
          r.zones.forEach(z => {
            const zx1=c1.x+(z.rx1||0)*rw2, zy1=c1.y+(z.ry1||0)*rh2;
            const zx2=c1.x+(z.rx2||1)*rw2, zy2=c1.y+(z.ry2||1)*rh2;
            const zw=zx2-zx1, zh=zy2-zy1;
            let zActive=false;
            if (z.presence_entity && this._hass && this._hass.states) {
              const st=this._hass.states[z.presence_entity];
              zActive=["on","home","true","1","detected"].includes((st&&st.state||"").toLowerCase());
            }
            const zCol=z.color||"#a78bfa";
            const [zr,zg,zb]=zCol.replace("#","").match(/../g).map(h=>parseInt(h,16));
            ctx.fillStyle="rgba("+zr+","+zg+","+zb+","+(zActive?0.35:0.12)+")";
            ctx.fillRect(zx1,zy1,zw,zh);
            ctx.save();
            ctx.strokeStyle="rgba("+zr+","+zg+","+zb+","+(zActive?0.9:0.5)+")";
            ctx.lineWidth=zActive?1.5:1; ctx.setLineDash([4,3]);
            ctx.strokeRect(zx1,zy1,zw,zh); ctx.setLineDash([]); ctx.restore();
            ctx.font="bold 7px 'JetBrains Mono',monospace";
            ctx.textAlign="center";
            ctx.fillStyle="rgba("+zr+","+zg+","+zb+","+(zActive?1.0:0.7)+")";
            ctx.fillText(z.name||"Zone",zx1+zw/2,zy1+zh/2+3);
            if (zActive) {
              ctx.fillStyle="rgba("+zr+","+zg+","+zb+",0.9)";
              ctx.beginPath(); ctx.arc(zx1+zw/2,zy1+10,3,0,Math.PI*2); ctx.fill();
            }
            ctx.textAlign="left";

            // Resize handles when zone panel is open for this room
            const roomIdx = this._pendingRooms ? this._pendingRooms.indexOf(r) : -1;
            if (this._zoneEditRoom === roomIdx && roomIdx >= 0) {
              ctx.fillStyle="rgba("+zr+","+zg+","+zb+",0.95)";
              [[zx1,zy1],[zx2,zy1],[zx1,zy2],[zx2,zy2]].forEach(([hx,hy])=>{
                ctx.beginPath(); ctx.arc(hx,hy,5,0,Math.PI*2); ctx.fill();
                ctx.strokeStyle="#000"; ctx.lineWidth=1;
                ctx.beginPath(); ctx.arc(hx,hy,5,0,Math.PI*2); ctx.stroke();
              });
            }
          });
        }
        } // end indoor else
      }
    });

    // Wizard room highlight (on top)
    if (this._wizardMode && this._wizardRoom !== null) {
      const wr = rooms[this._wizardRoom];
      if (wr) {
        const c1=this._f2c(wr.x1,wr.y1), c2=this._f2c(wr.x2,wr.y2);
        ctx.strokeStyle="rgba(234,179,8,0.9)"; ctx.lineWidth=2;
        ctx.setLineDash([5,3]);
        ctx.strokeRect(c1.x,c1.y,c2.x-c1.x,c2.y-c1.y);
        ctx.setLineDash([]);
      }
    }
  }


  // ── Fingerprint age → color ───────────────────────────────────────────
  _fpColor(fp) {
    const nowSec   = Date.now() / 1000;
    const ageDays  = (nowSec - (fp.ts || 0)) / 86400;
    const isAuto   = fp.auto === true;

    // max age from config (fallback to defaults)
    const maxAge = isAuto
      ? (this._data?.auto_fp_max_age   || 7)
      : (this._data?.manual_fp_max_age || 30);

    const ratio = Math.min(1, ageDays / maxAge); // 0=fresh, 1=expired

    if (isAuto) {
      // blau (frisch) → hellblau → fast transparent
      const alpha = Math.max(0.08, 0.55 - ratio * 0.47);
      const blue  = Math.round(200 + ratio * 55);   // 200→255
      const green = Math.round(ratio * 180);          // 0→180
      return { fill: `rgba(${green},${green},${blue},${alpha})`, stroke: `rgba(100,160,255,${alpha + 0.1})` };
    } else {
      // grün (frisch) → gelb → rot
      let r, g;
      if (ratio < 0.5) {
        r = Math.round(ratio * 2 * 255);
        g = 230;
      } else {
        r = 255;
        g = Math.round((1 - (ratio - 0.5) * 2) * 230);
      }
      const alpha = Math.max(0.15, 0.7 - ratio * 0.35);
      return { fill: `rgba(${r},${g},30,${alpha})`, stroke: `rgba(${r},${g},30,${alpha + 0.2})` };
    }
  }

  _drawGrid() {
    if (this._mode !== "calibrate") {
      // In non-calibrate modes just show faint calibrated-point markers
      if (this._mode !== "view") return;
    }
    const ctx = this._ctx;
    const t   = Date.now();
    this._gridPts.forEach(p => {
      const c = this._f2c(p.mx, p.my);
      const hasFp = this._hasFpAt(p.mx, p.my);  // nutzt Backend-FPs + lokale Hints

      if (this._mode === "calibrate") {
        if (hasFp) {
          const fpCol = this._fpColor(hasFp);
          ctx.strokeStyle = fpCol.stroke; ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(c.x - 3, c.y); ctx.lineTo(c.x + 3, c.y);
          ctx.moveTo(c.x, c.y - 3); ctx.lineTo(c.x, c.y + 3);
          ctx.stroke();
          // Filled dot under cross
          ctx.fillStyle = fpCol.fill;
          ctx.beginPath(); ctx.arc(c.x, c.y, 2.5, 0, Math.PI * 2); ctx.fill();
        } else {
          // Uncalibrated grid point: pulse/blink in wizard mode
          if (this._wizardMode && this._wizardRoom !== null) {
            const pulse = 0.3 + 0.7 * Math.abs(Math.sin(t / 800));
            ctx.fillStyle = `rgba(0,229,255,${pulse * 0.45})`;
            ctx.beginPath(); ctx.arc(c.x, c.y, 3, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = `rgba(0,229,255,${pulse * 0.6})`; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.arc(c.x, c.y, 5, 0, Math.PI * 2); ctx.stroke();
          } else {
            ctx.fillStyle = "rgba(68,85,102,0.5)";
            ctx.beginPath(); ctx.arc(c.x, c.y, 1.5, 0, Math.PI * 2); ctx.fill();
          }
        }
        // Selected point pulse
        if (this._selGridPt &&
            Math.abs(this._selGridPt.mx - p.mx) < 0.01 &&
            Math.abs(this._selGridPt.my - p.my) < 0.01) {
          const pulse = 0.5 + 0.5 * Math.sin(t / 200);
          ctx.strokeStyle = `rgba(0,229,255,${0.6 + 0.4 * pulse})`; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(c.x, c.y, 6 + pulse * 2, 0, Math.PI * 2); ctx.stroke();
          ctx.fillStyle = "rgba(0,229,255,0.25)";
          ctx.beginPath(); ctx.arc(c.x, c.y, 6 + pulse * 2, 0, Math.PI * 2); ctx.fill();
        }
      } else if (hasFp) {
        // Age-based color in view mode
        const col = this._fpColor(hasFp);
        ctx.fillStyle = col.fill;
        ctx.beginPath(); ctx.arc(c.x, c.y, 2, 0, Math.PI * 2); ctx.fill();
      }
    });
  }

  _drawScanners(scanners) {
    const ctx = this._ctx;
    scanners.forEach((s, i) => {
      if (s.mx === undefined || s.my === undefined) return;
      const c   = this._f2c(s.mx, s.my);
      const col = s.color || "#00e5ff";
      // Glow
      const grd = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, 18);
      grd.addColorStop(0, col + "60"); grd.addColorStop(1, col + "00");
      ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(c.x, c.y, 18, 0, Math.PI * 2); ctx.fill();
      // Dot
      ctx.fillStyle   = col;
      ctx.beginPath(); ctx.arc(c.x, c.y, 6, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "white"; ctx.lineWidth = 1.5; ctx.stroke();
      // Edit ring
      if (this._mode === "scanners" && this._editScanner === i) {
        ctx.strokeStyle = "rgba(255,214,0,0.8)"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(c.x, c.y, 11, 0, Math.PI * 2); ctx.stroke();
      }
      // Label
      ctx.font = "bold 9px 'JetBrains Mono',monospace";
      const tw = ctx.measureText(s.name).width + 6;
      ctx.fillStyle = "rgba(7,9,13,0.85)"; ctx.fillRect(c.x + 9, c.y - 10, tw, 11);
      ctx.fillStyle = col; ctx.fillText(s.name, c.x + 12, c.y);
    });
  }

  _deviceColor(deviceId) {
    const COLORS = ["#f97316","#00e5ff","#a855f7","#22c55e","#f43f5e","#eab308","#3b82f6","#ec4899"];
    const devices = this._data?.devices || [];
    const idx = devices.findIndex(d => d.device_id === deviceId);
    return COLORS[Math.max(0, idx) % COLORS.length];
  }

  _drawDevices() {
    const ctx     = this._ctx;
    const t       = Date.now() / 1000;
    const devices = this._data?.devices || [];

    // Filter: all or only selected; respect guest mode
    const _guestHidden = this._opts?.guestMode ? (this._guestHidden || {}) : {};
    const toShow = (this._showAllDevices
      ? devices
      : devices.filter(d => d.device_id === this._devId)
    ).filter(d => !_guestHidden[d.device_id]);

    toShow.forEach(dev => {
      if (dev.present === false) return;

      const ema = this._ema[dev.device_id];
      const px  = ema ? ema.x : (dev.x || 0);
      const py  = ema ? ema.y : (dev.y || 0);
      if (px === 0 && py === 0 && (dev.fp_count || 0) === 0) return;

      const color   = this._deviceColor(dev.device_id);
      const isSelected = dev.device_id === this._devId;
      const c       = this._f2c(px, py);
      const pulse   = 0.5 + 0.5 * Math.sin(t * Math.PI);

      // ── Draw trail first (below device dot) ──────────────────────────────
      this._drawDeviceTrail(ctx, dev.device_id, color);

      const hex2rgb = h => {
        const r = parseInt(h.slice(1,3),16), g = parseInt(h.slice(3,5),16), b = parseInt(h.slice(5,7),16);
        return `${r},${g},${b}`;
      };
      const rgb = hex2rgb(color);

      // Outer glow
      const glowR = isSelected ? 40 + pulse * 10 : 24 + pulse * 5;
      const g1 = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, glowR);
      g1.addColorStop(0, `rgba(${rgb},${isSelected ? 0.2 : 0.12})`); g1.addColorStop(1, "transparent");
      ctx.fillStyle = g1; ctx.beginPath(); ctx.arc(c.x, c.y, glowR, 0, Math.PI * 2); ctx.fill();

      // Inner glow
      const g2 = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, 16 + pulse * 4);
      g2.addColorStop(0, `rgba(${rgb},0.5)`); g2.addColorStop(1, "transparent");
      ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(c.x, c.y, 16 + pulse * 4, 0, Math.PI * 2); ctx.fill();

      // Dot / Avatar circle
      const dotR = isSelected ? 10 : 8;
      ctx.fillStyle = "rgba(7,9,13,0.88)";
      ctx.strokeStyle = color; ctx.lineWidth = isSelected ? 2.5 : 1.8;
      ctx.beginPath(); ctx.arc(c.x, c.y, dotR, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

      // Avatar or initial letter
      const letter = (dev.device_name || dev.device_id || "?")[0].toUpperCase();
      this._drawAvatar(ctx, c.x, c.y, dotR * 0.72, dev.entity_id, letter, color);

      // Label
      const name = dev.device_name || dev.device_id;
      ctx.font = `${isSelected ? "bold " : ""}10px 'JetBrains Mono',monospace`;
      const lw = ctx.measureText(name).width + 10;
      ctx.fillStyle = "rgba(7,9,13,0.88)"; ctx.fillRect(c.x + dotR + 4, c.y - 13, lw, 14);
      ctx.fillStyle = color; ctx.fillText(name, c.x + dotR + 6, c.y - 2);
    });
  }

  // Auto-detect door angle from nearest room wall
  _doorAngle(d) {
    const rooms = this._mode === "rooms" ? this._pendingRooms : (this._data?.rooms || []);
    let bestDist = Infinity, bestAngle = 0;
    rooms.forEach(r => {
      // 4 walls: top(0°), right(90°), bottom(0°), left(90°)
      const walls = [
        { dist: Math.abs(d.y - r.y1), angle: 0   },  // top wall    → horizontal door
        { dist: Math.abs(d.y - r.y2), angle: 0   },  // bottom wall → horizontal door
        { dist: Math.abs(d.x - r.x1), angle: 90  },  // left wall   → vertical door
        { dist: Math.abs(d.x - r.x2), angle: 90  },  // right wall  → vertical door
      ];
      walls.forEach(w => {
        if (w.dist < bestDist) { bestDist = w.dist; bestAngle = w.angle; }
      });
    });
    return bestAngle * Math.PI / 180;
  }

  

  _drawWindows() {
    const ctx = this._ctx;
    const wins = this._mode === "rooms" ? this._pendingWindows : (this._windows || []);
    const isEditMode = this._mode === "rooms";
    const floorW = this._data?.floor_w || 10;
    const scale  = this._canvas.width / floorW;

    wins.forEach((w, i) => {
      const c   = this._f2c(w.x, w.y);
      const len = (w.width || 1.0) * scale;
      const ang = (w.angle || 0);  // 0=horizontal wall, PI/2=vertical wall

      // Determine state color from entity
      // Window entity = Öffnungssensor (binary_sensor on/off oder open/closed)
      // cover_entity = Rollo - beeinflusst NUR die Lamellenposition, NICHT die Fensterfarbe
      let winState = null;
      if (!isEditMode && w.entity_id && this._hass?.states) {
        winState = this._hass.states[w.entity_id]?.state;
      }
      const isOpen   = winState === "open"   || winState === "on"  || winState === "true";
      const isTilted = winState === "tilted";
      const isClosed = winState === "closed" || winState === "off" || winState === "false";
      const col = isEditMode   ? "#7dd3fc"
                : isOpen       ? "rgba(239,68,68,0.9)"    // rot = offen
                : isTilted     ? "rgba(251,146,60,0.9)"   // orange = gekippt
                : isClosed     ? "rgba(34,197,94,0.85)"   // grün = geschlossen ✓
                :                "rgba(125,211,252,0.7)"; // hellblau = kein Entity

      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(ang);

      // Window frame line (thick, wall-colored background)
      ctx.strokeStyle = "rgba(7,9,13,0.6)";
      ctx.lineWidth   = 8;
      ctx.beginPath();
      ctx.moveTo(-len/2, 0); ctx.lineTo(len/2, 0);
      ctx.stroke();

      // Window status line (colored)
      ctx.strokeStyle = col;
      ctx.lineWidth   = 4;
      ctx.beginPath();
      ctx.moveTo(-len/2, 0); ctx.lineTo(len/2, 0);
      ctx.stroke();

      // Tilted indicator: diagonal line inside window
      if (isTilted) {
        ctx.strokeStyle = "rgba(251,146,60,0.6)";
        ctx.lineWidth   = 2;
        ctx.beginPath();
        ctx.moveTo(-len/2, 0); ctx.lineTo(len/4, -len/3);
        ctx.stroke();
      }

      // Open indicator: short perpendicular lines at ends
      if (isOpen || isEditMode) {
        ctx.strokeStyle = col;
        ctx.lineWidth   = 2;
        [[-len/2, 0], [len/2, 0]].forEach(([px, py]) => {
          ctx.beginPath();
          ctx.moveTo(px, -6); ctx.lineTo(px, 6);
          ctx.stroke();
        });
      }

      // Edit mode handles
      if (isEditMode) {
        [-len/2, len/2].forEach(hx => {
          ctx.fillStyle   = "#7dd3fc";
          ctx.strokeStyle = "white"; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.arc(hx, 0, 5, 0, Math.PI*2);
          ctx.fill(); ctx.stroke();
        });
      }

      ctx.restore();

      // Label
      ctx.font      = "bold 9px 'JetBrains Mono',monospace";
      ctx.fillStyle = col;
      ctx.fillText(`F${i+1}`, c.x + len/2 + 6, c.y - 4);

      // State label in live mode
      if (!isEditMode && winState) {
        const label = isOpen ? "offen" : isTilted ? "gekippt" : "zu";
        ctx.font      = "8px 'JetBrains Mono',monospace";
        ctx.fillStyle = col;
        ctx.fillText(label, c.x + len/2 + 6, c.y + 8);
      }

      // ── Rollo overlay ──────────────────────────────────────────────
      if ((w.type || "window") === "shutter" && !isEditMode) {
        let position = 100; // 100 = fully open (no shutter visible)
        if (w.cover_entity && this._hass?.states) {
          const cs = this._hass.states[w.cover_entity];
          if (cs) {
            // cover state: 'open'=100%, 'closed'=0%, or use current_position attr
            if (cs.attributes?.current_position !== undefined) {
              position = cs.attributes.current_position;
            } else {
              position = (cs.state === "open") ? 100 : (cs.state === "closed") ? 0 : 50;
            }
          }
        }
        if (position < 100) {
          const closedFraction = (100 - position) / 100; // 0=open, 1=closed
          ctx.save();
          ctx.translate(c.x, c.y);
          ctx.rotate(ang);
          const shutterDepth = len * 0.45 * closedFraction; // how far into room
          // Direction into room: perpendicular to window (negative y = into room)
          // Shutter body
          ctx.fillStyle = `rgba(40,40,50,${0.5 + closedFraction * 0.35})`;
          ctx.strokeStyle = `rgba(80,80,100,0.7)`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.rect(-len/2, -shutterDepth, len, shutterDepth);
          ctx.fill(); ctx.stroke();
          // Lamellen lines
          const lamelleCount = Math.max(2, Math.round(closedFraction * 7));
          ctx.strokeStyle = `rgba(60,60,75,0.9)`;
          ctx.lineWidth = 0.8;
          for (let li = 1; li < lamelleCount; li++) {
            const ly = -shutterDepth * (li / lamelleCount);
            ctx.beginPath();
            ctx.moveTo(-len/2, ly); ctx.lineTo(len/2, ly);
            ctx.stroke();
          }
          // Position label
          ctx.restore();
          ctx.font = "bold 8px 'JetBrains Mono',monospace";
          ctx.fillStyle = position === 0 ? "#ef4444" : "#94a3b8";
          ctx.fillText(`${position}%`, c.x + len/2 + 6, c.y + 18);
        }
      } else if ((w.type || "window") === "shutter" && isEditMode) {
        // Edit mode: show shutter indicator
        ctx.save();
        ctx.translate(c.x, c.y);
        ctx.rotate(ang);
        ctx.fillStyle = "rgba(148,163,184,0.3)";
        ctx.strokeStyle = "rgba(148,163,184,0.6)";
        ctx.lineWidth = 1;
        ctx.setLineDash([3,2]);
        ctx.beginPath(); ctx.rect(-len/2, -len*0.2, len, len*0.2);
        ctx.fill(); ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }
    });
  }

_drawDoors() {
    const ctx   = this._ctx;
    const doors = this._mode === "rooms" ? this._pendingDoors : (this._doors || []);
    const isEditMode = this._mode === "rooms";

    doors.forEach((d, i) => {
      const c   = this._f2c(d.x, d.y);
      const w   = d.width || 0.9;
      const floorW = this._data?.floor_w || 10;
      const scale  = this._canvas.width / floorW;
      const pw  = w * scale;   // door width in px
      const ang = this._doorAngle(d);  // 0=horizontal, PI/2=vertical

      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(ang);

      // Determine color from entity state
      let doorState = null;
      if (!isEditMode && d.entity_id && this._hass?.states) {
        doorState = this._hass.states[d.entity_id]?.state;
      }
      const isOpen   = doorState === "open" || doorState === "on"  || doorState === "true";
      const isClosed = doorState === "closed"|| doorState === "off" || doorState === "false";
      const col = isEditMode ? "#eab308"
                : isOpen    ? "rgba(239,68,68,0.9)"    // rot = offen
                : isClosed  ? "rgba(34,197,94,0.85)"   // grün = zu
                :             "rgba(234,179,8,0.7)";   // gelb = kein Entity
      // Arc opening: 0% (closed) → 90° (open)
      // Door threshold line (wall opening)
      ctx.strokeStyle = col;
      ctx.lineWidth   = 3;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(-pw/2, 0); ctx.lineTo(pw/2, 0);
      ctx.stroke();

      const mir = d.mirrored ? -1 : 1;
      const hinge = mir * (-pw/2);

      if (isClosed) {
        // Geschlossen: kompaktes Rechteck (Blatt liegt in der Wand)
        ctx.fillStyle = col.replace("0.9","0.3").replace("0.85","0.25");
        ctx.fillRect(-pw/2, -pw*0.07, pw, pw*0.14);
        ctx.strokeStyle = col; ctx.lineWidth = 1.5;
        ctx.strokeRect(-pw/2, -pw*0.07, pw, pw*0.14);
      } else {
        // Offen: 110° Türblatt + gestrichelter Bogen
        const arcAngle = 110 * Math.PI / 180;
        const leafX = hinge + mir * pw * Math.cos(arcAngle);
        const leafY = pw * Math.sin(arcAngle);
        ctx.strokeStyle = col.replace("0.9","0.4").replace("0.85","0.35").replace("0.7","0.35");
        ctx.lineWidth = 1.5; ctx.setLineDash([3,3]);
        ctx.beginPath();
        if (d.mirrored) ctx.arc(hinge, 0, pw, Math.PI - arcAngle, Math.PI, false);
        else            ctx.arc(hinge, 0, pw, 0, arcAngle);
        ctx.stroke(); ctx.setLineDash([]);
        ctx.strokeStyle = col; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(hinge, 0); ctx.lineTo(leafX, leafY); ctx.stroke();
      }

      // Scale handles at ends (only in rooms edit mode)
      if (isEditMode) {
        [-pw/2, pw/2].forEach(hx => {
          ctx.fillStyle = "#eab308";
          ctx.beginPath(); ctx.arc(hx, 0, 5, 0, Math.PI*2); ctx.fill();
          ctx.strokeStyle = "white"; ctx.lineWidth = 1.5; ctx.stroke();
        });
      }

      ctx.restore();

      // Label (outside rotation for readability)
      ctx.font      = "bold 9px 'JetBrains Mono',monospace";
      ctx.fillStyle = col;
      ctx.fillText(`T${i+1}`, c.x + pw/2 + 6, c.y - 4);

      // Connections label
      if (isEditMode && d.connects?.length >= 2) {
        ctx.font      = "8px 'JetBrains Mono',monospace";
        ctx.fillStyle = "rgba(234,179,8,0.6)";
        ctx.fillText(`${d.connects[0]} ↔ ${d.connects[1]}`, c.x + pw/2 + 6, c.y + 8);
      }
    });

    // Placing hint: pulsing crosshair
    if (this._placingDoor) {
      // Animated crosshair follows mouse - just show pulsing overlay hint
      const t = Date.now() / 400;
      const pulse = 0.5 + 0.5 * Math.sin(t * Math.PI);
      ctx.strokeStyle = `rgba(234,179,8,${0.4 + pulse * 0.4})`;
      ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
      // Draw subtle grid highlight for nearest wall
      ctx.setLineDash([]);
    }
  }



  _drawCalibrationOverlay() {
    const ctx    = this._ctx;
    const done   = Object.keys(this._localFpHints).length;
    const total  = this._gridPts.length;
    const pct    = total > 0 ? Math.round(done / total * 100) : 0;
    const bx = this._canvas.width - 155, by = 8;
    ctx.fillStyle = "rgba(13,18,25,0.92)"; ctx.fillRect(bx, by, 145, 34);
    ctx.strokeStyle = "#1c2535"; ctx.lineWidth = 1; ctx.strokeRect(bx, by, 145, 34);
    ctx.font = "bold 8px 'JetBrains Mono',monospace"; ctx.fillStyle = "#445566";
    ctx.fillText("KALIBRIERUNG", bx + 7, by + 13);
    ctx.fillStyle = "#00ff88"; ctx.font = "10px 'JetBrains Mono',monospace";
    ctx.fillText(`${done} / ${total} (${pct}%)`, bx + 7, by + 27);
  }

  _drawRoomDrawingOverlay() {
    const ctx = this._ctx;
    // Draw in-progress rectangle
    if (this._drawState.active) {
      const { sx, sy, ex, ey } = this._drawState;
      const x1m = Math.min(sx, ex), y1m = Math.min(sy, ey);
      const x2m = Math.max(sx, ex), y2m = Math.max(sy, ey);
      const c1 = this._f2c(x1m, y1m);
      const c2 = this._f2c(x2m, y2m);
      const w = c2.x - c1.x, h = c2.y - c1.y;
      ctx.fillStyle = "rgba(167,139,250,0.12)"; ctx.fillRect(c1.x, c1.y, w, h);
      ctx.strokeStyle = "#a78bfa"; ctx.lineWidth = 2;
      ctx.setLineDash([5, 3]); ctx.strokeRect(c1.x, c1.y, w, h);
      ctx.setLineDash([]);
      // Show dimensions
      const wm = (x2m - x1m).toFixed(1), hm = (y2m - y1m).toFixed(1);
      ctx.font = "bold 10px 'JetBrains Mono',monospace";
      ctx.fillStyle = "#a78bfa";
      ctx.fillText(`${wm}m × ${hm}m`, c1.x + 4, c1.y + 14);
    }
    // Highlight all rooms in edit mode + handles
    if (this._roomSubMode === "edit") {
      this._pendingRooms.forEach((r, i) => {
        const c1 = this._f2c(r.x1, r.y1), c2 = this._f2c(r.x2, r.y2);
        const sel = i === this._selRoomIdx;
        ctx.strokeStyle = sel ? "rgba(255,214,0,0.9)" : "rgba(167,139,250,0.5)";
        ctx.lineWidth = sel ? 2 : 1;
        ctx.setLineDash([4, 3]);
        ctx.strokeRect(c1.x, c1.y, c2.x-c1.x, c2.y-c1.y);
        ctx.setLineDash([]);
        // Resize handles (corners)
        [[c1.x,c1.y],[c2.x,c1.y],[c1.x,c2.y],[c2.x,c2.y]].forEach(([hx,hy]) => {
          ctx.fillStyle   = sel ? "#ffd600" : "rgba(167,139,250,0.7)";
          ctx.strokeStyle = "rgba(7,9,13,0.8)"; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.arc(hx, hy, 5, 0, Math.PI*2);
          ctx.fill(); ctx.stroke();
        });
        // Show dimensions on selected room
        if (sel) {
          const wm = (r.x2-r.x1).toFixed(1), hm = (r.y2-r.y1).toFixed(1);
          ctx.font = "bold 9px 'JetBrains Mono',monospace";
          ctx.fillStyle = "#ffd600";
          ctx.fillText(`${wm}m × ${hm}m`, c1.x+4, c1.y+13);
          ctx.fillText(`(${r.x1},${r.y1})→(${r.x2},${r.y2})`, c1.x+4, c1.y+24);
        }
      });
    } else if (this._selRoomIdx >= 0) {
      const r = this._pendingRooms[this._selRoomIdx];
      if (r) {
        const c1 = this._f2c(r.x1, r.y1), c2 = this._f2c(r.x2, r.y2);
        ctx.strokeStyle = "rgba(255,214,0,0.8)"; ctx.lineWidth = 2;
        ctx.setLineDash([5,3]); ctx.strokeRect(c1.x,c1.y,c2.x-c1.x,c2.y-c1.y);
        ctx.setLineDash([]);
      }
    }
  }

  _drawScannerOverlay() {
    const ctx = this._ctx;
    if (this._placingIdx >= 0 && this._mouseFloor) {
      const c = this._f2c(this._mouseFloor.mx, this._mouseFloor.my);
      const s = this._pendingScanners[this._placingIdx];
      const col = s ? (s.color || "#ffd600") : "#ffd600";
      // Crosshair lines
      ctx.strokeStyle = col + "88"; ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      ctx.beginPath(); ctx.moveTo(0, c.y); ctx.lineTo(this._canvas.width, c.y); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(c.x, 0); ctx.lineTo(c.x, this._canvas.height); ctx.stroke();
      ctx.setLineDash([]);
      // Preview dot
      ctx.fillStyle = col; ctx.globalAlpha = 0.8;
      ctx.beginPath(); ctx.arc(c.x, c.y, 7, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1.0;
      ctx.strokeStyle = "white"; ctx.lineWidth = 1.5; ctx.stroke();
      // Label
      if (s) {
        ctx.font = "bold 9px 'JetBrains Mono',monospace";
        ctx.fillStyle = col;
        ctx.fillText(`📍 ${s.name}: ${this._mouseFloor.mx.toFixed(2)}m / ${this._mouseFloor.my.toFixed(2)}m`, c.x + 12, c.y - 5);
      }
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ── ENERGIE TAB ──────────────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════

  _energieTypes() {
    return [
      { id:"solar",        label:"Solar",     color:"#f59e0b", unit:"W"   },
      { id:"grid",         label:"Landstrom", color:"#60a5fa", unit:"W"   },
      { id:"water",        label:"Wasser",    color:"#22d3ee", unit:"L/h" },
      { id:"gas",          label:"Gas",       color:"#fb923c", unit:"m³/h"},
      { id:"oil",          label:"Öl",        color:"#92400e", unit:"L/h" },
      { id:"battery_line", label:"Akku",      color:"#4ade80", unit:"W"   },
    ];
  }

  _sidebarEnergie() {
    const wrap = document.createElement("div");
    wrap.style.cssText = "padding:8px;display:flex;flex-direction:column;gap:6px";

    // Header
    const hdr = document.createElement("div");
    hdr.style.cssText = "font-size:10px;font-weight:700;color:#f59e0b;letter-spacing:1px;margin-bottom:2px";
    hdr.textContent = "⚡ ENERGIE & VERBRAUCH";
    wrap.appendChild(hdr);

    // ── LEITUNGEN ──────────────────────────────────────────────────────────
    const lHdr = document.createElement("div");
    lHdr.style.cssText = "font-size:8px;font-weight:700;color:var(--muted);letter-spacing:0.5px;margin-top:2px";
    lHdr.textContent = "LEITUNGEN";
    wrap.appendChild(lHdr);

    (this._pendingEnergyLines || []).forEach((line, idx) => {
      const box = document.createElement("div");
      box.style.cssText = "background:var(--surf2);border-radius:6px;padding:6px 8px;border:1px solid var(--border)";

      const typeConf = this._energieTypes().find(t => t.id === (line.type||"solar")) || this._energieTypes()[0];

      // Name + color dot + delete
      const hrow = document.createElement("div");
      hrow.style.cssText = "display:flex;align-items:center;gap:5px;margin-bottom:4px";
      const dot = document.createElement("span");
      dot.style.cssText = `width:8px;height:8px;border-radius:50%;background:${typeConf.color};flex-shrink:0;display:inline-block`;
      const nameInp = document.createElement("input");
      nameInp.value = line.name || ""; nameInp.placeholder = "Name";
      nameInp.style.cssText = "flex:1;background:var(--surf3);border:1px solid var(--border);color:var(--text);border-radius:3px;font-size:9px;padding:2px 4px";
      nameInp.addEventListener("input", () => { line.name = nameInp.value; });
      const del = document.createElement("button");
      del.textContent = "✕"; del.style.cssText = "background:none;border:none;color:var(--muted);cursor:pointer;font-size:10px;padding:0 2px";
      del.addEventListener("click", () => { this._pendingEnergyLines.splice(idx,1); this._energyParticles[idx]=null; this._rebuildSidebar(); this._draw(); });
      hrow.append(dot, nameInp, del);
      box.appendChild(hrow);

      // Type
      const typeRow = document.createElement("div");
      typeRow.style.cssText = "display:flex;align-items:center;gap:4px;margin-bottom:3px";
      const typeLbl = document.createElement("span"); typeLbl.textContent="Typ"; typeLbl.style.cssText="font-size:7px;color:var(--muted);width:36px;flex-shrink:0";
      const typeSel = document.createElement("select");
      typeSel.style.cssText = "flex:1;background:var(--surf3);border:1px solid var(--border);color:var(--text);border-radius:3px;font-size:8px;padding:1px 3px";
      this._energieTypes().forEach(t => {
        const o = document.createElement("option"); o.value=t.id; o.textContent=`${t.label} (${t.unit})`;
        if ((line.type||"solar")===t.id) o.selected=true;
        typeSel.appendChild(o);
      });
      typeSel.addEventListener("change", () => { line.type = typeSel.value; this._rebuildSidebar(); this._draw(); });
      typeRow.append(typeLbl, typeSel);
      box.appendChild(typeRow);

      // Entity + live value
      const entRow = document.createElement("div");
      entRow.style.cssText = "display:flex;align-items:center;gap:4px;margin-bottom:3px";
      const entLbl = document.createElement("span"); entLbl.textContent="Entity"; entLbl.style.cssText="font-size:7px;color:var(--muted);width:36px;flex-shrink:0";
      const entInp = document.createElement("input");
      entInp.value = line.entity || ""; entInp.placeholder = "sensor.solar_power";
      entInp.style.cssText = "flex:1;background:var(--surf3);border:1px solid var(--border);color:var(--text);border-radius:3px;font-size:8px;padding:2px 4px";
      entInp.addEventListener("input", () => { line.entity = entInp.value.trim(); });
      const liveVal = document.createElement("span");
      liveVal.style.cssText = `font-size:8px;font-weight:700;flex-shrink:0;min-width:36px;text-align:right;color:${typeConf.color}`;
      if (line.entity && this._hass?.states?.[line.entity]) {
        const v = parseFloat(this._hass.states[line.entity].state);
        liveVal.textContent = isNaN(v) ? "–" : `${v > 999 ? (v/1000).toFixed(1)+"k" : v.toFixed(0)} ${typeConf.unit}`;
      } else { liveVal.textContent = "–"; liveVal.style.color = "var(--muted)"; }
      entRow.append(entLbl, entInp, liveVal);
      box.appendChild(entRow);

      // Max + Direction
      const cfgRow = document.createElement("div");
      cfgRow.style.cssText = "display:flex;align-items:center;gap:4px;margin-bottom:4px";
      const maxLbl = document.createElement("span"); maxLbl.textContent="Max"; maxLbl.style.cssText="font-size:7px;color:var(--muted);width:30px;flex-shrink:0";
      const maxInp = document.createElement("input");
      maxInp.type="number"; maxInp.value=line.max_w||5000; maxInp.min=1; maxInp.step=100;
      maxInp.style.cssText = "width:55px;background:var(--surf3);border:1px solid var(--border);color:var(--text);border-radius:3px;font-size:8px;padding:2px 4px";
      maxInp.addEventListener("input", () => { line.max_w = parseFloat(maxInp.value)||5000; });
      const dirLbl = document.createElement("span"); dirLbl.textContent="Dir"; dirLbl.style.cssText="font-size:7px;color:var(--muted);flex-shrink:0";
      const dirSel = document.createElement("select");
      dirSel.style.cssText = "flex:1;background:var(--surf3);border:1px solid var(--border);color:var(--text);border-radius:3px;font-size:8px;padding:1px 2px";
      [["auto","⇌ auto"],["forward","→ rein"],["reverse","← raus"]].forEach(([v,t]) => {
        const o=document.createElement("option"); o.value=v; o.textContent=t;
        if ((line.direction||"auto")===v) o.selected=true;
        dirSel.appendChild(o);
      });
      dirSel.addEventListener("change", () => { line.direction = dirSel.value; });
      cfgRow.append(maxLbl, maxInp, dirLbl, dirSel);
      box.appendChild(cfgRow);

      // Start/End placement buttons
      const ptRow = document.createElement("div");
      ptRow.style.cssText = "display:flex;gap:4px";
      ["start","end"].forEach(pt => {
        const isPlacing = this._placingEnergyPt?.lineIdx===idx && this._placingEnergyPt?.point===pt;
        const hasCoord  = pt==="start" ? line.x1!=null : line.x2!=null;
        const btn = document.createElement("button");
        btn.style.cssText = `flex:1;font-size:8px;padding:3px 2px;border-radius:3px;border:1px solid ${isPlacing?"#f59e0b":hasCoord?"var(--accent)":"var(--border)"};background:${isPlacing?"rgba(245,158,11,0.15)":"transparent"};color:${isPlacing?"#f59e0b":hasCoord?"var(--accent)":"var(--muted)"};cursor:pointer;font-family:inherit;font-weight:700`;
        btn.textContent = isPlacing ? "📍 Klick…" : (pt==="start" ? "▶ START" : "⏹ ENDE") + (hasCoord&&!isPlacing?" ✓":"");
        btn.addEventListener("click", () => {
          this._placingEnergyPt = isPlacing ? null : { lineIdx: idx, point: pt };
          this._placingBatteryIdx = -1;
          this._rebuildSidebar();
        });
        ptRow.appendChild(btn);
      });
      box.appendChild(ptRow);
      wrap.appendChild(box);
    });

    // Add line
    const addBtn = document.createElement("button");
    addBtn.className = "btn btn-outline";
    addBtn.style.cssText = "width:100%;border-color:#f59e0b;color:#f59e0b;margin-top:2px";
    addBtn.textContent = "+ Leitung hinzufügen";
    addBtn.addEventListener("click", () => {
      this._pendingEnergyLines.push({ id:"el_"+Date.now(), name:"Leitung "+(this._pendingEnergyLines.length+1), type:"solar", entity:"", max_w:5000, direction:"auto", x1:null,y1:null,x2:null,y2:null });
      this._rebuildSidebar();
    });
    wrap.appendChild(addBtn);

    // ── AKKUS ──────────────────────────────────────────────────────────────
    const bHdr = document.createElement("div");
    bHdr.style.cssText = "font-size:8px;font-weight:700;color:var(--muted);letter-spacing:0.5px;margin-top:6px";
    bHdr.textContent = "AKKUS / SPEICHER";
    wrap.appendChild(bHdr);

    (this._pendingBatteries || []).forEach((bat, idx) => {
      const box = document.createElement("div");
      box.style.cssText = "background:var(--surf2);border-radius:6px;padding:6px 8px;border:1px solid var(--border)";

      const hrow = document.createElement("div");
      hrow.style.cssText = "display:flex;align-items:center;gap:5px;margin-bottom:3px";
      const nInp = document.createElement("input"); nInp.value=bat.name||""; nInp.placeholder="Name";
      nInp.style.cssText="flex:1;background:var(--surf3);border:1px solid var(--border);color:var(--text);border-radius:3px;font-size:9px;padding:2px 4px";
      nInp.addEventListener("input",()=>{bat.name=nInp.value;});
      const del=document.createElement("button"); del.textContent="✕"; del.style.cssText="background:none;border:none;color:var(--muted);cursor:pointer;font-size:10px;padding:0 2px";
      del.addEventListener("click",()=>{this._pendingBatteries.splice(idx,1);this._rebuildSidebar();this._draw();});
      hrow.append(nInp,del);
      box.appendChild(hrow);

      // SOC entity
      ["entity","power_entity"].forEach((field,fi) => {
        const row=document.createElement("div"); row.style.cssText="display:flex;align-items:center;gap:4px;margin-bottom:3px";
        const lbl=document.createElement("span"); lbl.textContent=fi===0?"SOC":"Power"; lbl.style.cssText="font-size:7px;color:var(--muted);width:36px;flex-shrink:0";
        const inp=document.createElement("input"); inp.value=bat[field]||""; inp.placeholder=fi===0?"sensor.akku_soc":"sensor.akku_power";
        inp.style.cssText="flex:1;background:var(--surf3);border:1px solid var(--border);color:var(--text);border-radius:3px;font-size:8px;padding:2px 4px";
        inp.addEventListener("input",()=>{bat[field]=inp.value.trim();});
        const val=document.createElement("span"); val.style.cssText="font-size:8px;font-weight:700;flex-shrink:0;min-width:28px;text-align:right";
        if(bat[field]&&this._hass?.states?.[bat[field]]){
          const v=parseFloat(this._hass.states[bat[field]].state);
          if(fi===0){const c=v>60?"#4ade80":v>20?"#f59e0b":"#ef4444";val.textContent=`${v.toFixed(0)}%`;val.style.color=c;}
          else{val.textContent=`${Math.abs(v).toFixed(0)}W`;val.style.color=v>=0?"#4ade80":"#f59e0b";}
        } else {val.textContent="–";val.style.color="var(--muted)";}
        row.append(lbl,inp,val);
        box.appendChild(row);
      });

      // Place button
      const isPlacing=this._placingBatteryIdx===idx;
      const plBtn=document.createElement("button");
      plBtn.style.cssText=`width:100%;font-size:8px;padding:3px;border-radius:3px;border:1px solid ${isPlacing?"#4ade80":"var(--border)"};background:${isPlacing?"rgba(74,222,128,0.12)":"transparent"};color:${isPlacing?"#4ade80":"var(--muted)"};cursor:pointer;font-family:inherit;font-weight:700`;
      plBtn.textContent=isPlacing?"📍 Klick auf Karte…":`📍 Platzieren${bat.mx!=null?" ✓":""}`;
      plBtn.addEventListener("click",()=>{this._placingBatteryIdx=isPlacing?-1:idx;this._placingEnergyPt=null;this._rebuildSidebar();});
      box.appendChild(plBtn);
      wrap.appendChild(box);
    });

    const addBatBtn=document.createElement("button");
    addBatBtn.className="btn btn-outline";
    addBatBtn.style.cssText="width:100%;border-color:#4ade80;color:#4ade80;margin-top:2px";
    addBatBtn.textContent="+ Akku hinzufügen";
    addBatBtn.addEventListener("click",()=>{
      this._pendingBatteries.push({id:"bat_"+Date.now(),name:"Akku "+(this._pendingBatteries.length+1),entity:"",power_entity:"",mx:null,my:null});
      this._rebuildSidebar();
    });
    wrap.appendChild(addBatBtn);

    // Save
    const saveBtn=document.createElement("button");
    saveBtn.className="btn btn-green";
    saveBtn.style.cssText="width:100%;margin-top:8px;padding:9px;font-size:10px;font-weight:700";
    saveBtn.textContent="💾 Energie speichern";
    saveBtn.addEventListener("click",()=>this._saveEnergie());
    wrap.appendChild(saveBtn);

    // ── ENERGIE-RAUM-KORRELATION ────────────────────────────────────────────
    if (this._opts?.energyRoomCorr) {
      const ercBox = document.createElement("div");
      ercBox.style.cssText = "background:var(--surf2);border-radius:6px;padding:8px;border:1px solid #06b6d444;margin-top:4px";
      const ercHdr = document.createElement("div");
      ercHdr.style.cssText = "font-size:9px;font-weight:700;color:#06b6d4;letter-spacing:0.5px;margin-bottom:6px";
      ercHdr.textContent = "📊 VERBRAUCH PRO RAUM";
      ercBox.appendChild(ercHdr);
      this._updateEnergyRoomCorrelation();
      const rooms2 = this._data?.rooms || [];
      const maxWh = Math.max(...Object.values(this._energyRoomData || {}).map(r => r.wh || 0), 0.001);
      if (!rooms2.length || maxWh < 0.001) {
        const nodata = document.createElement("div");
        nodata.style.cssText = "font-size:8px;color:var(--muted);padding:4px";
        nodata.textContent = "Keine Daten. Raum-Verlauf + Energie-Entity konfigurieren.";
        ercBox.appendChild(nodata);
      } else {
        const sortedR = [...rooms2].sort((a,b)=>(this._energyRoomData[b.name]?.wh||0)-(this._energyRoomData[a.name]?.wh||0));
        sortedR.forEach(room => {
          const data = this._energyRoomData[room.name];
          const wh = data?.wh || 0;
          const share = data?.share || 0;
          const minutes = data?.minutes || 0;
          const intensity = wh / maxWh;
          const rr2=Math.round(intensity>0.5?255:intensity*2*255);
          const gg2=Math.round(intensity<0.5?intensity*2*200:(1-intensity)*2*200);
          const bb2=Math.round(intensity<0.5?255*(1-intensity*2):0);
          const barColor=`rgb(${rr2},${gg2},${bb2})`;
          const row=document.createElement("div"); row.style.cssText="margin-bottom:5px";
          const rowH=document.createElement("div"); rowH.style.cssText="display:flex;justify-content:space-between;margin-bottom:2px";
          const nameS=document.createElement("span"); nameS.style.cssText="font-size:8px;color:var(--text);font-weight:600"; nameS.textContent=room.name;
          const valS=document.createElement("span"); valS.style.cssText=`font-size:8px;font-weight:700;color:${barColor}`; valS.textContent=wh<100?wh.toFixed(0)+"Wh":(wh/1000).toFixed(2)+"kWh";
          rowH.append(nameS,valS);
          const bar=document.createElement("div"); bar.style.cssText="height:4px;background:var(--surf3);border-radius:2px;overflow:hidden";
          const fill=document.createElement("div"); fill.style.cssText=`height:100%;width:${(intensity*100).toFixed(1)}%;background:${barColor};border-radius:2px`;
          bar.appendChild(fill);
          const sub=document.createElement("div"); sub.style.cssText="font-size:7px;color:var(--muted);margin-top:1px";
          sub.textContent=`${(share*100).toFixed(0)}% Anwesenheit · ${minutes}min`;
          row.append(rowH,bar,sub); ercBox.appendChild(row);
        });
        const total=Object.values(this._energyRoomData||{}).reduce((s,r)=>s+(r.wh||0),0);
        const totRow=document.createElement("div"); totRow.style.cssText="display:flex;justify-content:space-between;padding-top:5px;margin-top:3px;border-top:1px solid var(--border)";
        totRow.innerHTML=`<span style="font-size:8px;font-weight:700;color:var(--text)">GESAMT</span><span style="font-size:8px;font-weight:700;color:#f59e0b">${total<100?total.toFixed(0)+"Wh":(total/1000).toFixed(2)+"kWh"}</span>`;
        ercBox.appendChild(totRow);
      }
      wrap.appendChild(ercBox);
    }

    return wrap;
  }

  async _saveEnergie() {
    try {
      await this._hass.callApi("POST",
        `ble_positioning/${this._entryId}/energy`,
        { energy_lines: this._pendingEnergyLines, batteries: this._pendingBatteries });
      await this._loadData();
      this._showToast("✓ Energie gespeichert");
    } catch(e) { this._showToast("✗ " + (e?.body?.message || e?.message || e)); }
    this._rebuildSidebar();
  }


  // ══════════════════════════════════════════════════════════════════════════
  // ── DEKO ELEMENTS ─────────────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════

  _sidebarDeko() {
    const wrap = document.createElement("div");
    wrap.style.cssText = "padding:8px;display:flex;flex-direction:column;gap:5px";

    const hdr = document.createElement("div");
    hdr.style.cssText = "font-size:10px;font-weight:700;color:#10b981;letter-spacing:1px;margin-bottom:4px";
    hdr.textContent = "🏗 DEKO-ELEMENTE";
    wrap.appendChild(hdr);

    const hint = document.createElement("div");
    hint.style.cssText = "font-size:7px;color:var(--muted);margin-bottom:6px";
    hint.textContent = "Element wählen → auf Karte klicken zum Platzieren · Drag zum Verschieben";
    wrap.appendChild(hint);

    // Element type buttons
    const DEKO_TYPES = [
      { id:"solar",       label:"Solarplatten",   icon:"☀️" },
      { id:"inverter",    label:"Wechselrichter",  icon:"⚡" },
      { id:"powerpole",   label:"Strommast",       icon:"🗼" },
      { id:"battery",     label:"Batterie",        icon:"🔋" },
      { id:"watertank",   label:"Wassertank",      icon:"💧" },
      { id:"tree",        label:"Baum",            icon:"🌳" },
      { id:"parking",     label:"Stellplatz",      icon:"🚗" },
      { id:"antenna",     label:"Antenne/Router",  icon:"📡" },
      { id:"pool",        label:"Pool / Teich",    icon:"🏊" },
      { id:"fence",       label:"Zaun / Hecke",    icon:"🌿" },
      { id:"garage",      label:"Garage / Carport", icon:"🏠" },
      { id:"raisedbed",   label:"Hochbeet",         icon:"🌱" },
      { id:"gardenbed",   label:"Bodenbeet",         icon:"🌾" },
      { id:"trellis",     label:"Spalier",           icon:"🪴" },
      { id:"sprinkler",   label:"Rasensprinkler",    icon:"💦" },
      { id:"rockgarden",  label:"Steingarten",       icon:"🪨" },
      { id:"shedhouse",   label:"Gartenhaus",        icon:"🛖" },
      { id:"gardenlight", label:"Gartenlampe",       icon:"🔦" },
      { id:"pondpump",    label:"Teichpumpe",        icon:"🌊" },
      { id:"bench",       label:"Gartenbank",        icon:"🪑" },
      { id:"fireplace",   label:"Feuerstelle",       icon:"🔥" },
      { id:"greenhouse",  label:"Gewächshaus",       icon:"🏡" },
      // ── Indoor / Smart Home ──────────────────────────────────────────────
      { id:"tv",          label:"Fernseher",          icon:"📺", indoor:true, hasEntity:true },
      { id:"speaker",    label:"Lautsprecher",        icon:"🔊", indoor:true, hasEntity:true },
      { id:"couch",      label:"Sofa / Couch",        icon:"🛋", indoor:true },
      { id:"bed",        label:"Bett",                icon:"🛏", indoor:true },
      { id:"desk",       label:"Schreibtisch",        icon:"🖥", indoor:true },
      { id:"table",      label:"Tisch",               icon:"🪑", indoor:true },
      { id:"fridge",     label:"Kühlschrank",         icon:"🧊", indoor:true, hasEntity:true },
      { id:"washingmachine", label:"Waschmaschine",   icon:"🫧", indoor:true, hasEntity:true },
      { id:"dishwasher", label:"Spülmaschine",        icon:"🍽", indoor:true, hasEntity:true },
      { id:"pc",         label:"PC / Computer",       icon:"💻", indoor:true, hasEntity:true },
      { id:"thermostat", label:"Thermostat",          icon:"🌡", indoor:true, hasEntity:true },
      { id:"door",       label:"Tür (Sensor)",        icon:"🚪", indoor:true, hasEntity:true },
      { id:"window_deko",label:"Fenster (Sensor)",    icon:"🪟", indoor:true, hasEntity:true },
      { id:"plug",       label:"Steckdose / Plug",    icon:"🔌", indoor:true, hasEntity:true },
      { id:"router",     label:"Router / Hub",        icon:"📡", indoor:true, hasEntity:true },
    ];

    // ── Outdoor-Kategorie ────────────────────────────────────────────────────
    const outdoorHdr = document.createElement("div");
    outdoorHdr.style.cssText = "font-size:7.5px;font-weight:700;color:#10b981;margin-bottom:4px;margin-top:2px;letter-spacing:0.5px";
    outdoorHdr.textContent = "🌿 OUTDOOR / GARTEN";
    wrap.appendChild(outdoorHdr);

    const outdoorGrid = document.createElement("div");
    outdoorGrid.style.cssText = "display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-bottom:8px";

    const indoorHdrEl = document.createElement("div");
    indoorHdrEl.style.cssText = "font-size:7.5px;font-weight:700;color:#38bdf8;margin-bottom:4px;margin-top:2px;letter-spacing:0.5px";
    indoorHdrEl.textContent = "🏠 INDOOR / SMART HOME";

    const indoorGrid = document.createElement("div");
    indoorGrid.style.cssText = "display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-bottom:8px";

    DEKO_TYPES.forEach(t => {
      const btn = document.createElement("button");
      const isActive = this._dekoPlacing === t.id;
      const col = t.indoor ? "#38bdf8" : "#10b981";
      btn.style.cssText = `padding:5px 4px;border-radius:5px;border:1px solid ${isActive?col:"var(--border)"};background:${isActive?col+"33":"var(--surf2)"};color:${isActive?col:"var(--text)"};font-size:8px;cursor:pointer;text-align:center;transition:all 0.15s`;
      btn.innerHTML = `<div style="font-size:14px">${t.icon}</div><div style="font-weight:700;margin-top:1px">${t.label}</div>`;
      if (t.hasEntity) btn.innerHTML += `<div style="font-size:6px;color:${col}88;margin-top:1px">HA-Entity</div>`;
      btn.addEventListener("click", () => {
        this._dekoPlacing = isActive ? null : t.id;
        this._canvas.style.cursor = this._dekoPlacing ? "crosshair" : "default";
        this._rebuildSidebar();
      });
      (t.indoor ? indoorGrid : outdoorGrid).appendChild(btn);
    });
    wrap.appendChild(outdoorGrid);
    wrap.appendChild(indoorHdrEl);
    wrap.appendChild(indoorGrid);

    // ── Eigene Designs (Custom) ──────────────────────────────────────────────
    const customDesigns = (this._pendingDesigns||[]).filter(d=>d.use_as_deko||d.category==="deko"||d.category==="both");
    if (customDesigns.length) {
      const cdHdr = document.createElement("div");
      cdHdr.style.cssText = "font-size:8px;font-weight:700;color:#f59e0b;margin-top:8px;margin-bottom:4px;letter-spacing:0.5px";
      cdHdr.textContent = "🎨 EIGENE DESIGNS";
      wrap.appendChild(cdHdr);
      const cdGrid = document.createElement("div");
      cdGrid.style.cssText = "display:grid;grid-template-columns:repeat(3,1fr);gap:4px;margin-bottom:6px";
      customDesigns.forEach(cd => {
        const btn = document.createElement("button");
        const isA = this._dekoPlacing === cd.id;
        btn.style.cssText = `padding:5px 4px;border-radius:5px;border:1px solid ${isA?"#f59e0b":"var(--border)"};background:${isA?"#f59e0b33":"var(--surf2)"};color:${isA?"#f59e0b":"var(--text)"};font-size:8px;cursor:pointer;text-align:center;`;
        // Mini preview canvas
        const pc = document.createElement("canvas"); pc.width=32; pc.height=24;
        pc.style.cssText="border-radius:3px;background:#080c15;display:block;margin:0 auto 2px";
        this._renderDesignPreview(pc, cd);
        const lbl = document.createElement("div"); lbl.style.cssText="font-size:7px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis"; lbl.textContent=cd.name;
        btn.append(pc, lbl);
        btn.addEventListener("click", () => { this._dekoPlacing = isA ? null : cd.id; this._rebuildSidebar(); });
        cdGrid.appendChild(btn);
      });
      wrap.appendChild(cdGrid);
    }

    // Placed elements list
    if (this._pendingDecos.length) {
      const listHdr = document.createElement("div");
      listHdr.style.cssText = "font-size:8px;font-weight:700;color:var(--muted);margin-top:4px;margin-bottom:3px";
      listHdr.textContent = "PLATZIERTE ELEMENTE";
      wrap.appendChild(listHdr);

      this._pendingDecos.forEach((deco, idx) => {
        const ALL_TYPES = [...DEKO_TYPES, ...(this._pendingDesigns||[]).filter(d=>d.use_as_deko||d.category==="deko"||d.category==="both")];
        const typeInfo = ALL_TYPES.find(t => t.id === deco.type) || { icon:"❓", label:deco.type };
        const row = document.createElement("div");
        row.style.cssText = "background:var(--surf2);border-radius:5px;padding:5px 7px;border:1px solid var(--border)";

        const top = document.createElement("div");
        top.style.cssText = "display:flex;align-items:center;gap:5px;margin-bottom:4px";
        const ico = document.createElement("span"); ico.textContent = typeInfo.icon; ico.style.fontSize="12px";
        const lbl = document.createElement("input");
        lbl.value = deco.label || typeInfo.label;
        lbl.style.cssText = "flex:1;background:var(--surf3);border:1px solid var(--border);color:var(--text);border-radius:3px;font-size:8px;padding:2px 4px";
        lbl.addEventListener("input", () => { this._pendingDecos[idx].label = lbl.value; this._draw(); });
        const del = document.createElement("button");
        del.textContent = "✕"; del.style.cssText = "font-size:9px;background:none;border:none;color:#ef4444;cursor:pointer;padding:0 2px";
        del.addEventListener("click", () => { this._pendingDecos.splice(idx,1); this._rebuildSidebar(); this._draw(); });
        top.append(ico, lbl, del);

        // Size slider
        const sizeRow = document.createElement("div");
        sizeRow.style.cssText = "display:flex;align-items:center;gap:5px";
        const sizeLbl = document.createElement("span"); sizeLbl.textContent="Größe"; sizeLbl.style.cssText="font-size:7px;color:var(--muted);width:30px";
        const sizeInp = document.createElement("input");
        sizeInp.type="range"; sizeInp.min=0.3; sizeInp.max=4; sizeInp.step=0.1;
        sizeInp.value = deco.size || 1.0;
        sizeInp.style.cssText="flex:1;accent-color:#10b981";
        const sizeVal = document.createElement("span"); sizeVal.style.cssText="font-size:7px;color:#10b981;min-width:22px";
        sizeVal.textContent = (deco.size||1.0).toFixed(1)+"×";
        sizeInp.addEventListener("input",()=>{ this._pendingDecos[idx].size=parseFloat(sizeInp.value); sizeVal.textContent=parseFloat(sizeInp.value).toFixed(1)+"×"; this._draw(); });
        sizeRow.append(sizeLbl, sizeInp, sizeVal);

        // ── Indoor-Element Entitäten ─────────────────────────────────────────
        const INDOOR_ENTITIES = {
          tv:           [{ key:"entity",     label:"📺 An/Aus",      ph:"media_player.tv" },
                         { key:"entity_vol", label:"🔊 Lautstärke",   ph:"media_player.tv" }],
          speaker:      [{ key:"entity",     label:"🔊 An/Aus",      ph:"media_player.lautsprecher" },
                         { key:"entity_vol", label:"🎵 Titel",        ph:"media_player.lautsprecher" }],
          fridge:       [{ key:"entity",     label:"🚨 Offen-Alarm",  ph:"binary_sensor.kuehlschrank_tuer" },
                         { key:"entity_temp",label:"🌡 Temperatur",   ph:"sensor.kuehlschrank_temp" }],
          washingmachine:[{ key:"entity",    label:"⚡ Status",       ph:"sensor.waschmaschine" },
                          { key:"entity_prog",label:"⏱ Programm",    ph:"sensor.waschmaschine_programm" }],
          dishwasher:   [{ key:"entity",     label:"⚡ Status",       ph:"sensor.spuelmaschine" }],
          pc:           [{ key:"entity",     label:"💻 An/Aus",       ph:"switch.pc" }],
          thermostat:   [{ key:"entity",     label:"🌡 Temperatur",   ph:"sensor.thermostat_temperature" },
                         { key:"entity_set", label:"🎯 Sollwert",     ph:"climate.heizung" }],
          door:         [{ key:"entity",     label:"🚪 Offen/Zu",    ph:"binary_sensor.haustuer" }],
          window_deko:  [{ key:"entity",     label:"🪟 Offen/Zu",    ph:"binary_sensor.fenster" }],
          plug:         [{ key:"entity",     label:"🔌 An/Aus",       ph:"switch.steckdose" },
                         { key:"entity_watt",label:"⚡ Watt",         ph:"sensor.steckdose_power" }],
          router:       [{ key:"entity",     label:"📡 Status",       ph:"device_tracker.router" }],
        };
        const indoorFields = INDOOR_ENTITIES[deco.type];
        if (indoorFields) {
          const entHdr = document.createElement("div");
          entHdr.style.cssText = "font-size:7px;font-weight:700;color:#38bdf8;margin-top:6px;margin-bottom:3px;letter-spacing:0.5px";
          entHdr.textContent = "🔗 HOME ASSISTANT ENTITÄTEN";
          row.appendChild(entHdr);
          indoorFields.forEach(ef => {
            const efRow = document.createElement("div");
            efRow.style.cssText = "display:flex;align-items:center;gap:4px;margin-bottom:2px";
            const efLbl = document.createElement("span");
            efLbl.style.cssText = "font-size:7px;color:var(--muted);width:70px;flex-shrink:0;white-space:nowrap";
            efLbl.textContent = ef.label;
            const efInp = document.createElement("input");
            efInp.value = deco[ef.key] || "";
            efInp.placeholder = ef.ph;
            efInp.style.cssText = "flex:1;background:var(--surf3);border:1px solid var(--border);color:#38bdf8;border-radius:3px;font-size:7px;padding:2px 4px;min-width:0;font-family:inherit";
            efInp.addEventListener("input", () => { this._pendingDecos[idx][ef.key] = efInp.value.trim(); this._draw(); });
            // Live-Status Badge
            const badge = document.createElement("span");
            badge.style.cssText = "font-size:6px;white-space:nowrap";
            const st = this._hass?.states?.[deco[ef.key]||""];
            badge.textContent = st ? "✓" : "";
            badge.style.color = st ? "#22c55e" : "#ef4444";
            efInp.addEventListener("input", () => {
              const s2 = this._hass?.states?.[efInp.value.trim()];
              badge.textContent = s2 ? "✓ "+s2.state : "";
              badge.style.color = s2 ? "#22c55e" : "#445566";
            });
            if (st) badge.textContent = "✓ "+st.state;
            efRow.append(efLbl, efInp, badge);
            row.appendChild(efRow);
          });
        }

        // ── Pool-spezifische Entitäten ──────────────────────────────────────
        if (deco.type === "pool") {
          const poolHdr = document.createElement("div");
          poolHdr.style.cssText = "font-size:7px;font-weight:700;color:#67e8f9;margin-top:6px;margin-bottom:3px;letter-spacing:0.5px";
          poolHdr.textContent = "🏊 POOL ENTITÄTEN";
          row.appendChild(poolHdr);

          const poolFields = [
            { key:"pool_temp",    label:"🌡 Temperatur",   placeholder:"sensor.pool_temperatur" },
            { key:"pool_ph",      label:"🧪 pH-Wert",      placeholder:"sensor.pool_ph" },
            { key:"pool_pump",    label:"⚙ Pumpe",          placeholder:"switch.pool_pumpe" },
            { key:"pool_heat",    label:"🔥 Heizung",       placeholder:"switch.pool_heizung" },
            { key:"pool_chlor",   label:"💊 Chlor",         placeholder:"sensor.pool_chlor" },
            { key:"pool_filter",  label:"🔵 Filter",        placeholder:"switch.pool_filter" },
          ];

          poolFields.forEach(pf => {
            const pfRow = document.createElement("div");
            pfRow.style.cssText = "display:flex;align-items:center;gap:4px;margin-bottom:2px";
            const pfLbl = document.createElement("span");
            pfLbl.style.cssText = "font-size:7px;color:var(--muted);width:60px;flex-shrink:0";
            pfLbl.textContent = pf.label;
            const pfInp = document.createElement("input");
            pfInp.value = deco[pf.key] || "";
            pfInp.placeholder = pf.placeholder;
            pfInp.style.cssText = "flex:1;background:var(--surf3);border:1px solid var(--border);color:#67e8f9;border-radius:3px;font-size:7px;padding:2px 4px;min-width:0";
            pfInp.addEventListener("input", () => {
              this._pendingDecos[idx][pf.key] = pfInp.value.trim();
              this._draw();
            });
            pfRow.append(pfLbl, pfInp);
            row.appendChild(pfRow);
          });

          // Color picker
          const colorRow = document.createElement("div");
          colorRow.style.cssText = "display:flex;align-items:center;gap:4px;margin-top:4px";
          const colorLbl = document.createElement("span");
          colorLbl.style.cssText = "font-size:7px;color:var(--muted);width:60px";
          colorLbl.textContent = "🎨 Poolfarbe";
          const colorInp = document.createElement("input");
          colorInp.type = "color";
          colorInp.value = deco.pool_color || "#0891b2";
          colorInp.style.cssText = "width:32px;height:18px;border:1px solid var(--border);border-radius:3px;background:none;cursor:pointer";
          colorInp.addEventListener("input", () => {
            this._pendingDecos[idx].pool_color = colorInp.value;
            this._draw();
          });
          colorRow.append(colorLbl, colorInp);
          row.appendChild(colorRow);
        }

        row.append(top, sizeRow);
        wrap.appendChild(row);
      });
    }

    // Save button
    const saveBtn = document.createElement("button");
    saveBtn.textContent = "💾 Deko speichern";
    saveBtn.style.cssText = "margin-top:8px;padding:7px;border-radius:6px;background:#10b981;color:#07090d;font-weight:700;font-size:9px;border:none;cursor:pointer;width:100%";
    saveBtn.addEventListener("click", () => this._saveDeko());
    wrap.appendChild(saveBtn);

    return wrap;
  }

  async _saveDeko() {
    try {
      await this._hass.callApi("POST",
        `ble_positioning/${this._entryId}/deko`,
        { decos: this._pendingDecos });
      if (this._data) this._data.decos = structuredClone(this._pendingDecos);
      this._showToast("✓ Deko gespeichert");
    } catch(e) { this._showToast("✗ " + (e?.body?.message || e?.message || e)); }
    this._rebuildSidebar();
  }

  // ── 2D Deco Drawing ────────────────────────────────────────────────────────
  _drawDecos(decos, isEdit=false) {
    if (!decos?.length) return;
    const ctx = this._ctx;
    decos.forEach((deco, idx) => {
      if (deco.mx == null || deco.my == null) return;
      const pos  = this._f2c(deco.mx, deco.my);
      const size = (deco.size || 1.0) * 18;
      ctx.save();
      ctx.translate(pos.x, pos.y);
      // Pass pool color via ctx property (no global pollution)
      ctx._poolColor = deco.type === "pool" ? (deco.pool_color || null) : null;
      // Custom design?
      const customDef = (this._pendingDesigns||this._data?.custom_designs||[]).find(d=>d.id===deco.type);
      if (customDef) {
        ctx.scale(size/100, size/100);
        (customDef.shapes2d||[]).forEach(sh => { if(!sh.hidden) this._drawDesignShape(ctx, sh, false); });
        ctx.scale(100/size, 100/size);
      } else {
        // ── Entity-Status für Indoor-Elemente in ctx injizieren ──────────────
        // _drawDecoSymbol2D liest ctx._entityOn / ctx._entityVal / ctx._entityWatt
        ctx._entityOn  = false;
        ctx._entityVal = null;
        ctx._entityWatt= null;
        ctx._entitySet = null;
        if (deco.entity && this._hass) {
          const st = this._hass.states[deco.entity];
          if (st) {
            const s = (st.state||"").toLowerCase();
            ctx._entityOn = ["on","open","home","playing","heat","cool","auto","true","1","active","running"].includes(s);
            ctx._entityVal = st.state;
            // media_player: Zustand verfeinern
            if (st.attributes?.volume_level != null) ctx._entityVol = st.attributes.volume_level;
            if (st.attributes?.media_title)          ctx._entityTitle = st.attributes.media_title;
            if (st.attributes?.temperature != null)  ctx._entityVal = st.attributes.temperature;
          }
        }
        // Watt-Entity (Plug)
        if (deco.entity_watt && this._hass) {
          const sw = this._hass.states[deco.entity_watt];
          if (sw) ctx._entityWatt = parseFloat(sw.state) || 0;
        }
        // Sollwert-Entity (Thermostat)
        if (deco.entity_set && this._hass) {
          const ss = this._hass.states[deco.entity_set];
          if (ss) ctx._entitySet = ss.attributes?.temperature ?? parseFloat(ss.state);
        }
        this._drawDecoSymbol2D(ctx, deco.type, size, isEdit && this._dekoSelected === idx);
        // Cleanup
        ctx._entityOn=false; ctx._entityVal=null; ctx._entityWatt=null; ctx._entitySet=null;
      }
      ctx._poolColor = null;
      // Pool entity overlay
      if (deco.type === "pool" && this._hass) {
        const hs2 = size/2;
        const rows = [];
        if (deco.pool_temp && this._hass.states[deco.pool_temp]) {
          const v=this._hass.states[deco.pool_temp]; rows.push("🌡 "+parseFloat(v.state).toFixed(1)+(v.attributes?.unit_of_measurement||"°C"));
        }
        if (deco.pool_ph && this._hass.states[deco.pool_ph]) {
          rows.push("🧪 pH "+parseFloat(this._hass.states[deco.pool_ph].state).toFixed(1));
        }
        if (deco.pool_pump && this._hass.states[deco.pool_pump]) {
          const on=["on","true","1"].includes(this._hass.states[deco.pool_pump].state.toLowerCase());
          rows.push("⚙ "+( on ? "Pumpe AN" : "Pumpe AUS"));
        }
        if (deco.pool_heat && this._hass.states[deco.pool_heat]) {
          const on=["on","true","1"].includes(this._hass.states[deco.pool_heat].state.toLowerCase());
          rows.push("🔥 "+( on ? "Heiz AN" : "Heiz AUS"));
        }
        if (deco.pool_chlor && this._hass.states[deco.pool_chlor]) {
          rows.push("💊 "+parseFloat(this._hass.states[deco.pool_chlor].state).toFixed(2)+" mg/l");
        }
        if (rows.length) {
          const fh = 8.5;
          const boxH = rows.length * fh + 6;
          const boxW = size * 1.1;
          // Background
          ctx.fillStyle = "rgba(7,9,13,0.82)";
          ctx.beginPath();
          ctx.roundRect(-boxW/2, hs2+2, boxW, boxH, 4);
          ctx.fill();
          ctx.strokeStyle = "#67e8f9";
          ctx.lineWidth = 0.6;
          ctx.stroke();
          rows.forEach((row,ri) => {
            ctx.font = "bold 7px 'JetBrains Mono',monospace";
            ctx.fillStyle = ri===0?"#67e8f9":ri===2||ri===3?"#22c55e":"#94a3b8";
            ctx.textAlign = "center";
            ctx.fillText(row, 0, hs2+2+fh*(ri+1));
          });
        }
      }
      // ── Status-Overlay für Indoor-Elemente ──────────────────────────────
      const INDOOR_STATUS_TYPES = ["tv","speaker","fridge","washingmachine","dishwasher","pc","thermostat","door","window_deko","plug","router"];
      if (INDOOR_STATUS_TYPES.includes(deco.type) && this._hass && deco.entity) {
        const st = this._hass.states[deco.entity];
        if (st) {
          const stateStr = (st.state||"").toLowerCase();
          const isOn = ["on","open","home","playing","heat","cool","active","running"].includes(stateStr);
          const rows = [];
          // Haupt-Status
          const stateLabel = {
            "on":"AN","off":"AUS","open":"OFFEN","closed":"ZU","home":"HOME","not_home":"WEG",
            "playing":"▶ spielt","paused":"⏸ pause","idle":"bereit","unavailable":"–"
          }[stateStr] || st.state;
          rows.push({ text: stateLabel, color: isOn?"#22c55e":"#445566" });
          // Zusatzinfo je Typ
          if (deco.type==="tv"||deco.type==="speaker") {
            if (st.attributes?.media_title) rows.push({ text: (st.attributes.media_title||"").substring(0,12), color:"#94a3b8" });
            if (st.attributes?.volume_level!=null) rows.push({ text:"🔊 "+(st.attributes.volume_level*100|0)+"%", color:"#445566" });
          }
          if (deco.type==="thermostat") {
            if (st.attributes?.temperature!=null) rows.push({ text:"🎯 "+st.attributes.temperature+"°", color:"#f59e0b" });
            if (st.attributes?.current_temperature!=null) rows.push({ text:"🌡 "+st.attributes.current_temperature+"°", color:"#38bdf8" });
          }
          if (deco.type==="plug" && deco.entity_watt) {
            const sw=this._hass.states[deco.entity_watt];
            if(sw) rows.push({ text:"⚡ "+(parseFloat(sw.state)<1000?Math.round(sw.state)+"W":(sw.state/1000).toFixed(1)+"kW"), color:"#f59e0b" });
          }
          if (rows.length) {
            const fh=8.5, boxH=rows.length*fh+5, boxW=size*1.15;
            ctx.fillStyle="rgba(7,9,13,0.82)";
            ctx.beginPath(); ctx.roundRect(-boxW/2,size*0.5+2,boxW,boxH,3); ctx.fill();
            ctx.strokeStyle=isOn?"#22c55e33":"#1c2535"; ctx.lineWidth=0.6; ctx.stroke();
            rows.forEach((r,ri)=>{
              ctx.font=`bold 7px 'JetBrains Mono',monospace`;
              ctx.fillStyle=r.color; ctx.textAlign="center";
              ctx.fillText(r.text,0,size*0.5+2+fh*(ri+1));
            });
          }
        }
      }
      // Label
      ctx.font = "bold 7px 'JetBrains Mono',monospace";
      ctx.fillStyle = "#10b981";
      ctx.textAlign = "center";
      ctx.fillText(deco.label || deco.type, 0, size + 9);
      ctx.restore();
    });
  }

  _drawDecoSymbol2D(ctx, type, s, selected=false) {
    const hs = s / 2;
    if (selected) {
      ctx.strokeStyle = "#10b981"; ctx.lineWidth = 1.5;
      ctx.setLineDash([3,2]);
      ctx.strokeRect(-hs-4, -hs-4, s+8, s+8);
      ctx.setLineDash([]);
    }
    switch(type) {
      case "solar": {
        // Solar panel: blue cells in a frame
        ctx.fillStyle = "#1e3a5f"; ctx.strokeStyle="#00aaff"; ctx.lineWidth=1;
        ctx.fillRect(-hs,-hs,s,s); ctx.strokeRect(-hs,-hs,s,s);
        // Grid of cells
        const cells = 3;
        ctx.strokeStyle="#00aaff88"; ctx.lineWidth=0.5;
        for(let i=1;i<cells;i++){
          ctx.beginPath(); ctx.moveTo(-hs+i*(s/cells),-hs); ctx.lineTo(-hs+i*(s/cells),hs); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(-hs,-hs+i*(s/cells)); ctx.lineTo(hs,-hs+i*(s/cells)); ctx.stroke();
        }
        // Shine
        ctx.fillStyle="rgba(100,180,255,0.12)";
        ctx.beginPath(); ctx.moveTo(-hs,-hs); ctx.lineTo(hs,-hs); ctx.lineTo(-hs,hs); ctx.closePath(); ctx.fill();
        break;
      }
      case "inverter": {
        ctx.fillStyle="#1c2840"; ctx.strokeStyle="#f59e0b"; ctx.lineWidth=1.2;
        ctx.fillRect(-hs,-hs,s,s); ctx.strokeRect(-hs,-hs,s,s);
        // Lightning bolt
        ctx.fillStyle="#f59e0b";
        ctx.beginPath(); ctx.moveTo(0,-hs*0.6); ctx.lineTo(-hs*0.25,0); ctx.lineTo(0,0);
        ctx.lineTo(-hs*0.1,hs*0.6); ctx.lineTo(hs*0.25,0); ctx.lineTo(0,0); ctx.closePath(); ctx.fill();
        // LEDs
        [[-hs*0.5, hs*0.7],[0,hs*0.7],[hs*0.5,hs*0.7]].forEach(([x,y])=>{
          ctx.fillStyle="#22c55e"; ctx.beginPath(); ctx.arc(x,y,2,0,Math.PI*2); ctx.fill();
        });
        break;
      }
      case "powerpole": {
        // Electricity pole: vertical beam + cross arms + wires
        ctx.strokeStyle="#94a3b8"; ctx.fillStyle="#475569"; ctx.lineWidth=1.5;
        // Main pole
        ctx.fillRect(-s*0.06,-hs,s*0.12,s);
        // Cross arms
        ctx.fillRect(-hs,-hs*0.3,s,s*0.08);
        ctx.fillRect(-hs*0.6,-hs*0.6,s*0.6,s*0.08);
        // Insulators
        [[-hs,-hs*0.3],[-hs*0.5,-hs*0.3],[hs*0.5,-hs*0.3],[hs,-hs*0.3]].forEach(([x,y])=>{
          ctx.fillStyle="#60a5fa"; ctx.beginPath(); ctx.arc(x,y,2.5,0,Math.PI*2); ctx.fill();
        });
        // Wire lines
        ctx.strokeStyle="#94a3b855"; ctx.lineWidth=0.8;
        ctx.beginPath(); ctx.moveTo(-hs-8,-hs*0.25); ctx.lineTo(hs+8,-hs*0.25); ctx.stroke();
        break;
      }
      case "battery": {
        ctx.fillStyle="#0f2027"; ctx.strokeStyle="#22c55e"; ctx.lineWidth=1.2;
        ctx.fillRect(-hs,-hs*0.8,s,s*1.2); ctx.strokeRect(-hs,-hs*0.8,s,s*1.2);
        // Terminal nub
        ctx.fillStyle="#22c55e";
        ctx.fillRect(-hs*0.2,-hs*0.95,hs*0.4,hs*0.2);
        // Battery level (75%)
        ctx.fillStyle="#22c55e44";
        ctx.fillRect(-hs*0.7,-hs*0.6,s*0.6,s*0.9);
        ctx.fillStyle="#22c55e";
        ctx.fillRect(-hs*0.7,hs*0.1,s*0.6,s*0.3);
        // +/- text
        ctx.fillStyle="#22c55e"; ctx.font=`bold ${s*0.35}px sans-serif`; ctx.textAlign="center";
        ctx.fillText("+",0,-s*0.05);
        break;
      }
      case "watertank": {
        // Cylindrical tank (top view = circle)
        ctx.strokeStyle="#38bdf8"; ctx.lineWidth=1.5;
        // Outer tank
        ctx.fillStyle="#0c4a6e"; ctx.beginPath(); ctx.arc(0,0,hs,0,Math.PI*2); ctx.fill(); ctx.stroke();
        // Water level ring
        ctx.fillStyle="#0ea5e9"; ctx.beginPath(); ctx.arc(0,0,hs*0.65,0,Math.PI*2); ctx.fill();
        // Center
        ctx.fillStyle="#38bdf855"; ctx.beginPath(); ctx.arc(0,0,hs*0.3,0,Math.PI*2); ctx.fill();
        // Pipe
        ctx.strokeStyle="#64748b"; ctx.lineWidth=2;
        ctx.beginPath(); ctx.moveTo(hs,0); ctx.lineTo(hs+s*0.3,0); ctx.stroke();
        break;
      }
      case "tree": {
        // Tree: trunk + layered canopy
        ctx.fillStyle="#713f12"; ctx.fillRect(-s*0.07,0,s*0.14,hs);
        // Three canopy layers
        [[0,-hs,hs],[0,-hs*0.5,hs*0.85],[0,-hs*0.1,hs*0.7]].forEach(([x,y,r],i)=>{
          ctx.fillStyle=i===0?"#166534":i===1?"#15803d":"#16a34a";
          ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill();
        });
        // Highlight
        ctx.fillStyle="rgba(255,255,255,0.12)";
        ctx.beginPath(); ctx.arc(-hs*0.25,-hs*0.75,hs*0.3,0,Math.PI*2); ctx.fill();
        break;
      }
      case "parking": {
        // Parking space: dashed box with P
        ctx.strokeStyle="#64748b"; ctx.lineWidth=1; ctx.setLineDash([3,2]);
        ctx.strokeRect(-hs,-hs,s,s); ctx.setLineDash([]);
        // Car shape (top-down)
        ctx.fillStyle="#334155"; ctx.strokeStyle="#64748b"; ctx.lineWidth=0.8;
        const cw=s*0.55, ch=s*0.8;
        ctx.beginPath(); ctx.roundRect(-cw/2,-ch/2,cw,ch,3); ctx.fill(); ctx.stroke();
        // Windows
        ctx.fillStyle="#60a5fa88";
        ctx.beginPath(); ctx.roundRect(-cw*0.38,-ch*0.28,cw*0.76,ch*0.25,2); ctx.fill();
        ctx.beginPath(); ctx.roundRect(-cw*0.38,ch*0.05,cw*0.76,ch*0.22,2); ctx.fill();
        // Wheels
        ctx.fillStyle="#1e293b";
        [[-cw*0.45,-ch*0.32],[cw*0.3,-ch*0.32],[-cw*0.45,ch*0.2],[cw*0.3,ch*0.2]].forEach(([x,y])=>{
          ctx.beginPath(); ctx.arc(x,y,3,0,Math.PI*2); ctx.fill();
        });
        break;
      }
      case "antenna": {
        // Dish antenna + pole
        ctx.strokeStyle="#94a3b8"; ctx.fillStyle="#1e293b"; ctx.lineWidth=1;
        // Pole
        ctx.fillRect(-s*0.04,0,s*0.08,hs);
        // Dish arc
        ctx.fillStyle="#334155"; ctx.strokeStyle="#94a3b8"; ctx.lineWidth=1.2;
        ctx.beginPath();
        ctx.arc(0,0,hs,Math.PI*1.1,Math.PI*1.9);
        ctx.lineTo(0,0); ctx.closePath(); ctx.fill(); ctx.stroke();
        // Signal rings
        [0.45,0.65,0.85].forEach((r,i)=>{
          ctx.strokeStyle=`rgba(0,229,255,${0.6-i*0.15})`; ctx.lineWidth=0.8;
          ctx.beginPath(); ctx.arc(hs*0.15,-hs*0.2,hs*r,Math.PI*1.25,Math.PI*1.75); ctx.stroke();
        });
        // Center feed
        ctx.fillStyle="#00e5ff"; ctx.beginPath(); ctx.arc(0,-hs*0.05,2.5,0,Math.PI*2); ctx.fill();
        break;
      }
      case "pool": {
        // Determine water color (custom or default)
        const wc = ctx._poolColor ? ctx._poolColor : "#0891b2";
        const [pr,pg,pb] = wc.replace("#","").match(/../g).map(h=>parseInt(h,16));
        ctx.strokeStyle="#67e8f9"; ctx.lineWidth=2;
        ctx.fillStyle=`rgb(${pr},${pg},${pb})`;
        ctx.beginPath(); ctx.roundRect(-hs,-hs*0.8,s,s*1.1,hs*0.35); ctx.fill();
        ctx.strokeStyle="#a5f3fc"; ctx.stroke();
        // Inner water
        const lighterR=Math.min(255,pr+30), lighterG=Math.min(255,pg+30), lighterB=Math.min(255,pb+30);
        ctx.fillStyle=`rgba(${lighterR},${lighterG},${lighterB},0.8)`;
        ctx.beginPath(); ctx.roundRect(-hs*0.82,-hs*0.67,s*0.88,s*0.88,hs*0.25); ctx.fill();
        // Animated ripples
        ctx.strokeStyle="rgba(165,243,252,0.5)"; ctx.lineWidth=0.8;
        const rippleT=(Date.now()/1200)%1;
        for(let ri=0;ri<3;ri++){
          const ry=-hs*0.4+(ri)*hs*0.3+rippleT*hs*0.3;
          if(ry < hs*0.35){
            ctx.beginPath(); ctx.moveTo(-hs*0.65,ry); ctx.quadraticCurveTo(0,ry-3,hs*0.65,ry); ctx.stroke();
          }
        }
        // Ladder
        ctx.strokeStyle="#94a3b8"; ctx.lineWidth=1;
        ctx.beginPath(); ctx.moveTo(-hs*0.28,-hs*0.72); ctx.lineTo(-hs*0.28,-hs*0.5); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(hs*0.28,-hs*0.72); ctx.lineTo(hs*0.28,-hs*0.5); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-hs*0.28,-hs*0.61); ctx.lineTo(hs*0.28,-hs*0.61); ctx.stroke();
        break;
      }
      case "fence": {
        // Fence / hedge: row of posts with crossbar or hedge block
        ctx.fillStyle="#166534"; ctx.strokeStyle="#15803d"; ctx.lineWidth=1;
        // Hedge blocks
        for(let fi=0;fi<3;fi++){
          const fx=-hs+fi*(s/3)+2;
          ctx.beginPath(); ctx.roundRect(fx,-hs*0.6,s/3-4,s*0.9,3); ctx.fill(); ctx.stroke();
          // Highlight
          ctx.fillStyle="rgba(134,239,172,0.2)";
          ctx.beginPath(); ctx.roundRect(fx+2,-hs*0.5,s/3-8,s*0.35,2); ctx.fill();
          ctx.fillStyle="#166534";
        }
        break;
      }
      case "garage": {
        // Garage: building footprint + door
        ctx.fillStyle="#1e293b"; ctx.strokeStyle="#64748b"; ctx.lineWidth=1.2;
        ctx.fillRect(-hs,-hs,s,s); ctx.strokeRect(-hs,-hs,s,s);
        // Roof line
        ctx.strokeStyle="#94a3b8"; ctx.lineWidth=1;
        ctx.beginPath(); ctx.moveTo(-hs,-hs); ctx.lineTo(0,-hs-hs*0.4); ctx.lineTo(hs,-hs); ctx.stroke();
        // Door
        ctx.fillStyle="#334155"; ctx.strokeStyle="#475569";
        ctx.fillRect(-hs*0.7,hs*0,s*0.7,hs*0.95); ctx.strokeRect(-hs*0.7,hs*0,s*0.7,hs*0.95);
        // Door panels
        ctx.strokeStyle="#1e293b"; ctx.lineWidth=0.5;
        for(let dp=1;dp<4;dp++){
          ctx.beginPath();
          ctx.moveTo(-hs*0.7, hs*0+dp*(hs*0.95/4));
          ctx.lineTo(-hs*0.7+s*0.7, hs*0+dp*(hs*0.95/4));
          ctx.stroke();
        }
        ctx.beginPath(); ctx.moveTo(0,hs*0); ctx.lineTo(0,hs*0.95); ctx.stroke();
        break;
      }
      case "raisedbed": {
        // Hochbeet: braunes Holzrahmen-Rechteck mit Erde und Pflanzen
        ctx.fillStyle="#5c3a1e"; ctx.strokeStyle="#8b5e3c"; ctx.lineWidth=1.2;
        ctx.fillRect(-hs,-hs*0.65,s,s*0.65); ctx.strokeRect(-hs,-hs*0.65,s,s*0.65);
        // Seitenbretter
        ctx.fillStyle="#6b4423";
        ctx.fillRect(-hs,-hs*0.65,s*0.12,s*0.65);
        ctx.fillRect(hs-s*0.12,-hs*0.65,s*0.12,s*0.65);
        // Erde
        ctx.fillStyle="#3d2010"; ctx.fillRect(-hs*0.82,-hs*0.52,s*0.82,s*0.42);
        // Pflanzen (3 grüne Punkte)
        [[-hs*0.55,-hs*0.25],[0,-hs*0.3],[hs*0.55,-hs*0.22]].forEach(([px,py])=>{
          ctx.fillStyle="#22c55e"; ctx.beginPath(); ctx.arc(px,py,hs*0.18,0,Math.PI*2); ctx.fill();
          ctx.strokeStyle="#16a34a"; ctx.lineWidth=0.6; ctx.stroke();
        });
        break;
      }
      case "gardenbed": {
        // Bodenbeet: Erdrechteck mit Pflanzreihen
        const t3 = (Date.now()/2000)%1;
        ctx.fillStyle="#2d1a0e"; ctx.strokeStyle="#78350f"; ctx.lineWidth=1;
        ctx.fillRect(-hs,-hs,s,s); ctx.strokeRect(-hs,-hs,s,s);
        // Pflanzreihen
        for(let row=0;row<3;row++){
          const ry = -hs+hs*0.3+row*(hs*0.55);
          for(let col=0;col<4;col++){
            const rx = -hs+hs*0.2+col*(hs*0.52);
            const grow = 0.12+0.08*Math.sin(t3*Math.PI*2+row+col);
            ctx.fillStyle=`rgba(74,222,128,${0.7+grow*2})`;
            ctx.beginPath(); ctx.arc(rx,ry,hs*grow*1.8,0,Math.PI*2); ctx.fill();
          }
        }
        break;
      }
      case "trellis": {
        // Spalier: vertikale + diagonale Holzlatten
        ctx.strokeStyle="#92400e"; ctx.lineWidth=1.2;
        // Vertikale Latten
        for(let i=-2;i<=2;i++){
          ctx.beginPath(); ctx.moveTo(i*(hs/2),-hs); ctx.lineTo(i*(hs/2),hs); ctx.stroke();
        }
        // Horizontale Latten
        for(let i=-2;i<=2;i++){
          ctx.beginPath(); ctx.moveTo(-hs,i*(hs/2)); ctx.lineTo(hs,i*(hs/2)); ctx.stroke();
        }
        // Ranken (grüne Bögen)
        ctx.strokeStyle="rgba(34,197,94,0.7)"; ctx.lineWidth=0.8;
        [[-hs*0.5,-hs*0.6],[-hs*0.5,0],[hs*0.5,-hs*0.3],[0,hs*0.6]].forEach(([x,y])=>{
          ctx.beginPath();
          ctx.arc(x,y,hs*0.3,0,Math.PI*1.5);
          ctx.stroke();
        });
        break;
      }
      case "sprinkler": {
        // Rasensprinkler: Kreis mit animierten Wasserstrahlen
        const t4 = (Date.now()/800)%1;
        // Kopf
        ctx.fillStyle="#475569"; ctx.strokeStyle="#94a3b8"; ctx.lineWidth=1;
        ctx.beginPath(); ctx.arc(0,0,hs*0.28,0,Math.PI*2); ctx.fill(); ctx.stroke();
        // Rotierende Wasserstrahlen
        for(let i=0;i<6;i++){
          const angle = (i/6)*Math.PI*2 + t4*Math.PI*2;
          const fade = (1+Math.sin(angle*2+t4*4))*0.5;
          ctx.strokeStyle=`rgba(125,211,252,${0.3+fade*0.5})`;
          ctx.lineWidth=1;
          ctx.setLineDash([2,2]);
          ctx.beginPath();
          ctx.moveTo(Math.cos(angle)*hs*0.28, Math.sin(angle)*hs*0.28);
          ctx.lineTo(Math.cos(angle)*hs, Math.sin(angle)*hs);
          ctx.stroke();
          ctx.setLineDash([]);
        }
        // Wasserkreis
        ctx.strokeStyle="rgba(125,211,252,0.15)";
        ctx.lineWidth=1; ctx.setLineDash([3,3]);
        ctx.beginPath(); ctx.arc(0,0,hs,0,Math.PI*2); ctx.stroke();
        ctx.setLineDash([]);
        break;
      }
      case "rockgarden": {
        // Steingarten: grauer Kieselbereich mit Steinen und Pflänzchen
        ctx.fillStyle="#374151"; ctx.strokeStyle="#6b7280"; ctx.lineWidth=0.8;
        ctx.beginPath(); ctx.ellipse(0,0,hs,hs*0.7,0,0,Math.PI*2); ctx.fill(); ctx.stroke();
        // Steine
        const rocks=[[-hs*0.4,-hs*0.2,hs*0.22,hs*0.15],[hs*0.3,-hs*0.15,hs*0.18,hs*0.12],
                     [0,hs*0.25,hs*0.2,hs*0.14],[-hs*0.55,hs*0.2,hs*0.15,hs*0.1]];
        rocks.forEach(([rx,ry,rw,rh])=>{
          ctx.fillStyle="#4b5563"; ctx.strokeStyle="#6b7280"; ctx.lineWidth=0.6;
          ctx.beginPath(); ctx.ellipse(rx,ry,rw,rh,Math.random()*Math.PI,0,Math.PI*2);
          ctx.fill(); ctx.stroke();
        });
        // Kleines Pflänzchen
        ctx.fillStyle="#16a34a";
        ctx.beginPath(); ctx.arc(hs*0.15,hs*0.1,hs*0.12,0,Math.PI*2); ctx.fill();
        break;
      }
      case "shedhouse": {
        // Gartenhaus: Haus mit Satteldach
        ctx.fillStyle="#78350f"; ctx.strokeStyle="#92400e"; ctx.lineWidth=1;
        ctx.fillRect(-hs,-hs*0.3,s,s*0.8); ctx.strokeRect(-hs,-hs*0.3,s,s*0.8);
        // Dach
        ctx.fillStyle="#b45309"; ctx.beginPath();
        ctx.moveTo(-hs-hs*0.1,-hs*0.3); ctx.lineTo(0,-hs*0.95); ctx.lineTo(hs+hs*0.1,-hs*0.3);
        ctx.closePath(); ctx.fill(); ctx.strokeStyle="#92400e"; ctx.stroke();
        // Tür
        ctx.fillStyle="#451a03";
        ctx.fillRect(-hs*0.2,hs*0.1,hs*0.4,hs*0.4); ctx.strokeStyle="#78350f"; ctx.stroke();
        // Fenster
        ctx.fillStyle="#7dd3fc"; ctx.strokeStyle="#475569";
        ctx.fillRect(-hs*0.65,-hs*0.1,hs*0.3,hs*0.25); ctx.stroke();
        ctx.fillRect(hs*0.35,-hs*0.1,hs*0.3,hs*0.25); ctx.stroke();
        break;
      }
      case "gardenlight": {
        // Gartenlampe: Laternenpfahl
        const t5=(Date.now()/1000)%1;
        // Pfahl
        ctx.strokeStyle="#94a3b8"; ctx.lineWidth=1.5;
        ctx.beginPath(); ctx.moveTo(0,hs); ctx.lineTo(0,-hs*0.4); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0,-hs*0.4); ctx.lineTo(hs*0.3,-hs*0.55); ctx.stroke();
        // Laternenkopf
        ctx.fillStyle="#1e293b"; ctx.strokeStyle="#475569"; ctx.lineWidth=1;
        ctx.beginPath(); ctx.arc(hs*0.3,-hs*0.7,hs*0.22,0,Math.PI*2); ctx.fill(); ctx.stroke();
        // Lichtschein (pulsierend)
        const lIntensity = 0.3+0.12*Math.sin(t5*Math.PI*2);
        ctx.fillStyle=`rgba(255,235,150,${lIntensity})`;
        ctx.beginPath(); ctx.arc(hs*0.3,-hs*0.7,hs*0.55,0,Math.PI*2); ctx.fill();
        ctx.fillStyle="rgba(255,235,150,0.9)";
        ctx.beginPath(); ctx.arc(hs*0.3,-hs*0.7,hs*0.1,0,Math.PI*2); ctx.fill();
        break;
      }
      case "pondpump": {
        // Teichpumpe: Pumpenkörper mit animierten Wasserringen
        const t6=(Date.now()/1200)%1;
        // Pump body
        ctx.fillStyle="#0c4a6e"; ctx.strokeStyle="#0ea5e9"; ctx.lineWidth=1.2;
        ctx.beginPath(); ctx.arc(0,0,hs*0.35,0,Math.PI*2); ctx.fill(); ctx.stroke();
        // Propeller (rotierend)
        ctx.save(); ctx.rotate(t6*Math.PI*2);
        ctx.strokeStyle="#38bdf8"; ctx.lineWidth=1.5;
        for(let i=0;i<3;i++){
          ctx.save(); ctx.rotate(i*Math.PI*2/3);
          ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(0,-hs*0.28); ctx.stroke();
          ctx.restore();
        }
        ctx.restore();
        // Wasserkreise
        [0.6,0.85,1.0].forEach((r,ri)=>{
          const phase = (t6+ri*0.33)%1;
          ctx.strokeStyle=`rgba(125,211,252,${(1-phase)*0.5})`;
          ctx.lineWidth=0.8;
          ctx.beginPath(); ctx.arc(0,0,hs*r,0,Math.PI*2); ctx.stroke();
        });
        break;
      }
      case "bench": {
        // Gartenbank: Sitzfläche + Lehne + Beine
        ctx.fillStyle="#78350f"; ctx.strokeStyle="#92400e"; ctx.lineWidth=1;
        // Sitzfläche
        ctx.fillRect(-hs,-hs*0.08,s,s*0.22); ctx.strokeRect(-hs,-hs*0.08,s,s*0.22);
        // Rücklehne
        ctx.fillStyle="#6b2d0a";
        ctx.fillRect(-hs,-hs*0.5,s,s*0.22); ctx.strokeRect(-hs,-hs*0.5,s,s*0.22);
        // Beine
        ctx.fillStyle="#92400e";
        [[-hs*0.8,hs*0.14],[-hs*0.8,hs*0.42],[hs*0.8-s*0.12,hs*0.14],[hs*0.8-s*0.12,hs*0.42]].forEach(([x,y])=>{
          ctx.fillRect(x,y,s*0.12,s*0.18);
        });
        // Holzlattenmuster
        ctx.strokeStyle="rgba(92,40,14,0.5)"; ctx.lineWidth=0.5;
        for(let i=1;i<4;i++){
          ctx.beginPath(); ctx.moveTo(-hs+i*(s/4),-hs*0.5); ctx.lineTo(-hs+i*(s/4),hs*0.14); ctx.stroke();
        }
        break;
      }
      case "fireplace": {
        // Feuerstelle: Kreis mit Steinen und animierter Flamme
        const t7=(Date.now()/600)%1;
        // Steinring
        ctx.strokeStyle="#6b7280"; ctx.lineWidth=3;
        ctx.beginPath(); ctx.arc(0,0,hs,0,Math.PI*2); ctx.stroke();
        ctx.fillStyle="#1c1917";
        ctx.beginPath(); ctx.arc(0,0,hs*0.82,0,Math.PI*2); ctx.fill();
        // Holz kreuzweise
        ctx.strokeStyle="#78350f"; ctx.lineWidth=2;
        ctx.beginPath(); ctx.moveTo(-hs*0.55,-hs*0.55); ctx.lineTo(hs*0.55,hs*0.55); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(hs*0.55,-hs*0.55); ctx.lineTo(-hs*0.55,hs*0.55); ctx.stroke();
        // Flammen (animiert)
        const fh2=hs*(0.6+0.15*Math.sin(t7*Math.PI*4));
        const fw2=hs*0.35;
        ctx.fillStyle=`rgba(251,146,60,${0.7+0.2*Math.sin(t7*Math.PI*3)})`;
        ctx.beginPath(); ctx.ellipse(0,0,fw2,fh2,0,Math.PI,Math.PI*2); ctx.fill();
        ctx.fillStyle=`rgba(253,224,71,${0.6+0.2*Math.sin(t7*Math.PI*5)})`;
        ctx.beginPath(); ctx.ellipse(0,hs*0.1,fw2*0.6,fh2*0.7,0,Math.PI,Math.PI*2); ctx.fill();
        break;
      }
      case "greenhouse": {
        // Gewächshaus: Glas-Tunnelhaus von oben
        ctx.fillStyle="rgba(125,211,252,0.15)"; ctx.strokeStyle="#7dd3fc"; ctx.lineWidth=1;
        ctx.beginPath(); ctx.ellipse(0,0,hs,hs*0.65,0,0,Math.PI*2); ctx.fill(); ctx.stroke();
        // Längsrippen
        ctx.strokeStyle="rgba(125,211,252,0.4)"; ctx.lineWidth=0.8;
        for(let i=-2;i<=2;i++){
          ctx.beginPath(); ctx.moveTo(i*(hs*0.38),-hs*0.65); ctx.lineTo(i*(hs*0.38),hs*0.65); ctx.stroke();
        }
        // Querrippen
        for(let i=-1;i<=1;i++){
          ctx.beginPath(); ctx.moveTo(-hs,i*(hs*0.32)); ctx.lineTo(hs,i*(hs*0.32)); ctx.stroke();
        }
        // Pflanzen drin
        [[-hs*0.5,0],[0,-hs*0.3],[hs*0.5,0],[0,hs*0.3]].forEach(([px,py])=>{
          ctx.fillStyle="rgba(34,197,94,0.6)";
          ctx.beginPath(); ctx.arc(px,py,hs*0.14,0,Math.PI*2); ctx.fill();
        });
        break;
      }
      // ══════════════════════════════════════════════════════════════════════
      // INDOOR / SMART HOME SYMBOLE
      // ══════════════════════════════════════════════════════════════════════
      case "tv": {
        // Fernseher mit animiertem Bildschirm wenn aktiv
        const tvOn = !!ctx._entityOn;
        const t_tv = (Date.now()/1000)%1;
        // Gehäuse
        ctx.fillStyle="#1c2535"; ctx.strokeStyle="#334155"; ctx.lineWidth=1.2;
        ctx.fillRect(-hs,-hs*0.75,s,s*1.0); ctx.strokeRect(-hs,-hs*0.75,s,s*1.0);
        // Fuß
        ctx.fillStyle="#334155";
        ctx.fillRect(-hs*0.35,hs*0.25,hs*0.7,hs*0.25);
        ctx.fillRect(-hs*0.5,hs*0.5,s,hs*0.12);
        // Bildschirm
        const screenColor = tvOn ? "#1e40af" : "#0f172a";
        ctx.fillStyle=screenColor;
        ctx.fillRect(-hs*0.85,-hs*0.65,s*0.85,s*0.75);
        if(tvOn) {
          // Animierter Inhalt: Scan-Linien
          ctx.save();
          ctx.globalAlpha = 0.6;
          const scanY = (t_tv * s * 1.4) - hs*0.65 - s*0.75;
          ctx.fillStyle="rgba(100,160,255,0.3)";
          ctx.fillRect(-hs*0.85, Math.max(-hs*0.65, scanY), s*0.85, 3);
          // Farbige Streifen (Programminhalt)
          [[0.1,"#ef4444"],[0.3,"#22c55e"],[0.55,"#3b82f6"],[0.75,"#f59e0b"]].forEach(([y,col])=>{
            ctx.fillStyle=col+"44";
            ctx.fillRect(-hs*0.85,-hs*0.65+s*0.75*y,s*0.85*(0.3+Math.sin(t_tv*Math.PI*2+y*10)*0.2),4);
          });
          ctx.restore();
          // Power-LED grün
          ctx.fillStyle="#22c55e"; ctx.beginPath(); ctx.arc(hs*0.7,hs*0.2,2,0,Math.PI*2); ctx.fill();
        } else {
          // Power-LED rot
          ctx.fillStyle="#ef4444"; ctx.beginPath(); ctx.arc(hs*0.7,hs*0.2,2,0,Math.PI*2); ctx.fill();
        }
        break;
      }
      case "speaker": {
        // Lautsprecher mit Schallwellen-Animation wenn aktiv
        const spkOn = !!ctx._entityOn;
        const t_sp = (Date.now()/800)%1;
        // Gehäuse
        ctx.fillStyle="#1e293b"; ctx.strokeStyle="#334155"; ctx.lineWidth=1;
        ctx.beginPath(); ctx.roundRect(-hs,-hs,s,s,4); ctx.fill(); ctx.stroke();
        // Membrane (Kreis)
        ctx.fillStyle="#0f172a"; ctx.strokeStyle="#475569"; ctx.lineWidth=1;
        ctx.beginPath(); ctx.arc(0,hs*0.05,hs*0.62,0,Math.PI*2); ctx.fill(); ctx.stroke();
        // Dustcap
        ctx.fillStyle="#1e293b"; ctx.beginPath(); ctx.arc(0,hs*0.05,hs*0.22,0,Math.PI*2); ctx.fill();
        // Tweeter oben
        ctx.fillStyle="#334155"; ctx.beginPath(); ctx.arc(0,-hs*0.65,hs*0.18,0,Math.PI*2); ctx.fill(); ctx.stroke();
        if(spkOn) {
          // Animierte Schallwellen
          [1,2,3].forEach(i=>{
            const phase = (t_sp+i*0.25)%1;
            ctx.strokeStyle=`rgba(56,189,248,${(1-phase)*0.7})`;
            ctx.lineWidth=1;
            const r = hs*(0.7+i*0.3+phase*0.4);
            ctx.beginPath(); ctx.arc(0,hs*0.05,r,0,Math.PI*2); ctx.stroke();
          });
          // Membran-Bewegung
          ctx.strokeStyle="#38bdf8"; ctx.lineWidth=1.5;
          ctx.beginPath(); ctx.arc(0,hs*0.05,hs*0.62,0,Math.PI*2); ctx.stroke();
          // Power-LED cyan
          ctx.fillStyle="#00e5ff"; ctx.beginPath(); ctx.arc(hs*0.68,-hs*0.62,2.5,0,Math.PI*2); ctx.fill();
        } else {
          ctx.fillStyle="#334155"; ctx.beginPath(); ctx.arc(hs*0.68,-hs*0.62,2.5,0,Math.PI*2); ctx.fill();
        }
        break;
      }
      case "couch": {
        // Sofa: Sitzfläche + Armlehnen + Rücken
        ctx.fillStyle="#334155"; ctx.strokeStyle="#475569"; ctx.lineWidth=1;
        // Rückenlehne
        ctx.fillRect(-hs,-hs,s,s*0.38); ctx.strokeRect(-hs,-hs,s,s*0.38);
        // Sitzfläche
        ctx.fillStyle="#3f4e63";
        ctx.fillRect(-hs,-hs*0.15,s,s*0.5); ctx.strokeRect(-hs,-hs*0.15,s,s*0.5);
        // Armlehnen
        ctx.fillStyle="#2d3a4a";
        ctx.fillRect(-hs,-hs,s*0.18,s*0.85); ctx.stroke();
        ctx.fillRect(hs-s*0.18,-hs,s*0.18,s*0.85); ctx.stroke();
        // Kissen-Naht
        ctx.strokeStyle="#475569"; ctx.lineWidth=0.6; ctx.setLineDash([2,2]);
        ctx.beginPath(); ctx.moveTo(0,-hs); ctx.lineTo(0,hs*0.35); ctx.stroke();
        ctx.setLineDash([]);
        break;
      }
      case "bed": {
        // Bett von oben: Rahmen + Kopfteil + Kissen + Decke
        ctx.fillStyle="#292524"; ctx.strokeStyle="#44403c"; ctx.lineWidth=1;
        ctx.fillRect(-hs,-hs,s,s); ctx.strokeRect(-hs,-hs,s,s);
        // Matratze
        ctx.fillStyle="#f5f5f4"; ctx.fillRect(-hs*0.85,-hs*0.7,s*0.85,s*1.25);
        ctx.strokeStyle="#d6d3d1"; ctx.strokeRect(-hs*0.85,-hs*0.7,s*0.85,s*1.25);
        // Kissen
        ctx.fillStyle="#e7e5e4"; ctx.strokeStyle="#a8a29e"; ctx.lineWidth=0.7;
        ctx.fillRect(-hs*0.7,-hs*0.6,s*0.65,s*0.35); ctx.stroke();
        // Decke
        ctx.fillStyle="rgba(100,140,200,0.4)"; ctx.strokeStyle="#93c5fd"; ctx.lineWidth=0.8;
        ctx.fillRect(-hs*0.85,-hs*0.1,s*0.85,s*0.85); ctx.stroke();
        // Kopfteil
        ctx.fillStyle="#3b2f1e"; ctx.fillRect(-hs,-hs,s,s*0.32); ctx.stroke();
        break;
      }
      case "desk": {
        // Schreibtisch von oben
        ctx.fillStyle="#7c3d12"; ctx.strokeStyle="#92400e"; ctx.lineWidth=1;
        ctx.fillRect(-hs,-hs*0.55,s,s*0.55); ctx.strokeRect(-hs,-hs*0.55,s,s*0.55);
        // Beine
        ctx.fillStyle="#451a03";
        [[-hs*0.85,hs*0.0],[hs*0.85-s*0.12,hs*0.0],[-hs*0.85,-hs*0.55],[hs*0.85-s*0.12,-hs*0.55]].forEach(([x,y])=>{
          ctx.fillRect(x,y,s*0.12,hs*0.55);
        });
        // Monitor angedeutet
        ctx.fillStyle="#1e293b"; ctx.strokeStyle="#334155"; ctx.lineWidth=0.8;
        ctx.fillRect(-hs*0.3,-hs*0.5,hs*0.6,hs*0.35); ctx.stroke();
        break;
      }
      case "table": {
        // Tisch von oben: rund oder eckig
        ctx.fillStyle="#854d0e"; ctx.strokeStyle="#78350f"; ctx.lineWidth=1;
        ctx.beginPath(); ctx.arc(0,0,hs*0.85,0,Math.PI*2); ctx.fill(); ctx.stroke();
        // Tischbein in der Mitte
        ctx.fillStyle="#431407"; ctx.beginPath(); ctx.arc(0,0,hs*0.2,0,Math.PI*2); ctx.fill();
        // Holzmaserung
        ctx.strokeStyle="rgba(133,77,14,0.4)"; ctx.lineWidth=0.5;
        [0.3,0.5,0.7].forEach(r=>{ ctx.beginPath(); ctx.arc(0,0,hs*0.85*r,0,Math.PI*2); ctx.stroke(); });
        break;
      }
      case "fridge": {
        // Kühlschrank: Korpus mit Türen
        const fridgeOpen = !!ctx._entityOn; // on = Tür offen = Alarm
        ctx.fillStyle="#e2e8f0"; ctx.strokeStyle="#94a3b8"; ctx.lineWidth=1;
        ctx.fillRect(-hs,-hs,s,s); ctx.strokeRect(-hs,-hs,s,s);
        // Trennlinie Gefrier/Kühl
        ctx.strokeStyle="#94a3b8"; ctx.lineWidth=0.8;
        ctx.beginPath(); ctx.moveTo(-hs,-hs*0.15); ctx.lineTo(hs,-hs*0.15); ctx.stroke();
        // Griffe
        ctx.strokeStyle="#64748b"; ctx.lineWidth=1.5;
        ctx.beginPath(); ctx.moveTo(hs*0.6,-hs*0.6); ctx.lineTo(hs*0.6,-hs*0.25); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(hs*0.6,hs*0.1); ctx.lineTo(hs*0.6,hs*0.7); ctx.stroke();
        if(fridgeOpen) {
          // Alarm-Overlay: rotes Blinken
          const pulse = 0.3+0.3*Math.sin(Date.now()/300*Math.PI);
          ctx.fillStyle=`rgba(239,68,68,${pulse})`;
          ctx.fillRect(-hs,-hs,s,s);
          ctx.fillStyle="#ef4444"; ctx.font=`bold ${Math.round(s*0.25)}px sans-serif`; ctx.textAlign="center";
          ctx.fillText("⚠", 0, s*0.1);
        }
        break;
      }
      case "washingmachine": {
        // Waschmaschine: Trommel-Animation
        const wmOn = !!ctx._entityOn;
        const t_wm = (Date.now()/2000)%1;
        ctx.fillStyle="#f1f5f9"; ctx.strokeStyle="#94a3b8"; ctx.lineWidth=1;
        ctx.fillRect(-hs,-hs,s,s); ctx.strokeRect(-hs,-hs,s,s);
        // Bullaugenfenster
        ctx.fillStyle="#0c4a6e"; ctx.beginPath(); ctx.arc(0,hs*0.1,hs*0.62,0,Math.PI*2); ctx.fill();
        ctx.strokeStyle="#0ea5e9"; ctx.stroke();
        if(wmOn) {
          // Rotierende Trommel
          ctx.save(); ctx.rotate(t_wm*Math.PI*2);
          ctx.strokeStyle="rgba(186,230,253,0.5)"; ctx.lineWidth=1;
          for(let i=0;i<6;i++){
            ctx.save(); ctx.rotate(i*Math.PI/3);
            ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(0,hs*0.55); ctx.stroke();
            ctx.restore();
          }
          ctx.restore();
          // Schaumwellen
          const foamY = hs*0.1+hs*0.3*Math.sin(t_wm*Math.PI*2);
          ctx.fillStyle="rgba(186,230,253,0.3)";
          ctx.beginPath(); ctx.arc(0,hs*0.1,hs*0.62,0,Math.PI,true); ctx.lineTo(-hs*0.62,foamY); ctx.arc(0,foamY,hs*0.62,Math.PI,0); ctx.closePath(); ctx.fill();
        }
        // Bedienfeld oben
        ctx.fillStyle="#e2e8f0"; ctx.fillRect(-hs,-hs,s,s*0.25);
        ctx.strokeStyle="#94a3b8"; ctx.lineWidth=0.5;
        ctx.beginPath(); ctx.moveTo(-hs,-hs+s*0.25); ctx.lineTo(hs,-hs+s*0.25); ctx.stroke();
        // Status-LED
        ctx.fillStyle=wmOn?"#22c55e":"#334155"; ctx.beginPath(); ctx.arc(hs*0.6,-hs*0.82,2.5,0,Math.PI*2); ctx.fill();
        break;
      }
      case "dishwasher": {
        // Spülmaschine
        const dwOn = !!ctx._entityOn;
        const t_dw = (Date.now()/1500)%1;
        ctx.fillStyle="#f1f5f9"; ctx.strokeStyle="#94a3b8"; ctx.lineWidth=1;
        ctx.fillRect(-hs,-hs,s,s); ctx.strokeRect(-hs,-hs,s,s);
        // Bedienfeld oben
        ctx.fillStyle="#e2e8f0"; ctx.fillRect(-hs,-hs,s,s*0.22);
        // Tür-Griff
        ctx.strokeStyle="#64748b"; ctx.lineWidth=2;
        ctx.beginPath(); ctx.moveTo(-hs*0.5,hs*0.6); ctx.lineTo(hs*0.5,hs*0.6); ctx.stroke();
        if(dwOn) {
          // Dampf-Partikel
          for(let i=0;i<3;i++){
            const steamPhase=(t_dw+i*0.33)%1;
            ctx.fillStyle=`rgba(186,230,253,${(1-steamPhase)*0.5})`;
            ctx.beginPath(); ctx.arc(-hs*0.4+i*hs*0.4,-hs*0.3-steamPhase*hs*0.6,2+steamPhase*3,0,Math.PI*2); ctx.fill();
          }
          ctx.fillStyle="#22c55e"; ctx.beginPath(); ctx.arc(hs*0.6,-hs*0.88,2.5,0,Math.PI*2); ctx.fill();
        } else {
          ctx.fillStyle="#334155"; ctx.beginPath(); ctx.arc(hs*0.6,-hs*0.88,2.5,0,Math.PI*2); ctx.fill();
        }
        break;
      }
      case "pc": {
        // PC: Tower + Monitor
        const pcOn = !!ctx._entityOn;
        const t_pc = (Date.now()/1000)%1;
        // Tower
        ctx.fillStyle="#1e293b"; ctx.strokeStyle="#334155"; ctx.lineWidth=1;
        ctx.fillRect(-hs,-hs,s*0.38,s); ctx.strokeRect(-hs,-hs,s*0.38,s);
        // CD-Schacht
        ctx.strokeStyle="#475569"; ctx.lineWidth=0.5;
        ctx.strokeRect(-hs*0.9,-hs*0.3,s*0.28,s*0.1);
        // Power-Taste
        ctx.fillStyle=pcOn?"#22c55e":"#ef4444"; ctx.beginPath(); ctx.arc(-hs*0.6,-hs*0.7,3,0,Math.PI*2); ctx.fill();
        // HDD-LED blinkt bei aktiv
        if(pcOn){
          const led=(t_pc*8|0)%2===0;
          ctx.fillStyle=led?"#3b82f6":"#1e3a5f"; ctx.beginPath(); ctx.arc(-hs*0.6,-hs*0.55,2,0,Math.PI*2); ctx.fill();
        }
        // Monitor
        ctx.fillStyle="#1e293b"; ctx.strokeStyle="#334155";
        ctx.fillRect(-hs*0.1,-hs,s*0.68,s*0.72); ctx.strokeRect(-hs*0.1,-hs,s*0.68,s*0.72);
        if(pcOn){
          ctx.fillStyle="#1e40af"; ctx.fillRect(-hs*0.05,-hs*0.94,s*0.58,s*0.55);
          // Desktop-Icons angedeutet
          ctx.fillStyle="#60a5fa";
          [[0.1,0.1],[0.35,0.1],[0.6,0.1]].forEach(([rx,ry])=>{ ctx.fillRect(-hs*0.05+s*0.58*rx,-hs*0.94+s*0.55*ry,4,4); });
        } else {
          ctx.fillStyle="#0f172a"; ctx.fillRect(-hs*0.05,-hs*0.94,s*0.58,s*0.55);
        }
        // Monitorständer
        ctx.fillStyle="#334155"; ctx.fillRect(hs*0.17,-hs*0.28,s*0.15,s*0.35);
        ctx.fillRect(hs*0.05,hs*0.07,s*0.38,s*0.08);
        break;
      }
      case "thermostat": {
        // Thermostat: runder Sensor mit Temperaturanzeige
        const t_th = ctx._entityVal ? parseFloat(ctx._entityVal) : null;
        const t_set = ctx._entitySet ? parseFloat(ctx._entitySet) : null;
        // Hintergrund
        ctx.fillStyle="#1e293b"; ctx.strokeStyle="#334155"; ctx.lineWidth=1.5;
        ctx.beginPath(); ctx.arc(0,0,hs,0,Math.PI*2); ctx.fill(); ctx.stroke();
        // Innenring
        const tempColor = t_th!=null ? (t_th>22?"#f59e0b":t_th<18?"#38bdf8":"#22c55e") : "#445566";
        ctx.strokeStyle=tempColor; ctx.lineWidth=2;
        ctx.beginPath(); ctx.arc(0,0,hs*0.75,0,Math.PI*2); ctx.stroke();
        // Temperaturanzeige
        ctx.fillStyle=tempColor; ctx.font=`bold ${Math.round(s*0.22)}px 'JetBrains Mono',monospace`; ctx.textAlign="center";
        ctx.fillText(t_th!=null?Math.round(t_th)+"°":"--",0,s*0.1);
        if(t_set!=null){
          ctx.fillStyle="#445566"; ctx.font=`${Math.round(s*0.15)}px monospace`;
          ctx.fillText("→"+Math.round(t_set)+"°",0,hs*0.65);
        }
        ctx.textAlign="left";
        break;
      }
      case "door": {
        // Tür-Sensor: Türsymbol, offen/zu
        const doorOpen = !!ctx._entityOn;
        ctx.fillStyle="#7c3d12"; ctx.strokeStyle="#92400e"; ctx.lineWidth=1;
        if(doorOpen) {
          // Tür geöffnet (90° aufgeschwungen)
          ctx.fillRect(-hs,-hs,s*0.14,s); ctx.strokeRect(-hs,-hs,s*0.14,s); // Zargen-Seite
          ctx.fillStyle="#92400e";
          // Tür-Blatt (offen, liegt flach = senkrechte Linie)
          ctx.fillRect(-hs,-hs,s*0.14,s*0.9); ctx.stroke();
          ctx.strokeStyle="#f59e0b"; ctx.lineWidth=1.5; ctx.setLineDash([3,2]);
          ctx.beginPath(); ctx.moveTo(-hs,-hs); ctx.lineTo(hs*0.8,-hs); ctx.stroke();
          ctx.setLineDash([]);
          // Offen-Badge
          ctx.fillStyle="rgba(245,158,11,0.8)"; ctx.fillRect(-hs*0.1,-hs*0.3,hs*0.8,hs*0.4); 
          ctx.fillStyle="#fff"; ctx.font=`bold ${Math.round(s*0.18)}px sans-serif`; ctx.textAlign="center";
          ctx.fillText("AUF",hs*0.3,-hs*0.02); ctx.textAlign="left";
        } else {
          // Geschlossene Tür
          ctx.fillRect(-hs,-hs,s*0.85,s); ctx.strokeRect(-hs,-hs,s*0.85,s);
          // Türklinke
          ctx.strokeStyle="#f59e0b"; ctx.lineWidth=1.5;
          ctx.beginPath(); ctx.arc(hs*0.55,0,3,0,Math.PI*2); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(hs*0.55,0); ctx.lineTo(hs*0.72,0); ctx.stroke();
          // Schlüsselloch
          ctx.fillStyle="#451a03"; ctx.beginPath(); ctx.arc(hs*0.55,hs*0.08,2,0,Math.PI*2); ctx.fill();
          ctx.fillStyle="#451a03"; ctx.fillRect(hs*0.52,hs*0.08,hs*0.06,hs*0.15);
        }
        break;
      }
      case "window_deko": {
        // Fenster-Sensor
        const winOpen = !!ctx._entityOn;
        ctx.fillStyle="#7dd3fc"; ctx.strokeStyle="#38bdf8"; ctx.lineWidth=1.2;
        ctx.globalAlpha=0.4; ctx.fillRect(-hs,-hs,s,s); ctx.globalAlpha=1;
        ctx.strokeRect(-hs,-hs,s,s);
        // Rahmen
        ctx.strokeStyle="#1e3a5f"; ctx.lineWidth=2;
        ctx.strokeRect(-hs,-hs,s,s);
        // Kreuzsprossen
        ctx.beginPath(); ctx.moveTo(0,-hs); ctx.lineTo(0,hs); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-hs,0); ctx.lineTo(hs,0); ctx.stroke();
        if(winOpen) {
          // Geöffnet: oberes Flügel verschoben
          ctx.fillStyle="rgba(56,189,248,0.15)"; ctx.fillRect(-hs,-hs,s,s*0.5);
          ctx.strokeStyle="#f59e0b"; ctx.lineWidth=1; ctx.setLineDash([2,2]);
          ctx.strokeRect(-hs,-hs,s,s*0.5);
          ctx.setLineDash([]);
        }
        break;
      }
      case "plug": {
        // Steckdose/Plug mit Leistungsanzeige
        const plugOn = !!ctx._entityOn;
        const watt = ctx._entityWatt ? parseFloat(ctx._entityWatt) : null;
        ctx.fillStyle="#1e293b"; ctx.strokeStyle="#334155"; ctx.lineWidth=1;
        ctx.beginPath(); ctx.roundRect(-hs,-hs,s,s,5); ctx.fill(); ctx.stroke();
        // Steckdosen-Symbol
        ctx.strokeStyle=plugOn?"#22c55e":"#445566"; ctx.lineWidth=1.5;
        ctx.beginPath(); ctx.arc(0,-hs*0.05,hs*0.55,0,Math.PI*2); ctx.stroke();
        // Steckerstifte
        ctx.fillStyle=plugOn?"#22c55e":"#445566";
        ctx.fillRect(-hs*0.22,-hs*0.4,s*0.1,hs*0.3);
        ctx.fillRect(hs*0.12,-hs*0.4,s*0.1,hs*0.3);
        // Watt-Anzeige
        if(plugOn && watt!=null) {
          ctx.fillStyle="#22c55e"; ctx.font=`bold ${Math.round(s*0.17)}px monospace`; ctx.textAlign="center";
          ctx.fillText(watt<1000?Math.round(watt)+"W":(watt/1000).toFixed(1)+"kW",0,hs*0.75);
          ctx.textAlign="left";
        }
        if(plugOn){ ctx.fillStyle="#22c55e"; ctx.beginPath(); ctx.arc(hs*0.62,hs*0.62,3,0,Math.PI*2); ctx.fill(); }
        break;
      }
      case "router": {
        // Router/Hub mit Status-LEDs und WLAN-Animation
        const routerOn = !ctx._entityOn; // device_tracker: home=on = router ok
        const t_rt = (Date.now()/1200)%1;
        ctx.fillStyle="#1e293b"; ctx.strokeStyle="#334155"; ctx.lineWidth=1;
        ctx.fillRect(-hs,-hs*0.55,s,s*0.55); ctx.strokeRect(-hs,-hs*0.55,s,s*0.55);
        // Antennen
        ctx.strokeStyle="#475569"; ctx.lineWidth=1.5;
        ctx.beginPath(); ctx.moveTo(-hs*0.6,-hs*0.55); ctx.lineTo(-hs*0.8,-hs); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(hs*0.6,-hs*0.55); ctx.lineTo(hs*0.8,-hs); ctx.stroke();
        // Status-LEDs
        const ledColors=["#22c55e","#3b82f6","#f59e0b","#22c55e"];
        ledColors.forEach((c,i)=>{
          const blink = routerOn && i===1 && (t_rt*4|0)%2===0;
          ctx.fillStyle=blink?"#1e3a5f":c;
          ctx.beginPath(); ctx.arc(-hs*0.6+i*hs*0.4,hs*0.05,2,0,Math.PI*2); ctx.fill();
        });
        if(routerOn){
          // WLAN-Wellen
          [0.5,0.8,1.1].forEach((r,ri)=>{
            const ph=(t_rt+ri*0.2)%1;
            ctx.strokeStyle=`rgba(59,130,246,${(1-ph)*0.6})`;
            ctx.lineWidth=0.8;
            ctx.beginPath(); ctx.arc(0,-hs*0.3,hs*r,-Math.PI*0.7,Math.PI*1.7); ctx.stroke();
          });
        }
        break;
      }
    }
  }

  // ── 3D Deco Drawing ────────────────────────────────────────────────────────
  _drawDecos3D(ctx, project, unitPx, decos) {
    if (!decos?.length) return;
    decos.forEach(deco => {
      if (deco.mx == null || deco.my == null) return;
      const s = (deco.size || 1.0);
      ctx._poolColor = deco.type === "pool" ? (deco.pool_color || null) : null;
      this._drawDecoSymbol3D(ctx, project, unitPx, deco.type, deco.mx, deco.my, s, deco.label, deco);
      ctx._poolColor = null;
    });
  }

  _drawDecoSymbol3D(ctx, project, unitPx, type, mx, my, size, label, deco) {
    const u = unitPx * size * 0.4; // unit scale in pixels
    const p = (x,y,z) => project(mx+x, my+y, z);

    switch(type) {
      case "solar": {
        // Tilted panel at ~30° (south-facing)
        const corners = [
          p(-size*0.6, -size*0.3, size*0.5+size*0.3),
          p( size*0.6, -size*0.3, size*0.5+size*0.3),
          p( size*0.6,  size*0.3, size*0.5),
          p(-size*0.6,  size*0.3, size*0.5),
        ];
        // Panel face
        ctx.fillStyle = "#1e3a5f";
        ctx.beginPath(); corners.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y)); ctx.closePath(); ctx.fill();
        // Grid lines
        ctx.strokeStyle="#00aaff88"; ctx.lineWidth=0.7;
        for(let i=1;i<3;i++){
          const t=i/3;
          const la={x:corners[0].x+(corners[1].x-corners[0].x)*t, y:corners[0].y+(corners[1].y-corners[0].y)*t};
          const lb={x:corners[3].x+(corners[2].x-corners[3].x)*t, y:corners[3].y+(corners[2].y-corners[3].y)*t};
          ctx.beginPath(); ctx.moveTo(la.x,la.y); ctx.lineTo(lb.x,lb.y); ctx.stroke();
          const ta={x:corners[0].x+(corners[3].x-corners[0].x)*t, y:corners[0].y+(corners[3].y-corners[0].y)*t};
          const tb={x:corners[1].x+(corners[2].x-corners[1].x)*t, y:corners[1].y+(corners[2].y-corners[1].y)*t};
          ctx.beginPath(); ctx.moveTo(ta.x,ta.y); ctx.lineTo(tb.x,tb.y); ctx.stroke();
        }
        ctx.strokeStyle="#00aaff"; ctx.lineWidth=1;
        ctx.beginPath(); corners.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y)); ctx.closePath(); ctx.stroke();
        // Support legs
        ctx.strokeStyle="#475569"; ctx.lineWidth=1.5;
        [[corners[2],p(size*0.6,size*0.3,0)],[corners[3],p(-size*0.6,size*0.3,0)]].forEach(([a,b])=>{
          ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke();
        });
        break;
      }
      case "inverter": {
        // Box on wall/ground
        const h=size*0.6, w=size*0.5, d=size*0.2;
        const fl=[p(-w,-d,0),p(w,-d,0),p(w,d,0),p(-w,d,0)];
        const tl=[p(-w,-d,h),p(w,-d,h),p(w,d,h),p(-w,d,h)];
        ctx.fillStyle="#1c2840";
        ctx.beginPath(); fl.forEach((pp,i)=>i?ctx.lineTo(pp.x,pp.y):ctx.moveTo(pp.x,pp.y)); ctx.closePath(); ctx.fill();
        ctx.fillStyle="#1c2840dd";
        ctx.beginPath(); [fl[0],fl[1],tl[1],tl[0]].forEach((pp,i)=>i?ctx.lineTo(pp.x,pp.y):ctx.moveTo(pp.x,pp.y)); ctx.closePath(); ctx.fill();
        ctx.beginPath(); [fl[1],fl[2],tl[2],tl[1]].forEach((pp,i)=>i?ctx.lineTo(pp.x,pp.y):ctx.moveTo(pp.x,pp.y)); ctx.closePath(); ctx.fill();
        ctx.beginPath(); tl.forEach((pp,i)=>i?ctx.lineTo(pp.x,pp.y):ctx.moveTo(pp.x,pp.y)); ctx.closePath(); ctx.fill();
        ctx.strokeStyle="#f59e0b"; ctx.lineWidth=1;
        [fl,tl].forEach(face=>{ ctx.beginPath(); face.forEach((pp,i)=>i?ctx.lineTo(pp.x,pp.y):ctx.moveTo(pp.x,pp.y)); ctx.closePath(); ctx.stroke(); });
        // Lightning bolt on front
        const fc=p(0,-d,h*0.5);
        ctx.fillStyle="#f59e0b"; ctx.font=`bold ${u*0.8}px sans-serif`; ctx.textAlign="center"; ctx.textBaseline="middle";
        ctx.fillText("⚡",fc.x,fc.y);
        break;
      }
      case "powerpole": {
        const ph=size*2.5; // pole height
        const base=p(0,0,0), top=p(0,0,ph);
        // Main pole
        ctx.strokeStyle="#64748b"; ctx.lineWidth=3;
        ctx.beginPath(); ctx.moveTo(base.x,base.y); ctx.lineTo(top.x,top.y); ctx.stroke();
        // Cross arm
        const arm1=p(-size*0.7,0,ph*0.85), arm2=p(size*0.7,0,ph*0.85);
        ctx.lineWidth=2;
        ctx.beginPath(); ctx.moveTo(arm1.x,arm1.y); ctx.lineTo(arm2.x,arm2.y); ctx.stroke();
        // Wires drooping
        ctx.strokeStyle="#94a3b866"; ctx.lineWidth=0.8;
        [[-0.7,0,-0.35,0],[0.7,0,0.35,0]].forEach(([x1,y1,x2,y2])=>{
          const wa=p(x1*size,y1,ph*0.87), wb=p(x2*size,y2,ph*0.75), wc=p(x2*size,y2,ph*0.87);
          ctx.beginPath(); ctx.moveTo(wa.x,wa.y);
          ctx.quadraticCurveTo(wb.x,wb.y+u*0.4,wc.x,wc.y); ctx.stroke();
        });
        // Insulators
        ctx.fillStyle="#60a5fa";
        [p(-size*0.7,0,ph*0.85),p(size*0.7,0,ph*0.85)].forEach(ins=>{
          ctx.beginPath(); ctx.arc(ins.x,ins.y,3,0,Math.PI*2); ctx.fill();
        });
        break;
      }
      case "battery": {
        const bh=size*0.9, bw=size*0.45, bd=size*0.3;
        const fl=[p(-bw,-bd,0),p(bw,-bd,0),p(bw,bd,0),p(-bw,bd,0)];
        const tl=[p(-bw,-bd,bh),p(bw,-bd,bh),p(bw,bd,bh),p(-bw,bd,bh)];
        // Sides
        [[fl[0],fl[1],tl[1],tl[0],"#0f2027"],[fl[1],fl[2],tl[2],tl[1],"#0a1a20"]].forEach(([a,b,c,d,col])=>{
          ctx.fillStyle=col; ctx.strokeStyle="#22c55e"; ctx.lineWidth=0.8;
          ctx.beginPath(); [a,b,c,d].forEach((pp,i)=>i?ctx.lineTo(pp.x,pp.y):ctx.moveTo(pp.x,pp.y)); ctx.closePath(); ctx.fill(); ctx.stroke();
        });
        // Top
        ctx.fillStyle="#0f2027"; ctx.strokeStyle="#22c55e"; ctx.lineWidth=1;
        ctx.beginPath(); tl.forEach((pp,i)=>i?ctx.lineTo(pp.x,pp.y):ctx.moveTo(pp.x,pp.y)); ctx.closePath(); ctx.fill(); ctx.stroke();
        // Terminal
        const term=p(0,-bd,bh+size*0.08);
        ctx.fillStyle="#22c55e"; ctx.beginPath(); ctx.arc(term.x,term.y,4,0,Math.PI*2); ctx.fill();
        // Level indicator
        ctx.fillStyle="#22c55e88";
        ctx.beginPath(); [fl[0],fl[1],tl[1],tl[0]].forEach((pp,i)=>{
          const lp={x:fl[i<2?i:i].x+(tl[i<2?i:i].x-fl[i<2?i:i].x)*0.6, y:fl[i<2?i:i].y+(tl[i<2?i:i].y-fl[i<2?i:i].y)*0.6};
          i?ctx.lineTo(lp.x,lp.y):ctx.moveTo(lp.x,lp.y);
        }); ctx.closePath(); ctx.fill();
        break;
      }
      case "watertank": {
        const tr=size*0.55, th=size*1.4;
        // Cylinder approximation with ellipses
        const bot=p(0,0,0), mid=p(0,0,th*0.5), top=p(0,0,th);
        // Body sides (simplified quad)
        const sides=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([dx,dy])=>({
          b:p(dx*tr*0.7,dy*tr*0.4,0), t:p(dx*tr*0.7,dy*tr*0.4,th)
        }));
        ctx.fillStyle="#0c4a6e"; ctx.strokeStyle="#38bdf8"; ctx.lineWidth=1;
        [[0,1],[1,2],[2,3],[3,0]].forEach(([i,j])=>{
          ctx.beginPath();
          ctx.moveTo(sides[i].b.x,sides[i].b.y); ctx.lineTo(sides[j].b.x,sides[j].b.y);
          ctx.lineTo(sides[j].t.x,sides[j].t.y); ctx.lineTo(sides[i].t.x,sides[i].t.y);
          ctx.closePath(); ctx.fill(); ctx.stroke();
        });
        // Top cap ellipse
        ctx.fillStyle="#0ea5e9";
        ctx.beginPath(); sides.forEach((s,i)=>i?ctx.lineTo(s.t.x,s.t.y):ctx.moveTo(s.t.x,s.t.y)); ctx.closePath(); ctx.fill(); ctx.stroke();
        // Water ripple on top
        ctx.strokeStyle="#38bdf8"; ctx.lineWidth=0.7;
        ctx.beginPath(); ctx.moveTo(top.x-u*0.4,top.y); ctx.lineTo(top.x+u*0.4,top.y); ctx.stroke();
        break;
      }
      case "tree": {
        const th=size*1.8;
        // Trunk
        ctx.strokeStyle="#713f12"; ctx.lineWidth=4;
        ctx.beginPath(); ctx.moveTo(p(0,0,0).x,p(0,0,0).y); ctx.lineTo(p(0,0,th*0.35).x,p(0,0,th*0.35).y); ctx.stroke();
        // Layered canopy spheres (approximated as circles at height)
        [[0,0,th*0.35,size*0.9,"#166534"],[0,0,th*0.6,size*0.75,"#15803d"],[0,0,th*0.85,size*0.55,"#16a34a"],[0,0,th,"size"*0.3,"#22c55e"]].forEach(([x,y,z,r,col],i)=>{
          const pos=p(x,y,z); const rad=i===3?size*u*0.08:[size*u*0.14,size*u*0.12,size*u*0.09][i];
          ctx.fillStyle=col;
          ctx.beginPath(); ctx.arc(pos.x,pos.y,Math.max(6,rad),0,Math.PI*2); ctx.fill();
          ctx.fillStyle="rgba(255,255,255,0.1)";
          ctx.beginPath(); ctx.arc(pos.x-rad*0.25,pos.y-rad*0.25,rad*0.4,0,Math.PI*2); ctx.fill();
        });
        break;
      }
      case "parking": {
        const pw=size*1.0, pd=size*0.6;
        const corners=[p(-pw,-pd,0),p(pw,-pd,0),p(pw,pd,0),p(-pw,pd,0)];
        // Ground marking
        ctx.fillStyle="rgba(71,85,105,0.4)";
        ctx.beginPath(); corners.forEach((pp,i)=>i?ctx.lineTo(pp.x,pp.y):ctx.moveTo(pp.x,pp.y)); ctx.closePath(); ctx.fill();
        ctx.strokeStyle="#64748b"; ctx.lineWidth=1; ctx.setLineDash([4,3]);
        ctx.beginPath(); corners.forEach((pp,i)=>i?ctx.lineTo(pp.x,pp.y):ctx.moveTo(pp.x,pp.y)); ctx.closePath(); ctx.stroke();
        ctx.setLineDash([]);
        // Car (simplified box shape)
        const ch=size*0.3, cw=size*0.5, cd=size*0.35;
        const cf=[p(-cw,-cd,0),p(cw,-cd,0),p(cw,cd,0),p(-cw,cd,0)];
        const ct=[p(-cw,-cd,ch),p(cw,-cd,ch),p(cw,cd,ch),p(-cw,cd,ch)];
        ctx.fillStyle="#334155";
        ctx.beginPath(); cf.forEach((pp,i)=>i?ctx.lineTo(pp.x,pp.y):ctx.moveTo(pp.x,pp.y)); ctx.closePath(); ctx.fill();
        [[cf[0],cf[1],ct[1],ct[0]],[cf[1],cf[2],ct[2],ct[1]]].forEach(face=>{
          ctx.fillStyle="#2d3748";
          ctx.beginPath(); face.forEach((pp,i)=>i?ctx.lineTo(pp.x,pp.y):ctx.moveTo(pp.x,pp.y)); ctx.closePath(); ctx.fill();
        });
        ctx.strokeStyle="#475569"; ctx.lineWidth=0.7;
        ctx.beginPath(); ct.forEach((pp,i)=>i?ctx.lineTo(pp.x,pp.y):ctx.moveTo(pp.x,pp.y)); ctx.closePath(); ctx.stroke();
        // Windshield
        ctx.fillStyle="#60a5fa44";
        ctx.beginPath(); [ct[0],ct[1],cf[1],cf[0]].forEach((pp,i)=>i?ctx.lineTo(pp.x,pp.y):ctx.moveTo(pp.x,pp.y)); ctx.closePath(); ctx.fill();
        break;
      }
      case "antenna": {
        const ah=size*1.5;
        const base2=p(0,0,0), top2=p(0,0,ah);
        // Mast
        ctx.strokeStyle="#94a3b8"; ctx.lineWidth=2;
        ctx.beginPath(); ctx.moveTo(base2.x,base2.y); ctx.lineTo(top2.x,top2.y); ctx.stroke();
        // Dish
        const dc=p(0,0,ah*0.8);
        ctx.fillStyle="#334155"; ctx.strokeStyle="#94a3b8"; ctx.lineWidth=1;
        ctx.beginPath(); ctx.arc(dc.x,dc.y,u*0.5,0,Math.PI*2); ctx.fill(); ctx.stroke();
        // Signal rings animated
        const t=Date.now()/1000;
        [0.6,0.9,1.2].forEach((r,i)=>{
          const phase=(t*1.5+i*0.4)%1;
          ctx.strokeStyle=`rgba(0,229,255,${0.7*(1-phase)})`; ctx.lineWidth=1;
          ctx.beginPath(); ctx.arc(dc.x,dc.y,u*r*phase*1.2+2,0,Math.PI*2); ctx.stroke();
        });
        // Feed point
        ctx.fillStyle="#00e5ff"; ctx.beginPath(); ctx.arc(dc.x,dc.y,3,0,Math.PI*2); ctx.fill();
        break;
      }
      case "pool": {
        // pw/pd in floor-meters (not pixel-scaled) to avoid huge rendering
        const pw=(size||1)*1.0, pd=(size||1)*0.65;
        const corners=[p(-pw,-pd,0),p(pw,-pd,0),p(pw,pd,0),p(-pw,pd,0)];
        const shimmer=0.55+Math.sin(Date.now()/800)*0.1;
        const pc=ctx._poolColor?ctx._poolColor:"#0891b2";
        const [p3r,p3g,p3b]=pc.replace("#","").match(/../g).map(h=>parseInt(h,16));
        // Water fill
        ctx.fillStyle='rgba('+p3r+','+p3g+','+p3b+','+shimmer+')';
        ctx.beginPath(); ctx.moveTo(corners[0].x,corners[0].y);
        corners.forEach(c=>ctx.lineTo(c.x,c.y)); ctx.closePath(); ctx.fill();
        ctx.strokeStyle='#a5f3fc'; ctx.lineWidth=1.5; ctx.stroke();
        // Ripple
        const mc=p(0,0,0);
        ctx.strokeStyle='rgba(165,243,252,0.3)'; ctx.lineWidth=0.7;
        ctx.beginPath(); ctx.ellipse(mc.x,mc.y,pw*0.5,pd*0.35,0,0,Math.PI*2); ctx.stroke();
        break;
      }
      case "fence": {
        // Row of hedge pillars
        const hh=size*0.4;
        for(let fi=-2;fi<=2;fi++){
          const fb=p(fi*size*0.35,0,0), ft=p(fi*size*0.35,0,hh);
          ctx.strokeStyle='#166534'; ctx.lineWidth=3;
          ctx.beginPath(); ctx.moveTo(fb.x,fb.y); ctx.lineTo(ft.x,ft.y); ctx.stroke();
          ctx.fillStyle='#15803d'; ctx.beginPath(); ctx.arc(ft.x,ft.y,4,0,Math.PI*2); ctx.fill();
        }
        break;
      }
      case "garage": {
        const gw=size*1.2,gd=size*0.9,gh=size*0.8;
        // Floor
        const fl=[p(-gw,-gd,0),p(gw,-gd,0),p(gw,gd,0),p(-gw,gd,0)];
        ctx.fillStyle='#1e293b';
        ctx.beginPath(); fl.forEach((c,i)=>i?ctx.lineTo(c.x,c.y):ctx.moveTo(c.x,c.y));
        ctx.closePath(); ctx.fill(); ctx.strokeStyle='#475569'; ctx.lineWidth=1; ctx.stroke();
        // Front wall
        const fw=[p(-gw,-gd,0),p(gw,-gd,0),p(gw,-gd,gh),p(-gw,-gd,gh)];
        ctx.fillStyle='#263347';
        ctx.beginPath(); fw.forEach((c,i)=>i?ctx.lineTo(c.x,c.y):ctx.moveTo(c.x,c.y));
        ctx.closePath(); ctx.fill(); ctx.stroke();
        // Roof
        const ridge=p(0,-gd,gh+u*0.5);
        [p(-gw,-gd,gh),p(gw,-gd,gh)].forEach(corner=>{
          ctx.fillStyle='#0f172a';
          ctx.beginPath(); ctx.moveTo(corner.x,corner.y); ctx.lineTo(p(0,-gd,0).x,p(0,-gd,0).y); ctx.lineTo(ridge.x,ridge.y); ctx.closePath(); ctx.fill();
          ctx.strokeStyle='#334155'; ctx.lineWidth=0.8; ctx.stroke();
        });
        break;
      }
      case "raisedbed": {
        // 3D Hochbeet: Holzkasten mit Erde
        const rbw=size*0.9, rbd=size*0.55, rbh=size*0.3;
        const corners=[p(-rbw,-rbd,0),p(rbw,-rbd,0),p(rbw,rbd,0),p(-rbw,rbd,0)];
        const top=[p(-rbw,-rbd,rbh),p(rbw,-rbd,rbh),p(rbw,rbd,rbh),p(-rbw,rbd,rbh)];
        // Boden
        ctx.fillStyle="#5c3a1e";
        ctx.beginPath(); corners.forEach((c,i)=>i?ctx.lineTo(c.x,c.y):ctx.moveTo(c.x,c.y));
        ctx.closePath(); ctx.fill();
        // Seiten
        [[0,1],[1,2],[2,3],[3,0]].forEach(([a,b])=>{
          ctx.fillStyle="#6b4423";
          ctx.beginPath(); ctx.moveTo(corners[a].x,corners[a].y); ctx.lineTo(corners[b].x,corners[b].y);
          ctx.lineTo(top[b].x,top[b].y); ctx.lineTo(top[a].x,top[a].y); ctx.closePath(); ctx.fill();
          ctx.strokeStyle="#8b5e3c"; ctx.lineWidth=0.8; ctx.stroke();
        });
        // Erde oben
        ctx.fillStyle="#2d1a0e";
        ctx.beginPath(); top.forEach((c,i)=>i?ctx.lineTo(c.x,c.y):ctx.moveTo(c.x,c.y));
        ctx.closePath(); ctx.fill();
        // Pflanzen
        [[-rbw*0.5,0],[ 0,-rbd*0.4],[rbw*0.5,0]].forEach(([px,py])=>{
          const pp=p(px,py,rbh+size*0.15);
          ctx.fillStyle="#22c55e"; ctx.strokeStyle="#16a34a"; ctx.lineWidth=0.8;
          ctx.beginPath(); ctx.arc(pp.x,pp.y,6,0,Math.PI*2); ctx.fill(); ctx.stroke();
        });
        break;
      }
      case "trellis": {
        // 3D Spalier: Wandgitter aufrecht stehend
        const tw=size*1.0, th=size*1.4;
        // Pfosten links+rechts
        [[- tw,0],[tw,0]].forEach(([tx,ty])=>{
          const bot=p(tx,ty,0), top=p(tx,ty,th);
          ctx.strokeStyle="#92400e"; ctx.lineWidth=3;
          ctx.beginPath(); ctx.moveTo(bot.x,bot.y); ctx.lineTo(top.x,top.y); ctx.stroke();
        });
        // Horizontale Latten
        for(let i=0;i<=4;i++){
          const z=i*(th/4);
          const l=p(-tw,0,z), r=p(tw,0,z);
          ctx.strokeStyle="#a16207"; ctx.lineWidth=1.5;
          ctx.beginPath(); ctx.moveTo(l.x,l.y); ctx.lineTo(r.x,r.y); ctx.stroke();
        }
        // Ranken
        ctx.strokeStyle="rgba(34,197,94,0.6)"; ctx.lineWidth=1;
        for(let i=0;i<3;i++){
          const sx=p(-tw*0.5+i*tw*0.5,0,th*0.2);
          const ex=p(-tw*0.3+i*tw*0.5,0,th*0.9);
          ctx.beginPath(); ctx.moveTo(sx.x,sx.y); ctx.quadraticCurveTo(
            (sx.x+ex.x)/2+10, (sx.y+ex.y)/2, ex.x, ex.y); ctx.stroke();
        }
        break;
      }
      case "sprinkler": {
        // 3D Rasensprinkler: Kopf auf Bodenniveau + Wasserfächer
        const t4=(Date.now()/800)%1;
        const sp=p(0,0,size*0.15);
        ctx.fillStyle="#475569"; ctx.strokeStyle="#94a3b8"; ctx.lineWidth=1;
        ctx.beginPath(); ctx.arc(sp.x,sp.y,8,0,Math.PI*2); ctx.fill(); ctx.stroke();
        // Wasserstrahlen im Fächer
        for(let i=0;i<8;i++){
          const ang=(i/8)*Math.PI*2+t4*Math.PI*2;
          const r=size*0.9;
          const ex=p(Math.cos(ang)*r, Math.sin(ang)*r, size*0.05);
          const phase=(t4+i/8)%1;
          ctx.strokeStyle=`rgba(125,211,252,${0.5-phase*0.4})`;
          ctx.lineWidth=0.8; ctx.setLineDash([3,2]);
          ctx.beginPath(); ctx.moveTo(sp.x,sp.y); ctx.lineTo(ex.x,ex.y); ctx.stroke();
          ctx.setLineDash([]);
        }
        // Wasserkreis am Boden
        ctx.strokeStyle="rgba(125,211,252,0.2)"; ctx.lineWidth=0.6; ctx.setLineDash([2,3]);
        const cirPts=[];
        for(let i=0;i<=16;i++){
          const a=(i/16)*Math.PI*2;
          cirPts.push(p(Math.cos(a)*size*0.9, Math.sin(a)*size*0.9, 0));
        }
        ctx.beginPath(); cirPts.forEach((c,i)=>i?ctx.lineTo(c.x,c.y):ctx.moveTo(c.x,c.y));
        ctx.stroke(); ctx.setLineDash([]);
        break;
      }
      case "gardenlight": {
        // 3D Gartenlampe: Pfahl mit Laternenkopf
        const t5=(Date.now()/1000)%1;
        const lh=size*1.6;
        const base=p(0,0,0), top=p(0,0,lh), head=p(size*0.3,0,lh*0.92);
        ctx.strokeStyle="#94a3b8"; ctx.lineWidth=2;
        ctx.beginPath(); ctx.moveTo(base.x,base.y); ctx.lineTo(top.x,top.y); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(top.x,top.y); ctx.lineTo(head.x,head.y); ctx.stroke();
        // Laternenkopf
        ctx.fillStyle="#1e293b"; ctx.strokeStyle="#475569"; ctx.lineWidth=1;
        ctx.beginPath(); ctx.arc(head.x,head.y,7,0,Math.PI*2); ctx.fill(); ctx.stroke();
        // Lichtschein
        const li=0.3+0.12*Math.sin(t5*Math.PI*2);
        ctx.fillStyle=`rgba(255,235,150,${li*0.6})`;
        ctx.beginPath(); ctx.arc(head.x,head.y,22,0,Math.PI*2); ctx.fill();
        ctx.fillStyle="rgba(255,235,150,0.9)";
        ctx.beginPath(); ctx.arc(head.x,head.y,4,0,Math.PI*2); ctx.fill();
        break;
      }
      case "shedhouse": {
        // 3D Gartenhaus
        const sw=size*0.9, sd=size*0.75, sh2=size*0.85;
        const fl=[p(-sw,-sd,0),p(sw,-sd,0),p(sw,sd,0),p(-sw,sd,0)];
        const tl=[p(-sw,-sd,sh2),p(sw,-sd,sh2),p(sw,sd,sh2),p(-sw,sd,sh2)];
        const ridge=[p(0,-sd,sh2+size*0.5),p(0,sd,sh2+size*0.5)];
        // Boden
        ctx.fillStyle="#5c2d0e"; ctx.beginPath();
        fl.forEach((c,i)=>i?ctx.lineTo(c.x,c.y):ctx.moveTo(c.x,c.y)); ctx.closePath(); ctx.fill();
        // Wände
        [[0,1],[1,2],[2,3],[3,0]].forEach(([a,b])=>{
          ctx.fillStyle="#78350f";
          ctx.beginPath(); ctx.moveTo(fl[a].x,fl[a].y); ctx.lineTo(fl[b].x,fl[b].y);
          ctx.lineTo(tl[b].x,tl[b].y); ctx.lineTo(tl[a].x,tl[a].y); ctx.closePath(); ctx.fill();
          ctx.strokeStyle="#92400e"; ctx.lineWidth=0.8; ctx.stroke();
        });
        // Dachflächen
        [[0,1,ridge[0],ridge[1]],[2,3,ridge[1],ridge[0]]].forEach(([a,b,r1,r2])=>{
          ctx.fillStyle="#b45309";
          ctx.beginPath(); ctx.moveTo(tl[a].x,tl[a].y); ctx.lineTo(tl[b].x,tl[b].y);
          ctx.lineTo(r2.x,r2.y); ctx.lineTo(r1.x,r1.y); ctx.closePath(); ctx.fill();
          ctx.strokeStyle="#92400e"; ctx.lineWidth=0.8; ctx.stroke();
        });
        break;
      }
      case "bench": {
        // 3D Gartenbank
        const bw=size*0.9, bd=size*0.35, bh=size*0.25, bl=size*0.45;
        // Sitzfläche
        const sf=[p(-bw,-bd,bh),p(bw,-bd,bh),p(bw,bd,bh),p(-bw,bd,bh)];
        ctx.fillStyle="#78350f"; ctx.beginPath();
        sf.forEach((c,i)=>i?ctx.lineTo(c.x,c.y):ctx.moveTo(c.x,c.y)); ctx.closePath(); ctx.fill();
        ctx.strokeStyle="#92400e"; ctx.lineWidth=0.8; ctx.stroke();
        // Rücklehne
        const rl=[p(-bw,-bd,bh),p(bw,-bd,bh),p(bw,-bd,bh+bl),p(-bw,-bd,bh+bl)];
        ctx.fillStyle="#6b2d0a"; ctx.beginPath();
        rl.forEach((c,i)=>i?ctx.lineTo(c.x,c.y):ctx.moveTo(c.x,c.y)); ctx.closePath(); ctx.fill();
        ctx.stroke();
        // Beine
        [[-bw*0.8,-bd],[bw*0.8,-bd],[-bw*0.8,bd],[bw*0.8,bd]].forEach(([lx,ly])=>{
          const lb=p(lx,ly,0), lt=p(lx,ly,bh);
          ctx.strokeStyle="#92400e"; ctx.lineWidth=2;
          ctx.beginPath(); ctx.moveTo(lb.x,lb.y); ctx.lineTo(lt.x,lt.y); ctx.stroke();
        });
        break;
      }
      case "fireplace": {
        // 3D Feuerstelle: Steinring am Boden + Flammen
        const t7=(Date.now()/600)%1;
        // Steinring
        const fpts=[];
        for(let i=0;i<=24;i++){
          const a=(i/24)*Math.PI*2;
          fpts.push(p(Math.cos(a)*size, Math.sin(a)*size, 0));
        }
        ctx.strokeStyle="#6b7280"; ctx.lineWidth=6;
        ctx.beginPath(); fpts.forEach((c,i)=>i?ctx.lineTo(c.x,c.y):ctx.moveTo(c.x,c.y)); ctx.stroke();
        ctx.fillStyle="#1c1917"; ctx.beginPath();
        fpts.forEach((c,i)=>i?ctx.lineTo(c.x,c.y):ctx.moveTo(c.x,c.y)); ctx.closePath(); ctx.fill();
        // Holz-Kreuz
        [[p(-size*0.6,0,0),p(size*0.6,0,0)],[p(0,-size*0.6,0),p(0,size*0.6,0)]].forEach(([a,b])=>{
          ctx.strokeStyle="#78350f"; ctx.lineWidth=3;
          ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke();
        });
        // Flamme
        const fbase=p(0,0,0), ftip=p(0,0,size*(0.8+0.2*Math.sin(t7*Math.PI*4)));
        const fmid1=p(size*0.2*(0.5+Math.sin(t7*Math.PI*3)),0,size*0.5);
        ctx.strokeStyle=`rgba(251,146,60,${0.8+0.2*Math.sin(t7*Math.PI*5)})`;
        ctx.lineWidth=4; ctx.lineCap="round";
        ctx.beginPath(); ctx.moveTo(fbase.x,fbase.y); ctx.quadraticCurveTo(fmid1.x,fmid1.y,ftip.x,ftip.y); ctx.stroke();
        ctx.strokeStyle=`rgba(253,224,71,${0.6+0.2*Math.sin(t7*Math.PI*3)})`;
        ctx.lineWidth=2;
        ctx.beginPath(); ctx.moveTo(fbase.x,fbase.y); ctx.lineTo(ftip.x,ftip.y); ctx.stroke();
        ctx.lineCap="butt";
        break;
      }
      case "greenhouse": {
        // 3D Gewächshaus: Tunnel
        const gw=size*0.8, gd=size*1.2, gh=size*0.9;
        // Bogen-Querschnitte (3 Bögen)
        for(let bi=0;bi<=2;bi++){
          const y=(-gd+bi*gd);
          const arcPts=[];
          for(let i=0;i<=12;i++){
            const a=(i/12)*Math.PI;
            arcPts.push(p(Math.cos(a)*gw-gw,y,Math.sin(a)*gh));
          }
          ctx.strokeStyle="rgba(125,211,252,0.5)"; ctx.lineWidth=1;
          ctx.beginPath(); arcPts.forEach((c,i)=>i?ctx.lineTo(c.x,c.y):ctx.moveTo(c.x,c.y)); ctx.stroke();
        }
        // Längsrippen oben
        ctx.strokeStyle="rgba(125,211,252,0.3)"; ctx.lineWidth=0.8;
        for(let ri=0;ri<=4;ri++){
          const a=(ri/4)*Math.PI;
          const front=p(Math.cos(a)*gw-gw,-gd,Math.sin(a)*gh);
          const back=p(Math.cos(a)*gw-gw,gd,Math.sin(a)*gh);
          ctx.beginPath(); ctx.moveTo(front.x,front.y); ctx.lineTo(back.x,back.y); ctx.stroke();
        }
        // Glashülle (halbtransparent)
        ctx.fillStyle="rgba(125,211,252,0.06)";
        const gfl=[p(-gw*2,-gd,0),p(0,-gd,0),p(0,gd,0),p(-gw*2,gd,0)];
        ctx.beginPath(); gfl.forEach((c,i)=>i?ctx.lineTo(c.x,c.y):ctx.moveTo(c.x,c.y)); ctx.closePath(); ctx.fill();
        // Pflanzen drin
        [[-gw*0.8,-gd*0.5],[-gw*0.8,0],[-gw*0.8,gd*0.5]].forEach(([px,py])=>{
          const pp=p(px,py,size*0.25);
          ctx.fillStyle="rgba(34,197,94,0.7)"; ctx.beginPath(); ctx.arc(pp.x,pp.y,5,0,Math.PI*2); ctx.fill();
        });
        break;
      }
      case "pondpump": {
        // 3D Teichpumpe: Pumpe im Teich
        const t6=(Date.now()/1200)%1;
        // Teichrand
        const tpts=[];
        for(let i=0;i<=20;i++){
          const a=(i/20)*Math.PI*2;
          tpts.push(p(Math.cos(a)*size*0.9, Math.sin(a)*size*0.6, 0));
        }
        ctx.fillStyle="rgba(7,89,133,0.6)"; ctx.beginPath();
        tpts.forEach((c,i)=>i?ctx.lineTo(c.x,c.y):ctx.moveTo(c.x,c.y)); ctx.closePath(); ctx.fill();
        ctx.strokeStyle="#0ea5e9"; ctx.lineWidth=1; ctx.stroke();
        // Pumpe (Zylinder)
        const pp=p(0,0,size*0.2);
        ctx.fillStyle="#0c4a6e"; ctx.strokeStyle="#0ea5e9"; ctx.lineWidth=1;
        ctx.beginPath(); ctx.arc(pp.x,pp.y,7,0,Math.PI*2); ctx.fill(); ctx.stroke();
        // Wasserstrahl nach oben
        const wjh=size*0.6+size*0.1*Math.sin(t6*Math.PI*4);
        const wtip=p(0,0,wjh);
        ctx.strokeStyle=`rgba(125,211,252,0.7)`; ctx.lineWidth=2; ctx.lineCap="round";
        ctx.beginPath(); ctx.moveTo(pp.x,pp.y); ctx.lineTo(wtip.x,wtip.y); ctx.stroke();
        ctx.lineCap="butt";
        ctx.fillStyle="rgba(125,211,252,0.8)"; ctx.beginPath(); ctx.arc(wtip.x,wtip.y,3,0,Math.PI*2); ctx.fill();
        break;
      }
      case "gardenbed": case "rockgarden": {
        // 3D Bodenbeet / Steingarten: flat mit Textur
        const gbw=size*0.9, gbd=size*0.7;
        const gfc=[p(-gbw,-gbd,0),p(gbw,-gbd,0),p(gbw,gbd,0),p(-gbw,gbd,0)];
        ctx.fillStyle = type==="gardenbed" ? "rgba(45,26,14,0.9)" : "rgba(55,65,81,0.9)";
        ctx.beginPath(); gfc.forEach((c,i)=>i?ctx.lineTo(c.x,c.y):ctx.moveTo(c.x,c.y)); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = type==="gardenbed" ? "#78350f" : "#6b7280";
        ctx.lineWidth=0.8; ctx.stroke();
        // Pflanzen / Steine
        const items=type==="gardenbed"?[[-gbw*0.5,-gbd*0.4],[0,0],[gbw*0.5,-gbd*0.4],[0,gbd*0.5]]:
                                        [[-gbw*0.5,0],[gbw*0.5,-gbd*0.3],[0,gbd*0.4]];
        items.forEach(([ix,iy])=>{
          const ip=p(ix,iy,0.1);
          ctx.fillStyle=type==="gardenbed"?"rgba(34,197,94,0.7)":"rgba(75,85,99,0.9)";
          ctx.beginPath(); ctx.arc(ip.x,ip.y,5,0,Math.PI*2); ctx.fill();
        });
        break;
      }
    }

    // Label in 3D
    if (label) {
      const lpos = project(mx, my, (type==="powerpole"?size*2.7:type==="tree"?size*2.1:size*0.8));
      ctx.save();
      ctx.font = "bold 8px 'JetBrains Mono',monospace";
      ctx.fillStyle = "#10b981";
      ctx.textAlign = "center"; ctx.textBaseline = "bottom";
      ctx.fillText(label, lpos.x, lpos.y - 4);
      ctx.restore();
    }

    // ── Entity value overlay in 3D ──────────────────────────────────────────
    if (deco && this._hass) {
      const rows = [];
      const hass = this._hass;
      const getState = (eid) => eid && hass.states?.[eid];

      // ── Solar: yield power ──
      if (type === "solar" && deco.entity) {
        const s=getState(deco.entity);
        if(s) rows.push({ icon:"☀️", text: parseFloat(s.state).toFixed(2)+" "+(s.attributes?.unit_of_measurement||"kW"), col:"#fbbf24" });
      }
      // ── Inverter: output + input ──
      if (type === "inverter") {
        if(deco.entity) { const s=getState(deco.entity); if(s) rows.push({icon:"⚡",text:parseFloat(s.state).toFixed(2)+" "+(s.attributes?.unit_of_measurement||"W"),col:"#00e5ff"}); }
        if(deco.entity2){ const s=getState(deco.entity2); if(s) rows.push({icon:"🔌",text:parseFloat(s.state).toFixed(2)+" "+(s.attributes?.unit_of_measurement||"W"),col:"#a78bfa"}); }
      }
      // ── Battery: SoC + power ──
      if (type === "battery") {
        if(deco.entity) { const s=getState(deco.entity); if(s) { const soc=parseFloat(s.state); const bar="█".repeat(Math.round(soc/20))+"░".repeat(5-Math.round(soc/20)); rows.push({icon:"🔋",text:bar+" "+soc.toFixed(0)+"%",col: soc>50?"#22c55e":soc>20?"#f59e0b":"#ef4444"}); } }
        if(deco.entity2){ const s=getState(deco.entity2); if(s) rows.push({icon:"⚡",text:parseFloat(s.state).toFixed(1)+" W",col:"#00e5ff"}); }
      }
      // ── Watertank: level ──
      if (type === "watertank" && deco.entity) {
        const s=getState(deco.entity);
        if(s) rows.push({icon:"💧",text:parseFloat(s.state).toFixed(1)+" "+(s.attributes?.unit_of_measurement||"%"),col:"#38bdf8"});
      }
      // ── Pool: temp + pH + pump ──
      if (type === "pool") {
        if(deco.pool_temp){ const s=getState(deco.pool_temp); if(s) rows.push({icon:"🌡",text:parseFloat(s.state).toFixed(1)+(s.attributes?.unit_of_measurement||"°C"),col:"#67e8f9"}); }
        if(deco.pool_ph){  const s=getState(deco.pool_ph);   if(s) rows.push({icon:"🧪",text:"pH "+parseFloat(s.state).toFixed(1),col:"#a78bfa"}); }
        if(deco.pool_pump){ const s=getState(deco.pool_pump); if(s) { const on=["on","true","1"].includes(s.state.toLowerCase()); rows.push({icon:"⚙",text:on?"Pumpe AN":"Pumpe AUS",col:on?"#22c55e":"#64748b"}); } }
      }
      // ── Garage: entity open/close ──
      if (type === "garage" && deco.entity) {
        const s=getState(deco.entity);
        if(s){ const op=["open","on","true"].includes(s.state.toLowerCase()); rows.push({icon:"🏠",text:op?"OFFEN":"GESCHLOSSEN",col:op?"#22c55e":"#ef4444"}); }
      }
      // ── Antenna: signal strength ──
      if (type === "antenna" && deco.entity) {
        const s=getState(deco.entity);
        if(s) rows.push({icon:"📡",text:s.state+" "+(s.attributes?.unit_of_measurement||"dBm"),col:"#34d399"});
      }

      if (rows.length) {
        const lposE = project(mx, my, (type==="pool"?0:size)*1.1 + 0.15);
        const fh3 = 9, boxW3 = Math.max(70, rows.reduce((m,r)=>(r.text.length*5.5+24)>m?(r.text.length*5.5+24):m,0));
        const boxH3 = rows.length * fh3 + 7;
        ctx.save();
        ctx.fillStyle = "rgba(7,9,13,0.82)";
        ctx.beginPath();
        ctx.roundRect(lposE.x - boxW3/2, lposE.y - boxH3, boxW3, boxH3, 4);
        ctx.fill();
        ctx.strokeStyle = "#00e5ff44"; ctx.lineWidth=0.6; ctx.stroke();
        rows.forEach((row,ri) => {
          ctx.font = "bold 7px 'JetBrains Mono',monospace";
          ctx.fillStyle = row.col || "#94a3b8";
          ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
          ctx.fillText(row.icon+" "+row.text, lposE.x, lposE.y - boxH3 + fh3*(ri+1) + 1);
        });
        ctx.restore();
      }
    }
  }


  // ── Energy canvas overlay ─────────────────────────────────────────────────
  _drawEnergyOverlay() {
    const ctx = this._ctx;
    if (!ctx) return;
    const isEdit    = this._mode === "energie";
    const lines     = isEdit ? (this._pendingEnergyLines||[]) : (this._data?.energy_lines||[]);
    const batteries = isEdit ? (this._pendingBatteries||[])   : (this._data?.batteries||[]);
    if (!lines.length && !batteries.length && !isEdit) return;

    const now = performance.now();
    const dt  = Math.min(50, now - (this._energyAnimTs || now));
    this._energyAnimTs = now;

    const typeMap = {};
    this._energieTypes().forEach(t => { typeMap[t.id] = t; });

    // ── Leitungen ──────────────────────────────────────────────────────────
    lines.forEach((line, li) => {
      const typeConf = typeMap[line.type||"solar"] || typeMap.solar;
      const col = typeConf.color;
      const [rr,gg,bb] = col.replace("#","").match(/../g).map(h=>parseInt(h,16));

      // Placing ghost
      if (isEdit && this._placingEnergyPt?.lineIdx===li && this._mouseFloor) {
        const cm = this._f2c(this._mouseFloor.mx, this._mouseFloor.my);
        ctx.save();
        ctx.strokeStyle = col + "88"; ctx.lineWidth=2;
        ctx.setLineDash([5,4]);
        ctx.beginPath(); ctx.arc(cm.x, cm.y, 8, 0, Math.PI*2); ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }

      if (line.x1==null || line.x2==null) return;

      const c1 = this._f2c(line.x1, line.y1);
      const c2 = this._f2c(line.x2, line.y2);

      // Live value
      let value = 0;
      if (line.entity && this._hass?.states?.[line.entity]) {
        value = parseFloat(this._hass.states[line.entity].state) || 0;
      }
      const maxW   = line.max_w || 5000;
      const absVal = Math.abs(value);
      const frac   = Math.min(1, absVal / maxW);
      const isActive = absVal > 0.5;

      // Direction
      let forward = line.direction === "forward" ? true
                  : line.direction === "reverse" ? false
                  : value >= 0;

      // Base line width (berechnet vor forEach-Blöcken – verhindert TDZ bei const lw)
      const lw = 2 + frac * 5;

      // Direction arrow markers on line
      if (isActive && isFinite(c1.x) && isFinite(c2.x)) {
        const dx=c2.x-c1.x, dy=c2.y-c1.y;
        const len=Math.hypot(dx,dy);
        if (len > 20) {
          const nx=dx/len, ny=dy/len;
          const arrowDir = forward ? 1 : -1;
          // Draw 2 arrows along the line
          [0.35, 0.65].forEach(t => {
            const ax = c1.x + dx*t, ay = c1.y + dy*t;
            const ax2 = ax + nx*6*arrowDir, ay2 = ay + ny*6*arrowDir;
            ctx.save();
            ctx.strokeStyle = `rgba(${rr},${gg},${bb},0.6)`;
            ctx.lineWidth = lw * 0.6;
            ctx.lineCap = "round";
            ctx.beginPath();
            ctx.moveTo(ax2 - nx*6 - ny*4, ay2 - ny*6 + nx*4);
            ctx.lineTo(ax2, ay2);
            ctx.lineTo(ax2 - nx*6 + ny*4, ay2 - ny*6 - nx*4);
            ctx.stroke();
            ctx.restore();
          });
        }
      }
      // Base line
      const alpha = isActive ? 0.85 : 0.22;
      ctx.save();
      ctx.strokeStyle = `rgba(${rr},${gg},${bb},${alpha})`;
      ctx.lineWidth = lw; ctx.lineCap = "round";
      if (isActive) { ctx.shadowColor = col; ctx.shadowBlur = 6 + frac * 8; }
      ctx.beginPath(); ctx.moveTo(c1.x, c1.y); ctx.lineTo(c2.x, c2.y); ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.restore();

      // Particles
      if (isActive) {
        if (!this._energyParticles) this._energyParticles = [];
        if (!this._energyParticles[li]) this._energyParticles[li] = [];
        const particles = this._energyParticles[li];
        const lineLen   = Math.hypot(c2.x-c1.x, c2.y-c1.y);
        const speed     = (30 + frac * 160) / lineLen;
        const dir       = forward ? 1 : -1;

        particles.forEach(p => {
          p.t += dt / 1000 * speed * dir;
          if (p.t > 1) p.t -= 1;
          if (p.t < 0) p.t += 1;
        });

        const wanted = Math.min(15, Math.max(2, Math.ceil(lineLen / Math.max(18, lineLen / 8))));
        while (particles.length < wanted) particles.push({ t: Math.random() });
        particles.length = Math.min(particles.length, wanted);

        particles.forEach(p => {
          const px = c1.x + (c2.x-c1.x)*p.t;
          const py = c1.y + (c2.y-c1.y)*p.t;
          ctx.save();
          ctx.fillStyle = "#fff";
          ctx.shadowColor = col; ctx.shadowBlur = 8;
          ctx.beginPath(); ctx.arc(px, py, 2 + frac*2, 0, Math.PI*2); ctx.fill();
          ctx.restore();
        });

        // Arrow at destination end
        const ang = forward ? Math.atan2(c2.y-c1.y, c2.x-c1.x) : Math.atan2(c1.y-c2.y, c1.x-c2.x);
        const tip = forward ? c2 : c1;
        const asz = 7 + frac * 6;
        ctx.save();
        ctx.fillStyle = col;
        ctx.shadowColor = col; ctx.shadowBlur = 4;
        ctx.translate(tip.x, tip.y); ctx.rotate(ang);
        ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(-asz,-asz*0.42); ctx.lineTo(-asz,asz*0.42);
        ctx.closePath(); ctx.fill();
        ctx.restore();
      } else {
        if (this._energyParticles) this._energyParticles[li] = [];
      }

      // Endpoint dots
      [c1,c2].forEach((pt,pi) => {
        ctx.save();
        ctx.fillStyle = col; ctx.strokeStyle = "rgba(7,9,13,0.85)"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(pt.x, pt.y, 5, 0, Math.PI*2); ctx.fill(); ctx.stroke();
        ctx.restore();
      });

      // Mid label
      const midX = (c1.x+c2.x)/2, midY = (c1.y+c2.y)/2;
      const nameStr = (line.name||typeConf.label).substring(0,12);
      const valStr  = isActive ? `${absVal>999?(absVal/1000).toFixed(1)+"k":absVal.toFixed(0)} ${typeConf.unit}` : "0 "+typeConf.unit;
      const bw2 = Math.max(52, nameStr.length*5+valStr.length*5.5+14);
      ctx.save();
      ctx.fillStyle = "rgba(7,9,13,0.8)";
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(midX-bw2/2, midY-17, bw2, 19, 3);
      else ctx.rect(midX-bw2/2, midY-17, bw2, 19);
      ctx.fill();
      ctx.font = "bold 7px 'JetBrains Mono',monospace";
      ctx.fillStyle = "rgba(255,255,255,0.45)"; ctx.textAlign = "center";
      ctx.fillText(nameStr.toUpperCase(), midX, midY-6);
      ctx.font = "bold 8px 'JetBrains Mono',monospace";
      ctx.fillStyle = isActive ? col : "#475569";
      ctx.fillText(valStr, midX, midY+4);
      ctx.textAlign = "left";
      ctx.restore();
    });

    // ── Akkus ───────────────────────────────────────────────────────────────
    batteries.forEach((bat, bi) => {
      // Ghost while placing
      if (isEdit && this._placingBatteryIdx===bi && this._mouseFloor) {
        const cm = this._f2c(this._mouseFloor.mx, this._mouseFloor.my);
        ctx.save(); ctx.globalAlpha=0.4; ctx.fillStyle="#4ade80";
        ctx.fillRect(cm.x-14, cm.y-24, 28, 40); ctx.restore();
      }
      if (bat.mx==null||bat.my==null) return;

      const c = this._f2c(bat.mx, bat.my);
      let soc=null, power=0;
      if (bat.entity&&this._hass?.states?.[bat.entity]) {
        const v=parseFloat(this._hass.states[bat.entity].state);
        if (!isNaN(v)) soc=v;
      }
      if (bat.power_entity&&this._hass?.states?.[bat.power_entity]) {
        power=parseFloat(this._hass.states[bat.power_entity].state)||0;
      }

      const col = soc===null?"#64748b":soc>60?"#4ade80":soc>20?"#f59e0b":"#ef4444";
      const [rr,gg,bb] = col.replace("#","").match(/../g).map(h=>parseInt(h,16));
      const bw=30, bh=50, bx=c.x-bw/2, by=c.y-bh/2;

      // Glow when active
      if (Math.abs(power)>1) {
        const grd=ctx.createRadialGradient(c.x,c.y,0,c.x,c.y,bh*0.9);
        grd.addColorStop(0,`rgba(${rr},${gg},${bb},0.22)`);
        grd.addColorStop(1,`rgba(${rr},${gg},${bb},0)`);
        ctx.fillStyle=grd; ctx.beginPath(); ctx.arc(c.x,c.y,bh*0.9,0,Math.PI*2); ctx.fill();
      }

      // Body
      ctx.fillStyle="rgba(7,9,13,0.9)"; ctx.strokeStyle=col; ctx.lineWidth=1.8;
      ctx.beginPath();
      if(ctx.roundRect) ctx.roundRect(bx,by+5,bw,bh-5,3);
      else ctx.rect(bx,by+5,bw,bh-5);
      ctx.fill(); ctx.stroke();

      // Pole nub
      ctx.fillStyle=col;
      ctx.beginPath();
      if(ctx.roundRect) ctx.roundRect(bx+bw*0.3,by,bw*0.4,7,2);
      else ctx.rect(bx+bw*0.3,by,bw*0.4,7);
      ctx.fill();

      // Fill level
      if (soc!==null) {
        const innerH=bh-10, innerY=by+7;
        const fillH=innerH*(soc/100);
        const fillY=innerY+innerH-fillH;
        ctx.fillStyle=`rgba(${rr},${gg},${bb},0.72)`;
        ctx.beginPath();
        if(ctx.roundRect) ctx.roundRect(bx+3,fillY,bw-6,fillH,2);
        else ctx.rect(bx+3,fillY,bw-6,fillH);
        ctx.fill();
        // Lamellen
        ctx.strokeStyle=`rgba(${rr},${gg},${bb},0.25)`; ctx.lineWidth=0.5;
        for(let i=1;i<5;i++){
          const ly=innerY+innerH*i/5;
          ctx.beginPath(); ctx.moveTo(bx+3,ly); ctx.lineTo(bx+bw-3,ly); ctx.stroke();
        }
        // SOC text
        ctx.font=`bold ${soc===100?8:9}px 'JetBrains Mono',monospace`;
        ctx.fillStyle=soc>35?"rgba(7,9,13,0.9)":col;
        ctx.textAlign="center";
        ctx.fillText(`${Math.round(soc)}%`,c.x,c.y+3);
      }

      // Charge/discharge indicator
      if (power>1) {
        ctx.font="bold 9px monospace"; ctx.fillStyle="#fbbf24"; ctx.textAlign="center";
        ctx.fillText("⚡",c.x-4,by+19);
      } else if (power<-1) {
        ctx.font="bold 9px monospace"; ctx.fillStyle=col; ctx.textAlign="center";
        ctx.fillText("↓",c.x-3,by+19);
      }

      // Name
      ctx.font="bold 7px 'JetBrains Mono',monospace"; ctx.fillStyle=col; ctx.textAlign="center";
      ctx.fillText((bat.name||"Akku").substring(0,8).toUpperCase(), c.x, by+bh+9);

      // Power value
      if (Math.abs(power)>0.5) {
        const pStr=(power>0?"+":"")+(Math.abs(power)>999?(power/1000).toFixed(1)+"kW":power.toFixed(0)+"W");
        ctx.font="7px 'JetBrains Mono',monospace";
        ctx.fillStyle=power>0?"#4ade80":"#f59e0b";
        ctx.fillText(pStr, c.x, by+bh+18);
      }
      ctx.textAlign="left";
    });
  }



  // ══════════════════════════════════════════════════════════════════════════
  // ── SETTINGS TAB ─────────────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════

  _sidebarSettings() {
    const wrap = document.createElement("div");
    wrap.style.cssText = "padding:8px;display:flex;flex-direction:column;gap:5px";

    const hdr = document.createElement("div");
    hdr.style.cssText = "font-size:10px;font-weight:700;color:#94a3b8;letter-spacing:1px;margin-bottom:4px";
    hdr.textContent = "⚙ OPTIONEN";
    wrap.appendChild(hdr);

    const opts = [
      { key:"showRoomTemp",    emoji:"🌡",  label:"Raum-Temperatur",       desc:"Temp aus Info-Sensor im Raum" },
      { key:"showDeviceTrail", emoji:"👣",  label:"Geräte-Pfad",           desc:"Letzte N Positionen anzeigen" },
      { key:"nightMode",       emoji:"🌙",  label:"Nacht-Modus",           desc:"Automatisch via sun.sun" },
      { key:"zoomPan",         emoji:"🔍",  label:"Zoom & Pan",             desc:"Scrollrad + Drag" },
      { key:"personAvatar",    emoji:"🧑",  label:"Personen-Avatar",        desc:"Profilbild aus HA-Person" },
      { key:"roomTapLight",    emoji:"💡",  label:"Raum-Tap → Licht",       desc:"Tap auf Raum steuert Lampen" },
      { key:"showHeating",     emoji:"🔥",  label:"Heizungsplan",           desc:"Soll/Ist-Temp pro Raum" },
      { key:"showHeatmap",     emoji:"🗺",  label:"Heatmap-Overlay",        desc:"Aufenthaltszeit visualisieren" },
      { key:"show3D",          emoji:"🧊",  label:"3D-Ansicht",             desc:"Isometrische Darstellung" },
      { key:"multiFloor",      emoji:"🏠",  label:"Mehrgeschoss",           desc:"Etagen-Tabs aktivieren" },
      { key:"showMmwave",    emoji:"📡", label:"mmWave Tracking",     desc:"Personen-Tracking via mmWave Sensoren" },
      { key:"mmwaveClassify",  emoji:"🧠", label:"KI Klassifikation",   desc:"Personen/Kind/Tier automatisch erkennen" },
      { key:"mmwavePosture",   emoji:"🧍", label:"Haltungs-Erkennung",  desc:"Stehen / Sitzen / Liegen anzeigen" },
      { key:"mmwaveFallDetect",emoji:"🛡", label:"Sturz-Erkennung",     desc:"Alarm bei Sturz oder Reglosigkeit" },
      { key:"mmwaveFallSound", emoji:"🔔", label:"Sturz-Alarm Sound",   desc:"Akustischer Alarm bei Sturzerkennung" },
      { key:"mmwaveFusion",    emoji:"⊕",  label:"Multi-Sensor Fusion",  desc:"Triangulierte Positionen aus 2+ Sensoren" },
      { key:"showAnalytics",   emoji:"📊", label:"Aktivitäts-Tracking",  desc:"Raum-Aufenthalt + Verlauf aufzeichnen" },
      { key:"showSleep",       emoji:"🌙", label:"Schlaf-Monitoring",    desc:"Schlafdauer + Schlafqualität schätzen" },
      { key:"mmwavePersonID",  emoji:"🔍", label:"Personen-Wiedererkennung",desc:"Person via Tageszeit-Muster identifizieren" },
      { key:"showEmergencyBtn",emoji:"🆘", label:"Notfall-Button",       desc:"SOS-Button mit HA-Event" },
      { key:"ptzTracking",    emoji:"📹", label:"PTZ Auto-Tracking",    desc:"PTZ Kameras folgen Personen automatisch" },
      { key:"showPresence",    emoji:"👁",  label:"Präsenz-Erkennung",      desc:"Grüner Glow wenn Gerät im Raum" },
      { key:"showGeofence",    emoji:"🔔",  label:"Geofence-Alarm",          desc:"Toast bei Raum-Betreten/-Verlassen" },
      { key:"showDayTime",     emoji:"🌤",  label:"Tageszeit-Animation",     desc:"Sonnenbahn + Schatten (nur 3D)" },
      { key:"showCamera",      emoji:"📷",  label:"Kamera-Overlay",          desc:"Sichtfeld wenn camera.* Entity" },
      { key:"showRaumVerlauf", emoji:"⏱",  label:"Raum-Verlauf",            desc:"Heatmap Aufenthaltszeit (blau→rot)" },
      { key:"floorOverlay",    emoji:"🏠",  label:"Etagen-Überlagerung",     desc:"Andere Etagen als Geist im 3D" },
      { key:"shadowSim",       emoji:"🌑",  label:"Schatten-Simulation",     desc:"3D Wandschatten nach Tageszeit" },
      { key:"energyRoomCorr",  emoji:"📊",  label:"Energie-Raum-Korrelation",desc:"Verbrauch pro Raum (Anwesenheit)" },
      { key:"guestMode",       emoji:"👤",  label:"Gast-Modus",              desc:"Ausgewählte Geräte ausblenden" },
    ];

    opts.forEach(opt => {
      const row = document.createElement("div");
      row.style.cssText = "display:flex;align-items:center;gap:8px;padding:6px 8px;background:var(--surf2);border-radius:6px;border:1px solid var(--border);cursor:pointer";

      const toggle = document.createElement("div");
      const isOn = this._opts?.[opt.key] ?? false;
      toggle.style.cssText = `width:28px;height:16px;border-radius:8px;background:${isOn?"#00e5ff":"#334155"};position:relative;transition:background 0.2s;flex-shrink:0`;
      const knob = document.createElement("div");
      knob.style.cssText = `position:absolute;top:2px;left:${isOn?"14px":"2px"};width:12px;height:12px;border-radius:50%;background:#fff;transition:left 0.2s`;
      toggle.appendChild(knob);

      const info = document.createElement("div");
      info.style.cssText = "flex:1;min-width:0";
      const lbl = document.createElement("div");
      lbl.style.cssText = "font-size:9px;font-weight:700;color:var(--text)";
      lbl.textContent = `${opt.emoji} ${opt.label}`;
      const desc = document.createElement("div");
      desc.style.cssText = "font-size:7px;color:var(--muted);margin-top:1px";
      desc.textContent = opt.desc;
      info.append(lbl, desc);
      row.append(toggle, info);

      row.addEventListener("click", () => {
        if (!this._opts) this._opts = {};
        this._opts[opt.key] = !this._opts[opt.key];
        this._saveOptions();
        this._rebuildSidebar();
        this._draw();
      });

      wrap.appendChild(row);
    });

    // ── Gast-Modus: Geräte-Auswahl ──────────────────────────────────────────
    if (this._opts?.guestMode) {
      const guestBox = document.createElement("div");
      guestBox.style.cssText = "background:var(--surf2);border-radius:6px;padding:8px;border:1px solid #f59e0b44;margin-top:2px";

      const gHdr = document.createElement("div");
      gHdr.style.cssText = "font-size:8px;font-weight:700;color:#f59e0b;letter-spacing:0.5px;margin-bottom:6px";
      gHdr.textContent = "👤 AUSGEBLENDETE GERÄTE";
      guestBox.appendChild(gHdr);

      const devices = this._data?.devices || [];
      if (!devices.length) {
        const nodev = document.createElement("div");
        nodev.style.cssText = "font-size:8px;color:var(--muted);padding:4px";
        nodev.textContent = "Keine Geräte vorhanden";
        guestBox.appendChild(nodev);
      }
      devices.forEach(dev => {
        const isHidden = !!(this._guestHidden?.[dev.device_id]);
        const devRow = document.createElement("div");
        devRow.style.cssText = "display:flex;align-items:center;gap:6px;padding:4px;border-radius:4px;cursor:pointer;transition:background 0.15s;" +
          (isHidden ? "background:rgba(239,68,68,0.15);border:1px solid #ef444433;" : "border:1px solid transparent;");
        devRow.addEventListener("mouseenter", () => devRow.style.background = isHidden ? "rgba(239,68,68,0.2)" : "var(--surf3)");
        devRow.addEventListener("mouseleave", () => devRow.style.background = isHidden ? "rgba(239,68,68,0.15)" : "transparent");

        const icon = document.createElement("span");
        icon.style.cssText = "font-size:12px;flex-shrink:0";
        icon.textContent = isHidden ? "🙈" : "👁";

        const nameEl = document.createElement("span");
        nameEl.style.cssText = `font-size:9px;flex:1;color:${isHidden ? "#ef4444" : "var(--text)"};${isHidden ? "text-decoration:line-through;opacity:0.7" : ""}`;
        nameEl.textContent = dev.device_name || dev.device_id;

        devRow.append(icon, nameEl);
        devRow.addEventListener("click", () => {
          if (!this._guestHidden) this._guestHidden = {};
          this._guestHidden[dev.device_id] = !this._guestHidden[dev.device_id];
          this._rebuildSidebar();
          this._draw();
        });
        guestBox.appendChild(devRow);
      });

      // Reset button
      const resetBtn = document.createElement("button");
      resetBtn.textContent = "↺ Alle einblenden";
      resetBtn.style.cssText = "margin-top:6px;width:100%;background:none;border:1px solid var(--border);color:var(--muted);border-radius:4px;font-size:8px;padding:3px;cursor:pointer;font-family:inherit";
      resetBtn.addEventListener("click", () => {
        this._guestHidden = {};
        this._rebuildSidebar();
        this._draw();
      });
      guestBox.appendChild(resetBtn);
      wrap.appendChild(guestBox);
    }

    // Wall height slider (shown when show3D is on)
    if (this._opts?.show3D) {
      const wallRow = document.createElement("div");
      wallRow.style.cssText = "display:flex;align-items:center;gap:6px;padding:6px 8px;background:var(--surf2);border-radius:6px;border:1px solid #00e5ff44";
      const wallLbl = document.createElement("span"); wallLbl.textContent="🧊 Wandhöhe"; wallLbl.style.cssText="font-size:9px;color:var(--text);flex:1";
      const wallInp = document.createElement("input");
      wallInp.type="range"; wallInp.min=1.5; wallInp.max=5; wallInp.step=0.1;
      wallInp.value = this._wallHeight ?? 2.5;
      wallInp.style.cssText="flex:1;accent-color:#00e5ff";
      const wallVal = document.createElement("span"); wallVal.style.cssText="font-size:8px;color:#00e5ff;min-width:28px;text-align:right";
      wallVal.textContent = (this._wallHeight??2.5).toFixed(1)+" m";
      wallInp.addEventListener("input",()=>{
        this._wallHeight = parseFloat(wallInp.value);
        wallVal.textContent = this._wallHeight.toFixed(1)+" m";
        this._draw();
      });
      wallRow.append(wallLbl, wallInp, wallVal);
      wrap.appendChild(wallRow);
    }

    // ── 3D wall color + transparency controls ──────────────────────────────
    if (this._opts?.show3D) {
      // Color override toggle
      const colorRow = document.createElement("div");
      colorRow.style.cssText = "display:flex;align-items:center;gap:6px;padding:6px 8px;background:var(--surf2);border-radius:6px;border:1px solid #00e5ff44";
      const colorLbl = document.createElement("span"); colorLbl.textContent="🎨 Wand-Farbe"; colorLbl.style.cssText="font-size:9px;color:var(--text);flex:1";
      const colorNote = document.createElement("span"); colorNote.style.cssText="font-size:7px;color:var(--muted)"; colorNote.textContent="(leer = Raumfarbe)";
      const colorInp = document.createElement("input");
      colorInp.type = "color";
      colorInp.value = this._3dWallColor || "#334155";
      colorInp.style.cssText = "width:28px;height:22px;border:none;background:none;cursor:pointer;border-radius:4px";
      const clearBtn = document.createElement("button");
      clearBtn.textContent = "✕"; clearBtn.title = "Raumfarbe verwenden";
      clearBtn.style.cssText = "font-size:9px;background:var(--surf3);border:1px solid var(--border);color:var(--muted);border-radius:3px;padding:1px 4px;cursor:pointer";
      colorInp.addEventListener("input", () => { this._3dWallColor = colorInp.value; this._draw(); });
      clearBtn.addEventListener("click", () => { this._3dWallColor = null; this._draw(); });
      colorRow.append(colorLbl, colorNote, colorInp, clearBtn);
      wrap.appendChild(colorRow);

      // Transparency slider
      const alphaRow = document.createElement("div");
      alphaRow.style.cssText = "display:flex;align-items:center;gap:6px;padding:6px 8px;background:var(--surf2);border-radius:6px;border:1px solid #00e5ff44";
      const alphaLbl = document.createElement("span"); alphaLbl.textContent="💧 Transparenz"; alphaLbl.style.cssText="font-size:9px;color:var(--text);flex:1";
      const alphaInp = document.createElement("input");
      alphaInp.type="range"; alphaInp.min=0.1; alphaInp.max=1.0; alphaInp.step=0.05;
      alphaInp.value = this._3dWallAlpha ?? 0.75;
      alphaInp.style.cssText="flex:1;accent-color:#00e5ff";
      const alphaVal = document.createElement("span"); alphaVal.style.cssText="font-size:8px;color:#00e5ff;min-width:28px;text-align:right";
      alphaVal.textContent = Math.round((this._3dWallAlpha??0.75)*100)+"%";
      alphaInp.addEventListener("input", () => {
        this._3dWallAlpha = parseFloat(alphaInp.value);
        alphaVal.textContent = Math.round(this._3dWallAlpha*100)+"%";
        this._draw();
      });
      alphaRow.append(alphaLbl, alphaInp, alphaVal);
      wrap.appendChild(alphaRow);
    }

    // Trail length setting
    const trailRow = document.createElement("div");
    trailRow.style.cssText = "display:flex;align-items:center;gap:6px;padding:6px 8px;background:var(--surf2);border-radius:6px;border:1px solid var(--border)";
    const trailLbl = document.createElement("span"); trailLbl.textContent="👣 Pfad-Länge"; trailLbl.style.cssText="font-size:9px;color:var(--text);flex:1";
    const trailInp = document.createElement("input");
    trailInp.type="range"; trailInp.min=3; trailInp.max=50; trailInp.value=this._trailMaxLen||20;
    trailInp.style.cssText="flex:1;accent-color:var(--accent)";
    const trailVal = document.createElement("span"); trailVal.style.cssText="font-size:8px;color:var(--accent);min-width:20px;text-align:right";
    trailVal.textContent=this._trailMaxLen||20;
    trailInp.addEventListener("input",()=>{this._trailMaxLen=parseInt(trailInp.value);trailVal.textContent=trailInp.value;});
    trailRow.append(trailLbl,trailInp,trailVal);
    wrap.appendChild(trailRow);

    // Heating entities section (if showHeating)
    if (this._opts?.showHeating) {
      const heatHdr = document.createElement("div");
      heatHdr.style.cssText = "font-size:8px;font-weight:700;color:#fb923c;letter-spacing:0.5px;margin-top:6px";
      heatHdr.textContent = "🔥 HEIZUNGSPLAN";
      wrap.appendChild(heatHdr);

      (this._data?.rooms || []).forEach((room, ri) => {
        const hr = this._heatingRooms?.[ri] || {};
        const box = document.createElement("div");
        box.style.cssText = "background:var(--surf2);border-radius:5px;padding:5px 7px;border:1px solid var(--border)";
        const rlbl = document.createElement("div"); rlbl.style.cssText="font-size:8px;font-weight:700;color:var(--text);margin-bottom:3px"; rlbl.textContent=room.name||`Raum ${ri+1}`;
        box.appendChild(rlbl);
        ["temp_entity","target_entity","thermostat_entity"].forEach((field,fi) => {
          const fr = document.createElement("div"); fr.style.cssText="display:flex;align-items:center;gap:4px;margin-bottom:2px";
          const fl2 = document.createElement("span"); fl2.textContent=["Ist","Soll","Thermostat"][fi]; fl2.style.cssText="font-size:7px;color:var(--muted);width:52px;flex-shrink:0";
          const fi2 = document.createElement("input"); fi2.value=hr[field]||""; fi2.placeholder=["sensor.temp","input_number.soll","climate.heizung"][fi];
          fi2.style.cssText="flex:1;background:var(--surf3);border:1px solid var(--border);color:var(--text);border-radius:3px;font-size:7px;padding:2px 3px";
          fi2.addEventListener("input",()=>{if(!this._heatingRooms)this._heatingRooms={};if(!this._heatingRooms[ri])this._heatingRooms[ri]={};this._heatingRooms[ri][field]=fi2.value.trim();});
          fr.append(fl2,fi2); box.appendChild(fr);
        });
        wrap.appendChild(box);
      });
    }

    // ── Multi-Floor management ─────────────────────────────────────────────
    if (this._opts?.multiFloor) {
      const flHdr = document.createElement("div");
      flHdr.style.cssText = "font-size:8px;font-weight:700;color:#60a5fa;letter-spacing:0.5px;margin-top:6px";
      flHdr.textContent = "🏠 ETAGEN-VERWALTUNG";
      wrap.appendChild(flHdr);

      if (!this._floors?.length) {
        const hint = document.createElement("div");
        hint.style.cssText = "font-size:8px;color:var(--muted);padding:4px";
        hint.textContent = "Noch keine Etagen. Klicke + um die erste anzulegen.";
        wrap.appendChild(hint);
      } else {
        this._floors.forEach((fl, fi) => {
          const row = document.createElement("div");
          row.style.cssText = `display:flex;align-items:center;gap:5px;padding:4px 6px;background:${fi===this._activeFloor?"rgba(96,165,250,0.15)":"var(--surf2)"};border-radius:5px;border:1px solid ${fi===this._activeFloor?"#60a5fa":"var(--border)"};margin-bottom:3px`;
          const nameInp = document.createElement("input"); nameInp.value=fl.name||`Etage ${fi+1}`;
          nameInp.style.cssText="flex:1;background:transparent;border:none;color:var(--text);font-size:8px;font-weight:700;font-family:inherit";
          nameInp.addEventListener("change",()=>{fl.name=nameInp.value;this._saveFloors();});
          const activeLabel = document.createElement("span");
          activeLabel.style.cssText=`font-size:7px;padding:1px 5px;border-radius:8px;${fi===this._activeFloor?"background:#60a5fa;color:#07090d":"background:transparent;color:var(--muted)"}`;
          activeLabel.textContent=fi===this._activeFloor?"aktiv":"";
          const switchBtn = document.createElement("button");
          switchBtn.style.cssText="font-size:8px;padding:2px 6px;background:var(--surf3);border:1px solid var(--border);color:var(--text);border-radius:3px;cursor:pointer;font-family:inherit";
          switchBtn.textContent="↑↓";
          switchBtn.addEventListener("click",()=>this._switchFloor(fi));
          const delBtn = document.createElement("button");
          delBtn.style.cssText="font-size:8px;padding:2px 5px;background:transparent;border:1px solid #ef4444;color:#ef4444;border-radius:3px;cursor:pointer";
          delBtn.textContent="✕";
          delBtn.addEventListener("click",()=>{
            if(!confirm(`Etage "${fl.name}" löschen?`))return;
            this._floors.splice(fi,1);
            if(this._activeFloor>=this._floors.length)this._activeFloor=Math.max(0,this._floors.length-1);
            this._saveFloors(this._activeFloor);
            this._rebuildSidebar();
          });
          row.append(nameInp, activeLabel, switchBtn, delBtn);
          wrap.appendChild(row);
        });
      }

      const addFlBtn = document.createElement("button");
      addFlBtn.className="btn btn-outline";
      addFlBtn.style.cssText="width:100%;border-color:#60a5fa;color:#60a5fa;margin-top:2px;font-size:9px";
      addFlBtn.textContent="+ Neue Etage";
      addFlBtn.addEventListener("click",()=>this._addFloor());
      wrap.appendChild(addFlBtn);
    }

    // Reset zoom button
    if (this._opts?.zoomPan && (this._zoom !== 1 || this._panX !== 0 || this._panY !== 0)) {
      const resetBtn = document.createElement("button");
      resetBtn.className="btn btn-outline"; resetBtn.style.cssText="width:100%;margin-top:4px;font-size:9px";
      resetBtn.textContent="↺ Zoom zurücksetzen";
      resetBtn.addEventListener("click",()=>{this._zoom=1;this._panX=0;this._panY=0;this._draw();});
      wrap.appendChild(resetBtn);
    }

    // ── BACKUP & EXPORT ──────────────────────────────────────────────────────
    const backupHdr = document.createElement("div");
    backupHdr.style.cssText = "font-size:10px;font-weight:700;color:#94a3b8;letter-spacing:1px;margin-top:10px;margin-bottom:4px";
    backupHdr.textContent = "💾 BACKUP & EXPORT";
    wrap.appendChild(backupHdr);

    // Info
    const backupInfo = document.createElement("div");
    backupInfo.style.cssText = "font-size:8px;color:var(--muted);padding:5px 8px;background:var(--surf2);border-radius:5px;border-left:3px solid #3b82f6;margin-bottom:6px;line-height:1.6";
    backupInfo.textContent = "Exportiert alle Einstellungen, Räume, Leuchten, Decos, Energie und Optionen in eine JSON-Datei.";
    wrap.appendChild(backupInfo);

    // Export button
    const expBtn = document.createElement("button");
    expBtn.style.cssText = "width:100%;padding:8px;border-radius:6px;border:1px solid #3b82f6;background:#3b82f611;color:#3b82f6;font-size:10px;font-weight:700;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:6px;margin-bottom:4px";
    expBtn.innerHTML = "⬇ Konfiguration exportieren (.json)";
    expBtn.addEventListener("click", () => this._exportConfig());
    wrap.appendChild(expBtn);

    // Import button + hidden file input
    const impRow = document.createElement("div");
    impRow.style.cssText = "position:relative";
    const impBtn = document.createElement("button");
    impBtn.style.cssText = "width:100%;padding:8px;border-radius:6px;border:1px solid #10b981;background:#10b98111;color:#10b981;font-size:10px;font-weight:700;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:6px;margin-bottom:4px";
    impBtn.innerHTML = "⬆ Konfiguration importieren (.json)";
    const fileInp = document.createElement("input");
    fileInp.type = "file"; fileInp.accept = ".json";
    fileInp.style.cssText = "position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%";
    fileInp.addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const cfg = JSON.parse(text);
        await this._importConfig(cfg);
        fileInp.value = "";
      } catch(err) {
        this._showToast("Import-Fehler: " + err.message);
        fileInp.value = "";
      }
    });
    impRow.append(impBtn, fileInp);
    wrap.appendChild(impRow);

    // ── Texturen ────────────────────────────────────────────────────────────
    const texSection = document.createElement("div");
    texSection.style.cssText = "margin-bottom:10px";

    const texHdr = document.createElement("div");
    texHdr.style.cssText = "font-size:9px;font-weight:700;color:#94a3b8;letter-spacing:1px;margin-bottom:6px;padding-bottom:4px;border-bottom:1px solid #1c2535";
    texHdr.textContent = "🖼 TEXTUREN";
    texSection.appendChild(texHdr);

    const texDefs = [
      { key:"texFloor",     label:"🪵 Boden",          hint:"2D + 3D" },
      { key:"texWallOuter", label:"🧱 Außenwand",       hint:"nur 3D"  },
      { key:"texWallInner", label:"🏠 Innenwand",       hint:"nur 3D"  },
      { key:"texDoor",      label:"🚪 Tür",             hint:"nur 3D"  },
    ];

    texDefs.forEach(({ key, label, hint }) => {
      const row = document.createElement("div");
      row.style.cssText = "display:flex;align-items:center;gap:6px;margin-bottom:7px";

      // Vorschau-Thumbnail
      const thumb = document.createElement("div");
      thumb.style.cssText = "width:36px;height:36px;border-radius:4px;border:1px solid #1c2535;background:#0d1219;flex-shrink:0;overflow:hidden;position:relative;cursor:pointer";
      const src = this._opts?.[key];
      if (src) {
        const img = document.createElement("img");
        img.src = src;
        img.style.cssText = "width:100%;height:100%;object-fit:cover";
        thumb.appendChild(img);
      } else {
        thumb.innerHTML = `<span style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:16px;color:#1c2535">+</span>`;
      }

      // Label + hint
      const labelWrap = document.createElement("div");
      labelWrap.style.cssText = "flex:1;min-width:0";
      const lbl = document.createElement("div");
      lbl.style.cssText = "font-size:9px;font-weight:700;color:#c8d8ec;white-space:nowrap";
      lbl.textContent = label;
      const hintEl = document.createElement("div");
      hintEl.style.cssText = "font-size:7.5px;color:#445566";
      hintEl.textContent = hint;
      labelWrap.append(lbl, hintEl);

      // Buttons
      const btnWrap = document.createElement("div");
      btnWrap.style.cssText = "display:flex;flex-direction:column;gap:2px";

      const fileInpTex = document.createElement("input");
      fileInpTex.type = "file"; fileInpTex.accept = "image/*";
      fileInpTex.style.cssText = "display:none";

      const uploadBtn = document.createElement("button");
      uploadBtn.style.cssText = "padding:2px 7px;border-radius:3px;border:1px solid #f59e0b55;background:#f59e0b11;color:#f59e0b;font-size:7.5px;cursor:pointer;font-family:inherit;white-space:nowrap";
      uploadBtn.textContent = "📁 Hochladen";
      uploadBtn.addEventListener("click", () => fileInpTex.click());

      const clearBtn = document.createElement("button");
      clearBtn.style.cssText = `padding:2px 7px;border-radius:3px;border:1px solid #445566;background:none;color:#445566;font-size:7.5px;cursor:pointer;font-family:inherit;white-space:nowrap;${src ? "" : "opacity:0.3;pointer-events:none"}`;
      clearBtn.textContent = "✕ Löschen";

      fileInpTex.addEventListener("change", () => {
        const file = fileInpTex.files?.[0];
        if (!file) return;
        // Bild auf max 512px skalieren (base64 klein halten)
        const reader = new FileReader();
        reader.onload = (ev) => {
          const rawSrc = ev.target.result;
          const tmpImg = new Image();
          tmpImg.onload = () => {
            const maxSide = 512;
            const scale = Math.min(1, maxSide / Math.max(tmpImg.width, tmpImg.height));
            const oc = document.createElement("canvas");
            oc.width  = Math.round(tmpImg.width  * scale);
            oc.height = Math.round(tmpImg.height * scale);
            oc.getContext("2d").drawImage(tmpImg, 0, 0, oc.width, oc.height);
            const dataUrl = oc.toDataURL("image/jpeg", 0.88);
            if (!this._opts) this._opts = {};
            this._opts[key] = dataUrl;
            const tkMapU = { texFloor:"floor", texWallOuter:"wall_outer", texWallInner:"wall_inner", texDoor:"door" };
            this._textureSrc[tkMapU[key] || key] = null; // force reload
            this._saveOpts();
            this._loadTextures();
            this._rebuildSidebar();
            this._draw();
          };
          tmpImg.src = rawSrc;
          fileInpTex.value = "";
        };
        reader.readAsDataURL(file);
      });

      clearBtn.addEventListener("click", () => {
        if (!this._opts) return;
        delete this._opts[key];
        // tex-Key → texture-Key Mapping
        const tkMap = { texFloor:"floor", texWallOuter:"wall_outer", texWallInner:"wall_inner", texDoor:"door" };
        const tk = tkMap[key] || key;
        this._textures[tk]   = null;
        this._textureSrc[tk] = null;
        this._saveOpts();
        this._rebuildSidebar();
        this._draw();
      });

      btnWrap.append(uploadBtn, clearBtn, fileInpTex);
      thumb.addEventListener("click", () => fileInpTex.click());
      row.append(thumb, labelWrap, btnWrap);
      texSection.appendChild(row);
    });

    wrap.appendChild(texSection);

    // Save-All button
    const saveAllBtn = document.createElement("button");
    saveAllBtn.style.cssText = "width:100%;padding:8px;border-radius:6px;border:1px solid #f59e0b;background:#f59e0b11;color:#f59e0b;font-size:10px;font-weight:700;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:6px";
    saveAllBtn.innerHTML = "💾 Alles jetzt speichern";
    saveAllBtn.addEventListener("click", async () => {
      saveAllBtn.textContent = "⏳ Speichern...";
      saveAllBtn.disabled = true;
      try {
        await this._saveAll();
        saveAllBtn.innerHTML = "✓ Alles gespeichert!";
        this._setTimeout(() => {
          saveAllBtn.disabled = false;
          saveAllBtn.innerHTML = "💾 Alles jetzt speichern";
        }, 2000);
      } catch(e) {
        saveAllBtn.disabled = false;
        saveAllBtn.innerHTML = "💾 Alles jetzt speichern";
        this._showToast("Fehler: " + e.message);
      }
    });
    wrap.appendChild(saveAllBtn);

    return wrap;
  }

  // ── Export: gesamte Konfiguration als JSON herunterladen ──────────────────
  _exportConfig() {
    const data = this._data || {};
    const now  = new Date();
    const dateStr = now.getFullYear() + "-" +
      String(now.getMonth()+1).padStart(2,"0") + "-" +
      String(now.getDate()).padStart(2,"0") + "_" +
      String(now.getHours()).padStart(2,"0") + "-" +
      String(now.getMinutes()).padStart(2,"0");

    const cfg = {
      _export_version:  "2.10.90",
      _export_date:     now.toISOString(),
      _entry_id:        this._entryId,
      // Grundriss
      floor_name:       data.floor_name     || "",
      floor_w:          data.floor_w        || 10,
      floor_h:          data.floor_h        || 10,
      img_opacity:      this._imgOpacity    ?? 0.35,
      grid_step:        data.grid_step      || 0.5,
      wall_height:      this._wallHeight    ?? 2.5,
      wall_color:       this._3dWallColor   || null,
      wall_alpha:       this._3dWallAlpha   ?? 0.75,
      // Planungsdaten
      rooms:            data.rooms          || [],
      doors:            data.doors          || [],
      windows:          data.windows        || [],
      scanners:         data.scanners       || [],
      lights:           this._pendingLights?.length
                          ? this._pendingLights
                          : (data.lights    || []),
      alarms:           data.alarms         || [],
      decos:            data.decos          || [],
      energy_lines:     data.energy_lines   || [],
      batteries:        data.batteries      || [],
      info_sensors:     data.info_sensors   || [],
      heating_rooms:    this._heatingRooms  || {},
      floors:           this._floors        || [],
      // Optionen
      options:          this._opts          || {},
      custom_designs:   this._pendingDesigns   || (data.custom_designs || []),
      // Geräte-Konfiguration (Namen/Farben)
      devices_cfg: (data.devices || []).map(d => ({
        device_id: d.device_id,
        device_name: d.device_name
      })),
    };

    const blob = new Blob([JSON.stringify(cfg, null, 2)], { type: "application/json" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `ble_positioning_${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    this._showToast("✓ Konfiguration exportiert: " + a.download);
  }

  // ── Import: JSON-Datei einlesen und alles speichern ────────────────────────
  async _importConfig(cfg) {
    if (!cfg || typeof cfg !== "object") throw new Error("Ungültige JSON-Datei");
    if (!cfg._export_version) throw new Error("Keine BLE-Positioning Konfigurationsdatei");

    const confirmed = confirm("⚠ Warnung: Aktuelle Konfig überschreiben? (Export v" + cfg._export_version + "). Trotzdem importieren?");
    if (!confirmed) return;

    this._showToast("⏳ Import läuft...");

    const id = this._entryId;
    const post = (ep, body) => this._hass.callApi("POST", `ble_positioning/${id}/${ep}`, body);

    try {
      // 1. Grundriss-Größe
      if (cfg.floor_w && cfg.floor_h) {
        await post("floor", {
          floor_w: cfg.floor_w,
          floor_h: cfg.floor_h,
          floor_name: cfg.floor_name || "",
          img_opacity: cfg.img_opacity ?? 0.35,
          grid_step: cfg.grid_step || 0.5,
          wall_height: cfg.wall_height ?? 2.5,
          wall_color: cfg.wall_color || null,
          wall_alpha: cfg.wall_alpha ?? 0.75,
        });
      }
      // 2. Räume
      if (cfg.rooms?.length) {
        await post("rooms", {
          rooms: cfg.rooms,
          doors: cfg.doors || [],
          windows: cfg.windows || [],
          floor_w: cfg.floor_w || 10,
          floor_h: cfg.floor_h || 10,
          img_opacity: cfg.img_opacity ?? 0.35,
        });
      }
      // 3. Scanner
      if (cfg.scanners?.length) {
        await post("scanners", { scanners: cfg.scanners });
      }
      // 4. Leuchten
      if (cfg.lights?.length) {
        await post("lights", { lights: cfg.lights });
      }
      // 4b. Custom Designs
      if (cfg.custom_designs?.length) {
        await post("custom_designs", { designs: cfg.custom_designs });
      }
      // 5. Alarme
      if (cfg.alarms?.length) {
        await post("alarms", { alarms: cfg.alarms });
      }
      // 6. Decos
      if (cfg.decos?.length) {
        await post("deko", { decos: cfg.decos });
      }
      // 7. Energie
      if (cfg.energy_lines?.length || cfg.batteries?.length) {
        await post("energy", {
          energy_lines: cfg.energy_lines || [],
          batteries: cfg.batteries || []
        });
      }
      // 8. Info-Sensoren
      if (cfg.info_sensors?.length) {
        await post("info_sensors", { info_sensors: cfg.info_sensors });
      }
      // 9. Optionen
      if (cfg.options) {
        await post("options", {
          options: cfg.options,
          heating_rooms: cfg.heating_rooms || {},
          wall_height: cfg.wall_height ?? 2.5,
          wall_color: cfg.wall_color || null,
          wall_alpha: cfg.wall_alpha ?? 0.75,
        });
      }

      await this._loadData();
      this._showToast("✓ Import erfolgreich! Alle Daten wurden wiederhergestellt.");
      this._rebuildSidebar();
      this._draw();
    } catch(e) {
      this._showToast("Import-Fehler: " + e.message);
      throw e;
    }
  }

  // ── Save All: alle ausstehenden Änderungen gleichzeitig speichern ──────────
  async _saveAll() {
    const id = this._entryId;
    const post = (ep, body) => this._hass.callApi("POST", `ble_positioning/${id}/${ep}`, body);

    const mapW  = parseFloat(this.shadowRoot.getElementById("map_w")?.value || this._data?.floor_w || 10);
    const mapH  = parseFloat(this.shadowRoot.getElementById("map_h")?.value || this._data?.floor_h || 10);

    await Promise.all([
      // Grundriss
      post("floor", {
        floor_w: isNaN(mapW) ? (this._data?.floor_w||10) : mapW,
        floor_h: isNaN(mapH) ? (this._data?.floor_h||10) : mapH,
        floor_name: this._data?.floor_name || "",
        img_opacity: this._imgOpacity ?? 0.35,
        grid_step: this._data?.grid_step || 0.5,
        wall_height: this._wallHeight ?? 2.5,
        wall_color: this._3dWallColor || null,
        wall_alpha: this._3dWallAlpha ?? 0.75,
      }),
      // Räume + Türen + Fenster
      post("rooms", {
        rooms: this._data?.rooms || [],
        doors: this._data?.doors || [],
        windows: this._data?.windows || [],
        floor_w: isNaN(mapW) ? (this._data?.floor_w||10) : mapW,
        floor_h: isNaN(mapH) ? (this._data?.floor_h||10) : mapH,
        img_opacity: this._imgOpacity ?? 0.35,
      }),
      // Scanner
      post("scanners", { scanners: this._pendingScanners || [] }),
      // Custom Designs
      post("custom_designs", { designs: this._pendingDesigns || [] }),
      // Leuchten (mit allen neuen Feldern)
      post("lights", {
        lights: (this._pendingLights || []).map(l => ({
          id: l.id, name: l.name, entity: l.entity,
          mx: l.mx, my: l.my, mz: l.mz,
          room_id: l.room_id, color: l.color,
          lumen: l.lumen, lamp_type: l.lamp_type
        }))
      }),
      // Alarme
      post("alarms", { alarms: this._pendingAlarms || [] }),
      // Decos
      post("deko", { decos: this._pendingDecos || [] }),
      // Energie
      post("energy", {
        energy_lines: this._pendingEnergyLines || [],
        batteries: this._pendingBatteries || []
      }),
      // Optionen
      post("options", {
        options: this._opts || {},
        heating_rooms: this._heatingRooms || {},
        wall_height: this._wallHeight ?? 2.5,
        wall_color: this._3dWallColor || null,
        wall_alpha: this._3dWallAlpha ?? 0.75,
      }),
    ]);

    await this._loadData();
    this._showToast("✓ Alle Einstellungen gespeichert!");
  }

  _saveOpts() { return this._saveOptions(); }  // Alias

  async _saveOptions() {
    try {
      await this._hass.callApi("POST",
        `ble_positioning/${this._entryId}/options`,
        { options: this._opts, heating_rooms: this._heatingRooms || {}, wall_height: this._wallHeight ?? 2.5, wall_color: this._3dWallColor, wall_alpha: this._3dWallAlpha ?? 0.75 });
    } catch(e) { /* silent */ }
    // Sync to /opts endpoint so switch entities in HA reflect current state
    try {
      await this._hass.callApi("POST",
        `ble_positioning/${this._entryId}/opts`,
        { opts: this._opts });
    } catch(e) { /* silent */ }
  }

  // ── Listen for ble_positioning_set_opt events from HA automations ─────────
  _initOptEventListener() {
    if (this._optEvtBound) return;
    this._optEvtBound = true;
    // HA fires events via the HA websocket – listen via hass.connection
    // We use window event as proxy (fired by companion card or HA frontend)
    this._optEvtHandler = (e) => {
      const d = e.detail || {};
      if (d.entry_id && d.entry_id !== this._entryId) return;
      if (d.opt_key && d.value !== undefined) {
        if (!this._opts) this._opts = {};
        this._opts[d.opt_key] = d.value;
        this._rebuildSidebar();
        this._draw();
      }
    };
    window.addEventListener("ble_positioning_set_opt", this._optEvtHandler);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ── FEATURE: NACHT-MODUS ─────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════

  _checkNightMode() {
    if (!this._opts?.nightMode) {
      this._isNightMode = false;
      this.shadowRoot.host?.classList.remove("night-mode");
      return;
    }
    // Check sun.sun entity
    if (this._hass?.states?.["sun.sun"]) {
      const sun = this._hass.states["sun.sun"].state;
      this._isNightMode = (sun === "below_horizon");
    } else {
      // Fallback: check local time (between 22:00 and 06:00)
      const h = new Date().getHours();
      this._isNightMode = h >= 22 || h < 6;
    }
    if (this._isNightMode) this.shadowRoot.host?.classList.add("night-mode");
    else this.shadowRoot.host?.classList.remove("night-mode");
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ── FEATURE: RAUM-TEMPERATUREN ───────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════

  _drawRoomTemperatures() {
    if (!this._data?.rooms) return;
    const ctx   = this._ctx;
    const rooms = this._data.rooms;
    // Find temp info-sensors per room
    const infoSensors = this._data.info_sensors || [];
    const tempSensors = infoSensors.filter(s => s.icon === "thermometer" && s.entity);

    rooms.forEach(room => {
      // Find a temp sensor placed inside this room
      const sensor = tempSensors.find(s =>
        s.mx >= room.x1 && s.mx <= room.x2 &&
        s.my >= room.y1 && s.my <= room.y2
      );
      if (!sensor) return;

      const val = parseFloat(this._hass?.states?.[sensor.entity]?.state);
      if (isNaN(val)) return;

      // Color from cold (blue) to hot (red)
      const t = Math.max(0, Math.min(1, (val - 16) / 14)); // 16°C=blue, 30°C=red
      const r = Math.round(t * 255);
      const b = Math.round((1-t) * 220);
      const col = `rgb(${r},80,${b})`;

      const c1 = this._f2c(room.x1, room.y1);
      const c2 = this._f2c(room.x2, room.y2);
      const cx = (c1.x+c2.x)/2, cy = (c1.y+c2.y)/2;
      const rw = c2.x-c1.x, rh = c2.y-c1.y;

      // Subtle warm/cold room tint
      ctx.save();
      ctx.fillStyle = `rgba(${r},80,${b},${0.06 + t*0.08})`;
      ctx.fillRect(c1.x, c1.y, rw, rh);
      ctx.restore();

      // Temperature badge at top of room
      const badgeY = c1.y + 6;
      const txt = `${val.toFixed(1)}°`;
      const bw = txt.length * 6.5 + 8;
      ctx.save();
      ctx.fillStyle = "rgba(7,9,13,0.78)";
      ctx.strokeStyle = col; ctx.lineWidth = 1;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(cx-bw/2, badgeY, bw, 14, 3);
      else ctx.rect(cx-bw/2, badgeY, bw, 14);
      ctx.fill(); ctx.stroke();
      ctx.font = "bold 9px 'JetBrains Mono',monospace";
      ctx.fillStyle = col; ctx.textAlign = "center";
      ctx.fillText(txt, cx, badgeY+10);
      ctx.textAlign = "left";
      ctx.restore();
    });
  }

  // ── Personenzähler pro Raum ─────────────────────────────────────────────
  _drawRoomOccupancy() {
    const ctx = this._ctx;
    if (!ctx) return;
    const sensors = (this._pendingMmwave?.length > 0 ? this._pendingMmwave : this._data?.mmwave_sensors) || [];
    if (!sensors.length) return;
    const rooms = this._data?.rooms || [];
    if (!rooms.length) return;

    // Zähle Personen pro Raum
    const roomCount = {}; // roomIdx → [{name, color, cls}]
    sensors.forEach(sensor => {
      for (let ti=1; ti<=3; ti++) {
        const target = this._getMmwaveTarget(sensor, ti);
        if (!target?.present) continue;
        const room = this._getRoomForPoint(target.floor_mx, target.floor_my);
        if (!room) continue;
        const roomIdx = rooms.indexOf(room);
        if (roomIdx < 0) continue;
        if (!roomCount[roomIdx]) roomCount[roomIdx] = [];
        const tName = (sensor.target_names||[])[ti-1] || ("P"+ti);
        const tCol = ["#ff6b35","#00e5ff","#22c55e"][ti-1] || "#fff";
        roomCount[roomIdx].push({ name: tName, color: tCol, sensorName: sensor.name });
      }
    });

    // Zeichne Badge in Raum-Ecke
    Object.entries(roomCount).forEach(([ridx, persons]) => {
      const room = rooms[parseInt(ridx)];
      if (!room) return;
      const c = this._f2c(room.x2, room.y1); // oben rechts
      const n = persons.length;
      const zoom = this._zoom||1;
      const sc = Math.max(0.8, Math.min(1.6, zoom));

      // Badge Hintergrund
      const r = 10 * sc, fontSize = Math.round(9 * sc);
      ctx.save();
      // Glow ring
      ctx.fillStyle = n > 1 ? "#f59e0b33" : "#22c55e33";
      ctx.beginPath(); ctx.arc(c.x - r*1.2, c.y + r*1.2, r*1.8, 0, Math.PI*2); ctx.fill();
      // Circle
      ctx.fillStyle = n > 1 ? "#f59e0b" : "#22c55e";
      ctx.beginPath(); ctx.arc(c.x - r*1.2, c.y + r*1.2, r, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.5)"; ctx.lineWidth = 1.5*sc; ctx.stroke();
      // Person count
      ctx.fillStyle = "#000";
      ctx.font = `bold ${fontSize}px 'JetBrains Mono',monospace`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(n > 9 ? "9+" : String(n), c.x - r*1.2, c.y + r*1.2);
      // Person icon neben Zahl
      ctx.font = `${Math.round(8*sc)}px serif`;
      ctx.fillText("👤", c.x - r*1.2 + r*1.5, c.y + r*1.2);
      ctx.restore();
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ── FEATURE: GERÄTE-TRAIL ────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════

  _updateDeviceTrails() {
    if (!this._opts?.showDeviceTrail) return;
    const devices = this._data?.devices || [];
    const now = Date.now();
    devices.forEach(dev => {
      const id  = dev.device_id;
      const mx  = dev.state?.mx ?? dev.mx;
      const my  = dev.state?.my ?? dev.my;
      if (mx == null || my == null) return;
      if (!this._deviceTrail[id]) this._deviceTrail[id] = [];
      const trail = this._deviceTrail[id];
      const last  = trail[trail.length-1];
      // Only add if moved more than 10cm
      if (!last || Math.hypot(mx-last.mx, my-last.my) > 0.1) {
        trail.push({ mx, my, ts: now });
        if (trail.length > (this._trailMaxLen || 20)) trail.shift();
      }
    });
  }

  _drawDeviceTrail(ctx, devId, color) {
    if (!this._opts?.showDeviceTrail) return;
    const trail = this._deviceTrail?.[devId];
    if (!trail || trail.length < 2) return;
    const [rr,gg,bb] = color.replace("#","").match(/../g).map(h=>parseInt(h,16));
    const now = Date.now();

    ctx.save();
    for (let i = 1; i < trail.length; i++) {
      const p1 = this._f2c(trail[i-1].mx, trail[i-1].my);
      const p2 = this._f2c(trail[i].mx,   trail[i].my);
      const age = (i / trail.length); // 0=oldest, 1=newest
      ctx.strokeStyle = `rgba(${rr},${gg},${bb},${age * 0.55})`;
      ctx.lineWidth   = age * 3;
      ctx.lineCap     = "round";
      ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
    }
    // Oldest point dot
    const oldest = this._f2c(trail[0].mx, trail[0].my);
    ctx.fillStyle = `rgba(${rr},${gg},${bb},0.2)`;
    ctx.beginPath(); ctx.arc(oldest.x, oldest.y, 3, 0, Math.PI*2); ctx.fill();
    ctx.restore();
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ── FEATURE: ZOOM & PAN ──────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════

  _onWheel(e) {
    // ── 3D zoom ─────────────────────────────────────────────────────────────
    if (this._mode === "view" && this._opts?.show3D) {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.12 : 0.89;
      this._3dZoom = Math.max(0.3, Math.min(5, (this._3dZoom||1) * factor));
      this._draw();
      return;
    }
    if (!this._opts?.zoomPan) return;
    e.preventDefault();
    const dpr     = window.devicePixelRatio || 1;
    const rect    = this._canvas.getBoundingClientRect();
    // Mouse in CSS pixels, relative to canvas center
    const mx      = (e.clientX - rect.left) - rect.width  / 2;
    const my      = (e.clientY - rect.top)  - rect.height / 2;
    const factor  = e.deltaY < 0 ? 1.12 : 0.89;
    const oldZoom = this._zoom || 1;
    const newZoom = Math.max(0.5, Math.min(8, oldZoom * factor));
    // _f2c uses panX/panY as CSS-pixel offset from center
    // Keep world point under cursor fixed: solve for new pan
    const px = this._panX || 0;
    const py = this._panY || 0;
    // world coord (invariant) = (mouse - pan) / oldZoom
    // after: newPan = mouse - world * newZoom
    this._panX = mx - (mx - px) * (newZoom / oldZoom);
    this._panY = my - (my - py) * (newZoom / oldZoom);
    this._zoom = newZoom;
    this._draw();
  }

  _onTouchStart(e) {
    const t0 = e.touches[0], t1 = e.touches[1];
    this._pinchDist  = Math.hypot(t0.clientX-t1.clientX, t0.clientY-t1.clientY);
    const rect = this._canvas.getBoundingClientRect();
    const mx = ((t0.clientX+t1.clientX)/2) - rect.left;
    const my = ((t0.clientY+t1.clientY)/2) - rect.top;
    if (this._mode === "view" && this._opts?.show3D) {
      // 3D: store for zoom + pan (midpoint) — orbit is single-finger
      this._pinchZoom3d = this._3dZoom || 1;
      this._pinch3dMidX = mx - rect.width  / 2;
      this._pinch3dMidY = my - rect.height / 2;
      this._pinch3dPanX = this._3dPanX || 0;
      this._pinch3dPanY = this._3dPanY || 0;
      this._3dDrag = null; // 2-finger does NOT orbit
    } else {
      // 2D: pinch zoom
      this._pinchZoom  = this._zoom || 1;
      this._pinchPanX  = this._panX || 0;
      this._pinchPanY  = this._panY || 0;
      this._pinchCx    = mx - rect.width  / 2;
      this._pinchCy    = my - rect.height / 2;
      // Store initial midpoint for pan tracking
      this._pinchMidX  = mx - rect.width  / 2;
      this._pinchMidY  = my - rect.height / 2;
    }
  }

  _onTouchMove(e) {
    if (this._pinchDist == null) return;
    const t0 = e.touches[0], t1 = e.touches[1];
    const dist = Math.hypot(t0.clientX-t1.clientX, t0.clientY-t1.clientY);
    const rect = this._canvas.getBoundingClientRect();
    const mx = ((t0.clientX+t1.clientX)/2) - rect.left;
    const my = ((t0.clientY+t1.clientY)/2) - rect.top;
    if (this._mode === "view" && this._opts?.show3D) {
      // 3D: pinch = zoom, midpoint movement = pan (no orbit with 2 fingers)
      this._3dZoom = Math.max(0.3, Math.min(5, (this._pinchZoom3d||1) * (dist / this._pinchDist)));
      // Pan: translate by midpoint delta
      const curMidX = mx - rect.width  / 2;
      const curMidY = my - rect.height / 2;
      this._3dPanX = (this._pinch3dPanX||0) + (curMidX - (this._pinch3dMidX||0));
      this._3dPanY = (this._pinch3dPanY||0) + (curMidY - (this._pinch3dMidY||0));
    } else {
      // 2D: pinch zoom + simultaneous pan from midpoint movement
      const newZoom = Math.max(0.5, Math.min(8, (this._pinchZoom||1) * (dist / this._pinchDist)));
      const cx = this._pinchCx, cy = this._pinchCy;
      const px = this._pinchPanX||0, py = this._pinchPanY||0;
      // Zoom around initial pinch center
      let nx = cx - (cx - px) * (newZoom / (this._pinchZoom||1));
      let ny = cy - (cy - py) * (newZoom / (this._pinchZoom||1));
      // Add translation from midpoint movement (pan)
      const curCx = mx - rect.width  / 2;
      const curCy = my - rect.height / 2;
      nx += curCx - cx;
      ny += curCy - cy;
      this._panX = nx;
      this._panY = ny;
      this._zoom = newZoom;
    }
    this._draw();
  }

  _onTouchEnd(e) {
    this._pinchDist = null;
    this._3dDrag    = null;
  }

  // Override _f2c to respect zoom/pan
  _f2cZoomed(mx, my) {
    const base = this._f2cBase(mx, my);
    const z = this._zoom || 1;
    return {
      x: base.x * z + (this._panX || 0) * (1 - z) + (this._panX || 0),
      y: base.y * z + (this._panY || 0) * (1 - z) + (this._panY || 0),
    };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ── FEATURE: HEIZUNGSPLAN ────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════

  _drawHeatingOverlay() {
    if (!this._opts?.showHeating) return;
    if (!this._heatingRooms) return;
    const ctx   = this._ctx;
    const rooms = this._data?.rooms || [];

    rooms.forEach((room, ri) => {
      const hr = this._heatingRooms[ri];
      if (!hr) return;
      const c1 = this._f2c(room.x1, room.y1);
      const c2 = this._f2c(room.x2, room.y2);
      const cx = (c1.x+c2.x)/2, cy = (c1.y+c2.y)/2;
      const rw = c2.x-c1.x, rh = c2.y-c1.y;

      let ist    = hr.temp_entity    ? parseFloat(this._hass?.states?.[hr.temp_entity]?.state)    : null;
      let soll   = hr.target_entity  ? parseFloat(this._hass?.states?.[hr.target_entity]?.state)  : null;
      // Also check climate entity for both
      if (hr.thermostat_entity && this._hass?.states?.[hr.thermostat_entity]) {
        const cl = this._hass.states[hr.thermostat_entity];
        if (isNaN(ist))  ist  = parseFloat(cl.attributes?.current_temperature);
        if (isNaN(soll)) soll = parseFloat(cl.attributes?.temperature);
      }
      if (isNaN(ist) && isNaN(soll)) return;

      const diff   = !isNaN(ist) && !isNaN(soll) ? ist - soll : 0;
      const tooWarm = diff > 0.5;
      const tooCold = diff < -0.5;
      const heatingColor = tooCold ? "#60a5fa" : tooWarm ? "#f97316" : "#22c55e";
      const [rr,gg,bb] = heatingColor.replace("#","").match(/../g).map(h=>parseInt(h,16));

      // Subtle room tint
      ctx.save();
      ctx.fillStyle = `rgba(${rr},${gg},${bb},0.08)`;
      ctx.fillRect(c1.x, c1.y, rw, rh);
      ctx.restore();

      // Heating badge bottom-left of room
      const lines = [];
      if (!isNaN(ist))  lines.push(`IST:  ${ist.toFixed(1)}°`);
      if (!isNaN(soll)) lines.push(`SOLL: ${soll.toFixed(1)}°`);
      if (!isNaN(ist) && !isNaN(soll)) lines.push(`${diff > 0 ? "+" : ""}${diff.toFixed(1)}°`);

      const bw2 = 62, bh2 = lines.length * 11 + 6;
      const bx2 = c1.x + 4, by2 = c2.y - bh2 - 4;
      ctx.save();
      ctx.fillStyle = "rgba(7,9,13,0.82)";
      ctx.strokeStyle = heatingColor; ctx.lineWidth = 1;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(bx2, by2, bw2, bh2, 3);
      else ctx.rect(bx2, by2, bw2, bh2);
      ctx.fill(); ctx.stroke();
      ctx.font = "bold 7px 'JetBrains Mono',monospace";
      lines.forEach((line, li) => {
        ctx.fillStyle = li === lines.length-1 ? heatingColor : "rgba(255,255,255,0.7)";
        ctx.fillText(line, bx2+4, by2+11*(li+1));
      });
      ctx.restore();
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ── FEATURE: HEATMAP-OVERLAY ─────────────────────────════════════════════
  // ══════════════════════════════════════════════════════════════════════════

  _updateHeatmap() {
    if (!this._opts?.showHeatmap) return;
    const devices = this._data?.devices || [];
    const rooms   = this._data?.rooms   || [];
    const now     = Date.now();

    devices.forEach(dev => {
      const mx = dev.state?.mx ?? dev.mx;
      const my = dev.state?.my ?? dev.my;
      if (mx == null || my == null) return;
      // Find which room the device is in
      const room = rooms.find(r => mx>=r.x1&&mx<=r.x2&&my>=r.y1&&my<=r.y2);
      if (!room) return;
      const key = room.name || `${room.x1},${room.y1}`;
      if (!this._heatmapData[key]) this._heatmapData[key] = [];
      this._heatmapData[key].push({ ts: now, devId: dev.device_id });
      // Keep last hour
      const cutoff = now - 3600000;
      this._heatmapData[key] = this._heatmapData[key].filter(e => e.ts > cutoff);
    });
  }

  _drawHeatmapOverlay() {
    if (!this._opts?.showHeatmap) return;
    const ctx   = this._ctx;
    const rooms = this._data?.rooms || [];
    const now   = Date.now();
    const hour  = 3600000;

    rooms.forEach(room => {
      const key    = room.name || `${room.x1},${room.y1}`;
      const events = this._heatmapData[key] || [];
      // Count events weighted by recency
      let heat = 0;
      events.forEach(ev => {
        const age = (now - ev.ts) / hour; // 0=now, 1=1h ago
        heat += Math.max(0, 1 - age);
      });
      if (heat < 0.05) return;

      const intensity = Math.min(1, heat / 10);
      const c1 = this._f2c(room.x1, room.y1);
      const c2 = this._f2c(room.x2, room.y2);
      const cx = (c1.x+c2.x)/2, cy = (c1.y+c2.y)/2;
      const rw = c2.x-c1.x, rh = c2.y-c1.y;

      // Heatmap gradient
      const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(rw,rh)/2);
      const r   = Math.round(255 * intensity);
      const g   = Math.round(100 * (1-intensity));
      grd.addColorStop(0,   `rgba(${r},${g},0,${0.35*intensity})`);
      grd.addColorStop(0.7, `rgba(${r},${g},0,${0.15*intensity})`);
      grd.addColorStop(1,   `rgba(${r},${g},0,0)`);
      ctx.save();
      ctx.fillStyle = grd;
      ctx.fillRect(c1.x, c1.y, rw, rh);
      // Minutes label
      const mins = Math.round(events.reduce((s,ev)=>s+Math.max(0,1-(now-ev.ts)/hour),0)*6);
      if (mins > 0) {
        ctx.font="bold 8px 'JetBrains Mono',monospace";
        ctx.fillStyle=`rgba(255,${Math.round(100*(1-intensity))},0,0.9)`;
        ctx.textAlign="center";
        ctx.fillText(`${mins}min`, cx, c2.y - 6);
        ctx.textAlign="left";
      }
      ctx.restore();
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ── FEATURE: RAUM-TAP LICHT ──────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════

  async _handleRoomTap(mx, my) {
    if (!this._opts?.roomTapLight) return false;
    const rooms  = this._data?.rooms  || [];
    const lights = this._data?.lights || [];
    const room   = rooms.find(r => mx>=r.x1&&mx<=r.x2&&my>=r.y1&&my<=r.y2);
    if (!room) return false;

    // Find all lights in this room
    const roomLights = lights.filter(l => {
      if (!l.entity) return false;
      return l.mx>=room.x1&&l.mx<=room.x2&&l.my>=room.y1&&l.my<=room.y2;
    });
    if (!roomLights.length) return false;

    // Check if any are on
    const anyOn = roomLights.some(l => this._hass?.states?.[l.entity]?.state === "on");
    // Toggle all
    for (const light of roomLights) {
      try {
        await this._hass.callService("light", anyOn ? "turn_off" : "turn_on", {}, { entity_id: light.entity });
      } catch(e) {}
    }
    this._showToast(`${room.name}: Licht ${anyOn?"aus":"an"} (${roomLights.length} Lampe${roomLights.length>1?"n":""})`);
    return true;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ── FEATURE: PERSONEN-AVATAR ──────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════

  _avatarCache = {};  // entity_id → HTMLImageElement | null

  _loadAvatar(entityId) {
    if (!entityId || this._avatarCache[entityId] !== undefined) return;
    const person = this._hass?.states?.[entityId];
    const picUrl = person?.attributes?.entity_picture;
    if (!picUrl) { this._avatarCache[entityId] = null; return; }
    this._avatarCache[entityId] = "loading";
    const img = new Image();
    img.onload  = () => { this._avatarCache[entityId] = img; };
    img.onerror = () => { this._avatarCache[entityId] = null; };
    img.src = picUrl.startsWith("http") ? picUrl : `${window.location.origin}${picUrl}`;
  }

  _drawAvatar(ctx, x, y, r, entityId, fallbackLetter, color) {
    if (!this._opts?.personAvatar) {
      // Fallback: letter only
      ctx.font = `bold ${r}px 'JetBrains Mono',monospace`;
      ctx.fillStyle = color; ctx.textAlign = "center";
      ctx.fillText(fallbackLetter, x, y + r*0.35);
      ctx.textAlign = "left";
      return;
    }

    // Try to load avatar from linked person entity
    const personEntity = this._hass ? Object.keys(this._hass.states).find(eid =>
      eid.startsWith("person.") &&
      (this._hass.states[eid]?.attributes?.friendly_name?.toLowerCase().includes(fallbackLetter.toLowerCase()) ||
       this._hass.states[eid]?.attributes?.entity_id === entityId)
    ) : null;
    if (personEntity) this._loadAvatar(personEntity);

    const img = personEntity ? this._avatarCache[personEntity] : null;
    if (img && img !== "loading") {
      ctx.save();
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2); ctx.clip();
      ctx.drawImage(img, x-r, y-r, r*2, r*2);
      ctx.restore();
    } else {
      // Letter fallback
      ctx.font = `bold ${r}px 'JetBrains Mono',monospace`;
      ctx.fillStyle = color; ctx.textAlign = "center";
      ctx.fillText(fallbackLetter, x, y + r*0.35);
      ctx.textAlign = "left";
    }
  }



  // ══════════════════════════════════════════════════════════════════════════
  // ── MEHRGESCHOSS ─────────────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════

  _rebuildFloorSelector() {
    const sel = this.shadowRoot.getElementById("floorSel");
    if (!sel) return;
    sel.innerHTML = "";
    if (!this._floors?.length) { sel.style.display = "none"; return; }
    sel.style.display = "flex";

    const label = document.createElement("span");
    label.style.cssText = "font-size:8px;color:var(--muted);flex-shrink:0;padding:0 4px";
    label.textContent = "🏠";
    sel.appendChild(label);

    this._floors.forEach((fl, idx) => {
      const btn = document.createElement("button");
      btn.className = "floor-btn" + (idx === this._activeFloor ? " active" : "");
      btn.textContent = fl.name || `Etage ${idx+1}`;
      btn.addEventListener("click", () => this._switchFloor(idx));
      sel.appendChild(btn);
    });

    // Add floor button (in settings/rooms mode)
    if (this._mode === "rooms" || this._mode === "settings") {
      const addBtn = document.createElement("button");
      addBtn.className = "floor-btn";
      addBtn.style.cssText += ";border-color:var(--accent);color:var(--accent)";
      addBtn.textContent = "+ Etage";
      addBtn.addEventListener("click", () => this._addFloor());
      sel.appendChild(addBtn);
    }
  }

  async _switchFloor(idx) {
    if (idx === this._activeFloor || this._floorSwitching) return;
    this._floorSwitching = true;
    try {
      // Save current floor data back into floors array
      if (this._floors[this._activeFloor]) {
        const cur = this._floors[this._activeFloor];
        cur.floor_w    = this._data?.floor_w;
        cur.floor_h    = this._data?.floor_h;
        cur.rooms      = this._data?.rooms;
        cur.doors      = this._data?.doors;
        cur.windows    = this._data?.windows;
        cur.lights     = this._data?.lights;
        cur.image_path = this._data?.image_path;
        cur.grid_step  = this._data?.grid_step;
        cur.scanners   = this._data?.scanners;
      }
      // Switch
      await this._hass.callApi("POST",
        `ble_positioning/${this._entryId}/active_floor`,
        { floor_idx: idx });
      this._activeFloor = idx;
      // Reload data for new floor
      await this._loadData();
      this._rebuildFloorSelector();
      this._rebuildSidebar();
      this._showToast(`Etage: ${this._floors[idx]?.name || idx+1}`);
    } catch(e) {
      this._showToast("✗ Etage wechsel fehlgeschlagen");
    }
    this._floorSwitching = false;
  }

  async _addFloor() {
    const name = prompt("Name der neuen Etage:", `Etage ${(this._floors?.length||0)+1}`);
    if (!name) return;
    // Build new floor from current data as template
    const newFloor = {
      id:         "floor_" + Date.now(),
      name:       name,
      floor_w:    this._data?.floor_w || 10,
      floor_h:    this._data?.floor_h || 8,
      rooms:      [],
      doors:      [],
      windows:    [],
      lights:     [],
      scanners:   [],
      image_path: "",
      grid_step:  this._data?.grid_step || 1,
    };
    // Ensure current floor is saved
    if (!this._floors) this._floors = [];
    if (this._floors[this._activeFloor]) {
      const cur = this._floors[this._activeFloor];
      cur.rooms   = this._data?.rooms   || cur.rooms;
      cur.doors   = this._data?.doors   || cur.doors;
      cur.windows = this._data?.windows || cur.windows;
      cur.lights  = this._data?.lights  || cur.lights;
    } else {
      // First floor – convert current data to floor 0
      this._floors = [{
        id: "floor_0", name: "Erdgeschoss",
        floor_w: this._data?.floor_w, floor_h: this._data?.floor_h,
        rooms: this._data?.rooms, doors: this._data?.doors,
        windows: this._data?.windows, lights: this._data?.lights,
        scanners: this._data?.scanners, image_path: this._data?.image_path,
        grid_step: this._data?.grid_step,
      }];
    }
    this._floors.push(newFloor);
    await this._saveFloors(this._floors.length - 1);
    this._rebuildFloorSelector();
    this._showToast(`✓ Etage "${name}" angelegt`);
  }

  async _saveFloors(activeFloor) {
    try {
      await this._hass.callApi("POST",
        `ble_positioning/${this._entryId}/floors`,
        { floors: this._floors, active_floor: activeFloor ?? this._activeFloor });
      this._activeFloor = activeFloor ?? this._activeFloor;
      await this._loadData();
    } catch(e) {
      this._showToast("✗ Etagen speichern fehlgeschlagen");
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ── AUTOMATISIERUNGS-ASSISTENT ────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════

  _sidebarAutomate() {
    const wrap = document.createElement("div");
    wrap.style.cssText = "padding:8px;display:flex;flex-direction:column;gap:6px";

    const hdr = document.createElement("div");
    hdr.style.cssText = "font-size:10px;font-weight:700;color:#a855f7;letter-spacing:1px";
    hdr.textContent = "🤖 AUTOMATISIERUNGS-ASSISTENT";
    wrap.appendChild(hdr);

    const desc = document.createElement("div");
    desc.style.cssText = "font-size:8px;color:var(--muted);margin-bottom:4px";
    desc.textContent = "Erstelle HA-Automationen direkt aus dem Grundriss";
    wrap.appendChild(desc);

    // ── Wizard ─────────────────────────────────────────────────────────────
    const wiz = this._autoWizard;

    if (!wiz) {
      // Template buttons
      const templates = [
        { icon:"🚶", label:"Person betritt Raum",   trigger:"zone_enter" },
        { icon:"🚶", label:"Person verlässt Raum",  trigger:"zone_leave" },
        { icon:"⏰", label:"Zeit + Anwesenheit",    trigger:"time_zone"  },
        { icon:"💡", label:"Licht bei Betreten",    trigger:"auto_light" },
        { icon:"🌡", label:"Heizung nach Person",   trigger:"heat_zone"  },
        { icon:"🔒", label:"Abwesenheits-Check",    trigger:"absence"    },
      ];

      templates.forEach(tmpl => {
        const btn = document.createElement("button");
        btn.style.cssText = "width:100%;text-align:left;padding:6px 10px;background:var(--surf2);border:1px solid var(--border);color:var(--text);border-radius:6px;cursor:pointer;font-family:inherit;font-size:9px;display:flex;align-items:center;gap:8px";
        btn.innerHTML = `<span style="font-size:14px">${tmpl.icon}</span><div><div style="font-weight:700">${tmpl.label}</div></div>`;
        btn.addEventListener("click", () => {
          this._autoWizard = { step:1, trigger: tmpl.trigger, data:{} };
          this._rebuildSidebar();
        });
        wrap.appendChild(btn);
      });

    } else {
      // ── Step-by-step wizard ─────────────────────────────────────────────
      const stepBox = document.createElement("div");
      stepBox.style.cssText = "background:var(--surf2);border-radius:8px;padding:8px;border:1px solid #a855f7";

      const stepHdr = document.createElement("div");
      stepHdr.style.cssText = "font-size:9px;font-weight:700;color:#a855f7;margin-bottom:6px";

      if (wiz.step === 1) {
        stepHdr.textContent = "Schritt 1: Person / Gerät wählen";
        const devices = this._data?.devices || [];
        devices.forEach(dev => {
          const btn = this._autoWizBtn(dev.device_name || dev.device_id, wiz.data.device === dev.device_id);
          btn.addEventListener("click", () => {
            wiz.data.device = dev.device_id;
            wiz.data.device_name = dev.device_name || dev.device_id;
            wiz.step = 2;
            this._rebuildSidebar();
          });
          stepBox.appendChild(btn);
        });
        if (!devices.length) {
          const hint = document.createElement("div");
          hint.style.cssText = "font-size:8px;color:var(--muted)";
          hint.textContent = "Keine Geräte gefunden. Zuerst im LIVE-Tab Geräte hinzufügen.";
          stepBox.appendChild(hint);
        }

      } else if (wiz.step === 2) {
        stepHdr.textContent = "Schritt 2: Raum wählen";
        const rooms = this._data?.rooms || [];
        rooms.forEach(room => {
          const btn = this._autoWizBtn(`▭ ${room.name}`, wiz.data.room === room.name);
          btn.addEventListener("click", () => {
            wiz.data.room = room.name;
            wiz.step = 3;
            this._rebuildSidebar();
          });
          stepBox.appendChild(btn);
        });

      } else if (wiz.step === 3) {
        stepHdr.textContent = "Schritt 3: Aktion wählen";
        const actions = [
          { id:"light_on",    label:"💡 Licht einschalten" },
          { id:"light_off",   label:"💡 Licht ausschalten" },
          { id:"notify",      label:"🔔 Benachrichtigung senden" },
          { id:"scene",       label:"🎨 Szene aktivieren" },
          { id:"script",      label:"📜 Skript ausführen" },
          { id:"media",       label:"🎵 Musik abspielen" },
          { id:"climate",     label:"🌡 Heizung anpassen" },
          { id:"custom",      label:"⚡ Eigener Service-Call" },
        ];
        actions.forEach(a => {
          const btn = this._autoWizBtn(a.label, wiz.data.action === a.id);
          btn.addEventListener("click", () => {
            wiz.data.action = a.id;
            wiz.step = 4;
            this._rebuildSidebar();
          });
          stepBox.appendChild(btn);
        });

      } else if (wiz.step === 4) {
        stepHdr.textContent = "Schritt 4: Details & Erstellen";

        // Action detail input
        const detailRow = document.createElement("div");
        detailRow.style.cssText = "margin-bottom:6px";

        const actionLabels = { light_on:"Licht Entity", light_off:"Licht Entity", notify:"Nachricht", scene:"Szene Entity", script:"Skript Entity", media:"Media Entity", climate:"Climate Entity", custom:"Service (domain.action)" };
        const detLbl = document.createElement("div"); detLbl.style.cssText="font-size:7px;color:var(--muted);margin-bottom:2px"; detLbl.textContent=actionLabels[wiz.data.action]||"Detail";
        const detInp = document.createElement("input");
        detInp.value = wiz.data.action_detail || "";
        detInp.placeholder = "entity_id oder Text";
        detInp.style.cssText = "width:100%;background:var(--surf3);border:1px solid var(--border);color:var(--text);border-radius:4px;font-size:9px;padding:4px 6px;box-sizing:border-box";
        detInp.addEventListener("input", () => { wiz.data.action_detail = detInp.value.trim(); });
        detailRow.append(detLbl, detInp);
        stepBox.appendChild(detailRow);

        // Automation name
        const nameRow = document.createElement("div");
        nameRow.style.cssText = "margin-bottom:8px";
        const nameLbl = document.createElement("div"); nameLbl.style.cssText="font-size:7px;color:var(--muted);margin-bottom:2px"; nameLbl.textContent="Automations-Name";
        const nameInp = document.createElement("input");
        nameInp.value = wiz.data.auto_name || `BLE: ${wiz.data.device_name} → ${wiz.data.room}`;
        nameInp.style.cssText = "width:100%;background:var(--surf3);border:1px solid var(--border);color:var(--text);border-radius:4px;font-size:9px;padding:4px 6px;box-sizing:border-box";
        nameInp.addEventListener("input", () => { wiz.data.auto_name = nameInp.value; });
        nameRow.append(nameLbl, nameInp);
        stepBox.appendChild(nameRow);

        // Preview YAML
        const yaml = this._generateAutomationYAML(wiz);
        const pre = document.createElement("pre");
        pre.style.cssText = "background:rgba(0,0,0,0.4);border-radius:4px;padding:6px;font-size:7px;color:#a5f3fc;overflow-x:auto;white-space:pre-wrap;margin-bottom:8px;max-height:120px;overflow-y:auto";
        pre.textContent = yaml;
        stepBox.appendChild(pre);

        // Create button
        const createBtn = document.createElement("button");
        createBtn.className = "btn";
        createBtn.style.cssText = "width:100%;background:#a855f7;color:#fff;border:none;padding:8px;font-size:10px;font-weight:700;border-radius:6px;cursor:pointer";
        createBtn.textContent = "🤖 Automation in HA erstellen";
        createBtn.addEventListener("click", () => this._createAutomation(wiz));
        stepBox.appendChild(createBtn);
      }

      // Back + summary
      const navRow = document.createElement("div");
      navRow.style.cssText = "display:flex;gap:4px;margin-bottom:6px";
      const backBtn = document.createElement("button");
      backBtn.style.cssText = "flex:1;padding:4px;background:var(--surf3);border:1px solid var(--border);color:var(--muted);border-radius:4px;cursor:pointer;font-size:8px;font-family:inherit";
      backBtn.textContent = "← Zurück";
      backBtn.addEventListener("click", () => {
        if (wiz.step <= 1) this._autoWizard = null;
        else wiz.step--;
        this._rebuildSidebar();
      });
      const cancelBtn = document.createElement("button");
      cancelBtn.style.cssText = "flex:1;padding:4px;background:var(--surf3);border:1px solid var(--border);color:#ef4444;border-radius:4px;cursor:pointer;font-size:8px;font-family:inherit";
      cancelBtn.textContent = "✕ Abbrechen";
      cancelBtn.addEventListener("click", () => { this._autoWizard = null; this._rebuildSidebar(); });
      navRow.append(backBtn, cancelBtn);

      // Summary chips
      const sumRow = document.createElement("div");
      sumRow.style.cssText = "display:flex;flex-wrap:wrap;gap:3px;margin-bottom:6px";
      [
        wiz.data.device_name && `👤 ${wiz.data.device_name}`,
        wiz.data.room        && `▭ ${wiz.data.room}`,
        wiz.data.action      && `⚡ ${wiz.data.action}`,
      ].filter(Boolean).forEach(txt => {
        const chip = document.createElement("span");
        chip.style.cssText = "background:#a855f722;border:1px solid #a855f7;border-radius:10px;padding:1px 6px;font-size:7px;color:#a855f7";
        chip.textContent = txt;
        sumRow.appendChild(chip);
      });

      stepBox.insertBefore(stepHdr, stepBox.firstChild);
      wrap.appendChild(navRow);
      wrap.appendChild(sumRow);
      wrap.appendChild(stepBox);
    }

    // ── Created automations list ────────────────────────────────────────────
    if (this._automations?.length) {
      const listHdr = document.createElement("div");
      listHdr.style.cssText = "font-size:8px;font-weight:700;color:var(--muted);margin-top:8px";
      listHdr.textContent = "ERSTELLTE AUTOMATIONEN";
      wrap.appendChild(listHdr);

      this._automations.forEach((auto, ai) => {
        const row = document.createElement("div");
        row.style.cssText = "background:var(--surf2);border-radius:5px;padding:5px 8px;border:1px solid var(--border);display:flex;align-items:center;gap:6px";
        const lbl = document.createElement("span"); lbl.style.cssText="flex:1;font-size:8px;color:var(--text)"; lbl.textContent=auto.name;
        const badge = document.createElement("span"); badge.style.cssText="font-size:7px;color:#22c55e;background:rgba(34,197,94,0.1);border:1px solid #22c55e;border-radius:8px;padding:1px 5px"; badge.textContent="✓ erstellt";
        row.append(lbl, badge);
        wrap.appendChild(row);
      });
    }

    return wrap;
  }

  _autoWizBtn(label, selected) {
    const btn = document.createElement("button");
    btn.style.cssText = `width:100%;text-align:left;padding:5px 8px;margin-bottom:3px;background:${selected?"rgba(168,85,247,0.15)":"var(--surf3)"};border:1px solid ${selected?"#a855f7":"var(--border)"};color:${selected?"#a855f7":"var(--text)"};border-radius:5px;cursor:pointer;font-family:inherit;font-size:8px;font-weight:${selected?"700":"400"}`;
    btn.textContent = label;
    return btn;
  }

  _generateAutomationYAML(wiz) {
    const d = wiz.data;
    const name = d.auto_name || `BLE: ${d.device_name} → ${d.room}`;

    let trigger = "";
    let condition = "";
    let action = "";

    // Trigger based on type
    if (wiz.trigger === "zone_enter" || wiz.trigger === "auto_light" || wiz.trigger === "heat_zone") {
      trigger = `trigger:\n  - platform: state\n    entity_id: sensor.ble_position_${(d.device||"device").replace(/[-:]/g,"_")}\n    to: "${d.room}"`;
      condition = `condition:\n  - condition: state\n    entity_id: sensor.ble_position_${(d.device||"").replace(/[-:]/g,"_")}\n    state: "${d.room}"`;
    } else if (wiz.trigger === "zone_leave") {
      trigger = `trigger:\n  - platform: state\n    entity_id: sensor.ble_position_${(d.device||"").replace(/[-:]/g,"_")}\n    from: "${d.room}"`;
    } else if (wiz.trigger === "time_zone") {
      trigger = `trigger:\n  - platform: time\n    at: "07:00:00"\n  - platform: state\n    entity_id: sensor.ble_position_${(d.device||"").replace(/[-:]/g,"_")}\n    to: "${d.room}"`;
      condition = `condition:\n  - condition: and\n    conditions:\n      - condition: state\n        entity_id: sensor.ble_position_${(d.device||"").replace(/[-:]/g,"_")}\n        state: "${d.room}"\n      - condition: time\n        after: "06:00:00"\n        before: "22:00:00"`;
    } else if (wiz.trigger === "absence") {
      trigger = `trigger:\n  - platform: state\n    entity_id: sensor.ble_position_${(d.device||"").replace(/[-:]/g,"_")}\n    for:\n      minutes: 30`;
      condition = `condition:\n  - condition: not\n    conditions:\n      - condition: state\n        entity_id: sensor.ble_position_${(d.device||"").replace(/[-:]/g,"_")}\n        state: "${d.room}"`;
    }

    // Action based on type
    if (d.action === "light_on")  action = `action:\n  - service: light.turn_on\n    entity_id: ${d.action_detail||"light.ENTITY"}`;
    else if (d.action === "light_off") action = `action:\n  - service: light.turn_off\n    entity_id: ${d.action_detail||"light.ENTITY"}`;
    else if (d.action === "notify") action = `action:\n  - service: notify.notify\n    data:\n      message: "${d.action_detail||"Benachrichtigung"}"`;
    else if (d.action === "scene")  action = `action:\n  - service: scene.turn_on\n    entity_id: ${d.action_detail||"scene.ENTITY"}`;
    else if (d.action === "script") action = `action:\n  - service: script.turn_on\n    entity_id: ${d.action_detail||"script.ENTITY"}`;
    else if (d.action === "climate") action = `action:\n  - service: climate.set_temperature\n    entity_id: ${d.action_detail||"climate.ENTITY"}\n    data:\n      temperature: 21`;
    else if (d.action === "media") action = `action:\n  - service: media_player.play_media\n    entity_id: ${d.action_detail||"media_player.ENTITY"}\n    data:\n      media_content_type: music`;
    else action = `action:\n  - service: ${d.action_detail||"domain.action"}`;

    return `alias: "${name}"\nmode: single\n\n${trigger}\n\n${condition ? condition+"\n\n" : ""}${action}`;
  }

  async _createAutomation(wiz) {
    const d     = wiz.data;
    const name  = d.auto_name || `BLE: ${d.device_name} → ${d.room}`;
    const yaml  = this._generateAutomationYAML(wiz);

    try {
      // Create automation via HA REST API
      await this._hass.callApi("POST", "config/automation/config/" + encodeURIComponent(name.toLowerCase().replace(/\s+/g,"_")), {
        alias:     name,
        mode:      "single",
        trigger:   this._parseAutoTrigger(wiz),
        condition: this._parseAutoCondition(wiz),
        action:    this._parseAutoAction(wiz),
      });
      if (!this._automations) this._automations = [];
      this._automations.push({ name, ts: Date.now() });
      this._autoWizard = null;
      this._showToast(`✓ Automation "${name}" erstellt!`);
    } catch(e) {
      // Fallback: show YAML for manual copy
      this._showToast("YAML in Sidebar kopierbereit (API nicht verfügbar)");
    }
    this._rebuildSidebar();
  }

  _parseAutoTrigger(wiz) {
    const d = wiz.data;
    const entityId = `sensor.ble_position_${(d.device||"").replace(/[-:]/g,"_")}`;
    if (wiz.trigger === "zone_enter" || wiz.trigger === "auto_light" || wiz.trigger === "heat_zone") {
      return [{ platform:"state", entity_id: entityId, to: d.room }];
    } else if (wiz.trigger === "zone_leave") {
      return [{ platform:"state", entity_id: entityId, from: d.room }];
    } else if (wiz.trigger === "time_zone") {
      return [{ platform:"time", at:"07:00:00" }, { platform:"state", entity_id: entityId, to: d.room }];
    } else if (wiz.trigger === "absence") {
      return [{ platform:"state", entity_id: entityId, for:{ minutes:30 } }];
    }
    return [];
  }

  _parseAutoCondition(wiz) {
    const d = wiz.data;
    const entityId = `sensor.ble_position_${(d.device||"").replace(/[-:]/g,"_")}`;
    if (["zone_enter","auto_light","heat_zone","time_zone"].includes(wiz.trigger)) {
      return [{ condition:"state", entity_id: entityId, state: d.room }];
    }
    return [];
  }

  _parseAutoAction(wiz) {
    const d = wiz.data;
    if (d.action === "light_on")   return [{ service:"light.turn_on",   entity_id: d.action_detail }];
    if (d.action === "light_off")  return [{ service:"light.turn_off",  entity_id: d.action_detail }];
    if (d.action === "notify")     return [{ service:"notify.notify",   data:{ message: d.action_detail||"" } }];
    if (d.action === "scene")      return [{ service:"scene.turn_on",   entity_id: d.action_detail }];
    if (d.action === "script")     return [{ service:"script.turn_on",  entity_id: d.action_detail }];
    if (d.action === "climate")    return [{ service:"climate.set_temperature", entity_id: d.action_detail, data:{ temperature:21 } }];
    if (d.action === "custom")     return [{ service: d.action_detail||"domain.action" }];
    return [];
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ── 3D ISOMETRISCHE ANSICHT ───────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════

  _draw3D() {
    // stub – actual render in _draw3DScene called from _draw
  }


  // ── mmWave Personen im 3D-Modus ─────────────────────────────────────────
  _drawMmwave3D(ctx, project, unitPx, wallH) {
    const sensors = (this._pendingMmwave?.length > 0 ? this._pendingMmwave : this._data?.mmwave_sensors) || [];
    if (!sensors.length) return;
    const t = Date.now() / 1000;

    sensors.forEach(sensor => {
      if (sensor.mx == null || sensor.my == null) return;

      // ── FOV-Kegel (flach auf Boden) ──────────────────────────────────────
      if (sensor.show_fov !== false) {
        const fovAngle = (sensor.fov_angle || 120) * Math.PI / 180;
        const rot      = (sensor.rotation  || 0)   * Math.PI / 180;
        const rangeM   = sensor.fov_range  || 6;
        const col      = sensor.color || "#ff6b35";
        const baseAngle = rot - Math.PI / 2;
        const steps = 20;
        // Polygon auf Boden-Ebene (z=0)
        ctx.save();
        ctx.globalAlpha = 0.13;
        ctx.fillStyle = col;
        ctx.beginPath();
        const sc3 = project(sensor.mx, sensor.my, 0);
        ctx.moveTo(sc3.x, sc3.y);
        for (let i = 0; i <= steps; i++) {
          const a = baseAngle - fovAngle/2 + (fovAngle * i / steps);
          const px3 = sensor.mx + Math.cos(a) * rangeM;
          const py3 = sensor.my + Math.sin(a) * rangeM;
          const pp3 = project(px3, py3, 0);
          ctx.lineTo(pp3.x, pp3.y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 0.35;
        ctx.strokeStyle = col;
        ctx.lineWidth = 0.8;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }

      // ── Sensor-Dot ───────────────────────────────────────────────────────
      const sc3 = project(sensor.mx, sensor.my, 0.05);
      const scol = sensor.color || "#ff6b35";
      const pulse3 = 0.6 + 0.4 * Math.sin(t * 2.5);
      ctx.save();
      ctx.fillStyle = scol + "55";
      ctx.beginPath(); ctx.arc(sc3.x, sc3.y, 8 * pulse3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = scol;
      ctx.beginPath(); ctx.arc(sc3.x, sc3.y, 4, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "white"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(sc3.x, sc3.y, 4, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();

      // ── Targets / Personen ───────────────────────────────────────────────
      const numTargets = sensor.targets || 3;
      for (let ti = 1; ti <= numTargets; ti++) {
        const target = this._getMmwaveTarget(sensor, ti);
        if (!target || !target.present) continue;

        const fx = target.floor_mx, fy = target.floor_my;
        const tCol = ["#ff6b35","#00e5ff","#22c55e"][ti-1] || "#fff";
        const tName = (sensor.target_names || [])[ti-1] || ("P" + ti);

        // Klassifikation / Haltung
        const clsResult = this._mmwaveClassify ? this._mmwaveClassify(sensor, target) : { cls:"unknown", confidence:0 };
        const clsInfo   = this._mmwaveClasses  ? this._mmwaveClasses()[clsResult.cls] : null;
        const col3d     = (this._opts?.mmwaveClassify && clsResult?.cls !== "unknown")
          ? (clsInfo?.color || tCol) : tCol;
        const cls3d     = clsResult?.cls || "unknown";

        // ── Schatten auf Boden ────────────────────────────────────────────
        const shadowP = project(fx, fy, 0);
        ctx.save();
        ctx.fillStyle = "rgba(0,0,0,0.35)";
        ctx.beginPath();
        ctx.ellipse(shadowP.x, shadowP.y, 8 * unitPx/80, 3 * unitPx/80, 0, 0, Math.PI*2);
        ctx.fill();
        ctx.restore();

        // ── 3D Personen-Figur (isometrisch, haltungsabhängig) ────────────
        // Posture aus 2D-Overlay übernehmen (wird dort per _mmwaveDetectPosture gesetzt)
        // Falls 3D ohne 2D läuft: Posture hier direkt ermitteln
        if (!target._posture && this._mmwaveDetectPosture) {
          target._posture = this._mmwaveDetectPosture(sensor, target);
        }
        const posture3d = target._posture || "standing";
        const sc3d = unitPx / 80;
        const hR = Math.max(4, 5 * sc3d);

        ctx.save();
        // Glow-Aura (immer auf Bodenhöhe)
        const footP  = project(fx, fy, 0);
        const aura3 = ctx.createRadialGradient(footP.x, footP.y, 0, footP.x, footP.y, 18 * sc3d);
        aura3.addColorStop(0, col3d + "33"); aura3.addColorStop(1, col3d + "00");
        ctx.fillStyle = aura3;
        ctx.beginPath(); ctx.arc(footP.x, footP.y, 18 * sc3d, 0, Math.PI*2); ctx.fill();

        if (posture3d === "lying") {
          // ── Liegend: flacher Körper auf Boden-Ebene ──────────────────
          const bodyP1 = project(fx - 0.25, fy, 0.15);
          const bodyP2 = project(fx + 0.25, fy, 0.15);
          const headLP = project(fx - 0.35, fy, 0.15);
          ctx.strokeStyle = col3d; ctx.lineWidth = 6 * sc3d;
          ctx.lineCap = "round";
          ctx.beginPath(); ctx.moveTo(bodyP1.x, bodyP1.y); ctx.lineTo(bodyP2.x, bodyP2.y); ctx.stroke();
          ctx.fillStyle = col3d;
          ctx.beginPath(); ctx.arc(headLP.x, headLP.y, hR * 1.1, 0, Math.PI*2); ctx.fill();
          ctx.strokeStyle = "rgba(255,255,255,0.8)"; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.arc(headLP.x, headLP.y, hR * 1.1, 0, Math.PI*2); ctx.stroke();
          // 💤 Symbol
          const midP = project(fx, fy, 0.3);
          ctx.font = `${10 * sc3d}px serif`; ctx.fillStyle = col3d + "cc";
          ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.fillText("💤", midP.x, midP.y - 8 * sc3d);

        } else if (posture3d === "sitting") {
          // ── Sitzend: Beine abgewinkelt, Torso kürzer, Kopf tiefer ────
          const seatP  = project(fx, fy, 0.45);  // Sitzhöhe ~45cm
          const shouldP= project(fx, fy, 0.85);  // Schultern ~85cm
          const headP  = project(fx, fy, 1.15);  // Kopf ~1.15m (sitzend)
          const armW3  = 5 * sc3d;

          // Stuhlbein-Andeutung (kurze Linie)
          ctx.strokeStyle = col3d + "55"; ctx.lineWidth = 2 * sc3d;
          ctx.beginPath();
          ctx.moveTo(footP.x - 3, footP.y); ctx.lineTo(seatP.x - 3, seatP.y);
          ctx.moveTo(footP.x + 3, footP.y); ctx.lineTo(seatP.x + 3, seatP.y);
          ctx.stroke();

          // Torso (Sitz → Schultern)
          ctx.strokeStyle = col3d; ctx.lineWidth = 4 * sc3d;
          ctx.beginPath(); ctx.moveTo(seatP.x, seatP.y); ctx.lineTo(shouldP.x, shouldP.y); ctx.stroke();

          // Arme auf Knien (leicht nach vorne/unten)
          ctx.strokeStyle = col3d; ctx.lineWidth = 2 * sc3d;
          ctx.beginPath();
          const armMidP = project(fx, fy, 0.65);
          ctx.moveTo(armMidP.x - armW3, armMidP.y);
          ctx.lineTo(seatP.x - armW3 * 1.8, seatP.y + 3 * sc3d);
          ctx.moveTo(armMidP.x + armW3, armMidP.y);
          ctx.lineTo(seatP.x + armW3 * 1.8, seatP.y + 3 * sc3d);
          ctx.stroke();

          // Kopf
          ctx.fillStyle = col3d;
          ctx.beginPath(); ctx.arc(headP.x, headP.y, hR, 0, Math.PI*2); ctx.fill();
          ctx.strokeStyle = "rgba(255,255,255,0.9)"; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.arc(headP.x, headP.y, hR, 0, Math.PI*2); ctx.stroke();
          // Augen
          ctx.fillStyle = "rgba(0,0,0,0.7)";
          ctx.beginPath(); ctx.arc(headP.x - hR*0.3, headP.y - hR*0.1, 1.5*sc3d, 0, Math.PI*2); ctx.fill();
          ctx.beginPath(); ctx.arc(headP.x + hR*0.3, headP.y - hR*0.1, 1.5*sc3d, 0, Math.PI*2); ctx.fill();

        } else {
          // ── Stehend (Standard) ────────────────────────────────────────
          const hipP   = project(fx, fy, 0.55);
          const shouldP= project(fx, fy, 1.05);
          const headP  = project(fx, fy, 1.75);
          const armW   = 5 * sc3d;
          const armMid = project(fx, fy, 0.8);

          // Beine
          ctx.strokeStyle = col3d; ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(footP.x - 2, footP.y); ctx.lineTo(hipP.x - 2, hipP.y);
          ctx.moveTo(footP.x + 2, footP.y); ctx.lineTo(hipP.x + 2, hipP.y);
          ctx.stroke();

          // Torso
          ctx.strokeStyle = col3d; ctx.lineWidth = 4;
          ctx.beginPath(); ctx.moveTo(hipP.x, hipP.y); ctx.lineTo(shouldP.x, shouldP.y); ctx.stroke();

          // Arme
          ctx.strokeStyle = col3d; ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(armMid.x - armW, armMid.y - 2);
          ctx.lineTo(armMid.x - armW*2, armMid.y + (target.moving ? -3 : 2));
          ctx.moveTo(armMid.x + armW, armMid.y - 2);
          ctx.lineTo(armMid.x + armW*2, armMid.y + (target.moving ? 3 : 2));
          ctx.stroke();

          // Kopf
          ctx.fillStyle = col3d;
          ctx.beginPath(); ctx.arc(headP.x, headP.y, hR, 0, Math.PI*2); ctx.fill();
          ctx.strokeStyle = "rgba(255,255,255,0.9)"; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.arc(headP.x, headP.y, hR, 0, Math.PI*2); ctx.stroke();
          // Augen
          ctx.fillStyle = "rgba(0,0,0,0.7)";
          ctx.beginPath(); ctx.arc(headP.x - hR*0.3, headP.y - hR*0.1, 1.5*sc3d, 0, Math.PI*2); ctx.fill();
          ctx.beginPath(); ctx.arc(headP.x + hR*0.3, headP.y - hR*0.1, 1.5*sc3d, 0, Math.PI*2); ctx.fill();
        }

        // Label-Referenzpunkt je nach Haltung
        const labelRefP = posture3d === "lying"
          ? project(fx - 0.35, fy, 0.35)
          : posture3d === "sitting"
            ? project(fx, fy, 1.25)
            : project(fx, fy, 1.75);
        const headP = labelRefP; // für Name-Label unten

        // Bewegungspfeil
        if (target.moving && Math.abs(target.speed) > 0.05) {
          const ang3 = (target.angle || 0) * Math.PI/180 + (sensor.rotation||0)*Math.PI/180 - Math.PI/2;
          const spd3 = Math.min(Math.abs(target.speed) * 0.5, 1.5);
          const ap3  = project(fx + Math.cos(ang3)*spd3, fy + Math.sin(ang3)*spd3, 1.0);
          ctx.strokeStyle = col3d; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(shouldP.x, shouldP.y); ctx.lineTo(ap3.x, ap3.y); ctx.stroke();
          const ab3 = ang3 + Math.PI;
          ctx.fillStyle = col3d;
          ctx.beginPath();
          ctx.moveTo(ap3.x, ap3.y);
          ctx.lineTo(ap3.x + Math.cos(ab3+0.5)*5, ap3.y + Math.sin(ab3+0.5)*5);
          ctx.lineTo(ap3.x + Math.cos(ab3-0.5)*5, ap3.y + Math.sin(ab3-0.5)*5);
          ctx.closePath(); ctx.fill();
        }

        // ── Name-Label über dem Kopf ─────────────────────────────────────
        const displayName3d = (this._opts?.mmwaveClassify && clsResult.cls !== "unknown")
          ? (clsInfo?.icon || "") + " " + tName : tName;
        const targetRoom3d = this._getRoomForPoint ? this._getRoomForPoint(fx, fy) : null;
        const roomLabel3d  = targetRoom3d?.name || "";
        const labelY3d = headP.y - hR - 4;
        ctx.font = "bold 9px 'JetBrains Mono',monospace";
        const nlw = ctx.measureText(displayName3d).width + 10;
        ctx.fillStyle = "rgba(0,0,0,0.75)";
        ctx.beginPath(); ctx.roundRect(headP.x - nlw/2, labelY3d - 13, nlw, 13, 3); ctx.fill();
        ctx.strokeStyle = col3d + "88"; ctx.lineWidth = 1; ctx.stroke();
        ctx.fillStyle = col3d;
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(displayName3d, headP.x, labelY3d - 6.5);

        if (roomLabel3d) {
          ctx.font = "8px 'JetBrains Mono',monospace";
          const rlw = ctx.measureText(roomLabel3d).width + 8;
          ctx.fillStyle = "rgba(0,0,0,0.6)";
          ctx.beginPath(); ctx.roundRect(headP.x - rlw/2, labelY3d - 27, rlw, 12, 3); ctx.fill();
          ctx.fillStyle = col3d + "cc";
          ctx.fillText(roomLabel3d, headP.x, labelY3d - 21);
        }
        ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
        ctx.restore();
      }
    });
  }

  // ── Textur-Lader: lädt alle konfigurierten Texturen als HTMLImage ─────
  _loadTextures() {
    const optKeys = { floor:"texFloor", wall_outer:"texWallOuter", wall_inner:"texWallInner", door:"texDoor" };
    Object.entries(optKeys).forEach(([k, optK]) => {
      const src = this._opts?.[optK];
      if (!src) { this._textures[k] = null; this._textureSrc[k] = null; return; }
      if (this._textureSrc[k] === src) return; // already loaded
      this._textureSrc[k] = src;
      const img = new Image();
      img.onload = () => { this._textures[k] = img; this._draw(); };
      img.onerror = () => { this._textures[k] = null; };
      img.src = src;
    });
  }

  // Erstellt ctx.createPattern mit Skalierung – gibt null zurück wenn nicht verfügbar
  _texPattern(ctx, key, pixelsPerMeter = 40) {
    const img = this._textures?.[key];
    if (!img || !img.complete || !img.naturalWidth) return null;
    const oc = document.createElement("canvas");
    // Textur so skalieren dass 1 Meter = pixelsPerMeter Pixel
    const scale = pixelsPerMeter / 100; // 100px ≙ 1m Annahme
    oc.width  = Math.max(4, Math.round(img.naturalWidth  * scale));
    oc.height = Math.max(4, Math.round(img.naturalHeight * scale));
    const octx = oc.getContext("2d");
    octx.drawImage(img, 0, 0, oc.width, oc.height);
    try { return ctx.createPattern(oc, "repeat"); }
    catch(e) { return null; }
  }

  _draw3DScene(ctx, rooms, doors, windows, lights, devices) {
    if (!ctx || !rooms) return;
    // Texturen laden/aktualisieren
    this._loadTextures();
    const dpr = window.devicePixelRatio || 1;
    const cw  = this._canvas.width  / dpr;
    const ch  = this._canvas.height / dpr;
    const fw  = this._data?.floor_w || 10;
    const fh  = this._data?.floor_h || 10;
    const wallH = Math.max(0.5, Math.min(6, this._wallHeight ?? 2.5));
    const zoom  = this._3dZoom ?? 1.0;

    // ── Perspective projection ───────────────────────────────────────────────
    // azimuth: rotation around Z axis (horizontal spin)
    // elevation: tilt from horizontal (0=flat, 90=top-down)
    const az  = ((this._3dAzimuth  ?? 45) * Math.PI) / 180;
    const el  = ((this._3dElevation ?? 30) * Math.PI) / 180;

    // World center: middle of floor plan
    const wcx = fw / 2, wcy = fh / 2;

    // Unit scale: fit floor into canvas – auf Hochformat (Portrait) mehr Breite nutzen
    const diag   = Math.sqrt(fw*fw + fh*fh);
    const isPortrait = ch > cw * 1.2;
    const fitBase = isPortrait ? (cw * 0.92 * zoom) : (Math.min(cw, ch) * 0.82 * zoom);
    const unitPx = fitBase / diag;

    // Project 3D floor-space point (x, y, z) → canvas (px, py)
    const project = (x, y, z) => {
      // Center the floor plan
      const lx = x - wcx, ly = y - wcy;
      // Rotate around vertical (azimuth)
      const rx =  lx * Math.cos(az) + ly * Math.sin(az);
      const ry = -lx * Math.sin(az) + ly * Math.cos(az);
      // Apply elevation tilt
      const rz = z;
      const sx  = rx * unitPx;
      const sy  = (ry * Math.cos(el) - rz * Math.sin(el)) * unitPx;
      const ox = this._3dPanX || 0;
      const oy = this._3dPanY || 0;
      return { x: cw / 2 + sx + ox, y: ch * 0.55 + sy + oy };
    };

    // ── Color helpers ────────────────────────────────────────────────────────
    const hexRgb = hex => {
      const h = (hex||"334155").replace("#","").padEnd(6,"0");
      return [parseInt(h.slice(0,2),16)||51, parseInt(h.slice(2,4),16)||65, parseInt(h.slice(4,6),16)||85];
    };
    // Wall color: use global override or fall back to room color
    const wallOverride = this._3dWallColor || null;
    const wallAlpha    = this._3dWallAlpha ?? 0.75;
    const roomColor = (room) => wallOverride ? hexRgb(wallOverride) : hexRgb(room.color);

    // ── Background ──────────────────────────────────────────────────────────
    ctx.fillStyle = "#07090d";
    ctx.fillRect(0, 0, cw, ch);

    // Floor grid (subtle)
    ctx.strokeStyle = "rgba(255,255,255,0.04)";
    ctx.lineWidth   = 0.5;
    for (let x = 0; x <= fw; x++) {
      const a = project(x, 0, 0), b = project(x, fh, 0);
      ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke();
    }
    for (let y = 0; y <= fh; y++) {
      const a = project(0, y, 0), b = project(fw, y, 0);
      ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke();
    }

    // ── Floor Overlay (other floors ghost) ─────────────────────────────────
    this._drawFloorOverlay3D(ctx, project, unitPx);

    // ── Shadow simulation ────────────────────────────────────────────────────
    this._drawShadows3D(ctx, rooms, project, unitPx);

    // ── Painter's sort: depth = average of all 4 floor corners ──────────────
    const roomDepth = r => {
      const pts = [[r.x1,r.y1],[r.x2,r.y1],[r.x2,r.y2],[r.x1,r.y2]];
      const sum = pts.reduce((s,[x,y]) => {
        const lx=x-wcx, ly=y-wcy;
        return s + (-lx*Math.sin(az)+ly*Math.cos(az));
      }, 0);
      return sum / 4;
    };
    const sortedRooms = [...rooms].sort((a,b) => roomDepth(b) - roomDepth(a));

    // ── Draw rooms ───────────────────────────────────────────────────────────
    sortedRooms.forEach(room => {
      const {x1,y1,x2,y2,color,name} = room;
      const isOutdoor3D = room.zone_type === "outdoor";

      // ── Outdoor zone: flat green area, no walls ──────────────────────────
      if (isOutdoor3D) {
        const corners3D = [[x1,y1],[x2,y1],[x2,y2],[x1,y2]];
        const fp = corners3D.map(([x,y]) => project(x, y, 0));
        // Soft green fill
        ctx.fillStyle = "rgba(34,197,94,0.13)";
        ctx.beginPath();
        fp.forEach((p,i) => i ? ctx.lineTo(p.x,p.y) : ctx.moveTo(p.x,p.y));
        ctx.closePath(); ctx.fill();
        // Dashed green border
        ctx.save();
        ctx.strokeStyle = "rgba(34,197,94,0.5)";
        ctx.lineWidth = 1.0;
        ctx.setLineDash([5,4]);
        ctx.beginPath();
        fp.forEach((p,i) => i ? ctx.lineTo(p.x,p.y) : ctx.moveTo(p.x,p.y));
        ctx.closePath(); ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
        // Animated grass dots
        const seed3 = (x1*1000+y1*137)|0;
        const t3 = (Date.now()/3000) % 1;
        ctx.fillStyle = "rgba(74,222,128,0.25)";
        for (let gi=0; gi<12; gi++) {
          const gfx = x1 + 0.3 + ((seed3*(gi+3)*2654435761)%(Math.max(0.1,(x2-x1-0.6))*100))/100;
          const gfy = y1 + 0.3 + ((seed3*(gi+7)*2246822519)%(Math.max(0.1,(y2-y1-0.6))*100))/100;
          const gp = project(gfx, gfy, 0.02 + 0.02*Math.sin(t3*Math.PI*2+gi));
          ctx.beginPath(); ctx.arc(gp.x, gp.y, 1.5, 0, Math.PI*2); ctx.fill();
        }
        // Label
        const mc = project((x1+x2)/2, (y1+y2)/2, 0.05);
        ctx.font = "bold 9px 'JetBrains Mono',monospace";
        ctx.fillStyle = "#4ade80";
        ctx.textAlign = "center";
        ctx.fillText("🌿 " + name, mc.x, mc.y);
        ctx.textAlign = "left";
        return; // no walls
      }

      const [rr,gg,bb] = roomColor(room);
      const h = wallH;

      // 4 floor corners, 4 ceiling corners
      const corners = [[x1,y1],[x2,y1],[x2,y2],[x1,y2]];
      const f = corners.map(([x,y]) => project(x, y, 0));
      const t = corners.map(([x,y]) => project(x, y, h));

      const face = (pts, r, g, b, a) => {
        ctx.fillStyle = `rgba(${r},${g},${b},${a})`;
        ctx.beginPath(); pts.forEach((p,i) => i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));
        ctx.closePath(); ctx.fill();
      };
      const stroke = (pts, r, g, b, a, lw=0.8) => {
        ctx.strokeStyle = `rgba(${r},${g},${b},${a})`; ctx.lineWidth = lw;
        ctx.beginPath(); pts.forEach((p,i) => i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));
        ctx.closePath(); ctx.stroke();
      };

      // Floor – mit Textur falls konfiguriert
      const floorPat = this._texPattern(ctx, "floor", unitPx * 0.5);
      if (floorPat) {
        ctx.save();
        ctx.fillStyle = floorPat;
        ctx.globalAlpha = 0.82;
        ctx.beginPath();
        f.forEach((p,i) => i ? ctx.lineTo(p.x,p.y) : ctx.moveTo(p.x,p.y));
        ctx.closePath(); ctx.fill();
        // Leichter Raumfarb-Tint drüber
        ctx.fillStyle = `rgba(${rr},${gg},${bb},0.18)`;
        ctx.beginPath();
        f.forEach((p,i) => i ? ctx.lineTo(p.x,p.y) : ctx.moveTo(p.x,p.y));
        ctx.closePath(); ctx.fill();
        ctx.restore();
      } else {
        face(f, rr,gg,bb, wallAlpha * 0.24);
      }

      // Determine which walls face "toward viewer" based on azimuth
      // Wall 0: y1 edge (f[0]→f[1]), Wall 1: x2 edge (f[1]→f[2])
      // Wall 2: y2 edge (f[2]→f[3]), Wall 3: x1 edge (f[3]→f[0])
      const wallDefs = [
        { bi: [0,1], ti: [0,1], nx: 0, ny:-1 },  // front (y1)
        { bi: [1,2], ti: [1,2], nx: 1, ny: 0 },  // right (x2)
        { bi: [2,3], ti: [2,3], nx: 0, ny: 1 },  // back  (y2)
        { bi: [3,0], ti: [3,0], nx:-1, ny: 0 },  // left  (x1)
      ];
      wallDefs.forEach(w => {
        // dot product of wall normal with view direction
        const vx = Math.cos(az), vy = Math.sin(az);
        const dot = w.nx * vx + w.ny * vy;
        if (dot >= -0.05) { // facing viewer (or edge-on)
          const brightness = 0.5 + 0.3 * dot;
          const [wr,wg,wb] = [Math.round(rr*brightness), Math.round(gg*brightness), Math.round(bb*brightness)];
          const wallPts = [f[w.bi[0]], f[w.bi[1]], t[w.ti[1]], t[w.ti[0]]];

          // Außenwand erkennen: kein Nachbar-Raum auf Normalenseite
          const wallMidX = ((w.nx === 0)
            ? (x1+x2)/2
            : (w.nx > 0 ? x2 : x1)) + w.nx * 0.05;
          const wallMidY = ((w.ny === 0)
            ? (y1+y2)/2
            : (w.ny > 0 ? y2 : y1)) + w.ny * 0.05;
          const isOuterWall = !rooms.some(rr2 =>
            rr2 !== room &&
            wallMidX >= rr2.x1 - 0.1 && wallMidX <= rr2.x2 + 0.1 &&
            wallMidY >= rr2.y1 - 0.1 && wallMidY <= rr2.y2 + 0.1
          );

          const texKey = isOuterWall ? "wall_outer" : "wall_inner";
          const wallPat = this._texPattern(ctx, texKey, unitPx * 0.4);

          if (wallPat) {
            ctx.save();
            ctx.fillStyle = wallPat;
            ctx.globalAlpha = brightness * 0.85;
            ctx.beginPath();
            wallPts.forEach((p,i) => i ? ctx.lineTo(p.x,p.y) : ctx.moveTo(p.x,p.y));
            ctx.closePath(); ctx.fill();
            // Raumfarb-Tint
            ctx.fillStyle = `rgba(${wr},${wg},${wb},0.22)`;
            ctx.beginPath();
            wallPts.forEach((p,i) => i ? ctx.lineTo(p.x,p.y) : ctx.moveTo(p.x,p.y));
            ctx.closePath(); ctx.fill();
            ctx.restore();
          } else {
            face(wallPts, wr,wg,wb, wallAlpha);
          }
          stroke(wallPts, rr,gg,bb, 0.4);
        }
      });

      // Ceiling
      face(t, rr,gg,bb, wallAlpha * 0.08);
      stroke(t, rr,gg,bb, 0.3);

      // Vertical edges
      ctx.strokeStyle = `rgba(${rr},${gg},${bb},0.4)`; ctx.lineWidth = 0.8;
      [0,1,2,3].forEach(i => {
        ctx.beginPath(); ctx.moveTo(f[i].x,f[i].y); ctx.lineTo(t[i].x,t[i].y); ctx.stroke();
      });

      // Room label
      const fc = project((x1+x2)/2,(y1+y2)/2,0);
      const fs = Math.max(7, Math.min(12, ((x2-x1)+(y2-y1)) * unitPx * 0.06));
      ctx.save();
      ctx.font = `bold ${fs}px 'JetBrains Mono',monospace`;
      ctx.fillStyle = `rgba(${rr},${gg},${bb},0.95)`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(name||"", fc.x, fc.y);
      ctx.restore();
    });

    // ── Doors 3D ─────────────────────────────────────────────────────────────
    (doors||[]).forEach((door, di) => {
      const dmx = door.mx ?? door.x;
      const dmy = door.my ?? door.y;
      if (dmx == null || dmy == null) return;

      // Wandwinkel identisch zu _doorAngle() – nächste Wand bestimmt Ausrichtung
      const roomList = this._data?.rooms || [];
      let bestDist = Infinity, wallAng = 0;
      roomList.forEach(r => {
        [{ dist: Math.abs(dmy - r.y1), angle: 0   },
         { dist: Math.abs(dmy - r.y2), angle: 0   },
         { dist: Math.abs(dmx - r.x1), angle: Math.PI/2 },
         { dist: Math.abs(dmx - r.x2), angle: Math.PI/2 }
        ].forEach(w => { if (w.dist < bestDist) { bestDist = w.dist; wallAng = w.angle; }});
      });
      // wallAng = 0 → horizontale Wand (Tür liegt entlang X-Achse)
      // wallAng = PI/2 → vertikale Wand (Tür liegt entlang Y-Achse)
      const nx = Math.cos(wallAng), ny = Math.sin(wallAng);  // Türrichtung entlang Wand
      // Senkrecht zur Wand (Öffnungsrichtung)
      const px = -ny, py = nx;

      const dw = (door.width || 0.9) / 2;
      const dh = wallH * 0.88;

      // Entity state → Farbe
      let doorState = null;
      if (door.entity_id && this._hass?.states) doorState = this._hass.states[door.entity_id]?.state;
      const isOpen   = doorState === "open"   || doorState === "on"  || doorState === "true";
      const isClosed = doorState === "closed" || doorState === "off" || doorState === "false";
      const [dr,dg,db] = isOpen   ? [239,68,68]
                       : isClosed ? [34,197,94]
                       :            [234,179,8];

      // Angelpunkt: linkes Ende der Tür (oder rechts wenn mirrored)
      const mir = door.mirrored ? -1 : 1;
      const hingeX = dmx - mir * nx * dw;
      const hingeY = dmy - mir * ny * dw;

      // Öffnungswinkel: offen = 110°, zu = 12° (kleiner Spalt sichtbar)
      const swingAngle = isOpen ? (110*Math.PI/180) : isClosed ? (12*Math.PI/180) : (110*Math.PI/180);

      // ── Türöffnung: schwarze Fläche in der Wand ──
      const b1 = project(dmx - nx*dw, dmy - ny*dw, 0);
      const b2 = project(dmx + nx*dw, dmy + ny*dw, 0);
      const t1 = project(dmx - nx*dw, dmy - ny*dw, dh);
      const t2 = project(dmx + nx*dw, dmy + ny*dw, dh);
      ctx.fillStyle = "rgba(0,0,0,0.85)";
      ctx.beginPath();
      ctx.moveTo(b1.x,b1.y); ctx.lineTo(b2.x,b2.y);
      ctx.lineTo(t2.x,t2.y); ctx.lineTo(t1.x,t1.y);
      ctx.closePath(); ctx.fill();

      // ── Türrahmen (Holzfarbe) ──
      ctx.strokeStyle = "rgba(180,130,60,0.9)"; ctx.lineWidth = 2;
      [[b1,t1],[b2,t2],[b1,b2],[t1,t2]].forEach(([a,b3]) => {
        ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b3.x,b3.y); ctx.stroke();
      });

      // ── Türblatt: geschlossen = Panel in Wand, offen = 110° Rechteck ────────
      const doorPat = this._texPattern(ctx, "door", unitPx * 0.3);
      if (isClosed) {
        // Geschlossen: flaches Panel liegt IN der Wandöffnung
        const cBot1 = project(dmx - nx*dw, dmy - ny*dw, 0.04);
        const cBot2 = project(dmx + nx*dw, dmy + ny*dw, 0.04);
        const cTop1 = project(dmx - nx*dw, dmy - ny*dw, dh*0.9);
        const cTop2 = project(dmx + nx*dw, dmy + ny*dw, dh*0.9);
        const doorPts = [cBot1,cBot2,cTop2,cTop1];
        if (doorPat) {
          ctx.save();
          ctx.fillStyle = doorPat; ctx.globalAlpha = 0.78;
          ctx.beginPath(); doorPts.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y)); ctx.closePath(); ctx.fill();
          ctx.fillStyle=`rgba(${dr},${dg},${db},0.22)`; ctx.globalAlpha=1;
          ctx.beginPath(); doorPts.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y)); ctx.closePath(); ctx.fill();
          ctx.restore();
        } else {
          ctx.fillStyle = `rgba(${dr},${dg},${db},0.35)`;
          ctx.beginPath(); ctx.moveTo(cBot1.x,cBot1.y); ctx.lineTo(cBot2.x,cBot2.y);
          ctx.lineTo(cTop2.x,cTop2.y); ctx.lineTo(cTop1.x,cTop1.y); ctx.closePath(); ctx.fill();
        }
        ctx.strokeStyle = `rgba(${dr},${dg},${db},0.85)`; ctx.lineWidth=1.5;
        [[cBot1,cBot2],[cTop1,cTop2],[cBot1,cTop1],[cBot2,cTop2]].forEach(([a,b3])=>{
          ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b3.x,b3.y); ctx.stroke();
        });
      } else {
        // Offen: 110° flaches Rechteck schwenkt aus der Wand
        const leafEndX = hingeX + mir * nx * Math.cos(swingAngle) * dw * 2 + px * Math.sin(swingAngle) * dw * 2;
        const leafEndY = hingeY + mir * ny * Math.cos(swingAngle) * dw * 2 + py * Math.sin(swingAngle) * dw * 2;
        const hBot = project(hingeX, hingeY, 0.04);
        const hTop = project(hingeX, hingeY, dh * 0.92);
        const eBot = project(leafEndX, leafEndY, 0.04);
        const eTop = project(leafEndX, leafEndY, dh * 0.92);
        const openPts = [hBot,eBot,eTop,hTop];
        if (doorPat) {
          ctx.save();
          ctx.fillStyle = doorPat; ctx.globalAlpha = 0.72;
          ctx.beginPath(); openPts.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y)); ctx.closePath(); ctx.fill();
          ctx.fillStyle=`rgba(${dr},${dg},${db},0.18)`; ctx.globalAlpha=1;
          ctx.beginPath(); openPts.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y)); ctx.closePath(); ctx.fill();
          ctx.restore();
        } else {
          ctx.fillStyle = `rgba(${dr},${dg},${db},0.25)`;
          ctx.beginPath();
          ctx.moveTo(hBot.x,hBot.y); ctx.lineTo(eBot.x,eBot.y);
          ctx.lineTo(eTop.x,eTop.y); ctx.lineTo(hTop.x,hTop.y);
          ctx.closePath(); ctx.fill();
        }
        ctx.strokeStyle = `rgba(${dr},${dg},${db},0.9)`; ctx.lineWidth=1.5;
        ctx.beginPath(); ctx.moveTo(hBot.x,hBot.y); ctx.lineTo(eBot.x,eBot.y); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(hTop.x,hTop.y); ctx.lineTo(eTop.x,eTop.y); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(eBot.x,eBot.y); ctx.lineTo(eTop.x,eTop.y); ctx.stroke();
        // Bogen-Spur
        const arcSteps=12;
        ctx.strokeStyle=`rgba(${dr},${dg},${db},0.3)`; ctx.lineWidth=0.8;
        ctx.setLineDash([3,3]); ctx.beginPath();
        for(let si=0;si<=arcSteps;si++){
          const a=(si/arcSteps)*swingAngle;
          const ax=hingeX+mir*nx*Math.cos(a)*dw*2+px*Math.sin(a)*dw*2;
          const ay=hingeY+mir*ny*Math.cos(a)*dw*2+py*Math.sin(a)*dw*2;
          const ap=project(ax,ay,0.04);
          si===0?ctx.moveTo(ap.x,ap.y):ctx.lineTo(ap.x,ap.y);
        }
        ctx.stroke(); ctx.setLineDash([]);
      }

      // ── Label ──
      const labelP = project(dmx, dmy, dh + 0.1);
      ctx.font = "bold 8px 'JetBrains Mono',monospace";
      ctx.fillStyle = `rgba(${dr},${dg},${db},0.95)`;
      ctx.textAlign = "center";
      ctx.fillText(`T${di+1}`, labelP.x, labelP.y);
      ctx.textAlign = "left";
    });


    // ── Windows & Rollos 3D ──────────────────────────────────────────────────
    (windows||[]).forEach((win, wi) => {
      const wmx = win.mx ?? win.x;  // support both field names
      const wmy = win.my ?? win.y;
      if (wmx==null || wmy==null) return;
      const ww  = (win.width||1.0)/2;
      const ang = win.angle||0;
      const nx  = Math.cos(ang), ny = Math.sin(ang);
      const isShutter = win.type === "shutter";

      // Entity state
      let winState = null;
      // Nur entity_id (Öffnungssensor) bestimmt Farbe; cover_entity = Rollo (nur Lamellen)
      if (win.entity_id && this._hass?.states) winState = this._hass.states[win.entity_id]?.state;
      const isOpen   = winState === "open"   || winState === "on"  || winState === "true";
      const isTilted = winState === "tilted";
      const isClosed = winState === "closed" || winState === "off" || winState === "false";

      const [wr,wg,wb3] = isOpen   ? [239,68,68]
                        : isTilted ? [251,146,60]
                        : isClosed ? [34,197,94]
                        :            [125,211,252];

      // Wall-slot height band
      const zBot = wallH * 0.22;
      const zTop = wallH * 0.82;

      const p0b=project(wmx-nx*ww, wmy-ny*ww, zBot);
      const p1b=project(wmx+nx*ww, wmy+ny*ww, zBot);
      const p0t=project(wmx-nx*ww, wmy-ny*ww, zTop);
      const p1t=project(wmx+nx*ww, wmy+ny*ww, zTop);

      // ── Window glass pane ──
      ctx.fillStyle = `rgba(${wr},${wg},${wb3},0.15)`;
      ctx.beginPath();
      ctx.moveTo(p0b.x,p0b.y); ctx.lineTo(p1b.x,p1b.y);
      ctx.lineTo(p1t.x,p1t.y); ctx.lineTo(p0t.x,p0t.y);
      ctx.closePath(); ctx.fill();

      // ── Frame ──
      ctx.strokeStyle = `rgba(${wr},${wg},${wb3},0.85)`; ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(p0b.x,p0b.y); ctx.lineTo(p1b.x,p1b.y);
      ctx.lineTo(p1t.x,p1t.y); ctx.lineTo(p0t.x,p0t.y);
      ctx.closePath(); ctx.stroke();

      // ── Mid crossbar ──
      const p0m=project(wmx-nx*ww,wmy-ny*ww,(zBot+zTop)/2);
      const p1m=project(wmx+nx*ww,wmy+ny*ww,(zBot+zTop)/2);
      ctx.strokeStyle=`rgba(${wr},${wg},${wb3},0.5)`; ctx.lineWidth=0.8;
      ctx.beginPath(); ctx.moveTo(p0m.x,p0m.y); ctx.lineTo(p1m.x,p1m.y); ctx.stroke();

      // ── Tilted indicator: diagonal slash ──
      if (isTilted) {
        ctx.strokeStyle=`rgba(251,146,60,0.7)`; ctx.lineWidth=1.2;
        ctx.setLineDash([2,3]);
        ctx.beginPath(); ctx.moveTo(p0b.x,p0b.y); ctx.lineTo(p1t.x,p1t.y); ctx.stroke();
        ctx.setLineDash([]);
      }

      // ── Rollo/Shutter: sliding panel from top ──
      if (isShutter) {
        // Get cover position 0-100 (0=fully open/up, 100=fully closed/down)
        let shutPos = 50; // default: half
        if (win.cover_entity && this._hass?.states) {
          const cs = this._hass.states[win.cover_entity];
          if (cs?.attributes?.current_position != null) {
            shutPos = 100 - cs.attributes.current_position; // invert: 100=closed
          } else if (isClosed) shutPos = 100;
          else if (isOpen) shutPos = 0;
        }
        const rolloZ = zTop - (zTop - zBot) * (shutPos / 100);
        const r0t=project(wmx-nx*ww, wmy-ny*ww, zTop);
        const r1t=project(wmx+nx*ww, wmy+ny*ww, zTop);
        const r0b=project(wmx-nx*ww, wmy-ny*ww, rolloZ);
        const r1b=project(wmx+nx*ww, wmy+ny*ww, rolloZ);
        // Rollo fill (dark slats)
        ctx.fillStyle = "rgba(60,60,80,0.75)";
        ctx.beginPath();
        ctx.moveTo(r0t.x,r0t.y); ctx.lineTo(r1t.x,r1t.y);
        ctx.lineTo(r1b.x,r1b.y); ctx.lineTo(r0b.x,r0b.y);
        ctx.closePath(); ctx.fill();
        // Slat lines
        const nSlats = Math.max(2, Math.round(shutPos/12));
        ctx.strokeStyle="rgba(100,100,120,0.6)"; ctx.lineWidth=0.6;
        for(let si=1; si<nSlats; si++) {
          const sz = zTop - (zTop-rolloZ)*(si/nSlats);
          const sl=project(wmx-nx*ww,wmy-ny*ww,sz);
          const sr=project(wmx+nx*ww,wmy+ny*ww,sz);
          ctx.beginPath(); ctx.moveTo(sl.x,sl.y); ctx.lineTo(sr.x,sr.y); ctx.stroke();
        }
        // Bottom rail highlight
        ctx.strokeStyle="rgba(180,180,200,0.8)"; ctx.lineWidth=1.5;
        ctx.beginPath(); ctx.moveTo(r0b.x,r0b.y); ctx.lineTo(r1b.x,r1b.y); ctx.stroke();
      }

      // ── Label ──
      const lblP = project(wmx + ny*0.12, wmy - nx*0.12, zTop + 0.08);
      ctx.font = "bold 7px 'JetBrains Mono',monospace";
      ctx.fillStyle = `rgba(${wr},${wg},${wb3},0.9)`;
      ctx.textAlign = "center";
      const lbl = isShutter ? `R${wi+1}` : `F${wi+1}`;
      ctx.fillText(lbl, lblP.x, lblP.y);
      ctx.textAlign = "left";
    });

    // ── Lights 3D: Raumflutung wie 2D, begrenzt durch Wände ─────────────────
    // ── Hilfsfunktion: 3D-Clip-Pfad für Raum-Boden ────────────────────────
    const roomFloorPath3D = (room) => {
      const corners = [[room.x1,room.y1],[room.x2,room.y1],[room.x2,room.y2],[room.x1,room.y2]];
      const fp = corners.map(([x,y]) => project(x, y, 0));
      ctx.beginPath();
      fp.forEach((p, i) => i ? ctx.lineTo(p.x,p.y) : ctx.moveTo(p.x,p.y));
      ctx.closePath();
    };

    // ── Pass 0: Raum abdunkeln wenn Licht vorhanden aber aus ──────────────
    const roomLightInfo3D = rooms.map(() => ({ anyLight: false, anyOn: false, color: null, bri: 1 }));
    lights.forEach(light => {
      const ri = this._lightRoomIdx(light, rooms);
      if (ri < 0) return;
      roomLightInfo3D[ri].anyLight = true;
      let isOn3 = true;
      if (light.entity && this._hass?.states) isOn3 = this._hass.states[light.entity]?.state === "on";
      if (isOn3) {
        roomLightInfo3D[ri].anyOn = true;
        // Farbe aus Entity-State holen (wie 2D)
        const state = this._hass?.states?.[light.entity];
        let lr=255,lg=248,lb=180;
        if (state?.attributes?.rgb_color) [lr,lg,lb] = state.attributes.rgb_color;
        else if (state?.attributes?.color_temp) {
          const ct = Math.max(153, Math.min(500, state.attributes.color_temp));
          const t = (ct-153)/347;
          lr=Math.round(200+55*t); lg=Math.round(220-30*t); lb=Math.round(255-100*t);
        } else if (light.color) { [lr,lg,lb]=hexRgb(light.color); }
        roomLightInfo3D[ri].color = [lr,lg,lb];
        roomLightInfo3D[ri].bri = (state?.attributes?.brightness ?? 255) / 255;
      }
    });

    ctx.save();
    rooms.forEach((room, ri) => {
      if (!roomLightInfo3D[ri].anyLight) return;
      if (!roomLightInfo3D[ri].anyOn) {
        // Raum abdunkeln (Licht aus)
        roomFloorPath3D(room);
        ctx.fillStyle = "rgba(0,0,0,0.50)";
        ctx.fill();
      }
    });
    ctx.restore();

    // ── Pass 1: Raumflutung für eingeschaltete Lichter ────────────────────
    lights.forEach(light => {
      if (light.mx==null||light.my==null) return;
      let isOn=true;
      if (light.entity&&this._hass?.states) isOn=this._hass.states[light.entity]?.state==="on";
      const ri = this._lightRoomIdx(light, rooms);

      // Lichtfarbe aus Entity-State
      const state = this._hass?.states?.[light.entity];
      let rr=255,gg=248,bb=180;
      if (state?.attributes?.rgb_color) [rr,gg,bb] = state.attributes.rgb_color;
      else if (state?.attributes?.color_temp) {
        const ct = Math.max(153, Math.min(500, state.attributes.color_temp));
        const t = (ct-153)/347;
        rr=Math.round(200+55*t); gg=Math.round(220-30*t); bb=Math.round(255-100*t);
      } else if (light.color) { [rr,gg,bb]=hexRgb(light.color); }

      const bri = (state?.attributes?.brightness ?? 255) / 255;
      const mz  = light.mz != null ? light.mz : wallH * 0.88;
      const lightPos = project(light.mx, light.my, mz);
      const floorPos = project(light.mx, light.my, 0);

      // ── 3D Leuchtpunkt: Kabel + Lampenschirm + Glühbirne ─────────────
      ctx.save();
      // Kabel von Decke zum Leuchtpunkt
      const ceilPos = project(light.mx, light.my, wallH);
      ctx.strokeStyle = "rgba(120,120,120,0.7)";
      ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(ceilPos.x, ceilPos.y); ctx.lineTo(lightPos.x, lightPos.y); ctx.stroke();
      // Lampenschirm (Kegelform über dem Leuchtpunkt)
      const shieldH = 5 + bri * 3;
      const shieldW = 6 + bri * 4;
      ctx.fillStyle = "rgba(80,70,50,0.85)";
      ctx.beginPath();
      ctx.moveTo(lightPos.x - shieldW, lightPos.y - shieldH);
      ctx.lineTo(lightPos.x + shieldW, lightPos.y - shieldH);
      ctx.lineTo(lightPos.x + shieldW * 0.4, lightPos.y + 1);
      ctx.lineTo(lightPos.x - shieldW * 0.4, lightPos.y + 1);
      ctx.closePath(); ctx.fill();
      // Lampenkörper
      const bulbR = isOn ? 4.5 + bri * 2 : 2.5;
      ctx.fillStyle = isOn ? `rgba(${rr},${gg},${bb},0.95)` : "rgba(80,80,70,0.4)";
      ctx.beginPath(); ctx.arc(lightPos.x, lightPos.y, bulbR, 0, Math.PI*2); ctx.fill();
      if (isOn) {
        // Weißes Zentrum
        const innerGrd = ctx.createRadialGradient(lightPos.x,lightPos.y,0,lightPos.x,lightPos.y,bulbR);
        innerGrd.addColorStop(0, `rgba(255,255,255,0.9)`);
        innerGrd.addColorStop(0.5, `rgba(${rr},${gg},${bb},0.5)`);
        innerGrd.addColorStop(1, `rgba(${rr},${gg},${bb},0)`);
        ctx.fillStyle = innerGrd;
        ctx.beginPath(); ctx.arc(lightPos.x, lightPos.y, bulbR, 0, Math.PI*2); ctx.fill();
        // Lichtkegel nach unten (lumen-skaliert)
        const coneLm = this._lumensToGlowFactor(light.lumen, bri);
        const coneH = (20 + bri * 15) * coneLm;
        const coneW = (16 + bri * 12) * coneLm;
        const coneGrd = ctx.createRadialGradient(lightPos.x,lightPos.y,0,lightPos.x,lightPos.y+coneH*0.3,coneH);
        coneGrd.addColorStop(0, `rgba(${rr},${gg},${bb},${Math.min(0.7,0.5*coneLm)})`);
        coneGrd.addColorStop(0.6, `rgba(${rr},${gg},${bb},${0.15*coneLm})`);
        coneGrd.addColorStop(1, `rgba(${rr},${gg},${bb},0)`);
        ctx.fillStyle = coneGrd;
        ctx.save();
        ctx.translate(lightPos.x, lightPos.y);
        ctx.scale(coneW / coneH, 1);
        ctx.beginPath(); ctx.arc(0, 0, coneH, 0.1, Math.PI - 0.1); ctx.fill();
        ctx.restore();
        // Lumen-Label
        if (light.lumen && light.lumen > 0) {
          ctx.fillStyle = `rgba(${rr},${gg},${bb},0.8)`;
          ctx.font = "bold 7px 'JetBrains Mono',monospace";
          ctx.textAlign = "center"; ctx.textBaseline = "top";
          ctx.fillText(light.lumen >= 1000 ? (light.lumen/1000).toFixed(1)+"k lm" : light.lumen+"lm",
            lightPos.x, lightPos.y + bulbR + 2);
        }
      }
      ctx.restore();

      if (!isOn || ri < 0) return;

      // ── 3D Lampentyp-Symbol (über dem Kabel/Schirm) ──────────────────────
      this._drawLampSymbol3D(ctx, project, light, rr, gg, bb, bri, wallH);

      // ── Raumflutung: Gradient auf Boden, geclippt auf Raum + offene Türen/Fenster ──
      // Clip-Räume: eigener Raum + Gruppengeschwister
      const myRoom = rooms[ri];
      const gid = myRoom.group_id;
      let clipRooms = gid ? rooms.filter(r2 => r2.group_id === gid) : [myRoom];

      // Offene Türen: Licht durch Türen in Nachbarräume
      const allDoors = this._data?.doors || [];
      const allWindows = this._data?.windows || [];
      const extraClipRooms = [];
      allDoors.forEach(door => {
        let doorOpen = true;
        if (door.entity_id && this._hass?.states) {
          const s = this._hass.states[door.entity_id]?.state;
          if (s) doorOpen = (s==="open"||s==="on");
        }
        if (!doorOpen) return;
        const connects = door.connects||[];
        if (!connects.includes(myRoom.name)) return;
        const neighbourName = connects.find(n => n !== myRoom.name);
        if (!neighbourName) return;
        const nRoom = rooms.find(r2 => r2.name === neighbourName);
        if (nRoom) extraClipRooms.push({ room: nRoom, factor: 0.30 });
      });
      allWindows.forEach(win => {
        const connects = win.connects||[];
        if (!connects.includes(myRoom.name)) return;
        const isWinOpen = (() => {
          if (!win.entity_id || !this._hass?.states) return false;
          const s = this._hass.states[win.entity_id]?.state;
          return s==="open"||s==="on";
        })();
        if (!isWinOpen) return;
        const neighbourName = connects.find(n => n !== myRoom.name);
        if (!neighbourName) return;
        const nRoom = rooms.find(r2 => r2.name === neighbourName);
        if (nRoom) extraClipRooms.push({ room: nRoom, factor: 0.15 });
      });

      // Berechne Radius: Boden-Skala basierend auf Raumgröße
      const roomW = myRoom.x2 - myRoom.x1;
      const roomH2 = myRoom.y2 - myRoom.y1;
      const roomDiag = Math.sqrt(roomW*roomW + roomH2*roomH2);
      const lumFactor3D = this._lumensToGlowFactor(light.lumen, bri);
      const glowRadiusPx = (roomDiag / 2) * unitPx * lumFactor3D;
      const alpha3D = Math.min(0.55, 0.08 + lumFactor3D * 0.20);

      // ── Eigener Raum ──────────────────────────────────────────────────
      ctx.save();
      roomFloorPath3D(myRoom);
      // Auch Gruppenräume clippen
      clipRooms.slice(1).forEach(r2 => {
        roomFloorPath3D(r2);
      });
      ctx.clip();

      const floodGrd = ctx.createRadialGradient(floorPos.x,floorPos.y,0,floorPos.x,floorPos.y,glowRadiusPx);
      floodGrd.addColorStop(0, `rgba(${rr},${gg},${bb},${alpha3D})`);
      floodGrd.addColorStop(0.5, `rgba(${rr},${gg},${bb},${alpha3D*0.5})`);
      floodGrd.addColorStop(1, `rgba(${rr},${gg},${bb},0)`);
      ctx.fillStyle = floodGrd;
      ctx.beginPath(); ctx.arc(floorPos.x,floorPos.y,glowRadiusPx*1.2,0,Math.PI*2); ctx.fill();
      ctx.restore();

      // ── Wand-Glow: Lichtschein auf sichtbaren Wandflächen ────────────
      // Berechne Wandeckpunkte direkt aus myRoom (kein f/t aus rooms.forEach)
      if (isOn && ri >= 0) {
        const wx1=myRoom.x1, wy1=myRoom.y1, wx2=myRoom.x2, wy2=myRoom.y2;
        const wCorners = [[wx1,wy1],[wx2,wy1],[wx2,wy2],[wx1,wy2]];
        const wf = wCorners.map(([x,y]) => project(x, y, 0));
        const wt = wCorners.map(([x,y]) => project(x, y, wallH));
        const roomW2 = wx2 - wx1, roomH3 = wy2 - wy1;
        const wallGlowAlpha = Math.min(0.50, 0.08 + lumFactor3D * 0.25);
        const wallGlowDefs2 = [
          { bi:[0,1], ti:[0,1], ex:(wx1+wx2)/2, ey:wy1 },   // Nord (y1)
          { bi:[1,2], ti:[1,2], ex:wx2,          ey:(wy1+wy2)/2 }, // Ost (x2)
          { bi:[2,3], ti:[2,3], ex:(wx1+wx2)/2, ey:wy2 },   // Süd (y2)
          { bi:[3,0], ti:[3,0], ex:wx1,          ey:(wy1+wy2)/2 }, // West (x1)
        ];
        wallGlowDefs2.forEach(w => {
          const distToWall = Math.hypot(light.mx - w.ex, light.my - w.ey);
          const maxDist = Math.max(roomW2, roomH3) * 1.6;
          const proxFactor = Math.max(0, 1 - distToWall / maxDist);
          if (proxFactor < 0.04) return;

          const p0=wf[w.bi[0]], p1=wf[w.bi[1]], p2=wt[w.ti[1]], p3=wt[w.ti[0]];
          const midBotX=(p0.x+p1.x)/2, midBotY=(p0.y+p1.y)/2;
          const midTopX=(p2.x+p3.x)/2, midTopY=(p2.y+p3.y)/2;

          // Gradient: Lampenpunkt → Wandmitte unten → Wandmitte oben
          const lp = project(light.mx, light.my, light.mz ?? wallH*0.88);
          const gx0 = midBotX*0.5 + lp.x*0.5, gy0 = midBotY*0.5 + lp.y*0.5;
          const wGrd = ctx.createLinearGradient(gx0, gy0, midTopX, midTopY);
          const a0 = Math.min(0.55, wallGlowAlpha * proxFactor * lumFactor3D * bri);
          wGrd.addColorStop(0,    `rgba(${rr},${gg},${bb},${a0})`);
          wGrd.addColorStop(0.5,  `rgba(${rr},${gg},${bb},${a0*0.4})`);
          wGrd.addColorStop(1,    `rgba(${rr},${gg},${bb},0)`);

          ctx.save();
          ctx.beginPath();
          ctx.moveTo(p0.x,p0.y); ctx.lineTo(p1.x,p1.y);
          ctx.lineTo(p2.x,p2.y); ctx.lineTo(p3.x,p3.y);
          ctx.closePath(); ctx.clip();
          ctx.fillStyle = wGrd;
          const mnX=Math.min(p0.x,p1.x,p2.x,p3.x)-2, mnY=Math.min(p0.y,p1.y,p2.y,p3.y)-2;
          const mxX=Math.max(p0.x,p1.x,p2.x,p3.x)+2, mxY=Math.max(p0.y,p1.y,p2.y,p3.y)+2;
          ctx.fillRect(mnX, mnY, mxX-mnX, mxY-mnY);
          ctx.restore();
        });
      }

      // ── Bleed durch offene Türen/Fenster ──────────────────────────────
      extraClipRooms.forEach(({ room: nRoom, factor }) => {
        ctx.save();
        roomFloorPath3D(nRoom);
        ctx.clip();
        const bleedGrd = ctx.createRadialGradient(floorPos.x,floorPos.y,0,floorPos.x,floorPos.y,glowRadiusPx*1.5);
        bleedGrd.addColorStop(0, `rgba(${rr},${gg},${bb},${alpha3D*factor})`);
        bleedGrd.addColorStop(1, `rgba(${rr},${gg},${bb},0)`);
        ctx.fillStyle = bleedGrd;
        ctx.beginPath(); ctx.arc(floorPos.x,floorPos.y,glowRadiusPx*1.5,0,Math.PI*2); ctx.fill();
        ctx.restore();
      });
    });

    // ── Devices ─────────────────────────────────────────────────────────────
    const _gh3d = this._opts?.guestMode ? (this._guestHidden || {}) : {};
    (devices||[]).filter(dev => !_gh3d[dev.device_id]).forEach(dev => {
      const mx=dev.state?.mx??dev.mx??dev.x, my=dev.state?.my??dev.my??dev.y;
      if (mx==null||my==null) return;
      const pos=project(mx, my, wallH*0.25);
      const floor=project(mx, my, 0);
      const color=this._deviceColor?.(dev.device_id)||"#00e5ff";
      const [rr,gg,bb]=hexRgb(color);
      ctx.fillStyle="rgba(0,0,0,0.3)";
      ctx.beginPath(); ctx.ellipse(floor.x,floor.y+2,9,4,0,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle=`rgba(${rr},${gg},${bb},0.3)`; ctx.lineWidth=0.7;
      ctx.beginPath(); ctx.moveTo(pos.x,pos.y); ctx.lineTo(floor.x,floor.y); ctx.stroke();
      const sgrd=ctx.createRadialGradient(pos.x-2,pos.y-2,0,pos.x,pos.y,9);
      sgrd.addColorStop(0,"rgba(255,255,255,0.8)");
      sgrd.addColorStop(0.3,`rgba(${rr},${gg},${bb},0.9)`);
      sgrd.addColorStop(1,`rgba(${rr},${gg},${bb},0.1)`);
      ctx.fillStyle=sgrd; ctx.beginPath(); ctx.arc(pos.x,pos.y,8,0,Math.PI*2); ctx.fill();
      const label=dev.name||dev.device_id?.split("_")[0]||"?";
      ctx.save();
      ctx.font="bold 7px 'JetBrains Mono',monospace";
      ctx.fillStyle=color; ctx.textAlign="center"; ctx.textBaseline="top";
      ctx.fillText(label,pos.x,pos.y+10);
      ctx.restore();
    });

    // ── Deco elements in 3D ─────────────────────────────────────────────────
    this._drawDecos3D(ctx, project, unitPx, this._data?.decos || []);

    // ── Alarms: floor fill + inner wall highlight ──────────────────────────
    const alarms3d = this._pendingAlarms?.length ? this._pendingAlarms : (this._data?.alarms || []);
    if (alarms3d.length) {
      const now3d   = Date.now();
      const pulse3d = 0.45 + 0.55 * Math.abs(Math.sin(now3d / 700));

      alarms3d.forEach(al => {
        const stateVal = this._hass?.states?.[al.entity]?.state || "";
        const active = ["on","true","1","triggered","motion","wet","smoke","detected","alert","alarm","active","detected"]
          .includes(stateVal.toLowerCase()) || stateVal.toLowerCase().startsWith("on");
        if (!active) return;

        const col   = al.color || "#ff2222";
        const [ar,ag,ab] = hexRgb(col);

        const targetRooms3d = al.scope === "room" && al.room_idx != null
          ? [rooms[al.room_idx]].filter(Boolean)
          : rooms;

        targetRooms3d.forEach(room => {
          if (!room) return;
          const {x1,y1,x2,y2} = room;
          const corners = [[x1,y1],[x2,y1],[x2,y2],[x1,y2]];
          const f = corners.map(([x,y]) => project(x, y, 0));
          const t = corners.map(([x,y]) => project(x, y, wallH));

          // ── Floor fill: pulsing colored overlay ──
          ctx.fillStyle = `rgba(${ar},${ag},${ab},${0.30 * pulse3d})`;
          ctx.beginPath();
          f.forEach((p,i) => i ? ctx.lineTo(p.x,p.y) : ctx.moveTo(p.x,p.y));
          ctx.closePath(); ctx.fill();

          // ── Floor border ──
          ctx.strokeStyle = `rgba(${ar},${ag},${ab},${0.90 * pulse3d})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          f.forEach((p,i) => i ? ctx.lineTo(p.x,p.y) : ctx.moveTo(p.x,p.y));
          ctx.closePath(); ctx.stroke();

          // ── Inner wall highlight: all 4 walls lit from inside ──
          const wallDefs3d = [
            [0,1],[1,2],[2,3],[3,0]
          ];
          wallDefs3d.forEach(([i,j]) => {
            // Light inner face (slightly inset visually)
            ctx.fillStyle = `rgba(${ar},${ag},${ab},${0.22 * pulse3d})`;
            ctx.beginPath();
            ctx.moveTo(f[i].x,f[i].y); ctx.lineTo(f[j].x,f[j].y);
            ctx.lineTo(t[j].x,t[j].y); ctx.lineTo(t[i].x,t[i].y);
            ctx.closePath(); ctx.fill();
            // Bright edge lines along wall top
            ctx.strokeStyle = `rgba(${ar},${ag},${ab},${0.75 * pulse3d})`;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(t[i].x,t[i].y); ctx.lineTo(t[j].x,t[j].y);
            ctx.stroke();
          });

          // ── Warning triangle icon on floor center ──
          const fc = project((x1+x2)/2, (y1+y2)/2, 0.05);
          const sz = Math.max(8, Math.min(22, ((x2-x1)+(y2-y1)) * unitPx * 0.08));
          ctx.save();
          ctx.globalAlpha = pulse3d;
          // Triangle background
          ctx.fillStyle = `rgba(${ar},${ag},${ab},0.9)`;
          ctx.beginPath();
          ctx.moveTo(fc.x, fc.y - sz);
          ctx.lineTo(fc.x + sz * 0.87, fc.y + sz * 0.5);
          ctx.lineTo(fc.x - sz * 0.87, fc.y + sz * 0.5);
          ctx.closePath(); ctx.fill();
          // Exclamation mark
          ctx.fillStyle = "#fff";
          ctx.font = `bold ${Math.round(sz*1.1)}px sans-serif`;
          ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.fillText("!", fc.x, fc.y + sz * 0.15);
          ctx.globalAlpha = 1.0;
          ctx.restore();

          // ── Alarm label above icon ──
          const label3d = (al.name || "ALARM").toUpperCase();
          ctx.save();
          ctx.globalAlpha = Math.min(1, pulse3d * 1.2);
          ctx.font = `bold ${Math.max(7,Math.min(11,sz*0.7))}px 'JetBrains Mono',monospace`;
          ctx.fillStyle = `rgb(${ar},${ag},${ab})`;
          ctx.textAlign = "center"; ctx.textBaseline = "bottom";
          ctx.fillText(label3d, fc.x, fc.y - sz - 2);
          ctx.globalAlpha = 1.0;
          ctx.restore();
        });
      });
    }

    // ── Set cursor & HUD ─────────────────────────────────────────────────────
    if (!this._3dDrag) this._canvas.style.cursor = "grab";
    const isMobile = cw < 600;
    ctx.save();
    // HUD-Hintergrund (leicht abgesetzt)
    const hudText = isMobile
      ? `3D  ▪  ${(this._wallHeight??2.5).toFixed(1)}m  ▪  1-Finger=drehen  2-Finger=zoom`
      : `3D  ▪  Wandhöhe ${(this._wallHeight??2.5).toFixed(1)} m  ▪  Drag=drehen  Scroll=zoom`;
    ctx.font = `bold ${isMobile ? 8 : 9}px 'JetBrains Mono',monospace`;
    ctx.textBaseline = "top";
    const hudW = ctx.measureText(hudText).width + 16;
    ctx.fillStyle = "rgba(7,9,13,0.65)";
    ctx.beginPath(); ctx.roundRect(4, 4, hudW, 16, 4); ctx.fill();
    ctx.fillStyle = "rgba(0,229,255,0.55)";
    ctx.fillText(hudText, 12, 7);

    // Reset-Button (⌂) oben rechts
    const resetBtnX = cw - (isMobile ? 38 : 44);
    const resetBtnY = 4;
    const resetBtnW = isMobile ? 32 : 38;
    ctx.fillStyle = "rgba(7,9,13,0.75)";
    ctx.beginPath(); ctx.roundRect(resetBtnX, resetBtnY, resetBtnW, 18, 4); ctx.fill();
    ctx.strokeStyle = "rgba(0,229,255,0.3)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(resetBtnX, resetBtnY, resetBtnW, 18, 4); ctx.stroke();
    ctx.font = `bold ${isMobile ? 8 : 9}px 'JetBrains Mono',monospace`;
    ctx.fillStyle = "rgba(0,229,255,0.7)";
    ctx.textAlign = "center";
    ctx.fillText("⌂ Reset", resetBtnX + resetBtnW/2, resetBtnY + 5);
    ctx.textAlign = "left";
    // Speichere Reset-Button-Bereich für Click-Handler
    this._3dResetBtn = { x: resetBtnX, y: resetBtnY, w: resetBtnW, h: 18 };
    ctx.restore();
  
    // ── Energie-Overlay (3D-Partikel, project/unitPx in scope here) ────────
    this._drawEnergyOverlay3D(ctx, project, unitPx);

    // ── mmWave Personen (3D) ─────────────────────────────────────────────
    if (this._opts?.showMmwave !== false) {
      this._drawMmwave3D(ctx, project, unitPx, wallH);
      if (this._mode === "view") this._updateMmwavePersonsSidebar();
    }
}


  // ══════════════════════════════════════════════════════════════════════════
  // ── INFO-SENSOREN SIDEBAR ─────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════

  _sidebarInfo() {
    const wrap = document.createElement("div");
    wrap.style.cssText = "padding:8px;display:flex;flex-direction:column;gap:6px";

    const hdr = document.createElement("div");
    hdr.style.cssText = "font-size:10px;font-weight:700;color:#00bcd4;letter-spacing:1px";
    hdr.textContent = "ℹ INFO-SENSOREN";
    wrap.appendChild(hdr);

    const hint = document.createElement("div");
    hint.style.cssText = "font-size:8px;color:var(--muted);margin-bottom:2px";
    hint.textContent = "Sensoren auf dem Grundriss platzieren & HA-Entitäten verknüpfen.";
    wrap.appendChild(hint);

    (this._pendingInfoSensors || []).forEach((s, idx) => {
      const card = document.createElement("div");
      card.style.cssText = `background:var(--surf2);border-radius:6px;padding:6px 8px;border:1px solid ${this._placingInfoIdx===idx?"#00bcd4":"var(--border)"};display:flex;flex-direction:column;gap:3px`;

      // Row 1: icon selector + name + delete
      const r1 = document.createElement("div");
      r1.style.cssText = "display:flex;align-items:center;gap:5px";

      const iconSel = document.createElement("select");
      iconSel.style.cssText = "background:var(--surf3);border:1px solid var(--border);color:var(--text);border-radius:3px;font-size:8px;padding:1px 2px;flex-shrink:0";
      [["thermometer","🌡 Temp"],["humidity","💧 Feuchte"],["brightness","🔆 Hell."],
       ["co2","🌬 CO₂"],["electric","⚡ Energie"],["motion","🏃 Bewegung"],["generic","📊 Generisch"]
      ].forEach(([v,t]) => {
        const o = document.createElement("option"); o.value=v; o.textContent=t;
        if (s.icon===v) o.selected=true;
        iconSel.appendChild(o);
      });
      iconSel.addEventListener("change", () => { s.icon=iconSel.value; this._draw(); });

      const nameInp = document.createElement("input");
      nameInp.value = s.name||""; nameInp.placeholder="Name";
      nameInp.style.cssText = "flex:1;min-width:0;background:var(--surf3);border:1px solid var(--border);color:var(--text);border-radius:3px;font-size:9px;padding:2px 4px";
      nameInp.addEventListener("input", ()=>{ s.name=nameInp.value; });

      const colWrap = document.createElement("div");
      colWrap.style.cssText = `position:relative;width:18px;height:18px;border-radius:3px;overflow:hidden;border:1px solid var(--border);flex-shrink:0;background:${s.color||"#00bcd4"}`;
      const colInp = document.createElement("input"); colInp.type="color"; colInp.value=s.color||"#00bcd4";
      colInp.style.cssText = "position:absolute;inset:-4px;opacity:0.01;width:140%;height:140%;cursor:pointer";
      colInp.addEventListener("input",()=>{ s.color=colInp.value; colWrap.style.background=colInp.value; this._draw(); });
      colWrap.appendChild(colInp);

      const del = document.createElement("button");
      del.textContent="✕"; del.style.cssText="background:none;border:none;color:var(--muted);cursor:pointer;font-size:10px;padding:0 2px;flex-shrink:0";
      del.addEventListener("click", e => {
        e.stopPropagation();
        this._pendingInfoSensors.splice(idx,1);
        if(this._placingInfoIdx===idx) this._placingInfoIdx=-1;
        this._rebuildSidebar();
      });
      r1.append(iconSel, nameInp, colWrap, del);

      // Row 2: entity input + live value
      const r2 = document.createElement("div");
      r2.style.cssText = "display:flex;align-items:center;gap:4px";
      const eLbl = document.createElement("span"); eLbl.textContent="Entity"; eLbl.style.cssText="font-size:7px;color:var(--muted);flex-shrink:0";
      const eInp = document.createElement("input"); eInp.value=s.entity||""; eInp.placeholder="sensor.xxx";
      eInp.style.cssText="flex:1;min-width:0;background:var(--surf3);border:1px solid var(--border);color:var(--text);border-radius:3px;font-size:8px;padding:2px 4px";
      eInp.addEventListener("input",()=>{ s.entity=eInp.value.trim(); });
      // live value badge
      const lv = document.createElement("span");
      if (s.entity && this._hass?.states?.[s.entity]) {
        const st = this._hass.states[s.entity];
        const unit = s.unit || st.attributes?.unit_of_measurement || "";
        lv.textContent = `${st.state}${unit?" "+unit:""}`;
        lv.style.cssText = "font-size:8px;color:#00bcd4;font-weight:700;flex-shrink:0;white-space:nowrap";
      } else if (s.entity) {
        lv.textContent = "⚠"; lv.style.cssText = "font-size:9px;color:#f59e0b;flex-shrink:0";
      }
      r2.append(eLbl, eInp, lv);

      // Row 3: unit + place button + position
      const r3 = document.createElement("div");
      r3.style.cssText = "display:flex;align-items:center;gap:4px";
      const uLbl = document.createElement("span"); uLbl.textContent="Einheit"; uLbl.style.cssText="font-size:7px;color:var(--muted);flex-shrink:0";
      const uInp = document.createElement("input"); uInp.value=s.unit||""; uInp.placeholder="°C";
      uInp.style.cssText="width:32px;background:var(--surf3);border:1px solid var(--border);color:var(--text);border-radius:3px;font-size:8px;padding:2px 4px";
      uInp.addEventListener("input",()=>{ s.unit=uInp.value; });

      const placing = this._placingInfoIdx === idx;
      const placeBtn = document.createElement("button");
      placeBtn.textContent = placing ? "📍 Klick auf Karte..." : "📍 Platzieren";
      placeBtn.style.cssText = `font-size:8px;padding:2px 6px;border-radius:3px;border:none;cursor:pointer;font-family:inherit;font-weight:700;background:${placing?"#00bcd4":"var(--surf3)"};color:${placing?"#07090d":"var(--text)"}`;
      placeBtn.addEventListener("click", e => {
        e.stopPropagation();
        this._placingInfoIdx = placing ? -1 : idx;
        this._canvas.style.cursor = this._placingInfoIdx >= 0 ? "crosshair" : "default";
        this._rebuildSidebar();
      });

      const pos = document.createElement("span");
      pos.style.cssText = "font-size:7px;color:var(--muted);flex:1;text-align:right";
      pos.textContent = (s.mx!=null&&s.my!=null) ? `${s.mx.toFixed(1)}/${s.my.toFixed(1)}m` : "–";
      r3.append(uLbl, uInp, placeBtn, pos);

      // ── Anzeige-Modus: Badge vs. Raum ──────────────────────────────
      const r4 = document.createElement("div");
      r4.style.cssText = "display:flex;align-items:center;gap:4px;flex-wrap:wrap";

      const modeLbl = document.createElement("span");
      modeLbl.style.cssText = "font-size:7px;color:var(--muted);flex-shrink:0";
      modeLbl.textContent = "Anzeige:";

      // Toggle: Badge | Raum
      const modeToggle = document.createElement("div");
      modeToggle.style.cssText = "display:flex;border-radius:4px;overflow:hidden;border:1px solid var(--border);flex-shrink:0";
      const isRoom = s.display_mode === "room";
      ["Badge", "Raum"].forEach((lbl, mi) => {
        const mb = document.createElement("button");
        const active = mi === 0 ? !isRoom : isRoom;
        mb.style.cssText = `padding:2px 7px;font-size:7.5px;border:none;cursor:pointer;font-family:inherit;background:${active?"var(--accent)":"var(--surf2)"};color:${active?"#000":"var(--muted)"}`;
        mb.textContent = lbl;
        mb.addEventListener("click", () => {
          s.display_mode = mi === 1 ? "room" : "badge";
          this._rebuildSidebar();
          this._draw();
        });
        modeToggle.appendChild(mb);
      });
      r4.append(modeLbl, modeToggle);

      // Raum-Auswahl (nur wenn Modus = Raum)
      if (isRoom) {
        const rooms = this._data?.rooms || [];
        const roomSel = document.createElement("select");
        roomSel.style.cssText = "flex:1;background:var(--surf3);border:1px solid var(--border);color:var(--text);border-radius:3px;font-size:8px;padding:2px 4px;min-width:0";
        const noOpt = document.createElement("option"); noOpt.value=""; noOpt.textContent="— Raum wählen —";
        roomSel.appendChild(noOpt);
        rooms.forEach(rm => {
          const opt = document.createElement("option");
          opt.value = rm.id || rm.name;
          opt.textContent = rm.name || `Raum ${rm.id}`;
          if ((s.room_id && s.room_id === opt.value) || (!s.room_id && s.room_idx != null && rooms.indexOf(rm) === s.room_idx)) opt.selected = true;
          roomSel.appendChild(opt);
        });
        roomSel.addEventListener("change", () => {
          s.room_id = roomSel.value || null;
          this._draw();
        });
        r4.appendChild(roomSel);
      }

      card.append(r1, r2, r3, r4);
      wrap.appendChild(card);
    });

    // Add button
    const addBtn = document.createElement("button");
    addBtn.className="btn btn-outline";
    addBtn.style.cssText="width:100%;margin-top:2px;border-color:#00bcd4;color:#00bcd4;font-size:9px";
    addBtn.textContent="+ Sensor hinzufügen";
    addBtn.addEventListener("click", () => {
      this._pendingInfoSensors.push({
        id: "is_"+Date.now(), name:"Sensor "+(this._pendingInfoSensors.length+1),
        entity:"", icon:"thermometer", color:"#00bcd4", unit:"", mx:null, my:null,
      });
      this._rebuildSidebar();
    });
    wrap.appendChild(addBtn);

    // Save button
    const saveBtn = document.createElement("button");
    saveBtn.className="btn btn-green";
    saveBtn.style.cssText="width:100%;margin-top:4px;padding:8px;font-size:10px;font-weight:700";
    saveBtn.textContent="💾 Info-Sensoren speichern";
    saveBtn.addEventListener("click", ()=>this._saveInfoSensors());
    wrap.appendChild(saveBtn);

    return wrap;
  }

  async _saveInfoSensors() {
    try {
      await this._hass.callApi("POST",
        `ble_positioning/${this._entryId}/info_sensors`,
        { info_sensors: this._pendingInfoSensors });
      await this._loadData();
      this._showToast("✓ Info-Sensoren gespeichert");
    } catch(e) {
      this._showToast("✗ " + (e?.body?.message || e?.message || e));
    }
    this._rebuildSidebar();
  }

  _hexToRgb(hex) {
    const h = hex.replace("#","");
    if (h.length === 3) return [parseInt(h[0]+h[0],16), parseInt(h[1]+h[1],16), parseInt(h[2]+h[2],16)];
    return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
  }

  _roundRect(ctx, x, y, w, h, r) {
    if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(x,y,w,h,r); return; }
    ctx.beginPath();
    ctx.moveTo(x+r, y);
    ctx.lineTo(x+w-r, y); ctx.arcTo(x+w, y, x+w, y+r, r);
    ctx.lineTo(x+w, y+h-r); ctx.arcTo(x+w, y+h, x+w-r, y+h, r);
    ctx.lineTo(x+r, y+h); ctx.arcTo(x, y+h, x, y+h-r, r);
    ctx.lineTo(x, y+r); ctx.arcTo(x, y, x+r, y, r);
    ctx.closePath();
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ── INFO CANVAS OVERLAY ───────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════

  _drawInfoOverlay() {
    const ctx = this._ctx;
    if (!ctx) return;
    const sensors = this._pendingInfoSensors || [];
    if (!sensors.length && this._placingInfoIdx < 0) return;

    const rooms = this._data?.rooms || [];

    sensors.forEach((s, idx) => {
      const placing = this._placingInfoIdx === idx;

      // Ghost when placing (only for badge mode)
      if (placing && this._mouseFloor && s.display_mode !== "room") {
        const c = this._f2c(this._mouseFloor.mx, this._mouseFloor.my);
        ctx.save(); ctx.globalAlpha = 0.5;
        this._drawInfoBadge(ctx, s, c.x, c.y, true);
        ctx.restore();
      }

      // ── Raum-Modus: Wert in Raummitte anzeigen ──
      if (s.display_mode === "room") {
        // Finde Raum nach ID oder Index
        const room = s.room_id
          ? rooms.find(r => r.id === s.room_id)
          : rooms[s.room_idx ?? -1];
        if (!room) return;
        const cx_f = (room.x1 + room.x2) / 2;
        const cy_f = (room.y1 + room.y2) / 2;
        const c = this._f2c(cx_f, cy_f);
        this._drawInfoInRoom(ctx, s, c.x, c.y);
        return;
      }

      if (s.mx == null || s.my == null) return;
      const c = this._f2c(s.mx, s.my);
      this._drawInfoBadge(ctx, s, c.x, c.y, false);

      // Highlight ring if currently placing
      if (placing) {
        ctx.save();
        ctx.strokeStyle = s.color || "#00bcd4";
        ctx.lineWidth = 2; ctx.setLineDash([4,3]);
        ctx.beginPath(); ctx.arc(c.x, c.y, 18, 0, Math.PI*2); ctx.stroke();
        ctx.setLineDash([]); ctx.restore();
      }
    });
  }

  // ── Info-Sensor als Raumtext rendern (kompakter Wert im Raum) ──
  _drawInfoInRoom(ctx, s, cx, cy) {
    if (!this._hass || !s.entity) return;
    const state = this._hass.states[s.entity];
    if (!state) return;
    const val = state.state;
    const unit = s.unit || state.attributes?.unit_of_measurement || "";
    const col = s.color || "#00bcd4";
    const icons = { thermometer:"🌡", humidity:"💧", brightness:"🔆", co2:"🌬", electric:"⚡", motion:"🏃", generic:"📊" };
    const icon = icons[s.icon] || "📊";

    ctx.save();
    // Kleines Label mit Icon + Wert
    const text = `${icon} ${parseFloat(val).toFixed(1)}${unit}`;
    ctx.font = "bold 11px 'JetBrains Mono', monospace";
    const tw = ctx.measureText(text).width;
    // Hintergrund-Pill
    ctx.fillStyle = col + "22";
    const ph = 16, pw = tw + 14, pr = 8;
    ctx.beginPath();
    ctx.roundRect(cx - pw/2, cy - ph/2, pw, ph, pr);
    ctx.fill();
    ctx.strokeStyle = col + "66";
    ctx.lineWidth = 1;
    ctx.stroke();
    // Text
    ctx.fillStyle = col;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, cx, cy);
    // Name darunter (sehr klein)
    if (s.name) {
      ctx.font = "7px 'JetBrains Mono', monospace";
      ctx.fillStyle = col + "88";
      ctx.fillText(s.name, cx, cy + 13);
    }
    ctx.restore();
  }

  _drawInfoBadge(ctx, s, cx, cy, ghost) {
    const col = s.color || "#00bcd4";
    const [rr,gg,bb] = this._hexToRgb(col);
    const r = 13;

    // Glow
    const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, r*2.5);
    grd.addColorStop(0, `rgba(${rr},${gg},${bb},${ghost?0.15:0.3})`);
    grd.addColorStop(1, `rgba(${rr},${gg},${bb},0)`);
    ctx.fillStyle = grd;
    ctx.beginPath(); ctx.arc(cx, cy, r*2.5, 0, Math.PI*2); ctx.fill();

    // Circle background
    ctx.fillStyle = "rgba(7,9,13,0.85)";
    ctx.strokeStyle = col; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.fill(); ctx.stroke();

    // Icon
    this._drawInfoIcon(ctx, s.icon, cx, cy, r * 0.52, col);

    // Value bubble
    let valText = "–", unit = s.unit || "";
    if (s.entity && this._hass?.states?.[s.entity]) {
      const st = this._hass.states[s.entity];
      valText = st.state;
      if (!unit) unit = st.attributes?.unit_of_measurement || "";
    }
    const fullVal = valText + (unit ? " " + unit : "");
    const bubW = Math.max(44, (s.name?.length||0)*5 + fullVal.length*6.5 + 12);
    const bx = cx + r + 3, by = cy - 11;

    ctx.fillStyle = "rgba(7,9,13,0.88)";
    ctx.strokeStyle = col; ctx.lineWidth = 1;
    this._roundRect(ctx, bx, by, bubW, 22, 4);
    ctx.fill(); ctx.stroke();

    ctx.textAlign = "left";
    ctx.font = "bold 7px 'JetBrains Mono',monospace";
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.fillText((s.name||"").substring(0,14).toUpperCase(), bx+4, by+8);

    ctx.font = "bold 9px 'JetBrains Mono',monospace";
    ctx.fillStyle = col;
    ctx.fillText(fullVal, bx+4, by+18);
    ctx.textAlign = "left";
  }

  _drawInfoIcon(ctx, icon, cx, cy, sz, col) {
    const [rr,gg,bb] = this._hexToRgb(col);
    ctx.save();
    ctx.fillStyle = `rgb(${rr},${gg},${bb})`;
    ctx.strokeStyle = `rgb(${rr},${gg},${bb})`;
    ctx.lineWidth = Math.max(1, sz*0.15);
    ctx.lineCap = "round";

    if (icon === "thermometer") {
      ctx.lineWidth = sz*0.22;
      ctx.beginPath(); ctx.moveTo(cx, cy-sz*0.85); ctx.lineTo(cx, cy+sz*0.1); ctx.stroke();
      ctx.fillStyle = `rgb(${rr},${gg},${bb})`;
      ctx.beginPath(); ctx.arc(cx, cy+sz*0.42, sz*0.3, 0, Math.PI*2); ctx.fill();
      ctx.lineWidth = sz*0.13;
      ctx.beginPath(); ctx.moveTo(cx, cy+sz*0.1); ctx.lineTo(cx, cy-sz*0.5); ctx.stroke();

    } else if (icon === "humidity") {
      ctx.beginPath();
      ctx.moveTo(cx, cy-sz);
      ctx.bezierCurveTo(cx+sz*0.7,cy-sz*0.2, cx+sz*0.8,cy+sz*0.4, cx,cy+sz*0.85);
      ctx.bezierCurveTo(cx-sz*0.8,cy+sz*0.4, cx-sz*0.7,cy-sz*0.2, cx,cy-sz);
      ctx.closePath(); ctx.fill();

    } else if (icon === "brightness") {
      ctx.beginPath(); ctx.arc(cx, cy, sz*0.38, 0, Math.PI*2); ctx.fill();
      ctx.lineWidth = sz*0.14;
      for (let i=0;i<8;i++) {
        const a = (i/8)*Math.PI*2;
        ctx.beginPath();
        ctx.moveTo(cx+Math.cos(a)*sz*0.52, cy+Math.sin(a)*sz*0.52);
        ctx.lineTo(cx+Math.cos(a)*sz*0.85, cy+Math.sin(a)*sz*0.85);
        ctx.stroke();
      }

    } else if (icon === "co2") {
      ctx.lineWidth = sz*0.18;
      [[-sz*0.3,-sz*0.35,sz*0.3,-sz*0.35],[-sz*0.45,0,sz*0.45,0],[-sz*0.3,sz*0.35,sz*0.25,sz*0.35]].forEach(([x1,y1,x2,y2]) => {
        ctx.beginPath(); ctx.moveTo(cx+x1,cy+y1); ctx.lineTo(cx+x2,cy+y2); ctx.stroke();
      });

    } else if (icon === "electric") {
      ctx.beginPath();
      ctx.moveTo(cx+sz*0.15,cy-sz); ctx.lineTo(cx-sz*0.35,cy+sz*0.05);
      ctx.lineTo(cx+sz*0.08,cy+sz*0.05); ctx.lineTo(cx-sz*0.15,cy+sz);
      ctx.lineTo(cx+sz*0.45,cy-sz*0.1); ctx.lineTo(cx+sz*0.05,cy-sz*0.1);
      ctx.closePath(); ctx.fill();

    } else if (icon === "motion") {
      ctx.beginPath(); ctx.arc(cx, cy-sz*0.75, sz*0.22, 0, Math.PI*2); ctx.fill();
      ctx.lineWidth = sz*0.2;
      ctx.beginPath(); ctx.moveTo(cx,cy-sz*0.5); ctx.lineTo(cx+sz*0.1,cy+sz*0.1); ctx.lineTo(cx+sz*0.35,cy+sz*0.5); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx+sz*0.1,cy+sz*0.1); ctx.lineTo(cx-sz*0.3,cy+sz*0.5); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx,cy-sz*0.5); ctx.lineTo(cx-sz*0.25,cy); ctx.stroke();

    } else {
      // Generic: bar chart
      ctx.lineWidth = sz*0.18;
      [[0,0.4],[0.3,0.2],[0.6,0.65]].forEach(([dx,h]) => {
        const bx = cx-sz*0.35+dx*sz;
        ctx.beginPath(); ctx.moveTo(bx,cy+sz*0.7); ctx.lineTo(bx,cy+sz*0.7-h*sz*1.4); ctx.stroke();
      });
      ctx.lineWidth=sz*0.12;
      ctx.beginPath(); ctx.moveTo(cx-sz*0.45,cy+sz*0.7); ctx.lineTo(cx+sz*0.55,cy+sz*0.7); ctx.stroke();
    }
    ctx.restore();
  }


}

// ── Register ──────────────────────────────────────────────────────────────
if (!customElements.get("ble-positioning-card")) {
  customElements.define("ble-positioning-card", BLEPositioningCard);
}

window.customCards = window.customCards || [];
window.customCards.push({
  type:        "ble-positioning-card",
  name:        "BLE Indoor Positioning",
  description: "Live indoor positioning via BLE fingerprinting",
  preview:     false,
});

console.info(
  `%c BLE-POSITIONING-CARD %c v${CARD_VERSION} `,
  "background:#00e5ff;color:#07090d;font-weight:700;padding:2px 4px;border-radius:3px 0 0 3px",
  "background:#0d1219;color:#00e5ff;padding:2px 4px;border-radius:0 3px 3px 0",
);


// ── Panel wrapper (für Seitenleiste) ──────────────────────────────────────────
// Registriert dieselbe Card als ha-panel-ble-positioning
// In HA: Einstellungen → Dashboards → Panel hinzufügen → /ble-config
class BLEPositioningPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.shadowRoot.innerHTML = `
<style>
  :host { display:block; width:100%; height:100%; background:#07090d; overflow:auto; }
  #wrap { display:block; width:100%; height:100%; }
</style>
<div id="wrap"></div>`;
  }

  _boot() {
    if (this._card) return;
    const card = document.createElement("ble-positioning-card");
    // Pass entry_id from panel config - card will auto-discover if empty
    const cfg = { entry_id: this._entryId || "", ...(this._panelConfig || {}) };
    card.setConfig(cfg);
    if (this._hass) card.hass = this._hass;
    this.shadowRoot.getElementById("wrap").appendChild(card);
    this._card = card;
  }

  set hass(hass) {
    this._hass = hass;
    if (this._card) {
      this._card.hass = hass;
    } else {
      // Boot immediately - card will discover entry_id if not set yet
      this._boot();
    }
  }

  set panel(panel) {
    this._entryId     = panel?.config?.entry_id || "";
    this._panelConfig = panel?.config || {};
    if (this._card) {
      // Update entry_id on already-booted card if it was empty before
      if (this._entryId && !this._card._entryId) {
        this._card._entryId = this._entryId;
        this._card._loadData();
      }
    }
    // panel is set - if hass is already set, boot now
    if (this._hass && !this._card) this._boot();
  }
}

if (!customElements.get("ha-panel-ble-positioning")) {
  customElements.define("ha-panel-ble-positioning", BLEPositioningPanel);
}

class BLEPositioningCardEditor extends HTMLElement {
  constructor(){super();this._config={};this._built=false;}
  set hass(h){this._hass=h;if(!this._built)this._build();}
  setConfig(cfg){this._config={...cfg};if(this._built)this._sync();}
  _fire(p){var c=Object.assign({type:"ble-positioning-card"},this._config,p);this.dispatchEvent(new CustomEvent("config-changed",{detail:{config:c},bubbles:true,composed:true}));this._config=c;}
  _build(){
    this._built=true;
    var s=document.createElement("style");
    s.textContent=".ed{padding:12px;font-family:sans-serif;display:flex;flex-direction:column;gap:8px}.row{display:flex;align-items:center;gap:8px}label{font-size:12px;color:#555;min-width:130px}input[type=text],select{flex:1;padding:5px;border:1px solid #ccc;border-radius:5px;font-size:12px}input[type=number]{width:80px;padding:5px;border:1px solid #ccc;border-radius:5px;font-size:12px}.trow{display:flex;align-items:center;justify-content:space-between;padding:4px 0;border-bottom:1px solid #f0f0f0}.trow span{font-size:12px;color:#444}input[type=checkbox]{width:18px;height:18px;cursor:pointer;accent-color:#00b4cc}h4{margin:6px 0 2px;font-size:10px;text-transform:uppercase;color:#999}.info{font-size:10px;color:#aaa;line-height:1.5}";
    this.appendChild(s);
    this._wrap=document.createElement("div");this._wrap.className="ed";
    this.appendChild(this._wrap);this._sync();
  }
  _sync(){
    if(!this._wrap)return;
    this._wrap.innerHTML="";
    var cfg=this._config,W=this._wrap,self=this;
    function row(l,i){var d=document.createElement("div");d.className="row";var lb=document.createElement("label");lb.textContent=l;d.append(lb,i);return d;}
    function inp(t,v,a){var i=document.createElement("input");i.type=t;i.value=v||"";if(a)Object.keys(a).forEach(function(k){i.setAttribute(k,a[k]);});return i;}
    var eId=inp("text",cfg.entry_id);eId.placeholder="z.B. abc123...";
    eId.onchange=function(){self._fire({entry_id:eId.value.trim()});};
    W.appendChild(row("Entry ID *",eId));
    var ht=inp("number",cfg.card_height||400,{min:150,max:1200,step:50});
    ht.onchange=function(){self._fire({card_height:parseInt(ht.value)||400});};
    W.appendChild(row("Hoehe (px)",ht));
    var th=document.createElement("select");
    ["auto","dark","light"].forEach(function(o){var op=document.createElement("option");op.value=op.textContent=o;if(o===(cfg.theme_mode||"auto"))op.selected=true;th.appendChild(op);});
    th.onchange=function(){self._fire({theme_mode:th.value});};
    W.appendChild(row("Theme",th));
    var h4=document.createElement("h4");h4.textContent="Ebenen";W.appendChild(h4);
    [["show_devices","Geraete"],["show_rooms","Raumnamen"],["show_doors","Tueren & Fenster"],["show_scanners","Scanner"],["show_alarms","Alarme"],["show_info","Info-Sensoren"],["show_grid","Gitterlinien"]].forEach(function(pair){
      var d=document.createElement("div");d.className="trow";
      var sp=document.createElement("span");sp.textContent=pair[1];
      var cb=inp("checkbox","");cb.checked=(cfg[pair[0]]!==false);
      cb.onchange=(function(k){return function(){self._fire({[k]:cb.checked});};})(pair[0]);
      d.append(sp,cb);W.appendChild(d);
    });
    var inf=document.createElement("div");inf.className="info";inf.textContent="* Entry ID: Einstellungen > Geraete & Dienste > BLE Positioning";W.appendChild(inf);
  }
}
if (!customElements.get("ble-positioning-card-editor")) {
  customElements.define("ble-positioning-card-editor", BLEPositioningCardEditor);
}
class BLEPositioningPanelCard extends BLEPositioningPanel {}
if (!customElements.get("ha-panel-ble-positioning-card")) {
  customElements.define("ha-panel-ble-positioning-card", BLEPositioningPanelCard);
}
