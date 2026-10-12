import {NextRequest,NextResponse} from 'next/server';
import {PortalError} from '@/lib/server/portal';
import {parseCheckoutAddress,quoteManualSalesTax} from '@/lib/server/manual-sales-tax';
export const runtime='nodejs';
export const maxDuration=60;
export async function POST(request:NextRequest){
 try{
  const origin=request.headers.get('origin');
  if(origin&&new URL(origin).host!==request.nextUrl.host)throw new PortalError('Origin mismatch.',403);
  const raw=await request.text();
  if(raw.length>4000)throw new PortalError('Address is too long.',413);
  const data=JSON.parse(raw) as {address?:unknown;subtotalCents?:number;shippingCents?:number};
  const address=parseCheckoutAddress(data.address);
  // Estimate only. Checkout ALWAYS recalculates from database-reserved prices.
  const tax=await quoteManualSalesTax(address,Number(data.subtotalCents),Number(data.shippingCents));
  return NextResponse.json({...tax,totalCents:tax.taxableCents+tax.taxCents},
    {headers:{'Cache-Control':'no-store'}});
 }catch(e){
  const status=e instanceof PortalError?e.code:400;
  return NextResponse.json({error:e instanceof PortalError?e.message:'Check the shipping address and try again.'},
   {status,headers:{'Cache-Control':'no-store'}});
 }
}
