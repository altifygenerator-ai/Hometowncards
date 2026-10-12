import {PortalError} from '@/lib/server/portal';

// Statewide general sales/use tax base rates as of July 1, 2026.
// No city, county, district or ZIP+4 calculation. Review rates at least quarterly.
// Source: https://taxfoundation.org/data/all/state/2026-sales-tax-rates-midyear/
// Some states impose a separate tax structure (e.g. HI GET, NM GRT); this is
// a deliberately simplified storefront estimate, not a tax compliance engine.
const STATE_BASE_PERCENT = {
 AL:4, AK:0, AZ:5.6, AR:6.5, CA:7.25, CO:2.9, CT:6.35,
 DE:0, FL:6, GA:4, HI:4, ID:6, IL:6.25, IN:7, IA:6,
 KS:6.5, KY:6, LA:5, ME:5.5, MD:6, MA:6.25, MI:6,
 MN:6.875, MS:7, MO:4.225, MT:0, NE:5.5, NV:6.85,
 NH:0, NJ:6.625, NM:4.875, NY:4, NC:4.75, ND:5,
 OH:5.75, OK:4.5, OR:0, PA:6, RI:7, SC:6, SD:4.2,
 TN:7, TX:6.25, UT:6.1, VT:6, VA:5.3, WA:6.5,
 WV:6, WI:5, WY:4, DC:6,
} as const;
export type USStateCode=keyof typeof STATE_BASE_PERCENT;
export const STATE_TAX_SOURCE='state-base-2026-07';
export function getStateBaseRate(state:string):number{
 const normalized=state.trim().toUpperCase();
 if(!Object.prototype.hasOwnProperty.call(STATE_BASE_PERCENT,normalized))
  throw new PortalError('Choose a valid US state for tax calculation.',400);
 return STATE_BASE_PERCENT[normalized as USStateCode]/100;
}
export function quoteStateBaseTax(state:string,subtotalCents:number,shippingCents:number){
 if(!Number.isSafeInteger(subtotalCents)||subtotalCents<1||subtotalCents>50_000_000||
    !Number.isSafeInteger(shippingCents)||shippingCents<0||shippingCents>100_000)
  throw new PortalError('Invalid merchandise or shipping amount.',400);
 const code=state.trim().toUpperCase();
 const rate=getStateBaseRate(code);
 const taxableCents=subtotalCents+shippingCents;
 return {
  taxCents:Math.round(taxableCents*rate),rate,taxableCents,
  source:STATE_TAX_SOURCE as typeof STATE_TAX_SOURCE,description:code+' statewide base tax ('+(rate*100)+'%)',
  state:code,
 };
}
