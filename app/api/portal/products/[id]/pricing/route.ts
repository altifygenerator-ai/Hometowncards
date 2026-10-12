import {NextRequest} from 'next/server';
import {authorized,db,failure,json,PortalError} from '@/lib/server/portal';
import {ebaySoldResearchUrl,getPricingSources,evaluateSoldComparables,type Comparable} from '@/lib/server/card-pricing';
export const runtime='nodejs';
type Params={params:Promise<{id:string}>};
type RequestRow={
 id:string;product_id:string;status:string;search_terms:string;
 identity_snapshot:Record<string,unknown>;suggested_price_cents:number|null;
 low_cents:number|null;high_cents:number|null;matched_sales:number;
 confidence:string;rationale:string;source_summary:Record<string,unknown>;
 created_at:string;completed_at:string|null;
};
const isUUID=(x:string)=>/^[a-f\d-]{36}$/i.test(x);
async function productFor(sellerId:string,id:string){
 if(!isUUID(id))throw new PortalError('Invalid card ID.',400);
 const rows=await db<Array<{id:string;title:string;source:string;source_item_id:string}>>(
  'products?select=id,title,source,source_item_id&seller_id=eq.'+sellerId+'&id=eq.'+id+'&limit=1');
 if(!rows[0])throw new PortalError('This card does not belong to your shop.',404);
 return rows[0];
}
export async function GET(req:NextRequest,{params}:Params){
 try{
  const {sellerId}=await authorized(req);const {id}=await params;const product=await productFor(sellerId,id);
  const history=await db<RequestRow[]>('card_price_research?select=*&seller_id=eq.'+sellerId+
   '&product_id=eq.'+id+'&order=created_at.desc&limit=5');
  const run=history[0]||null;
  const comparables=run?await db<Comparable[]>('card_price_comparables?select=id,provider,observed_kind,evidence_status,currency,price_cents,shipping_cents,observed_at,match_score,included_in_estimate,card_title,source_url,grade,card_variant&seller_id=eq.'+sellerId+'&run_id=eq.'+run.id+'&order=created_at.desc&limit=100'):[];
  const evaluation=evaluateSoldComparables(comparables);
  return json({run,history,comparables,evaluation,
    sources:getPricingSources(),soldSearchUrl:ebaySoldResearchUrl(run?.search_terms||product.title),
    lookupsEnabled:process.env.CARD_PRICING_LIVE_LOOKUPS_ENABLED==='true',
    automaticPricingEnabled:false,applyEnabled:process.env.CARD_PRICING_APPLY_ENABLED==='true',
    note:'Research records do not prove that any provider has been connected. Only independently verified sold transactions are eligible. No prices will be changed without explicit dealer approval.'});
 }catch(err){return failure(err)}
}
export async function POST(req:NextRequest,{params}:Params){
 try{
  const {sellerId,userId}=await authorized(req,'manage');const {id}=await params;
  await productFor(sellerId,id);
  const runId=await db<string>('rpc/hcs_prepare_card_price_research',{
   method:'POST',body:JSON.stringify({p_seller:sellerId,p_product:id,p_actor:userId})});
  return json({ok:true,runId,status:'awaiting_sources',
   note:'Research prepared. No external lookups, OpenAI requests, charges or price changes were made.'},201);
 }catch(err){return failure(err)}
}
