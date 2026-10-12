/** Pricing provider contracts and strict comparable-sales evaluation.
 * No scraping, API calls, or paid research occurs in this module.
 * Each provider adapter must independently verify its sale data and legal API access.
 */
export type ProviderId='ebay_sold'|'sportscardspro'|'collx'|'cardmarket'|'openai_web'|'manual'|'other';
export type PriceSource={id:ProviderId;name:string;kind:'verified-sales-candidate'|'price-guide'|'research-lead'|'manual';connection:'not_connected'|'configured_but_disabled'|'ready_for_adapter';note:string;homepage:string};
export type Comparable={
 id:string;provider:ProviderId;observed_kind:'sold'|'asking'|'guide';
 evidence_status:'provider_verified'|'reported'|'unverified';
 currency:string;price_cents:number;shipping_cents:number|null;
 observed_at:string|null;match_score:number;included_in_estimate:boolean;
 card_title:string;source_url:string|null;grade:string;card_variant:string;
};
export type PricingResult={ready:boolean;suggestedPriceCents:number|null;lowCents:number|null;highCents:number|null;confidence:'insufficient'|'medium'|'high';matchedSales:number;eligibleIds:string[];explanation:string};
const timeWindowDays=365;
const validSaleProvider=new Set<ProviderId>(['ebay_sold','sportscardspro','cardmarket','collx']);
function safeDate(s:string|null){const t=s?Date.parse(s):NaN;return Number.isFinite(t)?t:null}
export function getPricingSources():PriceSource[]{
 const enabled=process.env.CARD_PRICING_LIVE_LOOKUPS_ENABLED==='true';
 const status=(key:string):PriceSource['connection']=>process.env[key]?
    enabled?'ready_for_adapter':'configured_but_disabled':'not_connected';
 return [
  {id:'ebay_sold',name:'eBay sold research',kind:'verified-sales-candidate',connection:status('EBAY_MARKETPLACE_INSIGHTS_TOKEN'),homepage:'https://www.ebay.com/sh/research',note:'Verified sold-price API requires separate approved access. eBay seller OAuth alone is not enough.'},
  {id:'sportscardspro',name:'SportsCardsPro',kind:'price-guide',connection:status('SPORTSCARDSPRO_API_KEY'),homepage:'https://www.sportscardspro.com/',note:'Licensed pricing API/access required. Guide values are not individual confirmed sales.'},
  {id:'collx',name:'CollX',kind:'price-guide',connection:status('COLLX_DATA_ACCESS_TOKEN'),homepage:'https://www.collx.app/',note:'Requires authorized data integration; no public third-party pricing API assumed.'},
  {id:'cardmarket',name:'Cardmarket',kind:'price-guide',connection:status('CARDMARKET_API_KEY'),homepage:'https://www.cardmarket.com/',note:'Provider restrictions and region-specific market. Guide prices must remain separate from confirmed sales.'},
  {id:'openai_web',name:'OpenAI web research',kind:'research-lead',connection:status('OPENAI_API_KEY'),homepage:'https://platform.openai.com/docs/guides/tools-web-search',note:'Web search citations can surface leads, but search result snippets are not verified transaction receipts.'},
  {id:'manual',name:'Seller-entered comparisons',kind:'manual',connection:'not_connected',homepage:'https://www.ebay.com/',note:'Manually entered evidence stays unverified until independently confirmed.'}
 ];
}
function percentile(sorted:number[],fraction:number){
 const position=(sorted.length-1)*fraction;
 const low=Math.floor(position),high=Math.ceil(position);
 return Math.round(sorted[low]+(sorted[high]-sorted[low])*(position-low));
}
export function evaluateSoldComparables(items:Comparable[],now=Date.now()):PricingResult{
 // Only corroborated, recent, high-match actual sold prices are candidates.
 const eligible=items.filter(x=>validSaleProvider.has(x.provider)&&x.included_in_estimate&&
  x.observed_kind==='sold'&&x.evidence_status==='provider_verified'&&x.currency==='USD'&&
  Number.isSafeInteger(x.price_cents)&&x.price_cents>0&&Number(x.match_score)>=0.9&&
  safeDate(x.observed_at)!==null&&safeDate(x.observed_at)!<=now&&
  safeDate(x.observed_at)!>=now-timeWindowDays*24*60*60*1000
 );
 if(eligible.length<3)return {ready:false,suggestedPriceCents:null,lowCents:null,highCents:null,
  confidence:'insufficient',matchedSales:eligible.length,eligibleIds:eligible.map(x=>x.id),
  explanation:'At least three recent, verified sold transactions matching this card are needed. Asking prices, guide values and web snippets are excluded.'};
 const original=eligible.map(x=>x.price_cents).sort((a,b)=>a-b);
 const reference=percentile(original,.5);
 // Reject gross mismatches and price spikes; require three valid examples even afterward.
 const filtered=eligible.filter(x=>x.price_cents>=reference*.4&&x.price_cents<=reference*2.5);
 if(filtered.length<3)return {ready:false,suggestedPriceCents:null,lowCents:null,highCents:null,
  confidence:'insufficient',matchedSales:filtered.length,eligibleIds:filtered.map(x=>x.id),
  explanation:'Price outliers left fewer than three comparable sales; manual review is required.'};
 const prices=filtered.map(x=>x.price_cents).sort((a,b)=>a-b);
 const median=percentile(prices,.5);
 // User-facing default shop price rounds to nearest dollar, never invents sub-dollar precision.
 const suggested=Math.max(100,Math.round(median/100)*100);
 const low=Math.min(suggested,percentile(prices,.25)),high=Math.max(suggested,percentile(prices,.75));
 const sources=new Set(filtered.map(x=>x.provider));
 const confidence:PricingResult['confidence']=filtered.length>=6&&sources.size>=2?'high':'medium';
 return {ready:true,suggestedPriceCents:suggested,lowCents:low,highCents:high,confidence,
  matchedSales:filtered.length,eligibleIds:filtered.map(x=>x.id),
  explanation:`Median of ${filtered.length} verified USD sold transactions within 365 days, matching grade/variant criteria, after excluding outliers. ${sources.size} connected source(s). Prices exclude separately billed shipping. Dealer approval required.`};
}
export function ebaySoldResearchUrl(terms:string){
 return 'https://www.ebay.com/sch/i.html?_nkw='+encodeURIComponent(terms.slice(0,300))+'&LH_Sold=1&LH_Complete=1';
}
