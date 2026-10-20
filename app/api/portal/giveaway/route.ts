import {NextRequest} from 'next/server';
import {authorized,db,failure,json,PortalError,safeTerm} from '@/lib/server/portal';
import {sendShopAlert} from '@/lib/server/alerts';
const slug='stan-musial-autograph';
async function platform(req:NextRequest){const c=await authorized(req,'manage');if(c.platformRole!=='owner'&&c.platformRole!=='admin')throw new PortalError('Platform admin access required.',403);return c}
type Config={id:string;slug:string;prize_title:string;prize_description:string;prize_image_url:string|null;approximate_retail_value_cents:number|null;organizer_contact:string;rules_text:string;starts_at:string|null;ends_at:string|null;entries_open:boolean;winner_entry_id:string|null;drawn_at:string|null};
export async function GET(req:NextRequest){
 try{await platform(req);
  const arr=await db<Config[]>('shop_giveaways?select=*&slug=eq.'+slug+'&limit=1');
  const g=arr[0];if(!g)throw new PortalError('Giveaway not configured.',503);
  const all=await db<Array<{confirmed_at:string|null}>>('shop_giveaway_entries?select=confirmed_at&giveaway_id=eq.'+g.id+'&limit=50000');
  return json({giveaway:g,entryCount:all.length,confirmedCount:all.filter(x=>x.confirmed_at).length});
 }catch(e){return failure(e)}
}
export async function POST(req:NextRequest){
 try{
  const c=await platform(req);
  const origin=req.headers.get('origin');if(origin&&new URL(origin).host!==req.nextUrl.host)throw new PortalError('Origin not accepted.',403);
  const raw=await req.text();if(raw.length>20000)throw new PortalError('Rules too long.',413);
  const b=JSON.parse(raw) as Record<string,unknown>;
  if(b.action==='draw'){
   const result=await db<unknown>('rpc/hcs_draw_giveaway_winner',{method:'POST',body:JSON.stringify({p_slug:slug,p_actor:c.userId})});
   try{await sendShopAlert('seller_application','Stan Musial giveaway winner selected','An authorized admin drew the Musial card giveaway winner. Check the giveaway dashboard to contact the winner and confirm eligibility.') }catch{}
   return json({ok:true,result});
  }
  if(b.action!=='save')throw new PortalError('Unknown action',400);
  const rows=await db<Config[]>('shop_giveaways?select=*&slug=eq.'+slug+'&limit=1'),g=rows[0];
  if(!g)throw new PortalError('Giveaway not configured.',503);
  const entries=await db<Array<{id:string}>>('shop_giveaway_entries?select=id&giveaway_id=eq.'+g.id+'&limit=1');
  const title=safeTerm(b.prizeTitle,180),description=safeTerm(b.prizeDescription,1000),contact=safeTerm(b.organizerContact,500);
  const rules=safeTerm(b.rules,12000);
  const image=safeTerm(b.prizeImageUrl,1400);
  const value=Number(b.arvCents);
  const starts=typeof b.startsAt==='string'&&b.startsAt?new Date(b.startsAt):null;
  const ends=typeof b.endsAt==='string'&&b.endsAt?new Date(b.endsAt):null;
  const wantsOpen=b.entriesOpen===true;
  if(title.length<10||description.length<20||!Number.isInteger(value)||value<1||value>100000000)
   throw new PortalError('Provide an accurate prize name, description, and approximate retail value.',400);
  if(image&&!/^https:\/\/[^\s]+$/i.test(image))throw new PortalError('Giveaway picture must be an HTTPS image URL.',400);
  if(wantsOpen){
   if(!image||rules.length<300||contact.length<15||!starts||!ends||!Number.isFinite(starts.getTime())||!Number.isFinite(ends.getTime())||ends<=starts||ends<=new Date())
    throw new PortalError('Add the prize photo, complete official rules and organizer contact, and valid opening/closing dates before starting entries.',400);
   if(!process.env.RESEND_API_KEY||!process.env.RESEND_FROM_EMAIL)throw new PortalError('Giveaway email confirmation is not configured.',503);
  }
  if(entries.length&&(title!==g.prize_title||description!==g.prize_description||value!==g.approximate_retail_value_cents||
   image!==(g.prize_image_url||'')||rules!==g.rules_text||contact!==g.organizer_contact||
   starts?.toISOString()!==(g.starts_at||undefined)||ends?.toISOString()!==(g.ends_at||undefined)))
    throw new PortalError('Prize and rules cannot be changed after entries have begun. Close entries or contact support.',409);
  if(g.drawn_at&&wantsOpen)throw new PortalError('This giveaway has already been drawn.',409);
  await db('shop_giveaways?id=eq.'+g.id,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({
   prize_title:title,prize_description:description,prize_image_url:image||null,approximate_retail_value_cents:value,
   organizer_contact:contact,rules_text:rules,starts_at:starts?.toISOString()||null,ends_at:ends?.toISOString()||null,entries_open:wantsOpen
  })});
  return json({ok:true});
 }catch(e){return failure(e)}
}
