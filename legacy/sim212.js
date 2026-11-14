// Railhaven balance simulator: plays the prototype headlessly with a simple bot and prints a JSON log.
// Usage: node railhaven-sim.js <seed> <minutes> [path/to/railhaven-prototype.html]
const fs=require('fs');const html=fs.readFileSync(process.argv[4]||'railhaven-prototype.html','utf8');const code=html.match(/<script>([\s\S]*)<\/script>/)[1];
const SEED=+process.argv[2]||1, MINUTES=+process.argv[3]||45;
let rs=SEED*9301+49297;Math.random=()=>{rs=(rs*9301+49297)%233280;return rs/233280};
const ctxP=new Proxy({},{get:(t,k)=>k.startsWith('create')?()=>({addColorStop(){}}):(t[k]!==undefined?t[k]:()=>{}),set:(t,k,v)=>{t[k]=v;return true}});
const els={};const mk=id=>els[id]||(els[id]={id,style:{},textContent:'',innerHTML:'',dataset:{},classList:{toggle(){},add(){},remove(){},contains(){return false}},addEventListener(){},querySelector(){return null},querySelectorAll(){return[]},insertAdjacentHTML(){},setPointerCapture(){},getContext:()=>ctxP,click(){this.onclick&&this.onclick()}});
const btns=['pan','track','scout','survey','shed','town','build','tech'].map(m=>{const b=mk('b'+m);b.dataset.m=m;return b});
global.document={getElementById:mk,querySelectorAll:()=>btns,querySelector:s=>btns.find(b=>s.includes(b.dataset.m))||mk(s),addEventListener(){},createElement:()=>mk("_"+Math.random()),body:mk("body"),documentElement:mk("html")};
global.innerWidth=400;global.innerHeight=800;global.devicePixelRatio=2;global.addEventListener=()=>{};
global.__SAV=null;const __LD=process.env.LOAD?fs.readFileSync(process.env.LOAD,'utf8'):null;global.localStorage={getItem:()=>__LD,setItem:(k,v)=>{global.__SAV=v},removeItem:()=>{}};let T=0;global.performance={now:()=>T*1000};
global.requestAnimationFrame=()=>{};global.setTimeout=()=>0;global.clearTimeout=()=>{};global.setInterval=()=>0;global.clearInterval=()=>{};global.navigator={};
eval(code+`;
const ev={beacon:[],fac:[],err:[]};
// v212 bot: a player keeps trains they shipped to an island (they cost a ship trip); only spare home trains get sold
autoSell=function(n){n=n||1;for(let k=0;k<n;k++){const t=idleTrains().find(t=>tIslNow(t)===homeK());if(!t||islTrainsN(homeK())<=4)break;S.trains.splice(S.trains.indexOf(t),1);S.money+=COST.train/2;ev.sold=(ev.sold||0)+1}};
{const o=sellTrain;sellTrain=function(j){const t=S.trains[j];if(t&&tIslNow(t)!==homeK())return;return o(j)}}
{const o=buyTrainFor;const last={};buyTrainFor=function(k){if(S.t-(last[k]||-1e9)<300)return;last[k]=S.t;return o(k)}}
let botT=0;
const _t=toast;toast=m=>{if(m.includes('Railway level'))ev.beacon.push(Math.round(T/60));if(/Need |costs|No track|does not want/.test(m))ev.err.push(Math.round(T/60)+':'+m.slice(0,60))};
function plan(target){const start=id(target.x,target.y),prev=new Map([[start,-1]]),q=[start];let hit=-1;
 for(let h=0;h<q.length&&hit<0;h++){const i=q[h],x=i%N,y=(i/N)|0;for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy;if(nx<1||ny<1||nx>=N-1||ny>=N-1)continue;const j=id(nx,ny);if(prev.has(j))continue;
  if(anchor(nx,ny)&&siteAt(nx,ny)!==target&&NET[j]){prev.set(j,i);hit=j;break}
  if(!rev[j]||(terr[j]===4&&!(S.lm||{}).foundry)||(terr[j]===0&&(!S.tech.trestle||(typeof brOk==='function'?!brOk(j):deep[j])))||siteAt(nx,ny)||(typeof stnSide==="function"&&stnSide(nx,ny))||(S.sheds||[]).some(o=>o.x===nx&&o.y===ny))continue;prev.set(j,i);q.push(j)}}
 if(hit<0)return null;const p=[];let i=prev.get(hit);while(i!==start&&i!==-1){p.push([i%N,(i/N)|0]);i=prev.get(i)}return p}
const cost=p=>p.reduce((a,[x,y])=>{const q=trackCost(x,y);return a+(q&&q.m||90)},0);
function build(target,reserve){if(isConnected(target)&&target.linked)return true;const p=plan(target);const _tryR=()=>{const q=typeof planRoute==='function'?planRoute(target.x,target.y,target):null;if(q&&q.length&&S.money>connectCost(q).m+reserve){for(const i of q)lay(i%N,(i/N)|0);computeNet()}return isConnected(target)&&target.linked};if(!p||islOf(target)!==homeK()){const q=typeof planRoute==='function'?planRoute(target.x,target.y,target):null;if(q&&q.length&&S.money>connectCost(q).m+reserve){for(const i of q)lay(i%N,(i/N)|0);computeNet();if(isConnected(target))return true}if(!p)return false}if(S.money<cost(p)+reserve)return false;for(let k=p.length-1;k>=0;k--)lay(...p[k]);computeNet();if(isConnected(target)&&target.linked)return true;return _tryR()}
const seenT=()=>sites.filter(s=>s.type==='town'&&!s.hidden&&rev[id(s.x,s.y)]);
const RAW=['wood','farm','stone','coal','iron','oil'];
function spotFor(k,T){let best=null;if(['wood','farm','stone'].includes(k)){for(let y=T.y-14;y<=T.y+14;y++)for(let x=T.x-14;x<=T.x+14;x++){if(x<2||y<2||x>=N-2||y>=N-2||!rev[id(x,y)]||indSpot(x,y,k))continue;const d=Math.hypot(x-T.x,y-T.y);if(!best||d<best.d)best={x,y,d}}}
 else for(const o of sites)if(o.type==='dep'&&o.res===k&&!o.hidden&&rev[id(o.x,o.y)]){const d=Math.hypot(o.x-T.x,o.y-T.y);if(d<22&&(!best||d<best.d))best={x:o.x,y:o.y,d}}
 if(!best&&(k==='iron'||k==='oil')){const L=new Set(sites.filter(o=>o.linked&&o.type==='town').map(islOf));for(const o of sites)if(o.type==='dep'&&o.res===k&&!o.hidden&&rev[id(o.x,o.y)]&&L.has(islOf(o))){const d=Math.hypot(o.x-T.x,o.y-T.y);if(!best||d<best.d)best={x:o.x,y:o.y,d}}}
 return best}
function facSpotNear(T){let best=null;for(const i of track){const x=i%N,y=(i/N)|0;for(const[dx,dy]of D4){const nx=x+dx,ny=y+dy;if(facSpot(nx,ny))continue;const d=Math.hypot(nx-T.x,ny-T.y);if(!best||d<best.d)best={x:nx,y:ny,d}}}return best}
let acted=0,hold=0;
function ensureMaker(k,T){// returns true if a linked maker exists (or we acted)
 const fk=Object.keys(FAC).find(f=>FAC[f].out===k);
 const mine=sites.filter(o=>offerOf(o)===k);const un=mine.find(o=>!o.linked);if(un){if(!acted&&build(un,500))acted=1;return false}
 {const L=srcsFor(T,k);if(L.length&&(!L.every(o=>srcFull(o.A))||L.length>=4||fk))return true;if(acted)return L.length>0}
 if(fk){if(FAC[fk].lvl>S.beacon)return false;{const ir=Object.keys(FAC[fk].in).find(r=>typeof IRES!=='undefined'&&IRES.includes(r)&&!sites.some(o=>o.linked&&offerOf(o)===r));if(ir){const sp=spotFor(ir,T);if(sp&&!acted&&S.money>(BUILD[ir]||2000)+800&&buildInd(sp.x,sp.y,ir)){acted=1;build(siteAt(sp.x,sp.y),200);ev.imine=(ev.imine||'')+ir+'@'+Math.round(T0())+' '}return false}}if(S.money<PRICE.fac(fk).m+1500)return false;const b=facSpotNear(T);if(b&&buildFac(b.x,b.y,fk)){ev.fac.push(fk+'@'+Math.round(T0()));acted=1}return false}
 if(S.money<BUILD[k]+800)return false;const b=spotFor(k,T);if(b&&buildInd(b.x,b.y,k)){acted=1;const o=siteAt(b.x,b.y);build(o,200)}return srcsFor(T,k).length>0}
const T0=()=>T/60;
function wantTrain(a,b){if(hold&&S.money<hold+800)return false;if(S.money<COST.train+400&&S.trains.some(t=>t.route))return false;if(srcFull(sites[a])&&brings(sites[b],offerOf(sites[a])).length)return false;const free=S.trains.some(t=>!t.route);if(!free&&S.money<COST.train+400)return false;sendJob(a,b);return true}
function fleet(){if(!S.auto)return;
 if(botT%20===0){const wl=waitingLoads(),id=idleTrains().filter(t=>tIslNow(t)===homeK()).length;if((wl>id||!S.trains.length)&&S.money>COST.train+(S.trains.length?1500:0)+hold)autoBuy();else if(id>2&&S.trains.length>4)autoSell()}
 if(botT%20===0&&typeof buyShip==='function'){for(const l of S.lanes)if(sites[l.a]&&sites[l.b]&&sites[l.a].linked&&sites[l.b].linked&&!laneShips(l)&&S.money>shipCost()+1000){buyShip(l.a);ev.ship=(ev.ship||0)+1}for(const k of shIsles()){if(k===homeK())continue;const n=S.trains.filter(t=>tIslNow(t)===k).length+S.ferT.filter(f=>islOf(sites[f.to])===k).length,M=shipPlan();let wl=0;for(const[pi,f]of M)if(f.to!=null&&!f.why.length&&islOf(sites[pi])===k&&(sites[pi].stock||0)>=20)wl++;if((n===0&&wl>0||wl>n+1)&&S.money>COST.train+1000&&islDock(k)){buyTrainFor(k);ev.islT=(ev.islT||0)+1}}}
 for(const[pi,f]of shipPlan()){if(!canCarry(f.k,islOf(sites[pi]))){const c=cargoCls(f.k);if(S.money>CARGO[c].c+1000+hold)buyFleet(c,islOf(sites[pi]))}if(!fuelOk(sites[pi])&&fuelD(sites[pi])>=0&&S.money>TOWER+500)buildTower(pi)}
 if(botT%30===0)for(const q of shIsles())for(const k of ['wag','eng','rep','rng']){const c=UPG[k].c[U(q)[k]||0];if(c!=null&&S.money>c+6000+hold){buyFleet(k,q);ev.ups=(ev.ups||0)+1;break}}}
function bot(){botT+=5;acted=0;fleet();
 if(botT%10===0)for(const P of ports()){if(!P.linked&&!P.gone&&S.money>500){if(build(P,200)){ev.plink=(ev.plink||0)+1;break}}}
 // v199 human habits
 // 1) read the 💡 line: buy the map it suggests
 if(botT%30===0&&typeof nextTip==='function'){const tip=nextTip()||'';const m=tip.match(/buy a map at (.+?) to/);if(m&&S.money>mapCost()+2500){const i=sites.findIndex(o=>o.name===m[1]);if(i>=0){const o=sites[i];let best=null;for(let a=0;a<16;a++){const x=Math.round(o.x+Math.cos(a*.3927)*20),y=Math.round(o.y+Math.sin(a*.3927)*20);if(x<2||y<2||x>N-3||y>N-3||mapErrAt(x,y))continue;let f=0;for(let dy=-12;dy<=12;dy+=2)for(let dx=-12;dx<=12;dx+=2){const k=id(Math.max(0,Math.min(N-1,x+dx)),Math.max(0,Math.min(N-1,y+dy)));if(!rev[k]&&terr[k])f++}if(!best||f>best.f)best={x,y,f}}if(best&&best.f>5){buyMap(i);mapAt(best.x,best.y);const n=(S.maps||[]).length;mapBuyHere();if((S.maps||[]).length>n)ev.maps=(ev.maps||0)+1;try{closePanel()}catch(e){}}}}}
 // 2) chase rumours shown on bought maps when scouts can reach them
 if(botT%20===0&&typeof HINTS!=='undefined'&&S.money>1500&&S.scouts.filter(o=>!o.sea).length<2){for(const h of HINTS){if(rev[id(h.x,h.y)])continue;if(!(S.maps||[]).some(m=>Math.hypot(m.x-h.x,m.y-h.y)<=m.r))continue;if(S.scouts.some(o=>Math.hypot(o.tx-h.x,o.ty-h.y)<6))continue;const home=sites.filter(scoutOk).find(o=>Math.hypot(o.x-h.x,o.y-h.y)<=scR(o));if(home){const n=S.scouts.length;scoutAt(h.x,h.y,sites.indexOf(home));if(S.scouts.length>n){ev.rum=(ev.rum||0)+1;break}}}}
 if(botT%30===0&&typeof buyWH==='function'){for(const P of sites){if(P.type!=='port'||!P.linked||(P.wh||0)>=3)continue;const n=Object.keys(P.im||{}).filter(g=>(P.im[g]||0)>=10).length;if(n>=2&&S.money>whCost(P.wh||0)+2500){buyWH(sites.indexOf(P));ev.wh=(ev.wh||0)+1;break}}}
 // 3) out of money and losing it: sell the worst-earning train
 if(botT%60===0){ev._m=ev._m||[];ev._m.push(S.money);if(ev._m.length>3)ev._m.shift();if(S.money<800&&ev._m.length===3&&ev._m[2]<=ev._m[0]&&S.trains.length>3){let w=-1,wr=1e9;S.trains.forEach((t,j)=>{if(t.cargo)return;const r=(t.earn||0)/Math.max(1,(S.t-(t.born||0))/60);if(r<wr){wr=r;w=j}});if(w>=0){sellTrain(w);ev.sold=(ev.sold||0)+1}}}
 // v197: act on hints like a player reading the 💡 line
 if(botT%15===0&&typeof rawGap==='function'){const r=rawGap();if(r&&S.money>(BUILD[r.kind]||1500)+800){const b=spotFor(r.kind,r.T[0])||spotFor(r.kind,r.F);if(b&&buildInd(b.x,b.y,r.kind)){acted=1;const o=siteAt(b.x,b.y);build(o,200);ev.hint=(ev.hint||'')+r.kind+'@'+Math.round(T0())+' '}}}
 if(botT%15===0&&!acted&&typeof facGap==='function'){const g=facGap();if(g&&!g.miss.length&&FAC[g.k].lvl<=S.beacon&&S.money>PRICE.fac(g.k).m+800){const b=facSpotNear(g.T[0]);if(b&&buildFac(b.x,b.y,g.k)){acted=1;ev.fac.push(g.k+'@'+Math.round(T0())+'h')}}}
 // a player with money stuck low and idle trains sells the spares
 if(botT%60===0&&S.money<2500&&typeof idleTrains==='function'){const id=idleTrains();if(id.length>=3&&S.trains.length>5&&T0()>15&&typeof autoSell==='function'){autoSell();ev.sold=(ev.sold||0)+1}}
 // drop jobs that no longer make sense; weak trains switch jobs or get sold
 if(!S.auto&&botT%30===0)for(const[j,t]of [...S.trains.entries()].reverse()){const r=tRate(t);if(r!==null&&r<tCost(t)*.6&&!t.cargo&&S.t-(t.sw||0)>300){t.sw=S.t;const L=jobsFor(t).filter(o=>!(t.route&&o.a===t.route.a&&o.b===t.route.b)&&!srcFull(sites[o.a]));if(L[0]&&L[0].pm>tCost(t)*1.5){t.route={a:L[0].a,b:L[0].b,c:null};t.eh=[];t.born=S.t;ev.sw=(ev.sw||0)+1}else if(r<tCost(t)*.3&&S.trains.length>6){sellTrain(j);ev.sold=(ev.sold||0)+1}}}
 for(const t of S.trains)if(t.route&&(t.stuck||0)>40&&!t.cargo){t.route=null;t.stuck=0}
 const towns=seenT().filter(o=>o.linked&&o.pop>0&&ordOf(o)).sort((a,b)=>tlvl(a)-tlvl(b));
 for(const T of towns){const o=ordOf(T);for(const k in o){if(((T.got||{})[k]||0)>=o[k])continue;if(brings(T,k).length){continue}if(!ensureMaker(k,T))continue;const s=srcsFor(T,k).find(o=>!srcFull(o.A))||srcsFor(T,k)[0];if(!s)continue;if(isFac(s.A)&&facLack(s.A).length){for(const q of facLack(s.A)){if(!ensureMaker(q,s.A))continue;const u=srcsFor(s.A,q)[0];if(u)wantTrain(u.i,sites.indexOf(s.A))}continue}wantTrain(s.i,sites.indexOf(T))}}
 // factories get their inputs
 for(const f of sites.filter(o=>isFac(o)&&o.linked)){for(const k in FAC[f.type].in){if(brings(f,k).length)continue;if(!ensureMaker(k,f))continue;const s=srcsFor(f,k)[0];if(s)wantTrain(s.i,sites.indexOf(f))}}
 // busy sources get another train
 if(botT%20===0&&S.money>6000+hold){const t=S.trains.find(t=>t.route&&sites[t.route.a]&&sites[t.route.a].stock>IND.cap(sites[t.route.a])*.7&&!isFac(sites[t.route.a]));if(t)sendJob(t.route.a,t.route.b)}
 // idle trains: best job
 if(!S.auto)for(const[j,t]of S.trains.entries())if(!t.route){const L=jobsFor(t);if(L[0])assignJob(j,L[0].a,L[0].b)}
 // link the nearest unlinked town
 if(!acted){const cand=seenT().filter(t=>!t.linked).map(t=>({t,p:plan(t)})).filter(q=>q.p).sort((a,b)=>a.p.length-b.p.length);if(cand[0]&&build(cand[0].t,1500))acted=1}
 // found towns on settlement sites when nothing else to link
 if(!acted&&botT%15===0&&S.money>5000&&!seenT().some(t=>!t.linked&&plan(t))){const p=sites.filter(o=>o.type==='plot'&&rev[id(o.x,o.y)]).map(o=>({o,p:isConnected(o)?[]:plan(o)})).filter(q=>q.p).sort((a,b)=>a.p.length-b.p.length)[0];if(p&&p.p.length<40){build(p.o,PRICE.town().m+500);if(isConnected(p.o)){foundTown(sites.indexOf(p.o));ev.found=(ev.found||'')+p.o.name+'@'+Math.round(T0())+' '}}}
 // upgrades
 if(botT%30===0&&S.money>hold+2000){if(!S.auto)for(const[j,t]of S.trains.entries())for(const k of Object.keys(UPS))if(!t[k]&&S.money>upPrice(k).m+6000){pay(upPrice(k));t[k]=1;ev.ups=(ev.ups||0)+1}
  const ind=sites.filter(o=>isInd(o)&&o.linked&&IND.lvl(o)<IND.maxL&&S.trains.filter(t=>t.route&&sites[t.route.a]===o).length>=2).sort((a,b)=>IND.lvl(a)-IND.lvl(b))[0];if(ind&&S.money>PRICE.ind(ind).m+8000){upInd(sites.indexOf(ind));ev.ind=(ev.ind||0)+1}
  if(!S.tech.trestle&&S.money>6000&&typeof PRICE.trestle==='function'&&pay(PRICE.trestle()))S.tech.trestle=1}
 // ports when the home island runs out
 if(botT%10===0){const P=ports().find(o=>o.linked),landT=seenT().filter(t=>!t.linked&&plan(t));hold=0;if(S.beacon>=2&&!landT.length&&(linkedTowns()>=3||/Dock/.test(nextTip()||''))){if(!P)hold=PORT.up[0].m+1000;else if((P.lvl||1)<4&&S.beacon>=PORT.lv[P.lvl||1]&&!seenT().some(t=>!t.linked&&!plan(t)&&Math.hypot(t.x-P.x,t.y-P.y)<portR(P)+14))hold=PORT.up[P.lvl||1].m}}
 if(S.beacon>=2&&botT%30===0){const P=ports().find(o=>o.linked),landT=seenT().filter(t=>!t.linked&&plan(t));
  if(!P&&(!landT.length||linkedTowns()>=4)&&S.money>PORT.up[0].m+3000){const A=sites[hubI()];let best=null;for(let y=2;y<N-2;y++)for(let x=2;x<N-2;x++){if(!rev[id(x,y)]||!coastal(x,y)||siteAt(x,y))continue;const d=Math.hypot(x-A.x,y-A.y);if(!best||d<best.d)best={x,y,d}}
   if(best){if(!touchesRail(best.x,best.y)){const p=plan({x:best.x,y:best.y});if(p&&S.money>cost(p)+PORT.up[0].m+500)for(let k=p.length-1;k>=0;k--)lay(...p[k])}if(touchesRail(best.x,best.y)){const n=ports().length;buildPort(best.x,best.y);if(ports().length>n)ev.port=(ev.port||'')+'dock@'+Math.round(T0())+' '}}}
  if(P){const R=portR(P);if((P.lvl||1)<4&&S.beacon>=PORT.lv[P.lvl||1]&&S.money>PORT.up[P.lvl||1].m+500)upPort(sites.indexOf(P));
   if(S.money>1500&&S.scouts.filter(o=>o.sea).length<2)for(let k=0;k<60;k++){const a=Math.random()*6.283,r=R*(.4+Math.random()*.6),x=Math.round(P.x+Math.cos(a)*r),y=Math.round(P.y+Math.sin(a)*r);if(x>1&&y>1&&x<N-1&&y<N-1&&!rev[id(x,y)]){S.money-=250;S.scouts.push({x:P.x,y:P.y,tx:x,ty:y,sp:4,sea:1});break}}
   const isl=seenT().filter(t=>!t.linked&&!plan(t)&&Math.hypot(t.x-P.x,t.y-P.y)<R+14);if(isl.length&&S.money>PORT.land.m+2000){let best=null;for(const t of isl)for(let y=t.y-12;y<=t.y+12;y++)for(let x=t.x-12;x<=t.x+12;x++){if(x<2||y<2||x>N-3||y>N-3||!rev[id(x,y)]||!coastal(x,y)||siteAt(x,y))continue;if(Math.hypot(x-P.x,y-P.y)>R)continue;const d=Math.hypot(x-t.x,y-t.y);if(!best||d<best.d)best={x,y,d}}
    if(best&&portSpot(best.x,best.y).kind==='land'){buildPort(best.x,best.y);ev.port=(ev.port||'')+'land@'+Math.round(T0())+' '}}}}
 // scout
 if(S.money>(seenT().some(t=>!t.linked)?4000:1500)&&S.scouts.filter(s=>!s.survey&&!s.sea).length<(S.money>8000?2:1)){const hs=sites.filter(scoutOk).filter(o=>o.type==='town');let best=null;for(const h of hs)for(let y=h.y-SCOUT_R;y<=h.y+SCOUT_R;y+=2)for(let x=h.x-SCOUT_R;x<=h.x+SCOUT_R;x+=2){if(x<1||y<1||x>=N-1||y>=N-1||rev[id(x,y)]||!terr[id(x,y)])continue;const d=Math.hypot(x-h.x,y-h.y);if(d>SCOUT_R)continue;const dc=Math.hypot(x-C,y-C)+d*.3;if(S.scouts.some(o=>Math.hypot(o.tx-x,o.ty-y)<8))continue;if(!best||dc<best.dc)best={x,y,h,dc}}if(best){S.money-=250;S.scouts.push({x:best.h.x,y:best.h.y,tx:best.x,ty:best.y,sp:4})}}

 // v212 late-game habits (taught from an advanced save)
 // 0) keep a few trains working on the home island
 if(botT%20===0&&islTrainsN(homeK())<3&&S.money>COST.train+500){autoBuy();ev.homeBuy=(ev.homeBuy||0)+1}
 // a) the shipping office: buy the hold a trade order or a dock queue needs
 if(botT%20===0&&typeof buyHold==='function'){for(const k in (S.tro||{})){const q=S.tro[k];if(q.done||canShip(q.k))continue;const c=holdOf(q.k),H=SHOLD[c];if(H&&!S.shC[c]&&S.money>r100(H.c*XP())+1500+hold){buyHold(c);ev.hold=(ev.hold||'')+c+'@'+Math.round(T0())+' ';break}}}
 // b) trade orders: make sure someone on the sending island makes the good
 if(botT%30===0){for(const k in (S.tro||{})){const q=S.tro[k];if(q.done)continue;const m=troMiss(+k,q);if(m.some(x=>/nobody/.test(x))){const T=sites.find(o=>o.type==='town'&&o.linked&&islOf(o)===q.from);if(T&&ensureMaker(q.k,T)){ev.troMk=(ev.troMk||0)+1;break}}}}
 // c) bottlenecks: expand the building towns are queueing on, or build a second one
 if(botT%30===0&&typeof bottlenecks==='function'){const b=bottlenecks()[0];if(b){const A=b.A,i=b.i;if(isFac(A)){const L=A.lvl||1;if(L<FACT.maxL){if(S.money>PRICE.facUp(L).m+1500+hold){upFac(i);ev.facUp=(ev.facUp||0)+1}}else if(FAC[A.type]&&S.money>PRICE.fac(A.type).m+2000+hold){const sp=facSpotNear(b.towns[0]);if(sp&&buildFac(sp.x,sp.y,A.type)){ev.fac2=(ev.fac2||0)+1}}}else{if(IND.lvl(A)<IND.maxL){if(S.money>PRICE.ind(A).m+1500+hold){upInd(i);ev.indUp=(ev.indUp||0)+1}}else{const sp=spotFor(A.type,b.towns[0]);if(sp&&S.money>(BUILD[A.type]||1500)+1500+hold&&buildInd(sp.x,sp.y,A.type)){build(siteAt(sp.x,sp.y),200);ev.ind2=(ev.ind2||0)+1}}}}}
 // d) full buildings nobody collects from: sell the surplus
 if(botT%60===0&&typeof sellStock==='function'){sites.forEach((o,i)=>{if(!o.linked||!(isInd(o)||isFac(o)))return;const c=isFac(o)?0:IND.cap(o);if(c&&(o.stock||0)>=c*.95){o._full=(o._full||0)+1;if(o._full>=3){sellStock(i);o._full=0;ev.sold2=(ev.sold2||0)+1}}else o._full=0})}
 // e) fleet upgrades with a smaller safety margin once the network is big
 if(botT%30===0&&S.beacon>=4)for(const q of shIsles())for(const k of ['wag','eng','rep','rng']){const c=UPG[k].c[U(q)[k]||0];if(c!=null&&S.money>c+2500+hold){buyFleet(k,q);ev.ups2=(ev.ups2||0)+1;break}}
 // v207 bot: ships cost money again: a player saves up for the ship on every linked sea route, then sends trains to the island
 {const need=S.lanes.filter(l=>{const[A,B]=laneEnds(l);return A&&B&&A.linked&&B.linked&&!laneShips(l)});
  if(need.length){const l=need[0];if(S.money>=shipCost()+300){buyShip(l.a);ev.ship=(ev.ship||0)+1}else hold=Math.max(hold,shipCost()+300)}
  if(botT%20===0)for(const k of shIsles()){if(k===homeK()||!islDock(k))continue;const n=islTrainsN(k);const inds=sites.filter(o=>o.linked&&(isInd(o)||isFac(o))&&islOf(o)===k).length;if(n<Math.max(1,inds)&&S.money>COST.train+1500+hold){buyTrainFor(k);ev.islT=(ev.islT||0)+1;break}}}
}
ev.stall=[];let _pg={o:-1,l:-1,i:-1,t:0},_stOn=0;
function stallChk(){const o=S.stats.orders||0,l=linkedTowns(),i=(S.isl||[]).length||(typeof regions==='function'?regions().length:0);
 if(o!==_pg.o||l!==_pg.l||i!==_pg.i){if(_stOn){ev.stall[ev.stall.length-1].end=Math.round(T/60)}_pg={o,l,i,t:T};_stOn=0;return}
 if(!_stOn&&T-_pg.t>=1200){_stOn=1;let goal='';try{goal=String(goalShort()).replace(/<[^>]+>/g,'')}catch(e){}
  const open=seenT().filter(t=>t.linked&&ordOf(t)).map(t=>{const q=ordOf(t),m=[];for(const k in q){const g=(t.got||{})[k]||0;if(g<q[k])m.push(k+' '+Math.round(g)+'/'+q[k]+(brings(t,k).length?'':' (no train)'))}return t.name+': '+m.join(', ')}).filter(x=>!/: $/.test(x));
  let tip='';try{tip=String(nextTip()||'').replace(/<[^>]+>/g,'')}catch(e){}
  ev.stall.push({at:Math.round(_pg.t/60),money:Math.round(S.money),lvl:S.beacon,orders:o,linked:l,trains:S.trains.length,idle:idleTrains().length,tip:tip.slice(0,160),goal:goal.slice(0,200),open:open.slice(0,8),unl:seenT().filter(t=>!t.linked).length})}}
if(process.env.INSTDOCK){ev.dk={};const o=deliver;deliver=function(t,here,dist){if(here&&here.type==='port'&&t.cargo){const A=sites[t.src]||sites[t.route&&t.route.a];const f=A?shipPlan().get(pIdx(A)):null;const key=(A?A.type:'?')+'>'+t.k+' plan:'+(f?(f.to===pIdx(here)?'to-dock':'to'+(f.to==null?'null':sites[f.to].type))+(f.sea?'/sea':'')+(f.fin!=null&&sites[f.fin]?' fin:'+sites[f.fin].type+'@'+islName(islOf(sites[f.fin]))+' room'+Math.round(roomFor(sites[f.fin],t.k))+' pipe'+Math.round(pipe(islOf(sites[f.fin]),t.k)):''):'none')+' from@'+(A?islName(islOf(A)):'')+(t.route?' route':'')+(t.auto===false?' manual':'');ev.dk[key]=(ev.dk[key]||0)+t.cargo}return o(t,here,dist)}}
const log=[];let lastE=0,lastM=S.money,idleS=0,busyS=0;const LOGS=+process.env.LOGS||300;
try{IDLE_S=1e12;if(document.hidden)Object.defineProperty(document,"hidden",{get:()=>false})}catch(e){}
for(let sec=0;sec<MINUTES*60;sec++){if(false){try{buyLH(hubI())}catch(e){ev.lhErr=String(e)}ev.lh=(ev.lh||0)+1}if(sec%60===0&&S.tro){ev.tro=JSON.stringify(S.tro)}for(let k=0;k<10;k++){T+=.1;tick(.1);tickMissions(.1)}if(sec%60===59){stallChk()}if(sec%5===0){try{bot()}catch(e){ev.botErr=String(e.stack).slice(0,300)}}
 for(const t of S.trains){if(t.st==='idle'||(t.lw||0)>0)idleS++;else busyS++}
 if(sec%LOGS===LOGS-1){const e=S.earned||0;log.push({min:Math.round(T/60),money:Math.round(S.money),earnPerMin:Math.round((e-lastE)/(LOGS/60)),netPerMin:Math.round((S.money-lastM)/(LOGS/60)),upkeep:Math.round((trainsCost()+track.size*COST.trackRun+sites.filter(isFac).length*FACT.run)*60),beacon:S.beacon,orders:S.stats.orders||0,trains:S.trains.length,ferT:S.ferT.length,ferW:S.ferT.filter(f=>f.ph==="wait").length,ferR:S.trains.filter(t=>t.st==="ferry").length,busy:Math.round(100*busyS/Math.max(1,busyS+idleS))+'%',linked:linkedTowns(),track:track.size,tiers:sites.filter(s=>s.type==='town'&&s.linked).map(s=>(s.beacon?'*':'')+tier(s.pop)[0]+Math.round(s.pop)).join(' '),fac:sites.filter(isFac).map(f=>f.type.slice(0,3)+':'+Math.round(f.made||0)).join(' ')});lastE=e;lastM=S.money;idleS=busyS=0;if(process.env.PART){try{fs.writeFileSync(process.env.PART,JSON.stringify({seed:SEED,log,ev}))}catch(e){}}}}
try{ev.ms={main:S.ms&&S.ms.main&&S.ms.main.t,side:(S.ms&&S.ms.side||[]).map(s=>s.t),done:(S.ms&&S.ms.done||[]).map(d=>d.m+":"+d.t)}}catch(e){}
ev.led=Object.fromEntries(Object.entries(S.led||{}).filter(([k,v])=>typeof v==='number').map(([k,v])=>[k,Math.round(v)]));
delete ev._m;ev.troW=Object.entries(S.tro||{}).filter(([k,q])=>!q.done).map(([k,q])=>islName(+k)+'<-'+islName(q.from)+' '+q.k+' '+Math.round(q.got)+'/'+q.need+': '+troMiss(+k,q).join('; ')).slice(0,10);ev.tr=S.trains.map(t=>tNo(t)+':'+jobTxt(t).replace(/<[^>]+>/g,'')+':'+(t.why||t.st)).join(' | ');ev.err=ev.err.slice(-12);{const P=ports().find(o=>o.linked);ev.sea=ports().map(o=>o.name+(o.linked?'+':'-')+'L'+(o.lvl||1)+(o.kind||'')).join(',')+(P?' R'+portR(P)+' islT:'+seenT().filter(t=>!t.linked&&!plan(t)).map(t=>t.name+':d'+Math.round(Math.hypot(t.x-P.x,t.y-P.y))).join(',')+' fog:'+sites.filter(t=>t.type==='town'&&!rev[id(t.x,t.y)]).map(t=>Math.round(Math.hypot(t.x-P.x,t.y-P.y))).sort((a,b)=>a-b).slice(0,6).join(','):'')+' unl:'+seenT().filter(t=>!t.linked).map(t=>t.name+(plan(t)?'p'+plan(t).length:'X')).join(',')}ev.isl=(S.isl||[]).length;ev.tut=S.tut;
if(process.env.PROBE){const P=sites.find(o=>o.name==='Gullhaven Docks'),pi=pIdx(P),f=shipPlan().get(pi);ev.probe={tip:String(nextTip()).slice(0,140),cur:P.cur,stock:P.stock,im:P.im,wh:P.wh,f:f?{k:f.k,to:f.to!=null?sites[f.to].type+'/'+sites[f.to].name:null,why:f.why,sup:f.sup,full:f.full}:null,trains:S.trains.filter(t=>sites[t.src]===P||t.route&&sites[t.route.a]===P).map(t=>t.st+':'+t.k),all:S.trains.map(t=>islName(tIslNow(t)).slice(0,6)+':'+t.st+':'+(t.route?(sites[t.route.a].name||sites[t.route.a].type)+'>'+(sites[t.route.b].name||sites[t.route.b].type):'-')+':'+(t.why||'')),mill:(()=>{const M=sites.find(o=>o.type==='mill');return{room:roomFor(M,'iron'),brings:brings(M,'iron').map(x=>x.name||x.type),src:srcsFor(M,'iron').map(s=>s.A.name||s.A.type)}})()}}if(process.env.REP)console.error(makeReport());ev.nl=typeof _NL!=="undefined"?_NL:[];console.log(JSON.stringify({seed:SEED,log,ev}));save.off=0;save();if(process.env.DUMP)fs.writeFileSync(process.env.DUMP,global.__SAV||'');
`);
