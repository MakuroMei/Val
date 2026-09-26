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
vm.runInContext(fs.readFileSync(path.join(root,'audio_data.js'),'utf8'),sandbox,{filename:'audio_data.js'});
vm.runInContext(fs.readFileSync(path.join(root,'audio.js'),'utf8'),sandbox,{filename:'audio.js'});
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

// Save/load preserves durable game state but drops transient actors and Stage 24-correct live nametable patches.
T.start(true);T.player.gold=1234;T.player.hp=31;T.player.maxHp=96;T.camera.x=0x0B20;T.camera.y=0x0910;T.fixedState[5]=0x80;H.setPatch2x2(T.camera.x,T.camera.y,[1,2,3,4]);H.addInventoryItem(0x07);T.actors[0]={kind:'projectile',x:0,y:0};assert.equal(T.quickSave(),true);T.player.gold=1;T.player.hp=1;T.camera.x=0;T.fixedState[5]=0;T.terrainPatches.clear();assert.equal(T.quickLoad(),true);assert.equal(T.player.gold,1234);assert.equal(T.player.hp,31);assert.equal(T.player.maxHp,96);assert.equal(T.camera.x,0x0B20);assert.equal(T.fixedState[5],0x80);assert.equal(T.terrainPatches.size,0,'VRAM-only terrain patches are intentionally not restored');assert.equal(T.actors.filter(Boolean).length,0,'transient actors are intentionally not restored');

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


// Stage 10 audio request engine: sequence timing runs without WebAudio, logical-voice priority preempts correctly,
// BGM groups follow realm/poison/ending state, and mute state is safe before AudioContext unlock.
const A=sandbox.VAudio;assert.ok(A,'Stage 10 audio API exposed');
A.allOff();assert.equal(A.start(0x10),true);assert.ok(A.active.includes(0x10),'sword request starts');
A.start(0x08);assert.ok(A.active.includes(0x08),'higher-priority hurt request starts');assert.ok(!A.active.includes(0x10),'same logical voice lower request ID preempts sword');
for(let i=0;i<40;i++)A.tick();assert.ok(!A.active.includes(0x08),'finite hurt request reaches END');
A.allOff();A.ensureBgm({game:true,realm:'surface',poison:false,ending:false});assert.equal(A.active.join(','),'49,50,51');
A.ensureBgm({game:true,realm:'surface',poison:true,ending:false});assert.equal(A.active.join(','),'43,44,45,49,50,51');
A.ensureBgm({game:true,realm:'dungeon',poison:false,ending:false});assert.equal(A.active.join(','),'46,47,48');
A.ensureBgm({game:false,realm:'surface',poison:false,ending:true});assert.equal(A.active.join(','),'52,53,54');
const m0=A.status().muted;A.toggleMuted();assert.equal(A.status().muted,!m0);A.toggleMuted();assert.equal(A.status().muted,m0);
T.start(true);T.player.hp=15;H.audioSync();assert.ok(A.active.includes(0x09),'low-HP warning starts below 16 HP');T.player.hp=16;H.audioSync();assert.ok(!A.active.includes(0x09),'low-HP warning stops at 16 HP');

// Stage 11 retail RNG: exact XNOR LFSR recovered from AdvanceGlobalRng.
H.setRng(0);assert.deepEqual([H.rng8(),H.rng8(),H.rng8(),H.rng8(),H.rng8()],[1,3,7,15,31],'retail RNG starts 00→01→03→07→0F→1F');

// Stage 11 item-value semantics and Lamp states.
T.start(true);assert.equal(H.addInventoryItem(0x04),true);let superPotion=T.player.inventory.findIndex(x=>x.id===0x04);T.player.hp=1;T.useInventorySlot(superPotion);assert.equal(T.player.hp,33);assert.equal(T.player.inventory[superPotion].value,3,'Super Potion decrements 4→3');
assert.equal(H.addInventoryItem(0x02),true);const blueLamp=T.player.inventory.findIndex(x=>x.id===0x02);assert.equal(T.player.inventory[blueLamp].value,0);T.useInventorySlot(blueLamp);assert.equal(T.player.equipment.lamp,true);assert.equal(T.player.inventory[blueLamp].value,0xFF,'zero-valued Blue Lamp becomes persistent FF after first consume-path use');
H.setWorldClock(0x7F);T.update();assert.equal(T.state.worldClockSecond,0);assert.equal(T.state.worldDay,1);assert.equal(T.player.equipment.lamp,false,'new day clears temporary surface Lamp flag');

// Day/night phase thresholds match the recovered world-clock boundaries.
H.setWorldClock(0x00);assert.equal(H.dayPhase(),'DAWN');H.setWorldClock(0x08);assert.equal(H.dayPhase(),'DAY');H.setWorldClock(0x68);assert.equal(H.dayPhase(),'DUSK');H.setWorldClock(0x70);assert.equal(H.dayPhase(),'NIGHT');

// Dungeon Lamp is a local lighting state and survives quick save/load.
T.start(true);T.camera.y=0x0A00;assert.equal(H.addInventoryItem(0x01),true);const lamp=T.player.inventory.findIndex(x=>x.id===0x01);T.useInventorySlot(lamp);assert.equal(T.player.equipment.dungeonLit,true);assert.equal(T.player.inventory[lamp].value,3);assert.equal(T.quickSave(),true);T.player.equipment.dungeonLit=false;assert.equal(T.quickLoad(),true);assert.equal(T.player.equipment.dungeonLit,true,'dungeon lighting persists in frontend quick-save state');

// Mantle blocks climate hazard; without it the same terrain tick costs 1 HP.
T.start(true);H.setFrameCounter(0);const hpClimate=T.player.hp;H.dispatchSpecialTerrain({tile:0xEE,wx:0,wy:0},0);assert.equal(T.player.hp,hpClimate-1);T.player.hp=T.player.maxHp;assert.equal(H.addInventoryItem(0x11),true);const mantleSlot=T.player.inventory.findIndex(x=>x.id===0x11);T.useInventorySlot(mantleSlot);assert.equal(T.player.equipment.mantle,true);H.dispatchSpecialTerrain({tile:0xEE,wx:0,wy:0},0);assert.equal(T.player.hp,T.player.maxHp,'Mantle blocks climate decrement');

// Helmet halves actor/projectile Power by LSR before subtraction.
T.start(true);assert.equal(H.addInventoryItem(0x13),true);const helmetSlot=T.player.inventory.findIndex(x=>x.id===0x13);T.useInventorySlot(helmetSlot);assert.equal(T.player.equipment.helmet,true);H.setRng(1);const hpHelmet=T.player.hp;assert.equal(H.damageFromActorPower(9,'TEST'),4);assert.equal(T.player.hp,hpHelmet-4);

// The two recovered 1/256 equipment-break rolls are deterministic under chosen RNG states.
T.player.equipment.helmet=true;T.player.equipment.mantle=true;H.setRng(128);assert.equal(H.maybeBreakDefensiveEquipment(),'helmet');assert.equal(T.player.equipment.helmet,false);assert.equal(T.player.equipment.mantle,true);
T.player.equipment.mantle=true;H.setRng(192);assert.equal(H.maybeBreakDefensiveEquipment(),'mantle');assert.equal(T.player.equipment.mantle,false);

// Blue defensive equipment follows the zero→FF persistent consume quirk.
T.start(true);assert.equal(H.addInventoryItem(0x12),true);const blueMantle=T.player.inventory.findIndex(x=>x.id===0x12);T.useInventorySlot(blueMantle);assert.equal(T.player.equipment.mantle,true);assert.equal(T.player.inventory[blueMantle].value,0xFF);
assert.equal(H.addInventoryItem(0x14),true);const blueHelmet=T.player.inventory.findIndex(x=>x.id===0x14);T.useInventorySlot(blueHelmet);assert.equal(T.player.equipment.helmet,true);assert.equal(T.player.inventory[blueHelmet].value,0xFF);

// Stage 11 mobile UI exposes the status/equipment panel in the same corner menu.
const html12=fs.readFileSync(path.join(root,'index.html'),'utf8');assert.match(html12,/data-action="status"/);assert.match(html12,/id="statusPanel"/);

// Stage 12 poison is a raw 1 HP tick every 32 frames, without actor-hit handling.
T.start(true);T.player.hp=20;T.player.poison=true;H.setFrameCounter(0x1F);T.updatePlayerStatusEffects();assert.equal(T.player.hp,20,'poison waits until frame multiple of 32');H.setFrameCounter(0x20);T.updatePlayerStatusEffects();assert.equal(T.player.hp,19,'poison drains 1 HP on 32-frame tick');

// Sink starts a 60-frame hazard sequence: 16 HP at frame 20, release at frame 60.
T.start(true);T.player.hp=64;H.dispatchSpecialTerrain({tile:0xED,wx:0x100,wy:0x100},0);assert.equal(T.state.sinkSequenceActive,true);assert.equal(T.state.hazardTimer,0);for(let i=0;i<19;i++)T.updatePlayerStatusEffects();assert.equal(T.player.hp,64);assert.equal(T.state.hazardTimer,19);T.updatePlayerStatusEffects();assert.equal(T.player.hp,48,'sink hits for 16 HP at timer 20');for(let i=20;i<60;i++)T.updatePlayerStatusEffects();assert.equal(T.state.sinkSequenceActive,false);assert.equal(T.state.hazardTimer,0);

// Swim damage is per accepted movement dispatch, not a periodic climate tick.
T.start(true);T.player.hp=64;H.dispatchSpecialTerrain({tile:0xF5,wx:0,wy:0},3);assert.equal(T.player.hp,63,'swim costs 1 HP per accepted movement');assert.equal(T.player.terrainMode,'swim');

// Magic Rainbow consumes Magic Ship at world second 00, clears actors, forces right movement, then ends at second 04.
T.start(true);for(const slot of T.player.inventory){slot.id=0;slot.value=0}assert.equal(H.addInventoryItem(0x1B),true);H.clearActors();T.actors[0]={kind:'combat',cls:4,rec:3,x:T.camera.x+160,y:T.camera.y+87,age:32,logicFrame:0,hp:8,maxHp:8,power:1,xp:1,dir:7,desired:7,timer:1,hitTimer:0,deathTimer:0};H.setWorldClock(0);assert.equal(T.triggerMagicRainbow(),true);assert.equal(H.hasInventoryItem(0x1B),false,'Magic Ship consumed');assert.equal(T.state.magicRainbowActive,true);assert.equal(T.actors.filter(Boolean).length,1);assert.equal(T.actors[0].kind,'rainbow');const rainbowX=T.camera.x;T.update();assert.equal(T.camera.x,rainbowX+1,'Rainbow sequence forces rightward travel');H.setWorldClock(4);T.updatePlayerStatusEffects();assert.equal(T.state.magicRainbowActive,false);T.updateActors();assert.equal(T.actors.filter(Boolean).length,0,'Rainbow actor frees itself at world second 04');

// High-HP Tatta fires at retarget, using the same six-slot actor pool.
T.start(true);H.clearActors();T.actors[0]={kind:'combat',cls:4,rec:3,pal:0,x:T.camera.x+160,y:T.camera.y+87,dir:7,desired:7,timer:1,age:32,logicFrame:0,hp:0x18,maxHp:0x18,power:4,xp:1,hitTimer:0,deathTimer:0,aimedInterval:false,zounaTimer:0xFF,zounaVisible:true,flyChase:false,zuhlHasStolen:false,persistence:0xFF,fixed:false};T.updateActors();assert.ok(T.actors.some(a=>a&&a.kind==='projectile'),'Tatta with HP >= 24 fires on retarget');

// Black Sandra remains stationary until player enters its 0x3A proximity square.
T.start(true);H.clearActors();T.actors[0]={kind:'combat',cls:5,rec:8,pal:0,x:T.camera.x+220,y:T.camera.y+180,dir:7,desired:7,timer:1,age:32,logicFrame:0,hp:40,maxHp:40,power:4,xp:1,hitTimer:0,deathTimer:0,aimedInterval:false,zounaTimer:0xFF,zounaVisible:true,flyChase:false,zuhlHasStolen:false,persistence:0xFF,fixed:false};const bx=T.actors[0].x,by=T.actors[0].y;T.updateActors();assert.equal(T.actors[0].x,bx);assert.equal(T.actors[0].y,by,'Black Sandra idles out of acquisition range');

// Fly Drill toggles into chase mode on the recovered 1/16 mode-switch gate.
T.start(true);H.clearActors();T.actors[0]={kind:'combat',cls:7,rec:0x18,pal:0,x:T.camera.x+160,y:T.camera.y+87,dir:7,desired:7,timer:1,age:32,logicFrame:0,hp:40,maxHp:40,power:4,xp:1,hitTimer:0,deathTimer:0,aimedInterval:false,zounaTimer:0xFF,zounaVisible:true,flyChase:false,zuhlHasStolen:false,persistence:0xFF,fixed:false};H.setFrameCounter(0);H.setRng(0);const fx=T.actors[0].x;T.updateActors();assert.equal(T.actors[0].flyChase,true);assert.notEqual(T.actors[0].x,fx,'Fly Drill chase mode moves at full actor-update speed');

// Zuhl steals only the first occupied inventory item, stores only its ID, and returns a fresh item when defeated.
T.start(true);T.zuhlStolenPool.fill(0);const stolenId=T.player.inventory.find(x=>x.id)?.id;const z={zuhlHasStolen:false};assert.equal(H.zhulStealFirstItem(z),stolenId);assert.equal(z.zuhlHasStolen,true);assert.equal(T.zuhlStolenPool[0],stolenId);assert.equal(T.player.inventory.some(x=>x.id===stolenId),false,'stolen slot item ID is cleared');assert.equal(H.returnOneZuhlStolenItem(),stolenId);assert.equal(T.zuhlStolenPool[0],0);assert.equal(T.player.inventory.some(x=>x.id===stolenId),true,'returned stolen ID is re-added as a fresh item');

// Zuhl pool is durable frontend state and survives quick-save/load.
T.zuhlStolenPool[0]=0x07;assert.equal(T.quickSave(),true);T.zuhlStolenPool.fill(0);assert.equal(T.quickLoad(),true);assert.equal(T.zuhlStolenPool[0],0x07);

// Stage 12 mobile menu exposes the AI test spawner and Stage 12 test kit.
assert.match(html12,/data-action="spawn-ai"/);assert.match(html12,/S12 測試套件/);

// Stage 13 quest-item actions are one-frame latches: using them away from a valid target must not arm a later interaction.
T.start(true);for(const slot of T.player.inventory){slot.id=0;slot.value=0}
assert.equal(H.addInventoryItem(0x07),true);let actionSlot=T.player.inventory.findIndex(x=>x.id===0x07);T.useInventorySlot(actionSlot);assert.equal(T.player.itemActionFlags,0,'Key action clears after same-frame miss');assert.equal(T.player.inventory[actionSlot].value,3,'Key charge still consumed on miss');
assert.equal(H.addInventoryItem(0x08),true);actionSlot=T.player.inventory.findIndex(x=>x.id===0x08);T.useInventorySlot(actionSlot);assert.equal(T.player.itemActionFlags,0,'Gold Key action clears after same-frame miss');assert.equal(T.player.inventory[actionSlot].id,0x08,'Gold Key remains reusable');
assert.equal(H.addInventoryItem(0x10),true);actionSlot=T.player.inventory.findIndex(x=>x.id===0x10);T.useInventorySlot(actionSlot);assert.equal(T.player.itemActionFlags,0,'Soul action clears after miss');assert.equal(T.player.inventory[actionSlot].value,3,'Soul of Sandra decrements 4→3 even on miss');
assert.equal(H.addInventoryItem(0x17),true);actionSlot=T.player.inventory.findIndex(x=>x.id===0x17);T.useInventorySlot(actionSlot);assert.equal(T.player.itemActionFlags,0,'Tiara action clears after miss');assert.equal(T.player.inventory[actionSlot].value,0xFF,'zero-valued Tiara wraps to infinite on first consume-path use');
assert.equal(H.addInventoryItem(0x1A),true);actionSlot=T.player.inventory.findIndex(x=>x.id===0x1A);T.useInventorySlot(actionSlot);assert.equal(T.player.itemActionFlags,0,'Time Key action clears after miss');assert.equal(T.player.inventory[actionSlot].value,0xFF);

// Stage 13 movement-mode metasprites follow the recovered PlayerMoveMetaspriteTable.
T.start(true);T.player.terrainMode='swim';assert.equal(H.playerMoveMeta().id,0x08);T.player.terrainMode='ship';assert.equal(H.playerMoveMeta().id,0x26);T.player.terrainMode='marco';assert.equal(H.playerMoveMeta().id,0xCC);assert.equal(H.playerMoveMeta().kind,'complex');T.player.terrainMode='sink';assert.equal(H.playerMoveMeta().id,0x45);

// A swimmer cannot promote straight into deep-water Magic Ship/Marco handling; retail E9 exits early for swim mode.
T.start(true);for(const slot of T.player.inventory){slot.id=0;slot.value=0}H.addInventoryItem(0x1B);T.player.terrainMode='swim';assert.equal(H.dispatchSpecialTerrain({tile:0xE9,wx:0,wy:0},3),false);assert.equal(T.player.terrainMode,'swim');

// Recovered terrain interaction marker pairs blink at the fixed HUD OAM position.
H.setFrameCounter(0);let q=aimAtTile([0xF0,0xF1,0xF2,0xF3]);let mark=H.terrainEventMarker();assert.deepEqual([mark.tile,mark.pal],[0x49,3]);q=aimAtTile([0xF8,0xFA]);mark=H.terrainEventMarker();assert.deepEqual([mark.tile,mark.pal],[0x53,2]);q=aimAtTile([0xFC,0xFE]);mark=H.terrainEventMarker();assert.deepEqual([mark.tile,mark.pal],[0x55,1]);H.setFrameCounter(4);assert.equal(H.terrainEventMarker(),null,'marker hidden on blink-off phase');

// Lightning preserves the retail ActorAuxD collision: fixed combat persistence metadata is clobbered to $10 before damage.
T.start(true);T.player.maxMp=240;T.player.mp=240;H.clearActors();T.actors[0]={kind:'combat',cls:4,rec:1,pal:0,x:T.camera.x+150,y:T.camera.y+90,dir:3,desired:3,timer:20,age:32,logicFrame:0,hp:200,maxHp:200,power:1,xp:1,hitTimer:0,deathTimer:0,persistence:5,fixed:true};T.castSpell(7);assert.equal(T.actors[0].persistence,0x10);

// Four pre-rendered R2 atlases keep equipment graphics ROM-free at runtime.
for(let i=0;i<4;i++)assert.ok(fs.existsSync(path.join(root,`assets/player_r2_${i}.png`)),`player R2 atlas ${i}`);assert.notDeepEqual(fs.readFileSync(path.join(root,'assets/player_r2_0.png')),fs.readFileSync(path.join(root,'assets/player_r2_3.png')));

// Mobile corner menu preserves the Stage 13 movement-mode helper.
assert.match(html12,/data-action="move-mode"/);assert.match(html12,/S13 · 切換移動模式測試/);

// Stage 14/15: retail combat actors have a strict ±12 anchor overlap body and contribute
// the recovered previous-frame D-pad block mask instead of letting the player walk through them.
function bodyActor(dx,dy,extra={}){return {kind:'combat',cls:4,rec:1,pal:0,x:T.camera.x+0x78+dx,y:T.camera.y+0x57+dy,dir:7,desired:7,timer:99,age:32,logicFrame:0,hp:8,maxHp:8,power:0,xp:1,hitTimer:0,deathTimer:0,aimedInterval:false,zounaTimer:0xFF,zounaVisible:true,flyChase:false,zuhlHasStolen:false,persistence:0xFF,fixed:false,...extra}}
T.start(true);H.clearActors();T.actors[0]=bodyActor(10,0);T.updateActors();assert.equal(T.state.actorPlayerMoveBlockMask,0x80,'actor on player right blocks RIGHT');assert.equal(H.actorMovementBlocked(3),true);assert.equal(H.actorMovementBlocked(2),false);assert.equal(H.movementAllowed(3),true,'start tile permits right movement, isolating actor block');const bodyBlockCamX=T.camera.x;H.setHeldDirection(3);T.updatePlayer();assert.equal(T.camera.x,bodyBlockCamX,'player camera does not advance through overlapping actor');H.setHeldDirection(-1);
H.clearActors();T.actors[0]=bodyActor(-10,0);T.updateActors();assert.equal(T.state.actorPlayerMoveBlockMask,0x40,'actor on player left blocks LEFT');
H.clearActors();T.actors[0]=bodyActor(0,-10);T.updateActors();assert.equal(T.state.actorPlayerMoveBlockMask,0x10,'actor above player blocks UP');
H.clearActors();T.actors[0]=bodyActor(0,10);T.updateActors();assert.equal(T.state.actorPlayerMoveBlockMask,0x20,'actor below player blocks DOWN');
H.clearActors();T.actors[0]=bodyActor(10,10);T.updateActors();assert.equal(T.state.actorPlayerMoveBlockMask,0xA0,'lower-right diagonal blocks DOWN + RIGHT');
H.clearActors();T.actors[0]=bodyActor(12,0);T.updateActors();assert.equal(T.state.actorPlayerMoveBlockMask,0,'strict edge at 12 px is not overlap');

// Spawn animation has no body. Stage 15 corrects the earlier approximation: during the
// first 8 knockback frames a hit enemy is still a solid overlapping actor, exactly like
// ActorCombatKernel which applies knockback and then continues into the body-overlap path.
H.clearActors();T.actors[0]=bodyActor(10,0,{age:0});T.updateActors();assert.equal(T.state.actorPlayerMoveBlockMask,0,'spawn phase does not block player');
H.clearActors();T.actors[0]=bodyActor(4,0,{hitTimer:40,knockDir:0});const ky=T.actors[0].y;T.updateActors();assert.equal(T.actors[0].y,ky-6,'first hit-reaction frame applies recovered 6px knockback');assert.notEqual(T.state.actorPlayerMoveBlockMask,0,'knockback phase remains body-solid after displacement');
H.clearActors();T.actors[0]=bodyActor(4,0,{hitTimer:32,knockDir:0});T.updateActors();assert.notEqual(T.state.actorPlayerMoveBlockMask,0,'late hit reaction remains body-solid');

// Multiple overlapping actors OR their directional masks exactly like ActorPlayerMoveBlockMask.
H.clearActors();T.actors[0]=bodyActor(10,0);T.actors[1]=bodyActor(0,-10);T.updateActors();assert.equal(T.state.actorPlayerMoveBlockMask,0x90,'right + above actors combine RIGHT + UP blocks');

// Stage 15 actor dispatch now uses the retail viewport: X 0..247 and Y 0..191 only.
T.start(true);H.clearActors();T.actors[0]={kind:'item',itemId:3,style:0,hidden:false,persistence:0xFF,pal:1,meta:0x30,x:T.camera.x+247,y:T.camera.y+191,age:32,logicFrame:0,goldAmount:0,fixed:false};T.updateActors();assert.ok(T.actors[0],'actor at 247,191 remains in retail viewport');
H.clearActors();T.actors[0]={kind:'item',itemId:3,style:0,hidden:false,persistence:0xFF,pal:1,meta:0x30,x:T.camera.x+248,y:T.camera.y+100,age:32,logicFrame:0,goldAmount:0,fixed:false};T.updateActors();assert.equal(T.actors[0],null,'actor at X=248 is culled');
H.clearActors();T.actors[0]={kind:'item',itemId:3,style:0,hidden:false,persistence:0xFF,pal:1,meta:0x30,x:T.camera.x+100,y:T.camera.y+192,age:32,logicFrame:0,goldAmount:0,fixed:false};T.updateActors();assert.equal(T.actors[0],null,'actor at Y=192 is culled');

// Ground enemy rollback does not force an early retarget. Find a passable→solid one-pixel
// boundary in the ROM hierarchy, point Tatta into it, and verify only the normal timer DEC occurs.
let wallSpot=null;
outer:for(let sy=16;sy<5100;sy+=8){for(let bx=16;bx<4080;bx+=8){const ax=bx-9,ay=sy-14;if(H.terrainPassableForActor(ax,ay)&&!H.terrainPassableForActor(ax+1,ay)){wallSpot={x:ax,y:ay};break outer}}}
assert.ok(wallSpot,'found passable-to-solid actor terrain edge');T.camera.x=Math.max(0,wallSpot.x-100);T.camera.y=Math.max(0,wallSpot.y-80);H.clearActors();T.actors[0]={kind:'combat',cls:4,rec:1,pal:0,x:wallSpot.x,y:wallSpot.y,dir:3,desired:3,timer:50,age:32,logicFrame:0,hp:8,maxHp:8,power:0,xp:1,hitTimer:0,deathTimer:0,aimedInterval:false,zounaTimer:0xFF,zounaVisible:true,flyChase:false,zuhlHasStolen:false,persistence:0xFF,fixed:false};const wx0=T.actors[0].x;T.updateActors();assert.equal(T.actors[0].x,wx0,'Tatta rolls back at solid ROM terrain');assert.equal(T.actors[0].timer,49,'wall collision does not force retarget timer to 1');

// Zouna's spawn timer finishes at 1 in retail, so its first active AI update immediately wraps
// and teleports 24px toward the player instead of waiting a full 255-update cycle.
T.start(true);H.clearActors();const px=T.camera.x+0x78,py=T.camera.y+0x57;T.actors[0]={kind:'combat',cls:10,rec:0x17,pal:0,x:px+48,y:py,dir:0,desired:0,timer:1,age:31,logicFrame:31,hp:120,maxHp:120,power:4,xp:1,hitTimer:0,deathTimer:0,aimedInterval:false,zounaTimer:0xFF,zounaVisible:true,flyChase:false,zuhlHasStolen:false,persistence:0xFF,fixed:false};const zx=T.actors[0].x;T.updateActors();assert.equal(T.actors[0].x,zx-24,'Zouna teleports on first active update');assert.equal(T.actors[0].zounaTimer,0xFF);

// Spawn animation alternates the recovered $44/$43 metasprites every actor update.
assert.equal(H.spawnFlashMeta(1),0x44);assert.equal(H.spawnFlashMeta(2),0x43);assert.equal(H.spawnFlashMeta(3),0x44);

// Enemy HUD uses eight 32-HP segments with 4-HP partial steps, matching the recovered tile math.
assert.deepEqual(Array.from(H.enemyHudSegments(64)),[8,8,0,0,0,0,0,0]);assert.deepEqual(Array.from(H.enemyHudSegments(36)),[8,1,0,0,0,0,0,0]);

// Stage 16: desired-direction high nibble uses the retail screen dead zone exactly:
// X=$70..$7F and Y=$4F..$5E are centered, not the older approximate ±6 helper.
T.start(true);const center={x:T.camera.x+0x78,y:T.camera.y+0x57};
let dirActor={x:center.x+7,y:center.y};assert.equal(H.updateDesiredDirection(dirActor),0,'+7px remains in retail horizontal dead zone');
dirActor={x:center.x+8,y:center.y};assert.equal(H.updateDesiredDirection(dirActor),7,'+8px is west toward player');
dirActor={x:center.x-8,y:center.y};assert.equal(H.updateDesiredDirection(dirActor),0,'-8px remains centered');
dirActor={x:center.x-9,y:center.y};assert.equal(H.updateDesiredDirection(dirActor),3,'-9px is east toward player');
dirActor={x:center.x,y:center.y+7};assert.equal(H.updateDesiredDirection(dirActor),0,'+7px Y remains centered');
dirActor={x:center.x,y:center.y+8};assert.equal(H.updateDesiredDirection(dirActor),1,'+8px Y is north toward player');
dirActor={x:center.x,y:center.y-9};assert.equal(H.updateDesiredDirection(dirActor),5,'-9px Y is south toward player');

// ActorCombatKernel returns INTERACTION on body overlap. Most enemy AIs service animation /
// contact cadence only on that result and do not continue movement or retarget timers.
T.start(true);H.clearActors();T.actors[0]=bodyActor(10,0,{timer:50,dir:7,desired:7,logicFrame:0});const ix=T.actors[0].x;T.updateActors();assert.equal(T.actors[0].x,ix,'overlapping Tatta does not keep walking through player');assert.equal(T.actors[0].timer,50,'overlapping Tatta does not decrement movement timer');
T.actors[0].x=center.x+20;T.updateActors();assert.equal(T.actors[0].timer,49,'Tatta timer resumes once body overlap ends');

// Shared AI proximity box is strict < $3A per axis. Black Sandra stays idle at 58px,
// but acquires at 57px and enters a randomized chase interval.
T.start(true);H.clearActors();T.actors[0]=bodyActor(58,0,{cls:5,rec:8,timer:1,hp:40,maxHp:40});T.updateActors();assert.equal(T.actors[0].blackSandraIdle,true,'Black Sandra idles at exact 58px boundary');assert.equal(T.actors[0].timer,1);
H.clearActors();T.actors[0]=bodyActor(57,0,{cls:5,rec:8,timer:1,hp:40,maxHp:40});T.updateActors();assert.notEqual(T.actors[0].blackSandraIdle,true,'Black Sandra acquires strictly inside 58px box');assert.ok(T.actors[0].timer>=0x16&&T.actors[0].timer<=0x55);

// Star Flute locks AI after the kernel's single ActorFrame increment. The previous frontend
// accidentally incremented the actor clock twice while frozen.
T.start(true);T.player.maxMp=240;T.player.mp=240;H.clearActors();T.actors[0]=bodyActor(50,0,{logicFrame:10,timer:50});T.castSpell(5);T.updateActors();assert.equal(T.actors[0].logicFrame,11,'Star Flute advances actor frame exactly once per update');

// Shizasu is the exception: COMBAT_RESULT_LOCKED still services its 16-frame contact cadence.
T.start(true);H.clearActors();T.player.hp=64;H.setRng(0);T.actors[0]=bodyActor(10,0,{cls:15,rec:0x26,logicFrame:15,hitTimer:10,power:4,hp:80,maxHp:80});T.updateActors();assert.equal(T.player.hp,60,'locked Shizasu can still apply overlap damage on its cadence');

// Robotian's aimed interval intentionally ignores Invisibility in retail. It tracks the
// kernel desired direction and fires anyway; only its alternating random interval is random.
T.start(true);T.player.maxMp=240;T.player.mp=240;T.castSpell(4);H.clearActors();T.actors[0]=bodyActor(40,0,{cls:9,rec:0x0C,timer:1,aimedInterval:false,power:3,hp:80,maxHp:80,dir:1,desired:1});T.updateActors();assert.equal(T.actors[0].dir,7,'Robotian aimed interval tracks player even while invisible');assert.ok(T.actors.some((a,i)=>i!==0&&a&&a.kind==='projectile'),'Robotian aimed interval still fires while invisible');

// There is deliberately no enemy-vs-enemy body solver: retail only builds actor→player
// overlap/block state, so enemies may overlap each other. Stage 16 does not invent physics.

// Mobile corner menu preserves the Stage 16 combat-lock helper.
assert.match(html12,/data-action="collision-test"/);assert.match(html12,/S16 · 包圍碰撞測試/);

// Stage 17: common combat spawns begin with retail motion state 0, a $20 spawn timer,
// and no body collision while the $44/$43 spawn flash is still active.
T.start(true);H.clearActors();let p17={x:T.camera.x+0x78,y:T.camera.y+0x57};
assert.equal(H.initActorFromSpawnToken(0x80|0x12,p17.x+48,p17.y),true);let ko=T.actors.find(a=>a&&a.kind==='combat');
assert.equal(ko.cls,6,'record $12 is Koakuman');assert.equal(ko.dir,0,'common enemy current motion state starts at 0');assert.equal(ko.desired,0);assert.equal(ko.timer,0x20);assert.equal(ko.age,0);
T.updateActors();assert.equal(ko.age,1);assert.equal(ko.timer,0x1F);assert.equal(T.state.actorPlayerMoveBlockMask,0,'spawn flash has no player body block');
for(let i=1;i<31;i++)T.updateActors();assert.equal(ko.age,31);assert.equal(ko.timer,1);
T.updateActors();assert.equal(ko.age,32);assert.ok(ko.timer>=0x16&&ko.timer<=0x55,'Koakuman immediately consumes spawn-finish timer=1 and chooses first retarget interval');assert.ok([1,3,5,7].includes(ko.dir),'Koakuman first retarget resolves to a cardinal strafe direction');

// Sochikisu is the recovered class exception: it spawns already facing east ($03).
H.clearActors();assert.equal(H.initActorFromSpawnToken(0x80|0x22,p17.x+48,p17.y),true);let s17so=T.actors.find(a=>a&&a.kind==='combat');assert.equal(s17so.cls,8,'record $22 is Sochikisu');assert.equal(s17so.dir,3);assert.equal(s17so.timer,0x20);

// Retail HP subtraction detects death on 16-bit underflow, not exact zero. Exact lethal
// damage leaves HP at 0 until a later positive damage event underflows the high byte.
T.start(true);H.setHeldDirection(-1);T.player.hp=4;T.player.maxHp=64;assert.equal(H.subtractPlayerHpRetail(4),4);assert.equal(T.player.hp,0);assert.equal(T.player.hpUnderflow,false);T.updatePlayer();assert.equal(T.player.dead,false,'exact-zero HP is still alive in retail quirk');
H.subtractPlayerHpRetail(1);assert.equal(T.player.hpUnderflow,true);T.updatePlayer();assert.equal(T.player.dead,true,'next positive damage underflows and starts death');assert.equal(T.state.deathState,'sequence');

// Shared enemy projectile spawn aims from the freshly computed desired direction rather
// than inheriting a stale current movement direction. This locks the FAA3 helper behavior.
T.start(true);H.clearActors();p17={x:T.camera.x+0x78,y:T.camera.y+0x57};const shooter={kind:'combat',rec:0x0C,power:7,x:p17.x+40,y:p17.y,dir:3,desired:3};assert.equal(H.spawnEnemyProjectile(shooter,false),true);const shot=T.actors.find(a=>a&&a.kind==='projectile');assert.ok(shot);assert.equal(shot.dir,7,'projectile aims west toward player although shooter current direction was east');assert.equal(shooter.dir,3,'parent current direction remains unchanged');

// Stage 17 mobile menu exposes the spawn-timing stress helper.
assert.match(html12,/data-action="spawn-timing"/);assert.match(html12,/S17 · 出生節奏測試/);

// Stage 18: actor/contact damage has no invulnerability gate. HurtBlink is a 32-tick
// visual palette sequence only, and additional hits while it is active do not restart it.
T.start(true);T.player.hp=64;T.player.hurtBlink=0;assert.equal(H.damageFromActorPower(4,'TEST'),4);assert.equal(T.player.hp,60);assert.equal(T.player.hurtBlink,32);
T.player.hurtBlink=17;assert.equal(H.damageFromActorPower(3,'TEST'),3);assert.equal(T.player.hp,57,'second hit still damages during hurt flash');assert.equal(T.player.hurtBlink,17,'repeat hit does not restart retail HurtBlinkTimer');
T.player.hurtBlink=25;assert.equal(H.hurtBlinkPaletteActive(),false,'elapsed 7 still normal palette');T.player.hurtBlink=24;assert.equal(H.hurtBlinkPaletteActive(),true,'elapsed 8 enters palette-3 phase');assert.equal(H.playerRenderPalette(),3);T.player.hurtBlink=20;assert.equal(H.hurtBlinkPaletteActive(),false,'elapsed 12 restores normal palette');

// Hit reaction completion and death-start are separate actor updates in retail.
T.start(true);H.clearActors();T.actors[0]=bodyActor(30,0,{hp:0,maxHp:8,hitTimer:1,deathTimer:0,power:0});T.updateActors();assert.equal(T.actors[0].hitTimer,0);assert.equal(T.actors[0].deathTimer,0,'hit reaction finish tick does not start death animation');T.updateActors();assert.equal(T.actors[0].deathTimer,8,'following actor update starts the $1B death sequence');

// Mobile menu exposes the Stage 18 contact cadence / hurt-flash stress helper.
assert.match(html12,/data-action="contact-timing"/);assert.match(html12,/S18 · 接觸傷害節奏測試/);

// Stage 19: retail Gold additions saturate at exactly 60000, including Gold Bag pickup.
T.start(true);T.player.gold=59995;assert.equal(H.addGoldRetail(10),5);assert.equal(T.player.gold,60000);assert.equal(H.addGoldRetail(99),0);assert.equal(T.player.gold,60000);
T.start(true);T.player.gold=59995;H.clearActors();const p19={x:T.camera.x+0x78,y:T.camera.y+0x57};T.actors[0]={kind:'item',itemId:0x1C,style:0,hidden:false,persistence:0xFF,pal:0,meta:0x44,x:p19.x+8,y:p19.y,age:32,logicFrame:0,goldAmount:10,fixed:false};T.updateActors();assert.equal(T.player.gold,60000,'Gold Bag pickup obeys retail cap');assert.equal(T.actors[0],null,'picked Gold Bag frees actor slot');

// Projectile sword collision is deliberately broader than combat-enemy collision: retail
// uses TestActorPlayerBox(2) but skips SwordHitFacingArcTable. A shot behind the player
// can therefore be cut if it is still strictly inside the directional sword rectangle.
T.start(true);H.clearActors();H.setFacing(3);H.setAttackHitActive(true);assert.equal(H.swordRectOverlapsPoint(p19.x-15,p19.y),true);assert.equal(H.swordBoxOverlapsPoint(p19.x-15,p19.y),false,'combat actor facing arc would reject the same behind-player point');T.actors[0]={kind:'projectile',projectileType:'normal',cls:12,rec:0x0C,pal:1,x:p19.x-15,y:p19.y,dir:7,desired:7,age:0,logicFrame:0,power:1,impactTimer:0,meta:0x31};T.updateActors();assert.equal(T.actors[0].impactTimer,8,'projectile uses sword rectangle without combat facing arc');

// Stage 19 mobile helper exposes the drop/Gold/projectile stress setup.
assert.match(html12,/data-action="drop-lifecycle"/);assert.match(html12,/S19 · 掉落 \/ Gold \/ 子彈判定測試/);

// Stage 20: hidden fixed items are visually hidden only. Retail Actor_ItemPickup checks
// the body box before presentation flags, so exact-location blind pickup works without
// True Sight. A full inventory still leaves the actor untouched/nonmutating.
T.start(true);H.clearActors();const p20={x:T.camera.x+0x78,y:T.camera.y+0x57};const before20=T.player.inventory.filter(x=>x.id).length;
T.actors[0]={kind:'item',itemId:0x03,style:1,hidden:true,persistence:0xFF,pal:0,meta:0x44,x:p20.x+8,y:p20.y,age:32,logicFrame:0,goldAmount:0,fixed:false};
T.updateActors();assert.equal(T.actors[0],null,'hidden item can be blind-picked without True Sight');assert.equal(T.player.inventory.filter(x=>x.id).length,before20+1);assert.ok(H.hasInventoryItem(0x03));

T.start(true);T.grantStage8TestKit();H.clearActors();assert.equal(T.player.inventory.filter(x=>x.id).length,8,'precondition: full inventory');
T.actors[0]={kind:'item',itemId:0x03,style:1,hidden:true,persistence:0xFF,pal:0,meta:0x44,x:T.camera.x+0x78+8,y:T.camera.y+0x57,age:32,logicFrame:0,goldAmount:0,fixed:false};
T.updateActors();assert.ok(T.actors[0]&&T.actors[0].hidden,'full inventory leaves hidden pickup in-place');assert.equal(T.player.inventory.filter(x=>x.id).length,8);

// Retail actor rendering alternates queue order by FrameCounter parity. This only affects
// overlap priority; actor update order remains slot 0..5.
H.setFrameCounter(0);assert.deepEqual(Array.from(H.actorRenderOrder()),[0,1,2,3,4,5]);H.setFrameCounter(1);assert.deepEqual(Array.from(H.actorRenderOrder()),[5,4,3,2,1,0]);

// Stage 20 mobile helper exposes hidden-pickup / overlap-priority behavior.
assert.match(html12,/data-action="hidden-render"/);assert.match(html12,/S20 · 隱藏拾取 \/ 重疊顯示測試/);

// Stage 21 BIG UPDATE: entering a recovered interior is now a real GameMode transition.
T.start(true);T.player.gold=5000;assert.equal(T.beginInterior('shop'),true);assert.equal(T.state.gameMode,'ENTER_INTERIOR');
for(let i=0;i<33;i++)T.update();assert.equal(T.state.gameMode,'INTERIOR');assert.equal(T.state.interior.type,'shop');assert.equal(T.state.interior.x,0xD0);assert.equal(T.state.interior.y,0xA0);

// The six recovered shelf zones resolve through the selected world-X shop profile and B buys.
H.setInteriorPos(0x58,0x50);const shelf21=T.shopShelfSelection();assert.ok(shelf21);assert.equal(shelf21.index,0);const inv21=T.player.inventory.filter(x=>x.id).length,gold21=T.player.gold;H.setPressed('Space');T.update();assert.equal(T.player.inventory.filter(x=>x.id).length,inv21+1);assert.equal(T.player.gold,gold21-shelf21.price);

// Left-side shop service zone enters the dedicated transaction GameMode; A cancels.
H.setInteriorPos(0x20,0x70);assert.equal(H.beginShopTransaction(),true);assert.equal(T.state.gameMode,'SHOP_TRANSACTION');H.setPressed('KeyX');T.update();assert.equal(T.state.gameMode,'INTERIOR');

// Retail right-door coordinate hands off through a 256px leave stream plus four stable frames.
H.setInteriorPos(0xC8,0x35);H.setHeldDirection(0);T.update();assert.equal(T.state.gameMode,'LEAVE_INTERIOR');H.setHeldDirection(-1);for(let i=0;i<37;i++)T.update();assert.equal(T.state.gameMode,'GAMEPLAY');

// Hotel bed is spatial, automatic service: poison 20G, MP 20G, then 1G per missing HP,
// followed by a local checkpoint when the sequence ends.
T.start(true);T.player.gold=100;T.player.poison=true;T.player.mp=0;T.player.maxMp=32;T.player.hp=60;T.player.maxHp=64;assert.equal(T.beginInterior('hotel'),true);for(let i=0;i<33;i++)T.update();assert.equal(T.state.gameMode,'INTERIOR');H.setInteriorPos(0x40,0x80);for(let i=0;i<24;i++)T.update();assert.equal(T.player.poison,false);assert.equal(T.player.mp,32);assert.equal(T.player.hp,64);assert.equal(T.player.gold,56);assert.equal(T.state.interior.restActive,false);

// Mobile UI now exposes A ACTION and the two DEV shortcuts enter the physical interiors.
assert.match(html12,/data-key="KeyX">A<br>ACTION/);assert.match(html12,/S21 · 進入實體商店/);assert.match(html12,/S21 · 進入實體旅館/);

// Stage 22 FRONT-END REBUILD: title is now a three-phase GameMode flow with a recovered
// 240-update scroll-in. No gameplay actor state is needed for this phase.
T.resetTitleFrontend(false);assert.equal(T.state.mode,'title');assert.equal(T.state.gameMode,'TITLE');assert.equal(T.state.front.phase,0);
T.updateFrontend();assert.equal(T.state.front.phase,1);
for(let i=0;i<239;i++)T.updateFrontend();assert.equal(T.state.front.titleScroll,239);assert.equal(T.state.front.phase,1);
T.updateFrontend();assert.equal(T.state.front.titleScroll,240);assert.equal(T.state.front.phase,2,'title reaches interactive menu after 240 scroll updates');

// SELECT-equivalent toggles New Game / Continue and START-equivalent enters character setup.
const titlePick22=T.state.front.continueSelected;H.frontPress('KeyX');T.updateFrontend();assert.equal(T.state.front.continueSelected,!titlePick22);
// Select NEW GAME deterministically for the character-setup path.
if(T.state.front.continueSelected){H.frontPress('KeyX');T.updateFrontend()}
H.frontPress('Enter');T.updateFrontend();assert.equal(T.state.gameMode,'CHARACTER_SETUP');assert.equal(T.state.front.mode,'CHARACTER_SETUP');
T.updateFrontend();assert.equal(T.state.front.phase,1);
H.frontPress('ArrowRight');T.updateFrontend();assert.equal(T.state.front.choices[0],1,'zodiac increments on right');
H.frontPress('ArrowDown');T.updateFrontend();assert.equal(T.state.front.cursor,1);H.frontPress('ArrowLeft');T.updateFrontend();assert.equal(T.state.front.choices[1],3,'blood type wraps left');
H.frontPress('ArrowDown');T.updateFrontend();assert.equal(T.state.front.cursor,2);H.frontPress('ArrowRight');T.updateFrontend();assert.equal(T.state.front.choices[2],1,'color increments on right');

// Confirming new-game setup routes through the password/new-game handoff and then the
// recovered 256px / 8px GAME_INIT stream before normal gameplay begins.
H.frontPress('Enter');T.updateFrontend();assert.equal(T.state.gameMode,'PASSWORD_ENTRY');T.updateFrontend();assert.equal(T.state.gameMode,'GAME_INIT');assert.equal(T.state.gameInitProgress,0);
for(let i=0;i<31;i++)T.update();assert.equal(T.state.gameMode,'GAME_INIT');assert.equal(T.state.gameInitProgress,248);T.update();assert.equal(T.state.gameMode,'GAMEPLAY');
assert.equal(T.player.sign,1);assert.equal(T.player.blood,3);assert.equal(T.player.color,1,'character setup values survive into new game');

// Continue without a local save enters the recovered 18-symbol password editor. A bad
// password holds the error state for exactly 60 front-end ticks and the third reject
// returns to the title flow.
sandbox.localStorage._m.clear();T.resetTitleFrontend(true);assert.equal(T.state.front.phase,2);
if(!T.state.front.continueSelected){H.frontPress('KeyX');T.updateFrontend()}
H.frontPress('Enter');T.updateFrontend();assert.equal(T.state.gameMode,'CHARACTER_SETUP');T.updateFrontend();assert.equal(T.state.gameMode,'PASSWORD_ENTRY');T.updateFrontend();assert.equal(T.state.front.phase,1);
for(let attempt=1;attempt<=3;attempt++){
  H.setFrontPassword(Array(18).fill(0));H.frontPress('Enter');T.updateFrontend();assert.equal(T.state.front.phase,2);assert.equal(T.state.front.passwordFailures,attempt);
  for(let i=0;i<59;i++)T.updateFrontend();assert.equal(T.state.front.phase,2,'password error delay remains active through tick 59');
  T.updateFrontend();
  if(attempt<3){assert.equal(T.state.front.phase,0);T.updateFrontend();assert.equal(T.state.front.phase,1,'password editor redraws after reject')}else{assert.equal(T.state.gameMode,'TITLE');assert.equal(T.state.front.mode,'TITLE','third reject returns to title')}
}

// Attract starts after 10 completed title-idle seconds, performs the recovered 256px
// stream, and exits when its world clock reaches 60 seconds.
T.resetTitleFrontend(true);for(let i=0;i<600;i++)T.updateFrontend();assert.equal(T.state.gameMode,'ATTRACT_DEMO');assert.equal(T.state.front.mode,'ATTRACT');
T.updateFrontend();assert.equal(T.state.front.phase,1);for(let i=0;i<32;i++)T.updateFrontend();assert.equal(T.state.front.phase,2);assert.equal(T.state.front.attractStream,256);
H.setWorldClock(59);T.updateFrontend();assert.equal(T.state.gameMode,'TITLE');assert.equal(T.state.front.phase,0,'attract timeout returns to the title build/scroll flow');

// Stage 22 mobile/front-end surfaces are present in the actual HTML.
assert.match(html12,/ACTION\/SELECT/);assert.match(html12,/ATTACK\/START/);assert.match(html12,/data-action="frontend-test"/);assert.match(html12,/S22 · 回前台互動標題/);assert.match(html12,/Stage 2\d/);
console.log('Stage 7-22 legacy regression: PASS');

// Stage 23 ITEM/SPELL MENU: recovered selector behavior and top-level GameMode.
T.start(true);for(const slot of T.player.inventory){slot.id=0;slot.value=0}
assert.equal(H.addInventoryItem(0x03),true);assert.equal(H.addInventoryItem(0x07),true);assert.equal(H.addInventoryItem(0x09),true);
T.player.maxMp=160;T.player.mp=160;T.player.selectedSpell=0;
assert.equal(H.highestUnlockedSpell(),5,'MaxMP 160 unlocks through Star Flute');
assert.equal(T.beginItemSpellMenu(),true);assert.equal(T.state.gameMode,'ITEM_SPELL_MENU');
const menuStart=T.state.itemSpellMenu.inventoryCursor;
H.setPressed('ArrowRight');T.updateItemSpellMenu();assert.notEqual(T.state.itemSpellMenu.inventoryCursor,menuStart,'right moves inventory selector to next occupied slot');
const afterRight=T.state.itemSpellMenu.inventoryCursor;H.setPressed('ArrowLeft');T.updateItemSpellMenu();assert.equal(T.state.itemSpellMenu.inventoryCursor,menuStart,'left wraps/skips back to occupied slot');
H.setPressed('ArrowUp');T.updateItemSpellMenu();assert.equal(T.player.selectedSpell,1,'UP increments spell selector');
H.setPressed('ArrowDown');T.updateItemSpellMenu();assert.equal(T.player.selectedSpell,0,'DOWN decrements/wraps spell selector');

// A has priority and exits with a deferred spell cast; the next gameplay update consumes MP.
T.player.selectedSpell=2;const mp23=T.player.mp;H.setPressed('KeyX');T.updateItemSpellMenu();assert.equal(T.state.gameMode,'GAMEPLAY');assert.equal(T.state.itemSpellMenu.pendingSpellCast,true);T.update();assert.equal(T.state.itemSpellMenu.pendingSpellCast,false);assert.equal(T.player.mp,mp23-5);assert.equal(T.spell.type,2,'deferred Fireball begins on gameplay update');T.spell.type=0;T.spell.timer=0;

// B uses the selected item and exits. Cursor keeps retail slot identity even if it becomes empty.
T.beginItemSpellMenu();let potionSlot=T.player.inventory.findIndex(x=>x.id===0x03);T.state.itemSpellMenu.inventoryCursor=potionSlot;T.player.hp=Math.max(1,T.player.maxHp-40);const hp23=T.player.hp;H.setPressed('Space');T.updateItemSpellMenu();assert.equal(T.state.gameMode,'GAMEPLAY');assert.ok(T.player.hp>hp23,'B uses selected Potion');assert.equal(T.player.inventory[potionSlot].id,0,'consumed slot becomes empty');

// Menu cancel is a pure mode handoff with no item/spell action.
T.beginItemSpellMenu();const mpCancel=T.player.mp;H.setPressed('KeyI');T.updateItemSpellMenu();assert.equal(T.state.gameMode,'GAMEPLAY');assert.equal(T.player.mp,mpCancel);

// Same-frame arbitration: a gameplay menu request does not end the old handler. A later
// death store therefore supersedes ITEM_SPELL_MENU, matching the recovered dispatcher semantics.
T.start(true);T.player.hp=0;T.player.hpUnderflow=true;H.setPressed('KeyI');T.update();assert.equal(T.player.dead,true);assert.equal(T.state.gameMode,'DEATH','same-frame death overrides earlier menu request');

// Death completion now exposes the recovered top-level GAME_OVER state rather than only a frontend flag.
for(let i=0;i<400&&T.state.deathState!=='gameover';i++)T.updateDeathSequence();assert.equal(T.state.gameMode,'GAME_OVER');

// Mobile/special corner menu now opens the in-canvas retail-style menu instead of the old HTML inventory panel.
assert.match(html12,/data-action="inventory">🎒 ITEM \/ SPELL MENU/);assert.match(html12,/Stage 2\d/);
console.log('Stage 23 regression: PASS');


// Stage 24 PALETTE / STREAMING / OAM: exact recovered background family assets exist.
for(const f of ['world_group_a.png','world_group_b.png','dungeon_palettes.png'])assert.ok(fs.existsSync(path.join(root,'assets',f)),`Stage24 asset ${f}`);
assert.notDeepEqual(fs.readFileSync(path.join(root,'assets/world_group_a.png')),fs.readFileSync(path.join(root,'assets/world_group_b.png')),'A/B CHR+palette atlases differ');
T.start(true);H.setWorldGraphicsGroup(0);H.setWorldClock(0x00);assert.equal(T.surfacePaletteFamily(),0);H.setWorldClock(0x10);assert.equal(T.surfacePaletteFamily(),1);H.setWorldClock(0x72);assert.equal(T.surfacePaletteFamily(),2);T.player.equipment.lamp=true;assert.equal(T.surfacePaletteFamily(),3,'surface Lamp selects dedicated recovered palette family');
T.player.equipment.lamp=false;assert.equal(T.state.worldGraphicsGroup,0);T.runStage24VisualTest();assert.equal(T.state.worldGraphicsGroup,1,'S24 visual test flips A/B graphics group');

// Runtime terrain mutation is nametable-local, not a persistent ROM edit/checkpoint field.
T.start(true);T.runStage24VisualTest();assert.ok(T.terrainPatches.size>=4);const snap24=T.snapshotGame();assert.equal(Array.from(snap24.terrainPatches).length,0,'checkpoint omits transient live nametable mutations');T.camera.y+=216;T.serviceTerrainPatchStreaming();assert.equal(T.terrainPatches.size,0,'one recovered 27-tile vertical stream height overwrites live 2x2 terrain patches');

// Recovered dynamic OAM budget is 30 hardware 8x16 sprites. Player/spell reserve first slots;
// actor metasprites consume the rest, and component counts reflect simple/complex descriptors.
assert.equal(T.metaComponentCount(0x44),1);assert.equal(T.metaComponentCount(0x01),2);assert.equal(T.metaComponentCount(0xD0),10);assert.equal(T.metaComponentCount(0xD1),4);
T.start(true);assert.ok(T.playerOamComponentCount()>=1&&T.playerOamComponentCount()<=3);T.runStage24VisualTest();
// drawWorld is exercised through the exposed render hook in the VM loop in browser; here the count math
// locks the crucial allocation rule: six 4-component actors + player remain within 30, while six 10-component
// rainbows cannot. The renderer truncates component-wise rather than dropping whole metasprites.
const reserve=T.playerOamComponentCount()+T.spellOamComponentCount();assert.ok(reserve<30);assert.ok(6*T.metaComponentCount(0xD0)>30-reserve);
assert.match(html12,/S24 · Palette \/ OAM \/ Patch 測試/);assert.match(html12,/Stage 24/);
console.log('Stage 24 regression: PASS');

// Stage 25 FLOW CONFORMANCE: MAP_TRANSITION is now the recovered three-phase mode.
T.start(true);H.clearActors();T.encounterLocks.surface[0]=0x80;const p25old={x:T.camera.x,y:T.camera.y};T.terrainPatches.clear();T.terrainPatches.set('0,0',0x2C);
// Use a real F7 warp trigger. The destination is applied immediately, but gameplay is
// suspended behind phase 0/1/2 until 256px of 8px streaming + four HUD-stable ticks finish.
aimAtTile([0xF7]);const oldActor={kind:'combat',cls:4,rec:1,pal:0,x:T.camera.x+100,y:T.camera.y+80,dir:0,desired:0,timer:20,age:32,logicFrame:0,hp:8,maxHp:8,power:0,xp:1,hitTimer:0,deathTimer:0,persistence:0xFF,fixed:false};T.actors[0]=oldActor;
assert.equal(T.tryDirectionalWarp(),true);assert.equal(T.state.gameMode,'MAP_TRANSITION');assert.equal(T.state.modePhase,0);assert.equal(T.encounterLocks.surface[0],0x80,'warp does not globally clear encounter locks');assert.equal(T.actors[0],oldActor,'map transition does not eagerly clear actor pool');
T.updateMapTransition();assert.equal(T.state.modePhase,1);assert.equal(T.state.mapTransition.pixelsRemaining,0);
for(let i=0;i<31;i++)T.updateMapTransition();assert.equal(T.state.modePhase,1);assert.equal(T.state.mapTransition.pixelsRemaining,8,'after 31 stream ticks, 8px remain');
T.updateMapTransition();assert.equal(T.state.modePhase,2);assert.equal(T.state.mapTransition.pixelsRemaining,0);assert.equal(T.state.mapTransition.hudSettle,1,'32nd stream tick falls through into first HUD settle tick');
for(let i=0;i<2;i++)T.updateMapTransition();assert.equal(T.state.gameMode,'MAP_TRANSITION');T.updateMapTransition();assert.equal(T.state.gameMode,'GAMEPLAY');assert.equal(T.state.facing,1,'transition returns facing DOWN after four stable HUD ticks');

// Dungeon entrance/exit terrain uses the same formal MAP_TRANSITION rather than an instant realm swap.
T.start(true);const y25=T.camera.y;H.dispatchSpecialTerrain({tile:0xF9,wx:T.camera.x,wy:T.camera.y},1);assert.equal(T.camera.y,(y25+0x0A00)&0xFFF0);assert.equal(T.state.gameMode,'MAP_TRANSITION');for(let i=0;i<36;i++)T.update();assert.equal(T.state.gameMode,'GAMEPLAY');assert.equal(T.camera.y>=0x0A00,true);
H.dispatchSpecialTerrain({tile:0xD4,wx:T.camera.x,wy:T.camera.y},0);assert.equal(T.state.gameMode,'MAP_TRANSITION');for(let i=0;i<36;i++)T.update();assert.equal(T.state.gameMode,'GAMEPLAY');assert.equal(T.camera.y<0x0A00,true);

// Hotel checkpoint is separate from modern Quick Save. Merely servicing the hotel refreshes
// the full 8-slot backup and password buffer; Continue reconstructs from the retail start camera.
sandbox.localStorage._m.clear();T.clearHotelCheckpoint();T.start(true);for(const sl of T.player.inventory){sl.id=0;sl.value=0}
const hotelInv25=[{id:0x0F,value:0},{id:0x07,value:3},{id:0x04,value:2},{id:0x12,value:0xFF},{id:0x14,value:0xFF},{id:0x18,value:0xFF},{id:0x17,value:0xFF},{id:0x09,value:17}];hotelInv25.forEach((v,i)=>Object.assign(T.player.inventory[i],v));T.player.equippedItem=0x0F;T.player.equippedSlot=0;T.player.equipment.mantle=true;T.player.equipment.helmet=true;T.player.gold=12340;T.player.xp=67890;T.camera.x=0x0900;T.camera.y=0x0300;
assert.equal(T.beginInterior('hotel'),true);for(let i=0;i<33;i++)T.update();T.update();assert.equal(T.hasHotelCheckpoint(),true);const cp25=T.getHotelCheckpoint();assert.equal(cp25.inventory.length,8);assert.deepEqual(Array.from(cp25.inventory,x=>[x.id,x.value]),hotelInv25.map(x=>[x.id,x.value]));assert.equal(sandbox.localStorage._m.has('valkyrie.frontend.stage9.save.v2'),false,'physical hotel checkpoint no longer creates a modern Quick Save');assert.equal(sandbox.localStorage._m.has('valkyrie.frontend.hotelCheckpoint.v1'),true);
T.resetTitleFrontend(true);assert.equal(T.state.front.continueSelected,true,'title recognizes hotel checkpoint separately');H.frontPress('Enter');T.updateFrontend();T.updateFrontend();assert.equal(T.state.gameMode,'PASSWORD_ENTRY');T.updateFrontend();assert.equal(T.state.gameMode,'GAME_INIT','live hotel checkpoint auto-validates password and routes to GAME_INIT');assert.equal(T.camera.x,0x0100);assert.equal(T.camera.y,0x0800,'Continue reconstructs world at retail start camera, not hotel location');assert.deepEqual(Array.from(T.player.inventory,x=>[x.id,x.value]),hotelInv25.map(x=>[x.id,x.value]),'full hotel 8-slot backup restored');for(let i=0;i<32;i++)T.update();assert.equal(T.state.gameMode,'GAMEPLAY');

// Progressive PasswordDecode side effect: checksum can be valid while a later Gold range
// check fails. Fields written before that reject remain mutated, exactly like retail RAM.
const A25='0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';function makeRetailPassword25(payload){const p=payload.slice();const salt=p[9]&7,r=H.rotate72Right(p,salt+1);for(let i=0;i<9;i++)p[i]=r[i];return Array.from(H.transposeEncode(p),x=>A25[x]).join('')}
T.start(true);T.player.gold=777;T.player.expThresholdIndex=2;T.player.sign=0;T.player.blood=0;T.player.color=0;const badPayload25=Array(10).fill(0);badPayload25[1]=0x18;badPayload25[4]=0x40;badPayload25[5]=0xE9;badPayload25[7]=0x20;badPayload25[8]=77;badPayload25[9]=0x28;const semanticBad25=makeRetailPassword25(badPayload25);assert.equal(T.decodeRetailPassword(semanticBad25).ok,false);const partial25=T.applyRetailPassword(semanticBad25);assert.equal(partial25.ok,false);assert.equal(partial25.partial,true);assert.equal(T.player.expThresholdIndex,77);assert.equal(T.player.maxHp,64);assert.equal(T.player.maxMp,32);assert.equal(T.player.sign,9);assert.equal(T.player.blood,2);assert.equal(T.player.color,3);assert.equal(T.player.gold,777,'Gold write happens after the rejected high-range check');

// Corrupt live hotel checkpoint follows the recovered phase quirk: PasswordReject INC takes
// phase 0 -> 1 rather than entering the normal phase-2 manual error delay.
T.clearHotelCheckpoint();sandbox.localStorage.setItem('valkyrie.frontend.hotelCheckpoint.v1',JSON.stringify({v:1,password:'000000000000000000',inventory:Array.from({length:8},()=>({id:0,value:0})),equippedItem:0,equippedSlot:-1,equipment:{}}));T.resetTitleFrontend(true);assert.equal(T.state.front.continueSelected,true);H.frontPress('Enter');T.updateFrontend();T.updateFrontend();T.updateFrontend();assert.equal(T.state.front.passwordFailures,1);assert.equal(T.state.front.phase,1,'corrupt checkpoint reject lands on phase 1 quirk, not manual phase-2 delay');

// Controller-2 A+B death shortcut runs first in the item menu, but a later P1 action in
// the same handler can overwrite GameMode back to gameplay.
T.clearHotelCheckpoint();T.start(true);T.beginItemSpellMenu();H.setP2AB(true);T.updateItemSpellMenu();assert.equal(T.player.dead,true);assert.equal(T.state.gameMode,'DEATH','P2 A+B alone requests death');H.setP2AB(false);
T.start(true);T.beginItemSpellMenu();H.setP2AB(true);H.setPressed('KeyI');T.updateItemSpellMenu();assert.equal(T.player.dead,false);assert.equal(T.state.gameMode,'GAMEPLAY','same-frame P1 cancel overwrites P2 death request');H.setP2AB(false);

assert.match(html12,/data-action="stage25-transition-test"/);assert.match(html12,/CONTINUE HOTEL CHECKPOINT/);assert.match(html12,/Stage 25 FLOW CONFORMANCE/);
console.log('Stage 25 regression: PASS');
