import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const read=path=>readFileSync(path,'utf8');
const source=read('lib/categories.ts');
const output=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {canonicalSport,shelvesWithCounts,SHELVES}=await import('data:text/javascript;base64,'+Buffer.from(output).toString('base64'));
const products=[
 {sport:'Baseball',sellerId:'founder'},
 {sport:'Pokemon',sellerId:'seller-two'},
 {sport:'Pokémon TCG',sellerId:'seller-three'},
 {sport:'Magic: The Gathering',sellerId:'seller-two'},
 {sport:'YuGiOh',sellerId:'seller-three'},
 {sport:'One Piece Card Game',sellerId:'seller-four'},
 {sport:'Other Trading Cards',sellerId:'seller-four'}
];
const shelves=shelvesWithCounts(products);
const count=slug=>shelves.find(s=>s.slug===slug)?.count;
assert.equal(count('baseball'),1);
assert.equal(count('pokemon'),2);
assert.equal(count('magic'),1);
assert.equal(count('yugioh'),1);
assert.equal(count('one-piece'),1);
assert.equal(count('other-trading-cards'),1);
assert.equal(count('sports-memorabilia'),0);
assert.equal(canonicalSport('MTG'),'Magic');
assert.equal(canonicalSport('NASCAR'),'Racing');
assert(SHELVES.find(s=>s.slug==='non-sport'),'Non-sport shelf must remain available');
const home=read('app/page.tsx');
const nav=read('components/site-header.tsx');
const shop=read('lib/catalog.ts');
const form=read('components/portal/new-card-listing.tsx');
const styles=read('app/globals.css');
const db=read('lib/catalog-db.ts');
assert(home.includes("priority=['baseball','football','basketball'"),'Baseball must come first');
assert(!home.includes("featuredNames.indexOf"),'Broken sort should be removed');
assert(home.includes('shelvesWithCounts(products)')&&home.includes('shelf-coming-soon'),'Live products must drive category labels');
assert(db.includes('sellers.status=eq.approved'),'Only approved sellers should count');
assert(db.includes('status=eq.published&stock=gt.0'),'Only sellable stock should count');
assert(shop.includes('const counts=new Map')&&shop.includes('SHELVES.map'),'Shop sport dropdown must be dynamic');
assert(form.includes('<select value={fields.sport}')&&form.includes('SHELVES.map'),'All sellers should choose defined categories');
assert(nav.includes('Trading card games')&&nav.includes('Pok%C3%A9mon')&&nav.includes('More'),'Navbar must offer TCG links');
assert(styles.includes('@media(max-width:1350px)')&&styles.includes('.nav.nav-open{display:block}'),'Responsive nav must not crop');
console.log('Multiple seller category growth, Pokémon/Magic/Yu-Gi-Oh normalization, future shelves and responsive menu tests passed.');
