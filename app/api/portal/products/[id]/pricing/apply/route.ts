import {NextRequest} from 'next/server';
import {authorized,db,failure,json,PortalError,audit} from '@/lib/server/portal';
import {evaluateSoldComparables,type Comparable} from '@/lib/server/card-pricing';
export const runtime='nodejs';
export async function POST(req:NextRequest,{params}:{params:Promise<{id:string}>}){
 try{
  // Separate operator release switch. Never automatically apply AI/web prices.
  if(process.env.CARD_PRICING_APPLY_ENABLED!=='true')throw new PortalError('Applying researched prices is not enabled.',503);
  const {sellerId,userId}=await authorized(req,'manage'),{id}=await params;
  if(!/^[a-f\d-]{36}$/i.test(id))throw new PortalError('Invalid listing ID.');
  const data=await req.json() as {runId?:string;confirm?:boolean;expectedSitePriceCents?:number|null};
  if(data.confirm!==true||!data.runId||!/^[a-f\d-]{36}$/i.test(data.runId))throw new PortalError('Select and explicitly approve a research result.');
  const [runs,products]=await Promise.all([
   db<Array<{id:string;status:string;suggested_price_cents:number|null;completed_at:string|null;matched_sales:number}>>(
    'card_price_research?select=id,status,suggested_price_cents,completed_at,matched_sales&seller_id=eq.'+sellerId+'&product_id=eq.'+id+'&id=eq.'+data.runId+'&limit=1'),
   db<Array<{id:string;price_cents:number;price_override_cents:number|null}>>(
    'products?select=id,price_cents,price_override_cents&seller_id=eq.'+sellerId+'&id=eq.'+id+'&limit=1')
  ]);
  const run=runs[0],item=products[0];
  if(!run||!item||run.status!=='ready'||run.suggested_price_cents==null||run.matched_sales<3)throw new PortalError('No verified price recommendation is available.',409);
  if(!run.completed_at||Date.now()-Date.parse(run.completed_at)>30*86400000)throw new PortalError('The pricing research is older than 30 days.',409);
  const comparisons=await db<Comparable[]>('card_price_comparables?select=id,provider,observed_kind,evidence_status,currency,price_cents,shipping_cents,observed_at,match_score,included_in_estimate,card_title,source_url,grade,card_variant&seller_id=eq.'+sellerId+'&run_id=eq.'+run.id+'&limit=250');
  const current=evaluateSoldComparables(comparisons);
  if(!current.ready||current.suggestedPriceCents!==run.suggested_price_cents)
   throw new PortalError('Verified comparable data changed. Recalculate before applying.',409);
  const previous=item.price_override_cents;
  if(data.expectedSitePriceCents!==previous)throw new PortalError('The listing price changed. Refresh and review again.',409);
  const price=run.suggested_price_cents;
  const oldCondition=previous===null?'is.null':'eq.'+previous;
  const updated=await db<Array<{id:string}>>('products?select=id&seller_id=eq.'+sellerId+'&id=eq.'+id+
    '&price_override_cents='+oldCondition,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({
    price_override_cents:price,updated_at:new Date().toISOString(),last_edited_by:userId
  })});
  if(!updated.length)throw new PortalError('Another edit changed this card price. Refresh before retrying.',409);
  await audit(sellerId,userId,'card_price_research_approved',id,
   {site_price_cents:previous,base_price_cents:item.price_cents},
   {site_price_cents:price,researchId:run.id,verified_sales:run.matched_sales});
  return json({ok:true,appliedPriceCents:price,source:'site_only',
    note:'Approved site price override saved. Any eBay listing price remains unchanged.'});
 }catch(e){return failure(e)}
}
