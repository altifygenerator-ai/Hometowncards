import {inflateRawSync} from 'node:zlib';
import {PortalError} from '@/lib/server/portal';

/**
 * Arkansas' official Streamlined Sales Tax general-merchandise rate + ZIP boundary files.
 * SST publishes new quarterly files. File names must be audited and updated each quarter.
 * Fail closed rather than guessing when the quarter advances or files are unavailable.
 */
const quarter='2026q4';
const starts='20261001', ends='20261231';
const rateUrl='https://www.streamlinedsalestax.org/ratesandboundry/Rates/ARR2026Q4AUG28.csv';
const boundaryUrl='https://www.streamlinedsalestax.org/ratesandboundry/Boundary/ARB2026Q4SEP17.zip';
const maxAgeMs=20*60*60*1000;
type Jurisdiction={state:string;county:string;place:string;placeClass:string;districts:Array<{type:string;code:string}>;start:string;end:string;low:string;high:string;zipType:'Z'|'4'};
type Dataset={loadedAt:number;rates:Map<string,number>;zip4:Map<string,Jurisdiction[]>;zip5:Map<string,Jurisdiction[]>;rawRateRows:number;rawBoundaryRows:number};
export type OfficialArkansasRate={rate:number;source:'ar-sst-2026q4';basis:'zip4'|'zip5-unique';resolvedZip:string};
let pending:Promise<Dataset>|undefined;
let snapshot:Dataset|undefined;

function requireDate(){
 const date=new Date().toISOString().slice(0,10).replace(/-/g,'');
 if(date<starts||date>ends)throw new PortalError('Arkansas tax-rate records must be refreshed for the current quarter.',503);
 return date;
}
function zipContents(buf:Buffer):Buffer[]{
 const eocd=buf.lastIndexOf(Buffer.from([0x50,0x4b,0x05,0x06]));
 if(eocd<0||eocd+22>buf.length)throw Error('Invalid Arkansas boundary ZIP');
 const entries=buf.readUInt16LE(eocd+10),dir=buf.readUInt32LE(eocd+16);
 if(entries>100||buf.length>45_000_000)throw Error('Boundary archive out of bounds');
 const result:Buffer[]=[];let pos=dir;let total=0;
 for(let n=0;n<entries;n++){
  if(buf.readUInt32LE(pos)!==0x02014b50)throw Error('Invalid central ZIP entry');
  const method=buf.readUInt16LE(pos+10),packed=buf.readUInt32LE(pos+20),size=buf.readUInt32LE(pos+24);
  const nameLen=buf.readUInt16LE(pos+28),extraLen=buf.readUInt16LE(pos+30),commentLen=buf.readUInt16LE(pos+32);
  const local=buf.readUInt32LE(pos+42),name=buf.toString('utf8',pos+46,pos+46+nameLen);
  pos+=46+nameLen+extraLen+commentLen;
  if(!/\.csv$/i.test(name)||name.includes('..')||name.includes('/'))continue;
  total+=size;if(total>300_000_000)throw Error('Boundary files too large');
  if(buf.readUInt32LE(local)!==0x04034b50)throw Error('Invalid local ZIP entry');
  const start=local+30+buf.readUInt16LE(local+26)+buf.readUInt16LE(local+28);
  if(start+packed>buf.length)throw Error('Truncated boundary archive');
  const data=buf.subarray(start,start+packed);
  const expanded=method===8?inflateRawSync(data):method===0?data:null;
  if(!expanded||expanded.length!==size)throw Error('Unexpected ZIP compression');
  result.push(expanded);
 }
 if(!result.length)throw Error('No Arkansas boundary CSV found');
 return result;
}
async function download(url:string,max:number):Promise<Buffer>{
 const response=await fetch(url,{headers:{Accept:'application/octet-stream,text/csv,*/*'},cache:'no-store',
  signal:AbortSignal.timeout(18000)});
 if(!response.ok)throw Error('SST source '+response.status);
 const data=Buffer.from(await response.arrayBuffer());
 if(data.length<200||data.length>max)throw Error('Invalid Arkansas SST data size');
 return data;
}
function validDate(start:string,end:string,at:string){
 return /^\d{8}$/.test(start)&&/^\d{8}$/.test(end)&&start<=at&&end>=at;
}
function loadRates(csv:string,date:string){
 const map=new Map<string,number>();let count=0;
 for(const line of csv.split(/\r?\n/)){
  const p=line.trim().split(',').map(v=>v.trim().replace(/^"|"$/g,''));
  if(p.length<9||p[0]!=='05'||!validDate(p[7],p[8],date))continue;
  const type=p[1],code=p[2],rate=Number(p[3]);
  if(!/^\d\d$/.test(type)||!code||!Number.isFinite(rate)||rate<0||rate>0.2)throw Error('Malformed Arkansas tax rate');
  const key=type+':'+code;
  if(map.has(key)&&map.get(key)!==rate)throw Error('Conflicting Arkansas jurisdiction rates');
  map.set(key,rate);count++;
 }
 if(map.get('45:05')!==0.065||count<80)throw Error('Arkansas general-sales tax rate file failed validation');
 return {map,count};
}
function loadBoundaries(buffers:Buffer[],date:string){
 const zip4=new Map<string,Jurisdiction[]>(),zip5=new Map<string,Jurisdiction[]>();let count=0;
 for(const buffer of buffers){
  for(const line of buffer.toString('utf8').split(/\r?\n/)){
   if(line[0]!=='4'&&line[0]!=='Z')continue;
   const p=line.trim().split(',').map(v=>v.trim().replace(/^"|"$/g,''));
   if(p.length<26||!validDate(p[1],p[2],date)||p[22]!=='05')continue;
   const type=p[0] as 'Z'|'4',lo=p[17],hi=p[19];
   if(!/^\d{5}$/.test(lo)||!/^\d{5}$/.test(hi)||Number(hi)<Number(lo))continue;
   const districts:Array<{type:string;code:string}>=[];
   for(let j=29;j+2<p.length;j+=3)if(p[j+1]&&p[j+2])districts.push({code:p[j+1],type:p[j+2]});
   const boundary:Jurisdiction={zipType:type,start:p[1],end:p[2],low:lo+(type==='4'?p[18]||'0000':''),
    high:hi+(type==='4'?p[20]||'9999':''),state:p[22],county:p[24]||'',place:p[25]||'',
    placeClass:p[26]||'',districts};
   // Group by first 5 digits. Avoid unbounded expansion for abnormal ranges.
   if(Number(hi)-Number(lo)>150)throw Error('Unexpected wide ZIP boundary range');
   for(let zip=Number(lo);zip<=Number(hi);zip++){
    const code=String(zip).padStart(5,'0'),map=type==='4'?zip4:zip5;
    if(!map.has(code))map.set(code,[]);
    map.get(code)!.push(boundary);
   }
   count++;
  }
 }
 if(zip5.size<100||count<1000)throw Error('Incomplete Arkansas tax boundaries');
 return {zip4,zip5,count};
}
async function loadDataset():Promise<Dataset>{
 requireDate();
 const [csv,zip]=await Promise.all([download(rateUrl,4_000_000),download(boundaryUrl,45_000_000)]);
 const date=requireDate();
 const rates=loadRates(csv.toString('utf8'),date);
 const bounds=loadBoundaries(zipContents(zip),date);
 return {loadedAt:Date.now(),rates:rates.map,zip4:bounds.zip4,zip5:bounds.zip5,
  rawRateRows:rates.count,rawBoundaryRows:bounds.count};
}
async function getDataset(){
 requireDate();
 if(snapshot&&Date.now()-snapshot.loadedAt<maxAgeMs)return snapshot;
 if(!pending)pending=loadDataset().then(data=>(snapshot=data)).finally(()=>{pending=undefined});
 try{return await pending}catch(e){
  console.error('Official Arkansas SST data unavailable',e instanceof Error?e.message:'unknown error');
  throw new PortalError('The Arkansas tax rate table cannot be verified at the moment. Please retry later.',503);
 }
}
function boundaryRate(b:Jurisdiction,rates:Map<string,number>):number{
 const state=rates.get('45:05'),county=b.county?(rates.get('00:'+b.county)??0):0;
 if(state===undefined)throw Error('Missing Arkansas state sales tax rate');
 let total=state+county;
 if(b.place){
  const r=rates.get('01:'+b.place)??rates.get('02:'+b.place);
  // A real incorporated place may have no city tax, in which case there is no rate row.
  total+=r??0;
 }
 for(const d of b.districts){
  const r=rates.get(d.type+':'+d.code);
  if(r===undefined)throw Error('Missing special district '+d.code);
  total+=r;
 }
 if(total<0.065||total>0.16)throw Error('Out-of-bounds Arkansas sales tax');
 return Math.round(total*1_000_000)/1_000_000;
}
function active(record:Jurisdiction,date:string){return record.start<=date&&record.end>=date}
export async function resolveArkansasSalesTax(zip:string):Promise<OfficialArkansasRate>{
 const date=requireDate(),data=await getDataset();
 const match=/^(\d{5})(?:-(\d{4}))?$/.exec(zip);
 if(!match)throw new PortalError('Enter a valid ZIP code.',400);
 const five=match[1],ext=match[2],boundaryRows=data.zip4.get(five)||[];
 const records=ext?
  boundaryRows.filter(b=>active(b,date)&&b.low<=five+ext&&b.high>=five+ext):
  boundaryRows.filter(b=>active(b,date));
 // Exact ZIP+4 always takes precedence over a five-digit fallback.
 if(ext&&!records.length)throw new PortalError('Arkansas ZIP+4 could not be matched to a verified taxing jurisdiction.',422);
 const candidates=records.length?records:(data.zip5.get(five)||[]).filter(b=>active(b,date)&&b.low<=five&&b.high>=five);
 if(!candidates.length)throw new PortalError('This ZIP code was not found in Arkansas’s current tax boundaries.',422);
 const rates=new Set<number>();
 try{for(const b of candidates)rates.add(boundaryRate(b,data.rates));}
 catch(e){
  console.error('Arkansas tax boundary mismatch',e instanceof Error?e.message:'unknown');
  throw new PortalError('Tax jurisdictions for this ZIP could not be verified. Please contact the shop.',503);
 }
 if(rates.size!==1)throw new PortalError('This ZIP crosses several local tax districts. Please enter the full ZIP+4 for accurate tax.',422);
 const rate=[...rates][0];
 // The SST official Z-level fallback is valid when the file supplies no ZIP+4 boundary.
 // For mixed local rates, callers must provide ZIP+4 rather than quietly using a low estimate.
 return {rate,source:'ar-sst-2026q4',basis:ext?'zip4':'zip5-unique',resolvedZip:zip};
}
