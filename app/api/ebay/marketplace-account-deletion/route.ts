import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/server/portal';
import {
 deletionChallengeResponse,ebayIdentityHash,verifyEbayNotification
} from '@/lib/server/ebay-deletion';
export const runtime='nodejs';
export const maxDuration=40;
const headers={'Cache-Control':'no-store'};
export async function GET(req:NextRequest){
 const token=process.env.EBAY_DELETION_VERIFICATION_TOKEN;
 if(!token)return NextResponse.json({error:'Notification verification is not configured.'},
  {status:503,headers});
 try{
  const challenge=req.nextUrl.searchParams.get('challenge_code')||'';
  const challengeResponse=deletionChallengeResponse(challenge,token);
  return NextResponse.json({challengeResponse},{status:200,headers});
 }catch{
  return NextResponse.json({error:'Invalid challenge request.'},{status:400,headers});
 }
}
type DeletionEvent={metadata?:{topic?:string};notification?:{
 notificationId?:string;data?:{username?:string;userId?:string;eiasToken?:string}
}};
export async function POST(req:NextRequest){
 try{
  const raw=await req.text();
  if(!raw||raw.length>20000)return NextResponse.json({error:'Invalid message.'},{status:400,headers});
  const event=JSON.parse(raw) as DeletionEvent;
  if(event.metadata?.topic!=='MARKETPLACE_ACCOUNT_DELETION'||
     typeof event.notification?.notificationId!=='string'||
     !event.notification.data||event.notification.notificationId.length>128)
   return NextResponse.json({error:'Unknown notification.'},{status:400,headers});
  // Do not act on arbitrary POSTs: verify eBay's ECC signature and fetch the
  // signing public key from eBay's official Notification API.
  await verifyEbayNotification(event,req.headers.get('x-ebay-signature'));
  const data=event.notification.data;
  const username=typeof data.username==='string'?data.username.slice(0,120):'';
  const userId=typeof data.userId==='string'?data.userId.slice(0,300):'';
  const eias=typeof data.eiasToken==='string'?data.eiasToken.slice(0,1200):'';
  if(!username&&!userId&&!eias)throw new Error('Verified eBay notification has no account identity');
  await db('rpc/hcs_process_verified_ebay_account_deletion',{
   method:'POST',body:JSON.stringify({
    p_notification_id:event.notification.notificationId,
    p_username:username,
    p_user_id_hash:userId?ebayIdentityHash(userId):'',
    p_eias_hash:eias?ebayIdentityHash(eias):''
   })
  });
  // Only acknowledge after verified identity processing is committed.
  return new NextResponse(null,{status:204,headers});
 }catch(e){
  // Retry on unverified or unprocessed notification. Do not log user identifiers.
  console.error('eBay deletion notification rejected or failed',
   e instanceof Error?e.message:'unknown');
  return NextResponse.json({error:'Notification could not be processed.'},
   {status:503,headers});
 }
}
