import {randomBytes,createHash} from 'node:crypto';
export const SITE='https://www.hometowncardshop.com';
const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function brandedEmail(title:string,body:string,buttonLabel:string,href:string,footer='Thanks for stopping by.') {
 const url=href.startsWith('http')?href:SITE+href;
 const paragraphs=body.split(/\n\n/).map(p=>'<p style="margin:0 0 16px;line-height:1.65;color:#39495b">'+esc(p).replace(/\n/g,'<br>')+'</p>').join('');
 return '<div style="margin:0;background:#f6f3ec;padding:28px 12px;font-family:Arial,Helvetica,sans-serif;color:#132139"><div style="max-width:600px;margin:auto;background:#fff;border:1px solid #e2d8c6;border-radius:8px;overflow:hidden"><div style="background:#092c52;padding:22px 28px;color:#fff"><div style="font-size:12px;letter-spacing:3px;font-weight:bold">HOMETOWN</div><div style="font-family:Georgia,serif;font-size:26px;color:#f2c35a;font-weight:bold">CARD SHOP</div><div style="font-size:11px;color:#d2e1ef;margin-top:6px">A friendly place for cards, old and new.</div></div><div style="padding:30px 28px"><div style="font-size:11px;letter-spacing:2px;color:#a27720;font-weight:bold;text-transform:uppercase">A note from the shop</div><h1 style="font:700 27px Georgia,serif;line-height:1.2;color:#102d4b;margin:10px 0 20px">'+esc(title)+'</h1>'+paragraphs+'<p style="margin:24px 0"><a href="'+esc(url)+'" style="display:inline-block;background:#123c67;color:#fff;text-decoration:none;padding:13px 20px;border-radius:5px;font-weight:bold">'+esc(buttonLabel)+'</a></p><p style="font:italic 16px Georgia,serif;color:#596a7d">'+esc(footer)+'<br>— The Hometown Card Shop crew</p></div><div style="background:#f6f3ec;border-top:1px solid #e2d8c6;padding:16px 28px;font-size:11px;color:#657386">Hometown Card Shop · Amity, Arkansas · <a href="'+SITE+'/shop" style="color:#123c67">Visit the marketplace</a></div></div></div>';
}
export function plainFor(title:string,body:string,url:string,footer='Hometown Card Shop · Amity, Arkansas') {return title+'\n\n'+body+'\n\n'+url+'\n\n'+footer}
export function tokenHash(token:string){return createHash('sha256').update(token).digest('hex')}
export function newToken(){return randomBytes(32).toString('hex')}
export async function sendEmail(to:string,subject:string,text:string,html?:string,headers?:Record<string,string>){
 const key=process.env.RESEND_API_KEY,from=process.env.RESEND_FROM_EMAIL;
 if(!key||!from)throw new Error('Outbound email is not configured.');
 const payload:Record<string,unknown>={from,to:[to],reply_to:process.env.RESEND_REPLY_TO_EMAIL||'altifygenerator@gmail.com',subject,text};
 if(html)payload.html=html;
 if(headers)payload.headers=headers;
 const res=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify(payload),cache:'no-store'});
 if(!res.ok)throw new Error('Email could not be delivered.');
}
