'use client';
import {useEffect,useRef,useState} from 'react';
import {useCart} from '@/components/cart-provider';
export function OrderConfirmation(){
 const [state,setState]=useState<'processing'|'paid'|'cancelled'>('processing');
 const [orderId,setOrderId]=useState('');
 const {remove}=useCart();const finished=useRef(false);
 useEffect(()=>{
  const session=new URLSearchParams(window.location.search).get('session_id')||'';
  if(!/^cs_[a-zA-Z0-9_]{10,200}$/.test(session))return;
  let stopped=false;let timer:ReturnType<typeof setTimeout>|undefined;let attempts=0;
  async function check(){
   if(stopped||++attempts>10)return;
   try{
    const r=await fetch('/api/orders/confirmation?session_id='+encodeURIComponent(session),{cache:'no-store'});
    const b=await r.json() as {state?:'processing'|'paid'|'cancelled';cartKeys?:string[];orderId?:string};
    if(stopped)return;
    if(b.state==='paid'&&Array.isArray(b.cartKeys)){
     if(!finished.current){finished.current=true;for(const k of b.cartKeys)remove(k)}
     setState('paid');setOrderId(b.orderId||'');return;
    }
    if(b.state==='cancelled'){setState('cancelled');return;}
   }catch{}
   timer=setTimeout(check,2500);
  }
  void check();return()=>{stopped=true;if(timer)clearTimeout(timer)};
 },[remove]);
 return <div role="status" aria-live="polite">
 {state==='paid'?<p><strong>Payment confirmed.</strong> Your purchased cards have been removed from this deal, and any other sellers' cards are still in your cart.{orderId&&<> Order reference: <code>{orderId}</code>.</>}</p>:
 state==='cancelled'?<p>The checkout session was cancelled. Your cards will remain in your deals.</p>:
 <p>We're checking the payment confirmation. This can take a moment. If you have a Stripe receipt, keep it until your order appears as paid.</p>}
 </div>;
}
