#!/usr/bin/env node
/**
 * Build-time Arkansas Streamlined Sales Tax snapshot compiler.
 * Downloads public governmental SST jurisdiction data, resolves actual rate components,
 * compresses adjacent ZIP+4 ranges and emits a small static file bundled by Next.js.
 * NO third-party tax API key, network call, ZIP parsing or large allocations at checkout.
 */
import {writeFileSync,mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {Readable} from 'node:stream';
import {createInflateRaw} from 'node:zlib';
import {StringDecoder} from 'node:string_decoder';

const QUARTER='2026q4',BEGIN='20261001',END='20261231';
const RATE_URL='https://www.streamlinedsalestax.org/ratesandboundry/Rates/ARR2026Q4AUG28.csv';
const BOUNDARY_URL='https://www.streamlinedsalestax.org/ratesandboundry/Boundary/ARB2026Q4SEP17.zip';
const OUTPUT='lib/data/official-ar-2026q4.json';
const TODAY=new Date().toISOString().slice(0,10).replace(/-/g,'');
if(TODAY<BEGIN||TODAY>END)throw Error('Arkansas official tax snapshot must be updated to current quarter before building');

async function download(url,limit){
 const response=await fetch(url,{signal:AbortSignal.timeout(30000),headers:{'User-Agent':'HometownCardShop-Arkansas-Tax-Build/1.0','Accept':'*/*'},cache:'no-store'});
 if(!response.ok)throw Error('Official SST file fetch failed '+response.status+' '+url);
 const data=Buffer.from(await response.arrayBuffer());
 if(data.length<100||data.length>limit)throw Error('Official SST file unexpected size '+url);
 return data;
}
const rates=new Map();let rateCount=0;
for(const raw of (await download(RATE_URL,4_000_000)).toString('utf8').replace(/^\uFEFF/,'').split(/\r?\n/)){
 const p=raw.split(',').map(x=>x.trim());
 if(p.length<9||p[0]!=='05'||p[7]>TODAY||p[8]<TODAY)continue;
 const value=Number(p[3]);if(!Number.isFinite(value)||value<0||value>0.2)throw Error('Invalid rate value');
 const key=p[1]+':'+p[2];
 if(rates.has(key)&&rates.get(key)!==value)throw Error('Conflicting rate record '+key);
 rates.set(key,value);rateCount++;
}
if(rates.get('45:05')!==0.065||rateCount<80)throw Error('Incomplete Arkansas SST rate table');
const areaRates=new Map();const fallback=new Map();
function quote(p){
 let total=rates.get('45:05');
 if(p[24])total+=rates.get('00:'+p[24])??0;
 if(p[25])total+=rates.get('01:'+p[25])??rates.get('02:'+p[25])??0;
 for(let i=29;i+2<p.length;i+=3){
  if(!p[i+1]||!p[i+2])continue;
  const rate=rates.get(p[i+2]+':'+p[i+1]);
  if(rate===undefined)throw Error('Missing district rate '+p[i+2]+':'+p[i+1]);
  total+=rate;
 }
 if(!Number.isFinite(total)||total<0.065||total>0.16)throw Error('Invalid combined tax rate');
 return Math.round(total*1_000_000);
}
let boundaryCount=0,zoneCount=0;
function processBoundary(row){
 if(row[0]!=='4'&&row[0]!=='Z')return;
 const p=row.replace(/^\uFEFF/,'').trim().split(',');
 if(p.length<26||p[22]!=='05'||p[1]>TODAY||p[2]<TODAY)return;
 const lo=Number(p[17]),hi=Number(p[19]);
 if(!Number.isInteger(lo)||!Number.isInteger(hi)||hi<lo||hi-lo>150||lo<5000||hi>99999)return;
 const kind=p[0],ppm=quote(p);boundaryCount++;
 for(let zip=lo;zip<=hi;zip++){
  const code=String(zip).padStart(5,'0');
  if(kind==='Z'){
   const old=fallback.get(code);
   if(old!==undefined&&old!==ppm)throw Error('Conflicting ZIP5 fallback rate '+code);
   fallback.set(code,ppm);
  }else{
   let a=areaRates.get(code);
   if(!a){a=[];areaRates.set(code,a);}
   const start=zip===lo?Number(p[18]||0):0,end=zip===hi?Number(p[20]||9999):9999;
   if(start<0||end>9999||end<start)throw Error('Unexpected ZIP+4 range');
   a.push([start,end,ppm]);zoneCount++;
  }
 }
}
async function readArchive(data){
 const sig=Buffer.from([0x50,0x4b,0x05,0x06]),idx=data.lastIndexOf(sig);
 if(idx<0)throw Error('Official boundary ZIP has no end directory');
 const entries=data.readUInt16LE(idx+10),central=data.readUInt32LE(idx+16);
 let cursor=central,found=0;
 for(let i=0;i<entries;i++){
  if(data.readUInt32LE(cursor)!==0x02014b50)throw Error('Corrupt ZIP central index');
  const compression=data.readUInt16LE(cursor+10),compressedSize=data.readUInt32LE(cursor+20);
  const fnLen=data.readUInt16LE(cursor+28),exLen=data.readUInt16LE(cursor+30),commentLen=data.readUInt16LE(cursor+32);
  const localOffset=data.readUInt32LE(cursor+42),name=data.toString('utf8',cursor+46,cursor+46+fnLen);
  cursor+=46+fnLen+exLen+commentLen;
  if(!/\.(csv|txt)$/i.test(name)||name.split('/').includes('..'))continue;
  if(data.readUInt32LE(localOffset)!==0x04034b50)throw Error('Invalid local ZIP entry');
  const start=localOffset+30+data.readUInt16LE(localOffset+26)+data.readUInt16LE(localOffset+28);
  if(start+compressedSize>data.length)throw Error('Archive size mismatch');
  const compressed=data.subarray(start,start+compressedSize);
  const stream=Readable.from([compressed]);
  else if(compression!==0)throw Error('Unsupported ZIP compression');
  const reader=compression===8?stream.pipe(createInflateRaw()):stream;
  const decoder=new StringDecoder('utf8');let tail='';
  for await(const chunk of reader){
   tail+=decoder.write(chunk);
   let e;while((e=tail.indexOf('\n'))>=0){
    processBoundary(tail.slice(0,e));tail=tail.slice(e+1);
   }
  }
  tail+=decoder.end();if(tail)processBoundary(tail);
  found++;
 }
 if(!found)throw Error('Official boundary ZIP lacks CSV/TXT records');
}
await readArchive(await download(BOUNDARY_URL,60_000_000));
if(fallback.size<100||boundaryCount<1000||zoneCount<1000)throw Error('Incomplete Arkansas boundary data');
const byZip={};let unique=0,totalRanges=0;
for(const [zip,items] of areaRates){
 items.sort((a,b)=>a[0]-b[0]||a[1]-b[1]||a[2]-b[2]);
 const merged=[];
 for(const [lo,hi,rate] of items){
  const last=merged[merged.length-1];
  if(last&&last[2]===rate&&lo<=last[1]+1){last[1]=Math.max(last[1],hi);continue;}
  merged.push([lo,hi,rate]);
 }
 byZip[zip]=merged;totalRanges+=merged.length;unique++;
}
const file={quarter:QUARTER,validFrom:BEGIN,validThrough:END,
 sourceRate:RATE_URL,sourceBoundary:BOUNDARY_URL,generatedAt:new Date().toISOString(),
 zip4:byZip,zip5:Object.fromEntries(fallback)};
mkdirSync(dirname(OUTPUT),{recursive:true});
writeFileSync(OUTPUT,JSON.stringify(file));
console.log('Compiled Arkansas SST '+QUARTER+': rates='+rateCount+', sourceRows='+boundaryCount+
 ', ZIP+4 zones='+zoneCount+', ZIP areas='+unique+', packedRanges='+totalRanges+
 ', outputBytes='+Buffer.byteLength(JSON.stringify(file)));
