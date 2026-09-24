(() => {
'use strict';
const canvas=document.getElementById('game'), ctx=canvas.getContext('2d');
ctx.imageSmoothingEnabled=false;
const keys=new Set(), pressed=new Set();
let mode='title', debug=false, frame=0, frameCounter=0xFF;
const camera={x:0x0100,y:0x0800};
const PLAYER_SCREEN={x:0x78,y:0x57};
let facing=1, moving=false, bump=0, attackTimer=0, attackHitActive=false;
let worldClockSubsecond=0, worldClockSecond=0, worldDay=0;
const player={hp:0x40,maxHp:0x40,mp:0x20,maxMp:0x20,poison:false,terrainMode:'land',xp:0,gold:0,level:1,expThresholdIndex:2,sign:0,blood:0,color:0,passwordSalt:0,equippedItem:0x0B,equippedSlot:0,inventory:Array.from({length:8},()=>({id:0,value:0})),equipment:{mantle:false,helmet:false},selectedSpell:0,spellHealTimer:0,itemActionFlags:0,hurtBlink:0,dead:false};
let notice='', noticeTimer=0, hudEnemy=null;
const terrainPatches=new Map();
const encounterLocks={surface:new Uint8Array(20),dungeon:new Uint8Array(20)};
const fixedState=new Uint8Array(0x80);
const actors=Array(6).fill(null);
let rngState=0xA7, goldBagSpawnLatch=false;
const spell={type:0,timer:0,x:0,y:0,dir:0,frame:0};
let endingActive=false, pyramidPatchAnchor=null;
const ending={phase:0,timer:0,scene:0,scroll:0,flash:0};
let deathState='alive', deathTimer=0, deathY=PLAYER_SCREEN.y, gameOverTimer=0;
let serviceMode=null, activeShopProfile=0;
const SAVE_KEY='valkyrie.frontend.stage9.save.v2';
const LEGACY_SAVE_KEY='valkyrie.frontend.stage8.save.v1';

const ITEM_NAMES=['Empty','Lamp','Blue Lamp','Potion','Super Potion','Antidote','Super Antidote','Key','Gold Key','Axe','Power Axe','Short Sword','Long Sword','Power Short Sword','Power Long Sword','Super Sword','Soul of Sandra','Mantle','Blue Mantle','Helmet','Blue Helmet','Tent','Super Tent','Tiara','Marco the Whale','Cure All','Time Key','Magic Ship','Gold Bag'];
const ITEM_INITIAL_VALUE=[0x00,0x04,0x00,0x01,0x04,0x01,0x04,0x04,0x00,0x28,0x00,0x00,0x00,0x00,0x00,0x00,0x04,0x01,0x00,0x01,0x00,0x01,0x04,0x00,0x00,0x04,0x00,0x00];
const SPELL_NAMES=['None','Healing','Fireball','True Sight','Invisibility','Star Flute','Antidote','Lightning'];
const SPELL_COST=[0,20,5,10,15,32,20,50];
const SPELL_UNLOCK=[0,40,60,80,120,160,200,240];
const SPELL_META=[0x44,0x3B,0x3D,0x3E,0x3F,0x40,0x33,0x3C];
const MARCO_REWARD_OFFSETS=[[0,-16],[0,16],[-16,0],[16,0]];
const MARCO_WATER_SPAWN_OFFSET=[-96,0];
const GOLD_BAG_OFFSETS=[[0,-32],[0,32],[-32,0],[32,0]];
const ITEM_WORLD_META=[0x44,0x2C,0x2C,0x30,0x30,0x33,0x33,0x2E,0x2E,0x2D,0x2D,0x2A,0x2B,0x2A,0x2B,0x2B,0x28,0x37,0x37,0x36,0x36,0x32,0x32,0x34,0x27,0x38,0x39,0x35,0x2F];
const ITEM_SPRITE_ATTR=[0,1,2,1,2,1,2,3,1,1,2,1,1,3,3,2,2,1,2,1,2,3,1,1,3,1,1,1,1];
const DROP_COMMON=[0,0,0,0,0x1C,0x1C,0x1C,0x1C,0x1C,0x1C,0x1C,0x1C,0,0,0,0x07];
const DROP_RARE  =[0,0,0,0,0x03,0x10,0x05,0x01,0x09,0x07,0x1A,0x1C,0,0,0,0x07];
const SWORD_ARCS=[[0,4,5,6],[0,8,1,2],[0,2,3,4],[0,6,7,8]];
const SWORD_EXTENTS=[[12,20],[12,20],[20,12],[20,12]];
const KNOCKBACK=[[0,-6],[0,6],[-6,0],[6,0]];
const WARP_DEFAULT=[[0x300,0x160],[0x100,0x8E0],[0x700,0x0E0],[0x800,0x7E0]];
const WARP_TIARA=[[0x300,0x400],[0x900,0x300],[0xD00,0x480],[0xE00,0x900]];
const FIREBALL_VEL=[[0,-3],[0,3],[-3,0],[3,0]];
const ITEM_PRICE_UNIT=[0x00,0x02,0x32,0x04,0x14,0x03,0x0F,0x0A,0x64,0x04,0x4B,0x01,0x0A,0x32,0x64,0x00,0x00,0x0F,0x00,0x14,0x00,0x32,0xFA,0x00,0x00,0xFA,0x00,0x0F];
const SHOP_PROFILE_BY_X_HIGH=[0,0,1,0,0,0,0,0,0,1,2,3,2,0,0,0];
const SHOP_PROFILES=[[0x01,0x03,0x05,0x09,0x0C,0x11],[0x07,0x04,0x06,0x09,0x0D,0x13],[0x08,0x04,0x06,0x0A,0x0E,0x16],[0x02,0x04,0x06,0x0A,0x0E,0x15]];
const ZODIAC_NAMES=['ARIES','TAURUS','GEMINI','CANCER','LEO','VIRGO','LIBRA','SCORPIO','SAGITTARIUS','CAPRICORN','AQUARIUS','PISCES'];
const BLOOD_NAMES=['A','B','O','AB'];
const COLOR_NAMES=['WHITE','RED','GREEN','BLUE'];
const INITIAL_EXP_CURVE=[2,1,3,1];
const EXP_THRESHOLDS=[0,20,50,90,150,230,350,510,750,1100,1600,2200,3200,4400,6400,9000,12000,15000,20000];
const PASSWORD_ALPHABET='0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const PASSWORD_PERSIST_IDS=[0x0F,0x12,0x14,0x18,0x17];
const ENDING_SCENES=[
 [{a:0x20E8,t:'CONGRATULATIONS,'},{a:0x2144,t:'YOU HAVE FINALLY DEFEATED'},{a:0x21A4,t:'SATAN ZOUNA.'},{a:0x2204,t:'THE SOUL TAKEN BY ZOUNA'},{a:0x2264,t:'WILL RETURN TO THE PEOPLE.'}],
 [{a:0x2144,t:'JOY AND LAUGHTER IS BACK'},{a:0x21A4,t:'IN MARVELAND.'},{a:0x2204,t:'TIME IS FLOWING AGAIN.'},{a:0x2264,t:'AND PEACE IS RECOVERED.'}],
 [{a:0x2144,t:'YOU ARE THE VERY WARRIOR'},{a:0x21A4,t:'OF MARVELAND.'},{a:0x2204,t:'IT IS TIME RECOVERED BY'},{a:0x2264,t:'YOUR OWN HANDS.'}],
 [{a:0x2144,t:'WISH YOU WOULD TAKE GOOD'},{a:0x21A4,t:'CARE OF THE PRECIOUS TIME,'},{a:0x2204,t:'YOUR REAL ADVENTURE STARTS'},{a:0x2264,t:'FROM NOW ON,'}],
 [{a:0x21AD,t:'STAFF'}],
 [{a:0x2184,t:'PROGRAMMED BY'},{a:0x21EC,t:'A.WACHI    SCO.B'}],
 [{a:0x2104,t:'MUSIC DIRECTED BY'},{a:0x216C,t:'H.KAWADA   LEO.O'},{a:0x2204,t:'ORIGINAL CHARACTER DESIGN'},{a:0x226C,t:'H.FUJI     VIR.A'}],
 [{a:0x2104,t:'ENGLISH ADVISOR'},{a:0x216C,t:'N.WATANABE VIR.A'},{a:0x2204,t:'EXECUTIVE OBSERVER'},{a:0x226C,t:'WAN WAN    SAG.O'}],
 [{a:0x2127,t:'SPECIAL THANKS TO'},{a:0x21AB,t:'M.KOIZUMI'},{a:0x220B,t:'K.SAITO'},{a:0x226B,t:'S.TAKIGAMI'}],
 [{a:0x2184,t:'DIRECTED BY'},{a:0x21EC,t:'S.MACCO   AQU.AB'}]
];

const COMPLEX_META={
  0xC0:{w:17,c:[[0x29,1,-1,-8],[0x21,0,0,0],[0x03,0,8,0]]},
  0xC1:{w:16,c:[[0x2D,1,0,8],[0x23,0,0,0],[0x07,0,8,0]]},
  0xC2:{w:16,c:[[0x31,1,3,0],[0x09,0,0,0],[0x25,0,8,0]]},
  0xC3:{w:16,c:[[0x35,1,8,-8],[0x0D,0,0,0],[0x27,0,8,0]]},
  0xC4:{w:16,c:[[0x39,1,0,-8],[0x19,0,0,0],[0x1B,0,8,0]]},
  0xC5:{w:22,c:[[0x3D,1,14,0],[0x1D,0,0,0],[0x1F,0,8,0]]},
  0xC6:{w:17,c:[[0x2B,1,-1,-8],[0x21,0,0,0],[0x03,0,8,0]]},
  0xC7:{w:16,c:[[0x2F,1,0,8],[0x23,0,0,0],[0x07,0,8,0]]},
  0xC8:{w:16,c:[[0x33,1,3,0],[0x09,0,0,0],[0x25,0,8,0]]},
  0xC9:{w:16,c:[[0x37,1,8,-8],[0x0D,0,0,0],[0x27,0,8,0]]},
  0xCA:{w:16,c:[[0x3B,1,0,-8],[0x19,0,0,0],[0x1B,0,8,0]]},
  0xCB:{w:22,c:[[0x3F,1,14,0],[0x1D,0,0,0],[0x1F,0,8,0]]},
  0xCC:{w:16,c:[[0x89,0,4,-6],[0x99,3,0,0],[0x9B,3,8,0]]},
  0xCD:{w:16,c:[[0x89,0x40,4,-7],[0x9D,3,0,0],[0x9F,3,8,0]]},
  0xCE:{w:24,c:[[0xC1,0,0,0],[0xC3,0,8,0],[0xC5,0,16,0],[0xE1,0,0,16],[0xE3,0,8,16],[0xE5,0,16,16]]},
  0xCF:{w:24,c:[[0xC7,0,0,0],[0xC9,0,8,0],[0xCB,0,16,0],[0xE7,0,0,16],[0xE9,0,8,16],[0xEB,0,16,16]]},
  0xD1:{w:16,c:[[0xD1,0,0,-4],[0xD3,0,8,-4],[0xF1,0,0,12],[0xF3,0,8,12]]},
  0xD2:{w:16,c:[[0xD5,0,0,-4],[0xD7,0,8,-4],[0xF5,0,0,12],[0xF7,0,8,12]]}
};

const img={};
let loaded=0;
for (const [k,src] of Object.entries({title:'assets/title_tiles.png',world:'assets/world_tiles.png',spr:'assets/sprites.png'})) {
  const im=new Image();
  im.onload=()=>{img[k]=im;if(++loaded===3) requestAnimationFrame(loop)};
  im.src=src;
}

function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function hex(v,n=2){return (v>>>0).toString(16).toUpperCase().padStart(n,'0')}
function realm(){return camera.y>=0x0A00?'dungeon':'surface'}
function playerWorld(){return {x:camera.x+PLAYER_SCREEN.x,y:camera.y+PLAYER_SCREEN.y}}
function patchKey(x,y){return `${(x>>3)&0x1FF},${y>>3}`}
function rng8(){rngState^=(rngState<<3)&255;rngState^=rngState>>5;rngState^=(rngState<<1)&255;return rngState&255}
function say(s,t=120){notice=s;noticeTimer=t}
function bodyOverlap(a,extent=12){return Math.abs((a.x-camera.x)-PLAYER_SCREEN.x)<extent&&Math.abs((a.y-camera.y)-PLAYER_SCREEN.y)<extent}
function spellIs(id){return spell.type===id&&spell.timer>0}
function invisibilityActive(){return spellIs(4)}
function starFluteActive(){return spellIs(5)}
function resetSpell(){spell.type=0;spell.timer=0;spell.x=0;spell.y=0;spell.dir=0;spell.frame=0}


function buyPrice(id){return (ITEM_PRICE_UNIT[id]||0)*16}
function sellPrice(id){return (ITEM_PRICE_UNIT[id]||0)*8}
function storageGet(){try{return localStorage.getItem(SAVE_KEY)||localStorage.getItem(LEGACY_SAVE_KEY)}catch{return null}}
function storageSet(v){try{localStorage.setItem(SAVE_KEY,v);return true}catch{return false}}
function hasSave(){return !!storageGet()}
function snapshotGame(){
  return {v:2,camera:{x:camera.x,y:camera.y},facing,frameCounter,worldClockSubsecond,worldClockSecond,worldDay,rngState,goldBagSpawnLatch,
    player:{hp:player.hp,maxHp:player.maxHp,mp:player.mp,maxMp:player.maxMp,poison:player.poison,terrainMode:player.terrainMode,xp:player.xp,gold:player.gold,level:player.level,expThresholdIndex:player.expThresholdIndex,sign:player.sign,blood:player.blood,color:player.color,passwordSalt:player.passwordSalt,equippedItem:player.equippedItem,equippedSlot:player.equippedSlot,inventory:player.inventory.map(x=>({id:x.id,value:x.value})),equipment:{...player.equipment},selectedSpell:player.selectedSpell},
    terrainPatches:[...terrainPatches.entries()],encounterSurface:[...encounterLocks.surface],encounterDungeon:[...encounterLocks.dungeon],fixedState:[...fixedState],endingActive};
}
function quickSave(label='QUICK SAVE'){
  if(mode!=='game'||player.dead||endingActive){say('SAVE UNAVAILABLE IN CURRENT STATE',70);return false}
  const ok=storageSet(JSON.stringify(snapshotGame()));say(ok?`${label} · STORED`:'SAVE FAILED · storage unavailable',80);updateMenuStatus();return ok;
}
function restoreSnapshot(o){
  if(!o||(o.v!==1&&o.v!==2)||!o.player||!Array.isArray(o.player.inventory))throw Error('bad save');
  mode='game';camera.x=clamp(Number(o.camera?.x)||0x100,0,4095);camera.y=clamp(Number(o.camera?.y)||0x800,0,5119);facing=(Number(o.facing)||0)&3;
  frameCounter=Number(o.frameCounter)&255;worldClockSubsecond=Number(o.worldClockSubsecond)||0;worldClockSecond=Number(o.worldClockSecond)||0;worldDay=Number(o.worldDay)||0;rngState=Number(o.rngState)&255;goldBagSpawnLatch=!!o.goldBagSpawnLatch;
  Object.assign(player,{hp:o.player.hp,maxHp:o.player.maxHp,mp:o.player.mp,maxMp:o.player.maxMp,poison:!!o.player.poison,terrainMode:o.player.terrainMode||'land',xp:o.player.xp||0,gold:o.player.gold||0,level:o.player.level||1,expThresholdIndex:o.player.expThresholdIndex??2,sign:o.player.sign??0,blood:o.player.blood??0,color:o.player.color??0,passwordSalt:o.player.passwordSalt??0,equippedItem:o.player.equippedItem||0,equippedSlot:Number.isInteger(o.player.equippedSlot)?o.player.equippedSlot:-1,selectedSpell:o.player.selectedSpell||0});
  player.inventory=Array.from({length:8},(_,i)=>({id:Number(o.player.inventory[i]?.id)||0,value:Number(o.player.inventory[i]?.value)||0}));player.equipment={mantle:!!o.player.equipment?.mantle,helmet:!!o.player.equipment?.helmet};player.itemActionFlags=0;player.spellHealTimer=0;player.hurtBlink=0;player.dead=false;
  terrainPatches.clear();for(const e of (o.terrainPatches||[]))if(Array.isArray(e)&&e.length===2)terrainPatches.set(String(e[0]),Number(e[1])&255);
  encounterLocks.surface.fill(0);encounterLocks.dungeon.fill(0);(o.encounterSurface||[]).slice(0,20).forEach((v,i)=>encounterLocks.surface[i]=v);(o.encounterDungeon||[]).slice(0,20).forEach((v,i)=>encounterLocks.dungeon[i]=v);fixedState.fill(0);(o.fixedState||[]).slice(0,0x80).forEach((v,i)=>fixedState[i]=v);
  endingActive=!!o.endingActive;ending.phase=endingActive?1:0;ending.timer=0;ending.scene=0;ending.scroll=0;ending.flash=0;pyramidPatchAnchor=null;resetSpell();clearActors();attackTimer=0;attackHitActive=false;moving=false;bump=0;deathState='alive';deathTimer=0;deathY=PLAYER_SCREEN.y;gameOverTimer=0;notice='';noticeTimer=0;keys.clear();pressed.clear();closeGameMenu();closeInventoryPanel();closeServicePanel();renderInventoryPanel();say('SAVE LOADED · transient actors reset',85);return true;
}
function quickLoad(){const raw=storageGet();if(!raw){say('NO SAVE FOUND',65);return false}try{return restoreSnapshot(JSON.parse(raw))}catch{say('SAVE DATA INVALID',80);return false}}
function shopProfileForWorld(){return SHOP_PROFILE_BY_X_HIGH[(camera.x>>8)&15]||0}
function buyShopItem(id){const price=buyPrice(id);if(player.gold<price){say(`SHOP · NEED ${price} GOLD`,70);return false}if(!addInventoryItem(id)){say('SHOP · INVENTORY FULL',70);return false}player.gold-=price;say(`BOUGHT ${ITEM_NAMES[id]} · -${price} G`,75);renderServicePanel();return true}
function sellInventorySlot(i){const slot=player.inventory[i];if(!slot||!slot.id){say('SELL · EMPTY SLOT',55);return false}const id=slot.id,price=sellPrice(id);clearInventorySlot(i);player.gold=Math.min(60000,player.gold+price);say(`SOLD ${ITEM_NAMES[id]} · +${price} G`,75);renderServicePanel();return true}
function expThreshold(idx){return idx<EXP_THRESHOLDS.length?EXP_THRESHOLDS[idx]:Math.max(0,(idx-16)*10000)}
function advanceExpCurve(){
  if(player.level>=10){player.expThresholdIndex++;return 1}
  let add=1;if(player.blood===0)add=2;else if(player.blood===1)add=player.level<5?1:3;else if(player.blood===2)add=player.level<5?3:1;else{const r=(rng8()>>2)&3;add=r===0?1:r}
  player.expThresholdIndex+=add;return add;
}
function applyOneHotelLevel(){
  if(player.xp<expThreshold(player.expThresholdIndex))return false;
  player.level=(player.level+1)&0x7F;advanceExpCurve();
  const hpDiv=(rng8()&7)+4;player.maxHp=Math.min(999,player.maxHp+Math.floor(player.maxHp/hpDiv)+1);
  const mpDiv=(rng8()>>4)+4;player.maxMp=Math.min(999,player.maxMp+Math.floor(player.maxMp/mpDiv)+1);return true;
}
function applyHotelLevelUps(){let n=0;while(n<126&&applyOneHotelLevel())n++;return n}
function hotelRest(){let spent=0,notes=[];const levels=applyHotelLevelUps();if(levels)notes.push(`LEVEL +${levels} → ${player.level}`);if(player.poison&&player.gold>=20){player.gold-=20;spent+=20;player.poison=false;notes.push('poison cured')}if(player.mp<player.maxMp&&player.gold>=20){player.gold-=20;spent+=20;player.mp=player.maxMp;notes.push('MP full')}const missing=Math.max(0,player.maxHp-player.hp),heal=Math.min(missing,player.gold);if(heal){player.gold-=heal;spent+=heal;player.hp+=heal;notes.push(`HP +${heal}`)}player.passwordSalt=rng8()&7;const pw=encodeRetailPassword();const saved=quickSave('HOTEL CHECKPOINT');say(`HOTEL · ${notes.length?notes.join(' · '):'no service needed'} · ${spent} G${saved?' · checkpoint':''}`,120);renderServicePanel();return {spent,heal,saved,levels,password:pw}}

function rotate72Right(bytes,n){const a=bytes.slice(0,9);for(let k=0;k<n;k++){const o=a.slice();for(let i=0;i<9;i++){const prev=i?o[i-1]:o[8];a[i]=((o[i]>>1)|((prev&1)<<7))&255}}return a}
function rotate72Left(bytes,n){const a=bytes.slice(0,9);for(let k=0;k<n;k++){const o=a.slice();for(let i=0;i<9;i++){const next=i<8?o[i+1]:o[0];a[i]=(((o[i]<<1)&255)|((next>>7)&1))&255}}return a}
function transposeEncode(payload){const p=payload.slice(),chars=Array(18).fill(0);for(let plane=0;plane<5;plane++)for(let x=0;x<8;x++){let c=p[0]&1;p[0]>>=1;for(let j=1;j<5;j++){const nc=p[j]&1;p[j]=(p[j]>>1)|(c<<7);c=nc}chars[x]=((chars[x]<<1)&255)|c}for(let plane=0;plane<5;plane++)for(let x=0;x<8;x++){let c=p[5]&1;p[5]>>=1;for(let j=6;j<10;j++){const nc=p[j]&1;p[j]=(p[j]>>1)|(c<<7);c=nc}chars[9+x]=((chars[9+x]<<1)&255)|c}const sum=chars.slice(0,8).concat(chars.slice(9,17)).reduce((a,b)=>a+b,0);chars[8]=sum&31;chars[17]=(sum>>5)&31;return chars}
function transposeDecode(chars){const q=chars.slice(),p=Array(13).fill(0);for(let outer=0;outer<8;outer++)for(let x=0;x<8;x++){let c=q[7]&1;q[7]>>=1;for(let j=6;j>=0;j--){const nc=q[j]&1;q[j]=(q[j]>>1)|(c<<7);c=nc}p[x]=(p[x]>>1)|(c<<7)}for(let outer=0;outer<8;outer++)for(let x=0;x<8;x++){let c=q[16]&1;q[16]>>=1;for(let j=15;j>=9;j--){const nc=q[j]&1;q[j]=(q[j]>>1)|(c<<7);c=nc}p[5+x]=(p[5+x]>>1)|(c<<7)}return p.slice(0,10)}
function encodeRetailPassword(){
  const gold10=Math.floor(clamp(player.gold,0,60000)/10),xp10=Math.floor(Math.max(0,player.xp)/10),maxHp=clamp(player.maxHp|0,1,999),maxMp=clamp(player.maxMp|0,0,999),salt=player.passwordSalt&7;
  let flags=0;PASSWORD_PERSIST_IDS.forEach((id,i)=>{if(hasInventoryItem(id))flags|=1<<i});
  const p=Array(10).fill(0);p[0]=gold10&255;p[1]=((gold10>>8)&31)|(((maxHp>>8)&3)<<5)|(((maxMp>>8)&1)<<7);p[2]=xp10&255;p[3]=(xp10>>8)&255;p[4]=maxHp&255;p[5]=(player.sign&15)|((player.blood&3)<<4)|((player.color&3)<<6);p[6]=(flags&31)|(((maxMp>>9)&1)<<5)|((player.level&3)<<6);p[7]=maxMp&255;p[8]=player.expThresholdIndex&255;p[9]=((player.level<<1)&0xF8)|salt;
  const r=rotate72Right(p,salt+1);for(let i=0;i<9;i++)p[i]=r[i];const chars=transposeEncode(p);return chars.map(x=>PASSWORD_ALPHABET[x]||'?').join('');
}
function passwordCharsFromString(str){const clean=String(str||'').toUpperCase().replace(/[^0-9A-Z]/g,'');if(clean.length!==18)return null;return [...clean].map(ch=>PASSWORD_ALPHABET.indexOf(ch))}
function decodeRetailPassword(str){
  const chars=passwordCharsFromString(str);if(!chars)return{ok:false,error:'Password must contain exactly 18 symbols'};
  const sum=chars.slice(0,8).concat(chars.slice(9,17)).reduce((a,b)=>a+b,0);if(chars[8]!== (sum&31)||chars[17]!==((sum>>5)&31))return{ok:false,error:'Checksum mismatch'};
  const p=transposeDecode(chars),salt=p[9]&7,r=rotate72Left(p,salt+1);for(let i=0;i<9;i++)p[i]=r[i];
  const maxHp=p[4]|(((p[1]>>5)&3)<<8),maxMp=p[7]|(((p[1]>>7)&1)<<8)|(((p[6]>>5)&1)<<9),gold10=p[0]|((p[1]&31)<<8),xp10=p[2]|(p[3]<<8);if(maxHp===0)return{ok:false,error:'Semantic reject: MaxHP is zero'};if((p[1]&31)>=0x18)return{ok:false,error:'Semantic reject: Gold out of range'};if(p[3]>=0xEB)return{ok:false,error:'Semantic reject: EXP out of range'};
  const level=((p[9]>>3)<<2)|((p[6]>>6)&3),traits=p[5],flags=p[6]&31;
  return{ok:true,state:{gold:gold10*10,xp:xp10*10,maxHp,maxMp,level,expThresholdIndex:p[8],sign:traits&15,blood:(traits>>4)&3,color:(traits>>6)&3,flags,salt}};
}
function applyRetailPassword(str){const d=decodeRetailPassword(str);if(!d.ok)return d;const q=d.state;start(true,{sign:q.sign,blood:q.blood,color:q.color,passwordContinue:true});player.gold=q.gold;player.xp=q.xp;player.maxHp=q.maxHp;player.hp=q.maxHp;player.maxMp=q.maxMp;player.mp=q.maxMp;player.level=q.level;player.expThresholdIndex=q.expThresholdIndex;player.passwordSalt=rng8()&7;resetInventory();for(let i=0;i<8;i++){player.inventory[i].id=0;player.inventory[i].value=0}let at=0;if(q.flags&1){player.inventory[0]={id:0x0F,value:0};player.equippedSlot=0;player.equippedItem=0x0F;at=1}else{player.inventory[0]={id:0x0B,value:0};player.equippedSlot=0;player.equippedItem=0x0B;at=1}for(let i=1;i<5;i++)if(q.flags&(1<<i))player.inventory[at++]={id:PASSWORD_PERSIST_IDS[i],value:0xFF};player.equipment.mantle=!!(q.flags&(1<<1));player.equipment.helmet=!!(q.flags&(1<<2));renderInventoryPanel();return d}


function clearInventorySlot(i){
  const slot=player.inventory[i];if(!slot)return;
  slot.id=0;slot.value=0;
  if(player.equippedSlot===i){player.equippedSlot=-1;player.equippedItem=0}
}
function resetInventory(){
  for(const slot of player.inventory){slot.id=0;slot.value=0}
  addInventoryItem(0x0B);player.equippedSlot=0;player.equippedItem=0x0B;
}
function findInventorySlot(id){return player.inventory.findIndex(s=>s.id===id)}
function hasInventoryItem(id){return findInventorySlot(id)>=0}
function inventoryCount(){return player.inventory.reduce((n,s)=>n+(s.id?1:0),0)}
function addInventoryItem(id){
  const i=player.inventory.findIndex(s=>s.id===0);if(i<0)return false;
  player.inventory[i].id=id;player.inventory[i].value=ITEM_INITIAL_VALUE[id]??0;return true;
}
function consumeInventorySlot(i){
  const slot=player.inventory[i];if(!slot||!slot.id)return false;
  if(slot.value===0xFF)return true;
  slot.value=(slot.value-1)&0xFF;
  if(slot.value===0)clearInventorySlot(i);
  return true;
}
function inventoryValueLabel(slot){
  if(!slot||!slot.id)return '';
  if(slot.value===0xFF)return '∞';
  if(slot.value===0&&ITEM_INITIAL_VALUE[slot.id]===0)return '∞';
  return `×${slot.value}`;
}
function isWeapon(id){return id>=0x09&&id<=0x0F}
function resolveKeyActionNow(){
  for(let i=0;i<actors.length;i++){const a=actors[i];if(a&&a.kind==='item'&&a.style===2&&bodyOverlap(a,12)){tryPickupItem(a,i);player.itemActionFlags&=~1;return true}}
  const s=collisionSample(facing);if(s.tile>=0xF0&&s.tile<=0xF3){setPatch2x2(s.wx,s.wy,[0x2C,0x2C,0x2C,0x2C]);player.itemActionFlags&=~1;say('KEY GATE OPENED',70);return true}
  return false;
}
function useInventorySlot(i){
  if(mode!=='game'||player.dead)return;
  const slot=player.inventory[i];if(!slot||!slot.id)return;
  const id=slot.id,name=ITEM_NAMES[id]||`Item $${hex(id)}`;
  if(id===0x01||id===0x02){say(`${name} USED · palette effect placeholder`,70);consumeInventorySlot(i)}
  else if(id===0x03||id===0x04){player.hp=Math.min(player.maxHp,player.hp+32);say(`${name} · HP ${player.hp}/${player.maxHp}`,70);consumeInventorySlot(i)}
  else if(id===0x05||id===0x06){player.poison=false;say(`${name} · POISON CLEARED`,70);consumeInventorySlot(i)}
  else if(id===0x07){player.itemActionFlags|=1;consumeInventorySlot(i);if(!resolveKeyActionNow())say('KEY ACTION · no chest/gate at current position',70)}
  else if(id===0x08){player.itemActionFlags|=1;if(!resolveKeyActionNow())say('GOLD KEY ACTION · no chest/gate at current position',70)}
  else if(isWeapon(id)){player.equippedItem=id;player.equippedSlot=i;say(`EQUIPPED ${name}`,70)}
  else if(id===0x10){player.itemActionFlags|=4;consumeInventorySlot(i);resolveRelicActionNow(0x10)}
  else if(id===0x11||id===0x12){player.equipment.mantle=true;consumeInventorySlot(i);say(`EQUIPPED ${name}`,70)}
  else if(id===0x13||id===0x14){player.equipment.helmet=true;consumeInventorySlot(i);say(`EQUIPPED ${name}`,70)}
  else if(id===0x15||id===0x16){player.mp=player.maxMp;consumeInventorySlot(i);say(`${name} · MP ${player.mp}/${player.maxMp}`,70)}
  else if(id===0x17){player.itemActionFlags|=8;consumeInventorySlot(i);resolveRelicActionNow(0x17)}
  else if(id===0x18){consumeInventorySlot(i);say('MARCO ITEM · possession enables open-water call',70)}
  else if(id===0x19){player.poison=false;player.hp=player.maxHp;player.mp=player.maxMp;consumeInventorySlot(i);say('CURE ALL · HP/MP RESTORED',70)}
  else if(id===0x1A){player.itemActionFlags|=2;consumeInventorySlot(i);resolveRelicActionNow(0x1A)}
  else if(id===0x1B){say('MAGIC SHIP · passive on open water',70)}
  else say(`${name} · no active use`,55);
  closeInventoryPanel();closeServicePanel();renderInventoryPanel();
}
function revealHiddenActors(){
  let n=0;for(const a of actors){if(a&&a.kind==='item'&&a.hidden){a.hidden=false;a.meta=ITEM_WORLD_META[a.itemId]||0x44;a.pal=ITEM_SPRITE_ATTR[a.itemId]&3;n++}}
  return n;
}
function fireballDamageFor(a){
  let d=(player.maxMp>>2)+8;if([5,10,15].includes(a.cls))d=Math.max(1,d>>3);return Math.min(255,d);
}
function castLightning(){
  let hit=0;for(const a of actors){if(!a||a.kind!=='combat')continue;const dmg=32+(rng8()>>2);a.hitTimer=Math.max(a.hitTimer||0,16);a.hp=Math.max(0,a.hp-dmg);a.knockDir=facing;hit++;if(a.hp===0&&a.deathTimer<=0)a.deathTimer=8}
  return hit;
}
function castSpell(id){
  if(mode!=='game'||player.dead||endingActive)return;
  if(id<0||id>=SPELL_NAMES.length)return;
  if(player.maxMp<SPELL_UNLOCK[id]){say(`${SPELL_NAMES[id]} LOCKED · MaxMP ${SPELL_UNLOCK[id]} required`,80);return}
  if(spell.type!==0){say(`${SPELL_NAMES[id]} · another spell effect is active`,70);return}
  const cost=SPELL_COST[id];if(player.mp<cost){say(`${SPELL_NAMES[id]} · NOT ENOUGH MP`,70);return}
  player.mp-=cost;player.selectedSpell=id;
  if(id===1){const shift=(rng8()&1)?2:3,bonus=player.maxMp>>shift;player.hp=Math.min(player.maxHp,player.hp+24+bonus);spell.type=1;spell.timer=0x2F;player.spellHealTimer=0x2F;say(`HEALING · +${24+bonus} HP`,70)}
  else if(id===2){spell.type=2;spell.timer=0x7FFF;spell.x=PLAYER_SCREEN.x+4;spell.y=PLAYER_SCREEN.y;spell.dir=facing;spell.frame=0;say(`FIREBALL · DMG ${Math.min(255,(player.maxMp>>2)+8)}`,70)}
  else if(id===3){const n=revealHiddenActors();say(`TRUE SIGHT · revealed ${n} spawned hidden item${n===1?'':'s'}`,90);resetSpell()}
  else if(id===4){spell.type=4;spell.timer=0x169;say('INVISIBILITY · enemy pursuit disrupted',90)}
  else if(id===5){spell.type=5;spell.timer=0x169;say('STAR FLUTE · combat actors frozen',90)}
  else if(id===6){player.poison=false;spell.type=6;spell.timer=0x2F;player.spellHealTimer=0x2F;say('ANTIDOTE MAGIC · POISON CLEARED',70)}
  else if(id===7){spell.type=7;spell.timer=0x20;const n=castLightning();say(`LIGHTNING · ${n} actor${n===1?'':'s'} struck`,80)}
  closeInventoryPanel();renderInventoryPanel();
}
function updateSpellEffect(){
  if(spell.type===0)return;spell.frame++;
  if(spell.type===2){const d=FIREBALL_VEL[spell.dir]||[0,3];spell.x+=d[0];spell.y+=d[1];const yLimit=spell.dir===1?195:239;if(spell.x<0||spell.x>=248||spell.y<0||spell.y>=yLimit){resetSpell();return}}
  else if(--spell.timer<=0)resetSpell();
}
function spawnPyramidOpening(anchor){
  const slot=firstFreeActorSlot();if(slot<0)return false;const p=playerWorld();pyramidPatchAnchor={x:anchor.wx,y:anchor.wy};
  actors[slot]={kind:'pyramid',x:p.x+112,y:p.y,pal:2,meta:0x0E,logicFrame:0,patched:false};return true;
}
function requiredEndingRelics(){return [0x0F,0x12,0x14,0x10]}
function resolveRelicActionNow(id){
  const s=collisionSample(facing);
  if(id===0x17){
    if(s.tile===0xFC||s.tile===0xFE){setPatch2x2(s.wx,s.wy,[0x2C,0x2C,0x2C,0x2C]);player.itemActionFlags&=~8;say('TIARA GATE OPENED',90);return true}
    say('TIARA ACTION · no Tiara gate at facing tile',70);return false;
  }
  if(id===0x10){
    if(s.tile===0xF8||s.tile===0xFA){const ok=spawnPyramidOpening(s);say(ok?'SOUL OF SANDRA · pyramid opening started':'SOUL OF SANDRA · actor pool full',100);return ok}
    say('SOUL OF SANDRA ACTION · no pyramid gate at facing tile',70);return false;
  }
  if(id===0x1A){
    if(s.tile!==0xE5&&s.tile!==0xE7){say('TIME KEY ACTION · no ending gate at facing tile',70);return false}
    const missing=requiredEndingRelics().filter(x=>!hasInventoryItem(x));
    if(missing.length){say(`ENDING GATE · missing ${missing.map(x=>ITEM_NAMES[x]).join(', ')}`,120);return false}
    endingActive=true;ending.phase=0;ending.timer=0;ending.scene=0;ending.scroll=0;ending.flash=0;keys.clear();pressed.clear();say('ENDING GATE OPEN',180);return true;
  }
  return false;
}
function tryDirectionalWarp(){
  const face=collisionSample(facing),under=playerTileSample(),s=face.tile===0xF7?face:under;if(s.tile!==0xF7||requestedDir()>=0)return false;
  const table=hasInventoryItem(0x17)?WARP_TIARA:WARP_DEFAULT,d=table[facing]||table[1];camera.x=d[0];camera.y=d[1];terrainPatches.clear();clearActors();clearEncounterLocks();say(`WARP ${hasInventoryItem(0x17)?'TIARA':'DEFAULT'} · $${hex(camera.x,4)},$${hex(camera.y,4)}`,100);return true;
}
function grantStage9TestKit(){
  for(const slot of player.inventory){slot.id=0;slot.value=0}
  for(const id of [0x0F,0x10,0x12,0x14,0x17,0x1A,0x09,0x18])addInventoryItem(id);
  player.equippedSlot=0;player.equippedItem=0x0F;player.maxMp=Math.max(player.maxMp,240);player.mp=player.maxMp;player.maxHp=Math.max(player.maxHp,128);player.hp=player.maxHp;
  player.gold=Math.max(player.gold,5000);player.xp=Math.max(player.xp,22000);player.level=Math.max(player.level,9);say('S9 TEST KIT · relic kit + Gold/EXP',110);renderInventoryPanel();
}

function grantStage8TestKit(){grantStage9TestKit()}
function grantStage7TestKit(){grantStage9TestKit()}
function grantStage6TestKit(){grantStage9TestKit()}

function resolveWorld(x,y){
  x=((x%4096)+4096)%4096; y=clamp(y,0,5119);
  const row=(y>>7); const col=(x>>8)&15; const mid=VDATA.top[row*16+col];
  const mc=(((y>>5)&3)*8)+((x>>5)&7); const id32=VDATA.macro[mid*32+mc];
  const q32=(((y>>4)&1)*2)+((x>>4)&1); const id16=VDATA.b32[id32*4+q32];
  const q16=(((y>>3)&1)*2)+((x>>3)&1); const tile=VDATA.b16[id16*4+q16];
  return {tile,pal:VDATA.bpal[id16],id16};
}
function resolveLiveWorld(x,y){const z=resolveWorld(x,y),p=terrainPatches.get(patchKey(x,y));return p==null?z:{...z,tile:p}}
function setPatch2x2(x,y,tiles){
  const bx=x&~7,by=y&~7;
  terrainPatches.set(patchKey(bx,by),tiles[0]);terrainPatches.set(patchKey(bx+8,by),tiles[1]);
  terrainPatches.set(patchKey(bx,by+8),tiles[2]);terrainPatches.set(patchKey(bx+8,by+8),tiles[3]);
}

function drawBgTile(atlas,tile,pal,x,y){ctx.drawImage(atlas,tile*8,pal*8,8,8,Math.round(x),Math.round(y),8,8)}
function titlePaletteAt(col,row){const ai=((row>>2)*8)+(col>>2),a=VDATA.titleAttrs[ai]||0,sh=((row&2)?4:0)+((col&2)?2:0);return(a>>sh)&3}
function drawTitle(){
  ctx.fillStyle='#000';ctx.fillRect(0,0,256,240);
  for(let r=0;r<30;r++)for(let c=0;c<32;c++)drawBgTile(img.title,VDATA.titleTiles[r*32+c],titlePaletteAt(c,r),c*8,r*8);
  const pulse=((frame>>5)&1);ctx.fillStyle=pulse?'#fff':'#aaa';ctx.fillRect(104,146,3,2);ctx.fillRect(102,148,5,2);ctx.fillRect(100,150,7,2);
  ctx.fillStyle='rgba(0,0,0,.70)';ctx.fillRect(0,216,256,24);ctx.fillStyle='#fff';ctx.font='8px monospace';ctx.fillText('NEW GAME / CONTINUE BELOW',69,229);
}

const collisionProbes=[[8,11],[8,15],[6,13],[10,13]];
function collisionSample(dir){const[ox,oy]=collisionProbes[dir],wx=camera.x+PLAYER_SCREEN.x+ox,wy=camera.y+PLAYER_SCREEN.y+oy;return{wx,wy,...resolveLiveWorld(wx,wy)}}
function playerTileSample(){const wx=camera.x+PLAYER_SCREEN.x+8,wy=camera.y+PLAYER_SCREEN.y+12;return{wx,wy,...resolveLiveWorld(wx,wy)}}
function moveCameraOnePixel(dir){
  if(dir===0)camera.y--;else if(dir===1)camera.y++;else if(dir===2)camera.x--;else camera.x++;
  camera.x=clamp(camera.x,0,0x0EFF);if(realm()==='dungeon')camera.y=clamp(camera.y,0x0A00,0x132F);else camera.y=clamp(camera.y,0,0x092F);
}
function changeRealm(toDungeon){
  if(toDungeon&&realm()==='surface')camera.y+=0x0A00;if(!toDungeon&&realm()==='dungeon')camera.y-=0x0A00;
  camera.x&=0xFFF0;camera.y&=0xFFF0;terrainPatches.clear();clearActors();say(toDungeon?'DUNGEON ENTER':'DUNGEON EXIT',90);
}
function beginDeath(){player.dead=true;deathState='sequence';deathTimer=0;deathY=PLAYER_SCREEN.y;gameOverTimer=0;attackTimer=0;attackHitActive=false;moving=false;resetSpell();worldDay=0;keys.clear();pressed.clear();closeInventoryPanel();closeServicePanel();say('VALKYRIE DOWN',90)}
function updateDeathSequence(){
  if(deathState==='gameover'){if(++gameOverTimer>=256)returnToTitle();return}
  deathTimer++;if(deathTimer<76){if((deathTimer&7)===0)facing=(facing+1)&3;return}if(deathTimer<123)return;if(deathTimer<255)return;deathY--;if(deathY<0){deathState='gameover';gameOverTimer=0;clearActors();notice='';noticeTimer=0}}
function damage(n,why){
  if(player.dead)return;
  player.hp=Math.max(0,player.hp-n);player.hurtBlink=20;
  if(player.hp===0){beginDeath();return}
  if(why)say(`${why}  -${n} HP  ${player.hp}/${player.maxHp}`,55);
}
function dispatchSpecialTerrain(s,dir){
  const t=s.tile;
  if(t>=0xD0&&t<=0xD3){player.poison=true;say(`POISON TERRAIN $${hex(t)}`,45);return false}
  if(t===0xD4){changeRealm(false);return false}
  if(t===0xD5||t===0xD6){openShopPanel();return false}
  if(t===0xD7){openHotelPanel();return false}
  if(t>=0xD8&&t<=0xDB)return false;
  if(t>=0xDC&&t<=0xDF){if(inventoryCount()>0){setPatch2x2(s.wx,s.wy,t<=0xDD?[0x73,0xF5,0x73,0xF5]:[0xF5,0x73,0xF5,0x73]);say('BRIDGE PATCH · original inventory-presence gate',65);return true}say('BRIDGE BLOCKED · inventory is empty',55);return false}
  if(t>=0xE0&&t<=0xE4)return false;
  if(t===0xE5||t===0xE7){say('ENDING GATE · use Time Key from ITEMS',75);return false}
  if(t===0xE8)return false;if(t===0xE9){if(player.terrainMode==='ship'||player.terrainMode==='marco')return true;if(hasInventoryItem(0x1B)){player.terrainMode='ship';say('MAGIC SHIP · OPEN WATER PASS',55);return true}if(hasInventoryItem(0x18)){spawnWaterMarco();say('MARCO CALLED · approaching from the left',55);return false}say('OPEN WATER · Magic Ship / Marco required',75);return false}
  if(t===0xEA||t===0xEB){player.terrainMode='land';return true}
  if(t===0xEC){player.terrainMode='land';if((frameCounter&0x1F)===0)damage(1,'CLIMATE');return true}
  if(t===0xED){setPatch2x2(s.wx,s.wy,[0xEC,0xEC,0xEC,0xEC]);player.terrainMode='sink';say('SINK TERRAIN → live 2×2 patch',70);return true}
  if(t===0xEE){if((frameCounter&0x1F)===0)damage(1,'CLIMATE');return true}
  if(t===0xEF){player.terrainMode='land';return true}
  if(t>=0xF0&&t<=0xF3){if(player.itemActionFlags&1){player.itemActionFlags&=~1;setPatch2x2(s.wx,s.wy,[0x2C,0x2C,0x2C,0x2C]);say('KEY GATE OPENED',70);return false}say('KEY GATE · use Key / Gold Key from ITEMS',75);return false}
  if(t===0xF4){say('MAGIC RAINBOW TERRAIN',50);return true}
  if(t===0xF5){player.terrainMode='swim';if((frameCounter&0x1F)===0)damage(1,'SWIM');return true}
  if(t===0xF6){if((frameCounter&3)===0)damage(1,'THORN');return true}
  if(t===0xF7){say(`WARP TERRAIN · release D-pad and press B${hasInventoryItem(0x17)?' · TIARA route':''}`,60);return true}
  if(t===0xF8||t===0xFA){say('PYRAMID · use Soul of Sandra from ITEMS',75);return false}
  if(t===0xF9||t===0xFB||t===0xFD||t===0xFF){changeRealm(true);return false}
  if(t===0xFC||t===0xFE){say('TIARA GATE · use Tiara from ITEMS',75);return false}
  return false;
}
function movementAllowed(dir){const s=collisionSample(dir);if(s.tile<0x60)return true;if(s.tile<0xD0)return false;return dispatchSpecialTerrain(s,dir)}
function requestedDir(){
  if(keys.has('ArrowUp')||keys.has('KeyW'))return 0;if(keys.has('ArrowDown')||keys.has('KeyS'))return 1;
  if(keys.has('ArrowLeft')||keys.has('KeyA'))return 2;if(keys.has('ArrowRight')||keys.has('KeyD'))return 3;return-1;
}
function attackPressed(){return pressed.has('Space')||pressed.has('KeyZ')||pressed.has('KeyJ')}
function weaponDamage(){
  const hp=player.maxHp,item=player.equippedItem;
  if(item===0x09||item===0x0A)return 8;
  if(item===0x0B)return Math.min(255,(hp>>5)+10);
  if(item===0x0C)return Math.min(255,(hp>>4)+20);
  if(item===0x0D)return Math.min(255,(hp>>5)+30);
  if(item===0x0E)return Math.min(255,(hp>>3)+20);
  if(item===0x0F)return Math.min(255,(hp>>2)+20);
  return 1;
}
function spawnScriptedGoldBag(){
  const slot=firstFreeActorSlot();if(slot<0)return false;const p=playerWorld(),o=GOLD_BAG_OFFSETS[facing]||[0,32];
  actors[slot]={kind:'item',itemId:0x1C,style:0,hidden:false,persistence:0xFF,pal:ITEM_SPRITE_ATTR[0x1C]&3,meta:ITEM_WORLD_META[0x1C],x:p.x+o[0],y:p.y+o[1],age:32,logicFrame:0,goldAmount:99,fixed:false};return true;
}
function tryAxeTerrainAction(){
  if(player.equippedItem!==0x09&&player.equippedItem!==0x0A)return false;
  const s=collisionSample(facing),base=s.tile&0xFC;let patch=null;
  if(base===0xD8)patch=[0x4C,0x4E,0x4D,0x4F];
  else if(base===0xE0&&player.hp>=0x80)patch=[0x2C,0x2C,0x2C,0x2C];
  else return false;
  setPatch2x2(s.wx,s.wy,patch);
  if(base===0xD8&&!goldBagSpawnLatch&&((camera.x>>8)&0xFF)===0&&((camera.y>>8)&0xFF)===7){goldBagSpawnLatch=true;spawnScriptedGoldBag()}
  if(player.equippedItem===0x09){const i=findInventorySlot(0x09);if(i>=0){const slot=player.inventory[i];if(slot.value!==0xFF&&slot.value>0){slot.value--;if(slot.value===0)clearInventorySlot(i)}}}
  say(`AXE TERRAIN PATCH $${hex(s.tile)}${player.equippedItem===0?' · AXE BROKE':''}`,70);return true;
}
function beginAttack(){if(player.dead||endingActive||attackTimer!==0)return;if(tryDirectionalWarp())return;attackTimer=16;attackHitActive=true;moving=false;tryAxeTerrainAction()}
function updatePlayer(){
  moving=false;if(player.dead||endingActive)return;
  if(attackPressed())beginAttack();
  if(attackTimer>0)return;
  const d=requestedDir();if(d<0)return;facing=d;if(!movementAllowed(d)){bump=5;return}moveCameraOnePixel(d);moving=true;
}

const simpleBase={
  0x00:0x27,0x01:0x01,0x02:0x09,0x03:0x11,0x04:0x15,0x05:0x91,0x06:0xAD,0x07:0x65,
  0x08:0x85,0x09:0xA9,0x0A:0xA1,0x0B:0xA5,0x0C:0x05,0x0D:0x0D,0x0E:0xC1,0x0F:0xC5,
  0x10:0xC9,0x11:0xCD,0x12:0xE1,0x13:0xE5,0x14:0xE9,0x15:0xED,0x16:0xB1,0x17:0xB5,
  0x18:0xB9,0x19:0xBD,0x1A:0x7D,0x1B:0xF9,0x1C:0xD9,0x1D:0xDD,0x1E:0x89,0x1F:0x8D,
  0x20:0x91,0x21:0x95,0x22:0x99,0x23:0x9D,0x24:0x9D,0x25:0x99,0x26:0x95,
  0x27:0x83,0x28:0x53,0x29:0x6D,0x2A:0x41,0x2B:0x43,0x2C:0x45,0x2D:0x47,0x2E:0x49,0x2F:0x4B,
  0x30:0x4D,0x31:0x81,0x32:0x51,0x33:0x4F,0x34:0x55,0x35:0x57,0x36:0x59,0x37:0x5B,0x38:0x5D,0x39:0x5F,
  0x3A:0x61,0x3B:0x69,0x3C:0x75,0x3D:0x6B,0x3E:0x6F,0x3F:0x71,0x40:0x73,0x41:0xCD,0x42:0xED,0x43:0xFD,0x44:0x26,0x45:0xC8,0x46:0xEC
};
const singleSimple=new Set([0x27,0x28,0x29,0x2A,0x2B,0x2C,0x2D,0x2E,0x2F,0x30,0x31,0x32,0x33,0x34,0x35,0x36,0x37,0x38,0x39,0x3B,0x3C,0x3D,0x3E,0x3F,0x40,0x44]);
function draw8x16(tile,pal,x,y,flip=false){ctx.save();if(flip){ctx.translate(Math.round(x)+8,0);ctx.scale(-1,1);x=0}else x=Math.round(x);ctx.drawImage(img.spr,tile*8,(pal&3)*16,8,16,x,Math.round(y),8,16);ctx.restore()}
function drawSimpleMeta(id,pal,x,y,hflip=false){
  const base=simpleBase[id];if(base==null)return false;
  if(singleSimple.has(id)){draw8x16(base,pal,x,y,hflip);return true}
  if(!hflip){draw8x16(base,pal,x,y,false);draw8x16((base+2)&255,pal,x+8,y,false)}
  else{draw8x16((base+2)&255,pal,x,y,true);draw8x16(base,pal,x+8,y,true)}return true;
}
function drawComplexMeta(id,basePal,x,y,hflip=false){
  const m=COMPLEX_META[id];if(!m)return false;
  for(const [tile,attr,dx,dy] of m.c){const ownPal=attr&3,pal=ownPal||basePal,localFlip=!!(attr&0x40),px=hflip?(m.w-8-dx):dx;draw8x16(tile,pal,x+px,y+dy,hflip?!localFlip:localFlip)}return true;
}
function playerMoveMeta(){
  if(!moving)return{id:[2,1,3,3][facing],flip:facing===2};
  const phase=(frameCounter>>3)&1,id=(phase?[13,12,3,3]:[2,1,4,4])[facing];return{id,flip:facing===2};
}
function playerAttackMeta(){
  const second=attackTimer<8,axe=player.equippedItem===0x09||player.equippedItem===0x0A;
  if(axe){if(facing===0)return{id:second?0xC9:0xC8,flip:false};if(facing===1)return{id:second?0xC7:0xC6,flip:false};return{id:second?0xCB:0xCA,flip:facing===2}}
  if(facing===0)return{id:second?0xC3:0xC2,flip:false};if(facing===1)return{id:second?0xC1:0xC0,flip:false};return{id:second?0xC5:0xC4,flip:facing===2};
}
function drawPlayer(){
  if(player.dead&&deathState==='sequence'){let id=0x1A,pal=0,flip=false;if(deathTimer<76){id=[1,3,2,3][facing];flip=facing===3}else if(deathTimer<123)id=0x06;else if(deathTimer<255){id=0x07;pal=3}drawSimpleMeta(id,pal,PLAYER_SCREEN.x,deathTimer>=255?deathY:PLAYER_SCREEN.y,flip);return}
  if(player.dead)return;
  if(invisibilityActive()&&(frameCounter&1))return;
  if(player.hurtBlink>0&&((player.hurtBlink>>1)&1)===0)return;
  if(attackTimer>0){const a=playerAttackMeta();drawComplexMeta(a.id,player.color&3,PLAYER_SCREEN.x,PLAYER_SCREEN.y,a.flip);return}
  const pm=playerMoveMeta();drawSimpleMeta(pm.id,player.color&3,PLAYER_SCREEN.x,PLAYER_SCREEN.y,pm.flip);
}

function terrainPassableForActor(x,y){if(x<0||x>=4096||y<0||y>=5120)return false;const t=resolveWorld(x+8,y+14).tile;return t<0x60||t===0xEC||t===0xED||t===0xEE||t===0xF6}
function clearActors(){for(let i=0;i<actors.length;i++)actors[i]=null}
function firstFreeActorSlot(){for(let i=0;i<actors.length;i++)if(!actors[i])return i;return-1}
function actorRequiresGroundCheck(cls){return![3,6,7,10,15].includes(cls)}
function initActorFromSpawnToken(token,x,y,persistence=0xFF){
  const slot=firstFreeActorSlot();if(slot<0)return false;
  if((token&0x80)===0){
    const itemId=token&0x1F,style=(token>>5)&3;
    const meta=style===1?0x44:style===2?0x3A:(ITEM_WORLD_META[itemId]||0x44);
    const pal=(style===1||style===2)?1:(ITEM_SPRITE_ATTR[itemId]&3);
    actors[slot]={kind:'item',itemId,style,hidden:style===1,persistence,pal,meta,x,y,age:32,logicFrame:0,goldAmount:0,fixed:persistence!==0xFF};
    return true;
  }
  const rec=token&0x3F,cls=VDATA.combatClass[rec]||0;if(cls===0)return false;
  if(actorRequiresGroundCheck(cls)&&!terrainPassableForActor(x,y))return false;
  const dir=(rng8()%8)+1,hp=VDATA.combatHp[rec]||1;
  if(cls===3){actors[slot]={kind:'marco',role:'reward',rewardTriggered:false,cls,rec,pal:3,x,y,dir:3,desired:3,timer:0,age:32,logicFrame:0,persistence,fixed:persistence!==0xFF};return true}
  actors[slot]={kind:'combat',cls,rec,pal:VDATA.combatPalette[rec]||0,x,y,dir,desired:dir,timer:1,age:0,logicFrame:0,hp,maxHp:hp,power:VDATA.combatPower[rec]||0,xp:VDATA.combatXp[rec]||0,hitTimer:0,deathTimer:0,aimedInterval:false,zounaTimer:0xFF,zounaVisible:true,persistence,fixed:persistence!==0xFF};return true;
}
function clearEncounterLocks(){encounterLocks.surface.fill(0);encounterLocks.dungeon.fill(0);say('ENCOUNTER LOCKS RESET',45)}
function scanAndSpawnFixedObjects(){
  const wantRealm=realm()==='dungeon'?1:0;
  for(const rec of VDATA.fixedObjects){
    const [rr,x,y,token,pidx,label,style]=rec;if(rr!==wantRealm)continue;
    const sx=x-camera.x,sy=y-camera.y,state=fixedState[pidx];
    const visible=sx>=0&&sx<248&&sy>=0&&sy<192;
    if(!visible){fixedState[pidx]=state&0xFE;continue}
    if((state&0x80)||(state&0x01))continue;
    if(firstFreeActorSlot()<0)break;
    const ok=initActorFromSpawnToken(token,x,y,pidx);
    fixedState[pidx]|=0x01;
    if(debug&&ok)say(`FIXED ${label||('TOKEN $'+hex(token))} · ${style||'combat'}`,45);
  }
}
function fixedPersistenceCleared(a){return a&&a.persistence!=null&&a.persistence!==0xFF&&(fixedState[a.persistence]&0x80)!==0}
function spawnWaterMarco(){
  if(actors.some(a=>a&&a.kind==='marco'&&a.role==='water'))return false;
  let slot=firstFreeActorSlot();if(slot<0)slot=0;const p=playerWorld();
  actors[slot]={kind:'marco',role:'water',rewardTriggered:false,cls:3,rec:7,pal:3,x:p.x+MARCO_WATER_SPAWN_OFFSET[0],y:p.y,dir:3,desired:3,timer:0,age:32,logicFrame:0,persistence:0xFF,fixed:false};return true;
}
function spawnMarcoReward(){
  const slot=firstFreeActorSlot();if(slot<0)return false;const p=playerWorld(),o=MARCO_REWARD_OFFSETS[facing]||[0,16];
  actors[slot]={kind:'item',itemId:0x18,style:0,hidden:false,persistence:0xFF,pal:ITEM_SPRITE_ATTR[0x18]&3,meta:ITEM_WORLD_META[0x18],x:p.x+o[0],y:p.y+o[1],age:32,logicFrame:0,goldAmount:0,fixed:false};return true;
}
function tryPeriodicCellEncounterWave(){
  if(frameCounter!==0||player.dead)return;
  const r=realm(),row=r==='dungeon'?((camera.y>>8)-0x0A):(camera.y>>8),col=(camera.x>>8)&0x0F;if(row<0||row>=10)return;
  const idx=row*16+col,locks=encounterLocks[r],bi=idx>>3,mask=1<<(idx&7);if(locks[bi]&mask)return;locks[bi]|=mask;
  const token=(r==='dungeon'?VDATA.encounterDungeon:VDATA.encounterSurface)[idx],rec=token&0x3F;
  if((VDATA.combatClass[rec]||0)===0){if(debug)say(`CELL ${row},${hex(col,1)} = NO SPAWN`,55);return}
  const p=playerWorld(),offsets=[[64,0],[0,-64],[-64,0],[0,64]];let made=0;
  for(const[dx,dy]of offsets){if(firstFreeActorSlot()<0)break;if(initActorFromSpawnToken(token,p.x+dx,p.y+dy))made++}
  say(`${VDATA.combatLabel[rec]} ×${made} · cell ${row},${hex(col,1)}`,70);
}

const enemyMetas={
  4:[0x0A,0x0B,0x0A,0x0B,0x0A,0x0B,0x0A,0x0B],5:[0x10,0x11,0x0E,0x0F,0x0E,0x0F,0x0E,0x0F],
  6:[0x1C,0x1D,0x1C,0x1D,0x1C,0x1D,0x1C,0x1D],7:[0x16,0x17,0x16,0x17,0x16,0x17,0x16,0x17],
  8:[0x18,0x19,0x18,0x19,0x18,0x19,0x18,0x19],9:[0x20,0x21,0x22,0x23,0x1E,0x1F,0x22,0x23],
  11:[0x12,0x13,0x12,0x13,0x12,0x13,0x12,0x13]
};
const directionFrameBase=[0,0,2,2,2,4,6,6,6],actorDelta={1:[0,-1],2:[1,-1],3:[1,0],4:[1,1],5:[0,1],6:[-1,1],7:[-1,0],8:[-1,-1]};
const projectileDelta={1:[0,-2],2:[2,-2],3:[2,0],4:[2,2],5:[0,2],6:[-2,2],7:[-2,0],8:[-2,-2]};
const KOAKUMAN_STRAFE=[7,7,1,1,3,3,5,5,7];
const SHOOTER_TEST_RECORDS=[0x0C,0x12,0x22,0x17,0x26];
let shooterTestIndex=0;
function dirToward(dx,dy){
  const sx=dx>6?1:dx<-6?-1:0,sy=dy>6?1:dy<-6?-1:0;if(sx===0&&sy<0)return 1;if(sx>0&&sy<0)return 2;if(sx>0&&sy===0)return 3;if(sx>0&&sy>0)return 4;
  if(sx===0&&sy>0)return 5;if(sx<0&&sy>0)return 6;if(sx<0&&sy===0)return 7;if(sx<0&&sy<0)return 8;return 0;
}
function updateDesiredDirection(a){const p=playerWorld();a.desired=dirToward(p.x-a.x,p.y-a.y)||a.desired||3;return a.desired}
function chooseActorDirection(a){
  const p=playerWorld(),dx=p.x-a.x,dy=p.y-a.y;if(invisibilityActive()&&a.cls!==15){a.dir=(rng8()%8)+1;a.timer=20+(rng8()&63);return}if(a.cls===11){const d=dirToward(-dx,-dy);a.dir=d||((rng8()%8)+1)}
  else if(a.cls===5||a.cls===7)a.dir=dirToward(dx,dy)||a.dir;else if(a.cls===6)a.dir=(rng8()&1)?3:7;
  else if(a.cls===8)a.dir=(Math.abs(dx)+Math.abs(dy)<128)?(dirToward(dx,dy)||a.dir):((rng8()%8)+1);else a.dir=(rng8()<128)?(dirToward(dx,dy)||a.dir):((rng8()%8)+1);a.timer=20+(rng8()&63);
}
function moveCombatActor(a,dir=a.dir,ignoreTerrain=false){const d=actorDelta[dir]||[0,0],nx=a.x+d[0],ny=a.y+d[1];if(ignoreTerrain||terrainPassableForActor(nx,ny)){a.x=nx;a.y=ny;return true}return false}
function swordBoxOverlapsPoint(x,y){
  if(!attackHitActive)return false;const sx=x-camera.x,sy=y-camera.y,[xe,ye]=SWORD_EXTENTS[facing];if(Math.abs(sx-PLAYER_SCREEN.x)>=xe||Math.abs(sy-PLAYER_SCREEN.y)>=ye)return false;
  const actorToPlayer=dirToward(PLAYER_SCREEN.x-sx,PLAYER_SCREEN.y-sy);return SWORD_ARCS[facing].includes(actorToPlayer);
}
function swordOverlaps(a){return a.kind==='combat'&&a.hitTimer<=0&&a.hp>0&&a.age>=32&&swordBoxOverlapsPoint(a.x,a.y)}
function applySwordHit(a){
  const dmg=weaponDamage();if(dmg<=0)return;attackHitActive=false;a.hp=Math.max(0,a.hp-dmg);a.hitTimer=40;a.knockDir=facing;say(`${VDATA.combatLabel[a.rec]}  -${dmg} HP  ${a.hp}/${a.maxHp}`,45);
}
function finalizeDefeat(a){
  player.xp=Math.min(600000,player.xp+a.xp);const rare=(rng8()&0xF8)===0,itemId=(rare?DROP_RARE:DROP_COMMON)[a.cls]||0;
  const fixedPersistence=a.persistence;
  if(fixedPersistence!=null&&fixedPersistence!==0xFF){if(a.cls===10)fixedState[fixedPersistence]=0x01;else fixedState[fixedPersistence]|=0x80}
  a.kind='item';a.cls=1;a.itemId=itemId;a.style=0;a.hidden=false;a.persistence=0xFF;a.fixed=false;a.pal=ITEM_SPRITE_ATTR[itemId]&3;a.meta=ITEM_WORLD_META[itemId]||0x44;a.hitTimer=0;a.deathTimer=0;a.age=32;
  const roll=(rng8()>>3)&6,gold=[1,2,5,10][roll>>1];a.goldAmount=itemId===0x1C?gold:0;
  say(`DEFEATED +${a.xp} XP · DROP ${rare?'RARE ':''}${ITEM_NAMES[itemId]}`,95);
}
function tryPickupItem(a,i){
  if(!bodyOverlap(a,12))return;
  if(a.hidden){say(`HIDDEN ${ITEM_NAMES[a.itemId]} · cast TRUE SIGHT`,35);return}
  if(a.style===2){
    const keyAction=(player.itemActionFlags&1)!==0,axe=player.equippedItem===0x09||player.equippedItem===0x0A;
    if(!keyAction){
      if(!(attackPressed()&&axe)){say('TREASURE CHEST · use Key/Gold Key, or B with Axe',40);return}
      player.poison=true;say('CHEST FORCED OPEN WITH AXE · POISONED',70);
    }
  }
  if(a.itemId===0x1C){player.gold+=a.goldAmount||1;say(`GOLD BAG +${a.goldAmount||1} · GOLD ${player.gold}`,70)}
  else if(!addInventoryItem(a.itemId)){say(`INVENTORY FULL · ${ITEM_NAMES[a.itemId]} remains here`,70);return}
  else say(`PICKUP ${ITEM_NAMES[a.itemId]}`,70)
  if(a.persistence!=null&&a.persistence!==0xFF)fixedState[a.persistence]|=0x80;
  actors[i]=null;renderInventoryPanel();
}
function damageFromActorIfOverlap(a){if(!player.dead&&bodyOverlap(a,12))damage(a.power,VDATA.combatLabel[a.rec])}
function contactDamageTick(a){
  if(player.dead||a.hitTimer>0||!bodyOverlap(a,12))return;
  let fire=false;if([4,5].includes(a.cls))fire=(a.logicFrame&0x1F)===0x10;else if(a.cls===7)fire=(a.logicFrame&0x3F)===0x20;else if(a.cls===11)fire=(a.logicFrame&0x1F)===0x10;
  if(fire)damage(a.power,VDATA.combatLabel[a.rec]);
}
function spawnEnemyProjectile(parent,zouna=false){
  const slot=firstFreeActorSlot();if(slot<0)return false;const d=updateDesiredDirection(parent)||3;
  actors[slot]={kind:'projectile',projectileType:zouna?'zouna':'normal',cls:zouna?13:12,rec:parent.rec,pal:1,x:parent.x+4,y:parent.y,dir:d,desired:d,age:0,logicFrame:0,power:parent.power,impactTimer:0,meta:zouna?0x41:0x31};
  return true;
}
function enterProjectileImpact(a){attackHitActive=false;a.impactTimer=8;a.logicFrame=0;a.meta=0x1B}
function updateProjectile(a,i){
  const sx=a.x-camera.x,sy=a.y-camera.y;if(sx<0||sx>=248||sy<0||sy>=192){actors[i]=null;return}
  a.age++;a.logicFrame++;
  if(a.impactTimer>0){if(--a.impactTimer===0)actors[i]=null;return}
  if(bodyOverlap(a,12)){
    if(attackHitActive){enterProjectileImpact(a);return}
    damage(a.power,`${VDATA.combatLabel[a.rec]} SHOT`);enterProjectileImpact(a);return;
  }
  if(swordBoxOverlapsPoint(a.x,a.y)){enterProjectileImpact(a);return}
  const d=projectileDelta[a.dir||3]||projectileDelta[3];a.x+=d[0];a.y+=d[1];
  if(a.projectileType==='zouna')a.meta=((a.logicFrame>>2)&1)?0x42:0x41;else a.meta=0x31;
}
function updateKoakumanAI(a){
  updateDesiredDirection(a);if(--a.timer<=0){a.timer=0x16+(rng8()&0x3F);a.dir=invisibilityActive()?((rng8()%8)+1):(KOAKUMAN_STRAFE[a.desired]||7)}
  moveCombatActor(a,a.dir,true);if((a.logicFrame&7)===0)a.y+=(a.logicFrame&8)?-6:6;
  if((a.logicFrame&0x0F)!==0)return;const phase=(a.logicFrame>>4)&1;let projectileCheck=phase===0;
  if(phase){if((rng8()&0x80)===0){damageFromActorIfOverlap(a);projectileCheck=true}else if(!invisibilityActive()&&bodyOverlap(a,12)&&(rng8()&0x70)===0){player.poison=true;say('KOAKUMAN POISON',70)}}
  if(projectileCheck&&a.hp>=0x19&&(rng8()&0x18)===0)spawnEnemyProjectile(a,false);
}
function updateSochikisuAI(a){
  const d=updateDesiredDirection(a),sx=a.x-camera.x,dx=Math.abs(sx-PLAYER_SCREEN.x),dy=Math.abs((a.y-camera.y)-PLAYER_SCREEN.y),near=dx<0x3A&&dy<0x3A;
  if(near){a.dir=invisibilityActive()?((rng8()%8)+1):d;moveCombatActor(a,a.dir,false)}else{if(sx<0x20)a.dir=3;else if(sx>=0xD0)a.dir=7;if((a.logicFrame&1)===0)moveCombatActor(a,a.dir,false)}
  if((a.logicFrame&0x0F)!==0)return;const phase=(a.logicFrame>>4)&1;if(phase)damageFromActorIfOverlap(a);if(a.hp>=0x41&&(rng8()&0x18)===0)spawnEnemyProjectile(a,false);
}
function updateRobotianAI(a){
  updateDesiredDirection(a);if(--a.timer<=0){a.timer=0x16+(rng8()&0x3F);if(!a.aimedInterval){a.aimedInterval=true;a.dir=invisibilityActive()?((rng8()%8)+1):a.desired;spawnEnemyProjectile(a,false)}else{a.aimedInterval=false;a.dir=[1,3,5,7][(rng8()>>6)&3]}}
  if((a.logicFrame&1)===0&&!moveCombatActor(a,a.dir,false))a.dir=[1,3,5,7][(rng8()>>6)&3];
}
function updateZounaAI(a){
  updateDesiredDirection(a);a.zounaTimer=(a.zounaTimer-1)&255;if(a.zounaTimer===0){a.zounaTimer=0xFF;const zd=invisibilityActive()?((rng8()%8)+1):a.desired;const d=actorDelta[zd]||[0,0];a.x+=d[0]*24;a.y+=d[1]*24}
  const t=a.zounaTimer;a.zounaVisible=!(t<0x07||((t<0x27||t>=0xDF)&&(t&1)));if(!a.zounaVisible)return;
  if(a.logicFrame&0x20){if((a.logicFrame&0x1F)===0)spawnEnemyProjectile(a,true)}else if((a.logicFrame&0x1F)===0)damageFromActorIfOverlap(a);
}
function updateShizasuAI(a){
  a.dir=updateDesiredDirection(a);if((a.logicFrame&0x0F)!==0)return;const phase=(a.logicFrame>>4)&1;if(phase&&(rng8()&0x18)!==0)spawnEnemyProjectile(a,false);if((rng8()&0xC0)===0)damageFromActorIfOverlap(a);
}
function updateGenericCombatAI(a){
  contactDamageTick(a);if(--a.timer<=0)chooseActorDirection(a);let cadence=3;if(a.cls===7)cadence=1;else if(a.cls===11)cadence=2;if((frameCounter%cadence)!==0)return;
  if(!moveCombatActor(a,a.dir,[7].includes(a.cls)))chooseActorDirection(a);
}
function updateMarcoActor(a,i){
  a.logicFrame++;
  if(a.role==='water'){
    a.x+=1;
    if(bodyOverlap(a,16)){
      if(collisionSample(facing).tile===0xE9){player.terrainMode='marco';say('MARCO TRANSPORT · OPEN WATER PASS',80)}
      else say('MARCO ARRIVED · facing tile is no longer open water',60);
      actors[i]=null;
    }
    return;
  }
  if(!a.rewardTriggered&&bodyOverlap(a,16)&&player.spellHealTimer>0){
    player.poison=false;player.hp=player.maxHp;player.mp=player.maxMp;
    const reward=spawnMarcoReward();a.rewardTriggered=true;
    say(reward?'MARCO EVENT · FULL HEAL + MARCO REWARD':'MARCO EVENT · FULL HEAL · reward lost (actor pool full)',100);
  }
  if(a.rewardTriggered)a.x-=1;
}
function tryFireballHit(a){
  if(!spellIs(2)||a.kind!=='combat'||a.hp<=0||a.hitTimer>0)return false;const sx=a.x-camera.x,sy=a.y-camera.y;if(Math.abs(sx-spell.x)>=12||Math.abs(sy-spell.y)>=12)return false;
  const dmg=fireballDamageFor(a);a.hp=Math.max(0,a.hp-dmg);a.hitTimer=40;a.knockDir=spell.dir;resetSpell();say(`FIREBALL → ${VDATA.combatLabel[a.rec]} -${dmg} HP`,70);if(a.hp===0)a.deathTimer=8;return true;
}
function updatePyramidOpening(a,i){
  a.logicFrame++;if((a.logicFrame&3)!==0)a.x-=1;a.meta=0x0E+((a.logicFrame>>4)&1);const sx=a.x-camera.x;if(!a.patched&&sx<=0x80&&pyramidPatchAnchor){setPatch2x2(pyramidPatchAnchor.x,pyramidPatchAnchor.y,[0x6D,0x6D,0xF9,0xFB]);a.patched=true;say('PYRAMID OPENED · dungeon entrance exposed',110)}if(sx<-32)actors[i]=null;
}
function updateActor(a,i){
  if(a.kind==='pyramid'){updatePyramidOpening(a,i);return}
  if(a.kind==='projectile'){updateProjectile(a,i);return}
  const sx=a.x-camera.x,sy=a.y-camera.y;if(sx<-32||sx>=272||sy<-40||sy>=205){actors[i]=null;return}
  if(a.kind==='item'){tryPickupItem(a,i);return}
  if(a.kind==='marco'){updateMarcoActor(a,i);return}
  a.age++;a.logicFrame++;updateDesiredDirection(a);
  if(a.deathTimer>0){if(--a.deathTimer===0)finalizeDefeat(a);return}
  if(a.hitTimer>0){
    if(a.hitTimer>32&&a.cls!==15){const d=KNOCKBACK[a.knockDir]||[0,0];a.x+=d[0];a.y+=d[1]}a.hitTimer--;
    if(a.hitTimer===0&&a.hp===0)a.deathTimer=8;return;
  }
  if(a.hp===0){a.deathTimer=8;return}
  if(a.age<32)return;
  if(tryFireballHit(a))return;
  if(starFluteActive()){a.logicFrame++;return}
  if(swordOverlaps(a)){applySwordHit(a);return}
  if(bodyOverlap(a,12))hudEnemy=a;
  if(a.age===32){if(a.cls===6)a.timer=0x16+(rng8()&0x3F);else if(a.cls===9)a.timer=1;else if(a.cls===10)a.zounaTimer=0xFF;else a.timer=20+(rng8()&63)}
  if(a.cls===6)updateKoakumanAI(a);else if(a.cls===8)updateSochikisuAI(a);else if(a.cls===9)updateRobotianAI(a);else if(a.cls===10)updateZounaAI(a);else if(a.cls===15)updateShizasuAI(a);else updateGenericCombatAI(a);
}
function updateActors(){hudEnemy=null;for(let i=0;i<actors.length;i++)if(actors[i])updateActor(actors[i],i)}
function drawActor(a){
  const x=a.x-camera.x,y=a.y-camera.y;if(a.kind==='item'){drawSimpleMeta(a.meta,a.pal,x+4,y+4,false);return}
  if(a.kind==='pyramid'){drawSimpleMeta(a.meta,2,x,y,false);return}
  if(a.kind==='marco'){drawSimpleMeta(((a.logicFrame>>3)&1)?0x25:0x24,3,x,y,a.role==='reward'&&a.rewardTriggered);return}
  if(a.kind==='projectile'){drawSimpleMeta(a.impactTimer>0?0x1B:a.meta,a.impactTimer>0?3:1,x,y,false);return}
  if(a.deathTimer>0){drawSimpleMeta(0x1B,3,x,y,false);return}
  if(a.age<32&&((a.age>>2)&1)===0)return;
  const flashPal=a.hitTimer>0?((a.hitTimer&2)?3:1):a.pal;
  if(a.cls===10){if(!a.zounaVisible)return;drawComplexMeta((a.logicFrame&0x20)?0xCF:0xCE,flashPal,x,y,false);return}
  if(a.cls===15){drawComplexMeta(((a.logicFrame>>4)&1)?0xD2:0xD1,flashPal,x,y,false);return}
  const table=enemyMetas[a.cls];if(table){const phase=(a.logicFrame>>4)&1,base=directionFrameBase[a.dir]||0,index=base+phase;drawSimpleMeta(table[index],flashPal,x,y,(index&6)===6);return}
  ctx.fillStyle='#fff';ctx.fillRect(Math.round(x)+3,Math.round(y)+3,10,10);ctx.fillStyle='#000';ctx.font='8px monospace';ctx.fillText('?',Math.round(x)+6,Math.round(y)+12);
}
function spawnShooterTest(){
  if(mode!=='game'||player.dead)return;const rec=SHOOTER_TEST_RECORDS[shooterTestIndex++%SHOOTER_TEST_RECORDS.length],p=playerWorld();
  if(initActorFromSpawnToken(0x80|rec,p.x+56,p.y)){const a=actors.find(x=>x&&x.kind==='combat'&&x.rec===rec&&x.age===0);if(a){a.age=32;a.logicFrame=0;a.timer=1}say(`DEV SPAWN ${VDATA.combatLabel[rec]} · F3 NEXT`,75)}else say('DEV SPAWN FAILED · actor slots full',75);
}

function updateEnding(){
  if(!endingActive)return;
  if(ending.phase===0){ending.phase=1;ending.timer=0;ending.flash=0;return}
  if(ending.phase===1){ending.timer++;if(ending.timer>=720){ending.phase=2;ending.timer=0;clearActors()}return}
  if(ending.phase===2){ending.phase=3;ending.scene=0;ending.timer=0;return}
  if(ending.phase===3){ending.phase=4;ending.timer=0;return}
  if(ending.phase===4){if(++ending.timer>=280){ending.timer=0;if(ending.scene<9){ending.scene++;ending.phase=3}else{ending.phase=5;ending.scroll=0}}return}
  if(ending.phase===5){if(++ending.scroll>=240){ending.scroll=240;ending.phase=6}return}
}
function tileForEndingChar(ch){if(ch===' ')return 0x26;if(ch==='.')return 0x24;if(ch===',')return 0x25;const i=PASSWORD_ALPHABET.indexOf(ch);return i>=0?i:0x26}
function drawEndingTextScene(scene,dy=0){ctx.fillStyle='#000';ctx.fillRect(0,0,256,240);for(const rec of ENDING_SCENES[scene]||[]){const off=(rec.a&0x3FF),row=(off>>5),col=off&31;for(let i=0;i<rec.t.length;i++)drawBgTile(img.title,tileForEndingChar(rec.t[i]),0,(col+i)*8,row*8+dy)}}
function drawEndingFinalGraphic(y){const top=[0xDC,0xDE,0xF4,0xF6,0xF8,0xFA,0xFC,0xFE],bottom=[0xDD,0xDF,0xF5,0xF7,0xF9,0xFB,0xFD,0xFF];for(let i=0;i<8;i++){drawBgTile(img.title,top[i],0,96+i*8,y);drawBgTile(img.title,bottom[i],0,96+i*8,y+8)}}
function drawEndingScreen(){
  if(ending.phase<2)return false;
  if(ending.phase===5){drawEndingTextScene(9,-ending.scroll);drawEndingFinalGraphic(240-ending.scroll+112);return true}
  drawEndingTextScene(Math.min(9,ending.scene));if(ending.phase===6){drawEndingFinalGraphic(112);ctx.fillStyle='#aaa';ctx.font='8px monospace';ctx.fillText('ENDING · PHASE 6 HOLD',76,224)}return true;
}
function updateWorldClock(){if(++worldClockSubsecond<60)return;worldClockSubsecond=0;worldClockSecond++;if(worldClockSecond>=0x80){worldClockSecond=0;worldDay++}if(worldClockSecond===0x38||worldClockSecond===0x78)clearEncounterLocks()}
function update(){
  frame++;if(mode!=='game'){pressed.clear();return}if(uiPaused()){pressed.clear();return}if(player.dead){frameCounter=(frameCounter+1)&255;updateDeathSequence();pressed.clear();return}if(endingActive){frameCounter=(frameCounter+1)&255;updateEnding();pressed.clear();return}frameCounter=(frameCounter+1)&255;updateWorldClock();updateSpellEffect();updatePlayer();if(!starFluteActive()){scanAndSpawnFixedObjects();tryPeriodicCellEncounterWave()}updateActors();
  attackHitActive=false;if(attackTimer>0)attackTimer--;if(player.hurtBlink>0)player.hurtBlink--;if(player.spellHealTimer>0)player.spellHealTimer--;if(noticeTimer>0)noticeTimer--;player.itemActionFlags=0;pressed.clear();
}

function drawSpellEffect(){
  if(spell.type===0)return;
  if(spell.type===2){let meta=spell.dir<2?0x29:0x3D,attr=1;if(spell.dir===0)attr=((spell.frame>>2)&1)?0x41:0x01;else if(spell.dir===1)attr=((spell.frame>>2)&1)?0xC1:0x81;else if(spell.dir===2)attr=((spell.frame>>2)&1)?0x81:0x01;else attr=((spell.frame>>2)&1)?0xC1:0x41;const h=!!(attr&0x40),v=!!(attr&0x80),tile=simpleBase[meta];if(tile!=null){ctx.save();ctx.translate(Math.round(spell.x)+(h?8:0),Math.round(spell.y)+(v?16:0));ctx.scale(h?-1:1,v?-1:1);ctx.drawImage(img.spr,tile*8,(attr&3)*16,8,16,0,0,8,16);ctx.restore()}return}
  if([1,6].includes(spell.type)&&((spell.timer>>2)&1)===0){drawSimpleMeta(spell.type===1?0x3B:0x33,1,PLAYER_SCREEN.x+4,PLAYER_SCREEN.y-12,false)}
  if(spell.type===7&&((spell.timer>>2)&1)){ctx.fillStyle='rgba(230,230,230,.22)';ctx.fillRect(0,0,256,216)}
}
function drawWorld(){
  if(endingActive&&drawEndingScreen())return;
  ctx.fillStyle='#000';ctx.fillRect(0,0,256,240);const ox=-(camera.x&7),oy=-(camera.y&7),sx=camera.x&~7,sy=camera.y&~7;
  for(let r=-1;r<28;r++)for(let c=-1;c<33;c++){const wx=sx+c*8,wy=sy+r*8;if(wy<0||wy>=5120)continue;const z=resolveLiveWorld(wx,wy);drawBgTile(img.world,z.tile,z.pal,ox+c*8,oy+r*8)}
  for(const a of actors)if(a)drawActor(a);drawPlayer();drawSpellEffect();
  if(bump>0){ctx.strokeStyle='#fff';ctx.strokeRect(PLAYER_SCREEN.x-1,PLAYER_SCREEN.y-1,18,18);bump--}
  if(hudEnemy&&hudEnemy.kind==='combat'){ctx.fillStyle='rgba(0,0,0,.78)';ctx.fillRect(142,4,110,17);ctx.fillStyle='#fff';ctx.font='8px monospace';ctx.fillText(`${VDATA.combatLabel[hudEnemy.rec]} ${hudEnemy.hp}/${hudEnemy.maxHp}`,146,15)}
  if(noticeTimer>0){ctx.fillStyle='rgba(0,0,0,.76)';ctx.fillRect(6,196,244,16);ctx.fillStyle='#fff';ctx.font='8px monospace';ctx.fillText(notice.slice(0,42),10,207)}
  ctx.fillStyle='rgba(0,0,0,.86)';ctx.fillRect(0,216,256,24);ctx.fillStyle='#fff';ctx.font='8px monospace';
  const alive=actors.reduce((n,a)=>n+(a&&a.kind==='combat'?1:0),0),shots=actors.reduce((n,a)=>n+(a&&a.kind==='projectile'?1:0),0);ctx.fillText(`HP ${player.hp}/${player.maxHp} MP ${player.mp}/${player.maxMp} G ${player.gold}`,8,226);ctx.fillText(`${realm().toUpperCase()} XP ${player.xp} DMG ${weaponDamage()} ${ITEM_NAMES[player.equippedItem]||'NO WPN'} LV ${player.level} S9`,8,236);
  if(endingActive&&ending.phase===1){const sec=ending.timer/60,alpha=sec<5?0.15+0.08*((frameCounter>>2)&3):sec<10?0.28+0.28*((frameCounter>>2)&1):0.72;ctx.fillStyle=`rgba(0,0,0,${Math.min(.9,alpha)})`;ctx.fillRect(0,0,256,240);if(sec>=5&&sec<10&&((frameCounter>>2)&1)){ctx.fillStyle='rgba(255,255,255,.28)';ctx.fillRect(0,0,256,240)}}
  if(player.dead&&deathState==='sequence'&&deathTimer<255){ctx.fillStyle='rgba(0,0,0,.58)';ctx.fillRect(61,84,134,29);ctx.fillStyle='#fff';ctx.font='11px monospace';ctx.fillText('VALKYRIE DOWN',78,103)}
  if(player.dead&&deathState==='gameover'){ctx.fillStyle='rgba(0,0,0,.92)';ctx.fillRect(28,67,200,96);ctx.fillStyle='#fff';ctx.font='16px monospace';ctx.fillText('GAME OVER',84,101);ctx.font='8px monospace';ctx.fillText('START / ENTER → TITLE',73,124);ctx.fillText(hasSave()?'☰ menu → LOAD SAVE available':'No local save yet',69,142)}
  if(debug){
    const p=playerWorld(),s=collisionSample(facing),row=realm()==='dungeon'?((camera.y>>8)-10):(camera.y>>8),col=(camera.x>>8)&15;
    ctx.fillStyle='rgba(0,0,0,.84)';ctx.fillRect(4,4,132,78);ctx.fillStyle='#7CFF91';ctx.font='8px monospace';ctx.fillText(`CAM $${hex(camera.x,4)} $${hex(camera.y,4)}`,8,14);
    ctx.fillText(`P ${p.x|0},${p.y|0} FACE $${hex(s.tile)}`,8,24);ctx.fillText(`CELL ${row},${hex(col,1)} FC $${hex(frameCounter)}`,8,34);ctx.fillText(`ATK ${attackTimer} HIT ${attackHitActive?1:0}`,8,44);
    ctx.fillText(`PATCH ${terrainPatches.size} LOCK ${countLocks(encounterLocks[realm()])}`,8,54);ctx.fillText(`POISON ${player.poison?1:0} INV ${inventoryCount()}`,8,64);ctx.fillText(`SPELL ${spell.type} T ${spell.timer}`,8,74);
  }
}
function countLocks(a){let n=0;for(const b of a){let v=b;while(v){n+=v&1;v>>=1}}return n}

let acc=0,last=performance.now();
function loop(t){const dt=Math.min(100,t-last);last=t;acc+=dt;while(acc>=1000/60){update();acc-=1000/60}if(mode==='title')drawTitle();else drawWorld();requestAnimationFrame(loop)}
function start(force=false,traits=null){
  if(mode!=='title'&&!force&&!player.dead)return;mode='game';camera.x=0x0100;camera.y=0x0800;facing=1;moving=false;bump=0;attackTimer=0;attackHitActive=false;
  frameCounter=0xFF;worldClockSubsecond=0;worldClockSecond=0;worldDay=0;rngState=0xA7;goldBagSpawnLatch=false;
  const sign=traits?.sign??player.sign??0,blood=traits?.blood??player.blood??0,color=traits?.color??player.color??0;player.sign=sign%12;player.blood=blood&3;player.color=color&3;player.level=1;player.expThresholdIndex=INITIAL_EXP_CURVE[player.blood];player.passwordSalt=rng8()&7;
  const residue=player.sign&3;if(residue===0){player.maxHp=64;player.maxMp=32}else if(residue===1){player.maxHp=48;player.maxMp=48}else if(residue===2){player.maxHp=32;player.maxMp=64}else{player.maxHp=32+(rng8()&31);player.maxMp=96-player.maxHp}player.hp=player.maxHp;player.mp=player.maxMp;
  player.poison=false;player.terrainMode='land';player.xp=0;player.gold=0;player.equipment.mantle=false;player.equipment.helmet=false;player.selectedSpell=0;player.spellHealTimer=0;player.itemActionFlags=0;resetInventory();player.hurtBlink=0;player.dead=false;
  resetSpell();endingActive=false;ending.phase=0;ending.timer=0;ending.scene=0;ending.scroll=0;ending.flash=0;pyramidPatchAnchor=null;deathState='alive';deathTimer=0;deathY=PLAYER_SCREEN.y;gameOverTimer=0;serviceMode=null;terrainPatches.clear();encounterLocks.surface.fill(0);encounterLocks.dungeon.fill(0);fixedState.fill(0);clearActors();notice='';noticeTimer=0;pressed.clear();keys.clear();closeGameMenu();closeInventoryPanel();closeServicePanel();closeSetupPanel();closePasswordPanel();renderInventoryPanel();
}
function returnToTitle(){mode='title';player.dead=false;deathState='alive';endingActive=false;keys.clear();pressed.clear();closeGameMenu();closeInventoryPanel();closeServicePanel();closeSetupPanel();closePasswordPanel()}
function toggleDebug(){debug=!debug;say(`DEBUG ${debug?'ON':'OFF'}`,45);updateMenuStatus()}

const menuBtn=document.getElementById('menuBtn'),gameMenu=document.getElementById('gameMenu'),menuStatus=document.getElementById('menuStatus');
const inventoryPanel=document.getElementById('inventoryPanel'),inventoryGrid=document.getElementById('inventoryGrid'),spellGrid=document.getElementById('spellGrid'),invStats=document.getElementById('invStats'),invClose=document.getElementById('invClose');
const servicePanel=document.getElementById('servicePanel'),serviceTitle=document.getElementById('serviceTitle'),serviceStats=document.getElementById('serviceStats'),serviceBody=document.getElementById('serviceBody'),serviceClose=document.getElementById('serviceClose');
const setupPanel=document.getElementById('setupPanel'),setupClose=document.getElementById('setupClose'),setupStart=document.getElementById('setupStart'),signSelect=document.getElementById('signSelect'),bloodSelect=document.getElementById('bloodSelect'),colorSelect=document.getElementById('colorSelect');
const passwordPanel=document.getElementById('passwordPanel'),passwordClose=document.getElementById('passwordClose'),passwordInput=document.getElementById('passwordInput'),passwordSubmit=document.getElementById('passwordSubmit'),passwordStatus=document.getElementById('passwordStatus'),checkpointLoad=document.getElementById('checkpointLoad');
function uiPaused(){return gameMenu.classList.contains('open')||inventoryPanel.classList.contains('open')||servicePanel.classList.contains('open')||setupPanel.classList.contains('open')||passwordPanel.classList.contains('open')}
function itemVerb(id){if(!id)return 'EMPTY';if(isWeapon(id))return 'EQUIP';if(id===0x1B)return 'PASSIVE';if(id===0x18)return 'USE / PASSIVE';return 'USE'}
function renderInventoryPanel(){
  if(!inventoryGrid)return;
  invStats.textContent=`LV ${player.level} · XP ${player.xp} · HP ${player.hp}/${player.maxHp} · MP ${player.mp}/${player.maxMp} · Gold ${player.gold} · Weapon ${ITEM_NAMES[player.equippedItem]||'None'} · Mantle ${player.equipment.mantle?'ON':'OFF'} · Helmet ${player.equipment.helmet?'ON':'OFF'} · ${player.poison?'POISONED':'OK'}`;
  inventoryGrid.innerHTML=player.inventory.map((slot,i)=>{
    if(!slot.id)return `<button class="invItem empty" data-slot="${i}" disabled>${i+1}. EMPTY</button>`;
    const eq=player.equippedSlot===i?' equipped':'',tag=player.equippedSlot===i?' · EQUIPPED':'';
    return `<button class="invItem${eq}" data-slot="${i}">${i+1}. ${ITEM_NAMES[slot.id]} ${inventoryValueLabel(slot)}${tag}<br>${itemVerb(slot.id)}</button>`;
  }).join('');
  spellGrid.innerHTML=SPELL_NAMES.map((name,id)=>{
    const locked=player.maxMp<SPELL_UNLOCK[id],implemented=id>0,none=id===0;
    const cls=locked?' locked':(!implemented&&!none?' pending':'');
    const status=locked?`LOCK · MaxMP ${SPELL_UNLOCK[id]}`:(none?'NO SPELL':implemented?`CAST · ${SPELL_COST[id]} MP`:'LATER STAGE');
    return `<button class="spellItem${cls}" data-spell="${id}" ${(locked||!implemented||none)?'disabled':''}>${name}<br>${status}</button>`;
  }).join('');
}

function renderServicePanel(){
  if(!servicePanel||!serviceMode)return;serviceStats.textContent=`HP ${player.hp}/${player.maxHp} · MP ${player.mp}/${player.maxMp} · Gold ${player.gold} · Slots ${inventoryCount()}/8`;
  if(serviceMode==='shop'){
    const profile=SHOP_PROFILES[activeShopProfile];serviceTitle.textContent=`SHOP · PROFILE ${activeShopProfile}`;
    const buy=profile.map(id=>`<button class="serviceItem" data-buy="${id}">${ITEM_NAMES[id]}<br>BUY ${buyPrice(id)} G</button>`).join('');
    const sell=player.inventory.map((slot,i)=>slot.id?`<button class="serviceItem sell" data-sell="${i}">${i+1}. ${ITEM_NAMES[slot.id]} ${inventoryValueLabel(slot)}<br>SELL ${sellPrice(slot.id)} G</button>`:`<button class="serviceItem empty" disabled>${i+1}. EMPTY</button>`).join('');
    serviceBody.innerHTML=`<div class="serviceSection">BUY · 原作 profile 6 shelves</div><div class="serviceGrid">${buy}</div><div class="serviceSection">SELL · buy price 的一半</div><div class="serviceGrid">${sell}</div>`;
  }else{
    serviceTitle.textContent='HOTEL';const poison=player.poison?'20 G cure':'OK',mp=player.mp<player.maxMp?'20 G → full':'FULL',hp=player.hp<player.maxHp?`${player.maxHp-player.hp} HP missing · 1 G/HP`:'FULL',pw=encodeRetailPassword();
    serviceBody.innerHTML=`<div class="hotelInfo">LV ${player.level} · XP ${player.xp} · NEXT ${expThreshold(player.expThresholdIndex)}<br>POISON ${poison}<br>MP ${mp}<br>HP ${hp}<br><br>RETAIL PASSWORD<br><b style="letter-spacing:.08em">${pw}</b><br><br>REST 先處理 level-up，再依原作順序付款，最後建立本機 checkpoint。</div><button class="serviceWide" data-password-copy="${pw}">COPY PASSWORD</button><button class="serviceWide" data-hotel-rest="1">REST + SAVE CHECKPOINT</button>`;
  }
}
function closeServicePanel(){if(servicePanel)servicePanel.classList.remove('open');serviceMode=null}
function openShopPanel(){if(mode!=='game'||player.dead)return;closeGameMenu();closeInventoryPanel();activeShopProfile=shopProfileForWorld();serviceMode='shop';renderServicePanel();servicePanel.classList.add('open');keys.clear();pressed.clear();setDpadKey(null);say(`SHOP PROFILE ${activeShopProfile}`,45)}
function openHotelPanel(){if(mode!=='game'||player.dead)return;closeGameMenu();closeInventoryPanel();serviceMode='hotel';renderServicePanel();servicePanel.classList.add('open');keys.clear();pressed.clear();setDpadKey(null);say('HOTEL · checkpoint service',55)}

function closeInventoryPanel(){if(inventoryPanel)inventoryPanel.classList.remove('open')}
function openInventoryPanel(){if(mode!=='game'||player.dead)return;closeGameMenu();closeServicePanel();renderInventoryPanel();inventoryPanel.classList.add('open');keys.clear();pressed.clear();setDpadKey(null)}
function updateMenuStatus(){menuStatus.textContent=`${mode.toUpperCase()} · LV ${player.level} · DEBUG ${debug?'ON':'OFF'} · SLOTS ${inventoryCount()}/8 · SAVE ${hasSave()?'YES':'NO'}`}
function closeGameMenu(){gameMenu.classList.remove('open');menuBtn.textContent='☰'}
function toggleGameMenu(){closeInventoryPanel();closeServicePanel();gameMenu.classList.toggle('open');menuBtn.textContent=gameMenu.classList.contains('open')?'×':'☰';updateMenuStatus();keys.clear();pressed.clear();setDpadKey(null)}
function closeSetupPanel(){setupPanel?.classList.remove('open')}
function closePasswordPanel(){passwordPanel?.classList.remove('open')}
function openSetupPanel(){closeGameMenu();closePasswordPanel();signSelect.innerHTML=ZODIAC_NAMES.map((x,i)=>`<option value="${i}">${x}</option>`).join('');bloodSelect.innerHTML=BLOOD_NAMES.map((x,i)=>`<option value="${i}">${x}</option>`).join('');colorSelect.innerHTML=COLOR_NAMES.map((x,i)=>`<option value="${i}">${x}</option>`).join('');signSelect.value=String(player.sign||0);bloodSelect.value=String(player.blood||0);colorSelect.value=String(player.color||0);setupPanel.classList.add('open');keys.clear();pressed.clear();setDpadKey(null)}
function openPasswordPanel(){closeGameMenu();closeSetupPanel();closeInventoryPanel();closeServicePanel();passwordInput.value='';checkpointLoad.disabled=!hasSave();passwordStatus.textContent=hasSave()?'可輸入 18-symbol password，或載入本機 checkpoint。':'可輸入原版 18-symbol password；目前沒有本機 checkpoint。';passwordPanel.classList.add('open');keys.clear();pressed.clear();setDpadKey(null);setTimeout(()=>passwordInput.focus(),0)}
setupClose.addEventListener('click',e=>{e.preventDefault();closeSetupPanel()});passwordClose.addEventListener('click',e=>{e.preventDefault();closePasswordPanel()});
setupStart.addEventListener('click',e=>{e.preventDefault();const traits={sign:Number(signSelect.value),blood:Number(bloodSelect.value),color:Number(colorSelect.value)};closeSetupPanel();start(true,traits)});
passwordInput.addEventListener('input',()=>{const c=passwordInput.value.toUpperCase().replace(/[^0-9A-Z]/g,'').slice(0,18);if(passwordInput.value!==c)passwordInput.value=c});
passwordSubmit.addEventListener('click',e=>{e.preventDefault();const d=applyRetailPassword(passwordInput.value);if(d.ok){passwordStatus.textContent=`ACCEPTED · LV ${player.level} · HP ${player.maxHp} · MP ${player.maxMp} · Gold ${player.gold}`;closePasswordPanel();say('PASSWORD ACCEPTED · CONTINUE',100)}else passwordStatus.textContent=`REJECTED · ${d.error}`});
checkpointLoad.addEventListener('click',e=>{e.preventDefault();if(quickLoad())closePasswordPanel()});
menuBtn.addEventListener('click',e=>{e.preventDefault();toggleGameMenu()});
gameMenu.addEventListener('click',e=>{
  const b=e.target.closest('[data-action]');if(!b)return;e.preventDefault();const a=b.dataset.action;
  if(a==='inventory'){openInventoryPanel();return}
  if(a==='debug')toggleDebug();
  else if(a==='spawn-shooter')spawnShooterTest();
  else if(a==='reset-encounters')clearEncounterLocks();
  else if(a==='test-kit')grantStage9TestKit();
  else if(a==='password'){openPasswordPanel();return}
  else if(a==='save')quickSave();
  else if(a==='load')quickLoad();
  else if(a==='shop-test'){player.gold=Math.max(player.gold,5000);openShopPanel();return}
  else if(a==='hotel-test'){player.gold=Math.max(player.gold,500);openHotelPanel();return}
  else if(a==='restart')start(true);
  else if(a==='title')returnToTitle();
  updateMenuStatus();if(a!=='debug')closeGameMenu();
});
invClose.addEventListener('click',e=>{e.preventDefault();closeInventoryPanel()});
inventoryGrid.addEventListener('click',e=>{const b=e.target.closest('[data-slot]');if(!b)return;e.preventDefault();useInventorySlot(Number(b.dataset.slot));renderInventoryPanel()});
spellGrid.addEventListener('click',e=>{const b=e.target.closest('[data-spell]');if(!b)return;e.preventDefault();castSpell(Number(b.dataset.spell));renderInventoryPanel()});
serviceClose.addEventListener('click',e=>{e.preventDefault();closeServicePanel()});
serviceBody.addEventListener('click',e=>{const b=e.target.closest('[data-buy],[data-sell],[data-hotel-rest],[data-password-copy]');if(!b)return;e.preventDefault();if(b.dataset.buy!=null)buyShopItem(Number(b.dataset.buy));else if(b.dataset.sell!=null)sellInventorySlot(Number(b.dataset.sell));else if(b.dataset.hotelRest!=null)hotelRest();else if(b.dataset.passwordCopy!=null){const pw=b.dataset.passwordCopy;globalThis.navigator?.clipboard?.writeText?.(pw);say(`PASSWORD ${pw}`,160)}});

addEventListener('keydown',e=>{
  if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();
  if(e.code==='Enter'){if(mode==='title')openSetupPanel();else if(player.dead&&deathState==='gameover')returnToTitle();return}
  if(e.code==='KeyR'){returnToTitle();return}
  if(e.code==='KeyI'&&!e.repeat){e.preventDefault();inventoryPanel.classList.contains('open')?closeInventoryPanel():openInventoryPanel();return}
  if(e.code==='F2'&&!e.repeat){e.preventDefault();toggleDebug();return}
  if(e.code==='F5'&&!e.repeat){e.preventDefault();quickSave();return}
  if(e.code==='F9'&&!e.repeat){e.preventDefault();quickLoad();return}
  if(e.code==='F3'&&!e.repeat){e.preventDefault();spawnShooterTest();return}
  if(!e.repeat)pressed.add(e.code);keys.add(e.code);
});
addEventListener('keyup',e=>keys.delete(e.code));
document.getElementById('startBtn').addEventListener('click',()=>{if(mode==='title')openSetupPanel();else if(player.dead&&deathState==='gameover')returnToTitle()});
document.getElementById('continueBtn').addEventListener('click',()=>openPasswordPanel());

for(const b of document.querySelectorAll('[data-key]')){
  const k=b.dataset.key;
  const on=e=>{e.preventDefault();if(e.pointerId!=null&&b.setPointerCapture){try{b.setPointerCapture(e.pointerId)}catch{}}if(!keys.has(k))pressed.add(k);keys.add(k);b.classList.add('active')};
  const off=e=>{e.preventDefault();keys.delete(k);b.classList.remove('active');if(e.pointerId!=null&&b.hasPointerCapture&&b.hasPointerCapture(e.pointerId)){try{b.releasePointerCapture(e.pointerId)}catch{}}};
  b.addEventListener('pointerdown',on);b.addEventListener('pointerup',off);b.addEventListener('pointercancel',off);b.addEventListener('contextmenu',e=>e.preventDefault());b.addEventListener('dragstart',e=>e.preventDefault());b.addEventListener('selectstart',e=>e.preventDefault());
}

const dpad=document.getElementById('dpad');let dpadPointer=null,dpadKey=null;
function setDpadKey(next){
  if(next===dpadKey)return;
  if(dpadKey)keys.delete(dpadKey);
  dpadKey=next;
  for(const b of dpad.querySelectorAll('[data-dir]'))b.classList.toggle('active',b.dataset.dir===next);
  if(next){if(!keys.has(next))pressed.add(next);keys.add(next)}
}
function dpadKeyAt(e){
  const r=dpad.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,dx=e.clientX-cx,dy=e.clientY-cy;
  if(e.clientX<r.left-16||e.clientX>r.right+16||e.clientY<r.top-16||e.clientY>r.bottom+16)return null;
  if(Math.abs(dx)<12&&Math.abs(dy)<12)return dpadKey;
  if(Math.abs(dx)>Math.abs(dy))return dx<0?'ArrowLeft':'ArrowRight';
  return dy<0?'ArrowUp':'ArrowDown';
}
function dpadEnd(e){if(dpadPointer!==e.pointerId)return;e.preventDefault();setDpadKey(null);try{dpad.releasePointerCapture(e.pointerId)}catch{}dpadPointer=null}
dpad.addEventListener('pointerdown',e=>{if(dpadPointer!==null)return;e.preventDefault();dpadPointer=e.pointerId;try{dpad.setPointerCapture(e.pointerId)}catch{}setDpadKey(dpadKeyAt(e))});
dpad.addEventListener('pointermove',e=>{if(dpadPointer!==e.pointerId)return;e.preventDefault();setDpadKey(dpadKeyAt(e))});
dpad.addEventListener('pointerup',dpadEnd);dpad.addEventListener('pointercancel',dpadEnd);dpad.addEventListener('lostpointercapture',e=>{if(dpadPointer===e.pointerId){setDpadKey(null);dpadPointer=null}});
dpad.addEventListener('contextmenu',e=>e.preventDefault());dpad.addEventListener('dragstart',e=>e.preventDefault());dpad.addEventListener('selectstart',e=>e.preventDefault());

addEventListener('blur',()=>{keys.clear();pressed.clear();setDpadKey(null)});document.addEventListener('visibilitychange',()=>{if(document.hidden){keys.clear();pressed.clear();setDpadKey(null)}});

if(globalThis.__VALKYRIE_TEST_MODE__)globalThis.__VALKYRIE_TEST__={
  start,castSpell,grantStage9TestKit,grantStage8TestKit,grantStage7TestKit,useInventorySlot,resolveRelicActionNow,tryDirectionalWarp,updateSpellEffect,updateActors,update,updateEnding,player,camera,actors,spell,terrainPatches,fixedState,encounterLocks,quickSave,quickLoad,snapshotGame,restoreSnapshot,buyShopItem,sellInventorySlot,hotelRest,beginDeath,updateDeathSequence,encodeRetailPassword,decodeRetailPassword,applyRetailPassword,applyHotelLevelUps,expThreshold,
  helpers:{weaponDamage,fireballDamageFor,hasInventoryItem,findInventorySlot,addInventoryItem,clearActors,initActorFromSpawnToken,setPatch2x2,resolveLiveWorld,collisionSample,playerTileSample,starFluteActive,invisibilityActive,buyPrice,sellPrice,shopProfileForWorld,rotate72Right,rotate72Left,transposeEncode,transposeDecode,setFacing(v){facing=v&3},setServiceMode(v){serviceMode=v}},
  get state(){return{mode,endingActive,endingPhase:ending.phase,endingScene:ending.scene,endingScroll:ending.scroll,facing,frameCounter,notice,deathState,deathTimer,gameOverTimer,serviceMode,activeShopProfile}}
};
})();
