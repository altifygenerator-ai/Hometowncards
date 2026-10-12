import Link from 'next/link';
export const metadata={title:'Shipping & Returns',description:'Affordable shipping for sports and trading cards at Hometown Card Shop, with letter, tracked and insured parcel options.',alternates:{canonical:'/shipping'}};
export default function Shipping(){return <><section className="inner-hero"><div className="shell">
 <span className="kicker">GOOD CARDS, PACKED RIGHT</span><h1>Shipping &amp; returns.</h1>
 <p>Keeping shipping affordable without leaving valuable cards unprotected.</p>
 </div></section><section className="shell policy-page">
 <div><h2>Our shipping options</h2>
 <p><strong>Economy letter:</strong> For small, inexpensive orders that physically qualify for USPS letter mail. This is the lowest-cost option, but it has no ordinary package tracking. We only offer it for qualifying orders under $20.</p>
 <p><strong>Tracked parcel:</strong> For higher-value cards or anyone who wants tracking. Our standard parcel option uses USPS Ground Advantage or a comparable tracked service, with protective packaging.</p>
 <p><strong>Extra coverage:</strong> Orders over $100 require a tracked service with enough purchased insurance to cover the merchandise value.</p>
 <p>Your available options and shipping charges will be shown before payment once our direct checkout opens. Not every order will qualify for every method.</p></div>
 <div><h2>Free cards &amp; packing</h2>
 <p>Our bonus common cards ship in the same package as purchased cards. Their count and estimated weight are included when deciding whether a light letter or a tracked parcel is appropriate.</p>
 <p>We use sleeves and protective backing appropriate to the cards and package. Letter-sized mail must meet USPS size, thickness, flexibility and weight rules. A rigid mailer may require parcel postage.</p></div>
 <div><h2>Postage, timing &amp; returns</h2>
 <p>Exact tracked shipping prices vary with the weight and destination. Our checkout shows the shipping charge before purchase, and we'll publish finalized handling and return policies before accepting direct-site payments.</p>
 <p>eBay Standard Envelope is only available for eligible eBay purchases, not purchases through this website. Until direct checkout is open, orders placed through eBay follow the shipping and return policy on their eBay listing.</p></div>
 <Link href="/help" className="button button-outline">Read the FAQs →</Link>
 </section></>}
