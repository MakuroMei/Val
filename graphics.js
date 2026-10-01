// Canvas compositor for extracted NES pixels. This is a renderer, not a CPU emulator.
(() => {
'use strict';
globalThis.VRenderer=class {
  constructor(ctx,data){this.ctx=ctx;this.data=data;this.opaque=new Uint8Array(256*240);this.claimed=new Uint8Array(256*240);this.scanlines=new Uint8Array(240);this.packets=[];this.layer=0;this.mask=0x18;this.clipBottom=240;this.clipRight=256;this.config=2;this.bank=0;this.color=0;this.poison=false;this.overflow=0;this.emphasis=0}
  begin({config=2,bank=0,color=0,poison=false,mask=0x18,emphasis=0}={}){this.config=config;this.bank=bank;this.color=color;this.poison=poison;this.mask=mask;this.emphasis=emphasis;this.layer=0;this.clipBottom=240;this.clipRight=256;this.opaque.fill(0);this.packets.length=0;this.overflow=0}
  background(config,tile,x,y,height=8,sourceY=0){
    const pattern=this.data.background[config];x=Math.round(x);y=Math.round(y);
    for(let dy=0;dy<height;dy++){const yy=y+dy;if(yy<0||yy>=this.clipBottom||yy>=240)continue;for(let dx=0;dx<8;dx++){const xx=x+dx;if(xx<0||xx>=this.clipRight||xx>=256)continue;this.opaque[yy*256+xx]=pattern.charCodeAt((tile&255)*64+(dy+sourceY)*8+dx)!==48?1:0}}
  }
  sprite(tile,attr,x,y){this.packets.push({tile:tile&255,attr:attr&255,x:Math.round(x)&255,y:(Math.round(y)&255)+1,layer:this.layer,order:this.packets.length})}
  palette(){const p=this.data.palettes[1].slice();p[2]=this.poison?0x23:0x36;p[3]=this.data.colors[this.color&3];return p}
  flush(){
    if(typeof this.ctx.getImageData!=='function'||typeof this.ctx.putImageData!=='function')return;
    const frame=this.ctx.getImageData(0,0,256,240),pixels=frame.data,palette=this.palette(),rgb=this.data.rgb;
    this.claimed.fill(0);this.scanlines.fill(0);this.packets.sort((a,b)=>a.layer-b.layer||a.order-b.order);
    for(const s of this.packets){
      const pattern=(s.tile&1)&&s.tile<64?this.data.playerBanks[this.bank&3]:this.data.sprite[this.config];
      for(let dy=0;dy<16;dy++){
        const y=s.y+dy;if(y>=240)break;if(++this.scanlines[y]>8){this.overflow++;continue}
        const py=(s.attr&128)?15-dy:dy;
        for(let dx=0;dx<8;dx++){
          const x=s.x+dx;if(x>=256||x<8&&!(this.mask&4))continue;
          const px=(s.attr&64)?7-dx:dx,v=pattern.charCodeAt(s.tile*128+py*8+px)-48,j=y*256+x;
          if(!v||this.claimed[j])continue;this.claimed[j]=1;
          // An earlier behind-background sprite still blocks later OAM sprites.
          if((s.attr&32)&&this.opaque[j])continue;
          const c=rgb[palette[(s.attr&3)*4+v]&63],i=j*4;pixels[i]=c[0];pixels[i+1]=c[1];pixels[i+2]=c[2];pixels[i+3]=255;
        }
      }
    }
    if(!(this.mask&2))for(let y=0;y<240;y++)for(let x=0;x<8;x++){const i=(y*256+x)*4;pixels[i]=pixels[i+1]=pixels[i+2]=0;pixels[i+3]=255}
    // The retail lightning effect toggles the PPU color-emphasis bits. Approximate
    // their analog attenuation without adding non-retail translucent rectangles.
    if(this.emphasis)for(let i=0;i<pixels.length;i+=4){pixels[i]=Math.round(pixels[i]*.75);pixels[i+1]=Math.round(pixels[i+1]*.75);pixels[i+2]=Math.round(pixels[i+2]*.75)}
    this.ctx.putImageData(frame,0,0);
  }
};
})();
