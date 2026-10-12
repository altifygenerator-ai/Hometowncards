#!/usr/bin/env python3
"""Exercise the actual production-built Next.js tax API without a payment or Stripe key."""
import json
import pathlib
import urllib.error
import urllib.request
zip4=pathlib.Path('/tmp/hcs-ar-sample-zip.txt').read_text().strip()
data={
 'address':{'name':'Tax Test Customer','line1':'100 Test Road','line2':'','city':'Test City',
            'state':'AR','postalCode':zip4,'country':'US'},
 'subtotalCents':1000,'shippingCents':199
}
r=urllib.request.Request('http://127.0.0.1:3195/api/tax/quote',
 data=json.dumps(data).encode('utf-8'),headers={'Content-Type':'application/json'},method='POST')
try:
 with urllib.request.urlopen(r,timeout=90) as resp: result=json.load(resp)
except urllib.error.HTTPError as err:
 raise AssertionError('Tax API failed ('+str(err.code)+'): '+err.read().decode('utf-8')[:800])
assert result['source']=='ar-sst-2026q4',result
assert 0.065<=result['rate']<=0.16,result
assert result['taxableCents']==1199,result
assert result['taxCents']==round(1199*result['rate']),result
assert result['totalCents']==1199+result['taxCents'],result
print('Next.js tax quote verified:',zip4,'rate=',result['rate'],'tax cents=',result['taxCents'])
