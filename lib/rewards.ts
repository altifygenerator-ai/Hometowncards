import {REWARDS_PROGRAM} from './shop-config';
export const rewardTiers = REWARDS_PROGRAM.tiers;
/** Merchandise subtotal only; tax/shipping never count. Free cards require a completed paid order. */
export function bonusCount(subtotalCents:number):number {
  if (!Number.isFinite(subtotalCents) || subtotalCents < 1) return 0;
  return [...rewardTiers].reverse().find(t=>subtotalCents >= t.minimumCents)?.cards || 0;
}
export function nextReward(subtotalCents:number){
  for (const step of rewardTiers) {
    if (subtotalCents < step.minimumCents) return {remaining:step.minimumCents-subtotalCents,count:step.cards,goal:step.minimumCents};
  }
  return null;
}
export function rewardExplanation(){return 'One free card with any merchandise purchase, five at $10, ten at $25, or twenty at $50. Non-stacking tiers; shipping and taxes do not count.';}
