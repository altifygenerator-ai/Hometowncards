import {db,PortalError} from '@/lib/server/portal';
import {evaluateSoldComparables,type Comparable} from '@/lib/server/card-pricing';
type Run={id:string;seller_id:string;product_id:string;status:string};
export async function recalculateCardPricing(sellerId:string,runId:string){
 const rows=await db<Run[]>('card_price_research?select=id,seller_id,product_id,status&seller_id=eq.'+sellerId+
  '&id=eq.'+runId+'&limit=1');
 const run=rows[0];if(!run)throw new PortalError('Research request unavailable.',404);
 if(run.status==='cancelled')throw new PortalError('Research request was cancelled.');
 const comparisons=await db<Comparable[]>('card_price_comparables?select=id,provider,observed_kind,evidence_status,currency,price_cents,shipping_cents,observed_at,match_score,included_in_estimate,card_title,source_url,grade,card_variant&seller_id=eq.'+sellerId+'&run_id=eq.'+runId+'&limit=250');
 const result=evaluateSoldComparables(comparisons);
 if(!result.ready){
  await db('card_price_research?id=eq.'+runId+'&seller_id=eq.'+sellerId,{
   method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({
    status:'insufficient_sales',suggested_price_cents:null,low_cents:null,high_cents:null,
    matched_sales:result.matchedSales,confidence:'insufficient',rationale:result.explanation,
    source_summary:{verifiedSold:result.matchedSales,asOf:new Date().toISOString()},updated_at:new Date().toISOString()
   })});
  return result;
 }
 await db('rpc/hcs_record_card_price_recommendation',{method:'POST',body:JSON.stringify({
  p_seller:sellerId,p_run:runId,p_price:result.suggestedPriceCents,
  p_low:result.lowCents,p_high:result.highCents,p_count:result.matchedSales,
  p_confidence:result.confidence,p_rationale:result.explanation,
  p_source_summary:{providerCount:new Set(comparisons.filter(x=>result.eligibleIds.includes(x.id)).map(x=>x.provider)).size,
   verifiedSold:result.matchedSales,asOf:new Date().toISOString(),comparableIds:result.eligibleIds}
 })});
 return result;
}
