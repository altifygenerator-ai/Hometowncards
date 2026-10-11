import {redirect} from 'next/navigation';import type {Metadata} from 'next';import {portalContext} from '@/lib/server/portal';import {ShopkeeperDashboard} from '@/components/portal/dashboard';
export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Shopkeeper Dashboard',robots:{index:false,follow:false}};
export default async function Dashboard(){try{const context=await portalContext();return <ShopkeeperDashboard name={context.sellerName} email={context.email} sellerId={context.sellerId} platformRole={context.platformRole} shops={context.memberships.map(m=>({id:m.seller_id,name:m.sellers.display_name}))}/>;}catch{redirect('/admin')}}
