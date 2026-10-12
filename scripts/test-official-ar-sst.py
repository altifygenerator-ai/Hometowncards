#!/usr/bin/env python3
"""Offline checkout depends on accurate public state source files, not a paid API."""
import csv
import io
import time
import urllib.request
import zipfile

URL_RATE = "https://www.streamlinedsalestax.org/ratesandboundry/Rates/ARR2026Q4AUG28.csv"
URL_BOUNDARY = "https://www.streamlinedsalestax.org/ratesandboundry/Boundary/ARB2026Q4SEP17.zip"
AS_OF = "20261011"

def download(url):
    failure = None
    for _ in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "HometownCardShopTaxVerification/1.0"}), timeout=30) as response:
                blob = response.read(70_000_000)
                if not (200 <= len(blob) < 70_000_000):
                    raise ValueError("Unexpected source size")
                return blob
        except Exception as exc:
            failure = exc
            time.sleep(2)
    raise RuntimeError(f"Official source download failed: {type(failure).__name__}: {failure}")

def current(row):
    return len(row)>8 and row[7] <= AS_OF <= row[8]

rates = {}
for row in csv.reader(io.StringIO(download(URL_RATE).decode("utf-8-sig"))):
    if len(row) >= 9 and row[0] == "05" and current(row):
        rates[(row[1], row[2])] = float(row[3])
assert abs(rates.get(("45", "05"), 0) - 0.065) < 1e-9, "Arkansas state general merchandise tax is not 6.5%"
assert len(rates) >= 80, "Rate table unexpectedly small"
boundaries = 0
zips = set()
zip4s = 0
with zipfile.ZipFile(io.BytesIO(download(URL_BOUNDARY))) as zf:
    members = [n for n in zf.namelist() if n.lower().endswith((".csv",".txt"))]
    assert members, "No CSV in official boundary archive"
    for member in members:
        with zf.open(member) as raw:
            for line in io.TextIOWrapper(raw, encoding="utf-8-sig", newline=""):
                if not (line.startswith("4,") or line.startswith("Z,")):
                    continue
                row = next(csv.reader([line]))
                if len(row) < 26 or row[22] != "05" or not (row[1] <= AS_OF <= row[2]):
                    continue
                boundaries += 1
                if row[0] == "4":
                    zip4s += 1
                if len(row[17]) == 5:
                    zips.add(row[17])
assert len(zips) >= 100, "Boundary file missing ZIP coverage"
assert boundaries >= 1000 and zip4s >= 100, "Boundary file incomplete"
print(f"Official 2026 Q4 Arkansas tax sources OK: {len(rates)} jurisdiction rates, {boundaries} boundaries, {zip4s} ZIP+4 rows, {len(zips)} postal areas")
