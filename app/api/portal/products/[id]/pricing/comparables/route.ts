import {NextRequest} from 'next/server';
import {authorized,db,failure,json,PortalError,safeTerm,audit} from '@/lib/server/portal';
export const runtime='nodejs';
type Params={params:Promise<{id:string}>};
export async function POST(req:NextRequest,{params}:Params){
 try{
  const {sellerId,userId}=await authorized(req,'manage');const {id}=await params;
  if(!/^[a-f0-9-]{36}$/i.test(id))throw new PortalError('Invalid listing ID.');
  const text=await req.text();if(text.length>5000)throw new PortalError('Comparable submission is too large.',413);
  const body=JSON.parse(text) as Record<string,unknown>;
  const runId=safeTerm(body.runId,36);
  if(!/^[a-f0-9-]{36}$/i.test(runId))throw new PortalError('Prepare research before saving comparables.');
  const runs=await db<Array<{id:string;status:string}>>('card_price_research?select=id,status&seller_id=eq.'+sellerId+
   '&product_id=eq.'+id+'&id=eq.'+runId+'&limit=1');
  if(!runs[0])throw new PortalError('Research request not found.',404);
  if(runs[0].status==='cancelled')throw new PortalError('Research is closed.');
  const count=await db<Array<{id:string}>>('card_price_comparables?select=id&seller_id=eq.'+sellerId+
   '&run_id=eq.'+runId+'&provider=eq.manual&limit=21');
  if(count.length>=20)throw new PortalError('No more than twenty manual comparisons per research request.');
  const name=safeTerm(body.cardTitle,250),kind=safeTerm(body.kind,12),link=safeTerm(body.sourceUrl,600);
  const amount=Number(body.priceDollars),currency=safeTerm(body.currency,3).toUpperCase()||'USD';
  const date=safeTerm(body.observedAt,40);
  if(!name)throw new PortalError('Describe the comparable card.');
  if(!['sold','asking','guide'].includes(kind))throw new PortalError('Select sold, asking, or guide value.');
  if(!Number.isFinite(amount)||amount<=0||amount>1000000)throw new PortalError('Invalid price.');
  if(!/^[A-Z]{3}$/.test(currency))throw new PortalError('Use a valid three-letter currency code.');
  if(link){try{const u=new URL(link);if(u.protocol!=='https:')throw new Error();}
   catch{throw new PortalError('Enter a valid https source link.');}}
  const parsed=date?Date.parse(date):NaN;
  if(date&&(!Number.isFinite(parsed)||parsed>Date.now()+86400000))throw new PortalError('Invalid sale or listing date.');
  await db('card_price_comparables',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({
   run_id:runId,seller_id:sellerId,provider:'manual',card_title:name.slice(0,250),
   source_url:link||null,observed_kind:kind,evidence_status:'unverified',
   observed_at:Number.isFinite(parsed)?new Date(parsed).toISOString():null,
   currency,price_cents:Math.round(amount*100),match_score:0,
   included_in_estimate:false,match_reason:'Seller-entered; independent transaction verification required.',
   evidence_json:{entered_by:userId,notes:safeTerm(body.notes,300)}
  })});
  await audit(sellerId,userId,'manual_card_price_reference',id,null,{researchId:runId,kind});
  return json({ok:true,verified:false,message:'Comparison saved as unverified reference; it does not affect the suggested price.'},201);
 }catch(e){return failure(e)}
}
