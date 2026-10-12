import {PortalError} from '@/lib/server/portal';
import snapshotFile from '@/lib/data/official-ar-2026q4.json';

type SSTSnapshot={
 quarter:string;validFrom:string;validThrough:string;generatedAt:string;
 zip4:Record<string,Array<[number,number,number]>>;
 zip5:Record<string,number>;
};
const snapshot=snapshotFile as unknown as SSTSnapshot;
export type OfficialArkansasRate={
 rate:number;source:'ar-sst-2026q4';basis:'zip4'|'zip5-unique';resolvedZip:string
};

/**
 * State-published tax data, precompiled into a compact immutable file at build-time.
 * No tax provider, large ZIP files or external tax downloads during a customer checkout.
 * Validity and source freshness are checked on every quote.
 */
export async function resolveArkansasSalesTax(postalCode:string):Promise<OfficialArkansasRate>{
 const today=new Date().toISOString().slice(0,10).replace(/-/g,'');
 if(snapshot.quarter!=='2026q4'||today<snapshot.validFrom||today>snapshot.validThrough||
  !snapshot.generatedAt||!snapshot.zip4||Object.keys(snapshot.zip4).length<100)
  throw new PortalError('Current Arkansas tax rates have not been verified for this quarter.',503);
 const match=/^(\d{5})(?:-(\d{4}))?$/.exec(postalCode);
 if(!match)throw new PortalError('Enter a valid ZIP code.',400);
 const [ ,zip,extension]=match;
 const rows=snapshot.zip4[zip]||[];
 let rateParts:number[];
 let basis:OfficialArkansasRate['basis'];
 if(extension){
  const ext=Number(extension);
  rateParts=[...new Set(rows.filter(([low,high])=>low<=ext&&high>=ext).map(row=>row[2]))];
  basis='zip4';
  if(!rateParts.length)throw new PortalError('This Arkansas ZIP+4 could not be found in the verified tax boundaries.',422);
 }else{
  rateParts=[...new Set(rows.map(x=>x[2]))];
  if(!rateParts.length&&snapshot.zip5[zip]!==undefined)rateParts=[snapshot.zip5[zip]];
  basis='zip5-unique';
 }
 if(!rateParts.length)throw new PortalError('This Arkansas ZIP is not present in the current tax boundaries.',422);
 if(rateParts.length>1)throw new PortalError('This ZIP crosses multiple tax jurisdictions. Enter the full ZIP+4 for an accurate sales tax calculation.',422);
 const rate=rateParts[0]/1_000_000;
 if(!Number.isFinite(rate)||rate<0.065||rate>0.16)
  throw new PortalError('The Arkansas sales-tax rate was invalid. Please contact the shop.',503);
 return {rate,source:'ar-sst-2026q4',basis,resolvedZip:postalCode};
}
