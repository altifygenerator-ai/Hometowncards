import {NextRequest} from 'next/server';
import {authorized,db,failure,json,PortalError} from '@/lib/server/portal';
import {recalculateCardPricing} from '@/lib/server/card-pricing-workflow';
export const runtime='nodejs';
export async function POST(req:NextRequest,{params}:{params:Promise<{id:string}>}){
 try{
  const {sellerId}=await authorized(req,'manage'),{id}=await params;
  if(!/^[a-f\d-]{36}$/i.test(id))throw new PortalError('Invalid listing ID.');
  const body=await req.json() as {runId?:string};
  if(!body.runId||!/^[a-f\d-]{36}$/i.test(body.runId))throw new PortalError('Research request not selected.');
  const requests=await db<Array<{id:string}>>('card_price_research?select=id&seller_id=eq.'+sellerId+
   '&product_id=eq.'+id+'&id=eq.'+body.runId+'&limit=1');
  if(!requests[0])throw new PortalError('Research request not found.',404);
  const result=await recalculateCardPricing(sellerId,body.runId);
  return json({ok:true,evaluation:result,note:result.ready?
   'Proposal calculated; no listing price was changed.':'There are not enough verifiable completed sales to support a price.'});
 }catch(e){return failure(e)}
}
