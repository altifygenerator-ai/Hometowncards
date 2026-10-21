import type {NextRequest} from 'next/server';
import {PortalError} from '@/lib/server/portal';

/** Always check challenge tokens on the SERVER. Missing production keys fail closed. */
export async function verifyTurnstile(token:unknown,action:'admin-login'|'customer-contact'|'checkout'|'seller-interest'|'seller-register'|'giveaway-entry'|'marketing-signup',req:NextRequest){
 const secret=process.env.TURNSTILE_SECRET_KEY;
 if(!secret)throw new PortalError('Verification is temporarily unavailable. Please try again later.',503);
 if(typeof token!=='string'||!token||token.length>2048)throw new PortalError('Please complete the security check.',400);
 const fields=new URLSearchParams({secret,response:token});
 const forwarded=req.headers.get('x-vercel-forwarded-for');
 if(forwarded&&/^[\d.a-fA-F:]+$/.test(forwarded))fields.set('remoteip',forwarded);
 let result:{success?:boolean;action?:string;hostname?:string};
 try{
  const res=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{
    method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
    body:fields.toString(),signal:AbortSignal.timeout(6000),cache:'no-store'
  });
  if(!res.ok)throw new Error('challenge unavailable');
  result=await res.json();
 }catch{throw new PortalError('Security verification is unavailable right now. Please retry.',503)}
 if(!result.success||result.action!==action)throw new PortalError('Security check failed or expired. Please try again.',403);
 if(result.hostname&&result.hostname.toLowerCase()!==req.nextUrl.hostname.toLowerCase())
  throw new PortalError('Security verification did not match this website.',403);
}
