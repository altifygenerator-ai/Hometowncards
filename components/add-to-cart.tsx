'use client';
import {useState} from 'react';
import type {Product} from '@/lib/catalog';
import {useCart} from './cart-provider';
import {Icon} from './icons';
export function AddToCart({product,wide=false}:{product:Product;wide?:boolean}){
 const {add,lines}=useCart();const [justAdded,setJustAdded]=useState(false);
 const line=lines.find(x=>x.key===`${product.sellerId}:${product.id}`);const maxed=(line?.quantity||0)>=product.quantity;
 return <button type="button" disabled={maxed||product.quantity<1} className={'add-btn '+(wide?'add-btn-wide':'')} onClick={()=>{add(product);setJustAdded(true);setTimeout(()=>setJustAdded(false),1800)}}>
 {maxed?<><Icon name="check" size={16}/> In cart</>:justAdded?<><Icon name="check" size={16}/> Added!</>:<><Icon name="plus" size={16}/> Add to cart</>}
 </button>;
}
