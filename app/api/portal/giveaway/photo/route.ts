import {NextRequest} from 'next/server';
import {authorized,PortalError,failure,json} from '@/lib/server/portal';
export const runtime='nodejs';
const base=(process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL||'').replace(/\/$/,'');
const key=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY||'';
function mime(bytes:Uint8Array){
 if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'image/jpeg';
 if(bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71&&bytes[4]===13&&bytes[5]===10&&bytes[6]===26&&bytes[7]===10)return 'image/png';
 if(String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP')return 'image/webp';
 return null;
}
export async function POST(req:NextRequest){
 try{
  const ctx=await authorized(req,'manage');if(ctx.platformRole!=='owner'&&ctx.platformRole!=='admin')throw new PortalError('Platform administrator access required.',403);
  if(!base||!key)throw new PortalError('Photo storage is unavailable.',503);
  const form=await req.formData(),file=form.get('file');
  if(!(file instanceof File)||file.size<100||file.size>3_800_000)throw new PortalError('Choose a JPEG, PNG or WebP photo up to 3.8 MB.',400);
  const bytes=new Uint8Array(await file.arrayBuffer()),type=mime(bytes);
  if(!type||type!==file.type)throw new PortalError('Photo type does not match its contents.',400);
  const path='giveaways/stan-musial-autograph/'+crypto.randomUUID()+(type==='image/jpeg'?'.jpg':type==='image/png'?'.png':'.webp');
  const u=base+'/storage/v1/object/card-listing-photos/'+path;
  const headers={apikey:key,...(key.startsWith('sb_secret_')?{}:{Authorization:'Bearer '+key}),'Content-Type':type,'x-upsert':'false'};
  const res=await fetch(u,{method:'POST',headers,body:bytes,cache:'no-store'});
  if(!res.ok)throw new PortalError('The giveaway photo could not be saved.',502);
  return json({ok:true,url:base+'/storage/v1/object/public/card-listing-photos/'+path});
 }catch(e){return failure(e)}
}
