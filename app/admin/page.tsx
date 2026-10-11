import type {Metadata} from 'next';import {PortalLogin} from '@/components/portal/login';
export const metadata:Metadata={title:'Shopkeeper sign in',robots:{index:false,follow:false}};
export default function Admin(){return <section className="portal-login-wrap"><div className="portal-login-card"><div className="portal-sign">HOMETOWN <span>CARD SHOP</span><small>THE SHOPKEEPER'S DESK</small></div><h1>Welcome behind the counter.</h1><p>Sign in to manage cards, shipments, orders and your shop.</p><PortalLogin/></div></section>}
