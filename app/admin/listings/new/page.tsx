import {redirect} from 'next/navigation';
import type {Metadata} from 'next';
import {portalContext} from '@/lib/server/portal';
import {NewCardListing} from '@/components/portal/new-card-listing';
type Props={searchParams:Promise<{seller?:string}>};
export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Add Card Listing',robots:{index:false,follow:false}};
export default async function Page({searchParams}:Props){
 const {seller}=await searchParams;
 try{const access=await portalContext(seller||undefined);
  if(access.role==='staff')redirect('/admin/dashboard');
  return <section className="shell hcs-editor-page"><NewCardListing sellerId={access.sellerId}/></section>;
 }catch{redirect('/admin')}
}
