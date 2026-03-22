// ═══════════════════════════════════════════════════════════════════════════
// BLE Positioning – Modul: POOL & GARTEN
// Version: 2.0.0
// Datei: /config/www/ble_positioning/modules/pool.js
// Canvas-Baukasten · Pumpen · Sensoren · Automationen · Simulation
// ═══════════════════════════════════════════════════════════════════════════

const PoolModul = {
  id:"pool", name:"Pool & Garten", icon:"\uD83C\uDFCA", tabId:"pool",
  version: "2.1.0", description:"Baukasten \u00B7 Pumpen \u00B7 Bewässerung \u00B7 Sensoren \u00B7 Automationen",
  _card:null,

  // ── State ─────────────────────────────────────────────────────────────────
  _nodes:[],        // Platzierte Geräte auf dem Canvas
  _animT:0,
  _selNode:null,
  _dragNode:null, _dragOffX:0, _dragOffY:0,
  _resizeNode:null, _resizeStartX:0, _resizeStartY:0, _resizeStartW:0, _resizeStartH:0,
  _editMode:true,
  _sidebarTab:"nodes",
  _autos:[],
  _selAuto:null,
  _log:[],
  _lastAutoRun:{},
  _history:[],

  // Simulation
  _simActive:false,
  _simVals:{ tempC:20, solarW:800, loadW:300, phVal:7.2, chlorPpm:1.2 },
  _simStates:{},

  // ── Node-Typen ────────────────────────────────────────────────────────────
  NODE_TYPES:{
    pool:       {label:"Pool",              icon:"\uD83C\uDFCA", color:"#0ea5e9", defaultW:90, defaultH:60},
    pump:       {label:"Filterpumpe",       icon:"\u26A1",       color:"#3b82f6", defaultW:56, defaultH:56},
    heater:     {label:"Heizung",           icon:"\uD83D\uDD25", color:"#ef4444", defaultW:52, defaultH:52},
    chlorinator:{label:"Chlorinator",       icon:"\u2697",       color:"#a855f7", defaultW:52, defaultH:52},
    light:      {label:"Beleuchtung",       icon:"\uD83D\uDCA1", color:"#fbbf24", defaultW:48, defaultH:48},
    valve:      {label:"Ventil",            icon:"\uD83D\uDEB0", color:"#22c55e", defaultW:48, defaultH:48},
    sensor_temp:{label:"Temp-Sensor",       icon:"\uD83C\uDF21", color:"#f97316", defaultW:52, defaultH:52},
    sensor_ph:  {label:"pH-Sensor",        icon:"\uD83D\uDDE3", color:"#8b5cf6", defaultW:52, defaultH:52},
    sensor_cl:  {label:"Chlor-Sensor",     icon:"\uD83E\uDDEA", color:"#06b6d4", defaultW:52, defaultH:52},
    sprinkler:  {label:"Sprinkler",         icon:"\uD83C\uDF27", color:"#38bdf8", defaultW:48, defaultH:48},
    pond:       {label:"Teich",             icon:"\uD83D\uDEB0", color:"#0891b2", defaultW:80, defaultH:55},
    powerstrip: {label:"Steckdose/Relais",  icon:"\uD83D\uDD0C", color:"#64748b", defaultW:52, defaultH:52},
    custom:     {label:"Eigenes Gerät",     icon:"\u2699",       color:"#475569", defaultW:48, defaultH:48},
  },

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  init(card){
    this._card=card;
    const opts=card._opts||{};
    this._nodes  = opts.pool_nodes   || [];
    this._autos  = opts.pool_autos   || [];
    this._log    = opts.pool_log     || [];
    if(!this._nodes.length) this._createDefaultLayout(card);
  },
  destroy(){ this._card=null; },

  isActive(card){
    const cfg=card?._opts?.pool_cfg||{};
    if(!cfg.saison_active)return true;
    const mm=new Date().getMonth()+1;
    const from=parseInt(cfg.saison_from||4), to=parseInt(cfg.saison_to||10);
    return from<=to?mm>=from&&mm<=to:mm>=from||mm<=to;
  },

  _save(card){
    if(!card._opts)card._opts={};
    card._opts.pool_nodes = this._nodes;
    card._opts.pool_autos = this._autos;
    card._opts.pool_log   = this._log.slice(0,50);
    card._saveOptions?.();
  },

  _createDefaultLayout(card){
    const cfg=card?._opts?.pool_cfg||{};
    this._nodes=[
      {id:"pool1",   type:"pool",        x:0.42, y:0.38, w:90, h:60,  label:"Pool",      entity:""},
      {id:"pump1",   type:"pump",        x:0.25, y:0.62, w:56, h:56,  label:"Pumpe",     entity:cfg.pool_pump||""},
      {id:"temp1",   type:"sensor_temp", x:0.62, y:0.58, w:52, h:52,  label:"Temperatur",entity:cfg.pool_temp||""},
    ];
    if(cfg.pool_heat) this._nodes.push({id:"heat1",type:"heater",x:0.42,y:0.65,w:52,h:52,label:"Heizung",entity:cfg.pool_heat});
  },

  // ── Werte holen ───────────────────────────────────────────────────────────
  _getNodeState(node, card){
    if(this._simActive && node.entity in this._simStates)
      return this._simStates[node.entity];
    if(!node.entity || !card?._hass?.states?.[node.entity]) return null;
    return card._hass.states[node.entity].state;
  },

  _getNodeVal(node, card){
    const st = this._getNodeState(node, card);
    if(st===null) return null;
    const num = parseFloat(st);
    return isNaN(num) ? st : num;
  },

  _getSimState(eid, card){
    if(!eid) return undefined;
    if(this._simActive && eid in this._simStates) return this._simStates[eid];
    return card?._hass?.states?.[eid]?.state;
  },

  _runSimActions(actions, card){
    const cfg=card?._opts?.pool_cfg||{};
    const res=s=>s?.replace(/\{\{(\w+)\}\}/g,(_,k)=>cfg[k]||s);
    actions.forEach(a=>{
      const eid=res(a.entity); if(!eid)return;
      switch(a.type){
        case"switch_on":     this._simStates[eid]="on";  break;
        case"switch_off":    this._simStates[eid]="off"; break;
        case"switch_toggle": this._simStates[eid]=(this._getSimState(eid,card)==="on")?"off":"on"; break;
        case"notify": card?._showToast?.(`\uD83D\uDD14 [SIM] ${a.message||"Benachrichtigung"}`); break;
      }
    });
  },

  _runSimCycle(card){
    if(!this._simActive||!card) return;
    const vals=this._getPoolVals(card);
    const cfg=card?._opts?.pool_cfg||{};
    this._autos.forEach(auto=>{
      if(auto.enabled===false)return;
      const met=this._evalAuto(auto, vals, card);
      const now=Date.now(), last=this._lastAutoRun[auto.id]||0;
      if(met && now-last>3000){
        this._runSimActions(auto.actions||[], card);
        this._lastAutoRun[auto.id]=now; auto._lastState=true;
        this._log.unshift({ts:now, name:auto.name, sim:true});
        if(this._log.length>100)this._log.pop();
        card._showToast?.(`\u25C6 ${auto.name} [SIM]`);
      } else if(!met && auto._lastState){
        if((auto.actions_else||[]).length) this._runSimActions(auto.actions_else, card);
        auto._lastState=false;
      }
    });
    card._markDirty?.();
  },

  _getPoolVals(card){
    if(this._simActive){
      const s=this._simVals;
      return{tempC:s.tempC, solarW:s.solarW, loadW:s.loadW, phVal:s.phVal,
             chlorPpm:s.chlorPpm, surplus:s.solarW-s.loadW};
    }
    const cfg=card?._opts?.pool_cfg||{};
    const hass=card?._hass;
    const g=k=>{const e=cfg[k];return e&&hass?.states[e]?parseFloat(hass.states[e].state)||0:0;};
    const s=k=>{const e=cfg[k];return e&&hass?.states[e]?hass.states[e].state:null;};
    const solarW=g("solar_power"), loadW=g("load_power");
    return{tempC:g("pool_temp")||s("pool_temp"), solarW, loadW, phVal:g("ph_sensor"),
           chlorPpm:g("chlor_sensor"), surplus:solarW-loadW};
  },

  // ── Poll ──────────────────────────────────────────────────────────────────
  onPoll(data, card){
    if(!card?._hass)return;
    const vals=this._getPoolVals(card);
    this._history.push({ts:Date.now(),...vals});
    if(this._history.length>360)this._history.shift();

    if(this._simActive){ this._runSimCycle(card); return; }

    const cfg=card?._opts?.pool_cfg||{};
    const hass=card._hass;

    // Automationen auswerten
    this._autos.forEach(auto=>{
      if(auto.enabled===false)return;
      const met=this._evalAuto(auto, vals, card);
      const now=Date.now(), cd=(auto.cooldown_min||5)*60000;
      const last=this._lastAutoRun[auto.id]||0;
      if(met && now-last>cd){
        this._runPoolActions(auto.actions||[], hass, card);
        this._lastAutoRun[auto.id]=now; auto._lastState=true;
        this._log.unshift({ts:now, name:auto.name, sim:false,
          vals:{tempC:(vals.tempC||0).toFixed(1), surplus:(vals.surplus||0).toFixed(0)}});
        if(this._log.length>100)this._log.pop();
        card._showToast?.(`\u25C6 ${auto.name}`);
      } else if(!met && auto._lastState){
        if((auto.actions_else||[]).length && now-last>cd)
          this._runPoolActions(auto.actions_else, hass, card);
        auto._lastState=false;
      }
    });
  },

  _runPoolActions(actions, hass, card){
    const cfg=card?._opts?.pool_cfg||{};
    const res=s=>s?.replace(/\{\{(\w+)\}\}/g,(_,k)=>cfg[k]||s);
    actions.forEach(a=>{
      const eid=res(a.entity); if(!eid)return;
      switch(a.type){
        case"switch_on":     hass.callService("switch","turn_on",{entity_id:eid}).catch(()=>{}); break;
        case"switch_off":    hass.callService("switch","turn_off",{entity_id:eid}).catch(()=>{}); break;
        case"switch_toggle": hass.callService("switch","toggle",{entity_id:eid}).catch(()=>{}); break;
        case"notify":        hass.callService("notify","notify",{message:a.message||""}).catch(()=>{}); break;
        case"input_boolean_on":  hass.callService("input_boolean","turn_on",{entity_id:eid}).catch(()=>{}); break;
        case"input_boolean_off": hass.callService("input_boolean","turn_off",{entity_id:eid}).catch(()=>{}); break;
      }
    });
  },

  // ── Automations-Logik ─────────────────────────────────────────────────────
  _evalAuto(auto, vals, card){
    if(!auto?.conditions?.length)return false;
    const r=auto.conditions.map(c=>this._evalCond(c, vals, card));
    return auto.operator==="OR"?r.some(Boolean):r.every(Boolean);
  },

  _evalCond(c, vals, card){
    const v=parseFloat(c.threshold||0);
    switch(c.type){
      case"temp_gt":    return (vals.tempC||0)>v;
      case"temp_lt":    return (vals.tempC||0)<v;
      case"surplus_gt": return (vals.surplus||0)>v;
      case"surplus_lt": return (vals.surplus||0)<v;
      case"ph_gt":      return (vals.phVal||0)>v;
      case"ph_lt":      return (vals.phVal||0)<v;
      case"chlor_gt":   return (vals.chlorPpm||0)>v;
      case"chlor_lt":   return (vals.chlorPpm||0)<v;
      case"entity_on":  return this._getSimState(c.entity,card)==="on";
      case"entity_off": return this._getSimState(c.entity,card)==="off";
      case"time_between":{
        const now=new Date(), hm=now.getHours()*60+now.getMinutes();
        const[fh,fm]=(c.time_from||"00:00").split(":").map(Number);
        const[th,tm]=(c.time_to||"23:59").split(":").map(Number);
        const from=fh*60+fm, to=th*60+tm;
        return from<=to?(hm>=from&&hm<=to):(hm>=from||hm<=to);
      }
      default:return false;
    }
  },

  // ── DRAW ──────────────────────────────────────────────────────────────────
  onDraw(ctx, card){
    if(card._mode!=="pool")return;
    const c=card._canvas; if(!c)return;
    const W=c.width, H=c.height, dpr=window.devicePixelRatio||1;
    this._animT=(this._animT||0)+16;
    const t=this._animT;
    const vals=this._getPoolVals(card);

    // Hintergrund: weiches Blau-Grün (Wasser-Feeling)
    const bg=ctx.createLinearGradient(0,0,0,H);
    bg.addColorStop(0,"#040d18"); bg.addColorStop(1,"#050f14");
    ctx.fillStyle=bg; ctx.fillRect(0,0,W,H);

    // Wasseranimation im Hintergrund (nur wenn Pool-Node existiert)
    const poolNode=this._nodes.find(n=>n.type==="pool"||n.type==="pond");
    if(poolNode) this._drawWaterEffect(ctx, poolNode, W, H, dpr, t);

    // Gitter
    ctx.strokeStyle="#061420"; ctx.lineWidth=0.5;
    const gs=40*dpr;
    for(let x=0;x<W;x+=gs){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
    for(let y=0;y<H;y+=gs){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}

    if(!this.isActive(card)){
      ctx.font=`bold ${11*dpr}px monospace`; ctx.fillStyle="#334155";
      ctx.textAlign="center"; ctx.fillText("Saison-Modus: pausiert",W/2,H/2);
      return;
    }

    // Sim-Overlay
    if(this._simActive){
      ctx.fillStyle="rgba(14,165,233,0.04)"; ctx.fillRect(0,0,W,H);
      ctx.font=`bold ${8*dpr}px monospace`; ctx.fillStyle="#0ea5e966";
      ctx.textAlign="right"; ctx.fillText(`SIM \u25B6`,W-8*dpr,H-8*dpr);
    }

    // Nodes zeichnen
    this._nodes.forEach(n=>this._drawNode(ctx,n,vals,card,W,H,dpr,t));

    // Status-Bar
    ctx.fillStyle="rgba(4,13,24,0.92)"; ctx.fillRect(0,0,W,20*dpr);
    ctx.font=`${6.5*dpr}px 'JetBrains Mono',monospace`;
    ctx.fillStyle="#334155"; ctx.textAlign="left";
    const tempStr = vals.tempC!=null ? `\uD83C\uDF21${(+vals.tempC).toFixed(1)}\u00B0C` : "\uD83C\uDF21 --";
    const phStr   = vals.phVal    ? `  pH ${(+vals.phVal).toFixed(1)}`   : "";
    const clStr   = vals.chlorPpm ? `  Cl ${(+vals.chlorPpm).toFixed(1)}ppm` : "";
    const surStr  = `  \u26A1${vals.surplus>=0?"+":""}${(vals.surplus||0).toFixed(0)}W`;
    ctx.fillText(`${tempStr}${phStr}${clStr}${surStr}`,10*dpr,13*dpr);

    // Edit-Hint
    if(this._editMode){
      ctx.font=`${6*dpr}px monospace`; ctx.fillStyle="#0ea5e933";
      ctx.textAlign="left"; ctx.fillText("BEARBEITUNGSMODUS",8*dpr,H-8*dpr);
    }
  },

  // ── Wasser-Hintergrund (ganzer Canvas) ───────────────────────────────────
  _drawWaterEffect(ctx, node, W, H, dpr, t){
    // Subtile Wasser-Textur über den gesamten Hintergrund
    const nx=node.x*W, ny=node.y*H;
    ctx.save();
    // Große Licht-Reflexionen (caustics)
    for(let i=0;i<6;i++){
      const cx=nx+(Math.sin(t/2000+i*1.1)*0.08+Math.cos(i*2.3)*0.12)*W;
      const cy=ny+(Math.cos(t/1800+i*0.9)*0.06+Math.sin(i*1.7)*0.08)*H;
      const r=(40+20*Math.sin(t/700+i))*dpr;
      const alpha=0.03+0.02*Math.sin(t/500+i*0.8);
      const g=ctx.createRadialGradient(cx,cy,0,cx,cy,r);
      g.addColorStop(0,`rgba(56,189,248,${alpha*3})`);
      g.addColorStop(1,'rgba(56,189,248,0)');
      ctx.fillStyle=g; ctx.fillRect(cx-r,cy-r,r*2,r*2);
    }
    ctx.restore();
  },

  // ── Teich-Shape: organische Form ─────────────────────────────────────────
  _drawPondShape(ctx, nx, ny, nw, nh, color, t, dpr, sel){
    ctx.save();
    // Unregelmäßige organische Form (kein Kreis/Oval)
    ctx.beginPath();
    const pts=8;
    for(let i=0;i<pts;i++){
      const a=i/pts*Math.PI*2-Math.PI/2;
      const wobble=0.85+0.15*Math.sin(i*2.3+1.5);
      const wave=0.03*Math.sin(t/1200+i*1.1);
      const rx2=nw/2*(wobble+wave);
      const ry2=nh/2*(wobble-wave*0.5);
      const x2=nx+Math.cos(a)*rx2, y2=ny+Math.sin(a)*ry2;
      i===0?ctx.moveTo(x2,y2):ctx.lineTo(x2,y2);
    }
    ctx.closePath();
    // Dunkelgrünes Wasser
    const g=ctx.createRadialGradient(nx-nw*0.15,ny-nh*0.15,0,nx,ny,Math.max(nw,nh)*0.55);
    g.addColorStop(0,'rgba(20,120,80,0.9)');
    g.addColorStop(0.5,'rgba(12,85,55,0.85)');
    g.addColorStop(1,'rgba(5,50,35,0.8)');
    ctx.fillStyle=g; ctx.fill();
    ctx.strokeStyle=sel?"#00e5ff":"rgba(20,150,90,0.5)"; ctx.lineWidth=sel?2.5*dpr:1.5*dpr; ctx.stroke();
    // Seerosenblatt-Andeutungen
    ctx.fillStyle="rgba(30,140,60,0.4)";
    [[0.2,0.15],[-0.15,0.2],[0.1,-0.2]].forEach(([ox,oy])=>{
      ctx.beginPath(); ctx.arc(nx+ox*nw,ny+oy*nh,5*dpr,0,Math.PI*2); ctx.fill();
    });
    ctx.restore();
  },

  // ── Node zeichnen ─────────────────────────────────────────────────────────
  _drawNode(ctx, node, vals, card, W, H, dpr, t){
    const nt=this.NODE_TYPES[node.type]||this.NODE_TYPES.custom;
    const nx=node.x*W, ny=node.y*H;
    const nw=(node.w||nt.defaultW)*dpr, nh=(node.h||nt.defaultH)*dpr;
    const color=node.color||nt.color;
    const sel=this._selNode===node;

    const state=this._getNodeState(node,card);
    const isOn=state==="on"||state==="true";
    const isOff=state==="off"||state==="false";
    const val=this._getNodeVal(node,card);

    ctx.save();

    // Glow wenn aktiv
    if(isOn){ ctx.shadowColor=color; ctx.shadowBlur=14*dpr; }

    if(node.type==="pool"){
      this._drawPoolShape(ctx,nx,ny,nw,nh,color,t,dpr,sel);
    } else if(node.type==="pond"){
      this._drawPondShape(ctx,nx,ny,nw,nh,color,t,dpr,sel);
    } else if(node.type==="sensor_temp"||node.type==="sensor_ph"||node.type==="sensor_cl"){
      this._drawSensorNode(ctx,nx,ny,nw,color,val,nt.icon,sel,dpr);
    } else {
      // Standard-Kreis-Node
      const r=Math.min(nw,nh)/2;
      ctx.fillStyle="#0a1520";
      ctx.strokeStyle=sel?"#00e5ff":isOn?color:isOff?"#1c2535":"#334155";
      ctx.lineWidth=sel?2.5*dpr:1.5*dpr;
      ctx.beginPath(); ctx.arc(nx,ny,r,0,Math.PI*2); ctx.fill(); ctx.stroke();

      // Pulsring wenn AN
      if(isOn){
        const phase=(t/900)%1;
        ctx.globalAlpha=(1-phase)*0.35;
        ctx.strokeStyle=color; ctx.lineWidth=2*dpr;
        ctx.beginPath(); ctx.arc(nx,ny,r*(1+phase*0.6),0,Math.PI*2); ctx.stroke();
        ctx.globalAlpha=1;
      }

      // Icon
      ctx.font=`${Math.min(nw,nh)*0.35}px serif`;
      ctx.fillStyle=isOn?color:isOff?"#334155":"#94a3b8";
      ctx.textAlign="center"; ctx.fillText(nt.icon,nx,ny+Math.min(nw,nh)*0.13);
    }

    ctx.shadowBlur=0;

    // Wert-Anzeige
    if(val!==null){
      let display;
      if(node.type==="sensor_temp") display=`${(+val).toFixed(1)}\u00B0C`;
      else if(node.type==="sensor_ph") display=`pH ${(+val).toFixed(1)}`;
      else if(node.type==="sensor_cl") display=`${(+val).toFixed(2)}ppm`;
      else if(typeof val==="number") display=Math.abs(val)>=1000?`${(val/1000).toFixed(1)}kW`:`${val.toFixed(0)}W`;
      else display=String(val).slice(0,6);

      ctx.font=`bold ${7*dpr}px monospace`;
      ctx.fillStyle=isOn?color:"#94a3b8"; ctx.textAlign="center";
      ctx.fillText(display,nx,ny+(Math.min(nw,nh)/2+11)*dpr);
    }

    // Label
    ctx.font=`${6*dpr}px monospace`; ctx.fillStyle="#334155"; ctx.textAlign="center";
    ctx.fillText((node.label||nt.label).slice(0,16),nx,ny+(Math.min(nw,nh)/2+20)*dpr);

    // Resize-Handle
    if(this._editMode&&sel){
      ctx.fillStyle="#00e5ff"; ctx.strokeStyle="#fff"; ctx.lineWidth=1;
      ctx.beginPath(); ctx.arc(nx+Math.min(nw,nh)/2+2*dpr,ny+Math.min(nw,nh)/2+2*dpr,5*dpr,0,Math.PI*2);
      ctx.fill(); ctx.stroke();
    }

    ctx.restore();
  },

  _drawPoolShape(ctx, nx, ny, nw, nh, color, t, dpr, sel){
    const rx=nw/2, ry=nh/2;
    ctx.save();

    // ── Poolbecken: Draufsicht ────────────────────────────────────────────
    // Außenwand (Beton/Kachel - hellgrau)
    const wall=4*dpr;
    ctx.fillStyle="#1a2535";
    ctx.strokeStyle=sel?"#00e5ff":"#2a3a50";
    ctx.lineWidth=sel?2.5*dpr:1.5*dpr;
    ctx.beginPath(); ctx.ellipse(nx,ny,rx+wall,ry+wall,0,0,Math.PI*2); ctx.fill(); ctx.stroke();

    // ── Wasseroberfläche (animiert, Draufsicht) ───────────────────────────
    ctx.beginPath(); ctx.ellipse(nx,ny,rx,ry,0,0,Math.PI*2);

    // Wasserfarbe: blau-türkis Gradient wie echter Pool
    const waterGrad=ctx.createRadialGradient(nx-rx*0.25,ny-ry*0.25,0,nx,ny,Math.max(rx,ry));
    const shimmer=0.08*Math.sin(t/600);
    waterGrad.addColorStop(0,`rgba(32,178,210,${0.88+shimmer})`);
    waterGrad.addColorStop(0.45,`rgba(14,145,185,${0.82+shimmer})`);
    waterGrad.addColorStop(0.75,`rgba(8,120,160,${0.78})`);
    waterGrad.addColorStop(1,`rgba(5,90,130,${0.72})`);
    ctx.fillStyle=waterGrad; ctx.fill();

    // ── Kachelmuster (Bodenmuster sichtbar durch Wasser) ──────────────────
    ctx.save();
    ctx.beginPath(); ctx.ellipse(nx,ny,rx,ry,0,0,Math.PI*2); ctx.clip();
    const tileSize=12*dpr;
    ctx.strokeStyle="rgba(255,255,255,0.04)"; ctx.lineWidth=0.5;
    for(let tx=nx-rx;tx<nx+rx;tx+=tileSize){
      ctx.beginPath(); ctx.moveTo(tx,ny-ry); ctx.lineTo(tx,ny+ry); ctx.stroke();
    }
    for(let ty=ny-ry;ty<ny+ry;ty+=tileSize){
      ctx.beginPath(); ctx.moveTo(nx-rx,ty); ctx.lineTo(nx+rx,ty); ctx.stroke();
    }
    ctx.restore();

    // ── Licht-Caustics (Lichtbrechung auf Poolboden) ──────────────────────
    ctx.save();
    ctx.beginPath(); ctx.ellipse(nx,ny,rx*0.92,ry*0.92,0,0,Math.PI*2); ctx.clip();
    for(let i=0;i<5;i++){
      const cx2=nx+Math.sin(t/1500+i*1.26)*rx*0.5;
      const cy2=ny+Math.cos(t/1800+i*0.9)*ry*0.45;
      const cr=(8+4*Math.sin(t/400+i))*dpr;
      const cg=ctx.createRadialGradient(cx2,cy2,0,cx2,cy2,cr);
      cg.addColorStop(0,`rgba(200,240,255,${0.12+0.06*Math.sin(t/300+i)})`);
      cg.addColorStop(1,'rgba(200,240,255,0)');
      ctx.fillStyle=cg; ctx.fillRect(cx2-cr,cy2-cr,cr*2,cr*2);
    }
    ctx.restore();

    // ── Wellen-Reflexion (Oberfläche) ─────────────────────────────────────
    ctx.save();
    ctx.beginPath(); ctx.ellipse(nx,ny,rx,ry,0,0,Math.PI*2); ctx.clip();
    ctx.strokeStyle=`rgba(255,255,255,${0.1+0.05*Math.sin(t/350)})`; ctx.lineWidth=1*dpr;
    for(let i=0;i<4;i++){
      const wy=ny-ry*0.5+i*ry*0.3+Math.sin(t/600+i)*ry*0.04;
      const woff=Math.sin(t/500+i*1.2)*rx*0.08;
      const wlen=rx*(0.4+0.15*Math.sin(t/450+i));
      ctx.beginPath();
      ctx.moveTo(nx-wlen+woff,wy);
      ctx.bezierCurveTo(nx-wlen*0.3+woff,wy-2*dpr,nx+wlen*0.3+woff,wy+2*dpr,nx+wlen+woff,wy);
      ctx.stroke();
    }
    ctx.restore();

    // ── Lichtglanz oben links ─────────────────────────────────────────────
    ctx.save();
    ctx.beginPath(); ctx.ellipse(nx,ny,rx,ry,0,0,Math.PI*2); ctx.clip();
    const glanz=ctx.createRadialGradient(nx-rx*0.4,ny-ry*0.4,0,nx-rx*0.4,ny-ry*0.4,rx*0.6);
    glanz.addColorStop(0,`rgba(255,255,255,${0.18+0.06*Math.sin(t/800)})`);
    glanz.addColorStop(0.5,'rgba(255,255,255,0.04)');
    glanz.addColorStop(1,'rgba(255,255,255,0)');
    ctx.fillStyle=glanz; ctx.fillRect(nx-rx,ny-ry,rx*2,ry*2);
    ctx.restore();

    // ── Pool-Rand: Kachelstreifen ─────────────────────────────────────────
    ctx.strokeStyle="rgba(180,200,220,0.25)"; ctx.lineWidth=2.5*dpr;
    ctx.beginPath(); ctx.ellipse(nx,ny,rx-1*dpr,ry-1*dpr,0,0,Math.PI*2); ctx.stroke();

    ctx.restore();
  },

  _drawSensorNode(ctx, nx, ny, r, color, val, icon, sel, dpr){
    r=r/2;
    ctx.fillStyle="#0a1520";
    ctx.strokeStyle=sel?"#00e5ff":color;
    ctx.lineWidth=sel?2.5*dpr:1.5*dpr;
    ctx.beginPath(); ctx.roundRect(nx-r,ny-r*0.85,r*2,r*1.7,4*dpr); ctx.fill(); ctx.stroke();
    ctx.font=`${r*0.55}px serif`; ctx.fillStyle=color; ctx.textAlign="center";
    ctx.fillText(icon,nx,ny-r*0.05);
  },

  // ── Touch/Maus ────────────────────────────────────────────────────────────
  onTap(px, py, card){
    if(card._mode!=="pool")return false;
    const c=card._canvas; if(!c)return false;
    const W=c.width, H=c.height, dpr=window.devicePixelRatio||1;
    const x=px*dpr, y=py*dpr;
    const hit=this._hitNode(x,y,W,H,dpr);
    if(hit){
      this._selNode=this._selNode===hit?null:hit;
      card._rebuildSidebar?.(); card._markDirty?.(); return true;
    }
    if(this._selNode){ this._selNode=null; card._rebuildSidebar?.(); card._markDirty?.(); return true; }
    return false;
  },

  onDragStart(px, py, card){
    if(!this._editMode||card._mode!=="pool")return false;
    const c=card._canvas; if(!c)return false;
    const W=c.width, H=c.height, dpr=window.devicePixelRatio||1;
    const x=px*dpr, y=py*dpr;
    const hit=this._hitNode(x,y,W,H,dpr);
    if(!hit)return false;
    const nt=this.NODE_TYPES[hit.type]||this.NODE_TYPES.custom;
    const nw=(hit.w||nt.defaultW)*dpr, nh=(hit.h||nt.defaultH)*dpr;
    const nx=hit.x*W, ny=hit.y*H;
    if(Math.hypot(x-(nx+Math.min(nw,nh)/2+2*dpr),y-(ny+Math.min(nw,nh)/2+2*dpr))<8*dpr){
      this._resizeNode=hit; this._resizeStartX=px; this._resizeStartY=py;
      this._resizeStartW=hit.w||nt.defaultW; this._resizeStartH=hit.h||nt.defaultH;
      this._selNode=hit; return true;
    }
    this._dragNode=hit; this._selNode=hit;
    this._dragOffX=(px-hit.x*(c.width/dpr));
    this._dragOffY=(py-hit.y*(c.height/dpr));
    return true;
  },

  onDragMove(px, py, card){
    const c=card._canvas; if(!c)return;
    const dpr=window.devicePixelRatio||1, W=c.width/dpr, H=c.height/dpr;
    if(this._resizeNode){
      this._resizeNode.w=Math.max(30,this._resizeStartW+(px-this._resizeStartX));
      this._resizeNode.h=Math.max(20,this._resizeStartH+(py-this._resizeStartY));
      card._markDirty?.(); return;
    }
    if(this._dragNode){
      this._dragNode.x=Math.max(0.02,Math.min(0.98,(px-this._dragOffX)/W));
      this._dragNode.y=Math.max(0.04,Math.min(0.96,(py-this._dragOffY)/H));
      card._markDirty?.();
    }
  },

  onDragEnd(px, py, card){
    if(this._dragNode||this._resizeNode){ this._save(card); }
    this._dragNode=null; this._resizeNode=null;
  },

  _hitNode(x,y,W,H,dpr){
    return this._nodes.slice().reverse().find(node=>{
      const nt=this.NODE_TYPES[node.type]||this.NODE_TYPES.custom;
      const r=(Math.min(node.w||nt.defaultW,node.h||nt.defaultH)/2+6)*dpr;
      return Math.hypot(x-node.x*W,y-node.y*H)<r;
    })||null;
  },

  // ── SIDEBAR ───────────────────────────────────────────────────────────────
  buildSidebar(card){
    const wrap=document.createElement("div");
    wrap.style.cssText="padding:8px;display:flex;flex-direction:column;gap:5px;overflow-y:auto;max-height:100%";

    if(!this.isActive(card)){
      const cfg=card?._opts?.pool_cfg||{};
      const note=document.createElement("div");
      note.style.cssText="padding:10px;background:var(--surf2);border-radius:6px;font-size:8px;color:#445566;text-align:center";
      note.textContent=`Saison-Modus: Modul pausiert (${cfg.saison_from||4}.–${cfg.saison_to||10}. Monat)`;
      wrap.appendChild(note); return wrap;
    }

    // Mode-Buttons
    const modeRow=document.createElement("div"); modeRow.style.cssText="display:flex;gap:3px;margin-bottom:2px";
    const mk=(label,active,cb)=>{
      const b=document.createElement("button");
      b.style.cssText=`flex:1;padding:4px;border-radius:4px;border:1px solid ${active?"#0ea5e9":"#1c2535"};background:${active?"#0ea5e922":"var(--surf2)"};color:${active?"#0ea5e9":"#445566"};font-size:7px;cursor:pointer`;
      b.textContent=label; b.addEventListener("click",cb); return b;
    };
    modeRow.append(
      mk(this._editMode?"\uD83D\uDD13 EDIT":"\uD83D\uDD12 VIEW",this._editMode,()=>{this._editMode=!this._editMode;card._rebuildSidebar?.();card._markDirty?.();}),
      mk(this._simActive?"\uD83E\uDDEA SIM AN":"\uD83E\uDDEA Simulator",this._simActive,()=>{this._simActive=!this._simActive;if(!this._simActive)this._simStates={};card._rebuildSidebar?.();card._markDirty?.();})
    );
    wrap.appendChild(modeRow);

    if(this._simActive) this._buildSimPanel(wrap, card);

    // Status-Box
    const vals=this._getPoolVals(card);
    const sb=document.createElement("div");
    sb.style.cssText="background:var(--surf2);border-radius:5px;padding:5px 8px;border:1px solid #1c2535";
    const tempColor=vals.tempC<20?"#38bdf8":vals.tempC>28?"#ef4444":"#22c55e";
    sb.innerHTML=`<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:3px">
      <div><div style="font-size:6px;color:#445566">\uD83C\uDF21 Temp</div><div style="font-size:11px;font-weight:700;color:${tempColor}">${vals.tempC!=null?(+vals.tempC).toFixed(1)+"°C":"--"}</div></div>
      <div><div style="font-size:6px;color:#445566">pH</div><div style="font-size:11px;font-weight:700;color:${vals.phVal?'#a855f7':'#445566'}">${vals.phVal?(+vals.phVal).toFixed(1):"--"}</div></div>
      <div><div style="font-size:6px;color:#445566">\u26A1 Solar</div><div style="font-size:11px;font-weight:700;color:${vals.surplus>0?'#22c55e':'#445566'}">${(vals.surplus>=0?"+":"")+(vals.surplus||0).toFixed(0)}W</div></div>
    </div>`;
    wrap.appendChild(sb);

    // Tabs
    const tabs=[["nodes","\uD83D\uDEE0 Geräte"],["autos","\u25C6 Auto"],["cfg","\u2699 Konfig"]];
    const active=this._sidebarTab||"nodes";
    const tabBar=document.createElement("div"); tabBar.style.cssText="display:grid;grid-template-columns:repeat(3,1fr);gap:2px;margin-bottom:3px";
    tabs.forEach(([tid,label])=>{
      const btn=document.createElement("button"); const isA=active===tid;
      btn.style.cssText=`padding:4px;border-radius:3px;border:1px solid ${isA?"#0ea5e9":"#1c2535"};background:${isA?"#0ea5e922":"var(--surf2)"};color:${isA?"#0ea5e9":"#445566"};font-size:7px;cursor:pointer`;
      btn.textContent=label; btn.addEventListener("click",()=>{this._sidebarTab=tid;this._selNode=null;this._selAuto=null;card._rebuildSidebar?.();});
      tabBar.appendChild(btn);
    });
    wrap.appendChild(tabBar);

    if(this._selNode&&active==="nodes"){wrap.appendChild(this._buildNodeEditor(card));return wrap;}
    if(this._selAuto&&active==="autos"){wrap.appendChild(this._buildAutoEditor(card));return wrap;}

    if(active==="nodes")  this._buildTabNodes(wrap,card);
    if(active==="autos")  this._buildTabAutos(wrap,card,vals);
    if(active==="cfg")    this._buildTabConfig(wrap,card);
    return wrap;
  },

  // ── Simulator-Panel ───────────────────────────────────────────────────────
  _buildSimPanel(wrap, card){
    const box=document.createElement("div");
    box.style.cssText="background:#0ea5e915;border:1px solid #0ea5e955;border-radius:5px;padding:6px;margin-bottom:3px";
    const hdr=document.createElement("div"); hdr.style.cssText="font-size:7.5px;font-weight:700;color:#0ea5e9;margin-bottom:5px";
    hdr.textContent="\uD83E\uDDEA POOL-SIMULATOR"; box.appendChild(hdr);

    const s=this._simVals;
    const mkSlider=(label,key,min,max,step,unit,decimals=0)=>{
      const row=document.createElement("div"); row.style.cssText="margin-bottom:4px";
      const top=document.createElement("div"); top.style.cssText="display:flex;justify-content:space-between;font-size:7px;color:#0ea5e988;margin-bottom:1px";
      const valSpan=document.createElement("span"); valSpan.textContent=`${(+s[key]).toFixed(decimals)}${unit}`;
      top.innerHTML=`<span>${label}</span>`; top.appendChild(valSpan);
      const sl=document.createElement("input"); sl.type="range"; sl.min=min; sl.max=max; sl.step=step; sl.value=s[key];
      sl.style.cssText="width:100%;accent-color:#0ea5e9;height:14px";
      sl.addEventListener("input",()=>{s[key]=parseFloat(sl.value);valSpan.textContent=`${(+s[key]).toFixed(decimals)}${unit}`;this._runSimCycle(card);card._markDirty?.();});
      row.append(top,sl); return row;
    };
    box.appendChild(mkSlider("Wassertemperatur","tempC",5,35,0.5,"°C",1));
    box.appendChild(mkSlider("Solar","solarW",0,3000,10,"W"));
    box.appendChild(mkSlider("Verbrauch","loadW",0,2000,10,"W"));
    box.appendChild(mkSlider("pH-Wert","phVal",6.0,8.5,0.1,"",1));
    box.appendChild(mkSlider("Chlor","chlorPpm",0,5,0.1,"ppm",1));

    // Surplus-Anzeige
    const surplus=s.solarW-s.loadW;
    const info=document.createElement("div");
    info.style.cssText=`font-size:7.5px;font-weight:700;color:${surplus>0?"#22c55e":"#ef4444"};text-align:center;margin-top:3px`;
    info.textContent=`\u00DCberschuss: ${surplus>=0?"+":""}${surplus}W`;
    box.appendChild(info);

    // Entity-States aus Automationen anzeigen
    const entityMap={};
    this._autos.filter(a=>a.enabled!==false).forEach(auto=>{
      (auto.conditions||[]).filter(c=>c.entity).forEach(c=>{entityMap[c.entity]={type:"cond",auto:auto.name};});
      [...(auto.actions||[]),(auto.actions_else||[])].forEach(a=>{if(a.entity)entityMap[a.entity]={type:"action",auto:auto.name};});
    });
    const entities=Object.entries(entityMap);
    if(entities.length){
      const eh=document.createElement("div"); eh.style.cssText="display:flex;align-items:center;justify-content:space-between;margin-top:5px;margin-bottom:3px";
      const et=document.createElement("span"); et.style.cssText="font-size:7px;font-weight:700;color:#0ea5e9"; et.textContent=`\uD83D\uDCA1 Entity-Simulation (${entities.length})`;
      const rb=document.createElement("button"); rb.style.cssText="padding:1px 6px;border-radius:3px;border:1px solid #ef444466;background:transparent;color:#ef4444;font-size:6.5px;cursor:pointer"; rb.textContent="\u21BB Reset";
      rb.addEventListener("click",()=>{this._simStates={};card._rebuildSidebar?.();card._markDirty?.();});
      eh.append(et,rb); box.appendChild(eh);

      entities.forEach(([eid,info])=>{
        const realState=card._hass?.states?.[eid]?.state||"?";
        const simState=this._simStates[eid];
        const curState=simState??realState;
        const isOn=curState==="on";
        const isSimulated=eid in this._simStates;
        const row=document.createElement("div");
        row.style.cssText=`display:flex;align-items:center;gap:5px;padding:3px 5px;border-radius:4px;margin-bottom:2px;border:1px solid ${isSimulated?"#0ea5e944":"#1c2535"};background:${isSimulated?"#0ea5e908":"var(--surf2)"}`;
        const nameEl=document.createElement("div"); nameEl.style.cssText="flex:1;min-width:0;font-size:7px;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap";
        nameEl.textContent=eid.split(".").pop(); nameEl.title=eid;
        const realBadge=document.createElement("span"); realBadge.style.cssText="font-size:6px;color:#334155;padding:1px 4px;border:1px solid #1c2535;border-radius:3px;flex-shrink:0";
        realBadge.textContent=`HA:${realState}`;
        const toggleBtn=document.createElement("button");
        toggleBtn.style.cssText=`padding:2px 7px;border-radius:3px;border:1px solid ${isOn?"#22c55e":"#445566"};background:${isOn?"#22c55e22":"var(--surf2)"};color:${isOn?"#22c55e":"#445566"};font-size:7px;cursor:pointer;flex-shrink:0`;
        toggleBtn.textContent=isOn?"AN":"AUS";
        toggleBtn.addEventListener("click",()=>{this._simStates[eid]=isOn?"off":"on";this._runSimCycle(card);card._rebuildSidebar?.();card._markDirty?.();});
        row.append(nameEl,realBadge,toggleBtn);
        if(isSimulated){
          const xBtn=document.createElement("button"); xBtn.style.cssText="padding:1px 4px;border-radius:3px;border:1px solid #445566;background:transparent;color:#445566;font-size:7px;cursor:pointer";
          xBtn.textContent="\u00D7"; xBtn.addEventListener("click",()=>{delete this._simStates[eid];card._rebuildSidebar?.();card._markDirty?.();});
          row.appendChild(xBtn);
        }
        box.appendChild(row);
      });
    }
    wrap.appendChild(box);
  },

  // ── Tab: Geräte ───────────────────────────────────────────────────────────
  _buildTabNodes(wrap, card){
    const hdr=document.createElement("div"); hdr.style.cssText="font-size:7.5px;font-weight:700;color:#94a3b8;margin-top:3px;margin-bottom:4px"; hdr.textContent="GERÄT HINZUFÜGEN";
    wrap.appendChild(hdr);
    const grid=document.createElement("div"); grid.style.cssText="display:grid;grid-template-columns:1fr 1fr;gap:3px";
    Object.entries(this.NODE_TYPES).forEach(([type,def])=>{
      const btn=document.createElement("button");
      btn.style.cssText="padding:4px;border-radius:4px;border:1px solid #1c2535;background:var(--surf2);color:var(--text);font-size:7.5px;cursor:pointer;text-align:left;display:flex;align-items:center;gap:4px";
      btn.innerHTML=`<span style="font-size:11px">${def.icon}</span><span>${def.label}</span>`;
      btn.addEventListener("click",()=>{
        const n={id:type+"_"+Date.now(),type,label:def.label,entity:"",x:0.25+Math.random()*0.5,y:0.25+Math.random()*0.5,w:def.defaultW,h:def.defaultH,color:def.color};
        this._nodes.push(n); this._selNode=n; this._save(card); card._rebuildSidebar?.(); card._markDirty?.();
      });
      grid.appendChild(btn);
    });
    wrap.appendChild(grid);

    if(this._nodes.length){
      const lh=document.createElement("div"); lh.style.cssText="font-size:7px;font-weight:700;color:#94a3b8;margin-top:6px;margin-bottom:3px"; lh.textContent=`PLATZIERT (${this._nodes.length})`;
      wrap.appendChild(lh);
      this._nodes.forEach(node=>{
        const nt=this.NODE_TYPES[node.type]||this.NODE_TYPES.custom;
        const row=document.createElement("div");
        row.style.cssText=`display:flex;align-items:center;gap:5px;padding:4px 6px;border-radius:4px;border:1px solid ${this._selNode===node?"#0ea5e944":"#1c2535"};background:${this._selNode===node?"#0ea5e908":"var(--surf2)"};cursor:pointer;margin-bottom:2px`;
        row.innerHTML=`<span style="font-size:11px">${nt.icon}</span><div style="flex:1;min-width:0"><div style="font-size:8px;font-weight:700;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${node.label}</div><div style="font-size:6px;color:#445566">${node.entity||"keine Entity"}</div></div>`;
        row.addEventListener("click",()=>{this._selNode=this._selNode===node?null:node;card._rebuildSidebar?.();card._markDirty?.();});
        wrap.appendChild(row);
      });
    }
  },

  // ── Node-Editor ───────────────────────────────────────────────────────────
  _buildNodeEditor(card){
    const node=this._selNode;
    const nt=this.NODE_TYPES[node.type]||this.NODE_TYPES.custom;
    const div=document.createElement("div"); div.style.cssText="display:flex;flex-direction:column;gap:5px";

    const hdr=document.createElement("div"); hdr.style.cssText="display:flex;align-items:center;gap:6px";
    hdr.innerHTML=`<span style="font-size:15px">${nt.icon}</span><span style="font-size:9px;font-weight:700;color:${node.color||nt.color}">${nt.label}</span>`;
    const back=document.createElement("button"); back.style.cssText="margin-left:auto;padding:2px 8px;border-radius:4px;border:1px solid var(--border);background:var(--surf2);color:var(--text);font-size:8px;cursor:pointer"; back.textContent="\u2190";
    back.addEventListener("click",()=>{this._selNode=null;card._rebuildSidebar?.();});
    hdr.appendChild(back); div.appendChild(hdr);

    const save=(k,v)=>{node[k]=v;this._save(card);card._markDirty?.();};
    div.appendChild(this._mkField("Label",node.label,v=>save("label",v)));

    // Entity-Picker
    const domains=node.type==="pump"||node.type==="heater"||node.type==="chlorinator"||node.type==="light"||node.type==="valve"||node.type==="sprinkler"||node.type==="powerstrip"
      ?["switch","input_boolean"]
      :["sensor","number","input_number"];
    div.appendChild(this._mkEntityPicker("Entity",node.entity,domains,v=>save("entity",v),card));

    const del=document.createElement("button");
    del.style.cssText="width:100%;padding:4px;border-radius:4px;border:1px solid #ef4444;background:transparent;color:#ef4444;font-size:8px;cursor:pointer;margin-top:4px";
    del.textContent="\uD83D\uDDD1 Löschen";
    del.addEventListener("click",()=>{this._nodes=this._nodes.filter(n=>n.id!==node.id);this._selNode=null;this._save(card);card._rebuildSidebar?.();});
    div.appendChild(del);
    return div;
  },

  // ── Tab: Automationen ─────────────────────────────────────────────────────
  _buildTabAutos(wrap, card, vals){
    const hdr=document.createElement("div"); hdr.style.cssText="display:flex;align-items:center;gap:5px;margin-top:3px";
    const t=document.createElement("div"); t.style.cssText="font-size:7.5px;font-weight:700;color:#94a3b8;flex:1"; t.textContent=`AUTOMATIONEN (${this._autos.length})`;
    const addBtn=document.createElement("button"); addBtn.style.cssText="padding:3px 8px;border-radius:4px;border:1px solid #22c55e;background:transparent;color:#22c55e;font-size:7.5px;cursor:pointer"; addBtn.textContent="+ Neu";
    addBtn.addEventListener("click",()=>{const na={id:"a"+Date.now(),name:"Neue Automation",enabled:true,conditions:[],operator:"AND",actions:[],actions_else:[],cooldown_min:5};this._autos.push(na);this._selAuto=na;this._save(card);card._rebuildSidebar?.();});
    hdr.append(t,addBtn); wrap.appendChild(hdr);

    this._autos.forEach(auto=>{
      const running=this._evalAuto(auto,vals,card);
      const row=document.createElement("div");
      row.style.cssText=`display:flex;align-items:center;gap:5px;padding:5px 6px;border-radius:5px;border:1px solid ${running?"#22c55e44":"#1c2535"};background:${running?"#22c55e0a":"var(--surf2)"};cursor:pointer;margin-bottom:2px`;
      const tog=document.createElement("input"); tog.type="checkbox"; tog.checked=auto.enabled!==false; tog.style.cssText="accent-color:#22c55e;width:12px;height:12px;cursor:pointer";
      tog.addEventListener("click",(e)=>{e.stopPropagation();auto.enabled=tog.checked;this._save(card);card._markDirty?.();});
      row.innerHTML=`<span style="font-size:10px">\u25C6</span><div style="flex:1;min-width:0"><div style="font-size:8px;font-weight:700;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${auto.name}</div><div style="font-size:6.5px;color:#445566">${auto.conditions?.length||0} Bed · ${auto.actions?.length||0} Akt</div></div><span style="font-size:8px;font-weight:700;color:${running?"#22c55e":"#445566"}">${running?"\u25B6":"\u25CF"}</span>`;
      row.insertBefore(tog,row.firstChild);
      row.addEventListener("click",()=>{this._selAuto=auto;card._rebuildSidebar?.();});
      wrap.appendChild(row);
    });

    // Log
    if(this._log.length){
      const lh=document.createElement("div"); lh.style.cssText="font-size:7px;font-weight:700;color:#94a3b8;margin-top:5px;margin-bottom:2px"; lh.textContent=`LOG (${this._log.length})`;
      wrap.appendChild(lh);
      this._log.slice(0,5).forEach(e=>{
        const r=document.createElement("div"); r.style.cssText="font-size:6.5px;color:#445566;padding:2px 0;border-bottom:1px solid #0d121933";
        const ts=new Date(e.ts); r.textContent=`${ts.getHours().toString().padStart(2,"0")}:${ts.getMinutes().toString().padStart(2,"0")}${e.sim?" [SIM]":""} · ${e.name}`;
        wrap.appendChild(r);
      });
    }
  },

  // ── Auto-Editor ───────────────────────────────────────────────────────────
  _buildAutoEditor(card){
    const auto=this._selAuto;
    const div=document.createElement("div"); div.style.cssText="display:flex;flex-direction:column;gap:4px";
    const hdr=document.createElement("div"); hdr.style.cssText="display:flex;align-items:center;gap:6px;margin-bottom:3px";
    hdr.innerHTML=`<span style="font-size:13px">\u25C6</span><span style="font-size:9px;font-weight:700;color:#22c55e">Automation</span>`;
    const back=document.createElement("button"); back.style.cssText="margin-left:auto;padding:2px 8px;border-radius:4px;border:1px solid var(--border);background:var(--surf2);color:var(--text);font-size:8px;cursor:pointer"; back.textContent="\u2190";
    back.addEventListener("click",()=>{this._selAuto=null;card._rebuildSidebar?.();});
    hdr.appendChild(back); div.appendChild(hdr);

    const save=(k,v)=>{auto[k]=v;this._save(card);card._markDirty?.();};
    div.appendChild(this._mkField("Name",auto.name,v=>save("name",v)));

    const COND={
      temp_gt:    {label:"Wassertemp. > °C", icon:"\uD83C\uDF21", grp:"pool"},
      temp_lt:    {label:"Wassertemp. < °C", icon:"\uD83C\uDF21", grp:"pool"},
      surplus_gt: {label:"Solar-Überschuss > W", icon:"\u26A1",   grp:"solar"},
      surplus_lt: {label:"Solar-Überschuss < W", icon:"\u26A1",   grp:"solar"},
      ph_gt:      {label:"pH > Wert",        icon:"\uD83D\uDDE3", grp:"pool"},
      ph_lt:      {label:"pH < Wert",        icon:"\uD83D\uDDE3", grp:"pool"},
      chlor_gt:   {label:"Chlor > ppm",      icon:"\uD83E\uDDEA", grp:"pool"},
      chlor_lt:   {label:"Chlor < ppm",      icon:"\uD83E\uDDEA", grp:"pool"},
      entity_on:  {label:"Entity AN",        icon:"\uD83D\uDCA1", grp:"entity"},
      entity_off: {label:"Entity AUS",       icon:"\uD83D\uDCA1", grp:"entity"},
      time_between:{label:"Uhrzeit zwischen",icon:"\uD83D\uDD50", grp:"zeit"},
    };
    const ACT={
      switch_on:       {label:"Schalter AN",       icon:"\u2705",   params:["entity"]},
      switch_off:      {label:"Schalter AUS",      icon:"\u274C",   params:["entity"]},
      switch_toggle:   {label:"Schalter Toggle",   icon:"\uD83D\uDD04",params:["entity"]},
      input_boolean_on: {label:"Input Boolean AN", icon:"\u2705",   params:["entity"]},
      input_boolean_off:{label:"Input Boolean AUS",icon:"\u274C",   params:["entity"]},
      notify:          {label:"Benachrichtigung",  icon:"\uD83D\uDD14",params:["message"]},
    };

    // Bedingungen
    const ch=document.createElement("div"); ch.style.cssText="font-size:7.5px;font-weight:700;color:#94a3b8;margin-top:3px"; ch.textContent="WENN"; div.appendChild(ch);
    if(!auto.conditions)auto.conditions=[];
    auto.conditions.forEach((c,ci)=>{
      const ct=COND[c.type]||{};
      const rb=document.createElement("div"); rb.style.cssText="background:var(--surf2);border-radius:4px;padding:5px;border:1px solid #0ea5e922;margin-bottom:3px";
      rb.innerHTML=`<div style="font-size:7.5px;font-weight:700;color:#0ea5e9;margin-bottom:3px">${ct.icon||""} ${ct.label||c.type}</div>`;
      if(c.type==="entity_on"||c.type==="entity_off"){
        rb.appendChild(this._mkEntityPicker("Entity",c.entity,["switch","input_boolean","sensor"],v=>{c.entity=v;this._save(card);},card));
      } else if(c.type==="time_between"){
        ["time_from","time_to"].forEach(k=>{
          const p=document.createElement("div");
          const pl=document.createElement("div"); pl.style.cssText="font-size:6.5px;color:#445566;margin-bottom:1px"; pl.textContent=k==="time_from"?"Von (HH:MM)":"Bis (HH:MM)";
          const pi=document.createElement("input"); pi.type="text"; pi.value=c[k]||""; pi.style.cssText="width:100%;padding:2px 5px;border-radius:3px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-size:7.5px";
          pi.addEventListener("input",()=>{c[k]=pi.value.trim();this._save(card);});
          p.append(pl,pi); rb.appendChild(p);
        });
      } else {
        const p=document.createElement("div");
        const pl=document.createElement("div"); pl.style.cssText="font-size:6.5px;color:#445566;margin-bottom:1px"; pl.textContent="Schwellwert";
        const pi=document.createElement("input"); pi.type="number"; pi.value=c.threshold||""; pi.step="0.1";
        pi.style.cssText="width:100%;padding:2px 5px;border-radius:3px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-size:7.5px";
        pi.addEventListener("input",()=>{c.threshold=parseFloat(pi.value)||0;this._save(card);});
        p.append(pl,pi); rb.appendChild(p);
      }
      const db=document.createElement("button"); db.style.cssText="width:100%;padding:2px;border-radius:3px;border:1px solid #ef444466;background:transparent;color:#ef4444;font-size:7px;cursor:pointer;margin-top:3px"; db.textContent="Entfernen";
      db.addEventListener("click",()=>{auto.conditions.splice(ci,1);this._save(card);card._rebuildSidebar?.();});
      rb.appendChild(db); div.appendChild(rb);
    });

    // Bedingung-Select gruppiert
    const cs=document.createElement("select"); cs.style.cssText="width:100%;padding:3px 5px;border-radius:4px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-size:7.5px;margin-bottom:4px";
    cs.appendChild(Object.assign(document.createElement("option"),{value:"",textContent:"+ Bedingung…"}));
    const grpDefs={pool:"\uD83C\uDFCA Pool-Werte",solar:"\u26A1 Solar",entity:"\uD83D\uDCA1 Entity",zeit:"\uD83D\uDD50 Zeit"};
    const grps={};
    Object.entries(grpDefs).forEach(([k,l])=>{const g=document.createElement("optgroup");g.label=l;grps[k]=g;});
    Object.entries(COND).forEach(([id,ct])=>{const o=document.createElement("option");o.value=id;o.textContent=`${ct.icon} ${ct.label}`;(grps[ct.grp]||grps.pool).appendChild(o);});
    Object.values(grps).forEach(g=>{if(g.children.length)cs.appendChild(g);});
    cs.addEventListener("change",()=>{if(!cs.value)return;auto.conditions.push({type:cs.value});cs.value="";this._save(card);card._rebuildSidebar?.();});
    div.appendChild(cs);

    // Aktionen
    const ah=document.createElement("div"); ah.style.cssText="font-size:7.5px;font-weight:700;color:#94a3b8;margin-top:2px"; ah.textContent="DANN"; div.appendChild(ah);
    if(!auto.actions)auto.actions=[];
    auto.actions.forEach((a,ai)=>{
      const at=ACT[a.type]||{};
      const rb=document.createElement("div"); rb.style.cssText="background:var(--surf2);border-radius:4px;padding:5px;border:1px solid #22c55e22;margin-bottom:3px";
      rb.innerHTML=`<div style="font-size:7.5px;font-weight:700;color:#22c55e;margin-bottom:3px">${at.icon||""} ${at.label||a.type}</div>`;
      (at.params||[]).forEach(param=>{
        if(param==="entity") rb.appendChild(this._mkEntityPicker("Entity",a.entity,["switch","input_boolean"],v=>{a.entity=v;this._save(card);},card));
        else {
          const p=document.createElement("div");
          const pl=document.createElement("div"); pl.style.cssText="font-size:6.5px;color:#445566;margin-bottom:1px"; pl.textContent="Nachricht";
          const pi=document.createElement("input"); pi.type="text"; pi.value=a[param]||""; pi.style.cssText="width:100%;padding:2px 5px;border-radius:3px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-size:7.5px";
          pi.addEventListener("input",()=>{a[param]=pi.value;this._save(card);});
          p.append(pl,pi); rb.appendChild(p);
        }
      });
      const db=document.createElement("button"); db.style.cssText="width:100%;padding:2px;border-radius:3px;border:1px solid #ef444466;background:transparent;color:#ef4444;font-size:7px;cursor:pointer;margin-top:3px"; db.textContent="Entfernen";
      db.addEventListener("click",()=>{auto.actions.splice(ai,1);this._save(card);card._rebuildSidebar?.();});
      rb.appendChild(db); div.appendChild(rb);
    });
    const as=document.createElement("select"); as.style.cssText="width:100%;padding:3px 5px;border-radius:4px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-size:7.5px;margin-bottom:4px";
    as.appendChild(Object.assign(document.createElement("option"),{value:"",textContent:"+ Aktion…"}));
    Object.entries(ACT).forEach(([id,at])=>{const o=document.createElement("option");o.value=id;o.textContent=`${at.icon} ${at.label}`;as.appendChild(o);});
    as.addEventListener("change",()=>{if(!as.value)return;auto.actions.push({type:as.value});as.value="";this._save(card);card._rebuildSidebar?.();});
    div.appendChild(as);

    const del=document.createElement("button"); del.style.cssText="width:100%;padding:4px;border-radius:4px;border:1px solid #ef4444;background:transparent;color:#ef4444;font-size:8px;cursor:pointer;margin-top:2px"; del.textContent="\uD83D\uDDD1 Löschen";
    del.addEventListener("click",()=>{this._autos=this._autos.filter(a=>a.id!==auto.id);this._selAuto=null;this._save(card);card._rebuildSidebar?.();});
    div.appendChild(del);
    return div;
  },

  // ── Tab: Konfiguration ────────────────────────────────────────────────────
  _buildTabConfig(wrap, card){
    const cfg=card?._opts?.pool_cfg||{};
    const save=(k,v)=>{if(!card._opts)card._opts={};if(!card._opts.pool_cfg)card._opts.pool_cfg={};card._opts.pool_cfg[k]=v;card._saveOptions?.();};
    const mkF=(label,key,ph)=>{
      const row=document.createElement("div");
      const lbl=document.createElement("div"); lbl.style.cssText="font-size:7px;color:#445566;margin-bottom:2px"; lbl.textContent=label;
      const inp=document.createElement("input"); inp.type="text"; inp.value=cfg[key]||""; inp.placeholder=ph;
      inp.style.cssText="width:100%;padding:3px 6px;border-radius:4px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-size:7.5px";
      inp.addEventListener("input",()=>save(key,inp.value.trim()));
      row.append(lbl,inp); return row;
    };
    const box=(title)=>{const b=document.createElement("div");b.style.cssText="background:var(--surf2);border-radius:5px;padding:7px;border:1px solid #1c2535;margin-bottom:5px";const h=document.createElement("div");h.style.cssText="font-size:7.5px;font-weight:700;color:#94a3b8;margin-bottom:5px";h.textContent=title;b.appendChild(h);return b;};

    const hdr=document.createElement("div"); hdr.style.cssText="font-size:8px;font-weight:700;color:#0ea5e9;margin-top:3px;margin-bottom:4px"; hdr.textContent="\u2699 POOL-ENTITIES"; wrap.appendChild(hdr);

    const pumpenBox=box("\uD83C\uDFCA Pumpen & Steuerung");
    [["\uD83D\uDD0C Pool-Pumpe","pool_pump","switch.pool_pumpe"],
     ["\uD83D\uDD25 Heizung","pool_heat","switch.pool_heizung"],
     ["\uD83D\uDCA1 Beleuchtung","pool_light","switch.pool_licht"],
     ["\u2697 Chlorinator","pool_chlor","switch.chlorinator"],
     ["\uD83D\uDEB0 Ventil","pool_valve","switch.pool_ventil"],
    ].forEach(a=>pumpenBox.appendChild(mkF(...a)));
    wrap.appendChild(pumpenBox);

    const sensorBox=box("\uD83D\uDCCA Sensoren");
    [["\uD83C\uDF21 Wassertemperatur","pool_temp","sensor.pool_temperatur"],
     ["\uD83D\uDDE3 pH-Sensor","ph_sensor","sensor.pool_ph"],
     ["\uD83E\uDDEA Chlor-Sensor","chlor_sensor","sensor.pool_chlor"],
     ["\u26A1 Solar-Leistung","solar_power","sensor.solar_w"],
     ["\uD83C\uDFE0 Verbrauch","load_power","sensor.verbrauch_w"],
    ].forEach(a=>sensorBox.appendChild(mkF(...a)));
    wrap.appendChild(sensorBox);

    const bewBox=box("\uD83C\uDF27 Bewässerung (optional)");
    [["\uD83D\uDEB0 Sprinkler Zone 1","irrigat_1","switch.sprinkler_zone1"],
     ["\uD83D\uDEB0 Sprinkler Zone 2","irrigat_2","switch.sprinkler_zone2"],
     ["\uD83D\uDEB0 Sprinkler Zone 3","irrigat_3","switch.sprinkler_zone3"],
    ].forEach(a=>bewBox.appendChild(mkF(...a)));
    wrap.appendChild(bewBox);

    // Saison-Modus
    const sBox=box("\uD83D\uDCC5 Saison-Modus");
    const sCb=document.createElement("input"); sCb.type="checkbox"; sCb.checked=!!cfg.saison_active; sCb.style.cssText="accent-color:#0ea5e9;width:13px;height:13px";
    sCb.addEventListener("change",()=>save("saison_active",sCb.checked));
    const sRow=document.createElement("div"); sRow.style.cssText="display:flex;align-items:center;gap:6px;margin-bottom:4px";
    const sLbl=document.createElement("span"); sLbl.style.cssText="font-size:8px;color:#94a3b8"; sLbl.textContent="Modul zeitlich begrenzen";
    sRow.append(sCb,sLbl); sBox.appendChild(sRow);
    const mRow=document.createElement("div"); mRow.style.cssText="display:flex;align-items:center;gap:6px";
    ["saison_from","saison_to"].forEach((key,i)=>{
      const l=document.createElement("span"); l.style.cssText="font-size:8px;color:#94a3b8"; l.textContent=i===0?"Von:":"Bis:";
      const sel=document.createElement("select"); sel.style.cssText="padding:2px 4px;border-radius:4px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-size:8px";
      ["Jan","Feb","Mär","Apr","Mai","Jun","Jul","Aug","Sep","Okt","Nov","Dez"].forEach((m,mi)=>{const o=document.createElement("option");o.value=mi+1;o.textContent=m;if((parseInt(cfg[key])||(i===0?4:10))===mi+1)o.selected=true;sel.appendChild(o);});
      sel.addEventListener("change",()=>save(key,parseInt(sel.value)));
      mRow.append(l,sel);
    });
    sBox.appendChild(mRow); wrap.appendChild(sBox);
  },

  // ── Helpers ───────────────────────────────────────────────────────────────
  _mkField(label,value,onChange){
    const row=document.createElement("div");
    const lbl=document.createElement("div"); lbl.style.cssText="font-size:7px;color:#445566;margin-bottom:2px"; lbl.textContent=label;
    const inp=document.createElement("input"); inp.type="text"; inp.value=value||"";
    inp.style.cssText="width:100%;padding:3px 6px;border-radius:4px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-size:8px";
    inp.addEventListener("input",()=>onChange(inp.value));
    row.append(lbl,inp); return row;
  },

  _mkEntityPicker(label,value,domains,onChange,card){
    const wrap=document.createElement("div");
    const lbl=document.createElement("div"); lbl.style.cssText="font-size:7px;color:#445566;margin-bottom:2px"; lbl.textContent=label;
    const row=document.createElement("div"); row.style.cssText="display:flex;gap:3px";
    const inp=document.createElement("input"); inp.type="text"; inp.value=value||""; inp.placeholder=`${(domains||[]).join("/")} Entity`;
    inp.style.cssText="flex:1;padding:3px 5px;border-radius:4px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-size:7.5px";
    inp.addEventListener("input",()=>onChange(inp.value.trim()));
    const pb=document.createElement("button"); pb.style.cssText="padding:3px 6px;border-radius:4px;border:1px solid #0ea5e9;background:transparent;color:#0ea5e9;font-size:8px;cursor:pointer"; pb.textContent="\uD83D\uDD0D";
    pb.addEventListener("click",()=>{
      const entities=Object.entries(card._hass?.states||{})
        .filter(([k])=>!domains||domains.some(d=>k.startsWith(d+".")))
        .map(([k,s])=>({id:k,name:s.attributes?.friendly_name||k,state:s.state}));
      const dl=document.createElement("div"); dl.style.cssText="position:fixed;z-index:9999;background:#0d1219;border:1px solid #334155;border-radius:6px;max-height:180px;overflow-y:auto;width:240px;box-shadow:0 4px 12px #000a";
      const si=document.createElement("input"); si.type="text"; si.placeholder="Suchen…"; si.style.cssText="width:100%;padding:4px 6px;border:none;border-bottom:1px solid #334155;background:transparent;color:var(--text);font-size:8px;box-sizing:border-box";
      dl.appendChild(si);
      const rl=f=>{dl.querySelectorAll(".pi").forEach(e=>e.remove());entities.filter(e=>!f||e.id.includes(f)||e.name.toLowerCase().includes(f.toLowerCase())).slice(0,40).forEach(e=>{const item=document.createElement("div");item.className="pi";item.style.cssText="padding:4px 8px;cursor:pointer;font-size:7.5px;border-bottom:1px solid #0d121966;display:flex;gap:6px";item.innerHTML=`<span style="color:#445566;font-size:6.5px;flex:1">${e.id}</span><span style="color:${e.state==="on"?"#22c55e":"#445566"};font-size:6.5px">${e.state}</span>`;item.addEventListener("click",()=>{inp.value=e.id;onChange(e.id);dl.remove();});dl.appendChild(item);});};
      si.addEventListener("input",()=>rl(si.value)); rl("");
      document.body.appendChild(dl);
      const rect=pb.getBoundingClientRect(); dl.style.top=(rect.bottom+4)+"px"; dl.style.left=Math.max(4,rect.left-80)+"px";
      const close=e=>{if(!dl.contains(e.target)&&e.target!==pb){dl.remove();document.removeEventListener("click",close);}};
      setTimeout(()=>document.addEventListener("click",close),100);
    });
    row.append(inp,pb); wrap.append(lbl,row); return wrap;
  },
};

if(typeof BLEModuleRegistry!=="undefined"){
  BLEModuleRegistry.register(PoolModul);
} else {
  window._BLE_MODULE_POOL=PoolModul;
}
