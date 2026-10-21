import {NextRequest,NextResponse} from 'next/server';
import {authorized,db,PortalError} from '@/lib/server/portal';
import {randomUUID} from 'node:crypto';
export const runtime='nodejs';
export async function POST(req:NextRequest){
 try{
  const c=await authorized(req,'manage');if(c.platformRole!=='owner'&&c.platformRole!=='admin')throw new PortalError('Platform administrator access required.',403);
  const b=await req.json() as Record<string,unknown>,title=typeof b.title==='string'?b.title.trim().slice(0,120):'',body=typeof b.body==='string'?b.body.trim().slice(0,1800):'',href=typeof b.href==='string'?b.href.trim().slice(0,300):'';
  if(title.length<4||body.length<10||!href.startsWith('/')||href.startsWith('//'))throw new PortalError('Add a title, message, and an on-site link.',400);
  const rows=await db<Array<{id:string}>>('marketing_events',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({event_type:'promo',dedupe_key:'promo:'+randomUUID(),title,body,href})});
  return NextResponse.json({ok:true,id:rows[0]?.id},{headers:{'Cache-Control':'no-store'}});
 }catch(e){const code=e instanceof PortalError?e.code:500;return NextResponse.json({error:e instanceof PortalError?e.message:'Campaign could not be scheduled.'},{status:code})}
}
