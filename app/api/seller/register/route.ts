import {NextRequest,NextResponse} from 'next/server';
import {db,PortalError,safeTerm} from '@/lib/server/portal';
import {verifyTurnstile} from '@/lib/server/turnstile';
import {sendShopAlert} from '@/lib/server/alerts';
export const runtime='nodejs';
export async function POST(req:NextRequest){
 try{
  if(req.headers.get('origin')&&new URL(req.headers.get('origin')!).host!==req.nextUrl.host)throw new PortalError('Origin not accepted.',403);
  const raw=await req.text();if(raw.length>6000)throw new PortalError('Request too large.',413);
  const b=JSON.parse(raw) as Record<string,unknown>;
  const name=safeTerm(b.shopName,100),email=safeTerm(b.email,254).toLowerCase(),password=typeof b.password==='string'?b.password:'';
  if(name.length<3||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||password.length<12||password.length>128)throw new PortalError('Enter a shop name, valid email, and password of at least 12 characters.',400);
  if(b.agreeTerms!=='true')throw new PortalError('Please accept the Independent Dealer Terms before applying.',400);
  await verifyTurnstile(b.turnstileToken,'seller-register',req);
  const rows=await db<Array<{seller_applications_open:boolean}>>('marketplace_settings?select=seller_applications_open&id=eq.true&limit=1');
  if(!rows[0]?.seller_applications_open)throw new PortalError('Seller registration is not open yet.',503);
  const existing=await db<Array<{id:string}>>('seller_applications?select=id&contact_email=eq.'+encodeURIComponent(email)+'&limit=1');
  if(existing.length)throw new PortalError('An application already exists for that email. Use shopkeeper sign in if approved.',409);
  const base=(process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL||'').replace(/\/$/,'');
  const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if(!base||!key)throw new PortalError('Account registration is not configured.',503);
  const redirect=new URL('/admin',req.nextUrl.origin).toString();
  const res=await fetch(base+'/auth/v1/signup?redirect_to='+encodeURIComponent(redirect),{method:'POST',
   headers:{apikey:key,'Content-Type':'application/json'},body:JSON.stringify({email,password,options:{emailRedirectTo:redirect}}),cache:'no-store'});
  const body=await res.json() as {id?:string;user?:{id?:string};error_description?:string;msg?:string};
  if(!res.ok)throw new PortalError('Could not create account. Check your email or try another address.',400);
  const userId=body.user?.id||body.id;
  if(!userId||!/^[0-9a-f-]{36}$/i.test(userId))throw new PortalError('Account registration was not confirmed. Contact support.',503);
  const inserted=await db<Array<{id:string}>>('seller_applications',{method:'POST',
   headers:{Prefer:'return=representation'},body:JSON.stringify({user_id:userId,shop_name:name,contact_email:email,status:'received',terms_version:'2026-10-20-v1',terms_accepted_at:new Date().toISOString()})});
  if(!inserted[0])throw new PortalError('Account created, but the dealer application needs support.',503);
  try{await sendShopAlert('seller_application','Dealer account application',name+' ('+email+') has applied. Review in the shopkeeper dashboard. Application: '+inserted[0].id);}
  catch(e){console.error('Dealer application email delayed',e);}
  return NextResponse.json({ok:true,message:'Check your email to verify your account. We will review your shop application before you can manage inventory.'},{headers:{'Cache-Control':'no-store'}});
 }catch(e){if(!(e instanceof PortalError))console.error('Dealer registration failed',e);
  return NextResponse.json({error:e instanceof PortalError?e.message:'Could not register your shop.'},{status:e instanceof PortalError?e.code:500});}
}
