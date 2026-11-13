// Genera le icone PNG dell'app: quadrato blu con un manubrio bianco stilizzato.
// Uso: node scripts/make-icons.cjs public
const zlib = require('zlib'), fs = require('fs'), path = require('path');
function crc32(buf){let c,crc=0xffffffff;for(let n=0;n<buf.length;n++){c=(crc^buf[n])&0xff;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;crc=(crc>>>8)^c;}return (crc^0xffffffff)>>>0;}
function chunk(type,data){const len=Buffer.alloc(4);len.writeUInt32BE(data.length);const td=Buffer.concat([Buffer.from(type),data]);const crc=Buffer.alloc(4);crc.writeUInt32BE(crc32(td));return Buffer.concat([len,td,crc]);}
function png(size){
  const rows=[];const s=size/512;
  const inRect=(x,y,x0,y0,x1,y1)=>x>=x0*s&&x<x1*s&&y>=y0*s&&y<y1*s;
  for(let y=0;y<size;y++){const row=Buffer.alloc(1+size*3);for(let x=0;x<size;x++){
    const white=inRect(x,y,96,176,136,336)||inRect(x,y,376,176,416,336)||inRect(x,y,146,206,186,306)||inRect(x,y,326,206,366,306)||inRect(x,y,186,240,326,272);
    const o=1+x*3; if(white){row[o]=255;row[o+1]=255;row[o+2]=255}else{row[o]=0x27;row[o+1]=0x47;row[o+2]=0xd6}}
    rows.push(row);}
  const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(size,0);ihdr.writeUInt32BE(size,4);ihdr[8]=8;ihdr[9]=2;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(Buffer.concat(rows))),chunk('IEND',Buffer.alloc(0))]);
}
const out=process.argv[2];
for(const n of [192,512]) fs.writeFileSync(path.join(out,`icon-${n}.png`),png(n));
