import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/server/portal';
import {brandedEmail,newToken,plainFor,sendEmail,tokenHash,SITE} from '@/lib/server/branded-email';
export const runtime='nodejs',maxDuration=60;
type Event={id:string;event_type:'new_seller'|'new_products'|'promo';title:string;body:string;href:string;cursor_subscriber_id:string|null;locked_until:string|null};
type Subscriber={id:string;email:string};
export async function GET(req:NextRequest){
 const secret=process.env.CRON_SECRET;
 if(!secret||req.headers.get('authorization')!=='Bearer '+secret)return NextResponse.json({error:'Unauthorized'},{status:401});
 let processed=0,failed=0;
 try{
  const events=await db<Event[]>('rpc/hcs_claim_marketing_event',{method:'POST',body:'{}'});
  const event=events[0];if(!event)return NextResponse.json({ok:true,processed,failed});
  let query='marketing_subscribers?select=id,email&status=eq.active&order=id.asc&limit=41';
  if(event.cursor_subscriber_id)query+='&id=gt.'+event.cursor_subscriber_id;
  const subscribers=await db<Subscriber[]>(query);
  const batch=subscribers.slice(0,40);
  for(const subscriber of batch){
   const exists=await db<Array<{subscriber_id:string}>>('marketing_deliveries?select=subscriber_id&event_id=eq.'+event.id+'&subscriber_id=eq.'+subscriber.id+'&limit=1');
   if(exists.length){event.cursor_subscriber_id=subscriber.id;continue}
   const token=newToken(),unsubscribe=SITE+'/api/marketing/unsubscribe?token='+token;
   let status:'sent'|'failed'='sent';
   try{
    await db('marketing_subscribers?id=eq.'+subscriber.id,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({unsubscribe_hash:tokenHash(token),updated_at:new Date().toISOString()})});
    const body=event.body+'\n\nYou are receiving this note because you opted in to Hometown Card Shop updates. Unsubscribe any time using the link below.';
    await sendEmail(subscriber.email,event.title,plainFor(event.title,body,SITE+event.href)+'\n\nUnsubscribe: '+unsubscribe,
      brandedEmail(event.title,body,'Take a look',event.href,'You are receiving this because you opted in to shop updates. Unsubscribe below.')+'<p style="text-align:center;font:12px Arial"><a href="'+unsubscribe+'" style="color:#657386">Unsubscribe from shop updates</a></p>',
      {'List-Unsubscribe':'<'+unsubscribe+'>','List-Unsubscribe-Post':'List-Unsubscribe=One-Click'});
    processed++;
   }catch(e){status='failed';failed++;console.error('Marketing email delivery failed',event.id,e)}
   await db('marketing_deliveries',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({event_id:event.id,subscriber_id:subscriber.id,status})});
   event.cursor_subscriber_id=subscriber.id;
   await db('marketing_events?id=eq.'+event.id,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({cursor_subscriber_id:subscriber.id,locked_until:null})});
  }
  if(subscribers.length<=40)await db('marketing_events?id=eq.'+event.id,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({status:'sent',sent_at:new Date().toISOString(),locked_until:null})});
  return NextResponse.json({ok:true,processed,failed,eventId:event.id,complete:subscribers.length<=40});
 }catch(e){console.error('Marketing email automation failed',e);return NextResponse.json({error:'Email automation could not complete.'},{status:500})}
}
