import type {Metadata} from 'next';
import {CartProvider} from '@/components/cart-provider';import {Header} from '@/components/site-header';import {Footer} from '@/components/site-footer';
import './globals.css';
import '@/components/sticky-cart.css';
import {StickyCart} from '@/components/sticky-cart';
const site=process.env.NEXT_PUBLIC_SITE_URL||'http://localhost:3000';
export const metadata:Metadata={metadataBase:new URL(site),title:{default:'Hometown Card Shop | Your Neighborhood Card Shop Online',template:'%s | Hometown Card Shop'},description:'Pull up a stool and shop sports trading cards by player, team, sport, year and set. One free bonus card with every purchase, more with bigger orders. From Amity, Arkansas.',openGraph:{title:'Hometown Card Shop',description:'An old-school neighborhood card shop, now online. Real cards, fair prices and free cards with every purchase.',type:'website'},robots:process.env.NEXT_PUBLIC_STORE_LIVE==='true'?{index:true,follow:true}:{index:false,follow:false}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body><CartProvider><Header/><main>{children}</main><StickyCart/><Footer/></CartProvider></body></html>}
