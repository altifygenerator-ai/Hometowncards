import Link from 'next/link';import type {Product} from '@/lib/catalog';import {formatMoney} from '@/lib/catalog';import {AddToCart} from './add-to-cart';
export function ProductCard({product}:{product:Product}){
 return <article className="product-card">
  <Link href={'/cards/'+product.id} className="product-art" aria-label={'View '+product.title}>
   {product.image?<img src={product.image} alt={'Photo of '+product.title} loading="lazy" referrerPolicy="no-referrer"/>:<div className="missing-art"><span>IMAGE<br/>UNAVAILABLE</span></div>}
   {product.year?<span className="year-tag">{product.year}</span>:null}
  </Link>
  <div className="product-details"><div className="product-kind">{product.sport}{product.team?' · '+product.team:''}</div>
   <Link href={'/cards/'+product.id} className="product-name">{product.title}</Link>
   {product.sellerSlug!=='hometown-card-shop'&&<Link href={'/sellers/'+product.sellerSlug} className="product-dealer-link">Sold by {product.sellerName} →</Link>}
   <div className="product-bottom"><span className="price">{formatMoney(product.price)}</span><span className="item-status">{product.quantity===1?'1 available':product.quantity+' available'}</span></div>
   <AddToCart product={product}/>
  </div>
 </article>;
}
