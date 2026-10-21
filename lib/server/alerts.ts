import {brandedEmail,plainFor,sendEmail,SITE} from '@/lib/server/branded-email';
/** One centrally controlled destination for shop-operator alerts. */
export const SHOP_ALERT_EMAIL=process.env.STORE_ALERT_EMAIL||'altifygenerator@gmail.com';
export type ShopAlertKind='order'|'inventory'|'customer_message'|'seller_application'|'security'|'giveaway_entry';
export async function sendShopAlert(kind:ShopAlertKind,subject:string,text:string){
 if(!['order','inventory','customer_message','seller_application','security','giveaway_entry'].includes(kind))throw new Error('Invalid shop email type');
 const title=subject.replace(/^\[Hometown Card Shop\]\s*/,'');
 const html=brandedEmail(title,text,'Open the shop dashboard','/admin','Private shopkeeper notification.');
 await sendEmail(SHOP_ALERT_EMAIL,'[Hometown Card Shop] '+title,plainFor(title,'[Type: '+kind+']\n\n'+text,SITE+'/admin'),html);
}
