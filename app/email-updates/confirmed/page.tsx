import Link from 'next/link';
export const metadata={title:'Email updates confirmed | Hometown Card Shop'};
export default function EmailConfirmed(){return <main className="shell marketing-admin"><p className="kicker">HOMETOWN CARD SHOP</p><h1>You’re on the list.</h1><p>Thanks for signing up. We’ll send the occasional new seller note, fresh card arrivals, and shop promotions. You can unsubscribe from any marketing email.</p><Link className="button button-primary" href="/shop">Browse the marketplace</Link></main>}
