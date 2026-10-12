import {NextRequest} from 'next/server';import {authorized,db,failure,json,PortalError} from '@/lib/server/portal';import {estimateShipping,ShippingProfile} from '@/lib/shipping';
export async function POST(req:NextRequest){try{
 const {sellerId}=await authorized(req);const body=await req.json() as Record<string,unknown>;
 const purchasedQuantity=Number(body.purchasedQuantity),bonusQuantity=Number(body.bonusQuantity),merchandiseSubtotalCents=Number(body.merchandiseSubtotalCents);
 if(!Number.isInteger(purchasedQuantity)||purchasedQuantity<1||purchasedQuantity>1000||!Number.isInteger(bonusQuantity)||bonusQuantity<0||bonusQuantity>1000||!Number.isInteger(merchandiseSubtotalCents)||merchandiseSubtotalCents<0)throw new PortalError('Enter valid quantities, bonus cards, and subtotal.');
 const [profiles,sellers]=await Promise.all([db<ShippingProfile[]>(`shipping_profiles?select=*&seller_id=eq.${sellerId}&active=eq.true`),db<Array<{tracking_required_from_cents:number;insurance_required_from_cents:number}>>(`sellers?select=tracking_required_from_cents,insurance_required_from_cents&id=eq.${sellerId}&limit=1`)]);
 const seller=sellers[0];
 return json({estimates:estimateShipping(profiles,{purchasedQuantity,bonusQuantity,merchandiseSubtotalCents},{trackingRequiredFromCents:seller?.tracking_required_from_cents??2000,insuranceRequiredFromCents:seller?.insurance_required_from_cents??10000}),note:'Seller-configured estimates only. Not a live postal rate. Confirm packing, postage, and tracking requirements before enabling checkout.'});
}catch(e){return failure(e)}}
