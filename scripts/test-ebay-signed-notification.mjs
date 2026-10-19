import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createSign,generateKeyPairSync} from 'node:crypto';
import ts from 'typescript';

// Load the same verifier used by production; don't copy its verification code in the test.
const source=readFileSync('lib/server/ebay-signature.ts','utf8');
const js=ts.transpileModule(source,{compilerOptions:{
 module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022
}}).outputText;
const {verifyEbayEccSignature}=await import(
 'data:text/javascript;base64,'+Buffer.from(js).toString('base64')
);
const {publicKey,privateKey}=generateKeyPairSync('ec',{namedCurve:'prime256v1'});
const pem=publicKey.export({type:'spki',format:'pem'});
const event={metadata:{topic:'MARKETPLACE_ACCOUNT_DELETION',schemaVersion:'1.0'},
 notification:{notificationId:'test-notification-12345',
  data:{username:'verification-only-not-real'}}};
const payload=JSON.stringify(event);
function sign(algorithm,message){
 const signer=createSign(algorithm);signer.update(message,'utf8');signer.end();
 return signer.sign(privateKey,'base64');
}
const signature=sign('sha1',payload);
assert.equal(verifyEbayEccSignature(payload,signature,pem),true,
 'Real ECDSA/SHA1 signature should verify');
assert.equal(verifyEbayEccSignature(payload+' ',signature,pem),false,
 'Payload changes must invalidate signed notifications');
assert.equal(verifyEbayEccSignature(payload,sign('sha256',payload),pem),false,
 'SHA256 signatures must not be accepted for this eBay SHA1 notification format');
const unrelated=generateKeyPairSync('ec',{namedCurve:'prime256v1'});
assert.equal(verifyEbayEccSignature(payload,signature,unrelated.publicKey.export({type:'spki',format:'pem'})),false,
 'Wrong key cannot authorize an account deletion');
const route=readFileSync('app/api/ebay/marketplace-account-deletion/route.ts','utf8');
assert(route.includes('EbayInvalidNotificationSignature?412:503'),
 'Bad signatures must get HTTP 412, not trigger an endless 503 retry');
const server=readFileSync('lib/server/ebay-deletion.ts','utf8');
assert(server.includes('verifyEbayEccSignature(JSON.stringify(message),decoded.signature,pem)'),
 'Signed notification handler must invoke the SHA1 ECC verifier');
console.log('eBay signed notification verification: valid SHA1 accepted; tampered, SHA256 and wrong-key signatures rejected.');
