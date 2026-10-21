import Link from 'next/link';
export const metadata={title:'Email confirmation needed | Hometown Card Shop'};
export default function EmailExpired(){return <main className="shell marketing-admin"><p className="kicker">HOMETOWN CARD SHOP</p><h1>That confirmation link has expired.</h1><p>Head back to the shop and sign up again. We’ll send you a fresh confirmation link.</p><Link className="button button-primary" href="/shop">Back to the marketplace</Link></main>}
