import type { SVGProps } from 'react';
export function Icon({name,size=20,...props}:{name:'search'|'cart'|'arrow'|'gift'|'filter'|'x'|'menu'|'check'|'plus'|'minus'|'external'|'shield'|'truck'|'heart'|'bag',size?:number}&SVGProps<SVGSVGElement>){
 const base={width:size,height:size,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.85,strokeLinecap:'round' as const,strokeLinejoin:'round' as const,...props};
 const shapes:{[key:string]:React.ReactNode}={
 search:<><circle cx="10.8" cy="10.8" r="6.7"/><path d="m16 16 4.5 4.5"/></>,
 cart:<><path d="M3 4h2l2.2 11.5h11.6l2-8.5H6"/><circle cx="9" cy="20" r="1"/><circle cx="18" cy="20" r="1"/></>,
 arrow:<><path d="M4 12h16M14 6l6 6-6 6"/></>,
 gift:<><rect x="3" y="8" width="18" height="13" rx="1.5"/><path d="M2 8h20M12 8v13M12 8c-3.2 0-6-1.5-6-4a3 3 0 0 1 6-1c0 2.5 0 5 0 5Zm0 0c3.2 0 6-1.5 6-4a3 3 0 0 0-6-1c0 2.5 0 5 0 5Z"/></>,
 filter:<><path d="M4 7h16M7 12h10M10 17h4"/></>,x:<><path d="M5 5l14 14M19 5 5 19"/></>,
 menu:<><path d="M4 7h16M4 12h16M4 17h16"/></>,check:<path d="m5 12 4 4L19 6"/>,plus:<path d="M12 4v16M4 12h16"/>,minus:<path d="M4 12h16"/>,external:<><path d="M13 4h7v7M20 4 10 14"/><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h6"/></>,
 shield:<><path d="M12 2 20 6v5c0 6-3 9-8 11-5-2-8-5-8-11V6z"/><path d="m9 12 2 2 4-4"/></>,
 truck:<><path d="M2 6h12v12H2zM14 10h4l4 4v4h-8z"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="19" r="2"/></>,
 heart:<path d="M20.8 4.9a5.7 5.7 0 0 0-8.1 0l-.7.7-.7-.7a5.7 5.7 0 0 0-8.1 8.1L12 22l8.8-8.9a5.7 5.7 0 0 0 0-8.2Z"/>,
 bag:<><path d="M5 8h14l1 13H4L5 8Z"/><path d="M9 9V6a3 3 0 1 1 6 0v3"/></>};
 return <svg aria-hidden="true" {...base}>{shapes[name]}</svg>;
}
