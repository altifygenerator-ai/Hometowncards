import {NextRequest,NextResponse} from 'next/server';
import {verifyTurnstile} from '@/lib/server/turnstile';
import {db,PortalError,safeTerm} from '@/lib/server/portal';
import {brandedEmail,newToken,plainFor,sendEmail,tokenHash,SITE} from '@/lib/server/branded-email';
export const runtime='nodejs';
export async function POST(req:NextRequest){
 try{
  if(req.headers.get('origin')&&new URL(req.headers.get('origin')!).host!==req.nextUrl.host)throw new PortalError('Origin not accepted',403);
  const b=await req.json() as Record<string,unknown>,email=safeTerm(b.email,254).toLowerCase();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||b.consent!==true)throw new PortalError('Enter a valid email and confirm you want shop updates.',400);
  await verifyTurnstile(b.turnstileToken,'marketing-signup',req);
  const confirm=newToken(),unsub=newToken(),now=new Date();
  const existing=await db<Array<{id:string;status:string;updated_at:string}>>('marketing_subscribers?select=id,status,updated_at&email=eq.'+encodeURIComponent(email)+'&limit=1');
  if(existing[0]?.status==='active')return NextResponse.json({ok:true,message:'You are already on the list.'});
  if(existing[0]?.status==='pending'&&existing[0].updated_at&&now.getTime()-Date.parse(existing[0].updated_at)<15*60000)return NextResponse.json({ok:true,message:'Check your inbox for a confirmation link, or try again later.'});
  const row={email,status:'pending',consent_source:'website_signup',consent_at:now.toISOString(),confirmed_at:null,confirmation_hash:tokenHash(confirm),confirmation_expires_at:new Date(now.getTime()+48*3600000).toISOString(),unsubscribe_hash:tokenHash(unsub),updated_at:now.toISOString()};
  if(existing[0])await db('marketing_subscribers?id=eq.'+existing[0].id,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify(row)});
  else await db('marketing_subscribers',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify(row)});
  const link=SITE+'/api/marketing/confirm?token='+confirm;
  const body='Please confirm that you want occasional new card arrivals, new seller spotlights, and promotions from our marketplace.\n\nIf you did not request these updates, you can ignore this message.';
  await sendEmail(email,'Confirm Hometown Card Shop email updates',plainFor('One quick confirmation',body,link),brandedEmail('One quick confirmation',body,'Confirm my email',link));
  return NextResponse.json({ok:true,message:'Check your inbox to confirm your email.'},{headers:{'Cache-Control':'no-store'}});
 }catch(e){const code=e instanceof PortalError?e.code:500;return NextResponse.json({error:e instanceof PortalError?e.message:'Unable to subscribe right now.'},{status:code})}
}
