import {NextRequest,NextResponse} from 'next/server';
import {createHash,randomBytes} from 'node:crypto';
import {db} from '@/lib/server/portal';
import {MUSIAL_GIVEAWAY_CLOSING_INSTANT} from '@/lib/giveaway-config';
import {sendShopAlert} from '@/lib/server/alerts';
export const runtime='nodejs';
export async function GET(req:NextRequest){
 const base=new URL('/giveaway',req.url),token=req.nextUrl.searchParams.get('token')||'';
 if(!/^[a-f0-9]{64}$/.test(token)){base.searchParams.set('entry','invalid');return NextResponse.redirect(base)}
 try{
  const h=createHash('sha256').update(token).digest('hex');
  const entries=await db<Array<{id:string;name:string;email:string;newsletter_opt_in:boolean;confirmed_at:string|null;confirmation_expires_at:string;shop_giveaways:{ends_at:string|null}}>>('shop_giveaway_entries?select=id,name,email,newsletter_opt_in,confirmed_at,confirmation_expires_at,shop_giveaways(ends_at)&confirmation_hash=eq.'+h+'&limit=1');
  const e=entries[0];
  if(!e){base.searchParams.set('entry','invalid');return NextResponse.redirect(base)}
  if(e.confirmed_at){base.searchParams.set('entry','confirmed');return NextResponse.redirect(base)}
  if(Date.now()>Date.parse(e.confirmation_expires_at)||!e.shop_giveaways?.ends_at||Date.now()>=Date.parse(e.shop_giveaways.ends_at)||Date.now()>=MUSIAL_GIVEAWAY_CLOSING_INSTANT){base.searchParams.set('entry','expired');return NextResponse.redirect(base)}
  const confirmedAt=new Date().toISOString();
  const claimed=await db<Array<{id:string}>>('shop_giveaway_entries?id=eq.'+e.id+'&confirmed_at=is.null',{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({confirmed_at:confirmedAt})});
  if(!claimed[0]){base.searchParams.set('entry','confirmed');return NextResponse.redirect(base)}
  if(e.newsletter_opt_in)await db('marketing_subscribers?on_conflict=email',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify({email:e.email.toLowerCase(),status:'active',consent_source:'giveaway_checkbox',consent_at:confirmedAt,confirmed_at:confirmedAt,confirmation_hash:null,confirmation_expires_at:null,unsubscribe_hash:createHash('sha256').update(randomBytes(32).toString('hex')).digest('hex'),updated_at:confirmedAt})});
  try{await sendShopAlert('giveaway_entry','New confirmed giveaway entry','A new Hometown Card Shop giveaway entry has been verified.\n\nName: '+e.name+'\nEmail: '+e.email+'\n\nView giveaway entries in the shopkeeper dashboard.')}catch(error){console.error('Giveaway operator alert failed',error)}
  base.searchParams.set('entry','confirmed');return NextResponse.redirect(base);
 }catch(e){console.error('Giveaway email verification failed',e);base.searchParams.set('entry','invalid');return NextResponse.redirect(base)}
}
