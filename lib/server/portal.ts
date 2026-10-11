import {cookies} from 'next/headers';
import {NextRequest,NextResponse} from 'next/server';

const url=process.env.SUPABASE_URL?.replace(/\/$/,'');
const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
export class PortalError extends Error {constructor(message:string,public code=400){super(message)}}
export function isConfigured(){return !!(url&&serviceKey)}
export async function db<T=unknown>(table:string,options:RequestInit={}):Promise<T>{
 if(!url||!serviceKey)throw new PortalError('The private shop database is not connected yet.',503);
 const response=await fetch(`${url}/rest/v1/${table}`,{...options,headers:{apikey:serviceKey,Authorization:`Bearer ${serviceKey}`,'Content-Type':'application/json',...options.headers},cache:'no-store'});
 if(!response.ok){console.error('Shop database error',response.status,table.split('?')[0],(await response.text()).slice(0,500));throw new PortalError('The shop database could not complete this request.',502)}
 if(response.status===204)return null as T;
 const data=await response.text();return(data?JSON.parse(data):null) as T;
}
export type Membership={seller_id:string;role:'owner'|'manager'|'staff';sellers:{slug:string;display_name:string;status:string}};
export type PortalContext={userId:string;email:string;platformRole:'owner'|'admin'|'support'|null;memberships:Membership[];sellerId:string;sellerName:string;role:Membership['role'];isFounder:boolean};
export async function authenticate():Promise<{id:string;email:string}|null>{
 if(!url||!serviceKey)return null;
 const token=(await cookies()).get('hcs_portal_access')?.value;
 if(!token)return null;
 const res=await fetch(`${url}/auth/v1/user`,{headers:{apikey:serviceKey,Authorization:`Bearer ${token}`},cache:'no-store'});
 if(!res.ok)return null;
 const user=await res.json() as {id?:string;email?:string;email_confirmed_at?:string};
 if(!user.email_confirmed_at)return null;
 return user.id?{id:user.id,email:user.email||''}:null;
}
export async function portalContext(sellerId?:string):Promise<PortalContext>{
 const user=await authenticate();if(!user)throw new PortalError('Please sign in to manage your shop.',401);
 const members=await db<Membership[]>(`seller_members?select=seller_id,role,sellers!inner(slug,display_name,status)&user_id=eq.${encodeURIComponent(user.id)}`);
 const admins=await db<Array<{role:'owner'|'admin'|'support'}>>(`platform_staff?select=role&user_id=eq.${encodeURIComponent(user.id)}&limit=1`);
 const platformRole=admins[0]?.role||null;
 const expectedOwner=(process.env.SHOP_ADMIN_EMAIL||'altifygenerator@gmail.com').trim().toLowerCase();
 if(platformRole==='owner'&&user.email.trim().toLowerCase()!==expectedOwner)throw new PortalError('This account is not authorized as the platform owner.',403);
 let allowed=members.filter(m=>m.sellers?.status==='approved');
 if(platformRole==='owner'||platformRole==='admin'){
   const known=await db<Array<{id:string;slug:string;display_name:string;status:string}>>('sellers?select=id,slug,display_name,status&status=eq.approved&order=created_at.asc&limit=100');
   for(const s of known)if(!allowed.some(m=>m.seller_id===s.id))allowed.push({seller_id:s.id,role:'owner',sellers:s});
 }
 if(allowed.length===0)throw new PortalError('This account is not assigned to an approved shop.',403);
 const selected=sellerId?allowed.find(m=>m.seller_id===sellerId):allowed.find(m=>m.sellers.slug==='hometown-card-shop')||allowed[0];
 if(!selected)throw new PortalError('You do not have access to that seller.',403);
 return {userId:user.id,email:user.email,platformRole,memberships:allowed,sellerId:selected.seller_id,sellerName:selected.sellers.display_name,role:selected.role,isFounder:selected.sellers.slug==='hometown-card-shop'};
}
export async function authorized(req:NextRequest,minimum:'read'|'manage'='read'){
 const origin=req.headers.get('origin');if(origin&&new URL(origin).host!==req.nextUrl.host)throw new PortalError('Request origin was not accepted.',403);
 const context=await portalContext(req.headers.get('x-seller-id')||undefined);
 if(minimum==='manage'&&context.role==='staff')throw new PortalError('Manager permissions are required.',403);
 return context;
}
export function failure(err:unknown){const code=err instanceof PortalError?err.code:500; if(code===500)console.error('Shop admin error',err);return NextResponse.json({error:err instanceof PortalError?err.message:'An unexpected error occurred.'},{status:code,headers:{'Cache-Control':'no-store'}})}
export function json(body:unknown,status=200){return NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}})}
export function safeTerm(s:unknown,max=120){return typeof s==='string'?s.trim().slice(0,max):''}
export function moneyCents(value:unknown){const n=Number(value);if(!Number.isFinite(n)||n<0||n>1000000)return null;return Math.round(n*100)}
export function idList(value:unknown,max=200){if(!Array.isArray(value)||value.length>max)throw new PortalError('Select no more than '+max+' listings.');const ids=[...new Set(value.filter((x):x is string=>typeof x==='string'&&/^[a-f\d-]{36}$/i.test(x)))];if(ids.length!==value.length)throw new PortalError('Invalid item selection.');return ids}
export function queryIds(ids:string[]){return `in.(${ids.join(',')})`}
export async function audit(sellerId:string,userId:string,action:string,productId:string|null,before:unknown,after:unknown){await db('inventory_audit',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({seller_id:sellerId,actor_user_id:userId,action,product_id:productId,before_value:before,after_value:after})})}
