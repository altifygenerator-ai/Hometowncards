import type {Metadata} from 'next';import {Icon} from '@/components/icons';
export const metadata:Metadata={title:'Store Administration',robots:{index:false,follow:false}};
export default function Admin(){return <main className="shell admin-closed"><Icon name="shield" size={42}/><h1>Store administration</h1><p>The private admin console is locked until Supabase authentication and role permissions are configured. Inventory currently comes from the snapshot of your eBay export.</p><p>No public inventory editing is available.</p></main>}
