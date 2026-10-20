import {NextRequest} from 'next/server';
import {authorized,db,failure,json,PortalError,safeTerm} from '@/lib/server/portal';
type Profile={id:string;slug:string;display_name:string;status:string;bio:string;public_email:string|null;logo_url:string|null;region:string|null;customer_service_policy:string;returns_policy:string;handling_days:number};
export async function GET(req:NextRequest){
 try{const c=await authorized(req);const r=await db<Profile[]>('sellers?select=id,slug,display_name,status,bio,public_email,logo_url,region,customer_service_policy,returns_policy,handling_days&id=eq.'+c.sellerId+'&limit=1');
  if(!r[0])throw new PortalError('Shop not found.',404);return json({shop:r[0]});
 }catch(e){return failure(e)}
}
export async function PATCH(req:NextRequest){
 try{const c=await authorized(req,'manage');if(c.role!=='owner')throw new PortalError('Only the shop owner may change the public profile.',403);
  const b=await req.json() as Record<string,unknown>;
  const name=safeTerm(b.displayName,100),bio=safeTerm(b.bio,2000),region=safeTerm(b.region,150);
  const email=safeTerm(b.publicEmail,254).toLowerCase(),logo=safeTerm(b.logoUrl,1400);
  const returns=safeTerm(b.returnsPolicy,3500),service=safeTerm(b.customerServicePolicy,3500);
  const handling=Number(b.handlingDays);
  if(name.length<3||!Number.isInteger(handling)||handling<0||handling>30)throw new PortalError('Enter a valid shop name and handling time.',400);
  if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new PortalError('Enter a valid public contact email.',400);
  if(logo&&!/^https:\/\/[^\s]+$/i.test(logo))throw new PortalError('Shop logo must be an HTTPS image URL.',400);
  await db('sellers?id=eq.'+c.sellerId,{method:'PATCH',headers:{Prefer:'return=minimal'},
   body:JSON.stringify({display_name:name,bio,region,public_email:email||null,logo_url:logo||null,
    returns_policy:returns,customer_service_policy:service,handling_days:handling,updated_at:new Date().toISOString()})});
  return json({ok:true});
 }catch(e){return failure(e)}
}
