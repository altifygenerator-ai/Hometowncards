import {NextRequest,NextResponse} from 'next/server';
import {PortalError} from '@/lib/server/portal';
import {checkoutRpc} from '@/lib/server/checkout-db';
import {stripePost,assertExpectedStripeAccount} from '@/lib/server/stripe';
import {parseCheckoutAddress,quoteManualSalesTax,assertManualTaxCollectionReady} from '@/lib/server/manual-sales-tax';
import {verifyTurnstile} from '@/lib/server/turnstile';
export const runtime='nodejs';
type Line={id:string;quantity:number};
type Reservation={order_id:string;items:{title:string;quantity:number;unit_price_cents:number}[];shipping_cents:number;subtotal_cents:number;bonus_cards:number;total_cents:number;shipping_service:string};
function error(message:string,status=503){return NextResponse.json({error:message},{status,headers:{'Cache-Control':'no-store'}})}
export async function POST(req:NextRequest){
 if(process.env.NEXT_PUBLIC_STORE_LIVE!=='true'||process.env.STRIPE_CHECKOUT_ENABLED!=='true')
  return error('Online checkout is not open yet.');

 if(!process.env.STRIPE_SECRET_KEY||!process.env.STRIPE_WEBHOOK_SECRET)return error('Secure checkout is not configured.');
 const origin=req.headers.get('origin');
 if(origin&&new URL(origin).host!==req.nextUrl.host)return error('Checkout request origin is not allowed.',403);
 let orderId:string|null=null;let sessionId:string|null=null;
 try{
  const body=await req.json() as {lines?:Line[];bonusSport?:string;shippingProfileId?:string;turnstileToken?:string;address?:unknown};
  if(!Array.isArray(body.lines)||body.lines.length<1||body.lines.length>50)
   return error('Please check your cart items.',400);
  const seen=new Set<string>();
  const items=body.lines.map(x=>{
   if(!x||typeof x.id!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(x.id)||!
      Number.isInteger(x.quantity)||x.quantity<1||x.quantity>25||seen.has(x.id))
      throw new PortalError('Invalid shopping cart.',400);
   seen.add(x.id);return {id:x.id,quantity:x.quantity};
  });
  const address=parseCheckoutAddress(body.address);
  assertManualTaxCollectionReady(address);
  await verifyTurnstile(body.turnstileToken,'checkout',req);
  await assertExpectedStripeAccount();

  const reserved=await checkoutRpc<Reservation>('hcs_begin_checkout',{
   p_items:items,p_preferred_sport:body.bonusSport||'Mixed',p_shipping_profile_id:typeof body.shippingProfileId==='string'&&/^[a-f0-9-]{36}$/i.test(body.shippingProfileId)?body.shippingProfileId:null
  });orderId=reserved.order_id;
  const manualTax=await quoteManualSalesTax(address,reserved.subtotal_cents,reserved.shipping_cents);
  await checkoutRpc('hcs_apply_manual_checkout_tax',{
   p_order:orderId,p_shipping:{name:address.name,address:{line1:address.line1,line2:address.line2,city:address.city,state:address.state,postal_code:address.postalCode,country:'US'}},
   p_tax_cents:manualTax.taxCents,p_rate:manualTax.rate,p_source:manualTax.source
  });
  const params=new URLSearchParams();
  const add=(key:string,val:string|number)=>params.append(key,String(val));
  add('mode','payment');add('client_reference_id',orderId);
  add('metadata[order_id]',orderId);add('payment_intent_data[metadata][order_id]',orderId);
  add('success_url',req.nextUrl.origin+'/checkout/success?session_id={CHECKOUT_SESSION_ID}');
  add('cancel_url',req.nextUrl.origin+'/cart?checkout=cancelled');
  // Shipping address is collected and locked on our site BEFORE the tax quote.
  add('billing_address_collection','auto');
  add('automatic_tax[enabled]','false');
  add('expires_at',Math.floor(Date.now()/1000)+30*60);
  // Card supports major wallets where available. Do not enable delayed settlement methods.
  add('payment_method_types[0]','card');
  reserved.items.forEach((item,i)=>{
   add(`line_items[${i}][price_data][currency]`,'usd');
   add(`line_items[${i}][price_data][unit_amount]`,item.unit_price_cents);
   add(`line_items[${i}][price_data][product_data][name]`,item.title.slice(0,120));
   add(`line_items[${i}][quantity]`,item.quantity);
  });
  // Shipping is included in the Arkansas taxable base and charged once here.
  if(reserved.shipping_cents>0){
   add('shipping_options[0][shipping_rate_data][type]','fixed_amount');
   add('shipping_options[0][shipping_rate_data][display_name]',reserved.shipping_service||'Shipping');
   add('shipping_options[0][shipping_rate_data][fixed_amount][currency]','usd');
   add('shipping_options[0][shipping_rate_data][fixed_amount][amount]',reserved.shipping_cents);

  }
  // Customer sees sales tax as a standalone line item at Stripe Checkout.
  if(manualTax.taxCents>0){
   const idx=reserved.items.length;
   add(`line_items[${idx}][price_data][currency]`,'usd');
   add(`line_items[${idx}][price_data][unit_amount]`,manualTax.taxCents);
   add(`line_items[${idx}][price_data][product_data][name]`,'Arkansas sales tax');
   add(`line_items[${idx}][quantity]`,1);
  }
  const session=await stripePost('checkout/sessions',params,'hcs-session-'+orderId);
  if(!session.id||!session.url||!session.url.startsWith('https://checkout.stripe.com/'))
    throw new Error('Stripe did not return a secure hosted checkout URL');
  sessionId=session.id;
  await checkoutRpc('hcs_attach_checkout',{p_order:orderId,p_session_id:session.id});
  return NextResponse.json({url:session.url},{headers:{'Cache-Control':'no-store'}});
 }catch(err){
  console.error('Checkout unavailable',err instanceof Error?err.message:err);
  if(sessionId){try{await stripePost('checkout/sessions/'+encodeURIComponent(sessionId)+'/expire',new URLSearchParams())}catch{}}
  if(orderId){try{await checkoutRpc('hcs_abort_unattached_checkout',{p_order:orderId})}catch{}}
  return error(err instanceof PortalError&&err.code===400?err.message:'A card or shipping option is unavailable. Please check your cart.',err instanceof PortalError&&err.code===400?400:503);
 }
}
