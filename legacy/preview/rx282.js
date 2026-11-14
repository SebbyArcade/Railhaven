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
// a train entering a station moves over to its platform track along the entry switch, never sideways in one go
function rxSt(f){return function(t,px,py){const d=f(t,px,py);if(t._sq!==t._sqL){t._sqL=t._sq;t._sqA=t._sq?{P:t.path,p:t.pos}:null}const A=t._sqA;if(!A||A.P!==t.path)return d;const u=Math.max(0,Math.min(1,(t.pos-A.p)/1.2)),e=u*u*(3-2*u);if(e>=1)return d;return[d[0]*e,d[1]*e,(d[2]||0)*e]}}
