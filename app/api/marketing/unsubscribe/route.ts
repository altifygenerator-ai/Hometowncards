import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/server/portal';
import {tokenHash} from '@/lib/server/branded-email';
async function unsubscribe(req:NextRequest,html:boolean){
 const token=req.nextUrl.searchParams.get('token')||'';
 if(!/^[a-f0-9]{64}$/.test(token))return new NextResponse('This unsubscribe link is invalid.',{status:400});
 try{await db('marketing_subscribers?unsubscribe_hash=eq.'+tokenHash(token),{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({status:'unsubscribed',updated_at:new Date().toISOString()})});
  const body='<!doctype html><html><meta name="viewport" content="width=device-width"><title>Unsubscribed</title><body style="font:16px Arial;background:#f6f3ec;padding:40px;color:#132139"><main style="max-width:560px;margin:auto;background:white;padding:32px;border-radius:8px"><h1 style="font-family:Georgia">You are off the list.</h1><p>You will no longer receive Hometown Card Shop marketing emails. Order, account, and seller service emails are not affected.</p><a href="https://www.hometowncardshop.com">Return to Hometown Card Shop</a></main></body></html>';
  return new NextResponse(html?body:'Unsubscribed',{headers:{'Content-Type':html?'text/html; charset=utf-8':'text/plain; charset=utf-8','Cache-Control':'no-store'}});
 }catch(e){console.error('Unsubscribe failed',e);return new NextResponse('Please try again later.',{status:503})}
}
export async function GET(req:NextRequest){return unsubscribe(req,true)}
export async function POST(req:NextRequest){return unsubscribe(req,false)}
