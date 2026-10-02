(()=>{
'use strict';
const D=globalThis.VAUDIO_DATA||{requests:{},pitch:[],noise:[]};
const states=new Map(), counters=new Uint8Array(16);
const BGM_IDS=new Set(Array.from({length:12},(_,i)=>0x2B+i));
const LENGTHS=[10,254,20,2,40,4,80,6,160,8,60,10,14,12,26,14,12,16,24,18,48,20,96,22,192,24,72,26,16,28,32,30];
const CPU_HZ=1789773, DUTIES=[.125,.25,.5,.75];
let frame=0, muted=false, ctx=null, master=null, outputs=null, unlocked=false, lastError=null, bgmContext=null;
try{muted=localStorage.getItem('valkyrie.frontend.audio.muted')==='1'}catch{}
function meta(id){return D.requests[id]||D.requests[String(id)]||null}
function stop(id){states.delete(id)}
function stopMany(ids){for(const id of ids)stop(id)}
function start(id){
  id=Number(id);const m=meta(id);if(!m)return false;
  for(const [oid,s] of [...states])if(s.voice===m.v&&oid!==id){if(oid<id)return false;states.delete(oid)}
  states.set(id,{id,voice:m.v,channel:m.c,bytes:m.b,cursor:1,duration:1,countdown:0,reg0:0x8F,sweep:0x78,gate:0,level:12,note:0,rest:true,started:frame,noteStarted:frame});
  return true;
}
function play(ids){for(const id of (Array.isArray(ids)?ids:[ids]))start(id)}
function allOff(){states.clear();counters.fill(0);bgmContext=null;renderPhysical()}
function parseState(s){
  // $63 is scratch for this note, unlike the persistent register/gate state.
  const b=s.bytes;let guard=0;s.sweep=0x78;
  while(states.has(s.id)&&guard++<256){
    if(s.cursor<1||s.cursor>=b.length){states.delete(s.id);return}
    const t=b[s.cursor++]&255;
    if(t<=0x5F){s.note=t;s.rest=false;s.noteStarted=frame;s.countdown=Math.max(1,s.duration|0);return}
    if(t===0x60){s.rest=true;s.countdown=Math.max(1,s.duration|0);return}
    if(t===0x61){states.delete(s.id);return}
    if(t===0x62){s.reg0=b[s.cursor++]??s.reg0;continue}
    if(t===0x63){s.sweep=b[s.cursor++]??0x78;continue}
    if(t===0x64){start(b[s.cursor++]??0);continue}
    if(t===0x65){counters[(b[s.cursor++]??0)&15]=0;continue}
    if(t===0x66||t===0x67){
      const packed=b[s.cursor++]??0,target=b[s.cursor++]??1,count=(packed>>4)&15,ci=packed&15;
      counters[ci]=(counters[ci]+1)&255;
      if((t===0x66&&counters[ci]!==count)||(t===0x67&&counters[ci]===count))s.cursor=target;
      continue;
    }
    if(t===0x68){s.cursor=b[s.cursor]??1;continue}
    if(t===0x69){s.gate=(b[s.cursor++]??0)|1;s.reg0&=0xDF;continue}
    if(t===0x6A){s.gate=0;s.reg0|=0x20;continue}
    if(t>=0x70&&t<=0x7F){s.level=t&15;if(s.channel<=1)s.reg0=(s.reg0&0xF0)|s.level;continue}
    if(t>=0x80){s.duration=t&0x7F;continue}
  }
  if(guard>=256)states.delete(s.id);
}
function tick(){
  frame++;
  for(const id of [...states.keys()].sort((a,b)=>a-b)){
    const s=states.get(id);if(!s)continue;
    if(s.countdown>0)s.countdown--;
    if(s.countdown<=0)parseState(s);
  }
  renderPhysical();
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
    ac=new AC({latencyHint:'interactive'});
    const nextMaster=ac.createGain(),nextOutputs=[];nextMaster.gain.value=muted?0:.78;nextMaster.connect(ac.destination);
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
    ctx=null;master=null;outputs=null;unlocked=false;lastError=String(e?.message||e);return false;
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
function ensureBgm({game=false,realm='surface',poison=false,ending=false}={}){
  const context=ending?'ending':game?`${realm}:${poison}`:'off',changed=context!==bgmContext;bgmContext=context;
  const wanted=new Set();
  if(ending){wanted.add(0x34);wanted.add(0x35);wanted.add(0x36)}
  else if(game){const base=realm==='dungeon'?[0x2E,0x2F,0x30]:[0x31,0x32,0x33];for(const id of base)wanted.add(id);if(poison)for(const id of [0x2B,0x2C,0x2D])wanted.add(id)}
  for(const id of BGM_IDS)if(states.has(id)&&!wanted.has(id))stop(id);
  // The CHR-backed ending voices have END tokens: retail triggers them once.
  // Persistent gameplay voices may still need restarting after preemption.
  for(const id of wanted)if(!states.has(id)&&(!ending||changed))start(id);
}
function status(){return{muted,unlocked:!!ctx&&ctx.state==='running',contextState:ctx?.state||'unavailable',active:[...states.keys()].sort((a,b)=>a-b),frame,error:lastError}}
const api={start,play,stop,stopMany,allOff,tick,unlock,setMuted,toggleMuted,ensureBgm,status,get muted(){return muted},get active(){return[...states.keys()].sort((a,b)=>a-b)}};
globalThis.VAudio=api;
})();
