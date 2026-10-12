import {NextRequest,NextResponse} from 'next/server';
import {portalContext,db,PortalError} from '@/lib/server/portal';
import {exchangeCode,encryptToken,validateState,tradingCall,xmlText} from '@/lib/server/ebay';
import {ebayIdentityHash} from '@/lib/server/ebay-deletion';
export const runtime='nodejs';
export const maxDuration=30;
function finish(request:NextRequest,status:'connected'|'error'){
 const res=NextResponse.redirect(new URL('/admin/dashboard?ebay='+status,request.url));
 res.cookies.set('hcs_ebay_state','',{httpOnly:true,secure:true,sameSite:'lax',path:'/api/portal/ebay/callback',maxAge:0});
 return res;
}
export async function GET(req:NextRequest){
 try{
  const state=req.nextUrl.searchParams.get('state')||'';
  const cookie=req.cookies.get('hcs_ebay_state')?.value||'';
  if(!state||!cookie||state!==cookie)throw new PortalError('eBay connect request did not match the signed-in seller.',403);
  const sellerId=validateState(state);
  const c=await portalContext(sellerId);
  if(c.role!=='owner')throw new PortalError('Only the seller-owner can connect eBay.',403);
  if(req.nextUrl.searchParams.get('error'))throw new PortalError('eBay authorization was canceled.',400);
  const code=req.nextUrl.searchParams.get('code')||'';
  const token=await exchangeCode(code);
  if(!token.refresh_token)throw new PortalError('eBay did not issue a refresh token. Reauthorize the requested permissions.',502);
  const who=await tradingCall<{User?:{UserID?:string;EIASToken?:string}}>(token.access_token,'GetUser','');
  const username=xmlText(who.User?.UserID);
  const eiasToken=xmlText(who.User?.EIASToken);
  // Preserve sync_mode only for a previously authorized connection if this is a reauthorization.
  await db('ebay_connections?on_conflict=seller_id',{method:'POST',
   headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify([{
    seller_id:sellerId,refresh_token_ciphertext:encryptToken(token.refresh_token),
    status:'connected',ebay_username:username||null,
    user_id_hash:username?ebayIdentityHash(username):null,
    eias_token_hash:eiasToken?ebayIdentityHash(eiasToken):null,
    sync_mode:'import_only',
    listing_page:1,listing_total:null,listing_pages:null,listing_started_at:null,
    last_order_sync_at:new Date().toISOString(),last_error:null,updated_at:new Date().toISOString()
   }])});
  await db('seller_integrations?on_conflict=seller_id,provider',{method:'POST',
   headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify([{
    seller_id:sellerId,provider:'ebay',external_account_id:username||null,
    status:'connected',last_error:null
   }])});
  return finish(req,'connected');
 }catch(e){
  console.error('eBay OAuth connect callback error',e instanceof Error?e.message:'unknown');
  return finish(req,'error');
 }
}
