// ═══════════════════════════════════════════════════════════════════════════
// BLE Positioning – Modul: KI
// Version: 1.6.0
// Datei: /config/www/ble_positioning/modules/ki.js
// Welle 2: Anomalie-Gedächtnis · Vorausschauende Wartung · Cross-Trigger Lernen
// ═══════════════════════════════════════════════════════════════════════════

const KiModul = {
  ...BLEModuleBase,
  id:          'ki',
  name:        'KI',
  icon:        '🧠',
  tabId:       'ki',
  version:     '1.7.0',
  description: 'Solar-Scheduling · Anomalie-Gedächtnis · Wartung · Cross-Trigger · Meta-Learning',

  // ── State ─────────────────────────────────────────────────────────────────
  _kiData:           null,
  _kiLoading:        false,
  _kiError:          null,
  _kiLastLoad:       0,
  _kiEntities:       [],
  _kiSlotMin:        30,
  _kiAnimT:          0,
  _kiTab:            'muster',
  _kiMemory:         null,
  _kiWatchTimer:     null,
  _kiDailyTimer:     null,
  _kiWeeklyTimer:    null,
  _kiPendingFeedback:[],
  _kiAnomalies:      null,  // gecachte Anomalie-Analyse
  _kiMaintenance:    null,  // gecachte Wartungs-Analyse
  _kiCrossLearning:  null,  // gecachte Cross-Trigger Muster
  _notifSubscription:      null,  // HA Event-Subscription Handle
  _notifSubscriptionDaily: null,

  // ── Pflicht für base.js ───────────────────────────────────────────────────
  _getValsForSim(card) { return {}; },
  _evalCond(c, vals, card) { return this._evalCondBase(c, vals, card); },

  // ── isActive ──────────────────────────────────────────────────────────────
  isActive(card) {
    const cfg = card?._opts?.ki_cfg || {};
    return (cfg.entities || []).length > 0;
  },

  // ── draw (Canvas) ─────────────────────────────────────────────────────────
  draw(ctx, card) {
    const W = ctx.canvas.width, H = ctx.canvas.height;
    const dpr = window.devicePixelRatio || 1;
    const w = W / dpr, h = H / dpr;

    ctx.save();
    ctx.scale(dpr, dpr);

    this._kiAnimT = (this._kiAnimT || 0) + 1;

    if (this._kiLoading) {
      this._drawLoading(ctx, w, h);
    } else if (this._kiError) {
      this._drawError(ctx, w, h);
    } else if (!this._kiData) {
      this._drawEmpty(ctx, w, h);
    } else {
      this._drawDashboard(ctx, w, h, card);
    }

    ctx.restore();
  },

  // ── Dashboard (Hauptansicht) ───────────────────────────────────────────────
  _drawDashboard(ctx, w, h, card) {
    const d   = this._kiData;
    const PAD = 14;
    let y = PAD;

    // ── Situation (immer oben) ────────────────────────────────────────────
    y = this._drawSituationBlock(ctx, w, y, PAD, d.situation);
    y += 8;

    // ── Sub-Tab-Leiste ────────────────────────────────────────────────────
    y = this._drawSubTabs(ctx, w, y, PAD);
    y += 8;

    // ── Inhalt je nach Sub-Tab ────────────────────────────────────────────
    const tab = this._kiTab || 'muster';
    if (tab === 'muster') {
      const heatH = Math.min(110, Math.floor(h * 0.25));
      y = this._drawHeatmap(ctx, w, y, PAD, heatH, d.slots);
      y += 10;
      this._drawPatterns(ctx, w, y, PAD, h - y - PAD, d.patterns);
    } else if (tab === 'profile') {
      this._drawProfiles(ctx, w, y, PAD, h - y - PAD, d.profiles);
    } else if (tab === 'sequenzen') {
      this._drawSequences(ctx, w, y, PAD, h - y - PAD, d.sequences);
    } else if (tab === 'trigger') {
      const enriched = this._applyMemoryToTriggers(d.triggers || []);
      this._drawTriggersV2(ctx, w, y, PAD, h - y - PAD, enriched);
    } else if (tab === 'solar') {
      this._drawSolarSchedule(ctx, w, y, PAD, h - y - PAD, d.solar);
    } else if (tab === 'automationen') {
      this._drawAutomationGenerator(ctx, w, y, PAD, h - y - PAD, d.proposals);
    } else if (tab === 'anomalien') {
      this._drawAnomalies(ctx, w, y, PAD, h - y - PAD, d.anomalies);
    } else if (tab === 'wartung') {
      this._drawMaintenance(ctx, w, y, PAD, h - y - PAD, d.maintenance);
    } else if (tab === 'cross') {
      this._drawCrossLearning(ctx, w, y, PAD, h - y - PAD, d.crossLearning);
    } else if (tab === 'meta') {
      this._drawMetaLearning(ctx, w, y, PAD, h - y - PAD);
    } else if (tab === 'zwilling') {
      this._drawDigitalTwin(ctx, w, y, PAD, h - y - PAD, d.twin);
    } else if (tab === 'fortschritt') {
      this._drawProgress(ctx, w, y, PAD, h - y - PAD);
    }
  },

  // ── Sub-Tab-Leiste ────────────────────────────────────────────────────────
  _drawSubTabs(ctx, w, y, pad) {
    const tabs = [
      { id: 'muster',      label: 'Muster',    color: '#38bdf8' },
      { id: 'profile',     label: 'Profile',   color: '#a78bfa' },
      { id: 'sequenzen',   label: 'Sequenzen', color: '#34d399' },
      { id: 'trigger',     label: 'Trigger',   color: '#fb923c' },
      { id: 'solar',       label: 'Solar',     color: '#fbbf24' },
      { id: 'automationen',label: 'Auto',      color: '#22c55e' },
      { id: 'anomalien',   label: 'Anomalien', color: '#f43f5e' },
      { id: 'wartung',     label: 'Wartung',   color: '#e879f9' },
      { id: 'cross',       label: 'Cross',     color: '#2dd4bf' },
      { id: 'meta',        label: 'Meta',      color: '#818cf8' },
      { id: 'zwilling',    label: 'Zwilling',  color: '#f43f5e' },
      { id: 'fortschritt', label: 'Ich',       color: '#f472b6' },
    ];
    const tabW  = (w - pad * 2) / tabs.length;
    const tabH  = 20;
    const cur   = this._kiTab || 'muster';

    tabs.forEach((t, i) => {
      const tx = pad + i * tabW;
      const active = t.id === cur;
      ctx.fillStyle = active ? t.color + '22' : '#0f172a';
      this._roundRect(ctx, tx + 1, y, tabW - 2, tabH, 4);
      ctx.fill();
      if (active) {
        ctx.strokeStyle = t.color + '88';
        ctx.lineWidth = 1;
        this._roundRect(ctx, tx + 1, y, tabW - 2, tabH, 4);
        ctx.stroke();
      }
      ctx.fillStyle = active ? t.color : '#475569';
      ctx.font = active ? 'bold 8px sans-serif' : '8px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(t.label, tx + tabW / 2, y + tabH / 2);
    });

    return y + tabH;
  },

  // ── Situations-Block ──────────────────────────────────────────────────────
  _drawSituationBlock(ctx, w, y, pad, situation) {
    const bh = 64;
    const bw = w - pad * 2;

    // Hintergrund
    ctx.fillStyle = situation.color + '22';
    this._roundRect(ctx, pad, y, bw, bh, 8);
    ctx.fill();
    ctx.strokeStyle = situation.color + '88';
    ctx.lineWidth = 1;
    this._roundRect(ctx, pad, y, bw, bh, 8);
    ctx.stroke();

    // Icon
    ctx.font = '28px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(situation.icon, pad + 12, y + bh / 2);

    // Situations-Name
    ctx.fillStyle = situation.color;
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(situation.label, pad + 52, y + 22);

    // Beschreibung
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px sans-serif';
    ctx.fillText(situation.desc, pad + 52, y + 38);

    // Konfidenz
    const confW = 80;
    const confX = w - pad - confW - 8;
    const confY = y + 14;
    ctx.fillStyle = '#1e293b';
    this._roundRect(ctx, confX, confY, confW, 12, 6);
    ctx.fill();
    ctx.fillStyle = situation.color;
    this._roundRect(ctx, confX, confY, Math.round(confW * situation.confidence), 12, 6);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(Math.round(situation.confidence * 100) + '%', confX + confW / 2, confY + 6);

    // Meta
    ctx.fillStyle = '#445566';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(situation.meta, w - pad - 6, y + bh - 8);

    return y + bh;
  },

  // ── Heatmap 24h × Wochentage ──────────────────────────────────────────────
  _drawHeatmap(ctx, w, y, pad, hh, slots) {
    const days = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
    const labelW = 22;
    const slotsPerDay = 24 * (60 / this._kiSlotMin);
    const cellW = (w - pad * 2 - labelW) / slotsPerDay;
    const cellH = (hh - 16) / 7;
    const today = (new Date().getDay() + 6) % 7; // 0=Mo

    // Titel
    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('AKTIVITÄTSMUSTER – LETZTE ' + (this._kiData?.meta?.days || '?') + ' TAGE', pad, y + 9);
    y += 14;

    // Stunden-Labels (0, 6, 12, 18, 24)
    [0, 6, 12, 18, 24].forEach(h => {
      const hx = pad + labelW + h * (60 / this._kiSlotMin) * cellW;
      ctx.fillStyle = '#445566';
      ctx.font = '7px sans-serif';
      ctx.textAlign = h === 24 ? 'right' : 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(h === 24 ? '24' : h + ':00', hx, y);
    });
    y += 4;

    // Zellen
    days.forEach((dLabel, di) => {
      // Tag-Label
      const isToday = di === today;
      ctx.fillStyle = isToday ? '#38bdf8' : '#64748b';
      ctx.font = isToday ? 'bold 8px sans-serif' : '8px sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(dLabel, pad + labelW - 3, y + cellH / 2);

      // Slots
      for (let si = 0; si < slotsPerDay; si++) {
        const key = `${di}_${si}`;
        const val = slots[key] || 0; // 0..1
        const cx = pad + labelW + si * cellW;
        const cy = y;

        if (val > 0) {
          const alpha = 0.15 + val * 0.85;
          const r = Math.round(56 + val * 190);
          const g = Math.round(189 - val * 100);
          const b = Math.round(248 - val * 180);
          ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
          ctx.fillRect(cx + 0.5, cy + 0.5, Math.max(1, cellW - 1), cellH - 1);
        }
      }

      // Heute-Markierung
      if (isToday) {
        const nowSlot = this._currentSlot();
        const cx = pad + labelW + nowSlot * cellW;
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(cx, y, cellW * 1.5, cellH);
      }

      y += cellH;
    });

    // Legende
    const legX = pad + labelW;
    const legW = 60;
    const legH = 6;
    const legY = y + 3;
    const grad = ctx.createLinearGradient(legX, 0, legX + legW, 0);
    grad.addColorStop(0, 'rgba(56,189,248,0.15)');
    grad.addColorStop(1, 'rgba(246,89,68,1)');
    ctx.fillStyle = grad;
    this._roundRect(ctx, legX, legY, legW, legH, 3);
    ctx.fill();
    ctx.fillStyle = '#445566';
    ctx.font = '7px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('wenig', legX, legY + legH + 8);
    ctx.textAlign = 'right';
    ctx.fillText('viel', legX + legW, legY + legH + 8);

    return y + legH + 12;
  },

  // ── Muster-Liste ──────────────────────────────────────────────────────────
  _drawPatterns(ctx, w, y, pad, availH, patterns) {
    if (!patterns || !patterns.length) return;

    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('ERKANNTE MUSTER', pad, y + 9);
    y += 14;

    const rowH = 32;
    const maxVisible = Math.floor((availH - 14) / rowH);
    const visible = patterns.slice(0, maxVisible);

    visible.forEach((p, i) => {
      const ry = y + i * rowH;
      const bw = w - pad * 2;

      // Hintergrund
      ctx.fillStyle = i % 2 === 0 ? '#0f172a' : '#111827';
      this._roundRect(ctx, pad, ry, bw, rowH - 2, 5);
      ctx.fill();

      // Konfidenz-Bar (links)
      const barW = 3;
      ctx.fillStyle = p.color || '#38bdf8';
      this._roundRect(ctx, pad, ry, barW, rowH - 2, 2);
      ctx.fill();

      // Icon + Text
      ctx.font = '13px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(p.icon || '◆', pad + 8, ry + (rowH - 2) / 2);

      ctx.fillStyle = '#e2e8f0';
      ctx.font = 'bold 9px sans-serif';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(p.label, pad + 24, ry + 13);

      ctx.fillStyle = '#64748b';
      ctx.font = '8px sans-serif';
      ctx.fillText(p.detail, pad + 24, ry + 24);

      // Konfidenz-Balken (rechts)
      const cBarW = 70;
      const cBarX = w - pad - cBarW - 6;
      const cBarY = ry + 8;
      const cBarH = 8;

      ctx.fillStyle = '#1e293b';
      this._roundRect(ctx, cBarX, cBarY, cBarW, cBarH, 4);
      ctx.fill();
      ctx.fillStyle = p.color || '#38bdf8';
      this._roundRect(ctx, cBarX, cBarY, Math.round(cBarW * p.confidence), cBarH, 4);
      ctx.fill();

      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 7px sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(Math.round(p.confidence * 100) + '%', cBarX - 4, cBarY + cBarH / 2);

      // Anzahl Beobachtungen
      ctx.fillStyle = '#334155';
      ctx.font = '7px sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(p.observations + 'x', w - pad - 4, ry + 24);
    });
  },

  // ── Tap-Handler für Sub-Tabs ──────────────────────────────────────────────
  onTap(px, py, card) {
    if (!this._kiData) return false;
    // Sub-Tab-Bereich: y ≈ 72–92 (nach Situations-Block 64 + 8)
    const PAD  = 14;
    const tabY = 72;
    const tabH = 20;
    if (py >= tabY && py <= tabY + tabH) {
      const tabs = ['muster','profile','sequenzen','trigger','solar','automationen','anomalien','wartung','cross','meta','zwilling','fortschritt'];
      const tabW  = (card._canvas ? card._canvas.width / (window.devicePixelRatio || 1) : 300) - PAD * 2;
      const idx   = Math.floor((px - PAD) / (tabW / tabs.length));
      if (idx >= 0 && idx < tabs.length) {
        this._kiTab = tabs[idx];
        card._markDirty?.();
        return true;
      }
    }
    return false;
  },

  // ── Profile zeichnen ──────────────────────────────────────────────────────
  _drawProfiles(ctx, w, y, pad, availH, profiles) {
    if (!profiles || !profiles.length) {
      ctx.fillStyle = '#334155';
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Zu wenig Daten für Personen-Profile (min. 14 Tage)', w / 2, y + availH / 2);
      return;
    }

    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('ERKANNTE PERSONEN-PROFILE', pad, y + 9);
    y += 16;

    const PROFILE_COLORS = ['#60a5fa', '#a78bfa', '#34d399', '#fb923c', '#f472b6'];
    const colW = (w - pad * 2 - 8) / Math.min(profiles.length, 2);

    profiles.forEach((p, i) => {
      const col   = i % 2;
      const row   = Math.floor(i / 2);
      const px2   = pad + col * (colW + 8);
      const py2   = y + row * 110;
      const color = PROFILE_COLORS[i % PROFILE_COLORS.length];

      if (py2 + 100 > y + availH) return;

      // Box
      ctx.fillStyle = color + '15';
      this._roundRect(ctx, px2, py2, colW, 100, 8);
      ctx.fill();
      ctx.strokeStyle = color + '55';
      ctx.lineWidth = 1;
      this._roundRect(ctx, px2, py2, colW, 100, 8);
      ctx.stroke();

      // Name
      ctx.fillStyle = color;
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(p.label, px2 + 10, py2 + 18);

      // Typ-Badge
      const badgeText = p.isGuest ? 'Gast' : p.isRegular ? 'Bewohner' : 'Unbekannt';
      ctx.fillStyle = p.isGuest ? '#ca8a0422' : '#1d4ed822';
      this._roundRect(ctx, px2 + 10, py2 + 24, 48, 12, 3);
      ctx.fill();
      ctx.fillStyle = p.isGuest ? '#fbbf24' : '#60a5fa';
      ctx.font = '7px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(badgeText, px2 + 34, py2 + 30);

      // Merkmal-Tags
      const tags = p.traits || [];
      let tagX = px2 + 10;
      let tagY = py2 + 44;
      tags.slice(0, 4).forEach(tag => {
        const tw = ctx.measureText(tag).width + 10;
        if (tagX + tw > px2 + colW - 5) { tagX = px2 + 10; tagY += 14; }
        ctx.fillStyle = '#1e293b';
        this._roundRect(ctx, tagX, tagY, tw, 11, 3);
        ctx.fill();
        ctx.fillStyle = '#94a3b8';
        ctx.font = '7px sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(tag, tagX + 5, tagY + 5.5);
        tagX += tw + 4;
      });

      // Aktivste Zeit
      ctx.fillStyle = '#445566';
      ctx.font = '8px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(`Aktiv: ${p.peakTime || '–'}`, px2 + 10, py2 + 90);

      // Beobachtungen
      ctx.fillStyle = '#334155';
      ctx.font = '7px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`${p.days} Tage`, px2 + colW - 8, py2 + 90);
    });
  },

  // ── Sequenzen zeichnen ────────────────────────────────────────────────────
  _drawSequences(ctx, w, y, pad, availH, sequences) {
    if (!sequences || !sequences.length) {
      ctx.fillStyle = '#334155';
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Keine Sequenzen erkannt (min. 7 Tage + 5 Wiederholungen)', w / 2, y + availH / 2);
      return;
    }

    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('ERKANNTE SEQUENZEN  ("A dann immer B")', pad, y + 9);
    y += 16;

    const rowH  = 38;
    const maxV  = Math.floor(availH / rowH);

    sequences.slice(0, maxV).forEach((seq, i) => {
      const ry = y + i * rowH;
      const bw = w - pad * 2;

      ctx.fillStyle = '#0f172a';
      this._roundRect(ctx, pad, ry, bw, rowH - 3, 5);
      ctx.fill();
      ctx.strokeStyle = '#34d39944';
      ctx.lineWidth = 1;
      this._roundRect(ctx, pad, ry, bw, rowH - 3, 5);
      ctx.stroke();

      // Sequenz-Kette
      const stepW = Math.min(120, (bw - 80) / seq.steps.length);
      seq.steps.forEach((step, si) => {
        const sx = pad + 8 + si * (stepW + 16);
        const sy = ry + 8;

        ctx.fillStyle = '#1e293b';
        this._roundRect(ctx, sx, sy, stepW, 16, 3);
        ctx.fill();
        ctx.fillStyle = '#cbd5e1';
        ctx.font = '7.5px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const label = step.replace(/^[a-z_]+\./, '').replace(/_/g, ' ').substring(0, 14);
        ctx.fillText(label, sx + stepW / 2, sy + 8);

        if (si < seq.steps.length - 1) {
          ctx.fillStyle = '#34d399';
          ctx.font = 'bold 10px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('→', sx + stepW + 8, sy + 8);
        }
      });

      // Delay + Konfidenz
      ctx.fillStyle = '#475569';
      ctx.font = '7px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(`Ø ${seq.avgDelaySec}s Abstand · ${seq.observations}x`, pad + 8, ry + rowH - 8);

      const cBarW = 55;
      const cBarX = w - pad - cBarW - 6;
      ctx.fillStyle = '#1e293b';
      this._roundRect(ctx, cBarX, ry + 8, cBarW, 8, 4);
      ctx.fill();
      ctx.fillStyle = '#34d399';
      this._roundRect(ctx, cBarX, ry + 8, Math.round(cBarW * seq.confidence), 8, 4);
      ctx.fill();
      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 7px sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(Math.round(seq.confidence * 100) + '%', cBarX - 4, ry + 12);
    });
  },

  // ── Trigger-Empfehlungen zeichnen ─────────────────────────────────────────
  _drawTriggers(ctx, w, y, pad, availH, triggers) {
    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('TRIGGER-EMPFEHLUNGEN (nur Beobachter-Stufe)', pad, y + 9);
    y += 16;

    if (!triggers || !triggers.length) {
      ctx.fillStyle = '#334155';
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Keine Trigger-Entities konfiguriert', w / 2, y + availH / 2 - 10);
      ctx.fillStyle = '#1e3a5f';
      ctx.font = '8px sans-serif';
      ctx.fillText('Smart Irrigation, Pool, Mähroboter in Sidebar eintragen', w / 2, y + availH / 2 + 8);
      return;
    }

    const rowH = 48;
    triggers.forEach((t, i) => {
      const ry  = y + i * rowH;
      const bw  = w - pad * 2;
      if (ry + rowH > y + availH) return;

      const statusColor = t.recommended ? '#22c55e' : '#ef4444';
      const statusIcon  = t.recommended ? '✅' : '⏸';

      ctx.fillStyle = t.recommended ? '#0c2a1a' : '#1a0c0c';
      this._roundRect(ctx, pad, ry, bw, rowH - 4, 6);
      ctx.fill();
      ctx.strokeStyle = statusColor + '44';
      ctx.lineWidth = 1;
      this._roundRect(ctx, pad, ry, bw, rowH - 4, 6);
      ctx.stroke();

      // Status-Streifen links
      ctx.fillStyle = statusColor;
      this._roundRect(ctx, pad, ry, 3, rowH - 4, 2);
      ctx.fill();

      // Icon + Name
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(t.icon, pad + 10, ry + 14);

      ctx.fillStyle = '#e2e8f0';
      ctx.font = 'bold 9px sans-serif';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(t.label, pad + 28, ry + 16);

      // Begründung
      ctx.fillStyle = '#64748b';
      ctx.font = '8px sans-serif';
      ctx.fillText(t.reason, pad + 28, ry + 28);

      // Blockiert durch
      if (t.blockedBy) {
        ctx.fillStyle = '#7f1d1d';
        this._roundRect(ctx, pad + 28, ry + 30, ctx.measureText('⛔ ' + t.blockedBy).width + 8, 11, 3);
        ctx.fill();
        ctx.fillStyle = '#fca5a5';
        ctx.font = '7px sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText('⛔ ' + t.blockedBy, pad + 32, ry + 35.5);
      }

      // Status rechts
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(statusIcon, w - pad - 8, ry + 20);

      ctx.fillStyle = statusColor;
      ctx.font = 'bold 7px sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(t.recommended ? 'JETZT OK' : 'WARTEN', w - pad - 8, ry + 34);
    });
  },

  // ── Hilfsgrafiken ─────────────────────────────────────────────────────────
  _drawLoading(ctx, w, h) {
    const t = this._kiAnimT;
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const dots = '.'.repeat((Math.floor(t / 20) % 3) + 1);
    ctx.fillText('🧠 Analysiere Verlauf' + dots, w / 2, h / 2 - 10);
    ctx.fillStyle = '#445566';
    ctx.font = '9px sans-serif';
    ctx.fillText(this._kiLoadMsg || 'Lade HA History API…', w / 2, h / 2 + 10);
  },

  _drawError(ctx, w, h) {
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#ef4444';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⚠ ' + (this._kiError || 'Fehler'), w / 2, h / 2);
  },

  _drawEmpty(ctx, w, h) {
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#334155';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🧠 Entities in der Sidebar konfigurieren', w / 2, h / 2 - 8);
    ctx.fillStyle = '#1e3a5f';
    ctx.font = '9px sans-serif';
    ctx.fillText('motion · light · door/window · switch', w / 2, h / 2 + 10);
  },

  _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  },

  // ── Sidebar-Hilfsmethoden (eigenständig, kein Card-Aufruf nötig) ──────────
  _mkField(label, value, onChange) {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;flex-direction:column;gap:2px;margin-bottom:4px';
    const lbl = document.createElement('div');
    lbl.style.cssText = 'font-size:7.5px;color:#64748b';
    lbl.textContent = label;
    const inp = document.createElement('input');
    inp.type = 'text';
    inp.value = value ?? '';
    inp.style.cssText = 'background:#1e293b;border:1px solid #334155;border-radius:4px;color:#cbd5e1;font-size:8px;padding:3px 6px;width:100%;box-sizing:border-box';
    inp.onchange = () => onChange(inp.value);
    wrap.appendChild(lbl);
    wrap.appendChild(inp);
    return wrap;
  },

  _mkEntityPicker(label, value, domains, onChange, card) {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;flex-direction:column;gap:2px;margin-bottom:4px';
    const lbl = document.createElement('div');
    lbl.style.cssText = 'font-size:7.5px;color:#64748b';
    lbl.textContent = label;

    const inp = document.createElement('input');
    inp.type = 'text';
    inp.value = value ?? '';
    inp.placeholder = 'entity_id eingeben…';
    inp.style.cssText = 'background:#1e293b;border:1px solid #334155;border-radius:4px;color:#cbd5e1;font-size:8px;padding:3px 6px;width:100%;box-sizing:border-box';

    // Autocomplete aus HA States
    const datalist = document.createElement('datalist');
    datalist.id = 'ki_entity_list_' + Math.random().toString(36).slice(2);
    const hass = card?._hass;
    if (hass?.states) {
      Object.keys(hass.states)
        .filter(id => !domains || domains.some(d => id.startsWith(d + '.')))
        .slice(0, 100)
        .forEach(id => {
          const opt = document.createElement('option');
          opt.value = id;
          datalist.appendChild(opt);
        });
    }
    inp.setAttribute('list', datalist.id);
    inp.onchange = () => onChange(inp.value.trim());

    wrap.appendChild(lbl);
    wrap.appendChild(inp);
    wrap.appendChild(datalist);
    return wrap;
  },

  // ── Sidebar ───────────────────────────────────────────────────────────────
  renderSidebar(card) {
    const cfg = card._opts.ki_cfg || (card._opts.ki_cfg = {});
    if (!cfg.entities) cfg.entities = [];

    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;flex-direction:column;gap:0;height:100%;overflow:hidden';

    // Header
    const hdr = document.createElement('div');
    hdr.style.cssText = 'padding:8px 10px 6px;border-bottom:1px solid var(--border);flex-shrink:0';
    hdr.innerHTML = `
      <div style="font-size:10px;font-weight:700;color:#94a3b8;letter-spacing:1px;margin-bottom:3px">🧠 KI-SYSTEM</div>
      <div style="font-size:8px;color:#445566">Stufe 1 · Browser · HA History API</div>
    `;
    wrap.appendChild(hdr);

    // Scroll-Bereich
    const scroll = document.createElement('div');
    scroll.style.cssText = 'flex:1;overflow-y:auto;padding:8px 10px';

    // ── Status ──────────────────────────────────────────────────────────
    const statusBox = document.createElement('div');
    statusBox.style.cssText = 'background:var(--surf2);border-radius:6px;padding:8px;margin-bottom:8px;border:1px solid var(--border)';
    if (this._kiData) {
      const m = this._kiData.meta;
      statusBox.innerHTML = `
        <div style="font-size:8px;font-weight:700;color:#22c55e;margin-bottom:4px">✅ Analyse bereit</div>
        <div style="font-size:7.5px;color:#64748b">${m.days} Tage · ${m.events} Events · ${m.patterns} Muster · ${this._kiSlotMin}-Min-Slots</div>
        <div style="font-size:7px;color:#334155;margin-top:2px">Geladen: ${new Date(this._kiLastLoad).toLocaleTimeString('de-DE')}</div>
      `;
    } else if (this._kiLoading) {
      statusBox.innerHTML = `<div style="font-size:8px;color:#f59e0b">⏳ ${this._kiLoadMsg || 'Lade…'}</div>`;
    } else {
      statusBox.innerHTML = `<div style="font-size:8px;color:#445566">⬜ Noch keine Analyse</div>`;
    }
    scroll.appendChild(statusBox);

    // ── Entities konfigurieren ───────────────────────────────────────────
    const entHdr = document.createElement('div');
    entHdr.style.cssText = 'font-size:8px;font-weight:700;color:#94a3b8;margin-bottom:5px;letter-spacing:0.5px';
    entHdr.textContent = 'ZU BEOBACHTENDE ENTITIES';
    scroll.appendChild(entHdr);

    // Entity-Liste
    const entList = document.createElement('div');
    entList.style.cssText = 'display:flex;flex-direction:column;gap:3px;margin-bottom:6px';
    cfg.entities.forEach((eid, i) => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:4px;background:var(--surf2);border-radius:4px;padding:4px 6px;border:1px solid var(--border)';
      const icon = this._entityIcon(eid);
      row.innerHTML = `<span style="font-size:10px">${icon}</span><span style="flex:1;font-size:7.5px;color:#cbd5e1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${eid}</span>`;
      const del = document.createElement('button');
      del.style.cssText = 'background:none;border:none;color:#ef4444;cursor:pointer;font-size:10px;padding:0;line-height:1';
      del.textContent = '×';
      del.onclick = () => {
        cfg.entities.splice(i, 1);
        this._save(card);
        card._rebuildSidebar?.();
      };
      row.appendChild(del);
      entList.appendChild(row);
    });
    scroll.appendChild(entList);

    // Entity hinzufügen
    scroll.appendChild(this._mkEntityPicker(
      '+ Entity hinzufügen',
      '',
      ['binary_sensor', 'light', 'switch', 'input_boolean', 'sensor'],
      v => {
        if (v && !cfg.entities.includes(v)) {
          cfg.entities.push(v);
          this._save(card);
          card._rebuildSidebar?.();
        }
      },
      card
    ));

    // ── Trigger-Konfiguration ─────────────────────────────────────────────
    const trgHdr = document.createElement('div');
    trgHdr.style.cssText = 'font-size:8px;font-weight:700;color:#94a3b8;margin:10px 0 5px;letter-spacing:0.5px';
    trgHdr.textContent = 'TRIGGER-ENTITIES (optional)';
    scroll.appendChild(trgHdr);

    const triggerFields = [
      { key: 'irrigation_entity',    label: '💧 Smart Irrigation Bucket', domain: 'sensor'      },
      { key: 'weather_entity',       label: '🌤 Wetter (Regenvorhersage)', domain: 'weather'     },
      { key: 'solar_entity',         label: '☀ Solar-Leistung (W)',        domain: 'sensor'      },
      { key: 'solar_today_entity',   label: '☀ Solar heute gesamt (kWh)', domain: 'sensor'      },
      { key: 'battery_entity',       label: '🔋 Akku-Ladestand (SOC %)',   domain: 'sensor'      },
      { key: 'battery_power_entity', label: '🔋 Akku-Leistung (W)',        domain: 'sensor'      },
      { key: 'grid_import_entity',   label: '🔌 Landstrom heute (kWh)',    domain: 'sensor'      },
      { key: 'tariff_entity',        label: '💰 Stromtarif (€/kWh)',       domain: 'sensor'      },
      { key: 'mower_entity',         label: '🌿 Mähroboter',               domain: 'lawn_mower'  },
    ];

    triggerFields.forEach(f => {
      scroll.appendChild(this._mkEntityPicker(
        f.label,
        cfg.triggers?.[f.key] || '',
        [f.domain, 'sensor', 'input_number'],
        v => {
          if (!cfg.triggers) cfg.triggers = {};
          cfg.triggers[f.key] = v;
          this._save(card);
        },
        card
      ));
    });

    // Schwellwert Irrigation
    if (cfg.triggers?.irrigation_entity) {
      scroll.appendChild(this._mkField(
        '💧 Gieß-Schwellwert (mm)',
        cfg.triggers?.irrigation_threshold || 5,
        v => { if (!cfg.triggers) cfg.triggers = {}; cfg.triggers.irrigation_threshold = parseFloat(v) || 5; this._save(card); }
      ));
      scroll.appendChild(this._mkField(
        '💧 Verbrauch Bewässerung (W)',
        cfg.triggers?.irrigation_power_w || 150,
        v => { if (!cfg.triggers) cfg.triggers = {}; cfg.triggers.irrigation_power_w = parseFloat(v) || 150; this._save(card); }
      ));
      scroll.appendChild(this._mkField(
        '💧 Priorität Bewässerung (1=hoch)',
        cfg.triggers?.irrigation_priority || 2,
        v => { if (!cfg.triggers) cfg.triggers = {}; cfg.triggers.irrigation_priority = parseInt(v) || 2; this._save(card); }
      ));
    }
    if (cfg.triggers?.solar_entity) {
      scroll.appendChild(this._mkField(
        '☀ Pool-Solar-Minimum (W)',
        cfg.triggers?.pool_solar_min || 300,
        v => { if (!cfg.triggers) cfg.triggers = {}; cfg.triggers.pool_solar_min = parseFloat(v) || 300; this._save(card); }
      ));
      scroll.appendChild(this._mkField(
        '🏊 Verbrauch Pool-Pumpe (W)',
        cfg.triggers?.pool_power_w || 400,
        v => { if (!cfg.triggers) cfg.triggers = {}; cfg.triggers.pool_power_w = parseFloat(v) || 400; this._save(card); }
      ));
      scroll.appendChild(this._mkField(
        '🏊 Priorität Pool (1=hoch)',
        cfg.triggers?.pool_priority || 1,
        v => { if (!cfg.triggers) cfg.triggers = {}; cfg.triggers.pool_priority = parseInt(v) || 1; this._save(card); }
      ));
    }
    if (cfg.triggers?.mower_entity) {
      scroll.appendChild(this._mkField(
        '🌿 Verbrauch Mähroboter (W)',
        cfg.triggers?.mower_power_w || 80,
        v => { if (!cfg.triggers) cfg.triggers = {}; cfg.triggers.mower_power_w = parseFloat(v) || 80; this._save(card); }
      ));
      scroll.appendChild(this._mkField(
        '🌿 Priorität Mähroboter (1=hoch)',
        cfg.triggers?.mower_priority || 3,
        v => { if (!cfg.triggers) cfg.triggers = {}; cfg.triggers.mower_priority = parseInt(v) || 3; this._save(card); }
      ));
    }

    // ── Solar-Saison ─────────────────────────────────────────────────────
    const seasonHdr = document.createElement('div');
    seasonHdr.style.cssText = 'font-size:8px;font-weight:700;color:#94a3b8;margin:8px 0 5px;letter-spacing:0.5px';
    seasonHdr.textContent = '☀ SOLAR-SAISON & KOSTEN';
    scroll.appendChild(seasonHdr);

    scroll.appendChild(this._mkField(
      'Solar-Saison Start (Monat)',
      cfg.solar_season_start || 3,
      v => { cfg.solar_season_start = parseInt(v) || 3; this._save(card); }
    ));
    scroll.appendChild(this._mkField(
      'Solar-Saison Ende (Monat)',
      cfg.solar_season_end || 12,
      v => { cfg.solar_season_end = parseInt(v) || 12; this._save(card); }
    ));
    scroll.appendChild(this._mkField(
      '🔋 Akku-Kapazität (Wh)',
      cfg.battery_capacity_wh || 1000,
      v => { cfg.battery_capacity_wh = parseFloat(v) || 1000; this._save(card); }
    ));
    scroll.appendChild(this._mkField(
      '💰 Landstrom-Preis (€/kWh)',
      cfg.grid_price_per_kwh || 0.30,
      v => { cfg.grid_price_per_kwh = parseFloat(v) || 0.30; this._save(card); }
    ));

    // ── Analyse-Button ────────────────────────────────────────────────────
    const analyseBtn = document.createElement('button');
    analyseBtn.style.cssText = `
      width:100%;padding:7px;border-radius:6px;border:none;
      background:${this._kiLoading ? '#1e293b' : '#0ea5e9'};
      color:${this._kiLoading ? '#445566' : '#fff'};
      font-size:9px;font-weight:700;cursor:${this._kiLoading ? 'default' : 'pointer'};
      margin-top:8px;margin-bottom:6px;
    `;
    analyseBtn.textContent = this._kiLoading ? '⏳ Analysiere…' : '🧠 Jetzt analysieren';
    analyseBtn.disabled = this._kiLoading;
    analyseBtn.onclick = () => {
      if (!this._kiLoading && cfg.entities.length > 0) {
        this._startAnalysis(card);
      } else if (cfg.entities.length === 0) {
        card._showToast?.('⚠ Bitte zuerst Entities hinzufügen');
      }
    };
    scroll.appendChild(analyseBtn);

    // ── Optionen ──────────────────────────────────────────────────────────
    const optHdr = document.createElement('div');
    optHdr.style.cssText = 'font-size:8px;font-weight:700;color:#94a3b8;margin-bottom:5px;margin-top:4px;letter-spacing:0.5px';
    optHdr.textContent = 'OPTIONEN';
    scroll.appendChild(optHdr);

    // Min-Konfidenz-Schwellwert
    scroll.appendChild(this._mkField(
      'Min. Konfidenz (%)',
      cfg.min_confidence != null ? cfg.min_confidence : 40,
      v => { cfg.min_confidence = parseInt(v) || 40; this._save(card); }
    ));

    // Min. Beobachtungen
    scroll.appendChild(this._mkField(
      'Min. Beobachtungen',
      cfg.min_observations != null ? cfg.min_observations : 3,
      v => { cfg.min_observations = parseInt(v) || 3; this._save(card); }
    ));

    // Auto-Refresh Checkbox
    const autoRow = document.createElement('div');
    autoRow.style.cssText = 'display:flex;align-items:center;gap:6px;margin-top:5px';
    const autoCb = document.createElement('input');
    autoCb.type = 'checkbox';
    autoCb.checked = cfg.auto_refresh || false;
    autoCb.style.cssText = 'accent-color:#0ea5e9';
    autoCb.onchange = () => { cfg.auto_refresh = autoCb.checked; this._save(card); };
    const autoLbl = document.createElement('label');
    autoLbl.style.cssText = 'font-size:8px;color:#94a3b8;cursor:pointer';
    autoLbl.textContent = 'Auto-Analyse beim Tab-Wechsel';
    autoRow.appendChild(autoCb);
    autoRow.appendChild(autoLbl);
    scroll.appendChild(autoRow);

    // ── Erkannte Situation ────────────────────────────────────────────────
    if (this._kiData?.situation) {
      const s = this._kiData.situation;
      const sitBox = document.createElement('div');
      sitBox.style.cssText = `background:${s.color}18;border:1px solid ${s.color}44;border-radius:6px;padding:8px;margin-top:10px`;
      sitBox.innerHTML = `
        <div style="font-size:8px;font-weight:700;color:${s.color};margin-bottom:3px">${s.icon} AKTUELLE SITUATION</div>
        <div style="font-size:11px;font-weight:700;color:#e2e8f0">${s.label}</div>
        <div style="font-size:8px;color:#64748b;margin-top:2px">${s.desc}</div>
        <div style="font-size:7px;color:#334155;margin-top:4px">${s.meta}</div>
      `;
      scroll.appendChild(sitBox);
    }

    // ── Automations-Vorschläge ────────────────────────────────────────────
    if (this._kiData?.proposals?.length) {
      this._buildAutomationSidebarSection(scroll, this._kiData.proposals, card);
    }

    // ── Fortschritt + Benachrichtigungen ──────────────────────────────────
    this._buildProgressSidebarSection(scroll, card);

    // ── Trigger-Steuerung ─────────────────────────────────────────────────
    if (this._kiData?.triggers?.length) {
      const enriched = this._applyMemoryToTriggers(this._kiData.triggers);
      this._buildTriggerSidebarSection(scroll, enriched, card);
    }

    wrap.appendChild(scroll);
    return wrap;
  },

  // ── Analyse starten ───────────────────────────────────────────────────────
  async _startAnalysis(card) {
    const cfg = card._opts?.ki_cfg || {};
    const entities = cfg.entities || [];
    if (!entities.length || this._kiLoading) return;

    this._kiLoading = true;
    this._kiError = null;
    this._kiLoadMsg = 'Verbinde mit HA…';
    card._rebuildSidebar?.();
    card._markDirty?.();

    try {
      const token = card._hass?.auth?.data?.access_token
        || card._hass?.connection?.options?.auth?.data?.access_token
        || card._hass?._conn?.options?.auth?.data?.access_token;

      if (!token) throw new Error('Kein HA-Token gefunden');

      const haUrl = window.location.origin;

      // ── History laden ─────────────────────────────────────────────────
      this._kiLoadMsg = `Lade History (${entities.length} Entities)…`;
      card._markDirty?.();

      // Kein start_time → HA liefert max. verfügbare History
      const url = `${haUrl}/api/history/period?filter_entity_id=${entities.join(',')}&significant_changes_only=true&minimal_response=true`;

      const resp = await fetch(url, {
        headers: { Authorization: 'Bearer ' + token }
      });
      if (!resp.ok) throw new Error(`HA API Fehler: ${resp.status}`);

      const raw = await resp.json();

      this._kiLoadMsg = 'Verarbeite Events…';
      card._markDirty?.();

      // Live-Daten für Trigger laden (Solar, Regen, Mähroboter, Akku, Tarif)
      await this._fetchLiveData(card, cfg);

      const result = this._processHistory(raw, cfg);
      this._kiData = result;
      this._kiLastLoad = Date.now();

      card._showToast?.(`🧠 ${result.meta.patterns} Muster · ${result.profiles?.length || 0} Profile · ${result.sequences?.length || 0} Sequenzen`);

    } catch (e) {
      this._kiError = e.message;
      card._showToast?.('❌ KI: ' + e.message);
    } finally {
      this._kiLoading = false;
      card._rebuildSidebar?.();
      card._markDirty?.();
    }
  },

  // ── History verarbeiten ───────────────────────────────────────────────────
  _processHistory(raw, cfg) {
    const minConf   = (cfg.min_confidence  || 40) / 100;
    const minObs    = cfg.min_observations || 3;

    // Alle Events flachklopfen
    const events = [];
    raw.forEach(entityHistory => {
      entityHistory.forEach(state => {
        const ts = new Date(state.last_changed || state.lu * 1000 || 0).getTime();
        if (!ts) return;
        events.push({ entity: state.entity_id, state: state.state, ts });
      });
    });

    if (!events.length) return this._emptyResult();

    events.sort((a, b) => a.ts - b.ts);

    const firstTs  = events[0].ts;
    const lastTs   = events[events.length - 1].ts;
    const spanDays = (lastTs - firstTs) / 86400000;

    // Adaptives Raster
    this._kiSlotMin = spanDays < 7 ? 60 : spanDays < 30 ? 30 : 15;
    const slotsPerDay = Math.floor(24 * 60 / this._kiSlotMin);
    const totalDays   = Math.ceil(spanDays) || 1;

    // ── Slot-Matrix aufbauen ──────────────────────────────────────────────
    // Key: "weekday_slotIndex" → count
    const slotCount  = {}; // Anzahl Events pro Slot
    const daySlots   = {}; // Anzahl Tage mit Aktivität in diesem Slot

    events.forEach(ev => {
      if (!this._isActiveState(ev.state)) return;
      const d = new Date(ev.ts);
      const weekday = (d.getDay() + 6) % 7; // 0=Mo
      const slotIdx = Math.floor((d.getHours() * 60 + d.getMinutes()) / this._kiSlotMin);
      const key = `${weekday}_${slotIdx}`;
      slotCount[key] = (slotCount[key] || 0) + 1;
    });

    // Normalisieren: pro Slot, pro Wochentag, durch Anzahl dieser Wochentage in Zeitraum
    const weekdayCounts = Array(7).fill(0);
    for (let d = 0; d < totalDays; d++) {
      const wd = (new Date(firstTs + d * 86400000).getDay() + 6) % 7;
      weekdayCounts[wd]++;
    }

    const slots = {};
    let maxVal = 0;
    Object.entries(slotCount).forEach(([key, cnt]) => {
      const [wd] = key.split('_').map(Number);
      const norm = cnt / Math.max(1, weekdayCounts[wd]);
      slots[key] = norm;
      if (norm > maxVal) maxVal = norm;
    });

    // Auf 0..1 skalieren
    if (maxVal > 0) {
      Object.keys(slots).forEach(k => { slots[k] /= maxVal; });
    }

    // ── Muster erkennen ───────────────────────────────────────────────────
    const patterns = this._detectPatterns(events, slotCount, weekdayCounts, totalDays, minConf, minObs);

    // ── Aktuelle Situation ────────────────────────────────────────────────
    const situation = this._detectSituation(events, slotCount, weekdayCounts, totalDays);

    // ── Personen-Profile (v1.1) ───────────────────────────────────────────
    const profiles = spanDays >= 14 ? this._detectProfiles(events, totalDays) : [];

    // ── Sequenzen (v1.1) ──────────────────────────────────────────────────
    const sequences = spanDays >= 7 ? this._detectSequences(events, minObs) : [];

    // ── Trigger-Empfehlungen (v1.1) ───────────────────────────────────────
    const triggers = this._evaluateTriggers(situation, cfg);

    // ── Digitaler Zwilling (v1.4) ─────────────────────────────────────────
    const twin = this._buildDigitalTwin(events, slotCount, weekdayCounts, cfg);

    // ── Solar-Schedule (v1.5) ─────────────────────────────────────────────
    const solar = this._buildSolarSchedule(triggers, cfg);

    // ── Welle 2: Anomalie-Gedächtnis ──────────────────────────────────────
    const anomalies = this._detectAndStoreAnomalies(events, slotCount, weekdayCounts, totalDays);

    // ── Welle 2: Vorausschauende Wartung ──────────────────────────────────
    const maintenance = this._buildMaintenanceInsights(events, cfg);

    // ── Welle 2: Cross-Trigger Lernen ─────────────────────────────────────
    const crossLearning = this._buildCrossLearning();

    // ── Automations-Vorschläge ────────────────────────────────────────────
    const proposals = this._generateAutomationProposals(patterns, sequences, cfg);

    return {
      slots,
      patterns,
      situation,
      profiles,
      sequences,
      triggers,
      twin,
      solar,
      anomalies,
      maintenance,
      crossLearning,
      proposals,
      _events: events,  // für spätere Berechnungen gespeichert
      meta: {
        days:     Math.round(spanDays),
        events:   events.length,
        patterns: patterns.length,
        slotMin:  this._kiSlotMin,
      }
    };
  },

  // ── Muster-Algorithmus ────────────────────────────────────────────────────
  _detectPatterns(events, slotCount, weekdayCounts, totalDays, minConf, minObs) {
    const patterns = [];
    const DAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
    const slotsPerDay = Math.floor(24 * 60 / this._kiSlotMin);

    // ── 1. Regelmäßige Zeitfenster (gleicher Slot, gleicher Wochentag) ────
    const strongSlots = [];
    Object.entries(slotCount).forEach(([key, cnt]) => {
      const [wd, si] = key.split('_').map(Number);
      const possible  = weekdayCounts[wd];
      if (possible < minObs) return;
      const conf = cnt / possible;
      if (conf >= minConf) {
        strongSlots.push({ wd, si, cnt, conf, possible });
      }
    });

    // ── 2. Konsekutive Slots gruppieren (Aktivitätsfenster) ───────────────
    strongSlots.sort((a, b) => a.wd !== b.wd ? a.wd - b.wd : a.si - b.si);

    const groups = [];
    strongSlots.forEach(s => {
      const last = groups[groups.length - 1];
      if (last && last.wd === s.wd && s.si - last.endSi <= 2) {
        last.endSi  = s.si;
        last.conf   = Math.max(last.conf, s.conf);
        last.cnt   += s.cnt;
        last.slots.push(s);
      } else {
        groups.push({ wd: s.wd, startSi: s.si, endSi: s.si, conf: s.conf, cnt: s.cnt, slots: [s] });
      }
    });

    // ── 3. Gruppen → Muster ───────────────────────────────────────────────
    groups.forEach(g => {
      const startTime = this._slotToTime(g.startSi);
      const endTime   = this._slotToTime(g.endSi + 1);
      const situation = this._classifyTimeSlot(g.startSi);
      const isWeekend = g.wd >= 5;
      const isWeekday = g.wd < 5;

      // Ähnliche Gruppen über mehrere Wochentage zusammenfassen
      const similar = groups.filter(gg =>
        gg !== g &&
        Math.abs(gg.startSi - g.startSi) <= 3 &&
        Math.abs(gg.endSi - g.endSi) <= 3 &&
        ((isWeekday && gg.wd < 5) || (isWeekend && gg.wd >= 5))
      );

      // Duplikate vermeiden
      if (similar.length > 0 && similar[0].wd < g.wd) return;

      const allDays = [g, ...similar].map(gg => gg.wd);
      const dayLabel = this._formatDays(allDays);
      const avgConf  = ([g, ...similar].reduce((s, gg) => s + gg.conf, 0)) / (similar.length + 1);
      const totalObs = Math.round(([g, ...similar].reduce((s, gg) => s + gg.cnt, 0)) / (similar.length + 1));

      patterns.push({
        label:        `${dayLabel} ${startTime}–${endTime}`,
        detail:       `${situation.label} · ${this._peakEntities(events, g.wd, g.startSi, g.endSi)}`,
        icon:         situation.icon,
        color:        situation.color,
        confidence:   Math.min(0.99, avgConf),
        observations: totalObs,
        // Rohdaten für Automations-Generator
        _raw: {
          days:       allDays,          // [0,1,2,3,4] = Werktags
          startSi:    g.startSi,        // Slot-Index Start
          endSi:      g.endSi,          // Slot-Index Ende
          startTime,                    // "07:15"
          endTime,                      // "08:30"
          entities:   this._peakEntitiesRaw(events, g.wd, g.startSi, g.endSi),
          situation:  situation.label,
        },
      });
    });

    // Sortieren nach Konfidenz
    patterns.sort((a, b) => b.confidence - a.confidence);
    return patterns.slice(0, 12);
  },

  // ── Aktuelle Situation erkennen ───────────────────────────────────────────
  _detectSituation(events, slotCount, weekdayCounts, totalDays) {
    const now     = new Date();
    const wd      = (now.getDay() + 6) % 7;
    const slotIdx = Math.floor((now.getHours() * 60 + now.getMinutes()) / this._kiSlotMin);
    const key     = `${wd}_${slotIdx}`;
    const DAYS    = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

    // Wie aktiv ist dieser Slot normalerweise?
    const cnt  = slotCount[key] || 0;
    const norm = cnt / Math.max(1, weekdayCounts[wd]);

    // Letzte Events der letzten 30 Min prüfen
    const recentCutoff = Date.now() - 30 * 60 * 1000;
    const recentEvents = events.filter(e => e.ts > recentCutoff && this._isActiveState(e.state));

    const sit = this._classifyTimeSlot(slotIdx);

    // Anwesend oder weg?
    const awaySlots = [];
    for (let s = slotIdx - 8; s <= slotIdx; s++) {
      const k = `${wd}_${Math.max(0, s)}`;
      awaySlots.push(slotCount[k] || 0);
    }
    const recentActivity = awaySlots.reduce((a, b) => a + b, 0);
    const isLikelyAway   = recentActivity === 0 && recentEvents.length === 0;

    if (isLikelyAway && now.getHours() >= 8 && now.getHours() < 22) {
      return {
        label:      'Nicht zu Hause',
        icon:       '🚶',
        color:      '#f59e0b',
        desc:       'Seit längerer Zeit keine Aktivität erkannt',
        confidence: 0.7,
        meta:       `${DAYS[wd]} · ${now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`
      };
    }

    const confFromHistory = Math.min(0.95, 0.4 + norm * 0.55);

    return {
      label:      sit.label,
      icon:       sit.icon,
      color:      sit.color,
      desc:       norm > 0.6
        ? `Typische Zeit für ${sit.label.toLowerCase()} · hohe Aktivität erwartet`
        : norm > 0.2
        ? `Gelegentliche Aktivität zu dieser Zeit`
        : `Normalerweise ruhige Zeit`,
      confidence: confFromHistory,
      meta:       `${DAYS[wd]} · ${now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} · Slot-Aktivität: ${Math.round(norm * 100)}%`
    };
  },

  // ── Zeitklassifizierung ───────────────────────────────────────────────────
  _classifyTimeSlot(slotIdx) {
    const hour = Math.floor(slotIdx * this._kiSlotMin / 60);

    if (hour >= 5  && hour < 9)  return { label: 'Morgenroutine', icon: '🌅', color: '#f59e0b' };
    if (hour >= 9  && hour < 12) return { label: 'Vormittag',     icon: '☀️', color: '#22c55e' };
    if (hour >= 12 && hour < 14) return { label: 'Mittagszeit',   icon: '🍽',  color: '#06b6d4' };
    if (hour >= 14 && hour < 17) return { label: 'Nachmittag',    icon: '🌤',  color: '#38bdf8' };
    if (hour >= 17 && hour < 20) return { label: 'Abendessen',    icon: '🍳',  color: '#f97316' };
    if (hour >= 20 && hour < 23) return { label: 'Abend',         icon: '🌙',  color: '#8b5cf6' };
    return { label: 'Nacht', icon: '😴', color: '#334155' };
  },

  // ── Häufigste Entities roh (für Generator) ───────────────────────────────
  _peakEntitiesRaw(events, wd, startSi, endSi) {
    const counter = {};
    const startMin = startSi * this._kiSlotMin;
    const endMin   = (endSi + 1) * this._kiSlotMin;

    events.forEach(ev => {
      if (!this._isActiveState(ev.state)) return;
      const d     = new Date(ev.ts);
      const evWd  = (d.getDay() + 6) % 7;
      const evMin = d.getHours() * 60 + d.getMinutes();
      if (evWd === wd && evMin >= startMin && evMin < endMin) {
        counter[ev.entity] = (counter[ev.entity] || 0) + 1;
      }
    });

    return Object.entries(counter)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([entity, count]) => ({ entity, count, domain: entity.split('.')[0] }));
  },

  // ══════════════════════════════════════════════════════════════════════════
  // AUTOMATIONS-GENERATOR
  // Aus erkannten Mustern + Sequenzen → fertige HA YAML Automationen
  // ══════════════════════════════════════════════════════════════════════════

  // ── Automations-Vorschläge generieren ─────────────────────────────────────
  _generateAutomationProposals(patterns, sequences, cfg) {
    const proposals = [];
    const mem       = this._loadMemory();

    // ── Aus Mustern ────────────────────────────────────────────────────────
    patterns.forEach((p, i) => {
      if (!p._raw || p.confidence < 0.5) return;
      const raw = p._raw;

      // Nur Entities die automatisierbar sind
      const actionEntities = raw.entities.filter(e =>
        ['light', 'switch', 'input_boolean', 'scene', 'script', 'cover', 'climate', 'fan'].includes(e.domain)
      );
      if (!actionEntities.length) return;

      // Bereits abgelehnt?
      const rejectedKey = `proposal_${p.label.replace(/\s/g,'_')}`;
      if (mem.rejectedProposals?.[rejectedKey]) return;

      // Bereits aktiviert?
      const activatedKey = `activated_${rejectedKey}`;
      const isActivated  = !!mem.activatedProposals?.[activatedKey];

      const proposal = {
        id:          `prop_${i}_${Date.now()}`,
        key:         rejectedKey,
        activatedKey,
        type:        'pattern',
        label:       `${p.icon} ${p.label}`,
        description: `${actionEntities.length} Geräte regelmäßig aktiv · ${Math.round(p.confidence*100)}% Konfidenz · ${p.observations}× beobachtet`,
        confidence:  p.confidence,
        observations:p.observations,
        icon:        p.icon,
        isActivated,
        yaml:        this._buildPatternYaml(p, actionEntities, cfg),
        entities:    actionEntities,
        learnNote:   `KI hat dieses Muster aus ${p.observations} Beobachtungen gelernt`,
      };

      proposals.push(proposal);
    });

    // ── Aus Sequenzen ──────────────────────────────────────────────────────
    sequences.forEach((seq, i) => {
      if (seq.confidence < 0.5 || seq.observations < 5) return;

      const rejectedKey  = `seq_${seq.steps.join('_')}`;
      if (mem.rejectedProposals?.[rejectedKey]) return;
      const activatedKey = `activated_${rejectedKey}`;
      const isActivated  = !!mem.activatedProposals?.[activatedKey];

      const trigEntity  = seq.steps[0];
      const actEntity   = seq.steps[1];
      const trigDomain  = trigEntity.split('.')[0];
      const actDomain   = actEntity.split('.')[0];
      if (!['light','switch','input_boolean','cover','climate','fan','scene'].includes(actDomain)) return;

      proposals.push({
        id:          `seq_${i}_${Date.now()}`,
        key:         rejectedKey,
        activatedKey,
        type:        'sequence',
        label:       `🔗 ${trigEntity.split('.')[1]?.replace(/_/g,' ')} → ${actEntity.split('.')[1]?.replace(/_/g,' ')}`,
        description: `${Math.round(seq.confidence*100)}% Konfidenz · Ø ${seq.avgDelaySec}s Abstand · ${seq.observations}× beobachtet`,
        confidence:  seq.confidence,
        observations:seq.observations,
        icon:        '🔗',
        isActivated,
        yaml:        this._buildSequenceYaml(seq, cfg),
        entities:    [{ entity: trigEntity }, { entity: actEntity }],
        learnNote:   `"${trigEntity.split('.')[1]}" geht fast immer vor "${actEntity.split('.')[1]}" an`,
      });
    });

    // ── Aus Solar-Triggern ────────────────────────────────────────────────
    const t = cfg.triggers || {};
    if (t.solar_entity && t.irrigation_entity) {
      const key = 'solar_irrigation';
      if (!mem.rejectedProposals?.[key]) {
        proposals.push({
          id:          `solar_irr_${Date.now()}`,
          key,
          activatedKey:`activated_${key}`,
          type:        'solar',
          label:       '☀ Bewässerung solar-gesteuert',
          description: 'Startet Bewässerung wenn Solar verfügbar und Eimer-Defizit vorhanden',
          confidence:  0.85,
          observations: 0,
          icon:        '☀',
          isActivated: !!mem.activatedProposals?.[`activated_${key}`],
          yaml:        this._buildSolarTriggerYaml('irrigation', t),
          entities:    [],
          learnNote:   'Solar-Optimierung aus deinen Trigger-Einstellungen',
        });
      }
    }

    // Nach Konfidenz sortieren
    proposals.sort((a, b) => b.confidence - a.confidence);
    return proposals.slice(0, 10);
  },

  // ── YAML für Muster-Automation ────────────────────────────────────────────
  _buildPatternYaml(pattern, entities, cfg) {
    const raw   = pattern._raw;
    const DAYS  = ['mon','tue','wed','thu','fri','sat','sun'];
    const alias = pattern.label.replace(/[^a-z0-9]/gi, '_').toLowerCase();

    // Trigger: Zeit
    const triggerTime = raw.startTime;

    // Bedingungen: Wochentag
    const dayList = raw.days.map(d => DAYS[d]);
    const isWeekdays = raw.days.length === 5 && !raw.days.includes(5) && !raw.days.includes(6);
    const isWeekend  = raw.days.length === 2 && raw.days.includes(5) && raw.days.includes(6);
    const isDaily    = raw.days.length === 7;

    // Aktionen: Licht/Schalter an
    const actions = entities.slice(0, 3).map(e => {
      const domain = e.domain;
      if (domain === 'light')   return `  - service: light.turn_on\n    target:\n      entity_id: ${e.entity}`;
      if (domain === 'switch')  return `  - service: switch.turn_on\n    target:\n      entity_id: ${e.entity}`;
      if (domain === 'scene')   return `  - service: scene.turn_on\n    target:\n      entity_id: ${e.entity}`;
      if (domain === 'cover')   return `  - service: cover.open_cover\n    target:\n      entity_id: ${e.entity}`;
      if (domain === 'climate') return `  - service: climate.set_hvac_mode\n    target:\n      entity_id: ${e.entity}\n    data:\n      hvac_mode: heat`;
      return `  - service: homeassistant.turn_on\n    target:\n      entity_id: ${e.entity}`;
    });

    let yaml = `alias: "KI: ${pattern.label}"\n`;
    yaml += `description: "Automatisch von KI erkannt · ${Math.round(pattern.confidence*100)}% Konfidenz"\n`;
    yaml += `trigger:\n  - platform: time\n    at: "${triggerTime}"\n`;
    yaml += `condition:\n`;
    if (!isDaily) {
      yaml += `  - condition: time\n    weekday:\n${dayList.map(d => `      - ${d}`).join('\n')}\n`;
    }
    yaml += `action:\n${actions.join('\n')}\n`;
    yaml += `mode: single\n`;

    return yaml;
  },

  // ── YAML für Sequenz-Automation ───────────────────────────────────────────
  _buildSequenceYaml(seq, cfg) {
    const trigEntity = seq.steps[0];
    const actEntity  = seq.steps[1];
    const actDomain  = actEntity.split('.')[0];
    const delay      = seq.avgDelaySec || 5;

    let actionService = 'homeassistant.turn_on';
    if (actDomain === 'light')   actionService = 'light.turn_on';
    if (actDomain === 'switch')  actionService = 'switch.turn_on';
    if (actDomain === 'cover')   actionService = 'cover.open_cover';

    let yaml = `alias: "KI: ${trigEntity.split('.')[1]} → ${actEntity.split('.')[1]}"\n`;
    yaml += `description: "Sequenz automatisch erkannt · ${Math.round(seq.confidence*100)}% Konfidenz"\n`;
    yaml += `trigger:\n  - platform: state\n    entity_id: ${trigEntity}\n    to: "on"\n`;
    yaml += `condition: []\n`;
    yaml += `action:\n`;
    if (delay > 3) {
      yaml += `  - delay:\n      seconds: ${Math.round(delay)}\n`;
    }
    yaml += `  - service: ${actionService}\n    target:\n      entity_id: ${actEntity}\n`;
    yaml += `mode: single\n`;

    return yaml;
  },

  // ── YAML für Solar-Trigger Automation ────────────────────────────────────
  _buildSolarTriggerYaml(triggerId, t) {
    if (triggerId === 'irrigation') {
      const solarEntity  = t.solar_entity  || 'sensor.solar_power';
      const bucketEntity = t.irrigation_entity || 'sensor.smart_irrigation_bucket';
      const threshold    = t.pool_solar_min || 300;
      const bucketMin    = t.irrigation_threshold || 5;

      let yaml = `alias: "KI: Solar-Bewässerung"\n`;
      yaml += `description: "Bewässerung wenn Solar verfügbar und Eimer-Defizit"\n`;
      yaml += `trigger:\n  - platform: numeric_state\n    entity_id: ${solarEntity}\n    above: ${threshold}\n    for:\n      minutes: 10\n`;
      yaml += `condition:\n  - condition: numeric_state\n    entity_id: ${bucketEntity}\n    above: ${bucketMin}\n`;
      yaml += `  - condition: time\n    after: "06:00:00"\n    before: "09:00:00"\n`;
      yaml += `action:\n  - service: homeassistant.turn_on\n    target:\n      entity_id: switch.irrigation_zone_1\n`;
      yaml += `mode: single\n`;
      return yaml;
    }
    return '';
  },

  // ── Proposal ablehnen (merken für nie wieder vorschlagen) ─────────────────
  _rejectProposal(proposalKey, card) {
    const mem = this._loadMemory();
    if (!mem.rejectedProposals) mem.rejectedProposals = {};
    mem.rejectedProposals[proposalKey] = Date.now();
    this._saveMemory();
    card?._showToast?.('🚫 Vorschlag abgelehnt · wird nicht mehr gezeigt');
    card?._rebuildSidebar?.();
    card?._markDirty?.();
  },

  // ── Proposal aktivieren (zu HA senden) ────────────────────────────────────
  async _activateProposal(proposal, card) {
    const mem  = this._loadMemory();
    const hass = card?._hass;

    if (!hass) {
      card?._showToast?.('❌ HA nicht verbunden');
      return;
    }

    try {
      // HA REST API: Automation erstellen
      const token = hass.auth?.data?.access_token
        || hass.connection?.options?.auth?.data?.access_token;

      if (!token) throw new Error('Kein HA Token');

      const resp = await fetch(`${window.location.origin}/api/config/automation/config/ki_${proposal.key}`, {
        method:  'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          alias:       proposal.label.replace(/^[^ ]+ /, ''), // Icon entfernen
          description: proposal.description,
          trigger:     [{ platform: 'time', at: '07:00' }],  // wird via YAML überschrieben
          action:      [],
        })
      });

      // Alternativ: YAML in persistente Notification kopieren (einfacher)
      await hass.callService('persistent_notification', 'create', {
        title: `🧠 KI-Automation: ${proposal.label}`,
        message: `Kopiere dieses YAML in deine automations.yaml:\n\n\`\`\`yaml\n${proposal.yaml}\n\`\`\``,
        notification_id: `ki_proposal_${proposal.key}`,
      });

      // Als aktiviert markieren
      if (!mem.activatedProposals) mem.activatedProposals = {};
      mem.activatedProposals[proposal.activatedKey] = Date.now();
      this._saveMemory();

      // Positives Feedback für das zugrundeliegende Muster
      const triggerId = proposal.entities[0]?.entity?.split('.')?.[0] || 'unknown';
      this._rewardWeighted(triggerId, +2, 'proposal_activated', 0.8, card);

      card?._showToast?.('✅ Automation in HA-Benachrichtigungen gespeichert · YAML kopieren');
      card?._rebuildSidebar?.();
      card?._markDirty?.();

    } catch (e) {
      // Fallback: YAML in Clipboard
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(proposal.yaml).catch(() => {});
        card?._showToast?.('📋 YAML in Zwischenablage kopiert');
      } else {
        card?._showToast?.(`❌ ${e.message}`);
      }
    }
  },

  // ── Automations-Generator Canvas ─────────────────────────────────────────
  _drawAutomationGenerator(ctx, w, y, pad, availH, proposals) {
    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('AUTOMATIONS-VORSCHLÄGE', pad, y + 9);
    y += 14;

    if (!proposals || !proposals.length) {
      ctx.fillStyle = '#334155';
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Noch keine Vorschläge (mind. 50% Konfidenz + 5 Beobachtungen)', w / 2, y + availH / 2 - 8);
      ctx.fillStyle = '#1e3a5f';
      ctx.font = '8px sans-serif';
      ctx.fillText('Mehr Daten sammeln oder min. Konfidenz in Optionen senken', w / 2, y + availH / 2 + 8);
      return;
    }

    const rowH = 52;
    proposals.forEach((p, i) => {
      const ry = y + i * rowH;
      if (ry + rowH > y + availH) return;
      const bw = w - pad * 2;

      const statusCol = p.isActivated ? '#22c55e'
                      : p.type === 'solar'    ? '#fbbf24'
                      : p.type === 'sequence' ? '#34d399'
                      : '#38bdf8';

      ctx.fillStyle = p.isActivated ? '#0c2a1a' : '#0f172a';
      this._roundRect(ctx, pad, ry, bw, rowH - 4, 6);
      ctx.fill();
      ctx.strokeStyle = statusCol + '44';
      ctx.lineWidth = 1;
      this._roundRect(ctx, pad, ry, bw, rowH - 4, 6);
      ctx.stroke();

      // Typ-Streifen
      ctx.fillStyle = statusCol;
      this._roundRect(ctx, pad, ry, 3, rowH - 4, 2);
      ctx.fill();

      // Icon + Label
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(p.icon, pad + 8, ry + 14);

      ctx.fillStyle = '#e2e8f0';
      ctx.font = 'bold 9px sans-serif';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(p.label, pad + 24, ry + 16);

      // Beschreibung
      ctx.fillStyle = '#64748b';
      ctx.font = '7.5px sans-serif';
      ctx.fillText(p.description, pad + 24, ry + 27);

      // Lern-Notiz
      ctx.fillStyle = '#334155';
      ctx.font = '7px sans-serif';
      ctx.fillText(`🧠 ${p.learnNote}`, pad + 24, ry + 38);

      // Status rechts
      const statusText = p.isActivated ? '✅ Aktiv' : '💡 Vorschlag';
      ctx.fillStyle = statusCol;
      ctx.font = 'bold 7.5px sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(statusText, w - pad - 8, ry + (rowH-4)/2 - 6);

      // Konfidenz
      const cW = 40;
      const cX = w - pad - cW - 6;
      const cY = ry + (rowH-4)/2 + 2;
      ctx.fillStyle = '#1e293b';
      this._roundRect(ctx, cX, cY, cW, 7, 3);
      ctx.fill();
      ctx.fillStyle = statusCol;
      this._roundRect(ctx, cX, cY, Math.round(cW * p.confidence), 7, 3);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 6px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${Math.round(p.confidence*100)}%`, cX + cW/2, cY + 3.5);
    });
  },

  // ── Automations-Generator Sidebar ────────────────────────────────────────
  _buildAutomationSidebarSection(scroll, proposals, card) {
    if (!proposals?.length) return;

    const hdr = document.createElement('div');
    hdr.style.cssText = 'font-size:8px;font-weight:700;color:#94a3b8;margin:10px 0 6px;letter-spacing:0.5px';
    hdr.textContent = `💡 AUTOMATIONS-VORSCHLÄGE (${proposals.length})`;
    scroll.appendChild(hdr);

    proposals.forEach(p => {
      const box = document.createElement('div');
      const col = p.isActivated ? '#22c55e'
                : p.type === 'solar'    ? '#fbbf24'
                : p.type === 'sequence' ? '#34d399'
                : '#38bdf8';
      box.style.cssText = `background:var(--surf2);border:1px solid ${col}33;border-radius:6px;padding:8px;margin-bottom:6px`;

      // Header
      box.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
          <span style="font-size:9px;font-weight:700;color:#e2e8f0">${p.label}</span>
          <span style="font-size:7px;color:${col};font-weight:700">${p.isActivated ? '✅ Aktiv' : Math.round(p.confidence*100)+'%'}</span>
        </div>
        <div style="font-size:7.5px;color:#64748b;margin-bottom:3px">${p.description}</div>
        <div style="font-size:7px;color:#334155;margin-bottom:6px">🧠 ${p.learnNote}</div>
      `;

      // YAML Preview (aufklappbar)
      const details = document.createElement('details');
      details.style.cssText = 'margin-bottom:5px';
      const summary = document.createElement('summary');
      summary.style.cssText = 'font-size:7px;color:#475569;cursor:pointer';
      summary.textContent = '📋 YAML anzeigen';
      const pre = document.createElement('pre');
      pre.style.cssText = 'font-size:6.5px;color:#38bdf8;background:#0f172a;border-radius:4px;padding:6px;overflow-x:auto;margin-top:4px;white-space:pre-wrap;word-break:break-all';
      pre.textContent = p.yaml;
      details.appendChild(summary);
      details.appendChild(pre);
      box.appendChild(details);

      // Action-Buttons
      const btns = document.createElement('div');
      btns.style.cssText = 'display:flex;gap:4px';

      if (!p.isActivated) {
        const activateBtn = document.createElement('button');
        activateBtn.style.cssText = `flex:2;padding:5px;border-radius:4px;border:none;background:${col};color:#07090d;font-size:8px;font-weight:700;cursor:pointer`;
        activateBtn.textContent = '✅ Aktivieren';
        activateBtn.onclick = () => this._activateProposal(p, card);
        btns.appendChild(activateBtn);
      }

      const copyBtn = document.createElement('button');
      copyBtn.style.cssText = 'flex:1;padding:5px;border-radius:4px;border:1px solid #334155;background:transparent;color:#64748b;font-size:8px;cursor:pointer';
      copyBtn.textContent = '📋 Kopieren';
      copyBtn.onclick = () => {
        navigator.clipboard?.writeText(p.yaml).catch(() => {});
        card._showToast?.('📋 YAML kopiert');
      };
      btns.appendChild(copyBtn);

      const rejectBtn = document.createElement('button');
      rejectBtn.style.cssText = 'flex:1;padding:5px;border-radius:4px;border:1px solid #ef444433;background:transparent;color:#ef4444;font-size:8px;cursor:pointer';
      rejectBtn.textContent = '🚫 Ablehnen';
      rejectBtn.onclick = () => this._rejectProposal(p.key, card);
      btns.appendChild(rejectBtn);

      box.appendChild(btns);
      scroll.appendChild(box);
    });
  },

  // ── Häufigste Entities in Zeitfenster (String) ────────────────────────────
  _peakEntities(events, wd, startSi, endSi) {
    const counter = {};
    const startMin = startSi * this._kiSlotMin;
    const endMin   = (endSi + 1) * this._kiSlotMin;

    events.forEach(ev => {
      if (!this._isActiveState(ev.state)) return;
      const d   = new Date(ev.ts);
      const evWd  = (d.getDay() + 6) % 7;
      const evMin = d.getHours() * 60 + d.getMinutes();
      if (evWd === wd && evMin >= startMin && evMin < endMin) {
        const short = ev.entity.split('.')[1]?.replace(/_/g, ' ') || ev.entity;
        counter[short] = (counter[short] || 0) + 1;
      }
    });

    return Object.entries(counter)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([name]) => name)
      .join(', ') || '–';
  },

  // ── Tage-Label formatieren ────────────────────────────────────────────────
  _formatDays(days) {
    const DAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
    days = [...new Set(days)].sort();
    if (days.length === 7)  return 'Täglich';
    if (days.length === 5 && !days.includes(5) && !days.includes(6)) return 'Werktags';
    if (days.length === 2 && days.includes(5) && days.includes(6))   return 'Wochenende';
    if (days.length === 1)  return DAYS[days[0]];
    // Konsekutive Tage als Bereich
    const allSeq = days.every((d, i) => i === 0 || d === days[i - 1] + 1);
    if (allSeq && days.length >= 3) return `${DAYS[days[0]]}–${DAYS[days[days.length - 1]]}`;
    return days.map(d => DAYS[d]).join(', ');
  },

  // ── Slot-Index → Uhrzeit ──────────────────────────────────────────────────
  _slotToTime(slotIdx) {
    const totalMin = slotIdx * this._kiSlotMin;
    const h = Math.floor(totalMin / 60) % 24;
    const m = totalMin % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  },

  // ── Aktueller Slot-Index ──────────────────────────────────────────────────
  _currentSlot() {
    const now = new Date();
    return Math.floor((now.getHours() * 60 + now.getMinutes()) / this._kiSlotMin);
  },

  // ── Ist dieser Zustand "aktiv"? ────────────────────────────────────────────
  _isActiveState(state) {
    if (!state) return false;
    const s = String(state).toLowerCase();
    return s === 'on' || s === 'home' || s === 'open' || s === 'detected' ||
           s === 'motion' || s === 'active' || s === 'true' || s === '1';
  },

  // ── Entity-Icon ────────────────────────────────────────────────────────────
  _entityIcon(entityId) {
    if (!entityId) return '◆';
    const domain = entityId.split('.')[0];
    const name   = entityId.toLowerCase();
    if (domain === 'light')                      return '💡';
    if (name.includes('motion') || name.includes('bewegung')) return '👁';
    if (name.includes('door')   || name.includes('tuer') || name.includes('tür')) return '🚪';
    if (name.includes('window') || name.includes('fenster'))  return '🪟';
    if (domain === 'switch')                     return '🔌';
    if (domain === 'binary_sensor')              return '◉';
    if (domain === 'sensor')                     return '📊';
    return '◆';
  },

  // ── Personen-Profile erkennen ─────────────────────────────────────────────
  // Ansatz: Aktivitäts-Fingerabdruck pro Tag → k-Means-ähnliches Clustering
  // Ohne echtes ML: wir trennen nach "Früh-Muster" vs "Spät-Muster"
  _detectProfiles(events, totalDays) {
    // Pro Tag: Zeitpunkt erster + letzter Aktivität
    const dayProfiles = {};

    events.forEach(ev => {
      if (!this._isActiveState(ev.state)) return;
      const d   = new Date(ev.ts);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      const min = d.getHours() * 60 + d.getMinutes();
      if (!dayProfiles[key]) dayProfiles[key] = { first: min, last: min, count: 0 };
      if (min < dayProfiles[key].first) dayProfiles[key].first = min;
      if (min > dayProfiles[key].last)  dayProfiles[key].last  = min;
      dayProfiles[key].count++;
    });

    const days = Object.values(dayProfiles).filter(d => d.count >= 3);
    if (days.length < 7) return [];

    // Mittlere Aufstehzeit berechnen
    const avgFirst = days.reduce((s, d) => s + d.first, 0) / days.length;
    const avgLast  = days.reduce((s, d) => s + d.last,  0) / days.length;
    const stdFirst = Math.sqrt(days.reduce((s, d) => s + Math.pow(d.first - avgFirst, 2), 0) / days.length);

    // Wenn Streuung > 90 Min → wahrscheinlich 2 Personen mit verschiedenen Rhythmen
    const profiles = [];

    if (stdFirst > 90) {
      // Früh-Typ: Tage mit erster Aktivität deutlich vor Durchschnitt
      const earlyDays = days.filter(d => d.first < avgFirst - 45);
      const lateDays  = days.filter(d => d.first > avgFirst + 45);

      if (earlyDays.length >= 5) {
        const ep = Math.round(earlyDays.reduce((s, d) => s + d.first, 0) / earlyDays.length);
        profiles.push({
          label:     'Person A',
          isRegular: true,
          isGuest:   false,
          traits:    [
            `Aufstehen ~${this._minToTime(ep)}`,
            ep < 7 * 60 ? 'Frühaufsteher' : 'Normal-Typ',
            `Aktiv bis ~${this._minToTime(Math.round(earlyDays.reduce((s,d)=>s+d.last,0)/earlyDays.length))}`,
          ],
          peakTime:  this._minToTime(ep),
          days:      earlyDays.length,
        });
      }
      if (lateDays.length >= 5) {
        const lp = Math.round(lateDays.reduce((s, d) => s + d.first, 0) / lateDays.length);
        profiles.push({
          label:     'Person B',
          isRegular: true,
          isGuest:   false,
          traits:    [
            `Aufstehen ~${this._minToTime(lp)}`,
            lp > 9 * 60 ? 'Langschläfer' : 'Spät-Typ',
            `Aktiv bis ~${this._minToTime(Math.round(lateDays.reduce((s,d)=>s+d.last,0)/lateDays.length))}`,
          ],
          peakTime:  this._minToTime(lp),
          days:      lateDays.length,
        });
      }
    } else {
      // Einheitliches Muster → 1 Hauptperson
      profiles.push({
        label:     'Hauptperson',
        isRegular: true,
        isGuest:   false,
        traits:    [
          `Aufstehen ~${this._minToTime(Math.round(avgFirst))}`,
          `Schlafen ~${this._minToTime(Math.round(avgLast))}`,
          `${totalDays} Tage beobachtet`,
        ],
        peakTime:  this._minToTime(Math.round(avgFirst)),
        days:      days.length,
      });
    }

    // Gast-Erkennung: Tage mit völlig unbekanntem Muster
    // (Aktivität zu Zeiten die sonst nie auftreten)
    const outlierDays = days.filter(d => {
      const knownFirst = profiles.some(p => {
        const pMin = this._timeToMin(p.peakTime);
        return Math.abs(d.first - pMin) < 120;
      });
      return !knownFirst;
    });

    if (outlierDays.length >= 2 && outlierDays.length < days.length * 0.3) {
      const gp = Math.round(outlierDays.reduce((s, d) => s + d.first, 0) / outlierDays.length);
      profiles.push({
        label:     'Gast / Besuch',
        isRegular: false,
        isGuest:   true,
        traits:    [
          `Selten: ${outlierDays.length}x`,
          `Muster: ~${this._minToTime(gp)}`,
          'Unbekannter Rhythmus',
        ],
        peakTime:  this._minToTime(gp),
        days:      outlierDays.length,
      });
    }

    return profiles;
  },

  // ── Sequenz-Erkenner ──────────────────────────────────────────────────────
  // Findet: "Entity A geht AN, dann innerhalb X Sekunden Entity B"
  _detectSequences(events, minObs) {
    const MAX_DELAY_SEC = 300; // max 5 Min zwischen zwei Events
    const sequences     = {};

    // Nur aktive Events, zeitlich sortiert
    const active = events.filter(e => this._isActiveState(e.state));

    for (let i = 0; i < active.length - 1; i++) {
      const a = active[i];
      for (let j = i + 1; j < active.length; j++) {
        const b     = active[j];
        const delay = (b.ts - a.ts) / 1000;
        if (delay > MAX_DELAY_SEC) break;
        if (a.entity === b.entity) continue;

        const key = `${a.entity}|${b.entity}`;
        if (!sequences[key]) sequences[key] = { steps: [a.entity, b.entity], delays: [], count: 0 };
        sequences[key].delays.push(delay);
        sequences[key].count++;
      }
    }

    // Filtern + Konfidenz berechnen
    const results = [];
    Object.values(sequences).forEach(seq => {
      if (seq.count < minObs) return;

      // Konfidenz: wie oft folgt B nach A vs. wie oft tritt A alleine auf
      const aCount = active.filter(e => e.entity === seq.steps[0]).length;
      const conf   = Math.min(0.99, seq.count / Math.max(1, aCount));
      if (conf < 0.3) return;

      const avgDelay = Math.round(seq.delays.reduce((s, d) => s + d, 0) / seq.delays.length);

      results.push({
        steps:        seq.steps,
        confidence:   conf,
        observations: seq.count,
        avgDelaySec:  avgDelay,
      });
    });

    results.sort((a, b) => b.confidence - a.confidence);
    return results.slice(0, 8);
  },

  // ── Trigger-Entscheider ───────────────────────────────────────────────────
  // Bewertet ob jetzt ein guter Moment für automatische Aktionen wäre
  _evaluateTriggers(situation, cfg) {
    const triggers     = [];
    const triggerCfg   = cfg.triggers || {};
    const isHome       = situation.label !== 'Nicht zu Hause';
    const isNight      = situation.label === 'Nacht';
    const isMorning    = situation.label === 'Morgenroutine';
    const now          = new Date();
    const hour         = now.getHours();

    // ── Rasen / Smart Irrigation ──────────────────────────────────────────
    if (triggerCfg.irrigation_bucket != null) {
      const bucket      = parseFloat(triggerCfg.irrigation_bucket) || 0;
      const rainToday   = parseFloat(triggerCfg.rain_forecast_mm)  || 0;
      const needsWater  = bucket > (triggerCfg.irrigation_threshold || 5);
      const gardenFree  = !isHome || hour < 8 || hour > 20;
      const noRainSoon  = rainToday < 3;
      const recommended = needsWater && gardenFree && noRainSoon;

      triggers.push({
        id:          'irrigation',
        icon:        '💧',
        label:       'Rasen gießen',
        recommended,
        reason:      needsWater
          ? `Virtueller Eimer: ${bucket.toFixed(1)}mm Defizit`
          : 'Kein Gießen nötig (Eimer voll)',
        blockedBy:   !gardenFree ? 'Garten in Benutzung'
                   : !noRainSoon ? `Regen erwartet (${rainToday}mm)`
                   : null,
        context:     { isGuest: false, hour, isNight },
        powerW:      triggerCfg.irrigation_power_w || 150, // Verbrauch in Watt
        priority:    triggerCfg.irrigation_priority || 2,  // 1=höchste, 5=niedrigste
        urgency:     needsWater ? Math.min(1, bucket / 20) : 0, // 0..1
      });
    }

    // ── Mähroboter ────────────────────────────────────────────────────────
    if (triggerCfg.mower_entity) {
      const mowerState  = triggerCfg.mower_state || 'unknown';
      const awayAndDay  = !isHome && hour >= 9 && hour <= 18;
      const notRaining  = (parseFloat(triggerCfg.rain_forecast_mm) || 0) < 2;
      const recommended = awayAndDay && notRaining && mowerState !== 'mowing';

      triggers.push({
        id:          'mower',
        icon:        '🌿',
        label:       'Mähroboter',
        recommended,
        reason:      awayAndDay
          ? 'Niemand zuhause · Tagsüber · Guter Zeitpunkt'
          : 'Jemand ist zuhause oder ungünstige Uhrzeit',
        blockedBy:   !notRaining ? 'Regen erwartet'
                   : mowerState === 'mowing' ? 'Läuft bereits'
                   : isHome ? 'Person zuhause'
                   : null,
        context:     { isGuest: false, hour, isNight },
        powerW:      triggerCfg.mower_power_w || 80,
        priority:    triggerCfg.mower_priority || 3,
        urgency:     0.4,
      });
    }

    // ── Pool-Pumpe ────────────────────────────────────────────────────────
    if (triggerCfg.solar_power != null) {
      const solarW      = parseFloat(triggerCfg.solar_power) || 0;
      const solarOk     = solarW > (triggerCfg.pool_solar_min || 300);
      const timeOk      = hour >= 10 && hour <= 16;
      const recommended = solarOk && timeOk;

      triggers.push({
        id:          'pool_pump',
        icon:        '🏊',
        label:       'Pool-Pumpe',
        recommended,
        reason:      solarOk
          ? `Solar: ${solarW}W verfügbar · Kostenloses Pumpen`
          : `Solar zu gering (${solarW}W < ${triggerCfg.pool_solar_min || 300}W)`,
        blockedBy:   !timeOk ? 'Außerhalb Betriebszeit (10–16h)' : null,
        context:     { isGuest: false, hour, isNight },
        powerW:      triggerCfg.pool_power_w || 400,
        priority:    triggerCfg.pool_priority || 1,
        urgency:     0.6,
      });
    }

    // ── Konflikt-Erkennung ────────────────────────────────────────────────
    const conflicts = this._detectConflicts(triggers, triggerCfg);
    conflicts.forEach(c => {
      // Verlierer markieren
      const loser = triggers.find(t => t.id === c.loserId);
      if (loser) {
        loser.recommended = false;
        loser.conflictWith = c.winnerId;
        loser.conflictMsg  = c.reason;
        loser.blockedBy    = `⚡ Konflikt mit ${c.winnerLabel}`;
      }
    });
    // Konflikte ans Array anhängen (für UI)
    triggers._conflicts = conflicts;

    return triggers;
  },

  // ── Konflikt-Erkennung ────────────────────────────────────────────────────
  // Prüft welche Trigger sich gegenseitig blockieren (Solar-Budget, Zeit, Raum)
  _detectConflicts(triggers, cfg) {
    const conflicts  = [];
    const solarW     = parseFloat(cfg.solar_power) || 0;
    const recommended = triggers.filter(t => t.recommended);

    // ── Solar-Budget Konflikt ─────────────────────────────────────────────
    // Mehrere Trigger wollen Solar aber Budget reicht nicht für alle
    const solarConsumers = recommended.filter(t => t.powerW && t.powerW > 50);
    const totalNeeded    = solarConsumers.reduce((s, t) => s + (t.powerW || 0), 0);

    if (solarW > 0 && totalNeeded > solarW && solarConsumers.length > 1) {
      // Solar reicht nicht für alle → nach Priorität sortieren
      const sorted  = [...solarConsumers].sort((a, b) => {
        // Priorität 1 = am wichtigsten, dann nach Dringlichkeit
        if (a.priority !== b.priority) return (a.priority||3) - (b.priority||3);
        return (b.urgency||0) - (a.urgency||0);
      });

      let budget = solarW;
      sorted.forEach(t => {
        if (budget >= (t.powerW || 0)) {
          budget -= (t.powerW || 0); // passt noch rein
        } else {
          // Passt nicht mehr → Konflikt
          const winner = sorted.find(w => w.id !== t.id && w.powerW <= solarW);
          conflicts.push({
            type:        'solar_budget',
            loserId:     t.id,
            winnerId:    winner?.id || sorted[0].id,
            winnerLabel: winner?.label || sorted[0].label,
            reason:      `Solar: ${solarW}W reicht nicht für alle (${totalNeeded}W benötigt)`,
            suggestion:  `${t.label} auf später verschieben wenn mehr Solar verfügbar`,
            severity:    'warn',
          });
        }
      });
    }

    // ── Raum-Konflikt ─────────────────────────────────────────────────────
    // Mähroboter + Bewässerung gleichzeitig = schlechte Idee
    const hasMower      = recommended.find(t => t.id === 'mower');
    const hasIrrigation = recommended.find(t => t.id === 'irrigation');
    if (hasMower && hasIrrigation) {
      // Bewässerung hat Vorrang (Rasen nass = Mähroboter sollte warten)
      conflicts.push({
        type:        'raum_konflikt',
        loserId:     'mower',
        winnerId:    'irrigation',
        winnerLabel: 'Rasen gießen',
        reason:      'Nasser Rasen ist schlecht für den Mähroboter',
        suggestion:  'Erst gießen, dann 2h später mähen',
        severity:    'info',
      });
    }

    // ── Zeit-Konflikt ─────────────────────────────────────────────────────
    // Zwei Trigger wollen denselben optimalen Zeitslot
    const byTime = {};
    recommended.forEach(t => {
      const slot = Math.floor((new Date().getHours()) / 2); // 2h-Slots
      if (!byTime[slot]) byTime[slot] = [];
      byTime[slot].push(t);
    });
    Object.values(byTime).forEach(group => {
      if (group.length > 2) {
        // Mehr als 2 gleichzeitig → nach Priorität sortieren, Rest warnen
        const sorted  = [...group].sort((a, b) => (a.priority||3) - (b.priority||3));
        sorted.slice(2).forEach(loser => {
          conflicts.push({
            type:        'zeit_konflikt',
            loserId:     loser.id,
            winnerId:    sorted[0].id,
            winnerLabel: sorted[0].label,
            reason:      'Zu viele Aktionen gleichzeitig',
            suggestion:  `${loser.label} auf nächste Stunde verschieben`,
            severity:    'info',
          });
        });
      }
    });

    return conflicts;
  },

  // ── Live-Daten laden (Solar, Akku, Wetter, Tarif) ────────────────────────
  async _fetchLiveData(card, cfg) {
    const hass = card._hass;
    if (!hass) return;
    const t = cfg.triggers || {};

    try {
      // Smart Irrigation Bucket
      if (t.irrigation_entity) {
        const e = hass.states[t.irrigation_entity];
        if (e) { t.irrigation_bucket = parseFloat(e.state) || 0; t.irrigation_unit = e.attributes?.unit_of_measurement || 'mm'; }
      }

      // Wetter + Regenvorhersage (mehrere Tage)
      if (t.weather_entity) {
        const w  = hass.states[t.weather_entity];
        const fc = w?.attributes?.forecast || [];
        t.rain_forecast_mm        = fc[0]?.precipitation || 0;
        t.rain_tomorrow_mm        = fc[1]?.precipitation || 0;
        t.weather_condition_today = fc[0]?.condition || w?.state || 'unknown';
        // Solar-Prognose aus Wetter ableiten (falls kein dedizierter Sensor)
        t.solar_forecast_tomorrow = this._estimateSolarFromWeather(fc[1]?.condition || 'partlycloudy');
      }

      // Solar-Leistung aktuell
      if (t.solar_entity) {
        const s = hass.states[t.solar_entity];
        t.solar_power = parseFloat(s?.state) || 0;
      }

      // Solar-Energie heute gesamt (kWh) — für Tagesplanung
      if (t.solar_today_entity) {
        const s = hass.states[t.solar_today_entity];
        t.solar_today_kwh = parseFloat(s?.state) || 0;
      }

      // Akku-Ladestand (SOC)
      if (t.battery_entity) {
        const b = hass.states[t.battery_entity];
        t.battery_soc = parseFloat(b?.state) || 0;
      }

      // Akku-Leistung (lädt/entlädt)
      if (t.battery_power_entity) {
        const b = hass.states[t.battery_power_entity];
        t.battery_power_w = parseFloat(b?.state) || 0; // positiv = lädt, negativ = entlädt
      }

      // Stromtarif (falls dynamisch wie Tibber/Awattar)
      if (t.tariff_entity) {
        const ta = hass.states[t.tariff_entity];
        t.tariff_now        = parseFloat(ta?.state) || null;
        t.tariff_unit       = ta?.attributes?.unit_of_measurement || '€/kWh';
        t.tariff_attributes = ta?.attributes || {};
      }

      // Mähroboter-Status
      if (t.mower_entity) {
        const m = hass.states[t.mower_entity];
        t.mower_state = m?.state || 'unknown';
      }

      // Kosten-Tracking: heutiger Landstrom-Verbrauch aus HA Energiedaten
      if (t.grid_import_entity) {
        const g = hass.states[t.grid_import_entity];
        t.grid_import_today_kwh = parseFloat(g?.state) || 0;
      }

    } catch (e) {
      console.warn('[KI] Live-Daten Fehler:', e.message);
    }
  },

  // ── Solar-Prognose aus Wetterbedingung schätzen ───────────────────────────
  _estimateSolarFromWeather(condition) {
    const map = {
      'sunny':            1.0,
      'clear-night':      0.0,
      'partlycloudy':     0.6,
      'cloudy':           0.25,
      'fog':              0.15,
      'hail':             0.1,
      'lightning':        0.05,
      'lightning-rainy':  0.05,
      'pouring':          0.1,
      'rainy':            0.2,
      'snowy':            0.15,
      'snowy-rainy':      0.1,
      'windy':            0.7,
      'windy-variant':    0.5,
      'exceptional':      0.3,
    };
    return map[condition] ?? 0.5; // 0..1 relative Solarleistung
  },

  // ── Minuten → Uhrzeit-String ──────────────────────────────────────────────
  _minToTime(min) {
    const h = Math.floor(min / 60) % 24;
    const m = min % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  },

  // ── Uhrzeit-String → Minuten ──────────────────────────────────────────────
  _timeToMin(timeStr) {
    const [h, m] = (timeStr || '00:00').split(':').map(Number);
    return h * 60 + m;
  },

  // ══════════════════════════════════════════════════════════════════════════
  // GEDÄCHTNIS & BELOHNUNGSSYSTEM
  // ══════════════════════════════════════════════════════════════════════════

  // ── Gedächtnis laden (localStorage) ──────────────────────────────────────
  _loadMemory() {
    if (this._kiMemory) return this._kiMemory;
    try {
      const raw = localStorage.getItem('ble_ki_memory');
      this._kiMemory = raw ? JSON.parse(raw) : { triggers: {}, feedback: [], metaLearning: {}, version: 2 };
      // Migration v1 → v2
      if (!this._kiMemory.metaLearning) this._kiMemory.metaLearning = {};
    } catch (e) {
      this._kiMemory = { triggers: {}, feedback: [], metaLearning: {}, version: 2 };
    }
    return this._kiMemory;
  },

  // ── Gedächtnis speichern ──────────────────────────────────────────────────
  _saveMemory() {
    if (!this._kiMemory) return;
    try {
      // Feedback-Log auf 200 Einträge begrenzen
      if (this._kiMemory.feedback.length > 200) {
        this._kiMemory.feedback = this._kiMemory.feedback.slice(-200);
      }
      localStorage.setItem('ble_ki_memory', JSON.stringify(this._kiMemory));
    } catch (e) {
      console.warn('[KI] Gedächtnis-Speicherfehler:', e.message);
    }
  },

  // ══════════════════════════════════════════════════════════════════════════
  // RISIKO-PROFILE & BUDGET-SYSTEM
  // ══════════════════════════════════════════════════════════════════════════

  // ── Risiko-Profil pro Trigger-Typ ─────────────────────────────────────────
  // Bestimmt: Budget-Grenzen, Cooldown, manuelle Reaktivierung nötig?
  _riskProfile(triggerId) {
    const PROFILES = {
      // Risiko-Level 1: Niedrig — kein Schaden möglich
      light:      { level: 1, label: 'Niedrig',  maxPos: 15, maxNeg: -15, pauseAt: -8,  cooldownMs: 30*60*1000,       manualReset: false, window: 20 },
      irrigation: { level: 1, label: 'Niedrig',  maxPos: 15, maxNeg: -15, pauseAt: -8,  cooldownMs: 30*60*1000,       manualReset: false, window: 20 },
      // Risiko-Level 2: Mittel — Kosten oder Komfort betroffen
      pool_pump:  { level: 2, label: 'Mittel',   maxPos: 12, maxNeg: -10, pauseAt: -5,  cooldownMs: 2*60*60*1000,     manualReset: false, window: 20 },
      heating:    { level: 2, label: 'Mittel',   maxPos: 12, maxNeg: -10, pauseAt: -5,  cooldownMs: 2*60*60*1000,     manualReset: false, window: 20 },
      climate:    { level: 2, label: 'Mittel',   maxPos: 12, maxNeg: -10, pauseAt: -5,  cooldownMs: 2*60*60*1000,     manualReset: false, window: 20 },
      // Risiko-Level 3: Hoch — Sicherheit (Kinder, Tiere, Verletzungsgefahr)
      mower:      { level: 3, label: 'Hoch ⚠',  maxPos: 10, maxNeg: -8,  pauseAt: -4,  cooldownMs: 24*60*60*1000,    manualReset: true,  window: 20 },
    };
    // Standard: Niedrig falls unbekannt
    return PROFILES[triggerId] || { level: 1, label: 'Niedrig', maxPos: 15, maxNeg: -15, pauseAt: -8, cooldownMs: 30*60*1000, manualReset: false, window: 20 };
  },

  // ── Sliding-Window Score berechnen ────────────────────────────────────────
  // Nur letzte N Entscheidungen, mit Zeit-Decay (ältere zählen weniger)
  _windowScore(triggerId) {
    const mem      = this._loadMemory();
    const profile  = this._riskProfile(triggerId);
    const history  = (mem.feedback || [])
      .filter(f => f.triggerId === triggerId)
      .slice(-profile.window);  // letzte N Einträge

    if (!history.length) return 0;

    const now    = Date.now();
    const maxAge = 20 * 24 * 60 * 60 * 1000; // 20 Tage = voller Decay-Bereich

    let score = 0;
    history.forEach((f, i) => {
      // Zeit-Decay: jüngere Einträge zählen mehr
      const age    = now - (f.ts || now);
      const decay  = Math.max(0.1, 1 - (age / maxAge));
      // Position-Decay: ältere im Fenster zählen weniger
      const posW   = (i + 1) / history.length;
      const weight = decay * posW;
      score += f.delta * weight;
    });

    // Auf Budget-Grenzen kappen
    return Math.max(profile.maxNeg, Math.min(profile.maxPos, score));
  },

  // ── Trigger-Zustand aus Gedächtnis holen (v1.2: mit Budget) ──────────────
  _triggerState(triggerId) {
    const mem = this._loadMemory();
    if (!mem.triggers[triggerId]) {
      mem.triggers[triggerId] = {
        windowScore:  0,       // Sliding-Window Score (−maxNeg..+maxPos)
        confidence:   0.5,
        overrides:    [],
        disabled:     false,
        params:       {},
        lastFeedback: null,
        runCount:     0,
        acceptCount:  0,
        pausedUntil:  null,    // automatische Pause nach Grenzunterschreitung
        pausedManual: false,   // manuelle Pause (Level 3: nur manuell aufhebbar)
      };
    }
    return mem.triggers[triggerId];
  },

  // ── Belohnung vergeben (v1.2: Sliding Window + Budget-Grenzen) ───────────
  _reward(triggerId, delta, reason, card) {
    const mem     = this._loadMemory();
    const state   = this._triggerState(triggerId);
    const profile = this._riskProfile(triggerId);

    // Feedback ins Log
    mem.feedback.push({ triggerId, delta, reason, ts: Date.now() });

    // Window-Score neu berechnen (immer fresh aus History)
    state.windowScore  = this._windowScore(triggerId);
    state.lastFeedback = { delta, reason, ts: Date.now() };

    // Konfidenz aus Window-Score ableiten
    // Score bei maxPos → confidence 0.95, bei 0 → 0.5, bei maxNeg → 0.05
    const range      = profile.maxPos - profile.maxNeg;
    const normalized = (state.windowScore - profile.maxNeg) / range; // 0..1
    state.confidence = Math.max(0.05, Math.min(0.95, 0.05 + normalized * 0.9));

    // ── Budget-Grenze prüfen ───────────────────────────────────────────────
    if (state.windowScore <= profile.pauseAt && !state.pausedManual) {
      if (profile.manualReset) {
        // Level 3: manuelle Reaktivierung nötig
        state.pausedManual = true;
        state.pausedUntil  = null;
        const msg = `🚨 KI-Sicherheitsstopp: ${triggerId} · Zu viele Fehler · Manuelle Freigabe nötig`;
        card?._showToast?.(msg);
        console.warn('[KI Budget]', msg);
      } else {
        // Level 1/2: automatischer Cooldown
        state.pausedUntil = Date.now() + profile.cooldownMs;
        const mins = Math.round(profile.cooldownMs / 60000);
        card?._showToast?.(`⏸ KI pausiert "${triggerId}" für ${mins < 60 ? mins + ' Min' : Math.round(mins/60) + ' Std'}`);
      }
    }

    // ── Positive Schwelle: Vertrauensstufe ankündigen ─────────────────────
    const prevScore = state.windowScore - delta * 0.5; // Annäherung
    if (state.windowScore >= profile.maxPos * 0.8 && prevScore < profile.maxPos * 0.8) {
      card?._showToast?.(`🎉 "${triggerId}" erreicht hohes Vertrauen · Stufe 3 verfügbar`);
    }

    this._saveMemory();

    // ── Meta-Learning nach jedem Feedback ────────────────────────────────
    this._learnFromFeedback(triggerId, delta, card);
    this._correctLearning(triggerId, card);

    card?._markDirty?.();
  },

  // ── Überstimmen: einmalig ─────────────────────────────────────────────────
  _overrideOnce(triggerId, card) {
    this._reward(triggerId, -1, 'jetzt_nicht', card);
    const state = this._triggerState(triggerId);
    // Snooze für 2 Stunden
    state.snoozedUntil = Date.now() + 2 * 60 * 60 * 1000;
    this._saveMemory();
    card?._showToast?.('⏸ KI merkt sich: jetzt nicht');
    card?._rebuildSidebar?.();
    card?._markDirty?.();
  },

  // ── Überstimmen: mit Grund ────────────────────────────────────────────────
  _overrideWithReason(triggerId, reason, card) {
    const state = this._triggerState(triggerId);
    this._reward(triggerId, -2, 'override_reason', card);

    // Regel dauerhaft speichern
    state.overrides.push({
      type:      'condition',
      reason,
      ts:        Date.now(),
      active:    true,
    });
    this._saveMemory();
    card?._showToast?.(`🚫 KI-Regel: "${reason}" gespeichert`);
    card?._rebuildSidebar?.();
    card?._markDirty?.();
  },

  // ── Überstimmen: komplett deaktivieren ────────────────────────────────────
  _overrideDisable(triggerId, card) {
    const state     = this._triggerState(triggerId);
    state.disabled  = true;
    this._saveMemory();
    card?._showToast?.('🔕 KI-Trigger deaktiviert (Sidebar → wieder aktivieren)');
    card?._rebuildSidebar?.();
    card?._markDirty?.();
  },

  // ── Wieder aktivieren ─────────────────────────────────────────────────────
  _overrideEnable(triggerId, card) {
    const state     = this._triggerState(triggerId);
    state.disabled  = false;
    state.snoozedUntil = null;
    this._saveMemory();
    card?._showToast?.('✅ KI-Trigger wieder aktiv');
    card?._rebuildSidebar?.();
    card?._markDirty?.();
  },

  // ── Parameter korrigieren ─────────────────────────────────────────────────
  _overrideParam(triggerId, paramKey, value, card) {
    const state             = this._triggerState(triggerId);
    state.params[paramKey]  = value;
    this._reward(triggerId, -1, `param_korrektur_${paramKey}`, card);
    this._saveMemory();
    card?._showToast?.(`✏ KI merkt: ${paramKey} = ${value}`);
  },

  // ── Prüfen ob Trigger aktuell gesperrt ist ────────────────────────────────
  _isTriggerBlocked(triggerId, context) {
    const state   = this._triggerState(triggerId);
    const profile = this._riskProfile(triggerId);

    if (state.disabled)      return { blocked: true, reason: 'Deaktiviert' };

    // Manuelle Pause (Level 3 Sicherheitsstopp)
    if (state.pausedManual)  return { blocked: true, reason: `🚨 Sicherheitsstopp · Manuelle Freigabe nötig` };

    // Automatischer Cooldown nach Budget-Unterschreitung
    if (state.pausedUntil && Date.now() < state.pausedUntil) {
      const rem  = Math.round((state.pausedUntil - Date.now()) / 60000);
      const label = rem < 60 ? `${rem} Min` : `${Math.round(rem/60)} Std`;
      return { blocked: true, reason: `⏸ Cooldown noch ${label} · Risiko: ${profile.label}` };
    } else if (state.pausedUntil && Date.now() >= state.pausedUntil) {
      // Cooldown abgelaufen → automatisch freigeben
      state.pausedUntil = null;
      this._saveMemory();
    }

    // Snooze (einmalig "jetzt nicht")
    if (state.snoozedUntil && Date.now() < state.snoozedUntil) {
      const rem = Math.round((state.snoozedUntil - Date.now()) / 60000);
      return { blocked: true, reason: `Pausiert noch ${rem} Min` };
    }

    // Aktive Bedingungsregeln prüfen
    for (const rule of (state.overrides || [])) {
      if (!rule.active) continue;
      if (rule.reason === 'nie_wenn_gast' && context?.isGuest)    return { blocked: true, reason: 'Nie wenn Gast da' };
      if (rule.reason === 'nur_morgens'   && context?.hour >= 12) return { blocked: true, reason: 'Nur morgens erlaubt' };
      if (rule.reason === 'nie_nachts'    && context?.isNight)    return { blocked: true, reason: 'Nicht nachts' };
      if (rule.reason === 'manuell')                               return { blocked: true, reason: rule.detail || 'Manuelle Regel' };
    }
    return { blocked: false };
  },

  // ── Stilles Feedback: HA-Zustand nach Empfehlung beobachten ──────────────
  _startSilentWatch(triggerId, entityId, expectedState, card) {
    if (this._kiWatchTimer) clearTimeout(this._kiWatchTimer);

    // Nach 10 Min prüfen ob Entity noch im erwarteten Zustand ist
    this._kiWatchTimer = setTimeout(() => {
      const hass        = card?._hass;
      if (!hass || !entityId) return;
      const current     = hass.states[entityId]?.state;
      const stillActive = this._isActiveState(current);

      if (stillActive) {
        // User hat nicht eingegriffen → positives Feedback
        this._reward(triggerId, +1, 'stilles_ok', card);
      } else {
        // User hat manuell geändert → negatives Feedback
        this._reward(triggerId, -2, 'manuell_geaendert', card);
        card?._showToast?.('🤔 KI hat gelernt: nächstes Mal vorsichtiger');
      }
    }, 10 * 60 * 1000);
  },

  // ── Trigger-Konfidenz aus Gedächtnis in Trigger-Liste einrechnen ──────────
  _applyMemoryToTriggers(triggers) {
    return triggers.map(t => {
      const state    = this._triggerState(t.id);
      const profile  = this._riskProfile(t.id);
      const blocked  = this._isTriggerBlocked(t.id, t.context || {});
      const score    = this._windowScore(t.id);

      // Meta-Learning: Vorschlag-Score berechnen
      const proposal = this._buildProposalScore(t.id, t.recommended ? (state.confidence || 0.5) : 0.3);
      // Erklärung generieren
      const explanation = this._explainRecommendation(t.id, t);

      const relScore = score / (profile.maxPos || 1);
      const behavior = relScore >= 0.8  ? 'mutig'
                     : relScore >= 0.3  ? 'normal'
                     : relScore >= -0.3 ? 'vorsichtig'
                     : relScore >= -0.6 ? 'zurückhaltend'
                     : 'pausiert';

      const budgetPct   = (score - profile.maxNeg) / (profile.maxPos - profile.maxNeg);
      const budgetLabel = `${score >= 0 ? '+' : ''}${score.toFixed(1)} / ${profile.maxPos}`;

      return {
        ...t,
        score,
        budgetPct:    Math.max(0, Math.min(1, budgetPct)),
        budgetLabel,
        behavior,
        riskLevel:    profile.level,
        riskLabel:    profile.label,
        maxPos:       profile.maxPos,
        pauseAt:      profile.pauseAt,
        confidence:   state.confidence   ?? 0.5,
        disabled:     state.disabled     || false,
        pausedManual: state.pausedManual || false,
        snoozed:      state.snoozedUntil && Date.now() < state.snoozedUntil,
        overrides:    state.overrides    || [],
        params:       state.params       || {},
        memBlocked:   blocked.blocked,
        memReason:    blocked.reason,
        acceptRate:   state.runCount > 0
          ? Math.round((state.acceptCount / state.runCount) * 100)
          : null,
        // Meta-Learning Felder
        proposalScore:   proposal.score,
        proposalPhase:   proposal.phase,
        proposalFactors: proposal.factors,
        metaRecommend:   proposal.recommend,
        explanation,
        // Finale Empfehlung = KI-Logik UND Meta-Learning UND nicht gesperrt
        recommended:  t.recommended && proposal.recommend && !blocked.blocked && !state.disabled,
      };
    });
  },

  // ══════════════════════════════════════════════════════════════════════════
  // TRIGGER-UI MIT ÜBERSTIMMEN
  // ══════════════════════════════════════════════════════════════════════════

  // ── Trigger-Empfehlungen zeichnen (v1.4: mit Konflikt-Anzeige) ──────────
  _drawTriggersV2(ctx, w, y, pad, availH, triggers) {
    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('TRIGGER-EMPFEHLUNGEN', pad, y + 9);
    y += 16;

    // ── Konflikt-Banner ───────────────────────────────────────────────────
    const conflicts = triggers._conflicts || [];
    if (conflicts.length > 0) {
      conflicts.forEach(c => {
        const bw    = w - pad * 2;
        const bh    = 28;
        const col   = c.severity === 'warn' ? '#f59e0b' : '#38bdf8';

        ctx.fillStyle = col + '18';
        this._roundRect(ctx, pad, y, bw, bh, 5);
        ctx.fill();
        ctx.strokeStyle = col + '66';
        ctx.lineWidth = 1;
        this._roundRect(ctx, pad, y, bw, bh, 5);
        ctx.stroke();

        ctx.font = '9px sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(c.severity === 'warn' ? '⚡' : 'ℹ', pad + 7, y + bh / 2);

        ctx.fillStyle = col;
        ctx.font = 'bold 8px sans-serif';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(c.reason, pad + 20, y + 13);

        ctx.fillStyle = '#475569';
        ctx.font = '7px sans-serif';
        ctx.fillText(`→ ${c.suggestion}`, pad + 20, y + 23);

        y += bh + 4;
      });
      y += 4;
    }

    if (!triggers || !triggers.length) {
      ctx.fillStyle = '#334155';
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Keine Trigger-Entities konfiguriert', w / 2, y + availH / 2);
      return;
    }

    const rowH = 60;
    triggers.forEach((t, i) => {
      const ry  = y + i * rowH;
      const bw  = w - pad * 2;
      if (ry + rowH > y + availH) return;

      const isOk  = t.recommended && !t.memBlocked && !t.disabled;
      const color = t.disabled    ? '#334155'
                  : t.pausedManual? '#dc2626'
                  : t.snoozed     ? '#92400e'
                  : isOk          ? '#22c55e'
                  : '#64748b';

      // Hintergrund
      ctx.fillStyle = t.disabled     ? '#0a0f18'
                    : t.pausedManual ? '#1f0808'
                    : isOk           ? '#0c2a1a'
                    : '#0f172a';
      this._roundRect(ctx, pad, ry, bw, rowH - 4, 6);
      ctx.fill();
      ctx.strokeStyle = color + '55';
      ctx.lineWidth = 1;
      this._roundRect(ctx, pad, ry, bw, rowH - 4, 6);
      ctx.stroke();

      // Risiko-Streifen links (Level-Farbe)
      const riskCol = t.riskLevel === 3 ? '#ef4444'
                    : t.riskLevel === 2 ? '#f59e0b'
                    : '#22c55e';
      ctx.fillStyle = riskCol;
      this._roundRect(ctx, pad, ry, 3, rowH - 4, 2);
      ctx.fill();

      // Icon + Name + Risiko-Badge
      ctx.font = '13px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(t.icon, pad + 8, ry + 13);

      ctx.fillStyle = '#e2e8f0';
      ctx.font = 'bold 9px sans-serif';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(t.label, pad + 24, ry + 16);

      // Risiko-Label (klein)
      ctx.fillStyle = riskCol;
      ctx.font = '6.5px sans-serif';
      ctx.fillText(`Risiko: ${t.riskLabel || '–'}`, pad + 24, ry + 26);

      // Verhaltens-Modus
      const behaviorEmoji = { mutig: '🚀', normal: '✅', vorsichtig: '🤔', zurückhaltend: '⚠', pausiert: '🛑' };
      const behaviorColor = { mutig: '#22c55e', normal: '#38bdf8', vorsichtig: '#f59e0b', zurückhaltend: '#ef4444', pausiert: '#7f1d1d' };
      const beh = t.behavior || 'normal';
      ctx.fillStyle = behaviorColor[beh] || '#64748b';
      ctx.font = '7px sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(`${behaviorEmoji[beh] || ''} ${beh}`, w - pad - 8, ry + 16);

      // Grund / Blockierung
      const reasonText = t.memBlocked ? `⛔ ${t.memReason}`
                       : t.disabled   ? '🔕 Deaktiviert'
                       : t.reason;
      ctx.fillStyle = t.memBlocked || t.pausedManual ? '#fca5a5' : '#64748b';
      ctx.font = '7.5px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(reasonText, pad + 8, ry + 36);

      // ── Budget-Balken ──────────────────────────────────────────────────
      const bBarW = bw - 16;
      const bBarX = pad + 8;
      const bBarY = ry + 42;
      const bBarH = 7;

      // Hintergrund
      ctx.fillStyle = '#1e293b';
      this._roundRect(ctx, bBarX, bBarY, bBarW, bBarH, 3);
      ctx.fill();

      // Pause-Schwelle markieren
      const pausePct = (t.pauseAt - (-(t.maxPos || 15))) / ((t.maxPos || 15) * 2);
      const pauseX   = bBarX + pausePct * bBarW;
      ctx.strokeStyle = '#ef444488';
      ctx.lineWidth   = 1;
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(pauseX, bBarY - 1);
      ctx.lineTo(pauseX, bBarY + bBarH + 1);
      ctx.stroke();
      ctx.setLineDash([]);

      // Mitte (0-Linie)
      const midX = bBarX + bBarW / 2;
      ctx.strokeStyle = '#334155';
      ctx.lineWidth   = 0.5;
      ctx.beginPath();
      ctx.moveTo(midX, bBarY);
      ctx.lineTo(midX, bBarY + bBarH);
      ctx.stroke();

      // Füllstand (Budget-Pct: 0=leer=maxNeg, 1=voll=maxPos)
      const fillW = Math.max(0, Math.min(bBarW, Math.round(bBarW * (t.budgetPct || 0))));
      const fillColor = (t.budgetPct || 0) > 0.6 ? '#22c55e'
                      : (t.budgetPct || 0) > 0.3 ? '#f59e0b'
                      : '#ef4444';
      if (fillW > 0) {
        ctx.fillStyle = fillColor + 'cc';
        this._roundRect(ctx, bBarX, bBarY, fillW, bBarH, 3);
        ctx.fill();
      }

      // Budget-Label
      ctx.fillStyle = '#475569';
      ctx.font = '6.5px sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(t.budgetLabel || '', bBarX + bBarW, bBarY + bBarH + 7);
    });
  },

  // ── Trigger-Sidebar mit Überstimm-UI ──────────────────────────────────────
  _buildTriggerSidebarSection(scroll, triggers, card) {
    if (!triggers?.length) return;

    const hdr = document.createElement('div');
    hdr.style.cssText = 'font-size:8px;font-weight:700;color:#94a3b8;margin:10px 0 6px;letter-spacing:0.5px';
    hdr.textContent = 'TRIGGER-STEUERUNG';
    scroll.appendChild(hdr);

    // ── Konflikt-Zusammenfassung ──────────────────────────────────────────
    const conflicts = triggers._conflicts || [];
    if (conflicts.length > 0) {
      conflicts.forEach(c => {
        const cBox = document.createElement('div');
        const col  = c.severity === 'warn' ? '#f59e0b' : '#38bdf8';
        cBox.style.cssText = `background:${col}11;border:1px solid ${col}44;border-radius:5px;padding:6px 8px;margin-bottom:5px`;
        cBox.innerHTML = `
          <div style="font-size:8px;font-weight:700;color:${col};margin-bottom:2px">
            ${c.severity === 'warn' ? '⚡' : 'ℹ'} Konflikt erkannt
          </div>
          <div style="font-size:7.5px;color:#94a3b8;margin-bottom:3px">${c.reason}</div>
          <div style="font-size:7px;color:#475569">→ ${c.suggestion}</div>
        `;
        scroll.appendChild(cBox);
      });
    }

    triggers.forEach(t => {
      const box = document.createElement('div');
      const isOk = t.recommended && !t.memBlocked && !t.disabled;
      const borderCol = t.disabled ? '#334155' : isOk ? '#22c55e55' : '#ef444455';
      box.style.cssText = `background:var(--surf2);border:1px solid ${borderCol};border-radius:6px;padding:8px;margin-bottom:6px`;

      // Header
      const head = document.createElement('div');
      head.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:5px';
      const riskCol = t.riskLevel === 3 ? '#fca5a5' : t.riskLevel === 2 ? '#fcd34d' : '#86efac';
      head.innerHTML = `
        <span style="font-size:10px;font-weight:700;color:#e2e8f0">${t.icon} ${t.label}</span>
        <span style="font-size:7px;background:${riskCol}22;color:${riskCol};border:1px solid ${riskCol}44;border-radius:3px;padding:1px 5px">
          Risiko ${t.riskLabel || '?'}
        </span>
      `;
      box.appendChild(head);

      // Sicherheitsstopp-Banner (Level 3)
      if (t.pausedManual) {
        const banner = document.createElement('div');
        banner.style.cssText = 'background:#7f1d1d;border-radius:4px;padding:6px 8px;margin-bottom:6px';
        banner.innerHTML = `
          <div style="font-size:8px;font-weight:700;color:#fca5a5;margin-bottom:4px">🚨 Sicherheitsstopp aktiv</div>
          <div style="font-size:7px;color:#f87171;margin-bottom:6px">Zu viele Fehler · Manuelle Freigabe nötig</div>
        `;
        const releaseBtn = document.createElement('button');
        releaseBtn.style.cssText = 'width:100%;padding:4px;border-radius:4px;border:1px solid #22c55e44;background:#14532d;color:#4ade80;font-size:8px;font-weight:700;cursor:pointer';
        releaseBtn.textContent = '✅ Manuell freigeben';
        releaseBtn.onclick = () => {
          const st = this._triggerState(t.id);
          st.pausedManual = false;
          st.windowScore  = 0;  // Reset nach manuellem Eingriff
          // Auch Feedback-History für diesen Trigger löschen (frischer Start)
          const mem = this._loadMemory();
          mem.feedback = mem.feedback.filter(f => f.triggerId !== t.id);
          this._saveMemory();
          card._showToast?.('✅ Freigegeben · Score zurückgesetzt');
          card._rebuildSidebar?.();
          card._markDirty?.();
        };
        banner.appendChild(releaseBtn);
        box.appendChild(banner);
      }

      // Meta-Learning Erklärung
      if (t.explanation) {
        const explBox = document.createElement('div');
        explBox.style.cssText = 'background:#0f172a;border-radius:4px;padding:5px 7px;margin-bottom:5px';
        explBox.innerHTML = `
          <div style="font-size:7px;font-weight:700;color:#475569;margin-bottom:3px">🧠 WARUM EMPFEHLE ICH DAS?</div>
          <div style="font-size:7.5px;color:#64748b;white-space:pre-line;line-height:1.5">${t.explanation}</div>
        `;
        if (t.proposalPhase > 0) {
          const phaseLabel = ['','Phase 1','Phase 2','Phase 3'][t.proposalPhase] || '';
          explBox.innerHTML += `<div style="font-size:6.5px;color:#334155;margin-top:3px">Meta-Learning ${phaseLabel} · Score: ${Math.round((t.proposalScore||0)*100)}%</div>`;
        }
        box.appendChild(explBox);
      }

      // Budget-Anzeige
      const budgetRow = document.createElement('div');      budgetRow.style.cssText = 'display:flex;align-items:center;gap:6px;margin-bottom:5px';
      const budgetPct = t.budgetPct ?? 0.5;
      const budgetColor = budgetPct > 0.6 ? '#22c55e' : budgetPct > 0.3 ? '#f59e0b' : '#ef4444';
      const behaviorLabel = { mutig: '🚀 Mutig', normal: '✅ Normal', vorsichtig: '🤔 Vorsichtig', zurückhaltend: '⚠ Zurückhaltend', pausiert: '🛑 Pausiert' };
      budgetRow.innerHTML = `
        <span style="font-size:7px;color:#475569;white-space:nowrap">Budget:</span>
        <div style="flex:1;background:#1e293b;border-radius:4px;height:7px;overflow:hidden;position:relative">
          <div style="width:${Math.round(budgetPct*100)}%;height:100%;background:${budgetColor};border-radius:4px;transition:width 0.4s"></div>
        </div>
        <span style="font-size:7px;color:${budgetColor};font-weight:700;white-space:nowrap">${t.budgetLabel || ''}</span>
        <span style="font-size:7px;color:${budgetColor}">${(behaviorLabel[t.behavior] || '')}</span>
      `;
      box.appendChild(budgetRow);

      // Feedback-Buttons (nach letzter Empfehlung)
      const fbRow = document.createElement('div');
      fbRow.style.cssText = 'display:flex;gap:4px;margin-bottom:6px';

      const thumbUp = document.createElement('button');
      thumbUp.style.cssText = 'flex:1;padding:4px;border-radius:4px;border:1px solid #22c55e44;background:#22c55e11;color:#22c55e;font-size:10px;cursor:pointer';
      thumbUp.textContent = '👍';
      thumbUp.title = 'Das war gut!';
      thumbUp.onclick = () => {
        this._reward(t.id, +3, 'daumen_hoch', card);
        const st = this._triggerState(t.id);
        st.acceptCount = (st.acceptCount || 0) + 1;
        st.runCount    = (st.runCount    || 0) + 1;
        this._saveMemory();
        card._showToast?.('👍 +3 Punkte · KI lernt');
        card._rebuildSidebar?.();
      };

      const thumbDown = document.createElement('button');
      thumbDown.style.cssText = 'flex:1;padding:4px;border-radius:4px;border:1px solid #ef444444;background:#ef444411;color:#ef4444;font-size:10px;cursor:pointer';
      thumbDown.textContent = '👎';
      thumbDown.title = 'Das war schlecht';
      thumbDown.onclick = () => {
        this._reward(t.id, -3, 'daumen_runter', card);
        const st    = this._triggerState(t.id);
        st.runCount = (st.runCount || 0) + 1;
        this._saveMemory();
        card._showToast?.('👎 −3 Punkte · KI lernt');
        card._rebuildSidebar?.();
      };

      const snooze = document.createElement('button');
      snooze.style.cssText = 'flex:1;padding:4px;border-radius:4px;border:1px solid #f59e0b44;background:#f59e0b11;color:#f59e0b;font-size:9px;cursor:pointer';
      snooze.textContent = '⏸ Jetzt nicht';
      snooze.onclick = () => this._overrideOnce(t.id, card);

      fbRow.appendChild(thumbUp);
      fbRow.appendChild(thumbDown);
      fbRow.appendChild(snooze);
      box.appendChild(fbRow);

      // Erweiterte Optionen (aufklappbar)
      const details = document.createElement('details');
      details.style.cssText = 'margin-top:4px';
      const summary = document.createElement('summary');
      summary.style.cssText = 'font-size:7.5px;color:#475569;cursor:pointer;user-select:none';
      summary.textContent = '⚙ Mehr Optionen';
      details.appendChild(summary);

      const opts = document.createElement('div');
      opts.style.cssText = 'margin-top:6px;display:flex;flex-direction:column;gap:4px';

      // Regel-Buttons
      const REASONS = [
        { key: 'nie_wenn_gast', label: '🚫 Nie wenn Gast da' },
        { key: 'nur_morgens',   label: '🌅 Nur morgens' },
        { key: 'nie_nachts',    label: '🌙 Nie nachts' },
      ];
      REASONS.forEach(r => {
        const active = (t.overrides || []).some(o => o.reason === r.key && o.active);
        const btn    = document.createElement('button');
        btn.style.cssText = `width:100%;padding:4px;border-radius:4px;font-size:8px;cursor:pointer;
          border:1px solid ${active ? '#ef4444' : '#334155'};
          background:${active ? '#7f1d1d22' : 'transparent'};
          color:${active ? '#fca5a5' : '#64748b'}`;
        btn.textContent = active ? `✓ ${r.label} (aktiv — klicken zum Entfernen)` : r.label;
        btn.onclick = () => {
          if (active) {
            const st = this._triggerState(t.id);
            st.overrides = st.overrides.filter(o => o.reason !== r.key);
            this._saveMemory();
            card._showToast?.('✅ Regel entfernt');
          } else {
            this._overrideWithReason(t.id, r.key, card);
          }
          card._rebuildSidebar?.();
        };
        opts.appendChild(btn);
      });

      // Komplett deaktivieren / aktivieren
      const disableBtn = document.createElement('button');
      disableBtn.style.cssText = `width:100%;padding:4px;border-radius:4px;font-size:8px;cursor:pointer;
        border:1px solid ${t.disabled ? '#22c55e44' : '#ef444444'};
        background:${t.disabled ? '#14532d22' : '#7f1d1d22'};
        color:${t.disabled ? '#4ade80' : '#fca5a5'}`;
      disableBtn.textContent = t.disabled ? '✅ Wieder aktivieren' : '🔕 Komplett deaktivieren';
      disableBtn.onclick = () => {
        if (t.disabled) this._overrideEnable(t.id, card);
        else            this._overrideDisable(t.id, card);
      };
      opts.appendChild(disableBtn);

      // Aktive Regeln anzeigen
      const activeRules = (t.overrides || []).filter(o => o.active);
      if (activeRules.length) {
        const ruleList = document.createElement('div');
        ruleList.style.cssText = 'background:#0f172a;border-radius:4px;padding:5px;font-size:7px;color:#475569';
        ruleList.innerHTML = '<div style="color:#334155;margin-bottom:3px">Aktive Regeln:</div>' +
          activeRules.map(r => `• ${r.reason}`).join('<br>');
        opts.appendChild(ruleList);
      }

      details.appendChild(opts);
      box.appendChild(details);

      scroll.appendChild(box);
    });
  },

  // ══════════════════════════════════════════════════════════════════════════
  // FEEDBACK-ENGAGEMENT SYSTEM (v1.3.0)
  // Alle Methoden optional — User konfiguriert selbst was er will
  // ══════════════════════════════════════════════════════════════════════════

  // ── Fortschritts-Profil berechnen ─────────────────────────────────────────
  // Zeigt wie gut die KI den User bereits kennt
  _buildProgressProfile() {
    const mem      = this._loadMemory();
    const feedback = mem.feedback || [];
    const total    = feedback.length;

    // Meilensteine (was die KI ab X Feedbacks kann)
    const MILESTONES = [
      { at: 1,   label: 'Erstes Feedback',       desc: 'Ich fange an dich kennenzulernen',              icon: '👋' },
      { at: 5,   label: 'Erste Signale',          desc: 'Ich erkenne erste Tendenzen',                  icon: '📡' },
      { at: 10,  label: 'Tagesrhythmus',          desc: 'Ich kenne deinen groben Tagesrhythmus',        icon: '🕐' },
      { at: 20,  label: 'Persönlichkeit erkannt', desc: 'Ich weiss wie du Entscheidungen triffst',      icon: '🎭' },
      { at: 35,  label: 'Kontext-Lernen',         desc: 'Ich verbinde Wetter + Zeit + Verhalten',       icon: '🔗' },
      { at: 50,  label: 'Tiefes Verständnis',     desc: 'Ich kenne deine Gewohnheiten gut',             icon: '🧠' },
      { at: 100, label: 'Experte',                desc: 'Ich bin ein echter Kenner deines Haushalts',   icon: '🏆' },
    ];

    const reached  = MILESTONES.filter(m => total >= m.at);
    const next     = MILESTONES.find(m => total < m.at);
    const current  = reached[reached.length - 1] || null;
    const pct      = next ? Math.round((total / next.at) * 100) : 100;

    // Persönlichkeits-Typ ableiten (ab 20 Feedbacks)
    let personality = null;
    if (total >= 20) {
      const pos    = feedback.filter(f => f.delta > 0).length;
      const neg    = feedback.filter(f => f.delta < 0).length;
      const rules  = feedback.filter(f => f.reason === 'override_reason').length;
      const ratio  = pos / Math.max(1, total);

      if (ratio > 0.7)            personality = { type: 'offen',       label: 'Experimentierfreudig', icon: '🚀', desc: 'Du probierst gerne neue Dinge aus' };
      else if (ratio < 0.35)      personality = { type: 'vorsichtig',  label: 'Bedächtig',            icon: '🤔', desc: 'Du bevorzugst bewährte Abläufe' };
      else if (rules > total*0.2) personality = { type: 'präzise',     label: 'Präzise',              icon: '🎯', desc: 'Du weisst genau was du willst' };
      else                        personality = { type: 'ausgewogen',   label: 'Ausgewogen',           icon: '⚖',  desc: 'Du bewertest situationsabhängig' };
    }

    // Trigger-Statistiken
    const triggerStats = {};
    Object.entries(mem.triggers || {}).forEach(([id, st]) => {
      triggerStats[id] = {
        acceptRate: st.runCount > 0 ? Math.round((st.acceptCount||0) / st.runCount * 100) : null,
        runCount:   st.runCount || 0,
      };
    });

    return { total, current, next, pct, reached, personality, triggerStats };
  },

  // ── Fortschritts-Canvas zeichnen ──────────────────────────────────────────
  _drawProgress(ctx, w, y, pad, availH) {
    const prog = this._buildProgressProfile();

    // Header
    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('KI-FORTSCHRITT · WIE GUT KENNT SIE DICH?', pad, y + 9);
    y += 18;

    // Haupt-Fortschrittsbalken
    const barW = w - pad * 2;
    const barH = 16;
    ctx.fillStyle = '#1e293b';
    this._roundRect(ctx, pad, y, barW, barH, 8);
    ctx.fill();

    const fillW = Math.round(barW * (prog.pct / 100));
    if (fillW > 0) {
      const grad = ctx.createLinearGradient(pad, 0, pad + barW, 0);
      grad.addColorStop(0, '#0ea5e9');
      grad.addColorStop(1, '#8b5cf6');
      ctx.fillStyle = grad;
      this._roundRect(ctx, pad, y, fillW, barH, 8);
      ctx.fill();
    }

    // Prozent + Feedback-Anzahl
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${prog.pct}%  ·  ${prog.total} Feedbacks`, pad + barW / 2, y + barH / 2);
    y += barH + 8;

    // Aktueller Meilenstein
    if (prog.current) {
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(`${prog.current.icon} ${prog.current.label}`, pad, y + 12);
      ctx.fillStyle = '#475569';
      ctx.font = '8px sans-serif';
      ctx.fillText(prog.current.desc, pad, y + 24);
      y += 32;
    }

    // Nächster Meilenstein
    if (prog.next) {
      ctx.fillStyle = '#334155';
      ctx.font = '8px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(`Nächstes Ziel: ${prog.next.icon} ${prog.next.label} (bei ${prog.next.at} Feedbacks)`, pad, y + 10);
      y += 18;
    }

    // Persönlichkeits-Box
    if (prog.personality) {
      ctx.fillStyle = '#8b5cf622';
      this._roundRect(ctx, pad, y, w - pad*2, 36, 6);
      ctx.fill();
      ctx.strokeStyle = '#8b5cf644';
      ctx.lineWidth = 1;
      this._roundRect(ctx, pad, y, w - pad*2, 36, 6);
      ctx.stroke();

      ctx.font = '14px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(prog.personality.icon, pad + 10, y + 18);
      ctx.fillStyle = '#a78bfa';
      ctx.font = 'bold 9px sans-serif';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(prog.personality.label, pad + 28, y + 16);
      ctx.fillStyle = '#64748b';
      ctx.font = '8px sans-serif';
      ctx.fillText(prog.personality.desc, pad + 28, y + 28);
      y += 44;
    }

    // Meilenstein-Timeline
    const timelineY = y + 6;
    const tW        = (w - pad * 2) / 7;
    const MILESTONES = [1, 5, 10, 20, 35, 50, 100];
    const ICONS      = ['👋','📡','🕐','🎭','🔗','🧠','🏆'];

    MILESTONES.forEach((m, i) => {
      const mx      = pad + i * tW + tW / 2;
      const reached = prog.total >= m;

      ctx.fillStyle = reached ? '#0ea5e9' : '#1e293b';
      ctx.beginPath();
      ctx.arc(mx, timelineY, 5, 0, Math.PI * 2);
      ctx.fill();

      if (i < MILESTONES.length - 1) {
        ctx.strokeStyle = prog.total >= MILESTONES[i+1] ? '#0ea5e9' : '#1e293b';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(mx + 5, timelineY);
        ctx.lineTo(mx + tW - 5, timelineY);
        ctx.stroke();
      }

      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(ICONS[i], mx, timelineY + 14);

      ctx.fillStyle = reached ? '#38bdf8' : '#334155';
      ctx.font = '6px sans-serif';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(m, mx, timelineY - 8);
    });

    return y + 40;
  },

  // ── Stilles Feedback maximieren ───────────────────────────────────────────
  // Beobachtet HA-Zustände nach Empfehlung — kein aktives Zutun nötig
  _startSilentWatchEnhanced(triggerId, entityId, card, delayMs) {
    if (this._kiWatchTimer) clearTimeout(this._kiWatchTimer);
    const delay = delayMs || 10 * 60 * 1000; // Standard: 10 Min

    this._kiWatchTimer = setTimeout(() => {
      const hass   = card?._hass;
      if (!hass || !entityId) return;

      const current    = hass.states[entityId]?.state;
      const stillActive = this._isActiveState(current);

      // Stilles Feedback ist schwächer als aktives (Gewicht 0.4)
      if (stillActive) {
        // Läuft noch → User hat nicht eingegriffen → leicht positiv
        this._rewardWeighted(triggerId, +1, 'stilles_ok', 0.4, card);
        // Jetzt um aktives Feedback bitten falls konfiguriert
        this._requestActiveFeedback(triggerId, card, 'nach_ausfuehrung');
      } else {
        // Wurde geändert → negatives stilles Feedback, stärker gewichtet
        this._rewardWeighted(triggerId, -2, 'stilles_nein', 0.7, card);
        card?._showToast?.('🤔 KI hat gelernt — nächstes Mal angepasst');
      }
    }, delay);
  },

  // ── Gewichtetes Reward (für stilles Feedback) ─────────────────────────────
  _rewardWeighted(triggerId, delta, reason, weight, card) {
    // Stilles Feedback mit reduziertem Gewicht ins Log
    const weightedDelta = delta * weight;
    const mem = this._loadMemory();
    mem.feedback.push({
      triggerId,
      delta:   weightedDelta,
      raw:     delta,
      reason,
      weight,
      ts:      Date.now(),
      silent:  true,
    });
    // Score neu berechnen
    const state        = this._triggerState(triggerId);
    state.windowScore  = this._windowScore(triggerId);
    const profile      = this._riskProfile(triggerId);
    const range        = profile.maxPos - profile.maxNeg;
    const normalized   = (state.windowScore - profile.maxNeg) / range;
    state.confidence   = Math.max(0.05, Math.min(0.95, 0.05 + normalized * 0.9));
    this._saveMemory();
    card?._markDirty?.();
  },

  // ── Aktives Feedback anfordern ────────────────────────────────────────────
  // Zeitpunkt ist konfigurierbar: sofort / nach 30 Min / abends
  _requestActiveFeedback(triggerId, card, timing) {
    const cfg      = card?._opts?.ki_cfg || {};
    const notifCfg = cfg.notifications || {};
    if (!notifCfg.enabled) return;

    const delayMs = timing === 'sofort'            ? 0
                  : timing === 'nach_ausfuehrung'  ? 0
                  : timing === '30min'             ? 30 * 60 * 1000
                  : timing === 'abends'            ? this._msUntilEvening()
                  : 0;

    setTimeout(() => {
      this._sendFeedbackNotification(triggerId, card);
    }, delayMs);
  },

  // ── HA Notification senden ────────────────────────────────────────────────
  async _sendFeedbackNotification(triggerId, card) {
    const hass     = card?._hass;
    const cfg      = card?._opts?.ki_cfg || {};
    const notifCfg = cfg.notifications || {};
    const target   = notifCfg.notify_service || 'notify.notify';

    if (!hass || !notifCfg.enabled) return;

    const trigger = this._kiData?.triggers?.find(t => t.id === triggerId);
    const label   = trigger?.label || triggerId;

    try {
      await hass.callService('notify', target.replace('notify.', ''), {
        title: `🧠 KI-Feedback`,
        message: `${trigger?.icon || '◆'} "${label}" wurde ausgeführt. War das gut?`,
        data: {
          actions: [
            { action: `ki_thumbup_${triggerId}`,   title: '👍 Gut' },
            { action: `ki_thumbdown_${triggerId}`, title: '👎 Schlecht' },
            { action: `ki_snooze_${triggerId}`,    title: '⏸ Später' },
          ]
        }
      });
    } catch (e) {
      // Notification fehlgeschlagen — still ignorieren
      console.warn('[KI Notification]', e.message);
    }
  },

  // ── Tägliche Micro-Frage ──────────────────────────────────────────────────
  _scheduleDailyQuestion(card) {
    const cfg      = card?._opts?.ki_cfg || {};
    const notifCfg = cfg.notifications || {};
    if (!notifCfg.daily_question) return;
    if (this._kiDailyTimer) clearTimeout(this._kiDailyTimer);

    // Jeden Tag zur konfigurierten Zeit (Standard: 20:00)
    this._kiDailyTimer = setTimeout(() => {
      this._sendDailyQuestion(card);
      this._scheduleDailyQuestion(card); // neu planen für morgen
    }, this._msUntilTime(notifCfg.daily_hour || 20, 0));
  },

  async _sendDailyQuestion(card) {
    const hass     = card?._hass;
    const cfg      = card?._opts?.ki_cfg || {};
    const notifCfg = cfg.notifications || {};

    // Abend-Zusammenfassung bevorzugen wenn konfiguriert
    if (notifCfg.evening_summary) {
      return this._sendEveningSummary(card);
    }

    const target = notifCfg.notify_service || 'notify.notify';
    if (!hass || !notifCfg.daily_question) return;

    const prog = this._buildProgressProfile();
    const mem  = this._loadMemory();

    // Was war heute die auffälligste KI-Aktion?
    const todayFeedback = (mem.feedback || []).filter(f => {
      const d = new Date(f.ts);
      const n = new Date();
      return d.getDate() === n.getDate() && d.getMonth() === n.getMonth();
    });

    const msg = todayFeedback.length > 0
      ? `Heute: ${todayFeedback.length} KI-Aktionen. War alles in Ordnung?`
      : `Heute gab es nichts zu automatisieren. Alles gut?`;

    try {
      await hass.callService('notify', target.replace('notify.', ''), {
        title: '🧠 KI-Tagesfrage',
        message: msg,
        data: {
          actions: [
            { action: 'ki_daily_yes', title: '✅ Ja, alles gut' },
            { action: 'ki_daily_no',  title: '❌ Nein, etwas war falsch' },
          ]
        }
      });
    } catch (e) {
      console.warn('[KI Daily]', e.message);
    }
  },

  // ── Wöchentlicher KI-Bericht ──────────────────────────────────────────────
  _scheduleWeeklyReport(card) {
    const cfg      = card?._opts?.ki_cfg || {};
    const notifCfg = cfg.notifications || {};
    if (!notifCfg.weekly_report) return;
    if (this._kiWeeklyTimer) clearTimeout(this._kiWeeklyTimer);

    this._kiWeeklyTimer = setTimeout(() => {
      this._sendWeeklyReport(card);
      this._scheduleWeeklyReport(card);
    }, this._msUntilNextSunday(notifCfg.weekly_hour || 10));
  },

  async _sendWeeklyReport(card) {
    const hass     = card?._hass;
    const cfg      = card?._opts?.ki_cfg || {};
    const notifCfg = cfg.notifications || {};
    const target   = notifCfg.notify_service || 'notify.notify';
    if (!hass || !notifCfg.weekly_report) return;

    const mem    = this._loadMemory();
    const now    = Date.now();
    const weekMs = 7 * 24 * 60 * 60 * 1000;

    const weekFeedback = (mem.feedback || []).filter(f => now - f.ts < weekMs);
    const accepted     = weekFeedback.filter(f => f.delta > 0 && !f.silent).length;
    const rejected     = weekFeedback.filter(f => f.delta < 0 && !f.silent).length;
    const silent       = weekFeedback.filter(f => f.silent).length;
    const prog         = this._buildProgressProfile();

    // Gelernte Fakten diese Woche
    const learnings = [];
    Object.entries(mem.triggers || {}).forEach(([id, st]) => {
      if ((st.overrides || []).some(o => now - o.ts < weekMs && o.active)) {
        learnings.push(`${id}: neue Regel gespeichert`);
      }
    });

    const msg = [
      `📊 Woche: ${weekFeedback.length} Aktionen`,
      `✅ ${accepted} akzeptiert · ❌ ${rejected} abgelehnt · 🔇 ${silent} still`,
      prog.personality ? `Dein Typ: ${prog.personality.icon} ${prog.personality.label}` : '',
      learnings.length ? `Gelernt: ${learnings.slice(0,2).join(', ')}` : '',
      `Fortschritt: ${prog.total} Feedbacks · ${prog.pct}% zum nächsten Ziel`,
    ].filter(Boolean).join('\n');

    try {
      await hass.callService('notify', target.replace('notify.', ''), {
        title: '🧠 KI-Wochenbericht',
        message: msg,
        data: {
          actions: [
            { action: 'ki_weekly_ok',     title: '✅ Alles korrekt' },
            { action: 'ki_weekly_review', title: '🔍 Details ansehen' },
          ]
        }
      });
    } catch (e) {
      console.warn('[KI Weekly]', e.message);
    }
  },

  // ── Fortschritts-Anzeige in Sidebar ──────────────────────────────────────
  _buildProgressSidebarSection(scroll, card) {
    const prog = this._buildProgressProfile();
    const cfg  = card._opts?.ki_cfg || {};
    const notifCfg = cfg.notifications || {};

    const box = document.createElement('div');
    box.style.cssText = 'background:var(--surf2);border:1px solid #0ea5e933;border-radius:8px;padding:10px;margin-bottom:8px';

    // Fortschritts-Header
    box.innerHTML = `
      <div style="font-size:8px;font-weight:700;color:#94a3b8;letter-spacing:0.5px;margin-bottom:6px">
        🧠 KI KENNT DICH ZU…
      </div>
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
        <div style="flex:1;background:#1e293b;border-radius:8px;height:12px;overflow:hidden">
          <div style="width:${prog.pct}%;height:100%;
            background:linear-gradient(90deg,#0ea5e9,#8b5cf6);
            border-radius:8px;transition:width 0.5s"></div>
        </div>
        <span style="font-size:9px;font-weight:700;color:#38bdf8;white-space:nowrap">
          ${prog.pct}%
        </span>
      </div>
      <div style="font-size:7.5px;color:#475569;margin-bottom:4px">
        ${prog.total} Feedbacks · ${prog.current ? prog.current.icon+' '+prog.current.label : 'Noch am Anfang'}
      </div>
      ${prog.next ? `<div style="font-size:7px;color:#334155">
        Nächstes Ziel: ${prog.next.icon} ${prog.next.label} bei ${prog.next.at} Feedbacks
        (noch ${prog.next.at - prog.total})
      </div>` : '<div style="font-size:7px;color:#22c55e">🏆 Maximales Vertrauen erreicht!</div>'}
    `;

    // Persönlichkeits-Typ
    if (prog.personality) {
      const ptBox = document.createElement('div');
      ptBox.style.cssText = 'background:#8b5cf611;border:1px solid #8b5cf622;border-radius:5px;padding:5px 8px;margin-top:6px';
      ptBox.innerHTML = `
        <span style="font-size:10px">${prog.personality.icon}</span>
        <span style="font-size:8px;font-weight:700;color:#a78bfa;margin-left:4px">${prog.personality.label}</span>
        <div style="font-size:7px;color:#64748b;margin-top:2px">${prog.personality.desc}</div>
      `;
      box.appendChild(ptBox);
    }

    scroll.appendChild(box);

    // ── Benachrichtigungs-Einstellungen ───────────────────────────────────
    const notifHdr = document.createElement('div');
    notifHdr.style.cssText = 'font-size:8px;font-weight:700;color:#94a3b8;margin:8px 0 5px;letter-spacing:0.5px';
    notifHdr.textContent = 'FEEDBACK-ERINNERUNGEN (optional)';
    scroll.appendChild(notifHdr);

    // Notification Service
    scroll.appendChild(this._mkField(
      '📱 HA Notify Service',
      notifCfg.notify_service || 'notify.notify',
      v => { if (!cfg.notifications) cfg.notifications = {}; cfg.notifications.notify_service = v; this._save(card); }
    ));

    // Toggle-Optionen
    const toggles = [
      { key: 'enabled',        label: '🔔 Feedback-Benachrichtigungen aktiv' },
      { key: 'daily_question', label: '❓ Tägliche Micro-Frage (eine Frage/Tag)' },
      { key: 'evening_summary',label: '🌙 Abend-Zusammenfassung (statt Micro-Frage)' },
      { key: 'weekly_report',  label: '📊 Wöchentlicher KI-Bericht (sonntags)' },
    ];

    toggles.forEach(t => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:6px;margin-bottom:4px';
      const cb  = document.createElement('input');
      cb.type   = 'checkbox';
      cb.checked = notifCfg[t.key] || false;
      cb.style.cssText = 'accent-color:#0ea5e9;cursor:pointer';
      cb.onchange = () => {
        if (!cfg.notifications) cfg.notifications = {};
        cfg.notifications[t.key] = cb.checked;
        this._save(card);
        // Timer neu planen
        if (t.key === 'daily_question') this._scheduleDailyQuestion(card);
        if (t.key === 'weekly_report')  this._scheduleWeeklyReport(card);
      };
      const lbl = document.createElement('label');
      lbl.style.cssText = 'font-size:8px;color:#94a3b8;cursor:pointer';
      lbl.textContent = t.label;
      row.appendChild(cb);
      row.appendChild(lbl);
      scroll.appendChild(row);
    });

    // Uhrzeit für tägliche Frage
    if (notifCfg.daily_question) {
      scroll.appendChild(this._mkField(
        '🕐 Uhrzeit Micro-Frage',
        notifCfg.daily_hour || 20,
        v => { cfg.notifications.daily_hour = parseInt(v) || 20; this._save(card); this._scheduleDailyQuestion(card); }
      ));
    }

    // Feedback-Zeitpunkt
    const timingRow = document.createElement('div');
    timingRow.style.cssText = 'margin-top:6px';
    const timingLbl = document.createElement('div');
    timingLbl.style.cssText = 'font-size:7.5px;color:#64748b;margin-bottom:3px';
    timingLbl.textContent = 'Wann um Feedback bitten?';
    timingRow.appendChild(timingLbl);
    const timingSel = document.createElement('select');
    timingSel.style.cssText = 'width:100%;padding:3px 5px;border-radius:4px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-size:7.5px';
    [
      { v: 'sofort',  l: 'Sofort nach Ausführung' },
      { v: '30min',   l: '30 Min nach Ausführung' },
      { v: 'abends',  l: 'Abends zusammengefasst' },
    ].forEach(o => {
      const opt = document.createElement('option');
      opt.value = o.v; opt.textContent = o.l;
      if (notifCfg.feedback_timing === o.v) opt.selected = true;
      timingSel.appendChild(opt);
    });
    timingSel.onchange = () => {
      if (!cfg.notifications) cfg.notifications = {};
      cfg.notifications.feedback_timing = timingSel.value;
      this._save(card);
    };
    timingRow.appendChild(timingSel);
    scroll.appendChild(timingRow);
  },

  // ── Zeit-Hilfsfunktionen ──────────────────────────────────────────────────
  _msUntilTime(hour, minute) {
    const now  = new Date();
    const target = new Date();
    target.setHours(hour, minute || 0, 0, 0);
    if (target <= now) target.setDate(target.getDate() + 1);
    return target - now;
  },

  _msUntilEvening() {
    return this._msUntilTime(20, 0);
  },

  _msUntilNextSunday(hour) {
    const now  = new Date();
    const days = (7 - now.getDay()) % 7 || 7; // Tage bis Sonntag
    const next = new Date(now);
    next.setDate(now.getDate() + days);
    next.setHours(hour || 10, 0, 0, 0);
    return Math.max(0, next - now);
  },

  // ══════════════════════════════════════════════════════════════════════════
  // DIGITALER ZWILLING
  // "Was hätte ich getan vs. was du wirklich getan hast"
  // ══════════════════════════════════════════════════════════════════════════

  _buildDigitalTwin(events, slotCount, weekdayCounts, cfg) {
    const now      = Date.now();
    const days     = 7;
    const dayMs    = 86400000;
    const trigCfg  = cfg.triggers || {};
    const mem      = this._loadMemory();

    // Letzte 7 Tage Zeitstrahl aufbauen
    const timeline = [];

    for (let d = days - 1; d >= 0; d--) {
      const dayStart = new Date(now - d * dayMs);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd   = new Date(dayStart.getTime() + dayMs);
      const wd       = (dayStart.getDay() + 6) % 7;
      const DAYS     = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

      // Echte Aktionen an diesem Tag (aktive Events)
      const realActions = events
        .filter(e => e.ts >= dayStart.getTime() && e.ts < dayEnd.getTime() && this._isActiveState(e.state))
        .map(e => ({
          ts:     e.ts,
          entity: e.entity,
          label:  e.entity.split('.')[1]?.replace(/_/g, ' ') || e.entity,
          real:   true,
        }));

      // Was die KI an diesem Tag empfohlen hätte
      const kiActions = [];

      // Für jeden Trigger: hätte die Bedingung gepasst?
      // Rasen: hätte morgens empfohlen wenn Bucket > Schwellwert
      if (trigCfg.irrigation_entity) {
        // Simuliere: früh morgens (06:00) wäre der beste Zeitpunkt gewesen
        const simTs = dayStart.getTime() + 6 * 3600000;
        const bucket = parseFloat(trigCfg.irrigation_bucket) || 0;
        if (bucket > (trigCfg.irrigation_threshold || 5)) {
          kiActions.push({
            ts:          simTs,
            label:       'Rasen gießen',
            icon:        '💧',
            confidence:  0.75,
            ki:          true,
            triggerId:   'irrigation',
          });
        }
      }

      // Mähroboter: hätte empfohlen wenn Werktag + 10–16h
      if (trigCfg.mower_entity && wd < 5) {
        const simTs = dayStart.getTime() + 10 * 3600000;
        kiActions.push({
          ts:         simTs,
          label:      'Mähroboter',
          icon:       '🌿',
          confidence: 0.68,
          ki:         true,
          triggerId:  'mower',
        });
      }

      // Pool-Pumpe: hätte bei gutem Wetter 10–14h empfohlen
      if (trigCfg.solar_entity) {
        const solarW = parseFloat(trigCfg.solar_power) || 0;
        if (solarW > (trigCfg.pool_solar_min || 300)) {
          const simTs = dayStart.getTime() + 11 * 3600000;
          kiActions.push({
            ts:         simTs,
            label:      'Pool-Pumpe',
            icon:       '🏊',
            confidence: 0.8,
            ki:         true,
            triggerId:  'pool_pump',
          });
        }
      }

      // Übereinstimmung berechnen:
      // Hat der User an diesem Tag etwas getan das der KI-Empfehlung entspricht?
      let matches = 0, misses = 0, extras = 0;

      kiActions.forEach(ka => {
        // Gab es eine echte Aktion in ±2h Fenster?
        const window = 2 * 3600000;
        const match  = realActions.some(ra =>
          Math.abs(ra.ts - ka.ts) < window &&
          ra.label.toLowerCase().includes(ka.label.split(' ')[0].toLowerCase())
        );
        if (match) { matches++; ka.matched = true; }
        else        { misses++;  ka.matched = false; }
      });

      // Extra-Aktionen: User hat etwas getan was KI nicht empfohlen hätte
      extras = Math.max(0, realActions.length - matches);

      const agreement = kiActions.length > 0
        ? Math.round((matches / kiActions.length) * 100)
        : null;

      timeline.push({
        date:        dayStart,
        dateLabel:   DAYS[wd] + ' ' + dayStart.getDate() + '.' + (dayStart.getMonth() + 1) + '.',
        wd,
        realActions,
        kiActions,
        matches,
        misses,
        extras,
        agreement,
      });
    }

    // Gesamt-Übereinstimmung
    const allKi      = timeline.reduce((s, d) => s + d.kiActions.length, 0);
    const allMatch   = timeline.reduce((s, d) => s + d.matches, 0);
    const totalAgree = allKi > 0 ? Math.round((allMatch / allKi) * 100) : null;

    // Wichtigste Unterschiede (wo KI anderer Meinung war)
    const differences = [];
    timeline.forEach(day => {
      day.kiActions.filter(a => !a.matched).forEach(a => {
        differences.push({
          date:      day.dateLabel,
          label:     a.label,
          icon:      a.icon,
          kiSays:    'Hätte empfohlen',
          userDid:   'Nicht ausgeführt',
          learnNote: 'KI wird vorsichtiger für diesen Tag',
        });
      });
    });

    return { timeline, totalAgree, differences, allKi, allMatch };
  },

  // ── Digitalen Zwilling zeichnen ───────────────────────────────────────────
  _drawDigitalTwin(ctx, w, y, pad, availH, twin) {
    if (!twin) {
      ctx.fillStyle = '#334155';
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Analyse starten um Digitalen Zwilling zu sehen', w / 2, y + availH / 2);
      return;
    }

    // ── Gesamt-Score oben ─────────────────────────────────────────────────
    const scoreH = 44;
    const agree  = twin.totalAgree;
    const scoreColor = agree == null ? '#475569'
                     : agree >= 75   ? '#22c55e'
                     : agree >= 50   ? '#f59e0b'
                     : '#ef4444';

    ctx.fillStyle = scoreColor + '18';
    this._roundRect(ctx, pad, y, w - pad*2, scoreH, 8);
    ctx.fill();
    ctx.strokeStyle = scoreColor + '55';
    ctx.lineWidth = 1;
    this._roundRect(ctx, pad, y, w - pad*2, scoreH, 8);
    ctx.stroke();

    // Zwillings-Icon + Score
    ctx.font = '20px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('🪞', pad + 10, y + scoreH / 2);

    ctx.fillStyle = scoreColor;
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(agree != null ? agree + '%' : '–', pad + 40, y + scoreH / 2 - 2);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '9px sans-serif';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('Übereinstimmung letzte 7 Tage', pad + 40, y + scoreH - 10);

    // Beschreibung rechts
    const desc = agree == null ? 'Noch keine Trigger konfiguriert'
               : agree >= 75   ? 'Wir denken sehr ähnlich 🎉'
               : agree >= 50   ? 'Wir stimmen oft überein'
               : agree >= 25   ? 'Ich lerne noch deinen Stil'
               : 'Ich muss noch viel lernen';
    ctx.fillStyle = scoreColor;
    ctx.font = '8px sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(desc, w - pad - 8, y + scoreH / 2);

    y += scoreH + 8;

    // ── Zeitstrahl (7 Tage) ───────────────────────────────────────────────
    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('LETZTE 7 TAGE — BLAU: Du · GRÜN: KI hätte empfohlen', pad, y + 9);
    y += 14;

    const dayW   = (w - pad * 2) / 7;
    const dayH   = Math.min(70, Math.floor((availH - scoreH - 80) / 1));
    const maxDayH = Math.min(dayH, availH - (y - (availH + (scoreH + 8 + 14))) - 60);

    twin.timeline.forEach((day, i) => {
      const dx    = pad + i * dayW;
      const isToday = i === 6;

      // Tag-Box
      ctx.fillStyle = isToday ? '#0c1a2e' : '#0f172a';
      this._roundRect(ctx, dx + 1, y, dayW - 2, maxDayH, 4);
      ctx.fill();
      if (isToday) {
        ctx.strokeStyle = '#38bdf855';
        ctx.lineWidth = 1;
        this._roundRect(ctx, dx + 1, y, dayW - 2, maxDayH, 4);
        ctx.stroke();
      }

      // Datum
      const parts = day.dateLabel.split(' ');
      ctx.fillStyle = isToday ? '#38bdf8' : '#475569';
      ctx.font = isToday ? 'bold 7px sans-serif' : '7px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(parts[0], dx + dayW/2, y + 10);
      ctx.fillStyle = '#334155';
      ctx.font = '6px sans-serif';
      ctx.fillText(parts[1] || '', dx + dayW/2, y + 18);

      // Übereinstimmungs-Balken
      const barY = y + 22;
      const barH = maxDayH - 30;
      const barW = dayW - 10;
      const barX = dx + 5;

      if (day.kiActions.length > 0) {
        const agreeH = Math.round(barH * (day.matches / day.kiActions.length));
        const missH  = barH - agreeH;

        if (agreeH > 0) {
          ctx.fillStyle = '#22c55ecc';
          this._roundRect(ctx, barX, barY + missH, barW, agreeH, 2);
          ctx.fill();
        }
        if (missH > 0) {
          ctx.fillStyle = '#ef444466';
          this._roundRect(ctx, barX, barY, barW, missH, 2);
          ctx.fill();
        }
      }

      // Punkte für echte Aktionen
      day.realActions.slice(0, 3).forEach((ra, ri) => {
        const dotY = barY + ri * 8 + 4;
        ctx.fillStyle = '#3b82f6cc';
        ctx.beginPath();
        ctx.arc(dx + dayW/2, dotY, 2.5, 0, Math.PI * 2);
        ctx.fill();
      });

      // Übereinstimmungs-% (klein)
      if (day.agreement != null) {
        ctx.fillStyle = day.agreement >= 50 ? '#22c55e' : '#ef4444';
        ctx.font = 'bold 7px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(day.agreement + '%', dx + dayW/2, y + maxDayH - 2);
      }
    });

    y += maxDayH + 10;

    // ── Unterschiede ─────────────────────────────────────────────────────
    if (twin.differences?.length > 0 && y + 20 < availH + (scoreH + 8 + 14)) {
      ctx.fillStyle = '#64748b';
      ctx.font = 'bold 8px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText('UNTERSCHIEDE — KI HÄTTE ANDERS ENTSCHIEDEN:', pad, y + 9);
      y += 14;

      twin.differences.slice(0, 3).forEach((diff, i) => {
        const ry = y + i * 22;
        if (ry + 20 > y + availH) return;

        ctx.fillStyle = '#1e293b';
        this._roundRect(ctx, pad, ry, w - pad*2, 20, 4);
        ctx.fill();

        ctx.font = '10px sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(diff.icon, pad + 6, ry + 10);

        ctx.fillStyle = '#cbd5e1';
        ctx.font = '8px sans-serif';
        ctx.fillText(`${diff.date}: ${diff.label} — ${diff.kiSays}`, pad + 20, ry + 8);

        ctx.fillStyle = '#475569';
        ctx.font = '7px sans-serif';
        ctx.fillText(`→ ${diff.learnNote}`, pad + 20, ry + 17);
      });
    }
  },

  // ══════════════════════════════════════════════════════════════════════════
  // SOLAR-SCHEDULER + JAHRESZEIT-KALIBRIERUNG
  // ══════════════════════════════════════════════════════════════════════════

  // ── Nutzer-Szenario automatisch erkennen ──────────────────────────────────
  _detectEnergyScenario(cfg) {
    const t = cfg.triggers || {};
    const hasSolar   = !!t.solar_entity || t.solar_power > 0;
    const hasBattery = !!t.battery_entity;
    const hasGrid    = !!t.grid_import_entity;
    const hasTariff  = !!t.tariff_entity;
    const month      = new Date().getMonth() + 1;

    // Solar-Saison (konfigurierbar, Default März–Dez)
    const solarSeasonStart = cfg.solar_season_start || 3;
    const solarSeasonEnd   = cfg.solar_season_end   || 12;
    const inSolarSeason    = month >= solarSeasonStart && month <= solarSeasonEnd;

    if (!hasSolar && !hasBattery) {
      return {
        type:        'grid_only',
        label:       'Nur Landstrom',
        icon:        '🔌',
        desc:        'Optimierung nach Tageszeit / Tarif',
        hasSolar:    false,
        hasBattery:  false,
        inSeason:    true,
        costFocus:   hasTariff,
      };
    }

    if (hasSolar && !hasGrid) {
      return {
        type:        'solar_island',
        label:       'Vollsolar (Insel)',
        icon:        '☀',
        desc:        'Nur Solar, kein Netz — Akku ist kritisch',
        hasSolar:    true,
        hasBattery,
        inSeason:    inSolarSeason,
        costFocus:   false,
      };
    }

    return {
      type:        'solar_grid',
      label:       inSolarSeason ? 'Solar + Notfall-Landstrom' : 'Landstrom (Nebensaison)',
      icon:        inSolarSeason ? '⚡☀' : '🔌',
      desc:        inSolarSeason
        ? 'Solar bevorzugen, Landstrom nur wenn nötig'
        : 'Außerhalb Solar-Saison — Kosten minimieren',
      hasSolar:    hasSolar && inSolarSeason,
      hasBattery,
      inSeason:    inSolarSeason,
      costFocus:   true,
    };
  },

  // ── Jahreszeit-Gewichtung für Muster ──────────────────────────────────────
  // Muster vom letzten Juli sind relevanter für diesen Juli
  _seasonWeight(eventTs) {
    const now        = new Date();
    const evDate     = new Date(eventTs);
    const nowMonth   = now.getMonth();
    const evMonth    = evDate.getMonth();
    const ageDays    = (now - evDate) / 86400000;

    // Monatliche Ähnlichkeit (zirkulär, 0..1)
    const monthDiff  = Math.min(
      Math.abs(nowMonth - evMonth),
      12 - Math.abs(nowMonth - evMonth)
    );
    const monthWeight = Math.max(0.1, 1 - monthDiff / 6);

    // Zeit-Decay (ältere Events zählen weniger, aber nicht linear)
    const ageWeight   = Math.max(0.05, Math.exp(-ageDays / 180)); // ~6 Monate halbe Relevanz

    return monthWeight * ageWeight;
  },

  // ── Solar-Tagesplan erstellen ──────────────────────────────────────────────
  // Plant alle Aufgaben für heute/morgen optimal ein
  _buildSolarSchedule(triggers, cfg) {
    const t         = cfg.triggers || {};
    const scenario  = this._detectEnergyScenario(cfg);
    const solarW    = parseFloat(t.solar_power)    || 0;
    const battSoc   = parseFloat(t.battery_soc)    || null;
    const battPow   = parseFloat(t.battery_power_w) || 0;
    const tariff    = parseFloat(t.tariff_now)     || null;
    const now       = new Date();
    const hour      = now.getHours();

    // Solar-Prognose für heute (stündlich aus Wetter geschätzt)
    const solarProfile = this._buildSolarProfile(t.weather_condition_today, now);
    // Für morgen
    const solarTomorrow = t.solar_forecast_tomorrow || 0.5;

    // Alle Trigger die Aufgaben haben
    const tasks = triggers
      .filter(t => t.powerW && t.powerW > 0)
      .map(tr => ({
        ...tr,
        durationH:   this._estimateTaskDuration(tr.id, cfg),
        energyWh:    (tr.powerW || 0) * this._estimateTaskDuration(tr.id, cfg),
        canDefer:    true,  // kann auf später verschoben werden
        deadline:    this._taskDeadline(tr.id, cfg), // spätester Zeitpunkt heute
      }));

    // Restliche Solar-Energie heute berechnen
    const remainingHours = Math.max(0, 20 - hour); // bis 20:00
    const futureSolarWh  = solarProfile
      .slice(hour)
      .reduce((s, w) => s + w, 0) * remainingHours / solarProfile.slice(hour).length;

    // Akku-Kapazität einrechnen (falls vorhanden)
    const availableWh    = futureSolarWh + (battSoc != null ? battSoc * (cfg.battery_capacity_wh || 1000) / 100 : 0);
    const totalNeededWh  = tasks.reduce((s, t) => s + t.energyWh, 0);

    // Aufgaben einplanen
    const schedule = [];
    let budgetWh   = availableWh;

    tasks
      .sort((a, b) => (a.priority||3) - (b.priority||3)) // nach Priorität
      .forEach(task => {
        if (budgetWh >= task.energyWh) {
          // Passt ins Solar-Budget
          const bestHour = this._findBestSolarHour(solarProfile, task, hour, cfg);
          schedule.push({
            ...task,
            scheduledHour: bestHour,
            source:        'solar',
            costEst:       0,
            note:          bestHour > hour
              ? `Verschoben auf ${bestHour}:00 — mehr Solar dann (${Math.round(solarProfile[bestHour]*100)}%)`
              : 'Jetzt gut — Solar verfügbar',
          });
          budgetWh -= task.energyWh;
        } else if (scenario.type === 'solar_island') {
          // Insel-Szenario: Aufgabe verschieben auf morgen
          schedule.push({
            ...task,
            scheduledHour: null,
            source:        'defer_tomorrow',
            costEst:       0,
            note:          `⚠ Akku zu schwach heute — morgen (Solar: ${Math.round(solarTomorrow*100)}%)`,
          });
        } else {
          // Hybrid: Landstrom als Fallback
          const cheapHour  = this._findCheapGridHour(tariff, task, hour, cfg);
          const costPerKwh = tariff || (cfg.grid_price_per_kwh || 0.30);
          const costEst    = (task.energyWh / 1000) * costPerKwh;
          schedule.push({
            ...task,
            scheduledHour: cheapHour,
            source:        'grid',
            costEst:       parseFloat(costEst.toFixed(3)),
            note:          `Landstrom nötig · ~${(costEst*100).toFixed(1)}ct · günstigste Zeit: ${cheapHour}:00`,
          });
        }
      });

    // Tages-Kosten berechnen
    const todayCostEur = (parseFloat(t.grid_import_today_kwh) || 0) * (tariff || cfg.grid_price_per_kwh || 0.30);
    const scheduledCost = schedule.filter(s => s.source === 'grid').reduce((s, t) => s + (t.costEst||0), 0);

    return {
      scenario,
      schedule,
      solarProfile,
      solarW,
      battSoc,
      availableWh:    Math.round(availableWh),
      totalNeededWh:  Math.round(totalNeededWh),
      solarCoversAll: availableWh >= totalNeededWh,
      todayCostEur:   parseFloat(todayCostEur.toFixed(2)),
      scheduledCostEur: parseFloat(scheduledCost.toFixed(2)),
      solarTomorrow,
    };
  },

  // ── Stündliches Solar-Profil aus Wetter ───────────────────────────────────
  _buildSolarProfile(condition, now) {
    // Sonnenstunden-Kurve (Gauss-ähnlich, Peak ~13:00)
    const base = this._estimateSolarFromWeather(condition || 'partlycloudy');
    const profile = Array(24).fill(0).map((_, h) => {
      if (h < 6 || h > 20) return 0;
      const bell = Math.exp(-Math.pow(h - 13, 2) / 18);
      return Math.round(base * bell * 100) / 100;
    });
    return profile;
  },

  // ── Besten Solar-Zeitpunkt für Aufgabe finden ─────────────────────────────
  _findBestSolarHour(profile, task, currentHour, cfg) {
    const deadline  = task.deadline || 20;
    const duration  = Math.ceil(task.durationH || 1);
    let   bestHour  = currentHour;
    let   bestScore = -1;

    for (let h = currentHour; h <= deadline - duration; h++) {
      // Score = Solar-Stärke im Fenster
      const windowSolar = profile.slice(h, h + duration).reduce((s, v) => s + v, 0) / duration;
      if (windowSolar > bestScore) {
        bestScore = windowSolar;
        bestHour  = h;
      }
    }
    return bestHour;
  },

  // ── Günstigsten Landstrom-Zeitpunkt finden ────────────────────────────────
  _findCheapGridHour(tariff, task, currentHour, cfg) {
    // Falls dynamischer Tarif: günstigste Stunde
    // Falls Einheitstarif: früh morgens oder nachts
    const deadline = task.deadline || 22;
    if (!tariff) {
      // Einheitstarif → früh morgens (06:00) ist oft am günstigsten für Nachtaufgaben
      return Math.max(currentHour, 6);
    }
    // Mit dynamischem Tarif: vereinfacht → aktueller Zeitpunkt
    return currentHour;
  },

  // ── Aufgaben-Dauer schätzen ───────────────────────────────────────────────
  _estimateTaskDuration(triggerId, cfg) {
    const t = cfg.triggers || {};
    switch (triggerId) {
      case 'pool_pump':   return parseFloat(t.pool_duration_h)   || 4;
      case 'irrigation':  return parseFloat(t.irrigation_duration_h) || 0.5;
      case 'mower':       return parseFloat(t.mower_duration_h)  || 1.5;
      default:            return 1;
    }
  },

  // ── Deadline für Aufgabe (spätester Zeitpunkt heute) ─────────────────────
  _taskDeadline(triggerId, cfg) {
    switch (triggerId) {
      case 'pool_pump':   return 17; // Pool-Pumpe bis 17:00
      case 'irrigation':  return 8;  // Bewässerung früh morgens
      case 'mower':       return 18; // Mähroboter bis 18:00
      default:            return 20;
    }
  },

  // ── Solar-Schedule Canvas zeichnen ───────────────────────────────────────
  _drawSolarSchedule(ctx, w, y, pad, availH, schedule) {
    if (!schedule) {
      ctx.fillStyle = '#334155';
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Solar-Entity in Sidebar konfigurieren', w / 2, y + availH / 2);
      return;
    }

    const sc  = schedule;
    const PAD = pad;

    // ── Szenario-Header ───────────────────────────────────────────────────
    const scenCol = sc.scenario.type === 'solar_island' ? '#f59e0b'
                  : sc.scenario.inSeason               ? '#22c55e'
                  : '#64748b';
    ctx.fillStyle = scenCol + '18';
    this._roundRect(ctx, PAD, y, w - PAD*2, 32, 6);
    ctx.fill();
    ctx.strokeStyle = scenCol + '55';
    ctx.lineWidth = 1;
    this._roundRect(ctx, PAD, y, w - PAD*2, 32, 6);
    ctx.stroke();

    ctx.font = '14px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(sc.scenario.icon, PAD + 8, y + 16);
    ctx.fillStyle = scenCol;
    ctx.font = 'bold 9px sans-serif';
    ctx.fillText(sc.scenario.label, PAD + 28, y + 12);
    ctx.fillStyle = '#64748b';
    ctx.font = '7.5px sans-serif';
    ctx.fillText(sc.scenario.desc, PAD + 28, y + 23);

    // Aktueller Solar/Akku-Status rechts
    const statusParts = [];
    if (sc.solarW > 0)  statusParts.push(`☀ ${sc.solarW}W`);
    if (sc.battSoc != null) statusParts.push(`🔋 ${sc.battSoc}%`);
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(statusParts.join('  '), w - PAD - 6, y + 16);
    y += 38;

    // ── Solar-Profil Kurve ────────────────────────────────────────────────
    const profileH  = 40;
    const profileW  = w - PAD * 2;
    const now       = new Date();
    const curHour   = now.getHours();

    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('SOLAR-PROFIL HEUTE', PAD, y + 9);
    y += 12;

    // Hintergrund
    ctx.fillStyle = '#0f172a';
    this._roundRect(ctx, PAD, y, profileW, profileH, 4);
    ctx.fill();

    // Solar-Kurve als Fläche
    const daylight = sc.solarProfile.slice(6, 21); // 06:00–20:00
    const colW     = profileW / daylight.length;

    daylight.forEach((val, i) => {
      const h       = i + 6;
      const barH    = Math.round(val * (profileH - 4));
      const barX    = PAD + i * colW;
      const barY    = y + profileH - barH - 2;
      const isPast  = h < curHour;
      const isCur   = h === curHour;

      ctx.fillStyle = isPast ? '#1e3a5f'
                    : isCur  ? '#38bdf8'
                    : '#0ea5e955';
      ctx.fillRect(barX + 0.5, barY, colW - 1, barH);

      // Geplante Aufgaben als farbige Markierungen
      sc.schedule.forEach(task => {
        if (task.scheduledHour === h) {
          ctx.fillStyle = task.source === 'solar' ? '#22c55e' : '#ef4444';
          ctx.fillRect(barX + 1, y + 2, colW - 2, 4);
        }
      });
    });

    // Stunden-Labels
    [6, 9, 12, 15, 18, 21].forEach(h => {
      const i  = h - 6;
      const hx = PAD + i * colW;
      ctx.fillStyle = '#334155';
      ctx.font = '6px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(h + ':00', hx, y + profileH + 8);
    });

    // Jetzt-Linie
    const nowX = PAD + (curHour - 6) * colW;
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 2]);
    ctx.beginPath();
    ctx.moveTo(nowX, y);
    ctx.lineTo(nowX, y + profileH);
    ctx.stroke();
    ctx.setLineDash([]);

    y += profileH + 12;

    // ── Budget-Anzeige ────────────────────────────────────────────────────
    const budgetW  = w - PAD * 2;
    const usedPct  = Math.min(1, sc.totalNeededWh / Math.max(1, sc.availableWh));

    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('ENERGIE-BUDGET', PAD, y + 9);
    ctx.fillStyle = sc.solarCoversAll ? '#22c55e' : '#f59e0b';
    ctx.font = '8px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(sc.solarCoversAll ? '✅ Solar reicht für alles' : `⚡ ~${sc.scheduledCostEur.toFixed(2)}€ Landstrom`, w - PAD, y + 9);
    y += 12;

    ctx.fillStyle = '#1e293b';
    this._roundRect(ctx, PAD, y, budgetW, 10, 5);
    ctx.fill();

    const fillCol = usedPct <= 0.7 ? '#22c55e' : usedPct <= 1 ? '#f59e0b' : '#ef4444';
    ctx.fillStyle = fillCol;
    this._roundRect(ctx, PAD, y, Math.round(budgetW * Math.min(1, usedPct)), 10, 5);
    ctx.fill();

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 7px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${sc.totalNeededWh}Wh benötigt / ${sc.availableWh}Wh verfügbar`, PAD + budgetW / 2, y + 5);
    y += 16;

    // ── Tagesplan ─────────────────────────────────────────────────────────
    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('TAGESPLAN', PAD, y + 9);
    y += 14;

    const rowH = 30;
    sc.schedule.forEach((task, i) => {
      const ry = y + i * rowH;
      if (ry + rowH > y + availH) return;

      const srcCol = task.source === 'solar'          ? '#22c55e'
                   : task.source === 'defer_tomorrow' ? '#f59e0b'
                   : '#ef4444';

      ctx.fillStyle = '#0f172a';
      this._roundRect(ctx, PAD, ry, w - PAD*2, rowH - 3, 4);
      ctx.fill();
      ctx.fillStyle = srcCol;
      this._roundRect(ctx, PAD, ry, 3, rowH - 3, 2);
      ctx.fill();

      // Zeit
      ctx.fillStyle = srcCol;
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      const timeStr = task.scheduledHour != null ? `${task.scheduledHour}:00` : 'Morgen';
      ctx.fillText(timeStr, PAD + 8, ry + (rowH-3)/2 - 4);

      // Quelle-Badge
      const srcLabel = task.source === 'solar' ? '☀ Solar' : task.source === 'defer_tomorrow' ? '⏭ Morgen' : '🔌 Netz';
      ctx.fillStyle = srcCol + 'cc';
      ctx.font = '6.5px sans-serif';
      ctx.fillText(srcLabel, PAD + 8, ry + (rowH-3)/2 + 6);

      // Name
      ctx.fillStyle = '#e2e8f0';
      ctx.font = 'bold 8px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`${task.icon} ${task.label}`, PAD + 45, ry + (rowH-3)/2 - 4);

      // Notiz
      ctx.fillStyle = '#475569';
      ctx.font = '7px sans-serif';
      ctx.fillText(task.note, PAD + 45, ry + (rowH-3)/2 + 6);

      // Kosten
      if (task.costEst > 0) {
        ctx.fillStyle = '#ef4444';
        ctx.font = 'bold 8px sans-serif';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${(task.costEst*100).toFixed(1)}ct`, w - PAD - 6, ry + (rowH-3)/2);
      }
    });

    // ── Kosten-Zusammenfassung ────────────────────────────────────────────
    if (sc.todayCostEur > 0 || sc.scheduledCostEur > 0) {
      const costY = y + sc.schedule.length * rowH + 6;
      if (costY + 20 < y + availH) {
        ctx.fillStyle = '#1e293b';
        this._roundRect(ctx, PAD, costY, w - PAD*2, 20, 4);
        ctx.fill();
        ctx.fillStyle = '#94a3b8';
        ctx.font = '7.5px sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(`💰 Heute Landstrom: ${sc.todayCostEur.toFixed(2)}€`, PAD + 8, costY + 10);
        ctx.fillStyle = '#f59e0b';
        ctx.textAlign = 'right';
        ctx.fillText(`Geplant: +${sc.scheduledCostEur.toFixed(2)}€`, w - PAD - 6, costY + 10);
      }
    }
  },

  // ══════════════════════════════════════════════════════════════════════════
  // WELLE 2 — ANOMALIE-GEDÄCHTNIS
  // ══════════════════════════════════════════════════════════════════════════

  // ── Anomalie erkennen + speichern ─────────────────────────────────────────
  _detectAndStoreAnomalies(events, slotCount, weekdayCounts, totalDays) {
    const mem      = this._loadMemory();
    if (!mem.anomalies) mem.anomalies = [];

    const now      = Date.now();
    const anomalies = [];

    // Bekannte Muster aufbauen (was ist normal?)
    const normalSlots = new Set(
      Object.entries(slotCount)
        .filter(([, cnt]) => {
          const [wd] = [parseInt(Object.keys(slotCount).indexOf([...Object.keys(slotCount)].find(k=>k===Object.keys(slotCount).find(kk=>kk===k))))];
          return cnt > 2;
        })
        .map(([k]) => k)
    );

    // Vereinfacht: Slots mit Aktivität die in den letzten 7 Tagen
    // deutlich von der Norm abweichen
    const last7 = events.filter(e => now - e.ts < 7 * 86400000);

    last7.forEach(ev => {
      if (!this._isActiveState(ev.state)) return;
      const d   = new Date(ev.ts);
      const wd  = (d.getDay() + 6) % 7;
      const si  = Math.floor((d.getHours() * 60 + d.getMinutes()) / this._kiSlotMin);
      const key = `${wd}_${si}`;
      const cnt = slotCount[key] || 0;

      // Anomalie: Aktivität zu einer Zeit die normalerweise sehr ruhig ist
      if (cnt === 0 || cnt < 2) {
        const existing = mem.anomalies.find(a =>
          a.wd === wd && a.si === si && now - a.firstSeen < 30 * 86400000
        );

        if (existing) {
          existing.count++;
          existing.lastSeen = now;
          existing.entities = [...new Set([...existing.entities, ev.entity])];
        } else {
          mem.anomalies.push({
            id:        `anom_${wd}_${si}_${Date.now()}`,
            wd,
            si,
            firstSeen: ev.ts,
            lastSeen:  ev.ts,
            count:     1,
            entities:  [ev.entity],
            resolved:  false,
            type:      'unusual_activity',
            guestSlot: false,  // wurde als Gast-Slot markiert?
          });
        }
      }
    });

    // Anomalie-Muster erkennen: gleicher Slot wiederholt = wahrscheinlich Gast/Routine
    mem.anomalies.forEach(a => {
      if (a.count >= 3 && !a.guestSlot) {
        a.guestSlot    = true;
        a.patternLabel = `Regelmäßig ${this._formatDays([a.wd])} ~${this._slotToTime(a.si)}`;
      }
    });

    // Alte aufgelöste Anomalien bereinigen (> 60 Tage)
    mem.anomalies = mem.anomalies.filter(a => now - a.lastSeen < 60 * 86400000);
    this._saveMemory();

    // Aktuelle Anomalien für UI aufbereiten
    return mem.anomalies
      .filter(a => !a.resolved)
      .sort((a, b) => b.lastSeen - a.lastSeen)
      .slice(0, 20)
      .map(a => ({
        ...a,
        timeLabel:   this._slotToTime(a.si),
        dayLabel:    this._formatDays([a.wd]),
        ageLabel:    this._ageLabel(a.lastSeen),
        severity:    a.count >= 3 ? 'pattern' : a.count >= 2 ? 'repeated' : 'once',
        severityCol: a.count >= 3 ? '#8b5cf6'
                   : a.count >= 2 ? '#f59e0b'
                   : '#64748b',
      }));
  },

  // ── Anomalie-Canvas ───────────────────────────────────────────────────────
  _drawAnomalies(ctx, w, y, pad, availH, anomalies) {
    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('ANOMALIE-GEDÄCHTNIS', pad, y + 9);
    y += 14;

    if (!anomalies || !anomalies.length) {
      ctx.fillStyle = '#22c55e';
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('✅ Keine ungewöhnlichen Muster erkannt', w / 2, y + availH / 2 - 8);
      ctx.fillStyle = '#334155';
      ctx.font = '8px sans-serif';
      ctx.fillText('(mind. 14 Tage History für verlässliche Erkennung)', w / 2, y + availH / 2 + 8);
      return;
    }

    const rowH = 40;
    anomalies.slice(0, Math.floor(availH / rowH)).forEach((a, i) => {
      const ry = y + i * rowH;
      const bw = w - pad * 2;

      ctx.fillStyle = '#0f172a';
      this._roundRect(ctx, pad, ry, bw, rowH - 3, 5);
      ctx.fill();
      ctx.fillStyle = a.severityCol;
      this._roundRect(ctx, pad, ry, 3, rowH - 3, 2);
      ctx.fill();

      // Icon
      const icon = a.guestSlot ? '👥' : a.severity === 'pattern' ? '🔄' : '⚠';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(icon, pad + 8, ry + (rowH-3)/2 - 4);

      // Beschreibung
      ctx.fillStyle = '#e2e8f0';
      ctx.font = 'bold 8.5px sans-serif';
      ctx.textBaseline = 'alphabetic';
      const label = a.guestSlot
        ? `Gast-Muster: ${a.patternLabel}`
        : `Ungewöhnlich: ${a.dayLabel} ~${a.timeLabel}`;
      ctx.fillText(label, pad + 24, ry + 14);

      // Details
      ctx.fillStyle = '#64748b';
      ctx.font = '7.5px sans-serif';
      const detail = `${a.count}× gesehen · zuletzt ${a.ageLabel} · ${a.entities.length} Entities`;
      ctx.fillText(detail, pad + 24, ry + 25);

      // Aufgelöst-Button (Text, wird via Sidebar bedient)
      ctx.fillStyle = a.severityCol + '88';
      ctx.font = '7px sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(a.guestSlot ? 'Gast-Slot ✓' : `${a.count}×`, w - pad - 6, ry + (rowH-3)/2);
    });
  },

  // ── Alter-Label ───────────────────────────────────────────────────────────
  _ageLabel(ts) {
    const diff = Date.now() - ts;
    const h    = Math.floor(diff / 3600000);
    const d    = Math.floor(diff / 86400000);
    if (h < 1)  return 'gerade eben';
    if (h < 24) return `vor ${h}h`;
    if (d < 7)  return `vor ${d} Tagen`;
    return `vor ${Math.floor(d/7)} Wochen`;
  },

  // ══════════════════════════════════════════════════════════════════════════
  // WELLE 2 — VORAUSSCHAUENDE WARTUNG
  // ══════════════════════════════════════════════════════════════════════════

  // ── Gerätelaufzeiten analysieren ──────────────────────────────────────────
  _buildMaintenanceInsights(events, cfg) {
    const t         = cfg.triggers || {};
    const insights  = [];
    const now       = Date.now();
    const dayMs     = 86400000;

    // Zu überwachende Geräte aus Trigger-Config
    const devices = [];
    if (t.pool_pump_entity || t.solar_entity) devices.push({ id: 'pool_pump', label: 'Pool-Pumpe', icon: '🏊', expectedH: parseFloat(t.pool_duration_h) || 4 });
    if (t.mower_entity)  devices.push({ id: 'mower',     label: 'Mähroboter',  icon: '🌿', expectedH: parseFloat(t.mower_duration_h) || 1.5 });
    if (t.irrigation_entity) devices.push({ id: 'irrigation', label: 'Bewässerung', icon: '💧', expectedH: parseFloat(t.irrigation_duration_h) || 0.5 });

    devices.forEach(dev => {
      // Laufzeiten pro Tag aus History berechnen
      // Vereinfacht: Anzahl aktiver Events als Proxy für Laufzeit
      const deviceEvents = events.filter(e =>
        e.entity.toLowerCase().includes(dev.id.split('_')[0]) ||
        e.entity.toLowerCase().includes(dev.label.toLowerCase().split('-')[0])
      );

      if (deviceEvents.length < 10) return; // zu wenig Daten

      // Tägliche Aktivitäts-Counts
      const byDay = {};
      deviceEvents.forEach(e => {
        if (!this._isActiveState(e.state)) return;
        const dKey = new Date(e.ts).toDateString();
        byDay[dKey] = (byDay[dKey] || 0) + 1;
      });

      const counts     = Object.values(byDay).filter(c => c > 0);
      if (counts.length < 7) return;

      const avgCount   = counts.reduce((s, c) => s + c, 0) / counts.length;
      const recentDays = Object.entries(byDay)
        .filter(([d]) => now - new Date(d).getTime() < 7 * dayMs)
        .map(([, c]) => c);

      if (!recentDays.length) return;
      const recentAvg  = recentDays.reduce((s, c) => s + c, 0) / recentDays.length;
      const dropPct    = ((avgCount - recentAvg) / avgCount) * 100;

      if (dropPct >= 40) {
        // Deutlicher Rückgang → Wartungs-Hinweis
        insights.push({
          device:    dev.label,
          icon:      dev.icon,
          severity:  dropPct >= 60 ? 'warn' : 'info',
          dropPct:   Math.round(dropPct),
          avgCount:  Math.round(avgCount),
          recentAvg: Math.round(recentAvg),
          message:   `Läuft ${Math.round(dropPct)}% weniger als üblich`,
          suggestion:`Gerät prüfen — letzte 7 Tage deutlich unter Normal`,
          color:     dropPct >= 60 ? '#ef4444' : '#f59e0b',
        });
      } else if (recentAvg === 0) {
        insights.push({
          device:    dev.label,
          icon:      dev.icon,
          severity:  'warn',
          dropPct:   100,
          avgCount:  Math.round(avgCount),
          recentAvg: 0,
          message:   'Seit 7 Tagen keine Aktivität erkannt',
          suggestion:'Defekt oder manuell ausgeschaltet?',
          color:     '#ef4444',
        });
      } else {
        // Alles normal
        insights.push({
          device:    dev.label,
          icon:      dev.icon,
          severity:  'ok',
          dropPct:   0,
          message:   `Läuft normal (${Math.round(recentAvg)} Aktivierungen/Tag)`,
          suggestion:'',
          color:     '#22c55e',
        });
      }
    });

    return insights;
  },

  // ── Wartungs-Canvas ───────────────────────────────────────────────────────
  _drawMaintenance(ctx, w, y, pad, availH, insights) {
    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('VORAUSSCHAUENDE WARTUNG', pad, y + 9);
    y += 14;

    if (!insights || !insights.length) {
      ctx.fillStyle = '#334155';
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Trigger-Entities konfigurieren für Geräte-Monitoring', w / 2, y + availH / 2);
      return;
    }

    const rowH = 44;
    insights.forEach((ins, i) => {
      const ry = y + i * rowH;
      if (ry + rowH > y + availH) return;
      const bw = w - pad * 2;

      ctx.fillStyle = '#0f172a';
      this._roundRect(ctx, pad, ry, bw, rowH - 3, 5);
      ctx.fill();
      ctx.fillStyle = ins.color;
      this._roundRect(ctx, pad, ry, 3, rowH - 3, 2);
      ctx.fill();

      ctx.font = '14px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(ins.icon, pad + 8, ry + 15);

      ctx.fillStyle = ins.color;
      ctx.font = 'bold 9px sans-serif';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(ins.device, pad + 26, ry + 14);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '8px sans-serif';
      ctx.fillText(ins.message, pad + 26, ry + 26);

      if (ins.suggestion) {
        ctx.fillStyle = '#475569';
        ctx.font = '7px sans-serif';
        ctx.fillText(`→ ${ins.suggestion}`, pad + 26, ry + 36);
      }

      // Trend-Balken rechts
      if (ins.severity !== 'ok') {
        const barW   = 50;
        const barX   = w - pad - barW - 6;
        const barY   = ry + 8;
        ctx.fillStyle = '#1e293b';
        this._roundRect(ctx, barX, barY, barW, 8, 4);
        ctx.fill();
        const fillW = Math.round(barW * (1 - ins.dropPct / 100));
        if (fillW > 0) {
          ctx.fillStyle = ins.color;
          this._roundRect(ctx, barX, barY, fillW, 8, 4);
          ctx.fill();
        }
        ctx.fillStyle = ins.color;
        ctx.font = 'bold 7px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`−${ins.dropPct}%`, barX + barW / 2, barY + 4);
      } else {
        ctx.fillStyle = '#22c55e';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText('✅', w - pad - 8, ry + (rowH-3)/2);
      }
    });
  },

  // ══════════════════════════════════════════════════════════════════════════
  // WELLE 2 — CROSS-TRIGGER LERNEN
  // ══════════════════════════════════════════════════════════════════════════

  // ── Trigger-Korrelationen aus Feedback-History lernen ────────────────────
  _buildCrossLearning() {
    const mem      = this._loadMemory();
    const feedback = mem.feedback || [];
    const patterns = [];

    if (feedback.length < 10) return [];

    // Feedback-Paare analysieren: welche Trigger werden zusammen abgelehnt/akzeptiert?
    const triggerIds = [...new Set(feedback.map(f => f.triggerId).filter(Boolean))];

    triggerIds.forEach(idA => {
      triggerIds.forEach(idB => {
        if (idA >= idB) return; // jedes Paar nur einmal

        // Gemeinsame Feedback-Zeitpunkte (innerhalb 2h)
        const fbA = feedback.filter(f => f.triggerId === idA);
        const fbB = feedback.filter(f => f.triggerId === idB);

        let sameDir = 0, oppDir = 0;
        fbA.forEach(a => {
          const nearB = fbB.find(b => Math.abs(b.ts - a.ts) < 2 * 3600000);
          if (!nearB) return;
          const aPos = a.delta > 0;
          const bPos = nearB.delta > 0;
          if (aPos === bPos) sameDir++;
          else              oppDir++;
        });

        const total = sameDir + oppDir;
        if (total < 3) return;

        if (sameDir / total > 0.75) {
          // Immer zusammen akzeptiert/abgelehnt → positive Korrelation
          patterns.push({
            idA, idB,
            type:    'positive',
            label:   `${idA} + ${idB} laufen meist zusammen`,
            icon:    '🔗',
            color:   '#22c55e',
            samples: total,
            conf:    Math.round(sameDir / total * 100),
            insight: 'KI plant beide zusammen wenn möglich',
          });
        } else if (oppDir / total > 0.75) {
          // Immer gegenläufig → negative Korrelation (nie zusammen)
          patterns.push({
            idA, idB,
            type:    'negative',
            label:   `${idA} und ${idB} nie gleichzeitig`,
            icon:    '🚫',
            color:   '#f59e0b',
            samples: total,
            conf:    Math.round(oppDir / total * 100),
            insight: 'KI vermeidet diese Kombination automatisch',
          });
        }
      });
    });

    // Einzelne Trigger: Tages-Präferenz aus Feedback
    triggerIds.forEach(id => {
      const fb = feedback.filter(f => f.triggerId === id && f.delta > 0 && !f.silent);
      if (fb.length < 5) return;

      const hourCounts = Array(24).fill(0);
      fb.forEach(f => { hourCounts[new Date(f.ts).getHours()]++; });
      const peakH    = hourCounts.indexOf(Math.max(...hourCounts));
      const peakCnt  = hourCounts[peakH];
      const totalPos = fb.length;

      if (peakCnt / totalPos > 0.4) {
        patterns.push({
          idA:     id,
          idB:     null,
          type:    'time_preference',
          label:   `${id}: bevorzugt ~${peakH}:00 Uhr`,
          icon:    '🕐',
          color:   '#38bdf8',
          samples: totalPos,
          conf:    Math.round(peakCnt / totalPos * 100),
          insight: `KI verschiebt ${id} wenn möglich auf ~${peakH}:00`,
        });
      }
    });

    return patterns;
  },

  // ── Cross-Learning Canvas ─────────────────────────────────────────────────
  _drawCrossLearning(ctx, w, y, pad, availH, patterns) {
    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('CROSS-TRIGGER LERNEN', pad, y + 9);
    y += 14;

    if (!patterns || !patterns.length) {
      ctx.fillStyle = '#334155';
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Noch zu wenig Feedback (min. 10 Entscheidungen)', w / 2, y + availH / 2 - 8);
      ctx.fillStyle = '#1e3a5f';
      ctx.font = '8px sans-serif';
      ctx.fillText('KI lernt mit jedem 👍/👎 mehr', w / 2, y + availH / 2 + 8);
      return;
    }

    const rowH = 38;
    patterns.forEach((p, i) => {
      const ry = y + i * rowH;
      if (ry + rowH > y + availH) return;
      const bw = w - pad * 2;

      ctx.fillStyle = '#0f172a';
      this._roundRect(ctx, pad, ry, bw, rowH - 3, 5);
      ctx.fill();
      ctx.fillStyle = p.color;
      this._roundRect(ctx, pad, ry, 3, rowH - 3, 2);
      ctx.fill();

      ctx.font = '11px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(p.icon, pad + 8, ry + 14);

      ctx.fillStyle = '#e2e8f0';
      ctx.font = 'bold 8.5px sans-serif';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(p.label, pad + 24, ry + 14);

      ctx.fillStyle = '#475569';
      ctx.font = '7.5px sans-serif';
      ctx.fillText(p.insight, pad + 24, ry + 26);

      // Konfidenz
      const cW = 40;
      const cX = w - pad - cW - 6;
      ctx.fillStyle = '#1e293b';
      this._roundRect(ctx, cX, ry + 8, cW, 7, 3);
      ctx.fill();
      ctx.fillStyle = p.color;
      this._roundRect(ctx, cX, ry + 8, Math.round(cW * p.conf / 100), 7, 3);
      ctx.fill();
      ctx.fillStyle = '#64748b';
      ctx.font = '6.5px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${p.conf}%`, cX + cW / 2, ry + 11.5);
      ctx.fillStyle = '#334155';
      ctx.font = '6px sans-serif';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(`${p.samples}x`, cX + cW / 2, ry + 28);
    });
  },

  // ══════════════════════════════════════════════════════════════════════════
  // META-LEARNING SYSTEM (v1.7.0)
  // Die KI lernt nicht nur Verhalten — sie lernt wie sie lernen soll
  // ══════════════════════════════════════════════════════════════════════════

  // ── Aus Feedback lernen: Zeitfenster-Gewichte aufbauen ───────────────────
  // Wird nach JEDEM Feedback aufgerufen — baut Gewichte schrittweise auf
  _learnFromFeedback(triggerId, delta, card) {
    const mem  = this._loadMemory();
    if (!mem.metaLearning) mem.metaLearning = {};
    if (!mem.metaLearning[triggerId]) {
      mem.metaLearning[triggerId] = {
        hourWeights:    Array(24).fill(0),  // −1..+1 pro Stunde
        weekdayWeights: Array(7).fill(0),   // −1..+1 pro Wochentag
        contextWeights: {},                 // frei: 'solar_high', 'rainy', etc.
        sampleCount:    0,
        lastCorrected:  null,
      };
    }

    const ml   = mem.metaLearning[triggerId];
    const now  = new Date();
    const hour = now.getHours();
    const wd   = (now.getDay() + 6) % 7;

    // Gewichte mit Lernrate anpassen (0.1 = langsam, stabil)
    const lr = 0.10;
    const sign = delta > 0 ? 1 : -1;

    ml.hourWeights[hour]    = Math.max(-1, Math.min(1, ml.hourWeights[hour]    + sign * lr));
    ml.weekdayWeights[wd]   = Math.max(-1, Math.min(1, ml.weekdayWeights[wd]  + sign * lr));
    ml.sampleCount++;

    // Persönlichkeits-Typ erkennen ab 20 Samples
    if (ml.sampleCount === 20 || ml.sampleCount % 10 === 0) {
      this._detectPersonality(card);
    }

    this._saveMemory();
  },

  // ── Persönlichkeits-Typ erkennen ─────────────────────────────────────────
  _detectPersonality(card) {
    const mem      = this._loadMemory();
    const feedback = mem.feedback || [];
    const total    = feedback.length;
    if (total < 20) return null;

    const pos   = feedback.filter(f => f.delta > 0 && !f.silent).length;
    const neg   = feedback.filter(f => f.delta < 0 && !f.silent).length;
    const rules = feedback.filter(f => f.reason === 'override_reason').length;
    const ratio = pos / Math.max(1, pos + neg);

    let type, label, threshold, icon;
    if (ratio > 0.72) {
      type = 'offen'; label = 'Experimentierfreudig';
      threshold = 0.42; icon = '🚀';
    } else if (ratio < 0.33) {
      type = 'vorsichtig'; label = 'Bedächtig';
      threshold = 0.72; icon = '🤔';
    } else if (rules > total * 0.18) {
      type = 'präzise'; label = 'Präzise';
      threshold = 0.62; icon = '🎯';
    } else {
      type = 'ausgewogen'; label = 'Ausgewogen';
      threshold = 0.58; icon = '⚖';
    }

    const prev = mem.personality?.type;
    mem.personality = { type, label, threshold, icon, detectedAt: Date.now(), sampleCount: total };
    this._saveMemory();

    // Benachrichtigung wenn Typ sich geändert hat
    if (prev && prev !== type) {
      card?._showToast?.(`🧠 KI hat deinen Typ neu erkannt: ${icon} ${label}`);
    }

    return mem.personality;
  },

  // ── Vorschlag-Score berechnen ─────────────────────────────────────────────
  // Entscheidet ob die KI einen Vorschlag macht — kombiniert alle Faktoren
  _buildProposalScore(triggerId, baseConfidence) {
    const mem       = this._loadMemory();
    const ml        = mem.metaLearning?.[triggerId];
    const pers      = mem.personality;
    const now       = new Date();
    const hour      = now.getHours();
    const wd        = (now.getDay() + 6) % 7;

    // Phase 0: noch nicht genug Daten
    const feedback = (mem.feedback || []).filter(f => f.triggerId === triggerId);
    if (feedback.length < 5) {
      return { score: baseConfidence, phase: 0, explain: 'Noch zu wenig Feedback — neutrale Bewertung' };
    }

    // Basis
    let score = baseConfidence;
    const factors = [];

    // Phase 1: Zeitfenster-Gewichte (ab 5 Feedbacks)
    if (ml && ml.sampleCount >= 5) {
      const hourW = ml.hourWeights[hour];
      const wdW   = ml.weekdayWeights[wd];
      score += hourW * 0.15;
      score += wdW   * 0.10;
      if (Math.abs(hourW) > 0.2) factors.push(hourW > 0 ? `✓ ${hour}:00 ist gute Zeit (+${(hourW*15).toFixed(0)}%)` : `✗ ${hour}:00 lehnst du oft ab (${(hourW*15).toFixed(0)}%)`);
      if (Math.abs(wdW)   > 0.2) factors.push(wdW   > 0 ? `✓ ${['Mo','Di','Mi','Do','Fr','Sa','So'][wd]} passt gut` : `✗ ${['Mo','Di','Mi','Do','Fr','Sa','So'][wd]} eher nicht`);
    }

    // Phase 2: Persönlichkeits-Faktor (ab 20 Feedbacks)
    if (pers && feedback.length >= 20) {
      const pFactor = pers.type === 'offen' ? 1.15 : pers.type === 'vorsichtig' ? 0.75 : pers.type === 'präzise' ? 0.90 : 1.0;
      score *= pFactor;
      factors.push(`${pers.icon} Typ ${pers.label} (×${pFactor})`);
    }

    // Korrektur-Malus: wenn Lernschluss kürzlich widerlegt wurde
    const state = this._triggerState(triggerId);
    if (state.correctionMalus && Date.now() - state.correctionMalus < 7 * 86400000) {
      score *= 0.60;
      factors.push('⚠ Letzte Annahme korrigiert (×0.6)');
    }

    // Auf 0..1 clampen
    score = Math.max(0.05, Math.min(0.99, score));

    // Schwelle aus Persönlichkeit
    const threshold = pers?.threshold || 0.58;
    const phase     = feedback.length >= 50 ? 3 : feedback.length >= 20 ? 2 : 1;

    return {
      score,
      phase,
      threshold,
      recommend:  score >= threshold,
      factors,
      explain:    factors.length > 0 ? factors.join(' · ') : 'Basis-Konfidenz ohne Zeitfenster-Daten',
    };
  },

  // ── Rückwärtskorrektur: Lernschluss widerlegen ────────────────────────────
  // Prüft nach jedem negativen Feedback ob ein Lernschluss widerlegt wurde
  _correctLearning(triggerId, card) {
    const mem      = this._loadMemory();
    const ml       = mem.metaLearning?.[triggerId];
    if (!ml) return;

    const feedback = (mem.feedback || [])
      .filter(f => f.triggerId === triggerId && !f.silent)
      .slice(-5); // letzte 5 Feedbacks

    if (feedback.length < 3) return;

    // 3 aufeinanderfolgende negative Feedbacks = Lernschluss widerlegt
    const lastThree = feedback.slice(-3);
    if (lastThree.every(f => f.delta < 0)) {
      const state = this._triggerState(triggerId);

      // Zeitfenster-Gewichte für diese Stunde zurücksetzen
      const now  = new Date();
      const hour = now.getHours();
      const wd   = (now.getDay() + 6) % 7;

      const prevHour = ml.hourWeights[hour];
      const prevWd   = ml.weekdayWeights[wd];

      // Auf Null zurück (nicht auf negativ — tabula rasa für diesen Slot)
      ml.hourWeights[hour]   = 0;
      ml.weekdayWeights[wd]  = 0;
      ml.lastCorrected       = Date.now();

      // Korrektur-Malus setzen
      state.correctionMalus  = Date.now();

      this._saveMemory();

      // Transparente Meldung
      if (Math.abs(prevHour) > 0.15 || Math.abs(prevWd) > 0.15) {
        card?._showToast?.(`🔄 KI korrigiert: "${triggerId}" Lernschluss verworfen · Sammle neue Daten`);
        console.info(`[KI Meta] Korrektur: ${triggerId} · Stunde ${hour} (${prevHour.toFixed(2)}→0) · Wochentag ${wd} (${prevWd.toFixed(2)}→0)`);
      }
    }
  },

  // ── Empfehlung erklären ───────────────────────────────────────────────────
  _explainRecommendation(triggerId, trigger) {
    const mem      = this._loadMemory();
    const ml       = mem.metaLearning?.[triggerId];
    const feedback = (mem.feedback || []).filter(f => f.triggerId === triggerId && !f.silent);
    const now      = new Date();
    const hour     = now.getHours();
    const wd       = (now.getDay() + 6) % 7;
    const DAYS     = ['Mo','Di','Mi','Do','Fr','Sa','So'];

    if (feedback.length < 3) {
      return `Noch wenig Daten (${feedback.length} Feedbacks) · Basis-Logik aktiv`;
    }

    const pos = feedback.filter(f => f.delta > 0).length;
    const neg = feedback.filter(f => f.delta < 0).length;

    const lines = [];

    // Warum empfohlen / warum nicht
    lines.push(`${pos}× akzeptiert, ${neg}× abgelehnt in der Vergangenheit`);

    if (ml && ml.sampleCount >= 5) {
      const hw = ml.hourWeights[hour];
      const ww = ml.weekdayWeights[wd];
      if (hw > 0.15)  lines.push(`✓ ${hour}:00 Uhr lehnst du selten ab`);
      if (hw < -0.15) lines.push(`✗ ${hour}:00 Uhr lehnst du oft ab`);
      if (ww > 0.15)  lines.push(`✓ ${DAYS[wd]} passt gut laut deiner Geschichte`);
      if (ww < -0.15) lines.push(`✗ ${DAYS[wd]} eher nicht laut deiner Geschichte`);
    }

    if (trigger?.reason) lines.push(`☀ ${trigger.reason}`);
    if (trigger?.blockedBy) lines.push(`⛔ Blockiert: ${trigger.blockedBy}`);

    const state = this._triggerState(triggerId);
    if (state.correctionMalus && Date.now() - state.correctionMalus < 7 * 86400000) {
      lines.push('⚠ Ich habe letzte Woche eine Annahme korrigiert — bin vorsichtiger');
    }

    return lines.join('\n');
  },

  // ── Meta-Learning Visualisierung ─────────────────────────────────────────
  _drawMetaLearning(ctx, w, y, pad, availH) {
    const mem  = this._loadMemory();
    const pers = mem.personality;
    const ml   = mem.metaLearning || {};
    const prog = this._buildProgressProfile();

    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('META-LEARNING · WIE DIE KI ÜBER DICH DENKT', pad, y + 9);
    y += 16;

    // Phase-Banner
    const phase     = prog.total >= 50 ? 3 : prog.total >= 20 ? 2 : prog.total >= 5 ? 1 : 0;
    const phaseCol  = ['#475569','#38bdf8','#a78bfa','#22c55e'][phase];
    const phaseLabel= ['⬜ Phase 0: Tabula Rasa','🔵 Phase 1: Zeitfenster','🟣 Phase 2: Persönlichkeit','🟢 Phase 3: Kontext-Lernen'][phase];
    const phaseDesc = [
      'Noch zu wenig Feedback (0–4). KI beobachtet still.',
      'Zeitfenster-Gewichte aktiv. KI lernt wann du ablehnst.',
      'Persönlichkeits-Typ erkannt. Konfidenz-Schwellen angepasst.',
      'Kontext-Lernen aktiv. KI verbindet Wetter+Zeit+Verhalten.',
    ][phase];

    ctx.fillStyle = phaseCol + '22';
    this._roundRect(ctx, pad, y, w - pad*2, 36, 6);
    ctx.fill();
    ctx.strokeStyle = phaseCol + '66';
    ctx.lineWidth = 1;
    this._roundRect(ctx, pad, y, w - pad*2, 36, 6);
    ctx.stroke();

    ctx.fillStyle = phaseCol;
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(phaseLabel, pad + 10, y + 15);
    ctx.fillStyle = '#64748b';
    ctx.font = '8px sans-serif';
    ctx.fillText(phaseDesc, pad + 10, y + 27);
    y += 42;

    // Persönlichkeits-Typ
    if (pers) {
      ctx.fillStyle = '#8b5cf622';
      this._roundRect(ctx, pad, y, w - pad*2, 30, 5);
      ctx.fill();
      ctx.font = '16px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(pers.icon, pad + 10, y + 15);
      ctx.fillStyle = '#a78bfa';
      ctx.font = 'bold 10px sans-serif';
      ctx.fillText(pers.label, pad + 30, y + 12);
      ctx.fillStyle = '#475569';
      ctx.font = '7.5px sans-serif';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(`Konfidenz-Schwelle: ${Math.round(pers.threshold*100)}% · erkannt bei ${pers.sampleCount} Feedbacks`, pad + 30, y + 24);
      y += 36;
    }

    // Zeitfenster-Heatmap pro Trigger
    const triggerIds = Object.keys(ml);
    if (triggerIds.length === 0) {
      ctx.fillStyle = '#334155';
      ctx.font = '8px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Noch keine Zeitfenster-Daten — erst nach Feedback', w/2, y + 30);
      return;
    }

    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 7px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('ZEITFENSTER-GEWICHTE (grün=bevorzugt, rot=gemieden)', pad, y + 9);
    y += 14;

    triggerIds.slice(0, 3).forEach(tid => {
      const tm   = ml[tid];
      if (!tm || tm.sampleCount < 3) return;

      // Label
      ctx.fillStyle = '#94a3b8';
      ctx.font = '7.5px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(tid, pad, y + 9);
      y += 12;

      // 24h Gewichts-Balken
      const cellW = (w - pad*2) / 24;
      const cellH = 12;

      for (let h = 0; h < 24; h++) {
        const val  = tm.hourWeights[h] || 0; // −1..+1
        const cx   = pad + h * cellW;
        const isNow = h === new Date().getHours();

        if (Math.abs(val) > 0.05) {
          const alpha = Math.abs(val);
          ctx.fillStyle = val > 0
            ? `rgba(34,197,94,${alpha})`
            : `rgba(239,68,68,${alpha})`;
          ctx.fillRect(cx, y, cellW - 0.5, cellH);
        }

        if (isNow) {
          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(cx, y, cellW, cellH);
        }
      }

      // Stunden-Labels
      [0,6,12,18].forEach(h => {
        ctx.fillStyle = '#334155';
        ctx.font = '6px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(h, pad + h * cellW, y + cellH + 8);
      });

      y += cellH + 12;
    });

    // Letzte Korrektur anzeigen
    const corrected = Object.entries(ml).filter(([,m]) => m.lastCorrected);
    if (corrected.length > 0) {
      ctx.fillStyle = '#f59e0b22';
      this._roundRect(ctx, pad, y, w - pad*2, 22, 4);
      ctx.fill();
      ctx.fillStyle = '#f59e0b';
      ctx.font = '8px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      const last = corrected.sort((a,b) => b[1].lastCorrected - a[1].lastCorrected)[0];
      ctx.fillText(`🔄 Letzte Korrektur: ${last[0]} · ${this._ageLabel(last[1].lastCorrected)}`, pad + 8, y + 11);
      y += 26;
    }
  },

  // ── Leeres Ergebnis ───────────────────────────────────────────────────────
  _emptyResult() {
    return {
      slots:     {},
      patterns:  [],
      profiles:  [],
      sequences: [],
      triggers:     [],
      twin:         null,
      solar:        null,
      anomalies:    [],
      maintenance:  [],
      crossLearning:[],
      proposals:    [],
      situation: { label: 'Keine Daten', icon: '❓', color: '#445566', desc: 'Keine Events gefunden', confidence: 0, meta: '' },
      meta:      { days: 0, events: 0, patterns: 0, slotMin: this._kiSlotMin }
    };
  },

  // ── Konfiguration speichern ────────────────────────────────────────────────
  _save(card) {
    card?._saveOpts?.();
  },

  // ── Tab aktiviert ──────────────────────────────────────────────────────────
  onActivate(card) {
    this._loadMemory();
    const cfg = card._opts?.ki_cfg || {};
    if (cfg.auto_refresh && cfg.entities?.length > 0 && !this._kiLoading) {
      this._startAnalysis(card);
    }
    this._scheduleDailyQuestion(card);
    this._scheduleWeeklyReport(card);
    // HA Event-Subscription für Notification-Rückkopplung
    this._subscribeNotificationActions(card);
  },

  // ── Tab deaktiviert ────────────────────────────────────────────────────────
  onDeactivate(card) {
    this._unsubscribeNotificationActions(card);
  },

  // ══════════════════════════════════════════════════════════════════════════
  // HA NOTIFICATION RÜCKKOPPLUNG
  // User tippt 👍/👎 in HA Mobile App → ki.js empfängt und verarbeitet
  // ══════════════════════════════════════════════════════════════════════════

  // ── HA WebSocket Event-Subscription ──────────────────────────────────────
  _subscribeNotificationActions(card) {
    const conn = card?._hass?.connection;
    if (!conn || this._notifSubscription) return;

    // Auf mobile_app_notification_action Events hören
    this._notifSubscription = conn.subscribeEvents(
      (event) => this._handleNotificationAction(event, card),
      'mobile_app_notification_action'
    ).catch(e => {
      console.warn('[KI Notification] Event-Subscription fehlgeschlagen:', e.message);
      this._notifSubscription = null;
    });

    // Auch auf lovelace_updated hören (für tägliche Frage via persistent_notification)
    this._notifSubscriptionDaily = conn.subscribeEvents(
      (event) => this._handleDailyActionEvent(event, card),
      'mobile_app_notification_action'
    ).catch(() => {});

    console.info('[KI] Notification-Rückkopplung aktiv');
  },

  // ── Subscription beenden ──────────────────────────────────────────────────
  _unsubscribeNotificationActions(card) {
    if (this._notifSubscription) {
      Promise.resolve(this._notifSubscription).then(unsub => unsub?.());
      this._notifSubscription = null;
    }
  },

  // ── Notification Action verarbeiten ──────────────────────────────────────
  _handleNotificationAction(event, card) {
    const action = event?.data?.action || '';
    if (!action.startsWith('ki_')) return; // nur KI-Aktionen

    console.info('[KI Notification] Action empfangen:', action);

    // ── Trigger-Feedback ──────────────────────────────────────────────────
    // Format: ki_thumbup_{triggerId} / ki_thumbdown_{triggerId} / ki_snooze_{triggerId}
    const thumbUpMatch   = action.match(/^ki_thumbup_(.+)$/);
    const thumbDownMatch = action.match(/^ki_thumbdown_(.+)$/);
    const snoozeMatch    = action.match(/^ki_snooze_(.+)$/);

    if (thumbUpMatch) {
      const triggerId = thumbUpMatch[1];
      this._reward(triggerId, +3, 'notification_thumbup', card);
      const st = this._triggerState(triggerId);
      st.acceptCount = (st.acceptCount || 0) + 1;
      st.runCount    = (st.runCount    || 0) + 1;
      this._saveMemory();
      card?._showToast?.(`👍 Danke! KI lernt für "${triggerId}"`);
      card?._rebuildSidebar?.();
    }

    if (thumbDownMatch) {
      const triggerId = thumbDownMatch[1];
      this._reward(triggerId, -3, 'notification_thumbdown', card);
      const st    = this._triggerState(triggerId);
      st.runCount = (st.runCount || 0) + 1;
      this._saveMemory();
      card?._showToast?.(`👎 Notiert. KI passt sich an`);
      card?._rebuildSidebar?.();
    }

    if (snoozeMatch) {
      const triggerId = snoozeMatch[1];
      this._overrideOnce(triggerId, card);
    }

    // ── Abend-Feedback (ki_evening_{triggerId}_{ok|nok}) ──────────────────
    const eveningMatch = action.match(/^ki_evening_(.+)_(ok|nok)$/);
    if (eveningMatch) {
      const triggerId = eveningMatch[1];
      const positive  = eveningMatch[2] === 'ok';
      this._reward(triggerId, positive ? +2 : -2, 'evening_summary', card);
      card?._showToast?.(positive ? '✅ Gut zu wissen!' : '❌ Notiert, ich lerne daraus');
    }
  },

  // ── Tägliche Frage Action verarbeiten ─────────────────────────────────────
  _handleDailyActionEvent(event, card) {
    const action = event?.data?.action || '';

    if (action === 'ki_daily_yes') {
      // Alles war gut heute — alle aktiven Trigger leicht belohnen
      const mem = this._loadMemory();
      const today = new Date().toDateString();
      const todayFeedback = (mem.feedback || []).filter(f => new Date(f.ts).toDateString() === today);
      const triggerIds    = [...new Set(todayFeedback.map(f => f.triggerId).filter(Boolean))];

      triggerIds.forEach(id => {
        this._rewardWeighted(id, +1, 'daily_ok', 0.5, card);
      });
      card?._showToast?.(`✅ Gut! ${triggerIds.length} Trigger leicht belohnt`);
      card?._rebuildSidebar?.();
    }

    if (action === 'ki_daily_no') {
      // Etwas war falsch — User soll im Tool nachsehen
      card?._showToast?.('❌ Bitte im KI-Tab → Trigger nachsehen was falsch war');
      // Tab auf Trigger wechseln
      this._kiTab = 'trigger';
      card?._markDirty?.();
    }

    if (action === 'ki_weekly_ok') {
      // Wochenrückblick OK — alle Trigger der Woche leicht positiv
      const mem   = this._loadMemory();
      const weekMs = 7 * 24 * 60 * 60 * 1000;
      const weekFb = (mem.feedback || []).filter(f => Date.now() - f.ts < weekMs);
      const ids    = [...new Set(weekFb.map(f => f.triggerId).filter(Boolean))];
      ids.forEach(id => this._rewardWeighted(id, +0.5, 'weekly_ok', 0.3, card));
      card?._showToast?.(`✅ Woche bestätigt · ${ids.length} Trigger leicht belohnt`);
    }

    if (action === 'ki_weekly_review') {
      // User will Details sehen → KI-Tab öffnen
      this._kiTab = 'meta';
      card?._markDirty?.();
      card?._showToast?.('🧠 Meta-Learning Tab geöffnet');
    }
  },

  // ── Abend-Zusammenfassung senden ──────────────────────────────────────────
  // Fasst alle heutigen KI-Aktionen zusammen und fragt einmal
  async _sendEveningSummary(card) {
    const hass     = card?._hass;
    const cfg      = card?._opts?.ki_cfg || {};
    const notifCfg = cfg.notifications || {};
    const target   = notifCfg.notify_service || 'notify.notify';
    if (!hass || !notifCfg.enabled) return;

    const mem   = this._loadMemory();
    const today = new Date().toDateString();
    const todayFb = (mem.feedback || []).filter(f => new Date(f.ts).toDateString() === today && !f.silent);

    // Nur wenn heute etwas passiert ist
    if (todayFb.length === 0) return;

    // Letzte Aktion des Tages zusammenfassen
    const lastTrigger = todayFb[todayFb.length - 1];
    const trigger     = this._kiData?.triggers?.find(t => t.id === lastTrigger?.triggerId);
    const label       = trigger?.label || lastTrigger?.triggerId || 'KI-Aktion';

    const accepted = todayFb.filter(f => f.delta > 0).length;
    const rejected = todayFb.filter(f => f.delta < 0).length;

    try {
      await hass.callService('notify', target.replace('notify.', ''), {
        title: '🧠 KI-Tagesabschluss',
        message: `Heute: ${accepted + rejected} Aktionen · ${accepted}× gut · ${rejected}× abgelehnt\nAlles in Ordnung mit "${label}"?`,
        data: {
          actions: [
            { action: `ki_evening_${lastTrigger?.triggerId}_ok`,  title: '✅ Alles gut' },
            { action: `ki_evening_${lastTrigger?.triggerId}_nok`, title: '❌ War nicht ideal' },
          ]
        }
      });
    } catch (e) {
      console.warn('[KI Evening]', e.message);
    }
  },



};
