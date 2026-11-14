
// ===================== v275 REAL TRACK (Sébastien 2026-11-14, "Build it as shown") =====================
// 1) Trains never turn round on the spot. A train keeps its engine end: to head back it reverses (the engine pushes, a white
//    lamp shows on the leading wagon), backs past a junction and drives on engine first, or its engine runs round its wagons
//    on a second track. Routes are planned square by square with no U-turns, and loops are used when they are not much longer.
// 2) New industries and factories stand on a 2 x 4 plot: one row of loading tracks beside a straight line (joined to the line
//    at both ends, so trains drive in at one end and out at the other) and one row for the building, plus one more row kept
//    free for the 3rd and 4th tracks that upgrades add. Each loading track holds one train; the others wait at the signal.
// 3) Older buildings move onto the new plot when there is room; the rest keep their small siding but get the same rules.
var RTON=true;
const RT_RA=3.5,RT_REV=.8,RT_LC=2;
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
 const rl=q=>1.2+.25*q,off=q=>24+16*q,ss=u=>{u=Math.max(0,Math.min(1,u));return u*u*(3-2*u)};
 // how far (px, toward the building) loading track q runs from the line's centre at position c along the line
 const lat=(q,c)=>{const L=off(q),R=rl(q);let f=1;if(c<u0){f=conL?ss((c-(u0-R))/R):(c>=u0-.45?1:0)}else if(c>u0+3){f=conR?ss((u0+3+R-c)/R):(c<=u0+3.45?1:0)}return L*f};
 const px=(c,d)=>hz?[(c+.5)*TS,(lr+.5)*TS+sd*d]:[(lr+.5)*TS+sd*d,(c+.5)*TS];
 const foot=[];for(let r=1;r<=3;r++)for(let u=u0;u<u0+4;u++){const[x,y]=rxy(u,r);foot.push(id(x,y))}
 const zone=new Set(span);zone.add(tileAt(u0-1));zone.add(tileAt(u0+4));
 g={k,hz,sd,u0,lr,n,span,foot,zone,conL,conR,rl,off,lat,px,tileAt,uOf,onLine,rxy,bRow:n>2?3:2};YDC.set(o,g);return g}
// footprint squares (rows 1-3 beside the line) -> building, and the squares on the far side of the line where no track may join
let YFK='',YFP=new Map(),YSB=new Map();
function yfp(){const k=sites.length+'/'+(S.ydn||0);if(k!==YFK){YFK=k;YFP=new Map();YSB=new Map();for(const o of sites)if(ydOK(o)){const G=ydG(o);for(const i of G.foot)if(i!==id(o.x,o.y))YFP.set(i,o);for(let u=G.u0;u<G.u0+4;u++){const[x,y]=G.rxy(u,-1);YSB.set(id(x,y),o)}}}return YFP}
const ydFoot=i=>yfp().get(i)||null,ydSide=i=>{yfp();return YSB.get(i)||null};
const ydBan=i=>!!ydFoot(i)||!!ydSide(i);
const ydStubAt=(x,y)=>{const s=siteAt(x,y);return!!s&&ydOK(s)};
const ydCenter=o=>{const G=ydG(o);return G.px(G.u0+1.5,G.bRow*TS)};

// where a 2 x 4 plot (+1 row) fits around the building square A; conv: an older building already joined at A
function ydCands(x,y,k,conv,self){const out=[];const mine=k==='coal'||k==='iron'||k==='stone';yfp();
 const freeLine=(X,Y)=>landTile(X,Y)&&terr[id(X,Y)]!==4&&rev[id(X,Y)]&&!siteAt(X,Y)&&!YFP.has(id(X,Y))&&!YSB.has(id(X,Y))&&!(S.sheds||[]).some(o=>o.x===X&&o.y===Y)&&!(typeof stnAt==='function'&&stnAt(X,Y))&&!(()=>{const b=bldAt(X,Y);return b&&b!==self&&b.type!=='dep'&&b.type!=='plot'})();
 for(const hz of[1,0])for(const sd of[1,-1]){const au=hz?x:y,ar=hz?y:x,lr=ar-sd,T=(u,r)=>hz?[u,lr+sd*r]:[lr+sd*r,u];
  U:for(let u0=au-3;u0<=au;u0++){let sc=0;
   for(let u=u0;u<u0+4;u++){const[X,Y]=T(u,0);if(X<2||Y<2||X>=N-2||Y>=N-2)continue U;const i=id(X,Y);
    if(track.has(i)){sc+=3;if(dblSet.has(i)&&0)continue U}else{if(conv&&u===au)continue U;if(!freeLine(X,Y))continue U}
    const[FX,FY]=T(u,-1);if(isRail(FX,FY))continue U}// nothing may join the plot's line from the far side
   if(conv){const[MX,MY]=T(au,0);const nb=D4.filter(([dx,dy])=>isRail(x+dx,y+dy));if(nb.length!==1||x+nb[0][0]!==MX||y+nb[0][1]!==MY)continue U}
   for(const u of[u0-1,u0+4]){const[X,Y]=T(u,0);if(track.has(id(X,Y)))sc+=2}
   for(let r=1;r<=3;r++)for(let u=u0;u<u0+4;u++){const[X,Y]=T(u,r);if(X===x&&Y===y)continue;if(X<2||Y<2||X>=N-2||Y>=N-2)continue U;const i=id(X,Y),tr=terr[i];
    if(track.has(i)||!rev[i]||tr===0||laneSet.has(i))continue U;if(tr===4&&!(mine&&r>=2))continue U;
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
  for(let q=0;q<4;q++){const nx=x+D4[q][0],ny=y+D4[q][1];if(nx<0||ny<0||nx>=N||ny>=N)continue;const j=id(nx,ny);if(j===pt||!isRail(nx,ny)||laneSet.has(j))continue;if(j!==goal&&ydStubAt(nx,ny))continue;relax(key(j,q,m,r),c+(m?1:1.8),k,0)}
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
 if(t.pos>.01){const c=Math.floor(t.pos);let same=c<P.length&&c<P0.length;for(let j=0;same&&j<=c;j++)if(P[j][0]!==P0[j][0]||P[j][1]!==P0[j][1])same=false;if(!same)return;let ut=false;for(let j=Math.max(2,c);j<P.length;j++)if(P[j][0]===P[j-2][0]&&P[j][1]===P[j-2][1]){ut=true;break}if(!ut)return}
 else{const s0=rtI(P[0]);if(s0!==F&&!(occ.length>1&&s0===occ[1])){t._tl=null;return}}// it was moved somewhere else (a ferry, a new train): leave it
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
 const P=(cc,d)=>G.px(cc,d),seg=(q)=>{const a=[],R=G.rl(q),cs=G.conL?u0-R:u0-.45,ce=G.conR?u0+3+R:u0+3.45;for(let cc=cs;cc<=ce+1e-6;cc+=.0625)a.push(P(cc,G.lat(q,cc)));return a};
 const quad=(c0,c1,d0,d1,col)=>{const A=P(c0,d0),B=P(c1,d1);c.fillStyle=col;c.fillRect(Math.min(A[0],B[0]),Math.min(A[1],B[1]),Math.abs(B[0]-A[0]),Math.abs(B[1]-A[1]))};
 // ground: gravel under the tracks, a paved yard for the building, the kept row behind
 const lastD=G.off(n-1);quad(u0-.5,u0+3.5,16,lastD+11,'#5c4d3c');quad(u0-.5,u0+3.5,lastD+11,lastD+19,'#cdb991');quad(u0-.5,u0+3.5,lastD+18,lastD+19.2,'#8a6a40');
 const bTop=lastD+19,bBot=(n>2?3:2)*TS+16;quad(u0-.5,u0+3.5,bTop,bBot,fr?'#7a6a3a':'#8b7d68');
 if(fr){for(let k=0;k<4;k++){if(k===1||k===2)continue;const A=P(u0+k-.5,bTop+1),B=P(u0+k+.5,bBot-1);c.fillStyle='#b8953a';c.fillRect(Math.min(A[0],B[0])+1,Math.min(A[1],B[1]),Math.abs(B[0]-A[0])-2,Math.abs(B[1]-A[1]));c.strokeStyle='#d9b85a';c.lineWidth=2;for(let r=4;r<Math.abs(G.hz?B[1]-A[1]:B[0]-A[0])-2;r+=6){c.beginPath();if(G.hz){const yy=Math.min(A[1],B[1])+r;c.moveTo(Math.min(A[0],B[0])+3,yy);c.lineTo(Math.max(A[0],B[0])-3,yy+Math.sin(tm*1.5+k+r)*.8)}else{const xx=Math.min(A[0],B[0])+r;c.moveTo(xx,Math.min(A[1],B[1])+3);c.lineTo(xx+Math.sin(tm*1.5+k+r)*.8,Math.max(A[1],B[1])-3)}c.stroke()}}}
 if(n<=2){// the row kept free for upgrades: a fenced, grassy plot with stakes
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
 // buffer stops at a dead end
 for(const[on,cc]of[[G.conL,u0-.45],[G.conR,u0+3.45]]){if(on)continue;for(let q=0;q<n;q++){const p=P(cc,G.off(q));c.fillStyle='#7a2a1a';if(G.hz)c.fillRect(p[0]-2,p[1]-7,4,14);else c.fillRect(p[0]-7,p[1]-2,14,4);c.fillStyle='#e6d36a';if(G.hz)c.fillRect(p[0]-1.5,p[1]-5,3,2);else c.fillRect(p[0]-5,p[1]-1.5,2,3)}}
 // signals at the entrances: red when every loading track is taken and a train waits
 const busy=S.trains.filter(o=>o.yl&&o.yl.i===sites.indexOf(s)).length>=n,waiting=S.trains.some(o=>o.yg===sites.indexOf(s)&&o.hold);
 for(const[on,cc]of[[G.conL,u0-G.rl(n-1)-.25],[G.conR,u0+3+G.rl(n-1)+.25]]){if(!on)continue;const p=P(cc,13);c.fillStyle='#222';c.fillRect(p[0]-1,p[1]-11,2,11);c.fillStyle='#111';c.beginPath();c.roundRect(p[0]-3,p[1]-19,6,9,2);c.fill();const red=busy&&waiting;c.fillStyle=red?'#ff3b30':'#3a1a1a';c.beginPath();c.arc(p[0],p[1]-16.5,1.7,0,7);c.fill();c.fillStyle=red?'#123018':'#3bff6a';c.beginPath();c.arc(p[0],p[1]-12.5,1.7,0,7);c.fill();if(red||!busy){c.fillStyle=red?'rgba(255,60,40,.25)':'rgba(60,255,110,.2)';c.beginPath();c.arc(p[0],red?p[1]-16.5:p[1]-12.5,4,0,7);c.fill()}}
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
