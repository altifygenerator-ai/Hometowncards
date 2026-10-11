'use client';
import {createContext,useContext,useEffect,useState} from 'react';
import type {Product} from '@/lib/catalog';
export type CartLine = {id:string;key:string;sellerId:string;sellerName:string;title:string;price:number;image:string;sport:string;quantity:number;maxQuantity:number};
type CartContext = {lines:CartLine[];add:(p:Product)=>void;change:(id:string,qty:number)=>void;remove:(id:string)=>void;count:number;subtotal:number;ready:boolean};
const Context=createContext<CartContext|null>(null);
const KEY='hometown-card-shop-cart-v2';
const LEGACY_KEY='hometown-cards-ar-cart-v1';
export function CartProvider({children}:{children:React.ReactNode}){
 const [lines,setLines]=useState<CartLine[]>([]);const [ready,setReady]=useState(false);
 useEffect(()=>{try{const saved=localStorage.getItem(KEY)||localStorage.getItem(LEGACY_KEY);if(saved){const parsed=JSON.parse(saved) as CartLine[];if(Array.isArray(parsed))setLines(parsed.filter(x=>x&&x.id&&x.quantity>0).slice(0,200).map(x=>({...x,sellerId:x.sellerId||'hometown',sellerName:x.sellerName||'Hometown Card Shop',key:x.key||`${x.sellerId||'hometown'}:${x.id}`})));}}catch{}setReady(true)},[]);
 useEffect(()=>{if(ready)localStorage.setItem(KEY,JSON.stringify(lines));},[lines,ready]);
 const add=(p:Product)=>setLines(old=>{const id=`${p.sellerId}:${p.id}`;const found=old.find(x=>x.key===id);if(found)return old.map(x=>x.key===id?{...x,quantity:Math.min(p.quantity,x.quantity+1)}:x);return [...old,{key:id,sellerId:p.sellerId,sellerName:p.sellerName,id:p.id,title:p.title,price:p.price,image:p.image,sport:p.sport,quantity:1,maxQuantity:p.quantity}];});
 const change=(id:string,qty:number)=>setLines(old=>old.map(x=>x.key===id?{...x,quantity:Math.max(1,Math.min(x.maxQuantity,qty))}:x));
 const remove=(id:string)=>setLines(old=>old.filter(x=>x.key!==id));
 const count=lines.reduce((n,x)=>n+x.quantity,0),subtotal=lines.reduce((n,x)=>n+x.quantity*x.price,0);
 return <Context.Provider value={{lines,add,change,remove,count,subtotal,ready}}>{children}</Context.Provider>;
}
export function useCart(){const ctx=useContext(Context);if(!ctx)throw new Error('useCart must be used inside CartProvider');return ctx;}
