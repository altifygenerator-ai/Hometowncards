import {redirect} from 'next/navigation';
import {portalContext} from '@/lib/server/portal';
import {MarketingCampaignPanel} from '@/components/marketing-campaign-panel';
export const metadata={title:'Marketing emails | Hometown Card Shop',robots:{index:false,follow:false}};
export default async function MarketingAdminPage(){
 try{const c=await portalContext();if(c.platformRole!=='owner'&&c.platformRole!=='admin')redirect('/admin')}
 catch{redirect('/admin')}
 return <MarketingCampaignPanel/>;
}
