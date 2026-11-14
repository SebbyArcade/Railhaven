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
 RG.segs=function(SEG,x0,y0,x1,y1){for(const i of track){const x=i%N,y=(i/N)|0;if(x<x0-3||x>x1+3||y<y0-3||y>y1+3)continue;const p=pieces(i);if(p.length)SEG.push(p);if(typeof JAM!=='undefined'&&JAM[i]>4&&!isDblD(x,y))SEG.push({jam:i,cx:x*TS+TS/2,cy:y*TS+TS/2})}};
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
  const cand=[];const RR=window._RGR||7;for(let y=oy-RR;y<=oy+RR;y++)for(let x=ox-RR;x<=ox+RR;x++){if(x<2||y<2||x>=N-2||y>=N-2)continue;if(pin?(x!==ox||y!==oy):(x===ox&&y===oy))continue;const i=id(x,y);if(!pin&&(track.has(i)||siteAt(x,y)||!rev[i]))continue;
   let bad='';if(!pin)try{bad=fac?siteSpot(x,y):indSpot(x,y,s.type)}catch(e){bad='x'}if(bad)continue;for(const c of ydCands(x,y,s.type,0,pin?s:null)){const lr=c.hz?y-c.sd:x-c.sd;let nl=0;for(let u=c.u0-1;u<=c.u0+4;u++){const[a,b]=c.hz?[u,lr]:[lr,u];if(!track.has(id(a,b)))nl++}cand.push({x,y,c,nl,v:nl*3+Math.hypot(x-ox,y-oy)-c.sc*.5})}}
  cand.sort((a,b)=>a.v-b.v);let done=false;
  for(const q of cand.slice(0,window._RGR?40:12)){if(done)break;const{x,y,c}=q;
   const T0=new Set(track),D0=new Set(dblSet),deg=nb0.length,thru=deg>=2&&!pin;
   s.x=x;s.y=y;delete s.yd;YFK='';if(thru&&!pin)track.add(oi);
   try{ydApply(s,c,0)}catch(e){}computeNet();const G=ydG(s);const endOn=u=>{const[a,b]=G.hz?[u,G.lr]:[G.lr,u];return!!(NET&&NET[id(a,b)])};const on=()=>endOn(G.u0-1)||endOn(G.u0+4);
   let extra=0;if(!on()){let p=null;try{p=planRoute(x,y,s)}catch(e){}if(p&&p.length<=5){for(const j of p)if(!track.has(j)){track.add(j);extra++}computeNet()}}
   if(ydOK(s)&&on()&&extra+q.nl<=10&&!(window._RGR&&sites.some(o=>o!==s&&o._ok0&&!ydOK(o)))){done=true;
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
