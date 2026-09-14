// ═══════════════════════════════════════════════════════════════════════════
// BLE Positioning – Modul: AUTOMATE  v1.0.0
// Visueller Automations-Baukasten
// Schritt 1: Block zeichnen · Block verschieben · Zwei Blöcke verbinden
// ═══════════════════════════════════════════════════════════════════════════

const AutomateModul = {
  ...BLEModuleBase,

  id:          'automate',
  name:        'Automate',
  icon:        '🤖',
  tabId:       'automate',
  version:     '1.0.0',
  description: 'Visueller Automations-Baukasten · Simulation · HA Import/Export',

  // ── State ──────────────────────────────────────────────────────────────────
  _automations:   [],   // alle Automationen (Datenformat aus KONTEXT.md)
  _activeAuto:    null, // gerade geöffnete Automation
  _selBlock:      null, // selektierter Block
  _selConnection: null, // selektierte Connection
  _dragBlock:     null, // gerade gezogener Block
  _dragOffX:      0,
  _dragOffY:      0,
  _connecting:    null, // { fromBlock } – läuft gerade eine Verbindung?
  _connectCurX:   0,    // Maus-X während Verbinden (relative 0–1)
  _connectCurY:   0,
  _editMode:      true,
  _simLevel:      0,    // 0=aus, 1=RAM, 2=Bedingungen real, 3=alles real
  _simStates:     {},

  // ── Pflicht-Methoden für base.js ──────────────────────────────────────────
  _getValsForSim(card) { return {}; },

  // ── Block-Typ-Definitionen ─────────────────────────────────────────────────
  // Farben aus KONTEXT.md: orange=Trigger, blau=Bedingung, grün=Aktion, lila=Spezial
  BLOCK_DEFS: {
    // TRIGGER
    trigger_time:     { label: 'Zeit',             icon: '\u23F0', color: '#f97316' },
    trigger_astro:    { label: 'Astro',            icon: '\uD83C\uDF05', color: '#f97316' },
    trigger_state:    { label: 'Entity-\u00C4nderung',  icon: '\uD83D\uDD14', color: '#f97316' },
    trigger_numeric:  { label: 'Schwellwert',      icon: '\u26A1', color: '#f97316' },
    trigger_interval: { label: 'Intervall',        icon: '\uD83D\uDD01', color: '#f97316' },
    // BEDINGUNGEN
    cond_state:    { label: 'Entity-Zustand',   icon: '\u2713',  color: '#38bdf8' },
    cond_numeric:  { label: 'Numerisch',        icon: '\u26A1', color: '#38bdf8' },
    cond_time:     { label: 'Zeit-Fenster',     icon: '\uD83D\uDD50', color: '#38bdf8' },
    cond_solar:    { label: 'Solar-\u00DCberschuss', icon: '\u2600',  color: '#38bdf8' },
    cond_battery:  { label: 'Akku-SOC',         icon: '\uD83D\uDD0B', color: '#38bdf8' },
    cond_weather:  { label: 'Wetter',           icon: '\u26C5', color: '#38bdf8' },
    // AKTIONEN
    action_light:   { label: 'Licht',             icon: '\uD83D\uDCA1', color: '#22c55e' },
    action_switch:  { label: 'Schalter',          icon: '\uD83D\uDD0C', color: '#22c55e' },
    action_climate: { label: 'Klima',             icon: '\uD83C\uDF21', color: '#22c55e' },
    action_scene:   { label: 'Szene',             icon: '\uD83C\uDFAC', color: '#22c55e' },
    action_delay:   { label: 'Verz\u00F6gerung', icon: '\u23F3', color: '#22c55e' },
    action_notify:  { label: 'Benachrichtigung',  icon: '\uD83D\uDD14', color: '#22c55e' },
    // SPEZIAL
    special_branch:  { label: 'Verzweigung', icon: '\uD83D\uDD00', color: '#a855f7' },
    special_wait:    { label: 'Warten auf',  icon: '\u23F1',  color: '#a855f7' },
    special_stop:    { label: 'Stopp',       icon: '\uD83D\uDED1', color: '#a855f7' },
    special_comment: { label: 'Kommentar',   icon: '\uD83D\uDCDD', color: '#a855f7' },
    special_ki:      { label: 'KI-Block',    icon: '\uD83E\uDD16', color: '#06b6d4' },
  },

  // Standardgröße aller Blöcke (CSS-Pixel), laut KONTEXT.md Mindestgröße 100×56
  BLOCK_W: 110,
  BLOCK_H: 56,

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  init(card) {
    this._automations   = card._opts?.automate_data || [];
    this._activeAuto    = null;
    this._selBlock      = null;
    this._selConnection = null;
    this._dragBlock     = null;
    this._connecting    = null;
    this._simStates     = {};

    // Demo-Automation anlegen wenn noch keine vorhanden
    if (!this._automations.length) {
      this._automations.push(this._mkDemoAuto());
      this._save(card);
    }
    this._activeAuto = this._automations[0];
  },

  destroy() {},

  _save(card) {
    if (!card._opts) card._opts = {};
    card._opts.automate_data = this._automations;
    card._saveOpts?.();
  },

  // Demo-Automation: Sunset → Solar-Bedingung → Licht AN
  _mkDemoAuto() {
    return {
      id:      'auto_demo',
      name:    'Abend-Routine',
      enabled: true,
      mode:    'single',
      canvas: {
        blocks: [
          { id: 't1', type: 'trigger_astro',
            x: 0.18, y: 0.45, w: 110, h: 56,
            config: { event: 'sunset', offset: -47 },
            label: 'Sunset \u221247min' },
          { id: 'b1', type: 'cond_solar',
            x: 0.45, y: 0.30, w: 110, h: 56,
            config: { above: 0 },
            label: 'Solar > 0W' },
          { id: 'a1', type: 'action_light',
            x: 0.72, y: 0.45, w: 120, h: 56,
            config: { entity: 'light.wohnzimmer', brightness: 30, color_temp: 2700 },
            label: 'Wohnzimmer 30%' },
        ],
        connections: [
          { id: 'c1', from: 't1', from_port: 'out', to: 'b1', to_port: 'in' },
          { id: 'c2', from: 'b1', from_port: 'out', to: 'a1', to_port: 'in' },
        ],
      },
      simulation: { last_run: null, run_count: 0, confidence: null },
    };
  },

  // ── Port-Positionen (Rückgabe in Canvas-Pixeln inkl. DPR) ─────────────────
  _outPort(b, W, H) {
    const dpr = window.devicePixelRatio || 1;
    return { x: b.x * W + (b.w || this.BLOCK_W) * dpr / 2, y: b.y * H };
  },

  _inPort(b, W, H) {
    const dpr = window.devicePixelRatio || 1;
    return { x: b.x * W - (b.w || this.BLOCK_W) * dpr / 2, y: b.y * H };
  },

  _truePort(b, W, H) {
    const dpr = window.devicePixelRatio || 1;
    return { x: b.x * W, y: b.y * H - (b.h || this.BLOCK_H) * dpr / 2 };
  },

  _falsePort(b, W, H) {
    const dpr = window.devicePixelRatio || 1;
    return { x: b.x * W, y: b.y * H + (b.h || this.BLOCK_H) * dpr / 2 };
  },

  _portPos(b, portName, W, H) {
    switch (portName) {
      case 'in':    return this._inPort(b, W, H);
      case 'true':  return this._truePort(b, W, H);
      case 'false': return this._falsePort(b, W, H);
      default:      return this._outPort(b, W, H);
    }
  },

  // ── Hit-Detection für Rechtecke ────────────────────────────────────────────
  // px/py: CSS-Pixel (von onTap/onDragStart geliefert, also ohne DPR)
  // W, H:  canvas.width / canvas.height (physische Pixel, mit DPR)
  _hitBlock(px, py, W, H) {
    const dpr    = window.devicePixelRatio || 1;
    const scale  = 1 / dpr;                    // CSS-Pixel pro physischem Pixel
    const blocks = this._activeAuto?.canvas?.blocks || [];
    return blocks.slice().reverse().find(b => {
      const bx = b.x * W * scale;              // Block-Mittelpunkt in CSS-Pixeln
      const by = b.y * H * scale;
      const bw = b.w || this.BLOCK_W;
      const bh = b.h || this.BLOCK_H;
      return px >= bx - bw / 2 && px <= bx + bw / 2 &&
             py >= by - bh / 2 && py <= by + bh / 2;
    }) || null;
  },

  // ── Bezier-Kurve zeichnen ──────────────────────────────────────────────────
  // x0/y0, x1/y1: Canvas-Pixel (mit DPR)
  _drawBezier(ctx, x0, y0, x1, y1, color, dashed, dpr) {
    const cp = 80 * dpr;   // ±80px Kontrollpunkt-Versatz laut KONTEXT.md

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.bezierCurveTo(x0 + cp, y0, x1 - cp, y1, x1, y1);
    ctx.strokeStyle = color;
    ctx.lineWidth   = 2 * dpr;
    if (dashed) ctx.setLineDash([6 * dpr, 4 * dpr]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Pfeilspitze am Zielport
    // Annäherung: letztes Segment der Kurve bei t≈0.97
    const t  = 0.97;
    const mt = 1 - t;
    // P1 = cp-Punkt von fromBlock, P2 = cp-Punkt von toBlock
    const p1x = x0 + cp, p1y = y0;
    const p2x = x1 - cp, p2y = y1;
    const tx  = 3 * mt * mt * t * p1x + 3 * mt * t * t * p2x + t * t * t * x1;
    const ty  = 3 * mt * mt * t * p1y + 3 * mt * t * t * p2y + t * t * t * y1;
    const ang = Math.atan2(y1 - ty, x1 - tx);
    const as  = 7 * dpr;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x1 - as * Math.cos(ang - 0.4), y1 - as * Math.sin(ang - 0.4));
    ctx.lineTo(x1 - as * Math.cos(ang + 0.4), y1 - as * Math.sin(ang + 0.4));
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
  },

  // ── Block zeichnen ─────────────────────────────────────────────────────────
  _drawBlock(ctx, b, W, H, dpr) {
    const def = this.BLOCK_DEFS[b.type] || { label: b.type, icon: '?', color: '#64748b' };
    const bw  = (b.w || this.BLOCK_W) * dpr;
    const bh  = (b.h || this.BLOCK_H) * dpr;
    const bx  = b.x * W - bw / 2;
    const by  = b.y * H - bh / 2;
    const rx  = 8 * dpr;                       // Eckenradius laut KONTEXT.md
    const sel = this._selBlock === b;
    const col = def.color;

    ctx.save();

    // Selektion: Glow
    if (sel) { ctx.shadowColor = col; ctx.shadowBlur = 16 * dpr; }

    // Hintergrund-Rechteck
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, rx);
    ctx.fillStyle = '#0a1525';
    ctx.fill();

    // Rahmen (Typ-Farbe, bei Selektion weiß)
    ctx.strokeStyle = sel ? '#ffffff' : col;
    ctx.lineWidth   = (sel ? 2.5 : 1.5) * dpr;
    ctx.stroke();
    ctx.shadowBlur  = 0;

    // Linker Farbstreifen (4px)
    ctx.beginPath();
    ctx.roundRect(bx, by, 4 * dpr, bh, [rx, 0, 0, rx]);
    ctx.fillStyle = col;
    ctx.fill();

    // ── Inhalt: Zeile 1 — Icon + Typ-Label ──────────────────────────────────
    const iconSize = Math.round(13 * dpr);
    ctx.font         = `${iconSize}px serif`;
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle    = '#ffffff';
    ctx.fillText(def.icon, bx + 10 * dpr, by + 6 * dpr);

    ctx.font      = `bold ${Math.round(8.5 * dpr)}px 'JetBrains Mono', monospace`;
    ctx.fillStyle = col;
    ctx.fillText(def.label.toUpperCase(), bx + 26 * dpr, by + 8 * dpr);

    // ── Inhalt: Zeile 2 — Parameter-Preview ─────────────────────────────────
    const preview = b.label || this._paramPreview(b);
    if (preview) {
      ctx.font         = `${Math.round(7.5 * dpr)}px 'JetBrains Mono', monospace`;
      ctx.fillStyle    = '#475569';
      ctx.textBaseline = 'top';
      const maxPx = bw - 36 * dpr;
      let txt = preview;
      while (txt.length > 3 && ctx.measureText(txt).width > maxPx) txt = txt.slice(0, -2) + '\u2026';
      ctx.fillText(txt, bx + 10 * dpr, by + bh / 2 + 3 * dpr);
    }

    ctx.restore();

    // ── Ports ────────────────────────────────────────────────────────────────
    this._drawPort(ctx, this._inPort(b, W, H),   false, sel, col, dpr);
    this._drawPort(ctx, this._outPort(b, W, H),  true,  sel, col, dpr);
    if (b.type.startsWith('cond_') || b.type === 'special_branch') {
      this._drawPort(ctx, this._truePort(b, W, H),  true,  false, '#22c55e', dpr);
      this._drawPort(ctx, this._falsePort(b, W, H), true,  false, '#ef4444', dpr);
    }
  },

  // isOut=true → leer (Ausgang), isOut=false → gefüllt (Eingang)
  _drawPort(ctx, pos, isOut, sel, col, dpr) {
    const r = 5 * dpr;
    ctx.save();
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
    if (isOut) {
      ctx.fillStyle   = '#0a1525';
      ctx.strokeStyle = sel ? '#ffffff' : col;
      ctx.lineWidth   = 1.5 * dpr;
      ctx.fill(); ctx.stroke();
    } else {
      ctx.fillStyle = sel ? '#ffffff' : col;
      ctx.fill();
    }
    ctx.restore();
  },

  // Kurze Parameter-Vorschau für Zeile 2
  _paramPreview(b) {
    const cfg = b.config || {};
    switch (b.type) {
      case 'trigger_time':     return cfg.time || '';
      case 'trigger_astro': {
        const ev  = cfg.event === 'sunset' ? 'Sunset' : 'Sunrise';
        const off = cfg.offset != null
          ? (cfg.offset >= 0 ? '+' + cfg.offset : String(cfg.offset)) + 'min' : '';
        return (ev + ' ' + off).trim();
      }
      case 'trigger_interval': return cfg.minutes ? 'alle ' + cfg.minutes + 'min'
                                      : cfg.hours  ? 'alle ' + cfg.hours + 'h' : '';
      case 'cond_state':   return cfg.entity ? (cfg.entity.split('.')[1] || cfg.entity) + ' = ' + (cfg.state || 'on') : '';
      case 'cond_solar':   return cfg.above != null ? '> ' + cfg.above + 'W' : '';
      case 'cond_battery': return cfg.above != null ? '> ' + cfg.above + '%'
                                  : cfg.below != null ? '< ' + cfg.below + '%' : '';
      case 'cond_time':    return (cfg.after && cfg.before) ? cfg.after + ' \u2013 ' + cfg.before : '';
      case 'action_light': return cfg.entity ? (cfg.entity.split('.')[1] || cfg.entity) : '';
      case 'action_switch':return cfg.entity ? (cfg.entity.split('.')[1] || cfg.entity) + ': ' + (cfg.state || 'on') : '';
      case 'action_delay': return cfg.seconds ? cfg.seconds + 's' : cfg.minutes ? cfg.minutes + 'min' : '';
      case 'special_comment': return cfg.text ? cfg.text.slice(0, 20) : '';
      default: return '';
    }
  },

  // ── Haupt-Draw ─────────────────────────────────────────────────────────────
  onDraw(ctx, card) {
    const c   = card._canvas; if (!c) return;
    const W   = c.width;
    const H   = c.height;
    const dpr = window.devicePixelRatio || 1;

    // Hintergrund
    ctx.fillStyle = '#070e18';
    ctx.fillRect(0, 0, W, H);

    // Dezentes Gitter
    ctx.strokeStyle = '#0b1828';
    ctx.lineWidth   = 0.5;
    const gs = 40 * dpr;
    for (let x = 0; x < W; x += gs) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y < H; y += gs) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

    // Keine Automation → Hinweis
    if (!this._activeAuto) {
      ctx.font = `${11 * dpr}px monospace`;
      ctx.fillStyle    = '#334155';
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Keine Automation ausgewählt — links auf + Neu klicken', W / 2, H / 2);
      return;
    }

    const { blocks = [], connections = [] } = this._activeAuto.canvas;

    // ── Pass 1: Connections ──────────────────────────────────────────────────
    connections.forEach(conn => {
      const fromB = blocks.find(b => b.id === conn.from);
      const toB   = blocks.find(b => b.id === conn.to);
      if (!fromB || !toB) return;
      const p0    = this._portPos(fromB, conn.from_port || 'out', W, H);
      const p1    = this._portPos(toB,   conn.to_port   || 'in',  W, H);
      const isSel = this._selConnection === conn;
      // Farbe: Schritt 3 bringt echte Sim-Farben — jetzt Grau / Weiß bei Selektion
      this._drawBezier(ctx, p0.x, p0.y, p1.x, p1.y, isSel ? '#94a3b8' : '#334155', isSel, dpr);
    });

    // Verbinden-Linie (in progress: gestrichelt vom Ausgangsport zur Maus)
    if (this._connecting) {
      const fromB = this._connecting.fromBlock;
      const p0    = this._portPos(fromB, 'out', W, H);
      const tx    = this._connectCurX * W;
      const ty    = this._connectCurY * H;
      this._drawBezier(ctx, p0.x, p0.y, tx, ty, '#38bdf877', true, dpr);
    }

    // ── Pass 2: Blöcke (gezogener Block ganz oben) ───────────────────────────
    blocks.forEach(b => { if (b !== this._dragBlock) this._drawBlock(ctx, b, W, H, dpr); });
    if (this._dragBlock) this._drawBlock(ctx, this._dragBlock, W, H, dpr);

    // ── Status-Zeile (oben, 18px) ────────────────────────────────────────────
    ctx.fillStyle = 'rgba(7,14,24,0.9)';
    ctx.fillRect(0, 0, W, 18 * dpr);
    ctx.font         = `${Math.round(6.5 * dpr)}px 'JetBrains Mono', monospace`;
    ctx.fillStyle    = '#334155';
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      '\u26A1 ' + (this._activeAuto.name || '\u2014') +
      '  \u00B7  ' + blocks.length + ' Bl\u00F6cke' +
      '  \u00B7  ' + connections.length + ' Verbindungen',
      10 * dpr, 9 * dpr
    );
    if (this._editMode) {
      ctx.textAlign = 'right';
      ctx.fillStyle = '#1e3048';
      ctx.fillText('BEARBEITUNGSMODUS', W - 10 * dpr, 9 * dpr);
    }
  },

  // ── Interaktion ────────────────────────────────────────────────────────────

  onTap(px, py, card) {
    if (!card._canvas) return false;
    const { width: W, height: H } = card._canvas;

    // Verbinden-Modus: Ziel-Block antippen
    if (this._connecting) {
      const hit = this._hitBlock(px, py, W, H);
      if (hit && hit !== this._connecting.fromBlock) {
        this._addConnection(this._connecting.fromBlock, hit, card);
      }
      this._connecting = null;
      card._rebuildSidebar?.(); card._markDirty?.();
      return true;
    }

    const hit = this._hitBlock(px, py, W, H);
    if (hit) {
      this._selBlock      = this._selBlock === hit ? null : hit;
      this._selConnection = null;
      card._rebuildSidebar?.(); card._markDirty?.();
      return true;
    }

    // Tap auf freie Fläche → deselektieren
    if (this._selBlock || this._selConnection) {
      this._selBlock      = null;
      this._selConnection = null;
      card._rebuildSidebar?.(); card._markDirty?.();
      return true;
    }
    return false;
  },

  onDragStart(px, py, card) {
    if (!this._editMode || !card._canvas) return false;
    const { width: W, height: H } = card._canvas;
    const dpr = window.devicePixelRatio || 1;
    const hit = this._hitBlock(px, py, W, H);
    if (!hit) return false;
    this._dragBlock = hit;
    this._selBlock  = hit;
    this._dragOffX  = px - hit.x * (W / dpr);
    this._dragOffY  = py - hit.y * (H / dpr);
    return true;
  },

  onDragMove(px, py, card) {
    const c = card._canvas; if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    const W   = c.width  / dpr;
    const H   = c.height / dpr;

    if (this._dragBlock) {
      this._dragBlock.x = Math.max(0.03, Math.min(0.97, (px - this._dragOffX) / W));
      this._dragBlock.y = Math.max(0.05, Math.min(0.95, (py - this._dragOffY) / H));
      card._markDirty?.();
    }

    // Verbinden-Cursor aktuell halten
    if (this._connecting) {
      this._connectCurX = Math.max(0, Math.min(1, px / W));
      this._connectCurY = Math.max(0, Math.min(1, py / H));
      card._markDirty?.();
    }
  },

  onDragEnd(px, py, card) {
    if (this._dragBlock) this._save(card);
    this._dragBlock = null;
  },

  // ── Connection anlegen ─────────────────────────────────────────────────────
  _addConnection(fromBlock, toBlock, card) {
    const canvas = this._activeAuto?.canvas; if (!canvas) return;
    // Duplikat-Schutz
    if (canvas.connections.find(c => c.from === fromBlock.id && c.to === toBlock.id)) return;
    canvas.connections.push({
      id:        'c_' + Date.now(),
      from:      fromBlock.id,
      from_port: 'out',
      to:        toBlock.id,
      to_port:   'in',
    });
    this._save(card);
    card._showToast?.('Verbindung angelegt');
    card._markDirty?.();
  },

  // ── Sidebar ────────────────────────────────────────────────────────────────
  buildSidebar(card) {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;flex-direction:column;gap:6px;padding:4px';

    // Edit/View-Button
    const topRow = document.createElement('div');
    topRow.style.cssText = 'display:flex;gap:4px';
    const editBtn = document.createElement('button');
    editBtn.style.cssText = `flex:1;padding:3px;border-radius:4px;border:1px solid ${
      this._editMode ? '#38bdf8' : '#1c2535'};background:${
      this._editMode ? '#38bdf822' : 'var(--surf2)'};color:${
      this._editMode ? '#38bdf8' : '#64748b'};font-size:7.5px;cursor:pointer`;
    editBtn.textContent = this._editMode ? '\uD83D\uDD13 EDIT' : '\uD83D\uDD12 VIEW';
    editBtn.addEventListener('click', () => {
      this._editMode = !this._editMode;
      card._rebuildSidebar?.(); card._markDirty?.();
    });
    topRow.appendChild(editBtn);
    wrap.appendChild(topRow);

    // Automation-Liste + Neue Automation
    wrap.appendChild(this._buildAutoList(card));

    // Block-Panel wenn selektiert, sonst Baukasten
    if (this._selBlock) {
      wrap.appendChild(this._buildBlockPanel(card));
    } else {
      wrap.appendChild(this._buildPalette(card));
    }

    return wrap;
  },

  _buildAutoList(card) {
    const div  = document.createElement('div');
    div.style.cssText = 'display:flex;flex-direction:column;gap:3px';

    const hdr = document.createElement('div');
    hdr.style.cssText = 'display:flex;align-items:center;gap:4px';
    const title = document.createElement('span');
    title.style.cssText = 'flex:1;font-size:7.5px;font-weight:700;color:#94a3b8';
    title.textContent = 'AUTOMATIONEN';
    const addBtn = document.createElement('button');
    addBtn.style.cssText = 'padding:2px 7px;border-radius:3px;border:1px solid #22c55e;background:transparent;color:#22c55e;font-size:7.5px;cursor:pointer';
    addBtn.textContent = '+ Neu';
    addBtn.addEventListener('click', () => {
      const na = {
        id: 'auto_' + Date.now(), name: 'Neue Automation',
        enabled: true, mode: 'single',
        canvas: { blocks: [], connections: [] },
        simulation: { last_run: null, run_count: 0, confidence: null },
      };
      this._automations.push(na);
      this._activeAuto = na;
      this._selBlock   = null;
      this._save(card); card._rebuildSidebar?.(); card._markDirty?.();
    });
    hdr.append(title, addBtn);
    div.appendChild(hdr);

    this._automations.forEach(auto => {
      const isActive = this._activeAuto === auto;
      const row = document.createElement('div');
      row.style.cssText = `display:flex;align-items:center;gap:4px;padding:3px 6px;` +
        `border-radius:4px;cursor:pointer;background:${isActive ? '#38bdf811' : 'var(--surf2)'};` +
        `border:1px solid ${isActive ? '#38bdf8' : '#1c2535'}`;
      const lbl = document.createElement('span');
      lbl.style.cssText = 'flex:1;font-size:7.5px;color:#94a3b8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
      lbl.textContent = auto.name;
      const cnt = document.createElement('span');
      cnt.style.cssText = 'font-size:6.5px;color:#445566';
      cnt.textContent = auto.canvas.blocks.length + 'B';
      row.append(lbl, cnt);
      row.addEventListener('click', () => {
        this._activeAuto = auto; this._selBlock = null;
        card._rebuildSidebar?.(); card._markDirty?.();
      });
      div.appendChild(row);
    });
    return div;
  },

  _buildBlockPanel(card) {
    const b   = this._selBlock;
    const def = this.BLOCK_DEFS[b.type] || { label: b.type, icon: '?', color: '#64748b' };
    const canvas = this._activeAuto?.canvas;
    const div = document.createElement('div');
    div.style.cssText = 'display:flex;flex-direction:column;gap:4px';

    // Header
    const hdr = document.createElement('div');
    hdr.style.cssText = `display:flex;align-items:center;gap:6px;padding:4px 5px;` +
      `background:var(--surf2);border-radius:5px;border:1px solid ${def.color}44`;
    hdr.innerHTML = `<span style="font-size:14px">${def.icon}</span>` +
      `<span style="font-size:8.5px;font-weight:700;color:${def.color};flex:1">${def.label.toUpperCase()}</span>`;
    const backBtn = document.createElement('button');
    backBtn.style.cssText = 'padding:2px 7px;border-radius:3px;border:1px solid var(--border);background:var(--surf2);color:var(--text);font-size:8px;cursor:pointer';
    backBtn.textContent = '\u2190';
    backBtn.addEventListener('click', () => { this._selBlock = null; card._rebuildSidebar?.(); });
    hdr.appendChild(backBtn);
    div.appendChild(hdr);

    // Label-Feld
    div.appendChild(this._mkField('Label / Name', b.label || '', v => {
      b.label = v; this._save(card); card._markDirty?.();
    }));

    // Verbinden-Button
    const isConn  = this._connecting?.fromBlock === b;
    const connBtn = document.createElement('button');
    connBtn.style.cssText = `width:100%;padding:4px;border-radius:4px;border:1px solid ${
      isConn ? '#38bdf8' : '#334155'};background:${isConn ? '#38bdf811' : 'transparent'};color:${
      isConn ? '#38bdf8' : '#64748b'};font-size:7.5px;cursor:pointer`;
    connBtn.textContent = isConn ? '\uD83D\uDD17 Ziel-Block antippen\u2026' : '\u2192 Von hier verbinden';
    connBtn.addEventListener('click', () => {
      if (this._connecting?.fromBlock === b) {
        this._connecting = null;
      } else {
        this._connecting  = { fromBlock: b };
        this._connectCurX = b.x;
        this._connectCurY = b.y;
      }
      card._rebuildSidebar?.(); card._markDirty?.();
    });
    div.appendChild(connBtn);

    // Bestehende Verbindungen dieses Blocks
    if (canvas) {
      const myConns = canvas.connections.filter(c => c.from === b.id || c.to === b.id);
      if (myConns.length) {
        const ch = document.createElement('div');
        ch.style.cssText = 'font-size:7px;font-weight:700;color:#94a3b8;margin-top:3px';
        ch.textContent   = 'VERBINDUNGEN';
        div.appendChild(ch);
        myConns.forEach(conn => {
          const isFrom    = conn.from === b.id;
          const otherId   = isFrom ? conn.to : conn.from;
          const otherBlk  = canvas.blocks.find(x => x.id === otherId);
          const otherDef  = otherBlk ? (this.BLOCK_DEFS[otherBlk.type] || { icon: '?', label: otherId }) : null;
          const row = document.createElement('div');
          row.style.cssText = 'display:flex;align-items:center;gap:3px;padding:2px 4px;background:var(--surf2);border-radius:3px;margin-bottom:2px';
          row.innerHTML = `<span style="color:#445566;font-size:7px">${isFrom ? '\u25B6' : '\u25C4'}</span>` +
            `<span style="font-size:7px;color:#64748b;flex:1">${otherDef ? otherDef.icon + ' ' + (otherBlk.label || otherDef.label) : otherId}</span>`;
          const delC = document.createElement('button');
          delC.style.cssText = 'padding:1px 4px;border-radius:2px;border:1px solid #ef444433;background:transparent;color:#ef444466;font-size:7px;cursor:pointer';
          delC.textContent = '\u00D7';
          delC.addEventListener('click', () => {
            canvas.connections = canvas.connections.filter(c => c.id !== conn.id);
            this._save(card); card._rebuildSidebar?.(); card._markDirty?.();
          });
          row.appendChild(delC);
          div.appendChild(row);
        });
      }
    }

    // Block löschen
    const delBtn = document.createElement('button');
    delBtn.style.cssText = 'width:100%;padding:3px;border-radius:4px;border:1px solid #ef444455;background:transparent;color:#ef444488;font-size:7.5px;cursor:pointer;margin-top:4px';
    delBtn.textContent = '\uD83D\uDDD1 Block l\u00F6schen';
    delBtn.addEventListener('click', () => {
      if (!canvas) return;
      canvas.blocks      = canvas.blocks.filter(x => x.id !== b.id);
      canvas.connections = canvas.connections.filter(c => c.from !== b.id && c.to !== b.id);
      this._selBlock = null;
      this._save(card); card._rebuildSidebar?.(); card._markDirty?.();
    });
    div.appendChild(delBtn);

    return div;
  },

  _buildPalette(card) {
    const div = document.createElement('div');
    div.style.cssText = 'display:flex;flex-direction:column;gap:4px';

    const groups = [
      { prefix: 'trigger_',  label: 'TRIGGER',     color: '#f97316' },
      { prefix: 'cond_',     label: 'BEDINGUNGEN',  color: '#38bdf8' },
      { prefix: 'action_',   label: 'AKTIONEN',     color: '#22c55e' },
      { prefix: 'special_',  label: 'SPEZIAL',      color: '#a855f7' },
    ];

    groups.forEach(grp => {
      const entries = Object.entries(this.BLOCK_DEFS).filter(([id]) => id.startsWith(grp.prefix));
      if (!entries.length) return;

      const gh = document.createElement('div');
      gh.style.cssText = `font-size:6.5px;font-weight:700;color:${grp.color};margin-top:4px`;
      gh.textContent   = grp.label;
      div.appendChild(gh);

      const grid = document.createElement('div');
      grid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:3px';
      entries.forEach(([id, def]) => {
        const btn = document.createElement('button');
        btn.style.cssText = `display:flex;align-items:center;gap:4px;padding:3px 5px;` +
          `border-radius:4px;border:1px solid ${def.color}44;background:${def.color}11;` +
          `color:${def.color};font-size:7px;cursor:pointer;text-align:left`;
        btn.innerHTML = `<span style="font-size:11px">${def.icon}</span>` +
          `<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${def.label}</span>`;
        btn.addEventListener('click', () => {
          if (!this._activeAuto) return;
          const nb = {
            id:     'b_' + Date.now(),
            type:   id,
            x:      0.25 + Math.random() * 0.5,
            y:      0.25 + Math.random() * 0.5,
            w:      this.BLOCK_W,
            h:      this.BLOCK_H,
            config: {},
            label:  '',
          };
          this._activeAuto.canvas.blocks.push(nb);
          this._selBlock = nb;
          this._save(card); card._rebuildSidebar?.(); card._markDirty?.();
        });
        grid.appendChild(btn);
      });
      div.appendChild(grid);
    });

    return div;
  },

};
