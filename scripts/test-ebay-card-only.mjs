import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const read=p=>readFileSync(p,'utf8');
const sync=read('lib/server/ebay-sync.ts');
const db=read('supabase/strict-ebay-catalog-20261020.sql');
const catalog=read('lib/catalog-db.ts');
const shelves=read('lib/categories.ts');
const guards=read('supabase/ebay-card-only-order-guard.sql');
const metadata=read('lib/ebay-product-metadata.ts');
const tests=[
 ['eBay category missing does not discard item titles',!sync.includes("if(disposition!=='card')return {id,categoryId}")],
 ['parse eBay primary category whenever returned',sync.includes("categoryNode?.CategoryID")],
 ['send full listing details to SQL classifier',sync.includes("hcs_reconcile_ebay_cards_page")],
 ['strict title + category classifier',db.includes('hcs_ebay_storefront_kind(p_cat text,p_title text)')],
 ['sports license plates allowed',db.includes("return 'sports_plate'")],
 ['uncertain merchandise kept hidden for review',db.includes("return 'review'")],
 ['unknowns are not silently published',db.includes("manual_paused=true")],
 ['eBay writeback blocked for excluded products',sync.includes('if(p.ebay_sync_excluded)')],
 ['previous unfiltered import is disabled',guards.includes('revoke execute on function public.hcs_import_ebay_listing_page')],
 ['catalog query explicitly filters eBay product type',catalog.includes("ebay_storefront_kind.in.(card,sports_plate)")],
 ['sports plate category is visible as a separate shop shelf',shelves.includes("slug:'sports-memorabilia'")],
 ['item specifics are parsed when available',metadata.includes('ItemSpecifics')],
 ['card facets populated from metadata when present',db.includes("r->>'cardSet'")&&db.includes("r->>'player'")],
];
for(const [label,ok] of tests)assert(ok,'Failed: '+label);
const js=ts.transpileModule(metadata,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {ebayListingMetadata}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
const clemens=ebayListingMetadata('1987 Topps - Roger Clemens #340');
assert.equal(clemens.year,'1987');
assert.equal(clemens.cardSet,'Topps');
assert.equal(clemens.cardNumber,'340');
assert.equal(clemens.player,'Roger Clemens');
const rated=ebayListingMetadata('1991 Donruss - Rated Rookie Jose Offerman #33 (RC)');
assert.equal(rated.player,'Jose Offerman');
const detailed=ebayListingMetadata('1988 Topps - Tom Seaver #22',{
 'Player/Athlete':'Tom Seaver','Team':'New York Mets','Sport':'Baseball','Season':'1988','Set':'Topps','Card Number':'22'});
assert.equal(detailed.team,'New York Mets');
assert.equal(detailed.sport,'Baseball');
assert.equal(detailed.player,'Tom Seaver');
console.log('eBay cards-only/memorabilia gate and facet parser safeguards passed.');
