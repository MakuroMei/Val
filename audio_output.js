// Stream PCM produced by the same deterministic APU used by offline validation.
// ScriptProcessor keeps direct-file playback available where worklets require HTTPS.
(()=>{
'use strict';
globalThis.VAudioPCM=class {
  constructor(context,master,{bufferSize=1024}={}){
    if(!globalThis.VAPU||typeof context.createScriptProcessor!=='function')throw Error('PCM audio backend is unavailable');
    this.context=context;this.apu=new globalThis.VAPU({sampleRate:context.sampleRate});
    this.apu.writeBatch([[0x4017,0xC0],[0x4015,0]]);
    this.queue=[];this.offset=0;this.queued=0;this.fraction=0;this.primed=false;this.rebuffering=false;this.underruns=0;this.dropped=0;this.lastSample=0;this.transition=null;
    this.prebuffer=bufferSize+Math.ceil(context.sampleRate/60);
    this.limit=Math.ceil(context.sampleRate*.15);
    this.node=context.createScriptProcessor(bufferSize,0,1);
    this.node.onaudioprocess=event=>this.read(event.outputBuffer.getChannelData(0));
    this.node.connect(master);
  }
  clear(){this.queue.length=0;this.offset=0;this.queued=0;this.primed=false;this.rebuffering=true;this.transition=this.lastSample}
  reset(){this.clear();this.fraction=0;this.apu.reset();this.apu.writeBatch([[0x4017,0xC0],[0x4015,0]])}
  frame(writes,control){
    if(control?.reset){this.reset();return}
    this.apu.writeBatch(writes);
    this.fraction+=this.context.sampleRate;
    const count=Math.floor(this.fraction/60);this.fraction-=count*60;
    const samples=this.apu.render(count);
    if(this.context.state!=='running'){this.clear();return}
    this.queue.push(samples);this.queued+=samples.length;
    // A resumed tab or a burst of catch-up updates must not play old audio for
    // several seconds. Keep recent frames and their already-advanced APU state.
    let discarded=false;
    while(this.queued>this.limit&&this.queue.length>1){
      this.queued-=this.queue.shift().length-this.offset;this.offset=0;this.dropped++;
      discarded=true;
    }
    if(discarded)this.transition=this.lastSample;
  }
  read(output){
    output.fill(0);
    if(!this.primed){
      if(this.queued<this.prebuffer){this.finish(output);return}
      this.primed=true;
      if(this.rebuffering){this.transition=this.lastSample;this.rebuffering=false}
    }
    let written=0;
    while(written<output.length&&this.queue.length){
      const first=this.queue[0],count=Math.min(first.length-this.offset,output.length-written);
      output.set(first.subarray(this.offset,this.offset+count),written);
      written+=count;this.offset+=count;this.queued-=count;
      if(this.offset===first.length){this.queue.shift();this.offset=0}
    }
    if(written<output.length){
      // Smooth an actual scheduling underrun, then refill before restarting.
      // The APU itself is never restarted or advanced by the output callback.
      const fade=Math.min(64,written);
      for(let i=0;i<fade;i++)output[written-fade+i]*=(fade-i)/fade;
      if(!written){const count=Math.min(64,output.length);for(let i=0;i<count;i++)output[i]=this.lastSample*(1-(i+1)/count)}
      this.underruns++;this.primed=false;this.rebuffering=true;
    }
    this.finish(output);
  }
  finish(output){
    if(this.transition!==null){const count=Math.min(64,output.length);for(let i=0;i<count;i++){const weight=(i+1)/count;output[i]=this.transition*(1-weight)+output[i]*weight}this.transition=null}
    this.lastSample=output.length?output[output.length-1]:0;
  }
  dispose(){this.clear();this.node.onaudioprocess=null;this.node.disconnect?.()}
  status(){return{backend:'software-apu',sampleRate:this.context.sampleRate,queuedSamples:this.queued,underruns:this.underruns,droppedFrames:this.dropped}}
};
})();
