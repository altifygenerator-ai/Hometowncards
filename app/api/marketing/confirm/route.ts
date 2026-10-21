import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/server/portal';
import {tokenHash} from '@/lib/server/branded-email';
export async function GET(req:NextRequest){
 const token=req.nextUrl.searchParams.get('token')||'';
 if(!/^[a-f0-9]{64}$/.test(token))return NextResponse.redirect(new URL('/email-updates/expired',req.url));
 try{
  const rows=await db<Array<{id:string}>>('marketing_subscribers?select=id&status=eq.pending&confirmation_hash=eq.'+tokenHash(token)+'&confirmation_expires_at=gt.'+encodeURIComponent(new Date().toISOString())+'&limit=1');
  if(!rows[0])return NextResponse.redirect(new URL('/email-updates/expired',req.url));
  await db('marketing_subscribers?id=eq.'+rows[0].id,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({status:'active',confirmed_at:new Date().toISOString(),confirmation_hash:null,confirmation_expires_at:null,updated_at:new Date().toISOString()})});
  return NextResponse.redirect(new URL('/email-updates/confirmed',req.url));
 }catch(e){console.error('Marketing confirmation failed',e);return NextResponse.redirect(new URL('/email-updates/expired',req.url))}
}
