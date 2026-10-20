import Link from 'next/link';
export function RewardSteps({compact=false}:{compact?:boolean}){return <div className={compact?'reward-steps reward-steps-compact':'reward-steps'} aria-label="Guaranteed free cards only with Hometown Card Shop purchases">
  <div className="reward-steps-cell"><span>HOMETOWN PURCHASE</span><strong>1</strong><small>FREE CARD</small></div>
  <div className="reward-steps-cell"><span>SPEND $10</span><strong>5</strong><small>FREE CARDS</small></div>
  <div className="reward-steps-cell"><span>SPEND $25</span><strong>10</strong><small>FREE CARDS</small></div>
  <div className="reward-steps-cell"><span>SPEND $50</span><strong>20</strong><small>FREE CARDS</small></div>
  {!compact?<Link href="/help#rewards" className="reward-steps-more">The details →</Link>:null}
 </div>}
