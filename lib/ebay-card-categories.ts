/**
 * eBay leaf category IDs for physical trading cards, card lots, complete sets
 * and sealed packs. This intentionally excludes books, cameras, gaming hardware,
 * comics, sleeves, binders and other unrelated merchandise.
 * eBay's authoritative category IDs are stable identifiers, unlike titles.
 */
export const CARD_CATEGORY_IDS=new Set([
 '261328', // Sports trading card singles
 '261329', // Sports trading card lots
 '261330', // Sports trading card sets
 '261331', // Sports sealed trading card packs
 '183050', // Non-sport trading card singles
 '183051', // Non-sport trading card lots
 '183052', // Non-sport trading card sets
 '183053', // Non-sport sealed packs
 '183454', // CCG individual cards
 '183455', // CCG mixed card lots
 '183456', // CCG sealed packs
 '183459', // CCG complete sets
]);
export type EbayCardDisposition='card'|'noncard'|'unknown';
export function classifyEbayCardCategory(categoryId:string):EbayCardDisposition{
 const id=categoryId.trim();
 if(!/^\d{1,9}$/.test(id))return 'unknown';
 return CARD_CATEGORY_IDS.has(id)?'card':'noncard';
}
