import {NextRequest,NextResponse} from 'next/server';
import {authorized,db,failure,json,PortalError} from '@/lib/server/portal';
import {appReady,authorizeUrl,getConnection,signState} from '@/lib/server/ebay';
import {performEbaySync} from '@/lib/server/ebay-sync';
export const runtime='nodejs';
export const maxDuration=60;
async function manage(req:NextRequest){
 const c=await authorized(req,'manage');
 if(c.role!=='owner')throw new PortalError('Only a seller-owner can connect or manage eBay.',403);
 return c;
}
export async function GET(req:NextRequest){
 try{
  const c=await authorized(req);
  const connection=await getConnection(c.sellerId);
  const rows=await db<Array<{state:string}>>('ebay_sale_outbox?select=state&seller_id=eq.'+c.sellerId+
   '&state=in.(pending_connection,pending,needs_review)&limit=2000');
  return json({configured:appReady(),connected:!!connection,
   account:connection?{username:connection.ebay_username,status:connection.status,
    mode:connection.sync_mode,lastListingSync:connection.last_listing_sync_at,
    lastOrderSync:connection.last_order_sync_at,lastWriteback:connection.last_writeback_at,
    nextPage:connection.listing_page,totalPages:connection.listing_pages,
    lastError:connection.last_error}:null,
   pendingWriteback:rows.length,capabilities:{
    websiteOnly:true,importEbay:true,writebackOptIn:true,
    sharedSellerAccount:false
   }});
 }catch(e){return failure(e)}
}
export async function POST(req:NextRequest){
 try{
  const c=await manage(req);
  const raw=await req.text();if(raw.length>800)throw new PortalError('Invalid request.',413);
  const body=JSON.parse(raw||'{}') as {action?:string;mode?:string};
  if(body.action==='connect'){
   if(!appReady())throw new PortalError('eBay Production credentials are not configured on the server.',503);
   const state=signState(c.sellerId);
   const response=json({url:authorizeUrl(state)});
   response.cookies.set('hcs_ebay_state',state,{httpOnly:true,secure:true,sameSite:'lax',path:'/api/portal/ebay/callback',maxAge:600});
   return response;
  }
  const connection=await getConnection(c.sellerId);
  if(!connection)throw new PortalError('Connect an eBay account first.',409);
  if(body.action==='mode'){
   if(body.mode!=='import_only'&&body.mode!=='two_way')throw new PortalError('Invalid eBay sync mode.',400);
   if(body.mode==='two_way'&&!connection.last_listing_sync_at)throw new PortalError('Complete and verify the first eBay listing import before turning on writeback.',409);
   await db('ebay_connections?seller_id=eq.'+c.sellerId,{method:'PATCH',
    headers:{Prefer:'return=minimal'},body:JSON.stringify({sync_mode:body.mode,updated_at:new Date().toISOString()})});
   return json({ok:true,mode:body.mode});
  }
  if(body.action==='reset'){
   await db('ebay_connections?seller_id=eq.'+c.sellerId,{method:'PATCH',
    headers:{Prefer:'return=minimal'},body:JSON.stringify({listing_page:1,listing_total:null,
     listing_pages:null,listing_started_at:null,last_error:null,updated_at:new Date().toISOString()})});
   return json({ok:true});
  }
  if(body.action==='sync'){
   const result=await performEbaySync(c.sellerId);
   await db('seller_integrations?seller_id=eq.'+c.sellerId+'&provider=eq.ebay',{method:'PATCH',
    headers:{Prefer:'return=minimal'},body:JSON.stringify({status:'connected',last_successful_sync:new Date().toISOString(),last_error:null})});
   return json({ok:true,...result});
  }
  throw new PortalError('Unknown eBay action.',400);
 }catch(e){
  if(!(e instanceof PortalError))console.error('eBay synchronization failed',e);
  return failure(e);
 }
}
export async function DELETE(req:NextRequest){
 try{
  const c=await manage(req);
  await db('ebay_connections?seller_id=eq.'+c.sellerId,{method:'DELETE',headers:{Prefer:'return=minimal'}});
  await db('seller_integrations?seller_id=eq.'+c.sellerId+'&provider=eq.ebay',{method:'PATCH',
   headers:{Prefer:'return=minimal'},body:JSON.stringify({status:'disconnected',last_error:null})});
  // Keep the seller's site catalogue: disconnect does not delete products or force eBay usage.
  return json({ok:true});
 }catch(e){return failure(e)}
}
