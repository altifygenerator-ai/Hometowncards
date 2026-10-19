import {createVerify} from 'node:crypto';

/**
 * eBay Notification API ECC webhook signatures use SHA-1 as the ECDSA digest,
 * unlike the SHA-256 used in the unrelated GET endpoint challenge hash.
 * Follows eBay's official event-notification-nodejs-sdk verifier algorithm
 * (its "ssl3-sha1" is equivalent to SHA-1 for ECDSA in Node/OpenSSL).
 * Never accept an event unless eBay's current public key verifies the payload.
 */
export function verifyEbayEccSignature(payload:string,signatureBase64:string,publicKeyPem:string):boolean {
 const verifier=createVerify('sha1');
 verifier.update(payload,'utf8');
 verifier.end();
 return verifier.verify(publicKeyPem,signatureBase64,'base64');
}
