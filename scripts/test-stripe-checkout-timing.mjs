import {readFileSync} from 'node:fs';
const source=readFileSync('app/api/checkout/route.ts','utf8');
const match=source.match(/add\('expires_at',Math\.ceil\(Date\.now\(\)\/1000\)\+(\d+)\*60\)/);
if(!match)throw Error('Stripe expiry calculation missing from payment endpoint');
const minutes=Number(match[1]);
if(minutes<35||minutes>40)throw Error('Stripe checkout expiry margin is outside verified interval');
const sql=readFileSync('supabase/manual-inventory-checkout.sql','utf8');
if(!sql.includes("interval '45 minutes'"))throw Error('Expected 45-minute database inventory hold is missing');
if(minutes>=45)throw Error('Stripe checkout outlasts the inventory hold');
if(!source.includes('stripePost(\'checkout/sessions\',params'))throw Error('Expected hosted Stripe checkout route is missing');
// Stripe's 2026 API version rejects payment_method_types when Checkout is created.
if(/add\('payment_method_types/.test(source))throw Error('Deprecated payment_method_types will break live Stripe Checkout');
console.log('Checkout expiration margin checked:',minutes,'minutes; inventory hold: 45 minutes');
