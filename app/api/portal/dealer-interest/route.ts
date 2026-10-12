import {NextRequest} from 'next/server';
import {authorized,db,PortalError,failure,json} from '@/lib/server/portal';
export async function GET(req:NextRequest){
 try{
  const ctx=await authorized(req);
  if(ctx.platformRole!=='owner'&&ctx.platformRole!=='admin')throw new PortalError('Platform owner access required.',403);
  const leads=await db<Array<{id:string;contact_name:string;email:string;shop_name:string;location:string;inventory_size:string;currently_selling:string;seller_plan_interest:string;notes:string;notification_status:string;created_at:string}>>(
   'seller_interest_leads?select=id,contact_name,email,shop_name,location,inventory_size,currently_selling,seller_plan_interest,notes,notification_status,created_at&order=created_at.desc&limit=100');
  return json({count:leads.length,leads});
 }catch(e){return failure(e)}
}
