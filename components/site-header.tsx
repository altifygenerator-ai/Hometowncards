'use client';
import Link from 'next/link';import {useState} from 'react';
import {useCart} from './cart-provider';import {Icon} from './icons';
export function Header(){const {count}=useCart();const [menu,setMenu]=useState(false);
return <><div className="shop-awning" aria-hidden="true"/><div className="announcement"><div className="shell announce-inner"><span>A hometown card shop · Based in Arkansas</span><span><Icon name="gift" size={15}/> <b>FREE cards with Hometown Card Shop purchases</b> · No minimum <Link href="/help#rewards">See how it works →</Link></span></div></div>
<header className="header"><div className="shell header-inner"><Link href="/" className="brand shop-brand" aria-label="Hometown Card Shop home"><span className="brand-emblem"><img src="/images/hometown-card-shop-mark.svg" width="83" height="82" alt=""/></span><span className="brand-copy"><strong>HOMETOWN<br/><em>CARD SHOP</em></strong><small>YOUR NEIGHBORHOOD CARD COUNTER</small></span></Link>
<form action="/shop" className="header-search"><Icon name="search" size={19}/><input name="search" type="search" aria-label="Search the card shop" placeholder="Search a player, team, set, year..."/><button type="submit">Find it</button></form>
<div className="header-actions"><Link href="/cart" className="cart-link"><Icon name="bag" size={22}/><span>My deals</span>{count>0?<b>{count}</b>:null}</Link><button className="mobile-toggle" aria-label="Toggle menu" aria-expanded={menu} onClick={()=>setMenu(!menu)}><Icon name={menu?'x':'menu'} size={25}/></button></div></div>
<nav className={'nav '+(menu?'nav-open':'')} aria-label="Main navigation"><div className="shell nav-inner">
<Link onClick={()=>setMenu(false)} href="/shop">Shop all cards</Link>
<Link onClick={()=>setMenu(false)} href="/sports/baseball">Baseball</Link>
<Link onClick={()=>setMenu(false)} href="/sports/football">Football</Link>
<Link onClick={()=>setMenu(false)} href="/sports/basketball">Basketball</Link>
<Link onClick={()=>setMenu(false)} href="/shop?sport=Other+Cards">Other cards</Link>
<details className="nav-dropdown"><summary>Trading card games <span aria-hidden="true">⌄</span></summary>
 <div className="nav-dropdown-list">
  <Link onClick={()=>setMenu(false)} href="/shop?sport=Pok%C3%A9mon">Pokémon</Link>
  <Link onClick={()=>setMenu(false)} href="/shop?sport=Magic">Magic: The Gathering</Link>
  <Link onClick={()=>setMenu(false)} href="/shop?sport=Yu-Gi-Oh%21">Yu-Gi-Oh!</Link>
  <Link onClick={()=>setMenu(false)} href="/shop?sport=One+Piece">One Piece</Link>
  <Link onClick={()=>setMenu(false)} href="/categories">All card categories →</Link>
 </div>
</details>
<Link onClick={()=>setMenu(false)} href="/categories">All categories</Link>
<span className="nav-space"/>
<Link onClick={()=>setMenu(false)} href="/help#rewards" className="nav-gift"><Icon name="gift" size={15}/> Hometown rewards</Link>
<Link onClick={()=>setMenu(false)} href="/sellers">Our sellers</Link>
<details className="nav-dropdown"><summary>More <span aria-hidden="true">⌄</span></summary>
 <div className="nav-dropdown-list">
  <Link onClick={()=>setMenu(false)} href="/giveaway">Musial giveaway</Link>
  <Link onClick={()=>setMenu(false)} href="/sell">Sell your cards</Link>
  <Link onClick={()=>setMenu(false)} href="/about">Our story</Link>
 </div>
</details>
</div></nav></header></>;}
