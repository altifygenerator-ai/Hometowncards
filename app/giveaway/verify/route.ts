import {NextRequest,NextResponse} from 'next/server';
import {createHash} from 'node:crypto';
import {db} from '@/lib/server/portal';
export const runtime='nodejs';
export async function GET(req:NextRequest){
 const base=new URL('/giveaway',req.url);
 const token=req.nextUrl.searchParams.get('token')||'';
 if(!/^[a-f0-9]{64}$/.test(token)){base.searchParams.set('entry','invalid');return NextResponse.redirect(base)}
 try{
  const h=createHash('sha256').update(token).digest('hex');
  const entries=await db<Array<{id:string;confirmed_at:string|null;confirmation_expires_at:string;shop_giveaways:{ends_at:string|null}}>>(
   'shop_giveaway_entries?select=id,confirmed_at,confirmation_expires_at,shop_giveaways(ends_at)&confirmation_hash=eq.'+h+'&limit=1');
  const e=entries[0];
  if(!e){base.searchParams.set('entry','invalid');return NextResponse.redirect(base)}
  if(e.confirmed_at){base.searchParams.set('entry','confirmed');return NextResponse.redirect(base)}
  if(Date.now()>Date.parse(e.confirmation_expires_at)||!e.shop_giveaways?.ends_at||Date.now()>=Date.parse(e.shop_giveaways.ends_at)){
   base.searchParams.set('entry','expired');return NextResponse.redirect(base);
  }
  await db('shop_giveaway_entries?id=eq.'+e.id+'&confirmed_at=is.null',{method:'PATCH',headers:{Prefer:'return=minimal'},
   body:JSON.stringify({confirmed_at:new Date().toISOString()})});
  base.searchParams.set('entry','confirmed');return NextResponse.redirect(base);
 }catch(e){console.error('Giveaway email verification failed',e);base.searchParams.set('entry','invalid');return NextResponse.redirect(base);}
}
