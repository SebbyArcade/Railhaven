// ===================== v283 BRIDGE DECKS FOLLOW THE RAILS (Sébastien 2026-11-14: "Bridge rails not connecting", "Even when double rails") =====================
// Bridge decks were square tiles, so curves and double track ran over open water between them. Now the deck is laid along the rails
// themselves: every rail piece over water gets a deck strip under it (two overlapping strips for double track), then the piers and
// railings are drawn only on straight squares.
const BRDC={stone:['#8f8574','#a99f8a'],wood:['#4a3420','#7a5634'],truss:['#454a50','#5c6168'],susp:['#3c4248','#4e555c']};
let BRW=null;function brDecks(){if(typeof RG==='undefined'||!RG.on)return;const wet=(px,py)=>{const x=Math.floor(px/TS),y=Math.floor(py/TS);return x>=0&&y>=0&&x<N&&y<N&&terr[id(x,y)]===0};
 const key=track.size+':'+S.trains.length;if(!BRW||BRW.k!==key){const L=[];for(const i of track){const x=i%N,y=(i/N)|0;let w=false;for(let a=-2;a<=2&&!w;a++)for(let b=-2;b<=2;b++){const xx=x+a,yy=y+b;if(xx>=0&&yy>=0&&xx<N&&yy<N&&terr[id(xx,yy)]===0){w=true;break}}if(w)L.push(i)}BRW={k:key,L}}
 const runs=[];for(const i of BRW.L){if(!track.has(i))continue;
  for(const pl of RG.pieces(i)){if(!pl||pl.length<2)continue;let cur=null;for(let k=0;k<pl.length;k++){const p=pl[k];if(wet(p[0],p[1])){if(!cur){cur=[];if(k>0)cur.push(pl[k-1])}cur.push(p)}else if(cur){cur.push(p);runs.push(cur);cur=null}}if(cur)runs.push(cur)}}
 if(!runs.length)return;const sty=r=>{const p=r[(r.length/2)|0],x=Math.floor(p[0]/TS),y=Math.floor(p[1]/TS),k=id(x,y);let s='wood';try{if(track.has(k)){const r=(a,b)=>isRail(x+a,y+b),hz=r(1,0)||r(-1,0),ax=hz?1:0,ay=hz?0:1;let run=1;for(const sg of[-1,1]){let i=1;while(i<8&&terr[id(x+sg*i*ax,y+sg*i*ay)]===0&&track.has(id(x+sg*i*ax,y+sg*i*ay)))i++;run+=i-1}s=brSty(k,isDblD(x,y),run)}}catch(e){}return s},dw=r=>{const p=r[(r.length/2)|0];return isDblD(Math.floor(p[0]/TS),Math.floor(p[1]/TS))?24:28};
 const c=ctx;c.save();c.lineJoin='round';c.lineCap='butt';const path=r=>{c.beginPath();c.moveTo(r[0][0],r[0][1]);for(let k=1;k<r.length;k++)c.lineTo(r[k][0],r[k][1])};
 c.strokeStyle='rgba(0,20,40,.28)';for(const r of runs){c.lineWidth=dw(r);c.save();c.translate(3,5);path(r);c.stroke();c.restore()}
 for(const r of runs){const C=BRDC[sty(r)]||BRDC.wood;c.strokeStyle=C[0];c.lineWidth=dw(r)+3;path(r);c.stroke()}
 for(const r of runs){const C=BRDC[sty(r)]||BRDC.wood;c.strokeStyle=C[1];c.lineWidth=dw(r)-1;path(r);c.stroke()}
 c.restore()}
{const o=drawBridges;drawBridges=function(){if(typeof RG==='undefined'||!RG.on)return o.apply(this,arguments);brDecks();window._BRSK=1;try{return o.apply(this,arguments)}finally{window._BRSK=0}}}
// v283: a farm or camp that found no room to move next to the line looks further afield (12 squares) for room
// (Sébastien 2026-11-14: "I have 2 wheat farm versions": one farm had kept the old look with no yard).
function rgPinRetry(){if(S.rgP===283||S.rgMv!==277)return;S.rgP=283;if(!sites.some(o=>isYard(o)&&!o.hidden&&!ydOK(o)&&!o.yd))return;for(const o of sites)o._ok0=isYard(o)&&!o.hidden&&ydOK(o);window._RGR=12;S.rgMv=0;try{rgMoveAll()}catch(e){}finally{window._RGR=0;S.rgMv=277;for(const o of sites)delete o._ok0}}
{const o=rtTickEnd;rtTickEnd=function(){const r=o.apply(this,arguments);if(RG.on&&S.rgT===278&&S.rgR===281)try{rgPinRetry()}catch(e){}return r}}
// ===================== v283 BRIDGES DON'T REPLACE SHIPS (Sébastien 2026-11-14: "too easy and cheap to connect islands via bridges... kills the use of ships"; he chose "Both") =====================
// 1) No bridge may join two islands: water with land of two different islands (6+ squares) within 5 squares is a strait, crossed by dock and ship.
// 2) Bridges are for rivers and channels: the steel truss (3 squares from land, 8 squares of water) is the biggest; the suspension bridge is gone.
// 3) Bridge squares cost $500 / $1,500 / $3,500 by depth and $25/min each in upkeep. Bridges already built stay.
BRG[1].span=3;BRG[1].t='rivers, ponds and shallow water by the shore (up to 3 squares of water)';
BRG[2].span=5;BRG[2].t='wide rivers and inlets (up to 5 squares of water)';
BRG[3].d=3;BRG[3].span=8;BRG[3].lv=4;BRG[3].t='wide channels inside an island (up to 8 squares). Other islands are reached by ship';BRG.length=4;
{const o=brLvl;brLvl=function(){const L=o();if(L>3){S.brg=3;return 3}return L}}
const BRSTc=new Map();function brStrait(k){if(terr[k]!==0)return false;if(BRSTc.has(k))return BRSTc.get(k);const x=k%N,y=(k/N)|0,seen=new Set();
 for(let b=-5;b<=5;b++)for(let a=-5;a<=5;a++){const X=x+a,Y=y+b;if(X<0||Y<0||X>=N||Y>=N)continue;const c=ISLC[id(X,Y)];if(c>=0&&ISLS[c]&&ISLS[c].n>=6)seen.add(c)}
 const r=seen.size>=2;BRSTc.set(k,r);return r}
{const o=brOk;brOk=function(k){if(terr[k]===0&&brStrait(k)&&!track.has(k))return false;return o(k)}}
{const o=brErr;brErr=function(k){if(terr[k]===0&&brStrait(k)&&!track.has(k))return'🌊 Strait between two islands: bridges can\'t join islands. Build a ⚓ dock on each shore and sail a 🚢 ship';const d=terr[k]===0?wdOf(k):0;if(d>3)return'🌊 Too far from land for any bridge (bridges cross rivers and channels). Cross by ⚓ dock and 🚢 ship';return o(k)}}
brMul=function(k){const d=terr[k]===0?wdOf(k):0;return d<=0?1:[0,500,1500,3500][Math.min(3,d)]/35};
let BRUc={k:-1,n:0};function brUpk(){if(BRUc.k!==track.size){let n=0;for(const i of track)if(terr[i]===0)n++;BRUc={k:track.size,n}}return BRUc.n*25/60/.85}
