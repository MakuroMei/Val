(()=>{
'use strict';
const D=globalThis.VAUDIO_DATA||{requests:{},pitch:[],noise:[]};
const states=new Map(), counters=new Uint8Array(16);
const BGM_IDS=new Set(Array.from({length:12},(_,i)=>0x2B+i));
let frame=0, muted=false, ctx=null, master=null, outputs=null, unlocked=false;
try{muted=localStorage.getItem('valkyrie.frontend.audio.muted')==='1'}catch{}
function meta(id){return D.requests[id]||D.requests[String(id)]||null}
function stop(id){states.delete(id)}
function stopMany(ids){for(const id of ids)stop(id)}
function start(id){
  id=Number(id);const m=meta(id);if(!m)return false;
  for(const [oid,s] of [...states])if(s.voice===m.v&&oid!==id){if(oid<id)return false;states.delete(oid)}
  states.set(id,{id,voice:m.v,channel:m.c,bytes:m.b,cursor:1,duration:1,countdown:0,reg0:0x8F,gate:0,level:12,note:0,rest:true,started:frame});
  return true;
}
function play(ids){for(const id of (Array.isArray(ids)?ids:[ids]))start(id)}
function allOff(){states.clear();counters.fill(0);renderPhysical()}
function parseState(s){
  const b=s.bytes;let guard=0;
  while(states.has(s.id)&&guard++<256){
    if(s.cursor<1||s.cursor>=b.length){states.delete(s.id);return}
    const t=b[s.cursor++]&255;
    if(t<=0x5F){s.note=t;s.rest=false;s.countdown=Math.max(1,s.duration|0);return}
    if(t===0x60){s.rest=true;s.countdown=Math.max(1,s.duration|0);return}
    if(t===0x61){states.delete(s.id);return}
    if(t===0x62){s.reg0=b[s.cursor++]??s.reg0;continue}
    if(t===0x63){s.cursor++;continue}
    if(t===0x64){start(b[s.cursor++]??0);continue}
    if(t===0x65){counters[(b[s.cursor++]??0)&15]=0;continue}
    if(t===0x66||t===0x67){
      const packed=b[s.cursor++]??0,target=b[s.cursor++]??1,count=(packed>>4)&15,ci=packed&15;
      counters[ci]=(counters[ci]+1)&255;
      if((t===0x66&&counters[ci]!==count)||(t===0x67&&counters[ci]===count))s.cursor=target;
      continue;
    }
    if(t===0x68){s.cursor=b[s.cursor]??1;continue}
    if(t===0x69){s.gate=(b[s.cursor++]??0)|1;continue}
    if(t===0x6A){s.gate=0;continue}
    if(t>=0x70&&t<=0x7F){s.level=t&15;continue}
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
function desiredGain(s){
  if(s.rest||!states.has(s.id))return 0;
  if(s.channel<=1){let v=s.reg0&15;if(v===0)v=Math.max(2,s.level);return Math.min(.12,.025+v/15*.095)}
  if(s.channel===2)return Math.min(.105,.03+(s.level/15)*.075);
  return Math.min(.07,.015+(s.level/15)*.055);
}
function noteHz(s){
  if(s.channel===3)return Math.max(80,Math.min(12000,D.noise[(s.note||0)&15]||1200));
  let hz=D.pitch[s.note||0]||220;if(s.channel===2)hz*=.5;return Math.max(20,Math.min(12000,hz));
}
function renderPhysical(){
  if(!outputs)return;
  const winners=[null,null,null,null];
  for(const [id,s] of [...states].sort((a,b)=>a[0]-b[0]))if(!s.rest&&s.countdown>0&&winners[s.channel]==null)winners[s.channel]=s;
  const now=ctx.currentTime;
  for(let ch=0;ch<4;ch++){
    const o=outputs[ch],s=winners[ch],g=s?desiredGain(s):0;
    o.gain.gain.cancelScheduledValues(now);o.gain.gain.setTargetAtTime(g,now,.004);
    if(!s)continue;
    if(ch<3){o.osc.frequency.cancelScheduledValues(now);o.osc.frequency.setValueAtTime(noteHz(s),now)}
    else{o.filter.frequency.cancelScheduledValues(now);o.filter.frequency.setValueAtTime(noteHz(s),now)}
  }
}
function makeNoiseBuffer(ac){
  const len=ac.sampleRate*2,buf=ac.createBuffer(1,len,ac.sampleRate),a=buf.getChannelData(0);let l=0xACE1;
  for(let i=0;i<len;i++){l=(l>>1)^((-(l&1))&0xB400);a[i]=(l&1)?0.8:-0.8}return buf;
}
function buildAudio(){
  if(ctx)return true;const AC=globalThis.AudioContext||globalThis.webkitAudioContext;if(!AC)return false;
  ctx=new AC({latencyHint:'interactive'});master=ctx.createGain();master.gain.value=muted?0:.78;master.connect(ctx.destination);outputs=[];
  for(let ch=0;ch<3;ch++){
    const osc=ctx.createOscillator(),gain=ctx.createGain();osc.type=ch===2?'triangle':'square';gain.gain.value=0;osc.connect(gain);gain.connect(master);osc.start();outputs.push({osc,gain});
  }
  const src=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();src.buffer=makeNoiseBuffer(ctx);src.loop=true;filter.type='bandpass';filter.Q.value=.7;filter.frequency.value=1200;gain.gain.value=0;src.connect(filter);filter.connect(gain);gain.connect(master);src.start();outputs.push({src,filter,gain});
  renderPhysical();return true;
}
async function unlock(){
  if(!buildAudio())return false;try{if(ctx.state==='suspended')await ctx.resume();unlocked=ctx.state==='running';renderPhysical();return unlocked}catch{return false}
}
function setMuted(v){muted=!!v;try{localStorage.setItem('valkyrie.frontend.audio.muted',muted?'1':'0')}catch{}if(master){const now=ctx.currentTime;master.gain.cancelScheduledValues(now);master.gain.setTargetAtTime(muted?0:.78,now,.01)}return muted}
function toggleMuted(){return setMuted(!muted)}
function ensureBgm({game=false,realm='surface',poison=false,ending=false}={}){
  const wanted=new Set();
  if(ending){wanted.add(0x34);wanted.add(0x35);wanted.add(0x36)}
  else if(game){const base=realm==='dungeon'?[0x2E,0x2F,0x30]:[0x31,0x32,0x33];for(const id of base)wanted.add(id);if(poison)for(const id of [0x2B,0x2C,0x2D])wanted.add(id)}
  for(const id of BGM_IDS)if(states.has(id)&&!wanted.has(id))stop(id);
  for(const id of wanted)if(!states.has(id))start(id);
}
function status(){return{muted,unlocked,contextState:ctx?.state||'unavailable',active:[...states.keys()].sort((a,b)=>a-b),frame}}
const api={start,play,stop,stopMany,allOff,tick,unlock,setMuted,toggleMuted,ensureBgm,status,get muted(){return muted},get active(){return[...states.keys()].sort((a,b)=>a-b)}};
globalThis.VAudio=api;
})();
