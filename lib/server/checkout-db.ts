import {PortalError} from '@/lib/server/portal';
const url=(process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL)?.replace(/\/$/,'');
const key=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;
export async function checkoutRpc<T>(functionName:string,args:Record<string,unknown>):Promise<T>{
 if(!url||!key)throw new PortalError('Checkout database is not available.',503);
 if(!/^hcs_(begin_checkout|attach_checkout|settle_checkout|abort_unattached_checkout|apply_seller_membership_event)$/.test(functionName))
  throw new PortalError('Unsupported checkout operation',500);
 const r=await fetch(url+'/rest/v1/rpc/'+functionName,{
  method:'POST',headers:{apikey:key,...(key.startsWith('sb_secret_')?{}:{Authorization:'Bearer '+key}),
    'Content-Type':'application/json'},body:JSON.stringify(args),cache:'no-store'});
 if(!r.ok){
  const body=(await r.text()).slice(0,250);
  console.error('Checkout database refused transaction',functionName,r.status,body);
  throw new PortalError('Checkout is unavailable or one of your cards is no longer available.',409);
 }
 const text=await r.text();return(text?JSON.parse(text):null) as T;
}
