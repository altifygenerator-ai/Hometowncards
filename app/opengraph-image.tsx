import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Hometown Card Shop - Sports & Trading Cards';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() {
 return new ImageResponse(
  <div style={{width:'100%',height:'100%',display:'flex',position:'relative',flexDirection:'column',alignItems:'center',justifyContent:'center',background:'linear-gradient(120deg,#07172b 0%,#143c65 52%,#081a34 100%)',border:'18px solid #c82234',color:'#fff9ed',overflow:'hidden'}}>
   <div style={{position:'absolute',top:40,left:52,display:'flex',gap:20,transform:'rotate(-11deg)',opacity:.58}}>
    <div style={{width:158,height:218,display:'flex',background:'#fff9ed',padding:13,borderRadius:12}}>
     <div style={{display:'flex',background:'#163d66',width:'100%',alignItems:'center',justifyContent:'center',fontSize:85,color:'#faf6ee'}}>⚾</div>
    </div>
   </div>
   <div style={{position:'absolute',right:55,top:55,display:'flex',transform:'rotate(12deg)',opacity:.58}}>
    <div style={{width:158,height:218,display:'flex',background:'#fff9ed',padding:13,borderRadius:12}}>
     <div style={{display:'flex',background:'#163d66',width:'100%',alignItems:'center',justifyContent:'center',fontSize:85}}>🏀</div>
    </div>
   </div>
   <div style={{display:'flex',fontWeight:900,fontSize:109,letterSpacing:-5,textShadow:'5px 7px 0 #071323'}}>HOMETOWN</div>
   <div style={{display:'flex',background:'#c92134',border:'5px solid #f7e8d3',padding:'10px 64px 16px',fontSize:70,fontWeight:900,letterSpacing:2,transform:'rotate(-1deg)',marginTop:-8}}>CARD SHOP</div>
   <div style={{display:'flex',fontSize:27,letterSpacing:8,fontWeight:800,marginTop:32}}>SPORTS &amp; TRADING CARDS</div>
   <div style={{display:'flex',fontSize:24,letterSpacing:4,marginTop:28,color:'#f3bf77',fontWeight:700}}>AMITY, ARKANSAS  ·  FREE CARDS WITH EVERY ORDER</div>
  </div>, size
 );
}