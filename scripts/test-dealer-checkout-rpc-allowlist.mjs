import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const checkout=readFileSync('lib/server/checkout-db.ts','utf8');
const caller=readFileSync('app/api/dealer/checkout/route.ts','utf8');
const webhook=readFileSync('app/api/stripe/connect/webhook/route.ts','utf8');
const start=checkout.indexOf('if(!/^hcs_(');
assert(start>0,'Checkout RPC allowlist must be explicitly restrictive');
const end=checkout.indexOf(')$/.test(functionName)',start);
assert(end>start,'Checkout RPC allowlist format changed');
const allowed=new RegExp('^hcs_('+checkout.slice(start+'if(!/^hcs_('.length,end)+')$');
const required=[
 ['hcs_begin_dealer_checkout_checked',caller],
 ['hcs_settle_dealer_checkout',webhook],
 ['hcs_record_dealer_charge_event',webhook],
 ['hcs_record_connect_event',webhook],
 ['hcs_attach_checkout',caller],
 ['hcs_abort_unattached_checkout',caller]
];
for(const [name,owner] of required){
 assert(allowed.test(name),'Connect handler calls forbidden checkout RPC: '+name);
 assert(owner.includes("'"+name+"'"),'Caller no longer uses: '+name);
}
for(const name of ['hcs_delete_all_products','hcs_settle_dealer_checkout_evil','hcs_apply_ebay_listing','hcs_review_seller_application'])
 assert(!allowed.test(name),'Checkout must not expose other RPC '+name);
const flags=readFileSync('app/api/dealer/checkout/route.ts','utf8');
assert(flags.includes("process.env.DEALER_CHECKOUT_ENABLED!=='true'"),'Do not turn on independent seller payments during backend wiring fix');
console.log('Strict Connect Checkout RPC allowlist includes every used dealer operation and rejects unrelated RPCs.');
