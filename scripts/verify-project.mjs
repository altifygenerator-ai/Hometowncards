#!/usr/bin/env node
/** Validation that doesn't require connecting to third-party accounts or taking payments. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
const data=JSON.parse(fs.readFileSync(new URL('../lib/products.json',import.meta.url)));
assert.equal(data.length,3656);
assert.equal(new Set(data.map(x=>x.id)).size,data.length,'Duplicate original eBay IDs');
assert.equal(data.filter(x=>x.image).length,3243,'Unexpected image match count');
assert(data.every(x=>Number.isSafeInteger(x.price)&&x.price>=0),'Prices must be cents');
assert(data.every(x=>x.quantity>=0),'No negative stock');
const s=fs.readFileSync(new URL('../supabase/schema.sql',import.meta.url),'utf8');
for(const key of ['public.sellers','public.seller_members','public.seller_payout_accounts','public.products','public.order_lines','public.seller_orders','public.reward_policies','public.bonus_card_pools'])assert(s.includes(key),'Missing marketplace table '+key);
for(const key of ['minimumCents: 1, cards: 1','minimumCents: 1000, cards: 5','minimumCents: 2500, cards: 10','minimumCents: 5000, cards: 20'])assert(fs.readFileSync(new URL('../lib/shop-config.ts',import.meta.url),'utf8').includes(key),'Missing promotion '+key);
console.log('Verified',data.length,'catalog items;',data.filter(x=>x.image).length,'front photos;',data.filter(x=>x.team).length,'team labels; seller and rewards schema present.');

// Operational modules must be present before storefront preview deployment.
for(const file of ['supabase/marketplace-operations.sql','lib/server/portal.ts','lib/shipping.ts','app/api/portal/products/route.ts','app/api/portal/products/import/route.ts','app/api/portal/orders/route.ts','app/api/portal/shipping/route.ts','app/admin/dashboard/page.tsx']) assert(fs.existsSync(new URL('../'+file, import.meta.url)), 'Missing operations code: '+file);
console.log('Operations migration, private dashboard, CSV tools and seller shipping modules present.');
