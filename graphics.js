// Canvas compositor for extracted NES pixels. This is a renderer, not a CPU emulator.
(() => {
'use strict';
// Horizontal mirroring aliases the left/right nametables. The two remaining
// pages form a 32-column, 60-row ring; vertical scroll wraps every 240 pixels.
// Retain uploaded bytes separately from the attribute shadow and next-NMI queue.
globalThis.VNametable=class {
  constructor(){this.tiles=new Uint8Array(1920).fill(0x26);this.attrs=new Uint8Array(128);this.shadow=new Uint8Array(128);this.pending=null}
  cell(col,row){return (((row%60)+60)%60)*32+(col&31)}
  attribute(col,row){row=((row%60)+60)%60;const local=row%30;return{index:(row>=30?64:0)+(local>>2)*8+((col&31)>>2),shift:((local&2)?4:0)+((col&2)?2:0)}}
  queueStrip(col,row,worldX,worldY,horizontal,lookup){
    const tiles=[],count=horizontal?32:27;
    for(let i=0;i<count;i++){
      const c=col+(horizontal?i:0),r=row+(horizontal?0:i),z=lookup(worldX+(horizontal?i*8:0),worldY+(horizontal?0:i*8));
      tiles.push([this.cell(c,r),z.tile&255]);const a=this.attribute(c,r),mask=3<<a.shift;
      this.shadow[a.index]=(this.shadow[a.index]&~mask)|((z.pal&3)<<a.shift);
    }
    // $DA62/$DAB0 upload complete attribute rows/columns from the shadow.
    const first=this.attribute(col,row),indices=[];
    if(horizontal){const start=first.index&~7;for(let i=0;i<8;i++)indices.push(start+i)}
    else for(let i=0;i<8;i++)indices.push((first.index+i*8)&127)
    this.pending={kind:'strip',tiles,attrs:indices.map(i=>[i,this.shadow[i]])};
  }
  queuePatch(col,row,values){const tiles=[];for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++)tiles.push([this.cell((col&~1)+dx,(row&~1)+dy),values[dy*2+dx]&255]);this.pending={kind:'patch',tiles,attrs:[]}}
  commit(){const q=this.pending;if(!q)return null;for(const [i,t] of q.tiles)this.tiles[i]=t;for(const [i,a] of q.attrs)this.attrs[i]=a;this.pending=null;return q}
  read(col,row){const a=this.attribute(col,row);return{tile:this.tiles[this.cell(col,row)],pal:(this.attrs[a.index]>>a.shift)&3}}
};
globalThis.VRenderer=class {
  constructor(ctx,data){this.ctx=ctx;this.data=data;this.opaque=new Uint8Array(256*240);this.colorIndices=new Uint8Array(256*240);this.claimed=new Uint8Array(256*240);this.scanlines=new Uint8Array(240);this.packets=[];this.layer=0;this.mask=0x18;this.clipBottom=240;this.clipRight=256;this.config=2;this.bank=0;this.color=0;this.poison=false;this.overflow=0;this.emphasis=0}
  begin({config=2,bank=0,color=0,poison=false,mask=0x18,emphasis=0,backgroundPalette=null}={}){this.config=config;this.bank=bank;this.color=color;this.poison=poison;this.mask=mask;this.emphasis=emphasis;this.backgroundPalette=backgroundPalette;this.layer=0;this.clipBottom=240;this.clipRight=256;this.opaque.fill(0);this.colorIndices.fill(backgroundPalette?.[0]??this.data.palettes[0][0]);this.packets.length=0;this.overflow=0}
  background(config,tile,x,y,height=8,sourceY=0,pal=0,family=0){
    const pattern=this.data.background[config];x=Math.round(x);y=Math.round(y);
    const colors=this.backgroundPalette||this.data.backgroundPalettes?.[config]?.[family]||this.data.palettes[0];
    for(let dy=0;dy<height;dy++){const yy=y+dy;if(yy<0||yy>=this.clipBottom||yy>=240)continue;for(let dx=0;dx<8;dx++){const xx=x+dx;if(xx<0||xx>=this.clipRight||xx>=256)continue;const v=pattern.charCodeAt((tile&255)*64+(dy+sourceY)*8+dx)-48,j=yy*256+xx;this.opaque[j]=v?1:0;this.colorIndices[j]=colors[v?(pal&3)*4+v:0]&63}}
  }
  sprite(tile,attr,x,y){this.packets.push({tile:tile&255,attr:attr&255,x:Math.round(x)&255,y:(Math.round(y)&255)+1,layer:this.layer,order:this.packets.length})}
  palette(){const p=this.data.palettes[1].slice();p[2]=this.poison?0x23:0x36;p[3]=this.data.colors[this.color&3];return p}
  flush(){
    if(typeof this.ctx.getImageData!=='function'||typeof this.ctx.putImageData!=='function')return;
    const frame=this.ctx.getImageData(0,0,256,240),pixels=frame.data,palette=this.palette(),rgb=this.data.rgb;
    // A realm request changes CHR before its later background-palette upload.
    // Compose those patterns with the preceding palette instead of atlas RGB.
    if(this.backgroundPalette)for(let j=0;j<this.colorIndices.length;j++){const c=rgb[this.colorIndices[j]],i=j*4;pixels[i]=c[0];pixels[i+1]=c[1];pixels[i+2]=c[2];pixels[i+3]=255}
    this.claimed.fill(0);this.scanlines.fill(0);this.packets.sort((a,b)=>a.layer-b.layer||a.order-b.order);
    // PPUMASK controls the background and sprite left edges independently.
    // Clear hidden background pixels before OAM composition so an enabled
    // left-edge sprite can still occupy the universal-color backdrop.
    const backgroundEnabled=!!(this.mask&8),backgroundLeft=!!(this.mask&2),backdropIndex=(this.backgroundPalette?.[0]??this.data.palettes[0][0])&63,backdrop=rgb[backdropIndex];
    if(!backgroundEnabled||!backgroundLeft)for(let y=0;y<240;y++)for(let x=0;x<(backgroundEnabled?8:256);x++){const j=y*256+x,i=j*4;this.colorIndices[j]=backdropIndex;pixels[i]=backdrop[0];pixels[i+1]=backdrop[1];pixels[i+2]=backdrop[2];pixels[i+3]=255}
    for(const s of (this.mask&16)?this.packets:[]){
      const pattern=(s.tile&1)&&s.tile<64?this.data.playerBanks[this.bank&3]:this.data.sprite[this.config];
      for(let dy=0;dy<16;dy++){
        const y=s.y+dy;if(y>=240)break;if(++this.scanlines[y]>8){this.overflow++;continue}
        const py=(s.attr&128)?15-dy:dy;
        for(let dx=0;dx<8;dx++){
          const x=s.x+dx;if(x>=256||x<8&&!(this.mask&4))continue;
          const px=(s.attr&64)?7-dx:dx,v=pattern.charCodeAt(s.tile*128+py*8+px)-48,j=y*256+x;
          if(!v||this.claimed[j])continue;this.claimed[j]=1;
          // An earlier behind-background sprite still blocks later OAM sprites.
          if((s.attr&32)&&backgroundEnabled&&(x>=8||backgroundLeft)&&this.opaque[j])continue;
          const color=palette[(s.attr&3)*4+v]&63,c=rgb[color],i=j*4;this.colorIndices[j]=color;pixels[i]=c[0];pixels[i+1]=c[1];pixels[i+2]=c[2];pixels[i+3]=255;
        }
      }
    }
    // PPUMASK grayscale selects only the high two palette-index bits. Keep
    // original indices: multiple NES black indices share RGB but differ here.
    if(this.mask&1)for(let j=0;j<this.colorIndices.length;j++){const c=rgb[this.colorIndices[j]&0x30],i=j*4;pixels[i]=c[0];pixels[i+1]=c[1];pixels[i+2]=c[2]}
    // Color emphasis, when requested, remains an analog-output approximation.
    if(this.emphasis)for(let i=0;i<pixels.length;i+=4){pixels[i]=Math.round(pixels[i]*.75);pixels[i+1]=Math.round(pixels[i+1]*.75);pixels[i+2]=Math.round(pixels[i+2]*.75)}
    this.ctx.putImageData(frame,0,0);
  }
};
})();
