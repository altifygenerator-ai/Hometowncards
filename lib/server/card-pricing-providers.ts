/** Reserved integration interface for licensed pricing sources.
 * No provider is queried by default. eBay seller OAuth alone does NOT grant sold-price history.
 */
import type {ProviderId} from './card-pricing';
export type CardIdentity={
 title:string;sport:string;player:string;team:string;
 year:string;set:string;number:string;variant:string;
 grade:string;condition:string;
};
export type SourceObservation={
 provider:ProviderId;providerRecordId:string;sourceUrl:string;
 title:string;kind:'sold'|'asking'|'guide';
 priceCents:number;shippingCents:number|null;currency:string;
 observedAt:string|null;variant:string;grade:string;conditionNotes:string;
};
export type SourceBatch={provider:ProviderId;observations:SourceObservation[];receivedAt:string;retrievalMethod:string};
export interface PricingSourceAdapter{
 id:ProviderId;
 /** Must only be true with BOTH permitted API access and explicit launch authorization. */
 isReady():boolean;
 fetchVerifiedObservations(card:CardIdentity):Promise<SourceBatch>;
}
function disabled(id:ProviderId):PricingSourceAdapter{
 return {id,isReady:()=>false,async fetchVerifiedObservations(){throw new Error(
  'Pricing adapter '+id+' is not connected. Configure permitted access and complete its integration before enabling.');}};
}
/** Provider slots: adapters remain fail-closed until an approved data-access integration is installed. */
export const pricingAdapters:Partial<Record<ProviderId,PricingSourceAdapter>>={
 ebay_sold:disabled('ebay_sold'),
 sportscardspro:disabled('sportscardspro'),
 collx:disabled('collx'),
 cardmarket:disabled('cardmarket'),
 openai_web:disabled('openai_web')
};
export function configuredPricingAdapters(){
 return Object.values(pricingAdapters).filter((adapter):adapter is PricingSourceAdapter=>!!adapter&&adapter.isReady());
}
