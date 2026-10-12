import {redirect} from 'next/navigation';
import type {Metadata} from 'next';
import {portalContext} from '@/lib/server/portal';
import {ListingEditor} from '@/components/portal/listing-editor';
type Props={params:Promise<{id:string}>;searchParams:Promise<{seller?:string}>};
export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Edit Card Listing',robots:{index:false,follow:false}};
export default async function Page({params,searchParams}:Props){
 const {id}=await params;const {seller}=await searchParams;
 try{
  const access=await portalContext(seller||undefined);
  if(access.role==='staff')redirect('/admin/dashboard');
  return <section className="shell hcs-editor-page"><ListingEditor id={id} sellerId={access.sellerId}/></section>;
 }catch{redirect('/admin')}
}
