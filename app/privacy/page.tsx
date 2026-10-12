import type {Metadata} from 'next';
import Link from 'next/link';

export const metadata:Metadata={
 title:'Privacy Policy',
 description:'How Hometown Card Shop collects, uses and protects customer, shopkeeper and connected eBay seller information.',
 alternates:{canonical:'/privacy'},
 robots:{index:true,follow:true}
};
const effective='October 12, 2026';
export default function PrivacyPolicy(){
 return <>
  <section className="inner-hero"><div className="shell">
   <span className="kicker">YOUR INFORMATION MATTERS</span>
   <h1>Privacy Policy</h1>
   <p>What we collect, why we use it, and how to contact us.</p>
  </div></section>
  <section className="shell" style={{padding:"52px 0 76px"}}>
   <article className="editorial-prose" style={{maxWidth:860}}>
    <p><strong>Effective date:</strong> {effective}</p>
    <p>Hometown Card Shop operates from Amity, Arkansas, United States. This policy describes how our website at <a href="https://www.hometowncardshop.com">www.hometowncardshop.com</a> handles information about customers, shopkeepers, and sellers who optionally connect their eBay accounts.</p>
    <h2>Information we collect</h2>
    <p>When you place an order, we collect the information needed to process and fulfill it, including your name, email address, shipping address, purchased items, amounts, order status and shipment details. When you create or manage a seller account, we also process account login information, shop details, listings and inventory changes. We receive information you provide through support messages and other forms.</p>
    <p>Payment card information is entered into the secure payment process operated by Stripe. We receive transaction identifiers and payment status from Stripe, not your full payment card number.</p>
    <h2>Optional eBay connection</h2>
    <p>Connecting an eBay seller account is optional. A seller can use our website's manual listings and CSV import without eBay. If a seller connects eBay, we obtain authorization using eBay's sign-in process and access permitted information such as the eBay account identifier, seller listings, listing photos, prices, quantities and order-line identifiers needed to coordinate stock across the two sales channels.</p>
    <p>We store the connection's OAuth refresh token in encrypted form and use it only to perform authorized eBay account tasks. The integration can be disconnected from the shopkeeper dashboard. We do not ask for, store or need an eBay account password. Where supported, eBay account deletion notices result in revocation of stored account connections and the removal or restriction of linked eBay data, subject to legally required transaction records.</p>
    <h2>How we use information</h2>
    <p>We use personal and shop information to process purchases, calculate shipping and checkout totals, prevent duplicate inventory sales, handle returns and customer service, operate seller dashboards, detect abuse, and send essential transaction or shop-operator notifications. We also use site analytics to understand aggregate website usage and improve the store.</p>
    <h2>Services that process information</h2>
    <p>We rely on service providers as needed to operate the website, including Stripe for payments, Supabase for account and order data, Vercel for website hosting and analytics, Cloudflare Turnstile for bot prevention, Resend for email notifications, and eBay when a seller chooses to connect an eBay account. These services process information according to their roles and their own privacy notices.</p>
    <h2>Cookies and website security</h2>
    <p>The website uses browser storage and cookies for functions such as keeping a shopping cart, signed-in sessions, and secure account access. Security systems may collect technical details necessary to help prevent fraudulent requests. Vercel Analytics may collect website usage events. You can change browser settings to manage cookies, but disabling essential cookies can prevent sign-in or checkout from working.</p>
    <h2>Information sharing</h2>
    <p>We share data with service providers when needed to operate the store, fulfill transactions, send messages, and run authorized integrations. We may disclose information when required by law, to enforce rights, or to protect customers and the store. We do not sell customer or connected seller personal information to data brokers.</p>
    <h2>Retention and security</h2>
    <p>We retain order and transaction information for as long as needed for fulfillment, refunds, customer support, accounting, legal requirements and dispute resolution. We limit access to account and integration data, use encrypted connections, and protect sensitive OAuth credentials. No internet system is completely secure.</p>
    <h2>Your requests and choices</h2>
    <p>You can ask about information associated with your purchases or seller account, request corrections or deletion when appropriate, or disconnect an eBay account using the shop dashboard. Some transaction information must be kept for legitimate accounting, tax, dispute or legal obligations. We will assess requests consistent with applicable law.</p>
    <h2>Updates to this policy</h2>
    <p>We may update this privacy policy as the shop and its integrations change. The effective date above will change when we make a material update.</p>
    <h2>Contact us</h2>
    <p>Questions or privacy requests? Email <a href="mailto:altifygenerator@gmail.com?subject=Hometown%20Card%20Shop%20Privacy">altifygenerator@gmail.com</a>. Hometown Card Shop is based in Amity, Arkansas, United States.</p>
    <p>For shipping and order questions, see our <Link href="/shipping">shipping and returns page</Link>.</p>
   </article>
  </section>
 </>;
}
