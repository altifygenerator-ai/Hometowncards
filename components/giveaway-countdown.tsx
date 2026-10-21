'use client';
import {useEffect,useState} from 'react';
import {MUSIAL_GIVEAWAY_END_UTC} from '@/lib/giveaway-config';
function parts(){
 const ms=Math.max(0,new Date(MUSIAL_GIVEAWAY_END_UTC).getTime()-Date.now());
 const days=Math.floor(ms/86400000);
 const hours=Math.floor(ms%86400000/3600000);
 const minutes=Math.floor(ms%3600000/60000);
 const seconds=Math.floor(ms%60000/1000);
 return {days,hours,minutes,seconds,ended:ms<=0};
}
export function GiveawayCountdown(){
 const [remaining,setRemaining]=useState(parts);
 useEffect(()=>{const timer=window.setInterval(()=>setRemaining(parts()),1000);return()=>window.clearInterval(timer)},[]);
 if(remaining.ended)return <div className="giveaway-countdown-ended">Entries closed December 1, 2026 at 11:59 PM Central.</div>;
 return <div className="giveaway-clock" aria-label="Time remaining until December 1 giveaway deadline">
 {([['Days',remaining.days],['Hours',remaining.hours],['Minutes',remaining.minutes],['Seconds',remaining.seconds]] as const).map(([label,n])=>
  <span className="giveaway-clock-unit" key={label}><strong>{String(n).padStart(2,'0')}</strong><small>{label}</small></span>)}
 </div>;
}
