import {NextRequest,NextResponse} from 'next/server';
import {failure,PortalError,isConfigured,portalContext,json,db} from '@/lib/server/portal';
import {verifyTurnstile} from '@/lib/server/turnstile';
export async function POST(req:NextRequest){
 try{
  if(!isConfigured())throw new PortalError('Private shop sign-in is not configured yet.',503);
  const origin=req.headers.get('origin');if(origin&&new URL(origin).host!==req.nextUrl.host)throw new PortalError('Request origin was not accepted.',403);
  const body=await req.json() as {email?:string;password?:string;turnstileToken?:string};
  if(!body.email||!body.password||body.email.length>250||body.password.length>250)throw new PortalError('Enter your email and password.');
  await verifyTurnstile(body.turnstileToken,'admin-login',req);
  const base=(process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL)!;
  const anon=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if(!anon)throw new PortalError('Shop sign-in is not configured yet.',503);
  const auth=await fetch(`${base}/auth/v1/token?grant_type=password`,{method:'POST',headers:{apikey:anon,'Content-Type':'application/json'},body:JSON.stringify({email:body.email,password:body.password}),cache:'no-store'});
  if(!auth.ok){return json({error:'Could not sign in. Check your email and password.'},401)}
  const data=await auth.json() as {access_token:string;refresh_token:string;expires_in:number;user?:{id:string}};
  let pending=false;
  if(data.user?.id){
   const memberships=await db<Array<{seller_id:string}>>('seller_members?select=seller_id&user_id=eq.'+encodeURIComponent(data.user.id)+'&limit=1');
   if(!memberships.length){const applications=await db<Array<{status:string}>>('seller_applications?select=status&user_id=eq.'+encodeURIComponent(data.user.id)+'&limit=1');pending=applications.some(a=>['received','review'].includes(a.status));}
  }
  const response=json({ok:true,pending});
  const secure=process.env.NODE_ENV==='production';
  response.cookies.set('hcs_portal_access',data.access_token,{httpOnly:true,sameSite:'lax',secure,path:'/',maxAge:Math.min(data.expires_in,3600)});
  response.cookies.set('hcs_portal_refresh',data.refresh_token,{httpOnly:true,sameSite:'strict',secure,path:'/api/portal/session',maxAge:60*60*24*14});
  return response;
 }catch(err){return failure(err)}
}
export async function GET(){try{const c=await portalContext();return json({email:c.email,sellerId:c.sellerId,sellerName:c.sellerName,role:c.role,platformRole:c.platformRole,memberships:c.memberships.map(m=>({id:m.seller_id,name:m.sellers.display_name,slug:m.sellers.slug}))})}catch(e){return failure(e)}}
export async function DELETE(){const response=json({ok:true});response.cookies.delete('hcs_portal_access');response.cookies.delete('hcs_portal_refresh');return response}
