import {NextRequest,NextResponse} from 'next/server';
import {PortalError} from '@/lib/server/portal';
import {quoteStateBaseTax} from '@/lib/server/state-base-tax';
export const runtime='nodejs';
export const maxDuration=60;
export async function POST(request:NextRequest){
 try{
  const origin=request.headers.get('origin');
  if(origin&&new URL(origin).host!==request.nextUrl.host)throw new PortalError('Origin mismatch.',403);
  const raw=await request.text();
  if(raw.length>4000)throw new PortalError('Address is too long.',413);
  const data=JSON.parse(raw) as {state?:unknown;subtotalCents?:number;shippingCents?:number};
  // Rate preview uses the state code only. Shipping address is validated in paid checkout.
  if(typeof data.state!=='string')throw new PortalError('Choose a state first.',400);
  // Estimate only. Checkout ALWAYS recalculates from database-reserved prices.
  const tax=quoteStateBaseTax(data.state,Number(data.subtotalCents),Number(data.shippingCents));
  return NextResponse.json({...tax,totalCents:tax.taxableCents+tax.taxCents},
    {headers:{'Cache-Control':'no-store'}});
 }catch(e){
  const status=e instanceof PortalError?e.code:400;
  return NextResponse.json({error:e instanceof PortalError?e.message:'Choose a valid delivery state and try again.'},
   {status,headers:{'Cache-Control':'no-store'}});
 }
}
