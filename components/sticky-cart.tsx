'use client';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {useEffect,useRef,useState} from 'react';
import {useCart} from '@/components/cart-provider';
import {formatMoney} from '@/lib/catalog';
import {bonusCount} from '@/lib/rewards';
import {Icon} from '@/components/icons';

/** An unobtrusive cart button that opens a full, editable side drawer. */
export function StickyCart(){
 const pathname=usePathname();
 const {lines,count,subtotal,change,remove,ready}=useCart();
 const [open,setOpen]=useState(false);
 const triggerRef=useRef<HTMLButtonElement>(null);
 const closeRef=useRef<HTMLButtonElement>(null);
 const drawerRef=useRef<HTMLElement>(null);

 useEffect(()=>{setOpen(false)},[pathname]);

 useEffect(()=>{
  if(!open)return;
  const overflow=document.body.style.overflow;
  document.body.style.overflow='hidden';
  closeRef.current?.focus();
  function onKeydown(event:KeyboardEvent){
   if(event.key==='Escape'){
    event.preventDefault();
    setOpen(false);
    triggerRef.current?.focus();
   }
   if(event.key!=='Tab'||!drawerRef.current)return;
   const elements=Array.from(drawerRef.current.querySelectorAll<HTMLElement>(
    'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])'
   ));
   if(!elements.length)return;
   const first=elements[0],last=elements[elements.length-1];
   if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
   else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  }
  document.addEventListener('keydown',onKeydown);
  return ()=>{document.body.style.overflow=overflow;document.removeEventListener('keydown',onKeydown)};
 },[open]);

 function closeCart(){
  setOpen(false);
  triggerRef.current?.focus();
 }

 // Checkout and admin screens already have their own navigation and controls.
 if(!ready||pathname==='/cart'||pathname.startsWith('/checkout')||pathname.startsWith('/admin'))return null;
 const bonuses=bonusCount(subtotal);

 return <>
  <button ref={triggerRef} type="button" className="hcs-cart-fab" onClick={()=>setOpen(true)}
   aria-label={count?'Open cart with '+count+' cards':'Open shopping cart'}
   aria-haspopup="dialog" aria-expanded={open} aria-controls="hcs-cart-drawer" title="My cart">
   <Icon name="bag" size={25}/>
   {count>0?<span className="hcs-cart-fab-count">{count>99?'99+':count}</span>:null}
  </button>
  {open?<div className="hcs-cart-layer">
   <button type="button" className="hcs-cart-backdrop" onClick={closeCart} aria-label="Close cart"/>
   <aside ref={drawerRef} id="hcs-cart-drawer" className="hcs-cart-drawer" role="dialog" aria-modal="true" aria-labelledby="hcs-cart-title">
    <div className="hcs-cart-drawer-head">
     <div><span className="hcs-cart-eyebrow">YOUR CARDS</span><h2 id="hcs-cart-title">My stack <small>({count})</small></h2></div>
     <button ref={closeRef} type="button" className="hcs-cart-close" onClick={closeCart} aria-label="Minimize cart"><Icon name="x" size={23}/></button>
    </div>
    {count===0?
     <div className="hcs-cart-empty">
      <Icon name="bag" size={44}/>
      <h3>Your stack is empty.</h3>
      <p>There's plenty of cardboard to look through.</p>
      <button type="button" className="hcs-cart-secondary" onClick={closeCart}>Keep browsing cards</button>
     </div>:
     <>
      <div className="hcs-cart-items">
       {lines.map(line=><article className="hcs-cart-item" key={line.key}>
        <Link href={'/cards/'+encodeURIComponent(line.id)} onClick={()=>setOpen(false)} className="hcs-cart-item-image">
         {line.image?<img src={line.image} alt="" loading="lazy" referrerPolicy="no-referrer"/>:<Icon name="bag" size={24}/>}
        </Link>
        <div className="hcs-cart-item-content">
         <span className="hcs-cart-item-sport">{line.sport}</span>
         <Link href={'/cards/'+encodeURIComponent(line.id)} onClick={()=>setOpen(false)} className="hcs-cart-item-title">{line.title}</Link>
         <span className="hcs-cart-item-price">{formatMoney(line.price)} each</span>
         <div className="hcs-cart-item-controls">
          <div className="hcs-cart-quantity">
           <button type="button" aria-label={'Remove one '+line.title}
            onClick={()=>line.quantity===1?remove(line.key):change(line.key,line.quantity-1)}><Icon name="minus" size={14}/></button>
           <span>{line.quantity}</span>
           <button type="button" aria-label={'Add one '+line.title}
            disabled={line.quantity>=line.maxQuantity}
            onClick={()=>change(line.key,line.quantity+1)}><Icon name="plus" size={14}/></button>
          </div>
          <button type="button" className="hcs-cart-remove" onClick={()=>remove(line.key)}>Remove</button>
         </div>
        </div>
        <strong className="hcs-cart-item-total">{formatMoney(line.price*line.quantity)}</strong>
       </article>)}
      </div>
      <div className="hcs-cart-drawer-bottom">
       {bonuses>0?<div className="hcs-cart-bonus"><Icon name="gift" size={17}/>{bonuses} free bonus {bonuses===1?'card':'cards'} with this order</div>:null}
       <div className="hcs-cart-subtotal"><span>Subtotal <small>({count} {count===1?'card':'cards'})</small></span><strong>{formatMoney(subtotal)}</strong></div>
       <p>Shipping and any applicable taxes are calculated at checkout.</p>
       <Link href="/cart#cart-checkout" className="hcs-cart-checkout" onClick={()=>setOpen(false)}>Review cart &amp; checkout <Icon name="arrow" size={18}/></Link>
       <button type="button" className="hcs-cart-secondary" onClick={closeCart}>Keep browsing / Minimize</button>
      </div>
     </>}
   </aside>
  </div>:null}
 </>;
}
