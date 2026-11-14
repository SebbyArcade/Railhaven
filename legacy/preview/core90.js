

// v107: trains 1-6 cost $1,000, then +$250 each (capped at $2,500 before Railway level 3; scrapping lowers it)
Object.defineProperty(COST,'train',{get:()=>{const p=1000+250*Math.max(0,S.trains.length-5);return S.beacon<3?Math.min(2500,p):p},configurable:true});
// ================= v90 SIMPLE CORE =================
// ONE RULE for every train: load at A what B wants, take it to B, get paid, come back empty, repeat.
// Towns (Ashford too) each have one order on the ladder Hamlet → Village → Town → City → Metropolis.
// Factories are ordinary stops: bring them raw goods (paid at half price), send their products to towns.
// Filled orders raise the Railway level, which unlocks factories and ports.
const RLV=[0,2,6,12,20,30,42,56,72,90],RUNL=['','🏭 Sawmill, Brickworks and Gristmill · ⚓ Docks','🏭 Steel Mill and Refinery · ⚓ bigger ports','⚓ Deepwater ports','🏭 Factories and industries grow to level 4','🚂 Express engines: every train 15% faster','🏭 Factories and industries grow to level 5','🚃 Longer trains: +20% cargo everywhere','🚂 Express engines II: another 15% faster','Top level'],FACP=.5,CORE_V=266;
SHED.slots=()=>99;S.starter=0;S.ties=S.ties||0;S.stats=S.stats||{};S.stats.del=S.stats.del||{};S.stats.orders=S.stats.orders||0;
if(typeof sites!=='undefined')for(const o of sites)if(o.hidden&&o.type==='dep')o.hidden=false;
function beaconCap(s){return 1e9}
function addTrainsHere(s){}
function roleOf(s){return null}
function fireEvent(){}
function startFest(){}
function autoJob(t){}
function jobTip(t){return''}
function hudLine(){const n=S.stats.orders||0,g=RLV[S.beacon];return'🛤 Railway level <b>'+S.beacon+'</b>'+(g?' · 📋 '+n+'/'+g+' orders':'')+' <span style="opacity:.6">▸ orders</span>'}
document.getElementById('dep').setAttribute&&document.getElementById('dep').setAttribute('onclick',"document.getElementById('jobsBtn').onclick()");
// what a place sends out, and what it takes in
var offerOf=A=>!A||A.hidden?null:isFac(A)?FAC[A.type].out:A.type==='town'||A.type==='plot'||A.type==='dep'||A.type==='port'||!TYPES[A.type]?null:carries('freight',A)[0]||null;
const isInd=A=>!!A&&!A.hidden&&!isFac(A)&&A.type!=='town'&&A.type!=='plot'&&A.type!=='dep'&&A.type!=='port'&&!!TYPES[A.type];
const gname=k=>TYPES[k].g+' '+GOOD[k].toLowerCase();
const tripSecs=d=>2*d/3.2+6;
function estTrip(k,B,d,cap){return Math.round(isFac(B)?TYPES[k].rate*DF(d)*cap*PAY*FACP:price(k,B,cap,d)*PAY)}
const capNew=()=>SHED.cap(1);

// how much a place makes, and how much its trains already take away (per minute)
const makeRate=A=>!A.linked&&!isConnected(A)?0:isFac(A)?FACT.rate(A.lvl||1)*60:IND.rate(A)*share(A)*60;

const srcFull=A=>srcUse(A)>=makeRate(A)*.9;
// every linked place that wants what A makes, nearest open order first
function destsFor(A){const k=offerOf(A);if(!k||!A.linked)return[];const b=bfs(id(A.x,A.y)),out=[];
 for(const B of sites){if(B===A||!B.linked||B.hidden||!accepts(B,k))continue;const d=b.dist[id(B.x,B.y)];if(!(d>0))continue;const o=B.type==='town'?ordOf(B):null,left=o&&o[k]?Math.max(0,o[k]-Math.floor((B.got||{})[k]||0)):0;
  out.push({B,i:sites.indexOf(B),d,k,left,pay:estTrip(k,B,d,capNew()),n:S.trains.filter(t=>t.route&&t.route.a===sites.indexOf(A)&&t.route.b===sites.indexOf(B)).length})}
 return out.sort((x,y)=>(y.left>0)-(x.left>0)||x.d-y.d)}
// every linked place that makes k, nearest to B first
function srcsFor(B,k){const b=bfs(id(B.x,B.y)),out=[];for(const A of sites){if(A===B||!A.linked||A.hidden||offerOf(A)!==k)continue;const d=b.dist[id(A.x,A.y)];if(!(d>0))continue;out.push({A,i:sites.indexOf(A),d,n:S.trains.filter(t=>t.route&&t.route.a===sites.indexOf(A)&&t.route.b===sites.indexOf(B)).length})}return out.sort((x,y)=>x.d-y.d)}
var brings=(B,k)=>S.trains.filter(t=>t.route&&sites[t.route.b]===B&&offerOf(sites[t.route.a])===k);
function newTrain(){if(S.money<COST.train){toast('A train costs '+fmt(COST.train)+': you need '+fmt(COST.train-S.money)+' more');return-1}S.money-=COST.train;const H=sites[hubI()];
 S.trains.push({born:Math.round(S.t),shed:0,w:'freight',st:'idle',wait:1,path:[[H.x,H.y]],pos:0,cargo:0,route:null,no:(S.tno=Math.max(S.tno||0,...S.trains.map(x=>x.no||0))+1)});return S.trains.length-1}
function buyTrain(){const j=newTrain();if(j<0)return;toast('🚂 New train: pick its job');showJobsFor(j)}
// "Send a train": an idle train takes the job, otherwise a new one is bought



// ---------- trains ----------
function dispatchJob(t){const here=trainTile(t),r=t.route,stay=why=>{t.why=why;t.path=[[here%N,(here/N)|0]];t.pos=0;t.st='idle';t.wait=3};
 if(!r){stay('No job yet: tap the train and pick one');return}
 const A=sites[r.a],B=sites[r.b];if(!A||!B){t.route=null;stay('Its route was lost: pick a new job');return}
 const k=offerOf(A);if(!k||!accepts(B,k)){stay(nm(B)+' does not want '+(k?GOOD[k].toLowerCase():'anything')+' from '+nm(A)+': change the job');t.stuck=(t.stuck||0)+3;return}
 const p=pathTo(bfs(here),id(A.x,A.y));if(!p){stay('No track from here to '+nm(A));t.stuck=(t.stuck||0)+3;return}
 t.k=k;t.src=r.a;t.dst=r.b;t.path=p;t.pos=0;t.st='toSrc';t.why='';t.lw=0;t.cargo=0}
function arrivedJob(t){const A=sites[t.src],B=sites[t.dst];if(!A||!B){t.st='idle';t.wait=1;return}
 if(t.st==='toSrc'){const cap=trainCap(t),avail=Math.floor(A.stock||0);
  // v107: a camp feeding several lines shares its goods evenly between them; a line that is a full load ahead waits its turn (at most 25 s)
  {const L=[...new Set(S.trains.filter(x=>x.route&&x.route.a===t.src).map(x=>x.route.b))];if(L.length>1&&L.includes(t.dst)){A.tk=A.tk||{};const def=L.filter(b=>A.tk[b]!==undefined).map(b=>A.tk[b]),m0=def.length?Math.min(...def):0;for(const b of L)if(A.tk[b]===undefined)A.tk[b]=m0;for(const b in A.tk)if(!L.includes(+b))delete A.tk[b];const mn=Math.min(...L.map(b=>A.tk[b]));
   const lagCome=S.trains.some(x=>x!==t&&x.st==='toSrc'&&x.src===t.src&&x.dst!==t.dst&&A.tk[x.dst]<A.tk[t.dst]);if(lagCome&&A.tk[t.dst]-mn>=cap&&avail<cap*2&&(t.sw||0)<25){t.sw=(t.sw||0)+1;t.wait=1;t.why='Sharing '+GOOD[t.k].toLowerCase()+' fairly with '+nm(A)+'\'s other lines';return}}}
  // wait up to 12 s for at least half a load, then leave with what is there (never leave empty)
  if(avail<cap*.5&&(t.lw||0)<12||avail<1){t.lw=(t.lw||0)+1;t.wait=1;if(avail<1)t.stuck=(t.stuck||0)+1;t.why=avail<1?(isFac(A)?nm(A)+' has made nothing yet: it needs '+Object.keys(FAC[A.type].in).map(gname).join(' and ')+' brought in':'Waiting for '+GOOD[t.k].toLowerCase()+' at '+nm(A)):'Loading at '+nm(A)+' ('+avail+'/'+cap+')';return}
  const load=Math.min(cap,avail);A.stock-=load;t.sw=0;if(A.tk&&A.tk[t.dst]!==undefined){A.tk[t.dst]+=load;const mn=Math.min(...Object.values(A.tk));for(const b in A.tk)A.tk[b]-=mn}t.cargo=load;t.plan=load;t.lw=0;t.stuck=0;t.why='';fxCrates(A,t,t.k,0);B.inc=B.inc||{};B.inc[t.k]=(B.inc[t.k]||0)+load;
  const p=pathTo(bfs(id(A.x,A.y)),id(B.x,B.y));if(!p){A.stock+=load;t.cargo=0;B.inc[t.k]=Math.max(0,B.inc[t.k]-load);t.st='idle';t.wait=3;t.why='No track from '+nm(A)+' to '+nm(B);return}
  t.path=p;t.pos=0;t.st='toDst';t.wait=1;return}
 if(t.st==='toDst'){const before=t.cargo;if(before>0)fxCrates(B,t,t.k,1);deliver(t,B,t._tl||t.path.length);if(B.inc&&t.k)B.inc[t.k]=Math.max(0,(B.inc[t.k]||0)-(before-t.cargo));
  if(t.cargo>0&&isFac(B)&&(t.lw||0)<20){t.lw=(t.lw||0)+1;t.wait=1;t.why=nm(B)+' is full of '+GOOD[t.k].toLowerCase()+': send its '+GOOD[FAC[B.type].out].toLowerCase()+' somewhere so it can take more';return}
  t.cargo=0;t.lw=0;t.st='idle';t.wait=1;if(t.stop){t.stop=0;t.route=null}return}
 t.st='idle';t.wait=1}
function deliver(t,here,dist){const k=t.k,load=t.cargo;if(!load||!k)return;let v=0,used=load;
 if(isFac(here)){here.inp=here.inp||{};const room=Math.max(0,Math.floor(FACT.buf(here.lvl||1)-(here.inp[k]||0)));used=Math.min(load,room);if(used<=0)return;here.inp[k]=(here.inp[k]||0)+used;v=Math.round(TYPES[k].rate*DF(dist)*used*PAY*FACP)}
 else{v=Math.round(price(k,here,load,dist)*PAY);addGot(here,k,load);here.dem=here.dem||{};here.dem[k]=Math.max(0,(here.dem[k]||0)-load);here.sup=here.sup||{};here.sup[k]=1}
 S.stats.del[k]=(S.stats.del[k]||0)+used;t.cargo=load-used;S.money+=v;S.earned=(S.earned||0)+v;led('deliveries',v);t.earn=(t.earn||0)+v;t.trips=(t.trips||0)+1;(t.eh=t.eh||[]).push([Math.round(S.t),v]);if(t.eh.length>12)t.eh.shift();
 floaty.push({x:here.x,y:here.y,txt:'+'+fmt(v),a:1})}
// what a train earned per minute over the last 3 minutes, minus what it costs to run
function tRate(t){const h=(t.eh||[]).filter(e=>S.t-e[0]<=180),age=Math.min(180,S.t-(t.born??S.t));if(age<60)return null;return Math.round(h.reduce((a,e)=>a+e[1],0)*60/age)}
const tCost=t=>Math.round(trainCost({...t,st:'toSrc',path:[0,0],pos:0})*fleetMul()*60);
function rateTxt(t){const r=tRate(t);if(r===null)return'';const p=r-tCost(t);return p<0?'<span style="color:#ffb36b">🟠 −'+fmt(-p)+'/min</span>':'<span style="color:#7fd36b">🟢 +'+fmt(p)+'/min</span>'}


// all the jobs a train could do, best paying first
function jobsFor(t){const out=[],cap=trainCap(t);for(const A of sites){if(!A.linked||!offerOf(A))continue;for(const o of destsFor(A)){const pay=estTrip(o.k,o.B,o.d,cap),pm=Math.round(pay*60/tripSecs(o.d)*Math.min(1,IND.rate&&isInd(A)?IND.rate(A)*share(A)*tripSecs(o.d)/cap:1));out.push({a:sites.indexOf(A),b:o.i,k:o.k,d:o.d,pay,pm,left:o.left,n:o.n})}}return out.sort((x,y)=>(y.left>0)-(x.left>0)||y.pm-x.pm)}
// a factory that cannot work: which inputs nobody is bringing
function facLack(f){return isFac(f)?Object.keys(FAC[f.type].in).filter(k=>(f.inp||{})[k]<FAC[f.type].in[k]&&!brings(f,k).length):[]}
function fixFacHtml(f){const L=facLack(f);if(!L.length)return'';const i=sites.indexOf(f);
 return L.map(k=>{const s=srcsFor(f,k)[0];return'<br>'+(s?lineBox(s.i,i,'brings '+gname(k)+' · '+s.d+' tiles'):'<small style="color:#ffb36b">Build a '+TYPES[k].n+' and link it by rail, then bring '+GOOD[k].toLowerCase()+' here</small>')}).join('')}
function showJobsFor(j){const t=S.trains[j];if(!t)return showShed(0);openShed=100+j;openFac=null;openInfo=null;const el=document.getElementById('panel');el.style.display='block';const nb='padding:5px 10px;border-radius:8px;border:1px solid #6b5a3e;background:#3a2f22;color:#f3e6c8;font-size:13px';
 let h=`<div style="margin:-8px -2px 4px;padding:6px 40px 6px 2px;position:sticky;top:-8px;z-index:2;background:#2a241b"><button onclick="showTrain(${j})" style="${nb}">‹ Train ${tNo(t)}</button></div><b style="font-size:15px">🗺 Pick a job for Train ${tNo(t)}</b><br><small style="opacity:.75">Load at the first place, deliver to the second. 📋 = it fills an open town order.</small>`;
 const L=jobsFor(t);if(!L.length)h+='<div style="margin-top:8px;color:#ffb36b">No jobs yet. Build an industry (🏗 Build), link it by rail to a town that wants its goods, then come back.</div>';
 for(const o of L.slice(0,14)){const cur=t.route&&t.route.a===o.a&&t.route.b===o.b;h+=`<div style="border-top:1px solid #3d3326;margin-top:5px;padding-top:4px">${TYPES[o.k].g} <b>${nm(sites[o.a])} → ${nm(sites[o.b])}</b>${o.left>0?' <span style="color:#7fd36b">📋 needs '+o.left+'</span>':''}<br><small style="opacity:.75">${o.d} tiles · ≈${fmt(o.pay)} a trip${o.n?' · 🚂 '+o.n+' already':''}</small><br>`+(cur?'<small style="color:#7fd36b">✓ current job</small>':tbtn('Take this job',`assignJob(${j},${o.a},${o.b})`))+'</div>'}
 el.innerHTML=h}
function showTrain(j){const t=S.trains[j];if(!t)return showShed(0);const fresh=openShed!==100+j;openFac=null;openInfo=null;openShed=100+j;sel=null;spot=null;flowSel=null;const el=document.getElementById('panel');if(fresh)setTimeout(()=>el.scrollTop=0,0);el.style.display='block';
 const C='border-top:1px solid #3d3326;margin-top:7px;padding-top:6px',nb='padding:5px 10px;border-radius:8px;border:1px solid #6b5a3e;background:#3a2f22;color:#f3e6c8;font-size:13px',n=S.trains.length,pr=(j-1+n)%n,nx=(j+1)%n;
 let h=`<div style="display:flex;gap:5px;align-items:center;margin:-8px -2px 4px;padding:6px 40px 6px 2px;position:sticky;top:-8px;z-index:2;background:#2a241b"><button onclick="showShed(0)" style="${nb}">‹ All trains</button><span style="flex:1"></span>`+(n>1?`<button onclick="showTrain(${pr})" style="${nb}">‹</button><small style="opacity:.75">${j+1}/${n}</small><button onclick="showTrain(${nx})" style="${nb}">›</button>`:'')+`</div>`;
 h+=`<span style="display:inline-block;width:12px;height:12px;border-radius:6px;background:${lineCol(j)}"></span> <b style="font-size:15px">🚃 Train ${tNo(t)}</b>`;
 h+=`<div style="${C}"><b>Job</b> ${jobTxt(t)}<br><small style="opacity:.8">${trainStatus(t)}</small>`+(tProblem(t)&&t.route?`<br><span style="color:#ffb36b">⚠ ${tProblem(t)}</span>`:'')+(t.route&&isFac(sites[t.route.a])?fixFacHtml(sites[t.route.a]):'')+(t.route?'':(()=>{const L=jobsFor(t).slice(0,3);return L.length?'<div style="margin-top:5px"><b style="color:#ffd27a">Best jobs for it</b></div>'+L.map(o=>`<div style="margin-top:4px">${TYPES[o.k].g} <b>${nm(sites[o.a])} → ${nm(sites[o.b])}</b>${o.left>0?' <small style="color:#7fd36b">📋 needs '+o.left+'</small>':''}<br><small style="opacity:.75">${o.d} tiles · ≈${fmt(o.pay)} a trip</small> `+tbtn('Take it',`assignJob(${j},${o.a},${o.b})`)+'</div>').join(''):'<br><small style="color:#ffb36b">No jobs yet: link an industry to a town that wants its goods.</small>'})())+'<br>'+ubtn(t.route?'🗺 Change job':'🗺 All jobs',`showJobsFor(${j})`)+(t.route?t.stop?'<small style="opacity:.8"> ⏸ stops after this load</small>':ubtn(t.cargo>0?'⏸ Stop after this load':'⏸ Stop',`stopTrain(${j})`):'')+'</div>';
 {const jt=jamTiles(t);if(jt.length)h+=`<div style="${C}"><b>⏳ Trains queue on this line</b><br>`+ubtn('🛤🛤 Double the busy stretch · '+jt.length+' tiles · '+fmt(jt.length*DBL),`dblJam(${j})`,S.money<jt.length*DBL)+'</div>'}
 h+=`<div style="${C}">💰 Earned <b>${fmt(t.earn||0)}</b> in ${t.trips||0} trips${!t.route?'<br><span style="color:#ffb36b">💤 Parked: costs '+fmt(tCost(t))+'/min while it waits. Give it a job above, or sell it.</span>':tRate(t)!==null?(()=>{const p=tRate(t)-tCost(t);return p>=0?'<br><b style="color:#7fd36b">🟢 Profitable: +'+fmt(p)+'/min</b> <small style="opacity:.7">(earns '+fmt(tRate(t))+', costs '+fmt(tCost(t))+')</small>':'<br><b style="color:#ffb36b">🟠 Losing money: −'+fmt(-p)+'/min</b><br><small style="color:#ffb36b">Change its job (its town may have filled its order) or sell it</small>'})():''}<br>📦 Load <b>${trainCap(t)}</b> · ⚡ ${t.fast?'fast':'normal'} speed</div>`;
 h+=`<div style="${C}"><b>Upgrades</b><br><small style="opacity:.8">Speed, wagons, range and running costs are upgraded for all trains at once in the Engine shed.</small><br>`+ubtn('🚂 Open Engine shed upgrades','showShed(0)',false)+'</div>';
 h+=`<div style="${C}">`+ubtn('Sell · +'+fmt(COST.train/2),`sellTrain(${j})`,t.cargo>0)+`<br><small style="opacity:.6">Costs ${fmt(Math.round(COST.trainRun*60))}/min moving, ${fmt(Math.round(COST.trainWait*60))}/min waiting</small></div>`;
 el.innerHTML=h}

// ---------- place panels ----------
const sec2=t=>`<div style="border-top:1px solid #3d3326;margin-top:7px;padding-top:5px">${t}</div>`;
// every place lists the trains that load or unload there, each with a one-tap Change job

// ---------- train chooser: every 'send' opens one sheet: use a free train, buy one, or move a busy one ----------
const tbtn=(lbl,fn,dis)=>`<button ${dis?'disabled':''} onclick="${fn}" style="margin:4px 4px 0 0;padding:6px 10px;border-radius:8px;border:0;background:#2e7d6b;color:#fff;font-weight:700;font-size:12px;box-shadow:0 2px 0 #1b4d42;${dis?'opacity:.35':''}">${lbl}</button>`;
const tcard=(j,inner)=>`<div style="margin-top:6px;padding:6px 8px;border-radius:9px;background:#1f2a28;border-left:5px solid ${lineCol(j)}">${inner}</div>`;
let chBack=null;

function chooseBack(){const p=chBack;chBack=null;if(p&&p.n&&window[p.n]){try{window[p.n](...p.a);return}catch(e){}}closePanel()}

// reassign one of this place's trains to another destination and stay on this card
function moveTrain(j,a,b){assignJob(j,a,b);showInfo(sites[a])}
function sendList(A){const k=offerOf(A);if(!k)return'';if(!A.linked)return sec2('<span style="color:#ffb36b">Link it to your track first, then send its '+GOOD[k].toLowerCase()+' to a town.</span>');const D=destsFor(A);
 const mk=Math.round(makeRate(A)),us=srcUse(A);return sec2(`<b>🚃 Send ${gname(k)} to…</b>`+(us?`<br><small style="opacity:.8">Makes ${mk}/min${isFac(A)?' (with inputs)':''} · its trains carry ≈${us}/min</small>`:'')+(us&&srcFull(A)?'<br><small style="color:#ffb36b">⚠ Its trains already take all it makes: more trains here would wait. ⬆ Expand it or build another one.</small>':'')+(D.length?(()=>{const row=(o,best)=>`<div style="margin-top:${best?6:4}px;${best?'border:1.5px solid #7fd36b;border-radius:9px;padding:6px 8px;background:#24321d':''}">${best?'<b style="color:#7fd36b">⭐ Best move</b><br>':''}${o.B.type==='town'?'🏘':'🏭'} <b>${nm(o.B)}</b> <small style="opacity:.85">${o.left>0?'<span style="color:#7fd36b">📋 fills an order: '+o.left+' needed</span>':isFac(o.B)?'factory input':'buys it'} · ${o.d} tiles · ≈${fmt(o.pay)} a trip${o.n?' · 🚂 '+o.n+' on it':''}</small><br>`+lineCtl(sites.indexOf(A),o.i)+'</div>';
  const bi=D.findIndex(o=>o.left>0&&!o.n),b=bi>=0?D[bi]:null,rest=D.filter(o=>o!==b).slice(0,5);return(b?row(b,1):'')+(rest.length?(b?'<div style="margin-top:6px;opacity:.75"><small>Other places that buy it</small></div>':'')+rest.map(o=>row(o,0)).join(''):'')})():'<br><small style="color:#ffb36b">No linked town wants '+GOOD[k].toLowerCase()+' yet. Link more towns: each order asks for different goods.</small>'))}
function _showInfo(s){if(s.type==='port'){showPort(s);return}if(s.type==='dep'||s.type==='plot')return _showInfoOld(s);if(isFac(s))return showFactory(sites.indexOf(s));openShed=null;openFac=null;openInfo=null;const el=document.getElementById('panel');el.style.display='block';const i=sites.indexOf(s);
 if(s.type==='town'){el.innerHTML=townHtml(s,i);return}
 const L=IND.lvl(s);let h=`<b style="font-size:15px">${TYPES[s.type].g} ${TYPES[s.type].n}</b>${L>1?' · level '+L:''}<br>Stock <b>${Math.floor(s.stock)}</b>/${IND.cap(s)} · makes <b>${Math.round(IND.rate(s)*share(s)*60)}</b>/min`+(s.type==='farm'?'<br>🌾 Fields: '+fieldsOf(s).length+'/8':'')+(s.type==='wood'?'<br>🌲 Forest in reach: '+forestNear(s).length+' tiles'+(forestNear(s).length<6?' <span style="color:#ffb36b">(thinning: trees grow back)</span>':''):'')+(isConnected(s)?'':'<br><span style="color:#ffb36b">Not connected: it makes nothing until track touches it</span>')+connectTxt(s);
 h+=trainsHere(s)+sendList(s);
 h+=sec2(trackBtn(s)+(L<IND.maxL?ubtn('⬆ Expand · '+fmt(PRICE.ind(s).m)+' · '+Math.round(IND.rate({type:s.type,lvl:L+1})*60)+'/min',`upInd(${i})`,S.money<PRICE.ind(s).m):''));el.innerHTML=h}


// ---------- map badges ----------
function needBadges(s){if(s.hidden||!s.linked)return[];const i=sites.indexOf(s);
 if(isInd(s)||isFac(s)){if(!S.trains.some(t=>t.route&&t.route.a===i))return[{g:'🚃',c:'#c0392b'}];return[]}
 if(s.type==='town'&&s.pop>0){const o=ordOf(s);if(o&&!Object.keys(o).some(k=>((s.got||{})[k]||0)<o[k]&&brings(s,k).length))return[{g:'📋',c:'#d9822b'}]}return[]}
// ---------- goals, tutorial, orders board ----------
TUT.length=0;TUT.push(
 {t:'Ashford wants 🪵 wood. Tap <b>🏗 Build</b>, choose <b>🪵 Lumber Camp</b>, then tap a glowing spot near the forest.',ok:()=>sites.some(o=>o.type==='wood'),el:'build'},
 {t:'🛤 <b>Connect the Lumber Camp to Ashford</b>: tap <b>✓ Build</b> on the track shown. Closed it? Tap the camp, then <b>🔗 Connect to rail</b>.',ok:()=>sites.some(o=>o.type==='wood'&&o.linked),el:'build'},
 {t:'Start your first <b>line</b>: in the card that pops up, tap <b>＋ New line to Ashford</b> (or tap the camp → <b>＋ New line from here</b>, then tap Ashford). A train is bought and starts running.',ok:()=>(S.L||[]).some(L=>L.s.some(i=>sites[i]&&sites[i].type==='wood'))&&S.trains.some(t=>t.ln!=null)},
 {t:'Ashford also wants 🌾 wheat: build a <b>🌾 Farm</b> on glowing grass and link it, then <b>add it to your line</b>. One line can carry wood and wheat.',ok:()=>(S.L||[]).some(L=>L.s.some(i=>sites[i]&&sites[i].type==='farm')),el:'build'},
 {t:'Fill Ashford\'s order (tap Ashford to see it). A filled order grows the town, pays a reward and counts toward your Railway level.',ok:()=>(S.stats.orders||0)>=1},
 {t:'Fill one more order to reach <b>Railway level 2</b>: factories unlock. Link a new town by rail for a fresh order.',ok:()=>S.beacon>=2},
 {t:'Build a <b>🏭 Sawmill</b> right next to your track: <b>🏗 Build → Factories</b>. It turns wood into planks, which bigger towns need.',ok:()=>sites.some(o=>isFac(o)&&!o.hidden),el:'build'},
 {t:'Put the <b>Sawmill</b> on a line with a <b>Lumber Camp</b> (tap it → <b>Add to a line</b>). Wood goes in, and the same line takes the planks to a town on it that wants them. 🎓 That\'s the whole game: then explore and link more towns!',ok:()=>(S.L||[]).some(L=>L.s.some(i=>isFac(sites[i]))&&L.s.some(i=>sites[i]&&sites[i].type==='wood'))});
function growCard(s){const o=ordOf(s),r=LREW[s._seenL-1]||0,g=RLV[S.beacon],n=S.stats.orders||0,big=(S.grown||0)<=3,next=o?Object.keys(o).map(k=>TYPES[k].g+' '+o[k]).join('  '):'';
 if(!big){toast('🎉 '+s.name+' grew into a '+tier(s.pop)+'! '+(o?'Next order: '+next:'It is as big as a town gets'));return}
 notice(`<div style="text-align:center"><b style="color:#ffd27a;font-size:20px">🎉 ${s.name.toUpperCase()} GREW!</b><br><span style="font-size:15px">${tier(LPOP[s._seenL-1]||1)} → <b>${tier(s.pop)}</b></span><br><b style="color:#7fd36b;font-size:16px">+${fmt(Math.round(r*festMul(s)))}</b><br>`+(g?`🛤 Railway level ${S.beacon}: <b>${n} / ${g}</b> orders toward level ${S.beacon+1}`:`🛤 Railway level ${S.beacon}`)+`</div>`+(o?`<div style="margin-top:6px">📋 Next order: <b>${next}</b></div>`:'')+`<div style="margin-top:4px;color:#ffd27a">💡 ${nextTip()}</div>`)}
let tipGo=null;const goSite=o=>()=>{focusTile(o.x,o.y);showInfo(o)};
function nextTip(){tipGo=null;
 {const sp=S.trains.filter(t=>!t.route&&t.w==='freight'&&!(t.cargo>0)).length;if(sp>=2&&S.L&&S.t>60){tipGo=()=>{document.querySelectorAll('#tools button').forEach(b=>b.classList.toggle('on',b.dataset.m==='trains'));mode='trains';showShed(0)};return'💤 '+sp+' spare trains wait in the shed and cost upkeep: sell them in 🚂 Trains'}}
 {const c=chap();if(!c.free&&c.isl!==homeIsl()&&!(S.isl||[]).includes(c.isl)&&S.beacon>=1){const I=ISLS[c.isl];tipGo=()=>{document.querySelector('[data-m=build]').click();pickBuild('port');if(ports().some(o=>o.linked)){cam.x=(I.x+.5)*TS;cam.y=(I.y+.5)*TS;cam.z=Math.min(cam.z,.7)}else{let b=null,bd=1e9;for(const i of track){const x=i%N,y=(i/N)|0;for(const[dx,dy]of D4){const X=x+dx,Y=y+dy;if(!rev[id(X,Y)]||!coastal(X,Y)||siteAt(X,Y))continue;const d=Math.hypot(X-I.x,Y-I.y);if(d<bd){bd=d;b=[X,Y]}}}if(!b){const T=[...track].map(i=>[i%N,(i/N)|0]);for(let y=1;y<N-1;y++)for(let x=1;x<N-1;x++){if(!rev[id(x,y)]||!coastal(x,y)||siteAt(x,y))continue;let m=1e9;for(const q of T){const d=Math.abs(q[0]-x)+Math.abs(q[1]-y);if(d<m)m=d}if(m<bd){bd=m;b=[x,y]}}}if(b){cam.x=(b[0]+.5)*TS;cam.y=(b[1]+.5)*TS;cam.z=Math.max(cam.z,1.2)}}};return'🏁 Chapter goal: reach '+islName(c.isl)+': build a ⚓ Dock on your coast (🏗 Build → ⚓ Dock), then a landing there'}}
 {const f=sites.find(o=>isFac(o)&&o.linked&&facLack(o).length);if(f){tipGo=goSite(f);const k=facLack(f)[0],s=srcsFor(f,k)[0];return s?'Bring '+gname(k)+' from '+nm(s.A)+' to the '+TYPES[f.type].n+' (tap the '+TYPES[f.type].n+')':'The '+TYPES[f.type].n+' needs '+gname(k)+': build a '+TYPES[k].n+' and link it'}}
 const T=sites.filter(o=>o.type==='town'&&o.linked&&o.pop>0&&ordOf(o)).sort((a,b)=>tlvl(a)-tlvl(b));
 for(const s of T){const o=ordOf(s);for(const k in o){if(((s.got||{})[k]||0)>=o[k]||brings(s,k).length)continue;const src=srcsFor(s,k)[0];if(src){tipGo=goSite(s);return'Send '+gname(k)+' from '+nm(src.A)+' to '+s.name}const fk=Object.keys(FAC).find(x=>FAC[x].out===k);if(fk&&FAC[fk].lvl>S.beacon)continue;tipGo=goSite(s);return s.name+' wants '+gname(k)+': build a '+mkr(k)+' and link it'}}
 const un=sites.filter(o=>o.type==='town'&&!o.linked&&!o.hidden&&rev[id(o.x,o.y)]);if(un.length){tipGo=goSite(un[0]);return'Link '+un[0].name+' by rail: every new town brings a new order'}const hz=HINTS.filter(h=>h.type==='town'&&h._dir).concat(HINTS.filter(h=>h.type!=='town'&&h._dir));if(hz.length){const h=hz.sort((a,b)=>parseInt(a._dir)-parseInt(b._dir))[0];tipGo=()=>{cam.x=(h.x+.5)*TS;cam.y=(h.y+.5)*TS};return'🧭 '+(h.type==='town'?'Smoke rising':h.type==='plot'?'Open land':'Something odd')+' '+h._dir+': scout it or build track there'}return'🧭 Scout the fog for new towns, or build a ⚓ port to reach other islands'}
function tickMissions(dt){if(S.contracts.length||S.offers.length){S.contracts=[];S.offers=[]}newsT-=dt;S.fest=null;
 if(S.beacon<RLV.length&&(S.stats.orders||0)>=RLV[S.beacon]&&islOk(S.beacon+1)){S.beacon++;const r=S.beacon*500,b=sites[hubI()];S.money+=r;led('ashford',r);reveal(b.x,b.y,6+3*S.beacon);discover();toast('🛤 Railway level '+S.beacon+'! +'+fmt(r)+' · unlocks '+RUNL[S.beacon-1]);news('🛤 Railway level '+S.beacon+': '+RUNL[S.beacon-1]+' unlocked')}
 // a filled order: a celebration card for the first few, then a short message
 for(const s of sites){if(s.type!=='town')continue;const L=tlvl(s);if(s._seenL===undefined){s._seenL=L;continue}if(L>s._seenL){s._seenL=L;S.grown=(S.grown||0)+1;growCard(s)}}
 // a town joins the railway: its first order, and a special card for the first town on a new island
 for(const s of sites){if(s.type!=='town'||!s.linked||s._lk)continue;s._lk=1;if(s.beacon||!S.t)continue;const o=ordOf(s),k=ISLC[id(s.x,s.y)],H=sites[hubI()],home=k===ISLC[id(H.x,H.y)],first=!home&&!sites.some(q=>q!==s&&q.type==='town'&&q._lk&&ISLC[id(q.x,q.y)]===k),og=o?Object.keys(o).map(g=>TYPES[g].g+' '+o[g]+' '+GOOD[g].toLowerCase()).join(', '):'';
  if(first&&o)notice(`<b style="color:#ffd27a;font-size:16px">🏝 ${s.name}'s first request</b><br>“Welcome to ${ISLS[k]&&ISLS[k].nm||'our island'}! We need <b>${og}</b>.”<br>Reward <b style="color:#7fd36b">${fmt(Math.round(LREW[tlvl(s)]*festMul(s)))}</b> · tap ${s.name} to send what it needs.`);else if(o)toast('🏘 '+s.name+' joined your railway! Its first order: '+Object.keys(o).map(g=>TYPES[g].g+o[g]).join(' '))}
 // every town on a reached island linked: a small stamp
 S.islDone=S.islDone||[];for(const k of S.isl||[]){if(S.islDone.includes(k)||!ISLS[k]||!ISLS[k].nm)continue;const T=sites.filter(o=>o.type==='town'&&ISLC[id(o.x,o.y)]===k);if(!T.length||!T.every(o=>o.linked))continue;S.islDone.push(k);if(!S.t||k===ISLC[id(sites[hubI()].x,sites[hubI()].y)]&&S.t<60)continue;const d=sites.filter(o=>o.type==='dep'&&ISLC[id(o.x,o.y)]===k).length,f=T.reduce((a,o)=>a+tlvl(o),0);
  notice(`<b style="color:#7fd36b;font-size:15px">✓ ${ISLS[k].nm} connected</b><br>${T.length} settlement${T.length>1?'s':''} · ${d} deposit${d===1?'':'s'} · ${f} order${f===1?'':'s'} filled<br><small style="opacity:.8">Every settlement on this island, from hamlet to city, is on your railway.</small>`)}
 while(S.tut<TUT.length&&TUT[S.tut].ok()){S.tut++;if(S.tut>=TUT.length){S.tut=99;toast('🎓 Tutorial done! Scout for new towns and link them')}}
 document.querySelectorAll('#tools button').forEach(b=>b.classList.toggle('pulse',S.tut<TUT.length&&TUT[S.tut].el===b.dataset.m&&mode!==b.dataset.m));
 tickMissions.t=(tickMissions.t||0)-dt;if(tickMissions.t>0&&dt>0)return;tickMissions.t=1;if(S.tut>=TUT.length)tickChapter();
 const ob=document.getElementById('obj'),g=RLV[S.beacon],n=S.stats.orders||0;let h;
 if(S.tut<TUT.length)h=`<b>🎓 Getting started · ${S.tut+1}/${TUT.length}</b><br>${TUT[S.tut].t}<br><span data-skip="1" style="text-decoration:underline;opacity:.65;font-size:11px">skip tutorial</span>`;
 else{const tx=nextTip();h=chCard(tx)}
 if(ob.innerHTML!==h)ob.innerHTML=h;const jb=document.getElementById('jobsBtn');if(jb.textContent!=='📋 Orders')jb.textContent='📋 Orders';if(jobsOpen)renderJobs()}
function renderJobs(){const T=sites.filter(o=>o.type==='town'&&!o.hidden&&rev[id(o.x,o.y)]),L=T.filter(o=>o.linked).sort((a,b)=>(b.beacon?1:0)-(a.beacon?1:0)||tlvl(a)-tlvl(b));
 let h=`<b style="color:#ffd27a;font-size:15px">📋 Town orders</b><br><small style="opacity:.8">Fill an order to grow the town and earn its reward. Tap a town to send what it needs.</small>`;
 for(const s of L){const o=ordOf(s),i=sites.indexOf(s);h+=`<div class="job"><b data-act="town:${i}" style="text-decoration:underline">${s.name}</b> <span style="opacity:.7">${tier(s.pop)}${o?' → '+tier(TLIM[tlvl(s)]):''}</span>`+(o?` · <b style="color:#7fd36b">${fmt(LREW[tlvl(s)])}</b><div class="bar2"><div style="width:${Math.round(ordFrac(s)*100)}%;background:#7fd36b"></div></div>`+Object.keys(o).map(k=>{const got=Math.min(o[k],Math.floor((s.got||{})[k]||0));return'<span style="margin-right:8px">'+(got>=o[k]?'✅':brings(s,k).length?'🚂':'⬜')+TYPES[k].g+' '+got+'/'+o[k]+'</span>'}).join(''):' <small>largest size</small>')+'</div>'}
 const un=T.filter(o=>!o.linked);if(un.length)h+=`<div class="job"><b>Not linked yet</b><br>`+un.map(s=>`<span data-act="town:${sites.indexOf(s)}" style="text-decoration:underline;margin-right:8px">${s.name}</span>`).join('')+'</div>';
 h+=`<div class="job"><b>🛤 Railway level ${S.beacon}</b>`+(RLV[S.beacon]?` · ${S.stats.orders||0}/${RLV[S.beacon]} orders<br><small>Next unlocks ${RUNL[S.beacon]}</small>`:'')+'</div>';
 h+='<div class="job">'+fold('how','<b>❔ How it works</b>','<small>1. Build industries: 🪵 camps by forests, 🌾 farms on grass, 🪨 quarries at mountains, ⚫🧲🛢 mines and wells on deposits.<br>2. Link them to your track (it always grows from Ashford).<br>3. Tap an industry and 🚃 Send its goods to a town that wants them. You are paid on every delivery, more for longer trips.<br>4. A filled order grows the town, pays its reward and raises your 🛤 Railway level, which unlocks 🏭 factories and ⚓ ports.<br>5. 🧭 Scout the fog for new towns. Every new town brings a new order. Ports reach other islands.<br>Trains cost money to run: check each train\'s earnings on its card.</small>')+'</div>';
 h+='<div class="job"><b>📰 News</b><br>'+(S.news||[]).slice(0,6).map(n=>`<span style="opacity:.55">${Math.max(0,Math.round((S.t-n.t)/60))}m</span> ${n.txt}`).join('<br>')+'</div>';
 h+='<div style="margin-top:8px;text-align:center"><button id="newmap" style="padding:6px 12px;border-radius:8px;border:1px solid #8a4a36;background:#3a2220;color:#ffb3a0;font-size:12px">↺ New map</button></div>';
 document.getElementById('jobs').innerHTML=h}

function makeReport(){const l=S.led||{},m=x=>'$'+Math.round(x||0).toLocaleString(),inc=['deliveries','orders','ashford','story','salvage'].reduce((a,k)=>a+(l[k]||0),0),H=S.hist||[];
 const r=['RAILHAVEN REPORT · v'+CORE_V+' · '+new Date().toISOString().slice(0,16),'Played '+Math.floor(S.t/60)+' min · Railway level '+S.beacon+' · '+(S.stats.orders||0)+' orders filled · islands '+(S.isl||[]).length+' · map '+Math.round(rev.reduce((a,b)=>a+b,0)/rev.length*100)+'%',
 'Chapter '+chap().n+(chap().free?' (all done)':' · '+islName(chap().isl)+' · '+chGoals().map(x=>x.t+' '+x.v+'/'+x.g).join(', '))+' · done: '+(S.chDone||[]).map(x=>'Ch'+x.n+' '+x.m+'min').join(', '),
 'Money '+m(S.money)+' · upkeep now '+m(trainsCost()*60+track.size*COST.trackRun*60+sites.filter(isFac).length*FACT.run*60)+'/min · track '+track.size+' tiles ('+(S.dbl?S.dbl.length:0)+' double)',
 'TOTAL IN: '+m(inc)+' = deliveries '+m(l.deliveries)+' · town orders '+m(l.orders)+' · railway levels, islands, gifts '+m(l.ashford)+' · scrap '+m((l.story||0)+(l.salvage||0)),
 'TOTAL OUT: upkeep '+m(l.upkeep)+' · building/buying '+m((l.start??8000)+inc-(l.upkeep||0)-S.money),
 'PER MINUTE (min: money / earned / upkeep):',H.map((h,i)=>{const p=H[i-1]||h;return(i+(S.h0||0))+':'+(h[0]/1000).toFixed(1)+'k/'+(h[1]+h[2]-p[1]-p[2])+'/'+(h[3]-p[3])}).join(' '),'TRAINS ('+S.trains.length+'):'];
 if(S.L){r.push('LINES ('+S.L.length+'):');S.L.forEach((L,i)=>{const T=lnTrains(i);let p=0,any=0;for(const{t}of T){const q=tRate(t);if(q!==null){p+=q-tCost(t);any=1}}r.push(' '+lnName(L)+' · '+L.s.map(si=>nmS(sites[si])).join(' > ')+' · trains '+T.length+'/'+(L.need||'?')+(L.auto===false?' manual':' auto')+(any?' · net '+p+'/min':'')+' · carries '+lnCarry(L)+(lnWarn(L).length?' · ⚠ '+lnWarn(L).join('; '):''))})}
 S.trains.forEach(t=>r.push(' #'+tNo(t)+' '+jobTxt(t).replace(/<[^>]+>/g,'')+' · '+(t.why||t.st)+' · earned '+m(t.earn)+' in '+(t.trips||0)+' trips'+(tRate(t)!==null?' · net '+(tRate(t)-tCost(t))+'/min':'')+(t.fast?' fast':'')+(t.big?' big':'')));
 r.push('TOWNS:');sites.filter(o=>o.type==='town'&&!o.hidden&&rev[id(o.x,o.y)]).forEach(o=>{const q=ordOf(o);r.push(' '+o.name+' · '+tier(o.pop)+' '+Math.floor(o.pop)+' · '+(o.linked?'linked':'NOT linked')+(q?' · order '+Object.keys(q).map(k=>GOOD[k]+' '+Math.floor((o.got||{})[k]||0)+'/'+q[k]).join(', '):''))});
 r.push('INDUSTRIES:');sites.filter(o=>isInd(o)||isFac(o)).forEach(o=>r.push(' '+TYPES[o.type].n+' lvl '+(o.lvl||1)+' · stock '+Math.floor(o.stock||0)+' · '+(o.linked?'linked':'NOT linked')+(S.auto?'':' · lines '+(S.L||[]).filter(L=>L.s.includes(sites.indexOf(o))).map(lnName).join(', '))));
 return r.join('\n')}

// ---------- v100 lines: a line is one job (load at A, deliver to B) run by a number of trains; − / + change the count ----------
var lineTrains=(a,b)=>S.trains.map((t,j)=>({t,j})).filter(({t})=>t.route&&t.route.a===a&&t.route.b===b);
var spareTrains=()=>S.trains.map((t,j)=>({t,j})).filter(({t})=>!t.route&&t.w==='freight');
function lineProfit(a,b){let p=0,any=false;for(const{t}of lineTrains(a,b)){const r=tRate(t);if(r!==null){p+=r-tCost(t);any=true}}return any?p:null}
function refreshPanel(){try{if(PANEL&&document.getElementById('panel').style.display==='block')window[PANEL.n](...PANEL.a)}catch(e){}try{if(jobsOpen)renderJobs()}catch(e){}}


const lbtn=(l,fn,dis)=>`<button ${dis?'disabled':''} onclick="${fn}" style="min-width:38px;padding:3px 10px;border-radius:8px;border:0;background:#2e7d6b;color:#fff;font-weight:800;font-size:16px;line-height:1.2;box-shadow:0 2px 0 #1b4d42;${dis?'opacity:.35':''}">${l}</button>`;
const profTxt=p=>p===null?'<small style="opacity:.6">measuring…</small>':p>=0?`<small style="color:#7fd36b">🟢 +${fmt(p)}/min</small>`:`<small style="color:#ffb36b">🟠 −${fmt(-p)}/min</small>`;

var lineLbl=(a,b)=>{const A=sites[a],B=sites[b],k=offerOf(A);return(k?TYPES[k].g+' ':'')+'<b>'+nm(A)+' → '+nm(B)+'</b> <button onclick="lineShow('+a+','+b+')" style="padding:1px 8px;border-radius:7px;border:1px solid #c9a86a;background:#3a2f22;color:#ffe2a8;font-size:12px">📍 Show</button>'};
// v105: frame both ends of a line on the map and pulse them for a few seconds
function lineShow(a,b){const A=sites[a],B=sites[b];if(!A||!B)return;lineHi={a,b,until:performance.now()+6000};const cx=Math.round((A.x+B.x)/2),cy=Math.round((A.y+B.y)/2),r=Math.ceil(Math.max(Math.abs(A.x-B.x),Math.abs(A.y-B.y))/2)+2;fitView(cx,cy,r);toast('📍 '+nm(A)+' → '+nm(B))}
const lineDblTiles=(a,b)=>{const A=sites[a],B=sites[b],p=A&&B&&railPath(A,B);return p?p.map(([x,y])=>id(x,y)).filter(k=>track.has(k)&&!dblSet.has(k)):[]};
function lineDbl(a,b){const T=lineDblTiles(a,b),c=T.length*DBL;if(!T.length)return;if(S.money<c){toast('Doubling costs '+fmt(c));return}S.money-=c;for(const k of T){dblSet.add(k);S.dbl.push(k);delete JAM[k]}toast('🛤🛤 '+T.length+' squares doubled on '+nm(sites[a])+' → '+nm(sites[b]));save();refreshPanel()}
var lineBox=(a,b,extra)=>{const L=lineTrains(a,b),c=L.length?lineCol(L[0].j):'#6b5a3e',dt=L.length>=2?lineDblTiles(a,b).length:0;return`<div style="margin-top:6px;padding:6px 8px;border-radius:9px;background:#1f2a28;border-left:5px solid ${c}">${lineLbl(a,b)}${extra?' <small style="opacity:.8">'+extra+'</small>':''}<br>${lineCtl(a,b)}`+(dt?'<br>'+ubtn('🛤🛤 Double its track · '+dt+' squares · '+fmt(dt*DBL),`lineDbl(${a},${b})`,S.money<dt*DBL):'')+'</div>'};
// all running lines, grouped by where they deliver

function suggestLines(){const out=[],seen=new Set();const T=sites.filter(o=>o.type==='town'&&o.linked&&o.pop>0&&ordOf(o));
 for(const f of sites.filter(o=>isFac(o)&&o.linked))for(const k of facLack(f)){const s=srcsFor(f,k)[0];if(s&&!seen.has(s.i+'>'+sites.indexOf(f))){seen.add(s.i+'>'+sites.indexOf(f));out.push({a:s.i,b:sites.indexOf(f),why:'the '+TYPES[f.type].n+' needs '+GOOD[k].toLowerCase()})}}
 for(const s of T){const o=ordOf(s);for(const k in o){if(((s.got||{})[k]||0)>=o[k]||brings(s,k).length)continue;const src=srcsFor(s,k)[0];if(src&&!seen.has(src.i+'>'+sites.indexOf(s))){seen.add(src.i+'>'+sites.indexOf(s));out.push({a:src.i,b:sites.indexOf(s),why:'📋 '+s.name+' needs '+(o[k]-Math.floor((s.got||{})[k]||0))})}}}
 return out.slice(0,4)}
// the 🚂 Trains button opens the Lines board

// places: no separate train list any more, the lines sit right where the goods are

function townHtml(s,i){const L=tlvl(s),o=ordOf(s),g=s.got||{};let h=`<b style="font-size:15px">🏘 ${s.name}</b> <span style="opacity:.8">${s.beacon?'Capital · ':''}${tier(s.pop)} · ${Math.floor(s.pop).toLocaleString()} people</span>`;
 if(!s.linked)return h+'<br><span style="color:#ffb36b">Not on your railway yet: link it by track to start its orders.</span>'+connectTxt(s)+'<br>'+trackBtn(s);
 if(s.pop<=0)h+='<br><span style="color:#ffb36b">Ruins: bring it wheat or wood to rebuild it</span>';
 h+=linesHere(s);const shown=new Set();
 if(!o)h+=sec2('🏙 <b>Largest size reached</b><br><small style="opacity:.75">It keeps buying all its goods.</small>');
 else{const f=ordFrac(s);h+=sec2(`📋 <b>Order: grow into a ${tier(TLIM[L])}</b> · reward <b style="color:#7fd36b">${fmt(LREW[L])}</b><div style="height:9px;background:#3a2f22;border-radius:5px;margin:5px 0 3px"><div style="width:${Math.round(f*100)}%;height:100%;background:#7fd36b;border-radius:5px"></div></div>`+
  Object.keys(o).map(k=>{const got=Math.min(o[k],Math.floor(g[k]||0)),done=got>=o[k],fk=Object.keys(FAC).find(x=>FAC[x].out===k),lock=fk&&FAC[fk].lvl>S.beacon;
   const run=allLines().filter(x=>x.b===i&&offerOf(sites[x.a])===k);run.forEach(x=>shown.add(x.a+'>'+x.b));const src=srcsFor(s,k)[0];
   let r='<div style="margin-top:6px">'+(done?'✅ ':'⬜ ')+TYPES[k].g+' <b>'+GOOD[k]+' '+got+' / '+o[k]+'</b>';
   if(run.length)r+=run.map(x=>lineBox(x.a,x.b)).join('');
   else if(!done&&src){shown.add(src.i+'>'+i);r+=lineBox(src.i,i,src.d+' tiles')}
   else if(!done)r+='<br><small style="color:#ffb36b">'+(lock?'🔒 A '+TYPES[fk].n+' makes it (Railway level '+FAC[fk].lvl+')':'Build a '+mkr(k)+(fk?' (🏗 Build → Factories)':'')+(WHERE[k]?' · '+WHERE[k]:'')+' and link it by rail')+'</small>';
   return r+'</div>'}).join(''))}
 const other=allLines().filter(x=>(x.b===i||x.a===i)&&!shown.has(x.a+'>'+x.b));if(other.length)h+=sec2('<b>🚂 Other lines here</b>'+other.map(x=>lineBox(x.a,x.b)).join(''));
 const past=usedGoods(s).filter(k=>!o||!(k in o));if(past.length)h+=sec2('🛒 <b>Also buys</b> '+past.map(k=>TYPES[k].g).join(' ')+' <small style="opacity:.7">(goods from its earlier orders, steady income)</small>');
 if(s.beacon)h+=sec2(fold('lm','🏗 <b>Landmarks</b> <small style="opacity:.7">'+Object.keys(S.lm||{}).length+'/'+Object.keys(LM).length+' built · tunnels, bridges and more</small>',lmHtml()));h+=sec2(trackBtn(s));return h}

// ---------- v100 island chapters: one island at a time, with a goal bar ----------
const homeIsl=()=>islAt(sites[hubI()].x,sites[hubI()].y);
const islTowns=k=>sites.filter(o=>o.type==='town'&&islAt(o.x,o.y)===k);
const islName=k=>ISLS[k]&&ISLS[k].nm||'the island';
function chap(){if(!S.chap)S.chap={n:1,isl:homeIsl(),t0:0};return S.chap}
function chGoals(){const c=chap(),k=c.isl,T=islTowns(k),home=k===homeIsl(),G=[];
 if(!home){const reached=(S.isl||[]).includes(k);G.push({t:'Reach '+islName(k)+(S.beacon<1?' (⚓ ports unlock at Railway level 1)':' with a ⚓ port and landing'),v:reached?1:0,g:1})}
 const others=T.filter(o=>!o.beacon),want=Math.max(1,Math.min(home?4:3,others.length)),lk=others.filter(o=>o.linked).length;
 G.push({t:'Find and link '+want+' town'+(want>1?'s':'')+' on '+islName(k),v:Math.min(lk,want),g:want});
 const og=home?8:2*want,ord=c.n===1?(S.stats.orders||0):T.reduce((a,o)=>a+(o.linked?tlvl(o)-(o.lvl0??tlvl(o)):0),0);G.push({t:'Fill '+og+' orders on '+islName(k),v:Math.min(Math.max(0,ord),og),g:og});
 if(home){const A=sites[hubI()];G.push({t:'Ashford grows into a City',v:tlvl(A)>=3?1:0,g:1})}
 return G}
function nextChapIsl(){const done=new Set((S.chDone||[]).map(x=>x.isl)),H=sites[hubI()];let best=null,bd=1e9;ISLS.forEach((I,k)=>{if(!I.nm||done.has(k)||k===chap().isl||!islTowns(k).length)return;const d=Math.hypot(I.x-H.x,I.y-H.y);if(d<bd){bd=d;best=k}});return best}
function tickChapter(){const c=chap();if(c.free)return;
 // orders already filled before a chapter starts don't count towards it
 if(!c.base){c.base=1;for(const o of islTowns(c.isl))o.lvl0=tlvl(o)}
 const G=chGoals();if(!G.every(x=>x.v>=x.g))return;
 const mins=((S.t||0)-c.t0)/60,lim=c.n===1?[25,40]:[15,30],st=mins<=lim[0]?3:mins<=lim[1]?2:1,rw=2000*c.n;S.money+=rw;led('ashford',rw);
 S.chDone=S.chDone||[];S.chDone.push({n:c.n,isl:c.isl,st,m:Math.round(mins)});const nx=nextChapIsl();
 notice(`<div style="text-align:center"><b style="color:#ffd27a;font-size:20px">🏁 Chapter ${c.n} complete!</b><br><b>${islName(c.isl)}</b><small style="opacity:.85">Done in ${Math.round(mins)} min</small><br>Reward <b style="color:#7fd36b">${fmt(rw)}</b><div style="margin-top:6px;font-style:italic;opacity:.9">${chStory(c).outro}</div><br>`+(nx!=null?(()=>{const q=chStory({n:c.n+1,isl:nx});(S.chIn=S.chIn||{})[c.n+1]=1;return`<small style="opacity:.75;letter-spacing:2px">NEXT · CHAPTER ${c.n+1}</small><br><b style="font-size:16px">${q.ic} ${q.title}</b><div style="font-style:italic;margin-top:4px;text-align:left">${q.intro}</div>`})():'<b>Every island is yours.</b><br><small>Keep growing your towns as big as they go.</small>')+'</div>');
 if(nx!=null)S.chap={n:c.n+1,isl:nx,t0:S.t||0};else c.free=1;save()}
function goalLine(){const c=chap();if(c.free)return'<div style="color:#ffd27a"><b>🏁 All chapters done</b></div>';
 const G=chGoals();return`<div style="color:#ffd27a"><b>🏁 Chapter ${c.n} · ${islName(c.isl)}</b></div>`+G.map(x=>`<div style="font-size:12px">${x.v>=x.g?'✅':'⬜'} ${x.t} <b>${x.g>1?x.v+'/'+x.g:''}</b></div>`).join('')}
function goalShort(){const c=chap();if(c.free)return'🏁 All chapters done';const G=chGoals(),d=G.filter(x=>x.v>=x.g).length,nx=G.find(x=>x.v<x.g);return`🏁 Ch.${c.n} ${islName(c.isl)} ${d}/${G.length}`+(nx?` · <span style="opacity:.85">${nx.t}${nx.g>1?' '+nx.v+'/'+nx.g:''}</span>`:'')}

// v106: factory card as three plain steps: what it needs, what arrives, where its goods go
function lineCarry(a,b){const A=sites[a],B=sites[b];if(!A||!B)return 0;const d=Math.max(4,Math.round((Math.abs(A.x-B.x)+Math.abs(A.y-B.y))*1.1));let c=0;for(const{t}of lineTrains(a,b))c+=trainCap(t)*60/tripSecs(d);const u=srcUse(A),m=makeRate(A);return u>m&&u>0?c*m/u:c}
function showFactory(i){openShed=null;openInfo=null;openFac=i;const s=sites[i],f=FAC[s.type],el=document.getElementById('panel');el.style.display='block';s.inp=s.inp||{};const B=FACT.buf(s.lvl||1),R=FACT.rate(s.lvl||1)*60,out=f.out;
 const ins=Object.keys(f.in).map(k=>{const need=R*f.in[k],src=srcsFor(s,k),got=src.reduce((a,o)=>a+lineCarry(o.i,i),0);return{k,need,got,src,have:Math.floor(s.inp[k]||0)}});
 const D=destsFor(s),sent=D.reduce((a,o)=>a+(o.n||0),0),noIn=ins.filter(o=>o.got<=0),slow=ins.filter(o=>o.got>0&&o.got<o.need*.7);
 let st;if(!s.linked&&!isConnected(s))st=['#ffb36b','⚠ Not on your track yet: link it first'];
 else if(noIn.length)st=['#ffb36b','⚠ Nothing brings '+noIn.map(o=>GOOD[o.k].toLowerCase()).join(' or ')+' yet: start a line in step 1'];
 else if(slow.length)st=['#ffd27a','🐢 Short of '+slow.map(o=>GOOD[o.k].toLowerCase()).join(' and ')+': it runs part-time (see step 1)'];
 else if(!sent&&s.stock>=5)st=['#ffd27a','📦 '+gname(out)+' are piling up: send them somewhere in step 2'];
 else st=['#7fd36b','✅ Running well'];
 let h=`<b style="font-size:15px">🏭 ${TYPES[s.type].n}</b> · level ${s.lvl||1}<br><small style="opacity:.85">Turns ${Object.entries(f.in).map(([k,q])=>q+' '+gname(k)).join(' + ')} into ${gname(out).toLowerCase()} · up to ${Math.round(R)} ${GOOD[out].toLowerCase()}/min</small>`+connectTxt(s)+`<div style="margin-top:6px;padding:6px 9px;border-radius:9px;background:#2a221a;border:1.5px solid ${st[0]};color:${st[0]};font-weight:700">${st[1]}</div>`+noTrainTxt();
 h+=sec2('<b style="font-size:14px">① Bring in</b> <small style="opacity:.7">you earn half price for these</small>'+ins.map(o=>{const pct=Math.min(100,Math.round(o.got/o.need*100));
  let r=`<div style="margin-top:6px">${gname(o.k)} · <b>${o.have}</b>/${B} in store<br><small style="opacity:.85">Needs ≈${Math.round(o.need)}/min · arriving ≈<b style="color:${pct>=70?'#7fd36b':'#ffb36b'}">${Math.round(o.got)}/min</b></small></div>`;
  if(!o.src.length)return r+'<small style="color:#ffb36b">No '+TYPES[o.k].n+' is linked by track. 🏗 Build one near forest/fields and link it.</small>';
  return r+o.src.slice(0,3).map(x=>{const A=x.A,oth=S.trains.filter(t=>t.route&&t.route.a===x.i&&t.route.b!==i),full=srcFull(A);
   const note='makes '+Math.round(makeRate(A))+'/min'+(oth.length?' · also feeds '+[...new Set(oth.map(t=>nm(sites[t.route.b])))].join(', ')+' (🚂 '+oth.length+')':'')+(full?' · <span style="color:#ffb36b">fully used: ⬆ expand it or build another</span>':'');
   return lineBox(x.i,i,x.d+' tiles<br>'+note)}).join('')}).join(''));
 h+=sec2(`<b style="font-size:14px">② Send out</b> · <b>${Math.floor(s.stock)}</b> ${gname(out)} waiting`)+sendList(s);
 h+=linesHere(s);h+=sec2(trackBtn(s)+(s.lvl<FACT.maxL?ubtn('⬆ Upgrade · '+fmt(PRICE.facUp(s.lvl).m)+' · faster, bigger stores',`upFac(${i})`,S.money<PRICE.facUp(s.lvl).m):''));el.innerHTML=h}
// one line, once per card, saying why ＋ is greyed out
var noTrainTxt=()=>!spareTrains().length&&S.money<COST.train?'<div style="margin-top:6px;color:#ffb36b"><small>＋ is greyed out: no spare train, and the next one costs '+fmt(COST.train)+' ('+fmt(COST.train-S.money)+' more). Tap − on a weak line to free a train.</small></div>':'';

// v107: one raw good makes one product (a single camp can now keep a level 1 factory busy)
for(const k of['sawmill','brickworks','gristmill','refinery'])if(FAC[k])FAC[k].in={[Object.keys(FAC[k].in)[0]]:1};


// v109: move a game between the Claude app and a browser (each keeps its own save): copy a save code here, paste it there
function showMove(){save();const el=document.getElementById('panel');el.style.display='block';let code='';try{code='RAILHAVEN1:'+btoa(unescape(encodeURIComponent(localStorage.getItem(SAVE_KEY)||'')))}catch(e){}
 const ta='width:100%;height:90px;margin-top:6px;background:#1d1812;color:#f3e6c8;border:1px solid #6b5a43;border-radius:8px;font-size:10px';
 el.innerHTML='<b style="font-size:15px">💾 Move my game</b><br><small style="opacity:.8">The Claude app and Chrome each keep their own save. To continue elsewhere: copy the code here, open the game there, tap 🔧 Tech → 💾 Move my game, paste it and load.</small>'+
 sec2('<b>① Copy this game</b><textarea id="mvout" readonly style="'+ta+'">'+code+'</textarea><br>'+ubtn('📋 Copy save code','copyMove()'))+
 sec2('<b>② Load a game from a code</b><textarea id="mvin" placeholder="Paste a save code here" style="'+ta+'"></textarea><br>'+ubtn('⬇ Load it (replaces the game on this screen)','loadMove()'))}
function copyMove(){const ta=document.getElementById('mvout');try{navigator.clipboard.writeText(ta.value).then(()=>toast('💾 Save code copied'),()=>{ta.select();document.execCommand('copy');toast('💾 Save code copied')})}catch(e){ta.select();document.execCommand('copy');toast('💾 Save code copied')}}
function loadMove(){const v=(document.getElementById('mvin').value||'').trim();if(!v.startsWith('RAILHAVEN1:')){toast('That is not a Railhaven save code');return}
 let j;try{j=decodeURIComponent(escape(atob(v.slice(11).replace(/\s/g,''))));const o=JSON.parse(j);if(!o||!o.sites||!o.track)throw 0}catch(e){toast('The code looks cut off: copy it again in full');return}
 if(!loadMove.armed){loadMove.armed=1;toast('Tap Load again to replace the game on this screen');setTimeout(()=>loadMove.armed=0,4000);return}
 save.off=true;localStorage.setItem(SAVE_KEY,j);location.reload()}

// v110: full-screen button (shown only where the browser allows it, e.g. Chrome; the Claude app usually doesn't)
{const fb=document.getElementById('fsBtn'),de=document.documentElement,can=!!(document.fullscreenEnabled||document.webkitFullscreenEnabled)&&!!(de.requestFullscreen||de.webkitRequestFullscreen);
 if(fb&&can){fb.style.display='block';const sync=()=>{fb.textContent=(document.fullscreenElement||document.webkitFullscreenElement)?'✕⛶':'⛶';fb.style.fontSize=fb.textContent.length>1?'12px':'17px'};
  fb.onclick=()=>{try{if(document.fullscreenElement||document.webkitFullscreenElement)(document.exitFullscreen||document.webkitExitFullscreen).call(document);else{const r=(de.requestFullscreen||de.webkitRequestFullscreen).call(de,{navigationUI:'hide'});r&&r.catch&&r.catch(()=>toast('This app blocks full screen: open the game in Chrome'))}}catch(e){toast('This app blocks full screen: open the game in Chrome')}};
  document.addEventListener('fullscreenchange',()=>{sync();setTimeout(()=>{try{resize()}catch(e){}},200)});document.addEventListener('webkitfullscreenchange',sync)}}

// v111: little crates hop between a building and the train when it loads (out of the building) or unloads (into it)
const CRATES=[];function fxCrates(o,t,k,toSite){if(!o||!t||typeof trainXY!=='function'||CRATES.length>160)return;const[tx,ty]=trainXY(t),sx=(o.x+.5)*TS,sy=(o.y+.5)*TS;for(let i=0;i<4;i++)CRATES.push({a:toSite?[tx,ty]:[sx,sy],b:toSite?[sx,sy]:[tx,ty],k,t0:performance.now()+i*130,d:520})}

// v114: an engine shed that track has been laid over moves to the nearest free square beside the line
function shedFix(){const sh=S.sheds&&S.sheds[0],A=sites[hubI()];if(!sh||!A||!track.has(id(sh.x,sh.y)))return;let best=null,bd=1e9;for(let dy=-5;dy<=5;dy++)for(let dx=-5;dx<=5;dx++){const x=A.x+dx,y=A.y+dy,t=terr[id(x,y)];if(!(t===1||t===2)||!rev[id(x,y)]||track.has(id(x,y))||siteAt(x,y))continue;if(!D4.some(([a,b])=>track.has(id(x+a,y+b))))continue;if(typeof stnAt==='function'&&stnAt(x,y))continue;const d=Math.hypot(dx,dy);if(d<bd){bd=d;best=[x,y]}}if(best){sh.x=best[0];sh.y=best[1];save()}}
setInterval(()=>{try{shedFix()}catch(e){}},2000);try{shedFix()}catch(e){}
// v123: when new track opens a shorter way, a train already on its way switches to it from the next square (before, it kept the old, longer path until its next trip)
let rrK=-1;function reroute(){const k=track.size+'/'+dblSet.size;if(k===rrK)return;rrK=k;for(const t of S.trains){if(!t.path||t.path.length<3||(t.st!=='toSrc'&&t.st!=='toDst'))continue;const g=sites[t.st==='toSrc'?t.src:t.dst];if(!g)continue;const c=Math.min(t.path.length-1,Math.floor(t.pos)+1),from=t.path[c],e=t.path[t.path.length-1];if(e[0]!==g.x||e[1]!==g.y)continue;
 const p=pathTo(bfs(id(from[0],from[1])),id(g.x,g.y));const bk=t.path[c-1];if(p&&p.length<t.path.length-c-1&&!(p[1]&&bk&&p[1][0]===bk[0]&&p[1][1]===bk[1]))t.path=t.path.slice(0,c).concat(p)}}// never by turning back on the line
setInterval(()=>{try{reroute()}catch(e){}},1000);

// ================= v125 LINES (Mini Metro style) =================
// A line is a coloured run of stops. Its trains shuttle end to end and, at every stop, drop whatever that stop
// wants and pick up whatever another stop on the line wants. You decide which places a line joins; the trains
// sort out the cargo, and (unless you switch it off) each line buys or parks its own trains to match its work.
const LNAME=['Red','Blue','Yellow','Purple','Teal','Pink','Green','Orange','Grey','Brown','Navy','Lime'],LPAL=['#e8603c','#3fa7d6','#f2c14e','#9b5de5','#2ec4b6','#f15bb5','#a3d65c','#ff9f1c','#bfb8ad','#b07a4a','#4b6cd6','#d4e157'];
const nmS=o=>o&&o.type?nm(o):'?';
const LMAX=6;// stops per line
const LEMO=['🔴','🔵','🟡','🟣','🩵','🩷','🟢','🟠','⚪','🟤','🔷','💚'],lnEmo=L=>LEMO[L.c%LEMO.length];
function Ls(){if(!S.L)S.L=[];return S.L}
const lnOf=t=>t&&t.ln!=null&&S.L&&S.L[t.ln]&&S.L[t.ln].s.length>=2?S.L[t.ln]:null;
const lnName=L=>LNAME[L.c%LNAME.length]+' line',lnCol=L=>LPAL[L.c%LPAL.length];
const lnChip=(L,big)=>`<span style="display:inline-block;width:${big?14:10}px;height:${big?14:10}px;border-radius:50%;background:${lnCol(L)};vertical-align:-1px;margin-right:4px;box-shadow:0 0 0 2px #0006"></span>`;
const lnTrains=i=>S.trains.map((t,j)=>({t,j})).filter(({t})=>t.ln===i);
function nextCol(){const used=new Set(Ls().map(L=>L.c));for(let c=0;c<LNAME.length;c++)if(!used.has(c))return c;return Ls().length%LNAME.length}
function syncRoute(t){const L=lnOf(t);t.route=L?{a:L.s[0],b:L.s[L.s.length-1],c:null,s:L.s.slice(),ln:t.ln}:null}
function syncAll(){for(const t of S.trains)if(t.ln!=null)syncRoute(t)}
const stopOk=o=>!!o&&!o.hidden&&o.linked&&(o.type==='town'&&(o.pop>0||o.beacon)||isFac(o)||isInd(o));
// does B want k right now (factories only while they have room)
// how much of k a stop is still asking for: an open town order, or room in a factory
const lnWant=(B,k)=>{if(!B||!accepts(B,k))return 0;if(isFac(B))return Math.max(0,FACT.buf(B.lvl||1)-((B.inp||{})[k]||0));const o=B.type==='town'&&ordOf(B);return o&&o[k]?Math.max(0,o[k]-Math.floor((B.got||{})[k]||0)):0};
const wantsK=(B,k)=>!!B&&accepts(B,k)&&(!isFac(B)||((B.inp||{})[k]||0)<FACT.buf(B.lvl||1)-2);
const lnPath=(a,b)=>{const A=sites[a],B=sites[b];return A&&B?railPath(A,B):null};
function lnLen(L){const k=track.size+'/'+L.s.join('.');if(L._lk===k)return L._len;let d=0,ok=true;for(let i=1;i<L.s.length;i++){const p=lnPath(L.s[i-1],L.s[i]);if(!p){ok=false;d+=99}else d+=p.length-1}L._lk=k;L._len=d;L._ok=ok;return d}
// goods per second the line has to carry, and how many trains that takes
function lnFlows(L){const out=[];L.s.forEach((si,i)=>{const A=sites[si],k=offerOf(A);if(!k)return;const to=L.s.filter((sj,j)=>j!==i&&accepts(sites[sj],k));if(!to.length)return;out.push({i:si,k,to,r:Math.max(.05,makeRate(A)/60)})});return out}
function lnNeed(L){const T=2*lnLen(L)/3.2+L.s.length*2.5,F=lnFlows(L),r=F.reduce((a,f)=>a+f.r,0),cap=capNew();if(!F.length)return 1;return Math.max(1,Math.min(8,Math.ceil(r*T/cap*.9)))}
function lnWarn(L){const W=[];lnLen(L);if(L._ok===false)W.push('Some stops are not joined by track');
 for(const si of L.s){const A=sites[si];if(!A)continue;const k=offerOf(A);if(k&&!Ls().some(M=>M.s.includes(si)&&M.s.some(sj=>sj!==si&&accepts(sites[sj],k))))W.push(nm(A)+'\'s '+GOOD[k].toLowerCase()+' has no buyer on this line');
  if(isFac(A))for(const q of Object.keys(FAC[A.type].in))if(!L.s.some(sj=>sj!==si&&offerOf(sites[sj])===q)&&!Ls().some(M=>M!==L&&M.s.includes(si)&&M.s.some(sj=>sj!==si&&offerOf(sites[sj])===q)))W.push('The '+TYPES[A.type].n+' needs '+gname(q)+(sites.some(o=>o.linked&&offerOf(o)===q)?': add '+(/^[AEIOU]/.test(TYPES[q].n)?'an ':'a ')+TYPES[q].n+' to a line through it':': build '+(/^[AEIOU]/.test(TYPES[q].n)?'an ':'a ')+TYPES[q].n+' and link it'))}
 return W}
function lnCarry(L){const m=new Map();for(const f of lnFlows(L)){const key=f.k;if(!m.has(key))m.set(key,new Set());for(const sj of f.to)m.get(key).add(nm(sites[sj]))}return[...m.entries()].map(([k,S2])=>TYPES[k].g+' '+GOOD[k].toLowerCase()+' → '+[...S2].join(', ')).join(' · ')}
const lnStops=L=>L.s.map((si,i)=>{const o=sites[si];return o?`<span style="white-space:nowrap">${o.type==='town'?'🏘':isFac(o)?'🏭':TYPES[o.type].g} ${nm(o)}</span>`:'?'}).join(' <span style="opacity:.6">→</span> ');

// ---------- the trains ----------
function dispatch(t){
 // something outside the lines set a plain job (old buttons, the bot): turn it into a line
 if(t.route&&t.route.ln===undefined&&sites[t.route.a]&&sites[t.route.b]){const i=lineLinkIdx(t.route.a,t.route.b,true);if(i>=0){t.ln=i;t.li=null;syncRoute(t)}}
 if(!t.route&&t.ln!=null){t.ln=null;t.li=null}
 const L=lnOf(t);if(!L)return dispatchJob(t);
 const here=trainTile(t),b=bfs(here);
 if(t.li==null||t.li>=L.s.length){let bi=0,bd=1e9;L.s.forEach((si,i)=>{const o=sites[si],d=o?b.dist[id(o.x,o.y)]:-1;if(d>=0&&d<bd){bd=d;bi=i}});t.li=bi;t.ld=bi>=L.s.length-1?-1:1}
 const o=sites[L.s[t.li]],p=o&&pathTo(b,id(o.x,o.y));
 if(!p){t.why='No track to '+nmS(o)+' from here: join it to your track';t.path=[[here%N,(here/N)|0]];t.pos=0;t.st='idle';t.wait=3;t.stuck=(t.stuck||0)+3;return}
 t.dst=L.s[t.li];t.src=t.dst;t.path=p;t.pos=0;t.st='toDst';t.why='';t._at=0}
function arrived(t){const L=lnOf(t);if(!L)return arrivedJob(t);return arriveLine(t,L)}
function lotsSum(t){t.lots=(t.lots||[]).filter(q=>q.n>0);const n=t.lots.reduce((a,q)=>a+q.n,0);t.cargo=n;if(!n){t.k=null;t.mix=null}else if(t.lots.length===1||new Set(t.lots.map(q=>q.k)).size===1){t.k=t.lots[0].k;t.mix=null}else{t.k='mix';t.mix={};for(const q of t.lots)t.mix[q.k]=(t.mix[q.k]||0)+q.n}return n}
function arriveLine(t,L){const si=L.s[t.li],X=sites[si];t.lots=t.lots||[];if(!X){t.st='idle';t.li=null;return}
 if(!t._at){const mv=Math.max(0,(t.path||[]).length-1);for(const q of t.lots)q.d+=mv;t._at=1;t.ul=0}
 // 1 drop what this stop wants
 // a stop with an open order (or a factory with room) gets first claim; a stop that only buys takes what nobody else on the line is waiting for
 for(const q of t.lots){if(q.n<=0||q.o===si||!accepts(X,q.k))continue;const nd=lnWant(X,q.k),other=L.s.some(sj=>sj!==si&&sj!==q.o&&lnWant(sites[sj],q.k)>0);const amt=nd>0?(other?Math.min(q.n,Math.ceil(nd)):q.n):other?0:q.n;if(amt<=0)continue;
  const b0=q.n;t.k=q.k;t.cargo=amt;deliver(t,X,Math.max(4,q.d));const used=amt-t.cargo;q.n=b0-used;if(used>0){t.ul+=used;fxCrates(X,t,q.k,1)}}
 lotsSum(t);
 if(t.stop||!t.route){t.stop=0;t.ln=null;t.li=null;t.route=null;if(t.cargo>0){/* sell what nobody here wanted at half price */const v=Math.round(t.lots.reduce((a,q)=>a+TYPES[q.k].rate*q.n*.5,0));S.money+=v;led('deliveries',v)}t.lots=[];lotsSum(t);t.st='idle';t.wait=1;return}
 // 2 pick up what another stop on the line wants
 const k=offerOf(X),cap=trainCap(t);let got=0;
 if(k&&(X.stock||0)>=1&&t.cargo<cap&&L.s.some(sj=>sj!==si&&wantsK(sites[sj],k))){const n=Math.min(cap-t.cargo,Math.floor(X.stock));X.stock-=n;got=n;const q=t.lots.find(q=>q.k===k&&q.o===si);if(q)q.n+=n;else t.lots.push({k,n,o:si,d:0});fxCrates(X,t,k,0)}
 lotsSum(t);
 // 3 at a place that makes something, wait a little for a fuller train (never long, others may be waiting for this cargo)
 const src=k&&L.s.some(sj=>sj!==si&&wantsK(sites[sj],k));
 if(src&&t.cargo<cap*.6&&(t.lw||0)<(t.cargo>0?3:8)){t.lw=(t.lw||0)+1;t.wait=1;t.why='Loading at '+nm(X)+' ('+t.cargo+'/'+cap+')';return}
 t.lw=0;t.why='';
 // 4 on to the next stop, turning back at either end
 let nx=t.li+t.ld;if(nx<0||nx>=L.s.length){t.ld=-t.ld;nx=t.li+t.ld}t.li=Math.max(0,Math.min(L.s.length-1,nx));
 t.st='idle';t.wait=(t.ul||got)?1:.2}
// status words for cards and the report
function trainStatus(t){const L=lnOf(t);if(!L){if(!t.route&&!(t.cargo>0))return'💤 Spare: parked in the Engine shed';return t.why||'waiting'}if(t.blk>0)return'⏳ waiting for the track ahead (double track helps)';if(t.why)return t.why;const B=sites[t.dst];const c=t.cargo>0?(t.k==='mix'?Object.entries(t.mix||{}).map(([k,n])=>n+' '+(TYPES[k]||{g:'📦'}).g).join(' '):t.cargo+' '+(TYPES[t.k]||{g:'📦'}).g):'empty';return(t.st==='toDst'?'→ '+nmS(B):'at '+nmS(B))+' · '+c}
function jobTxt(t){const L=lnOf(t);if(!L)return'<span style="color:#ffd27a">💤 Spare</span>';return lnChip(L)+'<b>'+lnName(L)+'</b>'}

// ---------- making and changing lines ----------
function lnNew(s){const L={s:s.slice(),c:nextCol(),auto:true};Ls().push(L);return Ls().length-1}
// add one train to line i: a spare first, otherwise buy one
function lnAddTrain(i,quiet){const L=Ls()[i];if(!L)return false;const sp=S.trains.findIndex(t=>t.ln==null&&!t.route&&t.w==='freight'&&!(t.cargo>0));let j=sp,fresh=false;if(j<0){if(S.money<COST.train){if(!quiet)toast('A train costs '+fmt(COST.train));return false}j=newTrain();if(j<0)return false;fresh=true}
 const t=S.trains[j];t.ln=i;t.li=null;t.lots=[];t.stop=0;t.lw=0;t.stuck=0;t.eh=[];t.born=S.t;syncRoute(t);if(t.st!=='toDst')t.st='idle';t.wait=.5;if(!quiet)toast('🚂 '+(fresh?'New train on ':'Spare train sent to ')+lnName(L));return true}
function lnDropTrain(i){const L=lnTrains(i).filter(({t})=>!t.stop);if(!L.length)return;const t=(L.find(({t})=>!(t.cargo>0))||L[0]).t;t.stop=1;toast('🚂 Train '+tNo(t)+' leaves the '+lnName(Ls()[i])+' at its next stop and parks as a spare')}
// the one action behind every "bring / send / link" button: put a and b on the same line
function lineLinkIdx(a,b,quiet){if(a===b)return-1;const A=sites[a],B=sites[b];if(!A||!B||!railPath(A,B)){if(!quiet)toast('No track joins '+nmS(A)+' and '+nmS(B)+' yet');return-1}
 let i=Ls().findIndex(L=>L.s.includes(a)&&L.s.includes(b));if(i>=0)return i;
 // extend a line that already stops at one of them, at its nearer end
 const ext=(have,add)=>{let best=-1,bd=1e9,end=0;Ls().forEach((L,k)=>{if(L.s.length>=LMAX)return;const e0=L.s[0],e1=L.s[L.s.length-1];for(const[e,w]of[[e0,0],[e1,1]]){const p=lnPath(e,add);if(!p)continue;const d=p.length+(e===have?0:6);if(d<bd&&(e===have||L.s.includes(have))){bd=d;best=k;end=w}}});return best>=0?{k:best,end}:null};
 const x=ext(a,b)||ext(b,a);if(x){const L=Ls()[x.k],add=L.s.includes(a)?b:a;if(x.end)L.s.push(add);else L.s.unshift(add);syncAll();if(!quiet)toast(lnEmo(L)+' '+nm(sites[add])+' added to the '+lnName(L));return x.k}
 return lnNew([a,b])}
function lineLink(a,b){const i=lineLinkIdx(a,b);if(i<0)return;if(!lnTrains(i).length)lnAddTrain(i,true);save();refreshPanel()}
// old pair-based helpers now speak lines
var lineTrains=(a,b)=>{const i=Ls().findIndex(L=>L.s.includes(a)&&L.s.includes(b));return i<0?[]:lnTrains(i)};
var spareTrains=()=>S.trains.map((t,j)=>({t,j})).filter(({t})=>t.ln==null&&!t.route&&t.w==='freight');
var brings=(B,k)=>{const bi=sites.indexOf(B);return S.trains.filter(t=>{const L=lnOf(t);return L&&L.s.includes(bi)&&L.s.some(sj=>sj!==bi&&offerOf(sites[sj])===k)})};
function srcUse(A){const i=sites.indexOf(A);let c=0;Ls().forEach((L,k)=>{if(!L.s.includes(i))return;const n=lnTrains(k).length;if(!n)return;const T=2*lnLen(L)/3.2+L.s.length*2.5;c+=n*capNew()*60/Math.max(10,T)});return Math.round(c)}
function lineAdd(a,b){lineLink(a,b)}
function lineDel(a,b){const i=Ls().findIndex(L=>L.s.includes(a)&&L.s.includes(b));if(i>=0)lnDropTrain(i);save();refreshPanel()}
function chooseTrain(a,b){lineLink(a,b)}
function pickTrain(j,a,b){const i=lineLinkIdx(a,b);if(i<0)return;const t=S.trains[j<0?newTrain():j];if(!t)return;t.ln=i;t.li=null;t.lots=t.lots||[];syncRoute(t);if(t.st!=='toDst')t.st='idle';save();refreshPanel()}
function assignJob(j,a,b){const i=lineLinkIdx(a,b,true);const t=S.trains[j];if(!t||i<0)return;t.stop=0;t.ln=i;t.li=null;t.lots=t.lots||[];t.eh=[];t.born=S.t;syncRoute(t);if(t.st!=='toDst')t.st='idle';save()}
function sendJob(a,b){const i=lineLinkIdx(a,b,true);if(i<0)return;lnAddTrain(i,true);save()}
function stopTrain(j){const t=S.trains[j];if(!t)return;t.stop=1;if(!(t.cargo>0)&&t.st!=='toDst'){t.ln=null;t.li=null;t.route=null;t.stop=0}save();refreshPanel()}
function lineCtl(a,b){const i=Ls().findIndex(L=>L.s.includes(a)&&L.s.includes(b));if(i>=0){const L=Ls()[i];return`<span style="display:inline-flex;align-items:center;gap:6px;margin-top:4px;flex-wrap:wrap">${lnChip(L)}<b>${lnName(L)}</b> <small>🚂 ${lnTrains(i).length}</small> `+tbtn('Open',`showLine(${i})`)+'</span>'}
 const sp=spareTrains().length,cant=!sp&&S.money<COST.train;return tbtn('＋ Put on a line'+(lineWouldExtend(a,b)?'':' · '+(sp?'spare train':fmt(COST.train))),`lineLink(${a},${b})`,cant&&!lineWouldExtend(a,b))}
const lineWouldExtend=(a,b)=>Ls().some(L=>L.s.length<LMAX&&(L.s.includes(a)||L.s.includes(b)));
var lineLbl=(a,b)=>{const A=sites[a],B=sites[b],k=offerOf(A);return(k?TYPES[k].g+' ':'')+'<b>'+nm(A)+' → '+nm(B)+'</b>'};
var lineBox=(a,b,extra)=>`<div style="margin-top:6px;padding:6px 8px;border-radius:9px;background:#1f2a28;border-left:5px solid #6b5a3e">${lineLbl(a,b)}${extra?' <small style="opacity:.8">'+extra+'</small>':''}<br>${lineCtl(a,b)}</div>`;
function allLines(){return Ls().map((L,i)=>({a:L.s[0],b:L.s[L.s.length-1],i}))}

// ---------- automatic train counts ----------
let lnBuyT=0;function lnAuto(){if(!S.L)return;const now=S.t;Ls().forEach((L,i)=>{if(L.s.length<2)return;const T=lnTrains(i),n=T.filter(({t})=>!t.stop).length,need=lnNeed(L);L.need=need;if(L.auto===false)return;
 if(n<need){const sp=spareTrains().some(({t})=>!(t.cargo>0));if(sp)lnAddTrain(i,true);else if(now-lnBuyT>12&&S.money>=COST.train+2500){lnBuyT=now;if(lnAddTrain(i,true))toast(lnEmo(L)+' '+lnName(L)+' bought a train ('+fmt(COST.train)+')')}}
 else if(n>need+1){const x=T.find(({t})=>!t.stop&&!(t.cargo>0));if(x)x.t.stop=1}})}
setInterval(()=>{try{lnAuto()}catch(e){}},4000);

// ---------- the line planner: groups every industry into a few lines ----------
function planLines(){const P=sites.map((o,i)=>({o,i})).filter(({o})=>stopOk(o)&&offerOf(o));const segs=[];
 for(const{o,i}of P){const k=offerOf(o);const b=bfs(id(o.x,o.y));let best=null,bs=1e9;sites.forEach((B,j)=>{if(j===i||!stopOk(B)||!accepts(B,k))return;const d=b.dist[id(B.x,B.y)];if(!(d>0))return;const od=B.type==='town'&&ordOf(B),left=od&&od[k]?od[k]-((B.got||{})[k]||0):0;const s=d*(isFac(B)&&!((B.inp||{})[k]>20)?.5:left>0?.7:1);if(s<bs){bs=s;best=j}});if(best!=null)segs.push([i,best])}
 // every linked factory gets each input from its nearest producer, even if that producer also serves others
 for(const{o:F,i:fi}of sites.map((o,i)=>({o,i})).filter(({o})=>isFac(o)&&stopOk(o)))for(const q of Object.keys(FAC[F.type].in)){if(segs.some(([a,b])=>b===fi&&offerOf(sites[a])===q))continue;const c=srcsFor(F,q)[0];if(c)segs.push([c.i,fi])}
 // chain raw → factory → buyer
 let L=segs.map(s=>s.slice());for(let pass=0;pass<3;pass++)for(const x of L){if(!x.length)continue;const end=x[x.length-1];const y=L.find(y=>y!==x&&y.length&&y[0]===end&&x.length+y.length-1<=LMAX&&!y.slice(1).some(v=>x.includes(v)));if(y){x.push(...y.slice(1));y.length=0}}
 L=L.filter(x=>x.length>=2);
 // join lines that share an end (two camps feeding the same town make one line through the town)
 const plen=x=>{let d=0;for(let i=1;i<x.length;i++){const p=lnPath(x[i-1],x[i]);d+=p?p.length:99}return d};
 for(let guard=0;guard<40;guard++){let best=null;for(let i=0;i<L.length;i++)for(let j=i+1;j<L.length;j++){const x=L[i],y=L[j];if(x.length+y.length-1>LMAX)continue;for(const X of[x,x.slice().reverse()])for(const Y of[y,y.slice().reverse()])if(X[X.length-1]===Y[0]&&!Y.slice(1).some(v=>X.includes(v))){const z=X.concat(Y.slice(1)),g=plen(x)+plen(y)-plen(z);if(!best||g>best.g)best={i,j,z,g}}}
  if(!best)break;L[best.i]=best.z;L.splice(best.j,1)}
 return L}
function tidyLines(quiet){const plan=planLines();const T=S.trains.filter(t=>t.w==='freight');for(const t of T){t.ln=null;t.li=null;t.route=null;t.stop=0;if(t.st==='toDst'&&!(t.cargo>0))t.st='idle'}
 S.L=[];plan.forEach(s=>lnNew(s));
 // hand the existing trains out by need
 const need=S.L.map(L=>lnNeed(L));let k=0;const free=T.slice();for(let r=0;r<12&&free.length;r++)S.L.forEach((L,i)=>{if(free.length&&need[i]>r){const t=free.shift();t.ln=i;t.li=null;t.lots=t.lots||[];if(t.cargo>0&&!t.lots.length)t.lots=[{k:t.k,n:t.cargo,o:-1,d:6}];t.eh=[];t.born=S.t;syncRoute(t);k++}});
 save();if(!quiet)toast('🚆 '+S.L.length+' lines planned, '+k+' trains on them'+(free.length?', '+free.length+' spare':''));return{lines:S.L.length,on:k,spare:free.length}}

// ---------- a new place joins the network: offer it to a line ----------
let lnAskT=0;function lnOffer(){if(!S.L||document.getElementById('notice')&&document.getElementById('notice').style.display==='block')return;if(S.t-lnAskT<8)return;
 const o=sites.find(o=>stopOk(o)&&!o.lnAsked&&o.type!=='town'&&!Ls().some(L=>L.s.includes(sites.indexOf(o))));if(!o)return;o.lnAsked=1;lnAskT=S.t;const i=sites.indexOf(o),k=offerOf(o);
 const D=k?destsFor(o):[],best=D[0];const opts=[];
 if(best){const j=Ls().findIndex(L=>L.s.includes(best.i)&&L.s.length<LMAX);if(j>=0)opts.push([lnChip(Ls()[j])+'Add to the '+lnName(Ls()[j]),`lineLink(${i},${best.i});noticeClose()`]);opts.push(['＋ New line to '+nm(best.B),`lnNewWith(${i},${best.i});noticeClose()`])}
 if(!opts.length)return;
 notice(`<b style="color:#ffd27a;font-size:15px">${TYPES[o.type].g} ${nm(o)} is on the network</b><br><small style="opacity:.85">${k?'It makes '+gname(k)+'. Best buyer: '+(best?nm(best.B)+(best.left>0?' (📋 open order)':''):'none yet')+'.':''}</small><div style="margin-top:8px;display:flex;flex-direction:column;gap:6px">`+opts.map(([l,f])=>`<button onclick="${f}" style="padding:7px 12px;border-radius:9px;border:0;background:#2e7d6b;color:#fff;font-weight:700;text-align:left">${l}</button>`).join('')+`<button onclick="noticeClose()" style="padding:6px 12px;border-radius:9px;border:1px solid #6b5a3e;background:#3a2f22;color:#f3e6c8">Later</button></div>`)}
function noticeClose(){const e=document.getElementById('notice');if(e)e.style.display='none'}
function lnNewWith(a,b){const i=lnNew([a,b]);lnAddTrain(i,true);save();refreshPanel();showLine(i)}
setInterval(()=>{try{lnOffer()}catch(e){}},2500);

// ---------- first load of an older game: turn its jobs into lines ----------
function lnMigrate(){if(S.L)return;S.L=[];if(S.trains.some(t=>t.route)){const r=tidyLines(true);setTimeout(()=>notice(`<b style="color:#ffd27a;font-size:16px">🚆 Your railway now runs on lines</b><br>Your ${S.trains.length} trains were grouped into <b>${r.lines} coloured lines</b>. Each line runs back and forth through its stops: trains drop off whatever a stop wants and pick up whatever another stop on the line wants.<br><small style="opacity:.85">Lines add or park their own trains to match their work (switch it off on a line if you like). Open 🚂 Trains to see them.</small><br><button onclick="noticeClose();showShed(0)" style="margin-top:8px;padding:6px 12px;border-radius:8px;border:0;background:#2e7d6b;color:#fff;font-weight:700">See my lines</button>`),1500)}}
try{lnMigrate()}catch(e){console.error(e)}

// ---------- the Lines board (🚂 Trains) and a line's own card ----------
function lnProfit(i){let p=0,any=false;for(const{t}of lnTrains(i)){const r=tRate(t);if(r!==null){p+=r-tCost(t);any=true}}return any?p:null}
function lnCard(L,i){const T=lnTrains(i),n=T.length,lv=T.filter(({t})=>t.stop).length,W=lnWarn(L),c=lnCol(L);
 return`<div onclick="showLine(${i})" style="margin-top:7px;padding:7px 9px;border-radius:10px;background:#1f2a28;border-left:7px solid ${c};cursor:pointer"><b style="font-size:14px">${lnName(L)}</b> <small style="opacity:.8">🚂 ${n-lv}${L.auto===false?'':' (auto)'}</small> ${profTxt(lnProfit(i))} <span style="float:right;opacity:.7">›</span><br><small>${lnStops(L)}</small>`+(lnCarry(L)?`<br><small style="opacity:.75">${lnCarry(L)}</small>`:'')+(W.length?`<br><small style="color:#ffb36b">⚠ ${W[0]}</small>`:'')+'</div>'}
function showShed(i){if(i>=100)return showTrain(i-100);openFac=null;openInfo=null;openShed=0;sel=null;spot=null;flowSel=null;PANEL={n:'showShed',a:[0]};const el=document.getElementById('panel');el.style.display='block';
 const n=S.trains.length,sp=spareTrains().length;
 let h=`<b style="font-size:16px">🚆 Your lines</b> <small style="opacity:.75">${n} train${n===1?'':'s'} · upkeep ${fmt(Math.round(trainsCost()*60))}/min</small><br><small style="opacity:.8">Each line runs back and forth through its stops. Trains drop off what a stop wants and pick up what another stop on the line wants.</small>`;
 h+='<div style="margin-top:7px;display:flex;gap:6px;flex-wrap:wrap">'+tbtn('＋ New line','lnEdit(-1)')+tbtn('✨ Re-plan all lines','lnReplan()')+'</div>';
 if(sp)h+=sec2(`<b style="color:#ffd27a">💤 ${sp} spare train${sp>1?'s':''}</b> <small style="opacity:.8">parked in the Engine shed, ${fmt(Math.round(COST.trainWait*60))}/min each. Lines on auto take them first.</small><br>`+ubtn('💰 Sell '+(sp>1?'all '+sp+' spares':'it')+' · +'+fmt(sp*COST.train/2),'sellSpares()'));
 if(!Ls().length)h+=sec2('<span style="opacity:.85">No lines yet. Tap ＋ New line and tap the places it should join, in order (e.g. a 🪵 Lumber Camp, then Ashford).</span>');
 h+=Ls().map((L,i)=>lnCard(L,i)).join('');
 h+=sec2('<div>'+ubtn(S.lines===false?'🎨 Line colours on the map: off':'🎨 Line colours on the map: on','S.lines=S.lines===false?true:false;save();showShed(0)')+'</div>');
 h+=sec2(fold('alltr','<b>Every train ('+n+')</b> <small style="opacity:.7">details, upgrades, sell</small>',S.trains.map((t,j)=>`<div onclick="showTrain(${j})" style="margin-top:4px;padding:4px 8px;border-radius:8px;background:#2a221a;border-left:5px solid ${lineCol(j)};cursor:pointer"><b>Train ${tNo(t)}</b> <small>${jobTxt(t)} · ${trainStatus(t)}</small> ›</div>`).join('')));
 el.innerHTML=h}
function lnReplan(){if(!confirm2('lnReplan','This rebuilds every line from scratch around your industries and towns. Your trains are shared out again.'))return;tidyLines();showShed(0)}
// a one-tap "are you sure" without browser dialogs: the first tap arms it for 4 s
let armK=null,armT=0;function confirm2(k,msg){if(armK===k&&performance.now()-armT<4000){armK=null;return true}armK=k;armT=performance.now();toast('⚠ '+msg+' Tap again to confirm.');return false}
function showLine(i){const L=Ls()[i];if(!L)return showShed(0);openShed=0;openFac=null;openInfo=null;sel=null;spot=null;PANEL={n:'showLine',a:[i]};const el=document.getElementById('panel');el.style.display='block';
 const T=lnTrains(i),n=T.filter(({t})=>!t.stop).length,W=lnWarn(L),nb='padding:5px 10px;border-radius:8px;border:1px solid #6b5a3e;background:#3a2f22;color:#f3e6c8;font-size:13px',sp=spareTrains().length,cant=!sp&&S.money<COST.train;
 let h=`<div style="margin:-8px -2px 4px;padding:6px 40px 6px 2px;position:sticky;top:-8px;z-index:2;background:#2a241b"><button onclick="showShed(0)" style="${nb}">‹ All lines</button></div>`;
 h+=`<div style="border-left:7px solid ${lnCol(L)};padding-left:8px"><b style="font-size:16px">${lnName(L)}</b> ${profTxt(lnProfit(i))}<br>`+L.s.map((si,k)=>{const o=sites[si];return`<div style="margin-top:3px"><b style="display:inline-block;width:18px;height:18px;border-radius:9px;background:${lnCol(L)};color:#111;text-align:center;font-size:12px;line-height:18px">${k+1}</b> ${o.type==='town'?'🏘':isFac(o)?'🏭':TYPES[o.type].g} <b>${nm(o)}</b>${offerOf(o)?' <small style="opacity:.75">gives '+gname(offerOf(o))+'</small>':''}</div>`}).join('')+'</div>';
 if(lnCarry(L))h+=sec2('<small>📦 Carries '+lnCarry(L)+'</small>');
 if(W.length)h+=sec2(W.map(w=>'<div style="color:#ffb36b"><small>⚠ '+w+'</small></div>').join(''));
 h+=sec2(`<b>Trains</b> <span style="display:inline-flex;align-items:center;gap:7px;margin-left:6px">`+lbtn('−',`lnDropTrain(${i});showLine(${i})`,n<=0)+`<b>🚂 ${n}</b>`+lbtn('＋',`lnAddTrain(${i});showLine(${i})`,cant)+'</span>'+`<br><small style="opacity:.8">This line has work for about ${lnNeed(L)} train${lnNeed(L)>1?'s':''}.${n>lnNeed(L)?' ⚠ '+(n-lnNeed(L))+' extra train'+(n-lnNeed(L)>1?'s':'')+' here: '+(n-lnNeed(L)>1?'they':'it')+' will often wait for a load. Tap − to park '+(n-lnNeed(L)>1?'them':'it')+' as a spare.':''}</small><br>`+ubtn(L.auto===false?'🤖 Auto trains: off (you set the count)':'🤖 Auto trains: on (buys or parks trains to match)',`Ls()[${i}].auto=Ls()[${i}].auto===false?true:false;save();showLine(${i})`)+(T.length?'<div style="margin-top:4px">'+T.map(({t,j})=>`<div onclick="showTrain(${j})" style="margin-top:3px;padding:3px 7px;border-radius:7px;background:#2a221a;cursor:pointer"><small><b>Train ${tNo(t)}</b> · ${trainStatus(t)}</small> ›</div>`).join('')+'</div>':''));
 {const dt=lnDblTiles(L);h+=sec2('<div style="display:flex;gap:6px;flex-wrap:wrap">'+tbtn('📍 Show',`lnShow(${i})`)+tbtn('✏ Change stops',`lnEdit(${i})`)+(dt.length&&n>=2?tbtn('🛤🛤 Double its track · '+fmt(dt.length*DBL),`lnDbl(${i})`,S.money<dt.length*DBL):'')+tbtn('🗑 Delete line',`lnDel(${i})`)+'</div>')}
 el.innerHTML=h}
const lnTiles=L=>{let pp=[];for(let k=1;k<L.s.length;k++)pp=pp.concat(lnPath(L.s[k-1],L.s[k])||[]);return pp};
const lnDblTiles=L=>[...new Set(lnTiles(L).map(([x,y])=>id(x,y)).filter(k=>track.has(k)&&!dblSet.has(k)))];
function lnDbl(i){const T=lnDblTiles(Ls()[i]),c=T.length*DBL;if(!T.length||S.money<c)return;S.money-=c;for(const k of T){dblSet.add(k);S.dbl.push(k);delete JAM[k]}toast('🛤🛤 '+T.length+' squares doubled');save();showLine(i)}
function lnShow(i){const L=Ls()[i];if(!L)return;const P=L.s.map(si=>sites[si]).filter(Boolean),xs=P.map(o=>o.x),ys=P.map(o=>o.y),x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys);lnHi={i,until:performance.now()+6000};document.getElementById('panel').style.display='none';const v=viewBox(),w=(x1-x0+4)*TS,hh=(y1-y0+4)*TS;cam.z=Math.max(.3,Math.min(1.8,Math.min((v.right-v.left)/w,(v.bot-v.top)/hh)));cam.x=(x0+x1+1)/2*TS;cam.y=(y0+y1+1)/2*TS-((v.top+v.bot)/2-H/2)/cam.z;toast(lnEmo(L)+' '+lnName(L))}
let lnHi=null;
function lnDel(i){if(!confirm2('lnDel'+i,'Delete the '+lnName(Ls()[i])+'? Its trains park as spares.'))return;for(const t of S.trains){if(t.ln===i){t.ln=null;t.li=null;t.route=null;t.stop=0;if(t.cargo>0){t.lots=[];lotsSum(t)}if(t.st==='toDst')t.st='idle'}else if(t.ln>i)t.ln--}S.L.splice(i,1);syncAll();save();showShed(0)}

// ---------- making or changing a line on the map: tap its stops in order ----------
let LE=null;
function lnEdit(i){LE={i,s:i>=0?Ls()[i].s.slice():[]};document.getElementById('panel').style.display='none';lnBar()}
function lnBar(){let b=document.getElementById('lebar');if(!b){b=document.createElement('div');b.id='lebar';b.style.cssText='position:fixed;left:8px;right:8px;bottom:calc(env(safe-area-inset-bottom) + 72px);z-index:15;background:#2a241bf2;border:1.5px solid #7fd36b;border-radius:12px;padding:8px 10px;color:#f3e6c8;font:13px system-ui;max-width:520px;margin:0 auto';document.body.appendChild(b)}
 if(!LE){b.style.display='none';return}b.style.display='block';const ok=LE.s.length>=2,col=LE.i>=0?lnCol(Ls()[LE.i]):LPAL[nextCol()%LPAL.length];
 b.innerHTML=`<b style="color:${col}">${LE.i>=0?'✏ '+lnName(Ls()[LE.i]):'＋ New line'}</b> <small style="opacity:.85">Tap places in the order the line visits them. Tap a stop again to take it off.</small><br><small>${LE.s.length?LE.s.map((si,k)=>(k+1)+'. '+nm(sites[si])).join(' → '):'<i>no stops yet</i>'}</small><div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap">`+tbtn(LE.i>=0?'✓ Save':'✓ Create line'+(spareTrains().length?'':' · '+fmt(COST.train)),'lnEditDone()',!ok)+tbtn('↶ Undo','LE.s.pop();lnBar()',!LE.s.length)+tbtn('Cancel','LE=null;lnBar()')+'</div>'}
function lnEditTap(x,y){const o=bldAt(x,y)||stnAt(x,y)||near(x,y);if(!o){toast('Tap a town, an industry or a factory');return}const i=sites.indexOf(o);
 if(LE.s.includes(i)){LE.s=LE.s.filter(v=>v!==i);lnBar();return}
 if(!stopOk(o)){toast(o.linked?'A line can stop at towns, industries and factories':'Join '+nm(o)+' to your track first');return}
 if(LE.s.length>=LMAX){toast('A line can have up to '+LMAX+' stops. Start another line for more');return}
 if(LE.s.length&&!lnPath(LE.s[LE.s.length-1],i)){toast('No track joins '+nm(sites[LE.s[LE.s.length-1]])+' and '+nm(o));return}
 LE.s.push(i);lnBar()}
function lnEditDone(){if(!LE||LE.s.length<2)return;let i=LE.i;if(i>=0){Ls()[i].s=LE.s.slice();for(const{t}of lnTrains(i)){t.li=null;syncRoute(t)}}else{i=lnNew(LE.s);lnAddTrain(i,true)}LE=null;lnBar();save();showLine(i)}
{const _tap=tap;tap=function(x,y){if(LE){lnEditTap(x,y);return}return _tap(x,y)}}
// draw: numbered badges on the stops of the line being edited or shown
function lnDraw(){const sh=lnHi&&performance.now()<lnHi.until?Ls()[lnHi.i]:null,list=LE?LE.s:sh?sh.s:null;if(!list)return;const col=LE?(LE.i>=0?lnCol(Ls()[LE.i]):LPAL[nextCol()%LPAL.length]):lnCol(sh);
 for(let k=1;k<list.length;k++){const p=lnPath(list[k-1],list[k]);if(!p)continue;ctx.strokeStyle=col;ctx.lineWidth=5;ctx.globalAlpha=.8;ctx.beginPath();for(let q=0;q<=(p.length-1)*4;q++){const[X,Y]=ptAt(p,q/4);q?ctx.lineTo(X,Y):ctx.moveTo(X,Y)}ctx.stroke();ctx.globalAlpha=1}
 list.forEach((si,k)=>{const o=sites[si];if(!o)return;const X=(o.x+.5)*TS,Y=(o.y+.5)*TS-26;ctx.fillStyle='#000a';ctx.beginPath();ctx.arc(X+1,Y+1,10,0,7);ctx.fill();ctx.fillStyle=col;ctx.beginPath();ctx.arc(X,Y,10,0,7);ctx.fill();ctx.fillStyle='#111';ctx.font='bold 12px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(k+1,X,Y+1)});
 if(LE)for(const o of sites)if(stopOk(o)&&!LE.s.includes(sites.indexOf(o))){const a=.5+.3*Math.sin(performance.now()/200);ctx.strokeStyle=`rgba(127,211,107,${a})`;ctx.lineWidth=3;ctx.beginPath();ctx.arc((o.x+.5)*TS,(o.y+.5)*TS,20,0,7);ctx.stroke()}}

function sellSpares(){const L=spareTrains().filter(({t})=>!(t.cargo>0));if(!L.length)return;const v=L.length*COST.train/2,rm=new Set(L.map(({t})=>t));S.trains=S.trains.filter(t=>!rm.has(t));S.money+=v;toast('💰 Sold '+L.length+' spare train'+(L.length>1?'s':'')+': +'+fmt(v));save();showShed(0)}

// ---------- a place's card: the lines through it, and one tap to add it to one ----------
function linesHere(s){if(!s||!s.linked||s.hidden)return'';const i=sites.indexOf(s),M=Ls().map((L,k)=>({L,k})).filter(({L})=>L.s.includes(i));
 let h='<b>🚆 Lines here</b>'+(M.length?'':' <small style="color:#ffd27a">none yet: its goods sit and wait</small>');
 h+=M.map(({L,k})=>`<div onclick="showLine(${k})" style="margin-top:5px;padding:5px 8px;border-radius:9px;background:#1f2a28;border-left:6px solid ${lnCol(L)};cursor:pointer"><b>${lnName(L)}</b> <small>🚂 ${lnTrains(k).length}</small> ›<br><small style="opacity:.8">${L.s.map(si=>nmS(sites[si])).join(' → ')}</small></div>`).join('');
 h+='<div style="margin-top:5px;display:flex;gap:6px;flex-wrap:wrap">'+(Ls().some(L=>!L.s.includes(i)&&L.s.length<LMAX)?tbtn('＋ Add to a line',`lnPickFor(${i})`):'')+tbtn('＋ New line from here',`lnEditFrom(${i})`)+'</div>';
 return sec2(h)}
function trainsHere(s){return linesHere(s)}
function lnEditFrom(i){LE={i:-1,s:[i]};document.getElementById('panel').style.display='none';lnBar();toast('Now tap the next stop of the new line')}
// lines it could join, nearest first, with what each would gain
function lnPickFor(i){const o=sites[i],el=document.getElementById('panel');el.style.display='block';PANEL={n:'lnPickFor',a:[i]};const nb='padding:5px 10px;border-radius:8px;border:1px solid #6b5a3e;background:#3a2f22;color:#f3e6c8;font-size:13px';
 const C=Ls().map((L,k)=>{if(L.s.includes(i)||L.s.length>=LMAX)return null;const e=[[L.s[0],0],[L.s[L.s.length-1],1]].map(([e,w])=>{const p=lnPath(e,i);return p?{d:p.length,w}:null}).filter(Boolean).sort((a,b)=>a.d-b.d)[0];if(!e)return null;const k2=offerOf(o),gain=[];if(k2&&L.s.some(sj=>accepts(sites[sj],k2)))gain.push('its '+gname(k2)+' gets a buyer');for(const sj of L.s){const q=offerOf(sites[sj]);if(q&&accepts(o,q))gain.push(gname(q)+' from '+nm(sites[sj]))}return{L,k,d:e.d,gain}}).filter(Boolean).sort((a,b)=>(b.gain.length>0)-(a.gain.length>0)||a.d-b.d);
 let h=`<div style="margin:-8px -2px 4px;padding:6px 40px 6px 2px;position:sticky;top:-8px;z-index:2;background:#2a241b"><button onclick="showInfo(sites[${i}])" style="${nb}">‹ ${nm(o)}</button></div><b style="font-size:15px">Add ${nm(o)} to a line</b><br><small style="opacity:.8">It becomes a new stop at the nearer end of the line.</small>`;
 h+=C.length?C.map(c=>`<div style="margin-top:6px;padding:6px 8px;border-radius:9px;background:#1f2a28;border-left:6px solid ${lnCol(c.L)}"><b>${lnName(c.L)}</b> <small style="opacity:.75">${c.d} tiles away</small><br><small>${c.L.s.map(si=>nmS(sites[si])).join(' → ')}</small>`+(c.gain.length?`<br><small style="color:#7fd36b">✓ ${c.gain.join(' · ')}</small>`:'<br><small style="opacity:.6">Nothing on it trades with this place yet</small>')+'<br>'+tbtn('Add it',`lnAddStop(${c.k},${i})`)+'</div>').join(''):'<div style="margin-top:6px;opacity:.8">No line can reach it (or every line is full). Start a new line from it instead.</div>';
 el.innerHTML=h}
function lnAddStop(k,i){const L=Ls()[k];if(!L||L.s.includes(i))return;const a=lnPath(L.s[0],i),b=lnPath(L.s[L.s.length-1],i);if(!a&&!b){toast('No track joins it to the '+lnName(L));return}if(b&&(!a||b.length<=a.length))L.s.push(i);else L.s.unshift(i);for(const{t}of lnTrains(k)){t.li=null;syncRoute(t)}if(!lnTrains(k).length)lnAddTrain(k,true);toast(lnEmo(L)+' '+nm(sites[i])+' added to the '+lnName(L));save();showLine(k)}

// ================= v126 TRAINS RUN THEMSELVES =================
// One rule you can predict: every building sends its goods to the nearest place that needs them (an open town order
// or a factory with room), otherwise to the nearest place that buys them. Idle trains take the best waiting load.
// You grow the map and improve the whole fleet with upgrades; there are no routes to set.
const UPG={
 wag:{n:'🚃 Bigger wagons',d:'every train carries more',lv:[1,1.5,2.25,3.25],c:[3000,8000,20000],t:l=>'load '+Math.round(20*[1,1.5,2.25,3.25][l])},
 eng:{n:'⚙ Stronger engines',d:'every train runs faster',lv:[1,1.25,1.5,1.8],c:[4000,10000,25000],t:l=>['steam','fast steam','diesel','express diesel'][l]+' · ×'+[1,1.25,1.5,1.8][l]+' speed'},
 rng:{n:'⛽ Bigger tenders',d:'trains go further between refuels',lv:[30,45,65,100],c:[2500,7000,15000],t:l=>[30,45,65,100][l]+' tiles from a town or water tower'},
 rep:{n:'🔧 Repair works',d:'well-kept trains cost less to run',lv:[1,.75,.55],c:[5000,15000],t:l=>'upkeep −'+[0,25,45][l]+'%'}};
const CARGO={hop:{n:'Hopper wagons',g:'⚫🧲',k:['coal','iron'],c:3000},tank:{n:'Tank wagons',g:'🛢⛽',k:['oil','fuel'],c:6000},flat:{n:'Flat wagons',g:'⚙️',k:['steel'],c:5000}};
const TOWER=1200;
// v127: upgrades belong to an island (territory): trains working on that island use its levels
const islOf=o=>o?ISLC[id(o.x,o.y)]:-1,homeK=()=>ISLC[id(C,C)];
function U(k){if(!S.upI){S.upI={};S.upI[homeK()]=S.up||{wag:0,eng:0,rng:0,rep:0};
  for(const o of sites)if(o.linked&&!o.hidden){const g=offerOf(o),c=g&&cargoCls(g),q=islOf(o);if(c&&q>=0&&q!==homeK()){const u=S.upI[q]=S.upI[q]||{wag:0,eng:0,rng:0,rep:0};u[c]=1}}}
 if(k==null||k<0)k=S.shI!=null?S.shI:homeK();if(!S.upI[k])S.upI[k]={wag:0,eng:0,rng:0,rep:0};if(k===homeK())S.upI[k].hop=1;return S.upI[k]}
const tIsl=t=>{const A=t.route&&sites[t.route.a];if(A)return islOf(A);const p=t.path&&t.path.length?t.path[Math.min(t.path.length-1,Math.round(t.pos||0))]:null;return p?ISLC[id(p[0],p[1])]:homeK()};
function upMul(k,t){if(!S.auto)return 1;const l=U(t?tIsl(t):homeK())[k]||0;return UPG[k].lv[l]}
const cargoCls=k=>Object.keys(CARGO).find(c=>CARGO[c].k.includes(k));
const canCarry=(k,q)=>{const c=cargoCls(k);return!c||!!U(q)[c]};
function buyFleet(k,q){const u=U(q),l=u[k]||0;if(CARGO[k]){if(u[k])return;if(S.money<CARGO[k].c){toast('Costs '+fmt(CARGO[k].c));return}S.money-=CARGO[k].c;u[k]=1;toast('🧰 '+CARGO[k].n+': trains can now carry '+CARGO[k].k.map(gname).join(' and '))}
 else{const c=UPG[k].c[l];if(c==null)return;if(S.money<c){toast('Costs '+fmt(c));return}S.money-=c;u[k]=l+1;toast(UPG[k].n+': '+UPG[k].t(l+1));AUTO.k=''}save();refreshPanel()}
// ---- refuelling: Ashford, every linked town and every water tower; a place is in range if it is close enough by rail ----
let RK='',RD=null;function rangeMap(){const k=track.size+'/'+sites.length+'/'+JSON.stringify(S.upI||0)+'/'+sites.filter(o=>o.tower).length+'/'+sites.filter(o=>o.type==='town'&&o.linked).length;if(k===RK&&RD)return RD;RK=k;
 const dist=new Int32Array(N*N).fill(-1),q=[];for(const o of sites)if(o.beacon||o.tower||o.type==='town'&&o.linked&&(o.pop>0)||o.type==='port'&&o.linked){const i=id(o.x,o.y);if(dist[i]<0){dist[i]=0;q.push(i)}}
 for(let h=0;h<q.length;h++){const i=q[h],x=i%N,y=(i/N)|0;for(const[dx,dy]of D4){const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=N||ny>=N)continue;const j=id(nx,ny);if(dist[j]<0&&isRail(nx,ny)&&!laneSet.has(j)){dist[j]=dist[i]+1;q.push(j)}}}RD=dist;return RD}
const fuelD=o=>rangeMap()[id(o.x,o.y)];
const rngOf=o=>UPG.rng.lv[U(islOf(o)).rng||0];const fuelOk=o=>{const d=fuelD(o);return d>=0&&d<=rngOf(o)};
// ---- where each building's goods go ----
let AUTO={k:'',m:new Map(),t:0};
// v126: each place that still needs a good is shared out nearest-first, so ten camps don't all pile into one factory
// goods already on their way, counted from the trains themselves (a stored tally drifted when loads were rerouted)
const incOf=(T,k)=>{const ti=sites.indexOf(T);let n=0;for(const t of S.trains)if(t.st==='toDst'&&t.dst===ti&&t.k===k)n+=t.cargo||0;else if(t.st==='toSrc'&&t.route&&t.route.b===ti&&offerOf(sites[t.route.a])===k)n+=Math.min(trainCap(t),Math.floor(sites[t.route.a].stock||0));return n};
const roomFor=(T,k)=>{if(!accepts(T,k))return 0;const inc=incOf(T,k);if(isFac(T))return Math.max(0,FACT.buf(T.lvl||1)*.8-((T.inp||{})[k]||0)-inc);return Math.max(0,lnWant(T,k)-inc)};
function shipPlan(){const k=track.size+'/'+sites.length+'/'+JSON.stringify(S.upI||0)+'/'+Math.floor(S.t/6)+'/'+sites.reduce((a,o)=>a+(o.pin!=null?o.pin+1:0),0);if(AUTO.k===k)return AUTO.m;AUTO.k=k;const m=new Map(),pairs=[],room=new Map();
 for(const P of sites){const k2=offerOf(P);if(!k2||!P.linked||P.hidden)continue;const pi=sites.indexOf(P),b=bfs(id(P.x,P.y));const why=[];if(!canCarry(k2,islOf(P)))why.push('needs '+CARGO[cargoCls(k2)].n);if(!fuelOk(P))why.push('out of fuel range');
  const C=[];for(const T of sites){if(T===P||!stopOk(T)||!accepts(T,k2))continue;const d=b.dist[id(T.x,T.y)];if(!(d>0))continue;const ti=sites.indexOf(T);C.push({T,ti,d,w:roomFor(T,k2),r:fuelOk(T)})}
  const ok=C.filter(c=>c.r).sort((x,y)=>x.d-y.d);if(!ok.length&&C.length)why.push('every buyer is out of fuel range');
  const f={k:k2,to:null,d:0,need:false,pin:false,why,alt:ok.slice(0,5),sup:(P.stock||0)+makeRate(P)};m.set(pi,f);
  const pin=P.pin!=null?ok.find(c=>c.ti===P.pin):null;if(pin){f.to=pin.ti;f.d=pin.d;f.pin=true;f.need=pin.w>0;continue}
  for(const c of ok){const key=c.ti+'/'+k2;if(!room.has(key))room.set(key,c.w);if(c.w>0)pairs.push({pi,c,key})}}
 // v131: factories and open town orders come before towns that just keep buying (steady demand), so a factory is never starved by a nearer town
 const prio=c=>{const T=c.T;if(isFac(T))return 0;const o=T.type==='town'?ordOf(T):null,k=c.k2;return o&&o[k]&&((T.got||{})[k]||0)<o[k]?0:400};pairs.forEach(q=>q.c.k2=m.get(q.pi).k);pairs.sort((x,y)=>prio(x.c)+x.c.d-prio(y.c)-y.c.d);
 for(const q of pairs){const f=m.get(q.pi);if(f.to!=null)continue;const r=room.get(q.key);if(r<=0)continue;f.to=q.c.ti;f.d=q.c.d;f.need=true;f.pr=prio(q.c)===0;room.set(q.key,r-Math.max(10,f.sup))}
 // nothing nearby needs it: the nearest town that buys it (factories only take what they have room for)
 for(const[pi,f]of m){if(f.to!=null)continue;const c=f.alt.find(c=>!isFac(c.T))||null;if(c){f.to=c.ti;f.d=c.d}else if(f.alt.length&&!f.why.length)f.full=nm(f.alt[0].T)}
 AUTO.m=m;return m}
const shipOf=P=>shipPlan().get(sites.indexOf(P));
// ---- the dispatcher: an idle train takes the best waiting load ----
function autoPick(t){const here=trainTile(t),b=bfs(here),cap=trainCap(t),M=shipPlan();let best=null;
 const claim=new Map();for(const o of S.trains)if(o!==t&&o.route&&o.st==='toSrc')claim.set(o.route.a,(claim.get(o.route.a)||0)+trainCap(o));
 // v142: loads an order or factory needs always come first; extra goods only move when nothing needed is waiting
 let bestN=null;for(const[pi,f]of M){if(f.to==null||f.why.length)continue;const P=sites[pi];const avail=(P.stock||0)-(claim.get(pi)||0);const full=(P.stock||0)>=(isFac(P)?FACT.buf(P.lvl||1):IND.cap(P))*.8;if(avail<(f.need?Math.min(cap*.25,6):Math.min(cap*.5,12))&&!(full&&avail>0))continue;
  const d0=b.dist[id(P.x,P.y)];if(d0<0)continue;const load=Math.min(avail,cap),v=load*(TYPES[f.k].rate||5)*(isFac(sites[f.to])?1.2:1),sc=v/(d0+f.d+8)*(f.rush?4:1);if(f.need){if(!bestN||sc>bestN.sc)bestN={sc,a:pi,b:f.to}}else if(!best||sc>best.sc)best={sc,a:pi,b:f.to}}
 if(bestN)return bestN;
 // something is needed but its building hasn't made a load yet: wait for it instead of hauling extras that would block the line
 for(const[pi,f]of M){if(f.to==null||f.why.length||!f.need)continue;const P=sites[pi];if((claim.get(pi)||0)>0)continue;if(b.dist[id(P.x,P.y)]>=0&&makeRate(P)>0&&S.trains.filter(o=>o!==t&&!o.route&&!(o.cargo>0)).length===0&&best&&sites[best.a]!==P)return{sc:0,a:pi,b:f.to}}
 return best}
var autoWhy=(f)=>{if(!f||f.to==null)return'';const T=sites[f.to];return f.pin?'you chose it':isFac(T)&&f.need?'the '+TYPES[T.type].n+' needs it':f.need?'its order needs it':'nearest buyer'};
// loads sitting at buildings that no train is coming for: the fleet is too small when this stays high
function waitingLoads(){let n=0;const M=shipPlan();for(const[pi,f]of M){if(f.to==null||f.why.length)continue;const P=sites[pi],c=S.trains.filter(t=>t.route&&t.route.a===pi&&t.st==='toSrc').length;if((P.stock||0)>=20*(c+1))n++}return n}
const idleTrains=()=>S.trains.filter(t=>!t.route&&!(t.cargo>0));
{const o=dispatch;dispatch=function(t){if(!S.auto)return o(t);
 if(t.route&&!t.route.auto)t.route=null;t.ln=null;
 const j=autoPick(t);if(!j){const here=trainTile(t),P=t.path,E=P&&P.length>1?P[P.length-1]:null;t.route=null;t.why='Waiting for a load';if(E&&id(E[0],E[1])===here)t.pos=P.length-1;else{t.path=[[here%N,(here/N)|0]];t.pos=0}t.st='idle';t.wait=2;return}
 t.route={a:j.a,b:j.b,c:null,auto:1};t.stop=0;dispatchJob(t)}}
{const o=arrived;arrived=function(t){if(!S.auto)return o(t);const was=t.st;arrivedJob(t);if(was==='toDst'&&t.st==='idle')t.route=null;
 // a factory turned out to be full: take the load on to the nearest town that buys it instead of waiting
 if(was==='toDst'&&t.st==='toDst'&&t.cargo>0&&(t.lw||0)>=3){const B=sites[t.dst],b=bfs(id(B.x,B.y));let best=null,bd=1e9;for(const T of sites){if(T===B||T.type!=='town'||!stopOk(T)||!accepts(T,t.k))continue;const d=b.dist[id(T.x,T.y)];if(d>0&&d<bd){bd=d;best=T}}
  if(best){const p=pathTo(b,id(best.x,best.y));if(p){t.dst=sites.indexOf(best);if(t.route)t.route.b=t.dst;t.path=p;t.pos=0;t.lw=0;t.why='';t.wait=0}}}
 // a train that waited too long at an empty building gives up and looks for another load
 if(t.st==='toSrc'&&(t.lw||0)>=12&&!(t.cargo>0)&&(sites[t.src].stock||0)<1){t.route=null;t.st='idle';t.lw=0}}}
// the old per-train buttons now feed the fleet: "send a train" buys one, a chosen job is not needed
{const o=sendJob;sendJob=function(a,b){if(!S.auto)return o(a,b);if(idleTrains().length){toast('🚂 A free train will pick it up');return}if(newTrain()>=0){toast('🚂 Train bought: it runs by itself');save();refreshPanel()}}}
{const o=assignJob;assignJob=function(j,a,b){if(!S.auto)return o(j,a,b)}}
{const o=pickTrain;pickTrain=function(j,a,b){if(!S.auto)return o(j,a,b);if(j<0)sendJob(a,b)}}
{const o=brings;brings=(B,k)=>{if(!S.auto)return o(B,k);const bi=sites.indexOf(B),r=[];for(const[pi,f]of shipPlan())if(f.to===bi&&f.k===k&&!f.why.length)r.push(pi);return r}}
{const o=lineCarry;lineCarry=function(a,b){if(!S.auto)return o(a,b);const f=shipPlan().get(a);return f&&f.to===b&&!f.why.length?makeRate(sites[a]):0}}
{const o=sendList;sendList=function(A){return S.auto?'':o(A)}}
{const o=noTrainTxt;noTrainTxt=()=>S.auto?'':o()}
{const o=lnOffer;lnOffer=function(){if(!S.auto)return o()}}
{const o=lnAuto;lnAuto=function(){if(!S.auto)return o()}}
function pinTo(a,b){const A=sites[a];if(!A)return;if(b==null||b<0){delete A.pin;toast('📍 '+nm(A)+' ships to the nearest place that needs it again')}else{A.pin=b;toast('📌 '+nm(A)+' now always ships to '+nm(sites[b]))}AUTO.k='';save();refreshPanel()}
function buildTower(i){const o=sites[i];if(!o||o.tower)return;if(S.money<TOWER){toast('A water tower costs '+fmt(TOWER));return}S.money-=TOWER;o.tower=1;RK='';AUTO.k='';toast('⛽ Water tower built: trains refuel at '+nm(o));save();refreshPanel()}
// ---- cards ----
function autoHere(s){if(!s||!s.linked||s.hidden)return'';const i=sites.indexOf(s),f=shipOf(s);let h='';
 if(f){const g=TYPES[f.k].g+' '+GOOD[f.k].toLowerCase();
  if(f.why.length){h+='<b style="color:#ffb36b">⚠ Its '+g+' is not moving</b>';
   if(!canCarry(f.k,islOf(s))){const c=cargoCls(f.k);h+='<br><small>Your trains have no '+CARGO[c].n.toLowerCase()+' yet.</small><br>'+tbtn('🧰 Buy '+CARGO[c].n+' · '+fmt(CARGO[c].c),`buyFleet('${c}',${islOf(s)})`,S.money<CARGO[c].c)}
   if(!fuelOk(s))h+='<br><small>Too far for your trains to refuel ('+(fuelD(s)<0?'no rail to a town':fuelD(s)+' tiles from a town or water tower, range '+rngOf(s))+').</small><br>'+tbtn('⛽ Water tower here · '+fmt(TOWER),`buildTower(${i})`,S.money<TOWER)+' '+tbtn('Bigger tenders','showShed(0)');
   if(f.why.includes('every buyer is out of fuel range'))h+='<br><small>Every place that buys it is beyond fuel range: build a ⛽ water tower there, or get bigger tenders.</small>'}
  else if(f.to==null&&f.full)h+='🚂 <b>Its '+g+' waits</b><br><small style="opacity:.85">'+f.full+' is full for now; it ships again as soon as there is room.</small>';
  else if(f.to==null)h+='🚂 <b>Its '+g+' waits</b><br><small style="opacity:.85">No place on your track buys it yet. Link a town that wants it'+(Object.values(FAC).some(F=>f.k in F.in)?' or a factory that uses it':'')+'.</small>';
  else{const T=sites[f.to],n=S.trains.filter(t=>t.route&&t.route.a===i).length;h+=`🚂 <b>Ships ${g} → ${nm(T)}</b><br><small style="opacity:.85">${autoWhy(f)} · ${f.d} tiles · ${n?'🚂 '+n+' on it now':'next free train takes it'}</small>`;
   const alt=f.alt.filter(c=>c.ti!==f.to).slice(0,3);if(alt.length||f.pin)h+='<div style="margin-top:4px"><small style="opacity:.75">Send it somewhere else:</small><br>'+alt.map(c=>ubtn('📌 '+nm(c.T)+' · '+c.d+' tiles'+(c.w>0?' · needs it':''),`pinTo(${i},${c.ti})`)).join('')+(f.pin?ubtn('↺ Back to automatic',`pinTo(${i},-1)`):'')+'</div>'}}
 const inc=[...shipPlan()].filter(([pi,g])=>g.to===i&&!g.why.length);if(inc.length)h+=(h?'<br>':'')+'<b>📥 Coming in</b> '+inc.map(([pi,g])=>TYPES[g.k].g+' '+nm(sites[pi])).join(' · ');
 if(!s.tower&&(isInd(s)||isFac(s))){const d=fuelD(s),R=rngOf(s);if(d>R*.6&&fuelOk(s))h+='<br><small style="opacity:.8">⛽ '+d+' of '+R+' fuel tiles: a water tower here ('+fmt(TOWER)+') lets trains go further.</small> '+ubtn('⛽ Build',`buildTower(${i})`,S.money<TOWER)}
 if(s.tower)h+='<br><small style="opacity:.8">⛽ Water tower: trains refuel here</small>';
 return h?sec2(h):''}
{const o=linesHere;linesHere=function(s){return S.auto?autoHere(s):o(s)}}
{const o=trainsHere;trainsHere=function(s){return S.auto?autoHere(s):o(s)}}
{const o=lineBox;lineBox=(a,b,extra)=>{if(!S.auto)return o(a,b,extra);const f=shipPlan().get(a),A=sites[a];let r;
 if(f&&f.to===b&&!f.why.length)r='<span style="color:#7fd36b">✓ ships here by itself</span>';
 else if(f&&f.why.length)r='<span style="color:#ffb36b">⚠ '+f.why.join(', ')+'</span> '+tbtn('Fix',`showInfo(sites[${a}])`);
 else if(f&&f.to!=null)r='<small style="opacity:.85">goes to '+nm(sites[f.to])+' ('+autoWhy(f)+')</small> '+tbtn('📌 Send here instead',`pinTo(${a},${b})`);
 else r='<small style="opacity:.8">not linked yet</small>';
 return`<div style="margin-top:6px;padding:6px 8px;border-radius:9px;background:#1f2a28;border-left:5px solid ${f&&CCOL[f.k]||'#6b5a3e'}">${lineLbl(a,b)}${extra?' <small style="opacity:.8">'+extra+'</small>':''}<br>${r}</div>`}}
{const o=trainStatus;trainStatus=function(t){if(!S.auto)return o(t);if(!t.route&&!(t.cargo>0))return'💤 '+(t.why||'Waiting for a load');return t.why||(t.st==='toSrc'?'🚂 going to load at '+nmS(sites[t.src]):t.st==='toDst'?'🚂 carrying '+(t.cargo||0)+' '+GOOD[t.k].toLowerCase()+' to '+nmS(sites[t.dst]):'loading')}}
{const o=jobTxt;jobTxt=function(t){if(!S.auto)return o(t);const r=t.route,A=r&&sites[r.a],B=r&&sites[r.b];if(!A||!B)return'<span style="opacity:.8">💤 free</span>';const k=offerOf(A);return(k?TYPES[k].g+' ':'')+'<b>'+nmS(A)+' → '+nmS(B)+'</b>'}}
// ---- Engine shed: the fleet and its upgrades ----
const shIsles=()=>{const h=homeK(),L=new Set([h]);for(const o of sites)if(o.linked&&!o.hidden){const q=islOf(o);if(q>=0)L.add(q)}return[...L]};
const upRow=k=>{const u=UPG[k],l=U()[k]||0,c=u.c[l];return`<div style="margin-top:6px"><b>${u.n}</b> <small style="opacity:.75">${u.d}</small><br><small>Now: <b>${u.t(l)}</b></small>`+(c!=null?'<br>'+tbtn('⬆ '+u.t(l+1)+' · '+fmt(c),`buyFleet('${k}')`,S.money<c):' <small style="color:#7fd36b">· best there is</small>')+'</div>'};
function shedAuto(){openFac=null;openInfo=null;openShed=0;sel=null;spot=null;flowSel=null;PANEL={n:'showShed',a:[0]};const el=document.getElementById('panel');el.style.display='block';
 const n=S.trains.length,busy=S.trains.filter(t=>t.route).length,idle=idleTrains().length,wl=waitingLoads(),M=shipPlan();
 let h=`<b style="font-size:15px">🚂 Engine shed</b> <small style="opacity:.75">${n} train${n===1?'':'s'} · ${n?Math.round(busy/n*100):0}% busy · upkeep ${fmt(Math.round(trainsCost()*60))}/min</small><br><small style="opacity:.8">Your trains run themselves. Every building sends its goods to the <b>nearest place that needs them</b> (else the nearest buyer), and a free train takes the best waiting load. The arrows on the map show where everything goes.</small>`;
 h+=sec2(`<b>Fleet</b><br>`+(wl>idle?`<span style="color:#ffd27a">📦 ${wl} load${wl>1?'s are':' is'} waiting for a train: another train would help</span><br>`:idle>1&&n>2?`<span style="opacity:.85">💤 ${idle} trains have nothing to carry right now</span><br>`:n?'<span style="color:#7fd36b">✅ About the right number of trains</span><br>':'<span style="color:#ffd27a">You have no trains yet: buy one and it starts carrying at once</span><br>')+tbtn('＋ Buy a train · '+fmt(COST.train),'autoBuy()',S.money<COST.train)+(idle?tbtn('Sell a free train · +'+fmt(COST.train/2),'autoSell()'):'')+(idle>3?tbtn('Sell '+(idle-2)+' free trains (keep 2) · +'+fmt((idle-2)*COST.train/2),'autoSell('+(idle-2)+')'):''));
 const IS=shIsles();if(!IS.includes(S.shI))S.shI=IS[0];const isn=k=>ISLS[k]&&ISLS[k].nm||'Island';
 h+=sec2('<b>🏝 Territory</b> <small style="opacity:.75">each island upgrades its own trains</small><div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:4px">'+IS.map(k=>`<button onclick="S.shI=${k};showShed(0)" style="padding:5px 10px;border-radius:8px;border:${k===S.shI?'2px solid #ffd27a':'1px solid #6b5a3e'};background:${k===S.shI?'#4a3b22':'#2a221a'};color:#f3e6c8;font-size:12px">${isn(k)} · 🚂 ${S.trains.filter(t=>tIsl(t)===k).length}</button>`).join('')+'</div>');
 h+=sec2('<b>⬆ Upgrades on '+isn(S.shI)+'</b> <small style="opacity:.75">for every train working there</small>'+['wag','eng','rng','rep'].map(upRow).join(''));
 h+=sec2('<b>🧰 Wagon types on '+isn(S.shI)+'</b> <small style="opacity:.75">what trains there can carry</small><br><small>🪵 🌾 🪨 and factory goods: always'+(S.shI===homeK()?'; hoppers come free on '+isn(S.shI):'')+'</small>'+Object.keys(CARGO).map(c=>{const C=CARGO[c];return'<div style="margin-top:4px">'+C.g+' <b>'+C.n+'</b> <small>('+C.k.map(gname).join(', ')+')</small> '+(U()[c]?'<small style="color:#7fd36b">✓ owned</small>':tbtn('Buy · '+fmt(C.c),`buyFleet('${c}')`,S.money<C.c))+'</div>'}).join(''));
 const tw=sites.filter(o=>o.tower).length;h+=sec2(`<b>⛽ Fuel</b><br><small style="opacity:.85">Trains refuel at Ashford, every linked town and every water tower (${tw}). A building more than <b>${UPG.rng.lv[U().rng||0]} tiles</b> of track from those is out of range: tap it to build a tower there.</small>`);
 const F=[...M].filter(([pi,f])=>sites[pi]);h+=sec2(fold('flows','<b>Where goods go ('+F.length+')</b>',F.map(([pi,f])=>{const P=sites[pi],T=f.to!=null?sites[f.to]:null;return`<div onclick="showInfo(sites[${pi}])" style="margin-top:4px;padding:4px 8px;border-radius:8px;background:#2a221a;border-left:5px solid ${CCOL[f.k]||'#888'};cursor:pointer">${TYPES[f.k].g} <b>${nmS(P)}</b> → ${T?nmS(T)+' <small style="opacity:.7">'+autoWhy(f)+'</small>':'<small style="opacity:.7">nobody buys it yet</small>'}${f.why.length?' <small style="color:#ffb36b">⚠ '+f.why.join(', ')+'</small>':''}</div>`}).join('')||'<small style="opacity:.7">Nothing linked yet</small>',1));
 h+=sec2(fold('alltr','<b>Every train ('+n+')</b>',S.trains.map((t,j)=>`<div onclick="showTrain(${j})" style="margin-top:4px;padding:4px 8px;border-radius:8px;background:#2a221a;border-left:5px solid ${lineCol(j)};cursor:pointer"><b>Train ${tNo(t)}</b> <small>${jobTxt(t)}</small> <small style="opacity:.75">${trainStatus(t)}</small> ›</div>`).join('')));
 h+='<div style="margin-top:6px">'+ubtn(S.arrows===false?'➹ Arrows on the map: off':'➹ Arrows on the map: on','S.arrows=S.arrows===false?true:false;save();showShed(0)')+'</div>';
 el.innerHTML=h}
function autoBuy(){if(newTrain()>=0){toast('🚂 Train bought: it runs by itself');save()}refreshPanel()}
function autoSell(n){n=n||1;let k=0,v=0;for(;k<n;k++){const t=idleTrains()[0];if(!t)break;S.trains.splice(S.trains.indexOf(t),1);v+=COST.train/2;S.money+=COST.train/2}if(k)toast('💰 Sold '+(k>1?k+' free trains':'a free train')+': +'+fmt(v));save();refreshPanel()}
{const o=showShed;showShed=function(i){if(!S.auto)return o(i);if(i>=100)return showTrain(i-100);return shedAuto()}}
{const o=showTrain;showTrain=function(j){if(!S.auto)return o(j);const t=S.trains[j];if(!t)return shedAuto();openFac=null;openInfo=null;openShed=100+j;sel=null;spot=null;flowSel=null;PANEL={n:'showTrain',a:[j]};const el=document.getElementById('panel');el.style.display='block';
 const nb='padding:5px 10px;border-radius:8px;border:1px solid #6b5a3e;background:#3a2f22;color:#f3e6c8;font-size:13px',n=S.trains.length,pr=(j-1+n)%n,nx=(j+1)%n;
 let h=`<div style="display:flex;gap:5px;align-items:center;margin:-8px -2px 4px;padding:6px 40px 6px 2px;position:sticky;top:-8px;z-index:2;background:#2a241b"><button onclick="showShed(0)" style="${nb}">‹ Engine shed</button><span style="flex:1"></span>`+(n>1?`<button onclick="showTrain(${pr})" style="${nb}">‹</button><small style="opacity:.75">${j+1}/${n}</small><button onclick="showTrain(${nx})" style="${nb}">›</button>`:'')+'</div>';
 h+=`<b style="font-size:15px">🚃 Train ${tNo(t)}</b> <small style="opacity:.75">runs by itself</small>`+sec2(jobTxt(t)+'<br><small style="opacity:.85">'+trainStatus(t)+'</small>');
 const r=tRate(t);h+=sec2(`💰 Earned <b>${fmt(t.earn||0)}</b> in ${t.trips||0} trips`+(r!==null?'<br><small>earns '+fmt(r)+'/min · costs '+fmt(tCost(t))+'/min</small>':'')+`<br><small style="opacity:.75">Carries ${Math.round(trainCap(t))} · upgrades for the whole fleet are in the Engine shed</small>`);
 h+=sec2(ubtn('Sell · +'+fmt(COST.train/2),`sellTrain(${j})`,t.cargo>0));el.innerHTML=h}}
{const o=sellTrain;sellTrain=function(j){if(!S.auto)return o(j);const t=S.trains[j];if(!t||t.cargo>0)return;S.trains.splice(j,1);S.money+=COST.train/2;toast('💰 Train sold: +'+fmt(COST.train/2));save();shedAuto()}}
// ---- map: an arrow from every building to where its goods go ----
function autoDraw(){const now=performance.now()/1000;
 for(const o of sites)if(o.tower&&!o.hidden){const X=(o.x+.5)*TS+15,Y=(o.y+.5)*TS-12;ctx.fillStyle='#5b4330';ctx.fillRect(X-5,Y,2,10);ctx.fillRect(X+3,Y,2,10);ctx.fillStyle='#2f4f6a';ctx.fillRect(X-6,Y-8,12,9);ctx.fillStyle='#4f7fa6';ctx.fillRect(X-6,Y-8,12,2);ctx.fillStyle='#3b2c20';ctx.fillRect(X-7,Y-10,14,2)}
 if(S.arrows===false&&!flowFocus())return;const M=shipPlan(),F=flowFocus();
 for(const[pi,f]of M){const P=sites[pi];if(!P)continue;const X0=(P.x+.5)*TS,Y0=(P.y+.5)*TS;
  if(f.why.length){if(!canCarry(f.k,islOf(P)))continue;const a=.6+.4*Math.sin(now*4);ctx.globalAlpha=a;ctx.font='16px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('⛽',X0+16,Y0-20);ctx.globalAlpha=1;continue}
  if(f.to==null)continue;if(S.arrows===false&&F!==pi&&F!==f.to)continue;const T=sites[f.to],X1=(T.x+.5)*TS,Y1=(T.y+.5)*TS,dx=X1-X0,dy=Y1-Y0,L=Math.hypot(dx,dy);if(L<TS)continue;if(F!==pi&&F!==f.to&&L>10*TS)continue;
  const ux=dx/L,uy=dy/L,cx=(X0+X1)/2-uy*L*.12,cy=(Y0+Y1)/2+ux*L*.12,col=CCOL[f.k]||'#ddd',hi=F===pi||F===f.to,dim=F!=null&&!hi;
  const B=t=>[(1-t)*(1-t)*X0+2*(1-t)*t*cx+t*t*X1,(1-t)*(1-t)*Y0+2*(1-t)*t*cy+t*t*Y1],t0=Math.min(.45,22/L),t1=1-Math.min(.45,26/L);
  ctx.globalAlpha=dim?.12:hi?.95:.28;ctx.lineWidth=hi?5:3.5;ctx.strokeStyle='#0008';ctx.setLineDash([]);ctx.beginPath();for(let q=0;q<=20;q++){const[x,y]=B(t0+(t1-t0)*q/20);q?ctx.lineTo(x,y):ctx.moveTo(x,y)}ctx.stroke();
  ctx.strokeStyle=col==='#1c1c1c'?'#555':col;ctx.lineWidth=hi?3.5:2.2;ctx.setLineDash([9,7]);ctx.lineDashOffset=-now*18;ctx.stroke();ctx.setLineDash([]);
  const[ex,ey]=B(t1),[px,py]=B(t1-.03),a=Math.atan2(ey-py,ex-px);ctx.fillStyle=ctx.strokeStyle;ctx.beginPath();ctx.moveTo(ex+Math.cos(a)*7,ey+Math.sin(a)*7);ctx.lineTo(ex+Math.cos(a+2.5)*7,ey+Math.sin(a+2.5)*7);ctx.lineTo(ex+Math.cos(a-2.5)*7,ey+Math.sin(a-2.5)*7);ctx.fill();
  if(f.pin){const[mx,my]=B(.5);ctx.font='12px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('📌',mx,my)}ctx.globalAlpha=1}}
const flowFocus=()=>{const o=openInfo!=null&&openInfo!==undefined?(typeof openInfo==='number'?sites[openInfo]:openInfo):openFac!=null?sites[openFac]:null;return o&&sites.includes(o)?sites.indexOf(o):null};
{const o=lnDraw;lnDraw=function(){if(!S.auto)return o();try{autoDraw()}catch(e){}}}
// ---- switching an old game over ----
function autoInit(){if(S.auto)return;S.auto=1;U();const had=S.trains.length;
 for(const o of sites)if(o.linked&&!o.hidden){const k=offerOf(o),c=k&&cargoCls(k);if(c)S.up[c]=1}
 S.L=[];if(typeof LE!=='undefined')LE=null;
 for(const t of S.trains){t.ln=null;t.li=null;t.route=null;t.lots=[];t.cargo=0;t.k=null;t.mix=null;t.stop=0;t.st='idle';t.wait=1;t.lw=0}
 RK='';AUTO.k='';for(const o of sites)if(o.linked&&!o.hidden&&(isInd(o)||isFac(o))&&!fuelOk(o)&&fuelD(o)>=0){o.tower=1;RK=''}
 if(had)setTimeout(()=>notice(`<b style="color:#ffd27a;font-size:16px">🚂 Your trains now run themselves</b><br>Every building sends its goods to the <b>nearest place that needs them</b> (an open order or a factory), otherwise to the nearest buyer. Free trains pick up the best waiting load. Arrows on the map show where everything goes.<br><small style="opacity:.85">You grow the map and improve the whole fleet in the 🚂 Engine shed: bigger wagons, faster engines, longer range and wagon types. Your ${had} trains are all still yours.</small><br><button onclick="noticeClose();showShed(0)" style="margin-top:8px;padding:6px 12px;border-radius:8px;border:0;background:#2e7d6b;color:#fff;font-weight:700">Open the Engine shed</button>`),1600);
 save()}
try{autoInit()}catch(e){console.error(e)}
// first train: offer it once something has somewhere to go
let ftT=0;setInterval(()=>{try{if(!S.auto){autoInit();return}if(S.trains.length||S.ft||S.t-ftT<6)return;const f=[...shipPlan().values()].find(f=>f.to!=null&&!f.why.length);if(!f)return;ftT=S.t;S.ft=1;notice(`<b style="color:#ffd27a;font-size:16px">🚂 Time for your first train</b><br>${TYPES[f.k].g} ${GOOD[f.k]} can go to <b>${nm(sites[f.to])}</b>. Buy a train and it starts carrying by itself.<br><button onclick="noticeClose();autoBuy()" style="margin-top:8px;padding:6px 12px;border-radius:8px;border:0;background:#2e7d6b;color:#fff;font-weight:700">Buy a train · ${fmt(COST.train)}</button>`)}catch(e){}},1500);
// ---- tutorial and report ----
TUT[2]={t:'Buy your first <b>train</b>: tap <b>🚂 Trains → ＋ Buy a train</b>. It runs by itself: the camp\'s wood goes to Ashford because Ashford\'s order needs it (follow the arrow).',ok:()=>S.trains.length>0,el:'shed'};
TUT[3]={t:'Ashford also wants 🌾 wheat: build a <b>🌾 Farm</b> on glowing grass and link it. Its wheat finds its way to Ashford by itself.',ok:()=>sites.some(o=>o.type==='farm'&&o.linked),el:'build'};
TUT[7]={t:'Link the <b>Sawmill</b> to your track near a Lumber Camp: wood flows in by itself and its planks go to a town that wants them. Busy? Buy more trains or upgrade them in <b>🚂 Trains</b>. 🎓 That\'s the whole game: explore and link more towns!',ok:()=>sites.some(o=>isFac(o)&&(o.stock>0||Object.values(o.inp||{}).some(v=>v>0)))};
{const o=makeReport;makeReport=function(){let r=o();if(!S.auto)return r;const u=U();r=r.replace(/\nLINES \(0\):/,'');
 const lines=['FLEET (trains run themselves; upgrades per island): '+shIsles().map(k=>{const u=U(k);return(ISLS[k]&&ISLS[k].nm||'isl'+k)+' wag '+u.wag+' eng '+u.eng+' rng '+u.rng+' rep '+u.rep+' cargo '+(Object.keys(CARGO).filter(c=>u[c]).join(',')||'-')}).join(' | ')+' · towers '+sites.filter(o=>o.tower).length+' · busy '+S.trains.filter(t=>t.route).length+'/'+S.trains.length+' · loads waiting '+waitingLoads(),'FLOWS:'];
 for(const[pi,f]of shipPlan())lines.push(' '+TYPES[f.k].g+' '+nmS(sites[pi])+' → '+(f.to!=null?nmS(sites[f.to])+' ('+autoWhy(f)+', '+f.d+' tiles)':'nobody')+(f.why.length?' ⚠ '+f.why.join('; '):''));
 return r.replace('TRAINS (',lines.join('\n')+'\nTRAINS (')}}

// ================= v127 A LIVING START =================
// A new map opens on open land around Ashford with more of the island in view; you still build the first camp and farm.
function startPath(target){const start=id(target.x,target.y),prev=new Map([[start,-1]]),q=[start];let hit=-1;
 for(let h=0;h<q.length&&hit<0;h++){const i=q[h],x=i%N,y=(i/N)|0;for(const[dx,dy]of D4){const nx=x+dx,ny=y+dy;if(nx<1||ny<1||nx>=N-1||ny>=N-1)continue;const j=id(nx,ny);if(prev.has(j))continue;
  if(anchor(nx,ny)&&siteAt(nx,ny)!==target&&NET&&NET[j]){prev.set(j,i);hit=j;break}
  const c=trackCost(nx,ny);if(!rev[j]||!c||typeof c==='string'||siteAt(nx,ny)||stnSide(nx,ny))continue;prev.set(j,i);q.push(j)}}
 if(hit<0)return null;const p=[];let i=prev.get(hit);while(i!==start&&i!==-1){p.push([i%N,(i/N)|0]);i=prev.get(i)}return p}
function livingStart(){const A=sites[hubI()];if(!A)return;reveal(A.x,A.y,9);for(const s of sites)if(rev[id(s.x,s.y)])s.seen=1;computeNet();save()}
const TUT2=[
 {t:'🚂 Your first train is already hauling 🪵 wood from the Lumber Camp to Ashford (follow the arrow). Ashford also wants 🌾 wheat: tap <b>🏗 Build</b>, choose <b>🌾 Farm</b>, then tap a glowing spot.',ok:()=>sites.some(o=>o.type==='farm'),el:'build'},
 {t:'🛤 <b>Connect the Farm</b>: tap <b>✓ Build</b> on the track shown (or tap the Farm, then <b>🔗 Connect to rail</b>). Its wheat goes to Ashford by itself.',ok:()=>sites.some(o=>o.type==='farm'&&o.linked),el:'build'},
 {t:'📋 <b>Fill Ashford\'s order</b> (tap the 📋 over Ashford to see it). Loads waiting? A second train helps: <b>🚂 Trains → ＋ Buy a train</b>.',ok:()=>(S.stats.orders||0)>=1},
 {t:'🧭 <b>Find a new town</b>: tap <b>Scout</b> and send scouts into the fog, towards a <b>?</b> rumour. Then link the town by track for a fresh order.',ok:()=>sites.filter(o=>o.type==='town'&&o.linked&&o.pop>0).length>=2,el:'scout'},
 {t:'Fill one more order to reach <b>Railway level 2</b>: factories unlock.',ok:()=>S.beacon>=2},
 {t:'Build a <b>🏭 Sawmill</b> right next to your track: <b>🏗 Build → Factories</b>. Wood flows in by itself and its planks go to towns that want them.',ok:()=>sites.some(o=>isFac(o)&&!o.hidden),el:'build'},
 {t:'Watch the Sawmill fill up, then upgrade your trains in <b>🚂 Trains</b> when they get busy. 🎓 That\'s the whole game: explore and link more towns!',ok:()=>sites.some(o=>isFac(o)&&(o.stock>0||Object.values(o.inp||{}).some(v=>v>0)))}];
if(fresh)try{livingStart()}catch(e){console.error(e)}
if(S.tv===2){TUT.length=0;TUT.push(...TUT2)}
// ---- v127: remove a building you built by mistake (half its price back; a mine goes back to being a deposit) ----
function rmBack(o){if(o.paid)return Math.round(o.paid/2);if(isFac(o)){const ot=sites.filter(f=>f!==o&&isFac(f)&&!f.gone);return Math.round((ot.some(f=>f.type===o.type)?2500+1500*ot.length:2500)/2)}return Math.max(0,Math.round((BUILD[o.type]||0)/1.25/2))}
function removeSite(i){const o=sites[i];if(!o||!(isInd(o)||isFac(o)))return;if(!confirm2('rm'+i,'Remove the '+TYPES[o.type].n+'? You get '+fmt(rmBack(o))+' back.'))return;
 const fac=isFac(o),back=rmBack(o);
 const res=o.res0||(['coal','iron','oil'].includes(o.type)?o.type:null);
 for(const t of S.trains){const r=t.route,hit=t.src===i||t.dst===i||r&&(r.a===i||r.b===i);if(hit){t.route=null;t.cargo=0;t.k=null;t.st='idle';t.wait=1;t.lw=0;t.path=[t.path&&t.path.length?t.path[Math.min(t.path.length-1,Math.round(t.pos))]:[o.x,o.y]];t.pos=0}}
 if(res){const k=o.type;for(const key of Object.keys(o))if(!['x','y','seen','hidden','name'].includes(key))delete o[key];o.type='dep';o.res=res}
 else if(1){for(const key of Object.keys(o))delete o[key];Object.assign(o,{type:'dep',res:'stone',hidden:true,gone:1,x:-500,y:-500,name:''})}// v190: never splice sites: docks, sea routes and ships hold site numbers
 else{sites.splice(i,1);const fx=v=>v>i?v-1:v;for(const t of S.trains){if(t.src!=null)t.src=fx(t.src);if(t.dst!=null)t.dst=fx(t.dst);if(t.route){t.route.a=fx(t.route.a);t.route.b=fx(t.route.b)}}
  for(const s of sites){if(s.pin!=null){if(s.pin===i)delete s.pin;else s.pin=fx(s.pin)}if(s.tk){const n={};for(const b in s.tk)if(+b!==i)n[fx(+b)]=s.tk[b];s.tk=n}}
  if(S.L)for(const L of S.L)L.s=L.s.filter(v=>v!==i).map(fx)}
 S.money+=back;AUTO.k='';RK='';try{computeNet()}catch(e){}openFac=null;openInfo=null;document.getElementById('panel').style.display='none';toast('🗑 Removed'+(back?': +'+fmt(back):''));save()}
const rmRow=s=>{const i=sites.indexOf(s);return i<0||!(isInd(s)||isFac(s))?'':sec2('<button onclick="removeSite('+i+')" style="margin-top:2px;padding:5px 10px;border-radius:8px;border:1px solid #8a4a36;background:#3a2220;color:#ffb3a0;font-size:12px">🗑 Remove building</button> <small style="opacity:.6">'+fmt(rmBack(s))+' back (half its price)</small>')};
{const o=showInfo;showInfo=function(s){o(s);try{if(s&&isInd(s)&&!s.hidden){const el=document.getElementById('panel');if(el.style.display==='block'&&!el.innerHTML.includes('removeSite('))el.innerHTML+=rmRow(s)}}catch(e){}}}
{const o=showFactory;showFactory=function(i){o(i);try{const s=sites[i],el=document.getElementById('panel');if(s&&el.style.display==='block'&&!el.innerHTML.includes('removeSite('))el.innerHTML+=rmRow(s)}catch(e){}}}

// ---- v128: each extra industry of the same kind costs 25% more than the last ----
{const B0={...BUILD};for(const k of Object.keys(B0))Object.defineProperty(BUILD,k,{get:()=>Math.round(B0[k]*Math.pow(1.25,sites.filter(o=>o.type===k&&!o.hidden).length)/50)*50,configurable:true})}
// ---- v128b: export the save as a file (share sheet on phones, otherwise a download), and a much shorter compressed code ----
async function packSave(){const j=localStorage.getItem(SAVE_KEY)||'';try{const cs=new Blob([j]).stream().pipeThrough(new CompressionStream('gzip'));const u=new Uint8Array(await new Response(cs).arrayBuffer());let b='';for(let i=0;i<u.length;i+=8192)b+=String.fromCharCode.apply(null,u.subarray(i,i+8192));return'RAILHAVEN2:'+btoa(b)}catch(e){return'RAILHAVEN1:'+btoa(unescape(encodeURIComponent(j)))}}
async function unpackSave(v){v=v.trim().replace(/\s/g,'');if(v.startsWith('RAILHAVEN1:'))return decodeURIComponent(escape(atob(v.slice(11))));if(!v.startsWith('RAILHAVEN2:'))throw 0;const s=atob(v.slice(11)),u=new Uint8Array(s.length);for(let i=0;i<s.length;i++)u[i]=s.charCodeAt(i);return await new Response(new Blob([u]).stream().pipeThrough(new DecompressionStream('gzip'))).text()}
async function exportSave(){save();const code=await packSave(),name='railhaven-save-'+new Date().toISOString().slice(0,10)+'.txt';
 try{if(window.claude&&window.claude.use){const d=await Promise.race([window.claude.use('downloads'),new Promise(r=>setTimeout(()=>r(null),3000))]);if(d){await d.save({filename:name,data:code});toast('💾 Saved '+name);return}}}catch(e){toast('Export cancelled');return}
 try{const f=new File([code],name,{type:'text/plain'});if(navigator.canShare&&navigator.canShare({files:[f]})){await navigator.share({files:[f],title:'Railhaven save'});return}}catch(e){if(e&&e.name==='AbortError')return}
 try{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([code],{type:'text/plain'}));a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},2000);toast('💾 Saved '+name+' to your downloads')}catch(e){toast('Export did not work here: copy the code instead')}}
{const o=showMove;showMove=function(){o();const el=document.getElementById('panel');el.innerHTML=el.innerHTML.replace('<b>① Copy this game</b>','<b>① Copy or export this game</b><br>'+tbtn('📤 Export as a file','exportSave()')+'<br><small style="opacity:.75">Shares a small .txt file (or downloads it). Attach it in chat, or load it on another device.</small><br>');el.innerHTML=el.innerHTML.replace('<b>② Load a game from a code</b>','<b>② Load a game from a code or a file</b><br><input type="file" accept=".txt,text/plain" onchange="loadFile(this)" style="margin-top:4px;font-size:12px;color:#f3e6c8"><br>');packSave().then(c=>{const t=document.getElementById('mvout');if(t)t.value=c})}}
function loadFile(inp){const f=inp.files&&inp.files[0];if(!f)return;f.text().then(t=>{const ta=document.getElementById('mvin');if(ta)ta.value=t.trim();loadMove.armed=1;loadMove()})}
loadMove=async function(){const v=(document.getElementById('mvin').value||'').trim();let j;try{j=await unpackSave(v);const o=JSON.parse(j);if(!o||!o.sites||!o.track)throw 0}catch(e){toast('That is not a full Railhaven save code: copy it again in full');return}
 if(!loadMove.armed){loadMove.armed=1;toast('Tap Load again to replace the game on this screen');setTimeout(()=>loadMove.armed=0,4000);return}save.off=true;localStorage.setItem(SAVE_KEY,j);location.reload()};
// v128d: track that was built into a station's side (before v128c blocked it) is cleared once, so it can be redrawn into an end
function stnSideRepair(){let n=0;for(const o of sites){if(o.type!=='town'||o.hidden)continue;const p=stnTile(o);if(!p||(p.x===o.x&&p.y===o.y))continue;const hz=stnHz(p),ax=hz?0:1,ay=hz?1:0;
 for(const[x,y]of[[o.x+ax,o.y+ay],[o.x-ax,o.y-ay]]){const k=id(x,y);if(!track.has(k)||siteAt(x,y))continue;const deg=D4.filter(([dx,dy])=>{const a=x+dx,b=y+dy;return!(a===o.x&&b===o.y)&&(track.has(id(a,b))||siteAt(a,b))}).length;if(deg>1)continue;
  track.delete(k);if(dblSet.has(k)){dblSet.delete(k);S.dbl=S.dbl.filter(q=>q!==k)}n++}}
 if(n){try{computeNet()}catch(e){}if(typeof stnMemo!=='undefined')stnMemo={};save();setTimeout(()=>toast('🔨 Removed '+n+' track square'+(n>1?'s':'')+' that touched a station from the side: redraw it into the station\'s end'),2500)}}
// v167: stnSideRepair no longer runs on load (it deleted real end connections when a 2nd track joined a town)

// ================= v129 CALMER CARDS =================
// Every card: a title, ONE status line that says what is happening (or what is wrong and the fix), the main buttons,
// and everything else folded under "More".
const C9={ok:'#7fd36b',warn:'#ffd27a',bad:'#ffb36b'};
const banner=(c,t)=>`<div class="bn6" style="margin-top:6px;padding:4px 11px;border-radius:14px;display:inline-block;background:color-mix(in srgb,${c} 16%,transparent);color:${c};font-weight:700;font-size:12.5px">${t}</div>`;
const head9=(t,sub)=>`<b style="font-size:16px">${t}</b>${sub?'<br><small style="opacity:.8">'+sub+'</small>':''}`;
const more9=(k,b)=>b?sec2(fold(k,'<b style="opacity:.85">More</b>',b)):'';
const fuel9=o=>{const d=fuelD(o),R=rngOf(o),q=islOf(o),n=ISLS[q]&&ISLS[q].nm||'this island';return d<0?'⛽ No rail to a refuel point':d===0?'⛽ Trains refuel here':`⛽ ${d} of ${R} fuel tiles (${n} trains)`+(d>R?' · <span style="color:#ffb36b">out of range</span>':'')};
// where a good for town/factory T comes from, or why it isn't coming: [colour, html]
// v130: why a good does or doesn't come, as a short checklist: who makes it · track · fuel range · where it goes now
function srcOf(T,k){const ti=sites.indexOf(T),M=shipPlan(),ck=(ok,t)=>'<br>'+(ok===1?'✅':ok===2?'🟡':'❌')+' '+t,fr=o=>{const d=fuelD(o),R=rngOf(o);return d>=0&&d<=R?'':(d<0?'no town or water tower on its line':d+' tiles from fuel, trains go '+R)};
 const mine=[...M].filter(([pi,f])=>f.k===k&&f.to===ti&&!f.why.length);
 if(mine.length){const[pi,f]=mine[0];return[C9.ok,'🚂 Coming from '+nmS(sites[pi])+' · '+f.d+' tiles'+(mine.length>1?' (+'+(mine.length-1)+' more)':'')]}
 const P=[...M].filter(([pi,f])=>f.k===k);
 if(!P.length){const fk=Object.keys(FAC).find(x=>FAC[x].out===k),lock=fk&&FAC[fk].lvl>S.beacon;return[C9.bad,'<b>Why no '+gname(k)+' yet:</b> '+(lock?'🔒 Made by a '+TYPES[fk].n+' (Railway level '+FAC[fk].lvl+')':'Nobody makes it yet: build a '+mkr(k)+(fk?' (🏗 Build → Factories)':' and link it'))]}
 const b=bfs(id(T.x,T.y)),dd=pi=>{const d=b.dist[id(sites[pi].x,sites[pi].y)];return d<0?1e6:d};P.sort((x,y)=>dd(x[0])-dd(y[0]));const[pi,f]=P[0],A=sites[pi],d=b.dist[id(A.x,A.y)];
 let h='<b>Why no '+gname(k)+' yet:</b>';
 if(d<0)return[C9.bad,h+' '+(P.length===1?'your only ':'the nearest ')+TYPES[A.type].n+' ('+nmS(A)+') is not joined to '+nm(T)+' by track yet. Build track between them.'];

 const rA=fr(A),rT=fr(T);
 if(rA||rT){const X=rA?A:T,xi=rA?pi:ti;h+=ck(0,'⛽ Fuel range: '+nmS(X)+' is out of reach ('+(rA||rT)+') '+tbtn('⛽ Water tower there · '+fmt(TOWER),`buildTower(${xi})`,S.money<TOWER)+(rngOf(X)<UPG.rng.lv[UPG.rng.lv.length-1]?'<br><small style="opacity:.75">or buy longer range for that island: 🚂 Trains → Upgrades</small>':''));return[C9.bad,h]}

 if(!canCarry(k,islOf(A))){const c=cargoCls(k);return[C9.bad,h+ck(0,nmS(A)+'\'s trains need '+CARGO[c].n.toLowerCase()+' '+tbtn('Buy · '+fmt(CARGO[c].c),`buyFleet('${c}',${islOf(A)})`,S.money<CARGO[c].c))]}
 {const bk=PRODS.includes(k)?Object.keys(FAC).find(x=>FAC[x].out===k):k,one=P.length===1,who=(one?'Your only ':'Your nearest ')+'<b>'+TYPES[A.type].n+'</b>'+(one?'':' ('+nmS(A)+')'),
  bb=tbtn('🏗 Build '+(one?'a 2nd':'another')+' '+mkr(k),`document.querySelector('[data-m=build]').click();pickBuild('${bk}')`),g=gname(k);
 if(f.to!=null&&f.to!==ti){const D=sites[f.to],o=D.type==='town'&&ordOf(D),q=o&&o[k]?' ('+Math.floor((D.got||{})[k]||0)+'/'+o[k]+')':'',
   why=f.pin?'because you pinned it there':isFac(D)&&f.need?'because the '+TYPES[D.type].n+' needs it to work':f.need?'because '+nm(D)+'\'s order needs it too'+q:'because it is the nearest buyer';
  return[C9.warn,'<b>Why no '+g+' yet:</b> '+who+' sends all its '+GOOD[k].toLowerCase()+' to <b>'+nm(D)+'</b>, '+why+'.'+(f.need&&!f.pin?' '+nm(T)+' gets it once that is filled.':'')+'<br><small style="opacity:.8">Fix it now:</small><br>'+tbtn('📌 Send it to '+nm(T)+' instead',`pinTo(${pi},${ti})`)+' '+bb]}
 return[C9.warn,'<b>Why no '+g+' yet:</b> '+who+(f.full?' is waiting: '+f.full+' is full, so its trains have nowhere to drop the load.':' has no full load ready yet. A train will bring it soon.')+(one?'<br>'+bb:'')]}}
function townAuto(s,i){const L=tlvl(s),o=ordOf(s),g=s.got||{};let h=head9(`🏘 ${s.name}`,`${s.beacon?'Capital · ':specTag(s)}${tier(s.pop)} · ${Math.floor(s.pop).toLocaleString()} people`);
 if(!s.linked)return h+banner(C9.bad,'Not on your railway yet: link it by track to start its orders')+connectTxt(s)+'<div style="margin-top:6px">'+trackBtn(s)+'</div>';
 if(s.pop<=0)h+=banner(C9.bad,'Ruins: bring it wheat or wood to rebuild it');
 let rows='',miss=[];
 if(o){for(const k of Object.keys(o)){const got=Math.min(o[k],Math.floor(g[k]||0)),done=got>=o[k];let r=`<div style="margin-top:7px"><b>${done?'✅':'⬜'} ${TYPES[k].g} ${GOOD[k]}</b> <span style="opacity:.85">${got} / ${o[k]}</span>`;
   if(!done){const[c,t]=srcOf(s,k);if(c!==C9.ok)miss.push(TYPES[k].g);r+=`<br><small style="color:${c}">${t}</small>`}rows+=r+'</div>'}
  const f=ordFrac(s);h+=miss.length?banner(C9.warn,'🟠 Waiting on '+miss.join(' ')+': see below'):banner(C9.ok,'🟢 Everything it needs is on the way');
  h+=sec2(`📋 <b>Next: ${tier(TLIM[L])}</b> · reward <b style="color:${C9.ok}">${fmt(LREW[L])}</b><div style="height:8px;background:#3a2f22;border-radius:5px;margin:5px 0 2px"><div style="width:${Math.round(f*100)}%;height:100%;background:${C9.ok};border-radius:5px"></div></div>`+rows)}
 else h+=banner(C9.ok,'🏙 Largest size reached: it keeps buying its goods');
 let m='';const inc=[...shipPlan()].filter(([pi,f])=>f.to===i&&!f.why.length);if(inc.length)m+='<div>📥 Coming in: '+inc.map(([pi,f])=>TYPES[f.k].g+' '+nmS(sites[pi])).join(' · ')+'</div>';
 const past=usedGoods(s).filter(k=>!o||!(k in o));if(past.length)m+='<div style="margin-top:4px">🛒 Also buys '+past.map(k=>TYPES[k].g).join(' ')+' <small style="opacity:.7">(earlier orders, steady income)</small></div>';
 m+='<div style="margin-top:4px">'+fuel9(s)+'</div><div style="margin-top:4px">'+trackBtn(s)+'</div>';
 h+=more9('tm',m);if(s.beacon)h+=sec2(fold('lm','🏗 <b>Landmarks</b> <small style="opacity:.7">'+Object.keys(S.lm||{}).length+'/'+Object.keys(LM).length+' built</small>',lmHtml()));return h}
function indAuto(s,i){const L=IND.lvl(s),f=shipOf(s);let h=head9(`${TYPES[s.type].g} ${TYPES[s.type].n}${L>1?' · level '+L:''}`,`Stock ${Math.floor(s.stock)}/${IND.cap(s)} · makes ${Math.round(IND.rate(s)*share(s)*60)}/min`);
 if(!isConnected(s))return h+banner(C9.bad,'Not connected: it makes nothing until track touches it')+connectTxt(s)+more9('im',rmRow(s));
 if(!f)h+=banner(C9.warn,'Nothing to ship yet');
 else if(f.to==null&&!f.full){const fk=Object.keys(FAC).find(k=>FAC[k].in&&f.k in FAC[k].in),fn=fk&&TYPES[fk]?TYPES[fk].g+' '+TYPES[fk].n:'factory',ins=fk?Object.keys(FAC[fk].in).map(g=>TYPES[g].g).join(' + '):'';h+=banner(C9.warn,'Waits: nothing on your railway buys '+GOOD[f.k].toLowerCase()+' yet')+(fk?'<small style="opacity:.85">Build a <b>'+fn+'</b> next to your track (it turns '+ins+' into '+TYPES[FAC[fk].out].g+'). On another island, cargo ships carry it there.</small><div>'+tbtn('🏗 Build a '+fn,`document.querySelector('[data-m=build]').click();pickBuild('${fk}')`)+'</div>':'')}
 else if(f.why.length){h+=banner(C9.bad,'⚠ Its goods are stuck: '+f.why.join(', '));if(!canCarry(f.k,islOf(s))){const c=cargoCls(f.k);h+='<div>'+tbtn('🧰 Buy '+CARGO[c].n+' · '+fmt(CARGO[c].c),`buyFleet('${c}',${islOf(s)})`,S.money<CARGO[c].c)+'</div>'}if(!fuelOk(s))h+='<div>'+tbtn('⛽ Water tower here · '+fmt(TOWER),`buildTower(${i})`,S.money<TOWER)+'</div>'}
 else if(f.to==null)h+=banner(C9.warn,f.full?'Waits: '+f.full+' is full for now':'Waits: no place on your track buys '+GOOD[f.k].toLowerCase()+' yet');
 else{const n=S.trains.filter(t=>t.route&&t.route.a===i).length;h+=banner(C9.ok,`🚂 Ships ${TYPES[f.k].g} → ${nmS(sites[f.to])}`)+`<small style="opacity:.8">${autoWhy(f)} · ${f.d} tiles · ${n?'🚂 '+n+' on it now':'next free train takes it'}</small>`}
 h+='<div style="margin-top:6px">'+(L<IND.maxL?tbtn('⬆ Expand · '+fmt(PRICE.ind(s).m)+' → '+Math.round(IND.rate({type:s.type,lvl:L+1})*60)+'/min',`upInd(${i})`,S.money<PRICE.ind(s).m):'')+'</div>';
 let m='';if(f&&f.alt.length>1||f&&f.pin)m+='<div><small style="opacity:.75">Send it somewhere else:</small><br>'+f.alt.filter(c=>c.ti!==f.to).slice(0,3).map(c=>ubtn('📌 '+nmS(c.T)+' · '+c.d+' tiles'+(c.w>0?' · needs it':''),`pinTo(${i},${c.ti})`)).join('')+(f.pin?ubtn('↺ Back to automatic',`pinTo(${i},-1)`):'')+'</div>';
 if(s.type==='farm')m+='<div style="margin-top:4px">🌾 Fields: '+fieldsOf(s).length+'/8</div>';if(s.type==='wood')m+='<div style="margin-top:4px">🌲 Forest in reach: '+forestNear(s).length+' tiles'+(forestNear(s).length<6?' <span style="color:#ffb36b">(thinning: trees grow back)</span>':'')+'</div>';
 m+='<div style="margin-top:4px">'+fuel9(s)+(!s.tower&&fuelOk(s)?' '+ubtn('⛽ Water tower · '+fmt(TOWER),`buildTower(${i})`,S.money<TOWER):'')+'</div><div style="margin-top:4px">'+trackBtn(s)+'</div>'+rmRow(s);
 return h+more9('im',m)}
function facAuto(i){const s=sites[i],F=FAC[s.type],B=FACT.buf(s.lvl||1),R=FACT.rate(s.lvl||1)*60,out=F.out,f=shipOf(s);s.inp=s.inp||{};
 let h=head9(`🏭 ${TYPES[s.type].n} · level ${s.lvl||1}`,`Turns ${Object.entries(F.in).map(([k,q])=>q+' '+gname(k)).join(' + ')} into ${gname(out).toLowerCase()} · up to ${Math.round(R)}/min`);
 if(!s.linked&&!isConnected(s))return h+banner(C9.bad,'Not on your track yet: link it first')+connectTxt(s)+more9('fm',rmRow(s));
 const ins=Object.keys(F.in).map(k=>{const[c,t]=srcOf(s,k);return{k,c,t,have:Math.floor(s.inp[k]||0)}}),bad=ins.filter(o=>o.c!==C9.ok);
 /* v270 (Sébastien: storage and what is missing unclear): ONE status line, picked in order: output has nowhere to go → inputs really short → running */
 const OC=80,oFull=(s.stock||0)>=OC*.9&&(!f||f.to==null),short=bad.filter(o=>o.have<B*.5),bar=(n,cap,col)=>'<span style="display:inline-block;vertical-align:middle;width:90px;height:9px;border-radius:5px;background:#000a;margin:0 6px;overflow:hidden"><span style="display:block;height:100%;width:'+Math.min(100,Math.round(100*n/Math.max(1,cap)))+'%;background:'+col+'"></span></span>';
 if(oFull){const d=f&&f.why.length?{t:f.why.join(', '),why:'',btn:''}:outDiag(s,out),n=sellNow(s);h+='<i id="fullbox"></i>'+banner(C9.bad,'🛑 Stopped: its '+GOOD[out].toLowerCase()+' store is full')+'<div style="margin:4px 0 2px;font-weight:800;color:#ffb36b">'+d.t+'</div>'+(d.why?'<small style="opacity:.92">'+d.why+'</small>':'')+'<div>'+d.btn+tbtn('💰 Sell '+n+' '+TYPES[out].g+' · '+fmt(sellPay(s,n)),`sellStock(${i})`,n<5)+'</div>'}
 else h+=short.length?banner(short.some(o=>o.have<1)?C9.bad:C9.warn,'⚠ Short of '+short.map(o=>TYPES[o.k].g+' '+GOOD[o.k].toLowerCase()).join(' and ')):s.busy?banner(C9.ok,'⚙ Running well'):banner(C9.warn,'⏳ Waiting for its first deliveries');
 h+=sec2('<b>📥 In</b> <small style="opacity:.75">storage</small>'+ins.map(o=>`<div style="margin-top:5px">${TYPES[o.k].g} <b>${GOOD[o.k]}</b>${bar(o.have,B,o.have>=B*.9?'#e9a646':'#7fd36b')}<b>${o.have}/${B}</b>`+(o.have>=B*.9?' <small style="color:#e9a646">full'+(oFull?' (waits for the output to move)':'')+'</small>':'')+(o.have<B*.5?`<br><small style="color:${o.c}">${o.t}</small>`:'')+'</div>').join(''));
 h+=sec2(`<b>📤 Out</b> <small style="opacity:.75">storage</small><br>${TYPES[out].g} <b>${GOOD[out]}</b>${bar(Math.floor(s.stock||0),OC,oFull?'#e05a3a':'#ffd27a')}<b>${Math.min(Math.floor(s.stock||0),OC)}/${OC}</b><br>`+(!f?'':f.why.length?`<small style="color:${C9.bad}">⚠ ${f.why.join(', ')}</small>`:f.to!=null?`<small style="color:${C9.ok}">🚂 ships to ${nmS(sites[f.to])} · ${autoWhy(f)} · ${f.d} tiles</small>`:(oFull?'':`<small style="color:${C9.warn}">${outDiag(s,out).t}</small>`)));
 h+='<div style="margin-top:6px">'+(s.lvl<FACT.maxL?tbtn('⬆ Upgrade · '+fmt(PRICE.facUp(s.lvl).m)+' · faster, bigger stores',`upFac(${i})`,S.money<PRICE.facUp(s.lvl).m):'')+'</div>';
 let m='';if(f&&(f.alt.length>1||f.pin))m+='<div><small style="opacity:.75">Send its '+GOOD[out].toLowerCase()+' somewhere else:</small><br>'+f.alt.filter(c=>c.ti!==f.to).slice(0,3).map(c=>ubtn('📌 '+nmS(c.T)+' · '+c.d+' tiles'+(c.w>0?' · needs it':''),`pinTo(${i},${c.ti})`)).join('')+(f.pin?ubtn('↺ Back to automatic',`pinTo(${i},-1)`):'')+'</div>';
 m+='<div style="margin-top:4px">'+fuel9(s)+'</div><div style="margin-top:4px">'+trackBtn(s)+'</div>'+rmRow(s);return h+more9('fm',m)}
{const o=townHtml;townHtml=function(s,i){return S.auto?townAuto(s,i):o(s,i)}}
{const o=_showInfo;_showInfo=function(s){if(!S.auto||!s||!isInd(s)||s.hidden)return o(s);openShed=null;openFac=null;openInfo=null;const el=document.getElementById('panel');el.style.display='block';PANEL={n:'showInfo',a:[s]};el.innerHTML=indAuto(s,sites.indexOf(s))}}
{const o=showFactory;showFactory=function(i){if(!S.auto)return o(i);openShed=null;openInfo=null;openFac=i;const el=document.getElementById('panel');el.style.display='block';el.innerHTML=facAuto(i)}}
// Engine shed in three tabs: Fleet (how many trains, is it enough), Upgrades (per island), Goods (where everything goes)
function shedTabs(){const T=[['fleet','🚂 Fleet'],['up','⬆ Train upgrades']].concat(typeof shipsTabOn==='function'&&shipsTabOn()?[['ships','🚢 Ships & upgrades']]:[]).concat([['goods','📦 Deliveries']]);return'<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px">'+T.map(([k,l])=>`<button onclick="S.shTab='${k}';showShed(0)" style="flex:1 1 40%;padding:7px 4px;border-radius:9px;border:${S.shTab===k?'2px solid #ffd27a':'1px solid #6b5a3e'};background:${S.shTab===k?'#4a3b22':'#2a221a'};color:#f3e6c8;font-size:13px;font-weight:700">${l}</button>`).join('')+'</div>'}
shedAuto=function(){openFac=null;openInfo=null;openShed=0;sel=null;spot=null;flowSel=null;PANEL={n:'showShed',a:[0]};const el=document.getElementById('panel');el.style.display='block';if(!S.shTab)S.shTab='fleet';
 const n=S.trains.length,busy=S.trains.filter(t=>t.route).length,idle=idleTrains().length,wl=waitingLoads(),M=shipPlan(),isn=k=>ISLS[k]&&ISLS[k].nm||'Island';
 let h=head9('🚂 Engine shed',`${n} train${n===1?'':'s'} · ${n?Math.round(busy/n*100):0}% busy · upkeep ${fmt(Math.round(trainsCost()*60))}/min`)+shedTabs();
 if(S.shTab==='fleet'){
  h+=wl>idle?banner(C9.warn,`📦 ${wl} load${wl>1?'s are':' is'} waiting: buy another train`):idle>1&&n>2?banner(C9.warn,`💤 ${idle} trains have nothing to carry: you could sell some`):n?banner(C9.ok,'✅ About the right number of trains'):banner(C9.warn,'No trains yet: buy one and it starts carrying at once');
  h+='<div style="margin-top:6px">'+(islBuyRows()||tbtn('＋ Buy a train · '+fmt(COST.train),'autoBuy()',S.money<COST.train))+(idle?tbtn('Sell a free one · +'+fmt(COST.train/2),'autoSell()'):'')+(idle>3?tbtn('Sell '+(idle-2)+' (keep 2) · +'+fmt((idle-2)*COST.train/2),'autoSell('+(idle-2)+')'):'')+'</div>';
  h+='<small style="opacity:.75;display:block;margin-top:6px">Trains run themselves: each building sends its goods to the nearest place that needs them, and a free train takes the best waiting load.</small>';
  h+=sec2(fold('alltr','<b>Every train ('+n+')</b>',S.trains.map((t,j)=>`<div onclick="showTrain(${j})" style="margin-top:4px;padding:4px 8px;border-radius:8px;background:#2a221a;border-left:5px solid ${lineCol(j)};cursor:pointer"><b>Train ${tNo(t)}</b> <small>${jobTxt(t)}</small><br><small style="opacity:.75">${trainStatus(t)}</small></div>`).join('')))}
 else if(S.shTab==='up'){const IS=shIsles();if(!IS.includes(S.shI))S.shI=IS[0];
  if(IS.length>1)h+='<div style="margin-top:8px;display:flex;align-items:center;gap:6px"><span>🏝 Island</span><select onchange="S.shI=+this.value;showShed(0)" style="flex:1;padding:7px;border-radius:9px;border:1px solid #6b5a3e;background:#2a221a;color:#f3e6c8;font:inherit;font-weight:700">'+IS.map(k=>`<option value="${k}" ${k===S.shI?'selected':''}>${isn(k)} · 🚂 ${S.trains.filter(t=>tIsl(t)===k).length}</option>`).join('')+'</select></div>';
  else h+='<div style="margin-top:8px"><b>🏝 '+isn(S.shI)+'</b></div>';
  h+='<small style="opacity:.75;display:block">Every train on this island gets these.</small>';
  const u=U(S.shI),cell=k=>{const g=UPG[k],l=u[k]||0,c=g.c[l];return`<div style="flex:1 1 40%;box-sizing:border-box;margin:3px;padding:7px 8px;border-radius:10px;background:#2a221a;border:1px solid #4a3d2c"><b style="font-size:13px">${g.n}</b>`+(c!=null?'<div style="color:#8fe07a;font-weight:800;font-size:13.5px;margin-top:2px">→ '+g.t(l+1)+'</div><small style="opacity:.65">now: '+(l===0&&k==='rep'?'no discount yet':g.t(l))+'</small>':'<br><small style="opacity:.8">'+g.t(l)+'</small>')+`<div>`+(c!=null?tbtn('⬆ '+fmt(c),`buyFleet('${k}')`,S.money<c):'<small style="color:#7fd36b">best ✓</small>')+'</div></div>'};
  h+='<div style="display:flex;flex-wrap:wrap;margin:4px -3px 0">'+['wag','eng','rng','rep'].map(cell).join('')+'</div>';
  h+='<div style="margin-top:6px"><b>🧰 Wagon types</b> <small style="opacity:.7">only for these goods</small></div><div style="display:flex;flex-wrap:wrap;margin:0 -3px">'+Object.keys(CARGO).map(c=>{const C=CARGO[c];return`<div style="flex:1 1 26%;box-sizing:border-box;margin:3px;padding:6px;border-radius:10px;background:#2a221a;border:1px solid ${u[c]?'#4f7a3f':'#4a3d2c'};text-align:center"><span style="font-size:16px">${C.g}</span><br><small>${C.n}</small><div>`+(u[c]?'<small style="color:#7fd36b">✓ owned</small>':tbtn(fmt(C.c),`buyFleet('${c}')`,S.money<C.c))+'</div></div>'}).join('')+'</div>';
  if(typeof shipsTabOn==='function'&&shipsTabOn())h+='<div style="margin-top:6px">'+tbtn('🚢 Ship upgrades are in Ships & upgrades ›',"S.shTab='ships';showShed(0)")+'</div>'}
 else{const F=[...M].filter(([pi,f])=>sites[pi]),bad=F.filter(([pi,f])=>f.why.length||f.to==null),ok=F.filter(x=>!bad.includes(x));
  h+='<small style="opacity:.8;display:block;margin-top:6px">Where every building\'s goods go. Trains pick this by themselves; this list shows what is stuck and how to fix it.</small>';
  h+=bad.length?'<div style="margin-top:6px"><b style="color:#ffb36b">⚠ Stuck ('+bad.length+')</b></div>'+goodsList(bad):banner(C9.ok,'✅ Nothing is stuck: every building\'s goods have somewhere to go');
  h+='<details style="margin-top:8px"><summary style="cursor:pointer;font-weight:700">✅ Shipping fine ('+ok.length+')</summary>'+ok.map(([pi,f])=>{const P=sites[pi],T=sites[f.to];return`<div onclick="showInfo(sites[${pi}])" style="margin-top:3px;padding:3px 8px;border-radius:7px;background:#2a221a;font-size:12px;cursor:pointer">${TYPES[f.k].g} ${nmS(P)} → <b>${T?nmS(T):''}</b></div>`}).join('')+'</details>';
  h+='<div style="margin-top:8px">'+ubtn(S.arrows===false?'➹ Arrows on the map: off':'➹ Arrows on the map: on','S.arrows=S.arrows===false?true:false;save();showShed(0)')+'</div>'}
 el.innerHTML=h+'<i id="pgen" hidden></i>'};
// map view: fuel range. Green track is in reach of its island's trains, red is too far; ⛽ marks refuel points
VIEWS.push({k:'fuel',b:'⛽ Fuel range',d:'<b>⛽ Fuel range</b><br>Green track: your trains can reach it. Red: too far from a town or water tower for that island\'s trains.'});
{const o=drawView;drawView=function(k){if(k!=='fuel')return o(k);const D=rangeMap(),sx=x=>(x-cam.x)*cam.z+W/2,sy=y=>(y-cam.y)*cam.z+H/2,s=TS*cam.z;
 ctx.fillStyle='rgba(12,14,18,.5)';ctx.fillRect(0,0,W,H);
 for(const i of track){const x=i%N,y=(i/N)|0,X=sx(x*TS),Y=sy(y*TS);if(X<-s||Y<-s||X>W||Y>H)continue;const d=D[i],R=UPG.rng.lv[U(ISLC[i]).rng||0];ctx.fillStyle=d<0||d>R?'rgba(240,90,70,.85)':d>R*.75?'rgba(255,210,90,.85)':'rgba(110,220,100,.8)';ctx.fillRect(X+s*.12,Y+s*.12,s*.76,s*.76)}
 ctx.font=Math.max(12,s*.5)+'px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';for(const o2 of sites)if(o2.beacon||o2.tower||o2.type==='town'&&o2.linked&&o2.pop>0){const X=sx((o2.x+.5)*TS),Y=sy((o2.y+.5)*TS);if(X<-40||Y<-40||X>W+40||Y>H+40)continue;ctx.fillText('⛽',X,Y-s*.6)}}}
// ================= v130: fishing docks and 📍 Find on every building card =================
// A dock can buy 🎣 fishing boats. Its catch (🐟 fish, or 🦞 shellfish from level 3) ships like any other good:
// coastal towns buy it, and towns on an island with a fishing dock add seafood to their next orders.
var FISH={c:[{m:3000},{m:6000},{m:12000}],r:[0,.6,1.1,1.1],sr:.5,n:['','🎣 Fishing boats','🎣 Bigger fleet','🦞 Shellfish traps']};
const fishK=o=>o.fish>=3&&o.catch==='shell'?'shell':'fish';
const fishDocks=()=>sites.filter(o=>o.type==='port'&&o.fish>0);
// towns within 3 squares of the sea count as coastal (cached: terrain never changes)
const coastTown=t=>{if(t._co===undefined){t._co=0;for(let j=-3;j<=3&&!t._co;j++)for(let i=-3;i<=3;i++){const x=t.x+i,y=t.y+j;if(x>=0&&y>=0&&x<N&&y<N&&ocean[id(x,y)]){t._co=1;break}}}return!!t._co};
const fishBuys=t=>{if(!t||t.type!=='town'||isHub(t)||!(t.pop>0)||!coastTown(t))return[];const D=fishDocks();if(!D.length)return[];const r=['fish'];if(tlvl(t)>=2&&D.some(o=>o.fish>=3))r.push('shell');return r};
// orders: decided once when a town reaches a level, so a level never gains a requirement halfway through
const FORD=[null,{fish:20},{fish:40},{fish:60,shell:25},{fish:80,shell:50}];
function fishOrd(t,o){if(!FISHREADY||!o||!t||t.type!=='town'||isHub(t)||typeof ocean==='undefined')return o;const L=tlvl(t);
 if(t.foL!==L){t.foL=L;const isl=islOf(t),D=fishDocks().filter(d=>islOf(d)===isl);t.fo=L>=1&&coastTown(t)&&D.length?(D.some(d=>d.fish>=3)?2:1):0}
 if(!t.fo||!FORD[L])return o;if(t._fqL===L&&t._fqK===t.fo&&t._fq)return t._fq;const q={...o};for(const k in FORD[L])if(k==='fish'||t.fo>1)q[k]=FORD[L][k];t._fqL=L;t._fqK=t.fo;Object.defineProperty(t,'_fq',{value:q,writable:true,configurable:true,enumerable:false});return q}
{const o=needs;needs=function(t){const r=o(t);const f=fishBuys(t);return f.length?[...new Set(r.concat(f))]:r}}
{const o=ordTick;ordTick=function(s,dt){o(s,dt);const f=fishBuys(s);if(!f.length)return;const od=ordOf(s)||{},T=STEADY_T(s);s.cdem=s.cdem||{};for(const k of f){s.cdem[k]=Math.min(T,(s.cdem[k]||0)+dt*T/60);s.dem[k]=(od[k]?Math.max(0,od[k]-((s.got||{})[k]||0)):0)+s.cdem[k];s.sup[k]=1}}}
// a fishing dock behaves like an industry: it fills its stock and trains take it away
{const r0=IND.rate,c0=IND.cap;IND.rate=s=>s.type==='port'?(fishK(s)==='shell'?FISH.sr:FISH.r[s.fish||0]):r0(s);IND.cap=s=>s.type==='port'?40+40*(s.fish||0):c0(s)}
{const o=offerOf;offerOf=A=>A&&A.type==='port'&&!A.hidden?(A.fish>0?fishK(A):null):o(A)}
{const o=regrowTick;regrowTick=function(dt){o(dt);for(const s of fishDocks())if(s.linked){const fk=fishK(s);if(s.im&&s.cur&&s.cur!==fk)s.im[fk]=Math.min(IND.cap(s),(s.im[fk]||0)+dt*IND.rate(s));else s.stock=Math.min(IND.cap(s),(s.stock||0)+dt*IND.rate(s))}}}
function buyFish(i){const s=sites[i];if(!s||s.type!=='port')return;const L=s.fish||0;if(L>=3)return;const c=FISH.c[L];if(!pay(c)){toast(lackTxt(c));return}s.fish=L+1;if(s.fish===3)s.catch='shell';AUTO.k=null;
 toast(s.fish===1?'🎣 '+s.name+' has fishing boats: 🐟 fish for coastal towns':s.fish===2?'🎣 Bigger fleet: more fish':'🦞 Shellfish traps: towns of level Town and up pay well for them');save();showPort(s)}
function fishCatch(i,k){const s=sites[i];if(!s||s.fish<3||fishK(s)===k)return;if(typeof portSync==='function'){portSync(s);s.catch=k;portSync(s,1)}else{const st=s.stock||0;s.stock=s.st2||0;s.st2=st;s.catch=k}AUTO.k=null;save();showPort(s)}
{const o=showPort;showPort=function(s){o(s);const el=document.getElementById('panel'),i=sites.indexOf(s);if(!el.insertAdjacentHTML||i<0)return;const L=s.fish||0,k=L?fishK(s):null;let h='';
 if(L){const f=shipOf(s),rate=Math.round(IND.rate(s)*60),T=f&&f.to!=null?sites[f.to]:null;
  h+=banner(f&&f.why&&f.why.length?C9.bad:T?C9.ok:C9.warn,T?TYPES[k].g+' Ships to '+nm(T)+' <span style="font-weight:400;opacity:.8">('+autoWhy(f)+')</span>':f&&f.why&&f.why.length?'Waits: '+f.why.join(', '):'Waits: no coastal town on your railway buys '+GOOD[k].toLowerCase()+' yet');
  h+='<div style="margin-top:4px">'+TYPES[k].g+' Catch '+Math.floor((s.im&&s.cur!==k?s.im[k]:s.stock)||0)+'/'+IND.cap(s)+' · '+rate+'/min</div>';
  if(L>=3)h+='<div style="margin-top:4px">Catch: '+ubtn('🐟 Fish',`fishCatch(${i},'fish')`,k==='fish')+ubtn('🦞 Shellfish',`fishCatch(${i},'shell')`,k==='shell')+'</div>'}
 else h+='<small style="opacity:.8">Fishing boats catch 🐟 fish here. Towns near the sea buy it, and coastal towns add it to their orders.</small>';
 if(L<3)h+='<div>'+tbtn((L?'⬆ ':'')+FISH.n[L+1]+' · '+costTxt(FISH.c[L])+(L===1?' → '+Math.round(FISH.r[2]*60)+'/min':''),`buyFish(${i})`,!canPay(FISH.c[L]))+(L===2?'<br><small style="opacity:.75">🦞 Shellfish sell for more than twice as much as fish, to towns of level Town and up.</small>':'')+'</div>';
 const top=el.querySelector('#pbar');const html='<div style="margin-top:6px;border-top:1px solid #3d3326;padding-top:4px"><b>🎣 Fishing</b>'+h+'</div>';
 // the catch goes right under the dock's name, before scouting and ferries
 const br=el.querySelector('br');if(br)br.insertAdjacentHTML('afterend',html);else el.insertAdjacentHTML('beforeend',html)}}
// ---- 📍 Find: centre the building above its card and ring it for a few seconds ----
var LOC=null;
function panelSite(){if(!PANEL)return null;const a=PANEL.a&&PANEL.a[0];if(PANEL.n==='showInfo'||PANEL.n==='showPort')return a&&sites.includes(a)&&a.type!=='plot'&&a.type!=='dep'?a:null;if(PANEL.n==='showFactory')return sites[a]||null;return null}
function locateSite(s){if(!s)return;const v=viewBox();cam.z=Math.max(cam.z,1.6);cam.x=(s.x+.5)*TS-((v.left+v.right)/2-W/2)/cam.z;cam.y=(s.y+.5)*TS-((v.top+v.bot)/2-H/2)/cam.z;LOC={x:s.x,y:s.y,until:performance.now()+4000}}
{const o=draw;draw=function(){o();const sx=x=>(x-cam.x)*cam.z+W/2,sy=y=>(y-cam.y)*cam.z+H/2,s=TS*cam.z,tm=performance.now()/1000;
 // little fishing boats bobbing off each fishing dock
 for(const d of fishDocks()){const w=D4.find(([dx,dy])=>terr[id(d.x+dx,d.y+dy)]===0);if(!w)continue;const n=Math.min(3,d.fish);for(let k=0;k<n;k++){const a=tm*.25+k*2.1,r=1.3+k*.55,bx=d.x+.5+w[0]*(1.6+k*.5)+Math.cos(a)*.5*Math.abs(w[1]||.4),by=d.y+.5+w[1]*(1.6+k*.5)+Math.sin(a)*.5*Math.abs(w[0]||.4),X=sx(bx*TS),Y=sy(by*TS)+Math.sin(tm*2+k)*s*.03;if(X<-30||Y<-30||X>W+30||Y>H+30)continue;
  if(terr[id(Math.floor(bx),Math.floor(by))]!==0)continue;const z=s/32;ctx.fillStyle='rgba(0,0,0,.25)';ctx.beginPath();ctx.ellipse(X+1.5*z,Y+2*z,7*z,2.6*z,0,0,7);ctx.fill();
  ctx.fillStyle=k%2?'#b8352b':'#2f6b86';ctx.beginPath();ctx.moveTo(X-7*z,Y-1*z);ctx.lineTo(X+7*z,Y-1*z);ctx.lineTo(X+4.5*z,Y+2.5*z);ctx.lineTo(X-5*z,Y+2.5*z);ctx.fill();ctx.fillStyle='#f3e6c8';ctx.fillRect(X-2*z,Y-4*z,4*z,3*z);ctx.strokeStyle='#5b4128';ctx.lineWidth=Math.max(.6,z*.7);ctx.beginPath();ctx.moveTo(X+3*z,Y-1*z);ctx.lineTo(X+3*z,Y-9*z);ctx.lineTo(X+8*z,Y-1*z);ctx.stroke()}
  if((d.stock||0)>=10&&cam.z>=.8){ctx.font=Math.max(9,s*.32)+'px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(TYPES[fishK(d)].g,sx((d.x+.85)*TS),sy((d.y+.15)*TS))}}
 if(LOC){const left=LOC.until-performance.now();if(left<=0)LOC=null;else if(LOC.r){const X=sx((LOC.x+.5)*TS),Y=sy((LOC.y+.5)*TS);ctx.save();ctx.setLineDash([12,9]);ctx.lineDashOffset=-tm*20;ctx.strokeStyle=`rgba(255,210,122,${Math.min(.9,left/1500)})`;ctx.lineWidth=3;ctx.beginPath();ctx.arc(X,Y,LOC.r*s,0,7);ctx.stroke();ctx.fillStyle=`rgba(255,210,122,${Math.min(.08,left/15000)})`;ctx.fill();ctx.restore()}else{const X=sx((LOC.x+.5)*TS),Y=sy((LOC.y+.5)*TS),p=(tm*1.5)%1;ctx.strokeStyle=`rgba(255,210,122,${Math.min(1,left/800)})`;ctx.lineWidth=3;ctx.beginPath();ctx.arc(X,Y,s*(.8+p*.9),0,7);ctx.stroke();ctx.lineWidth=2;ctx.beginPath();ctx.arc(X,Y,s*.75,0,7);ctx.stroke()}}}}
// ---- double track is optional: show where it helps, and explain the ⏳ marks ----
// a busy stretch: the queued square plus plain single track either side (up to 3 squares each way)
function jamStretch(i){const out=[i],seen=new Set([i]);for(const[dx,dy]of D4){let x=i%N+dx,y=((i/N)|0)+dy;for(let k=0;k<3;k++){const j=id(x,y);if(!track.has(j)||dblSet.has(j)||seen.has(j)||siteAt(x,y)||railDeg(x,y)>2)break;seen.add(j);out.push(j);const nx=rNb(x,y).find(([a,b])=>!seen.has(id(x+a,y+b)));if(!nx)break;x+=nx[0];y+=nx[1]}}return out}
function showJam(i){openShed=null;openFac=null;openInfo=null;sel=null;spot=null;PANEL={n:'showJam',a:[i]};const el=document.getElementById('panel');el.style.display='block';const T=jamStretch(i),c=T.length*DBL;
 el.innerHTML=head9('⏳ Trains queue here','Single track: one train at a time, so others wait their turn')+banner(C9.warn,'Optional: nothing breaks if you leave it')
  +'<div style="margin-top:6px">Double track gives trains two lanes, so they pass each other instead of waiting. Worth it on the busiest stretches.</div>'
  +'<div>'+tbtn('🛤🛤 Double '+(T.length>1?'these '+T.length+' squares':'this square')+' · '+fmt(c),`jamDbl(${i})`,S.money<c)+'</div><small style="opacity:.7">Or anywhere: 🏗 Build → 🛤🛤 Double track, then drag over your track.</small>'}
function jamDbl(i){const T=jamStretch(i),c=T.length*DBL;if(S.money<c){toast('Doubling costs '+fmt(c));return}S.money-=c;for(const k of T){dblSet.add(k);S.dbl.push(k);delete JAM[k]}toast('🛤🛤 '+T.length+' squares doubled: trains pass each other there now');save();closePanel()}
{const o=tap;tap=function(x,y){const i=id(x,y);if((mode==='pan'||mode==='trains')&&(JAM[i]||0)>4&&track.has(i)&&!dblSet.has(i)&&!siteAt(x,y)&&!near(x,y)){showJam(i);return}return o(x,y)}}
{const o=startDbl;startDbl=function(){o();document.getElementById('hint').textContent='🛤🛤 Optional: drag over track to double it. ✚ = can be doubled · orange = trains queue there';toast('🛤🛤 Double track is optional: it lets trains pass each other. Orange squares are where they queue')}}
{const o=draw;draw=function(){o();if(mode!=='rail'||!railDbl)return;const sx=x=>(x-cam.x)*cam.z+W/2,sy=y=>(y-cam.y)*cam.z+H/2,s=TS*cam.z,a=.55+.25*Math.sin(performance.now()/300);
 for(const i of track){if(dblSet.has(i))continue;const x=i%N,y=(i/N)|0,X=sx(x*TS),Y=sy(y*TS);if(X<-s||Y<-s||X>W||Y>H)continue;const jam=(JAM[i]||0)>3;
  ctx.strokeStyle=jam?`rgba(255,150,60,${a+.2})`:`rgba(150,225,255,${a*.7})`;ctx.lineWidth=jam?2.5:1.5;ctx.setLineDash(jam?[]:[4,4]);ctx.strokeRect(X+s*.1,Y+s*.1,s*.8,s*.8);ctx.setLineDash([]);
  if(!jam&&s>=26){ctx.fillStyle=`rgba(190,240,255,${a})`;ctx.font=Math.round(s*.3)+'px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('✚',X+s*.82,Y+s*.18)}
  else if(jam){ctx.fillStyle=`rgba(255,150,60,${a*.35})`;ctx.fillRect(X+s*.1,Y+s*.1,s*.8,s*.8)}}}}
// ---- v131: bottlenecks. A building is a bottleneck when 2+ towns wait on its good and none of them gets it right now ----
let BNK='',BN=[];
const facShort=f=>Object.keys(FAC[f.type].in).filter(k=>((f.inp||{})[k]||0)<FAC[f.type].in[k]*3);
function bottlenecks(){const k0=Math.floor(S.t/3)+'/'+sites.length;if(k0===BNK)return BN;BNK=k0;const M=shipPlan(),wait={};
 for(const T of sites){if(T.type!=='town'||!T.linked||!(T.pop>0))continue;const o=ordOf(T);if(!o)continue;const ti=sites.indexOf(T);for(const k in o){if(((T.got||{})[k]||0)>=o[k])continue;if([...M.values()].some(f=>f.k===k&&f.to===ti&&!f.why.length))continue;(wait[k]=wait[k]||[]).push(T)}}
 BN=[];for(const k in wait){if(wait[k].length<2)continue;const P=[...M].filter(([pi,f])=>f.k===k&&!f.why.length).map(([pi])=>sites[pi]).filter(A=>!(typeof wagonBlock==='function'&&wagonBlock(A))&&!(typeof idleFull==='function'&&idleFull(A)));if(!P.length)continue;const A=P.sort((a,b)=>(a.lvl||1)-(b.lvl||1))[0];BN.push({k,A,i:sites.indexOf(A),towns:wait[k],n:P.length})}
 BN.sort((a,b)=>b.towns.length-a.towns.length);return BN}
const bnFix=b=>{const A=b.A,i=b.i;if(isFac(A)&&facShort(A).length){const k=facShort(A)[0];return'<small>It is short of '+gname(k)+': build or expand a '+mkr(k)+' near it</small>'}if(isFac(A)){const L=A.lvl||1;return L<FACT.maxL?tbtn('⬆ Upgrade it · '+costTxt(PRICE.facUp(L)),`upFac(${i})`,!canPay(PRICE.facUp(L))):'<small>It is at full size: build a second '+TYPES[A.type].n+' (🏗 Build → Factories)</small>'}const L=A.lvl||1;return L<IND.maxL?tbtn('⬆ Expand it · '+costTxt(PRICE.ind(A)),`upInd(${i})`,!canPay(PRICE.ind(A))):'<small>Build a second '+TYPES[A.type].n+'</small>'};
const bnTxt=b=>'⚠ '+nmS(b.A)+' can\'t keep up: '+b.towns.length+' towns wait for its '+GOOD[b.k].toLowerCase()+' ('+b.towns.map(t=>t.name).join(', ')+')';
// town and factory cards: name the bottleneck where the good is missing
{const o=srcOf;srcOf=function(T,k){const ti=sites.indexOf(T),on=S.trains.filter(t=>t.k===k&&(t.dst===ti||t.route&&t.route.b===ti)&&(t.st==='toSrc'||t.st==='toDst'));if(on.length){const A=sites[on[0].src];return[C9.ok,'🚂 On its way'+(A?' from '+nmS(A):'')+(on.length>1?' ('+on.length+' trains)':'')]}const r=o(T,k);if(r[0]===C9.ok)return r;const b=bottlenecks().find(x=>x.k===k&&x.towns.includes(T));if(b)r[1]+='<br>'+'<span style="color:#ffb36b">'+bnTxt(b)+'</span><br>'+bnFix(b);return r}}
{const o=showFactory;showFactory=function(i){o(i);const b=bottlenecks().find(x=>x.i===i),el=document.getElementById('panel');if(!b||!el.insertAdjacentHTML)return;const br=el.querySelector('br');const h=banner(C9.bad,bnTxt(b))+'<div>'+bnFix(b)+'</div>';if(br)br.insertAdjacentHTML('afterend',h);else el.insertAdjacentHTML('afterbegin',h)}}
// the 💡 hint points at the worst bottleneck first
{const o=nextTip;nextTip=function(){if(S.auto){const b=bottlenecks()[0];if(b){tipGo=()=>{focusTile(b.A.x,b.A.y);showInfo(b.A)};if(isFac(b.A)&&facShort(b.A).length)return'⚠ '+b.towns.length+' towns wait for '+gname(b.k)+': the '+TYPES[b.A.type].n+' is short of '+gname(facShort(b.A)[0])+', bring more in';return'⚠ '+b.towns.length+' towns wait for '+gname(b.k)+': upgrade the '+(isFac(b.A)?TYPES[b.A.type].n:nmS(b.A))}}return o()}}
// ================= v132 =================
// ---- 1. pause when away: no money while the game is hidden, or after 5 minutes without a touch ----
var IDLE_S=300,lastIn=performance.now(),awayP=false;
if(typeof window!=='undefined')for(const ev of['pointerdown','keydown','wheel','touchstart'])window.addEventListener(ev,()=>{lastIn=performance.now();if(awayP){awayP=false;const o=document.getElementById('awayO');if(o)o.remove()}},true);
const awayNow=()=>!!document.hidden||performance.now()-lastIn>IDLE_S*1000;
function awayShow(){if(document.getElementById('awayO'))return;const d=document.createElement('div');d.id='awayO';d.style.cssText='position:fixed;inset:0;z-index:50;background:#0009;display:flex;align-items:center;justify-content:center;color:#ffd27a;font:700 20px system-ui;text-align:center';d.innerHTML='⏸ Paused while you were away<br><small style="font-weight:400;color:#f3e6c8">Trains and money wait for you. Tap to carry on.</small>';document.body.appendChild(d)}
{const o=tick;tick=function(dt){if(awayNow()){if(!document.hidden&&!awayP){awayP=true;awayShow();save()}return}return o(dt)}}
{const o=tickMissions;tickMissions=function(dt){if(awayNow())return;return o(dt)}}
if(document.addEventListener)document.addEventListener('visibilitychange',()=>{if(document.hidden)try{save()}catch(e){}else lastIn=performance.now()});
// ---- 2. a longer climb: Railway levels 6-10, some of which need a new island ----
const RISL={6:2,8:3,10:4};// level → islands you must have reached (home counts as one)
const islN=()=>new Set([homeK(),...sites.filter(o=>o.type==='town'&&o.linked&&o.pop>0).map(islOf)].filter(k=>k>=0)).size;
function islOk(L){return!RISL[L]||islN()>=RISL[L]}
Object.defineProperty(IND,'maxL',{get:()=>S.beacon>=7?5:S.beacon>=5?4:3,configurable:true});
Object.defineProperty(FACT,'maxL',{get:()=>S.beacon>=7?5:S.beacon>=5?4:3,configurable:true});
PRICE.facUp=l=>({m:4000*Math.pow(2,l-1)});PRICE.ind=s=>({m:3000*Math.pow(2,(s.lvl||1)-1)});
{const o=upMul;upMul=function(k,t){let v=o(k,t);if(k==='eng')v*=(S.beacon>=6?1.15:1)*(S.beacon>=9?1.15:1);if(k==='wag'&&S.beacon>=8)v*=1.2;return v}}
{const o=hudLine;hudLine=function(){const g=RLV[S.beacon],n=S.stats.orders||0;if(g&&n>=g&&!islOk(S.beacon+1))return'🛤 Railway level <b>'+S.beacon+'</b> · ⚓ next level needs a new island <span style="opacity:.6">▸ orders</span>';return o()}}
// ---- 3. town specialties: every town takes a trade from the land around it, which changes what it orders ----
const SPEC={port:{g:'🎣',n:'Fishing town',m:{farm:.7,flour:.7,wood:1.3,planks:1.3},drop:'flour',d:'Eats fish: smaller wheat and flour orders, more wood for boats'},
 mine:{g:'⛏',n:'Mining town',m:{coal:1.5,steel:1.4,stone:1.4,farm:.8},add:'coal',drop:'flour',d:'Wants coal, stone and steel; buys its bread elsewhere'},
 timber:{g:'🪵',n:'Timber town',m:{wood:1.4,planks:1.5,stone:.7,bricks:.7},add:'planks',drop:'bricks',d:'Builds in wood: more planks, fewer bricks'},
 farm:{g:'🌾',n:'Farm town',m:{farm:1.4,flour:1.5,steel:.7,planks:.8},add:'flour',drop:'steel',d:'Bakes for the region: more wheat and flour, less steel'}};
function specOf(t){if(!t||t.type!=='town'||isHub(t))return null;if(t.spec!==undefined)return t.spec;let w=0,f=0,m=0,g=0;for(let j=-3;j<=3;j++)for(let i=-3;i<=3;i++){const x=t.x+i,y=t.y+j;if(x<0||y<0||x>=N||y>=N)continue;const q=terr[id(x,y)];if(ocean[id(x,y)])w++;else if(q===2)f++;else if(q>=3)m++;else if(q===1)g++}
 t.spec=w>=6?'port':m>=6?'mine':f>=12?'timber':'farm';return t.spec}
const hasMaker=(t,k)=>{const I=islOf(t);if(k==='coal')return sites.some(o=>(o.type==='coal'||o.type==='dep'&&o.res==='coal')&&!o.hidden&&islOf(o)===I);return true};
function specOrd(t,o){if(!o||!t||t.type!=='town'||isHub(t))return o;const sp=specOf(t),R=SPEC[sp];if(!R)return o;const L=tlvl(t);if(t.sp0===undefined)t.sp0=L;if(L<=t.sp0)return o;
 if(t._spL===L&&t._sq)return t._sq;const q={};for(const k in o)q[k]=Math.max(5,Math.round(o[k]*(R.m[k]||1)/5)*5);
 if(L>=2&&R.add&&!q[R.add]&&hasMaker(t,R.add))q[R.add]=Math.round(20*L/5)*5;if(L>=2&&R.drop&&q[R.drop]&&Object.keys(q).length>3)delete q[R.drop];
 t._spL=L;Object.defineProperty(t,'_sq',{value:q,writable:true,configurable:true,enumerable:false});return q}
const specTag=t=>{const R=SPEC[specOf(t)];return R?R.g+' '+R.n+' · ':''};
// ---- 4. exploration: when the next level or chapter needs an island, say so loudly and point at the dock ----
{const o=nextTip;nextTip=function(){const g=RLV[S.beacon],n=S.stats.orders||0;if(g&&n>=g&&!islOk(S.beacon+1)){tipGo=()=>{document.querySelector('[data-m=build]').click();pickBuild('port')};return'⚓ Railway level '+(S.beacon+1)+' needs a new island: build a Dock on your coast and sail out'}
 const un=sites.filter(o=>o.type==='town'&&!o.linked&&!o.hidden&&rev[id(o.x,o.y)]&&islOf(o)===homeIsl());if(!un.length&&S.beacon>=2&&!ports().some(p=>p.linked)&&!islTowns(homeIsl()).some(o=>!o.beacon&&!o.linked)){tipGo=()=>{document.querySelector('[data-m=build]').click();pickBuild('port')};return'⛵ Every settlement on '+islName(homeIsl())+' is linked: build a ⚓ Dock to reach new islands'}
 if(!un.length&&!(S.maps||[]).length&&S.t>300){const T=sites.filter(o=>o.type==='town'&&o.linked).sort((a,b)=>Math.hypot(b.x-C,b.y-C)-Math.hypot(a.x-C,a.y-C))[0];if(T){tipGo=()=>{focusTile(T.x,T.y);showInfo(T)};return'🗺 The fog hides towns and finds: buy a map at '+T.name+' to see where they are'}}return o()}}
{const o=tickMissions;tickMissions=function(dt){o(dt);if(awayNow())return;const g=RLV[S.beacon];if(g&&(S.stats.orders||0)>=g&&!islOk(S.beacon+1)&&!S.islNag){S.islNag=S.beacon;notice('<div style="text-align:center"><b style="color:#ffd27a;font-size:18px">⛵ Time to sail</b><br>Railway level '+(S.beacon+1)+' needs a new island.<br><small>Build a ⚓ Dock on your coast (🏗 Build → ⚓ Dock), then land on the island across the water.</small></div>')}if(S.islNag&&S.islNag!==S.beacon&&islOk(S.beacon+1))S.islNag=0}}
// ---- 5. full buildings: say nobody needs more, and let the player sell the surplus (their choice) ----
const sellNow=o=>Math.floor((o.stock||0)*.75),sellPay=(o,n)=>Math.round(n*(TYPES[offerOf(o)].rate||5)*.6);
function sellStock(i){const o=sites[i];if(!o)return;const n=sellNow(o);if(n<5)return;const v=sellPay(o,n);o.stock-=n;S.money+=v;S.earned=(S.earned||0)+v;led('deliveries',v);floaty.push({x:o.x,y:o.y,txt:'+'+fmt(v),a:1});toast('💰 Sold '+n+' '+GOOD[offerOf(o)].toLowerCase()+' for '+fmt(v));save();showInfo(o)}
const idleFull=o=>{if(!o||!o.linked||!offerOf(o))return false;const cap=isFac(o)?FACT.buf(o.lvl||1):IND.cap(o);if((o.stock||0)<cap*.9)return false;const f=shipOf(o);return!f||f.to==null||!f.need};
function fullBox(o){const i=sites.indexOf(o),k=offerOf(o),n=sellNow(o),f=shipOf(o);{const wb=typeof wagonBlock==='function'&&wagonBlock(o);if(wb){const q=islOf(o),cc=Object.keys(CARGO).find(x=>CARGO[x]===wb);return'<i id="fullbox"></i>'+banner(C9.bad,'❗ Your trains on '+islName(q)+' have no '+wb.n.toLowerCase()+', so nothing can carry '+GOOD[k].toLowerCase()+' away')+'<small style="opacity:.85">It is full. Buy '+wb.n.toLowerCase()+' and your trains can carry it.</small><div>'+tbtn('🧰 Buy '+wb.n+' · '+fmt(wb.c),`buyFleet('${cc}',${q})`,S.money<wb.c)+'</div>'}}return'<i id="fullbox"></i>'+banner(C9.warn,'📦 Full: nobody needs more '+GOOD[k].toLowerCase()+' right now')+'<small style="opacity:.8">It stops making more until some goes. '+(f&&f.to!=null?'Its train still sells to '+nm(sites[f.to])+' at the low "steady" price. ':'')+'Link a town that orders it, build a factory that uses it, or sell some now.</small><div>'+tbtn('💰 Sell '+n+' '+TYPES[k].g+' · '+fmt(sellPay(o,n)),`sellStock(${i})`,n<5)+'</div>'}
if(typeof window!=='undefined')for(const nm2 of['showInfo','showFactory']){const o=window[nm2];window[nm2]=function(a){const r=o.apply(this,arguments);try{const s=typeof a==='number'?sites[a]:a;const el=document.getElementById('panel');if(s&&(isInd(s)||isFac(s))&&idleFull(s)&&el.insertAdjacentHTML&&!el.querySelector('#fullbox')){const br=el.querySelector('br');const h=fullBox(s);if(br)br.insertAdjacentHTML('afterend',h);else el.insertAdjacentHTML('beforeend',h)}}catch(e){}return r}}
// ---- fog rumours (?) are hidden until you buy a map of the area ----
var MAPR=45;const mapR=o=>o&&o.type==='port'?70:MAPR;const mapCost=()=>Math.round(1000*Math.pow(1.5,(S.maps||[]).length)/100)*100;
const mapped=(x,y)=>(S.maps||[]).some(m=>Math.hypot(m.x-x,m.y-y)<=m.r);
{const o=hintTick;hintTick=function(){o();HINTS=HINTS.filter(h=>mapped(h.x,h.y))}}
function buyMap(i){const o=sites[i];if(!o)return;const c=mapCost();if(S.money<c){toast('A map costs '+fmt(c));return}S.money-=c;(S.maps=S.maps||[]).push({x:o.x,y:o.y,r:mapR(o)});hintTick();const n=HINTS.filter(h=>Math.hypot(h.x-o.x,h.y-o.y)<=mapR(o)).length;toast(n?'🗺 The map shows '+n+' rumour'+(n>1?'s':'')+' (?) near '+nm(o)+': scout them to see what they are':'🗺 The map shows nothing new within '+mapR(o)+' tiles of '+nm(o));save();showInfo(o)}
const mapBox=o=>{const i=sites.indexOf(o),c=mapCost(),had=(S.maps||[]).some(m=>m.x===o.x&&m.y===o.y);return sec2('<b>🗺 Map of the area</b><br><small style="opacity:.8">Marks hidden towns and finds (?) in the fog within '+mapR(o)+' tiles of here'+(o.type==='port'?' (sea charts reach further)':'')+'. Without a map the fog shows nothing.</small><div>'+(had?'<small>✅ You have this map</small>':tbtn('🗺 See its area, then buy · '+fmt(c),`buyMap(${i})`,S.money<c))+'</div>')};
if(typeof window!=='undefined'){const o=window.showInfo;window.showInfo=function(a){const r=o.apply(this,arguments);try{const el=document.getElementById('panel');if(a&&(a.type==='town'||a.type==='port')&&a.linked&&el.insertAdjacentHTML&&el.style.display==='block')el.insertAdjacentHTML('beforeend',mapBox(a))}catch(e){}return r}}
// ================= v133: REGIONS =================
// Every island you link becomes a region with a 👑 capital (Ashford at home) and a specialty good, taken from its towns' trades.
// Capitals post TRADE ORDERS for other regions' specialties. Only 🚛 long-haul trains carry goods between islands:
// slow, three times the cargo, their own upgrades. Local trains stay on their island. Trade orders are a bonus: they never block a town.
const SPGOOD={port:'fish',mine:'coal',timber:'planks',farm:'flour'};
const regTowns=k=>sites.filter(o=>o.type==='town'&&!o.hidden&&islOf(o)===k);
function capOf(k){const T=regTowns(k);if(k===homeK())return sites[hubI()];return T.find(o=>o.rcap)||null}
function regSpec(k){S.rsp=S.rsp||{};const made={};for(const P of sites){const g=offerOf(P);if(!g||!P.linked||islOf(P)!==k||g==='wood'||g==='farm'||g==='stone')continue;made[g]=(made[g]||0)+makeRate(P)*(isFac(P)?2:1)}
 const cur=S.rsp[k];if(cur&&made[cur])return cur;const home=k!==homeK()?S.rsp[homeK()]:null;
 // what the region already makes most of (products count double); before it makes anything, what its towns' trade suggests
 let best=Object.keys(made).filter(g=>g!==home).sort((a,b)=>made[b]-made[a])[0];if(!best){const c={};for(const t of regTowns(k)){const g=SPGOOD[specOf(t)||'farm'];c[g]=(c[g]||0)+1}best=Object.keys(c).filter(g=>g!==home&&g!=='fish'&&g!=='coal').sort((a,b)=>c[b]-c[a])[0]||(home==='flour'?'planks':'flour')}
 if(cur&&!made[cur]&&S.tro)for(const q of Object.values(S.tro))if(q.from===k&&q.k===cur&&!q.done&&q.got===0)q.k=best;return S.rsp[k]=best}
const regions=()=>[...new Set([homeK(),...sites.filter(o=>o.type==='town'&&o.linked&&o.pop>0).map(islOf)])].filter(k=>k>=0);
// crown the biggest linked town of each newly reached island
function crownTick(){for(const k of regions()){if(k===homeK()||capOf(k))continue;const T=regTowns(k).filter(o=>o.linked&&o.pop>0).sort((a,b)=>b.pop-a.pop)[0];if(!T)continue;T.rcap=1;regSpec(k);
 notice('<div style="text-align:center"><b style="color:#ffd27a;font-size:18px">👑 '+T.name+' is the capital of '+islName(k)+'</b><br>Its specialty: '+gname(regSpec(k))+'. Only this region has it, so other capitals will order it from here.<br><small>Capitals trade: each one orders the other regions\' specialties. 🚢 Cargo ships carry goods between islands: buy them at a dock.</small></div>')}}
// trade orders: one open order per capital, for another region's specialty
function tradeOf(C){const k=islOf(C),R=regions().filter(r=>r!==k);if(!R.length)return null;S.tro=S.tro||{};let o=S.tro[k];
 if(!o||o.done){const n=(o?o.n:0)+1,r=R[(n-1)%R.length],g=regSpec(r);o=S.tro[k]={n,from:r,k:g,need:Math.round(40*Math.pow(1.4,n-1)/10)*10,got:0,rew:2500*n}}return o}
{const o=needs;needs=function(t){const r=o(t);if(t&&(t.rcap||t===sites[hubI()])&&S.tro){const q=S.tro[islOf(t)];if(q&&!q.done&&!r.includes(q.k))return r.concat(q.k)}return r}}
{const o=deliver;deliver=function(t,here,dist){const k=t.k,load=t.cargo;o(t,here,dist);if(!(t.lh||sites[t.src]&&sites[t.src].type==='port')||!S.tro)return;const q=S.tro[islOf(here)];if(!q||q.done||q.k!==k)return;q.got+=load-(t.cargo||0);
 if(q.got>=q.need){q.done=1;S.money+=q.rew;led('orders',q.rew);S.stats.orders=(S.stats.orders||0)+1;notice('<div style="text-align:center"><b style="color:#ffd27a;font-size:18px">🤝 Trade order filled!</b><br>'+nm(here)+' got its '+gname(k)+' from '+islName(q.from)+'.<br><b style="color:#7fd36b;font-size:16px">+'+fmt(q.rew)+'</b> · counts as a filled order</div>');tradeOf(here)}}}
// ---- long-haul trains ----
const LHU={wag:{n:'Longer rakes',d:'+25% cargo',c:l=>4000*(l+1)},eng:{n:'Heavy engines',d:'+20% speed',c:l=>5000*(l+1)}};
const lhCost=()=>Math.round(3000*Math.pow(1.25,S.trains.filter(t=>t.lh).length)/100)*100;
function buyLH(ci){const C=sites[ci];if(!C)return;const c=lhCost();if(S.money<c){toast('A long-haul train costs '+fmt(c));return}S.money-=c;S.trains.push({born:Math.round(S.t),shed:0,w:'freight',lh:1,st:'idle',wait:1,path:[[C.x,C.y]],pos:0,cargo:0,route:null,no:(S.tno=Math.max(S.tno||0,...S.trains.map(x=>x.no||0))+1)});toast('🚛 Long-haul train bought at '+C.name+': it carries trade orders between islands');save();showInfo(C)}
function upLH(k){S.lhU=S.lhU||{};const l=S.lhU[k]||0;if(l>=3)return;const c=LHU[k].c(l);if(S.money<c){toast('Costs '+fmt(c));return}S.money-=c;S.lhU[k]=l+1;toast('🚛 '+LHU[k].n+' '+(l+1)+'/3');save();refreshPanel()}
{const o=upMul;upMul=function(k,t){let v=o(k,t);if(t&&t.lh){const u=S.lhU||{};if(k==='eng')v*=.6*(1+.2*(u.eng||0));if(k==='wag')v*=3*(1+.25*(u.wag||0));if(k==='rep')v*=1.5}return v}}
// long-haul trains only take trade-order runs; local trains never cross to another island's buyer
{const o=shipPlan;shipPlan=function(){const m=o();if(m._isl===m)return m;for(const[pi,f]of m){if(f.to==null)continue;const I=islOf(sites[pi]);if(islOf(sites[f.to])===I)continue;const c=(f.alt||[]).find(c=>islOf(c.T)===I&&!isFac(c.T))||(f.alt||[]).find(c=>islOf(c.T)===I);if(c){f.to=c.ti;f.d=c.d;f.need=false}else{f.to=null;f.full=f.full||''}}m._isl=m;return m}}
{const o=autoPick;autoPick=function(t){if(!t.lh){const r=o(t);if(r&&islOf(sites[r.a])!==islOf(sites[r.b]))return null;return r}
 const here=trainTile(t),b=bfs(here),cap=trainCap(t);let best=null;for(const ck of regions()){const C=capOf(ck);if(!C||!S.tro)continue;const q=S.tro[ck];if(!q||q.done)continue;const left=q.need-q.got-S.trains.filter(x=>x!==t&&x.lh&&x.dst===sites.indexOf(C)&&(x.st==='toSrc'||x.st==='toDst')).reduce((a,x)=>a+trainCap(x),0);if(left<=0)continue;
  for(const P of sites){if(offerOf(P)!==q.k||!P.linked||islOf(P)===ck||(P.stock||0)<Math.min(cap*.3,20))continue;const d0=b.dist[id(P.x,P.y)];if(d0<0)continue;const d1=bfs(id(P.x,P.y)).dist[id(C.x,C.y)];if(d1<0)continue;const sc=Math.min(P.stock,cap)/(d0+d1+8);if(!best||sc>best.sc)best={sc,a:sites.indexOf(P),b:sites.indexOf(C)}}}
 return best}}
// capital card: region, specialty, trade order, long-haul trains
function capBox(C){const k=islOf(C),i=sites.indexOf(C),q=tradeOf(C),u=S.lhU||{},n=S.trains.filter(t=>t.lh).length;let h='<b>👑 Capital of '+islName(k)+'</b> · specialty '+gname(regSpec(k));
 if(!q)h+='<br><small style="opacity:.8">Reach and link a town on another island: its capital will trade with this one.</small>';
 else{const fr=Math.min(1,q.got/q.need),onw=S.trains.filter(t=>t.lh&&t.dst===i&&t.st==='toDst').reduce((a,t)=>a+(t.cargo||0),0);h+='<br>🤝 <b>Trade order '+q.n+'</b>: '+Math.floor(q.got)+'/'+q.need+' '+gname(q.k)+' from '+islName(q.from)+' · reward <b style="color:#7fd36b">'+fmt(q.rew)+'</b><div style="height:6px;background:#3a2f22;border-radius:3px;margin:3px 0"><div style="height:6px;width:'+Math.round(fr*100)+'%;background:#ffd27a;border-radius:3px"></div></div>'
  +(onw?'<small>🚛 '+onw+' on the way</small><br>':'')+(sites.some(P=>offerOf(P)===q.k&&P.linked&&islOf(P)===q.from)?'':'<small style="color:#ffb36b">Nobody on '+islName(q.from)+' makes '+GOOD[q.k].toLowerCase()+' yet: build a '+mkr(q.k)+' there</small><br>')}
 if(!q)return sec2(h);
 h+='<div style="margin-top:4px"><small style="opacity:.8">🚢 Trade goods cross the sea by cargo ship: link a dock on both islands and buy a ship at one of them.</small>';
 return sec2(h+'</div>')}
if(typeof window!=='undefined'){const o=window.showInfo;window.showInfo=function(a){const r=o.apply(this,arguments);try{const el=document.getElementById('panel');if(a&&a.type==='town'&&(a.rcap||a===sites[hubI()])&&a.linked&&el.insertAdjacentHTML&&el.style.display==='block'){const br=el.querySelector('br');const h=capBox(a);if(br)br.insertAdjacentHTML('afterend',h);else el.insertAdjacentHTML('beforeend',h)}}catch(e){console.error(e)}return r}}
{const o=tickMissions;tickMissions=function(dt){o(dt);if(awayNow())return;S._crT=(S._crT||0)-dt;if(S._crT<=0){S._crT=3;crownTick();for(const k of regions()){const C=capOf(k);if(C)tradeOf(C)}}}}
{const o=drawEngine;drawEngine=function(t,lc){o(t,lc);if(t&&t.lh){const c=ctx;c.fillStyle='#ffd27a';c.fillRect(-9,-6.5,14,2);c.fillRect(-9,4.5,14,2)}}}
var FISHREADY=1;
// ================= v134: ISLAND RESOURCES, IMPORTS AND THE STORY =================
// 1. Each outer island has its own resource (🧲 iron or 🛢 oil). Ashford Isle has wood, wheat, stone and coal only.
var IRES=['iron','oil'];
function depSpot(k,r){const P=[];for(let y=2;y<N-2;y++)for(let x=2;x<N-2;x++){if(ISLC[id(x,y)]!==k||!landTile(x,y)||track.has(id(x,y)))continue;let m=1e9;for(const s of sites){const d=Math.hypot(s.x-x,s.y-y);if(d<m)m=d}if(m<3)continue;P.push([x,y,m,r==='oil'?1:foot(x,y)?1:0])}
 if(!P.length)return null;P.sort((a,b)=>b[3]-a[3]||Math.min(b[2],6)-Math.min(a[2],6)||Math.random()-.5);return P[0]}
function resMigrate(){if(S.isRes)return;S.isRes=1;const H=homeK();const hasT=k=>sites.some(o=>o.type==='town'&&islOf(o)===k);
 const outer=ISLS.map((I,k)=>k).filter(k=>k!==H&&ISLS[k].nm).sort((a,b)=>(hasT(b)-hasT(a))||ISLS[a].d-ISLS[b].d);S.ires={};outer.forEach((k,j)=>{S.ires[k]=IRES[j%2]});
 const spare=[];let seenHome=0;
 for(const d of sites){if(d.type!=='dep'||(d.res!=='iron'&&d.res!=='oil'))continue;const k=islOf(d);if(k===H){spare.push(d);if(d.seen&&!d.hidden)seenHome=1}else if(S.ires[k])d.res=S.ires[k]}
 for(const k of outer.filter(hasT)){const r=S.ires[k];let n=sites.filter(o=>((o.type==='dep'&&o.res===r)||o.type===r)&&islOf(o)===k).length;for(let tries=0;n<2&&tries<4;tries++){const p=depSpot(k,r);if(!p)break;let d=spare.pop();if(!d){d={type:'dep',stock:0};sites.push(d)}Object.assign(d,{x:p[0],y:p[1],res:r,hidden:true,seen:0,rich:ISLS[k].d>75?1:0});n++}}
 // anything left over at home goes to the far islands
 const far=outer.filter(k=>!hasT(k));for(const d of spare.splice(0)){const k=far.shift();if(k===undefined)break;const p=depSpot(k,S.ires[k]);if(!p)continue;Object.assign(d,{x:p[0],y:p[1],res:S.ires[k],hidden:true,seen:0})}
 for(const d of sites)if(d.type==='dep'&&islOf(d)===H&&(d.res==='iron'||d.res==='oil')){d.res='stone';d.hidden=false}
 if(seenHome)S.resNote=1}
var RESN={iron:'🧲 Iron Mine',oil:'🛢 Oil Well'};
const resIsl=r=>{const H=sites[hubI()];let b=null,bd=1e9;for(const k in S.ires||{}){if(S.ires[k]!==r)continue;const I=ISLS[k];const d=Math.hypot(I.x-H.x,I.y-H.y)+((S.isl||[]).includes(+k)?-1000:0);if(d<bd){bd=d;b=+k}}return b};
// 2. IMPORTS: what an island can't make, 🚛 long-haul trains bring from another island, straight to the town or factory that needs it
let IMPC=null,IMPT=-1;
function impNeeds(){if(IMPC&&IMPT===Math.floor(S.t||0))return IMPC;const out=[];
 for(const T of sites){if(!T.linked||T.hidden)continue;const k=islOf(T),G=[];
  if(isFac(T)){for(const g in FAC[T.type].in){const room=FACT.buf(T.lvl||1)-((T.inp||{})[g]||0);if(room>=10)G.push([g,room])}}
  else if(T.type==='town'){const o=ordOf(T);if(o)for(const g in o){const l=o[g]-((T.got||{})[g]||0);if(l>0)G.push([g,l])}}
  if(!G.length)continue;const ti=sites.indexOf(T),onw=S.trains.filter(t=>t.lh&&t.dst===ti&&(t.st==='toSrc'||t.st==='toDst')).reduce((a,t)=>a+trainCap(t),0);
  for(const[g,l]of G){if(sites.some(P=>P.linked&&islOf(P)===k&&offerOf(P)===g))continue;out.push({T,g,left:l-onw,from:sites.filter(P=>P.linked&&!P.hidden&&islOf(P)!==k&&offerOf(P)===g)})}}
 IMPT=Math.floor(S.t||0);return IMPC=out}
{const o=autoPick;autoPick=function(t){const r=o(t);if(!t.lh)return r;const here=trainTile(t),b=bfs(here),cap=trainCap(t);let best=r||null;
 for(const q of impNeeds()){if(q.left<=0||!q.from.length)continue;const ti=id(q.T.x,q.T.y);for(const P of q.from){if((P.stock||0)<Math.min(cap*.3,20))continue;const d0=b.dist[id(P.x,P.y)];if(d0<0)continue;const d1=bfs(id(P.x,P.y)).dist[ti];if(d1<0)continue;const sc=Math.min(P.stock,cap,q.left+10)/(d0+d1+8)*1.2;if(!best||sc>(best.sc||0))best={sc,a:sites.indexOf(P),b:sites.indexOf(q.T)}}}
 return best}}
// the first time each good arrives from another island, the story says so
{const o=deliver;deliver=function(t,here,dist){const k=t.k,load=t.cargo||0;o(t,here,dist);if(!(t.lh||sites[t.src]&&sites[t.src].type==='port')||!k||!here)return;const used=load-(t.cargo||0);if(used<=0)return;const I=islOf(here);if(sites.some(P=>P.linked&&islOf(P)===I&&offerOf(P)===k))return;
 S.imp=S.imp||{};const first=!S.imp[k];S.imp[k]=(S.imp[k]||0)+used;if(first){S.money+=500;led('story',500)}if(first&&typeof document!=='undefined'){const src=sites.find(P=>P.linked&&islOf(P)!==I&&offerOf(P)===k);notice('<div style="text-align:center"><b style="color:#ffd27a;font-size:17px">🚢 The first '+GOOD[k].toLowerCase()+' from '+(src?islName(islOf(src)):'across the sea')+'</b><br>'+TYPES[k].g+' '+used+' arrived at '+nm(here)+'.<br><b style="color:#7fd36b">First-trade bonus +'+fmt(500)+'</b></div><div style="margin-top:6px;font-style:italic;opacity:.9">“'+(k==='iron'?'Listen to that: the Steel Mill is ringing again.':k==='oil'?'Smell that? Fuel. The engines will be glad of it.':'Two islands, one railway. That is how it should be.')+'” · Mira</div>')}}}
// tips and menus point at imports
{const o=nextTip;nextTip=function(){const N0=impNeeds().filter(q=>q.left>0&&q.from.length);if(false&&N0.length){const q=N0[0],C=capOf(islOf(q.T))||sites[hubI()];tipGo=()=>{locateSite(C);showInfo(C)};return'🚛 '+nm(q.T)+' needs '+gname(q.g)+' from '+islName(islOf(q.from[0]))+': buy a long-haul train at '+C.name}
 return o()}}
{const o=pickBuild;pickBuild=function(k){o(k);if((k==='iron'||k==='oil')&&!sites.some(d=>d.type==='dep'&&d.res===k&&rev[id(d.x,d.y)]&&islOf(d)!==homeK())){const I=resIsl(k);if(I!=null){const V=typeof viewIsl==='function'?viewIsl():homeK();if(V===I||sites.some(o=>o.type===k&&islOf(o)===V))toast(TYPES[k].g+' No free '+GOOD[k].toLowerCase()+' deposit left on '+islName(V)+': ⬆ expand your '+TYPES[k].n+', or 🧭 scout the fog for more');else toast(TYPES[k].g+' There is no '+GOOD[k].toLowerCase()+' on '+islName(V)+'. '+islName(I)+' has it: reach it by ⚓ dock')}}}}
if(typeof window!=='undefined'){const o=window.showInfo;window.showInfo=function(a){const r=o.apply(this,arguments);try{const el=document.getElementById('panel');if(a&&a.type==='town'&&(a.rcap||a===sites[hubI()])&&a.linked&&el.insertAdjacentHTML&&el.style.display==='block'){const k=islOf(a),Q=impNeeds().filter(q=>islOf(q.T)===k&&q.from.length);if(Q.length){const by={};for(const q of Q)(by[q.g]=by[q.g]||[]).push(q.T);el.insertAdjacentHTML('beforeend',sec2('<b>📦 Imports to '+islName(k)+'</b><br>'+Object.keys(by).map(g=>gname(g)+' for '+[...new Set(by[g].map(nm))].join(', ')+' <small style="opacity:.75">from '+islName(islOf(Q.find(q=>q.g===g).from[0]))+'</small>').join('<br>')+'<br><small style="opacity:.75">🚛 Long-haul trains bring these straight to whoever needs them.'+(S.trains.some(t=>t.lh)?'':' Buy one above.')+'</small>'))}}}catch(e){console.error(e)}return r}}
// 3. THE STORY: every chapter has a title, a few lines from Mira the old dispatcher, goals you can always see and a Go button for each
const STT={iron:[['⛏','The Iron Coast'],['🧲','Red Cliffs'],['⚒','Deep Seams']],oil:[['🛢','Black Gold'],['🔥','The Dark Seeps'],['⛽','Fire and Fuel']]};
function chStory(c){const k=c.isl;if(k===homeIsl())return{ic:'🚂',title:'The Old Line',intro:'Ashford\'s yard has been silent for eleven years. Mira, the old dispatcher, hands you the keys: “Lay track to the towns of Ashford Isle and fill what they ask for. When Ashford is a city again, the whole coast will hear about it.”',outro:'Ashford is a city again. From the clock tower you can see other islands on the horizon, and none of them has heard a train in years.'};
 const r=(S.ires||{})[k],I=islName(k),j=(S.chDone||[]).filter(x=>(S.ires||{})[x.isl]===r).length,[ic,title]=r?STT[r][Math.min(j,2)]:['🏝','New Shores'];
 const homeHas=r&&sites.some(o=>o.type===r&&islOf(o)===homeIsl()),intro=homeHas?`“Our one ${r==='iron'?'iron mine':'oil well'} at home is nearly worked out,” Mira says, tapping an old sea chart. “The real ${GOOD[r].toLowerCase()} is on ${I}. Reach it, open a ${r==='iron'?'mine':'well'} there, and long-haul trains can carry it home.”`:r==='iron'?`“Our hills have coal and stone, but not one seam of iron,” Mira says, tapping an old sea chart. “Fishermen talk of red cliffs on ${I}. Reach it, open an iron mine there, and long-haul trains can carry the iron home to our Steel Mill.”`
  :r==='oil'?`“Steam won't carry us forever,” Mira says. “A Refinery needs oil, and Ashford Isle has none. Dark seeps stain the shore of ${I}. Get there, drill a well, and let the long-haul trains bring the oil home.”`
  :`“${I} still has towns that remember the trains,” Mira says. “Go and bring them back.”`;
 const outro=r==='iron'?`Iron from ${I} rolls across the water. Mira rings the yard bell herself.`:r==='oil'?`The oil of ${I} reaches the mainland. At night the Refinery glows like a lighthouse.`:`${I} is on the line.`;
 return{ic,title,intro,outro,r}}
{const o0=chGoals;chGoals=function(){const G=o0(),c=chap(),k=c.isl,home=k===homeIsl();
 for(const g of G){if(g.t.startsWith('Reach')){g.t='Reach '+islName(k);g.how=g.v>=g.g?'':reachInfo(k).how;g.go='reach'}
  else if(g.t.startsWith('Find and link')){g.t=g.t.replace('Find and link','Link');{const I=chap().isl,un=islTowns(I).filter(o=>!o.beacon&&!o.linked),hid=un.filter(o=>o.hidden||!rev[id(o.x,o.y)]).length,vis=un.length-hid;g.t=g.t.replace(/towns? on /,w=>(w.startsWith('towns')?'settlements':'settlement')+' on ');g.how2=1;g.how=(vis?'Lay track to '+(vis===1?'the one you can see':'the '+vis+' you can see')+(home?'':' from your landing')+'. ':'')+(hid?(hid===1?'1 more is':hid+' more are')+' still hidden in the fog: 🧭 Scout to find '+(hid===1?'it':'them'):'')}g.go='link'}
  else if(g.t.startsWith('Fill')){g.how='Tap a settlement to see what it orders and where it comes from';g.go='orders'}
  else if(g.t.startsWith('Ashford grows')){g.how='Fill Ashford\'s own orders';g.go='city'}}
 const r=(S.ires||{})[k];if(!home&&r&&sites.some(o=>(o.type===r||(o.type==='dep'&&o.res===r))&&islOf(o)===k)){const has=sites.some(o=>o.type===r&&islOf(o)===k&&o.linked);G.splice(G.length-1,0,{t:'Open the '+RESN[r]+' on '+islName(k),how:r==='iron'?'Iron hides under rusty rocks: survey them, build the mine, link it':'Oil hides under dark seeps: survey them, build the well, link it',v:has?1:0,g:1,go:'mine'})}
 return G}}
function islCam(k){const I=ISLS[k];if(!I)return;cam.x=(I.x+.5)*TS;cam.y=(I.y+.5)*TS;cam.z=Math.min(cam.z,.8)}
function chGo(go){const c=chap(),k=c.isl,r=(S.ires||{})[k];closePanel&&closePanel();
 if(go==='reach'){nextTip0Reach();return}
 if(go==='link'){const T=islTowns(k).filter(o=>!o.linked&&!o.beacon&&!o.hidden&&rev[id(o.x,o.y)]);if(T.length){locateSite(T[0]);showInfo(T[0]);return}islCam(k);toast('🧭 Scout the fog on '+islName(k)+' to find its towns');return}
 if(go==='mine'){const B=sites.find(o=>o.type===r&&islOf(o)===k);if(B){locateSite(B);showInfo(B);toast('Link it to your track');return}const D=sites.filter(o=>o.type==='dep'&&o.res===r&&islOf(o)===k);const v=D.find(d=>!d.hidden&&rev[id(d.x,d.y)]);if(v){locateSite(v);showInfo(v);return}const h=D.find(d=>clueTiles(d).length);if(h){const q=clueTiles(h)[0];locateSite({x:q[0],y:q[1]});toast('Tap the glowing '+(r==='iron'?'rusty rocks':'dark seeps')+' in 🏗 Build → '+RESN[r]+' to survey them');return}islCam(k);toast('Explore '+islName(k)+': '+(r==='iron'?'rusty rocks':'dark seeps')+' show where the '+GOOD[r].toLowerCase()+' is');return}
 if(go==='orders'){const T=islTowns(k).filter(o=>o.linked&&ordOf(o));if(T.length){const s=T.sort((a,b)=>ordFrac(b)-ordFrac(a))[0];locateSite(s);showInfo(s);return}document.getElementById('jobsBtn').click();return}
 if(go==='city'){const A=sites[hubI()];locateSite(A);showInfo(A)}}
const ISCO={};function islCoast(k){if(ISCO[k])return ISCO[k];const a=[];for(let y=2;y<N-2;y++)for(let x=2;x<N-2;x++)if(ISLC[id(x,y)]===k&&coastal(x,y))a.push([x,y]);return ISCO[k]=a}
function reachInfo(k){const I=islName(k);if(S.beacon<2)return{st:'lvl',how:'⚓ Docks unlock at Railway level 2: fill '+RLV[1]+' town orders'};const P=ports().filter(o=>o.linked);if(!P.length)return{st:'dock',how:'Build a ⚓ Dock on your coast (🏗 Build → ⚓ Dock)'};
 let b=null;for(const o of P)for(const[x,y]of islCoast(k)){const d=Math.hypot(o.x-x,o.y-y)-portR(o);if(!b||d<b.d)b={d,o,x,y}}if(!b)return{st:'dock',how:'Build a ⚓ Dock facing '+I};
 if(b.d>0)return{st:'up',P:b.o,how:I+' is '+Math.round(b.d+portR(b.o))+' tiles from your dock at '+nm(b.o)+', which reaches '+portR(b.o)+'. Upgrade that dock, or build one closer'};
 const L=islCoast(k).filter(([x,y])=>rev[id(x,y)]&&P.some(o=>Math.hypot(o.x-x,o.y-y)<=portR(o)));if(!L.length){const a=Math.atan2(b.y-b.o.y,b.x-b.o.x),dir=['east','south-east','south','south-west','west','north-west','north','north-east'][((Math.round(a/(Math.PI/4))%8)+8)%8];return{st:'scout',P:b.o,x:b.x,y:b.y,how:'Sailors speak of land to the '+dir+' of '+nm(b.o)+': 🧭 scout the fog that way to find it'}}
 return{st:'land',x:L[0][0],y:L[0][1],how:'Build a ⚓ landing on its glowing coast (🏗 Build → ⚓ Dock)'}}
function nextTip0Reach(){const c=chap(),R=reachInfo(c.isl);
 if(R.st==='lvl'){toast(R.how);return}
 if(R.st==='up'){locateSite(R.P);showInfo(R.P);toast('⬆ Upgrade this dock to reach further');return}
 if(R.st==='scout'){const b=document.querySelector('[data-m=scout]');if(b&&mode!=='scout')b.click();scoutFrom=sites.indexOf(R.P);const P=R.P;const k=c.isl|0,jx=Math.round((hash(k,7,31)-.5)*20),jy=Math.round((hash(k,9,37)-.5)*20),cx=Math.max(2,Math.min(N-3,R.x+jx)),cy=Math.max(2,Math.min(N-3,R.y+jy));locateSite({x:Math.round((P.x+cx*2)/3),y:Math.round((P.y+cy*2)/3)});cam.z=.42;LOC={x:cx,y:cy,r:20,until:performance.now()+7000};toast('🧭 Somewhere in the dashed area: tap the fog there to send scouts from '+nm(P));return}
 document.querySelector('[data-m=build]').click();pickBuild('port');
 if(R.st==='land'){locateSite({x:R.x,y:R.y});return}
 let b=null,bd=1e9;const I=ISLS[c.isl];for(const i of track){const x=i%N,y=(i/N)|0;for(const[dx,dy]of D4){const X=x+dx,Y=y+dy;if(!rev[id(X,Y)]||!coastal(X,Y)||siteAt(X,Y))continue;const d=Math.hypot(X-I.x,Y-I.y);if(d<bd){bd=d;b=[X,Y]}}}if(b)locateSite({x:b[0],y:b[1]})}
const chNext=()=>{const c=chap();return c.free?null:chGoals().find(x=>x.v<x.g)||null};
function chCard(tx){const c=chap();const go='display:inline-block;padding:1px 9px;border-radius:7px;background:#ffd27a;color:#2a241b;font-weight:700';let h;
 if(c.free)h='<b>📖 Every island is yours</b>';
 else{const s=chStory(c),G=chGoals(),nx=G.find(x=>x.v<x.g);h=`<div style="display:flex;justify-content:space-between;gap:8px;align-items:baseline"><b style="font-size:13px">${s.ic} Chapter ${c.n} · ${s.title}</b><span style="color:#ffd27a;letter-spacing:1px;white-space:nowrap">${G.map(x=>x.v>=x.g?'●':'○').join('')}</span></div>`
  +(nx?`<div style="margin-top:3px;font-size:13px;color:#fff">▶ <b style="color:#fff">${nx.t}</b>${nx.g>1?' <b>'+nx.v+'/'+nx.g+'</b>':''} <span data-cg="1" style="${go}">Go ›</span></div><div style="opacity:.75;font-size:11px">${nx.how||''}</div>`:'')}
 if(tx&&!/^🏁/.test(tx))h+=`<div style="margin-top:4px;padding-top:3px;border-top:1px solid #6b5a3e88;font-size:11px">💡 ${tx}${tipGo?` <span data-go="1" style="${go};font-size:11px">Go ›</span>`:''}</div>`;
 return h+'<div style="opacity:.55;font-size:10px;margin-top:2px">tap for the story 📖</div>'}
function showStory(){openShed=null;openFac=null;openInfo=null;sel=null;spot=null;PANEL={n:'showStory',a:[]};const el=document.getElementById('panel');el.style.display='block';const c=chap();let h='';
 if(!c.free){const s=chStory(c),G=chGoals(),mins=Math.round(((S.t||0)-(c.t0||0))/60),lim=c.n===1?[25,40]:[15,30];
  h+=`<div style="text-align:center"><div style="font-size:34px;line-height:1.1">${s.ic}</div><small style="opacity:.75;letter-spacing:2px">CHAPTER ${c.n}</small><br><b style="font-size:19px;color:#ffd27a">${s.title}</b><br><small style="opacity:.8">${islName(c.isl)}</small></div>`
   +`<div style="margin-top:8px;padding:8px 10px;border-radius:9px;background:#1f1a13;border-left:3px solid #e9a646;font-style:italic">${s.intro}<div style="text-align:right;font-style:normal;opacity:.7;font-size:11px">· Mira, dispatcher</div></div>`
   +'<div style="margin-top:8px"><b>Goals</b></div>'+G.map((x,i)=>`<div style="margin-top:5px;padding:5px 8px;border-radius:8px;background:${x.v>=x.g?'#22301d':'#2a221a'};border:1px solid ${x.v>=x.g?'#4f7a3f':'#4a3d2c'}">${x.v>=x.g?'✅':'⬜'} <b>${x.t}</b>${x.g>1?' '+x.v+'/'+x.g:''}${x.v>=x.g?'':`<br><small style="opacity:.8">${x.how||''}</small><div>`+tbtn('Go ›',`chGo('${x.go}')`)+'</div>'}</div>`).join('')
   +`<div style="margin-top:8px">Reward <b style="color:#7fd36b">${fmt(2000*c.n)}</b></div>`}
 else h+='<div style="text-align:center"><div style="font-size:34px">🗺</div><b style="font-size:19px;color:#ffd27a">Every island is yours</b><br><small>Keep growing your towns as big as they go.</small></div>';
 // the islands and what they hold
 const H=homeK(),known=[H,...(S.chDone||[]).map(x=>x.isl)];if(!c.free)known.push(c.isl);const nx=nextChapIsl();if(nx!=null&&!known.includes(nx))known.push(nx);
 h+=sec2('<b>🏝 Islands</b><br>'+[...new Set(known)].map(k=>{const r=(S.ires||{})[k],st=k===H||(S.isl||[]).includes(k)?'✅ reached':k===c.isl?'▶ this chapter':'next';return`<div>${k===H?'🏠':'🏝'} <b>${islName(k)}</b> · ${k===H?'🪵 🌾 🪨 ⚫':r?TYPES[r].g+' '+GOOD[r].toLowerCase():'?'} <small style="opacity:.7">${st}</small></div>`}).join('')+'<small style="opacity:.75">Each island has its own resource. 🚛 Long-haul trains (buy at a 👑 capital) carry it to whoever needs it on another island.</small>');
 if((S.chDone||[]).length)h+=sec2('<b>📜 Journal</b>'+(S.chDone||[]).map(x=>{const s=chStory({isl:x.isl,n:x.n});return`<div style="margin-top:4px"><b>Ch.${x.n} ${s.title}</b> <small style="opacity:.7">${x.m} min</small><br><small style="opacity:.8;font-style:italic">${s.outro}</small></div>`}).join(''));
 h+=sec2(`<b>🛤 Railway level ${S.beacon}</b>`+(RLV[S.beacon]?` · ${S.stats.orders||0}/${RLV[S.beacon]} orders<br><small>Level ${S.beacon+1} unlocks ${RUNL[S.beacon]}</small>`:''));
 el.innerHTML=h}
if(typeof window!=='undefined'){window.showStory=showStory;window.chGo=chGo;const ob=document.getElementById('obj');ob.onclick=e=>{const t=e.target;if(t.dataset&&t.dataset.skip){if(!(skipAsk>performance.now())){skipAsk=performance.now()+4000;t.textContent='tap again to skip the tutorial';return}S.tutSkip=S.tut;S.tut=99;save();toast('🎓 Tutorial hidden: bring it back from the chapter card any time');tickMissions(0);return}if(t.closest&&t.closest('[data-resume]')){S.tut=S.tutSkip||0;delete S.tutSkip;S.lesMin=0;LESF=-99;save();tickMissions(0);return}if(t.closest&&t.closest('[data-cg]')){const n=chNext();if(n)chGo(n.go);return}if(t.closest&&t.closest('[data-go]')){try{tipGo&&tipGo()}catch(err){}return}if(S.tut<TUT.length)return;if(PANEL&&PANEL.n==='showStory'&&document.getElementById('panel').style.display==='block'){closePanel();return}showStory()}}
var CI_T;
// the chapter's opening page shows once, when it starts (and once for the chapter you're in when this update loads)
function chIntro(){if(typeof document==='undefined'||S.tut<TUT.length)return;const c=chap();if(c.free)return;S.chIn=S.chIn||{};if(S.chIn[c.n])return;S.chIn[c.n]=1;const s=chStory(c),G=chGoals();
 notice(`<div style="text-align:center"><div style="font-size:30px">${s.ic}</div><small style="opacity:.75;letter-spacing:2px">CHAPTER ${c.n}</small><br><b style="color:#ffd27a;font-size:19px">${s.title}</b></div><div style="margin-top:6px;font-style:italic">${s.intro}</div><div style="margin-top:6px">`+G.map(x=>'⬜ '+x.t).join('<br>')+'</div><small style="opacity:.75">Your goals stay at the top left. Tap them any time for the story.</small>'+(S.resNote?'<div style="margin-top:6px;font-size:12px;opacity:.85">🗺 New survey: Ashford Isle\'s iron and oil were thin veins. The real deposits are on the outer islands.</div>':''));S.resNote=0}
{const o=tickMissions;tickMissions=function(dt){o(dt);if(CI_T===undefined||S.t-CI_T>2){CI_T=S.t;try{chIntro()}catch(e){}}}}

resMigrate();
// ================= v135: CHAPTER 1 OPENING + MIRA'S LESSONS =================
// A new game opens on a full story page. Each tutorial step then opens as a lesson card in the middle of the screen
// (with a Show me button that does the first tap for you), and stays pinned as a large card until it's done.
const LES=[{ic:'🪵',t:'Your first industry',m:'“Every railway starts with something to carry. The forest by Ashford will do.”'},
 {ic:'🛤',t:'Lay the track',m:'“A camp nobody can reach is just a pile of logs. Join it to the line.”'},
 {ic:'🚂',t:'Your first train',m:'“Buy an engine and leave the rest to it. Trains take goods to whoever needs them.”'},
 {ic:'🌾',t:'Bread for Ashford',m:'“People can\'t eat timber. Ashford needs wheat too.”'},
 {ic:'📋',t:'Ashford\'s first order',m:'“When a town gets everything on its order, it grows. That is how we rebuild.”'},
 {ic:'🏘',t:'A second town',m:'“There are other towns out in the fog. Each one we link brings a new order.”'},
 {ic:'🏭',t:'Your first factory',m:'“Bigger towns want planks, not logs. A Sawmill turns one into the other.”'},
 {ic:'⚙',t:'Feeding the mill',m:'“Put the Sawmill near a Lumber Camp and it fills up by itself.”'}];
function lesHow(n){const H=sites[hubI()],near=k=>{let b=null,bd=1e9;for(let y=H.y-16;y<=H.y+16;y++)for(let x=H.x-16;x<=H.x+16;x++){if(x<2||y<2||x>=N-2||y>=N-2||!rev[id(x,y)])continue;let ok=false;try{ok=validFor(x,y,k)}catch(e){}if(!ok)continue;const d=Math.hypot(x-H.x,y-H.y);if(d<bd){bd=d;b={x,y}}}return b};
 const bld=k=>{document.querySelector('[data-m=build]').click();pickBuild(k);const s=near(k);if(s)locateSite(s)};
 return[()=>bld('wood'),()=>{const c=sites.find(o=>o.type==='wood'&&!o.linked)||sites.find(o=>o.type==='wood');if(c){locateSite(c);showInfo(c)}},()=>document.querySelector('[data-m=trains]').click(),()=>bld('farm'),()=>{locateSite(H);showInfo(H)},
  ()=>{const T=sites.filter(o=>o.type==='town'&&!o.linked&&!o.hidden&&rev[id(o.x,o.y)]).sort((a,b)=>Math.hypot(a.x-H.x,a.y-H.y)-Math.hypot(b.x-H.x,b.y-H.y))[0];if(T){locateSite(T);showInfo(T)}else document.querySelector('[data-m=scout]').click()},
  ()=>bld('sawmill'),()=>{const f=sites.find(o=>o.type==='sawmill')||sites.find(isFac);if(f){locateSite(f);showInfo(f)}}][n]}
function lesShow(){const n=S.tut;closeLesson();try{const f=lesHow(n);f&&f()}catch(e){console.error(e)}}
function closeLesson(){const e=document.getElementById('lesson');if(e&&e.remove)e.remove()}
function overlay(html){closeLesson();if(!document.body||!document.body.appendChild)return null;const e=document.createElement('div');e.id='lesson';e.style.cssText='position:fixed;inset:0;z-index:30;background:#0008;display:flex;align-items:center;justify-content:center;padding:16px';e.innerHTML='<div style="max-width:420px;width:100%;max-height:92%;overflow:auto;background:#2a241b;border:2px solid #e9a646;border-radius:14px;padding:16px;box-shadow:0 6px 30px #000c;font-size:14px;line-height:1.5">'+html+'</div>';document.body.appendChild(e);return e}
const BIG='display:inline-block;margin-top:10px;padding:9px 18px;border-radius:10px;border:0;background:#e9a646;color:#2a1c08;font-weight:800;font-size:15px';
function openingCard(){S.chIn=S.chIn||{};S.chIn[1]=1;S.opened=1;
 overlay(`<div style="text-align:center"><div style="font-size:44px;line-height:1.1">🚂</div><small style="opacity:.75;letter-spacing:3px">ACT 1 · RAILWAY LEVEL 1</small><br><b style="font-size:24px;color:#ffd27a">The Old Line</b></div>
 <div style="margin-top:10px;font-style:italic">Ashford's yard has been silent for eleven years. Mira, the old dispatcher, hands you the keys: “Lay track out from Ashford and bring the towns back.”</div>
 <div style="margin-top:12px;padding:10px;border-radius:10px;background:#1f1a13"><b style="color:#ffd27a">How Railhaven works</b>
 <div style="margin-top:6px">🏗 <b>Build industries</b> by forests, fields and mountains.</div><div>🛤 <b>Lay track</b>: it always grows out from Ashford.</div><div>🚂 <b>Trains run themselves</b>, taking goods to whoever needs them.</div><div>📋 <b>Fill town orders</b>: towns grow, pay you, and open up new islands.</div></div>
 <div style="margin-top:10px;opacity:.9">A short lesson shows you the first steps. After that, Mira gives you <b>missions</b> at the top left that change with your game.</div><div style="text-align:center"><button onclick="closeLesson()" style="${BIG}">Begin ›</button></div>`)}
function lesOpen(n){if(typeof document==='undefined')return;n=n??S.tut;if(n>=TUT.length||n<0)return closeLesson();S.lesSeen=n;const L=LES[n]||{ic:'🎓',t:'Next step',m:''};
 overlay(`<div style="text-align:center"><div style="font-size:40px;line-height:1.1">${L.ic}</div><small style="opacity:.75;letter-spacing:2px">LESSON ${n+1} OF ${TUT.length}</small><br><b style="font-size:20px;color:#ffd27a">${L.t}</b></div>`
  +(L.m?`<div style="margin-top:8px;font-style:italic;opacity:.92">${L.m} <span style="opacity:.7;font-style:normal;font-size:12px">· Mira</span></div>`:'')
  +`<div style="margin-top:10px;padding:10px;border-radius:10px;background:#1f1a13;font-size:15px">${TUT[n].t}</div><div style="text-align:center"><button onclick="lesShow()" style="${BIG}">Show me ›</button><br><button onclick="closeLesson()" style="margin-top:8px;background:none;border:0;color:#f3e6c8;opacity:.75;text-decoration:underline;font-size:13px">I'll do it myself</button></div>`)}
if(typeof window!=='undefined'){window.lesOpen=lesOpen;window.lesShow=lesShow;window.closeLesson=closeLesson}
// pinned lesson card: the one place lessons appear. Tap it to fold or unfold. No pop-ups while lessons run.
var LESF=-99,LESN=-1;
function lesCard(){const n=S.tut,L=LES[n]||{ic:'🎓',t:'Getting started'},ok=(S.t||0)-LESF<5;
 if(S.lesMin&&!ok)return`<div style="display:flex;gap:8px;align-items:center"><span style="font-size:18px">${L.ic}</span><b style="flex:1">Lesson ${n+1}/${TUT.length} · ${L.t}</b><span data-show="1" style="padding:2px 9px;border-radius:7px;background:#ffd27a;color:#2a241b;font-weight:800">Show me ›</span><span style="opacity:.7">▾</span></div>`;
 return`<div style="display:flex;gap:10px;align-items:flex-start"><div style="font-size:28px;line-height:1">${L.ic}</div><div style="flex:1">`+(ok?'<div style="color:#7fd36b;font-weight:800">✓ Nice! Next lesson:</div>':'')+`<small style="opacity:.75;letter-spacing:1px">LESSON ${n+1}/${TUT.length}</small> <span style="float:right;opacity:.7">▴</span><br><b style="font-size:15px">${L.t}</b>`+(L.m?`<div style="font-size:12px;font-style:italic;opacity:.8">${L.m}</div>`:'')+`<div style="font-size:13px;margin-top:3px">${TUT[n].t}</div><div style="margin-top:5px"><span data-show="1" style="display:inline-block;padding:3px 12px;border-radius:8px;background:#ffd27a;color:#2a241b;font-weight:800;font-size:13px">Show me ›</span> <span data-skip="1" style="margin-left:8px;text-decoration:underline;opacity:.6;font-size:11px">skip tutorial</span></div></div></div>`}
{const o=tickMissions;tickMissions=function(dt){o(dt);if(typeof document==='undefined')return;const ob=document.getElementById('obj');if(S.tut<TUT.length){
  if(!S.opened&&(S.t||0)<120&&S.tut===0){S.lesN=0;openingCard();return}S.opened=1;if(S.lesN===undefined)S.lesN=S.tut;if(S.lesN!==S.tut){S.lesN=S.tut;LESF=S.t||0;S.lesMin=0}
  const h=lesCard();if(ob.innerHTML!==h)ob.innerHTML=h;const ok=(S.t||0)-LESF<5;ob.style.borderLeftWidth='5px';ob.style.borderLeftColor=ok?'#7fd36b':'#e9a646';ob.style.fontSize='13px';document.getElementById('undo').style.bottom=Math.max(200,ob.offsetHeight+96)+'px'}else{ob.style.borderLeftWidth='';ob.style.borderLeftColor='';document.getElementById('undo').style.bottom='200px'}}}
if(typeof window!=='undefined'){const ob=document.getElementById('obj'),o=ob.onclick;ob.onclick=e=>{const t=e.target;if(t.closest&&t.closest('[data-show]')){lesShow();return}if(S.tut<TUT.length&&!(t.dataset&&t.dataset.skip)){S.lesMin=!S.lesMin;LESF=-99;tickMissions(0);return}return o(e)}}
// while lessons run, cards that repeat the lesson stay quiet
{const o=notice;notice=function(h){if(S.tut<TUT.length&&/is on the network|first train|first request|Trains now run|run themselves/.test(h||''))return;return o(h)}}
// ================= v137: lessons ring the exact button to tap; a sensible first-camp spot =================
if(typeof document!=='undefined'&&document.head&&document.head.appendChild){const st=document.createElement('style');st.textContent='.tutHi{outline:3px solid #ffd27a!important;outline-offset:3px;animation:tutP 1.1s ease-in-out infinite;position:relative;z-index:2}@keyframes tutP{0%,100%{box-shadow:0 0 0 0 #ffd27aaa}50%{box-shadow:0 0 0 9px #ffd27a00}}';document.head.appendChild(st)}
// what to ring in each lesson: text on a button in the open card/menu, or the ✓ confirm button
var LESBTN=[/Lumber Camp/,/Connect to rail/,/Buy a train/,/Wheat Farm|🌾 Farm/,null,/Connect to rail|Found .*town|Link/,/Sawmill/,null];
function lesRing(){if(typeof document==='undefined'||!document.querySelectorAll)return;const on=S.tut<TUT.length,re=on?LESBTN[S.tut]:null;
 document.querySelectorAll('.tutHi').forEach(b=>b.classList.remove('tutHi'));if(!on)return;
 const cf=document.getElementById('confirm'),ok=document.getElementById('cfOk');if(cf&&cf.style.display==='block'&&ok&&!ok.disabled&&[0,1,3,5,6,7].includes(S.tut)){ok.classList.add('tutHi');return}
 if(!re)return;for(const sel of['#panel button','#panel [onclick]','#confirm button']){const L=[...document.querySelectorAll(sel)].filter(b=>b.offsetParent!==null&&re.test(b.textContent||''));if(L.length){L[0].classList.add('tutHi');return}}}
if(typeof window!=='undefined')setInterval(()=>{try{lesRing()}catch(e){}},400);
// first lumber camp: plenty of forest around it, a few squares from Ashford, clear of the station and its track
{const o=lesHow;lesHow=function(n){if(n!==0)return o(n);return()=>{const H=sites[hubI()];let b=null;for(let y=H.y-12;y<=H.y+12;y++)for(let x=H.x-12;x<=H.x+12;x++){if(x<2||y<2||x>=N-2||y>=N-2||!rev[id(x,y)])continue;let ok=false;try{ok=validFor(x,y,'wood')}catch(e){}if(!ok)continue;
  let tr=0,nearT=0,mt=0;for(let j=-2;j<=2;j++)for(let i=-2;i<=2;i++){const q=terr[id(x+i,y+j)];if(q===2)tr++;if(q===4)mt++;if(track.has(id(x+i,y+j))&&Math.abs(i)<=1&&Math.abs(j)<=1)nearT=1}
  const d=Math.hypot(x-H.x,y-H.y);if(d<4)continue;
  // count mountains and water on the straight line back to Ashford: the track would have to go round them
  let blk=0;for(let k=1;k<10;k++){const px=Math.round(x+(H.x-x)*k/10),py=Math.round(y+(H.y-y)*k/10),q=terr[id(px,py)];if(q===4||q===0)blk++}
  const sc=Math.min(tr,12)*2-Math.abs(d-6)*1.5-nearT*8-blk*6-mt;if(!b||sc>b.sc)b={x,y,sc}}
  document.querySelector('[data-m=build]').click();pickBuild('wood');if(b)locateSite(b)}}}
// ================= v138: guided lessons. Show me never taps for you: a gold ring walks you through each tap, one at a time =================
var LESK={0:'wood',3:'farm',6:'sawmill'},LESRE={wood:/Lumber Camp/,farm:/Wheat Farm/,sawmill:/Sawmill/};
function lesBest(k,R){R=R||12;const H=sites[hubI()];let b=null;const camps=sites.filter(o=>o.type==='wood');
 for(let y=H.y-R;y<=H.y+R;y++)for(let x=H.x-R;x<=H.x+R;x++){if(x<2||y<2||x>=N-2||y>=N-2||!rev[id(x,y)])continue;let ok=false;try{ok=validFor(x,y,k)}catch(e){}if(!ok)continue;
  let tr=0,gr=0,nearT=0;for(let j=-2;j<=2;j++)for(let i=-2;i<=2;i++){const ii=id(x+i,y+j),q=terr[ii];if(q===2)tr++;if(q===1&&!track.has(ii)&&!siteAt(x+i,y+j))gr+=(Math.abs(i)<=1&&Math.abs(j)<=1)?2:1;if(track.has(ii)&&Math.abs(i)<=1&&Math.abs(j)<=1)nearT=1}
  const d=Math.hypot(x-H.x,y-H.y);let blk=0;for(let s=1;s<10;s++){const q=terr[id(Math.round(x+(H.x-x)*s/10),Math.round(y+(H.y-y)*s/10))];if(q===4||q===0)blk++}
  let sc;if(k==='wood'){if(d<4)continue;sc=Math.min(tr,12)*2-Math.abs(d-6)*1.5-nearT*8-blk*6}
  else if(k==='farm'){if(d<4)continue;sc=Math.min(gr,20)-Math.abs(d-6)*1.5-nearT*8-blk*6-tr}
  else if(k==='stone'||k==='coal'){sc=-Math.abs(d-6)*1.5-nearT*8-blk*6}
  else{const dc=camps.length?Math.min(...camps.map(c=>Math.hypot(c.x-x,c.y-y))):d;sc=-dc*2-(d<3?6:0)}
  if(!b||sc>b.sc)b={x,y,sc}}if(!b&&R<30)return lesBest(k,30);return b}
function lesSpot(k){const c=S._ls;if(c&&c.k===k&&c.t===S.tut){let ok=false;try{ok=validFor(c.x,c.y,k)}catch(e){}if(ok)return c}const b=lesBest(k);S._ls=b?{k,t:S.tut,x:b.x,y:b.y}:null;return S._ls}
function lesTarget(){const n=S.tut,k=LESK[n],P=document.getElementById('panel'),pOpen=P.style.display==='block',cf=document.getElementById('confirm'),ok=document.getElementById('cfOk'),tool=m=>document.querySelector('#tools [data-m='+m+']');
 const btn=re=>pOpen?[...P.querySelectorAll('button,[onclick]')].find(b=>b.offsetParent!==null&&!b.disabled&&re.test(b.textContent||'')):null;
 if(cf.style.display==='block'&&ok&&!ok.disabled)return{el:ok};
 const unl=t=>sites.find(o=>o.type===t&&!o.linked);
 const link=o=>{const b=btn(/Connect to rail|Build track|Link it|🔗/);return b?{el:b}:{map:o,tip:'Tap the '+nm(o)}};
 if(k){const u=unl(k);if(u&&(k!=='wood'||n!==0))return link(u);if(sites.some(o=>o.type===k)&&n===0)return null;
  if(mode!=='build')return{el:tool('build'),tip:'Tap 🏗 Build'};if(buildK!==k){const b=btn(LESRE[k]);return b?{el:b,tip:'Choose '+TYPES[k].n}:{el:tool('build'),tip:'Tap 🏗 Build'}}
  const s=lesSpot(k);return s?{map:s,tip:'Tap the ringed square'}:null}
 if(n===1){const u=unl('wood');return u?link(u):null}
 if(n===2){const b=btn(/Buy a train/);return b?{el:b}:{el:tool('trains'),tip:'Tap 🚂 Trains'}}
 if(n===5){const H=sites[hubI()],T=sites.filter(o=>o.type==='town'&&!o.linked&&!o.hidden&&rev[id(o.x,o.y)]).sort((a,b)=>Math.hypot(a.x-H.x,a.y-H.y)-Math.hypot(b.x-H.x,b.y-H.y))[0];if(T)return link(T);return{el:tool('scout'),tip:'Tap 🧭 Scout'}}
 if(n===7){const f=sites.find(o=>isFac(o)&&!o.linked);if(f)return link(f)}
 return null}
lesRing=function(){if(typeof document==='undefined'||!document.querySelectorAll)return;document.querySelectorAll('.tutHi').forEach(b=>b.classList.remove('tutHi'));if(S.tut>=TUT.length)return;let t=null;try{t=lesTarget()}catch(e){}if(!t)return;
 if(t.el)t.el.classList.add('tutHi');if(t.map)LOC={x:t.map.x,y:t.map.y,until:performance.now()+700}};
// Show me: frame where the lesson happens, then the rings take over. It never opens or builds anything for you
lesShow=function(){closeLesson();const n=S.tut,H=sites[hubI()],k=LESK[n];let o=null;
 if(k){const u=sites.find(q=>q.type===k&&!q.linked);o=u||lesSpot(k)}else if(n===1)o=sites.find(q=>q.type==='wood'&&!q.linked);else if(n===4)o=H;else if(n===5)o=sites.filter(q=>q.type==='town'&&!q.linked&&!q.hidden&&rev[id(q.x,q.y)]).sort((a,b)=>Math.hypot(a.x-H.x,a.y-H.y)-Math.hypot(b.x-H.x,b.y-H.y))[0];else if(n===7)o=sites.find(isFac);
 if(o){locateSite(o);LOC=null}if(n===4){showInfo(H);return}const t=lesTarget();toast('👇 '+(t&&t.tip?t.tip:'Tap where the hand points'))};
if(typeof window!=='undefined')window.lesShow=lesShow;

// ================= v139: lesson 6 split in two (link a town, then fill an order); idle trains stay visible =================
TUT.splice(5,1,{t:'🏘 <b>Link a second town</b>: tap the ringed town, then <b>🔗 Connect to rail</b>. No town in sight? Tap <b>🧭 Scout</b> and send scouts into the fog.',ok:()=>S.beacon>=2||sites.some(o=>o.type==='town'&&o.linked&&!o.beacon)},
 {t:'📋 <b>Fill one more order</b> to reach <b>Railway level 2</b> and unlock factories. Each town shows what it still needs; the ring shows what to build next.',ok:()=>S.beacon>=2});
LES.splice(5,1,{ic:'🏘',t:'A second town',m:'“There are other towns out there. Each one we link asks for something new.”'},{ic:'📋',t:'Railway level 2',m:'“Every order we fill makes the railway bigger. One more, and we can build factories.”'});
LESK={0:'wood',3:'farm',7:'sawmill'};
function lesOrder(){const T=sites.filter(o=>o.type==='town'&&o.linked&&ordOf(o)).sort((a,b)=>ordFrac(b)-ordFrac(a));for(const t of T){const o=ordOf(t);for(const k in o){if(((t.got||{})[k]||0)>=o[k])continue;if(brings(t,k).length||sites.some(P=>P.linked&&offerOf(P)===k))continue;if(TYPES[k]&&!FAC[k]&&!PRODS.includes(k)&&!lesSpot(k))continue;return{T:t,k}}}return T[0]?{T:T[0],k:null}:null}
{const o=lesTarget;lesTarget=function(){const n=S.tut;{const cf=document.getElementById('confirm'),ok=document.getElementById('cfOk');if(cf.style.display==='block'&&ok&&!ok.disabled)return{el:ok}}if(n===5&&!sites.some(q=>q.type==='town'&&!q.linked&&!q.hidden&&rev[id(q.x,q.y)])){if(S.scouts.some(q=>!q.survey))return null;const tool=document.querySelector('#tools [data-m=scout]');if(mode!=='scout')return{el:tool,tip:'Tap 🧭 Scout'};const H=sites[hubI()],T=sites.filter(q=>q.type==='town'&&!q.beacon&&!rev[id(q.x,q.y)]).sort((a,b)=>Math.hypot(a.x-H.x,a.y-H.y)-Math.hypot(b.x-H.x,b.y-H.y))[0];if(!T)return null;const d=Math.hypot(T.x-H.x,T.y-H.y),f=Math.min(1,(SCOUT_R-2)/d);return{map:{x:Math.round(H.x+(T.x-H.x)*f),y:Math.round(H.y+(T.y-H.y)*f)},tip:'Tap the ringed fog'}}if(n===6){const q=lesOrder();if(q&&q.k&&BUILD[q.k]&&['wood','farm','stone','coal'].includes(q.k)){LESK[6]=q.k;LESRE[q.k]=LESRE[q.k]||new RegExp(TYPES[q.k].n);try{return o()}finally{delete LESK[6]}}return null}
 if(n===8){const f=sites.find(q=>isFac(q)&&!q.linked);if(!f)return null;const P=document.getElementById('panel'),b=P.style.display==='block'?[...P.querySelectorAll('button,[onclick]')].find(x=>x.offsetParent!==null&&/Connect to rail|🔗/.test(x.textContent||'')):null;const ok=document.getElementById('cfOk'),cf=document.getElementById('confirm');if(cf.style.display==='block'&&ok&&!ok.disabled)return{el:ok};return b?{el:b}:{map:f}}
 if(n===7&&sites.some(q=>isFac(q)))return null;return o()}}
{const o=lesShow;lesShow=function(){const n=S.tut;if(n===6){closeLesson();const q=lesOrder();if(q){locateSite(q.T);showInfo(q.T);toast(q.k?'👇 '+q.T.name+' needs '+gname(q.k)+': tap where the hand points':'🚂 Its trains are on the way: watch the order fill')}return}if(n===8){const f=sites.find(isFac);if(f){locateSite(f);showInfo(f)}return}return o()}}
if(typeof window!=='undefined')window.lesShow=lesShow;

// v140: lesson 4 and 9 say exactly what happens; lesson 9 rings Buy a train when no train is free to feed the Sawmill
TUT[3].t='🌾 Ashford also wants wheat. <b>Build a Wheat Farm</b> on open grass, then <b>connect it</b> with ✓ Build. Its wheat goes to Ashford by itself.';
TUT[8].t='⚙ <b>Watch your Sawmill start</b>: trains bring it wood by themselves and take its planks to towns that want them. If every train is busy, buy another in <b>🚂 Trains</b>.';
LES[8]={ic:'⚙',t:'Feeding the mill',m:'“Wood in, planks out. Your trains sort out the rest.”'};
{const o=lesTarget;lesTarget=function(){if(S.tut===8){const f=sites.find(q=>isFac(q));if(f&&f.linked){const busy=!S.trains.some(t=>!t.route&&!(t.cargo>0));const P=document.getElementById('panel');if(busy){const b=P.style.display==='block'?[...P.querySelectorAll('button')].find(x=>x.offsetParent!==null&&/Buy a train/.test(x.textContent||'')):null;return b?{el:b}:{el:document.querySelector('#tools [data-m=trains]')}}return null}}return o()}}

// v141: a bouncing 👇 "Tap here" pointer sits over whatever the lesson wants tapped (button or map square), and the ring glows harder
if(typeof document!=='undefined'&&document.head&&document.head.appendChild){const st=document.createElement('style');st.textContent='.tutHi{outline:4px solid #ffd27a!important;box-shadow:0 0 16px 4px #ffd27acc!important}#tutPtr{position:fixed;z-index:25;pointer-events:none;text-align:center;transform:translateX(-50%);font-weight:800;color:#ffd27a;text-shadow:0 1px 3px #000,0 0 8px #000;font-size:13px;display:none}#tutPtr span{display:block;font-size:34px;line-height:1;animation:tutB .8s ease-in-out infinite}@keyframes tutB{0%,100%{transform:translateY(0)}50%{transform:translateY(9px)}}#tutPtr.up span{animation-name:tutU}@keyframes tutU{0%,100%{transform:translateY(0)}50%{transform:translateY(-9px)}}';document.head.appendChild(st)}
var LT=null;{const o=lesRing;lesRing=function(){o();try{LT=S.tut<TUT.length?lesTarget():null}catch(e){LT=null}}}
function tutPtr(){if(typeof document==='undefined'||!document.body||!document.body.appendChild)return;let p=document.getElementById('tutPtr');if(!p){p=document.createElement('div');p.id='tutPtr';document.body.appendChild(p)}
 const t=LT;if(!t||document.getElementById('lesson')){p.style.display='none';return}let X,Y,top;
 if(t.el&&t.el.getBoundingClientRect){let r=t.el.getBoundingClientRect();if(!r.width){p.style.display='none';return}{const P=document.getElementById('panel');if(P&&P.contains(t.el)){const pr=P.getBoundingClientRect();if(r.top<pr.top+30||r.bottom>pr.bottom-10){if(tutPtr._s!==t.el){tutPtr._s=t.el;tutPtr._st=performance.now();t.el.scrollIntoView({block:'center',behavior:'smooth'})}if(performance.now()-tutPtr._st<1200){p.style.display='none';return}const dn=r.top>=pr.bottom-10;p.style.display='block';p.className=dn?'':'up';p.style.left=(pr.left+pr.width/2)+'px';if(dn){p.innerHTML='Scroll down<span>👇</span>';p.style.top=(pr.bottom-70)+'px'}else{p.innerHTML='<span>👆</span>Scroll up';p.style.top=(pr.top+10)+'px'}return}}}X=r.left+r.width/2;top=r.top>120;Y=top?r.top-8:r.bottom+8}
 else if(t.map){X=((t.map.x+.5)*TS-cam.x)*cam.z+W/2;Y=((t.map.y+.5)*TS-cam.y)*cam.z+H/2;const off=X<20||X>W-20||Y<90||Y>H-150;X=Math.max(40,Math.min(W-40,X));Y=Math.max(110,Math.min(H-170,Y));top=true;Y-=TS*cam.z*.6;if(off){const X0=((t.map.x+.5)*TS-cam.x)*cam.z+W/2,Y0=((t.map.y+.5)*TS-cam.y)*cam.z+H/2,a=Math.atan2(Y0-H/2,X0-W/2);p.style.display='block';p.className='edge';p.style.left=Math.max(70,Math.min(W-70,W/2+Math.cos(a)*W))+'px';p.style.top=Math.max(110,Math.min(H-230,H/2+Math.sin(a)*H))+'px';p.innerHTML='<span style="transform:rotate('+a+'rad);animation:none;display:inline-block">➜</span><br>It\'s this way:<br>pinch out with 2 fingers';return}}
 else{p.style.display='none';return}
 p.style.display='block';p.className=top?'':'up';p.style.left=X+'px';if(top){p.innerHTML='Tap here<span>👇</span>';p.style.top=(Y-56)+'px'}else{p.innerHTML='<span>👆</span>Tap here';p.style.top=Y+'px'}}
if(typeof window!=='undefined')setInterval(()=>{try{tutPtr()}catch(e){}},120);

// v143: scouting lesson frames Ashford and the fog spot together and marks the spot in the fog
{const o=lesShow;lesShow=function(){if(S.tut===5&&!sites.some(q=>q.type==='town'&&!q.linked&&!q.hidden&&rev[id(q.x,q.y)])){closeLesson();const t=lesTarget(),A=sites[hubI()];if(t&&t.map){const d=Math.hypot(t.map.x-A.x,t.map.y-A.y)+6,v=viewBox();cam.z=Math.max(.3,Math.min(1.4,Math.min(v.right-v.left,v.bot-v.top)/(d*TS)));cam.x=((A.x+t.map.x)/2+.5)*TS-((v.left+v.right)/2-W/2)/cam.z;cam.y=((A.y+t.map.y)/2+.5)*TS-((v.top+v.bot)/2-H/2)/cam.z}toast(t&&t.map?'👇 Tap the ringed spot in the fog: scouts walk there and reveal what is around it':'👇 '+(t&&t.tip||'Tap 🧭 Scout'));return}return o()}}
if(typeof window!=='undefined')window.lesShow=lesShow;
// the lesson's map target gets a bright ring with a compass, drawn over the fog
{const o=draw;draw=function(){o.apply(this,arguments);try{if(!LT||!LT.map||S.tut>=TUT.length)return;const X=((LT.map.x+.5)*TS-cam.x)*cam.z+W/2,Y=((LT.map.y+.5)*TS-cam.y)*cam.z+H/2,r=Math.max(18,TS*cam.z*.9),p=(performance.now()/700)%1;ctx.save();ctx.setTransform(DPR(),0,0,DPR(),0,0);
 ctx.strokeStyle='#ffd27a';ctx.lineWidth=4;ctx.beginPath();ctx.arc(X,Y,r,0,7);ctx.stroke();ctx.globalAlpha=1-p;ctx.beginPath();ctx.arc(X,Y,r*(1+p*.9),0,7);ctx.stroke();ctx.globalAlpha=1;
 if(mode==='scout'){ctx.font='bold '+Math.round(r)+'px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('🧭',X,Y)}ctx.restore()}catch(e){}}}
TUT[5].t='🏘 <b>Link a second town.</b> None in sight? Tap <b>🧭 Scout</b>, then tap the <b>🧭 ring in the fog</b> (pinch out with 2 fingers if you can\'t see it). When a town appears, tap it, then <b>🔗 Connect to rail</b>.';
// v144: sending scouts ends scout mode; tap 🧭 Scout again for another team
{const o=scoutAt;scoutAt=function(){const n=S.scouts.length;const r=o.apply(this,arguments);try{if(S.scouts.length>n&&typeof document!=='undefined'){const b=document.querySelector('#tools [data-m=pan]');if(b)b.click();else mode='pan'}}catch(e){}return r}}
// v145: lesson 7 names the order, the missing good and what to build for it
Object.defineProperty(TUT[6],'t',{get(){const q=typeof lesOrder==='function'?lesOrder():null;const lv='Fill one more order to reach <b>Railway level 2</b> (factories unlock).';
 if(!q)return'📋 '+lv;if(!q.k)return'📋 '+lv+' <b>'+q.T.name+'</b>\'s goods are on their way: just watch its order fill.';
 const how={stone:'at the foot of a mountain',coal:'on a coal seam',wood:'near a forest',farm:'on open grass'}[q.k]||'';
 return'📋 '+lv+' <b>'+q.T.name+'</b> still needs '+gname(q.k)+' and nobody makes it yet. <b>Build a '+TYPES[q.k].n+'</b> '+how+', then <b>connect it</b>: the hand shows each tap.'},configurable:true});
// v146: every town size has its own station: a wooden halt, a village station, a brick town station, a stone city terminus with a clock tower, and a glass-roofed grand terminus
function stnBld(s,bx,L){const c=ctx,p=s.pop||0,lv=p<100?0:p<400?1:p<1200?2:p<3000?3:4;
 // platform canopies from Town size up (glass roof over the whole hall for the biggest)
 if(lv>=2){c.fillStyle=lv>=4?'rgba(190,220,235,.32)':'rgba(120,70,50,.55)';if(lv>=4){if(window.HOUSE2&&typeof shedRoof==='function')shedRoof(L);else{c.fillRect(-L,-27,2*L,54);c.strokeStyle='rgba(230,240,245,.55)';c.lineWidth=1;for(let x=-L+6;x<L;x+=10){c.beginPath();c.moveTo(x,-27);c.lineTo(x,27);c.stroke()}}}else{c.fillRect(-L*.7,-27,L*1.4,5);c.fillRect(-L*.7,22,L*1.4,5)}}
 c.save();c.translate(bx,0);const box=(w,h,col,y)=>{c.fillStyle='rgba(0,0,0,.3)';c.fillRect(-w/2+1,y+1,w,h);c.fillStyle=col;c.fillRect(-w/2,y,w,h)},roof=(w,y,h,col)=>{c.fillStyle=col;c.beginPath();c.moveTo(-w/2-3,y);c.lineTo(0,y-h);c.lineTo(w/2+3,y);c.fill()},win=(xs,y,h)=>{c.fillStyle='#ffd27a';for(const x of xs)c.fillRect(x,y,2.5,h||4)};
 if(lv===0){// wooden halt: a small shed, a bench, and a station sign so it is not just another house
  box(16,10,'#8a6a40',-37);roof(16,-37,5,'#5a4128');c.fillStyle='#3b2a18';c.fillRect(-2,-31,4,4);win([-6,4],-35,3);c.fillStyle='#6b4a26';c.fillRect(10,-33,8,2);c.fillStyle='#3a2f22';c.fillRect(-1,-48,2,11);c.fillStyle='#ffd27a';c.fillRect(-7,-48,14,6);c.fillStyle='#1a1a1a';c.textAlign='center';c.textBaseline='middle';c.font='bold 5px system-ui';c.fillText('S',0,-45)}
 else if(lv===1){// village station: cream walls, red roof
  box(28,14,'#d9c9a6',-41);roof(28,-41,8,'#7d3a2a');win([-10,-4,3,8],-37);c.fillStyle='#5a4128';c.fillRect(-2,-33,4,6)}
 else if(lv===2){// town station: brick, two wings and a slate roof
  box(40,16,'#a4553d',-43);roof(40,-43,7,'#4a4f57');c.fillStyle='#d9c9a6';c.fillRect(-20,-43,40,2);win([-15,-10,-5,4,9,14],-39,5);c.fillStyle='#3b2a18';c.fillRect(-3,-34,6,7)}
 else{// city terminus: stone front with a clock tower (two towers for the biggest)
  const w=lv>=4?56:46;box(w,18,'#cfc3ad',-45);c.fillStyle='#4a4f57';c.fillRect(-w/2-2,-48,w+4,4);win(Array.from({length:Math.floor(w/7)},(_,k)=>-w/2+4+k*7),-41,6);c.fillStyle='#3b2a18';c.beginPath();c.arc(0,-31,4,Math.PI,0);c.fill();c.fillRect(-4,-31,8,4);
  for(const tx of lv>=4?[-w/2+6,w/2-6]:[0]){c.fillStyle='rgba(0,0,0,.3)';c.fillRect(tx-4,-61,10,16);c.fillStyle='#b8ab92';c.fillRect(tx-5,-62,10,17);roof(8,-62,7,'#4a4f57');c.fillStyle='#fff8e6';c.beginPath();c.arc(tx,-55,3,0,7);c.fill();c.strokeStyle='#3b2a18';c.lineWidth=.8;c.beginPath();c.moveTo(tx,-55);c.lineTo(tx,-57);c.moveTo(tx,-55);c.lineTo(tx+1.5,-55);c.stroke()}}
 if(s.beacon){c.fillStyle='#e9a646';c.beginPath();c.arc(lv>=3?0:0,lv>=3?-66:lv===2?-51:-48,2.5,0,7);c.fill()}c.fillStyle='#ffd27a';c.beginPath();c.arc(-L+8,-24,2.5,0,7);c.arc(L-8,-24,2.5,0,7);c.fill();c.fillStyle='#3a2a1a';c.fillRect(-L+7,-24,2,5);c.fillRect(L-9,-24,2,5);
 c.restore()}
var stnLift=s=>{const p=s.pop||0;return p>=1200?24:p>=400?10:4};
// v148: build menu as clear full-width cards (icon · name · price, what it does underneath, whole card is the button)
if(typeof document.createElement==='function'){const css=document.createElement('style');css.textContent='.bcard{display:flex;align-items:center;gap:10px;width:100%;text-align:left;margin:5px 0 0;padding:8px 10px;border-radius:10px;border:1.5px solid #e9a646;background:#3a2f22;color:#ffd27a;font-size:13px;line-height:1.25}.bcard .bi{font-size:24px;flex:0 0 auto}.bcard .bt{flex:1 1 auto}.bcard b{font-size:14px}.bcard .bp{flex:0 0 auto;font-weight:700;color:#fff3c8;background:#5a4426;border-radius:7px;padding:3px 7px}.bcard small{display:block;color:#e8d9b8;opacity:.8;font-size:12px;margin-top:2px}.bcard[disabled]{opacity:.4;border-style:dashed}.bhd{margin:10px 0 0;color:#ffd27a;font-weight:700}.bhd small{font-weight:400;opacity:.75;color:#e8d9b8}';if(document.head)document.head.appendChild(css)}
showBuildMenu=function(){PANEL={n:'showBuildMenu',a:[]};openShed=null;openFac=null;openInfo=null;const el=document.getElementById('panel');el.style.display='block';
 const card=(fn,ic,name,price,sub,lock)=>`<button class="bcard" ${lock?'disabled':''} onclick="${fn}"><span class="bi">${ic}</span><span class="bt"><b>${name}</b><small>${sub}</small></span>${price?'<span class="bp">'+price+'</span>':''}</button>`;
 const gw=k=>TYPES[k].g+' '+GOOD[k].toLowerCase();
 let h='<b>🏗 What to build?</b> <small style="opacity:.75">Tap a card, then tap a glowing square</small>';
 h+='<div class="bhd">🛤 Track</div>'+card('startRail()','🛤','Build rails','','Paint squares out from Ashford or your track')+card('startDbl()','🛤🛤','Double track','$'+DBL+'/sq','Paint over busy track so trains can pass');
 h+='<div class="bhd">⛏ Raw goods <small>· gather from the land</small></div>';
 for(const k of ['wood','farm','wool','coal','stone','iron','oil'])h+=card(`pickBuild('${k}')`,TYPES[k].g,TYPES[k].n,fmt(BUILD[k]),'Makes '+gw(k)+' · '+WHERE[k]);
 {const lp=ports().some(o=>o.linked),lock=S.beacon<2;h+='<div class="bhd">⚓ Sea</div>'+card(`pickBuild('port')`,'⚓',lp?'Landing':'Dock',lock?'🔒':costTxt(lp?PORT.land:PORT.up[0]),lock?'Unlocks at Railway level 2':lp?'On the coast of another island in your port\'s sea range':'On any glowing coast square near your track (up to 6 squares away: you confirm the joining track). Ferries reach other islands from it',lock)}
 h+=`<div class="bhd">🏭 Factories <small>· turn raw goods into products · build next to your track</small></div>`;
 for(const[ft,f]of Object.entries(FAC)){const lock=f.lvl>S.beacon;h+=card(`pickBuild('${ft}')`,TYPES[f.out].g,TYPES[ft].n,lock?'🔒':costTxt(PRICE.fac(ft)),(lock?'Unlocks at Railway level '+f.lvl+' · ':'')+'Turns '+Object.keys(f.in).map(gw).join(' + ')+' into '+gw(f.out),lock)}
 el.innerHTML=h+'<i id="pgen" hidden></i>'};
// v154: a square just past a station hall's end counts as joined: the hidden square under the hall end is painted too
function stnBridge(x,y){for(const[a,b]of D4){const X=x+a,Y=y+b,k=id(X,Y);if(track.has(k)||railSel.includes(k)||siteAt(X,Y)||railErr(X,Y))continue;if(!stnAt(X,Y))continue;if([[1,0],[-1,0],[0,1],[0,-1]].some(([c,d])=>railRoot(X+c,Y+d)||railSel.includes(id(X+c,Y+d))))return k}return null}
// v155: tap a shipwreck to see what it gave
{const o=tap;tap=function(x,y){if(mode!=='rail'&&mode!=='build'&&!(mode==='scout')){const w=(S.wrecks||[]).find(w=>Math.abs(w.x-x)<=0&&Math.abs(w.y-y)<=0);if(w){notice('<b style="color:#ffd27a;font-size:15px">🛳 Shipwreck</b><br>'+(w.txt?'Your sea scouts salvaged '+w.txt+'.':'Your sea scouts salvaged this old wreck: it paid out once when they found it.')+'<br><small style="opacity:.8">Each wreck pays out once. Send 🧭 scouts over open sea to find more.</small>');return}}return o.apply(this,arguments)}}

// v157: open orders pay full price; steady buying after an order is filled pays STEADYP and is smaller (it grew with population: 375/min in a Metropolis)
var STEADYP=.35;function STEADY_T(s){return 10+Math.sqrt(Math.max(0,s.pop||0))*.6}
{const o=price;price=function(k,dst,load,dist){if(k==='pass'||!dst||dst.type!=='town')return o(k,dst,load,dist);const want=Math.max(0,((dst.dem||{})[k]||0)-((dst.inc||{})[k]||0)),full=Math.min(load,want),od=ordOf(dst)||{},left=od[k]?Math.max(0,od[k]-((dst.got||{})[k]||0)):0,op=Math.min(full,left),st=full-op;return TYPES[k].rate*DF(dist)*priceMul(k)*(op+STEADYP*st+SURPLUS*.5*(load-full))}}
// v158: the engine shed must face a plain straight piece of track; if new track leaves it facing a curve or a gap, it moves beside the nearest straight piece near Ashford
function shedGood(x,y,strict){if(track.has(id(x,y))||siteAt(x,y)||!rev[id(x,y)])return false;const t=terr[id(x,y)];if(!(t===1||t===2))return false;if(typeof stnAt==='function'&&(stnAt(x,y)))return false;
 const adj=D4.filter(([a,b])=>isRail(x+a,y+b));if(adj.length!==1)return false;const[a,b]=adj[0];if([[b,a],[-b,-a],[-a,-b],[-a+b,-b+a],[-a-b,-b-a]].some(([u,v])=>isRail(x+u,y+v)||laneSet.has(id(x+u,y+v))))return false;const X=x+a,Y=y+b,m=rNb(X,Y);if(m.length!==2||m[0][0]!==-m[1][0]||m[0][1]!==-m[1][1])return false;if(m[0][0]*a+m[0][1]*b!==0)return false;if(wideAt(X,Y)||stnAt(X,Y))return false;
 for(const[c,d]of m){const W=wideAt(X+c,Y+d);if(W)return false}if(strict){for(const[c,d]of m){for(const q of[1,2]){const x2=X+c*q,y2=Y+d*q;if(!track.has(id(x2,y2))&&!(q===2&&siteAt(x2,y2)))return false;if(track.has(id(x2,y2))){const m2=rNb(x2,y2);if(q===1&&!(m2.length===2&&m2[0][0]===-m2[1][0]&&m2[0][1]===-m2[1][1]&&m2[0][0]===c&&m2[0][1]===d||m2.length===2&&m2[1][0]===c&&m2[1][1]===d&&m2[0][0]===-c&&m2[0][1]===-d))return false;if(wideAt(x2,y2))return false}}}}return!D4.concat([[1,1],[1,-1],[-1,1],[-1,-1]]).some(([c,d])=>{const q=siteAt(x+c,y+d);return q&&!q.hidden&&q.type!=='town'})}
{const o0=shedFix;shedFix=function(){o0();const sh=S.sheds&&S.sheds[0],A=sites[hubI()];if(!sh||!A||!track.size)return;if(shedGood(sh.x,sh.y,1))return;if(sh._k===track.size+'/'+sites.length)return;sh._k=track.size+'/'+sites.length;const cur=shedGood(sh.x,sh.y);
 let best=null,bd=1e9;for(let dy=-7;dy<=7;dy++)for(let dx=-7;dx<=7;dx++){const x=A.x+dx,y=A.y+dy;if(!shedGood(x,y))continue;const st=shedGood(x,y,1);if(cur&&!st)continue;const d=Math.hypot(dx,dy)+(Math.hypot(sh.x-x,sh.y-y)<1.5?-2:0)+(st?0:100);if(d<bd){bd=d;best=[x,y]}}if(best){sh.x=best[0];sh.y=best[1];delete sh._k;save()}}}
try{shedFix()}catch(e){}

// v159: the old 'Next frontier' popup is gone (chapters say what comes next); skip tutorial asks twice and can be undone
var skipAsk=0;frontierTick=function(){};
{const o=chCard;chCard=function(tx){let h=o(tx);if(S.tutSkip!=null&&S.tut>=TUT.length)h+='<div style="margin-top:4px"><span data-resume="1" style="text-decoration:underline;color:#ffd27a;font-size:12px">🎓 Resume the tutorial (lesson '+(S.tutSkip+1)+')</span></div>';return h}}
var _NL=[];{const o=notice;notice=function(h){try{_NL.push([Math.round(S.t||0),S.tut,typeof chap==='function'?chap().n:0,String(h||'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').slice(0,110)]);if(_NL.length>200)_NL.shift()}catch(e){}return o.apply(this,arguments)}}
// v159: engine shed redrawn at main-line size: one lead track from the line, a short fan to 3 stalls, bigger brick building
drawShed=function(sh,X,Y,on){const c=ctx,[fx,fy,tk]=shedFace(sh),ang=Math.atan2(fy,fx),sp=S.trains.filter(t=>!S.auto&&!t.route&&!(t.cargo>0)),n=3,D=12,Wd=n*D,BX0=-24,BX1=4,FX=22;
 c.save();c.translate(X,Y);c.rotate(ang);
 const tx=tk?(tk[0]*fx+tk[1]*fy)*TS:TS,ty=tk?(-tk[0]*fy+tk[1]*fx)*TS:0,LX=tk&&isDblD(sh.x+tk[0],sh.y+tk[1])?tx-8:tx-2;
 // gravel yard
 c.fillStyle='#5a4b3b';c.beginPath();c.moveTo(BX1,-Wd/2-3);c.lineTo(FX+2,-9);c.lineTo(LX-4,ty-9);c.lineTo(LX-4,ty+9);c.lineTo(FX+2,9);c.lineTo(BX1,Wd/2+3);c.closePath();c.fill();
 const pts=[];// paths: lead then one curve per stall
 // v178: the lead curves into the main line like a real turnout (toward Ashford), instead of stopping at its side
 let sg=1;if(tk){const T0=[sh.x+tk[0],sh.y+tk[1]],A0=sites[hubI()],pv=[-fy,fx],cand=[1,-1].filter(g=>track.has(id(T0[0]+g*pv[0],T0[1]+g*pv[1])));if(cand.length===1)sg=cand[0];else if(cand.length&&A0)sg=cand.sort((g,h)=>Math.hypot(T0[0]+g*pv[0]-A0.x,T0[1]+g*pv[1]-A0.y)-Math.hypot(T0[0]+h*pv[0]-A0.x,T0[1]+h*pv[1]-A0.y))[0]}
 const EX=LX+2,EY=ty+sg*TS*.8,B=(a0,a1,a2,a3,u)=>(1-u)**3*a0+3*(1-u)**2*u*a1+3*(1-u)*u*u*a2+u**3*a3;
 const lead=u=>[B(FX,FX+(EX-FX)*.45,EX,EX,u),B(0,ty*.15,ty+sg*TS*.05,EY,u)];
 const stall=(k,u)=>{const yy=-Wd/2+D/2+k*D;const x=BX1+(FX-BX1)*u;return[x,yy+(0-yy)*(u*u*(3-2*u))]};
 const ties=(f,len)=>{c.strokeStyle='#5b4128';c.lineWidth=3;const m=Math.max(2,Math.round(len/8));for(let i=0;i<=m;i++){const u=i/m,[x,y]=f(u),[x2,y2]=f(Math.min(1,u+.02)),[x1,y1]=f(Math.max(0,u-.02)),a=Math.atan2(y2-y1,x2-x1);c.beginPath();c.moveTo(x-Math.sin(a)*7,y+Math.cos(a)*7);c.lineTo(x+Math.sin(a)*7,y-Math.cos(a)*7);c.stroke()}};
 const rails=f=>{c.strokeStyle='#b9b2a6';c.lineWidth=2;for(const g of[-4,4]){c.beginPath();for(let i=0;i<=16;i++){const u=i/16,[x,y]=f(u),[x2,y2]=f(Math.min(1,u+.02)),[x1,y1]=f(Math.max(0,u-.02)),a=Math.atan2(y2-y1,x2-x1),px=x-Math.sin(a)*g,py=y+Math.cos(a)*g;i?c.lineTo(px,py):c.moveTo(px,py)}c.stroke()}};
 ties(lead,Math.hypot(EX-FX,EY));for(let k=0;k<n;k++)ties(u=>stall(k,u),FX-BX1);
 rails(lead);for(let k=0;k<n;k++)rails(u=>stall(k,u));
 // building
 c.fillStyle='rgba(0,0,0,.32)';c.fillRect(BX0+2,-Wd/2+3,BX1-BX0,Wd+2);
 c.fillStyle='#8a4a30';c.fillRect(BX0,-Wd/2-2,BX1-BX0,Wd+4);
 c.fillStyle='rgba(0,0,0,.12)';for(let y=-Wd/2;y<Wd/2+2;y+=3)c.fillRect(BX0,y,BX1-BX0,.6);
 for(let k=0;k<n;k++){const y0=-Wd/2+k*D;c.fillStyle='#4f4a45';c.fillRect(BX0,y0,BX1-BX0,D/2);c.fillStyle='#625c55';c.fillRect(BX0,y0+D/2,BX1-BX0,D/2);c.fillStyle='#3a3530';c.fillRect(BX0,y0+D/2-.4,BX1-BX0,.8);c.fillStyle='#2a2622';c.fillRect(BX0+6,y0+D/2-1.4,5,2.8);c.fillRect(BX0+16,y0+D/2-1.4,5,2.8)}
 for(let k=0;k<n;k++){const yy=-Wd/2+D/2+k*D;c.fillStyle='#1a1512';c.fillRect(BX1-1,yy-5,3,10);if(k<sp.length){c.save();c.translate(BX1+6,yy);c.scale(.8,.8);drawEngine(sp[k],lineCol(S.trains.indexOf(sp[k])));c.restore()}}
 if(sp.length>n){c.fillStyle='#ffd27a';c.font='bold 8px system-ui';c.save();c.translate(BX0+14,0);c.rotate(-ang);c.fillText('+'+(sp.length-n),0,0);c.restore()}
 if(on){c.strokeStyle='#ffd27a';c.lineWidth=2.5;c.strokeRect(BX0-2,-Wd/2-4,BX1-BX0+4,Wd+8)}
 c.restore();
 const tm2=performance.now()/1000;for(let k=0;k<3;k++){const u=(tm2*.35+k*.33)%1;c.fillStyle=`rgba(210,205,195,${.35*(1-u)})`;c.beginPath();c.arc(X-fx*10-4+k*4+u*6,Y-fy*10-10-u*14,2+u*4,0,7);c.fill()}};
// v160: popups come one at a time in order (no more stacking into one long card); OK shows the next one.
// During the tutorial a town growing is a short toast (the lesson card already celebrates), and finishing the tutorial hands over to the chapter goals.
var NQ=[];{const o=notice;const vis=()=>{const e=typeof document!=='undefined'&&document.getElementById&&document.getElementById('notice');return e&&e.style.display==='block'};
 notice=function(h){if(typeof document==='undefined'||!document.getElementById)return o(h);
  if(S.tut<TUT.length&&/GREW!<\/b>/.test(h||'')){const m=String(h).replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').match(/🎉 (.+?) GREW! (\S+) → (\S+) (\+\$[\d,]+)/);toast(m?'🎉 '+m[1].toLowerCase().replace(/\b\w/g,c=>c.toUpperCase())+' grew into a '+m[3]+' · '+m[4]:'🎉 A town grew');return}
  if(NQ.includes(h))return;if(vis()){NQ.push(h);nqMark();return}o(h)};
 function nqMark(){const e=document.getElementById('notice');if(!e)return;const b=e.querySelector('button:last-of-type');if(b&&b.textContent.trim()==='OK')b.textContent='Next ›'}
 var nqPump=function(){if(vis()||!NQ.length)return;const h=NQ.shift();o(h);if(NQ.length)nqMark()};
 if(typeof window!=='undefined')setInterval(()=>{try{nqPump()}catch(e){}},250)}
{let pt=S.tut;const o=tickMissions;tickMissions=function(dt){const was=pt;o(dt);pt=S.tut;if(was<TUT.length&&S.tut>=TUT.length&&S.tutSkip==null&&typeof document!=='undefined'&&document.getElementById){const G=chGoals();
 notice('<div style="text-align:center"><div style="font-size:30px">🎓</div><b style="color:#ffd27a;font-size:17px">Tutorial complete!</b></div><div style="margin-top:6px;font-style:italic;opacity:.9">“You know the trade now,” Mira says. “The rest of Ashford Isle is out there in the fog.”</div><div style="margin-top:8px"><b>What next?</b><br>Mira now gives you <b>missions</b>. Your current one is on the card at the top left: tap Go › for the next step.</div>')}}}
// v161: no more snapping between parallel tracks. When a train starts a new path (turning back at a stop, rerouting), its drawn
// position glides from where it was to the new lane over ~0.8 s, like running through a crossover, instead of jumping 8-16 px.
{const rp=railPt,GL=800,GM=new WeakMap(),gm=t=>{let m=GM.get(t);if(!m){m={};GM.set(t,m)}return m};railPt=function(P,s,t){const r=rp(P,s,t),m=t&&GM.get(t);if(m&&m.gl){const f=1-(performance.now()-m.gl.t0)/GL;if(f<=0)m.gl=null;else{const e=f*f*(3-2*f);r[0]+=m.gl.x*e;r[1]+=m.gl.y*e}}return r};
 const head=t=>{const s=Math.max(0,Math.min(t.path.length-1,t.pos-(t.qo||0)));return rp(t.path,s,t)};
 const o=draw;draw=function(){try{const now=performance.now();for(const t of S.trains){if(!t.path||!t.path.length)continue;const p=head(t),m=gm(t);if(m.P&&m.P!==t.path&&m.p&&!t._rtng){let dx=m.p[0]-p[0],dy=m.p[1]-p[1];if(m.gl){const f=1-(now-m.gl.t0)/GL;if(f>0){const e=f*f*(3-2*f);dx+=m.gl.x*e;dy+=m.gl.y*e}}const d=Math.hypot(dx,dy);if(d>1.5&&d<48)m.gl={x:dx,y:dy,t0:now}}if(t._rtng)t._rtng=0;m.P=t.path;m.p=p}}catch(e){}return o.apply(this,arguments)}}
// v162: scouts cross open sea only by boat (from a ⚓ dock); on the map a land party walks and a sea party sails
function seaBetween(o,x,y){const d=Math.hypot(x-o.x,y-o.y),n=Math.max(2,Math.ceil(d*2));for(let i=1;i<=n;i++){const X=Math.round(o.x+(x-o.x)*i/n),Y=Math.round(o.y+(y-o.y)*i/n);if(deep[id(X,Y)])return true}return false}
{const o=scoutAt;scoutAt=function(x,y,hi){const sea=H=>H&&H.type!=='port'&&seaBetween(H,x,y),boat=()=>ports().filter(p=>p.linked&&Math.hypot(p.x-x,p.y-y)<=portR(p)).sort((a,b)=>Math.hypot(a.x-x,a.y-y)-Math.hypot(b.x-x,b.y-y))[0];
 const noBoat='🌊 Open sea is in the way and scouts can\'t walk on water. '+(S.beacon>=2?'Build a ⚓ Dock: boats scout the sea from it':'Docks unlock at Railway level 2: boats scout the sea from them');
 if(hi!==undefined){const H=sites[hi];if(sea(H)){const P=boat();if(!P){toast(noBoat);return}hi=sites.indexOf(P);toast('⛵ Open sea in the way: a boat sails from '+P.name)}return o(x,y,hi)}
 const C=sites.filter(q=>scoutOk(q)&&Math.hypot(q.x-x,q.y-y)<=scR(q));if(C.length){const ok=C.filter(q=>!sea(q));if(!ok.length){const P=boat();if(!P){toast(noBoat);return}return o(x,y,sites.indexOf(P))}if(ok.length===1&&ok.length<C.length)return o(x,y,sites.indexOf(ok[0]))}return o(x,y)}}
function scoutFig(sc,X,Y,tm){const c=ctx,wet=terr[id(Math.round(sc.x),Math.round(sc.y))]===0,a=Math.atan2(sc.ty-sc.y,sc.tx-sc.x),fl=Math.cos(a)<0?-1:1;
 c.fillStyle='rgba(255,210,120,.18)';c.beginPath();c.arc(X,Y,13+Math.sin(tm*4)*2,0,7);c.fill();c.save();c.translate(X,Y);
 if(wet){const bob=Math.sin(tm*3)*1.2;// wake, hull, sail
  c.strokeStyle='rgba(255,255,255,.55)';c.lineWidth=1.2;for(const k of[1,2]){c.beginPath();c.arc(-Math.cos(a)*6*k,-Math.sin(a)*6*k+3,3+k*2,a+Math.PI-.9,a+Math.PI+.9);c.stroke()}
  c.translate(0,bob);c.scale(fl,1);c.fillStyle='rgba(0,0,0,.25)';c.beginPath();c.ellipse(1,5,9,2.5,0,0,7);c.fill();
  c.fillStyle='#6b4528';c.beginPath();c.moveTo(-9,1);c.lineTo(9,1);c.lineTo(6,5);c.lineTo(-7,5);c.closePath();c.fill();c.fillStyle='#8a5a34';c.fillRect(-8,1,16,1.2);
  c.strokeStyle='#3a2a1a';c.lineWidth=1.2;c.beginPath();c.moveTo(0,1);c.lineTo(0,-12);c.stroke();c.fillStyle='#f3ead8';c.beginPath();c.moveTo(1,-11);c.lineTo(8,0);c.lineTo(1,0);c.closePath();c.fill();c.fillStyle='#e9a646';c.beginPath();c.moveTo(0,-12);c.lineTo(-5,-10.5);c.lineTo(0,-9);c.fill()}
 else{const st=Math.sin(tm*8);c.scale(fl,1);// two walkers with packs and a lantern
  for(const[ox,col]of[[-4,'#6b8f4e'],[4,'#a8573a']]){c.save();c.translate(ox,0);c.fillStyle='rgba(0,0,0,.25)';c.beginPath();c.ellipse(0,6,3.5,1.2,0,0,7);c.fill();c.strokeStyle='#3a2a1a';c.lineWidth=1.3;c.beginPath();c.moveTo(0,1);c.lineTo(-1.5+st*1.5,6);c.moveTo(0,1);c.lineTo(1.5-st*1.5,6);c.stroke();c.fillStyle=col;c.fillRect(-1.8,-4,3.6,5.5);c.fillStyle='#7a5a3a';c.fillRect(-3.4,-3.5,1.8,4);c.fillStyle='#f0c9a0';c.beginPath();c.arc(0,-5.8,1.8,0,7);c.fill();c.fillStyle='#4a3320';c.fillRect(-2.4,-7.8,4.8,1.2);c.restore()}
  c.strokeStyle='#3a2a1a';c.lineWidth=1;c.beginPath();c.moveTo(6,-2);c.lineTo(8,-2);c.lineTo(8,0);c.stroke();c.fillStyle=`rgba(255,220,120,${.7+.3*Math.sin(tm*6)})`;c.beginPath();c.arc(8,1.2,1.5,0,7);c.fill()}
 c.restore()}
// v163: capitals look like capitals. Ashford and regional capitals get a cobbled square with a fountain and market stalls,
// slate-roofed houses and a low stone wall with gaps where the track runs; big towns (1,200+) get a church with a spire
function townFlair(s,X,Y,hs,ruin){if(ruin||!hs.length)return;const c=ctx,cap=s.beacon||s.rcap,tm=performance.now()/1000;
 const take=()=>{let bi=-1,bd=1e9;for(let i=0;i<hs.length;i++){const d=Math.hypot(hs[i][0]-X,hs[i][1]-Y-6);if(d<bd){bd=d;bi=i}}return bi<0?null:hs.splice(bi,1)[0]};
 if(cap&&hs.length>=4){let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9;for(const[hx,hy]of hs){x0=Math.min(x0,hx);x1=Math.max(x1,hx);y0=Math.min(y0,hy);y1=Math.max(y1,hy)}x0-=12;x1+=12;y0-=16;y1+=14;
  // stone wall: short segments with crenels, skipped over track squares and the station
  const seg=(ax,ay,bx,by)=>{const L=Math.hypot(bx-ax,by-ay),n=Math.max(1,Math.round(L/5));for(let i=0;i<n;i++){const u0=i/n,u1=(i+1)/n,px=ax+(bx-ax)*(u0+u1)/2,py=ay+(by-ay)*(u0+u1)/2,tx=Math.floor(px/TS),ty=Math.floor(py/TS);if(track.has(id(tx,ty))||laneSet.has(id(tx,ty))||(typeof stnAt==='function'&&stnAt(tx,ty)===s)||terr[id(tx,ty)]===0)continue;const qx=ax+(bx-ax)*u0,qy=ay+(by-ay)*u0,rx=ax+(bx-ax)*u1,ry=ay+(by-ay)*u1;c.strokeStyle='rgba(0,0,0,.25)';c.lineWidth=3.2;c.beginPath();c.moveTo(qx+1,qy+1.5);c.lineTo(rx+1,ry+1.5);c.stroke();c.strokeStyle='#b8ad98';c.lineWidth=2.6;c.beginPath();c.moveTo(qx,qy);c.lineTo(rx,ry);c.stroke();if(i%2===0){c.fillStyle='#d2c8b2';c.fillRect((qx+rx)/2-1,(qy+ry)/2-2.4,2,1.6)}}};
  seg(x0,y0,x1,y0);seg(x1,y0,x1,y1);seg(x1,y1,x0,y1);seg(x0,y1,x0,y0);
  for(const[cx,cy]of[[x0,y0],[x1,y0],[x1,y1],[x0,y1]]){const tx=Math.floor(cx/TS),ty=Math.floor(cy/TS);if(track.has(id(tx,ty))||terr[id(tx,ty)]===0)continue;c.fillStyle='rgba(0,0,0,.3)';c.fillRect(cx-3,cy-2,7,7);c.fillStyle='#c9bea6';c.fillRect(cx-3.5,cy-4,7,7);c.fillStyle='#8a4a30';c.beginPath();c.moveTo(cx-4.5,cy-4);c.lineTo(cx,cy-9);c.lineTo(cx+4.5,cy-4);c.fill()}
  // the square
  const h=take();if(h){{let bi=-1,bd=1e9;for(let i=0;i<hs.length;i++){const d=Math.hypot(hs[i][0]-h[0],hs[i][1]-h[1]);if(Math.abs(hs[i][1]-h[1])<3&&d<bd){bd=d;bi=i}}if(bi>=0&&bd<20){const q=hs.splice(bi,1)[0];h[0]=(h[0]+q[0])/2}}const[hx,hy]=h,w=28,ht=15;c.fillStyle='#cbbd9c';c.fillRect(hx-w/2,hy-ht/2-1,w,ht);c.fillStyle='rgba(120,100,70,.35)';for(let i=-w/2+2;i<w/2;i+=3)for(let j=-ht/2+1;j<ht/2-1;j+=3)if((i+j)%2===0)c.fillRect(hx+i,hy+j-1,1.2,1.2);
   c.fillStyle='#8a8478';c.beginPath();c.arc(hx,hy-1,5,0,7);c.fill();c.fillStyle='#5aa0d0';c.beginPath();c.arc(hx,hy-1,3.8,0,7);c.fill();c.fillStyle='#8a8478';c.fillRect(hx-.8,hy-5,1.6,4);const u=(tm*1.5)%1;c.fillStyle=`rgba(220,240,255,${.8*(1-u)})`;c.beginPath();c.arc(hx,hy-2-u*3,.9+u,0,7);c.fill();
   for(const[sx,col]of[[-10,'#c8443a'],[10,'#3f6fa0']]){c.fillStyle='#6b4a2a';c.fillRect(hx+sx-2,hy+2,4,3);c.fillStyle=col;c.fillRect(hx+sx-2.5,hy+.5,5,1.8);c.fillStyle='#f3ead8';c.fillRect(hx+sx-1.5,hy+.5,1,1.8);c.fillRect(hx+sx+.5,hy+.5,1,1.8)}
   for(let k=0;k<4;k++){const a=tm*.3+k*1.6;c.fillStyle=['#7a3a2a','#2f5a7a','#5a7a3a','#7a6a2a'][k];c.beginPath();c.arc(hx+Math.cos(a)*8,hy-1+Math.sin(a)*5,1.1,0,7);c.fill()}}
  }
 if(!cap&&s.pop<1200&&hs.length>=3){const h=take();if(h){const[hx,hy]=h;c.fillStyle='rgba(0,0,0,.3)';c.fillRect(hx-4,hy-2,10,7);c.fillStyle='#b8ad98';c.beginPath();c.arc(hx,hy,4,0,7);c.fill();c.fillStyle='#5aa0d0';c.beginPath();c.arc(hx,hy,2.5,0,7);c.fill();c.fillStyle='#6b4a2a';c.fillRect(hx-4,hy-6,1.5,6);c.fillRect(hx+2.5,hy-6,1.5,6);c.fillStyle='#7d3a2a';c.beginPath();c.moveTo(hx-5,hy-6);c.lineTo(hx,hy-11);c.lineTo(hx+5,hy-6);c.fill()}}
 if(!cap&&s.pop>=1200&&hs.length>=6){const h=take();if(h){const[hx,hy]=h;c.fillStyle='rgba(0,0,0,.3)';c.fillRect(hx-5,hy-3,12,9);c.fillStyle='#d8ccb0';c.fillRect(hx-6,hy-5,11,10);c.fillStyle='#6a4a3a';c.beginPath();c.moveTo(hx-7,hy-5);c.lineTo(hx-.5,hy-10);c.lineTo(hx+6,hy-5);c.fill();
  c.fillStyle='#e3d8bd';c.fillRect(hx+1,hy-14,4,10);c.fillStyle='#5a4a6a';c.beginPath();c.moveTo(hx,hy-14);c.lineTo(hx+3,hy-22);c.lineTo(hx+6,hy-14);c.fill();c.fillStyle='#ffd27a';c.fillRect(hx+2.4,hy-11,1.2,1.6);c.fillStyle='#3a2a1a';c.fillRect(hx-2,hy+1,2.4,4)}}}
// v164: BRIDGES. Track over water gets a real structure under the rails: double track rides a stone arch viaduct,
// short single crossings a wooden trestle on piles, long single crossings (4+ squares) a steel truss.
function drawBridges(){const c=ctx,vb=null;
 for(const k of track){if(terr[k]!==0)continue;const x=k%N,y=(k/N)|0;if(vb&&(x<vb.x0-1||x>vb.x1+1||y<vb.y0-1||y>vb.y1+1))continue;
  const r=(a,b)=>isRail(x+a,y+b),hz=r(1,0)||r(-1,0),vt=r(0,1)||r(0,-1),straight=hz!==vt,ax=hz?1:0,ay=hz?0:1;
  let run=1;for(const sg of[-1,1]){let i=1;while(i<8&&terr[id(x+sg*i*ax,y+sg*i*ay)]===0&&track.has(id(x+sg*i*ax,y+sg*i*ay)))i++;run+=i-1}
  const dbl=isDblD(x,y),G=dbl?17:11,X=(x+.5)*TS,Y=(y+.5)*TS,H=TS/2,sty=brSty(k,dbl,run);
  c.save();c.translate(X,Y);if(straight&&!hz)c.rotate(Math.PI/2);
  const L=straight?H:H-2,W=straight?G+3:H;
  c.fillStyle='rgba(0,20,40,.28)';c.fillRect(-L+3,-W+5,2*L,2*W);// shadow on the water
  if(sty==='stone'){c.fillStyle='#a99f8a';c.fillRect(-L,-W,2*L,2*W);c.fillStyle='rgba(0,0,0,.08)';for(let i=-L;i<L;i+=4)c.fillRect(i,-W,.6,2*W);c.fillStyle='#c9bea6';c.fillRect(-L,-W,2*L,2.4);c.fillRect(-L,W-2.4,2*L,2.4);
   if(straight)for(const sd of[-1,1]){c.fillStyle='#8f8574';c.fillRect(-4,sd*W-(sd>0?0:3),8,3);c.fillStyle='rgba(20,40,60,.45)';c.beginPath();c.ellipse(H,sd*(W+3),6,2.5,0,0,7);c.fill()}}
  else if(sty==='wood'){c.fillStyle='#7a5634';c.fillRect(-L,-W,2*L,2*W);c.fillStyle='#5b4128';for(let i=-L+2;i<L;i+=5)c.fillRect(i,-W,1,2*W);
   if(straight)for(const sd of[-1,1])for(let i=-L+4;i<L;i+=10){c.fillStyle='#3a2a1a';c.beginPath();c.arc(i,sd*(W+1.5),2,0,7);c.fill();c.strokeStyle='rgba(58,42,26,.7)';c.lineWidth=1;c.beginPath();c.moveTo(i,sd*(W+1.5));c.lineTo(i+10,sd*(W-1));c.stroke()}}
  else if(sty==='susp'){c.fillStyle='#4e555c';c.fillRect(-L,-W,2*L,2*W);c.fillStyle='rgba(255,255,255,.08)';c.fillRect(-L,-W,2*L,1.5);
   if(straight){const along=hz?x:y,ph=((along%5)+5)%5,tw=ph===0;for(const sd of[-1,1]){c.strokeStyle='#d0503f';c.lineWidth=2;c.beginPath();for(let i=-L;i<=L;i+=2){const u=(ph*2*L+i+L)/(10*L),sag=Math.abs(u-.5)*2;const yy=sd*(W+1.5+3*(1-sag*sag));if(i===-L)c.moveTo(i,yy);else c.lineTo(i,yy)}c.stroke();c.strokeStyle='rgba(196,71,58,.55)';c.lineWidth=.7;c.beginPath();for(let i=-L+3;i<L;i+=5){c.moveTo(i,sd*W);c.lineTo(i,sd*(W+2.5))}c.stroke()}
    if(tw){c.fillStyle='rgba(0,20,40,.3)';c.beginPath();c.moveTo(-4,-W-6);c.lineTo(14,-W+8);c.lineTo(14,W+16);c.lineTo(-4,W+6);c.fill();for(const sd of[-1,1]){c.fillStyle='#9e2b22';c.fillRect(-4.5,sd*(W+3)-4.5,9,9);c.fillStyle='#e05a48';c.fillRect(-4.5,sd*(W+3)-4.5,9,3)}c.fillStyle='#b8352b';c.fillRect(-2.5,-W-3,5,2*W+6)}}}
  else{c.fillStyle='#5c6168';c.fillRect(-L,-W,2*L,2*W);if(straight)for(const sd of[-1,1]){c.strokeStyle='#8a929c';c.lineWidth=1.6;c.beginPath();c.moveTo(-L,sd*W);c.lineTo(L,sd*W);c.stroke();c.lineWidth=1.1;c.beginPath();for(let i=-L;i<L;i+=8){c.moveTo(i,sd*W);c.lineTo(i+4,sd*(W+3));c.lineTo(i+8,sd*W)}c.stroke();c.fillStyle='#8a929c';for(let i=-L;i<=L;i+=8)c.fillRect(i-1,sd*W-1,2,2)}}
  c.restore()}}
// PORTS: wooden pier on pilings, stacked crates, a crane and a fishing boat bobbing at the berth
function portFlair(s,X,Y){{const c=ctx;for(const[dx,dy]of D4){const nx=s.x+dx,ny=s.y+dy;if(!track.has(id(nx,ny))&&!laneSet.has(id(nx,ny)))continue;if(laneSet.has(id(nx,ny))&&!track.has(id(nx,ny)))continue;c.save();c.translate(X,Y);c.rotate(Math.atan2(dy,dx));c.fillStyle='#5a4b3b';c.fillRect(8,-9,TS/2-8,18);c.strokeStyle='#5b4128';c.lineWidth=3;for(let x=10;x<=TS/2;x+=6){c.beginPath();c.moveTo(x,-7);c.lineTo(x,7);c.stroke()}c.strokeStyle='#b9b2a6';c.lineWidth=2;for(const g of[-4,4]){c.beginPath();c.moveTo(9,g);c.lineTo(TS/2+1,g);c.stroke()}c.fillStyle='#a8432f';c.fillRect(7,-6,2.5,12);c.restore()}}
 const c=ctx,tm=performance.now()/1000,w=D4.find(([dx,dy])=>terr[id(s.x+dx,s.y+dy)]===0)||[1,0];c.save();c.translate(X,Y);c.rotate(Math.atan2(w[1],w[0]));
 for(let k=6;k<TS*.95;k+=8)for(const sd of[-1,1]){c.fillStyle='#3a2a1a';c.beginPath();c.arc(k,sd*6.5,1.7,0,7);c.fill()}
 const bob=Math.sin(tm*2+s.x)*1.2;c.save();c.translate(TS*.62,13+bob);c.fillStyle='rgba(0,0,0,.25)';c.beginPath();c.ellipse(1,2,9,2.6,0,0,7);c.fill();c.fillStyle='#2f5a7a';c.beginPath();c.moveTo(-9,-2);c.lineTo(9,-2);c.lineTo(6,2.5);c.lineTo(-7,2.5);c.closePath();c.fill();c.fillStyle='#f3ead8';c.fillRect(-3,-5,5,3);c.strokeStyle='#3a2a1a';c.lineWidth=1;c.beginPath();c.moveTo(4,-2);c.lineTo(4,-9);c.lineTo(9,-4);c.stroke();c.restore();
 c.restore();
 for(const[i,col]of[[0,'#a8743c'],[1,'#8a5a34'],[2,'#c88c4a']]){const cx=X-13+i*4.5,cy=Y+9-(i===2?3.5:0);c.fillStyle='rgba(0,0,0,.25)';c.fillRect(cx+1,cy+1,4,4);c.fillStyle=col;c.fillRect(cx,cy,4,4);c.strokeStyle='#5b4128';c.lineWidth=.6;c.strokeRect(cx,cy,4,4)}
 c.strokeStyle='#4a3a2a';c.lineWidth=1.6;c.beginPath();c.moveTo(X+10,Y+8);c.lineTo(X+10,Y-12);c.lineTo(X+18,Y-8);c.stroke();c.lineWidth=.8;c.beginPath();c.moveTo(X+18,Y-8);c.lineTo(X+18,Y-3+Math.sin(tm)*1.5);c.stroke();c.fillStyle='#c88c4a';c.fillRect(X+16.5,Y-3+Math.sin(tm)*1.5,3,3)}

// v167: heal Marrow Cove Crossing in Sébastien's game: the old load-time side repair cut its north line off; join it into the hall's north end
try{if(!S.fx167){S.fx167=1;const o=sites.find(s=>s.type==='town'&&s.name==='Marrow Cove Crossing'&&s.x===106&&s.y===134);
 if(o&&track.has(id(107,133))&&track.has(id(107,132))&&!track.has(id(107,134))&&!track.has(id(106,133))&&!track.has(id(106,132))&&track.has(id(106,135))&&!siteAt(106,132)&&!siteAt(106,133)){
  track.delete(id(107,133));track.add(id(106,132));track.add(id(106,133));try{computeNet()}catch(e){}if(typeof stnMemo!=='undefined')stnMemo={};save();setTimeout(()=>toast('🔧 Marrow Cove Crossing is reconnected: its north line now runs into the station'),2500)}}}catch(e){console.error(e)}

// v167: buying a map is a 2-step choice: preview the covered circle on the map, pick the town to buy from, then Buy
var MAPPV=null;
function mapTowns(){return sites.filter(o=>(o.type==='town'||o.type==='port')&&o.linked&&!o.hidden&&!(S.maps||[]).some(m=>m.x===o.x&&m.y===o.y))}
function mapPreview(i){const o=sites[i];if(!o)return;closePanel();if(mode!=='pan'){const pb=document.querySelector('[data-m=pan]');if(pb)pb.click()}MAPPV={i,x:o.x,y:o.y,r:mapR(o)};
 const v=viewBox(),h=Math.max(120,v.bot-v.top-100),w=Math.max(120,v.right-v.left-20),r=mapR(o);cam.z=Math.max(.12,Math.min(1.4,Math.min(w,h)/((2*r+2)*TS)));cam.x=(o.x+.5)*TS-((v.left+v.right)/2-W/2)/cam.z;cam.y=(o.y+.5)*TS-((v.top+v.bot-100)/2-H/2)/cam.z;mapBar()}
function mapBar(){let b=document.getElementById('mapBar');if(!MAPPV){if(b)b.style.display='none';return}
 if(!b){b=document.createElement('div');b.id='mapBar';b.style.cssText='position:fixed;bottom:84px;left:10px;right:10px;z-index:30;background:#2a241bf2;border:1.5px solid #e9a646;border-radius:12px;padding:8px 10px;font-size:13px;line-height:1.35;color:#f4ead5';document.body.appendChild(b)}
 const o=sites[MAPPV.i],c=mapCost(),L=mapTowns(),cur=L.indexOf(o),nx=L.length>1?L[(cur+1)%L.length]:null,bs='border:0;border-radius:9px;padding:8px 10px;margin:3px;font:inherit;font-weight:700;';
 b.innerHTML='🗺 <b>Map of the area around '+nm(o)+'</b><br><small style="opacity:.85">It shows hidden towns and finds (?) inside the bright circle ('+MAPPV.r+' tiles'+(o.type==='port'?', sea charts reach further':'')+'). Or tap a town or dock on the map.</small><div style="text-align:center;margin-top:4px">'
  +'<button onclick="mapBuyNow()" style="'+bs+'background:#e9a646;color:#2a1d0c'+(S.money<c?';opacity:.45':'')+'">✓ Buy this map · '+fmt(c)+'</button>'
  +(nx?'<button onclick="mapPreview('+sites.indexOf(nx)+')" style="'+bs+'background:#3d3426;color:#f4ead5">↻ Try '+nm(nx)+'</button>':'')
  +'<button onclick="mapCancel()" style="'+bs+'background:#3d3426;color:#f4ead5">✕ Cancel</button></div>';b.style.display='block'}
function mapBuyNow(){if(!MAPPV)return;const i=MAPPV.i;if(S.money<mapCost()){toast('A map costs '+fmt(mapCost()));return}MAPPV=null;mapBar();buyMapRaw(i,1)}
function mapCancel(){MAPPV=null;mapBar()}
var buyMapRaw=buyMap;buyMap=function(i){mapPreview(i)};
if(typeof window!=='undefined'){window.buyMap=buyMap;window.mapPreview=mapPreview;window.mapBuyNow=mapBuyNow;window.mapCancel=mapCancel}
setInterval(()=>{if(MAPPV)mapBar()},1000);
{const o=draw;draw=function(){o.apply(this,arguments);try{if(typeof document==='undefined'||!ctx)return;const sx=x=>(x+.5)*TS*cam.z-cam.x*cam.z+W/2,sy=y=>(y+.5)*TS*cam.z-cam.y*cam.z+H/2,tm=performance.now();
 if(false&&(S.maps||[]).length&&mode==='scout'&&!MAPPV&&!SCD){ctx.save();ctx.setLineDash([6,6]);ctx.lineWidth=1.5;ctx.strokeStyle='rgba(255,231,168,.35)';for(const m of S.maps){ctx.beginPath();ctx.arc(sx(m.x),sy(m.y),m.r*TS*cam.z,0,7);ctx.stroke()}ctx.restore()}
 if(!MAPPV)return;const X=sx(MAPPV.x),Y=sy(MAPPV.y),R=MAPPV.r*TS*cam.z;ctx.save();ctx.fillStyle='rgba(10,8,5,.62)';ctx.beginPath();ctx.rect(0,0,W,H);ctx.moveTo(X+R,Y);ctx.arc(X,Y,R,0,Math.PI*2);ctx.closePath();ctx.fill('evenodd');ctx.beginPath();ctx.arc(X,Y,R,0,7);ctx.setLineDash([10,7]);ctx.lineDashOffset=-tm/60;ctx.lineWidth=3;ctx.strokeStyle='#ffd27a';ctx.stroke();ctx.setLineDash([]);
 ctx.font='bold 13px system-ui';ctx.textAlign='center';const t='🗺 Map here';const tw=ctx.measureText(t).width+16;ctx.fillStyle='#2a241be8';ctx.fillRect(X-tw/2,Y-12-R*0,tw,24);ctx.fillStyle='#ffd27a';ctx.fillText(t,X,Y+5);ctx.restore()}catch(e){}}}
// v167: while previewing a map, tapping a linked town or dock previews that one instead
{const o=tap;tap=function(x,y){if(MAPPV){const L=mapTowns();let b=null,bd=3;for(const s of L){const d=Math.max(Math.abs(s.x-x),Math.abs(s.y-y));if(d<bd){bd=d;b=s}}if(b){MAPPK=null;mapPreview(sites.indexOf(b));return}toast('🗺 Tap a linked town or dock to see its map area');return}return o(x,y)}}
// v168: second pass of the Marrow Cove heal (his game came back with the old stub and no hall entry)
try{if(!S.fx168){S.fx168=1;const o=sites.find(s=>s.type==='town'&&s.name==='Marrow Cove Crossing'&&s.x===106&&s.y===134);
 if(o&&track.has(id(107,132))&&track.has(id(106,135))&&!track.has(id(107,134))&&!siteAt(106,132)&&!siteAt(106,133)&&(!track.has(id(106,133))||track.has(id(107,133)))){
  track.delete(id(107,133));track.add(id(106,132));track.add(id(106,133));try{computeNet()}catch(e){}if(typeof stnMemo!=='undefined')stnMemo={};save();setTimeout(()=>toast('🔧 Marrow Cove Crossing is reconnected: its north line now runs into the station'),2500)}}}catch(e){console.error(e)}
// v168: maps are also sold from Scout mode: a '🗺 Buy a map' chip opens the area preview at the linked town nearest the screen centre
function mapChipGo(){const L=mapTowns();if(!L.length){toast('🗺 You already own the map of every linked town and dock');return}const cx=cam.x/TS,cy=cam.y/TS;L.sort((a,b)=>Math.hypot(a.x-cx,a.y-cy)-Math.hypot(b.x-cx,b.y-cy));mapPreview(sites.indexOf(L[0]))}
if(typeof window!=='undefined')window.mapChipGo=mapChipGo;
if(typeof document!=='undefined'&&typeof document.createElement==='function')setInterval(()=>{try{let c=document.getElementById('mapChip');const pn=document.getElementById('panel'),on=mode==='scout'&&!MAPPV&&!SCPV&&!(typeof SCD!=='undefined'&&SCD)&&S.tut>=TUT.length&&!(pn&&pn.style.display==='block');if(!c){if(!on)return;c=document.createElement('button');c.id='mapChip';c.onclick=mapChipGo;c.style.cssText='position:fixed;bottom:92px;right:12px;z-index:25;border:1.5px solid #e9a646;border-radius:20px;padding:8px 14px;background:#2a241bf2;color:#ffd27a;font:700 13px system-ui';document.body.appendChild(c)}c.textContent='🗺 Buy a map · '+fmt(mapCost());c.style.display=on?'block':'none';/* v269: sit above the hint line, never on it */{const hn=document.getElementById('hint'),hr=hn&&hn.textContent&&getComputedStyle(hn).opacity!=='0'&&hn.style.visibility!=='hidden'?hn.getBoundingClientRect():null;c.style.bottom=(hr&&hr.height?Math.max(92,innerHeight-hr.top+8):92)+'px'}}catch(e){}},500);
// v170: docks scout only across water. If a town can walk there, only towns are offered; boats sail only when open sea is in the way
{const o=scoutAt;scoutAt=function(x,y,hi){if(hi!==undefined)return o(x,y,hi);const e=scoutErr(x,y);if(e)return o(x,y);
 const land=sites.filter(q=>scoutOk(q)&&q.type!=='port'&&Math.hypot(q.x-x,q.y-y)<=scR(q)&&!seaBetween(q,x,y)).sort((a,b)=>Math.hypot(a.x-x,a.y-y)-Math.hypot(b.x-x,b.y-y));
 if(!land.length)return o(x,y);if(land.length===1)return o(x,y,sites.indexOf(land[0]));if(S.money<150){toast('Not enough money');return}
 spot={x,y};const el=document.getElementById('panel');el.style.display='block';openShed=null;openFac=null;openInfo=null;el.innerHTML='<b>🧭 Send scouts from which town?</b> $150<br><small style="opacity:.75">They walk there, mapping a strip along the way, then everything around the spot. ⚓ Docks only send boats across open sea</small>'+land.map(q=>'<br>'+ubtn('From '+q.name+' · '+Math.round(Math.hypot(q.x-x,q.y-y))+' tiles',`scoutAt(${x},${y},${sites.indexOf(q)})`)).join('')}}
if(typeof window!=='undefined')window.scoutAt=scoutAt;
// v171: choose the map's place from a list: island chips, then that island's settlements and docks
function mapIsl(o){let k=ISLC[id(o.x,o.y)];if(k>=0)return k;for(let r=1;r<=3;r++)for(let a=-r;a<=r;a++)for(let b=-r;b<=r;b++){const v=ISLC[id(o.x+a,o.y+b)];if(v>=0)return v}return -1}
var MAPPK=null;
function mapPick(k){if(!MAPPV)return;const all=sites.filter(o=>(o.type==='town'||o.type==='port')&&o.linked&&!o.hidden);const isl=[...new Set(all.map(mapIsl))].filter(v=>v>=0);if(k===undefined)k=mapIsl(sites[MAPPV.i]);MAPPK=k;
 const b=document.getElementById('mapBar'),bs='border:0;border-radius:9px;padding:7px 10px;margin:3px;font:inherit;font-weight:700;',own=o=>(S.maps||[]).some(m=>m.x===o.x&&m.y===o.y);
 const L=all.filter(o=>mapIsl(o)===k).sort((a,b)=>(a.type==='port')-(b.type==='port')||(b.pop||0)-(a.pop||0));
 b.innerHTML='📍 <b>Where should the map be centred?</b>'+(isl.length>1?'<div style="margin-top:4px">'+isl.map(v=>'<button onclick="mapPick('+v+')" style="'+bs+(v===k?'background:#e9a646;color:#2a1d0c':'background:#3d3426;color:#f4ead5')+'">🏝 '+((ISLS[v]&&ISLS[v].nm)||'Island')+'</button>').join('')+'</div>':'')
  +'<div style="max-height:34vh;overflow:auto;margin-top:4px">'+L.map(o=>{const h=own(o);return'<button '+(h?'disabled ':'')+'onclick="MAPPK=null;mapPreview('+sites.indexOf(o)+')" style="'+bs+'display:block;width:calc(100% - 6px);text-align:left;background:'+(h?'#2f2a22;color:#8d8576':'#3d3426;color:#f4ead5')+'">'+(o.type==='port'?'⚓ ':'🏘 ')+o.name+' <small style="opacity:.7">'+(o.type==='port'?'dock · sea charts '+mapR(o)+' tiles':(typeof tier==='function'&&o.pop?tier(o.pop)+' · ':'')+mapR(o)+' tiles')+(h?' · ✅ map owned':'')+'</small></button>'}).join('')+'</div>'
  +'<div style="text-align:center"><button onclick="MAPPK=null;mapBar()" style="'+bs+'background:#3d3426;color:#f4ead5">‹ Back</button></div>'}
if(typeof window!=='undefined')window.mapPick=mapPick;
{const o=mapBar;mapBar=function(){if(MAPPK!==null&&MAPPV)return;o();const b=document.getElementById('mapBar');if(!b||!MAPPV)return;const t=[...b.querySelectorAll('button')].find(x=>/^↻ Try/.test(x.textContent));if(t){t.textContent='📍 Choose another place';t.setAttribute('onclick','mapPick()')}}}
// v172: scouting revamp (step 1): tap the fog, see exactly where the scouts start (dotted route), change the start if you like, then Send
var SCPV=null;
function scCands(x,y){const ok=q=>scoutOk(q)&&Math.hypot(q.x-x,q.y-y)<=scR(q);const land=sites.filter(q=>ok(q)&&q.type!=='port'&&!seaBetween(q,x,y));if(land.length)return{sea:0,L:land.sort((a,b)=>Math.hypot(a.x-x,a.y-y)-Math.hypot(b.x-x,b.y-y))};
 return{sea:1,L:sites.filter(q=>ok(q)&&q.type==='port').sort((a,b)=>Math.hypot(a.x-x,a.y-y)-Math.hypot(b.x-x,b.y-y))}}
function scPreview(x,y,hi){const e=scoutErr(x,y);if(e){toast(e);return}const c=scCands(x,y);if(!c.L.length){toast(c.sea?'🌊 Open sea is in the way and scouts can\'t walk on water. '+(S.beacon>=2?'Build a ⚓ Dock near here: boats scout the sea from it':'Docks unlock at Railway level 2'):'No linked town is close enough: link a town nearer this fog');return}
 const h=hi!==undefined&&c.L.includes(sites[hi])?sites[hi]:c.L[0];closePanel();SCPV={x,y,i:sites.indexOf(h),sea:c.sea,n:c.L.length,pick:0};scBar();scFit()}
function scFit(){if(!SCPV)return;const P=[{x:SCPV.x,y:SCPV.y},...scCands(SCPV.x,SCPV.y).L.slice(0,5)],v=viewBox(),top=v.top+140,bot=v.bot-190,w=Math.max(120,W-60),hh=Math.max(120,bot-top);let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9;for(const p of P){x0=Math.min(x0,p.x);x1=Math.max(x1,p.x);y0=Math.min(y0,p.y);y1=Math.max(y1,p.y)}const z=Math.max(.3,Math.min(1.8,Math.min(w/((x1-x0+6)*TS),hh/((y1-y0+6)*TS))));cam.z=Math.min(cam.z,z);cam.x=((x0+x1)/2+.5)*TS;cam.y=((y0+y1)/2+.5)*TS-((top+bot)/2-H/2)/cam.z}
function scBar(){let b=document.getElementById('scBar');if(!SCPV||mode!=='scout'){if(b)b.style.display='none';if(mode!=='scout')SCPV=null;return}
 if(!b){b=document.createElement('div');b.id='scBar';b.style.cssText='position:fixed;bottom:84px;left:10px;right:10px;z-index:31;background:#2a241bf2;border:1.5px solid #e9a646;border-radius:12px;padding:8px 10px;font-size:13px;line-height:1.35;color:#f4ead5';document.body.appendChild(b)}
 const h=sites[SCPV.i],d=Math.round(Math.hypot(h.x-SCPV.x,h.y-SCPV.y)),bs='border:0;border-radius:9px;padding:8px 10px;margin:3px;font:inherit;font-weight:700;';
 if(SCPV.pick){const c=scCands(SCPV.x,SCPV.y);b.innerHTML='🧭 <b>Start the scouts from…</b>'+(c.sea?'<br><small style="opacity:.8">Open sea is in the way, so only docks can send a boat</small>':'')+'<div style="max-height:30vh;overflow:auto">'+c.L.map(o=>'<button onclick="SCPV.i='+sites.indexOf(o)+';SCPV.pick=0;scBar();scFit()" style="'+bs+'display:block;width:calc(100% - 6px);text-align:left;background:'+(o===h?'#e9a646;color:#2a1d0c':'#3d3426;color:#f4ead5')+'">'+(o.type==='port'?'⚓ ':'🏘 ')+o.name+' <small style="opacity:.75">· '+Math.round(Math.hypot(o.x-SCPV.x,o.y-SCPV.y))+' tiles</small></button>').join('')+'</div><div style="text-align:center"><button onclick="SCPV.pick=0;scBar()" style="'+bs+'background:#3d3426;color:#f4ead5">‹ Back</button></div>';b.style.display='block';return}
 b.innerHTML='🧭 <b>Scout here</b><br><small style="opacity:.85">'+(SCPV.sea?'⛵ A boat sails':'🚶 Scouts walk')+' from <b>'+h.name+'</b> ('+d+' tiles) along the bright dotted line, mapping a strip on the way and everything around the spot.'+(SCPV.n>1?' Faint lines are other places they could leave from: tap one of those towns to switch.':'')+' Tap other fog to move the spot.</small><div style="text-align:center;margin-top:4px">'
  +'<button onclick="scSend()" style="'+bs+'background:#e9a646;color:#2a1d0c'+(S.money<150?';opacity:.45':'')+'">✓ Send · $150</button>'+(SCPV.n>1?'<button onclick="SCPV.pick=1;scBar()" style="'+bs+'background:#3d3426;color:#f4ead5">↔ Start elsewhere ('+SCPV.n+')</button>':'')+'<button onclick="SCPV=null;scBar()" style="'+bs+'background:#3d3426;color:#f4ead5">✕</button></div>';b.style.display='block'}
function scSend(){if(!SCPV)return;if(S.money<150){toast('Not enough money');return}const{x,y,i}=SCPV;SCPV=null;scBar();scoutFrom=null;scoutAt(x,y,i)}
if(typeof window!=='undefined'){window.scSend=scSend;window.scBar=scBar;window.scFit=scFit}
if(typeof document!=='undefined'&&typeof document.createElement==='function')setInterval(()=>{try{if(SCPV||document.getElementById('scBar'))scBar()}catch(e){}},700);
{const o=tap;tap=function(x,y){if(mode==='scout'&&!MAPPV&&S.tut>=TUT.length){const w=(S.wrecks||[]).find(w=>w.x===x&&w.y===y);if(w)return o(x,y);
  const ht=sites.find(q=>scoutOk(q)&&Math.abs(q.x-x)<=1&&Math.abs(q.y-y)<=1);
  if(ht){if(SCPV){const c=scCands(SCPV.x,SCPV.y);if(c.L.includes(ht)){SCPV.i=sites.indexOf(ht);SCPV.pick=0;scBar();scFit();return}toast(ht.name+' can\'t reach that spot'+(c.sea?': open sea needs a dock':'')); return}toast('🧭 Tap the dark fog where you want to look. The game shows which town the scouts leave from');return}
  scPreview(x,y);return}return o(x,y)}}
{const o=draw;draw=function(){o.apply(this,arguments);try{if(!SCPV||mode!=='scout'||!ctx)return;const sx=x=>(x+.5)*TS*cam.z-cam.x*cam.z+W/2,sy=y=>(y+.5)*TS*cam.z-cam.y*cam.z+H/2,h=sites[SCPV.i],tm=performance.now();
 const X0=sx(h.x),Y0=sy(h.y),X1=sx(SCPV.x),Y1=sy(SCPV.y);ctx.save();{const AL=SCPV._L&&SCPV._t>tm-1500?SCPV._L:(SCPV._L=scCands(SCPV.x,SCPV.y).L,SCPV._t=tm,SCPV._L);ctx.font='bold 11px system-ui';ctx.textAlign='center';for(const q of AL){if(q===h)continue;const qx=sx(q.x),qy=sy(q.y);ctx.setLineDash([4,7]);ctx.strokeStyle='rgba(205,230,255,.8)';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(qx,qy);ctx.lineTo(X1,Y1);ctx.stroke();ctx.setLineDash([]);ctx.beginPath();ctx.arc(qx,qy,9,0,7);ctx.stroke();const t='↔ '+q.name,tw=ctx.measureText(t).width+12;ctx.fillStyle='#2a241bd0';ctx.fillRect(qx-tw/2,qy-30,tw,18);ctx.fillStyle='#e9d8b4';ctx.fillText(t,qx,qy-17)}}ctx.lineCap='round';ctx.strokeStyle='rgba(0,0,0,.45)';ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(X0,Y0);ctx.lineTo(X1,Y1);ctx.stroke();
 ctx.setLineDash([2,9]);ctx.lineDashOffset=-tm/40;ctx.strokeStyle='#ffd27a';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(X0,Y0);ctx.lineTo(X1,Y1);ctx.stroke();ctx.setLineDash([]);
 ctx.lineWidth=3;ctx.beginPath();ctx.arc(X0,Y0,14*Math.max(.6,cam.z/1.8)+4,0,7);ctx.stroke();ctx.fillStyle='rgba(255,210,122,.16)';ctx.beginPath();ctx.arc(X1,Y1,5*TS*cam.z,0,7);ctx.fill();ctx.setLineDash([6,5]);ctx.stroke();ctx.setLineDash([]);
 ctx.font='bold 12px system-ui';ctx.textAlign='center';const t=(SCPV.sea?'⛵ ':'🚶 ')+'from '+h.name,tw=ctx.measureText(t).width+14;ctx.fillStyle='#2a241be8';ctx.fillRect(X0-tw/2,Y0-34,tw,20);ctx.fillStyle='#ffd27a';ctx.fillText(t,X0,Y0-20);ctx.restore()}catch(e){}}}
// v173 (Sébastien: money piles up, expanding should cost more): growth prices scale with Railway level (+30% per level above 1)
// and with how many of that building you already have (+30% each); upgrades cost double their old base
var XP=()=>1+.3*Math.max(0,(S.beacon||1)-1);const r100=v=>Math.round(v/100)*100;
{const B0={...BUILD};for(const k in B0)Object.defineProperty(BUILD,k,{get(){return r100(B0[k]*XP()*(1+.3*sites.filter(o=>o.type===k).length))},configurable:true})}
{const f0=PRICE.fac;PRICE.fac=ft=>{const c=f0();c.m=ft&&!sites.some(o=>o.type===ft&&!o.gone)?2500:r100(2500+1500*sites.filter(o=>isFac(o)&&!o.gone).length);return c};PRICE.facUp=l=>({m:r100(8000*Math.pow(2,l-1)*XP())});PRICE.ind=s=>({m:r100(6000*Math.pow(2,(s.lvl||1)-1)*XP())})}
{const u0=PORT.up.map(c=>c.m),l0=PORT.land.m;PORT.up.forEach((c,i)=>Object.defineProperty(c,'m',{get(){if(i===0&&!sites.some(o=>o.type==='port'&&!o.gone))return u0[0];return r100(u0[i]*1.5)},configurable:true}));Object.defineProperty(PORT.land,'m',{get(){return l0},configurable:true})}
for(const k in UPG){const c0=UPG[k].c.slice();c0.forEach((v,i)=>Object.defineProperty(UPG[k].c,i,{get(){return r100(v*1.5*XP())},configurable:true}))}
if(typeof FISH!=='undefined')FISH.c.forEach(c=>{const m0=c.m;Object.defineProperty(c,'m',{get(){return r100(m0*1.5*XP())},configurable:true})});
// v174: an island's specialty must be something other regions can't make. Outer islands specialise in their own resource (🧲 iron / 🛢 oil)
{const o=regSpec;regSpec=function(k){if(k!==homeK()&&S.ires&&S.ires[k]){S.rsp=S.rsp||{};return S.rsp[k]=S.ires[k]}return o(k)}}
if(typeof window!=='undefined')window.regSpec=regSpec;
try{if(S.rsp&&S.ires)for(const k in S.rsp){if(+k!==homeK()&&S.ires[k]&&S.rsp[k]!==S.ires[k]){S.rsp[k]=S.ires[k];for(const c in (S.tro||{})){const t=S.tro[c];if(t&&+t.from===+k&&!t.done&&!(t.got>0)){t.k=S.ires[k]}}}}}catch(e){console.error(e)}
// ===== v176 CARGO SHIPS: trains stay on their own island; slow cargo ships with big holds carry goods between docks =====
// A good bound for another island goes maker → dock (by train) → ship → far dock → buyer (by that island's trains).
// Ships are bought at a dock. Upgrades: faster ships, bigger holds, hold types (bulk, tanker, flat, chilled). Reach = the dock's own upgrade.
var SHIPC={spd:{n:'⚡ Faster ships',d:'+35% speed each',c:[6000,12000,24000]},hold:{n:'📦 Bigger holds',d:'more cargo per trip',c:[6000,12000,24000]}};
var SHOLD={bulk:{n:'Bulk holds',g:'⚫🧲',k:['coal','iron'],c:5000},tank:{n:'Tanker holds',g:'🛢⛽',k:['oil','fuel'],c:8000},flat:{n:'Heavy-lift deck',g:'⚙️',k:['steel'],c:6000},cold:{n:'Chilled holds',g:'🐟🦞',k:['fish','shell'],c:4000}};
S.ships=S.ships||[];S.shU=S.shU||{spd:0,hold:0};S.shC=S.shC||{};S.ferT=S.ferT||[];
const shipCap=()=>[80,120,170,240][S.shU.hold||0],shipSpd=()=>.9*(1+.35*(S.shU.spd||0));
const shipCost=()=>3000;
const shUpCost=k=>{const c=SHIPC[k].c[S.shU[k]||0];return c==null?null:r100(c*XP())};
const holdOf=k=>Object.keys(SHOLD).find(c=>SHOLD[c].k.includes(k));
const canShip=k=>{const c=holdOf(k);return!c||!!S.shC[c]};
const pIdx=o=>sites.indexOf(o);
const laneEnds=l=>[sites[l.a],sites[l.b]];
// ships that serve a lane: those based at either of its docks
const laneShips=l=>l.off?0:S.ships.length; // v216: every ship serves every sea route
const portLanes=i=>S.lanes.filter(l=>!l.off&&(l.a===i||l.b===i));
const laneOf=(i,j)=>S.lanes.find(l=>!l.off&&(l.a===i&&l.b===j||l.a===j&&l.b===i));
const sumG=q=>{let n=0;for(const k in q||{})n+=q[k];return n};
// v209: a dock passes goods on to another island when nobody on its own island needs them but an island one more ship hop away does
function seaFwd(E,g,cameFrom){try{const I=islOf(E),e=pIdx(E),need=J=>{const w=sites.reduce((a,T)=>a+(islOf(T)===J&&T.type!=='port'&&stopOk(T)&&accepts(T,g)&&seaNeed(T,g)?roomFor(T,g):0),0);return w>(J===I?pipe(J,g):pipe(J,g))};if(need(I))return null;
 for(const l of portLanes(e)){const f=l.a===e?l.b:l.a,F=sites[f];if(!F||f===cameFrom||!F.linked||!laneShips(l))continue;const J=islOf(F);if(J!==I&&need(J))return f}}catch(err){}return null}
// one-time: old saves had free ferries; give every existing sea route one ship so nothing stops, and long-haul trains become normal trains
if(!S.fx176){S.fx176=1;for(const l of S.lanes)if(sites[l.a]&&sites[l.b]&&!S.ships.some(s=>s.h===l.a||s.h===l.b))S.ships.push({h:l.a,at:l.a,st:'dock',c:{},w:0,p:0});for(const t of S.trains)if(t.lh)delete t.lh}
// goods in the sea pipeline bound for island J: in dock export queues, on ships, and unloaded at J's docks
let PIPE=null,PIPEt=-1;function pipe(J,k){if(PIPEt!==Math.floor(S.t)||!PIPE){PIPE=new Map();PIPEt=Math.floor(S.t);const add=(I,g,n)=>{const key=I+'/'+g;PIPE.set(key,(PIPE.get(key)||0)+n)};
  for(const P of sites){if(P.type!=='port')continue;for(const e in P.ex||{}){const E=sites[e];if(!E)continue;for(const g in P.ex[e])add(islOf(E),g,P.ex[e][g])}for(const g in P.im||{})if(g!==P.cur||true)add(islOf(P),g,P.im[g]||0)}
  for(const s of S.ships)if(s.st==='sail'){const E=sites[s.to];if(E)for(const g in s.c)add(islOf(E),g,s.c[g]);for(const d in s.fw||{}){const F=sites[d];if(F)for(const g in s.fw[d])add(islOf(F),g,s.fw[d][g])}}}
 return PIPE.get(J+'/'+k)||0}
// v212: how badly the dock's island wants a good: 2 = a factory, order or trade order there still has room for it, 1 = someone buys it
const dkNeed=(P,g)=>{const I=islOf(P);let r=0;for(const T of sites){if(T===P||T.type==='port'||islOf(T)!==I||!stopOk(T)||!accepts(T,g))continue;if(seaNeed(T,g)&&roomFor(T,g)>0)return 2;r=1}return r};
// a dock offers one imported good at a time to trains (the one most wanted); its other goods wait in its sheds
function portSync(P,force){P.im=P.im||{};if(P.cur!=null)P.im[P.cur]=Math.max(0,P.stock||0);else if(P.fish>0){P.im[fishK(P)]=Math.max(0,P.stock||0)}
 const busy=P.cur!=null&&(P.stock||0)>=1&&S.trains.some(t=>t.st==='toSrc'&&sites[t.src]===P&&t.k===P.cur);if(busy&&!force)return;
 const I=islOf(P),fk=P.fish>0?fishK(P):null,buyer=g=>sites.some(T=>T!==P&&islOf(T)===I&&stopOk(T)&&accepts(T,g));
 const G=Object.keys(P.im).filter(g=>g!==fk&&P.im[g]>=1).sort((a,b)=>(dkNeed(P,b)-dkNeed(P,a))||(buyer(b)-buyer(a))||P.im[b]-P.im[a]);
 let cur=G.length&&buyer(G[0])?G[0]:fk!=null?fk:G[0]||null;if(cur===P.cur&&!force)return;
 if(cur!==P.cur){P.cur=cur;AUTO.k=''}P.stock=cur!=null?(P.im[cur]||0):0}
{const o=offerOf;offerOf=A=>A&&A.type==='port'&&!A.hidden&&A.cur!=null&&A.im?A.cur:o(A)}
{const o=accepts;accepts=(B,k)=>B&&B.type==='port'?!!(B.linked&&!B.hidden&&k&&k!=='mix'&&k!=='pass'&&portLanes(pIdx(B)).length):o(B,k)}
// an island needs a good when a factory there uses it, a town order wants it, or its capital has a trade order for it
const seaNeed=(T,k)=>isFac(T)||T.type==='town'&&(()=>{const o=ordOf(T);if(o&&o[k]&&((T.got||{})[k]||0)<o[k])return true;const q=S.tro&&S.tro[islOf(T)];return!!(q&&!q.done&&q.k===k&&(T.rcap||T===sites[hubI()]))})();
// shipPlan: a building whose goods nobody on its island needs ships them to its dock when another island needs them
{const o=shipPlan;shipPlan=function(){const m=o();if(m._sea===m)return m;m._sea=m;const L=[];
 // v212: docks are not a dumping ground: a good goes to a dock only when another island needs it (set below), otherwise to a buyer on its own island
 for(const[pi,f]of m){if(f.to==null||f.sea||!sites[f.to]||sites[f.to].type!=='port'||sites[pi].type==='port')continue;const c=(f.alt||[]).find(c=>c.T.type!=='port'&&islOf(c.T)===islOf(sites[pi]));if(c){f.to=c.ti;f.d=c.d}else{f.to=null}f.need=false}

 for(const l of S.lanes){const[A,B]=laneEnds(l);if(!A||!B||!A.linked||!B.linked||!laneShips(l))continue;L.push({D:A,E:B,len:l.p.length},{D:B,E:A,len:l.p.length})}
 if(!L.length)return m;const BF=new Map(),bf=o=>{const i=pIdx(o);if(!BF.has(i))BF.set(i,bfs(id(o.x,o.y)));return BF.get(i)},taken=new Map();
 for(const[pi,f]of m){const P=sites[pi];if(P.type==='port'||f.why.length||f.pin||f.to!=null&&f.need&&f.pr!==false||!canShip(f.k))continue;const I=islOf(P),k=f.k,b=bf(P);let best=null;
  for(const c of L){if(islOf(c.D)!==I||dockFull(c.D))continue;const d0=b.dist[id(c.D.x,c.D.y)];if(!(d0>0))continue;const J=islOf(c.E);if(J===I)continue;const bE=bf(c.E);
   for(const T of sites){if(islOf(T)!==J||!stopOk(T)||!accepts(T,k)||!seaNeed(T,k))continue;const d1=bE.dist[id(T.x,T.y)];if(!(d1>0)||!fuelOk(T))continue;
    const key=J+'/'+k,w=roomFor(T,k)-pipe(J,k)-(taken.get(key)||0);if(w<=0)continue;const d=d0+c.len*3+d1;if(!best||d<best.d)best={d,d0,c,T,key}}}
  if(!best)for(const c of L){if(islOf(c.D)!==I||dockFull(c.D))continue;const d0=b.dist[id(c.D.x,c.D.y)];if(!(d0>0))continue;const J=islOf(c.E);if(J===I)continue;
   for(const c2 of L){if(c2.D!==c.E)continue;const J2=islOf(c2.E);if(J2===I||J2===J)continue;const bE=bf(c2.E);
    for(const T of sites){if(islOf(T)!==J2||!stopOk(T)||!accepts(T,k)||!seaNeed(T,k))continue;const d1=bE.dist[id(T.x,T.y)];if(!(d1>0)||!fuelOk(T))continue;
     const key=J2+'/'+k,w=roomFor(T,k)-pipe(J2,k)-pipe(J,k)-(taken.get(key)||0);if(w<=0)continue;const d=d0+(c.len+c2.len)*3+d1;if(!best||d<best.d)best={d,d0,c,T,key}}}}
  if(best){taken.set(best.key,(taken.get(best.key)||0)+Math.max(10,f.sup));f.to=pIdx(best.c.D);f.d=best.d0;f.need=true;f.via=pIdx(best.c.E);f.fin=pIdx(best.T);f.sea=1}}
 return m}}
{const o=autoWhy;autoWhy=f=>f&&f.sea&&sites[f.fin]?'by ship to '+nm(sites[f.fin])+' on '+islName(islOf(sites[f.fin])):o(f)}
{const o=dispatch;dispatch=function(t){o(t);if(t.route&&sites[t.route.b]&&sites[t.route.b].type==='port'){const f=shipPlan().get(t.route.a);t.via=f&&f.via;t.fin=f&&f.fin}}}
// a train unloading at a dock: the goods join the dock's queue for the ship; the haul pays like factory supply
{const o=deliver;deliver=function(t,here,dist){if(!here||here.type!=='port')return o(t,here,dist);const k=t.k,n=t.cargo;if(!n||!k)return;const i=pIdx(here);let e=t.via;if(e==null||!laneOf(i,e)){const l=portLanes(i)[0];if(!l)return;e=l.a===i?l.b:l.a}
 here.ex=here.ex||{};const q=here.ex[e]=here.ex[e]||{};q[k]=(q[k]||0)+n;const v=Math.round(TYPES[k].rate*DF(dist)*n*PAY*FACP);t.cargo=0;S.money+=v;S.earned=(S.earned||0)+v;led('deliveries',v);t.earn=(t.earn||0)+v;t.trips=(t.trips||0)+1;(t.eh=t.eh||[]).push([Math.round(S.t),v]);if(t.eh.length>12)t.eh.shift();floaty.push({x:here.x,y:here.y,txt:'+'+fmt(v)+' 🚢',a:1})}}
// ---- ships sail ----
function shipTick(dt){for(const s of S.ships){const H=sites[s.h];if(!H)continue;
 if(s.st==='sail'){const l=S.lanes[s.ln];if(!l){s.st='dock';s.at=s.h;continue}const n=l.p.length;s.p+=dt*shipSpd()*s.dir*(typeof lightMul==='function'?lightMul(l.p[Math.max(0,Math.min(n-1,Math.round(s.p)))]):1);if(s.dir>0?s.p>=n-1:s.p<=0){s.p=s.dir>0?n-1:0;s.at=s.to;s.st='dock';s.w=-dockT(shipLoad(s),sites[s.to]);s.arr=S.t;const E=sites[s.at];if(E){if(s.fw){E.ex=E.ex||{};for(const d in s.fw){const q=E.ex[d]=E.ex[d]||{};for(const g in s.fw[d])q[g]=(q[g]||0)+s.fw[d][g]}delete s.fw}E.im=E.im||{};for(const g in s.c){const fw=seaFwd(E,g,s.h===s.at?null:s.h);if(fw!=null){E.ex=E.ex||{};const q=E.ex[fw]=E.ex[fw]||{};q[g]=(q[g]||0)+s.c[g];continue}E.im[g]=(E.im[g]||0)+s.c[g];if(g===E.cur)E.stock=E.im[g]}if(sumG(s.c)>0){S.stats.ship=(S.stats.ship||0)+sumG(s.c);fxShip(E,s.c)}s.c={};portSync(E,!E.cur);AUTO.k=''}}continue}
 if(s.st==='load'){if(!(s.repT>0)&&berthOk(s))s.lt=(s.lt||0)-dt;if(!(s.lt>0)){s.st='sail';s.lt=0}continue}
 if(!berthOk(s))continue;// v245: only as many ships load at once as the dock has berths; the rest wait their turn
 if(sites[s.at]&&sites[s.at].type==='port')s.h=s.at;// v216: ships roam, the dock they are at is their base
 s.w=(s.w||0)+dt;if(s.w<3)continue;const X=sites[s.at],xi=s.at,cap=shipCap();if(!X){s.at=s.h;continue}
 // v216: goods waiting here for dock d also ride to e when e is on the way (the ship drops them at e and they go on from there)
 const viaD=e=>{const r=[],le=laneOf(xi,e);if(!le)return r;for(const d in X.ex||{}){const di=+d;if(di===e||di===xi||!sumG(X.ex[d]))continue;const l2=laneOf(e,di);if(!l2)continue;const ld=laneOf(xi,di);if(ld&&le.p.length+l2.p.length>ld.p.length*1.25)continue;r.push(di)}return r};
 const go=(to,load)=>{const l=laneOf(xi,to);if(!l)return;let room=cap;const take=(q,fwd)=>{const dk=fwd!=null?fwd:to;for(const g of Object.keys(q).sort((a,b)=>(typeof shPri==='function'?shPri(dk,b)-shPri(dk,a):0)||q[b]-q[a])){const m=Math.min(room,Math.floor(q[g]));if(m<=0)continue;X._o=X._o||{};{const kk=fwd!=null?fwd:to;X._o[kk]=(X._o[kk]||0)+m}if(fwd!=null){s.fw=s.fw||{};const w=s.fw[fwd]=s.fw[fwd]||{};w[g]=(w[g]||0)+m}else s.c[g]=(s.c[g]||0)+m;q[g]-=m;if(q[g]<1)delete q[g];room-=m}};
  if(load){take((X.ex||{})[to]||{},null);for(const d of viaD(to))take(X.ex[d],d)}
  s.ln=S.lanes.indexOf(l);s.dir=l.a===xi?1:-1;s.p=l.a===xi?0:l.p.length-1;s.to=to;const ld=cap-room;s.st=ld>0?'load':'sail';s.lt=ld>0?dockT(ld,X):0;s.w=0;AUTO.k=''};
 if(xi!==s.h){const q=(X.ex||{})[s.h];if(s.w<8&&sumG(q)<cap&&S.trains.some(t=>t.st==='toDst'&&sites[t.dst]===X&&t.via===s.h))continue;go(s.h,1);continue}
 {const fw=S.ferT.find(f=>f.ph==='wait'&&f.from!==xi&&S.lanes[f.ln]&&(S.lanes[f.ln].a===xi||S.lanes[f.ln].b===xi)&&!S.ships.some(o=>o!==s&&(o.st==='sail'&&o.to===f.from||o.st==='dock'&&o.at===f.from)));if(fw){go(fw.from,1);continue}}
 {const rz=typeof rushSea==='function'?rushSea(X,xi):null;if(rz!=null){go(rz,1);continue}}// v273: a rushed good waiting here leaves at once
 // at home: sail where the most goods wait (here for there, or there for here); leave when half full or after waiting a while
 let best=null;for(const l of portLanes(xi)){const e=l.a===xi?l.b:l.a,E=sites[e];if(!E)continue;const out=sumG((X.ex||{})[e]),back=sumG((E.ex||{})[xi]),others=S.ships.filter(o=>o!==s&&o.st==='sail'&&o.to===e).length;const v=out+back*.8-others*cap*.5;if(out+back>=1&&(!best||v>best.v))best={e,v,out,back}}
 if(best&&(typeof shipGoNow==='function'?shipGoNow(s,X,xi,best,cap):(best.out>=cap*.5||best.back>=cap*.5||s.w>=20))){go(best.e,1);continue}
 // v216: nothing to carry from here: sail empty to the dock where the most goods (or a train) wait and no other ship is going
 // v270c (Sébastien: ships stuck): with ships queuing behind it, the ship at the berth used to give its turn away before it could ever leave,
 // so a busy dock with small loads froze for good. Now it leaves with what it has, or sails empty to where goods wait, and only gives its turn when neither is possible
 if(s.w>=6&&berthQ(s.at)>0&&best){go(best.e,1);continue}
 if(s.w>=6){let rb=null;for(const P of sites){if(P.type!=='port'||P===X||!P.linked)continue;const p2=pIdx(P);let hop=laneOf(xi,p2)?p2:null;if(hop==null)for(const l of portLanes(xi)){const e=l.a===xi?l.b:l.a;if(sites[e]&&laneOf(e,p2)&&(hop==null||l.p.length<laneOf(xi,hop).p.length))hop=e}if(hop==null)continue;let n=0;for(const e in P.ex||{})n+=sumG(P.ex[e]);if(S.ferT.some(f=>f.ph==='wait'&&f.from===p2))n+=999;if(n<1||S.ships.some(o=>o!==s&&(o.st==='dock'&&o.at===p2||o.st==='sail'&&o.to===p2)))continue;if(!rb||n>rb.n)rb={e:hop,n}}if(rb)go(rb.e,1);else if(berthQ(s.at)>0){s.arr=S.t;s.w=3}}}
 for(const f of S.ferT.slice()){if(f.ph||S.t<f.t0+f.dur)continue;S.ferT.splice(S.ferT.indexOf(f),1);const E=sites[f.to];if(!E)continue;const t=f.t;t.path=[[E.x,E.y]];t.pos=0;t.st='idle';t.wait=1;t.born=Math.round(S.t);S.trains.push(t);toast('🚂 Train '+tNo(t)+' landed at '+nm(E)+': it now works on '+islName(islOf(E)));AUTO.k=''}
 S._psT=(S._psT||0)-dt;if(S._psT<=0){S._psT=1;for(const P of sites)if(P.type==='port'&&(P.im||P.fish>0))portSync(P)}
 // v212: goods piled in a dock that its island can't use move on to a linked island that needs them
 S._fwT=(S._fwT||0)-dt;if(S._fwT<=0){S._fwT=5;for(const P of sites){if(P.type!=='port'||!P.im||!P.linked)continue;if(P.cur!=null)P.im[P.cur]=Math.max(0,P.stock||0);let mv=0;for(const g in P.im){if(P.im[g]<1||P.fish>0&&g===fishK(P))continue;const fw=seaFwd(P,g,null);if(fw==null)continue;const n=Math.min(Math.floor(P.im[g]),40);P.ex=P.ex||{};const q=P.ex[fw]=P.ex[fw]||{};q[g]=(q[g]||0)+n;P.im[g]-=n;mv=1}if(mv){if(P.cur!=null)P.stock=P.im[P.cur]||0;portSync(P,1)}}}}
function fxShip(E,c){try{floaty.push({x:E.x,y:E.y-1,txt:'🚢 '+Object.keys(c).map(g=>TYPES[g].g+c[g]).join(' '),a:1})}catch(e){}}
{const o=tick;tick=function(dt){o(dt);if(typeof awayNow==='function'&&awayNow())return;shipTick(dt)}}
// ---- buying ----
function buyShip(i){const P=sites[i];if(!P||P.type!=='port')return;if(!portLanes(i).length){toast('🚢 This dock has no sea route yet: build a ⚓ landing on another island from it first');return}const c=shipCost();if(S.money<c){toast('A cargo ship costs '+fmt(c));return}
 S.money-=c;S.ships.push({h:i,at:i,st:'dock',c:{},w:0,p:0});AUTO.k='';toast('🚢 Cargo ship bought at '+nm(P)+': it carries goods between its docks');save();refreshPanel()}
function upShip(k){const c=shUpCost(k);if(c==null)return;if(S.money<c){toast('Costs '+fmt(c));return}S.money-=c;S.shU[k]=(S.shU[k]||0)+1;toast(k==='spd'?'⚡ Ships sail faster':'📦 Bigger holds: '+shipCap()+' per ship');save();refreshPanel()}
function buyHold(c){const H=SHOLD[c];if(!H||S.shC[c])return;const m=r100(H.c*XP());if(S.money<m){toast('Costs '+fmt(m));return}S.money-=m;S.shC[c]=1;AUTO.k='';toast('🚢 '+H.n+': ships can now carry '+H.k.map(gname).join(' and '));save();refreshPanel()}
// a train for another island is bought at home and carried over by cargo ship; after landing it stays there
function islDock(k){let best=null;for(const l of S.lanes){if(!laneShips(l))continue;for(const[x,y]of[[l.a,l.b],[l.b,l.a]]){const E=sites[x],F=sites[y];if(!E||!F||!E.linked||islOf(E)!==k||islOf(F)===k)continue;if(!best||l.p.length<best.len)best={to:x,ln:S.lanes.indexOf(l),len:l.p.length}}}return best}
function buyTrainFor(k){if(k===homeK())return autoBuy();const d=islDock(k);if(!d){toast('🚢 '+islName(k)+' needs a dock with a cargo ship first: the ship brings the train over');return}
 if(S.money<COST.train){toast('A train costs '+fmt(COST.train));return}S.money-=COST.train;const t={born:Math.round(S.t),shed:0,w:'freight',st:'idle',wait:1,path:[[0,0]],pos:0,cargo:0,route:null,no:(S.tno=Math.max(S.tno||0,...S.trains.map(x=>x.no||0),...S.ferT.map(f=>f.t.no||0))+1)};
 const dur=Math.round(d.len/shipSpd()+6);S.ferT.push({t,to:d.to,ln:d.ln,t0:S.t,dur});toast('🚢 Train '+t.no+' is on a cargo ship to '+islName(k)+': it lands in about '+dur+' s');save();refreshPanel()}
const tIslNow=t=>{const p=t.path&&t.path.length?t.path[Math.min(t.path.length-1,Math.round(t.pos||0))]:null;return p?ISLC[id(p[0],p[1])]:homeK()};
function islBuyRows(){const IS=shIsles();if(IS.length<2)return'';const M=shipPlan();let h='<div style="margin-top:4px"><small style="opacity:.8">Trains stay on their island. A train for another island sails over on a cargo ship.</small></div>';
 for(const k of IS){const n=S.trains.filter(t=>t.st!=='ferry'&&tIslNow(t)===k).length,fr=idleTrains().filter(t=>tIslNow(t)===k).length,on=S.ferT.filter(f=>sites[f.to]&&islOf(sites[f.to])===k).length+S.trains.filter(t=>t.st==='ferry'&&t.fk===k).length;let wl=0;for(const[pi,f]of M){const P=sites[pi];if(f.to==null||f.why.length||islOf(P)!==k)continue;const c=S.trains.filter(t=>t.route&&t.route.a===pi&&t.st==='toSrc').length;if((P.stock||0)>=20*(c+1))wl++}
  const home=k===homeK(),d=home?1:islDock(k);
  {const chip=(t,col)=>'<span style="display:inline-block;margin:3px 4px 0 0;padding:1px 8px;border-radius:10px;background:'+col+';font-size:12px;font-weight:700">'+t+'</span>';
   const ic=['#3fbf9b','#4fa8f0','#d898e0','#f07a55','#e0c040','#7fd86a'][Math.abs(k|0)%6],edge=home?'#e9a646':ic;
   const bt=(lbl,fn,dis)=>'<button '+(dis?'disabled':'')+' onclick="'+fn+'" style="width:100%;margin:0;padding:8px 6px;border-radius:9px;border:0;background:#2e7d6b;color:#fff;font:inherit;font-weight:700;font-size:13px;box-shadow:0 2px 0 #1b4d42;'+(dis?'opacity:.45':'')+'">'+lbl+'</button>';
   const left=!home&&d?bt('⇄ Free train',`sendSpare(${k})`,!spareHome()):'',right=d?bt('＋ Buy · '+fmt(home?COST.train:islTC()),`buyTrainFor(${k})`,S.money<(home?COST.train:islTC())):'<small style="color:#ffb36b">needs a dock with a 🚢 ship</small>';
   h+='<div style="margin-top:7px;padding:7px 9px;border-radius:10px;background:#2a221a;border-left:5px solid '+edge+'"><b style="font-size:14px">🏝 '+islName(k)+'</b><div>'+chip('🚂 '+n,'#3a3226')+(fr?chip('💤 '+fr+' free','#24414a'):'')+(on?chip('🚢 '+on+' sailing','#22384f'):'')+(wl?chip('📦 '+wl+' waiting','#4a3418'):'')+'</div>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:6px"><div>'+left+'</div><div>'+right+'</div></div></div>'}}
 return h}
// ---- the dock card: ships, sea routes, upgrades ----
function shipBox(s){const i=pIdx(s),ln=portLanes(i);let h='<b>🚢 Cargo ships</b>';
 if(!ln.length)return h+'<br><small style="opacity:.8">No sea route yet. Scout another island\'s coast and build a ⚓ landing there from this dock; then buy a ship here to carry goods across.</small>';
 const mine=S.ships.filter(x=>x.h===i);h+=' <small style="opacity:.8">· slow, big holds · '+shipCap()+' per trip · '+shipSpd().toFixed(1)+' squares/s</small>';
 for(const l of ln){const e=l.a===i?l.b:l.a,E=sites[e];if(!E)continue;const out=sumG((s.ex||{})[e]),back=sumG((E.ex||{})[i]),n=laneShips(l),sail=S.ships.filter(x=>x.st==='sail'&&S.lanes[x.ln]===l);
  h+=`<div style="margin-top:5px">🌊 <b>${nm(E)}</b> <small style="opacity:.8">· ${islName(islOf(E))} · ${l.p.length} sea squares · ≈${Math.round(l.p.length/shipSpd())} s a crossing</small><br><small>`+(n?'🚢 '+n+' ship'+(n>1?'s':'')+(sail.length?' · '+sail.length+' at sea':'')+(out?' · 📦 '+out+' waiting here':'')+(back?' · 📦 '+back+' waiting there':''):'<span style="color:#ffb36b">No ship on this route: goods can\'t cross yet</span>')+'</small></div>'}
 if(s.im){const g=Object.keys(s.im).filter(k=>s.im[k]>=1);if(g.length)h+='<div style="margin-top:4px"><small>📥 Landed here: '+g.map(k=>TYPES[k].g+' '+Math.floor(s.im[k])).join(' · ')+''+(S.trains.some(t=>tIslNow(t)===islOf(s))||S.ferT.some(f=>sites[f.to]&&islOf(sites[f.to])===islOf(s))?'<br><span style="opacity:.75">Trains on '+islName(islOf(s))+' take them on to where they are needed.</span>':'<br><span style="color:#ffb36b">No train works on '+islName(islOf(s))+' yet, so they wait here.</span><br>'+tbtn('🚂 Ship a train over · '+fmt(COST.train),'buyTrainFor('+islOf(s)+')',S.money<COST.train))+'</small></div>'}
 h+='<div style="margin-top:5px">'+tbtn('🚢 Buy a ship here · '+fmt(shipCost()),`buyShip(${i})`,S.money<shipCost())+(S.ships.length?' <small>'+S.ships.length+' ship'+(S.ships.length>1?'s':'')+' sail every route</small>':'')+'</div>';
 h+='<div style="margin-top:6px"><b>⬆ Ship upgrades</b> <small style="opacity:.75">for every ship</small>';for(const k in SHIPC){const l=S.shU[k]||0,c=shUpCost(k);h+=`<div style="margin-top:4px;display:flex;align-items:center;gap:6px;flex-wrap:wrap"><span style="flex:1;min-width:140px">${SHIPC[k].n} <small style="opacity:.8">${l}/3 · ${k==='spd'?shipSpd().toFixed(1)+' squares/s':shipCap()+' per trip'}</small></span>`+(c!=null?tbtn('⬆ '+fmt(c),`upShip('${k}')`,S.money<c):'<small style="color:#7fd36b">max</small>')+'</div>'}
 h+='<div style="margin-top:4px;display:flex;align-items:center;gap:6px;flex-wrap:wrap"><span style="flex:1;min-width:140px">🧭 Sea reach <small style="opacity:.8">'+portR(s)+' squares: how far a landing can be from this dock</small></span><small style="opacity:.75">upgrade the dock below</small></div>';
 h+='<div style="margin-top:6px"><b>🧰 Hold types</b> <small style="opacity:.75">🪵 🌾 🪨 and factory goods need none</small>'+Object.keys(SHOLD).map(c=>{const H=SHOLD[c],m=r100(H.c*XP());return`<div style="margin-top:4px;display:flex;align-items:center;gap:6px"><span style="flex:1">${H.g} <b>${H.n}</b> <small>(${H.k.map(gname).join(', ')})</small></span>`+(S.shC[c]?'<small style="color:#7fd36b">✅</small>':tbtn(fmt(m),`buyHold('${c}')`,S.money<m))+'</div>'}).join('')+'</div></div>';
 return h}
{const o=showPort;showPort=function(s){o(s);try{const el=document.getElementById('panel');if(!el.insertAdjacentHTML)return;const box='<div style="border-top:1px solid #3d3326;margin-top:6px;padding-top:4px">'+shipBox(s)+'</div>';const d=[...el.querySelectorAll('div')].find(x=>/Sea routes/.test(x.textContent)&&!x.querySelector('div'));if(d)d.insertAdjacentHTML('afterend',box);else el.insertAdjacentHTML('beforeend',box)}catch(e){console.error(e)}}}
if(typeof window!=='undefined')Object.assign(window,{buyShip,upShip,buyHold,buyTrainFor,showPort});
// a sea route with no ship: the hint says so
{const o=nextTip;nextTip=function(){const l=S.lanes.find(l=>sites[l.a]&&sites[l.b]&&sites[l.a].linked&&sites[l.b].linked&&!laneShips(l));if(l&&S.ships.length<3){const A=sites[l.a];tipGo=()=>{locateSite(A);showPort(A)};return'🚢 Buy a cargo ship at '+nm(A)+' so goods can cross to '+islName(islOf(sites[l.b]))}return o()}}
// ---- drawing: cargo ships on the sea routes, and trains riding over on one ----
{const o=draw;draw=function(){o();const sx=x=>(x-cam.x)*cam.z+W/2,sy=y=>(y-cam.y)*cam.z+H/2,z=TS*cam.z/32,tm=performance.now()/1000;
 // SMOOTH: ships follow a softened line through the lane squares (average of nearby points) and turn gradually instead of snapping at every square
 const at=(l,p)=>{if(!smoothOn())return at0(l,p);const n=l.p.length,r=Math.min(2.6,p,n-1-p);if(!(r>.05))return at0(l,p);let x=0,y=0,k=0;for(let i=-8;i<=8;i++){const w=9-Math.abs(i),q=at0(l,p+r*i/8);x+=q[0]*w;y+=q[1]*w;k+=w}x/=k;y/=k;const A=at0(l,Math.max(0,p-r*.6)),B=at0(l,Math.min(n-1,p+r*.6));return[x,y,Math.atan2(B[1]-A[1],B[0]-A[0])]};
 const at0=(l,p)=>{const n=l.p.length,a=Math.max(0,Math.min(n-1,Math.floor(p))),b=Math.min(n-1,a+1),f=p-a,A=l.p[a],B=l.p[b];return[((A%N)*(1-f)+(B%N)*f+.5)*TS,(((A/N)|0)*(1-f)+((B/N)|0)*f+.5)*TS,Math.atan2(((B/N)|0)-((A/N)|0),(B%N)-(A%N))]};
 const boat=(X,Y,ang,load,train,gs)=>{if(X<-60||Y<-60||X>W+60||Y>H+60)return;ctx.save();ctx.translate(X,Y+Math.sin(tm*1.6+X*.01)*z*.8);let a=ang;if(Math.cos(a)<0){ctx.scale(-1,1);a=Math.PI-a}ctx.rotate(Math.max(-.5,Math.min(.5,a))*.3);ctx.scale(z,z);
  ctx.fillStyle='rgba(0,0,0,.28)';ctx.beginPath();ctx.ellipse(2,5,19,5,0,0,7);ctx.fill();ctx.fillStyle='rgba(255,255,255,.35)';ctx.beginPath();ctx.ellipse(-20,3,5,2,0,0,7);ctx.fill();
  ctx.fillStyle='#2b3440';ctx.beginPath();ctx.moveTo(-18,-2);ctx.lineTo(18,-2);ctx.lineTo(13,5);ctx.lineTo(-16,5);ctx.closePath();ctx.fill();ctx.fillStyle='#b8352b';ctx.fillRect(-17,2,31,2);
  ctx.fillStyle='#e8dcc0';ctx.fillRect(-15,-7,7,5);ctx.fillStyle='#3a3a3a';ctx.fillRect(-13,-12,3,5);ctx.fillStyle='#c33';ctx.fillRect(-13,-12,3,1.5);
  if(train){ctx.fillStyle='#222';ctx.fillRect(-4,-7,15,5);ctx.fillRect(8,-10,3,3);ctx.fillStyle='#b8352b';ctx.fillRect(-4,-4,15,1.2)}else{const cols=['#c98b3c','#6f8f4e','#8a6a4a','#4f7fa8'];for(let q=0;q<Math.min(4,load);q++){ctx.fillStyle=gs&&gs.length?(GCOL[gs[q%gs.length]]||cols[q%4]):cols[q%4];ctx.fillRect(-6+q*5,-6,4.5,4)}}
  if(train&&cam.z>=.9){ctx.font='9px sans-serif';ctx.textAlign='center';ctx.textBaseline='bottom';ctx.fillStyle='rgba(20,24,30,.6)';ctx.beginPath();ctx.roundRect?ctx.roundRect(-4,-23,14,12,4):ctx.rect(-4,-23,14,12);ctx.fill();ctx.fillText('🚂',3,-11.5)}
  if(gs&&gs.length&&!train&&cam.z>=.9){ctx.font='9px sans-serif';ctx.textAlign='center';ctx.textBaseline='bottom';ctx.fillStyle='rgba(20,24,30,.6)';const w=gs.length*10+4;ctx.beginPath();ctx.roundRect?ctx.roundRect(2-w/2,-20,w,12,4):ctx.rect(2-w/2,-20,w,12);ctx.fill();gs.forEach((g,q)=>{ctx.fillText(TYPES[g]?TYPES[g].g:'📦',2-(gs.length-1)*5+q*10,-8.5)})}
  ctx.restore()};
 for(const s of S.ships){if(s.st==='sail'){const l=S.lanes[s.ln];if(!l)continue;const[x,y,a]=at(l,s.p);boat(sx(x),sy(y),s.dir>0?a:a+Math.PI,Math.ceil(shipLoad(s)/Math.max(1,shipCap())*4),S.ferT.some(f=>f.ph==='sea'&&f.s===s)?1:0,shipGoods(s))}
  else{const P=sites[s.at],l=portLanes(s.at)[0];if(!P||!l)continue;const k=S.ships.filter(o=>o.st!=='sail'&&o.at===s.at).indexOf(s),[x,y]=at(l,l.a===s.at?Math.min(.3+k*.9,l.p.length-1):Math.max(0,l.p.length-1.3-k*.9));boat(sx(x),sy(y),0,0,0)}}
 for(const f of S.ferT){if(f.ph)continue;const l=S.lanes[f.ln];if(!l)continue;const fr=Math.min(1,(S.t-f.t0)/f.dur),fw=l.b===f.to,p=fw?fr*(l.p.length-1):(1-fr)*(l.p.length-1),[x,y,a]=at(l,p);boat(sx(x),sy(y),fw?a:a+Math.PI,0,1)}}}
// ===== v177 BRIDGES BY WATER DEPTH: depth = squares to the nearest land. Each bridge type reaches deeper water and spans further.
// Water 7+ squares from any land is deep ocean: no bridge can cross it, only 🚢 cargo ships.
var BRG=[null,{n:'🪵 Wooden trestle',d:1,span:4,c:2500,lv:1,t:'shallow water by the shore, rivers and ponds'},{n:'🧱 Stone viaduct',d:2,span:8,c:10000,lv:2,t:'channels and wide rivers'},{n:'⚙️ Steel truss',d:4,span:14,c:30000,lv:4,t:'straits between nearby islands'},{n:'🌉 Suspension bridge',d:6,span:24,c:70000,lv:6,t:'wide sounds; the longest bridges anywhere'}];
var BR_MAXD=6,WDc=null;
function wdOf(k){if(!WDc){WDc=new Uint8Array(N*N);const q=[];for(let i=0;i<N*N;i++)if(terr[i]!==0){WDc[i]=0;q.push(i)}else WDc[i]=255;
  // Chebyshev distance (8 neighbours), like the old open-sea rule
  for(let h=0;h<q.length;h++){const i=q[h],x=i%N,y=(i/N)|0;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=N||ny>=N)continue;const j=id(nx,ny);if(WDc[j]===255){WDc[j]=WDc[i]+1;q.push(j)}}}}
 return WDc[k]}
function brLvl(){if(S.brg==null)S.brg=S.tech&&S.tech.trestle?2:0;if(!S.brg&&S.tech&&S.tech.trestle)S.brg=1;return S.brg}
function brOk(k){return terr[k]!==0||wdOf(k)<=(brLvl()?BRG[brLvl()].d:1)}
function brNeed(d){for(let l=1;l<BRG.length;l++)if(BRG[l].d>=d)return l;return 0}
function brErr(k){if(terr[k]!==0)return'';const d=wdOf(k);if(d>BR_MAXD)return'🌊 Deep ocean: too far from land for any bridge. Cross by ⚓ dock and 🚢 cargo ship';const L=brLvl();if(L&&d<=BRG[L].d)return'';const n=brNeed(d);return'🌉 Water '+d+' square'+(d>1?'s':'')+' from land: needs a '+BRG[n].n+' (🔧 Tech)'}
function brMul(k){const d=terr[k]===0?wdOf(k):0;return[1,1,1.4,2,2.6,3.3,4][Math.min(6,d)]||1}
function brKind(w){let d=0;for(const i of w)d=Math.max(d,wdOf(i));const n=brNeed(d);return n?BRG[n].n:'🌉 Bridge'}
// span: water squares joined into one bridge (planned plus existing track over water)
function brSpan(p){const W=new Set(p.filter(i=>terr[i]===0)),seen=new Set();let mx=0;for(const s0 of W){if(seen.has(s0))continue;let n=0;const q=[s0];seen.add(s0);while(q.length){const i=q.pop();n++;for(const d of[1,-1,N,-N]){const j=i+d;if(seen.has(j)||terr[j]!==0||!(W.has(j)||track.has(j)))continue;seen.add(j);q.push(j)}}mx=Math.max(mx,n)}return mx}
{const o=showRoute;showRoute=function(p,site,join){o(p,site,join);try{const L=brLvl(),sp=brSpan(p);if(!sp)return;const cap=L?BRG[L].span:0;if(sp<=cap)return;let md=0;for(const i of p)if(terr[i]===0)md=Math.max(md,wdOf(i));const n1=BRG.findIndex((b,l)=>l>0&&b.span>=sp),n2=md>BR_MAXD?-1:brNeed(md),nx=n1<0||n2<0?-1:Math.max(n1,n2);
 document.getElementById('cfTxt').insertAdjacentHTML('beforeend','<br><span style="color:#ff9a8a">🌉 This bridge spans '+sp+' squares of water; your '+(L?BRG[L].n+' reaches '+cap:'railway has no bridges yet')+'.'+(nx>0?' A '+BRG[nx].n+' can do it (🔧 Tech).':' Too long for any bridge: use a ⚓ dock and 🚢 ships.')+'</span>');
 const b=document.getElementById('cfOk');b.disabled=true;b.style.opacity=.4}catch(e){console.error(e)}}}
{const o=liveConfirm;liveConfirm=function(){if(typeof routePlan!=='undefined'&&routePlan&&!dblPlan&&!trainPlan&&!placePlan&&!surveyPlan&&brSpan(routePlan.p)>(brLvl()?BRG[brLvl()].span:0))return;o()}}
function buyBridge(){const L=brLvl(),B=BRG[L+1];if(!B)return;if(S.beacon<B.lv){toast('🔒 Needs Railway level '+B.lv);return}if(S.money<B.c){toast('Costs '+fmt(B.c));return}S.money-=B.c;S.brg=L+1;S.tech.trestle=1;toast(B.n+': track can now cross water up to '+B.d+' squares from land, '+B.span+' squares long');save();showTech()}
function brHtml(){const L=brLvl();let h='<b>🌉 Bridges</b> <small style="opacity:.75">each kind reaches deeper water and spans further</small>';
 for(let l=1;l<BRG.length;l++){const B=BRG[l],own=l<=L;h+=`<div style="margin-top:5px;display:flex;align-items:center;gap:6px;flex-wrap:wrap"><span style="flex:1;min-width:160px">${own?'✅ ':''}<b>${B.n}</b><br><small style="opacity:.8">${B.t} · up to ${B.d} square${B.d>1?'s':''} from land · spans ${B.span}</small></span>`+(own?'':l===L+1?(S.beacon<B.lv?'<small style="color:#ffb36b">🔒 Railway level '+B.lv+'</small>':tbtn('Build · '+fmt(B.c),'buyBridge()',S.money<B.c)):'<small style="opacity:.6">🔒</small>')+'</div>'}
 return h+'<div style="margin-top:5px"><small style="opacity:.75">🌊 Water more than '+BR_MAXD+' squares from land is deep ocean: no bridge can cross it. Islands out there are reached by ⚓ dock and 🚢 cargo ship.</small></div>'}
showTech=function(){const el=document.getElementById('panel');el.style.display='block';PANEL={n:'showTech',a:[]};
 el.innerHTML='<b style="font-size:15px">🔧 Tech</b><div style="border-top:1px solid #3d3326;margin-top:6px;padding-top:4px">'+brHtml()+'</div><div style="border-top:1px solid #3d3326;margin-top:6px;padding-top:4px"><small style="opacity:.75">Bigger inventions come from Ashford landmarks (tap Ashford):</small><br>'+['foundry','viaduct','works'].map(k=>((S.lm||{})[k]?'✅ ':'🔒 ')+LM[k].n+' <small style="opacity:.7">· '+LM[k].d+((S.lm||{})[k]?'':' · Railway level '+LM[k].lvl)+'</small>').join('<br>')+'</div><br>'+ubtn('📋 Game report (copy & share)','showReport()')+'<br>'+ubtn('💾 Move my game to another app or phone','showMove()')};
if(typeof window!=='undefined')Object.assign(window,{showTech,buyBridge});
// in the bridge drawing, the type follows the deepest water under that crossing
var BRC=null,BRCk='';function brComp(k){const key=track.size+'';if(BRCk!==key){BRC=new Map();BRCk=key}if(BRC.has(k))return BRC.get(k);const q=[k],seen=new Set([k]);let m=0;while(q.length){const i=q.pop();m=Math.max(m,wdOf(i));for(const d of[1,-1,N,-N]){const j=i+d;if(!seen.has(j)&&terr[j]===0&&track.has(j)){seen.add(j);q.push(j)}}}for(const i of seen)BRC.set(i,m);return m}
var brSty=(k,dbl,run)=>{const d=brComp(k);return d>=5?'susp':d>=3?'truss':d>=2||dbl?'stone':run>=4?'truss':'wood'};
// ===== v181: track may turn out of a station's END square sideways (Sébastien: "turns of that shape are seen elsewhere").
// A town whose station ends on the town square (nothing beyond on the line) may take one track from the side of that square.
// The station stays on the town square, keeps its line's direction, and its platforms curve out to that side.
function endSideOk(t,x,y){if(!t||t.type!=='town'||t.hidden)return false;const dx=x-t.x,dy=y-t.y;if(Math.abs(dx)+Math.abs(dy)!==1)return false;if(t.sx)return t.sx[0]===dx&&t.sx[1]===dy;
 const nb=D4.filter(([a,b])=>track.has(id(t.x+a,t.y+b)));if(nb.length!==1)return false;const a=nb[0];if(a[0]*dx+a[1]*dy!==0)return false;// the side is across the line, not along it
 return!track.has(id(t.x-a[0],t.y-a[1]))}
{const f=stnTile;stnTile=function(o){if(o&&o.type==='town'&&o.sx){if(track.has(id(o.x+o.sx[0],o.y+o.sx[1]))){const a=D4.find(([p,q])=>p*o.sx[0]+q*o.sx[1]===0&&track.has(id(o.x+p,o.y+q)));if(a){const ex=o.x-a[0],ey=o.y-a[1];
 // v183b: an offset station (no free land beyond the town square) keeps its place on the track square. Never touch the track set here: draw loops iterate it
 if(!(landTile(ex,ey)&&!isRail(ex,ey)))return{x:o.x+a[0],y:o.y+a[1],hz:a[1]===0,st:true};return{x:o.x,y:o.y,hz:a[1]===0}}}else delete o.sx}return f(o)}}
{const f=stnSide;stnSide=function(x,y){const m=f(x,y);if(!m)return m;for(const t of sites)if(t.type==='town'&&Math.abs(t.x-x)+Math.abs(t.y-y)===1&&endSideOk(t,x,y))return'';return m}}
{const f=stnEntryOk;stnEntryOk=function(x,y,from){if(f(x,y,from))return true;const o=siteAt(x,y);return!!o&&from>=0&&endSideOk(o,from%N,(from/N)|0)}}
{const f=lay;lay=function(x,y,free){const T=sites.filter(t=>t.type==='town'&&!t.sx&&Math.abs(t.x-x)+Math.abs(t.y-y)===1&&endSideOk(t,x,y));const r=f(x,y,free);if(r&&track.has(id(x,y)))for(const t of T)t.sx=[x-t.x,y-t.y];return r}}
// the platforms' end on that side: stop a little short of the square's centre and curve both lanes out to the side square
{const f=stnExt;stnExt=function(p,hz,Lt){const out=f(p,hz,Lt);const ax=hz?[1,0]:[0,1];let t=siteAt(p.x,p.y),k=0;if(!(t&&t.type==='town'&&t.sx&&t.x===p.x&&t.y===p.y)){t=null;for(const s of[-1,1]){const q=siteAt(p.x+s*ax[0],p.y+s*ax[1]);if(q&&q.type==='town'&&q.sx&&(q.sx[0]*ax[0]+q.sx[1]*ax[1])===0){t=q;k=s;break}}}
 if(t&&track.has(id(t.x+t.sx[0],t.y+t.sx[1]))){const e=k||(track.has(id(p.x-ax[0],p.y-ax[1]))?1:-1);out[e<0?0:1]=k?TS-6:-6;out[e<0?2:3]=false;out.side={e,ly:hz?t.sx[1]:-t.sx[0],k}}return out}}
// ===== v181: show where track can't go. In track mode, squares near your network that track can't use get a red tint and a sign
// (🌉 needs a bridge · 🌊 deep ocean · ⛰ mountains · 🚉 station side · 🌫 fog), and a refused square flashes with its reason in the hint bar.
var NOGO={k:'',m:null},REJ=null;
function nogoIcon(e){return/Deep ocean/.test(e)?'🌊':/bridge|trestle|viaduct|truss|Suspension|Water/i.test(e)?'🌉':/Mountain/.test(e)?'⛰':/station/.test(e)?'🚉':/Scout/.test(e)?'🌫':/engine shed/i.test(e)?'🏚':'⛔'}
function nogoMap(x0,y0,x1,y1){const k=[track.size,sites.length,S.brg|0,(S.lm||{}).foundry?1:0,x0,y0,x1,y1,railSel.length].join('/');if(NOGO.k===k)return NOGO.m;const near=new Uint8Array((x1-x0+1)*(y1-y0+1)),W=x1-x0+1,R=6;
 const mark=(cx,cy)=>{for(let y=Math.max(y0,cy-R);y<=Math.min(y1,cy+R);y++)for(let x=Math.max(x0,cx-R);x<=Math.min(x1,cx+R);x++)near[(y-y0)*W+x-x0]=1};
 for(const i of track){const x=i%N,y=(i/N)|0;if(x>=x0-R&&x<=x1+R&&y>=y0-R&&y<=y1+R)mark(x,y)}for(const i of railSel)mark(i%N,(i/N)|0);for(const o of sites)if(o.linked&&o.x>=x0-R&&o.x<=x1+R&&o.y>=y0-R&&o.y<=y1+R)mark(o.x,o.y);
 const m=[];for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){if(!near[(y-y0)*W+x-x0])continue;const i=id(x,y);if(track.has(i)||siteAt(x,y)||!rev[i])continue;const e=railErr(x,y);if(e)m.push([x,y,nogoIcon(e)])}
 NOGO={k,m};return m}
{const o=draw;draw=function(){o();if(mode!=='rail'||railDbl)return;const sx=x=>(x-cam.x)*cam.z+W/2,sy=y=>(y-cam.y)*cam.z+H/2,s=TS*cam.z;
 const x0=Math.max(1,Math.floor((cam.x-W/2/cam.z)/TS)),x1=Math.min(N-2,Math.ceil((cam.x+W/2/cam.z)/TS)),y0=Math.max(1,Math.floor((cam.y-H/2/cam.z)/TS)),y1=Math.min(N-2,Math.ceil((cam.y+H/2/cam.z)/TS));if((x1-x0)*(y1-y0)>9000)return;
 const L=nogoMap(x0,y0,x1,y1);ctx.save();ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=Math.round(s*.34)+'px system-ui';
 for(const[x,y,g]of L){const X=sx(x*TS),Y=sy(y*TS);ctx.fillStyle='rgba(200,40,30,.16)';ctx.fillRect(X+1,Y+1,s-2,s-2);ctx.strokeStyle='rgba(230,70,50,.35)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(X+s*.2,Y+s*.2);ctx.lineTo(X+s*.8,Y+s*.8);ctx.stroke();if(s>=22){ctx.globalAlpha=.75;ctx.fillText(g,X+s*.5,Y+s*.5);ctx.globalAlpha=1}}
 if(REJ){const a=1-(performance.now()-REJ.t)/1800;if(a<=0)REJ=null;else{const X=sx(REJ.x*TS),Y=sy(REJ.y*TS);ctx.strokeStyle=`rgba(255,80,60,${a})`;ctx.lineWidth=3;ctx.strokeRect(X+2,Y+2,s-4,s-4);ctx.beginPath();ctx.moveTo(X+s*.25,Y+s*.25);ctx.lineTo(X+s*.75,Y+s*.75);ctx.moveTo(X+s*.75,Y+s*.25);ctx.lineTo(X+s*.25,Y+s*.75);ctx.stroke()}}
 ctx.restore()}}
{const o=paintTile;paintTile=function(x,y){if(!railDbl){const e=railErr(x,y);if(e){REJ={x,y,t:performance.now()};const h=document.getElementById('hint');if(h){h.textContent='⛔ '+e;h.style.opacity='1';clearTimeout(window._rejT);window._rejT=setTimeout(()=>{if(mode==='rail')h.textContent=hints.rail},3500)}}}return o(x,y)}}
{const o=railTap;railTap=function(x,y){const e=railDbl?'':railErr(x,y);if(e)REJ={x,y,t:performance.now()};return o(x,y)}}
// ===== v183: maps go where you tap. The bar counts the hidden places inside the circle before you pay,
// a map marks every hidden town, building spot and landmark inside it with ?, and buying says what it found.
function mapFinds(x,y,r){const L=sites.concat(POIS.map((p,j)=>(p.type='poi',p.j=j,p)));return L.filter(s=>{if(s.type==='poi'){if((S.poi||{})[s.j]||rev[id(s.x,s.y)])return false}else if(s.hidden||s.seen||rev[id(s.x,s.y)]||!(s.type==='town'||s.type==='plot'))return false;return Math.hypot(s.x-x,s.y-y)<=r})}
const mapNew=v=>mapFinds(v.x,v.y,v.r).filter(s=>!mapped(s.x,s.y));
function mapDir(s){let b=null,bd=1e9;for(const o of sites)if(o.linked&&o.type!=='dep'&&o.name&&!o.hidden){const d=Math.hypot(o.x-s.x,o.y-s.y);if(d<bd){bd=d;b=o}}if(!b){s._dir='';return}const a=Math.atan2(s.y-b.y,s.x-b.x),D=['E','SE','S','SW','W','NW','N','NE'][((Math.round(a/(Math.PI/4))%8)+8)%8];s._dir=Math.round(bd)+' tiles '+D+' of '+b.name}
{const o=hintTick;hintTick=function(){o();const have=new Set(HINTS);for(const m of S.maps||[])for(const s of mapFinds(m.x,m.y,m.r))if(!have.has(s)){have.add(s);if(s._dir===undefined)mapDir(s);HINTS.push(s)}}}
const mapLinked=()=>sites.filter(o=>(o.type==='town'||o.type==='port')&&o.linked&&!o.hidden);
function mapNear(x,y){let b=null,bd=1e9;for(const o of mapLinked()){const d=Math.hypot(o.x-x,o.y-y);if(d<bd){bd=d;b=o}}return{o:b,d:bd}}
const MAPFAR=40;
function mapErrAt(x,y){if(x<0||y<0||x>=N||y>=N)return'Off the edge of the world';const n=mapNear(x,y);if(!n.o)return'Link a town first';if(n.d>MAPFAR)return'🗺 Too far from your railway: centre the map within '+MAPFAR+' tiles of a linked town or dock';return''}
const mapRAt=(x,y)=>terr[id(x,y)]===0?60:MAPR;
function mapAt(x,y,fit){const e=mapErrAt(x,y);if(e){toast(e);return}const n=mapNear(x,y);MAPPK=null;MAPPV={x,y,r:mapRAt(x,y),i:sites.indexOf(n.o)};
 if(fit){closePanel();if(mode!=='pan'&&mode!=='scout'){const pb=document.querySelector('[data-m=pan]');if(pb)pb.click()}const v=viewBox(),h=Math.max(120,v.bot-v.top-170),w=Math.max(120,v.right-v.left-20),r=MAPPV.r;cam.z=Math.max(.12,Math.min(1.4,Math.min(w,h)/((2*r+2)*TS)));cam.x=(x+.5)*TS-((v.left+v.right)/2-W/2)/cam.z;cam.y=(y+.5)*TS-((v.top+v.bot-170)/2-H/2)/cam.z}mapBar()}
function mapBest(){if(!MAPPV)return;let b=null;for(let y=4;y<N;y+=6)for(let x=4;x<N;x+=6){if(mapErrAt(x,y))continue;const v={x,y,r:mapRAt(x,y)},n=mapNew(v).length,d=Math.hypot(x-MAPPV.x,y-MAPPV.y);if(n&&(!b||n>b.n||n===b.n&&d<b.d))b={x,y,n,d}}if(!b){toast('🗺 Nothing hidden is left near your railway. Reach further first (track, ⚓ docks), then map again');return}mapAt(b.x,b.y,1)}
mapPreview=function(i){const o=sites[i];if(!o)return;mapAt(o.x,o.y,1)};
mapBar=function(){let b=document.getElementById('mapBar');if(!MAPPV){if(b)b.style.display='none';return}
 if(!b){b=document.createElement('div');b.id='mapBar';b.style.cssText='position:fixed;bottom:84px;left:10px;right:10px;z-index:30;background:#2a241bf2;border:1.5px solid #e9a646;border-radius:12px;padding:8px 10px;font-size:13px;line-height:1.35;color:#f4ead5';document.body.appendChild(b)}
 const c=mapCost(),n=mapNew(MAPPV).length,near=sites[MAPPV.i],bs='border:0;border-radius:9px;padding:8px 10px;margin:3px;font:inherit;font-weight:700;',sea=MAPPV.r>MAPR;
 b.innerHTML='🗺 <b>Map of this circle</b> <small style="opacity:.8">('+MAPPV.r+' tiles'+(sea?', a sea chart reaches further':'')+(near?' · near '+near.name:'')+')</small><br>'
  +'<b style="color:'+(n>=6?'#ffd27a':n>=2?'#f4ead5':'#c9b99a')+'">💬 Travellers say: '+(n>=6?'lots of rumours out there':n>=2?'a few rumours':'quiet around here')+'</b> <small style="opacity:.85">The map marks what it finds with ?. If it finds nothing, you get half your money back.</small>'
  +'<br><small style="opacity:.75">👆 Tap anywhere on the map to move the circle.</small><div style="text-align:center;margin-top:4px">'
  +'<button onclick="mapBuyHere()" '+(S.money>=c?'':'disabled ')+'style="'+bs+'background:#e9a646;color:#2a1d0c'+(S.money>=c?'':';opacity:.45')+'">✓ Buy · '+fmt(c)+'</button>'
  
  +'<button onclick="mapCancel()" style="'+bs+'background:#3d3426;color:#f4ead5">✕</button></div>';b.style.display='block'};
function mapBuyHere(){if(!MAPPV)return;const c=mapCost();if(S.money<c){toast('A map costs '+fmt(c));return}const v=MAPPV,F=mapNew(v);
 S.money-=c;if(!F.length){const h=Math.round(c/2);S.money+=h;(S.maps=S.maps||[]).push({x:v.x,y:v.y,r:v.r});MAPPV=null;mapBar();save();notice('<div style="text-align:center"><b style="color:#ffd27a;font-size:17px">🗺 Nothing was found in this area</b><br>No hidden towns, building spots or landmarks inside the circle.<br><small style="opacity:.8">Half the price ('+fmt(h)+') is refunded. Try another area.</small></div>');return}
(S.maps=S.maps||[]).push({x:v.x,y:v.y,r:v.r});MAPPV=null;mapBar();hintTick();save();
 const lab=s=>s.type==='town'?'🏘 a hidden town':s.type==='poi'?'✨ a landmark':'📍 a place to build';
 F.forEach(s=>{if(s._dir===undefined||!s._dir)mapDir(s)});F.sort((a,b)=>(b.type==='town')-(a.type==='town'));
 notice('<div style="text-align:center"><b style="color:#ffd27a;font-size:17px">🗺 The map shows '+F.length+' find'+(F.length>1?'s':'')+'</b></div><div style="margin-top:6px;line-height:1.5">'+F.slice(0,8).map(s=>lab(s)+(s._dir?' <small style="opacity:.75">· '+s._dir+'</small>':'')).join('<br>')+(F.length>8?'<br><small>…and '+(F.length-8)+' more</small>':'')+'</div><small style="opacity:.8;display:block;margin-top:6px">Each one is a glowing ? on the map. Scout it (🧭) to see what it is.</small>')}
if(typeof window!=='undefined'){window.mapBuyHere=mapBuyHere;window.mapBest=mapBest;window.mapPreview=mapPreview;window.buyMap=buyMap=function(i){mapPreview(i)}}
{const o=tap;tap=function(x,y){if(MAPPV){const e=mapErrAt(x,y);if(e){toast(e);return}mapAt(x,y,0);return}return o(x,y)}}
// ===== v187: the first time you see a new island's coast, a card explains how to connect it:
// a ⚓ dock on your coast, a ⚓ landing on the new island, then a 🚢 cargo ship on that sea route (trains can't cross open sea)
function islFoundCard(k){const I=islName(k),P=ports().filter(o=>o.linked),hasDock=P.length>0;
 notice('<div style="text-align:center"><b style="color:#ffd27a;font-size:17px">🏝 You found '+I+'!</b></div><div style="margin-top:6px">Trains can\'t cross open sea (a 🌉 bridge works only over shallow water), so connecting it takes three steps:</div>'
  +'<div style="margin-top:6px;line-height:1.55">'+(hasDock?'✅':'1️⃣')+' A <b>⚓ Dock</b> on your coast'+(hasDock?' <small style="opacity:.75">(you have one at '+nm(P[0])+')</small>':' <small style="opacity:.75">(🏗 Build → ⚓ Dock)</small>')
  +'<br>2️⃣ A <b>⚓ landing</b> on '+I+'\'s coast, within your dock\'s reach <small style="opacity:.75">(🏗 Build → ⚓ Dock, then tap its glowing shore)</small>'
  +'<br>3️⃣ A <b>🚢 cargo ship</b> on that new sea route <small style="opacity:.75">(tap your dock → Sea routes → Buy)</small>. Without a ship, nothing crosses.<br>4️⃣ A <b>🚂 train for '+I+'</b>: trains can\'t cross the sea, so the ship carries one over <small style="opacity:.75">(tap any building there → Buy a train)</small></div>'
  +'<small style="opacity:.8;display:block;margin-top:6px">Then lay track on '+I+' from its landing. Its trains are bought for that island and shipped over.</small>')}
setInterval(()=>{try{if(typeof document==='undefined'||!S||S.tut<TUT.length||awayNow())return;const home=homeIsl();
 if(!S.islSeen){S.islSeen=[home].concat(S.isl||[]);let best=null;for(let k=0;k<ISLS.length;k++){if(S.islSeen.includes(k)||!ISLS[k]||!ISLS[k].nm)continue;if(islCoast(k).some(([x,y])=>rev[id(x,y)])){S.islSeen.push(k);if(!ports().some(p=>p.linked&&islOf(p)===k)&&best==null)best=k}}if(best!=null)islFoundCard(best);return}
 for(let k=0;k<ISLS.length;k++){if(S.islSeen.includes(k)||!ISLS[k]||!ISLS[k].nm)continue;if(islCoast(k).some(([x,y])=>rev[id(x,y)])){S.islSeen.push(k);save();islFoundCard(k);break}}}catch(e){}},2000);
// ===== v188: when several towns wait on a factory good nobody makes, say so first and point at the factory to build
function facGap(){const W={};for(const t of sites){if(t.type!=='town'||!t.linked||t.hidden)continue;const o=ordOf(t);if(!o)continue;for(const g in o)if(((t.got||{})[g]||0)<o[g])(W[g]=W[g]||[]).push(t)}
 let best=null;for(const k in FAC){const f=FAC[k],g=f.out,T=W[g]||[];if(T.length<2)continue;if(sites.some(o=>o.type===k&&o.linked))continue;
  const ins=Object.keys(f.in),miss=ins.filter(r=>!sites.some(o=>o.linked&&!isFac(o)&&offerOf(o)===r));if(!best||T.length>best.T.length)best={k,g,T,miss}}return best}
{const o=nextTip;nextTip=function(){try{const b=facGap();if(b){const G=GOOD[b.g].toLowerCase(),F=TYPES[b.k].n,n=b.T.length;
 if(!b.miss.length){tipGo=()=>{document.querySelector('[data-m=build]').click();pickBuild(b.k)};return'🏭 '+n+' towns are waiting on '+TYPES[b.g].g+' '+G+' and nobody makes them: build a '+F+' next to your '+b.miss.concat(Object.keys(FAC[b.k].in)).map(r=>GOOD[r].toLowerCase()).filter((v,i,a)=>a.indexOf(v)===i).join(' and ')+' supply'}
 else{const r=b.miss[0];if(IRES.includes(r)){const LI=new Set(ports().filter(o=>o.linked&&!o.gone).map(islOf)),D=sites.find(o=>o.type==='dep'&&!o.gone&&!o.hidden&&o.res===r&&LI.has(islOf(o))&&islOf(o)!==homeK());if(D){const K=Object.keys(TYPES).find(k=>offerOf({type:k})===r&&BUILD[k]!=null)||r;tipGo=()=>{locateSite(D);document.querySelector('[data-m=build]').click();pickBuild(K)};return'🏭 '+n+' towns are waiting on '+TYPES[b.g].g+' '+G+'. '+islName(islOf(D))+' has '+GOOD[r].toLowerCase()+': build '+art9(TYPES[K].n)+' there, link it to the landing, and a '+F+' at home'}tipGo=()=>{document.querySelector('[data-m=build]').click();pickBuild('port')};return'🏭 '+n+' towns are waiting on '+TYPES[b.g].g+' '+G+'. A '+F+' needs '+GOOD[r].toLowerCase()+', which only other islands have: '+(ports().some(o=>o.linked)?'link an island that has it':'build a ⚓ Dock')}const K=Object.keys(TYPES).find(k=>offerOf({type:k})===r&&BUILD[k]!=null)||r;tipGo=()=>{document.querySelector('[data-m=build]').click();pickBuild(K)};return'🏭 '+n+' towns are waiting on '+TYPES[b.g].g+' '+G+'. A '+F+' needs '+GOOD[r].toLowerCase()+': build '+art9(TYPES[K]?TYPES[K].n:GOOD[r])+' first, then the '+F}
 }}catch(e){}return o()}}

// v190: repair sea routes whose dock numbers shifted when a building was removed (pre-v190 removal spliced the site list)
try{if(S.lanes&&S.lanes.length){const P=()=>sites.filter(o=>o.type==='port'&&!o.hidden);const near=k=>{const x=k%N,y=(k/N)|0;let b=null,bd=1e9;for(const o of P()){const d=Math.hypot(o.x-x,o.y-y);if(d<bd){bd=d;b=o}}return b};let fixed=0;
 for(const l of S.lanes){const A=sites[l.a],B=sites[l.b];if(A&&B&&A.type==='port'&&B.type==='port')continue;if(!l.p||!l.p.length)continue;const a=near(l.p[0]),b=near(l.p[l.p.length-1]);if(a&&b&&a!==b){l.a=sites.indexOf(a);l.b=sites.indexOf(b);fixed++}}
 if(fixed){for(const sh of S.ships||[]){const l=S.lanes[sh.ln]||S.lanes.find(l=>l.a===sh.h||l.b===sh.h)||S.lanes[0];const H=sites[sh.h];if(!H||H.type!=='port'){sh.h=l.a;sh.at=l.a;sh.st='dock';sh.p=0;sh.c={};sh.w=0}else if(sites[sh.at]&&sites[sh.at].type!=='port'){sh.at=sh.h;sh.st='dock';sh.p=0}}
  for(const o of sites)if(o.type==='port'&&o.ex)o.ex={};for(const t of S.trains){t.via=null;t.fin=null}try{computeNet()}catch(e){}save();setTimeout(()=>toast('🔧 Sea route repaired: it had lost track of its docks when a building was removed'),2500)}}}catch(e){console.error(e)}
// v190: a dock right at a station's end: the platforms run on into the dock instead of stopping at buffers
{const f=stnExt;stnExt=function(p,hz,Lt){const out=f(p,hz,Lt);try{const ax=hz?[1,0]:[0,1];for(const e of[-1,1]){if(out.side&&out.side.e===e)continue;for(const k of[1,2]){const q=siteAt(p.x+e*k*ax[0],p.y+e*k*ax[1]);if(q&&q.type==='port'&&!track.has(id(q.x,q.y))){if(k===2){const m=siteAt(p.x+e*ax[0],p.y+e*ax[1]);if(!m||m.type!=='town')break}out[e<0?0:1]=(k-.5)*TS-14;out[e<0?2:3]=false;break}if(k===1&&track.has(id(p.x+e*ax[0],p.y+e*ax[1])))break}}}catch(err){}return out}}
// ===== v191: trains don't cross the sea on their own. Any building on an island with no trains says so, with the fix right there.
function islTrainsN(k){return S.trains.filter(t=>t.st!=='ferry'&&tIslNow(t)===k||t.st==='ferry'&&t.fk===k).length+(S.ferT||[]).filter(f=>sites[f.to]&&islOf(sites[f.to])===k).length}
function noTrainBox(o){if(!o||!o.linked||o.hidden)return'';const k=islOf(o);if(k==null||k<0||k===homeK()||islTrainsN(k)>0)return'';const I=islName(k),d=islDock(k);
 if(d){const dur=Math.round(d.len/shipSpd()+6);return banner(C9.warn,'🚂 No trains on '+I+' yet')+'<small style="opacity:.85">Trains cross the sea on your cargo ship (about '+dur+' s at sea), then run themselves here.</small>'+islTrainOpts(k)}
 const P=ports().find(p=>p.linked&&islOf(p)===k),L=P&&S.lanes.find(l=>l.a===sites.indexOf(P)||l.b===sites.indexOf(P)),H=L?sites[L.a===sites.indexOf(P)?L.b:L.a]:null;
 return banner(C9.warn,'🚂 No trains on '+I+' yet')+'<small style="opacity:.85">Trains can\'t cross the sea: they sail over on a 🚢 cargo ship. First buy a ship for this sea route'+(H?' at '+nm(H):'')+', then buy a train for '+I+'.</small>'+(H?'<div>'+tbtn('⚓ Go to '+nm(H)+' to buy a ship','locateSite(sites['+sites.indexOf(H)+']);showInfo(sites['+sites.indexOf(H)+'])',false)+'</div>':'')}
if(typeof window!=='undefined')for(const nm2 of['showInfo','showFactory']){const o=window[nm2];window[nm2]=function(a){const r=o.apply(this,arguments);try{const s=typeof a==='number'?sites[a]:a;const el=document.getElementById('panel');const h=noTrainBox(s);if(h&&el.style.display==='block'&&!el.innerHTML.includes('No trains on')&&!el.innerHTML.includes('Buy a train for')){const br=el.querySelector('br');if(br)br.insertAdjacentHTML('afterend',h);else el.insertAdjacentHTML('beforeend',h)}}catch(e){}return r}}
{const o=nextTip;nextTip=function(){try{const k=[...new Set(sites.filter(s=>s.linked&&!s.hidden&&(isInd(s)||isFac(s))).map(islOf))].find(k=>k!=null&&k>=0&&k!==homeK()&&islTrainsN(k)===0);
 if(k!=null){const I=islName(k),d=islDock(k);if(d){tipGo=()=>buyTrainFor(k);return'🚂 '+I+' has no trains: order one from your engine shed: it drives to your dock and crosses on your cargo ship'}const B=sites.find(s=>s.linked&&islOf(s)===k&&(isInd(s)||isFac(s)));tipGo=()=>{locateSite(B);showInfo(B)};return'🚂 '+I+' has no trains: they sail over on a 🚢 cargo ship, so buy a ship for its sea route first'}}catch(e){}return o()}}
// v191: Orders board starts with what is holding orders back, one line per good, with the fix
function stuckRows(){const W={};for(const t of sites){if(t.type!=='town'||!t.linked||t.hidden)continue;const o=ordOf(t);if(!o)continue;for(const g in o)if(((t.got||{})[g]||0)<o[g])(W[g]=W[g]||[]).push(t)}
 const R=[];const makes=(g,k)=>sites.some(o=>o.linked&&!o.hidden&&offerOf(o)===g&&(k==null||islOf(o)===k));
 for(const g in W){const T=W[g];let bad=null,fk0=Object.keys(FAC).find(x=>FAC[x].out===g);
  if(fk0&&!makes(g)){const miss=Object.keys(FAC[fk0].in).filter(r=>!makes(r));if(miss.length){R.push({g,n:T.length,h:'Made by a '+TYPES[fk0].n+' from '+Object.keys(FAC[fk0].in).map(r=>TYPES[r].g+' '+GOOD[r].toLowerCase()).join(' + ')+'. You have no '+miss.map(r=>GOOD[r].toLowerCase()).join(' or ')+' yet'+(miss.some(r=>(S.ires||{})[r]||r==='iron'||r==='oil')?': it is only found on outer islands':''),nob:1});continue}}
  for(const t of T){const k=islOf(t);if(k!==homeK()&&!fk0&&!makes(g,k)){bad=[C9.bad,'No '+mkr(g)+' on '+islName(k)+' yet: build one there']; break}const r=srcOf(t,g);if(r&&r[0]!==C9.ok){bad=r;break}}if(!bad)continue;R.push({g,n:T.length,h:bad[1]})}
 const isl=[...new Set(sites.filter(s=>s.linked&&!s.hidden&&(isInd(s)||isFac(s))).map(islOf))].filter(k=>k!=null&&k>=0&&k!==homeK()&&islTrainsN(k)===0);
 return{R:R.sort((a,b)=>b.n-a.n),isl}}
{const o=renderJobs;renderJobs=function(){o();try{const el=document.getElementById('jobs')||document.querySelector('.jobs');const host=el&&el.querySelector?el:null;const S0=stuckRows();if(!S0.R.length&&!S0.isl.length)return;
 let h='<div class="job" style="border:1.5px solid #e9a646;border-radius:10px;padding:6px 8px;margin:6px 0"><b style="color:#ffd27a">🚧 What\'s holding orders back</b>';
 for(const k of S0.isl)h+='<div style="margin-top:4px">🚂 <b>'+islName(k)+'</b> has no trains. '+(islDock(k)?'<button onpointerdown="event.stopPropagation();buyTrainFor('+k+')" style="border:0;border-radius:8px;padding:3px 8px;background:#2f8f83;color:#fff;font:inherit;font-weight:700">Buy a train for '+islName(k)+' · '+fmt(islTC())+'</button>':'Buy a 🚢 cargo ship for its sea route first, then a train.')+'</div>';
 for(const r of S0.R.slice(0,5)){const fk=Object.keys(FAC).find(x=>FAC[x].out===r.g&&!sites.some(s=>s.type===x&&s.linked));h+='<div style="margin-top:4px">'+TYPES[r.g].g+' <b>'+GOOD[r.g]+'</b> · '+r.n+' town'+(r.n>1?'s':'')+' waiting<br><small style="opacity:.85">'+r.h.replace(/<br>/g,' · ')+'</small>'+(fk&&!r.nob&&FAC[fk].lvl<=S.beacon?' <button onpointerdown="event.stopPropagation();closeJobs&&closeJobs();document.querySelector(\'[data-m=build]\').click();pickBuild(\''+fk+'\')" style="border:0;border-radius:8px;padding:3px 8px;background:#2f8f83;color:#fff;font:inherit;font-weight:700">🏗 Build a '+TYPES[fk].n+'</button>':'')+'</div>'}
 h+='</div>';const box=document.getElementById('jobsBody')||document.getElementById('jobsPanel');const sm=el&&el.querySelector('small');if(sm)sm.insertAdjacentHTML('afterend',h)}catch(e){console.error(e)}}}
// v191: a dock whose sea route has no ship says so at the top of its card, with the Buy button
{const o=showPort;showPort=function(s){o(s);try{const el=document.getElementById('panel');const i=sites.indexOf(s);if(i<0||!el.insertAdjacentHTML||el.innerHTML.includes('noShipTop'))return;const L=portLanes(i).filter(l=>!laneShips(l));if(!L.length)return;const l=L[0],F=sites[l.a===i?l.b:l.a],c=shipCost();
 const P0=sites[i],unl=P0&&!P0.linked,h='<div id="noShipTop">'+banner(C9.warn,'🚢 No ship to '+nm(F)+': nothing crosses yet')+(unl?'<small style="opacity:.85">First link this dock to your railway.</small>'+connectTxt(P0):'<small style="opacity:.85">A cargo ship carries goods, and trains for '+islName(islOf(F))+', across this route. Ore and oil holds included.</small><div>'+tbtn('🚢 Buy a ship here · '+fmt(c),'buyShip('+i+')',S.money<c)+'</div>')+'</div>';const br=el.querySelector('br');if(br)br.insertAdjacentHTML('afterend',h);else el.insertAdjacentHTML('afterbegin',h)}catch(e){}}}
if(typeof window!=='undefined')window.showPort=showPort;


// ---- Edition 7: a rail build must not silently move a station or the engine shed ----
const _shedFix7 = shedFix;
shedFix = function(){
  const sh = S.sheds && S.sheds[0];
  if(!sh) return;
  if(track.has(id(sh.x,sh.y)) || D4.some(([a,b])=>track.has(id(sh.x+a,sh.y+b)))) return;
  const ox = sh.x, oy = sh.y;
  try{_shedFix7()}catch(e){}
  if(sh.x!==ox || sh.y!==oy) toast('🏚 Engine shed moved: it had lost all its track.');
};
const _stnTile7 = stnTile;
stnTile = function(o){
  if(!o || o.type!=='town') return _stnTile7(o);
  S.stnTileMap = S.stnTileMap || {};
  const idx = sites.indexOf(o), prev = S.stnTileMap[idx];
  if(prev && (track.has(id(prev.x,prev.y)) || D4.some(([a,b])=>track.has(id(prev.x+a,prev.y+b))))) return {x:prev.x, y:prev.y, hz:prev.hz, st:prev.st};
  const r = _stnTile7(o);
  if(r) S.stnTileMap[idx] = {x:r.x, y:r.y, hz:r.hz, st:r.st};
  return r;
};
const _stnExt7 = stnExt;
stnExt = function(p,hz,Lt){
  const out = _stnExt7(p,hz,Lt);
  try{
    if(!track.has(id(p.x,p.y)) && !D4.some(([a,b])=>track.has(id(p.x+a,p.y+b)))){ if(S.stnSize) delete S.stnSize[p.x+','+p.y+','+(hz?1:0)]; return out; }
    S.stnSize = S.stnSize || {};
    const key = p.x+','+p.y+','+(hz?1:0), prev = S.stnSize[key];
    if(prev){ out[0] = Math.max(out[0], prev[0]); out[1] = Math.max(out[1], prev[1]); }
    S.stnSize[key] = [out[0], out[1]];
  }catch(e){}
  return out;
};


// ---- Edition 8: recommendations must not be 1 away, or through a station middle ----
// Quarry: side-touching mountain required (diagonal-only no longer glows).
const _indSpot8 = indSpot;
indSpot = function(x,y,k){
  const e = _indSpot8(x,y,k);
  if(k!=='stone' || e) return e;
  const d = siteAt(x,y);
  if(d && d.type==='dep' && d.res==='stone') return e;
  const side = D4.some(([a,b])=>terr[id(x+a,y+b)]===4);
  return side ? '' : 'Quarries go right against a mountain, not just at its corner — pick a square touching a mountain on its side';
};
// Recommended rail: never enter a station hall centre tile from its side.
function _planAxisOk8(x,y,from){
  if(from<0) return true;
  const o = stnAt(x,y); if(!o) return true;
  if(siteAt(x,y) && siteAt(x,y).type==='town') return true;
  const p = stnTile(o); if(!p) return true;
  const hz = stnHz(p), v = hz ? y-p.y : x-p.x;
  if(v!==0) return true;
  if(o.sx && o.x+o.sx[0]===x && o.y+o.sx[1]===y) return true;
  const fx = from%N, fy = (from/N)|0;
  return hz ? fy===y : fx===x;
}
planRoute = function(tx,ty,site){
  const Wt=new Float64Array(N*N).fill(Infinity),prev=new Int32Array(N*N).fill(-1),start=id(tx,ty),open=[start];Wt[start]=0;let hit=-1;
  while(open.length){let b=0;for(let k=1;k<open.length;k++)if(Wt[open[k]]<Wt[open[b]])b=k;const i=open.splice(b,1)[0],x=i%N,y=(i/N)|0;if(i!==start&&anchor(x,y)&&siteAt(x,y)!==site&&(!NET||NET[i])&&stnEntryOk(x,y,prev[i])&&_planAxisOk8(x,y,prev[i])){hit=i;break}if(i!==start&&anchor(x,y))continue;
   for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy;if(nx<1||ny<1||nx>=N-1||ny>=N-1)continue;const j=id(nx,ny);let c;
    if(anchor(nx,ny)&&siteAt(nx,ny)!==site){if(!_planAxisOk8(nx,ny,i))continue;c=.01}else{if(!rev[j]||terr[j]===4||terr[j]===0&&!brOk(j)||(terr[j]===0&&!S.tech.trestle)||siteAt(nx,ny)||stnSide(nx,ny))continue;c=(terr[j]===0?90:terr[j]===3?40:15)+(isField(j)?30:0)}
    if(Wt[i]+c<Wt[j]){if(Wt[j]===Infinity)open.push(j);Wt[j]=Wt[i]+c;prev[j]=i}}}
  if(hit<0)return null;const p=[];let i=prev[hit];while(i!==-1&&i!==start){p.push(i);i=prev[i]}if(!site)p.push(start);return p;
};


// ---- Edition 9: a centre station is never a side-entry end station ----
const _endSideOk9 = endSideOk;
endSideOk = function(t,x,y){
  if(t && t.type==='town'){
    try{
      const saved = t.sx; if(saved) delete t.sx;
      const p = stnTile(t);
      if(saved) t.sx = saved;
      if(p && p.x===t.x && p.y===t.y) return false;
    }catch(e){}
  }
  return _endSideOk9(t,x,y);
};
try{
  for(const o of sites){
    if(!o || o.type!=='town' || !o.sx) continue;
    const sx = o.sx; delete o.sx;
    let p = null; try{ p = stnTile(o); }catch(e){}
    if(p && p.x===o.x && p.y===o.y){
      if(S.stnTileMap) delete S.stnTileMap[sites.indexOf(o)];
    } else {
      o.sx = sx;
      if(S.stnTileMap) delete S.stnTileMap[sites.indexOf(o)];
    }
  }
}catch(e){}
// Flow lines follow the rails, not a straight diagonal across the map.
const _drawFlowsOne9 = drawFlows.one;
drawFlows.one = function(f){
  let p = null;
  try{ p = (f.a && f.b) ? railPath(f.a, f.b) : null; }catch(e){ p = null; }
  if(!p || p.length<2) return _drawFlowsOne9(f);
  const col = f.ok ? 'rgba(127,211,107,.95)' : 'rgba(220,210,190,.6)';
  ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.setLineDash(f.ok ? [] : [7,6]); ctx.lineDashOffset = -performance.now()/50;
  ctx.beginPath();
  p.forEach((q,k)=>{ const X=(q[0]+.5)*TS, Y=(q[1]+.5)*TS; k ? ctx.lineTo(X,Y) : ctx.moveTo(X,Y); });
  ctx.stroke(); ctx.setLineDash([]); ctx.lineDashOffset = 0;
  const last = p[p.length-1], prev = p[p.length-2];
  const dx = last[0]-prev[0], dy = last[1]-prev[1], d = Math.hypot(dx,dy) || 1, ux = dx/d, uy = dy/d;
  const ex = (last[0]+.5)*TS - ux*22, ey = (last[1]+.5)*TS - uy*22;
  ctx.fillStyle = col; ctx.beginPath();
  ctx.moveTo(ex+ux*8, ey+uy*8); ctx.lineTo(ex-uy*7-ux*4, ey+ux*7-uy*4); ctx.lineTo(ex+uy*7-ux*4, ey-ux*7-uy*4); ctx.fill();
  const mid = p[Math.floor(p.length/2)];
  chip((mid[0]+.5)*TS, (mid[1]+.5)*TS, f.k==='pass' ? '🧳' : f.k==='mix' ? '📦' : TYPES[f.k].g, 8);
};


// ---- Edition 10: never build through the engine shed, and never flip it ----
const _isShed10 = (x,y) => (S.sheds||[]).some(o=>o.x===x && o.y===y);
const _planRoute10 = planRoute;
planRoute = function(tx,ty,site){
  const Wt=new Float64Array(N*N).fill(Infinity),prev=new Int32Array(N*N).fill(-1),start=id(tx,ty),open=[start];Wt[start]=0;let hit=-1;
  while(open.length){let b=0;for(let k=1;k<open.length;k++)if(Wt[open[k]]<Wt[open[b]])b=k;const i=open.splice(b,1)[0],x=i%N,y=(i/N)|0;if(i!==start&&anchor(x,y)&&siteAt(x,y)!==site&&(!NET||NET[i])&&stnEntryOk(x,y,prev[i])&&_planAxisOk8(x,y,prev[i])){hit=i;break}if(i!==start&&anchor(x,y))continue;
   for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy;if(nx<1||ny<1||nx>=N-1||ny>=N-1)continue;const j=id(nx,ny);let c;if(!track.has(j)&&typeof ydBan==='function'&&ydBan(j))continue;
    if(anchor(nx,ny)&&siteAt(nx,ny)!==site){if(!_planAxisOk8(nx,ny,i))continue;c=.01}else{if(_isShed10(nx,ny)||!rev[j]||terr[j]===4||terr[j]===0&&!brOk(j)||(terr[j]===0&&!S.tech.trestle)||siteAt(nx,ny)||stnSide(nx,ny))continue;c=(terr[j]===0?90:terr[j]===3?40:15)+(isField(j)?30:0)}
    if(Wt[i]+c<Wt[j]){if(Wt[j]===Infinity)open.push(j);Wt[j]=Wt[i]+c;prev[j]=i}}}
  if(hit<0)return null;const p=[];let i=prev[hit];while(i!==-1&&i!==start){p.push(i);i=prev[i]}if(!site)p.push(start);return p;
};
const _lay10 = lay;
lay = function(x,y,free){
  if(_isShed10(x,y) && !track.has(id(x,y))){ warn('The engine shed stands here: run your track beside it'); return false; }
  return _lay10(x,y,free);
};
const _shedFace10 = shedFace;
shedFace = function(sh){
  if(!sh) return _shedFace10(sh);
  if(sh._face){
    const tk = sh._face[2];
    if(tk && track.has(id(sh.x+tk[0], sh.y+tk[1]))) return sh._face;
    delete sh._face;
  }
  let f = _shedFace10(sh);
  if(f[2]){
    let town = null, bd = 1e9;
    for(const o of sites){ if(o && o.type==='town' && !o.hidden){ const d = Math.hypot(o.x-sh.x, o.y-sh.y); if(d<bd){ bd=d; town=o; } } }
    if(town && (f[0]*(town.x-sh.x) + f[1]*(town.y-sh.y) < 0)){
      let best = null, bd2 = 1e9;
      for(let dy=-3; dy<=3; dy++) for(let dx=-3; dx<=3; dx++){
        if(!dx&&!dy) continue; if(!track.has(id(sh.x+dx, sh.y+dy))) continue;
        const d = Math.hypot(sh.x+dx-town.x, sh.y+dy-town.y);
        if(d<bd2){ bd2=d; best=[dx,dy]; }
      }
      if(best){
        const ax = Math.abs(best[0])>=Math.abs(best[1]);
        f = ax ? [Math.sign(best[0]),0,best] : [0,Math.sign(best[1]),best];
      }
    }
    sh._face = f;
  }
  return f;
};
// v197: one maker feeds a factory while towns wait on the same raw good -> suggest another maker
function rawGap(){const W={};for(const t of sites){if(t.type!=='town'||!t.linked||t.hidden)continue;const o=ordOf(t);if(!o)continue;for(const g in o)if(!Object.values(FAC).some(f=>f.out===g)&&((t.got||{})[g]||0)<o[g])(W[g]=W[g]||[]).push(t)}
 const M=shipPlan();let best=null;for(const g in W){const mk=[...M].filter(([pi,f])=>f.k===g&&!isFac(sites[pi]));if(!mk.length)continue;if(mk.some(([pi,f])=>f.to!=null&&W[g].includes(sites[f.to])))continue;const feeds=mk.map(([pi,f])=>f.to!=null&&isFac(sites[f.to])?sites[f.to]:null).filter(Boolean);if(!feeds.length)continue;
  const kind=sites[mk[0][0]].type;if(!best||W[g].length>best.T.length)best={g,T:W[g],kind,F:feeds[0],n:mk.length}}return best}
{const o=nextTip;nextTip=function(){try{const b=rawGap();if(b){const G=GOOD[b.g].toLowerCase(),K=TYPES[b.kind].n;tipGo=()=>{document.querySelector('[data-m=build]').click();pickBuild(b.kind)};
 return TYPES[b.g].g+' '+(b.T.length>1?b.T.length+' towns want ':nm(b.T[0])+' wants ')+G+', but your '+(b.n>1?K+'s send':K+' sends')+' it all to the '+nm(b.F)+': build another '+K}}catch(e){}return o()}}
// v198: orders that can only be made from another island's resources -> point at the dock
function islGap(){if(ports().some(o=>o.linked&&!o.gone))return null;const W={};for(const t of sites){if(t.type!=='town'||!t.linked||t.hidden)continue;const o=ordOf(t);if(!o)continue;for(const g in o)if(((t.got||{})[g]||0)<o[g])(W[g]=W[g]||[]).push(t)}
 const far=r=>IRES.includes(r)&&!sites.some(o=>o.linked&&!isFac(o)&&offerOf(o)===r);let best=null;
 for(const g in W){const fk=Object.keys(FAC).find(k=>FAC[k].out===g);const raw=fk?Object.keys(FAC[fk].in):[g];const r=raw.find(far);if(!r)continue;if(!best||W[g].length>best.T.length)best={g,r,T:W[g]}}
 if(!best)return null;const other=Object.keys(W).filter(g=>{const fk=Object.keys(FAC).find(k=>FAC[k].out===g);return !(fk?Object.keys(FAC[fk].in):[g]).some(far)});return other.length?null:best}
{const o=nextTip;nextTip=function(){try{const b=islGap();if(b){tipGo=()=>{document.querySelector('[data-m=build]').click();pickBuild('port')};const G=GOOD[b.g].toLowerCase();
 return'⚓ '+(b.T.length>1?b.T.length+' towns want ':nm(b.T[0])+' wants ')+TYPES[b.g].g+' '+G+', made from '+GOOD[b.r].toLowerCase()+', which only other islands have: build a Dock'+(S.beacon<2?' (Railway level 2)':'')}}catch(e){}return o()}}
var art9=w=>(/^[AEIOU]/i.test(w)?'an ':'a ')+w;
// v201: (1) dock range grows +10 tiles per Railway level above 2, free
{const r0=PORT.r.slice();r0.forEach((v,i)=>Object.defineProperty(PORT.r,i,{get(){return v+10*Math.max(0,(S.beacon||1)-2)},configurable:true}))}
// v201: (2) endless orders: after Megacity, towns keep ordering bigger loads of goods your railway already makes
{const XL={},made=()=>[...new Set(sites.filter(o=>o.linked&&!o.hidden&&!o.gone&&offerOf(o)).map(offerOf))].filter(k=>LADK.has(k)).sort();
 const Q=k=>(LADDER[4][k]||LADDER[3][k]||LADDER[2][k]||60);
 for(let L=5;L<40;L++){TLIM[L+1]=Math.round(TLIM[L]*1.35/100)*100;LPOP[L+1]=TLIM[L];LREW[L]=Math.round(LREW[4]*(1+.25*(L-4))/100)*100;
  Object.defineProperty(LADDER,L,{get(){if(XL[L])return XL[L];const g=made();if(g.length<2)return{farm:Math.round(150*Math.pow(1.25,L-4)/5)*5};const o={};for(let i=0;i<Math.min(3,g.length);i++){const k=g[(L*2+i)%g.length];o[k]=Math.round(Q(k)*Math.pow(1.25,L-4)/5)*5}XL[L]=o;return o},configurable:true})}
 const bc=beaconCap;beaconCap=function(s){const c=bc(s);return tlvl(s)>=5&&s.linked?Math.max(c,TLIM[tlvl(s)]||c):c}}
// v201: (3) trains waiting or parked cost nothing
COST.trainWait=0;
// v202: sea service. Islands exist for iron and oil, so crossing must not be a wall of separate purchases:
// every sea route gets one free cargo ship, ships carry ore and oil from the start, and each newly linked island gets one free train
function seaAuto(){S.shC=S.shC||{};S.shC.bulk=1;S.shC.tank=1;S.freeT=S.freeT||{};let ch=0;
 // v203: islands reached through another island's landing get a direct route from the home dock (ships sail straight through)
 const H=homeK(),has=(x,y)=>S.lanes.some(l=>l.a===x&&l.b===y||l.a===y&&l.b===x),dir=(l,from)=>l.a===from?l.p:l.p.slice().reverse(),oth=(l,e)=>l.a===e?l.b:l.a;
 for(let n=0;n<4;n++){let add=0;for(const l1 of S.lanes.slice()){if(l1.off)continue;for(const ai of[l1.a,l1.b]){const A=sites[ai],ei=oth(l1,ai),E=sites[ei];if(!A||!E||islOf(A)!==H||islOf(E)===H)continue;
  for(const l2 of S.lanes.slice()){if(l2.off||l2===l1||(l2.a!==ei&&l2.b!==ei))continue;const bi=oth(l2,ei),B=sites[bi];if(!B||bi===ai||islOf(B)===H||islOf(B)===islOf(E)||has(ai,bi))continue;
   const p1=dir(l1,ai),p2=dir(l2,ei);S.lanes.push({a:ai,b:bi,p:p1.concat(p2.slice(1)),via:ei});add=1;ch=1}}}if(!add)break}
 // v207: ships are bought again (flat $3,000, holds included)
 if(ch)AUTO.k='';
 // v208: no free train: island trains are ordered and delivered by ship (ferryStart)
}
{const o=tick;let acc=0;tick=function(dt){o(dt);acc+=dt;if(acc>=2){acc=0;try{seaAuto()}catch(e){}}}}

// ===== v208 (Sébastien): island trains are not free. Ordering one builds it at Ashford; it drives to your home dock, waits for the cargo ship
// on that route, crosses with it and rolls off at the landing. A spare home train can be sent the same way.
function ferryPlan(k){const d=islDock(k);if(!d)return null;const l=S.lanes[d.ln];return{from:l.a===d.to?l.b:l.a,to:d.to,ln:d.ln}}
function spareHome(){return S.trains.find(t=>t.st==='idle'&&!t.route&&!(t.cargo>0)&&t.w==='freight'&&tIslNow(t)===homeK())}
function ferryStart(t,k,fresh){const F=ferryPlan(k);if(!F)return false;const H=sites[F.from],A=sites[hubI()];let p=null;try{const here=fresh?id(A.x,A.y):trainTile(t);p=pathTo(bfs(here),id(H.x,H.y))}catch(e){}
 Object.assign(t,{route:null,cargo:0,fk:k,fto:F.to,ffrom:F.from,fln:F.ln,why:'',ln:null,li:null,auto:false});
 if(p&&p.length>1){t.path=p;t.pos=0;t.st='ferry';t.wait=fresh?1:0;if(fresh)S.trains.push(t)}
 else{const i=S.trains.indexOf(t);if(i>=0)S.trains.splice(i,1);S.ferT.push({t,to:F.to,ln:F.ln,from:F.from,ph:'wait'})}
 AUTO.k='';return true}
buyTrainFor=function(k){if(k===homeK())return autoBuy();const F=ferryPlan(k);if(!F){toast('🚢 '+islName(k)+' needs a dock with a cargo ship first: the ship brings the train over');return}
 const c=islTC();if(S.money<c){toast('A train costs '+fmt(c));return}S.money-=c;
 const t={born:Math.round(S.t),shed:0,w:'freight',st:'idle',wait:1,path:[[0,0]],pos:0,cargo:0,route:null,no:(S.tno=Math.max(S.tno||0,...S.trains.map(x=>x.no||0),...S.ferT.map(f=>f.t.no||0))+1)};
 ferryStart(t,k,true);toast('🚂 Train '+t.no+' ordered from the engine shed for '+islName(k)+': it drives to '+nm(sites[F.from])+' and crosses on your cargo ship');save();refreshPanel()};
function sendSpare(k){const t=spareHome();if(!t){toast('No spare train at home right now');return}if(!ferryStart(t,k,false))return;toast('🚂 Train '+tNo(t)+' is heading to '+nm(sites[t.ffrom])+' to cross to '+islName(k));save();refreshPanel()}
{const o=arrived;arrived=function(t){if(t.st!=='ferry')return o(t);const i=S.trains.indexOf(t);if(i>=0)S.trains.splice(i,1);S.ferT.push({t,to:t.fto,ln:t.fln,from:t.ffrom,ph:'wait'});AUTO.k='';refreshPanel()}}
function ferryLand(f){const i=S.ferT.indexOf(f);if(i>=0)S.ferT.splice(i,1);const E=sites[f.to],t=f.t;if(!E)return;for(const k of['fk','fto','ffrom','fln'])delete t[k];
 t.path=[[E.x,E.y]];t.pos=0;t.st='idle';t.wait=1;t.born=Math.round(S.t);S.trains.push(t);toast('🚂 Train '+tNo(t)+' rolled off at '+nm(E)+': it now works on '+islName(islOf(E)));AUTO.k='';refreshPanel()}
function ferryTick(){for(const f of S.ferT.slice()){if(!f.ph)continue;const l=S.lanes[f.ln];if(!l||!sites[f.to]||!sites[f.from]){ferryLand(f);continue}
 if(f.ph==='wait'){const st=l.a===f.from?0:l.p.length-1;let s=S.ships.find(s=>s.st==='dock'&&s.at===f.from);
  if(!s)s=S.ships.find(s=>s.st==='sail'&&s.to===f.to&&s.ln===f.ln&&Math.abs(s.p-st)<.6);if(!s)continue;
  if(s.st==='dock'){const X=sites[f.from],q=(X.ex||{})[f.to]||{};let room=shipCap();for(const g of Object.keys(q).sort((a,b)=>q[b]-q[a])){const m=Math.min(room,Math.floor(q[g]));if(m<=0)continue;X._o=X._o||{};X._o[f.to]=(X._o[f.to]||0)+m;s.c[g]=(s.c[g]||0)+m;q[g]-=m;if(q[g]<1)delete q[g];room-=m}
   s.ln=f.ln;s.dir=l.a===f.from?1:-1;s.p=st;s.to=f.to;s.st='sail';s.w=0}
  f.ph='sea';f.s=s;toast('🚢 Train '+tNo(f.t)+' is crossing to '+nm(sites[f.to]));refreshPanel()}
 else if(f.ph==='sea'){const s=f.s;if(!s||!S.ships.includes(s)||s.st==='dock'&&s.at===f.to||s.st==='dock'&&s.at!==f.from&&s.to!==f.to)ferryLand(f)}}}
{const o=tick;tick=function(dt){o(dt);if(typeof awayNow==='function'&&awayNow())return;try{ferryTick()}catch(e){}}}
// where each ordered train is, for the island rows and landing cards
function ferryTxt(k){const r=[];for(const t of S.trains)if(t.st==='ferry'&&t.fk===k)r.push('🚂 Train '+tNo(t)+' driving to '+nm(sites[t.ffrom]));
 for(const f of S.ferT){if(!sites[f.to]||islOf(sites[f.to])!==k)continue;if(f.ph==='wait')r.push('🚂 Train '+tNo(f.t)+' waiting for a ship at '+nm(sites[f.from])+(S.ships.length?'':' (buy a ship at a dock)'));else if(f.ph==='sea')r.push('🚢 Train '+tNo(f.t)+' at sea');else r.push('🚢 Train '+tNo(f.t)+' at sea, lands in '+Math.max(0,Math.round(f.t0+f.dur-S.t))+' s')}
 return r}
{const o=islBuyRows;islBuyRows=function(){let h=o();try{for(const k of shIsles()){const r=ferryTxt(k);if(r.length)h+='<div style="margin:2px 0 0 8px"><small style="opacity:.85">'+r.join('<br>')+'</small></div>'}}catch(e){}return h}}
{const o=noTrainBox;noTrainBox=function(s){try{const k=s&&islOf(s);if(k!=null&&k>=0&&k!==homeK()){const r=ferryTxt(k);if(r.length&&!S.trains.some(t=>t.st!=='ferry'&&tIslNow(t)===k))return banner(C9.warn,'🚂 A train is on its way to '+islName(k))+'<small style="opacity:.85">'+r.join('<br>')+'</small>'+islTrainOpts(k)}}catch(e){}return o(s)}}
// a landing on another island always offers its trains from the engine shed, and shows any on the way
{const o=noTrainBox;noTrainBox=function(s){const h=o(s);if(h)return h;try{if(!s||s.type!=='port'||!s.linked)return'';const k=islOf(s);if(k==null||k<0||k===homeK()||!ferryPlan(k))return'';const n=S.trains.filter(t=>t.st!=='ferry'&&tIslNow(t)===k).length,r=ferryTxt(k);
 return '<div style="margin:4px 0"><b>🚂 '+n+' train'+(n===1?'':'s')+' on '+islName(k)+'</b>'+(r.length?'<br><small style="opacity:.85">'+r.join('<br>')+'</small>':'')+islTrainOpts(k)+'</div>'}catch(e){}return''}}
{const o=showPort;showPort=function(p){const r=o.apply(this,arguments);try{const el=document.getElementById('panel'),h=noTrainBox(p);if(h&&!el.innerHTML.includes('Buy a train for')&&!el.innerHTML.includes('No trains on')){const br=el.querySelector('br');if(br)br.insertAdjacentHTML('afterend',h);else el.insertAdjacentHTML('beforeend',h)}}catch(e){}return r}}
if(typeof window!=='undefined')Object.assign(window,{buyTrainFor,sendSpare,showPort});
// v212: say so when the home island has no trains left (every train was shipped out or sold)
{const o=nextTip;nextTip=function(){try{const k=homeK();if(S.t>120&&sites.some(s=>s.linked&&!s.hidden&&(isInd(s)||isFac(s))&&islOf(s)===k)&&islTrainsN(k)===0){tipGo=()=>{document.querySelectorAll('#tools button').forEach(b=>b.classList.toggle('on',b.dataset.m==='trains'));mode='trains';showShed(0)};return'🚂 No trains left on '+islName(k)+': goods pile up at your docks and buildings. Buy a train in 🚂 Trains'}}catch(e){}return o()}}
// ---- v210: 🏬 dock warehouse: a dock serves several goods at once ----
// L1: 2 goods at a time · L2: every good at a time · L3: factory goods and trade orders go first
const WH={c:[4000,8000,12000],n:['','🏬 Warehouse','🏬 Bigger warehouse','🏬 Priority sheds'],d:['','Trains pick up 2 different goods here at once','Trains pick up every good here at once','Goods for factories and capital trade orders go out first']};
const whCost=L=>r100(WH.c[L]*XP());
function buyWH(i){const P=sites[i];if(!P||P.type!=='port')return;const L=P.wh||0;if(L>=3)return;const c=whCost(L);if(S.money<c){toast('Costs '+fmt(c));return}S.money-=c;P.wh=L+1;AUTO.k='';toast(WH.n[L+1]+' at '+nm(P)+': '+WH.d[L+1].toLowerCase());save();refreshPanel()}
// how much of the dock's current good is already spoken for by trains on their way
const whCovered=P=>S.trains.filter(t=>t.st==='toSrc'&&sites[t.src]===P&&t.k===P.cur).reduce((a,t)=>a+trainCap(t),0)>=(P.stock||0)-5;
const whPri=(P,g)=>{if((P.wh||0)<3)return 0;const I=islOf(P);if(sites.some(T=>islOf(T)===I&&isFac(T)&&T.linked&&accepts(T,g)))return 2;const q=S.tro&&S.tro[I];return q&&!q.done&&q.k===g?2:0};
{const o=portSync;portSync=function(P,force){const L=P.wh||0;if(!L||force||P.cur==null)return o(P,force);
 P.im=P.im||{};P.im[P.cur]=Math.max(0,P.stock||0);const I=islOf(P),fk=P.fish>0?fishK(P):null,buyer=g=>sites.some(T=>T!==P&&islOf(T)===I&&stopOk(T)&&accepts(T,g));
 const G=Object.keys(P.im).filter(g=>P.im[g]>=1&&buyer(g)).sort((a,b)=>(whPri(P,b)-whPri(P,a))||(dkNeed(P,b)-dkNeed(P,a))||P.im[b]-P.im[a]);
 const pool=L===1?G.slice(0,2):G;
 // keep the current good while it still has stock nobody is fetching; otherwise rotate to the next good in the pool
 const idle=S.t-(P.whT||0)>20&&!S.trains.some(t=>t.st==='toSrc'&&sites[t.src]===P&&t.k===P.cur);if(pool.includes(P.cur)&&!whCovered(P)&&!idle&&!(L>=3&&whPri(P,pool[0])>whPri(P,P.cur)))return;
 const nx=pool.filter(g=>g!==P.cur);if(!nx.length)return o(P,force);const cur=nx[0];P.cur=cur;P.stock=P.im[cur]||0;P.whT=S.t;AUTO.k=''}}
// a train sent for another of the dock's goods still loads it, even after the dock moved on to the next good
{const o=arrived;arrived=function(t){const P=sites[t.src];if(t.st!=='toSrc'||!P||P.type!=='port'||!P.wh||!t.k||t.k===P.cur||!((P.im||{})[t.k]>=1))return o(t);
 const c0=P.cur;P.im[c0]=Math.max(0,P.stock||0);P.cur=t.k;P.stock=P.im[t.k];try{o(t)}finally{P.im[t.k]=Math.max(0,P.stock||0);P.cur=c0;P.stock=P.im[c0]||0}}}
function whBox(P){const i=pIdx(P),L=P.wh||0;let h='<b>🏬 Warehouse'+(L?' '+L+'/3':'')+'</b> <small style="opacity:.8">· how fast trains unload the dock</small><br><small style="color:#ffd27a">It adds no storage room: 📦 room comes from ⬆ upgrading the dock ('+Math.round(dockQ(P))+'/'+dockCap(P)+' used now).</small>';
 const im=P.im||{},ks=Object.keys(im).filter(g=>(g===P.cur?P.stock:im[g])>=1);
 if(ks.length)h+='<br><small>Stored: '+ks.map(g=>TYPES[g].g+' '+Math.floor(g===P.cur?P.stock:im[g])+(g===P.cur?' (loading now)':'')).join(' · ')+'</small>';
 const ex=[];for(const e in P.ex||{}){const n=sumG(P.ex[e]);if(n>=1)ex.push(Object.keys(P.ex[e]).map(g=>TYPES[g].g+Math.floor(P.ex[e][g])).join(' ')+' → '+nm(sites[e]))}
 if(ex.length)h+='<br><small style="opacity:.8">In the dock, waiting for a ship: '+ex.join(' · ')+'</small>';
 h+='<br><small style="opacity:.8">'+(L?WH.d[L]+'.':'Now: trains pick up 1 good here at a time; other landed goods wait their turn.')+'</small>';
 if(L<3)h+='<div>'+ubtn((L?'⬆ ':'')+WH.n[L+1]+' · '+fmt(whCost(L)),'buyWH('+i+')',S.money<whCost(L))+'<br><small style="opacity:.75">'+WH.d[L+1]+'</small></div>';
 return sec2(h)}
{const o=showPort;showPort=function(p){const r=o.apply(this,arguments);try{const el=document.getElementById('panel');if(p&&p.linked&&el&&!el.innerHTML.includes('🏬 Warehouse'))el.insertAdjacentHTML('beforeend',whBox(p))}catch(e){console.error(e)}return r}}
if(typeof window!=='undefined')Object.assign(window,{buyWH,showPort});
// ---- v211: gameplay pass (Sébastien asked for all 5) ----
// 1) trade orders only come from islands your cargo ships can reach (2 ship hops at most, one change at a dock)
function islHops(a,b){if(a===b)return 0;const E={};for(const l of S.lanes){const A=sites[l.a],B=sites[l.b];if(!A||!B||!A.linked||!B.linked||!laneShips(l))continue;const x=islOf(A),y=islOf(B);if(x===y)continue;(E[x]=E[x]||new Set()).add(y);(E[y]=E[y]||new Set()).add(x)}
 let fr=[a],seen=new Set([a]);for(let d=1;d<=4;d++){const nx=[];for(const u of fr)for(const v of E[u]||[]){if(seen.has(v))continue;if(v===b)return d;seen.add(v);nx.push(v)}fr=nx}return 99}
const tradeOk=(k,r)=>islHops(k,r)<=2;
{const o=tradeOf;tradeOf=function(C){const k=islOf(C);S.tro=S.tro||{};const q=S.tro[k];
 // an open order nobody has started that can't be shipped: swap it for a reachable island
 if(q&&!q.done&&!(q.got>0)&&!tradeOk(k,q.from)){const R=regions().filter(r=>r!==k&&tradeOk(k,r));if(R.length){const r=R[(q.n-1)%R.length];q.from=r;q.k=regSpec(r)}}
 if(!q||q.done){const R=regions().filter(r=>r!==k&&tradeOk(k,r));if(!R.length)return q&&!q.done?q:null;const n=(q?q.n:0)+1,r=R[(n-1)%R.length];return S.tro[k]={n,from:r,k:regSpec(r),need:Math.round(40*Math.pow(1.4,n-1)/10)*10,got:0,rew:2500*n}}
 return q}}
// the capital card says exactly what is missing for a trade order
function troMiss(k,q){const m=[];if(!tradeOk(k,q.from))m.push('🚢 no ship route between '+islName(k)+' and '+islName(q.from)+': link a dock on each and buy a ship');
 if(!sites.some(P=>offerOf(P)===q.k&&P.linked&&islOf(P)===q.from))m.push('⛏ nobody on '+islName(q.from)+' makes '+GOOD[q.k].toLowerCase()+' yet');
 if(!canShip(q.k)){const c=holdOf(q.k);m.push('📦 ships need '+(SHOLD[c]?SHOLD[c].n:'a special hold')+' for '+GOOD[q.k].toLowerCase()+' (Engine shed → Ships)')}
 return m}
{const o=capBox;capBox=function(C){let h=o(C);try{const k=islOf(C),q=S.tro&&S.tro[k];if(q&&!q.done){const m=troMiss(k,q);if(m.length)h=h.replace(/<\/div>$/,'<div style="margin-top:4px;color:#ffb36b"><b>Why nothing arrives yet:</b><br><small>'+m.join('<br>')+'</small></div></div>')}}catch(e){}return h}}
// 2) a new island pays more, and trains for other islands cost less (the island council chips in)
const islTC=()=>r100(COST.train*.75);
{const o=islGrant;islGrant=function(k){const n=(S.isl||[]).filter(q=>q!==k).length;return r100((2000+ISLS[k].d*30+500*Math.min(n,8))*Math.sqrt(XP()))}}
// 3) every newly reached island has one discovery
S.rich=S.rich||[];
{const r0=IND.rate;IND.rate=s=>{const v=r0(s);return s&&S.rich&&S.rich.includes(id(s.x,s.y))?v*1.5:v}}
function islFind(k,ax,ay){const deps=sites.filter(o=>o.type==='dep'&&!o.hidden&&!o.gone&&islOf(o)===k);const kinds=['seam','wreck','map'];let pick=kinds[k%3];if(pick==='seam'&&!deps.length)pick='map';
 if(pick==='seam'){const D=deps.sort((a,b)=>Math.hypot(a.x-ax,a.y-ay)-Math.hypot(b.x-ax,b.y-ay))[0];S.rich.push(id(D.x,D.y));reveal(D.x,D.y,2);return'⛏ <b>Rich seam</b>: surveyors found a rich '+(TYPES[D.res]?GOOD[D.res].toLowerCase():'')+' deposit here. A mine on it makes 50% more.'}
 if(pick==='wreck'){let w=null;for(let r=2;r<10&&!w;r++)for(let j=0;j<16;j++){const a=j*.39,px=Math.round(ax+Math.cos(a)*r),py=Math.round(ay+Math.sin(a)*r);if(px>0&&py>0&&px<N&&py<N&&terr[id(px,py)]===0){w={x:px,y:py};break}}
  const n=r100(1500+Math.random()*1500);S.money+=n;led('salvage',n);const txt=fmt(n)+' salvaged from an old wreck off '+ISLS[k].nm;if(w)(S.wrecks=S.wrecks||[]).push({x:w.x,y:w.y,txt,t:S.t});return'🛳 <b>Old wreck</b>: '+txt+'.'}
 for(const o of sites)if(islOf(o)===k&&(o.type==='town'||o.type==='plot'||o.type==='dep'))reveal(o.x,o.y,3);discover();return'🗺 <b>Surveyor\'s maps</b>: an old survey office shows every town and deposit on '+ISLS[k].nm+'.'}
{const o=islandReached;islandReached=function(k,seen){o(k,seen);try{const P=ISLS[k];let ax=Math.round(P.x),ay=Math.round(P.y);for(let i=0;i<N*N;i++)if(seen[i]&&ISLC[i]===k){ax=i%N;ay=(i/N)|0;break}
 const t=islFind(k,ax,ay);news('🔎 '+ISLS[k].nm+': '+t.replace(/<[^>]+>/g,''),true);const e=document.getElementById('notice');if(e&&e.style.display!=='none'){const b=e.querySelector('button');const d='<div style="margin-top:6px;padding:6px 8px;border-radius:8px;background:#2a221a;border:1px solid #e9a646">🔎 '+t+'</div>';if(b)b.insertAdjacentHTML('beforebegin',d);else e.insertAdjacentHTML('beforeend',d)}}catch(err){console.error(err)}}}
// 4) the chapter card folds to a one-line next goal (tap ▾ to open it)
{const o=chCard;chCard=function(tx){const full=o(tx);if(S.chMin===false)return full.replace('<span style="color:#ffd27a;letter-spacing:1px','<span data-fold="1" style="padding:0 6px;opacity:.8">▴</span><span style="color:#ffd27a;letter-spacing:1px');
 let g='',c=chap();try{if(!c.free){const G=chGoals(),nx=G.find(x=>x.v<x.g);if(nx)g='▶ <b>'+nx.t+'</b>'+(nx.g>1?' '+nx.v+'/'+nx.g:'')+' <span data-cg="1" style="display:inline-block;padding:1px 9px;border-radius:7px;background:#ffd27a;color:#2a241b;font-weight:700">Go ›</span>'}}catch(e){}
 if(!g&&tx)g='💡 '+tx.replace(/<[^>]+>/g,'').slice(0,60)+(tipGo?' <span data-go="1" style="display:inline-block;padding:1px 9px;border-radius:7px;background:#ffd27a;color:#2a241b;font-weight:700">Go ›</span>':'');
 return'<div style="display:flex;align-items:center;gap:6px"><span style="flex:1;white-space:normal;line-height:1.25">'+(g||'📖 Your railway')+'</span><span data-fold="1" style="padding:0 6px;opacity:.8">▾</span></div>'}}
if(typeof window!=='undefined'){const ob=document.getElementById('obj'),o=ob.onclick;ob.onclick=e=>{const t=e.target;if(t.closest&&t.closest('[data-fold]')){S.chMin=S.chMin===false;save();tickMissions.t=0;tickMissions(0);return}return o(e)}}
// 5) zoomed out, each reached island shows its capital, specialty, ships and trade order
function islInfoDraw(k,X,Y,f){try{if(!(S.isl||[]).includes(k)&&k!==homeK())return;const C=capOf(k),sp=regSpec(k),sh=S.ships.filter(s=>sites[s.h]&&islOf(sites[s.h])===k).length,q=S.tro&&S.tro[k];
 const parts=[];if(C)parts.push('👑 '+C.name);if(sp&&TYPES[sp])parts.push(TYPES[sp].g);if(sh)parts.push('🚢'+sh);const tn=islTrainsN(k);if(tn)parts.push('🚂'+tn);if(q&&!q.done)parts.push('🤝 '+TYPES[q.k].g+' '+Math.floor(q.got)+'/'+q.need+(C?' → '+C.name:''));
 if(!parts.length)return;const s=parts.join('  ');ctx.font='700 '+Math.round(f*.75)+'px sans-serif';const w=ctx.measureText(s).width+f*.8,h=f*.95;ctx.fillStyle='rgba(20,18,14,.72)';ctx.beginPath();if(ctx.roundRect)ctx.roundRect(X-w/2,Y-h/2,w,h,h/3);else ctx.rect(X-w/2,Y-h/2,w,h);ctx.fill();ctx.fillStyle='#ffe2a0';ctx.fillText(s,X,Y)}catch(e){}}
// v214 (Sébastien 2026-11-10): a station hall's end square is drawn as part of the station even when it has no track.
// Track or a building touching that end now joins automatically: the end square becomes real track (free).
function hallFill(){let n=0;for(const o of sites){if(o.type!=='town'||o.hidden||!(o.pop>0||o.beacon)||!rev[id(o.x,o.y)])continue;const p=stnTile(o);if(!p)continue;
 if(!track.has(id(p.x,p.y))&&!D4.some(([a,b])=>track.has(id(p.x+a,p.y+b))))continue;const hz=stnHz(p),ax=hz?1:0,ay=hz?0:1;
 for(const e of[-1,1]){const x1=p.x+e*ax,y1=p.y+e*ay,x2=p.x+2*e*ax,y2=p.y+2*e*ay,j=id(x1,y1);if(track.has(j)||!landTile(x1,y1)||isRail(x1,y1)||terr[j]===4||siteAt(x1,y1)||!rev[j])continue;
  if(!(track.has(id(x2,y2))||siteAt(x2,y2)&&siteAt(x2,y2).type!=='dep'&&siteAt(x2,y2).type!=='plot'))continue;
  if(track.has(id(x1+ay,y1+ax))||track.has(id(x1-ay,y1-ax)))continue;
  if((S.sheds||[]).some(s=>s.x===x1&&s.y===y1))continue;track.add(j);n++}}
 if(n){if(typeof stnMemo!=='undefined')stnMemo={};try{RK=''}catch(e){}}return n}
{const o=computeNet;computeNet=function(){try{hallFill()}catch(e){}return o.apply(this,arguments)}}
if(typeof window!=='undefined')setTimeout(()=>{try{if(hallFill()){computeNet();save()}}catch(e){}},1500);
// v214: a glowing coast square that already has track can take a ⚓ Dock (the line runs through the dock)
{const o=showSpot;showSpot=function(x,y){const r=o.apply(this,arguments);try{const i=id(x,y);if(track.has(i)&&rev[i]&&!siteAt(x,y)&&coastal(x,y)&&S.beacon>=2){const p=portSpot(x,y),el=document.getElementById('panel');if(el&&el.style.display==='block'&&!p.e){const b=document.createElement('div');b.innerHTML=ubtn(p.kind==='home'?'⚓ Build a Dock here · '+costTxt(PORT.up[0]):'⚓ Build a landing (sea route from '+p.from.name+') · '+costTxt(PORT.land),`buildPort(${x},${y})`)+'<small style="opacity:.75"> the line keeps running through it</small>';const f=el.querySelector('br');el.insertBefore(b,f?f.nextSibling:el.firstChild)}}}catch(e){}return r}}
if(typeof window!=='undefined')window.showSpot=showSpot;
// v214 (Sébastien chose): draw the scouts' route. Drag (or tap squares) from a linked town over land, or from a ⚓ dock over water.
// The route may bend; its length in squares is the limit. Walkers stop at the water's edge and boats stop at land, mapping a strip on the way and all around the end.
var SCD=null,SCDP=null;
const SCRL={land:[10,15,20,28,36],sea:[14,20,28,38,50]},SCRC=[2000,5000,10000,20000],scLv=()=>Math.min(4,S.scL||0),scUpC=()=>scLv()<4?r100(SCRC[scLv()]*XP()):0;
if(!S.fx226){S.fx226=1;let r=0;for(let k=0;k<(S.scL||0);k++)r+=r100(SCRC[k]*XP());if(r){S.money+=r;setTimeout(()=>toast('🧭 Scouting now costs per square: your scout reach upgrades were refunded ('+fmt(r)+')'),2000)}S.scL=0}
function upScout(){const c=scUpC();if(!c){toast('Scout reach is already at its best');return}if(S.money<c){toast('Not enough money');return}S.money-=c;S.scL=scLv()+1;toast('🧭 Scout reach: 🚶 '+SCRL.land[scLv()]+' squares on foot · ⛵ '+SCRL.sea[scLv()]+' by boat');save();scdBar()}
const scdMax=o=>o.type==='port'?50:36,scdCost=(n,sea)=>Math.round((10*n+n*(n+1))*(sea?1.5:1)*XP()/10)*10,
 scdC=()=>SCD?scdCost(SCD.p.length,sites[SCD.i].type==='port'):0,scdR=o=>Math.max(4,Math.round(scdMax(o)*.75)),scdIn=(o,x,y)=>Math.hypot(x-o.x,y-o.y)<=scdR(o)+.5;
function scdStart(x,y){return sites.filter(q=>scoutOk(q)&&Math.hypot(q.x-x,q.y-y)<=1.5).sort((a,b)=>(Math.abs(a.x-x)+Math.abs(a.y-y))-(Math.abs(b.x-x)+Math.abs(b.y-y))||(a.type==='port')-(b.type==='port'))[0]}
function scdBad(o,j){if(!rev[j])return'';const w=terr[j]===0;if(o.type==='port'&&!w)return'⛵ Boats only sail on water: they stop where land begins';if(o.type!=='port'&&w)return'🚶 Scouts walk on land only. To scout across water, draw from a ⚓ dock';return''}
function scdLast(){const o=sites[SCD.i];return SCD.p.length?SCD.p[SCD.p.length-1]:id(o.x,o.y)}
function scdTo(x,y){if(!SCD)return;const o=sites[SCD.i],M=scdMax(o);let l=scdLast(),g=0;while(g++<400){const lx=l%N,ly=(l/N)|0;if(lx===x&&ly===y)break;const sx=Math.sign(x-lx),sy=Math.sign(y-ly),k=Math.abs(x-lx)>=Math.abs(y-ly)?id(lx+sx,ly):id(lx,ly+sy),kx=k%N,ky=(k/N)|0;
  if(kx<1||ky<1||kx>=N-1||ky>=N-1)break;
  if(SCD.p.length>=2&&k===SCD.p[SCD.p.length-2]||SCD.p.length===1&&k===id(o.x,o.y)){SCD.p.pop();l=k;continue}
  if(SCD.p.includes(k)||k===id(o.x,o.y))break;if(!scdIn(o,kx,ky)){warn((o.type==='port'?'⛵ Boats':'🚶 Scouts')+' stay inside the dashed circle');break}if(SCD.p.length>=M){warn('That is as far as '+(o.type==='port'?'boats':'scouts')+' can go in one trip ('+M+' squares)');break}
  {const e=scdBad(o,k);if(e){warn(e);break}}SCD.p.push(k);// v228: squares you can already see block the line (land for boats, water for scouts); hidden squares never do: the expedition stops there
l=k}scdBar()}
function scdRoute(){const o=sites[SCD.i],r=[];let edge=0;for(const k of SCD.p){const w=terr[k]===0;if(o.type==='port'?!w:w){edge=1;break}r.push(k)}return{r,edge}}
function scdSend(){if(!SCD)return;const o=sites[SCD.i];if(!SCD.p.length){toast('Draw the route first: drag from '+o.name);return}if(S.money<scdC()){toast('Not enough money: this route costs '+fmt(scdC()));return}if(S.scouts.filter(q=>!q.survey).length>=2){toast('Both scout teams are already out');return}
 const{r,edge}=scdRoute();if(!r.length){toast(o.type==='port'?'⛵ Land right next to the dock: boats can\'t sail that way':'🌊 Water right next to '+o.name+': scouts can\'t walk that way');SCD.p=[];scdBar();return}
 const end=r[r.length-1],ex=end%N,ey=(end/N)|0;let fog=0;for(let a=-5;a<=5&&!fog;a++)for(let b=-5;b<=5;b++)if(a*a+b*b<=25&&!rev[id(Math.max(0,Math.min(N-1,ex+a)),Math.max(0,Math.min(N-1,ey+b)))]){fog=1;break}
 if(!fog)for(const k of r){const x=k%N,y=(k/N)|0;for(let a=-3;a<=3&&!fog;a++)for(let b=-3;b<=3;b++)if(!rev[id(Math.max(0,Math.min(N-1,x+a)),Math.max(0,Math.min(N-1,y+b)))]){fog=1;break}if(fog)break}
 if(!fog){toast('Already mapped along this route: draw it into the dark fog');return}
 const paid=scdC(),ref=r.length<SCD.p.length?Math.round((paid-scdCost(r.length,o.type==='port'))*.9/10)*10:0;S.money-=paid;S.stats.scoutsSent=(S.stats.scoutsSent||0)+1;const P=r.map(k=>[k%N,(k/N)|0]),f=P.shift();S.scouts.push({x:o.x,y:o.y,tx:f[0],ty:f[1],path:P,sp:o.type==='port'?6:4,sea:o.type==='port'?1:0,r:3,edge,cut:r.length<SCD.p.length?1:0,ref});
 toast((o.type==='port'?'⛵ A boat sets out from ':'🚶 Scouts set out from ')+o.name);SCD=null;scdBar();save()}
function scdBar(){let b=document.getElementById('scdBar');if(!SCD||mode!=='scout'){if(b)b.style.display='none';if(mode!=='scout')SCD=null;return}
 if(!b){b=document.createElement('div');b.id='scdBar';b.style.cssText='position:fixed;bottom:84px;left:10px;right:10px;z-index:31;background:#2a241bf2;border:1.5px solid #e9a646;border-radius:12px;padding:8px 10px;font-size:13px;line-height:1.35;color:#f4ead5';document.body.appendChild(b)}
 const o=sites[SCD.i],M=scdMax(o),n=SCD.p.length,sea=o.type==='port',bs='border:0;border-radius:9px;padding:8px 10px;margin:3px;font:inherit;font-weight:700;';
 b.innerHTML=(sea?'⛵ <b>Boat from '+o.name+'</b>':'🚶 <b>Scouts from '+o.name+'</b>')+' · '+n+' squares · '+fmt(scdCost(n,sea))+'<br><small style="opacity:.85">'+(n?'Tap inside the dashed circle to extend it, or drag from its end. Drag elsewhere to move the map. ':'Tap inside the dashed circle to draw the route, or drag from the town. Drag elsewhere to move the map. ')+(sea?'Boats sail on water only and stop where land begins.':'Scouts walk on land only and stop at the water\'s edge.')+' They map a strip along the route and everything around its end.</small><div style="text-align:center;margin-top:4px">'
  +'<button onclick="scdSend()" style="'+bs+'background:#e9a646;color:#2a1d0c'+(S.money<scdC()||!n?';opacity:.45':'')+'">✓ Send · '+fmt(scdC())+'</button>'+(n?'<button onclick="SCD.p.pop();scdBar()" style="'+bs+'background:#3d3426;color:#f4ead5">↶ Undo</button>':'')+'<button onclick="SCD=null;scdBar()" style="'+bs+'background:#3d3426;color:#f4ead5">✕</button></div>'+'<div style="text-align:center;font-size:12px;opacity:.8">Each square costs a little more the further out it is'+(sea?' · boats ×1.5 for fuel':'')+'. Next square: '+fmt(scdCost(n+1,sea)-scdCost(n,sea))+'</div>';b.style.display='block'}
if(typeof window!=='undefined'){window.scdSend=scdSend;window.scdBar=scdBar;window.scdTo=scdTo;window.SCD=SCD}
try{const _old=hints.scout,_new='🧭 Drag from a 🟠 town to walk scouts over land, or from a 🔵 dock to sail a boat over water';Object.defineProperty(hints,'scout',{get(){return S.tut>=TUT.length?_new:_old},configurable:true})}catch(e){}
const scdOn=()=>mode==='scout'&&!MAPPV&&S.tut>=TUT.length;
{const o=tap;tap=function(x,y){if(scdOn()){const w=(S.wrecks||[]).find(w=>w.x===x&&w.y===y);if(w)return o(x,y);SCPV=null;try{scBar()}catch(e){}
  const h=scdStart(x,y);if(SCD&&SCD.p.length&&(SCD.p.includes(id(x,y))||h))return;// v225: taps on the drawn line or a town never break the route (use Undo / ✕)
  if(h&&(!SCD||sites[SCD.i]!==h||!SCD.p.length)){SCD={i:sites.indexOf(h),p:[]};scdBar();return}
  if(SCD){if(!scdIn(sites[SCD.i],x,y))return;scdTo(x,y);return}toast('🧭 Drag from a linked town (or a ⚓ dock for a boat) to draw where the scouts go');return}return o(x,y)}}
if(typeof window!=='undefined'){
 const pt=e=>toTile(e.clientX,e.clientY);
 window.addEventListener('pointerdown',e=>{if(e.target!==cv||!scdOn()||SCDP)return;const[x,y]=pt(e);let st=null;
  const snap=SCD?SCD.p.slice():null;
  if(SCD&&scdLast()===id(x,y))st=SCD;else if(SCD&&SCD.p.length&&SCD.p.includes(id(x,y)))st=null;else if(SCD&&!scdStart(x,y)&&scdIn(sites[SCD.i],x,y)&&(()=>{const l=scdLast();return Math.hypot((l%N)-x,((l/N)|0)-y)<=3})()){st=SCD}else{const h=scdStart(x,y);if(h&&!(SCD&&SCD.p.length)){if(!SCD||sites[SCD.i]!==h)SCD={i:sites.indexOf(h),p:[]};st=SCD}}
  if(!st)return;e.stopPropagation();SCDP={id:e.pointerId,x:e.clientX,y:e.clientY,mv:0,t:[x,y],snap};try{cv.setPointerCapture(e.pointerId)}catch(_){};scdBar()},true);
 window.addEventListener('pointermove',e=>{if(!SCDP||e.pointerId!==SCDP.id)return;e.stopPropagation();SCDP.mv+=Math.abs(e.clientX-SCDP.x)+Math.abs(e.clientY-SCDP.y);SCDP.x=e.clientX;SCDP.y=e.clientY;if(SCDP.mv>=8){const[x,y]=pt(e);scdTo(x,y)}},true);
 const up=e=>{if(!SCDP||e.pointerId!==SCDP.id)return;e.stopPropagation();const m=SCDP.mv,t=SCDP.t;SCDP=null;if(m<8)tap(t[0],t[1]);else save()};
 window.addEventListener('pointerup',up,true);window.addEventListener('pointercancel',up,true);
 setInterval(()=>{try{if(SCD||document.getElementById('scdBar'))scdBar()}catch(e){}},700)}
{const o=tick;tick=function(dt){const ed=[];try{for(const sc of S.scouts){if(!sc.path)continue;if(sc.edge||sc.cut)ed.push(sc);let g=0;while(sc.path.length&&Math.hypot(sc.tx-sc.x,sc.ty-sc.y)<=sc.sp*dt+.02&&g++<4){sc.x=sc.tx;sc.y=sc.ty;reveal(Math.round(sc.x),Math.round(sc.y),3);const q=sc.path.shift();sc.tx=q[0];sc.ty=q[1]}}}catch(e){}
 const r=o.apply(this,arguments);try{for(const sc of ed)if(!S.scouts.includes(sc)){if(sc.ref>0)S.money+=sc.ref;toast((sc.sea?'⛵ The boat reached land and turned back. Everything around it is now on your map':'🌊 The scouts reached the water\'s edge and mapped the coast around them')+(sc.ref>0?'. Unused route refunded: '+fmt(sc.ref)+' (90%)':''))}}catch(e){}return r}}
{const o=draw;draw=function(){o.apply(this,arguments);try{if(!SCD||mode!=='scout'||!ctx)return;const sx=x=>(x+.5)*TS*cam.z-cam.x*cam.z+W/2,sy=y=>(y+.5)*TS*cam.z-cam.y*cam.z+H/2,h=sites[SCD.i],tm=performance.now(),M=scdMax(h);
 ctx.save();ctx.strokeStyle='rgba(255,210,122,.35)';ctx.setLineDash([3,8]);ctx.lineWidth=2;ctx.beginPath();ctx.arc(sx(h.x),sy(h.y),scdR(h)*TS*cam.z,0,7);ctx.stroke();ctx.fillStyle='rgba(255,210,122,.06)';ctx.fill();ctx.setLineDash([]);
 const pts=[[h.x,h.y],...SCD.p.map(k=>[k%N,(k/N)|0])];ctx.lineCap='round';ctx.lineJoin='round';
 ctx.strokeStyle='rgba(0,0,0,.45)';ctx.lineWidth=7;ctx.beginPath();pts.forEach(([x,y],i)=>i?ctx.lineTo(sx(x),sy(y)):ctx.moveTo(sx(x),sy(y)));ctx.stroke();
 ctx.setLineDash([2,9]);ctx.lineDashOffset=-tm/40;ctx.strokeStyle='#ffd27a';ctx.lineWidth=4;ctx.beginPath();pts.forEach(([x,y],i)=>i?ctx.lineTo(sx(x),sy(y)):ctx.moveTo(sx(x),sy(y)));ctx.stroke();ctx.setLineDash([]);
 
 if(SCD.p.length){const[ex,ey]=pts[pts.length-1];ctx.fillStyle='rgba(255,210,122,.14)';ctx.beginPath();ctx.arc(sx(ex),sy(ey),3*TS*cam.z,0,7);ctx.fill();ctx.setLineDash([6,5]);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='#ffd27a';ctx.beginPath();ctx.arc(sx(ex),sy(ey),6,0,7);ctx.fill()}
 ctx.font='bold 12px system-ui';ctx.textAlign='center';const t=(h.type==='port'?'⛵ ':'🚶 ')+h.name+' · '+SCD.p.length+' squares',tw=ctx.measureText(t).width+14;ctx.fillStyle='#2a241be8';ctx.fillRect(sx(h.x)-tw/2,sy(h.y)-34,tw,20);ctx.fillStyle='#ffd27a';ctx.fillText(t,sx(h.x),sy(h.y)-20);ctx.restore()}catch(e){}}}

// v215 (Sébastien: ordering a train for an island was unclear; a train waited forever because the ship sat at the far dock)
function ferryHow(k){try{const d=islDock(k);if(!d)return'';const l=S.lanes[d.ln],from=l.a===d.to?l.b:l.a;return'<small style="opacity:.75">How it gets there: it is built at your home engine shed, drives to '+nm(sites[from])+', then your cargo ship carries it to '+nm(sites[d.to])+'. If the ship is away, it sails back for the train.</small>'}catch(e){return''}}

// v216 (Sébastien chose direct routes + roaming ships): every linked dock gets the shortest water route to every dock on another island within reach
const LFX=new Set();
function laneFill(){const P=ports().filter(o=>o.linked&&!o.hidden);let n=0;for(let i=0;i<P.length;i++)for(let j=i+1;j<P.length;j++){const A=P[i],B=P[j],a=pIdx(A),b=pIdx(B);if(laneOf(a,b)||islOf(A)===islOf(B))continue;if(Math.hypot(A.x-B.x,A.y-B.y)>Math.max(portR(A),portR(B)))continue;if(S.lanes.some(l=>l.off&&(l.a===a&&l.b===b||l.a===b&&l.b===a)))continue;const k=a+'/'+b;if(LFX.has(k))continue;const p=seaPathR(A,B);if(!p||!p.length)continue;LFX.add(k);S.lanes.push({a,b,p});for(const t of p)laneSet.add(t);n++}
 if(n){AUTO.k='';try{computeNet()}catch(e){}}return n}
{let lfT=0;const o=tick;tick=function(dt){const r=o.apply(this,arguments);lfT-=dt;if(lfT<=0){lfT=5;try{laneFill()}catch(e){}}return r}}

// v217 (Sébastien): tap a ship to see what it carries; sailing ships show their goods (coloured crates + icons over the deck)
const GCOL={wood:'#8a5a32',farm:'#d8b84a',shell:'#e0a080',fuel:'#5a4a2a',stone:'#9a9a92',coal:'#2e2e2e',iron:'#8b5a4a',oil:'#3a3048',fish:'#6aa0c0',planks:'#c99a5c',bricks:'#b4573e',flour:'#eee4cc',steel:'#7d8a96',tools:'#5f6f7a',goods:'#a87bc0'};
function shipAll(s){const r={};for(const g in s.c||{})r[g]=(r[g]||0)+s.c[g];for(const d in s.fw||{})for(const g in s.fw[d])r[g]=(r[g]||0)+s.fw[d][g];return r}
function shipLoad(s){return sumG(shipAll(s))}
function shipGoods(s){const r=shipAll(s);return Object.keys(r).filter(g=>r[g]>=1).sort((a,b)=>r[b]-r[a]).slice(0,3)}
function shipTile(s){const l=S.lanes[s.ln];let p;if(s.st==='sail'&&l)p=s.p;else{const L=portLanes(s.at)[0];if(!L){const P=sites[s.at];return P?[P.x,P.y]:null}const k=S.ships.filter(o=>o.st!=='sail'&&o.at===s.at).indexOf(s);return tileAt(L,L.a===s.at?Math.min(.3+k*.9,L.p.length-1):Math.max(0,L.p.length-1.3-k*.9))}return tileAt(l,p)}
function tileAt(l,p){const n=l.p.length,a=Math.max(0,Math.min(n-1,Math.floor(p))),b=Math.min(n-1,a+1),f=p-a,A=l.p[a],B=l.p[b];return[(A%N)*(1-f)+(B%N)*f,((A/N)|0)*(1-f)+((B/N)|0)*f]}
function showShip(j){const s=S.ships[j];if(!s)return closePanel();openShed=null;openFac=null;openInfo=null;sel=null;spot=null;flowSel=null;PANEL={n:'showShip',a:[j]};const el=document.getElementById('panel');el.style.display='block';
 const cap=shipCap(),all=shipAll(s),ld=sumG(all),pc=Math.min(100,Math.round(ld/Math.max(1,cap)*100)),P=sites[s.at],T=sites[s.to],gl=q=>Object.keys(q).filter(g=>q[g]>=1).sort((a,b)=>q[b]-q[a]).map(g=>TYPES[g].g+' '+(GOOD[g]||g).toLowerCase()+' <b>'+Math.floor(q[g])+'</b>').join(' · ');
 let h='<b>🚢 Cargo ship '+(j+1)+'</b> <small style="opacity:.8">· holds '+cap+'</small>';
 if(s.st==='sail'&&T){const l=S.lanes[s.ln],left=l?(s.dir>0?l.p.length-1-s.p:s.p):0;h+='<div style="margin-top:5px">⛵ Sailing to <b>'+nm(T)+'</b> <small style="opacity:.8">· '+islName(islOf(T))+' · lands in ≈'+Math.max(0,Math.round(left/shipSpd()))+' s</small></div>'}
 else if(P)h+='<div style="margin-top:5px">⚓ Docked at <b>'+nm(P)+'</b> <small style="opacity:.8">· '+(S.ferT.some(f=>f.ph==='wait'&&f.from===s.at)?'a train is boarding':'loading, leaves when half full or after a short wait')+'</small></div>';
 h+='<div style="margin-top:6px;height:8px;background:#2a231a;border-radius:4px;overflow:hidden"><div style="width:'+pc+'%;height:100%;background:#4f9fd1"></div></div><small style="opacity:.8">'+Math.floor(ld)+' / '+cap+' in the hold</small>';
 if(!ld)h+='<div style="margin-top:5px"><small>📭 Empty'+(s.st==='sail'?': sailing over to pick up goods waiting there.':'.')+'</small></div>';
 else{if(sumG(s.c)>=1)h+='<div style="margin-top:5px">📦 For <b>'+(T?nm(T):'here')+'</b>: '+gl(s.c)+'</div>';for(const d in s.fw||{}){const D=sites[d];if(D&&sumG(s.fw[d])>=1)h+='<div style="margin-top:4px">🔁 Going on to <b>'+nm(D)+'</b> <small style="opacity:.8">(changes ship at '+(T?nm(T):'the next dock')+')</small>: '+gl(s.fw[d])+'</div>'}}
 if(S.ferT.some(f=>f.ph==='sea'&&f.s===s))h+='<div style="margin-top:4px">🚂 Carrying a train</div>';
 h+='<div style="margin-top:7px">'+(P&&s.st!=='sail'?tbtn('⚓ Open '+nm(P),'showPort(sites['+s.at+'])'):T?tbtn('📍 Show '+nm(T),'locateSite(sites['+s.to+'])'):'')+'</div>';
 el.innerHTML=h+'<i id="pgen" hidden></i>'}
if(typeof window!=='undefined')window.showShip=showShip;
{const o=tap;tap=function(x,y){if(mode==='pan'||mode==='trains'){let bj=-1,bd=.9;S.ships.forEach((s,j)=>{const p=shipTile(s);if(!p)return;const d=Math.hypot(p[0]-x,p[1]-y);if(d<bd){bd=d;bj=j}});if(bj>=0&&!siteAt(x,y)){showShip(bj);return}}return o.apply(this,arguments)}}

// v218 (Sébastien): goods waiting at a dock are shown at the top of its card, and as crates beside the dock on the map
function dockWait(P){const i=pIdx(P),r={};for(const e in P.ex||{})for(const g in P.ex[e])if(P.ex[e][g]>=1)r[g]=(r[g]||0)+P.ex[e][g];for(const g in P.im||{})if(P.im[g]>=1)r[g]=(r[g]||0)+P.im[g];return r}
function dockWaitBox(P){const i=pIdx(P),gl=q=>Object.keys(q).filter(g=>q[g]>=1).sort((a,b)=>q[b]-q[a]).map(g=>TYPES[g].g+' '+(GOOD[g]||g).toLowerCase()+' <b>'+Math.floor(q[g])+'</b>').join(' · ');let h='',n=0;
 for(const e in P.ex||{}){const E=sites[e];if(!E||sumG(P.ex[e])<1)continue;n++;const sh=S.ships.find(s=>s.st==='sail'&&s.to===i)||S.ships.find(s=>s.st==='dock'&&s.at===i);h+='<div style="margin-top:3px">⛴ To <b>'+nm(E)+'</b>: '+gl(P.ex[e])+'</div>'}
 if(P.im&&sumG(P.im)>=1){n++;h+='<div style="margin-top:3px">📥 Landed, for trains here: '+gl(P.im)+'</div>'}
 let back=0;for(const Q of ports()){if(Q===P)continue;back+=sumG((Q.ex||{})[i])}
 const inb=S.ships.filter(s=>s.st==='sail'&&s.to===i),inc=inb.reduce((a,s)=>a+shipLoad(s),0),dk=S.ships.filter(s=>s.st!=='sail'&&s.at===i).length;
 const foot='<small style="opacity:.8">'+(dk?'🚢 '+dk+' ship'+(dk>1?'s':'')+' loading here':inb.length?'🚢 ship on its way'+(inc>=1?' with '+Math.floor(inc)+' goods':''):S.ships.length?'🚢 no ship here right now: one comes when goods pile up':'<span style="color:#ffb36b">No cargo ship yet: buy one below</span>')+(back>=1?' · '+Math.floor(back)+' goods at other docks are bound here':'')+'</small>';
 const offL=S.lanes.filter(l=>l.off&&(l.a===i||l.b===i)).map(l=>sites[l.a===i?l.b:l.a]).filter(Boolean);if(offL.length)h+='<div style="margin-top:3px;color:#ffd27a"><small>🌫 Route to '+offL.map(nm).join(', ')+' waits: ships only sail on water you have mapped. Scout the sea between them to open it.</small></div>';
 return '<div id="dockwait" style="margin:6px 0;padding:6px 8px;border:1px solid #4f6f8a;border-radius:8px;background:#1f2a33"><b>📦 Waiting at this dock</b>'+(n||offL.length?h:'<div style="margin-top:3px;opacity:.8"><small>Nothing waiting.</small></div>')+'<div style="margin-top:3px">'+foot+'</div></div>'}
{const o=showPort;showPort=function(P){const r=o.apply(this,arguments);try{const el=document.getElementById('panel');if(el.querySelector&&!el.querySelector('#dockwait')){const b=el.querySelector('br');if(b)b.insertAdjacentHTML('afterend',dockWaitBox(P))}}catch(e){}return r};if(typeof window!=='undefined')window.showPort=showPort}
{const o=draw;draw=function(){o();if(cam.z<.55)return;const z=TS*cam.z/32;for(const P of ports()){if(P.hidden||!lblBig(P))continue;const q=dockWait(P),gs=Object.keys(q).sort((a,b)=>q[b]-q[a]),tot=sumG(q);if(tot<1)continue;const X=(P.x+.5-0.0)*TS,Y=(P.y+.5)*TS,sx=(X-cam.x)*cam.z+W/2+14*z,sy=(Y-cam.y)*cam.z+H/2+8*z;if(sx<-50||sy<-50||sx>W+50||sy>H+50)continue;
 ctx.save();ctx.translate(sx,sy);ctx.scale(z,z);const k=Math.min(6,Math.ceil(tot/15));for(let c=0;c<k;c++){const cx=(c%3)*5-6,cy=-Math.floor(c/3)*4;ctx.fillStyle=GCOL[gs[c%Math.min(3,gs.length)]]||'#c98b3c';ctx.fillRect(cx,cy,4.5,4);ctx.strokeStyle='rgba(0,0,0,.35)';ctx.lineWidth=.5;ctx.strokeRect(cx,cy,4.5,4)}
 ctx.restore()}}}

// v220 (Sébastien): an idle train's card says where it is and why it waits; trains waiting for a ship are drawn on the dock
function idleWhy(t){const k=tIslNow(t),here=sites.filter(o=>!o.hidden&&o.linked&&islOf(o)===k);const r=[];
 for(const o of here){if(['town','port','dep','plot'].includes(o.type))continue;let f=null;try{f=shipOf(o)}catch(e){}if(!f||!f.k)continue;if(f.to==null&&!f.full){const fk=Object.keys(FAC).find(q=>FAC[q].in&&f.k in FAC[q].in);r.push('nothing on your railway uses '+TYPES[f.k].g+' '+GOOD[f.k].toLowerCase()+' yet'+(fk&&TYPES[fk]?': build a '+TYPES[fk].g+' '+TYPES[fk].n:''))}}
 const isl=islName(k);if(r.length)return'📍 On '+isl+': '+[...new Set(r)].join(' · ');if(!here.some(o=>o.type!=='port'&&o.type!=='town'))return'📍 On '+isl+': no linked building makes goods here yet';return'📍 On '+isl+': it takes the next load that is ready'}
{const o=showTrain;showTrain=function(j){const r=o.apply(this,arguments);try{const t=S.trains[j];if(t&&!t.route&&!(t.cargo>0)){const el=document.getElementById('panel');const w=[...el.querySelectorAll('small,div,span,b')].find(x=>x.children.length===0&&/Waiting for a load/.test(x.textContent));const html='<div style="margin:3px 0 0 0;font-size:13px;color:#ffd27a">'+idleWhy(t)+'</div>';if(w)w.insertAdjacentHTML('afterend',html)}}catch(e){}return r};if(typeof window!=='undefined')window.showTrain=showTrain}
{const o=draw;draw=function(){o();if(cam.z<.8)return;const z=TS*cam.z/32,tm=performance.now()/1000,cnt={};for(const f of S.ferT){if(f.ph!=='wait')continue;const P=sites[f.from];if(!P)continue;const k=cnt[f.from]=(cnt[f.from]||0)+1;const X=((P.x+.5)*TS-cam.x)*cam.z+W/2-30*z,Y=((P.y+.5)*TS-cam.y)*cam.z+H/2+(8+(k-1)*9)*z;if(X<-40||Y<-40||X>W+40||Y>H+40)continue;
 ctx.save();ctx.translate(X,Y);ctx.scale(z,z);ctx.fillStyle='rgba(0,0,0,.3)';ctx.fillRect(-9,3,19,2);ctx.fillStyle='#222';ctx.fillRect(-9,-4,15,6);ctx.fillRect(3,-8,3,4);ctx.fillStyle='#b8352b';ctx.fillRect(-9,-1,15,1.2);ctx.fillStyle='#444';ctx.beginPath();ctx.arc(-5,3,2,0,7);ctx.arc(2,3,2,0,7);ctx.fill();
 ctx.font='8px sans-serif';ctx.textAlign='center';ctx.textBaseline='bottom';ctx.fillText('⏳',-1,-9+Math.sin(tm*3)*1);ctx.restore()}}}

// v222 (Sébastien): in scout mode every building you can scout from gets a bigger solid ring (tap anywhere in it to start a route)
{const o=draw;draw=function(){o.apply(this,arguments);try{if(!scdOn()||!ctx)return;const tm=performance.now()/1000;ctx.save();for(const q of sites){if(!scoutOk(q))continue;if(SCD)break;const X=((q.x+.5)*TS-cam.x)*cam.z+W/2,Y=((q.y+.5)*TS-cam.y)*cam.z+H/2,r=Math.max(27,1.2*TS*cam.z);if(X<-r||Y<-r||X>W+r||Y>H+r)continue;
 const sea=q.type==='port',C=sea?'79,195,247':'255,179,64',pu=.5+.5*Math.sin(tm*3);ctx.fillStyle='rgba('+C+',.18)';ctx.strokeStyle='rgba('+C+','+(.75+.25*pu)+')';ctx.lineWidth=3.5;ctx.beginPath();ctx.arc(X,Y,r+2*pu,0,7);ctx.fill();ctx.stroke();
  /* v269: small badge says who leaves from here: 🚶 scouts (town) or ⛵ boat (dock) */const br=Math.max(10,Math.min(16,r*.4)),bx=X-r,by=Y;ctx.fillStyle='rgb('+C+')';ctx.beginPath();ctx.arc(bx,by,br,0,7);ctx.fill();ctx.lineWidth=2;ctx.strokeStyle='#2a1d0c';ctx.stroke();ctx.font=Math.round(br*1.25)+'px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(sea?'⛵':'🚶',bx,by+1)}ctx.restore()}catch(e){}}}

// v225: a second finger while drawing (pinch to zoom) cancels the stroke and puts the route back as it was
if(typeof window!=='undefined')window.addEventListener('pointerdown',e=>{if(!SCDP||e.pointerId===SCDP.id||!SCD)return;if(SCDP.snap)SCD.p=SCDP.snap;try{cv.releasePointerCapture(SCDP.id)}catch(_){}SCDP=null;scdBar()},true);
// v225 (Sébastien): the building you picked keeps a ring while you draw
{const o=draw;draw=function(){o.apply(this,arguments);try{if(!SCD||!scdOn()||!ctx)return;const q=sites[SCD.i];if(!q)return;const X=((q.x+.5)*TS-cam.x)*cam.z+W/2,Y=((q.y+.5)*TS-cam.y)*cam.z+H/2,r=Math.max(14,1.2*TS*cam.z);ctx.save();ctx.fillStyle='rgba(140,255,140,.12)';ctx.strokeStyle='rgba(140,255,140,.9)';ctx.lineWidth=3;ctx.beginPath();ctx.arc(X,Y,r,0,7);ctx.fill();ctx.stroke();ctx.restore()}catch(e){}}}

if(typeof window!=='undefined')window.upScout=upScout;
// v230 (Sébastien): ships never sail through fog. Sea routes use only water you have seen; when fog clears and a shorter seen route opens, the route switches to it.
function seaPathR(a,b){const prev=new Map(),q=[],goal=new Set();
 for(const[dx,dy]of D4){const i=id(a.x+dx,a.y+dy);if(ocean[i]&&rev[i]&&!prev.has(i)){prev.set(i,-1);q.push(i)}const g=id(b.x+dx,b.y+dy);if(ocean[g])goal.add(g)}
 for(let h=0;h<q.length;h++){const i=q[h];if(goal.has(i)){const p=[];let k=i;while(k!==-1){p.unshift(k);k=prev.get(k)}return p}const x=i%N,y=(i/N)|0;for(const[dx,dy]of D4){const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=N||ny>=N)continue;const j=id(nx,ny);if(terr[j]===0&&rev[j]&&!prev.has(j)){prev.set(j,i);q.push(j)}}}return null}
seaPath=seaPathR;if(typeof window!=='undefined')window.seaPath=seaPath;
function laneFog(){let ch=0;S.lanes.forEach((l,li)=>{const A=sites[l.a],B=sites[l.b];if(!A||!B)return;const fog=l.p.some(k=>!rev[k]);const p=seaPathR(A,B);if(!p||!p.length){if(fog&&!l.off&&!S.ships.some(s=>s.st==='sail'&&s.ln===li)&&!S.ferT.some(f=>f.ln===li&&(f.ph==='sea'||!f.ph))){l.off=1;ch++;for(const[X,e]of[[A,l.b],[B,l.a]]){const q=(X.ex||{})[e];if(q&&sumG(q)>=1){X.im=X.im||{};for(const g in q)X.im[g]=(X.im[g]||0)+q[g];delete X.ex[e]}}}return}if(!fog&&!l.off&&p.length>=l.p.length)return;
  if(S.ships.some(s=>s.st==='sail'&&s.ln===li)||S.ferT.some(f=>f.ln===li&&(f.ph==='sea'||!f.ph)))return;if(l.off)toast('🌊 Sea route '+nm(A)+' ⇄ '+nm(B)+' is open: the water between them is mapped');delete l.off;l.p=p;ch++});
 if(ch){laneSet.clear();for(const l of S.lanes)if(!l.off)for(const k of l.p)laneSet.add(k);AUTO.k=''}return ch}
{let lgT=1;const o=tick;tick=function(dt){const r=o.apply(this,arguments);lgT-=dt;if(lgT<=0){lgT=3;try{laneFog()}catch(e){}}return r}}
// v231 (Sébastien): a settlement site card starts with Found, not train options
{const o=noTrainBox;noTrainBox=function(s){if(s&&s.type==='plot')return'';return o(s)}}

// v232 (Sébastien OK'd 1-4): ships are easy to find. 🚢 Ships tab in the Engine shed, ships line + Buy in the dock's top box, nudges when ships fall behind, shorter dock card.
function shipsTabOn(){return ports().filter(p=>p.linked).length>1||S.ships.length>0}
function dockBacklog(){let n=0;for(const P of ports())for(const e in P.ex||{})n+=sumG(P.ex[e]);return n}
function shipsBehind(){const L=S.lanes.filter(l=>!l.off&&sites[l.a]&&sites[l.b]&&sites[l.a].linked&&sites[l.b].linked);if(!L.length)return'';const cap=shipCap(),b=dockBacklog(),w=S.ferT.filter(f=>f.ph==='wait').length;
 if(!S.ships.length)return'No cargo ship yet: goods and trains can\'t cross';if(w&&S.ships.every(s=>s.st==='sail'))return w+' train'+(w>1?'s':'')+' waiting for a ship';if(b>cap*2*S.ships.length)return'Ships can\'t keep up: '+Math.ceil(b/cap)+' trips of goods waiting';return''}
function bestShipDock(){let best=null,bn=-1;for(const P of ports()){if(!P.linked||!portLanes(pIdx(P)).length)continue;let n=0;for(const e in P.ex||{})n+=sumG(P.ex[e]);if(n>bn){bn=n;best=P}}return best}
function buyShipAny(){const P=bestShipDock();if(!P){toast('Build a ⚓ landing on another island first: ships need a sea route');return}buyShip(pIdx(P));try{refreshPanel()}catch(e){}}
function shipBuyBtn(){const why=shipsBehind(),c=shipCost(),dis=S.money<c;return'<button onclick="buyShipAny()" '+(dis?'disabled':'')+' style="margin:4px 4px 0 0;padding:6px 11px;border-radius:9px;border:0;font:inherit;font-weight:700;'+(why?'background:#e08a2c;color:#241404':'background:#2e7d6b;color:#eafff8')+(dis?';opacity:.45':'')+'">🚢 Buy a ship · '+fmt(c)+'</button>'+(why?'<br><small style="color:#ffb36b">⚠ '+why+'</small>':'')}
function shipsTab(){const cap=shipCap();let h='';const why=shipsBehind();
 h+=why?banner(C9.warn,'🚢 '+why):S.ships.length?banner(C9.ok,'✅ Your ships keep up'):'';
 h+='<div style="margin-top:6px">'+shipBuyBtn()+'</div><small style="opacity:.75;display:block;margin-top:4px">'+S.ships.length+' ship'+(S.ships.length===1?'':'s')+' · '+cap+' per trip · '+shipSpd().toFixed(1)+' squares/s · every ship sails every route</small>';
 h+=sec2('<b>Every ship ('+S.ships.length+')</b>'+S.ships.map((s,j)=>{const T=sites[s.to],P=sites[s.at],ld=Math.floor(shipLoad(s)),gs=shipGoods(s).map(g=>TYPES[g].g).join('');return'<div onclick="showShip('+j+')" style="margin-top:4px;padding:4px 8px;border-radius:8px;background:#2a221a;border-left:5px solid #4f9fd1;cursor:pointer"><b>🚢 Ship '+(j+1)+'</b> <small>'+(s.st==='sail'&&T?'⛵ to '+nm(T):'⚓ at '+(P?nm(P):'?'))+'</small><br><small style="opacity:.75">'+(ld?gs+' '+ld+'/'+cap:'empty')+(S.ferT.some(f=>f.ph==='sea'&&f.s===s)?' · 🚂 train aboard':'')+'</small></div>'}).join(''));
 h+=sec2('<b>📦 Waiting at your docks</b>'+ports().filter(P=>P.linked).map(P=>{const q=dockWait(P),n=sumG(q),off=S.lanes.some(l=>l.off&&(l.a===pIdx(P)||l.b===pIdx(P)));return'<div onclick="showPort(sites['+pIdx(P)+'])" style="margin-top:4px;padding:4px 8px;border-radius:8px;background:#2a221a;cursor:pointer">⚓ <b>'+nm(P)+'</b> <small>'+(n>=1?Object.keys(q).filter(g=>q[g]>=1).map(g=>TYPES[g].g+' '+Math.floor(q[g])).join(' · '):'nothing waiting')+(off?' · 🌫 a route waits on scouting':'')+(S.ferT.some(f=>f.ph==='wait'&&f.from===pIdx(P))?' · 🚂 train waiting':'')+'</small></div>'}).join(''));
 const P0=ports().find(p=>p.linked&&portLanes(pIdx(p)).length)||ports().find(p=>p.linked);if(P0){const b=shipBox0(P0),u=b.indexOf('<div style="margin-top:6px"><b>⬆ Ship upgrades'),r=b.indexOf('🧭 Sea reach'),hd=b.indexOf('<div style="margin-top:6px"><b>🧰 Hold types');let up='';if(u>=0){const rs=r>=0?b.lastIndexOf('<div',r):-1;up=b.slice(u,rs>u?rs:(hd>u?hd:b.length));if(rs>u&&!up.endsWith('</div>'))up+='</div>'}const hl=hd>=0?b.slice(hd):'';h+=sec2(up+hl)}
 return h}
{const o=shedAuto;shedAuto=function(){if(S.shTab!=='ships'||!shipsTabOn())return o.apply(this,arguments);openFac=null;openInfo=null;openShed=0;sel=null;spot=null;flowSel=null;PANEL={n:'showShed',a:[0]};const el=document.getElementById('panel');el.style.display='block';
 const n=S.trains.length,busy=S.trains.filter(t=>t.route).length;el.innerHTML=head9('🚂 Engine shed',`${n} train${n===1?'':'s'} · ${n?Math.round(busy/n*100):0}% busy · upkeep ${fmt(Math.round(trainsCost()*60))}/min`)+shedTabs()+shipsTab()+'<i id="pgen" hidden></i>'}}
function openShips(){S.shTab='ships';showShed(0)}
var shipBox0=shipBox;
// dock card: upgrades/holds leave shipBox (they live in the Ships tab); top box gets the fleet line + Buy; rarely used sections fold under More
{const o=shipBox;shipBox=function(s){let b=o(s);const u=b.indexOf('<div style="margin-top:6px"><b>⬆ Ship upgrades'),r=b.indexOf('🧭 Sea reach'),hd=b.indexOf('<div style="margin-top:6px"><b>🧰 Hold types');if(u<0)return b;const rs=r>=0?b.lastIndexOf('<div style="margin-top:4px;display:flex',r):-1;let keep=b.slice(0,u);if(rs>u)keep+=b.slice(rs,hd>rs?hd:b.length);keep=keep.replace(/<div style="margin-top:5px"><button[^>]*buyShip\([^]*?<\/div>/,'');return keep+'<div style="margin-top:5px">'+ubtn('🚢 Ship upgrades & hold types ›','openShips()')+'</div>'}}
{const o=dockWaitBox;dockWaitBox=function(P){let h=o(P);const cap=shipCap(),b=dockBacklog(),line='<div style="margin-top:6px;border-top:1px solid #33465a;padding-top:5px"><b>🚢 '+S.ships.length+' ship'+(S.ships.length===1?'':'s')+'</b> <small style="opacity:.85">· '+Math.floor(b)+' goods waiting across your docks</small><br>'+shipBuyBtn()+' '+ubtn('Fleet ›','openShips()')+'</div>';return h.replace(/<\/div>$/,line+'</div>')}}
var DOCKMORE=false;
{const o=showPort;showPort=function(P){const r=o.apply(this,arguments);try{const el=document.getElementById('panel');if(!el.querySelector||el.querySelector('#dockmore'))return r;const kids=[...el.children].filter(c=>c.tagName==='DIV'&&/^\s*(🎣 Fishing|🧭 Sea scouts|🌊 Sea routes|⬆ Upgrade to|🏬 Warehouse)/.test(c.innerText||c.textContent));if(!kids.length)return r;
 const d=document.createElement('details');d.id='dockmore';if(DOCKMORE)d.open=true;d.ontoggle=()=>{DOCKMORE=d.open};d.style.cssText='margin-top:8px;border-top:1px solid #3d3326;padding-top:5px';const LB=[[/^\s*🎣/,'🎣 fishing'],[/^\s*🧭/,'🧭 scouts'],[/^\s*🌊/,'🌊 routes'],[/^\s*⬆/,'⬆ dock upgrade'],[/^\s*🏬/,'🏬 warehouse']];d.innerHTML='<summary style="cursor:pointer;font-weight:700">More <small style="opacity:.75;font-weight:400">'+kids.map(k=>{const t=k.innerText||k.textContent;const m=LB.find(([re])=>re.test(t));return m?m[1]:''}).filter(Boolean).join(' · ')+'</small></summary>';
 const last=[...el.children].find(c=>c.tagName==='DIV'&&/🚢 Cargo ships/.test(c.innerText||c.textContent));(last||kids[0]).insertAdjacentElement('afterend',d);for(const k of kids)d.appendChild(k)}catch(e){}return r};if(typeof window!=='undefined')window.showPort=showPort}
// 💡 hint + map badge when ships fall behind
{const o=nextTip;nextTip=function(){const w=shipsBehind();if(w&&S.ships.length){tipGo=()=>openShips();return'🚢 '+w+': buy another ship'}return o.apply(this,arguments)}}
{const o=draw;draw=function(){o.apply(this,arguments);try{if(cam.z<.6||!shipsBehind())return;const z=TS*cam.z/32;for(const P of ports()){if(!P.linked||P.hidden)continue;const n=sumG(dockWait(P));if(n<shipCap()&&!S.ferT.some(f=>f.ph==='wait'&&f.from===pIdx(P)))continue;const X=((P.x+.5)*TS-cam.x)*cam.z+W/2+10*z,Y=((P.y+.5)*TS-cam.y)*cam.z+H/2-22*z;if(X<-30||Y<-30||X>W+30||Y>H+30)continue;
 ctx.save();ctx.fillStyle='#e08a2c';ctx.beginPath();ctx.arc(X,Y,9*Math.max(.8,z*.8),0,7);ctx.fill();ctx.font=Math.round(10*Math.max(.8,z*.8))+'px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('🚢',X,Y);ctx.restore()}}catch(e){}}}
if(typeof window!=='undefined')Object.assign(window,{openShips,buyShipAny,shipsTab});

// v233 (Sébastien): say where a train comes from: a free train (named, with where it is now) or a new one built at the engine shed; both show the dock and ship it crosses on

function islTrainOpts(k){const d=islDock(k);if(!d)return'<small style="color:#ffb36b">needs a dock with a 🚢 ship</small>';const l=S.lanes[d.ln],from=l.a===d.to?l.b:l.a,via='drives to '+nm(sites[from])+', then a cargo ship takes it to '+nm(sites[d.to]);const sp=spareHome(),c=islTC(),sh=S.sheds[0],shN=sh?'your engine shed'+(sites[hubI()]?' in '+nm(sites[hubI()]):''):'your engine shed';
 const row=(btn,txt)=>'<div style="margin-top:6px;padding:6px 8px;border-radius:8px;background:#2a221a">'+btn+'<br><small style="opacity:.8">'+txt+'</small></div>';
 const ship='Shipped from '+nm(sites[from])+' to '+nm(sites[d.to])+'.';let h='';/* v267c: the row always shows (greyed when no train is free) so buttons don't jump while the card refreshes */h+=row(tbtn('⇄ Send a free train · no cost','sendSpare('+k+')',!sp),sp?'One of your trains with no job on '+islName(homeK())+'. '+ship:'None free right now: all your trains on '+islName(homeK())+' are busy. This turns on by itself when one finishes.');
 h+=row(tbtn('＋ Buy a new train · '+fmt(c),'buyTrainFor('+k+')',S.money<c),'Built in '+(sites[hubI()]?nm(sites[hubI()]):'Ashford')+'. '+ship);return h}
if(typeof window!=='undefined')window.islTrainOpts=islTrainOpts;
// v234 (Sébastien: town cards are a wall of text): short top (status + compact order chips) and big tiles that open the rest
var TTAB={};
function tTab(i,k){TTAB[i]=k==null||TTAB[i]===k?null:k;try{refreshPanel()}catch(e){showInfo(sites[i])}const el=document.getElementById('panel');if(el)el.scrollTop=0;setTimeout(()=>{if(el)el.scrollTop=0},0)}
{const o=showInfo;showInfo=function(T){const r=o.apply(this,arguments);try{const s=typeof T==='number'?sites[T]:T;if(!s||s.type!=='town'||s.hidden)return r;const el=document.getElementById('panel');if(!el.querySelector||el.querySelector('#tcard'))return r;const i=sites.indexOf(s);
 const K=[...el.children],find=re=>K.find(c=>c.tagName==='DIV'&&re.test(c.innerText||c.textContent));
 const cap=find(/👑 Capital/),stat=K.find(c=>c.tagName==='DIV'&&/^\s*(🟠|🟢|🔴|✅|⚠)/.test(c.innerText||'')&&c.style&&c.style.border),ord=find(/Next:/),more=K.find(c=>c.tagName==='DIV'&&c.querySelector&&c.querySelector('details')&&/^\s*More/.test(c.innerText||'')),lm=find(/🏗 Landmarks/),mp=find(/Map of the area/);
 if(!ord&&!more)return r;
 // compact order chips + the one stuck reason
 let chips='',why=null,head='';if(ord){const rows=[...ord.children].filter(c=>c.tagName==='DIV'&&c.querySelector&&c.querySelector('b')&&/\d+\s*\/\s*\d+/.test(c.innerText||''));const hb=ord.querySelector('b');head=ord.innerHTML.split('<div')[0];const bar=[...ord.children].find(c=>c.tagName==='DIV'&&c.style&&c.style.height==='8px');
  chips=rows.map(rw=>{const t=(rw.querySelector('b').textContent||'').trim(),ok=/^✅/.test(t),parts=t.replace(/^(✅|⬜|🟡|🟠|🔴)\s*/,'').split(/\s+/),ic=parts[0],nmg=parts.slice(1).join(' '),num=(rw.querySelector('span')||{}).textContent||'';if(!ok&&!why)why={rw,ic,nmg,num};return'<span style="display:inline-block;margin:4px 6px 0 0;padding:4px 9px;border-radius:14px;background:'+(ok?'#24361f':'#3a2f22')+';border:1px solid '+(ok?'#5f9a4c':'#8a6d3e')+';font-size:14px">'+ic+' '+(ok?'✓':'<b>'+num.trim()+'</b>')+'</span>'}).join('');
  head='<div style="margin-top:6px">'+head+'</div>'+(bar?bar.outerHTML:'')}
 let st='';if(why){const sm=why.rw.querySelector('small');const extra=[...why.rw.querySelectorAll('button')].map(b=>b.outerHTML).join(' ');st='<div style="margin-top:6px;padding:7px 9px;border-radius:9px;background:#2a221a;border:1.5px solid #ffd27a"><b style="color:#ffd27a">'+why.ic+' '+why.nmg+' '+why.num.trim()+'</b>'+(sm?'<br><small style="color:#f3e6c8;opacity:.9">'+sm.innerHTML.replace(/<b>Why no[^<]*<\/b>\s*/,'')+'</small>':'')+(extra&&!(sm&&sm.querySelector('button'))?'<div>'+extra+'</div>':'')+'</div>'}else if(stat)st=stat.outerHTML;
 // tiles
 const tiles=[];const add=(k,ic,lb,node)=>{if(node)tiles.push({k,ic,lb,node})};
 add('cap','👑','Capital & trade',cap);add('ord','📋','Order details',ord);add('more','🚂','Trains & goods',more);add('lm','🏗','Landmarks',lm);add('map','🗺','Area map',mp);
 const act=TTAB[i];const tb=t=>'<button onclick="tTab('+i+',\''+t.k+'\')" style="flex:1 1 44%;min-height:54px;margin:3px;padding:8px 6px;border-radius:12px;border:'+(act===t.k?'2px solid #ffd27a':'1px solid #6b5a3e')+';background:'+(act===t.k?'#4a3b22':'#2a221a')+';color:#f3e6c8;font:inherit;font-weight:700;font-size:14px"><span style="font-size:20px">'+t.ic+'</span><br>'+t.lb+'</button>';
 const sub=K.find(c=>c.tagName==='SMALL');const box=document.createElement('div');box.id='tcard';
 try{if(typeof parkNode==='function')add('park','🌳','Parks '+parksOf(i).length+'/3',parkNode(i))}catch(e){}try{if(typeof projNode==='function'&&s.pop>0)add('proj','🏛','Town projects '+projOf(i).length+'/'+TPJ.length,projNode(i))}catch(e){}const selT=tiles.find(t=>t.k===act);box.innerHTML=selT?'<button onclick="tTab('+i+',null)" style="margin:6px 0 4px;padding:8px 14px;border-radius:10px;border:1px solid #6b5a3e;background:#3a2f22;color:#f3e6c8;font:inherit;font-weight:700">‹ Back to '+nm(s)+'</button><div style="font-size:16px;font-weight:700;margin-top:4px">'+selT.ic+' '+selT.lb+'</div><div id="tsub"></div>':(sub?'<div>'+sub.outerHTML+'</div>':'')+st+(ord?head+'<div>'+chips+'</div>':'')+'<div style="display:flex;flex-wrap:wrap;margin-top:8px">'+tiles.map(tb).join('')+'</div><div id="tsub"></div>';
 const title=el.querySelector('b');(K.find(c=>c.tagName==='BR')||title).insertAdjacentElement('afterend',box);
 const keep=new Set([title,box,el.querySelector('#pgen')]);const sel=tiles.find(t=>t.k===act);if(sel&&(sel.k==='park'||sel.k==='proj'))box.querySelector('#tsub').appendChild(sel.node);
 for(const c of K){if(keep.has(c)||c.tagName==='BUTTON'&&!tiles.some(t=>t.node===c))continue;if(c===sub||c===stat||tiles.some(t=>t.node===c)||c.tagName==='DIV'||c.tagName==='SMALL'||c.tagName==='BR'){if(sel&&c===sel.node){box.querySelector('#tsub').appendChild(c);c.querySelectorAll('details').forEach(d=>d.open=true)}else if(c.tagName!=='BUTTON')c.style.display='none'}}
 }catch(e){console.log('tcard',e)}return r};if(typeof window!=='undefined')window.showInfo=showInfo}
if(typeof window!=='undefined')window.tTab=tTab;

// v236 (Sébastien): every window that scrolls shows ▲/▼ arrows (tap to scroll)
if(typeof window!=='undefined'&&typeof document!=='undefined'){const mk=d=>{const b=document.createElement('div');b.textContent=d>0?'▼ more':'▲';b.style.cssText='position:fixed;z-index:60;display:none;padding:3px 12px;border-radius:12px;background:#ffd27a;color:#2a1d0c;font:700 12px system-ui;box-shadow:0 2px 8px rgba(0,0,0,.5);transform:translateX(-50%);cursor:pointer;pointer-events:auto';b.dataset.d=d;document.body.appendChild(b);return b};
 const pool=[];let ui=0;const get=()=>{if(!pool[ui])pool[ui]=[mk(-1),mk(1)];return pool[ui++]};
 const upd=()=>{try{ui=0;const C=[...document.querySelectorAll('#panel,#jobs,[style*="overflow:auto"],[style*="overflow-y:auto"],[style*="overflow: auto"]')];for(const e of C){if(!e.offsetParent&&getComputedStyle(e).position!=='fixed')continue;const cs=getComputedStyle(e);if(cs.display==='none'||cs.visibility==='hidden')continue;if(e.scrollHeight<=e.clientHeight+6)continue;const r=e.getBoundingClientRect();if(r.height<40)continue;const[a,b]=get();const cx=r.left+r.width/2;
   a.style.left=cx+'px';a.style.top=(r.top+4)+'px';a.style.display=e.scrollTop>8?'block':'none';b.style.left=cx+'px';b.style.top=(r.bottom-24)+'px';b.style.display=e.scrollTop+e.clientHeight<e.scrollHeight-8?'block':'none';a.onclick=()=>e.scrollBy({top:-e.clientHeight*.7,behavior:'smooth'});b.onclick=()=>e.scrollBy({top:e.clientHeight*.7,behavior:'smooth'})}
  for(let k=ui;k<pool.length;k++){pool[k][0].style.display='none';pool[k][1].style.display='none'}}catch(e){}};
 setInterval(upd,250);document.addEventListener('scroll',upd,true)}
try{if(document.head){const st=document.createElement('style');st.textContent='#tsub details>summary{display:none}';document.head.appendChild(st)}}catch(e){}

// v238 (Sébastien): one place for train upgrades. Old per-train upgrades (⚡ fast, 📦 big, 🔶 diesel) are refunded and removed;
// all speed/load comes from the Engine shed. Locomotive Works now gives every train +10% speed.
{const o=upMul;upMul=function(k,t){let v=o(k,t);if(k==='eng'&&(S.lm||{}).works)v*=1.1;return v}}
function perTrainRefund(){if(!S||!S.trains||S.v238)return;let m=0,n=0;for(const t of S.trains){let r=0;if(t.fast){r+=2000;t.fast=0}if(t.big){r+=2500;t.big=0}if(t.die){r+=3000;t.die=0}if(r){m+=r;n++}}S.v238=1;if(m){S.money+=m;setTimeout(()=>{try{toast('🔧 Train upgrades now live in the Engine shed. Old per-train upgrades on '+n+' train'+(n>1?'s':'')+' refunded: +'+fmt(m))}catch(e){}},1500)}}
try{perTrainRefund()}catch(e){}
// v238 (Sébastien): Map button opens a menu: map views + "Go to" any town, dock, factory or industry by name
function mapMenuList(q){q=(q||'').toLowerCase();const G={town:[],port:[],fac:[],ind:[],plot:[]};
 sites.forEach((s,i)=>{if(!s||s.hidden||s.type==='dep'||!rev[id(s.x,s.y)])return;const T=TYPES[s.type]||{};if(!TYPES[s.type]&&s.type!=='town')return;const k=s.type==='town'?'town':s.type==='port'?'port':FAC[s.type]?'fac':s.type==='plot'?'plot':'ind';const n=nm(s);if(q&&!n.toLowerCase().includes(q)&&!(islName(islOf(s))||'').toLowerCase().includes(q))return;G[k].push([i,(s.type==='town'?(s.beacon?'👑':'🏘'):FAC[s.type]?TYPES[FAC[s.type].out].g:T.g||'')+' '+n,islName(islOf(s))])});
 const H={town:'🏘 Towns',port:'⚓ Docks',fac:'🏭 Factories',ind:'⛏ Industries',plot:'🚩 Settlement sites'};let h='';
 for(const k in G){if(!G[k].length)continue;G[k].sort((a,b)=>a[1].localeCompare(b[1]));h+='<div style="margin-top:8px;font-weight:700;color:#ffd27a">'+H[k]+' <small style="opacity:.6">'+G[k].length+'</small></div>'+G[k].map(([i,l,isl])=>'<button onclick="mapGo('+i+')" style="display:block;width:100%;text-align:left;margin:3px 0;padding:9px 10px;border-radius:9px;border:1px solid #4a3f2e;background:#2f271d;color:#f3e6c8;font:inherit;font-size:14px">'+l+' <small style="opacity:.6">· '+isl+'</small></button>').join('')}
 return h||'<small style="opacity:.7">Nothing found.</small>'}
function mapGo(i){const s=sites[i];closePanel();locateSite(s);setTimeout(()=>{try{showInfo(s)}catch(e){}},50)}
function showMapMenu(){closeJobs();openShed=null;openFac=null;openInfo=null;const el=document.getElementById('panel');el.style.display='block';
 const chip=(i,v)=>'<button onclick="closePanel();setView('+i+')" style="margin:3px;padding:8px 11px;border-radius:10px;border:1.5px solid '+(viewI===i?'#ffd27a':'#4a3f2e')+';background:'+(viewI===i?'#4a3b22':'#2f271d')+';color:#f3e6c8;font:inherit;font-size:13px">'+(v?v.b:'🗺 Normal')+'</button>';
 el.innerHTML='<b style="font-size:16px">🗺 Map</b><div style="margin-top:6px"><small style="opacity:.75">Show on the map:</small><br>'+VIEWS.map((v,i)=>chip(i,v)).join('')+'</div>'+
  '<div style="margin-top:10px;border-top:1px solid #3d3326;padding-top:8px"><b>📍 Go to</b><input id="mmq" placeholder="Search a name or island…" oninput="document.getElementById(\'mml\').innerHTML=mapMenuList(this.value)" style="display:block;width:100%;box-sizing:border-box;margin-top:6px;padding:9px;border-radius:9px;border:1px solid #6b5a3e;background:#1f1a13;color:#f3e6c8;font:inherit;font-size:15px"><div id="mml">'+mapMenuList('')+'</div></div>';el.scrollTop=0}
try{document.getElementById('viewBtn').onclick=()=>{const el=document.getElementById('panel');if(el.style.display==='block'&&document.getElementById('mml')){closePanel();return}showMapMenu()}}catch(e){}
if(typeof window!=="undefined"){window.showMapMenu=showMapMenu;window.mapGo=mapGo}
// v238 (Sébastien): zoom out further; when zoomed out every building shows a round icon of its type so it is easy to find
{const o=draw;draw=function(){o.apply(this,arguments);try{if(cam.z>=1.1)return;const ICO=cam.z<.55,a=ICO?Math.min(1,(.55-cam.z)/.1):1;ctx.save();ctx.globalAlpha=a;ctx.textAlign='center';ctx.textBaseline='middle';
 for(const s of sites){if(!s||s.hidden||s.type==='dep'||s.type==='plot'||!rev[id(s.x,s.y)])continue;const T=TYPES[s.type]||{};if(!T.g&&s.type!=='town')continue;const sx=((s.x+.5)*TS-cam.x)*cam.z+W/2,sy=((s.y+.5)*TS-cam.y)*cam.z+H/2;if(sx<-30||sy<-30||sx>W+30||sy>H+30)continue;
  const town=s.type==='town',r=town?(s.beacon?15:13):11,col=town?'#ffd27a':s.type==='port'?'#6bb8e8':FAC[s.type]?'#f0a050':'#8fd36b';
  if(!ICO&&!town&&s.type!=='port')continue;const rr0=r;if(ICO){ctx.beginPath();ctx.arc(sx,sy,r,0,7);ctx.fillStyle='rgba(30,25,18,.9)';ctx.fill();ctx.lineWidth=2.5;ctx.strokeStyle=col;ctx.stroke();ctx.font=(town?14:12)+'px system-ui';ctx.fillStyle='#fff';ctx.fillText(town?(s.beacon?'👑':'🏘'):FAC[s.type]?TYPES[FAC[s.type].out].g:T.g,sx,sy+1);}
  try{if(town&&s.linked){const od=ordOf(s);if(od){const need=Object.keys(od).filter(k=>((s.got||{})[k]||0)<od[k]);if(need.length){ctx.font='600 10.5px system-ui';const parts=need.slice(0,3).map(k=>TYPES[k].g+Math.floor((s.got||{})[k]||0)+'/'+od[k]);const t=parts.join(' ');const w=ctx.measureText(t).width+10,yy=ICO?sy-r-11:sy-34*cam.z-14;ctx.fillStyle='rgba(30,25,18,.88)';ctx.beginPath();ctx.roundRect?ctx.roundRect(sx-w/2,yy-8,w,16,8):ctx.rect(sx-w/2,yy-8,w,16);ctx.fill();ctx.strokeStyle='#ffd27a';ctx.lineWidth=1;ctx.stroke();ctx.fillStyle='#fff3d6';ctx.fillText(t,sx,yy+.5)}}}
   if(s.type==='port'&&typeof dockWait==='function'&&selSite()===s){const q=dockWait(s),tot=Math.round(sumG(q));if(tot>0){const gs=Object.keys(q).sort((a,b)=>q[b]-q[a]).slice(0,2);const t='📦 '+tot+' '+gs.map(g=>TYPES[g]?TYPES[g].g:'').join('');ctx.font='600 10.5px system-ui';const w=ctx.measureText(t).width+10,yy=ICO?sy+r+10:sy+22*cam.z+10;ctx.fillStyle='rgba(20,40,60,.9)';ctx.beginPath();ctx.roundRect?ctx.roundRect(sx-w/2,yy-8,w,16,8):ctx.rect(sx-w/2,yy-8,w,16);ctx.fill();ctx.strokeStyle='#6bb8e8';ctx.lineWidth=1;ctx.stroke();ctx.fillStyle='#e8f4ff';ctx.fillText(t,sx,yy+.5)}}}catch(e){}
  if(town&&cam.z<.45){ctx.font='700 11px system-ui';ctx.lineWidth=3;ctx.strokeStyle='rgba(20,18,14,.85)';ctx.strokeText(nm(s),sx,sy+r+9);ctx.fillStyle='#ffe9b0';ctx.fillText(nm(s),sx,sy+r+9)}}
 ctx.restore()}catch(e){}}}
// v238 (Sébastien): dock cards use big tiles too (fishing, scouts, routes, upgrade, warehouse, area map), each opens its own page
function dcardPost(T){const r=null;try{const s=typeof T==='number'?sites[T]:T;if(!s||s.type!=='port'||s.hidden)return r;const el=document.getElementById('panel');if(!el)return r;const i=sites.indexOf(s);
 {const db=el.querySelector('#dcard');if(db){const title=el.querySelector('b'),mp=[...el.children].find(c=>c.tagName==='DIV'&&c!==db&&/Map of the area/.test(c.innerText||c.textContent||''));if(mp)mp.style.display='none';for(const c of [...el.children])if(c!==db&&c.tagName==='DIV'&&/^\s*🚂\s*\d*\s*(no )?trains? (on|work)/i.test(c.innerText||c.textContent||''))c.remove();
  if(TTAB[i]&&db.querySelector('#tsub'))for(const c of [...el.children])if(c!==title&&c!==db&&c.id!=='pgen'&&c.style)c.style.display='none';return r}}
 const d=el.querySelector('details');if(!d)return r;const K=[...el.children];const mp=K.find(c=>c.tagName==='DIV'&&/Map of the area/.test(c.innerText||c.textContent||''));
 const L=[[/^\s*🎣/,'fish','🎣','Fishing'],[/^\s*🧭/,'scout','🧭','Sea scouts'],[/^\s*🌊/,'route','🌊','Sea routes'],[/^\s*⬆/,'up','⬆','Dock upgrade'],[/^\s*🏬/,'wh','🏬','Warehouse']];
 const tiles=[];{const trn=K.filter(c=>c.tagName==='DIV'&&/^\s*🚂\s*\d*\s*(no )?trains? (on|work)/i.test(c.innerText||c.textContent||''));if(trn.length){const n=((trn[0].innerText||'').match(/(\d+) trains?/)||[])[1]||0;tiles.push({k:'itr',ic:'🚂',lb:'Island trains · '+n,node:trn[0],warn:!+n});trn.slice(1).forEach(x=>x.remove())}
  const shp=K.find(c=>c.tagName==='DIV'&&/^\s*🚢 Cargo ships/.test(c.innerText||c.textContent||''));if(shp)tiles.push({k:'ships',ic:'🚢',lb:'Cargo ships',node:shp})}
 const dw=el.querySelector('#dockwait');let sumH='';if(dw&&dw.parentNode===el){let tot=0;try{tot=Math.round(sumG(dockWait(s)))}catch(e){}tiles.unshift({k:'wait',ic:'📦',lb:'Waiting goods · '+tot,node:dw});
  sumH='<div style="margin-top:6px;padding:7px 9px;border-radius:9px;background:#1f2a33;border:1px solid #3f6b8a;display:flex;align-items:center;gap:8px;flex-wrap:wrap"><span style="flex:1;min-width:150px">📦 <b>'+tot+'</b> goods waiting here · 🚢 <b>'+S.ships.length+'</b> ship'+(S.ships.length===1?'':'s')+'</span>'+shipBuyBtn()+'</div>'}
 for(const c of [...d.children]){if(c.tagName==='SUMMARY')continue;const t=(c.innerText||c.textContent||'');const m=L.find(x=>x[0].test(t));if(m)tiles.push({k:m[1],ic:m[2],lb:m[3],node:c})}if(!tiles.length)return r;
 const act=TTAB[i],sel=tiles.find(t=>t.k===act);const hadMap=(S.maps||[]).some(m=>m.x===s.x&&m.y===s.y);const tb=t=>'<button onclick="tTab('+i+',\''+t.k+'\')" style="flex:1 1 30%;min-height:54px;margin:3px;padding:8px 4px;border-radius:12px;border:'+(t.warn?'2px solid #e05a3a':'1px solid #6b5a3e')+';background:#2a221a;color:#f3e6c8;font:inherit;font-weight:700;font-size:13px"><span style="font-size:20px">'+t.ic+'</span><br>'+t.lb+'</button>';
 const box=document.createElement('div');box.id='dcard';const title=el.querySelector('b');
 if(sel){box.innerHTML='<button onclick="tTab('+i+',null)" style="margin:6px 0 4px;padding:8px 14px;border-radius:10px;border:1px solid #6b5a3e;background:#3a2f22;color:#f3e6c8;font:inherit;font-weight:700">‹ Back to '+nm(s)+'</button><div id="tsub"></div>';
  title.insertAdjacentElement('afterend',box);if(sel.node){box.querySelector('#tsub').appendChild(sel.node);sel.node.style.display='';sel.node.querySelectorAll('details').forEach(x=>x.open=true)}
  for(const c of K)if(c!==title&&c!==box&&c!==sel.node&&c.id!=='pgen'&&c.style)c.style.display='none'}
 else{for(const t of tiles)if(t.node&&t.node.parentNode===el)t.node.style.display='none';box.innerHTML=sumH+'<div style="display:flex;flex-wrap:wrap;margin-top:8px">'+tiles.map(tb).join('')+(hadMap?'':'<button onclick="buyMap('+i+')" style="flex:1 1 30%;min-height:54px;margin:3px;padding:8px 4px;border-radius:12px;border:1px solid #6b5a3e;background:#2a221a;color:#f3e6c8;font:inherit;font-weight:700;font-size:13px"><span style="font-size:20px">🗺</span><br>Area map · '+fmt(mapCost())+'</button>')+'</div>';d.replaceWith(box);if(mp)mp.style.display='none'}
 }catch(e){console.log('dcard',e)}return r}
{const o=showInfo;showInfo=function(T){const r=o.apply(this,arguments);dcardPost(T);return r};if(typeof window!=='undefined')window.showInfo=showInfo}
if(typeof showPort==='function'){const o=showPort;showPort=function(P){const r=o.apply(this,arguments);dcardPost(typeof P==='number'?sites[P]:P);return r};if(typeof window!=='undefined')window.showPort=showPort}
// v238 (Sébastien: bigger and nicer buildings): detailed miniature industry and factory models
function drawInd2(s,X,Y,T,tm){const c=ctx,mine=s.type==='coal'||s.type==='iron'||s.type==='stone';
 c.fillStyle='rgba(0,0,0,.28)';c.beginPath();c.ellipse(X+3,Y+10,19,6,0,0,7);c.fill();
 c.fillStyle='#8c8274';c.fillRect(X-15,Y+7,30,4);// stone footing
 c.fillStyle=s.type==='wood'?'#9a7448':'#d8c49a';c.fillRect(X-14,Y-6,28,14);// walls
 if(s.type==='wood'){c.strokeStyle='#7a5832';c.lineWidth=.8;for(let k=-3;k<8;k+=3){c.beginPath();c.moveTo(X-14,Y+k);c.lineTo(X+14,Y+k);c.stroke()}}
 else{c.strokeStyle='#b8a47a';c.lineWidth=.6;c.beginPath();c.moveTo(X-14,Y+1);c.lineTo(X+14,Y+1);c.stroke()}
 const lit=s.stock>0&&Math.sin(tm*.7+s.x)>-.6;c.fillStyle=lit?'#ffe08a':'#4b5560';c.fillRect(X-11,Y-3,5,5);c.fillRect(X+6,Y-3,5,5);c.strokeStyle='#5a4128';c.lineWidth=.8;c.strokeRect(X-11,Y-3,5,5);c.strokeRect(X+6,Y-3,5,5);
 c.fillStyle='#5a4128';c.fillRect(X-2,Y+1,5,7);c.fillStyle='#e9c46a';c.fillRect(X+2,Y+4,1,1);// door
 // roof with shingles and ridge
 c.fillStyle=T.col;c.beginPath();c.moveTo(X-18,Y-5);c.lineTo(X-10,Y-17);c.lineTo(X+10,Y-17);c.lineTo(X+18,Y-5);c.closePath();c.fill();
 c.strokeStyle='rgba(0,0,0,.25)';c.lineWidth=.7;for(let k=1;k<4;k++){const yy=Y-5-k*3;c.beginPath();c.moveTo(X-18+k*2,yy);c.lineTo(X+18-k*2,yy);c.stroke()}
 c.strokeStyle='rgba(255,255,255,.35)';c.lineWidth=1;c.beginPath();c.moveTo(X-10,Y-17);c.lineTo(X+10,Y-17);c.stroke();
 c.fillStyle='#6b5040';c.fillRect(X+7,Y-22,4,7);c.fillStyle='#4a3a30';c.fillRect(X+6,Y-23,6,2);// chimney
 if(s.stock>0){c.fillStyle='rgba(225,220,210,.45)';for(let k=0;k<2;k++){const u=(tm*.35+k*.5)%1;c.beginPath();c.arc(X+9+u*5,Y-25-u*9,1.5+u*2.5,0,7);c.fill()}}
 if(mine){// headframe with turning wheel beside the shed
  c.strokeStyle='#3e3530';c.lineWidth=1.6;c.beginPath();c.moveTo(X-22,Y+8);c.lineTo(X-17,Y-24);c.lineTo(X-12,Y+8);c.moveTo(X-20,Y-6);c.lineTo(X-14,Y-6);c.stroke();
  c.save();c.translate(X-17,Y-24);c.rotate(s.stock<IND.cap(s)?tm*1.5:0);c.strokeStyle='#2a2420';c.lineWidth=1.2;c.beginPath();c.arc(0,0,3.5,0,7);c.moveTo(-3.5,0);c.lineTo(3.5,0);c.moveTo(0,-3.5);c.lineTo(0,3.5);c.stroke();c.restore();
  c.fillStyle='#2a2420';c.beginPath();c.arc(X+11,Y+10,4,Math.PI,0);c.fill()}
 else if(s.type==='wood'){c.fillStyle='#3f6b33';for(const[dx,dy,r]of[[-22,-8,6],[-24,2,5],[21,-12,5]]){c.beginPath();c.arc(X+dx,Y+dy,r,0,7);c.fill()}c.fillStyle='#6b4a26';c.fillRect(X-23,Y+4,2,4)}
 else if(s.type==='oil'){c.strokeStyle='#3a3540';c.lineWidth=1.6;c.beginPath();c.moveTo(X+13,Y+9);c.lineTo(X+18,Y-26);c.lineTo(X+23,Y+9);c.moveTo(X+14.5,Y);c.lineTo(X+21.5,Y);c.moveTo(X+16,Y-12);c.lineTo(X+20,Y-12);c.stroke();c.fillStyle='#2b2b38';c.fillRect(X-24,Y-2,7,10);c.fillStyle='#55556a';c.fillRect(X-24,Y-3,7,2)}
 else{c.fillStyle='#e8d9a8';c.beginPath();c.arc(X-20,Y+2,5,Math.PI,0);c.fill();c.fillRect(X-25,Y+2,10,6);c.strokeStyle='#8a6d3e';c.lineWidth=.8;c.strokeRect(X-25,Y+2,10,6)}// farm: grain silo
}
function drawFac2(s,X,Y,T,tm){const c=ctx;
 c.fillStyle='rgba(0,0,0,.3)';c.fillRect(X-15,Y-5,36,21);
 c.fillStyle='#8c3f2c';c.fillRect(X-18,Y-9,34,20);// brick hall
 c.strokeStyle='rgba(0,0,0,.18)';c.lineWidth=.6;for(let yy=Y-6;yy<Y+11;yy+=3){c.beginPath();c.moveTo(X-18,yy);c.lineTo(X+16,yy);c.stroke()}
 c.fillStyle=T.col;c.fillRect(X-18,Y-11,34,3);// coloured band
 const lit=s.stock>0||(s.inv&&Object.values(s.inv).some(v=>v>0));for(let k=0;k<4;k++){c.fillStyle=lit?'#ffd98a':'#4b5560';c.fillRect(X-15+k*8,Y-6,5,6);c.strokeStyle='#3a2a20';c.lineWidth=.6;c.strokeRect(X-15+k*8,Y-6,5,6)}
 c.fillStyle='#4a3a30';c.fillRect(X-6,Y+3,8,8);c.fillStyle='#6b5040';c.fillRect(X-5,Y+4,6,7);// loading door
 c.fillStyle='#5b5560';for(let k=0;k<3;k++){c.beginPath();c.moveTo(X-18+k*11.3,Y-11);c.lineTo(X-18+k*11.3,Y-20);c.lineTo(X-6.7+k*11.3,Y-11);c.fill();c.fillStyle='#a8c8d8';c.fillRect(X-17+k*11.3,Y-18,1.5,6);c.fillStyle='#5b5560'}// sawtooth roof with glazing
 c.fillStyle='#7a3424';c.fillRect(X+17,Y-30,5,30);c.fillStyle='#e9e2d0';c.fillRect(X+17,Y-27,5,1.5);c.fillRect(X+17,Y-21,5,1.5);c.fillStyle='#5a281c';c.fillRect(X+16,Y-32,7,3);// tall chimney
 if(lit){c.fillStyle='rgba(220,215,205,.5)';for(let k=0;k<3;k++){const u=(tm*.4+k*.33)%1;c.beginPath();c.arc(X+19.5+u*7,Y-34-u*12,2+u*3.5,0,7);c.fill()}}
 c.strokeStyle='#e9a646';c.lineWidth=1.5;c.strokeRect(X-18,Y-9,34,20)}

// v239 (Sébastien): fog landmarks give small lasting local perks, placed where they make sense
Object.assign(POIT,{
 ruins:{n:'Old Mine Ruins',g:'⛏',h:'old diggings?',d:'Abandoned mine workings by the mountains. Bring track here: mines and quarries within 8 tiles produce 10% more.'},
 ranger:{n:'Ranger Hut',g:'🌲',h:'smoke in the woods?',d:'A forest ranger\'s hut. Bring track here: lumber camps within 8 tiles produce 10% more.'},
 mill:{n:'Old Windmill',g:'🌾',h:'turning sails?',d:'A old windmill among the fields. Bring track here: wheat farms within 8 tiles produce 10% more.'},
 light:{n:'Lighthouse',g:'🗼',h:'a light at sea?',d:'An old lighthouse on the coast. Bring track here and relight it: ships sail 20% faster inside its light (10 tiles).'}});
POIT.oldstn.d='An abandoned station from an older railway. Bring track here: its old workshop keeps trains on this island 5% cheaper to run.';
POIT.falls.d='A famous waterfall. Bring track here and tourists come: town orders within 12 tiles pay 10% bigger rewards.';
const PERKR=8,LIGHTR=10;
(function poiRetype(){if(typeof POIS==='undefined')return;const P=S&&S.poi||{},home=ISLC[id(C,C)];/* v267c: a landmark keeps the type it was first given (saved in S.poiT); claimed ones used to fall back to their old type on reload */const KEEP=S&&S.poiT;const near=(p,r,f)=>{let n=0;for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){const x=p.x+dx,y=p.y+dy;if(x<0||y<0||x>=N||y>=N)continue;if(f(terr[id(x,y)]))n++}return n};
 POIS.forEach((p,j)=>{if(KEEP&&KEEP[j]){p.t=KEEP[j];return}if(p.t==='lookout'&&p.k===home)return;
  const m=near(p,3,t=>t===4),f=near(p,2,t=>t===2),w=near(p,2,t=>t===0),h=hash(p.x,p.y,177);
  p.t=m>=3?'ruins':w>=3?'light':f>=5?'ranger':h<.5?'mill':h<.8?'oldstn':'lookout'});if(S){S.poiT=POIS.map(p=>p.t)}})();
const poiOn=(t)=>POIS.filter((p,j)=>p.t===t&&(S.poi||{})[j]===2);
function lightMul(pt){if(!pt)return 1;for(const p of poiOn('light'))if(Math.hypot(p.x-pt[0],p.y-pt[1])<=LIGHTR)return 1.2;return 1}
{const r0=IND.rate;IND.rate=function(s){let v=r0.apply(this,arguments);try{if(s&&s.type!=='port'){const k=s.type==='coal'||s.type==='iron'||s.type==='stone'?'ruins':s.type==='wood'?'ranger':s.type==='farm'?'mill':null;if(k&&poiOn(k).some(p=>Math.hypot(p.x-s.x,p.y-s.y)<=PERKR))v*=1.1}}catch(e){}return v}}
{const o=upMul;upMul=function(k,t){let v=o(k,t);if(k==='rep'&&t){try{const q=tIsl(t);if(poiOn('oldstn').some(p=>p.k===q))v*=.95}catch(e){}}return v}}
{const o=claimPOI;claimPOI=function(j){const p=POIS[j];if(!p||!['ruins','ranger','mill','light','oldstn'].includes(p.t))return o.apply(this,arguments);
 S.poi[j]=2;if(typeof stroke!=='undefined'&&stroke.length)stroke.locked=1;if(typeof lastStroke!=='undefined'&&lastStroke)lastStroke.locked=1;const T=POIT[p.t],n=Object.values(S.poi).filter(v=>v===2).length;
 const why={ruins:'Mines and quarries within <b>8 tiles</b> now produce <b>10% more</b>.',ranger:'Lumber camps within <b>8 tiles</b> now produce <b>10% more</b>.',mill:'Wheat farms within <b>8 tiles</b> now produce <b>10% more</b>.',light:'The lamp is lit: ships sail <b>20% faster</b> inside its light (<b>10 tiles</b>).',oldstn:'Its old workshop now services your trains: trains on '+islName(p.k)+' cost <b>5% less</b> to run.'}[p.t];
 try{showPOICard(T,why,n)}catch(e){toast(T.g+' '+T.n+': '+why.replace(/<[^>]+>/g,''))}save()}}
function showPOICard(T,why,n){const el=document.getElementById('panel');closeJobs();openShed=null;openFac=null;openInfo=null;PANEL=null;el.style.display='block';
 el.innerHTML='<b style="font-size:16px">'+T.g+' Landmark '+n+'/'+POIS.length+': '+T.n+'</b><div style="margin-top:6px">Your track reached it. '+why+'</div><small style="opacity:.75;display:block;margin-top:6px">A lasting bonus for this area. More landmarks are hidden in the fog; reach each one with track.</small><button onclick="closePanel()" style="margin-top:8px;padding:8px 14px;border-radius:10px;border:0;background:#e9a646;color:#2a1d0c;font:inherit;font-weight:700">OK</button>'}
// lighthouse light on the map
{const o=draw;draw=function(){o.apply(this,arguments);try{const L=poiOn('light');if(!L.length)return;const tm=performance.now()/1000;for(const p of L){const sx=((p.x+.5)*TS-cam.x)*cam.z+W/2,sy=((p.y+.5)*TS-cam.y)*cam.z+H/2,R=LIGHTR*TS*cam.z;if(sx<-R||sy<-R||sx>W+R||sy>H+R)continue;
 ctx.save();const g=ctx.createRadialGradient(sx,sy,0,sx,sy,R);g.addColorStop(0,'rgba(255,236,150,.22)');g.addColorStop(1,'rgba(255,236,150,0)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(sx,sy,R,0,7);ctx.fill();
 ctx.setLineDash([6,6]);ctx.strokeStyle='rgba(255,226,140,.45)';ctx.lineWidth=1.5;ctx.stroke();ctx.setLineDash([]);const a=tm*.8;ctx.fillStyle='rgba(255,240,170,.18)';ctx.beginPath();ctx.moveTo(sx,sy);ctx.arc(sx,sy,R,a,a+.35);ctx.closePath();ctx.fill();ctx.restore()}}catch(e){}}}
// v239 (Sébastien waited at a Refinery not knowing tank wagons were missing): a big pulsing ! over any building whose goods its island's trains can't carry
function wagonBlock(s){try{if(!s||s.hidden||!s.linked||!(isInd(s)||isFac(s)))return null;const q=islOf(s),ks=[offerOf(s)];if(isFac(s)&&FAC[s.type])ks.push(...Object.keys(FAC[s.type].in));for(const k of ks){if(k&&!canCarry(k,q))return CARGO[cargoCls(k)]}}catch(e){}return null}
{const o=needBadges;needBadges=function(s){if(wagonBlock(s))return[];return o.apply(this,arguments)}}
{const o=draw;draw=function(){o.apply(this,arguments);try{if(cam.z<.55||wagonDrawOff)return;const tm=performance.now()/1000;for(const s of sites){const c=wagonBlock(s);if(!c)continue;const sx=((s.x+.5)*TS-cam.x)*cam.z+W/2,sy=((s.y+.5)*TS-cam.y)*cam.z+H/2-30*Math.min(1.6,cam.z);if(sx<-80||sy<-80||sx>W+80||sy>H+80)continue;
 const r=14+2*Math.sin(tm*5);ctx.save();ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='rgba(224,32,32,.25)';ctx.beginPath();ctx.arc(sx,sy,r+7,0,7);ctx.fill();ctx.fillStyle='#e02020';ctx.beginPath();ctx.arc(sx,sy,r,0,7);ctx.fill();ctx.lineWidth=2.5;ctx.strokeStyle='#fff';ctx.stroke();ctx.fillStyle='#fff';ctx.font='900 20px system-ui';ctx.fillText('!',sx,sy+1);
 const t='Needs '+c.n;ctx.font='700 12px system-ui';const w=ctx.measureText(t).width+14;ctx.fillStyle='rgba(120,16,16,.92)';ctx.beginPath();ctx.roundRect?ctx.roundRect(sx-w/2,sy+r+5,w,19,9):ctx.rect(sx-w/2,sy+r+5,w,19);ctx.fill();ctx.fillStyle='#fff';ctx.fillText(t,sx,sy+r+15);ctx.restore()}}catch(e){}}}

// v239 (Sébastien OK'd): town parks. Up to 3 per town ($5k/10k/20k), placed on free grass beside it; each makes the town's orders 5% smaller
const PARKC=[5000,10000,20000];
function parksOf(i){return(S.parks||[]).filter(p=>p.t===i&&!p.pj)}
function parkFree(x,y){if(x<1||y<1||x>=N-1||y>=N-1)return false;const k=id(x,y);if(terr[k]!==1||track.has(k)||!rev[k])return false;if(sites.some(o=>!o.hidden&&Math.abs(o.x-x)<=0&&Math.abs(o.y-y)<=0))return false;if(typeof bldAt==='function'){try{if(bldAt(x,y))return false}catch(e){}}if(typeof stnAt==='function'){try{if(stnAt(x,y))return false}catch(e){}}return!(S.parks||[]).some(p=>p.x===x&&p.y===y)}
function parkSpot(s){let best=null,bd=1e9;for(let dy=-4;dy<=4;dy++)for(let dx=-4;dx<=4;dx++){const d=Math.hypot(dx,dy);if(d<2||d>4.3)continue;const x=s.x+dx,y=s.y+dy;if(!parkFree(x,y))continue;let adj=0;for(const[a,b]of D4)if(track.has(id(x+a,y+b)))adj++;const sc=d+adj*2+hash(x,y,5)*.3;if(sc<bd){bd=sc;best=[x,y]}}return best}
function buyPark(i){const s=sites[i],n=parksOf(i).length;if(n>=3)return;const c=PARKC[n];if(S.money<c){toast('Costs '+fmt(c));return}const p=parkSpot(s);if(!p){toast('No free grass near '+nm(s)+' for a park');return}S.money-=c;S.parks=S.parks||[];S.parks.push({t:i,x:p[0],y:p[1]});AUTO.k='';toast('🌳 Park opened in '+nm(s)+': its orders are now '+5*(n+1)+'% smaller');save();refreshPanel()}
function parkNode(i){const s=sites[i],n=parksOf(i).length,d=document.createElement('div');const sp=n<3?parkSpot(s):null;
 d.innerHTML='<small style="opacity:.85">Parks make '+nm(s)+' a nicer place: each one makes its town orders <b>5% smaller</b> (fewer goods to deliver for the next size). Up to 3 per town.</small><div style="margin-top:6px">'+[0,1,2].map(k=>k<n?'🌳':'<span style="opacity:.3">🌳</span>').join(' ')+' <b>'+n+'/3</b>'+(n?' · orders −'+5*n+'%':'')+'</div>'+
  (n<3?(sp?tbtn('🌳 Build a park · '+fmt(PARKC[n]),'buyPark('+i+')',S.money<PARKC[n]):'<small style="color:#ffb36b">No room left in '+nm(s)+'\'s streets: track, water or other buildings fill every block.</small>'):'<small>✅ All 3 parks built.</small>');return d}
{const o=fishOrd;fishOrd=function(t,ord){const r=o.apply(this,arguments);try{const i=sites.indexOf(t),n=r&&S.parks?parksOf(i).length:0;if(n){const q={};for(const k in r)q[k]=Math.max(1,Math.ceil(r[k]*(1-.05*n)));return q}}catch(e){}return r}}
{const o=draw;draw=function(){o.apply(this,arguments);try{if(!S.parks||!S.parks.length||cam.z<.55)return;const z=cam.z,tm=performance.now()/1000;for(const p of S.parks){if(p.gx!=null)continue;const k=id(p.x,p.y);if(track.has(k))continue;const sx=((p.x+.5)*TS-cam.x)*z+W/2,sy=((p.y+.5)*TS-cam.y)*z+H/2,h=TS*z/2;if(sx<-h||sy<-h||sx>W+h||sy>H+h)continue;
 ctx.save();ctx.translate(sx,sy);ctx.scale(z,z);ctx.fillStyle='#5f9a4c';ctx.fillRect(-15,-15,30,30);ctx.strokeStyle='#e8dcc0';ctx.lineWidth=1;ctx.strokeRect(-15,-15,30,30);
 ctx.strokeStyle='#d9c79a';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-15,0);ctx.lineTo(15,0);ctx.moveTo(0,-15);ctx.lineTo(0,15);ctx.stroke();
 ctx.fillStyle='#8fc7e8';ctx.beginPath();ctx.arc(0,0,4.5,0,7);ctx.fill();ctx.strokeStyle='#cfc6b0';ctx.lineWidth=1.2;ctx.stroke();ctx.fillStyle='rgba(255,255,255,'+(.5+.3*Math.sin(tm*4))+')';ctx.beginPath();ctx.arc(0,-1,1.2,0,7);ctx.fill();
 for(const[x,y]of[[-8,-8],[8,-8],[-8,8],[8,8]]){ctx.fillStyle='rgba(0,0,0,.2)';ctx.beginPath();ctx.arc(x+1.5,y+2,4.5,0,7);ctx.fill();ctx.fillStyle='#3f7a33';ctx.beginPath();ctx.arc(x,y,4.5,0,7);ctx.fill();ctx.fillStyle='#e07aa0';ctx.beginPath();ctx.arc(x+2,y-2,1,0,7);ctx.fill()}
 ctx.restore()}}catch(e){}}}
if(typeof window!=='undefined'){window.buyPark=buyPark}
// v239 (Sébastien): rare events. About one every 8-10 min (none in the first 15 min), at most 2 at once.
// ⛈ storms slow trains and ships in one area; 🔧 a broken rail blocks that square (both lanes) until a repair handcar
// rides out from the Engine shed (or the nearest linked town on other islands) and fixes it; trains/ships stop briefly for repairs.
const STORMSLOW=.25,EVGAP=[480,600],STORMR=6,CREWV=2.4,CREWWAIT=60,FIXWORK=14;
S.storms=S.storms||[];S.crews=S.crews||[];
const stormAt=(x,y)=>(S.storms||[]).some(s=>Math.hypot(s.x-x,s.y-y)<=s.r);
function stormMulT(t){try{if(!S.storms||!S.storms.length||!t.path)return 1;const c=t.path[Math.min(t.path.length-1,Math.floor(t.pos||0))];return c&&stormAt(c[0],c[1])?STORMSLOW:1}catch(e){return 1}}
{const o=lightMul;lightMul=function(pt){let v=o(pt);if(pt&&stormAt(pt[0],pt[1]))v*=STORMSLOW;return v}}
function evActive(){return(S.storms||[]).length+Object.keys(S.broken||{}).length+S.trains.filter(t=>t.repT>0).length+S.ships.filter(s=>s.repT>0).length}
function bfsAvoid(start,goal){const dist=new Int32Array(N*N).fill(-1),prev=new Int32Array(N*N).fill(-1),q=[start];dist[start]=0;for(let h=0;h<q.length;h++){const i=q[h];if(i===goal)break;const x=i%N,y=(i/N)|0;for(const[dx,dy]of D4){const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=N||ny>=N)continue;const j=id(nx,ny);if(dist[j]<0&&isRail(nx,ny)&&!laneSet.has(j)&&(j===goal||S.broken[j]===undefined)){dist[j]=dist[i]+1;prev[j]=i;q.push(j)}}}if(dist[goal]<0)return null;const p=[];let i=goal;while(i!==-1){p.unshift([i%N,(i/N)|0]);i=prev[i]}return p}
function crewBase(i){const q=ISLC[i],x=i%N,y=(i/N)|0;const sh=S.sheds&&S.sheds[0];if(sh&&ISLC[id(sh.x,sh.y)]===q){const p=bfsAvoid(id(sh.x,sh.y),i)||(sites[hubI()]?bfsAvoid(id(sites[hubI()].x,sites[hubI()].y),i):null);if(p)return p}
 let best=null;for(const o of sites)if(o.type==='town'&&o.linked&&!o.hidden&&ISLC[id(o.x,o.y)]===q){const p=bfsAvoid(id(o.x,o.y),i);if(p&&(!best||p.length<best.length))best=p}return best}
const evPick=a=>a[Math.floor(Math.random()*a.length)];
fireEvent=function(){try{if(!S.auto||S.t<900)return;if(S.evN==null)S.evN=S.t+EVGAP[0]*Math.random();if(S.t<S.evN)return;if(evActive()>=2)return;S.evN=S.t+EVGAP[0]+Math.random()*(EVGAP[1]-EVGAP[0]);
 const r=Math.random(),busy=[];for(const t of S.trains)if(t.path)for(const[x,y]of t.path){const i=id(x,y);if(track.has(i)&&!siteAt(x,y))busy.push(i)}
 if(r<.4&&busy.length){const i=evPick(busy),x=i%N,y=(i/N)|0,d=75+Math.random()*45;S.storms.push({x,y,r:STORMR,t:d,d});evNote('⛈ A storm rolls in near '+nearName(x,y)+': trains and ships there run slower for about '+Math.round(d/60*2)/2+' min.',i);return}
 if(r<.75&&busy.length&&typeof breakRail==='function'){const c=busy.filter(i=>S.broken[i]===undefined&&!dblJunc(i));if(!c.length)return;const i=evPick(c);brk(i);return}
 if(r<.9){const c=S.trains.filter(t=>t.path&&(t.st==='toSrc'||t.st==='toDst')&&!(t.repT>0));if(c.length){const t=evPick(c);t.repT=30;t.wait=Math.max(t.wait||0,30);const p=t.path[Math.min(t.path.length-1,Math.floor(t.pos||0))];evNote('🔧 Train '+tNo(t)+' stops for a quick repair (30 s), then carries on.',p?id(p[0],p[1]):null);return}}
 const sc=S.ships.filter(s=>s.st==='dock'&&!(s.repT>0));if(sc.length){const s=evPick(sc);s.repT=30;const P=sites[s.at];evNote('🔧 A ship is being repaired at '+(P?nm(P):'its dock')+' (30 s).',P?id(P.x,P.y):null)}}catch(e){console.log('ev',e)}};
function dblJunc(i){let n=0;const x=i%N,y=(i/N)|0;for(const[a,b]of D4)if(isRail(x+a,y+b))n++;return n>2}
function nearName(x,y){let b=null,bd=1e9;for(const o of sites)if(o.type==='town'&&!o.hidden&&o.linked){const d=Math.hypot(o.x-x,o.y-y);if(d<bd){bd=d;b=o}}return b?nm(b):'your line'}
function brk(i){const x=i%N,y=(i/N)|0,near=k=>{let n=0;for(let j=-1;j<=1;j++)for(let q=-1;q<=1;q++)if(terr[id(x+q,y+j)]===k)n++;return n};const why=terr[i]===0?'🌊 A flood washed out the line':near(4)?'🪨 A rockslide buried the line':near(2)?'🌲 A fallen tree blocked the line':'☀️ Heat buckled the rails';
 S.broken[i]=1e9;S.crews.push({i,st:'wait',w:CREWWAIT});evNote(why+' near '+nearName(x,y)+'. Trains go around it or wait. A repair crew sets off in 1 min, or tap Fix to send it now.',i)}
function evNote(txt,i){try{toast(txt)}catch(e){}try{news(txt,true)}catch(e){}}
function crewGo(c){const p=crewBase(c.i);if(!p){c.st='fix';c.w=FIXWORK;c.path=null;return}c.path=p;c.pos=0;c.st='go'}
function sendCrew(i,pay){const c=S.crews.find(c=>c.i===i);if(!c||c.st!=='wait')return;if(pay){if(S.money<FIXC){toast('Costs '+fmt(FIXC));return}S.money-=FIXC}crewGo(c);toast('🛠 Repair crew on its way');refreshPanel()}
showFix=function(i){const el=document.getElementById('panel');openShed=null;openFac=null;openInfo=null;el.style.display='block';const c=S.crews.find(c=>c.i===i),w=S.trains.filter(t=>t.brk===i).length;PANEL={n:'showFix',a:[i]};
 const st=!c?'':c.st==='wait'?'The crew sets off in <b>'+Math.ceil(c.w)+' s</b>.':c.st==='go'?'🛠 The crew is riding out on its handcar.':c.st==='fix'?'🔨 The crew is repairing it: <b>'+Math.ceil(c.w)+' s</b> left.':'Fixed.';
 el.innerHTML='<b style="font-size:16px">🔧 Broken rail</b><div style="margin-top:4px">'+(w?w+' train'+(w>1?'s are':' is')+' waiting here.':'Trains go around it if they can, otherwise they wait.')+' Both rails on this square are out.</div><div style="margin-top:4px">'+st+'</div>'+(c&&c.st==='wait'?'<div style="margin-top:6px">'+tbtn('🛠 Send the crew now · '+fmt(FIXC),'sendCrew('+i+',1)',S.money<FIXC)+'</div>':'')+'<i id="pgen"></i>'};
if(typeof window!=='undefined'){window.showFix=showFix;window.sendCrew=sendCrew}
function evTick(dt){if(!S.auto)return;
 for(const s of S.storms)s.t-=dt;if(S.storms.some(s=>s.t<=0)){S.storms=S.storms.filter(s=>s.t>0);toast('🌤 The storm has cleared')}
 for(const t of S.trains)if(t.repT>0)t.repT-=dt;
 for(const s of S.ships)if(s.repT>0){s.repT-=dt;if(s.st==='dock')s.w=Math.min(s.w||0,0)}
 for(const c of S.crews){if(c.st==='wait'){c.w-=dt;if(c.w<=0)crewGo(c)}else if(c.st==='go'){c.pos+=dt*CREWV;if(c.pos>=c.path.length-1){c.pos=c.path.length-1;c.st='fix';c.w=FIXWORK}}
  else if(c.st==='fix'){c.w-=dt;if(c.w<=0){delete S.broken[c.i];c.st=c.path?'back':'done';if(c.path){c.path=c.path.slice().reverse();c.pos=0}toast('🔧 Rail repaired: trains are moving again')}}
  else if(c.st==='back'){c.pos+=dt*CREWV;if(c.pos>=c.path.length-1)c.st='done'}}
 S.crews=S.crews.filter(c=>c.st!=='done');
 // trains held at a break try another way
 for(const t of S.trains){if(t.brk==null||!t.path)continue;if((t.rrT=(t.rrT||0)-dt)>0)continue;t.rrT=3;const g=t.path[t.path.length-1],c=Math.floor(t.pos||0),from=t.path[c];if(!g||!from)continue;const p=bfsAvoid(id(from[0],from[1]),id(g[0],g[1]));if(p&&p.length>1){t.path=t.path.slice(0,c).concat(p);t.brk=null}}}
{const o=tick;tick=function(dt){o(dt);try{if(typeof awayNow==='function'&&awayNow())return;evTick(dt)}catch(e){}}}
// drawing: storm clouds and rain, broken square, handcar crew at work
{const o=draw;draw=function(){o.apply(this,arguments);try{const z=cam.z,tm=performance.now()/1000,P=(x,y)=>[((x+.5)*TS-cam.x)*z+W/2,((y+.5)*TS-cam.y)*z+H/2];
 for(const s of S.storms||[]){const[sx,sy]=P(s.x,s.y),R=s.r*TS*z,fade=Math.min(1,s.t/8,(s.d-s.t)/8);ctx.save();ctx.globalAlpha=Math.max(0,fade);
  // v249 (Sébastien): real-looking storm clouds: a soft dark shadow on the ground, rain under the clouds, and three drifting
  // cumulus clouds built from overlapping puffs (dark bellies, lighter tops), with the odd flash of lightning
  const g=ctx.createRadialGradient(sx,sy,R*.2,sx,sy,R);g.addColorStop(0,'rgba(30,36,48,.42)');g.addColorStop(1,'rgba(30,36,48,0)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(sx,sy,R,0,7);ctx.fill();
  ctx.strokeStyle='rgba(185,205,235,.55)';ctx.lineWidth=Math.max(1,z*.6);for(let k=0;k<70;k++){const a=hash(k,7,3)*6.283,rr=Math.sqrt(hash(k,9,4))*R*.9,x=sx+Math.cos(a)*rr,y0=sy+Math.sin(a)*rr*.8,ph=(tm*1.8+hash(k,1,2))%1,L=7*z;ctx.globalAlpha=Math.max(0,fade)*(1-ph*.6);ctx.beginPath();ctx.moveTo(x-1*z,y0-L+ph*L*2);ctx.lineTo(x-2.5*z,y0+ph*L*2);ctx.stroke()}ctx.globalAlpha=Math.max(0,fade);
  const flash=Math.sin(tm*1.3+s.x)>.985;
  for(let c=0;c<3;c++){const dr=(tm*.012*TS*z+c*R*.7)%(R*1.2)-R*.6,cx=sx+[-.38,.3,-.02][c]*R+dr*.35,cy=sy+[-.22,-.05,.28][c]*R-R*.18,u=R*[.16,.19,.15][c];ctx.globalAlpha=Math.max(0,fade)*.82;
   const puffs=[[-1.3,.25,.55],[-.7,-.1,.75],[0,-.35,.95],[.75,-.12,.8],[1.35,.2,.55],[-.35,.3,.7],[.4,.32,.7]];
   ctx.fillStyle='rgba(0,0,0,.18)';ctx.beginPath();ctx.ellipse(cx+u*.4,cy+u*1.6,u*1.9,u*.45,0,0,7);ctx.fill();
   ctx.fillStyle=flash?'#c9cfdc':'#4c5464';for(const[a,b,r]of puffs){ctx.beginPath();ctx.arc(cx+a*u,cy+b*u+u*.12,r*u,0,7);ctx.fill()}
   ctx.fillStyle=flash?'#eef2fa':'#7d8696';for(const[a,b,r]of puffs){ctx.beginPath();ctx.arc(cx+a*u-u*.06,cy+b*u-u*.08,r*u*.86,0,7);ctx.fill()}
   ctx.fillStyle=flash?'#ffffff':'#a3abba';for(const[a,b,r]of puffs.slice(1,4)){ctx.beginPath();ctx.arc(cx+a*u-u*.15,cy+b*u-u*.22,r*u*.5,0,7);ctx.fill()}
   }ctx.globalAlpha=Math.max(0,fade);
  if(flash){const bx=sx+R*.1;ctx.strokeStyle='rgba(255,250,200,.95)';ctx.lineWidth=2*z;ctx.beginPath();ctx.moveTo(bx,sy-R*.1);ctx.lineTo(bx-6*z,sy+R*.2);ctx.lineTo(bx+3*z,sy+R*.22);ctx.lineTo(bx-5*z,sy+R*.5);ctx.stroke();ctx.fillStyle='rgba(255,255,220,.18)';ctx.beginPath();ctx.arc(sx,sy,R,0,7);ctx.fill()}
  ctx.globalAlpha=1;ctx.font='700 12px system-ui';ctx.textAlign='center';const lb='⛈ Storm · trains & ships ¼ speed · '+Math.ceil(s.t)+' s',lw=ctx.measureText(lb).width+14;ctx.fillStyle='rgba(20,24,32,.75)';ctx.beginPath();ctx.roundRect?ctx.roundRect(sx-lw/2,sy+R*.55-9,lw,18,9):ctx.rect(sx-lw/2,sy+R*.55-9,lw,18);ctx.fill();ctx.fillStyle='#e8eef8';ctx.textBaseline='middle';ctx.fillText(lb,sx,sy+R*.55+1);ctx.restore()}
 for(const c of S.crews||[]){const bx=c.i%N,by=(c.i/N)|0;let dir=[1,0];if(c.path&&c.path.length>1){const a=c.path[c.st==='back'?1:c.path.length-2]||c.path[0];dir=[Math.sign(bx-a[0])||0,Math.sign(by-a[1])||0];if(!dir[0]&&!dir[1])dir=[1,0]}else{dir=isRail(bx+1,by)||isRail(bx-1,by)?[1,0]:[0,1]}
  const hz=dir[0]!==0;
  // the broken square itself: bent rail, a gap and a loose sleeper (drawn while it is broken and a crew is around)
  if(S.broken[c.i]!==undefined){const[sx,sy]=P(bx,by);ctx.save();ctx.translate(sx,sy);ctx.scale(z,z);if(!hz)ctx.rotate(Math.PI/2);ctx.fillStyle='rgba(60,45,30,.55)';ctx.fillRect(-16,-11,32,22);ctx.strokeStyle='#b9b2a6';ctx.lineWidth=2.2;
   ctx.beginPath();ctx.moveTo(-16,-4);ctx.lineTo(-5,-4);ctx.quadraticCurveTo(0,-9,3,-12);ctx.moveTo(6,-4);ctx.lineTo(16,-4);ctx.moveTo(-16,4);ctx.lineTo(-3,4);ctx.moveTo(4,4);ctx.lineTo(16,4);ctx.stroke();
   ctx.save();ctx.translate(2,8);ctx.rotate(.5);ctx.fillStyle='#5b4128';ctx.fillRect(-6,-1.5,12,3);ctx.restore();if(c.st!=='fix'){const a=.5+.4*Math.sin(tm*6);ctx.fillStyle='rgba(220,60,40,'+a+')';ctx.beginPath();ctx.arc(0,-16,6,0,7);ctx.fill();ctx.fillStyle='#fff';ctx.font='bold 9px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('!',0,-15.5)}ctx.restore()}
  // the handcar: rides along the path; while fixing it waits one square back
  let hp=null;if((c.st==='go'||c.st==='back')&&c.path){const k=Math.floor(c.pos),f=c.pos-k,a=c.path[k],b2=c.path[Math.min(c.path.length-1,k+1)];hp=[a[0]+(b2[0]-a[0])*f,a[1]+(b2[1]-a[1])*f]}else if(c.st==='fix'){hp=[bx-dir[0]*.95,by-dir[1]*.95]}
  const man=(x,y,face,sw,hold)=>{ctx.save();ctx.translate(x,y);ctx.fillStyle='rgba(0,0,0,.25)';ctx.beginPath();ctx.ellipse(0,3.5,3,1.3,0,0,7);ctx.fill();ctx.fillStyle='#e0603a';ctx.fillRect(-1.8,-3,3.6,5.5);ctx.fillStyle='#f0c89a';ctx.beginPath();ctx.arc(0,-4.6,1.7,0,7);ctx.fill();ctx.fillStyle='#ffb000';ctx.beginPath();ctx.arc(0,-5.3,1.8,Math.PI,0);ctx.fill();
   if(hold){const ang=face*(-.3+1.6*sw);ctx.strokeStyle='#6b4a26';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(0,-2);const hx=Math.sin(ang)*7,hy=-2-Math.cos(ang)*7;ctx.lineTo(hx,hy);ctx.stroke();ctx.fillStyle='#555';ctx.fillRect(hx-1.5,hy-1,3,2)}ctx.restore()};
  if(hp){const[sx,sy]=P(hp[0],hp[1]);ctx.save();ctx.translate(sx,sy);ctx.scale(z,z);if(!hz)ctx.rotate(Math.PI/2);ctx.fillStyle='#6b4a26';ctx.fillRect(-7,-5,14,10);ctx.fillStyle='#3a2a1a';ctx.fillRect(-1,-7,2,5);ctx.fillRect(-4,-7.5,8,1.5);ctx.fillStyle='#2a2420';for(const q of[-5,5])for(const r2 of[-5,5])ctx.fillRect(q-1.5,r2-1,3,2);
   if(c.st!=='fix'){man(-3,0,1,0,false);man(3,0,-1,0,false)}else{ctx.fillStyle='#8a6a40';ctx.fillRect(-5,-3,10,2.5);ctx.fillRect(-5,1,10,2.5)}ctx.restore()}
  if(c.st==='fix'){const[sx,sy]=P(bx,by);ctx.save();ctx.translate(sx,sy);ctx.scale(z,z);const s1=Math.max(0,Math.sin(tm*7)),s2=Math.max(0,Math.sin(tm*7+Math.PI));
   const M=hz?[[-3,-11,1,s1,-1,-5],[4,13,-1,s2,2,5]]:[[-11,-2,1,s1,-4,0],[11,3,-1,s2,4,2]];
   for(const[x,y,f,s,kx,ky]of M){man(x,y,f,s,true);if(s<.15){ctx.fillStyle='#ffe08a';for(let k=0;k<3;k++){ctx.beginPath();ctx.arc(kx+(Math.random()-.5)*5,ky+(Math.random()-.5)*4,.8,0,7);ctx.fill()}}}
const pr=1-c.w/FIXWORK;ctx.lineWidth=2;ctx.strokeStyle='rgba(0,0,0,.45)';ctx.beginPath();ctx.arc(0,-24,5,0,7);ctx.stroke();ctx.strokeStyle='#7fd36b';ctx.beginPath();ctx.arc(0,-24,5,-Math.PI/2,-Math.PI/2+pr*6.283);ctx.stroke();ctx.restore()}}
 for(const t of S.trains)if(t.repT>0&&t.path){const c=t.path[Math.min(t.path.length-1,Math.floor(t.pos||0))];if(!c)continue;const[sx,sy]=P(c[0],c[1]);ctx.font='14px system-ui';ctx.textAlign='center';ctx.fillText('🔧',sx,sy-16)}
 for(const s of S.ships)if(s.repT>0&&s.st==='dock'){const Q=sites[s.at];if(!Q)continue;const[sx,sy]=P(Q.x,Q.y);ctx.font='14px system-ui';ctx.textAlign='center';ctx.fillText('🔧🚢',sx+18,sy-18)}
 }catch(e){}}}
// ⚠ alert button: counts what is going on and jumps to it, one per tap
function evList(){const L=[];for(const k in S.broken||{})L.push({i:+k,t:'🔧 Broken rail',f:()=>showFix(+k)});for(const s of S.storms||[])L.push({i:id(s.x,s.y),t:'⛈ Storm',f:()=>toast('⛈ Storm near '+nearName(s.x,s.y)+': trains and ships slow down there. Clears in '+Math.ceil(s.t)+' s.')});
 for(const t of S.trains)if(t.repT>0&&t.path){const c=t.path[Math.min(t.path.length-1,Math.floor(t.pos||0))];if(c)L.push({i:id(c[0],c[1]),t:'🔧 Train repair',f:()=>toast('🔧 Train '+tNo(t)+' is being repaired: '+Math.ceil(t.repT)+' s left.')})}
 for(const s of S.ships)if(s.repT>0){const Q=sites[s.at];if(Q)L.push({i:id(Q.x,Q.y),t:'🔧 Ship repair',f:()=>toast('🔧 Ship repair at '+nm(Q)+': '+Math.ceil(s.repT)+' s left.')})}
 for(const o of sites){const c=wagonBlock(o);if(c)L.push({i:id(o.x,o.y),t:'❗ Needs '+c.n,f:()=>showInfo(o)})}return L}
let EVI=0;
if(typeof document!=='undefined'&&document.body&&document.body.appendChild){const b=document.createElement('button');b.id='evBtn';b.style.cssText='position:fixed;left:10px;top:172px;z-index:4;display:none;padding:7px 12px;border-radius:12px;border:2px solid #fff;background:#c0392b;color:#fff;font:700 14px system-ui;box-shadow:0 2px 10px rgba(0,0,0,.5)';document.body.appendChild(b);
 b.onclick=()=>{const L=evList();if(!L.length)return;const e=L[EVI++%L.length];const v=viewBox();cam.z=Math.max(cam.z,1.4);cam.x=(e.i%N+.5)*TS-((v.left+v.right)/2-W/2)/cam.z;cam.y=(((e.i/N)|0)+.5)*TS-((v.top+v.bot)/2-H/2)/cam.z;e.f()};
 setInterval(()=>{try{const L=evList();const jb=document.getElementById('jobs');b.style.display=L.length&&!(jb&&jb.style.display==='block')?'block':'none';b.textContent='⚠ '+L.length+(L.length===1?' · '+L[0].t:'')}catch(e){}},500)}
// v240 (Sébastien: chapter window scrolls too much): compact chapter page. Header row, goal chips + the next goal with Go,
// then tiles (📜 Story, 🏝 Islands, 🛤 Railway level) that each open their own page with Back.
var STAB=null;function sTab(k){STAB=k;showStory();const el=document.getElementById('panel');if(el)el.scrollTop=0}
const tileBtn=(k,ic,lb,fn)=>'<button onclick="'+fn+'(\''+k+'\')" style="flex:1 1 30%;min-height:54px;margin:3px;padding:8px 4px;border-radius:12px;border:1px solid #6b5a3e;background:#2a221a;color:#f3e6c8;font:inherit;font-weight:700;font-size:13px"><span style="font-size:20px">'+ic+'</span><br>'+lb+'</button>';
const backBtn=(lb,fn)=>'<button onclick="'+fn+'" style="margin:2px 0 6px;padding:8px 14px;border-radius:10px;border:1px solid #6b5a3e;background:#3a2f22;color:#f3e6c8;font:inherit;font-weight:700">‹ '+lb+'</button>';
showStory=function(){openShed=null;openFac=null;openInfo=null;sel=null;spot=null;PANEL={n:'showStory',a:[]};const el=document.getElementById('panel');el.style.display='block';const c=chap();let h='';
 const s=c.free?null:chStory(c),G=c.free?[]:chGoals(),nx=G.find(x=>x.v<x.g);
 const head=c.free?'<b style="font-size:16px;color:#ffd27a">🗺 Every island is yours</b><br><small style="opacity:.8">Keep growing your towns as big as they go.</small>'
  :`<div style="display:flex;gap:10px;align-items:center"><div style="font-size:30px">${s.ic}</div><div style="flex:1"><small style="opacity:.7;letter-spacing:1.5px">CHAPTER ${c.n} · ${islName(c.isl)}</small><br><b style="font-size:17px;color:#ffd27a">${s.title}</b></div><div style="text-align:right"><small style="opacity:.7">Reward</small><br><b style="color:#7fd36b">${fmt(2000*c.n)}</b></div></div>`;
 if(STAB){const T={story:['📜','Story'],isl:['🏝','Islands'],rail:['🛤','Railway level']}[STAB]||['',''];h+=backBtn('Back to the chapter','sTab(null)')+`<div style="font-size:16px;font-weight:700">${T[0]} ${T[1]}</div>`;
  if(STAB==='story'){if(s)h+=`<div style="margin-top:6px;padding:8px 10px;border-radius:9px;background:#1f1a13;border-left:3px solid #e9a646;font-style:italic">${s.intro}<div style="text-align:right;font-style:normal;opacity:.7;font-size:11px">· Mira, dispatcher</div></div>`;
   if((S.chDone||[]).length)h+='<div style="margin-top:8px"><b>📜 Journal</b>'+(S.chDone||[]).map(x=>{const q=chStory({isl:x.isl,n:x.n});return`<div style="margin-top:4px"><b>Ch.${x.n} ${q.title}</b> <small style="opacity:.7">${x.m} min</small><br><small style="opacity:.8;font-style:italic">${q.outro}</small></div>`}).join('')+'</div>'}
  else if(STAB==='isl'){const H=homeK(),known=[H,...(S.chDone||[]).map(x=>x.isl)];if(!c.free)known.push(c.isl);const n2=nextChapIsl();if(n2!=null&&!known.includes(n2))known.push(n2);
   h+=[...new Set(known)].map(k=>{const r=(S.ires||{})[k],st=k===H||(S.isl||[]).includes(k)?'✅ reached':k===c.isl?'▶ this chapter':'next';return`<div style="margin-top:4px">${k===H?'🏠':'🏝'} <b>${islName(k)}</b> · ${k===H?'🪵 🌾 🪨 ⚫':r?TYPES[r].g+' '+GOOD[r].toLowerCase():'?'} <small style="opacity:.7">${st}</small></div>`}).join('')+'<small style="opacity:.75;display:block;margin-top:6px">Each island has its own resource. 🚛 Long-haul trains (buy at a 👑 capital) carry it to whoever needs it on another island.</small>'}
  else h+=`<div style="margin-top:4px">Level <b>${S.beacon}</b>`+(RLV[S.beacon]?` · ${S.stats.orders||0}/${RLV[S.beacon]} orders filled</div><small>Level ${S.beacon+1} unlocks ${RUNL[S.beacon]}</small>`:'</div>');
  el.innerHTML=h+'<i id="pgen"></i>';return}
 h+=head;
 if(!c.free){h+='<div style="margin-top:6px">'+G.filter(x=>x!==nx).map(x=>`<span style="display:inline-block;margin:3px 4px 0 0;padding:2px 8px;border-radius:12px;font-size:12px;background:${x.v>=x.g?'#24361f':'#2a221a'};border:1px solid ${x.v>=x.g?'#5f9a4c':x===nx?'#ffd27a':'#4a3d2c'}">${x.v>=x.g?'✅':x===nx?'▶':'⬜'} ${x.t}${x.g>1&&x.v<x.g?' <b>'+x.v+'/'+x.g+'</b>':''}</span>`).join('')+'</div>';
  if(nx)h+=`<div style="margin-top:8px;padding:8px 10px;border-radius:10px;background:#2a221a;border:1.5px solid #ffd27a"><b style="color:#ffd27a">▶ Next: ${nx.t}${nx.g>1?' '+nx.v+'/'+nx.g:''}</b>${nx.how?'<br><small style="opacity:.85">'+nx.how+'</small>':''}<div style="margin-top:4px">${tbtn('Go ›',`chGo('${nx.go}')`)}</div></div>`;
  else h+='<div style="margin-top:8px;color:#7fd36b"><b>✅ All goals done</b></div>'}
 h+='<div style="display:flex;flex-wrap:wrap;margin-top:8px">'+tileBtn('story','📜','Story','sTab')+tileBtn('isl','🏝','Islands','sTab')+tileBtn('rail','🛤','Level '+S.beacon,'sTab')+'</div>';
 el.innerHTML=h+'<i id="pgen"></i>'};
if(typeof window!=='undefined'){window.showStory=showStory;window.sTab=sTab}
{const o=closePanel;closePanel=function(){STAB=null;return o.apply(this,arguments)};if(typeof window!=='undefined')window.closePanel=closePanel}
// v240 (Sébastien: limit scrolling): the build menu is a compact grid of tiles (icon, name, price); the hint shows once you pick one
try{if(document.head&&document.head.appendChild){const st=document.createElement('style');st.textContent='.bgrid{display:flex;flex-wrap:wrap;margin:0 -3px}.bgrid .bcard{flex-direction:column;justify-content:center;gap:2px;width:calc(33.33% - 6px);margin:3px;padding:7px 3px;text-align:center}.bgrid .bcard .bt small{display:none}.bgrid .bcard b{font-size:12.5px}.bgrid .bcard .bi{font-size:22px}.bgrid .bcard .bp{font-size:11.5px;padding:1px 6px}.bhd{margin:6px 0 0!important}';document.head.appendChild(st)}}catch(e){}
{const o=showBuildMenu;showBuildMenu=function(){const r=o.apply(this,arguments);try{const el=document.getElementById('panel');let g=null;for(const c of [...el.children]){if(c.classList&&c.classList.contains('bcard')){if(!g){g=document.createElement('div');g.className='bgrid';c.before(g)}g.appendChild(c)}else g=null}
 const hs=[...el.querySelectorAll('.bhd')];if(hs.length>1){const grp=hs.map(h=>{const gr=h.nextElementSibling&&h.nextElementSibling.classList.contains('bgrid')?h.nextElementSibling:null;const t=(h.childNodes[0]&&h.childNodes[0].textContent||h.textContent).trim();return{h,gr,t}}).filter(x=>x.gr);
  if(BTAB==null||!grp[BTAB])BTAB=Math.min(1,grp.length-1);const bar=document.createElement('div');bar.style.cssText='display:flex;gap:4px;flex-wrap:wrap;margin:6px 0 2px';
  grp.forEach((x,k)=>{const b=document.createElement('button');b.textContent=x.t.replace(/·.*$/,'').trim();b.style.cssText='flex:1 1 auto;padding:7px 6px;border-radius:10px;font:inherit;font-weight:700;font-size:13px;border:'+(k===BTAB?'2px solid #ffd27a;background:#4a3b22;color:#ffd27a':'1px solid #6b5a3e;background:#2a221a;color:#f3e6c8');b.onclick=()=>{BTAB=k;showBuildMenu()};bar.appendChild(b);if(k!==BTAB){x.h.style.display='none';x.gr.style.display='none'}else{const sm=x.h.querySelector('small');x.h.style.display=sm?'block':'none';if(sm)x.h.innerHTML='<small>'+sm.innerHTML.replace(/^\s*·\s*/,'')+'</small>'}});grp[0].h.before(bar)}
 // v245 (Sébastien): factory cards show what goes in, as small icons to the right of the product
 for(const b of el.querySelectorAll('.bcard')){const m=(b.getAttribute('onclick')||'').match(/pickBuild\('(\w+)'\)/);const F=m&&FAC[m[1]];const bi=b.querySelector('.bi');if(!F||!bi||bi.dataset.inp)continue;bi.dataset.inp=1;const ins=Object.keys(F.in);bi.style.cssText='display:inline-flex;align-items:center;justify-content:center;gap:4px';bi.innerHTML='<span>'+bi.innerHTML+'</span><span title="needs" style="display:inline-flex;flex-direction:column;gap:1px;font-size:12px;line-height:1;background:#2a221a;border:1px solid #6b5a3e;border-radius:6px;padding:2px 3px">'+ins.map(k=>'<span>'+TYPES[k].g+'</span>').join('')+'</span>';const sm=b.querySelector('.bt b');if(sm&&!b.querySelector('.bin')){const t=document.createElement('small');t.className='bin';t.style.cssText='display:block;font-size:10.5px;opacity:.85;color:#e8d9b8;font-weight:400';t.textContent='needs '+ins.map(k=>GOOD[k].toLowerCase()).join(' + ');sm.after(t)}}
 }catch(e){}return r};if(typeof window!=='undefined')window.showBuildMenu=showBuildMenu}
var BTAB=null;
// v240: Atlas landmarks as a compact grid; tap one to see it
var ATSEL=null;
{const o=showAtlas;showAtlas=function(){const r=o.apply(this,arguments);try{const el=document.getElementById('panel');const K=[...el.children];const hi=K.findIndex(c=>c.tagName==='B'&&/^Landmarks/.test(c.textContent));if(hi<0)return r;
 const cells=K.slice(hi+1).filter(c=>c.tagName==='DIV'&&/atlasGo|Hidden landmark/.test(c.innerHTML));if(!cells.length)return r;
 const g=document.createElement('div');g.style.cssText='display:flex;flex-wrap:wrap;gap:4px;margin-top:4px';const det=document.createElement('div');det.style.cssText='margin-top:6px';
 cells.forEach((c,k)=>{const hid=/^\s*❔/.test(c.innerText||''),ok=/✅/.test(c.innerText||'');const ic=(c.innerText||'').trim().split(/\s/)[0];const b=document.createElement('button');b.textContent=hid?'❔':ic;b.title=(c.innerText||'').split('\n')[0];
  b.style.cssText='width:40px;height:40px;border-radius:9px;font-size:18px;border:'+(ok?'2px solid #7fd36b;background:#22301d':hid?'1px dashed #6b5a3e;background:#1f1a13;opacity:.6':'2px solid #ffd27a;background:#3a2f22')+(ATSEL===k?';outline:2px solid #fff':'');b.onclick=()=>{ATSEL=ATSEL===k?null:k;showAtlas()};g.appendChild(b);c.remove();if(ATSEL===k){c.style.borderTop='0';det.appendChild(c)}});
 const n=cells.filter(c=>/✅/.test(c.innerText||'')).length;K[hi].innerHTML='Landmarks <small style="opacity:.7;font-weight:400">'+n+'/'+cells.length+' reached · tap one</small>';K[hi].after(g);g.after(det)}catch(e){console.log('atlas',e)}return r};if(typeof window!=='undefined')window.showAtlas=showAtlas}
// v240: Map menu "Go to" shows one group at a time (tabs); typing a search shows matches from every group
var MMTAB='town';
{const o=mapMenuList;mapMenuList=function(q){if(q)return o(q);const full=o('');const d=document.createElement('div');d.innerHTML=full;const heads=[...d.children].filter(c=>c.tagName==='DIV');const keys=['town','port','fac','ind','plot'],names={town:'🏘 Towns',port:'⚓ Docks',fac:'🏭 Factories',ind:'⛏ Industries',plot:'🚩 Sites'};
 const groups={};let cur=null;for(const c of [...d.children]){if(c.tagName==='DIV'){cur=keys.find(k=>c.textContent.startsWith(names[k].split(' ')[0]))||cur;groups[cur]=groups[cur]||[];continue}if(cur)groups[cur].push(c.outerHTML)}
 const ks=keys.filter(k=>groups[k]&&groups[k].length);if(!ks.length)return full;if(!ks.includes(MMTAB))MMTAB=ks[0];
 return '<div style="display:flex;gap:4px;flex-wrap:wrap;margin:6px 0">'+ks.map(k=>'<button onclick="MMTAB=\''+k+'\';document.getElementById(\'mml\').innerHTML=mapMenuList(\'\')" style="flex:1 1 auto;padding:6px 6px;border-radius:10px;font:inherit;font-weight:700;font-size:12.5px;border:'+(k===MMTAB?'2px solid #ffd27a;background:#4a3b22;color:#ffd27a':'1px solid #6b5a3e;background:#2a221a;color:#f3e6c8')+'">'+names[k]+' '+groups[k].length+'</button>').join('')+'</div><div style="display:flex;flex-wrap:wrap;gap:0 6px">'+groups[MMTAB].map(h=>h.replace('display:block;width:100%','display:block;width:calc(50% - 3px);box-sizing:border-box;overflow:hidden;white-space:nowrap;text-overflow:ellipsis')).join('')+'</div>'}}

// v240: Atlas sections become tiles; each opens its own page with Back
var ATAB=null;function aTab(k){ATAB=k;showAtlas();const el=document.getElementById('panel');if(el)el.scrollTop=0}
{const o=showAtlas;showAtlas=function(){const r=o.apply(this,arguments);try{const el=document.getElementById('panel');for(const nd of [...el.childNodes])if(nd.nodeType===3&&nd.textContent.trim()){const sp=document.createElement('span');nd.before(sp);sp.appendChild(nd)}const K=[...el.children];const title=K[0];const secs=[];let cur=null;
 for(const c of K.slice(1)){if(c.tagName==='B'){cur={b:c,n:[c]};secs.push(cur);continue}if(cur)cur.n.push(c)}
 const pre=K.slice(1,K.indexOf(secs[0]?secs[0].b:K[K.length-1]));if(!secs.length)return r;
 const lab=s=>s.b.textContent.replace(/\s*\d+\/\d+ reached.*$/,'').trim();const icon=t=>{const m=t.match(/^\p{Extended_Pictographic}️?/u);return m?m[0]:{Landmarks:'🗿',Islands:'🏝',Menus:'☰'}[t]||'📄'};
 if(ATAB!=null&&secs[ATAB]){const s=secs[ATAB];for(const c of K.slice(1))c.style.display='none';const top=document.createElement('div');top.innerHTML=backBtn('Back to the Atlas','aTab(null)');title.after(top);let at=top;for(const n of s.n){n.style.display='';at.after(n);at=n}return r}
 for(const s of secs)for(const n of s.n)n.style.display='none';
 const g=document.createElement('div');g.style.cssText='display:flex;flex-wrap:wrap;margin-top:6px';g.innerHTML=secs.map((s,k)=>{const t=lab(s);const ic=icon(t);return tileBtn(k,ic,t.replace(ic,'').trim(),'aTab')}).join('');(pre.length?pre[pre.length-1]:title).after(g)}catch(e){console.log('atab',e)}return r};if(typeof window!=='undefined'){window.showAtlas=showAtlas;window.aTab=aTab}}
{const o=closePanel;closePanel=function(){ATAB=null;return o.apply(this,arguments)};if(typeof window!=='undefined')window.closePanel=closePanel}
// v240: Tech sections as tiles
var TKTAB=null;function tkTab(k){TKTAB=k;showTech();const el=document.getElementById('panel');if(el)el.scrollTop=0}
{const o=showTech;showTech=function(){const r=o.apply(this,arguments);try{const el=document.getElementById('panel');const K=[...el.children],title=K[0];const D=K.filter(c=>c.tagName==='DIV'&&c.offsetHeight>60);if(D.length<1)return r;
 const lb=d=>{if(/^\s*Bigger inventions/.test(d.innerText||''))return'🏛 Inventions';const b=d.querySelector('b');return b?b.textContent.trim():'More'};
 if(TKTAB!=null&&D[TKTAB]){for(const c of K.slice(1))if(c!==D[TKTAB])c.style.display='none';const top=document.createElement('div');top.innerHTML=backBtn('Back to Tech','tkTab(null)');title.after(top);top.after(D[TKTAB]);return r}
 for(const d of D)d.style.display='none';const g=document.createElement('div');g.style.cssText='display:flex;flex-wrap:wrap;margin-top:6px';g.innerHTML=D.map((d,k)=>{const t=lb(d),m=t.match(/^\p{Extended_Pictographic}️?/u),ic=m?m[0]:'🏗';return tileBtn(k,ic,t.replace(ic,'').replace(/:$/,'').trim().slice(0,28),'tkTab')}).join('');title.after(g)}catch(e){console.log('tech',e)}return r};if(typeof window!=='undefined'){window.showTech=showTech;window.tkTab=tkTab}}
{const o=closePanel;closePanel=function(){TKTAB=null;return o.apply(this,arguments)};if(typeof window!=='undefined')window.closePanel=closePanel}
// v240: Orders board with tabs (Orders / Holding back / News / How it works); order rows hide goods already delivered
var OTAB='ord';function oTab(k){OTAB=k;renderJobs();const j=document.getElementById('jobs');if(j)j.scrollTop=0}
{const o=renderJobs;renderJobs=function(){const r=o.apply(this,arguments);try{const j=document.getElementById('jobs');if(!j||j.style.display==='none')return r;const K=[...j.children];
 const jobs=K.filter(c=>c.classList&&c.classList.contains('job'));const blk=jobs.find(c=>/^\s*🚧/.test(c.innerText||'')),lvl=jobs.find(c=>/^\s*🛤/.test(c.innerText||'')),how=jobs.find(c=>/^\s*❔/.test(c.innerText||'')),news=jobs.find(c=>/^\s*📰/.test(c.innerText||''));
 const ords=jobs.filter(c=>c!==blk&&c!==lvl&&c!==how&&c!==news);
 for(const c of ords)for(const sp of [...c.querySelectorAll(':scope > span')])if(/^✅/.test(sp.textContent.trim()))sp.style.display='none';
 if(ords.length){const g=document.createElement('div');g.style.cssText='display:flex;flex-wrap:wrap;gap:4px';ords[0].before(g);for(const c of ords){g.appendChild(c);c.style.cssText+=';width:calc(50% - 2px);box-sizing:border-box;margin:0;padding:5px 7px;font-size:12px;line-height:1.35';const sp=c.querySelector(':scope > span');if(sp&&/→/.test(sp.textContent)){sp.textContent=sp.textContent.split('→')[1].trim();sp.insertAdjacentHTML('afterbegin','→ ')}c.querySelectorAll(':scope > span').forEach(x=>x.style.marginRight='5px')}ords.g=g}
 for(const c of K)if(c.tagName==='SMALL')c.style.display='none';
 const T=[['ord','📋 Orders',ords],['blk','🚧 Holding back',blk?[blk]:[]],['news','📰 News',news?[news]:[]],['how','❔ How',how?[how]:[]]].filter(t=>t[2].length);if(!T.some(t=>t[0]===OTAB))OTAB='ord';
 for(const t of T)for(const c of t[2])c.style.display=t[0]===OTAB?'':'none';if(ords.g)ords.g.style.display=OTAB==='ord'?'flex':'none';if(lvl&&lvl.parentNode){lvl.style.padding='4px 8px';lvl.style.fontSize='12px'}
 const bar=document.createElement('div');bar.style.cssText='display:flex;gap:4px;flex-wrap:wrap;margin:6px 0';bar.innerHTML=T.map(t=>'<button onclick="oTab(\''+t[0]+'\')" style="flex:1 1 auto;padding:6px 6px;border-radius:10px;font:inherit;font-weight:700;font-size:12.5px;border:'+(t[0]===OTAB?'2px solid #ffd27a;background:#4a3b22;color:#ffd27a':'1px solid #6b5a3e;background:#2a221a;color:#f3e6c8')+'">'+t[1]+(t[0]==='blk'?' <span style="color:#ff8a6a">●</span>':'')+'</button>').join('');
 const first=K.find(c=>c.tagName==='B');(first||j.firstChild).after(bar);if(lvl)bar.after(lvl);
 if(OTAB==='how'&&how){const d=how.querySelector('details');if(d)d.open=true}}catch(e){console.log('jobs',e)}return r};if(typeof window!=='undefined'){window.renderJobs=renderJobs;window.oTab=oTab}}
// v240 (Sébastien: ship upgrades hard to find): in Ships & upgrades, upgrades sit right under Buy a ship; long lists fold away
{const o=shedAuto;shedAuto=function(){const r=o.apply(this,arguments);try{if(S.shTab!=='ships')return r;const el=document.getElementById('panel');const K=[...el.children].filter(c=>c.tagName==='DIV');
 const up=K.find(c=>/^\s*⬆ Ship upgrades/.test(c.innerText||'')),buy=K.find(c=>/^\s*🚢 Buy a ship/.test(c.innerText||''));if(up&&buy)buy.after(up);
 for(const c of K){const t=(c.innerText||'').trim();if(/^📦 Waiting at your docks/.test(t)||/^Every ship/.test(t)&&!c.querySelector('details')){const d=document.createElement('details');d.innerHTML='<summary style="cursor:pointer;font-weight:700">'+t.split('\n')[0]+'</summary>';c.before(d);d.appendChild(c);const f=c.firstElementChild;if(f&&f.tagName==='B')f.style.display='none'}}}catch(e){}return r}}

function crewHere(i){return(S.crews||[]).some(c=>c.i===i)}

// v241 (Sébastien: Goods tab confusing): each stuck building says why in plain words and offers the fix
function goodsFix(pi,f){const P=sites[pi],k=f.k,q=islOf(P),G=TYPES[k].g+' '+GOOD[k].toLowerCase();let why='',btn='';
 if(!canCarry(k,q)){const c=cargoCls(k),C=CARGO[c];why=nmS(P)+' makes '+G+', but your trains on '+islName(q)+' have no '+C.n.toLowerCase()+' to carry it.';btn=tbtn('🧰 Buy '+C.n+' · '+fmt(C.c),`buyFleet('${c}',${q})`,S.money<C.c)}
 else if(f.why.length&&f.why.some(w=>/fuel/.test(w))){why=nmS(P)+' is too far from a town or water tower for trains to refuel.';btn=tbtn('⛽ Bigger tenders',"S.shTab='up';S.shI="+q+";showShed(0)")}
 else if(f.to==null){const fac=Object.keys(FAC).find(x=>FAC[x].in[k]!=null),has=fac&&sites.some(o=>o.type===fac&&o.linked&&!o.hidden);
  if(fac&&!has){why='Nobody uses '+G+' yet. A '+TYPES[fac].n+' turns it into '+TYPES[FAC[fac].out].g+' '+GOOD[FAC[fac].out].toLowerCase()+'.';btn=tbtn('🏗 Build a '+TYPES[fac].n,"document.querySelector('[data-m=build]').click();pickBuild('"+fac+"')")}
  else if(fac&&has){why='The '+TYPES[fac].n+' that uses '+G+' is full or not reachable by track from here. Link them, or upgrade the '+TYPES[fac].n+'.';const F0=sites.find(o=>o.type===fac&&o.linked&&!o.hidden);btn=F0?tbtn('📍 Show the '+TYPES[fac].n,'closePanel();locateSite(sites['+sites.indexOf(F0)+'])'):''}
  else{why='No town needs '+G+' right now and every buyer is full. It waits until someone needs it.';btn=''}}
 else why=f.why.join(', ');
 return`<div style="margin-top:5px;padding:6px 9px;border-radius:9px;background:#2a221a;border-left:5px solid #e05a3a"><b onclick="showInfo(sites[${pi}])" style="cursor:pointer;text-decoration:underline">${TYPES[k].g} ${nmS(P)}</b><br><small style="opacity:.9">${why}</small>${btn?'<div>'+btn+'</div>':''}</div>`}
// v270 (Sébastien: fuel looked stuck on its island): when nothing on the track takes a good, say who wants it and what is missing to get it there
function outDiag(P,k){const q=islOf(P),G=TYPES[k].g+' '+GOOD[k].toLowerCase(),b=bfs(id(P.x,P.y));
 const W=sites.filter(T=>T!==P&&T.linked&&!T.hidden&&T.type!=='port'&&accepts(T,k));
 if(!W.length)return{key:'buy/'+k,t:'No town orders '+G+' right now',why:'It waits in storage until a town orders it. You can sell some now.',btn:''};
 const reach=W.filter(T=>b.dist[id(T.x,T.y)]>0);if(reach.length){const T=reach[0];return{key:'full/'+sites.indexOf(T),t:nm(T)+' has all the '+GOOD[k].toLowerCase()+' it needs',why:'Towns your track reaches are filled up for now. More goes out when they order again.',btn:''}}
 const same=W.filter(T=>islOf(T)===q);if(same.length){const T=same[0];return{key:'trk/'+sites.indexOf(T),t:'No track to '+nm(T),why:nm(T)+' wants '+G+' and is on this island, but no track joins them.',btn:tbtn('🛤 Build track','closePanel();startRail()')+tbtn('📍 Show '+nm(T),'closePanel();locateSite(sites['+sites.indexOf(T)+'])')}}
 const T=W.sort((x,y)=>Math.hypot(x.x-P.x,x.y-P.y)-Math.hypot(y.x-P.x,y.y-P.y))[0],names=[...new Set(W.map(o=>nm(o)))].slice(0,3).join(', ')+(W.length>3?'…':'');
 const Pq=ports().filter(o=>o.linked&&!o.hidden&&islOf(o)===q),wl=Pq.filter(o=>portLanes(pIdx(o)).length),rd=wl.filter(o=>b.dist[id(o.x,o.y)]>0);
 const hold=typeof canShip==='function'&&!canShip(k)?' Your cargo ships also need a hold for '+GOOD[k].toLowerCase()+' (🚂 Trains → 🚢 Ships).':'';
 const wy=!Pq.length?'There is no ⚓ dock on '+islName(q)+' to ship it across.':!wl.length?'Your dock on '+islName(q)+' has no sea route yet.':!rd.length?'No track joins this building to your dock.':'Your dock '+nm(rd[0])+' can ship it: it goes there once a ship has room.';
 return{key:'sea/'+q+'/'+k,t:'Wanted on another island',why:names+' want'+(W.length>1?'':'s')+' '+G+', on '+islName(islOf(T))+'. '+wy+hold,
  btn:!Pq.length?tbtn('⚓ Build a dock',"document.querySelector('[data-m=build]').click();pickBuild('port')"):!wl.length?tbtn('⚓ Open the dock',"showPort(sites["+pIdx(Pq[0])+"])"):!rd.length?tbtn('🛤 Build track','closePanel();startRail()'):''}}
// v269 (Sébastien: "not clear what the issue is, I have to guess"): each stuck building names its ONE real cause
// (factory full · different island with no sea route · no track joins them · no wagons · fuel), and buildings with the same cause are grouped
function goodsDiag(pi,f){const P=sites[pi],k=f.k,q=islOf(P),G=TYPES[k].g+' '+GOOD[k].toLowerCase(),go=o=>'closePanel();locateSite(sites['+sites.indexOf(o)+'])';
 if(!canCarry(k,q)){const c=cargoCls(k),C=CARGO[c];return{key:'wag/'+c+'/'+q,t:'No '+C.n.toLowerCase()+' on '+islName(q),why:'Your trains on '+islName(q)+' have no '+C.n.toLowerCase()+', so nobody can load '+G+'.',btn:tbtn('🧰 Buy '+C.n+' · '+fmt(C.c),`buyFleet('${c}',${q})`,S.money<C.c)}}
 if(f.why.some(w=>/fuel/.test(w)))return{key:'fuel/'+q,t:'Out of fuel range',why:'Too far from a town or ⛽ water tower: trains can\'t refuel on the way.',btn:tbtn('⛽ Bigger tenders',"S.shTab='up';S.shI="+q+";showShed(0)")};
 if(f.to!=null)return{key:'w/'+pi,t:f.why.join(', '),why:'',btn:''};
 const fac=Object.keys(FAC).find(x=>FAC[x].in[k]!=null),Fs=fac?sites.filter(o=>o.type===fac&&o.linked&&!o.hidden):[],FN=fac?TYPES[fac].n:'';
 if(fac&&!Fs.length)return{key:'none/'+fac,t:'Nobody uses '+G+' yet',why:'Build a '+FN+': it turns '+G+' into '+TYPES[FAC[fac].out].g+' '+GOOD[FAC[fac].out].toLowerCase()+'.',btn:tbtn('🏗 Build a '+FN,"document.querySelector('[data-m=build]').click();pickBuild('"+fac+"')")};
 if(!fac)return outDiag(P,k);
 const b=bfs(id(P.x,P.y)),near=Fs.filter(F=>b.dist[id(F.x,F.y)]>0);
 if(near.length){const F=near.sort((x,y)=>b.dist[id(x.x,x.y)]-b.dist[id(y.x,y.y)])[0],have=Math.floor((F.inp||{})[k]||0),cap=FACT.buf(F.lvl||1),i=sites.indexOf(F),up=(F.lvl||1)<FACT.maxL;
  return{key:'full/'+i,t:'The '+nm(F)+' is full',why:(have>=cap*.8?'It already holds '+have+'/'+cap+' '+G+' and can\'t take more. ':'It holds '+have+'/'+cap+' '+G+' and the rest of its room is already on the way by train. ')+(up?'Upgrade it to store and use more, or build a second '+FN+'.':'It is at its top level: build a second '+FN+'.'),btn:(up?tbtn('⬆ Upgrade the '+FN+' · '+fmt(PRICE.facUp(F.lvl||1).m),'upFac('+i+')',S.money<PRICE.facUp(F.lvl||1).m):'')+tbtn('📍 Show it',go(F))}}
 const same=Fs.filter(F=>islOf(F)===q);
 if(same.length){const F=same.sort((x,y)=>Math.hypot(x.x-P.x,x.y-P.y)-Math.hypot(y.x-P.x,y.y-P.y))[0];return{key:'trk/'+sites.indexOf(F),t:'No track to the '+nm(F),why:'The '+nm(F)+' is on this island ('+Math.round(Math.hypot(F.x-P.x,F.y-P.y))+' squares away) but no track joins it to this building.',btn:tbtn('🛤 Build track','closePanel();startRail()')+tbtn('📍 Show the '+FN,go(F))}}
 const F=Fs.sort((x,y)=>Math.hypot(x.x-P.x,x.y-P.y)-Math.hypot(y.x-P.x,y.y-P.y))[0],Pq=ports().filter(o=>o.linked&&!o.hidden&&islOf(o)===q),withL=Pq.filter(o=>portLanes(pIdx(o)).length);
 const wy=!Pq.length?'There is no ⚓ dock on '+islName(q)+' to ship it across.':!withL.length?'Your dock on '+islName(q)+' has no sea route yet.':'Your dock on '+islName(q)+' isn\'t joined by track to this building.';
 return{key:'sea/'+q+'/'+fac,t:'The '+FN+' is on another island',why:'Every '+FN+' is on '+islName(islOf(F))+', across the sea. '+wy+' Or build a '+FN+' on '+islName(q)+'.',
  btn:(!Pq.length?tbtn('⚓ Build a dock',"document.querySelector('[data-m=build]').click();pickBuild('port')"):!withL.length?tbtn('⚓ Open the dock',"showPort(sites["+pIdx(Pq[0])+"])"):tbtn('🛤 Build track','closePanel();startRail()'))+tbtn('🏗 Build a '+FN,"document.querySelector('[data-m=build]').click();pickBuild('"+fac+"')")}}
function goodsList(bad){const G=new Map();for(const[pi,f]of bad){let d;try{d=goodsDiag(pi,f)}catch(e){d={key:'x/'+pi,t:'',why:'',btn:''}}if(!G.has(d.key))G.set(d.key,{d,L:[]});G.get(d.key).L.push(pi)}
 return[...G.values()].map(({d,L})=>{const P=sites[L[0]],k=offerOf(P),one=L.length===1;
  const who=one?`<b onclick="showInfo(sites[${L[0]}])" style="cursor:pointer;text-decoration:underline">${TYPES[k].g} ${nmS(P)}</b>`:'<small style="opacity:.85">'+L.map(i=>`<span onclick="showInfo(sites[${i}])" style="cursor:pointer;text-decoration:underline">${TYPES[offerOf(sites[i])].g} ${nmS(sites[i])}</span>`).join(' · ')+'</small>';
  return`<div style="margin-top:6px;padding:7px 10px;border-radius:10px;background:#2a221a;border-left:5px solid #e05a3a"><div style="font-weight:800;color:#ffb36b;font-size:14px">${d.t}${one?'':' <span style="color:#f3e6c8;font-weight:700">· '+L.length+' buildings</span>'}</div>${who}${d.why?'<br><small style="opacity:.92">'+d.why+'</small>':''}${d.btn?'<div>'+d.btn+'</div>':''}</div>`}).join('')}
if(typeof window!=='undefined'){window.goodsList=goodsList;window.goodsDiag=goodsDiag}
// v245 (Sébastien OK'd 1-3): dock levels matter. Each level loads and unloads ships 50% faster (a crane works the pier),
// adds a berth (Dock 1, Harbor 2, Port 3, Deepwater 4: extra ships wait their turn) and holds more goods waiting to sail.
const DOCKCAP=[150,300,500,800];
function dockLv(P){return Math.max(1,Math.min(4,(P&&P.lvl)||1))}
function dockT(n,P){if(!P||P.type!=='port')return 0;return(1+(n||0)/12)/(1+.5*(dockLv(P)-1))}
function berths(P){return dockLv(P)}
function berthLine(i){return S.ships.filter(o=>(o.st==='dock'||o.st==='load')&&o.at===i).sort((a,b)=>(a.arr||0)-(b.arr||0)||S.ships.indexOf(a)-S.ships.indexOf(b))}
function berthOk(s){const P=sites[s.at];if(!P||P.type!=='port')return true;return berthLine(s.at).indexOf(s)<berths(P)}
function berthQ(i){const P=sites[i];return P?Math.max(0,berthLine(i).length-berths(P)):0}
function dockQ(P){let n=0;for(const e in(P&&P.ex)||{})n+=sumG(P.ex[e]);return n}
function dockCap(P){return DOCKCAP[dockLv(P)-1]}
function dockFull(P){return!!P&&P.type==='port'&&dockQ(P)>=dockCap(P)}
function dockPerk(L){return'📦 room for '+DOCKCAP[L-1]+' goods · '+(L>1?'⚡ loads ships '+[0,50,100,150][L-1]+'% faster':'⚡ normal loading speed')+' · ⚓ '+L+' berth'+(L>1?'s (ships load side by side)':'')}
// cranes on the pier: one per berth above the first, swinging while a ship loads or unloads
{const o=portFlair;portFlair=function(s,X,Y){const r=o.apply(this,arguments);try{const L=dockLv(s);if(L<2)return r;const i=sites.indexOf(s),w=D4.find(([dx,dy])=>terr[id(s.x+dx,s.y+dy)]===0)||[1,0],c=ctx,tm=performance.now()/1000;
 const busy=S.ships.some(o=>o.at===i&&(o.st==='load'||o.st==='dock'&&(o.w||0)<0)&&berthOk(o));
 for(let k=0;k<Math.min(3,L-1);k++){const d=12+k*9,px=X+w[0]*d+(w[1]?(k%2?5:-5):0),py=Y+w[1]*d+(w[0]?(k%2?5:-5):0);
  c.save();c.translate(px,py);c.fillStyle='rgba(0,0,0,.25)';c.fillRect(-3,1,7,2);c.strokeStyle='#c9a227';c.lineWidth=1.6;
  c.beginPath();c.moveTo(-3,2);c.lineTo(-1,-15);c.moveTo(3,2);c.lineTo(1,-15);c.moveTo(-2.6,-3);c.lineTo(2.6,-8);c.moveTo(2.6,-3);c.lineTo(-2.6,-8);c.stroke();
  const a=busy?Math.sin(tm*1.6+k*1.7)*1.1:.35,jx=Math.cos(a)*13,jy=Math.sin(a)*3;c.fillStyle='#8a6f1e';c.fillRect(-2.5,-18,5,4);
  c.strokeStyle='#d8b23a';c.lineWidth=1.8;c.beginPath();c.moveTo(-5*Math.cos(a),-16-Math.sin(a)*1);c.lineTo(jx,-16+jy);c.stroke();c.fillStyle='#555';c.fillRect(-5*Math.cos(a)-2,-17,3,3);
  const hy=busy?6+Math.sin(tm*2.3+k)*4:2;c.strokeStyle='#333';c.lineWidth=.6;c.beginPath();c.moveTo(jx,-16+jy);c.lineTo(jx,-16+jy+hy);c.stroke();
  if(busy){c.fillStyle=['#c98b3c','#6f8f4e','#4f7fa8'][k%3];c.fillRect(jx-2.5,-16+jy+hy,5,4)}c.restore()}}catch(e){}return r}}
// the dock card and upgrade say what a bigger dock does
if(typeof window!=='undefined'){upPort=function(i){const o=sites[i],L=o.lvl||1;if(L>=PORT.n.length||S.beacon<PORT.lv[L])return;if(!pay(PORT.up[L])){toast(lackTxt(PORT.up[L]));return}o.lvl=L+1;toast('⚓ '+o.name+' is now a '+PORT.n[L]+': '+dockPerk(L+1));showInfo(o)};window.upPort=upPort}
// ---- v245 (Sébastien): every building that can't get what it needs, or can't send what it makes, shows a big ❗ ----
let BLKK='',BLKM=new Map();
function blockOf(s){try{if(!s||s.hidden||!s.linked||!(isInd(s)||isFac(s)))return null;const M=shipPlan(),key=AUTO.k+'/'+Math.floor(S.t/2);if(key!==BLKK){BLKK=key;BLKM=new Map()}const i=sites.indexOf(s);if(BLKM.has(i))return BLKM.get(i);let r=null;
 const wb=wagonBlock(s);if(wb)r={t:'Needs '+wb.n,w:wb};
 const f=M.get(i);
 if(!r&&f&&f.why.some(w=>/^out of fuel/.test(w)))r={t:'Out of fuel range',fu:1,why:nm(s)+' is too far from a town or water tower: trains can\'t refuel to reach it.'};
 if(!r&&f&&f.why.some(w=>/every buyer/.test(w)))r={t:'Buyers out of fuel range',fu:1,why:'Every place that buys '+GOOD[f.k].toLowerCase()+' is too far from a town or water tower for trains to refuel.'};
 if(!r&&f&&f.to==null&&!f.why.length&&!(f.alt||[]).length&&!f.full&&(s.stock||0)>=5){const I=islOf(s),U=sites.filter(T=>T!==s&&T.linked&&!T.hidden&&islOf(T)!==I&&stopOk(T)&&accepts(T,f.k)),seaU=U.filter(T=>{try{return islHops(I,islOf(T))<=2}catch(e){return false}});
  if(U.length&&seaU.length&&!canShip(f.k)){const c=holdOf(f.k);r={t:'Ships can\'t carry '+GOOD[f.k].toLowerCase(),hold:c,why:'The only places that use '+GOOD[f.k].toLowerCase()+' are on other islands, and your cargo ships have no '+(SHOLD[c]?SHOLD[c].n.toLowerCase():'hold')+' for it.'}}else
  if(!U.length)r={t:'Nobody uses '+GOOD[f.k].toLowerCase(),nb:1,why:'Nothing on any of your islands uses '+TYPES[f.k].g+' '+GOOD[f.k].toLowerCase()+' yet, so '+nm(s)+' fills up and waits.'};
  else if(!seaU.length)r={t:'No sea route to a buyer',nb:2,U:U[0],why:'Only '+nm(U[0])+' on '+islName(islOf(U[0]))+' uses '+GOOD[f.k].toLowerCase()+', and no ship route reaches that island from '+islName(I)+'. Link a dock on each island and buy a ship.'}}
 if(!r&&isFac(s)&&FAC[s.type]){for(const k of Object.keys(FAC[s.type].in)){if(((s.inp||{})[k]||0)>=FAC[s.type].in[k]*3)continue;let can=false,any=false;
   for(const[pi,g]of M){if(g.k!==k||pi===i)continue;any=true;if(g.to===i||g.fin===i||(g.alt||[]).some(c=>c.ti===i)){can=true;break}}
   if(!can&&S.trains.some(t=>t.route&&t.route.b===i&&offerOf(sites[t.route.a])===k))can=true;
   // v252: goods already waiting at a dock on this island (a dock ships one kind at a time), or on a ship heading here, count as a source
   if(!can){const I=islOf(s),b=bfs(id(s.x,s.y));if(sites.some(P=>P.type==='port'&&P.linked&&islOf(P)===I&&b.dist[id(P.x,P.y)]>=0&&(((P.im||{})[k]||0)>=1||Object.values(P.ex||{}).some(q=>(q[k]||0)>=1)))||S.ships.some(sh=>sh.st==='sail'&&sites[sh.to]&&islOf(sites[sh.to])===I&&(sh.c||{})[k]>0))can=true}
   // v253: made on another island that a ship route reaches (and ships can carry it): it is possible, just waiting for a ship
   if(!can&&canShip(k)){const I=islOf(s);if(sites.some(P=>P.linked&&!P.hidden&&offerOf(P)===k&&P.type!=='port'&&islOf(P)!==I&&(()=>{try{return islHops(islOf(P),I)<=2}catch(e){return false}})()))can=true}
   if(!can){r={t:'No '+GOOD[k].toLowerCase()+' can reach it',inK:k,any,why:any?'You make '+TYPES[k].g+' '+GOOD[k].toLowerCase()+', but none of it can reach '+nm(s)+' by track (or by ship from another island).':'Nothing on your railway makes '+TYPES[k].g+' '+GOOD[k].toLowerCase()+' yet.'};break}}}
 BLKM.set(i,r);return r}catch(e){return null}}
function blockFix(s,r){const q=islOf(s);if(r.w){const cc=Object.keys(CARGO).find(x=>CARGO[x]===r.w);return tbtn('🧰 Buy '+r.w.n+' · '+fmt(r.w.c),`buyFleet('${cc}',${q})`,S.money<r.w.c)}
 if(r.fu)return tbtn('⛽ Bigger tenders',"S.shTab='up';S.shI="+q+";showShed(0)");
 if(r.hold)return tbtn('🚢 Ship upgrades',"closePanel();S.shTab='ships';showShed(0)");if(r.noT!=null)return tbtn('＋ Buy a train for '+islName(r.noT)+' · '+fmt(r.noT===homeK()?COST.train:islTC()),'buyTrainFor('+r.noT+')',S.money<(r.noT===homeK()?COST.train:islTC()));if(r.noShip!=null)return tbtn('🚢 Buy a ship · '+fmt(shipCost()),'buyShip('+r.noShip+')',S.money<shipCost());if(r.nb===2)return tbtn('📍 Show '+nm(r.U),'closePanel();locateSite(sites['+sites.indexOf(r.U)+'])');if(r.nb){const k=offerOf(s),fac=Object.keys(FAC).find(x=>FAC[x].in[k]!=null);return fac?tbtn('🏗 Build a '+TYPES[fac].n,"closePanel();document.querySelector('[data-m=build]').click();pickBuild('"+fac+"')"):''}
 if(r.inK){const src=Object.keys(TYPES).find(x=>TYPES[x]&&TYPES[x].res===r.inK&&!FAC[x])||Object.keys(FAC).find(x=>FAC[x].out===r.inK);const P0=sites.find(o=>o.linked&&!o.hidden&&offerOf(o)===r.inK);
  return P0?tbtn('📍 Show the nearest '+GOOD[r.inK].toLowerCase()+' source','closePanel();locateSite(sites['+sites.indexOf(P0)+'])'):(src?tbtn('🏗 Build a '+TYPES[src].n,"closePanel();document.querySelector('[data-m=build]').click();pickBuild('"+src+"')"):'')}return''}
{const o=needBadges;needBadges=function(s){if(blockOf(s))return[];return o.apply(this,arguments)}}
// the map ❗ (the v239 wagon one is replaced by this general one)
var wagonDrawOff=1;
{const o=draw;draw=function(){o.apply(this,arguments);try{if(cam.z<.3)return;const tm=performance.now()/1000;for(const s of sites){const c=blockOf(s);if(!c)continue;const sx=((s.x+.5)*TS-cam.x)*cam.z+W/2,sy=((s.y+.5)*TS-cam.y)*cam.z+H/2-30*Math.min(1.6,cam.z);if(sx<-80||sy<-80||sx>W+80||sy>H+80)continue;
 const r=14+2*Math.sin(tm*5);ctx.save();ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='rgba(224,32,32,.25)';ctx.beginPath();ctx.arc(sx,sy,r+7,0,7);ctx.fill();ctx.fillStyle='#e02020';ctx.beginPath();ctx.arc(sx,sy,r,0,7);ctx.fill();ctx.lineWidth=2.5;ctx.strokeStyle='#fff';ctx.stroke();ctx.fillStyle='#fff';ctx.font='900 20px system-ui';ctx.fillText('!',sx,sy+1);
 if(cam.z>=.55){const t=c.t;ctx.font='700 12px system-ui';const w=ctx.measureText(t).width+14;ctx.fillStyle='rgba(120,16,16,.92)';ctx.beginPath();ctx.roundRect?ctx.roundRect(sx-w/2,sy+r+5,w,19,9):ctx.rect(sx-w/2,sy+r+5,w,19);ctx.fill();ctx.fillStyle='#fff';ctx.fillText(t,sx,sy+r+15)}ctx.restore()}}catch(e){}}}
{const o=evList;evList=function(){const L=o.apply(this,arguments).filter(e=>!/^❗ Needs /.test(e.t));for(const s of sites){const c=blockOf(s);if(c)L.push({i:id(s.x,s.y),t:'❗ '+c.t,f:()=>showInfo(s)})}return L}}
// the card: a red banner with the reason and the fix, at the top (wagon case keeps its v243 banner)
if(typeof window!=='undefined')for(const nm2 of['showInfo','showFactory']){const o=window[nm2];if(!o)continue;window[nm2]=function(a){const r=o.apply(this,arguments);try{const s=typeof a==='number'?sites[a]:a;const el=document.getElementById('panel');const b=s&&blockOf(s);if(b&&!b.w&&b.noT==null&&el&&!el.querySelector('#blkbox')){const h='<div id="blkbox">'+banner(C9.bad,'❗ '+b.t)+'<small style="opacity:.9">'+b.why+'</small><div>'+blockFix(s,b)+'</div></div>';const br=el.querySelector('br');if(br)br.insertAdjacentHTML('afterend',h);else el.insertAdjacentHTML('afterbegin',h)}}catch(e){}return r}}
// v245 (Sébastien chose 'part of the town streets'): a park takes a 2×2 block of house lots inside the town's street grid.
// Houses build around it, the street between the two rows runs into its gates, and people stroll its paths.
const PG=14,PGY=19;
function lotFree(s,gx,gy){const X=s.x*TS+TS/2,Y=s.y*TS+TS/2,hx=X+gx*PG,hy=Y+gy*PGY-4;if(Math.abs(gx)<=1&&Math.abs(gy)<=1)return false;if(Math.abs(gx)>10||Math.abs(gy)>6)return false;
 for(const[u,v]of[[-7,-10],[6,-10],[-7,5],[6,5]]){const tx=Math.floor((hx+u)/TS),ty=Math.floor((hy+v)/TS);if(tx<0||ty<0||tx>=N||ty>=N)return false;const k=id(tx,ty);if(track.has(k)||terr[k]===0||!rev[k])return false;const o=siteAt(tx,ty);if(o&&o!==s)return false}
 const SPh=stnTile(s);if(SPh){const hz=stnHz(SPh),SX=(SPh.x+.5)*TS,SY=(SPh.y+.5)*TS,al=hz?hx-SX:hy-SY,lt=hz?hy-SY:SX-hx;if(Math.abs(al)<(s.beacon?TS*1.7:TS*1.4)+7&&Math.abs(lt)<58)return false}
 if(S.sheds.some(o=>Math.abs((o.x+.5)*TS-hx)<26&&Math.abs((o.y+.5)*TS-hy)<26))return false;
 // another town's park
 for(const p of S.parks||[]){if(p.gx==null)continue;const T=sites[p.t];if(!T||T===s)continue;const px=T.x*TS+TS/2+(p.gx+.5)*PG,py=T.y*TS+TS/2+(p.gy+.5)*PGY-4;if(Math.abs(px-hx)<24&&Math.abs(py-hy)<28)return false}
 return true}
function parkLot(s,gx,gy){const i=sites.indexOf(s);for(const p of S.parks||[])if(p.t===i&&p.gx!=null&&gx>=p.gx&&gx<=p.gx+1&&gy>=p.gy&&gy<=p.gy+1)return true;return false}
function parkBlock(s){const i=sites.indexOf(s),L=townLots(),n=s.pop<=0?6:Math.min(70,4+Math.floor(s.pop/30));let k=0;
 for(const[gx,gy]of L){k++;if(gx>=7||gy>=4)continue;const four=[[gx,gy],[gx+1,gy],[gx,gy+1],[gx+1,gy+1]];if(four.some(([a,b])=>!lotFree(s,a,b)||parkLot(s,a,b)))continue;
  // keep it among the houses: a lot the town already reaches (or the next ring out)
  return[gx,gy]}
 // v254: a crowded town (track, water, docks) with no free block inside: the first free block just past its edge, still on its street grid
 const X=[];for(let gy=-6;gy<=5;gy++)for(let gx=-10;gx<=9;gx++)if(Math.abs(gx)>6||Math.abs(gy)>3)X.push([gx,gy]);X.sort((a,b)=>Math.hypot(a[0],a[1]*1.36)-Math.hypot(b[0],b[1]*1.36));
 for(const[gx,gy]of X){const four=[[gx,gy],[gx+1,gy],[gx,gy+1],[gx+1,gy+1]];if(four.some(([a,b])=>!lotFree(s,a,b)||parkLot(s,a,b)))continue;return[gx,gy]}
 return null}
parkSpot=function(s){return parkBlock(s)};
function parkTile(s,b){return[Math.floor((s.x*TS+TS/2+(b[0]+1)*PG)/TS),Math.floor((s.y*TS+TS/2+(b[1]+.5)*PGY)/TS)]}
buyPark=function(i){const s=sites[i],n=parksOf(i).length;if(n>=3)return;const c=PARKC[n];if(S.money<c){toast('Costs '+fmt(c));return}const b=parkBlock(s);if(!b){toast('No room among the houses of '+nm(s)+' for a park');return}S.money-=c;S.parks=S.parks||[];const[x,y]=parkTile(s,b);S.parks.push({t:i,x,y,gx:b[0],gy:b[1]});AUTO.k='';toast('🌳 Park opened in '+nm(s)+': its orders are now '+5*(n+1)+'% smaller');save();refreshPanel()};
if(typeof window!=='undefined')window.buyPark=buyPark;
// parks bought before v245 move into their town's street grid
function parkMove(){for(const p of S.parks||[]){if(p.gx!=null)continue;const s=sites[p.t];if(!s)continue;const b=parkBlock(s);if(b){p.gx=b[0];p.gy=b[1];const[x,y]=parkTile(s,b);p.x=x;p.y=y}}}
try{parkMove()}catch(e){}
{const o=tick;tick=function(dt){o(dt);S._pmT=(S._pmT||0)-dt;if(S._pmT<=0){S._pmT=5;try{parkMove()}catch(e){}}}}
// drawn with the town (before its houses, labels and order icons), so nothing is ever hidden under it
{const o=townFlair;townFlair=function(s0){try{const tm=performance.now()/1000,c=ctx;
 for(const p of S.parks||[]){if(p.gx==null||p.pj||sites[p.t]!==s0)continue;const s=s0;const X=s.x*TS+TS/2,Y=s.y*TS+TS/2,
  x0=X+p.gx*PG-8,x1=X+(p.gx+1)*PG+8,y0=Y+p.gy*PGY-4-13,y1=Y+(p.gy+1)*PGY-4+9,mx=(x0+x1)/2,my=Y+p.gy*PGY-4+6+1.6;// the street between the two rows
  c.save();
  const w=x1-x0,h=y1-y0;
  c.fillStyle='rgba(0,0,0,.22)';c.fillRect(x0+1.5,y0+2,w,h);
  c.fillStyle='#2f6a2c';c.beginPath();c.roundRect?c.roundRect(x0,y0,w,h,3):c.rect(x0,y0,w,h);c.fill();// hedge
  c.fillStyle='#6aa553';c.fillRect(x0+2.5,y0+2.5,w-5,h-5);// lawn
  for(let q=0;q<10;q++){const a=hash(p.gx+q,p.gy+s.x,7),b=hash(p.gy+q,p.gx+s.y,9);c.fillStyle='rgba(255,255,255,.08)';c.fillRect(x0+4+a*(w-10),y0+4+b*(h-10),3,1)}
  // paths: the town street runs in through gates on both sides; a cross path meets the street at the fountain
  c.fillStyle='#d8c79c';c.fillRect(x0-.5,my-1.8,w+1,3.6);c.fillRect(mx-1.6,y0+2.5,3.2,h-5);
  c.fillStyle='#b9a77f';c.fillRect(x0-6,my-1.6,6,3.2);c.fillRect(x1,my-1.6,6,3.2);// joins the street outside
  c.fillStyle='#c9b98c';c.fillRect(x0-.5,my+1.6,w+1,.5);
  // the street along the bottom row keeps going past the park
  const by=Y+(p.gy+1)*PGY-4+6;c.fillStyle='#b9a77f';c.fillRect(x0-6,by+2,w+12,3.2);c.fillStyle='#a8966e';c.fillRect(x0-6,by+5.2,w+12,.6);
  // fountain
  c.fillStyle='#cfc6b0';c.beginPath();c.arc(mx,my,4.6,0,7);c.fill();c.fillStyle='#8fc7e8';c.beginPath();c.arc(mx,my,3.4,0,7);c.fill();c.fillStyle='rgba(255,255,255,'+(.5+.3*Math.sin(tm*4))+')';c.beginPath();c.arc(mx,my-.8+Math.sin(tm*3)*.4,1.1,0,7);c.fill();
  // flower beds and trees in the four corners
  const cn=[[x0+7,y0+7],[x1-7,y0+7],[x0+7,y1-7],[x1-7,y1-7]];
  cn.forEach(([tx,ty],q)=>{if((q+p.gx)%2){c.fillStyle='#7a5a3a';c.fillRect(tx-4,ty-2.5,8,5);for(let f=0;f<5;f++){c.fillStyle=['#e07aa0','#ffd27a','#fff6d8','#d9533f','#b58ae0'][(f+q)%5];c.fillRect(tx-3+f*1.5,ty-1+(f%2),1.2,1.2)}}
   else{c.fillStyle='rgba(0,0,0,.22)';c.beginPath();c.ellipse(tx+1.5,ty+2.5,4.5,2,0,0,7);c.fill();c.fillStyle='#3f7a33';c.beginPath();c.arc(tx,ty-1,4.3,0,7);c.fill();c.fillStyle='#5a9a4a';c.beginPath();c.arc(tx-1.2,ty-2.4,2,0,7);c.fill()}});
  // benches beside the fountain
  c.fillStyle='#7a5634';c.fillRect(mx-11,my-5.5,5,1.4);c.fillRect(mx+6,my+4,5,1.4);
  // a lamp post at each gate
  for(const gx of[x0+1,x1-1]){c.fillStyle='#333';c.fillRect(gx-.4,my-8,.8,5);c.fillStyle='rgba(255,220,130,'+(.6+.3*Math.sin(tm*2+gx))+')';c.beginPath();c.arc(gx,my-8.4,1.1,0,7);c.fill()}
  // people strolling: along the street path and the cross path
  for(let q=0;q<3;q++){const u=((tm*.06+q*.37+hash(p.gx,p.gy,q))%1),along=q<2,px=along?x0+2+u*(w-4):mx+.8,py=along?my+(q?1:-1)*.9:y0+3+((u*2)%1)*(h-6);c.fillStyle=['#c0392b','#2f6b86','#d9822b'][q];c.fillRect(px-.9,py-3,1.8,2.4);c.fillStyle='#f0d2b0';c.beginPath();c.arc(px,py-3.8,.9,0,7);c.fill()}
  c.restore()}}catch(e){}return o.apply(this,arguments)}}
// v245 (Sébastien): menus that pick an island (Trains, Tech…) start on the island you are looking at: the one under the
// middle of the screen, else the one whose nearest building is closest to the middle
function viewIsl(){try{const IS=shIsles(),cx=cam.x/TS,cy=cam.y/TS,k0=ISLC[id(Math.max(0,Math.min(N-1,Math.floor(cx))),Math.max(0,Math.min(N-1,Math.floor(cy))))];if(IS.includes(k0))return k0;
 let best=null,bd=1e9;for(const o of sites){if(!o.linked||o.hidden)continue;const q=islOf(o);if(!IS.includes(q))continue;const d=Math.hypot(o.x+.5-cx,o.y+.5-cy);if(d<bd){bd=d;best=q}}return best}catch(e){return null}}
if(typeof document!=='undefined'&&document.querySelectorAll)for(const b of document.querySelectorAll('[data-m]'))b.addEventListener('click',()=>{const k=viewIsl();if(k!=null)S.shI=k},true);
// v246 (Sébastien): tap an order icon over a town to open that order: every ingredient with how much has arrived,
// where it comes from or why it isn't coming, and the fix
let TAPW=null;
if(typeof window!=='undefined'&&window.addEventListener)window.addEventListener('pointerup',e=>{try{const cv=document.querySelector('canvas'),r=cv.getBoundingClientRect();TAPW=[(e.clientX-r.left-W/2)/cam.z+cam.x,(e.clientY-r.top-H/2)/cam.z+cam.y]}catch(er){}},true);
function ordIconAt(wx,wy){for(const s of sites){if(s.type!=='town'||!(s.pop>0)||!s.linked||s.hidden)continue;if(!(cam.z>=1.15||sel===s))continue;const od=ordOf(s);if(!od)continue;const nd=Object.keys(od).filter(k=>((s.got||{})[k]||0)<od[k]);const X=s.x*TS+TS/2,Y=s.y*TS+TS/2;
 for(let j=0;j<nd.length;j++){const ix=X-(nd.length-1)*12+j*24,iy=Y+34;if(Math.hypot(wx-ix,wy-iy)<=14)return[sites.indexOf(s),nd[j]]}}return null}
{const o=tap;tap=function(x,y){try{if((mode==='pan'||mode==='trains')&&TAPW){const h=ordIconAt(TAPW[0],TAPW[1]);TAPW=null;if(h){showOrd(h[0],h[1]);return}}}catch(e){}return o.apply(this,arguments)}}
function showOrd(i,fk){const T=sites[i];if(!T)return;const od=ordOf(T);if(!od){showInfo(T);return}const el=document.getElementById('panel');openShed=null;openFac=null;openInfo=null;el.style.display='block';
 const ks=Object.keys(od).sort((a,b)=>(a===fk?-1:b===fk?1:0));const done=ks.filter(k=>((T.got||{})[k]||0)>=od[k]).length;
 let h=backBtn('Back to '+nm(T),'showInfo(sites['+i+'])')+'<b style="font-size:16px">📋 '+nm(T)+' order</b><br><small style="opacity:.8">'+done+' of '+ks.length+' goods delivered · fill them all and '+nm(T)+' grows</small>';
 for(const k of ks){const got=Math.floor((T.got||{})[k]||0),need=od[k],ok=got>=need,fr=Math.min(1,got/need);let col=C9.ok,info='✅ Delivered';if(!ok){const r=srcOf(T,k);col=r[0];info=r[1]}
  h+='<div style="margin-top:7px;padding:7px 9px;border-radius:10px;background:#2a221a;border-left:5px solid '+(ok?C9.ok:col)+(k===fk?';outline:2px solid #ffd27a':'')+'"><div style="display:flex;align-items:center;gap:8px"><span style="font-size:22px">'+TYPES[k].g+'</span><span style="flex:1"><b>'+GOOD[k]+'</b> <small>'+got+' / '+need+'</small><div style="height:6px;border-radius:3px;background:#0006;margin-top:3px"><div style="height:6px;border-radius:3px;width:'+Math.round(fr*100)+'%;background:#ffd27a"></div></div></span></div><small style="display:block;margin-top:4px;opacity:.92">'+info+'</small></div>'}
 el.innerHTML=h;PANEL={n:'showOrd',a:[i,fk]}}
if(typeof window!=='undefined')window.showOrd=showOrd;
// v248 (Sébastien: unclear where trade goods go): the capital itself carries a "🤝 Trade" pill under its name:
// what it wants, how many arrived, and from which island. Tap it (or an order icon) for the order page, which now
// starts with the trade order: where it is delivered, how it travels, and what is missing.
let TPILL=[];
{const o=draw;draw=function(){o.apply(this,arguments);TPILL=[];try{if(cam.z<.55||!S.tro)return;for(const k of regions()){const C=capOf(k),q=S.tro[k];if(!C||!q||q.done||!rev[id(C.x,C.y)]||!lblBig(C))continue;
 const wx=C.x*TS+TS/2,wy=C.y*TS+TS/2+(cam.z>=1.15?56:40),sx=(wx-cam.x)*cam.z+W/2,sy=(wy-cam.y)*cam.z+H/2;if(sx<-150||sy<-40||sx>W+150||sy>H+40)continue;
 const t='🤝 Trade: '+TYPES[q.k].g+' '+Math.floor(q.got)+'/'+q.need+' from '+islName(q.from);ctx.save();ctx.font='700 12px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';const w=ctx.measureText(t).width+16,h=20;
 ctx.fillStyle='rgba(32,52,74,.94)';ctx.beginPath();ctx.roundRect?ctx.roundRect(sx-w/2,sy-h/2,w,h,10):ctx.rect(sx-w/2,sy-h/2,w,h);ctx.fill();ctx.lineWidth=1.5;ctx.strokeStyle='#8fc7e8';ctx.stroke();ctx.fillStyle='#e6f4ff';ctx.fillText(t,sx,sy+1);ctx.restore();
 TPILL.push({i:sites.indexOf(C),x0:(sx-w/2-W/2)/cam.z+cam.x,x1:(sx+w/2-W/2)/cam.z+cam.x,y0:(sy-h/2-H/2)/cam.z+cam.y,y1:(sy+h/2-H/2)/cam.z+cam.y})}}catch(e){}}}
{const o=tap;tap=function(x,y){try{if((mode==='pan'||mode==='trains')&&TAPW){const p=TPILL.find(p=>TAPW[0]>=p.x0&&TAPW[0]<=p.x1&&TAPW[1]>=p.y0&&TAPW[1]<=p.y1);if(p){TAPW=null;showOrd(p.i,'tro');return}}}catch(e){}return o.apply(this,arguments)}}
function troHtml(C){const k=islOf(C),q=S.tro&&S.tro[k];if(!q||q.done)return'';const got=Math.floor(q.got),fr=Math.min(1,got/q.need),m=troMiss(k,q);try{const Ps=sites.filter(P=>offerOf(P)===q.k&&P.linked&&!P.hidden&&islOf(P)===q.from),bl=Ps.map(P=>[P,blockOf(P)]).filter(x=>x[1]);if(Ps.length&&bl.length===Ps.length)for(const[P,b]of bl)m.push('❗ '+nm(P)+' on '+islName(q.from)+': '+b.t+' '+blockFix(P,b))}catch(e){}
 const on=S.trains.some(t=>t.lh&&t.k===q.k&&t.cargo>0)||S.ships.some(s=>(s.c||{})[q.k]>0);
 return'<div style="margin-top:7px;padding:7px 9px;border-radius:10px;background:#1f2a36;border-left:5px solid #8fc7e8"><div style="display:flex;align-items:center;gap:8px"><span style="font-size:22px">'+TYPES[q.k].g+'</span><span style="flex:1"><b>🤝 Trade order: '+GOOD[q.k]+'</b> <small>'+got+' / '+q.need+' · pays '+fmt(q.rew)+'</small><div style="height:6px;border-radius:3px;background:#0006;margin-top:3px"><div style="height:6px;border-radius:3px;width:'+Math.round(fr*100)+'%;background:#8fc7e8"></div></div></span></div>'
  +'<small style="display:block;margin-top:4px;opacity:.92">📍 Delivered to <b>'+nm(C)+'</b> (the capital of '+islName(k)+'). It must come from <b>'+islName(q.from)+'</b>, which specialises in '+GOOD[q.k].toLowerCase()+'. It travels by 🚢 cargo ship or a long-haul train, then by rail to '+nm(C)+'. Optional: it pays a bonus and counts as a filled order for your Railway level.</small>'
  +(m.length?'<small style="display:block;margin-top:4px;color:#ffb36b"><b>Why nothing arrives yet:</b><br>'+m.join('<br>')+'</small>':'<small style="display:block;margin-top:4px;color:#7fd36b">'+(on?'🚢 Some is on its way':'✅ The route is ready: it ships as soon as '+islName(q.from)+' has some to spare')+'</small>')+'</div>'}
{const o=showOrd;showOrd=function(i,fk){const C=sites[i];if(!C)return;const k=islOf(C),q=S.tro&&S.tro[k],isCap=capOf(k)===C;if(!isCap||!q||q.done)return o(i,fk);
 if(!ordOf(C)){const el=document.getElementById('panel');openShed=null;openFac=null;openInfo=null;el.style.display='block';el.innerHTML=backBtn('Back to '+nm(C),'showInfo(sites['+i+'])')+'<b style="font-size:16px">📋 '+nm(C)+' orders</b>'+troHtml(C);PANEL={n:'showOrd',a:[i,fk]};return}
 o(i,fk);try{const el=document.getElementById('panel'),sm=el.querySelector('small');const h=troHtml(C);if(fk==='tro'&&sm)sm.insertAdjacentHTML('afterend',h);else el.insertAdjacentHTML('beforeend',h)}catch(e){}}}
if(typeof window!=='undefined')window.showOrd=showOrd;
// v250 (Sébastien OK'd): a trade order only asks for something the capital's own island can't make
// (no producer, deposit or factory for it there), picked from what the other island makes. An order nobody has
// started that breaks this rule switches to a sensible good, or to another island; with no sensible good it is dropped.
function islMakes(k,g){return sites.some(o=>!o.hidden&&islOf(o)===k&&(o.linked&&offerOf(o)===g||o.type==='dep'&&o.res===g))||(FAC[Object.keys(FAC).find(f=>FAC[f].out===g)]&&sites.some(o=>islOf(o)===k&&o.linked&&isFac(o)&&FAC[o.type].out===g))}
function troPick(k,r){const made={};for(const P of sites){const g=offerOf(P);if(!g||!P.linked||P.hidden||islOf(P)!==r||P.type==='port')continue;made[g]=(made[g]||0)+makeRate(P)*(isFac(P)?2:1)}
 const sp=regSpec(r),ok=g=>TYPES[g]&&!islMakes(k,g)&&(typeof canShip!=='function'||canShip(g)||true);
 if(sp&&made[sp]&&ok(sp))return sp;const L=Object.keys(made).filter(ok).sort((a,b)=>(isFac({type:b})?1:0)-(isFac({type:a})?1:0)||made[b]-made[a]);return L[0]||null}
function troFix(){if(!S.tro)return;for(const k of Object.keys(S.tro).map(Number)){const q=S.tro[k];if(!q||q.done||q.got>0||!islMakes(k,q.k))continue;
 const R=[q.from,...regions().filter(r=>r!==k&&r!==q.from&&tradeOk(k,r))];let done=false;for(const r of R){const g=troPick(k,r);if(g){q.from=r;q.k=g;done=true;break}}
 if(!done)delete S.tro[k]}}
{const o=tradeOf;tradeOf=function(C){let q=o.apply(this,arguments);try{troFix();q=S.tro&&S.tro[islOf(C)]||null}catch(e){}return q}}
{const o=tick;tick=function(dt){o(dt);S._trfT=(S._trfT||0)-dt;if(S._trfT<=0){S._trfT=5;try{troFix()}catch(e){}}}}
// v253 (Sébastien: audit every alert). Checked against what actually moved over 5 game minutes on 6 saves. Added:
// 1) no trains at all on a building's island; 2) a dock holding goods for another island with no cargo ship; 3) goods
// whose only buyers are overseas but ships lack the hold (above); 4) the ⚠ list groups town orders nobody can make yet;
// 5) "why no X" on island towns no longer says "build track" to a building on another island.
{const o=blockOf;blockOf=function(s){let r=o.apply(this,arguments);try{if(!s||s.hidden||!s.linked)return r;const i=sites.indexOf(s),key='v253/'+i;
 if(!r&&(isInd(s)||isFac(s))){const k=islOf(s),n=S.trains.filter(t=>t.st!=='ferry'&&tIslNow(t)===k).length+S.ferT.filter(f=>sites[f.to]&&islOf(sites[f.to])===k).length+S.trains.filter(t=>t.st==='ferry'&&t.fk===k).length;
  if(!n)r={t:'No trains on '+islName(k),noT:k,why:'No train works on '+islName(k)+', so nothing here can move. Buy one: it sails over on a cargo ship.'}}
 if(!r&&s.type==='port'){const L=Object.entries(s.ex||{}).filter(([e,q])=>sumG(q)>=1&&sites[e]);if(L.length&&!S.ships.length){const E=sites[L[0][0]];r={t:'No cargo ship',noShip:i,why:Math.floor(sumG(L[0][1]))+' goods are waiting here to sail to '+nm(E)+', but you have no cargo ship.'}}
  else if(L.length){const off=L.find(([e])=>{const l=laneOf(i,+e);return l&&l.off});if(off)r={t:'Sea route closed',why:'Goods wait here for '+nm(sites[off[0]])+' but that sea route is switched off.'}}}
 }catch(e){}return r}}
// the map ❗ and card banner already use blockOf; ports need the card banner too
{const o=showPort;showPort=function(P){const r=o.apply(this,arguments);try{const el=document.getElementById('panel'),b=blockOf(P);if(b&&el&&!el.querySelector('#blkbox')){const h='<div id="blkbox">'+banner(C9.bad,'❗ '+b.t)+'<small style="opacity:.9">'+b.why+'</small><div>'+blockFix(P,b)+'</div></div>';const br=el.querySelector('br');if(br)br.insertAdjacentHTML('afterend',h);else el.insertAdjacentHTML('afterbegin',h)}}catch(e){}return r};if(typeof window!=='undefined')window.showPort=showPort}
// ⚠ list: town orders nobody can make yet, one line per good (not on the map, the towns' red dots show it there)
function ordGaps(){const G={};for(const T of sites){if(T.type!=='town'||!T.linked||T.hidden||!(T.pop>0))continue;const od=ordOf(T);if(!od)continue;for(const k in od){if(((T.got||{})[k]||0)>=od[k])continue;if(sites.some(P=>P.linked&&!P.hidden&&offerOf(P)===k&&P.type!=='port'))continue;if(sites.some(P=>P.type==='port'&&P.linked&&((P.im||{})[k]||0)>=1))continue;(G[k]=G[k]||[]).push(T)}}return G}
{const o=evList;evList=function(){const L=o.apply(this,arguments);try{const G=ordGaps();for(const k in G){const fk=Object.keys(FAC).find(x=>FAC[x].out===k),lock=fk&&FAC[fk].lvl>S.beacon,T=G[k][0];L.push({i:id(T.x,T.y),t:'📋 '+G[k].length+' town'+(G[k].length>1?'s':'')+' want '+GOOD[k].toLowerCase()+(fk?(lock?' (🔒 '+TYPES[fk].n+')':': build a '+TYPES[fk].n):''),f:()=>showOrd(sites.indexOf(T),k)})}}catch(e){}return L}}
// "why no X" for a town: when nothing on its own island makes X, say so (and whether a ship can bring it) instead of "build track" to another island
{const o=srcOf;srcOf=function(T,k){const r=o.apply(this,arguments);try{if(r[0]===C9.ok)return r;const I=islOf(T),own=sites.some(P=>P.linked&&!P.hidden&&offerOf(P)===k&&islOf(P)===I&&P.type!=='port');if(own)return r;
 const far=sites.filter(P=>P.linked&&!P.hidden&&offerOf(P)===k&&islOf(P)!==I&&P.type!=='port');if(!far.length)return r;const J=islOf(far[0]),sea=(()=>{try{return islHops(J,I)<=2}catch(e){return false}})();
 const g=gname(k);if(sea&&canShip(k))return[C9.warn,'<b>'+g+' comes by ship:</b> nothing on '+islName(I)+' makes it, so it sails over from '+islName(J)+' when they have some to spare. Faster: build your own '+(typeof mkr==='function'?mkr(k):'producer')+' on '+islName(I)+'.'];
 if(sea)return[C9.bad,'<b>Why no '+g+' yet:</b> it is made on '+islName(J)+', but your cargo ships have no hold for it (🚂 Trains → 🚢 Ships). Or build your own on '+islName(I)+'.'];
 return[C9.bad,'<b>Why no '+g+' yet:</b> nothing on '+islName(I)+' makes it, and no ship route links it to '+islName(J)+' where it is made. Build your own '+(typeof mkr==='function'?mkr(k):'producer')+' here, or link a dock on each island.']}catch(e){}return r}}
// ===== v256 (Sébastien OK'd): ISLAND SPECIALTIES, FISHING ISLANDS AND THE CANNERY =====
// Every named island has one specialty. Buildings making it there work 50% faster and hold 50% more.
// Islands nobody has seen yet are shaped by it (mountains for stone/coal/iron, flat for wheat, forest for wood) and get
// deposits for coal/iron/oil. Islands already seen keep their shape and get the specialty that best fits what is there.
const ISPECS=['wood','farm','stone','coal','iron','oil','fish'],ISPN={wood:'Timber island',farm:'Wheat island',stone:'Stone island',coal:'Coal island',iron:'Iron island',oil:'Oil island',fish:'Fishing island'};
function islSpec(k){return S.ispec&&S.ispec[k]||null}
let ISLT=null;function islTiles(){if(ISLT)return ISLT;ISLT={};for(let i=0;i<N*N;i++){const k=ISLC[i];if(k>=0&&ISLS[k]&&ISLS[k].nm)(ISLT[k]=ISLT[k]||[]).push(i)}return ISLT}
function specFit(k){const T=islTiles()[k]||[];let g=0,f=0,m=0,c=0;for(const i of T){const t=terr[i];if(t===1)g++;else if(t===2)f++;else if(t>=3)m++;const x=i%N,y=(i/N)|0;if(D4.some(([a,b])=>{const j=id(x+a,y+b);return j>=0&&j<N*N&&ocean[j]}))c++}
 const n=Math.max(1,T.length),on=k=>sites.some(o=>islOf(o)===k);
 const has=r=>sites.filter(o=>islOf(o)===k&&!o.gone&&(o.type===r||o.type==='dep'&&o.res===r)).length;
 if(S.ires&&S.ires[k]&&has(S.ires[k])&&sites.some(o=>o.type===S.ires[k]&&islOf(o)===k))return S.ires[k];
 const hl=T.filter(i=>terr[i]===3).length;const sc={wood:f/n,farm:g/n*.7,wool:hl/n*1.1,stone:m/n*1.2,coal:has('coal')>=2?m/n*1.3:0,fish:c/n*1.5+(sites.some(o=>o.type==='port'&&o.fish>0&&islOf(o)===k)?.15:0)};if(S.ires&&S.ires[k]&&has(S.ires[k]))sc[S.ires[k]]=.3;
 return Object.keys(sc).sort((a,b)=>sc[b]-sc[a])[0]}
function specShape(k,sp){const T=islTiles()[k]||[];const keep=new Set();for(const o of sites){if(islOf(o)!==k)continue;for(let j=-1;j<=1;j++)for(let i=-1;i<=1;i++)keep.add(id(o.x+i,o.y+j))}for(const p of(typeof POIS!=='undefined'?POIS:[]))if(p.k===k)keep.add(id(p.x,p.y));
 for(const i of T){if(keep.has(i)||track.has(i)||!terr[i])continue;const x=i%N,y=(i/N)|0;if(D4.some(([a,b])=>!terr[id(x+a,y+b)]))continue;const t=terr[i];
  if(sp==='stone'||sp==='coal'||sp==='iron'){if(t===1||t===2){const v=vn(x/5,y/5,71);if(v>.6)terr[i]=4;else if(v>.48)terr[i]=3}}
  else if(sp==='farm'){if(t>=3||t===2&&vn(x/4,y/4,73)>.3)terr[i]=1}
  else if(sp==='wood'){if(t===1&&vn(x/4,y/4,72)>.3)terr[i]=2}}}
function specInit(){S.ispec=S.ispec||{};S.ishape=S.ishape||{};const H=homeK(),T=islTiles();
 if(!S.isp256){S.isp256=1;for(const k in T){const kk=+k;if(S.ispec[kk])continue;const seen=kk===H||T[k].some(i=>rev[i]);
   if(seen){S.ispec[kk]=specFit(kk);continue}
   const h=hash(kk*13+5,kk*7+1,911),ir=S.ires&&S.ires[kk];S.ispec[kk]=ir&&h<.3?ir:['wood','farm','stone','coal','fish','wool'][Math.floor(hash(kk*11+3,kk*5+2,913)*6)];S.ishape[kk]=1}
  // deposits: an unseen coal/iron/oil island gets at least 3 of them (hidden until scouted)
  for(const k in S.ishape){const sp=S.ispec[k];if(!['coal','iron','oil'].includes(sp))continue;specShape(+k,sp);let n=sites.filter(o=>islOf(o)===+k&&(o.type==='dep'&&o.res===sp||o.type===sp)).length;for(let t=0;n<3&&t<6;t++){const p=depSpot(+k,sp);if(!p)break;sites.push({type:'dep',x:p[0],y:p[1],res:sp,hidden:true,seen:0,stock:0,rich:ISLS[k].d>75?1:0});n++}}
  save()}
 for(const k in S.ishape)specShape(+k,S.ispec[k])}
let SPECOK=0;{const o=tick;tick=function(dt){if(!SPECOK){SPECOK=1;try{specInit()}catch(e){console.error(e)}}return o.apply(this,arguments)}}
// the bonus
const specGood=s=>!s?null:s.type==='port'?(s.fish>0?'fish':null):['wood','farm','stone','coal','iron','oil','wool'].includes(s.type)?s.type:null;
const specOn=s=>{const g=specGood(s);return!!g&&islSpec(islOf(s))===g};
{const r0=IND.rate,c0=IND.cap;IND.rate=s=>r0(s)*(specOn(s)?1.5:1);IND.cap=s=>c0(s)*(specOn(s)?1.5:1)}
// the island's trade good is its specialty when it makes it
{const o=regSpec;regSpec=function(k){const sp=islSpec(k),g=sp==='fish'?'fish':sp;if(g&&sites.some(P=>P.linked&&!P.hidden&&islOf(P)===k&&offerOf(P)===g))return g;return o.apply(this,arguments)}}
// ---- fishing islands: their towns put fish first (a bigger fish order, a smaller wheat one); fish is extra food elsewhere ----
// ---- 🥫 Cannery (Railway level 2): fish in, canned fish out; coastal cities order it once a cannery can reach them ----
TYPES.cannery={n:'Cannery',g:'🏭',col:'#2f6b86'};TYPES.cans={n:'Canned fish',g:'🥫',rate:26};GOOD.cans='Canned fish';FAC.cannery={in:{fish:1},out:'cans',lvl:2};if(!PRODS.includes('cans'))PRODS.push('cans');
const canReach=t=>{const I=islOf(t);return sites.some(o=>o.type==='cannery'&&o.linked&&!o.hidden&&(islOf(o)===I||(()=>{try{return islHops(islOf(o),I)<=2}catch(e){return false}})()))};
{const o=fishOrd;fishOrd=function(t,ord){const r=o.apply(this,arguments);try{if(!r||!t||t.type!=='town'||isHub(t))return r;const L=tlvl(t);if(t.v256L===undefined)t.v256L=L;if(L<=t.v256L)return r;
 if(t._v6L===L&&t._v6q)return t._v6q;if(t._v6L!==L){t._v6L=L;t._v6c=L>=3&&coastTown(t)&&canReach(t)?1:0}
 const q={...r};if(islSpec(islOf(t))==='fish'&&q.fish){q.fish=Math.round(q.fish*1.5/5)*5;if(q.farm)q.farm=Math.max(10,Math.round(q.farm*.7/5)*5)}
 if(t._v6c)q.cans=[0,0,0,30,60,90][L]||60;
 Object.defineProperty(t,'_v6q',{value:q,writable:true,configurable:true,enumerable:false});return q}catch(e){return r}}}
// the island label shows the specialty with a star
{const o=islInfoDraw;islInfoDraw=function(k,X,Y,f){const sp=islSpec(k);if(sp&&TYPES[sp]&&(S.isl||[]).includes(k)||sp&&k===homeK()){try{ctx.save();ctx.font='700 '+Math.round(f*.62)+'px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';const s='★ '+TYPES[sp==='fish'?'fish':sp].g+' '+ISPN[sp]+' · +50%',w=ctx.measureText(s).width+f*.7,h=f*.8,yy=Y+f*1.0;ctx.fillStyle='rgba(60,46,14,.8)';ctx.beginPath();ctx.roundRect?ctx.roundRect(X-w/2,yy-h/2,w,h,h/3):ctx.rect(X-w/2,yy-h/2,w,h);ctx.fill();ctx.fillStyle='#ffd27a';ctx.fillText(s,X,yy);ctx.restore()}catch(e){}}return o.apply(this,arguments)}}
// building cards: a line when the specialty bonus applies
if(typeof window!=='undefined')for(const nm2 of['showInfo','showPort']){const o=window[nm2];if(!o)continue;window[nm2]=function(a){const r=o.apply(this,arguments);try{const s=typeof a==='number'?sites[a]:a,el=document.getElementById('panel');if(s&&specOn(s)&&el&&!el.querySelector('#specln')){const h='<div id="specln" style="margin:3px 0;color:#ffd27a"><small>★ '+ISPN[islSpec(islOf(s))]+': this '+(s.type==='port'?'dock catches':'building makes')+' 50% more, 50% faster</small></div>';const br=el.querySelector('br');if(br)br.insertAdjacentHTML('afterend',h)}}catch(e){}return r}}
// ===== v257 (Sébastien OK'd): SHEEP AND WOOL, TEXTILE MILL, AND THE BUILDING PRICE FIX =====
// Price fix: raw buildings had two price rules stacked (+25% each from v128 frozen at load, then +30% each × Railway level).
// Now one rule: base × Railway-level factor × (1 + 30% for each of that kind you already own anywhere).
const BASE257={wood:600,farm:800,coal:1000,stone:800,iron:1500,oil:2500,wool:900};
const own257=k=>sites.filter(o=>o.type===k&&!o.gone).length;
for(const k in BASE257)Object.defineProperty(BUILD,k,{get(){return r100(BASE257[k]*XP()*(1+.3*own257(k)))},configurable:true,enumerable:true});
rmBack=function(o){if(o.paid)return Math.round(o.paid/2);if(isFac(o)){const ot=sites.filter(f=>f!==o&&isFac(f)&&!f.gone);return Math.round((ot.some(f=>f.type===o.type)?2500+1500*ot.length:2500)/2)}const b=BASE257[o.type];return b?Math.round(r100(b*XP()*(1+.3*Math.max(0,own257(o.type)-1)))/2):0};
// 🐑 Sheep Farm: on hills, with pasture (hills or grass) around it. Makes 🧶 wool.
TYPES.wool={n:'Sheep Farm',g:'🐑',col:'#8a7a5a',rate:10};GOOD.wool='Wool';WHERE.wool='on hills with 4+ hill or grass squares around for pasture';YARD_T.add('wool');
TYPES.textile={n:'Textile Mill',g:'🏭',col:'#7a4a6a'};TYPES.cloth={n:'Cloth',g:'🧵',rate:24};GOOD.cloth='Cloth';FAC.textile={in:{wool:1},out:'cloth',lvl:3};if(!PRODS.includes('cloth'))PRODS.push('cloth');
const pasture=(x,y)=>around(x,y,t=>t===1||t===3)-1;
{const o=indSpot;indSpot=function(x,y,k){if(k!=='wool')return o.apply(this,arguments);if(terr[id(x,y)]!==3)return'Sheep farms go on hills';const e=siteSpot(x,y);if(e)return e;return pasture(x,y)>=4?'':'Sheep need pasture: 4+ hill or grass squares around (only '+pasture(x,y)+')'}}
{const o=validFor;validFor=function(x,y,k){if(k==='wool')return!!rev[id(x,y)]&&!indSpot(x,y,'wool');return o.apply(this,arguments)}}
// orders: towns at level 2+ ask for wool once a sheep farm can reach them; cities (3+) ask for cloth once a textile mill can
const reach257=(t,ty)=>{const I=islOf(t);return sites.some(o=>o.type===ty&&!o.hidden&&!o.gone&&(islOf(o)===I||(()=>{try{return islHops(islOf(o),I)<=2}catch(e){return false}})()))};
{const o=fishOrd;fishOrd=function(t,ord){const r=o.apply(this,arguments);try{if(!r||!t||t.type!=='town'||isHub(t))return r;const L=tlvl(t);if(t.v257L===undefined)t.v257L=L;if(L<=t.v257L)return r;
 if(t._v7L===L&&t._v7q)return t._v7q;if(t._v7L!==L){t._v7L=L;t._v7w=L>=2&&reach257(t,'wool')?1:0;t._v7c=L>=3&&reach257(t,'textile')?1:0}
 if(!t._v7w&&!t._v7c)return r;const q={...r};if(t._v7w)q.wool=[0,0,25,40,60,80][L]||60;if(t._v7c)q.cloth=[0,0,0,25,45,70][L]||45;
 Object.defineProperty(t,'_v7q',{value:q,writable:true,configurable:true,enumerable:false});return q}catch(e){return r}}}
// wool as an island specialty (new games: hilly sheep islands)
ISPECS.push('wool');ISPN.wool='Sheep island';
{const o=specShape;specShape=function(k,sp){if(sp!=='wool')return o.apply(this,arguments);const T=islTiles()[k]||[];const keep=new Set();for(const s of sites){if(islOf(s)!==k)continue;for(let j=-1;j<=1;j++)for(let i=-1;i<=1;i++)keep.add(id(s.x+i,s.y+j))}
 for(const i of T){if(keep.has(i)||track.has(i)||terr[i]!==1&&terr[i]!==2)continue;const x=i%N,y=(i/N)|0;if(D4.some(([a,b])=>!terr[id(x+a,y+b)]))continue;if(vn(x/5,y/5,74)>.42)terr[i]=3}}}
// sheep farm look: the barn, a fenced paddock instead of the grain silo, and a few grazing sheep
{const o=drawInd2;drawInd2=function(s,X,Y,T,tm){const r=o.apply(this,arguments);if(s.type!=='wool')return r;const c=ctx;
 c.fillStyle='#7fa35a';c.fillRect(X-31,Y-4,17,14);c.strokeStyle='#e8dcc0';c.lineWidth=.9;c.strokeRect(X-31,Y-4,17,14);
 c.beginPath();for(const xx of[X-31,X-25,X-20,X-14]){c.moveTo(xx,Y-6);c.lineTo(xx,Y+10)}c.stroke();
 for(const[dx,dy,ph]of[[-27,1,0],[-20,5,1.7],[-24,7,3.1],[22,6,4.2]]){const b=Math.sin(tm*1.3+ph+s.x)*.6;
  c.fillStyle='#f4f1ea';c.beginPath();c.ellipse(X+dx+b,Y+dy,2.6,1.8,0,0,7);c.fill();c.fillStyle='#3a3430';c.beginPath();c.arc(X+dx+b+2.4,Y+dy-.5,.9,0,7);c.fill()}
 return r}}
// v257b (Sébastien: Lookout Hill sat on the rails): when track runs through it, the hill and its wooden lookout tower
// stand beside the line (on the side the track doesn't use) with a little footpath down to the rails
function lkOff(p){const i=id(p.x,p.y);if(!track.has(i))return[0,0];const tk=(dx,dy)=>track.has(id(p.x+dx,p.y+dy));const hz=tk(1,0)||tk(-1,0),vt=tk(0,1)||tk(0,-1);
 const sides=(hz&&!vt?[[0,-1],[0,1],[-1,0],[1,0]]:vt&&!hz?[[-1,0],[1,0],[0,-1],[0,1]]:[[0,-1],[-1,0],[1,0],[0,1]]).filter(([dx,dy])=>!tk(dx,dy)&&terr[id(p.x+dx,p.y+dy)]>0&&terr[id(p.x+dx,p.y+dy)]!==4&&!siteAt(p.x+dx,p.y+dy));
 const d=sides[0]||[0,-1];return[d[0]*TS*.85,d[1]*TS*.85]}
function lkDraw(done,o,tm){const c=ctx;
 if(o[0]||o[1]){const L=Math.hypot(o[0],o[1]),ux=-o[0]/L,uy=-o[1]/L;c.strokeStyle='#c8ae78';c.lineWidth=2;c.setLineDash([3,2]);c.beginPath();c.moveTo(ux*6,4+uy*6);c.lineTo(ux*(L-9),4+uy*(L-9));c.stroke();c.setLineDash([])}
 c.fillStyle='#5f7a3a';c.beginPath();c.ellipse(0,6,15,8,0,Math.PI,0);c.fill();c.fillStyle='#6f8c45';c.beginPath();c.ellipse(-2,5,11,6,0,Math.PI,0);c.fill();c.fillStyle='rgba(0,0,0,.18)';c.beginPath();c.ellipse(4,6,9,4,0,Math.PI,0);c.fill();
 c.strokeStyle='#6b4a2a';c.lineWidth=1.6;c.beginPath();c.moveTo(-5,2);c.lineTo(-3,-14);c.moveTo(5,2);c.lineTo(3,-14);c.stroke();
 c.lineWidth=.9;c.beginPath();c.moveTo(-4.6,-1);c.lineTo(3.6,-8);c.moveTo(4.6,-1);c.lineTo(-3.6,-8);c.moveTo(-4,-8);c.lineTo(4,-8);c.stroke();
 c.fillStyle='#8a6038';c.fillRect(-6,-16,12,3);c.fillStyle='#a14a32';c.beginPath();c.moveTo(-7.5,-16);c.lineTo(0,-22);c.lineTo(7.5,-16);c.closePath();c.fill();
 c.strokeStyle='#3a2a1a';c.lineWidth=1;c.beginPath();c.moveTo(0,-22);c.lineTo(0,-29);c.stroke();c.fillStyle=done?'#ffd27a':'#c9b6a0';const w=Math.sin(tm*4)*1.2;c.beginPath();c.moveTo(0,-29);c.lineTo(7,-27+w);c.lineTo(0,-25);c.fill()}
// ===== v258 (Sébastien OK'd): ADAPTIVE MISSIONS replace the island chapters =====
// One main mission at a time, picked from what your game needs next (a good towns are stuck on, a building you just
// unlocked, an island with what you lack, a town to link, an order to finish). Up to 2 optional side missions.
// Acts follow the Railway level. A per-game seed varies the order, the towns and islands picked and Mira's lines.
const TIERN=['Hamlet','Village','Town','City','Metropolis','Megacity','Megacity'];
const ACTS=[null,{ic:'🚂',t:'The Old Line',i:['Ashford\'s yard has been silent for eleven years. Mira hands you the keys: “Wake the line up. One camp, one farm, one town at a time.”','Mira blows the dust off the timetable. “Nobody’s run a train here in years. Let’s give them a reason to listen for the whistle.”']},
 {ic:'🏭',t:'Mills and Docks',i:['“Raw wood and wheat only go so far,” Mira says. “Mills turn them into what towns really want. And the sea is open now.”','The first sawdust drifts over Ashford. “Now we make things,” Mira grins. “And the harbour master says the docks can reopen.”']},
 {ic:'⚙️',t:'Steel and Wool',i:['“Cities want steel and cloth,” Mira says. “Iron is never where you want it. Find it.”','Mira pins a chart to the wall. “Steel for the bridges, wool for the winters. Neither will come to us.”']},
 {ic:'🌊',t:'Deep Water',i:['“Bigger ships, longer crossings,” Mira says. “The far islands are waiting.”','The harbour fills with deepwater hulls. “Every island we link makes the next one easier,” says Mira.']},
 {ic:'🏙',t:'Growing Towns',i:['“Our industries can grow bigger now,” Mira says. “The towns will grow with them.”','“Big towns, big orders,” Mira warns. “Keep the goods flowing.”']},
 {ic:'🚄',t:'Express Lines',i:['“Express engines!” Mira laughs. “The timetable will never be the same.”','The first express thunders through Ashford. Mira checks her watch twice.']},
 {ic:'🏗',t:'Heavy Industry',i:['“Level-five works,” Mira whistles. “Feed them and they’ll feed the whole map.”','Smoke from the big works can be seen from the next island. “Good,” says Mira.']},
 {ic:'🚃',t:'Long Trains',i:['“Longer trains, more cargo,” Mira says. “Let’s fill them.”','The platforms had to be lengthened. Mira didn’t complain.']},
 {ic:'⚡',t:'Express II',i:['“Faster still,” Mira says. “The islands feel close now.”','The old timetable is framed in the office. Nobody uses it any more.']},
 {ic:'👑',t:'The Network',i:['“Look at it,” Mira says from the clock tower. “Every whistle out there is ours.”','Mira hands you her old cap. “It’s your railway now. Keep it growing.”']}];
const MIRA={build:['“{why} A {n} would change everything,” Mira says.','Mira taps the map. “{why} Put a {n} here and watch.”','“{why} Time for a {n},” says Mira.'],
 reach:['“Sailors talk about {isl},” Mira says. “{rum}”','Mira unrolls a sea chart. “{isl}. {rum} Let’s go and see.”','“There’s land out there,” Mira says. “{isl}. {rum}”'],
 link:['“{town} still remembers the trains,” Mira says. “Bring them back.”','“The people of {town} wave at every whistle they hear,” Mira says. “Let’s give them one that stops.”','Mira circles {town} on the map. “That one’s next.”'],
 order:['“{town} needs {goods},” Mira says. “Help it grow into a {tier}.”','A letter from {town}: they want {goods}. Mira puts it on top of the pile.','“If {town} gets {goods}, it becomes a {tier},” Mira says. “That’s more trade for us.”'],
 up:['“It can’t keep up,” Mira sighs. “Everyone wants more of it.”','Mira frowns at the waiting list. “They’re all waiting on us.”'],
 trade:['“{cap} wants {good} from {from},” Mira says. “Big reward, long haul.”','A trade letter from {cap}: {good}, as much as we can ship.'],
 fish:['“Fish are jumping by the dock,” Mira says. “Boats would pay for themselves.”','The old fishermen at {n} ask about boats. Mira nods at you.'],
 ship:['“Our first {good}!” Mira says. “Now let’s get plenty of it moving.”','“{good} is flowing,” Mira says. “Keep it coming.”']};
const msR=(n)=>{S.ms=S.ms||{};if(S.ms.seed==null)S.ms.seed=Math.floor(Math.random()*1e6);return hash(S.ms.seed%997,(n|0)%9973,577+(S.ms.seed>>10)%101)};
const msPick=(arr,n)=>arr[Math.floor(msR(n)*arr.length)%arr.length];
const msFill=(s,o)=>s.replace(/\{(\w+)\}/g,(m,k)=>o[k]!=null?o[k]:'');
const openSite=s=>{if(!s)return;locateSite(s);const i=sites.indexOf(s);if(isFac(s))showFactory(i);else if(s.type==='port')showPort(s);else showInfo(s)};
const msOrdGoods=T=>{const o=ordOf(T)||{};return Object.keys(o).filter(k=>((T.got||{})[k]||0)<o[k])};
const msOrdProg=T=>{const o=ordOf(T)||{};let v=0,g=0;for(const k in o){g+=o[k];v+=Math.min(o[k],(T.got||{})[k]||0)}return[v,g]};
let MSB={};const msBuildable=k=>{const now=S.t||0;if(MSB[k]&&now-MSB[k].t<20)return MSB[k].v;let v=false;try{if(k==='port')v=S.beacon>=2;else if(FAC[k])v=FAC[k].lvl<=S.beacon;else{for(let y=2;y<N-2&&!v;y++)for(let x=2;x<N-2;x++)if(rev[id(x,y)]&&validFor(x,y,k)){v=true;break}}}catch(e){}MSB[k]={t:now,v};return v};
const msMaker=k=>{const fk=Object.keys(FAC).find(f=>FAC[f].out===k);return fk||(BUILD[k]!==undefined?k:null)};
const msIslWith=k=>{let best=null,bd=1e9;const H=sites[hubI()];ISLS.forEach((I,j)=>{if(!I||!I.nm||(S.isl||[]).includes(j)||j===homeK())return;if(!islTowns(j).length)return;const sp=islSpec(j),ir=(S.ires||{})[j];if(k&&sp!==k&&ir!==k)return;const d=Math.hypot(I.x-H.x,I.y-H.y);if(d<bd){bd=d;best=j}});return best};
// every candidate: {id,ty,pr,...}. pr 3 = something is stuck, 2 = a step forward, 1 = growth
const msHas=k=>sites.some(P=>P.linked&&!P.hidden&&offerOf(P)===k);
// a factory needs its inputs first: return the step that gets the first missing one (build its maker, or reach an island that has it)
function msStep(fk,pr,why){const f=FAC[fk];if(f)for(const k2 in f.in){if(msHas(k2)||sites.some(o=>o.type===msMaker(k2)))continue;const mk=msMaker(k2);
  if(mk&&FAC[mk]){if(FAC[mk].lvl<=S.beacon)return msStep(mk,pr,why+' A '+TYPES[fk].n+' needs '+GOOD[k2].toLowerCase()+' first.');return null}
  if(mk&&msBuildable(mk))return{id:'build:'+mk,ty:'build',k:mk,pr,why:why+' A '+TYPES[fk].n+' needs '+GOOD[k2].toLowerCase()+' first.',n:TYPES[mk].n};
  const j=msIslWith(k2);if(j!=null&&S.beacon>=2)return{id:'reach:'+j,ty:'reach',isl:j,pr,why:why+' A '+TYPES[fk].n+' needs '+GOOD[k2].toLowerCase()+', and your islands have none.'};return null}
 return{id:'build:'+fk,ty:'build',k:fk,pr,why,n:TYPES[fk].n}}
function msCands(){const C=[],H=sites[hubI()];
 // stuck goods: towns want something nobody makes
 try{const G=ordGaps();for(const k in G){const T=G[k],fk=msMaker(k),why=(T.length>1?T.length+' towns want ':T[0].name+' wants ')+GOOD[k].toLowerCase()+' and nothing makes it.';
  if(fk&&FAC[fk]&&FAC[fk].lvl<=S.beacon){const st=msStep(fk,3,why);if(st)C.push(st)}else if(fk&&!FAC[fk]&&msBuildable(fk))C.push({id:'build:'+fk,ty:'build',k:fk,pr:3,why,n:TYPES[fk].n});
  else if(fk&&!FAC[fk]){const j=msIslWith(fk);if(j!=null&&S.beacon>=2)C.push({id:'reach:'+j,ty:'reach',isl:j,pr:3,why:GOOD[k]+' isn\'t found on your islands.'})}}}catch(e){}
 // a producer that can't keep up
 try{const B=bottlenecks()[0];if(B&&B.A)C.push({id:'up:'+B.i,ty:'up',si:B.i,pr:3,why:B.towns.length+' towns wait for its '+GOOD[B.k].toLowerCase()+'.',n:nmS(B.A)})}catch(e){}
 // buildings just unlocked and never built
 for(const fk in FAC)if(FAC[fk].lvl<=S.beacon&&!sites.some(o=>o.type===fk)){const st=msStep(fk,2,'Your railway can build a '+TYPES[fk].n+' now: it turns '+Object.keys(FAC[fk].in).map(gname).join(' and ').toLowerCase()+' into '+GOOD[FAC[fk].out].toLowerCase()+'.');if(st&&!C.some(c=>c.id===st.id))C.push(st)}
 if(S.beacon>=2&&!sites.some(o=>o.type==='port'))C.push({id:'build:port',ty:'build',k:'port',pr:2,why:'The sea is open: a dock lets you reach other islands.',n:'Dock'});
 for(const k of['wood','farm','wool','stone','coal'])if(!sites.some(o=>o.type===k)&&(k==='wood'||k==='farm'||S.beacon>=2)&&msBuildable(k))C.push({id:'build:'+k,ty:'build',k,pr:k==='wool'?1:2,why:'You don\'t make '+GOOD[k].toLowerCase()+' yet.',n:TYPES[k].n});
 {const P=sites.find(o=>o.type==='port'&&o.linked&&!(o.fish>0));if(P&&S.beacon>=2)C.push({id:'fish',ty:'fish',si:sites.indexOf(P),pr:1,n:nmS(P)})}
 // towns to link: the visible ones on islands you reached
 for(const T of sites){if(T.type!=='town'||T.linked||T.hidden||T.beacon||!rev[id(T.x,T.y)])continue;const I=islOf(T);if(I!==homeK()&&!(S.isl||[]).includes(I))continue;C.push({id:'link:'+sites.indexOf(T),ty:'link',si:sites.indexOf(T),pr:2,town:T.name})}
 // islands to reach
 if(S.beacon>=2){const j=msIslWith(null);if(j!=null)C.push({id:'reach:'+j,ty:'reach',isl:j,pr:2})}
 // orders: towns close to growing, and Ashford's next size
 const OT=sites.filter(T=>T.type==='town'&&T.linked&&T.pop>0&&ordOf(T)&&msOrdGoods(T).length).map(T=>{const[v,g]=msOrdProg(T);return{T,f:g?v/g:0}}).sort((a,b)=>b.f-a.f).slice(0,4);
 for(const{T}of OT)C.push({id:'order:'+sites.indexOf(T)+':'+tlvl(T),ty:'order',si:sites.indexOf(T),pr:T===H?2:1});
 // capital trade orders (side missions)
 try{for(const k of regions()){const q=(S.tro||{})[k],Cp=capOf(k);if(q&&!q.done&&Cp)C.push({id:'trade:'+k+':'+q.n,ty:'trade',isl:k,pr:1,side:1})}}catch(e){}
 // a new good just started: get it moving
 for(const k of['wool','cloth','cans','fish','steel','fuel']){const d=(S.stats.del||{})[k]||0;if(d<60&&sites.some(P=>P.linked&&!P.hidden&&offerOf(P)===k))C.push({id:'ship:'+k,ty:'ship',k,pr:1,side:1})}
 // no dock yet: every 'reach' becomes 'build a dock' first
 if(!sites.some(o=>o.type==='port'&&o.linked))for(let i=0;i<C.length;i++)if(C[i].ty==='reach')C[i]={id:'build:port',ty:'build',k:'port',pr:C[i].pr,why:(C[i].why?C[i].why+' ':'')+islName(C[i].isl)+' is across the sea: you need a dock first.',n:'Dock'};
 {const seen=new Set();const C2=C.filter(c=>seen.has(c.id)?false:(seen.add(c.id),true));C.length=0;C.push(...C2)}
 return C}
// turn a candidate into a mission with its title, how-to, Mira line and progress baseline
function msMake(c,n){const m={...c,n,t0:S.t||0,rew:r100(400*Math.max(1,S.beacon)*(c.side?.5:1)+200)};const L=k=>msPick(MIRA[k],n*7+3);
 if(c.ty==='build'){m.t=(c.k==='port'?'Build a ⚓ Dock':'Build a '+TYPES[c.k].n);m.base=sites.filter(o=>o.type===c.k).length;m.g=1;m.how=c.k==='port'?'🏗 Build → ⚓ Dock, on a glowing coast near your track':FAC[c.k]?'🏗 Build → Factories: next to your track'+(Object.keys(FAC[c.k].in).length?', near where its '+Object.keys(FAC[c.k].in).map(gname).join(' and ').toLowerCase()+' comes from':''):'🏗 Build → '+TYPES[c.k].n+' · '+(WHERE[c.k]||'');m.mira=msFill(L('build'),{why:c.why,n:c.k==='port'?'dock':TYPES[c.k].n})}
 else if(c.ty==='up'){const A=sites[c.si];m.t='Expand the '+nmS(A);m.base=A.lvl||1;m.g=1;m.how='Open it and tap ⬆ Expand / Upgrade. '+c.why;m.mira=msFill(L('up'),{n:nmS(A),why:c.why})}
 else if(c.ty==='link'){const T=sites[c.si];m.t='Link '+T.name+' to your railway';m.g=1;m.how='🏗 Build → 🛤 Build rails: paint track from your network to '+T.name;m.mira=msFill(L('link'),{town:T.name})}
 else if(c.ty==='reach'){const I=islName(c.isl),sp=islSpec(c.isl),ir=(S.ires||{})[c.isl],rum=sp?'They say it\'s a '+ISPN[sp].toLowerCase()+(ir&&ir!==sp?', with '+GOOD[ir].toLowerCase()+' in its hills':'')+'.':ir?'They say it has '+GOOD[ir].toLowerCase()+'.':'Nobody has been there for years.';m.t='Reach '+I;m.g=1;m.how=(c.why?c.why+' ':'')+rum;m.mira=msFill(L('reach'),{isl:I,rum})}
 else if(c.ty==='order'){const T=sites[c.si],L0=tlvl(T),gs=msOrdGoods(T);m.base=L0;m.t=(T===sites[hubI()]?'Grow ':'Help ')+T.name+(T===sites[hubI()]?' into a ':' become a ')+TIERN[Math.min(6,L0+1)];m.g=1;m.how='It still needs '+gs.map(k=>TYPES[k].g+' '+GOOD[k].toLowerCase()).join(', ')+'. Tap it to see where each comes from.';m.mira=msFill(L('order'),{town:T.name,goods:gs.slice(0,2).map(k=>GOOD[k].toLowerCase()).join(' and '),tier:TIERN[Math.min(6,L0+1)].toLowerCase()})}
 else if(c.ty==='trade'){const q=S.tro[c.isl],Cp=capOf(c.isl);m.qn=q.n;m.t='Trade order: '+q.need+' '+GOOD[q.k].toLowerCase()+' to '+Cp.name;m.g=q.need;m.how='Long-haul trains or ships carry it from '+islName(q.from)+'. Reward on delivery '+fmt(q.rew)+'.';m.mira=msFill(L('trade'),{cap:Cp.name,good:GOOD[q.k].toLowerCase(),from:islName(q.from)})}
 else if(c.ty==='fish'){const P=sites[c.si];m.t='Buy 🎣 fishing boats at '+nmS(P);m.g=1;m.how='Open the dock and buy 🎣 Fishing boats: coastal towns buy fish.';m.mira=msFill(L('fish'),{n:nmS(P)})}
 else if(c.ty==='ship'){m.base=(S.stats.del||{})[c.k]||0;m.g=100;m.t='Deliver 100 '+GOOD[c.k].toLowerCase();m.how='Make sure a town, factory or dock takes it: open the building to see where it goes.';m.mira=msFill(L('ship'),{good:GOOD[c.k]})}
 return m}
// progress [v,g] and whether the mission still makes sense
function msProg(m){try{
 if(m.ty==='build')return[sites.filter(o=>o.type===m.k).length>m.base?1:0,1];
 if(m.ty==='up'){const A=sites[m.si];if(!A)return null;return[(A.lvl||1)>m.base?1:0,1]}
 if(m.ty==='link'){const T=sites[m.si];if(!T)return null;return[T.linked?1:0,1]}
 if(m.ty==='reach')return[(S.isl||[]).includes(m.isl)?1:0,1];
 if(m.ty==='order'){const T=sites[m.si];if(!T)return null;if(tlvl(T)>m.base)return[1,1];const[v,g]=msOrdProg(T);return[g?Math.min(.99,v/g):0,1,v,g]}
 if(m.ty==='trade'){const q=(S.tro||{})[m.isl];if(!q)return null;if(q.n!==m.qn||q.done)return[m.g,m.g];return[Math.floor(q.got),m.g]}
 if(m.ty==='fish'){const P=sites[m.si];if(!P)return null;return[P.fish>0?1:0,1]}
 if(m.ty==='ship')return[Math.min(m.g,Math.floor(((S.stats.del||{})[m.k]||0)-m.base)),m.g]}catch(e){return null}return null}
function msChoose(side){S.ms=S.ms||{};const M=S.ms,used=new Set([M.main&&M.main.id,...(M.side||[]).map(x=>x.id),...(M.skip||[])]);let C=msCands().filter(c=>!used.has(c.id)&&!(M.done||[]).slice(-6).some(d=>d.id===c.id));
 if(side)C=C.filter(c=>c.pr<=2);else C=C.filter(c=>!c.side);if(!C.length)return null;
 const top=Math.max(...C.map(c=>c.pr));let P=C.filter(c=>c.pr>=top-(side?2:1));if(!side&&M.lastTy)P=P.filter(c=>c.ty!==M.lastTy||c.pr===top).length?P.filter(c=>c.ty!==M.lastTy||c.pr===top):P;
 const n=(M.n=(M.n||0)+1),W=P.map(c=>(c.pr===top?3:1)*(1+.5*msR(n*31+c.id.length))),tot=W.reduce((a,b)=>a+b,0);let r=msR(n*13+5)*tot,pick=P[0];for(let i=0;i<P.length;i++){r-=W[i];if(r<=0){pick=P[i];break}}
 return msMake(side?{...pick,side:1}:pick,n)}
let MS_T=-9;function msTick(){if(S.tut<TUT.length)return;S.ms=S.ms||{};const M=S.ms;M.side=M.side||[];M.done=M.done||[];
 if(M.act!==S.beacon){const first=M.act==null;M.act=S.beacon;const A=ACTS[Math.min(10,S.beacon)]||ACTS[10];M.actI=msPick(A.i,S.beacon*5+1);if(typeof document!=='undefined'&&!first||first&&!M.intro){M.intro=1;try{notice(`<div style="text-align:center"><div style="font-size:30px">${A.ic}</div><small style="opacity:.75;letter-spacing:2px">ACT ${S.beacon} · RAILWAY LEVEL ${S.beacon}</small><br><b style="color:#ffd27a;font-size:19px">${A.t}</b></div><div style="margin-top:6px;font-style:italic">${M.actI}</div><small style="opacity:.75">Your next mission is at the top left. It changes with your game.</small>`)}catch(e){}}}
 const fin=(m,main)=>{const p=msProg(m);if(!p)return'drop';if(p[0]>=p[1]){S.money+=m.rew;led('story',m.rew);M.done.push({id:m.id,t:m.t,ty:m.ty,m:Math.round((S.t||0)/60),rew:m.rew});if(M.done.length>30)M.done.shift();if(main)M.lastTy=m.ty;try{toast('✅ Mission done: '+m.t+' · +'+fmt(m.rew))}catch(e){}return'done'}return''};
 if(M.main){const r=fin(M.main,1);if(r)M.main=null}
 M.side=M.side.filter(m=>!fin(m,0));
 if(!M.main){M.main=msChoose(0);if(M.main)save()}
 if(S.t-MS_T>20||M.side.length<2&&S.t-MS_T>4){MS_T=S.t;while(M.side.length<2){const s=msChoose(1);if(!s)break;M.side.push(s)}}}
tickChapter=function(){try{msTick()}catch(e){console.error(e)}};
chIntro=function(){};
// the card and story page read the missions through the old chapter hooks
const msAll=()=>{const M=S.ms||{};return[M.main,...(M.side||[])].filter(Boolean)};
chGoals=function(){return msAll().map((m,i)=>{const p=msProg(m)||[0,1];return{t:m.t,v:p[0]>=p[1]?1:p.length>2?0:p[0],g:p.length>2?1:p[1],how:msHow(m),go:'ms'+i,pv:p}})};
chStory=function(){const A=ACTS[Math.min(10,S.beacon)]||ACTS[10];return{ic:A.ic,title:A.t,intro:(S.ms&&S.ms.actI)||A.i[0],outro:''}};
{const o=chGo;chGo=function(go){if(typeof go==='string'&&go.startsWith('ms')){const m=msAll()[+go.slice(2)];if(!m)return;closePanel&&closePanel();
  if(m.ty==='build'){if(m.k!=='port'&&FAC[m.k]&&FAC[m.k].lvl>S.beacon){toast('🔒 Railway level '+FAC[m.k].lvl);return}document.querySelector('[data-m=build]').click();pickBuild(m.k);return}
  if(m.ty==='reach'){const c=chap(),k0=c.isl;c.isl=m.isl;try{nextTip0Reach()}finally{c.isl=k0}return}
  if(m.ty==='trade'){const Cp=capOf(m.isl);if(Cp){locateSite(Cp);try{showOrd(sites.indexOf(Cp),'tro')}catch(e){showInfo(Cp)}}return}
  openSite(sites[m.si]||null);return}return o.apply(this,arguments)}}
const msHow=m=>{try{return m.ty==='reach'&&!(S.isl||[]).includes(m.isl)?m.how+' <b>Next step:</b> '+reachInfo(m.isl).how:m.how||''}catch(e){return m.how||''}};
const msPv=(m)=>{const p=msProg(m)||[0,1];return p.length>2?' <b>'+Math.floor(p[2])+'/'+p[3]+'</b>':p[1]>1?' <b>'+p[0]+'/'+p[1]+'</b>':''};
chCard=function(tx){const M=S.ms||{},m=M.main,A=ACTS[Math.min(10,S.beacon)]||ACTS[10];const go='display:inline-block;padding:1px 9px;border-radius:7px;background:#ffd27a;color:#2a241b;font-weight:700';
 const line=m?'▶ <b>'+m.t+'</b>'+msPv(m)+` <span data-cg="1" style="${go}">Go ›</span>`:'📖 '+A.t;
 if(S.chMin!==false)return'<div style="display:flex;align-items:center;gap:6px"><span style="flex:1;white-space:normal;line-height:1.25">'+line+'</span><span data-fold="1" style="padding:0 6px;opacity:.8">▾</span></div>';
 let h=`<div style="display:flex;justify-content:space-between;gap:8px;align-items:baseline"><b style="font-size:13px">${A.ic} Act ${S.beacon} · ${A.t}</b><span data-fold="1" style="padding:0 6px;opacity:.8">▴</span></div>`;
 if(m)h+=`<div style="margin-top:3px;font-size:13px;color:#fff">${line}</div><div style="opacity:.75;font-size:11px">${msHow(m)}</div>`;
 for(const s of M.side||[])h+=`<div style="margin-top:3px;font-size:11px;opacity:.85">◇ ${s.t}${msPv(s)}</div>`;
 if(tx&&!/^🏁/.test(tx))h+=`<div style="margin-top:4px;padding-top:3px;border-top:1px solid #6b5a3e88;font-size:11px">💡 ${tx}${tipGo?` <span data-go="1" style="${go};font-size:11px">Go ›</span>`:''}</div>`;
 return h+'<div style="opacity:.55;font-size:10px;margin-top:2px">tap for the story 📖</div>'};

const msSkipC=m=>r100(m.rew*.25);
function msSkip(){const M=S.ms;if(!M||!M.main)return;const c=msSkipC(M.main);if(S.money<c){toast('Swapping costs '+fmt(c));return}if(!confirm2('msskip','Swap this mission for another? It costs '+fmt(c)+'.'))return;S.money-=c;led('story',-c);(M.skip=M.skip||[]).push(M.main.id);if(M.skip.length>8)M.skip.shift();M.main=null;msTick();showStory()}
showStory=function(){openShed=null;openFac=null;openInfo=null;sel=null;spot=null;PANEL={n:'showStory',a:[]};const el=document.getElementById('panel');el.style.display='block';const M=S.ms||{},A=ACTS[Math.min(10,S.beacon)]||ACTS[10];
 let h=`<div style="display:flex;gap:10px;align-items:center"><div style="font-size:30px">${A.ic}</div><div style="flex:1"><small style="opacity:.7;letter-spacing:1.5px">ACT ${S.beacon} · RAILWAY LEVEL ${S.beacon}</small><br><b style="font-size:17px;color:#ffd27a">${A.t}</b></div></div>`;
 const m=M.main;if(m)h+=`<div style="margin-top:8px;padding:8px 10px;border-radius:10px;background:#2a221a;border:1.5px solid #ffd27a"><small style="opacity:.7;letter-spacing:1px">MISSION</small><br><b style="color:#ffd27a">${m.t}${msPv(m)}</b><div style="margin-top:4px;font-style:italic;font-size:13px">${m.mira||''}</div><small style="opacity:.85">${msHow(m)}</small><div style="margin-top:4px">${tbtn('Go ›',"chGo('ms0')")} <small>Reward <b style="color:#7fd36b">${fmt(m.rew)}</b></small> <button onclick="msSkip()" style="margin-left:4px;padding:4px 9px;border-radius:8px;border:1px solid #6b5a3e;background:#3a2f22;color:#f3e6c8;font-size:12px">↻ Another mission · ${fmt(msSkipC(m))}</button></div></div>`;
 else h+='<div style="margin-top:8px;opacity:.8">Looking for your next mission…</div>';
 (M.side||[]).forEach((s,i)=>{h+=`<div style="margin-top:6px;padding:6px 9px;border-radius:9px;background:#221c15;border:1px solid #4a3d2c"><div style="display:flex;align-items:center;gap:8px"><div style="flex:1;min-width:0"><small style="opacity:.75">SIDE MISSION · optional · <span style="color:#7fd36b">${fmt(s.rew)}</span></small><br><b>${s.t}${msPv(s)}</b></div><div>${tbtn('Go ›',`chGo('ms${i+1}')`)}</div></div></div>`});
 h+=`<div style="margin-top:8px;padding:7px 10px;border-radius:9px;background:#1f1a13;border-left:3px solid #e9a646;font-style:italic;font-size:13px">${M.actI||A.i[0]}<div style="text-align:right;font-style:normal;opacity:.7;font-size:11px">· Mira, dispatcher</div></div>`;
 h+=sec2(`<b>🛤 Railway level ${S.beacon}</b>`+(RLV[S.beacon]?` · ${S.stats.orders||0}/${RLV[S.beacon]} orders<br><small>Next act unlocks ${RUNL[S.beacon]}</small>`:''));
 const D=(M.done||[]).slice(-5).reverse();if(D.length)h+=sec2('<b>📜 Done</b>'+D.map(d=>`<div style="font-size:12px;margin-top:2px">✅ ${d.t} <small style="opacity:.6">${d.m} min</small></div>`).join(''));
 el.innerHTML=h+'<i id="pgen"></i>'};
if(typeof window!=='undefined'){window.showStory=showStory;window.chGo=chGo;window.msSkip=msSkip}

// ===== v259 (Sébastien OK'd Muse/Gemini picks 1-5): calmer map =====
// labels: building names show from the default zoom up (or when tapped); dock stock, port size and trade pills only close up or when tapped
function selSite(){try{const p=panelSite();if(p)return p;const f=flowFocus();return f!=null?sites[f]:null}catch(e){return null}}
function lblOn(s){return cam.z>=1.6||selSite()===s}
function lblBig(s){return cam.z>=2.2||selSite()===s}
// "no train serves this" badges are amber, not error-red
{const o=needBadges;needBadges=function(s){const r=o.apply(this,arguments);return Array.isArray(r)?r.map(b=>b&&b.c==='#c0392b'?{...b,c:'#d9902a'}:b):r}}
// v270 (Sébastien: "no train" badge read like "never a train"): it now means "goods waiting for a free train" (⏳), shows only
// when a load is ready and has somewhere to go, and the building card explains it with a Buy a train button
const waitTrain=s=>{try{if(!(isInd(s)||isFac(s))||!s.linked||s.hidden)return false;const i=sites.indexOf(s);if(S.trains.some(t=>t.route&&t.route.a===i))return false;if((s.stock||0)<20)return false;const f=shipOf(s);return!!(f&&f.to!=null&&!f.why.length)}catch(e){return false}};
{const o=needBadges;needBadges=function(s){const r=o.apply(this,arguments);if(!Array.isArray(r))return r;return r.map(b=>b&&b.g==='🚃'?(waitTrain(s)?{g:'⏳',c:'#d9902a'}:null):b).filter(Boolean)}}
if(typeof window!=='undefined')for(const nm2 of['showInfo','showFactory']){const o=window[nm2];window[nm2]=function(a){const r=o.apply(this,arguments);try{const s=typeof a==='number'?sites[a]:a;const el=document.getElementById('panel');if(s&&waitTrain(s)&&el.insertAdjacentHTML&&!el.querySelector('#waitbox')){const k=islOf(s),home=k===homeK(),c=home?COST.train:(typeof islTC==='function'?islTC():COST.train);
 const h='<i id="waitbox"></i>'+banner(C9.warn,'⏳ '+Math.floor(s.stock)+' '+GOOD[offerOf(s)].toLowerCase()+' waiting for a free train')+'<small style="opacity:.88">All your trains on '+islName(k)+' are busy right now. One picks it up when it is free. Want it sooner?</small><div>'+tbtn('＋ Buy a train · '+fmt(c),home?'autoBuy()':'buyTrainFor('+k+')',S.money<c)+'</div>';
 const br=el.querySelector('br');if(br)br.insertAdjacentHTML('afterend',h);else el.insertAdjacentHTML('beforeend',h)}}catch(e){}return r}}

// side buttons fold into one ☰ drawer (Orders stays visible); open while the tutorial runs
if(typeof document!=='undefined'&&document.body&&document.body.appendChild&&document.body.classList){const B=document.createElement('button');B.id='menuBtn';B.textContent='☰';document.body.appendChild(B);
 const pos=()=>{const open=!document.body.classList.contains('mclosed');B.textContent=open?'✕':'☰';const st=(id,t)=>{const e=document.getElementById(id);if(e)e.style.top=t+'px'};if(open){st('viewBtn',92);st('atlasBtn',132);st('homeBtn',172);st('railBtn',212);st('fsBtn',252)}};
 const setM=c=>{document.body.classList.toggle('mclosed',c);pos()};setM(!(S.tut<TUT.length));
 B.onclick=()=>setM(!document.body.classList.contains('mclosed'));
 for(const id of['atlasBtn','homeBtn'])(()=>{const e=document.getElementById(id);if(e)e.addEventListener('click',()=>setTimeout(()=>setM(true),50))})();
 window.menuSet=setM}
// soft fog: a small canvas (4 px per tile) with the unexplored tiles painted dark, blurred once whenever the explored area changes,
// then drawn stretched over the map. Tiles next to explored land are lighter, so the edge fades over about a tile and a half.
let FOGC=null,FOGK=-1,FOGT=0;
function fogSoft(){const now=performance.now();if(!FOGC||now-FOGT>500){FOGT=now;let n=0;for(let i=0;i<N*N;i++)if(rev[i])n++;if(n!==FOGK||!FOGC){FOGK=n;const P=4,raw=document.createElement('canvas');raw.width=raw.height=N*P;const r=raw.getContext('2d');r.fillStyle='#1e1b16';
  for(let y=0;y<N;y++)for(let x=0;x<N;x++){if(rev[id(x,y)])continue;r.fillRect(x*P,y*P,P,P)}
  if(!FOGC){FOGC=document.createElement('canvas');FOGC.width=FOGC.height=N*P}const f=FOGC.getContext('2d');f.clearRect(0,0,N*P,N*P);f.filter='blur(3px)';f.drawImage(raw,0,0);f.filter='none';f.globalCompositeOperation='source-over';
  // keep deep fog fully dark: redraw tiles with no explored land within 1 square, unblurred, on top
  for(let y=0;y<N;y++)for(let x=0;x<N;x++){if(rev[id(x,y)])continue;let near=false;for(let j=-1;j<=1&&!near;j++)for(let i=-1;i<=1;i++){const a=x+i,b=y+j;if(a>=0&&b>=0&&a<N&&b<N&&rev[id(a,b)]){near=true;break}}if(!near){f.fillStyle='#1e1b16';f.fillRect(x*P-1,y*P-1,P+2,P+2)}}}}
 ctx.save();ctx.imageSmoothingEnabled=true;ctx.drawImage(FOGC,0,0,N*TS,N*TS);ctx.restore()}
// ===== graphics materials pass (preview only: window.GFX2 off until Sébastien approves) =====
var GFX2=true;
// 1. ballast: fine gravel specks in the track bed
function gfxBallast(SEG,LEN,AT){const C=['#8a8070','#a39a88','#6f665a','#b5ad9c'];for(const g of SEG)if(Array.isArray(g))for(const P of g){const L=LEN(P),n=Math.round(L/2.2);for(let k=0;k<n;k++){const[px,py,a]=AT(P,(k+.5)/n),h1=hash(Math.round(px*7),Math.round(py*7),61),h2=hash(Math.round(py*5),Math.round(px*5),62),o=(h1-.5)*16,sn=Math.sin(a),cs=Math.cos(a);ctx.fillStyle=C[(h2*4)|0];ctx.fillRect(px+sn*o-.6,py-cs*o-.6,1.3,1.3)}}}
// 3. grass: big soft colour patches (a small canvas, one pixel per square, drawn smoothed over the land)
let GGC=null,GGS=-1;function gfxGrass(){const se=season();if(!GGC||GGS!==se){GGS=se;GGC=document.createElement('canvas');GGC.width=GGC.height=N;const g=GGC.getContext('2d'),im=g.createImageData(N,N);
  for(let y=0;y<N;y++)for(let x=0;x<N;x++){const i=id(x,y),t=terr[i],p=i*4;if(t!==1&&t!==2)continue;const v=vn(x/6,y/6,81)-.5+(vn(x/2.5,y/2.5,83)-.5)*.35;if(v>0){im.data[p]=255;im.data[p+1]=236;im.data[p+2]=160;im.data[p+3]=Math.min(60,v*150)}else{im.data[p]=18;im.data[p+1]=40;im.data[p+2]=12;im.data[p+3]=Math.min(70,-v*170)}}
  g.putImageData(im,0,0)}ctx.save();ctx.imageSmoothingEnabled=true;ctx.drawImage(GGC,0,0,N*TS,N*TS);ctx.restore()}
// 2. walls: lit at the top, shaded at the base, with a soft contact shadow; 4. working factories glow at windows and chimney
{const o=drawInd2;drawInd2=function(s,X,Y,T,tm){const r=o.apply(this,arguments);if(!window.GFX2)return r;const c=ctx,g=c.createLinearGradient(0,Y-6,0,Y+8);g.addColorStop(0,'rgba(255,245,220,.18)');g.addColorStop(.5,'rgba(0,0,0,0)');g.addColorStop(1,'rgba(30,20,10,.32)');c.fillStyle=g;c.fillRect(X-14,Y-6,28,14);c.fillStyle='rgba(20,14,8,.25)';c.fillRect(X-15,Y+7.5,30,1.5);return r}}
{const o=drawFac2;drawFac2=function(s,X,Y,T,tm){const r=o.apply(this,arguments);if(!window.GFX2)return r;const c=ctx,g=c.createLinearGradient(0,Y-9,0,Y+11);g.addColorStop(0,'rgba(255,240,210,.16)');g.addColorStop(.55,'rgba(0,0,0,0)');g.addColorStop(1,'rgba(30,15,8,.35)');c.fillStyle=g;c.fillRect(X-18,Y-9,34,20);
 const lit=s.stock>0||(s.inv&&Object.values(s.inv).some(v=>v>0))||s.busy;if(lit){c.save();c.globalCompositeOperation='lighter';const p=.75+.25*Math.sin(tm*3+s.x);for(let k=0;k<4;k++){const wx=X-12.5+k*8,wy=Y-3,rg=c.createRadialGradient(wx,wy,0,wx,wy,7);rg.addColorStop(0,`rgba(255,180,70,${.35*p})`);rg.addColorStop(1,'rgba(255,180,70,0)');c.fillStyle=rg;c.fillRect(wx-7,wy-7,14,14)}
  const cx=X+19.5,cy=Y-32,rg=c.createRadialGradient(cx,cy,0,cx,cy,9);rg.addColorStop(0,`rgba(255,140,50,${.45*p})`);rg.addColorStop(1,'rgba(255,140,50,0)');c.fillStyle=rg;c.fillRect(cx-9,cy-9,18,18);c.restore()}return r}}
// ===== v260 preview: town houses and station platforms with more model-railway detail (window.HOUSE2) =====
var HOUSE2=true;
function houseDraw(hx,hy,k,v,hw,hh0,wc,rc,big,tm,hh){wc=wc||"#d9c9a6";rc=rc||["#a8432f","#7d3a2a","#3f5f7a"][((k%3)+3)%3];const c=ctx,two=v===1&&big||v===2,W=hw+1,x0=hx-W/2-.5,x1=x0+W,wy=hy-3-(two?3:0),wb=hy-4+hh0,rh=two?5:6,lit=Math.sin(tm*1.3+k)>.2;
 // soft contact shadow
 c.fillStyle='rgba(0,0,0,.28)';c.beginPath();c.ellipse(hx+2,wb+.5,W/2+2,2.4,0,0,7);c.fill();
 // side wall (depth), front wall with light from the top-left
 c.fillStyle=shade(wc,-.28);c.beginPath();c.moveTo(x1,wy);c.lineTo(x1+2.5,wy-1.6);c.lineTo(x1+2.5,wb-1.6);c.lineTo(x1,wb);c.fill();
 c.fillStyle=wc;c.fillRect(x0,wy,W,wb-wy);const g=c.createLinearGradient(0,wy,0,wb);g.addColorStop(0,'rgba(255,250,235,.22)');g.addColorStop(1,'rgba(40,25,10,.28)');c.fillStyle=g;c.fillRect(x0,wy,W,wb-wy);
 c.fillStyle='rgba(60,45,30,.35)';c.fillRect(x0,wb-1.2,W,1.2);// plinth
 if(v===3){c.strokeStyle='#5a4128';c.lineWidth=.7;c.beginPath();c.moveTo(x0+.4,wy);c.lineTo(x0+.4,wb);c.moveTo(x1-.4,wy);c.lineTo(x1-.4,wb);c.moveTo(x0,wy+(wb-wy)*.45);c.lineTo(x1,wy+(wb-wy)*.45);c.moveTo(x0+1,wb-1);c.lineTo(hx-1,wy+(wb-wy)*.45);c.stroke()}
 // windows with white frames and sills (two rows on tall houses)
 const rows=two?[wy+1.6,wy+(wb-wy)*.5]:[wy+(wb-wy)*.3];for(const ry of rows)for(const dx of[-W*.3,W*.3-2.4]){const wx=hx+dx;c.fillStyle='#f4efe2';c.fillRect(wx-.4,ry-.4,3.2,3.2);c.fillStyle=lit?'#ffd98a':'#56636e';c.fillRect(wx,ry,2.4,2.4);c.fillStyle='rgba(255,255,255,.35)';c.fillRect(wx,ry,1,1);c.fillStyle='#e8e0cc';c.fillRect(wx-.6,ry+2.8,3.6,.7);if(hh>.55&&ry===rows[rows.length-1]){c.fillStyle='#d9667a';c.fillRect(wx-.3,ry+3.5,1,.9);c.fillStyle='#f2c14e';c.fillRect(wx+1.5,ry+3.5,1,.9)}}
 // door with a step
 c.fillStyle='#5a3a24';c.fillRect(hx-1.2,wb-4.6,2.4,3.6);c.fillStyle='#e9c46a';c.fillRect(hx+.6,wb-3,.5,.5);c.fillStyle='#b8ab92';c.fillRect(hx-1.8,wb-1.1,3.6,1.1);
 // roof: front slope with tile rows, darker side slope, light ridge, shadow under the eaves
 c.fillStyle='rgba(0,0,0,.25)';c.fillRect(x0,wy,W,1.2);
 c.fillStyle=rc;c.beginPath();c.moveTo(x0-1.4,wy+.8);c.lineTo(x1+1.4,wy+.8);c.lineTo(x1-1.2,wy-rh);c.lineTo(x0+1.6,wy-rh);c.closePath();c.fill();
 c.fillStyle=shade(rc,-.3);c.beginPath();c.moveTo(x1+1.4,wy+.8);c.lineTo(x1+3.6,wy-.9);c.lineTo(x1+1.2,wy-rh-1.2);c.lineTo(x1-1.2,wy-rh);c.closePath();c.fill();
 c.fillStyle=shade(rc,.15);c.beginPath();c.moveTo(x0+1.6,wy-rh);c.lineTo(x1-1.2,wy-rh);c.lineTo(x1+1.2,wy-rh-1.2);c.lineTo(x0+3.8,wy-rh-1.2);c.closePath();c.fill();
 c.strokeStyle='rgba(0,0,0,.22)';c.lineWidth=.5;for(let t=1;t<rh;t+=1.6){const f=t/rh;c.beginPath();c.moveTo(x0-1.4+f*3,wy+.8-t);c.lineTo(x1+1.4-f*2.6,wy+.8-t);c.stroke()}
 if(v===0||big){c.fillStyle=shade(rc,.1);c.fillRect(hx-1.6,wy-rh+1.2,3.2,2.6);c.fillStyle=lit?'#ffd98a':'#56636e';c.fillRect(hx-.9,wy-rh+2,1.8,1.6)}// dormer
 // chimney with cap
 if(v!==3||big){const cx=x1-3;c.fillStyle='#8a4a34';c.fillRect(cx,wy-rh-3.5,2.2,4.2);c.fillStyle='#5a2f22';c.fillRect(cx-.4,wy-rh-4,3,1);
  if(hh>.35&&hh<.6){const u=(tm*.6+k*.37)%1;c.fillStyle=`rgba(225,220,210,${.5*(1-u)})`;c.beginPath();c.arc(cx+1+u*3,wy-rh-6-u*8,1.3+u*2.4,0,7);c.fill()}}}
function shade(hex,f){const n=parseInt(hex.slice(1),16);let r=n>>16,g=(n>>8)&255,b=n&255;const t=f<0?0:255,p=Math.abs(f);r=Math.round(r+(t-r)*p);g=Math.round(g+(t-g)*p);b=Math.round(b+(t-b)*p);return'rgb('+r+','+g+','+b+')'}
// platforms: paving joints, a white safety line at the edge, a glass canopy on iron columns over the middle, lamps and benches
function platDraw(L,tm){const c=ctx;for(const[y0,y1,edge]of[[-25,-17,-17.4],[17,25,17.4]]){
  c.strokeStyle='rgba(90,75,55,.22)';c.lineWidth=.5;for(let x=-L+3;x<L;x+=5){c.beginPath();c.moveTo(x,y0);c.lineTo(x,y1);c.stroke()}
  c.fillStyle='#f2ead2';c.fillRect(-L,edge+(edge<0?-1.6:.6),2*L,1);
  for(let x=-L+14;x<L-8;x+=34){c.fillStyle='#6b4a2a';c.fillRect(x+7,(y0+y1)/2-.8+(y0<0?-1.5:1.5),5,1.6);c.fillStyle='#3a2a1a';c.fillRect(x+7,(y0+y1)/2+.8+(y0<0?-1.5:1.5),.6,1);c.fillRect(x+11.4,(y0+y1)/2+.8+(y0<0?-1.5:1.5),.6,1)}// benches
  for(let x=-L+8;x<L-4;x+=28){const ly=y0<0?y1-2:y0+2;c.fillStyle='#2a2a2e';c.fillRect(x-.5,ly-6,1,6);const p=.8+.2*Math.sin(tm*2+x);const rg=c.createRadialGradient(x,ly-6.5,0,x,ly-6.5,6);rg.addColorStop(0,`rgba(255,220,140,${.45*p})`);rg.addColorStop(1,'rgba(255,220,140,0)');c.fillStyle=rg;c.fillRect(x-6,ly-12.5,12,12);c.fillStyle='#ffe3a0';c.fillRect(x-1,ly-7.5,2,1.6)}}// lamps
}

// grand terminus: an arched glass train shed (light along the crown, iron ribs, end screens) instead of a flat grid
function shedRoof(L){const c=ctx,g=c.createLinearGradient(0,-28,0,28);g.addColorStop(0,'rgba(70,90,100,.42)');g.addColorStop(.42,'rgba(200,225,235,.28)');g.addColorStop(.5,'rgba(255,255,255,.34)');g.addColorStop(.58,'rgba(200,225,235,.28)');g.addColorStop(1,'rgba(70,90,100,.42)');c.fillStyle=g;c.fillRect(-L,-28,2*L,56);
 c.lineWidth=1.3;for(let x=-L+7;x<L-3;x+=12){c.strokeStyle='rgba(38,46,52,.5)';c.beginPath();c.moveTo(x,-28);c.lineTo(x,28);c.stroke();c.strokeStyle='rgba(255,255,255,.28)';c.lineWidth=.6;c.beginPath();c.moveTo(x+.9,-27);c.lineTo(x+.9,27);c.stroke();c.lineWidth=1.3}
 c.strokeStyle='rgba(38,46,52,.28)';c.lineWidth=.6;for(const y of[-21,-11,0,11,21]){c.beginPath();c.moveTo(-L,y);c.lineTo(L,y);c.stroke()}
 c.fillStyle='rgba(58,63,68,.8)';c.fillRect(-L,-28,2*L,1.4);c.fillRect(-L,26.6,2*L,1.4);for(const e of[-1,1]){c.fillStyle='rgba(58,63,68,.8)';c.fillRect(e>0?L-2:-L,-28,2,56);c.strokeStyle='rgba(38,46,52,.45)';c.lineWidth=.7;for(let k=-3;k<=3;k++){c.beginPath();c.moveTo(e*L,0);c.lineTo(e*(L-7*Math.cos(k*.45)),26*Math.sin(k*.45));c.stroke()}}}
// v261 (Sébastien): no decorative resource dots; each island's ground takes a soil colour from its specialty instead
const SOIL={oil:'rgba(70,52,36,.22)',iron:'rgba(175,92,52,.2)',coal:'rgba(45,42,40,.2)',stone:'rgba(150,148,138,.18)',farm:'rgba(225,192,90,.17)',wood:'rgba(30,85,28,.17)',fish:'rgba(225,205,150,.15)',wool:'rgba(160,200,120,.16)'};
const SOILC={};function soilTint(k,th){if(SOILC[k]&&SOILC[k].t>performance.now())return SOILC[k].v;let v;try{if(k===homeK())v=(ISLTHEME.home||{}).tint;else{const sp=islSpec(k)||th;v=SOIL[sp]||(ISLTHEME[th]||ISLTHEME.home).tint}}catch(e){v=(ISLTHEME.home||{}).tint}SOILC[k]={v,t:performance.now()+3000};return v}

// v262 (Sébastien: the oil island had one oil spot): every coal, iron or oil island (by specialty or resource) has at least 3 deposits of it.
// Islands already explored get them as visible deposits; unexplored ones keep them hidden until scouted.
let DEP262=0;{const o=tick;tick=function(dt){if(!DEP262&&SPECOK){DEP262=1;try{if(!S.dep262){S.dep262=1;const K=new Set();for(const k in(S.ispec||{}))if(['coal','iron','oil'].includes(S.ispec[k]))K.add(+k);for(const k in(S.ires||{}))K.add(+k);
 for(const k of K){if(k===homeK())continue;const rs=new Set([S.ispec&&S.ispec[k],S.ires&&S.ires[k]].filter(r=>['coal','iron','oil'].includes(r)));for(const r of rs){for(const d of sites)if(d.type==='dep'&&d.res===r&&d.hidden&&islOf(d)===k&&rev[id(d.x,d.y)]){d.hidden=false;d.seen=1}let n=sites.filter(o=>islOf(o)===k&&(o.type==='dep'&&o.res===r||o.type===r)).length;for(let t=0;n<3&&t<8;t++){const p=depSpot(k,r);if(!p)break;const seen=!!rev[id(p[0],p[1])];sites.push({type:'dep',x:p[0],y:p[1],res:r,hidden:!seen,seen:seen?1:0,stock:0});n++}}}
 AUTO.k='';save()}}catch(e){console.error(e)}}return o.apply(this,arguments)}}

// v263 (Sébastien OK'd): the old 🧰 marker is gone; a dock holding landed goods the island's trains have no wagons for gets the normal ❗ "Needs … wagons" alert
{const o=wagonBlock;wagonBlock=function(s){const r=o.apply(this,arguments);if(r)return r;try{if(s&&s.type==='port'&&s.linked&&!s.hidden){const q=islOf(s);for(const k in(s.im||{})){if((s.im[k]||0)>=1&&!canCarry(k,q))return CARGO[cargoCls(k)]}}}catch(e){}return null}}
{const o=blockOf;blockOf=function(s){const r=o.apply(this,arguments);if(r||!s||s.type!=='port')return r;const wb=wagonBlock(s);if(!wb)return null;const ks=Object.keys(s.im||{}).filter(k=>(s.im[k]||0)>=1&&wb.k.includes(k));return{t:'Needs '+wb.n,w:wb,why:'Landed '+ks.map(gname).join(', ').toLowerCase()+' can\'t leave the dock: trains on '+islName(islOf(s))+' have no '+wb.n.toLowerCase()+'.'}}}
// ===== graphics round 2 preview (window.GFX3, off until Sébastien approves) =====
var GFX3=true;
// trees: round, pine and birch shapes; pines on tiles next to hills or mountains
function treeDraw(tx,ty,x,y,k,se,CAN){const c=ctx,hv=hash(x*3+k,y*5+k,71),hill=[[1,0],[-1,0],[0,1],[0,-1]].some(([a,b])=>terr[id(x+a,y+b)]>=3),kind=hill&&hv<.75||hv<.22?'pine':hv<.36?'birch':'round';
 c.fillStyle='rgba(0,0,0,.25)';c.beginPath();c.ellipse(tx+2,ty+6,kind==='pine'?5:7,2.6,0,0,7);c.fill();
 if(kind==='pine'){const g1=se===3?'#3d5a45':'#2c5530',g2=se===3?'#567a62':'#3f7240';c.fillStyle='#5a3e24';c.fillRect(tx-.8,ty+2,1.6,4);for(let j=0;j<3;j++){const w=6-j*1.6,yy=ty+3-j*3.6;c.fillStyle=j%2?g2:g1;c.beginPath();c.moveTo(tx-w,yy);c.lineTo(tx,yy-5.5);c.lineTo(tx+w,yy);c.closePath();c.fill()}c.fillStyle='rgba(255,255,255,.12)';c.beginPath();c.moveTo(tx-1,ty-8);c.lineTo(tx,ty-10);c.lineTo(tx-3,ty-5);c.fill();if(se===3){c.fillStyle='rgba(245,248,250,.9)';c.beginPath();c.moveTo(tx-2,ty-6);c.lineTo(tx,ty-9.5);c.lineTo(tx+2,ty-6);c.fill()}}
 else if(kind==='birch'){c.fillStyle='#ece6da';c.fillRect(tx-.9,ty-1,1.8,7);c.fillStyle='#3a3a3a';c.fillRect(tx-.9,ty+1,1,.6);c.fillRect(tx,ty+3.5,.9,.6);const col=se===2?'#e0b040':se===3?'#cfd6cc':'#7fae4a';c.fillStyle=col;for(const[dx,dy,r]of[[-2.5,-2,3.2],[2,-3,3],[0,-5,3.2]]){c.beginPath();c.arc(tx+dx,ty+dy,r,0,7);c.fill()}c.fillStyle='rgba(255,255,255,.18)';c.beginPath();c.arc(tx-1.5,ty-5.5,1.4,0,7);c.fill()}
 else{c.fillStyle='#5a3e24';c.fillRect(tx-1,ty+1,2,5);c.fillStyle=se===2&&k===1?'#b8742a':CAN[0];c.beginPath();c.arc(tx,ty,7,0,7);c.fill();c.fillStyle=CAN[1];c.beginPath();c.arc(tx-2,ty-2,4,0,7);c.fill();c.fillStyle='rgba(0,0,0,.12)';c.beginPath();c.arc(tx+2.5,ty+2,4,0,7);c.fill();c.fillStyle='rgba(255,255,255,.16)';c.beginPath();c.arc(tx-3,ty-3,1.6,0,7);c.fill();
  if(cam.z>=.9&&se===0&&hash(x,y,k+3)<.5){c.fillStyle='#ff9ec4';for(let b=0;b<3;b++){c.beginPath();c.arc(tx-4+hash(x,k,b)*8,ty-4+hash(k,y,b)*8,1.3,0,7);c.fill()}}if(se===3){c.fillStyle='rgba(245,248,250,.9)';c.beginPath();c.arc(tx-2,ty-3,3.5,Math.PI,0);c.fill()}}}
// mountains: each square gets its own height and width, one or two peaks, a shaded east face; snow only on the tall ones
function mtnDraw(X,Y,x,y,th,se){const c=ctx,h1=hash(x,y,91),h2=hash(y,x,92),two=h2>.62,pk=[];if(two){pk.push([X+TS*.32,Y+5+h1*6,TS*.32],[X+TS*.7,Y+9+h2*5,TS*.28])}else pk.push([X+TS*(.42+h2*.16),Y+2+h1*8,TS*(.42+h1*.08)]);
 for(const[px,py,hw]of pk){const base=Y+TS-3,tall=py<Y+6;c.fillStyle='#8c8782';c.beginPath();c.moveTo(px-hw,base);c.lineTo(px,py);c.lineTo(px+hw,base);c.closePath();c.fill();
  c.fillStyle='rgba(30,28,35,.28)';c.beginPath();c.moveTo(px,py);c.lineTo(px+hw,base);c.lineTo(px+hw*.15,base);c.closePath();c.fill();
  c.strokeStyle='rgba(255,255,255,.18)';c.lineWidth=.8;c.beginPath();c.moveTo(px,py);c.lineTo(px-hw*.45,py+(base-py)*.55);c.stroke();
  if(th==='iron'){c.fillStyle='rgba(200,110,70,.5)';c.fillRect(px-2,py+(base-py)*.5,3,5)}
  if(tall||se===3){const sh=(base-py)*(tall?.32:.2);c.fillStyle='#f2f4f6';c.beginPath();c.moveTo(px,py);c.lineTo(px-hw*sh/(base-py)*1.05,py+sh);c.lineTo(px-hw*.12,py+sh*.8);c.lineTo(px+hw*.1,py+sh*1.05);c.lineTo(px+hw*sh/(base-py),py+sh);c.closePath();c.fill()}}}
// sea: a little darker the further from any coast
let SEAD=null;function seaDeep(i){if(!SEAD){SEAD=new Float32Array(N*N);const D=new Int16Array(N*N).fill(-1),Q=[];for(let j=0;j<N*N;j++)if(terr[j]){D[j]=0;Q.push(j)}for(let q=0;q<Q.length;q++){const j=Q[q],x=j%N,y=(j/N)|0;for(const[a,b]of[[1,0],[-1,0],[0,1],[0,-1]]){const X=x+a,Y=y+b;if(X<0||Y<0||X>=N||Y>=N)continue;const n=id(X,Y);if(D[n]<0){D[n]=D[j]+1;Q.push(n)}}}for(let j=0;j<N*N;j++)SEAD[j]=D[j]<=2?0:Math.min(.32,(D[j]-2)*.045)}return SEAD[i]}
// industries: props that say what each one does
{const o=drawInd2;drawInd2=function(s,X,Y,T,tm){const r=o.apply(this,arguments);if(!GFX3)return r;const c=ctx,ty=s.type,full=(s.stock||0)>0;
 if(ty==='wood'){// log pile with cut ends, and a stump with an axe
  for(const[dx,dy]of[[16,4],[20,4],[24,4],[18,0.6],[22,0.6],[20,-2.8]]){c.fillStyle='#7a5432';c.beginPath();c.arc(X+dx,Y+dy,2.1,0,7);c.fill();c.fillStyle='#d8b27a';c.beginPath();c.arc(X+dx,Y+dy,1.3,0,7);c.fill();c.strokeStyle='#9a7244';c.lineWidth=.4;c.beginPath();c.arc(X+dx,Y+dy,.7,0,7);c.stroke()}
  c.fillStyle='#6b4a2a';c.fillRect(X-27,Y+6,4,3);c.fillStyle='#c8a070';c.fillRect(X-27,Y+5.4,4,.9);c.strokeStyle='#4a3020';c.lineWidth=.8;c.beginPath();c.moveTo(X-25,Y+5.4);c.lineTo(X-22,Y+1);c.stroke();c.fillStyle='#9aa4ac';c.fillRect(X-23,Y,2,1.6)}
 else if(ty==='coal'||ty==='iron'||ty==='stone'){// a heap of what it digs and a little cart on its rails
  const hc=ty==='coal'?['#2a2826','#3e3a36']:ty==='iron'?['#8a4a34','#a85e40']:['#9a968e','#b8b4aa'];c.fillStyle=hc[0];c.beginPath();c.ellipse(X+20,Y-3.0,7,4,0,Math.PI,0);c.fill();c.fillStyle=hc[1];for(let k=0;k<5;k++){c.beginPath();c.arc(X+15+k*2.4,Y-4.5-Math.sin(k*1.1)*1.6,1.1,0,7);c.fill()}
  c.strokeStyle='#5b4128';c.lineWidth=.7;c.beginPath();c.moveTo(X+9,Y+2.0);c.lineTo(X+27,Y+2.0);c.moveTo(X+9,Y+3.6);c.lineTo(X+27,Y+3.6);c.stroke();const u=full?(Math.sin(tm*.6+s.x)*.5+.5):0,cx=X+12+u*10;c.fillStyle='#4a4a50';c.fillRect(cx,Y-1.4,6,3.6);c.fillStyle=hc[1];c.beginPath();c.ellipse(cx+3,Y-1.2,2.8,1.3,0,Math.PI,0);c.fill();c.fillStyle='#1e1e22';c.beginPath();c.arc(cx+1.3,Y+2.6,.9,0,7);c.arc(cx+4.7,Y+2.6,.9,0,7);c.fill()}
 else if(ty==='oil'){// a nodding pumpjack beside the derrick
  const a=Math.sin(tm*1.6+s.x)*.28*(full||1);c.fillStyle='#3a3540';c.fillRect(X-28,Y-2.0,12,2);c.strokeStyle='#3a3540';c.lineWidth=1.3;c.beginPath();c.moveTo(X-24,Y-2.0);c.lineTo(X-22,Y-9.0);c.lineTo(X-20,Y-2.0);c.stroke();
  c.save();c.translate(X-22,Y-9.0);c.rotate(a);c.fillStyle='#c8a030';c.fillRect(-7,-1,13,2);c.fillStyle='#3a3540';c.beginPath();c.arc(-7,0,2,0,7);c.fill();c.restore();c.strokeStyle='#222';c.lineWidth=.6;c.beginPath();c.moveTo(X-22-7*Math.cos(a),Y-9.0-7*Math.sin(a));c.lineTo(X-29,Y-2.0);c.stroke()}
 else if(ty==='farm'){// hay bales
  for(const[dx,dy]of[[17,6],[22,7.5],[19.5,3.5]]){c.fillStyle='#d9b85a';c.beginPath();c.arc(X+dx,Y+dy,2.4,0,7);c.fill();c.strokeStyle='#a8873a';c.lineWidth=.5;c.beginPath();c.arc(X+dx,Y+dy,1.3,0,7);c.stroke()}}
 else if(ty==='wool'){// a few more sheep grazing out on the hills around the farm
  for(let k=0;k<4;k++){const ang=hash(s.x,s.y,k+50)*6.28+Math.sin(tm*.15+k)*.25,R=TS*(.8+hash(s.y,s.x,k+60)*.5),sx=X+Math.cos(ang)*R,sy=Y+6+Math.sin(ang)*R*.6;c.fillStyle='rgba(0,0,0,.2)';c.beginPath();c.ellipse(sx+.6,sy+1.6,2.8,1.1,0,0,7);c.fill();c.fillStyle='#f4f1ea';c.beginPath();c.ellipse(sx,sy,2.7,1.9,0,0,7);c.fill();c.fillStyle='#3a3430';c.beginPath();c.arc(sx+(Math.cos(ang)>0?2.4:-2.4),sy-.5,.9,0,7);c.fill()}}
 return r}}
// ===== UI4 preview (ChatGPT ideas 1-4, Sébastien said try 2026-11-10): off until he approves =====
var UI4=true;
const RAR=[{g:'⚪',n:'Interesting find',c:'#d8d2c4'},{g:'🔵',n:'Rare find',c:'#6fb4ff'},{g:'🟣',n:'Legendary find',c:'#c58bff'},{g:'🟡',n:'New island',c:'#ffd24a'}];
const POIRAR={ruins:0,ranger:0,mill:0,lookout:1,oldstn:1,light:1,falls:2};
function rarHead(r,sub){const R=RAR[r];return'<div style="text-align:center;margin:-2px 0 6px"><span style="display:inline-block;padding:3px 12px;border-radius:12px;border:1.5px solid '+R.c+';color:'+R.c+';font-weight:800;font-size:12px;letter-spacing:.06em">'+R.g+' '+R.n.toUpperCase()+'</span>'+(sub?'<div style="font-size:11px;opacity:.7;margin-top:3px">'+sub+'</div>':'')+'</div>'}
function rarView(js){return'<div style="text-align:center;margin-top:8px"><button onclick="noticeClose();closePanel();'+js+'" style="padding:8px 14px;border-radius:10px;border:1px solid #7fd36b;background:#2f5a24;color:#eaffdf;font:inherit;font-weight:700">📍 View on map</button></div>'}
let DC=null;
// landmark first seen in the fog: a card instead of only a toast
{const o=discover;discover=function(){const P=S.poi||{},before=POIS.map((p,j)=>P[j]||0);const r=o.apply(this,arguments);
 if(UI4&&S.poiInit&&S.tut>=TUT.length){const nw=POIS.map((p,j)=>j).filter(j=>!before[j]&&(S.poi||{})[j]===1);if(nw.length){const j=nw[0],p=POIS[j],T=POIT[p.t],R=POIRAR[p.t]??1,isl=ISLS[ISLC[id(p.x,p.y)]];
  notice(rarHead(R,'Spotted in the fog')+'<div style="text-align:center"><b style="color:#ffd27a;font-size:18px">'+T.g+' '+T.n+'</b>'+(isl&&isl.nm?'<div style="font-size:12px;opacity:.75">on '+isl.nm+'</div>':'')+'</div><div style="margin-top:6px">'+T.d+'</div><div style="margin-top:6px;font-size:12px;opacity:.8">🎁 Reward when your track reaches it. '+(nw.length>1?'<br>+'+(nw.length-1)+' more landmark'+(nw.length>2?'s':'')+' spotted: see 📖 Atlas.':'')+'</div>'+rarView('atlasGo('+j+')'))}}return r}}
{const o=claimPOI;claimPOI=function(j){DC={j};try{return o.apply(this,arguments)}finally{DC=null}}}
{const o=islFoundCard;islFoundCard=function(k){DC={k};try{return o.apply(this,arguments)}finally{DC=null}}}
function dcDecor(h){if(!UI4||!DC)return h;if(DC.k!=null){const I=ISLS[DC.k],th=typeof islTheme==='function'&&ISLTHEME?ISLTHEME[islTheme(DC.k)]:null;return rarHead(3,(th?th.g+' '+th.n+' · ':'')+'a new place to grow')+h+rarView('islView('+DC.k+')')}
 const p=POIS[DC.j];if(!p)return h;return rarHead(POIRAR[p.t]??1,'Reached by your track')+h+rarView('atlasGo('+DC.j+')')}
function islView(k){let sx=0,sy=0,n=0;for(let i=0;i<N*N;i++)if(ISLC[i]===k&&rev[i]){sx+=i%N;sy+=(i/N)|0;n++}if(!n){const I=ISLS[k];sx=I.x;sy=I.y;n=1}cam.x=(sx/n+.5)*TS;cam.y=(sy/n+.5)*TS;cam.z=Math.min(cam.z,1.1)}
{const o=notice;notice=function(h){return o.call(this,dcDecor(h))}}
{const o=showPOICard;showPOICard=function(T,why,n){const r=o.apply(this,arguments);if(UI4&&DC&&DC.j!=null){const el=document.getElementById('panel'),p=POIS[DC.j];el.innerHTML=rarHead(POIRAR[p.t]??1,'Reached by your track')+el.innerHTML.replace(/<button onclick="closePanel\(\)"/,rarView('atlasGo('+DC.j+')').replace('</div>','')+' <button onclick="closePanel()"')+'</div>'}return r}}
// slimmer HUD: money + income on one line, Railway level with a progress bar; islands/landmarks/% stay in the Atlas
{const o=hudLine;hudLine=function(){try{document.body.classList.toggle('ui4',!!UI4)}catch(e){}if(!UI4)return o();const b=S.beacon,g=RLV[b],a=RLV[b-1]||0,n=S.stats.orders||0;
 if(!g)return'⭐ Railway level <b>'+b+'</b> · top level';const f=Math.max(0,Math.min(1,(n-a)/Math.max(1,g-a))),blk=n>=g&&typeof islOk==='function'&&!islOk(b+1);
 return'⭐ Railway level <b>'+b+'</b> <span style="display:inline-block;vertical-align:middle;width:74px;height:7px;border-radius:4px;background:#3a3226;overflow:hidden;margin:0 4px"><span style="display:block;height:100%;width:'+Math.round(f*100)+'%;background:'+(blk?'#e9a646':'#7fd36b')+'"></span></span><span style="opacity:.75">'+(blk?'⚓ needs a new island':n+'/'+g+' orders')+'</span>'}}
try{const st=document.createElement('style');st.textContent='body.ui4 #disc{display:none}body.ui4 #money{display:inline-block}body.ui4 #inc{display:inline-block;margin-left:8px;opacity:.85}';document.head.appendChild(st)}catch(e){}
// ⭐ Recommended at the top of the Build menu: the build your mission asks for, or the best next one
function recBuild(){const M=S.ms||{},L=[M.main,...(M.side||[])].filter(Boolean);let c=L.find(m=>m.ty==='build');if(!c){try{c=msCands().find(x=>x.ty==='build')}catch(e){}}if(!c)return null;
 const k=c.k,lock=FAC[k]&&FAC[k].lvl>S.beacon||k==='port'&&S.beacon<2;if(lock||!TYPES[k]&&k!=='port')return null;return{k,why:c.why||'',n:k==='port'?'⚓ Dock':TYPES[k].g+' '+TYPES[k].n,ms:L.includes(c)}}
{const o=showBuildMenu;showBuildMenu=function(){const r=o.apply(this,arguments);if(!UI4)return r;try{const R=recBuild();if(!R)return r;const el=document.getElementById('panel'),d=document.createElement('div');
 d.style.cssText='margin:6px 0 8px;padding:8px 10px;border-radius:10px;border:1.5px solid #ffd24a;background:#3a3016';
 d.innerHTML='<div style="font-size:11px;font-weight:800;letter-spacing:.06em;color:#ffd24a">⭐ RECOMMENDED NEXT BUILD'+(R.ms?' · YOUR MISSION':'')+'</div><div style="margin-top:3px"><b style="font-size:15px">'+R.n+'</b></div><small style="opacity:.85">'+R.why+'</small><div style="margin-top:6px"><button onclick="pickBuild(\''+R.k+'\')" style="padding:7px 14px;border-radius:9px;border:0;background:#e9a646;color:#2a1d0c;font:inherit;font-weight:800">Build it</button></div>';
 const t=el.querySelector('b');if(t&&t.parentNode===el)t.insertAdjacentElement('afterend',d);else el.insertBefore(d,el.firstChild)}catch(e){}return r};if(typeof window!=='undefined')window.showBuildMenu=showBuildMenu}
// 🧭 Exploration map view: rumours, spotted landmarks, unreached islands, the fog edge and where to explore next
VIEWS.push({k:'exp',b:'🧭 Exploration',d:'<b>🧭 Exploration</b><br>Rumours, landmarks you have spotted, islands not reached yet, the fog edge, and where to explore next.'});
{const o=drawView;drawView=function(k){if(k!=='exp')return o(k);const sx=x=>(x-cam.x)*cam.z+W/2,sy=y=>(y-cam.y)*cam.z+H/2,s=TS*cam.z,on=(x,y)=>x>-60&&y>-40&&x<W+60&&y<H+40;
 ctx.fillStyle='rgba(12,14,18,.45)';ctx.fillRect(0,0,W,H);ctx.textAlign='center';ctx.textBaseline='middle';
 const pill=(x,y,t,c)=>{ctx.font='700 12px system-ui';const w=ctx.measureText(t).width+14;ctx.fillStyle='#0f1216ee';ctx.beginPath();ctx.roundRect(x-w/2,y-10,w,20,9);ctx.fill();ctx.strokeStyle=c;ctx.lineWidth=1.5;ctx.stroke();ctx.fillStyle=c;ctx.fillText(t,x,y+.5)};
 // fog edge
 const x0=Math.max(1,Math.floor((cam.x-W/2/cam.z)/TS)),x1=Math.min(N-2,Math.ceil((cam.x+W/2/cam.z)/TS)),y0=Math.max(1,Math.floor((cam.y-H/2/cam.z)/TS)),y1=Math.min(N-2,Math.ceil((cam.y+H/2/cam.z)/TS));
 ctx.strokeStyle='rgba(140,210,255,.75)';ctx.lineWidth=2;ctx.beginPath();for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){if(!rev[id(x,y)])continue;const X=sx(x*TS),Y=sy(y*TS);if(!rev[id(x+1,y)]){ctx.moveTo(X+s,Y);ctx.lineTo(X+s,Y+s)}if(!rev[id(x-1,y)]){ctx.moveTo(X,Y);ctx.lineTo(X,Y+s)}if(!rev[id(x,y+1)]){ctx.moveTo(X,Y+s);ctx.lineTo(X+s,Y+s)}if(!rev[id(x,y-1)]){ctx.moveTo(X,Y);ctx.lineTo(X+s,Y)}}ctx.stroke();
 // rumours
 for(const h of (typeof HINTS!=='undefined'?HINTS:[])){const X=sx((h.x+.5)*TS),Y=sy((h.y+.5)*TS);if(on(X,Y))pill(X,Y,'❔ '+(h.type==='poi'?'landmark?':h.type==='plot'?'open land?':'a town?'),'#ffd27a')}
 // spotted landmarks not reached yet
 POIS.forEach((p,j)=>{const st=(S.poi||{})[j];if(st!==1)return;const X=sx((p.x+.5)*TS),Y=sy((p.y+.5)*TS);if(on(X,Y)){const R=RAR[POIRAR[p.t]??1];pill(X,Y-s*.8,POIT[p.t].g+' '+POIT[p.t].n+' · bring track',R.c)}});
 // islands seen but not reached
 for(let k=0;k<ISLS.length;k++){const I=ISLS[k];if(!I||!I.nm||(S.isl||[]).includes(k)||k===homeIsl())continue;if(!(S.islSeen||[]).includes(k))continue;const X=sx((I.x+.5)*TS),Y=sy((I.y+.5)*TS);if(on(X,Y))pill(X,Y,'🏝 '+I.nm+' · not reached','#ffd24a')}
 // where to explore next: nearest rumour to the centre of the screen, or an arrow to it at the edge
 let best=null,bd=1e9;const cx=cam.x/TS,cy=cam.y/TS;for(const h of (typeof HINTS!=='undefined'?HINTS:[])){const d=Math.hypot(h.x-cx,h.y-cy);if(d<bd){bd=d;best=h}}
 if(best){const X=sx((best.x+.5)*TS),Y=sy((best.y+.5)*TS);if(X>30&&Y>120&&X<W-30&&Y<H-110){const p=.6+.4*Math.sin(performance.now()/300);ctx.strokeStyle='rgba(255,210,120,'+p+')';ctx.lineWidth=3;ctx.beginPath();ctx.arc(X,Y,26,0,7);ctx.stroke();pill(X,Y+38,'🧭 Explore here','#7fd36b')}
  else{const a=Math.atan2(Y-H/2,X-W/2),tt=Math.min((W/2-30)/Math.max(.01,Math.abs(Math.cos(a))),(H/2-130)/Math.max(.01,Math.abs(Math.sin(a)))),ex=W/2+Math.cos(a)*tt,ey=H/2+Math.sin(a)*tt;{const c=Math.cos(a),sn=Math.sin(a),P=(u,v)=>[ex+u*c-v*sn,ey+u*sn+v*c];ctx.fillStyle='#7fd36b';ctx.beginPath();ctx.moveTo(...P(18,0));ctx.lineTo(...P(-10,-9));ctx.lineTo(...P(-4,0));ctx.lineTo(...P(-10,9));ctx.closePath();ctx.fill()}pill(Math.max(70,Math.min(W-70,ex-Math.cos(a)*30)),ey-Math.sin(a)*22-(Math.abs(Math.sin(a))<.5?20:0),'🧭 Explore · '+Math.round(bd)+' tiles','#7fd36b')}}}}
// ===== graphics round 3 preview (GFX4): engine shed and docks, off until Sébastien approves =====
var GFX4=true;
// dock: planked pier with a T-head, bollards, a swinging crane, and a small warehouse with a slate roof
function dockDraw(s,X,Y,w){const c=ctx,tm=performance.now()/1000,L=TS*1.05;c.save();c.translate(X,Y);c.rotate(Math.atan2(w[1],w[0]));
 c.fillStyle='rgba(0,0,0,.28)';c.fillRect(2,-6,L,15);c.fillRect(L-8,-13,12,28);
 const deck=(x0,y0,ww,hh)=>{c.fillStyle='#8a6440';c.fillRect(x0,y0,ww,hh);c.fillStyle='rgba(255,230,190,.12)';c.fillRect(x0,y0,ww,1.2);c.fillStyle='rgba(0,0,0,.22)';c.fillRect(x0,y0+hh-1.2,ww,1.2);c.strokeStyle='rgba(60,40,22,.55)';c.lineWidth=.6;for(let k=x0+3;k<x0+ww;k+=3.2){c.beginPath();c.moveTo(k,y0);c.lineTo(k,y0+hh);c.stroke()}};
 deck(0,-7,L,14);deck(L-10,-14,12,28);
 c.fillStyle='#3a2a1a';for(const[x,y]of[[L-9,-13.5],[L-9,12.5],[L+.5,-13.5],[L+.5,12.5],[L*.5,-7.5],[L*.5,6.5]]){c.beginPath();c.arc(x+.5,y+.5,1.6,0,7);c.fill()}
 c.fillStyle='#2a2622';for(const[x,y]of[[L*.3,-5.5],[L*.3,5.5],[L*.75,-5.5],[L*.75,5.5]]){c.beginPath();c.arc(x,y,1.2,0,7);c.fill()}
 c.restore();
 if(typeof portFlair==='function')portFlair(s,X,Y);
 // crane on the pier head
 c.save();c.translate(X,Y);c.rotate(Math.atan2(w[1],w[0]));c.translate(L-4,-8);const sw=Math.sin(tm*.5+s.x)*.9;
 c.fillStyle='#6a4a2a';c.fillRect(-2.5,-2.5,5,5);c.rotate(sw);c.strokeStyle='#c8a030';c.lineWidth=2;c.beginPath();c.moveTo(0,0);c.lineTo(0,15);c.stroke();c.strokeStyle='rgba(30,30,30,.7)';c.lineWidth=.6;c.beginPath();c.moveTo(-1,0);c.lineTo(-1,14);c.stroke();
 c.fillStyle='#a8743c';c.fillRect(-2.5,13,5,4);c.strokeStyle='#5b4128';c.lineWidth=.5;c.strokeRect(-2.5,13,5,4);c.restore();
 // warehouse
 const hx=X-12,hy=Y-8,ww=24,hh=14;c.fillStyle='rgba(0,0,0,.3)';c.fillRect(hx+2,hy+3,ww,hh);
 const g=c.createLinearGradient(hx,0,hx+ww,0);g.addColorStop(0,'#d8c49a');g.addColorStop(1,'#b8a47a');c.fillStyle=g;c.fillRect(hx,hy+5,ww,hh-5);
 c.fillStyle='#4a3a2a';c.fillRect(hx+ww/2-3.5,hy+8,7,hh-8);c.strokeStyle='rgba(255,255,255,.35)';c.lineWidth=.5;c.beginPath();c.moveTo(hx+ww/2,hy+8);c.lineTo(hx+ww/2,hy+hh);c.stroke();
 c.fillStyle='#2a3a48';c.fillRect(hx+3,hy+8,3,3);c.fillRect(hx+ww-6,hy+8,3,3);
 c.fillStyle='#3d5568';c.beginPath();c.moveTo(hx-2,hy+6);c.lineTo(hx+3,hy-2);c.lineTo(hx+ww-3,hy-2);c.lineTo(hx+ww+2,hy+6);c.closePath();c.fill();
 c.fillStyle='#4f6a80';c.beginPath();c.moveTo(hx-2,hy+6);c.lineTo(hx+3,hy-2);c.lineTo(hx+ww-3,hy-2);c.lineTo(hx+ww-3,hy+2);c.lineTo(hx+3,hy+2);c.closePath();c.fill();
 c.strokeStyle='rgba(20,30,40,.35)';c.lineWidth=.5;for(let k=0;k<3;k++){c.beginPath();c.moveTo(hx,hy+.5+k*2);c.lineTo(hx+ww,hy+.5+k*2);c.stroke()}
 c.fillStyle='#e9d8b4';c.fillRect(hx+ww/2-5,hy+5.5,10,2.4);
 // lamp
 c.fillStyle='#2a2622';c.fillRect(X+13,Y-6,1.2,10);c.fillStyle='#ffd27a';c.beginPath();c.arc(X+13.6,Y-6.5,1.8,0,7);c.fill();c.fillStyle='rgba(255,210,120,.18)';c.beginPath();c.arc(X+13.6,Y-6.5,5,0,7);c.fill()}
// engine shed: brick gable walls, slate roof per stall with a glass skylight along each ridge, smoke vents, a water tower and coal stage
{const o=drawShed;drawShed=function(sh,X,Y,on){const r=o.apply(this,arguments);if(!GFX4)return r;const c=ctx,[fx,fy]=shedFace(sh),ang=Math.atan2(fy,fx),n=3,D=12,Wd=n*D,BX0=-24,BX1=4,tm=performance.now()/1000;
 c.save();c.translate(X,Y);c.rotate(ang);
 // brick side walls
 c.fillStyle='#8a4a30';c.fillRect(BX0-1,-Wd/2-3,BX1-BX0+2,3);c.fillRect(BX0-1,Wd/2,BX1-BX0+2,3);c.fillStyle='rgba(0,0,0,.2)';for(let x=BX0;x<BX1;x+=3){c.fillRect(x,-Wd/2-3,.5,3);c.fillRect(x+1.5,Wd/2,.5,3)}
 for(let k=0;k<n;k++){const y0=-Wd/2+k*D,ym=y0+D/2;
  const g1=c.createLinearGradient(0,y0,0,ym);g1.addColorStop(0,'#4a4f58');g1.addColorStop(1,'#5f6670');c.fillStyle=g1;c.fillRect(BX0,y0,BX1-BX0,D/2);
  const g2=c.createLinearGradient(0,ym,0,y0+D);g2.addColorStop(0,'#3e434b');g2.addColorStop(1,'#33373e');c.fillStyle=g2;c.fillRect(BX0,ym,BX1-BX0,D/2);
  c.strokeStyle='rgba(20,22,26,.35)';c.lineWidth=.4;for(let x=BX0+2;x<BX1;x+=2.4){c.beginPath();c.moveTo(x,y0+.5);c.lineTo(x,y0+D-.5);c.stroke()}
  // skylight
  c.fillStyle='#9fc4dc';c.fillRect(BX0+3,ym-1.6,BX1-BX0-6,3.2);c.fillStyle='rgba(255,255,255,.55)';c.fillRect(BX0+5+((tm*4+k*7)%14),ym-1.6,2.5,3.2);c.strokeStyle='#2a2e34';c.lineWidth=.5;for(let x=BX0+3;x<=BX1-3;x+=4){c.beginPath();c.moveTo(x,ym-1.6);c.lineTo(x,ym+1.6);c.stroke()}
  // smoke vent
  c.fillStyle='#2a2622';c.fillRect(BX0+6,ym-2.4,4,4.8);c.fillStyle='#4a4540';c.fillRect(BX0+6.5,ym-2,3,1)}
 // gable wall at the doors with arched openings
 c.fillStyle='#9a5a3a';c.fillRect(BX1-2,-Wd/2-3,3,Wd+6);for(let k=0;k<n;k++){const yy=-Wd/2+D/2+k*D;c.fillStyle='#1a1512';c.beginPath();c.ellipse(BX1-.5,yy,1.6,4.6,0,0,7);c.fill()}
 c.fillStyle='#e9d8b4';c.fillRect(BX1-2,-Wd/2-3,3,1);c.fillRect(BX1-2,Wd/2+2,3,1);
 // water tower and coal stage beside the shed
 {const tx=BX0+7,ty=-Wd/2-8;c.fillStyle='rgba(0,0,0,.3)';c.beginPath();c.arc(tx+1.5,ty+1.5,4.5,0,7);c.fill();c.fillStyle='#4a6a7a';c.beginPath();c.arc(tx,ty,4.2,0,7);c.fill();c.fillStyle='#6a8a9a';c.beginPath();c.arc(tx-1,ty-1,2.4,0,7);c.fill();c.strokeStyle='#2a3a44';c.lineWidth=.6;c.beginPath();c.arc(tx,ty,4.2,0,7);c.stroke();c.strokeStyle='#5b4128';c.lineWidth=1;c.beginPath();c.moveTo(tx+3,ty);c.lineTo(tx+8,ty+3);c.stroke()}
 {const tx=BX0+8,ty=Wd/2+7;c.fillStyle='#5b4128';c.fillRect(tx-6,ty-3,12,6);c.fillStyle='#2a2826';c.beginPath();c.ellipse(tx,ty-.5,5,2.6,0,0,7);c.fill();c.fillStyle='#3e3a36';for(let k=0;k<4;k++){c.beginPath();c.arc(tx-3+k*2,ty-1+(k%2),.9,0,7);c.fill()}}
 if(on){c.strokeStyle='#ffd27a';c.lineWidth=2.5;c.strokeRect(BX0-2,-Wd/2-4,BX1-BX0+4,Wd+8)}
 c.restore();return r}}
// ================= v266 (Sébastien OK'd the whole design review, 2026-11-10) =================
// UI5 = style kit for cards/buttons, new bottom bar, wooden town name boards, far-zoom fog tones, new Orders board.
// Set UI5=false to see the old look (logic below that is not visual stays on).
var UI5=true;if(typeof window!=='undefined')window.UI5=UI5;
const SERIF='"Iowan Old Style","Palatino Linotype",Palatino,"Book Antiqua",Georgia,"Noto Serif",serif';

// ---- A3: one thing at a time. Toasts wait while a story card, lesson or notice is open, then play in order.
{const o=toast;const TQ=[];const busy=()=>{try{const n=document.getElementById('notice'),l=document.getElementById('lesson');return!!(l||n&&n.style.display==='block')}catch(e){return false}};
 toast=function(t){if(typeof window==='undefined'||typeof document==='undefined'||!document.getElementById)return o(t);if(busy()){if(!TQ.includes(t)&&TQ.length<4)TQ.push(t);return}return o(t)};
 if(typeof window!=='undefined'&&window.setInterval)setInterval(()=>{try{if(!TQ.length||busy())return;o(TQ.shift())}catch(e){}},2600)}

// ---- B1/B2/C: style kit (CSS + a tiny classifier that tags every card button with its kind)
if(typeof window!=='undefined'&&typeof document!=='undefined'&&document.head&&document.body&&document.createElement){try{
 const P='#panel,#jobs,#notice,#lesson,#obj';const sc=s=>P.split(',').map(p=>'.ui5 '+p+' '+s).join(',');
 const css=`
:root{--rh-serif:${SERIF}}
.ui5 #panel,.ui5 #jobs{background:linear-gradient(180deg,#30291ff2,#231d16f4)!important;border:1.5px solid #7a6443!important;border-top:3px solid #c98f3e!important;border-radius:14px!important;box-shadow:0 10px 30px rgba(0,0,0,.55),inset 0 1px 0 rgba(255,230,180,.07)!important;font-size:13.5px!important}
.ui5 #notice,.ui5 #lesson>div{border-radius:16px!important;box-shadow:0 12px 40px rgba(0,0,0,.6),inset 0 1px 0 rgba(255,230,180,.08)!important}
.ui5 #panel>b:first-child,.ui5 #jobs>b:first-child,${sc('b[style*="font-size:2"]')},${sc('b[style*="font-size:17px"]')},${sc('b[style*="font-size:16px"]')},.ui5 #panel div[style*="font-size:16px;font-weight:700"]{font-family:var(--rh-serif);letter-spacing:.2px}
${sc('button[data-k]')}{border-radius:10px!important;min-height:36px;transition:transform .08s,filter .08s}
${sc('button[data-k]:active')}{transform:translateY(1px);filter:brightness(1.12)}
${sc('button[data-k=main]')}{background:linear-gradient(#f2b65a,#d9922f)!important;color:#2a1c08!important;border:0!important;box-shadow:0 2px 0 #8a5a1c,inset 0 1px 0 rgba(255,255,255,.35)!important;font-weight:800!important}
${sc('button[data-k=train]')}{background:linear-gradient(#35a088,#267463)!important;color:#fff!important;border:0!important;box-shadow:0 2px 0 #174a3f,inset 0 1px 0 rgba(255,255,255,.22)!important;font-weight:700!important}
${sc('button[data-k=gold]')}{background:linear-gradient(#3d3224,#32291d)!important;border:1.5px solid #c98f3e!important;color:#ffd27a!important;font-weight:700!important;box-shadow:0 2px 0 rgba(0,0,0,.35)!important}
${sc('button[data-k=danger]')}{background:#3a2220!important;border:1.5px solid #a0503c!important;color:#ffb3a0!important}
${sc('button[data-k=quiet]')}{box-shadow:0 2px 0 rgba(0,0,0,.35),inset 0 1px 0 rgba(255,230,180,.06)}
${sc('button[data-k=tile]')}{border-radius:14px!important;box-shadow:inset 0 1px 0 rgba(255,230,180,.08),0 2px 0 rgba(0,0,0,.4)}
${sc('button[data-k=x]')}{min-width:42px!important;min-height:40px!important;border-radius:12px!important;font-size:17px!important}
${sc('button[data-k][disabled]')}{filter:grayscale(.7);opacity:.45!important}
${sc('small')}{font-size:12.5px}
${sc('[style*="font-size:10px"]')},${sc('[style*="font-size:10.5px"]')},${sc('[style*="font-size:11px"]')},${sc('[style*="font-size:11.5px"]')},${sc('[style*="font-size:12px"]')}{font-size:12.5px!important}
${sc('[style*="opacity:.55"]')},${sc('[style*="opacity:.6"]')},${sc('[style*="opacity:.65"]')},${sc('[style*="opacity:.7"]')},${sc('[style*="opacity:.75"]')}{opacity:.86!important}
.ui5 #pbar{flex-direction:row-reverse!important;align-items:flex-start}.ui5 #pbar button{min-width:40px;min-height:38px;border-radius:11px!important;font-size:16px!important}.ui5 #panel div[style*="border:1.5px solid"],.ui5 #panel div[style*="border:2px solid"]{display:flow-root}
.ui5 #obj{border-radius:10px!important;box-shadow:0 4px 14px rgba(0,0,0,.45)}
.ui5 #obj span[data-skip]{display:inline-block;padding:8px 6px;margin:-4px 0 -6px -6px;font-size:12.5px!important;opacity:.85!important}
.ui5 #tools{background:linear-gradient(#15130f00,#15130ff2 38%)!important;gap:6px!important}
.ui5 #tools button{background:linear-gradient(#30281d,#231d16)!important;border:1.5px solid #5e4e36!important;color:#e8d9b8!important;font-size:12.5px!important;font-weight:700;letter-spacing:.3px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;min-height:56px!important;padding:6px 1px 8px!important;position:relative;box-shadow:inset 0 1px 0 rgba(255,230,180,.07),0 3px 8px rgba(0,0,0,.4)}
.ui5 #tools button svg{width:24px;height:24px;stroke:currentColor;fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.ui5 #tools button.on{background:linear-gradient(#4d3d24,#33291b)!important;border-color:#e9a646!important;color:#ffd27a!important}
.ui5 #tools button.on::after{content:'';position:absolute;left:24%;right:24%;bottom:4px;height:3px;border-radius:2px;background:#e9a646;box-shadow:0 0 6px #e9a646aa}
.ui5 .ordrow{padding:6px 10px;margin:5px 0;border-radius:11px;background:#2a221a;border:1px solid #4e4130;cursor:pointer}
.ui5 .ordrow:active{filter:brightness(1.15)}
.ui5 .ordrow .on{font-family:var(--rh-serif);font-size:15px;font-weight:700;color:#fff3d6}
.ui5 .ordchip{display:inline-flex;align-items:center;gap:3px;margin:2px 0 2px 4px;padding:2px 8px;border-radius:13px;background:#3a2f22;border:1px solid #8a6d3e;font-size:13px;font-weight:700}
.ui5 .ordchip.no{border-color:#c0573e;background:#3a2420}
`;
 const st=document.createElement('style');st.id='ui5css';st.textContent=css;document.head.appendChild(st);
 const kind=b=>{const s=(b.getAttribute('style')||'').replace(/\s/g,'').toLowerCase(),t=(b.textContent||'').trim();
  if(/^[✕×✖]$/.test(t)||t==='X')return'x';if(/min-height:5\dpx/.test(s))return'tile';
  if(/background:#(2e7d6b|2f8f83|267463|2a8a76)/.test(s))return'train';
  if(/background:#(e9a646|2f5a24|e08a2c|3f7a2a|4a8a3a)/.test(s))return'main';
  if(/background:#3a2220|#8a4a36/.test(s))return'danger';
  if(/border:1(\.5)?pxsolid#e9a646/.test(s))return'gold';
  return'quiet'};
 const run=()=>{if(!window.UI5)return;for(const b of document.querySelectorAll('#panel button:not([data-k]),#jobs button:not([data-k]),#notice button:not([data-k]),#lesson button:not([data-k]),#obj button:not([data-k])'))b.dataset.k=kind(b)};
 let pend=0;new MutationObserver(()=>{if(pend)return;pend=1;/* v267b: style new buttons before the next paint (a frame later made re-drawn cards pulse every second) */queueMicrotask(()=>{pend=0;try{run()}catch(e){}})}).observe(document.body,{childList:true,subtree:true});
 // bottom bar: drawn icons instead of tiny emoji
 const IC={build:'<svg viewBox="0 0 24 24"><path d="M4 20l8-8"/><path d="M10.5 6.5l3-3 7 7-3 3z"/><path d="M12.5 8.5l3 3"/><path d="M3 21h6"/></svg>',
  scout:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M15.6 8.4l-2.1 5.1-5.1 2.1 2.1-5.1z"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2"/></svg>',
  trains:'<svg viewBox="0 0 24 24"><path d="M3 16.5V10h9V6.5h5V10h2.5l1.5 6.5z"/><path d="M5.5 10V7h3"/><circle cx="7" cy="17.5" r="2"/><circle cx="16.5" cy="17.5" r="2"/><path d="M14 6.5V4"/></svg>',
  tech:'<svg viewBox="0 0 24 24"><path d="M14.7 6.3a4 4 0 0 0-5.3 5.3L3.5 17.5a1.8 1.8 0 0 0 2.5 2.5l5.9-5.9a4 4 0 0 0 5.3-5.3l-2.6 2.6-2.4-.6-.6-2.4z"/></svg>'};
 const LB={build:'Build',scout:'Scout',trains:'Trains',tech:'Tech'};window.UI5IC=IC;
 const bar=()=>{for(const b of document.querySelectorAll('#tools button[data-m]')){const m=b.dataset.m;if(!IC[m]||b.dataset.ui5)continue;b.dataset.ui5=1;b.innerHTML=IC[m]+'<span>'+LB[m]+'</span>'}};
 const on=()=>{document.body.classList.toggle('ui5',!!window.UI5);if(window.UI5){bar();run()}};on();
}catch(e){console.error('ui5',e)}}

// ---- B4: town names on small wooden boards with a paper tag for the size (miniature signage)
function townBoard(s,X,Y){const c=ctx;c.save();c.textAlign='center';c.textBaseline='middle';
 const nmT=(s.beacon?'★ ':'')+s.name,st=tier(s.pop)+(s.pop>0&&cam.z>=1.15?' · '+Math.floor(s.pop).toLocaleString():'');
 c.font='700 11.5px '+SERIF;const tw=Math.max(40,c.measureText(nmT).width+18),h=15,x0=X-tw/2,y0=Y-46;
 const rr=(x,y,w,hh,r)=>{c.beginPath();if(c.roundRect)c.roundRect(x,y,w,hh,r);else c.rect(x,y,w,hh)};
 // paper tag for the size, hanging under the board
 c.font='600 8.5px system-ui';const sw=c.measureText(st).width+10,ty=y0+h+4;
 c.strokeStyle='rgba(60,40,20,.8)';c.lineWidth=.8;c.beginPath();c.moveTo(X-sw/2+4,y0+h-1);c.lineTo(X-sw/2+4,ty);c.moveTo(X+sw/2-4,y0+h-1);c.lineTo(X+sw/2-4,ty);c.stroke();
 c.fillStyle='rgba(0,0,0,.3)';rr(X-sw/2+1,ty+1.5,sw,11,2);c.fill();c.fillStyle='#efe2c0';rr(X-sw/2,ty,sw,11,2);c.fill();c.fillStyle='#4a3520';c.fillText(st,X,ty+5.8);
 // the board
 c.fillStyle='rgba(0,0,0,.38)';rr(x0+1.5,y0+2.5,tw,h,3);c.fill();
 const tc=typeof townCol==='function'?townCol(s):null,g=c.createLinearGradient(0,y0,0,y0+h);g.addColorStop(0,tc?shadeC(tc,.62):s.beacon?'#9a6a35':'#8a5f36');g.addColorStop(1,tc?shadeC(tc,.38):s.beacon?'#6e4520':'#62401f');c.fillStyle=g;rr(x0,y0,tw,h,3);c.fill();
 c.strokeStyle=tc?tc:s.beacon?'#e9a646':'#3e2a17';c.lineWidth=s.beacon?1.2:1;rr(x0,y0,tw,h,3);c.stroke();
 c.strokeStyle='rgba(0,0,0,.14)';c.lineWidth=.6;c.beginPath();c.moveTo(x0+3,y0+5);c.lineTo(x0+tw-3,y0+5.5);c.moveTo(x0+3,y0+10.5);c.lineTo(x0+tw-3,y0+10);c.stroke();
 c.fillStyle='#d9c08a';for(const nx of[x0+3.5,x0+tw-3.5]){c.beginPath();c.arc(nx,y0+h/2,1,0,7);c.fill()}
 c.font='700 11.5px '+SERIF;c.fillStyle='rgba(0,0,0,.55)';c.fillText(nmT,X+.6,y0+h/2+1.3);c.fillStyle='#fff3d6';c.fillText(nmT,X,y0+h/2+.5);
 c.restore();c.textAlign='center';c.textBaseline='middle'}

// ---- E1: Town projects. Big optional buys that add a building to a town's streets and a small perk.
const TPJ=[{k:'clock',ic:'🕰',n:'Clock Tower',c:15000,minT:2,pay:.10,d:'Deliveries to this town pay 10% more.'},
 {k:'market',ic:'🛒',n:'Market Hall',c:30000,minT:3,pay:.15,d:'Deliveries to this town pay 15% more.'},
 {k:'tram',ic:'🚋',n:'Tram Line',c:50000,minT:3,ord:.05,d:'Its orders are 5% smaller.'},
 {k:'theatre',ic:'🎭',n:'Grand Theatre',c:80000,minT:4,pay:.20,d:'Deliveries to this town pay 20% more.'}];
const TIER5=['Hamlet','Village','Town','City','Metropolis','Megacity'];
const tierI=s=>Math.max(0,TIER5.indexOf(tier(s.pop||0)));
function projOf(i){return(S.parks||[]).filter(p=>p.t===i&&p.pj)}
function projHas(i,k){return(S.parks||[]).some(p=>p.t===i&&p.pj===k)}
function buyProj(i,k){const s=sites[i],P=TPJ.find(q=>q.k===k);if(!s||!P||projHas(i,k))return;if(tierI(s)<P.minT){toast(nm(s)+' must be a '+TIER5[P.minT]+' first');return}
 if(S.money<P.c){toast('Costs '+fmt(P.c));return}const b=parkBlock(s);if(!b){toast('No room among the houses of '+nm(s)+' for a '+P.n);return}
 S.money-=P.c;S.parks=S.parks||[];const[x,y]=parkTile(s,b);S.parks.push({t:i,x,y,gx:b[0],gy:b[1],pj:k});try{AUTO.k=''}catch(e){}
 if(S.led)S.led.projects=(S.led.projects||0)+P.c;toast(P.ic+' '+P.n+' opened in '+nm(s)+': '+P.d.toLowerCase());save();refreshPanel()}
if(typeof window!=='undefined'){window.buyProj=buyProj}
function projNode(i){const s=sites[i],d=document.createElement('div');let h='<small style="opacity:.9">Big town projects. Each one adds a building to '+nm(s)+'\'s streets and gives a small lasting bonus.</small>';
 for(const P of TPJ){const has=projHas(i,P.k),lock=tierI(s)<P.minT;
  h+='<div style="margin-top:7px;padding:7px 9px;border-radius:10px;background:#2a221a;border:1px solid '+(has?'#5f9a4c':'#4e4130')+';display:flex;gap:9px;align-items:center"><div style="font-size:24px">'+P.ic+'</div><div style="flex:1;min-width:0"><b>'+P.n+'</b><br><small>'+P.d+'</small></div><div style="text-align:right">'
   +(has?'<b style="color:#7fd36b">✓ Built</b>':lock?'<small style="opacity:.9">🔒 at '+TIER5[P.minT]+'</small>':'<button '+(S.money<P.c?'disabled ':'')+'onclick="buyProj('+i+',\''+P.k+'\')" style="padding:7px 12px;border-radius:10px;border:0;background:#e9a646;color:#2a1c08;font-weight:800;font-size:13px'+(S.money<P.c?';opacity:.4':'')+'">'+fmt(P.c)+'</button>')+'</div></div>'}
 d.innerHTML=h;return d}
// perks: deliveries pay more, tram makes orders smaller
{const o=price;price=function(k,dst){const r=o.apply(this,arguments);try{if(dst&&dst.type==='town'&&S.parks&&typeof r==='number'){const i=sites.indexOf(dst);let m=0;for(const p of S.parks)if(p.t===i&&p.pj){const P=TPJ.find(q=>q.k===p.pj);if(P&&P.pay)m+=P.pay}if(m)return r*(1+m)}}catch(e){}return r}}
{const o=fishOrd;fishOrd=function(t){const r=o.apply(this,arguments);try{if(r&&S.parks){const i=sites.indexOf(t);if(projHas(i,'tram')){const q={};for(const k in r)q[k]=Math.max(1,Math.ceil(r[k]*.95));return q}}}catch(e){}return r}}
// drawn in the town's street grid like parks, before houses and labels
function projDraw(p,s){const c=ctx,tm=performance.now()/1000,X=s.x*TS+TS/2,Y=s.y*TS+TS/2,x0=X+p.gx*PG-8,x1=X+(p.gx+1)*PG+8,y0=Y+p.gy*PGY-4-13,y1=Y+(p.gy+1)*PGY-4+9,w=x1-x0,h=y1-y0,mx=(x0+x1)/2,my=(y0+y1)/2;
 c.save();c.fillStyle='rgba(0,0,0,.22)';c.fillRect(x0+1.5,y0+2,w,h);c.fillStyle='#bfb08a';c.fillRect(x0,y0,w,h);// paved square
 c.strokeStyle='rgba(90,70,40,.25)';c.lineWidth=.5;for(let q=4;q<w;q+=5){c.beginPath();c.moveTo(x0+q,y0);c.lineTo(x0+q,y1);c.stroke()}for(let q=4;q<h;q+=5){c.beginPath();c.moveTo(x0,y0+q);c.lineTo(x1,y0+q);c.stroke()}
 c.strokeStyle='#8f7f5c';c.lineWidth=1;c.strokeRect(x0,y0,w,h);
 const sh=(x,y,ww,hh)=>{c.fillStyle='rgba(0,0,0,.28)';c.fillRect(x+2,y+2.5,ww,hh)};
 if(p.pj==='clock'){const bw=11,bh=30,bx=mx-bw/2,by=my-bh/2+3;sh(bx,by,bw,bh);c.fillStyle='#c9b48a';c.fillRect(bx,by,bw,bh);c.fillStyle='#a8916a';c.fillRect(bx+bw*.62,by,bw*.38,bh);
  c.fillStyle='#6a3b2a';c.beginPath();c.moveTo(bx-1.5,by);c.lineTo(mx,by-11);c.lineTo(bx+bw+1.5,by);c.fill();
  c.fillStyle='#f6efdc';c.beginPath();c.arc(mx,by+7,3.6,0,7);c.fill();c.strokeStyle='#3a2a1a';c.lineWidth=.7;c.stroke();
  const a=tm*.5,b2=tm*.04;c.beginPath();c.moveTo(mx,by+7);c.lineTo(mx+Math.sin(a)*2.8,by+7-Math.cos(a)*2.8);c.moveTo(mx,by+7);c.lineTo(mx+Math.sin(b2)*1.9,by+7-Math.cos(b2)*1.9);c.stroke();
  c.fillStyle='#4a3520';c.fillRect(mx-1.6,by+bh-6,3.2,6);for(const k of[0,1])c.fillRect(bx+2+k*5,by+15,2,4)}
 else if(p.pj==='market'){const bw=w-6,bh=17,bx=x0+3,by=my-bh/2+2;sh(bx,by,bw,bh);c.fillStyle='#d8c9a4';c.fillRect(bx,by,bw,bh);
  for(let q=0;q<bw;q+=4){c.fillStyle=(q/4)%2?'#f3ead2':'#b8452e';c.fillRect(bx+q,by-5,Math.min(4,bw-q),6)}c.fillStyle='#7a3020';c.fillRect(bx,by+1,bw,1);
  c.fillStyle='#5a3c22';for(let q=bx+3;q<bx+bw-2;q+=6)c.fillRect(q,by+6,3,8);
  const cr=['#c98f3e','#7fa24a','#c0573e'];for(let k=0;k<3;k++){c.fillStyle=cr[k];c.fillRect(bx+2+k*7,by+bh+2,5,4)}}
 else if(p.pj==='tram'){c.strokeStyle='#6a6458';c.lineWidth=.9;for(const dy of[-2,2]){c.beginPath();c.moveTo(x0,my+dy+5);c.lineTo(x1,my+dy+5);c.stroke()}
  const u=(Math.sin(tm*.6)+1)/2,tx=x0+3+u*(w-21);sh(tx,my-1,18,9);c.fillStyle='#b8452e';c.fillRect(tx,my-1,18,9);c.fillStyle='#f3ead2';c.fillRect(tx,my-1,18,2.5);c.fillStyle='#bfe2f2';for(let k=0;k<3;k++)c.fillRect(tx+2+k*5.5,my+2.5,3.5,2.5);
  c.strokeStyle='#3a2a1a';c.lineWidth=.6;c.beginPath();c.moveTo(tx+9,my-1);c.lineTo(tx+11,my-6);c.stroke();
  c.fillStyle='#4e6b4a';c.fillRect(mx-6,y0+3,12,2);c.fillStyle='#5a3c22';c.fillRect(mx-5,y0+5,1.2,6);c.fillRect(mx+4,y0+5,1.2,6)}
 else if(p.pj==='theatre'){const bw=w-6,bh=20,bx=x0+3,by=my-bh/2+5;sh(bx,by,bw,bh);c.fillStyle='#ece2c8';c.fillRect(bx,by,bw,bh);c.fillStyle='#cbbf9f';c.fillRect(bx,by,bw,3);
  c.fillStyle='#5f8494';c.beginPath();c.arc(mx,by,8,Math.PI,0);c.fill();c.fillStyle='#e9a646';c.fillRect(mx-.6,by-12,1.2,4);
  c.fillStyle='#fffaf0';for(let q=bx+2;q<bx+bw-1;q+=4.5)c.fillRect(q,by+4,1.8,bh-5);c.fillStyle='#7a2a2a';c.fillRect(mx-3,by+bh-7,6,7);
  const fl=Math.sin(tm*3)*1.2;c.fillStyle='#c0392b';c.beginPath();c.moveTo(bx+1,by-6);c.lineTo(bx+6,by-5+fl);c.lineTo(bx+1,by-3);c.fill();c.fillStyle='#3a2a1a';c.fillRect(bx,by-7,.8,8)}
 c.restore()}
{const o=townFlair;townFlair=function(s0){try{for(const p of S.parks||[])if(p.pj&&p.gx!=null&&sites[p.t]===s0)projDraw(p,s0)}catch(e){}return o.apply(this,arguments)}}

// ---- E2: a hammer badge on town order icons when nothing on the railway makes that good yet (tap the icon: it says what to build)
let OG_T=-9,OG={};const ogGet=()=>{if(S.t-OG_T>2||S.t<OG_T){OG_T=S.t;try{OG=ordGaps()}catch(e){OG={}}}return OG};
{const o=draw;draw=function(){o.apply(this,arguments);try{if(typeof document==='undefined')return;const G=ogGet(),z=cam.z;const ks=Object.keys(G);if(!ks.length)return;
 for(const k of ks)for(const s of G[k]){if(!(z>=1.15||sel===s))continue;const od=ordOf(s);if(!od)continue;const nd=Object.keys(od).filter(q=>((s.got||{})[q]||0)<od[q]);const j=nd.indexOf(k);if(j<0)continue;
  const X=s.x*TS+TS/2,Y=s.y*TS+TS/2,ix=X-(nd.length-1)*12+j*24+10,iy=Y+34-10,sx=(ix-cam.x)*z+W/2,sy=(iy-cam.y)*z+H/2;if(sx<-20||sy<-20||sx>W+20||sy>H+20)continue;
  const r=Math.max(6,5.2*z);ctx.save();ctx.fillStyle='rgba(0,0,0,.45)';ctx.beginPath();ctx.arc(sx+1,sy+1.5,r+1,0,7);ctx.fill();ctx.fillStyle='#e9a646';ctx.beginPath();ctx.arc(sx,sy,r,0,7);ctx.fill();ctx.strokeStyle='#2a1c08';ctx.lineWidth=1;ctx.stroke();
  ctx.font=Math.round(r*1.3)+'px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('🔨',sx,sy+.5);ctx.restore()}}catch(e){}}}

// ---- B5: Orders board, one clear row per town (name, size → next size, reward, bar, the goods still missing)
function ordGo(i){try{closeJobs()}catch(e){}if(sites[i])showInfo(sites[i])}
if(typeof window!=='undefined')window.ordGo=ordGo;
{const o=renderJobs;renderJobs=function(){const r=o.apply(this,arguments);try{if(!window.UI5||OTAB!=='ord')return r;const j=document.getElementById('jobs');if(!j||j.style.display==='none')return r;
 const g=[...j.children].find(c=>c.tagName==='DIV'&&c.querySelector&&c.querySelector(':scope > .job'));if(!g)return r;const G=ogGet();
 const T=sites.filter(s=>s.type==='town'&&!s.hidden&&rev[id(s.x,s.y)]),L=T.filter(s=>s.linked&&ordOf(s)).sort((a,b)=>(b.beacon?1:0)-(a.beacon?1:0)||ordFrac(b)-ordFrac(a));
 const RW=L.map(s=>LREW[tlvl(s)]),MODE=RW.slice().sort((a,b)=>RW.filter(x=>x===b).length-RW.filter(x=>x===a).length)[0],nMode=RW.filter(x=>x===MODE).length;
 if(L.length>2){let hi=0;L.forEach((s,k)=>{if(ordFrac(s)>ordFrac(L[hi]))hi=k});L.unshift(L.splice(hi,1)[0])}
 let h=nMode>=3?'<div style="margin:2px 0 4px"><small>Each town that grows pays <b style="color:#7fd36b">'+fmt(MODE)+'</b> unless shown</small></div>':'';let first=L.length>2;for(const s of L){const od=ordOf(s),i=sites.indexOf(s),f=ordFrac(s),hero=first;first=false;const rw=LREW[tlvl(s)],showRw=hero||!(nMode>=3&&rw===MODE);
  const ch=Object.keys(od).filter(k=>((s.got||{})[k]||0)<od[k]).map(k=>{const got=Math.min(od[k],Math.floor((s.got||{})[k]||0)),none=!brings(s,k).length,mk=(G[k]||[]).includes(s);return'<span class="ordchip'+(none?' no':'')+'">'+TYPES[k].g+' '+got+'/'+od[k]+(mk?' 🔨':none?' <span style="color:#ff8a6a">●</span>':'')+'</span>'}).join('');
  h+='<div class="ordrow'+(hero?' ordhero':'')+'" data-oi="'+i+'">'+(hero?'<div style="font-size:11px;letter-spacing:1px;color:#ffd27a;font-weight:800">⭐ CLOSEST TO GROWING</div>':'')+'<div style="display:flex;align-items:baseline;gap:6px"><span class="on">'+(s.beacon?'★ ':'')+s.name+'</span><small style="opacity:.85;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+tier(s.pop)+' → '+tier(TLIM[tlvl(s)])+'</small><span style="flex:1"></span>'+(showRw?'<b style="color:#7fd36b">'+fmt(rw)+'</b>':'')+'<span style="opacity:.6">›</span></div>'
   +'<div style="display:flex;align-items:center;gap:8px;margin-top:3px"><div style="flex:1;min-width:50px;height:6px;background:#3a2f22;border-radius:4px;overflow:hidden"><div style="width:'+Math.round(f*100)+'%;height:100%;background:linear-gradient(90deg,#c98f3e,#ffd27a)"></div></div><div style="text-align:right">'+(ch||'<small style="color:#7fd36b">All arrived</small>')+'</div></div></div>'}
 const big=T.filter(s=>s.linked&&!ordOf(s));if(big.length)h+='<div style="margin-top:6px"><small>Largest size: '+big.map(s=>s.name).join(', ')+'</small></div>';
 const un=T.filter(s=>!s.linked);if(un.length)h+='<div style="margin-top:6px"><small>Not linked yet: </small>'+un.map(s=>'<span data-oi="'+sites.indexOf(s)+'" style="text-decoration:underline;margin-right:8px;cursor:pointer">'+s.name+'</span>').join('')+'</div>';
 h+='<div style="margin-top:6px"><small>🔨 nothing on your railway makes it yet · <span style="color:#ff8a6a">●</span> no train brings it yet</small></div>';
 g.style.display='block';g.innerHTML=h}catch(e){console.log('ord5',e)}return r};if(typeof window!=='undefined')window.renderJobs=renderJobs}

// taps on order rows survive the board's 1-second refresh: match pointer down/up position, then look up the row under the finger
if(typeof window!=='undefined'&&typeof document!=='undefined'&&document.addEventListener){let PD=null;
 document.addEventListener('pointerdown',e=>{PD=[e.clientX,e.clientY]},true);
 document.addEventListener('pointerup',e=>{try{if(!PD||Math.hypot(e.clientX-PD[0],e.clientY-PD[1])>10)return;const el=document.elementFromPoint(e.clientX,e.clientY),r=el&&el.closest&&el.closest('#jobs [data-oi]');if(r){ordGo(+r.dataset.oi)}}catch(er){}finally{PD=null}},true)}
// ===== SMOOTH (v267, Sébastien approved 2026-11-10): lighter frames so trains and ships glide. Set SMOOTH=false for the old behaviour =====
var SMOOTH=true;if(typeof window!=='undefined')window.SMOOTH=SMOOTH;
function smoothOn(){return typeof window!=='undefined'?window.SMOOTH!==false:SMOOTH!==false}
{const memoKey=()=>track.size+'/'+laneSet.size+'/'+sites.length+'/'+dblSet.size+'/'+((performance.now()/1000)|0);
 let EK='',EM=new Map();const fE=stnExt;stnExt=function(p,hz,Lt){if(!smoothOn())return fE(p,hz,Lt);const k=memoKey();if(k!==EK){EK=k;EM=new Map()}const q=p.x+','+p.y+','+(hz?1:0)+','+Lt;let v=EM.get(q);if(!v){v=fE(p,hz,Lt);EM.set(q,v)}return v.slice()};
 let AK='',AM=new Map();const fA=stnAt;stnAt=function(x,y){if(!smoothOn())return fA(x,y);const k=memoKey();if(k!==AK){AK=k;AM=new Map()}const q=x*4096+y;if(AM.has(q))return AM.get(q);const v=fA(x,y);AM.set(q,v);return v}}
// SMOOTH: trains pull away gently (about 1 s to full speed) and slow down over the last square before a stop, instead of starting and stopping dead
function easeT(t,dt){if(!smoothOn())return 1;if(t._lt===undefined||S.t-t._lt>dt*1.6+.02)t._ac=0;t._lt=S.t;t._ac=Math.min(1,(t._ac||0)+dt/0.9);const acc=.18+.82*(1-Math.pow(1-t._ac,2)),left=t.path?t.path.length-1-t.pos:9,dec=Math.max(.22,Math.min(1,Math.sqrt(Math.max(0,left)/1.1)));return Math.min(acc,dec)}
// SMOOTH: while a frame is being drawn, find buildings by square from a lookup table built once per frame (siteAt searched every building for every square)
{let IN=false,SM=null;const fS=siteAt;siteAt=function(x,y){if(!IN)return fS(x,y);if(!SM){SM=new Map();for(let i=sites.length-1;i>=0;i--){const s=sites[i];SM.set(s.x*4096+s.y,s)}}return SM.get(x*4096+y)};
 const oD=draw;draw=function(){if(!smoothOn())return oD.apply(this,arguments);IN=true;SM=null;try{return oD.apply(this,arguments)}finally{IN=false;SM=null}}}

// v267c: landmark pictures (lighthouse, ranger hut, old windmill, old mine ruins all used to draw as a waterfall). Drawn at the landmark's square, origin = its centre.
function poiArt(t,done,tm){const c=ctx,fc=(col,f)=>{c.fillStyle=col;c.beginPath();f();c.fill()};
 if(t==='light'){fc('#6b6458',()=>c.ellipse(0,8,13,4,0,0,7));fc(done?'#f2ece0':'#bdb6a8',()=>{c.moveTo(-6,7);c.lineTo(-4,-14);c.lineTo(4,-14);c.lineTo(6,7)});c.fillStyle=done?'#b8402e':'#7d5a50';c.fillRect(-5.4,-1,10.8,3.5);c.fillRect(-4.6,-9,9.2,3);
  c.fillStyle='#3a332b';c.fillRect(-5,-15.5,10,2);fc(done?'#ffe28a':'#9a8f80',()=>c.rect(-3,-21,6,5.5));fc('#b8402e',()=>{c.moveTo(-4.5,-21);c.lineTo(0,-25);c.lineTo(4.5,-21)});return true}
 if(t==='ranger'){fc('#2f5a2c',()=>{c.moveTo(7,4);c.lineTo(12,-12);c.lineTo(17,4)});fc('#3d6e35',()=>{c.moveTo(8,-2);c.lineTo(12,-16);c.lineTo(16,-2)});c.fillStyle=done?'#8a5a32':'#6b5a48';c.fillRect(-11,-4,16,11);
  c.fillStyle=done?'#5a3a22':'#4a4038';for(let k=0;k<3;k++)c.fillRect(-11,-2+k*3.4,16,.8);fc(done?'#4a6b3a':'#4f5a48',()=>{c.moveTo(-13,-4);c.lineTo(-3,-12);c.lineTo(7,-4)});c.fillStyle=done?'#ffd88a':'#2a221a';c.fillRect(-7,0,4,3.5);c.fillStyle='#2a221a';c.fillRect(0,1,3,6);return true}
 if(t==='mill'){c.fillStyle=done?'#e6d6b4':'#a39a88';c.beginPath();c.moveTo(-7,8);c.lineTo(-5,-8);c.lineTo(5,-8);c.lineTo(7,8);c.fill();fc(done?'#8a3b2a':'#5a4a40',()=>{c.moveTo(-6.5,-8);c.lineTo(0,-14);c.lineTo(6.5,-8)});c.fillStyle='#2a221a';c.fillRect(-1.5,2,3,6);
  c.save();c.translate(0,-9);c.rotate(done?tm*.8:.4);c.fillStyle=done?'#f2ece0':'#8f877a';c.strokeStyle='#4a3a2a';c.lineWidth=1;for(let k=0;k<4;k++){c.rotate(Math.PI/2);c.fillRect(1,-1.6,13,3.2);c.strokeRect(1,-1.6,13,3.2)}c.restore();fc('#3a332b',()=>c.arc(0,-9,1.6,0,7));return true}
 if(t==='ruins'){fc('#6f665a',()=>{c.moveTo(-14,8);c.lineTo(-8,-10);c.lineTo(2,-13);c.lineTo(12,-6);c.lineTo(14,8)});fc('#1e1a15',()=>{c.moveTo(-5,8);c.lineTo(-5,-2);c.quadraticCurveTo(0,-7,5,-2);c.lineTo(5,8)});
  c.fillStyle=done?'#9a6a3a':'#6b5a48';c.fillRect(-7,-4,2.5,12);c.fillRect(4.5,-4,2.5,12);c.save();c.translate(0,-4.5);c.rotate(done?0:.18);c.fillRect(-8,-1.5,16,3);c.restore();
  c.fillStyle='#8a8070';c.fillRect(8,4,4,3);c.fillRect(-13,5,3,2.5);if(done){c.fillStyle='#e8c37a';c.fillRect(-2,5,4,2)}return true}
 return false}
{const o=claimPOI;claimPOI=function(){try{if(S&&!S.poiT)S.poiT=POIS.map(p=>p.t)}catch(e){}return o.apply(this,arguments)}}
// v267c (Sébastien: "screen keeps adding and removing buttons"): the once-a-second card refresh may only change WHICH buttons a card shows
// after the new set has held for 5 refreshes in a row; until then the card keeps its current buttons (numbers still update on the next accepted refresh).
{let SIG=null,PEND=null,CNT=0;const sig=el=>[...el.querySelectorAll('button')].map(b=>(b.getAttribute('onclick')||'')+'~'+b.textContent.replace(/[\d$,.·%]+/g,'').replace(/\s+/g,' ').trim()).join('|');
 const o=livePanel;livePanel=function(){const el=document.getElementById('panel');if(!el||!el.querySelector||!smoothOn())return o.apply(this,arguments);
  const before=el.innerHTML,sb=sig(el),st=el.scrollTop,P0=PANEL;const r=o.apply(this,arguments);if(PANEL!==P0||el.style.display!=='block'){SIG=null;return r}
  const sa=sig(el);if(sa===sb){CNT=0;PEND=null;return r}
  if(PEND!==sa){PEND=sa;CNT=1}else CNT++;
  if(CNT<5){el.innerHTML=before;el.scrollTop=st;return r}CNT=0;PEND=null;return r}}
// ---- v268 preview (Sébastien: "make deliveries smarter for long hauls"): sea routes measure themselves, ships batch, the fleet grows by itself ----
var SHIPB=false,SHIPP=false;// SHIPB batching (75% full or 2 min) tested slower than leaving at half full; SHIPP = order goods board first
const shAutoOn=()=>false;// Sébastien 2026-11-11: no automatic purchases (not an idle game)
function shipAge(P,e){const t=P&&P._t0&&P._t0[e];return t==null?0:S.t-t}
function shipGoNow(s,X,xi,best,cap){if(!SHIPB)return best.out>=cap*.5||best.back>=cap*.5||s.w>=20;const E=sites[best.e];
 return best.out>=cap*.75||best.back>=cap*.75||shipAge(X,best.e)>=120&&best.out>=1||shipAge(E,xi)>=120&&best.back>=1||s.w>=120}
// every 5 s: goods arriving and goods shipped per minute for each sea route (smoothed over ~1.5 min)
function shipRates(){const dt=5;for(const P of sites){if(P.type!=='port')continue;const R=P._r=P._r||{},T=P._t0=P._t0||{},ex=P.ex||{},O=P._o||{};
 const ks=new Set([...Object.keys(ex),...Object.keys(O),...Object.keys(R)]);
 for(const e of ks){const w=sumG(ex[e]),o=O[e]||0,r=R[e]=R[e]||{w,i:0,o:0};const inn=Math.max(0,o+w-r.w),a=dt/90;r.i+=(inn*60/dt-r.i)*a;r.o+=(o*60/dt-r.o)*a;r.w=w;
  if(w>=1){if(T[e]==null)T[e]=S.t}else delete T[e];if(w<1&&r.i<.5&&r.o<.5&&!ex[e])delete R[e]}
 P._o={}}}
// a route is behind when goods pile up faster than ships take them, or the oldest crate has waited over 4 min
function routeState(P,e){const r=(P._r||{})[e]||{i:0,o:0},w=sumG((P.ex||{})[e]),cap=shipCap(),age=shipAge(P,e);
 if(w<1)return{k:'ok',w,r,age};const left=r.o>r.i+.5?w/(r.o-r.i):null;
 if(!S.ships.length)return{k:'bad',w,r,age,t:'no ship yet'};
 if(typeof dockFull==='function'&&dockFull(P))return{k:'bad',w,r,age,t:'dock is full, so trains can\'t drop goods here'};
 if(w>cap*1.5&&(r.i>r.o*1.05||age>240))return{k:'bad',w,r,age,t:'piling up: '+Math.round(r.i)+'/min arrive, '+Math.round(r.o)+'/min sail'};
 if(w>cap*1.5)return{k:'slow',w,r,age,t:left?'clears in about '+Math.max(1,Math.round(left))+' min':'big backlog'};
 return{k:'ok',w,r,age}}
function routesBehind(){let n=0,w=0;for(const P of ports()){if(!P.linked)continue;for(const e in P.ex||{}){const st=routeState(P,e);if(st.k==='bad'){n++;w+=st.w}}}return{n,w}}
// how many more ships would carry what arrives (+ clear the backlog in ~10 min)
function shipsNeeded(){let I=0,O=0,W=0;for(const P of ports()){if(!P.linked)continue;for(const e in P._r||{}){I+=P._r[e].i;O+=P._r[e].o}}W=dockBacklog();const n=S.ships.length;if(!n)return 1;const per=Math.max(5,O/n),want=(I+W/10)/per;return Math.max(0,Math.min(6,Math.ceil(want-n)))}
// the fleet grows by itself: one more ship when routes stay behind for 2 min and money allows (keeps $2,000 in hand)
function shipAutoTick(){if(!shAutoOn()||!S.lanes.some(l=>!l.off&&sites[l.a]&&sites[l.b]&&sites[l.a].linked&&sites[l.b].linked))return;const b=routesBehind();
 if(!b.n||!S.ships.length&&!b.w){S._shBad=0;return}S._shBad=(S._shBad||0)+5;if(S._shBad<120)return;if(S.money<shipCost()+2000)return;if(shipsNeeded()<1){S._shBad=0;return}
 const P=bestShipDock();if(!P)return;const m0=S.money;buyShip(pIdx(P));if(S.money<m0){S._shBad=0;S.stats.shAuto=(S.stats.shAuto||0)+1;toast('🚢 Your shipping line bought a ship ('+fmt(shipCost())+'): goods were piling up at '+nm(P))}}
{const o=tick;let acc=0;tick=function(dt){o(dt);if(typeof awayNow==='function'&&awayNow())return;acc+=dt;if(acc>=5){acc-=5;try{shipRates();shipAutoTick()}catch(e){}}}}
function shAutoT(){S.shAuto=!shAutoOn();toast(shAutoOn()?'🤖 Your shipping line adds ships by itself when goods pile up':'Ships are only bought by you now');save();try{refreshPanel()}catch(e){}}
// dock card: each route says whether ships keep up
{const o=dockWaitBox;dockWaitBox=function(P){let h=o(P);const i=pIdx(P),FULL=dockFull(P);
 // goods as coloured chips, a coloured dot per route
 const chip=(g,n)=>'<span style="display:inline-block;margin:2px 3px 0 0;padding:1px 7px;border-radius:10px;background:'+(CHIPC[g]||'#3b4a5a')+';color:#fff;font-weight:700;font-size:12px">'+TYPES[g].g+' '+Math.floor(n)+'</span>';
 for(const e in P.ex||{}){const E=sites[e];if(!E)continue;const q=P.ex[e],w=sumG(q);if(w<1)continue;const st=routeState(P,e),dot={ok:'#5fd17a',slow:'#ffc23d',bad:'#ff6b4f'}[st.k];
  const re=new RegExp('<div style="margin-top:3px">⛴ To <b>'+nm(E).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'</b>:[^]*?</div>');
  const line='<div style="margin-top:5px;padding:4px 7px;border-radius:8px;background:#26333f;border-left:5px solid '+dot+'">⛴ <b>'+nm(E)+'</b><br>'+Object.keys(q).filter(g=>q[g]>=1).sort((a,b)=>q[b]-q[a]).map(g=>chip(g,q[g])).join('')+'</div>';
  h=h.replace(re,line)}
 if(FULL){const k=h.indexOf('</b>'),n=dockQ(P),cap=dockCap(P),pc=Math.min(100,Math.round(n/cap*100));
  const big=(lbl,fn,dis,bg,fg)=>'<button '+(dis?'disabled':'')+' onclick="'+fn+'" style="margin:5px 5px 0 0;padding:7px 11px;border-radius:10px;border:0;font:inherit;font-weight:800;font-size:13px;background:'+bg+';color:'+fg+';box-shadow:0 2px 0 #0006;'+(dis?'opacity:.55':'')+'">'+lbl+'</button>';
  const L=dockLv(P),uc=L<PORT.n.length?PORT.up[L].m:null,lock=uc!=null&&S.beacon<PORT.lv[L];
  const up=uc==null?'':big('⬆ Bigger dock · '+(lock?'Railway lv '+PORT.lv[L]:fmt(uc)),'upPort('+i+');try{refreshPanel()}catch(e){}',lock||S.money<uc,'linear-gradient(#ffcf5a,#e9a646)','#2a1a05');
  const sh=big('🚢 Ship · '+fmt(shipCost()),'buyShip('+i+')',S.money<shipCost(),'linear-gradient(#4fd1b0,#2e9c80)','#062a22');
  const box='<div style="margin-top:5px;padding:7px 9px;border-radius:10px;background:linear-gradient(#4a2219,#33201a);border:1.5px solid #ff6b4f"><div style="display:flex;align-items:center;gap:7px"><b style="color:#ff8a6b">🔴 Dock full</b><div style="flex:1;height:10px;border-radius:6px;background:#1a1a1a;overflow:hidden"><div style="width:'+pc+'%;height:100%;background:linear-gradient(90deg,#ffc23d,#ff6b4f)"></div></div><b style="color:#ffd27a">📦 '+Math.floor(n)+'/'+cap+'</b></div>'+up+sh+(uc!=null&&!lock&&S.money<uc?'<div style="margin-top:4px;font-size:12px;color:#ffd27a">Bigger dock: need '+fmt(uc-S.money)+' more</div>':'')+'</div>';
  if(k>=0)h=h.slice(0,k+4)+box+h.slice(k+4);h=h.replace(/<button onclick="buyShipAny\(\)"[^>]*>[^<]*<\/button>/,'');h=h.replace(/<div style="margin-top:3px"><small style="opacity:.8">🚢 no ship here right now[^]*?<\/small><\/div>/,'')}
 h=h.replace(/<br><small style="color:#ffb36b">⚠ [^<]*<\/small>/,'');return h}}
var CHIPC={wood:'#8a5a2b',planks:'#b07a3a',stone:'#7d7d86',bricks:'#b4483a',coal:'#3d3d44',iron:'#6a7a8c',steel:'#4f6f8a',farm:'#b8962e',flour:'#c9a96a',oil:'#2f2f3a',fuel:'#c0632a',fish:'#2f86b8',shell:'#d0574f',wool:'#a08fb0',goods:'#7a5ab0'};
{const o=shipsBehind;shipsBehind=function(){const r=o.apply(this,arguments);if(!r||/No cargo ship/.test(r)||/train/.test(r))return r;const n=shipsNeeded();if(!n)return'';return'Ships can\'t keep up: about '+n+' more would help'}}
{const o=shipsTab;shipsTab=function(){let h=o.apply(this,arguments);const on=shAutoOn(),b=routesBehind();
 const box='<div style="margin-top:6px;padding:6px 9px;border-radius:9px;background:#1f2a33;border:1px solid #4f6f8a"><b>🤖 Shipping line</b> <small style="opacity:.85">'+(on?'adds a ship by itself when goods pile up for 2 min (keeps $2,000 in hand)':'off: only you buy ships')+'</small><br>'+tbtn(on?'Turn off':'Turn on','shAutoT()')+(S.stats.shAuto?' <small style="opacity:.75">bought '+S.stats.shAuto+' so far</small>':'')+(b.n?'<br><small style="color:#ff8a6b">🔴 '+b.n+' route'+(b.n>1?'s':'')+' falling behind · '+Math.round(b.w)+' goods waiting</small>':'')+'</div>';
 h=h.replace(/<br><small style="color:#ffb36b">⚠ [^<]*<\/small>/,'');return h}}
if(typeof window!=='undefined')Object.assign(window,{shAutoT});

// trade orders and open town orders on the far island board first; bulk that nobody there waits on goes last
function shPri(d,g){if(!SHIPP)return 0;const E=sites[d];if(!E)return 0;const I=islOf(E),q=S.tro&&S.tro[I];if(q&&!q.done&&q.k===g)return 3;
 for(const T of sites){if(islOf(T)!==I||T.type!=='town'||!T.linked)continue;const o=ordOf(T);if(o&&o[g]&&((T.got||{})[g]||0)<o[g])return 2}return isFac?0:0}

// Sébastien 2026-11-11: a full dock can also be upgraded for more storage; offer it next to the ship button
function dockUpBtn(P){try{if(!dockFull(P))return'';const L=dockLv(P),i=pIdx(P);if(L>=PORT.n.length)return'';const c=PORT.up[L].m,lock=S.beacon<PORT.lv[L];
 return tbtn('⬆ Upgrade dock: holds '+DOCKCAP[L]+' · '+fmt(c),'upPort('+i+');try{refreshPanel()}catch(e){}',lock||S.money<c)}catch(e){return''}}
function dockUpWhy(P){try{const L=dockLv(P);if(L>=PORT.n.length)return'';const c=PORT.up[L].m;return S.beacon<PORT.lv[L]?'Dock upgrade needs Railway level '+PORT.lv[L]:S.money<c?'Dock upgrade: '+fmt(c-S.money)+' more needed':''}catch(e){return''}}
// ---- v268 colour pass (Sébastien: UI got bland; wants colour back, fewer words) ----
if(typeof window!=='undefined'&&typeof document!=='undefined'&&document.head&&document.createElement){try{
 const pal=[['#e9a646','#3d2e18'],['#3fbf9b','#173a31'],['#5aa7e6','#17304a'],['#8fcf4f','#26391a'],['#d987d0','#3a2238'],['#f07a55','#40221a']];
 let css='';pal.forEach(([c,bg],k)=>{css+=`.ui5 #panel button[data-k=tile]:nth-child(6n+${k+1}){background:linear-gradient(160deg,${bg},#221c15 85%)!important;border:1.5px solid ${c}99!important;border-top:3px solid ${c}!important}\n`});
 css+=`.ui5 #panel button[data-k=tile]{font-size:13.5px!important}
.ui5 #tools button .ic6{display:flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:50%;font-size:20px;line-height:1;box-shadow:inset 0 -2px 0 rgba(0,0,0,.25),0 2px 4px rgba(0,0,0,.4)}
.ui5 #tools button[data-m=build] .ic6{background:radial-gradient(circle at 35% 30%,#ffd98a,#e9a646)}
.ui5 #tools button[data-m=scout] .ic6{background:radial-gradient(circle at 35% 30%,#9fe0ff,#3d93d6)}
.ui5 #tools button[data-m=trains] .ic6{background:radial-gradient(circle at 35% 30%,#ff9f87,#d4543b)}
.ui5 #tools button[data-m=tech] .ic6{background:radial-gradient(circle at 35% 30%,#a6ecc9,#2e9c80)}
.ui5 #tools button{min-height:62px!important}`;
 const st=document.createElement('style');st.id='ui6css';st.textContent=css;document.head.appendChild(st);
 const EM={build:'🏗',scout:'🧭',trains:'🚂',tech:'🔧'};
 const bar6=()=>{for(const b of document.querySelectorAll('#tools button[data-m]')){const m=b.dataset.m;if(!EM[m]||b.dataset.ui6)continue;const sp=b.querySelector('span');const lbl=sp?sp.outerHTML:'<span>'+b.textContent+'</span>';b.dataset.ui6=1;b.innerHTML='<span class="ic6">'+EM[m]+'</span>'+lbl}};
try{for(const k in EM)window.UI5IC[k]='<span class="ic6">'+EM[k]+'</span>'}catch(e){}
 setTimeout(bar6,50);setInterval(bar6,1000);
}catch(e){console.error('ui6',e)}}
// v268 colour pass 2: buttons and tabs that start with an emoji take that emoji's colour; order rows get coloured edges; greyed buttons keep some colour
if(typeof window!=='undefined'&&typeof document!=='undefined'&&document.head&&document.createElement){try{
 const EMC={'🪵':'#c08040','🌾':'#e0b830','🐑':'#b9a5e6','⚫':'#9a9aa8','🪨':'#a8a8b4','🧲':'#6fa8e0','🛢':'#4fc0a8','⛽':'#f07a3a','🏭':'#f0644a','⚓':'#4fa8f0','🛤':'#d8904a','🚂':'#f0604a','🚢':'#4fa8f0','📦':'#e8a850','⬆':'#7fd86a','📋':'#f0b040','🚧':'#f07a55','📰':'#a8b8d0','❔':'#b598f0','🪚':'#d8b070','🧱':'#e0604e','⚙':'#8fb0d0','🍞':'#e8c070','🐟':'#4fb8e8','🦞':'#f07060','🧶':'#d898e0','🧵':'#d898e0','🌳':'#6fcf5a','🗺':'#5fc8b0','🏝':'#5fd0a8','🧭':'#4fa8f0','🏛':'#e8c070','👑':'#f0c840','🌉':'#d8904a','🎣':'#4fb8e8','🔭':'#8fb0f0','💡':'#f0d040','🏗':'#f0b040','🔧':'#5fd0a8','🐄':'#d8b070','🔥':'#f07a3a','🌊':'#4fa8f0','🏠':'#e0a060','📍':'#f0604a','⭐':'#f0c840','🤝':'#e8a850','🎯':'#f0604a'};
 const first=t=>{t=(t||'').trim();for(const k in EMC)if(t.startsWith(k))return EMC[k];return null};
 const css=`.ui5 button[data-c]:not([data-k=tile]):not([data-k=main]):not([data-k=train]){background:linear-gradient(160deg,color-mix(in srgb,var(--c) 26%,#2a221a),#231d16 90%)!important;border:1.5px solid color-mix(in srgb,var(--c) 60%,#2a221a)!important;border-top:3px solid var(--c)!important}
.ui5 button[data-c][style*="255, 210, 122"],.ui5 button[data-c][style*="#ffd27a"]{background:linear-gradient(160deg,color-mix(in srgb,var(--c) 50%,#2a221a),#2c241a 90%)!important;box-shadow:0 0 0 2px var(--c),0 2px 6px rgba(0,0,0,.4)!important}
.ui5 .ordrow{border-left:5px solid var(--c,#e9a646)!important;background:linear-gradient(100deg,color-mix(in srgb,var(--c,#e9a646) 16%,#2a221a),#2a221a 70%)!important}
.ui5 #panel button[data-k][disabled],.ui5 #jobs button[data-k][disabled]{filter:grayscale(.25)!important;opacity:.6!important}`;
 const st=document.createElement('style');st.id='ui6css2';st.textContent=css;document.head.appendChild(st);
 const ROWC=['#f0b040','#4fc0a8','#4fa8f0','#7fd86a','#d898e0','#f07a55'];
 const tag=()=>{for(const b of document.querySelectorAll('#panel button:not([data-c]),#jobs button:not([data-c])')){const c=/gradient/.test(b.getAttribute('style')||'')?null:first(b.textContent);b.dataset.c=c?'1':'';if(c)b.style.setProperty('--c',c);else b.removeAttribute('data-c')}
  let k=0;for(const r of document.querySelectorAll('#jobs .ordrow,#panel .ordrow')){if(!r.dataset.c){r.dataset.c=1;const s=r.dataset.oi!=null&&typeof townCol==='function'?townCol(sites[+r.dataset.oi]):null;r.style.setProperty('--c',s||ROWC[k%ROWC.length])}k++}};
 let pend=0;new MutationObserver(()=>{if(pend)return;pend=1;queueMicrotask(()=>{pend=0;try{tag()}catch(e){}})}).observe(document.body,{childList:true,subtree:true});
}catch(e){console.error('ui6b',e)}}

// each town keeps one colour: its map name board and its Orders row match (Sébastien 2026-11-11)
var TOWNC=['#e9a646','#3fbf9b','#4fa8f0','#7fd86a','#d898e0','#f07a55','#e0c040','#5fc8d8'];
function townCol(s){if(!s||s.type!=='town')return null;if(s.beacon||s===sites[hubI()])return TOWNC[0];const T=sites.filter(o=>o.type==='town'&&!(o.beacon||o===sites[hubI()]));const k=T.indexOf(s);return TOWNC[1+(k<0?0:k)%(TOWNC.length-1)]}
function shadeC(h,f){const n=parseInt(h.slice(1),16),r=n>>16,g=n>>8&255,b=n&255;return'rgb('+Math.round(r*f)+','+Math.round(g*f)+','+Math.round(b*f)+')'}
if(typeof document!=='undefined'&&document.querySelectorAll&&typeof setInterval!=='undefined')setInterval(()=>{try{for(const r of document.querySelectorAll('.ordrow[data-oi]')){const s=sites[+r.dataset.oi],tc=townCol(s);if(tc&&r.style.getPropertyValue('--c')!==tc)r.style.setProperty('--c',tc)}}catch(e){}},300);

// v268 readability pass (Sébastien: eyesore, hard to see where to tap): shorter bottom bar, tabs as one slim segmented bar
// (only the open tab is coloured), status lines as slim chips, fewer outlines so the main buttons stand out
if(typeof document!=='undefined'&&document.head&&document.createElement){try{
 const T='button[style*="flex:1 1"]:not([data-k=tile]):not([style*="min-height:5"]),button[style*="flex: 1 1"]:not([data-k=tile]):not([style*="min-height: 5"])';
 const css=`.ui5 #tools button{min-height:44px!important;padding:3px 1px 3px!important;gap:1px!important;font-size:11.5px!important}
.ui5 #tools button .ic6{width:24px!important;height:24px!important;font-size:14px!important}
.ui5 #tools button.on::after{bottom:2px!important}
.ui5 #panel div:has(> :is(${T})),.ui5 #jobs div:has(> :is(${T})){flex-wrap:nowrap!important;gap:2px!important;padding:3px!important;border-radius:12px!important;background:#16120d!important;border:1px solid #3d3326!important}
.ui5 #panel :is(${T}),.ui5 #jobs :is(${T}){flex:1 1 0!important;min-width:0;min-height:34px!important;padding:5px 3px!important;font-size:12px!important;line-height:1.15;white-space:normal;background:transparent!important;border:0!important;box-shadow:none!important;color:#cdbb98!important;border-radius:9px!important}
.ui5 #panel :is(${T})[style*="#ffd27a"],.ui5 #panel :is(${T})[style*="255, 210, 122"],.ui5 #jobs :is(${T})[style*="#ffd27a"],.ui5 #jobs :is(${T})[style*="255, 210, 122"],.ui5 #jobs :is(${T})[style*="#4a3b22"],.ui5 #panel :is(${T})[style*="#4a3b22"]{background:color-mix(in srgb,var(--c,#e9a646) 70%,#2a221a)!important;color:#1d1408!important;font-weight:800!important;box-shadow:0 2px 0 rgba(0,0,0,.35)!important}
.ui5 .bn6{border:0!important}
.ui5 #panel button[data-k=tile]{border-width:1px!important;border-top-width:3px!important}
.ui5 #panel div[style*="flex:1 1 40%;box-sizing:border-box"]{display:flex!important;flex-direction:column}
.ui5 .ordhero{padding:9px 12px!important;border-left-width:7px!important;box-shadow:0 0 0 1.5px var(--c,#e9a646),0 4px 12px rgba(0,0,0,.35)}
.ui5 .ordhero .on{font-size:17px!important}
.ui5 #panel,.ui5 #jobs{padding-bottom:34px!important}
.ui5 #panel div[style*="flex:1 1 40%;box-sizing:border-box"]>div:last-child{margin-top:auto;padding-top:6px}
.ui5 #panel div[style*="flex:1 1 40%;box-sizing:border-box"]>div:last-child>button{width:100%;margin:0!important}`;
 const st=document.createElement('style');st.id='ui6css3';st.textContent=css;document.head.appendChild(st)}catch(e){console.error('ui6c',e)}}
// Tech screen (Muse: nearly empty): show railway level progress and what the next level unlocks
{const o=showTech;showTech=function(){const r=o.apply(this,arguments);try{const el=document.getElementById('panel');if(!el||el.querySelector('#tech6'))return r;const L=S.beacon,need=RLV[L],got=S.stats.orders||0;
 const tiles=el.querySelector('button[data-k=tile],button[style*="min-height:5"]');const host=tiles?tiles.parentElement:null;
 const box='<div id="tech6" style="margin:8px 0 4px;padding:9px 11px;border-radius:12px;background:linear-gradient(160deg,#3a2f18,#231d16 85%);border:1px solid #c98f3e;border-top:3px solid #ffd27a">'
  +'<div style="display:flex;align-items:center;gap:8px"><b style="font-size:15px">⭐ Railway level '+L+'</b><span style="flex:1"></span>'+(need?'<b style="color:#ffd27a">'+got+' / '+need+' orders</b>':'<b style="color:#7fd36b">max</b>')+'</div>'
  +(need?'<div style="height:8px;border-radius:5px;background:#16120d;margin:6px 0 5px;overflow:hidden"><div style="width:'+Math.min(100,Math.round(got/need*100))+'%;height:100%;background:linear-gradient(90deg,#c98f3e,#ffd27a)"></div></div><div style="font-size:12.5px">🔓 <b>Next unlock:</b> '+(RUNL[L]||'')+'</div>':'')+'</div>';
 if(host)host.insertAdjacentHTML('beforebegin',box);else el.insertAdjacentHTML('beforeend',box)}catch(e){console.error('tech6',e)}return r};if(typeof window!=='undefined')window.showTech=showTech}
// v270d (bug hunt): docks with no town within 16 squares were all named "Far Shore Landing" (5 in one game), so sea routes and
// "→ Far Shore Landing" lines were impossible to tell apart. They now take their island's name (a number is added if it repeats).
function farShoreFix(){try{for(const P of sites){if(!P||P.type!=='port'||!/^Far Shore /.test(P.name||''))continue;const kind=/Landing$/.test(P.name)?'Landing':'Docks',base=islName(islOf(P))+' '+kind;let n=base,j=2;while(sites.some(o=>o!==P&&o.type==='port'&&o.name===n))n=base+' '+(j++);P.name=n}}catch(e){}}
{let t=0;const o=tick;tick=function(dt){o.apply(this,arguments);t-=dt;if(t<=0){t=2;farShoreFix()}}}

// v271 (Sébastien: hard to see what sits at docks): every linked dock shows a readable tag at any zoom: 📦 total · top goods with counts; red edge when full
{const o=draw;draw=function(){o.apply(this,arguments);try{if(typeof dockWait!=='function')return;const sel=typeof selSite==='function'?selSite():null;ctx.save();ctx.setTransform(DPR(),0,0,DPR(),0,0);ctx.textBaseline='middle';
 for(const P of ports()){if(!P||P.hidden||!P.linked||P===sel||!rev[id(P.x,P.y)])continue;const q=dockWait(P),tot=Math.floor(sumG(q));if(tot<1)continue;
  const sx=((P.x+.5)*TS-cam.x)*cam.z+W/2,sy=((P.y+.5)*TS-cam.y)*cam.z+H/2+Math.max(16,.55*TS*cam.z);if(sx<-80||sy<-30||sx>W+80||sy>H+30)continue;
  const gs=Object.keys(q).filter(g=>q[g]>=1).sort((a,b)=>q[b]-q[a]),far=cam.z<.55,top=gs.slice(0,far?2:3),full=typeof dockFull==='function'&&dockFull(P);
  const parts=[['📦 '+tot,'#fff']].concat(top.map(g=>[(TYPES[g]?TYPES[g].g:'')+Math.floor(q[g]),'#f3e6c8']));if(gs.length>top.length)parts.push(['+'+(gs.length-top.length),'#cfd8e3']);
  ctx.font='700 11px system-ui';const ws=parts.map(p=>ctx.measureText(p[0]).width),w=ws.reduce((a,b)=>a+b,0)+(parts.length-1)*6+14,x0=sx-w/2;
  ctx.fillStyle=full?'rgba(70,20,16,.92)':'rgba(16,34,52,.9)';ctx.beginPath();ctx.roundRect?ctx.roundRect(x0,sy-9,w,18,9):ctx.rect(x0,sy-9,w,18);ctx.fill();ctx.lineWidth=1.5;ctx.strokeStyle=full?'#ff6b5a':'#6bb8e8';ctx.stroke();
  let x=x0+7;ctx.textAlign='left';parts.forEach((p,k)=>{ctx.fillStyle=p[1];ctx.fillText(p[0],x,sy+.5);x+=ws[k]+6})}
 ctx.restore()}catch(e){}}}

// ===== v272 (Sébastien chose "⭐ Rush a good at a building"): up to 3 rushes. Trains bring that good to that building first,
// from every building linked by track that makes it, until the town's order is done or the chosen amount has arrived.
const RUSHMAX=3;
function rushes(){return(S.rush=S.rush||[]).filter(r=>sites[r.i])}
function rushOf(i,k){return rushes().find(r=>r.i===i&&r.k===k)}
function rushLeft(r){const T=sites[r.i];if(!T)return 0;if(r.ord&&T.type==='town'){const o=ordOf(T)||{};if(!o[r.k])return 0;return Math.max(0,o[r.k]-Math.floor((T.got||{})[r.k]||0))}return Math.max(0,r.n-r.got)}
function rushGoods(T){if(!T||!T.linked||T.hidden)return[];if(isFac(T))return Object.keys(FAC[T.type].in);if(T.type==='town'&&T.pop>0){const o=ordOf(T)||{};return Object.keys(o).filter(k=>((T.got||{})[k]||0)<o[k])}return[]}
function rushAdd(i,k){const T=sites[i];if(!T)return;S.rush=rushes();if(rushOf(i,k))return;if(S.rush.length>=RUSHMAX){toast('⭐ You can rush '+RUSHMAX+' deliveries at once: finish or cancel one first');return}
 const ord=T.type==='town'&&!!(ordOf(T)||{})[k];S.rush.push({i,k,ord,n:ord?0:50,got:0});AUTO.k='';const L=rushLeft(S.rush[S.rush.length-1]);toast('⭐ Rushing '+GOOD[k].toLowerCase()+' to '+nm(T)+(ord?' until its order is done ('+L+' to go)':' · 50 units')+': trains bring it here first');save();refreshPanel();if(typeof renderJobs==='function'&&jobsOpen)renderJobs()}
function rushDel(i,k){S.rush=rushes().filter(r=>!(r.i===i&&r.k===k));AUTO.k='';save();refreshPanel();if(typeof renderJobs==='function'&&jobsOpen)renderJobs()}
function rushAmt(i,k,d){const r=rushOf(i,k);if(!r||r.ord)return;r.n=Math.max(r.got+10,Math.min(500,r.n+d));save();if(typeof renderJobs==='function'&&jobsOpen)renderJobs();refreshPanel()}
if(typeof window!=='undefined'){window.rushAdd=rushAdd;window.rushDel=rushDel;window.rushAmt=rushAmt}
// dispatch: every producer of the good that can reach the rushed building by track sends there (nearest first, enough to cover what is left)
{const o=shipPlan;shipPlan=function(){const m=o.apply(this,arguments);try{const R=rushes().filter(r=>rushLeft(r)>0);const sig=AUTO.k+'|'+R.map(r=>r.i+r.k).join(',');if(m._rs===sig)return m;m._rs=sig;
 for(const[pi,f]of m)if(f.rush){delete f.rush}
 for(const r of R){const T=sites[r.i];if(!T||!accepts(T,r.k)&&T.type!=='town')continue;const b=bfs(id(T.x,T.y)),left=rushLeft(r);const P=[];for(const[pi,f]of m){if(f.k!==r.k||f.why.length||f.pin||f.rush||pi===r.i)continue;const S0=sites[pi],d=b.dist[id(S0.x,S0.y)];if(d>0)P.push({pi,f,d})}
  P.sort((a,b)=>a.d-b.d);let acc=0;for(const q of P){if(acc>=left*1.3+20)break;q.f.to=r.i;q.f.d=q.d;q.f.need=true;q.f.pr=true;q.f.rush=1;acc+=Math.max(10,q.f.sup||0)}r.src=P.length}}catch(e){}return m}}
// count what arrives; finish when done
{const o=deliver;deliver=function(t,here,dist){const k=t.k,load=t.cargo||0;const r0=here&&rushOf(sites.indexOf(here),k);o.apply(this,arguments);try{if(!r0)return;const used=load-(t.cargo||0);if(used>0)r0.got+=used;if(rushLeft(r0)<=0){S.rush=rushes().filter(x=>x!==r0);AUTO.k='';toast('⭐ Rush done: '+nm(here)+' got its '+GOOD[k].toLowerCase());refreshPanel()}}catch(e){}}}
{let tt=0;const o=tick;tick=function(dt){o.apply(this,arguments);tt-=dt;if(tt>0)return;tt=2;try{const R=rushes(),keep=R.filter(r=>rushLeft(r)>0&&sites[r.i].linked);if(keep.length!==R.length){S.rush=keep;AUTO.k=''}}catch(e){}}}
// card buttons (town and factory cards)
function rushBox(T){const i=sites.indexOf(T),G=rushGoods(T);if(!G.length&&!rushes().some(r=>r.i===i))return'';const full=rushes().length>=RUSHMAX;
 let h='<div id="rushbox" style="margin-top:8px;padding:7px 9px;border-radius:10px;background:#2b2412;border:1px solid #8a6a2a"><b style="color:#ffd27a">⭐ Rush a delivery</b> <small style="opacity:.8">trains bring it here first</small><div style="display:flex;flex-wrap:wrap;gap:5px;margin-top:5px">';
 for(const k of G){const r=rushOf(i,k);if(r){const L=rushLeft(r);h+='<span style="display:inline-flex;align-items:center;gap:6px;padding:5px 9px;border-radius:9px;background:#e9a646;color:#2a1d0c;font-weight:800">⭐ '+TYPES[k].g+' '+L+' to go<button onclick="rushDel('+i+',\''+k+'\')" style="border:0;background:#2a1d0c;color:#ffd27a;border-radius:7px;padding:2px 7px;font-weight:800">✕</button></span>'}
  else h+='<button onclick="rushAdd('+i+',\''+k+'\')" '+(full?'disabled':'')+' style="border:1.5px solid #e9a646;background:#3a2e17;color:#ffd27a;border-radius:9px;padding:6px 10px;font:inherit;font-weight:800'+(full?';opacity:.45':'')+'">⭐ '+TYPES[k].g+' '+GOOD[k]+'</button>'}
 h+='</div>'+(full&&G.some(k=>!rushOf(i,k))?'<small style="opacity:.8">'+RUSHMAX+' rushes already running: cancel one on the Orders board</small>':'')+'</div>';return h}
if(typeof window!=='undefined')for(const nm2 of['showInfo','showFactory']){const o=window[nm2];window[nm2]=function(a){const r=o.apply(this,arguments);try{const s=typeof a==='number'?sites[a]:a;const el=document.getElementById('panel');if(!s||!el.insertAdjacentHTML||el.querySelector('#rushbox'))return r;if(!(isFac(s)||s.type==='town'))return r;const h=rushBox(s);if(!h)return r;
 const anchor=el.querySelector('#fullbox')||el.querySelector('#waitbox');const tg=el.querySelector('details')||null;if(tg&&tg.parentNode===el)tg.insertAdjacentHTML('beforebegin',h);else el.insertAdjacentHTML('beforeend',h)}catch(e){}return r}}
// Orders board: rushes on top
{const o=renderJobs;renderJobs=function(){const r=o.apply(this,arguments);try{const j=document.getElementById('jobs');if(!j||j.style.display==='none'||!j.insertAdjacentHTML)return r;const old=j.querySelector('#rushlist');if(old)old.remove();const R=rushes();
 let h='<div id="rushlist" style="margin:6px 0;padding:7px 9px;border-radius:10px;background:#2b2412;border:1px solid #8a6a2a"><b style="color:#ffd27a">⭐ Rushes '+R.length+'/'+RUSHMAX+'</b>';
 if(!R.length)h+='<br><small style="opacity:.8">Open a town or factory and tap ⭐ next to a good: trains bring it there first.</small>';
 for(const x of R){const T=sites[x.i],L=rushLeft(x),tot=x.ord?L+Math.floor((T.got||{})[x.k]||0):x.n,dn=tot-L,pc=Math.round(100*dn/Math.max(1,tot));
  h+='<div style="margin-top:5px;display:flex;align-items:center;gap:6px"><span onclick="closeJobs&&closeJobs();showInfo(sites['+x.i+'])" style="flex:1;cursor:pointer">⭐ '+TYPES[x.k].g+' <b>'+nm(T)+'</b> <small>'+dn+'/'+tot+(x.src===0?' · <span style="color:#ff8a6a">nothing linked by track makes it</span>':'')+'</small><span style="display:block;height:6px;border-radius:3px;background:#000a;margin-top:2px;overflow:hidden"><span style="display:block;height:100%;width:'+pc+'%;background:#e9a646"></span></span></span>'
   +(x.ord?'':'<button onclick="rushAmt('+x.i+',\''+x.k+'\',-20)" style="border:0;border-radius:7px;padding:4px 8px;background:#3d3426;color:#f4ead5;font-weight:800">−20</button><button onclick="rushAmt('+x.i+',\''+x.k+'\',20)" style="border:0;border-radius:7px;padding:4px 8px;background:#3d3426;color:#f4ead5;font-weight:800">＋20</button>')
   +'<button onclick="rushDel('+x.i+',\''+x.k+'\')" style="border:0;border-radius:7px;padding:4px 8px;background:#3a2220;color:#ffb3a0;font-weight:800">✕</button></div>'}
 h+='</div>';const bar=[...j.children].find(c=>c.tagName==='DIV'&&c.querySelector&&c.querySelector('button[onclick^="oTab"]'));if(bar)bar.insertAdjacentHTML('afterend',h);else{const f=j.firstElementChild;if(f)f.insertAdjacentHTML('afterend',h);else j.insertAdjacentHTML('afterbegin',h)}}catch(e){}return r}}
// map: a gold ⭐ over each rushed building
{const o=draw;draw=function(){o.apply(this,arguments);try{const R=rushes();if(!R.length)return;const tm=performance.now()/1000;ctx.save();ctx.setTransform(DPR(),0,0,DPR(),0,0);ctx.textAlign='center';ctx.textBaseline='middle';const seen={};
 for(const x of R){const T=sites[x.i];const sx=((T.x+.5)*TS-cam.x)*cam.z+W/2,n=seen[x.i]=(seen[x.i]||0)+1,sy=((T.y+.5)*TS-cam.y)*cam.z+H/2-Math.max(26,1.1*TS*cam.z)-(n-1)*22;if(sx<-30||sy<-30||sx>W+30||sy>H+30)continue;const b=1+.08*Math.sin(tm*4);
  ctx.fillStyle='rgba(42,29,12,.92)';ctx.beginPath();ctx.roundRect?ctx.roundRect(sx-24,sy-10,48,20,10):ctx.rect(sx-24,sy-10,48,20);ctx.fill();ctx.strokeStyle='#ffd27a';ctx.lineWidth=1.5;ctx.stroke();ctx.font=Math.round(12*b)+'px system-ui';ctx.fillText('⭐',sx-12,sy+1);ctx.font='12px system-ui';ctx.fillText(TYPES[x.k].g,sx+2,sy+1);ctx.font='700 10px system-ui';ctx.fillStyle='#ffd27a';ctx.fillText(rushLeft(x),sx+17,sy+1)}
 ctx.restore()}catch(e){}}}

// ===== v273 (Sébastien: "extend rush to ships"): when no building linked by track makes the rushed good, it comes by sea:
// producers on another island send it to their dock first, ships load it first and sail at once, the landing dock offers it first.
const rushIsl=(d,g)=>{try{const J=islOf(sites[d]);return rushes().some(r=>r.k===g&&rushLeft(r)>0&&islOf(sites[r.i])===J)}catch(e){return false}};
{const o=shPri;shPri=function(d,g){return rushIsl(d,g)?9:o(d,g)}}
function rushSea(X,xi){try{for(const l of portLanes(xi)){const e=l.a===xi?l.b:l.a;const q=(X.ex||{})[e];if(!q)continue;for(const g in q)if(q[g]>=1&&rushIsl(e,g))return e}}catch(err){}return null}
{const o=portSync;portSync=function(P,force){const r=o.apply(this,arguments);try{const I=islOf(P);const R=rushes().find(x=>rushLeft(x)>0&&islOf(sites[x.i])===I&&(P.im||{})[x.k]>=1);if(R&&P.cur!==R.k){if(P.cur!=null)P.im[P.cur]=Math.max(0,P.stock||0);P.cur=R.k;P.stock=P.im[R.k]||0;AUTO.k=''}}catch(e){}return r}}
{const o=shipPlan;shipPlan=function(){const m=o.apply(this,arguments);try{const R=rushes().filter(r=>rushLeft(r)>0&&r.src===0);const sig=AUTO.k+'|'+R.map(r=>r.i+r.k).join(',');if(m._rss===sig)return m;m._rss=sig;
 const L=[];for(const l of S.lanes){const[A,B]=laneEnds(l);if(!A||!B||!A.linked||!B.linked||!laneShips(l))continue;L.push({D:A,E:B,len:l.p.length},{D:B,E:A,len:l.p.length})}
 for(const r of R){const T=sites[r.i],J=islOf(T),k=r.k;if(!canShip(k)){r.sea='';r.why='your ships have no hold for it';continue}const bT=bfs(id(T.x,T.y)),left=rushLeft(r),C=[];
  for(const[pi,f]of m){const P=sites[pi];if(f.k!==k||f.why.length||f.pin||f.rush||P.type==='port'||islOf(P)===J)continue;const b=bfs(id(P.x,P.y));let best=null;
   for(const c of L){if(islOf(c.D)!==islOf(P)||islOf(c.E)!==J||dockFull(c.D))continue;const d0=b.dist[id(c.D.x,c.D.y)];if(!(d0>0))continue;const d1=bT.dist[id(c.E.x,c.E.y)];if(!(d1>0))continue;const d=d0+c.len*3+d1;if(!best||d<best.d)best={d,d0,c}}
   if(best)C.push({pi,f,best})}
  C.sort((a,b)=>a.best.d-b.best.d);let acc=0;for(const q of C){if(acc>=left*1.3+20)break;const f=q.f;f.to=pIdx(q.best.c.D);f.d=q.best.d0;f.need=true;f.pr=true;f.via=pIdx(q.best.c.E);f.fin=r.i;f.sea=1;f.rush=1;acc+=Math.max(10,f.sup||0)}
  r.sea=C.length?islName(islOf(sites[C[0].pi])):'';r.why=C.length?'':'no dock route reaches it'}}catch(e){}return m}}
// Orders board line: say it comes by ship
{const o=renderJobs;renderJobs=function(){const r=o.apply(this,arguments);try{const el=document.getElementById('rushlist');if(!el)return r;const R=rushes();el.querySelectorAll('small').forEach((s,j)=>{});
 for(const x of R){if(x.src!==0)continue;const spans=[...el.querySelectorAll('span')].filter(s=>s.textContent==='nothing linked by track makes it');for(const s of spans){const row=s.parentNode&&s.parentNode.parentNode;if(!row||!row.textContent.includes(nm(sites[x.i]))||!row.textContent.includes(TYPES[x.k].g))continue;s.style.color=x.sea?'#8fd0ff':'#ff8a6a';s.textContent=x.sea?'🚢 comes by ship from '+x.sea:'🚢 '+(x.why||'no dock route reaches it')}}}catch(e){}return r}}
// v273: rush fee = 30% of what the delivery normally pays (×1.5 when it must come by ship); undelivered share refunded on cancel
function rushSeaNeed(T,k){const il=islOf(T);return !sites.some(s=>s.linked&&!s.hidden&&(s.type===k||(FAC[s.type]&&FAC[s.type].out===k))&&islOf(s)===il)}
function rushPU(T,k){const t=TYPES[k];if(!t||!t.rate)return 0;return t.rate*DF(20)*PAY*.3*(rushSeaNeed(T,k)?1.5:1)}
function rushUnits(T,k){const ord=T.type==='town'&&!!(ordOf(T)||{})[k];return ord?rushLeft({i:sites.indexOf(T),k,ord:true,n:0,got:0}):50}
function rushFee(T,k,u){return Math.max(150,Math.round(rushPU(T,k)*(u==null?rushUnits(T,k):u)/10)*10)}
{const o=rushAdd;rushAdd=function(i,k){const T=sites[i];if(!T||rushOf(i,k)||rushes().length>=RUSHMAX)return o.apply(this,arguments);const u=rushUnits(T,k),fee=rushFee(T,k,u);
 if(S.money<fee){toast('⭐ This rush costs '+fmt(fee)+': you need '+fmt(fee-S.money)+' more');return}
 const n0=rushes().length;o.apply(this,arguments);const r=rushOf(i,k);if(!r||rushes().length===n0)return;S.money-=fee;led&&led('rushes',-fee);r.fee=fee;r.pu=fee/Math.max(1,u);r.pn=u;floaty.push({x:T.x,y:T.y,txt:'−'+fmt(fee)+' ⭐',a:1});save();refreshPanel()}}
{const o=rushDel;rushDel=function(i,k){const r=rushOf(i,k);let back=0;if(r&&r.pu){const left=Math.min(rushLeft(r),r.pn||0);back=Math.round(r.pu*left/10)*10}o.apply(this,arguments);if(back>0){S.money+=back;led&&led('rushes',back);toast('⭐ Rush cancelled: '+fmt(back)+' refunded for the part not delivered');save();refreshPanel()}}}
{const o=rushAmt;rushAmt=function(i,k,d){const r=rushOf(i,k);if(!r||r.ord)return o.apply(this,arguments);const n0=r.n;if(d>0){const c=Math.round((r.pu||rushPU(sites[i],k))*d/10)*10;if(S.money<c){toast('⭐ 20 more costs '+fmt(c));return}o.apply(this,arguments);const dn=r.n-n0;if(dn>0){const cc=Math.round((r.pu||0)*dn/10)*10;S.money-=cc;r.pn=(r.pn||n0)+dn;toast('⭐ +'+dn+' units · '+fmt(cc))}}
 else{o.apply(this,arguments);const dn=n0-r.n;if(dn>0&&r.pu){const b=Math.round(r.pu*dn/10)*10;S.money+=b;r.pn=Math.max(0,(r.pn||n0)-dn);toast('⭐ −'+dn+' units · '+fmt(b)+' refunded')}}save();refreshPanel()}}
if(typeof window!=='undefined'){window.rushAdd=rushAdd;window.rushDel=rushDel;window.rushAmt=rushAmt}
{const o=rushBox;rushBox=function(T){let h=o.apply(this,arguments);if(!h)return h;try{h=h.replace(/(<button onclick="rushAdd\((\d+),'(\w+)'\)"[^>]*>)([^<]*)<\/button>/g,(m,a,i,k,txt)=>{const f=rushFee(T,k),sea=rushSeaNeed(T,k),poor=S.money<f;return a.replace(/opacity:\.45/,'')+txt+' <small style="opacity:.9'+(poor?';color:#ff8a6a':'')+'">'+fmt(f)+(sea?' 🚢':'')+'</small></button>'});
 h=h.replace('trains bring it here first</small>','trains bring it here first · costs 30% of the delivery pay, refunded if cancelled</small>')}catch(e){}return h}}
// v273b: each extra rush running at once costs more (1st ×1.25, 2nd ×1.5, 3rd ×2)
const RUSHM=[1.25,1.5,2];
{const o=rushPU;rushPU=function(T,k){return o.apply(this,arguments)*(RUSHM[Math.min(RUSHM.length-1,rushes().length)]||2)}}
{const o=rushBox;rushBox=function(T){let h=o.apply(this,arguments);if(!h)return h;const n=rushes().length;if(n<RUSHMAX)h=h.replace('costs 30% of the delivery pay','rush '+(n+1)+' of '+RUSHMAX+' costs '+Math.round(30*RUSHM[n])+'% of the delivery pay (×'+RUSHM[n]+')');return h}}
// v274: buildings never overlap. Two yard buildings on diagonal neighbours could both put their building drawing on the same
// empty square (Oil Well + Refinery). The later building now moves its drawing to its other side when that side is free land,
// and placement is refused when the new building (or a neighbour) would have nowhere to stand without overlapping.
const artSq=(o,Y)=>Y?(Y.hz?[o.x,o.y+Y.side]:[o.x+Y.side,o.y]):null;
{const bY=yardOf;let DEP=0;
 const claimed=(o,q)=>{const i=sites.indexOf(o);for(const[dx,dy]of D4){const b=siteAt(q[0]+dx,q[1]+dy);if(!b||b===o||!isYard(b))continue;const j=sites.indexOf(b);if(i>=0&&j>i)continue;const a=artSq(b,yardOf(b));if(a&&a[0]===q[0]&&a[1]===q[1])return true}return false};
 yardOf=function(o){const Y=bY(o);if(!Y||DEP>3)return Y;DEP++;try{const q=artSq(o,Y);if(!claimed(o,q))return Y;
   const s2=-Y.side,q2=Y.hz?[o.x,o.y+s2]:[o.x+s2,o.y],k2=id(q2[0],q2[1]);
   if(landTile(q2[0],q2[1])&&!track.has(k2)&&!siteAt(q2[0],q2[1])&&!claimed(o,q2))return Object.assign({},Y,{side:s2});return Y}finally{DEP--}}}
// every clash near (x,y): a building drawing on another building's square, or two drawings on one square
function artClashNear(x,y,r){const occ=new Map(),bad=[];const put=(k,o)=>{if(occ.has(k)&&occ.get(k)!==o)bad.push(o);else occ.set(k,o)};
 for(const o of sites){if(o.hidden||Math.abs(o.x-x)>r+1||Math.abs(o.y-y)>r+1)continue;put(o.x+','+o.y,o)}
 for(const o of sites){if(o.hidden||!isYard(o)||Math.abs(o.x-x)>r||Math.abs(o.y-y)>r)continue;let a=null;try{a=artSq(o,yardOf(o))}catch(e){}if(a)put(a[0]+','+a[1],o)}return bad}
function artFits(x,y,k){if(!(FAC[k]||YARD_T.has(k)))return true;const d=siteAt(x,y);let o,old;
 if(d){old=d.type;d.type=k;o=d}else{o={x,y,type:k,lvl:1};sites.push(o)}
 try{return!artClashNear(x,y,2).length}catch(e){return true}finally{if(d)d.type=old;else{const i=sites.lastIndexOf(o);if(i>=0)sites.splice(i,1)}}}
const ART_MSG='No room here: its building would overlap a neighbour. Pick another square';
{const o=facSpot;facSpot=function(x,y){const e=o.apply(this,arguments);if(e)return e;return artFits(x,y,Object.keys(FAC)[0])?'':ART_MSG}}
{const o=indSpot;indSpot=function(x,y,k){const e=o.apply(this,arguments);if(e)return e;return artFits(x,y,k)?'':ART_MSG}}
{const o=validFor;validFor=function(x,y,k){if(!o.apply(this,arguments))return false;return k==='port'||artFits(x,y,k)}}
// v274b (Sébastien: the Oil Well's tower still poked into the Refinery's siding): a building's drawing is wider than its square
// (props on both sides, roof above). It now only spreads onto neighbouring squares that are empty land (no track, building or other drawing),
// never covers its own siding rails, and shrinks a little when it is boxed in. Same look as before when there is room.
const ARTE={wood:[-29,25,-44,16],farm:[-26,25,-44,16],stone:[-25,27,-44,16],coal:[-25,26,-44,16],iron:[-25,26,-44,16],oil:[-31,25,-44,16]},ARTF=[-22,28,-47,16];
function artFree(s,x,y){if(x<0||y<0||x>=N||y>=N||!landTile(x,y)||track.has(id(x,y)))return false;const b=bldAt(x,y);return!b||b===s}
// roofs may rise over track or water to the north (the building stands in front of it), never over another building
function artUp(s,x,y){if(x<0||y<0||x>=N||y>=N)return false;const b=bldAt(x,y);return!b||b===s}
const ARTC=new Map();
function artFit(s,X,Y,Yd){const B=Yd.two?27:21,ax=Yd.hz?s.x:s.x+Yd.side,ay=Yd.hz?s.y+Yd.side:s.y,e=isFac(s)?ARTF:(ARTE[s.type]||ARTF);
 let cx=X+(Yd.hz?0:Yd.side*B),cy=Y+(Yd.hz?Yd.side*B:0);
 let L=ax*TS-(artFree(s,ax-1,ay)?24:2),R=(ax+1)*TS+(artFree(s,ax+1,ay)?24:2),T=ay*TS-(artUp(s,ax,ay-1)?40:2),Bt=(ay+1)*TS+(artFree(s,ax,ay+1)?20:2);
 const rail=Yd.two?13:6;// keep off its own siding rails
 if(Yd.hz){if(Yd.side<0)Bt=Math.min(Bt,Y-rail);else T=-1e9/* a building south of its siding may stand in front of it, as always */}else{if(Yd.side<0)R=Math.min(R,X-rail);else L=Math.max(L,X+rail)}
 const sc=Math.max(.7,Math.min(1.08,(R-L)/(e[1]-e[0]),(Bt-T)/(e[3]-e[2])));
 const cl=(v,a,b)=>a>b?(a+b)/2:Math.min(b,Math.max(a,v));
 cx=cl(cx,L-sc*e[0],R-sc*e[1]);cy=cl(cy,T-sc*e[2],Bt-sc*e[3]);return{cx,cy,sc}}
function artXf(s,X,Y,Yd){let f=null;const now=performance.now(),k=ARTC.get(s);
 if(k&&k.t>now&&k.hz===Yd.hz&&k.sd===Yd.side&&k.two===Yd.two)f=k.f;else{try{f=artFit(s,X,Y,Yd)}catch(e){f=null}ARTC.set(s,{f,t:now+800+Math.random()*400,hz:Yd.hz,sd:Yd.side,two:Yd.two})}
 if(!f){const B=Yd.two?27:21;ctx.translate(Yd.hz?0:Yd.side*B,Yd.hz?Yd.side*B:0);ctx.translate(X,Y);ctx.scale(1.08,1.08);ctx.translate(-X,-Y);return}
 ctx.translate(f.cx,f.cy);ctx.scale(f.sc,f.sc);ctx.translate(-X,-Y)}





































// ===================== v275 REAL TRACK (Sébastien 2026-11-14, "Build it as shown") =====================
// 1) Trains never turn round on the spot. A train keeps its engine end: to head back it reverses (the engine pushes, a white
//    lamp shows on the leading wagon), backs past a junction and drives on engine first, or its engine runs round its wagons
//    on a second track. Routes are planned square by square with no U-turns, and loops are used when they are not much longer.
// 2) New industries and factories stand on a 2 x 4 plot: one row of loading tracks beside a straight line (joined to the line
//    at both ends, so trains drive in at one end and out at the other) and one row for the building, plus one more row kept
//    free for the 3rd and 4th tracks that upgrades add. Each loading track holds one train; the others wait at the signal.
// 3) Older buildings move onto the new plot when there is room; the rest keep their small siding but get the same rules.
var RTON=true;
const RT_RA=3.5,RT_REV=.45,RT_LC=2;
const rtNC=t=>t.w==='coach'?2+(t.dine?1:0):2+(t.big?1:0),rtLt=t=>.15+rtNC(t)*.42;
const rtDir=(a,b)=>{const d=b-a;return d===1?0:d===-1?1:d===N?2:d===-N?3:-1};
const rtXY=i=>[i%N,(i/N)|0],rtI=q=>id(q[0],q[1]);
const rtNP=(o,k,v)=>{if(!Object.getOwnPropertyDescriptor(o,k))Object.defineProperty(o,k,{value:v,writable:true,enumerable:false,configurable:true});else o[k]=v};

// ---------- the yard plot ----------
const ydOK=o=>RTON&&!!o&&!!o.yd&&!o.hidden&&isYard(o);
const ydLanes=o=>o.type==='farm'?2:Math.min(4,1+(isFac(o)?(o.lvl||1):IND.lvl(o)));
const YDC=new WeakMap();
function ydG(o){const Y=o.yd,n=ydLanes(o),k=Y.hz+','+Y.sd+','+Y.u0+','+o.x+','+o.y+','+n+','+track.size;let g=YDC.get(o);if(g&&g.k===k)return g;
 const{hz,sd,u0}=Y,lr=hz?o.y-sd:o.x-sd,tileAt=u=>hz?id(u,lr):id(lr,u),uOf=i=>hz?i%N:(i/N)|0,onLine=i=>(hz?((i/N)|0):i%N)===lr;
 const span=[0,1,2,3].map(j=>tileAt(u0+j)),rxy=(u,r)=>hz?[u,lr+sd*r]:[lr+sd*r,u];
 const railAt=u=>{const[x,y]=rxy(u,0);return isRail(x,y)};
 const conL=railAt(u0-1),conR=railAt(u0+4);
 // v278: where the line end is a junction, the loading tracks fan out inside the yard, not on the junction's own switches
 const busy=u=>{const[x,y]=rxy(u,0);return D4.filter(([dx,dy])=>isRail(x+dx,y+dy)&&!laneSet.has(id(x+dx,y+dy))).length>=3},bL=conL&&(busy(u0-1)||busy(u0-2)),bR=conR&&(busy(u0+4)||busy(u0+5));
 const rl=q=>1.2+.25*q,off=q=>24+16*q,ss=u=>{u=Math.max(0,Math.min(1,u));return u*u*(3-2*u)};
 // how far (px, toward the building) loading track q runs from the line's centre at position c along the line
 const sL=q=>bL?u0-.5:u0-rl(q),eR=q=>bR?u0+3.5:u0+3+rl(q);
 const lat=(q,c)=>{const L=off(q),R=rl(q);let f=1;if(conL){if(c<sL(q)+R)f=Math.min(f,ss((c-sL(q))/R))}else if(c<u0-.45)f=0;if(conR){if(c>eR(q)-R)f=Math.min(f,ss((eR(q)-c)/R))}else if(c>u0+3.45)f=0;return L*f};
 const px=(c,d)=>hz?[(c+.5)*TS,(lr+.5)*TS+sd*d]:[(lr+.5)*TS+sd*d,(c+.5)*TS];
 const foot=[];for(let r=1;r<=3;r++)for(let u=u0;u<u0+4;u++){const[x,y]=rxy(u,r);foot.push(id(x,y))}
 const zone=new Set(span);zone.add(tileAt(u0-1));zone.add(tileAt(u0+4));
 g={k,hz,sd,u0,lr,n,span,foot,zone,conL,conR,sL,eR,rl,off,lat,px,tileAt,uOf,onLine,rxy,bRow:n>2?3:2};YDC.set(o,g);return g}
// footprint squares (rows 1-3 beside the line) -> building, and the squares on the far side of the line where no track may join
let YFK='',YFP=new Map(),YSB=new Map();
function yfp(){const k=sites.length+'/'+(S.ydn||0);if(k!==YFK){YFK=k;YFP=new Map();YSB=new Map();for(const o of sites)if(ydOK(o)){const G=ydG(o);for(const i of G.foot)if(i!==id(o.x,o.y))YFP.set(i,o);for(let u=G.u0;u<G.u0+4;u++){const[x,y]=G.rxy(u,-1);YSB.set(id(x,y),o)}}}return YFP}
const ydFoot=i=>yfp().get(i)||null,ydSide=i=>{yfp();return YSB.get(i)||null};
const ydBan=i=>!!ydFoot(i)||!!ydSide(i);
const ydStubAt=(x,y)=>{const s=siteAt(x,y);return!!s&&ydOK(s)};
const ydCenter=o=>{const G=ydG(o);return G.px(G.u0+1.5,G.bRow*TS)};

// where a 2 x 4 plot (+1 row) fits around the building square A; conv: an older building already joined at A
function ydCands(x,y,k,conv,self){const out=[];const mine=k==='coal'||k==='iron'||k==='stone'||k==='oil';yfp();
 const freeLine=(X,Y)=>(landTile(X,Y)||mine&&terr[id(X,Y)]===4)&&(terr[id(X,Y)]!==4||mine)&&rev[id(X,Y)]&&!siteAt(X,Y)&&!YFP.has(id(X,Y))&&!YSB.has(id(X,Y))&&!(S.sheds||[]).some(o=>o.x===X&&o.y===Y)&&!(typeof stnAt==='function'&&stnAt(X,Y))&&!(()=>{const b=bldAt(X,Y);return b&&b!==self&&b.type!=='dep'&&b.type!=='plot'})();
 for(const hz of[1,0])for(const sd of[1,-1]){const au=hz?x:y,ar=hz?y:x,lr=ar-sd,T=(u,r)=>hz?[u,lr+sd*r]:[lr+sd*r,u];
  U:for(let u0=au-3;u0<=au;u0++){let sc=0;
   for(let u=u0;u<u0+4;u++){const[X,Y]=T(u,0);if(X<2||Y<2||X>=N-2||Y>=N-2)continue U;const i=id(X,Y);
    if(track.has(i)){sc+=3;if(dblSet.has(i)&&0)continue U}else{if(conv&&u===au)continue U;if(!freeLine(X,Y))continue U}
    const[FX,FY]=T(u,-1);if(isRail(FX,FY))continue U}// nothing may join the plot's line from the far side
   if(conv){const[MX,MY]=T(au,0);const nb=D4.filter(([dx,dy])=>isRail(x+dx,y+dy));if(nb.length!==1||x+nb[0][0]!==MX||y+nb[0][1]!==MY)continue U}
   for(const u of[u0-1,u0+4]){const[X,Y]=T(u,0);if(track.has(id(X,Y)))sc+=2}
   for(let r=1;r<=3;r++)for(let u=u0;u<u0+4;u++){const[X,Y]=T(u,r);if(X===x&&Y===y)continue;if(X<2||Y<2||X>=N-2||Y>=N-2)continue U;const i=id(X,Y),tr=terr[i];
    if(track.has(i)||!rev[i]||tr===0||laneSet.has(i))continue U;if(tr===4&&!mine)continue U;
    const st=siteAt(X,Y);if(st&&!st.hidden)continue U;if(YFP.has(i)||YSB.has(i))continue U;if((S.sheds||[]).some(o=>o.x===X&&o.y===Y))continue U;
    const b=bldAt(X,Y);if(b&&b!==self&&b.type!=='dep'&&b.type!=='plot')continue U;
    if(r===1&&D4.some(([dx,dy])=>{const q=siteAt(X+dx,Y+dy);return q&&q!==self&&!q.hidden&&q.type!=='dep'&&q.type!=='plot'&&!(X+dx===x&&Y+dy===y)&&track.has(id(X+dx,Y+dy))===false&&isYard(q)}))continue U}
   out.push({hz,sd,u0,sc:sc-Math.abs(au-(u0+1.5))*.3})}}
 return out.sort((a,b)=>b.sc-a.sc)}
// put a building on its plot: the line squares it needs become its own track (free); old ends stay as they are
function ydApply(o,c,conv){o.yd={hz:c.hz,sd:c.sd,u0:c.u0};S.ydn=(S.ydn||0)+1;const lr=c.hz?o.y-c.sd:o.x-c.sd,T=u=>c.hz?[u,lr]:[lr,u];let n=0;
 for(let u=c.u0-(conv?0:1);u<=c.u0+(conv?3:4);u++){const[X,Y]=T(u);const i=id(X,Y);if(track.has(i))continue;if(!landTile(X,Y)||terr[i]===4||!rev[i]||siteAt(X,Y))continue;
  if(u<c.u0||u>c.u0+3){const[FX,FY]=c.hz?[X,Y-c.sd]:[X-c.sd,Y],[BX,BY]=c.hz?[X,Y+c.sd]:[X+c.sd,Y];if(isRail(FX,FY)||isRail(BX,BY))continue}
  track.add(i);n++}
 YFK='';try{computeNet()}catch(e){}if(typeof HDc!=='undefined')HDc.n=-1;return n}
// older buildings move onto a plot once, where there is room
function ydConvert(){if(S.ydConv===275)return;S.ydConv=275;let n=0;for(const o of sites){if(!isYard(o)||o.yd||o.hidden)continue;const c=ydCands(o.x,o.y,o.type,1,o);if(c.length){ydApply(o,c[0],1);n++}}
 if(n){YFK='';for(const t of S.trains){if(!t.path||!t.path.length)continue;const e=t.path[t.path.length-1],s=siteAt(e[0],e[1]);if(s&&ydOK(s)&&t.path.length>1){rtNP(t,'_pP',null)}}}return n}

// ---------- route planning: squares with a heading, no U-turns; reversing costs a pause ----------
function rtPlan(F,occ,eh,goal,raOk){
 const key=(i,d,m,r)=>((i*5+d)*2+m)*3+r,ti=k=>Math.floor(k/30),dI=k=>Math.floor(k/6)%5,mI=k=>Math.floor(k/3)%2,rI=k=>k%3;
 const G=new Map(),PV=new Map(),HW=new Map(),H=[];
 const push=(k,c)=>{H.push([c,k]);let i=H.length-1;while(i>0){const p=(i-1)>>1;if(H[p][0]<=H[i][0])break;const z=H[p];H[p]=H[i];H[i]=z;i=p}};
 const pop=()=>{const top=H[0],last=H.pop();if(H.length){H[0]=last;let i=0;for(;;){const l=2*i+1,r=l+1;let m=i;if(l<H.length&&H[l][0]<H[m][0])m=l;if(r<H.length&&H[r][0]<H[m][0])m=r;if(m===i)break;const z=H[m];H[m]=H[i];H[i]=z;i=m}}return top};
 const d0=occ.length>1?rtDir(occ[1],F):-1,S0=key(F,d0<0?4:d0,eh?1:0,0);G.set(S0,0);push(S0,0);
 const relax=(k,c,p,h)=>{const o=G.get(k);if(o===undefined||c<o){G.set(k,c);PV.set(k,p);HW.set(k,h);push(k,c)}};
 const back=k=>{const T=[ti(k)];let c=k,oi=0;while(T.length<=RT_LC){if(c===S0){oi++;if(oi>=occ.length)return null;T.push(occ[oi]);continue}if(HW.get(c)!==0)return null;c=PV.get(c);T.push(ti(c))}return T};
 const DD=[1,-1,N,-N];let end=-1,n=0;
 while(H.length&&n++<90000){const[c,k]=pop();if(c>G.get(k))continue;const i=ti(k),d=dI(k),m=mI(k),r=rI(k);if(i===goal){end=k;break}
  const pt=d<4?i-DD[d]:-1,x=i%N,y=(i/N)|0;
  for(let q=0;q<4;q++){const nx=x+D4[q][0],ny=y+D4[q][1];if(nx<0||ny<0||nx>=N||ny>=N)continue;const j=id(nx,ny);if(j===pt||!isRail(nx,ny)||laneSet.has(j))continue;const nw=d<4&&q!==d&&typeof RG!=='undefined'&&RG.on&&!RG.ok(i,d^1,q)?10:0;if(j!==goal&&ydStubAt(nx,ny))continue;relax(key(j,q,m,r),c+(m?1:1.8)+nw,k,0)}
  if(r<2){const T=back(k);if(T){const Y=T[RT_LC],dd=rtDir(T[RT_LC-1],Y);if(dd>=0){relax(key(Y,dd,m?0:1,r+1),c+4,k,1);if(raOk&&k===S0&&m)relax(key(Y,dd,1,r+1),c+12,k,2)}}}}
 if(end<0)return null;
 const seq=[];let k=end;while(k!==S0){seq.push([k,HW.get(k)]);k=PV.get(k)}seq.reverse();
 const legs=[{s:'go',t:[F]}];for(const[q,h]of seq){if(h===0)legs[legs.length-1].t.push(ti(q));else legs.push({s:h===1?'rev':'ra',t:[ti(q)]})}
 if(legs[0].t.length===1&&legs.length>1)legs.shift();
 return{legs,cost:G.get(end)}}
// the squares a train covers, from its leading end backwards
function rtOcc(P,pos){if(!P||!P.length)return[];const i=Math.max(0,Math.min(P.length-1,Math.round(pos))),o=[rtI(P[i])];for(let j=i-1;j>=0&&o.length<=RT_LC+1;j--){const v=rtI(P[j]);if(v!==o[o.length-1])o.push(v)}return o}
function rtRAok(t,F){return false;const x=F%N,y=(F/N)|0;if(dblSet.has(F))return true;const Y=t.yl&&sites[t.yl.i];if(Y&&ydOK(Y)&&ydG(Y).span.includes(F))return true;const s=siteAt(x,y);if(s&&isYard(s)&&!ydOK(s)&&yardTwo(s))return true;if(s&&s.type==='town'&&(s.pop>0||s.beacon))return true;if(typeof stnAt==='function'&&stnAt(x,y))return true;return false}
// a trip that ends at a building with loading tracks runs along its line to the far end of the tracks instead of into the building square
function rtYardTail(t,pl,goal){const s=siteAt(goal%N,(goal/N)|0);if(!s||!isYard(s))return;t.yg=sites.indexOf(s);if(!ydOK(s))return;const G=ydG(s),L=pl.legs[pl.legs.length-1].t;if(L.length<2)return;const M=L[L.length-2];if(!G.span.includes(M))return;
 const P2=L.length>=3?L[L.length-3]:null,uM=G.uOf(M);let dir=0;if(P2!=null&&G.onLine(P2))dir=Math.sign(uM-G.uOf(P2));if(!dir)dir=(uM-G.u0)<(G.u0+3-uM)?1:-1;
 L.pop();let u=uM;const e=dir>0?G.u0+3:G.u0;while(u!==e){u+=dir;const q=G.tileAt(u);if(!isRail(q%N,(q/N)|0))break;L.push(q)}}
// set a train's path and tell the old glide (v161) not to slide it: the train is already where it is drawn
function rtSetPath(t,P,pos,keepX){let g=null;try{if(typeof railPt==='function'&&t.path&&t.path.length>1&&P.length>1&&keepX){const a=railPt(t.path,keepX[0],t),b=railPt(P,keepX[1],t),dx=a[0]-b[0],dy=a[1]-b[1],d=Math.hypot(dx,dy);if(d>1&&d<40)g={x:dx,y:dy,t0:performance.now()}}}catch(e){}
 t.path=P;t.pos=pos;rtNP(t,'_pP',P);rtNP(t,'_pq',pos);rtNP(t,'_rtng',1);if(g)rtNP(t,'_gl',g)}
function rtGo(t,leg,occ){const Lt=rtLt(t);let P,pos,kx;
 if(leg.s==='go'){P=occ.slice().reverse().concat(leg.t.slice(1)).map(rtXY);pos=occ.length-1;kx=[t.pos,pos]}
 else{if(occ.length<=RT_LC||occ[RT_LC]!==leg.t[0])return false;P=occ.slice(0,RT_LC+1).concat(leg.t.slice(1)).map(rtXY);kx=[t.pos,0];
  if(leg.s==='rev'){pos=Lt;t.rh=t.rh===0?1:0;t.rf=t.rf===-1?1:-1;t.wait=Math.max(t.wait||0,RT_REV)}
  else{pos=Math.min(P.length-1,Lt+.57);t.rh=1;t.rf=t.rf===-1?1:-1;t.wait=Math.max(t.wait||0,RT_RA);let k2=null;const Y=t.yl&&sites[t.yl.i];if(Y&&ydOK(Y)){const n=ydLanes(Y);k2=t.yl.k+1<n?t.yl.k+1:t.yl.k-1}t.ra={t0:S.t,d:RT_RA,k2}}}
 rtSetPath(t,P,pos,kx);return true}
// a new path was set by the game (a new trip, a reroute): plan it on real track
function rtSeen(t){if(!RTON||!t.path)return;const P=t.path;if(P===t._pP){rtNP(t,'_pq',t.pos);return}
 const P0=t._pP,q0=t._pq;rtNP(t,'_pP',P);rtNP(t,'_pq',t.pos);if(!P0||!P0.length||!P.length)return;
 const occ=rtOcc(P0,q0),F=occ[0];
 if(t.pos>.01){const c=Math.floor(t.pos);let same=c<P.length&&c<P0.length;for(let j=0;same&&j<=c;j++)if(P[j][0]!==P0[j][0]||P[j][1]!==P0[j][1])same=false;if(!same)return;let ut=false;for(let j=Math.max(2,c);j<P.length;j++)if(P[j][0]===P[j-2][0]&&P[j][1]===P[j-2][1]){ut=true;break}if(!ut&&!(typeof RG!=='undefined'&&RG.on&&RG.bad(P,c)))return}
 else{const s0=rtI(P[0]);if(s0!==F&&!(occ.length>1&&s0===occ[1])){
  // v281: a trip that starts at a building with its own yard starts from where the train stands in that yard (it used to jump into the building)
  const B=siteAt(P[0][0],P[0][1]);const inY=B&&ydOK(B)&&ydG(B).zone.has(F);if(!inY){t._tl=null;return}}}// it was moved somewhere else (a ferry, a new train): leave it
 const goal=rtI(P[P.length-1]);t.legs=null;t.yg=null;t.hold=0;
 if(goal===F||P.length<=1){if(occ.length>1)rtSetPath(t,occ.slice().reverse().map(rtXY),occ.length-1,[q0,occ.length-1]);else rtSetPath(t,P,0);if(P.length<=1)return}
 if(goal===F)return;
 let pl=null;try{pl=rtPlan(F,occ,t.rh===0?0:1,goal,rtRAok(t,F))}catch(e){pl=null}
 if(!pl){t.path=P;t._tl=null;return}
 t._tl=Math.max(2,P.length);rtYardTail(t,pl,goal);t.legs=pl.legs.slice(1);if(!t.legs.length)t.legs=null;
 const P0b=t.path;t.path=P0;t.pos=q0;if(!rtGo(t,pl.legs[0],occ)){t.path=P0b;t.pos=0;t.legs=null}}
// the end of one leg: reverse and start the next
function rtLegEnd(t){if(!RTON||!t.legs||!t.legs.length)return false;const leg=t.legs.shift();if(!t.legs.length)t.legs=null;const occ=rtOcc(t.path,t.path.length-1);if(rtGo(t,leg,occ))return true;
 const fin=t.legs&&t.legs.length?t.legs[t.legs.length-1].t:leg.t,goal=fin[fin.length-1];let pl=null;try{pl=rtPlan(occ[0],occ,t.rh===0?0:1,goal,rtRAok(t,occ[0]))}catch(e){}
 if(pl){t.legs=pl.legs.slice(1);if(!t.legs.length)t.legs=null;if(rtGo(t,pl.legs[0],occ))return true}
 const p=pathTo(bfs(occ[0]),goal);t.legs=null;if(p){rtSetPath(t,p,0);return true}return false}
// one train per loading track: the next one waits at the signal, behind any already waiting
function rtHold(t,dt){if(!RTON||t.yg==null||t.legs&&t.legs.length){t.hold=0;return false}const s=sites[t.yg];if(!s||!isYard(s)||s.hidden){t.yg=null;t.hold=0;return false}
 if(t.yl&&t.yl.i===t.yg){t.hold=0;return false}
 const P=t.path,full=ydOK(s),Lt=rtLt(t);let iE=P.length-1;
 if(full){const G=ydG(s);iE=-1;for(let j=Math.max(0,Math.floor(t.pos));j<P.length;j++)if(G.span.includes(rtI(P[j]))){iE=j;break}if(iE<0){t.hold=0;return false}}
 const hp=full?iE-ydG(s).rl(ydLanes(s)-1)-.35:iE-Lt-.6;if(t.pos<hp-1.5){t.hold=0;return false}
 const cap=full?ydLanes(s):1,used=new Set();for(const o of S.trains)if(o!==t&&o.yl&&o.yl.i===t.yg)used.add(o.yl.k);
 if(used.size<cap){let k=0;while(used.has(k))k++;t.yl={i:t.yg,k};t.hold=0;return false}
 const myD=iE-t.pos;rtNP(t,'_hD',myD);let r=0;for(const o of S.trains){if(o===t||o.yg!==t.yg||!o.hold||o.yl&&o.yl.i===t.yg)continue;const d=o._hD===undefined?1e9:o._hD;if(d<myD-.01||Math.abs(d-myD)<=.01&&S.trains.indexOf(o)<S.trains.indexOf(t))r++}
 const stop=hp-r*(Lt+.75);if(t.pos>=stop){t.hold=1;t.why='Waiting at the signal for a free loading track';return true}t.hold=0;return false}
// a loading track is free again once the train has left the yard
function rtRel(t){const y=t.yl;if(!y)return;const s=sites[y.i];if(!s||!isYard(s)||s.hidden){t.yl=null;return}if(t.yg===y.i)return;
 const Z=ydOK(s)?ydG(s).zone:new Set([id(s.x,s.y)].concat(D4.map(([dx,dy])=>id(s.x+dx,s.y+dy))));const P=t.path;if(!P||!P.length){t.yl=null;return}
 const a=rtI(P[Math.max(0,Math.min(P.length-1,Math.round(t.pos)))]),b=rtI(P[Math.max(0,Math.min(P.length-1,Math.round(t.pos-rtLt(t))))]);if(!Z.has(a)&&!Z.has(b))t.yl=null}
function rtTickEnd(){if(!RTON)return;if(S.ydConv!==275)ydConvert();for(const t of S.trains){rtSeen(t);rtRel(t)}}
// the engine's position (smoke comes from the engine, not from the leading wagon when it pushes)
function rtEngS(t){return t.rh===0?t.pos-(t.qo||0)-rtLt(t):t.pos-(t.qo||0)}

// ---------- drawing: trains keep to their loading track ----------
{const rp0=railPt;railPt=function(P,s,t){let r=rp0(P,s,t);if(RTON&&t&&t.yl){const o=sites[t.yl.i];if(o&&ydOK(o)){const G=ydG(o),q=ptAt(P,s),c=G.hz?q[0]/TS-.5:q[1]/TS-.5,v=(G.hz?q[1]/TS-.5:q[0]/TS-.5)-G.lr;
  if(Math.abs(v)<.62){const L=G.lat(t.yl.k,c);if(L>0){const f=Math.min(1,L/12),bx=q[0]+(G.hz?0:G.sd*L),by=q[1]+(G.hz?G.sd*L:0);r=[r[0]*(1-f)+bx*f,r[1]*(1-f)+by*f]}}}}
 if(t&&t._gl){const f=1-(performance.now()-t._gl.t0)/650;if(f<=0)t._gl=null;else{const e=f*f*(3-2*f);r=[r[0]+t._gl.x*e,r[1]+t._gl.y*e]}}return r}}
{const o=yardOf;yardOf=function(s){if(ydOK(s))return null;return o.apply(this,arguments)}}
{const o=bldAt;bldAt=function(x,y){if(RTON){const f=ydFoot(id(x,y));if(f)return f}return o.apply(this,arguments)}}
{const o=siteSpot;siteSpot=function(x,y){if(RTON){const f=ydFoot(id(x,y));if(f)return'This land is kept for '+nm(f)+'\'s loading tracks and upgrades';const g=ydSide(id(x,y));if(g)return'Keep this square clear: it is beside '+nm(g)+'\'s line'}return o.apply(this,arguments)}}
{const o=railErr;railErr=function(x,y){if(RTON){const i=id(x,y);if(!track.has(i)&&!siteAt(x,y)){const f=ydFoot(i);if(f)return nm(f)+' keeps this land for its loading tracks and upgrades';const g=ydSide(i);if(g)return'Join '+nm(g)+'\'s line at either end, not from the side'}}return o.apply(this,arguments)}}
{const o=lay;lay=function(x,y,free){if(RTON){const i=id(x,y);if(!track.has(i)&&!siteAt(x,y)&&ydBan(i)){warn(railErr(x,y));return false}}return o.apply(this,arguments)}}
// the bigger building on its plot (same drawings, a little larger)
const rtBig=o=>function(s,X,Y){if(!ydOK(s))return o.apply(this,arguments);ctx.save();ctx.translate(X,Y);ctx.scale(1.3,1.3);ctx.translate(-X,-Y);try{return o.apply(this,arguments)}finally{ctx.restore()}};
drawInd2=rtBig(drawInd2);drawFac2=rtBig(drawFac2);drawGrowth=rtBig(drawGrowth);

// the yard: gravel, loading tracks curving off the line at both ends, buffers at a dead end, signals, platform, crates, lamps,
// workers and (until upgraded) a fenced row kept for the next tracks. Returns where the building stands.
function drawYd(s,tm){const G=ydG(s),c=ctx,n=G.n,{u0,sd}=G,fr=s.type==='farm';
 const P=(cc,d)=>G.px(cc,d),seg=(q)=>{const a=[],R=G.rl(q),cs=G.conL?G.sL(q):u0-.45,ce=G.conR?G.eR(q):u0+3.45;for(let cc=cs;cc<=ce+1e-6;cc+=.0625)a.push(P(cc,G.lat(q,cc)));return a};
 const quad=(c0,c1,d0,d1,col)=>{const A=P(c0,d0),B=P(c1,d1);c.fillStyle=col;c.fillRect(Math.min(A[0],B[0]),Math.min(A[1],B[1]),Math.abs(B[0]-A[0]),Math.abs(B[1]-A[1]))};
 // ground: gravel under the tracks, a paved yard for the building, the kept row behind
 // v279 (Sébastien: "mines no longer look like mines mining in mountains"): a mine's yard keeps the mountain where it stands;
 // only flat squares get the gravel and paving, and the mine works into the rock through a timbered tunnel mouth
 const MN=s.type==='coal'||s.type==='iron'||s.type==='stone',rock=(u,r)=>{const[X,Y]=G.rxy(u,r);const t=terr[id(X,Y)];return t===3||t===4};
 let rk=[];if(MN)for(let r=0;r<=3;r++)for(let u=u0;u<u0+4;u++)if(rock(u,r))rk.push([u,r]);const clipOn=rk.length>0;
 if(clipOn){c.save();c.beginPath();for(let r=0;r<=3;r++)for(let u=u0-1;u<u0+5;u++){if(u>=u0&&u<u0+4&&rock(u,r))continue;const[X,Y]=G.rxy(u,r);c.rect(X*TS,Y*TS,TS,TS)}c.clip()}
 const lastD=G.off(n-1);quad(u0-.5,u0+3.5,16,lastD+11,'#5c4d3c');quad(u0-.5,u0+3.5,lastD+11,lastD+19,'#cdb991');quad(u0-.5,u0+3.5,lastD+18,lastD+19.2,'#8a6a40');
 const bTop=lastD+19,bBot=(n>2?3:2)*TS+16;quad(u0-.5,u0+3.5,bTop,bBot,fr?'#7a6a3a':'#8b7d68');
 if(fr){for(let k=0;k<4;k++){if(k===1||k===2)continue;const A=P(u0+k-.5,bTop+1),B=P(u0+k+.5,bBot-1);c.fillStyle='#b8953a';c.fillRect(Math.min(A[0],B[0])+1,Math.min(A[1],B[1]),Math.abs(B[0]-A[0])-2,Math.abs(B[1]-A[1]));c.strokeStyle='#d9b85a';c.lineWidth=2;for(let r=4;r<Math.abs(G.hz?B[1]-A[1]:B[0]-A[0])-2;r+=6){c.beginPath();if(G.hz){const yy=Math.min(A[1],B[1])+r;c.moveTo(Math.min(A[0],B[0])+3,yy);c.lineTo(Math.max(A[0],B[0])-3,yy+Math.sin(tm*1.5+k+r)*.8)}else{const xx=Math.min(A[0],B[0])+r;c.moveTo(xx,Math.min(A[1],B[1])+3);c.lineTo(xx+Math.sin(tm*1.5+k+r)*.8,Math.max(A[1],B[1])-3)}c.stroke()}}}
 if(clipOn)c.restore();
 if(n<=2&&clipOn){const A=P(u0-.5,2*TS+16),B=P(u0+3.5,3*TS+16),x0=Math.min(A[0],B[0]),y0=Math.min(A[1],B[1]),w=Math.abs(B[0]-A[0]),h=Math.abs(B[1]-A[1]);c.setLineDash([3,3]);c.strokeStyle='rgba(232,214,166,.8)';c.lineWidth=1.2;c.strokeRect(x0+2.5,y0+2.5,w-5,h-5);c.setLineDash([])}
 else if(n<=2){// the row kept free for upgrades: a fenced, grassy plot with stakes
  const A=P(u0-.5,2*TS+16),B=P(u0+3.5,3*TS+16),x0=Math.min(A[0],B[0]),y0=Math.min(A[1],B[1]),w=Math.abs(B[0]-A[0]),h=Math.abs(B[1]-A[1]);
  if(fr){c.fillStyle='#b8953a';c.fillRect(x0+2,y0+2,w-4,h-4);c.strokeStyle='#d9b85a';c.lineWidth=2;const lg=G.hz?h:w;for(let r=4;r<lg-3;r+=6){c.beginPath();if(G.hz){c.moveTo(x0+4,y0+r);c.lineTo(x0+w-4,y0+r+Math.sin(tm*1.5+r)*.8)}else{c.moveTo(x0+r,y0+4);c.lineTo(x0+r+Math.sin(tm*1.5+r)*.8,y0+h-4)}c.stroke()}}else{
  c.fillStyle='rgba(120,150,80,.35)';c.fillRect(x0+2,y0+2,w-4,h-4);c.setLineDash([3,3]);c.strokeStyle='#e8d6a6';c.lineWidth=1.2;c.strokeRect(x0+2.5,y0+2.5,w-5,h-5);c.setLineDash([]);
  c.fillStyle='#7a5a36';for(let k=0;k<=8;k++){const fx=x0+3+(w-6)*k/8,fy=y0+3+(h-6)*k/8;c.fillRect(fx-1,y0+1,2,4);c.fillRect(fx-1,y0+h-5,2,4);if(k%2===0){c.fillRect(x0+1,fy-1,4,2);c.fillRect(x0+w-5,fy-1,4,2)}}
  if(cam.z>=.9){c.font='8px system-ui';c.textAlign='center';c.textBaseline='middle';c.fillStyle='rgba(40,30,20,.65)';c.save();c.translate(x0+w/2,y0+h/2);if(!G.hz)c.rotate(-Math.PI/2);c.fillText('⬆ room for more tracks',0,0);c.restore()}}}
 // loading tracks: ballast, sleepers, rails (same gauge as the main line)
 const L=[];for(let q=0;q<n;q++)L.push(seg(q));
 c.lineCap='butt';c.lineJoin='round';c.strokeStyle='rgba(88,76,62,.55)';c.lineWidth=17;for(const a of L){c.beginPath();a.forEach((p,k)=>k?c.lineTo(p[0],p[1]):c.moveTo(p[0],p[1]));c.stroke()}
 c.strokeStyle='#5b4128';c.lineWidth=3;for(const a of L){let acc=0;for(let k=1;k<a.length;k++){const dx=a[k][0]-a[k-1][0],dy=a[k][1]-a[k-1][1],d=Math.hypot(dx,dy);acc+=d;if(acc>=8){acc=0;const an=Math.atan2(dy,dx),sn=Math.sin(an),cs=Math.cos(an);c.beginPath();c.moveTo(a[k][0]+sn*7,a[k][1]-cs*7);c.lineTo(a[k][0]-sn*7,a[k][1]+cs*7);c.stroke()}}}
 c.strokeStyle='#d6d0c4';c.lineWidth=2;for(const a of L)for(const o of[-4,4]){c.beginPath();a.forEach((p,k)=>{const A=a[Math.min(a.length-1,k+1)],B=a[Math.max(0,k-1)],an=Math.atan2(A[1]-B[1],A[0]-B[0]),X=p[0]-Math.sin(an)*o,Y=p[1]+Math.cos(an)*o;k?c.lineTo(X,Y):c.moveTo(X,Y)});c.stroke()}
 if(clipOn){// tunnel mouth in the rock beside the building, a narrow track and a tub running out of it, and a spoil heap
  const br=rk.filter(([u,r])=>r>=1).sort((A,B)=>Math.abs(B[0]-(u0+1.5))-Math.abs(A[0]-(u0+1.5))||B[1]-A[1])[0];
  if(br){const[uu,rr]=br,[X,Y]=G.rxy(uu,rr),cx=(X+.5)*TS,cy=(Y+.5)*TS;
   c.fillStyle='rgba(60,50,40,.35)';c.beginPath();c.ellipse(cx,cy+7,13,6,0,0,7);c.fill();
   c.fillStyle='#6d5f52';c.beginPath();c.moveTo(cx-13,cy+8);c.lineTo(cx-11,cy-6);c.quadraticCurveTo(cx,cy-16,cx+11,cy-6);c.lineTo(cx+13,cy+8);c.closePath();c.fill();
   c.fillStyle='#120d0a';c.beginPath();c.moveTo(cx-7,cy+8);c.lineTo(cx-7,cy-3);c.quadraticCurveTo(cx,cy-10,cx+7,cy-3);c.lineTo(cx+7,cy+8);c.closePath();c.fill();
   c.strokeStyle='#8a5a2b';c.lineWidth=2.4;c.beginPath();c.moveTo(cx-8,cy+8);c.lineTo(cx-8,cy-4);c.lineTo(cx+8,cy-4);c.lineTo(cx+8,cy+8);c.stroke();
   c.fillStyle='rgba(255,200,110,'+(.35+.25*Math.sin(tm*2+s.x))+')';c.beginPath();c.arc(cx,cy+1,1.6,0,7);c.fill();
   const bp=P(u0+1.5,(n>2?3:2)*TS-6),k2=(Math.sin(tm*.5+s.y)+1)/2;
   c.strokeStyle='#4a3a2c';c.lineWidth=1;for(const o of[-2,2]){c.beginPath();c.moveTo(cx+o,cy+8);c.lineTo(bp[0]+o,bp[1]);c.stroke()}
   const tx=cx+(bp[0]-cx)*k2,ty=cy+8+(bp[1]-cy-8)*k2;c.fillStyle='#3b3330';c.fillRect(tx-3,ty-2.5,6,4.5);c.fillStyle=CCOL[s.type]||'#555';c.fillRect(tx-2.5,ty-3.5,5,1.8);
   c.fillStyle='#7d7066';c.beginPath();c.moveTo(cx+10,cy+11);c.quadraticCurveTo(cx+15,cy+2,cx+20,cy+11);c.fill()}}
 // buffer stops at a dead end
 for(const[on,cc]of[[G.conL,u0-.45],[G.conR,u0+3.45]]){if(on)continue;for(let q=0;q<n;q++){const p=P(cc,G.off(q));c.fillStyle='#7a2a1a';if(G.hz)c.fillRect(p[0]-2,p[1]-7,4,14);else c.fillRect(p[0]-7,p[1]-2,14,4);c.fillStyle='#e6d36a';if(G.hz)c.fillRect(p[0]-1.5,p[1]-5,3,2);else c.fillRect(p[0]-5,p[1]-1.5,2,3)}}
 // signals at the entrances: red when every loading track is taken and a train waits
 const busy=S.trains.filter(o=>o.yl&&o.yl.i===sites.indexOf(s)).length>=n,waiting=S.trains.some(o=>o.yg===sites.indexOf(s)&&o.hold);
 for(const[on,cc]of[[G.conL,G.sL(n-1)-.25],[G.conR,G.eR(n-1)+.25]]){if(!on)continue;const p=P(cc,13);c.fillStyle='#222';c.fillRect(p[0]-1,p[1]-11,2,11);c.fillStyle='#111';c.beginPath();c.roundRect(p[0]-3,p[1]-19,6,9,2);c.fill();const red=busy&&waiting;c.fillStyle=red?'#ff3b30':'#3a1a1a';c.beginPath();c.arc(p[0],p[1]-16.5,1.7,0,7);c.fill();c.fillStyle=red?'#123018':'#3bff6a';c.beginPath();c.arc(p[0],p[1]-12.5,1.7,0,7);c.fill();if(red||!busy){c.fillStyle=red?'rgba(255,60,40,.25)':'rgba(60,255,110,.2)';c.beginPath();c.arc(p[0],red?p[1]-16.5:p[1]-12.5,4,0,7);c.fill()}}
 // on the platform: lamps, crates or goods waiting (as many as its stock), and a couple of workers
 const pd=lastD+15,cap=isFac(s)?80:IND.cap(s),stock=Math.max(0,s.stock||0),nc=Math.min(10,Math.ceil(stock/cap*10)),col=CCOL[isFac(s)?FAC[s.type].out:s.type]||'#c9965a';
 for(let k=0;k<nc;k++){const p=P(u0+.1+k*.3,pd-1+(k%2)*1.5);c.fillStyle='rgba(0,0,0,.25)';c.fillRect(p[0]-2,p[1]-1,5,4);c.fillStyle=col;c.fillRect(p[0]-2.5,p[1]-3,5,5);c.strokeStyle='#2a1f16';c.lineWidth=.6;c.strokeRect(p[0]-2.5,p[1]-3,5,5)}
 for(const cc of[u0-.3,u0+1.5,u0+3.3]){const p=P(cc,pd);c.fillStyle='#2b2b2b';c.fillRect(p[0]-.7,p[1]-9,1.4,9);c.fillStyle=Math.sin(tm*.7)>-2?'#ffe9a8':'#888';c.beginPath();c.arc(p[0],p[1]-9.5,1.6,0,7);c.fill();c.fillStyle='rgba(255,233,168,.15)';c.beginPath();c.arc(p[0],p[1]-9.5,5,0,7);c.fill()}
 if(cam.z>=1.2)for(let k=0;k<2;k++){const wv=(Math.sin(tm*.6+k*2.1+s.x)+1)/2,p=P(u0+.6+k*1.5+wv*.7,pd+1);c.fillStyle='#2d3a4f';c.fillRect(p[0]-1.2,p[1]-3,2.4,3.5);c.fillStyle='#f0c8a0';c.beginPath();c.arc(p[0],p[1]-4.2,1.2,0,7);c.fill();c.fillStyle=k?'#e9a646':'#d9533f';c.fillRect(p[0]-1.4,p[1]-5.6,2.8,1)}
 return P(u0+1.5,(n>2?3:2)*TS-2)}

// ---------- building something new: pick its plot ----------
let RTP=null;
const rtKind=k=>!!FAC[k]||YARD_T.has(k);
{const o=previewPlace;previewPlace=function(x,y,k){RTP=null;o.apply(this,arguments);if(RTON&&placePlan&&placePlan.x===x&&placePlan.y===y&&rtKind(k)){const d=siteAt(x,y);RTP={x,y,k,c:ydCands(x,y,k,0,d&&d.type==='dep'?d:null),i:0};placeBar()}}}
{const o=placeBar;placeBar=function(){o.apply(this,arguments);try{if(!RTON||!placePlan||!RTP||RTP.x!==placePlan.x||RTP.y!==placePlan.y||RTP.k!==placePlan.k)return;const el=document.getElementById('cfTxt');if(!el||!el.innerHTML)return;
  el.innerHTML+=RTP.c.length?'<br><small style="color:#bfe6ff">🛤 Comes with 2 loading tracks of its own on 2 × 4 squares, plus '+(RTP.k==='farm'?'a row of fields kept free for it to grow':'a row kept free for the tracks its upgrades add')+'. Join its line at either end.</small>'+(RTP.c.length>1?' <button onclick="rtTurn()" style="margin-left:4px;padding:4px 9px;border-radius:8px;border:1px solid #7fb6d3;background:#1f2a2f;color:#bfe6ff;font-weight:700">↻ Turn</button>':''):'<br><small style="color:#ffb36b">⚠ No room here for its loading tracks (needs 3 × 4 open squares beside a straight line), so it gets a small one-track siding. Pick another square for the full yard.</small>'}catch(e){}}}
function rtTurn(){if(!RTP||!RTP.c.length)return;RTP.i=(RTP.i+1)%RTP.c.length;placeBar()}
if(typeof window!=='undefined')window.rtTurn=rtTurn;
function rtPick(x,y,k){if(!RTON||!rtKind(k))return null;const d=siteAt(x,y);const C=ydCands(x,y,k,0,d&&d.type==='dep'?d:null);if(!C.length)return null;if(RTP&&RTP.x===x&&RTP.y===y&&RTP.k===k&&RTP.c[RTP.i]){const p=RTP.c[RTP.i];const m=C.find(q=>q.hz===p.hz&&q.sd===p.sd&&q.u0===p.u0);if(m)return m}return C[0]}
{const o=buildInd;buildInd=function(x,y,k){const pk=rtPick(x,y,k);const r=o.apply(this,arguments);if(r&&pk){const s=siteAt(x,y);if(s&&!s.yd){ydApply(s,pk,0);save()}}RTP=null;return r}}
{const o=buildFac;buildFac=function(x,y,k){const pk=rtPick(x,y,k);const r=o.apply(this,arguments);if(r&&pk){const s=siteAt(x,y);if(s&&!s.yd){ydApply(s,pk,0);save()}}RTP=null;return r}}
{const o=removeSite;removeSite=function(){const r=o.apply(this,arguments);S.ydn=(S.ydn||0)+1;YFK='';return r}}
// the plot shown before you confirm: loading tracks, building row and the kept row
{const o=drawFoot;drawFoot=function(x,y,k){o.apply(this,arguments);try{if(!RTON||!RTP||RTP.x!==x||RTP.y!==y||!RTP.c.length)return;const p=RTP.c[RTP.i],lr=p.hz?y-p.sd:x-p.sd,T=(u,r)=>p.hz?[u,lr+p.sd*r]:[lr+p.sd*r,u],a=.55+.3*Math.sin(performance.now()/180);
  for(let r=0;r<=3;r++)for(let u=p.u0;u<p.u0+4;u++){const[X,Y]=T(u,r);ctx.fillStyle=r===0?`rgba(255,255,255,${a*.25})`:r===1?`rgba(120,200,255,${a*.4})`:r===2?`rgba(255,210,120,${a*.4})`:`rgba(255,255,255,${a*.18})`;ctx.fillRect(X*TS+1,Y*TS+1,TS-2,TS-2)}
  {const A=T(p.u0,1),B=T(p.u0+3,3),x0=Math.min(A[0],B[0]),y0=Math.min(A[1],B[1]),x1=Math.max(A[0],B[0]),y1=Math.max(A[1],B[1]);ctx.setLineDash([6,4]);ctx.strokeStyle='#ffd27a';ctx.lineWidth=2;ctx.strokeRect(x0*TS+1,y0*TS+1,(x1-x0+1)*TS-2,(y1-y0+1)*TS-2);ctx.setLineDash([])}
  ctx.font='bold 10px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';const L1=T(p.u0+1.5,1),L2=T(p.u0+1.5,2),L3=T(p.u0+1.5,3),L0=T(p.u0+1.5,0);
  const lab=(q,t)=>{const X=(q[0]+.5)*TS,Y=(q[1]+.5)*TS;ctx.save();ctx.translate(X,Y);if(!p.hz)ctx.rotate(-Math.PI/2);ctx.fillStyle='rgba(20,15,10,.75)';const w=ctx.measureText(t).width+8;ctx.fillRect(-w/2,-7,w,14);ctx.fillStyle='#fff';ctx.fillText(t,0,0);ctx.restore()};
  lab(L0,'its line');lab(L1,'2 loading tracks');lab(L2,'building');lab(L3,RTP.k==='farm'?'more fields':'kept for upgrades')}catch(e){}}}

// crates fly to and from the building itself, not its stub square on the line
{const o=fxCrates;fxCrates=function(X,t,k,toSite){if(!RTON||!X||!ydOK(X)||typeof trainXY!=='function'||CRATES.length>160)return o.apply(this,arguments);const[tx,ty]=trainXY(t),[sx,sy]=ydCenter(X);for(let i=0;i<4;i++)CRATES.push({a:toSite?[tx,ty]:[sx,sy],b:toSite?[sx,sy]:[tx,ty],k,t0:performance.now()+i*130,d:520})}}

// linking a yard building: plan from either end of its own line (its sides are kept free), take the cheaper
{const o=planRoute;planRoute=function(tx,ty,site){if(!RTON||!site||!ydOK(site))return o.apply(this,arguments);const G=ydG(site);let best=null;
 for(const u of[G.u0-1,G.u0+4]){const[x,y]=G.hz?[u,G.lr]:[G.lr,u];if(!rev[id(x,y)])continue;let p=null;try{p=o.call(this,x,y,site)}catch(e){}if(!p)continue;if(!track.has(id(x,y))&&!p.includes(id(x,y)))p.push(id(x,y));const c=connectCost(p).m;if(!best||c<best.c)best={p,c}}
 return best?best.p:o.apply(this,arguments)}}

// junction curves stay once they exist, and a trip's curves are laid down when the trip is planned (not when the train arrives)
const rtTK=(i,A,B)=>i+'|'+A[0]+','+A[1]+'|'+B[0]+','+B[1];
function rtAddT(i,A,B){if(!TURNS.has(i))TURNS.set(i,new Set());const T=TURNS.get(i),k1=A[0]+','+A[1]+'|'+B[0]+','+B[1];if(T.has(k1))return;T.add(k1);T.add(B[0]+','+B[1]+'|'+A[0]+','+A[1]);S.tn=S.tn||[];S.tn.push(rtTK(i,A,B))}
function rtNoteIds(L){for(let c=1;c<L.length-1;c++){const C=L[c],a=L[c-1],b=L[c+1],cx=C%N,cy=(C/N)|0,A=[a%N-cx,((a/N)|0)-cy],B=[b%N-cx,((b/N)|0)-cy];if(A[0]===B[0]||A[1]===B[1])continue;rtAddT(C,A,B)}}
{const o=noteTurns;noteTurns=function(){const keep=TURNS;o.apply(this,arguments);if(TURNS!==keep){for(const[i,T]of keep){if(!TURNS.has(i))TURNS.set(i,new Set());for(const k of T)TURNS.get(i).add(k)}}
 if(!rtNoteIds._ld){rtNoteIds._ld=1;for(const k of S.tn||[]){const[i,a,b]=k.split('|');const T=TURNS.get(+i)||new Set();T.add(a+'|'+b);T.add(b+'|'+a);TURNS.set(+i,T)}}
 for(const t of S.trains){if(t.legs&&t.legs!==t._tnL){rtNP(t,'_tnL',t.legs);for(const g of t.legs)rtNoteIds(g.t)}const P=t.path;if(P&&P!==t._tnP&&P.length>2){rtNP(t,'_tnP',P);rtNoteIds(P.map(rtI))}}}}
// a building on a corner: one curved track runs through it (in one side, out the open end), no stub spur or second lane
{const o=drawYard;drawYard=function(s,X,Y,Yd){if(!RTON||!Yd||!(Yd.sides||[]).length||Yd.ends[0]===Yd.ends[1])return o.apply(this,arguments);
 const c=ctx,H=TS/2,sw=Yd.sides[0],sl=Yd.hz?sw:-sw,dir=Yd.ends[1]?1:-1;c.save();c.translate(X,Y);if(!Yd.hz)c.rotate(Math.PI/2);
 const P=[];for(let k=0;k<=16;k++){const t=k/16,u=1-t;P.push([2*u*t*0+t*t*dir*H,u*u*sl*H])}
 const nrm=k=>{const A=P[Math.max(0,k-1)],B=P[Math.min(16,k+1)],an=Math.atan2(B[1]-A[1],B[0]-A[0]);return[-Math.sin(an),Math.cos(an)]};
 const sd=Yd.hz?Yd.side:-Yd.side;c.fillStyle='#cdb991';c.beginPath();c.arc(-dir*H,sd*H,H*.9,0,7);c.fill();
 c.strokeStyle='#5a4b3b';c.lineWidth=17;c.lineCap='butt';c.beginPath();P.forEach((q,k)=>k?c.lineTo(q[0],q[1]):c.moveTo(q[0],q[1]));c.stroke();
 c.strokeStyle='#5b4128';c.lineWidth=3;for(let k=1;k<16;k+=2){const[nx,ny]=nrm(k);c.beginPath();c.moveTo(P[k][0]-nx*7,P[k][1]-ny*7);c.lineTo(P[k][0]+nx*7,P[k][1]+ny*7);c.stroke()}
 c.strokeStyle='#b9b2a6';c.lineWidth=2;for(const g of[-4,4]){c.beginPath();P.forEach((q,k)=>{const[nx,ny]=nrm(k);k?c.lineTo(q[0]+nx*g,q[1]+ny*g):c.moveTo(q[0]+nx*g,q[1]+ny*g)});c.stroke()}
 c.restore()}}
// ===================== v276 REAL RAILS (Sébastien 2026-11-14, "Build it as shown. Ensure the rails are smooth like real life") =====================
// One geometry for drawing AND driving. Every track square holds the rails that exist there: straights (when track continues on both sides),
// a curve on a plain corner, and at junctions the turnouts that were built (a new branch gets both turnouts; turns trains have used stay).
// Trains may only take rails that exist (planner), and both the map and the trains use the same curve for every turn:
//   radius 2 squares where two straight squares lead in and out (gentle turnout, like the real thing),
//   radius 1 square where one does, otherwise a tight quarter circle inside the square.
// The map draws each rail by sampling the very function that places trains (ptAt + laneAt), so wheels can never leave the drawn rail.
const RG={on:true};
{const DI=D4,opp=q=>q^1,ax=q=>q>>1;
 let VER='',CN=new Map(),RR=new Map(),PL=new Map(),TP=new Map(),STN=null;
 const ver=()=>track.size+'/'+dblSet.size+'/'+sites.length+'/'+laneSet.size+'/'+((S.tn||[]).length)+'/'+(S.ydn||0)+'/'+(typeof TURNS!=='undefined'?TURNS.size:0)+'/'+sites.reduce((n,o)=>n+(o.type==='town'&&(o.pop>0||o.beacon)&&!o.hidden?1:0),0);/* v282: no timed refresh (it rebuilt every rail piece every 3 s: a visible stutter) */
 const chk=()=>{const v=ver();if(v!==VER){VER=v;CN=new Map();RR=new Map();PL=new Map();TP=new Map();STN=null}};
 const stn=i=>{if(!STN){STN=new Set();try{for(const j of track){const x=j%N,y=(j/N)|0;if(stnAt(x,y))STN.add(j)}}catch(e){}}return STN.has(i)};
 const tkey=(a,b)=>a<b?a+'|'+b:b+'|'+a;
 const nbOK=j=>{const x=j%N,y=(j/N)|0;return isRail(x,y)&&!laneSet.has(j)&&!(typeof ydStubAt==='function'&&ydStubAt(x,y))};
 // the rails in one square
 function conn(i){chk();let c=CN.get(i);if(c)return c;const x=i%N,y=(i/N)|0,nb=[];for(let q=0;q<4;q++){const nx=x+DI[q][0],ny=y+DI[q][1];if(nx<0||ny<0||nx>=N||ny>=N)continue;if(nbOK(id(nx,ny)))nb.push(q)}
  const has=q=>nb.includes(q),st=[has(0)&&has(1),has(2)&&has(3)],tu=new Set();
  if(nb.length===2&&ax(nb[0])!==ax(nb[1]))tu.add(tkey(nb[0],nb[1]));
  else if(nb.length>=3){const used=(a,b)=>typeof turnUsed==='function'&&turnUsed(i,DI[a],DI[b]);const LN={};for(const a of nb)LN[a]=!st[ax(a)]&&!nb.some(b=>ax(b)!==ax(a)&&used(a,b));const lone=a=>LN[a];
   for(const a of nb)for(const b of nb){if(a>=b||ax(a)===ax(b))continue;if(used(a,b)||lone(a)||lone(b)){tu.add(tkey(a,b));if(!used(a,b)&&typeof rtAddT==='function')rtAddT(i,DI[a],DI[b])}}}
  c={nb,st,tu};CN.set(i,c);return c}
 // plain track: no building, station, ferry, yard stub, and not beside a town (town squares stay as they were)
 function plain(i){chk();let p=PL.get(i);if(p!==undefined)return p;const x=i%N,y=(i/N)|0;p=track.has(i)&&!siteAt(x,y)&&!stn(i)&&!laneSet.has(i)&&!(typeof ydStubAt==='function'&&ydStubAt(x,y))&&!(typeof ydFoot==='function'&&ydFoot(i))&&!DI.some(([dx,dy])=>{const q=siteAt(x+dx,y+dy);return q&&q.type==='town'&&!q.hidden});PL.set(i,p);return p}
 const dbl=i=>isDblD(i%N,(i/N)|0);
 const step=(i,q,n=1)=>{const x=i%N+DI[q][0]*n,y=((i/N)|0)+DI[q][1]*n;return x<0||y<0||x>=N||y>=N?-1:id(x,y)};
 const turnsVia=(i,q)=>{const c=conn(i),out=[];for(const k of c.tu){const[a,b]=k.split('|').map(Number);if(a===q)out.push(b);else if(b===q)out.push(a)}return out};
 // the radius of a turn at square i between edges a and b (in squares): 2, 1 or 0.5
 function R(i,a,b){chk();const K=i*16+a*4+b;let r=RR.get(K);if(r!==undefined)return r;r=.5;
  if(plain(i)){const d=dbl(i);const leg1=L=>{const n1=step(i,L),n2=step(i,L,2);if(n1<0||n2<0||!plain(n1)||!conn(n1).st[ax(L)]||turnsVia(n1,opp(L)).length||!nbOK(n2))return false;return true};
   const leg2=L=>{const n1=step(i,L),n2=step(i,L,2),n3=step(i,L,3);if(n3<0||conn(n1).tu.size||!plain(n2)||!conn(n2).st[ax(L)]||turnsVia(n2,opp(L)).length||!nbOK(n3))return false;if(turnsVia(n3,opp(L)).length)return false;return true};
   if(leg1(a)&&leg1(b))r=leg2(a)&&leg2(b)?2:1;
   // v278: a single branch joining double track: keep the turnouts short so the two lanes' curves don't spread into a web
   if(r>1&&d){const c=conn(i),br=[a,b].find(q=>!c.st[ax(q)]);if(br!==undefined){const j=step(i,br);if(j>=0&&!dbl(j))r=1}}}
  RR.set(K,r);RR.set(i*16+b*4+a,r);return r}
 RG.conn=conn;RG.R=R;RG.plain=plain;
 // may a train arriving through edge a leave through edge b?
 RG.ok=(i,a,b)=>{if(!plain(i)||ax(a)===ax(b))return true;return conn(i).tu.has(tkey(a,b))};
 const dirOf=(A,B)=>{const dx=B[0]-A[0],dy=B[1]-A[1];return dx===1?0:dx===-1?1:dy===1?2:dy===-1?3:-1};
 // a point along a path (in squares), with heading: the single geometry shared by trains and the map
 RG.pt=function(P,s){const L=P.length;if(L<2){const a=P[0];return[(a[0]+.5)*TS,(a[1]+.5)*TS,0]}s=Math.max(0,Math.min(L-1,s));const c=Math.round(s);
  for(let k=Math.max(1,c-2);k<=Math.min(L-2,c+2);k++){const C=P[k],p=P[k-1],n=P[k+1],a=dirOf(C,p),b=dirOf(C,n);if(a<0||b<0||ax(a)===ax(b))continue;const r=R(id(C[0],C[1]),a,b);if(r<1||Math.abs(s-k)>r)continue;
   const d1=DI[a],d2=DI[b],ox=C[0]+r*(d1[0]+d2[0]),oy=C[1]+r*(d1[1]+d2[1]),b0=Math.atan2(-d2[1],-d2[0]),b1=Math.atan2(-d1[1],-d1[0]);/* v280: arc starts on the side the train comes from (was mirrored) */let e=b1-b0;if(e>Math.PI)e-=2*Math.PI;if(e<-Math.PI)e+=2*Math.PI;const u=(s-(k-r))/(2*r),an=b0+e*u;
   return[(ox+r*Math.cos(an)+.5)*TS,(oy+r*Math.sin(an)+.5)*TS,an+Math.sign(e)*Math.PI/2]}
  const p=P[c-1],n=P[c+1],C=P[c];
  if(p&&n){const d1x=p[0]-C[0],d1y=p[1]-C[1],d2x=n[0]-C[0],d2y=n[1]-C[1];if(Math.abs(d1x)+Math.abs(d1y)===1&&Math.abs(d2x)+Math.abs(d2y)===1&&d1x*d2x+d1y*d2y===0){const u=s-(c-.5),ox=C[0]+(d1x+d2x)/2,oy=C[1]+(d1y+d2y)/2;
   const b0=Math.atan2(-d2y,-d2x),b1=Math.atan2(-d1y,-d1x);let e=b1-b0;if(e>Math.PI)e-=2*Math.PI;if(e<-Math.PI)e+=2*Math.PI;const a=b0+e*u;return[(ox+.5*Math.cos(a)+.5)*TS,(oy+.5*Math.sin(a)+.5)*TS,a+Math.sign(e)*Math.PI/2]}}
  const i=Math.min(L-2,Math.max(0,Math.floor(s))),f=s-i,a=P[i],b=P[i+1]||a;return[(a[0]+(b[0]-a[0])*f+.5)*TS,(a[1]+(b[1]-a[1])*f+.5)*TS,Math.atan2(b[1]-a[1],b[0]-a[0])]};
 // ---- drawing: sample the train geometry along short made-up paths, one per rail piece ----
 const xy=i=>[i%N,(i/N)|0];
 function sample(P,s0,s1){const out=[],n=Math.max(4,Math.ceil(Math.abs(s1-s0)*10));const run=(Q,f)=>{const pts=[];let any=false;for(let k=0;k<=n;k++){const s=f(s0+(s1-s0)*k/n),[x,y,a]=RG.pt(Q,s),o=laneAt(Q,s);if(Math.abs(o)>.01)any=true;pts.push([x-Math.sin(a)*o,y+Math.cos(a)*o])}return{pts,any}};
  const A=run(P,s=>s);if(!A.any){out.push(A.pts);return out}const Rv=P.slice().reverse(),B=run(Rv,s=>P.length-1-s);out.push(A.pts,B.pts.reverse());return out}
 const line=(i,q,from,to)=>{// tiles along axis q through i: from steps back to `to` steps ahead (only while rail)
  const P=[];for(let k=-from;k<=to;k++){const j=step(i,q,k);if(j<0||(k!==0&&!nbOK(j))){if(k<0){P.length=0;continue}break}P.push(xy(j))}return P};
 const allR=(C,edge,f)=>{const T=turnsVia(C,edge);return T.length>0&&T.every(b=>f(R(C,edge,b)))};
 const bare=(C,q)=>C>=0&&plain(C)&&!conn(C).st[ax(q)];
 // is the half of square i toward q replaced by a curve (so no straight rail is laid there)?
 function covered(i,q){const C1=step(i,q),C2=step(i,q,2),C0=step(i,q,-1);
  if(bare(C1,q)&&allR(C1,opp(q),r=>r>=1))return true;// a curve at the next square starts at my middle
  if(C1>=0&&plain(C1)&&bare(C2,q)&&allR(C2,opp(q),r=>r===2))return true;// a wide curve two squares on starts at my middle
  if(bare(C0,q)&&allR(C0,q,r=>r===2))return true;// a wide curve behind me runs through my whole square
  return false}
 function pieces(i){chk();let pc=TP.get(i);if(pc)return pc;pc=[];const c=conn(i),[x,y]=xy(i),nb=c.nb;
  if(!nb.length){pc.push([[x*TS,y*TS+TS/2],[x*TS+TS,y*TS+TS/2]]);TP.set(i,pc);return pc}
  const axes=new Set();for(let a=0;a<2;a++)if(c.st[a])axes.add(a);if(nb.length===1)axes.add(ax(nb[0]));
  for(const a of axes)for(const q of[2*a,2*a+1]){
   if(nb.length===1&&q!==nb[0]){const P=line(i,nb[0],0,2);const cx=(x+.5)*TS,cy=(y+.5)*TS;for(const p of sample(P,0,.5))pc.push(p.map(([px,py])=>ax(q)===0?[2*cx-px,py]:[px,2*cy-py]));continue}// a dead end: a short stub with buffers
   if(covered(i,q))continue;
   const P=line(i,q,2,2),k=P.findIndex(p=>p[0]===x&&p[1]===y);if(k<0)continue;for(const p of sample(P,k,Math.min(P.length-1,k+.5)))pc.push(p)}
  for(const key of c.tu){const[a,b]=key.split('|').map(Number),r=R(i,a,b),m=Math.ceil(r)+1;const A=[],B=[];for(let k=m;k>=1;k--){const j=step(i,a,k);if(j>=0&&nbOK(j))A.push(xy(j));else A.length=0}for(let k=1;k<=m;k++){const j=step(i,b,k);if(j<0||!nbOK(j))break;B.push(xy(j))}
   const P=A.concat([[x,y]],B),k=A.length;for(const p of sample(P,k-r,k+r))pc.push(p)}
  TP.set(i,pc);return pc}
 RG.segs=function(SEG,x0,y0,x1,y1){for(const i of track){const x=i%N,y=(i/N)|0;if(x<x0-3||x>x1+3||y<y0-3||y>y1+3)continue;if(terr[i]===0){ctx.fillStyle='#6b4f30';ctx.fillRect(x*TS+3,y*TS+3,TS-6,TS-6)}const p=pieces(i);if(p.length)SEG.push(p);if(typeof JAM!=='undefined'&&JAM[i]>4&&!isDblD(x,y))SEG.push({jam:i,cx:x*TS+TS/2,cy:y*TS+TS/2})}};
 RG.pieces=pieces;
 RG.bad=(P,from)=>{for(let j=Math.max(1,from);j<P.length-1;j++){const a=dirOf(P[j],P[j-1]),b=dirOf(P[j],P[j+1]);if(a<0||b<0)continue;if(!RG.ok(id(P[j][0],P[j][1]),a,b))return true}return false};
}
{const o=ptAt;ptAt=function(P,s){if(!RG.on)return o.apply(this,arguments);return RG.pt(P,s)}}
// a switch is built the first time a train's planned trip needs it (the planner prefers existing rails), so only used curves are drawn.
// Saves from the first preview had every possible switch built: clear those once.
function rgV277(){if(S.rgV===277)return;S.rgV=277;S.tn=[];try{TURNS.clear()}catch(e){}}
{const o=rtTickEnd;rtTickEnd=function(){if(RG.on)rgV277();return o.apply(this,arguments)}}
// ---- every building gets its own yard: a building with no room where it stands moves (free) to the nearest spot with room ----
// Mines and wells stay on their deposit (they keep a one-track siding if there is no room). The old square stays as plain track
// when a line ran through it. Runs once per save.
RG.moved=[];
function rgDeg(x,y){return D4.filter(([dx,dy])=>isRail(x+dx,y+dy)&&!laneSet.has(id(x+dx,y+dy))).length}
// remove a dead-end spur that led to nothing, one square at a time from (x,y), stopping at a junction, a building or a train
function rgPrune(x,y,keep){let n=0;for(let g=0;g<40;g++){const i=id(x,y);if(!track.has(i)||siteAt(x,y)||keep.has(i)||ydFoot(i)||(typeof ydStubAt==='function'&&ydStubAt(x,y)))break;if(S.trains.some(t=>t.path&&t.path.some(p=>p[0]===x&&p[1]===y)))break;
  const nb=D4.filter(([dx,dy])=>isRail(x+dx,y+dy)&&!laneSet.has(id(x+dx,y+dy)));if(nb.length>1)break;track.delete(i);dblSet.delete(i);n++;if(!nb.length)break;x+=nb[0][0];y+=nb[0][1]}return n}
function rgMoveAll(){if(S.rgMv===277)return;const redo=S.rgMv===276;S.rgMv=277;if(redo)return;if(typeof ydConvert==='function')ydConvert();const MOV=new Set(['wood','farm','stone']);
 for(const s of sites){if(!isYard(s)||s.hidden||ydOK(s)||s.yd)continue;const fac=isFac(s),pin=!fac&&!MOV.has(s.type);// mines and wells: the building stays on its deposit, the yard is laid beside it
  const ox=s.x,oy=s.y,oi=id(ox,oy),nb0=D4.filter(([dx,dy])=>isRail(ox+dx,oy+dy)).map(([dx,dy])=>[ox+dx,oy+dy]);
  // every spot within 7 squares with room for a yard, cheapest first: line squares already track, short or no new track, close by
  if(pin&&nb0.length!==1)continue;const TA=new Set(track),DA=new Set(dblSet);let spur=[];
  if(pin){// lift the mine's old spur while looking for room (it is replaced by the yard's own line)
   let[cx,cy]=nb0[0],px=ox,py=oy;for(let g=0;g<20;g++){const ci=id(cx,cy);if(!track.has(ci)||siteAt(cx,cy))break;const nx=D4.map(([dx,dy])=>[cx+dx,cy+dy]).filter(([a,b])=>(a!==px||b!==py)&&isRail(a,b));if(nx.length!==1)break;spur.push(ci);px=cx;py=cy;[cx,cy]=nx[0]}
   for(const j of spur){track.delete(j);dblSet.delete(j)}YFK=''}
  const cand=[];for(let y=oy-7;y<=oy+7;y++)for(let x=ox-7;x<=ox+7;x++){if(x<2||y<2||x>=N-2||y>=N-2)continue;if(pin?(x!==ox||y!==oy):(x===ox&&y===oy))continue;const i=id(x,y);if(!pin&&(track.has(i)||siteAt(x,y)||!rev[i]))continue;
   let bad='';if(!pin)try{bad=fac?siteSpot(x,y):indSpot(x,y,s.type)}catch(e){bad='x'}if(bad)continue;for(const c of ydCands(x,y,s.type,0,pin?s:null)){const lr=c.hz?y-c.sd:x-c.sd;let nl=0;for(let u=c.u0-1;u<=c.u0+4;u++){const[a,b]=c.hz?[u,lr]:[lr,u];if(!track.has(id(a,b)))nl++}cand.push({x,y,c,nl,v:nl*3+Math.hypot(x-ox,y-oy)-c.sc*.5})}}
  cand.sort((a,b)=>a.v-b.v);let done=false;
  for(const q of cand.slice(0,12)){if(done)break;const{x,y,c}=q;
   const T0=new Set(track),D0=new Set(dblSet),deg=nb0.length,thru=deg>=2&&!pin;
   s.x=x;s.y=y;delete s.yd;YFK='';if(thru&&!pin)track.add(oi);
   try{ydApply(s,c,0)}catch(e){}computeNet();const G=ydG(s);const endOn=u=>{const[a,b]=G.hz?[u,G.lr]:[G.lr,u];return!!(NET&&NET[id(a,b)])};const on=()=>endOn(G.u0-1)||endOn(G.u0+4);
   let extra=0;if(!on()){let p=null;try{p=planRoute(x,y,s)}catch(e){}if(p&&p.length<=5){for(const j of p)if(!track.has(j)){track.add(j);extra++}computeNet()}}
   if(ydOK(s)&&on()&&extra+q.nl<=10){done=true;
    // tidy: the old spur that only led to the building goes, and so does a new line end that leads nowhere
    const keep=new Set(G.span);if(!thru||pin)for(const[a,b]of nb0)rgPrune(a,b,keep);
    for(const u of[G.u0-1,G.u0+4]){const[a,b]=G.hz?[u,G.lr]:[G.lr,u];if(!T0.has(id(a,b))&&rgDeg(a,b)<=1){track.delete(id(a,b))}}
    computeNet();RG.moved.push({t:s.type,from:[ox,oy],to:[x,y]});
    const SP=new Set(spur);for(const t of S.trains){const P=t.path;if(!P||!P.length)continue;const e=P[P.length-1];if(e[0]===ox&&e[1]===oy||P.some(q=>SP.has(id(q[0],q[1])))){const f=P[Math.min(P.length-1,Math.max(0,Math.floor(t.pos)))],cur=id(f[0],f[1]);const np=pathTo(bfs(cur),id(x,y));if(np){t.path=np;t.pos=0}}}}
   else{(RG.fail=RG.fail||[]).push(s.type+'@'+ox+','+oy+' c'+JSON.stringify(c)+' ok'+ydOK(s)+' on'+on()+' ex'+extra+' nl'+q.nl);track.clear();for(const j of T0)track.add(j);dblSet.clear();for(const j of D0)dblSet.add(j);s.x=ox;s.y=oy;delete s.yd;S.ydn=(S.ydn||0)+1;YFK='';computeNet()}}
  if(!done&&spur.length){track.clear();for(const j of TA)track.add(j);dblSet.clear();for(const j of DA)dblSet.add(j);YFK='';computeNet()}}
 S.dbl=[...dblSet];S.ydn=(S.ydn||0)+1;YFK='';try{computeNet();save()}catch(e){}}
{const o=rtTickEnd;rtTickEnd=function(){if(RG.on&&S.rgMv!==277)rgMoveAll();return o.apply(this,arguments)}}
// v278 tidy (Sébastien 2026-11-14 "still seeing track issues"): bits of old track left where buildings moved - a 2x2 ring,
// short stubs that lead nowhere, and access squares a building no longer needs (it touches the line elsewhere). Runs once per save.
function rgTidy(){if(S.rgT===278)return;S.rgT=278;let n=0;const gone=new Set();
 const fixed=j=>{const x=j%N,y=(j/N)|0;return siteAt(x,y)||laneSet.has(j)||ydFoot(j)||ydStubAt(x,y)||(typeof stnAt==='function'&&stnAt(x,y))};
 const span=()=>{const s=new Set();for(const o of sites)if(o.yd&&ydOK(o)){const G=ydG(o);for(const j of G.span)s.add(j);s.add(G.tileAt(G.u0-1));s.add(G.tileAt(G.u0+4))}return s};
 const tn=(x,y)=>D4.map(([dx,dy])=>[x+dx,y+dy]).filter(([a,b])=>track.has(id(a,b))&&!laneSet.has(id(a,b)));
 const sn=(x,y)=>D4.map(([dx,dy])=>[x+dx,y+dy]).filter(([a,b])=>siteAt(a,b));
 const del=j=>{track.delete(j);dblSet.delete(j);gone.add(j);n++};
 // a yard's own line must be whole (one save had its first square missing, leaving the line floating)
 for(const o of sites)if(o.yd&&ydOK(o)){const G=ydG(o);for(const j of G.span)if(!track.has(j)){track.add(j);n++}}
 for(let pass=0;pass<4;pass++){const SP=span();let ch=0;
  // a 2x2 ring: squares with no way out of the block go
  for(const j of[...track]){if(!track.has(j))continue;const x=j%N,y=(j/N)|0;if(![id(x+1,y),id(x,y+1),id(x+1,y+1)].every(k=>track.has(k)))continue;
   const B=[[x,y],[x+1,y],[x,y+1],[x+1,y+1]];for(const[a,b]of B){const k=id(a,b);if(fixed(k)||SP.has(k))continue;
    const out=D4.some(([dx,dy])=>{const u=a+dx,v=b+dy;if(B.some(([p,q])=>p===u&&q===v))return false;return isRail(u,v)});if(!out){del(k);ch++;break}}}
  for(const j of[...track]){if(!track.has(j)||fixed(j)||SP.has(j))continue;const x=j%N,y=(j/N)|0,T=tn(x,y),Sn=sn(x,y);
   // an access square a building no longer needs: it already has a yard, or it touches other track
   if(T.length===1&&Sn.length&&Sn.every(([a,b])=>{const s=siteAt(a,b);if(s.type==='port'||s.type==='dep'||s.type==='town'||s.type==='plot')return false;return(s.yd&&ydOK(s))||D4.some(([dx,dy])=>{const u=a+dx,v=b+dy;return(u!==x||v!==y)&&track.has(id(u,v))})})){del(j);ch++;continue}
   // a short stub (up to 3 squares) to nowhere
   if(T.length===1&&!Sn.length){const ch3=[j];let px=x,py=y,[cx,cy]=T[0];for(let g=0;g<3;g++){const ci=id(cx,cy);if(fixed(ci)||SP.has(ci))break;const nt=tn(cx,cy).filter(([a,b])=>a!==px||b!==py);if(sn(cx,cy).length||nt.length!==1)break;ch3.push(ci);px=cx;py=cy;[cx,cy]=nt[0]}
    const end=id(cx,cy);if(ch3.length<=3&&track.has(end)&&tn(cx,cy).length>=3-(ch3.length>=1?0:0)){for(const k of ch3)del(k);ch++}}}
  if(!ch)break}
 if(n){S.dbl=[...dblSet];S.ydn=(S.ydn||0)+1;YFK='';try{computeNet()}catch(e){}
  for(const t of S.trains){const P=t.path;if(!P||!P.length)continue;if(!P.some(q=>gone.has(id(q[0],q[1]))))continue;const f=P[Math.min(P.length-1,Math.max(0,Math.floor(t.pos)))],cur=id(f[0],f[1]),e=P[P.length-1];
   if(gone.has(cur)){const nb=D4.map(([dx,dy])=>[f[0]+dx,f[1]+dy]).find(([a,b])=>isRail(a,b));if(nb){t.path=[nb];t.pos=0}continue}
   const np=pathTo(bfs(cur),id(e[0],e[1]));if(np){t.path=np;t.pos=0}}
  // a mine that only now has a single way in gets another try at a full yard
  S.rgMv=0;try{rgMoveAll()}catch(e){S.rgMv=277}
  try{save()}catch(e){}}
 RG.tidy=n}
{const o=rtTickEnd;rtTickEnd=function(){if(RG.on&&S.rgMv===277&&S.rgT!==278)rgTidy();return o.apply(this,arguments)}}

// v281 repair: the v278 tidy could lift two opposite corners of a 2x2 ring, cutting the line in two (two dead ends side by side, diagonal).
// Put the missing corner back. Runs once per save.
function rgRepair(){if(S.rgR===281)return;S.rgR=281;let n=0;
 const deg=(x,y)=>D4.filter(([dx,dy])=>isRail(x+dx,y+dy)&&!laneSet.has(id(x+dx,y+dy))).length;
 const dead=(x,y)=>track.has(id(x,y))&&!siteAt(x,y)&&deg(x,y)===1;
 for(const j of[...track]){const x=j%N,y=(j/N)|0;if(!dead(x,y))continue;
  for(const[dx,dy]of[[1,1],[1,-1],[-1,1],[-1,-1]]){const bx=x+dx,by=y+dy;if(!dead(bx,by))continue;
   for(const[cx,cy]of[[bx,y],[x,by]]){const ci=id(cx,cy);if(track.has(ci)||siteAt(cx,cy)||!landTile(cx,cy)||(typeof ydBan==='function'&&ydBan(ci)))continue;track.add(ci);n++;break}}}
 if(n){S.ydn=(S.ydn||0)+1;YFK='';try{computeNet();save()}catch(e){}}RG.rep=n}
{const o=rtTickEnd;rtTickEnd=function(){if(RG.on&&S.rgT===278&&S.rgR!==281)rgRepair();return o.apply(this,arguments)}}
// ===================== v282 TRAINS KEEP THEIR RAIL (Sébastien 2026-11-14: "They slide from one rail to another") =====================
// On double track a train keeps to one side for its direction. When it reversed, its lane was worked out again for the new direction,
// so it slid over to the other track. Now a reversing train stays on the rail it is on (it runs "wrong line"), and goes back to its own
// side at the next single-track square, or over a crossover on a plain stretch of double track (the crossover is then built and drawn).
let LXT=null;
function rxMul(t,P,s){const x=t.xo;if(x&&x.P===P){if(s<=x.s0)return-1;if(s>=x.s0+(x.w||0))return 1;const u=(s-x.s0)/x.w;return-1+2*u*u*(3-2*u)}return t.lx===-1?-1:1}
{const o=laneAt;laneAt=function(P,s){const v=o(P,s);if(!v||!LXT||!RG.on)return v;return v*rxMul(LXT,P,s)}}
{const o=railPt;railPt=function(P,s,t){const k=LXT;LXT=t||null;try{return o.apply(this,arguments)}finally{LXT=k}}}
// on a new path the train keeps the rail it stands on: pick the side (own side or wrong line) that matches where it is drawn now
{const o=rtSetPath;rtSetPath=function(t,P,pos,keepX){if(!RG.on||!t.path||t.path.length<2||!P||P.length<2||!keepX)return o.apply(this,arguments);
  let a=null;try{a=railPt(t.path,keepX[0],t)}catch(e){}const xo0=t.xo,lx0=t.lx;t.xo=null;let best=null;
  if(a)for(const L of[undefined,-1]){t.lx=L;try{const b=railPt(P,keepX[1],t),d=Math.hypot(a[0]-b[0],a[1]-b[1]);if(!best||d<best.d-.01)best={L,d,x:a[0]-b[0],y:a[1]-b[1]}}catch(e){}}
  t.lx=best?best.L:lx0;if(!best)t.xo=xo0;const r=o.call(this,t,P,pos,null);if(best&&best.d>1&&best.d<40)rtNP(t,'_gl',{x:best.x,y:best.y,t0:performance.now()});return r}}
// where a wrong-line train goes back to its own side: the next single-track square (no rail change needed), or a crossover
function rxPlan(t){if(t.lx!==-1||!t.path||t.path.length<3)return;const P=t.path;if(t.xo&&t.xo.P===P){if(t.pos-rtLt(t)>t.xo.s0+(t.xo.w||0)+.2){t.xo=null;t.lx=undefined}return}t.xo=null;
 const dbl=q=>isDblD(q[0],q[1]),c0=Math.max(1,Math.ceil(t.pos+.6));
 for(let k=c0;k<Math.min(P.length-1,c0+8);k++){const q=P[k];if(!dbl(q)){t.xo={P,s0:k,w:0};return}
  const i=id(q[0],q[1]),a=P[k-1],b=P[k+1];if(!a||!b||!dbl(a)||!dbl(b))continue;if(a[0]!==b[0]&&a[1]!==b[1])continue;
  if(!RG.plain(i)||RG.conn(i).nb.length!==2||!RG.plain(id(a[0],a[1]))||!RG.plain(id(b[0],b[1]))||RG.conn(id(a[0],a[1])).nb.length!==2||RG.conn(id(b[0],b[1])).nb.length!==2)continue;
  t.xo={P,s0:k-.5,w:1};S.xo=S.xo||[];if(!S.xo.includes(i))S.xo.push(i);return}}
{const o=rtTickEnd;rtTickEnd=function(){const r=o.apply(this,arguments);if(RG.on)for(const t of S.trains){try{rxPlan(t)}catch(e){}}return r}}
// crossovers are drawn as a pair of diagonal rails between the two tracks (a scissors crossover)
{const o=RG.segs;RG.segs=function(SEG,x0,y0,x1,y1){o.apply(this,arguments);for(const i of(S.xo||[])){const x=i%N,y=(i/N)|0;if(x<x0-1||x>x1+1||y<y0-1||y>y1+1||!track.has(i)||!isDblD(x,y))continue;
  const c=RG.conn(i),hz=c.st[0],cx=(x+.5)*TS,cy=(y+.5)*TS,pc=[];for(const sg of[1,-1]){const pts=[];for(let k=0;k<=12;k++){const u=k/12,e=u*u*(3-2*u),al=(u-.5)*TS,lt=sg*8*(2*e-1);pts.push(hz?[cx+al,cy+lt]:[cx+lt,cy+al])}pc.push(pts)}SEG.push(pc)}}}
