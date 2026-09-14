// ═══════════════════════════════════════════════════════════════════════════
// BLE Positioning – Modul-Basis (BLEModuleBase)
// Version: 1.0.0
// Gemeinsame Methoden für alle Canvas-Module (Elektro, Pool, Garten, ...)
// Wird NICHT als eigenständiges Modul registriert – nur als Mixin genutzt
// ═══════════════════════════════════════════════════════════════════════════

window.BLEModuleBase = window.BLEModuleBase || {

  // ── Simulation ────────────────────────────────────────────────────────────
  _simActive: false,
  _simStates: {},

  _getSimState(entityId, card){
    if(!entityId) return undefined;
    if(this._simActive && entityId in this._simStates)
      return this._simStates[entityId];
    return card?._hass?.states?.[entityId]?.state;
  },

  _runSimActions(actions, card){
    const cfg = card?._opts?.[this.id+'_cfg'] || {};
    const res = s => s?.replace(/\{\{(\w+)\}\}/g, (_, k) => cfg[k] || s);
    actions.forEach(a => {
      const eid = res(a.entity); if(!eid) return;
      switch(a.type){
        case'switch_on':     this._simStates[eid]='on';  break;
        case'switch_off':    this._simStates[eid]='off'; break;
        case'switch_toggle': this._simStates[eid]=(this._getSimState(eid,card)==='on')?'off':'on'; break;
        case'input_boolean_on':  this._simStates[eid]='on';  break;
        case'input_boolean_off': this._simStates[eid]='off'; break;
        case'notify': card?._showToast?.(`\uD83D\uDD14 [SIM] ${a.message||'Benachrichtigung'}`); break;
      }
    });
  },

  _runSimCycle(card){
    if(!this._simActive || !card) return;
    const vals = this._getValsForSim ? this._getValsForSim(card) : {};
    this._autos.forEach(auto => {
      if(auto.enabled===false) return;
      const met = this._evalAuto(auto, vals, card);
      const now = Date.now(), last = this._lastAutoRun[auto.id]||0;
      if(met && now-last>3000){
        this._runSimActions(auto.actions||[], card);
        this._lastAutoRun[auto.id]=now; auto._lastState=true;
        this._log.unshift({ts:now, name:auto.name, sim:true});
        if(this._log.length>100) this._log.pop();
        card._showToast?.(`\u25C6 ${auto.name} [SIM]`);
      } else if(!met && auto._lastState){
        if((auto.actions_else||[]).length) this._runSimActions(auto.actions_else, card);
        auto._lastState=false;
      }
    });
    card._markDirty?.();
  },

  // ── Automations-Logik ──────────────────────────────────────────────────────
  _evalAuto(auto, vals, card){
    if(!auto?.conditions?.length) return false;
    const r = auto.conditions.map(c => this._evalCond(c, vals, card));
    return auto.operator==='OR' ? r.some(Boolean) : r.every(Boolean);
  },

  // Basis-Bedingungen (module-spezifische ergänzen per Object.assign)
  _evalCondBase(c, vals, card){
    switch(c.type){
      case'entity_on':    return this._getSimState(c.entity,card)==='on';
      case'entity_off':   return this._getSimState(c.entity,card)==='off';
      case'entity_state': return (this._getSimState(c.entity,card)||'')===(c.compare_value||'');
      case'entity_num_gt':return parseFloat(this._getSimState(c.entity,card)||0)>parseFloat(c.compare_value||0);
      case'entity_num_lt':return parseFloat(this._getSimState(c.entity,card)||0)<parseFloat(c.compare_value||0);
      case'time_between':{
        const now=new Date(), hm=now.getHours()*60+now.getMinutes();
        const[fh,fm]=(c.time_from||'00:00').split(':').map(Number);
        const[th,tm]=(c.time_to||'23:59').split(':').map(Number);
        const from=fh*60+fm, to=th*60+tm;
        return from<=to?(hm>=from&&hm<=to):(hm>=from||hm<=to);
      }
      default: return false;
    }
  },

  // ── Canvas-Interaktion ────────────────────────────────────────────────────
  _hitNode(x, y, W, H, dpr){
    const scale = Math.min(1, Math.min(W/dpr, H/dpr)/500);
    return this._nodes.slice().reverse().find(node=>{
      const nt = this.NODE_TYPES[node.type]||this.NODE_TYPES.custom;
      const r = (Math.min(node.w||nt.defaultW, node.h||nt.defaultH)/2+6)*dpr*scale;
      return Math.hypot(x-node.x*W, y-node.y*H)<r;
    })||null;
  },

  onTap(px, py, card){
    if(!card._canvas) return false;
    const c=card._canvas, W=c.width, H=c.height, dpr=window.devicePixelRatio||1;
    const hit = this._hitNode(px*dpr, py*dpr, W, H, dpr);
    if(hit){
      this._selNode = this._selNode===hit ? null : hit;
      card._rebuildSidebar?.(); card._markDirty?.(); return true;
    }
    if(this._selNode){ this._selNode=null; card._rebuildSidebar?.(); card._markDirty?.(); return true; }
    return false;
  },

  onDragStart(px, py, card){
    if(!this._editMode || !card._canvas) return false;
    const c=card._canvas, W=c.width, H=c.height, dpr=window.devicePixelRatio||1;
    const x=px*dpr, y=py*dpr;
    const hit = this._hitNode(x, y, W, H, dpr);
    if(!hit) return false;
    const nt=this.NODE_TYPES[hit.type]||this.NODE_TYPES.custom;
    const nw=(hit.w||nt.defaultW)*dpr, nh=(hit.h||nt.defaultH)*dpr;
    const nx=hit.x*W, ny=hit.y*H;
    // Resize-Handle Check
    if(Math.hypot(x-(nx+Math.min(nw,nh)/2+2*dpr), y-(ny+Math.min(nw,nh)/2+2*dpr))<8*dpr){
      this._resizeNode=hit; this._resizeStartX=px; this._resizeStartY=py;
      this._resizeStartW=hit.w||nt.defaultW; this._resizeStartH=hit.h||nt.defaultH;
      this._selNode=hit; return true;
    }
    this._dragNode=hit; this._selNode=hit;
    this._dragOffX = px-hit.x*(c.width/dpr);
    this._dragOffY = py-hit.y*(c.height/dpr);
    return true;
  },

  onDragMove(px, py, card){
    const c=card._canvas; if(!c) return;
    const dpr=window.devicePixelRatio||1, W=c.width/dpr, H=c.height/dpr;
    if(this._resizeNode){
      this._resizeNode.w=Math.max(28, this._resizeStartW+(px-this._resizeStartX));
      this._resizeNode.h=Math.max(20, this._resizeStartH+(py-this._resizeStartY));
      card._markDirty?.(); return;
    }
    if(this._dragNode){
      this._dragNode.x=Math.max(0.02, Math.min(0.98,(px-this._dragOffX)/W));
      this._dragNode.y=Math.max(0.04, Math.min(0.96,(py-this._dragOffY)/H));
      card._markDirty?.();
    }
  },

  onDragEnd(px, py, card){
    if(this._dragNode||this._resizeNode) this._save(card);
    this._dragNode=null; this._resizeNode=null;
  },

  // ── Saisonprüfung ─────────────────────────────────────────────────────────
  isActive(card){
    const cfg = card?._opts?.[this.id+'_cfg']||{};
    if(!cfg.saison_active) return true;
    const mm=new Date().getMonth()+1;
    const from=parseInt(cfg.saison_from||4), to=parseInt(cfg.saison_to||10);
    return from<=to ? mm>=from&&mm<=to : mm>=from||mm<=to;
  },

  // ── UI-Helpers ────────────────────────────────────────────────────────────
  _mkField(label, value, onChange){
    const row=document.createElement('div');
    const lbl=document.createElement('div');
    lbl.style.cssText='font-size:7px;color:#445566;margin-bottom:2px';
    lbl.textContent=label;
    const inp=document.createElement('input');
    inp.type='text'; inp.value=value||'';
    inp.style.cssText='width:100%;padding:3px 6px;border-radius:4px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-size:8px;box-sizing:border-box';
    inp.addEventListener('input', ()=>onChange(inp.value));
    row.append(lbl, inp); return row;
  },

  _mkEntityPicker(label, value, domains, onChange, card){
    const wrap=document.createElement('div');
    const lbl=document.createElement('div');
    lbl.style.cssText='font-size:7px;color:#445566;margin-bottom:2px';
    lbl.textContent=label;
    const row=document.createElement('div');
    row.style.cssText='display:flex;gap:3px';
    const inp=document.createElement('input');
    inp.type='text'; inp.value=value||'';
    inp.placeholder=`${(domains||[]).join('/')} Entity`;
    inp.style.cssText='flex:1;padding:3px 5px;border-radius:4px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-size:7.5px';
    inp.addEventListener('input', ()=>onChange(inp.value.trim()));
    const pb=document.createElement('button');
    pb.style.cssText='padding:3px 6px;border-radius:4px;border:1px solid #38bdf8;background:transparent;color:#38bdf8;font-size:8px;cursor:pointer';
    pb.textContent='\uD83D\uDD0D';
    pb.addEventListener('click', ()=>{
      const entities=Object.entries(card._hass?.states||{})
        .filter(([k])=>!domains||domains.some(d=>k.startsWith(d+'.')))
        .map(([k,s])=>({id:k,name:s.attributes?.friendly_name||k,state:s.state}));
      const dl=document.createElement('div');
      dl.style.cssText='position:fixed;z-index:9999;background:#0d1219;border:1px solid #334155;border-radius:6px;max-height:200px;overflow-y:auto;width:260px;box-shadow:0 4px 16px #000c';
      const si=document.createElement('input');
      si.type='text'; si.placeholder='Suchen\u2026';
      si.style.cssText='width:100%;padding:4px 8px;border:none;border-bottom:1px solid #334155;background:transparent;color:var(--text);font-size:8px;box-sizing:border-box';
      dl.appendChild(si);
      const render=f=>{
        dl.querySelectorAll('.pi').forEach(e=>e.remove());
        entities.filter(e=>!f||e.id.includes(f)||e.name.toLowerCase().includes(f.toLowerCase()))
          .slice(0,50).forEach(e=>{
            const item=document.createElement('div');
            item.className='pi';
            item.style.cssText='padding:4px 8px;cursor:pointer;font-size:7.5px;border-bottom:1px solid #0d121966;display:flex;gap:6px;align-items:center';
            item.innerHTML=`<span style="color:#445566;font-size:6.5px;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${e.id}</span><span style="color:${e.state==='on'?'#22c55e':'#445566'};font-size:6.5px;flex-shrink:0">${e.state}</span>`;
            item.addEventListener('click',()=>{inp.value=e.id;onChange(e.id);dl.remove();});
            item.addEventListener('mouseenter',()=>item.style.background='#1c2535');
            item.addEventListener('mouseleave',()=>item.style.background='');
            dl.appendChild(item);
          });
      };
      si.addEventListener('input',()=>render(si.value)); render('');
      document.body.appendChild(dl);
      const rect=pb.getBoundingClientRect();
      dl.style.top=(rect.bottom+4)+'px';
      dl.style.left=Math.max(4,rect.left-100)+'px';
      const close=e=>{if(!dl.contains(e.target)&&e.target!==pb){dl.remove();document.removeEventListener('click',close);}};
      setTimeout(()=>document.addEventListener('click',close),100);
    });
    row.append(inp,pb); wrap.append(lbl,row); return wrap;
  },

  _mkSavedBtn(label, color, onClick){
    const b=document.createElement('button');
    b.style.cssText=`padding:4px 10px;border-radius:4px;border:1px solid ${color};background:transparent;color:${color};font-size:8px;cursor:pointer;width:100%`;
    b.textContent=label;
    b.addEventListener('click', onClick);
    return b;
  },

  // ── Automations-Editor (gemeinsam, wird per Konfiguration angepasst) ───────
  _buildAutoEditorBase(card, COND, ACT, accentColor){
    const auto=this._selAuto;
    const div=document.createElement('div');
    div.style.cssText='display:flex;flex-direction:column;gap:4px';

    // Header
    const hdr=document.createElement('div');
    hdr.style.cssText='display:flex;align-items:center;gap:6px;margin-bottom:3px';
    hdr.innerHTML=`<span style="font-size:13px">\u25C6</span><span style="font-size:9px;font-weight:700;color:${accentColor}">Automation</span>`;
    const back=document.createElement('button');
    back.style.cssText='margin-left:auto;padding:2px 8px;border-radius:4px;border:1px solid var(--border);background:var(--surf2);color:var(--text);font-size:8px;cursor:pointer';
    back.textContent='\u2190';
    back.addEventListener('click',()=>{this._selAuto=null;card._rebuildSidebar?.();});
    hdr.appendChild(back); div.appendChild(hdr);

    const save=(k,v)=>{auto[k]=v;this._save(card);card._markDirty?.();};
    div.appendChild(this._mkField('Name', auto.name, v=>save('name',v)));

    // Operator
    const opRow=document.createElement('div');
    opRow.style.cssText='display:flex;gap:3px;margin-bottom:3px';
    ['AND','OR'].forEach(op=>{
      const b=document.createElement('button');
      const active=(auto.operator||'AND')===op;
      b.style.cssText=`flex:1;padding:3px;border-radius:3px;border:1px solid ${active?accentColor:'#1c2535'};background:${active?accentColor+'22':'var(--surf2)'};color:${active?accentColor:'#445566'};font-size:7.5px;cursor:pointer`;
      b.textContent=op==='AND'?'Alle Bedingungen (UND)':'Mind. eine (ODER)';
      b.addEventListener('click',()=>{save('operator',op);card._rebuildSidebar?.();});
      opRow.appendChild(b);
    });
    div.appendChild(opRow);

    // Bedingungen
    const ch=document.createElement('div');
    ch.style.cssText=`font-size:7.5px;font-weight:700;color:#94a3b8;margin-top:2px`;
    ch.textContent='WENN'; div.appendChild(ch);

    if(!auto.conditions) auto.conditions=[];
    auto.conditions.forEach((c,ci)=>{
      const ct=COND[c.type]||{};
      const rb=document.createElement('div');
      rb.style.cssText=`background:var(--surf2);border-radius:4px;padding:5px;border:1px solid ${accentColor}22;margin-bottom:3px`;
      rb.innerHTML=`<div style="font-size:7.5px;font-weight:700;color:${accentColor};margin-bottom:3px">${ct.icon||''} ${ct.label||c.type}</div>`;

      // Parameter rendern
      (ct.params||[]).forEach(param=>{
        if(param==='entity'){
          rb.appendChild(this._mkEntityPicker('Entity', c.entity,
            ct.domains||['switch','input_boolean','sensor','binary_sensor'],
            v=>{c.entity=v;this._save(card);}, card));
        } else if(param==='time_from'||param==='time_to'){
          const p=document.createElement('div');
          const pl=document.createElement('div');
          pl.style.cssText='font-size:6.5px;color:#445566;margin-bottom:1px';
          pl.textContent=param==='time_from'?'Von (HH:MM)':'Bis (HH:MM)';
          const pi=document.createElement('input'); pi.type='text'; pi.value=c[param]||'';
          pi.style.cssText='width:100%;padding:2px 5px;border-radius:3px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-size:7.5px';
          pi.addEventListener('input',()=>{c[param]=pi.value.trim();this._save(card);});
          p.append(pl,pi); rb.appendChild(p);
        } else {
          const p=document.createElement('div');
          const pl=document.createElement('div');
          pl.style.cssText='font-size:6.5px;color:#445566;margin-bottom:1px';
          pl.textContent={threshold:'Schwellwert',compare_value:'Vergleichswert',
                          weather_cond:'Wetter-Zustand'}[param]||param;
          const pi=document.createElement('input'); pi.type='text'; pi.value=c[param]||'';
          pi.placeholder=param==='compare_value'?'z.B. on / 22.5':'';
          pi.style.cssText='width:100%;padding:2px 5px;border-radius:3px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-size:7.5px';
          pi.addEventListener('input',()=>{c[param]=pi.value.trim();this._save(card);});
          p.append(pl,pi); rb.appendChild(p);
        }
      });

      const db=document.createElement('button');
      db.style.cssText='width:100%;padding:2px;border-radius:3px;border:1px solid #ef444466;background:transparent;color:#ef4444;font-size:7px;cursor:pointer;margin-top:3px';
      db.textContent='Entfernen';
      db.addEventListener('click',()=>{auto.conditions.splice(ci,1);this._save(card);card._rebuildSidebar?.();});
      rb.appendChild(db); div.appendChild(rb);
    });

    // Bedingung hinzufügen (gruppiert)
    const cs=document.createElement('select');
    cs.style.cssText='width:100%;padding:3px 5px;border-radius:4px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-size:7.5px;margin-bottom:4px';
    cs.appendChild(Object.assign(document.createElement('option'),{value:'',textContent:'+ Bedingung hinzufügen\u2026'}));
    const grps={};
    Object.entries(COND).forEach(([id,ct])=>{
      if(!grps[ct.grp]){grps[ct.grp]=document.createElement('optgroup');grps[ct.grp].label=ct.grp;}
      const o=document.createElement('option'); o.value=id; o.textContent=`${ct.icon} ${ct.label}`;
      grps[ct.grp].appendChild(o);
    });
    Object.values(grps).forEach(g=>{if(g.children.length)cs.appendChild(g);});
    cs.addEventListener('change',()=>{if(!cs.value)return;auto.conditions.push({type:cs.value});cs.value='';this._save(card);card._rebuildSidebar?.();});
    div.appendChild(cs);

    // Aktionen
    const ah=document.createElement('div');
    ah.style.cssText='font-size:7.5px;font-weight:700;color:#94a3b8;margin-top:2px';
    ah.textContent='DANN'; div.appendChild(ah);

    if(!auto.actions) auto.actions=[];
    auto.actions.forEach((a,ai)=>{
      const at=ACT[a.type]||{};
      const rb=document.createElement('div');
      rb.style.cssText='background:var(--surf2);border-radius:4px;padding:5px;border:1px solid #22c55e22;margin-bottom:3px';
      rb.innerHTML=`<div style="font-size:7.5px;font-weight:700;color:#22c55e;margin-bottom:3px">${at.icon||''} ${at.label||a.type}</div>`;
      (at.params||[]).forEach(param=>{
        if(param==='entity') rb.appendChild(this._mkEntityPicker('Entity', a.entity,
          at.domains||['switch','input_boolean'], v=>{a.entity=v;this._save(card);}, card));
        else {
          const p=document.createElement('div');
          const pl=document.createElement('div');
          pl.style.cssText='font-size:6.5px;color:#445566;margin-bottom:1px';
          pl.textContent={message:'Nachricht',duration:'Dauer (Sek)'}[param]||param;
          const pi=document.createElement('input'); pi.type='text'; pi.value=a[param]||'';
          pi.style.cssText='width:100%;padding:2px 5px;border-radius:3px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-size:7.5px';
          pi.addEventListener('input',()=>{a[param]=pi.value;this._save(card);});
          p.append(pl,pi); rb.appendChild(p);
        }
      });
      const db=document.createElement('button');
      db.style.cssText='width:100%;padding:2px;border-radius:3px;border:1px solid #ef444466;background:transparent;color:#ef4444;font-size:7px;cursor:pointer;margin-top:3px';
      db.textContent='Entfernen';
      db.addEventListener('click',()=>{auto.actions.splice(ai,1);this._save(card);card._rebuildSidebar?.();});
      rb.appendChild(db); div.appendChild(rb);
    });

    const as=document.createElement('select');
    as.style.cssText='width:100%;padding:3px 5px;border-radius:4px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-size:7.5px;margin-bottom:4px';
    as.appendChild(Object.assign(document.createElement('option'),{value:'',textContent:'+ Aktion hinzufügen\u2026'}));
    Object.entries(ACT).forEach(([id,at])=>{const o=document.createElement('option');o.value=id;o.textContent=`${at.icon} ${at.label}`;as.appendChild(o);});
    as.addEventListener('change',()=>{if(!as.value)return;auto.actions.push({type:as.value});as.value='';this._save(card);card._rebuildSidebar?.();});
    div.appendChild(as);

    // Sonst-Aktionen
    const aeh=document.createElement('div');
    aeh.style.cssText='font-size:7.5px;font-weight:700;color:#94a3b8;margin-top:2px';
    aeh.textContent='SONST (optional)'; div.appendChild(aeh);

    if(!auto.actions_else) auto.actions_else=[];
    if(auto.actions_else.length){
      auto.actions_else.forEach((a,ai)=>{
        const at=ACT[a.type]||{};
        const rb=document.createElement('div');
        rb.style.cssText='background:var(--surf2);border-radius:4px;padding:5px;border:1px solid #94a3b822;margin-bottom:3px';
        rb.innerHTML=`<div style="font-size:7px;font-weight:700;color:#94a3b8;margin-bottom:3px">${at.icon||''} ${at.label||a.type}</div>`;
        (at.params||[]).forEach(param=>{
          if(param==='entity') rb.appendChild(this._mkEntityPicker('Entity', a.entity,
            at.domains||['switch','input_boolean'], v=>{a.entity=v;this._save(card);}, card));
        });
        const db=document.createElement('button');
        db.style.cssText='width:100%;padding:2px;border-radius:3px;border:1px solid #ef444466;background:transparent;color:#ef4444;font-size:7px;cursor:pointer;margin-top:3px';
        db.textContent='Entfernen';
        db.addEventListener('click',()=>{auto.actions_else.splice(ai,1);this._save(card);card._rebuildSidebar?.();});
        rb.appendChild(db); div.appendChild(rb);
      });
    }

    const aes=document.createElement('select');
    aes.style.cssText='width:100%;padding:3px 5px;border-radius:4px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-size:7.5px;margin-bottom:4px';
    aes.appendChild(Object.assign(document.createElement('option'),{value:'',textContent:'+ Sonst-Aktion\u2026'}));
    Object.entries(ACT).forEach(([id,at])=>{const o=document.createElement('option');o.value=id;o.textContent=`${at.icon} ${at.label}`;aes.appendChild(o);});
    aes.addEventListener('change',()=>{if(!aes.value)return;auto.actions_else.push({type:aes.value});aes.value='';this._save(card);card._rebuildSidebar?.();});
    div.appendChild(aes);

    // Cooldown
    div.appendChild(this._mkField('Cooldown (Min)', auto.cooldown_min||5, v=>{auto.cooldown_min=parseInt(v)||5;this._save(card);}));

    // Löschen
    const del=document.createElement('button');
    del.style.cssText='width:100%;padding:4px;border-radius:4px;border:1px solid #ef4444;background:transparent;color:#ef4444;font-size:8px;cursor:pointer;margin-top:4px';
    del.textContent='\uD83D\uDDD1 Automation löschen';
    del.addEventListener('click',()=>{
      this._autos=this._autos.filter(a=>a.id!==auto.id);
      this._selAuto=null; this._save(card); card._rebuildSidebar?.();
    });
    div.appendChild(del);
    return div;
  },

};