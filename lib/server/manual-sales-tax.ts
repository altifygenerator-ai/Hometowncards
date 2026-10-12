import {PortalError} from '@/lib/server/portal';
import {quoteStateBaseTax} from '@/lib/server/state-base-tax';
export type CheckoutAddress={
 name:string;line1:string;line2:string;city:string;state:string;postalCode:string;country:'US'
};
export type ManualTaxQuote={
 taxCents:number;rate:number;taxableCents:number;
 source:'state-base-2026-07';
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
/** Full shipping address remains mandatory at payment, but only state code decides tax. */
export async function quoteManualSalesTax(address:CheckoutAddress,subtotalCents:number,shippingCents:number):Promise<ManualTaxQuote>{
 return quoteStateBaseTax(address.state,subtotalCents,shippingCents);
}

