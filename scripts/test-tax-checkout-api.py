#!/usr/bin/env python3
"""Verify real built Next.js tax quotes use state code only, not ZIP+4."""
import json
import urllib.error
import urllib.request

def quote(state,expected_rate):
    body={"state":state,"subtotalCents":1000,"shippingCents":199}
    req=urllib.request.Request("http://127.0.0.1:3195/api/tax/quote",
      data=json.dumps(body).encode(),headers={"Content-Type":"application/json"},method="POST")
    try:
        with urllib.request.urlopen(req,timeout=30) as resp:
            result=json.load(resp)
    except urllib.error.HTTPError as e:
        raise AssertionError(f"{state}: HTTP {e.code} "+e.read().decode()[:600])
    assert result["source"]=="state-base-2026-07", result
    assert abs(result["rate"]-expected_rate)<1e-9,result
    assert result["taxableCents"]==1199,result
    assert result["taxCents"]==int(1199*expected_rate+0.5),result
    assert result["totalCents"]==1199+result["taxCents"],result
    print(state,"rate",result["rate"],"tax",result["taxCents"],"total",result["totalCents"])

for state,rate in [
 ("AR",.065),("AK",0),("CA",.0725),("TX",.0625),("NY",.04),
 ("MN",.06875),("MO",.04225),("NM",.04875),("NJ",.06625),
 ("DE",0),("MT",0),("NH",0),("OR",0),("DC",.06),
]:
    quote(state,rate)
print("State base-rate API tests passed.")
