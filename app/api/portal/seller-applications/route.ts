import {NextRequest} from 'next/server';
import {authorized,db,failure,json,PortalError} from '@/lib/server/portal';
import {sendShopAlert} from '@/lib/server/alerts';
import {emailDealerAccountUpdate} from '@/lib/server/dealer-notifications';
function owner(role:string|null){if(role!=='owner'&&role!=='admin')throw new PortalError('Platform administrator access required.',403);}
export async function GET(req:NextRequest){
 try{const c=await authorized(req);owner(c.platformRole);
  const [apps,shops]=await Promise.all([
   db('seller_applications?select=id,user_id,shop_name,contact_email,status,created_at&order=created_at.desc&limit=150'),
   db('sellers?select=id,slug,display_name,status,contact_email,created_at&is_founding_seller=eq.false&order=created_at.desc&limit=150')
  ]);return json({applications:apps,sellers:shops});
 }catch(e){return failure(e)}
}
export async function POST(req:NextRequest){
 try{const c=await authorized(req,'manage');owner(c.platformRole);
  const origin=req.headers.get('origin');if(origin&&new URL(origin).host!==req.nextUrl.host)throw new PortalError('Request origin not accepted',403);
  const b=await req.json() as {action?:string;applicationId?:string;sellerId?:string};
  const uuid=/^[a-f0-9]{8}-[a-f0-9-]{27,}$/i;
  if(b.action==='approve'||b.action==='decline'){
   if(!uuid.test(b.applicationId||''))throw new PortalError('Invalid application',400);
   const rows=await db<Array<{contact_email:string;shop_name:string;terms_accepted_at:string|null}>>('seller_applications?select=contact_email,shop_name,terms_accepted_at&id=eq.'+b.applicationId+'&limit=1');
   if(b.action==='approve'&&!rows[0]?.terms_accepted_at)throw new PortalError('Seller agreement acceptance is missing. Have the applicant complete the new signup.',409);
   const result=await db<unknown>('rpc/hcs_review_seller_application',{method:'POST',body:JSON.stringify({p_application:b.applicationId,p_actor:c.userId,p_decision:b.action==='approve'?'approved':'declined'})});
   try{await sendShopAlert('seller_application','Seller application '+b.action,String(b.applicationId)+' reviewed by '+c.email)}catch{}
   if(rows[0])try{await emailDealerAccountUpdate(rows[0].contact_email,rows[0].shop_name,b.action==='approve'?'approved':'declined')}
   catch(e){console.error('Dealer application outcome email could not be delivered',e)}
   return json({ok:true,result});
  }
  if(b.action==='activate'){
   if(!uuid.test(b.sellerId||''))throw new PortalError('Invalid seller ID',400);
   const shop=await db<Array<{contact_email:string;display_name:string}>>('sellers?select=contact_email,display_name&id=eq.'+b.sellerId+'&limit=1');
   const result=await db<unknown>('rpc/hcs_activate_seller',{method:'POST',body:JSON.stringify({p_seller:b.sellerId,p_actor:c.userId})});
   if(shop[0]?.contact_email)try{await emailDealerAccountUpdate(shop[0].contact_email,shop[0].display_name,'active')}
   catch(e){console.error('Dealer activation email could not be delivered',e)}
   return json({ok:true,result});
  }
  throw new PortalError('Unknown action',400);
 }catch(e){return failure(e)}
}
