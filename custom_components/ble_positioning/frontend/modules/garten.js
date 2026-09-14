// ═══════════════════════════════════════════════════════════════════════════
// BLE Positioning – Modul: GARTEN
// Version: 1.0.0
// Mähroboter · Bewässerung · Pflanzen · Gewächshaus · Wetter · Solar
// ═══════════════════════════════════════════════════════════════════════════

const GartenModul = {
  ...(window.BLEModuleBase || {}),
  id:"garten", name:"Garten", icon:"\uD83C\uDF3F", tabId:"garten",
  version:"1.0.0", description:"Mähroboter \u00B7 Bewässerung \u00B7 Pflanzen \u00B7 Gewächshaus",

  // ── State ─────────────────────────────────────────────────────────────────
  _nodes:[], _selNode:null,
  _dragNode:null, _dragOffX:0, _dragOffY:0,
  _resizeNode:null, _resizeStartX:0, _resizeStartY:0, _resizeStartW:0, _resizeStartH:0,
  _editMode:true, _animT:0,
  _sidebarTab:"nodes",
  _autos:[], _selAuto:null, _log:[], _lastAutoRun:{},
  _simVals:{ solarW:600, loadW:200, soilMoist:45, tempC:22, rainMm:0 },

  // ── Node-Typen ────────────────────────────────────────────────────────────
  NODE_TYPES:{
    mower:      {label:"Mähroboter",       icon:"\uD83E\uDE9A", color:"#22c55e", defaultW:56, defaultH:56},
    sprinkler:  {label:"Sprinkler/Zone",   icon:"\uD83D\uDCA7", color:"#38bdf8", defaultW:48, defaultH:48},
    plant:      {label:"Pflanze",          icon:"\uD83C\uDF31", color:"#4ade80", defaultW:48, defaultH:48},
    greenhouse: {label:"Gewächshaus",      icon:"\uD83C\uDFE1", color:"#a3e635", defaultW:80, defaultH:55},
    soil:       {label:"Bodenfeuchte",     icon:"\uD83E\uDEA8", color:"#a16207", defaultW:48, defaultH:48},
    rain:       {label:"Regensensor",      icon:"\uD83C\uDF27", color:"#60a5fa", defaultW:48, defaultH:48},
    temp:       {label:"Temp-Sensor",      icon:"\uD83C\uDF21", color:"#f97316", defaultW:48, defaultH:48},
    valve:      {label:"Ventil",           icon:"\uD83D\uDEB0", color:"#06b6d4", defaultW:44, defaultH:44},
    pump:       {label:"Pumpe",            icon:"\u26A1",       color:"#3b82f6", defaultW:48, defaultH:48},
    light:      {label:"Gartenbeleuchtung",icon:"\uD83D\uDCA1", color:"#fbbf24", defaultW:44, defaultH:44},
    xiaomi:     {label:"Xiaomi Pflanze",   icon:"\uD83C\uDF38", color:"#ec4899", defaultW:48, defaultH:48},
    zone:       {label:"Garten-Zone",      icon:"\u25A1",       color:"#334155", defaultW:90, defaultH:60},
    custom:     {label:"Eigenes Gerät",    icon:"\u2699",       color:"#475569", defaultW:48, defaultH:48},
  },

  // ── Bedingungen & Aktionen ─────────────────────────────────────────────────
  COND:{
    soil_lt:     {label:"Bodenfeuchte < %",  icon:"\uD83E\uDEA8", grp:"\uD83C\uDF3F Garten", params:["threshold"]},
    soil_gt:     {label:"Bodenfeuchte > %",  icon:"\uD83E\uDEA8", grp:"\uD83C\uDF3F Garten", params:["threshold"]},
    temp_gt:     {label:"Temperatur > °C",   icon:"\uD83C\uDF21", grp:"\uD83C\uDF3F Garten", params:["threshold"]},
    temp_lt:     {label:"Temperatur < °C",   icon:"\uD83C\uDF21", grp:"\uD83C\uDF3F Garten", params:["threshold"]},
    rain_gt:     {label:"Regen > mm",        icon:"\uD83C\uDF27", grp:"\uD83C\uDF3F Garten", params:["threshold"]},
    no_rain:     {label:"Kein Regen erwartet",icon:"\u2600",      grp:"\uD83C\uDF3F Garten", params:[]},
    surplus_gt:  {label:"Solar-Überschuss > W",icon:"\u26A1",    grp:"\u26A1 Solar",        params:["threshold"]},
    surplus_lt:  {label:"Solar-Überschuss < W",icon:"\u26A1",    grp:"\u26A1 Solar",        params:["threshold"]},
    entity_on:   {label:"Entity AN",         icon:"\uD83D\uDCA1", grp:"\uD83D\uDCA1 Entity", params:["entity"], domains:["switch","input_boolean","binary_sensor"]},
    entity_off:  {label:"Entity AUS",        icon:"\uD83D\uDCA1", grp:"\uD83D\uDCA1 Entity", params:["entity"], domains:["switch","input_boolean","binary_sensor"]},
    entity_state:{label:"Entity Zustand =",  icon:"\uD83D\uDCCB", grp:"\uD83D\uDCA1 Entity", params:["entity","compare_value"], domains:["sensor","select"]},
    time_between:{label:"Uhrzeit zwischen",  icon:"\uD83D\uDD50", grp:"\uD83D\uDD50 Zeit",   params:["time_from","time_to"]},
    mower_docked:{label:"Mäher in Basis",    icon:"\uD83E\uDE9A", grp:"\uD83E\uDE9A Mäher",  params:[]},
    mower_mowing:{label:"Mäher mäht gerade", icon:"\uD83E\uDE9A", grp:"\uD83E\uDE9A Mäher",  params:[]},
  },

  ACT:{
    switch_on:       {label:"Schalter AN",         icon:"\u2705", params:["entity"], domains:["switch"]},
    switch_off:      {label:"Schalter AUS",         icon:"\u274C", params:["entity"], domains:["switch"]},
    switch_toggle:   {label:"Schalter Toggle",      icon:"\uD83D\uDD04",params:["entity"], domains:["switch"]},
    input_boolean_on: {label:"Input Boolean AN",    icon:"\u2705", params:["entity"], domains:["input_boolean"]},
    input_boolean_off:{label:"Input Boolean AUS",   icon:"\u274C", params:["entity"], domains:["input_boolean"]},
    vacuum_start:    {label:"Mäher starten",        icon:"\uD83E\uDE9A",params:["entity"], domains:["vacuum","lawn_mower"]},
    vacuum_pause:    {label:"Mäher pausieren",      icon:"\u23F8", params:["entity"], domains:["vacuum","lawn_mower"]},
    vacuum_return:   {label:"Mäher zur Basis",      icon:"\uD83C\uDFE0",params:["entity"], domains:["vacuum","lawn_mower"]},
    notify:          {label:"Benachrichtigung",     icon:"\uD83D\uDD14",params:["message"]},
  },

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  init(card){
    this._card=card;
    const opts=card._opts||{};
    this._nodes = opts.garten_nodes || [];
    this._autos = opts.garten_autos || [];
    this._log   = opts.garten_log   || [];
    if(!this._nodes.length) this._createDefaultLayout(card);
  },
  destroy(){ this._card=null; },

  _save(card){
    if(!card._opts) card._opts={};
    card._opts.garten_nodes = this._nodes;
    card._opts.garten_autos = this._autos;
    card._opts.garten_log   = this._log.slice(0,50);
    card._saveOptions?.();
  },

  _createDefaultLayout(card){
    this._nodes=[
      {id:"zone1",   type:"zone",      x:0.35, y:0.45, w:120, h:80,  label:"Garten",       entity:""},
      {id:"mower1",  type:"mower",     x:0.25, y:0.35, w:56,  h:56,  label:"Mähroboter",   entity:""},
      {id:"spr1",    type:"sprinkler", x:0.55, y:0.30, w:48,  h:48,  label:"Sprinkler 1",  entity:""},
      {id:"plant1",  type:"plant",     x:0.70, y:0.55, w:48,  h:48,  label:"Pflanze",      entity:""},
      {id:"soil1",   type:"soil",      x:0.55, y:0.65, w:48,  h:48,  label:"Bodenfeuchte", entity:""},
    ];
  },

  // ── Werte ─────────────────────────────────────────────────────────────────
  _getValsForSim(card){
    if(this._simActive) return {...this._simVals, surplus:this._simVals.solarW-this._simVals.loadW};
    const cfg=card?._opts?.garten_cfg||{};
    const hass=card?._hass;
    const g=k=>{const e=cfg[k];return e&&hass?.states[e]?parseFloat(hass.states[e].state)||0:0;};
    const solarW=g("solar_power"), loadW=g("load_power");
    return{
      soilMoist:g("soil_moisture"),
      tempC:    g("temp_sensor"),
      rainMm:   g("rain_sensor"),
      solarW, loadW,
      surplus:  solarW-loadW,
    };
  },

  // ── _evalCond (Garten-spezifisch + Basis) ─────────────────────────────────
  _evalCond(c, vals, card){
    const v=parseFloat(c.threshold||0);
    const hass=card?._hass;
    switch(c.type){
      case"soil_lt":    return (vals.soilMoist||0)<v;
      case"soil_gt":    return (vals.soilMoist||0)>v;
      case"temp_gt":    return (vals.tempC||0)>v;
      case"temp_lt":    return (vals.tempC||0)<v;
      case"rain_gt":    return (vals.rainMm||0)>v;
      case"no_rain":{
        const cfg=card?._opts?.garten_cfg||{};
        const forecast=hass?.states[cfg.weather_entity]?.attributes?.forecast||[];
        const next12h=forecast.slice(0,12);
        return !next12h.some(f=>(f.precipitation||0)>0.5);
      }
      case"surplus_gt": return (vals.surplus||0)>v;
      case"surplus_lt": return (vals.surplus||0)<v;
      case"mower_docked":{
        const cfg=card?._opts?.garten_cfg||{};
        const st=this._getSimState(cfg.mower_entity,card);
        return st==="docked"||st==="charging";
      }
      case"mower_mowing":{
        const cfg=card?._opts?.garten_cfg||{};
        const st=this._getSimState(cfg.mower_entity,card);
        return st==="mowing"||st==="cleaning";
      }
      default: return this._evalCondBase(c, vals, card);
    }
  },

  // ── _runPoolActions (Garten-spezifisch) ────────────────────────────────────
  _runGartenActions(actions, hass, card){
    const cfg=card?._opts?.garten_cfg||{};
    const res=s=>s?.replace(/\{\{(\w+)\}\}/g,(_,k)=>cfg[k]||s);
    actions.forEach(a=>{
      const eid=res(a.entity); if(!eid&&a.type!=="notify")return;
      switch(a.type){
        case"switch_on":       hass.callService("switch","turn_on",{entity_id:eid}).catch(()=>{}); break;
        case"switch_off":      hass.callService("switch","turn_off",{entity_id:eid}).catch(()=>{}); break;
        case"switch_toggle":   hass.callService("switch","toggle",{entity_id:eid}).catch(()=>{}); break;
        case"input_boolean_on":  hass.callService("input_boolean","turn_on",{entity_id:eid}).catch(()=>{}); break;
        case"input_boolean_off": hass.callService("input_boolean","turn_off",{entity_id:eid}).catch(()=>{}); break;
        case"vacuum_start":    hass.callService("vacuum","start",{entity_id:eid}).catch(()=>{});  break;
        case"vacuum_pause":    hass.callService("vacuum","pause",{entity_id:eid}).catch(()=>{});  break;
        case"vacuum_return":   hass.callService("vacuum","return_to_base",{entity_id:eid}).catch(()=>{}); break;
        case"notify":          hass.callService("notify","notify",{message:a.message||""}).catch(()=>{}); break;
      }
    });
  },

  // ── onPoll ─────────────────────────────────────────────────────────────────
  onPoll(data, card){
    if(!card?._hass) return;
    const vals=this._getValsForSim(card);
    if(this._simActive){ this._runSimCycle(card); return; }
    const hass=card._hass;
    this._autos.forEach(auto=>{
      if(auto.enabled===false) return;
      const met=this._evalAuto(auto,vals,card);
      const now=Date.now(), cd=(auto.cooldown_min||5)*60000;
      const last=this._lastAutoRun[auto.id]||0;
      if(met&&now-last>cd){
        this._runGartenActions(auto.actions||[],hass,card);
        this._lastAutoRun[auto.id]=now; auto._lastState=true;
        this._log.unshift({ts:now,name:auto.name,sim:false,vals:{
          soilMoist:(vals.soilMoist||0).toFixed(0),
          surplus:(vals.surplus||0).toFixed(0)
        }});
        if(this._log.length>100) this._log.pop();
        card._showToast?.(`\u25C6 ${auto.name}`);
      } else if(!met&&auto._lastState){
        if((auto.actions_else||[]).length&&now-last>cd)
          this._runGartenActions(auto.actions_else,hass,card);
        auto._lastState=false;
      }
    });
  },

  // ── DRAW ───────────────────────────────────────────────────────────────────
  onDraw(ctx, card){
    if(card._mode!=="garten") return;
    const c=card._canvas; if(!c) return;
    const W=c.width, H=c.height, dpr=window.devicePixelRatio||1;
    this._animT=(this._animT||0)+16;
    const t=this._animT;
    const vals=this._getValsForSim(card);

    // Hintergrund: warmes Dunkelgrün
    const bg=ctx.createLinearGradient(0,0,W,H);
    bg.addColorStop(0,"#040d08"); bg.addColorStop(1,"#050f0a");
    ctx.fillStyle=bg; ctx.fillRect(0,0,W,H);

    // Subtiles Gras-Muster
    ctx.strokeStyle="#061408"; ctx.lineWidth=0.5;
    const gs=40*dpr;
    for(let x=0;x<W;x+=gs){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
    for(let y=0;y<H;y+=gs){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}

    // Sim-Overlay
    if(this._simActive){
      ctx.fillStyle="rgba(74,222,128,0.03)"; ctx.fillRect(0,0,W,H);
      ctx.font=`bold ${8*dpr}px monospace`; ctx.fillStyle="#22c55e55";
      ctx.textAlign="right"; ctx.fillText("SIM \u25B6",W-8*dpr,H-8*dpr);
    }

    // Nodes zeichnen
    this._nodes.forEach(n=>this._drawNode(ctx,n,vals,card,W,H,dpr,t));

    // Status-Bar
    ctx.fillStyle="rgba(4,13,8,0.92)"; ctx.fillRect(0,0,W,20*dpr);
    ctx.font=`${6.5*dpr}px 'JetBrains Mono',monospace`;
    ctx.fillStyle="#334155"; ctx.textAlign="left";
    const soilStr=vals.soilMoist!=null?`\uD83E\uDEA8${(+vals.soilMoist).toFixed(0)}%`:"";
    const tempStr=vals.tempC?`  \uD83C\uDF21${(+vals.tempC).toFixed(1)}\u00B0C`:"";
    const rainStr=vals.rainMm?`  \uD83C\uDF27${(+vals.rainMm).toFixed(1)}mm`:"";
    const surStr=`  \u26A1${vals.surplus>=0?"+":""}${(vals.surplus||0).toFixed(0)}W`;
    ctx.fillText(`${soilStr}${tempStr}${rainStr}${surStr}`,10*dpr,13*dpr);

    if(this._editMode){
      ctx.font=`${6*dpr}px monospace`; ctx.fillStyle="#22c55e22";
      ctx.textAlign="left"; ctx.fillText("BEARBEITUNGSMODUS",8*dpr,H-8*dpr);
    }
  },

  _drawNode(ctx, node, vals, card, W, H, dpr, t){
    const nt=this.NODE_TYPES[node.type]||this.NODE_TYPES.custom;
    const nx=node.x*W, ny=node.y*H;
    const nw=(node.w||nt.defaultW)*dpr, nh=(node.h||nt.defaultH)*dpr;
    const color=node.color||nt.color;
    const sel=this._selNode===node;
    const state=this._getNodeState(node,card);
    const isOn=state==="on"||state==="mowing"||state==="cleaning"||state==="true";
    const isOff=state==="off"||state==="docked"||state==="false";
    const val=this._getNodeVal(node,card);
    ctx.save();

    if(node.type==="zone"){
      // Zone: Rechteck als Bereich
      ctx.strokeStyle=sel?"#00e5ff":color+"66";
      ctx.lineWidth=(sel?2:1)*dpr;
      ctx.setLineDash([6*dpr,4*dpr]);
      ctx.strokeRect(nx-nw/2,ny-nh/2,nw,nh);
      ctx.setLineDash([]);
      ctx.fillStyle=color+"11";
      ctx.fillRect(nx-nw/2,ny-nh/2,nw,nh);
      ctx.font=`bold ${7*dpr}px monospace`; ctx.fillStyle=color+"88";
      ctx.textAlign="center"; ctx.fillText(node.label,nx,ny);
      ctx.restore(); return;
    }

    if(node.type==="greenhouse"){
      this._drawGreenhouseShape(ctx,nx,ny,nw,nh,color,t,dpr,sel);
      ctx.restore(); return;
    }

    if(node.type==="plant"||node.type==="xiaomi"){
      this._drawPlantNode(ctx,nx,ny,nw,color,val,node,sel,dpr,t,card);
      ctx.restore(); return;
    }

    // Standard-Kreis
    if(isOn){ ctx.shadowColor=color; ctx.shadowBlur=12*dpr; }
    const r=Math.min(nw,nh)/2;
    ctx.fillStyle="#0a1510";
    ctx.strokeStyle=sel?"#00e5ff":isOn?color:isOff?"#1c2535":"#334155";
    ctx.lineWidth=sel?2.5*dpr:1.5*dpr;
    ctx.beginPath(); ctx.arc(nx,ny,r,0,Math.PI*2); ctx.fill(); ctx.stroke();

    // Pulsring wenn aktiv
    if(isOn){
      const phase=(t/900)%1;
      ctx.globalAlpha=(1-phase)*0.3;
      ctx.strokeStyle=color; ctx.lineWidth=2*dpr;
      ctx.beginPath(); ctx.arc(nx,ny,r*(1+phase*0.6),0,Math.PI*2); ctx.stroke();
      ctx.globalAlpha=1;
    }

    // Spezial: Sprinkler-Animation (Wassertropfen)
    if(node.type==="sprinkler"&&isOn){
      for(let i=0;i<3;i++){
        const angle=-Math.PI/2+i*0.4-0.4;
        const dr=r*(0.8+((t/300+i*0.5)%1)*0.6);
        const alpha=Math.max(0,1-((t/300+i*0.5)%1));
        ctx.globalAlpha=alpha*0.6;
        ctx.fillStyle="#38bdf8";
        ctx.beginPath();
        ctx.arc(nx+Math.cos(angle)*dr,ny+Math.sin(angle)*dr,2*dpr,0,Math.PI*2);
        ctx.fill();
      }
      ctx.globalAlpha=1;
    }

    // Mäher-Animation (rotierende Klinge)
    if(node.type==="mower"&&isOn){
      ctx.save();
      ctx.translate(nx,ny);
      ctx.rotate(t/200);
      ctx.strokeStyle="#22c55e88"; ctx.lineWidth=1.5*dpr;
      ctx.beginPath(); ctx.moveTo(-r*0.5,0); ctx.lineTo(r*0.5,0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0,-r*0.5); ctx.lineTo(0,r*0.5); ctx.stroke();
      ctx.restore();
    }

    ctx.shadowBlur=0;

    // Icon
    ctx.font=`${Math.min(nw,nh)*0.35}px serif`;
    ctx.fillStyle=isOn?color:isOff?"#334155":"#94a3b8";
    ctx.textAlign="center";
    ctx.fillText(nt.icon,nx,ny+Math.min(nw,nh)*0.13);

    // Wert
    if(val!==null){
      let display;
      if(node.type==="soil")      display=`${(+val).toFixed(0)}%`;
      else if(node.type==="temp") display=`${(+val).toFixed(1)}\u00B0C`;
      else if(node.type==="rain") display=`${(+val).toFixed(1)}mm`;
      else if(typeof val==="number") display=`${val.toFixed(0)}W`;
      else display=String(val).slice(0,8);
      ctx.font=`bold ${7*dpr}px monospace`;
      ctx.fillStyle=isOn?color:"#94a3b8"; ctx.textAlign="center";
      ctx.fillText(display,nx,ny+(r+11)*dpr);
    }

    // Label
    ctx.font=`${6*dpr}px monospace`; ctx.fillStyle="#334155"; ctx.textAlign="center";
    ctx.fillText((node.label||nt.label).slice(0,16),nx,ny+(r+20)*dpr);

    // Resize-Handle
    if(this._editMode&&sel){
      ctx.fillStyle="#00e5ff"; ctx.strokeStyle="#fff"; ctx.lineWidth=1;
      ctx.beginPath(); ctx.arc(nx+r+2*dpr,ny+r+2*dpr,5*dpr,0,Math.PI*2);
      ctx.fill(); ctx.stroke();
    }
    ctx.restore();
  },

  _drawGreenhouseShape(ctx,nx,ny,nw,nh,color,t,dpr,sel){
    ctx.save();
    const rx=nw/2, ry=nh/2;
    // Wände
    ctx.fillStyle="#0a1a0a"; ctx.strokeStyle=sel?"#00e5ff":color+"88";
    ctx.lineWidth=sel?2.5*dpr:1.5*dpr;
    ctx.beginPath();
    ctx.moveTo(nx-rx,ny+ry); ctx.lineTo(nx-rx,ny);
    ctx.lineTo(nx,ny-ry);    ctx.lineTo(nx+rx,ny);
    ctx.lineTo(nx+rx,ny+ry); ctx.closePath();
    ctx.fill(); ctx.stroke();
    // Glasscheiben-Gitter
    ctx.strokeStyle=color+"33"; ctx.lineWidth=0.5*dpr;
    for(let i=1;i<4;i++){
      ctx.beginPath();
      ctx.moveTo(nx-rx+i*(rx*2/4),ny);
      ctx.lineTo(nx-rx+i*(rx*2/4),ny+ry);
      ctx.stroke();
    }
    ctx.beginPath(); ctx.moveTo(nx-rx,ny+ry*0.5); ctx.lineTo(nx+rx,ny+ry*0.5); ctx.stroke();
    // Wärme-Effekt
    const warmAlpha=0.05+0.02*Math.sin(t/800);
    ctx.fillStyle=`rgba(163,230,53,${warmAlpha})`; ctx.fill();
    ctx.restore();
  },

  _drawPlantNode(ctx,nx,ny,nw,color,val,node,sel,dpr,t,card){
    const r=Math.min(nw,(node.h||48)*dpr)/2;
    ctx.save();
    // Topf
    ctx.fillStyle="#2a1810"; ctx.strokeStyle=sel?"#00e5ff":"#44332266";
    ctx.lineWidth=sel?2*dpr:1*dpr;
    ctx.beginPath();
    ctx.moveTo(nx-r*0.5,ny+r*0.3); ctx.lineTo(nx+r*0.5,ny+r*0.3);
    ctx.lineTo(nx+r*0.4,ny+r*0.7); ctx.lineTo(nx-r*0.4,ny+r*0.7);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    // Stiel
    ctx.strokeStyle=color+"cc"; ctx.lineWidth=2*dpr;
    ctx.beginPath(); ctx.moveTo(nx,ny+r*0.3); ctx.lineTo(nx,ny-r*0.2); ctx.stroke();
    // Blätter (animiert)
    const leafPhase=Math.sin(t/1500)*0.1;
    ctx.fillStyle=color+"dd";
    ctx.beginPath();
    ctx.ellipse(nx-r*0.3+leafPhase*r,ny-r*0.1,r*0.35,r*0.2,Math.PI/4,0,Math.PI*2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(nx+r*0.3-leafPhase*r,ny-r*0.1,r*0.35,r*0.2,-Math.PI/4,0,Math.PI*2);
    ctx.fill();

    // Feuchte-Anzeige (kleiner Balken unten)
    const soilVal = val!==null ? Math.min(100,Math.max(0,parseFloat(val)||0)) : null;
    if(soilVal!==null){
      const barW=r*1.2, barH=4*dpr;
      const bx=nx-barW/2, by=ny+r*0.8;
      ctx.fillStyle="#1c2535"; ctx.beginPath(); ctx.roundRect(bx,by,barW,barH,2); ctx.fill();
      const fc=soilVal<30?"#ef4444":soilVal<60?"#f59e0b":"#22c55e";
      ctx.fillStyle=fc; ctx.beginPath(); ctx.roundRect(bx,by,barW*(soilVal/100),barH,2); ctx.fill();
      ctx.font=`${5.5*dpr}px monospace`; ctx.fillStyle=fc; ctx.textAlign="center";
      ctx.fillText(`${soilVal.toFixed(0)}%`,nx,by+barH+6*dpr);
    }

    // Label
    ctx.font=`${6*dpr}px monospace`; ctx.fillStyle="#334155"; ctx.textAlign="center";
    ctx.fillText((node.label||'Pflanze').slice(0,12),nx,ny+r+20*dpr);
    ctx.restore();
  },

  _getNodeState(node,card){
    if(this._simActive&&node.entity in this._simStates) return this._simStates[node.entity];
    if(!node.entity||!card?._hass?.states?.[node.entity]) return null;
    return card._hass.states[node.entity].state;
  },

  _getNodeVal(node,card){
    const st=this._getNodeState(node,card);
    if(st===null) return null;
    const num=parseFloat(st);
    return isNaN(num)?st:num;
  },

  // ── SIDEBAR ────────────────────────────────────────────────────────────────
  buildSidebar(card){
    const wrap=document.createElement("div");
    wrap.style.cssText="padding:8px;display:flex;flex-direction:column;gap:5px;overflow-y:auto";

    if(!this.isActive(card)){
      const cfg=card?._opts?.garten_cfg||{};
      const note=document.createElement("div");
      note.style.cssText="padding:10px;background:var(--surf2);border-radius:6px;font-size:8px;color:#445566;text-align:center";
      note.textContent=`Saison-Modus: pausiert (${cfg.saison_from||4}.–${cfg.saison_to||10}. Monat)`;
      wrap.appendChild(note); return wrap;
    }

    // Mode-Buttons
    const modeRow=document.createElement("div"); modeRow.style.cssText="display:flex;gap:3px";
    const mk=(label,active,cb)=>{
      const b=document.createElement("button");
      b.style.cssText=`flex:1;padding:4px;border-radius:4px;border:1px solid ${active?"#22c55e":"#1c2535"};background:${active?"#22c55e22":"var(--surf2)"};color:${active?"#22c55e":"#445566"};font-size:7px;cursor:pointer`;
      b.textContent=label; b.addEventListener("click",cb); return b;
    };
    modeRow.append(
      mk(this._editMode?"\uD83D\uDD13 EDIT":"\uD83D\uDD12 VIEW", this._editMode,
        ()=>{this._editMode=!this._editMode;card._rebuildSidebar?.();card._markDirty?.();}),
      mk(this._simActive?"\uD83E\uDDEA SIM AN":"\uD83E\uDDEA Simulator", this._simActive,
        ()=>{this._simActive=!this._simActive;if(!this._simActive)this._simStates={};card._rebuildSidebar?.();card._markDirty?.();})
    );
    wrap.appendChild(modeRow);

    // Sim-Panel
    if(this._simActive) this._buildSimPanel(wrap,card);

    // Status-Box
    const vals=this._getValsForSim(card);
    const sb=document.createElement("div");
    sb.style.cssText="background:var(--surf2);border-radius:5px;padding:5px 8px;border:1px solid #1c2535";
    const soilColor=!vals.soilMoist?"#445566":vals.soilMoist<30?"#ef4444":vals.soilMoist<60?"#f59e0b":"#22c55e";
    sb.innerHTML=`<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:3px">
      <div><div style="font-size:6px;color:#445566">\uD83E\uDEA8 Feuchte</div>
        <div style="font-size:11px;font-weight:700;color:${soilColor}">${vals.soilMoist!=null?(+vals.soilMoist).toFixed(0)+"%":"--"}</div></div>
      <div><div style="font-size:6px;color:#445566">\uD83C\uDF21 Temp</div>
        <div style="font-size:11px;font-weight:700;color:#f97316">${vals.tempC?(+vals.tempC).toFixed(1)+"\u00B0C":"--"}</div></div>
      <div><div style="font-size:6px;color:#445566">\u26A1 Solar</div>
        <div style="font-size:11px;font-weight:700;color:${vals.surplus>0?"#22c55e":"#445566"}">${(vals.surplus>=0?"+":"")+(vals.surplus||0).toFixed(0)}W</div></div>
    </div>`;
    wrap.appendChild(sb);

    // Tabs
    const tabs=[["nodes","\uD83C\uDF3F Geräte"],["autos","\u25C6 Auto"],["cfg","\u2699 Konfig"]];
    const active=this._sidebarTab||"nodes";
    const tabBar=document.createElement("div");
    tabBar.style.cssText="display:grid;grid-template-columns:repeat(3,1fr);gap:2px;margin-bottom:3px";
    tabs.forEach(([tid,label])=>{
      const btn=document.createElement("button"); const isA=active===tid;
      btn.style.cssText=`padding:4px;border-radius:3px;border:1px solid ${isA?"#22c55e":"#1c2535"};background:${isA?"#22c55e22":"var(--surf2)"};color:${isA?"#22c55e":"#445566"};font-size:7px;cursor:pointer`;
      btn.textContent=label;
      btn.addEventListener("click",()=>{this._sidebarTab=tid;this._selNode=null;this._selAuto=null;card._rebuildSidebar?.();});
      tabBar.appendChild(btn);
    });
    wrap.appendChild(tabBar);

    if(this._selNode&&active==="nodes"){wrap.appendChild(this._buildNodeEditor(card));return wrap;}
    if(this._selAuto&&active==="autos"){wrap.appendChild(this._buildAutoEditor(card));return wrap;}
    if(active==="nodes") this._buildTabNodes(wrap,card);
    if(active==="autos") this._buildTabAutos(wrap,card,vals);
    if(active==="cfg")   this._buildTabConfig(wrap,card);
    return wrap;
  },

  _buildSimPanel(wrap,card){
    const box=document.createElement("div");
    box.style.cssText="background:#22c55e15;border:1px solid #22c55e55;border-radius:5px;padding:6px;margin-bottom:3px";
    const hdr=document.createElement("div");
    hdr.style.cssText="font-size:7.5px;font-weight:700;color:#22c55e;margin-bottom:5px";
    hdr.textContent="\uD83E\uDDEA GARTEN-SIMULATOR";
    box.appendChild(hdr);
    const s=this._simVals;
    const mkSl=(label,key,min,max,step,unit,dec=0)=>{
      const row=document.createElement("div"); row.style.cssText="margin-bottom:4px";
      const top=document.createElement("div");
      top.style.cssText="display:flex;justify-content:space-between;font-size:7px;color:#22c55e88;margin-bottom:1px";
      const vs=document.createElement("span"); vs.textContent=`${(+s[key]).toFixed(dec)}${unit}`;
      top.innerHTML=`<span>${label}</span>`; top.appendChild(vs);
      const sl=document.createElement("input"); sl.type="range"; sl.min=min; sl.max=max; sl.step=step; sl.value=s[key];
      sl.style.cssText="width:100%;accent-color:#22c55e;height:14px";
      sl.addEventListener("input",()=>{s[key]=parseFloat(sl.value);vs.textContent=`${(+s[key]).toFixed(dec)}${unit}`;this._runSimCycle(card);card._markDirty?.();});
      row.append(top,sl); return row;
    };
    box.appendChild(mkSl("Solar","solarW",0,3000,10,"W"));
    box.appendChild(mkSl("Verbrauch","loadW",0,2000,10,"W"));
    box.appendChild(mkSl("Bodenfeuchte","soilMoist",0,100,1,"%"));
    box.appendChild(mkSl("Temperatur","tempC",0,45,0.5,"°C",1));
    box.appendChild(mkSl("Regen","rainMm",0,50,0.5,"mm",1));
    const surplus=s.solarW-s.loadW;
    const info=document.createElement("div");
    info.style.cssText=`font-size:7.5px;font-weight:700;color:${surplus>0?"#22c55e":"#ef4444"};text-align:center;margin-top:3px`;
    info.textContent=`Überschuss: ${surplus>=0?"+":""}${surplus}W`;
    box.appendChild(info);
    wrap.appendChild(box);
  },

  _buildTabNodes(wrap,card){
    const hdr=document.createElement("div");
    hdr.style.cssText="font-size:7.5px;font-weight:700;color:#94a3b8;margin-top:3px;margin-bottom:4px";
    hdr.textContent="ELEMENT HINZUFÜGEN"; wrap.appendChild(hdr);
    const grid=document.createElement("div");
    grid.style.cssText="display:grid;grid-template-columns:1fr 1fr;gap:3px";
    Object.entries(this.NODE_TYPES).forEach(([type,def])=>{
      const btn=document.createElement("button");
      btn.style.cssText="padding:4px;border-radius:4px;border:1px solid #1c2535;background:var(--surf2);color:var(--text);font-size:7.5px;cursor:pointer;text-align:left;display:flex;align-items:center;gap:4px";
      btn.innerHTML=`<span style="font-size:11px">${def.icon}</span><span>${def.label}</span>`;
      btn.addEventListener("click",()=>{
        const n={id:type+"_"+Date.now(),type,label:def.label,entity:"",
          x:0.25+Math.random()*0.5,y:0.25+Math.random()*0.5,
          w:def.defaultW,h:def.defaultH,color:def.color};
        this._nodes.push(n); this._selNode=n;
        this._save(card); card._rebuildSidebar?.(); card._markDirty?.();
      });
      grid.appendChild(btn);
    });
    wrap.appendChild(grid);
    if(this._nodes.length){
      const lh=document.createElement("div");
      lh.style.cssText="font-size:7px;font-weight:700;color:#94a3b8;margin-top:6px;margin-bottom:3px";
      lh.textContent=`PLATZIERT (${this._nodes.length})`; wrap.appendChild(lh);
      this._nodes.forEach(node=>{
        const nt=this.NODE_TYPES[node.type]||this.NODE_TYPES.custom;
        const row=document.createElement("div");
        row.style.cssText=`display:flex;align-items:center;gap:5px;padding:4px 6px;border-radius:4px;border:1px solid ${this._selNode===node?"#22c55e44":"#1c2535"};background:${this._selNode===node?"#22c55e08":"var(--surf2)"};cursor:pointer;margin-bottom:2px`;
        row.innerHTML=`<span style="font-size:11px">${nt.icon}</span><div style="flex:1;min-width:0"><div style="font-size:8px;font-weight:700;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${node.label}</div><div style="font-size:6px;color:#445566">${node.entity||"keine Entity"}</div></div>`;
        row.addEventListener("click",()=>{this._selNode=this._selNode===node?null:node;card._rebuildSidebar?.();card._markDirty?.();});
        wrap.appendChild(row);
      });
    }
  },

  _buildNodeEditor(card){
    const node=this._selNode;
    const nt=this.NODE_TYPES[node.type]||this.NODE_TYPES.custom;
    const div=document.createElement("div"); div.style.cssText="display:flex;flex-direction:column;gap:5px";
    const hdr=document.createElement("div"); hdr.style.cssText="display:flex;align-items:center;gap:6px";
    hdr.innerHTML=`<span style="font-size:15px">${nt.icon}</span><span style="font-size:9px;font-weight:700;color:${node.color||nt.color}">${nt.label}</span>`;
    const back=document.createElement("button");
    back.style.cssText="margin-left:auto;padding:2px 8px;border-radius:4px;border:1px solid var(--border);background:var(--surf2);color:var(--text);font-size:8px;cursor:pointer";
    back.textContent="\u2190";
    back.addEventListener("click",()=>{this._selNode=null;card._rebuildSidebar?.();});
    hdr.appendChild(back); div.appendChild(hdr);
    const save=(k,v)=>{node[k]=v;this._save(card);card._markDirty?.();};
    div.appendChild(this._mkField("Label",node.label,v=>save("label",v)));
    // Entity-Picker mit passendem Domain je Node-Typ
    const domains={
      mower:["vacuum","lawn_mower"],
      sprinkler:["switch","input_boolean"],
      plant:["sensor"],
      xiaomi:["sensor"],
      soil:["sensor"],
      rain:["sensor"],
      temp:["sensor"],
      valve:["switch"],
      pump:["switch"],
      light:["light","switch"],
      greenhouse:["switch","climate"],
    }[node.type]||["switch","sensor"];
    div.appendChild(this._mkEntityPicker("Entity",node.entity,domains,v=>save("entity",v),card));
    const del=document.createElement("button");
    del.style.cssText="width:100%;padding:4px;border-radius:4px;border:1px solid #ef4444;background:transparent;color:#ef4444;font-size:8px;cursor:pointer;margin-top:4px";
    del.textContent="\uD83D\uDDD1 Löschen";
    del.addEventListener("click",()=>{this._nodes=this._nodes.filter(n=>n.id!==node.id);this._selNode=null;this._save(card);card._rebuildSidebar?.();});
    div.appendChild(del);
    return div;
  },

  _buildTabAutos(wrap,card,vals){
    const hdr=document.createElement("div"); hdr.style.cssText="display:flex;align-items:center;gap:5px;margin-top:3px";
    const t=document.createElement("div"); t.style.cssText="font-size:7.5px;font-weight:700;color:#94a3b8;flex:1";
    t.textContent=`AUTOMATIONEN (${this._autos.length})`;
    const addBtn=document.createElement("button");
    addBtn.style.cssText="padding:3px 8px;border-radius:4px;border:1px solid #22c55e;background:transparent;color:#22c55e;font-size:7.5px;cursor:pointer";
    addBtn.textContent="+ Neu";
    addBtn.addEventListener("click",()=>{
      const na={id:"a"+Date.now(),name:"Neue Automation",enabled:true,
        conditions:[],operator:"AND",actions:[],actions_else:[],cooldown_min:5};
      this._autos.push(na); this._selAuto=na; this._save(card); card._rebuildSidebar?.();
    });
    hdr.append(t,addBtn); wrap.appendChild(hdr);
    this._autos.forEach(auto=>{
      const running=this._evalAuto(auto,vals,card);
      const row=document.createElement("div");
      row.style.cssText=`display:flex;align-items:center;gap:5px;padding:5px 6px;border-radius:5px;border:1px solid ${running?"#22c55e44":"#1c2535"};background:${running?"#22c55e0a":"var(--surf2)"};cursor:pointer;margin-bottom:2px`;
      const tog=document.createElement("input"); tog.type="checkbox"; tog.checked=auto.enabled!==false;
      tog.style.cssText="accent-color:#22c55e;width:12px;height:12px;cursor:pointer";
      tog.addEventListener("click",(e)=>{e.stopPropagation();auto.enabled=tog.checked;this._save(card);card._markDirty?.();});
      row.innerHTML=`<span style="font-size:10px">\u25C6</span><div style="flex:1;min-width:0"><div style="font-size:8px;font-weight:700;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${auto.name}</div><div style="font-size:6.5px;color:#445566">${auto.conditions?.length||0} Bed · ${auto.actions?.length||0} Akt</div></div><span style="font-size:8px;font-weight:700;color:${running?"#22c55e":"#445566"}">${running?"\u25B6":"\u25CF"}</span>`;
      row.insertBefore(tog,row.firstChild);
      row.addEventListener("click",()=>{this._selAuto=auto;card._rebuildSidebar?.();});
      wrap.appendChild(row);
    });
    // Log
    if(this._log.length){
      const lh=document.createElement("div"); lh.style.cssText="font-size:7px;font-weight:700;color:#94a3b8;margin-top:5px;margin-bottom:2px";
      lh.textContent=`LOG (${this._log.length})`; wrap.appendChild(lh);
      this._log.slice(0,5).forEach(e=>{
        const r=document.createElement("div"); r.style.cssText="font-size:6.5px;color:#445566;padding:2px 0;border-bottom:1px solid #0d121933";
        const ts=new Date(e.ts);
        r.textContent=`${ts.getHours().toString().padStart(2,"0")}:${ts.getMinutes().toString().padStart(2,"0")}${e.sim?" [SIM]":""} · ${e.name}`;
        wrap.appendChild(r);
      });
    }
  },

  _buildAutoEditor(card){
    return this._buildAutoEditorBase(card, this.COND, this.ACT, "#22c55e");
  },

  _buildTabConfig(wrap,card){
    const cfg=card?._opts?.garten_cfg||{};
    const save=(k,v)=>{if(!card._opts)card._opts={};if(!card._opts.garten_cfg)card._opts.garten_cfg={};card._opts.garten_cfg[k]=v;card._saveOptions?.();};
    const box=(title,color="#94a3b8")=>{
      const b=document.createElement("div");
      b.style.cssText="background:var(--surf2);border-radius:5px;padding:7px;border:1px solid #1c2535;margin-bottom:5px";
      const h=document.createElement("div");
      h.style.cssText=`font-size:7.5px;font-weight:700;color:${color};margin-bottom:5px`;
      h.textContent=title; b.appendChild(h); return b;
    };
    const addField=(box,label,key,ph)=>{
      box.appendChild(this._mkEntityPicker(label,cfg[key]||"",[],v=>save(key,v),card));
    };

    const mowerBox=box("\uD83E\uDE9A Mähroboter","#22c55e");
    addField(mowerBox,"Mähroboter Entity","mower_entity");
    wrap.appendChild(mowerBox);

    const sprBox=box("\uD83D\uDCA7 Bewässerung","#38bdf8");
    [["\uD83D\uDCA7 Zone 1","irrigat_1"],["\uD83D\uDCA7 Zone 2","irrigat_2"],
     ["\uD83D\uDCA7 Zone 3","irrigat_3"],["\uD83D\uDCA7 Zone 4","irrigat_4"],
     ["\uD83E\uDEA8 Bodenfeuchte","soil_moisture"],["\uD83C\uDF27 Regensensor","rain_sensor"]]
    .forEach(([l,k])=>sprBox.appendChild(this._mkEntityPicker(l,cfg[k]||"",[],v=>save(k,v),card)));
    wrap.appendChild(sprBox);

    const plantBox=box("\uD83C\uDF31 Pflanzen & Sensoren","#4ade80");
    [["\uD83C\uDF21 Außentemperatur","temp_sensor"],["\uD83C\uDF21 Gewächshaus Temp","greenhouse_temp"],
     ["\uD83E\uDEA8 Gewächshaus Feuchte","greenhouse_moist"]]
    .forEach(([l,k])=>plantBox.appendChild(this._mkEntityPicker(l,cfg[k]||"",[],v=>save(k,v),card)));
    wrap.appendChild(plantBox);

    const energyBox=box("\u26A1 Solar & Energie","#f59e0b");
    [["\u26A1 Solar-Leistung","solar_power"],["\uD83C\uDFE0 Verbrauch","load_power"],
     ["\uD83C\uDF24 Wetter-Entity","weather_entity"]]
    .forEach(([l,k])=>energyBox.appendChild(this._mkEntityPicker(l,cfg[k]||"",[],v=>save(k,v),card)));
    wrap.appendChild(energyBox);

    // Saison
    const sBox=box("\uD83D\uDCC5 Saison-Modus");
    const sCb=document.createElement("input"); sCb.type="checkbox"; sCb.checked=!!cfg.saison_active;
    sCb.style.cssText="accent-color:#22c55e;width:13px;height:13px";
    sCb.addEventListener("change",()=>save("saison_active",sCb.checked));
    const sRow=document.createElement("div"); sRow.style.cssText="display:flex;align-items:center;gap:6px;margin-bottom:4px";
    const sLbl=document.createElement("span"); sLbl.style.cssText="font-size:8px;color:#94a3b8";
    sLbl.textContent="Modul zeitlich begrenzen"; sRow.append(sCb,sLbl); sBox.appendChild(sRow);
    const mRow=document.createElement("div"); mRow.style.cssText="display:flex;align-items:center;gap:6px";
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
    sBox.appendChild(mRow); wrap.appendChild(sBox);
  },
};

if(typeof BLEModuleRegistry!=="undefined"){
  BLEModuleRegistry.register(GartenModul);
} else {
  window._BLE_MODULE_GARTEN=GartenModul;
}
