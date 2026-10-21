import type {ReactNode} from 'react';

const art:Record<string,ReactNode>={
 baseball:<><circle cx="24" cy="24" r="18"/><path d="M17 9c-6 6-6 24 0 30M31 9c6 6 6 24 0 30M12.5 16l4 2m-4 5 4 1m-4 5 4-1m19-12-4 2m4 5-4 1m4 5-4-1"/></>,
 football:<><path d="M7 24c0-7 9-14 17-14s17 7 17 14-9 14-17 14S7 31 7 24Z"/><path d="m16 30 16-12M21 19l5 6m-9-2 5 6m6-13 5 6"/></>,
 basketball:<><circle cx="24" cy="24" r="18"/><path d="M24 6v36M6 24h36M11 11c9 7 17 19 26 26M37 11c-9 7-17 19-26 26"/></>,
 golf:<><circle cx="31" cy="34" r="5"/><path d="M31 29V7l11 5-11 5M9 39c5-2 10-2 15 0s10 2 15 0"/></>,
 motorsports:<><path d="M10 40V9m0 2h27v20H10"/><path d="M10 11h9v7h-9m18-7h9v7h-9M19 18h9v7h-9m9 0h9v6h-9m-18-6h9v6h-9"/></>,
 hockey:<><path d="m11 8 18 24-5 5L8 14m29-6L19 32l5 5 16-23"/><path d="M18 39h17"/></>,
 soccer:<><circle cx="24" cy="24" r="18"/><path d="m24 13 7 5-3 8h-8l-3-8 7-5Zm-7 5-9-3m17 9 8 6m-19-6-8 6m19-12 9-3m-18 9-2 12m10-12 2 12"/></>,
 wrestling:<><path d="M13 21c-3-2-6 0-6 4v7c0 4 3 6 7 5l6-3 2-8-4-5h-5Zm22 0c3-2 6 0 6 4v7c0 4-3 6-7 5l-6-3-2-8 4-5h5Z"/><path d="m18 23 4 4m8-4-4 4m-8 10 4 2m12-2-4 2"/></>,
 pokemon:<><circle cx="24" cy="24" r="18"/><path d="M6 24h12m12 0h12"/><circle cx="24" cy="24" r="5"/><path d="M24 6a18 18 0 0 1 18 18H29m-10 0H6A18 18 0 0 1 24 6Z"/></>,
 magic:<><path d="M7 15c6-2 12 0 17 4v21c-5-4-11-6-17-4V15Zm34 0c-6-2-12 0-17 4v21c5-4 11-6 17-4V15Z"/><path d="m32 5 1.7 4.3L38 11l-4.3 1.7L32 17l-1.7-4.3L26 11l4.3-1.7L32 5Z"/></>,
 yugioh:<><path d="M12 6h24v36H12z"/><path d="M16 11h16v13H16zM18 30h12m-12 5h9"/><path d="m24 14 2 3 4 .6-3 2.8.7 4-3.7-1.9-3.7 1.9.7-4-3-2.8 4-.6 2-3Z"/></>,
 'one-piece':<><path d="M6 35h36L36 41H13l-7-6Zm10-3V13l12 19m0 0V8l11 24M16 13h12M28 8h11"/><path d="M22 8h5l-2.5-3L22 8Zm8-2h5l-2.5-3L30 6Z"/></>,
 'other-trading-cards':<><path d="m14 8 24 4-5 30-24-4 5-30Z"/><path d="m18 14 13 2m-14 4 13 2"/><path d="M10 13 6 37l23 5"/></>,
 'non-sport':<><path d="M7 14h34v27H7z"/><path d="M7 20h34M7 35h34M13 14v6m8-6v6m8-6v6m8-6v6M13 35v6m8-6v6m8-6v6m8-6v6"/><path d="m20 24 10 5-10 5V24Z"/></>,
 graded:<><path d="M13 5h22a3 3 0 0 1 3 3v32H10V8a3 3 0 0 1 3-3Z"/><path d="M10 13h28M16 9h16v3H16zM16 19h16v14H16zM18 36h12"/></>,
 sealed:<><path d="M14 8h20l4 7-2 27H12l-2-27 4-7Z"/><path d="M14 8v7h20V8M10 15h28m-17 8 3-3 3 3v8l-3 3-3-3v-8Z"/></>,
 'sports-memorabilia':<><path d="M9 8h30v21H9zM9 29l15 12 15-12"/><path d="m24 12 2.3 4.5 5 .7-3.6 3.5.8 5-4.5-2.4-4.5 2.4.8-5-3.6-3.5 5-.7L24 12Z"/></>,
 collectibles:<><path d="M8 16h32v25H8zM6 11h36v5H6z"/><path d="M15 11V7h18v4m-10 9 2 4 4 .6-3 3 .7 4.4-3.7-2-3.7 2 .7-4.4-3-3 4-.6 2-4Z"/></>,
 'card-lots':<><path d="m9 13 23-5 7 29-23 5-7-29Z"/><path d="m14 18 15-3m-14 8 15-3"/><path d="m6 20 5 22 23-5"/></>,
 supplies:<><path d="M11 6h26v36H11z"/><path d="M16 12h16v23H16zM15 6v5m18-5v5m-9 29v3"/></>
};
const fallback=<><rect x="10" y="7" width="28" height="34" rx="2"/><path d="M16 15h16M16 21h16M16 27h11"/></>;
export function CategoryIcon({slug,className}:{slug:string;className?:string}){
 return <svg className={className} viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{art[slug]||fallback}</svg>;
}
