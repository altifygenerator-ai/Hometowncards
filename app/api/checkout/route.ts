import {NextResponse} from 'next/server';
export async function POST(){
 // SAFE BY DEFAULT: never capture money against stale eBay stock.
 // Configure production DB, order reservations, carrier rates, Stripe webhooks,
 // and an authorized eBay sync before implementing/activating this route.
 return NextResponse.json({error:'Website checkout is not open yet. Inventory synchronization and fulfillment setup are required before accepting payments.'},{status:503,headers:{'Cache-Control':'no-store'}});
}
