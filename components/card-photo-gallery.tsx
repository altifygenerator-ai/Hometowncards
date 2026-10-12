'use client';
import {useEffect,useState} from 'react';
type Photo={url:string;label:string};
export function CardPhotoGallery({title,front,back,extras}:{title:string;front:string;back:string;extras:Photo[]}){
 const photos:Photo[]=[...(front?[{url:front,label:'Front of card'}]:[]),
 ...(back&&back!==front?[{url:back,label:'Back of card'}]:[]),
 ...extras.filter(x=>x.url&&x.url!==front&&x.url!==back)];
 const [selected,setSelected]=useState(0),[zoom,setZoom]=useState(false);
 useEffect(()=>{if(!zoom)return;function key(e:KeyboardEvent){if(e.key==='Escape')setZoom(false);
  if(e.key==='ArrowRight')setSelected(x=>(x+1)%photos.length);
  if(e.key==='ArrowLeft')setSelected(x=>(x-1+photos.length)%photos.length);}
  window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);
 },[zoom,photos.length]);
 if(!photos.length)return <div className="detail-photo"><div className="missing-art"><span>PHOTO<br/>COMING SOON</span></div></div>;
 const current=photos[Math.min(selected,photos.length-1)];
 return <div className="hcs-gallery">
  <button type="button" className="hcs-gallery-main" onClick={()=>setZoom(true)} aria-label={'View larger image: '+current.label}>
   <img src={current.url} alt={current.label+' — '+title} referrerPolicy="no-referrer"/>
   <span className="hcs-gallery-hint">Click to enlarge ↗</span>
  </button>
  {photos.length>1&&<div className="hcs-gallery-thumbs" aria-label="Card images">
   {photos.map((p,i)=><button type="button" key={p.url+'-'+i} onClick={()=>setSelected(i)}
     aria-pressed={selected===i} aria-label={'Show '+p.label}>
     <img src={p.url} alt={p.label} loading="lazy" referrerPolicy="no-referrer"/>
   </button>)}
  </div>}
  {zoom&&<div className="hcs-zoom" role="dialog" aria-modal="true" aria-label={'Card photos for '+title}>
   <button className="hcs-zoom-close" onClick={()=>setZoom(false)} aria-label="Close large photo">×</button>
   <button className="hcs-zoom-image" onClick={()=>setZoom(false)} aria-label="Close large photo"><img src={current.url} alt={current.label+' — '+title} referrerPolicy="no-referrer"/></button>
   {photos.length>1&&<div className="hcs-zoom-nav"><button onClick={()=>setSelected(x=>(x-1+photos.length)%photos.length)}>← Previous</button><span>{selected+1} / {photos.length} · {current.label}</span><button onClick={()=>setSelected(x=>(x+1)%photos.length)}>Next →</button></div>}
  </div>}
 </div>;
}
