import type {Metadata} from 'next';
export const metadata:Metadata={robots:{index:false,follow:false},title:'Your Cart'};
export default function CartLayout({children}:{children:React.ReactNode}){return children;}
