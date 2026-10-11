/** Public copy and launch switches. Always recompute rewards on the server at checkout. */
export const SHOP_NAME = 'Hometown Card Shop';
export const SHOP_TAGLINE = 'The neighborhood card shop, right here on your screen.';
export const FOUNDING_SELLER_SLUG = 'hometown-card-shop';
export const SELLER_SIGNUPS_ENABLED = false; // Do not accept seller onboarding until moderation, Connect and tax workflows are ready.
export const REWARDS_PROGRAM = {
  id: 'hometown-bonus-cards-v1',
  funderSellerSlug: FOUNDING_SELLER_SLUG,
  description: 'Guaranteed bonus common cards from our bulk boxes. No entry fee, no drawing.',
  tiers: [
    { minimumCents: 1, cards: 1 },
    { minimumCents: 1000, cards: 5 },
    { minimumCents: 2500, cards: 10 },
    { minimumCents: 5000, cards: 20 },
  ] as const,
};
