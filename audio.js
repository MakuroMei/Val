(()=>{
'use strict';
const D=globalThis.VAUDIO_DATA||{requests:{},pitch:[],noise:[]};
const states=new Map(), voices=Array(16).fill(null), counters=new Uint8Array(16);
const requests=new Uint8Array(256), owners=new Uint8Array(16).fill(0x80), shadow=new Uint8Array(16);
const committed=new Uint8Array(24);committed[0x17]=0xC0;
let dirty=0, enable=0, restMask=0, dac=0, claims=Array(4).fill(null), registerWrites=[], registerHandler=null;
const BGM_IDS=new Set(Array.from({length:12},(_,i)=>0x2B+i));
const LENGTHS=[10,254,20,2,40,4,80,6,160,8,60,10,14,12,26,14,12,16,24,18,48,20,96,22,192,24,72,26,16,28,32,30];
const CPU_HZ=1789773, DUTIES=[.125,.25,.5,.75];
let frame=0, muted=false, ctx=null, master=null, outputs=null, pcmOutput=null, unlocked=false, lastError=null, bgmContext=null, poisonOnly=false;
try{muted=localStorage.getItem('valkyrie.frontend.audio.muted')==='1'}catch{}
function meta(id){return D.requests[id]||D.requests[String(id)]||null}
// Retail request=0 does not erase the logical voice's cursor/countdown or
// shared loop counters. Poison request=2 can continue them after the menu.
function stop(id){id=Number(id);requests[id]=0;states.delete(id)}
function stopMany(ids){for(const id of ids)stop(id)}
function start(id){
  id=Number(id);const m=meta(id);if(!m||id<0||id>255)return false;
  // Writing a START request is immediate. Voice arbitration and cursor reset
  // happen when AudioFrame scans the slot, as they do in the retail driver.
  requests[id]=1;states.set(id,{id,voice:m.v,channel:m.c,pending:true});
  if(id>=0x2E&&id<=0x33)poisonOnly=false;
  return true;
}
function request(id,value=1){
  id=Number(id);if(!value){stop(id);return true}if(value===1)return start(id);
  const m=meta(id),s=m&&voices[m.v];if(!s||s.id!==id)return false;
  requests[id]=value&255;states.set(id,s);return true;
}
function play(ids){for(const id of (Array.isArray(ids)?ids:[ids]))start(id)}
function stopAllRequests(){requests.fill(0);states.clear();renderPhysical()}
// Hard reset for title/new sessions. This intentionally differs from retail's
// StopAllAudioRequests, which callers use through stopAllRequests above.
function allOff(){
  requests.fill(0);states.clear();voices.fill(null);counters.fill(0);owners.fill(0x80);shadow.fill(0);
  committed.fill(0);committed[0x17]=0xC0;
  dirty=enable=restMask=dac=0;claims.fill(null);bgmContext=null;poisonOnly=false;
  pcmOutput?.frame([], {reset:true});registerHandler?.([], {reset:true});renderPhysical();
}
function resumeContext({realm='surface',poison=false}={}){
  poisonOnly=!!poison&&![0x2E,0x2F,0x30,0x31,0x32,0x33].some(id=>states.has(id));
  if(poison){for(const id of [0x2B,0x2C,0x2D])request(id,2)}
  else play(realm==='dungeon'?[0x2E,0x2F,0x30]:[0x31,0x32,0x33]);
}
function claim(s){
  const bit=1<<s.channel;if(enable&bit)return false;
  enable|=bit;claims[s.channel]=s.id;if(s.rest)restMask|=bit;return true;
}
function beginToken(s,rest){
  s.rest=rest;s.countdown=s.duration&0x7F;
  return claim(s);
}
function buildShadow(s){
  const offset=(s.channel&3)*4;
  const timer=s.channel===3?s.note:(D.timers?.[s.note]??Math.round(CPU_HZ/(16*(D.pitch[s.note]||220))-1));
  shadow[offset]=s.reg0;shadow[offset+1]=s.sweep;shadow[offset+2]=timer&255;
  shadow[offset+3]=((s.gate&1?s.gate:8)&0xF8)|(s.channel===3?0:timer>>8);
  dirty|=1<<s.channel;
}
function parseState(s){
  // $63 is scratch for this note, unlike the persistent register/gate state.
  const b=s.bytes;let guard=0;s.sweep=0x78;
  const read=()=>{const value=b[s.cursor]??0x61;s.cursor=(s.cursor+1)&255;return value&255};
  while(requests[s.id]&&guard++<256){
    const t=read();
    if(t<=0x5F){s.note=t;s.noteStarted=frame;if(beginToken(s,false))buildShadow(s);return}
    if(t===0x60){beginToken(s,true);return}
    if(t===0x61){
      // END clears its request and owner, but still claims a REST for this
      // scan. A lower-priority voice cannot steal that channel until later.
      stop(s.id);owners[s.voice]=0x80;beginToken(s,true);return;
    }
    if(t===0x62){s.reg0=read();continue}
    if(t===0x63){s.sweep=read();continue}
    if(t===0x64){start(read());continue}
    if(t===0x65){counters[read()&15]=0;continue}
    if(t===0x66||t===0x67){
      const packed=read(),target=read(),count=(packed>>4)&15,ci=packed&15;
      counters[ci]=(counters[ci]+1)&255;
      if((t===0x66&&counters[ci]!==count)||(t===0x67&&counters[ci]===count))s.cursor=target;
      continue;
    }
    if(t===0x68){s.cursor=read();continue}
    if(t===0x69){s.gate=read()|1;s.reg0&=0xDF;continue}
    if(t===0x6A){s.gate=0;s.reg0|=0x20;continue}
    if(t>=0x70&&t<=0x7F){
      s.level=t&15;if(s.channel<=1)s.reg0=(s.reg0&0xF0)|s.level;
      else dac=(s.level^15)<<3;
      continue;
    }
    if(t>=0x80){s.duration=t&0x7F;s.rest=false;continue}
  }
  // Defined retail streams always terminate parsing within this bound. The
  // guard keeps malformed external definitions from locking the game loop.
  if(guard>=256)stop(s.id);
}
function service(id){
  const m=meta(id);if(!m||!requests[id])return;
  let s=voices[m.v];
  if(requests[id]===1){
    requests[id]=2;
    const previous=owners[m.v];
    if(previous<0x80&&previous!==id){
      if(previous<id){stop(id);return}
      stop(previous);
    }
    owners[m.v]=id;
    s={duration:0,reg0:0,level:0,note:0,rest:false,noteStarted:frame,...s,id,voice:m.v,channel:m.c,bytes:m.b,cursor:1,gate:0,started:frame};
    voices[m.v]=s;states.set(id,s);parseState(s);return;
  }
  if(!s)return;
  // An active value 2 continues the RAM state for the logical voice, including
  // byte-wrapped countdowns. It does not perform START arbitration/reset.
  s.id=id;s.channel=m.c;s.bytes=m.b;states.set(id,s);
  s.countdown=(s.countdown-1)&255;
  if(s.countdown===0)parseState(s);else claim(s);
}
function registerFrame(){return registerWrites.map(write=>write.slice())}
function onRegisterFrame(handler){registerHandler=typeof handler==='function'?handler:null}
function tick(){
  frame++;
  // AudioFrame first commits the previous scan's shadow. Order matters for
  // enabling a channel before its $4003/$4007/$400B/$400F length reload.
  registerWrites=[[0x4011,dac],[0x4015,enable]];
  for(let channel=0;channel<4;channel++)if(dirty&(1<<channel)){
    for(let offset=channel*4;offset<channel*4+4;offset++)registerWrites.push([0x4000+offset,shadow[offset]]);
  }
  dirty=0;
  for(let voice=15;voice>=0;voice--)if(!requests[owners[voice]])owners[voice]=0x80;
  enable=restMask=0;claims=Array(4).fill(null);
  // Commands may start a later slot during this scan, so take no key snapshot.
  const limit=Math.max(72,...Object.keys(D.requests).map(id=>Number(id)+1));
  for(let id=0;id<limit;id++)service(id);
  if(!(enable&0x0C))dac=Math.max(0,dac-8);
  enable^=restMask;
  renderPhysical();
  const result=registerFrame();for(const [address,value] of result)committed[address-0x4000]=value;pcmOutput?.frame(result);registerHandler?.(result);return result;
}
function pulseTimer(s){
  let timer=D.timers?.[s.note]??Math.round(CPU_HZ/(16*(D.pitch[s.note]||220))-1);
  const sweep=s.sweep,shift=sweep&7,negative=!!(sweep&8);
  const target=()=>timer+(negative?-((timer>>shift)+(s.channel===0?1:0)):(timer>>shift));
  if((sweep&0x80)&&shift){
    // The 120 Hz sweep divider is evaluated at the game's 60 Hz boundaries.
    const steps=Math.floor((frame-s.noteStarted)*2/(((sweep>>4)&7)+1));
    for(let i=0;i<steps;i++){const next=target();if(timer<8||next>0x7FF)break;timer=next}
  }
  return {timer,muted:timer<8||target()>0x7FF};
}
function gateOpen(s){
  const age=frame-s.noteStarted;
  const halt=s.channel===2?!!(s.reg0&0x80):!!(s.reg0&0x20);
  const length=LENGTHS[(s.gate?s.gate:0x08)>>3];
  if(!halt&&age*2>=length)return false;
  // Triangle's low seven bits reload its 240 Hz linear counter. Bit 7 holds
  // the reload flag; clearing it produces the short notes used by retail BGM.
  if(s.channel===2&&((s.reg0&0x7F)===0||(!(s.reg0&0x80)&&age*4>=(s.reg0&0x7F))))return false;
  return true;
}
function desiredGain(s){
  if(s.rest||!states.has(s.id))return 0;
  if(!gateOpen(s)||(s.channel<=1&&pulseTimer(s).muted))return 0;
  if(s.channel<=1||s.channel===3){
    let v=s.reg0&15;
    // Bit 4 selects fixed volume; otherwise the low nibble is the NES
    // envelope period. Four envelope clocks per game frame approximate 240 Hz.
    if(!(s.reg0&0x10)){const step=Math.floor((frame-s.noteStarted)*4/(v+1));v=(s.reg0&0x20)?15-(step%16):Math.max(0,15-step)}
    return v/15*(s.channel===3?.07:.12);
  }
  // Retail T/N LEVEL changes the shared $4011 DAC bias. Triangle loudness
  // remains an approximation of that nonlinear mixer effect in this graph.
  if(s.channel===2)return Math.min(.105,.03+(s.level/15)*.075);
  return 0;
}
function noteHz(s){
  if(s.channel===3)return D.noise[(s.note||0)&15]||1200;
  if(s.channel<=1)return CPU_HZ/(16*(Math.max(0,pulseTimer(s).timer)+1));
  let hz=D.pitch[s.note||0]||220;if(s.channel===2)hz*=.5;return Math.max(20,Math.min(12000,hz));
}
function renderPhysical(){
  if(!outputs||ctx.state==='closed')return;
  const winners=[null,null,null,null];
  // A higher-priority REST still owns and silences its physical channel.
  for(const [id,s] of [...states].sort((a,b)=>a[0]-b[0]))if(s.countdown>0&&winners[s.channel]==null)winners[s.channel]=s;
  const now=ctx.currentTime;
  for(let ch=0;ch<4;ch++){
    const o=outputs[ch],s=winners[ch],g=s?desiredGain(s):0;
    o.gain.gain.cancelScheduledValues(now);o.gain.gain.setTargetAtTime(g,now,.004);
    if(!s)continue;
    if(ch<3){
      if(ch<2){const duty=(s.reg0>>6)&3;if(o.duty!==duty){o.osc.setPeriodicWave(o.waves[duty]);o.duty=duty}}
      o.osc.frequency.cancelScheduledValues(now);o.osc.frequency.setValueAtTime(noteHz(s),now);
    }else{o.src.playbackRate.cancelScheduledValues(now);o.src.playbackRate.setValueAtTime(noteHz(s)/ctx.sampleRate,now)}
  }
}
function makeNoiseBuffer(ac){
  // A full NES long-mode 15-bit LFSR cycle. Source rate follows $400E's
  // period, rather than changing the colour of unrelated white noise.
  const len=32767,buf=ac.createBuffer(1,len,ac.sampleRate),a=buf.getChannelData(0);let l=1;
  for(let i=0;i<len;i++){a[i]=(l&1)?-1:1;const feedback=(l^(l>>1))&1;l=(l>>1)|(feedback<<14)}return buf;
}
function pulseWaves(ac){
  return DUTIES.map(duty=>{
    const real=new Float32Array(65),imag=new Float32Array(65);
    for(let k=1;k<real.length;k++){real[k]=2*Math.sin(2*Math.PI*k*duty)/(Math.PI*k);imag[k]=2*(1-Math.cos(2*Math.PI*k*duty))/(Math.PI*k)}
    return ac.createPeriodicWave(real,imag,{disableNormalization:true});
  });
}
function buildAudio(){
  if(ctx&&ctx.state!=='closed')return true;
  const AC=globalThis.AudioContext||globalThis.webkitAudioContext;if(!AC)return false;
  let ac=null;
  try{
    pcmOutput?.dispose();pcmOutput=null;
    ac=new AC({latencyHint:'interactive'});
    const nextMaster=ac.createGain(),nextOutputs=[];nextMaster.gain.value=muted?0:.78;nextMaster.connect(ac.destination);
    if(globalThis.VAudioPCM&&globalThis.VAPU&&typeof ac.createScriptProcessor==='function'){
      const nextPCM=new globalThis.VAudioPCM(ac,nextMaster);
      // A rebuilt device restores the last uploaded registers, including
      // long notes whose latest frame had no dirty block. Counter/phase state
      // starts fresh on this device; ordinary frames keep the original delay.
      const restore=[[0x4011,committed[0x11]],[0x4015,committed[0x15]]];
      for(let address=0;address<16;address++)restore.push([0x4000+address,committed[address]]);
      nextPCM.apu.writeBatch(restore);
      ctx=ac;master=nextMaster;outputs=null;pcmOutput=nextPCM;unlocked=ac.state==='running';lastError=null;
      ac.addEventListener?.('statechange',()=>{if(ctx===ac){unlocked=ac.state==='running';if(!unlocked)pcmOutput?.clear()}});
      return true;
    }
    const waves=pulseWaves(ac);
    for(let ch=0;ch<3;ch++){
      const osc=ac.createOscillator(),gain=ac.createGain();osc.type=ch===2?'triangle':'square';if(ch<2)osc.setPeriodicWave(waves[2]);gain.gain.value=0;osc.connect(gain);gain.connect(nextMaster);osc.start();nextOutputs.push({osc,gain,waves,duty:2});
    }
    const src=ac.createBufferSource(),gain=ac.createGain();src.buffer=makeNoiseBuffer(ac);src.loop=true;gain.gain.value=0;src.connect(gain);gain.connect(nextMaster);src.start();nextOutputs.push({src,gain});
    // Publish only a complete graph so a failed first gesture can be retried.
    ctx=ac;master=nextMaster;outputs=nextOutputs;unlocked=ac.state==='running';lastError=null;
    ac.addEventListener?.('statechange',()=>{if(ctx===ac)unlocked=ac.state==='running'});
    renderPhysical();return true;
  }catch(e){
    try{ac?.close?.()?.catch?.(()=>{})}catch{}
    pcmOutput?.dispose();pcmOutput=null;ctx=null;master=null;outputs=null;unlocked=false;lastError=String(e?.message||e);return false;
  }
}
async function unlock(){
  try{
    if(!buildAudio())return false;
    // Safari can report "interrupted" after backgrounding or an audio interruption.
    if(ctx.state!=='running')await ctx.resume();
    unlocked=ctx.state==='running';if(unlocked){lastError=null;renderPhysical()}return unlocked;
  }catch(e){unlocked=false;lastError=String(e?.message||e);return false}
}
function setMuted(v){muted=!!v;try{localStorage.setItem('valkyrie.frontend.audio.muted',muted?'1':'0')}catch{}if(master&&ctx.state!=='closed'){const now=ctx.currentTime;master.gain.cancelScheduledValues(now);master.gain.setTargetAtTime(muted?0:.78,now,.01)}return muted}
function toggleMuted(){return setMuted(!muted)}
function ensureBgm({game=false,realm='surface',poison=false,ending=false,preserve=false}={}){
  // Interior / transition handlers explicitly decide which requests to clear.
  // In particular poison music and the low-HP warning survive interior entry.
  if(!game&&!ending&&preserve)return;
  if(!poison)poisonOnly=false;
  const context=ending?'ending':game?`${realm}:${poison}`:'off',changed=context!==bgmContext;bgmContext=context;
  const wanted=new Set();
  if(ending){wanted.add(0x34);wanted.add(0x35);wanted.add(0x36)}
  else if(game){const base=realm==='dungeon'?[0x2E,0x2F,0x30]:[0x31,0x32,0x33];if(!poisonOnly)for(const id of base)wanted.add(id);if(poison)for(const id of [0x2B,0x2C,0x2D])wanted.add(id)}
  for(const id of BGM_IDS)if(states.has(id)&&!wanted.has(id))stop(id);
  // The CHR-backed ending voices have END tokens: retail triggers them once.
  // Persistent gameplay voices may still need restarting after preemption.
  for(const id of wanted)if(!states.has(id)&&(!ending||changed))start(id);
}
function status(){return{muted,unlocked:!!ctx&&ctx.state==='running',contextState:ctx?.state||'unavailable',backend:pcmOutput?'software-apu':outputs?'oscillator-fallback':'unavailable',pcm:pcmOutput?.status()??null,active:[...states.keys()].sort((a,b)=>a-b),frame,error:lastError}}
const api={start,request,play,stop,stopMany,stopAllRequests,resumeContext,allOff,tick,registerFrame,onRegisterFrame,hardwareState,unlock,setMuted,toggleMuted,ensureBgm,status,get muted(){return muted},get active(){return[...states.keys()].sort((a,b)=>a-b)}};
function hardwareState(){
  const field=(key,transform=value=>value)=>voices.map(s=>s?transform(s[key]):0);
  return {dirty,enable,dac,rest:restMask,shadow:Array.from(shadow),claims:claims.slice(),writes:registerFrame(),
    requests:Array.from(requests.slice(0,72)),owner:Array.from(owners),cursor:field('cursor'),reg0:field('reg0'),
    duration:voices.map(s=>s?(s.duration&0x7F)|(s.rest?0x80:0):0),countdown:field('countdown'),gate:field('gate'),counters:Array.from(counters)};
}
if(globalThis.__VALKYRIE_TEST_MODE__)api.inspect=()=>({...hardwareState(),voices:voices.map(s=>s&&{id:s.id,cursor:s.cursor,countdown:s.countdown,duration:s.duration,reg0:s.reg0,gate:s.gate}),active:[...states.keys()].sort((a,b)=>a-b)});
globalThis.VAudio=api;
})();
