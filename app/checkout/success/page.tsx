import Link from 'next/link';
export const metadata={title:'Thank you for visiting'};
export default function CheckoutSuccess(){
 return <section className="shell editorial"><div className="editorial-prose">
 <span className="kicker">THANKS FOR SHOPPING SMALL</span>
 <h1>Those cards are almost yours.</h1>
 <p>Thanks for stopping by Hometown Card Shop. We’re confirming your payment and will email you when your order is ready to ship. Your free cards will be tucked in with the rest.</p>
 <p>If you need a hand, just email <a href="mailto:altifygenerator@gmail.com">altifygenerator@gmail.com</a>.</p>
 <Link className="button button-primary" href="/shop">Look through more cards</Link>
 </div></section>
}
