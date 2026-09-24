import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import assert from 'node:assert/strict';

const root=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
class ClassList{constructor(){this.s=new Set()}add(x){this.s.add(x)}remove(x){this.s.delete(x)}contains(x){return this.s.has(x)}toggle(x,v){if(v===undefined)v=!this.s.has(x);v?this.s.add(x):this.s.delete(x);return v}}
class El{
  constructor(id=''){this.id=id;this.classList=new ClassList();this.dataset={};this.textContent='';this.innerHTML='';this.hidden=false}
  addEventListener(){} querySelectorAll(){return []} closest(){return null} getBoundingClientRect(){return{left:0,top:0,right:156,bottom:108,width:156,height:108}}
  setPointerCapture(){} releasePointerCapture(){} hasPointerCapture(){return false}
}
const els=new Map();
const get=id=>{if(!els.has(id))els.set(id,new El(id));return els.get(id)};
const ctx2d=new Proxy({imageSmoothingEnabled:false,save(){},restore(){},translate(){},scale(){},drawImage(){},fillRect(){},strokeRect(){},fillText(){}},{set(o,k,v){o[k]=v;return true}});
get('game').getContext=()=>ctx2d;
const sandbox={
  console,Uint8Array,Math,Set,Map,Array,Object,Number,String,Boolean,Date,JSON,
  performance:{now:()=>0},requestAnimationFrame:()=>0,addEventListener:()=>{},
  document:{hidden:false,getElementById:get,querySelectorAll:()=>[],addEventListener:()=>{}},
  Image:class{set src(v){this._src=v}},localStorage:{_m:new Map(),getItem(k){return this._m.has(k)?this._m.get(k):null},setItem(k,v){this._m.set(k,String(v))},removeItem(k){this._m.delete(k)}},__VALKYRIE_TEST_MODE__:true
};
sandbox.globalThis=sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(root,'data.js'),'utf8'),sandbox,{filename:'data.js'});
vm.runInContext(fs.readFileSync(path.join(root,'app.js'),'utf8'),sandbox,{filename:'app.js'});
const T=sandbox.__VALKYRIE_TEST__, H=T.helpers;
assert.ok(T,'test API exposed');
T.start(true);T.grantStage8TestKit();
assert.equal(T.player.inventory.filter(x=>x.id).length,8,'S8 kit fills eight slots');
assert.equal(T.player.maxMp,240);assert.equal(T.player.mp,240);assert.ok(H.hasInventoryItem(0x17));assert.ok(H.hasInventoryItem(0x1A));

// Fireball: MaxMP/4 + 8 = 68 at 240 MP; ordinary class takes full damage.
H.clearActors();T.actors[0]={kind:'combat',cls:4,rec:1,pal:0,x:T.camera.x+124,y:T.camera.y+87,dir:1,desired:1,timer:20,age:32,logicFrame:0,hp:100,maxHp:100,power:1,xp:1,hitTimer:0,deathTimer:0};
const mp0=T.player.mp;T.castSpell(2);assert.equal(T.player.mp,mp0-5);T.updateSpellEffect();T.actors[0].x=T.camera.x+T.spell.x;T.actors[0].y=T.camera.y+T.spell.y;T.updateActors();assert.equal(T.actors[0].hp,32,'fireball damage 68');assert.equal(T.spell.type,0,'fireball clears on hit');

// Invisibility timer and Star Flute freeze.
T.castSpell(4);assert.equal(T.spell.timer,0x169);for(let i=0;i<0x169;i++)T.updateSpellEffect();assert.equal(T.spell.type,0);
H.clearActors();T.actors[0]={kind:'combat',cls:4,rec:1,pal:0,x:T.camera.x+160,y:T.camera.y+100,dir:3,desired:3,timer:1,age:32,logicFrame:0,hp:100,maxHp:100,power:1,xp:1,hitTimer:0,deathTimer:0};T.player.mp=240;T.castSpell(5);const [x0,y0]=[T.actors[0].x,T.actors[0].y];for(let i=0;i<30;i++)T.updateActors();assert.equal(T.actors[0].x,x0);assert.equal(T.actors[0].y,y0);T.spell.timer=1;T.updateSpellEffect();

// Lightning damages all combat actors immediately but leaves item slots alone.
H.clearActors();for(let i=0;i<3;i++)T.actors[i]={kind:'combat',cls:4,rec:1,pal:0,x:T.camera.x+100+i*20,y:T.camera.y+100,dir:3,desired:3,timer:20,age:32,logicFrame:0,hp:200,maxHp:200,power:1,xp:1,hitTimer:0,deathTimer:0};T.actors[3]={kind:'item',itemId:3,style:0,hidden:false,x:0,y:0};T.player.mp=240;T.castSpell(7);for(let i=0;i<3;i++){assert.ok(T.actors[i].hp<=168&&T.actors[i].hp>=105);assert.equal(T.actors[i].hitTimer,16)}assert.equal(T.actors[3].kind,'item');T.spell.timer=1;T.updateSpellEffect();

function findTile(targets){for(let y=0;y<5120;y+=8)for(let x=0;x<4096;x+=8){if(targets.includes(H.resolveLiveWorld(x,y).tile))return{x,y,tile:H.resolveLiveWorld(x,y).tile}}throw Error('tile not found '+targets)}
function aimAtTile(targets){const q=findTile(targets);H.setFacing(1);T.camera.x=q.x-0x78-8;T.camera.y=q.y-0x57-15;return q}

// Tiara gate opens to the same 2x2 open-gate patch as Key gate.
T.start(true);T.grantStage8TestKit();aimAtTile([0xFC,0xFE]);const ti=T.player.inventory.findIndex(x=>x.id===0x17);assert.ok(ti>=0);T.useInventorySlot(ti);assert.ok(T.terrainPatches.size>=4,'Tiara gate patch queued');assert.ok(H.hasInventoryItem(0x17),'zero-valued Tiara persists as infinite after first use');

// Soul of Sandra launches the moving pyramid opener and eventually writes 6D/6D/F9/FB.
H.clearActors();T.terrainPatches.clear();aimAtTile([0xF8,0xFA]);const so=T.player.inventory.findIndex(x=>x.id===0x10);T.useInventorySlot(so);assert.ok(T.actors.some(a=>a&&a.kind==='pyramid'));for(let i=0;i<180;i++)T.updateActors();assert.ok([...T.terrainPatches.values()].includes(0xF9),'pyramid exposes dungeon entrance');

// Tiara directional warp uses alternate destination table.
aimAtTile([0xF7]);assert.equal(T.tryDirectionalWarp(),true);assert.equal(T.camera.x,0x900);assert.equal(T.camera.y,0x300);

// Time Key plus required four relics enters ending handoff.
T.start(true);T.grantStage8TestKit();aimAtTile([0xE5,0xE7]);const tk=T.player.inventory.findIndex(x=>x.id===0x1A);T.useInventorySlot(tk);assert.equal(T.state.endingActive,true,'ending gate relic check');

// Stage 8 economy tables and four shop-profile selector behavior.
assert.equal(H.buyPrice(0x07),160,'Key buy price = unit 10 * 16');
assert.equal(H.sellPrice(0x07),80,'Key sell price = unit 10 * 8');
assert.equal(H.buyPrice(0x16),4000,'Super Tent max shop price');
T.camera.x=0x0200;assert.equal(H.shopProfileForWorld(),1,'X-high $02 selects profile 1');
T.camera.x=0x0A00;assert.equal(H.shopProfileForWorld(),2,'X-high $0A selects profile 2');

// Buying adds the item to the first free slot and subtracts exact buy price; selling clears it and returns half price.
T.start(true);T.player.gold=1000;const beforeSlots=T.player.inventory.filter(x=>x.id).length;assert.equal(T.buyShopItem(0x07),true);assert.equal(T.player.gold,840);assert.equal(T.player.inventory.filter(x=>x.id).length,beforeSlots+1);const keySlot=T.player.inventory.findIndex(x=>x.id===0x07);assert.ok(keySlot>=0);assert.equal(T.sellInventorySlot(keySlot),true);assert.equal(T.player.gold,920);assert.equal(T.player.inventory[keySlot].id,0);

// Save/load preserves durable game state but drops transient actors.
T.start(true);T.player.gold=1234;T.player.hp=31;T.player.maxHp=96;T.camera.x=0x0B20;T.camera.y=0x0910;T.fixedState[5]=0x80;H.setPatch2x2(T.camera.x,T.camera.y,[1,2,3,4]);H.addInventoryItem(0x07);T.actors[0]={kind:'projectile',x:0,y:0};assert.equal(T.quickSave(),true);T.player.gold=1;T.player.hp=1;T.camera.x=0;T.fixedState[5]=0;T.terrainPatches.clear();assert.equal(T.quickLoad(),true);assert.equal(T.player.gold,1234);assert.equal(T.player.hp,31);assert.equal(T.player.maxHp,96);assert.equal(T.camera.x,0x0B20);assert.equal(T.fixedState[5],0x80);assert.ok(T.terrainPatches.size>=4);assert.equal(T.actors.filter(Boolean).length,0,'transient actors are intentionally not restored');

// Hotel net service order: poison 20G, MP full 20G, then HP 1G per point, followed by checkpoint save.
T.start(true);T.player.gold=100;T.player.poison=true;T.player.mp=0;T.player.maxMp=32;T.player.hp=60;T.player.maxHp=64;const hotel=T.hotelRest();assert.equal(hotel.spent,44);assert.equal(T.player.gold,56);assert.equal(T.player.poison,false);assert.equal(T.player.mp,32);assert.equal(T.player.hp,64);assert.equal(hotel.saved,true);

// Death follows spin/hold/dusk/rise into Game Over; Game Over then auto-returns to title after 256 updates.
T.start(true);T.beginDeath();assert.equal(T.state.deathState,'sequence');for(let i=0;i<400&&T.state.deathState!=='gameover';i++)T.updateDeathSequence();assert.equal(T.state.deathState,'gameover');for(let i=0;i<256;i++)T.updateDeathSequence();assert.equal(T.state.mode,'title');

// Stage 9 character setup: zodiac low two bits select HP/MP, blood selects initial EXP curve.
const initialCurves=[2,1,3,1];
for(let blood=0;blood<4;blood++){
  T.start(true,{sign:0,blood,color:blood});
  assert.equal(T.player.maxHp,64);assert.equal(T.player.maxMp,32);assert.equal(T.player.expThresholdIndex,initialCurves[blood]);assert.equal(T.player.color,blood);
}
T.start(true,{sign:1,blood:0,color:0});assert.equal(T.player.maxHp,48);assert.equal(T.player.maxMp,48);
T.start(true,{sign:2,blood:0,color:0});assert.equal(T.player.maxHp,32);assert.equal(T.player.maxMp,64);
T.start(true,{sign:3,blood:0,color:0});assert.ok(T.player.maxHp>=32&&T.player.maxHp<=63);assert.equal(T.player.maxHp+T.player.maxMp,96);

// Stage 9 retail password codec: exercise all eight salts plus varied stats/traits/persisted flags.
const persistIds=[0x0F,0x12,0x14,0x18,0x17];
for(let i=0;i<32;i++){
  T.start(true,{sign:i%12,blood:i&3,color:(i>>1)&3});
  T.player.gold=(i*1770)%60001;T.player.xp=(i*33330)%601000;T.player.maxHp=1+(i*31)%999;T.player.maxMp=(i*67)%1000;
  T.player.level=1+(i%60);T.player.expThresholdIndex=(i*7)&255;T.player.passwordSalt=i&7;
  for(const slot of T.player.inventory){slot.id=0;slot.value=0}
  for(let b=0;b<5;b++)if(i&(1<<b)){T.player.inventory[b].id=persistIds[b];T.player.inventory[b].value=0xFF}
  const pw=T.encodeRetailPassword();assert.match(pw,/^[0-9A-V]{18}$/,'retail password uses 5-bit alphabet symbols');
  const d=T.decodeRetailPassword(pw);assert.equal(d.ok,true,`password roundtrip ${i}`);
  assert.equal(d.state.gold,Math.floor(T.player.gold/10)*10);assert.equal(d.state.xp,Math.floor(T.player.xp/10)*10);
  assert.equal(d.state.maxHp,T.player.maxHp);assert.equal(d.state.maxMp,T.player.maxMp);assert.equal(d.state.level,T.player.level);
  assert.equal(d.state.expThresholdIndex,T.player.expThresholdIndex);assert.equal(d.state.sign,T.player.sign);assert.equal(d.state.blood,T.player.blood);assert.equal(d.state.color,T.player.color);assert.equal(d.state.salt,i&7);
  assert.equal(d.state.flags,i&31);
}

// Checksum rejection and continue restoration semantics.
T.start(true,{sign:10,blood:2,color:3});T.player.gold=43219;T.player.xp=123459;T.player.maxHp=777;T.player.maxMp=888;T.player.level=23;T.player.expThresholdIndex=17;T.player.passwordSalt=5;
for(const slot of T.player.inventory){slot.id=0;slot.value=0}
persistIds.forEach((id,i)=>{T.player.inventory[i].id=id;T.player.inventory[i].value=0xFF});
const retailPw=T.encodeRetailPassword();const badPw=(retailPw[0]==='0'?'1':'0')+retailPw.slice(1);assert.equal(T.decodeRetailPassword(badPw).ok,false,'checksum rejects edited password');
const applied=T.applyRetailPassword(retailPw);assert.equal(applied.ok,true);assert.equal(T.player.gold,43210);assert.equal(T.player.xp,123450);assert.equal(T.player.hp,777);assert.equal(T.player.mp,888);assert.equal(T.player.level,23);assert.equal(T.player.expThresholdIndex,17);assert.equal(T.player.sign,10);assert.equal(T.player.blood,2);assert.equal(T.player.color,3);
assert.deepEqual(T.player.inventory.filter(x=>x.id).map(x=>x.id),persistIds,'password continue restores only five persisted special items when Super Sword is present');
assert.equal(T.player.equippedItem,0x0F);assert.equal(T.player.equipment.mantle,true);assert.equal(T.player.equipment.helmet,true);

// Hotel level-up occurs before paid services and advances the blood-type EXP curve.
T.start(true,{sign:0,blood:0,color:0});const hpBefore=T.player.maxHp,mpBefore=T.player.maxMp;T.player.xp=50;assert.equal(T.applyHotelLevelUps(),1);assert.equal(T.player.level,2);assert.equal(T.player.expThresholdIndex,4);assert.ok(T.player.maxHp>hpBefore);assert.ok(T.player.maxMp>mpBefore);
T.player.gold=100;T.player.hp=T.player.maxHp;T.player.mp=T.player.maxMp;const rest9=T.hotelRest();assert.equal(rest9.saved,true);assert.equal(T.decodeRetailPassword(rest9.password).ok,true);assert.equal(T.encodeRetailPassword(),rest9.password,'hotel checkpoint stores the same salt/password it displays');

// Stage 9 v2 quick save preserves character traits/level state.
T.player.level=11;T.player.expThresholdIndex=13;T.player.sign=7;T.player.blood=3;T.player.color=2;assert.equal(T.quickSave(),true);T.player.level=1;T.player.sign=0;T.player.blood=0;T.player.color=0;assert.equal(T.quickLoad(),true);assert.equal(T.player.level,11);assert.equal(T.player.expThresholdIndex,13);assert.equal(T.player.sign,7);assert.equal(T.player.blood,3);assert.equal(T.player.color,2);

// Full ending sequence progresses through the seven phases and reaches the permanent hold.
T.start(true);T.grantStage9TestKit();aimAtTile([0xE5,0xE7]);const timeKey9=T.player.inventory.findIndex(x=>x.id===0x1A);T.useInventorySlot(timeKey9);assert.equal(T.state.endingPhase,0);T.updateEnding();assert.equal(T.state.endingPhase,1);
for(let i=0;i<720;i++)T.updateEnding();assert.equal(T.state.endingPhase,2);T.updateEnding();assert.equal(T.state.endingPhase,3);T.updateEnding();assert.equal(T.state.endingPhase,4);
let guard=0;while(T.state.endingPhase!==5&&guard++<4000)T.updateEnding();assert.equal(T.state.endingPhase,5);assert.equal(T.state.endingScene,9);for(let i=0;i<240;i++)T.updateEnding();assert.equal(T.state.endingPhase,6);assert.equal(T.state.endingScroll,240);

console.log('Stage 9 regression: PASS');
