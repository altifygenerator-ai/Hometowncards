import {NextRequest,NextResponse} from 'next/server';
import {verifyStripeWebhook} from '@/lib/server/stripe';
import {checkoutRpc} from '@/lib/server/checkout-db';
import {sendShopAlert} from '@/lib/server/alerts';
export const runtime='nodejs';
export async function POST(req:NextRequest){
 const secret=process.env.STRIPE_CONNECT_WEBHOOK_SECRET;
 if(!secret)return NextResponse.json({error:'Connect events are not configured'},{status:503});
 let event;
 try{event=verifyStripeWebhook(await req.text(),req.headers.get('stripe-signature'),secret)}
 catch{return NextResponse.json({error:'Invalid webhook signature'},{status:400})}
 const enriched=event as typeof event&{account?:string;data:{object:{id?:string;charges_enabled?:boolean;payouts_enabled?:boolean}}};
 const detail=enriched.data?.object;
 const connectedAccount=enriched.account||(event.type==='account.updated'?detail?.id:'');
 if(!connectedAccount?.startsWith('acct_'))return NextResponse.json({received:true,ignored:true});
 const watched=['account.updated','account.application.deauthorized','charge.dispute.created','charge.refunded','payout.failed'];
 if(!watched.includes(event.type))return NextResponse.json({received:true,ignored:true});
 try{
  const status=await checkoutRpc<string>('hcs_record_connect_event',{
   p_event_id:event.id,p_event_type:event.type,p_connected_account_id:connectedAccount,
   p_charges_enabled:typeof detail?.charges_enabled==='boolean'?detail.charges_enabled:null,
   p_payouts_enabled:typeof detail?.payouts_enabled==='boolean'?detail.payouts_enabled:null
  });
  if(status==='logged_for_review'&&['charge.dispute.created','payout.failed'].includes(event.type)){
   try{await sendShopAlert('security','Connected dealer event needs attention',
     'Event: '+event.type+'\nConnected account: '+connectedAccount+'\nStripe event: '+event.id+
     '\nCheck the Stripe dashboard. No automatic refunds or payout adjustments were performed.')}
   catch(e){console.error('Connect event alert failed',e)}
  }
  return NextResponse.json({received:true});
 }catch(err){console.error('Connect webhook persistence failed',event.id,event.type,err);
  return NextResponse.json({error:'Could not record Connect event'},{status:500});
 }
}
