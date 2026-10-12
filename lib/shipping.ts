/** Per-dealer configured postage templates; not a live carrier quote. */
export type ShippingClass='economy'|'tracked'|'insured';
export type ShippingProfile={id:string;name:string;service_label:string;active:boolean;base_cents:number;additional_item_cents:number;max_weight_oz:number;max_items:number;packaging_weight_oz:number;default_item_weight_oz:number;allows_bonus_cards:boolean;free_shipping_threshold_cents:number|null;sort_order:number;shipping_class:ShippingClass;tracking_included:boolean;insurance_coverage_cents:number;min_order_value_cents:number|null;max_order_value_cents:number|null};
export type ShipmentContents={purchasedQuantity:number;bonusQuantity:number;merchandiseSubtotalCents:number;knownItemWeightOz?:number};
export type ShippingLimits={trackingRequiredFromCents:number;insuranceRequiredFromCents:number};
export type ShippingEstimate={profileId:string;profileName:string;service:string;weightOz:number;chargeCents:number;quantity:number;shippingClass:ShippingClass;tracked:boolean;insuranceCoverageCents:number};
export const defaultShippingLimits:ShippingLimits={trackingRequiredFromCents:2000,insuranceRequiredFromCents:10000};
export function estimateShipping(profiles:ShippingProfile[],contents:ShipmentContents,limits:ShippingLimits=defaultShippingLimits):ShippingEstimate[]{
 const bought=Math.max(0,Math.floor(contents.purchasedQuantity)),bonus=Math.max(0,Math.floor(contents.bonusQuantity)),count=bought+bonus,subtotal=contents.merchandiseSubtotalCents;
 if(!bought||count>100000||!Number.isFinite(count)||!Number.isSafeInteger(subtotal)||subtotal<1)return [];
 return profiles.filter(x=>x.active).flatMap(p=>{
  if(bonus&&!p.allows_bonus_cards)return [];
  const weight=Number((Number(p.packaging_weight_oz)+(contents.knownItemWeightOz??bought*Number(p.default_item_weight_oz))+bonus*Number(p.default_item_weight_oz)).toFixed(3));
  if(!Number.isFinite(weight)||weight>Number(p.max_weight_oz)||count>p.max_items)return [];
  if(p.min_order_value_cents!==null&&subtotal<p.min_order_value_cents)return [];
  if(p.max_order_value_cents!==null&&subtotal>p.max_order_value_cents)return [];
  if(p.shipping_class==='economy'&&(p.tracking_included||weight>3.5))return [];
  if(p.shipping_class!=='economy'&&!p.tracking_included)return [];
  if(subtotal>=limits.trackingRequiredFromCents&&!p.tracking_included)return [];
  if(subtotal>limits.insuranceRequiredFromCents&&Number(p.insurance_coverage_cents)<subtotal)return [];
  const free=p.free_shipping_threshold_cents!==null&&subtotal>=p.free_shipping_threshold_cents;
  const cents=free?0:Number(p.base_cents)+Math.max(0,count-1)*Number(p.additional_item_cents);
  return [{profileId:p.id,profileName:p.name,service:p.service_label,weightOz:weight,chargeCents:cents,quantity:count,shippingClass:p.shipping_class,tracked:p.tracking_included,insuranceCoverageCents:p.insurance_coverage_cents}];
 }).sort((a,b)=>a.chargeCents-b.chargeCents||a.weightOz-b.weightOz);
}
