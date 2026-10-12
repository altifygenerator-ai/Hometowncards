import {NextRequest} from 'next/server';
import {authorized,db,failure,json,PortalError,audit} from '@/lib/server/portal';
export const runtime='nodejs';
const uuid=/^[a-f0-9-]{36}$/i,slots=/^(front|back|extra-[1-8])$/;
const bucket='card-listing-photos';
const supabaseUrl=(process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL||'').replace(/\/$/,'');
const key=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY||'';
type Item={id:string;seller_id:string;manual_image_url:string|null;manual_back_image_url:string|null};
type Photo={id:string;slot:string;storage_path:string;public_url:string};
async function locate(req:NextRequest,id:string,manage=true){
 const owner=await authorized(req,manage?'manage':'read');
 if(!uuid.test(id))throw new PortalError('Invalid listing ID.');
 const rows=await db<Item[]>('products?select=id,seller_id,manual_image_url,manual_back_image_url&seller_id=eq.'+owner.sellerId+'&id=eq.'+id+'&limit=1');
 if(!rows[0])throw new PortalError('Listing not found.',404);
 return {owner,product:rows[0]};
}
function signature(bytes:Uint8Array){
 const j=bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff;
 const p=bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71&&bytes[4]===13&&bytes[5]===10&&bytes[6]===26&&bytes[7]===10;
 const w=String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP';
 return j?'image/jpeg':p?'image/png':w?'image/webp':null;
}
function storageHeaders(){return {apikey:key,...(key.startsWith('sb_secret_')?{}:{Authorization:'Bearer '+key})};}
async function removeObject(path:string){
 if(!path)return;
 const u=supabaseUrl+'/storage/v1/object/'+bucket+'/'+path.split('/').map(encodeURIComponent).join('/');
 try{
  const res=await fetch(u,{method:'DELETE',headers:storageHeaders(),cache:'no-store'});
  if(!res.ok)console.error('Photo cleanup failed',res.status);
 }catch(err){console.error('Photo cleanup temporarily unavailable',err);}
}
async function rows(productId:string,sellerId:string,slot:string){
 return db<Photo[]>('product_images?select=id,slot,storage_path,public_url&seller_id=eq.'+sellerId+'&product_id=eq.'+productId+'&slot=eq.'+slot+'&limit=1');
}
export async function POST(req:NextRequest,ctx:{params:Promise<{id:string}>}){
 try{
  const {id}=await ctx.params;const {owner}=await locate(req,id);
  if(!supabaseUrl||!key)throw new PortalError('Photo storage is not connected.',503);
  const form=await req.formData();
  const file=form.get('file'),slot=String(form.get('slot')||'front');
  if(!slots.test(slot))throw new PortalError('Choose a front, back or extra photo slot.');
  if(!(file instanceof File)||file.size<100||file.size>3_800_000)throw new PortalError('Choose a JPG, PNG or WebP photo smaller than 3.8 MB.');
  const buffer=new Uint8Array(await file.arrayBuffer());
  const mime=signature(buffer);
  if(!mime||mime!==file.type)throw new PortalError('The uploaded image type does not match the file contents.');
  const ext=mime==='image/png'?'png':mime==='image/webp'?'webp':'jpg';
  const storagePath=owner.sellerId+'/'+id+'/'+crypto.randomUUID()+'.'+ext;
  const u=supabaseUrl+'/storage/v1/object/'+bucket+'/'+storagePath.split('/').map(encodeURIComponent).join('/');
  const response=await fetch(u,{method:'POST',headers:{...storageHeaders(),'Content-Type':mime,'x-upsert':'false','Cache-Control':'max-age=31536000'},body:buffer,cache:'no-store'});
  if(!response.ok){console.error('Photo storage upload error',response.status,(await response.text()).slice(0,300));throw new PortalError('The photo could not be uploaded.',502);}
  const url=supabaseUrl+'/storage/v1/object/public/'+bucket+'/'+storagePath.split('/').map(encodeURIComponent).join('/');
  let oldPath:string|null=null;
  try{
   oldPath=await db<string|null>('rpc/hcs_commit_product_photo',{
    method:'POST',body:JSON.stringify({p_seller:owner.sellerId,p_product:id,p_actor:owner.userId,
     p_slot:slot,p_storage_path:storagePath,p_public_url:url,p_type:mime,p_bytes:file.size})});
  }catch(err){await removeObject(storagePath);throw err;}
  if(oldPath)await removeObject(oldPath);
  await audit(owner.sellerId,owner.userId,'listing_photo_uploaded',id,null,{slot,storagePath,bytes:file.size});
  return json({ok:true,url,slot});
 }catch(e){return failure(e)}
}
export async function DELETE(req:NextRequest,ctx:{params:Promise<{id:string}>}){
 try{
  const {id}=await ctx.params;const {owner}=await locate(req,id);
  const body=await req.json() as {slot?:string};const slot=body.slot||'';
  if(!slots.test(slot))throw new PortalError('Invalid photo slot.');
  const oldPath=await db<string|null>('rpc/hcs_delete_product_photo',{
   method:'POST',body:JSON.stringify({p_seller:owner.sellerId,p_product:id,p_slot:slot})});
  if(oldPath)await removeObject(oldPath);
  await audit(owner.sellerId,owner.userId,'listing_photo_removed',id,{slot},null);
  return json({ok:true});
 }catch(e){return failure(e)}
}
