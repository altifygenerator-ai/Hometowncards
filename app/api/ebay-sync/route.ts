import {NextRequest,NextResponse} from 'next/server';
export async function POST(request:NextRequest){
 const secret=process.env.EBAY_SYNC_SECRET;
 if(!secret)return NextResponse.json({error:'Sync has not been configured.'},{status:503});
 if(request.headers.get('authorization')!==`Bearer ${secret}`)return NextResponse.json({error:'Unauthorized'},{status:401});
 return NextResponse.json({error:'Connect eBay Production OAuth and an isolated Supabase database, then enable the inventory sync implementation. No inventory was changed.'},{status:503});
}
