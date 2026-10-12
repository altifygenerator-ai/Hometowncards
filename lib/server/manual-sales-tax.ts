import {PortalError} from '@/lib/server/portal';

export type CheckoutAddress={
 name:string;line1:string;line2:string;city:string;state:string;postalCode:string;country:'US'
};
export type ManualTaxQuote={
 taxCents:number;rate:number;taxableCents:number;
 source:'ziptax-address-v60'|'outside-arkansas-not-registered';
 description:string;
};

/** Buyer address is collected on our site; Stripe only collects payment/billing details. */
export function parseCheckoutAddress(value:unknown):CheckoutAddress{
 if(!value||typeof value!=='object'||Array.isArray(value))throw new PortalError('Enter a complete shipping address.',400);
 const input=value as Record<string,unknown>;
 const read=(key:string,max:number)=>typeof input[key]==='string'?input[key].trim().replace(/\s+/g,' ').slice(0,max):'';
 const address:CheckoutAddress={
  name:read('name',120),line1:read('line1',160),line2:read('line2',90),
  city:read('city',85),state:read('state',2).toUpperCase(),
  postalCode:read('postalCode',10),country:'US'
 };
 if(address.name.length<2||address.line1.length<5||address.city.length<2||
  !/^[A-Z]{2}$/.test(address.state)||!/^\d{5}(-\d{4})?$/.test(address.postalCode))
  throw new PortalError('Enter your name, street address, city, two-letter state and ZIP code.',400);
 if(input.country&&input.country!=='US')throw new PortalError('We currently ship within the United States.',400);
 return address;
}
function validateAmounts(subtotalCents:number,shippingCents:number){
 if(!Number.isSafeInteger(subtotalCents)||subtotalCents<1||subtotalCents>50_000_000||
    !Number.isSafeInteger(shippingCents)||shippingCents<0||shippingCents>100_000)
  throw new PortalError('Invalid merchandise or shipping amount.',400);
}
/** The tax quote is recomputed on the server using RESERVED DB prices before charging. */
export async function quoteManualSalesTax(address:CheckoutAddress,subtotalCents:number,shippingCents:number):Promise<ManualTaxQuote>{
 validateAmounts(subtotalCents,shippingCents);
 const taxableCents=subtotalCents+shippingCents;
 if(address.state!=='AR')return {taxCents:0,rate:0,taxableCents,
  source:'outside-arkansas-not-registered',description:'No Arkansas sales tax applies to this delivery address.'};
 const key=process.env.ZIPTAX_API_KEY;
 if(!key)throw new PortalError('Arkansas address-based sales-tax lookup is not configured yet.',503);
 const lookup=new URL('https://api.zip-tax.com/request/v60');
 lookup.searchParams.set('address',[address.line1,address.line2,address.city,address.state,address.postalCode].filter(Boolean).join(', '));
 let result:{
  metadata?:{response?:{code?:number}};
  taxSummaries?:Array<{taxType?:string;rate?:number}>;
  addressDetail?:{normalizedAddress?:string}
 };
 try{
  const response=await fetch(lookup,{headers:{'X-API-KEY':key},cache:'no-store',signal:AbortSignal.timeout(8000)});
  if(!response.ok)throw new Error('Tax lookup HTTP '+response.status);
  result=await response.json();
 }catch{
  throw new PortalError('Unable to verify the delivery-address tax rate. Please try again.',503);
 }
 const taxRate=result.taxSummaries?.find(x=>x.taxType==='SALES_TAX')?.rate;
 if(result.metadata?.response?.code!==100||typeof taxRate!=='number'||!Number.isFinite(taxRate)||
  taxRate<0.065||taxRate>0.16)
  throw new PortalError('Could not verify the correct Arkansas city and county sales taxes for this address.',422);
 const normalized=result.addressDetail?.normalizedAddress||'';
 // A geocoded address that resolves to a different state must not be taxed using Arkansas rates.
 if(!new RegExp('(?:,|\\s)AR(?:\\s|,|$)','i').test(normalized)||
    !normalized.includes(address.postalCode.slice(0,5)))
  throw new PortalError('Tax lookup could not confirm the Arkansas delivery address. Please correct the address.',422);
 return {
  taxCents:Math.round(taxableCents*taxRate),rate:taxRate,taxableCents,
  source:'ziptax-address-v60',description:'Arkansas state, county and applicable city sales tax'
 };
}
/** A state sales tax permit is an actual registration, not a Stripe Tax feature flag. */
export function assertManualTaxCollectionReady(address:CheckoutAddress){
 if(address.state==='AR'&&process.env.ARKANSAS_SALES_TAX_REGISTERED!=='true')
  throw new PortalError('Arkansas sales-tax registration must be completed before paid checkout for Arkansas deliveries.',503);
}
