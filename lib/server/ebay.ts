import 'server-only';
import {createCipheriv,createDecipheriv,createHmac,randomBytes,timingSafeEqual} from 'node:crypto';
import {XMLParser} from 'fast-xml-parser';
import {db,PortalError} from '@/lib/server/portal';

export const EBAY_SCOPES=[
 'https://api.ebay.com/oauth/api_scope',
 'https://api.ebay.com/oauth/api_scope/sell.inventory',
 'https://api.ebay.com/oauth/api_scope/sell.fulfillment'
].join(' ');
const parser=new XMLParser({ignoreAttributes:false,attributeNamePrefix:'@_',textNodeName:'#text'});
export type EbayConnection={
 seller_id:string;refresh_token_ciphertext:string;status:'connected'|'paused'|'error';
 sync_mode:'import_only'|'two_way';ebay_username:string|null;last_error:string|null;
 listing_page:number;listing_total:number|null;listing_pages:number|null;
 listing_started_at:string|null;last_listing_sync_at:string|null;last_order_sync_at:string|null;
 last_writeback_at:string|null
};
export function appReady(){
 return Boolean(process.env.EBAY_CLIENT_ID&&process.env.EBAY_CLIENT_SECRET&&process.env.EBAY_RUNAME&&process.env.EBAY_TOKEN_ENCRYPTION_KEY);
}
function secret(){
 const raw=process.env.EBAY_TOKEN_ENCRYPTION_KEY;
 if(!raw)throw new PortalError('eBay token encryption is not configured.',503);
 const bytes=/^[a-f0-9]{64}$/i.test(raw)?Buffer.from(raw,'hex'):Buffer.from(raw,'base64');
 if(bytes.length!==32)throw new PortalError('eBay encryption key must be 32 random bytes (hex or base64).',503);
 return bytes;
}
export function encryptToken(token:string){
 const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',secret(),iv);
 const data=Buffer.concat([cipher.update(token,'utf8'),cipher.final()]);
 return [iv.toString('base64url'),cipher.getAuthTag().toString('base64url'),data.toString('base64url')].join('.');
}
export function decryptToken(ciphertext:string){
 const parts=ciphertext.split('.');
 if(parts.length!==3)throw new PortalError('eBay credentials need reconnecting.',503);
 const decipher=createDecipheriv('aes-256-gcm',secret(),Buffer.from(parts[0],'base64url'));
 decipher.setAuthTag(Buffer.from(parts[1],'base64url'));
 return Buffer.concat([decipher.update(Buffer.from(parts[2],'base64url')),decipher.final()]).toString('utf8');
}
function config(){
 if(!appReady())throw new PortalError('Add eBay production App ID, Cert ID, RuName and encryption key in Vercel first.',503);
 return {client:process.env.EBAY_CLIENT_ID!,secret:process.env.EBAY_CLIENT_SECRET!,ruName:process.env.EBAY_RUNAME!};
}
export function authorizeUrl(state:string){
 const c=config();
 const q=new URLSearchParams({client_id:c.client,response_type:'code',redirect_uri:c.ruName,scope:EBAY_SCOPES,state,prompt:'login'});
 return 'https://auth.ebay.com/oauth2/authorize?'+q.toString();
}
export function signState(sellerId:string){
 const stamp=Date.now(),nonce=randomBytes(18).toString('hex');
 const body=Buffer.from(JSON.stringify({sellerId,stamp,nonce})).toString('base64url');
 const mac=createHmac('sha256',secret()).update(body).digest('base64url');
 return body+'.'+mac;
}
export function validateState(value:string):string{
 const [body,mac,...extras]=value.split('.');
 if(!body||!mac||extras.length)throw new PortalError('Invalid eBay authentication state.',400);
 const expected=createHmac('sha256',secret()).update(body).digest();
 const supplied=Buffer.from(mac,'base64url');
 if(supplied.length!==expected.length||!timingSafeEqual(supplied,expected))
  throw new PortalError('Invalid eBay authentication signature.',403);
 const json=JSON.parse(Buffer.from(body,'base64url').toString('utf8')) as {sellerId?:string;stamp?:number};
 if(typeof json.sellerId!=='string'||!/^[a-f0-9-]{36}$/i.test(json.sellerId)||!
    Number.isFinite(json.stamp)||Date.now()-json.stamp!>600000||Date.now()<json.stamp!)
  throw new PortalError('eBay authentication expired; please retry.',403);
 return json.sellerId;
}
async function tokenRequest(body:URLSearchParams){
 const c=config();
 const res=await fetch('https://api.ebay.com/identity/v1/oauth2/token',{method:'POST',
  headers:{Authorization:'Basic '+Buffer.from(c.client+':'+c.secret).toString('base64'),
   'Content-Type':'application/x-www-form-urlencoded'},
  body:body.toString(),signal:AbortSignal.timeout(18000),cache:'no-store'});
 if(!res.ok){const failure=await res.json().catch(()=>({})) as {error?:string};
  console.error('eBay OAuth exchange failed',res.status,failure.error||'unknown');
  throw new PortalError('eBay did not authorize the connection. Check your production RuName and OAuth permissions.',502);}
 return await res.json() as {access_token:string;refresh_token?:string;expires_in:number};
}
export async function exchangeCode(code:string){
 if(!code||code.length>2048)throw new PortalError('Invalid eBay OAuth code.',400);
 const c=config();
 return tokenRequest(new URLSearchParams({grant_type:'authorization_code',code,redirect_uri:c.ruName}));
}
export async function getConnection(sellerId:string){
 const rows=await db<EbayConnection[]>('ebay_connections?select=*&seller_id=eq.'+sellerId+'&limit=1');
 return rows[0]||null;
}
export async function getAccessToken(sellerId:string){
 const connection=await getConnection(sellerId);
 if(!connection||connection.status!=='connected')throw new PortalError('Connect eBay before synchronizing.',409);
 const refresh=decryptToken(connection.refresh_token_ciphertext);
 const token=await tokenRequest(new URLSearchParams({grant_type:'refresh_token',refresh_token:refresh,scope:EBAY_SCOPES}));
 return token.access_token;
}
function asText(x:unknown):string{
 if(x===null||x===undefined)return '';
 if(typeof x==='object')return asText((x as Record<string,unknown>)['#text']??'');
 return String(x);
}
export function xmlList<T>(x:T|T[]|undefined|null):T[]{return !x?[]:Array.isArray(x)?x:[x]}
export function xmlText(x:unknown){return asText(x)}
export async function tradingCall<T=Record<string,unknown>>(token:string,name:string,content:string):Promise<T>{
 if(!/^[A-Za-z]{3,45}$/.test(name))throw new PortalError('Invalid eBay Trading API operation',500);
 const body='<?xml version="1.0" encoding="utf-8"?>'+
  '<'+name+'Request xmlns="urn:ebay:apis:eBLBaseComponents">'+content+'</'+name+'Request>';
 const res=await fetch('https://api.ebay.com/ws/api.dll',{method:'POST',
  headers:{'Content-Type':'text/xml','X-EBAY-API-CALL-NAME':name,
   'X-EBAY-API-SITEID':'0','X-EBAY-API-COMPATIBILITY-LEVEL':'1400','X-EBAY-API-IAF-TOKEN':token},
  body,cache:'no-store',signal:AbortSignal.timeout(17000)});
 if(!res.ok)throw new PortalError('eBay '+name+' is unavailable (HTTP '+res.status+').',502);
 const reply=parser.parse(await res.text()) as Record<string,Record<string,unknown>>;
 const root=reply[name+'Response'];
 if(!root||asText(root.Ack)==='Failure'){
  const errors=xmlList(root?.Errors as Record<string,unknown>|Record<string,unknown>[]|undefined);
  const message=errors.map(x=>asText(x.LongMessage||x.ShortMessage)).filter(Boolean).join('; ').slice(0,240);
  throw new PortalError('eBay '+name+' declined: '+(message||'unknown error'),502);
 }
 return root as T;
}
export async function ebayGetOrders(access:string,days=14){
 const from=new Date(Date.now()-days*86400000).toISOString();
 const all:Array<Record<string,unknown>>=[];
 for(let offset=0;offset<500;offset+=50){
  const url=new URL('https://api.ebay.com/sell/fulfillment/v1/order');
  url.searchParams.set('filter','creationdate:['+from+'..]');
  url.searchParams.set('limit','50');url.searchParams.set('offset',String(offset));
  const res=await fetch(url,{headers:{Authorization:'Bearer '+access,'Accept':'application/json'},
   signal:AbortSignal.timeout(18000),cache:'no-store'});
  if(!res.ok)throw new PortalError('Could not retrieve recent eBay orders (HTTP '+res.status+').',502);
  const data=await res.json() as {orders?:Array<Record<string,unknown>>;total?:number};
  const batch=data.orders||[];
  all.push(...batch);
  if(batch.length<50)return all;
 }
 throw new PortalError('Too many recent eBay orders to reconcile safely in one run.',409);
}
