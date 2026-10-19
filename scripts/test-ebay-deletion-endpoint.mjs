import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const token=process.env.EBAY_DELETION_VERIFICATION_TOKEN;
assert(token,'CI notification verification token must be supplied');
const endpoint='https://www.hometowncardshop.com/api/ebay/marketplace-account-deletion';
const local='http://127.0.0.1:3195/api/ebay/marketplace-account-deletion';
const challenge='hcs-verified-ebay-test-2026';
const res=await fetch(local+'?challenge_code='+encodeURIComponent(challenge));
assert.equal(res.status,200,'eBay GET challenge request must return 200');
assert.match(res.headers.get('content-type')||'',/application\/json/);
const json=await res.json();
assert.deepEqual(json,{challengeResponse:createHash('sha256')
 .update(challenge+token+endpoint,'utf8').digest('hex')});
const invalid=await fetch(local);
assert.equal(invalid.status,400,'GET without challenge should not claim verification');
const malformed=await fetch(local,{method:'POST',
 headers:{'Content-Type':'application/json'},
 body:JSON.stringify({metadata:{topic:'MARKETPLACE_ACCOUNT_DELETION'},
 notification:{notificationId:'test-invalid-signature-001',data:{username:'fake-account'}}})});
assert.equal(malformed.status,412,'eBay requires a 412 rejection for unsigned or invalidly signed POST requests');
console.log('Official eBay endpoint GET challenge and POST signature protection passed');
