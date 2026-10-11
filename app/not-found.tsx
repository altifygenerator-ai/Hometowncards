import Link from 'next/link';
export default function NotFound(){return <div className="shell empty-results" style={{minHeight:'54vh'}}><h1>We couldn't find that card.</h1><p>It may have been sold or the link has changed.</p><Link href="/shop" className="button button-primary">Back to the card boxes →</Link></div>}
