/** One centrally controlled destination for all shop-operator alerts.
 * Not yet wired to order events: add idempotent notifications alongside live checkout.
 */
export const SHOP_ALERT_EMAIL=process.env.STORE_ALERT_EMAIL||'altifygenerator@gmail.com';
export type ShopAlertKind='order'|'inventory'|'customer_message'|'seller_application'|'security';
export async function sendShopAlert(kind:ShopAlertKind,subject:string,text:string){
 const key=process.env.RESEND_API_KEY,from=process.env.RESEND_FROM_EMAIL;
 const replyTo=process.env.RESEND_REPLY_TO_EMAIL||'altifygenerator@gmail.com';
 if(!key||!from)throw new Error('Outbound shop email is not configured.');
 if(!['order','inventory','customer_message','seller_application','security'].includes(kind))throw new Error('Invalid shop email type');
 const res=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},
  body:JSON.stringify({from,to:[SHOP_ALERT_EMAIL],reply_to:replyTo,subject:'[Hometown Card Shop] '+subject,text:('[Type: '+kind+']\n\n'+text).slice(0,12000)}),cache:'no-store'});
 if(!res.ok)throw new Error('Shop alert could not be sent.');
}
