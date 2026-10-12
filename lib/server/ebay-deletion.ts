import 'server-only';
import {createHash,createHmac,createPublicKey,createVerify} from 'node:crypto';

const ENDPOINT='https://www.hometowncardshop.com/api/ebay/marketplace-account-deletion';
const publicKeys=new Map<string,{pem:string,expiresAt:number}>();
let appToken:{value:string,expiresAt:number}|null=null;
export function deletionEndpoint(){return ENDPOINT;}

/**
 * eBay challenges the exact HTTPS destination URL (not an OAuth RuName).
 * See eBay Marketplace Account Deletion > Validating the endpoint.
 */
export function deletionChallengeResponse(challenge:string,verificationToken:string){
 if(!/^[A-Za-z0-9_-]{32,80}$/.test(verificationToken))
  throw new Error('eBay deletion verification token must contain 32-80 letters, digits, _ or -');
 if(!challenge||challenge.length>512)throw new Error('Invalid eBay deletion challenge');
 return createHash('sha256').update(challenge+verificationToken+ENDPOINT,'utf8').digest('hex');
}
export function ebayIdentityHash(value:string){
 const pepper=process.env.EBAY_TOKEN_ENCRYPTION_KEY;
 if(!pepper)throw new Error('Missing private eBay account identity hash key');
 return createHmac('sha256',pepper).update('hcs-ebay-account-identity-v1\0'+value,'utf8').digest('hex');
}
async function applicationToken(){
 if(appToken&&appToken.expiresAt>Date.now()+60000)return appToken.value;
 const id=process.env.EBAY_CLIENT_ID,secret=process.env.EBAY_CLIENT_SECRET;
 if(!id||!secret)throw new Error('eBay production API credentials are not configured');
 const res=await fetch('https://api.ebay.com/identity/v1/oauth2/token',{
  method:'POST',
  headers:{Authorization:'Basic '+Buffer.from(id+':'+secret).toString('base64'),
   'Content-Type':'application/x-www-form-urlencoded'},
  body:new URLSearchParams({grant_type:'client_credentials',
   scope:'https://api.ebay.com/oauth/api_scope'}).toString(),
  cache:'no-store',signal:AbortSignal.timeout(12000)
 });
 if(!res.ok)throw new Error('eBay application token request failed ('+res.status+')');
 const data=await res.json() as {access_token?:string,expires_in?:number};
 if(!data.access_token)throw new Error('eBay application token missing');
 appToken={value:data.access_token,expiresAt:Date.now()+Math.max(60,Number(data.expires_in)||600)*1000};
 return data.access_token;
}
async function getSigningKey(kid:string):Promise<string>{
 const cached=publicKeys.get(kid);
 if(cached&&cached.expiresAt>Date.now())return cached.pem;
 const access=await applicationToken();
 const response=await fetch(
  'https://api.ebay.com/commerce/notification/v1/public_key/'+encodeURIComponent(kid),
  {headers:{Authorization:'Bearer '+access,Accept:'application/json'},cache:'no-store',
   signal:AbortSignal.timeout(12000)}
 );
 if(!response.ok)throw new Error('eBay signing key retrieval failed ('+response.status+')');
 const result=await response.json() as {key?:string};
 if(!result.key)throw new Error('eBay signing key was missing');
 const bytes=result.key.trim().replace(/-----BEGIN PUBLIC KEY-----/g,'')
  .replace(/-----END PUBLIC KEY-----/g,'').replace(/\s/g,'');
 if(!/^[A-Za-z0-9+/=]{80,3000}$/.test(bytes))
  throw new Error('Invalid eBay ECC public-key format');
 const pem='-----BEGIN PUBLIC KEY-----\n'+bytes.match(/.{1,64}/g)?.join('\n')+
  '\n-----END PUBLIC KEY-----';
 createPublicKey(pem);
 publicKeys.set(kid,{pem,expiresAt:Date.now()+3600000});
 if(publicKeys.size>100)publicKeys.delete(publicKeys.keys().next().value!);
 return pem;
}
export async function verifyEbayNotification(message:unknown,signatureHeader:string|null){
 if(!signatureHeader||signatureHeader.length>2500)throw new Error('eBay signature header missing');
 let decoded:{kid?:string,signature?:string};
 try{decoded=JSON.parse(Buffer.from(signatureHeader,'base64').toString('utf8'))}
 catch{throw new Error('Invalid eBay signature header');}
 if(!decoded.kid||!decoded.signature||
  !/^[A-Za-z0-9_-]{1,150}$/.test(decoded.kid)||
  !/^[A-Za-z0-9+/=]{70,3000}$/.test(decoded.signature))
  throw new Error('Invalid eBay signing key or signature');
 const pem=await getSigningKey(decoded.kid);
 const verifier=createVerify('sha256');
 verifier.update(JSON.stringify(message),'utf8');verifier.end();
 if(!verifier.verify(pem,decoded.signature,'base64'))
  throw new Error('The eBay notification signature could not be verified');
}
