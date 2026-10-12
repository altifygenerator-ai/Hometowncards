import Link from 'next/link';
import {SellerInterestForm} from '@/components/seller-interest-form';
export const metadata={title:'Interested in Selling Cards? | Hometown Card Shop',description:'Have a collection of sports or trading cards to sell? Let Hometown Card Shop know you might be interested in selling here someday.',robots:{index:false,follow:true}};
export default function SellPage(){return <><section className="inner-hero"><div className="shell">
 <span className="kicker">JUST GAUGING INTEREST</span>
 <h1>Interested in selling cards here?</h1>
 <p>We’re considering ways to welcome other card collectors and independent sellers in the future. Nothing is open for signup yet, but we’d like to hear from you.</p>
 </div></section>
 <section className="shell dealer-landing"><div className="dealer-grid">
 <div className="dealer-benefits"><span className="kicker">TELL US ABOUT YOUR COLLECTION</span>
 <h2>Got some cards to sell?</h2>
 <p>Whether you have a few boxes of vintage baseball cards or thousands of singles, let us know what you sell and where you sell now.</p>
 <p>This is simply an interest list. There are no accounts to open, no fees to pay, and no commitment. We’ll only reach out if we begin inviting other sellers.</p>
 <Link href="/shop" className="corner-text-link">Back to browsing cards →</Link>
 </div>
 <section className="dealer-form-wrap" id="interest"><span className="kicker">SELLER INTEREST FORM</span>
 <h2>Tell us a little about yourself.</h2><SellerInterestForm/></section>
 </div></section></>}