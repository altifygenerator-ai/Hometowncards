import {PortalError} from '@/lib/server/portal';
import {resolveArkansasSalesTax} from '@/lib/server/arkansas-sst';
export type CheckoutAddress={
 name:string;line1:string;line2:string;city:string;state:string;postalCode:string;country:'US'
};
export type ManualTaxQuote={
 taxCents:number;rate:number;taxableCents:number;
 source:'ar-sst-2026q4'|'outside-arkansas-not-registered';
 description:string;
};
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
export async function quoteManualSalesTax(address:CheckoutAddress,subtotalCents:number,shippingCents:number):Promise<ManualTaxQuote>{
 validateAmounts(subtotalCents,shippingCents);
 const taxableCents=subtotalCents+shippingCents;
 // Founder-only: no out-of-state nexus currently declared. Review if sales cross remote thresholds.
 if(address.state!=='AR')return {taxCents:0,rate:0,taxableCents,
  source:'outside-arkansas-not-registered',description:'No Arkansas sales tax applies to deliveries outside Arkansas.'};
 const result=await resolveArkansasSalesTax(address.postalCode);
 return {
  taxCents:Math.round(taxableCents*result.rate),rate:result.rate,taxableCents,
  source:result.source,
  description:'Arkansas state, county and applicable city sales tax ('+result.basis+')'
 };
}
/** A tax permit and a rate lookup are independent requirements. Never invent a permit. */
export function assertManualTaxCollectionReady(address:CheckoutAddress){
 if(address.state==='AR'&&process.env.ARKANSAS_SALES_TAX_REGISTERED!=='true')
  throw new PortalError('Arkansas sales-tax registration is required before collecting sales tax on paid orders.',503);
}
