/** Server-only ingestion seam for licensed sold-data providers.
 * No route exposes this function to browsers; disconnected providers always refuse requests.
 * The future adapter must obtain actual completed-sale records through its permitted API.
 */
import {db,PortalError} from '@/lib/server/portal';
import {pricingAdapters,type SourceBatch} from '@/lib/server/card-pricing-providers';
import {recalculateCardPricing} from '@/lib/server/card-pricing-workflow';
import type {ProviderId} from '@/lib/server/card-pricing';

const hosts:Partial<Record<ProviderId,string[]>>={
 ebay_sold:['ebay.com','ebay.co.uk','ebay.ca','ebayimg.com'],
 sportscardspro:['sportscardspro.com'],
 collx:['collx.app'],
 cardmarket:['cardmarket.com']
};
function approvedLink(source:ProviderId,raw:string){
 try{
  const u=new URL(raw);
  if(u.protocol!=='https:'||u.username||u.password)return false;
  const domains=hosts[source]||[];
  return domains.some(domain=>u.hostname===domain||u.hostname.endsWith('.'+domain));
 }catch{return false}
}
function cleanText(text:string,max:number){return typeof text==='string'?text.trim().slice(0,max):'';}
/** To be called only by a vetted, authorized provider adapter after real source connection. */
export async function ingestLicensedCardPricingBatch(sellerId:string,runId:string,batch:SourceBatch){
 if(process.env.CARD_PRICING_LIVE_LOOKUPS_ENABLED!=='true')throw new PortalError('Live pricing research is disabled.',503);
 if(!['ebay_sold','sportscardspro','collx','cardmarket'].includes(batch.provider))
  throw new PortalError('Only authorized provider receipts can enter verified pricing.',403);
 const adapter=pricingAdapters[batch.provider];
 if(!adapter?.isReady())throw new PortalError('This provider has not been approved or connected.',503);
 if(!/^[a-f\d-]{36}$/i.test(sellerId)||!/^[a-f\d-]{36}$/i.test(runId))throw new PortalError('Invalid research identifiers.');
 const runs=await db<Array<{id:string;status:string}>>('card_price_research?select=id,status&seller_id=eq.'+sellerId+'&id=eq.'+runId+'&limit=1');
 if(!runs[0]||['cancelled','failed'].includes(runs[0].status))throw new PortalError('Research request not available.',404);
 if(!Array.isArray(batch.observations)||batch.observations.length<1||batch.observations.length>100)throw new PortalError('Invalid provider batch.');
 const rows=batch.observations.map(entry=>{
  if(entry.provider!==batch.provider)throw new PortalError('Mixed provider batch not permitted.');
  if(!cleanText(entry.providerRecordId,180))throw new PortalError('Missing provider transaction ID.');
  if(!approvedLink(batch.provider,entry.sourceUrl))throw new PortalError('Invalid receipt host for this provider.');
  const value=Number(entry.priceCents),score=Number(entry.matchScore);
  if(!Number.isSafeInteger(value)||value<1||value>100000000||!Number.isFinite(score)||score<0||score>1)
   throw new PortalError('Invalid price or card identity match.');
  if(!['sold','asking','guide'].includes(entry.kind))throw new PortalError('Invalid observation type.');
  const time=entry.observedAt?Date.parse(entry.observedAt):NaN;
  if(entry.observedAt&&(!Number.isFinite(time)||time>Date.now()))throw new PortalError('Invalid sale date.');
  const currency=cleanText(entry.currency,3).toUpperCase();
  if(!/^[A-Z]{3}$/.test(currency))throw new PortalError('Currency missing.');
  const confirmed=entry.kind==='sold'&&entry.transactionStatus==='completed'&&Number.isFinite(time);
  // Matching year, set, card number, variant, grade and condition must be adapter-validated.
  const eligible=confirmed&&currency==='USD'&&score>=.9&&time>=Date.now()-365*86400000;
  return {run_id:runId,seller_id:sellerId,provider:batch.provider,provider_record_id:cleanText(entry.providerRecordId,180),
   source_url:entry.sourceUrl,card_title:cleanText(entry.title,250),observed_kind:entry.kind,
   evidence_status:confirmed?'provider_verified':'reported',
   observed_at:Number.isFinite(time)?new Date(time).toISOString():null,
   currency,price_cents:value,shipping_cents:entry.shippingCents==null?null:Number(entry.shippingCents),
   grade:cleanText(entry.grade,100),card_variant:cleanText(entry.variant,120),
   condition_notes:cleanText(entry.conditionNotes,300),match_score:score,
   match_reason:cleanText(entry.matchReason,350),
   included_in_estimate:eligible,
   evidence_json:{retrievalMethod:cleanText(batch.retrievalMethod,120),
     receivedAt:batch.receivedAt,transactionStatus:entry.transactionStatus}
  };
 });
 await db('card_price_comparables?on_conflict=run_id%2Cprovider%2Cprovider_record_id',{
  method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(rows)});
 return recalculateCardPricing(sellerId,runId);
}
