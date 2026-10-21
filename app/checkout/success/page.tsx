import Link from 'next/link';
export const metadata={title:'Thank you for your order'};
export default function CheckoutSuccess(){
 return <section className="shell editorial"><div className="editorial-prose">
 <span className="kicker">THANKS FOR SHOPPING SMALL</span>
 <h1>Thanks for your order.</h1>
 <p>If your payment succeeded, your seller has your order and will handle packing and shipping. Payment may take a moment to confirm; the Stripe checkout receipt is your payment confirmation.</p>
 <p>Each dealer fulfills their own orders. Free bonus cards are included only when you buy directly from Hometown Card Shop, not independent sellers.</p>
 <p>Need help with an order? Please contact the seller shown on the listing or email <a href="mailto:altifygenerator@gmail.com">altifygenerator@gmail.com</a>.</p>
 <Link className="button button-primary" href="/shop">Continue browsing</Link>
 <Link href="/cart" className="button button-outline">View my deals</Link>
 </div></section>;
}