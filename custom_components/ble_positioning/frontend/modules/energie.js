// ═══════════════════════════════════════════════════════════════════════════
// BLE Positioning – Modul: ENERGIE
// Version: 1.0.0
// Datei: /config/www/ble_positioning/modules/energie.js
// Wird lazy per fetch() geladen – kein HA-Neustart bei Updates nötig
// ═══════════════════════════════════════════════════════════════════════════

// ── Presets für bekannte Solar-Systeme ───────────────────────────────────────
const ENERGIE_PRESETS = {
  generic: {
    label: "Generisch (freie Felder)",
    icon: "⚡",
    fields: {}
  },
  epever: {
    label: "Epever MPPT (ESPHome / ep-ever Integration)",
    icon: "☀",
    fields: {
      solar_power:    "sensor.epever_solar_w",
      solar_voltage:  "sensor.epever_solar_v",
      solar_current:  "sensor.epever_solar_a",
      solar_max_v:    "sensor.epever_solar_max",
      battery_soc:    "sensor.epever_batt_soc",
      battery_volt:   "sensor.epever_batt_v",
      battery_curr:   "sensor.epever_batt_a",
      battery_power:  "sensor.epever_batt_w",
      battery_temp:   "sensor.epever_batt_temp",
      battery_state:  "sensor.epever_batt_state",
      charge_state:   "sensor.epever_charger_state",
      load_power:     "sensor.epever_load_w",
      load_voltage:   "sensor.epever_load_v",
      load_current:   "sensor.epever_load_a",
      load_switch:    "switch.epever_load_state",
      gen_day:        "sensor.epever_gen_day",
      gen_month:      "sensor.epever_gen_mon",
      gen_total:      "sensor.epever_gen_tot",
      cons_day:       "sensor.epever_cons_day",
      device_temp:    "sensor.epever_device_temp",
    }
  },
  victron_smartshunt: {
    label: "Victron SmartShunt (BLE via ESP32)",
    icon: "🔋",
    // Entity-Namen vom esp32-bluetooth-proxy (BLE-Integration)
    // Gerätename "Victronsmart" → Entity-Prefix anpassen!
    fields: {
      battery_soc:       "sensor.victronsmart_battery_soc",
      battery_volt:      "sensor.victronsmart_battery_voltage",
      battery_curr:      "sensor.victronsmart_battery_current",
      battery_power:     "sensor.victronsmart_battery_power",
      battery_state:     "sensor.victronsmart_battery_state",
      consumed_ah:       "sensor.victronsmart_consumed_ah",
      time_to_go:        "sensor.victronsmart_time_remaining",
      // Relais A-D (Wechselrichter, 12V Dose, 230V Steckdose, Reserve)
      relay_a:           "switch.victronsmart_relay_a",   // Wechselrichter
      relay_b:           "switch.victronsmart_relay_b",   // 12V Dose
      relay_c:           "switch.victronsmart_relay_c",   // 230V Steckdosen
      relay_d:           "switch.victronsmart_relay_d",   // Reserviert
    }
  },
  victron: {
    label: "Victron (VE.Direct/Cerbo)",
    icon: "🔋",
    fields: {
      solar_power:   "sensor.victron_pv_power",
      battery_soc:   "sensor.victron_battery_soc",
      battery_volt:  "sensor.victron_battery_voltage",
      load_power:    "sensor.victron_ac_consumption",
      grid_power:    "sensor.victron_grid_power",
      charge_state:  "sensor.victron_battery_state",
    }
  },
  hybrid_inverter: {
    label: "Hybrid-Wechselrichter (Off-Grid, PI30/SBU)",
    icon: "🔌",
    // Für Noname-Wechselrichter mit PI30-Protokoll (SBU first, Off Grid)
    fields: {
      solar_power:        "sensor.hybridwechselrichter_pv_input_power",
      solar_voltage:      "sensor.hybridwechselrichter_pv_input_voltage",
      solar_current:      "sensor.hybridwechselrichter_pv_input_current",
      solar_charging:     "sensor.hybridwechselrichter_pv_charging_power",
      solar_total:        "sensor.hybridwechselrichter_pv_generation_sum",
      battery_soc:        "sensor.hybridwechselrichter_battery_percent",
      battery_volt:       "sensor.hybridwechselrichter_battery_voltage",
      battery_curr:       "sensor.hybridwechselrichter_battery_load",
      charge_state:       "sensor.hybridwechselrichter_inverter_operation_mode",
      load_power:         "sensor.hybridwechselrichter_ac_out_watt",
      load_voltage:       "sensor.hybridwechselrichter_ac_out_voltage",
      load_percent:       "sensor.hybridwechselrichter_ac_out_percent",
      inverter_mode:      "sensor.hybridwechselrichter_inverter_operation_mode",
      output_priority:    "sensor.hybridwechselrichter_output_source_priority",
      inverter_sw:        "switch.victronsmart_relay_a",  // Relais A = WR an/aus
    }
  },
  fronius: {
    label: "Fronius Solar",
    icon: "🌞",
    fields: {
      solar_power:   "sensor.fronius_power_photovoltaics",
      grid_power:    "sensor.fronius_power_grid",
      battery_soc:   "sensor.fronius_state_of_charge",
      load_power:    "sensor.fronius_power_load",
      charge_state:  "sensor.fronius_storage_state",
    }
  },
  shelly_em: {
    label: "Shelly EM Stromzähler",
    icon: "📊",
    fields: {
      grid_power:    "sensor.shelly_em_channel_1_power",
      grid_energy:   "sensor.shelly_em_channel_1_energy",
      load_power:    "sensor.shelly_em_channel_2_power",
    }
  },
};

// ── Power-Routing Stufen ─────────────────────────────────────────────────────
// Nutzer definiert Prioritäten: Überschuss wird in dieser Reihenfolge geleitet
const DEFAULT_ROUTING = [
  { id:"battery",   name:"Batterie laden",    icon:"🔋", threshold_w: 0   },
  { id:"boiler",    name:"Boiler/Warmwasser", icon:"♨",  threshold_w: 200 },
  { id:"wallbox",   name:"E-Auto Wallbox",    icon:"🚗", threshold_w: 1400},
  { id:"pool",      name:"Pool-Pumpe",        icon:"🏊", threshold_w: 200 },
  { id:"powerbank", name:"Powerbank",         icon:"📱", threshold_w: 10  },
];

// Relais-Definitionen für Victron SmartShunt (Relais A-D)
// Wird angezeigt wenn victron_smartshunt Preset aktiv
const VICTRON_RELAIS = [
  {
    id: "relay_a",
    name: "Relais A – Wechselrichter",
    icon: "🔌",
    desc: "Hybrid-WR ein/aus (Leerlauf ~30W → im Winter aus!)",
    threshold_w: 300,       // WR nur bei >300W Solar
    min_batt_pct: 40,       // Und Batterie > 40%
    auto_off_batt_pct: 20,  // Ausschalten bei < 20%
    seasonal: false,        // Ganzjährig steuerbar
  },
  {
    id: "relay_b",
    name: "Relais B – 12V Dose",
    icon: "🔋",
    desc: "Winter: Batterie-Heizung | Sommer: Powerbank laden",
    summer_threshold_w: 50,  // Sommer: ab 50W Überschuss
    winter_auto: true,        // Winter: automatisch wenn Temp < 5°C
    winter_temp_entity: "",   // optional: Außentemperatur-Sensor
  },
  {
    id: "relay_c",
    name: "Relais C – 230V Steckdose",
    icon: "🔌",
    desc: "Garten-Akkus / Werkzeug laden (braucht WR aktiv!)",
    threshold_w: 400,
    requires_relay: "relay_a",  // Nur wenn WR (Relay A) an
  },
  {
    id: "relay_d",
    name: "Relais D – Reserviert",
    icon: "❓",
    desc: "Noch nicht belegt",
    threshold_w: 0,
  },
];

// ── Modul-Objekt ─────────────────────────────────────────────────────────────

const EnergieModul = {
  id:          "energie",
  name:        "Energie",
  icon:        "⚡",
  tabId:       "energie_modul",
  version:     "1.0.0",
  description: "Solar, Verbrauch, Power-Routing",

  _card:    null,
  _pollBuf: [],   // Letzten N Werte für Sparkline
  _lastData: {},

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  init(card) {
    this._card = card;
    console.info("[BLE Energie] Modul initialisiert");
    // Saison-Check beim Start
    if (!this.isActive(card)) {
      console.info("[BLE Energie] Modul außerhalb der konfigurierten Saison – pausiert");
    }
  },

  destroy() {
    this._card = null;
    this._pollBuf = [];
    this._lastData = {};
  },

  // Saison-Check (opt-in, default: immer aktiv)
  isActive(card) {
    const cfg = card?._opts?.energie_cfg || {};
    if (!cfg.saison_active) return true; // Saison-Modus aus → immer aktiv
    const now = new Date();
    const mm = now.getMonth() + 1; // 1-12
    const from = parseInt(cfg.saison_from || 1);
    const to   = parseInt(cfg.saison_to   || 12);
    if (from <= to) return mm >= from && mm <= to;
    return mm >= from || mm <= to; // Jahreswechsel (z.B. Nov-Feb)
  },

  // ── Poll-Hook: Werte aus HA lesen ─────────────────────────────────────────
  onPoll(data, card) {
    const cfg  = card?._opts?.energie_cfg || {};
    const hass = card?._hass;
    if (!hass) return;

    const get = (key) => {
      const eid = cfg[key];
      if (!eid) return null;
      const s = hass.states[eid];
      if (!s || s.state === 'unavailable' || s.state === 'unknown') return null;
      return parseFloat(s.state) || null;
    };

    // Epever MPPT Daten
    const epever_solar = get('solar_power');
    // Hybrid-WR Solar (addieren wenn beide vorhanden)
    const wr_solar = get('solar_charging') || get('solar_power');
    const total_solar = (epever_solar || 0) + (wr_solar && wr_solar !== epever_solar ? wr_solar : 0) || epever_solar || wr_solar;

    // Victron SmartShunt: präzise Batterie-Daten (bevorzugt vor Epever)
    const vict_soc  = get('victron_soc')  || get('battery_soc');
    const vict_volt = get('victron_volt') || get('battery_volt');
    const vict_curr = get('victron_curr') || get('battery_curr');

    // Wechselrichter Status
    const wr_mode = cfg.inverter_mode ? hass.states[cfg.inverter_mode]?.state : null;
    const wr_active = wr_mode && !['Standby','standby','off','Off'].includes(wr_mode);

    this._lastData = {
      solar_w:      total_solar,
      solar_v:      get('solar_voltage'),
      batt_pct:     vict_soc,
      batt_v:       vict_volt,
      batt_curr:    vict_curr,
      batt_w:       get('battery_power'),
      batt_temp:    get('battery_temp'),
      batt_state:   cfg.battery_state ? hass.states[cfg.battery_state]?.state : null,
      load_w:       get('load_power'),
      load_v:       get('load_voltage'),
      load_pct:     get('load_percent'),
      grid_w:       get('grid_power'),
      charge:       cfg.charge_state ? hass.states[cfg.charge_state]?.state : null,
      inverter_on:  wr_active,
      inverter_mode: wr_mode,
      gen_day:      get('gen_day'),
      gen_month:    get('gen_month'),
      cons_day:     get('cons_day'),
      device_temp:  get('device_temp'),
      // Relais-Status
      relay_a: cfg.relay_a ? hass.states[cfg.relay_a]?.state : null,
      relay_b: cfg.relay_b ? hass.states[cfg.relay_b]?.state : null,
      relay_c: cfg.relay_c ? hass.states[cfg.relay_c]?.state : null,
      relay_d: cfg.relay_d ? hass.states[cfg.relay_d]?.state : null,
      ts: Date.now(),
    };

    // Sparkline-Buffer (letzten 60 Werte)
    if (this._lastData.solar_w !== null) {
      this._pollBuf.push({ ts: Date.now(), w: this._lastData.solar_w });
      if (this._pollBuf.length > 60) this._pollBuf.shift();
    }

    // Power-Routing: Überschuss berechnen und Automationen triggern
    if (cfg.routing_active) this._checkRouting(card);
  },

  // ── Power-Routing Logik ───────────────────────────────────────────────────
  _checkRouting(card) {
    const d    = this._lastData;
    const cfg  = card?._opts?.energie_cfg || {};
    const hass = card?._hass;
    if (!hass || d.solar_w === null) return;

    const surplus = (d.solar_w || 0) - (d.load_w || 0);
    const routing = cfg.routing || DEFAULT_ROUTING;

    routing.forEach(step => {
      const entity = cfg[`routing_${step.id}_entity`];
      if (!entity) return;
      const shouldOn = surplus >= step.threshold_w;
      const curState = hass.states[entity]?.state;
      if (shouldOn && curState === 'off') {
        hass.callService('switch', 'turn_on', { entity_id: entity })
          .catch(() => {});
      } else if (!shouldOn && curState === 'on' && cfg[`routing_${step.id}_auto_off`]) {
        hass.callService('switch', 'turn_off', { entity_id: entity })
          .catch(() => {});
      }
    });
  },

  // ── Sidebar ───────────────────────────────────────────────────────────────
  buildSidebar(card) {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'padding:8px;display:flex;flex-direction:column;gap:8px';

    const hdr = document.createElement('div');
    hdr.style.cssText = 'font-size:10px;font-weight:700;color:#f59e0b;letter-spacing:1px';
    hdr.textContent = '⚡ ENERGIE';
    wrap.appendChild(hdr);

    if (!this.isActive(card)) {
      const offNote = document.createElement('div');
      offNote.style.cssText = 'padding:10px;background:var(--surf2);border-radius:6px;font-size:8px;color:#445566;text-align:center';
      const cfg = card?._opts?.energie_cfg || {};
      offNote.textContent = `Saison-Modus: Modul pausiert (${cfg.saison_from || 1}.–${cfg.saison_to || 12}. Monat)`;
      wrap.appendChild(offNote);
      return wrap;
    }

    const d = this._lastData;

    // ── Solar-Übersicht ──────────────────────────────────────────
    const solarBox = this._mkBox('Solar & Batterie');
    const grid2 = document.createElement('div');
    grid2.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:6px';

    [
      { label:'Solar',    val: d.solar_w != null ? `${Math.round(d.solar_w)} W` : '–', color:'#f59e0b', icon:'☀' },
      { label:'Batterie', val: d.batt_pct != null ? `${Math.round(d.batt_pct)} %` : '–', color: this._battColor(d.batt_pct), icon:'🔋' },
      { label:'Verbrauch',val: d.load_w  != null ? `${Math.round(d.load_w)} W` : '–', color:'#94a3b8', icon:'💡' },
      { label:'Netz',     val: d.grid_w  != null ? `${d.grid_w >= 0 ? '+' : ''}${Math.round(d.grid_w)} W` : '–', color: d.grid_w >= 0 ? '#22c55e' : '#ef4444', icon:'🔌' },
    ].forEach(({label, val, color, icon}) => {
      const tile = document.createElement('div');
      tile.style.cssText = `background:var(--bg);border-radius:6px;padding:6px 8px;border:1px solid #1c2535`;
      tile.innerHTML = `<div style="font-size:7px;color:#445566;margin-bottom:2px">${icon} ${label}</div>
        <div style="font-size:14px;font-weight:700;color:${color}">${val}</div>`;
      grid2.appendChild(tile);
    });
    solarBox.appendChild(grid2);

    // Batterie-Ladebalken
    if (d.batt_pct != null) {
      const barWrap = document.createElement('div');
      barWrap.style.cssText = 'height:6px;background:#1c2535;border-radius:3px;overflow:hidden;margin-bottom:4px';
      const bar = document.createElement('div');
      bar.style.cssText = `height:100%;width:${Math.min(100,d.batt_pct)}%;background:${this._battColor(d.batt_pct)};border-radius:3px;transition:width 0.5s`;
      barWrap.appendChild(bar);
      solarBox.appendChild(barWrap);
    }

    // Sparkline Solar (letzten 60 Polls)
    if (this._pollBuf.length > 2) {
      const spark = this._mkSparkline(this._pollBuf.map(p => p.w), '#f59e0b', 180, 32);
      solarBox.appendChild(spark);
    }

    // Überschuss-Anzeige
    if (d.solar_w != null && d.load_w != null) {
      const surplus = d.solar_w - d.load_w;
      const surEl = document.createElement('div');
      surEl.style.cssText = 'text-align:center;font-size:8px;margin-top:4px';
      surEl.innerHTML = `Überschuss: <span style="font-weight:700;color:${surplus >= 0 ? '#22c55e' : '#ef4444'}">${surplus >= 0 ? '+' : ''}${Math.round(surplus)} W</span>`;
      solarBox.appendChild(surEl);
    }

    wrap.appendChild(solarBox);

    // ── Wechselrichter & Relais Panel ───────────────────────────
    const cfg = card?._opts?.energie_cfg || {};
    const hasRelais = cfg.relay_a || cfg.relay_b || cfg.relay_c || cfg.relay_d;
    if (hasRelais) {
      const relBox = this._mkBox('Relais & Verbraucher');

      // WR-Status prominent anzeigen
      if (cfg.relay_a) {
        const wrOn = d.relay_a === 'on';
        const wrRow = document.createElement('div');
        wrRow.style.cssText = `display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:6px;margin-bottom:6px;background:${wrOn ? '#22c55e18' : '#ef444418'};border:1px solid ${wrOn ? '#22c55e44' : '#ef444444'}`;
        wrRow.innerHTML = `<span style="font-size:18px">🔌</span>
          <div style="flex:1">
            <div style="font-size:9px;font-weight:700;color:var(--text)">Wechselrichter (230V)</div>
            <div style="font-size:7.5px;color:#445566">Leerlauf ~30W · Relay A</div>
          </div>
          <span style="font-size:11px;font-weight:700;color:${wrOn ? '#22c55e' : '#ef4444'}">${wrOn ? '● AN' : '○ AUS'}</span>`;
        // Toggle-Button
        const wrBtn = document.createElement('button');
        wrBtn.style.cssText = `padding:4px 10px;border-radius:4px;border:1px solid ${wrOn ? '#ef4444' : '#22c55e'};background:transparent;color:${wrOn ? '#ef4444' : '#22c55e'};font-size:8px;cursor:pointer;flex-shrink:0`;
        wrBtn.textContent = wrOn ? 'AUS' : 'AN';
        wrBtn.addEventListener('click', () => {
          const svc = wrOn ? 'turn_off' : 'turn_on';
          card._hass.callService('switch', svc, { entity_id: cfg.relay_a }).catch(()=>{});
          card._showToast(`Wechselrichter ${wrOn ? 'ausschalten' : 'einschalten'}...`);
        });
        wrRow.appendChild(wrBtn);
        relBox.appendChild(wrRow);
      }

      // Relais B-D
      [
        { key:'relay_b', name:'12V Dose (B)',   icon:'🔋', desc: 'Winter: Heizung | Sommer: Powerbank' },
        { key:'relay_c', name:'230V Steckdose (C)', icon:'🔌', desc:'Garten-Akkus / Werkzeug' },
        { key:'relay_d', name:'Relais D',        icon:'❓', desc:'Reserviert' },
      ].forEach(({key, name, icon, desc}) => {
        if (!cfg[key]) return;
        const state = d[key];
        if (state === null) return;
        const on = state === 'on';
        const row = document.createElement('div');
        row.style.cssText = `display:flex;align-items:center;gap:6px;padding:4px 6px;border-radius:4px;margin-bottom:3px;background:${on ? '#22c55e11' : 'var(--surf2)'}`;
        const btn = document.createElement('button');
        btn.style.cssText = `padding:3px 8px;border-radius:4px;border:1px solid ${on ? '#ef4444' : '#22c55e'};background:transparent;color:${on ? '#ef4444' : '#22c55e'};font-size:8px;cursor:pointer;flex-shrink:0`;
        btn.textContent = on ? 'AUS' : 'AN';
        btn.addEventListener('click', () => {
          card._hass.callService('switch', on ? 'turn_off' : 'turn_on', { entity_id: cfg[key] }).catch(()=>{});
        });
        row.innerHTML = `<span style="font-size:13px">${icon}</span>
          <div style="flex:1;min-width:0">
            <div style="font-size:8px;font-weight:700;color:var(--text)">${name}</div>
            <div style="font-size:7px;color:#445566;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${desc}</div>
          </div>
          <span style="font-size:8px;color:${on ? '#22c55e' : '#445566'}">${on ? '●' : '○'}</span>`;
        row.appendChild(btn);
        relBox.appendChild(row);
      });

      wrap.appendChild(relBox);
    }

    // ── Tagesstatistik ────────────────────────────────────────────
    if (d.gen_day != null || d.cons_day != null) {
      const statBox = this._mkBox('Heute');
      const statGrid = document.createElement('div');
      statGrid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:4px';
      [
        { label:'Solar erzeugt', val: d.gen_day != null ? `${d.gen_day} kWh` : '–', color:'#f59e0b' },
        { label:'Verbrauch',     val: d.cons_day != null ? `${d.cons_day} kWh` : '–', color:'#94a3b8' },
        { label:'Batt. Temp.',   val: d.batt_temp != null ? `${d.batt_temp} °C` : '–', color: (d.batt_temp||0) < 5 ? '#ef4444' : '#22c55e' },
        { label:'Gerät Temp.',   val: d.device_temp != null ? `${d.device_temp} °C` : '–', color:'#94a3b8' },
      ].forEach(({label, val, color}) => {
        const tile = document.createElement('div');
        tile.style.cssText = 'background:var(--bg);border-radius:4px;padding:4px 6px;border:1px solid #1c2535';
        tile.innerHTML = `<div style="font-size:6.5px;color:#445566;margin-bottom:1px">${label}</div>
          <div style="font-size:11px;font-weight:700;color:${color}">${val}</div>`;
        statGrid.appendChild(tile);
      });
      statBox.appendChild(statGrid);
      wrap.appendChild(statBox);
    }

    // ── Power-Routing Status ─────────────────────────────────────
    if (cfg.routing_active) {
      const routeBox = this._mkBox('⚡ Power-Routing');
      const routing  = cfg.routing || DEFAULT_ROUTING;
      const surplus  = (d.solar_w || 0) - (d.load_w || 0);

      routing.forEach(step => {
        const entity = cfg[`routing_${step.id}_entity`];
        if (!entity) return;
        const state  = card?._hass?.states[entity]?.state || 'unknown';
        const active = state === 'on';
        const canOn  = surplus >= step.threshold_w;

        const row = document.createElement('div');
        row.style.cssText = `display:flex;align-items:center;gap:6px;padding:4px 6px;border-radius:4px;margin-bottom:2px;background:${active ? '#22c55e11' : 'var(--surf2)'}`;
        row.innerHTML = `<span style="font-size:12px">${step.icon}</span>
          <span style="flex:1;font-size:8px;color:var(--text)">${step.name}</span>
          <span style="font-size:7px;color:${canOn ? '#22c55e' : '#445566'}">≥${step.threshold_w}W</span>
          <span style="font-size:8px;font-weight:700;color:${active ? '#22c55e' : '#445566'}">${active ? '● AN' : '○ AUS'}</span>`;
        routeBox.appendChild(row);
      });

      wrap.appendChild(routeBox);
    }

    return wrap;
  },

  // ── Konfiguration (in ⚙ OPT eingebunden) ─────────────────────────────────
  buildConfig(card) {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;flex-direction:column;gap:6px';

    const cfg = card?._opts?.energie_cfg || {};
    const save = (key, val) => {
      if (!card._opts) card._opts = {};
      if (!card._opts.energie_cfg) card._opts.energie_cfg = {};
      card._opts.energie_cfg[key] = val;
      card._saveOptions();
    };
    const mkField = (label, key, placeholder, type='text') => {
      const row = document.createElement('div');
      const lbl = document.createElement('div');
      lbl.style.cssText = 'font-size:7px;color:#445566;margin-bottom:2px';
      lbl.textContent = label;
      const inp = document.createElement('input');
      inp.type = type; inp.value = cfg[key] || '';
      inp.placeholder = placeholder;
      inp.style.cssText = 'width:100%;padding:3px 6px;border-radius:4px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-size:8px';
      inp.addEventListener('input', () => save(key, inp.value.trim()));
      row.append(lbl, inp);
      return row;
    };

    // Preset-Auswahl
    const presetHdr = document.createElement('div');
    presetHdr.style.cssText = 'font-size:8px;font-weight:700;color:#f59e0b;margin-bottom:4px';
    presetHdr.textContent = 'System-Preset wählen:';
    wrap.appendChild(presetHdr);

    const presetRow = document.createElement('div');
    presetRow.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px';
    Object.entries(ENERGIE_PRESETS).forEach(([id, preset]) => {
      const btn = document.createElement('button');
      btn.style.cssText = 'padding:4px 8px;border-radius:4px;border:1px solid var(--border);background:var(--surf2);color:var(--text);font-size:8px;cursor:pointer';
      btn.textContent = `${preset.icon} ${preset.label}`;
      btn.title = `Felder für ${preset.label} vorausfüllen`;
      btn.addEventListener('click', () => {
        if (!card._opts) card._opts = {};
        if (!card._opts.energie_cfg) card._opts.energie_cfg = {};
        Object.assign(card._opts.energie_cfg, preset.fields);
        card._saveOptions();
        card._rebuildSidebar();
        card._showToast(`✅ Preset: ${preset.label}`);
      });
      presetRow.appendChild(btn);
    });
    wrap.appendChild(presetRow);

    // Entity-Felder
    const fieldsBox = document.createElement('div');
    fieldsBox.style.cssText = 'background:var(--surf2);border-radius:6px;padding:8px;border:1px solid #1c2535';
    const fieldsHdr = document.createElement('div');
    fieldsHdr.style.cssText = 'font-size:8px;font-weight:700;color:#94a3b8;margin-bottom:6px';
    fieldsHdr.textContent = 'Entity-Zuordnung (alle optional):';
    fieldsBox.appendChild(fieldsHdr);
    // Sensor-Felder (generisch – Preset füllt automatisch aus)
    const sensorFields = [
      ['Solar Leistung (W)',         'solar_power',    'sensor.epever_solar_w'],
      ['Solar Spannung (V)',         'solar_voltage',  'sensor.epever_solar_v'],
      ['Batterie SOC (%)',           'battery_soc',    'sensor.epever_batt_soc'],
      ['Batterie Spannung (V)',      'battery_volt',   'sensor.epever_batt_v'],
      ['Batterie Leistung (W)',      'battery_power',  'sensor.epever_batt_w'],
      ['Batterie Temperatur (°C)',   'battery_temp',   'sensor.epever_batt_temp'],
      ['Batterie Status (Text)',     'battery_state',  'sensor.epever_batt_state'],
      ['Ladestatus (Text)',          'charge_state',   'sensor.epever_charger_state'],
      ['Last / Verbrauch (W)',       'load_power',     'sensor.epever_load_w'],
      ['WR-Modus (Text)',            'inverter_mode',  'sensor.hybridwechselrichter_inverter_operation_mode'],
      ['WR AC-Ausgang (W)',          'ac_out_power',   'sensor.hybridwechselrichter_ac_out_watt'],
      ['Erzeugung Heute (kWh)',      'gen_day',        'sensor.epever_gen_day'],
      ['Erzeugung Monat (kWh)',      'gen_month',      'sensor.epever_gen_mon'],
      ['Verbrauch Heute (kWh)',      'cons_day',       'sensor.epever_cons_day'],
      ['Gerät Temperatur (°C)',      'device_temp',    'sensor.epever_device_temp'],
      ['Netz-Bezug (W, +/−)',        'grid_power',     'sensor.grid_power'],
    ];
    sensorFields.forEach(([label, key, ph]) => fieldsBox.appendChild(mkField(label, key, ph)));

    // Relais A-D (Victron SmartShunt)
    const relaisBox = document.createElement('div');
    relaisBox.style.cssText = 'background:var(--surf2);border-radius:6px;padding:8px;border:1px solid #1c2535;margin-top:6px';
    const relaisHdr = document.createElement('div');
    relaisHdr.style.cssText = 'font-size:8px;font-weight:700;color:#94a3b8;margin-bottom:6px';
    relaisHdr.textContent = '🔌 Relais A–D (Victron SmartShunt)';
    relaisBox.appendChild(relaisHdr);
    [
      ['relay_a', 'Relais A – Wechselrichter',  'switch.victronsmart_relay_a'],
      ['relay_b', 'Relais B – 12V Dose',         'switch.victronsmart_relay_b'],
      ['relay_c', 'Relais C – 230V Steckdose',   'switch.victronsmart_relay_c'],
      ['relay_d', 'Relais D – Reserviert',        'switch.victronsmart_relay_d'],
    ].forEach(([key, label, ph]) => relaisBox.appendChild(mkField(label, key, ph)));
    wrap.appendChild(relaisBox);
    wrap.appendChild(fieldsBox);

    // Saison-Modus (opt-in)
    const saisonBox = document.createElement('div');
    saisonBox.style.cssText = 'background:var(--surf2);border-radius:6px;padding:8px;border:1px solid #1c2535';
    const saisonHdr = document.createElement('div');
    saisonHdr.style.cssText = 'display:flex;align-items:center;gap:6px;margin-bottom:5px';
    const saisonCb = document.createElement('input');
    saisonCb.type = 'checkbox'; saisonCb.checked = !!cfg.saison_active;
    saisonCb.style.cssText = 'accent-color:#f59e0b;width:13px;height:13px';
    saisonCb.addEventListener('change', () => save('saison_active', saisonCb.checked));
    const saisonLbl = document.createElement('span');
    saisonLbl.style.cssText = 'font-size:8px;font-weight:700;color:#94a3b8';
    saisonLbl.textContent = '📅 Saison-Modus (Modul zeitlich begrenzen)';
    saisonHdr.append(saisonCb, saisonLbl);
    const saisonNote = document.createElement('div');
    saisonNote.style.cssText = 'font-size:7.5px;color:#445566;margin-bottom:5px';
    saisonNote.textContent = 'Für Indoor-Anlagen oder ganzjährigen Betrieb: deaktiviert lassen.';
    saisonBox.append(saisonHdr, saisonNote);
    const monthRow = document.createElement('div');
    monthRow.style.cssText = 'display:flex;align-items:center;gap:6px';
    ['saison_from', 'saison_to'].forEach((key, i) => {
      const lbl = document.createElement('span');
      lbl.style.cssText = 'font-size:8px;color:#94a3b8';
      lbl.textContent = i === 0 ? 'Von Monat:' : 'Bis Monat:';
      const sel = document.createElement('select');
      sel.style.cssText = 'padding:2px 4px;border-radius:4px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-size:8px';
      const months = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];
      months.forEach((m,mi) => {
        const o = document.createElement('option'); o.value = mi+1; o.textContent = m;
        if ((parseInt(cfg[key])||1) === mi+1) o.selected = true;
        sel.appendChild(o);
      });
      sel.addEventListener('change', () => save(key, parseInt(sel.value)));
      monthRow.append(lbl, sel);
    });
    saisonBox.appendChild(monthRow);
    wrap.appendChild(saisonBox);

    // Power-Routing
    const routeBox = document.createElement('div');
    routeBox.style.cssText = 'background:var(--surf2);border-radius:6px;padding:8px;border:1px solid #1c2535';
    const routeHdr = document.createElement('div');
    routeHdr.style.cssText = 'display:flex;align-items:center;gap:6px;margin-bottom:5px';
    const routeCb = document.createElement('input');
    routeCb.type = 'checkbox'; routeCb.checked = !!cfg.routing_active;
    routeCb.style.cssText = 'accent-color:#f59e0b;width:13px;height:13px';
    routeCb.addEventListener('change', () => save('routing_active', routeCb.checked));
    const routeLbl = document.createElement('span');
    routeLbl.style.cssText = 'font-size:8px;font-weight:700;color:#94a3b8';
    routeLbl.textContent = '⚡ Power-Routing (Solar-Überschuss verteilen)';
    routeHdr.append(routeCb, routeLbl);
    const routeNote = document.createElement('div');
    routeNote.style.cssText = 'font-size:7.5px;color:#445566;margin-bottom:6px';
    routeNote.textContent = 'Schaltet Verbraucher automatisch bei Überschuss ein/aus.';
    routeBox.append(routeHdr, routeNote);

    DEFAULT_ROUTING.forEach(step => {
      const stepBox = document.createElement('div');
      stepBox.style.cssText = 'border:1px solid #1c2535;border-radius:4px;padding:5px 7px;margin-bottom:4px';
      stepBox.innerHTML = `<div style="font-size:8px;font-weight:700;color:var(--text);margin-bottom:4px">${step.icon} ${step.name}</div>`;
      stepBox.appendChild(mkField('Entity (Switch)',
        `routing_${step.id}_entity`, `switch.${step.id}_switch`));
      // Schwellwert
      const thrRow = document.createElement('div');
      const thrLbl = document.createElement('div');
      thrLbl.style.cssText = 'font-size:7px;color:#445566;margin-bottom:2px;margin-top:3px';
      thrLbl.textContent = `Ab Überschuss (W):`;
      const thrInp = document.createElement('input');
      thrInp.type = 'number'; thrInp.min = 0; thrInp.max = 10000;
      thrInp.value = cfg[`routing_${step.id}_threshold`] ?? step.threshold_w;
      thrInp.style.cssText = 'width:80px;padding:3px 6px;border-radius:4px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-size:8px';
      thrInp.addEventListener('input', () => save(`routing_${step.id}_threshold`, parseInt(thrInp.value)||0));
      // Auto-off Toggle
      const offRow = document.createElement('div');
      offRow.style.cssText = 'display:flex;align-items:center;gap:5px;margin-top:3px';
      const offCb = document.createElement('input');
      offCb.type = 'checkbox'; offCb.checked = !!cfg[`routing_${step.id}_auto_off`];
      offCb.style.cssText = 'accent-color:#f59e0b;width:12px;height:12px';
      offCb.addEventListener('change', () => save(`routing_${step.id}_auto_off`, offCb.checked));
      const offLbl = document.createElement('span');
      offLbl.style.cssText = 'font-size:7.5px;color:#445566';
      offLbl.textContent = 'Automatisch ausschalten wenn kein Überschuss';
      thrRow.append(thrLbl, thrInp);
      offRow.append(offCb, offLbl);
      stepBox.append(thrRow, offRow);
      routeBox.appendChild(stepBox);
    });
    wrap.appendChild(routeBox);

    return wrap;
  },

  // ── Hilfsfunktionen ────────────────────────────────────────────────────────
  _battColor(pct) {
    if (pct == null) return '#445566';
    if (pct >= 80) return '#22c55e';
    if (pct >= 40) return '#f59e0b';
    return '#ef4444';
  },

  _mkBox(title) {
    const box = document.createElement('div');
    box.style.cssText = 'background:var(--surf2);border-radius:6px;padding:8px;border:1px solid #1c2535';
    if (title) {
      const hdr = document.createElement('div');
      hdr.style.cssText = 'font-size:8px;font-weight:700;color:#94a3b8;margin-bottom:6px;letter-spacing:0.5px';
      hdr.textContent = title;
      box.appendChild(hdr);
    }
    return box;
  },

  _mkSparkline(values, color, w=180, h=32) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    svg.style.cssText = `width:100%;height:${h}px;display:block;margin-top:4px`;
    const max = Math.max(...values, 1);
    const min = Math.min(...values, 0);
    const range = max - min || 1;
    const pts = values.map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = h - ((v - min) / range) * (h - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
    const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    poly.setAttribute('points', pts);
    poly.setAttribute('fill', 'none');
    poly.setAttribute('stroke', color);
    poly.setAttribute('stroke-width', '1.5');
    poly.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(poly);
    return svg;
  },
};

// Modul beim Registry anmelden
if (typeof BLEModuleRegistry !== 'undefined') {
  BLEModuleRegistry.register(EnergieModul);
} else {
  // Fallback: globale Variable für direkten Zugriff
  window._BLE_MODULE_ENERGIE = EnergieModul;
}
