import {NextRequest} from 'next/server';import {authorized,db,failure,json,PortalError} from '@/lib/server/portal';import {estimateShipping,ShippingProfile} from '@/lib/shipping';
export async function POST(req:NextRequest){try{
 const {sellerId}=await authorized(req);const body=await req.json() as Record<string,unknown>;
 const purchasedQuantity=Number(body.purchasedQuantity),bonusQuantity=Number(body.bonusQuantity),merchandiseSubtotalCents=Number(body.merchandiseSubtotalCents);
 if(!Number.isInteger(purchasedQuantity)||purchasedQuantity<1||purchasedQuantity>1000||!Number.isInteger(bonusQuantity)||bonusQuantity<0||bonusQuantity>1000||!Number.isInteger(merchandiseSubtotalCents)||merchandiseSubtotalCents<0)throw new PortalError('Enter valid quantities, bonus cards, and subtotal.');
 const profiles=await db<ShippingProfile[]>(`shipping_profiles?select=*&seller_id=eq.${sellerId}&active=eq.true`);
 return json({estimates:estimateShipping(profiles,{purchasedQuantity,bonusQuantity,merchandiseSubtotalCents}),note:'Seller-configured estimates only. Not a live postal rate. Confirm packing, postage, and tracking requirements before enabling checkout.'});
}catch(e){return failure(e)}}
