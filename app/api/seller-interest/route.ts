import {NextRequest,NextResponse} from 'next/server';
import {verifyTurnstile} from '@/lib/server/turnstile';
import {db,PortalError,safeTerm} from '@/lib/server/portal';
import {sendShopAlert} from '@/lib/server/alerts';
export const runtime='nodejs';
type Lead={id:string;notification_status:string;created_at:string};
const emailRe=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export async function POST(req:NextRequest){
 const headers={'Cache-Control':'no-store'};
 try{
  const origin=req.headers.get('origin');
  if(origin&&new URL(origin).host!==req.nextUrl.host)throw new PortalError('Request origin not allowed.',403);
  const raw=await req.text();
  if(raw.length>11000)throw new PortalError('Message was too long.',413);
  const body=JSON.parse(raw) as Record<string,unknown>;
  if(body.website)return NextResponse.json({ok:true},{headers});
  const contact_name=safeTerm(body.contactName,120);
  const email=safeTerm(body.email,254).toLowerCase();
  if(contact_name.length<2||!emailRe.test(email))throw new PortalError('Enter your name and a valid email.',400);
  const inventory_size=safeTerm(body.inventorySize,50);
  const currently_selling=safeTerm(body.currentlySelling,120);
  const seller_plan_interest=safeTerm(body.planInterest,20);
  if(!['payg','starter','undecided'].includes(seller_plan_interest))throw new PortalError('Choose a valid seller plan.',400);
  const shop_name=safeTerm(body.shopName,120);
  const location=safeTerm(body.location,120);
  const notes=safeTerm(body.notes,1200);
  if(!inventory_size||!currently_selling)throw new PortalError('Tell us a little about your collection.',400);
  await verifyTurnstile(body.turnstileToken,'seller-interest',req);
  // Avoid repeated submissions from the same email; do not overwrite historical interest.
  const existing=await db<Lead[]>('seller_interest_leads?select=id,notification_status,created_at&email=eq.'+encodeURIComponent(email)+'&order=created_at.desc&limit=1');
  let lead=existing[0];
  if(!lead||Date.now()-Date.parse(lead.created_at)>6*60*60*1000){
   const inserted=await db<Lead[]>('seller_interest_leads',{
    method:'POST',headers:{Prefer:'return=representation'},
    body:JSON.stringify({contact_name,email,shop_name,location,inventory_size,currently_selling,seller_plan_interest,notes})
   });
   lead=inserted[0];
  }
  if(!lead)throw new PortalError('Unable to save seller interest.',503);
  if(lead.notification_status!=='sent'){
   try{
    await sendShopAlert('seller_application','New interested card dealer',
     'Name: '+contact_name+'\nShop: '+(shop_name||'Not named')+'\nEmail: '+email+
     '\nLocation: '+(location||'Not provided')+'\nInventory: '+inventory_size+
     '\nSelling now: '+currently_selling+'\nPlan: '+seller_plan_interest+
     '\nNotes: '+(notes||'None')+'\n\nLead ID: '+lead.id);
    await db('seller_interest_leads?id=eq.'+lead.id,{method:'PATCH',headers:{Prefer:'return=minimal'},
     body:JSON.stringify({notification_status:'sent',notified_at:new Date().toISOString()})});
   }catch(err){
    console.error('Dealer interest email not delivered',lead.id,err);
    await db('seller_interest_leads?id=eq.'+lead.id,{method:'PATCH',headers:{Prefer:'return=minimal'},
     body:JSON.stringify({notification_status:'failed'})});
    throw new PortalError('Your interest was saved, but our email notification is delayed. Please try again later.',503);
   }
  }
  return NextResponse.json({ok:true},{headers});
 }catch(err){
  if(!(err instanceof PortalError))console.error('Seller interest submission error',err);
  return NextResponse.json({error:err instanceof PortalError?err.message:'Could not send your interest form.'},
  {status:err instanceof PortalError?err.code:500,headers});
 }
}
