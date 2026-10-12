import {NextRequest,NextResponse} from 'next/server';
import {db,PortalError} from '@/lib/server/portal';
import {estimateShipping,ShippingProfile} from '@/lib/shipping';
import {bonusCount} from '@/lib/rewards';
export const runtime='nodejs';
export async function POST(req:NextRequest){
 const headers={'Cache-Control':'no-store'};
 try{
  const raw=await req.text();if(raw.length>7000)throw new PortalError('Cart is too large.',413);
  const body=JSON.parse(raw) as {lines?:{id:string;quantity:number}[]};
  if(!Array.isArray(body.lines)||!body.lines.length||body.lines.length>50)throw new PortalError('Select some cards first.',400);
  const ids=new Set<string>(),quantities=new Map<string,number>();
  for(const x of body.lines){
   if(!x||typeof x.id!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(x.id)||!Number.isInteger(x.quantity)||x.quantity<1||x.quantity>25||ids.has(x.id))throw new PortalError('Invalid cards or quantities.',400);
   ids.add(x.id);quantities.set(x.id,x.quantity);
  }
  const sellers=await db<Array<{id:string;tracking_required_from_cents:number;insurance_required_from_cents:number}>>('sellers?select=id,tracking_required_from_cents,insurance_required_from_cents&slug=eq.hometown-card-shop&status=eq.approved&limit=1');
  const seller=sellers[0];if(!seller)throw new PortalError('Shop unavailable.',503);
  const filter=[...ids].join(',');
  const [products,profiles]=await Promise.all([
   db<Array<{source_item_id:string;stock:number;status:string;needs_review:boolean;manual_paused:boolean;price_cents:number;price_override_cents:number|null}>>('products?select=source_item_id,stock,status,needs_review,manual_paused,price_cents,price_override_cents&source=eq.ebay&seller_id=eq.'+seller.id+'&source_item_id=in.('+filter+')'),
   db<ShippingProfile[]>('shipping_profiles?select=*&seller_id=eq.'+seller.id+'&active=eq.true')
  ]);
  if(products.length!==ids.size)throw new PortalError('Your cart has unavailable cards.',409);
  let count=0,subtotal=0;
  for(const p of products){
   const qty=quantities.get(p.source_item_id)!;
   if(p.status!=='published'||p.needs_review||p.manual_paused||p.stock<qty)throw new PortalError('A card in your cart is no longer available.',409);
   subtotal+=(p.price_override_cents??p.price_cents)*qty;count+=qty;
  }
  if(!Number.isSafeInteger(subtotal)||subtotal<1)throw new PortalError('Invalid cart amount.',400);
  const gifts=bonusCount(subtotal);
  const options=estimateShipping(profiles,{purchasedQuantity:count,bonusQuantity:gifts,merchandiseSubtotalCents:subtotal},{trackingRequiredFromCents:seller.tracking_required_from_cents,insuranceRequiredFromCents:seller.insurance_required_from_cents});
  return NextResponse.json({subtotalCents:subtotal,freeCards:gifts,options,note:'Seller-set rate estimates; actual postage depends on package dimensions and destination. The shipping charge is confirmed before payment.'},{headers});
 }catch(e){if(!(e instanceof PortalError))console.error('Shipping options error',e);
  return NextResponse.json({error:e instanceof PortalError?e.message:'Shipping options are unavailable.'},{status:e instanceof PortalError?e.code:500,headers});
 }
}
