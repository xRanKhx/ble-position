// ═══════════════════════════════════════════════════════════════════════════
// BLE Positioning – Modul: ELEKTRO
// Version: 4.3.0
// Datei: /config/www/ble_positioning/modules/elektro.js
// Wird lazy per fetch() geladen – kein HA-Neustart bei Updates nötig
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
// ELEKTRO-MANAGEMENT MODUL v4.3.0
// Forecast-Panels v2 · Multi-Anlage · Mehrschicht-Balken · Sidebar-Editor
// Wetter-Canvas · Auto Wire-Werte · Forecast-Conditions
// ═══════════════════════════════════════════════════════════════════════════

const ElektroModul = {
  id:"elektro", name:"Elektro", icon:"\uD83D\uDD0C", tabId:"elektro", version: "4.4.5",
  description:"Baukasten \u00B7 Multi-Forecast \u00B7 Wetter \u00B7 Drag&Drop",

  // ── State ─────────────────────────────────────────────────────────────────
  _card:null, _systems:null, _activeSystem:0,
  _nodes:[], _wires:[], _autos:[],
  _haAutos:[], _haEntities:null,
  _history:[], _log:[], _lastAutoRun:{},
  _selNode:null, _selWire:null, _selAuto:null,
  _dragNode:null, _dragOffX:0, _dragOffY:0,
  _resizeNode:null, _resizeStartX:0, _resizeStartY:0, _resizeStartW:0, _resizeStartH:0,
  _connectFrom:null, _connectCursor:null,
  _editMode:true,
  _simActive:false, _simVals:{solarW:800,battPct:65,loadW:200,gridW:0},
  _simStates:{},
  _simAutoIdx:null,
  _simTime:0, _simSpeed:1,
  _sidebarTab:"nodes",
  _animT:0,

  // Forecast-Panels (Array für mehrere)
  // Panel: {id,name,x,y,w,h,visible,sources:[{name,color,fc_entities:{...},hist:[]}]}
  _fPanels:[],
  _selPanelId:null,    // aktiv editiertes Panel
  _panelDrag:null,     // {panelId,offX,offY}
  _panelResize:null,   // {panelId,startX,startY,startW,startH}

  // Wetter
  _weatherCache:null,
  _lastWeatherLoad:0,
  _lastForecastLoad:0,

  // ── Node-Typen ────────────────────────────────────────────────────────────
  NODE_TYPES:{
    solar:      {label:"Solar-Panel",     icon:"\u2600",  color:"#fbbf24",defaultW:60,defaultH:60},
    mppt:       {label:"MPPT Regler",     icon:"\u26A1",  color:"#f59e0b",defaultW:52,defaultH:52},
    battery:    {label:"Batterie",        icon:"\uD83D\uDD0B",color:"#22c55e",defaultW:70,defaultH:46},
    inverter:   {label:"Wechselrichter",  icon:"\uD83D\uDD0C",color:"#a855f7",defaultW:52,defaultH:52},
    house:      {label:"Haus/Verbraucher",icon:"\uD83C\uDFE0",color:"#d4a800",defaultW:60,defaultH:60},
    switch_node:{label:"Schalter",        icon:"\uD83D\uDCA1",color:"#38bdf8",defaultW:48,defaultH:48},
    meter:      {label:"Stromzaehler",    icon:"\uD83D\uDCCA",color:"#64748b",defaultW:52,defaultH:52},
    pool:       {label:"Pool-Pumpe",      icon:"\uD83C\uDFCA",color:"#0ea5e9",defaultW:48,defaultH:48},
    boiler:     {label:"Boiler",          icon:"\u2668",  color:"#ef4444",defaultW:48,defaultH:48},
    wallbox:    {label:"Wallbox",         icon:"\uD83D\uDE97",color:"#06b6d4",defaultW:48,defaultH:48},
    branch:     {label:"Abzweigung",      icon:"\u21D5",  color:"#94a3b8",defaultW:44,defaultH:44},
    custom:     {label:"Eigenes Geraet",  icon:"\u2699",  color:"#475569",defaultW:48,defaultH:48},
  },

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  init(card){
    this._card=card;
    this._lastWeatherLoad=0; // sicherstellen dass erster Aufruf sofort läuft
    // Wetter sofort laden ohne auf den ersten Poll zu warten
    setTimeout(()=>this._refreshData(card).catch(()=>{}), 800);
    this._systems=card._opts?.elektro_v4_systems||[{id:"sys1",name:"Wohnung",nodes:[],wires:[],autos:[],cfg:{}}];
    this._activeSystem=card._opts?.elektro_v4_active||0;
    this._loadSystem(card);
    this._log=card._opts?.elektro_log||[];
    this._history=[]; this._lastAutoRun={};
    this._haAutos=[]; this._haEntities=null;
    // Forecast-Panels laden
    this._fPanels=card._opts?.elektro_fPanels||[this._defaultPanel()];
    this._loadHaAutomations(card);
    if(!this._nodes.length) this._createDefaultLayout();
    console.info("[BLE Elektro v4.3] init");
  },
  destroy(){this._card=null;},

  _defaultPanel(){
    return {
      id:"fp_"+Date.now(),
      name:"Solar Forecast",
      x:0.02,y:0.02,w:0.96,h:0.20,
      visible:true,
      sources:[
        {id:"src_1",name:"Haupt-Anlage",color:"#fbbf24",
         fc_entities:{now_w:"",this_hour:"",next_hour:"",today:"",remaining:"",tomorrow:"",peak_today:"",peak_tomorrow:"",actual_w:"",battery_w:"",load_w:""}
        }
      ]
    };
  },

  _loadSystem(card){
    const sys=this._systems[this._activeSystem]||this._systems[0];
    if(!sys)return;
    this._nodes=sys.nodes||[]; this._wires=sys.wires||[]; this._autos=sys.autos||[];
    if(!card._opts)card._opts={};
    card._opts.elektro_v4_cfg=sys.cfg||{};
  },

  _saveSystem(card){
    const sys=this._systems[this._activeSystem];
    if(!sys)return;
    sys.nodes=this._nodes; sys.wires=this._wires; sys.autos=this._autos;
    sys.cfg=card._opts?.elektro_v4_cfg||{};
    if(!card._opts)card._opts={};
    card._opts.elektro_v4_systems=this._systems;
    card._opts.elektro_v4_active=this._activeSystem;
    card._opts.elektro_log=this._log.slice(0,50);
    card._opts.elektro_fPanels=this._fPanels;
    card._saveOptions?.();
  },

  _createDefaultLayout(){
    this._nodes=[
      {id:"solar1",type:"solar",   x:0.35,y:0.28,w:60,h:60,label:"Solar",   entity:"",sensorKey:"solar_power"},
      {id:"mppt1", type:"mppt",    x:0.35,y:0.48,w:52,h:52,label:"MPPT",    entity:"",sensorKey:""},
      {id:"batt1", type:"battery", x:0.18,y:0.70,w:70,h:46,label:"Batterie",entity:"",sensorKey:""},
      {id:"inv1",  type:"inverter",x:0.52,y:0.70,w:52,h:52,label:"WR",      entity:"",sensorKey:""},
      {id:"house1",type:"house",   x:0.72,y:0.70,w:65,h:65,label:"Haus",    entity:"",sensorKey:""},
    ];
    this._wires=[
      {id:"w1",from:"solar1",to:"mppt1", sensorKey:"",label:""},
      {id:"w2",from:"mppt1", to:"batt1", sensorKey:"",label:""},
      {id:"w3",from:"mppt1", to:"inv1",  sensorKey:"",label:""},
      {id:"w4",from:"inv1",  to:"house1",sensorKey:"",label:""},
    ];
  },

  // ── Wetter & Forecast laden ───────────────────────────────────────────────
  async _refreshData(card){
    const now=Date.now();
    if(now-this._lastWeatherLoad<300000)return;
    this._lastWeatherLoad=now;
    const cfg=card._opts?.elektro_v4_cfg||{};
    const hass=card._hass;
    if(!hass)return;

    // Wetter: Basisdaten aus State
    const weid=cfg.weather_entity;
    if(weid&&hass.states[weid]){
      const ws=hass.states[weid];
      this._weatherCache={
        condition:ws.state,
        temp:ws.attributes?.temperature,
        humidity:ws.attributes?.humidity,
        wind:ws.attributes?.wind_speed,
        forecast:[],
      };
      // Stündliche Forecast-Daten via WebSocket (HA 2023.9+)
      try{
        const r=await hass.callWS({
          type:'call_service',
          domain:'weather',
          service:'get_forecasts',
          service_data:{type:'hourly'},
          target:{entity_id:weid},
          return_response:true,
        });
        const fc=r?.response?.[weid]?.forecast||r?.[weid]?.forecast||[];
        if(fc.length>0){
          this._weatherCache.forecast=fc;
          console.info(`[BLE Elektro] Wetter-Forecast geladen: ${fc.length} Stunden`);
        }
      }catch(e){
        // Fallback: Forecast aus Attributen (ältere HA-Versionen)
        const attr=hass.states[weid]?.attributes?.forecast||[];
        if(attr.length>0)this._weatherCache.forecast=attr;
        console.warn('[BLE Elektro] weather.get_forecasts fehlgeschlagen, nutze Attribut-Fallback:',e.message);
      }
    }else if(weid){
      console.warn('[BLE Elektro] Weather-Entity nicht gefunden:',weid,'| Verfuegbar:',Object.keys(hass.states||{}).filter(k=>k.startsWith('weather.')).join(', '));
    }

    // Forecast-Entities pro Source aktualisieren
    this._fPanels.forEach(panel=>{
      (panel.sources||[]).forEach(src=>{
        if(!src._cache)src._cache={};
        const ef=src.fc_entities||{};
        ["now_w","this_hour","next_hour","today","remaining","tomorrow",
         "peak_today","peak_tomorrow","actual_w","battery_w","load_w"].forEach(k=>{
          if(ef[k]&&hass.states[ef[k]]){
            src._cache[k]=parseFloat(hass.states[ef[k]].state)||hass.states[ef[k]].state;
          }
        });
      });
    });
  },

  // ── Sonnenhöhe ────────────────────────────────────────────────────────────
  _getSun(){
    const h=new Date().getHours()+new Date().getMinutes()/60;
    const rise=6.0, set=20.5;
    if(h<rise||h>set)return{up:false,frac:0,alt:0};
    const frac=(h-rise)/(set-rise);
    return{up:true,frac,alt:Math.sin(frac*Math.PI)};
  },

  // Zufallshilfe
  _seed(s){let x=Math.sin(s)*10000;return x-Math.floor(x);},

  // ── Poll ──────────────────────────────────────────────────────────────────
  onPoll(data,card){
    if(this._simActive)this._simTime+=1000*this._simSpeed;
    if(!card?._hass)return;
    const vals=this._getVals(card);
    this._history.push({ts:Date.now(),...vals});
    if(this._history.length>360)this._history.shift();
    this._refreshData(card).catch(e=>console.warn("[BLE Elektro] _refreshData Fehler:",e));

    this._haAutos.forEach(a=>{
      if(a.entity_id&&card._hass.states[a.entity_id]){
        a.state=card._hass.states[a.entity_id].state;
        a.last_triggered=card._hass.states[a.entity_id].attributes?.last_triggered;
      }
    });
    const cfg=card._opts?.elektro_v4_cfg||{};
    this._autos.forEach(auto=>{
      if(auto.enabled===false)return;
      const met=this._evalAuto(auto,vals,card._hass,cfg);
      const now=Date.now(),cd=(auto.cooldown_min||5)*60000;
      const last=this._lastAutoRun[auto.id]||0;
      if(met&&now-last>cd){
        if(!this._simActive){this._runActions(auto.actions||[],card._hass,card);}else{this._runSimActions(auto.actions||[],card);}
        this._lastAutoRun[auto.id]=now; auto._lastState=true;
        this._log.unshift({ts:now,name:auto.name,sim:this._simActive,vals:{solarW:vals.solarW.toFixed(0),battPct:vals.battPct.toFixed(0)}});
        if(this._log.length>200)this._log.pop();
        card._showToast?.(`\u25C6 ${auto.name}${this._simActive?" [SIM]":""}`);
      }else if(!met&&auto._lastState){
        if(!this._simActive&&(auto.actions_else||[]).length&&now-last>cd){this._runActions(auto.actions_else,card._hass,card);}else if(this._simActive&&(auto.actions_else||[]).length){this._runSimActions(auto.actions_else,card);}
        auto._lastState=false;
      }
    });
  },

  async _loadHaAutomations(card){
    try{
      const raw=await card._hass.callApi("GET","config/automation/config");
      const arr=Array.isArray(raw)?raw:Object.values(raw||{});
      this._haAutos=arr.map(a=>({id:a.id||a.alias,alias:a.alias||"Automation",state:"unknown",entity_id:null,mode:a.mode||"single",last_triggered:null}));
      Object.entries(card._hass?.states||{}).filter(([k])=>k.startsWith("automation.")).forEach(([k,s])=>{
        const m=this._haAutos.find(a=>s.attributes?.friendly_name===a.alias||k.includes((a.alias||"").toLowerCase().replace(/\s/g,"_")));
        if(m){m.entity_id=k;m.state=s.state;m.last_triggered=s.attributes?.last_triggered;}
      });
    }catch(e){
      this._haAutos=Object.entries(card._hass?.states||{}).filter(([k])=>k.startsWith("automation."))
        .map(([k,s])=>({id:k,alias:s.attributes?.friendly_name||k.replace("automation.",""),entity_id:k,state:s.state,last_triggered:s.attributes?.last_triggered,mode:"single"}));
    }
  },

  _getEntities(card,domains){
    if(!this._haEntities){
      this._haEntities=Object.entries(card._hass?.states||{})
        .map(([k,s])=>({id:k,domain:k.split(".")[0],name:s.attributes?.friendly_name||k,state:s.state}));
    }
    return domains?this._haEntities.filter(e=>domains.includes(e.domain)):this._haEntities;
  },

  isActive(card){
    const cfg=card?._opts?.elektro_v4_cfg||{};
    if(!cfg.saison_active)return true;
    const mm=new Date().getMonth()+1,from=parseInt(cfg.saison_from||1),to=parseInt(cfg.saison_to||12);
    return from<=to?mm>=from&&mm<=to:mm>=from||mm<=to;
  },

  // ── Daten ─────────────────────────────────────────────────────────────────
  _getVals(card){
    if(this._simActive){
      const t=this._simTime/1000,s=this._simVals;
      return{solarW:s.solarW*(0.85+0.15*Math.sin(t*0.3)),battPct:Math.max(0,Math.min(100,s.battPct+Math.sin(t*0.1)*5)),
             battW:s.solarW>s.loadW?(s.solarW-s.loadW)*0.8:-(s.loadW-s.solarW)*0.5,
             loadW:s.loadW*(0.9+0.1*Math.sin(t*0.7)),acW:s.loadW*(0.9+0.1*Math.sin(t*0.7)),
             gridW:s.gridW,surplus:Math.max(0,s.solarW-s.loadW)};
    }
    const hass=card?._hass,cfg=card?._opts?.elektro_v4_cfg||{};
    const g=k=>{const e=cfg[k];if(!e)return 0;const s=hass?.states[e];return parseFloat(s?.state)||0;};
    const solarW=g("solar_power"),battPct=g("battery_soc"),battW=g("battery_power");
    const loadW=g("load_power"),acW=g("ac_out_power"),gridW=g("grid_power");
    return{solarW,battPct,battW,loadW,acW,gridW,surplus:Math.max(0,solarW-loadW)};
  },

  _getWireVal(wire,vals,card){
    const cfg=card?._opts?.elektro_v4_cfg||{},hass=card?._hass;
    if(wire.sensorKey){
      const m={solar_power:vals.solarW,battery_power:vals.battW,load_power:vals.loadW,ac_out_power:vals.acW,surplus:vals.surplus,grid_power:vals.gridW};
      if(wire.sensorKey in m)return m[wire.sensorKey];
      if(cfg[wire.sensorKey]&&hass?.states[cfg[wire.sensorKey]])return parseFloat(hass.states[cfg[wire.sensorKey]].state)||0;
    }
    const src=this._nodes.find(n=>n.id===wire.from);
    if(src?.entity&&hass?.states[src.entity])return parseFloat(hass.states[src.entity].state)||0;
    if(src?.sensorKey){const m={solar_power:vals.solarW,battery_power:vals.battW,load_power:vals.loadW,ac_out_power:vals.acW,surplus:vals.surplus};return m[src.sensorKey]||0;}
    return 0;
  },

  _getNodeVal(node,vals,card){
    const hass=card?._hass;
    if(node.entity&&hass?.states[node.entity])return parseFloat(hass.states[node.entity].state)||0;
    const k=node.sensorKey;
    if(!k)return null;
    const m={solar_power:vals.solarW,battery_soc:vals.battPct,battery_power:vals.battW,load_power:vals.loadW,ac_out_power:vals.acW,surplus:vals.surplus,grid_power:vals.gridW};
    return m[k]??null;
  },

  // ── DRAW ──────────────────────────────────────────────────────────────────
  onDraw(ctx,card){
    if(card._mode!=="elektro")return;
    const c=card._canvas;if(!c)return;
    const W=c.width,H=c.height,dpr=window.devicePixelRatio||1;
    this._animT=(this._animT||0)+16;
    const t=this._animT;
    const vals=this._getVals(card);

    ctx.fillStyle="#070a10"; ctx.fillRect(0,0,W,H);

    // Wetter-Szene im Hintergrund (über gesamtem Canvas)
    this._drawWeatherBg(ctx,W,H,dpr,t);

    // Gitter
    ctx.strokeStyle="#0d1829"; ctx.lineWidth=0.5;
    const gs=40*dpr;
    for(let x=0;x<W;x+=gs){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
    for(let y=0;y<H;y+=gs){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}

    if(!this.isActive(card)){ctx.font=`bold ${11*dpr}px monospace`;ctx.fillStyle="#334155";ctx.textAlign="center";ctx.fillText("Saison-Modus: pausiert",W/2,H/2);return;}

    // Sim-Overlay
    if(this._simActive){
      ctx.fillStyle="rgba(245,158,11,0.05)"; ctx.fillRect(0,0,W,H);
      ctx.font=`bold ${8*dpr}px monospace`; ctx.fillStyle="#f59e0b66"; ctx.textAlign="right";
      ctx.fillText(`SIM \u25B6 x${this._simSpeed}`,W-8*dpr,H-8*dpr);
    }

    // Forecast-Panels (Hintergrund-Layer zuerst)
    this._fPanels.filter(p=>p.visible).forEach(p=>this._drawForecastPanel(ctx,p,W,H,dpr,t,card));

    // Power-Skala
    this._drawPowerScale(ctx,vals,W,H,dpr);

    // Leitungen
    this._wires.forEach(w=>this._drawWire(ctx,w,vals,card,W,H,dpr,t));

    // Connecting-Vorschau
    if(this._connectFrom&&this._connectCursor){
      const n=this._nodes.find(n=>n.id===this._connectFrom);
      if(n){ctx.beginPath();ctx.moveTo(n.x*W,n.y*H);ctx.lineTo(this._connectCursor.x,this._connectCursor.y);ctx.strokeStyle="#38bdf8aa";ctx.lineWidth=2*dpr;ctx.setLineDash([6*dpr,4*dpr]);ctx.stroke();ctx.setLineDash([]);}
    }

    // Nodes
    this._nodes.forEach(n=>this._drawNode(ctx,n,vals,card,W,H,dpr,t));

    // Edit-Hinweis
    if(this._editMode){ctx.font=`${6*dpr}px monospace`;ctx.fillStyle="#38bdf855";ctx.textAlign="left";ctx.fillText("BEARBEITUNGSMODUS",8*dpr,H-8*dpr);}

    // Status-Bar
    const runCount=this._autos.filter(a=>a.enabled!==false&&this._evalAuto(a,vals,card._hass,card._opts?.elektro_v4_cfg||{})).length;
    ctx.fillStyle="rgba(7,10,16,0.92)"; ctx.fillRect(0,0,W,20*dpr);
    ctx.font=`${6.5*dpr}px 'JetBrains Mono',monospace`; ctx.fillStyle="#445566"; ctx.textAlign="left";
    ctx.fillText(`\u2600${vals.solarW.toFixed(0)}W  \uD83D\uDD0B${vals.battPct.toFixed(0)}%  \u26A1+${vals.surplus.toFixed(0)}W  \u25C6${runCount}/${this._autos.length}  \uD83C\uDFE0${this._haAutos.filter(a=>a.state==="on").length}/${this._haAutos.length} HA`,10*dpr,13*dpr);
  },

  // ── Wetter-Hintergrund (vereinfacht für Performance) ──────────────────────
  _drawWeatherBg(ctx,W,H,dpr,t){
    const wc=this._weatherCache;
    const h=new Date().getHours()+new Date().getMinutes()/60;
    const rise=6.0,set=20.5;
    const isNight=h<rise||h>set;
    const dayFrac=isNight?0:Math.max(0,Math.min(1,(h-rise)/(set-rise)));
    const sunAlt=Math.sin(dayFrac*Math.PI);
    const cond=wc?.condition||"";

    if(isNight){
      // Sterne
      for(let i=0;i<50;i++){
        const sx=this._seed(i*3.7)*W,sy=this._seed(i*5.3)*H*0.5;
        const twinkle=0.25+0.75*Math.abs(Math.sin(t/700+i*2.1));
        ctx.globalAlpha=twinkle*0.7;ctx.fillStyle="#dce8ff";
        ctx.beginPath();ctx.arc(sx,sy,this._seed(i*7.1)*1.2*dpr+0.4*dpr,0,Math.PI*2);ctx.fill();
      }
      ctx.globalAlpha=1;
      // Mond
      ctx.save();ctx.shadowColor="#c8d8e8";ctx.shadowBlur=18*dpr;
      ctx.fillStyle="#cddae8";ctx.beginPath();ctx.arc(W*0.78,H*0.07,12*dpr,0,Math.PI*2);ctx.fill();
      ctx.fillStyle="#060a10";ctx.beginPath();ctx.arc(W*0.78+5*dpr,H*0.07,10*dpr,0,Math.PI*2);ctx.fill();
      ctx.shadowBlur=0;ctx.restore();
    } else if(sunAlt>0){
      // Sonne
      const sx=W*(0.05+dayFrac*0.9),sy=H*(0.52-sunAlt*0.42);
      const obscured=cond.includes("overcast")||cond.includes("rain");
      const intensity=sunAlt*(obscured?0.15:cond.includes("cloud")?0.5:1.0);
      ctx.save();
      if(!obscured&&intensity>0.1){
        // Strahlen (rotierend)
        ctx.translate(sx,sy);ctx.rotate(t/5000);
        for(let i=0;i<12;i++){
          const ang=i/12*Math.PI*2;
          const len=(12+4*Math.sin(t/500+i))*dpr;
          ctx.strokeStyle=`rgba(251,191,36,${0.1*intensity})`;ctx.lineWidth=1.5*dpr;
          ctx.beginPath();ctx.moveTo(Math.cos(ang)*10*dpr,Math.sin(ang)*10*dpr);ctx.lineTo(Math.cos(ang)*(10+len)*dpr,Math.sin(ang)*(10+len)*dpr);ctx.stroke();
        }
        ctx.rotate(-t/5000);ctx.translate(-sx,-sy);
      }
      ctx.shadowColor="#fbbf24";ctx.shadowBlur=intensity>0.3?14*dpr:6*dpr;
      ctx.fillStyle=`rgba(255,215,60,${intensity})`;
      ctx.beginPath();ctx.arc(sx,sy,10*dpr,0,Math.PI*2);ctx.fill();
      ctx.shadowBlur=0;
      // Tagbogen
      ctx.strokeStyle=`rgba(251,191,36,${0.05*sunAlt})`;ctx.lineWidth=1.5*dpr;ctx.setLineDash([3*dpr,9*dpr]);
      ctx.beginPath();ctx.arc(W*0.5,H*0.58,W*0.43,Math.PI,0);ctx.stroke();ctx.setLineDash([]);
      ctx.restore();
    }

    // Wolken
    const nClouds=cond.includes("overcast")?5:cond.includes("rain")||cond.includes("shower")?4:cond.includes("cloud")?3:cond.includes("partly")?2:0;
    const CPOS=[{x:0.11,y:0.07,s:1.1,sp:0.6},{x:0.38,y:0.05,s:1.4,sp:0.4},{x:0.63,y:0.09,s:1.0,sp:0.7},{x:0.82,y:0.06,s:1.2,sp:0.5},{x:0.26,y:0.14,s:0.8,sp:0.9}];
    CPOS.slice(0,nClouds).forEach((cl,i)=>{
      const cx=(cl.x+Math.sin(t/9000+i*1.3)*0.03)*W,cy=cl.y*H,r=20*cl.s*dpr;
      const alpha=cond.includes("overcast")?0.5:0.35;
      ctx.save();ctx.fillStyle=`rgba(12,18,28,${alpha})`;
      ctx.beginPath();ctx.arc(cx,cy,r*0.85,0,Math.PI*2);ctx.arc(cx+r*0.7,cy-r*0.2,r*0.7,0,Math.PI*2);ctx.arc(cx-r*0.6,cy-r*0.15,r*0.65,0,Math.PI*2);ctx.arc(cx+r*1.3,cy+r*0.1,r*0.5,0,Math.PI*2);ctx.fill();ctx.restore();
    });

    // Regen
    if(cond.includes("rain")||cond.includes("shower")||cond.includes("drizzle")){
      ctx.save();
      for(let i=0;i<25;i++){
        const rx=this._seed(i*4.1)*W;
        const ry=((this._seed(i*6.7)+t*0.000055*(0.8+this._seed(i*2.3)*0.4))%1)*H;
        ctx.strokeStyle=`rgba(80,130,200,${0.12+this._seed(i*3.1)*0.12})`;ctx.lineWidth=0.8*dpr;
        ctx.beginPath();ctx.moveTo(rx,ry);ctx.lineTo(rx-2*dpr,ry+10*dpr);ctx.stroke();
      }
      ctx.restore();
    }

    // Nebel
    if(cond.includes("fog")||cond.includes("mist")){
      const fg=ctx.createLinearGradient(0,H*0.25,0,H*0.55);
      fg.addColorStop(0,"rgba(110,130,150,0)");fg.addColorStop(0.4,"rgba(110,130,150,0.1)");fg.addColorStop(0.6,"rgba(110,130,150,0.1)");fg.addColorStop(1,"rgba(110,130,150,0)");
      ctx.fillStyle=fg;ctx.fillRect(0,H*0.25,W,H*0.35);
    }

    // Wind-Linien
    const windSpeed=wc?.wind||0;
    if(cond.includes("wind")||windSpeed>15){
      ctx.save();const ws=Math.min(1,windSpeed/50);
      for(let i=0;i<4;i++){
        const wy=H*(0.07+i*0.035),wx=W*(0.55+Math.sin(t/900+i)*0.03);
        const len=W*(0.12+ws*0.08)*this._seed(i*4.3);
        const al=0.1*ws*(0.5+0.5*Math.sin(t/700+i*0.7));
        ctx.strokeStyle=`rgba(100,160,220,${al})`;ctx.lineWidth=(1+ws)*dpr;
        ctx.beginPath();ctx.moveTo(wx,wy);ctx.lineTo(wx+len,wy+2*dpr);ctx.stroke();
      }
      ctx.restore();
    }

    // Temperatur
    if(wc?.temp!=null){ctx.font=`bold ${9*dpr}px 'JetBrains Mono',monospace`;ctx.fillStyle="#334155";ctx.textAlign="right";ctx.fillText(`${wc.temp.toFixed(0)}\u00B0C`,W-8*dpr,32*dpr);}
  },

  // ── Forecast-Panel zeichnen ───────────────────────────────────────────────
  // NEU: _drawForecastPanel – Panorama (1 Anlage) oder Ost/West (mehrere)
_drawForecastPanel(ctx,panel,W,H,dpr,t,card){
  if(!panel.visible)return;
  const px=panel.x*W, py=panel.y*H, pw=panel.w*W, ph=panel.h*H;
  const isSelected=this._selPanelId===panel.id;
  const sources=panel.sources||[];
  const multiSource=sources.length>1;

  ctx.save();
  ctx.beginPath(); ctx.roundRect(px,py,pw,ph,6*dpr); ctx.clip();

  // Welcher Modus?
  if(multiSource){
    this._drawForecastOstWest(ctx,panel,px,py,pw,ph,dpr,t,card,sources);
  } else {
    this._drawForecastPanorama(ctx,panel,px,py,pw,ph,dpr,t,card,sources[0]||null);
  }

  ctx.restore();

  // Rahmen + Edit-Handles (außerhalb clip)
  ctx.save();
  ctx.strokeStyle=isSelected?`rgba(56,189,248,0.8)`:`rgba(255,255,255,0.06)`;
  ctx.lineWidth=isSelected?1.5*dpr:0.8*dpr;
  ctx.beginPath(); ctx.roundRect(px,py,pw,ph,6*dpr); ctx.stroke();

  if(this._editMode){
    // Drag-Handle
    ctx.fillStyle=`rgba(255,255,255,0.15)`;
    ctx.beginPath(); ctx.roundRect(px+pw/2-20*dpr,py+2*dpr,40*dpr,4*dpr,2); ctx.fill();
    // Resize-Handle
    ctx.fillStyle=isSelected?`#38bdf8`:`rgba(255,255,255,0.25)`;
    ctx.strokeStyle=`rgba(255,255,255,0.5)`; ctx.lineWidth=0.8;
    ctx.beginPath(); ctx.arc(px+pw-7*dpr,py+ph-7*dpr,5*dpr,0,Math.PI*2); ctx.fill(); ctx.stroke();
  }
  ctx.restore();
},

// ── PANORAMA (1 Anlage) ───────────────────────────────────────────────────
_drawForecastPanorama(ctx,panel,px,py,pw,ph,dpr,t,card,src){
  const hass=card?._hass;
  const wc=this._weatherCache;
  const fc=src?._cache||{};
  const hourlyFc=wc?.forecast||[];

  // Stunden 5..22 anzeigen
  const H0=5, H1=22, nHours=H1-H0+1;
  const sw=pw/nHours;
  const nowH=new Date().getHours()+new Date().getMinutes()/60;
  const barBase=py+ph-18*dpr;
  const barArea=ph*0.42;
  const maxKwh=0.95; // normiert auf kWh/h

  // Tages-Gesamtertrag für Gauss-Kurve
  const totalKwh=parseFloat(fc.today)||3;
  const peakH=this._parsePeakHour(fc.peak_today)||13;
  const gauss=(h)=>{const sig=3.2,norm=totalKwh/(sig*Math.sqrt(2*Math.PI));return Math.max(0,norm*Math.exp(-0.5*Math.pow((h-peakH)/sig,2)));};

  // ── HINTERGRUND: stündliche Wetter-Streifen ───────────────────────────
  for(let hi=0;hi<nHours;hi++){
    const h=H0+hi;
    const x=px+hi*sw;

    // Wetter-Daten für diese Stunde
    const fEntry=hourlyFc.find(f=>{
      if(!f.datetime)return false;
      return new Date(f.datetime).getHours()===h;
    });
    const cond=fEntry?.condition||this._condForHour(h,wc?.condition);
    const dayFrac=(h-6)/14;
    const sunAlt=(h>=6&&h<=20)?Math.max(0,Math.sin(Math.max(0,dayFrac)*Math.PI)):0;

    // Himmel-Farbe
    const skyCol=this._skyColor(h,cond,sunAlt);
    const skyGrad=ctx.createLinearGradient(x,py,x,py+ph*0.65);
    skyGrad.addColorStop(0,skyCol.top);
    skyGrad.addColorStop(1,skyCol.bot);
    ctx.fillStyle=skyGrad; ctx.fillRect(x,py,sw,ph*0.65);

    // Sonne oder Mond
    const syCx=x+sw/2, syCy=py+ph*0.16-sunAlt*ph*0.12;
    if(h>=6&&h<=20&&sunAlt>0.05){
      this._drawMiniSun(ctx,syCx,syCy,sw*0.28,cond,sunAlt,t,dpr);
    } else if(h<6||h>20){
      this._drawMiniMoon(ctx,x+sw*0.55,py+ph*0.12,sw*0.22);
    }

    // Wolken/Regen
    if(cond.includes('cloud')||cond.includes('overcast')){
      ctx.fillStyle=`rgba(30,45,65,${cond.includes('over')?0.65:0.45})`;
      const cy=py+ph*0.28;
      ctx.beginPath();
      ctx.arc(x+sw*0.35,cy,sw*0.22,0,Math.PI*2);
      ctx.arc(x+sw*0.6,cy-sw*0.08,sw*0.27,0,Math.PI*2);
      ctx.arc(x+sw*0.82,cy,sw*0.18,0,Math.PI*2);
      ctx.fill();
    }
    if(cond.includes('rain')||cond.includes('drizzle')||cond.includes('shower')){
      ctx.strokeStyle=`rgba(100,160,220,0.5)`;ctx.lineWidth=0.8*dpr;
      for(let ri=0;ri<4;ri++){
        const rx=x+sw*(0.2+ri*0.22);
        const ry=py+ph*0.38;
        ctx.beginPath();ctx.moveTo(rx,ry);ctx.lineTo(rx-1.5*dpr,ry+ph*0.12);ctx.stroke();
      }
    }
    if(cond.includes('snow')){
      ctx.fillStyle=`rgba(200,220,255,0.6)`;
      for(let si=0;si<3;si++){
        ctx.beginPath();ctx.arc(x+sw*(0.25+si*0.25),py+ph*0.42,1.5*dpr,0,Math.PI*2);ctx.fill();
      }
    }

    // Sterne nachts
    if(h<=6||h>=21){
      ctx.fillStyle=`rgba(200,215,255,0.5)`;
      [[0.2,0.08],[0.65,0.05],[0.85,0.15],[0.45,0.12]].forEach(([sx,sy])=>{
        ctx.beginPath();ctx.arc(x+sw*sx,py+ph*sy,0.8*dpr,0,Math.PI*2);ctx.fill();
      });
    }

    // Temperatur
    if(fEntry?.temperature!=null){
      ctx.font=`bold ${7*dpr}px sans-serif`;
      ctx.fillStyle=cond.includes('rain')?`rgba(130,170,220,0.9)`:`rgba(220,180,60,0.9)`;
      ctx.textAlign='center';
      ctx.fillText(`${Math.round(fEntry.temperature)}°`,x+sw/2,py+ph*0.46);
    }

    // Regen-Wahrscheinlichkeit als kleiner Balken am oberen Rand
    const precip=fEntry?.precipitation_probability||fEntry?.precipitation||0;
    if(precip>0){
      const pw2=(precip/100||precip)*sw*0.8;
      ctx.fillStyle=`rgba(80,140,220,0.4)`;
      ctx.fillRect(x+sw*0.1,py,pw2,3*dpr);
    }
  }

  // Fade → dunkle Zone für Balken
  const fadeGrad=ctx.createLinearGradient(0,py+ph*0.42,0,py+ph*0.6);
  fadeGrad.addColorStop(0,`rgba(4,6,14,0)`);
  fadeGrad.addColorStop(1,`rgba(4,6,14,0.97)`);
  ctx.fillStyle=fadeGrad; ctx.fillRect(px,py+ph*0.38,pw,ph*0.3);
  ctx.fillStyle=`rgba(4,6,12,0.97)`;
  ctx.fillRect(px,py+ph*0.62,pw,ph*0.38);

  // ── BALKEN & KURVEN ───────────────────────────────────────────────────
  const srcColor=src?.color||'#f59e0b';

  for(let hi=0;hi<nHours;hi++){
    const h=H0+hi;
    const bx=px+hi*sw+sw*0.08;
    const bw=sw*0.84;
    const isPast=h<nowH;
    const isCur=Math.abs(h-Math.floor(nowH))<1;

    const kwh=gauss(h);
    if(kwh<0.008)continue;
    const bh=(kwh/maxKwh)*barArea;

    // Solar-Balken
    const g=ctx.createLinearGradient(bx,barBase-bh,bx,barBase);
    const al=isPast?0.18:isCur?0.95:0.65;
    g.addColorStop(0,this._hexAlpha(srcColor,al));
    g.addColorStop(1,this._hexAlpha(srcColor,al*0.4));
    ctx.fillStyle=g;
    ctx.beginPath(); ctx.roundRect(bx,barBase-bh,bw,bh,2*dpr); ctx.fill();

    // Akku laden (grün, oben drauf)
    if(fc.battery_w&&!isPast){
      const battW=parseFloat(fc.battery_w)||0;
      if(battW>0){
        const bch=(battW/1000/maxKwh)*barArea*0.5;
        ctx.fillStyle=`rgba(34,197,94,0.55)`;
        ctx.beginPath(); ctx.roundRect(bx,barBase-bh-bch,bw,bch,1); ctx.fill();
      }
    }
    // Akku entladen (rot, unten)
    if(fc.battery_w&&!isPast){
      const battW=parseFloat(fc.battery_w)||0;
      if(battW<0){
        const bdh=(-battW/1000/maxKwh)*barArea*0.3;
        ctx.fillStyle=`rgba(239,68,68,0.45)`;
        ctx.beginPath(); ctx.roundRect(bx,barBase,bw*0.5,bdh,1); ctx.fill();
      }
    }
    // Verbrauch (blau, transparent)
    if(fc.load_w){
      const loadW=parseFloat(fc.load_w)||0;
      const lh=(loadW/1000/maxKwh)*barArea*0.35;
      ctx.fillStyle=`rgba(56,189,248,0.2)`;
      ctx.beginPath(); ctx.roundRect(bx+bw*0.5,barBase,bw*0.5,lh,1); ctx.fill();
    }
  }

  // ── Prognose-Kurve (Gauss, Anlagen-Farbe = gold) ─────────────────────
  ctx.beginPath(); let started=false;
  for(let h=H0;h<=H1;h+=0.15){
    const gx=px+(h-H0)/(nHours-1)*pw;
    const gy=barBase-(gauss(h)/maxKwh)*barArea;
    if(!started){ctx.moveTo(gx,gy);started=true;}else ctx.lineTo(gx,gy);
  }
  ctx.strokeStyle=srcColor; ctx.lineWidth=2*dpr; ctx.lineJoin='round'; ctx.stroke();

  // ── Ist-Verlaufskurve (grau, aus stündlichen HA-Daten / actual_w) ────
  // Baut eine Kurve aus vergangenen Stunden auf Basis actual_w + hourlyFc
  {
    const pastPoints=[];
    for(let h=H0;h<nowH&&h<=H1;h+=0.5){
      // Nutze stündlichen HA-Forecast als "gemessene" Basis (condition + echte Leistung)
      const fEntry=hourlyFc.find(f=>f.datetime&&Math.abs(new Date(f.datetime).getHours()-Math.floor(h))<1);
      let kwh=null;
      if(h>=nowH-0.6&&fc.actual_w){
        // Aktuelle Stunde: echter Messwert
        kwh=parseFloat(fc.actual_w)/1000;
      } else if(fEntry?.precipitation!=null){
        // Vergangene Stunden: schätze aus Gauss * Bewölkungskorrektur
        const cloudFactor=fEntry.cloud_coverage!=null?Math.max(0.1,1-fEntry.cloud_coverage/100):1;
        kwh=gauss(h)*cloudFactor;
      } else {
        kwh=gauss(h)*0.85; // default 85% der Prognose
      }
      if(kwh!=null)pastPoints.push({h,kwh});
    }
    if(pastPoints.length>1){
      ctx.beginPath();started=false;
      pastPoints.forEach(({h,kwh})=>{
        const gx=px+(h-H0)/(nHours-1)*pw;
        const gy=barBase-(Math.max(0,kwh)/maxKwh)*barArea;
        if(!started){ctx.moveTo(gx,gy);started=true;}else ctx.lineTo(gx,gy);
      });
      ctx.strokeStyle='rgba(148,163,184,0.7)'; // grau wie im Konzept
      ctx.lineWidth=1.5*dpr; ctx.lineJoin='round';
      ctx.setLineDash([4*dpr,3*dpr]); ctx.stroke(); ctx.setLineDash([]);
    }
  }

  // ── Ist-Punkt jetzt (grüner Kreis + Wattangabe) ───────────────────────
  if(fc.actual_w){
    const actualW=parseFloat(fc.actual_w)||0;
    const actualKwh=actualW/1000;
    const nowX=px+(nowH-H0)/(nHours-1)*pw;
    const nowY=barBase-(actualKwh/maxKwh)*barArea;
    ctx.save(); ctx.shadowColor='#22c55e'; ctx.shadowBlur=8*dpr;
    ctx.fillStyle='#22c55e'; ctx.strokeStyle='rgba(255,255,255,0.6)'; ctx.lineWidth=1.5*dpr;
    ctx.beginPath(); ctx.arc(nowX,nowY,5*dpr,0,Math.PI*2); ctx.fill(); ctx.stroke();
    ctx.restore();
    ctx.font=`bold ${7*dpr}px 'JetBrains Mono',monospace`;
    ctx.fillStyle='#22c55e'; ctx.textAlign='center';
    ctx.fillText(`${actualW.toFixed(0)}W`,nowX,nowY-8*dpr);
  }

  // Sonnenbogen
  ctx.beginPath(); started=false;
  for(let h=6;h<=20;h+=0.2){
    const frac=(h-6)/14;
    const alt=Math.sin(frac*Math.PI);
    const gx=px+(h-H0)/(nHours-1)*pw;
    const gy=py+ph*0.55-alt*ph*0.18;
    if(!started){ctx.moveTo(gx,gy);started=true;}else ctx.lineTo(gx,gy);
  }
  ctx.strokeStyle=`rgba(251,191,36,0.35)`;ctx.lineWidth=1.2*dpr;ctx.setLineDash([3*dpr,6*dpr]);ctx.stroke();ctx.setLineDash([]);

  // Aktuelle Sonne auf Bogen
  const sun=this._getSun();
  if(sun.up){
    const sX=px+(nowH-H0)/(nHours-1)*pw;
    const sY=py+ph*0.55-sun.alt*ph*0.18;
    ctx.save(); ctx.shadowColor='#fbbf24'; ctx.shadowBlur=10*dpr;
    ctx.fillStyle='#fbbf24';
    ctx.beginPath(); ctx.arc(sX,sY,4*dpr,0,Math.PI*2); ctx.fill();
    ctx.restore();
  }

  // Jetzt-Linie
  const nowX=px+(nowH-H0)/(nHours-1)*pw;
  ctx.strokeStyle=`rgba(255,255,255,0.25)`;ctx.lineWidth=1.5*dpr;ctx.setLineDash([3*dpr,4*dpr]);
  ctx.beginPath();ctx.moveTo(nowX,py);ctx.lineTo(nowX,barBase);ctx.stroke();ctx.setLineDash([]);
  ctx.font=`bold ${6.5*dpr}px sans-serif`;ctx.fillStyle=`rgba(255,255,255,0.4)`;ctx.textAlign='center';
  ctx.fillText('Jetzt',nowX,barBase+8*dpr);

  // Spitzenstunde-Marker
  if(peakH>=H0&&peakH<=H1){
    const pkX=px+(peakH-H0)/(nHours-1)*pw;
    const pkKwh=gauss(peakH);
    const pkY=barBase-(pkKwh/maxKwh)*barArea;
    ctx.fillStyle=srcColor; ctx.font=`${7*dpr}px sans-serif`; ctx.textAlign='center';
    ctx.fillText('★',pkX,pkY-7*dpr);
    ctx.fillStyle=`rgba(255,255,255,0.4)`; ctx.font=`${6*dpr}px monospace`;
    ctx.fillText(`${peakH}h`,pkX,pkY-14*dpr);
  }

  // Stunden-Labels
  for(let h=H0;h<=H1;h+=3){
    const gx=px+(h-H0)/(nHours-1)*pw;
    ctx.font=`${7*dpr}px monospace`; ctx.fillStyle=`rgba(60,75,110,0.9)`; ctx.textAlign='center';
    ctx.fillText(`${h}h`,gx,py+ph-5*dpr);
  }

  // Panel-Name + Kennwerte
  ctx.font=`bold ${7.5*dpr}px 'JetBrains Mono',monospace`; ctx.fillStyle=srcColor; ctx.textAlign='left';
  ctx.fillText(panel.name||'Solar Forecast',px+8*dpr,py+ph-5*dpr);
  if(fc.today){
    ctx.font=`${7*dpr}px monospace`; ctx.fillStyle=`rgba(251,191,36,0.8)`; ctx.textAlign='right';
    ctx.fillText(`Heute: ${parseFloat(fc.today).toFixed(1)}kWh`,px+pw-8*dpr,py+ph-12*dpr);
  }
  if(fc.tomorrow){
    ctx.font=`${7*dpr}px monospace`; ctx.fillStyle=`rgba(56,189,248,0.7)`; ctx.textAlign='right';
    ctx.fillText(`Morgen: ${parseFloat(fc.tomorrow).toFixed(1)}kWh`,px+pw-8*dpr,py+ph-4*dpr);
  }
},

// ── OST/WEST (mehrere Anlagen) ────────────────────────────────────────────
_drawForecastOstWest(ctx,panel,px,py,pw,ph,dpr,t,card,sources){
  const wc=this._weatherCache;
  const hourlyFc=wc?.forecast||[];
  const H0=5,H1=22,nHours=H1-H0+1;
  const sw=pw/nHours;
  const nowH=new Date().getHours()+new Date().getMinutes()/60;
  const barBase=py+ph-18*dpr;
  const barArea=ph*0.44;
  const maxKwh=0.6;

  // Gauss pro Source
  const gauss=(h,peak,total)=>{const sig=2.8,norm=total/(sig*Math.sqrt(2*Math.PI));return Math.max(0,norm*Math.exp(-0.5*Math.pow((h-peak)/sig,2)));};

  // ── Wetter-Hintergrund (wie Panorama) ────────────────────────────────
  for(let hi=0;hi<nHours;hi++){
    const h=H0+hi;
    const x=px+hi*sw;
    const fEntry=hourlyFc.find(f=>f.datetime&&new Date(f.datetime).getHours()===h);
    const cond=fEntry?.condition||this._condForHour(h,wc?.condition);
    const dayFrac=(h-6)/14;
    const sunAlt=(h>=6&&h<=20)?Math.max(0,Math.sin(Math.max(0,dayFrac)*Math.PI)):0;
    const skyCol=this._skyColor(h,cond,sunAlt);

    const g=ctx.createLinearGradient(x,py,x,py+ph*0.55);
    g.addColorStop(0,skyCol.top); g.addColorStop(1,skyCol.bot);
    ctx.fillStyle=g; ctx.fillRect(x,py,sw,ph*0.55);

    // Sonne/Mond mini
    if(h>=6&&h<=20&&sunAlt>0.05){
      this._drawMiniSun(ctx,x+sw/2,py+ph*0.14-sunAlt*ph*0.1,sw*0.22,cond,sunAlt,t,dpr);
    } else if(h<6||h>20){
      this._drawMiniMoon(ctx,x+sw*0.6,py+ph*0.1,sw*0.18);
    }

    // Wolken
    if(cond.includes('cloud')||cond.includes('overcast')||cond.includes('rain')){
      ctx.fillStyle=`rgba(25,38,55,${cond.includes('rain')?0.7:0.4})`;
      const cy=py+ph*0.25;
      ctx.beginPath();
      ctx.arc(x+sw*0.35,cy,sw*0.2,0,Math.PI*2);
      ctx.arc(x+sw*0.58,cy-sw*0.07,sw*0.24,0,Math.PI*2);
      ctx.arc(x+sw*0.78,cy,sw*0.17,0,Math.PI*2);
      ctx.fill();
    }
    if(cond.includes('rain')){
      ctx.strokeStyle=`rgba(100,155,215,0.45)`;ctx.lineWidth=0.7*dpr;
      for(let ri=0;ri<4;ri++){ctx.beginPath();ctx.moveTo(x+sw*(0.2+ri*0.2),py+ph*0.34);ctx.lineTo(x+sw*(0.18+ri*0.2)-1.5*dpr,py+ph*0.44);ctx.stroke();}
    }

    // Temperatur
    if(fEntry?.temperature!=null){
      ctx.font=`${6*dpr}px sans-serif`;
      ctx.fillStyle=`rgba(200,170,50,0.8)`; ctx.textAlign='center';
      ctx.fillText(`${Math.round(fEntry.temperature)}°`,x+sw/2,py+ph*0.43);
    }
  }

  // Fade + dunkle Balken-Zone
  const fadeG=ctx.createLinearGradient(0,py+ph*0.38,0,py+ph*0.56);
  fadeG.addColorStop(0,`rgba(4,6,14,0)`); fadeG.addColorStop(1,`rgba(4,6,14,0.97)`);
  ctx.fillStyle=fadeG; ctx.fillRect(px,py+ph*0.35,pw,ph*0.28);
  ctx.fillStyle=`rgba(4,6,12,0.97)`; ctx.fillRect(px,py+ph*0.6,pw,ph*0.4);

  // ── Balken pro Stunde: alle Sources gestapelt / nebeneinander ─────────
  const nSrc=sources.length;
  const bwGroup=sw*0.85;
  const bwSingle=bwGroup/nSrc;

  for(let hi=0;hi<nHours;hi++){
    const h=H0+hi;
    const isPast=h<nowH;
    const isCur=Math.abs(h-Math.floor(nowH))<1;

    sources.forEach((src,si)=>{
      const fc=src._cache||{};
      const totalKwh=parseFloat(fc.today)||2;
      const peakH=this._parsePeakHour(fc.peak_today)||13;
      const kwh=gauss(h,peakH,totalKwh);
      if(kwh<0.008)return;

      const bx=px+hi*sw+sw*0.075+si*bwSingle;
      const bh=(kwh/maxKwh)*barArea;
      const al=isPast?0.15:isCur?0.95:0.6;

      const g=ctx.createLinearGradient(bx,barBase-bh,bx,barBase);
      g.addColorStop(0,this._hexAlpha(src.color,al));
      g.addColorStop(1,this._hexAlpha(src.color,al*0.35));
      ctx.fillStyle=g;
      ctx.beginPath(); ctx.roundRect(bx,barBase-bh,bwSingle-1*dpr,bh,1.5*dpr); ctx.fill();
    });
  }

  // ── Kurven + Peak-Marker pro Source ──────────────────────────────────
  sources.forEach(src=>{
    const fc=src._cache||{};
    const totalKwh=parseFloat(fc.today)||2;
    const peakH=this._parsePeakHour(fc.peak_today)||13;

    // Kurve
    ctx.beginPath(); let started=false;
    for(let h=H0;h<=H1;h+=0.15){
      const kwh=gauss(h,peakH,totalKwh);
      const gx=px+(h-H0)/(nHours-1)*pw;
      const gy=barBase-(kwh/maxKwh)*barArea;
      if(!started){ctx.moveTo(gx,gy);started=true;}else ctx.lineTo(gx,gy);
    }
    ctx.strokeStyle=src.color; ctx.lineWidth=1.8*dpr; ctx.lineJoin='round'; ctx.stroke();

    // Peak-Punkt
    if(peakH>=H0&&peakH<=H1){
      const pkX=px+(peakH-H0)/(nHours-1)*pw;
      const pkKwh=gauss(peakH,peakH,totalKwh);
      const pkY=barBase-(pkKwh/maxKwh)*barArea;
      ctx.save(); ctx.shadowColor=src.color; ctx.shadowBlur=8*dpr;
      ctx.fillStyle=src.color; ctx.strokeStyle='rgba(255,255,255,0.5)'; ctx.lineWidth=1*dpr;
      ctx.beginPath(); ctx.arc(pkX,pkY,4*dpr,0,Math.PI*2); ctx.fill(); ctx.stroke();
      ctx.restore();
      ctx.font=`${6.5*dpr}px monospace`; ctx.fillStyle=src.color; ctx.textAlign='center';
      ctx.fillText(`${peakH}h`,pkX,pkY-8*dpr);
    }

    // Ist-Punkt
    if(fc.actual_w){
      const aW=parseFloat(fc.actual_w)||0;
      const aKwh=aW/1000;
      const aX=px+(nowH-H0)/(nHours-1)*pw;
      const aY=barBase-(aKwh/maxKwh)*barArea;
      ctx.save(); ctx.shadowColor=src.color; ctx.shadowBlur=6*dpr;
      ctx.fillStyle='#22c55e'; ctx.strokeStyle=src.color; ctx.lineWidth=1.5*dpr;
      ctx.beginPath(); ctx.arc(aX,aY,3.5*dpr,0,Math.PI*2); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
  });

  // Sonnenbogen
  ctx.beginPath(); let ss=false;
  for(let h=6;h<=20;h+=0.2){
    const frac=(h-6)/14,alt=Math.sin(frac*Math.PI);
    const gx=px+(h-H0)/(nHours-1)*pw;
    const gy=py+ph*0.52-alt*ph*0.16;
    if(!ss){ctx.moveTo(gx,gy);ss=true;}else ctx.lineTo(gx,gy);
  }
  ctx.strokeStyle=`rgba(251,191,36,0.3)`;ctx.lineWidth=1.2*dpr;ctx.setLineDash([3*dpr,6*dpr]);ctx.stroke();ctx.setLineDash([]);

  // Sonne jetzt
  const sun=this._getSun();
  if(sun.up){
    const sX=px+(nowH-H0)/(nHours-1)*pw;
    const sY=py+ph*0.52-sun.alt*ph*0.16;
    ctx.save(); ctx.shadowColor='#fbbf24'; ctx.shadowBlur=8*dpr;
    ctx.fillStyle='#fbbf24'; ctx.beginPath(); ctx.arc(sX,sY,3.5*dpr,0,Math.PI*2); ctx.fill();
    ctx.restore();
  }

  // Jetzt-Linie
  const nowX=px+(nowH-H0)/(nHours-1)*pw;
  ctx.strokeStyle=`rgba(255,255,255,0.22)`;ctx.lineWidth=1.5*dpr;ctx.setLineDash([3*dpr,4*dpr]);
  ctx.beginPath();ctx.moveTo(nowX,py);ctx.lineTo(nowX,barBase);ctx.stroke();ctx.setLineDash([]);

  // Stunden-Labels
  for(let h=H0;h<=H1;h+=3){
    const gx=px+(h-H0)/(nHours-1)*pw;
    ctx.font=`${7*dpr}px monospace`; ctx.fillStyle=`rgba(55,70,100,0.9)`; ctx.textAlign='center';
    ctx.fillText(`${h}h`,gx,py+ph-5*dpr);
  }

  // Legende + Gesamt
  let legendX=px+8*dpr;
  sources.forEach(src=>{
    const fc=src._cache||{};
    ctx.fillStyle=src.color; ctx.fillRect(legendX,py+ph-13*dpr,8*dpr,5*dpr);
    ctx.font=`${6.5*dpr}px monospace`; ctx.fillStyle=src.color; ctx.textAlign='left';
    const kwh=parseFloat(fc.today)||0;
    ctx.fillText(`${src.name}${kwh>0?' '+kwh.toFixed(1)+'kWh':''}`,legendX+10*dpr,py+ph-9*dpr);
    legendX+=60*dpr;
  });

  // Gesamt rechts
  const totalAll=sources.reduce((a,s)=>a+(parseFloat(s._cache?.today)||0),0);
  if(totalAll>0){
    ctx.font=`bold ${7.5*dpr}px monospace`; ctx.fillStyle=`rgba(251,191,36,0.85)`; ctx.textAlign='right';
    ctx.fillText(`Gesamt: ${totalAll.toFixed(1)} kWh`,px+pw-8*dpr,py+ph-5*dpr);
  }
},

// ── Hilfsmethoden ─────────────────────────────────────────────────────────
_skyColor(h,cond,sunAlt){
  if(h<5||h>21||!sunAlt)return{top:'#08091a',bot:'#0d1022'};
  const dawn=h<8||h>18;
  if(cond.includes('overcast')||cond.includes('rain'))return{top:`rgba(18,24,38,1)`,bot:`rgba(14,20,32,1)`};
  if(cond.includes('cloud'))return{top:`rgba(${20+sunAlt*30},${30+sunAlt*50},${50+sunAlt*80},1)`,bot:`rgba(12,18,30,1)`};
  if(dawn){
    const r=Math.round(30+sunAlt*120),g=Math.round(15+sunAlt*60),b=20;
    return{top:`rgba(${r},${g},${b},1)`,bot:`rgba(${r*0.4},${g*0.4},${b},1)`};
  }
  const r=Math.round(15+sunAlt*35),g=Math.round(50+sunAlt*80),b=Math.round(80+sunAlt*120);
  return{top:`rgba(${r},${g},${b},1)`,bot:`rgba(${r*0.5},${g*0.5},${b*0.5},1)`};
},

_condForHour(h,defaultCond){
  if(h<6||h>20)return'night';
  return defaultCond||'sunny';
},

_drawMiniSun(ctx,cx,cy,r,cond,alt,t,dpr){
  ctx.save();
  const intensity=alt*(cond.includes('cloud')?0.35:cond.includes('overcast')?0.15:0.9);
  if(intensity<0.05){ctx.restore();return;}
  const halo=ctx.createRadialGradient(cx,cy,0,cx,cy,r*2.5);
  halo.addColorStop(0,`rgba(255,210,60,${0.35*intensity})`);
  halo.addColorStop(1,`rgba(255,160,0,0)`);
  ctx.fillStyle=halo; ctx.fillRect(cx-r*3,cy-r*3,r*6,r*6);
  ctx.shadowColor='#fbbf24'; ctx.shadowBlur=r*2;
  ctx.fillStyle=`rgba(255,220,70,${intensity})`;
  ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.fill();
  ctx.shadowBlur=0; ctx.restore();
},

_drawMiniMoon(ctx,cx,cy,r){
  ctx.save();
  ctx.fillStyle='rgba(180,200,230,0.7)';
  ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='rgba(8,10,20,0.7)';
  ctx.beginPath(); ctx.arc(cx+r*0.45,cy-r*0.1,r*0.85,0,Math.PI*2); ctx.fill();
  ctx.restore();
},

_hexAlpha(hex,alpha){
  const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);
  return`rgba(${r},${g},${b},${alpha})`;
},

_parsePeakHour(val){
  if(!val)return 13;
  if(typeof val==='number')return val;
  if(typeof val==='string'){
    // ISO-Datetime: "2026-03-22T10:00:00+00:00" → lokale Stunde
    if(val.includes('T')){
      try{
        const d=new Date(val);
        if(!isNaN(d.getTime()))return d.getHours()+d.getMinutes()/60;
      }catch(e){}
    }
    // "10:30" → 10.5
    const m=val.match(/^(\d{1,2}):(\d{2})/);
    if(m)return parseInt(m[1])+parseInt(m[2])/60;
    // reine Zahl "13"
    const n=parseFloat(val);
    if(!isNaN(n)&&n>=0&&n<=24)return n;
  }
  return 13;
},

  _drawPowerScale(ctx,vals,W,H,dpr){
    const sx=8*dpr,sy=28*dpr,sw=22*dpr,sh=H-48*dpr;
    ctx.fillStyle="#0d1219";ctx.strokeStyle="#1c2535";ctx.lineWidth=1;
    ctx.beginPath();ctx.roundRect(sx,sy,sw,sh,4);ctx.fill();ctx.stroke();
    const total=Math.max(vals.solarW,1);
    const segs=[
      {label:"Ubers.",w:vals.surplus,color:"#fbbf24"},
      {label:"Akku",  w:Math.max(0,vals.battW),color:"#22c55e"},
      {label:"Last",  w:Math.max(0,vals.loadW-vals.surplus),color:"#38bdf8"},
      {label:"Rest",  w:Math.max(0,total-vals.surplus-Math.max(0,vals.battW)-Math.max(0,vals.loadW)),color:"#334155"},
    ].filter(s=>s.w>0);
    let yOff=0;
    segs.forEach(seg=>{
      const frac=Math.min(1,seg.w/total),segH=frac*sh;
      ctx.fillStyle=seg.color+"bb";ctx.beginPath();ctx.roundRect(sx+1,sy+yOff+1,sw-2,Math.max(2,segH-2),2);ctx.fill();
      if(segH>14*dpr){ctx.font=`${5.5*dpr}px monospace`;ctx.fillStyle=seg.color;ctx.textAlign="center";ctx.fillText(seg.label,sx+sw/2,sy+yOff+segH/2+2*dpr);if(segH>22*dpr){ctx.font=`bold ${5.5*dpr}px monospace`;ctx.fillText(`${seg.w.toFixed(0)}W`,sx+sw/2,sy+yOff+segH/2+10*dpr);}}
      yOff+=segH;
    });
    ctx.font=`${6*dpr}px monospace`;ctx.fillStyle="#f59e0b";ctx.textAlign="center";ctx.fillText(`${total.toFixed(0)}W`,sx+sw/2,sy-5*dpr);
  },

  // ── Node zeichnen ─────────────────────────────────────────────────────────
  _drawNode(ctx,node,vals,card,W,H,dpr,t){
    const nt=this.NODE_TYPES[node.type]||this.NODE_TYPES.custom;
    const nx=node.x*W,ny=node.y*H,nw=(node.w||nt.defaultW)*dpr,nh=(node.h||nt.defaultH)*dpr;
    const sel=this._selNode===node||this._connectFrom===node.id;
    const cv=this._getNodeVal(node,vals,card);
    const hass=card?._hass;
    const isOn=node.entity?hass?.states[node.entity]?.state==="on":(cv&&cv>10);
    const color=node.color||nt.color;
    ctx.save();
    if(isOn||node.type==="solar"&&vals.solarW>20){ctx.shadowColor=color;ctx.shadowBlur=12*dpr;}
    if(node.type==="battery")     this._drawBatteryNode(ctx,nx,ny,nw,nh,vals.battPct,sel,dpr);
    else if(node.type==="house")  this._drawHouseNode(ctx,nx,ny,nw,nh,color,isOn,sel,dpr);
    else if(node.type==="solar")  this._drawSolarNode(ctx,nx,ny,nw,nh,color,cv,isOn,sel,dpr,t);
    else{
      const r=Math.min(nw,nh)/2;
      ctx.fillStyle="#0d1219";ctx.strokeStyle=sel?"#00e5ff":isOn?color:"#1c2535";ctx.lineWidth=sel?2.5:1.5;
      ctx.beginPath();ctx.arc(nx,ny,r,0,Math.PI*2);ctx.fill();ctx.stroke();
      ctx.font=`${Math.min(nw,nh)*0.35}px serif`;ctx.fillStyle=isOn?color:"#94a3b8";ctx.textAlign="center";ctx.fillText(nt.icon,nx,ny+Math.min(nw,nh)*0.13);
    }
    ctx.shadowBlur=0;
    if(cv!==null){
      const display=node.sensorKey==="battery_soc"||node.type==="battery"?`${(cv||0).toFixed(0)}%`:(Math.abs(cv)>=1000?`${(cv/1000).toFixed(1)}kW`:`${cv.toFixed(0)}W`);
      ctx.font=`bold ${7*dpr}px monospace`;ctx.fillStyle=color;ctx.textAlign="center";ctx.fillText(display,nx,ny+(Math.min(nw,nh)/2+11)*dpr);
    }
    if(node.type==="switch_node"&&node.entity){
      const st=hass?.states[node.entity]?.state;
      ctx.font=`bold ${7*dpr}px monospace`;ctx.fillStyle=st==="on"?"#22c55e":"#ef4444";ctx.textAlign="center";ctx.fillText(st?.toUpperCase()||"?",nx,ny+(Math.min(nw,nh)/2+11)*dpr);
    }
    ctx.font=`${6*dpr}px monospace`;ctx.fillStyle="#334155";ctx.textAlign="center";ctx.fillText((node.label||nt.label).slice(0,16),nx,ny+(Math.min(nw,nh)/2+20)*dpr);
    if(this._editMode&&sel){ctx.fillStyle="#00e5ff";ctx.strokeStyle="#fff";ctx.lineWidth=1;ctx.beginPath();ctx.arc(nx+Math.min(nw,nh)/2+2*dpr,ny+Math.max(nw,nh)/2+2*dpr,5*dpr,0,Math.PI*2);ctx.fill();ctx.stroke();}
    if(this._connectFrom&&this._connectFrom!==node.id){ctx.strokeStyle="#38bdf855";ctx.lineWidth=2*dpr;ctx.beginPath();ctx.arc(nx,ny,Math.min(nw,nh)/2+4*dpr,0,Math.PI*2);ctx.stroke();}
    ctx.restore();
  },

  _drawSolarNode(ctx,nx,ny,nw,nh,color,cv,active,sel,dpr,t){
    ctx.save();const r=Math.min(nw,nh)/2;
    if(active){const phase=(t/1800)%1;[0,1,2].forEach(i=>{const rp=(phase+i/3)%1,rr=r*(1+rp*0.9),al=(1-rp)*0.3*Math.min(1,(cv||0)/2000);ctx.beginPath();ctx.arc(nx,ny,rr,0,Math.PI*2);ctx.strokeStyle=`rgba(251,191,36,${al})`;ctx.lineWidth=1.5;ctx.stroke();});}
    ctx.fillStyle="#0d1219";ctx.strokeStyle=sel?"#00e5ff":active?color:"#1c2535";ctx.lineWidth=sel?2.5:1.5;ctx.beginPath();ctx.arc(nx,ny,r,0,Math.PI*2);ctx.fill();ctx.stroke();
    const g=r*0.5;ctx.strokeStyle=active?color+"55":"#1c2535";ctx.lineWidth=0.8;
    for(let d=-1;d<=1;d++){ctx.beginPath();ctx.moveTo(nx+d*g,ny-g);ctx.lineTo(nx+d*g,ny+g);ctx.stroke();ctx.beginPath();ctx.moveTo(nx-g,ny+d*g);ctx.lineTo(nx+g,ny+d*g);ctx.stroke();}
    ctx.restore();
  },

  _drawBatteryNode(ctx,nx,ny,nw,nh,battPct,sel,dpr){
    ctx.save();const bc=battPct>60?"#22c55e":battPct>30?"#f59e0b":"#ef4444";
    ctx.fillStyle="#0d1219";ctx.strokeStyle=sel?"#00e5ff":bc;ctx.lineWidth=sel?2.5:1.5;ctx.beginPath();ctx.roundRect(nx-nw/2,ny-nh/2,nw,nh,4);ctx.fill();ctx.stroke();
    const fillW=(nw-4)*Math.min(1,(battPct||0)/100);ctx.fillStyle=bc+"55";ctx.beginPath();ctx.roundRect(nx-nw/2+2,ny-nh/2+2,fillW,nh-4,2);ctx.fill();
    ctx.fillStyle=bc;ctx.fillRect(nx+nw/2,ny-4*dpr,4*dpr,8*dpr);ctx.restore();
  },

  _drawHouseNode(ctx,nx,ny,nw,nh,color,active,sel,dpr){
    ctx.save();const s=Math.min(nw,nh)/2;ctx.fillStyle="#0d1219";ctx.strokeStyle=sel?"#00e5ff":active?color:"#1c2535";ctx.lineWidth=sel?2.5:1.5;
    ctx.beginPath();ctx.moveTo(nx,ny-s);ctx.lineTo(nx+s*0.8,ny-s*0.1);ctx.lineTo(nx+s*0.8,ny+s*0.8);ctx.lineTo(nx-s*0.8,ny+s*0.8);ctx.lineTo(nx-s*0.8,ny-s*0.1);ctx.closePath();ctx.fill();ctx.stroke();
    if(active){ctx.fillStyle=color+"33";ctx.beginPath();ctx.arc(nx,ny+s*0.2,s*0.25,0,Math.PI*2);ctx.fill();}ctx.restore();
  },

  // ── Leitung ───────────────────────────────────────────────────────────────
  _drawWire(ctx,wire,vals,card,W,H,dpr,t){
    const nA=this._nodes.find(n=>n.id===wire.from),nB=this._nodes.find(n=>n.id===wire.to);
    if(!nA||!nB)return;
    const ax=nA.x*W,ay=nA.y*H,bx=nB.x*W,by=nB.y*H;
    const watts=this._getWireVal(wire,vals,card);
    const nA_nt=this.NODE_TYPES[nA.type]||this.NODE_TYPES.custom;
    const color=wire.color||nA_nt.color||"#64748b";
    const active=Math.abs(watts)>5;
    const lw=Math.max(1.5,Math.min(10,Math.abs(watts)/80))*dpr;
    const dx=bx-ax,dy=by-ay;
    const cp1x=ax+dx*0.15,cp1y=ay+dy*0.45,cp2x=bx-dx*0.15,cp2y=by-dy*0.45;
    ctx.save();
    if(active){ctx.shadowColor=color;ctx.shadowBlur=Math.min(14,Math.abs(watts)/200*8)*dpr;}
    ctx.beginPath();ctx.moveTo(ax,ay);ctx.bezierCurveTo(cp1x,cp1y,cp2x,cp2y,bx,by);
    ctx.strokeStyle=active?color:"#1c2535";ctx.lineWidth=lw;ctx.lineCap="round";ctx.stroke();ctx.shadowBlur=0;
    if(this._selWire===wire){ctx.beginPath();ctx.moveTo(ax,ay);ctx.bezierCurveTo(cp1x,cp1y,cp2x,cp2y,bx,by);ctx.strokeStyle="#00e5ff55";ctx.lineWidth=lw+6;ctx.stroke();}
    if(active){
      const bez=u=>({x:Math.pow(1-u,3)*ax+3*Math.pow(1-u,2)*u*cp1x+3*(1-u)*u*u*cp2x+u*u*u*bx,y:Math.pow(1-u,3)*ay+3*Math.pow(1-u,2)*u*cp1y+3*(1-u)*u*u*cp2y+u*u*u*by});
      const speed=Math.min(3,Math.abs(watts)/200);const count=Math.max(2,Math.min(8,Math.floor(Math.abs(watts)/200)));
      for(let i=0;i<count;i++){const ph=((t/800*speed+i/count)%1);const p=bez(ph);ctx.globalAlpha=Math.sin(Math.PI*ph)*0.9;ctx.beginPath();ctx.arc(p.x,p.y,lw*0.85,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();}
      ctx.globalAlpha=1;
      const p1=bez(0.72),p2=bez(0.65);const ang=Math.atan2(p1.y-p2.y,p1.x-p2.x);const as=5*dpr;
      ctx.beginPath();ctx.moveTo(p1.x+Math.cos(ang)*as,p1.y+Math.sin(ang)*as);ctx.lineTo(p1.x+Math.cos(ang+2.5)*as*0.6,p1.y+Math.sin(ang+2.5)*as*0.6);ctx.lineTo(p1.x+Math.cos(ang-2.5)*as*0.6,p1.y+Math.sin(ang-2.5)*as*0.6);ctx.closePath();ctx.fillStyle=color;ctx.fill();
      const mid=bez(0.5);const lbl=Math.abs(watts)>=1000?`${(watts/1000).toFixed(1)}kW`:`${watts.toFixed(0)}W`;const lw2=lbl.length*5*dpr+6*dpr;
      ctx.fillStyle="rgba(7,10,16,0.88)";ctx.fillRect(mid.x-lw2/2,mid.y-8*dpr,lw2,10*dpr);
      ctx.font=`bold ${6.5*dpr}px monospace`;ctx.fillStyle=color;ctx.textAlign="center";ctx.fillText(lbl,mid.x,mid.y+1*dpr);
    }
    ctx.restore();
  },

  // ── Touch/Maus ────────────────────────────────────────────────────────────
  onTap(px,py,card){
    if(card._mode!=="elektro")return false;
    const c=card._canvas;if(!c)return false;
    const W=c.width,H=c.height,dpr=window.devicePixelRatio||1;
    const x=px*dpr,y=py*dpr;

    // Forecast-Panel antippen → selektieren
    if(this._editMode){
      for(const panel of this._fPanels){
        if(!panel.visible)continue;
        const ppx=panel.x*W,ppy=panel.y*H,ppw=panel.w*W,pph=panel.h*H;
        if(x>=ppx&&x<=ppx+ppw&&y>=ppy&&y<=ppy+pph){
          this._selPanelId=this._selPanelId===panel.id?null:panel.id;
          if(this._selPanelId){this._sidebarTab="forecast";} card._rebuildSidebar?.();card._markDirty?.();return true;
        }
      }
    }

    // Verbindungsmodus
    if(this._connectFrom){
      const hit=this._hitNode(x,y,W,H,dpr);
      if(hit&&hit.id!==this._connectFrom){
        this._wires.push({id:"w"+Date.now(),from:this._connectFrom,to:hit.id,sensorKey:"",label:""});
        this._connectFrom=null;this._connectCursor=null;this._saveSystem(card);card._rebuildSidebar?.();card._markDirty?.();card._showToast?.("Leitung verbunden!");return true;
      }
      this._connectFrom=null;this._connectCursor=null;card._markDirty?.();return true;
    }
    const hit=this._hitNode(x,y,W,H,dpr);
    if(hit){this._selNode=this._selNode===hit?null:hit;this._selWire=null;card._rebuildSidebar?.();card._markDirty?.();return true;}
    const hitW=this._hitWire(x,y,W,H,dpr);
    if(hitW){this._selWire=this._selWire===hitW?null:hitW;this._selNode=null;card._rebuildSidebar?.();card._markDirty?.();return true;}
    if(this._selNode||this._selWire||this._selPanelId){this._selNode=null;this._selWire=null;this._selPanelId=null;card._rebuildSidebar?.();card._markDirty?.();return true;}
    return false;
  },

  onDragStart(px,py,card){
    if(!this._editMode||card._mode!=="elektro")return false;
    const c=card._canvas;if(!c)return false;
    const W=c.width,H=c.height,dpr=window.devicePixelRatio||1;
    const x=px*dpr,y=py*dpr;

    // Forecast-Panel Drag/Resize
    for(const panel of this._fPanels){
      if(!panel.visible)continue;
      const ppx=panel.x*W,ppy=panel.y*H,ppw=panel.w*W,pph=panel.h*H;
      // Resize-Handle unten rechts
      if(Math.hypot(x-(ppx+ppw-8*dpr),y-(ppy+pph-8*dpr))<10*dpr){
        this._panelResize={panelId:panel.id,startX:px,startY:py,startW:panel.w,startH:panel.h};
        this._selPanelId=panel.id; card._rebuildSidebar?.(); return true;
      }
      // Drag-Handle (obere Leiste)
      if(x>=ppx+ppw/2-24*dpr&&x<=ppx+ppw/2+24*dpr&&y>=ppy&&y<=ppy+10*dpr){
        this._panelDrag={panelId:panel.id,offX:px-panel.x*(W/dpr),offY:py-panel.y*(H/dpr)};
        this._selPanelId=panel.id; card._rebuildSidebar?.(); return true;
      }
    }

    // Node Drag
    const hit=this._hitNode(x,y,W,H,dpr);
    if(!hit)return false;
    const nt=this.NODE_TYPES[hit.type]||this.NODE_TYPES.custom;
    const nw=(hit.w||nt.defaultW)*dpr,nh=(hit.h||nt.defaultH)*dpr;
    const nx=hit.x*W,ny=hit.y*H;
    if(Math.hypot(x-(nx+Math.min(nw,nh)/2+2*dpr),y-(ny+Math.max(nw,nh)/2+2*dpr))<8*dpr){
      this._resizeNode=hit;this._resizeStartX=px;this._resizeStartY=py;this._resizeStartW=hit.w||nt.defaultW;this._resizeStartH=hit.h||nt.defaultH;this._selNode=hit;return true;
    }
    this._dragNode=hit;this._selNode=hit;this._dragOffX=(px-hit.x*(c.width/dpr));this._dragOffY=(py-hit.y*(c.height/dpr));return true;
  },

  onDragMove(px,py,card){
    const c=card._canvas;if(!c)return;
    const dpr=window.devicePixelRatio||1,W=c.width/dpr,H=c.height/dpr;

    // Panel Resize
    if(this._panelResize){
      const panel=this._fPanels.find(p=>p.id===this._panelResize.panelId);
      if(panel){
        const dx=(px-this._panelResize.startX)/W,dy=(py-this._panelResize.startY)/H;
        panel.w=Math.max(0.15,Math.min(0.99,this._panelResize.startW+dx));
        panel.h=Math.max(0.05,Math.min(0.5, this._panelResize.startH+dy));
      }
      card._markDirty?.();return;
    }
    // Panel Drag
    if(this._panelDrag){
      const panel=this._fPanels.find(p=>p.id===this._panelDrag.panelId);
      if(panel){
        panel.x=Math.max(0,Math.min(0.85,px/W-this._panelDrag.offX/W));
        panel.y=Math.max(0,Math.min(0.85,py/H-this._panelDrag.offY/H));
      }
      card._markDirty?.();return;
    }
    // Node Resize/Drag
    if(this._resizeNode){const dx=px-this._resizeStartX,dy=py-this._resizeStartY;this._resizeNode.w=Math.max(30,this._resizeStartW+dx);this._resizeNode.h=Math.max(20,this._resizeStartH+dy);card._markDirty?.();return;}
    if(this._dragNode){
      this._dragNode.x=Math.max(0.02,Math.min(0.98,(px-this._dragOffX)/W));
      this._dragNode.y=Math.max(0.04,Math.min(0.96,(py-this._dragOffY)/H));
      if(this._connectFrom)this._connectCursor={x:px*dpr,y:py*dpr};
      card._markDirty?.();
    }
  },

  onDragEnd(px,py,card){
    if(this._panelDrag||this._panelResize){this._saveSystem(card);}
    this._panelDrag=null;this._panelResize=null;
    if(this._dragNode){this._saveSystem(card);this._dragNode=null;}
    if(this._resizeNode){this._saveSystem(card);this._resizeNode=null;}
  },

  _hitNode(x,y,W,H,dpr){return this._nodes.slice().reverse().find(node=>{const nt=this.NODE_TYPES[node.type]||this.NODE_TYPES.custom;const r=(Math.min(node.w||nt.defaultW,node.h||nt.defaultH)/2+4)*dpr;return Math.hypot(x-node.x*W,y-node.y*H)<r;})||null;},
  _hitWire(x,y,W,H,dpr){for(const wire of this._wires){const nA=this._nodes.find(n=>n.id===wire.from),nB=this._nodes.find(n=>n.id===wire.to);if(!nA||!nB)continue;const ax=nA.x*W,ay=nA.y*H,bx=nB.x*W,by=nB.y*H;const dx=bx-ax,dy=by-ay,len=Math.hypot(dx,dy);if(len<1)continue;const tt=Math.max(0,Math.min(1,((x-ax)*dx+(y-ay)*dy)/(len*len)));if(Math.hypot(x-(ax+tt*dx),y-(ay+tt*dy))<10*dpr)return wire;}return null;},

  _getSun(){const h=new Date().getHours()+new Date().getMinutes()/60;const rise=6,set=20.5;if(h<rise||h>set)return{up:false,frac:0,alt:0};const frac=(h-rise)/(set-rise);return{up:true,frac,alt:Math.sin(frac*Math.PI)};},
  _seed(s){let x=Math.sin(s)*10000;return x-Math.floor(x);},

  // ── Sidebar ───────────────────────────────────────────────────────────────
  buildSidebar(card){
    const wrap=document.createElement("div");
    wrap.style.cssText="padding:8px;display:flex;flex-direction:column;gap:5px;overflow-y:auto;max-height:100%";
    this._buildSystemSelector(wrap,card);

    // Mode-Buttons
    const modeRow=document.createElement("div");modeRow.style.cssText="display:flex;gap:3px;margin-bottom:2px";
    const mk=(label,active,cb)=>{const b=document.createElement("button");b.style.cssText=`flex:1;padding:4px;border-radius:4px;border:1px solid ${active?"#38bdf8":"#1c2535"};background:${active?"#38bdf822":"var(--surf2)"};color:${active?"#38bdf8":"#445566"};font-size:7px;cursor:pointer`;b.textContent=label;b.addEventListener("click",cb);return b;};
    modeRow.append(
      mk(this._editMode?"\uD83D\uDD13 EDIT":"\uD83D\uDD12 VIEW",this._editMode,()=>{this._editMode=!this._editMode;card._rebuildSidebar?.();card._markDirty?.();}),
      mk(this._simActive?"\uD83E\uDDEA SIM AN":"\uD83E\uDDEA Simulator",this._simActive,()=>{this._simActive=!this._simActive;if(this._simActive)this._simTime=0;card._rebuildSidebar?.();card._markDirty?.();})
    );
    wrap.appendChild(modeRow);
    if(this._simActive)this._buildSimControls(wrap,card);

    // Tabs (mit Forecast-Tab)
    const tabDefs=[["nodes","\uD83D\uDEE0 Elemente"],["wires","\u21C9 Leit."],["forecast","\u2600 Forecast"],["autos","\u25C6 Auto"],["ha","\uD83C\uDFE0 HA"],["ai","\uD83E\uDD16 KI"],["cfg","\u2699 Konfig"]];
    const active=this._sidebarTab||"nodes";
    const tabBar=document.createElement("div");tabBar.style.cssText="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;margin-bottom:3px";
    tabDefs.forEach(([tid,label])=>{
      const btn=document.createElement("button");const isA=active===tid;
      btn.style.cssText=`padding:3px 1px;border-radius:3px;border:1px solid ${isA?"#f59e0b":"#1c2535"};background:${isA?"#f59e0b22":"var(--surf2)"};color:${isA?"#f59e0b":"#445566"};font-size:5.5px;cursor:pointer`;
      btn.textContent=label;btn.addEventListener("click",()=>{this._sidebarTab=tid;if(tid!=="forecast")this._selPanelId=null;this._selNode=null;this._selWire=null;card._rebuildSidebar?.();});
      tabBar.appendChild(btn);
    });
    wrap.appendChild(tabBar);

    // Detail-Ansichten
    if(this._selNode&&(active==="nodes"||active==="wires")){wrap.appendChild(this._buildNodeEditor(card));return wrap;}
    if(this._selWire&&active==="wires"){wrap.appendChild(this._buildWireEditor(card));return wrap;}
    if(this._selAuto&&active==="autos"){wrap.appendChild(this._buildAutoEditor(card));return wrap;}

    // Status
    const vals=this._getVals(card);
    const bc=vals.battPct>60?"#22c55e":vals.battPct>30?"#f59e0b":"#ef4444";
    const sb=document.createElement("div");sb.style.cssText="background:var(--surf2);border-radius:5px;padding:5px 8px;border:1px solid #1c2535";
    sb.innerHTML=`<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:3px"><div><div style="font-size:6px;color:#445566">\u2600 Solar</div><div style="font-size:11px;font-weight:700;color:#fbbf24">${vals.solarW.toFixed(0)}W</div></div><div><div style="font-size:6px;color:#445566">\uD83D\uDD0B SOC</div><div style="font-size:11px;font-weight:700;color:${bc}">${vals.battPct.toFixed(0)}%</div></div><div><div style="font-size:6px;color:#445566">\u26A1 Ubs.</div><div style="font-size:11px;font-weight:700;color:${vals.surplus>0?"#22c55e":"#ef4444"}">${vals.surplus>=0?"+":""}${vals.surplus.toFixed(0)}W</div></div></div>`;
    wrap.appendChild(sb);

    if(active==="nodes")   this._buildTabNodes(wrap,card);
    if(active==="wires")   this._buildTabWires(wrap,card);
    if(active==="forecast")this._buildTabForecast(wrap,card);
    if(active==="autos")   this._buildTabAutos(wrap,card,vals);
    if(active==="ha")      this._buildTabHA(wrap,card);
    if(active==="ai")      this._buildTabAI(wrap,card,vals);
    if(active==="cfg")     this._buildTabConfig(wrap,card);
    return wrap;
  },

  // ── Tab: Forecast-Panels ──────────────────────────────────────────────────
  _buildTabForecast(wrap,card){
    const hdr=document.createElement("div");hdr.style.cssText="display:flex;align-items:center;gap:5px;margin-top:3px";
    const t=document.createElement("div");t.style.cssText="font-size:7.5px;font-weight:700;color:#fbbf24;flex:1";t.textContent=`\u2600 FORECAST-PANELS (${this._fPanels.length})`;
    const addBtn=document.createElement("button");addBtn.style.cssText="padding:3px 8px;border-radius:4px;border:1px solid #fbbf24;background:transparent;color:#fbbf24;font-size:7.5px;cursor:pointer";addBtn.textContent="+ Panel";
    addBtn.addEventListener("click",()=>{
      const p=this._defaultPanel();p.name=`Forecast ${this._fPanels.length+1}`;
      p.x=0.02+Math.random()*0.05;p.y=0.25+this._fPanels.length*0.22;
      this._fPanels.push(p);this._selPanelId=p.id;this._saveSystem(card);card._rebuildSidebar?.();card._markDirty?.();
    });
    hdr.append(t,addBtn);wrap.appendChild(hdr);

    // Panel-Liste
    this._fPanels.forEach(panel=>{
      const isActive=this._selPanelId===panel.id;
      const pRow=document.createElement("div");pRow.style.cssText=`border-radius:5px;border:1px solid ${isActive?"#fbbf2444":"#1c2535"};background:${isActive?"#fbbf2408":"var(--surf2)"};padding:5px;margin-bottom:5px`;

      // Panel-Header
      const ph=document.createElement("div");ph.style.cssText="display:flex;align-items:center;gap:5px;margin-bottom:4px";

      // Sichtbarkeit-Toggle
      const visBtn=document.createElement("input");visBtn.type="checkbox";visBtn.checked=panel.visible;visBtn.style.cssText="accent-color:#fbbf24;width:12px;height:12px;cursor:pointer";
      visBtn.addEventListener("change",()=>{panel.visible=visBtn.checked;this._saveSystem(card);card._markDirty?.();});

      // Name
      const nameInp=document.createElement("input");nameInp.type="text";nameInp.value=panel.name;
      nameInp.style.cssText="flex:1;padding:2px 5px;border-radius:3px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-size:7.5px";
      nameInp.addEventListener("input",()=>{panel.name=nameInp.value;card._markDirty?.();});
      nameInp.addEventListener("change",()=>this._saveSystem(card));

      // Selektieren/Bearbeiten
      const editBtn=document.createElement("button");editBtn.style.cssText=`padding:2px 6px;border-radius:3px;border:1px solid ${isActive?"#fbbf24":"#334155"};background:${isActive?"#fbbf2422":"transparent"};color:${isActive?"#fbbf24":"#445566"};font-size:7px;cursor:pointer`;
      editBtn.textContent=isActive?"✓ Aktiv":"Bearb.";
      editBtn.addEventListener("click",()=>{this._selPanelId=isActive?null:panel.id;card._rebuildSidebar?.();card._markDirty?.();});

      // Löschen
      const delBtn=document.createElement("button");delBtn.style.cssText="padding:2px 6px;border-radius:3px;border:1px solid #ef444455;background:transparent;color:#ef4444;font-size:7px;cursor:pointer";delBtn.textContent="✕";
      delBtn.addEventListener("click",()=>{if(this._fPanels.length>1){this._fPanels=this._fPanels.filter(p=>p.id!==panel.id);if(this._selPanelId===panel.id)this._selPanelId=null;this._saveSystem(card);card._rebuildSidebar?.();}});

      ph.append(visBtn,nameInp,editBtn,delBtn);pRow.appendChild(ph);

      // Sources (Anlagen) wenn aktiv
      if(isActive){
        const srcHdr=document.createElement("div");srcHdr.style.cssText="font-size:7px;font-weight:700;color:#94a3b8;margin-bottom:3px";srcHdr.textContent=`ANLAGEN (${(panel.sources||[]).length})`;
        pRow.appendChild(srcHdr);

        (panel.sources||[]).forEach((src,si)=>{
          const sBox=document.createElement("div");sBox.style.cssText="border:1px solid #1c2535;border-radius:4px;padding:5px;margin-bottom:4px;background:var(--bg)";

          // Source-Header
          const sHead=document.createElement("div");sHead.style.cssText="display:flex;align-items:center;gap:4px;margin-bottom:4px";

          // Farbe
          const colorInp=document.createElement("input");colorInp.type="color";colorInp.value=src.color||"#fbbf24";
          colorInp.style.cssText="width:24px;height:20px;border:1px solid var(--border);border-radius:3px;background:none;cursor:pointer;flex-shrink:0";
          colorInp.addEventListener("input",()=>{src.color=colorInp.value;card._markDirty?.();});
          colorInp.addEventListener("change",()=>this._saveSystem(card));

          // Name
          const sName=document.createElement("input");sName.type="text";sName.value=src.name||`Anlage ${si+1}`;sName.placeholder="Name (z.B. Süd-Dach)";
          sName.style.cssText="flex:1;padding:2px 5px;border-radius:3px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-size:7.5px";
          sName.addEventListener("input",()=>{src.name=sName.value;card._markDirty?.();});
          sName.addEventListener("change",()=>this._saveSystem(card));

          // Löschen
          const sDelBtn=document.createElement("button");sDelBtn.style.cssText="padding:1px 5px;border-radius:3px;border:1px solid #ef444455;background:transparent;color:#ef4444;font-size:7px;cursor:pointer";sDelBtn.textContent="✕";
          sDelBtn.addEventListener("click",()=>{panel.sources.splice(si,1);this._saveSystem(card);card._rebuildSidebar?.();});

          sHead.append(colorInp,sName,sDelBtn);sBox.appendChild(sHead);

          // Entity-Felder
          const efDefs=[
            ["Prognose jetzt (W)","now_w","sensor.forecast_now_watts"],
            ["Heute gesamt (kWh)","today","sensor.forecast_today"],
            ["Resttag (kWh)","remaining","sensor.forecast_remaining"],
            ["Morgen (kWh)","tomorrow","sensor.forecast_tomorrow"],
            ["Spitze heute","peak_today","sensor.forecast_peak_today"],
            ["Spitze morgen","peak_tomorrow","sensor.forecast_peak_tomorrow"],
            ["Aktuell erzeugt (W)","actual_w","sensor.solar_power"],
            ["Batterie W (+lad/-entl)","battery_w","sensor.battery_power"],
            ["Verbrauch (W)","load_w","sensor.load_power"],
          ];
          if(!src.fc_entities)src.fc_entities={};
          efDefs.forEach(([label,key,ph])=>{
            const efRow=document.createElement("div");efRow.style.cssText="display:flex;align-items:center;gap:3px;margin-bottom:2px";
            const lbl=document.createElement("span");lbl.style.cssText="font-size:6px;color:#445566;width:80px;flex-shrink:0;white-space:nowrap;overflow:hidden";lbl.textContent=label;
            const inp=document.createElement("input");inp.type="text";inp.value=src.fc_entities[key]||"";inp.placeholder=ph;
            inp.style.cssText="flex:1;padding:2px 4px;border-radius:3px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-size:6.5px;min-width:0";
            inp.addEventListener("input",()=>{src.fc_entities[key]=inp.value.trim();card._markDirty?.();});
            inp.addEventListener("change",()=>this._saveSystem(card));
            efRow.append(lbl,inp);sBox.appendChild(efRow);
          });

          pRow.appendChild(sBox);
        });

        // Neue Anlage hinzufügen
        const addSrc=document.createElement("button");addSrc.style.cssText="width:100%;padding:4px;border-radius:4px;border:1px solid #fbbf2466;background:transparent;color:#fbbf24;font-size:7.5px;cursor:pointer;margin-top:2px";addSrc.textContent="+ Anlage hinzufügen (z.B. Ost/West)";
        addSrc.addEventListener("click",()=>{
          if(!panel.sources)panel.sources=[];
          const colors=["#fbbf24","#38bdf8","#22c55e","#a855f7","#f97316"];
          panel.sources.push({id:"src_"+Date.now(),name:`Anlage ${panel.sources.length+1}`,color:colors[panel.sources.length%colors.length],fc_entities:{}});
          this._saveSystem(card);card._rebuildSidebar?.();
        });
        pRow.appendChild(addSrc);
      }

      wrap.appendChild(pRow);
    });

    // Info
    const info=document.createElement("div");info.style.cssText="font-size:7px;color:#445566;background:var(--surf2);border-radius:4px;padding:5px 7px;margin-top:4px";
    info.innerHTML="<b style='color:#94a3b8'>Tipp:</b> Panel im Canvas an der oberen Mitte ziehen · Ecke rechts unten f\u00FCr Gr\u00F6\u00DFe · Klick im Canvas zum Ausw\u00E4hlen";
    wrap.appendChild(info);
  },

  // ── Restliche Tabs (kompakt) ───────────────────────────────────────────────
  _buildSystemSelector(wrap,card){
    if(!this._systems?.length)return;
    const row=document.createElement("div");row.style.cssText="display:flex;align-items:center;gap:4px;margin-bottom:2px";
    const lbl=document.createElement("span");lbl.style.cssText="font-size:7px;color:#445566";lbl.textContent="System:";
    const sel=document.createElement("select");sel.style.cssText="flex:1;padding:3px 5px;border-radius:4px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-size:7.5px";
    this._systems.forEach((s,i)=>{const o=document.createElement("option");o.value=i;o.textContent=s.name||`System ${i+1}`;if(i===this._activeSystem)o.selected=true;sel.appendChild(o);});
    sel.addEventListener("change",()=>{this._activeSystem=parseInt(sel.value);this._loadSystem(card);card._markDirty?.();card._rebuildSidebar?.();});
    const addBtn=document.createElement("button");addBtn.style.cssText="padding:3px 7px;border-radius:4px;border:1px solid #38bdf8;background:transparent;color:#38bdf8;font-size:7.5px;cursor:pointer";addBtn.textContent="+";
    addBtn.addEventListener("click",()=>{const name=prompt("Name des neuen Systems:");if(!name)return;this._systems.push({id:"sys_"+Date.now(),name,nodes:[],wires:[],autos:[],cfg:{}});this._activeSystem=this._systems.length-1;this._loadSystem(card);this._createDefaultLayout();this._saveSystem(card);card._rebuildSidebar?.();});
    row.append(lbl,sel,addBtn);wrap.appendChild(row);
  },

  _buildSimControls(wrap,card){
    const box=document.createElement("div");box.style.cssText="background:#f59e0b15;border:1px solid #f59e0b55;border-radius:5px;padding:6px;margin-bottom:3px";
    const hdr=document.createElement("div");hdr.style.cssText="font-size:7.5px;font-weight:700;color:#f59e0b;margin-bottom:5px";hdr.textContent="\uD83E\uDDEA SIMULATOR";box.appendChild(hdr);
    const s=this._simVals;
    const mkSlider=(label,key,min,max,unit)=>{
      const row=document.createElement("div");row.style.cssText="margin-bottom:4px";
      const top=document.createElement("div");top.style.cssText="display:flex;justify-content:space-between;font-size:7px;color:#f59e0b88;margin-bottom:1px";
      const valSpan=document.createElement("span");valSpan.textContent=`${s[key]}${unit}`;
      top.innerHTML=`<span>${label}</span>`;top.appendChild(valSpan);
      const sl=document.createElement("input");sl.type="range";sl.min=min;sl.max=max;sl.step=1;sl.value=s[key];sl.style.cssText="width:100%;accent-color:#f59e0b;height:14px";
      sl.addEventListener("input",()=>{s[key]=parseInt(sl.value);valSpan.textContent=`${s[key]}${unit}`;this._runSimCycle(card);card._markDirty?.();});
      row.append(top,sl);return row;
    };
    box.appendChild(mkSlider("Solar","solarW",0,5000,"W"));
    box.appendChild(mkSlider("SOC","battPct",0,100,"%"));
    box.appendChild(mkSlider("Verbrauch","loadW",0,3000,"W"));
    const spRow=document.createElement("div");spRow.style.cssText="display:flex;align-items:center;gap:5px";
    const spLbl=document.createElement("span");spLbl.style.cssText="font-size:7px;color:#f59e0b88";spLbl.textContent="Zeitraffer:";
    [1,5,10].forEach(v=>{const b=document.createElement("button");b.style.cssText=`padding:2px 7px;border-radius:3px;border:1px solid ${this._simSpeed===v?"#f59e0b":"#1c2535"};background:${this._simSpeed===v?"#f59e0b22":"var(--surf2)"};color:${this._simSpeed===v?"#f59e0b":"#445566"};font-size:7.5px;cursor:pointer`;b.textContent=`x${v}`;b.addEventListener("click",()=>{this._simSpeed=v;card._rebuildSidebar?.();});spRow.appendChild(b);});
    spRow.insertBefore(spLbl,spRow.firstChild);box.appendChild(spRow);wrap.appendChild(box);

    // ── Entity-Simulation: alle Entities aus aktiven Automationen ────────
    // Sammle alle Entities aus allen enabled Automationen
    const entityMap={};
    this._autos.filter(a=>a.enabled!==false).forEach(auto=>{
      // Conditions: entity_on / entity_off
      (auto.conditions||[]).filter(c=>c.entity).forEach(c=>{
        entityMap[c.entity]={type:"condition",auto:auto.name};
      });
      // Aktionen: switch_on / switch_off / switch_toggle
      [...(auto.actions||[]),(auto.actions_else||[])].forEach(a=>{
        if(a.entity)entityMap[a.entity]={type:"action",auto:auto.name};
      });
    });

    const entities=Object.entries(entityMap);
    if(!entities.length)return;

    const entBox=document.createElement("div");
    entBox.style.cssText="background:#f59e0b0a;border:1px solid #f59e0b33;border-radius:5px;padding:6px;margin-bottom:3px";

    const entHdr=document.createElement("div");
    entHdr.style.cssText="display:flex;align-items:center;justify-content:space-between;margin-bottom:5px";
    const entTitle=document.createElement("span");
    entTitle.style.cssText="font-size:7.5px;font-weight:700;color:#f59e0b";
    entTitle.textContent=`\uD83D\uDCA1 Entity-Simulation (${entities.length})`;
    const resetBtn=document.createElement("button");
    resetBtn.style.cssText="padding:1px 6px;border-radius:3px;border:1px solid #ef444466;background:transparent;color:#ef4444;font-size:6.5px;cursor:pointer";
    resetBtn.textContent="\u21BB Reset";
    resetBtn.addEventListener("click",()=>{this._simStates={};card._rebuildSidebar?.();card._markDirty?.();});
    entHdr.append(entTitle,resetBtn);
    entBox.appendChild(entHdr);

    const note=document.createElement("div");
    note.style.cssText="font-size:6.5px;color:#445566;margin-bottom:5px;line-height:1.4";
    note.textContent="Virtuelle Zust\u00e4nde – kein HA-Service-Call, kein DB-Eintrag";
    entBox.appendChild(note);

    entities.forEach(([eid,info])=>{
      const realState=card._hass?.states?.[eid]?.state||"unbekannt";
      const simState=this._simStates[eid];
      const curState=simState??realState;
      const isOn=curState==="on";
      const isSimulated=eid in this._simStates;

      const row=document.createElement("div");
      row.style.cssText=`display:flex;align-items:center;gap:6px;padding:4px 6px;border-radius:4px;margin-bottom:3px;border:1px solid ${isSimulated?"#f59e0b44":"#1c2535"};background:${isSimulated?"#f59e0b08":"var(--surf2)"}`;

      // Entity-Name
      const nameDiv=document.createElement("div");
      nameDiv.style.cssText="flex:1;min-width:0";
      const nameEl=document.createElement("div");
      nameEl.style.cssText="font-size:7.5px;font-weight:700;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap";
      nameEl.textContent=eid.split(".").pop();
      nameEl.title=eid;
      const infoEl=document.createElement("div");
      infoEl.style.cssText="font-size:6px;color:#445566";
      infoEl.textContent=`${info.type==="action"?"\u25BA Aktion":"\u25C6 Bedingung"} \u00B7 ${info.auto}`;
      nameDiv.append(nameEl,infoEl);

      // Echter State (grau)
      const realBadge=document.createElement("span");
      realBadge.style.cssText="font-size:6.5px;color:#334155;padding:1px 4px;border:1px solid #1c2535;border-radius:3px;flex-shrink:0";
      realBadge.textContent=`HA: ${realState}`;

      // Toggle-Button
      const toggleBtn=document.createElement("button");
      toggleBtn.style.cssText=`padding:2px 8px;border-radius:4px;border:1px solid ${isOn?"#22c55e":"#445566"};background:${isOn?"#22c55e22":"var(--surf2)"};color:${isOn?"#22c55e":"#445566"};font-size:7.5px;cursor:pointer;flex-shrink:0;min-width:38px`;
      toggleBtn.textContent=isOn?"AN":"AUS";
      toggleBtn.addEventListener("click",()=>{
        this._simStates[eid]=isOn?"off":"on";
        // Sofort Automationen neu auswerten (nicht auf nächsten Poll warten)
        this._runSimCycle(card);
        card._rebuildSidebar?.();card._markDirty?.();
      });

      // Reset-X für diese Entity
      if(isSimulated){
        const xBtn=document.createElement("button");
        xBtn.style.cssText="padding:1px 4px;border-radius:3px;border:1px solid #445566;background:transparent;color:#445566;font-size:7px;cursor:pointer";
        xBtn.textContent="\u00D7";
        xBtn.title="Simulation f\u00fcr diese Entity zur\u00fccksetzen";
        xBtn.addEventListener("click",()=>{delete this._simStates[eid];card._rebuildSidebar?.();card._markDirty?.();});
        row.append(nameDiv,realBadge,toggleBtn,xBtn);
      } else {
        row.append(nameDiv,realBadge,toggleBtn);
      }

      entBox.appendChild(row);
    });

    wrap.appendChild(entBox);
  },

  _buildTabNodes(wrap,card){
    const hdr=document.createElement("div");hdr.style.cssText="font-size:7.5px;font-weight:700;color:#94a3b8;margin-top:3px;margin-bottom:4px";hdr.textContent="ELEMENT HINZUFUEGEN";wrap.appendChild(hdr);
    const grid=document.createElement("div");grid.style.cssText="display:grid;grid-template-columns:1fr 1fr;gap:3px";
    Object.entries(this.NODE_TYPES).forEach(([type,def])=>{
      const btn=document.createElement("button");btn.style.cssText="padding:4px;border-radius:4px;border:1px solid #1c2535;background:var(--surf2);color:var(--text);font-size:7.5px;cursor:pointer;text-align:left;display:flex;align-items:center;gap:4px";
      btn.innerHTML=`<span style="font-size:11px">${def.icon}</span><span>${def.label}</span>`;
      btn.addEventListener("click",()=>{const n={id:type+"_"+Date.now(),type,label:def.label,entity:"",sensorKey:"",x:0.3+Math.random()*0.4,y:0.3+Math.random()*0.3,w:def.defaultW,h:def.defaultH,color:def.color};this._nodes.push(n);this._selNode=n;this._saveSystem(card);card._rebuildSidebar?.();card._markDirty?.();});
      grid.appendChild(btn);
    });
    wrap.appendChild(grid);
    if(this._nodes.length){
      const lh=document.createElement("div");lh.style.cssText="font-size:7px;font-weight:700;color:#94a3b8;margin-top:6px;margin-bottom:3px";lh.textContent=`ELEMENTE (${this._nodes.length})`;wrap.appendChild(lh);
      this._nodes.forEach(node=>{
        const nt=this.NODE_TYPES[node.type]||this.NODE_TYPES.custom;
        const row=document.createElement("div");row.style.cssText=`display:flex;align-items:center;gap:5px;padding:4px 6px;border-radius:4px;border:1px solid ${this._selNode===node?"#00e5ff44":"#1c2535"};background:${this._selNode===node?"#00e5ff08":"var(--surf2)"};cursor:pointer;margin-bottom:2px`;
        row.innerHTML=`<span style="font-size:11px">${nt.icon}</span><div style="flex:1;min-width:0"><div style="font-size:8px;font-weight:700;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${node.label||nt.label}</div><div style="font-size:6px;color:#445566">${node.type} \u00B7 ${node.entity||"keine Entity"}</div></div>`;
        row.addEventListener("click",()=>{this._selNode=this._selNode===node?null:node;card._rebuildSidebar?.();card._markDirty?.();});wrap.appendChild(row);
      });
    }
  },

  _buildTabWires(wrap,card){
    const connBtn=document.createElement("button");connBtn.style.cssText=`width:100%;padding:5px;border-radius:4px;border:1px solid ${this._connectFrom?"#22c55e":"#38bdf8"};background:${this._connectFrom?"#22c55e22":"transparent"};color:${this._connectFrom?"#22c55e":"#38bdf8"};font-size:8px;cursor:pointer;margin-top:3px;margin-bottom:5px`;
    connBtn.textContent=this._connectFrom?"\u2716 Verbinden abbrechen":"\u2192 Zwei Knoten verbinden";
    connBtn.addEventListener("click",()=>{if(this._connectFrom){this._connectFrom=null;this._connectCursor=null;}else{card._showToast?.("Ersten Knoten antippen \u2192 dann zweiten");}card._rebuildSidebar?.();card._markDirty?.();});
    wrap.appendChild(connBtn);
    if(this._connectFrom){const hint=document.createElement("div");hint.style.cssText="font-size:7.5px;color:#22c55e;text-align:center;padding:5px;background:#22c55e11;border-radius:4px;margin-bottom:5px";hint.textContent=`Von: "${this._nodes.find(n=>n.id===this._connectFrom)?.label||this._connectFrom}" \u2192 zweiten Knoten antippen`;wrap.appendChild(hint);}
    const hdr=document.createElement("div");hdr.style.cssText="font-size:7.5px;font-weight:700;color:#94a3b8;margin-bottom:3px";hdr.textContent=`LEITUNGEN (${this._wires.length})`;wrap.appendChild(hdr);
    this._wires.forEach(wire=>{
      const nA=this._nodes.find(n=>n.id===wire.from),nB=this._nodes.find(n=>n.id===wire.to);
      const row=document.createElement("div");row.style.cssText=`display:flex;align-items:center;gap:5px;padding:4px 6px;border-radius:4px;border:1px solid ${this._selWire===wire?"#38bdf844":"#1c2535"};background:${this._selWire===wire?"#38bdf808":"var(--surf2)"};cursor:pointer;margin-bottom:2px`;
      row.innerHTML=`<span style="font-size:10px">\u21C9</span><div style="flex:1;font-size:7.5px;color:var(--text)">${nA?.label||"?"} \u2192 ${nB?.label||"?"}</div><span style="font-size:6px;color:#445566">${wire.sensorKey||"auto"}</span>`;
      row.addEventListener("click",()=>{this._selWire=this._selWire===wire?null:wire;this._selNode=null;card._rebuildSidebar?.();card._markDirty?.();});wrap.appendChild(row);
    });
  },

  _buildNodeEditor(card){
    const node=this._selNode;const nt=this.NODE_TYPES[node.type]||this.NODE_TYPES.custom;
    const div=document.createElement("div");div.style.cssText="display:flex;flex-direction:column;gap:5px";
    const hdr=document.createElement("div");hdr.style.cssText="display:flex;align-items:center;gap:6px";
    hdr.innerHTML=`<span style="font-size:15px">${nt.icon}</span><span style="font-size:9px;font-weight:700;color:${node.color||nt.color}">${nt.label}</span>`;
    const back=document.createElement("button");back.style.cssText="margin-left:auto;padding:2px 8px;border-radius:4px;border:1px solid var(--border);background:var(--surf2);color:var(--text);font-size:8px;cursor:pointer";back.textContent="\u2190";
    back.addEventListener("click",()=>{this._selNode=null;card._rebuildSidebar?.();});hdr.appendChild(back);div.appendChild(hdr);
    const save=(k,v)=>{node[k]=v;this._saveSystem(card);card._markDirty?.();};
    div.appendChild(this._mkField("Label",node.label||"",v=>save("label",v)));
    div.appendChild(this._mkEntityPicker("Entity (Wert-Quelle automatisch)",node.entity,["switch","sensor","binary_sensor","input_boolean","media_player"],v=>save("entity",v),card));
    const skDiv=document.createElement("div");const skLbl=document.createElement("div");skLbl.style.cssText="font-size:7px;color:#445566;margin-bottom:2px";skLbl.textContent="sensorKey (\u00FCberschreibt Entity)";
    const skSel=document.createElement("select");skSel.style.cssText="width:100%;padding:3px 5px;border-radius:4px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-size:7.5px";
    [["","(auto)"],["solar_power","Solar W"],["battery_soc","Batt %"],["battery_power","Batt W"],["load_power","Last W"],["ac_out_power","WR AC W"],["surplus","Uberschuss"],["grid_power","Netz W"]].forEach(([k,l])=>{const o=document.createElement("option");o.value=k;o.textContent=l;if(node.sensorKey===k)o.selected=true;skSel.appendChild(o);});
    skSel.addEventListener("change",()=>save("sensorKey",skSel.value));skDiv.append(skLbl,skSel);div.appendChild(skDiv);
    const sizeRow=document.createElement("div");sizeRow.style.cssText="display:flex;gap:5px;align-items:center";
    const wInp=document.createElement("input");wInp.type="number";wInp.value=node.w||nt.defaultW;wInp.min=20;wInp.max=200;wInp.style.cssText="width:45px;padding:2px 4px;border-radius:3px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-size:8px";wInp.addEventListener("input",()=>save("w",parseInt(wInp.value)||nt.defaultW));
    const hInp=document.createElement("input");hInp.type="number";hInp.value=node.h||nt.defaultH;hInp.min=20;hInp.max=200;hInp.style.cssText="width:45px;padding:2px 4px;border-radius:3px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-size:8px";hInp.addEventListener("input",()=>save("h",parseInt(hInp.value)||nt.defaultH));
    sizeRow.append(Object.assign(document.createElement("span"),{textContent:"Groesse:",style:"font-size:7px;color:#445566"}),wInp,document.createTextNode("\u00D7"),hInp);div.appendChild(sizeRow);
    if(this._editMode){const connBtn=document.createElement("button");connBtn.style.cssText="width:100%;padding:4px;border-radius:4px;border:1px solid #38bdf8;background:transparent;color:#38bdf8;font-size:8px;cursor:pointer;margin-top:2px";connBtn.textContent="\u2192 Leitung von hier";connBtn.addEventListener("click",()=>{this._connectFrom=node.id;this._sidebarTab="wires";this._selNode=null;card._showToast?.(`Von "${node.label}" \u2013 zweiten Knoten antippen`);card._rebuildSidebar?.();card._markDirty?.();});div.appendChild(connBtn);}
    const del=document.createElement("button");del.style.cssText="width:100%;padding:4px;border-radius:4px;border:1px solid #ef4444;background:transparent;color:#ef4444;font-size:8px;cursor:pointer;margin-top:4px";del.textContent="\uD83D\uDDD1 Loschen";
    del.addEventListener("click",()=>{this._nodes=this._nodes.filter(n=>n.id!==node.id);this._wires=this._wires.filter(w=>w.from!==node.id&&w.to!==node.id);this._selNode=null;this._saveSystem(card);card._rebuildSidebar?.();});div.appendChild(del);return div;
  },

  _buildWireEditor(card){
    const wire=this._selWire;const nA=this._nodes.find(n=>n.id===wire.from),nB=this._nodes.find(n=>n.id===wire.to);
    const div=document.createElement("div");div.style.cssText="display:flex;flex-direction:column;gap:5px";
    const hdr=document.createElement("div");hdr.style.cssText="display:flex;align-items:center;gap:6px";hdr.innerHTML=`<span style="font-size:14px">\u21C9</span><span style="font-size:9px;font-weight:700;color:#38bdf8">${nA?.label||"?"} \u2192 ${nB?.label||"?"}</span>`;
    const back=document.createElement("button");back.style.cssText="margin-left:auto;padding:2px 8px;border-radius:4px;border:1px solid var(--border);background:var(--surf2);color:var(--text);font-size:8px;cursor:pointer";back.textContent="\u2190";back.addEventListener("click",()=>{this._selWire=null;card._rebuildSidebar?.();});hdr.appendChild(back);div.appendChild(hdr);
    const vals=this._getVals(this._card);const autoVal=this._getWireVal(wire,vals,this._card);
    const info=document.createElement("div");info.style.cssText="font-size:7px;color:#22c55e;background:#22c55e11;padding:4px 6px;border-radius:3px";info.textContent=`\u2139 Aktuell: ${autoVal.toFixed(0)}W \u2013 Quelle: ${nA?.entity?"Entity ("+nA.entity+")":wire.sensorKey||"auto"}`;div.appendChild(info);
    const skDiv=document.createElement("div");const skLbl=document.createElement("div");skLbl.style.cssText="font-size:7px;color:#445566;margin-bottom:2px";skLbl.textContent="sensorKey (\u00FCberschreiben)";
    const skSel=document.createElement("select");skSel.style.cssText="width:100%;padding:3px 5px;border-radius:4px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-size:7.5px";
    [["","(auto von Quell-Node)"],["solar_power","Solar W"],["battery_power","Batt W"],["load_power","Last W"],["ac_out_power","WR AC W"],["surplus","Uberschuss"],["grid_power","Netz W"]].forEach(([k,l])=>{const o=document.createElement("option");o.value=k;o.textContent=l;if(wire.sensorKey===k)o.selected=true;skSel.appendChild(o);});
    skSel.addEventListener("change",()=>{wire.sensorKey=skSel.value;this._saveSystem(card);card._markDirty?.();});skDiv.append(skLbl,skSel);div.appendChild(skDiv);
    div.appendChild(this._mkField("Farbe (hex)",wire.color||"",v=>{wire.color=v;this._saveSystem(card);card._markDirty?.();}));
    const del=document.createElement("button");del.style.cssText="width:100%;padding:4px;border-radius:4px;border:1px solid #ef4444;background:transparent;color:#ef4444;font-size:8px;cursor:pointer;margin-top:4px";del.textContent="\uD83D\uDDD1 Loschen";del.addEventListener("click",()=>{this._wires=this._wires.filter(w=>w.id!==wire.id);this._selWire=null;this._saveSystem(card);card._rebuildSidebar?.();});div.appendChild(del);return div;
  },

  _buildTabAutos(wrap,card,vals){
    const hdr=document.createElement("div");hdr.style.cssText="display:flex;align-items:center;gap:5px;margin-top:3px";
    const t=document.createElement("div");t.style.cssText="font-size:7.5px;font-weight:700;color:#94a3b8;flex:1";t.textContent=`EIGENE (${this._autos.length})`;
    const addBtn=document.createElement("button");addBtn.style.cssText="padding:3px 8px;border-radius:4px;border:1px solid #22c55e;background:transparent;color:#22c55e;font-size:7.5px;cursor:pointer";addBtn.textContent="+ Neu";
    addBtn.addEventListener("click",()=>{const na={id:"auto_"+Date.now(),name:"Neue Automation",enabled:true,conditions:[],operator:"AND",actions:[],actions_else:[],cooldown_min:15};this._autos.push(na);this._selAuto=na;this._saveSystem(card);card._rebuildSidebar?.();});
    hdr.append(t,addBtn);wrap.appendChild(hdr);
    const hass=card._hass,cfg=card._opts?.elektro_v4_cfg||{};
    this._autos.forEach(auto=>{
      const running=this._evalAuto(auto,vals,hass,cfg);
      const row=document.createElement("div");row.style.cssText=`display:flex;align-items:center;gap:5px;padding:5px 6px;border-radius:5px;border:1px solid ${running?"#22c55e44":"#1c2535"};background:${running?"#22c55e0a":"var(--surf2)"};cursor:pointer;margin-bottom:2px`;
      const tog=document.createElement("input");tog.type="checkbox";tog.checked=auto.enabled!==false;tog.style.cssText="accent-color:#22c55e;width:12px;height:12px;cursor:pointer";
      tog.addEventListener("click",(e)=>{e.stopPropagation();auto.enabled=tog.checked;this._saveSystem(card);card._markDirty?.();});
      row.innerHTML=`<span style="font-size:10px">\u25C6</span><div style="flex:1;min-width:0"><div style="font-size:8px;font-weight:700;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${auto.name||"Auto"}</div><div style="font-size:6.5px;color:#445566">${auto.conditions?.length||0} Bed \u00B7 ${auto.actions?.length||0} Akt</div></div><span style="font-size:8px;font-weight:700;color:${running?"#22c55e":"#445566"}">${running?"\u25B6":"\u25CF"}</span>`;
      row.insertBefore(tog,row.firstChild);row.addEventListener("click",()=>{this._selAuto=auto;card._rebuildSidebar?.();});wrap.appendChild(row);
    });
    if(this._log.length){const lh=document.createElement("div");lh.style.cssText="font-size:7px;font-weight:700;color:#94a3b8;margin-top:5px;margin-bottom:2px";lh.textContent=`LOG (${this._log.length})`;wrap.appendChild(lh);this._log.slice(0,5).forEach(e=>{const r=document.createElement("div");r.style.cssText="font-size:6.5px;color:#445566;padding:2px 0;border-bottom:1px solid #0d121933";const ts=new Date(e.ts);r.textContent=`${ts.getHours().toString().padStart(2,"0")}:${ts.getMinutes().toString().padStart(2,"0")}${e.sim?" [SIM]":""} \u25C6 ${e.name}`;wrap.appendChild(r);});}
  },

  _buildAutoEditor(card){
    const auto=this._selAuto;
    const div=document.createElement("div");div.style.cssText="display:flex;flex-direction:column;gap:4px";
    const hdr=document.createElement("div");hdr.style.cssText="display:flex;align-items:center;gap:6px;margin-bottom:3px";hdr.innerHTML=`<span style="font-size:13px">\u25C6</span><span style="font-size:9px;font-weight:700;color:#22c55e">Automation</span>`;
    const back=document.createElement("button");back.style.cssText="margin-left:auto;padding:2px 8px;border-radius:4px;border:1px solid var(--border);background:var(--surf2);color:var(--text);font-size:8px;cursor:pointer";back.textContent="\u2190";back.addEventListener("click",()=>{this._selAuto=null;card._rebuildSidebar?.();});hdr.appendChild(back);div.appendChild(hdr);
    const save=(k,v)=>{auto[k]=v;this._saveSystem(card);card._markDirty?.();};
    div.appendChild(this._mkField("Name",auto.name||"",v=>save("name",v)));
    const tr=document.createElement("div");tr.style.cssText="display:flex;align-items:center;gap:6px";
    const ec=document.createElement("input");ec.type="checkbox";ec.checked=auto.enabled!==false;ec.style.cssText="accent-color:#22c55e;width:13px;height:13px";ec.addEventListener("change",()=>save("enabled",ec.checked));
    const el=document.createElement("span");el.style.cssText="font-size:8px;color:#94a3b8;flex:1";el.textContent="Aktiv";
    const ci=document.createElement("input");ci.type="number";ci.value=auto.cooldown_min||15;ci.min=1;ci.max=1440;ci.style.cssText="width:40px;padding:2px 4px;border-radius:3px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-size:8px";ci.addEventListener("input",()=>save("cooldown_min",parseInt(ci.value)||15));
    tr.append(ec,el,Object.assign(document.createElement("span"),{textContent:"Cooldown:",style:"font-size:7px;color:#445566"}),ci,document.createTextNode("min"));div.appendChild(tr);

    const COND={
  surplus_gt:          {label:"Uberschuss > W",       icon:"\u26A1", params:["threshold_w"],   grp:"energie"},
  surplus_lt:          {label:"Uberschuss < W",       icon:"\u26A1", params:["threshold_w"],   grp:"energie"},
  soc_gt:              {label:"Batt-SOC > %",         icon:"\uD83D\uDD0B",params:["threshold_pct"], grp:"energie"},
  soc_lt:              {label:"Batt-SOC < %",         icon:"\uD83D\uDD0B",params:["threshold_pct"], grp:"energie"},
  watt_gt:             {label:"Solar > W",            icon:"\u2600", params:["threshold_w"],   grp:"energie"},
  watt_lt:             {label:"Solar < W",            icon:"\u2600", params:["threshold_w"],   grp:"energie"},
  time_between:        {label:"Uhrzeit zwischen",     icon:"\uD83D\uDD50",params:["time_from","time_to"],grp:"zeit"},
  entity_on:           {label:"Entity AN",            icon:"\uD83D\uDCA1",params:["entity"],       grp:"entity"},
  entity_off:          {label:"Entity AUS",           icon:"\uD83D\uDCA1",params:["entity"],       grp:"entity"},
  entity_state:        {label:"Entity Zustand =",     icon:"\uD83D\uDCCB",params:["entity","compare_value"], grp:"entity"},
  entity_num_gt:       {label:"Entity (Zahl) > Wert", icon:"\uD83D\uDCCA",params:["entity","compare_value"], grp:"entity"},
  entity_num_lt:       {label:"Entity (Zahl) < Wert", icon:"\uD83D\uDCCA",params:["entity","compare_value"], grp:"entity"},
  forecast_today_gt:   {label:"Forecast heute > kWh", icon:"\uD83D\uDCCA",params:["threshold_kwh"], grp:"forecast"},
  forecast_today_lt:   {label:"Forecast heute < kWh", icon:"\uD83D\uDCCA",params:["threshold_kwh"], grp:"forecast"},
  forecast_tomorrow_gt:{label:"Morgen > kWh",         icon:"\uD83D\uDCCA",params:["threshold_kwh"], grp:"forecast"},
  weather_is:          {label:"Wetter ist...",         icon:"\uD83C\uDF24",params:["weather_cond"],  grp:"forecast"},
};
    const ACT={switch_on:{label:"Schalter AN",icon:"\u2705",params:["entity"]},switch_off:{label:"Schalter AUS",icon:"\u274C",params:["entity"]},switch_toggle:{label:"Toggeln",icon:"\uD83D\uDD04",params:["entity"]},notify:{label:"Benachrichtigung",icon:"\uD83D\uDD14",params:["message"]}};

    const ch=document.createElement("div");ch.style.cssText="font-size:7.5px;font-weight:700;color:#94a3b8;margin-top:3px";ch.textContent="WENN";div.appendChild(ch);
    if(!auto.conditions)auto.conditions=[];
    auto.conditions.forEach((c,ci2)=>{
      const ct=COND[c.type]||{};const rb=document.createElement("div");rb.style.cssText="background:var(--surf2);border-radius:4px;padding:5px;border:1px solid #38bdf822;margin-bottom:3px";
      rb.innerHTML=`<div style="font-size:7.5px;font-weight:700;color:#38bdf8;margin-bottom:3px">${ct.icon||""} ${ct.label||c.type}</div>`;
      (ct.params||[]).forEach(param=>{
        if(param==="entity"){rb.appendChild(this._mkEntityPicker("Entity",c[param],["switch","sensor","binary_sensor","input_boolean"],v=>{c[param]=v;this._saveSystem(card);},card));}
        else if(param==="weather_cond"){const sel=document.createElement("select");sel.style.cssText="width:100%;padding:3px 5px;border-radius:4px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-size:7.5px";["sunny","partlycloudy","cloudy","overcast","rainy","snowy","foggy","windy"].forEach(w=>{const o=document.createElement("option");o.value=w;o.textContent=w;if(c[param]===w)o.selected=true;sel.appendChild(o);});sel.addEventListener("change",()=>{c[param]=sel.value;this._saveSystem(card);});rb.appendChild(sel);}
        else{
          const pr=document.createElement("div");
          const pl=document.createElement("div");
          pl.style.cssText="font-size:6.5px;color:#445566;margin-bottom:1px";
          pl.textContent={
            threshold_w:"Schwellwert (Watt)",threshold_pct:"Schwellwert (%)",
            threshold_kwh:"Schwellwert (kWh)",time_from:"Von (HH:MM)",time_to:"Bis (HH:MM)",
            compare_value:"Vergleichswert"
          }[param]||param;
          const pi=document.createElement("input");pi.type="text";pi.value=c[param]||"";
          pi.placeholder=param==="compare_value"?"z.B. on / off / 22.5":"";
          pi.style.cssText="width:100%;padding:2px 5px;border-radius:3px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-size:7.5px";
          pi.addEventListener("input",()=>{c[param]=pi.value.trim();this._saveSystem(card);});
          pr.append(pl,pi);rb.appendChild(pr);
        }
      });
      const db=document.createElement("button");db.style.cssText="width:100%;padding:2px;border-radius:3px;border:1px solid #ef444466;background:transparent;color:#ef4444;font-size:7px;cursor:pointer;margin-top:3px";db.textContent="Entfernen";db.addEventListener("click",()=>{auto.conditions.splice(ci2,1);this._saveSystem(card);card._rebuildSidebar?.();});rb.appendChild(db);div.appendChild(rb);
    });
    const cs=document.createElement("select");cs.style.cssText="width:100%;padding:3px 5px;border-radius:4px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-size:7.5px;margin-bottom:4px";
    cs.appendChild(Object.assign(document.createElement("option"),{value:"",textContent:"+ Bedingung hinzuf\u00fcgen\u2026"}));
    const grpDefs={energie:"\u26A1 Energie",zeit:"\uD83D\uDD50 Zeit",entity:"\uD83D\uDCA1 Eigene Entity",forecast:"\u2600 Forecast & Wetter"};
    const grps={};
    Object.entries(grpDefs).forEach(([k,l])=>{const g=document.createElement("optgroup");g.label=l;grps[k]=g;});
    Object.entries(COND).forEach(([id,ct])=>{
      const o=document.createElement("option");o.value=id;o.textContent=`${ct.icon} ${ct.label}`;
      (grps[ct.grp]||grps.energie).appendChild(o);
    });
    Object.values(grps).forEach(g=>{if(g.children.length)cs.appendChild(g);});
    cs.addEventListener("change",()=>{if(!cs.value)return;auto.conditions.push({type:cs.value});cs.value="";this._saveSystem(card);card._rebuildSidebar?.();});div.appendChild(cs);

    const ah=document.createElement("div");ah.style.cssText="font-size:7.5px;font-weight:700;color:#94a3b8;margin-top:2px";ah.textContent="DANN";div.appendChild(ah);
    if(!auto.actions)auto.actions=[];
    auto.actions.forEach((a,ai)=>{
      const at=ACT[a.type]||{};const rb=document.createElement("div");rb.style.cssText="background:var(--surf2);border-radius:4px;padding:5px;border:1px solid #22c55e22;margin-bottom:3px";
      rb.innerHTML=`<div style="font-size:7.5px;font-weight:700;color:#22c55e;margin-bottom:3px">${at.icon||""} ${at.label||a.type}</div>`;
      (at.params||[]).forEach(param=>{if(param==="entity"){rb.appendChild(this._mkEntityPicker("Entity",a[param],["switch","light","input_boolean"],v=>{a[param]=v;this._saveSystem(card);},card));}else{const pr=document.createElement("div");const pl=document.createElement("div");pl.style.cssText="font-size:6.5px;color:#445566;margin-bottom:1px";pl.textContent={message:"Nachricht"}[param]||param;const pi=document.createElement("input");pi.type="text";pi.value=a[param]||"";pi.style.cssText="width:100%;padding:2px 5px;border-radius:3px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-size:7.5px";pi.addEventListener("input",()=>{a[param]=pi.value.trim();this._saveSystem(card);});pr.append(pl,pi);rb.appendChild(pr);}});
      const db=document.createElement("button");db.style.cssText="width:100%;padding:2px;border-radius:3px;border:1px solid #ef444466;background:transparent;color:#ef4444;font-size:7px;cursor:pointer;margin-top:3px";db.textContent="Entfernen";db.addEventListener("click",()=>{auto.actions.splice(ai,1);this._saveSystem(card);card._rebuildSidebar?.();});rb.appendChild(db);div.appendChild(rb);
    });
    const as2=document.createElement("select");as2.style.cssText="width:100%;padding:3px 5px;border-radius:4px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-size:7.5px;margin-bottom:4px";as2.appendChild(Object.assign(document.createElement("option"),{value:"",textContent:"+ Aktion\u2026"}));Object.entries(ACT).forEach(([id,at])=>{const o=document.createElement("option");o.value=id;o.textContent=`${at.icon} ${at.label}`;as2.appendChild(o);});as2.addEventListener("change",()=>{if(!as2.value)return;auto.actions.push({type:as2.value});as2.value="";this._saveSystem(card);card._rebuildSidebar?.();});div.appendChild(as2);
    const del2=document.createElement("button");del2.style.cssText="width:100%;padding:4px;border-radius:4px;border:1px solid #ef4444;background:transparent;color:#ef4444;font-size:8px;cursor:pointer;margin-top:2px";del2.textContent="\uD83D\uDDD1 Loschen";del2.addEventListener("click",()=>{this._autos=this._autos.filter(a=>a.id!==auto.id);this._selAuto=null;this._saveSystem(card);card._rebuildSidebar?.();});div.appendChild(del2);return div;
  },

  _buildTabHA(wrap,card){
    const hdr=document.createElement("div");hdr.style.cssText="display:flex;align-items:center;gap:5px;margin-top:3px";const t=document.createElement("div");t.style.cssText="font-size:7.5px;font-weight:700;color:#94a3b8;flex:1";t.textContent=`HA (${this._haAutos.length})`;const reload=document.createElement("button");reload.style.cssText="padding:3px 7px;border-radius:4px;border:1px solid #38bdf8;background:transparent;color:#38bdf8;font-size:7.5px;cursor:pointer";reload.textContent="\u21BB";reload.addEventListener("click",()=>{this._haEntities=null;this._loadHaAutomations(card).then(()=>card._rebuildSidebar?.());});hdr.append(t,reload);wrap.appendChild(hdr);
    const fi=document.createElement("input");fi.type="text";fi.placeholder="Suchen\u2026";fi.style.cssText="width:100%;padding:3px 6px;border-radius:4px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-size:7.5px;margin-bottom:4px";wrap.appendChild(fi);
    const listEl=document.createElement("div");const renderList=f=>{listEl.innerHTML="";this._haAutos.filter(a=>!f||(a.alias||"").toLowerCase().includes(f.toLowerCase())).slice(0,40).forEach(ha=>{const on=ha.state==="on";const row=document.createElement("div");row.style.cssText=`display:flex;align-items:center;gap:5px;padding:4px 6px;border-radius:4px;border:1px solid ${on?"#22c55e22":"#1c2535"};background:${on?"#22c55e08":"var(--surf2)"};margin-bottom:2px`;const tog=document.createElement("input");tog.type="checkbox";tog.checked=on;tog.style.cssText="accent-color:#22c55e;width:12px;height:12px;cursor:pointer";tog.addEventListener("change",()=>{if(ha.entity_id)card._hass.callService("automation",tog.checked?"turn_on":"turn_off",{entity_id:ha.entity_id}).then(()=>{ha.state=tog.checked?"on":"off";}).catch(()=>{});});const lastT=ha.last_triggered?new Date(ha.last_triggered):null;const lastStr=lastT?`${lastT.getDate()}.${lastT.getMonth()+1} ${lastT.getHours()}:${String(lastT.getMinutes()).padStart(2,"0")}`:"nie";row.innerHTML=`<div style="flex:1;min-width:0"><div style="font-size:7.5px;font-weight:700;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${ha.alias}</div><div style="font-size:6px;color:#445566">Letzte: ${lastStr}</div></div><span style="font-size:7px;font-weight:700;color:${on?"#22c55e":"#445566"}">${on?"AN":"AUS"}</span>`;row.insertBefore(tog,row.firstChild);listEl.appendChild(row);});};
    fi.addEventListener("input",()=>renderList(fi.value));renderList("");wrap.appendChild(listEl);
  },

  _buildTabAI(wrap,card,vals){
    const ins=this._analyzeSystem(card,vals);if(ins.length){const h=document.createElement("div");h.style.cssText="font-size:7.5px;font-weight:700;color:#f59e0b;margin-top:4px;margin-bottom:4px";h.textContent="\uD83E\uDD16 ANALYSE";wrap.appendChild(h);ins.forEach(i=>{const r=document.createElement("div");r.style.cssText="font-size:7.5px;color:#94a3b8;padding:5px 7px;background:var(--surf2);border-radius:4px;border:1px solid #1c2535;margin-bottom:3px";r.textContent=i;wrap.appendChild(r);});}
    const AI_SUGG=[{id:"s1",title:"\uD83D\uDD0B Tiefentladungsschutz",risk:"low",desc:"WR aus wenn SOC < 20%.",auto:{name:"Batt Schutz",conditions:[{type:"soc_lt",threshold_pct:20},{type:"watt_lt",threshold_w:10}],operator:"AND",actions:[{type:"switch_off",entity:"{{relay_a}}"}],actions_else:[],cooldown_min:30}},{id:"s2",title:"\u2600 Uberschuss Boiler",risk:"low",desc:"Boiler bei > 500W.",auto:{name:"Uberschuss Boiler",conditions:[{type:"surplus_gt",threshold_w:500}],operator:"AND",actions:[{type:"switch_on",entity:"{{boiler_entity}}"}],actions_else:[{type:"switch_off",entity:"{{boiler_entity}}"}],cooldown_min:15}},{id:"sf1",title:"\u2600 Forecast: Sonnentag",risk:"low",desc:"Boiler wenn heute > 4kWh forecast.",auto:{name:"Forecast Boiler",conditions:[{type:"forecast_today_gt",threshold_kwh:4},{type:"surplus_gt",threshold_w:300}],operator:"AND",actions:[{type:"switch_on",entity:"{{boiler_entity}}"}],actions_else:[{type:"switch_off",entity:"{{boiler_entity}}"}],cooldown_min:30}}];
    const existIds=this._autos.map(a=>a.source_suggestion).filter(Boolean);const sugH=document.createElement("div");sugH.style.cssText="font-size:7.5px;font-weight:700;color:#94a3b8;margin-top:6px;margin-bottom:4px";sugH.textContent="VORSCHLAGE";wrap.appendChild(sugH);
    AI_SUGG.filter(s=>!existIds.includes(s.id)).forEach(s=>{const rc=s.risk==="high"?"#ef4444":s.risk==="medium"?"#f59e0b":"#22c55e";const card2=document.createElement("div");card2.style.cssText=`border-radius:5px;border:1px solid ${rc}33;background:${rc}0a;padding:6px;margin-bottom:4px`;card2.innerHTML=`<div style="font-size:8px;font-weight:700;color:var(--text);margin-bottom:2px">${s.title}</div><div style="font-size:7px;color:#64748b;margin-bottom:4px">${s.desc}</div>`;const addBtn=document.createElement("button");addBtn.style.cssText=`width:100%;padding:3px;border-radius:4px;border:1px solid ${rc};background:transparent;color:${rc};font-size:7.5px;cursor:pointer`;addBtn.textContent="\u25C6 Hinzufuegen";addBtn.addEventListener("click",()=>{const na={...s.auto,id:"auto_"+Date.now(),enabled:true,source_suggestion:s.id};this._autos.push(na);this._saveSystem(card);this._selAuto=na;this._sidebarTab="autos";card._rebuildSidebar?.();});card2.appendChild(addBtn);wrap.appendChild(card2);});
  },

  _buildTabConfig(wrap,card){
    const cfg=card._opts?.elektro_v4_cfg||{};
    const save=(k,v)=>{if(!card._opts)card._opts={};if(!card._opts.elektro_v4_cfg)card._opts.elektro_v4_cfg={};card._opts.elektro_v4_cfg[k]=v;const sys=this._systems[this._activeSystem];if(sys)sys.cfg=card._opts.elektro_v4_cfg;card._saveOptions?.();};
    const mkF=(label,key,ph)=>{const row=document.createElement("div");const lbl=document.createElement("div");lbl.style.cssText="font-size:7px;color:#445566;margin-bottom:2px";lbl.textContent=label;const inp=document.createElement("input");inp.type="text";inp.value=cfg[key]||"";inp.placeholder=ph;inp.style.cssText="width:100%;padding:3px 6px;border-radius:4px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-size:7.5px";inp.addEventListener("input",()=>save(key,inp.value.trim()));row.append(lbl,inp);return row;};
    const box=title=>{const b=document.createElement("div");b.style.cssText="background:var(--surf2);border-radius:5px;padding:7px;border:1px solid #1c2535;margin-bottom:5px";const h=document.createElement("div");h.style.cssText="font-size:7.5px;font-weight:700;color:#94a3b8;margin-bottom:5px";h.textContent=title;b.appendChild(h);return b;};
    const hdr=document.createElement("div");hdr.style.cssText="font-size:8px;font-weight:700;color:#f59e0b;margin-top:3px;margin-bottom:4px";hdr.textContent="\u2699 SYSTEM-ENTITIES";wrap.appendChild(hdr);
    const s=box("ENERGIE");[["Solar W","solar_power","sensor.solar_w"],["Batt SOC","battery_soc","sensor.batt_soc"],["Batt W","battery_power","sensor.batt_w"],["Verbrauch W","load_power","sensor.load_w"],["WR AC W","ac_out_power","sensor.ac_out_w"],["Netz W","grid_power","sensor.grid_w"],["Relais A","relay_a","switch.relay_a"],["Relais B","relay_b","switch.relay_b"],["Relais C","relay_c","switch.relay_c"]].forEach(a=>s.appendChild(mkF(...a)));wrap.appendChild(s);
    const w=box("WETTER-ENTITY");w.appendChild(mkF("Wetter (weather.*)","weather_entity","weather.home"));wrap.appendChild(w);
    const sb=box("SAISON-MODUS");const sCb=document.createElement("input");sCb.type="checkbox";sCb.checked=!!cfg.saison_active;sCb.style.cssText="accent-color:#f59e0b;width:13px;height:13px";sCb.addEventListener("change",()=>save("saison_active",sCb.checked));const sRow=document.createElement("div");sRow.style.cssText="display:flex;align-items:center;gap:6px;margin-bottom:4px";sRow.append(sCb,Object.assign(document.createElement("span"),{textContent:"Modul zeitlich begrenzen",style:"font-size:8px;color:#94a3b8"}));sb.appendChild(sRow);const mRow=document.createElement("div");mRow.style.cssText="display:flex;align-items:center;gap:6px";["saison_from","saison_to"].forEach((key,i)=>{const l=Object.assign(document.createElement("span"),{textContent:i===0?"Von:":"Bis:",style:"font-size:8px;color:#94a3b8"});const sel=document.createElement("select");sel.style.cssText="padding:2px 4px;border-radius:4px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-size:8px";["Jan","Feb","Mar","Apr","Mai","Jun","Jul","Aug","Sep","Okt","Nov","Dez"].forEach((m,mi)=>{const o=document.createElement("option");o.value=mi+1;o.textContent=m;if((parseInt(cfg[key])||(i===0?1:12))===mi+1)o.selected=true;sel.appendChild(o);});sel.addEventListener("change",()=>save(key,parseInt(sel.value)));mRow.append(l,sel);});sb.appendChild(mRow);wrap.appendChild(sb);
  },

  // ── Automation-Logik ──────────────────────────────────────────────────────
  _evalAuto(auto,vals,hass,cfg){if(!auto?.conditions?.length)return false;const r=auto.conditions.map(c=>this._evalCond(c,vals,hass,cfg));return auto.operator==="OR"?r.some(Boolean):r.every(Boolean);},
  _evalCond(c,vals,hass,cfg){
    const v=parseFloat(c.threshold_w||c.threshold_pct||c.threshold_kwh||0);
    // Forecast aus erster Quelle des ersten Panels
    const fc=(this._fPanels[0]?.sources[0]?._cache)||{};
    switch(c.type){
      case"watt_gt":    return vals.solarW>v;
      case"watt_lt":    return vals.solarW<v;
      case"surplus_gt": return vals.surplus>v;
      case"surplus_lt": return vals.surplus<v;
      case"soc_gt":     return vals.battPct>v;
      case"soc_lt":     return vals.battPct<v;
      case"entity_on":  return this._getSimState(c.entity,this._card)==="on";
      case"entity_off": return this._getSimState(c.entity,this._card)==="off";
      case"time_between":{const now=new Date(),hm=now.getHours()*60+now.getMinutes();const[fh,fm]=(c.time_from||"00:00").split(":").map(Number);const[th,tm]=(c.time_to||"23:59").split(":").map(Number);const from=fh*60+fm,to=th*60+tm;return from<=to?(hm>=from&&hm<=to):(hm>=from||hm<=to);}
      case"forecast_today_gt":  return (parseFloat(fc.today)||0)>v;
      case"forecast_today_lt":  return (parseFloat(fc.today)||0)<v;
      case"forecast_tomorrow_gt":return(parseFloat(fc.tomorrow)||0)>v;
      case"weather_is":     return (this._weatherCache?.condition||"").includes(c.weather_cond||"");
      case"entity_state":   return (this._getSimState(c.entity,this._card)||"")===(c.compare_value||"");
      case"entity_num_gt":  return parseFloat(this._getSimState(c.entity,this._card)||0)>parseFloat(c.compare_value||0);
      case"entity_num_lt":  return parseFloat(this._getSimState(c.entity,this._card)||0)<parseFloat(c.compare_value||0);
      default:return false;
    }
  },
  _runActions(actions,hass,card){const cfg=card._opts?.elektro_v4_cfg||{};const res=s=>s?.replace(/\{\{(\w+)\}\}/g,(_,k)=>cfg[k]||s);actions.forEach(a=>{const eid=res(a.entity);switch(a.type){case"switch_on":if(eid)hass.callService("switch","turn_on",{entity_id:eid}).catch(()=>{});break;case"switch_off":if(eid)hass.callService("switch","turn_off",{entity_id:eid}).catch(()=>{});break;case"switch_toggle":if(eid)hass.callService("switch","toggle",{entity_id:eid}).catch(()=>{});break;case"notify":hass.callService("notify","notify",{message:a.message||""}).catch(()=>{});break;}});},

  // Sofortiger Simulations-Durchlauf (ohne Poll-Wartezeit)
  _runSimCycle(card){
    if(!this._simActive||!card?._hass)return;
    const vals=this._getVals(card);
    const cfg=card?._opts?.elektro_v4_cfg||{};
    this._autos.forEach(auto=>{
      if(auto.enabled===false)return;
      const met=this._evalAuto(auto,vals,card._hass,cfg);
      const now=Date.now();
      // Im Sim-Modus: Cooldown stark reduziert (3 Sekunden statt Minuten)
      const last=this._lastAutoRun[auto.id]||0;
      const cd=3000;
      if(met&&now-last>cd){
        this._runSimActions(auto.actions||[],card);
        this._lastAutoRun[auto.id]=now;
        auto._lastState=true;
        this._log.unshift({ts:now,name:auto.name,sim:true,
          vals:{solarW:vals.solarW.toFixed(0),battPct:vals.battPct.toFixed(0)}});
        if(this._log.length>200)this._log.pop();
        card._showToast?.(`\u25C6 ${auto.name} [SIM]`);
      }else if(!met&&auto._lastState){
        if((auto.actions_else||[]).length)this._runSimActions(auto.actions_else,card);
        auto._lastState=false;
      }
    });
  },

  // Simulierter State einer Entity (sim-Wert hat Vorrang vor echtem HA-State)
  _getSimState(entityId,card){
    if(!entityId)return undefined;
    if(this._simActive&&entityId in this._simStates)return this._simStates[entityId];
    return card?._hass?.states?.[entityId]?.state;
  },

  // Aktionen nur in _simStates schreiben – kein callService, kein DB-Eintrag
  _runSimActions(actions,card){
    const cfg=card?._opts?.elektro_v4_cfg||{};
    const res=s=>s?.replace(/\{\{(\w+)\}\}/g,(_,k)=>cfg[k]||s);
    actions.forEach(a=>{
      const eid=res(a.entity);
      if(!eid)return;
      switch(a.type){
        case"switch_on":     this._simStates[eid]="on";  break;
        case"switch_off":    this._simStates[eid]="off"; break;
        case"switch_toggle": this._simStates[eid]=(this._getSimState(eid,card)==="on")?"off":"on"; break;
        case"notify": card?._showToast?.(`\uD83D\uDD14 [SIM] ${a.message||"Benachrichtigung"}`); break;
      }
    });
  },
  _analyzeSystem(card,vals){const h=this._history;if(h.length<10)return["Zu wenig Daten."];const avgS=h.reduce((a,v)=>a+v.surplus,0)/h.length;const minB=Math.min(...h.map(v=>v.battPct));const isWinter=new Date().getMonth()+1<=3||new Date().getMonth()+1>=10;const existIds=this._autos.map(a=>a.source_suggestion).filter(Boolean);const ins=[];if(avgS>300&&!existIds.includes("s2"))ins.push(`\uD83D\uDCA1 \u00D8${avgS.toFixed(0)}W Uberschuss \u2013 Boiler empfohlen`);if(minB<25&&!existIds.includes("s1"))ins.push(`\u26A0 Batt war bei ${minB.toFixed(0)}% \u2013 Tiefentladungsschutz fehlt`);if(isWinter)ins.push(`\u2744 Winter \u2013 Batterie-Schutz prufen`);return ins.length?ins:["\u2705 Gut konfiguriert."];},

  // ── Helpers ───────────────────────────────────────────────────────────────
  _mkField(label,value,onChange){const row=document.createElement("div");const lbl=document.createElement("div");lbl.style.cssText="font-size:7px;color:#445566;margin-bottom:2px";lbl.textContent=label;const inp=document.createElement("input");inp.type="text";inp.value=value;inp.style.cssText="width:100%;padding:3px 6px;border-radius:4px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-size:8px";inp.addEventListener("input",()=>onChange(inp.value));row.append(lbl,inp);return row;},
  _mkEntityPicker(label,value,domains,onChange,card){const wrap=document.createElement("div");const lbl=document.createElement("div");lbl.style.cssText="font-size:7px;color:#445566;margin-bottom:2px";lbl.textContent=label;const row=document.createElement("div");row.style.cssText="display:flex;gap:3px";const inp=document.createElement("input");inp.type="text";inp.value=value||"";inp.placeholder=`${(domains||[]).join("/")} Entity`;inp.style.cssText="flex:1;padding:3px 5px;border-radius:4px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-size:7.5px";inp.addEventListener("input",()=>onChange(inp.value.trim()));const pb=document.createElement("button");pb.style.cssText="padding:3px 6px;border-radius:4px;border:1px solid #38bdf8;background:transparent;color:#38bdf8;font-size:8px;cursor:pointer";pb.textContent="\uD83D\uDD0D";pb.addEventListener("click",()=>{const entities=this._getEntities(card,domains);const dl=document.createElement("div");dl.style.cssText="position:fixed;z-index:9999;background:#0d1219;border:1px solid #334155;border-radius:6px;max-height:180px;overflow-y:auto;width:220px;box-shadow:0 4px 12px #000a";const si=document.createElement("input");si.type="text";si.placeholder="Suchen\u2026";si.style.cssText="width:100%;padding:4px 6px;border:none;border-bottom:1px solid #334155;background:transparent;color:var(--text);font-size:8px;box-sizing:border-box";dl.appendChild(si);const rl=f=>{dl.querySelectorAll(".pi").forEach(e=>e.remove());entities.filter(e=>!f||e.id.includes(f)||e.name.toLowerCase().includes(f.toLowerCase())).slice(0,30).forEach(e=>{const item=document.createElement("div");item.className="pi";item.style.cssText="padding:4px 8px;cursor:pointer;font-size:7.5px;border-bottom:1px solid #0d121966;display:flex;gap:6px";item.innerHTML=`<span style="color:#445566;font-size:6.5px;flex:1">${e.id}</span><span style="color:${e.state==="on"?"#22c55e":"#445566"};font-size:6.5px">${e.state}</span>`;item.addEventListener("click",()=>{inp.value=e.id;onChange(e.id);dl.remove();});item.addEventListener("mouseenter",()=>item.style.background="#1c2535");item.addEventListener("mouseleave",()=>item.style.background="");dl.appendChild(item);});};si.addEventListener("input",()=>rl(si.value));rl("");document.body.appendChild(dl);const rect=pb.getBoundingClientRect();dl.style.top=(rect.bottom+4)+"px";dl.style.left=Math.max(4,rect.left-80)+"px";const close=e=>{if(!dl.contains(e.target)&&e.target!==pb){dl.remove();document.removeEventListener("click",close);}};setTimeout(()=>document.addEventListener("click",close),100);});row.append(inp,pb);wrap.append(lbl,row);return wrap;},
};

// ── Helper außerhalb des Moduls (wird im eval-Kontext ausgeführt) ──────────
function _parsePeakHour(val){
  if(!val)return 13;
  if(typeof val==="number")return val;
  if(typeof val==="string"){
    // ISO-Datetime: "2026-03-22T10:00:00+00:00" → lokale Stunde
    if(val.includes("T")){
      try{
        const d=new Date(val);
        if(!isNaN(d.getTime()))return d.getHours()+d.getMinutes()/60;
      }catch(e){}
    }
    // "10:30" → 10.5
    const m=val.match(/^(\d{1,2}):(\d{2})/);
    if(m)return parseInt(m[1])+parseInt(m[2])/60;
    // reine Zahl "13"
    const n=parseFloat(val);
    if(!isNaN(n)&&n>=0&&n<=24)return n;
  }
  return 13;
}

// Ende ElektroModul v4.3


// Modul beim Registry anmelden
if (typeof BLEModuleRegistry !== 'undefined') {
  BLEModuleRegistry.register(ElektroModul);
} else {
  // Fallback: globale Variable für direkten Zugriff
  window._BLE_MODULE_ELEKTRO = ElektroModul;
}
