import {randomBytes,createHash} from 'node:crypto';
import {NextRequest,NextResponse} from 'next/server';
import {verifyTurnstile} from '@/lib/server/turnstile';
import {db,PortalError,safeTerm} from '@/lib/server/portal';
import {MUSIAL_GIVEAWAY_CLOSING_INSTANT} from '@/lib/giveaway-config';
export const runtime='nodejs';
const hash=(v:string)=>createHash('sha256').update(v).digest('hex');
export async function POST(req:NextRequest){
 let inserted:string|null=null;
 try{
  if(req.headers.get('origin')&&new URL(req.headers.get('origin')!).host!==req.nextUrl.host)throw new PortalError('Origin not accepted',403);
  const raw=await req.text();if(raw.length>5000)throw new PortalError('Request too large',413);
  const b=JSON.parse(raw) as Record<string,unknown>;
  const name=safeTerm(b.name,120),email=safeTerm(b.email,254).toLowerCase();
  if(name.length<2||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||b.agree!==true||b.age18!==true||b.usResident!==true)
   throw new PortalError('Enter your name, email, and confirm giveaway eligibility and rules.',400);
  await verifyTurnstile(b.turnstileToken,'giveaway-entry',req);
  const rows=await db<Array<{id:string;starts_at:string|null;ends_at:string|null;entries_open:boolean;rules_text:string;approximate_retail_value_cents:number|null}>>('shop_giveaways?select=id,starts_at,ends_at,entries_open,rules_text,approximate_retail_value_cents&slug=eq.stan-musial-autograph&limit=1');
  const g=rows[0],now=Date.now();
  if(!g||!g.entries_open||!g.starts_at||!g.ends_at||now<Date.parse(g.starts_at)||now>=Date.parse(g.ends_at)||now>=MUSIAL_GIVEAWAY_CLOSING_INSTANT||!g.rules_text||g.approximate_retail_value_cents===null)
   throw new PortalError('Giveaway entries are not currently open.',409);
  const prev=await db<Array<{id:string}>>('shop_giveaway_entries?select=id&giveaway_id=eq.'+g.id+'&email=eq.'+encodeURIComponent(email)+'&limit=1');
  if(prev.length)return NextResponse.json({ok:true,message:'If you have already entered, check your email for the confirmation link. One entry per person.'});
  const token=randomBytes(32).toString('hex');
  const entries=await db<Array<{id:string}>>('shop_giveaway_entries',{method:'POST',headers:{Prefer:'return=representation'},
   body:JSON.stringify({giveaway_id:g.id,name,email,newsletter_opt_in:b.marketing===true,confirmation_hash:hash(token)})});
  if(!entries[0])throw new PortalError('Could not record your entry.',503);
  inserted=entries[0].id;
  const key=process.env.RESEND_API_KEY,from=process.env.RESEND_FROM_EMAIL;
  if(!key||!from)throw new PortalError('Email confirmation is temporarily unavailable.',503);
  const confirmation=req.nextUrl.origin+'/giveaway/verify?token='+encodeURIComponent(token);
  const sent=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},
   body:JSON.stringify({from,to:[email],subject:'Confirm your free Stan Musial giveaway entry',text:'Confirm your free Hometown Card Shop giveaway entry by opening:\n\n'+confirmation+'\n\nNo purchase or Facebook follow is required, and neither increases your odds. Confirm before December 1, 2026 at 11:59 PM Central. This link also expires after 48 hours, whichever is sooner. If you did not enter, ignore this email.'}),cache:'no-store'});
  if(!sent.ok)throw new PortalError('Confirmation email could not be sent. Please retry.',503);
  return NextResponse.json({ok:true,message:'Check your email to confirm your free entry. No purchase is necessary.'},{headers:{'Cache-Control':'no-store'}});
 }catch(e){
  if(inserted){try{await db('shop_giveaway_entries?id=eq.'+inserted,{method:'DELETE'})}catch(err){console.error('Giveaway entry cleanup failed',err)}}
  if(!(e instanceof PortalError))console.error('Giveaway entry error',e);
  return NextResponse.json({error:e instanceof PortalError?e.message:'Unable to enter giveaway.'},{status:e instanceof PortalError?e.code:500});
 }
}
