// ═══════════════════════════════════════════════════════════════════════════
// BLE Positioning – Modul: POOL
// Version: 1.0.0
// Datei: /config/www/ble_positioning/modules/pool.js
// Wird lazy per fetch() geladen – kein HA-Neustart bei Updates nötig
// ═══════════════════════════════════════════════════════════════════════════

const PoolModul = {
  id: "pool", name: "Pool & Garten", icon: "🏊", tabId: "pool",
  version: "1.0.0", description: "Pumpen, Bewässerung, Smart Irrigation",
  _card: null,
  init(card)    { this._card = card; },
  destroy()     { this._card = null; },
  isActive(card) {
    const cfg = card?._opts?.pool_cfg || {};
    if (!cfg.saison_active) return true;
    const mm = new Date().getMonth() + 1;
    const from = parseInt(cfg.saison_from || 4);
    const to   = parseInt(cfg.saison_to   || 10);
    return from <= to ? mm >= from && mm <= to : mm >= from || mm <= to;
  },
  buildSidebar(card) {
    const w = document.createElement("div");
    w.style.cssText = "padding:8px;display:flex;flex-direction:column;gap:8px";
    const hdr = document.createElement("div");
    hdr.style.cssText = "font-size:10px;font-weight:700;color:#22c55e;letter-spacing:1px";
    hdr.textContent = "🏊 POOL & GARTEN";
    w.appendChild(hdr);
    if (!this.isActive(card)) {
      const note = document.createElement("div");
      note.style.cssText = "padding:10px;background:var(--surf2);border-radius:6px;font-size:8px;color:#445566;text-align:center";
      const cfg = card?._opts?.pool_cfg || {};
      note.textContent = `Saison-Modus: Modul pausiert (${cfg.saison_from||4}.–${cfg.saison_to||10}. Monat)`;
      w.appendChild(note); return w;
    }
    const cfg = card?._opts?.pool_cfg || {};
    const hass = card?._hass;
    // Pool-Pumpe
    if (cfg.pool_pump) {
      const pumpState = hass?.states[cfg.pool_pump]?.state;
      const pumpOn = pumpState === "on";
      const pumpBox = document.createElement("div");
      pumpBox.style.cssText = `padding:8px;background:${pumpOn?"#22c55e18":"var(--surf2)"};border-radius:6px;border:1px solid ${pumpOn?"#22c55e44":"#1c2535"};display:flex;align-items:center;gap:8px`;
      pumpBox.innerHTML = `<span style="font-size:20px">🏊</span>
        <div style="flex:1"><div style="font-size:9px;font-weight:700;color:var(--text)">Pool-Pumpe</div>
        <div style="font-size:7.5px;color:#445566">${cfg.pool_pump}</div></div>
        <span style="font-size:11px;font-weight:700;color:${pumpOn?"#22c55e":"#445566"}">${pumpOn?"● AN":"○ AUS"}</span>`;
      const btn = document.createElement("button");
      btn.style.cssText = `padding:4px 10px;border-radius:4px;border:1px solid ${pumpOn?"#ef4444":"#22c55e"};background:transparent;color:${pumpOn?"#ef4444":"#22c55e"};font-size:8px;cursor:pointer`;
      btn.textContent = pumpOn ? "AUS" : "AN";
      btn.addEventListener("click", () => hass?.callService("switch", pumpOn?"turn_off":"turn_on", {entity_id: cfg.pool_pump}).catch(()=>{}));
      pumpBox.appendChild(btn);
      w.appendChild(pumpBox);
    }
    // Smart Irrigation
    const siEntities = Object.keys(hass?.states||{}).filter(id => id.startsWith("switch.") && id.includes("irrigation"));
    if (siEntities.length) {
      const siBox = document.createElement("div");
      siBox.style.cssText = "background:var(--surf2);border-radius:6px;padding:8px;border:1px solid #1c2535";
      const siHdr = document.createElement("div");
      siHdr.style.cssText = "font-size:8px;font-weight:700;color:#22c55e;margin-bottom:6px";
      siHdr.textContent = "🌱 Smart Irrigation";
      siBox.appendChild(siHdr);
      siEntities.slice(0,6).forEach(eid => {
        const state = hass.states[eid];
        const on = state?.state === "on";
        const row = document.createElement("div");
        row.style.cssText = `display:flex;align-items:center;gap:6px;padding:3px 0;border-bottom:1px solid #0d121933`;
        const btn = document.createElement("button");
        btn.style.cssText = `padding:2px 7px;border-radius:3px;border:1px solid ${on?"#ef4444":"#22c55e"};background:transparent;color:${on?"#ef4444":"#22c55e"};font-size:7.5px;cursor:pointer;flex-shrink:0`;
        btn.textContent = on ? "Stop" : "Start";
        btn.addEventListener("click", () => hass.callService("switch", on?"turn_off":"turn_on", {entity_id: eid}).catch(()=>{}));
        row.innerHTML = `<span style="font-size:10px">💧</span><span style="flex:1;font-size:7.5px;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${state?.attributes?.friendly_name || eid.split(".")[1]}</span><span style="font-size:7.5px;font-weight:700;color:${on?"#22c55e":"#445566"}">${on?"●":"○"}</span>`;
        row.appendChild(btn);
        siBox.appendChild(row);
      });
      w.appendChild(siBox);
    } else if (!cfg.pool_pump) {
      const empty = document.createElement("div");
      empty.style.cssText = "padding:12px;background:var(--surf2);border-radius:6px;font-size:8px;color:#445566;text-align:center";
      empty.innerHTML = "Keine Pumpen oder Smart Irrigation Entities gefunden.<br><b style='color:#94a3b8'>Konfigurieren unter ⚙ OPT → Module → Pool & Garten</b>";
      w.appendChild(empty);
    }
    return w;
  },
  buildConfig(card) {
    const w = document.createElement("div");
    w.style.cssText = "display:flex;flex-direction:column;gap:6px";
    const cfg = card?._opts?.pool_cfg || {};
    const save = (key, val) => { if(!card._opts)card._opts={}; if(!card._opts.pool_cfg)card._opts.pool_cfg={}; card._opts.pool_cfg[key]=val; card._saveOptions(); };
    const mkF = (label, key, ph) => {
      const row = document.createElement("div");
      const lbl = document.createElement("div"); lbl.style.cssText="font-size:7px;color:#445566;margin-bottom:2px"; lbl.textContent=label;
      const inp = document.createElement("input"); inp.type="text"; inp.value=cfg[key]||""; inp.placeholder=ph;
      inp.style.cssText="width:100%;padding:3px 6px;border-radius:4px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-size:8px";
      inp.addEventListener("input", ()=>save(key, inp.value.trim()));
      row.append(lbl,inp); return row;
    };
    const fieldsBox = document.createElement("div");
    fieldsBox.style.cssText = "background:var(--surf2);border-radius:6px;padding:8px;border:1px solid #1c2535";
    const fHdr = document.createElement("div"); fHdr.style.cssText="font-size:8px;font-weight:700;color:#94a3b8;margin-bottom:6px"; fHdr.textContent="Entities:";
    fieldsBox.appendChild(fHdr);
    [["Pool-Pumpe","pool_pump","switch.pool_pumpe"],["Brunnen-Pumpe","well_pump","switch.brunnen_pumpe"],
     ["Pool-Heizung","pool_heat","switch.pool_heizung"],["Filterlaufzeit Sensor","filter_time","sensor.pool_filter_h"]
    ].forEach(([l,k,p])=>fieldsBox.appendChild(mkF(l,k,p)));
    w.appendChild(fieldsBox);
    // Saison-Modus
    const sBox = document.createElement("div");
    sBox.style.cssText = "background:var(--surf2);border-radius:6px;padding:8px;border:1px solid #1c2535;margin-top:4px";
    const sCb = document.createElement("input"); sCb.type="checkbox"; sCb.checked=!!cfg.saison_active; sCb.style.cssText="accent-color:#22c55e;width:13px;height:13px";
    sCb.addEventListener("change",()=>save("saison_active",sCb.checked));
    const sRow = document.createElement("div"); sRow.style.cssText="display:flex;align-items:center;gap:6px;margin-bottom:4px";
    const sLbl = document.createElement("span"); sLbl.style.cssText="font-size:8px;font-weight:700;color:#94a3b8";
    sLbl.textContent="📅 Saison-Modus"; sRow.append(sCb,sLbl); sBox.appendChild(sRow);
    const sNote = document.createElement("div"); sNote.style.cssText="font-size:7.5px;color:#445566;margin-bottom:5px";
    sNote.textContent="Für Indoor-Pools: deaktiviert lassen."; sBox.appendChild(sNote);
    const mRow = document.createElement("div"); mRow.style.cssText="display:flex;align-items:center;gap:6px";
    ["saison_from","saison_to"].forEach((key,i)=>{
      const l=document.createElement("span"); l.style.cssText="font-size:8px;color:#94a3b8"; l.textContent=i===0?"Von:":"Bis:";
      const sel=document.createElement("select"); sel.style.cssText="padding:2px 4px;border-radius:4px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-size:8px";
      ["Jan","Feb","Mär","Apr","Mai","Jun","Jul","Aug","Sep","Okt","Nov","Dez"].forEach((m,mi)=>{
        const o=document.createElement("option"); o.value=mi+1; o.textContent=m;
        if((parseInt(cfg[key])||(i===0?4:10))===mi+1)o.selected=true; sel.appendChild(o);
      });
      sel.addEventListener("change",()=>save(key,parseInt(sel.value)));
      mRow.append(l,sel);
    });
    sBox.appendChild(mRow); w.appendChild(sBox);
    return w;
  },
  onPoll(data, card) {
    // Solar-Überschuss → Pool-Pumpe automatisch (wenn aktiviert)
    const cfg = card?._opts?.pool_cfg || {};
    if (!cfg.solar_auto || !cfg.pool_pump) return;
    const hass = card?._hass;
    if (!hass) return;
    const energyCfg = card?._opts?.energie_cfg || {};
    const solarW = parseFloat(hass.states[energyCfg.solar_power]?.state) || 0;
    const loadW  = parseFloat(hass.states[energyCfg.load_power]?.state)  || 0;
    const surplus = solarW - loadW;
    const threshold = parseInt(cfg.solar_threshold || 300);
    const pumpState = hass.states[cfg.pool_pump]?.state;
    if (surplus >= threshold && pumpState === "off") {
      hass.callService("switch","turn_on",{entity_id:cfg.pool_pump}).catch(()=>{});
    } else if (surplus < threshold * 0.7 && pumpState === "on" && cfg.solar_auto_off) {
      hass.callService("switch","turn_off",{entity_id:cfg.pool_pump}).catch(()=>{});
    }
  },
};

// Modul beim Registry anmelden
if (typeof BLEModuleRegistry !== 'undefined') {
  BLEModuleRegistry.register(PoolModul);
} else {
  // Fallback: globale Variable für direkten Zugriff
  window._BLE_MODULE_POOL = PoolModul;
}
