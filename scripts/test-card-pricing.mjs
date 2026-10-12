#!/usr/bin/env node
// Pure pricing-unit tests: compile the TypeScript module without starting Next.js or calling APIs.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const source=readFileSync(new URL('../lib/server/card-pricing.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const pricing=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
const now=Date.parse('2026-10-11T12:00:00Z');
let n=0;
const comp=(price,extra={})=>({id:'test-'+(++n),provider:'ebay_sold',observed_kind:'sold',
 evidence_status:'provider_verified',currency:'USD',price_cents:price,shipping_cents:100,
 observed_at:'2026-10-09T12:00:00Z',match_score:.99,included_in_estimate:true,
 card_title:'Matching 1987 baseball card',source_url:'https://www.ebay.com/itm/123',
 grade:'raw',card_variant:'base',...extra});
const verify=(items)=>pricing.evaluateSoldComparables(items,now);
assert.equal(verify([comp(100),comp(200)]).ready,false,'Two sales not enough');
assert.equal(verify([comp(100),comp(200),comp(300)]).suggestedPriceCents,200,'Median should be $2');
assert.equal(verify([comp(200),comp(200),comp(200),comp(999000)]).ready,true,'Outlier should be excluded');
assert.equal(verify([comp(100),comp(100),comp(999000)]).ready,false,'Outliers must not supply a third verified comp');
assert.equal(verify([comp(200),comp(200),comp(200),comp(100000,{observed_kind:'guide'}),
 comp(99900,{provider:'openai_web'}),comp(99900,{provider:'manual'})]).suggestedPriceCents,200,'Guides/web/manual cannot affect median');
assert.equal(verify([comp(200),comp(200),comp(200,{observed_at:'2024-01-01T12:00:00Z'})]).ready,false,'Stale sales excluded');
assert.equal(verify([comp(200),comp(200),comp(200,{evidence_status:'unverified'})]).ready,false,'Unverified sale excluded');
assert.equal(verify([comp(200),comp(200),comp(200,{match_score:.6})]).ready,false,'Poor matches excluded');
assert.equal(verify([comp(200),comp(200),comp(200,{included_in_estimate:false})]).ready,false,'Excluded comps cannot count');
assert.equal(verify([comp(200),comp(200),comp(200,{observed_kind:'asking'})]).ready,false,'Asking price excluded');
assert.equal(verify([comp(200),comp(200),comp(200,{currency:'EUR'})]).ready,false,'Unconverted currencies excluded');
assert.equal(verify([comp(200),comp(200),comp(200,{observed_at:'2026-11-11T12:00:00Z'})]).ready,false,'Future-dated sales excluded');
const varied=[comp(1000),comp(1100),comp(1150),comp(1200),comp(1100,{provider:'sportscardspro'}),comp(1250,{provider:'sportscardspro'})];
assert.equal(verify(varied).confidence,'high','Six sales from two eligible providers can be high confidence');
assert.match(pricing.ebaySoldResearchUrl('1987 Topps #45'),/LH_Sold=1/);
console.log('Card pricing safety checks passed.');
