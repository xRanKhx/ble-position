// ═══════════════════════════════════════════════════════════════════════════
// BLE Positioning – Modul: MMWAVE
// Version: 1.0.0
// Datei: /config/www/ble_positioning/modules/mmwave.js
// Wird lazy per fetch() geladen – kein HA-Neustart bei Updates nötig
// ═══════════════════════════════════════════════════════════════════════════

const MmwaveModul = {
  ...BLEModuleBase,
  id:          "mmwave",
  name:        "mmWave",
  icon:        "📡",
  tabId:       "mmwave",
  version:     "1.0.0",
  description: "Personen-Tracking · Klassifikation · Sturzerkennung · Fusion",

  // ── State ─────────────────────────────────────────────────────────────────
  _mmwaveProfiles:    null,
  _mmwaveFallState:   null,
  _mmwaveCalibPoints: null,
  _mmwavePlacing:     null,

  // ── Pflicht für base.js Simulation ────────────────────────────────────────
  _getValsForSim(card) {
    return {};
  },

  // ── Tab zeichnen (delegiert an Card-Canvas via draw-Hook) ─────────────────
  draw(ctx, card) {
    // mmWave zeichnet über _drawMmwaveOverlay (wird von Card aufgerufen)
  },

  // ── Sidebar ───────────────────────────────────────────────────────────────
  renderSidebar(card) {
    return this._sidebarMmwave.call(card);
  },

  isActive(card) {
    const sensors = card?._data?.mmwave_sensors || [];
    return sensors.some(s => s.entity_prefix);
  },

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
      // Sichtbarkeits-Toggle
      const visBtn = document.createElement("button");
      visBtn.style.cssText = `padding:2px 5px;border:1px solid ${s.hidden?"#f59e0b44":"#1c253588"};border-radius:3px;background:${s.hidden?"#f59e0b22":"transparent"};color:${s.hidden?"#f59e0b":"#445566"};font-size:9px;cursor:pointer`;
      visBtn.title = s.hidden ? "Sensor einblenden" : "Sensor ausblenden";
      visBtn.textContent = s.hidden ? "👁" : "👁";
      visBtn.style.opacity = s.hidden ? "0.4" : "1";
      visBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        s.hidden = !s.hidden;
        this._rebuildSidebar();
        this._draw();
      });
      crow.append(dot, nameLbl, prefLbl, cntBadge, visBtn, chevron, delBtn);
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
    saveBtn.textContent = sensors.length
      ? `💾 Speichern (${sensors.length} Sensor${sensors.length!==1?"en":""})`
      : "💾 Alle Sensoren löschen";
    saveBtn.disabled = false; // Auch 0 Sensoren darf gespeichert werden
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
  },

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
  },

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

      // Entity-Status live (in eigenem div-Container, nicht direkt in b)
      const statusDiv = document.createElement("div");
      b.appendChild(statusDiv);
      this._updateMmwaveEntityStatus(statusDiv, s);

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

      // ── Sensor-Fusion (nur relevant wenn ≥2 Sensoren konfiguriert) ──────
      const numSensors=(this._pendingMmwave||this._data?.mmwave_sensors||[]).length;
      if(numSensors>=2){
        const fusRow=document.createElement("div");
        fusRow.style.cssText="display:flex;align-items:center;gap:6px;margin-top:5px;padding:4px 0;border-top:1px solid #1c2535";
        const fusLbl=document.createElement("span");
        fusLbl.style.cssText="font-size:8px;color:#94a3b8;flex:1";
        fusLbl.textContent="🔀 Sensor-Fusion (2+ Sensoren)";
        const fusCb=document.createElement("input");
        fusCb.type="checkbox";
        fusCb.checked=!!this._opts?.mmw_fusion;
        fusCb.style.cssText="accent-color:#a78bfa;width:14px;height:14px;cursor:pointer";
        fusCb.title="Wenn eine Person von 2 Sensoren erfasst wird: gewichteter Durchschnitt statt Doppeldarstellung";
        fusCb.addEventListener("change",()=>{
          if(!this._opts)this._opts={};
          this._opts.mmw_fusion=fusCb.checked;
          this._saveOptions();
          this._showToast(fusCb.checked?"🔀 Sensor-Fusion aktiv":"Sensor-Fusion deaktiviert");
        });
        fusRow.append(fusLbl,fusCb);
        b.appendChild(fusRow);
      }

      // ── Dämpfungs-Schieberegler ──────────────────────────────────────────
      const dampRow=document.createElement("div");
      dampRow.style.cssText="display:flex;align-items:center;gap:4px;margin-top:5px;padding:4px 0;border-top:1px solid #1c2535";
      const dampLbl=document.createElement("span");
      dampLbl.style.cssText="font-size:8px;color:#94a3b8;min-width:60px";
      dampLbl.textContent="\uD83C\uDF9A Dämpfung";
      const dampSlider=document.createElement("input");
      dampSlider.type="range"; dampSlider.min=1; dampSlider.max=10; dampSlider.step=1;
      dampSlider.value=s.damping??5;
      dampSlider.style.cssText="flex:1;accent-color:#00e5ff;height:14px";
      const dampVal=document.createElement("span");
      dampVal.style.cssText="font-size:8px;color:#00e5ff;min-width:28px;text-align:right;font-weight:700";
      const dampDesc=document.createElement("span");
      dampDesc.style.cssText="font-size:7px;color:#445566;min-width:50px;text-align:right";
      const updateDamp=()=>{
        const v=parseInt(dampSlider.value);
        dampVal.textContent=v+"/10";
        dampDesc.textContent=v<=2?"reaktiv":v<=4?"leicht":v<=6?"mittel":v<=8?"weich":"sehr weich";
        s.damping=v;
        if(this._mmwaveKalman){
          Object.keys(this._mmwaveKalman).forEach(k=>{if(k.startsWith(s.id))delete this._mmwaveKalman[k];});
        }
        this._draw();
      };
      updateDamp();
      dampSlider.addEventListener("input",updateDamp);
      dampRow.append(dampLbl,dampSlider,dampVal,dampDesc);
      b.appendChild(dampRow);

      // ── Positions-Hysterese (Dead-Zone) ─────────────────────────────────
      const dzRow=document.createElement("div");
      dzRow.style.cssText="display:flex;align-items:center;gap:4px;margin-top:4px";
      const dzLbl=document.createElement("span");
      dzLbl.style.cssText="font-size:8px;color:#94a3b8;min-width:60px";
      dzLbl.textContent="\uD83D\uDCCD Dead-Zone";
      const dzSlider=document.createElement("input");
      dzSlider.type="range"; dzSlider.min=0; dzSlider.max=400; dzSlider.step=20;
      dzSlider.value=s.dead_zone??80;
      dzSlider.style.cssText="flex:1;accent-color:#f59e0b;height:14px";
      const dzVal=document.createElement("span");
      dzVal.style.cssText="font-size:8px;color:#f59e0b;min-width:36px;text-align:right;font-weight:700";
      const updateDZ=()=>{
        const v=parseInt(dzSlider.value);
        dzVal.textContent=v+"mm";
        s.dead_zone=v;
        if(this._mmwaveKalman){
          Object.keys(this._mmwaveKalman).forEach(k=>{if(k.startsWith(s.id))delete this._mmwaveKalman[k];});
        }
        this._draw();
      };
      updateDZ();
      dzSlider.addEventListener("input",updateDZ);
      dzRow.append(dzLbl,dzSlider,dzVal);
      b.appendChild(dzRow);

      // ── Haltungsschwellen ─────────────────────────────────────────────────
      const ptLbl=document.createElement("div");
      ptLbl.style.cssText="font-size:8px;color:#94a3b8;margin-top:5px;padding-top:4px;border-top:1px solid #1c2535";
      ptLbl.textContent="\uD83E\uDDD8 Haltungsschwellen (mm Höhe)";
      b.appendChild(ptLbl);
      [["Stehen ab","stand_min",1500,300,2200],["Sitzen ab","sit_min",900,200,1500],["Liegen ab","fall_height",600,100,1000],["Hysterese","±hysteresis",60,0,200]].forEach(([lbl,key,def,mn,mx2])=>{
        const row=document.createElement("div"); row.style.cssText="display:flex;align-items:center;gap:3px;margin-top:2px";
        const l2=document.createElement("span"); l2.style.cssText="font-size:7.5px;color:#445566;min-width:65px"; l2.textContent=lbl;
        const realKey=key.replace("±","");
        const curVal=(s.posture_thresholds?.[realKey])??def;
        const i2=inp("number",curVal,mn,mx2,10,v=>{if(!s.posture_thresholds)s.posture_thresholds={};s.posture_thresholds[realKey]=parseInt(v)||def;},52);
        const u2=document.createElement("span"); u2.style.cssText="font-size:7.5px;color:#445566"; u2.textContent=key.startsWith("±")?"\u00b1mm":"mm";
        row.append(l2,i2,u2); b.appendChild(row);
      });

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

      // Sensor platzieren Button – nutzt _mmwavePlacing (korrekt!)
      const isPlacingNow = this._mmwavePlacing === idx;
      const placeBtn=document.createElement("button"); placeBtn.className="btn btn-outline";
      placeBtn.style.cssText=`width:100%;font-size:8px;padding:3px;margin-top:2px;${isPlacingNow?"color:#00e5ff;border-color:#00e5ff44":""}`;
      placeBtn.textContent = isPlacingNow ? "📍 Klicke auf Karte…" : (s.mx!=null ? "📍 Neu platzieren" : "📍 Auf Karte platzieren");
      placeBtn.addEventListener("click",()=>{
        this._mmwavePlacing = isPlacingNow ? null : idx;
        this._showToast(isPlacingNow ? "Platzierung abgebrochen" : "Klicke auf die Sensor-Position auf der Karte");
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
        await this._loadData(); this._rebuildSidebar();
        this._showToast("✅ Sensor gespeichert");
      }catch(e){this._showToast("Fehler: "+e.message);}
    });
    body.appendChild(saveBtn);
  },

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
  },

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

      // Rauschparameter: aus Kalibrierungs-Profil + Dämpfungs-Schieberegler
      const kalProf = sensor.kalman_profiles?.[targetNum-1];
      // Dämpfung: 1=reaktiv (R_still=5000), 10=sehr weich (R_still=2000000)
      const dampLevel = Math.max(1, Math.min(10, sensor.damping ?? 5));
      const R_still_base = 5000 * Math.pow(dampLevel, 2.2);
      const R_still_cal = kalProf?.R_still || R_still_base;
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

      // Dead-Zone: Wenn still und Änderung < threshold → einfrieren
      // Konfigurierbar via sensor.dead_zone (Schieberegler, default 80mm)
      const deadZone = isStill ? (sensor.dead_zone ?? 80) : 0;
      if (Math.abs(x_raw - ks.x) < deadZone) ks.x = ks.x;
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
  },

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
  },

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
  },

  _drawMmwaveOverlay() {
    const ctx     = this._ctx;
    // Fallback: _pendingMmwave kann leer sein ([] ist truthy!) → explizit prüfen
    const sensors = (this._pendingMmwave?.length > 0 ? this._pendingMmwave : this._data?.mmwave_sensors) || [];
    if (!sensors.length) return;
    const t = Date.now() / 1000;

    sensors.forEach(sensor => {
      if (sensor.hidden) return;  // ausgeblendet
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
          const { scale: _mmScale } = this._floorScale();
          const zoom = this._zoom || 1;
          const rangePx = rangeM * _mmScale * zoom;

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

      // ── 3. Place-mode: Crosshair unter der Maus ─────────────────────────
      const _sIdx = (this._pendingMmwave||[]).indexOf(sensor);
      if (this._mmwavePlacing === _sIdx) {
        const mp = this._mouseFloor;
        if (mp) {
          const mc = this._f2c(mp.mx, mp.my);
          ctx.save();
          ctx.strokeStyle="#f59e0b"; ctx.lineWidth=1.5; ctx.setLineDash([4,3]);
          ctx.beginPath();
          ctx.moveTo(mc.x-12,mc.y); ctx.lineTo(mc.x+12,mc.y);
          ctx.moveTo(mc.x,mc.y-12); ctx.lineTo(mc.x,mc.y+12);
          ctx.stroke();
          ctx.beginPath(); ctx.arc(mc.x,mc.y,6,0,Math.PI*2); ctx.stroke();
          ctx.setLineDash([]);
          ctx.font="bold 8px 'JetBrains Mono',monospace";
          ctx.fillStyle="#f59e0b"; ctx.textAlign="center"; ctx.textBaseline="top";
          ctx.fillText(mp.mx.toFixed(1)+"m / "+mp.my.toFixed(1)+"m", mc.x, mc.y+9);
          ctx.textAlign="left"; ctx.restore();
        }
        if (sensor.mx != null) {
          const sp = this._f2c(sensor.mx, sensor.my);
          ctx.save(); ctx.strokeStyle="#ef444466"; ctx.lineWidth=1; ctx.setLineDash([2,2]);
          ctx.beginPath(); ctx.arc(sp.x,sp.y,10,0,Math.PI*2); ctx.stroke();
          ctx.setLineDash([]); ctx.restore();
        }
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
          const { scale: _mmScale2 } = this._floorScale();
          const zoom2 = this._zoom||1;
          const speedScale = Math.min(Math.abs(target.speed)*0.8, 2.5);
          const vLen = speedScale * _mmScale2 * zoom2 * 0.18;
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
  },

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
  },

  _getPresenceState() {
    const devices = this._data?.devices || [];
    if (!devices.length) return "unknown";
    let hasTracking = false;
    for (const dev of devices) {
      const type = dev.device_type || "phone";
      if (type === "stationary") continue; // iPad etc. ignorieren
      hasTracking = true;
      // Prüfe ob Gerät sichtbar (x/y vorhanden = in Reichweite)
      if (dev.x != null && dev.y != null) return "home";
    }
    // mmWave sieht jemanden? → auch "home"
    const mmwPersons = (this._data?.mmwave_persons || []);
    if (mmwPersons.length > 0) return "home";
    return hasTracking ? "away" : "unknown";
  },

  _mmwaveClasses() {
    return {
      adult:  { label:"Erwachsener", icon:"🧑",  color:"#00e5ff", priority:3 },
      child:  { label:"Kind",        icon:"🧒",  color:"#f59e0b", priority:2 },
      pet:    { label:"Haustier",    icon:"🐾",  color:"#10b981", priority:1 },
      baby:   { label:"Baby",        icon:"🍼",  color:"#f472b6", priority:0 },
      unknown:{ label:"Unbekannt",   icon:"❓",  color:"#94a3b8", priority:-1 },
    };
  },

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
  },

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
  },

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
  },

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
  },

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
  },

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
  },

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
  },

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
  },

  _mmwaveResetProfile(sensorId, targetId) {
    const key = sensorId + "_" + targetId;
    if (this._mmwaveProfiles) delete this._mmwaveProfiles[key];
    this._showToast("🗑 Profil zurückgesetzt");
    this._rebuildSidebar();
  },

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
        const posture = target?._posture || "standing";
        // Sturz: rotes Blink-Symbol
        if (posture === "fallen") {
          ctx.save();
          ctx.strokeStyle = `rgba(239,68,68,${0.7+Math.sin(Date.now()/200)*0.3})`;
          ctx.lineWidth = 3 * scale;
          const r = 12 * scale;
          ctx.beginPath(); ctx.moveTo(tc.x-r,tc.y-r); ctx.lineTo(tc.x+r,tc.y+r); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(tc.x+r,tc.y-r); ctx.lineTo(tc.x-r,tc.y+r); ctx.stroke();
          ctx.font = `bold ${10*scale}px monospace`;
          ctx.fillStyle = "#ef4444"; ctx.textAlign="center"; ctx.textBaseline="bottom";
          ctx.fillText("⚠ STURZ", tc.x, tc.y - r - 3);
          ctx.textAlign="left"; ctx.restore();
          break;
        }
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
  },

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
      const T = {
        stand_min:   th.stand_min   ?? 1500,
        sit_min:     th.sit_min     ?? 900,
        fall_height: th.fall_height ?? 600,  // Sturz: unter diesem Wert = am Boden
        hysteresis:  th.hysteresis  ?? 60,
      };
      const personHeight_mm = Math.max(0, mountH - y_mm);

      // ── Liegen zuerst prüfen: niedrige Höhe + niedrige Speed + großer x-Spread ──
      // Liegend: Person nimmt mehr horizontale Fläche ein → |x_mm| größer
      const xSpread = Math.abs(x_mm);
      // Sturz / Boden: unter fall_height → fallen
      if (personHeight_mm < T.fall_height && speed < 0.3) return "fallen";

      const isLyingCandidate = personHeight_mm < (T.sit_min - T.hysteresis) &&
                               speed < 0.12;
      const lyingConfirmed = isLyingCandidate && (xSpread > 250 || personHeight_mm < (T.fall_height + 300));

      // Hysterese: vorherige Haltung aus letztem Frame einbeziehen
      const prevPosture = target._posture || "standing";
      const hysteresis = T.hysteresis;

      if (lyingConfirmed) return "lying";

      // Stehend: Höhe ≥ stand_min (+ Hysterese-Puffer wenn vorher nicht stehend)
      const standThresh = prevPosture === "standing"
        ? T.stand_min - hysteresis   // War stehend → mehr Toleranz
        : T.stand_min + hysteresis;  // War sitzend/liegend → braucht klar mehr Höhe

      if (personHeight_mm >= standThresh) return "standing";

      // Sitzend: Höhe ≥ sit_min mit Hysterese
      const sitThresh = prevPosture === "sitting"
        ? T.sit_min - hysteresis
        : T.sit_min + hysteresis;

      if (personHeight_mm >= sitThresh) return "sitting";

      // Fallback: vorherige Haltung beibehalten wenn im Hysterese-Band
      return prevPosture === "lying" ? "lying" : "sitting";
    }

    // ── Wandmontage MIT Neigungswinkel (≥ 15°): Höhe berechenbar ────────
    const tiltDeg  = sensor.mount_tilt_deg || 0;
    const tiltRad  = Math.abs(tiltDeg) * Math.PI / 180;
    if (Math.abs(tiltDeg) >= 15) {
      const T = { stand_min: th.stand_min ?? 1500, sit_min: th.sit_min ?? 900,
                   fall_height: th.fall_height ?? 600, hysteresis: th.hysteresis ?? 60 };
      const sinF = Math.sin(tiltRad);
      const personHeight_mm = Math.max(0, mountH - y_mm * sinF);
      const prevP = target._posture || "standing";
      const xSpreadT = Math.abs(x_mm);
      if (personHeight_mm < T.fall_height && speed < 0.3) return "fallen";
      if (speed < 0.12 && personHeight_mm < (T.sit_min - T.hysteresis) &&
          (xSpreadT > 250 || personHeight_mm < (T.fall_height + 300))) return "lying";
      const standT = prevP==="standing" ? T.stand_min-T.hysteresis : T.stand_min+T.hysteresis;
      const sitT   = prevP==="sitting"  ? T.sit_min-T.hysteresis   : T.sit_min+T.hysteresis;
      if (personHeight_mm >= standT) return "standing";
      if (personHeight_mm >= sitT)   return "sitting";
      return prevP==="lying" ? "lying" : "sitting";
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
  },

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
  },

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
  },

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
  },

  _postureIcon(posture) {
    return { standing:"🧍", sitting:"🪑", lying:"🛏", unknown:"" }[posture] || "";
  },

  _postureLabel(posture) {
    return { standing:"Stehend", sitting:"Sitzend", lying:"Liegend", unknown:"" }[posture] || "";
  },

  _postureColor(posture) {
    return { standing:"#22c55e", sitting:"#f59e0b", lying:"#94a3b8", unknown:"transparent" }[posture];
  },

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
  },

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
      else if (wiz.step >= 3 && wiz.step <= 6) this._wizStepPose(content, sensor, wiz, render);
      else if (wiz.step === 7)             this._wizStepDone(content, sensor, wiz, render);
    };
    render();
    body.appendChild(panel);
  },

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
    // Körpergröße-Eingabe
    const hRow=document.createElement("div");
    hRow.style.cssText="display:flex;align-items:center;gap:6px;margin-bottom:8px;padding:6px;background:#0a1628;border-radius:6px;border:1px solid #00e5ff22";
    const hLbl=document.createElement("span"); hLbl.style.cssText="font-size:8px;color:#94a3b8;white-space:nowrap"; hLbl.textContent="📏 Körpergröße:";
    const hInp=document.createElement("input"); hInp.type="number"; hInp.min=120; hInp.max=220; hInp.step=1;
    hInp.value=sensor._wizard_height||170;
    hInp.style.cssText="width:55px;padding:2px 5px;border-radius:4px;border:1px solid #00e5ff44;background:#0d1219;color:#c8d8ec;font-size:9px;text-align:center";
    const hUnit=document.createElement("span"); hUnit.style.cssText="font-size:8px;color:#445566"; hUnit.textContent="cm";
    const hHint=document.createElement("span"); hHint.style.cssText="font-size:7px;color:#445566;flex:1;text-align:right"; hHint.textContent="wird für Schwellwerte genutzt";
    hInp.addEventListener("input",()=>{ sensor._wizard_height=parseInt(hInp.value)||170; });
    hRow.append(hLbl,hInp,hUnit,hHint); el.appendChild(hRow);

    const btn = document.createElement("button");
    btn.className = "btn btn-outline";
    btn.style.cssText = "width:100%;font-size:9px;padding:5px";
    btn.textContent = "🎯 Neue Kalibrierung starten";
    btn.onclick = () => { wiz.step=1; wiz.samples={standing:[],sitting:[],lying:[],floor:[]}; wiz.customName=null; render(); };
    el.appendChild(btn);
  },

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
  },

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
  },

  _wizStepPose(el, sensor, wiz, render) {
    const mountH = (sensor.mount_height_m||2.5)*1000;
    const bodyH  = (sensor._wizard_height||170)*10; // cm→mm
    const POSES = [
      {step:3,key:"standing",icon:"🧍",label:"STEHEND", desc:"Steh aufrecht vor dem Sensor – 5 Sek. stillhalten.",color:"#22c55e"},
      {step:4,key:"sitting", icon:"🪑",label:"SITZEND",  desc:"Sitz (Stuhl/Sofa) – 5 Sek. stillhalten.",            color:"#f59e0b"},
      {step:5,key:"lying",   icon:"🛌",label:"LIEGEND",  desc:"Leg dich hin – 5 Sek. Kann übersprungen werden.",
       color:"#a78bfa"},
      {step:6,key:"floor",   icon:"🧎",label:"BODEN/STURZ", desc:"Leg dich auf den Boden (Sturz-Erkennung). Optional.",
       color:"#ef4444"},
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
    skip.onclick=()=>{clearInterval(wiz._liveTimer);wiz._liveTimer=null;wiz.step=wiz.step>=6?7:wiz.step+1;render();};
    const next=document.createElement("button"); next.className="btn";
    next.style.cssText=`flex:2;font-size:9px;padding:4px;background:${pose.color}22;border-color:${pose.color};color:${pose.color}`;
    next.textContent=collected>0?(wiz.step<6?"Weiter →":"✓ Fertig"):"Erst aufzeichnen!";
    next.disabled=wiz.collecting||collected===0;
    next.onclick=()=>{clearInterval(wiz._liveTimer);wiz._liveTimer=null;wiz.step=wiz.step>=6?7:wiz.step+1;render();};
    nav.append(back,skip,next); el.appendChild(nav);
  },

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
    const st=stat(s.standing), si=stat(s.sitting), ly=stat(s.lying), fl=stat(s.floor);
    const name=wiz.customName||(sensor.target_names||[])[wiz.personIdx]||"Person "+(wiz.personIdx+1);
    const noiseR=st?Math.round(((st.sx**2+st.sy**2)/2)*15):200000;
    const res=document.createElement("div");
    res.style.cssText="font-size:8px;color:#94a3b8;line-height:1.8;margin-bottom:8px;padding:5px 8px;background:#0d1219;border-radius:5px";
    const r=(icon,lbl,d)=>d?`${icon} <b style="color:#c8d8ec">${lbl}</b>: (${d.ax},${d.ay})mm σ=(${d.sx},${d.sy})mm n=${d.n}<br>`
      :`${icon} <span style="color:#445566">${lbl}: nicht gemessen</span><br>`;
    res.innerHTML=`<b style="color:#00e5ff">👤 ${name}</b> – ${sensor._wizard_height||170}cm – Distanz: ${wiz.measuredDist||"?"}mm<br>`
      +r("🧍","Stehend",st)+r("🪑","Sitzend",si)+r("🛌","Liegend",ly)+r("🧎","Boden",fl);
    el.appendChild(res);
    // Vorschau der berechneten Schwellwerte
    const mountH2=(sensor.mount_height_m||2.5)*1000;
    const bodyH2=(sensor._wizard_height||170)*10;
    const hStP=st?Math.round(mountH2-st.ay):null;
    const hSiP=si?Math.round(mountH2-si.ay):null;
    const hLyP=ly?Math.round(mountH2-ly.ay):null;
    const hFlP=fl?Math.round(mountH2-fl.ay):null;
    const sm_prev = (hStP&&hSiP)?Math.round((hStP+hSiP)/2+(hStP-hSiP)*0.1):Math.round(bodyH2*0.75);
    const si_prev = (hSiP&&hLyP)?Math.round((hSiP+hLyP)/2+(hSiP-hLyP)*0.1):Math.round(bodyH2*0.42);
    const fa_prev = hFlP?Math.round((hFlP+(hLyP||si_prev))/2):Math.round(bodyH2*0.18);
    const preview=document.createElement("div");
    preview.style.cssText="font-size:7.5px;padding:5px 8px;border-radius:4px;border:1px solid #22c55e33;background:#22c55e08;margin-bottom:6px;line-height:1.9";
    preview.innerHTML=`<b style="color:#22c55e">📐 Berechnete Schwellwerte:</b><br>`
      +`🧍 Stehen ab: <b style="color:#c8d8ec">${sm_prev}mm</b> `
      +`🪑 Sitzen ab: <b style="color:#c8d8ec">${si_prev}mm</b> `
      +`⚠ Sturz unter: <b style="color:#ef4444">${fa_prev}mm</b><br>`
      +`<span style="color:#445566">Diese Werte werden beim Speichern automatisch gesetzt.</span>`;
    el.appendChild(preview);
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
      const mountH=(sensor.mount_height_m||2.5)*1000;
      const bodyH=(sensor._wizard_height||170)*10;

      // ── Automatische Schwellwert-Berechnung aus Messdaten ──────────────
      // Nutze gemessene y-Werte (Sensorabstand nach unten bei Deckenmontage)
      // personHeight = mountH - y_mm
      const hStand = st ? Math.round(mountH - st.ay) : null;
      const hSit   = si ? Math.round(mountH - si.ay) : null;
      const hLie   = ly ? Math.round(mountH - ly.ay) : null;
      const hFloor = fl ? Math.round(mountH - fl.ay) : null;

      // Schwellwerte: Mitte zwischen den Höhen, mit Hysterese-Puffer
      let stand_min, sit_min, fall_height, hysteresis=60;
      if(hStand && hSit) {
        // Gemessene Werte: Mitte + 10% Sicherheitsabstand zur Steh-Seite
        stand_min = Math.round((hStand + hSit) / 2 + (hStand - hSit) * 0.1);
      } else {
        // Fallback: proportional zur Körpergröße
        // Stehend ≈ 93% der Körpergröße, Sitzend ≈ 54%
        stand_min = Math.round(bodyH * 0.75); // Mitte Stehen(93%) / Sitzen(54%) = 74%
      }
      if(hSit && hLie) {
        sit_min = Math.round((hSit + hLie) / 2 + (hSit - hLie) * 0.1);
      } else {
        sit_min = Math.round(bodyH * 0.42); // Mitte Sitzen(54%) / Liegen(30%) = 42%
      }
      if(hFloor) {
        fall_height = Math.round((hFloor + (hLie||sit_min)) / 2);
      } else if(hLie) {
        fall_height = Math.round(hLie * 0.6); // 60% der Liegehöhe
      } else {
        fall_height = Math.round(bodyH * 0.18); // ~30cm bei 170cm
      }

      // Hysterese: kleiner als halbe Lücke zwischen Stehen und Sitzen
      if(hStand && hSit) hysteresis = Math.min(80, Math.round((hStand-hSit)*0.15));

      // Schwellwerte in sensor speichern
      sensor.posture_thresholds = {stand_min, sit_min, fall_height, hysteresis};

      sensor.posture_profiles[name]={
        name, dist_mm:wiz.measuredDist,
        body_height_cm: sensor._wizard_height||170,
        noise_x:st?.sx, noise_y:st?.sy, kalman_R_still:noiseR,
        standing_x:st?.ax, standing_y:st?.ay, standing_height:hStand,
        sitting_x:si?.ax,  sitting_y:si?.ay,  sitting_height:hSit,
        lying_x:ly?.ax,    lying_y:ly?.ay,    lying_height:hLie,
        floor_x:fl?.ax,    floor_y:fl?.ay,    floor_height:hFloor,
        threshold_y_stand_sit:(st&&si)?Math.round((st.ay+si.ay)/2):null,
        threshold_y_sit_lie:(si&&ly)?Math.round((si.ay+ly.ay)/2):null,
        computed_stand_min:stand_min, computed_sit_min:sit_min,
        computed_fall_height:fall_height, computed_hysteresis:hysteresis,
        calibrated_at:new Date().toISOString(),
        sensor_id:sensor.id, target_idx:wiz.personIdx,
      };
      if(!sensor.kalman_profiles) sensor.kalman_profiles={};
      sensor.kalman_profiles[wiz.personIdx]={R_still:noiseR};
      this._saveCalibProfiles(sensor);
      this._showToast(`✅ Profil "${name}" gespeichert – Schwellwerte aktualisiert`);
      wiz.step=0; wiz.customName=null; render();
    };
    el.appendChild(save);
    const reset=document.createElement("button");
    reset.className="btn btn-outline"; reset.style.cssText="width:100%;font-size:8px;padding:3px;font-family:inherit";
    reset.textContent="← Neu starten";
    reset.onclick=()=>{wiz.step=0;wiz.samples={standing:[],sitting:[],lying:[],floor:[]};wiz.customName=null;render();};
    el.appendChild(reset);
  },

  _saveCalibProfiles(sensor) {
    const sensors=this._pendingMmwave||this._data?.mmwave_sensors||[];
    const idx=sensors.findIndex(s=>s.id===sensor.id);
    if(idx<0) return;
    sensors[idx]=sensor;
    this._hass?.callApi("POST",`ble_positioning/${this._entryId}/mmwave_sensors`,{sensors})
      .catch(e=>this._showToast("Speichern fehlgeschlagen: "+e.message));
  },

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
          this._rebuildSidebar();
        });
        row.append(icon, info, resetBtn);
      } else {
        row.append(icon, info);
      }
      panel.appendChild(row);
    }

    body.appendChild(panel);
  },

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
  },

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
  },

  _mmwaveStartCalibration(sensor) {
    this._mmwaveCalib = {
      sensorId: sensor.id,
      phase: "center",   // center → left → right → done
      measurements: [],
      startTs: Date.now()
    };
    this._showToast("📐 Kalibrierung: Stell dich in die MITTE des Raums und warte 5 Sek");
    this._rebuildSidebar();
  },

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
  },

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
  },

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
    this._rebuildSidebar();
  },

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
  },

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
        this._rebuildSidebar();
      } catch(e) { this._showToast("❌ Import-Fehler: " + e.message); }
    };
    reader.readAsText(file);
  },

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
  },

  _drawMmwave3D(ctx, project, unitPx, wallH) {
    const sensors = (this._pendingMmwave?.length > 0 ? this._pendingMmwave : this._data?.mmwave_sensors) || [];
    if (!sensors.length) return;
    const t = Date.now() / 1000;

    sensors.forEach(sensor => {
      if (sensor.hidden) return;  // ausgeblendet
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
        const _sH3 = sensor.mount_height_m || 1.5;
        const sc3 = project(sensor.mx, sensor.my, _sH3);  // Kegel-Spitze auf Montagehöhe
        ctx.moveTo(sc3.x, sc3.y);
        for (let i = 0; i <= steps; i++) {
          const a = baseAngle - fovAngle/2 + (fovAngle * i / steps);
          const px3 = sensor.mx + Math.cos(a) * rangeM;
          const py3 = sensor.my + Math.sin(a) * rangeM;
          const pp3 = project(px3, py3, 0);  // Boden-Auftreffpunkt
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

      // ── Sensor-Körper auf korrekter Montagehöhe ─────────────────────────
      const sensorH = sensor.mount_height_m || 1.5;
      const sc3 = project(sensor.mx, sensor.my, sensorH);
      // Verbindungslinie zum Boden
      const scFloor = project(sensor.mx, sensor.my, 0);
      const scol2 = sensor.color || "#ff6b35";
      ctx.save();
      ctx.strokeStyle = scol2 + "44";
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 3]);
      ctx.beginPath(); ctx.moveTo(scFloor.x, scFloor.y); ctx.lineTo(sc3.x, sc3.y); ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
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

        // Schulter-Referenzpunkt je nach Haltung (für Bewegungspfeil)
        const shoulderRefP = posture3d === "lying"
          ? project(fx - 0.35, fy, 0.35)
          : posture3d === "sitting"
            ? project(fx, fy, 0.85)
            : project(fx, fy, 1.05);

        // Bewegungspfeil
        if (target.moving && Math.abs(target.speed) > 0.05) {
          const ang3 = (target.angle || 0) * Math.PI/180 + (sensor.rotation||0)*Math.PI/180 - Math.PI/2;
          const spd3 = Math.min(Math.abs(target.speed) * 0.5, 1.5);
          const ap3  = project(fx + Math.cos(ang3)*spd3, fy + Math.sin(ang3)*spd3, 1.0);
          ctx.strokeStyle = col3d; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(shoulderRefP.x, shoulderRefP.y); ctx.lineTo(ap3.x, ap3.y); ctx.stroke();
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

};
