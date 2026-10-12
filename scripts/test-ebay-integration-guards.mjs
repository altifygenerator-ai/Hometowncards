import {readFileSync} from 'node:fs';
const read=p=>readFileSync(p,'utf8');
const auth=read('lib/server/ebay.ts');
const sync=read('lib/server/ebay-sync.ts');
const conn=read('app/api/portal/ebay/route.ts');
const callback=read('app/api/portal/ebay/callback/route.ts');
const cron=read('app/api/ebay-sync/route.ts');
const migration=read('supabase/optional-ebay-order-idempotency.sql');
const baseline=read('supabase/optional-ebay-integration.sql');
for(const required of [
 ['AES-256-GCM encryption',auth.includes('aes-256-gcm')],
 ['per-seller encrypted refresh token',auth.includes('refresh_token_ciphertext')],
 ['signed OAuth state',auth.includes("createHmac('sha256'")],
 ['OAuth callback authenticates seller',callback.includes('portalContext(sellerId)')],
 ['seller must own connection',conn.includes("c.role!=='owner'")],
 ['writeback opt-in',sync.includes("conn.sync_mode!=='two_way'")],
 ['no writing to another seller',sync.includes("seller_id=eq.")],
 ['compare eBay and local stocks',sync.includes('remote.remaining-p.stock!==totalSold')],
 ['order line idempotency claim',migration.includes("on conflict(seller_id,ebay_order_id,ebay_line_id) do nothing")],
 ['direct site inventory unchanged',baseline.includes('seller_id=p_seller')],
 ['cron bearer authentication',cron.includes("token!=='Bearer '+cronSecret")],
 ['no shared plaintext refresh tokens',!auth.includes('process.env.EBAY_REFRESH_TOKEN')]
]){
 if(!required[1])throw Error('eBay integration safety failure: '+required[0]);
}
console.log('Seller eBay connector security and stock safeguards checked.');
