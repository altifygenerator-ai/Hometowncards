'use client';
import Link from 'next/link';
import {CartCheckout} from '@/components/cart-checkout';
import {DealerCheckout} from '@/components/dealer-checkout';
import {useMemo,useState} from 'react';
import {useCart} from '@/components/cart-provider';
import {Icon} from '@/components/icons';
import {bonusCount,nextReward} from '@/lib/rewards';
import type {CartLine} from '@/components/cart-provider';

const money=(n:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n/100);
const founder=(line:CartLine)=>line.sellerSlug==='hometown-card-shop';
// Cart values are display-only. The checkout RPC independently validates seller ownership,
// stock, prices, and bonus rewards; never use client cart totals as payment authority.
export default function CartPage(){
 const {lines,count,change,remove,ready}=useCart();
 const [sport,setSport]=useState('Any sport / Surprise mix');
 const deals=useMemo(()=>{
  const groups=new Map<string,{sellerId:string;sellerName:string;lines:CartLine[]}>();
  for(const line of lines){
   const key=line.sellerId||line.sellerName;
   if(!groups.has(key))groups.set(key,{sellerId:key,sellerName:line.sellerName,lines:[]});
   groups.get(key)!.lines.push(line);
  }
  return [...groups.values()].sort((a,b)=>Number(b.lines[0]?.sellerSlug==='hometown-card-shop')-Number(a.lines[0]?.sellerSlug==='hometown-card-shop'));
 },[lines]);
 const renderLines=(items:CartLine[])=>items.map(line=><article className="cart-line" key={line.key}>
  <Link href={'/cards/'+line.id} className="cart-line-image">{line.image?<img src={line.image} alt={line.title}/>:<div className="missing-art"><span>PHOTO<br/>PENDING</span></div>}</Link>
  <div className="cart-line-info"><span>{line.sport}</span><Link href={'/cards/'+line.id}>{line.title}</Link><b>{money(line.price)}</b><button className="remove-line" onClick={()=>remove(line.key)}>Remove</button></div>
  <div className="quantity-picker"><button aria-label={'Remove one '+line.title} onClick={()=>line.quantity===1?remove(line.key):change(line.key,line.quantity-1)}><Icon name="minus" size={14}/></button><span>{line.quantity}</span><button aria-label={'Add one '+line.title} disabled={line.quantity>=line.maxQuantity} onClick={()=>change(line.key,line.quantity+1)}><Icon name="plus" size={14}/></button></div>
 </article>);
 return <><div className="shop-intro cart-heading"><div className="shell"><span className="kicker">ONE DEAL PER SELLER</span><h1>Your deals.</h1><p>Shop every seller together. Each dealer has their own checkout and shipping.</p></div></div>
 <div className="shell" style={{paddingTop:24,paddingBottom:48}}>
 {ready&&!lines.length?<div className="empty-results"><Icon name="bag" size={45}/><h2>Your deals are empty.</h2><p>There's a whole lot of cardboard waiting for you.</p><Link className="button button-primary" href="/shop">Go find some cards <Icon name="arrow" size={17}/></Link></div>:null}
 {deals.map(deal=>{
  const subtotal=deal.lines.reduce((n,l)=>n+l.price*l.quantity,0);
  const hometown=deal.lines.every(founder);
  const bonus=hometown?bonusCount(subtotal):0;
  const next=hometown?nextReward(subtotal):null;
  return <section key={deal.sellerId} className="cart-layout" style={{marginBottom:32}}>
   <div className="cart-lines"><h2 style={{marginBottom:14}}>{deal.sellerName}</h2>{renderLines(deal.lines)}<Link href="/shop" className="continue-shopping">← Keep browsing all cards</Link></div>
   <aside className="cart-summary"><h2>{deal.sellerName} deal</h2>
    <div className="summary-line"><span>{deal.lines.reduce((n,l)=>n+l.quantity,0)} cards</span><b>{money(subtotal)}</b></div>
    <div className="summary-line"><span>Shipping</span><span>Calculated per seller</span></div>
    <div className="summary-total"><span>Merchandise subtotal</span><strong>{money(subtotal)}</strong></div>
    {hometown?<><div className="cart-rewards"><div className="cart-reward-top"><Icon name="gift" size={22}/><strong>{bonus>0?`${bonus} free bonus cards earned!`:'Your free cards start with the first purchase.'}</strong></div>
    {next?<><p>Just <b>{money(next.remaining)}</b> more in Hometown Card Shop merchandise to unlock {next.count} free cards.</p><div className="reward-meter"><div style={{width:Math.max(2,100*(subtotal/next.goal))+'%'}}/></div></>:<p>You’ve reached our top reward tier. 20 free bonus cards come with this order.</p>}</div>
    <label className="cart-sport-label" htmlFor="free-sport">Preferred bonus card sport</label><select id="free-sport" value={sport} onChange={e=>setSport(e.target.value)}><option>Any sport / Surprise mix</option><option>Baseball</option><option>Football</option><option>Basketball</option></select>
    <CartCheckout lines={deal.lines} bonusSport={sport}/>
    <div className="summary-fine">Only Hometown Card Shop merchandise earns our free bonus cards. Rewards never stack. Shipping and tax don't count toward the reward thresholds.</div></>:
    <><p className="summary-fine">This dealer's shipping and policies are separate from Hometown Card Shop. Cards from this shop do not qualify for Hometown's free-card rewards.</p>
    <DealerCheckout sellerId={deal.sellerId} lines={deal.lines}/></>}
   </aside>
  </section>
 })}
 {count>0&&<p className="summary-fine" style={{marginTop:12}}>Each deal is checked out separately. Payment is processed only by the seller whose items are in that deal.</p>}
 </div></>;
}
