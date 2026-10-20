import {NextRequest,NextResponse} from 'next/server';
import {PortalError,db} from '@/lib/server/portal';
import {checkoutRpc} from '@/lib/server/checkout-db';
import {stripePost,assertExpectedStripeAccount} from '@/lib/server/stripe';
import {verifyTurnstile} from '@/lib/server/turnstile';
export const runtime='nodejs';export const maxDuration=60;
type Deal={order_id:string;seller_id:string;connected_account_id:string;subtotal_cents:number;shipping_cents:number;platform_fee_cents:number;items:Array<{product_id:string;title:string;unit_price_cents:number;quantity:number}>;shipping_service:string};
const err=(message:string,status=503)=>NextResponse.json({error:message},{status,headers:{'Cache-Control':'no-store'}});
export async function POST(req:NextRequest){
 if(process.env.DEALER_CHECKOUT_ENABLED!=='true'||process.env.STRIPE_CONNECT_WEBHOOK_SECRET===undefined)return err('Dealer checkouts are not open yet.');
 const origin=req.headers.get('origin');if(origin&&new URL(origin).host!==req.nextUrl.host)return err('Origin not accepted',403);
 let order:string|null=null,session:string|null=null,account:string|null=null;
 try{
  const b=await req.json() as {sellerId?:string;lines?:Array<{id:string;quantity:number}>;turnstileToken?:string};
  if(!b.sellerId||!/^[0-9a-f-]{36}$/i.test(b.sellerId)||!Array.isArray(b.lines)||b.lines.length<1||b.lines.length>50)throw new PortalError('Invalid seller deal',400);
  const ids=new Set<string>();
  for(const l of b.lines)if(!l||typeof l.id!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(l.id)||!Number.isInteger(l.quantity)||l.quantity<1||l.quantity>25||ids.has(l.id))throw new PortalError('Invalid cards or quantities',400);else ids.add(l.id);
  await verifyTurnstile(b.turnstileToken,'checkout',req);
  await assertExpectedStripeAccount();
  const detail=await checkoutRpc<Deal>('hcs_begin_dealer_checkout',{p_seller:b.sellerId,p_items:b.lines});
  order=detail.order_id;account=detail.connected_account_id;
  if(!account?.startsWith('acct_'))throw new PortalError('Dealer payment account is unavailable.',503);
  const secret=process.env.STRIPE_SECRET_KEY!;
  const taxSettings=await fetch('https://api.stripe.com/v1/tax/settings',{headers:{Authorization:'Bearer '+secret,'Stripe-Account':account},cache:'no-store'});
  const taxInfo=await taxSettings.json() as {status?:string};
  if(!taxSettings.ok||taxInfo.status!=='active')throw new PortalError('Dealer needs to finish Stripe Tax setup.',409);
  const params=new URLSearchParams();const add=(k:string,v:string|number)=>params.append(k,String(v));
  add('mode','payment');add('client_reference_id',order);
  add('metadata[order_id]',order);add('metadata[seller_id]',detail.seller_id);
  add('payment_intent_data[metadata][order_id]',order);add('payment_intent_data[metadata][seller_id]',detail.seller_id);
  if(detail.platform_fee_cents>0)add('payment_intent_data[application_fee_amount]',detail.platform_fee_cents);
  add('automatic_tax[enabled]','true');
  add('shipping_address_collection[allowed_countries][0]','US');
  add('billing_address_collection','auto');
  add('success_url',req.nextUrl.origin+'/checkout/success?session_id={CHECKOUT_SESSION_ID}');
  add('cancel_url',req.nextUrl.origin+'/cart?checkout=cancelled');
  add('expires_at',Math.ceil(Date.now()/1000)+40*60);
  detail.items.forEach((l,i)=>{add('line_items['+i+'][price_data][currency]','usd');
   add('line_items['+i+'][price_data][unit_amount]',l.unit_price_cents);
   add('line_items['+i+'][price_data][product_data][name]',l.title.slice(0,120));
   add('line_items['+i+'][quantity]',l.quantity);
  });
  if(detail.shipping_cents>0){const i=detail.items.length;
   add('line_items['+i+'][price_data][currency]','usd');
   add('line_items['+i+'][price_data][unit_amount]',detail.shipping_cents);
   add('line_items['+i+'][price_data][product_data][name]',detail.shipping_service||'Dealer shipping');
   add('line_items['+i+'][quantity]',1);
  }
  const s=await stripePost<{id:string;url?:string}>('checkout/sessions',params,'hcs-dealer-'+order,account);
  if(!s.id||!s.url?.startsWith('https://checkout.stripe.com/'))throw new PortalError('Dealer Checkout could not start.',503);
  session=s.id;
  await checkoutRpc('hcs_attach_checkout',{p_order:order,p_session_id:session});
  return NextResponse.json({url:s.url},{headers:{'Cache-Control':'no-store'}});
 }catch(e){
  console.error('Dealer checkout unavailable',e instanceof Error?e.message:e);
  if(session&&account)try{await stripePost('checkout/sessions/'+encodeURIComponent(session)+'/expire',new URLSearchParams(),undefined,account)}catch{}
  if(order)try{await checkoutRpc('hcs_abort_unattached_checkout',{p_order:order})}catch{}
  return err(e instanceof PortalError?e.message:'Unable to start dealer checkout',e instanceof PortalError?e.code:503);
 }
}
