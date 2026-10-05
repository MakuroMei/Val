// Deterministic NTSC 2A03 sound synthesis. No CPU, PPU, or DMC DMA is emulated.
// CPU-cycle integration, rather than a sample-and-hold oscillator approximation,
// preserves channel phase and the triangle/noise ultrasonic average.
(()=>{
'use strict';
const LENGTHS=[10,254,20,2,40,4,80,6,160,8,60,10,14,12,26,14,12,16,24,18,48,20,96,22,192,24,72,26,16,28,32,30];
const NOISE_PERIODS=[4,8,16,32,64,96,128,160,202,254,380,508,762,1016,2034,4068];
const DUTIES=[[0,1,0,0,0,0,0,0],[0,1,1,0,0,0,0,0],[0,1,1,1,1,0,0,0],[1,0,0,1,1,1,1,1]];
const TRIANGLE=[15,14,13,12,11,10,9,8,7,6,5,4,3,2,1,0,0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15];
const PULSE_MIX=Float64Array.from({length:31},(_,sum)=>sum?95.88/(8128/sum+100):0);
const TND_MIX=new Float64Array(16*16*128);
for(let triangle=0;triangle<16;triangle++)for(let noise=0;noise<16;noise++)for(let dac=0;dac<128;dac++){
  const level=triangle/8227+noise/12241+dac/22638;
  TND_MIX[((triangle*16+noise)*128)+dac]=level?159.79/(1/level+100):0;
}
function envelope(){return {start:false,divider:0,decay:0}}
function pulse(){return {enabled:false,control:0,timer:0,counter:0,step:0,length:0,envelope:envelope(),sweep:0,sweepDivider:0,sweepReload:false}}
function clockEnvelope(channel){
  const e=channel.envelope,period=channel.control&15;
  if(e.start){e.start=false;e.decay=15;e.divider=period}
  else if(e.divider){e.divider--}
  else{e.divider=period;if(e.decay)e.decay--;else if(channel.control&0x20)e.decay=15}
}
function volume(channel){return channel.control&0x10?channel.control&15:channel.envelope.decay}
function target(channel,index){
  const delta=channel.timer>>(channel.sweep&7);
  return channel.timer+(channel.sweep&8?-delta-(index===0?1:0):delta);
}
class VAPU{
  constructor({sampleRate=48000,cpuHz=1789773,filter=true}={}){
    if(!Number.isFinite(sampleRate)||sampleRate<=0||!Number.isFinite(cpuHz)||cpuHz<=0)throw new RangeError('Invalid APU clock/sample rate');
    this.sampleRate=sampleRate;this.cpuHz=cpuHz;this.filter=!!filter;this.cyclesPerSample=cpuHz/sampleRate;
    // The NES output circuit is commonly approximated by two high passes and
    // a low pass. These are deterministic one-pole filters, not a motherboard
    // component/impedance model. Disabled filters expose the raw DAC voltage.
    this.hp90=Math.exp(-2*Math.PI*90/sampleRate);this.hp440=Math.exp(-2*Math.PI*440/sampleRate);this.lp14000=1-Math.exp(-2*Math.PI*14000/sampleRate);
    this.reset();
  }
  reset(){
    this.pulses=[pulse(),pulse()];
    this.triangle={enabled:false,control:0,timer:0,counter:0,step:0,length:0,linear:0,reload:false};
    this.noise={enabled:false,control:0,period:4,counter:3,short:false,lfsr:1,length:0,envelope:envelope()};
    this.dac=0;this.cycles=0;this.samples=0;this.cycleRemaining=1;this.frameCycle=0;this.fiveStep=false;this.frameWriteDelay=0;this.pendingFrame=0;this.frameIrq=false;this.inhibitIrq=false;
    this.quarterClocks=0;this.halfClocks=0;this.pulseSteps=[0,0];this.triangleSteps=0;this.noiseSteps=0;
    this.hp90Input=0;this.hp90Output=0;this.hp440Input=0;this.hp440Output=0;this.lpOutput=0;this._refreshOutput();
    // Hard reset begins in the filter's DC equilibrium. The triangle retains
    // its hardware DAC value without manufacturing a startup click.
    this.hp90Input=this.output;
    return this;
  }
  write(address,value){
    address=Number(address)&0xFFFF;value=Number(value)&255;
    if(address>=0x4000&&address<=0x4007){
      const index=(address>>2)&1,p=this.pulses[index];
      switch(address&3){
        case 0:p.control=value;break;
        case 1:p.sweep=value;p.sweepReload=true;break;
        case 2:p.timer=(p.timer&0x700)|value;break;
        case 3:p.timer=(p.timer&255)|((value&7)<<8);if(p.enabled)p.length=LENGTHS[value>>3];p.step=0;p.envelope.start=true;break;
      }
    }else switch(address){
      case 0x4008:this.triangle.control=value;break;
      case 0x400A:this.triangle.timer=(this.triangle.timer&0x700)|value;break;
      case 0x400B:this.triangle.timer=(this.triangle.timer&255)|((value&7)<<8);if(this.triangle.enabled)this.triangle.length=LENGTHS[value>>3];this.triangle.reload=true;break;
      case 0x400C:this.noise.control=value;break;
      case 0x400E:this.noise.period=NOISE_PERIODS[value&15];this.noise.short=!!(value&0x80);break;
      case 0x400F:if(this.noise.enabled)this.noise.length=LENGTHS[value>>3];this.noise.envelope.start=true;break;
      case 0x4011:this.dac=value&0x7F;break;
      case 0x4015:{
        for(let i=0;i<2;i++){const p=this.pulses[i];p.enabled=!!(value&(1<<i));if(!p.enabled)p.length=0}
        this.triangle.enabled=!!(value&4);if(!this.triangle.enabled)this.triangle.length=0;
        this.noise.enabled=!!(value&8);if(!this.noise.enabled)this.noise.length=0;
        break;
      }
      case 0x4017:
        this.pendingFrame=value;this.inhibitIrq=!!(value&0x40);if(this.inhibitIrq)this.frameIrq=false;
        // The frame sequencer restarts 3 cycles after an APU-cycle write, or
        // 4 after an intervening CPU-cycle write. Register batches do not
        // invent the original 6502 instruction timing between writes.
        this.frameWriteDelay=(this.cycles&1)?4:3;break;
    }
    this._refreshOutput();return this;
  }
  writeBatch(writes){for(const [address,value] of writes)this.write(address,value);return this}
  _quarter(){
    this.quarterClocks++;clockEnvelope(this.pulses[0]);clockEnvelope(this.pulses[1]);clockEnvelope(this.noise);
    const t=this.triangle;if(t.reload)t.linear=t.control&0x7F;else if(t.linear)t.linear--;if(!(t.control&0x80))t.reload=false;
  }
  _half(){
    this.halfClocks++;
    for(let i=0;i<2;i++){
      const p=this.pulses[i];if(p.length&&!(p.control&0x20))p.length--;
      const next=target(p,i);
      if(!p.sweepDivider&&(p.sweep&0x80)&&(p.sweep&7)&&p.timer>=8&&next<=0x7FF)p.timer=next;
      if(!p.sweepDivider||p.sweepReload){p.sweepDivider=(p.sweep>>4)&7;p.sweepReload=false}else p.sweepDivider--;
    }
    if(this.triangle.length&&!(this.triangle.control&0x80))this.triangle.length--;
    if(this.noise.length&&!(this.noise.control&0x20))this.noise.length--;
  }
  _clock(){
    this.cycles++;this.frameCycle++;let dirty=false;
    if(this.frameCycle===7457||this.frameCycle===22371){this._quarter();dirty=true}
    else if(this.frameCycle===14913){this._quarter();this._half();dirty=true}
    else if(!this.fiveStep&&this.frameCycle===29829){this._quarter();this._half();dirty=true}
    else if(this.fiveStep&&this.frameCycle===37281){this._quarter();this._half();dirty=true}
    if(!this.fiveStep&&this.frameCycle>=29828&&!this.inhibitIrq)this.frameIrq=true;
    if(this.frameCycle===(this.fiveStep?37282:29830))this.frameCycle=0;
    if(this.frameWriteDelay&&!--this.frameWriteDelay){
      this.fiveStep=!!(this.pendingFrame&0x80);this.frameCycle=0;
      if(this.fiveStep){this._quarter();this._half();dirty=true}
    }
    if(!(this.cycles&1))for(let i=0;i<2;i++){
      const p=this.pulses[i];if(p.counter)p.counter--;else{p.counter=p.timer;p.step=(p.step+1)&7;this.pulseSteps[i]++;if(p.length)dirty=true}
    }
    const t=this.triangle;
    if(t.counter)t.counter--;else{t.counter=t.timer;if(t.length&&t.linear){t.step=(t.step+1)&31;this.triangleSteps++;dirty=true}}
    const n=this.noise;
    if(n.counter)n.counter--;else{n.counter=n.period-1;const feedback=(n.lfsr^(n.lfsr>>(n.short?6:1)))&1;n.lfsr=(n.lfsr>>1)|(feedback<<14);this.noiseSteps++;if(n.length)dirty=true}
    if(dirty)this._refreshOutput();
  }
  _refreshOutput(){
    let sum=0;
    for(let i=0;i<2;i++){
      const p=this.pulses[i];if(p.length&&p.timer>=8&&target(p,i)<=0x7FF&&DUTIES[p.control>>6][p.step])sum+=volume(p);
    }
    // A disabled triangle stops its sequencer; it does not zero its DAC.
    const triangle=TRIANGLE[this.triangle.step],noise=this.noise.length&&!(this.noise.lfsr&1)?volume(this.noise):0;
    this.output=PULSE_MIX[sum]+TND_MIX[((triangle*16+noise)*128)+this.dac];
  }
  _nextEventCycles(){
    const f=this.frameCycle;
    let next=f<7457?7457-f:f<14913?14913-f:f<22371?22371-f:
      this.fiveStep?(f<37281?37281-f:37282-f):(f<29828?29828-f:f<29829?29829-f:29830-f);
    if(this.frameWriteDelay)next=Math.min(next,this.frameWriteDelay);
    for(let i=0;i<2;i++){
      const p=this.pulses[i];
      if(p.length&&p.timer>=8&&target(p,i)<=0x7FF&&volume(p))next=Math.min(next,(p.counter+1)*2-(this.cycles&1));
    }
    const t=this.triangle;if(t.length&&t.linear)next=Math.min(next,t.counter+1);
    const n=this.noise;if(n.length&&volume(n))next=Math.min(next,n.counter+1);
    return next;
  }
  // Advance a span ending before any audible transition/frame-counter event.
  // Inactive oscillators still run; their divider and LFSR phases must survive
  // a later register write that enables them.
  _bulk(cycles){
    if(!cycles)return;
    const pulseTicks=Math.floor((this.cycles+cycles)/2)-Math.floor(this.cycles/2);
    for(let i=0;i<2;i++){
      const p=this.pulses[i];
      if(pulseTicks<=p.counter)p.counter-=pulseTicks;
      else{const after=pulseTicks-p.counter-1,steps=1+Math.floor(after/(p.timer+1));p.counter=p.timer-(after%(p.timer+1));p.step=(p.step+steps)&7;this.pulseSteps[i]+=steps}
    }
    const t=this.triangle;
    if(cycles<=t.counter)t.counter-=cycles;
    else{const after=cycles-t.counter-1,steps=1+Math.floor(after/(t.timer+1));t.counter=t.timer-(after%(t.timer+1));if(t.length&&t.linear){t.step=(t.step+steps)&31;this.triangleSteps+=steps}}
    const n=this.noise;
    if(cycles<=n.counter)n.counter-=cycles;
    else{
      const after=cycles-n.counter-1,steps=1+Math.floor(after/n.period);n.counter=n.period-1-(after%n.period);this.noiseSteps+=steps;
      for(let i=0;i<steps;i++){const feedback=(n.lfsr^(n.lfsr>>(n.short?6:1)))&1;n.lfsr=(n.lfsr>>1)|(feedback<<14)}
    }
    this.cycles+=cycles;this.frameCycle+=cycles;if(this.frameWriteDelay)this.frameWriteDelay-=cycles;
  }
  _advance(cycles){this._bulk(cycles-1);this._clock()}
  _filter(input){
    let output=this.hp90*(this.hp90Output+input-this.hp90Input);this.hp90Input=input;this.hp90Output=output;
    const stage=output;output=this.hp440*(this.hp440Output+stage-this.hp440Input);this.hp440Input=stage;this.hp440Output=output;
    this.lpOutput+=this.lp14000*(output-this.lpOutput);return this.lpOutput;
  }
  render(sampleCount){
    if(!Number.isSafeInteger(sampleCount)||sampleCount<0)throw new RangeError('Invalid APU sample count');
    const samples=new Float32Array(sampleCount),span=this.cyclesPerSample;
    for(let sample=0;sample<sampleCount;sample++){
      let remaining=span,integral=0;
      while(remaining>1e-10){
        if(this.cycleRemaining===1&&remaining>=1){
          const cycles=Math.min(Math.floor(remaining),this._nextEventCycles());
          integral+=this.output*cycles;remaining-=cycles;this._advance(cycles);continue;
        }
        const duration=Math.min(remaining,this.cycleRemaining);integral+=this.output*duration;remaining-=duration;this.cycleRemaining-=duration;
        if(this.cycleRemaining<1e-10){this.cycleRemaining=1;this._clock()}
      }
      const value=integral/span;samples[sample]=this.filter?this._filter(value):value;
    }
    this.samples+=sampleCount;return samples;
  }
  inspect(){
    return {sampleRate:this.sampleRate,cpuHz:this.cpuHz,cycles:this.cycles,samples:this.samples,cycleRemaining:this.cycleRemaining,
      frameCycle:this.frameCycle,fiveStep:this.fiveStep,frameWriteDelay:this.frameWriteDelay,frameIrq:this.frameIrq,quarterClocks:this.quarterClocks,halfClocks:this.halfClocks,
      pulses:this.pulses.map((p,i)=>({...p,envelope:{...p.envelope},target:target(p,i),steps:this.pulseSteps[i],muted:p.timer<8||target(p,i)>0x7FF})),
      triangle:{...this.triangle,output:TRIANGLE[this.triangle.step],steps:this.triangleSteps},noise:{...this.noise,envelope:{...this.noise.envelope},steps:this.noiseSteps},dac:this.dac,output:this.output};
  }
  static mix(pulse1,pulse2,triangle,noise,dac){
    const sum=pulse1+pulse2,tnd=triangle/8227+noise/12241+dac/22638;
    return (sum?95.88/(8128/sum+100):0)+(tnd?159.79/(1/tnd+100):0);
  }
}
globalThis.VAPU=VAPU;
})();
