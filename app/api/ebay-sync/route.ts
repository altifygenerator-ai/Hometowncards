import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/server/portal';
import {appReady} from '@/lib/server/ebay';
import {performEbaySync} from '@/lib/server/ebay-sync';
export const runtime='nodejs';
export const maxDuration=60;
type Conn={seller_id:string};
async function run(req:NextRequest){
 const token=req.headers.get('authorization');
 const cronSecret=process.env.CRON_SECRET||process.env.EBAY_SYNC_SECRET;
 if(!cronSecret||token!=='Bearer '+cronSecret)
  return NextResponse.json({error:'Unauthorized'},{status:401});
 if(!appReady())return NextResponse.json({error:'eBay app credentials have not been configured.'},{status:503});
 try{
  const rows=await db<Conn[]>('ebay_connections?select=seller_id&status=eq.connected&order=updated_at.asc&limit=3');
  const outcomes=[];
  for(const row of rows){
   try{
    const result=await performEbaySync(row.seller_id);
    outcomes.push({sellerId:row.seller_id,ok:true,result});
  }catch(e){
    const message=e instanceof Error?e.message:'Unknown sync error';
    console.error('eBay scheduled sync failed',row.seller_id,message);
    await db('ebay_connections?seller_id=eq.'+row.seller_id,{method:'PATCH',
      headers:{Prefer:'return=minimal'},body:JSON.stringify({last_error:message.slice(0,350),updated_at:new Date().toISOString()})});
    outcomes.push({sellerId:row.seller_id,ok:false,error:message});
  }
  }
  return NextResponse.json({ok:outcomes.every(r=>r.ok),sellers:outcomes.length,results:outcomes},
   {headers:{'Cache-Control':'no-store'}});
 }catch(e){
  console.error('Scheduled eBay sync unavailable',e instanceof Error?e.message:'unknown');
  return NextResponse.json({error:'eBay synchronization is unavailable.'},{status:503});
 }
}
export const GET=run;
export const POST=run;
