(() => {
'use strict';
const canvas=document.getElementById('game'), ctx=canvas.getContext('2d');
ctx.imageSmoothingEnabled=false;
const keys=new Set();
let mode='title', debug=false, frame=0;
const camera={x:0x0100,y:0x0800};
const PLAYER_SCREEN={x:0x78,y:0x57};
let facing=1, moving=false, bump=0;
const img={};
let loaded=0;
for (const [k,src] of Object.entries({title:'assets/title_tiles.png',world:'assets/world_tiles.png',spr:'assets/sprites.png'})) {
  const im=new Image(); im.onload=()=>{img[k]=im;if(++loaded===3) requestAnimationFrame(loop)}; im.src=src;
}
function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function resolveWorld(x,y){
  x=((x%4096)+4096)%4096; y=clamp(y,0,5119);
  const row=(y>>7); const col=(x>>8)&15; const mid=VDATA.top[row*16+col];
  const mc=(((y>>5)&3)*8)+((x>>5)&7); const id32=VDATA.macro[mid*32+mc];
  const q32=(((y>>4)&1)*2)+((x>>4)&1); const id16=VDATA.b32[id32*4+q32];
  const q16=(((y>>3)&1)*2)+((x>>3)&1); const tile=VDATA.b16[id16*4+q16];
  return {tile,pal:VDATA.bpal[id16],id16};
}
function drawBgTile(atlas,tile,pal,x,y){ctx.drawImage(atlas,tile*8,pal*8,8,8,Math.round(x),Math.round(y),8,8)}
function titlePaletteAt(col,row){const ai=((row>>2)*8)+(col>>2); const a=VDATA.titleAttrs[ai]||0; const sh=((row&2)?4:0)+((col&2)?2:0); return (a>>sh)&3}
function drawTitle(){
  ctx.fillStyle='#000';ctx.fillRect(0,0,256,240);
  for(let r=0;r<30;r++) for(let c=0;c<32;c++) drawBgTile(img.title,VDATA.titleTiles[r*32+c],titlePaletteAt(c,r),c*8,r*8);
  // Recovered title scripts draw START at row 18. Keep cursor as a frontend-native overlay for this milestone.
  const pulse=((frame>>5)&1); ctx.fillStyle=pulse?'#fff':'#aaa'; ctx.fillRect(104,146,3,2);ctx.fillRect(102,148,5,2);ctx.fillRect(100,150,7,2);
  ctx.fillStyle='rgba(0,0,0,.70)';ctx.fillRect(0,216,256,24);ctx.fillStyle='#fff';ctx.font='8px monospace';ctx.fillText('ENTER / START',92,229);
}
function isPlayerBlocked(dir){
  // Recovered collision probes: Up(8,11), Down(8,15), Left(6,13), Right(10,13).
  const probes=[[8,11],[8,15],[6,13],[10,13]]; const [ox,oy]=probes[dir];
  const wx=camera.x+PLAYER_SCREEN.x+ox, wy=camera.y+PLAYER_SCREEN.y+oy; const t=resolveWorld(wx,wy).tile;
  // Stage-1 rule: exact retail threshold. Special-terrain dispatch is a later milestone.
  return t>=0x60;
}
function requestedDir(){
  if(keys.has('ArrowUp')||keys.has('KeyW')) return 0;
  if(keys.has('ArrowDown')||keys.has('KeyS')) return 1;
  if(keys.has('ArrowLeft')||keys.has('KeyA')) return 2;
  if(keys.has('ArrowRight')||keys.has('KeyD')) return 3;
  return -1;
}
function updatePlayer(){
  const d=requestedDir(); moving=false;
  if(d<0) return; facing=d;
  if(isPlayerBlocked(d)){bump=5;return}
  if(d===0) camera.y--; else if(d===1) camera.y++; else if(d===2) camera.x--; else camera.x++;
  camera.x=clamp(camera.x,0,0x0EFF);camera.y=clamp(camera.y,0,0x092F);moving=true;
}
const simpleBase={1:0x01,2:0x09,3:0x11,4:0x15,10:0xA1,11:0xA5,68:0x26};
function draw8x16(tile,pal,x,y,flip=false){
  ctx.save(); if(flip){ctx.translate(Math.round(x)+8,0);ctx.scale(-1,1);x=0}else x=Math.round(x);
  ctx.drawImage(img.spr,tile*8,pal*16,8,16,x,Math.round(y),8,16);ctx.restore();
}
function drawSimpleMeta(id,pal,x,y,hflip=false){
  const base=simpleBase[id] ?? 0x01;
  if(!hflip){draw8x16(base,pal,x,y,false);draw8x16((base+2)&255,pal,x+8,y,false)}
  else {draw8x16((base+2)&255,pal,x,y,true);draw8x16(base,pal,x+8,y,true)}
}
function playerMeta(){
  // Recovered PlayerMoveMetaspriteTable: moving bank has two 8-frame phases.
  if(!moving) return {id:[2,1,3,3][facing],flip:facing===2};
  const phase=(frame>>3)&1;
  const id=(phase?[13,12,3,3]:[2,1,4,4])[facing];
  return {id,flip:facing===2};
}
function terrainPassableForActor(x,y){const t=resolveWorld(x+8,y+14).tile;return t<0x60 || t===0xEC||t===0xED||t===0xEE||t===0xF6}
function findSpawn(){
  const px=camera.x+PLAYER_SCREEN.x, py=camera.y+PLAYER_SCREEN.y;
  for(let radius=72;radius<160;radius+=8){for(let a=0;a<32;a++){const ang=a/32*Math.PI*2;const x=Math.round((px+Math.cos(ang)*radius)/8)*8;const y=Math.round((py+Math.sin(ang)*radius)/8)*8;if(terrainPassableForActor(x,y))return{x,y}}}
  return{x:px+80,y:py};
}
let enemy={...findSpawn(),dir:0,timer:40,phase:0};
function chooseEnemyDir(){
  const px=camera.x+PLAYER_SCREEN.x,py=camera.y+PLAYER_SCREEN.y,dx=px-enemy.x,dy=py-enemy.y;
  if(Math.abs(dx)>Math.abs(dy)) enemy.dir=dx<0?7:3; else enemy.dir=dy<0?1:5; // ACTDIR W/E/N/S approximated in 8-dir enum
  enemy.timer=32+Math.floor(Math.random()*64);
}
const actorDelta={1:[0,-1],2:[1,-1],3:[1,0],4:[1,1],5:[0,1],6:[-1,1],7:[-1,0],8:[-1,-1]};
function updateEnemy(){
  if(--enemy.timer<=0)chooseEnemyDir();
  if((frame&3)!==0){const d=actorDelta[enemy.dir]||[0,0];const nx=enemy.x+d[0],ny=enemy.y+d[1];if(terrainPassableForActor(nx,ny)){enemy.x=nx;enemy.y=ny}}
  enemy.phase=(frame>>4)&1;
}
function drawWorld(){
  ctx.fillStyle='#000';ctx.fillRect(0,0,256,240);
  const ox=-(camera.x&7),oy=-(camera.y&7);
  const sx=camera.x&~7,sy=camera.y&~7;
  for(let r=-1;r<28;r++) for(let c=-1;c<33;c++) {const wx=sx+c*8,wy=sy+r*8;if(wy<0||wy>=5120)continue;const z=resolveWorld(wx,wy);drawBgTile(img.world,z.tile,z.pal,ox+c*8,oy+r*8)}
  // Tatta sample actor from recovered simple metasprites $0A/$0B, palette 2.
  const ex=enemy.x-camera.x,ey=enemy.y-camera.y; if(ex>-20&&ex<260&&ey>-24&&ey<218)drawSimpleMeta(enemy.phase?11:10,2,ex,ey,false);
  const pm=playerMeta(); drawSimpleMeta(pm.id,0,PLAYER_SCREEN.x,PLAYER_SCREEN.y,pm.flip);
  if(bump>0){ctx.strokeStyle='#fff';ctx.strokeRect(PLAYER_SCREEN.x-1,PLAYER_SCREEN.y-1,18,18);bump--}
  ctx.fillStyle='rgba(0,0,0,.82)';ctx.fillRect(0,216,256,24);ctx.fillStyle='#fff';ctx.font='8px monospace';ctx.fillText('VALKYRIE  STAGE 1',8,229);
  ctx.fillText('ARROWS/WASD',166,229);
  if(debug){ctx.fillStyle='rgba(0,0,0,.78)';ctx.fillRect(4,4,152,38);ctx.fillStyle='#7CFF91';ctx.fillText(`CAM $${camera.x.toString(16).padStart(4,'0')} $${camera.y.toString(16).padStart(4,'0')}`,8,14);ctx.fillText(`TILE $${resolveWorld(camera.x+128,camera.y+96).tile.toString(16).padStart(2,'0')}`,8,24);ctx.fillText(`TATTA ${enemy.x|0},${enemy.y|0}`,8,34)}
}
function update(){frame++; if(mode==='game'){updatePlayer();updateEnemy()}}
let acc=0,last=performance.now();
function loop(t){const dt=Math.min(100,t-last);last=t;acc+=dt;while(acc>=1000/60){update();acc-=1000/60}if(mode==='title')drawTitle();else drawWorld();requestAnimationFrame(loop)}
function start(){if(mode==='title'){mode='game';camera.x=0x0100;camera.y=0x0800;enemy={...findSpawn(),dir:0,timer:40,phase:0}}}
addEventListener('keydown',e=>{if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();if(e.code==='Enter'){start();return}if(e.code==='KeyR'){mode='title';return}if(e.code==='F2'&&!e.repeat){e.preventDefault();debug=!debug;return}keys.add(e.code)});
addEventListener('keyup',e=>keys.delete(e.code));
document.getElementById('startBtn').addEventListener('click',start);
for(const b of document.querySelectorAll('[data-key]')){const k=b.dataset.key;const on=e=>{e.preventDefault();keys.add(k)};const off=e=>{e.preventDefault();keys.delete(k)};b.addEventListener('pointerdown',on);b.addEventListener('pointerup',off);b.addEventListener('pointercancel',off);b.addEventListener('pointerleave',off)}
})();
