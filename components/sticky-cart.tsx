'use client';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {useCart} from '@/components/cart-provider';
import {formatMoney} from '@/lib/catalog';
import {Icon} from '@/components/icons';

/** A compact, always-visible reminder of the buyer's stack while browsing. */
export function StickyCart(){
 const pathname=usePathname();
 const {lines,count,subtotal,ready}=useCart();
 if(!ready||count===0||pathname.startsWith('/admin')||pathname.startsWith('/checkout'))return null;
 const onCart=pathname==='/cart';
 const latest=lines[lines.length-1];
 return <>
  <div className="sticky-cart-spacer" aria-hidden="true"/>
  <aside className="sticky-cart-rail" aria-label="Your shopping cart">
   <div className="sticky-cart-preview">
    {latest?.image?<img src={latest.image} alt="" loading="lazy" referrerPolicy="no-referrer"/>:<Icon name="bag" size={24}/>}
   </div>
   <div className="sticky-cart-info" aria-live="polite">
    <strong>{count} {count===1?'card':'cards'} in your stack</strong>
    <span className="sticky-cart-latest">{onCart?'Review your stack and shipping options':latest?.title||'Your cards are saved in the cart'}</span>
    <span className="sticky-cart-subtotal">{formatMoney(subtotal)} <small>before shipping &amp; tax</small></span>
   </div>
   <Link className="sticky-cart-action" href={onCart?'#cart-checkout':'/cart'}>
    {onCart?'Review checkout':'View cart'} <Icon name="arrow" size={17}/>
   </Link>
  </aside>
 </>;
}
