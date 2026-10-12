import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const classes=readFileSync('lib/ebay-card-categories.ts','utf8');
const sync=readFileSync('lib/server/ebay-sync.ts','utf8');
const db=readFileSync('supabase/ebay-card-category-filter.sql','utf8');
const guard=readFileSync('supabase/ebay-card-only-order-guard.sql','utf8');
const categories=new Set([...classes.matchAll(/'(\d{6})',?\s*\/\//g)].map(x=>x[1]));
for(const code of ['261328','261329','261330','261331','183050','183051','183052','183053','183454','183455','183456','183459']){
 assert(categories.has(code),'Missing verified trading-card category '+code);
 assert(db.includes("'"+code+"'"),'Database does not allow category '+code);
}
for(const code of ['183440','183054','123456','261332',''])assert(!categories.has(code),'Forbidden category '+code);
assert(sync.includes("categoryNode?.CategoryID"),'eBay import must read real category ID');
assert(sync.includes("if(disposition!=='card')return {id,categoryId}"),'Unknown and non-card imports must not be sent as products');
assert(sync.includes("hcs_reconcile_ebay_cards_page"),'Must use card-only database reconciliation');
assert(sync.includes("if(p.ebay_sync_excluded)"),'Never write back rejected non-cards to eBay');
assert(db.includes("source='ebay'")&&db.includes("status='paused'")&&db.includes('manual_paused=true'),'Must pause only related local eBay items');
assert(guard.includes("elsif v_product.ebay_sync_excluded"),'eBay order import must ignore excluded items');
assert(guard.includes("revoke execute on function public.hcs_import_ebay_listing_page"),'Old bulk importer must be disabled');
console.log('Card-only eBay import and non-card preservation checks passed.');
