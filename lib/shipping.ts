/** Seller-set shipping rate estimator, intentionally not a carrier postage quote. */
export type ShippingProfile={id:string;name:string;service_label:string;active:boolean;base_cents:number;additional_item_cents:number;max_weight_oz:number;max_items:number;packaging_weight_oz:number;default_item_weight_oz:number;allows_bonus_cards:boolean;free_shipping_threshold_cents:number|null;sort_order:number};
export type ShipmentContents={purchasedQuantity:number;bonusQuantity:number;merchandiseSubtotalCents:number;knownItemWeightOz?:number};
export type ShippingEstimate={profileId:string;profileName:string;service:string;weightOz:number;chargeCents:number;quantity:number};
export function estimateShipping(profiles:ShippingProfile[],contents:ShipmentContents):ShippingEstimate[]{
 const bought=Math.max(0,Math.floor(contents.purchasedQuantity));const bonus=Math.max(0,Math.floor(contents.bonusQuantity));const count=bought+bonus;
 if(!bought||count>100000||!Number.isFinite(count))return [];
 return profiles.filter(x=>x.active).flatMap(p=>{
  if(bonus&&!p.allows_bonus_cards)return [];
  const weight=Number((p.packaging_weight_oz+(contents.knownItemWeightOz??bought*p.default_item_weight_oz)+bonus*p.default_item_weight_oz).toFixed(3));
  if(!Number.isFinite(weight)||weight>Number(p.max_weight_oz)||count>p.max_items)return [];
  const free=p.free_shipping_threshold_cents!==null && contents.merchandiseSubtotalCents>=p.free_shipping_threshold_cents;
  const cents=free?0:p.base_cents+Math.max(0,count-1)*p.additional_item_cents;
  return [{profileId:p.id,profileName:p.name,service:p.service_label,weightOz:weight,chargeCents:cents,quantity:count}];
 }).sort((a,b)=>a.chargeCents-b.chargeCents||a.weightOz-b.weightOz);
}
